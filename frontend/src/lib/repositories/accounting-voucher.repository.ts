/**
 * CakeToHome ERP — Accounting Voucher Repository
 * Phase 4F Step 1: Data access layer for public.accounting_voucher.
 *
 * ARCHITECTURE:
 * - ALL branch_id values MUST come from the session/server — never from client payload.
 * - Voucher IDs are generated server-side; client-supplied IDs are never trusted.
 * - Forward-only lifecycle: DRAFT -> SUBMITTED -> APPROVED -> POSTED
 *   (POSTED is terminal status; DRAFT/SUBMITTED/APPROVED can be CANCELLED).
 * - Reversals: In accordance with Phase 4A and PostgreSQL chk_voucher_status,
 *   a POSTED voucher remains 'POSTED' and is linked to its compensating voucher via
 *   reversed_by_voucher_id.
 * - Idempotency enforced via DB partial unique index:
 *   idx_accounting_voucher_source_idempotency (reference_type, reference_id, reference_event)
 *   where status != 'CANCELLED' and reference_type != 'MANUAL'
 * - POSTED vouchers are immutable: chk_voucher_posted_immutable prevents UPDATE/DELETE.
 * - SoD invariant: approved_by != created_by (enforced in transition, also constrained in DB).
 * - All queries use strict $N parameterization — zero dynamic string interpolation.
 * - Repository methods accept an optional PoolClient for use inside caller-owned transactions.
 *
 * Security:
 * - BOLA/IDOR: All reads include branch_id scoping when a branch context is available.
 * - Branch identity: Always supplied by session/server layer — never by client.
 * - Mass-assignment: Only whitelisted fields are written.
 *
 * DB source of truth invariant:
 * PostgreSQL -> Repository -> Service -> API -> UI
 * No JSON files, no static arrays, no mock fallbacks.
 */

import { dbQuery } from "../db";
import type { PoolClient } from "pg";
import type {
  AccountingVoucherRow,
  VoucherType,
  VoucherStatus,
  VoucherCreateInput,
  VoucherListFilters,
  VoucherListResult,
  VoucherDetailResult,
} from "../types/accounting.types";

// ─── ID Generation ─────────────────────────────────────────────────────────────

function generateVoucherId(): string {
  const ts = Date.now().toString(36).toUpperCase().padStart(10, "0");
  const rnd = Math.random().toString(36).substring(2, 8).toUpperCase();
  return `vch_${ts}${rnd}`;
}

function generateVoucherNo(type: VoucherType, fiscalYear: string): string {
  const date = new Date();
  const yyyymmdd = date.toISOString().slice(0, 10).replace(/-/g, "");
  const rnd = Math.random().toString(36).substring(2, 8).toUpperCase();
  return `VCH-${type}-${fiscalYear}-${yyyymmdd}-${rnd}`;
}

// ─── Valid lifecycle transitions ────────────────────────────────────────────────
// Forward-only state machine. POSTED is terminal; CANCELLED allowed prior to posting.

const ALLOWED_TRANSITIONS: Record<VoucherStatus, VoucherStatus[]> = {
  DRAFT: ["SUBMITTED", "CANCELLED"],
  SUBMITTED: ["APPROVED", "CANCELLED"],
  APPROVED: ["POSTED", "CANCELLED"],
  POSTED: [],
  CANCELLED: [],
};

/**
 * Validate a lifecycle transition.
 * Throws with an explicit error if the transition is illegal.
 */
export function assertValidVoucherTransition(
  currentStatus: VoucherStatus,
  targetStatus: VoucherStatus
): void {
  const allowed = ALLOWED_TRANSITIONS[currentStatus] ?? [];
  if (!allowed.includes(targetStatus)) {
    throw new Error(
      `Voucher lifecycle violation: cannot transition from '${currentStatus}' to '${targetStatus}'. ` +
        `Allowed next states: [${allowed.join(", ") || "none"}].`
    );
  }
}

// ─── AccountingVoucherRepository ───────────────────────────────────────────────

export class AccountingVoucherRepository {
  // ── CREATE ────────────────────────────────────────────────────────────────────

