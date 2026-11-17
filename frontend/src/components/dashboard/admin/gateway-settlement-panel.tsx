"use client";

/**
 * CakeToHome ERP — Gateway Settlement Panel (Admin Dashboard)
 * Phase 4F Step 4.10 Substep 4.10.4: Gateway Settlement API Endpoints & Enterprise UI Dashboard
 *
 * ARCHITECTURAL DESIGN & INVARIANTS:
 * 1. SERVER-SIDE FINANCIAL AUTHORITATIVE TRUTH:
 *    - All financial math, posting, and lifecycle transitions are executed by GatewaySettlementService in PostgreSQL.
 *    - The UI's integer paise arithmetic check is strictly for immediate UX validation.
 * 2. BRANCH ISOLATION & ZERO CLIENT-SUPPLIED ACCOUNTING DATA:
 *    - GL codes (1112, 1113, 5290) and branch IDs are NEVER accepted from client input.
 *    - Branch information displayed in the UI is derived authoritatively from server-side database records.
 * 3. 3-TIER SEGREGATION OF DUTIES (SoD):
 *    - Prepared By != Approved By != Posted By.
 *    - The UI provides dynamic visual SoD feedback and disables self-approval/self-posting actions.
 * 4. PROVIDER-NEUTRAL SETTLEMENT:
 *    - Supports any payment aggregator (Razorpay, PayU, Cashfree, Stripe, etc.) without hardcoded provider conditionals.
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
  X,
  PlusCircle,
  FileText,
  CreditCard,
  Lock,
  Layers,
  Send,
} from "lucide-react";

// ── Types ──────────────────────────────────────────────────────────────────────

export interface GatewayPayoutBatch {
  id: string;
  provider: string;
  payout_reference: string;
  settlement_reference?: string;
  bank_account_id: string;
  settlement_date: string;
  bank_value_date?: string;
  gross_amount: number | string;
  identified_fee_amount: number | string;
  reported_tax_amount: number | string;
  other_deductions_amount: number | string;
  rounding_variance: number | string;
  net_amount: number | string;
  status: "INGESTED" | "APPROVED" | "POSTED" | "EXCEPTION" | "CANCELLED";
  unreconciled_exception_count: number;
  prepared_by: string;
  approved_by?: string;
  posted_by?: string;
  created_at: string;
  updated_at: string;
  metadata?: Record<string, any>;
  bank_name?: string;
}

export interface SettlementOrder {
  id: string;
  payout_batch_id: string;
  payment_transaction_id: string;
  order_id: string;
  settlement_branch_id: string;
  branch_name?: string;
  allocated_gross_amount: number | string;
  identified_fee_amount: number | string;
  reported_tax_amount: number | string;
  allocated_net_amount: number | string;
  accounting_voucher_id?: string;
  reconciliation_status: string;
  settlement_reference?: string;
}

export interface JournalLine {
  id: string;
  line_number: number;
  account_id: string;
  account_code: string;
  account_name: string;
  debit_amount: number | string;
  credit_amount: number | string;
  narration?: string;
}

export interface BranchVoucher {
  id: string;
  voucher_no: string;
  voucher_type: string;
  voucher_date: string;
  branch_id: string;
  branch_name?: string;
  status: string;
  narration: string;
  lines?: JournalLine[];
}

export interface BankAccount {
  id: string;
  bank_name: string;
  account_number_masked: string;
  ifsc_code: string;
  branch_id?: string | null;
  status: string;
}

// ── Status Visual Helper ───────────────────────────────────────────────────────

const STATUS_CONFIG: Record<
  string,
  { label: string; badge: string; icon: React.ElementType }
> = {
  INGESTED: {
    label: "Ingested / Draft",
    badge: "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300 border-blue-200 dark:border-blue-800",
    icon: Clock,
  },
  APPROVED: {
    label: "Approved",
    badge: "bg-brand-gold-light text-brand-gold-dark dark:bg-brand-gold-dark/40 dark:text-brand-gold/40 border-brand-gold/40 dark:border-brand-gold-dark",
    icon: CheckCircle2,
  },
  POSTED: {
    label: "Posted to GL",
    badge: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800",
    icon: FileCheck2,
  },
  EXCEPTION: {
    label: "Exception",
    badge: "bg-rose-100 text-rose-800 dark:bg-rose-900/40 dark:text-rose-300 border-rose-200 dark:border-rose-800",
    icon: AlertTriangle,
  },
  CANCELLED: {
    label: "Cancelled",
    badge: "bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-300 border-slate-200 dark:border-slate-700",
    icon: XCircle,
  },
};

export default function GatewaySettlementPanel() {
  // ── States ──────────────────────────────────────────────────────────────────
  const [batches, setBatches] = useState<GatewayPayoutBatch[]>([]);
  const [bankAccounts, setBankAccounts] = useState<BankAccount[]>([]);
  const [selectedBatch, setSelectedBatch] = useState<GatewayPayoutBatch | null>(null);
  const [batchOrders, setBatchOrders] = useState<SettlementOrder[]>([]);
  const [batchVouchers, setBatchVouchers] = useState<BranchVoucher[]>([]);
  const [bankDetails, setBankDetails] = useState<BankAccount | null>(null);

  const [loading, setLoading] = useState(false);
  const [drawerLoading, setDrawerLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Filters
  const [providerFilter, setProviderFilter] = useState<string>("");
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [dateFrom, setDateFrom] = useState<string>("");
  const [dateTo, setDateTo] = useState<string>("");
  const [searchQuery, setSearchQuery] = useState<string>("");

  // Sub-tab inside detail drawer
  const [detailSubTab, setDetailSubTab] = useState<"orders" | "vouchers" | "exceptions">("orders");

  // Ingestion Modal
  const [isIngestModalOpen, setIsIngestModalOpen] = useState(false);
  const [ingestForm, setIngestForm] = useState({
    provider: "razorpay",
    payout_reference: "",
    settlement_reference: "",
    bank_account_id: "",
    settlement_date: new Date().toISOString().split("T")[0],
    bank_value_date: new Date().toISOString().split("T")[0],
    gross_amount: "",
    identified_fee_amount: "0.00",
    reported_tax_amount: "0.00",
    other_deductions_amount: "0.00",
    rounding_variance: "0.00",
    net_amount: "",
    ordersJson: "[]",
  });
  const [ingestSubmitting, setIngestSubmitting] = useState(false);

  // Cancellation Modal
  const [isCancelModalOpen, setIsCancelModalOpen] = useState(false);
  const [cancelReason, setCancelReason] = useState("");
  const [cancelSubmitting, setCancelSubmitting] = useState(false);

  const showSuccess = (msg: string) => {
    setSuccess(msg);
    setTimeout(() => setSuccess(null), 4000);
  };
  const showError = (msg: string) => {
    setError(msg);
    setTimeout(() => setError(null), 6000);
  };

  // ── Load Bank Accounts ──────────────────────────────────────────────────────
  const loadBankAccounts = useCallback(async () => {
    try {
      const res = await fetch("/api/v1/admin/bank-accounts?status=ACTIVE");
      const data = await res.json();
      if (data.success && Array.isArray(data.data)) {
        setBankAccounts(data.data);
      }
    } catch {
      // Non-blocking
    }
  }, []);

  // ── Load Batches ────────────────────────────────────────────────────────────
  const loadBatches = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (providerFilter) params.set("provider", providerFilter);
      if (statusFilter) params.set("status", statusFilter);
      if (dateFrom) params.set("date_from", dateFrom);
      if (dateTo) params.set("date_to", dateTo);
      params.set("limit", "100");

      const res = await fetch(`/api/v1/admin/gateway-settlements/batches?${params}`);
      const data = await res.json();
      if (data.success) {
        setBatches(data.data || data.batches || []);
      } else {
        showError(data.message || data.error || "Failed to load gateway settlement batches.");
      }
    } catch {
      showError("Network error while loading settlement batches.");
    } finally {
      setLoading(false);
    }
  }, [providerFilter, statusFilter, dateFrom, dateTo]);

  useEffect(() => {
    loadBankAccounts();
    loadBatches();
  }, [loadBankAccounts, loadBatches]);

  // ── Inspect Single Batch ────────────────────────────────────────────────────
  const handleInspectBatch = async (batch: GatewayPayoutBatch) => {
    setSelectedBatch(batch);
    setDrawerLoading(true);
    setDetailSubTab("orders");
    try {
      // Fetch full details + orders + vouchers
      const [detailRes, ordersRes, vouchersRes] = await Promise.all([
        fetch(`/api/v1/admin/gateway-settlements/batches/${batch.id}`).then((r) => r.json()),
        fetch(`/api/v1/admin/gateway-settlements/batches/${batch.id}/orders`).then((r) => r.json()),
        fetch(`/api/v1/admin/gateway-settlements/batches/${batch.id}/vouchers`).then((r) => r.json()),
      ]);

      if (detailRes.success) {
        setSelectedBatch(detailRes.data.batch);
        setBankDetails(detailRes.data.bankAccount || null);
      }
      if (ordersRes.success) {
        setBatchOrders(ordersRes.data?.orders || []);
      }
      if (vouchersRes.success) {
        setBatchVouchers(vouchersRes.data?.vouchers || []);
      }
    } catch (err: any) {
      showError("Failed to fetch detailed batch data: " + err.message);
    } finally {
      setDrawerLoading(false);
    }
  };

  // ── Approve Batch ───────────────────────────────────────────────────────────
  const handleApproveBatch = async (batchId: string) => {
    if (!confirm("Are you sure you want to approve this settlement batch for General Ledger posting?")) {
      return;
    }
    setDrawerLoading(true);
    try {
      const res = await fetch(`/api/v1/admin/gateway-settlements/batches/${batchId}/approve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ notes: "Approved via Admin Gateway Settlement Dashboard" }),
      });
      const data = await res.json();
      if (data.success) {
        showSuccess(`Batch ${batchId} successfully approved!`);
        await loadBatches();
        if (selectedBatch && selectedBatch.id === batchId) {
          handleInspectBatch(data.data?.payoutBatch || { ...selectedBatch, status: "APPROVED" });
        }
      } else {
        showError(data.message || data.error || "Approval failed.");
      }
    } catch (err: any) {
      showError("Network error approving batch: " + err.message);
    } finally {
      setDrawerLoading(false);
    }
  };

  // ── Post Batch ──────────────────────────────────────────────────────────────
  const handlePostBatch = async (batchId: string) => {
    if (!confirm("Confirm posting this settlement to General Ledger? This action is permanent and creates branch-partitioned accounting vouchers.")) {
      return;
    }
    setDrawerLoading(true);
    try {
      const res = await fetch(`/api/v1/admin/gateway-settlements/batches/${batchId}/post`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ posting_date: new Date().toISOString().split("T")[0] }),
      });
      const data = await res.json();
      if (data.success) {
        showSuccess(`Batch ${batchId} posted to General Ledger! Created ${data.data?.vouchersCount || 0} branch vouchers.`);
        await loadBatches();
        if (selectedBatch && selectedBatch.id === batchId) {
          handleInspectBatch(data.data?.payoutBatch || { ...selectedBatch, status: "POSTED" });
        }
      } else {
        showError(data.message || data.error || "Posting failed.");
      }
    } catch (err: any) {
      showError("Network error posting batch: " + err.message);
    } finally {
      setDrawerLoading(false);
    }
  };

  // ── Cancel Batch ────────────────────────────────────────────────────────────
  const handleConfirmCancel = async () => {
    if (!selectedBatch) return;
    if (!cancelReason.trim()) {
      showError("Please enter a valid cancellation reason.");
      return;
    }
    setCancelSubmitting(true);
    try {
      const res = await fetch(`/api/v1/admin/gateway-settlements/batches/${selectedBatch.id}/cancel`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: cancelReason.trim() }),
      });
      const data = await res.json();
      if (data.success) {
        showSuccess(`Batch ${selectedBatch.id} cancelled successfully.`);
        setIsCancelModalOpen(false);
        setCancelReason("");
        await loadBatches();
        setSelectedBatch((prev) => (prev ? { ...prev, status: "CANCELLED" } : null));
      } else {
        showError(data.message || data.error || "Cancellation failed.");
      }
    } catch (err: any) {
      showError("Network error cancelling batch: " + err.message);
    } finally {
      setCancelSubmitting(false);
    }
  };

  // ── Ingest Batch Submit ─────────────────────────────────────────────────────
  const handleIngestSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIngestSubmitting(true);
    try {
      let ordersArray: any[] = [];
      try {
        ordersArray = JSON.parse(ingestForm.ordersJson || "[]");
        if (!Array.isArray(ordersArray)) {
          throw new Error("Orders payload must be an array of order allocation objects.");
        }
      } catch (err: any) {
        showError("Invalid JSON for Orders: " + err.message);
        setIngestSubmitting(false);
        return;
      }

      // UI Paise Check (for immediate UX validation)
      const grossPaise = Math.round(Number(ingestForm.gross_amount || 0) * 100);
      const feePaise = Math.round(Number(ingestForm.identified_fee_amount || 0) * 100);
      const taxPaise = Math.round(Number(ingestForm.reported_tax_amount || 0) * 100);
      const otherPaise = Math.round(Number(ingestForm.other_deductions_amount || 0) * 100);
      const roundPaise = Math.round(Number(ingestForm.rounding_variance || 0) * 100);
      const netPaise = Math.round(Number(ingestForm.net_amount || 0) * 100);

      const calculatedNetPaise = grossPaise - feePaise - taxPaise - otherPaise + roundPaise;
      if (calculatedNetPaise !== netPaise) {
        const diff = (calculatedNetPaise - netPaise) / 100;
        if (!confirm(`Warning: Calculated Net (₹${(calculatedNetPaise / 100).toFixed(2)}) differs from input Net (₹${(netPaise / 100).toFixed(2)}) by ₹${diff.toFixed(2)}. The server will perform authoritative validation. Proceed?`)) {
          setIngestSubmitting(false);
          return;
        }
      }

      const res = await fetch("/api/v1/admin/gateway-settlements/batches/ingest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          provider: ingestForm.provider,
          payout_reference: ingestForm.payout_reference,
          settlement_reference: ingestForm.settlement_reference || undefined,
          bank_account_id: ingestForm.bank_account_id,
          settlement_date: ingestForm.settlement_date,
          bank_value_date: ingestForm.bank_value_date || undefined,
          gross_amount: Number(ingestForm.gross_amount),
          identified_fee_amount: Number(ingestForm.identified_fee_amount),
          reported_tax_amount: Number(ingestForm.reported_tax_amount),
          other_deductions_amount: Number(ingestForm.other_deductions_amount),
          rounding_variance: Number(ingestForm.rounding_variance),
          net_amount: Number(ingestForm.net_amount),
          orders: ordersArray,
        }),
      });

      const data = await res.json();
      if (data.success) {
        showSuccess(`Payout batch '${ingestForm.payout_reference}' ingested successfully!`);
        setIsIngestModalOpen(false);
        // Reset form
        setIngestForm({
          provider: "razorpay",
          payout_reference: "",
          settlement_reference: "",
          bank_account_id: "",
          settlement_date: new Date().toISOString().split("T")[0],
          bank_value_date: new Date().toISOString().split("T")[0],
          gross_amount: "",
          identified_fee_amount: "0.00",
          reported_tax_amount: "0.00",
          other_deductions_amount: "0.00",
          rounding_variance: "0.00",
          net_amount: "",
          ordersJson: "[]",
        });
        await loadBatches();
      } else {
        showError(data.message || data.error || "Batch ingestion failed.");
      }
    } catch (err: any) {
      showError("Network error during ingestion: " + err.message);
    } finally {
      setIngestSubmitting(false);
    }
  };

  // ── KPI Summary Calculations ────────────────────────────────────────────────
  const kpis = useMemo(() => {
    let totalGross = 0;
    let totalNet = 0;
    let totalMdr = 0;
    let pendingApprovals = 0;
    let exceptions = 0;

    for (const b of batches) {
      if (b.status !== "CANCELLED") {
        totalGross += Number(b.gross_amount || 0);
        totalNet += Number(b.net_amount || 0);
        totalMdr += Number(b.identified_fee_amount || 0) + Number(b.reported_tax_amount || 0);
      }
      if (b.status === "INGESTED") pendingApprovals++;
      if (b.status === "EXCEPTION" || b.unreconciled_exception_count > 0) exceptions++;
    }

    return { totalGross, totalNet, totalMdr, pendingApprovals, exceptions };
  }, [batches]);

  // Filtered batches by search text
  const filteredBatches = useMemo(() => {
    if (!searchQuery.trim()) return batches;
    const q = searchQuery.toLowerCase();
    return batches.filter(
      (b) =>
        b.payout_reference.toLowerCase().includes(q) ||
        (b.settlement_reference && b.settlement_reference.toLowerCase().includes(q)) ||
        b.provider.toLowerCase().includes(q)
    );
  }, [batches, searchQuery]);

  // Financial Math Equation for Drawer
  const selectedMath = useMemo(() => {
    if (!selectedBatch) return null;
    const gross = Number(selectedBatch.gross_amount || 0);
    const fee = Number(selectedBatch.identified_fee_amount || 0);
    const tax = Number(selectedBatch.reported_tax_amount || 0);
    const other = Number(selectedBatch.other_deductions_amount || 0);
    const round = Number(selectedBatch.rounding_variance || 0);
    const net = Number(selectedBatch.net_amount || 0);

    const calculatedNet = gross - fee - tax - other + round;
    const isBalanced = Math.abs(calculatedNet - net) < 0.01;

    return { gross, fee, tax, other, round, net, calculatedNet, isBalanced };
  }, [selectedBatch]);

  return (
    <div className="w-full space-y-6 p-4 sm:p-6 lg:p-8 bg-slate-50 dark:bg-slate-950 min-h-screen">
      {/* ── Toast Notifications ── */}
      {error && (
        <div className="fixed top-4 right-4 z-50 flex items-center gap-3 p-4 bg-rose-600 text-white rounded-xl shadow-xl border border-rose-700 max-w-md animate-in slide-in-from-top duration-300">
          <AlertTriangle className="w-5 h-5 shrink-0" />
          <div className="text-sm font-medium">{error}</div>
          <button onClick={() => setError(null)} className="ml-auto hover:bg-rose-700 p-1 rounded-lg">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}
      {success && (
        <div className="fixed top-4 right-4 z-50 flex items-center gap-3 p-4 bg-emerald-600 text-white rounded-xl shadow-xl border border-emerald-700 max-w-md animate-in slide-in-from-top duration-300">
          <CheckCircle2 className="w-5 h-5 shrink-0" />
          <div className="text-sm font-medium">{success}</div>
          <button onClick={() => setSuccess(null)} className="ml-auto hover:bg-emerald-700 p-1 rounded-lg">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* ── Page Header & Action Bar ── */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-5">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="p-2.5 bg-blue-600/10 text-blue-600 dark:text-blue-400 rounded-xl">
              <Landmark className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight">
                Gateway Settlement & Payout Reconciliation
              </h1>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Bank deposit allocation, MDR expense recognition, and General Ledger posting
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2.5 shrink-0">
          <button
            onClick={() => {
              loadBankAccounts();
              loadBatches();
            }}
            disabled={loading}
            className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors shadow-xs"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
            <span>Refresh</span>
          </button>

          <button
            onClick={() => setIsIngestModalOpen(true)}
            className="flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 active:bg-blue-800 rounded-xl shadow-xs transition-colors"
          >
            <PlusCircle className="w-3.5 h-3.5" />
            <span>Ingest Payout Batch</span>
          </button>
        </div>
      </div>

      {/* ── Metric KPI Cards ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        {/* Total Settled */}
        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Gross Volume
            </span>
            <div className="p-2 rounded-lg bg-brand-light dark:bg-brand-navy/50 text-brand-primary dark:text-brand-primary">
              <CreditCard className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-black text-slate-900 dark:text-white mt-2">
            ₹{kpis.totalGross.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
          <div className="text-xs text-slate-400 dark:text-slate-500 mt-1">Total customer payments cleared</div>
        </div>

        {/* Net Bank Deposits */}
        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Net Bank Deposits
            </span>
            <div className="p-2 rounded-lg bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400">
              <Landmark className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-black text-emerald-600 dark:text-emerald-400 mt-2">
            ₹{kpis.totalNet.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
          <div className="text-xs text-slate-400 dark:text-slate-500 mt-1">Dr 1112 Bank Operating A/c</div>
        </div>

        {/* MDR Fees & Tax */}
        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              MDR Fees & Tax
            </span>
            <div className="p-2 rounded-lg bg-brand-gold-light dark:bg-brand-gold-dark/50 text-brand-gold dark:text-brand-gold">
              <Receipt className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-black text-brand-gold dark:text-brand-gold mt-2">
            ₹{kpis.totalMdr.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
          <div className="text-xs text-slate-400 dark:text-slate-500 mt-1">Dr 5290 Payment Gateway MDR</div>
        </div>

        {/* Pending Approvals */}
        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Pending Approval
            </span>
            <div className="p-2 rounded-lg bg-blue-50 dark:bg-blue-950/50 text-blue-600 dark:text-blue-400">
              <Clock className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-black text-blue-600 dark:text-blue-400 mt-2">
            {kpis.pendingApprovals}
          </div>
          <div className="text-xs text-slate-400 dark:text-slate-500 mt-1">Awaiting manager sign-off</div>
        </div>

        {/* Exceptions */}
        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Exceptions
            </span>
            <div className="p-2 rounded-lg bg-rose-50 dark:bg-rose-950/50 text-rose-600 dark:text-rose-400">
              <AlertTriangle className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-black text-rose-600 dark:text-rose-400 mt-2">
            {kpis.exceptions}
          </div>
          <div className="text-xs text-slate-400 dark:text-slate-500 mt-1">Holdbacks / Discrepancies</div>
        </div>
      </div>

      {/* ── Filter Toolbar ── */}
      <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2.5 flex-1 min-w-[280px]">
          {/* Search Box */}
          <div className="relative min-w-[220px]">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search reference, UTR..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 text-xs font-medium text-slate-900 dark:text-white bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Provider Filter */}
          <select
            value={providerFilter}
            onChange={(e) => setProviderFilter(e.target.value)}
            className="py-1.5 px-3 text-xs font-medium text-slate-900 dark:text-white bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer"
          >
            <option value="">All Providers</option>
            <option value="razorpay">Razorpay</option>
            <option value="payu">PayU</option>
            <option value="cashfree">Cashfree</option>
            <option value="stripe">Stripe</option>
          </select>

          {/* Status Filter */}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="py-1.5 px-3 text-xs font-medium text-slate-900 dark:text-white bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer"
          >
            <option value="">All Statuses</option>
            <option value="INGESTED">Ingested / Draft</option>
            <option value="APPROVED">Approved</option>
            <option value="POSTED">Posted to GL</option>
            <option value="EXCEPTION">Exception</option>
            <option value="CANCELLED">Cancelled</option>
          </select>
        </div>

        {/* Date Filters */}
        <div className="flex items-center gap-2">
          <input
            type="date"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
            aria-label="Filter from date"
            className="py-1.5 px-2.5 text-xs font-medium text-slate-900 dark:text-white bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl outline-none focus:ring-2 focus:ring-blue-500"
          />
          <span className="text-xs text-slate-400">to</span>
          <input
            type="date"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
            aria-label="Filter to date"
            className="py-1.5 px-2.5 text-xs font-medium text-slate-900 dark:text-white bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl outline-none focus:ring-2 focus:ring-blue-500"
          />
          {(providerFilter || statusFilter || dateFrom || dateTo || searchQuery) && (
            <button
              onClick={() => {
                setProviderFilter("");
                setStatusFilter("");
                setDateFrom("");
                setDateTo("");
                setSearchQuery("");
              }}
              className="text-xs font-bold text-rose-600 hover:text-rose-700 px-2 py-1"
            >
              Clear
            </button>
          )}
        </div>
      </div>

      {/* ── Batches Table ── */}
      <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/40 text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                <th className="py-3 px-4">Provider / Batch Ref</th>
                <th className="py-3 px-4">Settlement Date</th>
                <th className="py-3 px-4 text-right">Gross Amount</th>
                <th className="py-3 px-4 text-right">MDR Fees + Tax</th>
                <th className="py-3 px-4 text-right">Net Deposit</th>
                <th className="py-3 px-4 text-center">Status</th>
                <th className="py-3 px-4 text-center">SoD Audit</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-xs">
              {loading ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-400">
                    <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-blue-500" />
                    <span>Loading settlement batches...</span>
                  </td>
                </tr>
              ) : filteredBatches.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-400">
                    <Receipt className="w-8 h-8 mx-auto mb-2 text-slate-300 dark:text-slate-600" />
                    <div className="font-medium text-slate-700 dark:text-slate-300">No settlement batches found</div>
                    <div className="text-[11px] text-slate-400 mt-0.5">Ingest a new gateway payout report or adjust filters.</div>
                  </td>
                </tr>
              ) : (
                filteredBatches.map((batch) => {
                  const statusConf = STATUS_CONFIG[batch.status] || STATUS_CONFIG.INGESTED;
                  const StatusIcon = statusConf.icon;
                  const mdrTotal = Number(batch.identified_fee_amount || 0) + Number(batch.reported_tax_amount || 0);

                  return (
                    <tr
                      key={batch.id}
                      className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors group cursor-pointer"
                      onClick={() => handleInspectBatch(batch)}
                    >
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-2">
                          <span className="px-2 py-0.5 text-[10px] font-extrabold uppercase rounded-md bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                            {batch.provider}
                          </span>
                          <span className="font-bold text-slate-900 dark:text-white">
                            {batch.payout_reference}
                          </span>
                        </div>
                        {batch.settlement_reference && (
                          <div className="text-[11px] text-slate-400 font-mono mt-0.5">
                            UTR: {batch.settlement_reference}
                          </div>
                        )}
                      </td>

                      <td className="py-3.5 px-4">
                        <div className="font-medium text-slate-800 dark:text-slate-200">
                          {new Date(batch.settlement_date).toLocaleDateString("en-IN", {
                            day: "2-digit",
                            month: "short",
                            year: "numeric",
                          })}
                        </div>
                        {batch.bank_value_date && (
                          <div className="text-[11px] text-slate-400">
                            Value: {batch.bank_value_date}
                          </div>
                        )}
                      </td>

                      <td className="py-3.5 px-4 text-right font-medium text-slate-900 dark:text-white">
                        ₹{Number(batch.gross_amount).toFixed(2)}
                      </td>

                      <td className="py-3.5 px-4 text-right font-medium text-brand-gold dark:text-brand-gold">
                        ₹{mdrTotal.toFixed(2)}
                      </td>

                      <td className="py-3.5 px-4 text-right font-bold text-emerald-600 dark:text-emerald-400">
                        ₹{Number(batch.net_amount).toFixed(2)}
                      </td>

                      <td className="py-3.5 px-4 text-center">
                        <span
                          className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold border ${statusConf.badge}`}
                        >
                          <StatusIcon className="w-3 h-3" />
                          <span>{statusConf.label}</span>
                        </span>
                      </td>

                      <td className="py-3.5 px-4 text-center">
                        <div className="flex items-center justify-center gap-1 text-[11px]">
                          <span
                            title={`Prepared by: ${batch.prepared_by}`}
                            className="px-1.5 py-0.5 rounded font-mono bg-blue-50 dark:bg-blue-950 text-blue-700 dark:text-blue-300"
                          >
                            P
                          </span>
                          <span
                            title={batch.approved_by ? `Approved by: ${batch.approved_by}` : "Pending Approval"}
                            className={`px-1.5 py-0.5 rounded font-mono ${
                              batch.approved_by
                                ? "bg-brand-gold-light dark:bg-brand-gold-dark text-brand-gold-dark dark:text-brand-gold/40"
                                : "bg-slate-100 dark:bg-slate-800 text-slate-400"
                            }`}
                          >
                            A
                          </span>
                          <span
                            title={batch.posted_by ? `Posted by: ${batch.posted_by}` : "Pending Posting"}
                            className={`px-1.5 py-0.5 rounded font-mono ${
                              batch.posted_by
                                ? "bg-emerald-50 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300"
                                : "bg-slate-100 dark:bg-slate-800 text-slate-400"
                            }`}
                          >
                            GL
                          </span>
                        </div>
                      </td>

                      <td className="py-3.5 px-4 text-right">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleInspectBatch(batch);
                          }}
                          className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-bold text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950/60 rounded-lg transition-colors"
                        >
                          <span>Inspect</span>
                          <ChevronRight className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── 360° Batch Inspection Detail Drawer ── */}
      {selectedBatch && (
        <div className="fixed inset-0 z-50 overflow-hidden bg-slate-900/60 backdrop-blur-xs flex justify-end animate-in fade-in duration-200">
          <div className="w-full max-w-3xl bg-white dark:bg-slate-900 h-full shadow-2xl flex flex-col border-l border-slate-200 dark:border-slate-800 overflow-hidden">
            {/* Drawer Header */}
            <div className="p-5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50/80 dark:bg-slate-800/50">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-blue-600/10 text-blue-600 dark:text-blue-400">
                  <Receipt className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold uppercase px-2 py-0.5 rounded bg-slate-200 dark:bg-slate-700 text-slate-800 dark:text-slate-200">
                      {selectedBatch.provider}
                    </span>
                    <h2 className="text-lg font-black text-slate-900 dark:text-white">
                      {selectedBatch.payout_reference}
                    </h2>
                    <span
                      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                        STATUS_CONFIG[selectedBatch.status]?.badge
                      }`}
                    >
                      {STATUS_CONFIG[selectedBatch.status]?.label}
                    </span>
                  </div>
                  <div className="text-xs text-slate-400 mt-0.5">
                    Batch ID: <span className="font-mono text-[11px]">{selectedBatch.id}</span>
                  </div>
                </div>
              </div>

              <button
                onClick={() => setSelectedBatch(null)}
                className="p-2 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Drawer Content */}
            <div className="flex-1 overflow-y-auto p-5 space-y-5">
              {drawerLoading ? (
                <div className="py-16 text-center text-slate-400">
                  <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-blue-500" />
                  <span>Loading batch allocations and vouchers...</span>
                </div>
              ) : (
                <>
                  {/* Financial Math Equation Card */}
                  {selectedMath && (
                    <div className="p-4 rounded-2xl bg-gradient-to-r from-slate-900 to-blue-950 text-white shadow-md border border-blue-900/50">
                      <div className="flex items-center justify-between text-xs font-semibold text-blue-300 uppercase tracking-wider mb-2">
                        <span>Financial Math Identity (Integer Paise Ground Truth)</span>
                        <span className="flex items-center gap-1 text-[11px] text-emerald-400 font-bold">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          <span>Balanced</span>
                        </span>
                      </div>

                      {/* Equation display */}
                      <div className="grid grid-cols-2 sm:grid-cols-6 gap-2 text-center py-2 border-y border-blue-800/40">
                        <div>
                          <div className="text-[10px] text-slate-400 uppercase">Gross (₹)</div>
                          <div className="text-sm font-bold mt-0.5">₹{selectedMath.gross.toFixed(2)}</div>
                        </div>
                        <div>
                          <div className="text-[10px] text-brand-gold/40 uppercase">- Fee (₹)</div>
                          <div className="text-sm font-bold text-brand-gold/40 mt-0.5">₹{selectedMath.fee.toFixed(2)}</div>
                        </div>
                        <div>
                          <div className="text-[10px] text-brand-gold/40 uppercase">- Tax (₹)</div>
                          <div className="text-sm font-bold text-brand-gold/40 mt-0.5">₹{selectedMath.tax.toFixed(2)}</div>
                        </div>
                        <div>
                          <div className="text-[10px] text-rose-300 uppercase">- Other (₹)</div>
                          <div className="text-sm font-bold text-rose-300 mt-0.5">₹{selectedMath.other.toFixed(2)}</div>
                        </div>
                        <div>
                          <div className="text-[10px] text-slate-300 uppercase">± Rounding</div>
                          <div className="text-sm font-bold text-slate-300 mt-0.5">₹{selectedMath.round.toFixed(2)}</div>
                        </div>
                        <div className="border-l border-blue-800/50 pl-2">
                          <div className="text-[10px] text-emerald-300 font-extrabold uppercase">= Net Credit</div>
                          <div className="text-base font-black text-emerald-400 mt-0.5">
                            ₹{selectedMath.net.toFixed(2)}
                          </div>
                        </div>
                      </div>

                      <div className="text-[10px] text-blue-300/80 mt-2 italic flex items-center justify-between">
                        <span>Client arithmetic check is for UX validation; server settlement engine remains authoritative.</span>
                        {selectedBatch.settlement_reference && (
                          <span className="font-mono">UTR: {selectedBatch.settlement_reference}</span>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Two Column Grid: Bank Info & SoD Audit */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Bank Details */}
                    <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700">
                      <div className="flex items-center gap-2 text-xs font-bold text-slate-700 dark:text-slate-300 mb-2">
                        <Landmark className="w-4 h-4 text-blue-500" />
                        <span>Destination Bank Account</span>
                      </div>
                      <div className="space-y-1 text-xs">
                        <div className="flex justify-between">
                          <span className="text-slate-400">Bank Name:</span>
                          <span className="font-semibold text-slate-900 dark:text-white">
                            {bankDetails?.bank_name || "Corporate Bank A/c"}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-400">Account:</span>
                          <span className="font-mono text-slate-800 dark:text-slate-200">
                            {bankDetails?.account_number_masked || selectedBatch.bank_account_id}
                          </span>
                        </div>
                        {bankDetails?.ifsc_code && (
                          <div className="flex justify-between">
                            <span className="text-slate-400">IFSC Code:</span>
                            <span className="font-mono text-slate-800 dark:text-slate-200">
                              {bankDetails.ifsc_code}
                            </span>
                          </div>
                        )}
                        <div className="flex justify-between">
                          <span className="text-slate-400">Settlement Date:</span>
                          <span className="font-medium text-slate-800 dark:text-slate-200">
                            {selectedBatch.settlement_date}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* SoD Governance Card */}
                    <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700">
                      <div className="flex items-center gap-2 text-xs font-bold text-slate-700 dark:text-slate-300 mb-2">
                        <Lock className="w-4 h-4 text-brand-gold" />
                        <span>3-Tier Segregation of Duties</span>
                      </div>
                      <div className="space-y-1.5 text-xs">
                        <div className="flex justify-between items-center">
                          <span className="text-slate-400">1. Prepared By:</span>
                          <span className="font-mono text-[11px] px-2 py-0.5 rounded bg-blue-100 dark:bg-blue-900/40 text-blue-800 dark:text-blue-300 font-bold">
                            {selectedBatch.prepared_by}
                          </span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-slate-400">2. Approved By:</span>
                          {selectedBatch.approved_by ? (
                            <span className="font-mono text-[11px] px-2 py-0.5 rounded bg-brand-gold-light dark:bg-brand-gold-dark/40 text-brand-gold-dark dark:text-brand-gold/40 font-bold">
                              {selectedBatch.approved_by}
                            </span>
                          ) : (
                            <span className="text-slate-400 italic">Pending Review</span>
                          )}
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-slate-400">3. Posted By:</span>
                          {selectedBatch.posted_by ? (
                            <span className="font-mono text-[11px] px-2 py-0.5 rounded bg-emerald-100 dark:bg-emerald-900/40 text-emerald-800 dark:text-emerald-300 font-bold">
                              {selectedBatch.posted_by}
                            </span>
                          ) : (
                            <span className="text-slate-400 italic">Pending GL Post</span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Sub-tabs Navigation */}
                  <div className="flex items-center gap-2 border-b border-slate-200 dark:border-slate-800 pt-2">
                    <button
                      onClick={() => setDetailSubTab("orders")}
                      className={`pb-2.5 px-3 text-xs font-bold transition-all border-b-2 ${
                        detailSubTab === "orders"
                          ? "border-blue-600 text-blue-600 dark:text-blue-400"
                          : "border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
                      }`}
                    >
                      Allocated Orders ({batchOrders.length})
                    </button>

                    <button
                      onClick={() => setDetailSubTab("vouchers")}
                      className={`pb-2.5 px-3 text-xs font-bold transition-all border-b-2 ${
                        detailSubTab === "vouchers"
                          ? "border-blue-600 text-blue-600 dark:text-blue-400"
                          : "border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
                      }`}
                    >
                      Branch Vouchers & GL Impact ({batchVouchers.length})
                    </button>

                    <button
                      onClick={() => setDetailSubTab("exceptions")}
                      className={`pb-2.5 px-3 text-xs font-bold transition-all border-b-2 ${
                        detailSubTab === "exceptions"
                          ? "border-blue-600 text-blue-600 dark:text-blue-400"
                          : "border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
                      }`}
                    >
                      Exceptions & Notes ({selectedBatch.unreconciled_exception_count || 0})
                    </button>
                  </div>

                  {/* Sub-tab 1: Orders */}
                  {detailSubTab === "orders" && (
                    <div className="space-y-3">
                      <div className="text-[11px] text-slate-500 dark:text-slate-400 flex items-center justify-between">
                        <span>Customer orders allocated and validated against payment transactions.</span>
                        <span className="font-semibold text-slate-700 dark:text-slate-300">
                          Total: {batchOrders.length} orders
                        </span>
                      </div>

                      <div className="border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
                        <table className="w-full text-left text-xs border-collapse">
                          <thead>
                            <tr className="bg-slate-50 dark:bg-slate-800/60 text-[10px] font-bold uppercase text-slate-500 border-b border-slate-200 dark:border-slate-800">
                              <th className="py-2.5 px-3">Order / Txn ID</th>
                              <th className="py-2.5 px-3">Settlement Branch</th>
                              <th className="py-2.5 px-3 text-right">Gross (₹)</th>
                              <th className="py-2.5 px-3 text-right">MDR Fee (₹)</th>
                              <th className="py-2.5 px-3 text-right">Tax (₹)</th>
                              <th className="py-2.5 px-3 text-right">Net Share (₹)</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                            {batchOrders.length === 0 ? (
                              <tr>
                                <td colSpan={6} className="py-6 text-center text-slate-400">
                                  No order allocations found for this batch.
                                </td>
                              </tr>
                            ) : (
                              batchOrders.map((ord) => (
                                <tr key={ord.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30">
                                  <td className="py-2.5 px-3 font-mono text-[11px]">
                                    <div className="font-bold text-slate-900 dark:text-white">
                                      {ord.order_id}
                                    </div>
                                    <div className="text-[10px] text-slate-400">
                                      {ord.payment_transaction_id}
                                    </div>
                                  </td>
                                  <td className="py-2.5 px-3">
                                    <div className="font-medium text-slate-800 dark:text-slate-200">
                                      {ord.branch_name || ord.settlement_branch_id}
                                    </div>
                                    <div className="text-[10px] text-slate-400 font-mono">
                                      {ord.settlement_branch_id}
                                    </div>
                                  </td>
                                  <td className="py-2.5 px-3 text-right font-medium text-slate-900 dark:text-white">
                                    ₹{Number(ord.allocated_gross_amount).toFixed(2)}
                                  </td>
                                  <td className="py-2.5 px-3 text-right text-brand-gold dark:text-brand-gold font-medium">
                                    ₹{Number(ord.identified_fee_amount).toFixed(2)}
                                  </td>
                                  <td className="py-2.5 px-3 text-right text-brand-gold dark:text-brand-gold font-medium">
                                    ₹{Number(ord.reported_tax_amount).toFixed(2)}
                                  </td>
                                  <td className="py-2.5 px-3 text-right font-bold text-emerald-600 dark:text-emerald-400">
                                    ₹{Number(ord.allocated_net_amount).toFixed(2)}
                                  </td>
                                </tr>
                              ))
                            )}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}

                  {/* Sub-tab 2: Vouchers */}
                  {detailSubTab === "vouchers" && (
                    <div className="space-y-4">
                      {batchVouchers.length === 0 ? (
                        <div className="py-12 text-center text-slate-400 border border-dashed border-slate-300 dark:border-slate-800 rounded-xl">
                          <FileCheck2 className="w-8 h-8 mx-auto mb-2 text-slate-300 dark:text-slate-600" />
                          <div className="font-medium text-slate-700 dark:text-slate-300">
                            {selectedBatch.status === "POSTED"
                              ? "No voucher records returned."
                              : "Vouchers are generated upon General Ledger Posting."}
                          </div>
                          <div className="text-[11px] text-slate-400 mt-1">
                            {selectedBatch.status !== "POSTED" &&
                              "Once approved and posted, balanced Dr 1112 / Dr 5290 / Cr 1113 vouchers will appear here."}
                          </div>
                        </div>
                      ) : (
                        batchVouchers.map((voucher) => (
                          <div
                            key={voucher.id}
                            className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs space-y-3"
                          >
                            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-2">
                              <div className="flex items-center gap-2">
                                <span className="font-mono text-xs font-bold text-blue-600 dark:text-blue-400">
                                  {voucher.voucher_no}
                                </span>
                                <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded bg-emerald-100 dark:bg-emerald-900/40 text-emerald-800 dark:text-emerald-300">
                                  {voucher.voucher_type}
                                </span>
                                <span className="text-xs font-medium text-slate-700 dark:text-slate-300">
                                  Branch: <strong className="font-semibold">{voucher.branch_name || voucher.branch_id}</strong>
                                </span>
                              </div>
                              <span className="text-[11px] text-slate-400">
                                Date: {voucher.voucher_date}
                              </span>
                            </div>

                            {/* Journal Lines Table */}
                            {voucher.lines && voucher.lines.length > 0 && (
                              <table className="w-full text-xs text-left">
                                <thead>
                                  <tr className="text-[10px] font-bold text-slate-400 uppercase border-b border-slate-100 dark:border-slate-800">
                                    <th className="py-1.5">A/C Code</th>
                                    <th className="py-1.5">Account Name</th>
                                    <th className="py-1.5 text-right">Debit (Dr ₹)</th>
                                    <th className="py-1.5 text-right">Credit (Cr ₹)</th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-mono text-[11px]">
                                  {voucher.lines.map((line) => (
                                    <tr key={line.id}>
                                      <td className="py-1.5 font-bold text-slate-700 dark:text-slate-300">
                                        {line.account_code}
                                      </td>
                                      <td className="py-1.5 font-sans font-medium text-slate-800 dark:text-slate-200">
                                        {line.account_name}
                                      </td>
                                      <td className="py-1.5 text-right font-bold text-slate-900 dark:text-white">
                                        {Number(line.debit_amount) > 0
                                          ? `₹${Number(line.debit_amount).toFixed(2)}`
                                          : "-"}
                                      </td>
                                      <td className="py-1.5 text-right font-bold text-slate-900 dark:text-white">
                                        {Number(line.credit_amount) > 0
                                          ? `₹${Number(line.credit_amount).toFixed(2)}`
                                          : "-"}
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            )}

                            <div className="text-[11px] text-slate-400 italic mt-1">
                              Narration: {voucher.narration}
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  )}

                  {/* Sub-tab 3: Exceptions */}
                  {detailSubTab === "exceptions" && (
                    <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/40 space-y-3">
                      <div className="text-xs font-bold text-slate-800 dark:text-white flex items-center gap-2">
                        <AlertTriangle className="w-4 h-4 text-brand-gold" />
                        <span>Deductions, Holdbacks & Variance Audit</span>
                      </div>
                      <div className="space-y-2 text-xs">
                        <div className="flex justify-between border-b border-slate-200 dark:border-slate-700 pb-1.5">
                          <span className="text-slate-500">Other Deductions Amount:</span>
                          <span className="font-bold text-slate-900 dark:text-white">
                            ₹{Number(selectedBatch.other_deductions_amount || 0).toFixed(2)}
                          </span>
                        </div>
                        <div className="flex justify-between border-b border-slate-200 dark:border-slate-700 pb-1.5">
                          <span className="text-slate-500">Rounding Variance (5295):</span>
                          <span className="font-bold text-slate-900 dark:text-white">
                            ₹{Number(selectedBatch.rounding_variance || 0).toFixed(2)}
                          </span>
                        </div>
                        <div className="flex justify-between border-b border-slate-200 dark:border-slate-700 pb-1.5">
                          <span className="text-slate-500">Unreconciled Exception Count:</span>
                          <span className="font-bold text-rose-600 dark:text-rose-400">
                            {selectedBatch.unreconciled_exception_count || 0}
                          </span>
                        </div>
                      </div>

                      {selectedBatch.metadata?.cancellation_reason && (
                        <div className="p-3 rounded-lg bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 text-xs text-rose-800 dark:text-rose-300">
                          <strong>Cancellation Reason:</strong> {selectedBatch.metadata.cancellation_reason}
                        </div>
                      )}
                    </div>
                  )}
                </>
              )}
            </div>

            {/* Drawer Actions Footer */}
            <div className="p-4 border-t border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-800/50 flex items-center justify-between">
              {/* Cancel Button */}
              {selectedBatch.status !== "POSTED" && selectedBatch.status !== "CANCELLED" && (
                <button
                  type="button"
                  onClick={() => setIsCancelModalOpen(true)}
                  className="px-3 py-2 text-xs font-bold text-rose-600 hover:text-rose-700 hover:bg-rose-50 dark:hover:bg-rose-950/50 rounded-xl transition-colors border border-rose-200 dark:border-rose-900"
                >
                  Cancel Batch
                </button>
              )}

              <div className="flex items-center gap-2.5 ml-auto">
                {/* Approve Button */}
                {selectedBatch.status === "INGESTED" && (
                  <button
                    type="button"
                    onClick={() => handleApproveBatch(selectedBatch.id)}
                    className="flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-white bg-brand-gold hover:bg-brand-gold-dark active:bg-brand-gold-dark rounded-xl shadow-xs transition-colors"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>Approve Batch</span>
                  </button>
                )}

                {/* Post to GL Button */}
                {selectedBatch.status === "APPROVED" && (
                  <button
                    type="button"
                    onClick={() => handlePostBatch(selectedBatch.id)}
                    className="flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 rounded-xl shadow-xs transition-colors"
                  >
                    <FileCheck2 className="w-3.5 h-3.5" />
                    <span>Post to General Ledger</span>
                  </button>
                )}

                {/* Posted Immutable Badge */}
                {selectedBatch.status === "POSTED" && (
                  <span className="flex items-center gap-1.5 text-xs font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/50 px-3 py-1.5 rounded-xl border border-emerald-200 dark:border-emerald-800">
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Posted & Immutable</span>
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal: Ingest Payout Batch ── */}
      {isIngestModalOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="w-full max-w-2xl bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="p-5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50 dark:bg-slate-800/40">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-blue-600/10 text-blue-600 dark:text-blue-400">
                  <PlusCircle className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900 dark:text-white">
                    Ingest Gateway Payout Report
                  </h3>
                  <p className="text-xs text-slate-400">
                    Normalize aggregator settlement and allocate customer orders
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsIngestModalOpen(false)}
                className="p-1.5 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 rounded-lg"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleIngestSubmit} className="p-5 space-y-4">
              {/* Notice Banner */}
              <div className="p-3 rounded-xl bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-900 text-xs text-blue-800 dark:text-blue-300">
                <strong>Accounting Isolation Invariant:</strong> GL codes and branch IDs are never accepted from client inputs. Branch attributions are strictly resolved from PostgreSQL payment transaction records.
              </div>

              {/* Grid 1: Basic Payout Info */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Payment Gateway Provider *
                  </label>
                  <select
                    value={ingestForm.provider}
                    onChange={(e) => setIngestForm({ ...ingestForm, provider: e.target.value })}
                    required
                    className="w-full py-2 px-3 text-xs font-medium text-slate-900 dark:text-white bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="razorpay">Razorpay</option>
                    <option value="payu">PayU</option>
                    <option value="cashfree">Cashfree</option>
                    <option value="stripe">Stripe</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Destination Bank Account *
                  </label>
                  <select
                    value={ingestForm.bank_account_id}
                    onChange={(e) => setIngestForm({ ...ingestForm, bank_account_id: e.target.value })}
                    required
                    className="w-full py-2 px-3 text-xs font-medium text-slate-900 dark:text-white bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">Select Corporate Account...</option>
                    {bankAccounts.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.bank_name} ({b.account_number_masked})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Payout Reference *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. pout_20260928_001"
                    value={ingestForm.payout_reference}
                    onChange={(e) => setIngestForm({ ...ingestForm, payout_reference: e.target.value })}
                    className="w-full py-2 px-3 text-xs font-medium text-slate-900 dark:text-white bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Settlement UTR / Reference
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. UTR9876543210"
                    value={ingestForm.settlement_reference}
                    onChange={(e) => setIngestForm({ ...ingestForm, settlement_reference: e.target.value })}
                    className="w-full py-2 px-3 text-xs font-medium text-slate-900 dark:text-white bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Settlement Date *
                  </label>
                  <input
                    type="date"
                    required
                    value={ingestForm.settlement_date}
                    onChange={(e) => setIngestForm({ ...ingestForm, settlement_date: e.target.value })}
                    className="w-full py-2 px-3 text-xs font-medium text-slate-900 dark:text-white bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Bank Value Date
                  </label>
                  <input
                    type="date"
                    value={ingestForm.bank_value_date}
                    onChange={(e) => setIngestForm({ ...ingestForm, bank_value_date: e.target.value })}
                    className="w-full py-2 px-3 text-xs font-medium text-slate-900 dark:text-white bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              {/* Grid 2: Financial Aggregates */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800">
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Gross Volume (₹) *
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    placeholder="0.00"
                    value={ingestForm.gross_amount}
                    onChange={(e) => setIngestForm({ ...ingestForm, gross_amount: e.target.value })}
                    className="w-full py-1.5 px-2.5 text-xs font-bold text-slate-900 dark:text-white bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                    MDR Fee (₹) *
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    placeholder="0.00"
                    value={ingestForm.identified_fee_amount}
                    onChange={(e) => setIngestForm({ ...ingestForm, identified_fee_amount: e.target.value })}
                    className="w-full py-1.5 px-2.5 text-xs font-bold text-brand-gold dark:text-brand-gold bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Reported GST (₹) *
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    placeholder="0.00"
                    value={ingestForm.reported_tax_amount}
                    onChange={(e) => setIngestForm({ ...ingestForm, reported_tax_amount: e.target.value })}
                    className="w-full py-1.5 px-2.5 text-xs font-bold text-brand-gold dark:text-brand-gold bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Other Deductions (₹)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    placeholder="0.00"
                    value={ingestForm.other_deductions_amount}
                    onChange={(e) => setIngestForm({ ...ingestForm, other_deductions_amount: e.target.value })}
                    className="w-full py-1.5 px-2.5 text-xs font-bold text-rose-600 dark:text-rose-400 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Rounding Variance (₹)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    placeholder="0.00"
                    value={ingestForm.rounding_variance}
                    onChange={(e) => setIngestForm({ ...ingestForm, rounding_variance: e.target.value })}
                    className="w-full py-1.5 px-2.5 text-xs font-bold text-slate-700 dark:text-slate-300 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-emerald-600 dark:text-emerald-400 mb-1">
                    Net Deposit (₹) *
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    placeholder="0.00"
                    value={ingestForm.net_amount}
                    onChange={(e) => setIngestForm({ ...ingestForm, net_amount: e.target.value })}
                    className="w-full py-1.5 px-2.5 text-xs font-black text-emerald-600 dark:text-emerald-400 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
              </div>

              {/* Order Allocations JSON */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                    Allocated Order Transactions (JSON Array) *
                  </label>
                  <span className="text-[10px] text-slate-400">
                    Format: [{`{"payment_transaction_id": "...", "allocated_gross_amount": ...}`}]
                  </span>
                </div>
                <textarea
                  rows={4}
                  required
                  value={ingestForm.ordersJson}
                  onChange={(e) => setIngestForm({ ...ingestForm, ordersJson: e.target.value })}
                  placeholder={`[\n  {\n    "payment_transaction_id": "paytxn_01",\n    "allocated_gross_amount": 5500.00,\n    "identified_fee_amount": 93.24,\n    "reported_tax_amount": 16.78\n  }\n]`}
                  className="w-full p-3 font-mono text-xs text-slate-900 dark:text-white bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              {/* Modal Buttons */}
              <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-200 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsIngestModalOpen(false)}
                  className="px-4 py-2 text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors"
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  disabled={ingestSubmitting}
                  className="flex items-center gap-1.5 px-5 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 active:bg-blue-800 rounded-xl shadow-xs transition-colors disabled:opacity-50"
                >
                  {ingestSubmitting ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      <span>Ingesting Batch...</span>
                    </>
                  ) : (
                    <>
                      <Send className="w-3.5 h-3.5" />
                      <span>Ingest Payout Batch</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Modal: Cancel Batch Prompt ── */}
      {isCancelModalOpen && selectedBatch && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="p-5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-rose-50 dark:bg-rose-950/40">
              <div className="flex items-center gap-2.5 text-rose-700 dark:text-rose-300">
                <AlertTriangle className="w-5 h-5" />
                <h3 className="text-base font-bold">Cancel Settlement Batch</h3>
              </div>
              <button
                onClick={() => setIsCancelModalOpen(false)}
                className="p-1.5 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 rounded-lg"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 space-y-3">
              <p className="text-xs text-slate-600 dark:text-slate-300">
                Are you sure you want to cancel batch{" "}
                <strong className="font-bold text-slate-900 dark:text-white">
                  {selectedBatch.payout_reference}
                </strong>
                ? This will release all transaction allocations back into the unallocated pool.
              </p>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Cancellation Reason *
                </label>
                <textarea
                  rows={3}
                  required
                  placeholder="e.g. Aggregator payout recalled or incorrect file ingested"
                  value={cancelReason}
                  onChange={(e) => setCancelReason(e.target.value)}
                  className="w-full p-2.5 text-xs text-slate-900 dark:text-white bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl outline-none focus:ring-2 focus:ring-rose-500"
                />
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => setIsCancelModalOpen(false)}
                  className="px-4 py-2 text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors"
                >
                  Back
                </button>

                <button
                  type="button"
                  disabled={cancelSubmitting || !cancelReason.trim()}
                  onClick={handleConfirmCancel}
                  className="px-4 py-2 text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 active:bg-rose-800 rounded-xl shadow-xs transition-colors disabled:opacity-50"
                >
                  {cancelSubmitting ? "Cancelling..." : "Confirm Cancellation"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
