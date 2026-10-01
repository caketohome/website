"use client";

/**
 * CakeToHome ERP — Profit & Loss Panel
 * Phase 5A Step 3: Dedicated P&L report surface (separate from GeneralLedgerPanel).
 *
 * READ-ONLY: This panel performs zero mutations.
 * Data source: GET /api/v1/admin/accounting/profit-loss
 *
 * Features:
 * - Date range picker (start_date, end_date)
 * - Five-section structured P&L report
 * - Subtotals and profit calculation lines
 * - Reconciliation indicator against Trial Balance
 * - Branch filter for SUPER_ADMIN
 * - Optional comparative period (second date range)
 */

import { useState, useCallback } from "react";
import { TrendingUp, Scale, Calendar, ShieldCheck } from "lucide-react";
import { ComparativePnLView } from "./comparative-pnl-view";
import { FiscalYearSummaryView } from "./fiscal-year-summary-view";
import { RetainedEarningsRollForwardView } from "./retained-earnings-rollforward-view";

// ─── Types (client-side mirrors) ────────────────────────────────────────────────

interface PLAccountLine {
  code: string;
  name: string;
  amount: number;
}

interface PLOperatingRevenueSection {
  label: string;
  accounts: PLAccountLine[];
  gross_revenue: number;
  returns: PLAccountLine;
  net_revenue: number;
}

interface PLCOGSSection {
  label: string;
  accounts: PLAccountLine[];
  discounts: PLAccountLine;
  total_cogs: number;
}

interface PLSimpleSection {
  label: string;
  accounts: PLAccountLine[];
  total_opex?: number;
  total_other_income?: number;
  total_financial?: number;
}

interface PLSummary {
  gross_profit: number;
  operating_profit: number;
  net_profit_before_tax: number;
}

interface PLReconciliation {
  tb_revenue_total: number;
  tb_expense_total: number;
  tb_derived_profit: number;
  pnl_net_profit: number;
  is_reconciled: boolean;
  variance: number;
}

