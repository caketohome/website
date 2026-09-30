/**
 * CakeToHome ERP — Cash Flow Statement Service
 * Phase 5A Step 5: Authoritative, read-only Cash Flow Statement
 * derived entirely from the double-entry General Ledger.
 *
 * ARCHITECTURE & LOCKED ACCOUNTING DECISIONS:
 * 1. READ-ONLY: Strictly zero database mutations. Zero temporary tables, zero journal writes.
 * 2. CASH BOUNDARY: Exactly the 6 accounts under 1110 Cash and Cash Equivalents:
 *    - 1111 Cash in Hand
 *    - 1112 Bank Operating A/c
 *    - 1113 Gateway Clearing (authoritative liquid cash equivalent per design gate)
 *    - 1114 Petty Cash - Branches
 *    - 1118 Deposit in Transit
 *    - 1119 Unclassified Suspense
 * 3. 1122 UNDEPOSITED COD:
 *    - Sits under 1120 Receivables and Advances.
 *    - Preserved as Operating Working Capital (Receivable), NOT a cash equivalent.
 *    - Rider remittance (Dr 1111 / Cr 1122) is recognized as cash collected from customers.
 * 4. INTERNAL TRANSFERS:
 *    - Contra movements between cash accounts (1111 ↔ 1118 ↔ 1112, 1113 ↔ 1112, 1112 ↔ 1114).
 *    - Net cash impact is strictly ₹0.00; excluded from gross flows to prevent inflation.
 * 5. DIRECT METHOD:
 *    - Derived from cash-touching journal entries and non-cash counterparty classifications.
 * 6. INDIRECT METHOD:
 *    - Sourced from Net Profit Before Tax, adding back non-cash 5330 Depreciation,
 *      and applying the working capital delta schedule.
 * 7. INVARIANTS:
 *    - Dual-Method Convergence: Direct CFO ≡ Indirect CFO (variance < 0.01).
 *    - Cash Equation: Opening Cash + CFO + CFI + CFF ≡ Closing Cash (variance < 0.01).
 *    - Balance Sheet Match: Closing Cash ≡ Balance Sheet 1110 Cash & Cash Equivalents.
 * 8. NO BALANCING PLUG:
 *    - All variances are explicitly calculated and exposed.
 * 9. SCOPE & BOLA:
 *    - Enterprise scope consolidates all branches.
 *    - Branch scope is server-enforced from session (non-super-admin locked to branch).
 *    - ACCOUNTING.VIEW permission enforced.
 *
 * PostgreSQL → AccountingJournalRepository → CashFlowService → API → UI
 */

import { dbQuery } from "../db";
import { AccountingJournalRepository } from "../repositories/accounting-journal.repository";
import type { TrialBalanceRow } from "../types/accounting.types";

// ─── Error Codes ────────────────────────────────────────────────────────────────

export type CashFlowErrorCode =
  | "MISSING_DATE_RANGE"
  | "INVALID_DATE_FORMAT"
  | "INVALID_DATE_RANGE"
  | "FORBIDDEN";

export class CashFlowServiceError extends Error {
  readonly code: CashFlowErrorCode;
  constructor(code: CashFlowErrorCode, message: string) {
    super(message);
    this.name = "CashFlowServiceError";
    this.code = code;
  }
}

// ─── Constants & Account Definitions ───────────────────────────────────────────

export const CASH_ACCOUNT_CODES = [
  "1111", // Cash in Hand
  "1112", // Bank Operating A/c
  "1113", // Gateway Clearing
  "1114", // Petty Cash - Branches
  "1118", // Deposit in Transit
  "1119", // Unclassified Suspense
] as const;

export type CashAccountCode = typeof CASH_ACCOUNT_CODES[number];

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

// ─── Response Interfaces ────────────────────────────────────────────────────────

export interface CashFlowLineItem {
  key: string;
  label: string;
  amount: number;
  transaction_count?: number;
}

export interface CashFlowSection {
  label: string;
  inflows: CashFlowLineItem[];
  outflows: CashFlowLineItem[];
  total_inflows: number;
  total_outflows: number;
  net_amount: number;
}

export interface DirectCashFlowSchedule {
  operating: CashFlowSection;
  investing: CashFlowSection;
  financing: CashFlowSection;
  internal_transfers: {
    label: string;
    total_volume: number;
    net_impact: number;
    description: string;
  };
  net_cash_movement: number;
}

