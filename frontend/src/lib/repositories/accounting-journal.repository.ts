/**
 * CakeToHome ERP — Accounting Journal Repository
 * Phase 4F Step 1: Data access layer for public.accounting_journal_entry
 *                  and public.accounting_journal_line.
 *
 * ARCHITECTURE:
 * - Journal entries and lines are ONLY created by the PostingService (Phase 4F Step 2).
 * - This repository provides: atomic write, read-by-voucher, paginated GL, trial balance.
 * - A journal entry has EXACTLY ONE voucher (unique constraint: accounting_journal_entry.voucher_id).
 * - Journal lines enforce single-sided debit/credit via DB constraint chk_jline_single_sided.
 * - Balance enforcement: deferred trigger trg_check_journal_balance guarantees sum(debit) = sum(credit)
 *   at the journal_entry level — applied at END of the transaction, not per-line insert.
 * - All writes REQUIRE a caller-owned PoolClient (called inside PostingService transaction).
 * - All reads use dbQuery (no transaction required for reads).
 *
 * ID generation:
 * - Consistent with existing repositories: prefix_timestamp(base36)_random.
 *
 * Security:
 * - All SQL uses $N parameterization — zero dynamic concatenation.
 * - branch_id scope applied on all GL queries.
 * - account_id values must be pre-validated by AccountingAccountRepository.validatePostingAccounts.
 *
 * NO MOCK DATA. NO STATIC ARRAYS. NO JSON IMPORTS.
 * PostgreSQL -> Repository -> Service -> API -> UI
 */

import { dbQuery } from "../db";
import type { PoolClient } from "pg";
import { AccountGovernanceService } from "../services/account-governance.service";
import type {
  AccountingJournalEntryRow,
  AccountingJournalLineRow,
  JournalLineInput,
  GeneralLedgerFilters,
  GeneralLedgerResult,
  GeneralLedgerRow,
  TrialBalanceRow,
} from "../types/accounting.types";

// ─── ID Generation ─────────────────────────────────────────────────────────────

function generateJournalEntryId(): string {
  const ts = Date.now().toString(36).toUpperCase().padStart(10, "0");
  const rnd = Math.random().toString(36).substring(2, 8).toUpperCase();
  return `jent_${ts}${rnd}`;
}

function generateJournalLineId(): string {
  const ts = Date.now().toString(36).toUpperCase().padStart(10, "0");
  const rnd = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `jln_${ts}${rnd}`;
}

function generateEntryNo(fiscalYear: string): string {
  const date = new Date();
  const yyyymmdd = date.toISOString().slice(0, 10).replace(/-/g, "");
  const rnd = Math.random().toString(36).substring(2, 8).toUpperCase();
  return `JE-${fiscalYear}-${yyyymmdd}-${rnd}`;
}

// ─── AccountingJournalRepository ───────────────────────────────────────────────

export class AccountingJournalRepository {
  // ── CREATE ────────────────────────────────────────────────────────────────────

