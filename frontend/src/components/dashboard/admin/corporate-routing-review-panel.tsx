"use client";

import React, { useState, useEffect, useCallback } from "react";
import {
  MapPin,
  AlertTriangle,
  RefreshCw,
  Search,
  Filter,
  CheckCircle2,
  Clock,
  Building2,
  Truck,
  ExternalLink,
  ChevronLeft,
  ChevronRight,
  ShieldAlert,
  Edit3,
  User,
  Phone,
  HelpCircle,
  FileText,
  X,
  Compass,
  ArrowRight,
  Info,
} from "lucide-react";
import type {
  UnresolvedAssignmentItem,
  UnresolvedReviewCandidatesResult,
  CorporateRoutingReasonCode,
  CorporateAssignmentStatus,
  CorporateDeliveryEntityType,
} from "@/lib/types/corporate-routing.types";

export function CorporateRoutingReviewPanel() {
  const [items, setItems] = useState<UnresolvedAssignmentItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Filters & Pagination
  const [page, setPage] = useState<number>(1);
  const [totalPages, setTotalPages] = useState<number>(1);
  const [totalCount, setTotalCount] = useState<number>(0);
  const [reasonCounts, setReasonCounts] = useState<Record<string, number>>({});
  const [search, setSearch] = useState<string>("");
  const [reasonCodeFilter, setReasonCodeFilter] = useState<string>("");
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [entityTypeFilter, setEntityTypeFilter] = useState<string>("");

  // Resolution Modal State
  const [selectedItem, setSelectedItem] = useState<UnresolvedAssignmentItem | null>(null);
  const [candidates, setCandidates] = useState<UnresolvedReviewCandidatesResult | null>(null);
  const [loadingCandidates, setLoadingCandidates] = useState<boolean>(false);
  const [candidateError, setCandidateError] = useState<string | null>(null);

  // Action form state inside modal
  const [activeActionTab, setActiveActionTab] = useState<"CORRECT" | "MANUAL" | "HOLD">("CORRECT");
  const [formLat, setFormLat] = useState<string>("");
  const [formLng, setFormLng] = useState<string>("");
  const [formAddress, setFormAddress] = useState<string>("");
  const [formStoreId, setFormStoreId] = useState<string>("");
  const [formPartnerId, setFormPartnerId] = useState<string>("");
  const [formReason, setFormReason] = useState<string>("");
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [actionError, setActionError] = useState<string | null>(null);

  // Available store & partner options
  const [availableStores, setAvailableStores] = useState<Array<{ id: string; name: string; code: string; is_eligible: boolean }>>([]);
  const [availablePartners, setAvailablePartners] = useState<Array<{ id: string; name: string; type: string }>>([]);

  const fetchUnresolvedList = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      params.set("page", String(page));
      params.set("limit", "20");
      if (search.trim()) params.set("search", search.trim());
      if (reasonCodeFilter) params.set("reason_code", reasonCodeFilter);
      if (statusFilter) params.set("status", statusFilter);
      if (entityTypeFilter) params.set("entity_type", entityTypeFilter);

      const res = await fetch(`/api/v1/admin/corporate-routing/unresolved?${params.toString()}`);
      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.message || "Failed to load unresolved routing queue.");
      }

      setItems(json.data || []);
      setTotalCount(json.meta?.total || 0);
      setTotalPages(json.meta?.total_pages || 1);
      setReasonCounts(json.meta?.reason_code_counts || {});
    } catch (err: any) {
      setError(err.message || "Failed to load unresolved items.");
    } finally {
      setLoading(false);
    }
  }, [page, search, reasonCodeFilter, statusFilter, entityTypeFilter]);

  useEffect(() => {
    fetchUnresolvedList();
  }, [fetchUnresolvedList]);

  // Load candidate stores and partners for resolution dropdowns
  const loadMasterCandidates = useCallback(async () => {
    try {
      const res = await fetch("/api/v1/admin/delivery-coverage/stores");
      const json = await res.json();
      if (json.success && Array.isArray(json.data)) {
        setAvailableStores(
          json.data.map((s: any) => ({
            id: s.id,
            name: s.name,
            code: s.code,
            is_eligible: Boolean(s.is_corporate_routing_eligible),
          }))
        );
      }
    } catch {
      // Non-blocking fallback
    }

    try {
      const res = await fetch("/api/v1/admin/delivery-coverage/partners");
      const json = await res.json();
      if (json.success && Array.isArray(json.data)) {
        setAvailablePartners(
          json.data.map((p: any) => ({
            id: p.id,
            name: p.partner_name,
            type: p.partner_type,
          }))
        );
      }
    } catch {
      // Non-blocking fallback
    }
  }, []);

  useEffect(() => {
    loadMasterCandidates();
  }, [loadMasterCandidates]);

  // Open modal and fetch candidate routing details
  const handleOpenReview = async (item: UnresolvedAssignmentItem) => {
    setSelectedItem(item);
    setFormLat(item.latitude !== null ? String(item.latitude) : "");
    setFormLng(item.longitude !== null ? String(item.longitude) : "");
    setFormAddress(item.delivery_address || "");
    setFormStoreId(item.assigned_store_id || "");
    setFormPartnerId(item.assigned_partner_id || "");
    setFormReason("");
    setActionError(null);
    setCandidates(null);
    setLoadingCandidates(true);
    setCandidateError(null);

    try {
      const res = await fetch(`/api/v1/admin/corporate-routing/unresolved/${item.id}/candidates`);
      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.message || "Failed to load candidate evaluations.");
      }
      setCandidates(json.data);
    } catch (err: any) {
      setCandidateError(err.message || "Could not evaluate routing candidates.");
    } finally {
      setLoadingCandidates(false);
    }
  };

  const handleCloseModal = () => {
    setSelectedItem(null);
    setCandidates(null);
    setActionError(null);
  };

  // Submit resolution action
  const handleExecuteResolution = async () => {
    if (!selectedItem) return;
    setSubmitting(true);
    setActionError(null);

    let payload: any = {};

    if (activeActionTab === "CORRECT") {
      const latNum = parseFloat(formLat);
      const lngNum = parseFloat(formLng);
      if (isNaN(latNum) || isNaN(lngNum)) {
        setActionError("Please provide valid numerical coordinates for Latitude and Longitude.");
        setSubmitting(false);
        return;
      }
      if (latNum < -90 || latNum > 90 || lngNum < -180 || lngNum > 180) {
        setActionError("Coordinates are out of bounds (Lat: -90..90, Lng: -180..180).");
        setSubmitting(false);
        return;
      }
      payload = {
        action: "CORRECT_COORDINATES",
        latitude: latNum,
        longitude: lngNum,
        delivery_address: formAddress.trim() || undefined,
        override_reason: formReason.trim() || undefined,
      };
    } else if (activeActionTab === "MANUAL") {
      if (!formStoreId.trim()) {
        setActionError("Please select a target store for manual assignment.");
        setSubmitting(false);
        return;
      }
      if (!formReason.trim() || formReason.trim().length < 5) {
        setActionError("A detailed override reason (minimum 5 characters) is required for manual assignment.");
        setSubmitting(false);
        return;
      }
      payload = {
        action: "MANUAL_ASSIGN",
        store_id: formStoreId.trim(),
        partner_id: formPartnerId.trim() || undefined,
        override_reason: formReason.trim(),
      };
    } else if (activeActionTab === "HOLD") {
      payload = {
        action: "MARK_PENDING_REVIEW",
        override_reason: formReason.trim() || "Marked pending client address verification.",
      };
    }

    try {
      const res = await fetch(`/api/v1/admin/corporate-routing/unresolved/${selectedItem.id}/resolve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.message || "Failed to resolve assignment.");
      }

      setSuccessMessage(
        json.idempotent
          ? `Assignment was already in the requested state (Idempotent).`
          : `Assignment resolved successfully: ${json.message || json.action}`
      );
      setTimeout(() => setSuccessMessage(null), 5000);
      handleCloseModal();
      fetchUnresolvedList();
    } catch (err: any) {
      setActionError(err.message || "Resolution failed.");
    } finally {
      setSubmitting(false);
    }
  };

  const getReasonBadge = (reasonCode: CorporateRoutingReasonCode | string) => {
    switch (reasonCode) {
      case "COORDINATES_MISSING":
        return <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-amber-100 text-amber-800">Coordinates Missing</span>;
      case "COORDINATES_INVALID":
        return <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-rose-100 text-rose-800">Coordinates Invalid</span>;
      case "INSIDE_EXCLUSION":
        return <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-purple-100 text-purple-800">Inside Exclusion Zone</span>;
      case "OUTSIDE_COVERAGE":
        return <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-blue-100 text-blue-800">Outside Coverage</span>;
      case "STORE_NOT_ELIGIBLE":
        return <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-orange-100 text-orange-800">Store Not Eligible</span>;
      case "NO_ELIGIBLE_PARTNER":
        return <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-yellow-100 text-yellow-800">No Active Partner</span>;
      case "PENDING_REVIEW":
        return <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-indigo-100 text-indigo-800">Pending Review</span>;
      case "MANUAL_OVERRIDE":
        return <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-teal-100 text-teal-800">Manual Override</span>;
      default:
        return <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-slate-100 text-slate-800">{reasonCode}</span>;
    }
  };

  return (
    <div className="w-full space-y-6">
      {/* ── Top Header & Banner ── */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-2 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400">
              <Compass className="w-6 h-6" />
            </span>
            <h1 className="text-xl font-bold text-slate-900 dark:text-white">
              Super Admin Unresolved Routing Queue
            </h1>
          </div>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            Review delivery locations failing automated matching. Inspect polygon coverage, correct coordinates, or apply audited manual overrides.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => fetchUnresolvedList()}
            disabled={loading}
            className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-slate-700 dark:text-slate-200 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg transition-colors cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
            <span>Refresh Queue</span>
          </button>
        </div>
      </div>

      {/* ── Global Alerts ── */}
      {successMessage && (
        <div className="p-4 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300 text-sm flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
          <span>{successMessage}</span>
        </div>
      )}
      {error && (
        <div className="p-4 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-rose-800 dark:text-rose-300 text-sm flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 shrink-0 text-rose-600 dark:text-rose-400" />
          <span>{error}</span>
        </div>
      )}

      {/* ── Queue Metric Cards ── */}
      <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
        <div className="p-3.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
          <div className="text-xs font-semibold text-slate-500 dark:text-slate-400">Total Unresolved</div>
          <div className="mt-1 text-2xl font-bold text-slate-900 dark:text-white">{totalCount}</div>
        </div>
        <div className="p-3.5 rounded-xl bg-white dark:bg-slate-900 border border-amber-200 dark:border-amber-900/50">
          <div className="text-xs font-semibold text-amber-600 dark:text-amber-400">Missing Coords</div>
          <div className="mt-1 text-2xl font-bold text-amber-700 dark:text-amber-300">
            {reasonCounts["COORDINATES_MISSING"] || 0}
          </div>
        </div>
        <div className="p-3.5 rounded-xl bg-white dark:bg-slate-900 border border-rose-200 dark:border-rose-900/50">
          <div className="text-xs font-semibold text-rose-600 dark:text-rose-400">Invalid Coords</div>
          <div className="mt-1 text-2xl font-bold text-rose-700 dark:text-rose-300">
            {reasonCounts["COORDINATES_INVALID"] || 0}
          </div>
        </div>
        <div className="p-3.5 rounded-xl bg-white dark:bg-slate-900 border border-purple-200 dark:border-purple-900/50">
          <div className="text-xs font-semibold text-purple-600 dark:text-purple-400">In Exclusion</div>
          <div className="mt-1 text-2xl font-bold text-purple-700 dark:text-purple-300">
            {reasonCounts["INSIDE_EXCLUSION"] || 0}
          </div>
        </div>
        <div className="p-3.5 rounded-xl bg-white dark:bg-slate-900 border border-blue-200 dark:border-blue-900/50">
          <div className="text-xs font-semibold text-blue-600 dark:text-blue-400">Outside Coverage</div>
          <div className="mt-1 text-2xl font-bold text-blue-700 dark:text-blue-300">
            {reasonCounts["OUTSIDE_COVERAGE"] || 0}
          </div>
        </div>
        <div className="p-3.5 rounded-xl bg-white dark:bg-slate-900 border border-orange-200 dark:border-orange-900/50">
          <div className="text-xs font-semibold text-orange-600 dark:text-orange-400">Store / Partner</div>
          <div className="mt-1 text-2xl font-bold text-orange-700 dark:text-orange-300">
            {(reasonCounts["STORE_NOT_ELIGIBLE"] || 0) + (reasonCounts["NO_ELIGIBLE_PARTNER"] || 0)}
          </div>
        </div>
      </div>

      {/* ── Filters & Search Toolbar ── */}
      <div className="p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex flex-col md:flex-row items-center gap-3">
        <div className="relative flex-1 w-full">
          <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
          <input
            type="text"
            placeholder="Search recipient, address, city, pincode, company..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            className="w-full pl-9 pr-3 py-1.5 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500 text-slate-900 dark:text-white"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
          <select
            value={reasonCodeFilter}
            onChange={(e) => {
              setReasonCodeFilter(e.target.value);
              setPage(1);
            }}
            className="py-1.5 px-2.5 text-xs font-medium bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg outline-none text-slate-700 dark:text-slate-300"
          >
            <option value="">All Reasons</option>
            <option value="COORDINATES_MISSING">Coordinates Missing</option>
            <option value="COORDINATES_INVALID">Coordinates Invalid</option>
            <option value="INSIDE_EXCLUSION">Inside Exclusion</option>
            <option value="OUTSIDE_COVERAGE">Outside Coverage</option>
            <option value="STORE_NOT_ELIGIBLE">Store Not Eligible</option>
            <option value="NO_ELIGIBLE_PARTNER">No Eligible Partner</option>
            <option value="PENDING_REVIEW">Pending Review</option>
          </select>

          <select
            value={entityTypeFilter}
            onChange={(e) => {
              setEntityTypeFilter(e.target.value);
              setPage(1);
            }}
            className="py-1.5 px-2.5 text-xs font-medium bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg outline-none text-slate-700 dark:text-slate-300"
          >
            <option value="">All Entity Types</option>
            <option value="ROSTER_EMPLOYEE">Roster Employee</option>
            <option value="GIFTING_RECIPIENT">Gifting Recipient</option>
            <option value="DIRECT_ORDER">Direct Order</option>
          </select>

          <select
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value);
              setPage(1);
            }}
            className="py-1.5 px-2.5 text-xs font-medium bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg outline-none text-slate-700 dark:text-slate-300"
          >
            <option value="">Unassigned & Pending</option>
            <option value="UNASSIGNED">Unassigned Only</option>
            <option value="PENDING_REVIEW">Pending Review Only</option>
          </select>
        </div>
      </div>

      {/* ── Unresolved Queue Table ── */}
      <div className="rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 dark:bg-slate-800/60 text-slate-600 dark:text-slate-300 text-xs font-semibold uppercase tracking-wider border-b border-slate-200 dark:border-slate-800">
              <tr>
                <th className="py-3 px-4">Entity & Recipient</th>
                <th className="py-3 px-4">Corporate Account</th>
                <th className="py-3 px-4">Delivery Address</th>
                <th className="py-3 px-4">GPS Coordinates</th>
                <th className="py-3 px-4">Reason Code</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {loading ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-slate-500">
                    <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-indigo-500" />
                    <span>Loading unresolved delivery items...</span>
                  </td>
                </tr>
              ) : items.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-slate-500">
                    <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto mb-2" />
                    <p className="font-semibold text-slate-900 dark:text-white">Review queue is empty</p>
                    <p className="text-xs text-slate-400 mt-1">All corporate delivery targets have been successfully matched.</p>
                  </td>
                </tr>
              ) : (
                items.map((item) => (
                  <tr key={item.id} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/30 transition-colors">
                    <td className="py-3.5 px-4">
                      <div className="font-medium text-slate-900 dark:text-white flex items-center gap-1.5">
                        <User className="w-3.5 h-3.5 text-slate-400" />
                        <span>{item.recipient_name || "Unnamed Recipient"}</span>
                      </div>
                      <div className="text-xs text-slate-500 mt-0.5 flex items-center gap-2">
                        <span className="font-mono text-[10px] bg-slate-100 dark:bg-slate-800 px-1 py-0.5 rounded">
                          {item.entity_type}
                        </span>
                        {item.masked_phone && <span>{item.masked_phone}</span>}
                      </div>
                    </td>

                    <td className="py-3.5 px-4">
                      {item.account_name ? (
                        <div className="flex items-center gap-1 text-slate-700 dark:text-slate-300 font-medium">
                          <Building2 className="w-3.5 h-3.5 text-slate-400" />
                          <span>{item.account_name}</span>
                        </div>
                      ) : (
                        <span className="text-xs text-slate-400">Direct Delivery</span>
                      )}
                    </td>

                    <td className="py-3.5 px-4 max-w-xs">
                      <div className="truncate text-slate-800 dark:text-slate-200" title={item.delivery_address}>
                        {item.delivery_address}
                      </div>
                      <div className="text-xs text-slate-500 mt-0.5">
                        {item.delivery_city || "Unknown City"} {item.delivery_pincode ? `• PIN ${item.delivery_pincode}` : ""}
                      </div>
                    </td>

                    <td className="py-3.5 px-4">
                      {item.latitude !== null && item.longitude !== null ? (
                        <div className="text-xs font-mono text-slate-700 dark:text-slate-300">
                          {Number(item.latitude).toFixed(4)}, {Number(item.longitude).toFixed(4)}
                        </div>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-xs text-amber-600 dark:text-amber-400 font-medium">
                          <AlertTriangle className="w-3 h-3" />
                          <span>Missing</span>
                        </span>
                      )}
                    </td>

                    <td className="py-3.5 px-4">
                      <div>{getReasonBadge(item.reason_code)}</div>
                      <div className="text-[11px] text-slate-400 mt-1 max-w-xs truncate" title={item.diagnostics_message || item.reason_description}>
                        {item.diagnostics_message || item.reason_description}
                      </div>
                    </td>

                    <td className="py-3.5 px-4 text-right">
                      <button
                        onClick={() => handleOpenReview(item)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-100 dark:hover:bg-indigo-900 transition-colors cursor-pointer"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                        <span>Review & Resolve</span>
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* ── Pagination ── */}
        <div className="p-3 bg-slate-50 dark:bg-slate-800/40 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between text-xs text-slate-500">
          <div>
            Showing {items.length} of {totalCount} items (Page {page} of {totalPages})
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setPage((p) => Math.max(p - 1, 1))}
              disabled={page <= 1}
              className="p-1.5 rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 disabled:opacity-40 cursor-pointer"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              onClick={() => setPage((p) => Math.min(p + 1, totalPages))}
              disabled={page >= totalPages}
              className="p-1.5 rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 disabled:opacity-40 cursor-pointer"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* ── Review & Resolution Modal ── */}
      {selectedItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="bg-white dark:bg-slate-900 rounded-2xl max-w-4xl w-full max-h-[90vh] flex flex-col border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden">
            {/* Modal Header */}
            <div className="p-5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50 dark:bg-slate-850">
              <div className="flex items-center gap-2.5">
                <span className="p-2 rounded-xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400">
                  <ShieldAlert className="w-5 h-5" />
                </span>
                <div>
                  <h2 className="text-base font-bold text-slate-900 dark:text-white">
                    Super Admin Unresolved Location Review
                  </h2>
                  <p className="text-xs text-slate-500">
                    Assignment ID: <span className="font-mono text-slate-700 dark:text-slate-300">{selectedItem.id}</span>
                  </p>
                </div>
              </div>
              <button
                onClick={handleCloseModal}
                className="p-2 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Scrollable Body */}
            <div className="p-6 overflow-y-auto space-y-6 flex-1">
              {/* Delivery Target Overview */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 text-xs">
                <div>
                  <span className="text-slate-400 font-semibold block">Recipient & Company</span>
                  <div className="font-bold text-sm text-slate-900 dark:text-white mt-0.5">
                    {selectedItem.recipient_name || "Unnamed"}
                  </div>
                  <div className="text-slate-500 mt-0.5">
                    {selectedItem.account_name ? `Corporate Account: ${selectedItem.account_name}` : "Direct Retail / Employee"}
                  </div>
                  {selectedItem.masked_phone && (
                    <div className="text-slate-500 mt-0.5 flex items-center gap-1">
                      <Phone className="w-3 h-3 text-slate-400" />
                      <span>{selectedItem.masked_phone}</span>
                    </div>
                  )}
                </div>

                <div>
                  <span className="text-slate-400 font-semibold block">Delivery Destination</span>
                  <div className="text-slate-800 dark:text-slate-200 mt-0.5 font-medium">
                    {selectedItem.delivery_address}
                  </div>
                  <div className="text-slate-500 mt-0.5">
                    {selectedItem.delivery_city} {selectedItem.delivery_pincode ? `• PIN: ${selectedItem.delivery_pincode}` : ""}
                  </div>
                  <div className="text-slate-500 mt-0.5 font-mono">
                    Coords: {selectedItem.latitude ?? "N/A"}, {selectedItem.longitude ?? "N/A"}
                  </div>
                </div>
              </div>

              {/* Current Diagnostic Status */}
              <div className="p-4 rounded-xl border border-amber-200 dark:border-amber-900/60 bg-amber-50/50 dark:bg-amber-950/20">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                  <span className="text-xs font-bold text-amber-800 dark:text-amber-300">
                    Routing Evaluation Outcome: {selectedItem.reason_code}
                  </span>
                </div>
                <p className="mt-1 text-xs text-amber-700 dark:text-amber-400">
                  {selectedItem.diagnostics_message || selectedItem.reason_description}
                </p>
              </div>

              {/* Candidate Store & Partner Analysis */}
              <div>
                <h3 className="text-xs font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wider mb-2">
                  Geographic Candidate Analysis
                </h3>
                {loadingCandidates ? (
                  <div className="p-6 text-center text-xs text-slate-500 bg-slate-50 dark:bg-slate-800 rounded-xl">
                    <RefreshCw className="w-4 h-4 animate-spin mx-auto mb-1 text-indigo-500" />
                    <span>Evaluating store polygon and radius matches...</span>
                  </div>
                ) : candidateError ? (
                  <div className="p-3 text-xs text-rose-600 bg-rose-50 dark:bg-rose-950/30 rounded-xl">
                    {candidateError}
                  </div>
                ) : candidates ? (
                  <div className="space-y-3">
                    <div className="rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden text-xs">
                      <table className="w-full text-left">
                        <thead className="bg-slate-50 dark:bg-slate-800 font-semibold text-slate-500">
                          <tr>
                            <th className="py-2 px-3">Store Name</th>
                            <th className="py-2 px-3">Distance</th>
                            <th className="py-2 px-3">Match Class</th>
                            <th className="py-2 px-3">Corporate Routing</th>
                            <th className="py-2 px-3">Exclusion</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                          {candidates.candidate_stores.length === 0 ? (
                            <tr>
                              <td colSpan={5} className="py-4 text-center text-slate-400">
                                {candidates.diagnostics_message || "No candidate stores within coverage range."}
                              </td>
                            </tr>
                          ) : (
                            candidates.candidate_stores.slice(0, 5).map((st) => (
                              <tr key={st.store_id} className="hover:bg-slate-50/50">
                                <td className="py-2 px-3 font-medium text-slate-800 dark:text-slate-200">
                                  {st.store_name} ({st.store_code})
                                </td>
                                <td className="py-2 px-3 font-mono text-slate-600 dark:text-slate-400">
                                  {st.distance_km} km
                                </td>
                                <td className="py-2 px-3">
                                  <span
                                    className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                                      st.match_class === "POLYGON"
                                        ? "bg-emerald-100 text-emerald-800"
                                        : st.match_class === "RADIUS"
                                        ? "bg-blue-100 text-blue-800"
                                        : "bg-slate-100 text-slate-500"
                                    }`}
                                  >
                                    {st.match_class}
                                  </span>
                                </td>
                                <td className="py-2 px-3">
                                  {st.is_corporate_routing_eligible ? (
                                    <span className="text-emerald-600 font-semibold">Eligible</span>
                                  ) : (
                                    <span className="text-rose-500">Ineligible</span>
                                  )}
                                </td>
                                <td className="py-2 px-3">
                                  {st.is_inside_exclusion ? (
                                    <span className="text-purple-600 font-bold">Inside Exclusion</span>
                                  ) : (
                                    <span className="text-slate-400">Clear</span>
                                  )}
                                </td>
                              </tr>
                            ))
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                ) : null}
              </div>

              {/* Action Form Tabs */}
              <div className="border-t border-slate-200 dark:border-slate-800 pt-4">
                <div className="flex border-b border-slate-200 dark:border-slate-700 mb-4">
                  <button
                    onClick={() => setActiveActionTab("CORRECT")}
                    className={`pb-2 px-3 text-xs font-bold transition-colors cursor-pointer ${
                      activeActionTab === "CORRECT"
                        ? "border-b-2 border-indigo-600 text-indigo-600 dark:text-indigo-400"
                        : "text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
                    }`}
                  >
                    1. Correct Coordinates & Re-Evaluate
                  </button>
                  <button
                    onClick={() => setActiveActionTab("MANUAL")}
                    className={`pb-2 px-3 text-xs font-bold transition-colors cursor-pointer ${
                      activeActionTab === "MANUAL"
                        ? "border-b-2 border-indigo-600 text-indigo-600 dark:text-indigo-400"
                        : "text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
                    }`}
                  >
                    2. Manual Store/Partner Assignment
                  </button>
                  <button
                    onClick={() => setActiveActionTab("HOLD")}
                    className={`pb-2 px-3 text-xs font-bold transition-colors cursor-pointer ${
                      activeActionTab === "HOLD"
                        ? "border-b-2 border-indigo-600 text-indigo-600 dark:text-indigo-400"
                        : "text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
                    }`}
                  >
                    3. Hold Pending Client Verification
                  </button>
                </div>

                {actionError && (
                  <div className="mb-4 p-3 rounded-lg bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-xs text-rose-700 dark:text-rose-300">
                    {actionError}
                  </div>
                )}

                {/* Tab 1 Form: Correct Coordinates */}
                {activeActionTab === "CORRECT" && (
                  <div className="space-y-3 text-xs">
                    <p className="text-slate-500">
                      Update GPS coordinates to re-trigger the deterministic point-in-polygon matching engine.
                    </p>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-slate-600 dark:text-slate-400 font-semibold mb-1">
                          Latitude (e.g. 12.9716)
                        </label>
                        <input
                          type="text"
                          value={formLat}
                          onChange={(e) => setFormLat(e.target.value)}
                          placeholder="12.9716"
                          className="w-full p-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white font-mono"
                        />
                      </div>
                      <div>
                        <label className="block text-slate-600 dark:text-slate-400 font-semibold mb-1">
                          Longitude (e.g. 77.5946)
                        </label>
                        <input
                          type="text"
                          value={formLng}
                          onChange={(e) => setFormLng(e.target.value)}
                          placeholder="77.5946"
                          className="w-full p-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white font-mono"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="block text-slate-600 dark:text-slate-400 font-semibold mb-1">
                        Corrected Address (Optional)
                      </label>
                      <input
                        type="text"
                        value={formAddress}
                        onChange={(e) => setFormAddress(e.target.value)}
                        placeholder="Corrected address line..."
                        className="w-full p-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white"
                      />
                    </div>
                    <div>
                      <label className="block text-slate-600 dark:text-slate-400 font-semibold mb-1">
                        Correction Justification / Note
                      </label>
                      <input
                        type="text"
                        value={formReason}
                        onChange={(e) => setFormReason(e.target.value)}
                        placeholder="e.g. Customer provided corrected location pin via WhatsApp"
                        className="w-full p-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white"
                      />
                    </div>
                  </div>
                )}

                {/* Tab 2 Form: Manual Assign */}
                {activeActionTab === "MANUAL" && (
                  <div className="space-y-3 text-xs">
                    <p className="text-slate-500">
                      Force-assign a specific branch and partner. A mandatory audit justification is required.
                    </p>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-slate-600 dark:text-slate-400 font-semibold mb-1">
                          Select Fulfillment Store *
                        </label>
                        <select
                          value={formStoreId}
                          onChange={(e) => setFormStoreId(e.target.value)}
                          className="w-full p-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white"
                        >
                          <option value="">-- Choose Branch --</option>
                          {availableStores.map((st) => (
                            <option key={st.id} value={st.id}>
                              {st.name} ({st.code}) {st.is_eligible ? "✓ Eligible" : "⚠ Ineligible"}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label className="block text-slate-600 dark:text-slate-400 font-semibold mb-1">
                          Select Delivery Partner (Optional)
                        </label>
                        <select
                          value={formPartnerId}
                          onChange={(e) => setFormPartnerId(e.target.value)}
                          className="w-full p-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white"
                        >
                          <option value="">-- Default / Branch Driver --</option>
                          {availablePartners.map((pt) => (
                            <option key={pt.id} value={pt.id}>
                              {pt.name} ({pt.type})
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>

                    <div>
                      <label className="block text-slate-600 dark:text-slate-400 font-semibold mb-1">
                        Mandatory Audit Justification (Min 5 chars) *
                      </label>
                      <textarea
                        rows={2}
                        value={formReason}
                        onChange={(e) => setFormReason(e.target.value)}
                        placeholder="Detailed operational reason for manual assignment (recorded in immutable audit log)..."
                        className="w-full p-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white"
                      />
                    </div>
                  </div>
                )}

                {/* Tab 3 Form: Hold Pending Review */}
                {activeActionTab === "HOLD" && (
                  <div className="space-y-3 text-xs">
                    <p className="text-slate-500">
                      Mark the assignment as <span className="font-semibold">PENDING_REVIEW</span> while waiting for client confirmation.
                    </p>
                    <div>
                      <label className="block text-slate-600 dark:text-slate-400 font-semibold mb-1">
                        Review Hold Reason / Instructions
                      </label>
                      <input
                        type="text"
                        value={formReason}
                        onChange={(e) => setFormReason(e.target.value)}
                        placeholder="e.g. Awaiting client phone call to confirm exact apartment door number."
                        className="w-full p-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white"
                      />
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-4 bg-slate-50 dark:bg-slate-850 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between">
              <button
                type="button"
                onClick={handleCloseModal}
                disabled={submitting}
                className="px-4 py-2 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg cursor-pointer"
              >
                Cancel
              </button>

              <button
                type="button"
                onClick={handleExecuteResolution}
                disabled={submitting}
                className="flex items-center gap-1.5 px-4 py-2 text-xs font-semibold rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white disabled:opacity-50 transition-colors cursor-pointer"
              >
                {submitting ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Processing Transaction...</span>
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>Confirm & Persist Resolution</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
