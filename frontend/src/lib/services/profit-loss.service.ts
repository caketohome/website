/**
 * CakeToHome ERP — Profit & Loss Service
 * Phase 5A Step 3: Read-only P&L statement derived from the authoritative GL.
 *
 * ARCHITECTURE:
 * 1. READ-ONLY: This service performs zero mutations. All data is queried via
 *    the existing AccountingJournalRepository.getTrialBalance() method.
 * 2. REUSES EXISTING INFRASTRUCTURE:
 *    - AccountingJournalRepository.getTrialBalance() for GL aggregation
 *    - AccountingAccountRepository.listAccounts() for parent_id hierarchy
 *    - getNormalBalance() for sign convention
 * 3. ACCOUNT CLASSIFICATION BY PARENT_ID HIERARCHY:
 *    - 4100 children → I. Operating Revenue
 *    - 4200 children → IV. Other Income
 *    - 5100 children → II. Cost of Goods Sold
 *    - 5200 children → III. Operating Expenses
 *    - 5300 children → V. Financial & Depreciation Expenses
 *    Account 5330 (Depreciation) has subtype OPERATING_EXPENSE but belongs
 *    under Financial group 5300 — parent_id grouping is authoritative.
 * 4. SIGN CONVENTION:
 *    - Revenue: normal balance CREDIT. net_balance = debit − credit.
 *      Earned revenue → negative net_balance. Negate for display (positive).
 *    - Expense: normal balance DEBIT. Positive net_balance. Use as-is.
 *    - 4190 (Sales Returns): REVENUE type but debit-heavy when returns exist.
 *      Treated as contra-revenue deduction.
 *    - 5190 (Purchase Discounts): EXPENSE type but credit-heavy.
 *      Treated as contra-expense deduction within COGS.
 * 5. RECONCILIATION:
 *    P&L net profit must reconcile to TB's revenue and expense account balances.
 *    No forced balancing — report variance if detected.
 * 6. SECURITY:
 *    - Branch isolation enforced from session (BOLA)
 *    - No client-controlled financial authority
 *    - No mutations
 *
 * PostgreSQL → Repository → Service → API → UI
 */

import type { PoolClient } from "pg";
import { AccountingJournalRepository } from "../repositories/accounting-journal.repository";
import { AccountingAccountRepository } from "../repositories/accounting-account.repository";
import type {
  TrialBalanceRow,
  AccountingAccountRow,
} from "../types/accounting.types";

// ─── Error Codes ────────────────────────────────────────────────────────────────

export type PLErrorCode =
  | "MISSING_DATE_RANGE"
  | "INVALID_DATE_FORMAT";

