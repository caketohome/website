"use client";

/**
 * CakeToHome ERP — Phase C7.2: Bills Payable Management Panel
 *
 * ARCHITECTURAL DESIGN & INVARIANTS:
 * 1. COMMERCIAL BILLS PAYABLE ENGINE (AP):
 *    - Accounts Payable subledger management for credit purchases and supplier obligations.
 *    - Real-time outstanding calculation: Invoice Total - Debit Notes - SUM(Allocated Payments).
 * 2. FOUR-EYES CONTROLS & RECONCILIATION:
 *    - Multi-bill & single-bill atomic disbursement settlements with GL posting.
 *    - Strict branch boundary enforcement & supplier attribution on Account 2111 (Trade AP).
 * 3. NO HISTORICAL FINANCIAL SPECULATION:
 *    - Fully respects frozen relational foundations and canonical chart of accounts.
 */

import React, { useState, useEffect, useCallback, useMemo, useRef, memo } from "react";
import {
  Receipt,
  Search,
  Filter,
  RefreshCw,
  Building2,
  Calendar,
  AlertTriangle,
  Clock,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  CreditCard,
  Layers,
  ArrowUpDown,
  SlidersHorizontal,
  DollarSign,
  AlertCircle,
} from "lucide-react";
import type {
  BillPayableListItem,
  BillPayableStatus,
  BillsPayableSummary,
  BranchOption,
  SupplierOption,
} from "./bills-payable/types";
import { BillDetailModal } from "./bills-payable/BillDetailModal";
import { PayBillModal } from "./bills-payable/PayBillModal";
import { WidgetErrorBoundary } from "./error-boundary";