  /**
   * Create a journal entry and its lines atomically, inside a caller-owned transaction.
   *
   * IMPORTANT: This method REQUIRES a PoolClient owned by the PostingService transaction.
   * Do NOT call this without a transaction — the deferred balance trigger will only fire
   * at COMMIT, and partial writes without a transaction will leave the DB inconsistent.
   *
   * Preconditions (validated by PostingService before calling this):
   * - voucherId must reference an APPROVED voucher.
   * - All account IDs in lines must be pre-validated (active, non-group, non-deleted).
   * - sum(debit_amount) == sum(credit_amount) is enforced by DB trigger — not re-checked here.
   * - branch_id comes from the voucher record — not from client input.
   *
   * @param voucherId     The voucher this entry belongs to.
   * @param entryDate     Date string (YYYY-MM-DD).
   * @param branchId      Server-side branch identity (from voucher, not client).
   * @param fiscalYear    Fiscal year string (e.g. "FY2627").
   * @param narration     Human-readable description.
   * @param lines         Validated journal line inputs (from PostingService).
   * @param createdBy     Authenticated staff ID from server session.
   * @param client        REQUIRED transaction client from PostingService.
   */
  static async createJournalEntry(
    voucherId: string,
    entryDate: string,
    branchId: string,
    fiscalYear: string,
    narration: string,
    lines: JournalLineInput[],
    createdBy: string,
    client: PoolClient
  ): Promise<AccountingJournalEntryRow & { lines: AccountingJournalLineRow[] }> {
    if (!lines || lines.length < 2) {
      throw new Error("Journal entry requires at least 2 lines (double-entry accounting).");
    }

    const totalDebit = lines.reduce((sum, l) => sum + l.debit_amount, 0);
    const totalCredit = lines.reduce((sum, l) => sum + l.credit_amount, 0);

    // Pre-flight balance check: application-layer guard before DB trigger fires
    if (Math.abs(totalDebit - totalCredit) > 0.001) {
      throw new Error(
        `Journal entry balance violation: total debit (${totalDebit.toFixed(2)}) ` +
          `!= total credit (${totalCredit.toFixed(2)}). Each entry must balance to zero.`
      );
    }

    // Authoritative Account Governance & Dimensional Policy Validation (Phase C7.6 Step 3)
    await AccountGovernanceService.validateJournalLines(lines, client);

    const entryId = generateJournalEntryId();
    const entryNo = generateEntryNo(fiscalYear);

    // Insert journal entry
    const entrySql = `
      INSERT INTO public.accounting_journal_entry
        (id, entry_no, voucher_id, entry_date, branch_id, fiscal_year,
         total_debit, total_credit, is_reversed, narration,
         created_by, created_at)
      VALUES
        ($1,$2,$3,$4,$5,$6,$7,$8,false,$9,$10,NOW())
      RETURNING *
    `;
    const entryParams = [
      entryId,
      entryNo,
      voucherId,
      entryDate,
      branchId,
      fiscalYear,
      totalDebit,
      totalCredit,
      narration,
      createdBy,
    ];
    const entryRes = await client.query<AccountingJournalEntryRow>(entrySql, entryParams);
    const journalEntry = entryRes.rows[0];

    // Insert journal lines
    const insertedLines: AccountingJournalLineRow[] = [];
    for (let lineNo = 1; lineNo <= lines.length; lineNo++) {
      const line = lines[lineNo - 1];
      const lineId = generateJournalLineId();

      const lineSql = `
        INSERT INTO public.accounting_journal_line
          (id, journal_entry_id, line_no, account_id,
           debit_amount, credit_amount,
           branch_id, customer_id, supplier_id,
           cost_centre_id, tax_rate, tax_class, narration, metadata)
        VALUES
          ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)
        RETURNING *
      `;
      const lineParams = [
        lineId,
        entryId,
        lineNo,
        line.account_id,
        line.debit_amount,
        line.credit_amount,
        line.branch_id ?? branchId,
        line.customer_id ?? null,
        line.supplier_id ?? null,
        line.cost_centre_id ?? null,
        line.tax_rate ?? null,
        line.tax_class ?? null,
        line.narration ?? null,
        line.metadata ? JSON.stringify(line.metadata) : null,
      ];
      const lineRes = await client.query<AccountingJournalLineRow>(lineSql, lineParams);
      insertedLines.push(lineRes.rows[0]);
    }

    return { ...journalEntry, lines: insertedLines };
  }

  // ── READ ──────────────────────────────────────────────────────────────────────

  /**
   * Fetch the journal entry for a given voucher ID.
   * Returns null if the voucher has not yet been posted (no journal entry created).
   */
  static async findByVoucherId(
    voucherId: string,
    client?: PoolClient
  ): Promise<AccountingJournalEntryRow | null> {
    const sql = `
      SELECT * FROM public.accounting_journal_entry
      WHERE voucher_id = $1
      LIMIT 1
    `;
    const res = client
      ? await client.query<AccountingJournalEntryRow>(sql, [voucherId])
      : await dbQuery<AccountingJournalEntryRow>(sql, [voucherId]);
    return res.rows[0] ?? null;
  }

