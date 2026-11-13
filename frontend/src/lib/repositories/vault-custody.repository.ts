/**
 * CakeToHome ERP — Vault Custody Repository
 * Phase C7.5: Branch Cash Control & Vault Custody Expansion
 *
 * Implements immutable ledger persistence for branch safe/vault custody.
 * Invariants:
 * 1. Vault balances are strictly DERIVED from public.branch_vault_movement. Zero mutable scalar balances.
 * 2. Immutable ledger enforced at DB level (trigger rejects UPDATE/DELETE).
 * 3. Unique constraint on (source_type, source_id) prevents duplicate entries.
 */

import { dbQuery } from "../db";
import type { PoolClient } from "pg";
import {
  BranchVaultMovementRow,
  VaultMovementDirection,
  VaultMovementType,
  VaultSourceType,
} from "../types/vault-custody.types";

function round2(num: number): number {
  return Math.round((num + Number.EPSILON) * 100) / 100;
}

export class VaultCustodyRepository {
  /**
   * Calculates live, authoritative vault custody balance for a branch.
   * Net = SUM(IN) - SUM(OUT).
   */
  static async getDerivedVaultCustody(
    branchId: string,
    client?: PoolClient
  ): Promise<number> {
    const queryFn = client ? client.query.bind(client) : dbQuery;
    const sql = `
      SELECT 
        ROUND(COALESCE(SUM(CASE WHEN direction = 'IN' THEN amount ELSE -amount END), 0.00), 2) AS custody_balance
      FROM public.branch_vault_movement
      WHERE branch_id = $1;
    `;
    const res = await queryFn(sql, [branchId]);
    return Number(res.rows[0]?.custody_balance || 0);
  }

  /**
   * Finds a vault movement by source identity (idempotency query).
   */
  static async findBySource(
    sourceType: VaultSourceType | string,
    sourceId: string,
    client?: PoolClient
  ): Promise<BranchVaultMovementRow | null> {
    const queryFn = client ? client.query.bind(client) : dbQuery;
    const sql = `
      SELECT 
        id, branch_id, direction, movement_type,
        amount::numeric::float8 AS amount,
        source_type, source_id, teller_session_id, teller_movement_id,
        performed_by, witnessed_by, narration, created_at
      FROM public.branch_vault_movement
      WHERE source_type = $1 AND source_id = $2;
    `;
    const res = await queryFn(sql, [sourceType, sourceId]);
    return res.rows[0] || null;
  }

  /**
   * Inserts an immutable vault custody movement.
   */
  static async insertMovement(
    params: {
      branch_id: string;
      direction: VaultMovementDirection;
      movement_type: VaultMovementType;
      amount: number;
      source_type: VaultSourceType;
      source_id: string;
      teller_session_id?: string | null;
      teller_movement_id?: string | null;
      performed_by: string;
      witnessed_by?: string | null;
      narration?: string | null;
    },
    client: PoolClient
  ): Promise<BranchVaultMovementRow> {
    const amount = round2(params.amount);
    const sql = `
      INSERT INTO public.branch_vault_movement (
        branch_id, direction, movement_type, amount,
        source_type, source_id, teller_session_id, teller_movement_id,
        performed_by, witnessed_by, narration
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      RETURNING 
        id, branch_id, direction, movement_type,
        amount::numeric::float8 AS amount,
        source_type, source_id, teller_session_id, teller_movement_id,
        performed_by, witnessed_by, narration, created_at;
    `;
    const res = await client.query(sql, [
      params.branch_id,
      params.direction,
      params.movement_type,
      amount,
      params.source_type,
      params.source_id,
      params.teller_session_id || null,
      params.teller_movement_id || null,
      params.performed_by,
      params.witnessed_by || null,
      params.narration || null,
    ]);
    return res.rows[0];
  }

  /**
   * Lists recent vault movements for a branch with optional pagination.
   */
  static async listByBranch(
    branchId: string,
    limitOrOptions: number | { limit?: number; offset?: number } = 50,
    client?: PoolClient
  ): Promise<BranchVaultMovementRow[]> {
    const queryFn = client ? client.query.bind(client) : dbQuery;
    const limit = typeof limitOrOptions === "number" ? limitOrOptions : (limitOrOptions.limit || 50);
    const offset = typeof limitOrOptions === "number" ? 0 : (limitOrOptions.offset || 0);
    const sql = `
      SELECT 
        vm.id, vm.branch_id, vm.direction, vm.movement_type,
        vm.amount::numeric::float8 AS amount,
        vm.source_type, vm.source_id, vm.teller_session_id, vm.teller_movement_id,
        vm.performed_by, vm.witnessed_by, vm.narration, vm.created_at,
        b.name AS branch_name,
        COALESCE(u_p.full_name, u_p.display_name) AS performed_by_name,
        COALESCE(u_w.full_name, u_w.display_name) AS witnessed_by_name
      FROM public.branch_vault_movement vm
      JOIN public.branch b ON b.id = vm.branch_id
      LEFT JOIN public.profiles u_p ON u_p.id::text = vm.performed_by
      LEFT JOIN public.profiles u_w ON u_w.id::text = vm.witnessed_by
      WHERE vm.branch_id = $1
      ORDER BY vm.created_at DESC, vm.id DESC
      LIMIT $2 OFFSET $3;
    `;
    const res = await queryFn(sql, [branchId, limit, offset]);
    return res.rows;
  }
}
