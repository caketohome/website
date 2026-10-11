/**
 * CakeToHome ERP — Bank Reconciliation Repository
 * Phase 4F Step 4.10 Substep 4.10.5-C: Automated Bank Reconciliation Matching Engine & Clearance
 *
 * ARCHITECTURAL DESIGN & INVARIANTS:
 * 1. DB IS THE ONLY SOURCE OF TRUTH:
 *    - All operations execute direct parameterized SQL against public.bank_reconciliation_session
 *      and public.bank_reconciliation_match.
 * 2. SEGREGATION OF DUTIES (SoD):
 *    - Enforces DB-level check constraints:
 *      * Session: prepared_by <> reviewed_by, prepared_by <> approved_by, reviewed_by <> approved_by
 *      * Match: matched_by <> confirmed_by (chk_brm_sod_matcher_confirmer)
 * 3. PESSIMISTIC LOCKING:
 *    - Supports SELECT ... FOR UPDATE to prevent race conditions during match confirmation or clearance.
 * 4. INTEGER PAISE COMPARISONS:
 *    - Monetary comparisons convert to exact rounded paise in SQL and code to prevent floating-point discrepancies.
 * 5. IMMUTABILITY & AUDITABILITY:
 *    - Every match preserves session_id, statement_line_id, source polymorphic discriminator,
 *      matched_by, and confirmed_by audit timestamps.
 */

import { dbQuery } from "../db";
import type { PoolClient } from "pg";
import type {
  BankReconciliationSessionRow,
  BankReconciliationMatchRow,
  BankReconciliationSessionStatus,
  ReconciliationMatchSourceType,
  ReconciliationMatchType,
  ReconciliationMatchStatus,
  CreateReconciliationSessionParams,
  CreateReconciliationMatchParams,
  ListBankReconciliationSessionsFilter,
  ListBankReconciliationMatchesFilter,
  BankDepositSlipRow,
  BankStatementLineRow,
} from "../types/accounting.types";

export class BankReconciliationRepositoryError extends Error {
  readonly code: string;

  constructor(code: string, message: string) {
    super(message);
    this.name = "BankReconciliationRepositoryError";
    this.code = code;
  }
}

export class BankReconciliationRepository {
  // ─── SESSION OPERATIONS ───────────────────────────────────────────────────

