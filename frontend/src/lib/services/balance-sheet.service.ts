/**
 * CakeToHome ERP — Balance Sheet Service
 * Phase 5A Step 4: Authoritative, read-only Balance Sheet financial statement
 * derived entirely from the double-entry General Ledger.
 *
 * ARCHITECTURE & LOCKED DECISIONS:
 * 1. READ-ONLY: Strictly zero mutations. No tables created, no journal writes.
 * 2. ACCOUNT CLASSIFICATION BY PARENT_ID HIERARCHY:
 *    - 1100 children (1110, 1120, 1130, 1140) → Current Assets
 *    - 1500 children → Non-Current Assets (PP&E Fixed Assets)
 *    - 2100 children (2110, 2120, 2130, 2140, 2150) → Current Liabilities
 *    - 2500 children (2510) → Non-Current Liabilities
 *    - 3000 children (3100, 3200, 3300) → Equity
 * 3. CONTRA-ACCOUNTS:
 *    - 1590 (Accumulated Depreciation): Contra-asset. Normal balance CREDIT.
 *      Deducted from Gross Fixed Assets: Net Fixed = Gross - |1590|.
 *    - 3120 (Drawings / Distributions): Contra-equity. Normal balance DEBIT.
 *      Deducted from Partner Capital: Net Capital = 3110 - 3120.
 * 4. ACCOUNT 3300 (Opening Balance Offset / Capital Reserve):
 *    - Remains a presentation account under Equity.
 *    - Presents actual GL balance from Trial Balance.
 *    - No automated transfer, closing, or reclassification voucher.
 * 5. ACCOUNT 3220 (Current Year Net Earnings):
 *    - Dynamically computed as: Posted 3220 GL balance + (Revenue − Expense).
 *    - Derived from nominal accounts to maintain real-time mathematical balance.
 *    - Zero writes back to 3220.
 * 6. MATHEMATICAL IDENTITY & RECONCILIATION:
 *    Assets = Liabilities + Equity
 *    Variance calculated explicitly; is_balanced = (variance < 0.01).
 *    No artificial forcing.
 * 7. SCOPE & BOLA:
 *    - Enterprise scope aggregates all branches.
 *    - Branch scope is server-enforced from session (non-super-admin locked to branch).
 *    - ACCOUNTING.VIEW required.
 *
 * PostgreSQL → AccountingJournalRepository → BalanceSheetService → API → UI
 */

import { AccountingJournalRepository } from "../repositories/accounting-journal.repository";
import { AccountingAccountRepository } from "../repositories/accounting-account.repository";
import type {
  TrialBalanceRow,
  AccountingAccountRow,
} from "../types/accounting.types";

// ─── Error Codes ────────────────────────────────────────────────────────────────

export type BalanceSheetErrorCode =
  | "MISSING_AS_OF_DATE"
  | "INVALID_DATE_FORMAT"
  | "FORBIDDEN";

export class BalanceSheetServiceError extends Error {
  readonly code: BalanceSheetErrorCode;
  constructor(code: BalanceSheetErrorCode, message: string) {
    super(message);
    this.name = "BalanceSheetServiceError";
    this.code = code;
  }
}

// ─── Date Validation ────────────────────────────────────────────────────────────

const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;

function isValidDateStr(s: string | undefined | null): s is string {
  if (!s) return false;
  if (!DATE_REGEX.test(s)) return false;
  const d = new Date(s);
  return !isNaN(d.getTime());
}

function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

// ─── Known CoA Account & Group Codes ───────────────────────────────────────────

const BS_GROUP_CODES = {
  CURRENT_ASSETS: "1100",
  CASH_EQUIVALENTS: "1110",
  RECEIVABLES: "1120",
  INVENTORIES: "1130",
  INPUT_TAX: "1140",
  FIXED_ASSETS: "1500",
  CURRENT_LIABILITIES: "2100",
  TRADE_PAYABLES: "2110",
  OUTPUT_TAX: "2120",
  TDS_PAYABLE: "2130",
  ADVANCES_UNEARNED: "2140",
  OPERATING_ACCRUALS: "2150",
  LONG_TERM_LIABILITIES: "2500",
  EQUITY: "3000",
  CAPITAL_RESERVES: "3100",
  RETAINED_EARNINGS: "3200",
} as const;

