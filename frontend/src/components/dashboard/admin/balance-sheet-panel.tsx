"use client";

/**
 * CakeToHome ERP — Balance Sheet Panel
 * Phase 5A Step 4: Authoritative, read-only Balance Sheet report workspace.
 *
 * READ-ONLY: Strictly zero mutations.
 * Data source: GET /api/v1/admin/accounting/balance-sheet
 *
 * Features:
 * - As-of date selector with standard accounting presets
 * - Comparative period support (side-by-side comparative date)
 * - Balanced equation indicator (Assets = Liabilities + Equity)
 * - Four KPI cards: Total Assets, Total Liabilities, Total Equity, Working Capital
 * - Complete schedule: Current Assets, Fixed Assets (gross, depr, net),
 *   Current Liabilities, Long-Term Liabilities, Equity (capital, drawings, 3210, 3220, 3300)
 * - Responsive, dark-mode ready, printable
 */

import { useState, useCallback, useEffect } from "react";

// ─── Client Types ───────────────────────────────────────────────────────────────

interface BSAccountLine {
  code: string;
  name: string;
  amount: number;
}

interface BSGroupCategory {
  group_code: string;
  group_name: string;
  accounts: BSAccountLine[];
  subtotal: number;
}

interface BSCurrentAssetsSection {
  label: string;
  categories: BSGroupCategory[];
  total_current_assets: number;
}

interface BSFixedAssetsSection {
  label: string;
  gross_fixed_assets: BSAccountLine[];
  gross_subtotal: number;
  accumulated_depreciation: BSAccountLine;
  net_fixed_assets: number;
}

interface BSCurrentLiabilitiesSection {
  label: string;
  categories: BSGroupCategory[];
  other_current_liabilities: BSAccountLine[];
  total_current_liabilities: number;
}

interface BSLongTermLiabilitiesSection {
  label: string;
  accounts: BSAccountLine[];
  total_long_term_liabilities: number;
}

interface BSEquitySection {
  label: string;
  capital: BSAccountLine;
  drawings: BSAccountLine;
  net_capital: number;
  retained_earnings_prior: BSAccountLine;
  current_year_net_earnings: BSAccountLine;
  opening_balance_offset: BSAccountLine;
  total_equity: number;
}

interface BSSummary {
  total_assets: number;
  total_liabilities: number;
  total_equity: number;
  total_liabilities_and_equity: number;
  net_working_capital: number;
}

interface BSReconciliation {
  total_assets: number;
  total_liabilities_and_equity: number;
  difference: number;
  is_balanced: boolean;
  dynamic_pnl_profit: number;
  posted_3220_balance: number;
}

interface BalanceSheetData {
  success: boolean;
  as_of_date: string;
  branch: { id: string | null; name: string };
  sections: {
    current_assets: BSCurrentAssetsSection;
    fixed_assets: BSFixedAssetsSection;
    current_liabilities: BSCurrentLiabilitiesSection;
    long_term_liabilities: BSLongTermLiabilitiesSection;
    equity: BSEquitySection;
  };
  summary: BSSummary;
  reconciliation: BSReconciliation;
  comparison?: BalanceSheetData;
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

function getTodayStr(): string {
  const now = new Date();
  return now.toISOString().split("T")[0];
}

function getPresetDate(preset: "today" | "month_end" | "quarter_end" | "fy_end"): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth(); // 0-indexed

  if (preset === "today") return getTodayStr();

  if (preset === "month_end") {
    // Last day of previous month
    const d = new Date(year, month, 0);
    return d.toISOString().split("T")[0];
  }

  if (preset === "quarter_end") {
    // Last quarter end (Mar 31, Jun 30, Sep 30, Dec 31)
    const quarterEndMonth = Math.floor(month / 3) * 3;
    const d = new Date(year, quarterEndMonth, 0);
    return d.toISOString().split("T")[0];
  }

  if (preset === "fy_end") {
    // Most recent Indian FY end (March 31)
    if (month >= 3) {
      return `${year}-03-31`;
    } else {
      return `${year - 1}-03-31`;
    }
  }

  return getTodayStr();
}

// ─── Component ──────────────────────────────────────────────────────────────────

