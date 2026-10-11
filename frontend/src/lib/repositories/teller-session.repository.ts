/**
 * CakeToHome ERP — Teller Session Repository
 * Phase C3: Teller & Session Domain Services + Repositories
 *
 * Direct parameterized SQL operations against public.teller_session.
 * Invariants:
 * 1. Database partial unique index uq_teller_session_active enforces at most one active session per teller.
 * 2. Composite FK fk_teller_session_teller_branch anchors (teller_id, branch_id) to teller.
 * 3. Supports SELECT ... FOR UPDATE for pessimistic concurrency control during open/close/verify.
 */

import { dbQuery } from "../db";
import type { PoolClient } from "pg";
import {
  TellerSessionRow,
  TellerSessionStatus,
  TellerDomainError,
} from "../types/teller.types";

export class TellerSessionRepository {
  /**
   * Finds a teller session by primary key ID.
   */
  static async findById(
    id: string,
    client?: PoolClient,
    forUpdate = false
  ): Promise<TellerSessionRow | null> {
    const queryFn = client ? client.query.bind(client) : dbQuery;
    const lockClause = forUpdate ? " FOR UPDATE" : "";
    const sql = `
      SELECT 
        s.id, s.teller_id, s.branch_id, s.status,
        s.opening_float::numeric::float8 as opening_float,
        s.expected_cash::numeric::float8 as expected_cash,
        CASE WHEN s.closing_count IS NOT NULL THEN s.closing_count::numeric::float8 ELSE NULL END as closing_count,
        CASE WHEN s.variance IS NOT NULL THEN s.variance::numeric::float8 ELSE NULL END as variance,
        s.opened_by, s.opened_at,
        s.closed_by, s.closed_at,
        s.verified_by, s.verified_at,
        s.settled_by, s.settled_at,
        s.settlement_voucher_id, s.notes,
        s.created_at, s.updated_at,
        t.name as teller_name, t.code as teller_code,
        b.name as branch_name, b.code as branch_code
      FROM public.teller_session s
      JOIN public.teller t ON t.id = s.teller_id
      JOIN public.branch b ON b.id = s.branch_id
      WHERE s.id = $1
      ${lockClause};
    `;
    const res = await queryFn(sql, [id]);
    return res.rows[0] || null;
  }

  /**
   * Finds the currently active session for a teller in ('OPEN', 'CLOSING', 'PENDING_VERIFICATION').
   */
  static async findActiveByTellerId(
    tellerId: string,
    client?: PoolClient,
    forUpdate = false
  ): Promise<TellerSessionRow | null> {
    const queryFn = client ? client.query.bind(client) : dbQuery;
    const lockClause = forUpdate ? " FOR UPDATE" : "";
    const sql = `
      SELECT 
        s.id, s.teller_id, s.branch_id, s.status,
        s.opening_float::numeric::float8 as opening_float,
        s.expected_cash::numeric::float8 as expected_cash,
        CASE WHEN s.closing_count IS NOT NULL THEN s.closing_count::numeric::float8 ELSE NULL END as closing_count,
        CASE WHEN s.variance IS NOT NULL THEN s.variance::numeric::float8 ELSE NULL END as variance,
        s.opened_by, s.opened_at,
        s.closed_by, s.closed_at,
        s.verified_by, s.verified_at,
        s.settled_by, s.settled_at,
        s.settlement_voucher_id, s.notes,
        s.created_at, s.updated_at,
        t.name as teller_name, t.code as teller_code,
        b.name as branch_name, b.code as branch_code
      FROM public.teller_session s
      JOIN public.teller t ON t.id = s.teller_id
      JOIN public.branch b ON b.id = s.branch_id
      WHERE s.teller_id = $1 
        AND s.status IN ('OPEN', 'CLOSING', 'PENDING_VERIFICATION')
      ${lockClause};
    `;
    const res = await queryFn(sql, [tellerId]);
    return res.rows[0] || null;
  }

  /**
   * Finds all active sessions in a branch.
   */
  static async findActiveByBranchId(
    branchId: string,
    client?: PoolClient
  ): Promise<TellerSessionRow[]> {
    const queryFn = client ? client.query.bind(client) : dbQuery;
    const sql = `
      SELECT 
        s.id, s.teller_id, s.branch_id, s.status,
        s.opening_float::numeric::float8 as opening_float,
        s.expected_cash::numeric::float8 as expected_cash,
        CASE WHEN s.closing_count IS NOT NULL THEN s.closing_count::numeric::float8 ELSE NULL END as closing_count,
        CASE WHEN s.variance IS NOT NULL THEN s.variance::numeric::float8 ELSE NULL END as variance,
        s.opened_by, s.opened_at,
        s.closed_by, s.closed_at,
        s.verified_by, s.verified_at,
        s.settled_by, s.settled_at,
        s.settlement_voucher_id, s.notes,
        s.created_at, s.updated_at,
        t.name as teller_name, t.code as teller_code,
        b.name as branch_name, b.code as branch_code
      FROM public.teller_session s
      JOIN public.teller t ON t.id = s.teller_id
      JOIN public.branch b ON b.id = s.branch_id
      WHERE s.branch_id = $1 
        AND s.status IN ('OPEN', 'CLOSING', 'PENDING_VERIFICATION')
      ORDER BY s.opened_at DESC;
    `;
    const res = await queryFn(sql, [branchId]);
    return res.rows;
  }