interface ProfitLossData {
  success: boolean;
  period: { start_date: string; end_date: string };
  branch: { id: string | null; name: string };
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

// ─── Helpers ────────────────────────────────────────────────────────────────────

function formatCurrency(amount: number): string {
  const abs = Math.abs(amount);
  const formatted = new Intl.NumberFormat("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(abs);
  if (amount < 0) return `(₹${formatted})`;
  return `₹${formatted}`;
}

function getDefaultDates(): { start: string; end: string } {
  const now = new Date();
  const currentMonth = now.getMonth(); // 0-indexed, Apr = 3
  const currentYear = now.getFullYear();
  // Indian FY: Apr 1 to Mar 31
  const fyStart = currentMonth >= 3
    ? new Date(currentYear, 3, 1)
    : new Date(currentYear - 1, 3, 1);
  const fyEnd = currentMonth >= 3
    ? new Date(currentYear + 1, 2, 31)
    : new Date(currentYear, 2, 31);
  return {
    start: fyStart.toISOString().split("T")[0],
    end: fyEnd.toISOString().split("T")[0],
  };
}

// ─── Component ──────────────────────────────────────────────────────────────────

export function ProfitLossPanel() {
  type ReportingSubTab = "standard" | "comparative" | "fy_summary" | "re_rollforward";
  const [activeSubTab, setActiveSubTab] = useState<ReportingSubTab>("standard");
  const defaults = getDefaultDates();
  const [startDate, setStartDate] = useState(defaults.start);
  const [endDate, setEndDate] = useState(defaults.end);
  const [compStartDate, setCompStartDate] = useState("");
  const [compEndDate, setCompEndDate] = useState("");
  const [showComparative, setShowComparative] = useState(false);
  const [data, setData] = useState<ProfitLossData | null>(null);
  const [compData, setCompData] = useState<ProfitLossData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchPL = useCallback(async () => {
    if (!startDate || !endDate) {
      setError("Both start date and end date are required.");
      return;
    }
    setLoading(true);
    setError(null);
    setData(null);
    setCompData(null);

    try {
      const params = new URLSearchParams({ start_date: startDate, end_date: endDate });
      const res = await fetch(`/api/v1/admin/accounting/profit-loss?${params}`);
      const json = await res.json();
      if (!res.ok || !json.success) {
        setError(json.message || `API Error: ${res.status}`);
        return;
      }
      setData(json);

      // Comparative period (dual API call)
      if (showComparative && compStartDate && compEndDate) {
        const compParams = new URLSearchParams({ start_date: compStartDate, end_date: compEndDate });
        const compRes = await fetch(`/api/v1/admin/accounting/profit-loss?${compParams}`);
        const compJson = await compRes.json();
        if (compRes.ok && compJson.success) {
          setCompData(compJson);
        }
      }
    } catch (err: any) {
      setError(err.message || "Failed to fetch P&L data.");
    } finally {
      setLoading(false);
    }
  }, [startDate, endDate, showComparative, compStartDate, compEndDate]);

  return (
    <div className="space-y-6">
      {/* ── Header & Reporting Hub Navigation ── */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-4">
        <div>
          <h2 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <span>Accounting &amp; Financial Reporting</span>
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Read-only financial statements derived directly from the authoritative PostgreSQL General Ledger.
          </p>
        </div>

        {/* Sub-tab switcher */}
        <div className="flex items-center p-1 rounded-xl bg-slate-100 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 max-w-full overflow-x-auto scrollbar-none">
          <button
            type="button"
            onClick={() => setActiveSubTab("standard")}
            className={`flex items-center gap-1.5 py-1.5 px-3 rounded-lg text-xs font-bold transition-all shrink-0 ${
              activeSubTab === "standard"
                ? "bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs"
                : "text-slate-500 hover:text-slate-900 dark:hover:text-white"
            }`}
          >
            <TrendingUp className="w-3.5 h-3.5" />
            <span>Annual P&amp;L</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveSubTab("comparative")}
            className={`flex items-center gap-1.5 py-1.5 px-3 rounded-lg text-xs font-bold transition-all shrink-0 ${
              activeSubTab === "comparative"
                ? "bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs"
                : "text-slate-500 hover:text-slate-900 dark:hover:text-white"
            }`}
          >
            <Scale className="w-3.5 h-3.5" />
            <span>Comparative P&amp;L</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveSubTab("fy_summary")}
            className={`flex items-center gap-1.5 py-1.5 px-3 rounded-lg text-xs font-bold transition-all shrink-0 ${
              activeSubTab === "fy_summary"
                ? "bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs"
                : "text-slate-500 hover:text-slate-900 dark:hover:text-white"
            }`}
          >
            <Calendar className="w-3.5 h-3.5" />
            <span>Fiscal Year Summary</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveSubTab("re_rollforward")}
            className={`flex items-center gap-1.5 py-1.5 px-3 rounded-lg text-xs font-bold transition-all shrink-0 ${
              activeSubTab === "re_rollforward"
                ? "bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs"
                : "text-slate-500 hover:text-slate-900 dark:hover:text-white"
            }`}
          >
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>Retained Earnings Roll-Forward</span>
          </button>
        </div>
      </div>

      {/* ── View Routing ── */}
      {activeSubTab === "comparative" && <ComparativePnLView />}
      {activeSubTab === "fy_summary" && <FiscalYearSummaryView />}
      {activeSubTab === "re_rollforward" && <RetainedEarningsRollForwardView />}

      {activeSubTab === "standard" && (
        <div className="space-y-6">
          {/* ── Date Filters ── */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 space-y-4">
            <div className="flex flex-wrap items-end gap-3">
              <div>
                <label className="block text-[10px] font-bold text-slate-500 dark:text-slate-400 mb-1 uppercase tracking-wide">
                  Start Date
                </label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="px-3 py-1.5 text-xs border border-slate-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-[#1D2F5D]"
            />
          </div>
          <div>
            <label className="block text-[10px] font-bold text-slate-500 dark:text-slate-400 mb-1 uppercase tracking-wide">
              End Date
            </label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="px-3 py-1.5 text-xs border border-slate-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-[#1D2F5D]"
            />
          </div>
          <button
            onClick={fetchPL}
            disabled={loading}
            className="px-4 py-1.5 text-xs font-bold text-white bg-[#1D2F5D] hover:bg-[#162447] rounded-lg transition-colors disabled:opacity-50"
          >
            {loading ? "Loading…" : "Generate P&L"}
          </button>
          <button
            onClick={() => setShowComparative(!showComparative)}
            className="px-3 py-1.5 text-xs font-semibold text-slate-600 dark:text-slate-400 border border-slate-300 dark:border-slate-700 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
          >
            {showComparative ? "Hide Comparative" : "Compare Period"}
          </button>
        </div>

        {showComparative && (
          <div className="flex flex-wrap items-end gap-3 pt-2 border-t border-slate-100 dark:border-slate-800">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wide self-center">
              Comparative:
            </span>
            <div>
              <label className="block text-[10px] font-bold text-slate-500 dark:text-slate-400 mb-1 uppercase tracking-wide">
                Comp Start
              </label>
              <input
                type="date"
                value={compStartDate}
                onChange={(e) => setCompStartDate(e.target.value)}
                className="px-3 py-1.5 text-xs border border-slate-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-[#1D2F5D]"
              />
            </div>
            <div>
              <label className="block text-[10px] font-bold text-slate-500 dark:text-slate-400 mb-1 uppercase tracking-wide">
                Comp End
              </label>
              <input
                type="date"
                value={compEndDate}
                onChange={(e) => setCompEndDate(e.target.value)}
                className="px-3 py-1.5 text-xs border border-slate-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-[#1D2F5D]"
              />
            </div>
          </div>
        )}
      </div>

      {/* ── Error ── */}
      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-3">
          <p className="text-xs text-red-700 dark:text-red-300 font-medium">{error}</p>
        </div>
      )}

      {/* ── P&L Report ── */}
      {data && (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
          {/* Report Header */}
          <div className="bg-[#1D2F5D] px-6 py-4 text-white">
            <h3 className="text-sm font-bold tracking-wide">PROFIT &amp; LOSS STATEMENT</h3>
            <p className="text-[11px] text-slate-300 mt-0.5">
              For the period: {data.period.start_date} to {data.period.end_date}
              {" | "}
              {data.branch.name}
            </p>
          </div>

          {/* Report Body */}
          <div className="p-4 md:p-6">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-700">
                  <th className="text-left py-2 text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wide w-16">Code</th>
                  <th className="text-left py-2 text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wide">Particulars</th>
                  <th className="text-right py-2 text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wide w-32">
                    Amount
                  </th>
                  {compData && (
                    <th className="text-right py-2 text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wide w-32">
                      Comparative
                    </th>
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {/* I. Operating Revenue */}
                <SectionHeader label={data.sections.operating_revenue.label} colSpan={compData ? 4 : 3} />
                {data.sections.operating_revenue.accounts.map((a) => (
                  <AccountRow key={a.code} line={a} compLine={findCompLine(compData?.sections.operating_revenue.accounts, a.code)} />
                ))}
                <SubtotalRow
                  label="GROSS OPERATING REVENUE"
                  amount={data.sections.operating_revenue.gross_revenue}
                  compAmount={compData?.sections.operating_revenue.gross_revenue}
                />
                <AccountRow
                  line={data.sections.operating_revenue.returns}
                  compLine={compData?.sections.operating_revenue.returns}
                  isDeduction
                  prefix="Less: "
                />
                <TotalRow
                  label="NET OPERATING REVENUE"
                  amount={data.sections.operating_revenue.net_revenue}
                  compAmount={compData?.sections.operating_revenue.net_revenue}
                />

                {/* II. Cost of Goods Sold */}
                <SectionHeader label={data.sections.cost_of_goods_sold.label} colSpan={compData ? 4 : 3} />
                {data.sections.cost_of_goods_sold.accounts.map((a) => (
                  <AccountRow key={a.code} line={a} compLine={findCompLine(compData?.sections.cost_of_goods_sold.accounts, a.code)} />
                ))}
                <AccountRow
                  line={data.sections.cost_of_goods_sold.discounts}
                  compLine={compData?.sections.cost_of_goods_sold.discounts}
                  isDeduction
                  prefix="Less: "
                />
                <TotalRow
                  label="TOTAL COST OF GOODS SOLD"
                  amount={data.sections.cost_of_goods_sold.total_cogs}
                  compAmount={compData?.sections.cost_of_goods_sold.total_cogs}
                />

                {/* Gross Profit */}
                <ProfitRow
                  label="GROSS PROFIT"
                  formula="Net Revenue − COGS"
                  amount={data.summary.gross_profit}
                  compAmount={compData?.summary.gross_profit}
                />

                {/* III. Operating Expenses */}
                <SectionHeader label={data.sections.operating_expenses.label} colSpan={compData ? 4 : 3} />
                {data.sections.operating_expenses.accounts.map((a) => (
                  <AccountRow key={a.code} line={a} compLine={findCompLine(compData?.sections.operating_expenses.accounts, a.code)} />
                ))}
                <TotalRow
                  label="TOTAL OPERATING EXPENSES"
                  amount={data.sections.operating_expenses.total_opex || 0}
                  compAmount={compData?.sections.operating_expenses.total_opex}
                />

                {/* Operating Profit */}
                <ProfitRow
                  label="OPERATING PROFIT (EBIT)"
                  formula="Gross Profit − OpEx"
                  amount={data.summary.operating_profit}
                  compAmount={compData?.summary.operating_profit}
                />

                {/* IV. Other Income */}
                <SectionHeader label={data.sections.other_income.label} colSpan={compData ? 4 : 3} />
                {data.sections.other_income.accounts.map((a) => (
                  <AccountRow key={a.code} line={a} compLine={findCompLine(compData?.sections.other_income.accounts, a.code)} />
                ))}
                <TotalRow
                  label="TOTAL OTHER INCOME"
                  amount={data.sections.other_income.total_other_income || 0}
                  compAmount={compData?.sections.other_income.total_other_income}
                />

                {/* V. Financial & Depreciation Expenses */}
                <SectionHeader label={data.sections.financial_expenses.label} colSpan={compData ? 4 : 3} />
                {data.sections.financial_expenses.accounts.map((a) => (
                  <AccountRow key={a.code} line={a} compLine={findCompLine(compData?.sections.financial_expenses.accounts, a.code)} />
                ))}
                <TotalRow
                  label="TOTAL FINANCIAL EXPENSES"
                  amount={data.sections.financial_expenses.total_financial || 0}
                  compAmount={compData?.sections.financial_expenses.total_financial}
                />

                {/* Net Profit Before Tax */}
                <ProfitRow
                  label="NET PROFIT BEFORE TAX"
                  formula="EBIT + Other Income − Financial Expenses"
                  amount={data.summary.net_profit_before_tax}
                  compAmount={compData?.summary.net_profit_before_tax}
                  isFinal
                />
              </tbody>
            </table>
          </div>

          {/* Reconciliation Footer */}
          <div className={`px-6 py-3 border-t ${
            data.reconciliation.is_reconciled
              ? "bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200 dark:border-emerald-800"
              : "bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800"
          }`}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className={`inline-block w-2 h-2 rounded-full ${
                  data.reconciliation.is_reconciled ? "bg-emerald-500" : "bg-amber-500"
                }`} />
                <span className="text-[11px] font-bold text-slate-700 dark:text-slate-300">
                  TB Reconciliation: {data.reconciliation.is_reconciled ? "✓ Reconciled" : "⚠ Variance Detected"}
                </span>
              </div>
              <div className="text-[10px] text-slate-500 dark:text-slate-400 space-x-4">
                <span>TB Revenue: {formatCurrency(data.reconciliation.tb_revenue_total)}</span>
                <span>TB Expense: {formatCurrency(data.reconciliation.tb_expense_total)}</span>
                <span>TB Derived Profit: {formatCurrency(data.reconciliation.tb_derived_profit)}</span>
                <span>P&amp;L Net Profit: {formatCurrency(data.reconciliation.pnl_net_profit)}</span>
                {!data.reconciliation.is_reconciled && (
                  <span className="font-bold text-amber-600">
                    Variance: {formatCurrency(data.reconciliation.variance)}
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
        </div>
      )}
    </div>
  );
}

// ─── Sub-Components ─────────────────────────────────────────────────────────────

function SectionHeader({ label, colSpan }: { label: string; colSpan: number }) {
  return (
    <tr>
      <td colSpan={colSpan} className="pt-5 pb-1.5 text-xs font-bold text-[#1D2F5D] dark:text-blue-300 uppercase tracking-wide">
        {label}
      </td>
    </tr>
  );
}

function AccountRow({
  line,
  compLine,
  isDeduction = false,
  prefix = "",
}: {
  line: PLAccountLine;
  compLine?: PLAccountLine;
  isDeduction?: boolean;
  prefix?: string;
}) {
  return (
    <tr className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors">
      <td className="py-1.5 text-slate-400 dark:text-slate-500 font-mono">{line.code}</td>
      <td className={`py-1.5 ${isDeduction ? "text-red-600 dark:text-red-400 italic" : "text-slate-700 dark:text-slate-300"}`}>
        {prefix}{line.name}
      </td>
      <td className={`py-1.5 text-right font-mono ${isDeduction ? "text-red-600 dark:text-red-400" : "text-slate-800 dark:text-slate-200"}`}>
        {isDeduction && line.amount > 0 ? `(${formatCurrency(line.amount)})` : formatCurrency(line.amount)}
      </td>
      {compLine !== undefined && (
        <td className={`py-1.5 text-right font-mono text-slate-400 ${isDeduction ? "text-red-400" : ""}`}>
          {isDeduction && compLine.amount > 0 ? `(${formatCurrency(compLine.amount)})` : formatCurrency(compLine.amount)}
        </td>
      )}
    </tr>
  );
}

function SubtotalRow({ label, amount, compAmount }: { label: string; amount: number; compAmount?: number }) {
  return (
    <tr className="border-t border-slate-200 dark:border-slate-700">
      <td className="py-1.5" />
      <td className="py-1.5 text-slate-600 dark:text-slate-400 font-semibold text-[11px]">{label}</td>
      <td className="py-1.5 text-right font-mono font-semibold text-slate-700 dark:text-slate-300">{formatCurrency(amount)}</td>
      {compAmount !== undefined && (
        <td className="py-1.5 text-right font-mono text-slate-400">{formatCurrency(compAmount)}</td>
      )}
    </tr>
  );
}

function TotalRow({ label, amount, compAmount }: { label: string; amount: number; compAmount?: number }) {
  return (
    <tr className="border-t-2 border-slate-300 dark:border-slate-600">
      <td className="py-2" />
      <td className="py-2 font-bold text-slate-800 dark:text-slate-200 text-[11px] uppercase">{label}</td>
      <td className="py-2 text-right font-mono font-bold text-slate-900 dark:text-white">{formatCurrency(amount)}</td>
      {compAmount !== undefined && (
        <td className="py-2 text-right font-mono font-bold text-slate-400">{formatCurrency(compAmount)}</td>
      )}
    </tr>
  );
}

function ProfitRow({
  label,
  formula,
  amount,
  compAmount,
  isFinal = false,
}: {
  label: string;
  formula: string;
  amount: number;
  compAmount?: number;
  isFinal?: boolean;
}) {
  const bgClass = isFinal
    ? "bg-[#1D2F5D]/5 dark:bg-[#1D2F5D]/20"
    : "bg-slate-50 dark:bg-slate-800/30";
  const textClass = amount >= 0
    ? "text-emerald-700 dark:text-emerald-400"
    : "text-red-700 dark:text-red-400";

  return (
    <tr className={`${bgClass} border-y-2 border-slate-300 dark:border-slate-600`}>
      <td className="py-3" />
      <td className="py-3">
        <span className="font-bold text-slate-900 dark:text-white text-[11px] uppercase">{label}</span>
        <span className="text-[9px] text-slate-400 ml-2">({formula})</span>
      </td>
      <td className={`py-3 text-right font-mono font-bold text-sm ${textClass}`}>
        {formatCurrency(amount)}
      </td>
      {compAmount !== undefined && (
        <td className={`py-3 text-right font-mono font-bold text-sm ${compAmount >= 0 ? "text-emerald-400" : "text-red-400"}`}>
          {formatCurrency(compAmount)}
        </td>
      )}
    </tr>
  );
}

function findCompLine(accounts: PLAccountLine[] | undefined, code: string): PLAccountLine | undefined {
  if (!accounts) return undefined;
  return accounts.find((a) => a.code === code);
}
