"use client";

/**
 * CakeToHome ERP — Central Accounting Work Queue Panel
 * Phase 5A.6 Substep 5.4 Module C: Central Financial Authority Work Queue
 *
 * ARCHITECTURAL INVARIANTS:
 * 1. DISTRIBUTED OPERATIONS, CENTRALIZED FINANCIAL AUTHORITY:
 *    - Branch managers create operational claims and receipts.
 *    - Central accounting executes the review, validation, approval, and GL posting.
 * 2. STRICT 3-TIER SEGREGATION OF DUTIES (SoD):
 *    - PREPARER != APPROVER != POSTER.
 *    - Enforced on backend and highlighted visually in the UI.
 * 3. AUTHORITATIVE CHART OF ACCOUNTS (CoA):
 *    - Inventory: 1131 (Accessories), 1132 (Cakes), 1133 (Packaging).
 *    - AP Control: 2111 Accounts Payable.
 *    - Cash in Transit: 1118 Deposit in Transit, 1111 Cash in Hand.
 *    - Gateway Clearing: 1113 Gateway Clearing, 1112 Operating Bank Account, 5290 Gateway Charges.
 */

import React, { useState, useEffect, useCallback, useMemo } from "react";
import {
  ClipboardCheck,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  RefreshCw,
  Search,
  Filter,
  DollarSign,
  Building2,
  Landmark,
  ShoppingBag,
  Receipt,
  Layers,
  ArrowRight,
  ShieldAlert,
  ShieldCheck,
  UserCheck,
  Clock,
  Eye,
  Send,
  FileText,
  ChevronRight,
  X,
  CreditCard,
  Lock,
  FileCheck,
  RotateCcw,
} from "lucide-react";
import {
  fetchWorkQueueSummary,
  fetchPurchasesForQueue,
  fetchExpensesForQueue,
  fetchDepositSlipsForQueue,
  fetchGatewayBatchesForQueue,
  fetchSalesForQueue,
  previewPurchaseVoucher,
  approvePurchase,
  postPurchaseToGL,
  approveExpense,
  postExpenseToGL,
  returnExpenseToDraft,
  fetchExpenseAccounting,
  reverseExpense,
  approveBankDeposit,
  postBankDepositToGL,
  rejectBankDeposit,
  approveGatewayBatch,
  postGatewayBatchToGL,
  cancelGatewayBatch,
  approveSalesVoucher,
  postSalesVoucherToGL,
  type WorkQueueSummary,
  type PurchaseQueueItem,
  type ExpenseQueueItem,
  type DepositSlipQueueItem,
  type GatewayBatchQueueItem,
  type SalesQueueItem,
} from "@frontend/lib/data/accounting-work-queue";

type QueueStream = "purchases" | "expenses" | "deposits" | "gateways" | "sales";

