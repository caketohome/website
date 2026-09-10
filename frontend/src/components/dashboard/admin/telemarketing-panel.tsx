"use client";

import { useEffect, useState, useMemo, memo } from "react";
import {
  PhoneCall, Users, Calendar, Award, DollarSign, Download, Search,
  RefreshCw, CheckCircle2, UserCheck, Clock, FileSpreadsheet, Sparkles,
  ChevronRight, X, AlertCircle, ShoppingBag, Send, Phone, MessageSquare,
  TrendingUp, BarChart3, HelpCircle, ArrowRight, UserPlus, Filter, Check, Eye
} from "lucide-react";
import { Badge, Button, Heading, Text, Input } from "@medusajs/ui";
import { apiClient } from "@frontend/lib/api-client";
import {
  ReorderCandidate,
  TelemarketingMetrics,
  TelemarketingContactStatus,
  OpportunityType,
  ReorderPriority,
  ScoreBreakdown
} from "@frontend/lib/telemarketing-engine";
import type { TelemarketingExportService as TelemarketingExportServiceType } from "@frontend/lib/telemarketing-export-service";

const TelemarketingExportService: typeof TelemarketingExportServiceType = new Proxy({} as any, {
  get: (_target, prop: string) => async (...args: any[]) => {
    const mod = await import("@frontend/lib/telemarketing-export-service");
    return (mod.TelemarketingExportService as any)[prop](...args);
  }
});

import { CustomerProfileDrawer } from "./crm/customer-profile-drawer";
import { WhatsAppContactModal } from "./crm/whatsapp-contact-modal";
import { CustomerRecord } from "@frontend/lib/crm/types";

type ViewTab = "queue" | "high_priority" | "calls_due" | "follow_ups" | "converted" | "analytics";

export interface EligibleStaffUser {
  id: string;
  user_id: string;
  name: string;
  email: string;
  phone: string;
  role: string;
  profile_names?: string[];
  profile_name?: string;
  branch_id?: string | null;
  branch_name?: string | null;
  city?: string | null;
}

