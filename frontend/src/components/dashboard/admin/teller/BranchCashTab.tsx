"use client";

import React, { useState, useEffect, useCallback } from "react";
import {
  Wallet,
  Building,
  RefreshCw,
  AlertCircle,
  FileText,
  Clock,
  ArrowDownLeft,
  ArrowUpRight,
  ShieldCheck,
  CheckCircle2,
  X,
  ExternalLink,
  Coins,
  Layers,
  Lock,
  ShieldAlert,
  ArrowRight,
  PlusCircle,
  Check,
  Vault,
  AlertTriangle,
  Send,
  Receipt,
  Truck,
} from "lucide-react";
import type {
  BranchCashSummary,
  BranchCashPositionItem,
  BranchCashReconciliationDetail,
} from "@frontend/lib/services/branch-cash.service";
import { DeliveryHandoverModal } from "./DeliveryHandoverModal";
import { DrawerExpensePaymentModal } from "./DrawerExpensePaymentModal";

export function BranchCashTab() {
  const [summary, setSummary] = useState<BranchCashSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Delivery Handover modal state
  const [handoverBranch, setHandoverBranch] = useState<BranchCashPositionItem | null>(null);

  // Expense Payment modal state
  const [expenseBranch, setExpenseBranch] = useState<BranchCashPositionItem | null>(null);

  // Reconciliation modal state
  const [reconcileBranchId, setReconcileBranchId] = useState<string | null>(null);
  const [reconcileDetail, setReconcileDetail] = useState<BranchCashReconciliationDetail | null>(null);
  const [loadingReconcile, setLoadingReconcile] = useState(false);
  const [reconcileError, setReconcileError] = useState<string | null>(null);

  // Safe Drop modal state
  const [safeDropBranch, setSafeDropBranch] = useState<BranchCashPositionItem | null>(null);
  const [safeDropSessionId, setSafeDropSessionId] = useState("");
  const [safeDropAmount, setSafeDropAmount] = useState("");
  const [safeDropWitnessId, setSafeDropWitnessId] = useState("");
  const [safeDropNarration, setSafeDropNarration] = useState("");
  const [safeDropLoading, setSafeDropLoading] = useState(false);
  const [safeDropMsg, setSafeDropMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Safe to Till modal state
  const [safeToTillBranch, setSafeToTillBranch] = useState<BranchCashPositionItem | null>(null);
  const [safeToTillSessionId, setSafeToTillSessionId] = useState("");
  const [safeToTillAmount, setSafeToTillAmount] = useState("");
  const [safeToTillNarration, setSafeToTillNarration] = useState("");
  const [safeToTillLoading, setSafeToTillLoading] = useState(false);
  const [safeToTillMsg, setSafeToTillMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Petty Cash modal state
  const [pettyCashBranch, setPettyCashBranch] = useState<BranchCashPositionItem | null>(null);
  const [pettyCashRequests, setPettyCashRequests] = useState<any[]>([]);
  const [pettyCashLoading, setPettyCashLoading] = useState(false);
  const [pettyCashTab, setPettyCashTab] = useState<"LIST" | "FUNDING" | "EXPENSE">("LIST");
  const [pettyAmount, setPettyAmount] = useState("");
  const [pettyPurpose, setPettyPurpose] = useState("");
  const [pettyTaxRate, setPettyTaxRate] = useState("0");
  const [pettyReceiptRef, setPettyReceiptRef] = useState("");
  const [pettySubmitting, setPettySubmitting] = useState(false);
  const [pettyMsg, setPettyMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const fetchSummary = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/v1/admin/accounting/branch-cash-position");
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.message || data.error || "Failed to fetch branch cash position.");
      }
      setSummary(data);
    } catch (err: any) {
      setError(err.message || "An error occurred while loading branch cash position.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSummary();
  }, [fetchSummary]);

  const openReconciliation = async (branchId: string) => {
    setReconcileBranchId(branchId);
    setLoadingReconcile(true);
    setReconcileError(null);
    try {
      const res = await fetch(`/api/v1/admin/accounting/branch-cash-position/${branchId}`);
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.message || data.error || "Failed to load branch reconciliation detail.");
      }
      setReconcileDetail(data);
    } catch (err: any) {
      setReconcileError(err.message || "Failed to load branch reconciliation.");
    } finally {
      setLoadingReconcile(false);
    }
  };

  const closeReconciliation = () => {
    setReconcileBranchId(null);
    setReconcileDetail(null);
    setReconcileError(null);
  };

  // Safe Drop open
  const openSafeDrop = (b: BranchCashPositionItem) => {
    setSafeDropBranch(b);
    setSafeDropAmount("");
    setSafeDropWitnessId("");
    setSafeDropNarration("Mid-day safe drop to branch vault");
    setSafeDropMsg(null);
    // Find active sessions if possible
    fetchBranchSessions(b.branch_id);
  };

  const fetchBranchSessions = async (branchId: string) => {
    try {
      const res = await fetch(`/api/v1/admin/accounting/branch-cash-position/${branchId}`);
      const data = await res.json();
      if (data?.active_sessions && data.active_sessions.length > 0) {
        setSafeDropSessionId(data.active_sessions[0].id);
        setSafeToTillSessionId(data.active_sessions[0].id);
      }
    } catch {}
  };

  const handleSafeDropSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!safeDropBranch || !safeDropSessionId || !safeDropAmount || !safeDropWitnessId) {
      setSafeDropMsg({ type: "error", text: "Please complete all required fields." });
      return;
    }
    setSafeDropLoading(true);
    setSafeDropMsg(null);
    try {
      const safeDropId = `SD-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
      const res = await fetch("/api/v1/admin/teller/safe-drop", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          safe_drop_id: safeDropId,
          teller_session_id: safeDropSessionId,
          amount: parseFloat(safeDropAmount),
          witness_user_id: safeDropWitnessId,
          narration: safeDropNarration,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.message || data.error || "Safe drop failed.");
      }
      setSafeDropMsg({
        type: "success",
        text: `Safe drop of ₹${data.amount?.toFixed(2)} completed successfully! Vault custody updated to ₹${data.vault_cash_after?.toFixed(2)}.`,
      });
      fetchSummary();
      setTimeout(() => {
        setSafeDropBranch(null);
      }, 2000);
    } catch (err: any) {
      setSafeDropMsg({ type: "error", text: err.message || "Safe drop failed." });
    } finally {
      setSafeDropLoading(false);
    }
  };

  // Safe to Till Replenishment
  const openSafeToTill = (b: BranchCashPositionItem) => {
    setSafeToTillBranch(b);
    setSafeToTillAmount("");
    setSafeToTillNarration("Till float replenishment from Vault");
    setSafeToTillMsg(null);
    fetchBranchSessions(b.branch_id);
  };

  const handleSafeToTillSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!safeToTillBranch || !safeToTillSessionId || !safeToTillAmount) {
      setSafeToTillMsg({ type: "error", text: "Please complete all required fields." });
      return;
    }
    setSafeToTillLoading(true);
    setSafeToTillMsg(null);
    try {
      const replenishmentId = `STR-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
      const res = await fetch("/api/v1/admin/teller/safe-to-till", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          replenishment_id: replenishmentId,
          teller_session_id: safeToTillSessionId,
          amount: parseFloat(safeToTillAmount),
          narration: safeToTillNarration,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.message || data.error || "Replenishment failed.");
      }
      setSafeToTillMsg({
        type: "success",
        text: `Float replenishment of ₹${data.amount?.toFixed(2)} added to till! Vault custody: ₹${data.vault_cash_after?.toFixed(2)}.`,
      });
      fetchSummary();
      setTimeout(() => {
        setSafeToTillBranch(null);
      }, 2000);
    } catch (err: any) {
      setSafeToTillMsg({ type: "error", text: err.message || "Replenishment failed." });
    } finally {
      setSafeToTillLoading(false);
    }
  };

  // Petty Cash modal
  const openPettyCash = async (b: BranchCashPositionItem) => {
    setPettyCashBranch(b);
    setPettyCashTab("LIST");
    setPettyMsg(null);
    setPettyAmount("");
    setPettyPurpose("");
    fetchPettyCashRequests(b.branch_id);
  };

  const fetchPettyCashRequests = async (branchId: string) => {
    setPettyCashLoading(true);
    try {
      const res = await fetch(`/api/v1/admin/accounting/petty-cash?branch_id=${branchId}`);
      const data = await res.json();
      if (data.success && Array.isArray(data.requests)) {
        setPettyCashRequests(data.requests);
      }
    } catch {}
    finally {
      setPettyCashLoading(false);
    }
  };

  const handleRequestFunding = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pettyCashBranch || !pettyAmount) return;
    setPettySubmitting(true);
    setPettyMsg(null);
    try {
      const res = await fetch("/api/v1/admin/accounting/petty-cash/request-funding", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          branch_id: pettyCashBranch.branch_id,
          amount: parseFloat(pettyAmount),
          purpose: pettyPurpose || "Initial petty cash imprest float establishment",
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.message || data.error || "Request failed.");
      }
      setPettyMsg({ type: "success", text: "Initial funding request submitted successfully (pending Central Finance checker approval)." });
      fetchPettyCashRequests(pettyCashBranch.branch_id);
      setPettyCashTab("LIST");
    } catch (err: any) {
      setPettyMsg({ type: "error", text: err.message || "Failed to submit request." });
    } finally {
      setPettySubmitting(false);
    }
  };

  const handleExpenseClaim = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pettyCashBranch || !pettyAmount || !pettyPurpose) return;
    setPettySubmitting(true);
    setPettyMsg(null);
    try {
      const res = await fetch("/api/v1/admin/accounting/petty-cash/expense-claim", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          branch_id: pettyCashBranch.branch_id,
          amount: parseFloat(pettyAmount),
          purpose: pettyPurpose,
          tax_rate: parseFloat(pettyTaxRate),
          receipt_reference: pettyReceiptRef,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.message || data.error || "Claim failed.");
      }
      setPettyMsg({ type: "success", text: "Expense claim recorded successfully! Awaiting checker review." });
      fetchPettyCashRequests(pettyCashBranch.branch_id);
      setPettyCashTab("LIST");
    } catch (err: any) {
      setPettyMsg({ type: "error", text: err.message || "Failed to record expense claim." });
    } finally {
      setPettySubmitting(false);
    }
  };

  const handleApprovePettyRequest = async (requestId: string) => {
    setPettySubmitting(true);
    try {
      const res = await fetch("/api/v1/admin/accounting/petty-cash/approve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ request_id: requestId, notes: "Approved by Central Finance" }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.message || data.error || "Approval failed.");
      }
      setPettyMsg({ type: "success", text: "Request approved successfully!" });
      if (pettyCashBranch) fetchPettyCashRequests(pettyCashBranch.branch_id);
    } catch (err: any) {
      setPettyMsg({ type: "error", text: err.message || "Approval failed." });
    } finally {
      setPettySubmitting(false);
    }
  };

  const branches = summary?.branches || [];

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-5 rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 shadow-sm">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400">
              <Coins className="w-5 h-5" />
            </div>
            <h2 className="text-lg font-bold text-zinc-900 dark:text-zinc-100">
              Branch Cash Control &amp; Vault Custody (Phase C7.5)
            </h2>
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-100/80 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
              <ShieldCheck className="w-3 h-3" />
              Immutable Ledgers • Fail-Closed Controls
            </span>
          </div>
          <p className="text-xs text-zinc-500 dark:text-zinc-400">
            Real-time reconciliation of GL Cash (1111), Branch Petty Cash (1114), derived Vault Custody, and Active Drawer Custody across branches.
          </p>
        </div>
        <button
          onClick={fetchSummary}
          disabled={loading}
          className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold rounded-xl border border-zinc-200 dark:border-zinc-800 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800/60 disabled:opacity-50 transition"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
          <span>Refresh Position</span>
        </button>
      </div>

      {error && (
        <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 dark:bg-rose-950/40 dark:border-rose-900 dark:text-rose-300 text-xs flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {summary?.unconfigured_warnings && summary.unconfigured_warnings.length > 0 && (
        <div className="p-4 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 dark:bg-amber-950/40 dark:border-amber-900 dark:text-amber-300 text-xs flex items-start gap-2.5">
          <AlertTriangle className="w-4 h-4 shrink-0 text-amber-600 mt-0.5" />
          <div>
            <p className="font-bold">Branch Cash Limits Configuration Notice</p>
            <p className="mt-0.5 text-amber-700 dark:text-amber-400">
              {summary.unconfigured_warnings.length} operating location(s) require cash limit setup in Branch Settings (
              {summary.unconfigured_warnings.map((w) => `${w.branch_name}: missing ${w.missing_limits.join(", ")}`).join("; ")}
              ). Operations remain active with standard monitoring.
            </p>
          </div>
        </div>
      )}

      {/* KPI Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        {/* Total Cash in Hand (GL 1111) */}
        <div className="p-5 rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 shadow-sm space-y-2">
          <div className="flex items-center justify-between text-xs font-medium text-zinc-500 dark:text-zinc-400">
            <span>GL Cash in Hand (1111)</span>
            <Wallet className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
          </div>
          <div className="text-2xl font-bold font-mono text-zinc-900 dark:text-zinc-100">
            ₹{summary ? summary.total_gl_cash_in_hand.toLocaleString("en-IN", { minimumFractionDigits: 2 }) : "0.00"}
          </div>
          <p className="text-[11px] text-zinc-400 dark:text-zinc-500">
            Main branch cash journals
          </p>
        </div>

        {/* Total Petty Cash (GL 1114) */}
        <div className="p-5 rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 shadow-sm space-y-2">
          <div className="flex items-center justify-between text-xs font-medium text-zinc-500 dark:text-zinc-400">
            <span>Branch Petty Cash (1114)</span>
            <Layers className="w-4 h-4 text-amber-600 dark:text-amber-400" />
          </div>
          <div className="text-2xl font-bold font-mono text-zinc-900 dark:text-zinc-100">
            ₹{summary ? summary.total_gl_petty_cash.toLocaleString("en-IN", { minimumFractionDigits: 2 }) : "0.00"}
          </div>
          <p className="text-[11px] text-zinc-400 dark:text-zinc-500">
            Imprest floats (true imprest)
          </p>
        </div>

        {/* Active Drawer Physical Cash */}
        <div className="p-5 rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 shadow-sm space-y-2">
          <div className="flex items-center justify-between text-xs font-medium text-zinc-500 dark:text-zinc-400">
            <span>Active Drawer Custody</span>
            <Building className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
          </div>
          <div className="text-2xl font-bold font-mono text-indigo-600 dark:text-indigo-400">
            ₹{summary ? summary.total_active_drawer_cash.toLocaleString("en-IN", { minimumFractionDigits: 2 }) : "0.00"}
          </div>
          <p className="text-[11px] text-zinc-400 dark:text-zinc-500">
            {summary?.open_sessions_count || 0} active open till session(s)
          </p>
        </div>

        {/* Branch Safe Vault Custody */}
        <div className="p-5 rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 shadow-sm space-y-2">
          <div className="flex items-center justify-between text-xs font-medium text-zinc-500 dark:text-zinc-400">
            <span>Branch Vault Custody</span>
            <Vault className="w-4 h-4 text-violet-600 dark:text-violet-400" />
          </div>
          <div className="text-2xl font-bold font-mono text-violet-600 dark:text-violet-400">
            ₹{summary ? (summary.total_vault_cash || 0).toLocaleString("en-IN", { minimumFractionDigits: 2 }) : "0.00"}
          </div>
          <p className="text-[11px] text-zinc-400 dark:text-zinc-500">
            Derived from immutable movements
          </p>
        </div>

        {/* Total Physical Cash */}
        <div className="p-5 rounded-2xl bg-gradient-to-br from-emerald-600 to-teal-700 text-white shadow-sm space-y-2">
          <div className="flex items-center justify-between text-xs font-medium text-emerald-100">
            <span>Total Physical Cash</span>
            <ShieldCheck className="w-4 h-4 text-white" />
          </div>
          <div className="text-2xl font-bold font-mono">
            ₹{summary ? (summary.total_physical_cash || 0).toLocaleString("en-IN", { minimumFractionDigits: 2 }) : "0.00"}
          </div>
          <p className="text-[11px] text-emerald-200">
            Drawer + Vault across {summary?.branches_count || 0} branches
          </p>
        </div>
      </div>

      {/* Authoritative Branch Cash Table */}
      <div className="rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between bg-zinc-50/50 dark:bg-zinc-900/60">
          <div>
            <h3 className="text-sm font-bold text-zinc-900 dark:text-zinc-100">
              Branch Cash &amp; Vault Breakdown
            </h3>
            <p className="text-xs text-zinc-500 dark:text-zinc-400">
              Operating locations with derived custody, relative limits (100% warning, 140% critical tender block), and fail-safe reconciliation.
            </p>
          </div>
          <span className="text-xs text-zinc-400">
            As of: {summary?.as_of_date ? new Date(summary.as_of_date).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" }) : "Live"}
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/40 text-zinc-500 dark:text-zinc-400 font-semibold uppercase tracking-wider text-[11px]">
                <th className="py-3.5 px-6">Branch</th>
                <th className="py-3.5 px-3 text-right">GL 1111</th>
                <th className="py-3.5 px-3 text-right">GL 1114</th>
                <th className="py-3.5 px-3 text-right">Drawer</th>
                <th className="py-3.5 px-3 text-right">Vault</th>
                <th className="py-3.5 px-3 text-right font-bold text-zinc-900 dark:text-zinc-100">Physical Cash</th>
                <th className="py-3.5 px-3 text-center">Threshold</th>
                <th className="py-3.5 px-3 text-center">Reconciliation</th>
                <th className="py-3.5 px-6 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
              {loading && branches.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-zinc-400">
                    <RefreshCw className="w-5 h-5 mx-auto mb-2 animate-spin text-zinc-400" />
                    Loading authoritative branch cash positions...
                  </td>
                </tr>
              ) : branches.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-8 text-center text-zinc-400">
                    No operating branches found.
                  </td>
                </tr>
              ) : (
                branches.map((b) => (
                  <tr
                    key={b.branch_id}
                    className="hover:bg-zinc-50/70 dark:hover:bg-zinc-800/40 transition"
                  >
                    <td className="py-3.5 px-6">
                      <div className="font-semibold text-zinc-900 dark:text-zinc-100">
                        {b.branch_name}
                      </div>
                      <div className="text-[11px] font-mono text-zinc-400">
                        Limit: ₹{b.max_drawer_cash_limit?.toLocaleString("en-IN") || "—"} • Imprest: ₹{b.petty_cash_imprest_limit?.toLocaleString("en-IN") || "—"}
                      </div>
                    </td>
                    <td className="py-3.5 px-3 text-right font-mono font-medium text-zinc-700 dark:text-zinc-300">
                      ₹{b.gl_cash_in_hand.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                    </td>
                    <td className="py-3.5 px-3 text-right font-mono text-zinc-600 dark:text-zinc-400">
                      ₹{b.gl_petty_cash.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                    </td>
                    <td className="py-3.5 px-3 text-right font-mono font-semibold text-indigo-600 dark:text-indigo-400">
                      ₹{b.active_drawer_cash.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                    </td>
                    <td className="py-3.5 px-3 text-right font-mono font-semibold text-violet-600 dark:text-violet-400">
                      ₹{(b.vault_cash || 0).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                    </td>
                    <td className="py-3.5 px-3 text-right font-mono font-bold text-emerald-600 dark:text-emerald-400 text-sm">
                      ₹{(b.total_physical_cash || 0).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                    </td>
                    <td className="py-3.5 px-3 text-center">
                      {b.drawer_threshold_status === "CRITICAL" ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300 border border-rose-300">
                          <span className="w-1.5 h-1.5 rounded-full bg-rose-600 animate-ping" />
                          CRITICAL (140%+) • CASH BLOCKED
                        </span>
                      ) : b.drawer_threshold_status === "WARNING" ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300 border border-amber-300">
                          WARNING (100%+)
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-200">
                          NORMAL
                        </span>
                      )}
                    </td>
                    <td className="py-3.5 px-3 text-center">
                      {b.reconciliation_status === "VARIANCE_DETECTED" ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-rose-50 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300 border border-rose-200">
                          <AlertTriangle className="w-3 h-3 text-rose-600" />
                          Variance: ₹{Math.abs(b.variance || 0).toFixed(2)}
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-200">
                          <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                          Reconciled
                        </span>
                      )}
                    </td>
                    <td className="py-3.5 px-6 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => setHandoverBranch(b)}
                          className="px-2 py-1 text-[11px] font-semibold text-blue-700 dark:text-blue-300 bg-blue-50 dark:bg-blue-950/60 hover:bg-blue-100 dark:hover:bg-blue-900/60 rounded-lg transition"
                          title="Acknowledge Delivery Partner Physical Handover"
                        >
                          Collections
                        </button>
                        <button
                          onClick={() => setExpenseBranch(b)}
                          className="px-2 py-1 text-[11px] font-semibold text-rose-700 dark:text-rose-300 bg-rose-50 dark:bg-rose-950/60 hover:bg-rose-100 dark:hover:bg-rose-900/60 rounded-lg transition"
                          title="Disburse Branch Cash Expense"
                        >
                          Expenses
                        </button>
                        <button
                          onClick={() => openSafeDrop(b)}
                          className="px-2 py-1 text-[11px] font-semibold text-indigo-700 dark:text-indigo-300 bg-indigo-50 dark:bg-indigo-950/60 hover:bg-indigo-100 dark:hover:bg-indigo-900/60 rounded-lg transition"
                          title="Mid-day Safe Drop (Till -> Vault)"
                        >
                          Safe Drop
                        </button>
                        <button
                          onClick={() => openSafeToTill(b)}
                          className="px-2 py-1 text-[11px] font-semibold text-violet-700 dark:text-violet-300 bg-violet-50 dark:bg-violet-950/60 hover:bg-violet-100 dark:hover:bg-violet-900/60 rounded-lg transition"
                          title="Float Replenishment (Vault -> Till)"
                        >
                          Safe → Till
                        </button>
                        <button
                          onClick={() => openPettyCash(b)}
                          className="px-2 py-1 text-[11px] font-semibold text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/60 hover:bg-amber-100 dark:hover:bg-amber-900/60 rounded-lg transition"
                          title="Petty Cash Imprest Management"
                        >
                          Petty Cash
                        </button>
                        <button
                          onClick={() => openReconciliation(b.branch_id)}
                          className="inline-flex items-center gap-1 px-2 py-1 text-[11px] font-semibold text-zinc-700 dark:text-zinc-300 hover:text-emerald-600 dark:hover:text-emerald-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg transition"
                          title="Detailed GL & Custody Audit Drilldown"
                        >
                          <ExternalLink className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
            {/* Total Row */}
            {summary && (
              <tfoot>
                <tr className="border-t-2 border-zinc-300 dark:border-zinc-700 bg-zinc-100/70 dark:bg-zinc-800/60 font-bold text-zinc-900 dark:text-zinc-100 text-xs">
                  <td className="py-4 px-6 uppercase tracking-wider font-extrabold">
                    Company-Wide Total
                  </td>
                  <td className="py-4 px-3 text-right font-mono font-bold">
                    ₹{summary.total_gl_cash_in_hand.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                  </td>
                  <td className="py-4 px-3 text-right font-mono font-bold">
                    ₹{summary.total_gl_petty_cash.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                  </td>
                  <td className="py-4 px-3 text-right font-mono font-extrabold text-indigo-600 dark:text-indigo-400">
                    ₹{summary.total_active_drawer_cash.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                  </td>
                  <td className="py-4 px-3 text-right font-mono font-extrabold text-violet-600 dark:text-violet-400">
                    ₹{(summary.total_vault_cash || 0).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                  </td>
                  <td className="py-4 px-3 text-right font-mono font-extrabold text-emerald-700 dark:text-emerald-300 text-sm">
                    ₹{(summary.total_physical_cash || 0).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                  </td>
                  <td className="py-4 px-3 text-center">
                    {summary.open_sessions_count} Active Tills
                  </td>
                  <td className="py-4 px-3 text-center">
                    <span className="inline-flex items-center gap-1 text-[11px] text-emerald-600 dark:text-emerald-400 font-bold">
                      <ShieldCheck className="w-3.5 h-3.5" />
                      Audited
                    </span>
                  </td>
                  <td className="py-4 px-6 text-right text-zinc-400 text-[11px]">
                    {summary.branches_count} Branches
                  </td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>

      {/* Safe Drop Modal */}
      {safeDropBranch && (
        <div role="dialog" aria-modal="true" className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="relative w-full max-w-lg bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl shadow-2xl flex flex-col overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/60">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-xl bg-indigo-50 text-indigo-600 dark:bg-indigo-950/60 dark:text-indigo-400">
                  <ArrowDownLeft className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-zinc-900 dark:text-zinc-100">
                    Mid-Day Safe Drop: Till → Safe
                  </h3>
                  <p className="text-xs text-zinc-500">{safeDropBranch.branch_name}</p>
                </div>
              </div>
              <button onClick={() => setSafeDropBranch(null)} className="p-1.5 rounded-lg text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleSafeDropSubmit} className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-3 p-3 rounded-xl bg-zinc-50 dark:bg-zinc-800/40 text-xs">
                <div>
                  <span className="text-zinc-500">Available Drawer Cash:</span>
                  <div className="font-mono font-bold text-indigo-600 text-sm">₹{safeDropBranch.active_drawer_cash.toFixed(2)}</div>
                </div>
                <div>
                  <span className="text-zinc-500">Current Safe Custody:</span>
                  <div className="font-mono font-bold text-violet-600 text-sm">₹{(safeDropBranch.vault_cash || 0).toFixed(2)}</div>
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1">Teller Session ID *</label>
                <input
                  type="text"
                  required
                  value={safeDropSessionId}
                  onChange={(e) => setSafeDropSessionId(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-zinc-200 dark:border-zinc-800 bg-transparent"
                  placeholder="UUID of OPEN teller session"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1">Safe Drop Amount (₹) *</label>
                <input
                  type="number"
                  step="0.01"
                  required
                  min="0.01"
                  max={safeDropBranch.active_drawer_cash}
                  value={safeDropAmount}
                  onChange={(e) => setSafeDropAmount(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-zinc-200 dark:border-zinc-800 bg-transparent font-mono font-bold"
                  placeholder="Amount to drop into safe"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                  Authenticated Witness Staff ID * <span className="text-[10px] text-zinc-400">(Actor != Witness)</span>
                </label>
                <input
                  type="text"
                  required
                  value={safeDropWitnessId}
                  onChange={(e) => setSafeDropWitnessId(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-zinc-200 dark:border-zinc-800 bg-transparent"
                  placeholder="Staff User ID of supervisory witness"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1">Narration / Reason</label>
                <input
                  type="text"
                  value={safeDropNarration}
                  onChange={(e) => setSafeDropNarration(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-zinc-200 dark:border-zinc-800 bg-transparent"
                />
              </div>
              {safeDropMsg && (
                <div className={`p-3 rounded-xl text-xs flex items-center gap-2 ${safeDropMsg.type === "success" ? "bg-emerald-50 text-emerald-800 border border-emerald-200" : "bg-rose-50 text-rose-800 border border-rose-200"}`}>
                  {safeDropMsg.type === "success" ? <CheckCircle2 className="w-4 h-4 shrink-0" /> : <AlertCircle className="w-4 h-4 shrink-0" />}
                  <span>{safeDropMsg.text}</span>
                </div>
              )}
              <div className="flex items-center justify-end gap-2 pt-2 border-t border-zinc-200 dark:border-zinc-800">
                <button type="button" onClick={() => setSafeDropBranch(null)} className="px-4 py-2 text-xs font-semibold rounded-xl bg-zinc-100 hover:bg-zinc-200 text-zinc-700">Cancel</button>
                <button type="submit" disabled={safeDropLoading} className="px-4 py-2 text-xs font-semibold rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white disabled:opacity-50 flex items-center gap-1.5">
                  {safeDropLoading && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
                  <span>Execute Safe Drop</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Safe to Till Float Replenishment Modal */}
      {safeToTillBranch && (
        <div role="dialog" aria-modal="true" className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="relative w-full max-w-lg bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl shadow-2xl flex flex-col overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/60">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-xl bg-violet-50 text-violet-600 dark:bg-violet-950/60 dark:text-violet-400">
                  <ArrowUpRight className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-zinc-900 dark:text-zinc-100">
                    Till Float Replenishment: Safe → Till
                  </h3>
                  <p className="text-xs text-zinc-500">{safeToTillBranch.branch_name}</p>
                </div>
              </div>
              <button onClick={() => setSafeToTillBranch(null)} className="p-1.5 rounded-lg text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleSafeToTillSubmit} className="p-6 space-y-4">
              <div className="p-3 rounded-xl bg-zinc-50 dark:bg-zinc-800/40 text-xs">
                <span className="text-zinc-500">Available Safe Custody:</span>
                <div className="font-mono font-bold text-violet-600 text-base">₹{(safeToTillBranch.vault_cash || 0).toFixed(2)}</div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1">Teller Session ID *</label>
                <input
                  type="text"
                  required
                  value={safeToTillSessionId}
                  onChange={(e) => setSafeToTillSessionId(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-zinc-200 dark:border-zinc-800 bg-transparent"
                  placeholder="UUID of OPEN teller session"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1">Replenishment Amount (₹) *</label>
                <input
                  type="number"
                  step="0.01"
                  required
                  min="0.01"
                  max={safeToTillBranch.vault_cash || 0}
                  value={safeToTillAmount}
                  onChange={(e) => setSafeToTillAmount(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-zinc-200 dark:border-zinc-800 bg-transparent font-mono font-bold"
                  placeholder="Amount to move from safe to till"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1">Narration</label>
                <input
                  type="text"
                  value={safeToTillNarration}
                  onChange={(e) => setSafeToTillNarration(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-zinc-200 dark:border-zinc-800 bg-transparent"
                />
              </div>
              {safeToTillMsg && (
                <div className={`p-3 rounded-xl text-xs flex items-center gap-2 ${safeToTillMsg.type === "success" ? "bg-emerald-50 text-emerald-800 border border-emerald-200" : "bg-rose-50 text-rose-800 border border-rose-200"}`}>
                  {safeToTillMsg.type === "success" ? <CheckCircle2 className="w-4 h-4 shrink-0" /> : <AlertCircle className="w-4 h-4 shrink-0" />}
                  <span>{safeToTillMsg.text}</span>
                </div>
              )}
              <div className="flex items-center justify-end gap-2 pt-2 border-t border-zinc-200 dark:border-zinc-800">
                <button type="button" onClick={() => setSafeToTillBranch(null)} className="px-4 py-2 text-xs font-semibold rounded-xl bg-zinc-100 hover:bg-zinc-200 text-zinc-700">Cancel</button>
                <button type="submit" disabled={safeToTillLoading} className="px-4 py-2 text-xs font-semibold rounded-xl bg-violet-600 hover:bg-violet-700 text-white disabled:opacity-50 flex items-center gap-1.5">
                  {safeToTillLoading && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
                  <span>Replenish Float</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Petty Cash Modal */}
      {pettyCashBranch && (
        <div role="dialog" aria-modal="true" className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="relative w-full max-w-3xl max-h-[90vh] bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl shadow-2xl flex flex-col overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/60">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-xl bg-amber-50 text-amber-600 dark:bg-amber-950/60 dark:text-amber-400">
                  <Receipt className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-zinc-900 dark:text-zinc-100">
                    Petty Cash Imprest Management (True Imprest)
                  </h3>
                  <p className="text-xs text-zinc-500">
                    {pettyCashBranch.branch_name} • Ceiling: ₹{pettyCashBranch.petty_cash_imprest_limit?.toLocaleString("en-IN") || "—"} • GL 1114: ₹{pettyCashBranch.gl_petty_cash.toFixed(2)}
                  </p>
                </div>
              </div>
              <button onClick={() => setPettyCashBranch(null)} className="p-1.5 rounded-lg text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Navigation Tabs */}
            <div className="flex border-b border-zinc-200 dark:border-zinc-800 px-6 gap-4 text-xs font-semibold">
              <button
                onClick={() => setPettyCashTab("LIST")}
                className={`py-3 border-b-2 transition ${pettyCashTab === "LIST" ? "border-amber-600 text-amber-600 dark:text-amber-400" : "border-transparent text-zinc-500 hover:text-zinc-900"}`}
              >
                Requests &amp; Claims ({pettyCashRequests.length})
              </button>
              <button
                onClick={() => setPettyCashTab("FUNDING")}
                className={`py-3 border-b-2 transition ${pettyCashTab === "FUNDING" ? "border-amber-600 text-amber-600 dark:text-amber-400" : "border-transparent text-zinc-500 hover:text-zinc-900"}`}
              >
                + Request Initial Float
              </button>
              <button
                onClick={() => setPettyCashTab("EXPENSE")}
                className={`py-3 border-b-2 transition ${pettyCashTab === "EXPENSE" ? "border-amber-600 text-amber-600 dark:text-amber-400" : "border-transparent text-zinc-500 hover:text-zinc-900"}`}
              >
                + Record Expense Claim
              </button>
            </div>

            <div className="p-6 overflow-y-auto space-y-4">
              {pettyMsg && (
                <div className={`p-3 rounded-xl text-xs flex items-center gap-2 ${pettyMsg.type === "success" ? "bg-emerald-50 text-emerald-800 border border-emerald-200" : "bg-rose-50 text-rose-800 border border-rose-200"}`}>
                  {pettyMsg.type === "success" ? <CheckCircle2 className="w-4 h-4 shrink-0" /> : <AlertCircle className="w-4 h-4 shrink-0" />}
                  <span>{pettyMsg.text}</span>
                </div>
              )}

              {pettyCashTab === "LIST" ? (
                <div>
                  {pettyCashLoading ? (
                    <div className="py-8 text-center text-zinc-400 text-xs">
                      <RefreshCw className="w-5 h-5 mx-auto mb-2 animate-spin" />
                      Loading petty cash requests...
                    </div>
                  ) : pettyCashRequests.length === 0 ? (
                    <div className="py-8 text-center text-zinc-400 text-xs">
                      No petty cash requests found for this branch.
                    </div>
                  ) : (
                    <div className="border border-zinc-200 dark:border-zinc-800 rounded-xl overflow-hidden">
                      <table className="w-full text-left text-xs">
                        <thead className="bg-zinc-50 dark:bg-zinc-900/40 border-b border-zinc-200 dark:border-zinc-800 text-zinc-500 uppercase text-[10px]">
                          <tr>
                            <th className="py-2.5 px-3">Req #</th>
                            <th className="py-2.5 px-3">Type</th>
                            <th className="py-2.5 px-3">Purpose</th>
                            <th className="py-2.5 px-3 text-right">Amount</th>
                            <th className="py-2.5 px-3 text-center">Status</th>
                            <th className="py-2.5 px-3 text-right">Action</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
                          {pettyCashRequests.map((r) => (
                            <tr key={r.id}>
                              <td className="py-2.5 px-3 font-mono font-bold text-zinc-900 dark:text-zinc-100">{r.request_number}</td>
                              <td className="py-2.5 px-3">{r.request_type}</td>
                              <td className="py-2.5 px-3 text-zinc-600 dark:text-zinc-400">{r.purpose}</td>
                              <td className="py-2.5 px-3 text-right font-mono font-bold">₹{Number(r.amount).toFixed(2)}</td>
                              <td className="py-2.5 px-3 text-center">
                                <span className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold ${r.status === "DISBURSED" ? "bg-emerald-50 text-emerald-700" : r.status === "APPROVED" ? "bg-indigo-50 text-indigo-700" : "bg-amber-50 text-amber-700"}`}>
                                  {r.status}
                                </span>
                              </td>
                              <td className="py-2.5 px-3 text-right">
                                {r.status === "SUBMITTED" && (
                                  <button
                                    onClick={() => handleApprovePettyRequest(r.id)}
                                    disabled={pettySubmitting}
                                    className="px-2 py-1 text-[10px] font-bold rounded bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-50"
                                  >
                                    Approve
                                  </button>
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              ) : pettyCashTab === "FUNDING" ? (
                <form onSubmit={handleRequestFunding} className="space-y-4 max-w-md mx-auto">
                  <div>
                    <label className="block text-xs font-semibold mb-1">Requested Float Amount (₹) *</label>
                    <input
                      type="number"
                      step="0.01"
                      required
                      min="1"
                      max={pettyCashBranch.petty_cash_imprest_limit}
                      value={pettyAmount}
                      onChange={(e) => setPettyAmount(e.target.value)}
                      className="w-full px-3 py-2 text-xs rounded-xl border border-zinc-200 dark:border-zinc-800 bg-transparent font-mono font-bold"
                      placeholder={`Max ₹${pettyCashBranch.petty_cash_imprest_limit}`}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold mb-1">Purpose</label>
                    <input
                      type="text"
                      value={pettyPurpose}
                      onChange={(e) => setPettyPurpose(e.target.value)}
                      className="w-full px-3 py-2 text-xs rounded-xl border border-zinc-200 dark:border-zinc-800 bg-transparent"
                      placeholder="Establish branch petty cash float"
                    />
                  </div>
                  <div className="flex justify-end gap-2 pt-2">
                    <button type="button" onClick={() => setPettyCashTab("LIST")} className="px-4 py-2 text-xs rounded-xl bg-zinc-100">Cancel</button>
                    <button type="submit" disabled={pettySubmitting} className="px-4 py-2 text-xs rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-semibold">
                      Submit Request
                    </button>
                  </div>
                </form>
              ) : (
                <form onSubmit={handleExpenseClaim} className="space-y-4 max-w-md mx-auto">
                  <div>
                    <label className="block text-xs font-semibold mb-1">Expense Amount (₹) *</label>
                    <input
                      type="number"
                      step="0.01"
                      required
                      min="1"
                      value={pettyAmount}
                      onChange={(e) => setPettyAmount(e.target.value)}
                      className="w-full px-3 py-2 text-xs rounded-xl border border-zinc-200 dark:border-zinc-800 bg-transparent font-mono font-bold"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold mb-1">Purpose / Details *</label>
                    <input
                      type="text"
                      required
                      value={pettyPurpose}
                      onChange={(e) => setPettyPurpose(e.target.value)}
                      className="w-full px-3 py-2 text-xs rounded-xl border border-zinc-200 dark:border-zinc-800 bg-transparent"
                      placeholder="Local delivery supplies, cleaning items, etc."
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold mb-1">Eligible GST Rate (%)</label>
                    <select
                      value={pettyTaxRate}
                      onChange={(e) => setPettyTaxRate(e.target.value)}
                      className="w-full px-3 py-2 text-xs rounded-xl border border-zinc-200 dark:border-zinc-800 bg-transparent"
                    >
                      <option value="0">0% (Nil / Exempt)</option>
                      <option value="5">5% (2.5% CGST / 2.5% SGST)</option>
                      <option value="12">12% (6% CGST / 6% SGST)</option>
                      <option value="18">18% (9% CGST / 9% SGST)</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold mb-1">Receipt / Bill Reference</label>
                    <input
                      type="text"
                      value={pettyReceiptRef}
                      onChange={(e) => setPettyReceiptRef(e.target.value)}
                      className="w-full px-3 py-2 text-xs rounded-xl border border-zinc-200 dark:border-zinc-800 bg-transparent"
                      placeholder="Invoice / Cash Memo Number"
                    />
                  </div>
                  <div className="flex justify-end gap-2 pt-2">
                    <button type="button" onClick={() => setPettyCashTab("LIST")} className="px-4 py-2 text-xs rounded-xl bg-zinc-100">Cancel</button>
                    <button type="submit" disabled={pettySubmitting} className="px-4 py-2 text-xs rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-semibold">
                      Record Claim
                    </button>
                  </div>
                </form>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Drill-Down Reconciliation Modal */}
      {reconcileBranchId && (
        <div role="dialog" aria-modal="true" className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="relative w-full max-w-3xl max-h-[90vh] bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl shadow-2xl flex flex-col overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/60">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-indigo-50 text-indigo-600 dark:bg-indigo-950/60 dark:text-indigo-400">
                  <Building className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-zinc-900 dark:text-zinc-100">
                    {reconcileDetail?.branch_name ? `${reconcileDetail.branch_name} — Cash Reconciliation` : "Branch Cash Reconciliation"}
                  </h3>
                  <p className="text-xs text-zinc-500 font-mono">
                    Branch ID: {reconcileBranchId}
                  </p>
                </div>
              </div>
              <button
                onClick={closeReconciliation}
                className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 overflow-y-auto space-y-6">
              {loadingReconcile ? (
                <div className="py-12 text-center text-zinc-400">
                  <RefreshCw className="w-6 h-6 mx-auto mb-2 animate-spin" />
                  Loading branch reconciliation data...
                </div>
              ) : reconcileError ? (
                <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs">
                  {reconcileError}
                </div>
              ) : reconcileDetail ? (
                <>
                  {/* Detailed GL vs Physical Balance Grid */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <div className="p-3.5 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-800/40">
                      <span className="text-[11px] text-zinc-500">GL Cash in Hand (1111):</span>
                      <div className="text-base font-bold font-mono text-zinc-900 dark:text-zinc-100 mt-1">
                        ₹{reconcileDetail.gl_cash_in_hand.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                      </div>
                    </div>
                    <div className="p-3.5 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-800/40">
                      <span className="text-[11px] text-zinc-500">Active Drawer Custody:</span>
                      <div className="text-base font-bold font-mono text-indigo-600 dark:text-indigo-400 mt-1">
                        ₹{reconcileDetail.active_drawer_cash.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                      </div>
                    </div>
                    <div className="p-3.5 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-800/40">
                      <span className="text-[11px] text-zinc-500">Vault Custody:</span>
                      <div className="text-base font-bold font-mono text-violet-600 dark:text-violet-400 mt-1">
                        ₹{(reconcileDetail.vault_cash || 0).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                      </div>
                    </div>
                    <div className="p-3.5 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-800/40">
                      <span className="text-[11px] text-zinc-500">Total Physical Cash:</span>
                      <div className="text-base font-bold font-mono text-emerald-600 dark:text-emerald-400 mt-1">
                        ₹{(reconcileDetail.total_physical_cash || 0).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                      </div>
                    </div>
                  </div>

                  {/* Reconciliation Status Alert */}
                  {reconcileDetail.reconciliation_status === "VARIANCE_DETECTED" ? (
                    <div className="p-4 rounded-xl bg-amber-50 border border-amber-300 text-amber-900 text-xs space-y-1">
                      <div className="flex items-center gap-2 font-bold text-amber-800">
                        <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                        <span>RECONCILIATION VARIANCE DETECTED: ₹{Math.abs(reconcileDetail.variance).toFixed(2)}</span>
                      </div>
                      <p>
                        GL 1111 differs from physical custody (Drawer + Vault). ERP requires operational audit investigation. 
                        <strong> Under Phase C7.5 non-negotiable rules, no automatic plug or journal entry to 5296 is created.</strong>
                      </p>
                    </div>
                  ) : (
                    <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                      <span>GL Cash 1111 perfectly matches physical drawer + vault custody. Zero variance detected.</span>
                    </div>
                  )}

                  {/* Threshold Info */}
                  <div className="p-3.5 rounded-xl bg-zinc-50 dark:bg-zinc-800/40 border border-zinc-200 dark:border-zinc-800 text-xs space-y-1">
                    <div className="flex items-center justify-between font-semibold">
                      <span>Drawer Cash Thresholds</span>
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${reconcileDetail.is_cash_tender_blocked ? "bg-rose-100 text-rose-800" : "bg-emerald-100 text-emerald-800"}`}>
                        {reconcileDetail.is_cash_tender_blocked ? "CASH TENDER BLOCKED" : "CASH TENDER PERMITTED"}
                      </span>
                    </div>
                    <div className="text-[11px] text-zinc-500 grid grid-cols-3 gap-2 pt-1 font-mono">
                      <div>Limit: ₹{reconcileDetail.max_drawer_cash_limit.toLocaleString("en-IN")}</div>
                      <div>Warning (100%): ₹{reconcileDetail.warning_threshold.toLocaleString("en-IN")}</div>
                      <div>Critical (140%): ₹{reconcileDetail.critical_threshold.toLocaleString("en-IN")}</div>
                    </div>
                  </div>

                  {/* Active Till Sessions */}
                  <div className="space-y-3">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-zinc-600 dark:text-zinc-400 flex items-center gap-1.5">
                      <Wallet className="w-4 h-4 text-indigo-600" />
                      Active Till Sessions ({reconcileDetail.active_sessions.length})
                    </h4>
                    {reconcileDetail.active_sessions.length === 0 ? (
                      <p className="text-xs text-zinc-400 italic">No open till sessions active at this branch.</p>
                    ) : (
                      <div className="border border-zinc-200 dark:border-zinc-800 rounded-xl overflow-hidden">
                        <table className="w-full text-left text-xs">
                          <thead className="bg-zinc-50 dark:bg-zinc-900/40 border-b border-zinc-200 dark:border-zinc-800 text-zinc-500">
                            <tr>
                              <th className="py-2.5 px-3">Session / Till</th>
                              <th className="py-2.5 px-3 text-right">Opening Float</th>
                              <th className="py-2.5 px-3 text-right">Inflows</th>
                              <th className="py-2.5 px-3 text-right">Outflows</th>
                              <th className="py-2.5 px-3 text-right font-bold">Expected Physical Cash</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
                            {reconcileDetail.active_sessions.map((s) => (
                              <tr key={s.id}>
                                <td className="py-2.5 px-3">
                                  <div className="font-semibold">{s.teller_name || s.teller_id}</div>
                                  <div className="font-mono text-[10px] text-zinc-400">ID: {s.id.substring(0, 8)}</div>
                                </td>
                                <td className="py-2.5 px-3 text-right font-mono">
                                  ₹{s.opening_float.toFixed(2)}
                                </td>
                                <td className="py-2.5 px-3 text-right font-mono text-emerald-600">
                                  +₹{s.inflows.toFixed(2)}
                                </td>
                                <td className="py-2.5 px-3 text-right font-mono text-rose-600">
                                  -₹{s.outflows.toFixed(2)}
                                </td>
                                <td className="py-2.5 px-3 text-right font-mono font-bold text-indigo-600">
                                  ₹{s.expected_cash.toFixed(2)}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                </>
              ) : null}
            </div>

            <div className="flex items-center justify-end px-6 py-3 border-t border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/60">
              <button
                onClick={closeReconciliation}
                className="px-4 py-2 text-xs font-semibold rounded-xl bg-zinc-200 hover:bg-zinc-300 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-800 dark:text-zinc-200 transition"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delivery Boy Collections & Handover Modal */}
      {handoverBranch && (
        <DeliveryHandoverModal
          isOpen={Boolean(handoverBranch)}
          onClose={() => setHandoverBranch(null)}
          branchId={handoverBranch.branch_id}
          branchName={handoverBranch.branch_name}
          onHandoverAcknowledged={() => {
            fetchSummary();
          }}
        />
      )}

      {/* Branch Cash Expenses Modal */}
      {expenseBranch && (
        <DrawerExpensePaymentModal
          isOpen={Boolean(expenseBranch)}
          onClose={() => setExpenseBranch(null)}
          branchId={expenseBranch.branch_id}
          branchName={expenseBranch.branch_name}
          availableDrawerCash={expenseBranch.total_physical_cash || expenseBranch.gl_cash_in_hand}
          onExpensePaid={() => {
            fetchSummary();
          }}
        />
      )}
    </div>
  );
}