// Specific leaf accounts with specialized accounting presentation
const SPECIAL_ACCOUNTS = {
  ACCUMULATED_DEPRECIATION: "1590", // Contra-asset (Fixed Assets)
  PARTNER_CAPITAL: "3110",          // Equity: Contributed Capital
  DRAWINGS: "3120",                 // Contra-equity (Capital & Reserves)
  RETAINED_EARNINGS_PRIOR: "3210",   // Equity: Prior Years
  CURRENT_YEAR_EARNINGS: "3220",     // Equity: Current Year Net Earnings
  OPENING_BALANCE_OFFSET: "3300",    // Equity: Opening Balance Offset
} as const;

// ─── Response Interfaces ────────────────────────────────────────────────────────

export interface BSAccountLine {
  code: string;
  name: string;
  amount: number;
}

export interface BSGroupCategory {
  group_code: string;
  group_name: string;
  accounts: BSAccountLine[];
  subtotal: number;
}

export interface BSCurrentAssetsSection {
  label: string;
  categories: BSGroupCategory[];
  total_current_assets: number;
}

export interface BSFixedAssetsSection {
  label: string;
  gross_fixed_assets: BSAccountLine[];
  gross_subtotal: number;
  accumulated_depreciation: BSAccountLine;
  net_fixed_assets: number;
}

export interface BSCurrentLiabilitiesSection {
  label: string;
  categories: BSGroupCategory[];
  other_current_liabilities: BSAccountLine[];
  total_current_liabilities: number;
}

export interface BSLongTermLiabilitiesSection {
  label: string;
  accounts: BSAccountLine[];
  total_long_term_liabilities: number;
}

export interface BSEquitySection {
  label: string;
  capital: BSAccountLine;
  drawings: BSAccountLine;
  net_capital: number;
  retained_earnings_prior: BSAccountLine;
  current_year_net_earnings: BSAccountLine;
  opening_balance_offset: BSAccountLine;
  total_equity: number;
}

export interface BSSummary {
  total_assets: number;
  total_liabilities: number;
  total_equity: number;
  total_liabilities_and_equity: number;
  net_working_capital: number;
}

export interface BSReconciliation {
  total_assets: number;
  total_liabilities_and_equity: number;
  difference: number;
  is_balanced: boolean;
  dynamic_pnl_profit: number;
  posted_3220_balance: number;
}

export interface BalanceSheetResult {
  as_of_date: string;
  branch: {
    id: string | null;
    name: string;
  };
  sections: {
    current_assets: BSCurrentAssetsSection;
    fixed_assets: BSFixedAssetsSection;
    current_liabilities: BSCurrentLiabilitiesSection;
    long_term_liabilities: BSLongTermLiabilitiesSection;
    equity: BSEquitySection;
  };
  summary: BSSummary;
  reconciliation: BSReconciliation;
  comparison?: BalanceSheetResult;
}

export interface BalanceSheetParams {
  as_of_date: string;
  branch_id?: string;
  compare_date?: string;
}

// ─── BalanceSheetService ────────────────────────────────────────────────────────