  /**
   * Lists historical and active sessions for a teller.
   */
  static async listByTeller(
    tellerId: string,
    client?: PoolClient
  ): Promise<TellerSessionRow[]> {
    const queryFn = client ? client.query.bind(client) : dbQuery;
    const sql = `
      SELECT 
        s.id, s.teller_id, s.branch_id, s.status,
        s.opening_float::numeric::float8 as opening_float,
        s.expected_cash::numeric::float8 as expected_cash,
        CASE WHEN s.closing_count IS NOT NULL THEN s.closing_count::numeric::float8 ELSE NULL END as closing_count,
        CASE WHEN s.variance IS NOT NULL THEN s.variance::numeric::float8 ELSE NULL END as variance,
        s.opened_by, s.opened_at,
        s.closed_by, s.closed_at,
        s.verified_by, s.verified_at,
        s.settled_by, s.settled_at,
        s.settlement_voucher_id, s.notes,
        s.created_at, s.updated_at,
        t.name as teller_name, t.code as teller_code,
        b.name as branch_name, b.code as branch_code
      FROM public.teller_session s
      JOIN public.teller t ON t.id = s.teller_id
      JOIN public.branch b ON b.id = s.branch_id
      WHERE s.teller_id = $1
      ORDER BY s.opened_at DESC;
    `;
    const res = await queryFn(sql, [tellerId]);
    return res.rows;
  }

  /**
   * Lists sessions in a branch with optional status filter.
   */
  static async listByBranch(
    branchId: string,
    statusFilter?: TellerSessionStatus,
    client?: PoolClient
  ): Promise<TellerSessionRow[]> {
    const queryFn = client ? client.query.bind(client) : dbQuery;
    let sql = `
      SELECT 
        s.id, s.teller_id, s.branch_id, s.status,
        s.opening_float::numeric::float8 as opening_float,
        s.expected_cash::numeric::float8 as expected_cash,
        CASE WHEN s.closing_count IS NOT NULL THEN s.closing_count::numeric::float8 ELSE NULL END as closing_count,
        CASE WHEN s.variance IS NOT NULL THEN s.variance::numeric::float8 ELSE NULL END as variance,
        s.opened_by, s.opened_at,
        s.closed_by, s.closed_at,
        s.verified_by, s.verified_at,
        s.settled_by, s.settled_at,
        s.settlement_voucher_id, s.notes,
        s.created_at, s.updated_at,
        t.name as teller_name, t.code as teller_code,
        b.name as branch_name, b.code as branch_code
      FROM public.teller_session s
      JOIN public.teller t ON t.id = s.teller_id
      JOIN public.branch b ON b.id = s.branch_id
      WHERE s.branch_id = $1
    `;
    const params: any[] = [branchId];
    if (statusFilter) {
      params.push(statusFilter);
      sql += ` AND s.status = $2`;
    }
    sql += ` ORDER BY s.opened_at DESC;`;
    const res = await queryFn(sql, params);
    return res.rows;
  }

