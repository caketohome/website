"use client";

import { useEffect, useState, memo } from "react";
import { Container, Heading, Text, Badge, Button, Input } from "@medusajs/ui";
import {
  Calendar,
  Clock,
  Building2,
  Store,
  Plus,
  Trash2,
  RefreshCw,
  AlertTriangle,
  CheckCircle2,
  AlertCircle,
  Eye,
  ShieldAlert,
} from "lucide-react";

interface Closure {
  id: string;
  entity_type: "BRANCH" | "PARTNER" | "GLOBAL";
  entity_id: string;
  start_date: string;
  end_date: string;
  is_full_day: boolean;
  opening_time?: string;
  closing_time?: string;
  closure_type: string;
  reason?: string;
  status: "SCHEDULED" | "ACTIVE" | "CANCELLED" | "COMPLETED";
  actor_id: string;
  actor_role: string;
  created_at: string;
}

interface ImpactedOrder {
  id: string;
  closure_id: string;
  order_id: string;
  fulfillment_date: string;
  order_status: string;
  total_amount: number;
  resolution_status: string;
  resolution_notes?: string;
  created_at: string;
}

export const OperationalClosuresPanel = memo(function OperationalClosuresPanel() {
  const [closures, setClosures] = useState<Closure[]>([]);
  const [impactedOrders, setImpactedOrders] = useState<ImpactedOrder[]>([]);
  const [branches, setBranches] = useState<any[]>([]);
  const [partners, setPartners] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // New Closure Modal State
  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const [entityType, setEntityType] = useState<"BRANCH" | "PARTNER">("BRANCH");
  const [entityId, setEntityId] = useState("");
  const [startDate, setStartDate] = useState(new Date().toISOString().split("T")[0]);
  const [endDate, setEndDate] = useState(new Date().toISOString().split("T")[0]);
  const [isFullDay, setIsFullDay] = useState(true);
  const [closureType, setClosureType] = useState("HOLIDAY");
  const [reason, setReason] = useState("");
  const [submittingSchedule, setSubmittingSchedule] = useState(false);

  const fetchClosures = async () => {
    try {
      setLoading(true);
      setErrorMsg(null);
      const res = await fetch("/api/v1/admin/closures");
      const data = await res.json();
      if (data.closures) {
        setClosures(data.closures);
      }
    } catch (err: any) {
      setErrorMsg("Failed to load closures: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  const fetchImpactedOrders = async () => {
    try {
      const res = await fetch("/api/v1/admin/closures/impacted-orders");
      const data = await res.json();
      if (data.impactedOrders) {
        setImpactedOrders(data.impactedOrders);
      }
    } catch (err: any) {
      console.error("Failed to load impacted orders", err);
    }
  };

  const fetchEntities = async () => {
    try {
      const [bRes, pRes] = await Promise.all([
        fetch("/api/v1/branches").then((r) => r.json()).catch(() => ({ branches: [] })),
        fetch("/api/v1/admin/marketplace/partners").then((r) => r.json()).catch(() => ({ partners: [] })),
      ]);
      if (bRes.branches) setBranches(bRes.branches);
      if (pRes.partners) setPartners(pRes.partners);
      if (bRes.branches?.length > 0 && !entityId) {
        setEntityId(bRes.branches[0].id);
      }
    } catch (err) {
      console.error("Failed to load branches/partners", err);
    }
  };

  useEffect(() => {
    fetchClosures();
    fetchImpactedOrders();
    fetchEntities();
  }, []);

  const handleScheduleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!entityId) {
      setErrorMsg("Please select an entity (branch or partner).");
      return;
    }
    try {
      setSubmittingSchedule(true);
      setErrorMsg(null);
      const res = await fetch("/api/v1/admin/closures", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          entityType,
          entityId,
          startDate,
          endDate,
          isFullDay,
          closureType,
          reason,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Failed to schedule closure");
      }
      setSuccessMsg(
        `Scheduled ${closureType} for ${entityType} (${startDate} to ${endDate}). Impacted orders: ${data.impactedCount}`
      );
      setShowScheduleModal(false);
      setReason("");
      fetchClosures();
      fetchImpactedOrders();
    } catch (err: any) {
      setErrorMsg(err.message);
    } finally {
      setSubmittingSchedule(false);
    }
  };

  const handleCancelClosure = async (closureId: string) => {
    if (!confirm("Are you sure you want to cancel this scheduled closure?")) return;
    try {
      setLoading(true);
      setErrorMsg(null);
      const res = await fetch(`/api/v1/admin/closures?id=${encodeURIComponent(closureId)}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Failed to cancel closure");
      }
      setSuccessMsg("Closure successfully cancelled and fulfillment re-enabled.");
      fetchClosures();
      fetchImpactedOrders();
    } catch (err: any) {
      setErrorMsg(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 p-6 rounded-2xl bg-gradient-to-r from-slate-900 via-amber-950 to-slate-900 border border-amber-900/40 text-white shadow-xl">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="p-2 rounded-xl bg-amber-500/20 text-amber-400 border border-amber-500/30">
              <Calendar className="w-5 h-5" />
            </span>
            <Heading level="h2" className="text-xl font-bold tracking-tight text-white">
              Branch & Partner Holiday / Closure Scheduling
            </Heading>
            <Badge color="orange" className="text-xs font-semibold px-2.5 py-0.5">
              Asia/Kolkata (IST) Authoritative
            </Badge>
          </div>
          <Text className="text-sm text-slate-300 max-w-3xl">
            Authoritative scheduling of holidays, maintenance days, and planned non-operating closures for branches and marketplace partners. Prevents new orders during closed dates while surfacing existing accepted orders to operations staff for graceful reassignment.
          </Text>
        </div>

        <div className="flex items-center gap-3">
          <Button
            variant="secondary"
            size="small"
            onClick={() => {
              fetchClosures();
              fetchImpactedOrders();
            }}
            disabled={loading}
            className="flex items-center gap-2 bg-slate-800/80 hover:bg-slate-700 text-slate-200 border border-slate-700"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
          <Button
            variant="primary"
            size="small"
            onClick={() => setShowScheduleModal(true)}
            className="flex items-center gap-2 bg-amber-600 hover:bg-amber-500 text-white border-0 shadow-md shadow-amber-600/30"
          >
            <Plus className="w-4 h-4" />
            Schedule Closure
          </Button>
        </div>
      </div>

      {/* Alerts */}
      {errorMsg && (
        <div className="flex items-center gap-3 p-4 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-400">
          <AlertTriangle className="w-5 h-5 shrink-0" />
          <Text className="text-sm font-medium">{errorMsg}</Text>
        </div>
      )}
      {successMsg && (
        <div className="flex items-center gap-3 p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400">
          <CheckCircle2 className="w-5 h-5 shrink-0" />
          <Text className="text-sm font-medium">{successMsg}</Text>
        </div>
      )}

      {/* Impacted Orders Alert Banner if any */}
      {impactedOrders.length > 0 && (
        <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-300 space-y-2">
          <div className="flex items-center gap-2 font-bold text-sm">
            <AlertCircle className="w-5 h-5 text-amber-400" />
            {impactedOrders.length} Existing Orders Overlapping Scheduled Closures Require Operations Review
          </div>
          <Text className="text-xs text-amber-200/90">
            Per company policy, existing confirmed orders are NEVER automatically cancelled or refunded when a closure is scheduled. They are surfaced below so staff can coordinate branch reassignment or customer rescheduling.
          </Text>
        </div>
      )}

      {/* Closures Table */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
          <Text className="text-sm font-semibold text-slate-800 dark:text-slate-200">
            Scheduled Closures & Operating Calendars
          </Text>
          <span className="text-xs text-slate-500">
            Storefront fulfillment blocks orders automatically for these dates
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 text-slate-500 font-medium">
                <th className="py-3 px-4">Entity Type & Name</th>
                <th className="py-3 px-4">Closure Period (IST)</th>
                <th className="py-3 px-4">Type</th>
                <th className="py-3 px-4">Scope / Mode</th>
                <th className="py-3 px-4">Reason / Notes</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-slate-700 dark:text-slate-300">
              {closures.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-slate-400">
                    No operating closures currently scheduled.
                  </td>
                </tr>
              ) : (
                closures.map((closure) => (
                  <tr key={closure.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/40">
                    <td className="py-3 px-4">
                      <div className="font-semibold text-slate-900 dark:text-white flex items-center gap-1.5">
                        {closure.entity_type === "BRANCH" ? (
                          <Building2 className="w-3.5 h-3.5 text-blue-500" />
                        ) : (
                          <Store className="w-3.5 h-3.5 text-indigo-500" />
                        )}
                        <span>{closure.entity_type}</span>
                      </div>
                      <div className="text-[11px] text-slate-500 font-mono">{closure.entity_id}</div>
                    </td>
                    <td className="py-3 px-4">
                      <div className="font-semibold text-slate-900 dark:text-white">
                        {closure.start_date === closure.end_date
                          ? closure.start_date
                          : `${closure.start_date} to ${closure.end_date}`}
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      <span className="font-mono text-[10px] px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
                        {closure.closure_type}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      {closure.is_full_day ? (
                        <span className="text-amber-500 font-medium">Full Day</span>
                      ) : (
                        <span className="text-slate-500 font-mono">
                          {closure.opening_time} - {closure.closing_time}
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-slate-600 dark:text-slate-300 italic max-w-xs truncate">
                      {closure.reason || "—"}
                    </td>
                    <td className="py-3 px-4">
                      <span
                        className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          closure.status === "SCHEDULED" || closure.status === "ACTIVE"
                            ? "bg-amber-500/10 text-amber-500 border border-amber-500/20"
                            : "bg-slate-500/10 text-slate-400 border border-slate-500/20"
                        }`}
                      >
                        {closure.status}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right">
                      {closure.status === "SCHEDULED" || closure.status === "ACTIVE" ? (
                        <button
                          onClick={() => handleCancelClosure(closure.id)}
                          className="px-2.5 py-1 text-[11px] font-semibold text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-lg transition-colors border border-rose-200 dark:border-rose-800"
                        >
                          Cancel Closure
                        </button>
                      ) : (
                        <span className="text-slate-400 text-xs">Cancelled</span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Impacted Orders Table */}
      {impactedOrders.length > 0 && (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-amber-500/30 shadow-sm overflow-hidden">
          <div className="p-4 bg-amber-500/5 border-b border-amber-500/20 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ShieldAlert className="w-4 h-4 text-amber-500" />
              <Text className="text-sm font-bold text-slate-900 dark:text-white">
                Orders Impacted by Scheduled Closures ({impactedOrders.length})
              </Text>
            </div>
            <span className="text-xs text-amber-600 dark:text-amber-400 font-semibold">
              Pending Operations Action
            </span>
          </div>

          <div className="overflow-x-auto max-h-60">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 text-slate-500 font-medium">
                  <th className="py-2.5 px-4">Order ID</th>
                  <th className="py-2.5 px-4">Fulfillment Date</th>
                  <th className="py-2.5 px-4">Amount</th>
                  <th className="py-2.5 px-4">Order Status</th>
                  <th className="py-2.5 px-4">Impact Resolution Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-slate-600 dark:text-slate-400">
                {impactedOrders.map((imp) => (
                  <tr key={imp.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/40">
                    <td className="py-2.5 px-4 font-mono font-semibold text-slate-900 dark:text-white">
                      {imp.order_id}
                    </td>
                    <td className="py-2.5 px-4 font-semibold text-amber-600 dark:text-amber-400">
                      {imp.fulfillment_date}
                    </td>
                    <td className="py-2.5 px-4">₹{Number(imp.total_amount).toFixed(2)}</td>
                    <td className="py-2.5 px-4">{imp.order_status}</td>
                    <td className="py-2.5 px-4">
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/10 text-amber-500 border border-amber-500/20">
                        {imp.resolution_status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Schedule Closure Modal */}
      {showScheduleModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xl max-w-md w-full p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
              <Heading level="h3" className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Calendar className="w-5 h-5 text-amber-500" />
                Schedule Operational Closure
              </Heading>
              <button
                onClick={() => setShowScheduleModal(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 text-lg"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleScheduleSubmit} className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-600 dark:text-slate-400 mb-1 font-semibold">Entity Type *</label>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setEntityType("BRANCH");
                      if (branches.length > 0) setEntityId(branches[0].id);
                    }}
                    className={`flex-1 py-1.5 rounded-lg font-semibold text-xs transition-colors ${
                      entityType === "BRANCH"
                        ? "bg-blue-600 text-white"
                        : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300"
                    }`}
                  >
                    CakeToHome Branch
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setEntityType("PARTNER");
                      if (partners.length > 0) setEntityId(partners[0].id);
                    }}
                    className={`flex-1 py-1.5 rounded-lg font-semibold text-xs transition-colors ${
                      entityType === "PARTNER"
                        ? "bg-indigo-600 text-white"
                        : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300"
                    }`}
                  >
                    Marketplace Partner
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-slate-600 dark:text-slate-400 mb-1 font-semibold">
                  Select {entityType === "BRANCH" ? "Branch" : "Partner"} *
                </label>
                <select
                  value={entityId}
                  onChange={(e) => setEntityId(e.target.value)}
                  className="w-full p-2 rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white"
                >
                  {entityType === "BRANCH" ? (
                    branches.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.name} ({b.code || b.id})
                      </option>
                    ))
                  ) : partners.length === 0 ? (
                    <option value="">No partners found</option>
                  ) : (
                    partners.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name} ({p.id.slice(0, 8)})
                      </option>
                    ))
                  )}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-slate-600 dark:text-slate-400 mb-1 font-semibold">Start Date *</label>
                  <input
                    type="date"
                    required
                    value={startDate}
                    onChange={(e) => {
                      setStartDate(e.target.value);
                      if (endDate < e.target.value) setEndDate(e.target.value);
                    }}
                    className="w-full p-2 rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-slate-600 dark:text-slate-400 mb-1 font-semibold">End Date *</label>
                  <input
                    type="date"
                    required
                    min={startDate}
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="w-full p-2 rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-600 dark:text-slate-400 mb-1 font-semibold">Closure Type *</label>
                <select
                  value={closureType}
                  onChange={(e) => setClosureType(e.target.value)}
                  className="w-full p-2 rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white"
                >
                  <option value="HOLIDAY">National / State Holiday</option>
                  <option value="MAINTENANCE">Kitchen / Store Maintenance</option>
                  <option value="EMERGENCY">Emergency Closure / Weather</option>
                  <option value="WEEKLY_OFF">Weekly Scheduled Off</option>
                </select>
              </div>

              <div>
                <label className="block text-slate-600 dark:text-slate-400 mb-1 font-semibold">
                  Reason / Operational Note
                </label>
                <textarea
                  rows={2}
                  placeholder="e.g. Annual Diwali Holiday or Oven Replacement"
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  className="w-full p-2 rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => setShowScheduleModal(false)}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  variant="primary"
                  className="bg-amber-600 hover:bg-amber-500 text-white"
                  disabled={submittingSchedule}
                >
                  Schedule & Save to PostgreSQL
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
});
