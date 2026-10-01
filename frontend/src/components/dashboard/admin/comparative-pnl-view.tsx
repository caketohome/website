"use client";

/**
 * CakeToHome ERP — Comparative Profit & Loss View
 * Phase 5A.6 Substep 5.4: Module A (Accounting Reporting UI)
 *
 * READ-ONLY: Performs zero mutations and zero client-side accounting calculations.
 * Data source: GET /api/v1/admin/accounting/reports/comparative-pnl
 *
 * Features:
 * - Side-by-side comparison of two Indian Fiscal Years (e.g. FY2425 vs FY2324).
 * - Full 5-section statement breakdown derived directly from PostgreSQL GL.
 * - Server-provided variance amounts and variance percentages.
 * - KPI summary cards with directional indicators.
 */

import React, { useState, useEffect, useCallback } from "react";
import { TrendingUp, TrendingDown, ArrowRight, Scale, ShieldCheck, AlertCircle, RefreshCw, Download, Printer } from "lucide-react";
import { exportComparativeProfitLossCsv, triggerPrint } from "@frontend/lib/data/accounting-exports";

interface ComparativePnLAccountLine {
  code: string;
  name: string;
  type: "REVENUE" | "EXPENSE";
  subtype: string;
  current_amount: number;
  compare_amount: number;
  variance_amount: number;
  variance_percent: number | null;
}

interface ComparativePnLSection {
  label: string;
  accounts: ComparativePnLAccountLine[];
  current_total: number;
  compare_total: number;
  variance_total: number;
  variance_percent: number | null;
}

interface ComparativePnLData {
  success: boolean;
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
    gross_profit: { current: number; compare: number; variance_amount: number; variance_percent: number | null };
    operating_profit: { current: number; compare: number; variance_amount: number; variance_percent: number | null };
    net_profit_before_tax: { current: number; compare: number; variance_amount: number; variance_percent: number | null };
  };
}

const FY_OPTIONS = ["FY2526", "FY2425", "FY2324", "FY2223", "FY2122"];