export class BalanceSheetService {
  /**
   * Generates an authoritative Balance Sheet statement as of a specific date.
   *
   * Derived purely from the double-entry GL via getTrialBalance(effectiveBranchId, undefined, asOfDate).
   *
   * @param params               Parameters containing as_of_date, optional branch_id, optional compare_date
   * @param branchIdFromSession  Branch ID from authenticated user token
   * @param isSuperAdmin         Whether authenticated caller has SUPER_ADMIN role
   */
  static async getBalanceSheet(
    params: BalanceSheetParams,
    branchIdFromSession: string | undefined,
    isSuperAdmin: boolean
  ): Promise<BalanceSheetResult> {
    // ── 1. Validate required as_of_date ─────────────────────────────────
    if (!params.as_of_date) {
      throw new BalanceSheetServiceError(
        "MISSING_AS_OF_DATE",
        "Query parameter 'as_of_date' is required for Balance Sheet generation."
      );
    }
    if (!isValidDateStr(params.as_of_date)) {
      throw new BalanceSheetServiceError(
        "INVALID_DATE_FORMAT",
        `Invalid as_of_date: '${params.as_of_date}'. Expected YYYY-MM-DD.`
      );
    }

    if (params.compare_date && !isValidDateStr(params.compare_date)) {
      throw new BalanceSheetServiceError(
        "INVALID_DATE_FORMAT",
        `Invalid compare_date: '${params.compare_date}'. Expected YYYY-MM-DD.`
      );
    }

    // ── 2. BOLA Enforcement ─────────────────────────────────────────────
    let effectiveBranchId: string | undefined;
    if (isSuperAdmin) {
      effectiveBranchId = params.branch_id || undefined;
    } else {
      if (params.branch_id && params.branch_id !== branchIdFromSession) {
        throw new BalanceSheetServiceError(
          "FORBIDDEN",
          "Forbidden: You cannot view financial statements for another branch."
        );
      }
      effectiveBranchId = branchIdFromSession || undefined;
    }

    // ── 3. Generate primary Balance Sheet snapshot ───────────────────────
    const primarySnapshot = await this.generateSnapshot(
      params.as_of_date,
      effectiveBranchId
    );

    // ── 4. Generate comparison snapshot if requested ────────────────────
    if (params.compare_date) {
      primarySnapshot.comparison = await this.generateSnapshot(
        params.compare_date,
        effectiveBranchId
      );
    }

    return primarySnapshot;
  }