  /**
   * Create a new voucher in DRAFT status.
   * branchId and createdBy MUST come from the server session.
   * All amounts/account IDs are validated by the calling service before this call.
   * Idempotency: DB partial unique index raises constraint violation on duplicate source events.
   */
  static async createDraft(
    input: VoucherCreateInput,
    branchId: string,
    fiscalYear: string,
    createdBy: string,
    client?: PoolClient
  ): Promise<AccountingVoucherRow> {
    const id = generateVoucherId();
    const voucherNo = generateVoucherNo(input.voucher_type, fiscalYear);

    const sql = `
      INSERT INTO public.accounting_voucher
        (id, voucher_no, voucher_type, voucher_date, branch_id, fiscal_year,
         status, total_amount, currency,
         reference_type, reference_id, reference_event, reversal_of_voucher_id,
         narration, created_by,
         metadata, created_at, updated_at)
      VALUES
        ($1,$2,$3,$4,$5,$6,
         'DRAFT', 0, 'INR',
         $7,$8,$9,$10,
         $11,$12,
         $13,NOW(),NOW())
      RETURNING *
    `;
    const params = [
      id,
      voucherNo,
      input.voucher_type,
      input.voucher_date,
      branchId,
      fiscalYear,
      input.reference_type ?? null,
      input.reference_id ?? null,
      input.reference_event ?? "PRIMARY",
      input.reversal_of_voucher_id ?? null,
      input.narration,
      createdBy,
      input.metadata ? JSON.stringify(input.metadata) : null,
    ];

    const res = client
      ? await client.query<AccountingVoucherRow>(sql, params)
      : await dbQuery<AccountingVoucherRow>(sql, params);

    return res.rows[0];
  }

  // ── READ ──────────────────────────────────────────────────────────────────────

  /**
   * Find a single voucher by primary key.
   * SECURITY: branchId scoping for BOLA protection — always pass branchId for branch-manager access.
   */
  static async findById(
    id: string,
    branchId?: string,
    client?: PoolClient
  ): Promise<AccountingVoucherRow | null> {
    const conditions = ["v.id = $1", "v.deleted_at IS NULL"];
    const params: unknown[] = [id];

    if (branchId) {
      conditions.push("v.branch_id = $2");
      params.push(branchId);
    }

    const sql = `
      SELECT v.*, b.name AS branch_name
      FROM public.accounting_voucher v
      LEFT JOIN public.branch b ON b.id = v.branch_id
      WHERE ${conditions.join(" AND ")}
      LIMIT 1
    `;

    const res = client
      ? await client.query<AccountingVoucherRow>(sql, params)
      : await dbQuery<AccountingVoucherRow>(sql, params);

    return res.rows[0] ?? null;
  }

  /**
   * Find a voucher by its unique voucher number.
   */
  static async findByVoucherNo(
    voucherNo: string,
    client?: PoolClient
  ): Promise<AccountingVoucherRow | null> {
    const sql = `
      SELECT * FROM public.accounting_voucher
      WHERE voucher_no = $1 AND deleted_at IS NULL
      LIMIT 1
    `;
    const res = client
      ? await client.query<AccountingVoucherRow>(sql, [voucherNo])
      : await dbQuery<AccountingVoucherRow>(sql, [voucherNo]);
    return res.rows[0] ?? null;
  }

  /**
   * Idempotency lookup: returns an existing non-cancelled voucher for a source event, or null.
   * The calling service uses this to avoid duplicate postings for the same operational event.
   */
  static async findBySourceEvent(
    referenceType: string,
    referenceId: string,
    referenceEvent: string,
    client?: PoolClient
  ): Promise<AccountingVoucherRow | null> {
    const sql = `
      SELECT * FROM public.accounting_voucher
      WHERE reference_type = $1
        AND reference_id = $2
        AND reference_event = $3
        AND status <> 'CANCELLED'
        AND reference_type <> 'MANUAL'
        AND deleted_at IS NULL
      LIMIT 1
    `;
    const res = client
      ? await client.query<AccountingVoucherRow>(sql, [referenceType, referenceId, referenceEvent])
      : await dbQuery<AccountingVoucherRow>(sql, [referenceType, referenceId, referenceEvent]);
    return res.rows[0] ?? null;
  }

  // ── LIST (Server-Paginated) ───────────────────────────────────────────────────