  /**
   * Creates a new OPEN session.
   */
  static async create(
    params: {
      id?: string;
      teller_id: string;
      branch_id: string;
      opening_float: number;
      expected_cash: number;
      opened_by: string;
      notes?: string | null;
    },
    client?: PoolClient
  ): Promise<TellerSessionRow> {
    const queryFn = client ? client.query.bind(client) : dbQuery;
    const id = params.id || `sess_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    const tellerId = params.teller_id;
    const branchId = params.branch_id;
    const openingFloat = Math.round(params.opening_float * 100) / 100;
    const expectedCash = Math.round(params.expected_cash * 100) / 100;
    const openedBy = params.opened_by;
    const notes = params.notes?.trim() || null;

    if (openingFloat < 0) {
      throw new TellerDomainError(
        "INVALID_AMOUNT",
        "Opening float cannot be negative."
      );
    }

    try {
      const sql = `
        INSERT INTO public.teller_session (
          id, teller_id, branch_id, status,
          opening_float, expected_cash, closing_count, variance,
          opened_by, opened_at, notes, created_at, updated_at
        ) VALUES (
          $1, $2, $3, 'OPEN',
          $4, $5, NULL, NULL,
          $6, NOW(), $7, NOW(), NOW()
        )
        RETURNING *;
      `;
      const res = await queryFn(sql, [
        id,
        tellerId,
        branchId,
        openingFloat,
        expectedCash,
        openedBy,
        notes,
      ]);
      const created = res.rows[0];
      return (await this.findById(created.id, client)) || created;
    } catch (err: any) {
      if (err.constraint === "uq_teller_session_active") {
        throw new TellerDomainError(
          "ACTIVE_SESSION_EXISTS",
          `Teller '${tellerId}' already has an active session. Close or cancel the active session first.`
        );
      }
      if (err.constraint === "fk_teller_session_teller_branch") {
        throw new TellerDomainError(
          "UNAUTHORIZED_BRANCH",
          `Branch mismatch: Teller '${tellerId}' does not belong to branch '${branchId}'.`
        );
      }
      throw err;
    }
  }

  /**
   * Transitions session to CLOSING and records closing count & variance.
   */
  static async closeSession(
    id: string,
    params: {
      expected_cash: number;
      closing_count: number;
      variance: number;
      closed_by: string;
      notes?: string | null;
    },
    client?: PoolClient
  ): Promise<TellerSessionRow> {
    const queryFn = client ? client.query.bind(client) : dbQuery;
    const expectedCash = Math.round(params.expected_cash * 100) / 100;
    const closingCount = Math.round(params.closing_count * 100) / 100;
    const variance = Math.round(params.variance * 100) / 100;
    const closedBy = params.closed_by;
    const notes = params.notes?.trim() || null;

    try {
      const sql = `
        UPDATE public.teller_session
        SET status = 'CLOSING',
            expected_cash = $1,
            closing_count = $2,
            variance = $3,
            closed_by = $4,
            closed_at = NOW(),
            notes = COALESCE($5, notes),
            updated_at = NOW()
        WHERE id = $6
        RETURNING *;
      `;
      await queryFn(sql, [
        expectedCash,
        closingCount,
        variance,
        closedBy,
        notes,
        id,
      ]);
      return (await this.findById(id, client))!;
    } catch (err: any) {
      if (err.constraint === "chk_teller_session_variance") {
        throw new TellerDomainError(
          "INVALID_AMOUNT",
          `Variance (${variance}) does not match closing_count (${closingCount}) - expected_cash (${expectedCash}).`
        );
      }
      throw err;
    }
  }

  /**
   * Records supervisor verification and transitions session to PENDING_VERIFICATION.
   */
  static async verifySession(
    id: string,
    params: {
      expected_cash: number;
      closing_count: number;
      variance: number;
      verified_by: string;
      notes?: string | null;
    },
    client?: PoolClient
  ): Promise<TellerSessionRow> {
    const queryFn = client ? client.query.bind(client) : dbQuery;
    const expectedCash = Math.round(params.expected_cash * 100) / 100;
    const closingCount = Math.round(params.closing_count * 100) / 100;
    const variance = Math.round(params.variance * 100) / 100;
    const verifiedBy = params.verified_by;
    const notes = params.notes?.trim() || null;

    try {
      const sql = `
        UPDATE public.teller_session
        SET status = 'PENDING_VERIFICATION',
            expected_cash = $1,
            closing_count = $2,
            variance = $3,
            verified_by = $4,
            verified_at = NOW(),
            notes = COALESCE($5, notes),
            updated_at = NOW()
        WHERE id = $6
        RETURNING *;
      `;
      await queryFn(sql, [
        expectedCash,
        closingCount,
        variance,
        verifiedBy,
        notes,
        id,
      ]);
      return (await this.findById(id, client))!;
    } catch (err: any) {
      if (err.constraint === "chk_teller_session_sod_opener_verifier") {
        throw new TellerDomainError(
          "SOD_VIOLATION",
          "Session verifier cannot be the session opener."
        );
      }
      if (err.constraint === "chk_teller_session_sod_closer_verifier") {
        throw new TellerDomainError(
          "SOD_VIOLATION",
          "Session verifier cannot be the session closer."
        );
      }
      throw err;
    }
  }

  /**
   * Cancels an open session.
   */
  static async cancelSession(
    id: string,
    actorUserId: string,
    notes?: string | null,
    client?: PoolClient
  ): Promise<TellerSessionRow> {
    const queryFn = client ? client.query.bind(client) : dbQuery;
    const sql = `
      UPDATE public.teller_session
      SET status = 'CANCELLED',
          notes = COALESCE($1, notes),
          updated_at = NOW()
      WHERE id = $2 AND status = 'OPEN'
      RETURNING *;
    `;
    const res = await queryFn(sql, [notes || `Cancelled by ${actorUserId}`, id]);
    if (res.rows.length === 0) {
      throw new TellerDomainError(
        "INVALID_SESSION_STATE",
        `Only OPEN sessions can be cancelled.`
      );
    }
    return (await this.findById(id, client))!;
  }

  /**
   * Transitions a session to SETTLED and persists the settlement voucher ID.
   * Enforces DB invariants:
   * 1. chk_teller_session_sod_opener_settler
   * 2. chk_teller_session_sod_closer_settler
   * 3. chk_teller_session_sod_verifier_settler
   * 4. chk_teller_session_settled_invariants (variance != 0 requires settlement_voucher_id; variance == 0 requires NULL voucher)
   */
  static async settleSession(
    id: string,
    params: {
      settled_by: string;
      settlement_voucher_id: string | null;
      notes?: string | null;
    },
    client?: PoolClient
  ): Promise<TellerSessionRow> {
    const queryFn = client ? client.query.bind(client) : dbQuery;
    const settledBy = params.settled_by;
    const voucherId = params.settlement_voucher_id;
    const notes = params.notes?.trim() || null;

    try {
      const sql = `
        UPDATE public.teller_session
        SET status = 'SETTLED',
            settled_by = $1,
            settled_at = NOW(),
            settlement_voucher_id = $2,
            notes = COALESCE($3, notes),
            updated_at = NOW()
        WHERE id = $4
        RETURNING *;
      `;
      const res = await queryFn(sql, [settledBy, voucherId, notes, id]);
      if (res.rows.length === 0) {
        throw new TellerDomainError(
          "SESSION_NOT_FOUND",
          `Session '${id}' not found.`
        );
      }
      return (await this.findById(id, client))!;
    } catch (err: any) {
      if (err.constraint === "chk_teller_session_sod_opener_settler") {
        throw new TellerDomainError(
          "SOD_VIOLATION",
          "Session settler cannot be the session opener."
        );
      }
      if (err.constraint === "chk_teller_session_sod_closer_settler") {
        throw new TellerDomainError(
          "SOD_VIOLATION",
          "Session settler cannot be the session closer."
        );
      }
      if (err.constraint === "chk_teller_session_sod_verifier_settler") {
        throw new TellerDomainError(
          "SOD_VIOLATION",
          "Session settler cannot be the count verifier."
        );
      }
      if (err.constraint === "chk_teller_session_settled_invariants") {
        throw new TellerDomainError(
          "INVALID_SESSION_STATE",
          "Settlement invariants violated: non-zero variance requires settlement voucher; zero variance requires NULL voucher."
        );
      }
      throw err;
    }
  }

  /**
   * Lists teller sessions matching optional branch, teller, and status filters.
   */
  static async listSessions(
    filters: { branchId?: string; tellerId?: string; status?: TellerSessionStatus },
    client?: PoolClient
  ): Promise<TellerSessionRow[]> {
    const queryFn = client ? client.query.bind(client) : dbQuery;
    const conditions: string[] = [];
    const values: any[] = [];
    let idx = 1;

    if (filters.branchId) {
      conditions.push(`s.branch_id = $${idx++}`);
      values.push(filters.branchId);
    }
    if (filters.tellerId) {
      conditions.push(`s.teller_id = $${idx++}`);
      values.push(filters.tellerId);
    }
    if (filters.status) {
      conditions.push(`s.status = $${idx++}`);
      values.push(filters.status);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";
    const sql = `
      SELECT 
        s.id, s.teller_id, s.branch_id, s.status,
        s.opening_float::numeric::float8 as opening_float,
        s.expected_cash::numeric::float8 as expected_cash,
        CASE WHEN s.closing_count IS NOT NULL THEN s.closing_count::numeric::float8 ELSE NULL END as closing_count,
        CASE WHEN s.variance IS NOT NULL THEN s.variance::numeric::float8 ELSE NULL END as variance,
        s.opened_by, s.opened_at,
        s.closed_by, s.closed_at,
        s.verified_by, s.verified_at,
        s.settled_by, s.settled_at,
        s.settlement_voucher_id, s.notes,
        s.created_at, s.updated_at,
        t.name as teller_name, t.code as teller_code,
        b.name as branch_name, b.code as branch_code
      FROM public.teller_session s
      JOIN public.teller t ON t.id = s.teller_id
      JOIN public.branch b ON b.id = s.branch_id
      ${whereClause}
      ORDER BY s.opened_at DESC;
    `;
    const res = await queryFn(sql, values);
    return res.rows;
  }
}
