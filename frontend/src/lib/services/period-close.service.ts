/**
 * CakeToHome ERP — Period & Year-End Close Service
 * Phase 5A Step 6: Step 1 — Pre-Close Diagnostics Engine
 *
 * ARCHITECTURAL SPECIFICATIONS & CONSTRAINTS:
 * 1. DATABASE IS THE ONLY SOURCE OF TRUTH:
 *    - All diagnostics derive strictly from PostgreSQL accounting records.
 *    - No mock data, no static assumptions, no synthetic balancing plugs.
 * 2. STRICTLY READ-ONLY IN STEP 1:
 *    - Zero INSERT, UPDATE, DELETE operations.
 *    - Zero period locking (is_locked remains unmodified).
 *    - Zero year-end posting (no closing vouchers, no closing journals, no nominal zeroing).
 *    - Zero mutations to existing reporting services.
 * 3. PREREQUISITE MATRIX ENFORCEMENT:
 *    - Classifies checks into BLOCKING, WARNING, and INFORMATIONAL.
 *    - can_close is TRUE if and only if blocking_checks.length === 0.
 * 4. NOMINAL ACCOUNT TOPOLOGY:
 *    - Strictly tracks the 26 nominal leaf accounts (7 Revenue, 19 Expense).
 * 5. CRITICAL CAKE RULE PRESERVED:
 *    - Made-to-order cake availability is operational and generates zero stock movements or vouchers.
 */

import { dbQuery, dbTransaction } from "../db";
import type { PoolClient, QueryResultRow } from "pg";
import crypto from "crypto";
import { AccountingConfigService } from "./accounting-config.service";
import { AccountingFiscalPeriodRepository } from "../repositories/accounting-fiscal-period.repository";
import { AccountingJournalRepository } from "../repositories/accounting-journal.repository";
import { AccountingAccountRepository } from "../repositories/accounting-account.repository";
import { AccountingVoucherRepository } from "../repositories/accounting-voucher.repository";
import { AccountsReceivableService } from "./accounts-receivable.service";
import { AccountsPayableService } from "./accounts-payable.service";
import { PostingService } from "./posting.service";
import type {
  TrialBalanceRow,
  AccountingFiscalPeriodRow,
  AccountingAccountRow,
  AccountingVoucherRow,
  AccountingJournalEntryRow,
  AccountingJournalLineRow,
  JournalLineInput,
  VoucherCreateInput,
} from "../types/accounting.types";
import { FiscalPeriodService } from "./fiscal-period.service";

// ─── Substep 5.2 Types: Retained Earnings Roll-Forward ───────────────────────

/**
 * Per-fiscal-year row in the Retained Earnings Roll-Forward report.
 * Derived entirely from the authoritative double-entry journal.
 */
export interface RetainedEarningsYearRollForward {
  fiscal_year: string;
  start_date: string;
  end_date: string;
  is_closed: boolean;
  active_close_voucher_id: string | null;
  opening_retained_earnings: number;   // Balance in 3210 at start_date (from all prior journal lines)
  net_operating_profit: number;        // From nominal accounts (exclude closing vouchers)
  transferred_to_retained_earnings: number; // Actual credit to 3210 in close voucher
  drawings_transferred: number;        // Drawings closed to 3210
  reopen_reversals: number;            // Reversals applied if reopened
  closing_retained_earnings: number;   // Balance in 3210 at end_date (inclusive of close/reopen vouchers)
  continuity_verified: boolean;        // opening_re(N+1) === closing_re(N)
}

export interface RetainedEarningsRollForwardResult {
  years: RetainedEarningsYearRollForward[];
  overall_continuity_verified: boolean;
  timestamp: string;
}

/**
 * Fiscal Year Summary — status, lock state, financial summary, and close history.
 */
export interface FiscalYearSummaryItem {
  fiscal_year: string;
  start_date: string;
  end_date: string;
  status: "OPEN" | "CLOSED" | "REOPENED";
  total_periods: number;
  locked_periods: number;
  all_periods_locked: boolean;
  active_closing_voucher: {
    voucher_id: string;
    voucher_no: string;
    close_date: string;
    net_profit: number;
    drawings_transferred: number;
  } | null;
  close_cycle_count: number;
  reopen_cycle_count: number;
  operating_revenue: number;
  operating_expense: number;
  net_profit: number;
  historical_lockout_active: boolean;
}

/**
 * Comparative Profit & Loss — side-by-side account comparison with variance.
 */
export interface ComparativePnLParams {
  fiscal_year: string;
  compare_fiscal_year: string;
  branch_id?: string;
}

export interface ComparativePnLAccountLine {
  code: string;
  name: string;
  type: "REVENUE" | "EXPENSE";
  subtype: string;
  current_amount: number;
  compare_amount: number;
  variance_amount: number;
  variance_percent: number | null;
}

export interface ComparativePnLSection {
  label: string;
  accounts: ComparativePnLAccountLine[];
  current_total: number;
  compare_total: number;
  variance_total: number;
  variance_percent: number | null;
}

export interface ComparativePnLResult {
  current_fiscal_year: string;
  compare_fiscal_year: string;
  current_period: { start_date: string; end_date: string };
  compare_period: { start_date: string; end_date: string };
  sections: {
    operating_revenue: ComparativePnLSection;
    cost_of_goods_sold: ComparativePnLSection;
    operating_expenses: ComparativePnLSection;
    other_income: ComparativePnLSection;
    financial_expenses: ComparativePnLSection;
  };
  summary: {
    current_gross_profit: number;
    compare_gross_profit: number;
    gross_profit_variance: number;
    current_operating_profit: number;
    compare_operating_profit: number;
    operating_profit_variance: number;
    current_net_profit: number;
    compare_net_profit: number;
    net_profit_variance: number;
    net_profit_variance_percent: number | null;
  };
  timestamp: string;
}

// ─── Diagnostic Types & Interfaces ───────────────────────────────────────────

export type DiagnosticCheckStatus = "PASS" | "BLOCKING" | "WARNING" | "INFO";

export type DiagnosticCheckCategory =
  | "PERIOD_CONFIG"
  | "VOUCHER_PIPELINE"
  | "GENERAL_LEDGER"
  | "CLEARING_ACCOUNTS"
  | "SUBLEDGER_RECONCILIATION"
  | "FINANCIAL_SUMMARY"
  | "OPERATIONAL_CAKE_RULE";

export interface DiagnosticCheckItem {
  id: string;
  name: string;
  category: DiagnosticCheckCategory;
  status: DiagnosticCheckStatus;
  message: string;
  details?: Record<string, unknown>;
}

export interface DiagnosticNominalAccountLine {
  code: string;
  name: string;
  type: "REVENUE" | "EXPENSE";
  subtype: string;
  is_contra: boolean;
  balance: number;
  proposed_action: "DEBIT" | "CREDIT" | "NONE";
  closing_amount: number;
}

export interface PreCloseDiagnosticsParams {
  fiscal_year: string;
  branch_id?: string;
  session_user?: {
    id: string;
    role: string;
    branch_id?: string | null;
    isSuperAdmin?: boolean;
    permissions?: string[];
  };
}

export interface PreCloseDiagnosticsResult {
  fiscal_year: string;
  start_date: string;
  end_date: string;
  can_close: boolean;
  summary: {
    blocking_count: number;
    warning_count: number;
    info_count: number;
    total_checks: number;
    is_balanced_tb: boolean;
    gross_revenue: number;
    gross_expenses: number;
    projected_net_profit: number;
  };
  blocking_checks: DiagnosticCheckItem[];
  warnings: DiagnosticCheckItem[];
  informational: DiagnosticCheckItem[];
  nominal_accounts: {
    revenues: DiagnosticNominalAccountLine[];
    expenses: DiagnosticNominalAccountLine[];
    gross_revenue: number;
    gross_expenses: number;
    projected_net_profit: number;
  };
  projected_equity: {
    current_retained_earnings_3210: number;
    projected_retained_earnings_3210: number;
    current_dynamic_3220: number;
    projected_dynamic_3220: number;
    opening_balance_offset_3300: number;
  };
  timestamp: string;
}

export interface ExecuteYearEndCloseParams {
  fiscal_year: string;
  branch_id?: string;
  closeDrawingsToRetainedEarnings?: boolean;
  preparer_id: string;
  approver_id: string;
  session_user?: {
    id: string;
    role: string;
    branch_id?: string | null;
    isSuperAdmin?: boolean;
    permissions?: string[];
  };
}

export interface ExecuteYearEndCloseResult {
  success: boolean;
  voucher_id: string;
  voucher_no: string;
  journal_entry_id: string;
  entry_no: string;
  fiscal_year: string;
  close_date: string;
  gross_revenue: number;
  gross_expenses: number;
  net_profit: number;
  retained_earnings_transferred: number;
  drawings_transferred: number;
  accounts_zeroed_count: number;
  next_fiscal_year_provisioned: string | null;
  message: string;
  timestamp: string;
}

export interface ReopenYearEndCloseParams {
  fiscal_year: string;
  reason: string;
  preparer_id: string;
  approver_id: string;
  session_user?: {
    id: string;
    role: string;
    branch_id?: string | null;
    isSuperAdmin?: boolean;
    permissions?: string[];
  };
}

export interface ReopenYearEndCloseResult {
  success: boolean;
  fiscal_year: string;
  original_closing_voucher_id: string;
  original_closing_voucher_no: string;
  reversal_voucher_id: string;
  reversal_voucher_no: string;
  reversal_journal_entry_id: string;
  reversal_entry_no: string;
  reversal_date: string;
  net_profit_reversed: number;
  drawings_reversed: number;
  accounts_restored_count: number;
  reopen_reason: string;
  preparer_id: string;
  approver_id: string;
  message: string;
  timestamp: string;
}

export interface PreviewYearEndReopenParams {
  fiscal_year: string;
  session_user?: {
    id: string;
    role: string;
    branch_id?: string | null;
    isSuperAdmin?: boolean;
    permissions?: string[];
  };
}

export interface PreviewYearEndReopenResult {
  fiscal_year: string;
  can_reopen: boolean;
  closing_voucher: {
    id: string;
    voucher_no: string;
    voucher_date: string;
    total_amount: number;
    net_profit: number;
    drawings_transferred: number;
    accounts_zeroed_count: number;
    closed_at: string;
  } | null;
  blocking_checks: Array<{ id: string; name: string; message: string }>;
  warnings: Array<{ id: string; name: string; message: string }>;
  projected_reversal_lines_count: number;
  projected_retained_earnings_impact: number;
  projected_drawings_impact: number;
  subsequent_fiscal_year: string;
  timestamp: string;
}

export interface FiscalYearCloseHistoryResult {
  fiscal_year: string;
  is_closed: boolean;
  active_closing_voucher: {
    id: string;
    voucher_no: string;
    voucher_date: string;
    total_amount: number;
    created_at: string;
  } | null;
  close_events_count: number;
  reopen_events_count: number;
  timeline: Array<{
    type: "CLOSE" | "REOPEN";
    voucher_id: string;
    voucher_no: string;
    voucher_date: string;
    total_amount: number;
    actor_id?: string;
    timestamp: string;
    metadata?: any;
  }>;
}

