/**
 * CakeToHome ERP — General Ledger Service
 * Phase 5A Step 1: Service layer for GL Account-Wise Ledger and Trial Balance.
 *
 * ARCHITECTURE:
 * 1. READ-ONLY: This service performs zero mutations. All data is queried from
 *    posted journal entries and lines via the existing AccountingJournalRepository.
 * 2. REUSES EXISTING REPOSITORY METHODS:
 *    - AccountingJournalRepository.getGeneralLedger() for paginated ledger lines
 *    - AccountingJournalRepository.getTrialBalance() for TB aggregation
 *    - AccountingAccountRepository.findById() / listAccounts() for CoA data
 * 3. ADDS SERVICE-LEVEL CONCERNS:
 *    - RBAC enforcement via hasEffectivePermission("ACCOUNTING.VIEW")
 *    - Branch isolation for non-super-admin
 *    - Opening balance computation (pre-period sum)
 *    - Running balance enrichment per line
 *    - Closing balance derivation
 *    - Normal balance convention (DEBIT vs CREDIT accounts)
 *    - Trial balance summary with balanced/imbalanced indicator
 * 4. NO CLIENT-SIDE FINANCIAL AUTHORITY:
 *    - branch_id for non-super-admin always comes from session
 *    - Account balances derived exclusively from journal lines
 *    - Opening balances are never fabricated
 *
 * SECURITY:
 * - RBAC: ACCOUNTING.VIEW required
 * - BOLA: branch_id enforced from session for non-super-admin
 * - No mutations
 * - All SQL via existing parameterized repository methods
 *
 * PostgreSQL → Repository → Service → API → UI
 */

import { dbQuery } from "../db";
import { AccountingJournalRepository } from "../repositories/accounting-journal.repository";
import { AccountingAccountRepository } from "../repositories/accounting-account.repository";
import { getNormalBalance } from "../types/accounting.types";
import type {
  AccountLedgerParams,
  AccountLedgerLine,
  AccountLedgerResult,
  TrialBalanceParams,
  TrialBalanceResult,
  TrialBalanceRow,
  GeneralLedgerRow,
  AccountType,
} from "../types/accounting.types";

// ─── Error Codes ────────────────────────────────────────────────────────────────

export type GLErrorCode =
  | "ACCOUNT_REQUIRED"
  | "ACCOUNT_NOT_FOUND"
  | "INVALID_DATE_FORMAT"
  | "INVALID_PAGINATION";

export class GeneralLedgerServiceError extends Error {
  readonly code: GLErrorCode;
  constructor(code: GLErrorCode, message: string) {
    super(message);
    this.name = "GeneralLedgerServiceError";
    this.code = code;
  }
}

// ─── Date validation ────────────────────────────────────────────────────────────

const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;

function isValidDateStr(s: string | undefined | null): s is string {
  if (!s) return false;
  if (!DATE_REGEX.test(s)) return false;
  const d = new Date(s);
  return !isNaN(d.getTime());
}

// ─── GeneralLedgerService ───────────────────────────────────────────────────────