export interface IndirectWorkingCapitalItem {
  account_code: string;
  account_name: string;
  category: "CURRENT_ASSET" | "CURRENT_LIABILITY";
  opening_balance: number;
  closing_balance: number;
  balance_delta: number;
  cash_impact: number;
}

export interface IndirectCashFlowSchedule {
  net_profit_before_tax: number;
  non_cash_adjustments: {
    depreciation: number;
    finance_interest: number;
    subtotal: number;
  };
  operating_profit_before_wc: number;
  working_capital_adjustments: {
    items: IndirectWorkingCapitalItem[];
    subtotal: number;
  };
  net_operating_cash_flow: number;
}

export interface CashFlowSummary {
  opening_cash: number;
  net_operating_cash: number;
  net_investing_cash: number;
  net_financing_cash: number;
  net_cash_change: number;
  closing_cash: number;
}

export interface CashFlowReconciliation {
  opening_cash: number;
  net_operating_cash_direct: number;
  net_operating_cash_indirect: number;
  dual_method_variance: number;
  is_dual_method_converged: boolean;
  net_investing_cash: number;
  net_financing_cash: number;
  net_cash_movement: number;
  closing_cash: number;
  balance_sheet_cash_match: number;
  balance_sheet_variance: number;
  is_reconciled: boolean;
}

export interface CashFlowResult {
  period: {
    start_date: string;
    end_date: string;
  };
  branch: {
    id: string | null;
    name: string;
  };
  method: "direct" | "indirect" | "both";
  direct_schedule?: DirectCashFlowSchedule;
  indirect_schedule?: IndirectCashFlowSchedule;
  summary: CashFlowSummary;
  reconciliation: CashFlowReconciliation;
  comparison?: CashFlowResult;
}

export interface CashFlowParams {
  start_date: string;
  end_date: string;
  branch_id?: string;
  method?: "direct" | "indirect" | "both";
  compare_start_date?: string;
  compare_end_date?: string;
}

// ─── Raw DB Journal Row ─────────────────────────────────────────────────────────

interface RawJournalLineWithAccount {
  entry_id: string;
  entry_no: string;
  entry_date: string;
  branch_id: string;
  voucher_type: string;
  line_id: string;
  line_no: number;
  account_id: string;
  account_code: string;
  account_name: string;
  account_type: string;
  account_subtype: string;
  parent_code: string | null;
  debit_amount: string;
  credit_amount: string;
}

// ─── CashFlowService ────────────────────────────────────────────────────────────

export class CashFlowService {
  /**
   * Generates the authoritative Cash Flow Statement for a given period and branch scope.
   */
  static async getCashFlowStatement(
    params: CashFlowParams,
    sessionBranchId?: string,
    isSuperAdmin?: boolean
  ): Promise<CashFlowResult> {
    // 1. Validate mandatory dates
    if (!params.start_date || !params.end_date) {
      throw new CashFlowServiceError(
        "MISSING_DATE_RANGE",
        "Both 'start_date' and 'end_date' query parameters are required."
      );
    }
    if (!isValidDateStr(params.start_date) || !isValidDateStr(params.end_date)) {
      throw new CashFlowServiceError(
        "INVALID_DATE_FORMAT",
        "Dates must be valid YYYY-MM-DD strings."
      );
    }
    if (params.start_date > params.end_date) {
      throw new CashFlowServiceError(
        "INVALID_DATE_RANGE",
        `start_date (${params.start_date}) cannot be after end_date (${params.end_date}).`
      );
    }

    // 2. Resolve branch authorization (BOLA)
    let effectiveBranchId: string | undefined = undefined;
    if (isSuperAdmin) {
      effectiveBranchId = params.branch_id || undefined;
    } else {
      if (params.branch_id && sessionBranchId && params.branch_id !== sessionBranchId) {
        throw new CashFlowServiceError(
          "FORBIDDEN",
          "Access denied: cannot query cash flow for another branch."
        );
      }
      effectiveBranchId = sessionBranchId || undefined;
    }

    // Resolve branch display name
    let branchName = "All Branches (Enterprise)";
    if (effectiveBranchId) {
      try {
        const bRes = await dbQuery<{ name: string }>(
          `SELECT name FROM public.branch WHERE id = $1 LIMIT 1`,
          [effectiveBranchId]
        );
        if (bRes.rows[0]?.name) {
          branchName = bRes.rows[0].name;
        } else {
          branchName = `Branch ${effectiveBranchId.substring(0, 8)}`;
        }
      } catch {
        branchName = `Branch ${effectiveBranchId.substring(0, 8)}`;
      }
    }

    const method = params.method || "both";

    // 3. Compute baseline period statement
    const baseline = await this.computeStatement(
      params.start_date,
      params.end_date,
      effectiveBranchId,
      branchName,
      method
    );

    // 4. Handle comparative period if requested
    if (params.compare_start_date && params.compare_end_date) {
      if (!isValidDateStr(params.compare_start_date) || !isValidDateStr(params.compare_end_date)) {
        throw new CashFlowServiceError(
          "INVALID_DATE_FORMAT",
          "Comparative dates must be valid YYYY-MM-DD strings."
        );
      }
      if (params.compare_start_date > params.compare_end_date) {
        throw new CashFlowServiceError(
          "INVALID_DATE_RANGE",
          `compare_start_date (${params.compare_start_date}) cannot be after compare_end_date (${params.compare_end_date}).`
        );
      }

      const comparison = await this.computeStatement(
        params.compare_start_date,
        params.compare_end_date,
        effectiveBranchId,
        branchName,
        method
      );
      baseline.comparison = comparison;
    }

    return baseline;
  }

