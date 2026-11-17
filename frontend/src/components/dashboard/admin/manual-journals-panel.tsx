"use client";

/**
 * CakeToHome ERP — Phase C6.4: Manual Journal Management Panel
 *
 * ARCHITECTURAL DESIGN & INVARIANTS:
 * 1. STRICT GENERAL LEDGER VOUCHER ENGINE ONLY:
 *    - Designed for double-entry manual journal vouchers, reclassifications, accruals, and reversals.
 *    - Zero retail counter POS, item barcode scanning, or cashier shift checkout logic.
 * 2. SERVER-SIDE FINANCIAL AUTHORITATIVE TRUTH:
 *    - Presentation calculates live balance (Total Dr, Total Cr, Diff) for user visual feedback only.
 *    - All double-entry invariants, leaf account validations, party dimensions, fiscal periods,
 *      and posting immutability are authoritatively enforced by ManualJournalService and C6.3 APIs.
 * 3. 4-EYES SEGREGATION OF DUTIES (SoD):
 *    - Maker != Checker != Poster. Visual indicators and disabled gates prevent self-approval.
 */

import React, { useState, useEffect, useCallback, useMemo, memo } from "react";
import {
  FileText,
  Plus,
  RefreshCw,
  Search,
  Filter,
  CheckCircle2,
  Clock,
  Layers,
  Building2,
  Calendar,
  AlertTriangle,
  RotateCcw,
  Scale,
  ShieldCheck,
  Send,
} from "lucide-react";
import type {
  AccountingVoucherRow,
  VoucherStatus,
} from "@frontend/lib/types/accounting.types";
import type {
  AccountOption,
  CustomerOption,
  SupplierOption,
  BranchOption,
  ManualJournalListItem,
} from "./manual-journals/types";
import { ManualJournalListTable } from "./manual-journals/ManualJournalListTable";
import { ManualJournalEntryModal } from "./manual-journals/ManualJournalEntryModal";
import { ManualJournalDetailModal } from "./manual-journals/ManualJournalDetailModal";
import { WidgetErrorBoundary } from "./error-boundary";

