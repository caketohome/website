"use client";

/**
 * CakeToHome ERP — Phase C7.4: Corporate AR & Bills Receivable Panel
 *
 * ARCHITECTURAL PRINCIPLES:
 * 1. REAL-TIME AUTHORITATIVE OUTSTANDING:
 *    - All figures derive authoritatively from posted invoices minus returns minus receipts.
 * 2. ORDER-TIED CORPORATE INVOICING & GST:
 *    - Invoices display order links, GST breakdown, customer profile, and due dates.
 * 3. DUE-DATE AGEING MATRIX:
 *    - Ageing strictly derived from due_date: Current, 1–30, 31–60, 61–90, >90 days.
 * 4. MULTI-INVOICE SETTLEMENT & CUSTOMER SUBLEDGER:
 *    - Settle individual or batch invoices under atomic double-entry receipt.
 *    - Full drill-down into Account 1121 customer subledger.
 */

import React, { useState, useEffect, useCallback, useMemo, memo } from "react";
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
  SlidersHorizontal,
  DollarSign,
  AlertCircle,
  BookOpen,
  Bell,
  ArrowRight,
  ShieldCheck,
} from "lucide-react";
import type {
  BillReceivableListItem,
  BillReceivableStatus,
  ArAgeingBucket,
  BillsReceivableSummary,
  BranchOption,
  CorporateCustomerOption,
} from "./bills-receivable/types";
import { ReceiveReceiptModal } from "./bills-receivable/ReceiveReceiptModal";
import { BillReceivableDetailModal } from "./bills-receivable/BillReceivableDetailModal";
import { CustomerLedgerModal } from "./bills-receivable/CustomerLedgerModal";
import { ScheduleReminderModal } from "./bills-receivable/ScheduleReminderModal";
import { WidgetErrorBoundary } from "./error-boundary";

