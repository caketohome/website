"use client";

/**
 * CakeToHome ERP — Bank Reconciliation Statement (BRS) Panel
 * Phase 4F Step 4.10 Substep 4.10.5-E: BRS UI Workspace
 *
 * ARCHITECTURAL DESIGN & INVARIANTS:
 * 1. SERVER-SIDE FINANCIAL AUTHORITATIVE TRUTH:
 *    - All mathematical balances, GL aggregation, and discrepancy vectors are computed
 *      server-side by BankReconciliationStatementService in PostgreSQL.
 *    - The UI is strictly read-only and visualizes the authoritative calculation bridge.
 * 2. BRANCH ISOLATION & MULTI-TENANT ACCESS:
 *    - Bank accounts and sessions are strictly scoped according to server-validated RBAC.
 *    - Branch managers see only accounts belonging to their authorized branch.
 *    - Super Admins / Headquarters staff have enterprise-wide account visibility.
 * 3. STRICT ZERO MUTATION GUARANTEE:
 *    - This panel executes only read-only GET queries against the D-B REST APIs.
 *    - Zero accounting vouchers, journal entries, or reconciliation matches are created here.
 */

import React, { useState, useEffect, useCallback, useMemo } from "react";
import {
  Landmark,
  Receipt,
  FileCheck2,
  AlertTriangle,
  RefreshCw,
  Search,
  Filter,
  CheckCircle2,
  XCircle,
  Clock,
  ArrowRight,
  ShieldAlert,
  Building,
  DollarSign,
  ChevronRight,
  ChevronLeft,
  X,
  FileText,
  Lock,
  Layers,
  Calendar,
  ArrowDownLeft,
  ArrowUpRight,
  Check,
  Info,
} from "lucide-react";

// ── Types ──────────────────────────────────────────────────────────────────────

export interface BankAccount {
  id: string;
  bank_name: string;
  account_number_masked?: string;
  account_number?: string;
  account_type?: string;
  ifsc_code?: string;
  branch_id?: string | null;
  gl_account_id?: string;
  status: string;
  currency?: string;
}

export interface BrsCalculationResult {
  bank_account_id: string;
  bank_name?: string;
  as_of_date: string;
  gl_account_id?: string;
  gl_account_code?: string;
  gl_closing_balance: number; // in paise
  unmatched_statement_credits: number; // in paise
  unmatched_statement_debits: number; // in paise
  adjusted_book_balance: number; // in paise
  uncleared_deposits: number; // in paise
  outstanding_disbursements: number; // in paise
  computed_bank_balance: number; // in paise
  statement_closing_balance: number; // in paise
  discrepancy: number; // in paise
  status?: string;
  unmatched_credit_count?: number;
  unmatched_debit_count?: number;
  uncleared_deposit_count?: number;
  outstanding_disbursement_count?: number;
}

export interface UnclearedDepositItem {
  id: string;
  slip_number: string;
  slip_date: string;
  bank_account_id: string;
  branch_id?: string;
  amount: number; // paise
  status: string;
  cashier_name?: string;
  notes?: string;
}

export interface OutstandingDisbursementItem {
  id: string;
  voucher_no: string;
  voucher_date: string;
  payee_name?: string;
  reference_no?: string;
  branch_id?: string;
  amount: number; // paise
  status: string;
  narration?: string;
}

export interface UnmatchedStatementLineItem {
  id: string;
  import_id: string;
  line_number: number;
  transaction_date: string;
  value_date?: string;
  line_type: "DEBIT" | "CREDIT";
  amount: number; // paise
  narration?: string;
  reference_number?: string;
  match_status: string;
}

export interface ReconciliationSession {
  id: string;
  bank_account_id: string;
  period_start: string;
  period_end: string;
  opening_balance: number; // paise
  closing_balance: number; // paise
  status: "DRAFT" | "IN_PROGRESS" | "COMPLETED" | "ABANDONED";
  created_at: string;
  completed_at?: string;
  created_by?: string;
  completed_by?: string;
  notes?: string;
}

// ── Currency Formatter ─────────────────────────────────────────────────────────

function formatPaiseToInr(paise: number | undefined | null): string {
  if (paise === undefined || paise === null || isNaN(paise)) return "₹0.00";
  const rupees = paise / 100;
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(rupees);
}

// ── Main Component ─────────────────────────────────────────────────────────────