export default function AccountingWorkQueuePanel() {
  const [activeStream, setActiveStream] = useState<QueueStream>("purchases");
  const [summary, setSummary] = useState<WorkQueueSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");

  // Stream data
  const [purchases, setPurchases] = useState<PurchaseQueueItem[]>([]);
  const [expenses, setExpenses] = useState<ExpenseQueueItem[]>([]);
  const [deposits, setDeposits] = useState<DepositSlipQueueItem[]>([]);
  const [gateways, setGateways] = useState<GatewayBatchQueueItem[]>([]);
  const [sales, setSales] = useState<SalesQueueItem[]>([]);

  // Simulation persona context for testing SoD compliance
  const [simulatedActor, setSimulatedActor] = useState({
    id: "admin_01",
    role: "SUPER_ADMIN",
    title: "Super Admin / Financial Controller",
  });

  // Modal states
  const [previewVoucherData, setPreviewVoucherData] = useState<any | null>(null);
  const [rejectModalData, setRejectModalData] = useState<{ id: string; type: "deposit" | "gateway" } | null>(null);
  const [rejectionReason, setRejectionReason] = useState("");

  // Expense Reversal Modal state
  const [expenseReversalModal, setExpenseReversalModal] = useState<{
    id: string;
    description: string;
    total: number;
    payment_method: string;
    created_by: string;
    approved_by?: string | null;
  } | null>(null);
  const [expenseReversalReason, setExpenseReversalReason] = useState("");
  const [cashReturnDest, setCashReturnDest] = useState<"TELLER_DRAWER" | "PETTY_CASH">("PETTY_CASH");

  const showSuccess = (msg: string) => {
    setSuccess(msg);
    setTimeout(() => setSuccess(null), 4000);
  };
  const showError = (msg: string) => {
    setError(msg);
    setTimeout(() => setError(null), 6000);
  };

  // ── Load All Data ─────────────────────────────────────────────────────────

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [sumRes, purRes, expRes, depRes, gwRes, salesRes] = await Promise.all([
        fetchWorkQueueSummary().catch(() => null),
        fetchPurchasesForQueue().catch(() => []),
        fetchExpensesForQueue().catch(() => []),
        fetchDepositSlipsForQueue().catch(() => []),
        fetchGatewayBatchesForQueue().catch(() => []),
        fetchSalesForQueue().catch(() => []),
      ]);
      if (sumRes) setSummary(sumRes);
      setPurchases(purRes);
      setExpenses(expRes);
      setDeposits(depRes);
      setGateways(gwRes);
      setSales(salesRes);
    } catch (err: any) {
      setError(err.message || "Failed to load accounting work queue data");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // ── Action Handlers ───────────────────────────────────────────────────────

  // Purchases
  const handleApprovePurchase = async (p: PurchaseQueueItem) => {
    setActionLoading(true);
    try {
      const res = await approvePurchase(p.id);
      if (res.success) {
        showSuccess(`Purchase ${p.invoice_no || p.id} approved successfully.`);
        loadData();
      } else {
        showError(res.error || "Approval failed.");
      }
    } catch (e: any) {
      showError(e.message);
    } finally {
      setActionLoading(false);
    }
  };

  const handlePreviewVoucher = async (purchaseId: string) => {
    setActionLoading(true);
    try {
      const data = await previewPurchaseVoucher(purchaseId);
      setPreviewVoucherData(data);
    } catch (e: any) {
      showError(e.message);
    } finally {
      setActionLoading(false);
    }
  };

  const handlePostPurchase = async (purchaseId: string) => {
    setActionLoading(true);
    try {
      const res = await postPurchaseToGL(purchaseId, {
        voucher_created_by: "acct_preparer",
        voucher_approved_by: "acct_supervisor",
        posted_by: simulatedActor.id,
      });
      if (res.success) {
        showSuccess(`Purchase ${purchaseId} successfully posted to General Ledger!`);
        setPreviewVoucherData(null);
        loadData();
      } else {
        showError(res.error || "Posting failed.");
      }
    } catch (e: any) {
      showError(e.message);
    } finally {
      setActionLoading(false);
    }
  };

  // Expenses
  const handleApproveExpense = async (id: string) => {
    setActionLoading(true);
    try {
      const res = await approveExpense(id);
      if (res.success) {
        showSuccess("Expense claim approved.");
        loadData();
      } else {
        showError(res.error || "Approval failed.");
      }
    } catch (e: any) {
      showError(e.message);
    } finally {
      setActionLoading(false);
    }
  };

  const handlePostExpense = async (id: string) => {
    setActionLoading(true);
    try {
      const res = await postExpenseToGL(id);
      if (res.success) {
        showSuccess("Expense claim posted to General Ledger.");
        loadData();
      } else {
        showError(res.error || "Posting failed.");
      }
    } catch (e: any) {
      showError(e.message);
    } finally {
      setActionLoading(false);
    }
  };

  const handleReturnExpense = async (id: string) => {
    setActionLoading(true);
    try {
      const res = await returnExpenseToDraft(id);
      if (res.success) {
        showSuccess("Expense claim returned to draft.");
        loadData();
      } else {
        showError(res.error || "Return failed.");
      }
    } catch (e: any) {
      showError(e.message);
    } finally {
      setActionLoading(false);
    }
  };

  const handlePreviewExpense = async (e: ExpenseQueueItem) => {
    setActionLoading(true);
    try {
      const res = await fetchExpenseAccounting(e.id);
      if (res.success && res.data) {
        const d = res.data;
        const jlines = (d.journal_lines || []).map((jl: any) => ({
          account_id: `${jl.account_code || ""} ${jl.account_name || jl.account_id}`.trim(),
          narration: jl.narration || (jl.supplier_name ? `Party: ${jl.supplier_name}` : e.description),
          debit_amount: Number(jl.debit || 0),
          credit_amount: Number(jl.credit || 0),
        }));

        setPreviewVoucherData({
          title: d.voucher ? `Expense Voucher: ${d.voucher.voucher_no || d.voucher.id}` : `Expense Claim: ${e.description}`,
          refLabel: "Expense Ref",
          ref: e.reference_no || `EXP-${e.id.slice(0, 8)}`,
          branch: e.branch_name || e.branch_id,
          total_payable: Number(e.total),
          journal_lines: jlines,
        });
      } else {
        showError(res.error || "Failed to load expense accounting details.");
      }
    } catch (err: any) {
      showError(err.message || "Failed to load expense accounting details.");
    } finally {
      setActionLoading(false);
    }
  };

  const handleExecuteExpenseReversal = async () => {
    if (!expenseReversalModal || !expenseReversalReason.trim()) return;
    setActionLoading(true);
    try {
      const res = await reverseExpense(expenseReversalModal.id, {
        reversal_reason: expenseReversalReason.trim(),
        cash_return_destination: expenseReversalModal.payment_method === "CASH" ? cashReturnDest : undefined,
      });
      if (res.success) {
        showSuccess("Expense successfully reversed in General Ledger.");
        setExpenseReversalModal(null);
        setExpenseReversalReason("");
        loadData();
      } else {
        showError(res.error || "Failed to reverse expense.");
      }
    } catch (err: any) {
      showError(err.message || "Failed to reverse expense.");
    } finally {
      setActionLoading(false);
    }
  };

  // Bank Deposits
  const handleApproveDeposit = async (slipId: string) => {
    setActionLoading(true);
    try {
      const res = await approveBankDeposit(slipId, simulatedActor.id);
      if (res.success) {
        showSuccess("Bank deposit slip approved.");
        loadData();
      } else {
        showError(res.error || "Approval failed.");
      }
    } catch (e: any) {
      showError(e.message);
    } finally {
      setActionLoading(false);
    }
  };

  const handlePostDeposit = async (slipId: string) => {
    setActionLoading(true);
    try {
      const res = await postBankDepositToGL(slipId, undefined, simulatedActor.id);
      if (res.success) {
        showSuccess("Bank deposit posted to General Ledger (Dr 1118 Deposit in Transit / Cr 1111 Cash in Hand).");
        loadData();
      } else {
        showError(res.error || "Posting failed.");
      }
    } catch (e: any) {
      showError(e.message);
    } finally {
      setActionLoading(false);
    }
  };

  const handleRejectDeposit = async () => {
    if (!rejectModalData || !rejectionReason.trim()) return;
    setActionLoading(true);
    try {
      if (rejectModalData.type === "deposit") {
        const res = await rejectBankDeposit(rejectModalData.id, rejectionReason, simulatedActor.id);
        if (res.success) {
          showSuccess("Bank deposit rejected and returned to branch.");
          setRejectModalData(null);
          setRejectionReason("");
          loadData();
        } else {
          showError(res.error || "Rejection failed.");
        }
      } else {
        const res = await cancelGatewayBatch(rejectModalData.id, rejectionReason);
        if (res.success) {
          showSuccess("Gateway batch cancelled.");
          setRejectModalData(null);
          setRejectionReason("");
          loadData();
        } else {
          showError(res.error || "Cancellation failed.");
        }
      }
    } catch (e: any) {
      showError(e.message);
    } finally {
      setActionLoading(false);
    }
  };

  // Gateway Settlements
  const handleApproveGateway = async (batchId: string) => {
    setActionLoading(true);
    try {
      const res = await approveGatewayBatch(batchId, simulatedActor.id);
      if (res.success) {
        showSuccess("Gateway settlement batch approved.");
        loadData();
      } else {
        showError(res.error || "Approval failed.");
      }
    } catch (e: any) {
      showError(e.message);
    } finally {
      setActionLoading(false);
    }
  };

  const handlePostGateway = async (batchId: string) => {
    setActionLoading(true);
    try {
      const res = await postGatewayBatchToGL(batchId, simulatedActor.id);
      if (res.success) {
        showSuccess("Gateway settlement posted to General Ledger (Dr 1112 Bank / Dr 5290 Fees / Cr 1113 Clearing).");
        loadData();
      } else {
        showError(res.error || "Posting failed.");
      }
    } catch (e: any) {
      showError(e.message);
    } finally {
      setActionLoading(false);
    }
  };

  // Sales Vouchers (Phase 5C)
  const handleApproveSales = async (voucherId: string) => {
    setActionLoading(true);
    try {
      const res = await approveSalesVoucher(voucherId, simulatedActor.id);
      if (res.success) {
        showSuccess(`Sales voucher ${voucherId} approved successfully.`);
        loadData();
      } else {
        showError(res.error || "Approval failed.");
      }
    } catch (e: any) {
      showError(e.message);
    } finally {
      setActionLoading(false);
    }
  };

  const handlePostSales = async (voucherId: string) => {
    setActionLoading(true);
    try {
      const res = await postSalesVoucherToGL(voucherId, simulatedActor.id);
      if (res.success) {
        showSuccess(`Sales voucher ${voucherId} posted to General Ledger (Dr 1121 AR / Cr 4110 Revenue & Cr 212x GST).`);
        loadData();
      } else {
        showError(res.error || "Posting failed.");
      }
    } catch (e: any) {
      showError(e.message);
    } finally {
      setActionLoading(false);
    }
  };

  // ── Helpers ───────────────────────────────────────────────────────────────

  const fmtCurrency = (n: number | string | null | undefined) => {
    if (n == null) return "₹0.00";
    return "₹" + Number(n).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  return (
    <div className="w-full max-w-7xl mx-auto space-y-6 pb-12">
      {/* ── Top Executive Header ── */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-blue-600 text-white flex items-center justify-center font-bold shadow-md shadow-blue-500/20">
              <ClipboardCheck className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-xl font-black text-slate-900 dark:text-white tracking-tight">
                Central Accounting Work Queue
              </h1>
              <p className="text-xs text-slate-500 dark:text-slate-400 font-medium mt-0.5">
                Distributed Branch Operations · Central Financial Authority · Segregation of Duties
              </p>
            </div>
          </div>
        </div>

        {/* Actor Persona Selector & Refresh */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-xs">
            <UserCheck className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
            <span className="text-slate-500 font-semibold">Acting As:</span>
            <select
              value={simulatedActor.id}
              onChange={(e) => {
                const val = e.target.value;
                if (val === "admin_01") {
                  setSimulatedActor({ id: "admin_01", role: "SUPER_ADMIN", title: "Super Admin / Controller" });
                } else if (val === "acct_supervisor") {
                  setSimulatedActor({ id: "acct_supervisor", role: "STAFF", title: "Accounting Supervisor" });
                } else {
                  setSimulatedActor({ id: "finance_controller", role: "STAFF", title: "Finance Controller" });
                }
              }}
              className="bg-transparent font-bold text-slate-900 dark:text-white outline-none cursor-pointer"
            >
              <option value="admin_01">Super Admin (admin_01)</option>
              <option value="acct_supervisor">Accounting Supervisor (acct_supervisor)</option>
              <option value="finance_controller">Finance Controller (finance_controller)</option>
            </select>
          </div>

          <button
            onClick={loadData}
            disabled={loading || actionLoading}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-bold text-xs transition"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin text-blue-600" : ""}`} />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* ── Alerts ── */}
      {success && (
        <div className="p-4 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-200 text-xs font-semibold flex items-center justify-between shadow-xs">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{success}</span>
          </div>
          <button onClick={() => setSuccess(null)} className="text-emerald-600 font-bold">✕</button>
        </div>
      )}
      {error && (
        <div className="p-4 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-rose-800 dark:text-rose-200 text-xs font-semibold flex items-center justify-between shadow-xs">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
            <span>{error}</span>
          </div>
          <button onClick={() => setError(null)} className="text-rose-600 font-bold">✕</button>
        </div>
      )}

      {/* ── Segregation of Duties Governance Banner ── */}
      <div className="p-4 rounded-2xl bg-amber-50/80 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/60 text-xs flex flex-col md:flex-row md:items-center justify-between gap-3 shadow-xs">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-amber-500/20 text-amber-700 dark:text-amber-300 flex items-center justify-center shrink-0">
            <ShieldCheck className="w-4 h-4" />
          </div>
          <div>
            <h4 className="font-bold text-amber-900 dark:text-amber-200">
              Segregation of Duties (SoD) Active Invariant
            </h4>
            <p className="text-amber-800/80 dark:text-amber-300/80 mt-0.5">
              Preparer ≠ Approver ≠ Poster is enforced. A single user cannot approve or post their own submitted documents.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span className="px-2.5 py-1 rounded-full font-mono font-bold text-[11px] bg-amber-200/60 dark:bg-amber-900/60 text-amber-900 dark:text-amber-200 border border-amber-300/60 dark:border-amber-800">
            3-TIER SO-D LOCKED
          </span>
        </div>
      </div>

      {/* ── KPI Metrics Cards ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        {/* Purchases */}
        <div
          onClick={() => setActiveStream("purchases")}
          className={`cursor-pointer rounded-2xl p-5 border transition-all ${
            activeStream === "purchases"
              ? "bg-blue-50/60 dark:bg-blue-950/30 border-blue-300 dark:border-blue-700 shadow-md ring-2 ring-blue-500/20"
              : "bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:border-slate-300"
          }`}
        >
          <div className="flex items-center justify-between text-xs text-slate-500 font-bold mb-2">
            <span className="flex items-center gap-1.5">
              <ShoppingBag className="w-3.5 h-3.5 text-blue-600" />
              <span>Purchases Queue</span>
            </span>
            <span className="px-2 py-0.5 rounded-full bg-blue-100 dark:bg-blue-900/60 text-blue-700 dark:text-blue-300 text-[10px]">
              {summary?.pending_purchases.count ?? purchases.filter(p => p.status === "SUBMITTED" || p.status === "APPROVED").length} pending
            </span>
          </div>
          <div className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">
            {fmtCurrency(summary?.pending_purchases.total ?? purchases.reduce((acc, p) => acc + (p.status !== "POSTED" ? Number(p.total) : 0), 0))}
          </div>
          <p className="text-[11px] text-slate-400 mt-1">Awaiting financial validation &amp; posting</p>
        </div>

        {/* Expenses */}
        <div
          onClick={() => setActiveStream("expenses")}
          className={`cursor-pointer rounded-2xl p-5 border transition-all ${
            activeStream === "expenses"
              ? "bg-amber-50/60 dark:bg-amber-950/30 border-amber-300 dark:border-amber-700 shadow-md ring-2 ring-amber-500/20"
              : "bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:border-slate-300"
          }`}
        >
          <div className="flex items-center justify-between text-xs text-slate-500 font-bold mb-2">
            <span className="flex items-center gap-1.5">
              <Receipt className="w-3.5 h-3.5 text-amber-600" />
              <span>Expense Claims</span>
            </span>
            <span className="px-2 py-0.5 rounded-full bg-amber-100 dark:bg-amber-900/60 text-amber-700 dark:text-amber-300 text-[10px]">
              {summary?.pending_expenses.count ?? expenses.filter(e => e.status === "SUBMITTED" || e.status === "APPROVED").length} pending
            </span>
          </div>
          <div className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">
            {fmtCurrency(summary?.pending_expenses.total ?? expenses.reduce((acc, e) => acc + (e.status !== "POSTED" ? Number(e.total) : 0), 0))}
          </div>
          <p className="text-[11px] text-slate-400 mt-1">Branch petty cash operational claims</p>
        </div>

        {/* Bank Deposits */}
        <div
          onClick={() => setActiveStream("deposits")}
          className={`cursor-pointer rounded-2xl p-5 border transition-all ${
            activeStream === "deposits"
              ? "bg-emerald-50/60 dark:bg-emerald-950/30 border-emerald-300 dark:border-emerald-700 shadow-md ring-2 ring-emerald-500/20"
              : "bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:border-slate-300"
          }`}
        >
          <div className="flex items-center justify-between text-xs text-slate-500 font-bold mb-2">
            <span className="flex items-center gap-1.5">
              <Landmark className="w-3.5 h-3.5 text-emerald-600" />
              <span>Bank Deposit Slips</span>
            </span>
            <span className="px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-900/60 text-emerald-700 dark:text-emerald-300 text-[10px]">
              {summary?.pending_deposits.count ?? deposits.filter(d => d.status === "PREPARED" || d.status === "APPROVED").length} in transit
            </span>
          </div>
          <div className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">
            {fmtCurrency(summary?.pending_deposits.total ?? deposits.reduce((acc, d) => acc + (d.status !== "POSTED" ? Number(d.deposit_amount) : 0), 0))}
          </div>
          <p className="text-[11px] text-slate-400 mt-1">Cash drawer to bank transit vouchers</p>
        </div>

        {/* Gateway Settlements */}
        <div
          onClick={() => setActiveStream("gateways")}
          className={`cursor-pointer rounded-2xl p-5 border transition-all ${
            activeStream === "gateways"
              ? "bg-purple-50/60 dark:bg-purple-950/30 border-purple-300 dark:border-purple-700 shadow-md ring-2 ring-purple-500/20"
              : "bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:border-slate-300"
          }`}
        >
          <div className="flex items-center justify-between text-xs text-slate-500 font-bold mb-2">
            <span className="flex items-center gap-1.5">
              <CreditCard className="w-3.5 h-3.5 text-purple-600" />
              <span>Gateway Payouts</span>
            </span>
            <span className="px-2 py-0.5 rounded-full bg-purple-100 dark:bg-purple-900/60 text-purple-700 dark:text-purple-300 text-[10px]">
              {summary?.pending_gateways.count ?? gateways.filter(g => g.status === "INGESTED" || g.status === "APPROVED").length} ingested
            </span>
          </div>
          <div className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">
            {fmtCurrency(summary?.pending_gateways.total ?? gateways.reduce((acc, g) => acc + (g.status !== "POSTED" ? Number(g.net_amount) : 0), 0))}
          </div>
          <p className="text-[11px] text-slate-400 mt-1">Aggregator clearing &amp; fee vouchers</p>
        </div>

        {/* Sales Vouchers (Phase 5C) */}
        <div
          onClick={() => setActiveStream("sales")}
          className={`cursor-pointer rounded-2xl p-5 border transition-all ${
            activeStream === "sales"
              ? "bg-teal-50/60 dark:bg-teal-950/30 border-teal-300 dark:border-teal-700 shadow-md ring-2 ring-teal-500/20"
              : "bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:border-slate-300"
          }`}
        >
          <div className="flex items-center justify-between text-xs text-slate-500 font-bold mb-2">
            <span className="flex items-center gap-1.5">
              <FileCheck className="w-3.5 h-3.5 text-teal-600" />
              <span>Sales Vouchers</span>
            </span>
            <span className="px-2 py-0.5 rounded-full bg-teal-100 dark:bg-teal-900/60 text-teal-700 dark:text-teal-300 text-[10px]">
              {summary?.pending_sales?.count ?? sales.filter(s => s.status === "DRAFT" || s.status === "SUBMITTED").length} pending
            </span>
          </div>
          <div className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">
            {fmtCurrency(summary?.pending_sales?.total ?? sales.reduce((acc, s) => acc + (s.status !== "POSTED" ? Number(s.total_amount) : 0), 0))}
          </div>
          <p className="text-[11px] text-slate-400 mt-1">Delivered orders awaiting GL posting</p>
        </div>
      </div>

      {/* ── Navigation Stream Tabs ── */}
      <div className="flex items-center gap-2 border-b border-slate-200 dark:border-slate-800 overflow-x-auto scrollbar-thin pb-2">
        {[
          { id: "purchases", label: "Purchases & Inward Procurement", icon: ShoppingBag, count: purchases.length },
          { id: "expenses", label: "Petty Cash & Expense Claims", icon: Receipt, count: expenses.length },
          { id: "deposits", label: "Bank Deposit Slips (Transit)", icon: Landmark, count: deposits.length },
          { id: "gateways", label: "Gateway Settlement Batches", icon: CreditCard, count: gateways.length },
          { id: "sales", label: "Delivered Order Sales Vouchers", icon: FileCheck, count: sales.length },
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = activeStream === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => {
                setActiveStream(tab.id as QueueStream);
                setStatusFilter("ALL");
              }}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-xs whitespace-nowrap transition-all ${
                isActive
                  ? "bg-slate-900 dark:bg-white text-white dark:text-slate-900 shadow-md"
                  : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
              }`}
            >
              <Icon className="w-4 h-4" />
              <span>{tab.label}</span>
              <span
                className={`ml-1 px-2 py-0.5 rounded-full text-[10px] font-mono ${
                  isActive
                    ? "bg-white/20 dark:bg-slate-900/20 text-white dark:text-slate-900"
                    : "bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-400"
                }`}
              >
                {tab.count}
              </span>
            </button>
          );
        })}
      </div>

      {/* ── Search & Filter Controls ── */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-slate-50 dark:bg-slate-800/40 p-3 rounded-xl border border-slate-200 dark:border-slate-700/60">
        <div className="relative w-full sm:w-72">
          <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Search items, invoices, references..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <Filter className="w-3.5 h-3.5 text-slate-400" />
          <span className="text-xs font-semibold text-slate-500">Status:</span>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="py-1.5 px-2.5 text-xs font-bold bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer"
          >
            <option value="ALL">All Statuses</option>
            {activeStream === "purchases" && (
              <>
                <option value="DRAFT">DRAFT</option>
                <option value="SUBMITTED">SUBMITTED (Pending Review)</option>
                <option value="APPROVED">APPROVED (Awaiting GL Post)</option>
                <option value="POSTED">POSTED (GL Complete)</option>
              </>
            )}
            {activeStream === "expenses" && (
              <>
                <option value="DRAFT">DRAFT</option>
                <option value="SUBMITTED">SUBMITTED</option>
                <option value="APPROVED">APPROVED</option>
                <option value="POSTED">POSTED</option>
              </>
            )}
            {activeStream === "deposits" && (
              <>
                <option value="PREPARED">PREPARED (In Transit)</option>
                <option value="APPROVED">APPROVED</option>
                <option value="POSTED">POSTED (GL Verified)</option>
                <option value="REJECTED">REJECTED</option>
              </>
            )}
            {activeStream === "gateways" && (
              <>
                <option value="INGESTED">INGESTED</option>
                <option value="APPROVED">APPROVED</option>
                <option value="POSTED">POSTED</option>
                <option value="EXCEPTION">EXCEPTION</option>
              </>
            )}
            {activeStream === "sales" && (
              <>
                <option value="DRAFT">DRAFT (Delivered Order)</option>
                <option value="SUBMITTED">SUBMITTED</option>
                <option value="APPROVED">APPROVED (Awaiting GL Post)</option>
                <option value="POSTED">POSTED (GL Complete)</option>
              </>
            )}
          </select>
        </div>
      </div>

      {/* ── Stream 1: Purchases Queue ── */}
      {activeStream === "purchases" && (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-sm">
          <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                Purchases Inward Review &amp; Posting Pipeline
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Posts inventory lots to 1131/1132/1133 and AP liability to 2111 with input GST debits.
              </p>
            </div>
            <span className="text-xs font-mono font-bold text-slate-500">
              {purchases.length} total entries
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 dark:bg-slate-800/60 text-slate-500 font-bold uppercase tracking-wider border-b border-slate-200 dark:border-slate-800">
                <tr>
                  <th className="py-3 px-4">Invoice / ID</th>
                  <th className="py-3 px-4">Date</th>
                  <th className="py-3 px-4">Supplier</th>
                  <th className="py-3 px-4">Receiving Branch</th>
                  <th className="py-3 px-4 text-right">Taxable</th>
                  <th className="py-3 px-4 text-right">Tax (GST)</th>
                  <th className="py-3 px-4 text-right">Total Payable</th>
                  <th className="py-3 px-4 text-center">Status</th>
                  <th className="py-3 px-4">Actors (SoD)</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {purchases
                  .filter((p) => statusFilter === "ALL" || p.status === statusFilter)
                  .filter((p) => !searchTerm || (p.invoice_no && p.invoice_no.toLowerCase().includes(searchTerm.toLowerCase())) || (p.supplier_name && p.supplier_name.toLowerCase().includes(searchTerm.toLowerCase())))
                  .map((p) => {
                    const isSelfAction = p.created_by === simulatedActor.id;
                    return (
                      <tr key={p.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition">
                        <td className="py-3 px-4 font-mono font-bold text-slate-900 dark:text-white">
                          {p.invoice_no || <span className="italic text-slate-400">PO-{p.id.slice(0, 8)}</span>}
                        </td>
                        <td className="py-3 px-4 text-slate-600 dark:text-slate-400">
                          {p.invoice_date ? new Date(p.invoice_date).toLocaleDateString("en-IN") : "—"}
                        </td>
                        <td className="py-3 px-4 font-medium text-slate-800 dark:text-slate-200">
                          {p.supplier_name || "Direct Vendor"}
                        </td>
                        <td className="py-3 px-4 text-slate-600 dark:text-slate-400">
                          {p.branch_name || p.branch_id}
                        </td>
                        <td className="py-3 px-4 text-right font-mono text-slate-700 dark:text-slate-300">
                          {fmtCurrency(p.taxable_value)}
                        </td>
                        <td className="py-3 px-4 text-right font-mono text-slate-700 dark:text-slate-300">
                          {fmtCurrency(Number(p.cgst || 0) + Number(p.sgst || 0) + Number(p.igst || 0))}
                        </td>
                        <td className="py-3 px-4 text-right font-mono font-bold text-blue-600 dark:text-blue-400">
                          {fmtCurrency(p.total)}
                        </td>
                        <td className="py-3 px-4 text-center">
                          <span
                            className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold ${
                              p.status === "POSTED"
                                ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300"
                                : p.status === "APPROVED"
                                ? "bg-blue-100 text-blue-800 dark:bg-blue-950/60 dark:text-blue-300"
                                : p.status === "SUBMITTED"
                                ? "bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300"
                                : "bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-300"
                            }`}
                          >
                            {p.status}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-[11px] text-slate-500">
                          <div><span className="font-semibold">Prep:</span> {p.created_by || "—"}</div>
                          <div><span className="font-semibold">Appr:</span> {p.approved_by || "—"}</div>
                        </td>
                        <td className="py-3 px-4 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            {p.status === "SUBMITTED" && (
                              <button
                                onClick={() => handleApprovePurchase(p)}
                                disabled={actionLoading || isSelfAction}
                                title={isSelfAction ? "SoD Blocked: You created this purchase" : "Approve purchase"}
                                className={`px-2.5 py-1 rounded-lg text-xs font-bold transition ${
                                  isSelfAction
                                    ? "bg-slate-100 text-slate-400 cursor-not-allowed"
                                    : "bg-blue-600 text-white hover:bg-blue-700"
                                }`}
                              >
                                Approve
                              </button>
                            )}

                            {p.status === "APPROVED" && (
                              <>
                                <button
                                  onClick={() => handlePreviewVoucher(p.id)}
                                  disabled={actionLoading}
                                  className="px-2.5 py-1 rounded-lg text-xs font-bold bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 transition flex items-center gap-1"
                                >
                                  <Eye className="w-3 h-3" />
                                  <span>Preview GL</span>
                                </button>

                                <button
                                  onClick={() => handlePostPurchase(p.id)}
                                  disabled={actionLoading || (p.created_by === simulatedActor.id)}
                                  title={p.created_by === simulatedActor.id ? "SoD Blocked: Creator cannot post" : "Post to GL"}
                                  className={`px-2.5 py-1 rounded-lg text-xs font-bold transition flex items-center gap-1 ${
                                    p.created_by === simulatedActor.id
                                      ? "bg-slate-100 text-slate-400 cursor-not-allowed"
                                      : "bg-emerald-600 text-white hover:bg-emerald-700"
                                  }`}
                                >
                                  <Send className="w-3 h-3" />
                                  <span>Post to GL</span>
                                </button>
                              </>
                            )}

                            {p.status === "POSTED" && (
                              <span className="text-[11px] font-bold text-emerald-600 flex items-center gap-1">
                                <CheckCircle2 className="w-3.5 h-3.5" />
                                <span>GL Posted</span>
                              </span>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── Stream 2: Expenses Queue ── */}
      {activeStream === "expenses" && (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-sm">
          <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                Branch Petty Cash &amp; Expense Claims Review
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Reviews operational vouchers. Central accounting approves claims and commits financial postings.
              </p>
            </div>
            <span className="text-xs font-mono font-bold text-slate-500">
              {expenses.length} claims
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 dark:bg-slate-800/60 text-slate-500 font-bold uppercase tracking-wider border-b border-slate-200 dark:border-slate-800">
                <tr>
                  <th className="py-3 px-4">Date</th>
                  <th className="py-3 px-4">Category</th>
                  <th className="py-3 px-4">Branch</th>
                  <th className="py-3 px-4">Description</th>
                  <th className="py-3 px-4">Ref No.</th>
                  <th className="py-3 px-4 text-right">Taxable</th>
                  <th className="py-3 px-4 text-right">Total Claim</th>
                  <th className="py-3 px-4 text-center">Status</th>
                  <th className="py-3 px-4">Claimant</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {expenses
                  .filter((e) => statusFilter === "ALL" || e.status === statusFilter)
                  .filter((e) => !searchTerm || e.description.toLowerCase().includes(searchTerm.toLowerCase()))
                  .map((e) => {
                    const isSelfAction = e.created_by === simulatedActor.id;
                    return (
                      <tr key={e.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition">
                        <td className="py-3 px-4 text-slate-600 dark:text-slate-400">
                          {e.expense_date}
                        </td>
                        <td className="py-3 px-4 font-bold text-slate-800 dark:text-slate-200">
                          {e.category_name || "General"}
                        </td>
                        <td className="py-3 px-4 text-slate-600 dark:text-slate-400">
                          {e.branch_name || e.branch_id}
                        </td>
                        <td className="py-3 px-4 max-w-xs truncate text-slate-700 dark:text-slate-300">
                          {e.description}
                        </td>
                        <td className="py-3 px-4 font-mono text-slate-500">
                          {e.reference_no || "—"}
                        </td>
                        <td className="py-3 px-4 text-right font-mono text-slate-700 dark:text-slate-300">
                          {fmtCurrency(e.taxable_value)}
                        </td>
                        <td className="py-3 px-4 text-right font-mono font-bold text-amber-600 dark:text-amber-400">
                          {fmtCurrency(e.total)}
                        </td>
                        <td className="py-3 px-4 text-center">
                          <span
                            className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold ${
                              e.status === "POSTED"
                                ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300"
                                : e.status === "APPROVED"
                                ? "bg-blue-100 text-blue-800 dark:bg-blue-950/60 dark:text-blue-300"
                                : e.status === "SUBMITTED"
                                ? "bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300"
                                : "bg-slate-100 text-slate-800"
                            }`}
                          >
                            {e.status}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-[11px] text-slate-500">
                          {e.created_by}
                        </td>
                        <td className="py-3 px-4 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            {e.status === "SUBMITTED" && (
                              <>
                                <button
                                  onClick={() => handleReturnExpense(e.id)}
                                  disabled={actionLoading}
                                  className="px-2 py-1 rounded-lg text-xs font-semibold text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800"
                                >
                                  Return
                                </button>
                                <button
                                  onClick={() => handleApproveExpense(e.id)}
                                  disabled={actionLoading || isSelfAction}
                                  title={isSelfAction ? "SoD Blocked: Self-approval" : "Approve Claim"}
                                  className={`px-2.5 py-1 rounded-lg text-xs font-bold transition ${
                                    isSelfAction
                                      ? "bg-slate-100 text-slate-400 cursor-not-allowed"
                                      : "bg-amber-600 text-white hover:bg-amber-700"
                                  }`}
                                >
                                  Approve
                                </button>
                              </>
                            )}

                            {e.status === "APPROVED" && (
                              <>
                                <button
                                  onClick={() => handlePreviewExpense(e)}
                                  disabled={actionLoading}
                                  className="px-2 py-1 rounded-lg text-xs font-bold bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 transition flex items-center gap-1"
                                >
                                  <Eye className="w-3 h-3" />
                                  <span>Preview</span>
                                </button>
                                <button
                                  onClick={() => handlePostExpense(e.id)}
                                  disabled={actionLoading || isSelfAction}
                                  title={isSelfAction ? "SoD Blocked: Self-posting" : "Post Expense"}
                                  className={`px-2.5 py-1 rounded-lg text-xs font-bold transition flex items-center gap-1 ${
                                    isSelfAction
                                      ? "bg-slate-100 text-slate-400 cursor-not-allowed"
                                      : "bg-emerald-600 text-white hover:bg-emerald-700"
                                  }`}
                                >
                                  <Send className="w-3 h-3" />
                                  <span>Post to GL</span>
                                </button>
                              </>
                            )}

                            {e.status === "POSTED" && (
                              <div className="flex items-center gap-1.5">
                                <button
                                  onClick={() => handlePreviewExpense(e)}
                                  disabled={actionLoading}
                                  className="px-2 py-1 rounded-lg text-xs font-bold bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 transition flex items-center gap-1"
                                >
                                  <Eye className="w-3 h-3" />
                                  <span>GL Voucher</span>
                                </button>
                                {(() => {
                                  const isReversalBlocked = Boolean(e.created_by === simulatedActor.id || (e.approved_by && e.approved_by === simulatedActor.id));
                                  return (
                                    <button
                                      onClick={() => setExpenseReversalModal({
                                        id: e.id,
                                        description: e.description,
                                        total: Number(e.total),
                                        payment_method: e.payment_method,
                                        created_by: e.created_by,
                                        approved_by: e.approved_by,
                                      })}
                                      disabled={actionLoading || isReversalBlocked}
                                      title={isReversalBlocked ? "SoD Blocked: Creator and approver cannot reverse" : "Reverse posted expense"}
                                      className={`px-2 py-1 rounded-lg text-xs font-bold transition flex items-center gap-1 ${
                                        isReversalBlocked
                                          ? "bg-slate-100 text-slate-400 cursor-not-allowed"
                                          : "bg-rose-100 text-rose-700 hover:bg-rose-200 dark:bg-rose-950/60 dark:text-rose-300"
                                      }`}
                                    >
                                      <RotateCcw className="w-3 h-3" />
                                      <span>Reverse</span>
                                    </button>
                                  );
                                })()}
                              </div>
                            )}

                            {e.status === "REVERSED" && (
                              <div className="flex items-center gap-1.5">
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300">
                                  <RotateCcw className="w-3 h-3" />
                                  <span>Reversed</span>
                                </span>
                                <button
                                  onClick={() => handlePreviewExpense(e)}
                                  disabled={actionLoading}
                                  className="px-2 py-1 rounded-lg text-xs font-bold bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 transition flex items-center gap-1"
                                >
                                  <Eye className="w-3 h-3" />
                                  <span>Audit</span>
                                </button>
                              </div>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── Stream 3: Bank Deposit Slips Queue ── */}
      {activeStream === "deposits" && (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-sm">
          <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                Cash Drawer to Bank Deposit Slips Queue
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Two-stage deposit in transit. Posting generates Dr 1118 (Deposit in Transit) / Cr 1111 (Cash in Hand).
              </p>
            </div>
            <span className="text-xs font-mono font-bold text-slate-500">
              {deposits.length} slips
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 dark:bg-slate-800/60 text-slate-500 font-bold uppercase tracking-wider border-b border-slate-200 dark:border-slate-800">
                <tr>
                  <th className="py-3 px-4">Slip Ref</th>
                  <th className="py-3 px-4">Date</th>
                  <th className="py-3 px-4">Source Branch</th>
                  <th className="py-3 px-4">Destination Bank Account</th>
                  <th className="py-3 px-4 text-right">Deposit Amount</th>
                  <th className="py-3 px-4 text-center">Status</th>
                  <th className="py-3 px-4">Actors (SoD)</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {deposits
                  .filter((d) => statusFilter === "ALL" || d.status === statusFilter)
                  .filter((d) => !searchTerm || d.slip_reference.toLowerCase().includes(searchTerm.toLowerCase()))
                  .map((d) => {
                    const isSelfAction = d.prepared_by === simulatedActor.id;
                    return (
                      <tr key={d.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition">
                        <td className="py-3 px-4 font-mono font-bold text-slate-900 dark:text-white">
                          {d.slip_reference}
                        </td>
                        <td className="py-3 px-4 text-slate-600 dark:text-slate-400">
                          {d.deposit_date}
                        </td>
                        <td className="py-3 px-4 text-slate-700 dark:text-slate-300 font-medium">
                          {d.branch_name || d.branch_id}
                        </td>
                        <td className="py-3 px-4 text-slate-800 dark:text-slate-200">
                          {d.bank_name || "Corporate Current A/c"} ({d.account_number || d.bank_account_id.slice(0, 8)})
                        </td>
                        <td className="py-3 px-4 text-right font-mono font-black text-emerald-600 dark:text-emerald-400">
                          {fmtCurrency(d.deposit_amount)}
                        </td>
                        <td className="py-3 px-4 text-center">
                          <span
                            className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold ${
                              d.status === "POSTED"
                                ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300"
                                : d.status === "APPROVED"
                                ? "bg-blue-100 text-blue-800 dark:bg-blue-950/60 dark:text-blue-300"
                                : d.status === "PREPARED"
                                ? "bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300"
                                : "bg-rose-100 text-rose-800"
                            }`}
                          >
                            {d.status}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-[11px] text-slate-500">
                          <div><span className="font-semibold">Prep:</span> {d.prepared_by}</div>
                          <div><span className="font-semibold">Appr:</span> {d.approved_by || "—"}</div>
                          <div><span className="font-semibold">Post:</span> {d.posted_by || "—"}</div>
                        </td>
                        <td className="py-3 px-4 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            {d.status === "PREPARED" && (
                              <>
                                <button
                                  onClick={() => setRejectModalData({ id: d.id, type: "deposit" })}
                                  disabled={actionLoading}
                                  className="px-2 py-1 rounded-lg text-xs font-semibold text-rose-600 hover:bg-rose-50"
                                >
                                  Reject
                                </button>
                                <button
                                  onClick={() => handleApproveDeposit(d.id)}
                                  disabled={actionLoading || isSelfAction}
                                  title={isSelfAction ? "SoD Blocked: Self-approval prohibited" : "Approve Deposit Slip"}
                                  className={`px-2.5 py-1 rounded-lg text-xs font-bold transition ${
                                    isSelfAction
                                      ? "bg-slate-100 text-slate-400 cursor-not-allowed"
                                      : "bg-blue-600 text-white hover:bg-blue-700"
                                  }`}
                                >
                                  Approve
                                </button>
                              </>
                            )}

                            {d.status === "APPROVED" && (
                              <button
                                onClick={() => handlePostDeposit(d.id)}
                                disabled={actionLoading || isSelfAction || d.approved_by === simulatedActor.id}
                                title={
                                  isSelfAction
                                    ? "SoD Blocked: Preparer cannot post"
                                    : d.approved_by === simulatedActor.id
                                    ? "SoD Blocked: Approver cannot post (3-tier SoD)"
                                    : "Post Transit Voucher to GL"
                                }
                                className={`px-2.5 py-1 rounded-lg text-xs font-bold transition flex items-center gap-1 ${
                                  isSelfAction || d.approved_by === simulatedActor.id
                                    ? "bg-slate-100 text-slate-400 cursor-not-allowed"
                                    : "bg-emerald-600 text-white hover:bg-emerald-700"
                                }`}
                              >
                                <Send className="w-3 h-3" />
                                <span>Post Transit GL</span>
                              </button>
                            )}

                            {d.status === "POSTED" && (
                              <span className="text-[11px] font-bold text-emerald-600 flex items-center gap-1">
                                <CheckCircle2 className="w-3.5 h-3.5" />
                                <span>In Transit</span>
                              </span>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── Stream 4: Gateway Settlements Queue ── */}
      {activeStream === "gateways" && (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-sm">
          <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                Payment Gateway Settlement Batches
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Clears online customer payments: Dr 1112 Bank / Dr 5290 Gateway Fees / Cr 1113 Clearing.
              </p>
            </div>
            <span className="text-xs font-mono font-bold text-slate-500">
              {gateways.length} payout batches
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 dark:bg-slate-800/60 text-slate-500 font-bold uppercase tracking-wider border-b border-slate-200 dark:border-slate-800">
                <tr>
                  <th className="py-3 px-4">Payout Ref</th>
                  <th className="py-3 px-4">Provider</th>
                  <th className="py-3 px-4">Date</th>
                  <th className="py-3 px-4 text-right">Gross Volume</th>
                  <th className="py-3 px-4 text-right">Fees &amp; Tax</th>
                  <th className="py-3 px-4 text-right">Net Settlement</th>
                  <th className="py-3 px-4 text-center">Status</th>
                  <th className="py-3 px-4 text-center">Exceptions</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {gateways
                  .filter((g) => statusFilter === "ALL" || g.status === statusFilter)
                  .filter((g) => !searchTerm || g.payout_reference.toLowerCase().includes(searchTerm.toLowerCase()))
                  .map((g) => {
                    return (
                      <tr key={g.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition">
                        <td className="py-3 px-4 font-mono font-bold text-slate-900 dark:text-white">
                          {g.payout_reference}
                        </td>
                        <td className="py-3 px-4 font-bold text-purple-600 dark:text-purple-400">
                          {g.provider}
                        </td>
                        <td className="py-3 px-4 text-slate-600 dark:text-slate-400">
                          {g.settlement_date}
                        </td>
                        <td className="py-3 px-4 text-right font-mono text-slate-700 dark:text-slate-300">
                          {fmtCurrency(g.gross_amount)}
                        </td>
                        <td className="py-3 px-4 text-right font-mono text-rose-600 dark:text-rose-400">
                          {fmtCurrency(Number(g.identified_fee_amount || 0) + Number(g.reported_tax_amount || 0))}
                        </td>
                        <td className="py-3 px-4 text-right font-mono font-black text-emerald-600 dark:text-emerald-400">
                          {fmtCurrency(g.net_amount)}
                        </td>
                        <td className="py-3 px-4 text-center">
                          <span
                            className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold ${
                              g.status === "POSTED"
                                ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300"
                                : g.status === "APPROVED"
                                ? "bg-blue-100 text-blue-800 dark:bg-blue-950/60 dark:text-blue-300"
                                : "bg-purple-100 text-purple-800 dark:bg-purple-950/60 dark:text-purple-300"
                            }`}
                          >
                            {g.status}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-center">
                          {g.unreconciled_exception_count > 0 ? (
                            <span className="px-2 py-0.5 rounded-full bg-rose-100 text-rose-800 text-[10px] font-bold">
                              {g.unreconciled_exception_count} items
                            </span>
                          ) : (
                            <span className="text-slate-400 font-mono text-[10px]">0</span>
                          )}
                        </td>
                        <td className="py-3 px-4 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            {g.status === "INGESTED" && (
                              <button
                                onClick={() => handleApproveGateway(g.id)}
                                disabled={actionLoading}
                                className="px-2.5 py-1 rounded-lg text-xs font-bold bg-blue-600 text-white hover:bg-blue-700"
                              >
                                Approve
                              </button>
                            )}
                            {g.status === "APPROVED" && (
                              <button
                                onClick={() => handlePostGateway(g.id)}
                                disabled={actionLoading}
                                className="px-2.5 py-1 rounded-lg text-xs font-bold bg-emerald-600 text-white hover:bg-emerald-700 flex items-center gap-1"
                              >
                                <Send className="w-3 h-3" />
                                <span>Post Settlement</span>
                              </button>
                            )}
                            {g.status === "POSTED" && (
                              <span className="text-[11px] font-bold text-emerald-600 flex items-center gap-1">
                                <CheckCircle2 className="w-3.5 h-3.5" />
                                <span>Settled</span>
                              </span>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── Stream 5: Sales Vouchers Queue (Phase 5C) ── */}
      {activeStream === "sales" && (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-sm">
          <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                Delivered Online Order Sales Vouchers Pipeline
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Statutory invoice billing bridge: Dr 1121 Accounts Receivable / Cr 4110 Cake Sales, Cr 4120 Accessories, Cr 4130 Delivery Fee, Cr 212x GST.
              </p>
            </div>
            <span className="text-xs font-mono font-bold text-slate-500">
              {sales.length} total entries
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 dark:bg-slate-800/60 text-slate-500 font-bold uppercase tracking-wider border-b border-slate-200 dark:border-slate-800">
                <tr>
                  <th className="py-3 px-4">Voucher / Order Ref</th>
                  <th className="py-3 px-4">Statutory Bill #</th>
                  <th className="py-3 px-4">Date</th>
                  <th className="py-3 px-4">Customer</th>
                  <th className="py-3 px-4">Branch</th>
                  <th className="py-3 px-4 text-right">Invoice Amount</th>
                  <th className="py-3 px-4 text-center">Status</th>
                  <th className="py-3 px-4">Actors (SoD)</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {sales
                  .filter((s) => statusFilter === "ALL" || s.status === statusFilter)
                  .filter((s) => !searchTerm || s.voucher_number.toLowerCase().includes(searchTerm.toLowerCase()) || s.order_id.toLowerCase().includes(searchTerm.toLowerCase()) || (s.invoice_number && s.invoice_number.toLowerCase().includes(searchTerm.toLowerCase())) || (s.customer_name && s.customer_name.toLowerCase().includes(searchTerm.toLowerCase())))
                  .map((s) => {
                    const isSelfAction = s.created_by === simulatedActor.id;
                    return (
                      <tr key={s.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition">
                        <td className="py-3 px-4">
                          <div className="font-mono font-bold text-slate-900 dark:text-white">
                            {s.voucher_number}
                          </div>
                          <div className="font-mono text-[10px] text-slate-400">
                            {s.order_id}
                          </div>
                        </td>
                        <td className="py-3 px-4 font-mono font-semibold text-slate-800 dark:text-slate-200">
                          {s.invoice_number ? (
                            <span className="px-1.5 py-0.5 rounded bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 font-bold">
                              {s.invoice_number}
                            </span>
                          ) : (
                            <span className="text-slate-400 italic">Bill Pending</span>
                          )}
                        </td>
                        <td className="py-3 px-4 text-slate-600 dark:text-slate-400">
                          {s.voucher_date ? new Date(s.voucher_date).toLocaleDateString("en-IN") : "—"}
                        </td>
                        <td className="py-3 px-4">
                          <div className="font-medium text-slate-800 dark:text-slate-200">{s.customer_name}</div>
                          {s.customer_phone && <div className="text-[10px] text-slate-400 font-mono">{s.customer_phone}</div>}
                        </td>
                        <td className="py-3 px-4 text-slate-600 dark:text-slate-400">
                          {s.branch_name || s.branch_id}
                        </td>
                        <td className="py-3 px-4 text-right font-mono font-black text-slate-900 dark:text-white">
                          {fmtCurrency(s.total_amount)}
                        </td>
                        <td className="py-3 px-4 text-center">
                          <span
                            className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold ${
                              s.status === "POSTED"
                                ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300"
                                : s.status === "APPROVED"
                                ? "bg-blue-100 text-blue-800 dark:bg-blue-950/60 dark:text-blue-300"
                                : "bg-teal-100 text-teal-800 dark:bg-teal-950/60 dark:text-teal-300"
                            }`}
                          >
                            {s.status}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-[11px] text-slate-500 font-mono">
                          <div>Prep: {s.created_by.replace("system:", "")}</div>
                          {s.approved_by && <div className="text-blue-600">Appr: {s.approved_by}</div>}
                          {s.posted_by && <div className="text-emerald-600">Post: {s.posted_by}</div>}
                        </td>
                        <td className="py-3 px-4 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            {s.status === "DRAFT" && (
                              <button
                                onClick={() => handleApproveSales(s.id)}
                                disabled={actionLoading || isSelfAction}
                                title={isSelfAction ? "Segregation of Duties: Creator cannot approve own voucher" : "Approve Sales Voucher"}
                                className={`px-2.5 py-1 rounded-lg text-xs font-bold ${
                                  isSelfAction
                                    ? "bg-slate-100 text-slate-400 cursor-not-allowed"
                                    : "bg-teal-600 text-white hover:bg-teal-700 shadow-xs"
                                }`}
                              >
                                {isSelfAction ? "SoD Locked" : "Approve"}
                              </button>
                            )}
                            {s.status === "APPROVED" && (
                              <button
                                onClick={() => handlePostSales(s.id)}
                                disabled={actionLoading || isSelfAction}
                                title={isSelfAction ? "Segregation of Duties: Creator cannot post own voucher" : "Post to General Ledger"}
                                className={`px-2.5 py-1 rounded-lg text-xs font-bold flex items-center gap-1 ${
                                  isSelfAction
                                    ? "bg-slate-100 text-slate-400 cursor-not-allowed"
                                    : "bg-emerald-600 text-white hover:bg-emerald-700 shadow-xs"
                                }`}
                              >
                                <Send className="w-3 h-3" />
                                <span>{isSelfAction ? "SoD Locked" : "Post to GL"}</span>
                              </button>
                            )}
                            {s.status === "POSTED" && (
                              <span className="text-[11px] font-bold text-emerald-600 flex items-center gap-1">
                                <CheckCircle2 className="w-3.5 h-3.5" />
                                <span>Posted to GL</span>
                              </span>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── Modal: Live Purchase GL Voucher Preview ── */}
      {previewVoucherData && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl w-full max-w-3xl overflow-hidden shadow-2xl animate-in fade-in duration-200">
            <div className="px-6 py-5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
              <div>
                <h3 className="text-base font-black text-slate-900 dark:text-white flex items-center gap-2">
                  <FileText className="w-5 h-5 text-blue-600" />
                  <span>General Ledger Voucher Preview</span>
                </h3>
                <p className="text-xs text-slate-500 mt-0.5 font-medium">
                  Verified balanced double-entry breakdown prior to General Ledger posting.
                </p>
              </div>
              <button
                onClick={() => setPreviewVoucherData(null)}
                className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 flex items-center justify-center font-bold text-slate-500"
              >
                ✕
              </button>
            </div>

            <div className="p-6 space-y-4 max-h-[70vh] overflow-y-auto scrollbar-thin">
              {/* Voucher Meta */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-slate-50 dark:bg-slate-800/40 p-3.5 rounded-2xl text-xs">
                <div>
                  <span className="text-slate-400 block font-semibold">Purchase Ref</span>
                  <span className="font-mono font-bold text-slate-900 dark:text-white">
                    {previewVoucherData.purchase?.invoice_no || previewVoucherData.purchase?.id}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 block font-semibold">Receiving Branch</span>
                  <span className="font-semibold text-slate-800 dark:text-slate-200">
                    {previewVoucherData.purchase?.branch_id}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 block font-semibold">Total Payable</span>
                  <span className="font-mono font-bold text-blue-600">
                    {fmtCurrency(previewVoucherData.total_payable)}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 block font-semibold">Double-Entry Status</span>
                  <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 font-bold text-[10px]">
                    ✓ BALANCED (Dr === Cr)
                  </span>
                </div>
              </div>

              {/* Journal Lines Table */}
              <div className="border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-100 dark:bg-slate-800 text-slate-600 font-bold uppercase tracking-wider">
                    <tr>
                      <th className="py-2.5 px-4">Account Code &amp; Name</th>
                      <th className="py-2.5 px-4">Narration</th>
                      <th className="py-2.5 px-4 text-right">Debit (Dr)</th>
                      <th className="py-2.5 px-4 text-right">Credit (Cr)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {previewVoucherData.journal_lines?.map((jl: any, idx: number) => (
                      <tr key={idx} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                        <td className="py-2 px-4 font-mono font-bold text-slate-900 dark:text-white">
                          {jl.account_id}
                        </td>
                        <td className="py-2 px-4 text-slate-600 dark:text-slate-400 max-w-xs truncate">
                          {jl.narration}
                        </td>
                        <td className="py-2 px-4 text-right font-mono font-semibold text-slate-800 dark:text-slate-200">
                          {jl.debit_amount > 0 ? fmtCurrency(jl.debit_amount) : "—"}
                        </td>
                        <td className="py-2 px-4 text-right font-mono font-semibold text-slate-800 dark:text-slate-200">
                          {jl.credit_amount > 0 ? fmtCurrency(jl.credit_amount) : "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot className="bg-slate-50 dark:bg-slate-800/60 font-black border-t border-slate-200 dark:border-slate-800">
                    <tr>
                      <td colSpan={2} className="py-2.5 px-4 text-right uppercase text-[11px] text-slate-500">
                        Totals
                      </td>
                      <td className="py-2.5 px-4 text-right font-mono text-emerald-600 dark:text-emerald-400">
                        {fmtCurrency(
                          previewVoucherData.journal_lines?.reduce((acc: number, l: any) => acc + Number(l.debit_amount || 0), 0)
                        )}
                      </td>
                      <td className="py-2.5 px-4 text-right font-mono text-emerald-600 dark:text-emerald-400">
                        {fmtCurrency(
                          previewVoucherData.journal_lines?.reduce((acc: number, l: any) => acc + Number(l.credit_amount || 0), 0)
                        )}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>

            <div className="px-6 py-4 bg-slate-50 dark:bg-slate-800/60 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between">
              <span className="text-xs text-slate-500">
                Authoritative CoA mapping strictly applied (1131/1132/1133).
              </span>
              <div className="flex gap-2">
                <button
                  onClick={() => setPreviewVoucherData(null)}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-200 dark:hover:bg-slate-700 transition"
                >
                  Close Preview
                </button>
                <button
                  onClick={() => handlePostPurchase(previewVoucherData.purchase?.id)}
                  disabled={actionLoading}
                  className="px-5 py-2 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white transition flex items-center gap-1.5 shadow-md shadow-emerald-600/20"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>Execute GL Post</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal: Rejection Reason Input ── */}
      {rejectModalData && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl w-full max-w-md p-6 shadow-2xl animate-in fade-in duration-200">
            <h3 className="text-base font-black text-slate-900 dark:text-white flex items-center gap-2">
              <XCircle className="w-5 h-5 text-rose-600" />
              <span>Reject {rejectModalData.type === "deposit" ? "Bank Deposit Slip" : "Gateway Payout"}</span>
            </h3>
            <p className="text-xs text-slate-500 mt-1">
              Provide an authoritative audit reason for this rejection. The item will be returned with exception status.
            </p>

            <div className="mt-4">
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                Rejection / Exception Reason *
              </label>
              <textarea
                rows={3}
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
                placeholder="e.g. Physical cash count mismatch at cashier handover, incorrect bank account selected..."
                className="w-full text-xs p-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl outline-none focus:ring-2 focus:ring-rose-500"
              />
            </div>

            <div className="mt-5 flex items-center justify-end gap-2">
              <button
                onClick={() => {
                  setRejectModalData(null);
                  setRejectionReason("");
                }}
                className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
              >
                Cancel
              </button>
              <button
                onClick={handleRejectDeposit}
                disabled={actionLoading || !rejectionReason.trim()}
                className="px-5 py-2 rounded-xl text-xs font-bold bg-rose-600 hover:bg-rose-700 disabled:opacity-50 text-white transition shadow-md shadow-rose-600/20"
              >
                Confirm Rejection
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal: Expense GL Reversal ── */}
      {expenseReversalModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl w-full max-w-lg overflow-hidden shadow-2xl animate-in fade-in duration-200">
            <div className="px-6 py-5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
              <div>
                <h3 className="text-base font-black text-rose-600 dark:text-rose-400 flex items-center gap-2">
                  <RotateCcw className="w-5 h-5" />
                  <span>Reverse General Ledger Expense</span>
                </h3>
                <p className="text-xs text-slate-500 mt-0.5 font-medium">
                  Generates an exact inverted double-entry compensating voucher in GL.
                </p>
              </div>
              <button
                onClick={() => {
                  setExpenseReversalModal(null);
                  setExpenseReversalReason("");
                }}
                className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 flex items-center justify-center font-bold text-slate-500"
              >
                ✕
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700/60 text-xs space-y-1.5">
                <div className="flex justify-between">
                  <span className="text-slate-500 font-semibold">Expense Claim:</span>
                  <span className="font-bold text-slate-900 dark:text-white">{expenseReversalModal.description}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500 font-semibold">Total Amount:</span>
                  <span className="font-mono font-bold text-rose-600">{fmtCurrency(expenseReversalModal.total)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500 font-semibold">Payment Method:</span>
                  <span className="font-bold text-slate-700 dark:text-slate-300">{expenseReversalModal.payment_method}</span>
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                  Reason for GL Reversal <span className="text-rose-500">*</span>
                </label>
                <textarea
                  value={expenseReversalReason}
                  onChange={(e) => setExpenseReversalReason(e.target.value)}
                  placeholder="e.g. Duplicate claim, wrong tax rate applied, cancelled vendor invoice..."
                  className="w-full text-xs p-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-rose-500 min-h-[80px]"
                />
              </div>

              {expenseReversalModal.payment_method === "CASH" && (
                <div>
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                    Cash Return Destination
                  </label>
                  <select
                    value={cashReturnDest}
                    onChange={(e) => setCashReturnDest(e.target.value as any)}
                    className="w-full text-xs p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white outline-none"
                  >
                    <option value="PETTY_CASH">Petty Cash Safe / Cash in Hand (GL 1114 / 1111)</option>
                    <option value="TELLER_DRAWER">Active Teller Drawer (Redeposit Movement)</option>
                  </select>
                </div>
              )}
            </div>

            <div className="px-6 py-4 bg-slate-50 dark:bg-slate-800/60 border-t border-slate-200 dark:border-slate-800 flex items-center justify-end gap-3">
              <button
                onClick={() => {
                  setExpenseReversalModal(null);
                  setExpenseReversalReason("");
                }}
                className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
              >
                Cancel
              </button>
              <button
                onClick={handleExecuteExpenseReversal}
                disabled={actionLoading || !expenseReversalReason.trim()}
                className="px-5 py-2 rounded-xl text-xs font-bold bg-rose-600 hover:bg-rose-700 disabled:opacity-50 text-white transition shadow-md shadow-rose-600/20 flex items-center gap-1.5"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Confirm GL Reversal</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