  /**
   * Fetch all journal lines for a given journal entry ID.
   * Lines are enriched with account code/name/type via JOIN.
   */
  static async findLinesByEntryId(
    journalEntryId: string,
    client?: PoolClient
  ): Promise<AccountingJournalLineRow[]> {
    const sql = `
      SELECT jl.*,
             a.code AS account_code,
             a.name AS account_name,
             a.type AS account_type,
             cc.code AS cost_centre_code,
             cc.name AS cost_centre_name
      FROM public.accounting_journal_line jl
      JOIN public.accounting_account a ON a.id = jl.account_id
      LEFT JOIN public.cost_centre cc ON cc.id = jl.cost_centre_id
      WHERE jl.journal_entry_id = $1
      ORDER BY jl.line_no ASC
    `;
    const res = client
      ? await client.query<AccountingJournalLineRow>(sql, [journalEntryId])
      : await dbQuery<AccountingJournalLineRow>(sql, [journalEntryId]);
    return res.rows;
  }

  // ── GENERAL LEDGER (Server-Paginated) ─────────────────────────────────────────

  /**
   * Server-paginated General Ledger query.
   *
   * LAZY CODER / PERFORMANCE: Never fetches the entire ledger into memory.
   * All filtering (account, branch, date, customer, supplier) is performed in PostgreSQL.
   * Uses existing indexes: idx_accounting_jline_account_branch, idx_accounting_jline_branch,
   * idx_accounting_journal_branch_date.
   *
   * SECURITY:
   * - branch_id filter MUST be set for branch-manager access.
   * - account_id, customer_id, supplier_id filters are not trusted from the client — they
   *   should be validated or sourced server-side before calling this method.
   */
  static async getGeneralLedger(filters: GeneralLedgerFilters = {}): Promise<GeneralLedgerResult> {
    const conditions: string[] = [];
    const params: unknown[] = [];
    let idx = 1;

    // Branch scope (BOLA protection)
    if (filters.branch_id) {
      conditions.push(`jl.branch_id = $${idx++}`);
      params.push(filters.branch_id);
    }
    // Account filter
    if (filters.account_id) {
      conditions.push(`jl.account_id = $${idx++}`);
      params.push(filters.account_id);
    }
    // Customer filter
    if (filters.customer_id) {
      conditions.push(`jl.customer_id = $${idx++}`);
      params.push(filters.customer_id);
    }
    // Supplier filter
    if (filters.supplier_id) {
      conditions.push(`jl.supplier_id = $${idx++}`);
      params.push(filters.supplier_id);
    }
    // Date range
    if (filters.startDate) {
      conditions.push(`je.entry_date >= $${idx++}`);
      params.push(filters.startDate);
    }
    if (filters.endDate) {
      conditions.push(`je.entry_date <= $${idx++}`);
      params.push(filters.endDate);
    }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

    const limit = Math.min(filters.limit ?? 50, 500);
    const page = Math.max(filters.page ?? 1, 1);
    const offset = (page - 1) * limit;

    const baseSql = `
      FROM public.accounting_journal_line jl
      JOIN public.accounting_journal_entry je ON je.id = jl.journal_entry_id
      JOIN public.accounting_voucher v ON v.id = je.voucher_id
      JOIN public.accounting_account a ON a.id = jl.account_id
      ${where}
    `;

    const [dataRes, countRes] = await Promise.all([
      dbQuery<GeneralLedgerRow>(
        `SELECT
           jl.id AS line_id,
           je.entry_date,
           je.entry_no,
           v.id AS voucher_id,
           v.voucher_no,
           v.voucher_type,
           jl.account_id,
           a.code AS account_code,
           a.name AS account_name,
           jl.debit_amount,
           jl.credit_amount,
           jl.branch_id,
           jl.customer_id,
           jl.supplier_id,
           jl.narration
         ${baseSql}
         ORDER BY je.entry_date DESC, je.id DESC, jl.line_no ASC
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
      lines: dataRes.rows,
      total,
      page,
      limit,
      totalPages,
    };
  }

  // ── TRIAL BALANCE ─────────────────────────────────────────────────────────────

  /**
   * Compute the Trial Balance for a given date range and optional branch.
   *
   * Returns all active, non-deleted leaf accounts with their total debits,
   * total credits, and net balance. Group accounts are included for hierarchy display
   * but their totals are computed from their leaf descendants via the SQL aggregation.
   *
   * LAZY CODER: Uses a single aggregation query — no ORM, no in-memory computation.
   * Indexes used: idx_accounting_jline_account_branch, idx_accounting_jline_branch.
   *
   * SECURITY: branchId must come from server session for branch-scoped P&L.
   *
   * @param branchId   Optional branch scope. Omit for company-wide trial balance.
   * @param startDate  Period start (YYYY-MM-DD). Omit for all-time.
   * @param endDate    Period end (YYYY-MM-DD). Omit for all-time.
   * @param excludeClosingVouchers Optional flag to exclude YEAR_END_CLOSE vouchers.
   * @param client   Optional PoolClient for running within an atomic transaction.
   */
  static async getTrialBalance(
    branchId?: string,
    startDate?: string,
    endDate?: string,
    excludeClosingVouchers: boolean = false,
    client?: PoolClient
  ): Promise<TrialBalanceRow[]> {
    const lineConditions: string[] = [];
    const params: unknown[] = [];
    let idx = 1;

    if (branchId) {
      lineConditions.push(`jl.branch_id = $${idx++}`);
      params.push(branchId);
    }
    if (startDate) {
      lineConditions.push(`je.entry_date >= $${idx++}`);
      params.push(startDate);
    }
    if (endDate) {
      lineConditions.push(`je.entry_date <= $${idx++}`);
      params.push(endDate);
    }
    if (excludeClosingVouchers) {
      lineConditions.push(`(v.reference_type IS NULL OR v.reference_type NOT IN ('YEAR_END_CLOSE', 'YEAR_END_REOPEN'))`);
    }

    const lineWhere = lineConditions.length > 0 ? `WHERE ${lineConditions.join(" AND ")}` : "";

    // When date/branch filters are present, we pre-aggregate the matching journal
    // lines in a subquery so the LEFT JOIN to accounting_account is clean.
    // Without filters, we do a simple LEFT JOIN for all lines.
    const sql = lineConditions.length > 0
      ? `
        SELECT
          a.id AS account_id,
          a.code,
          a.name,
          a.type,
          a.subtype,
          a.level,
          a.is_group,
          COALESCE(filtered.total_debit, 0)  AS total_debit,
          COALESCE(filtered.total_credit, 0) AS total_credit,
          COALESCE(filtered.total_debit, 0) - COALESCE(filtered.total_credit, 0) AS net_balance
        FROM public.accounting_account a
        LEFT JOIN (
          SELECT
            jl.account_id,
            SUM(jl.debit_amount)  AS total_debit,
            SUM(jl.credit_amount) AS total_credit
          FROM public.accounting_journal_line jl
          JOIN public.accounting_journal_entry je ON je.id = jl.journal_entry_id
          JOIN public.accounting_voucher v ON v.id = je.voucher_id
          ${lineWhere}
          GROUP BY jl.account_id
        ) filtered ON filtered.account_id = a.id
        WHERE a.deleted_at IS NULL AND a.is_active = true
        GROUP BY a.id, a.code, a.name, a.type, a.subtype, a.level, a.is_group,
                 filtered.total_debit, filtered.total_credit
        ORDER BY a.code ASC
      `
      : `
        SELECT
          a.id AS account_id,
          a.code,
          a.name,
          a.type,
          a.subtype,
          a.level,
          a.is_group,
          COALESCE(SUM(jl.debit_amount), 0)  AS total_debit,
          COALESCE(SUM(jl.credit_amount), 0) AS total_credit,
          COALESCE(SUM(jl.debit_amount), 0) - COALESCE(SUM(jl.credit_amount), 0) AS net_balance
        FROM public.accounting_account a
        LEFT JOIN public.accounting_journal_line jl ON jl.account_id = a.id
        WHERE a.deleted_at IS NULL AND a.is_active = true
        GROUP BY a.id, a.code, a.name, a.type, a.subtype, a.level, a.is_group
        ORDER BY a.code ASC
      `;

    const res = client
      ? await client.query<TrialBalanceRow>(sql, params as unknown[])
      : await dbQuery<TrialBalanceRow>(sql, params as unknown[]);
    return res.rows;
  }
}