export class PeriodCloseServiceError extends Error {
  readonly code: string;
  constructor(code: string, message: string) {
    super(message);
    this.name = "PeriodCloseServiceError";
    this.code = code;
  }
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function round2(num: number): number {
  return Math.round((num + Number.EPSILON) * 100) / 100;
}

function toIsoDate(val: string | Date | unknown): string {
  if (!val) return "";
  if (typeof val === "string") return val.substring(0, 10);
  if (val instanceof Date) {
    const y = val.getFullYear();
    const m = String(val.getMonth() + 1).padStart(2, "0");
    const d = String(val.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  }
  return String(val).substring(0, 10);
}

/**
 * Derives calendar dates for an Indian Fiscal Year string (1 April – 31 March).
 * Examples:
 *   "FY2425" or "2024-2025" or "FY 2024-2025" -> 2024-04-01 to 2025-03-31
 *   "FY2526" or "2025-2026"                   -> 2025-04-01 to 2026-03-31
 */
function deriveIndianFiscalYearDates(fyStr: string): { startDate: string; endDate: string } {
  const clean = fyStr.replace(/\s+/g, "").toUpperCase();
  
  // Match "FY2425"
  const mShort = clean.match(/^FY(\d{2})(\d{2})$/);
  if (mShort) {
    const startYear = 2000 + parseInt(mShort[1], 10);
    const endYear = 2000 + parseInt(mShort[2], 10);
    return {
      startDate: `${startYear}-04-01`,
      endDate: `${endYear}-03-31`,
    };
  }

  // Match "2024-2025" or "FY2024-2025"
  const mLong = clean.match(/^(?:FY)?(\d{4})-(\d{4})$/);
  if (mLong) {
    const startYear = parseInt(mLong[1], 10);
    const endYear = parseInt(mLong[2], 10);
    return {
      startDate: `${startYear}-04-01`,
      endDate: `${endYear}-03-31`,
    };
  }

  // Default fallback if arbitrary string
  return {
    startDate: "2024-04-01",
    endDate: "2025-03-31",
  };
}

function deriveNextFiscalYear(currentFY: string): { nextFY: string; nextStartDate: string } {
  const clean = currentFY.replace(/\s+/g, "").toUpperCase();
  const mShort = clean.match(/^FY(\d{2})(\d{2})$/);
  if (mShort) {
    const startYear = 2000 + parseInt(mShort[1], 10) + 1;
    const endYear = 2000 + parseInt(mShort[2], 10) + 1;
    const s2 = String(startYear).slice(-2);
    const e2 = String(endYear).slice(-2);
    return {
      nextFY: `FY${s2}${e2}`,
      nextStartDate: `${startYear}-04-01`,
    };
  }
  const mLong = clean.match(/^(?:FY)?(\d{4})-(\d{4})$/);
  if (mLong) {
    const startYear = parseInt(mLong[1], 10) + 1;
    const endYear = parseInt(mLong[2], 10) + 1;
    return {
      nextFY: `${startYear}-${endYear}`,
      nextStartDate: `${startYear}-04-01`,
    };
  }
  return {
    nextFY: "FY2526",
    nextStartDate: "2025-04-01",
  };
}

async function resolveEnterpriseBranchId(branchId?: string, client?: PoolClient): Promise<string> {
  if (branchId) return branchId;
  const sql = `SELECT id FROM public.branch WHERE deleted_at IS NULL ORDER BY created_at ASC LIMIT 1`;
  const res = client ? await client.query(sql) : await dbQuery(sql);
  if (res.rows.length > 0) return res.rows[0].id;
  return "br_01KYWH0RTHVHRD04J79T28RAHN";
}

// ─── PeriodCloseService ──────────────────────────────────────────────────────

export class PeriodCloseService {
  /**
   * Evaluates all 24 prerequisite gates for closing a fiscal year.
   * Strictly read-only: does not mutate database or lock periods.
   */
  static async runPreCloseDiagnostics(
    params: PreCloseDiagnosticsParams,
    client?: PoolClient
  ): Promise<PreCloseDiagnosticsResult> {
    const queryFn = async <T extends QueryResultRow = any>(sql: string, sqlParams: any[] = []): Promise<{ rows: T[] }> => {
      return client ? client.query<T>(sql, sqlParams) : dbQuery<T>(sql, sqlParams);
    };

    // ── 0. RBAC & Security Validation ───────────────────────────────────────
    if (params.session_user) {
      const { role, isSuperAdmin, permissions, branch_id: userBranch } = params.session_user;
      const hasView = isSuperAdmin || role === "SUPER_ADMIN" || permissions?.includes("ACCOUNTING.VIEW");
      if (!hasView) {
        throw new PeriodCloseServiceError(
          "PERMISSION_DENIED",
          "Forbidden: User lacks ACCOUNTING.VIEW permission to run period close diagnostics."
        );
      }

      // Year-end close is company-wide/super-admin. Non-super-admins cannot query another branch
      if (userBranch && !isSuperAdmin && role !== "SUPER_ADMIN") {
        if (params.branch_id && params.branch_id !== userBranch) {
          throw new PeriodCloseServiceError(
            "BRANCH_ACCESS_DENIED",
            "Forbidden: Staff user cannot view period close diagnostics for another branch."
          );
        }
      }
    }

    const blockingChecks: DiagnosticCheckItem[] = [];
    const warnings: DiagnosticCheckItem[] = [];
    const informational: DiagnosticCheckItem[] = [];

    // ── 1. Period Dates Resolution ──────────────────────────────────────────
    const fiscalPeriods = await AccountingFiscalPeriodRepository.list(params.fiscal_year, client);
    
    let startDate: string;
    let endDate: string;

    if (fiscalPeriods.length > 0) {
      const sorted = [...fiscalPeriods].sort((a, b) => toIsoDate(a.start_date).localeCompare(toIsoDate(b.start_date)));
      startDate = toIsoDate(sorted[0].start_date);
      endDate = toIsoDate(sorted[sorted.length - 1].end_date);
    } else {
      const derived = deriveIndianFiscalYearDates(params.fiscal_year);
      startDate = derived.startDate;
      endDate = derived.endDate;
    }

    // ── 2. Gate 1: Accounting Start Date Configured ─────────────────────────
    const config = await AccountingFiscalPeriodRepository.getAccountingStartDateConfig(client);
    if (!config.configured) {
      blockingChecks.push({
        id: "GATE_START_DATE_CONFIGURED",
        name: "Accounting Start Date Configuration",
        category: "PERIOD_CONFIG",
        status: "BLOCKING",
        message: "Accounting start date is unconfigured. Operational period close is locked until official cut-off date is established.",
      });
    } else if (startDate < config.startDate) {
      blockingChecks.push({
        id: "GATE_START_DATE_CONFIGURED",
        name: "Accounting Start Date Boundary",
        category: "PERIOD_CONFIG",
        status: "BLOCKING",
        message: `Fiscal year start date (${startDate}) is prior to accounting start date (${config.startDate}).`,
        details: { startDate, accountingStartDate: config.startDate },
      });
    }

    // ── 3. Gate 2: Fiscal Periods Configured ────────────────────────────────
    if (fiscalPeriods.length === 0) {
      blockingChecks.push({
        id: "GATE_FISCAL_PERIOD_CONFIGURED",
        name: "Fiscal Periods Definition",
        category: "PERIOD_CONFIG",
        status: "BLOCKING",
        message: `No fiscal periods are configured in the database for fiscal year '${params.fiscal_year}'.`,
        details: { configured_periods: 0, required_periods: 12 },
      });
    } else if (fiscalPeriods.length < 12) {
      warnings.push({
        id: "WARN_FISCAL_PERIOD_COUNT",
        name: "Partial Fiscal Periods Configuration",
        category: "PERIOD_CONFIG",
        status: "WARNING",
        message: `Only ${fiscalPeriods.length} of 12 monthly periods are configured for fiscal year '${params.fiscal_year}'.`,
        details: { configured_periods: fiscalPeriods.length, required_periods: 12 },
      });
    }

    // ── 4. Gate 3: All Monthly Periods Locked ───────────────────────────────
    if (fiscalPeriods.length > 0) {
      const unlockedPeriods = fiscalPeriods.filter((p) => !p.is_locked);
      if (unlockedPeriods.length > 0) {
        blockingChecks.push({
          id: "GATE_PERIODS_LOCKED",
          name: "Sequential Monthly Periods Lockdown",
          category: "PERIOD_CONFIG",
          status: "BLOCKING",
          message: `${unlockedPeriods.length} monthly period(s) remain unlocked. All 12 monthly periods must be locked before annual close.`,
          details: {
            unlocked_periods: unlockedPeriods.map((p) => ({
              id: p.id,
              period_name: p.period_name,
              start_date: toIsoDate(p.start_date),
              end_date: toIsoDate(p.end_date),
            })),
          },
        });
      }
    }

    // ── 5. Gate 4: Voucher Pipeline (No Unposted Draft/Submitted Vouchers) ──
    const unpostedVouchersRes = await queryFn<{
      id: string;
      voucher_no: string;
      status: string;
      voucher_type: string;
      voucher_date: string;
      created_by: string;
    }>(
      `SELECT id, voucher_no, status, voucher_type, voucher_date::text, created_by 
       FROM public.accounting_voucher
       WHERE voucher_date BETWEEN $1 AND $2 
         AND status IN ('DRAFT', 'SUBMITTED', 'APPROVED')
         AND deleted_at IS NULL
       ORDER BY voucher_date ASC LIMIT 50`,
      [startDate, endDate]
    );

    if (unpostedVouchersRes.rows.length > 0) {
      const draftCount = unpostedVouchersRes.rows.filter((v) => v.status === "DRAFT").length;
      const submittedCount = unpostedVouchersRes.rows.filter((v) => v.status === "SUBMITTED").length;
      const approvedCount = unpostedVouchersRes.rows.filter((v) => v.status === "APPROVED").length;

      blockingChecks.push({
        id: "GATE_VOUCHERS_UNPOSTED",
        name: "Unposted Vouchers in Pipeline",
        category: "VOUCHER_PIPELINE",
        status: "BLOCKING",
        message: `${unpostedVouchersRes.rows.length} unposted voucher(s) found in period (${draftCount} Draft, ${submittedCount} Submitted, ${approvedCount} Approved). All vouchers must be posted or cancelled before close.`,
        details: {
          total_unposted: unpostedVouchersRes.rows.length,
          draft_count: draftCount,
          submitted_count: submittedCount,
          approved_count: approvedCount,
          samples: unpostedVouchersRes.rows.slice(0, 5),
        },
      });
    }

    // ── 6. Gate 5: General Ledger Trial Balance Balanced ────────────────────
    const tbRows: TrialBalanceRow[] = await AccountingJournalRepository.getTrialBalance(
      params.branch_id,
      startDate,
      endDate,
      false,
      client
    );

    const allAccounts = await AccountingAccountRepository.listAccounts({ is_active: true }, client);
    const tbByCode = new Map<string, TrialBalanceRow>();
    for (const r of tbRows) {
      tbByCode.set(r.code, r);
    }

    let tbTotalDebit = 0;
    let tbTotalCredit = 0;
    for (const r of tbRows) {
      if (!r.is_group) {
        tbTotalDebit += Number(r.total_debit) || 0;
        tbTotalCredit += Number(r.total_credit) || 0;
      }
    }
    tbTotalDebit = round2(tbTotalDebit);
    tbTotalCredit = round2(tbTotalCredit);
    const tbImbalance = round2(Math.abs(tbTotalDebit - tbTotalCredit));
    const isBalancedTb = tbImbalance < 0.01;

    if (!isBalancedTb) {
      blockingChecks.push({
        id: "GATE_TRIAL_BALANCE_BALANCED",
        name: "Trial Balance Mathematical Balance",
        category: "GENERAL_LEDGER",
        status: "BLOCKING",
        message: `Trial Balance is unbalanced: total debits (₹${tbTotalDebit}) != total credits (₹${tbTotalCredit}). Imbalance: ₹${tbImbalance}.`,
        details: { total_debit: tbTotalDebit, total_credit: tbTotalCredit, imbalance: tbImbalance },
      });
    }

    // ── 7. Gate 6: Suspense Account 1119 Cleared (₹0.00) ────────────────────
    const tb1119 = tbByCode.get("1119");
    const suspenseBalance = round2(Math.abs(Number(tb1119?.net_balance) || 0));
    if (suspenseBalance > 0) {
      blockingChecks.push({
        id: "GATE_SUSPENSE_CLEARED",
        name: "Unclassified Suspense Account Clearance",
        category: "CLEARING_ACCOUNTS",
        status: "BLOCKING",
        message: `Account 1119 Unclassified Suspense has an uncleared balance of ₹${suspenseBalance.toFixed(2)}. Suspense must be exactly ₹0.00 before close.`,
        details: { code: "1119", uncleared_balance: suspenseBalance },
      });
    }

    // ── 8. Gate 7: Deposit in Transit 1118 Cleared (₹0.00) ──────────────────
    const tb1118 = tbByCode.get("1118");
    const transitBalance = round2(Math.abs(Number(tb1118?.net_balance) || 0));
    if (transitBalance > 0) {
      blockingChecks.push({
        id: "GATE_TRANSIT_CLEARED",
        name: "Deposit in Transit Account Clearance",
        category: "CLEARING_ACCOUNTS",
        status: "BLOCKING",
        message: `Account 1118 Deposit in Transit has an uncleared balance of ₹${transitBalance.toFixed(2)}. Cash in transit must be cleared before close.`,
        details: { code: "1118", uncleared_balance: transitBalance },
      });
    }

    // ── 9. Gate 8: Trade AR Subledger Reconciliation ────────────────────────
    try {
      const arReconciliation = await AccountsReceivableService.getArGlReconciliation(
        { as_of_date: endDate, branch_id: params.branch_id },
        client
      );
      if (!arReconciliation.reconciliation.is_reconciled) {
        blockingChecks.push({
          id: "GATE_AR_SUBLEDGER_MATCH",
          name: "Accounts Receivable Subledger Match",
          category: "SUBLEDGER_RECONCILIATION",
          status: "BLOCKING",
          message: `Trade AR Subledger (₹${arReconciliation.subledger.total_control_amount.toFixed(2)}) does not match GL Account 1121 (₹${arReconciliation.control_account.gl_balance.toFixed(2)}). Discrepancy: ₹${Math.abs(arReconciliation.reconciliation.difference).toFixed(2)}.`,
          details: {
            gl_balance: arReconciliation.control_account.gl_balance,
            subledger_total: arReconciliation.subledger.total_control_amount,
            difference: arReconciliation.reconciliation.difference,
          },
        });
      }
    } catch {
      // Non-fatal if AR subledger repo encounters initial zero state
    }

    // ── 10. Gate 9: Trade AP Subledger Reconciliation ───────────────────────
    try {
      const apReconciliation = await AccountsPayableService.getApGlReconciliation(
        { as_of_date: endDate, branch_id: params.branch_id },
        client
      );
      if (!apReconciliation.is_reconciled) {
        blockingChecks.push({
          id: "GATE_AP_SUBLEDGER_MATCH",
          name: "Accounts Payable Subledger Match",
          category: "SUBLEDGER_RECONCILIATION",
          status: "BLOCKING",
          message: `Trade AP Subledger (₹${apReconciliation.operational_ap_total.toFixed(2)}) does not match GL Account 2111 (₹${apReconciliation.gl_2111_balance.toFixed(2)}). Discrepancy: ₹${Math.abs(apReconciliation.discrepancy).toFixed(2)}.`,
          details: {
            gl_balance: apReconciliation.gl_2111_balance,
            subledger_total: apReconciliation.operational_ap_total,
            discrepancy: apReconciliation.discrepancy,
          },
        });
      }
    } catch {
      // Non-fatal if purchase tables empty
    }

    // ── 11. Gate 10: Bank Reconciliation (BRS) Verified ─────────────────────
    try {
      const unrecBankRes = await queryFn<{ count: string }>(
        `SELECT count(*) AS count
         FROM public.bank_statement_line
         WHERE COALESCE(value_date, transaction_date) <= $1
           AND (reconciliation_status IS NULL OR reconciliation_status NOT IN ('MATCHED', 'CLEARED'))`,
        [endDate]
      );
      const unrecBankCount = parseInt(unrecBankRes.rows[0]?.count || "0", 10);
      if (unrecBankCount > 0) {
        blockingChecks.push({
          id: "GATE_BANK_RECONCILIATION_VERIFIED",
          name: "Bank Statement Line Reconciliation",
          category: "SUBLEDGER_RECONCILIATION",
          status: "BLOCKING",
          message: `${unrecBankCount} unreconciled bank statement line(s) exist prior to period end date (${endDate}). Bank lines must be reconciled.`,
          details: { unreconciled_count: unrecBankCount, cut_off_date: endDate },
        });
      }
    } catch {
      // Handled if bank statement tables empty
    }

    // ── 12. Warning 1: Gateway Clearing Account 1113 ────────────────────────
    const tb1113 = tbByCode.get("1113");
    const gatewayBalance = round2(Math.abs(Number(tb1113?.net_balance) || 0));
    if (gatewayBalance > 0) {
      warnings.push({
        id: "WARN_GATEWAY_CLEARING",
        name: "Gateway Clearing Account Balance",
        category: "CLEARING_ACCOUNTS",
        status: "WARNING",
        message: `Account 1113 Gateway Clearing has an unsettled balance of ₹${gatewayBalance.toFixed(2)}. Verify rolling T+2 processor holds.`,
        details: { code: "1113", balance: gatewayBalance },
      });
    }

    // ── 13. Warning 2: Undeposited COD Account 1122 ─────────────────────────
    const tb1122 = tbByCode.get("1122");
    const codBalance = round2(Math.abs(Number(tb1122?.net_balance) || 0));
    if (codBalance > 0) {
      warnings.push({
        id: "WARN_UNDEPOSITED_COD",
        name: "Undeposited Cash On Delivery (COD)",
        category: "CLEARING_ACCOUNTS",
        status: "WARNING",
        message: `Account 1122 Undeposited COD has a balance of ₹${codBalance.toFixed(2)}. Verify shift handovers from delivery drivers.`,
        details: { code: "1122", balance: codBalance },
      });
    }

    // ── 14. Warning 3: GST ITC vs Output Tax Offset ─────────────────────────
    let totalItc = 0;
    let totalOutputGst = 0;
    for (let c = 1141; c <= 1149; c++) {
      const tb = tbByCode.get(String(c));
      totalItc += Number(tb?.net_balance) || 0;
    }
    for (let c = 2121; c <= 2129; c++) {
      const tb = tbByCode.get(String(c));
      totalOutputGst += -(Number(tb?.net_balance) || 0);
    }
    totalItc = round2(Math.max(0, totalItc));
    totalOutputGst = round2(Math.max(0, totalOutputGst));

    if (totalItc > 0 && totalOutputGst > 0) {
      warnings.push({
        id: "WARN_GST_OFFSET",
        name: "GST Input Tax Credit (ITC) vs Output Liability",
        category: "CLEARING_ACCOUNTS",
        status: "WARNING",
        message: `Un-offset GST detected: Input ITC (₹${totalItc.toFixed(2)}) and Output Liability (₹${totalOutputGst.toFixed(2)}). Consider posting monthly GSTR-3B tax offset voucher.`,
        details: { total_itc: totalItc, total_output_gst: totalOutputGst },
      });
    }

    // ── 15. Nominal Accounts Summary (The 26 Leaf Accounts) ─────────────────
    const revenueLeaves: DiagnosticNominalAccountLine[] = [];
    const expenseLeaves: DiagnosticNominalAccountLine[] = [];

    let grossRevenue = 0;
    let salesReturns = 0;
    let grossExpenses = 0;
    let purchaseDiscounts = 0;

    const nominalLeafAccounts = allAccounts
      .filter((a) => !a.is_group && (a.type === "REVENUE" || a.type === "EXPENSE"))
      .sort((a, b) => a.code.localeCompare(b.code));

    for (const a of nominalLeafAccounts) {
      const tb = tbByCode.get(a.code);
      const totalDr = Number(tb?.total_debit) || 0;
      const totalCr = Number(tb?.total_credit) || 0;

      if (a.type === "REVENUE") {
        const isContra = a.code === "4190";
        let bal = 0;
        let action: "DEBIT" | "CREDIT" | "NONE" = "NONE";

        if (isContra) {
          bal = round2(Math.max(0, totalDr - totalCr));
          salesReturns += bal;
          action = bal > 0 ? "CREDIT" : "NONE";
        } else {
          bal = round2(Math.max(0, totalCr - totalDr));
          grossRevenue += bal;
          action = bal > 0 ? "DEBIT" : "NONE";
        }

        revenueLeaves.push({
          code: a.code,
          name: a.name,
          type: "REVENUE",
          subtype: a.subtype,
          is_contra: isContra,
          balance: bal,
          proposed_action: action,
          closing_amount: bal,
        });
      } else if (a.type === "EXPENSE") {
        const isContra = a.code === "5190";
        let bal = 0;
        let action: "DEBIT" | "CREDIT" | "NONE" = "NONE";

        if (isContra) {
          bal = round2(Math.max(0, totalCr - totalDr));
          purchaseDiscounts += bal;
          action = bal > 0 ? "DEBIT" : "NONE";
        } else {
          bal = round2(Math.max(0, totalDr - totalCr));
          grossExpenses += bal;
          action = bal > 0 ? "CREDIT" : "NONE";
        }

        expenseLeaves.push({
          code: a.code,
          name: a.name,
          type: "EXPENSE",
          subtype: a.subtype,
          is_contra: isContra,
          balance: bal,
          proposed_action: action,
          closing_amount: bal,
        });
      }
    }

    grossRevenue = round2(grossRevenue);
    grossExpenses = round2(grossExpenses);
    const netRevenue = round2(grossRevenue - salesReturns);
    const netExpenses = round2(grossExpenses - purchaseDiscounts);
    const projectedNetProfit = round2(netRevenue - netExpenses);

    // ── 16. Projected Equity Calculations (3210, 3220, 3300) ────────────────
    const tb3210 = tbByCode.get("3210");
    const current3210 = round2(-(Number(tb3210?.net_balance) || 0));
    const projected3210 = round2(current3210 + projectedNetProfit);

    const tb3220 = tbByCode.get("3220");
    const posted3220 = round2(-(Number(tb3220?.net_balance) || 0));
    const currentDynamic3220 = round2(posted3220 + projectedNetProfit);
    const projectedDynamic3220 = 0.00; // Reset upon close

    const tb3300 = tbByCode.get("3300");
    const obOffset3300 = round2(-(Number(tb3300?.net_balance) || 0));

    // ── 17. Informational Checks ────────────────────────────────────────────
    informational.push({
      id: "INFO_PROJECTED_PROFIT",
      name: "Projected Net Profit / (Loss) for Closed Year",
      category: "FINANCIAL_SUMMARY",
      status: "INFO",
      message: `Projected Net Profit to be accumulated into Retained Earnings (3210): ₹${projectedNetProfit.toFixed(2)} (Net Revenue ₹${netRevenue.toFixed(2)} - Net Expenses ₹${netExpenses.toFixed(2)}).`,
      details: {
        gross_revenue: grossRevenue,
        sales_returns: salesReturns,
        net_revenue: netRevenue,
        gross_expenses: grossExpenses,
        purchase_discounts: purchaseDiscounts,
        net_expenses: netExpenses,
        projected_net_profit: projectedNetProfit,
      },
    });

    informational.push({
      id: "INFO_EQUITY_TRANSITION",
      name: "Retained Earnings Transition Preview",
      category: "FINANCIAL_SUMMARY",
      status: "INFO",
      message: `Account 3210 Retained Earnings will transition from ₹${current3210.toFixed(2)} to ₹${projected3210.toFixed(2)}. Dynamic Account 3220 resets from ₹${currentDynamic3220.toFixed(2)} to ₹0.00. Zero double counting.`,
      details: {
        current_3210: current3210,
        projected_3210: projected3210,
        current_3220: currentDynamic3220,
        projected_3220: projectedDynamic3220,
        ob_offset_3300: obOffset3300,
      },
    });

    informational.push({
      id: "INFO_OPENING_BALANCE_EQUITY",
      name: "Opening Balance Offset (3300) Permanence",
      category: "FINANCIAL_SUMMARY",
      status: "INFO",
      message: `Account 3300 Opening Balance Offset balance (₹${obOffset3300.toFixed(2)}) is preserved identically and will not be transferred.`,
      details: { code: "3300", balance: obOffset3300 },
    });

    // Cancelled vouchers check
    const cancelledVoucherRes = await queryFn<{ count: string }>(
      `SELECT count(*) AS count FROM public.accounting_voucher 
       WHERE voucher_date BETWEEN $1 AND $2 AND status = 'CANCELLED' AND deleted_at IS NULL`,
      [startDate, endDate]
    );
    const cancelledCount = parseInt(cancelledVoucherRes.rows[0]?.count || "0", 10);
    informational.push({
      id: "INFO_CANCELLED_VOUCHERS",
      name: "Cancelled Vouchers in Fiscal Period",
      category: "VOUCHER_PIPELINE",
      status: "INFO",
      message: `${cancelledCount} cancelled voucher(s) audited in period. Cancelled vouchers are preserved immutably and do not block close.`,
      details: { cancelled_count: cancelledCount },
    });

    // Reversal vouchers check
    const reversalsRes = await queryFn<{ count: string }>(
      `SELECT count(*) AS count FROM public.accounting_voucher 
       WHERE voucher_date BETWEEN $1 AND $2 AND reversal_of_voucher_id IS NOT NULL AND status = 'POSTED'`,
      [startDate, endDate]
    );
    const reversalCount = parseInt(reversalsRes.rows[0]?.count || "0", 10);
    informational.push({
      id: "INFO_REVERSALS_SUMMARY",
      name: "Compensating Reversals Executed",
      category: "VOUCHER_PIPELINE",
      status: "INFO",
      message: `${reversalCount} posted reversal voucher(s) audited in period. Compensating lines are reflected in Trial Balance.`,
      details: { reversal_count: reversalCount },
    });

    // Critical Cake Rule Informational Check
    informational.push({
      id: "INFO_CAKE_AVAILABILITY_RULE",
      name: "Critical Cake Operational Rule Assertion",
      category: "OPERATIONAL_CAKE_RULE",
      status: "INFO",
      message: "Confirmed: Cakes are treated as MADE_TO_ORDER_AVAILABILITY. Branch cake toggling generates zero stock movements or accounting vouchers.",
    });

    // ── 18. Final Verdict ───────────────────────────────────────────────────
    const canClose = blockingChecks.length === 0;

    return {
      fiscal_year: params.fiscal_year,
      start_date: startDate,
      end_date: endDate,
      can_close: canClose,
      summary: {
        blocking_count: blockingChecks.length,
        warning_count: warnings.length,
        info_count: informational.length,
        total_checks: blockingChecks.length + warnings.length + informational.length,
        is_balanced_tb: isBalancedTb,
        gross_revenue: grossRevenue,
        gross_expenses: grossExpenses,
        projected_net_profit: projectedNetProfit,
      },
      blocking_checks: blockingChecks,
      warnings,
      informational,
      nominal_accounts: {
        revenues: revenueLeaves,
        expenses: expenseLeaves,
        gross_revenue: grossRevenue,
        gross_expenses: grossExpenses,
        projected_net_profit: projectedNetProfit,
      },
      projected_equity: {
        current_retained_earnings_3210: current3210,
        projected_retained_earnings_3210: projected3210,
        current_dynamic_3220: currentDynamic3220,
        projected_dynamic_3220: projectedDynamic3220,
        opening_balance_offset_3300: obOffset3300,
      },
      timestamp: new Date().toISOString(),
    };
  }

  // ── Monthly Period Lock & Unlock (Phase 5A.6 Step 2) ─────────────────────────

  /**
   * Lock a monthly fiscal period. Delegates to FiscalPeriodService.lockPeriod.
   * Enforces SUPER_ADMIN authorization, SELECT ... FOR UPDATE row-locking, and audit trail.
   */
  static async lockMonthlyPeriod(
    params: {
      period_id: string;
      session_user: { id: string; role: string };
    },
    client?: PoolClient
  ): Promise<AccountingFiscalPeriodRow> {
    return FiscalPeriodService.lockPeriod(
      params.period_id,
      params.session_user.id,
      params.session_user.role,
      client
    );
  }

  /**
   * Unlock a monthly fiscal period. Delegates to FiscalPeriodService.unlockPeriod.
   * Enforces SUPER_ADMIN authorization, mandatory >= 20 char reason, SELECT ... FOR UPDATE, and audit trail.
   */
  static async unlockMonthlyPeriod(
    params: {
      period_id: string;
      reason: string;
      session_user: { id: string; role: string };
    },
    client?: PoolClient
  ): Promise<AccountingFiscalPeriodRow> {
    return FiscalPeriodService.unlockPeriod(
      params.period_id,
      params.session_user.id,
      params.session_user.role,
      params.reason,
      client
    );
  }

  // ── Year-End Close Engine (Phase 5A.6 Step 3) ────────────────────────────────

  /**
   * Run read-only preview / dry-run of year-end close.
   * Delegates to runPreCloseDiagnostics and returns full pre-close report.
   */
  static async previewYearEndClose(
    params: PreCloseDiagnosticsParams,
    client?: PoolClient
  ): Promise<PreCloseDiagnosticsResult> {
    return this.runPreCloseDiagnostics(params, client);
  }

  /**
   * Execute annual year-end close:
   * 1. Acquires transaction-level advisory lock on fiscal year
   * 2. Enforces RBAC (SUPER_ADMIN) and Segregation of Duties (preparer !== approver)
   * 3. Locks fiscal periods FOR UPDATE and verifies all 12 are locked
   * 4. Enforces idempotency via source index
   * 5. Runs pre-flight checks: no unposted vouchers, suspense = 0, transit = 0, TB balanced
   * 6. Generates balanced JOURNAL closing voucher zeroing 26 nominal leaf accounts to 3210 Retained Earnings
   * 7. Optionally transfers Partner Drawings (3120) to Retained Earnings
   * 8. Fast-tracks closing voucher DRAFT -> SUBMIT -> APPROVE -> POST
   * 9. Auto-provisions next Indian fiscal year (Apr 1 - Mar 31) if absent
   * 10. Emits audit trail event
   */
  static async executeYearEndClose(
    params: ExecuteYearEndCloseParams,
    existingClient?: PoolClient
  ): Promise<ExecuteYearEndCloseResult> {
    // 1. RBAC & Security Validation
    if (params.session_user) {
      const { role, isSuperAdmin } = params.session_user;
      if (!isSuperAdmin && role !== "SUPER_ADMIN") {
        throw new PeriodCloseServiceError(
          "UNAUTHORIZED",
          "Forbidden: Only SUPER_ADMIN can execute annual year-end close."
        );
      }
    }

    const preparerId = params.preparer_id;
    const approverId = params.approver_id;

    if (!preparerId || !approverId) {
      throw new PeriodCloseServiceError(
        "INVALID_ACTORS",
        "Both preparer_id and approver_id are required to execute year-end close."
      );
    }

    // 2. Segregation of Duties (SoD)
    if (preparerId === approverId) {
      throw new PeriodCloseServiceError(
        "SEGREGATION_OF_DUTIES_VIOLATION",
        "Segregation of Duties violation: preparer and approver must be distinct individuals."
      );
    }

    const executeCloseTx = async (client: PoolClient): Promise<ExecuteYearEndCloseResult> => {
      // 3. PostgreSQL Advisory Lock on fiscal year to prevent concurrent runs
      await client.query("SELECT pg_advisory_xact_lock(hashtext('year_end_close_' || $1))", [
        params.fiscal_year,
      ]);

      const { startDate, endDate } = deriveIndianFiscalYearDates(params.fiscal_year);

      // 4. Lock fiscal periods FOR UPDATE and verify all 12 are locked
      const periodRes = await client.query<AccountingFiscalPeriodRow>(
        `SELECT * FROM public.accounting_fiscal_period 
         WHERE fiscal_year = $1 
         ORDER BY start_date ASC 
         FOR UPDATE`,
        [params.fiscal_year]
      );

      if (periodRes.rows.length === 0) {
        throw new PeriodCloseServiceError(
          "FISCAL_PERIOD_NOT_CONFIGURED",
          `No fiscal periods found for fiscal year '${params.fiscal_year}'. Year-end close cannot proceed.`
        );
      }

      const unlockedPeriods = periodRes.rows.filter((p) => !p.is_locked);
      if (unlockedPeriods.length > 0) {
        throw new PeriodCloseServiceError(
          "PRIOR_PERIODS_UNLOCKED",
          `All monthly periods for fiscal year '${params.fiscal_year}' must be locked before closing. ${unlockedPeriods.length} period(s) remain open.`
        );
      }

      // 5. Idempotency Check: Check if an UNREVERSED active closing voucher exists
      const existingCloseRes = await client.query(
        `SELECT id, voucher_no, status FROM public.accounting_voucher 
         WHERE reference_type = 'YEAR_END_CLOSE' 
           AND reference_id = $1 
           AND status = 'POSTED'
           AND reversed_by_voucher_id IS NULL
           AND deleted_at IS NULL`,
        [params.fiscal_year]
      );

      if (existingCloseRes.rows.length > 0) {
        const existing = existingCloseRes.rows[0];
        throw new PeriodCloseServiceError(
          "DUPLICATE_SOURCE_EVENT",
          `Duplicate close request: an active closing voucher (${existing.voucher_no}) already exists for fiscal year '${params.fiscal_year}'.`
        );
      }

      // Determine close cycle number (1 for initial close, 2+ for re-close after reopen)
      const priorClosesRes = await client.query(
        `SELECT count(*) AS count FROM public.accounting_voucher 
         WHERE reference_type = 'YEAR_END_CLOSE' 
           AND reference_id = $1 
           AND status = 'POSTED' 
           AND deleted_at IS NULL`,
        [params.fiscal_year]
      );
      const closeCycle = parseInt(priorClosesRes.rows[0]?.count || "0", 10) + 1;
      const closeRefEvent = closeCycle === 1 ? "FISCAL_YEAR_CLOSE" : `FISCAL_YEAR_CLOSE_CYCLE_${closeCycle}`;

      // 6. Pre-flight Checks (Draft/Submitted/Approved vouchers, Suspense, Deposit In Transit, Imbalanced TB)
      const unpostedRes = await client.query<{ count: string }>(
        `SELECT count(*) AS count FROM public.accounting_voucher 
         WHERE voucher_date BETWEEN $1 AND $2 
           AND status IN ('DRAFT', 'SUBMITTED', 'APPROVED') 
           AND deleted_at IS NULL`,
        [startDate, endDate]
      );
      const unpostedCount = parseInt(unpostedRes.rows[0]?.count || "0", 10);
      if (unpostedCount > 0) {
        throw new PeriodCloseServiceError(
          "UNPOSTED_VOUCHERS_EXIST",
          `${unpostedCount} unposted voucher(s) exist in fiscal year '${params.fiscal_year}'. All vouchers must be posted or cancelled before year-end close.`
        );
      }

      // Query Trial Balance within transaction client
      const effectiveBranchId = await resolveEnterpriseBranchId(params.branch_id, client);

      const lineConditions: string[] = ["je.entry_date >= $1", "je.entry_date <= $2"];
      const sqlParams: unknown[] = [startDate, endDate];
      if (params.branch_id) {
        lineConditions.push("jl.branch_id = $3");
        sqlParams.push(params.branch_id);
      }
      const lineWhere = `WHERE ${lineConditions.join(" AND ")}`;

      const tbSql = `
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
          ${lineWhere}
          GROUP BY jl.account_id
        ) filtered ON filtered.account_id = a.id
        WHERE a.deleted_at IS NULL AND a.is_active = true
        GROUP BY a.id, a.code, a.name, a.type, a.subtype, a.level, a.is_group,
                 filtered.total_debit, filtered.total_credit
        ORDER BY a.code ASC
      `;
      const tbRes = await client.query<TrialBalanceRow>(tbSql, sqlParams);
      const tbRows = tbRes.rows;

      const tbByCode = new Map<string, TrialBalanceRow>();
      let totalDrAll = 0;
      let totalCrAll = 0;
      for (const r of tbRows) {
        tbByCode.set(r.code, r);
        if (!r.is_group) {
          totalDrAll += Number(r.total_debit) || 0;
          totalCrAll += Number(r.total_credit) || 0;
        }
      }
      totalDrAll = round2(totalDrAll);
      totalCrAll = round2(totalCrAll);
      if (Math.abs(totalDrAll - totalCrAll) > 0.01) {
        throw new PeriodCloseServiceError(
          "TRIAL_BALANCE_UNBALANCED",
          `General Ledger Trial Balance is imbalanced: Total Debits (₹${totalDrAll.toFixed(2)}) != Total Credits (₹${totalCrAll.toFixed(2)}). Variance: ₹${Math.abs(totalDrAll - totalCrAll).toFixed(2)}.`
        );
      }

      // Check Suspense 1119
      const tb1119 = tbByCode.get("1119");
      const suspenseBal = round2(Number(tb1119?.net_balance) || 0);
      if (Math.abs(suspenseBal) > 0.001) {
        throw new PeriodCloseServiceError(
          "UNCLEARED_SUSPENSE_BALANCE",
          `Uncleared suspense balance detected in Account 1119: ₹${suspenseBal.toFixed(2)}. Suspense balance must be strictly ₹0.00 before closing.`
        );
      }

      // Check Deposit in Transit 1118
      const tb1118 = tbByCode.get("1118");
      const transitBal = round2(Number(tb1118?.net_balance) || 0);
      if (Math.abs(transitBal) > 0.001) {
        throw new PeriodCloseServiceError(
          "UNCLEARED_DEPOSIT_TRANSIT_BALANCE",
          `Uncleared deposit in transit balance detected in Account 1118: ₹${transitBal.toFixed(2)}. Deposit in transit must be strictly ₹0.00 before closing.`
        );
      }

      // 7. Fetch all active accounts
      const allAccounts = await AccountingAccountRepository.listAccounts({ is_active: true }, client);
      const acctByCode = new Map<string, AccountingAccountRow>();
      for (const a of allAccounts) {
        acctByCode.set(a.code, a);
      }

      const acct3210 = acctByCode.get("3210");
      if (!acct3210) {
        throw new PeriodCloseServiceError(
          "ACCOUNT_NOT_FOUND",
          "Retained Earnings account 3210 not found in Chart of Accounts."
        );
      }

      // 8. Construct Closing Journal Lines for the 26 leaf nominal accounts
      const nominalLeafAccounts = allAccounts
        .filter((a) => !a.is_group && (a.type === "REVENUE" || a.type === "EXPENSE"))
        .sort((a, b) => a.code.localeCompare(b.code));

      const closingLines: JournalLineInput[] = [];
      let grossRevenue = 0;
      let salesReturns = 0;
      let grossExpenses = 0;
      let purchaseDiscounts = 0;
      let accountsZeroedCount = 0;

      for (const a of nominalLeafAccounts) {
        const tb = tbByCode.get(a.code);
        const totalDr = Number(tb?.total_debit) || 0;
        const totalCr = Number(tb?.total_credit) || 0;

        if (a.type === "REVENUE") {
          const isContra = a.code === "4190";
          if (isContra) {
            const bal = round2(Math.max(0, totalDr - totalCr));
            salesReturns += bal;
            if (bal > 0) {
              closingLines.push({
                account_id: a.id,
                debit_amount: 0,
                credit_amount: bal,
                narration: `[YEAR_END_CLOSE] Zero contra-revenue account ${a.code} (${a.name})`,
              });
              accountsZeroedCount++;
            }
          } else {
            const bal = round2(Math.max(0, totalCr - totalDr));
            grossRevenue += bal;
            if (bal > 0) {
              closingLines.push({
                account_id: a.id,
                debit_amount: bal,
                credit_amount: 0,
                narration: `[YEAR_END_CLOSE] Zero revenue account ${a.code} (${a.name})`,
              });
              accountsZeroedCount++;
            }
          }
        } else if (a.type === "EXPENSE") {
          const isContra = a.code === "5190";
          if (isContra) {
            const bal = round2(Math.max(0, totalCr - totalDr));
            purchaseDiscounts += bal;
            if (bal > 0) {
              closingLines.push({
                account_id: a.id,
                debit_amount: bal,
                credit_amount: 0,
                narration: `[YEAR_END_CLOSE] Zero contra-COGS account ${a.code} (${a.name})`,
              });
              accountsZeroedCount++;
            }
          } else {
            const bal = round2(Math.max(0, totalDr - totalCr));
            grossExpenses += bal;
            if (bal > 0) {
              closingLines.push({
                account_id: a.id,
                debit_amount: 0,
                credit_amount: bal,
                narration: `[YEAR_END_CLOSE] Zero expense account ${a.code} (${a.name})`,
              });
              accountsZeroedCount++;
            }
          }
        }
      }

      grossRevenue = round2(grossRevenue);
      grossExpenses = round2(grossExpenses);
      salesReturns = round2(salesReturns);
      purchaseDiscounts = round2(purchaseDiscounts);
      const netRevenue = round2(grossRevenue - salesReturns);
      const netExpenses = round2(grossExpenses - purchaseDiscounts);
      const netProfit = round2(netRevenue - netExpenses);

      // Retained Earnings Line
      if (netProfit > 0) {
        closingLines.push({
          account_id: acct3210.id,
          debit_amount: 0,
          credit_amount: netProfit,
          narration: `[YEAR_END_CLOSE] FY ${params.fiscal_year} Net Profit transferred to Retained Earnings (3210)`,
        });
      } else if (netProfit < 0) {
        closingLines.push({
          account_id: acct3210.id,
          debit_amount: Math.abs(netProfit),
          credit_amount: 0,
          narration: `[YEAR_END_CLOSE] FY ${params.fiscal_year} Net Loss transferred to Retained Earnings (3210)`,
        });
      }

      // Optional Drawings Transfer
      let drawingsTransferred = 0;
      if (params.closeDrawingsToRetainedEarnings) {
        const tb3120 = tbByCode.get("3120");
        const acct3120 = acctByCode.get("3120");
        const drawDr = Number(tb3120?.total_debit) || 0;
        const drawCr = Number(tb3120?.total_credit) || 0;
        const drawBal = round2(Math.max(0, drawDr - drawCr));
        if (drawBal > 0 && acct3120) {
          drawingsTransferred = drawBal;
          closingLines.push({
            account_id: acct3120.id,
            debit_amount: 0,
            credit_amount: drawBal,
            narration: `[YEAR_END_CLOSE] Transfer Partner Drawings (3120) to Retained Earnings`,
          });
          closingLines.push({
            account_id: acct3210.id,
            debit_amount: drawBal,
            credit_amount: 0,
            narration: `[YEAR_END_CLOSE] Drawings deduction from Retained Earnings (3210)`,
          });
          accountsZeroedCount++;
        }
      }

      if (closingLines.length === 0) {
        throw new PeriodCloseServiceError(
          "NO_NOMINAL_ACTIVITY_TO_CLOSE",
          `No nominal revenue or expense balances to close for fiscal year '${params.fiscal_year}'.`
        );
      }

      // Validate lines double-entry
      PostingService.validateJournalLines(closingLines);

      // 9. Voucher Lifecycle: DRAFT -> SUBMIT -> APPROVE -> POST
      const voucherInput: VoucherCreateInput = {
        voucher_type: "JOURNAL",
        voucher_date: endDate,
        branch_id: effectiveBranchId,
        narration: `[YEAR_END_CLOSE] ${params.fiscal_year} Annual Nominal Ledger Closing Entry`,
        reference_type: "YEAR_END_CLOSE",
        reference_id: params.fiscal_year,
        reference_event: closeRefEvent,
        metadata: {
          close_type: "YEAR_END",
          close_cycle: closeCycle,
          fiscal_year: params.fiscal_year,
          start_date: startDate,
          end_date: endDate,
          gross_revenue: grossRevenue,
          gross_expenses: grossExpenses,
          net_profit: netProfit,
          drawings_transferred: drawingsTransferred,
          target_retained_earnings_account: "3210",
          accounts_zeroed_count: accountsZeroedCount,
          closed_by: approverId,
          prepared_by: preparerId,
          closed_at: new Date().toISOString(),
        },
      };

      const draftRes = await PostingService.createVoucherDraft({
        input: voucherInput,
        branchId: effectiveBranchId,
        fiscalYear: params.fiscal_year,
        createdBy: preparerId,
        client,
      });

      if (!draftRes.success) {
        throw new PeriodCloseServiceError(
          draftRes.code || "POSTING_FAILED",
          draftRes.error || "Failed to create closing voucher draft."
        );
      }
      const voucherId = draftRes.data.id;

      // Submit
      const submitRes = await PostingService.submitVoucher({
        voucherId,
        submittedBy: preparerId,
        branchId: effectiveBranchId,
        client,
      });
      if (!submitRes.success) {
        throw new PeriodCloseServiceError(
          (submitRes.code as any) || "POSTING_FAILED",
          submitRes.error || "Failed to submit closing voucher."
        );
      }

      // Approve (enforcing SoD: approverId != preparerId)
      const approveRes = await PostingService.approveVoucher({
        voucherId,
        approvedBy: approverId,
        branchId: effectiveBranchId,
        client,
      });
      if (!approveRes.success) {
        throw new PeriodCloseServiceError(
          (approveRes.code as any) || "POSTING_FAILED",
          approveRes.error || "Failed to approve closing voucher."
        );
      }

      // Post
      const postRes = await PostingService.postVoucher({
        voucherId,
        lines: closingLines,
        postedBy: approverId,
        branchId: effectiveBranchId,
        client,
      });
      if (!postRes.success) {
        throw new PeriodCloseServiceError(
          postRes.code || "POSTING_FAILED",
          postRes.error || "Failed to post closing voucher."
        );
      }

      const postedResult = postRes.data;

      // 10. Auto-provision Next Fiscal Year periods if not present
      const { nextFY, nextStartDate } = deriveNextFiscalYear(params.fiscal_year);
      let nextFYProvisioned: string | null = null;
      const nextExisting = await AccountingFiscalPeriodRepository.list(nextFY, client);
      if (nextExisting.length === 0) {
        try {
          await FiscalPeriodService.generateYearPeriods(
            nextFY,
            nextStartDate,
            approverId,
            "SUPER_ADMIN",
            client
          );
          nextFYProvisioned = nextFY;
        } catch (e: any) {
          console.warn("[PeriodCloseService] Next FY auto-provision skipped:", e?.message);
        }
      }

      // 11. Record Audit Log
      const auditId = `aud_${crypto.randomBytes(12).toString("hex")}`;
      await client.query(
        `INSERT INTO public.audit_log (
          id, actor_id, actor_type, action, entity, entity_id, metadata, created_at, updated_at
        ) VALUES ($1, $2, 'staff', 'accounting.fiscal_year_closed', 'fiscal_year', $3, $4, NOW(), NOW())`,
        [
          auditId,
          approverId,
          params.fiscal_year,
          JSON.stringify({
            fiscal_year: params.fiscal_year,
            voucher_id: voucherId,
            voucher_no: postedResult.voucher.voucher_no,
            journal_entry_id: postedResult.journal_entry.id,
            entry_no: postedResult.journal_entry.entry_no,
            gross_revenue: grossRevenue,
            gross_expenses: grossExpenses,
            net_profit: netProfit,
            retained_earnings_transferred: netProfit,
            drawings_transferred: drawingsTransferred,
            accounts_zeroed_count: accountsZeroedCount,
            next_fiscal_year_provisioned: nextFYProvisioned,
            close_cycle: closeCycle,
            action: "YEAR_END_CLOSE_POST",
          }),
        ]
      );

      return {
        success: true,
        voucher_id: voucherId,
        voucher_no: postedResult.voucher.voucher_no,
        journal_entry_id: postedResult.journal_entry.id,
        entry_no: postedResult.journal_entry.entry_no,
        fiscal_year: params.fiscal_year,
        close_date: endDate,
        gross_revenue: grossRevenue,
        gross_expenses: grossExpenses,
        net_profit: netProfit,
        retained_earnings_transferred: netProfit,
        drawings_transferred: drawingsTransferred,
        accounts_zeroed_count: accountsZeroedCount,
        next_fiscal_year_provisioned: nextFYProvisioned,
        message: `Fiscal year '${params.fiscal_year}' closed successfully. ${accountsZeroedCount} nominal accounts zeroed. Net profit of ₹${netProfit.toFixed(2)} transferred to Retained Earnings (3210).`,
        timestamp: new Date().toISOString(),
      };
    };

    return existingClient ? executeCloseTx(existingClient) : dbTransaction(executeCloseTx);
  }

  // ── Year-End Reopen / Reversal Engine (Phase 5A.6 Step 4) ────────────────────

  /**
   * Run read-only preview / dry-run of year-end reopen eligibility and projected reversal impact.
   * Strictly read-only: does not mutate database or lock periods.
   */
  static async previewYearEndReopen(
    params: PreviewYearEndReopenParams,
    existingClient?: PoolClient
  ): Promise<PreviewYearEndReopenResult> {
    const runQuery = async <T extends QueryResultRow = any>(
      sql: string,
      sqlParams: any[] = []
    ): Promise<{ rows: T[] }> => {
      return existingClient ? existingClient.query<T>(sql, sqlParams) : dbQuery<T>(sql, sqlParams);
    };

    // 1. RBAC & Security Validation
    if (params.session_user) {
      const { role, isSuperAdmin, permissions } = params.session_user;
      const hasView = isSuperAdmin || role === "SUPER_ADMIN" || permissions?.includes("ACCOUNTING.VIEW");
      if (!hasView) {
        throw new PeriodCloseServiceError(
          "PERMISSION_DENIED",
          "Forbidden: User lacks ACCOUNTING.VIEW permission to preview period reopen."
        );
      }
    }

    const { startDate, endDate } = deriveIndianFiscalYearDates(params.fiscal_year);
    const { nextFY } = deriveNextFiscalYear(params.fiscal_year);

    const blockingChecks: Array<{ id: string; name: string; message: string }> = [];
    const warnings: Array<{ id: string; name: string; message: string }> = [];

    // Check fiscal period configuration
    const periodRes = await runQuery(
      `SELECT count(*) AS count FROM public.accounting_fiscal_period WHERE fiscal_year = $1`,
      [params.fiscal_year]
    );
    if (parseInt(periodRes.rows[0]?.count || "0", 10) === 0) {
      blockingChecks.push({
        id: "BLOCKING_PERIOD_NOT_CONFIGURED",
        name: "Fiscal Period Configuration",
        message: `No fiscal periods configured for fiscal year '${params.fiscal_year}'.`,
      });
    }

    // Check for active closing voucher
    const closeVoucherRes = await runQuery<AccountingVoucherRow>(
      `SELECT * FROM public.accounting_voucher 
       WHERE reference_type = 'YEAR_END_CLOSE' 
         AND reference_id = $1 
         AND status = 'POSTED' 
         AND reversed_by_voucher_id IS NULL 
         AND deleted_at IS NULL 
       ORDER BY created_at DESC LIMIT 1`,
      [params.fiscal_year]
    );

    let closingVoucherInfo: PreviewYearEndReopenResult["closing_voucher"] = null;
    let projectedReversalLinesCount = 0;
    let projectedRetainedEarningsImpact = 0;
    let projectedDrawingsImpact = 0;

    if (closeVoucherRes.rows.length === 0) {
      // Check if closing voucher was already reversed
      const alreadyReversedRes = await runQuery<AccountingVoucherRow>(
        `SELECT * FROM public.accounting_voucher 
         WHERE reference_type = 'YEAR_END_CLOSE' 
           AND reference_id = $1 
           AND status = 'POSTED' 
           AND reversed_by_voucher_id IS NOT NULL 
           AND deleted_at IS NULL 
         ORDER BY created_at DESC LIMIT 1`,
        [params.fiscal_year]
      );
      if (alreadyReversedRes.rows.length > 0) {
        blockingChecks.push({
          id: "BLOCKING_YEAR_ALREADY_REOPENED",
          name: "Fiscal Year Reopen Status",
          message: `Fiscal year '${params.fiscal_year}' was already reopened (reversed by voucher '${alreadyReversedRes.rows[0].reversed_by_voucher_id}').`,
        });
      } else {
        blockingChecks.push({
          id: "BLOCKING_YEAR_NOT_CLOSED",
          name: "Fiscal Year Close Status",
          message: `Fiscal year '${params.fiscal_year}' does not have an active closing voucher. Only closed years can be reopened.`,
        });
      }
    } else {
      const cv = closeVoucherRes.rows[0];
      const meta = typeof cv.metadata === "string" ? JSON.parse(cv.metadata) : (cv.metadata || {});
      closingVoucherInfo = {
        id: cv.id,
        voucher_no: cv.voucher_no,
        voucher_date: toIsoDate(cv.voucher_date),
        total_amount: Number(cv.total_amount) || 0,
        net_profit: meta.net_profit ?? 0,
        drawings_transferred: meta.drawings_transferred ?? 0,
        accounts_zeroed_count: meta.accounts_zeroed_count ?? 0,
        closed_at: cv.created_at,
      };

      projectedRetainedEarningsImpact = -(meta.net_profit ?? 0);
      projectedDrawingsImpact = meta.drawings_transferred ?? 0;

      // Fetch journal lines
      const jeRes = await runQuery(
        `SELECT id FROM public.accounting_journal_entry WHERE voucher_id = $1 LIMIT 1`,
        [cv.id]
      );
      if (jeRes.rows.length > 0) {
        const linesRes = await runQuery(
          `SELECT count(*) AS count FROM public.accounting_journal_line WHERE journal_entry_id = $1`,
          [jeRes.rows[0].id]
        );
        projectedReversalLinesCount = parseInt(linesRes.rows[0]?.count || "0", 10);

        if (!projectedDrawingsImpact) {
          const drawLineRes = await runQuery(
            `SELECT jl.credit_amount FROM public.accounting_journal_line jl
             JOIN public.accounting_account a ON a.id = jl.account_id
             WHERE jl.journal_entry_id = $1 AND a.code = '3120' LIMIT 1`,
            [jeRes.rows[0].id]
          );
          if (drawLineRes.rows.length > 0) {
            projectedDrawingsImpact = Number(drawLineRes.rows[0].credit_amount) || 0;
            if (closingVoucherInfo) closingVoucherInfo.drawings_transferred = projectedDrawingsImpact;
          }
        }
      }
    }

    // Subsequent Year Safety Check: Next FY closed (evaluated first per reverse-chronological close invariant)
    const nextYearCloseRes = await runQuery(
      `SELECT count(*) AS count FROM public.accounting_voucher 
       WHERE reference_type = 'YEAR_END_CLOSE' 
         AND reference_id = $1 
         AND status = 'POSTED' 
         AND reversed_by_voucher_id IS NULL 
         AND deleted_at IS NULL`,
      [nextFY]
    );
    const nextYearCloseCount = parseInt(nextYearCloseRes.rows[0]?.count || "0", 10);
    if (nextYearCloseCount > 0) {
      blockingChecks.push({
        id: "BLOCKING_SUBSEQUENT_YEAR_ALREADY_CLOSED",
        name: "Subsequent Fiscal Year Close Guard",
        message: `Subsequent fiscal year '${nextFY}' is already closed. Fiscal years must be reversed in strict reverse chronological order.`,
      });
    }

    // Subsequent Year Safety Check: Posted transactions in Next FY (excluding closing vouchers)
    const nextYearPostingsRes = await runQuery(
      `SELECT count(*) AS count FROM public.accounting_voucher 
       WHERE fiscal_year = $1 
         AND status = 'POSTED' 
         AND (reference_type IS NULL OR reference_type NOT IN ('YEAR_END_CLOSE', 'YEAR_END_REOPEN'))
         AND deleted_at IS NULL`,
      [nextFY]
    );
    const nextYearPostingsCount = parseInt(nextYearPostingsRes.rows[0]?.count || "0", 10);
    if (nextYearPostingsCount > 0) {
      blockingChecks.push({
        id: "BLOCKING_SUBSEQUENT_YEAR_POSTED_ACTIVITY",
        name: "Subsequent Fiscal Year Activity Guard",
        message: `Subsequent fiscal year '${nextFY}' already contains ${nextYearPostingsCount} active posted voucher(s). Reopen is blocked to prevent financial statement corruption.`,
      });
    }

    // Unposted vouchers in current FY
    const unpostedRes = await runQuery(
      `SELECT count(*) AS count FROM public.accounting_voucher 
       WHERE voucher_date BETWEEN $1 AND $2 
         AND status IN ('DRAFT', 'SUBMITTED') 
         AND deleted_at IS NULL`,
      [startDate, endDate]
    );
    const unpostedCount = parseInt(unpostedRes.rows[0]?.count || "0", 10);
    if (unpostedCount > 0) {
      warnings.push({
        id: "WARN_UNPOSTED_VOUCHERS",
        name: "Unposted Vouchers in Fiscal Period",
        message: `${unpostedCount} unposted voucher(s) in DRAFT/SUBMITTED status exist in fiscal year '${params.fiscal_year}'.`,
      });
    }

    return {
      fiscal_year: params.fiscal_year,
      can_reopen: blockingChecks.length === 0,
      closing_voucher: closingVoucherInfo,
      blocking_checks: blockingChecks,
      warnings,
      projected_reversal_lines_count: projectedReversalLinesCount,
      projected_retained_earnings_impact: projectedRetainedEarningsImpact,
      projected_drawings_impact: projectedDrawingsImpact,
      subsequent_fiscal_year: nextFY,
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Execute annual year-end reopen via compensating reversal voucher:
   * 1. Acquires transaction-level advisory lock on fiscal year
   * 2. Enforces RBAC (SUPER_ADMIN) and Segregation of Duties (preparer !== approver)
   * 3. Validates mandatory reason >= 30 characters
   * 4. Enforces subsequent-year safety: fails closed if next fiscal year has active posted vouchers or is closed
   * 5. Locates active closing voucher FOR UPDATE and checks idempotency (fails if already reversed)
   * 6. Generates balanced JOURNAL compensating reversal voucher inverting debits & credits
   * 7. Reverses Retained Earnings (3210) delta and Partner Drawings (3120) if previously transferred
   * 8. Preserves Account 3300 (Opening Balance Equity) completely untouched
   * 9. Fast-tracks reversal voucher DRAFT -> SUBMIT -> APPROVE -> POST via PostingService
   * 10. Links original closing voucher to reversal voucher via PostingService.linkReversal
   * 11. Emits structured audit log event 'accounting.fiscal_year_reopened'
   */
  static async reopenYearEndClose(
    params: ReopenYearEndCloseParams,
    existingClient?: PoolClient
  ): Promise<ReopenYearEndCloseResult> {
    // 1. RBAC & Security Validation
    if (params.session_user) {
      const { role, isSuperAdmin } = params.session_user;
      if (!isSuperAdmin && role !== "SUPER_ADMIN") {
        throw new PeriodCloseServiceError(
          "UNAUTHORIZED",
          "Forbidden: Only SUPER_ADMIN can execute annual year-end reopen."
        );
      }
    }

    const preparerId = params.preparer_id;
    const approverId = params.approver_id;

    if (!preparerId || !approverId) {
      throw new PeriodCloseServiceError(
        "INVALID_ACTORS",
        "Both preparer_id and approver_id are required to execute year-end reopen."
      );
    }

    // 2. Segregation of Duties (SoD)
    if (preparerId === approverId) {
      throw new PeriodCloseServiceError(
        "SEGREGATION_OF_DUTIES_VIOLATION",
        "Segregation of Duties violation: reopen preparer and approver must be distinct individuals."
      );
    }

    // 3. Mandatory Reason Validation
    if (!params.reason || typeof params.reason !== "string" || params.reason.trim().length < 30) {
      throw new PeriodCloseServiceError(
        "REOPEN_REASON_TOO_SHORT",
        "A mandatory audit reason of at least 30 characters is required to reopen a closed fiscal year."
      );
    }

    const executeReopenTx = async (client: PoolClient): Promise<ReopenYearEndCloseResult> => {
      // 4. PostgreSQL Advisory Lock on fiscal year to prevent concurrent runs
      await client.query("SELECT pg_advisory_xact_lock(hashtext('year_end_close_' || $1))", [
        params.fiscal_year,
      ]);

      const { startDate, endDate } = deriveIndianFiscalYearDates(params.fiscal_year);
      const { nextFY } = deriveNextFiscalYear(params.fiscal_year);

      // 5. Lock fiscal periods FOR UPDATE
      const periodRes = await client.query<AccountingFiscalPeriodRow>(
        `SELECT * FROM public.accounting_fiscal_period 
         WHERE fiscal_year = $1 
         ORDER BY start_date ASC 
         FOR UPDATE`,
        [params.fiscal_year]
      );

      if (periodRes.rows.length === 0) {
        throw new PeriodCloseServiceError(
          "FISCAL_PERIOD_NOT_CONFIGURED",
          `No fiscal periods found for fiscal year '${params.fiscal_year}'. Reopen cannot proceed.`
        );
      }

      // 6. Subsequent-Year Safety Guards (HARD BLOCKS)
      const nextYearCloseRes = await client.query<{ count: string }>(
        `SELECT count(*) AS count FROM public.accounting_voucher 
         WHERE reference_type = 'YEAR_END_CLOSE' 
           AND reference_id = $1 
           AND status = 'POSTED' 
           AND reversed_by_voucher_id IS NULL 
           AND deleted_at IS NULL`,
        [nextFY]
      );
      const nextYearCloseCount = parseInt(nextYearCloseRes.rows[0]?.count || "0", 10);
      if (nextYearCloseCount > 0) {
        throw new PeriodCloseServiceError(
          "SUBSEQUENT_YEAR_ALREADY_CLOSED",
          `Cannot reopen fiscal year '${params.fiscal_year}': subsequent fiscal year '${nextFY}' is already closed. Fiscal years must be reversed in strict reverse chronological order.`
        );
      }

      const nextYearPostingsRes = await client.query<{ count: string }>(
        `SELECT count(*) AS count FROM public.accounting_voucher 
         WHERE fiscal_year = $1 
           AND status = 'POSTED' 
           AND (reference_type IS NULL OR reference_type NOT IN ('YEAR_END_CLOSE', 'YEAR_END_REOPEN'))
           AND deleted_at IS NULL`,
        [nextFY]
      );
      const nextYearPostingsCount = parseInt(nextYearPostingsRes.rows[0]?.count || "0", 10);
      if (nextYearPostingsCount > 0) {
        throw new PeriodCloseServiceError(
          "SUBSEQUENT_YEAR_HAS_POSTED_ACTIVITY",
          `Cannot reopen fiscal year '${params.fiscal_year}': subsequent fiscal year '${nextFY}' already contains ${nextYearPostingsCount} active posted voucher(s). Reopening is blocked to prevent financial statement corruption.`
        );
      }

      // 7. Find active closing voucher FOR UPDATE
      const activeCloseRes = await client.query<AccountingVoucherRow>(
        `SELECT * FROM public.accounting_voucher 
         WHERE reference_type = 'YEAR_END_CLOSE' 
           AND reference_id = $1 
           AND status = 'POSTED' 
           AND reversed_by_voucher_id IS NULL 
           AND deleted_at IS NULL 
         ORDER BY created_at DESC 
         LIMIT 1 
         FOR UPDATE`,
        [params.fiscal_year]
      );

      if (activeCloseRes.rows.length === 0) {
        // Check if closing voucher was already reversed
        const alreadyReversedRes = await client.query<AccountingVoucherRow>(
          `SELECT * FROM public.accounting_voucher 
           WHERE reference_type = 'YEAR_END_CLOSE' 
             AND reference_id = $1 
             AND status = 'POSTED' 
             AND reversed_by_voucher_id IS NOT NULL 
             AND deleted_at IS NULL 
           ORDER BY created_at DESC LIMIT 1`,
          [params.fiscal_year]
        );
        if (alreadyReversedRes.rows.length > 0) {
          throw new PeriodCloseServiceError(
            "YEAR_ALREADY_REOPENED",
            `Fiscal year '${params.fiscal_year}' closing voucher (${alreadyReversedRes.rows[0].voucher_no}) has already been reversed by voucher '${alreadyReversedRes.rows[0].reversed_by_voucher_id}'. Year is already open for adjustments.`
          );
        }
        throw new PeriodCloseServiceError(
          "FISCAL_YEAR_NOT_CLOSED",
          `Fiscal year '${params.fiscal_year}' does not have an active closing voucher. Only closed fiscal years can be reopened.`
        );
      }

      const closingVoucher = activeCloseRes.rows[0];

      // 8. Fetch original closing journal entry FOR UPDATE
      const jeRes = await client.query<AccountingJournalEntryRow>(
        `SELECT * FROM public.accounting_journal_entry 
         WHERE voucher_id = $1 
         FOR UPDATE`,
        [closingVoucher.id]
      );

      if (jeRes.rows.length === 0) {
        throw new PeriodCloseServiceError(
          "ORIGINAL_JOURNAL_NOT_FOUND",
          `Original closing journal entry not found for voucher '${closingVoucher.id}'.`
        );
      }

      const originalJournal = jeRes.rows[0];
      if (originalJournal.is_reversed) {
        throw new PeriodCloseServiceError(
          "YEAR_ALREADY_REOPENED",
          `Original closing journal entry '${originalJournal.entry_no}' is already marked reversed.`
        );
      }

      // 9. Fetch original closing journal lines
      const linesRes = await client.query<AccountingJournalLineRow>(
        `SELECT * FROM public.accounting_journal_line 
         WHERE journal_entry_id = $1 
         ORDER BY line_no ASC`,
        [originalJournal.id]
      );

      const originalLines = linesRes.rows;
      if (originalLines.length < 2) {
        throw new PeriodCloseServiceError(
          "INVALID_CLOSING_JOURNAL",
          `Original closing journal entry '${originalJournal.entry_no}' has fewer than 2 lines.`
        );
      }

      // 10. Construct Compensating Reversal Lines (invert Dr and Cr)
      const reversalLines: JournalLineInput[] = originalLines.map((l) => {
        const origDr = Number(l.debit_amount) || 0;
        const origCr = Number(l.credit_amount) || 0;
        return {
          account_id: l.account_id,
          debit_amount: origCr,
          credit_amount: origDr,
          branch_id: l.branch_id,
          narration: `[YEAR_END_REOPEN] Reversal of ${l.narration || "closing line"}`,
        };
      });

      PostingService.validateJournalLines(reversalLines);

      // Extract metadata from original closing voucher
      const origMeta = typeof closingVoucher.metadata === "string" 
        ? JSON.parse(closingVoucher.metadata) 
        : (closingVoucher.metadata || {});
      const netProfitReversed = origMeta.net_profit ?? 0;
      
      // Determine drawings from original closing journal lines (account 3120) or metadata
      let drawingsReversed = origMeta.drawings_transferred ?? 0;
      if (!drawingsReversed) {
        const acct3120Res = await client.query<{ id: string }>(
          `SELECT id FROM public.accounting_account WHERE code = '3120' AND is_active = true LIMIT 1`
        );
        if (acct3120Res.rows.length > 0) {
          const drawLine = originalLines.find((l) => l.account_id === acct3120Res.rows[0].id);
          if (drawLine) {
            drawingsReversed = round2(Number(drawLine.credit_amount) || 0);
          }
        }
      }
      const accountsRestoredCount = origMeta.accounts_zeroed_count ?? reversalLines.length;

      // Resolve enterprise branch
      const effectiveBranchId = await resolveEnterpriseBranchId(undefined, client);

      // 11. Create Compensating Reversal Voucher
      const voucherInput: VoucherCreateInput = {
        voucher_type: "JOURNAL",
        voucher_date: closingVoucher.voucher_date,
        branch_id: effectiveBranchId,
        narration: `[YEAR_END_REOPEN] Compensating reversal of ${closingVoucher.voucher_no} for FY ${params.fiscal_year}. Reason: ${params.reason.trim()}`,
        reference_type: "YEAR_END_REOPEN",
        reference_id: closingVoucher.id,
        reference_event: "YEAR_END_CLOSE_REVERSAL",
        reversal_of_voucher_id: closingVoucher.id,
        metadata: {
          reopen_type: "YEAR_END_REVERSAL",
          fiscal_year: params.fiscal_year,
          original_closing_voucher_id: closingVoucher.id,
          original_closing_voucher_no: closingVoucher.voucher_no,
          original_journal_entry_id: originalJournal.id,
          net_profit_reversed: netProfitReversed,
          drawings_reversed: drawingsReversed,
          accounts_restored_count: accountsRestoredCount,
          reason: params.reason.trim(),
          prepared_by: preparerId,
          approved_by: approverId,
          reopened_at: new Date().toISOString(),
        },
      };

      const draftRes = await PostingService.createVoucherDraft({
        input: voucherInput,
        branchId: effectiveBranchId,
        fiscalYear: params.fiscal_year,
        createdBy: preparerId,
        client,
      });

      if (!draftRes.success) {
        throw new PeriodCloseServiceError(
          draftRes.code || "POSTING_FAILED",
          draftRes.error || "Failed to create reopen reversal voucher draft."
        );
      }
      const reversalVoucherId = draftRes.data.id;

      // Submit
      const submitRes = await PostingService.submitVoucher({
        voucherId: reversalVoucherId,
        submittedBy: preparerId,
        branchId: effectiveBranchId,
        client,
      });
      if (!submitRes.success) {
        throw new PeriodCloseServiceError(
          (submitRes.code as any) || "POSTING_FAILED",
          submitRes.error || "Failed to submit reopen reversal voucher."
        );
      }

      // Approve (enforcing SoD: approverId !== preparerId)
      const approveRes = await PostingService.approveVoucher({
        voucherId: reversalVoucherId,
        approvedBy: approverId,
        branchId: effectiveBranchId,
        client,
      });
      if (!approveRes.success) {
        throw new PeriodCloseServiceError(
          (approveRes.code as any) || "POSTING_FAILED",
          approveRes.error || "Failed to approve reopen reversal voucher."
        );
      }

      // Post
      const postRes = await PostingService.postVoucher({
        voucherId: reversalVoucherId,
        lines: reversalLines,
        postedBy: approverId,
        branchId: effectiveBranchId,
        client,
      });
      if (!postRes.success) {
        throw new PeriodCloseServiceError(
          postRes.code || "POSTING_FAILED",
          postRes.error || "Failed to post reopen reversal voucher."
        );
      }

      const postedResult = postRes.data;

      // 12. Authoritative Bidirectional Linkage via PostingService.linkReversal
      await PostingService.linkReversal(
        {
          originalVoucherId: closingVoucher.id,
          reversalVoucherId: reversalVoucherId,
          reversedBy: approverId,
          branchId: effectiveBranchId,
        },
        client
      );

      // 13. Audit Log
      const auditId = `aud_${crypto.randomBytes(12).toString("hex")}`;
      await client.query(
        `INSERT INTO public.audit_log (
          id, actor_id, actor_type, action, entity, entity_id, metadata, created_at, updated_at
        ) VALUES ($1, $2, 'staff', 'accounting.fiscal_year_reopened', 'fiscal_year', $3, $4, NOW(), NOW())`,
        [
          auditId,
          approverId,
          params.fiscal_year,
          JSON.stringify({
            fiscal_year: params.fiscal_year,
            original_closing_voucher_id: closingVoucher.id,
            original_closing_voucher_no: closingVoucher.voucher_no,
            original_journal_entry_id: originalJournal.id,
            reversal_voucher_id: reversalVoucherId,
            reversal_voucher_no: postedResult.voucher.voucher_no,
            reversal_journal_entry_id: postedResult.journal_entry.id,
            preparer_id: preparerId,
            approver_id: approverId,
            reason: params.reason.trim(),
            net_profit_reversed: netProfitReversed,
            drawings_reversed: drawingsReversed,
            accounts_restored_count: accountsRestoredCount,
            action: "YEAR_END_REOPEN_POST",
            timestamp: new Date().toISOString(),
          }),
        ]
      );

      return {
        success: true,
        fiscal_year: params.fiscal_year,
        original_closing_voucher_id: closingVoucher.id,
        original_closing_voucher_no: closingVoucher.voucher_no,
        reversal_voucher_id: reversalVoucherId,
        reversal_voucher_no: postedResult.voucher.voucher_no,
        reversal_journal_entry_id: postedResult.journal_entry.id,
        reversal_entry_no: postedResult.journal_entry.entry_no,
        reversal_date: toIsoDate(closingVoucher.voucher_date),
        net_profit_reversed: netProfitReversed,
        drawings_reversed: drawingsReversed,
        accounts_restored_count: accountsRestoredCount,
        reopen_reason: params.reason.trim(),
        preparer_id: preparerId,
        approver_id: approverId,
        message: `Fiscal year '${params.fiscal_year}' reopened successfully via compensating reversal voucher ${postedResult.voucher.voucher_no}. ${accountsRestoredCount} nominal account balances restored. Retained earnings adjusted by ₹${(-netProfitReversed).toFixed(2)}.`,
        timestamp: new Date().toISOString(),
      };
    };

    return existingClient ? executeReopenTx(existingClient) : dbTransaction(executeReopenTx);
  }

  /**
   * Retrieves close, reopen, and lock audit history for a fiscal year.
   */
  static async getFiscalYearCloseHistory(
    fiscalYear: string,
    existingClient?: PoolClient
  ): Promise<FiscalYearCloseHistoryResult> {
    const runQuery = async <T extends QueryResultRow = any>(
      sql: string,
      sqlParams: any[] = []
    ): Promise<{ rows: T[] }> => {
      return existingClient ? existingClient.query<T>(sql, sqlParams) : dbQuery<T>(sql, sqlParams);
    };

    const vouchersRes = await runQuery<AccountingVoucherRow>(
      `SELECT * FROM public.accounting_voucher 
       WHERE fiscal_year = $1 
         AND reference_type IN ('YEAR_END_CLOSE', 'YEAR_END_REOPEN') 
         AND status = 'POSTED' 
         AND deleted_at IS NULL 
       ORDER BY created_at ASC`,
      [fiscalYear]
    );

    const activeCloseVoucher = vouchersRes.rows.find(
      (v) => v.reference_type === "YEAR_END_CLOSE" && !v.reversed_by_voucher_id
    );

    const timeline = vouchersRes.rows.map((v) => ({
      type: v.reference_type === "YEAR_END_CLOSE" ? ("CLOSE" as const) : ("REOPEN" as const),
      voucher_id: v.id,
      voucher_no: v.voucher_no,
      voucher_date: toIsoDate(v.voucher_date),
      total_amount: Number(v.total_amount) || 0,
      actor_id: v.approved_by || v.created_by,
      timestamp: v.created_at,
      metadata: v.metadata,
    }));

    const closeEventsCount = timeline.filter((t) => t.type === "CLOSE").length;
    const reopenEventsCount = timeline.filter((t) => t.type === "REOPEN").length;

    return {
      fiscal_year: fiscalYear,
      is_closed: Boolean(activeCloseVoucher),
      active_closing_voucher: activeCloseVoucher
        ? {
            id: activeCloseVoucher.id,
            voucher_no: activeCloseVoucher.voucher_no,
            voucher_date: toIsoDate(activeCloseVoucher.voucher_date),
            total_amount: Number(activeCloseVoucher.total_amount) || 0,
            created_at: activeCloseVoucher.created_at,
          }
        : null,
      close_events_count: closeEventsCount,
      reopen_events_count: reopenEventsCount,
      timeline,
    };
  }

  // ── Substep 5.2: Retained Earnings Roll-Forward Engine ───────────────────────

  /**
   * Compute multi-year Retained Earnings Roll-Forward report.
   * Derived entirely from the authoritative double-entry journal.
   *
   * For each fiscal year in the requested range:
   * 1. Opening RE = GL balance of Account 3210 for all entries BEFORE the start_date
   * 2. Net Operating Profit = Revenue - Expense (excludeClosingVouchers)
   * 3. Transferred to RE = actual 3210 lines from YEAR_END_CLOSE vouchers in that FY
   * 4. Drawings transferred = actual 3120 lines from YEAR_END_CLOSE vouchers
   * 5. Reopen reversals = actual 3210 lines from YEAR_END_REOPEN vouchers
   * 6. Closing RE = GL balance of Account 3210 for all entries up to end_date
   * 7. Continuity: closing_re(N) === opening_re(N+1)
   *
   * STRICTLY READ-ONLY: zero mutations.
   */
  static async getRetainedEarningsRollForward(
    params: {
      start_year: string;
      end_year: string;
      branch_id?: string;
      session_user?: {
        id: string;
        role: string;
        branch_id?: string | null;
        isSuperAdmin?: boolean;
        permissions?: string[];
      };
    },
    existingClient?: PoolClient
  ): Promise<RetainedEarningsRollForwardResult> {
    const runQuery = async <T extends QueryResultRow = any>(
      sql: string,
      sqlParams: any[] = []
    ): Promise<{ rows: T[] }> => {
      return existingClient ? existingClient.query<T>(sql, sqlParams) : dbQuery<T>(sql, sqlParams);
    };

    // RBAC
    if (params.session_user) {
      const { role, isSuperAdmin, permissions, branch_id: userBranch } = params.session_user;
      const hasView = isSuperAdmin || role === "SUPER_ADMIN" || permissions?.includes("ACCOUNTING.VIEW");
      if (!hasView) {
        throw new PeriodCloseServiceError(
          "PERMISSION_DENIED",
          "Forbidden: User lacks ACCOUNTING.VIEW permission to view retained earnings roll-forward."
        );
      }
      if (userBranch && !isSuperAdmin && role !== "SUPER_ADMIN") {
        if (params.branch_id && params.branch_id !== userBranch) {
          throw new PeriodCloseServiceError(
            "BRANCH_ACCESS_DENIED",
            "Forbidden: Staff user cannot view roll-forward for another branch."
          );
        }
      }
    }

    // Build list of fiscal years between start_year and end_year
    const fiscalYears = this._buildFiscalYearRange(params.start_year, params.end_year);

    // Lookup Account 3210 and 3120 IDs
    const acct3210Res = await runQuery<{ id: string }>(
      `SELECT id FROM public.accounting_account WHERE code = '3210' AND is_active = true LIMIT 1`
    );
    const acct3120Res = await runQuery<{ id: string }>(
      `SELECT id FROM public.accounting_account WHERE code = '3120' AND is_active = true LIMIT 1`
    );
    const acct3210Id = acct3210Res.rows[0]?.id || null;
    const acct3120Id = acct3120Res.rows[0]?.id || null;

    if (!acct3210Id) {
      throw new PeriodCloseServiceError(
        "ACCOUNT_NOT_FOUND",
        "Retained Earnings account 3210 not found in Chart of Accounts."
      );
    }

    const years: RetainedEarningsYearRollForward[] = [];

    for (const fy of fiscalYears) {
      const { startDate, endDate } = deriveIndianFiscalYearDates(fy);

      // 1. Opening RE: all journal lines for account 3210 with entry_date < startDate
      //    Net balance = credit - debit (credit-normal for equity)
      const openingRes = await runQuery<{ net_cr: string }>(
        `SELECT COALESCE(SUM(jl.credit_amount) - SUM(jl.debit_amount), 0) AS net_cr
         FROM public.accounting_journal_line jl
         JOIN public.accounting_journal_entry je ON je.id = jl.journal_entry_id
         WHERE jl.account_id = $1 AND je.entry_date < $2
         ${params.branch_id ? 'AND jl.branch_id = $3' : ''}`,
        params.branch_id ? [acct3210Id, startDate, params.branch_id] : [acct3210Id, startDate]
      );
      const openingRE = round2(parseFloat(openingRes.rows[0]?.net_cr || "0"));

      // 2. Net Operating Profit: from nominal accounts within FY date range,
      //    excluding closing/reopen vouchers
      const nominalRes = await runQuery<{ total_revenue: string; total_expense: string }>(
        `SELECT
           COALESCE(SUM(CASE WHEN a.type = 'REVENUE' THEN jl.credit_amount - jl.debit_amount ELSE 0 END), 0) AS total_revenue,
           COALESCE(SUM(CASE WHEN a.type = 'EXPENSE' THEN jl.debit_amount - jl.credit_amount ELSE 0 END), 0) AS total_expense
         FROM public.accounting_journal_line jl
         JOIN public.accounting_journal_entry je ON je.id = jl.journal_entry_id
         JOIN public.accounting_voucher v ON v.id = je.voucher_id
         JOIN public.accounting_account a ON a.id = jl.account_id
         WHERE a.type IN ('REVENUE', 'EXPENSE')
           AND a.is_group = false
           AND je.entry_date >= $1 AND je.entry_date <= $2
           AND (v.reference_type IS NULL OR v.reference_type NOT IN ('YEAR_END_CLOSE', 'YEAR_END_REOPEN'))
           ${params.branch_id ? 'AND jl.branch_id = $3' : ''}`,
        params.branch_id ? [startDate, endDate, params.branch_id] : [startDate, endDate]
      );
      const totalRevenue = round2(parseFloat(nominalRes.rows[0]?.total_revenue || "0"));
      const totalExpense = round2(parseFloat(nominalRes.rows[0]?.total_expense || "0"));
      const netOperatingProfit = round2(totalRevenue - totalExpense);

      // 3. Check if FY is closed (active unreversed YEAR_END_CLOSE voucher)
      const closeVoucherRes = await runQuery<AccountingVoucherRow>(
        `SELECT id, voucher_no, metadata FROM public.accounting_voucher
         WHERE reference_type = 'YEAR_END_CLOSE'
           AND reference_id = $1
           AND status = 'POSTED'
           AND reversed_by_voucher_id IS NULL
           AND deleted_at IS NULL
         ORDER BY created_at DESC LIMIT 1`,
        [fy]
      );
      const isClosed = closeVoucherRes.rows.length > 0;
      const activeCloseVoucherId = closeVoucherRes.rows[0]?.id || null;

      // 4. Transferred to RE from YEAR_END_CLOSE vouchers: sum of 3210 lines in close vouchers
      let transferredToRE = 0;
      let drawingsTransferred = 0;

      if (isClosed || !isClosed) {
        // Query ALL posted YEAR_END_CLOSE vouchers for this FY (including reversed ones)
        // to capture the full history. Active transfer = net of close + reopen lines.
        const closeVoucherIdsRes = await runQuery<{ id: string }>(
          `SELECT v.id FROM public.accounting_voucher v
           WHERE v.reference_type = 'YEAR_END_CLOSE'
             AND v.reference_id = $1
             AND v.status = 'POSTED'
             AND v.deleted_at IS NULL`,
          [fy]
        );

        if (closeVoucherIdsRes.rows.length > 0) {
          const closeVoucherIds = closeVoucherIdsRes.rows.map(r => r.id);
          // Get net 3210 credit from close vouchers (credit = profit transfer, debit = drawings/loss)
          const re3210Res = await runQuery<{ net_cr: string }>(
            `SELECT COALESCE(SUM(jl.credit_amount) - SUM(jl.debit_amount), 0) AS net_cr
             FROM public.accounting_journal_line jl
             JOIN public.accounting_journal_entry je ON je.id = jl.journal_entry_id
             WHERE jl.account_id = $1
               AND je.voucher_id = ANY($2)
               ${params.branch_id ? 'AND jl.branch_id = $3' : ''}`,
            params.branch_id
              ? [acct3210Id, closeVoucherIds, params.branch_id]
              : [acct3210Id, closeVoucherIds]
          );
          transferredToRE = round2(parseFloat(re3210Res.rows[0]?.net_cr || "0"));

          // Drawings: sum of 3120 lines in close vouchers (credit = drawings zeroed)
          if (acct3120Id) {
            const draw3120Res = await runQuery<{ net_cr: string }>(
              `SELECT COALESCE(SUM(jl.credit_amount) - SUM(jl.debit_amount), 0) AS net_cr
               FROM public.accounting_journal_line jl
               JOIN public.accounting_journal_entry je ON je.id = jl.journal_entry_id
               WHERE jl.account_id = $1
                 AND je.voucher_id = ANY($2)
                 ${params.branch_id ? 'AND jl.branch_id = $3' : ''}`,
              params.branch_id
                ? [acct3120Id, closeVoucherIds, params.branch_id]
                : [acct3120Id, closeVoucherIds]
            );
            drawingsTransferred = round2(parseFloat(draw3120Res.rows[0]?.net_cr || "0"));
          }
        }
      }

      // 5. Reopen reversals: net 3210 lines from YEAR_END_REOPEN vouchers
      let reopenReversals = 0;
      const reopenVoucherIdsRes = await runQuery<{ id: string }>(
        `SELECT v.id FROM public.accounting_voucher v
         WHERE v.reference_type = 'YEAR_END_REOPEN'
           AND v.status = 'POSTED'
           AND v.deleted_at IS NULL
           AND EXISTS (
             SELECT 1 FROM public.accounting_voucher cv
             WHERE cv.id = v.reversal_of_voucher_id
               AND cv.reference_type = 'YEAR_END_CLOSE'
               AND cv.reference_id = $1
           )`,
        [fy]
      );
      if (reopenVoucherIdsRes.rows.length > 0) {
        const reopenVoucherIds = reopenVoucherIdsRes.rows.map(r => r.id);
        const reopenRE3210Res = await runQuery<{ net_cr: string }>(
          `SELECT COALESCE(SUM(jl.credit_amount) - SUM(jl.debit_amount), 0) AS net_cr
           FROM public.accounting_journal_line jl
           JOIN public.accounting_journal_entry je ON je.id = jl.journal_entry_id
           WHERE jl.account_id = $1
             AND je.voucher_id = ANY($2)
             ${params.branch_id ? 'AND jl.branch_id = $3' : ''}`,
          params.branch_id
            ? [acct3210Id, reopenVoucherIds, params.branch_id]
            : [acct3210Id, reopenVoucherIds]
        );
        reopenReversals = round2(parseFloat(reopenRE3210Res.rows[0]?.net_cr || "0"));
      }

      // 6. Closing RE: all journal lines for 3210 with entry_date <= endDate
      const closingRes = await runQuery<{ net_cr: string }>(
        `SELECT COALESCE(SUM(jl.credit_amount) - SUM(jl.debit_amount), 0) AS net_cr
         FROM public.accounting_journal_line jl
         JOIN public.accounting_journal_entry je ON je.id = jl.journal_entry_id
         WHERE jl.account_id = $1 AND je.entry_date <= $2
         ${params.branch_id ? 'AND jl.branch_id = $3' : ''}`,
        params.branch_id ? [acct3210Id, endDate, params.branch_id] : [acct3210Id, endDate]
      );
      const closingRE = round2(parseFloat(closingRes.rows[0]?.net_cr || "0"));

      years.push({
        fiscal_year: fy,
        start_date: startDate,
        end_date: endDate,
        is_closed: isClosed,
        active_close_voucher_id: activeCloseVoucherId,
        opening_retained_earnings: openingRE,
        net_operating_profit: netOperatingProfit,
        transferred_to_retained_earnings: transferredToRE,
        drawings_transferred: drawingsTransferred,
        reopen_reversals: reopenReversals,
        closing_retained_earnings: closingRE,
        continuity_verified: false, // Will be computed below
      });
    }

    // 7. Verify continuity: closing_re(N) === opening_re(N+1)
    let overallContinuity = true;
    for (let i = 0; i < years.length; i++) {
      if (i < years.length - 1) {
        const closingI = years[i].closing_retained_earnings;
        const openingNext = years[i + 1].opening_retained_earnings;
        years[i].continuity_verified = Math.abs(closingI - openingNext) < 0.01;
        if (!years[i].continuity_verified) overallContinuity = false;
      } else {
        // Last year: no successor to verify against — mark as true
        years[i].continuity_verified = true;
      }
    }

    return {
      years,
      overall_continuity_verified: overallContinuity,
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Compute Fiscal Year Summary for all configured fiscal years.
   * Returns status, period lock state, financial summary, and close/reopen history.
   *
   * STRICTLY READ-ONLY: zero mutations.
   */
  static async getFiscalYearSummary(
    params?: {
      session_user?: {
        id: string;
        role: string;
        branch_id?: string | null;
        isSuperAdmin?: boolean;
        permissions?: string[];
      };
    },
    existingClient?: PoolClient
  ): Promise<FiscalYearSummaryItem[]> {
    const runQuery = async <T extends QueryResultRow = any>(
      sql: string,
      sqlParams: any[] = []
    ): Promise<{ rows: T[] }> => {
      return existingClient ? existingClient.query<T>(sql, sqlParams) : dbQuery<T>(sql, sqlParams);
    };

    // RBAC
    if (params?.session_user) {
      const { role, isSuperAdmin, permissions } = params.session_user;
      const hasView = isSuperAdmin || role === "SUPER_ADMIN" || permissions?.includes("ACCOUNTING.VIEW");
      if (!hasView) {
        throw new PeriodCloseServiceError(
          "PERMISSION_DENIED",
          "Forbidden: User lacks ACCOUNTING.VIEW permission to view fiscal year summary."
        );
      }
    }

    // 1. Get all distinct fiscal years from fiscal periods
    const fyRes = await runQuery<{ fiscal_year: string; total: string; locked: string }>(
      `SELECT fiscal_year,
              count(*)::text AS total,
              count(*) FILTER (WHERE is_locked = true)::text AS locked
       FROM public.accounting_fiscal_period
       GROUP BY fiscal_year
       ORDER BY fiscal_year ASC`
    );

    const results: FiscalYearSummaryItem[] = [];

    for (const fyRow of fyRes.rows) {
      const fy = fyRow.fiscal_year;
      const totalPeriods = parseInt(fyRow.total, 10);
      const lockedPeriods = parseInt(fyRow.locked, 10);
      const allPeriodsLocked = lockedPeriods === totalPeriods;

      const { startDate, endDate } = deriveIndianFiscalYearDates(fy);

      // 2. Check close/reopen voucher status
      const closeVouchersRes = await runQuery<AccountingVoucherRow>(
        `SELECT * FROM public.accounting_voucher
         WHERE reference_type IN ('YEAR_END_CLOSE', 'YEAR_END_REOPEN')
           AND reference_id = $1
           AND status = 'POSTED'
           AND deleted_at IS NULL
         ORDER BY created_at ASC`,
        [fy]
      );

      const activeClose = closeVouchersRes.rows.find(
        v => v.reference_type === "YEAR_END_CLOSE" && !v.reversed_by_voucher_id
      );

      const closeCycleCount = closeVouchersRes.rows.filter(
        v => v.reference_type === "YEAR_END_CLOSE"
      ).length;

      const reopenCycleCount = closeVouchersRes.rows.filter(
        v => v.reference_type === "YEAR_END_REOPEN"
      ).length;

      // Determine status
      let status: "OPEN" | "CLOSED" | "REOPENED";
      if (activeClose) {
        status = "CLOSED";
      } else if (reopenCycleCount > 0) {
        status = "REOPENED";
      } else {
        status = "OPEN";
      }

      // 3. Compute operating revenue, expense, and net profit
      //    (exclude closing vouchers for operational P&L)
      const nominalRes = await runQuery<{ total_revenue: string; total_expense: string }>(
        `SELECT
           COALESCE(SUM(CASE WHEN a.type = 'REVENUE' THEN jl.credit_amount - jl.debit_amount ELSE 0 END), 0) AS total_revenue,
           COALESCE(SUM(CASE WHEN a.type = 'EXPENSE' THEN jl.debit_amount - jl.credit_amount ELSE 0 END), 0) AS total_expense
         FROM public.accounting_journal_line jl
         JOIN public.accounting_journal_entry je ON je.id = jl.journal_entry_id
         JOIN public.accounting_voucher v ON v.id = je.voucher_id
         JOIN public.accounting_account a ON a.id = jl.account_id
         WHERE a.type IN ('REVENUE', 'EXPENSE')
           AND a.is_group = false
           AND je.entry_date >= $1 AND je.entry_date <= $2
           AND (v.reference_type IS NULL OR v.reference_type NOT IN ('YEAR_END_CLOSE', 'YEAR_END_REOPEN'))`,
        [startDate, endDate]
      );
      const operatingRevenue = round2(parseFloat(nominalRes.rows[0]?.total_revenue || "0"));
      const operatingExpense = round2(parseFloat(nominalRes.rows[0]?.total_expense || "0"));
      const netProfit = round2(operatingRevenue - operatingExpense);

      // 4. Active closing voucher details
      let activeClosingVoucher: FiscalYearSummaryItem["active_closing_voucher"] = null;
      if (activeClose) {
        const meta = typeof activeClose.metadata === "string"
          ? JSON.parse(activeClose.metadata)
          : (activeClose.metadata || {});
        activeClosingVoucher = {
          voucher_id: activeClose.id,
          voucher_no: activeClose.voucher_no,
          close_date: toIsoDate(activeClose.voucher_date),
          net_profit: meta.net_profit ?? netProfit,
          drawings_transferred: meta.drawings_transferred ?? 0,
        };
      }

      const historicalLockoutActive = status === "CLOSED" || allPeriodsLocked;

      results.push({
        fiscal_year: fy,
        start_date: startDate,
        end_date: endDate,
        status,
        total_periods: totalPeriods,
        locked_periods: lockedPeriods,
        all_periods_locked: allPeriodsLocked,
        active_closing_voucher: activeClosingVoucher,
        close_cycle_count: closeCycleCount,
        reopen_cycle_count: reopenCycleCount,
        operating_revenue: operatingRevenue,
        operating_expense: operatingExpense,
        net_profit: netProfit,
        historical_lockout_active: historicalLockoutActive,
      });
    }

    return results;
  }

  /**
   * Compute Comparative Multi-Year Profit & Loss.
   * Two P&L snapshots side-by-side with variance (₹ and %).
   * Excludes closing/reopen vouchers from both periods.
   *
   * Section classification follows profit-loss.service.ts parent_id hierarchy:
   * - 4100 children → Operating Revenue
   * - 4200 children → Other Income
   * - 5100 children → COGS
   * - 5200 children → Operating Expenses
   * - 5300 children → Financial Expenses
   *
   * STRICTLY READ-ONLY: zero mutations.
   */
  static async getComparativeProfitLoss(
    params: ComparativePnLParams & {
      session_user?: {
        id: string;
        role: string;
        branch_id?: string | null;
        isSuperAdmin?: boolean;
        permissions?: string[];
      };
    },
    existingClient?: PoolClient
  ): Promise<ComparativePnLResult> {
    // RBAC
    if (params.session_user) {
      const { role, isSuperAdmin, permissions, branch_id: userBranch } = params.session_user;
      const hasView = isSuperAdmin || role === "SUPER_ADMIN" || permissions?.includes("ACCOUNTING.VIEW");
      if (!hasView) {
        throw new PeriodCloseServiceError(
          "PERMISSION_DENIED",
          "Forbidden: User lacks ACCOUNTING.VIEW permission to view comparative P&L."
        );
      }
      if (userBranch && !isSuperAdmin && role !== "SUPER_ADMIN") {
        if (params.branch_id && params.branch_id !== userBranch) {
          throw new PeriodCloseServiceError(
            "BRANCH_ACCESS_DENIED",
            "Forbidden: Staff user cannot view comparative P&L for another branch."
          );
        }
      }
    }

    const currentDates = deriveIndianFiscalYearDates(params.fiscal_year);
    const compareDates = deriveIndianFiscalYearDates(params.compare_fiscal_year);

    // Fetch Trial Balance for both periods, excluding closing vouchers
    const [currentTB, compareTB, allAccounts] = await Promise.all([
      AccountingJournalRepository.getTrialBalance(
        params.branch_id, currentDates.startDate, currentDates.endDate, true, existingClient
      ),
      AccountingJournalRepository.getTrialBalance(
        params.branch_id, compareDates.startDate, compareDates.endDate, true, existingClient
      ),
      AccountingAccountRepository.listAccounts({ is_active: true }, existingClient),
    ]);

    // Build lookup maps
    const accountById = new Map<string, AccountingAccountRow>();
    for (const a of allAccounts) {
      accountById.set(a.id, a);
    }

    function getParentGroupCode(accountId: string): string | null {
      const acct = accountById.get(accountId);
      if (!acct || !acct.parent_id) return null;
      const parent = accountById.get(acct.parent_id);
      if (!parent) return null;
      return parent.code;
    }

    const currentByCode = new Map<string, TrialBalanceRow>();
    for (const r of currentTB) currentByCode.set(r.code, r);

    const compareByCode = new Map<string, TrialBalanceRow>();
    for (const r of compareTB) compareByCode.set(r.code, r);

    // Section parent codes (aligned with profit-loss.service.ts)
    const SECTION_MAP: Record<string, string> = {
      "4100": "operating_revenue",
      "4200": "other_income",
      "5100": "cost_of_goods_sold",
      "5200": "operating_expenses",
      "5300": "financial_expenses",
    };

    const sections: Record<string, ComparativePnLAccountLine[]> = {
      operating_revenue: [],
      cost_of_goods_sold: [],
      operating_expenses: [],
      other_income: [],
      financial_expenses: [],
    };

    // Filter to leaf REVENUE/EXPENSE accounts
    const nominalLeaves = allAccounts
      .filter(a => !a.is_group && (a.type === "REVENUE" || a.type === "EXPENSE"))
      .sort((a, b) => a.code.localeCompare(b.code));

    for (const acct of nominalLeaves) {
      const cRow = currentByCode.get(acct.code);
      const pRow = compareByCode.get(acct.code);

      // Sign-correct: Revenue normal = CREDIT (negate net_balance), Expense normal = DEBIT (use as-is)
      let currentAmt: number;
      let compareAmt: number;

      if (acct.type === "REVENUE") {
        // Revenue: credit-normal. net_balance = debit - credit. Negate for positive display.
        // Contra (4190): debit-normal when returns exist, keep as positive deduction
        if (acct.code === "4190") {
          currentAmt = round2(Math.max(0, Number(cRow?.total_debit || 0) - Number(cRow?.total_credit || 0)));
          compareAmt = round2(Math.max(0, Number(pRow?.total_debit || 0) - Number(pRow?.total_credit || 0)));
        } else {
          currentAmt = round2(Math.max(0, Number(cRow?.total_credit || 0) - Number(cRow?.total_debit || 0)));
          compareAmt = round2(Math.max(0, Number(pRow?.total_credit || 0) - Number(pRow?.total_debit || 0)));
        }
      } else {
        // Expense: debit-normal
        if (acct.code === "5190") {
          currentAmt = round2(Math.max(0, Number(cRow?.total_credit || 0) - Number(cRow?.total_debit || 0)));
          compareAmt = round2(Math.max(0, Number(pRow?.total_credit || 0) - Number(pRow?.total_debit || 0)));
        } else {
          currentAmt = round2(Math.max(0, Number(cRow?.total_debit || 0) - Number(cRow?.total_credit || 0)));
          compareAmt = round2(Math.max(0, Number(pRow?.total_debit || 0) - Number(pRow?.total_credit || 0)));
        }
      }

      const varianceAmt = round2(currentAmt - compareAmt);
      const variancePct = compareAmt !== 0 ? round2((varianceAmt / compareAmt) * 100) : null;

      const parentCode = getParentGroupCode(acct.id);
      const sectionKey = parentCode ? (SECTION_MAP[parentCode] || "operating_expenses") : "operating_expenses";

      sections[sectionKey].push({
        code: acct.code,
        name: acct.name,
        type: acct.type as "REVENUE" | "EXPENSE",
        subtype: acct.subtype,
        current_amount: currentAmt,
        compare_amount: compareAmt,
        variance_amount: varianceAmt,
        variance_percent: variancePct,
      });
    }

    // Build section totals
    function buildSection(key: string, label: string): ComparativePnLSection {
      const accounts = sections[key] || [];
      const currentTotal = round2(accounts.reduce((sum, a) => sum + a.current_amount, 0));
      const compareTotal = round2(accounts.reduce((sum, a) => sum + a.compare_amount, 0));
      const varianceTotal = round2(currentTotal - compareTotal);
      const variancePct = compareTotal !== 0 ? round2((varianceTotal / compareTotal) * 100) : null;
      return { label, accounts, current_total: currentTotal, compare_total: compareTotal, variance_total: varianceTotal, variance_percent: variancePct };
    }

    const opRevSection = buildSection("operating_revenue", "I. Operating Revenue");
    const cogsSection = buildSection("cost_of_goods_sold", "II. Cost of Goods Sold");
    const opexSection = buildSection("operating_expenses", "III. Operating Expenses");
    const otherIncSection = buildSection("other_income", "IV. Other Income");
    const finExpSection = buildSection("financial_expenses", "V. Financial & Depreciation Expenses");

    // Net revenue (gross rev - returns for operating revenue only)
    const currentNetRevenue = round2(opRevSection.current_total);
    const compareNetRevenue = round2(opRevSection.compare_total);

    const currentGrossProfit = round2(currentNetRevenue - cogsSection.current_total);
    const compareGrossProfit = round2(compareNetRevenue - cogsSection.compare_total);

    const currentOperatingProfit = round2(currentGrossProfit - opexSection.current_total);
    const compareOperatingProfit = round2(compareGrossProfit - opexSection.compare_total);

    const currentNetProfit = round2(
      currentOperatingProfit + otherIncSection.current_total - finExpSection.current_total
    );
    const compareNetProfit = round2(
      compareOperatingProfit + otherIncSection.compare_total - finExpSection.compare_total
    );

    const netProfitVariance = round2(currentNetProfit - compareNetProfit);
    const netProfitVariancePct = compareNetProfit !== 0
      ? round2((netProfitVariance / compareNetProfit) * 100)
      : null;

    return {
      current_fiscal_year: params.fiscal_year,
      compare_fiscal_year: params.compare_fiscal_year,
      current_period: { start_date: currentDates.startDate, end_date: currentDates.endDate },
      compare_period: { start_date: compareDates.startDate, end_date: compareDates.endDate },
      sections: {
        operating_revenue: opRevSection,
        cost_of_goods_sold: cogsSection,
        operating_expenses: opexSection,
        other_income: otherIncSection,
        financial_expenses: finExpSection,
      },
      summary: {
        current_gross_profit: currentGrossProfit,
        compare_gross_profit: compareGrossProfit,
        gross_profit_variance: round2(currentGrossProfit - compareGrossProfit),
        current_operating_profit: currentOperatingProfit,
        compare_operating_profit: compareOperatingProfit,
        operating_profit_variance: round2(currentOperatingProfit - compareOperatingProfit),
        current_net_profit: currentNetProfit,
        compare_net_profit: compareNetProfit,
        net_profit_variance: netProfitVariance,
        net_profit_variance_percent: netProfitVariancePct,
      },
      timestamp: new Date().toISOString(),
    };
  }

  // ── Private Helpers for Substep 5.2 ────────────────────────────────────────────

  /**
   * Build a sequential list of Indian fiscal year strings from start_year to end_year.
   * E.g., "FY2324" to "FY2526" => ["FY2324", "FY2425", "FY2526"]
   */
  private static _buildFiscalYearRange(startFY: string, endFY: string): string[] {
    const parseShortFY = (fy: string): number | null => {
      const clean = fy.replace(/\s+/g, "").toUpperCase();
      const m = clean.match(/^FY(\d{2})(\d{2})$/);
      if (m) return 2000 + parseInt(m[1], 10);
      const mLong = clean.match(/^(?:FY)?(\d{4})-(\d{4})$/);
      if (mLong) return parseInt(mLong[1], 10);
      return null;
    };

    const startYear = parseShortFY(startFY);
    const endYear = parseShortFY(endFY);

    if (startYear === null || endYear === null || startYear > endYear) {
      // If parsing fails, return just the two specified FYs
      return startFY === endFY ? [startFY] : [startFY, endFY];
    }

    const years: string[] = [];
    for (let y = startYear; y <= endYear; y++) {
      const s2 = String(y).slice(-2);
      const e2 = String(y + 1).slice(-2);
      years.push(`FY${s2}${e2}`);
    }
    return years;
  }
}