  /**
   * Internal generator for a point-in-time Balance Sheet snapshot.
   */
  private static async generateSnapshot(
    asOfDate: string,
    branchId?: string
  ): Promise<BalanceSheetResult> {
    // A. Query Trial Balance up to asOfDate
    const tbRows: TrialBalanceRow[] = await AccountingJournalRepository.getTrialBalance(
      branchId,
      undefined,
      asOfDate
    );

    // B. Query full Chart of Accounts for hierarchy resolution
    const allAccounts: AccountingAccountRow[] = await AccountingAccountRepository.listAccounts({
      is_active: true,
    });

    // C. Build lookup maps
    const accountById = new Map<string, AccountingAccountRow>();
    const accountByCode = new Map<string, AccountingAccountRow>();
    for (const acct of allAccounts) {
      accountById.set(acct.id, acct);
      accountByCode.set(acct.code, acct);
    }

    // Lookup row balance by account code
    const tbRowByCode = new Map<string, TrialBalanceRow>();
    for (const r of tbRows) {
      tbRowByCode.set(r.code, r);
    }

    // D. Helper to resolve parent account code
    function getParentCode(accountId: string): string | null {
      const acct = accountById.get(accountId);
      if (!acct || !acct.parent_id) return null;
      const parent = accountById.get(acct.parent_id);
      return parent ? parent.code : null;
    }

    // ── I. CURRENT ASSETS (Group 1100) ──────────────────────────────────
    // Categories:
    // 1110: Cash and Cash Equivalents
    // 1120: Receivables and Advances
    // 1130: Inventories
    // 1140: Duties & Taxes - Input Tax Credit
    const currentAssetCategoryDefs = [
      { code: BS_GROUP_CODES.CASH_EQUIVALENTS, name: "Cash and Cash Equivalents" },
      { code: BS_GROUP_CODES.RECEIVABLES, name: "Receivables and Advances" },
      { code: BS_GROUP_CODES.INVENTORIES, name: "Inventories" },
      { code: BS_GROUP_CODES.INPUT_TAX, name: "Duties & Taxes - Input Tax Credit" },
    ];

    const currentAssetCategories: BSGroupCategory[] = currentAssetCategoryDefs.map((def) => {
      // Find all leaf accounts whose direct parent is this group
      const leafAccounts = allAccounts
        .filter((a) => !a.is_group && a.type === "ASSET" && getParentCode(a.id) === def.code)
        .sort((a, b) => a.code.localeCompare(b.code));

      const lines: BSAccountLine[] = leafAccounts.map((a) => {
        const tb = tbRowByCode.get(a.code);
        // Regular assets: normal debit. net_balance = debit - credit.
        const netBal = Number(tb?.net_balance) || 0;
        return {
          code: a.code,
          name: a.name,
          amount: round2(netBal),
        };
      });

      const subtotal = round2(lines.reduce((sum, l) => sum + l.amount, 0));
      return {
        group_code: def.code,
        group_name: def.name,
        accounts: lines,
        subtotal,
      };
    });

    const totalCurrentAssets = round2(
      currentAssetCategories.reduce((sum, c) => sum + c.subtotal, 0)
    );

    // ── II. NON-CURRENT / FIXED ASSETS (Group 1500) ──────────────────────
    const fixedAssetLeaves = allAccounts
      .filter((a) => !a.is_group && a.type === "ASSET" && getParentCode(a.id) === BS_GROUP_CODES.FIXED_ASSETS)
      .sort((a, b) => a.code.localeCompare(b.code));

    const grossFixedAssets: BSAccountLine[] = [];
    let accumulatedDepreciationLine: BSAccountLine = {
      code: SPECIAL_ACCOUNTS.ACCUMULATED_DEPRECIATION,
      name: "Accumulated Depreciation",
      amount: 0,
    };

    for (const a of fixedAssetLeaves) {
      const tb = tbRowByCode.get(a.code);
      const netBal = Number(tb?.net_balance) || 0;

      if (a.code === SPECIAL_ACCOUNTS.ACCUMULATED_DEPRECIATION) {
        // Contra-asset: normal balance is CREDIT. In TB, credit > debit -> net_balance <= 0.
        // Present as positive deduction line.
        accumulatedDepreciationLine = {
          code: a.code,
          name: a.name,
          amount: round2(Math.abs(netBal)),
        };
      } else {
        grossFixedAssets.push({
          code: a.code,
          name: a.name,
          amount: round2(netBal),
        });
      }
    }

    const grossFixedSubtotal = round2(grossFixedAssets.reduce((sum, a) => sum + a.amount, 0));
    const netFixedAssets = round2(grossFixedSubtotal - accumulatedDepreciationLine.amount);

    const totalAssets = round2(totalCurrentAssets + netFixedAssets);

    // ── III. CURRENT LIABILITIES (Group 2100) ───────────────────────────
    // Sub-groups: 2110 (Trade Payables), 2120 (Output GST), 2140 (Advances), 2150 (Accruals)
    // Direct child: 2130 (TDS Payable)
    const currentLiabCategoryDefs = [
      { code: BS_GROUP_CODES.TRADE_PAYABLES, name: "Trade Payables" },
      { code: BS_GROUP_CODES.OUTPUT_TAX, name: "Duties & Taxes - Output Tax Liability" },
      { code: BS_GROUP_CODES.ADVANCES_UNEARNED, name: "Advances & Unearned Revenue" },
      { code: BS_GROUP_CODES.OPERATING_ACCRUALS, name: "Operating Accruals & Staff Payables" },
    ];

    const currentLiabCategories: BSGroupCategory[] = currentLiabCategoryDefs.map((def) => {
      const leafAccounts = allAccounts
        .filter((a) => !a.is_group && a.type === "LIABILITY" && getParentCode(a.id) === def.code)
        .sort((a, b) => a.code.localeCompare(b.code));

      const lines: BSAccountLine[] = leafAccounts.map((a) => {
        const tb = tbRowByCode.get(a.code);
        // Regular liabilities: normal credit. In TB: credit - debit = -net_balance.
        const netBal = Number(tb?.net_balance) || 0;
        return {
          code: a.code,
          name: a.name,
          amount: round2(-netBal),
        };
      });

      const subtotal = round2(lines.reduce((sum, l) => sum + l.amount, 0));
      return {
        group_code: def.code,
        group_name: def.name,
        accounts: lines,
        subtotal,
      };
    });

    // Other Current Liabilities (leaves whose direct parent is 2100 itself, e.g. 2130 TDS Payable)
    const otherCurrentLiabLeaves = allAccounts
      .filter((a) => !a.is_group && a.type === "LIABILITY" && getParentCode(a.id) === BS_GROUP_CODES.CURRENT_LIABILITIES)
      .sort((a, b) => a.code.localeCompare(b.code));

    const otherCurrentLiabilities: BSAccountLine[] = otherCurrentLiabLeaves.map((a) => {
      const tb = tbRowByCode.get(a.code);
      const netBal = Number(tb?.net_balance) || 0;
      return {
        code: a.code,
        name: a.name,
        amount: round2(-netBal),
      };
    });

    const otherCurrentLiabSubtotal = round2(
      otherCurrentLiabilities.reduce((sum, a) => sum + a.amount, 0)
    );

    const totalCurrentLiabilities = round2(
      currentLiabCategories.reduce((sum, c) => sum + c.subtotal, 0) + otherCurrentLiabSubtotal
    );

    // ── IV. LONG-TERM LIABILITIES (Group 2500) ──────────────────────────
    const longTermLiabLeaves = allAccounts
      .filter((a) => !a.is_group && a.type === "LIABILITY" && getParentCode(a.id) === BS_GROUP_CODES.LONG_TERM_LIABILITIES)
      .sort((a, b) => a.code.localeCompare(b.code));

    const longTermLiabilities: BSAccountLine[] = longTermLiabLeaves.map((a) => {
      const tb = tbRowByCode.get(a.code);
      const netBal = Number(tb?.net_balance) || 0;
      return {
        code: a.code,
        name: a.name,
        amount: round2(-netBal),
      };
    });

    const totalLongTermLiabilities = round2(
      longTermLiabilities.reduce((sum, a) => sum + a.amount, 0)
    );

    const totalLiabilities = round2(totalCurrentLiabilities + totalLongTermLiabilities);

    // ── V. EQUITY (Group 3000) ──────────────────────────────────────────
    // 3110 Partner / Shareholder Capital
    const tb3110 = tbRowByCode.get(SPECIAL_ACCOUNTS.PARTNER_CAPITAL);
    const capitalAmount = round2(-(Number(tb3110?.net_balance) || 0));
    const capitalLine: BSAccountLine = {
      code: SPECIAL_ACCOUNTS.PARTNER_CAPITAL,
      name: tb3110?.name || "Partner / Shareholder Capital",
      amount: capitalAmount,
    };

    // 3120 Drawings / Distributions (Contra-equity, normal debit)
    const tb3120 = tbRowByCode.get(SPECIAL_ACCOUNTS.DRAWINGS);
    // Debit-heavy is positive in net_balance; present as positive deduction
    const drawingsAmount = round2(Math.abs(Number(tb3120?.net_balance) || 0));
    const drawingsLine: BSAccountLine = {
      code: SPECIAL_ACCOUNTS.DRAWINGS,
      name: tb3120?.name || "Drawings / Distributions",
      amount: drawingsAmount,
    };
    const netCapital = round2(capitalAmount - drawingsAmount);

    // 3210 Retained Earnings (Prior Years)
    const tb3210 = tbRowByCode.get(SPECIAL_ACCOUNTS.RETAINED_EARNINGS_PRIOR);
    const priorRetainedEarningsAmount = round2(-(Number(tb3210?.net_balance) || 0));
    const retainedEarningsPriorLine: BSAccountLine = {
      code: SPECIAL_ACCOUNTS.RETAINED_EARNINGS_PRIOR,
      name: tb3210?.name || "Retained Earnings (Prior Years)",
      amount: priorRetainedEarningsAmount,
    };

    // 3220 Current Year Net Earnings (Dynamic P&L Roll-Up)
    // Locked decision 2: Posted 3220 GL balance + (Revenue − Expense)
    const tb3220 = tbRowByCode.get(SPECIAL_ACCOUNTS.CURRENT_YEAR_EARNINGS);
    const posted3220Balance = round2(-(Number(tb3220?.net_balance) || 0));

    // Derive unclosed P&L Net Profit up to asOfDate
    let dynamicPnlRevenue = 0;
    let dynamicPnlExpense = 0;
    for (const r of tbRows) {
      if (!r.is_group) {
        const totalDebit = Number(r.total_debit) || 0;
        const totalCredit = Number(r.total_credit) || 0;
        if (r.type === "REVENUE") {
          dynamicPnlRevenue += (totalCredit - totalDebit);
        } else if (r.type === "EXPENSE") {
          dynamicPnlExpense += (totalDebit - totalCredit);
        }
      }
    }
    const dynamicPnlProfit = round2(dynamicPnlRevenue - dynamicPnlExpense);
    const currentYearNetEarningsAmount = round2(posted3220Balance + dynamicPnlProfit);

    const currentYearNetEarningsLine: BSAccountLine = {
      code: SPECIAL_ACCOUNTS.CURRENT_YEAR_EARNINGS,
      name: tb3220?.name || "Current Year Net Earnings",
      amount: currentYearNetEarningsAmount,
    };

    // 3300 Opening Balance Offset / Capital Reserve
    // Locked decision 1: Remains presentation account presenting actual GL balance
    const tb3300 = tbRowByCode.get(SPECIAL_ACCOUNTS.OPENING_BALANCE_OFFSET);
    // Normal credit for equity offset; if credit > debit, positive; if debit > credit, negative
    const obOffsetAmount = round2(-(Number(tb3300?.net_balance) || 0));
    const openingBalanceOffsetLine: BSAccountLine = {
      code: SPECIAL_ACCOUNTS.OPENING_BALANCE_OFFSET,
      name: tb3300?.name || "Opening Balance Offset / Capital Reserve",
      amount: obOffsetAmount,
    };

    const totalEquity = round2(
      netCapital +
      priorRetainedEarningsAmount +
      currentYearNetEarningsAmount +
      obOffsetAmount
    );

    // ── VI. RECONCILIATION & BALANCE INVARIANT ───────────────────────────
    const totalLiabilitiesAndEquity = round2(totalLiabilities + totalEquity);
    const difference = round2(Math.abs(totalAssets - totalLiabilitiesAndEquity));
    const isBalanced = difference < 0.01;
    const netWorkingCapital = round2(totalCurrentAssets - totalCurrentLiabilities);

    // ── VII. BUILD RESULT ────────────────────────────────────────────────
    return {
      as_of_date: asOfDate,
      branch: {
        id: branchId || null,
        name: branchId ? "Branch Filtered" : "Enterprise (All Branches)",
      },
      sections: {
        current_assets: {
          label: "Current Assets",
          categories: currentAssetCategories,
          total_current_assets: totalCurrentAssets,
        },
        fixed_assets: {
          label: "Non-Current Assets (PP&E)",
          gross_fixed_assets: grossFixedAssets,
          gross_subtotal: grossFixedSubtotal,
          accumulated_depreciation: accumulatedDepreciationLine,
          net_fixed_assets: netFixedAssets,
        },
        current_liabilities: {
          label: "Current Liabilities",
          categories: currentLiabCategories,
          other_current_liabilities: otherCurrentLiabilities,
          total_current_liabilities: totalCurrentLiabilities,
        },
        long_term_liabilities: {
          label: "Non-Current Liabilities",
          accounts: longTermLiabilities,
          total_long_term_liabilities: totalLongTermLiabilities,
        },
        equity: {
          label: "Owner's Equity",
          capital: capitalLine,
          drawings: drawingsLine,
          net_capital: netCapital,
          retained_earnings_prior: retainedEarningsPriorLine,
          current_year_net_earnings: currentYearNetEarningsLine,
          opening_balance_offset: openingBalanceOffsetLine,
          total_equity: totalEquity,
        },
      },
      summary: {
        total_assets: totalAssets,
        total_liabilities: totalLiabilities,
        total_equity: totalEquity,
        total_liabilities_and_equity: totalLiabilitiesAndEquity,
        net_working_capital: netWorkingCapital,
      },
      reconciliation: {
        total_assets: totalAssets,
        total_liabilities_and_equity: totalLiabilitiesAndEquity,
        difference,
        is_balanced: isBalanced,
        dynamic_pnl_profit: dynamicPnlProfit,
        posted_3220_balance: posted3220Balance,
      },
    };
  }
}
