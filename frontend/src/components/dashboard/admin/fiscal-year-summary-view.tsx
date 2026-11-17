"use client";

/**
 * CakeToHome ERP — Fiscal Year Summary View
 * Phase 5A.6 Substep 5.4: Module A (Accounting Reporting UI)
 *
 * READ-ONLY: Performs zero mutations and zero client-side accounting calculations.
 * Data source: GET /api/v1/admin/accounting/reports/fiscal-year-summary
 *
 * Features:
 * - Multi-year overview of fiscal year states, lock status, and period close progress.
 * - Active closing voucher details with net profit closed to Account 3210.
 * - Historical lockout guard indicators.
 * - Single-year filter or master multi-year inventory.
 */

import React, { useState, useEffect, useCallback } from "react";
import { Lock, Unlock, Shield, Calendar, RefreshCw, AlertCircle, FileText, CheckCircle2, Download, Printer } from "lucide-react";
import { exportFiscalYearSummaryCsv, triggerPrint } from "@frontend/lib/data/accounting-exports";

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

export function FiscalYearSummaryView({ branchId }: { branchId?: string }) {
  const [selectedFY, setSelectedFY] = useState<string>("ALL");
  const [summaryList, setSummaryList] = useState<FiscalYearSummaryItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams();
      if (selectedFY !== "ALL") params.set("fiscal_year", selectedFY);
      if (branchId) params.set("branch_id", branchId);

      const res = await fetch(`/api/v1/admin/accounting/reports/fiscal-year-summary?${params}`, {
        credentials: "include",
      });
      const json = await res.json();

      if (!res.ok || !json.success) {
        setError(json.message || json.error || `HTTP ${res.status}`);
        setSummaryList([]);
        return;
      }

      const list = json.data || json.fiscal_years || json.summary || [];
      setSummaryList(Array.isArray(list) ? list : [list]);
    } catch (err: any) {
      setError(err.message || "Network error fetching Fiscal Year Summary.");
      setSummaryList([]);
    } finally {
      setLoading(false);
    }
  }, [selectedFY, branchId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // High-level aggregate metrics from server list
  const totalYears = summaryList.length;
  const closedYears = summaryList.filter((y) => y.status === "CLOSED").length;
  const fullyLockedYears = summaryList.filter((y) => y.all_periods_locked).length;
  const lockedOutYears = summaryList.filter((y) => y.historical_lockout_active).length;

  return (
    <div className="space-y-6">
      {/* ── Control Bar ── */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-xs">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div>
              <label htmlFor="fy-filter-select" className="block text-[10px] font-bold text-slate-500 dark:text-slate-400 mb-1 uppercase tracking-wider">
                Filter Fiscal Year
              </label>
              <select
                id="fy-filter-select"
                value={selectedFY}
                onChange={(e) => setSelectedFY(e.target.value)}
                className="py-1.5 px-3 text-xs font-semibold rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-brand-navy"
              >
                <option value="ALL">All Tracked Fiscal Years</option>
                <option value="FY2526">FY2526 (2025–2026)</option>
                <option value="FY2425">FY2425 (2024–2025)</option>
                <option value="FY2324">FY2324 (2023–2024)</option>
                <option value="FY2223">FY2223 (2022–2023)</option>
              </select>
            </div>

            <div className="pt-5 flex items-center gap-2">
              <button
                type="button"
                onClick={fetchData}
                disabled={loading}
                className="inline-flex items-center gap-1.5 py-1.5 px-4 text-xs font-bold text-white bg-brand-navy hover:bg-[#162447] rounded-lg transition-colors disabled:opacity-50"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
                <span>{loading ? "Loading…" : "Refresh"}</span>
              </button>
              <button
                type="button"
                onClick={() => exportFiscalYearSummaryCsv(summaryList as any, branchId)}
                disabled={summaryList.length === 0}
                className="inline-flex items-center gap-1.5 py-1.5 px-3 text-xs font-semibold rounded-lg bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/60 hover:bg-emerald-100 dark:hover:bg-emerald-900/60 transition shadow-xs disabled:opacity-50"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Export CSV</span>
              </button>
              <button
                type="button"
                onClick={triggerPrint}
                className="inline-flex items-center gap-1.5 py-1.5 px-3 text-xs font-semibold rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:bg-slate-200 dark:hover:bg-slate-700 transition shadow-xs"
              >
                <Printer className="w-3.5 h-3.5" />
                <span>Print / PDF</span>
              </button>
            </div>
          </div>

          <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
            <Shield className="w-4 h-4 text-brand-primary" />
            <span>Authoritative GL • Fiscal Period Lockout &amp; Close Status</span>
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

      {/* ── Metric Cards ── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-xs">
          <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider block mb-1">
            Tracked Fiscal Years
          </span>
          <span className="text-2xl font-black text-slate-900 dark:text-white">
            {totalYears}
          </span>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-xs">
          <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider block mb-1">
            Closed Years
          </span>
          <span className="text-2xl font-black text-emerald-600 dark:text-emerald-400">
            {closedYears}
          </span>
          <span className="text-[11px] text-slate-500 ml-1.5 font-medium">/ {totalYears}</span>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-xs">
          <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider block mb-1">
            Fully Locked Periods
          </span>
          <span className="text-2xl font-black text-brand-primary dark:text-brand-primary">
            {fullyLockedYears}
          </span>
          <span className="text-[11px] text-slate-500 ml-1.5 font-medium">FYs</span>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-xs">
          <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider block mb-1">
            Historical Lockout Active
          </span>
          <span className="text-2xl font-black text-brand-gold dark:text-brand-gold">
            {lockedOutYears}
          </span>
          <span className="text-[11px] text-slate-500 ml-1.5 font-medium">FYs</span>
        </div>
      </div>

      {/* ── Master Fiscal Year Table ── */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-xs">
        <div className="p-5 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center">
          <div>
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">
              Fiscal Year Lifecycle &amp; Governance Registry
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Status, period locking status, active closing voucher, and P&amp;L surplus across years.
            </p>
          </div>
          <span className="text-xs text-slate-400 font-mono">
            {summaryList.length} Records
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left">
            <thead>
              <tr className="bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400 uppercase text-[10px] tracking-wider">
                <th className="py-3 px-4 font-bold">Fiscal Year</th>
                <th className="py-3 px-3 font-bold text-center">Status</th>
                <th className="py-3 px-4 font-bold">Period Lock Progress</th>
                <th className="py-3 px-4 font-bold text-right">Operating Revenue</th>
                <th className="py-3 px-4 font-bold text-right">Operating Expense</th>
                <th className="py-3 px-4 font-bold text-right">Net Profit</th>
                <th className="py-3 px-4 font-bold">Closing Voucher</th>
                <th className="py-3 px-3 font-bold text-center">Historical Lockout</th>
                <th className="py-3 px-3 font-bold text-center">Cycles</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {summaryList.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-8 text-center text-slate-400 italic">
                    {loading ? "Loading fiscal year summaries…" : "No fiscal year records found."}
                  </td>
                </tr>
              ) : (
                summaryList.map((item) => {
                  const lockPercent = item.total_periods > 0
                    ? Math.round((item.locked_periods / item.total_periods) * 100)
                    : 0;

                  return (
                    <tr key={item.fiscal_year} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/20">
                      {/* Fiscal Year & Dates */}
                      <td className="py-3 px-4 font-medium">
                        <div className="font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                          <Calendar className="w-3.5 h-3.5 text-slate-400" />
                          <span>{item.fiscal_year}</span>
                        </div>
                        <div className="text-[10px] text-slate-400 mt-0.5">
                          {item.start_date} → {item.end_date}
                        </div>
                      </td>

                      {/* Status */}
                      <td className="py-3 px-3 text-center">
                        <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                          item.status === "CLOSED"
                            ? "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800"
                            : item.status === "REOPENED"
                            ? "bg-brand-light dark:bg-brand-navy/40 text-brand-navy dark:text-brand-primary/30 border border-brand-primary/30 dark:border-brand-navy"
                            : "bg-brand-gold-light dark:bg-brand-gold-dark/40 text-brand-gold-dark dark:text-brand-gold/40 border border-brand-gold/40 dark:border-brand-gold-dark"
                        }`}>
                          {item.status === "CLOSED" ? <Lock className="w-2.5 h-2.5" /> : item.status === "REOPENED" ? <RefreshCw className="w-2.5 h-2.5" /> : <Unlock className="w-2.5 h-2.5" />}
                          {item.status}
                        </span>
                      </td>

                      {/* Period Lock Progress */}
                      <td className="py-3 px-4">
                        <div className="flex items-center justify-between text-[11px] mb-1">
                          <span className="font-semibold text-slate-700 dark:text-slate-300">
                            {item.locked_periods} / {item.total_periods} Locked
                          </span>
                          <span className="text-[10px] text-slate-400">{lockPercent}%</span>
                        </div>
                        <div className="w-full bg-slate-100 dark:bg-slate-800 rounded-full h-1.5 overflow-hidden">
                          <div
                            className={`h-1.5 rounded-full ${
                              item.all_periods_locked ? "bg-emerald-500" : "bg-brand-primary"
                            }`}
                            style={{ width: `${lockPercent}%` }}
                          />
                        </div>
                      </td>

                      {/* Financials */}
                      <td className="py-3 px-4 text-right font-mono text-slate-800 dark:text-slate-200">
                        {formatCurrency(item.operating_revenue)}
                      </td>
                      <td className="py-3 px-4 text-right font-mono text-slate-500">
                        {formatCurrency(item.operating_expense)}
                      </td>
                      <td className={`py-3 px-4 text-right font-mono font-bold ${
                        item.net_profit >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"
                      }`}>
                        {formatCurrency(item.net_profit)}
                      </td>

                      {/* Closing Voucher */}
                      <td className="py-3 px-4">
                        {item.active_closing_voucher ? (
                          <div className="text-[11px]">
                            <span className="font-mono font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1">
                              <FileText className="w-3 h-3 text-brand-primary" />
                              {item.active_closing_voucher.voucher_no}
                            </span>
                            <span className="text-[10px] text-slate-400 block mt-0.5">
                              Closed: {item.active_closing_voucher.close_date}
                            </span>
                          </div>
                        ) : (
                          <span className="text-slate-400 italic text-[11px]">None (Unclosed)</span>
                        )}
                      </td>

                      {/* Historical Lockout */}
                      <td className="py-3 px-3 text-center">
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold ${
                          item.historical_lockout_active
                            ? "bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-300 dark:border-slate-700"
                            : "bg-slate-50 dark:bg-slate-900 text-slate-400"
                        }`}>
                          {item.historical_lockout_active ? (
                            <>
                              <Shield className="w-3 h-3 text-emerald-500" />
                              <span>LOCKED</span>
                            </>
                          ) : (
                            <span>OPEN</span>
                          )}
                        </span>
                      </td>

                      {/* Cycles */}
                      <td className="py-3 px-3 text-center font-mono text-slate-500 text-[11px]">
                        <span title="Close Cycles">{item.close_cycle_count}c</span>
                        <span className="mx-1 text-slate-300">/</span>
                        <span title="Reopen Cycles">{item.reopen_cycle_count}r</span>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
