/**
 * CakeToHome ERP — Teller Movement Repository
 * Phase C3: Teller & Session Domain Services + Repositories
 *
 * Direct parameterized SQL operations against public.teller_movement.
 * Invariants:
 * 1. Database partial unique index uq_teller_movement_system_source guarantees idempotent source projection.
 * 2. Composite FK fk_teller_movement_session_branch anchors (teller_session_id, branch_id) to teller_session.
 * 3. PostgreSQL trigger trg_teller_movement_immutability rejects movements on SETTLED or CANCELLED sessions.
 */

import { dbQuery } from "../db";
import type { PoolClient } from "pg";
import {
  TellerMovementRow,
  CreateMovementParams,
  TellerDomainError,
} from "../types/teller.types";

export class TellerMovementRepository {
  /**
   * Finds a movement by primary key ID.
   */
  static async findById(
    id: string,
    client?: PoolClient
  ): Promise<TellerMovementRow | null> {
    const queryFn = client ? client.query.bind(client) : dbQuery;
    const sql = `
      SELECT 
        id, teller_session_id, branch_id, direction, movement_type,
        amount::numeric::float8 as amount,
        source_type, source_id, narration,
        created_by, created_at
      FROM public.teller_movement
      WHERE id = $1;
    `;
    const res = await queryFn(sql, [id]);
    return res.rows[0] || null;
  }

  /**
   * Lists all movements recorded in a teller session in chronological order.
   */
  static async listBySession(
    sessionId: string,
    client?: PoolClient
  ): Promise<TellerMovementRow[]> {
    const queryFn = client ? client.query.bind(client) : dbQuery;
    const sql = `
      SELECT 
        id, teller_session_id, branch_id, direction, movement_type,
        amount::numeric::float8 as amount,
        source_type, source_id, narration,
        created_by, created_at
      FROM public.teller_movement
      WHERE teller_session_id = $1
      ORDER BY created_at ASC, id ASC;
    `;
    const res = await queryFn(sql, [sessionId]);
    return res.rows;
  }

  /**
   * Lists all movements recorded for a branch across all sessions in reverse chronological order.
   */
  static async listByBranch(
    branchId: string,
    limit: number = 100,
    client?: PoolClient
  ): Promise<TellerMovementRow[]> {
    const queryFn = client ? client.query.bind(client) : dbQuery;
    const sql = `
      SELECT 
        id, teller_session_id, branch_id, direction, movement_type,
        amount::numeric::float8 as amount,
        source_type, source_id, narration,
        created_by, created_at
      FROM public.teller_movement
      WHERE branch_id = $1
      ORDER BY created_at DESC, id DESC
      LIMIT $2;
    `;
    const res = await queryFn(sql, [branchId, limit]);
    return res.rows;
  }

  /**
   * Finds a movement by source event (used for idempotency verification).
   */
  static async findBySource(
    sourceType: string,
    sourceId: string,
    client?: PoolClient
  ): Promise<TellerMovementRow | null> {
    const queryFn = client ? client.query.bind(client) : dbQuery;
    const sql = `
      SELECT 
        id, teller_session_id, branch_id, direction, movement_type,
        amount::numeric::float8 as amount,
        source_type, source_id, narration,
        created_by, created_at
      FROM public.teller_movement
      WHERE source_type = $1 AND source_id = $2;
    `;
    const res = await queryFn(sql, [sourceType, sourceId]);
    return res.rows[0] || null;
  }

  /**
   * Calculates sum of IN and OUT movements for a session directly from PostgreSQL.
   */
  static async getTotalsForSession(
    sessionId: string,
    client?: PoolClient
  ): Promise<{ totalIn: number; totalOut: number; netMovement: number }> {
    const queryFn = client ? client.query.bind(client) : dbQuery;
    const sql = `
      SELECT
        COALESCE(SUM(CASE WHEN direction = 'IN' THEN amount ELSE 0 END), 0)::numeric::float8 AS total_in,
        COALESCE(SUM(CASE WHEN direction = 'OUT' THEN amount ELSE 0 END), 0)::numeric::float8 AS total_out
      FROM public.teller_movement
      WHERE teller_session_id = $1;
    `;
    const res = await queryFn(sql, [sessionId]);
    const row = res.rows[0] || { total_in: 0, total_out: 0 };
    const totalIn = Math.round(row.total_in * 100) / 100;
    const totalOut = Math.round(row.total_out * 100) / 100;
    const netMovement = Math.round((totalIn - totalOut) * 100) / 100;
    return { totalIn, totalOut, netMovement };
  }

  /**
   * Creates a new teller movement row.
   */
  static async create(
    params: CreateMovementParams,
    client?: PoolClient
  ): Promise<TellerMovementRow> {
    const queryFn = client ? client.query.bind(client) : dbQuery;
    const id = `mov_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    const sessionId = params.session_id;
    const branchId = params.branch_id;
    const direction = params.direction;
    const movementType = params.movement_type;
    const amount = Math.round(params.amount * 100) / 100;
    const sourceType = params.source_type || null;
    const sourceId = params.source_id || null;
    const narration = params.narration?.trim() || null;
    const createdBy = params.created_by || "system";

    if (amount <= 0) {
      throw new TellerDomainError(
        "INVALID_AMOUNT",
        `Movement amount must be greater than zero. Got ${amount}.`
      );
    }

    try {
      const sql = `
        INSERT INTO public.teller_movement (
          id, teller_session_id, branch_id, direction, movement_type,
          amount, source_type, source_id, narration, created_by, created_at
        ) VALUES (
          $1, $2, $3, $4, $5,
          $6, $7, $8, $9, $10, NOW()
        )
        RETURNING 
          id, teller_session_id, branch_id, direction, movement_type,
          amount::numeric::float8 as amount,
          source_type, source_id, narration,
          created_by, created_at;
      `;
      const res = await queryFn(sql, [
        id,
        sessionId,
        branchId,
        direction,
        movementType,
        amount,
        sourceType,
        sourceId,
        narration,
        createdBy,
      ]);
      return res.rows[0];
    } catch (err: any) {
      // Catch idempotency violation
      if (err.constraint === "uq_teller_movement_system_source") {
        throw new TellerDomainError(
          "DUPLICATE_SOURCE_MOVEMENT",
          `Source event '${sourceType}:${sourceId}' has already projected into teller custody.`
        );
      }
      // Catch settled/cancelled trigger violation
      if (err.code === "55000" || err.message?.includes("immutable")) {
        throw new TellerDomainError(
          "SESSION_ALREADY_SETTLED",
          err.message || "Cannot add cash movement to settled or cancelled teller session."
        );
      }
      // Catch branch mismatch
      if (err.constraint === "fk_teller_movement_session_branch") {
        throw new TellerDomainError(
          "UNAUTHORIZED_BRANCH",
          `Branch mismatch: Session '${sessionId}' does not belong to branch '${branchId}'.`
        );
      }
      // Catch direction/type check constraint
      if (err.constraint === "chk_teller_movement_direction_type") {
        throw new TellerDomainError(
          "INVALID_AMOUNT",
          `Movement type '${movementType}' cannot have direction '${direction}'.`
        );
      }
      throw err;
    }
  }
}