  /**
   * List vouchers with server-side pagination and all required filters.
   * Never fetches the entire ledger into memory (hard cap: max 500 per page).
   * SECURITY: branch_id filter MUST be set for branch-manager access.
   */
  static async list(filters: VoucherListFilters = {}): Promise<VoucherListResult> {
    const conditions: string[] = ["v.deleted_at IS NULL"];
    const params: unknown[] = [];
    let idx = 1;

    if (filters.branch_id) {
      conditions.push(`v.branch_id = $${idx++}`);
      params.push(filters.branch_id);
    }
    if (filters.status) {
      conditions.push(`v.status = $${idx++}`);
      params.push(filters.status);
    }
    if (filters.voucher_type) {
      conditions.push(`v.voucher_type = $${idx++}`);
      params.push(filters.voucher_type);
    }
    if (filters.reference_type) {
      conditions.push(`v.reference_type = $${idx++}`);
      params.push(filters.reference_type);
    }
    if (filters.reference_id) {
      conditions.push(`v.reference_id = $${idx++}`);
      params.push(filters.reference_id);
    }
    if (filters.fiscal_year) {
      conditions.push(`v.fiscal_year = $${idx++}`);
      params.push(filters.fiscal_year);
    }
    if (filters.startDate) {
      conditions.push(`v.voucher_date >= $${idx++}`);
      params.push(filters.startDate);
    }
    if (filters.endDate) {
      conditions.push(`v.voucher_date <= $${idx++}`);
      params.push(filters.endDate);
    }
    if (filters.search) {
      conditions.push(`(v.voucher_no ILIKE $${idx} OR v.narration ILIKE $${idx})`);
      params.push(`%${filters.search}%`);
      idx++;
    }

    const where = conditions.join(" AND ");
    const limit = Math.min(filters.limit ?? 50, 500);
    const page = Math.max(filters.page ?? 1, 1);
    const offset = (page - 1) * limit;

    const baseSql = `
      FROM public.accounting_voucher v
      LEFT JOIN public.branch b ON b.id = v.branch_id
      WHERE ${where}
    `;

    const [dataRes, countRes] = await Promise.all([
      dbQuery<AccountingVoucherRow & { branch_name?: string; entry_no?: string }>(
        `SELECT v.*, b.name AS branch_name
         ${baseSql}
         ORDER BY v.voucher_date DESC, v.id DESC
         LIMIT $${idx} OFFSET $${idx + 1}`,
        [...params, limit, offset]
      ),
      dbQuery<{ count: string }>(
        `SELECT COUNT(*) AS count ${baseSql}`,
        params as unknown[]
      ),
    ]);

    const total = parseInt(countRes.rows[0]?.count ?? "0", 10);
    const totalPages = Math.ceil(total / limit);

    return {
      vouchers: dataRes.rows,
      total,
      page,
      limit,
      totalPages,
    };
  }

  // ── STATUS TRANSITIONS ────────────────────────────────────────────────────────

  /**
   * DRAFT -> SUBMITTED.
   * SECURITY: branchId from server session prevents cross-branch manipulation.
   */
  static async submit(
    id: string,
    submittedBy: string,
    branchId: string,
    client?: PoolClient
  ): Promise<AccountingVoucherRow> {
    const current = await AccountingVoucherRepository.findById(id, branchId, client);
    if (!current) {
      throw new Error(`Voucher '${id}' not found or not accessible in branch '${branchId}'.`);
    }
    assertValidVoucherTransition(current.status, "SUBMITTED");

    const sql = `
      UPDATE public.accounting_voucher
      SET status = 'SUBMITTED',
          submitted_by = $1,
          submitted_at = NOW(),
          updated_at = NOW()
      WHERE id = $2 AND branch_id = $3 AND deleted_at IS NULL
      RETURNING *
    `;
    const res = client
      ? await client.query<AccountingVoucherRow>(sql, [submittedBy, id, branchId])
      : await dbQuery<AccountingVoucherRow>(sql, [submittedBy, id, branchId]);

    if (!res.rows[0]) {
      throw new Error(`Failed to submit voucher '${id}': concurrent modification detected.`);
    }
    return res.rows[0];
  }