  /**
   * Internal execution pipeline for a discrete reporting period.
   */
  private static async computeStatement(
    startDate: string,
    endDate: string,
    branchId: string | undefined,
    branchName: string,
    method: "direct" | "indirect" | "both"
  ): Promise<CashFlowResult> {
    // ── STEP A: Opening & Closing Cash Balances from Trial Balance ────────────
    const prevDate = new Date(startDate);
    prevDate.setDate(prevDate.getDate() - 1);
    const prevDayStr = prevDate.toISOString().split("T")[0];

    const [openingTb, closingTb, openingVoucherCashRes] = await Promise.all([
      AccountingJournalRepository.getTrialBalance(branchId, undefined, prevDayStr),
      AccountingJournalRepository.getTrialBalance(branchId, undefined, endDate),
      // Any OPENING_BALANCE vouchers posted on startDate establish the initial cash position
      dbQuery<{ ob_cash: string }>(
        `
        SELECT COALESCE(SUM(jl.debit_amount - jl.credit_amount), 0) AS ob_cash
        FROM public.accounting_journal_line jl
        JOIN public.accounting_journal_entry je ON je.id = jl.journal_entry_id
        JOIN public.accounting_voucher v ON v.id = je.voucher_id
        JOIN public.accounting_account a ON a.id = jl.account_id
        WHERE v.voucher_type = 'OPENING_BALANCE'
          AND je.entry_date = $1
          AND a.code = ANY($2::text[])
          AND ($3::text IS NULL OR je.branch_id = $3)
        `,
        [startDate, [...CASH_ACCOUNT_CODES], branchId || null]
      ),
    ]);

    let openingCash = 0;
    for (const row of openingTb) {
      if (CASH_ACCOUNT_CODES.includes(row.code as CashAccountCode)) {
        openingCash += Number(row.net_balance || 0);
      }
    }
    const obVoucherCash = Number(openingVoucherCashRes.rows[0]?.ob_cash || 0);
    openingCash = round2(openingCash + obVoucherCash);

    let closingCashFromTb = 0;
    for (const row of closingTb) {
      if (CASH_ACCOUNT_CODES.includes(row.code as CashAccountCode)) {
        closingCashFromTb += Number(row.net_balance || 0);
      }
    }
    closingCashFromTb = round2(closingCashFromTb);

    // ── STEP B: Direct Method Calculation ──────────────────────────────────────
    const directSchedule = await this.computeDirectSchedule(startDate, endDate, branchId);

    // ── STEP C: Indirect Method Calculation ────────────────────────────────────
    const indirectSchedule = await this.computeIndirectSchedule(startDate, endDate, branchId);

    // ── STEP D: Reconciliation & Invariant Assertions ─────────────────────────
    const netOperatingDirect = directSchedule.operating.net_amount;
    const netOperatingIndirect = indirectSchedule.net_operating_cash_flow;
    const dualMethodVariance = round2(netOperatingDirect - netOperatingIndirect);
    const isDualMethodConverged = Math.abs(dualMethodVariance) < 0.01;

    const netInvestingCash = directSchedule.investing.net_amount;
    const netFinancingCash = directSchedule.financing.net_amount;
    const netCashMovement = round2(netOperatingDirect + netInvestingCash + netFinancingCash);

    const closingCash = round2(openingCash + netCashMovement);
    const bsVariance = round2(closingCash - closingCashFromTb);
    const isReconciled = Math.abs(bsVariance) < 0.01 && isDualMethodConverged;

    const summary: CashFlowSummary = {
      opening_cash: openingCash,
      net_operating_cash: netOperatingDirect,
      net_investing_cash: netInvestingCash,
      net_financing_cash: netFinancingCash,
      net_cash_change: netCashMovement,
      closing_cash: closingCash,
    };

    const reconciliation: CashFlowReconciliation = {
      opening_cash: openingCash,
      net_operating_cash_direct: netOperatingDirect,
      net_operating_cash_indirect: netOperatingIndirect,
      dual_method_variance: dualMethodVariance,
      is_dual_method_converged: isDualMethodConverged,
      net_investing_cash: netInvestingCash,
      net_financing_cash: netFinancingCash,
      net_cash_movement: netCashMovement,
      closing_cash: closingCash,
      balance_sheet_cash_match: closingCashFromTb,
      balance_sheet_variance: bsVariance,
      is_reconciled: isReconciled,
    };

    const result: CashFlowResult = {
      period: {
        start_date: startDate,
        end_date: endDate,
      },
      branch: {
        id: branchId || null,
        name: branchName,
      },
      method,
      summary,
      reconciliation,
    };

    if (method === "direct" || method === "both") {
      result.direct_schedule = directSchedule;
    }
    if (method === "indirect" || method === "both") {
      result.indirect_schedule = indirectSchedule;
    }

    return result;
  }

