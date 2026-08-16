"use client";

import { useEffect, useState, memo } from "react";
import { Container, Heading, Text, Button, Input, Badge, StatusBadge } from "@medusajs/ui";
import {
  PhoneCall, Users, Calendar, Award, DollarSign, Download, Search,
  RefreshCw, CheckCircle2, UserCheck, Clock, FileSpreadsheet, Sparkles,
  ChevronRight, X, AlertCircle, ShoppingBag, Send
} from "lucide-react";
import { apiClient } from "@frontend/lib/api-client";
import { ReorderCandidate, TelemarketingMetrics, TelemarketingContactStatus } from "@frontend/lib/telemarketing-engine";
import { TelemarketingExportService } from "@frontend/lib/telemarketing-export-service";

export const TelemarketingPanel = memo(function TelemarketingPanel() {
  const [candidates, setCandidates] = useState<ReorderCandidate[]>([]);
  const [metrics, setMetrics] = useState<TelemarketingMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [isExporting, setIsExporting] = useState(false);
  const [isEvaluating, setIsEvaluating] = useState(false);
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; message: string } | null>(null);

  // Filters
  const [priorityFilter, setPriorityFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [cityFilter, setCityFilter] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");

  // Modal State for Call Logging
  const [activeCandidate, setActiveCandidate] = useState<ReorderCandidate | null>(null);
  const [callStatus, setCallStatus] = useState<TelemarketingContactStatus>("CONTACTED");
  const [callNote, setCallNote] = useState("");
  const [followupDate, setFollowupDate] = useState("");
  const [assignedAgent, setAssignedAgent] = useState("Rahul K.");
  const [orderId, setOrderId] = useState("");
  const [orderRevenue, setOrderRevenue] = useState("");
  const [isSavingCall, setIsSavingCall] = useState(false);

  const fetchCandidates = async () => {
    setLoading(true);
    try {
      const res: any = await apiClient.getAdminTelemarketingCandidates({
        priority: priorityFilter,
        status: statusFilter,
        city: cityFilter,
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
    fetchCandidates();
  }, [priorityFilter, statusFilter, cityFilter]);

  const handleEvaluate = async () => {
    setIsEvaluating(true);
    setFeedback(null);
    try {
      const res: any = await apiClient.evaluateAdminTelemarketingCandidates("2026-08-16");
      setFeedback({
        type: "success",
        message: `Evaluation completed! Scanned ${res?.evaluated || 0} historical orders, identified ${res?.new_candidates || 0} anniversary reorder candidates.`,
      });
      setTimeout(() => setFeedback(null), 5000);
      fetchCandidates();
    } catch (err: any) {
      setFeedback({ type: "error", message: err?.message || "Failed to evaluate historical orders" });
    } finally {
      setIsEvaluating(false);
    }
  };

  const handleExportTelecallerList = async (mode: "current" | "high_priority" | "calls_due" | "follow_ups" | "master" = "current") => {
    setIsExporting(true);
    try {
      if (mode === "master") {
        const allRes: any = await apiClient.getAdminTelemarketingCandidates({ limit: 1000 });
        const exportList = allRes?.candidates || candidates;
        const exportMetrics = allRes?.metrics || metrics;
        await TelemarketingExportService.exportTelemarketingWorkbook(exportList, exportMetrics);
        setFeedback({ type: "success", message: "Complete 6-sheet master telemarketing workbook exported!" });
      } else {
        let exportCandidates = [...candidates];
        let filterType: any = "custom";
        if (mode === "high_priority") filterType = "high_priority";
        else if (mode === "calls_due") filterType = "calls_due_today";
        else if (mode === "follow_ups") filterType = "follow_ups_due";

        await TelemarketingExportService.exportTelecallerCallingList(exportCandidates, {
          filterType,
          priorityFilter: mode === "current" ? priorityFilter : undefined,
          cityFilter: mode === "current" ? cityFilter : undefined,
          statusFilter: mode === "current" ? statusFilter : undefined,
        });
        setFeedback({ type: "success", message: `Telecaller Calling List (${mode.replace("_", " ")}) exported successfully!` });
      }
      setTimeout(() => setFeedback(null), 4000);
    } catch (err: any) {
      alert("Failed to export Excel calling list: " + err?.message);
    } finally {
      setIsExporting(false);
    }
  };

  const openCallModal = (cand: ReorderCandidate) => {
    setActiveCandidate(cand);
    setCallStatus(cand.contact_status === "NEW" ? "CONTACTED" : cand.contact_status);
    setFollowupDate(cand.next_followup_date || "");
    setAssignedAgent(cand.assigned_to || "Rahul K.");
    setCallNote("");
    setOrderId(cand.attributed_order_id || "");
    setOrderRevenue(cand.attributed_revenue ? String(cand.attributed_revenue) : "");
  };

  const handleSaveCallLog = async () => {
    if (!activeCandidate) return;
    setIsSavingCall(true);
    try {
      // 1. If assigned agent changed
      if (assignedAgent !== activeCandidate.assigned_to) {
        await apiClient.assignAdminTelemarketingCandidate(activeCandidate.id, assignedAgent);
      }

      // 2. Update status and note
      await apiClient.updateAdminTelemarketingStatus(activeCandidate.id, {
        status: callStatus,
        note: callNote,
        agentName: assignedAgent,
        nextFollowupDate: followupDate || undefined,
      });

      // 3. If order converted
      if (callStatus === "ORDER_PLACED" && orderRevenue) {
        await apiClient.recordAdminTelemarketingOrder(
          activeCandidate.id,
          orderId || `CTH-ORD-${Math.floor(1000 + Math.random() * 9000)}`,
          Number(orderRevenue)
        );
      }

      setFeedback({ type: "success", message: `Call logged for ${activeCandidate.customer_name}!` });
      setTimeout(() => setFeedback(null), 4000);
      setActiveCandidate(null);
      fetchCandidates();
    } catch (err: any) {
      alert("Failed to save call log: " + err?.message);
    } finally {
      setIsSavingCall(false);
    }
  };

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-xs">
        <div>
          <div className="flex items-center gap-2">
            <PhoneCall className="w-5 h-5 text-amber-600" />
            <Heading level="h2" className="text-xl font-bold">
              Telemarketing Reorder & Reactivation Intelligence
            </Heading>
          </div>
          <Text className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Proactive anniversary & birthday outreach calling list derived from completed customer orders with explainable scoring (0-100).
          </Text>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Button
            variant="secondary"
            size="small"
            onClick={handleEvaluate}
            isLoading={isEvaluating}
            className="flex items-center gap-1.5 text-xs"
          >
            <Sparkles className="w-3.5 h-3.5 text-amber-600" /> Evaluate Prior Orders
          </Button>
          <Button
            size="small"
            onClick={() => handleExportTelecallerList("current")}
            isLoading={isExporting}
            className="bg-emerald-600 hover:bg-emerald-700 text-white flex items-center gap-1.5 text-xs shadow-sm font-medium"
          >
            <FileSpreadsheet className="w-3.5 h-3.5" /> Export Telecaller List
          </Button>
          <Button
            variant="secondary"
            size="small"
            onClick={() => handleExportTelecallerList("high_priority")}
            isLoading={isExporting}
            className="text-red-700 border-red-200 hover:bg-red-50 flex items-center gap-1 text-xs"
          >
            <Award className="w-3.5 h-3.5 text-red-600" /> High Priority Only
          </Button>
          <Button
            variant="secondary"
            size="small"
            onClick={() => handleExportTelecallerList("master")}
            isLoading={isExporting}
            className="flex items-center gap-1 text-xs"
          >
            <Download className="w-3.5 h-3.5 text-slate-600" /> Master (6 Sheets)
          </Button>
        </div>
      </div>

      {feedback && (
        <div
          className={`p-4 rounded-xl text-sm flex items-center gap-2 border ${
            feedback.type === "success"
              ? "bg-emerald-50 dark:bg-emerald-950/60 border-emerald-300 dark:border-emerald-800 text-emerald-800 dark:text-emerald-200"
              : "bg-red-50 dark:bg-red-950/60 border-red-300 dark:border-red-800 text-red-800 dark:text-red-200"
          }`}
        >
          {feedback.type === "success" ? (
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          ) : (
            <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
          )}
          <span>{feedback.message}</span>
        </div>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
        <Container className="p-4 flex flex-col gap-1">
          <Text className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Total Candidates</Text>
          <Text className="text-xl font-bold">{metrics?.total_candidates ?? candidates.length}</Text>
          <Text className="text-[10px] text-slate-400">Opportunity pool</Text>
        </Container>
        <Container className="p-4 flex flex-col gap-1">
          <Text className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">High Priority</Text>
          <Text className="text-xl font-bold text-red-600">{metrics?.high_priority ?? 0}</Text>
          <Text className="text-[10px] text-slate-400">Score &ge; 80</Text>
        </Container>
        <Container className="p-4 flex flex-col gap-1">
          <Text className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Calls Due Today</Text>
          <Text className="text-xl font-bold text-amber-600">{metrics?.calls_due_today ?? 0}</Text>
          <Text className="text-[10px] text-slate-400">Anniversary date</Text>
        </Container>
        <Container className="p-4 flex flex-col gap-1">
          <Text className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Follow-Ups Due</Text>
          <Text className="text-xl font-bold text-blue-600">{metrics?.follow_ups_due ?? 0}</Text>
          <Text className="text-[10px] text-slate-400">Scheduled action</Text>
        </Container>
        <Container className="p-4 flex flex-col gap-1">
          <Text className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Orders Converted</Text>
          <Text className="text-xl font-bold text-emerald-600">{metrics?.orders_generated ?? 0}</Text>
          <Text className="text-[10px] text-emerald-600 font-medium">{metrics?.conversion_rate_pct ?? 0}% conversion</Text>
        </Container>
        <Container className="p-4 flex flex-col gap-1">
          <Text className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Attributed Revenue</Text>
          <Text className="text-xl font-bold text-purple-600">₹{(metrics?.revenue_generated ?? 0).toLocaleString("en-IN")}</Text>
          <Text className="text-[10px] text-slate-400">From outreach</Text>
        </Container>
      </div>

      {/* Filter Toolbar */}
      <Container className="p-4 flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div className="flex items-center gap-2 flex-1 max-w-md">
          <div className="relative w-full">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search customer, phone, cake flavor..."
              className="w-full pl-9 pr-3 py-1.5 text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg"
            />
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <select
            value={priorityFilter}
            onChange={(e) => setPriorityFilter(e.target.value)}
            className="text-xs px-2.5 py-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg"
          >
            <option value="all">All Priorities</option>
            <option value="HIGH">High Priority (Score &ge; 80)</option>
            <option value="MEDIUM">Medium Priority (60-79)</option>
            <option value="LOW">Low Priority (&lt; 60)</option>
          </select>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="text-xs px-2.5 py-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg"
          >
            <option value="all">All Contact Statuses</option>
            <option value="NEW">New (Uncontacted)</option>
            <option value="CONTACTED">Contacted</option>
            <option value="NO_ANSWER">No Answer</option>
            <option value="FOLLOW_UP">Follow-Up Scheduled</option>
            <option value="INTERESTED">Interested</option>
            <option value="ORDER_PLACED">Order Converted</option>
            <option value="NOT_INTERESTED">Not Interested</option>
          </select>

          <select
            value={cityFilter}
            onChange={(e) => setCityFilter(e.target.value)}
            className="text-xs px-2.5 py-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg"
          >
            <option value="all">All Cities</option>
            <option value="Bengaluru">Bengaluru</option>
            <option value="Mumbai">Mumbai</option>
            <option value="Delhi NCR">Delhi NCR</option>
            <option value="Hyderabad">Hyderabad</option>
          </select>

          <Button
            variant="secondary"
            size="small"
            onClick={fetchCandidates}
            isLoading={loading}
            className="text-xs"
          >
            <RefreshCw className="w-3.5 h-3.5" />
          </Button>
        </div>
      </Container>

      {/* Calling List Table */}
      <Container className="p-0 overflow-hidden">
        <div className="p-4 bg-slate-50 dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
          <Text className="font-semibold text-sm">Actionable Outreach Calling Queue</Text>
          <Badge color="purple" size="small">{candidates.length} Qualified Opportunities</Badge>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-slate-50/50 dark:bg-slate-900/50 text-slate-500 text-xs">
                <th className="text-left p-3 font-semibold">Priority &amp; Score</th>
                <th className="text-left p-3 font-semibold">Customer &amp; Location</th>
                <th className="text-left p-3 font-semibold">Previous Purchase (~1 Yr Ago)</th>
                <th className="text-left p-3 font-semibold">Reason &amp; Pitch</th>
                <th className="text-left p-3 font-semibold">Expected Date</th>
                <th className="text-left p-3 font-semibold">Contact Status</th>
                <th className="text-left p-3 font-semibold">Assigned Agent</th>
                <th className="text-right p-3 font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody>
              {candidates.length === 0 ? (
                <tr>
                  <td colSpan={8} className="text-center py-10 text-slate-400 text-xs">
                    No candidates found matching the active filters.
                  </td>
                </tr>
              ) : (
                candidates.map((cand) => (
                  <tr key={cand.id} className="border-b hover:bg-slate-50/80 dark:hover:bg-slate-900/80 transition-colors">
                    <td className="p-3">
                      <div className="flex items-center gap-1.5">
                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                            cand.priority === "HIGH"
                              ? "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300 border border-red-200"
                              : cand.priority === "MEDIUM"
                              ? "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300 border border-amber-200"
                              : "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300"
                          }`}
                        >
                          {cand.priority} ({cand.score})
                        </span>
                      </div>
                    </td>
                    <td className="p-3">
                      <div className="flex flex-col">
                        <span className="font-bold text-xs text-slate-800 dark:text-slate-100">{cand.customer_name}</span>
                        <span className="text-xs font-mono text-slate-600 dark:text-slate-400">{cand.customer_phone}</span>
                        <span className="text-[10px] text-slate-400">{cand.city} &bull; {cand.area || "Hub"}</span>
                      </div>
                    </td>
                    <td className="p-3">
                      <div className="flex flex-col max-w-[200px]">
                        <span className="font-semibold text-xs text-purple-700 dark:text-purple-300 truncate">
                          {cand.reference_product_name}
                        </span>
                        <span className="text-[11px] text-slate-500">
                          {cand.reference_occasion} &bull; ₹{cand.reference_order_value}
                        </span>
                        <span className="text-[10px] text-slate-400">
                          Ordered: {new Date(cand.reference_order_date).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
                        </span>
                      </div>
                    </td>
                    <td className="p-3">
                      <p className="text-xs text-slate-600 dark:text-slate-300 max-w-[260px] line-clamp-2 leading-relaxed">
                        {cand.reason}
                      </p>
                    </td>
                    <td className="p-3">
                      <div className="flex flex-col">
                        <span className="font-semibold text-xs text-slate-700 dark:text-slate-200">
                          {cand.suggested_followup_date}
                        </span>
                        {cand.next_followup_date && (
                          <span className="text-[10px] text-blue-600 font-medium">
                            Follow-Up: {cand.next_followup_date}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="p-3">
                      <StatusBadge
                        color={
                          cand.contact_status === "ORDER_PLACED"
                            ? "green"
                            : cand.contact_status === "FOLLOW_UP"
                            ? "blue"
                            : cand.contact_status === "INTERESTED"
                            ? "purple"
                            : cand.contact_status === "NOT_INTERESTED"
                            ? "red"
                            : "grey"
                        }
                        className="text-[10px]"
                      >
                        {cand.contact_status.replace("_", " ")}
                      </StatusBadge>
                    </td>
                    <td className="p-3 text-xs text-slate-600 dark:text-slate-300">
                      {cand.assigned_to || <span className="text-slate-400 italic">Unassigned</span>}
                    </td>
                    <td className="p-3 text-right">
                      <Button
                        size="small"
                        variant="secondary"
                        onClick={() => openCallModal(cand)}
                        className="text-xs flex items-center gap-1 ml-auto"
                      >
                        <PhoneCall className="w-3 h-3 text-amber-600" /> Log Call
                      </Button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Container>

      {/* Call Logging Modal */}
      {activeCandidate && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-lg w-full p-6 flex flex-col gap-4 shadow-xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <div>
                <Heading level="h3" className="text-base font-bold">
                  Log Telemarketing Outreach
                </Heading>
                <Text className="text-xs text-slate-500">
                  {activeCandidate.customer_name} ({activeCandidate.customer_phone})
                </Text>
              </div>
              <button
                onClick={() => setActiveCandidate(null)}
                className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Candidate Context Box */}
            <div className="p-3 bg-purple-50/70 dark:bg-purple-950/40 border border-purple-200 dark:border-purple-800 rounded-xl flex flex-col gap-1 text-xs">
              <span className="font-bold text-purple-900 dark:text-purple-200">
                Recommended Cake: {activeCandidate.recommended_product_name}
              </span>
              <span className="text-slate-600 dark:text-slate-300">
                Occasion: {activeCandidate.reference_occasion} (Prior spend: ₹{activeCandidate.reference_order_value})
              </span>
              <span className="text-slate-500 italic mt-0.5">{activeCandidate.reason}</span>
            </div>

            {/* Status & Agent Selection */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-semibold text-slate-600 dark:text-slate-300">Call Outcome Status</label>
                <select
                  value={callStatus}
                  onChange={(e) => setCallStatus(e.target.value as TelemarketingContactStatus)}
                  className="w-full mt-1 px-3 py-2 text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg"
                >
                  <option value="CONTACTED">Contacted (Spoke with customer)</option>
                  <option value="NO_ANSWER">No Answer / Line Busy</option>
                  <option value="FOLLOW_UP">Follow-Up Scheduled</option>
                  <option value="INTERESTED">Interested in Catalog</option>
                  <option value="ORDER_PLACED">Order Placed (Converted!)</option>
                  <option value="NOT_INTERESTED">Not Interested</option>
                  <option value="DO_NOT_CONTACT">Do Not Contact (DNC)</option>
                </select>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-600 dark:text-slate-300">Assigned Telemarketer</label>
                <select
                  value={assignedAgent}
                  onChange={(e) => setAssignedAgent(e.target.value)}
                  className="w-full mt-1 px-3 py-2 text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg"
                >
                  <option value="Rahul K.">Rahul K. (Senior Outreach)</option>
                  <option value="Sneha M.">Sneha M. (VIP Accounts)</option>
                  <option value="Priya S.">Priya S. (Customer Delight)</option>
                </select>
              </div>
            </div>

            {/* Follow-up Date if needed */}
            {callStatus === "FOLLOW_UP" && (
              <div>
                <label className="text-xs font-semibold text-slate-600 dark:text-slate-300">Next Follow-Up Date</label>
                <Input
                  type="date"
                  value={followupDate}
                  onChange={(e) => setFollowupDate(e.target.value)}
                  className="mt-1 text-xs"
                />
              </div>
            )}

            {/* Conversion attribution inputs if ORDER_PLACED */}
            {callStatus === "ORDER_PLACED" && (
              <div className="p-3 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 rounded-xl grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-emerald-800 dark:text-emerald-200">Converted Order ID</label>
                  <Input
                    value={orderId}
                    onChange={(e) => setOrderId(e.target.value)}
                    placeholder="e.g. CTH-ORD-9921"
                    className="mt-1 text-xs font-mono"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-emerald-800 dark:text-emerald-200">Attributed Revenue (₹)</label>
                  <Input
                    type="number"
                    value={orderRevenue}
                    onChange={(e) => setOrderRevenue(e.target.value)}
                    placeholder="1299"
                    className="mt-1 text-xs font-bold"
                  />
                </div>
              </div>
            )}

            {/* Call Notes */}
            <div>
              <label className="text-xs font-semibold text-slate-600 dark:text-slate-300">Call Notes &amp; Customer Feedback</label>
              <textarea
                value={callNote}
                onChange={(e) => setCallNote(e.target.value)}
                placeholder="e.g. Customer was happy to receive the anniversary reminder, confirmed party for Saturday..."
                rows={3}
                className="w-full mt-1 p-2.5 text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg resize-none"
              />
            </div>

            {/* Previous Call Notes History */}
            {activeCandidate.call_notes && activeCandidate.call_notes.length > 0 && (
              <div className="flex flex-col gap-1.5 border-t border-slate-100 dark:border-slate-800 pt-3">
                <Text className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Previous Call History</Text>
                <div className="max-h-28 overflow-y-auto flex flex-col gap-1.5 pr-1">
                  {activeCandidate.call_notes.map((n) => (
                    <div key={n.id} className="p-2 bg-slate-50 dark:bg-slate-800/60 rounded-lg text-xs flex flex-col gap-0.5">
                      <div className="flex items-center justify-between text-[10px] text-slate-400">
                        <span className="font-semibold text-slate-600 dark:text-slate-300">{n.agent_name} ({n.status})</span>
                        <span>{new Date(n.created_at).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}</span>
                      </div>
                      <p className="text-slate-600 dark:text-slate-300">{n.note}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="flex items-center justify-end gap-2 pt-2">
              <Button variant="secondary" onClick={() => setActiveCandidate(null)}>
                Cancel
              </Button>
              <Button
                onClick={handleSaveCallLog}
                isLoading={isSavingCall}
                className="bg-amber-600 hover:bg-amber-700 text-white text-xs"
              >
                Save Call Outcome
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
});
