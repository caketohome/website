"use client";

/**
 * CakeToHome ERP — Cash Flow Statement Panel
 * Phase 5A Step 5: Authoritative, read-only Cash Flow Statement workspace.
 *
 * READ-ONLY: Strictly zero database mutations.
 * Data source: GET /api/v1/admin/accounting/cash-flow
 *
 * Features:
 * - Method selector: Dual View (Direct + Indirect), Direct Method, or Indirect Reconciliation
 * - Date range selector with standard accounting presets (This Month, Last Month, This Quarter, This FY)
 * - Comparative period support with variance and percentage change columns
 * - Dual-method convergence verification (Direct CFO ≡ Indirect CFO)
 * - Balance Sheet cash position reconciliation (Closing Cash ≡ BS 1110)
 * - Six KPI cards: Opening Cash, Operating Cash, Investing Cash, Financing Cash, Net Change, Closing Cash
 * - Direct Method Schedule: Operating, Investing, Financing, and Internal Transfers
 * - Indirect Method Schedule: Net Profit Before Tax, Depreciation Addback, Working Capital Adjustments
 * - Responsive, dark-mode ready, printable
 */

import { useState, useCallback, useEffect } from "react";

// ─── Client Types ───────────────────────────────────────────────────────────────

interface CashFlowLineItem {
  key: string;
  label: string;
  amount: number;
  transaction_count?: number;
}

interface CashFlowSection {
  label: string;
  inflows: CashFlowLineItem[];
  outflows: CashFlowLineItem[];
  total_inflows: number;
  total_outflows: number;
  net_amount: number;
}