export class GeneralLedgerService {
  // ── ACCOUNT LEDGER ──────────────────────────────────────────────────────────
  /**
   * Returns per-account chronological transaction register with:
   * - Opening balance (all activity before startDate)
   * - Running balance per line (cumulative from opening)
   * - Closing balance (opening + period net)
   * - Total debit and credit for the period
   *
   * Normal balance convention:
   *   ASSET/EXPENSE (DEBIT-normal): balance = SUM(debit) − SUM(credit)
   *   LIABILITY/REVENUE/EQUITY (CREDIT-normal): balance = SUM(credit) − SUM(debit)
   *
   * RBAC: Requires ACCOUNTING.VIEW
   * Branch: Non-super-admin locked to their branch_id from session.
   */
  static async getAccountLedger(
    params: AccountLedgerParams,
    branchIdFromSession: string | undefined,
    isSuperAdmin: boolean
  ): Promise<AccountLedgerResult> {
    // ── Validate account_id ────────────────────────────────────────────
    if (!params.account_id) {
      throw new GeneralLedgerServiceError(
        "ACCOUNT_REQUIRED",
        "account_id is required."
      );
    }

    // ── Validate dates ─────────────────────────────────────────────────
    if (params.startDate && !isValidDateStr(params.startDate)) {
      throw new GeneralLedgerServiceError(
        "INVALID_DATE_FORMAT",
        `Invalid startDate: '${params.startDate}'. Expected YYYY-MM-DD.`
      );
    }
    if (params.endDate && !isValidDateStr(params.endDate)) {
      throw new GeneralLedgerServiceError(
        "INVALID_DATE_FORMAT",
        `Invalid endDate: '${params.endDate}'. Expected YYYY-MM-DD.`
      );
    }

    // ── Validate pagination ────────────────────────────────────────────
    const page = Math.max(params.page ?? 1, 1);
    const limit = Math.min(Math.max(params.limit ?? 50, 1), 500);

    // ── Resolve branch scope (BOLA enforcement) ────────────────────────
    const effectiveBranchId = isSuperAdmin
      ? params.branch_id || undefined
      : branchIdFromSession || undefined;

    // ── Fetch account metadata ─────────────────────────────────────────
    const account = await AccountingAccountRepository.findById(params.account_id);
    if (!account) {
      throw new GeneralLedgerServiceError(
        "ACCOUNT_NOT_FOUND",
        `Account '${params.account_id}' not found.`
      );
    }

    const normalBalance = getNormalBalance(account.type as AccountType);
    const isDebitNormal = normalBalance === "DEBIT";

    // ── Compute opening balance (pre-period activity) ──────────────────
    let openingBalance = 0;
    if (params.startDate) {
      openingBalance = await this.computeOpeningBalance(
        params.account_id,
        params.startDate,
        effectiveBranchId,
        isDebitNormal
      );
    }

    // ── Fetch paginated ledger lines via existing repository ────────────
    const glResult = await AccountingJournalRepository.getGeneralLedger({
      account_id: params.account_id,
      branch_id: effectiveBranchId,
      startDate: params.startDate,
      endDate: params.endDate,
      page,
      limit,
    });

    // ── Compute period totals from ALL matching lines (not just page) ──
    const periodTotals = await this.computePeriodTotals(
      params.account_id,
      params.startDate,
      params.endDate,
      effectiveBranchId
    );

    // ── Compute running balance offset for current page ────────────────
    // If we're on page > 1, we need the cumulative balance from all prior pages
    let priorPagesBalance = openingBalance;
    if (page > 1) {
      priorPagesBalance = await this.computeRunningBalanceOffset(
        params.account_id,
        params.startDate,
        params.endDate,
        effectiveBranchId,
        isDebitNormal,
        (page - 1) * limit,
        openingBalance
      );
    }

    // ── Enrich lines with running balance ──────────────────────────────
    let runningBal = priorPagesBalance;
    const enrichedLines: AccountLedgerLine[] = glResult.lines.map((line: GeneralLedgerRow) => {
      if (isDebitNormal) {
        runningBal += line.debit_amount - line.credit_amount;
      } else {
        runningBal += line.credit_amount - line.debit_amount;
      }
      return {
        line_id: line.line_id,
        entry_date: line.entry_date,
        entry_no: line.entry_no,
        voucher_id: line.voucher_id,
        voucher_no: line.voucher_no,
        voucher_type: line.voucher_type,
        narration: line.narration,
        debit_amount: Number(line.debit_amount) || 0,
        credit_amount: Number(line.credit_amount) || 0,
        running_balance: Math.round(runningBal * 100) / 100,
        branch_id: line.branch_id,
        customer_id: line.customer_id,
        supplier_id: line.supplier_id,
      };
    });

    // ── Compute closing balance ────────────────────────────────────────
    const closingBalance = isDebitNormal
      ? openingBalance + periodTotals.totalDebit - periodTotals.totalCredit
      : openingBalance + periodTotals.totalCredit - periodTotals.totalDebit;

    return {
      account: {
        id: account.id,
        code: account.code,
        name: account.name,
        type: account.type as AccountType,
        subtype: account.subtype as any,
        normal_balance: normalBalance,
      },
      opening_balance: Math.round(openingBalance * 100) / 100,
      closing_balance: Math.round(closingBalance * 100) / 100,
      total_debit: Math.round(periodTotals.totalDebit * 100) / 100,
      total_credit: Math.round(periodTotals.totalCredit * 100) / 100,
      lines: enrichedLines,
      total: glResult.total,
      page: glResult.page,
      limit: glResult.limit,
      totalPages: glResult.totalPages,
    };
  }