export function BalanceSheetPanel() {
  const [asOfDate, setAsOfDate] = useState(getTodayStr());
  const [compareDate, setCompareDate] = useState("");
  const [showComparative, setShowComparative] = useState(false);
  const [data, setData] = useState<BalanceSheetData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchBalanceSheet = useCallback(async () => {
    if (!asOfDate) {
      setError("Please select an as-of date.");
      return;
    }
    setLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams({ as_of_date: asOfDate });
      if (showComparative && compareDate) {
        params.append("compare_date", compareDate);
      }

      const res = await fetch(`/api/v1/admin/accounting/balance-sheet?${params}`);
      const json = await res.json();
      if (!res.ok || !json.success) {
        setError(json.message || `API Error: ${res.status}`);
        return;
      }
      setData(json);
    } catch (err: any) {
      setError(err.message || "Failed to fetch Balance Sheet data.");
    } finally {
      setLoading(false);
    }
  }, [asOfDate, compareDate, showComparative]);

  useEffect(() => {
    fetchBalanceSheet();
  }, [fetchBalanceSheet]);

  return (
    <div className="space-y-6">
      {/* ── Header ── */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
            Balance Sheet
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Authoritative financial position derived in real-time from the General Ledger.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => window.print()}
            disabled={!data}
            className="px-3 py-1.5 text-xs font-semibold text-slate-600 dark:text-slate-300 border border-slate-300 dark:border-slate-700 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors disabled:opacity-50"
          >
            Print Statement
          </button>
        </div>
      </div>

      {/* ── Control Bar & Date Filters ── */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 space-y-4">
        <div className="flex flex-wrap items-end gap-3">
          <div>
            <label className="block text-[10px] font-bold text-slate-500 dark:text-slate-400 mb-1 uppercase tracking-wide">
              As Of Date
            </label>
            <input
              type="date"
              value={asOfDate}
              onChange={(e) => setAsOfDate(e.target.value)}
              className="px-3 py-1.5 text-xs border border-slate-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-[#1D2F5D]"
            />
          </div>

          {/* Quick Presets */}
          <div className="flex items-center gap-1.5 self-end pb-1">
            <span className="text-[10px] text-slate-400 uppercase font-bold mr-1">Presets:</span>
            <button
              type="button"
              onClick={() => setAsOfDate(getPresetDate("today"))}
              className="px-2 py-1 text-[11px] rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
            >
              Today
            </button>
            <button
              type="button"
              onClick={() => setAsOfDate(getPresetDate("month_end"))}
              className="px-2 py-1 text-[11px] rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
            >
              Last Month End
            </button>
            <button
              type="button"
              onClick={() => setAsOfDate(getPresetDate("quarter_end"))}
              className="px-2 py-1 text-[11px] rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
            >
              Last Quarter
            </button>
            <button
              type="button"
              onClick={() => setAsOfDate(getPresetDate("fy_end"))}
              className="px-2 py-1 text-[11px] rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
            >
              FY End
            </button>
          </div>

          <button
            onClick={fetchBalanceSheet}
            disabled={loading}
            className="px-4 py-1.5 text-xs font-bold text-white bg-[#1D2F5D] hover:bg-[#162447] rounded-lg transition-colors disabled:opacity-50"
          >
            {loading ? "Refreshing…" : "Generate Statement"}
          </button>

          <button
            onClick={() => setShowComparative(!showComparative)}
            className="px-3 py-1.5 text-xs font-semibold text-slate-600 dark:text-slate-400 border border-slate-300 dark:border-slate-700 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
          >
            {showComparative ? "Hide Comparative" : "Compare Date"}
          </button>
        </div>

        {showComparative && (
          <div className="flex flex-wrap items-end gap-3 pt-2 border-t border-slate-100 dark:border-slate-800">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wide self-center">
              Comparative Date:
            </span>
            <div>
              <input
                type="date"
                value={compareDate}
                onChange={(e) => setCompareDate(e.target.value)}
                className="px-3 py-1.5 text-xs border border-slate-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-[#1D2F5D]"
              />
            </div>
            <button
              onClick={fetchBalanceSheet}
              disabled={loading || !compareDate}
              className="px-3 py-1 text-xs font-bold text-[#1D2F5D] dark:text-blue-400 border border-[#1D2F5D] dark:border-blue-400 rounded-lg hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors disabled:opacity-50"
            >
              Apply Comparison
            </button>
          </div>
        )}
      </div>

      {/* ── Error Banner ── */}
      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-3">
          <p className="text-xs text-red-700 dark:text-red-300 font-medium">{error}</p>
        </div>
      )}

      {/* ── Reconciliation Status & KPIs ── */}
      {data && (
        <>
          {/* Status Banner */}
          <div
            className={`border rounded-xl p-4 flex flex-col md:flex-row items-start md:items-center justify-between gap-3 ${
              data.reconciliation.is_balanced
                ? "bg-emerald-50 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-800/50 text-emerald-900 dark:text-emerald-200"
                : "bg-amber-50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-800/50 text-amber-900 dark:text-amber-200"
            }`}
          >
            <div className="flex items-center gap-3">
              <div
                className={`w-3 h-3 rounded-full ${
                  data.reconciliation.is_balanced ? "bg-emerald-500 animate-pulse" : "bg-amber-500"
                }`}
              />
              <div>
                <p className="text-xs font-bold">
                  {data.reconciliation.is_balanced
                    ? "BALANCE SHEET RECONCILED & BALANCED"
                    : "BALANCE SHEET DISCREPANCY DETECTED"}
                </p>
                <p className="text-[11px] opacity-80 mt-0.5">
                  Assets (₹{data.summary.total_assets.toLocaleString("en-IN", { minimumFractionDigits: 2 })}) ≡
                  Liabilities &amp; Equity (₹
                  {data.summary.total_liabilities_and_equity.toLocaleString("en-IN", {
                    minimumFractionDigits: 2,
                  })}
                  ) • Variance: ₹{data.reconciliation.difference.toFixed(2)}
                </p>
              </div>
            </div>
            <div className="text-[11px] font-mono opacity-90 text-right">
              Scope: {data.branch.name}
            </div>
          </div>

          {/* 4 Summary Metric Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4">
              <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider block mb-1">
                Total Assets
              </span>
              <span className="text-base md:text-lg font-bold font-mono text-slate-900 dark:text-white">
                {formatCurrency(data.summary.total_assets)}
              </span>
              <span className="text-[10px] text-slate-400 block mt-1">Current + Net Fixed Assets</span>
            </div>

            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4">
              <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider block mb-1">
                Total Liabilities
              </span>
              <span className="text-base md:text-lg font-bold font-mono text-slate-900 dark:text-white">
                {formatCurrency(data.summary.total_liabilities)}
              </span>
              <span className="text-[10px] text-slate-400 block mt-1">Current + Long-Term Dues</span>
            </div>

            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4">
              <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider block mb-1">
                Total Equity
              </span>
              <span className="text-base md:text-lg font-bold font-mono text-slate-900 dark:text-white">
                {formatCurrency(data.summary.total_equity)}
              </span>
              <span className="text-[10px] text-slate-400 block mt-1">Capital, Reserves &amp; Retained Earnings</span>
            </div>

            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4">
              <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider block mb-1">
                Net Working Capital
              </span>
              <span className="text-base md:text-lg font-bold font-mono text-slate-900 dark:text-white">
                {formatCurrency(data.summary.net_working_capital)}
              </span>
              <span className="text-[10px] text-slate-400 block mt-1">Current Assets − Current Liab.</span>
            </div>
          </div>

          {/* ── Main Balance Sheet Report ── */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden shadow-sm">
            {/* Report Banner */}
            <div className="bg-[#1D2F5D] px-6 py-4 text-white flex flex-col md:flex-row justify-between items-start md:items-center gap-2">
              <div>
                <h3 className="text-sm font-bold tracking-wide">STATEMENT OF FINANCIAL POSITION (BALANCE SHEET)</h3>
                <p className="text-[11px] text-slate-300 mt-0.5">
                  As of: {data.as_of_date} {data.comparison ? `| Compared to: ${data.comparison.as_of_date}` : ""}
                </p>
              </div>
              <span className="text-[11px] font-mono bg-white/10 px-2 py-0.5 rounded">
                All amounts in INR (₹)
              </span>
            </div>

            <div className="p-6 space-y-8">
              {/* ══════════════════════════════════════════════════════════════ */}
              {/* 1. ASSETS SECTION */}
              {/* ══════════════════════════════════════════════════════════════ */}
              <div>
                <div className="border-b-2 border-slate-900 dark:border-white pb-1.5 mb-3 flex justify-between items-end">
                  <h4 className="text-xs font-black uppercase tracking-wider text-slate-900 dark:text-white">
                    I. ASSETS
                  </h4>
                  <div className="flex gap-16 text-[10px] font-bold uppercase text-slate-500 dark:text-slate-400">
                    <span className="w-28 text-right">As of {data.as_of_date}</span>
                    {data.comparison && (
                      <span className="w-28 text-right">As of {data.comparison.as_of_date}</span>
                    )}
                  </div>
                </div>

                {/* A. Current Assets */}
                <div className="mb-6">
                  <h5 className="text-[11px] font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wide mb-2 pl-2">
                    A. Current Assets
                  </h5>

                  {data.sections.current_assets.categories.map((cat, catIdx) => (
                    <div key={cat.group_code} className="mb-3 pl-4">
                      <div className="text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
                        {cat.group_name} ({cat.group_code})
                      </div>
                      <div className="divide-y divide-slate-100 dark:divide-slate-800/60 pl-2">
                        {cat.accounts.map((acct) => (
                          <div
                            key={acct.code}
                            className="py-1 flex justify-between items-center text-xs hover:bg-slate-50 dark:hover:bg-slate-800/40"
                          >
                            <span className="text-slate-700 dark:text-slate-300">
                              <span className="font-mono text-slate-400 text-[11px] mr-2">{acct.code}</span>
                              {acct.name}
                            </span>
                            <div className="flex gap-16 font-mono text-xs">
                              <span className="w-28 text-right text-slate-800 dark:text-slate-200">
                                {formatCurrency(acct.amount)}
                              </span>
                              {data.comparison && (
                                <span className="w-28 text-right text-slate-500">
                                  {formatCurrency(
                                    data.comparison.sections.current_assets.categories[catIdx]?.accounts.find(
                                      (x) => x.code === acct.code
                                    )?.amount || 0
                                  )}
                                </span>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                      {/* Category Subtotal */}
                      <div className="pt-1 flex justify-between items-center text-xs font-semibold text-slate-600 dark:text-slate-300 border-t border-dotted border-slate-200 dark:border-slate-800">
                        <span className="italic pl-2">Subtotal: {cat.group_name}</span>
                        <div className="flex gap-16 font-mono">
                          <span className="w-28 text-right">{formatCurrency(cat.subtotal)}</span>
                          {data.comparison && (
                            <span className="w-28 text-right text-slate-500">
                              {formatCurrency(
                                data.comparison.sections.current_assets.categories[catIdx]?.subtotal || 0
                              )}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}

                  {/* Total Current Assets */}
                  <div className="mt-2 py-1.5 px-3 bg-slate-50 dark:bg-slate-800/40 rounded flex justify-between items-center text-xs font-bold text-slate-900 dark:text-white">
                    <span>Total Current Assets</span>
                    <div className="flex gap-16 font-mono">
                      <span className="w-28 text-right">
                        {formatCurrency(data.sections.current_assets.total_current_assets)}
                      </span>
                      {data.comparison && (
                        <span className="w-28 text-right text-slate-500">
                          {formatCurrency(data.comparison.sections.current_assets.total_current_assets)}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* B. Non-Current / Fixed Assets (PP&E) */}
                <div className="mb-4">
                  <h5 className="text-[11px] font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wide mb-2 pl-2">
                    B. Non-Current Assets (Property, Plant &amp; Equipment)
                  </h5>
                  <div className="pl-6 divide-y divide-slate-100 dark:divide-slate-800/60">
                    {data.sections.fixed_assets.gross_fixed_assets.map((acct, idx) => (
                      <div
                        key={acct.code}
                        className="py-1 flex justify-between items-center text-xs hover:bg-slate-50 dark:hover:bg-slate-800/40"
                      >
                        <span className="text-slate-700 dark:text-slate-300">
                          <span className="font-mono text-slate-400 text-[11px] mr-2">{acct.code}</span>
                          {acct.name}
                        </span>
                        <div className="flex gap-16 font-mono text-xs">
                          <span className="w-28 text-right text-slate-800 dark:text-slate-200">
                            {formatCurrency(acct.amount)}
                          </span>
                          {data.comparison && (
                            <span className="w-28 text-right text-slate-500">
                              {formatCurrency(
                                data.comparison.sections.fixed_assets.gross_fixed_assets[idx]?.amount || 0
                              )}
                            </span>
                          )}
                        </div>
                      </div>
                    ))}

                    {/* Gross Fixed Assets Subtotal */}
                    <div className="py-1 flex justify-between items-center text-xs font-semibold text-slate-600 dark:text-slate-400">
                      <span className="italic">Gross Fixed Assets</span>
                      <div className="flex gap-16 font-mono">
                        <span className="w-28 text-right">
                          {formatCurrency(data.sections.fixed_assets.gross_subtotal)}
                        </span>
                        {data.comparison && (
                          <span className="w-28 text-right text-slate-500">
                            {formatCurrency(data.comparison.sections.fixed_assets.gross_subtotal)}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Less: Accumulated Depreciation */}
                    <div className="py-1 flex justify-between items-center text-xs text-rose-600 dark:text-rose-400 font-medium">
                      <span>
                        <span className="font-mono text-slate-400 text-[11px] mr-2">
                          {data.sections.fixed_assets.accumulated_depreciation.code}
                        </span>
                        Less: Accumulated Depreciation
                      </span>
                      <div className="flex gap-16 font-mono">
                        <span className="w-28 text-right">
                          (₹{data.sections.fixed_assets.accumulated_depreciation.amount.toFixed(2)})
                        </span>
                        {data.comparison && (
                          <span className="w-28 text-right text-slate-500">
                            (₹
                            {data.comparison.sections.fixed_assets.accumulated_depreciation.amount.toFixed(
                              2
                            )}
                            )
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Net Fixed Assets */}
                  <div className="mt-2 py-1.5 px-3 bg-slate-50 dark:bg-slate-800/40 rounded flex justify-between items-center text-xs font-bold text-slate-900 dark:text-white">
                    <span>Net Fixed Assets (Net Book Value)</span>
                    <div className="flex gap-16 font-mono">
                      <span className="w-28 text-right">
                        {formatCurrency(data.sections.fixed_assets.net_fixed_assets)}
                      </span>
                      {data.comparison && (
                        <span className="w-28 text-right text-slate-500">
                          {formatCurrency(data.comparison.sections.fixed_assets.net_fixed_assets)}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Grand Total Assets */}
                <div className="mt-4 py-2.5 px-4 bg-slate-900 dark:bg-slate-800 text-white rounded-lg flex justify-between items-center text-sm font-black tracking-wide">
                  <span>TOTAL ASSETS</span>
                  <div className="flex gap-16 font-mono">
                    <span className="w-28 text-right">{formatCurrency(data.summary.total_assets)}</span>
                    {data.comparison && (
                      <span className="w-28 text-right text-slate-300">
                        {formatCurrency(data.comparison.summary.total_assets)}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* ══════════════════════════════════════════════════════════════ */}
              {/* 2. LIABILITIES & EQUITY SECTION */}
              {/* ══════════════════════════════════════════════════════════════ */}
              <div>
                <div className="border-b-2 border-slate-900 dark:border-white pb-1.5 mb-3 flex justify-between items-end">
                  <h4 className="text-xs font-black uppercase tracking-wider text-slate-900 dark:text-white">
                    II. LIABILITIES &amp; OWNER&apos;S EQUITY
                  </h4>
                  <div className="flex gap-16 text-[10px] font-bold uppercase text-slate-500 dark:text-slate-400">
                    <span className="w-28 text-right">As of {data.as_of_date}</span>
                    {data.comparison && (
                      <span className="w-28 text-right">As of {data.comparison.as_of_date}</span>
                    )}
                  </div>
                </div>

                {/* A. Current Liabilities */}
                <div className="mb-6">
                  <h5 className="text-[11px] font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wide mb-2 pl-2">
                    A. Current Liabilities
                  </h5>

                  {data.sections.current_liabilities.categories.map((cat, catIdx) => (
                    <div key={cat.group_code} className="mb-3 pl-4">
                      <div className="text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
                        {cat.group_name} ({cat.group_code})
                      </div>
                      <div className="divide-y divide-slate-100 dark:divide-slate-800/60 pl-2">
                        {cat.accounts.map((acct) => (
                          <div
                            key={acct.code}
                            className="py-1 flex justify-between items-center text-xs hover:bg-slate-50 dark:hover:bg-slate-800/40"
                          >
                            <span className="text-slate-700 dark:text-slate-300">
                              <span className="font-mono text-slate-400 text-[11px] mr-2">{acct.code}</span>
                              {acct.name}
                            </span>
                            <div className="flex gap-16 font-mono text-xs">
                              <span className="w-28 text-right text-slate-800 dark:text-slate-200">
                                {formatCurrency(acct.amount)}
                              </span>
                              {data.comparison && (
                                <span className="w-28 text-right text-slate-500">
                                  {formatCurrency(
                                    data.comparison.sections.current_liabilities.categories[catIdx]?.accounts.find(
                                      (x) => x.code === acct.code
                                    )?.amount || 0
                                  )}
                                </span>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                      <div className="pt-1 flex justify-between items-center text-xs font-semibold text-slate-600 dark:text-slate-300 border-t border-dotted border-slate-200 dark:border-slate-800">
                        <span className="italic pl-2">Subtotal: {cat.group_name}</span>
                        <div className="flex gap-16 font-mono">
                          <span className="w-28 text-right">{formatCurrency(cat.subtotal)}</span>
                          {data.comparison && (
                            <span className="w-28 text-right text-slate-500">
                              {formatCurrency(
                                data.comparison.sections.current_liabilities.categories[catIdx]?.subtotal || 0
                              )}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}

                  {/* Other Current Liabilities (e.g. 2130 TDS) */}
                  {data.sections.current_liabilities.other_current_liabilities.length > 0 && (
                    <div className="mb-3 pl-4">
                      <div className="text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
                        Other Current Liabilities
                      </div>
                      <div className="divide-y divide-slate-100 dark:divide-slate-800/60 pl-2">
                        {data.sections.current_liabilities.other_current_liabilities.map((acct, idx) => (
                          <div
                            key={acct.code}
                            className="py-1 flex justify-between items-center text-xs hover:bg-slate-50 dark:hover:bg-slate-800/40"
                          >
                            <span className="text-slate-700 dark:text-slate-300">
                              <span className="font-mono text-slate-400 text-[11px] mr-2">{acct.code}</span>
                              {acct.name}
                            </span>
                            <div className="flex gap-16 font-mono text-xs">
                              <span className="w-28 text-right text-slate-800 dark:text-slate-200">
                                {formatCurrency(acct.amount)}
                              </span>
                              {data.comparison && (
                                <span className="w-28 text-right text-slate-500">
                                  {formatCurrency(
                                    data.comparison.sections.current_liabilities.other_current_liabilities[idx]
                                      ?.amount || 0
                                  )}
                                </span>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Total Current Liabilities */}
                  <div className="mt-2 py-1.5 px-3 bg-slate-50 dark:bg-slate-800/40 rounded flex justify-between items-center text-xs font-bold text-slate-900 dark:text-white">
                    <span>Total Current Liabilities</span>
                    <div className="flex gap-16 font-mono">
                      <span className="w-28 text-right">
                        {formatCurrency(data.sections.current_liabilities.total_current_liabilities)}
                      </span>
                      {data.comparison && (
                        <span className="w-28 text-right text-slate-500">
                          {formatCurrency(
                            data.comparison.sections.current_liabilities.total_current_liabilities
                          )}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* B. Long-Term Liabilities */}
                <div className="mb-6">
                  <h5 className="text-[11px] font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wide mb-2 pl-2">
                    B. Non-Current / Long-Term Liabilities
                  </h5>
                  <div className="pl-6 divide-y divide-slate-100 dark:divide-slate-800/60">
                    {data.sections.long_term_liabilities.accounts.map((acct, idx) => (
                      <div
                        key={acct.code}
                        className="py-1 flex justify-between items-center text-xs hover:bg-slate-50 dark:hover:bg-slate-800/40"
                      >
                        <span className="text-slate-700 dark:text-slate-300">
                          <span className="font-mono text-slate-400 text-[11px] mr-2">{acct.code}</span>
                          {acct.name}
                        </span>
                        <div className="flex gap-16 font-mono text-xs">
                          <span className="w-28 text-right text-slate-800 dark:text-slate-200">
                            {formatCurrency(acct.amount)}
                          </span>
                          {data.comparison && (
                            <span className="w-28 text-right text-slate-500">
                              {formatCurrency(
                                data.comparison.sections.long_term_liabilities.accounts[idx]?.amount || 0
                              )}
                            </span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Total Long-Term Liabilities */}
                  <div className="mt-2 py-1.5 px-3 bg-slate-50 dark:bg-slate-800/40 rounded flex justify-between items-center text-xs font-bold text-slate-900 dark:text-white">
                    <span>Total Non-Current Liabilities</span>
                    <div className="flex gap-16 font-mono">
                      <span className="w-28 text-right">
                        {formatCurrency(data.sections.long_term_liabilities.total_long_term_liabilities)}
                      </span>
                      {data.comparison && (
                        <span className="w-28 text-right text-slate-500">
                          {formatCurrency(
                            data.comparison.sections.long_term_liabilities.total_long_term_liabilities
                          )}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Subtotal: Total Liabilities */}
                <div className="py-2 px-3 bg-slate-100 dark:bg-slate-800 rounded font-bold text-xs text-slate-900 dark:text-white flex justify-between items-center mb-6">
                  <span>TOTAL LIABILITIES</span>
                  <div className="flex gap-16 font-mono">
                    <span className="w-28 text-right">{formatCurrency(data.summary.total_liabilities)}</span>
                    {data.comparison && (
                      <span className="w-28 text-right text-slate-400">
                        {formatCurrency(data.comparison.summary.total_liabilities)}
                      </span>
                    )}
                  </div>
                </div>

                {/* C. Owner's Equity */}
                <div className="mb-4">
                  <h5 className="text-[11px] font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wide mb-2 pl-2">
                    C. Owner&apos;s Equity &amp; Reserves
                  </h5>
                  <div className="pl-6 divide-y divide-slate-100 dark:divide-slate-800/60">
                    {/* Contributed Capital */}
                    <div className="py-1 flex justify-between items-center text-xs hover:bg-slate-50 dark:hover:bg-slate-800/40">
                      <span className="text-slate-700 dark:text-slate-300">
                        <span className="font-mono text-slate-400 text-[11px] mr-2">
                          {data.sections.equity.capital.code}
                        </span>
                        {data.sections.equity.capital.name}
                      </span>
                      <div className="flex gap-16 font-mono text-xs">
                        <span className="w-28 text-right">
                          {formatCurrency(data.sections.equity.capital.amount)}
                        </span>
                        {data.comparison && (
                          <span className="w-28 text-right text-slate-500">
                            {formatCurrency(data.comparison.sections.equity.capital.amount)}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Less: Drawings */}
                    <div className="py-1 flex justify-between items-center text-xs text-rose-600 dark:text-rose-400 font-medium">
                      <span>
                        <span className="font-mono text-slate-400 text-[11px] mr-2">
                          {data.sections.equity.drawings.code}
                        </span>
                        Less: {data.sections.equity.drawings.name}
                      </span>
                      <div className="flex gap-16 font-mono text-xs">
                        <span className="w-28 text-right">
                          (₹{data.sections.equity.drawings.amount.toFixed(2)})
                        </span>
                        {data.comparison && (
                          <span className="w-28 text-right text-slate-500">
                            (₹{data.comparison.sections.equity.drawings.amount.toFixed(2)})
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Net Contributed Capital */}
                    <div className="py-1 flex justify-between items-center text-xs font-semibold text-slate-600 dark:text-slate-400">
                      <span className="italic pl-2">Net Contributed Capital</span>
                      <div className="flex gap-16 font-mono">
                        <span className="w-28 text-right">{formatCurrency(data.sections.equity.net_capital)}</span>
                        {data.comparison && (
                          <span className="w-28 text-right text-slate-500">
                            {formatCurrency(data.comparison.sections.equity.net_capital)}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Retained Earnings (Prior Years) */}
                    <div className="py-1 flex justify-between items-center text-xs hover:bg-slate-50 dark:hover:bg-slate-800/40">
                      <span className="text-slate-700 dark:text-slate-300">
                        <span className="font-mono text-slate-400 text-[11px] mr-2">
                          {data.sections.equity.retained_earnings_prior.code}
                        </span>
                        {data.sections.equity.retained_earnings_prior.name}
                      </span>
                      <div className="flex gap-16 font-mono text-xs">
                        <span className="w-28 text-right">
                          {formatCurrency(data.sections.equity.retained_earnings_prior.amount)}
                        </span>
                        {data.comparison && (
                          <span className="w-28 text-right text-slate-500">
                            {formatCurrency(data.comparison.sections.equity.retained_earnings_prior.amount)}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Current Year Net Earnings (Dynamic P&L Roll-Up) */}
                    <div className="py-1 flex justify-between items-center text-xs hover:bg-slate-50 dark:hover:bg-slate-800/40">
                      <span className="text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                        <span className="font-mono text-slate-400 text-[11px] mr-2">
                          {data.sections.equity.current_year_net_earnings.code}
                        </span>
                        {data.sections.equity.current_year_net_earnings.name}
                        <span className="text-[9px] bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 px-1.5 py-0.5 rounded font-semibold uppercase">
                          Dynamic P&amp;L
                        </span>
                      </span>
                      <div className="flex gap-16 font-mono text-xs">
                        <span
                          className={`w-28 text-right font-bold ${
                            data.sections.equity.current_year_net_earnings.amount >= 0
                              ? "text-emerald-700 dark:text-emerald-400"
                              : "text-rose-700 dark:text-rose-400"
                          }`}
                        >
                          {formatCurrency(data.sections.equity.current_year_net_earnings.amount)}
                        </span>
                        {data.comparison && (
                          <span className="w-28 text-right text-slate-500">
                            {formatCurrency(data.comparison.sections.equity.current_year_net_earnings.amount)}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Opening Balance Offset (3300) */}
                    <div className="py-1 flex justify-between items-center text-xs hover:bg-slate-50 dark:hover:bg-slate-800/40">
                      <span className="text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                        <span className="font-mono text-slate-400 text-[11px] mr-2">
                          {data.sections.equity.opening_balance_offset.code}
                        </span>
                        {data.sections.equity.opening_balance_offset.name}
                        {data.sections.equity.opening_balance_offset.amount !== 0 && (
                          <span className="text-[9px] bg-amber-100 dark:bg-amber-900/40 text-amber-800 dark:text-amber-300 px-1.5 py-0.5 rounded font-semibold">
                            Offset Reserve
                          </span>
                        )}
                      </span>
                      <div className="flex gap-16 font-mono text-xs">
                        <span className="w-28 text-right">
                          {formatCurrency(data.sections.equity.opening_balance_offset.amount)}
                        </span>
                        {data.comparison && (
                          <span className="w-28 text-right text-slate-500">
                            {formatCurrency(data.comparison.sections.equity.opening_balance_offset.amount)}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Total Equity */}
                  <div className="mt-2 py-1.5 px-3 bg-slate-50 dark:bg-slate-800/40 rounded flex justify-between items-center text-xs font-bold text-slate-900 dark:text-white">
                    <span>Total Owner&apos;s Equity</span>
                    <div className="flex gap-16 font-mono">
                      <span className="w-28 text-right">{formatCurrency(data.sections.equity.total_equity)}</span>
                      {data.comparison && (
                        <span className="w-28 text-right text-slate-500">
                          {formatCurrency(data.comparison.sections.equity.total_equity)}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Grand Total Liabilities & Equity */}
                <div className="mt-4 py-2.5 px-4 bg-slate-900 dark:bg-slate-800 text-white rounded-lg flex justify-between items-center text-sm font-black tracking-wide">
                  <span>TOTAL LIABILITIES &amp; EQUITY</span>
                  <div className="flex gap-16 font-mono">
                    <span className="w-28 text-right">
                      {formatCurrency(data.summary.total_liabilities_and_equity)}
                    </span>
                    {data.comparison && (
                      <span className="w-28 text-right text-slate-300">
                        {formatCurrency(data.comparison.summary.total_liabilities_and_equity)}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

export default BalanceSheetPanel;