interface DirectCashFlowSchedule {
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

interface IndirectWorkingCapitalItem {
  account_code: string;
  account_name: string;
  category: "CURRENT_ASSET" | "CURRENT_LIABILITY";
  opening_balance: number;
  closing_balance: number;
  balance_delta: number;
  cash_impact: number;
}

interface IndirectCashFlowSchedule {
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

interface CashFlowSummary {
  opening_cash: number;
  net_operating_cash: number;
  net_investing_cash: number;
  net_financing_cash: number;
  net_cash_change: number;
  closing_cash: number;
}

interface CashFlowReconciliation {
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

interface CashFlowData {
  success: boolean;
  period: { start_date: string; end_date: string };
  branch: { id: string | null; name: string };
  method: "direct" | "indirect" | "both";
  direct_schedule?: DirectCashFlowSchedule;
  indirect_schedule?: IndirectCashFlowSchedule;
  summary: CashFlowSummary;
  reconciliation: CashFlowReconciliation;
  comparison?: CashFlowData;
  error?: string;
  message?: string;
}

interface BranchOption {
  id: string;
  name: string;
}

// ─── Formatters ────────────────────────────────────────────────────────────────

function formatINR(val: number | undefined | null): string {
  if (val === undefined || val === null || isNaN(val)) return "₹0.00";
  const abs = Math.abs(val);
  const formatted = new Intl.NumberFormat("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(abs);
  if (val < -0.004) return `(₹${formatted})`;
  return `₹${formatted}`;
}

function formatDelta(current: number, previous: number): { text: string; isPositive: boolean; pctText: string } {
  const diff = current - previous;
  const isPositive = diff >= 0;
  const absDiff = Math.abs(diff);
  const formattedDiff = new Intl.NumberFormat("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(absDiff);

  let pctText = "";
  if (previous !== 0) {
    const pct = Math.abs((diff / previous) * 100).toFixed(1);
    pctText = `${isPositive ? "+" : "-"}${pct}%`;
  } else if (diff !== 0) {
    pctText = "NEW";
  } else {
    pctText = "0.0%";
  }

  const sign = isPositive ? "+" : "-";
  return {
    text: `${sign}₹${formattedDiff}`,
    isPositive,
    pctText,
  };
}

// ─── Preset Ranges ─────────────────────────────────────────────────────────────

function getPresetDates(): Record<string, { start: string; end: string }> {
  const now = new Date();
  const y = now.getFullYear();
  const m = now.getMonth();

  // This Month
  const thisMonthStart = new Date(y, m, 1).toISOString().slice(0, 10);
  const thisMonthEnd = new Date(y, m + 1, 0).toISOString().slice(0, 10);

  // Last Month
  const lastMonthStart = new Date(y, m - 1, 1).toISOString().slice(0, 10);
  const lastMonthEnd = new Date(y, m, 0).toISOString().slice(0, 10);

  // This Quarter (Apr-Jun: Q1, Jul-Sep: Q2, Oct-Dec: Q3, Jan-Mar: Q4)
  const qStartMonth = Math.floor(m / 3) * 3;
  const quarterStart = new Date(y, qStartMonth, 1).toISOString().slice(0, 10);
  const quarterEnd = new Date(y, qStartMonth + 3, 0).toISOString().slice(0, 10);

  // Indian Fiscal Year (Apr 1 - Mar 31)
  const fyStartYear = m >= 3 ? y : y - 1;
  const fyStart = `${fyStartYear}-04-01`;
  const fyEnd = `${fyStartYear + 1}-03-31`;

  return {
    "This Month": { start: thisMonthStart, end: thisMonthEnd },
    "Last Month": { start: lastMonthStart, end: lastMonthEnd },
    "This Quarter": { start: quarterStart, end: quarterEnd },
    "This Fiscal Year": { start: fyStart, end: fyEnd },
  };
}

// ─── Component ─────────────────────────────────────────────────────────────────

export function CashFlowPanel() {
  const presets = getPresetDates();

  // State
  const [startDate, setStartDate] = useState(presets["This Month"].start);
  const [endDate, setEndDate] = useState(presets["This Month"].end);
  const [selectedBranch, setSelectedBranch] = useState<string>("");
  const [branches, setBranches] = useState<BranchOption[]>([]);
  const [displayMethod, setDisplayMethod] = useState<"both" | "direct" | "indirect">("both");

  // Comparative period
  const [showComparison, setShowComparison] = useState(false);
  const [compareStartDate, setCompareStartDate] = useState(presets["Last Month"].start);
  const [compareEndDate, setCompareEndDate] = useState(presets["Last Month"].end);

  // Data & loading
  const [data, setData] = useState<CashFlowData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load branches
  useEffect(() => {
    fetch("/api/v1/branches")
      .then((r) => r.json())
      .then((res) => {
        const list = res.branches || res.data || [];
        if (Array.isArray(list)) {
          setBranches(list.map((b: any) => ({ id: b.id, name: b.name })));
        }
      })
      .catch(() => {});
  }, []);

  // Fetch statement
  const fetchStatement = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const q = new URLSearchParams({
        start_date: startDate,
        end_date: endDate,
        method: "both",
      });
      if (selectedBranch) q.set("branch_id", selectedBranch);
      if (showComparison && compareStartDate && compareEndDate) {
        q.set("compare_start_date", compareStartDate);
        q.set("compare_end_date", compareEndDate);
      }

      const res = await fetch(`/api/v1/admin/accounting/cash-flow?${q.toString()}`);
      const json = await res.json();
      if (!res.ok || !json.success) {
        setError(json.message || json.error || "Failed to load Cash Flow Statement");
        setData(null);
      } else {
        setData(json);
      }
    } catch (err: any) {
      setError(err.message || "Network error loading Cash Flow Statement");
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [startDate, endDate, selectedBranch, showComparison, compareStartDate, compareEndDate]);

  useEffect(() => {
    fetchStatement();
  }, [fetchStatement]);

  const handlePreset = (label: string) => {
    const p = presets[label];
    if (p) {
      setStartDate(p.start);
      setEndDate(p.end);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="space-y-6 p-6 max-w-7xl mx-auto">
      {/* ── Header ───────────────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-5">
        <div>
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-gradient-to-br from-brand-navy to-slate-900 text-brand-gold shadow-md">
              <span className="text-xl">🌊</span>
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
                Cash Flow Statement
              </h1>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                Authoritative double-entry statement of cash flows (Direct & Indirect methods)
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handlePrint}
            className="inline-flex items-center gap-2 px-3 py-2 text-sm font-medium text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700 shadow-sm transition-colors"
          >
            🖨️ Print Pack
          </button>
        </div>
      </div>

      {/* ── Controls Bar ─────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 bg-slate-50 dark:bg-slate-900/50 p-4 rounded-xl border border-slate-200 dark:border-slate-800">
        {/* Method Selector */}
        <div>
          <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1">
            Presentation Mode
          </label>
          <div className="grid grid-cols-3 gap-1 bg-slate-200 dark:bg-slate-800 p-1 rounded-lg">
            <button
              onClick={() => setDisplayMethod("both")}
              className={`text-xs py-1.5 rounded-md font-medium transition-all ${
                displayMethod === "both"
                  ? "bg-white dark:bg-slate-900 text-brand-navy dark:text-brand-gold shadow-sm"
                  : "text-slate-600 dark:text-slate-400"
              }`}
            >
              Dual View
            </button>
            <button
              onClick={() => setDisplayMethod("direct")}
              className={`text-xs py-1.5 rounded-md font-medium transition-all ${
                displayMethod === "direct"
                  ? "bg-white dark:bg-slate-900 text-brand-navy dark:text-brand-gold shadow-sm"
                  : "text-slate-600 dark:text-slate-400"
              }`}
            >
              Direct
            </button>
            <button
              onClick={() => setDisplayMethod("indirect")}
              className={`text-xs py-1.5 rounded-md font-medium transition-all ${
                displayMethod === "indirect"
                  ? "bg-white dark:bg-slate-900 text-brand-navy dark:text-brand-gold shadow-sm"
                  : "text-slate-600 dark:text-slate-400"
              }`}
            >
              Indirect
            </button>
          </div>
        </div>

        {/* Date Pickers */}
        <div className="md:col-span-2 space-y-2">
          <div className="flex items-center justify-between">
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500">
              Period ({startDate} to {endDate})
            </label>
            <div className="flex gap-1">
              {Object.keys(presets).map((p) => (
                <button
                  key={p}
                  onClick={() => handlePreset(p)}
                  className="text-[11px] px-2 py-0.5 rounded bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700 hover:border-brand-primary"
                >
                  {p}
                </button>
              ))}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="text-xs px-3 py-1.5 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-800 dark:text-slate-200"
            />
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="text-xs px-3 py-1.5 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-800 dark:text-slate-200"
            />
          </div>
        </div>

        {/* Branch Selector */}
        <div>
          <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1">
            Branch Scope
          </label>
          <select
            value={selectedBranch}
            onChange={(e) => setSelectedBranch(e.target.value)}
            className="w-full text-xs px-3 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-800 dark:text-slate-200"
          >
            <option value="">All Branches (Enterprise)</option>
            {branches.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Comparative Period Sub-Bar */}
      <div className="flex items-center gap-4 px-4 py-2 bg-slate-100 dark:bg-slate-800/40 rounded-lg text-xs">
        <label className="flex items-center gap-2 cursor-pointer font-medium text-slate-700 dark:text-slate-300">
          <input
            type="checkbox"
            checked={showComparison}
            onChange={(e) => setShowComparison(e.target.checked)}
            className="rounded border-slate-300 text-brand-primary focus:ring-brand-primary"
          />
          Compare with Previous Period
        </label>
        {showComparison && (
          <div className="flex items-center gap-2">
            <span className="text-slate-500">From:</span>
            <input
              type="date"
              value={compareStartDate}
              onChange={(e) => setCompareStartDate(e.target.value)}
              className="text-xs px-2 py-1 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded"
            />
            <span className="text-slate-500">To:</span>
            <input
              type="date"
              value={compareEndDate}
              onChange={(e) => setCompareEndDate(e.target.value)}
              className="text-xs px-2 py-1 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded"
            />
          </div>
        )}
      </div>

      {/* ── Error Banner ──────────────────────────────────────────────────────── */}
      {error && (
        <div className="p-4 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 text-rose-700 dark:text-rose-300 text-sm flex items-center gap-2">
          <span>⚠️</span>
          <span>{error}</span>
        </div>
      )}

      {/* ── Loading State ────────────────────────────────────────────────────── */}
      {loading && !data && (
        <div className="p-12 text-center text-slate-400">
          <div className="animate-spin text-3xl mb-3">🌊</div>
          <p className="text-sm font-medium">Reconciling General Ledger Cash Movements...</p>
        </div>
      )}

      {data && (
        <>
          {/* ── Reconciliation Status Banner ──────────────────────────────────── */}
          <div
            className={`p-4 rounded-xl border flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 text-sm ${
              data.reconciliation.is_reconciled
                ? "bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-800/60 text-emerald-800 dark:text-emerald-300"
                : "bg-brand-gold-light dark:bg-brand-gold-dark/30 border-brand-gold/40 dark:border-brand-gold-dark/60 text-brand-gold-dark dark:text-brand-gold/40"
            }`}
          >
            <div className="flex items-center gap-3">
              <span className="text-xl">
                {data.reconciliation.is_reconciled ? "✅" : "⚠️"}
              </span>
              <div>
                <p className="font-semibold">
                  {data.reconciliation.is_reconciled
                    ? "Cash Flow Reconciled & In Balance"
                    : "Reconciliation Variance Detected"}
                </p>
                <p className="text-xs opacity-90">
                  Opening (₹{formatINR(data.reconciliation.opening_cash)}) + Movement (₹{formatINR(data.reconciliation.net_cash_movement)}) ≡ Closing (₹{formatINR(data.reconciliation.closing_cash)})
                  {" | "}Balance Sheet Line 1110: ₹{formatINR(data.reconciliation.balance_sheet_cash_match)}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 text-xs">
              <span className="px-2.5 py-1 rounded-full bg-white/80 dark:bg-slate-900/80 font-mono font-medium shadow-sm">
                Dual Method Δ: ₹{formatINR(data.reconciliation.dual_method_variance)}
              </span>
              <span className="px-2.5 py-1 rounded-full bg-white/80 dark:bg-slate-900/80 font-mono font-medium shadow-sm">
                BS Δ: ₹{formatINR(data.reconciliation.balance_sheet_variance)}
              </span>
            </div>
          </div>

          {/* ── KPI Summary Cards ────────────────────────────────────────────── */}
          <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
            {/* 1. Opening Cash */}
            <div className="p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
              <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">Opening Cash</p>
              <p className="text-lg font-bold text-slate-800 dark:text-slate-100 mt-1">
                {formatINR(data.summary.opening_cash)}
              </p>
              <p className="text-[11px] text-slate-400 mt-0.5">As-of {startDate}</p>
            </div>

            {/* 2. Operating Cash Flow (CFO) */}
            <div className="p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
              <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">Operating (CFO)</p>
              <p className={`text-lg font-bold mt-1 ${data.summary.net_operating_cash >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"}`}>
                {formatINR(data.summary.net_operating_cash)}
              </p>
              <p className="text-[11px] text-slate-400 mt-0.5">From operations</p>
            </div>

            {/* 3. Investing Cash Flow (CFI) */}
            <div className="p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
              <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">Investing (CFI)</p>
              <p className={`text-lg font-bold mt-1 ${data.summary.net_investing_cash >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-brand-primary dark:text-brand-primary"}`}>
                {formatINR(data.summary.net_investing_cash)}
              </p>
              <p className="text-[11px] text-slate-400 mt-0.5">Fixed assets capex</p>
            </div>

            {/* 4. Financing Cash Flow (CFF) */}
            <div className="p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
              <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">Financing (CFF)</p>
              <p className={`text-lg font-bold mt-1 ${data.summary.net_financing_cash >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-brand-gold dark:text-brand-gold"}`}>
                {formatINR(data.summary.net_financing_cash)}
              </p>
              <p className="text-[11px] text-slate-400 mt-0.5">Loans & equity</p>
            </div>

            {/* 5. Net Change in Cash */}
            <div className="p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
              <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">Net Change</p>
              <p className={`text-lg font-bold mt-1 ${data.summary.net_cash_change >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"}`}>
                {formatINR(data.summary.net_cash_change)}
              </p>
              <p className="text-[11px] text-slate-400 mt-0.5">CFO + CFI + CFF</p>
            </div>

            {/* 6. Closing Cash */}
            <div className="p-4 rounded-xl bg-gradient-to-br from-brand-navy to-slate-900 text-white shadow-sm border border-brand-navy">
              <p className="text-xs font-medium text-brand-gold/40 uppercase tracking-wider">Closing Cash</p>
              <p className="text-lg font-bold text-brand-gold mt-1">
                {formatINR(data.summary.closing_cash)}
              </p>
              <p className="text-[11px] text-slate-300 mt-0.5">As-of {endDate}</p>
            </div>
          </div>

          {/* ── Direct Method Schedule ────────────────────────────────────────── */}
          {(displayMethod === "both" || displayMethod === "direct") && data.direct_schedule && (
            <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
              <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/40 flex items-center justify-between">
                <div>
                  <h2 className="text-base font-bold text-slate-900 dark:text-white">
                    Direct Cash Flow Schedule
                  </h2>
                  <p className="text-xs text-slate-500">
                    Gross cash inflows and disbursements categorized by counterparty
                  </p>
                </div>
                <span className="text-xs font-mono font-medium px-2 py-0.5 rounded bg-brand-light dark:bg-brand-navy/60 text-brand-navy dark:text-brand-primary/30 border border-brand-primary/30 dark:border-brand-navy">
                  Direct CFO: {formatINR(data.direct_schedule.operating.net_amount)}
                </span>
              </div>

              <div className="p-5 space-y-6">
                {/* 1. Operating Activities */}
                <div>
                  <div className="flex items-center justify-between pb-2 border-b border-slate-200 dark:border-slate-800">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-brand-primary dark:text-brand-primary">
                      1. Cash Flows from Operating Activities
                    </h3>
                    <span className="text-xs font-bold text-slate-700 dark:text-slate-300">
                      Net: {formatINR(data.direct_schedule.operating.net_amount)}
                    </span>
                  </div>

                  <div className="mt-3 space-y-2 text-xs">
                    <p className="font-semibold text-slate-500 uppercase tracking-wider text-[11px]">Cash Inflows</p>
                    {data.direct_schedule.operating.inflows.length === 0 ? (
                      <p className="text-slate-400 italic py-1">No operating cash inflows in period</p>
                    ) : (
                      data.direct_schedule.operating.inflows.map((item) => (
                        <div key={item.key} className="flex items-center justify-between py-1 border-b border-slate-100 dark:border-slate-800/40">
                          <span className="text-slate-700 dark:text-slate-300">{item.label}</span>
                          <span className="font-mono text-emerald-600 dark:text-emerald-400 font-medium">
                            +{formatINR(item.amount)}
                          </span>
                        </div>
                      ))
                    )}

                    <p className="font-semibold text-slate-500 uppercase tracking-wider text-[11px] pt-2">Cash Outflows</p>
                    {data.direct_schedule.operating.outflows.length === 0 ? (
                      <p className="text-slate-400 italic py-1">No operating cash disbursements in period</p>
                    ) : (
                      data.direct_schedule.operating.outflows.map((item) => (
                        <div key={item.key} className="flex items-center justify-between py-1 border-b border-slate-100 dark:border-slate-800/40">
                          <span className="text-slate-700 dark:text-slate-300">{item.label}</span>
                          <span className="font-mono text-rose-600 dark:text-rose-400 font-medium">
                            -{formatINR(item.amount)}
                          </span>
                        </div>
                      ))
                    )}
                  </div>
                </div>

                {/* 2. Investing Activities */}
                <div>
                  <div className="flex items-center justify-between pb-2 border-b border-slate-200 dark:border-slate-800">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-brand-primary dark:text-brand-primary">
                      2. Cash Flows from Investing Activities
                    </h3>
                    <span className="text-xs font-bold text-slate-700 dark:text-slate-300">
                      Net: {formatINR(data.direct_schedule.investing.net_amount)}
                    </span>
                  </div>

                  <div className="mt-3 space-y-2 text-xs">
                    {data.direct_schedule.investing.inflows.length === 0 && data.direct_schedule.investing.outflows.length === 0 ? (
                      <p className="text-slate-400 italic py-1">No fixed asset or investing transactions in period</p>
                    ) : (
                      <>
                        {data.direct_schedule.investing.inflows.map((item) => (
                          <div key={item.key} className="flex items-center justify-between py-1 border-b border-slate-100 dark:border-slate-800/40">
                            <span className="text-slate-700 dark:text-slate-300">{item.label}</span>
                            <span className="font-mono text-emerald-600 dark:text-emerald-400 font-medium">+{formatINR(item.amount)}</span>
                          </div>
                        ))}
                        {data.direct_schedule.investing.outflows.map((item) => (
                          <div key={item.key} className="flex items-center justify-between py-1 border-b border-slate-100 dark:border-slate-800/40">
                            <span className="text-slate-700 dark:text-slate-300">{item.label}</span>
                            <span className="font-mono text-rose-600 dark:text-rose-400 font-medium">-{formatINR(item.amount)}</span>
                          </div>
                        ))}
                      </>
                    )}
                  </div>
                </div>

                {/* 3. Financing Activities */}
                <div>
                  <div className="flex items-center justify-between pb-2 border-b border-slate-200 dark:border-slate-800">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-brand-primary dark:text-brand-primary">
                      3. Cash Flows from Financing Activities
                    </h3>
                    <span className="text-xs font-bold text-slate-700 dark:text-slate-300">
                      Net: {formatINR(data.direct_schedule.financing.net_amount)}
                    </span>
                  </div>

                  <div className="mt-3 space-y-2 text-xs">
                    {data.direct_schedule.financing.inflows.length === 0 && data.direct_schedule.financing.outflows.length === 0 ? (
                      <p className="text-slate-400 italic py-1">No loan, capital, or drawings transactions in period</p>
                    ) : (
                      <>
                        {data.direct_schedule.financing.inflows.map((item) => (
                          <div key={item.key} className="flex items-center justify-between py-1 border-b border-slate-100 dark:border-slate-800/40">
                            <span className="text-slate-700 dark:text-slate-300">{item.label}</span>
                            <span className="font-mono text-emerald-600 dark:text-emerald-400 font-medium">+{formatINR(item.amount)}</span>
                          </div>
                        ))}
                        {data.direct_schedule.financing.outflows.map((item) => (
                          <div key={item.key} className="flex items-center justify-between py-1 border-b border-slate-100 dark:border-slate-800/40">
                            <span className="text-slate-700 dark:text-slate-300">{item.label}</span>
                            <span className="font-mono text-rose-600 dark:text-rose-400 font-medium">-{formatINR(item.amount)}</span>
                          </div>
                        ))}
                      </>
                    )}
                  </div>
                </div>

                {/* 4. Internal Transfers Summary */}
                <div className="pt-3 border-t border-slate-200 dark:border-slate-800">
                  <div className="flex items-center justify-between text-xs text-slate-500">
                    <span className="flex items-center gap-1.5">
                      <span>🔄</span>
                      <span>{data.direct_schedule.internal_transfers.label}:</span>
                      <span className="italic">{data.direct_schedule.internal_transfers.description}</span>
                    </span>
                    <span className="font-mono">
                      Volume: {formatINR(data.direct_schedule.internal_transfers.total_volume)} | Net: ₹0.00
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ── Indirect Method Schedule ──────────────────────────────────────── */}
          {(displayMethod === "both" || displayMethod === "indirect") && data.indirect_schedule && (
            <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
              <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/40 flex items-center justify-between">
                <div>
                  <h2 className="text-base font-bold text-slate-900 dark:text-white">
                    Indirect Method Reconciliation
                  </h2>
                  <p className="text-xs text-slate-500">
                    Reconciliation of Net Profit Before Tax to Net Cash Flow from Operating Activities
                  </p>
                </div>
                <span className="text-xs font-mono font-medium px-2 py-0.5 rounded bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                  Indirect CFO: {formatINR(data.indirect_schedule.net_operating_cash_flow)}
                </span>
              </div>

              <div className="p-5 space-y-4 text-xs">
                {/* 1. Net Profit Starting Point */}
                <div className="flex items-center justify-between py-2 border-b border-slate-200 dark:border-slate-800 font-semibold">
                  <span className="text-slate-800 dark:text-slate-200">
                    Net Profit Before Tax (from Profit & Loss Statement)
                  </span>
                  <span className="font-mono text-sm">
                    {formatINR(data.indirect_schedule.net_profit_before_tax)}
                  </span>
                </div>

                {/* 2. Non-Cash Adjustments */}
                <div className="pl-4 space-y-2 border-l-2 border-brand-primary/30 dark:border-brand-navy">
                  <p className="font-semibold text-slate-500 uppercase tracking-wider text-[11px]">
                    Non-Cash & Financing Adjustments
                  </p>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-700 dark:text-slate-300">
                      Add: Depreciation & Amortization (5330)
                    </span>
                    <span className="font-mono text-emerald-600 dark:text-emerald-400">
                      +{formatINR(data.indirect_schedule.non_cash_adjustments.depreciation)}
                    </span>
                  </div>
                  {data.indirect_schedule.non_cash_adjustments.finance_interest !== 0 && (
                    <div className="flex items-center justify-between">
                      <span className="text-slate-700 dark:text-slate-300">
                        Add: Financing Loan Interest (5320, classified in CFF)
                      </span>
                      <span className="font-mono text-emerald-600 dark:text-emerald-400">
                        +{formatINR(data.indirect_schedule.non_cash_adjustments.finance_interest)}
                      </span>
                    </div>
                  )}
                  <div className="flex items-center justify-between pt-1 font-semibold text-slate-800 dark:text-slate-200 border-t border-slate-100 dark:border-slate-800">
                    <span>Operating Profit Before Working Capital Changes</span>
                    <span className="font-mono">
                      {formatINR(data.indirect_schedule.operating_profit_before_wc)}
                    </span>
                  </div>
                </div>

                {/* 3. Working Capital Adjustments Schedule */}
                <div className="pt-2">
                  <p className="font-semibold text-slate-500 uppercase tracking-wider text-[11px] mb-2">
                    Working Capital Changes (Balance Sheet Deltas)
                  </p>
                  {data.indirect_schedule.working_capital_adjustments.items.length === 0 ? (
                    <p className="text-slate-400 italic py-1">No working capital account movements in period</p>
                  ) : (
                    <div className="space-y-1.5">
                      {data.indirect_schedule.working_capital_adjustments.items.map((item) => (
                        <div
                          key={item.account_code}
                          className="flex items-center justify-between py-1 px-2 rounded hover:bg-slate-50 dark:hover:bg-slate-800/40"
                        >
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-slate-400 text-[11px]">{item.account_code}</span>
                            <span className="text-slate-700 dark:text-slate-300">{item.account_name}</span>
                            <span className="text-[10px] px-1.5 py-0.2 rounded bg-slate-100 dark:bg-slate-800 text-slate-500">
                              {item.category === "CURRENT_ASSET" ? "Asset Δ" : "Liability Δ"}
                            </span>
                          </div>
                          <span
                            className={`font-mono font-medium ${
                              item.cash_impact >= 0
                                ? "text-emerald-600 dark:text-emerald-400"
                                : "text-rose-600 dark:text-rose-400"
                            }`}
                          >
                            {item.cash_impact >= 0 ? "+" : ""}
                            {formatINR(item.cash_impact)}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}

                  <div className="flex items-center justify-between pt-3 mt-2 border-t border-slate-200 dark:border-slate-800 font-bold text-slate-900 dark:text-white">
                    <span>Net Cash Flow from Operating Activities (Indirect Method)</span>
                    <span className="font-mono text-sm text-emerald-600 dark:text-emerald-400">
                      {formatINR(data.indirect_schedule.net_operating_cash_flow)}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ── Comparative Period Analysis ─────────────────────────────────── */}
          {data.comparison && (
            <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-5 shadow-sm">
              <h3 className="text-sm font-bold text-slate-900 dark:text-white mb-3">
                Comparative Period Summary ({data.period.start_date} vs {data.comparison.period.start_date})
              </h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-xs">
                <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-800/50">
                  <p className="text-slate-500 font-medium">Operating Cash Flow</p>
                  <p className="font-bold text-sm mt-1">{formatINR(data.summary.net_operating_cash)}</p>
                  <p className="text-[11px] text-slate-400">
                    Prior: {formatINR(data.comparison.summary.net_operating_cash)}
                  </p>
                  {(() => {
                    const delta = formatDelta(
                      data.summary.net_operating_cash,
                      data.comparison.summary.net_operating_cash
                    );
                    return (
                      <span className={`text-[10px] font-medium ${delta.isPositive ? "text-emerald-600" : "text-rose-600"}`}>
                        {delta.text} ({delta.pctText})
                      </span>
                    );
                  })()}
                </div>

                <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-800/50">
                  <p className="text-slate-500 font-medium">Investing Cash Flow</p>
                  <p className="font-bold text-sm mt-1">{formatINR(data.summary.net_investing_cash)}</p>
                  <p className="text-[11px] text-slate-400">
                    Prior: {formatINR(data.comparison.summary.net_investing_cash)}
                  </p>
                  {(() => {
                    const delta = formatDelta(
                      data.summary.net_investing_cash,
                      data.comparison.summary.net_investing_cash
                    );
                    return (
                      <span className={`text-[10px] font-medium ${delta.isPositive ? "text-emerald-600" : "text-rose-600"}`}>
                        {delta.text} ({delta.pctText})
                      </span>
                    );
                  })()}
                </div>

                <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-800/50">
                  <p className="text-slate-500 font-medium">Financing Cash Flow</p>
                  <p className="font-bold text-sm mt-1">{formatINR(data.summary.net_financing_cash)}</p>
                  <p className="text-[11px] text-slate-400">
                    Prior: {formatINR(data.comparison.summary.net_financing_cash)}
                  </p>
                  {(() => {
                    const delta = formatDelta(
                      data.summary.net_financing_cash,
                      data.comparison.summary.net_financing_cash
                    );
                    return (
                      <span className={`text-[10px] font-medium ${delta.isPositive ? "text-emerald-600" : "text-rose-600"}`}>
                        {delta.text} ({delta.pctText})
                      </span>
                    );
                  })()}
                </div>

                <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-800/50">
                  <p className="text-slate-500 font-medium">Closing Cash Balance</p>
                  <p className="font-bold text-sm mt-1 text-brand-gold">{formatINR(data.summary.closing_cash)}</p>
                  <p className="text-[11px] text-slate-400">
                    Prior: {formatINR(data.comparison.summary.closing_cash)}
                  </p>
                  {(() => {
                    const delta = formatDelta(
                      data.summary.closing_cash,
                      data.comparison.summary.closing_cash
                    );
                    return (
                      <span className={`text-[10px] font-medium ${delta.isPositive ? "text-emerald-600" : "text-rose-600"}`}>
                        {delta.text} ({delta.pctText})
                      </span>
                    );
                  })()}
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