  /**
   * Creates a new bank reconciliation session.
   */
  static async createSession(
    params: CreateReconciliationSessionParams,
    client?: PoolClient
  ): Promise<BankReconciliationSessionRow> {
    const id = params.id || `brs_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    const companyId = params.companyId;
    if (!companyId) {
      throw new Error("companyId is required for bank reconciliation session. Configure Company Master in Admin → Company Settings.");
    }
    const status = params.status || "DRAFT";
    const metadata = params.metadata || {};

    const sql = `
      INSERT INTO public.bank_reconciliation_session (
        id, bank_account_id, company_id, period_start, period_end,
        opening_balance_per_bank, closing_balance_per_bank, status,
        prepared_by, metadata, created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW(), NOW())
      RETURNING *;
    `;
    const values = [
      id,
      params.bankAccountId,
      companyId,
      params.periodStart,
      params.periodEnd,
      params.openingBalancePerBank ?? null,
      params.closingBalancePerBank ?? null,
      status,
      params.preparedBy,
      JSON.stringify(metadata),
    ];

    const res = client ? await client.query(sql, values) : await dbQuery(sql, values);
    return res.rows[0];
  }

  /**
   * Finds a reconciliation session by ID with optional row-level lock.
   */
  static async findSessionById(
    id: string,
    client?: PoolClient,
    forUpdate: boolean = false
  ): Promise<BankReconciliationSessionRow | null> {
    const sql = `
      SELECT * FROM public.bank_reconciliation_session
      WHERE id = $1
      ${forUpdate ? "FOR UPDATE" : ""};
    `;
    const res = client ? await client.query(sql, [id]) : await dbQuery(sql, [id]);
    return res.rows[0] || null;
  }

  /**
   * Finds the latest active/in-progress session for a bank account.
   */
  static async findActiveSession(
    bankAccountId: string,
    client?: PoolClient
  ): Promise<BankReconciliationSessionRow | null> {
    const sql = `
      SELECT * FROM public.bank_reconciliation_session
      WHERE bank_account_id = $1 AND status IN ('DRAFT', 'IN_PROGRESS')
      ORDER BY period_end DESC, created_at DESC
      LIMIT 1;
    `;
    const res = client ? await client.query(sql, [bankAccountId]) : await dbQuery(sql, [bankAccountId]);
    return res.rows[0] || null;
  }

  /**
   * Updates session status and transitions audit trail.
   */
  static async updateSessionStatus(
    id: string,
    status: BankReconciliationSessionStatus,
    actorId?: string,
    client?: PoolClient
  ): Promise<BankReconciliationSessionRow> {
    let extraSet = "";
    const values: unknown[] = [id, status];

    if (status === "REVIEWED" && actorId) {
      values.push(actorId);
      extraSet = `, reviewed_by = $${values.length}, reviewed_at = NOW()`;
    } else if (status === "APPROVED" && actorId) {
      values.push(actorId);
      extraSet = `, approved_by = $${values.length}, approved_at = NOW()`;
    }

    const sql = `
      UPDATE public.bank_reconciliation_session
      SET status = $2, updated_at = NOW() ${extraSet}
      WHERE id = $1
      RETURNING *;
    `;

    try {
      const res = client ? await client.query(sql, values) : await dbQuery(sql, values);
      if (!res.rows[0]) {
        throw new BankReconciliationRepositoryError("SESSION_NOT_FOUND", `Reconciliation session '${id}' not found.`);
      }
      return res.rows[0];
    } catch (err: any) {
      if (err.message && err.message.includes("chk_brs_sod")) {
        throw new BankReconciliationRepositoryError(
          "SEGREGATION_OF_DUTIES_VIOLATION",
          "Session reviewer/approver must be distinct from preparer."
        );
      }
      throw err;
    }
  }

  /**
   * Lists reconciliation sessions with filters.
   */
  static async listSessions(
    filter: ListBankReconciliationSessionsFilter = {},
    client?: PoolClient
  ): Promise<BankReconciliationSessionRow[]> {
    const conditions: string[] = [];
    const values: unknown[] = [];
    let idx = 1;

    if (filter.companyId) {
      conditions.push(`company_id = $${idx++}`);
      values.push(filter.companyId);
    }
    if (filter.bankAccountId) {
      conditions.push(`bank_account_id = $${idx++}`);
      values.push(filter.bankAccountId);
    }
    if (filter.status) {
      conditions.push(`status = $${idx++}`);
      values.push(filter.status);
    }
    if (filter.startDate) {
      conditions.push(`period_start >= $${idx++}`);
      values.push(filter.startDate);
    }
    if (filter.endDate) {
      conditions.push(`period_end <= $${idx++}`);
      values.push(filter.endDate);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";
    const limit = filter.limit ? `LIMIT ${Number(filter.limit)}` : "";
    const offset = filter.offset ? `OFFSET ${Number(filter.offset)}` : "";

    const sql = `
      SELECT * FROM public.bank_reconciliation_session
      ${whereClause}
      ORDER BY period_end DESC, created_at DESC
      ${limit} ${offset};
    `;

    const res = client ? await client.query(sql, values) : await dbQuery(sql, values);
    return res.rows;
  }

  // ─── MATCH OPERATIONS ─────────────────────────────────────────────────────

  /**
   * Creates an explicit match between a statement line and an internal document.
   */
  static async createMatch(
    params: CreateReconciliationMatchParams,
    client?: PoolClient
  ): Promise<BankReconciliationMatchRow> {
    const id = params.id || `brm_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    const matchType = params.matchType || "EXACT";
    const matchStatus = params.matchStatus || "PROPOSED";
    const varianceAmount = params.varianceAmount || 0;
    const metadata = params.metadata || {};

    const sql = `
      INSERT INTO public.bank_reconciliation_match (
        id, session_id, statement_line_id, match_source_type, match_source_id,
        match_type, matched_amount, match_status, variance_amount,
        matched_by, matched_at, confirmed_by, confirmed_at, metadata,
        created_at, updated_at
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW(), $11, $12, $13, NOW(), NOW()
      )
      RETURNING *;
    `;
    const values = [
      id,
      params.sessionId,
      params.statementLineId,
      params.matchSourceType,
      params.matchSourceId,
      matchType,
      params.matchedAmount,
      matchStatus,
      varianceAmount,
      params.matchedBy,
      params.confirmedBy || null,
      params.confirmedAt || (params.confirmedBy ? new Date().toISOString() : null),
      JSON.stringify(metadata),
    ];

    try {
      const res = client ? await client.query(sql, values) : await dbQuery(sql, values);
      return res.rows[0];
    } catch (err: any) {
      if (err.message && err.message.includes("chk_brm_sod_matcher_confirmer")) {
        throw new BankReconciliationRepositoryError(
          "SEGREGATION_OF_DUTIES_VIOLATION",
          "Segregation of Duties: Confirmer cannot be the same person who matched the record."
        );
      }
      if (err.message && err.message.includes("uq_brm_session_line_source")) {
        throw new BankReconciliationRepositoryError(
          "DUPLICATE_MATCH",
          "This statement line is already matched with this source document in this session."
        );
      }
      throw err;
    }
  }