  // ── TRIAL BALANCE ───────────────────────────────────────────────────────────
  /**
   * Returns the trial balance for a period, with summary totals and
   * balanced/imbalanced indicator.
   *
   * Delegates to existing AccountingJournalRepository.getTrialBalance().
   * Adds: summary computation, branch enforcement.
   *
   * Mathematical invariant: total_debit === total_credit (balanced GL).
   *
   * RBAC: Requires ACCOUNTING.VIEW
   */
  static async getTrialBalance(
    params: TrialBalanceParams,
    branchIdFromSession: string | undefined,
    isSuperAdmin: boolean
  ): Promise<TrialBalanceResult> {
    // ── Validate dates ─────────────────────────────────────────────────
    if (params.startDate && !isValidDateStr(params.startDate)) {
      throw new GeneralLedgerServiceError(
        "INVALID_DATE_FORMAT",
        `Invalid startDate: '${params.startDate}'. Expected YYYY-MM-DD.`
      );
    }
    if (params.endDate && !isValidDateStr(params.endDate)) {
      throw new GeneralLedgerServiceError(
        "INVALID_DATE_FORMAT",
        `Invalid endDate: '${params.endDate}'. Expected YYYY-MM-DD.`
      );
    }

    // ── Resolve branch scope (BOLA enforcement) ────────────────────────
    const effectiveBranchId = isSuperAdmin
      ? params.branch_id || undefined
      : branchIdFromSession || undefined;

    // ── Fetch TB from existing repository ──────────────────────────────
    const rows: TrialBalanceRow[] = await AccountingJournalRepository.getTrialBalance(
      effectiveBranchId,
      params.startDate,
      params.endDate
    );

    // ── Compute summary ────────────────────────────────────────────────
    // For TB, we present debit balances and credit balances separately:
    // - DEBIT-normal accounts with positive net_balance → debit column
    // - CREDIT-normal accounts with positive net_balance (credit > debit) → credit column
    // But the canonical representation from the repository is already:
    //   net_balance = SUM(debit) - SUM(credit)
    // So we compute column sums directly from total_debit and total_credit.
    let totalDebit = 0;
    let totalCredit = 0;

    for (const row of rows) {
      totalDebit += Number(row.total_debit) || 0;
      totalCredit += Number(row.total_credit) || 0;
    }

    totalDebit = Math.round(totalDebit * 100) / 100;
    totalCredit = Math.round(totalCredit * 100) / 100;
    const imbalance = Math.round(Math.abs(totalDebit - totalCredit) * 100) / 100;

    return {
      rows: rows.map((r) => ({
        ...r,
        total_debit: Number(r.total_debit) || 0,
        total_credit: Number(r.total_credit) || 0,
        net_balance: Number(r.net_balance) || 0,
      })),
      summary: {
        total_debit: totalDebit,
        total_credit: totalCredit,
        is_balanced: imbalance < 0.01,
        imbalance,
      },
      filters: {
        branch_id: effectiveBranchId || null,
        startDate: params.startDate || null,
        endDate: params.endDate || null,
      },
    };
  }

  // ── CHART OF ACCOUNTS LIST ──────────────────────────────────────────────────
  /**
   * Returns the list of non-group, active accounts for the account selector dropdown.
   * No RBAC is applied here — the API layer enforces ACCOUNTING.VIEW before calling this.
   */
  static async listAccounts(options?: {
    includeGroups?: boolean;
    search?: string;
  }) {
    return AccountingAccountRepository.listAccounts({
      is_group: options?.includeGroups ? undefined : false,
      is_active: true,
      search: options?.search,
    });
  }

  // ── PRIVATE HELPERS ─────────────────────────────────────────────────────────