export default function BankReconciliationPanel() {
  // ── Context States ───────────────────────────────────────────────────────────
  const [bankAccounts, setBankAccounts] = useState<BankAccount[]>([]);
  const [selectedAccountId, setSelectedAccountId] = useState<string>("");
  const [asOfDate, setAsOfDate] = useState<string>(() => {
    return new Date().toISOString().split("T")[0];
  });
  const [sessions, setSessions] = useState<ReconciliationSession[]>([]);
  const [selectedSessionId, setSelectedSessionId] = useState<string>("");

  // ── Calculation State ────────────────────────────────────────────────────────
  const [brsSummary, setBrsSummary] = useState<BrsCalculationResult | null>(null);
  const [calculating, setCalculating] = useState(false);

  // ── Active Workspace Tab ─────────────────────────────────────────────────────
  const [activeTab, setActiveTab] = useState<
    "uncleared" | "outstanding" | "unmatched" | "sessions"
  >("uncleared");

  // ── Schedules Data States ────────────────────────────────────────────────────
  const [unclearedDeposits, setUnclearedDeposits] = useState<UnclearedDepositItem[]>([]);
  const [unclearedTotal, setUnclearedTotal] = useState(0);
  const [unclearedLoading, setUnclearedLoading] = useState(false);
  const [unclearedOffset, setUnclearedOffset] = useState(0);

  const [outstandingDisbursements, setOutstandingDisbursements] = useState<OutstandingDisbursementItem[]>([]);
  const [outstandingTotal, setOutstandingTotal] = useState(0);
  const [outstandingLoading, setOutstandingLoading] = useState(false);
  const [outstandingOffset, setOutstandingOffset] = useState(0);

  const [unmatchedLines, setUnmatchedLines] = useState<UnmatchedStatementLineItem[]>([]);
  const [unmatchedTotal, setUnmatchedTotal] = useState(0);
  const [unmatchedLoading, setUnmatchedLoading] = useState(false);
  const [unmatchedOffset, setUnmatchedOffset] = useState(0);
  const [lineTypeFilter, setLineTypeFilter] = useState<"" | "DEBIT" | "CREDIT">("");

  const [sessionsTotal, setSessionsTotal] = useState(0);
  const [sessionsLoading, setSessionsLoading] = useState(false);
  const [sessionsOffset, setSessionsOffset] = useState(0);
  const [sessionStatusFilter, setSessionStatusFilter] = useState<string>("");

  // Session Detail Modal
  const [selectedSessionDetail, setSelectedSessionDetail] = useState<ReconciliationSession | null>(null);
  const [detailModalOpen, setDetailModalOpen] = useState(false);
  const [detailModalLoading, setDetailModalLoading] = useState(false);

  // Status & Error Messages
  const [error, setError] = useState<string | null>(null);
  const [searchFilter, setSearchFilter] = useState<string>("");

  const pageSize = 25;

  // ── Load Active Bank Accounts ────────────────────────────────────────────────
  const loadBankAccounts = useCallback(async () => {
    try {
      const res = await fetch("/api/v1/admin/bank-accounts?status=ACTIVE");
      const data = await res.json();
      if (data.success && Array.isArray(data.data)) {
        setBankAccounts(data.data);
        if (data.data.length > 0 && !selectedAccountId) {
          setSelectedAccountId(data.data[0].id);
        }
      }
    } catch (err: any) {
      console.error("Failed to load bank accounts", err);
    }
  }, [selectedAccountId]);

  useEffect(() => {
    loadBankAccounts();
  }, [loadBankAccounts]);

  // ── Load Bank Sessions ───────────────────────────────────────────────────────
  const loadSessionsList = useCallback(async () => {
    if (!selectedAccountId) return;
    setSessionsLoading(true);
    try {
      const params = new URLSearchParams();
      params.set("bank_account_id", selectedAccountId);
      params.set("limit", String(pageSize));
      params.set("offset", String(sessionsOffset));
      if (sessionStatusFilter) params.set("status", sessionStatusFilter);

      const res = await fetch(`/api/v1/admin/bank-reconciliation/sessions?${params}`);
      const data = await res.json();
      if (data.success) {
        setSessions(data.data?.sessions || data.sessions || []);
        setSessionsTotal(data.data?.total || data.total || 0);
      }
    } catch (err: any) {
      console.error("Failed to load reconciliation sessions", err);
    } finally {
      setSessionsLoading(false);
    }
  }, [selectedAccountId, sessionsOffset, sessionStatusFilter]);

  useEffect(() => {
    loadSessionsList();
  }, [loadSessionsList]);

  // ── Fetch Authoritative BRS Calculation ─────────────────────────────────────
  const calculateBrs = useCallback(async () => {
    if (!selectedAccountId) return;
    setCalculating(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      params.set("bank_account_id", selectedAccountId);
      if (asOfDate) params.set("as_of_date", asOfDate);
      if (selectedSessionId) params.set("session_id", selectedSessionId);

      const res = await fetch(`/api/v1/admin/bank-reconciliation/statements/calculate?${params}`);
      const data = await res.json();
      if (data.success) {
        setBrsSummary(data.data);
      } else {
        setError(data.message || data.error || "Failed to calculate Bank Reconciliation Statement");
        setBrsSummary(null);
      }
    } catch (err: any) {
      setError(err.message || "Network error while calculating BRS");
      setBrsSummary(null);
    } finally {
      setCalculating(false);
    }
  }, [selectedAccountId, asOfDate, selectedSessionId]);

  useEffect(() => {
    calculateBrs();
  }, [calculateBrs]);

  // ── Load Uncleared Deposits ──────────────────────────────────────────────────
  const loadUnclearedDeposits = useCallback(async () => {
    if (!selectedAccountId) return;
    setUnclearedLoading(true);
    try {
      const params = new URLSearchParams();
      params.set("bank_account_id", selectedAccountId);
      if (asOfDate) params.set("as_of_date", asOfDate);
      params.set("limit", String(pageSize));
      params.set("offset", String(unclearedOffset));

      const res = await fetch(`/api/v1/admin/bank-reconciliation/statements/uncleared-deposits?${params}`);
      const data = await res.json();
      if (data.success) {
        setUnclearedDeposits(data.data?.items || data.items || []);
        setUnclearedTotal(data.data?.total || data.total || 0);
      }
    } catch (err: any) {
      console.error("Failed to load uncleared deposits", err);
    } finally {
      setUnclearedLoading(false);
    }
  }, [selectedAccountId, asOfDate, unclearedOffset]);

  // ── Load Outstanding Disbursements ───────────────────────────────────────────
  const loadOutstandingDisbursements = useCallback(async () => {
    if (!selectedAccountId) return;
    setOutstandingLoading(true);
    try {
      const params = new URLSearchParams();
      params.set("bank_account_id", selectedAccountId);
      if (asOfDate) params.set("as_of_date", asOfDate);
      params.set("limit", String(pageSize));
      params.set("offset", String(outstandingOffset));

      const res = await fetch(`/api/v1/admin/bank-reconciliation/statements/outstanding-disbursements?${params}`);
      const data = await res.json();
      if (data.success) {
        setOutstandingDisbursements(data.data?.items || data.items || []);
        setOutstandingTotal(data.data?.total || data.total || 0);
      }
    } catch (err: any) {
      console.error("Failed to load outstanding disbursements", err);
    } finally {
      setOutstandingLoading(false);
    }
  }, [selectedAccountId, asOfDate, outstandingOffset]);

  // ── Load Unmatched Statement Lines ───────────────────────────────────────────
  const loadUnmatchedLines = useCallback(async () => {
    if (!selectedAccountId) return;
    setUnmatchedLoading(true);
    try {
      const params = new URLSearchParams();
      params.set("bank_account_id", selectedAccountId);
      if (asOfDate) params.set("as_of_date", asOfDate);
      if (selectedSessionId) params.set("session_id", selectedSessionId);
      if (lineTypeFilter) params.set("line_type", lineTypeFilter);
      params.set("limit", String(pageSize));
      params.set("offset", String(unmatchedOffset));

      const res = await fetch(`/api/v1/admin/bank-reconciliation/statements/unmatched-lines?${params}`);
      const data = await res.json();
      if (data.success) {
        setUnmatchedLines(data.data?.items || data.items || []);
        setUnmatchedTotal(data.data?.total || data.total || 0);
      }
    } catch (err: any) {
      console.error("Failed to load unmatched statement lines", err);
    } finally {
      setUnmatchedLoading(false);
    }
  }, [selectedAccountId, asOfDate, selectedSessionId, lineTypeFilter, unmatchedOffset]);

  // Trigger schedule fetch depending on active workspace tab
  useEffect(() => {
    if (activeTab === "uncleared") loadUnclearedDeposits();
    if (activeTab === "outstanding") loadOutstandingDisbursements();
    if (activeTab === "unmatched") loadUnmatchedLines();
    if (activeTab === "sessions") loadSessionsList();
  }, [activeTab, loadUnclearedDeposits, loadOutstandingDisbursements, loadUnmatchedLines, loadSessionsList]);

  // ── View Session Detail Modal ────────────────────────────────────────────────
  const openSessionDetail = async (sessionId: string) => {
    setDetailModalOpen(true);
    setDetailModalLoading(true);
    try {
      const res = await fetch(`/api/v1/admin/bank-reconciliation/sessions/${sessionId}`);
      const data = await res.json();
      if (data.success) {
        setSelectedSessionDetail(data.data || data.session);
      }
    } catch (err: any) {
      console.error("Failed to fetch session detail", err);
    } finally {
      setDetailModalLoading(false);
    }
  };

  // ── Selected Account Metadata ────────────────────────────────────────────────
  const activeAccount = useMemo(() => {
    return bankAccounts.find((a) => a.id === selectedAccountId);
  }, [bankAccounts, selectedAccountId]);

  // ── Filtered items based on local search ──────────────────────────────────────
  const filteredUncleared = useMemo(() => {
    if (!searchFilter.trim()) return unclearedDeposits;
    const q = searchFilter.toLowerCase();
    return unclearedDeposits.filter(
      (item) =>
        item.slip_number?.toLowerCase().includes(q) ||
        item.notes?.toLowerCase().includes(q) ||
        item.cashier_name?.toLowerCase().includes(q)
    );
  }, [unclearedDeposits, searchFilter]);

  const filteredOutstanding = useMemo(() => {
    if (!searchFilter.trim()) return outstandingDisbursements;
    const q = searchFilter.toLowerCase();
    return outstandingDisbursements.filter(
      (item) =>
        item.voucher_no?.toLowerCase().includes(q) ||
        item.payee_name?.toLowerCase().includes(q) ||
        item.reference_no?.toLowerCase().includes(q)
    );
  }, [outstandingDisbursements, searchFilter]);

  const filteredUnmatched = useMemo(() => {
    if (!searchFilter.trim()) return unmatchedLines;
    const q = searchFilter.toLowerCase();
    return unmatchedLines.filter(
      (item) =>
        item.narration?.toLowerCase().includes(q) ||
        item.reference_number?.toLowerCase().includes(q)
    );
  }, [unmatchedLines, searchFilter]);

  // ── Discrepancy Evaluation ───────────────────────────────────────────────────
  const discrepancyPaise = brsSummary ? brsSummary.discrepancy : 0;
  const isBalanced = brsSummary && discrepancyPaise === 0;

  return (
    <div className="w-full min-w-0 max-w-full space-y-6 p-4 md:p-6 bg-slate-50 dark:bg-slate-950 min-h-screen text-slate-900 dark:text-slate-100">
      {/* ── TOP HEADER ──────────────────────────────────────────────────────── */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-200 dark:border-slate-800">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-2 rounded-xl bg-[#1D2F5D] text-white shadow-xs">
              <Landmark className="w-5 h-5 text-[#D4AF37]" />
            </span>
            <h1 className="text-xl md:text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
              Bank Reconciliation Statement (BRS)
            </h1>
          </div>
          <p className="mt-1 text-xs md:text-sm text-slate-600 dark:text-slate-400">
            Authoritative comparison of GL Bank Account (1112/1113) against verified Bank Statements.
          </p>
        </div>

        {/* Global Refresh Button */}
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => {
              calculateBrs();
              if (activeTab === "uncleared") loadUnclearedDeposits();
              if (activeTab === "outstanding") loadOutstandingDisbursements();
              if (activeTab === "unmatched") loadUnmatchedLines();
              if (activeTab === "sessions") loadSessionsList();
            }}
            disabled={calculating}
            className="flex items-center gap-2 px-3.5 py-2 text-xs font-semibold text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-all shadow-xs cursor-pointer disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${calculating ? "animate-spin text-[#1D2F5D]" : ""}`} />
            <span>{calculating ? "Calculating..." : "Refresh Statement"}</span>
          </button>
        </div>
      </div>

      {/* ── ERROR ALERT ─────────────────────────────────────────────────────── */}
      {error && (
        <div className="p-4 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-rose-800 dark:text-rose-300 flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5 text-rose-600" />
          <div className="flex-1 text-sm font-medium">
            <p className="font-semibold">Reconciliation Error</p>
            <p className="text-xs mt-0.5">{error}</p>
          </div>
          <button
            type="button"
            onClick={() => setError(null)}
            className="text-rose-500 hover:text-rose-700"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* ── CONTROL BAR / CONTEXT SELECTOR ───────────────────────────────────── */}
      <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs grid grid-cols-1 md:grid-cols-3 gap-4 items-center">
        {/* Bank Account Selector */}
        <div>
          <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 mb-1.5 flex items-center gap-1.5">
            <Landmark className="w-3.5 h-3.5 text-[#1D2F5D] dark:text-[#D4AF37]" />
            <span>Select Bank Account</span>
          </label>
          <select
            value={selectedAccountId}
            onChange={(e) => setSelectedAccountId(e.target.value)}
            className="w-full py-2 px-3 text-xs md:text-sm font-medium bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl outline-none focus:ring-2 focus:ring-[#1D2F5D] text-slate-900 dark:text-white cursor-pointer"
          >
            {bankAccounts.length === 0 ? (
              <option value="">No Active Bank Accounts</option>
            ) : (
              bankAccounts.map((account) => (
                <option key={account.id} value={account.id}>
                  {account.bank_name} — {account.account_number_masked || account.account_number || account.id.slice(0, 8)} {account.currency ? `(${account.currency})` : ""}
                </option>
              ))
            )}
          </select>
        </div>

        {/* As-Of Date Cutoff Picker */}
        <div>
          <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 mb-1.5 flex items-center gap-1.5">
            <Calendar className="w-3.5 h-3.5 text-[#1D2F5D] dark:text-[#D4AF37]" />
            <span>As-Of Cutoff Date (YYYY-MM-DD)</span>
          </label>
          <input
            type="date"
            value={asOfDate}
            onChange={(e) => setAsOfDate(e.target.value)}
            className="w-full py-2 px-3 text-xs md:text-sm font-medium bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl outline-none focus:ring-2 focus:ring-[#1D2F5D] text-slate-900 dark:text-white cursor-pointer"
          />
        </div>

        {/* Session Filter */}
        <div>
          <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 mb-1.5 flex items-center gap-1.5">
            <Clock className="w-3.5 h-3.5 text-[#1D2F5D] dark:text-[#D4AF37]" />
            <span>Reconciliation Session (Optional)</span>
          </label>
          <select
            value={selectedSessionId}
            onChange={(e) => setSelectedSessionId(e.target.value)}
            className="w-full py-2 px-3 text-xs md:text-sm font-medium bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl outline-none focus:ring-2 focus:ring-[#1D2F5D] text-slate-900 dark:text-white cursor-pointer"
          >
            <option value="">Ad-hoc Cutoff (All Active Statements)</option>
            {sessions.map((sess) => (
              <option key={sess.id} value={sess.id}>
                {sess.period_start} to {sess.period_end} [{sess.status}]
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* ── EXECUTIVE SUMMARY & RECONCILIATION BRIDGE CARD ───────────────────── */}
      {brsSummary ? (
        <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
          {/* Card Top: Three Pillars & Status */}
          <div className="p-5 md:p-6 bg-slate-50/50 dark:bg-slate-800/40 border-b border-slate-200 dark:border-slate-800">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Pillar 1: GL Book Balance */}
              <div className="p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs">
                <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                  GL Book Balance (1112/1113)
                </p>
                <p className="text-xl md:text-2xl font-bold font-mono text-slate-900 dark:text-white mt-1">
                  {formatPaiseToInr(brsSummary.gl_closing_balance)}
                </p>
                <p className="text-2xs text-slate-500 mt-1 flex items-center gap-1">
                  <Info className="w-3 h-3" /> Authoritative ledger balance as of {brsSummary.as_of_date}
                </p>
              </div>

              {/* Pillar 2: Computed Bank Balance */}
              <div className="p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs">
                <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                  Computed Bank Balance
                </p>
                <p className="text-xl md:text-2xl font-bold font-mono text-[#1D2F5D] dark:text-[#D4AF37] mt-1">
                  {formatPaiseToInr(brsSummary.computed_bank_balance)}
                </p>
                <p className="text-2xs text-slate-500 mt-1">
                  Adjusted Book + Outstanding - Uncleared
                </p>
              </div>

              {/* Pillar 3: Bank Statement Closing Balance */}
              <div className="p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs">
                <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                  Statement Closing Balance
                </p>
                <p className="text-xl md:text-2xl font-bold font-mono text-slate-900 dark:text-white mt-1">
                  {formatPaiseToInr(brsSummary.statement_closing_balance)}
                </p>
                <p className="text-2xs text-slate-500 mt-1">
                  Authoritative bank statement closing balance
                </p>
              </div>
            </div>

            {/* Reconciliation State Banner */}
            <div className="mt-4 pt-4 border-t border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                {isBalanced ? (
                  <span className="flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                    RECONCILED & BALANCED (₹0.00 DISCREPANCY)
                  </span>
                ) : (
                  <span className="flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-rose-100 text-rose-800 dark:bg-rose-900/40 dark:text-rose-300 border border-rose-200 dark:border-rose-800">
                    <AlertTriangle className="w-4 h-4 text-rose-600 dark:text-rose-400" />
                    DISCREPANCY DETECTED ({formatPaiseToInr(Math.abs(discrepancyPaise))} DIFFERENCE)
                  </span>
                )}
                <span className="text-xs text-slate-500">
                  Cutoff: {brsSummary.as_of_date}
                </span>
              </div>
              <p className="text-xs font-medium text-slate-500">
                Formula: Adjusted Book (1112) + Outstanding Checks - In-Transit Deposits = Statement Balance
              </p>
            </div>
          </div>

          {/* Card Bottom: Detailed Mathematical Reconciliation Bridge */}
          <div className="p-5 md:p-6 space-y-2.5 font-mono text-xs md:text-sm">
            <h3 className="font-sans font-bold text-xs uppercase text-slate-500 tracking-wider mb-3">
              Reconciliation Mathematical Bridge
            </h3>

            {/* 1. GL Balance */}
            <div className="flex items-center justify-between py-1.5 border-b border-slate-100 dark:border-slate-800/60">
              <span className="text-slate-700 dark:text-slate-300 font-sans">
                1. General Ledger Closing Book Balance (GL 1112/1113):
              </span>
              <span className="font-bold text-slate-900 dark:text-white">
                {formatPaiseToInr(brsSummary.gl_closing_balance)}
              </span>
            </div>

            {/* 2. Add: Unmatched Statement Credits */}
            <div className="flex items-center justify-between py-1.5 text-emerald-700 dark:text-emerald-400 border-b border-slate-100 dark:border-slate-800/60">
              <span className="font-sans flex items-center gap-1">
                <ArrowUpRight className="w-3.5 h-3.5" /> (+) Unmatched Bank Statement Credits (Direct Receipts / Interest):
              </span>
              <span className="font-bold">
                + {formatPaiseToInr(brsSummary.unmatched_statement_credits)}
              </span>
            </div>

            {/* 3. Less: Unmatched Statement Debits */}
            <div className="flex items-center justify-between py-1.5 text-rose-700 dark:text-rose-400 border-b border-slate-100 dark:border-slate-800/60">
              <span className="font-sans flex items-center gap-1">
                <ArrowDownLeft className="w-3.5 h-3.5" /> (-) Unmatched Bank Statement Debits (Bank Charges / Auto Debits):
              </span>
              <span className="font-bold">
                - {formatPaiseToInr(brsSummary.unmatched_statement_debits)}
              </span>
            </div>

            {/* 4. Adjusted Book Balance */}
            <div className="flex items-center justify-between py-2 bg-slate-50 dark:bg-slate-800/50 px-3 rounded-lg font-bold text-slate-900 dark:text-white border border-slate-200 dark:border-slate-700">
              <span className="font-sans">
                (=) Adjusted Book Balance:
              </span>
              <span>
                {formatPaiseToInr(brsSummary.adjusted_book_balance)}
              </span>
            </div>

            {/* 5. Add: Outstanding Disbursements */}
            <div className="flex items-center justify-between py-1.5 text-blue-700 dark:text-blue-400 border-b border-slate-100 dark:border-slate-800/60">
              <span className="font-sans flex items-center gap-1">
                <ArrowUpRight className="w-3.5 h-3.5" /> (+) Outstanding Disbursements (Checks / Payments Issued not Cleared):
              </span>
              <span className="font-bold">
                + {formatPaiseToInr(brsSummary.outstanding_disbursements)}
              </span>
            </div>

            {/* 6. Less: Uncleared Deposits */}
            <div className="flex items-center justify-between py-1.5 text-amber-700 dark:text-amber-400 border-b border-slate-100 dark:border-slate-800/60">
              <span className="font-sans flex items-center gap-1">
                <ArrowDownLeft className="w-3.5 h-3.5" /> (-) Uncleared Deposits (Cash / Checks Deposited in Transit):
              </span>
              <span className="font-bold">
                - {formatPaiseToInr(brsSummary.uncleared_deposits)}
              </span>
            </div>

            {/* 7. Computed Bank Balance */}
            <div className="flex items-center justify-between py-2 bg-[#1D2F5D]/10 dark:bg-[#1D2F5D]/30 px-3 rounded-lg font-bold text-[#1D2F5D] dark:text-[#D4AF37] border border-[#1D2F5D]/20">
              <span className="font-sans">
                (=) Computed Bank Balance (Ought to be):
              </span>
              <span>
                {formatPaiseToInr(brsSummary.computed_bank_balance)}
              </span>
            </div>

            {/* 8. Bank Statement Closing Balance */}
            <div className="flex items-center justify-between py-1.5 border-b border-slate-100 dark:border-slate-800/60">
              <span className="text-slate-700 dark:text-slate-300 font-sans">
                Bank Statement Closing Balance:
              </span>
              <span className="font-bold text-slate-900 dark:text-white">
                {formatPaiseToInr(brsSummary.statement_closing_balance)}
              </span>
            </div>

            {/* 9. Discrepancy Vector */}
            <div className={`flex items-center justify-between py-2.5 px-3 rounded-lg font-bold ${
              isBalanced
                ? "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800"
                : "bg-rose-50 dark:bg-rose-950/40 text-rose-800 dark:text-rose-300 border border-rose-200 dark:border-rose-800"
            }`}>
              <span className="font-sans">
                Net Reconciliation Discrepancy Vector (Δ):
              </span>
              <span className="text-base font-mono">
                {formatPaiseToInr(discrepancyPaise)}
              </span>
            </div>
          </div>
        </div>
      ) : (
        <div className="p-8 text-center rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
          <Clock className="w-8 h-8 text-slate-400 mx-auto animate-pulse" />
          <p className="mt-2 text-sm font-semibold text-slate-600 dark:text-slate-400">
            {calculating ? "Calculating Bank Reconciliation Statement..." : "Select an active bank account to view BRS."}
          </p>
        </div>
      )}

      {/* ── ITEMIZED SCHEDULES & WORKSPACE TABS ─────────────────────────────── */}
      <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
        {/* Navigation Tabs Bar */}
        <div className="flex flex-wrap items-center justify-between gap-2 p-3 border-b border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30">
          <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-thin">
            <button
              type="button"
              onClick={() => setActiveTab("uncleared")}
              className={`px-3 py-2 text-xs font-bold rounded-xl transition-all flex items-center gap-2 cursor-pointer ${
                activeTab === "uncleared"
                  ? "bg-[#1D2F5D] text-white shadow-xs"
                  : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
              }`}
            >
              <ArrowDownLeft className="w-3.5 h-3.5" />
              <span>Uncleared Deposits</span>
              <span className="px-1.5 py-0.5 rounded-full text-2xs bg-white/20">
                {unclearedTotal}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab("outstanding")}
              className={`px-3 py-2 text-xs font-bold rounded-xl transition-all flex items-center gap-2 cursor-pointer ${
                activeTab === "outstanding"
                  ? "bg-[#1D2F5D] text-white shadow-xs"
                  : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
              }`}
            >
              <ArrowUpRight className="w-3.5 h-3.5" />
              <span>Outstanding Disbursements</span>
              <span className="px-1.5 py-0.5 rounded-full text-2xs bg-white/20">
                {outstandingTotal}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab("unmatched")}
              className={`px-3 py-2 text-xs font-bold rounded-xl transition-all flex items-center gap-2 cursor-pointer ${
                activeTab === "unmatched"
                  ? "bg-[#1D2F5D] text-white shadow-xs"
                  : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
              }`}
            >
              <FileCheck2 className="w-3.5 h-3.5" />
              <span>Unmatched Statement Lines</span>
              <span className="px-1.5 py-0.5 rounded-full text-2xs bg-white/20">
                {unmatchedTotal}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab("sessions")}
              className={`px-3 py-2 text-xs font-bold rounded-xl transition-all flex items-center gap-2 cursor-pointer ${
                activeTab === "sessions"
                  ? "bg-[#1D2F5D] text-white shadow-xs"
                  : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
              }`}
            >
              <Clock className="w-3.5 h-3.5" />
              <span>Reconciliation Sessions</span>
              <span className="px-1.5 py-0.5 rounded-full text-2xs bg-white/20">
                {sessionsTotal}
              </span>
            </button>
          </div>

          {/* Quick Search */}
          <div className="relative min-w-[200px] w-full sm:w-auto">
            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search in schedule..."
              value={searchFilter}
              onChange={(e) => setSearchFilter(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg outline-none focus:ring-1 focus:ring-[#1D2F5D] text-slate-900 dark:text-white"
            />
          </div>
        </div>

        {/* ── TAB 1: UNCLEARED DEPOSITS ────────────────────────────────────── */}
        {activeTab === "uncleared" && (
          <div className="p-4">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-500 uppercase tracking-wider font-semibold">
                    <th className="py-2.5 px-3">Deposit Slip #</th>
                    <th className="py-2.5 px-3">Date</th>
                    <th className="py-2.5 px-3">Cashier / Staff</th>
                    <th className="py-2.5 px-3">Notes</th>
                    <th className="py-2.5 px-3">Status</th>
                    <th className="py-2.5 px-3 text-right">Amount (₹)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 font-medium">
                  {unclearedLoading ? (
                    <tr>
                      <td colSpan={6} className="py-8 text-center text-slate-400">
                        <RefreshCw className="w-4 h-4 animate-spin inline-block mr-2" />
                        Loading uncleared deposit slips...
                      </td>
                    </tr>
                  ) : filteredUncleared.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-8 text-center text-slate-400">
                        Zero uncleared deposits found for this cutoff date.
                      </td>
                    </tr>
                  ) : (
                    filteredUncleared.map((slip) => (
                      <tr key={slip.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                        <td className="py-2.5 px-3 font-mono font-bold text-[#1D2F5D] dark:text-[#D4AF37]">
                          {slip.slip_number}
                        </td>
                        <td className="py-2.5 px-3 text-slate-600 dark:text-slate-400">
                          {slip.slip_date}
                        </td>
                        <td className="py-2.5 px-3">
                          {slip.cashier_name || "—"}
                        </td>
                        <td className="py-2.5 px-3 text-slate-500 max-w-xs truncate">
                          {slip.notes || "Cash deposit in-transit"}
                        </td>
                        <td className="py-2.5 px-3">
                          <span className="px-2 py-0.5 rounded-full text-2xs font-bold bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300">
                            {slip.status}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono font-bold">
                          {formatPaiseToInr(slip.amount)}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination Controls */}
            <div className="flex items-center justify-between mt-4 pt-3 border-t border-slate-100 dark:border-slate-800 text-xs text-slate-500">
              <span>Showing {filteredUncleared.length} of {unclearedTotal} uncleared deposits</span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={unclearedOffset === 0 || unclearedLoading}
                  onClick={() => setUnclearedOffset((prev) => Math.max(0, prev - pageSize))}
                  className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-40 cursor-pointer"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <span>Offset: {unclearedOffset}</span>
                <button
                  type="button"
                  disabled={unclearedOffset + pageSize >= unclearedTotal || unclearedLoading}
                  onClick={() => setUnclearedOffset((prev) => prev + pageSize)}
                  className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-40 cursor-pointer"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ── TAB 2: OUTSTANDING DISBURSEMENTS ────────────────────────────── */}
        {activeTab === "outstanding" && (
          <div className="p-4">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-500 uppercase tracking-wider font-semibold">
                    <th className="py-2.5 px-3">Voucher #</th>
                    <th className="py-2.5 px-3">Date</th>
                    <th className="py-2.5 px-3">Payee / Supplier</th>
                    <th className="py-2.5 px-3">Reference / Cheque</th>
                    <th className="py-2.5 px-3">Status</th>
                    <th className="py-2.5 px-3 text-right">Amount (₹)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 font-medium">
                  {outstandingLoading ? (
                    <tr>
                      <td colSpan={6} className="py-8 text-center text-slate-400">
                        <RefreshCw className="w-4 h-4 animate-spin inline-block mr-2" />
                        Loading outstanding disbursements...
                      </td>
                    </tr>
                  ) : filteredOutstanding.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-8 text-center text-slate-400">
                        Zero outstanding disbursements found for this cutoff date.
                      </td>
                    </tr>
                  ) : (
                    filteredOutstanding.map((item) => (
                      <tr key={item.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                        <td className="py-2.5 px-3 font-mono font-bold text-[#1D2F5D] dark:text-[#D4AF37]">
                          {item.voucher_no}
                        </td>
                        <td className="py-2.5 px-3 text-slate-600 dark:text-slate-400">
                          {item.voucher_date}
                        </td>
                        <td className="py-2.5 px-3 font-semibold">
                          {item.payee_name || "Supplier / Vendor"}
                        </td>
                        <td className="py-2.5 px-3 text-slate-500 font-mono">
                          {item.reference_no || "—"}
                        </td>
                        <td className="py-2.5 px-3">
                          <span className="px-2 py-0.5 rounded-full text-2xs font-bold bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300">
                            {item.status}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono font-bold">
                          {formatPaiseToInr(item.amount)}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination Controls */}
            <div className="flex items-center justify-between mt-4 pt-3 border-t border-slate-100 dark:border-slate-800 text-xs text-slate-500">
              <span>Showing {filteredOutstanding.length} of {outstandingTotal} outstanding items</span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={outstandingOffset === 0 || outstandingLoading}
                  onClick={() => setOutstandingOffset((prev) => Math.max(0, prev - pageSize))}
                  className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-40 cursor-pointer"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <span>Offset: {outstandingOffset}</span>
                <button
                  type="button"
                  disabled={outstandingOffset + pageSize >= outstandingTotal || outstandingLoading}
                  onClick={() => setOutstandingOffset((prev) => prev + pageSize)}
                  className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-40 cursor-pointer"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ── TAB 3: UNMATCHED STATEMENT LINES ─────────────────────────────── */}
        {activeTab === "unmatched" && (
          <div className="p-4 space-y-4">
            {/* Filter Pills for Line Type */}
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-slate-500">Filter By Type:</span>
              <button
                type="button"
                onClick={() => setLineTypeFilter("")}
                className={`px-2.5 py-1 text-xs font-semibold rounded-lg cursor-pointer ${
                  lineTypeFilter === ""
                    ? "bg-[#1D2F5D] text-white"
                    : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300"
                }`}
              >
                All Lines
              </button>
              <button
                type="button"
                onClick={() => setLineTypeFilter("CREDIT")}
                className={`px-2.5 py-1 text-xs font-semibold rounded-lg cursor-pointer ${
                  lineTypeFilter === "CREDIT"
                    ? "bg-emerald-700 text-white"
                    : "bg-slate-100 dark:bg-slate-800 text-emerald-700 dark:text-emerald-400"
                }`}
              >
                Credits Only (Direct Collections)
              </button>
              <button
                type="button"
                onClick={() => setLineTypeFilter("DEBIT")}
                className={`px-2.5 py-1 text-xs font-semibold rounded-lg cursor-pointer ${
                  lineTypeFilter === "DEBIT"
                    ? "bg-rose-700 text-white"
                    : "bg-slate-100 dark:bg-slate-800 text-rose-700 dark:text-rose-400"
                }`}
              >
                Debits Only (Bank Charges/Fees)
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-500 uppercase tracking-wider font-semibold">
                    <th className="py-2.5 px-3">Date</th>
                    <th className="py-2.5 px-3">Type</th>
                    <th className="py-2.5 px-3">Narration / Description</th>
                    <th className="py-2.5 px-3">Reference / UTR</th>
                    <th className="py-2.5 px-3">Match Status</th>
                    <th className="py-2.5 px-3 text-right">Amount (₹)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 font-medium">
                  {unmatchedLoading ? (
                    <tr>
                      <td colSpan={6} className="py-8 text-center text-slate-400">
                        <RefreshCw className="w-4 h-4 animate-spin inline-block mr-2" />
                        Loading unmatched statement lines...
                      </td>
                    </tr>
                  ) : filteredUnmatched.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-8 text-center text-slate-400">
                        Zero unmatched statement lines found.
                      </td>
                    </tr>
                  ) : (
                    filteredUnmatched.map((line) => (
                      <tr key={line.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                        <td className="py-2.5 px-3 text-slate-600 dark:text-slate-400 font-mono">
                          {line.transaction_date}
                        </td>
                        <td className="py-2.5 px-3">
                          <span
                            className={`px-2 py-0.5 rounded-full text-2xs font-bold ${
                              line.line_type === "CREDIT"
                                ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300"
                                : "bg-rose-100 text-rose-800 dark:bg-rose-900/40 dark:text-rose-300"
                            }`}
                          >
                            {line.line_type}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 max-w-sm truncate text-slate-800 dark:text-slate-200">
                          {line.narration || "Bank Transaction"}
                        </td>
                        <td className="py-2.5 px-3 font-mono text-slate-500">
                          {line.reference_number || "—"}
                        </td>
                        <td className="py-2.5 px-3">
                          <span className="px-2 py-0.5 rounded-full text-2xs font-semibold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
                            {line.match_status}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono font-bold">
                          {formatPaiseToInr(line.amount)}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination Controls */}
            <div className="flex items-center justify-between mt-4 pt-3 border-t border-slate-100 dark:border-slate-800 text-xs text-slate-500">
              <span>Showing {filteredUnmatched.length} of {unmatchedTotal} unmatched lines</span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={unmatchedOffset === 0 || unmatchedLoading}
                  onClick={() => setUnmatchedOffset((prev) => Math.max(0, prev - pageSize))}
                  className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-40 cursor-pointer"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <span>Offset: {unmatchedOffset}</span>
                <button
                  type="button"
                  disabled={unmatchedOffset + pageSize >= unmatchedTotal || unmatchedLoading}
                  onClick={() => setUnmatchedOffset((prev) => prev + pageSize)}
                  className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-40 cursor-pointer"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ── TAB 4: RECONCILIATION SESSIONS ──────────────────────────────── */}
        {activeTab === "sessions" && (
          <div className="p-4 space-y-4">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-slate-500">Status Filter:</span>
              <select
                value={sessionStatusFilter}
                onChange={(e) => setSessionStatusFilter(e.target.value)}
                className="py-1 px-2.5 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg outline-none cursor-pointer"
              >
                <option value="">All Statuses</option>
                <option value="DRAFT">Draft</option>
                <option value="IN_PROGRESS">In Progress</option>
                <option value="COMPLETED">Completed</option>
                <option value="ABANDONED">Abandoned</option>
              </select>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-500 uppercase tracking-wider font-semibold">
                    <th className="py-2.5 px-3">Session ID</th>
                    <th className="py-2.5 px-3">Period</th>
                    <th className="py-2.5 px-3 text-right">Opening (₹)</th>
                    <th className="py-2.5 px-3 text-right">Closing (₹)</th>
                    <th className="py-2.5 px-3">Status</th>
                    <th className="py-2.5 px-3">Created At</th>
                    <th className="py-2.5 px-3 text-center">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 font-medium">
                  {sessionsLoading ? (
                    <tr>
                      <td colSpan={7} className="py-8 text-center text-slate-400">
                        <RefreshCw className="w-4 h-4 animate-spin inline-block mr-2" />
                        Loading reconciliation sessions...
                      </td>
                    </tr>
                  ) : sessions.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-8 text-center text-slate-400">
                        Zero reconciliation sessions found for this bank account.
                      </td>
                    </tr>
                  ) : (
                    sessions.map((sess) => (
                      <tr key={sess.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                        <td className="py-2.5 px-3 font-mono font-bold text-[#1D2F5D] dark:text-[#D4AF37]">
                          {sess.id.slice(0, 8)}...
                        </td>
                        <td className="py-2.5 px-3">
                          {sess.period_start} → {sess.period_end}
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono">
                          {formatPaiseToInr(sess.opening_balance)}
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono font-bold">
                          {formatPaiseToInr(sess.closing_balance)}
                        </td>
                        <td className="py-2.5 px-3">
                          <span
                            className={`px-2 py-0.5 rounded-full text-2xs font-bold ${
                              sess.status === "COMPLETED"
                                ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300"
                                : sess.status === "IN_PROGRESS"
                                ? "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300"
                                : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400"
                            }`}
                          >
                            {sess.status}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 text-slate-500">
                          {sess.created_at ? new Date(sess.created_at).toLocaleDateString() : "—"}
                        </td>
                        <td className="py-2.5 px-3 text-center">
                          <button
                            type="button"
                            onClick={() => openSessionDetail(sess.id)}
                            className="px-2.5 py-1 text-2xs font-semibold text-[#1D2F5D] dark:text-[#D4AF37] hover:underline cursor-pointer"
                          >
                            View Detail
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination Controls */}
            <div className="flex items-center justify-between mt-4 pt-3 border-t border-slate-100 dark:border-slate-800 text-xs text-slate-500">
              <span>Showing {sessions.length} of {sessionsTotal} sessions</span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={sessionsOffset === 0 || sessionsLoading}
                  onClick={() => setSessionsOffset((prev) => Math.max(0, prev - pageSize))}
                  className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-40 cursor-pointer"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <span>Offset: {sessionsOffset}</span>
                <button
                  type="button"
                  disabled={sessionsOffset + pageSize >= sessionsTotal || sessionsLoading}
                  onClick={() => setSessionsOffset((prev) => prev + pageSize)}
                  className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-40 cursor-pointer"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ── SESSION DETAIL MODAL ────────────────────────────────────────────── */}
      {detailModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-lg shadow-xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between p-4 border-b border-slate-200 dark:border-slate-800">
              <h3 className="font-bold text-sm text-slate-900 dark:text-white flex items-center gap-2">
                <Clock className="w-4 h-4 text-[#1D2F5D] dark:text-[#D4AF37]" />
                Reconciliation Session Detail
              </h3>
              <button
                type="button"
                onClick={() => setDetailModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 space-y-3 text-xs">
              {detailModalLoading ? (
                <div className="py-8 text-center text-slate-400">
                  <RefreshCw className="w-4 h-4 animate-spin inline-block mr-2" />
                  Loading session data...
                </div>
              ) : selectedSessionDetail ? (
                <div className="space-y-2">
                  <div className="flex justify-between py-1 border-b border-slate-100 dark:border-slate-800">
                    <span className="text-slate-500">Session ID:</span>
                    <span className="font-mono font-bold">{selectedSessionDetail.id}</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-slate-100 dark:border-slate-800">
                    <span className="text-slate-500">Period Range:</span>
                    <span className="font-semibold">{selectedSessionDetail.period_start} → {selectedSessionDetail.period_end}</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-slate-100 dark:border-slate-800">
                    <span className="text-slate-500">Opening Balance:</span>
                    <span className="font-mono font-bold">{formatPaiseToInr(selectedSessionDetail.opening_balance)}</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-slate-100 dark:border-slate-800">
                    <span className="text-slate-500">Closing Balance:</span>
                    <span className="font-mono font-bold">{formatPaiseToInr(selectedSessionDetail.closing_balance)}</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-slate-100 dark:border-slate-800">
                    <span className="text-slate-500">Status:</span>
                    <span className="font-bold">{selectedSessionDetail.status}</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-slate-100 dark:border-slate-800">
                    <span className="text-slate-500">Created At:</span>
                    <span>{new Date(selectedSessionDetail.created_at).toLocaleString()}</span>
                  </div>
                  {selectedSessionDetail.completed_at && (
                    <div className="flex justify-between py-1 border-b border-slate-100 dark:border-slate-800">
                      <span className="text-slate-500">Completed At:</span>
                      <span>{new Date(selectedSessionDetail.completed_at).toLocaleString()}</span>
                    </div>
                  )}
                  {selectedSessionDetail.notes && (
                    <div className="pt-2">
                      <span className="text-slate-500 block mb-1">Notes:</span>
                      <p className="p-2 rounded-lg bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-mono">
                        {selectedSessionDetail.notes}
                      </p>
                    </div>
                  )}
                </div>
              ) : (
                <p className="text-slate-400 text-center py-4">No session details available.</p>
              )}
            </div>

            <div className="p-3 bg-slate-50 dark:bg-slate-800/40 border-t border-slate-200 dark:border-slate-800 flex justify-end">
              <button
                type="button"
                onClick={() => setDetailModalOpen(false)}
                className="px-4 py-1.5 text-xs font-semibold bg-[#1D2F5D] text-white rounded-lg hover:bg-[#1D2F5D]/90"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
