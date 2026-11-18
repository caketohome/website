"use client";

/**
 * CakeToHome ERP — General Ledger Panel
 * Phase 5A Step 1: Account-wise Ledger and Trial Balance UI.
 *
 * Two sub-views toggled by internal tabs:
 *   View A — Account Ledger: Per-account chronological register with running balance.
 *   View B — Trial Balance: All accounts with debit/credit totals and balance check.
 *
 * READ-ONLY: This panel performs zero mutations.
 * Data source: GET /api/v1/admin/accounting/ledger, /trial-balance, /accounts
 */

import { useState, useEffect, useCallback, useRef } from "react";

// ─── Types (mirrored from accounting.types.ts for client-side) ────────────────

interface AccountOption {
  id: string;
  code: string;
  name: string;
  type: string;
  subtype: string;
  is_group: boolean;
}

interface AccountLedgerLine {
  line_id: string;
  entry_date: string;
  entry_no: string;
  voucher_id: string;
  voucher_no: string;
  voucher_type: string;
  narration: string | null;
  debit_amount: number;
  credit_amount: number;
  running_balance: number;
  branch_id: string;
  customer_id: string | null;
  supplier_id: string | null;
}

interface AccountLedgerResult {
  account: {
    id: string;
    code: string;
    name: string;
    type: string;
    subtype: string;
    normal_balance: "DEBIT" | "CREDIT";
  };
  opening_balance: number;
  closing_balance: number;
  total_debit: number;
  total_credit: number;
  lines: AccountLedgerLine[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

interface TrialBalanceRow {
  account_id: string;
  code: string;
  name: string;
  type: string;
  subtype: string;
  level: number;
  is_group: boolean;
  total_debit: number;
  total_credit: number;
  net_balance: number;
}

interface TrialBalanceSummary {
  total_debit: number;
  total_credit: number;
  is_balanced: boolean;
  imbalance: number;
}

interface TrialBalanceResult {
  rows: TrialBalanceRow[];
  summary: TrialBalanceSummary;
  filters: {
    branch_id: string | null;
    startDate: string | null;
    endDate: string | null;
  };
}

// ─── Utility ──────────────────────────────────────────────────────────────────

const API_BASE = "/api/v1";

function formatCurrency(val: number): string {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(val);
}

function formatDate(dateStr: string): string {
  if (!dateStr) return "—";
  try {
    const d = new Date(dateStr);
    return d.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
  } catch {
    return dateStr;
  }
}

function getDefaultDateRange(): { startDate: string; endDate: string } {
  const now = new Date();
  const end = now.toISOString().split("T")[0];
  const start = new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString().split("T")[0];
  return { startDate: start, endDate: end };
}

const VOUCHER_TYPE_LABELS: Record<string, string> = {
  SALES: "Sales",
  PURCHASE: "Purchase",
  PAYMENT: "Payment",
  RECEIPT: "Receipt",
  EXPENSE: "Expense",
  JOURNAL: "Journal",
  CONTRA: "Contra",
  CREDIT_NOTE: "Credit Note",
  DEBIT_NOTE: "Debit Note",
  OPENING_BALANCE: "Opening Bal",
};

const ACCOUNT_TYPE_COLORS: Record<string, string> = {
  ASSET: "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300",
  LIABILITY: "bg-brand-gold-light text-brand-gold-dark dark:bg-brand-gold-dark/40 dark:text-brand-gold",
  EQUITY: "bg-brand-light text-brand-navy dark:bg-brand-navy/40 dark:text-brand-primary",
  REVENUE: "bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300",
  EXPENSE: "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300",
};

// ─── Main Component ───────────────────────────────────────────────────────────

type SubView = "ledger" | "trial-balance";

export default function GeneralLedgerPanel() {
  const [activeView, setActiveView] = useState<SubView>("ledger");

  return (
    <div className="w-full space-y-4">
      {/* Sub-view toggle */}
      <div className="flex items-center gap-2 border-b border-slate-200 dark:border-slate-700 pb-3">
        <button
          onClick={() => setActiveView("ledger")}
          className={`px-4 py-2 text-sm font-semibold rounded-t-lg transition-all ${
            activeView === "ledger"
              ? "bg-brand-navy text-white border-b-2 border-brand-gold"
              : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
          }`}
        >
          📒 Account Ledger
        </button>
        <button
          onClick={() => setActiveView("trial-balance")}
          className={`px-4 py-2 text-sm font-semibold rounded-t-lg transition-all ${
            activeView === "trial-balance"
              ? "bg-brand-navy text-white border-b-2 border-brand-gold"
              : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
          }`}
        >
          ⚖️ Trial Balance
        </button>
      </div>

      {activeView === "ledger" ? <AccountLedgerView /> : <TrialBalanceView />}
    </div>
  );
}

// ─── Account Ledger View ──────────────────────────────────────────────────────

function AccountLedgerView() {
  const defaults = getDefaultDateRange();
  const [accounts, setAccounts] = useState<AccountOption[]>([]);
  const [selectedAccountId, setSelectedAccountId] = useState("");
  const [startDate, setStartDate] = useState(defaults.startDate);
  const [endDate, setEndDate] = useState(defaults.endDate);
  const [page, setPage] = useState(1);
  const [ledgerData, setLedgerData] = useState<AccountLedgerResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadingAccounts, setLoadingAccounts] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [accountSearch, setAccountSearch] = useState("");
  const [showDropdown, setShowDropdown] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Load accounts on mount
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`${API_BASE}/admin/accounting/accounts?include_groups=false`, { credentials: "include" });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        setAccounts(data.accounts || []);
      } catch (err: any) {
        console.error("[GL Panel] Failed to load accounts:", err);
      } finally {
        setLoadingAccounts(false);
      }
    })();
  }, []);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const fetchLedger = useCallback(async (pg: number = 1) => {
    if (!selectedAccountId) return;
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({
        account_id: selectedAccountId,
        page: String(pg),
        limit: "50",
      });
      if (startDate) params.set("startDate", startDate);
      if (endDate) params.set("endDate", endDate);

      const res = await fetch(`${API_BASE}/admin/accounting/ledger?${params}`, { credentials: "include" });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.message || `HTTP ${res.status}`);
      }
      const data = await res.json();
      if (!data.success) throw new Error(data.message || "Failed to load ledger.");
      setLedgerData(data);
      setPage(pg);
    } catch (err: any) {
      setError(err.message);
      setLedgerData(null);
    } finally {
      setLoading(false);
    }
  }, [selectedAccountId, startDate, endDate]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    fetchLedger(1);
  };

  const filteredAccounts = accounts.filter(
    (a) =>
      a.code.toLowerCase().includes(accountSearch.toLowerCase()) ||
      a.name.toLowerCase().includes(accountSearch.toLowerCase())
  );

  const selectedAccount = accounts.find((a) => a.id === selectedAccountId);

  return (
    <div className="space-y-4">
      {/* Filters */}
      <form onSubmit={handleSubmit} className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl p-4 space-y-3">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3 items-end">
          {/* Account Selector */}
          <div className="md:col-span-2 relative" ref={dropdownRef}>
            <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">Account</label>
            <input
              type="text"
              placeholder={loadingAccounts ? "Loading accounts..." : "Search account code or name..."}
              value={selectedAccount ? `${selectedAccount.code} — ${selectedAccount.name}` : accountSearch}
              onChange={(e) => {
                setAccountSearch(e.target.value);
                setSelectedAccountId("");
                setShowDropdown(true);
              }}
              onFocus={() => setShowDropdown(true)}
              className="w-full px-3 py-2 text-sm border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-brand-navy"
              disabled={loadingAccounts}
            />
            {showDropdown && filteredAccounts.length > 0 && (
              <div className="absolute z-50 w-full mt-1 max-h-60 overflow-y-auto bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-lg shadow-lg">
                {filteredAccounts.slice(0, 50).map((acc) => (
                  <button
                    key={acc.id}
                    type="button"
                    onClick={() => {
                      setSelectedAccountId(acc.id);
                      setAccountSearch("");
                      setShowDropdown(false);
                    }}
                    className="w-full text-left px-3 py-2 text-sm hover:bg-slate-100 dark:hover:bg-slate-700 flex items-center gap-2"
                  >
                    <span className="font-mono text-xs text-slate-500 dark:text-slate-400 w-12 shrink-0">{acc.code}</span>
                    <span className="text-slate-900 dark:text-white truncate">{acc.name}</span>
                    <span className={`ml-auto text-[10px] font-bold px-1.5 py-0.5 rounded ${ACCOUNT_TYPE_COLORS[acc.type] || "bg-slate-100 text-slate-600"}`}>
                      {acc.type}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Date Range */}
          <div>
            <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">From</label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-brand-navy"
            />
          </div>
          <div>
            <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">To</label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-brand-navy"
            />
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="submit"
            disabled={!selectedAccountId || loading}
            className="px-5 py-2 text-sm font-bold rounded-lg bg-brand-navy text-white hover:bg-[#162547] disabled:opacity-50 disabled:cursor-not-allowed transition-all"
          >
            {loading ? "Loading..." : "View Ledger"}
          </button>
          {ledgerData && (
            <button
              type="button"
              onClick={() => window.print()}
              className="px-4 py-2 text-sm font-semibold rounded-lg border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-all"
            >
              🖨️ Print
            </button>
          )}
        </div>
      </form>

      {/* Error */}
      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-3 text-sm text-red-700 dark:text-red-300">
          ⚠️ {error}
        </div>
      )}

      {/* Empty prompt */}
      {!ledgerData && !loading && !error && (
        <div className="bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-xl p-8 text-center">
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Select an account and date range, then click <strong>View Ledger</strong> to load the account transaction register.
          </p>
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin w-8 h-8 border-4 border-brand-navy border-t-transparent rounded-full" />
        </div>
      )}

      {/* Ledger Data */}
      {ledgerData && !loading && (
        <div className="space-y-3 print:space-y-2">
          {/* Account Header */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl p-4">
            <div className="flex flex-wrap items-center gap-3">
              <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                {ledgerData.account.code} — {ledgerData.account.name}
              </h3>
              <span className={`text-xs font-bold px-2 py-1 rounded ${ACCOUNT_TYPE_COLORS[ledgerData.account.type] || "bg-slate-100 text-slate-600"}`}>
                {ledgerData.account.type}
              </span>
              <span className="text-xs text-slate-500 dark:text-slate-400">
                Normal Balance: <strong>{ledgerData.account.normal_balance}</strong>
              </span>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-3">
              <div className="bg-slate-50 dark:bg-slate-800 rounded-lg p-3">
                <div className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase">Opening Balance</div>
                <div className="text-base font-bold text-slate-900 dark:text-white">{formatCurrency(ledgerData.opening_balance)}</div>
              </div>
              <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-3">
                <div className="text-[10px] font-bold text-blue-600 dark:text-blue-400 uppercase">Total Debit</div>
                <div className="text-base font-bold text-blue-700 dark:text-blue-300">{formatCurrency(ledgerData.total_debit)}</div>
              </div>
              <div className="bg-brand-gold-light dark:bg-brand-gold-dark/20 rounded-lg p-3">
                <div className="text-[10px] font-bold text-brand-gold dark:text-brand-gold uppercase">Total Credit</div>
                <div className="text-base font-bold text-brand-gold-dark dark:text-brand-gold">{formatCurrency(ledgerData.total_credit)}</div>
              </div>
              <div className="bg-emerald-50 dark:bg-emerald-900/20 rounded-lg p-3">
                <div className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 uppercase">Closing Balance</div>
                <div className="text-base font-bold text-emerald-700 dark:text-emerald-300">{formatCurrency(ledgerData.closing_balance)}</div>
              </div>
            </div>
          </div>

          {/* Ledger Table */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-slate-50 dark:bg-slate-800 text-left">
                    <th className="px-3 py-2.5 text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase">Date</th>
                    <th className="px-3 py-2.5 text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase">Voucher</th>
                    <th className="px-3 py-2.5 text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase">Type</th>
                    <th className="px-3 py-2.5 text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase">Narration</th>
                    <th className="px-3 py-2.5 text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase text-right">Debit</th>
                    <th className="px-3 py-2.5 text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase text-right">Credit</th>
                    <th className="px-3 py-2.5 text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase text-right">Balance</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {/* Opening Balance Row */}
                  <tr className="bg-slate-50/50 dark:bg-slate-800/30">
                    <td className="px-3 py-2 text-xs text-slate-500" colSpan={4}>
                      <em>Opening Balance (b/f)</em>
                    </td>
                    <td className="px-3 py-2 text-xs text-right text-slate-500">—</td>
                    <td className="px-3 py-2 text-xs text-right text-slate-500">—</td>
                    <td className="px-3 py-2 text-xs text-right font-bold text-slate-700 dark:text-slate-300">
                      {formatCurrency(ledgerData.opening_balance)}
                    </td>
                  </tr>

                  {ledgerData.lines.length === 0 && (
                    <tr>
                      <td colSpan={7} className="px-3 py-8 text-center text-sm text-slate-400">
                        No journal entries found for this account in the selected period.
                      </td>
                    </tr>
                  )}

                  {ledgerData.lines.map((line) => (
                    <tr key={line.line_id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                      <td className="px-3 py-2 text-xs text-slate-600 dark:text-slate-400 whitespace-nowrap">
                        {formatDate(line.entry_date)}
                      </td>
                      <td className="px-3 py-2 text-xs font-mono text-slate-600 dark:text-slate-400 whitespace-nowrap" title={line.voucher_id}>
                        {line.voucher_no?.substring(0, 28) || "—"}
                      </td>
                      <td className="px-3 py-2">
                        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
                          {VOUCHER_TYPE_LABELS[line.voucher_type] || line.voucher_type}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-xs text-slate-600 dark:text-slate-400 max-w-[200px] truncate" title={line.narration || ""}>
                        {line.narration || "—"}
                      </td>
                      <td className="px-3 py-2 text-xs text-right font-mono tabular-nums">
                        {line.debit_amount > 0 ? (
                          <span className="text-blue-700 dark:text-blue-400">{formatCurrency(line.debit_amount)}</span>
                        ) : (
                          <span className="text-slate-300 dark:text-slate-600">—</span>
                        )}
                      </td>
                      <td className="px-3 py-2 text-xs text-right font-mono tabular-nums">
                        {line.credit_amount > 0 ? (
                          <span className="text-brand-gold-dark dark:text-brand-gold">{formatCurrency(line.credit_amount)}</span>
                        ) : (
                          <span className="text-slate-300 dark:text-slate-600">—</span>
                        )}
                      </td>
                      <td className="px-3 py-2 text-xs text-right font-mono font-bold tabular-nums text-slate-900 dark:text-white">
                        {formatCurrency(line.running_balance)}
                      </td>
                    </tr>
                  ))}

                  {/* Closing Balance Row */}
                  <tr className="bg-slate-50 dark:bg-slate-800 font-bold">
                    <td className="px-3 py-2.5 text-xs text-slate-700 dark:text-slate-300" colSpan={4}>
                      Closing Balance (c/f)
                    </td>
                    <td className="px-3 py-2.5 text-xs text-right font-mono text-blue-700 dark:text-blue-400">
                      {formatCurrency(ledgerData.total_debit)}
                    </td>
                    <td className="px-3 py-2.5 text-xs text-right font-mono text-brand-gold-dark dark:text-brand-gold">
                      {formatCurrency(ledgerData.total_credit)}
                    </td>
                    <td className="px-3 py-2.5 text-xs text-right font-mono text-emerald-700 dark:text-emerald-400">
                      {formatCurrency(ledgerData.closing_balance)}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* Pagination */}
          {ledgerData.totalPages > 1 && (
            <div className="flex items-center justify-between px-1">
              <span className="text-xs text-slate-500 dark:text-slate-400">
                Page {ledgerData.page} of {ledgerData.totalPages} ({ledgerData.total} entries)
              </span>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => fetchLedger(page - 1)}
                  disabled={page <= 1}
                  className="px-3 py-1.5 text-xs font-semibold rounded border border-slate-300 dark:border-slate-600 disabled:opacity-40 hover:bg-slate-50 dark:hover:bg-slate-800 transition-all"
                >
                  ← Prev
                </button>
                <button
                  onClick={() => fetchLedger(page + 1)}
                  disabled={page >= ledgerData.totalPages}
                  className="px-3 py-1.5 text-xs font-semibold rounded border border-slate-300 dark:border-slate-600 disabled:opacity-40 hover:bg-slate-50 dark:hover:bg-slate-800 transition-all"
                >
                  Next →
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Trial Balance View ───────────────────────────────────────────────────────

function TrialBalanceView() {
  const defaults = getDefaultDateRange();
  const [startDate, setStartDate] = useState(defaults.startDate);
  const [endDate, setEndDate] = useState(defaults.endDate);
  const [tbData, setTbData] = useState<TrialBalanceResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchTrialBalance = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (startDate) params.set("startDate", startDate);
      if (endDate) params.set("endDate", endDate);

      const res = await fetch(`${API_BASE}/admin/accounting/trial-balance?${params}`, { credentials: "include" });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.message || `HTTP ${res.status}`);
      }
      const data = await res.json();
      if (!data.success) throw new Error(data.message || "Failed to load trial balance.");
      setTbData(data);
    } catch (err: any) {
      setError(err.message);
      setTbData(null);
    } finally {
      setLoading(false);
    }
  }, [startDate, endDate]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    fetchTrialBalance();
  };

  // Group rows by account type for hierarchical display
  const groupedRows: { type: string; rows: TrialBalanceRow[] }[] = [];
  if (tbData) {
    const typeOrder = ["ASSET", "LIABILITY", "EQUITY", "REVENUE", "EXPENSE"];
    const grouped: Record<string, TrialBalanceRow[]> = {};
    for (const row of tbData.rows) {
      const t = row.type || "OTHER";
      if (!grouped[t]) grouped[t] = [];
      grouped[t].push(row);
    }
    for (const t of typeOrder) {
      if (grouped[t]?.length) {
        groupedRows.push({ type: t, rows: grouped[t] });
      }
    }
    // Any remaining types not in typeOrder
    for (const t of Object.keys(grouped)) {
      if (!typeOrder.includes(t) && grouped[t]?.length) {
        groupedRows.push({ type: t, rows: grouped[t] });
      }
    }
  }

  return (
    <div className="space-y-4">
      {/* Filters */}
      <form onSubmit={handleSubmit} className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl p-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 items-end">
          <div>
            <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">From</label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-brand-navy"
            />
          </div>
          <div>
            <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">To</label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-brand-navy"
            />
          </div>
          <div className="flex items-center gap-2">
            <button
              type="submit"
              disabled={loading}
              className="px-5 py-2 text-sm font-bold rounded-lg bg-brand-navy text-white hover:bg-[#162547] disabled:opacity-50 disabled:cursor-not-allowed transition-all"
            >
              {loading ? "Loading..." : "Generate Trial Balance"}
            </button>
            {tbData && (
              <button
                type="button"
                onClick={() => window.print()}
                className="px-4 py-2 text-sm font-semibold rounded-lg border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-all"
              >
                🖨️ Print
              </button>
            )}
          </div>
        </div>
      </form>

      {/* Error */}
      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-3 text-sm text-red-700 dark:text-red-300">
          ⚠️ {error}
        </div>
      )}

      {/* Empty */}
      {!tbData && !loading && !error && (
        <div className="bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-xl p-8 text-center">
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Select a date range and click <strong>Generate Trial Balance</strong> to compute the trial balance.
          </p>
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin w-8 h-8 border-4 border-brand-navy border-t-transparent rounded-full" />
        </div>
      )}

      {/* Trial Balance Data */}
      {tbData && !loading && (
        <div className="space-y-3 print:space-y-2">
          {/* Summary */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl p-4">
            <div className="flex flex-wrap items-center gap-4">
              <h3 className="text-lg font-bold text-slate-900 dark:text-white">Trial Balance</h3>
              <div className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-bold ${
                tbData.summary.is_balanced
                  ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300"
                  : "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300"
              }`}>
                {tbData.summary.is_balanced ? "✅ Balanced" : `⚠️ Imbalanced (${formatCurrency(tbData.summary.imbalance)})`}
              </div>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mt-3">
              <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-3">
                <div className="text-[10px] font-bold text-blue-600 dark:text-blue-400 uppercase">Total Debits</div>
                <div className="text-lg font-bold text-blue-700 dark:text-blue-300">{formatCurrency(tbData.summary.total_debit)}</div>
              </div>
              <div className="bg-brand-gold-light dark:bg-brand-gold-dark/20 rounded-lg p-3">
                <div className="text-[10px] font-bold text-brand-gold dark:text-brand-gold uppercase">Total Credits</div>
                <div className="text-lg font-bold text-brand-gold-dark dark:text-brand-gold">{formatCurrency(tbData.summary.total_credit)}</div>
              </div>
              <div className="bg-slate-50 dark:bg-slate-800 rounded-lg p-3">
                <div className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase">Accounts</div>
                <div className="text-lg font-bold text-slate-900 dark:text-white">{tbData.rows.length}</div>
              </div>
            </div>
          </div>

          {/* TB Table */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-slate-50 dark:bg-slate-800 text-left">
                    <th className="px-3 py-2.5 text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase">Code</th>
                    <th className="px-3 py-2.5 text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase">Account Name</th>
                    <th className="px-3 py-2.5 text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase">Type</th>
                    <th className="px-3 py-2.5 text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase text-right">Debit</th>
                    <th className="px-3 py-2.5 text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase text-right">Credit</th>
                    <th className="px-3 py-2.5 text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase text-right">Net Balance</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {groupedRows.map((group) => (
                    <>
                      {/* Group Header */}
                      <tr key={`hdr-${group.type}`} className="bg-slate-100/50 dark:bg-slate-800/50">
                        <td colSpan={6} className="px-3 py-2">
                          <span className={`text-xs font-bold px-2 py-0.5 rounded ${ACCOUNT_TYPE_COLORS[group.type] || "bg-slate-200 text-slate-700"}`}>
                            {group.type}
                          </span>
                        </td>
                      </tr>
                      {group.rows.map((row) => {
                        const hasActivity = row.total_debit > 0 || row.total_credit > 0;
                        if (!hasActivity && !row.is_group) return null;
                        return (
                          <tr
                            key={row.account_id}
                            className={`hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors ${
                              row.is_group ? "bg-slate-50/30 dark:bg-slate-800/20" : ""
                            }`}
                          >
                            <td className="px-3 py-2 text-xs font-mono text-slate-500 dark:text-slate-400">
                              {row.code}
                            </td>
                            <td className="px-3 py-2 text-xs text-slate-800 dark:text-slate-200" style={{ paddingLeft: `${(row.level || 0) * 12 + 12}px` }}>
                              {row.is_group ? <strong>{row.name}</strong> : row.name}
                            </td>
                            <td className="px-3 py-2">
                              <span className="text-[10px] text-slate-400">{row.subtype?.replace(/_/g, " ") || "—"}</span>
                            </td>
                            <td className="px-3 py-2 text-xs text-right font-mono tabular-nums">
                              {row.total_debit > 0 ? (
                                <span className="text-blue-700 dark:text-blue-400">{formatCurrency(row.total_debit)}</span>
                              ) : (
                                <span className="text-slate-300 dark:text-slate-600">—</span>
                              )}
                            </td>
                            <td className="px-3 py-2 text-xs text-right font-mono tabular-nums">
                              {row.total_credit > 0 ? (
                                <span className="text-brand-gold-dark dark:text-brand-gold">{formatCurrency(row.total_credit)}</span>
                              ) : (
                                <span className="text-slate-300 dark:text-slate-600">—</span>
                              )}
                            </td>
                            <td className="px-3 py-2 text-xs text-right font-mono font-bold tabular-nums text-slate-900 dark:text-white">
                              {row.net_balance !== 0 ? formatCurrency(row.net_balance) : "—"}
                            </td>
                          </tr>
                        );
                      })}
                    </>
                  ))}

                  {/* Totals Row */}
                  <tr className="bg-brand-navy text-white font-bold">
                    <td className="px-3 py-3 text-xs" colSpan={3}>
                      TOTAL
                    </td>
                    <td className="px-3 py-3 text-xs text-right font-mono tabular-nums">
                      {formatCurrency(tbData.summary.total_debit)}
                    </td>
                    <td className="px-3 py-3 text-xs text-right font-mono tabular-nums">
                      {formatCurrency(tbData.summary.total_credit)}
                    </td>
                    <td className="px-3 py-3 text-xs text-right font-mono tabular-nums">
                      {tbData.summary.is_balanced ? "✅ Balanced" : formatCurrency(tbData.summary.imbalance)}
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