export const TelemarketingPanel = memo(function TelemarketingPanel() {
  const [candidates, setCandidates] = useState<ReorderCandidate[]>([]);
  const [metrics, setMetrics] = useState<TelemarketingMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [isExporting, setIsExporting] = useState(false);
  const [isEvaluating, setIsEvaluating] = useState(false);
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; message: string } | null>(null);

  // Active View Tab
  const [activeTab, setActiveTab] = useState<ViewTab>("queue");

  // Filters
  const [priorityFilter, setPriorityFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [cityFilter, setCityFilter] = useState("all");
  const [opportunityTypeFilter, setOpportunityTypeFilter] = useState("all");
  const [dateFilter, setDateFilter] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");

  // Modals & Drawers State
  const [selectedCandidate, setSelectedCandidate] = useState<ReorderCandidate | null>(null);
  const [scoreModalCandidate, setScoreModalCandidate] = useState<ReorderCandidate | null>(null);
  const [callModalCandidate, setCallModalCandidate] = useState<ReorderCandidate | null>(null);
  const [assignModalCandidate, setAssignModalCandidate] = useState<ReorderCandidate | null>(null);
  const [whatsAppCustomer, setWhatsAppCustomer] = useState<CustomerRecord | null>(null);
  const [customerDrawerUid, setCustomerDrawerUid] = useState<string | null>(null);

  // Authoritative Staff State from Backend RBAC
  const [eligibleStaff, setEligibleStaff] = useState<EligibleStaffUser[]>([]);
  const [loadingStaff, setLoadingStaff] = useState(false);
  const [staffLoadError, setStaffLoadError] = useState<string | null>(null);

  // Real Customer Orders for Conversion Attribution State
  const [customerOrders, setCustomerOrders] = useState<any[]>([]);
  const [loadingOrders, setLoadingOrders] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<any | null>(null);
  const [orderLoadError, setOrderLoadError] = useState<string | null>(null);

  // Call Logging Form State
  const [callOutcome, setCallOutcome] = useState<TelemarketingContactStatus>("CONNECTED");
  const [callNote, setCallNote] = useState("");
  const [followupDate, setFollowupDate] = useState("");
  const [assignedStaffId, setAssignedStaffId] = useState("");
  const [assignedStaffName, setAssignedStaffName] = useState("");
  const [isSavingCall, setIsSavingCall] = useState(false);

  const fetchEligibleStaff = async (overrideCity?: string) => {
    setLoadingStaff(true);
    setStaffLoadError(null);
    try {
      const activeCity = overrideCity !== undefined ? overrideCity : (cityFilter !== "all" ? cityFilter : undefined);
      const res: any = await apiClient.getEligibleTelecallers({ city: activeCity });
      const list: EligibleStaffUser[] = res?.staff || [];
      setEligibleStaff(list);
      return list;
    } catch (err: any) {
      setStaffLoadError("Unable to load eligible telecallers. Retry.");
      return [];
    } finally {
      setLoadingStaff(false);
    }
  };

  const fetchCustomerOrders = async (customerUid: string) => {
    if (!customerUid) return;
    setLoadingOrders(true);
    setOrderLoadError(null);
    try {
      const res: any = await apiClient.getCustomerOrders(customerUid);
      const all: any[] = res?.orders || [];
      // Filter to eligible orders (exclude cancelled or failed)
      const eligible = all.filter((o: any) => {
        const st = (o.status || o.order_status || "").toLowerCase();
        return st !== "cancelled" && st !== "failed" && st !== "refunded";
      });
      setCustomerOrders(eligible);
      if (eligible.length === 1) {
        setSelectedOrder(eligible[0]);
      } else if (eligible.length > 1) {
        setSelectedOrder((prev: any) => {
          if (prev && eligible.some((o: any) => o.id === prev.id)) return prev;
          return eligible[0];
        });
      } else {
        setSelectedOrder(null);
      }
    } catch (err: any) {
      setOrderLoadError("Unable to fetch customer orders. Click Refresh to retry.");
      setCustomerOrders([]);
      setSelectedOrder(null);
    } finally {
      setLoadingOrders(false);
    }
  };

  const fetchCandidates = async () => {
    setLoading(true);
    try {
      let activePriority = priorityFilter;
      let activeStatus = statusFilter;
      let activeDate = dateFilter;

      if (activeTab === "high_priority") activePriority = "HIGH";
      if (activeTab === "calls_due") activeDate = "today";
      if (activeTab === "follow_ups") activeStatus = "FOLLOW_UP";
      if (activeTab === "converted") activeStatus = "CONVERTED";

      const res: any = await apiClient.getAdminTelemarketingCandidates({
        priority: activePriority,
        status: activeStatus,
        city: cityFilter,
        opportunity_type: opportunityTypeFilter,
        date_filter: activeDate,
        search: searchQuery,
      });

      setCandidates(res?.candidates || []);
      setMetrics(res?.metrics || null);
    } catch (err: any) {
      console.error("Failed to load telemarketing candidates:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchEligibleStaff();
  }, [cityFilter]);

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchCandidates();
    }, 200);
    return () => clearTimeout(timer);
  }, [activeTab, priorityFilter, statusFilter, cityFilter, opportunityTypeFilter, dateFilter, searchQuery]);

  const handleEvaluate = async () => {
    setIsEvaluating(true);
    setFeedback(null);
    try {
      const res: any = await apiClient.evaluateAdminTelemarketingCandidates("2026-08-17");
      setFeedback({
        type: "success",
        message: `Evaluation Complete! Scanned ${res?.evaluated || 0} completed orders. Created ${res?.new_candidates || 0} new candidates, refreshed ${res?.updated_candidates || 0} existing records with zero duplicates.`,
      });
      setTimeout(() => setFeedback(null), 6000);
      fetchCandidates();
    } catch (err: any) {
      setFeedback({ type: "error", message: err?.message || "Failed to evaluate historical orders" });
    } finally {
      setIsEvaluating(false);
    }
  };

  const handleExport = async (mode: "calling_list" | "full_workbook") => {
    setIsExporting(true);
    try {
      if (mode === "full_workbook") {
        const allRes: any = await apiClient.getAdminTelemarketingCandidates({ limit: 1000 });
        const exportList = allRes?.candidates || candidates;
        const exportMetrics = allRes?.metrics || metrics;
        await TelemarketingExportService.exportTelemarketingWorkbook(exportList, exportMetrics);
        setFeedback({ type: "success", message: "Complete 6-sheet master telemarketing workbook exported!" });
      } else {
        await TelemarketingExportService.exportTelecallerCallingList(candidates, {
          priorityFilter,
          cityFilter,
          statusFilter,
        });
        setFeedback({ type: "success", message: "Clean Telecaller Calling List exported successfully!" });
      }
      setTimeout(() => setFeedback(null), 4000);
    } catch (err: any) {
      alert("Failed to export: " + err?.message);
    } finally {
      setIsExporting(false);
    }
  };

  const openCallModal = async (cand: ReorderCandidate) => {
    setCallModalCandidate(cand);
    setCallOutcome(cand.contact_status === "NEW" ? "CONNECTED" : cand.contact_status);
    setFollowupDate(cand.next_followup_date || "");
    setCallNote("");
    setSelectedOrder(null);
    setCustomerOrders([]);

    fetchCustomerOrders(cand.customer_uid);

    const staff = await fetchEligibleStaff(cand.city);
    const existingStaff = staff.find((s) => s.id === cand.assigned_staff_id || s.name === cand.assigned_to);
    if (existingStaff) {
      setAssignedStaffId(existingStaff.id);
      setAssignedStaffName(existingStaff.name);
    } else if (staff.length > 0) {
      setAssignedStaffId(staff[0].id);
      setAssignedStaffName(staff[0].name);
    } else {
      setAssignedStaffId("");
      setAssignedStaffName("");
    }
  };

  const handleSaveCallLog = async () => {
    if (!callModalCandidate) return;
    if ((callOutcome === "ORDER_PLACED" || callOutcome === "CONVERTED") && !selectedOrder) {
      alert("Please select an eligible customer order to mark the call as Order Placed / Converted.");
      return;
    }

    setIsSavingCall(true);
    try {
      await apiClient.logAdminTelemarketingCall(callModalCandidate.id, {
        outcome: callOutcome,
        note: callNote,
        staffId: assignedStaffId || undefined,
        staffName: assignedStaffName || undefined,
        nextFollowupDate: followupDate || undefined,
        convertedOrderId: (callOutcome === "ORDER_PLACED" || callOutcome === "CONVERTED") ? selectedOrder?.id : undefined,
      });

      setFeedback({
        type: "success",
        message: (callOutcome === "ORDER_PLACED" || callOutcome === "CONVERTED")
          ? `Call logged & Order #${selectedOrder?.order_number || selectedOrder?.id} (₹${(Number(selectedOrder?.total) || Number(selectedOrder?.grand_total) || 0).toLocaleString("en-IN")}) attributed to ${callModalCandidate.customer_name}!`
          : `Call successfully logged for ${callModalCandidate.customer_name} (${callOutcome})!`,
      });
      setTimeout(() => setFeedback(null), 5000);
      setCallModalCandidate(null);
      fetchCandidates();
    } catch (err: any) {
      alert("Failed to save call log: " + err?.message);
    } finally {
      setIsSavingCall(false);
    }
  };

  const handleAssignStaff = async (cand: ReorderCandidate, staff: EligibleStaffUser) => {
    try {
      await apiClient.assignAdminTelemarketingCandidate(cand.id, staff.id, staff.name);
      setFeedback({ type: "success", message: `Assigned opportunity to ${staff.name}` });
      setTimeout(() => setFeedback(null), 3000);
      setAssignModalCandidate(null);
      fetchCandidates();
    } catch (err: any) {
      alert("Failed to assign staff: " + err?.message);
    }
  };

  const handleOpenWhatsApp = (cand: ReorderCandidate) => {
    const custRecord: any = {
      customer_uid: cand.customer_uid,
      id: cand.customer_uid,
      name: cand.customer_name,
      phone: cand.customer_phone,
      email: cand.customer_email || undefined,
      city_name: cand.city,
      consent: {
        whatsapp_status: "ELIGIBLE",
        marketing_whatsapp: "OPTED_IN",
      },
    };
    setWhatsAppCustomer(custRecord);
  };

  // Helper badge styles
  const getPriorityBadge = (p: ReorderPriority, score: number) => {
    if (p === "HIGH") {
      return (
        <button
          onClick={() => setScoreModalCandidate(selectedCandidate)}
          className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-rose-100 text-rose-700 hover:bg-rose-200 border border-rose-300 transition shadow-sm"
          title="Click to view explainable 5-signal score breakdown"
        >
          <Sparkles className="w-3 h-3 text-rose-600" />
          HIGH ({score})
        </button>
      );
    }
    if (p === "MEDIUM") {
      return (
        <button
          onClick={() => setScoreModalCandidate(selectedCandidate)}
          className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-amber-100 text-amber-800 hover:bg-amber-200 border border-amber-300 transition shadow-sm"
          title="Click to view explainable 5-signal score breakdown"
        >
          MEDIUM ({score})
        </button>
      );
    }
    return (
      <button
        onClick={() => setScoreModalCandidate(selectedCandidate)}
        className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-slate-100 text-slate-700 hover:bg-slate-200 border border-slate-300 transition"
      >
        LOW ({score})
      </button>
    );
  };

  const getStatusBadge = (status: TelemarketingContactStatus) => {
    switch (status) {
      case "NEW":
      case "QUEUED":
        return <Badge color="blue">NEW</Badge>;
      case "ASSIGNED":
      case "CALL_DUE":
        return <Badge color="orange">CALL DUE</Badge>;
      case "CONNECTED":
      case "CALLED":
        return <Badge color="purple">CONNECTED</Badge>;
      case "INTERESTED":
        return <Badge color="green">INTERESTED</Badge>;
      case "FOLLOW_UP":
        return <Badge color="orange">FOLLOW-UP DUE</Badge>;
      case "ORDER_PLACED":
      case "CONVERTED":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
            <CheckCircle2 className="w-3 h-3" /> CONVERTED
          </span>
        );
      case "NO_ANSWER":
      case "BUSY":
        return <Badge color="grey">NO ANSWER</Badge>;
      case "NOT_INTERESTED":
        return <Badge color="red">NOT INTERESTED</Badge>;
      default:
        return <Badge color="grey">{status}</Badge>;
    }
  };

  const getOpportunityTypeLabel = (type: OpportunityType) => {
    switch (type) {
      case "BIRTHDAY_REORDER":
        return "🎂 Birthday Reorder";
      case "ANNIVERSARY_REORDER":
        return "💍 Anniversary Reorder";
      case "SEASONAL_REORDER":
        return "🍂 Seasonal Special";
      case "HIGH_VALUE_REACTIVATION":
        return "⭐ VIP Reactivation";
      case "RECENT_REPEAT_PURCHASE":
        return "🔄 Frequent Buyer";
      case "DORMANT_CUSTOMER":
        return "💤 Dormant Reorder";
      default:
        return "✨ Celebration Reorder";
    }
  };

  return (
    <div className="space-y-6">
      {/* ── HEADER BANNER ────────────────────────────────────────────── */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-gradient-to-r from-slate-900 via-rose-950 to-slate-900 p-6 rounded-2xl text-white shadow-xl border border-rose-900/30">
        <div>
          <div className="flex items-center gap-2.5 mb-1.5">
            <span className="p-2 bg-rose-600/30 text-rose-300 rounded-xl border border-rose-500/40 shadow-inner">
              <PhoneCall className="w-6 h-6" />
            </span>
            <Heading level="h2" className="text-2xl font-black text-white tracking-tight">
              Telemarketing Reorder & Reactivation Intelligence
            </Heading>
          </div>
          <Text className="text-slate-300 text-sm max-w-3xl">
            Real completed order scanner powered by deterministic 5-signal scoring. Authoritatively connected to canonical <span className="font-mono text-rose-300">customer_uid</span>, Customer 360 CRM, live order history, staff access profiles, and order conversion attribution.
          </Text>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <Button
            size="small"
            variant="secondary"
            onClick={handleEvaluate}
            disabled={isEvaluating}
            className="bg-white/10 hover:bg-white/20 text-white border-white/20 font-semibold"
          >
            <RefreshCw className={`w-4 h-4 mr-1.5 ${isEvaluating ? "animate-spin text-rose-400" : ""}`} />
            {isEvaluating ? "Evaluating Orders..." : "Evaluate Prior Orders"}
          </Button>

          <Button
            size="small"
            variant="secondary"
            onClick={() => handleExport("calling_list")}
            disabled={isExporting}
            className="bg-white/10 hover:bg-white/20 text-white border-white/20 font-semibold"
          >
            <Download className="w-4 h-4 mr-1.5" />
            Export Calling List
          </Button>

          <Button
            size="small"
            variant="secondary"
            onClick={() => handleExport("full_workbook")}
            disabled={isExporting}
            className="bg-rose-600 hover:bg-rose-700 text-white border-rose-500 font-semibold shadow-md"
          >
            <FileSpreadsheet className="w-4 h-4 mr-1.5" />
            Master 6-Sheet Export
          </Button>
        </div>
      </div>

      {/* ── FEEDBACK NOTIFICATION ────────────────────────────────────── */}
      {feedback && (
        <div
          className={`p-4 rounded-xl flex items-center gap-3 border shadow-sm ${
            feedback.type === "success"
              ? "bg-emerald-50 text-emerald-900 border-emerald-200"
              : "bg-rose-50 text-rose-900 border-rose-200"
          }`}
        >
          {feedback.type === "success" ? (
            <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
          ) : (
            <AlertCircle className="w-5 h-5 text-rose-600 shrink-0" />
          )}
          <Text className="text-sm font-medium">{feedback.message}</Text>
        </div>
      )}

      {/* ── EXECUTIVE KPI METRICS CARDS ──────────────────────────────── */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-3">
        <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-sm">
          <Text className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Total Candidates</Text>
          <div className="text-2xl font-black text-slate-900 mt-1">{metrics?.total_candidates ?? 0}</div>
          <span className="text-[11px] text-slate-400 font-medium">Scanned Patron Pool</span>
        </div>

        <div className="bg-rose-50/70 p-3.5 rounded-xl border border-rose-200/80 shadow-sm">
          <Text className="text-xs font-semibold text-rose-700 uppercase tracking-wider">High Priority</Text>
          <div className="text-2xl font-black text-rose-900 mt-1">{metrics?.high_priority ?? 0}</div>
          <span className="text-[11px] text-rose-600 font-medium">Score 80–100</span>
        </div>

        <div className="bg-amber-50/70 p-3.5 rounded-xl border border-amber-200/80 shadow-sm">
          <Text className="text-xs font-semibold text-amber-800 uppercase tracking-wider">Calls Due Today</Text>
          <div className="text-2xl font-black text-amber-900 mt-1">{metrics?.calls_due_today ?? 0}</div>
          <span className="text-[11px] text-amber-700 font-medium">±3 Days Anniversary</span>
        </div>

        <div className="bg-orange-50/70 p-3.5 rounded-xl border border-orange-200/80 shadow-sm">
          <Text className="text-xs font-semibold text-orange-800 uppercase tracking-wider">Follow-Ups Due</Text>
          <div className="text-2xl font-black text-orange-900 mt-1">{metrics?.follow_ups_due ?? 0}</div>
          <span className="text-[11px] text-orange-700 font-medium">Scheduled Today</span>
        </div>

        <div className="bg-blue-50/70 p-3.5 rounded-xl border border-blue-200/80 shadow-sm">
          <Text className="text-xs font-semibold text-blue-800 uppercase tracking-wider">Contacted</Text>
          <div className="text-2xl font-black text-blue-900 mt-1">{metrics?.contacted_count ?? 0}</div>
          <span className="text-[11px] text-blue-700 font-medium">Outreach Attempted</span>
        </div>

        <div className="bg-purple-50/70 p-3.5 rounded-xl border border-purple-200/80 shadow-sm">
          <Text className="text-xs font-semibold text-purple-800 uppercase tracking-wider">Interested</Text>
          <div className="text-2xl font-black text-purple-900 mt-1">{metrics?.interested_count ?? 0}</div>
          <span className="text-[11px] text-purple-700 font-medium">Qualified Leads</span>
        </div>

        <div className="bg-emerald-50/70 p-3.5 rounded-xl border border-emerald-200/80 shadow-sm">
          <Text className="text-xs font-semibold text-emerald-800 uppercase tracking-wider">Converted</Text>
          <div className="text-2xl font-black text-emerald-900 mt-1">{metrics?.orders_generated ?? 0}</div>
          <span className="text-[11px] text-emerald-700 font-medium">{metrics?.conversion_rate_pct ?? 0}% Win Rate</span>
        </div>

        <div className="bg-emerald-900 text-white p-3.5 rounded-xl border border-emerald-800 shadow-sm">
          <Text className="text-xs font-semibold text-emerald-200 uppercase tracking-wider">Attributed Rev</Text>
          <div className="text-xl font-black text-emerald-300 mt-1">₹{(metrics?.revenue_generated ?? 0).toLocaleString("en-IN")}</div>
          <span className="text-[11px] text-emerald-200 font-medium">Confirmed Sales</span>
        </div>
      </div>

      {/* ── NAVIGATION TABS & ACTION BAR ─────────────────────────────── */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-200 pb-3">
        <div className="flex flex-wrap items-center gap-2">
          {[
            { key: "queue", label: "Action Queue", count: metrics?.total_candidates },
            { key: "high_priority", label: "High Priority", count: metrics?.high_priority },
            { key: "calls_due", label: "Calls Due Today", count: metrics?.calls_due_today },
            { key: "follow_ups", label: "Follow-Ups Due", count: metrics?.follow_ups_due },
            { key: "converted", label: "Converted Orders", count: metrics?.orders_generated },
          ].map((t) => (
            <button
              key={t.key}
              onClick={() => setActiveTab(t.key as ViewTab)}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 ${
                activeTab === t.key
                  ? "bg-slate-900 text-white shadow-md"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              }`}
            >
              {t.label}
              {t.count !== undefined && (
                <span
                  className={`px-2 py-0.5 rounded-full text-[10px] font-black ${
                    activeTab === t.key ? "bg-rose-600 text-white" : "bg-slate-300 text-slate-800"
                  }`}
                >
                  {t.count}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Search Bar */}
        <div className="relative w-full md:w-80">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search customer, phone, flavor, occasion..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2 bg-white border border-slate-200 rounded-xl text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-rose-500 transition shadow-sm"
          />
        </div>
      </div>

      {/* ── FILTER CHIPS BAR ─────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-3 bg-slate-50 p-3.5 rounded-xl border border-slate-200">
        <div className="flex items-center gap-1.5 text-slate-500 text-xs font-bold">
          <Filter className="w-3.5 h-3.5" /> Filters:
        </div>

        {/* Priority Filter */}
        <select
          value={priorityFilter}
          onChange={(e) => setPriorityFilter(e.target.value)}
          className="text-xs bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-slate-800 font-semibold focus:outline-none focus:ring-2 focus:ring-rose-500"
        >
          <option value="all">All Priorities</option>
          <option value="HIGH">High Priority (Score 80+)</option>
          <option value="MEDIUM">Medium Priority (50-79)</option>
          <option value="LOW">Low Priority (&lt;50)</option>
        </select>

        {/* Status Filter */}
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="text-xs bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-slate-800 font-semibold focus:outline-none focus:ring-2 focus:ring-rose-500"
        >
          <option value="all">All Contact Statuses</option>
          <option value="NEW">New (Uncontacted)</option>
          <option value="ASSIGNED">Assigned / Call Due</option>
          <option value="CONNECTED">Connected</option>
          <option value="INTERESTED">Interested</option>
          <option value="FOLLOW_UP">Follow-Up Scheduled</option>
          <option value="CONVERTED">Converted / Order Placed</option>
          <option value="NO_ANSWER">No Answer</option>
          <option value="NOT_INTERESTED">Not Interested</option>
        </select>

        {/* City Filter */}
        <select
          value={cityFilter}
          onChange={(e) => setCityFilter(e.target.value)}
          className="text-xs bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-slate-800 font-semibold focus:outline-none focus:ring-2 focus:ring-rose-500"
        >
          <option value="all">All Cities</option>
          <option value="Bengaluru">Bengaluru</option>
          <option value="Mumbai">Mumbai</option>
          <option value="Delhi">Delhi NCR</option>
        </select>

        {/* Opportunity Type */}
        <select
          value={opportunityTypeFilter}
          onChange={(e) => setOpportunityTypeFilter(e.target.value)}
          className="text-xs bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-slate-800 font-semibold focus:outline-none focus:ring-2 focus:ring-rose-500"
        >
          <option value="all">All Occasion Types</option>
          <option value="BIRTHDAY_REORDER">🎂 Birthday Reorder</option>
          <option value="ANNIVERSARY_REORDER">💍 Anniversary Reorder</option>
          <option value="SEASONAL_REORDER">🍂 Seasonal Special</option>
          <option value="HIGH_VALUE_REACTIVATION">⭐ VIP Reactivation</option>
          <option value="RECENT_REPEAT_PURCHASE">🔄 Frequent Buyer</option>
        </select>

        {/* Date Filter */}
        <select
          value={dateFilter}
          onChange={(e) => setDateFilter(e.target.value)}
          className="text-xs bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-slate-800 font-semibold focus:outline-none focus:ring-2 focus:ring-rose-500"
        >
          <option value="all">All Expected Dates</option>
          <option value="today">Today</option>
          <option value="tomorrow">Tomorrow</option>
          <option value="next_7_days">Next 7 Days</option>
          <option value="next_30_days">Next 30 Days</option>
        </select>

        {(priorityFilter !== "all" || statusFilter !== "all" || cityFilter !== "all" || opportunityTypeFilter !== "all" || dateFilter !== "all" || searchQuery) && (
          <button
            onClick={() => {
              setPriorityFilter("all");
              setStatusFilter("all");
              setCityFilter("all");
              setOpportunityTypeFilter("all");
              setDateFilter("all");
              setSearchQuery("");
            }}
            className="text-xs font-bold text-rose-600 hover:text-rose-700 underline ml-auto"
          >
            Reset Filters
          </button>
        )}
      </div>

      {/* ── OPPORTUNITY MASTER TABLE ─────────────────────────────────── */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-900 text-white font-bold uppercase tracking-wider text-[11px]">
                <th className="py-3.5 px-4">Priority & Score</th>
                <th className="py-3.5 px-4">Customer & Location</th>
                <th className="py-3.5 px-4">Previous Purchase</th>
                <th className="py-3.5 px-4">Reason & Recommended Pitch</th>
                <th className="py-3.5 px-4">Expected Date</th>
                <th className="py-3.5 px-4">Status & Agent</th>
                <th className="py-3.5 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-500 font-medium">
                    <RefreshCw className="w-6 h-6 animate-spin mx-auto text-rose-600 mb-2" />
                    Loading actionable telemarketing queue...
                  </td>
                </tr>
              ) : candidates.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-500">
                    <ShoppingBag className="w-8 h-8 mx-auto text-slate-400 mb-2" />
                    <Text className="font-bold text-slate-800">No telemarketing opportunities found.</Text>
                    <Text className="text-xs text-slate-500 mt-1">Try clicking "Evaluate Prior Orders" to scan completed order history.</Text>
                  </td>
                </tr>
              ) : (
                candidates.map((cand) => (
                  <tr key={cand.id} className="hover:bg-slate-50/80 transition group">
                    {/* Priority & Score */}
                    <td className="py-4 px-4 align-top">
                      <div className="space-y-1.5">
                        {getPriorityBadge(cand.priority, cand.score)}
                        <div className="text-[11px] text-slate-500 font-mono">
                          {getOpportunityTypeLabel(cand.opportunity_type)}
                        </div>
                        <button
                          onClick={() => setScoreModalCandidate(cand)}
                          className="text-[11px] text-rose-600 hover:text-rose-800 font-semibold underline flex items-center gap-1"
                        >
                          <HelpCircle className="w-3 h-3" /> Why this score?
                        </button>
                      </div>
                    </td>

                    {/* Customer & Location */}
                    <td className="py-4 px-4 align-top">
                      <div className="space-y-1">
                        <button
                          onClick={() => setCustomerDrawerUid(cand.customer_uid)}
                          className="font-bold text-slate-900 hover:text-rose-600 transition text-sm flex items-center gap-1 group-hover:underline"
                          title="Open full Customer 360 profile drawer"
                        >
                          {cand.customer_name}
                          <Eye className="w-3 h-3 text-slate-400 group-hover:text-rose-500" />
                        </button>
                        <div className="flex items-center gap-2">
                          <a
                            href={`tel:${cand.customer_phone.replace(/\D/g, "")}`}
                            className="font-mono text-slate-700 hover:text-emerald-700 font-semibold transition"
                          >
                            {cand.customer_phone}
                          </a>
                        </div>
                        <div className="text-[11px] text-slate-500 font-medium">
                          📍 {cand.area || cand.city}, {cand.city} {cand.pincode ? `(${cand.pincode})` : ""}
                        </div>
                        <span className="inline-block px-1.5 py-0.5 rounded bg-slate-100 font-mono text-[10px] text-slate-600 border border-slate-200">
                          {cand.customer_uid}
                        </span>
                      </div>
                    </td>

                    {/* Previous Purchase */}
                    <td className="py-4 px-4 align-top">
                      <div className="space-y-1 max-w-[220px]">
                        <div className="font-bold text-slate-900 leading-tight">
                          {cand.reference_product_name}
                        </div>
                        <div className="inline-block px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-200">
                          🎉 {cand.reference_occasion}
                        </div>
                        <div className="text-[11px] text-slate-500">
                          Ordered: <span className="font-semibold text-slate-700">{new Date(cand.reference_order_date).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}</span>
                        </div>
                        <div className="text-[11px] font-mono text-slate-700">
                          Value: <span className="font-bold text-slate-900">₹{cand.reference_order_value.toLocaleString("en-IN")}</span> ({cand.historical_order_count} lifetime orders)
                        </div>
                      </div>
                    </td>

                    {/* Reason & Recommended Pitch */}
                    <td className="py-4 px-4 align-top">
                      <div className="space-y-2 max-w-sm">
                        <div className="text-slate-700 text-xs font-medium leading-relaxed bg-slate-50 p-2.5 rounded-lg border border-slate-200">
                          <span className="font-bold text-slate-900 block mb-1">🎯 Context:</span>
                          {cand.reason}
                        </div>
                        <div className="text-slate-800 text-xs bg-rose-50/60 p-2.5 rounded-lg border border-rose-200/80">
                          <span className="font-bold text-rose-900 block mb-1">💬 Recommended Pitch:</span>
                          "{cand.pitch}"
                        </div>
                      </div>
                    </td>

                    {/* Expected Date */}
                    <td className="py-4 px-4 align-top">
                      <div className="space-y-1">
                        <div className="font-black text-slate-900 text-sm">
                          {new Date(cand.expected_date).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
                        </div>
                        <span
                          className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold ${
                            cand.expected_date_confidence === "HIGH"
                              ? "bg-emerald-100 text-emerald-800 border border-emerald-200"
                              : "bg-amber-100 text-amber-800 border border-amber-200"
                          }`}
                        >
                          {cand.expected_date_confidence} CONFIDENCE
                        </span>
                        {cand.next_followup_date && (
                          <div className="text-[11px] text-amber-800 font-semibold mt-1">
                            Follow-Up: {new Date(cand.next_followup_date).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}
                          </div>
                        )}
                      </div>
                    </td>

                    {/* Status & Assigned Agent */}
                    <td className="py-4 px-4 align-top">
                      <div className="space-y-2">
                        <div>{getStatusBadge(cand.contact_status)}</div>
                        <div className="text-xs">
                          <span className="text-slate-500 block text-[10px] uppercase font-bold">Assigned Telecaller:</span>
                          <button
                            onClick={() => {
                              setAssignModalCandidate(cand);
                              fetchEligibleStaff(cand.city);
                            }}
                            className="font-bold text-slate-800 hover:text-rose-600 flex items-center gap-1 mt-0.5 underline"
                            title="Click to reassign to an authorized active telecaller"
                          >
                            <UserCheck className="w-3 h-3 text-slate-400" />
                            {cand.assigned_to || "Unassigned"}
                          </button>
                        </div>
                      </div>
                    </td>

                    {/* Actions */}
                    <td className="py-4 px-4 align-top text-right">
                      <div className="flex flex-col items-end gap-1.5">
                        <div className="flex items-center gap-1.5">
                          {/* Direct Call Launcher */}
                          <a
                            href={`tel:${cand.customer_phone.replace(/\D/g, "")}`}
                            className="p-2 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 rounded-lg border border-emerald-200 transition shadow-sm"
                            title="Call customer in browser / phone"
                          >
                            <Phone className="w-3.5 h-3.5" />
                          </a>

                          {/* WhatsApp Launcher */}
                          <button
                            onClick={() => handleOpenWhatsApp(cand)}
                            className="p-2 bg-emerald-600 text-white hover:bg-emerald-700 rounded-lg shadow-sm transition"
                            title="Open WhatsApp Template"
                          >
                            <MessageSquare className="w-3.5 h-3.5" />
                          </button>

                          {/* Log Call Button */}
                          <Button
                            size="small"
                            variant="secondary"
                            onClick={() => openCallModal(cand)}
                            className="bg-slate-900 text-white hover:bg-slate-800 text-xs font-bold"
                          >
                            Log Call
                          </Button>
                        </div>

                        <button
                          onClick={() => setSelectedCandidate(cand)}
                          className="text-[11px] text-slate-500 hover:text-slate-800 font-semibold underline mt-1"
                        >
                          View Opportunity Details
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── 1. LOG CALL MODAL ────────────────────────────────────────── */}
      {callModalCandidate && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-xl rounded-2xl shadow-2xl border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95">
            <div className="bg-slate-900 p-5 text-white flex items-center justify-between">
              <div>
                <Heading level="h3" className="text-lg font-bold text-white flex items-center gap-2">
                  <PhoneCall className="w-5 h-5 text-rose-400" /> Log Call: {callModalCandidate.customer_name}
                </Heading>
                <Text className="text-xs text-slate-300 font-mono mt-0.5">
                  {callModalCandidate.customer_phone} | {callModalCandidate.customer_uid}
                </Text>
              </div>
              <button
                onClick={() => setCallModalCandidate(null)}
                className="p-1 text-slate-400 hover:text-white rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4 max-h-[80vh] overflow-y-auto">
              {/* Pitch Summary Cue */}
              <div className="bg-rose-50 p-3.5 rounded-xl border border-rose-200">
                <span className="font-bold text-rose-900 text-xs block mb-1">💬 Suggested Pitch:</span>
                <p className="text-xs text-slate-800 italic leading-relaxed">"{callModalCandidate.pitch}"</p>
              </div>

              {/* Call Outcome Selection */}
              <div>
                <label className="block text-xs font-bold text-slate-800 mb-1.5 uppercase tracking-wider">
                  Call Outcome *
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { key: "CONNECTED", label: "Connected" },
                    { key: "INTERESTED", label: "Interested" },
                    { key: "FOLLOW_UP", label: "Follow-Up Required" },
                    { key: "ORDER_PLACED", label: "Order Placed / Converted" },
                    { key: "NO_ANSWER", label: "No Answer" },
                    { key: "BUSY", label: "Busy / Call Later" },
                    { key: "NOT_INTERESTED", label: "Not Interested" },
                    { key: "WRONG_NUMBER", label: "Wrong Number" },
                    { key: "DO_NOT_CONTACT", label: "Do Not Contact" },
                  ].map((o) => (
                    <button
                      key={o.key}
                      type="button"
                      onClick={() => setCallOutcome(o.key as TelemarketingContactStatus)}
                      className={`px-3 py-2 rounded-xl text-xs font-bold border text-center transition ${
                        callOutcome === o.key
                          ? "bg-rose-600 text-white border-rose-600 shadow-md"
                          : "bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100"
                      }`}
                    >
                      {o.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Authoritative Staff Selector */}
              <div>
                <label className="block text-xs font-bold text-slate-800 mb-1.5 uppercase tracking-wider">
                  Attributed Telecaller *
                </label>
                {loadingStaff ? (
                  <div className="text-xs text-slate-500 bg-slate-50 p-2.5 rounded-xl border border-slate-200 flex items-center gap-2">
                    <RefreshCw className="w-3.5 h-3.5 animate-spin text-rose-600" /> Loading eligible telecallers from staff database...
                  </div>
                ) : staffLoadError ? (
                  <div className="flex items-center justify-between text-xs text-rose-600 bg-rose-50 p-2.5 rounded-xl border border-rose-200">
                    <span>{staffLoadError}</span>
                    <button type="button" onClick={() => fetchEligibleStaff(callModalCandidate.city)} className="font-bold underline text-rose-700">Retry</button>
                  </div>
                ) : eligibleStaff.length === 0 ? (
                  <div className="text-xs text-slate-500 bg-slate-50 p-2.5 rounded-xl border border-slate-200">
                    No eligible telecallers available.
                  </div>
                ) : (
                  <select
                    id="attributed-telecaller-select"
                    data-testid="attributed-telecaller-select"
                    value={assignedStaffId}
                    onChange={(e) => {
                      const sId = e.target.value;
                      setAssignedStaffId(sId);
                      const found = eligibleStaff.find((s) => s.id === sId);
                      if (found) setAssignedStaffName(found.name);
                    }}
                    className="w-full text-xs bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-rose-500"
                  >
                    {eligibleStaff.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name} {s.profile_names?.length ? `(${s.profile_names.join(" · ")})` : `(${s.role})`}
                      </option>
                    ))}
                  </select>
                )}
              </div>

              {/* Follow-Up Date (if follow up or interested) */}
              {(callOutcome === "FOLLOW_UP" || callOutcome === "INTERESTED" || callOutcome === "CONNECTED") && (
                <div>
                  <label className="block text-xs font-bold text-slate-800 mb-1.5 uppercase tracking-wider">
                    Scheduled Next Follow-Up Date & Time
                  </label>
                  <input
                    type="date"
                    value={followupDate}
                    onChange={(e) => setFollowupDate(e.target.value)}
                    className="w-full text-xs bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-rose-500"
                  />
                  <div className="flex gap-2 mt-2">
                    <button
                      type="button"
                      onClick={() => {
                        const d = new Date();
                        d.setDate(d.getDate() + 1);
                        setFollowupDate(d.toISOString().slice(0, 10));
                      }}
                      className="text-[11px] bg-slate-100 hover:bg-slate-200 text-slate-700 px-2 py-1 rounded font-medium"
                    >
                      Tomorrow
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        const d = new Date();
                        d.setDate(d.getDate() + 3);
                        setFollowupDate(d.toISOString().slice(0, 10));
                      }}
                      className="text-[11px] bg-slate-100 hover:bg-slate-200 text-slate-700 px-2 py-1 rounded font-medium"
                    >
                      In 3 Days
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        const d = new Date();
                        d.setDate(d.getDate() + 7);
                        setFollowupDate(d.toISOString().slice(0, 10));
                      }}
                      className="text-[11px] bg-slate-100 hover:bg-slate-200 text-slate-700 px-2 py-1 rounded font-medium"
                    >
                      Next Week
                    </button>
                  </div>
                </div>
              )}

              {/* ── REAL CUSTOMER ORDER SELECTION & ATTRIBUTION ──────────── */}
              {(callOutcome === "ORDER_PLACED" || callOutcome === "CONVERTED") && (
                <div className="bg-emerald-50/70 p-4 rounded-xl border border-emerald-200/90 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-emerald-900 text-xs flex items-center gap-1.5">
                      <Sparkles className="w-4 h-4 text-emerald-600" /> Real Customer Order Detection:
                    </span>
                    <button
                      type="button"
                      onClick={() => fetchCustomerOrders(callModalCandidate.customer_uid)}
                      className="text-[11px] font-bold text-emerald-700 hover:text-emerald-900 underline flex items-center gap-1"
                    >
                      <RefreshCw className={`w-3 h-3 ${loadingOrders ? "animate-spin text-emerald-600" : ""}`} />
                      Refresh Orders
                    </button>
                  </div>

                  {loadingOrders ? (
                    <div className="py-4 text-center text-xs text-slate-600 flex items-center justify-center gap-2 bg-white/70 rounded-lg border border-emerald-200">
                      <RefreshCw className="w-4 h-4 animate-spin text-emerald-600" />
                      Scanning order database for {callModalCandidate.customer_name}...
                    </div>
                  ) : orderLoadError ? (
                    <div className="p-3 bg-rose-50 text-rose-700 text-xs rounded-lg border border-rose-200 flex items-center justify-between">
                      <span>{orderLoadError}</span>
                      <button type="button" onClick={() => fetchCustomerOrders(callModalCandidate.customer_uid)} className="font-bold underline">Retry</button>
                    </div>
                  ) : customerOrders.length === 0 ? (
                    <div className="p-4 bg-white/80 rounded-xl border border-amber-200 text-center space-y-1.5">
                      <AlertCircle className="w-5 h-5 text-amber-600 mx-auto" />
                      <p className="text-xs font-bold text-amber-900">
                        No eligible recent orders found for {callModalCandidate.customer_name}.
                      </p>
                      <p className="text-[11px] text-amber-700">
                        If the order was just placed on this call, click "Refresh Orders" to load newly placed orders.
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider">
                        Select Verified Customer Order *
                      </label>
                      <select
                        id="attributed-order-select"
                        data-testid="attributed-order-select"
                        value={selectedOrder?.id || ""}
                        onChange={(e) => {
                          const ord = customerOrders.find((o) => o.id === e.target.value);
                          setSelectedOrder(ord || null);
                        }}
                        className="w-full text-xs bg-white border border-slate-300 rounded-xl px-3 py-2 font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                      >
                        {customerOrders.map((ord) => {
                          const primaryItem = ord.items?.[0]?.name || ord.items?.[0]?.product_name || "Bakery Product";
                          const totalVal = Number(ord.total) || Number(ord.grand_total) || Number(ord.order_value) || 0;
                          const dateStr = new Date(ord.created_at || ord.order_date || Date.now()).toLocaleDateString("en-IN", { day: "numeric", month: "short" });
                          return (
                            <option key={ord.id} value={ord.id}>
                              {ord.order_number || ord.id} • {dateStr} • {primaryItem} • ₹{totalVal.toLocaleString("en-IN")} ({ord.status || "Completed"})
                            </option>
                          );
                        })}
                      </select>

                      {/* Selected Order Summary Card (READ ONLY) */}
                      {selectedOrder && (
                        <div className="bg-white p-3 rounded-xl border border-emerald-200 text-xs space-y-1.5 shadow-xs">
                          <div className="flex items-center justify-between font-bold text-slate-900">
                            <span className="flex items-center gap-1 text-emerald-700">
                              <CheckCircle2 className="w-3.5 h-3.5" /> {selectedOrder.order_number || selectedOrder.id}
                            </span>
                            <span className="text-sm font-black text-emerald-700 font-mono">
                              ₹{(Number(selectedOrder.total) || Number(selectedOrder.grand_total) || 0).toLocaleString("en-IN")}
                            </span>
                          </div>
                          <div className="text-[11px] text-slate-600">
                            Ordered: {new Date(selectedOrder.created_at || selectedOrder.order_date || Date.now()).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })} • {selectedOrder.items?.length || 1} items • Branch: {selectedOrder.branch_name || "Flagship Hub"}
                          </div>
                          <div className="flex items-center gap-2 text-[10px] font-mono">
                            <span className="px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800 uppercase font-bold">
                              {selectedOrder.status || "CONFIRMED"}
                            </span>
                            <span className="px-1.5 py-0.5 rounded bg-blue-100 text-blue-800 uppercase font-bold">
                              {selectedOrder.payment_status || "PAID"}
                            </span>
                            <span className="text-slate-400 font-sans ml-auto">
                              ✓ Authoritative Order Record
                            </span>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* Call Notes */}
              <div>
                <label className="block text-xs font-bold text-slate-800 mb-1.5 uppercase tracking-wider">
                  Call Notes & Conversation Details
                </label>
                <textarea
                  rows={3}
                  placeholder="E.g. Customer confirmed upcoming birthday celebration. Sent catalogue link with Belgian Truffle recommendations..."
                  value={callNote}
                  onChange={(e) => setCallNote(e.target.value)}
                  className="w-full text-xs bg-slate-50 border border-slate-200 rounded-xl p-3 text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-rose-500"
                />
              </div>
            </div>

            <div className="bg-slate-50 p-4 border-t border-slate-200 flex items-center justify-end gap-2.5">
              <Button
                variant="secondary"
                size="small"
                onClick={() => setCallModalCandidate(null)}
              >
                Cancel
              </Button>
              <Button
                size="small"
                onClick={handleSaveCallLog}
                disabled={isSavingCall || ((callOutcome === "ORDER_PLACED" || callOutcome === "CONVERTED") && !selectedOrder)}
                className="bg-rose-600 hover:bg-rose-700 text-white font-bold"
              >
                {isSavingCall ? "Saving Call Log..." : "Save Call & Update Status"}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* ── 2. SCORE EXPLANATION BREAKDOWN MODAL ─────────────────────── */}
      {scoreModalCandidate && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-lg rounded-2xl shadow-2xl border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95">
            <div className="bg-slate-900 p-5 text-white flex items-center justify-between">
              <div>
                <Heading level="h3" className="text-lg font-bold text-white flex items-center gap-2">
                  <Sparkles className="w-5 h-5 text-amber-400" /> Score Breakdown: {scoreModalCandidate.customer_name}
                </Heading>
                <Text className="text-xs text-slate-300 font-mono mt-0.5">
                  Priority Score: <span className="font-bold text-amber-300">{scoreModalCandidate.score} / 100</span> ({scoreModalCandidate.priority})
                </Text>
              </div>
              <button
                onClick={() => setScoreModalCandidate(null)}
                className="p-1 text-slate-400 hover:text-white rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <Text className="text-xs text-slate-600 font-medium">
                Deterministic 5-signal scoring matrix calculated from completed order history, occasion recurrence, and customer lifetime value:
              </Text>

              <div className="space-y-3">
                {/* 1. Timing Match */}
                <div className="bg-slate-50 p-3 rounded-xl border border-slate-200">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-bold text-slate-900">1. Celebration Timing Match</span>
                    <span className="text-xs font-black text-rose-600 font-mono">
                      {scoreModalCandidate.score_breakdown?.timing_score ?? 25} / 30 pts
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-600">
                    {scoreModalCandidate.score_breakdown?.signals?.timing_reason || "Target celebration anniversary recurrence window."}
                  </p>
                </div>

                {/* 2. Occasion Confidence */}
                <div className="bg-slate-50 p-3 rounded-xl border border-slate-200">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-bold text-slate-900">2. Occasion Confidence</span>
                    <span className="text-xs font-black text-rose-600 font-mono">
                      {scoreModalCandidate.score_breakdown?.occasion_score ?? 25} / 25 pts
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-600">
                    {scoreModalCandidate.score_breakdown?.signals?.occasion_reason || "Explicit annual celebration match."}
                  </p>
                </div>

                {/* 3. Purchase Frequency */}
                <div className="bg-slate-50 p-3 rounded-xl border border-slate-200">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-bold text-slate-900">3. Purchase Frequency</span>
                    <span className="text-xs font-black text-rose-600 font-mono">
                      {scoreModalCandidate.score_breakdown?.purchase_frequency_score ?? 18} / 20 pts
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-600">
                    {scoreModalCandidate.score_breakdown?.signals?.frequency_reason || "Repeat order track record."}
                  </p>
                </div>

                {/* 4. Customer Value */}
                <div className="bg-slate-50 p-3 rounded-xl border border-slate-200">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-bold text-slate-900">4. Customer Lifetime Value</span>
                    <span className="text-xs font-black text-rose-600 font-mono">
                      {scoreModalCandidate.score_breakdown?.customer_value_score ?? 12} / 15 pts
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-600">
                    {scoreModalCandidate.score_breakdown?.signals?.value_reason || "Tier classification from historical spend."}
                  </p>
                </div>

                {/* 5. Engagement */}
                <div className="bg-slate-50 p-3 rounded-xl border border-slate-200">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-bold text-slate-900">5. Engagement & Contactability</span>
                    <span className="text-xs font-black text-rose-600 font-mono">
                      {scoreModalCandidate.score_breakdown?.engagement_score ?? 10} / 10 pts
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-600">
                    {scoreModalCandidate.score_breakdown?.signals?.engagement_reason || "Valid communication channel consent."}
                  </p>
                </div>
              </div>

              {/* Total Score Summary */}
              <div className="bg-gradient-to-r from-slate-900 to-rose-950 p-4 rounded-xl text-white flex items-center justify-between">
                <div>
                  <span className="text-xs text-slate-300 font-semibold block">Total Deterministic Score</span>
                  <span className="text-2xl font-black text-white">{scoreModalCandidate.score} / 100</span>
                </div>
                <div className="text-right">
                  <span className="text-xs text-rose-300 font-semibold block">Priority Tier</span>
                  <span className="text-lg font-black text-rose-200 uppercase">{scoreModalCandidate.priority}</span>
                </div>
              </div>
            </div>

            <div className="bg-slate-50 p-4 border-t border-slate-200 flex justify-end">
              <Button size="small" onClick={() => setScoreModalCandidate(null)}>
                Close Breakdown
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* ── 3. REASSIGN STAFF MODAL ─────────────────────────────────── */}
      {assignModalCandidate && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl border border-slate-200 p-6 space-y-4">
            <div className="flex items-center justify-between">
              <Heading level="h3" className="text-base font-bold text-slate-900">
                Assign Authorized Telecaller
              </Heading>
              <button onClick={() => setAssignModalCandidate(null)} className="p-1 text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>
            <Text className="text-xs text-slate-500">
              Select an authorized telecaller from the staff access-profile database for {assignModalCandidate.customer_name}:
            </Text>

            {loadingStaff ? (
              <div className="py-6 text-center text-xs text-slate-500">
                <RefreshCw className="w-5 h-5 animate-spin mx-auto text-rose-600 mb-2" />
                Loading authorized telecallers...
              </div>
            ) : staffLoadError ? (
              <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700 flex justify-between items-center">
                <span>{staffLoadError}</span>
                <button onClick={() => fetchEligibleStaff(assignModalCandidate.city)} className="font-bold underline">Retry</button>
              </div>
            ) : eligibleStaff.length === 0 ? (
              <div className="py-6 text-center text-xs text-slate-500 bg-slate-50 rounded-xl border border-slate-200">
                No eligible telecallers available.
              </div>
            ) : (
              <div className="space-y-2 max-h-60 overflow-y-auto">
                {eligibleStaff.map((s) => (
                  <button
                    key={s.id}
                    onClick={() => handleAssignStaff(assignModalCandidate, s)}
                    className="w-full p-3 rounded-xl border border-slate-200 hover:border-rose-500 hover:bg-rose-50/40 text-left transition flex items-center justify-between group"
                  >
                    <div>
                      <span className="font-bold text-slate-900 text-sm block group-hover:text-rose-600">{s.name}</span>
                      <span className="text-xs text-slate-500 font-medium">
                        {s.profile_names?.length ? s.profile_names.join(" · ") : s.role}
                      </span>
                    </div>
                    <UserPlus className="w-4 h-4 text-slate-400 group-hover:text-rose-500" />
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── 4. OPPORTUNITY DETAILS DRAWER ────────────────────────────── */}
      {selectedCandidate && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex justify-end">
          <div className="bg-white w-full max-w-xl h-full shadow-2xl overflow-y-auto border-l border-slate-200 flex flex-col">
            <div className="bg-slate-900 p-5 text-white flex items-center justify-between sticky top-0 z-10">
              <div>
                <Heading level="h3" className="text-lg font-bold text-white flex items-center gap-2">
                  <Award className="w-5 h-5 text-rose-400" /> Opportunity Details
                </Heading>
                <Text className="text-xs text-slate-300 font-mono mt-0.5">
                  {selectedCandidate.customer_name} ({selectedCandidate.customer_uid})
                </Text>
              </div>
              <button
                onClick={() => setSelectedCandidate(null)}
                className="p-1 text-slate-400 hover:text-white rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-6 flex-1">
              {/* Score & Priority */}
              <div className="flex items-center justify-between bg-slate-50 p-4 rounded-xl border border-slate-200">
                <div>
                  <span className="text-xs text-slate-500 font-bold block uppercase tracking-wider">Opportunity Type</span>
                  <span className="text-sm font-black text-slate-900">{getOpportunityTypeLabel(selectedCandidate.opportunity_type)}</span>
                </div>
                <div>{getPriorityBadge(selectedCandidate.priority, selectedCandidate.score)}</div>
              </div>

              {/* Recommended Pitch */}
              <div className="bg-rose-50 p-4 rounded-xl border border-rose-200 space-y-2">
                <span className="text-xs font-bold text-rose-900 uppercase tracking-wider block">💬 Recommended Safe Pitch</span>
                <p className="text-xs text-slate-800 italic leading-relaxed">"{selectedCandidate.pitch}"</p>
              </div>

              {/* Previous Order Context */}
              <div className="space-y-3">
                <span className="text-xs font-bold text-slate-900 uppercase tracking-wider block">Prior Celebration Order Context</span>
                <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-2 text-xs">
                  <div className="flex justify-between">
                    <span className="text-slate-500">Previous Product:</span>
                    <span className="font-bold text-slate-900">{selectedCandidate.reference_product_name}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Occasion:</span>
                    <span className="font-bold text-slate-900">{selectedCandidate.reference_occasion}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Order Date:</span>
                    <span className="font-bold text-slate-900">{new Date(selectedCandidate.reference_order_date).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Order Total:</span>
                    <span className="font-bold text-slate-900">₹{selectedCandidate.reference_order_value.toLocaleString("en-IN")}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Fulfillment Branch:</span>
                    <span className="font-bold text-slate-900">{selectedCandidate.preferred_branch_name}</span>
                  </div>
                </div>
              </div>

              {/* Call Notes History */}
              <div className="space-y-3">
                <span className="text-xs font-bold text-slate-900 uppercase tracking-wider block">Contact & Outreach Log ({selectedCandidate.call_notes.length})</span>
                {selectedCandidate.call_notes.length === 0 ? (
                  <p className="text-xs text-slate-500 italic bg-slate-50 p-3 rounded-lg">No calls logged yet.</p>
                ) : (
                  <div className="space-y-2">
                    {selectedCandidate.call_notes.map((n) => (
                      <div key={n.id} className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-1 text-xs">
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-slate-900">{n.agent_name}</span>
                          <span className="text-[10px] text-slate-400 font-mono">{new Date(n.created_at).toLocaleString("en-IN")}</span>
                        </div>
                        <p className="text-slate-700">{n.note}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Sticky Actions Footer */}
            <div className="bg-slate-50 p-4 border-t border-slate-200 flex items-center justify-between sticky bottom-0">
              <Button
                variant="secondary"
                size="small"
                onClick={() => setCustomerDrawerUid(selectedCandidate.customer_uid)}
                className="text-xs font-bold"
              >
                <Eye className="w-3.5 h-3.5 mr-1.5" /> View Customer 360
              </Button>

              <div className="flex gap-2">
                <Button
                  size="small"
                  onClick={() => {
                    const c = selectedCandidate;
                    setSelectedCandidate(null);
                    openCallModal(c);
                  }}
                  className="bg-rose-600 hover:bg-rose-700 text-white font-bold"
                >
                  <Phone className="w-3.5 h-3.5 mr-1.5" /> Log Call
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── 5. CANONICAL CUSTOMER 360 PROFILE DRAWER ─────────────────── */}
      <CustomerProfileDrawer
        customerUid={customerDrawerUid}
        isOpen={Boolean(customerDrawerUid)}
        onClose={() => setCustomerDrawerUid(null)}
      />

      {/* ── 6. WHATSAPP CONTACT MODAL ────────────────────────────────── */}
      <WhatsAppContactModal
        customer={whatsAppCustomer}
        isOpen={Boolean(whatsAppCustomer)}
        onClose={() => setWhatsAppCustomer(null)}
      />
    </div>
  );
});
