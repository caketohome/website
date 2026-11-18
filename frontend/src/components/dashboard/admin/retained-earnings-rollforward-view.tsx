"use client";

/**
 * CakeToHome ERP — Retained Earnings Roll-Forward View
 * Phase 5A.6 Substep 5.4: Module A (Accounting Reporting UI)
 *
 * READ-ONLY: Performs zero mutations and zero client-side accounting calculations.
 * Data source: GET /api/v1/admin/accounting/reports/retained-earnings-rollforward
 *
 * Features:
 * - Multi-year schedule of Account 3210 (Retained Earnings) roll-forward across fiscal years.
 * - Mathematical continuity verification: opening_re(N+1) === closing_re(N).
 * - Breakdown of Net Operating Profit, Transferred to RE, Drawings, and Reopen Reversals.
 * - Overall continuity verification badge and status alerts.
 */

import React, { useState, useEffect, useCallback } from "react";
import { ShieldCheck, AlertTriangle, ArrowRight, RefreshCw, AlertCircle, FileText, CheckCircle2, Download, Printer } from "lucide-react";
import { exportRetainedEarningsRollForwardCsv, triggerPrint } from "@frontend/lib/data/accounting-exports";

export interface RetainedEarningsYearRollForward {
  fiscal_year: string;
  start_date: string;
  end_date: string;
  is_closed: boolean;
  active_close_voucher_id: string | null;
  opening_retained_earnings: number;
  net_operating_profit: number;
  transferred_to_retained_earnings: number;
  drawings_transferred: number;
  reopen_reversals: number;
  closing_retained_earnings: number;
  continuity_verified: boolean;
}

export interface RetainedEarningsRollForwardResult {
  start_year: string;
  end_year: string;
  branch_id: string | null;
  years: RetainedEarningsYearRollForward[];
  overall_continuity_verified: boolean;
  multi_year_continuity_intact: boolean;
  timestamp: string;
}

const FY_OPTIONS = ["FY2122", "FY2223", "FY2324", "FY2425", "FY2526", "FY2627"];

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