export class ProfitLossServiceError extends Error {
  readonly code: PLErrorCode;
  constructor(code: PLErrorCode, message: string) {
    super(message);
    this.name = "ProfitLossServiceError";
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

// ─── P&L Section Group Codes ────────────────────────────────────────────────────

const PL_SECTION_PARENT_CODES = {
  OPERATING_REVENUE: "4100",
  OTHER_INCOME: "4200",
  COGS: "5100",
  OPERATING_EXPENSES: "5200",
  FINANCIAL_EXPENSES: "5300",
} as const;

// Contra-account codes
const CONTRA_REVENUE_CODE = "4190"; // Sales Returns
const CONTRA_COGS_CODE = "5190";    // Purchase Discounts

// ─── Response Types ─────────────────────────────────────────────────────────────

export interface PLAccountLine {
  code: string;
  name: string;
  amount: number;
}

export interface PLOperatingRevenueSection {
  label: string;
  accounts: PLAccountLine[];
  gross_revenue: number;
  returns: PLAccountLine;
  net_revenue: number;
}

export interface PLCOGSSection {
  label: string;
  accounts: PLAccountLine[];
  discounts: PLAccountLine;
  total_cogs: number;
}

export interface PLSimpleSection {
  label: string;
  accounts: PLAccountLine[];
  total_opex?: number;
  total_other_income?: number;
  total_financial?: number;
}

export interface PLSummary {
  gross_profit: number;
  operating_profit: number;
  net_profit_before_tax: number;
}

export interface PLReconciliation {
  tb_revenue_total: number;
  tb_expense_total: number;
  tb_derived_profit: number;
  pnl_net_profit: number;
  is_reconciled: boolean;
  variance: number;
}

export interface ProfitLossResult {
  period: {
    start_date: string;
    end_date: string;
  };
  branch: {
    id: string | null;
    name: string;
  };
  sections: {
    operating_revenue: PLOperatingRevenueSection;
    cost_of_goods_sold: PLCOGSSection;
    operating_expenses: PLSimpleSection;
    other_income: PLSimpleSection;
    financial_expenses: PLSimpleSection;
  };
  summary: PLSummary;
  reconciliation: PLReconciliation;
}

export interface ProfitLossParams {
  startDate: string;
  endDate: string;
  branch_id?: string;
  exclude_closing_vouchers?: boolean;
}

// ─── ProfitLossService ──────────────────────────────────────────────────────────

export class ProfitLossService {
  /**
   * Generates a Profit & Loss statement for the specified period and scope.
   *
   * The P&L is derived entirely from the existing Trial Balance data:
   * 1. Fetches all account balances via getTrialBalance()
   * 2. Fetches the full CoA to resolve parent_id hierarchy
   * 3. Filters to REVENUE and EXPENSE type accounts only
   * 4. Classifies leaf accounts into 5 sections by parent group code
   * 5. Computes sign-corrected amounts, subtotals, and profit lines
   * 6. Performs reconciliation check against raw TB totals
   *
   * RBAC: Caller must have ACCOUNTING.VIEW (enforced at API layer).
   * Branch: Non-super-admin locked to session branch (enforced at API layer).
   */
  static async getProfitLoss(
    params: ProfitLossParams,
    branchIdFromSession: string | undefined,
    isSuperAdmin: boolean,
    client?: PoolClient
  ): Promise<ProfitLossResult> {
    // ── Validate required date range ────────────────────────────────────
    if (!params.startDate || !params.endDate) {
      throw new ProfitLossServiceError(
        "MISSING_DATE_RANGE",
        "Both start_date and end_date are required for P&L generation."
      );
    }
    if (!isValidDateStr(params.startDate)) {
      throw new ProfitLossServiceError(
        "INVALID_DATE_FORMAT",
        `Invalid start_date: '${params.startDate}'. Expected YYYY-MM-DD.`
      );
    }
    if (!isValidDateStr(params.endDate)) {
      throw new ProfitLossServiceError(
        "INVALID_DATE_FORMAT",
        `Invalid end_date: '${params.endDate}'. Expected YYYY-MM-DD.`
      );
    }

    // ── Resolve branch scope (BOLA enforcement) ─────────────────────────
    const effectiveBranchId = isSuperAdmin
      ? params.branch_id || undefined
      : branchIdFromSession || undefined;

    // ── 1. Fetch Trial Balance from existing repository ─────────────────
    const excludeClosing = params.exclude_closing_vouchers !== false;
    const tbRows: TrialBalanceRow[] = await AccountingJournalRepository.getTrialBalance(
      effectiveBranchId,
      params.startDate,
      params.endDate,
      excludeClosing,
      client
    );

    // ── 2. Fetch full CoA for parent_id hierarchy resolution ────────────
    const allAccounts: AccountingAccountRow[] = await AccountingAccountRepository.listAccounts({
      is_active: true,
    }, client);

    // Build lookup maps
    const accountById = new Map<string, AccountingAccountRow>();
    const accountByCode = new Map<string, AccountingAccountRow>();
    for (const acct of allAccounts) {
      accountById.set(acct.id, acct);
      accountByCode.set(acct.code, acct);
    }

    // Build parent code lookup: account_id → parent account code
    // For section assignment, we need the level-2 parent group code
    function getParentGroupCode(accountId: string): string | null {
      const acct = accountById.get(accountId);
      if (!acct || !acct.parent_id) return null;
      const parent = accountById.get(acct.parent_id);
      if (!parent) return null;
      // If parent is a level-2 group (4100, 4200, 5100, 5200, 5300), return its code
      if (parent.level === 2 && parent.is_group) {
        return parent.code;
      }
      // If the parent is level-1 (4000, 5000), the account itself may be a group
      // This shouldn't happen for leaf accounts in our 3-level CoA
      return parent.code;
    }

    // ── 3. Filter to REVENUE and EXPENSE leaf accounts ──────────────────
    const revenueExpenseRows = tbRows.filter(
      (r) => (r.type === "REVENUE" || r.type === "EXPENSE") && !r.is_group
    );

    // ── 4. Classify accounts into sections by parent group code ─────────
    // Initialize section buckets
    const operatingRevenueAccounts: PLAccountLine[] = [];
    let returnsLine: PLAccountLine = { code: CONTRA_REVENUE_CODE, name: "Sales Returns, Refunds & Allowances", amount: 0 };

    const cogsAccounts: PLAccountLine[] = [];
    let discountsLine: PLAccountLine = { code: CONTRA_COGS_CODE, name: "Purchase Discounts Received", amount: 0 };

    const opexAccounts: PLAccountLine[] = [];
    const otherIncomeAccounts: PLAccountLine[] = [];
    const financialAccounts: PLAccountLine[] = [];

    for (const row of revenueExpenseRows) {
      const parentCode = getParentGroupCode(row.account_id);
      const netBal = Number(row.net_balance) || 0;

      // Sign correction:
      // Revenue: net_balance = debit − credit. Earned revenue is negative. Negate for display.
      // Expense: net_balance = debit − credit. Incurred expense is positive. Use as-is.
      let displayAmount: number;
      if (row.type === "REVENUE") {
        displayAmount = round2(-netBal); // Negate: credit-heavy → positive
      } else {
        displayAmount = round2(netBal);   // Use as-is: debit-heavy → positive
      }

      const line: PLAccountLine = {
        code: row.code,
        name: row.name,
        amount: displayAmount,
      };

      // Classify by parent group code
      if (parentCode === PL_SECTION_PARENT_CODES.OPERATING_REVENUE) {
        if (row.code === CONTRA_REVENUE_CODE) {
          returnsLine = line;
        } else {
          operatingRevenueAccounts.push(line);
        }
      } else if (parentCode === PL_SECTION_PARENT_CODES.OTHER_INCOME) {
        otherIncomeAccounts.push(line);
      } else if (parentCode === PL_SECTION_PARENT_CODES.COGS) {
        if (row.code === CONTRA_COGS_CODE) {
          discountsLine = line;
        } else {
          cogsAccounts.push(line);
        }
      } else if (parentCode === PL_SECTION_PARENT_CODES.OPERATING_EXPENSES) {
        opexAccounts.push(line);
      } else if (parentCode === PL_SECTION_PARENT_CODES.FINANCIAL_EXPENSES) {
        financialAccounts.push(line);
      }
      // Accounts with no recognized parent group code are excluded
      // (shouldn't happen with our CoA, but fail-safe)
    }

    // ── 5. Compute subtotals and profit lines ───────────────────────────

    // I. Operating Revenue
    const grossRevenue = round2(operatingRevenueAccounts.reduce((s, a) => s + a.amount, 0));
    // Returns: for a contra-revenue account, when returns are posted,
    // debit > credit, so net_balance > 0, and after our sign correction
    // (negation for REVENUE type), displayAmount is negative.
    // But we want to show returns as a positive deduction.
    // If no returns, amount is 0. If returns exist, amount is negative (credit was less).
    // Actually: returns have debit > credit, net_balance positive, -net_balance = negative display.
    // We show returns as a positive number and subtract it.
    const returnsAmount = Math.abs(returnsLine.amount);
    returnsLine.amount = returnsAmount; // Normalize for display
    const netRevenue = round2(grossRevenue - returnsAmount);

    // II. COGS
    const cogsGross = round2(cogsAccounts.reduce((s, a) => s + a.amount, 0));
    // Discounts: contra-expense. Credit-heavy when discounts exist.
    // net_balance negative, displayAmount negative (used as-is for expense → positive, but
    // credit-heavy → negative net_balance → negative display).
    // We want discounts as a positive deduction.
    const discountsAmount = Math.abs(discountsLine.amount);
    discountsLine.amount = discountsAmount; // Normalize for display
    const totalCogs = round2(cogsGross - discountsAmount);

    // Gross Profit
    const grossProfit = round2(netRevenue - totalCogs);

    // III. Operating Expenses
    const totalOpex = round2(opexAccounts.reduce((s, a) => s + a.amount, 0));

    // Operating Profit (EBIT)
    const operatingProfit = round2(grossProfit - totalOpex);

    // IV. Other Income
    const totalOtherIncome = round2(otherIncomeAccounts.reduce((s, a) => s + a.amount, 0));

    // V. Financial & Depreciation Expenses
    const totalFinancial = round2(financialAccounts.reduce((s, a) => s + a.amount, 0));

    // Net Profit Before Tax
    const netProfitBeforeTax = round2(operatingProfit + totalOtherIncome - totalFinancial);

    // ── 6. Reconciliation against TB ────────────────────────────────────
    // TB reconciliation: sum all REVENUE and EXPENSE rows from TB (including groups? No — leaf only)
    let tbRevenueTotal = 0;
    let tbExpenseTotal = 0;

    for (const row of revenueExpenseRows) {
      const totalDebit = Number(row.total_debit) || 0;
      const totalCredit = Number(row.total_credit) || 0;
      if (row.type === "REVENUE") {
        // Revenue earned = credit − debit (positive when credit > debit)
        tbRevenueTotal += (totalCredit - totalDebit);
      } else if (row.type === "EXPENSE") {
        // Expense incurred = debit − credit (positive when debit > credit)
        tbExpenseTotal += (totalDebit - totalCredit);
      }
    }

    tbRevenueTotal = round2(tbRevenueTotal);
    tbExpenseTotal = round2(tbExpenseTotal);
    const tbDerivedProfit = round2(tbRevenueTotal - tbExpenseTotal);
    const variance = round2(Math.abs(netProfitBeforeTax - tbDerivedProfit));

    // ── 7. Build response ───────────────────────────────────────────────
    return {
      period: {
        start_date: params.startDate,
        end_date: params.endDate,
      },
      branch: {
        id: effectiveBranchId || null,
        name: effectiveBranchId ? "Branch Filtered" : "Enterprise (All Branches)",
      },
      sections: {
        operating_revenue: {
          label: "I. Operating Revenue",
          accounts: operatingRevenueAccounts,
          gross_revenue: grossRevenue,
          returns: returnsLine,
          net_revenue: netRevenue,
        },
        cost_of_goods_sold: {
          label: "II. Cost of Goods Sold",
          accounts: cogsAccounts,
          discounts: discountsLine,
          total_cogs: totalCogs,
        },
        operating_expenses: {
          label: "III. Operating Expenses",
          accounts: opexAccounts,
          total_opex: totalOpex,
        },
        other_income: {
          label: "IV. Other Income",
          accounts: otherIncomeAccounts,
          total_other_income: totalOtherIncome,
        },
        financial_expenses: {
          label: "V. Financial & Depreciation Expenses",
          accounts: financialAccounts,
          total_financial: totalFinancial,
        },
      },
      summary: {
        gross_profit: grossProfit,
        operating_profit: operatingProfit,
        net_profit_before_tax: netProfitBeforeTax,
      },
      reconciliation: {
        tb_revenue_total: tbRevenueTotal,
        tb_expense_total: tbExpenseTotal,
        tb_derived_profit: tbDerivedProfit,
        pnl_net_profit: netProfitBeforeTax,
        is_reconciled: variance < 0.01,
        variance,
      },
    };
  }
}

// ─── Helpers ────────────────────────────────────────────────────────────────────

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