  /**
   * Finds a match by ID with optional row-level lock.
   */
  static async findMatchById(
    id: string,
    client?: PoolClient,
    forUpdate: boolean = false
  ): Promise<BankReconciliationMatchRow | null> {
    const sql = `
      SELECT * FROM public.bank_reconciliation_match
      WHERE id = $1
      ${forUpdate ? "FOR UPDATE" : ""};
    `;
    const res = client ? await client.query(sql, [id]) : await dbQuery(sql, [id]);
    return res.rows[0] || null;
  }

  /**
   * Finds all matches for a given session.
   */
  static async findMatchesBySessionId(
    sessionId: string,
    client?: PoolClient
  ): Promise<BankReconciliationMatchRow[]> {
    const sql = `
      SELECT * FROM public.bank_reconciliation_match
      WHERE session_id = $1
      ORDER BY created_at ASC;
    `;
    const res = client ? await client.query(sql, [sessionId]) : await dbQuery(sql, [sessionId]);
    return res.rows;
  }

  /**
   * Finds all matches for a statement line.
   */
  static async findMatchesByStatementLineId(
    statementLineId: string,
    client?: PoolClient
  ): Promise<BankReconciliationMatchRow[]> {
    const sql = `
      SELECT * FROM public.bank_reconciliation_match
      WHERE statement_line_id = $1
      ORDER BY created_at ASC;
    `;
    const res = client ? await client.query(sql, [statementLineId]) : await dbQuery(sql, [statementLineId]);
    return res.rows;
  }

  /**
   * Finds an existing active match for an internal source document.
   */
  static async findMatchBySource(
    sourceType: ReconciliationMatchSourceType,
    sourceId: string,
    client?: PoolClient
  ): Promise<BankReconciliationMatchRow | null> {
    const sql = `
      SELECT * FROM public.bank_reconciliation_match
      WHERE match_source_type = $1 AND match_source_id = $2
        AND match_status IN ('PROPOSED', 'CONFIRMED')
      LIMIT 1;
    `;
    const res = client ? await client.query(sql, [sourceType, sourceId]) : await dbQuery(sql, [sourceType, sourceId]);
    return res.rows[0] || null;
  }

  /**
   * Updates match status (e.g. PROPOSED -> CONFIRMED, or PROPOSED -> REJECTED).
   * Enforces DB-level SoD constraint (matched_by <> confirmed_by).
   */
  static async updateMatchStatus(
    id: string,
    status: ReconciliationMatchStatus,
    confirmedBy?: string,
    client?: PoolClient
  ): Promise<BankReconciliationMatchRow> {
    const values: unknown[] = [id, status];
    let confirmClause = "";

    if (confirmedBy) {
      values.push(confirmedBy);
      confirmClause = `, confirmed_by = $${values.length}, confirmed_at = NOW()`;
    }

    const sql = `
      UPDATE public.bank_reconciliation_match
      SET match_status = $2, updated_at = NOW() ${confirmClause}
      WHERE id = $1
      RETURNING *;
    `;

    try {
      const res = client ? await client.query(sql, values) : await dbQuery(sql, values);
      if (!res.rows[0]) {
        throw new BankReconciliationRepositoryError("MATCH_NOT_FOUND", `Reconciliation match '${id}' not found.`);
      }
      return res.rows[0];
    } catch (err: any) {
      if (err.message && err.message.includes("chk_brm_sod_matcher_confirmer")) {
        throw new BankReconciliationRepositoryError(
          "SEGREGATION_OF_DUTIES_VIOLATION",
          "Segregation of Duties: Confirmer cannot be the same person who matched the record."
        );
      }
      throw err;
    }
  }