export const BillsReceivablePanel = memo(function BillsReceivablePanel() {
  // Master Data
  const [branches, setBranches] = useState<BranchOption[]>([]);
  const [customers, setCustomers] = useState<CorporateCustomerOption[]>([]);
  const [masterLoading, setMasterLoading] = useState(true);

  // List State
  const [bills, setBills] = useState<BillReceivableListItem[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Summary KPIs
  const [summary, setSummary] = useState<BillsReceivableSummary>({
    total_receivables: 0,
    total_received: 0,
    total_outstanding: 0,
    overdue_amount: 0,
    total_bills_count: 0,
    unpaid_count: 0,
    partially_received_count: 0,
    fully_received_count: 0,
    overdue_count: 0,
    ageing_breakdown: {
      current: 0,
      bucket_1_30: 0,
      bucket_31_60: 0,
      bucket_61_90: 0,
      bucket_over_90: 0,
    },
  });

  // Filters State
  const [search, setSearch] = useState("");
  const [selectedBranchId, setSelectedBranchId] = useState<string>("");
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>("");
  const [selectedStatus, setSelectedStatus] = useState<BillReceivableStatus | "ALL">("ALL");
  const [selectedAgeingBucket, setSelectedAgeingBucket] = useState<ArAgeingBucket | "ALL">("ALL");
  const [page, setPage] = useState(1);
  const limit = 20;

  // Selection for multi-invoice settlement
  const [selectedInvoiceIds, setSelectedInvoiceIds] = useState<Set<string>>(new Set());

  // Modals State
  const [detailModalInvoiceId, setDetailModalInvoiceId] = useState<string | null>(null);
  const [receiptModalInvoices, setReceiptModalInvoices] = useState<any[] | null>(null);
  const [ledgerModalCustomerId, setLedgerModalCustomerId] = useState<string | null>(null);
  const [reminderModalInvoiceId, setReminderModalInvoiceId] = useState<string | null>(null);

  // ── Load Master Data ───────────────────────────────────────────────────────
  useEffect(() => {
    async function loadMasterData() {
      setMasterLoading(true);
      try {
        const [branchesRes, customersRes] = await Promise.all([
          fetch("/api/v1/admin/branches?limit=100").then((r) => r.json()).catch(() => ({ branches: [] })),
          fetch("/api/v1/admin/customers?limit=100").then((r) => r.json()).catch(() => ({ customers: [] })),
        ]);
        if (branchesRes.branches) setBranches(branchesRes.branches);
        if (customersRes.customers) {
          // Filter to corporate or all
          setCustomers(customersRes.customers);
        }
      } catch (e) {
        console.error("Failed to load master filters:", e);
      } finally {
        setMasterLoading(false);
      }
    }
    loadMasterData();
  }, []);

  // ── Load Bills Receivable ──────────────────────────────────────────────────
  const fetchBills = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const qParams = new URLSearchParams();
      if (selectedBranchId) qParams.set("branch_id", selectedBranchId);
      if (selectedCustomerId) qParams.set("customer_id", selectedCustomerId);
      if (selectedStatus !== "ALL") qParams.set("status", selectedStatus);
      if (selectedAgeingBucket !== "ALL") qParams.set("ageing_bucket", selectedAgeingBucket);
      if (search.trim()) qParams.set("search", search.trim());
      qParams.set("limit", limit.toString());
      qParams.set("offset", ((page - 1) * limit).toString());

      const res = await fetch(`/api/v1/admin/bills-receivable?${qParams.toString()}`).then((r) => r.json());

      if (!res.success) {
        throw new Error(res.message || res.error || "Failed to fetch bills receivable");
      }

      setBills(res.bills || res.items || []);
      setTotalCount(res.total_count || res.total || 0);
      if (res.summary) {
        setSummary(res.summary);
      }
    } catch (err: any) {
      setError(err.message || "Failed to load bills receivable");
    } finally {
      setLoading(false);
    }
  }, [selectedBranchId, selectedCustomerId, selectedStatus, selectedAgeingBucket, search, page]);

  useEffect(() => {
    fetchBills();
  }, [fetchBills]);

  // Handle multi-invoice selection
  const toggleSelectInvoice = (id: string) => {
    setSelectedInvoiceIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectAllFiltered = () => {
    if (selectedInvoiceIds.size === bills.length) {
      setSelectedInvoiceIds(new Set());
    } else {
      setSelectedInvoiceIds(new Set(bills.map((b) => b.invoice_id)));
    }
  };

  // Launch multi-invoice receipt modal
  const handleOpenMultiReceipt = () => {
    const selected = bills.filter((b) => selectedInvoiceIds.has(b.invoice_id) && b.outstanding_amount > 0);
    if (selected.length === 0) return;

    // Verify same customer
    const firstCust = selected[0].customer_id;
    const allSame = selected.every((b) => b.customer_id === firstCust);
    if (!allSame) {
      alert("Multi-invoice receipt settlement requires all selected invoices to belong to the same corporate customer.");
      return;
    }

    setReceiptModalInvoices(selected);
  };

  return (
    <WidgetErrorBoundary>
      <div className="w-full space-y-6">
        {/* Top Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2.5">
              <div className="p-2.5 rounded-2xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400">
                <Receipt className="w-6 h-6" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-slate-900 dark:text-white">
                  Corporate Bills Receivable (AR)
                </h1>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Subledger Account 1121 • Order-tied GST Invoices • Dynamic Ageing & Receipts
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {selectedInvoiceIds.size > 0 && (
              <button
                onClick={handleOpenMultiReceipt}
                className="flex items-center gap-2 px-4 py-2 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl shadow-xs transition-colors"
              >
                <CreditCard className="w-4 h-4" />
                <span>Receive Collections ({selectedInvoiceIds.size})</span>
              </button>
            )}

            <button
              onClick={() => fetchBills()}
              disabled={loading}
              className="p-2 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors border border-slate-200 dark:border-slate-800"
              title="Refresh Data"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
            </button>
          </div>
        </div>

        {/* 4 Top KPI Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs">
            <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 text-xs font-semibold mb-1">
              <span>Total Invoiced (AR)</span>
              <Layers className="w-4 h-4 text-indigo-500" />
            </div>
            <div className="text-2xl font-bold text-slate-900 dark:text-white">
              ₹{summary.total_receivables.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
            </div>
            <div className="text-[11px] text-slate-400 mt-1">
              Across {summary.total_bills_count} statutory corporate invoices
            </div>
          </div>

          <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs">
            <div className="flex items-center justify-between text-emerald-600 dark:text-emerald-400 text-xs font-semibold mb-1">
              <span>Total Collections</span>
              <CheckCircle2 className="w-4 h-4" />
            </div>
            <div className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">
              ₹{summary.total_received.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
            </div>
            <div className="text-[11px] text-slate-400 mt-1">
              {summary.fully_received_count} fully settled • {summary.partially_received_count} partial
            </div>
          </div>

          <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs">
            <div className="flex items-center justify-between text-amber-600 dark:text-amber-400 text-xs font-semibold mb-1">
              <span>Net Open AR</span>
              <Clock className="w-4 h-4" />
            </div>
            <div className="text-2xl font-bold text-amber-600 dark:text-amber-400">
              ₹{summary.total_outstanding.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
            </div>
            <div className="text-[11px] text-slate-400 mt-1">
              {summary.unpaid_count + summary.partially_received_count} open bills awaiting settlement
            </div>
          </div>

          <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs">
            <div className="flex items-center justify-between text-rose-600 dark:text-rose-400 text-xs font-semibold mb-1">
              <span>Overdue Receivables</span>
              <AlertTriangle className="w-4 h-4" />
            </div>
            <div className="text-2xl font-bold text-rose-600 dark:text-rose-400">
              ₹{summary.overdue_amount.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
            </div>
            <div className="text-[11px] text-slate-400 mt-1">
              {summary.overdue_count} bills exceeding terms
            </div>
          </div>
        </div>

        {/* Due-Date AR Ageing Matrix Widget */}
        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 flex items-center gap-2">
              <Calendar className="w-4 h-4 text-indigo-500" />
              Authoritative AR Ageing Matrix (Derived from Due Date)
            </span>
            {selectedAgeingBucket !== "ALL" && (
              <button
                onClick={() => setSelectedAgeingBucket("ALL")}
                className="text-[11px] font-semibold text-indigo-600 dark:text-indigo-400 hover:underline"
              >
                Clear Ageing Filter
              </button>
            )}
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5">
            {[
              {
                id: "CURRENT",
                label: "Current / Not Due",
                amount: summary.ageing_breakdown.current,
                color: "emerald",
              },
              {
                id: "1_TO_30",
                label: "1–30 Days Overdue",
                amount: summary.ageing_breakdown.bucket_1_30,
                color: "amber",
              },
              {
                id: "31_TO_60",
                label: "31–60 Days Overdue",
                amount: summary.ageing_breakdown.bucket_31_60,
                color: "orange",
              },
              {
                id: "61_TO_90",
                label: "61–90 Days Overdue",
                amount: summary.ageing_breakdown.bucket_61_90,
                color: "rose",
              },
              {
                id: "OVER_90",
                label: ">90 Days Overdue",
                amount: summary.ageing_breakdown.bucket_over_90,
                color: "red",
              },
            ].map((b) => {
              const isSelected = selectedAgeingBucket === b.id;
              return (
                <button
                  key={b.id}
                  type="button"
                  onClick={() => setSelectedAgeingBucket(isSelected ? "ALL" : (b.id as any))}
                  className={`p-3 rounded-xl border text-left transition-all ${
                    isSelected
                      ? "ring-2 ring-indigo-500 border-indigo-500 bg-indigo-50/50 dark:bg-indigo-950/30"
                      : "border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/20 hover:bg-slate-100/50 dark:hover:bg-slate-800/40"
                  }`}
                >
                  <span className="block text-[11px] text-slate-500 dark:text-slate-400 font-medium truncate">
                    {b.label}
                  </span>
                  <span className="block text-sm font-bold text-slate-900 dark:text-white mt-0.5">
                    ₹{b.amount.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Filter Controls & Search */}
        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {/* Search */}
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Search Invoice #, Company, Order..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-9 pr-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-800 text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            {/* Branch Filter */}
            <div className="relative">
              <Building2 className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <select
                value={selectedBranchId}
                onChange={(e) => setSelectedBranchId(e.target.value)}
                className="w-full pl-9 pr-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-800 text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <option value="">All Branches</option>
                {branches.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Customer Filter */}
            <div className="relative">
              <select
                value={selectedCustomerId}
                onChange={(e) => setSelectedCustomerId(e.target.value)}
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-800 text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <option value="">All Corporate Customers</option>
                {customers.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.company_name || `${c.first_name || ""} ${c.last_name || ""}`.trim() || c.id}
                  </option>
                ))}
              </select>
            </div>

            {/* Status Pills */}
            <div className="flex items-center gap-1 overflow-x-auto">
              {(["ALL", "UNPAID", "PARTIALLY_RECEIVED", "FULLY_RECEIVED", "OVERDUE"] as const).map(
                (st) => (
                  <button
                    key={st}
                    onClick={() => setSelectedStatus(st)}
                    className={`px-2.5 py-1.5 text-[11px] font-bold rounded-lg transition-colors whitespace-nowrap ${
                      selectedStatus === st
                        ? "bg-indigo-600 text-white"
                        : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700"
                    }`}
                  >
                    {st === "ALL" ? "All" : st.replace("_", " ")}
                  </button>
                )
              )}
            </div>
          </div>
        </div>

        {/* Bills Receivable Table */}
        <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 overflow-hidden shadow-xs">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400 font-semibold uppercase tracking-wider text-[11px]">
                <tr>
                  <th className="p-3.5 w-10">
                    <input
                      type="checkbox"
                      checked={bills.length > 0 && selectedInvoiceIds.size === bills.length}
                      onChange={selectAllFiltered}
                      className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                    />
                  </th>
                  <th className="p-3.5">Invoice #</th>
                  <th className="p-3.5">Customer / Company</th>
                  <th className="p-3.5">Branch</th>
                  <th className="p-3.5">Due Date</th>
                  <th className="p-3.5 text-right">Invoice Total</th>
                  <th className="p-3.5 text-right">Paid</th>
                  <th className="p-3.5 text-right">Outstanding</th>
                  <th className="p-3.5 text-center">Status</th>
                  <th className="p-3.5 text-center">Ageing</th>
                  <th className="p-3.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {loading ? (
                  <tr>
                    <td colSpan={11} className="p-8 text-center text-slate-500">
                      Loading bills receivable...
                    </td>
                  </tr>
                ) : bills.length === 0 ? (
                  <tr>
                    <td colSpan={11} className="p-8 text-center text-slate-500">
                      No corporate bills receivable found matching current filters.
                    </td>
                  </tr>
                ) : (
                  bills.map((bill) => {
                    const isSelected = selectedInvoiceIds.has(bill.invoice_id);

                    return (
                      <tr
                        key={bill.invoice_id}
                        className={`hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors ${
                          isSelected ? "bg-indigo-50/30 dark:bg-indigo-950/20" : ""
                        }`}
                      >
                        <td className="p-3.5">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => toggleSelectInvoice(bill.invoice_id)}
                            className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                          />
                        </td>
                        <td className="p-3.5 font-bold text-slate-900 dark:text-white">
                          <button
                            onClick={() => setDetailModalInvoiceId(bill.invoice_id)}
                            className="hover:underline flex items-center gap-1.5"
                          >
                            <span>{bill.invoice_number}</span>
                            <ExternalLink className="w-3 h-3 text-slate-400" />
                          </button>
                          <div className="text-[10px] text-slate-400 font-mono mt-0.5">
                            Order: {bill.order_id || "Direct"}
                          </div>
                        </td>
                        <td className="p-3.5">
                          <div className="font-semibold text-slate-900 dark:text-white">
                            {bill.customer_company || bill.customer_name}
                          </div>
                          <div className="text-[10px] text-slate-400">
                            GSTIN: {bill.customer_gstin || "Unregistered"}
                          </div>
                        </td>
                        <td className="p-3.5 text-slate-600 dark:text-slate-400">
                          {bill.branch_name || bill.branch_id}
                        </td>
                        <td className="p-3.5">
                          <div className="font-medium text-slate-800 dark:text-slate-200">
                            {bill.due_date}
                          </div>
                          {bill.overdue_days > 0 ? (
                            <span className="text-[10px] font-bold text-rose-600 dark:text-rose-400">
                              {bill.overdue_days}d overdue
                            </span>
                          ) : (
                            <span className="text-[10px] text-emerald-600 dark:text-emerald-400">
                              Current
                            </span>
                          )}
                        </td>
                        <td className="p-3.5 text-right font-semibold text-slate-900 dark:text-white">
                          ₹{bill.total_amount.toFixed(2)}
                        </td>
                        <td className="p-3.5 text-right text-emerald-600 dark:text-emerald-400 font-semibold">
                          ₹{bill.paid_amount.toFixed(2)}
                        </td>
                        <td className="p-3.5 text-right font-bold text-amber-600 dark:text-amber-400">
                          ₹{bill.outstanding_amount.toFixed(2)}
                        </td>
                        <td className="p-3.5 text-center">
                          <span
                            className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                              bill.status === "FULLY_RECEIVED"
                                ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-400"
                                : bill.status === "PARTIALLY_RECEIVED"
                                ? "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-400"
                                : bill.status === "OVERDUE"
                                ? "bg-rose-100 text-rose-800 dark:bg-rose-900/40 dark:text-rose-400"
                                : "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-400"
                            }`}
                          >
                            {bill.status.replace("_", " ")}
                          </span>
                        </td>
                        <td className="p-3.5 text-center">
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300">
                            {bill.ageing_bucket}
                          </span>
                        </td>
                        <td className="p-3.5 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            {bill.outstanding_amount > 0 && (
                              <>
                                <button
                                  onClick={() => setReceiptModalInvoices([bill])}
                                  className="p-1.5 text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 rounded-lg transition-colors"
                                  title="Receive Receipt"
                                >
                                  <CreditCard className="w-4 h-4" />
                                </button>
                                <button
                                  onClick={() => setReminderModalInvoiceId(bill.invoice_id)}
                                  className="p-1.5 text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 rounded-lg transition-colors"
                                  title="Schedule Reminder"
                                >
                                  <Bell className="w-4 h-4" />
                                </button>
                              </>
                            )}
                            <button
                              onClick={() => setLedgerModalCustomerId(bill.customer_id)}
                              className="p-1.5 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
                              title="Customer Subledger"
                            >
                              <BookOpen className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Modals */}
        {receiptModalInvoices && (
          <ReceiveReceiptModal
            invoices={receiptModalInvoices}
            onClose={() => setReceiptModalInvoices(null)}
            onSuccess={() => {
              setReceiptModalInvoices(null);
              setSelectedInvoiceIds(new Set());
              fetchBills();
            }}
          />
        )}

        {detailModalInvoiceId && (
          <BillReceivableDetailModal
            invoiceId={detailModalInvoiceId}
            onClose={() => setDetailModalInvoiceId(null)}
            onOpenReceiptModal={(bill) => {
              setDetailModalInvoiceId(null);
              setReceiptModalInvoices([bill]);
            }}
            onOpenReminderModal={(invId) => {
              setDetailModalInvoiceId(null);
              setReminderModalInvoiceId(invId);
            }}
          />
        )}

        {ledgerModalCustomerId && (
          <CustomerLedgerModal
            customerId={ledgerModalCustomerId}
            onClose={() => setLedgerModalCustomerId(null)}
          />
        )}

        {reminderModalInvoiceId && (
          <ScheduleReminderModal
            invoiceId={reminderModalInvoiceId}
            onClose={() => setReminderModalInvoiceId(null)}
          />
        )}
      </div>
    </WidgetErrorBoundary>
  );
});