export const ManualJournalsPanel = memo(function ManualJournalsPanel() {
  // Current user auth context
  const [currentUser, setCurrentUser] = useState<{ userId: string; role: string } | null>(null);

  // Master Data
  const [branches, setBranches] = useState<BranchOption[]>([]);
  const [accounts, setAccounts] = useState<AccountOption[]>([]);
  const [customers, setCustomers] = useState<CustomerOption[]>([]);
  const [suppliers, setSuppliers] = useState<SupplierOption[]>([]);
  const [masterLoading, setMasterLoading] = useState(true);

  // List State
  const [journals, setJournals] = useState<ManualJournalListItem[]>([]);
  const [totalJournals, setTotalJournals] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters State
  const [search, setSearch] = useState("");
  const [selectedBranchId, setSelectedBranchId] = useState<string>("");
  const [selectedStatus, setSelectedStatus] = useState<VoucherStatus | "ALL">("ALL");
  const [startDate, setStartDate] = useState<string>("");
  const [endDate, setEndDate] = useState<string>("");
  const [page, setPage] = useState(1);
  const limit = 15;

  // Modals State
  const [entryModalOpen, setEntryModalOpen] = useState(false);
  const [editVoucher, setEditVoucher] = useState<AccountingVoucherRow | null>(null);
  const [detailModalVoucherId, setDetailModalVoucherId] = useState<string | null>(null);

  // Summary Metrics
  const [metrics, setMetrics] = useState({
    total: 0,
    drafts: 0,
    submitted: 0,
    approved: 0,
    posted: 0,
  });

  // Resolve user identity from cookies
  useEffect(() => {
    if (typeof window !== "undefined") {
      const cookies = document.cookie.split(";").reduce((acc: any, c) => {
        const [k, ...v] = c.trim().split("=");
        if (k) acc[k] = decodeURIComponent(v.join("="));
        return acc;
      }, {});

      const role = (cookies["_cth_role"] || "SUPER_ADMIN").toUpperCase();
      const userId = cookies["_cth_user_id"] || "admin_01";
      setCurrentUser({ role, userId });
    }
  }, []);

  // ── Load Master Data (Branches, Accounts, Customers, Suppliers) ─────────────
  useEffect(() => {
    async function loadMasterData() {
      setMasterLoading(true);
      try {
        const [branchesRes, accountsRes, customersRes, suppliersRes] = await Promise.all([
          fetch("/api/v1/admin/branches?limit=100").then((r) => r.json()).catch(() => ({ branches: [] })),
          fetch("/api/v1/admin/accounting/accounts?include_groups=false").then((r) => r.json()).catch(() => ({ accounts: [] })),
          fetch("/api/v1/admin/customers?limit=150").then((r) => r.json()).catch(() => ({ customers: [] })),
          fetch("/api/v1/admin/suppliers?limit=150").then((r) => r.json()).catch(() => ({ suppliers: [] })),
        ]);

        if (branchesRes.branches) {
          setBranches(branchesRes.branches);
        }
        if (accountsRes.accounts) {
          setAccounts(accountsRes.accounts);
        }
        if (customersRes.customers) {
          setCustomers(customersRes.customers);
        }
        if (suppliersRes.suppliers) {
          setSuppliers(suppliersRes.suppliers);
        }
      } catch (err: any) {
        console.error("Failed to load accounting master data:", err);
      } finally {
        setMasterLoading(false);
      }
    }

    loadMasterData();
  }, []);

  // ── Fetch Journals List ─────────────────────────────────────────────────────
  const fetchJournals = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (selectedBranchId) params.set("branch_id", selectedBranchId);
      if (selectedStatus && selectedStatus !== "ALL") params.set("status", selectedStatus);
      if (search.trim()) params.set("search", search.trim());
      if (startDate) params.set("startDate", startDate);
      if (endDate) params.set("endDate", endDate);
      params.set("page", String(page));
      params.set("limit", String(limit));

      const res = await fetch(`/api/v1/admin/accounting/journals?${params.toString()}`);
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.message || data.error || "Failed to load manual journals.");
      }

      setJournals(data.journals || data.data?.journals || []);
      setTotalJournals(data.total !== undefined ? data.total : (data.data?.total || 0));

      // Fetch overview summary counts for work queue cards
      const summaryRes = await fetch("/api/v1/admin/accounting/journals?limit=1000");
      const summaryData = await summaryRes.json();
      const all = (summaryData.journals || summaryData.data?.journals || []) as AccountingVoucherRow[];
      if (Array.isArray(all)) {
        setMetrics({
          total: all.length,
          drafts: all.filter((v) => v.status === "DRAFT").length,
          submitted: all.filter((v) => v.status === "SUBMITTED").length,
          approved: all.filter((v) => v.status === "APPROVED").length,
          posted: all.filter((v) => v.status === "POSTED").length,
        });
      }
    } catch (err: any) {
      setError(err.message || "Failed to fetch manual journals.");
    } finally {
      setLoading(false);
    }
  }, [selectedBranchId, selectedStatus, search, startDate, endDate, page, limit]);

  useEffect(() => {
    fetchJournals();
  }, [fetchJournals]);

  // Handlers
  const handleOpenNewDraft = () => {
    setEditVoucher(null);
    setEntryModalOpen(true);
  };

  const handleEditDraft = (voucher: AccountingVoucherRow) => {
    setEditVoucher(voucher);
    setEntryModalOpen(true);
  };

  const handleViewDetail = (voucherId: string) => {
    setDetailModalVoucherId(voucherId);
  };

  return (
    <WidgetErrorBoundary>
      <div className="space-y-6">
        {/* Header Banner */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-200 pb-5">
          <div>
            <div className="flex items-center gap-2.5">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand-primary text-white shadow-sm">
                <FileText className="h-5 w-5" />
              </div>
              <h1 className="text-xl font-bold text-slate-900 tracking-tight">
                Manual Journal Vouchers (JV)
              </h1>
            </div>
            <p className="text-xs text-slate-500 mt-1">
              General ledger adjustments, period-end accruals, depreciation, and reclassifications with Four-Eyes Segregation of Duties.
            </p>
          </div>

          <div className="flex items-center gap-2.5">
            <button
              onClick={() => fetchJournals()}
              disabled={loading}
              title="Refresh Journals"
              className="rounded-lg border border-slate-200 bg-white p-2 text-slate-600 hover:bg-slate-50 hover:text-slate-900 transition shadow-sm"
            >
              <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            </button>

            <button
              onClick={handleOpenNewDraft}
              className="inline-flex items-center gap-1.5 rounded-lg bg-brand-primary px-3.5 py-2 text-xs font-semibold text-white shadow-sm hover:bg-brand-navy transition"
            >
              <Plus className="h-4 w-4" />
              New Manual Journal
            </button>
          </div>
        </div>

        {/* Work Queue & KPI Metric Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3.5">
          {/* Total */}
          <div
            onClick={() => setSelectedStatus("ALL")}
            className={`cursor-pointer rounded-xl border p-3.5 transition shadow-sm ${
              selectedStatus === "ALL"
                ? "border-brand-primary bg-brand-light/50 ring-1 ring-brand-primary"
                : "border-slate-200 bg-white hover:border-slate-300"
            }`}
          >
            <div className="flex items-center justify-between text-xs text-slate-500">
              <span>All Journals</span>
              <FileText className="h-4 w-4 text-slate-400" />
            </div>
            <p className="mt-1 text-lg font-bold text-slate-900 font-mono">{metrics.total}</p>
          </div>

          {/* Drafts */}
          <div
            onClick={() => setSelectedStatus("DRAFT")}
            className={`cursor-pointer rounded-xl border p-3.5 transition shadow-sm ${
              selectedStatus === "DRAFT"
                ? "border-slate-500 bg-slate-100 ring-1 ring-slate-500"
                : "border-slate-200 bg-white hover:border-slate-300"
            }`}
          >
            <div className="flex items-center justify-between text-xs text-slate-500">
              <span>Drafts</span>
              <Layers className="h-4 w-4 text-slate-400" />
            </div>
            <p className="mt-1 text-lg font-bold text-slate-700 font-mono">{metrics.drafts}</p>
          </div>

          {/* Submitted (Pending Approval) */}
          <div
            onClick={() => setSelectedStatus("SUBMITTED")}
            className={`cursor-pointer rounded-xl border p-3.5 transition shadow-sm ${
              selectedStatus === "SUBMITTED"
                ? "border-blue-500 bg-blue-50 ring-1 ring-blue-500"
                : "border-slate-200 bg-white hover:border-slate-300"
            }`}
          >
            <div className="flex items-center justify-between text-xs text-blue-600 font-medium">
              <span>Pending Approval</span>
              <Clock className="h-4 w-4 text-blue-500" />
            </div>
            <p className="mt-1 text-lg font-bold text-blue-700 font-mono">{metrics.submitted}</p>
          </div>

          {/* Approved (Ready to Post) */}
          <div
            onClick={() => setSelectedStatus("APPROVED")}
            className={`cursor-pointer rounded-xl border p-3.5 transition shadow-sm ${
              selectedStatus === "APPROVED"
                ? "border-brand-primary bg-brand-light ring-1 ring-brand-primary"
                : "border-slate-200 bg-white hover:border-slate-300"
            }`}
          >
            <div className="flex items-center justify-between text-xs text-brand-primary font-medium">
              <span>Ready for GL</span>
              <Send className="h-4 w-4 text-brand-primary" />
            </div>
            <p className="mt-1 text-lg font-bold text-brand-navy font-mono">{metrics.approved}</p>
          </div>

          {/* Posted */}
          <div
            onClick={() => setSelectedStatus("POSTED")}
            className={`cursor-pointer rounded-xl border p-3.5 transition shadow-sm ${
              selectedStatus === "POSTED"
                ? "border-emerald-500 bg-emerald-50 ring-1 ring-emerald-500"
                : "border-slate-200 bg-white hover:border-slate-300"
            }`}
          >
            <div className="flex items-center justify-between text-xs text-emerald-600 font-medium">
              <span>Posted to GL</span>
              <CheckCircle2 className="h-4 w-4 text-emerald-500" />
            </div>
            <p className="mt-1 text-lg font-bold text-emerald-700 font-mono">{metrics.posted}</p>
          </div>
        </div>

        {/* Filter Toolbar */}
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-slate-50/75 p-3.5 shadow-sm">
          <div className="flex flex-wrap items-center gap-2.5 flex-1">
            {/* Search Input */}
            <div className="relative min-w-[200px] flex-1 sm:max-w-xs">
              <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-slate-400" />
              <input
                type="text"
                placeholder="Search voucher #, narration..."
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPage(1);
                }}
                className="w-full rounded-lg border border-slate-300 bg-white py-1.5 pl-9 pr-3 text-xs text-slate-800 placeholder-slate-400 focus:border-brand-primary focus:outline-none focus:ring-1 focus:ring-brand-primary"
              />
            </div>

            {/* Branch Filter */}
            <div className="min-w-[150px]">
              <select
                value={selectedBranchId}
                onChange={(e) => {
                  setSelectedBranchId(e.target.value);
                  setPage(1);
                }}
                className="w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs text-slate-800 focus:border-brand-primary focus:outline-none focus:ring-1 focus:ring-brand-primary"
              >
                <option value="">All Branches</option>
                {branches.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Status Filter */}
            <div className="min-w-[130px]">
              <select
                value={selectedStatus}
                onChange={(e) => {
                  setSelectedStatus(e.target.value as any);
                  setPage(1);
                }}
                className="w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs text-slate-800 focus:border-brand-primary focus:outline-none focus:ring-1 focus:ring-brand-primary"
              >
                <option value="ALL">All Statuses</option>
                <option value="DRAFT">DRAFT</option>
                <option value="SUBMITTED">SUBMITTED</option>
                <option value="APPROVED">APPROVED</option>
                <option value="POSTED">POSTED</option>
                <option value="CANCELLED">CANCELLED</option>
              </select>
            </div>

            {/* Date Filters */}
            <div className="flex items-center gap-1.5 text-xs text-slate-500">
              <input
                type="date"
                value={startDate}
                onChange={(e) => {
                  setStartDate(e.target.value);
                  setPage(1);
                }}
                className="rounded-lg border border-slate-300 bg-white px-2 py-1 text-xs text-slate-800 focus:border-brand-primary focus:outline-none"
              />
              <span>to</span>
              <input
                type="date"
                value={endDate}
                onChange={(e) => {
                  setEndDate(e.target.value);
                  setPage(1);
                }}
                className="rounded-lg border border-slate-300 bg-white px-2 py-1 text-xs text-slate-800 focus:border-brand-primary focus:outline-none"
              />
            </div>
          </div>

          {(selectedBranchId || selectedStatus !== "ALL" || search || startDate || endDate) && (
            <button
              onClick={() => {
                setSelectedBranchId("");
                setSelectedStatus("ALL");
                setSearch("");
                setStartDate("");
                setEndDate("");
                setPage(1);
              }}
              className="text-xs text-brand-primary hover:text-brand-navy font-medium"
            >
              Reset Filters
            </button>
          )}
        </div>

        {/* Error Notification */}
        {error && (
          <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-xs text-red-700 flex items-start gap-2.5">
            <AlertTriangle className="h-4 w-4 shrink-0 text-red-500 mt-0.5" />
            <div className="flex-1">
              <span className="font-semibold">Error loading manual journals: </span>
              <span>{error}</span>
            </div>
            <button onClick={() => setError(null)} className="text-red-500 hover:text-red-700 font-semibold">
              Dismiss
            </button>
          </div>
        )}

        {/* Manual Journals Table */}
        <ManualJournalListTable
          journals={journals}
          loading={loading}
          total={totalJournals}
          page={page}
          limit={limit}
          onPageChange={(newPage) => setPage(newPage)}
          onViewDetail={(id) => handleViewDetail(id)}
          onEditDraft={(voucher) => handleEditDraft(voucher)}
          currentUserId={currentUser?.userId}
        />

        {/* New / Edit Draft Entry Modal */}
        {entryModalOpen && (
          <ManualJournalEntryModal
            isOpen={entryModalOpen}
            onClose={() => {
              setEntryModalOpen(false);
              setEditVoucher(null);
            }}
            onSuccess={() => {
              fetchJournals();
            }}
            editVoucher={editVoucher}
            branches={branches}
            accounts={accounts}
            customers={customers}
            suppliers={suppliers}
            currentBranchId={selectedBranchId}
          />
        )}

        {/* Voucher Detail & Audit Modal */}
        {detailModalVoucherId && (
          <ManualJournalDetailModal
            voucherId={detailModalVoucherId}
            currentUserId={currentUser?.userId}
            isOpen={Boolean(detailModalVoucherId)}
            onClose={() => setDetailModalVoucherId(null)}
            onEditDraft={(vch) => {
              setDetailModalVoucherId(null);
              handleEditDraft(vch);
            }}
            onStatusChanged={() => {
              fetchJournals();
            }}
            onSelectVoucher={(targetId) => {
              setDetailModalVoucherId(targetId);
            }}
          />
        )}
      </div>
    </WidgetErrorBoundary>
  );
});