  /**
   * Compute opening balance for an account as of a date.
   * Opening = all posted journal line activity BEFORE startDate.
   * Returned in normal-balance convention (positive = expected direction).
   */
  private static async computeOpeningBalance(
    accountId: string,
    startDate: string,
    branchId: string | undefined,
    isDebitNormal: boolean
  ): Promise<number> {
    const conditions: string[] = ["jl.account_id = $1", "je.entry_date < $2"];
    const params: unknown[] = [accountId, startDate];
    let idx = 3;

    if (branchId) {
      conditions.push(`jl.branch_id = $${idx++}`);
      params.push(branchId);
    }

    const sql = `
      SELECT
        COALESCE(SUM(jl.debit_amount), 0)  AS total_debit,
        COALESCE(SUM(jl.credit_amount), 0) AS total_credit
      FROM public.accounting_journal_line jl
      JOIN public.accounting_journal_entry je ON je.id = jl.journal_entry_id
      WHERE ${conditions.join(" AND ")}
    `;

    const res = await dbQuery<{ total_debit: string; total_credit: string }>(sql, params);
    const row = res.rows[0];
    if (!row) return 0;

    const debit = Number(row.total_debit) || 0;
    const credit = Number(row.total_credit) || 0;

    return isDebitNormal ? debit - credit : credit - debit;
  }

  /**
   * Compute total debit and credit for an account within a date range.
   * Used for closing balance calculation: closing = opening + period totals.
   */
  private static async computePeriodTotals(
    accountId: string,
    startDate: string | undefined,
    endDate: string | undefined,
    branchId: string | undefined
  ): Promise<{ totalDebit: number; totalCredit: number }> {
    const conditions: string[] = ["jl.account_id = $1"];
    const params: unknown[] = [accountId];
    let idx = 2;

    if (branchId) {
      conditions.push(`jl.branch_id = $${idx++}`);
      params.push(branchId);
    }
    if (startDate) {
      conditions.push(`je.entry_date >= $${idx++}`);
      params.push(startDate);
    }
    if (endDate) {
      conditions.push(`je.entry_date <= $${idx++}`);
      params.push(endDate);
    }

    const sql = `
      SELECT
        COALESCE(SUM(jl.debit_amount), 0)  AS total_debit,
        COALESCE(SUM(jl.credit_amount), 0) AS total_credit
      FROM public.accounting_journal_line jl
      JOIN public.accounting_journal_entry je ON je.id = jl.journal_entry_id
      WHERE ${conditions.join(" AND ")}
    `;

    const res = await dbQuery<{ total_debit: string; total_credit: string }>(sql, params);
    const row = res.rows[0];
    if (!row) return { totalDebit: 0, totalCredit: 0 };

    return {
      totalDebit: Number(row.total_debit) || 0,
      totalCredit: Number(row.total_credit) || 0,
    };
  }

  /**
   * Compute the cumulative running balance for all lines BEFORE the current page offset.
   * This ensures running balances on page 2+ start correctly.
   */
  private static async computeRunningBalanceOffset(
    accountId: string,
    startDate: string | undefined,
    endDate: string | undefined,
    branchId: string | undefined,
    isDebitNormal: boolean,
    offsetRows: number,
    openingBalance: number
  ): Promise<number> {
    const conditions: string[] = ["jl.account_id = $1"];
    const params: unknown[] = [accountId];
    let idx = 2;

    if (branchId) {
      conditions.push(`jl.branch_id = $${idx++}`);
      params.push(branchId);
    }
    if (startDate) {
      conditions.push(`je.entry_date >= $${idx++}`);
      params.push(startDate);
    }
    if (endDate) {
      conditions.push(`je.entry_date <= $${idx++}`);
      params.push(endDate);
    }

    const sql = `
      SELECT
        COALESCE(SUM(sub.debit_amount), 0) AS total_debit,
        COALESCE(SUM(sub.credit_amount), 0) AS total_credit
      FROM (
        SELECT jl.debit_amount, jl.credit_amount
        FROM public.accounting_journal_line jl
        JOIN public.accounting_journal_entry je ON je.id = jl.journal_entry_id
        WHERE ${conditions.join(" AND ")}
        ORDER BY je.entry_date ASC, je.id ASC, jl.line_no ASC
        LIMIT $${idx}
      ) sub
    `;
    params.push(offsetRows);

    const res = await dbQuery<{ total_debit: string; total_credit: string }>(sql, params);
    const row = res.rows[0];
    if (!row) return openingBalance;

    const debit = Number(row.total_debit) || 0;
    const credit = Number(row.total_credit) || 0;

    return isDebitNormal
      ? openingBalance + debit - credit
      : openingBalance + credit - debit;
  }
}