function formatCurrency(amount: number | null | undefined): string {
  if (amount == null) return "₹0.00";
  const abs = Math.abs(amount);
  const formatted = new Intl.NumberFormat("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(abs);
  if (amount < 0) return `(₹${formatted})`;
  return `₹${formatted}`;
}

function formatPercent(pct: number | null | undefined): string {
  if (pct == null) return "—";
  const sign = pct > 0 ? "+" : "";
  return `${sign}${pct.toFixed(2)}%`;
}

export function ComparativePnLView({ branchId }: { branchId?: string }) {
  const [currentFY, setCurrentFY] = useState("FY2425");
  const [compareFY, setCompareFY] = useState("FY2324");
  const [data, setData] = useState<ComparativePnLData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    if (currentFY === compareFY) {
      setError("Current Fiscal Year and Comparison Fiscal Year cannot be identical.");
      setData(null);
      return;
    }
    setLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams({
        fiscal_year: currentFY,
        compare_fiscal_year: compareFY,
      });
      if (branchId) params.set("branch_id", branchId);

      const res = await fetch(`/api/v1/admin/accounting/reports/comparative-pnl?${params}`, {
        credentials: "include",
      });
      const json = await res.json();

      if (!res.ok || !json.success) {
        setError(json.message || json.error || `HTTP ${res.status}`);
        setData(null);
        return;
      }

      setData(json.data || json);
    } catch (err: any) {
      setError(err.message || "Network error fetching Comparative P&L.");
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [currentFY, compareFY, branchId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return (
    <div className="space-y-6">
      {/* ── Control Bar ── */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-xs">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-3">
            <div>
              <label htmlFor="comp-pnl-current-fy" className="block text-[10px] font-bold text-slate-500 dark:text-slate-400 mb-1 uppercase tracking-wider">
                Current Fiscal Year
              </label>
              <select
                id="comp-pnl-current-fy"
                value={currentFY}
                onChange={(e) => setCurrentFY(e.target.value)}
                className="py-1.5 px-3 text-xs font-semibold rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-[#1D2F5D]"
              >
                {FY_OPTIONS.map((fy) => (
                  <option key={fy} value={fy}>{fy}</option>
                ))}
              </select>
            </div>

            <div className="pt-5 text-slate-400">
              <ArrowRight className="w-4 h-4" />
            </div>

            <div>
              <label htmlFor="comp-pnl-compare-fy" className="block text-[10px] font-bold text-slate-500 dark:text-slate-400 mb-1 uppercase tracking-wider">
                Compare Fiscal Year
              </label>
              <select
                id="comp-pnl-compare-fy"
                value={compareFY}
                onChange={(e) => setCompareFY(e.target.value)}
                className="py-1.5 px-3 text-xs font-semibold rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-[#1D2F5D]"
              >
                {FY_OPTIONS.map((fy) => (
                  <option key={fy} value={fy}>{fy}</option>
                ))}
              </select>
            </div>

            <div className="pt-5">
              <button
                type="button"
                onClick={fetchData}
                disabled={loading}
                className="inline-flex items-center gap-1.5 py-1.5 px-4 text-xs font-bold text-white bg-[#1D2F5D] hover:bg-[#162447] rounded-lg transition-colors disabled:opacity-50"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
                <span>{loading ? "Loading…" : "Compare Periods"}</span>
              </button>
            </div>
          </div>

          <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
            <ShieldCheck className="w-4 h-4 text-emerald-500" />
            <span>Authoritative GL • Dual-Period Multi-Year Engine</span>
          </div>
        </div>
      </div>

      {/* ── Error Banner ── */}
      {error && (
        <div className="bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 rounded-xl p-4 flex items-center gap-3">
          <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400 shrink-0" />
          <p className="text-xs text-red-700 dark:text-red-300 font-medium">{error}</p>
        </div>
      )}

      {/* ── Data Display ── */}
      {data && (
        <div className="space-y-6">
          {/* ── KPI Summary Cards ── */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Gross Profit */}
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-xs">
              <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider block mb-1">
                Gross Profit
              </span>
              <div className="flex items-baseline justify-between">
                <span className="text-xl font-black text-slate-900 dark:text-white">
                  {formatCurrency(data.summary.gross_profit.current)}
                </span>
                <span className={`text-xs font-bold flex items-center gap-0.5 ${
                  (data.summary.gross_profit.variance_amount || 0) >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"
                }`}>
                  {(data.summary.gross_profit.variance_amount || 0) >= 0 ? <TrendingUp className="w-3.5 h-3.5" /> : <TrendingDown className="w-3.5 h-3.5" />}
                  {formatPercent(data.summary.gross_profit.variance_percent)}
                </span>
              </div>
              <div className="text-[11px] text-slate-500 mt-2 flex justify-between">
                <span>Prior ({data.compare_fiscal_year}):</span>
                <span className="font-semibold">{formatCurrency(data.summary.gross_profit.compare)}</span>
              </div>
            </div>

            {/* Operating Profit */}
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-xs">
              <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider block mb-1">
                Operating Profit (EBIT)
              </span>
              <div className="flex items-baseline justify-between">
                <span className="text-xl font-black text-slate-900 dark:text-white">
                  {formatCurrency(data.summary.operating_profit.current)}
                </span>
                <span className={`text-xs font-bold flex items-center gap-0.5 ${
                  (data.summary.operating_profit.variance_amount || 0) >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"
                }`}>
                  {(data.summary.operating_profit.variance_amount || 0) >= 0 ? <TrendingUp className="w-3.5 h-3.5" /> : <TrendingDown className="w-3.5 h-3.5" />}
                  {formatPercent(data.summary.operating_profit.variance_percent)}
                </span>
              </div>
              <div className="text-[11px] text-slate-500 mt-2 flex justify-between">
                <span>Prior ({data.compare_fiscal_year}):</span>
                <span className="font-semibold">{formatCurrency(data.summary.operating_profit.compare)}</span>
              </div>
            </div>

            {/* Net Profit Before Tax */}
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-xs">
              <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider block mb-1">
                Net Profit Before Tax
              </span>
              <div className="flex items-baseline justify-between">
                <span className="text-xl font-black text-slate-900 dark:text-white">
                  {formatCurrency(data.summary.net_profit_before_tax.current)}
                </span>
                <span className={`text-xs font-bold flex items-center gap-0.5 ${
                  (data.summary.net_profit_before_tax.variance_amount || 0) >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"
                }`}>
                  {(data.summary.net_profit_before_tax.variance_amount || 0) >= 0 ? <TrendingUp className="w-3.5 h-3.5" /> : <TrendingDown className="w-3.5 h-3.5" />}
                  {formatPercent(data.summary.net_profit_before_tax.variance_percent)}
                </span>
              </div>
              <div className="text-[11px] text-slate-500 mt-2 flex justify-between">
                <span>Prior ({data.compare_fiscal_year}):</span>
                <span className="font-semibold">{formatCurrency(data.summary.net_profit_before_tax.compare)}</span>
              </div>
            </div>
          </div>

          {/* ── Detailed Statement Table ── */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-xs">
            <div className="p-5 border-b border-slate-200 dark:border-slate-800 flex flex-wrap justify-between items-center gap-3">
              <div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                  Statement of Profit &amp; Loss Comparison
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  {data.current_fiscal_year} ({data.current_period.start_date} to {data.current_period.end_date}) vs{" "}
                  {data.compare_fiscal_year} ({data.compare_period.start_date} to {data.compare_period.end_date})
                </p>
              </div>
              <div className="flex items-center gap-2">
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 hidden sm:inline">
                  {data.current_fiscal_year} vs {data.compare_fiscal_year}
                </span>
                <button
                  type="button"
                  onClick={() => exportComparativeProfitLossCsv(data, branchId)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/60 hover:bg-emerald-100 dark:hover:bg-emerald-900/60 transition shadow-xs"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Export CSV</span>
                </button>
                <button
                  type="button"
                  onClick={triggerPrint}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:bg-slate-200 dark:hover:bg-slate-700 transition shadow-xs"
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span>Print / PDF</span>
                </button>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left">
                <thead>
                  <tr className="bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400 uppercase text-[10px] tracking-wider">
                    <th className="py-3 px-4 font-bold">Line Item / Account</th>
                    <th className="py-3 px-3 font-bold w-20">Code</th>
                    <th className="py-3 px-4 font-bold text-right w-36">{data.current_fiscal_year} (₹)</th>
                    <th className="py-3 px-4 font-bold text-right w-36">{data.compare_fiscal_year} (₹)</th>
                    <th className="py-3 px-4 font-bold text-right w-32">Variance (₹)</th>
                    <th className="py-3 px-4 font-bold text-right w-24">Var %</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {/* Render each section */}
                  {Object.entries(data.sections).map(([secKey, sec]) => (
                    <React.Fragment key={secKey}>
                      {/* Section Header */}
                      <tr className="bg-slate-100/60 dark:bg-slate-800/40">
                        <td colSpan={6} className="py-2.5 px-4 font-black text-slate-900 dark:text-white uppercase tracking-wide text-[11px]">
                          {sec.label}
                        </td>
                      </tr>

                      {/* Account Lines */}
                      {sec.accounts.length === 0 ? (
                        <tr>
                          <td colSpan={6} className="py-2 px-6 text-slate-400 italic">
                            No ledger activity recorded for this section.
                          </td>
                        </tr>
                      ) : (
                        sec.accounts.map((acct) => (
                          <tr key={acct.code} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/20">
                            <td className="py-2 px-6 text-slate-800 dark:text-slate-200 font-medium">
                              {acct.name}
                            </td>
                            <td className="py-2 px-3 font-mono text-slate-400 text-[11px]">
                              {acct.code}
                            </td>
                            <td className="py-2 px-4 text-right font-mono text-slate-900 dark:text-slate-100">
                              {formatCurrency(acct.current_amount)}
                            </td>
                            <td className="py-2 px-4 text-right font-mono text-slate-500">
                              {formatCurrency(acct.compare_amount)}
                            </td>
                            <td className={`py-2 px-4 text-right font-mono font-semibold ${
                              acct.variance_amount === 0 ? "text-slate-400" :
                              (acct.type === "REVENUE" ? acct.variance_amount > 0 : acct.variance_amount < 0)
                                ? "text-emerald-600 dark:text-emerald-400"
                                : "text-rose-600 dark:text-rose-400"
                            }`}>
                              {formatCurrency(acct.variance_amount)}
                            </td>
                            <td className="py-2 px-4 text-right font-mono text-slate-500">
                              {formatPercent(acct.variance_percent)}
                            </td>
                          </tr>
                        ))
                      )}

                      {/* Section Subtotal */}
                      <tr className="border-t border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/30 font-bold">
                        <td colSpan={2} className="py-2.5 px-4 text-slate-900 dark:text-white">
                          Total {sec.label}
                        </td>
                        <td className="py-2.5 px-4 text-right font-mono text-slate-900 dark:text-white">
                          {formatCurrency(sec.current_total)}
                        </td>
                        <td className="py-2.5 px-4 text-right font-mono text-slate-500">
                          {formatCurrency(sec.compare_total)}
                        </td>
                        <td className={`py-2.5 px-4 text-right font-mono ${
                          (sec.variance_total || 0) >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"
                        }`}>
                          {formatCurrency(sec.variance_total)}
                        </td>
                        <td className="py-2.5 px-4 text-right font-mono text-slate-600 dark:text-slate-300">
                          {formatPercent(sec.variance_percent)}
                        </td>
                      </tr>
                    </React.Fragment>
                  ))}

                  {/* ── Summary Lines ── */}
                  <tr className="bg-slate-200/60 dark:bg-slate-800 font-black border-t-2 border-slate-300 dark:border-slate-600">
                    <td colSpan={2} className="py-3 px-4 text-slate-900 dark:text-white text-xs uppercase tracking-wide">
                      Net Profit Before Tax
                    </td>
                    <td className="py-3 px-4 text-right font-mono text-slate-900 dark:text-white text-sm">
                      {formatCurrency(data.summary.net_profit_before_tax.current)}
                    </td>
                    <td className="py-3 px-4 text-right font-mono text-slate-600 dark:text-slate-400 text-sm">
                      {formatCurrency(data.summary.net_profit_before_tax.compare)}
                    </td>
                    <td className={`py-3 px-4 text-right font-mono text-sm ${
                      (data.summary.net_profit_before_tax.variance_amount || 0) >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"
                    }`}>
                      {formatCurrency(data.summary.net_profit_before_tax.variance_amount)}
                    </td>
                    <td className="py-3 px-4 text-right font-mono text-slate-800 dark:text-slate-200">
                      {formatPercent(data.summary.net_profit_before_tax.variance_percent)}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