  /**
   * Computes the Direct Method cash flow schedule by analyzing cash-touching journal entries.
   */
  private static async computeDirectSchedule(
    startDate: string,
    endDate: string,
    branchId?: string
  ): Promise<DirectCashFlowSchedule> {
    const sql = `
      SELECT 
        je.id AS entry_id,
        je.entry_no,
        je.entry_date::text AS entry_date,
        je.branch_id,
        v.voucher_type,
        jl.id AS line_id,
        jl.line_no,
        jl.account_id,
        a.code AS account_code,
        a.name AS account_name,
        a.type AS account_type,
        a.subtype AS account_subtype,
        p.code AS parent_code,
        jl.debit_amount::text AS debit_amount,
        jl.credit_amount::text AS credit_amount
      FROM public.accounting_journal_entry je
      JOIN public.accounting_voucher v ON v.id = je.voucher_id
      JOIN public.accounting_journal_line jl ON jl.journal_entry_id = je.id
      JOIN public.accounting_account a ON a.id = jl.account_id
      LEFT JOIN public.accounting_account p ON p.id = a.parent_id
      WHERE je.entry_date >= $1 AND je.entry_date <= $2
        AND ($3::text IS NULL OR je.branch_id = $3)
        AND v.voucher_type != 'OPENING_BALANCE'
        AND je.id IN (
          SELECT DISTINCT sub_jl.journal_entry_id 
          FROM public.accounting_journal_line sub_jl
          JOIN public.accounting_account sub_a ON sub_a.id = sub_jl.account_id
          WHERE sub_a.code = ANY($4::text[])
        )
      ORDER BY je.entry_date ASC, je.id ASC, jl.line_no ASC
    `;

    const res = await dbQuery<RawJournalLineWithAccount>(sql, [
      startDate,
      endDate,
      branchId || null,
      [...CASH_ACCOUNT_CODES],
    ]);

    // Group journal lines by journal entry
    const entriesMap = new Map<string, RawJournalLineWithAccount[]>();
    for (const row of res.rows) {
      if (!entriesMap.has(row.entry_id)) {
        entriesMap.set(row.entry_id, []);
      }
      entriesMap.get(row.entry_id)!.push(row);
    }

    // Buckets for categorized flows
    const opInflows = new Map<string, { label: string; amount: number; count: number }>();
    const opOutflows = new Map<string, { label: string; amount: number; count: number }>();
    const invInflows = new Map<string, { label: string; amount: number; count: number }>();
    const invOutflows = new Map<string, { label: string; amount: number; count: number }>();
    const finInflows = new Map<string, { label: string; amount: number; count: number }>();
    const finOutflows = new Map<string, { label: string; amount: number; count: number }>();

    let totalInternalTransferVolume = 0;

    const addFlow = (
      bucket: Map<string, { label: string; amount: number; count: number }>,
      key: string,
      label: string,
      amount: number
    ) => {
      const cur = bucket.get(key) || { label, amount: 0, count: 0 };
      cur.amount = round2(cur.amount + amount);
      cur.count += 1;
      bucket.set(key, cur);
    };

    // Analyze each cash-touching journal entry
    for (const [, lines] of entriesMap) {
      const cashLines: RawJournalLineWithAccount[] = [];
      const nonCashLines: RawJournalLineWithAccount[] = [];

      for (const line of lines) {
        if (CASH_ACCOUNT_CODES.includes(line.account_code as CashAccountCode)) {
          cashLines.push(line);
        } else {
          nonCashLines.push(line);
        }
      }

      let cashDebits = 0;
      let cashCredits = 0;
      for (const cl of cashLines) {
        cashDebits += Number(cl.debit_amount);
        cashCredits += Number(cl.credit_amount);
      }
      const netCashDelta = round2(cashDebits - cashCredits);

      // Case 1: Internal Cash Transfer (net cash effect is ₹0.00)
      if (Math.abs(netCashDelta) < 0.005 || nonCashLines.length === 0) {
        totalInternalTransferVolume = round2(
          totalInternalTransferVolume + Math.max(cashDebits, cashCredits)
        );
        continue;
      }

      // Case 2: External Cash Inflow (netCashDelta > 0)
      if (netCashDelta > 0) {
        let totalNonCashCredit = 0;
        for (const ncl of nonCashLines) {
          totalNonCashCredit += Number(ncl.credit_amount);
        }

        for (const ncl of nonCashLines) {
          const creditAmt = Number(ncl.credit_amount);
          if (creditAmt <= 0 && totalNonCashCredit > 0) continue;

          const allocation =
            totalNonCashCredit > 0
              ? round2(netCashDelta * (creditAmt / totalNonCashCredit))
              : netCashDelta;

          const code = ncl.account_code;

          // Categorize Inflow
          if (["1510", "1520", "1530", "1540"].includes(code)) {
            addFlow(invInflows, "PROCEEDS_PP&E", "Proceeds from Sale of Fixed Assets", allocation);
          } else if (code === "2510") {
            addFlow(finInflows, "LOAN_PROCEEDS", "Proceeds from Bank Borrowings & Loans", allocation);
          } else if (code === "3110") {
            addFlow(finInflows, "CAPITAL_INJECTIONS", "Capital Injections from Partners", allocation);
          } else if (code.startsWith("42")) {
            addFlow(opInflows, "OTHER_INCOME", "Cash Receipts from Other / Indirect Income", allocation);
          } else if (code === "2111") {
            addFlow(opInflows, "SUPPLIER_REFUNDS", "Refunds Received from Suppliers", allocation);
          } else if (code.startsWith("114") || code.startsWith("212")) {
            addFlow(opInflows, "TAX_REFUNDS", "Tax Refunds Received (GST)", allocation);
          } else {
            // Default operating collection: Sales (41xx), AR (1121), Customer Advances (2141), Undeposited COD (1122)
            addFlow(opInflows, "CUSTOMER_COLLECTIONS", "Cash Receipts from Customers & Sales", allocation);
          }
        }
      }

      // Case 3: External Cash Outflow (netCashDelta < 0)
      if (netCashDelta < 0) {
        const disbursed = Math.abs(netCashDelta);
        let totalNonCashDebit = 0;
        for (const ncl of nonCashLines) {
          totalNonCashDebit += Number(ncl.debit_amount);
        }

        for (const ncl of nonCashLines) {
          const debitAmt = Number(ncl.debit_amount);
          if (debitAmt <= 0 && totalNonCashDebit > 0) continue;

          const allocation =
            totalNonCashDebit > 0
              ? round2(disbursed * (debitAmt / totalNonCashDebit))
              : disbursed;

          const code = ncl.account_code;

          // Categorize Outflow
          if (["1510", "1520", "1530", "1540"].includes(code)) {
            addFlow(invOutflows, "PURCHASE_PP&E", "Purchase of Property, Plant & Equipment", allocation);
          } else if (code === "2510") {
            addFlow(finOutflows, "LOAN_REPAYMENT", "Repayment of Bank Borrowings & Loans", allocation);
          } else if (code === "3120") {
            addFlow(finOutflows, "DRAWINGS", "Partner Drawings & Distributions", allocation);
          } else if (code === "5320") {
            addFlow(finOutflows, "LOAN_INTEREST", "Financing Interest & Borrowing Costs Paid", allocation);
          } else if (code === "2111") {
            addFlow(opOutflows, "SUPPLIER_PAYMENTS", "Cash Paid to Suppliers for Inventory & Supplies", allocation);
          } else if (code === "5290" || code === "5295" || code === "5310") {
            addFlow(opOutflows, "GATEWAY_BANK_CHARGES", "Payment Gateway MDR & Banking Charges", allocation);
          } else if (code.startsWith("212") || code === "2130") {
            addFlow(opOutflows, "STATUTORY_TAXES", "Cash Paid for Statutory Taxes (GST & TDS)", allocation);
          } else if (code === "4190" || (code === "1121" && ncl.voucher_type === "PAYMENT")) {
            addFlow(opOutflows, "CUSTOMER_REFUNDS", "Customer Refunds Paid", allocation);
          } else {
            // Default operating disbursements: OpEx (52xx), Operating Accruals (215x), etc.
            addFlow(opOutflows, "OPERATING_EXPENSES", "Cash Paid for Operating Expenses & Payroll", allocation);
          }
        }
      }
    }

    // Convert Maps to structured section arrays
    const toSection = (
      label: string,
      inMap: Map<string, { label: string; amount: number; count: number }>,
      outMap: Map<string, { label: string; amount: number; count: number }>
    ): CashFlowSection => {
      const inflows: CashFlowLineItem[] = Array.from(inMap.entries()).map(([key, v]) => ({
        key,
        label: v.label,
        amount: v.amount,
        transaction_count: v.count,
      }));
      const outflows: CashFlowLineItem[] = Array.from(outMap.entries()).map(([key, v]) => ({
        key,
        label: v.label,
        amount: v.amount,
        transaction_count: v.count,
      }));

      const totalInflows = round2(inflows.reduce((sum, item) => sum + item.amount, 0));
      const totalOutflows = round2(outflows.reduce((sum, item) => sum + item.amount, 0));
      const netAmount = round2(totalInflows - totalOutflows);

      return {
        label,
        inflows,
        outflows,
        total_inflows: totalInflows,
        total_outflows: totalOutflows,
        net_amount: netAmount,
      };
    };

    const operatingSection = toSection("Operating Activities", opInflows, opOutflows);
    const investingSection = toSection("Investing Activities", invInflows, invOutflows);
    const financingSection = toSection("Financing Activities", finInflows, finOutflows);

    const netCashMovement = round2(
      operatingSection.net_amount + investingSection.net_amount + financingSection.net_amount
    );

    return {
      operating: operatingSection,
      investing: investingSection,
      financing: financingSection,
      internal_transfers: {
        label: "Internal Cash Transfers",
        total_volume: totalInternalTransferVolume,
        net_impact: 0.0,
        description: "Contra transfers between Cash, Bank, and Transit accounts; net zero impact.",
      },
      net_cash_movement: netCashMovement,
    };
  }