export function RetainedEarningsRollForwardView({ branchId }: { branchId?: string }) {
  const [startYear, setStartYear] = useState<string>("FY2324");
  const [endYear, setEndYear] = useState<string>("FY2526");
  const [data, setData] = useState<RetainedEarningsRollForwardResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams({
        start_year: startYear,
        end_year: endYear,
      });
      if (branchId) params.set("branch_id", branchId);

      const res = await fetch(`/api/v1/admin/accounting/reports/retained-earnings-rollforward?${params}`, {
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
      setError(err.message || "Network error fetching Retained Earnings Roll-Forward.");
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [startYear, endYear, branchId]);

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
              <label htmlFor="re-start-year-select" className="block text-[10px] font-bold text-slate-500 dark:text-slate-400 mb-1 uppercase tracking-wider">
                Start Fiscal Year
              </label>
              <select
                id="re-start-year-select"
                value={startYear}
                onChange={(e) => setStartYear(e.target.value)}
                className="py-1.5 px-3 text-xs font-semibold rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-brand-navy"
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
              <label htmlFor="re-end-year-select" className="block text-[10px] font-bold text-slate-500 dark:text-slate-400 mb-1 uppercase tracking-wider">
                End Fiscal Year
              </label>
              <select
                id="re-end-year-select"
                value={endYear}
                onChange={(e) => setEndYear(e.target.value)}
                className="py-1.5 px-3 text-xs font-semibold rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-brand-navy"
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
                className="inline-flex items-center gap-1.5 py-1.5 px-4 text-xs font-bold text-white bg-brand-navy hover:bg-[#162447] rounded-lg transition-colors disabled:opacity-50"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
                <span>{loading ? "Loading…" : "Roll Forward"}</span>
              </button>
            </div>
          </div>

          <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
            <ShieldCheck className="w-4 h-4 text-emerald-500" />
            <span>Account 3210 Equity Roll-Forward • Indian AS Compliance</span>
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
          {/* ── Multi-Year Continuity Banner ── */}
          <div className={`p-4 rounded-2xl border flex items-center justify-between gap-4 ${
            data.overall_continuity_verified || data.multi_year_continuity_intact
              ? "bg-emerald-50/80 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-800/60"
              : "bg-rose-50/80 dark:bg-rose-950/20 border-rose-200 dark:border-rose-800/60"
          }`}>
            <div className="flex items-center gap-3">
              {data.overall_continuity_verified || data.multi_year_continuity_intact ? (
                <ShieldCheck className="w-6 h-6 text-emerald-600 dark:text-emerald-400 shrink-0" />
              ) : (
                <AlertTriangle className="w-6 h-6 text-rose-600 dark:text-rose-400 shrink-0" />
              )}
              <div>
                <h4 className={`text-xs font-bold ${
                  data.overall_continuity_verified || data.multi_year_continuity_intact
                    ? "text-emerald-900 dark:text-emerald-200"
                    : "text-rose-900 dark:text-rose-200"
                }`}>
                  {data.overall_continuity_verified || data.multi_year_continuity_intact
                    ? "Multi-Year Continuity Verified"
                    : "Continuity Exception Detected"}
                </h4>
                <p className={`text-[11px] mt-0.5 ${
                  data.overall_continuity_verified || data.multi_year_continuity_intact
                    ? "text-emerald-700 dark:text-emerald-300"
                    : "text-rose-700 dark:text-rose-300"
                }`}>
                  {data.overall_continuity_verified || data.multi_year_continuity_intact
                    ? "Opening Retained Earnings of each fiscal year mathematically equals Closing Retained Earnings of the prior year across all sequential periods."
                    : "A mathematical discrepancy exists between closing and opening retained earnings across sequential fiscal years."}
                </p>
              </div>
            </div>

            <div className="text-right shrink-0">
              <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black tracking-wide uppercase ${
                data.overall_continuity_verified || data.multi_year_continuity_intact
                  ? "bg-emerald-100 dark:bg-emerald-900/50 text-emerald-800 dark:text-emerald-200"
                  : "bg-rose-100 dark:bg-rose-900/50 text-rose-800 dark:text-rose-200"
              }`}>
                {data.overall_continuity_verified || data.multi_year_continuity_intact ? "✓ INTACT" : "✗ BROKEN"}
              </span>
            </div>
          </div>

          {/* ── Retained Earnings Roll-Forward Table ── */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-xs">
            <div className="p-5 border-b border-slate-200 dark:border-slate-800 flex flex-wrap justify-between items-center gap-3">
              <div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                  Account 3210 (Retained Earnings) Multi-Year Schedule
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Opening Balance + Operating Profit + Transfers − Drawings − Reversals = Closing Balance
                </p>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-slate-400 font-mono mr-2 hidden sm:inline">
                  {data.years?.length || 0} Fiscal Years
                </span>
                <button
                  type="button"
                  onClick={() => exportRetainedEarningsRollForwardCsv(data, branchId)}
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
                    <th className="py-3 px-4 font-bold">Fiscal Year</th>
                    <th className="py-3 px-4 font-bold text-right">Opening RE (₹)</th>
                    <th className="py-3 px-4 font-bold text-right">Operating Profit (₹)</th>
                    <th className="py-3 px-4 font-bold text-right">Transferred to RE (₹)</th>
                    <th className="py-3 px-4 font-bold text-right">Drawings (₹)</th>
                    <th className="py-3 px-4 font-bold text-right">Reversals (₹)</th>
                    <th className="py-3 px-4 font-bold text-right font-black">Closing RE (₹)</th>
                    <th className="py-3 px-3 font-bold text-center">Status</th>
                    <th className="py-3 px-3 font-bold text-center">Continuity</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {(!data.years || data.years.length === 0) ? (
                    <tr>
                      <td colSpan={9} className="py-8 text-center text-slate-400 italic">
                        No roll-forward years available for the selected range.
                      </td>
                    </tr>
                  ) : (
                    data.years.map((y, idx) => (
                      <tr key={y.fiscal_year} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/20">
                        {/* Fiscal Year & Dates */}
                        <td className="py-3 px-4 font-medium">
                          <div className="font-bold text-slate-900 dark:text-white">
                            {y.fiscal_year}
                          </div>
                          <div className="text-[10px] text-slate-400 mt-0.5">
                            {y.start_date} → {y.end_date}
                          </div>
                        </td>

                        {/* Opening RE */}
                        <td className="py-3 px-4 text-right font-mono text-slate-800 dark:text-slate-200 font-semibold">
                          {formatCurrency(y.opening_retained_earnings)}
                        </td>

                        {/* Net Operating Profit */}
                        <td className={`py-3 px-4 text-right font-mono ${
                          y.net_operating_profit >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"
                        }`}>
                          {formatCurrency(y.net_operating_profit)}
                        </td>

                        {/* Transferred to RE */}
                        <td className="py-3 px-4 text-right font-mono text-slate-700 dark:text-slate-300">
                          {formatCurrency(y.transferred_to_retained_earnings)}
                        </td>

                        {/* Drawings */}
                        <td className="py-3 px-4 text-right font-mono text-slate-500">
                          {formatCurrency(y.drawings_transferred)}
                        </td>

                        {/* Reopen Reversals */}
                        <td className="py-3 px-4 text-right font-mono text-slate-500">
                          {formatCurrency(y.reopen_reversals)}
                        </td>

                        {/* Closing RE */}
                        <td className="py-3 px-4 text-right font-mono font-black text-slate-900 dark:text-white bg-slate-50/50 dark:bg-slate-800/30">
                          {formatCurrency(y.closing_retained_earnings)}
                        </td>

                        {/* Status */}
                        <td className="py-3 px-3 text-center">
                          <span className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            y.is_closed
                              ? "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800"
                              : "bg-brand-gold-light dark:bg-brand-gold-dark/40 text-brand-gold-dark dark:text-brand-gold border border-brand-gold/40 dark:border-brand-gold-dark"
                          }`}>
                            {y.is_closed ? "CLOSED" : "UNCLOSED"}
                          </span>
                        </td>

                        {/* Continuity */}
                        <td className="py-3 px-3 text-center">
                          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold ${
                            y.continuity_verified
                              ? "text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/30"
                              : "text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/30"
                          }`}>
                            {y.continuity_verified ? (
                              <>
                                <CheckCircle2 className="w-3 h-3 text-emerald-500" />
                                <span>VERIFIED</span>
                              </>
                            ) : (
                              <span>DISCREPANCY</span>
                            )}
                          </span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* ── Explanatory Accounting Footnote ── */}
          <div className="bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700/60 rounded-xl p-4 text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
            <p className="font-bold text-slate-700 dark:text-slate-300 mb-1">
              Statutory Accounting Note on Retained Earnings (Account 3210):
            </p>
            <p>
              In accordance with Indian Accounting Standards and CakeToHome ERP invariants, revenue and expense nominal accounts are closed to Account 3210 upon Year-End Close. During an active fiscal year prior to close, net operating profit remains in nominal accounts and is tracked as unclosed surplus. Upon close execution, an immutable Year-End Close voucher credit transfers the net surplus to Account 3210.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