export const BillsPayablePanel = memo(function BillsPayablePanel() {
  // Master Data
  const [branches, setBranches] = useState<BranchOption[]>([]);
  const [suppliers, setSuppliers] = useState<SupplierOption[]>([]);
  const [masterLoading, setMasterLoading] = useState(true);

  // List State
  const [bills, setBills] = useState<BillPayableListItem[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Summary KPIs
  const [summary, setSummary] = useState<BillsPayableSummary>({
    total_outstanding: 0,
    overdue_amount: 0,
    due_soon_amount: 0,
    unpaid_count: 0,
    partially_paid_count: 0,
    overdue_count: 0,
    paid_count: 0,
  });

  // Filters State
  const [search, setSearch] = useState("");
  const [selectedBranchId, setSelectedBranchId] = useState<string>("");
  const [selectedSupplierId, setSelectedSupplierId] = useState<string>("");
  const [selectedStatus, setSelectedStatus] = useState<BillPayableStatus | "ALL">("ALL");
  const [page, setPage] = useState(1);
  const limit = 20;

  // Selection for multi-bill settlement
  const [selectedBillIds, setSelectedBillIds] = useState<Set<string>>(new Set());

  // Modals State
  const [detailModalPurchaseId, setDetailModalPurchaseId] = useState<string | null>(null);
  const [payModalBills, setPayModalBills] = useState<any[] | null>(null);

  // ── Load Master Data ───────────────────────────────────────────────────────
  useEffect(() => {
    async function loadMasterData() {
      setMasterLoading(true);
      try {
        const [branchesRes, suppliersRes] = await Promise.all([
          fetch("/api/v1/admin/branches?limit=100").then((r) => r.json()).catch(() => ({ branches: [] })),
          fetch("/api/v1/admin/suppliers?limit=150").then((r) => r.json()).catch(() => ({ suppliers: [] })),
        ]);
        if (branchesRes.branches) setBranches(branchesRes.branches);
        if (suppliersRes.suppliers) setSuppliers(suppliersRes.suppliers);
      } catch (e) {
        console.error("Failed to load master filters:", e);
      } finally {
        setMasterLoading(false);
      }
    }
    loadMasterData();
  }, []);

  // ── Load Summary KPIs ──────────────────────────────────────────────────────
  const loadSummary = useCallback(async () => {
    try {
      const q = new URLSearchParams();
      if (selectedBranchId) q.set("branch_id", selectedBranchId);
      if (selectedSupplierId) q.set("supplier_id", selectedSupplierId);

      const res = await fetch(`/api/v1/admin/bills-payable/summary?${q.toString()}`);
      if (res.ok) {
        const data = await res.json();
        setSummary(data);
      }
    } catch (e) {
      console.error("Failed to load bills summary:", e);
    }
  }, [selectedBranchId, selectedSupplierId]);

  // Race-condition guard for concurrent filter/search requests
  const reqIdRef = useRef<number>(0);

  // ── Load Bills List ────────────────────────────────────────────────────────
  const loadBills = useCallback(async () => {
    const curReqId = ++reqIdRef.current;
    setLoading(true);
    setError(null);
    try {
      const q = new URLSearchParams({
        page: page.toString(),
        limit: limit.toString(),
      });
      if (search.trim()) q.set("search", search.trim());
      if (selectedBranchId) q.set("branch_id", selectedBranchId);
      if (selectedSupplierId) q.set("supplier_id", selectedSupplierId);
      if (selectedStatus !== "ALL") q.set("status", selectedStatus);

      const res = await fetch(`/api/v1/admin/bills-payable?${q.toString()}`);
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || `Failed to fetch bills payable (${res.status})`);
      }

      const data = await res.json();
      if (curReqId === reqIdRef.current) {
        setBills(data.items || data.bills || []);
        setTotalCount(data.total || data.total_count || 0);
      }
    } catch (err: any) {
      if (curReqId === reqIdRef.current) {
        setError(err.message || "Failed to load bills payable.");
      }
    } finally {
      if (curReqId === reqIdRef.current) {
        setLoading(false);
      }
    }
  }, [page, limit, search, selectedBranchId, selectedSupplierId, selectedStatus]);

  useEffect(() => {
    loadBills();
    loadSummary();
  }, [loadBills, loadSummary]);

  // Handle Multi-Select Checkboxes
  const toggleSelectBill = (purchaseId: string) => {
    setSelectedBillIds((prev) => {
      const next = new Set(prev);
      if (next.has(purchaseId)) next.delete(purchaseId);
      else next.add(purchaseId);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedBillIds.size === bills.filter((b) => b.outstanding_amount > 0).length && bills.length > 0) {
      setSelectedBillIds(new Set());
    } else {
      const payableIds = bills.filter((b) => b.outstanding_amount > 0).map((b) => b.purchase_id);
      setSelectedBillIds(new Set(payableIds));
    }
  };

  // Selected bills for payment
  const selectedBillsForPayment = useMemo(() => {
    return bills.filter((b) => selectedBillIds.has(b.purchase_id));
  }, [bills, selectedBillIds]);

  const totalSelectedPayable = useMemo(() => {
    return selectedBillsForPayment.reduce((sum, b) => sum + Number(b.outstanding_amount), 0);
  }, [selectedBillsForPayment]);

  // Open multi-pay modal
  const handleOpenBatchPay = () => {
    if (selectedBillsForPayment.length === 0) return;
    // Check all selected bills belong to same supplier
    const firstSupplier = selectedBillsForPayment[0].supplier_id;
    const sameSupplier = selectedBillsForPayment.every((b) => b.supplier_id === firstSupplier);
    if (!sameSupplier) {
      alert("Multi-bill disbursement requires all selected bills to belong to the same supplier.");
      return;
    }
    setPayModalBills(selectedBillsForPayment);
  };

  const handleOpenSinglePay = (bill: BillPayableListItem) => {
    setPayModalBills([bill]);
  };

  const handlePaymentSuccess = () => {
    setPayModalBills(null);
    setSelectedBillIds(new Set());
    loadBills();
    loadSummary();
  };

  return (
    <WidgetErrorBoundary>
      <div className="space-y-6 pb-12 animate-in fade-in duration-200">
        {/* Header Title & Actions */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400">
                <Receipt className="w-5 h-5" />
              </div>
              <h1 className="text-xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100">
                Bills Payable (AP)
              </h1>
            </div>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
              Supplier Accounts Payable Subledger • Bill-wise Settlement • Four-Eyes GL Posting
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                loadBills();
                loadSummary();
              }}
              disabled={loading}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-zinc-700 dark:text-zinc-300 bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 hover:bg-zinc-50 dark:hover:bg-zinc-750 rounded-xl transition shadow-sm"
              title="Refresh list"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
              <span>Refresh</span>
            </button>
          </div>
        </div>

        {/* Financial KPI Summary Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="p-4 rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-sm">
            <div className="flex items-center justify-between text-xs text-zinc-500 dark:text-zinc-400">
              <span>Total Outstanding</span>
              <DollarSign className="w-4 h-4 text-indigo-500" />
            </div>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">
                ₹{Number(summary.total_outstanding).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
              </span>
            </div>
            <p className="mt-1 text-[11px] text-zinc-400">
              {summary.unpaid_count + summary.partially_paid_count} active unpaid liabilities
            </p>
          </div>

          <div className="p-4 rounded-2xl border border-rose-200/60 dark:border-rose-900/40 bg-rose-50/30 dark:bg-rose-950/20 shadow-sm">
            <div className="flex items-center justify-between text-xs text-rose-700 dark:text-rose-400 font-medium">
              <span>Overdue Liabilities</span>
              <AlertTriangle className="w-4 h-4 text-rose-500" />
            </div>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-2xl font-bold text-rose-700 dark:text-rose-300">
                ₹{Number(summary.overdue_amount).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
              </span>
            </div>
            <p className="mt-1 text-[11px] text-rose-600/80 dark:text-rose-400/80">
              {summary.overdue_count} bills past payment due date
            </p>
          </div>

          <div className="p-4 rounded-2xl border border-amber-200/60 dark:border-amber-900/40 bg-amber-50/30 dark:bg-amber-950/20 shadow-sm">
            <div className="flex items-center justify-between text-xs text-amber-700 dark:text-amber-400 font-medium">
              <span>Due Soon / Current</span>
              <Clock className="w-4 h-4 text-amber-500" />
            </div>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-2xl font-bold text-amber-700 dark:text-amber-300">
                ₹{Number(summary.due_soon_amount).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
              </span>
            </div>
            <p className="mt-1 text-[11px] text-amber-600/80 dark:text-amber-400/80">
              Within authorized credit period
            </p>
          </div>

          <div className="p-4 rounded-2xl border border-emerald-200/60 dark:border-emerald-900/40 bg-emerald-50/30 dark:bg-emerald-950/20 shadow-sm">
            <div className="flex items-center justify-between text-xs text-emerald-700 dark:text-emerald-400 font-medium">
              <span>Fully Settled Bills</span>
              <CheckCircle2 className="w-4 h-4 text-emerald-500" />
            </div>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-2xl font-bold text-emerald-700 dark:text-emerald-300">
                {summary.paid_count}
              </span>
              <span className="text-xs text-emerald-600">bills</span>
            </div>
            <p className="mt-1 text-[11px] text-emerald-600/80 dark:text-emerald-400/80">
              Disbursed with balanced GL audit trail
            </p>
          </div>
        </div>

        {/* Filter Controls Bar */}
        <div className="p-4 rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-sm space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {/* Search */}
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
              <input
                type="text"
                placeholder="Search invoice # or supplier..."
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPage(1);
                }}
                className="w-full pl-9 pr-3 py-2 text-xs rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50/50 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            {/* Branch Filter */}
            <div>
              <select
                value={selectedBranchId}
                onChange={(e) => {
                  setSelectedBranchId(e.target.value);
                  setPage(1);
                }}
                className="w-full px-3 py-2 text-xs rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50/50 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <option value="">All Operating Branches</option>
                {branches.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Supplier Filter */}
            <div>
              <select
                value={selectedSupplierId}
                onChange={(e) => {
                  setSelectedSupplierId(e.target.value);
                  setPage(1);
                }}
                className="w-full px-3 py-2 text-xs rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50/50 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <option value="">All Suppliers</option>
                {suppliers.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Status Filter */}
            <div>
              <select
                value={selectedStatus}
                onChange={(e) => {
                  setSelectedStatus(e.target.value as any);
                  setPage(1);
                }}
                className="w-full px-3 py-2 text-xs rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50/50 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <option value="ALL">All Statuses</option>
                <option value="UNPAID">Unpaid (Full)</option>
                <option value="PARTIALLY_PAID">Partially Paid</option>
                <option value="OVERDUE">Overdue Only</option>
                <option value="PAID">Fully Settled</option>
              </select>
            </div>
          </div>
        </div>

        {/* Batch Selection Banner */}
        {selectedBillIds.size > 0 && (
          <div className="flex items-center justify-between p-3.5 rounded-2xl border border-indigo-200 dark:border-indigo-900/60 bg-indigo-50/60 dark:bg-indigo-950/40 text-xs animate-in slide-in-from-top-2 duration-150">
            <div className="flex items-center gap-3">
              <span className="font-semibold text-indigo-900 dark:text-indigo-200">
                {selectedBillIds.size} bill(s) selected
              </span>
              <span className="text-zinc-400">•</span>
              <span className="text-indigo-800 dark:text-indigo-300">
                Combined Payable: <strong className="font-bold">₹{totalSelectedPayable.toFixed(2)}</strong>
              </span>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setSelectedBillIds(new Set())}
                className="px-3 py-1.5 rounded-lg text-zinc-600 dark:text-zinc-400 hover:bg-indigo-100/60 dark:hover:bg-indigo-900/60 transition"
              >
                Clear
              </button>
              <button
                onClick={handleOpenBatchPay}
                className="inline-flex items-center gap-1.5 px-4 py-1.5 font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl shadow-sm transition"
              >
                <CreditCard className="w-3.5 h-3.5" />
                <span>Pay Selected Bills</span>
              </button>
            </div>
          </div>
        )}

        {/* Error message */}
        {error && (
          <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 dark:bg-rose-950/40 dark:border-rose-900/60 dark:text-rose-300 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Data Table */}
        <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead className="bg-zinc-50 dark:bg-zinc-800/60 text-zinc-500 border-b border-zinc-200 dark:border-zinc-800 font-medium">
                <tr>
                  <th className="py-3 px-3 w-10 text-center">
                    <input
                      type="checkbox"
                      checked={
                        selectedBillIds.size > 0 &&
                        selectedBillIds.size === bills.filter((b) => b.outstanding_amount > 0).length
                      }
                      onChange={toggleSelectAll}
                      className="rounded border-zinc-300 text-indigo-600 focus:ring-indigo-500"
                    />
                  </th>
                  <th className="py-3 px-3">Invoice #</th>
                  <th className="py-3 px-3">Supplier</th>
                  <th className="py-3 px-3">Branch</th>
                  <th className="py-3 px-3">Invoice Date</th>
                  <th className="py-3 px-3">Due Date</th>
                  <th className="py-3 px-3 text-right">Billed Amount</th>
                  <th className="py-3 px-3 text-right">Paid</th>
                  <th className="py-3 px-3 text-right font-semibold">Outstanding</th>
                  <th className="py-3 px-3 text-center">Status</th>
                  <th className="py-3 px-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
                {loading && (
                  <tr>
                    <td colSpan={11} className="py-12 text-center text-zinc-400">
                      <Clock className="w-5 h-5 animate-spin mx-auto mb-2 text-indigo-500" />
                      Loading bills payable register...
                    </td>
                  </tr>
                )}

                {!loading && bills.length === 0 && (
                  <tr>
                    <td colSpan={11} className="py-12 text-center text-zinc-400">
                      <Receipt className="w-8 h-8 mx-auto mb-2 text-zinc-300 dark:text-zinc-600" />
                      No bills payable found matching current criteria.
                    </td>
                  </tr>
                )}

                {!loading &&
                  bills.map((bill) => {
                    const isSelected = selectedBillIds.has(bill.purchase_id);
                    const canPay = bill.outstanding_amount > 0;

                    return (
                      <tr
                        key={bill.purchase_id}
                        className={`hover:bg-zinc-50/70 dark:hover:bg-zinc-800/40 transition ${
                          isSelected ? "bg-indigo-50/30 dark:bg-indigo-950/20" : ""
                        }`}
                      >
                        <td className="py-3 px-3 text-center">
                          <input
                            type="checkbox"
                            disabled={!canPay}
                            checked={isSelected}
                            onChange={() => toggleSelectBill(bill.purchase_id)}
                            className="rounded border-zinc-300 text-indigo-600 focus:ring-indigo-500 disabled:opacity-30"
                          />
                        </td>
                        <td className="py-3 px-3 font-mono font-medium text-zinc-900 dark:text-zinc-100">
                          <button
                            onClick={() => setDetailModalPurchaseId(bill.purchase_id)}
                            className="hover:underline hover:text-indigo-600 text-left"
                          >
                            {bill.invoice_no || bill.purchase_id.substring(0, 8)}
                          </button>
                        </td>
                        <td className="py-3 px-3">
                          <div className="font-medium text-zinc-800 dark:text-zinc-200">
                            {bill.supplier_name}
                          </div>
                          {bill.supplier_gstin && (
                            <span className="text-[10px] font-mono text-zinc-400 block">
                              {bill.supplier_gstin}
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-3 text-zinc-600 dark:text-zinc-400">
                          {bill.branch_name}
                        </td>
                        <td className="py-3 px-3 text-zinc-600 dark:text-zinc-400">
                          {bill.invoice_date
                            ? new Date(bill.invoice_date).toLocaleDateString("en-IN")
                            : "—"}
                        </td>
                        <td className="py-3 px-3">
                          <div className="flex items-center gap-1.5">
                            <span
                              className={`${
                                bill.is_overdue
                                  ? "text-rose-600 font-semibold"
                                  : "text-zinc-600 dark:text-zinc-400"
                              }`}
                            >
                              {bill.due_date
                                ? new Date(bill.due_date).toLocaleDateString("en-IN")
                                : "Immediate"}
                            </span>
                            {bill.is_overdue && (
                              <span className="px-1.5 py-0.2 rounded text-[10px] font-medium bg-rose-100 text-rose-700 dark:bg-rose-950/60 dark:text-rose-400">
                                {bill.days_overdue}d
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="py-3 px-3 text-right font-medium text-zinc-900 dark:text-zinc-100">
                          ₹{Number(bill.total_amount).toFixed(2)}
                        </td>
                        <td className="py-3 px-3 text-right text-emerald-600 dark:text-emerald-400">
                          ₹{Number(bill.paid_amount).toFixed(2)}
                        </td>
                        <td className="py-3 px-3 text-right font-bold text-zinc-900 dark:text-zinc-100">
                          ₹{Number(bill.outstanding_amount).toFixed(2)}
                        </td>
                        <td className="py-3 px-3 text-center">
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${
                              bill.status === "PAID"
                                ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-400"
                                : bill.status === "OVERDUE"
                                ? "bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-400"
                                : bill.status === "PARTIALLY_PAID"
                                ? "bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-400"
                                : "bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300"
                            }`}
                          >
                            {bill.status.replace("_", " ")}
                          </span>
                        </td>
                        <td className="py-3 px-3 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            {canPay && (
                              <button
                                onClick={() => handleOpenSinglePay(bill)}
                                className="px-2.5 py-1 text-[11px] font-medium rounded-lg text-white bg-indigo-600 hover:bg-indigo-700 shadow-sm transition"
                              >
                                Pay
                              </button>
                            )}
                            <button
                              onClick={() => setDetailModalPurchaseId(bill.purchase_id)}
                              className="px-2 py-1 text-[11px] font-medium rounded-lg text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition"
                            >
                              View
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          </div>

          {/* Pagination Footer */}
          <div className="flex items-center justify-between px-4 py-3 border-t border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/60 text-xs">
            <span className="text-zinc-500">
              Showing {bills.length} of {totalCount} total bills
            </span>
            <div className="flex items-center gap-1.5">
              <button
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                className="p-1.5 rounded-lg border border-zinc-200 dark:border-zinc-700 hover:bg-zinc-100 dark:hover:bg-zinc-800 disabled:opacity-40 transition"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className="px-2 text-zinc-700 dark:text-zinc-300">
                Page {page} of {Math.max(1, Math.ceil(totalCount / limit))}
              </span>
              <button
                disabled={page * limit >= totalCount}
                onClick={() => setPage((p) => p + 1)}
                className="p-1.5 rounded-lg border border-zinc-200 dark:border-zinc-700 hover:bg-zinc-100 dark:hover:bg-zinc-800 disabled:opacity-40 transition"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>

        {/* Modals */}
        {detailModalPurchaseId && (
          <BillDetailModal
            purchaseId={detailModalPurchaseId}
            onClose={() => setDetailModalPurchaseId(null)}
            onOpenPay={(b) => handleOpenSinglePay(b)}
          />
        )}

        {payModalBills && (
          <PayBillModal
            bills={payModalBills}
            onClose={() => setPayModalBills(null)}
            onSuccess={handlePaymentSuccess}
          />
        )}
      </div>
    </WidgetErrorBoundary>
  );
});