  /**
   * Computes the Indirect Method schedule starting from P&L Net Profit Before Tax,
   * adding back non-cash depreciation, and adjusting for balance sheet working capital movements.
   */
  private static async computeIndirectSchedule(
    startDate: string,
    endDate: string,
    branchId?: string
  ): Promise<IndirectCashFlowSchedule> {
    const prevDate = new Date(startDate);
    prevDate.setDate(prevDate.getDate() - 1);
    const prevDayStr = prevDate.toISOString().split("T")[0];

    const [periodTb, openingTb, closingTb] = await Promise.all([
      AccountingJournalRepository.getTrialBalance(branchId, startDate, endDate),
      AccountingJournalRepository.getTrialBalance(branchId, undefined, prevDayStr),
      AccountingJournalRepository.getTrialBalance(branchId, undefined, endDate),
    ]);

    // 1. Net Profit Before Tax (Phase 5A.3 authoritative formulation)
    let revenueTotal = 0;
    let expenseTotal = 0;
    let depreciationExpense = 0;
    let loanInterestExpense = 0;

    for (const row of periodTb) {
      if (row.type === "REVENUE") {
        revenueTotal += Number(row.total_credit || 0) - Number(row.total_debit || 0);
      } else if (row.type === "EXPENSE") {
        const exp = Number(row.total_debit || 0) - Number(row.total_credit || 0);
        expenseTotal += exp;
        if (row.code === "5330") {
          depreciationExpense += exp;
        }
        if (row.code === "5320") {
          loanInterestExpense += exp;
        }
      }
    }

    const netProfitBeforeTax = round2(revenueTotal - expenseTotal);
    depreciationExpense = round2(depreciationExpense);
    loanInterestExpense = round2(loanInterestExpense);

    // 2. Non-Cash & Financing Adjustments
    const nonCashSubtotal = round2(depreciationExpense + loanInterestExpense);
    const operatingProfitBeforeWc = round2(netProfitBeforeTax + nonCashSubtotal);

    // 3. Working Capital Schedule
    const openingMap = new Map<string, TrialBalanceRow>();
    for (const r of openingTb) openingMap.set(r.code, r);

    const closingMap = new Map<string, TrialBalanceRow>();
    for (const r of closingTb) closingMap.set(r.code, r);

    const wcItems: IndirectWorkingCapitalItem[] = [];
    let wcSubtotal = 0;

    // Working Capital Accounts (Current Assets excl Cash, and Current Liabilities)
    const CURRENT_ASSET_CODES = [
      "1121", "1122", "1123", "1124",
      "1131", "1132", "1133",
      "1141", "1142", "1143", "1144", "1145", "1146", "1147", "1148", "1149",
    ];

    const CURRENT_LIABILITY_CODES = [
      "2111",
      "2121", "2122", "2123", "2124", "2125", "2126", "2127", "2128", "2129",
      "2130",
      "2141", "2142",
      "2151", "2152", "2153",
    ];

    // Evaluate Current Assets
    for (const code of CURRENT_ASSET_CODES) {
      const openRow = openingMap.get(code);
      const closeRow = closingMap.get(code);
      const name = closeRow?.name || openRow?.name || `Account ${code}`;

      // Asset net balance: Debit - Credit
      const openBal = round2(Number(openRow?.net_balance || 0));
      const closeBal = round2(Number(closeRow?.net_balance || 0));
      const delta = round2(closeBal - openBal);

      // Increase in Current Asset is a Cash Outflow (-); Decrease is a Cash Inflow (+)
      const cashImpact = round2(-delta);

      if (delta !== 0 || openBal !== 0 || closeBal !== 0) {
        wcItems.push({
          account_code: code,
          account_name: name,
          category: "CURRENT_ASSET",
          opening_balance: openBal,
          closing_balance: closeBal,
          balance_delta: delta,
          cash_impact: cashImpact,
        });
        wcSubtotal = round2(wcSubtotal + cashImpact);
      }
    }

    // Evaluate Current Liabilities
    for (const code of CURRENT_LIABILITY_CODES) {
      const openRow = openingMap.get(code);
      const closeRow = closingMap.get(code);
      const name = closeRow?.name || openRow?.name || `Account ${code}`;

      // Liability net balance: Credit - Debit (opposite of net_balance which is Debit - Credit)
      const openBal = round2(Number(openRow?.total_credit || 0) - Number(openRow?.total_debit || 0));
      const closeBal = round2(Number(closeRow?.total_credit || 0) - Number(closeRow?.total_debit || 0));
      const delta = round2(closeBal - openBal);

      // Increase in Current Liability is a Cash Inflow (+); Decrease is a Cash Outflow (-)
      const cashImpact = round2(delta);

      if (delta !== 0 || openBal !== 0 || closeBal !== 0) {
        wcItems.push({
          account_code: code,
          account_name: name,
          category: "CURRENT_LIABILITY",
          opening_balance: openBal,
          closing_balance: closeBal,
          balance_delta: delta,
          cash_impact: cashImpact,
        });
        wcSubtotal = round2(wcSubtotal + cashImpact);
      }
    }

    const netOperatingCashFlow = round2(operatingProfitBeforeWc + wcSubtotal);

    return {
      net_profit_before_tax: netProfitBeforeTax,
      non_cash_adjustments: {
        depreciation: depreciationExpense,
        finance_interest: loanInterestExpense,
        subtotal: nonCashSubtotal,
      },
      operating_profit_before_wc: operatingProfitBeforeWc,
      working_capital_adjustments: {
        items: wcItems,
        subtotal: wcSubtotal,
      },
      net_operating_cash_flow: netOperatingCashFlow,
    };
  }
}