  /**
   * SUBMITTED -> APPROVED.
   * SoD enforced: approvedBy MUST differ from created_by.
   * SECURITY: branchId scope prevents cross-branch approval.
   */
  static async approve(
    id: string,
    approvedBy: string,
    branchId: string,
    client?: PoolClient
  ): Promise<AccountingVoucherRow> {
    const current = await AccountingVoucherRepository.findById(id, branchId, client);
    if (!current) {
      throw new Error(`Voucher '${id}' not found or not accessible in branch '${branchId}'.`);
    }
    assertValidVoucherTransition(current.status, "APPROVED");

    if (current.created_by === approvedBy) {
      throw new Error(
        `Segregation of Duties violation: Staff '${approvedBy}' cannot approve their own voucher '${id}'.`
      );
    }

    const sql = `
      UPDATE public.accounting_voucher
      SET status = 'APPROVED',
          approved_by = $1,
          approved_at = NOW(),
          updated_at = NOW()
      WHERE id = $2 AND branch_id = $3 AND deleted_at IS NULL
      RETURNING *
    `;
    const res = client
      ? await client.query<AccountingVoucherRow>(sql, [approvedBy, id, branchId])
      : await dbQuery<AccountingVoucherRow>(sql, [approvedBy, id, branchId]);

    if (!res.rows[0]) {
      throw new Error(`Failed to approve voucher '${id}': concurrent modification detected.`);
    }
    return res.rows[0];
  }

  /**
   * APPROVED -> POSTED.
   * REQUIRES a transaction client — must run inside the PostingService transaction:
   *   BEGIN -> write journal -> write lines -> markPosted -> COMMIT
   * total_amount is set to the verified journal total, not client-supplied.
   */
  static async markPosted(
    id: string,
    postedBy: string,
    totalAmount: number,
    client: PoolClient
  ): Promise<AccountingVoucherRow> {
    const current = await AccountingVoucherRepository.findById(id, undefined, client);
    if (!current) {
      throw new Error(`Voucher '${id}' not found.`);
    }
    assertValidVoucherTransition(current.status, "POSTED");

    const sql = `
      UPDATE public.accounting_voucher
      SET status = 'POSTED',
          total_amount = $1,
          posted_by = $2,
          posted_at = NOW(),
          updated_at = NOW()
      WHERE id = $3 AND deleted_at IS NULL
      RETURNING *
    `;
    const res = await client.query<AccountingVoucherRow>(sql, [totalAmount, postedBy, id]);
    if (!res.rows[0]) {
      throw new Error(`Failed to post voucher '${id}': constraint violation.`);
    }
    return res.rows[0];
  }

  /**
   * Cancel a DRAFT, SUBMITTED, or APPROVED voucher.
   * POSTED vouchers are immutable — use reversal instead.
   */
  static async cancel(
    id: string,
    cancelledBy: string,
    branchId: string,
    client?: PoolClient
  ): Promise<AccountingVoucherRow> {
    const current = await AccountingVoucherRepository.findById(id, branchId, client);
    if (!current) {
      throw new Error(`Voucher '${id}' not found or not accessible in branch '${branchId}'.`);
    }
    assertValidVoucherTransition(current.status, "CANCELLED");

    const sql = `
      UPDATE public.accounting_voucher
      SET status = 'CANCELLED',
          cancelled_by = $1,
          cancelled_at = NOW(),
          updated_at = NOW()
      WHERE id = $2 AND branch_id = $3 AND deleted_at IS NULL
      RETURNING *
    `;
    const res = client
      ? await client.query<AccountingVoucherRow>(sql, [cancelledBy, id, branchId])
      : await dbQuery<AccountingVoucherRow>(sql, [cancelledBy, id, branchId]);

    if (!res.rows[0]) throw new Error(`Failed to cancel voucher '${id}'.`);
    return res.rows[0];
  }