  /**
   * Lists matches with filters.
   */
  static async listMatches(
    filter: ListBankReconciliationMatchesFilter = {},
    client?: PoolClient
  ): Promise<BankReconciliationMatchRow[]> {
    const conditions: string[] = [];
    const values: unknown[] = [];
    let idx = 1;

    if (filter.sessionId) {
      conditions.push(`session_id = $${idx++}`);
      values.push(filter.sessionId);
    }
    if (filter.statementLineId) {
      conditions.push(`statement_line_id = $${idx++}`);
      values.push(filter.statementLineId);
    }
    if (filter.matchSourceType) {
      conditions.push(`match_source_type = $${idx++}`);
      values.push(filter.matchSourceType);
    }
    if (filter.matchStatus) {
      conditions.push(`match_status = $${idx++}`);
      values.push(filter.matchStatus);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";
    const limit = filter.limit ? `LIMIT ${Number(filter.limit)}` : "";
    const offset = filter.offset ? `OFFSET ${Number(filter.offset)}` : "";

    const sql = `
      SELECT * FROM public.bank_reconciliation_match
      ${whereClause}
      ORDER BY created_at DESC
      ${limit} ${offset};
    `;

    const res = client ? await client.query(sql, values) : await dbQuery(sql, values);
    return res.rows;
  }

  // ─── CANDIDATE QUERY OPERATIONS ───────────────────────────────────────────

  /**
   * Vector A: Searches for candidate bank deposit slips for a statement credit line.
   * Matching criteria:
   * 1. bank_account_id matches exactly.
   * 2. exact amount in integer paise.
   * 3. status IN ('CONFIRMED', 'DISPATCHED') and transit_voucher_id IS NOT NULL.
   * 4. credit_voucher_id IS NULL (not yet cleared).
   * 5. deposit_date <= statement_date <= deposit_date + 3 days (strictly enforced +3 day window).
   * 6. not already matched with PROPOSED or CONFIRMED match status.
   */
  static async findVectorACandidates(
    bankAccountId: string,
    amount: number,
    statementDate: string,
    client?: PoolClient
  ): Promise<BankDepositSlipRow[]> {
    const paise = Math.round(Number(amount) * 100);
    const sql = `
      SELECT bds.*
      FROM public.bank_deposit_slip bds
      WHERE bds.bank_account_id = $1
        AND ROUND(bds.amount * 100)::bigint = $2::bigint
        AND bds.status IN ('CONFIRMED', 'DISPATCHED')
        AND bds.transit_voucher_id IS NOT NULL
        AND bds.credit_voucher_id IS NULL
        AND bds.deposit_date <= $3::date
        AND $3::date <= (bds.deposit_date + 3)
        AND NOT EXISTS (
          SELECT 1 FROM public.bank_reconciliation_match brm
          WHERE brm.match_source_type = 'BANK_DEPOSIT_SLIP'
            AND brm.match_source_id = bds.id
            AND brm.match_status IN ('PROPOSED', 'CONFIRMED')
        )
      ORDER BY bds.deposit_date ASC, bds.id ASC;
    `;
    const res = client
      ? await client.query(sql, [bankAccountId, paise, statementDate])
      : await dbQuery(sql, [bankAccountId, paise, statementDate]);
    return res.rows;
  }

  /**
   * Vector B: Searches for candidate gateway payout batches for a statement credit line.
   * Matching criteria:
   * 1. bank_account_id matches exactly.
   * 2. exact net_amount in integer paise.
   * 3. status IN ('POSTED', 'APPROVED', 'PARTITIONED') (GL already posted in 4.10.3).
   * 4. settlement_date <= statement_date <= settlement_date + 7 days (standard bank settlement cycle).
   * 5. not already matched with PROPOSED or CONFIRMED match status.
   */
  static async findVectorBCandidates(
    bankAccountId: string,
    netAmount: number,
    statementDate: string,
    referenceText?: string | null,
    client?: PoolClient
  ): Promise<any[]> {
    const paise = Math.round(Number(netAmount) * 100);
    const values: unknown[] = [bankAccountId, paise, statementDate];
    let refCondition = "";

    if (referenceText && referenceText.trim().length > 3) {
      values.push(`%${referenceText.trim()}%`);
      refCondition = `AND (gpb.payout_reference ILIKE $${values.length} OR gpb.settlement_reference ILIKE $${values.length})`;
    }

    const sql = `
      SELECT gpb.*
      FROM public.gateway_payout_batch gpb
      WHERE gpb.bank_account_id = $1
        AND ROUND(gpb.net_amount * 100)::bigint = $2::bigint
        AND gpb.status IN ('POSTED', 'APPROVED', 'PARTITIONED')
        AND gpb.settlement_date <= $3::date
        AND $3::date <= (gpb.settlement_date + 7)
        ${refCondition}
        AND NOT EXISTS (
          SELECT 1 FROM public.bank_reconciliation_match brm
          WHERE brm.match_source_type = 'GATEWAY_PAYOUT_BATCH'
            AND brm.match_source_id = gpb.id
            AND brm.match_status IN ('PROPOSED', 'CONFIRMED')
        )
      ORDER BY gpb.settlement_date ASC, gpb.id ASC;
    `;
    const res = client ? await client.query(sql, values) : await dbQuery(sql, values);
    return res.rows;
  }

  /**
   * Vector C: Searches for candidate supplier payments for a statement debit line.
   * Matching criteria:
   * 1. exact amount in integer paise.
   * 2. deleted_at IS NULL.
   * 3. payment_date <= statement_date <= payment_date + 5 days.
   * 4. not already matched with PROPOSED or CONFIRMED match status.
   */
  static async findVectorCCandidates(
    amount: number,
    statementDate: string,
    referenceText?: string | null,
    client?: PoolClient
  ): Promise<any[]> {
    const paise = Math.round(Number(amount) * 100);
    const values: unknown[] = [paise, statementDate];
    let refCondition = "";

    if (referenceText && referenceText.trim().length > 3) {
      values.push(`%${referenceText.trim()}%`);
      refCondition = `AND (pp.reference ILIKE $${values.length} OR pp.id ILIKE $${values.length})`;
    }

    const sql = `
      SELECT pp.*
      FROM public.purchase_payment pp
      WHERE ROUND(pp.amount * 100)::bigint = $1::bigint
        AND pp.deleted_at IS NULL
        AND pp.payment_date <= $2::date
        AND $2::date <= (pp.payment_date + 5)
        ${refCondition}
        AND NOT EXISTS (
          SELECT 1 FROM public.bank_reconciliation_match brm
          WHERE brm.match_source_type = 'PURCHASE_PAYMENT'
            AND brm.match_source_id = pp.id
            AND brm.match_status IN ('PROPOSED', 'CONFIRMED')
        )
      ORDER BY pp.payment_date ASC, pp.id ASC;
    `;
    const res = client ? await client.query(sql, values) : await dbQuery(sql, values);
    return res.rows;
  }

  // ─── SUBSTEP 4.10.5-D-A: BRS READ-ONLY QUERIES ────────────────────────────

  /**
   * Substep 4.10.5-D-A: Computes posted GL balance for an account code as of a cutoff date.
   * Method BRS calculation:
   * SUM(posted debits) - SUM(posted credits) in integer paise
   * with voucher_date <= as_of_date AND voucher.status = 'POSTED'.
   * Never mutates any database records.
   */
  static async getGlAccountBalance(
    accountCode: string,
    asOfDate: string,
    branchId?: string | null,
    client?: PoolClient
  ): Promise<{
    totalDebitPaise: number;
    totalCreditPaise: number;
    netDebitPaise: number;
    count: number;
  }> {
    const values: unknown[] = [accountCode, asOfDate];
    let branchFilter = "";
    if (branchId) {
      values.push(branchId);
      branchFilter = `AND v.branch_id = $${values.length}`;
    }

    const sql = `
      SELECT
        COALESCE(ROUND(SUM(jl.debit_amount) * 100)::bigint, 0) AS total_debit_paise,
        COALESCE(ROUND(SUM(jl.credit_amount) * 100)::bigint, 0) AS total_credit_paise,
        COUNT(jl.id)::int AS count
      FROM public.accounting_journal_line jl
      JOIN public.accounting_journal_entry je ON je.id = jl.journal_entry_id
      JOIN public.accounting_voucher v ON v.id = je.voucher_id
      JOIN public.accounting_account a ON a.id = jl.account_id
      WHERE a.code = $1
        AND v.status = 'POSTED'
        AND v.voucher_date <= $2::date
        ${branchFilter};
    `;

    const res = client ? await client.query(sql, values) : await dbQuery(sql, values);
    const row = res.rows[0] || { total_debit_paise: "0", total_credit_paise: "0", count: 0 };
    const totalDebitPaise = Number(row.total_debit_paise);
    const totalCreditPaise = Number(row.total_credit_paise);
    const netDebitPaise = totalDebitPaise - totalCreditPaise;
    return {
      totalDebitPaise,
      totalCreditPaise,
      netDebitPaise,
      count: Number(row.count),
    };
  }

  /**
   * Substep 4.10.5-D-A: Queries authoritative deposits in transit (Account 1118 items).
   * Include deposit slips where:
   * - bank_account_id matches
   * - deposit_date <= as_of_date
   * - status != 'REJECTED'
   * - Stage 1 transit_voucher_id is POSTED on or before as_of_date
   * - Stage 2 credit_voucher_id is NULL OR credit voucher date > as_of_date OR credit voucher status != 'POSTED'
   * - No confirmed reconciliation match effective on/before as_of_date
   */
  static async getUnclearedDepositSlips(
    bankAccountId: string,
    asOfDate: string,
    options?: { limit?: number; offset?: number; branchId?: string | null },
    client?: PoolClient
  ): Promise<{
    items: BankDepositSlipRow[];
    totalCount: number;
    totalPaise: number;
  }> {
    const limit = Math.min(Math.max(options?.limit ?? 50, 1), 200);
    const offset = Math.max(options?.offset ?? 0, 0);
    const values: unknown[] = [bankAccountId, asOfDate];

    let branchCondition = "";
    if (options?.branchId) {
      values.push(options.branchId);
      branchCondition = `AND bds.branch_id = $${values.length}`;
    }

    const baseWhere = `
      FROM public.bank_deposit_slip bds
      JOIN public.accounting_voucher tv ON tv.id = bds.transit_voucher_id
      LEFT JOIN public.accounting_voucher cv ON cv.id = bds.credit_voucher_id
      WHERE bds.bank_account_id = $1
        AND bds.deposit_date <= $2::date
        AND bds.status != 'REJECTED'
        AND tv.status = 'POSTED'
        AND tv.voucher_date <= $2::date
        AND (
          bds.credit_voucher_id IS NULL
          OR cv.status IS NULL
          OR cv.status != 'POSTED'
          OR cv.voucher_date > $2::date
        )
        AND NOT EXISTS (
          SELECT 1 FROM public.bank_reconciliation_match brm
          JOIN public.bank_statement_line bsl ON bsl.id = brm.statement_line_id
          WHERE brm.match_source_type = 'BANK_DEPOSIT_SLIP'
            AND brm.match_source_id = bds.id
            AND brm.match_status = 'CONFIRMED'
            AND COALESCE(bsl.value_date, bsl.transaction_date) <= $2::date
        )
        ${branchCondition}
    `;

    const aggSql = `
      SELECT
        COUNT(bds.id)::int AS total_count,
        COALESCE(ROUND(SUM(bds.amount) * 100)::bigint, 0) AS total_paise
      ${baseWhere};
    `;

    const aggRes = client ? await client.query(aggSql, values) : await dbQuery(aggSql, values);
    const aggRow = aggRes.rows[0] || { total_count: 0, total_paise: "0" };

    const itemsValues = [...values, limit, offset];
    const itemsSql = `
      SELECT bds.*
      ${baseWhere}
      ORDER BY bds.deposit_date ASC, bds.id ASC
      LIMIT $${itemsValues.length - 1} OFFSET $${itemsValues.length};
    `;

    const itemsRes = client ? await client.query(itemsSql, itemsValues) : await dbQuery(itemsSql, itemsValues);
    return {
      items: itemsRes.rows,
      totalCount: Number(aggRow.total_count),
      totalPaise: Number(aggRow.total_paise),
    };
  }

  /**
   * Substep 4.10.5-D-A: Queries authoritative outstanding book disbursements affecting GL 1112.
   * Supported sources:
   * - PURCHASE_PAYMENT
   * - CUSTOMER_REFUND
   * EXPENSE_PAYMENT is explicitly verified unsupported (Phase 2 expenses have no double-entry GL posting).
   * Criteria:
   * - Posted voucher with voucher_date <= as_of_date
   * - Credit line on Account 1112 (credit_amount > 0)
   * - No confirmed reconciliation match effective on/before as_of_date
   */
  static async getOutstandingDisbursements(
    bankAccountId: string,
    asOfDate: string,
    options?: { limit?: number; offset?: number; branchId?: string | null },
    client?: PoolClient
  ): Promise<{
    items: Array<{
      voucherId: string;
      voucherNo: string;
      voucherDate: string;
      voucherType: string;
      referenceType: string;
      referenceId: string;
      branchId: string;
      amount: number;
      narration?: string;
    }>;
    totalCount: number;
    totalPaise: number;
  }> {
    const limit = Math.min(Math.max(options?.limit ?? 50, 1), 200);
    const offset = Math.max(options?.offset ?? 0, 0);
    const values: unknown[] = [asOfDate];

    let branchCondition = "";
    if (options?.branchId) {
      values.push(options.branchId);
      branchCondition = `AND v.branch_id = $${values.length}`;
    }

    const baseWhere = `
      FROM public.accounting_journal_line jl
      JOIN public.accounting_journal_entry je ON je.id = jl.journal_entry_id
      JOIN public.accounting_voucher v ON v.id = je.voucher_id
      JOIN public.accounting_account a ON a.id = jl.account_id
      WHERE a.code = '1112'
        AND jl.credit_amount > 0
        AND v.status = 'POSTED'
        AND v.voucher_date <= $1::date
        AND v.reference_type IN ('PURCHASE_PAYMENT', 'CUSTOMER_REFUND')
        AND NOT EXISTS (
          SELECT 1 FROM public.bank_reconciliation_match brm
          JOIN public.bank_statement_line bsl ON bsl.id = brm.statement_line_id
          WHERE (
            (brm.match_source_type = v.reference_type AND brm.match_source_id = v.reference_id)
            OR
            (brm.match_source_type = 'DIRECT_BANK_ENTRY' AND brm.match_source_id = v.id)
            OR
            (brm.match_source_id = v.id)
          )
          AND brm.match_status = 'CONFIRMED'
          AND COALESCE(bsl.value_date, bsl.transaction_date) <= $1::date
        )
        ${branchCondition}
    `;

    const aggSql = `
      SELECT
        COUNT(jl.id)::int AS total_count,
        COALESCE(ROUND(SUM(jl.credit_amount) * 100)::bigint, 0) AS total_paise
      ${baseWhere};
    `;

    const aggRes = client ? await client.query(aggSql, values) : await dbQuery(aggSql, values);
    const aggRow = aggRes.rows[0] || { total_count: 0, total_paise: "0" };

    const itemsValues = [...values, limit, offset];
    const itemsSql = `
      SELECT
        v.id AS "voucherId",
        v.voucher_no AS "voucherNo",
        v.voucher_date AS "voucherDate",
        v.voucher_type AS "voucherType",
        v.reference_type AS "referenceType",
        COALESCE(v.reference_id, '') AS "referenceId",
        v.branch_id AS "branchId",
        jl.credit_amount AS "amount",
        jl.narration AS "narration"
      ${baseWhere}
      ORDER BY v.voucher_date ASC, v.id ASC, jl.line_no ASC
      LIMIT $${itemsValues.length - 1} OFFSET $${itemsValues.length};
    `;

    const itemsRes = client ? await client.query(itemsSql, itemsValues) : await dbQuery(itemsSql, itemsValues);
    return {
      items: itemsRes.rows,
      totalCount: Number(aggRow.total_count),
      totalPaise: Number(aggRow.total_paise),
    };
  }

  /**
   * Substep 4.10.5-D-A: Queries unmatched / exception statement lines as of cutoff date.
   * Date semantics: effective bank date = COALESCE(value_date, transaction_date) <= as_of_date.
   * Reconciliation status in ('UNMATCHED', 'EXCEPTION').
   * Never posts to Account 1119.
   */
  static async getUnmatchedStatementLines(
    bankAccountId: string,
    asOfDate: string,
    options?: {
      type?: "DEBIT" | "CREDIT" | "ALL";
      limit?: number;
      offset?: number;
    },
    client?: PoolClient
  ): Promise<{
    items: BankStatementLineRow[];
    totalCount: number;
    totalDebitPaise: number;
    totalCreditPaise: number;
    debitCount: number;
    creditCount: number;
  }> {
    const limit = Math.min(Math.max(options?.limit ?? 50, 1), 200);
    const offset = Math.max(options?.offset ?? 0, 0);
    const values: unknown[] = [bankAccountId, asOfDate];

    let typeFilter = "";
    if (options?.type === "DEBIT") {
      typeFilter = "AND bsl.debit_amount > 0";
    } else if (options?.type === "CREDIT") {
      typeFilter = "AND bsl.credit_amount > 0";
    }

    const baseWhere = `
      FROM public.bank_statement_line bsl
      WHERE bsl.bank_account_id = $1
        AND COALESCE(bsl.value_date, bsl.transaction_date) <= $2::date
        AND bsl.reconciliation_status IN ('UNMATCHED', 'EXCEPTION')
        ${typeFilter}
    `;

    const aggSql = `
      SELECT
        COUNT(bsl.id)::int AS total_count,
        COALESCE(ROUND(SUM(bsl.debit_amount) * 100)::bigint, 0) AS total_debit_paise,
        COALESCE(ROUND(SUM(bsl.credit_amount) * 100)::bigint, 0) AS total_credit_paise,
        COUNT(CASE WHEN bsl.debit_amount > 0 THEN 1 END)::int AS debit_count,
        COUNT(CASE WHEN bsl.credit_amount > 0 THEN 1 END)::int AS credit_count
      ${baseWhere};
    `;

    const aggRes = client ? await client.query(aggSql, values) : await dbQuery(aggSql, values);
    const aggRow = aggRes.rows[0] || {
      total_count: 0,
      total_debit_paise: "0",
      total_credit_paise: "0",
      debit_count: 0,
      credit_count: 0,
    };

    const itemsValues = [...values, limit, offset];
    const itemsSql = `
      SELECT bsl.*
      ${baseWhere}
      ORDER BY COALESCE(bsl.value_date, bsl.transaction_date) ASC, bsl.line_number ASC
      LIMIT $${itemsValues.length - 1} OFFSET $${itemsValues.length};
    `;

    const itemsRes = client ? await client.query(itemsSql, itemsValues) : await dbQuery(itemsSql, itemsValues);
    return {
      items: itemsRes.rows,
      totalCount: Number(aggRow.total_count),
      totalDebitPaise: Number(aggRow.total_debit_paise),
      totalCreditPaise: Number(aggRow.total_credit_paise),
      debitCount: Number(aggRow.debit_count),
      creditCount: Number(aggRow.credit_count),
    };
  }

  /**
   * Substep 4.10.5-D-A: Queries the effective bank closing balance as of cutoff date.
   * Priority:
   * 1. Latest statement line on or before as_of_date with non-null running_balance.
   * 2. If running_balance is null, net sum of credits minus debits on or before as_of_date.
   * 3. 0 if no statement lines exist.
   */
  static async getBankStatementClosingBalance(
    bankAccountId: string,
    asOfDate: string,
    client?: PoolClient
  ): Promise<{
    closingBalancePaise: number;
    source: "RUNNING_BALANCE" | "NET_SUM" | "ZERO";
    lineCount: number;
  }> {
    const latestSql = `
      SELECT
        bsl.id,
        bsl.running_balance,
        COALESCE(bsl.value_date, bsl.transaction_date) AS effective_date
      FROM public.bank_statement_line bsl
      WHERE bsl.bank_account_id = $1
        AND COALESCE(bsl.value_date, bsl.transaction_date) <= $2::date
      ORDER BY COALESCE(bsl.value_date, bsl.transaction_date) DESC, bsl.line_number DESC, bsl.id DESC
      LIMIT 1;
    `;
    const latestRes = client
      ? await client.query(latestSql, [bankAccountId, asOfDate])
      : await dbQuery(latestSql, [bankAccountId, asOfDate]);

    if (latestRes.rows.length > 0 && latestRes.rows[0].running_balance !== null && latestRes.rows[0].running_balance !== undefined) {
      return {
        closingBalancePaise: Math.round(Number(latestRes.rows[0].running_balance) * 100),
        source: "RUNNING_BALANCE",
        lineCount: 1,
      };
    }

    const netSql = `
      SELECT
        COALESCE(ROUND(SUM(credit_amount - debit_amount) * 100)::bigint, 0) AS net_sum_paise,
        COUNT(id)::int AS count
      FROM public.bank_statement_line
      WHERE bank_account_id = $1
        AND COALESCE(value_date, transaction_date) <= $2::date;
    `;
    const netRes = client
      ? await client.query(netSql, [bankAccountId, asOfDate])
      : await dbQuery(netSql, [bankAccountId, asOfDate]);
    const row = netRes.rows[0] || { net_sum_paise: "0", count: 0 };
    const count = Number(row.count);

    return {
      closingBalancePaise: Number(row.net_sum_paise),
      source: count > 0 ? "NET_SUM" : "ZERO",
      lineCount: count,
    };
  }
}