  /**
   * Phase 4A Reversal Linkage:
   * Records reversed_by_voucher_id on the original POSTED voucher.
   *
   * ARCHITECTURAL INVARIANT:
   * The voucher's status remains 'POSTED' (in accordance with chk_voucher_status
   * and the Phase 4A accounting design). Reversal is audited via reversed_by_voucher_id
   * on the original voucher, reversal_of_voucher_id on the compensating voucher, and
   * is_reversed = true on the journal entry.
   *
   * Invariants enforced:
   * - Requires an explicit transaction client (PoolClient).
   * - Verifies original voucher exists and deleted_at IS NULL.
   * - Verifies original voucher status is 'POSTED' (cannot reverse non-posted vouchers).
   * - Verifies original voucher is not already reversed (reversed_by_voucher_id must be null).
   * - Verifies original voucher is not itself a reversal voucher (chk_voucher_reversal_limit).
   * - Scopes update with branchId if provided (BOLA defense).
   * - Uses parameterized SQL.
   *
   * @param originalId         ID of the original posted voucher being reversed.
   * @param reversalVoucherId  ID of the compensating reversal voucher.
   * @param client             REQUIRED transaction client from caller.
   * @param branchId           Optional server-derived branch scope.
   */
  static async recordReversalLinkage(
    originalId: string,
    reversalVoucherId: string,
    client: PoolClient,
    branchId?: string
  ): Promise<AccountingVoucherRow> {
    const current = await AccountingVoucherRepository.findById(originalId, branchId, client);
    if (!current) {
      throw new Error(`Voucher '${originalId}' not found${branchId ? ` in branch '${branchId}'` : ""}.`);
    }

    if (current.status !== "POSTED") {
      throw new Error(
        `Voucher reversal violation: voucher '${originalId}' has status '${current.status}'. Only POSTED vouchers can be reversed.`
      );
    }

    if (current.reversed_by_voucher_id) {
      throw new Error(
        `Voucher reversal violation: voucher '${originalId}' has already been reversed by voucher '${current.reversed_by_voucher_id}'.`
      );
    }

    if (current.reversal_of_voucher_id) {
      throw new Error(
        `Voucher reversal violation: voucher '${originalId}' is itself a reversal voucher (reversal_of: '${current.reversal_of_voucher_id}') and cannot be reversed (chk_voucher_reversal_limit).`
      );
    }

    const conditions = [
      "id = $2",
      "status = 'POSTED'",
      "reversed_by_voucher_id IS NULL",
      "deleted_at IS NULL",
    ];
    const params: unknown[] = [reversalVoucherId, originalId];
    if (branchId) {
      conditions.push("branch_id = $3");
      params.push(branchId);
    }

    const sql = `
      UPDATE public.accounting_voucher
      SET reversed_by_voucher_id = $1,
          updated_at = NOW()
      WHERE ${conditions.join(" AND ")}
      RETURNING *
    `;
    const res = await client.query<AccountingVoucherRow>(sql, params);
    if (!res.rows[0]) {
      throw new Error(
        `Failed to record reversal linkage on voucher '${originalId}': concurrent modification or constraint violation.`
      );
    }
    return res.rows[0];
  }

  /**
   * Compatibility alias for recordReversalLinkage.
   * Retained for callers expecting markReversed().
   */
  static async markReversed(
    originalId: string,
    reversalVoucherId: string,
    client: PoolClient,
    branchId?: string
  ): Promise<AccountingVoucherRow> {
    return AccountingVoucherRepository.recordReversalLinkage(
      originalId,
      reversalVoucherId,
      client,
      branchId
    );
  }

  // ── FULL DETAIL ────────────────────────────────────────────────────────────────

  /**
   * Fetch a voucher with its linked journal entry and journal lines.
   * Journal lines are enriched with account code/name/type via JOIN.
   */
  static async findDetail(
    id: string,
    branchId?: string,
    client?: PoolClient
  ): Promise<VoucherDetailResult | null> {
    const voucher = await AccountingVoucherRepository.findById(id, branchId, client);
    if (!voucher) return null;

    const jeRes = client
      ? await client.query(
          "SELECT * FROM public.accounting_journal_entry WHERE voucher_id = $1 LIMIT 1",
          [id]
        )
      : await dbQuery("SELECT * FROM public.accounting_journal_entry WHERE voucher_id = $1 LIMIT 1", [id]);

    const journalEntry = jeRes.rows[0] ?? null;
    let lines: unknown[] = [];

    if (journalEntry) {
      const linesSql = `
        SELECT jl.*,
               a.code AS account_code,
               a.name AS account_name,
               a.type AS account_type
        FROM public.accounting_journal_line jl
        JOIN public.accounting_account a ON a.id = jl.account_id
        WHERE jl.journal_entry_id = $1
        ORDER BY jl.line_no ASC
      `;
      const linesRes = client
        ? await client.query(linesSql, [journalEntry.id])
        : await dbQuery(linesSql, [journalEntry.id]);
      lines = linesRes.rows;
    }

    return { voucher, journal_entry: journalEntry, lines: lines as any };
  }
}
