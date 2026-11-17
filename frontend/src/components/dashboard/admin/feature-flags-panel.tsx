"use client";

import { useEffect, useState, memo } from "react";
import { Container, Heading, Text, Badge, Button } from "@medusajs/ui";
import {
  ToggleLeft,
  ToggleRight,
  ShieldCheck,
  ShieldAlert,
  RefreshCw,
  AlertTriangle,
  CheckCircle2,
  Lock,
  History,
  Layers,
  Sliders,
} from "lucide-react";

interface FeatureFlag {
  id: string;
  key: string;
  scope: "GLOBAL" | "BRANCH" | "PARTNER";
  entity_id: string;
  is_enabled: boolean;
  name: string;
  description?: string;
  category: string;
  is_system_mandatory: boolean;
  updated_at: string;
}

interface AuditEntry {
  id: string;
  flag_key: string;
  scope: string;
  entity_id: string;
  actor_id: string;
  actor_role: string;
  previous_value: boolean;
  new_value: boolean;
  reason?: string;
  created_at: string;
}

export const FeatureFlagsPanel = memo(function FeatureFlagsPanel() {
  const [flags, setFlags] = useState<FeatureFlag[]>([]);
  const [auditLog, setAuditLog] = useState<AuditEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Toggle Modal State
  const [toggleTarget, setToggleTarget] = useState<FeatureFlag | null>(null);
  const [toggleReason, setToggleReason] = useState("");
  const [submittingToggle, setSubmittingToggle] = useState(false);

  const fetchFlags = async () => {
    try {
      setLoading(true);
      setErrorMsg(null);
      const res = await fetch("/api/v1/admin/features");
      const data = await res.json();
      if (data.flags) {
        setFlags(data.flags);
      }
    } catch (err: any) {
      setErrorMsg("Failed to load feature flags: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  const fetchAuditLog = async () => {
    try {
      const res = await fetch("/api/v1/admin/features/audit");
      const data = await res.json();
      if (data.auditLog) {
        setAuditLog(data.auditLog);
      }
    } catch (err: any) {
      console.error("Failed to load feature flag audit log", err);
    }
  };

  useEffect(() => {
    fetchFlags();
    fetchAuditLog();
  }, []);

  const handleConfirmToggle = async () => {
    if (!toggleTarget) return;
    try {
      setSubmittingToggle(true);
      setErrorMsg(null);
      const res = await fetch(`/api/v1/admin/features/${encodeURIComponent(toggleTarget.key)}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          scope: toggleTarget.scope,
          entityId: toggleTarget.entity_id,
          isEnabled: !toggleTarget.is_enabled,
          reason: toggleReason || "Admin manual configuration toggle",
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Failed to update feature flag");
      }
      setSuccessMsg(
        `Feature '${toggleTarget.name}' has been ${
          !toggleTarget.is_enabled ? "ENABLED" : "DISABLED"
        } with PostgreSQL audit record.`
      );
      setToggleTarget(null);
      setToggleReason("");
      fetchFlags();
      fetchAuditLog();
    } catch (err: any) {
      setErrorMsg(err.message);
    } finally {
      setSubmittingToggle(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 p-6 rounded-2xl bg-gradient-to-r from-slate-900 via-brand-navy to-slate-900 border border-brand-navy/40 text-white shadow-xl">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="p-2 rounded-xl bg-brand-primary/20 text-brand-primary border border-brand-primary/30">
              <Sliders className="w-5 h-5" />
            </span>
            <Heading level="h2" className="text-xl font-bold tracking-tight text-white">
              Dynamic Feature Configuration & Governance
            </Heading>
            <Badge color="blue" className="text-xs font-semibold px-2.5 py-0.5">
              PostgreSQL Single Truth
            </Badge>
          </div>
          <Text className="text-sm text-slate-300 max-w-3xl">
            Hierarchical feature toggles (GLOBAL → BRANCH → PARTNER) backed strictly by PostgreSQL. Enforces mandatory system flag lockouts, server-side RBAC, and immutable audit logs without requiring code deployments.
          </Text>
        </div>

        <div className="flex items-center gap-3">
          <Button
            variant="secondary"
            size="small"
            onClick={() => {
              fetchFlags();
              fetchAuditLog();
            }}
            disabled={loading}
            className="flex items-center gap-2 bg-slate-800/80 hover:bg-slate-700 text-slate-200 border border-slate-700"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
            Refresh
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

      {/* Flags Table */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
          <Text className="text-sm font-semibold text-slate-800 dark:text-slate-200">
            System & Commercial Feature Controls
          </Text>
          <span className="text-xs text-slate-500">
            Mandatory flags are protected against accidental deactivation
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 text-slate-500 font-medium">
                <th className="py-3 px-4">Feature Key & Name</th>
                <th className="py-3 px-4">Scope</th>
                <th className="py-3 px-4">Category</th>
                <th className="py-3 px-4 text-center">Mandatory</th>
                <th className="py-3 px-4 text-center">Status</th>
                <th className="py-3 px-4 text-right">Toggle Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-slate-700 dark:text-slate-300">
              {flags.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-slate-400">
                    No feature flags configured in database.
                  </td>
                </tr>
              ) : (
                flags.map((flag) => (
                  <tr key={flag.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/40">
                    <td className="py-3 px-4">
                      <div className="font-semibold text-slate-900 dark:text-white flex items-center gap-1.5">
                        {flag.name}
                        {flag.is_system_mandatory && (
                          <Lock className="w-3.5 h-3.5 text-brand-gold shrink-0" />
                        )}
                      </div>
                      <div className="text-[11px] text-slate-500 font-mono">{flag.key}</div>
                      {flag.description && (
                        <div className="text-[11px] text-slate-400 mt-0.5">{flag.description}</div>
                      )}
                    </td>
                    <td className="py-3 px-4">
                      <span className="font-mono text-[11px] px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
                        {flag.scope} {flag.entity_id !== "global" ? `(${flag.entity_id.slice(0, 8)})` : ""}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-slate-500">{flag.category}</td>
                    <td className="py-3 px-4 text-center">
                      {flag.is_system_mandatory ? (
                        <span className="text-[10px] font-bold text-brand-gold px-2 py-0.5 bg-brand-gold/10 rounded-full border border-brand-gold/20">
                          MANDATORY
                        </span>
                      ) : (
                        <span className="text-slate-400 text-[11px]">Optional</span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-center">
                      <span
                        className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                          flag.is_enabled
                            ? "bg-emerald-500/10 text-emerald-500 border border-emerald-500/20"
                            : "bg-slate-500/10 text-slate-400 border border-slate-500/20"
                        }`}
                      >
                        <span className={`w-1.5 h-1.5 rounded-full ${flag.is_enabled ? "bg-emerald-500" : "bg-slate-400"}`} />
                        {flag.is_enabled ? "ENABLED" : "DISABLED"}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right">
                      <button
                        onClick={() => {
                          setToggleTarget(flag);
                          setToggleReason("");
                        }}
                        className={`px-3 py-1 rounded-lg text-xs font-semibold transition-colors flex items-center gap-1.5 ml-auto ${
                          flag.is_enabled
                            ? "bg-rose-50 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-800 hover:bg-rose-100"
                            : "bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800 hover:bg-emerald-100"
                        }`}
                      >
                        {flag.is_enabled ? (
                          <>
                            <ToggleRight className="w-4 h-4" />
                            Disable
                          </>
                        ) : (
                          <>
                            <ToggleLeft className="w-4 h-4" />
                            Enable
                          </>
                        )}
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Audit History Log */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex items-center gap-2">
          <History className="w-4 h-4 text-brand-primary" />
          <Text className="text-sm font-semibold text-slate-800 dark:text-slate-200">
            Immutable Feature Flag Audit Log
          </Text>
        </div>

        <div className="overflow-x-auto max-h-64">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 text-slate-500 font-medium">
                <th className="py-2.5 px-4">Timestamp</th>
                <th className="py-2.5 px-4">Flag Key</th>
                <th className="py-2.5 px-4">Scope</th>
                <th className="py-2.5 px-4">Actor</th>
                <th className="py-2.5 px-4">Change</th>
                <th className="py-2.5 px-4">Reason</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-slate-600 dark:text-slate-400">
              {auditLog.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-6 text-center text-slate-400">
                    No configuration changes recorded yet.
                  </td>
                </tr>
              ) : (
                auditLog.map((log) => (
                  <tr key={log.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/40">
                    <td className="py-2.5 px-4 whitespace-nowrap text-[11px] font-mono">
                      {new Date(log.created_at).toLocaleString("en-IN")}
                    </td>
                    <td className="py-2.5 px-4 font-mono font-semibold text-slate-900 dark:text-white">
                      {log.flag_key}
                    </td>
                    <td className="py-2.5 px-4">{log.scope}</td>
                    <td className="py-2.5 px-4">
                      <span className="font-medium text-slate-800 dark:text-slate-200">{log.actor_role}</span>
                      <span className="text-[10px] text-slate-400 block font-mono">{log.actor_id}</span>
                    </td>
                    <td className="py-2.5 px-4 whitespace-nowrap">
                      <span className={log.previous_value ? "text-emerald-500 font-semibold" : "text-slate-400"}>
                        {log.previous_value ? "ON" : "OFF"}
                      </span>
                      {" → "}
                      <span className={log.new_value ? "text-emerald-500 font-semibold" : "text-rose-500 font-semibold"}>
                        {log.new_value ? "ON" : "OFF"}
                      </span>
                    </td>
                    <td className="py-2.5 px-4 italic text-[11px] text-slate-500">{log.reason || "—"}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Confirmation Modal */}
      {toggleTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xl max-w-md w-full p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
              <Heading level="h3" className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Sliders className="w-5 h-5 text-brand-primary" />
                Confirm Feature State Change
              </Heading>
              <button
                onClick={() => setToggleTarget(null)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 text-lg"
              >
                ✕
              </button>
            </div>

            <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 text-xs space-y-1">
              <div>
                Feature: <span className="font-bold text-slate-900 dark:text-white">{toggleTarget.name}</span>
              </div>
              <div className="font-mono text-slate-500">{toggleTarget.key}</div>
              <div className="mt-2 text-slate-600 dark:text-slate-300">
                Action: Switching from{" "}
                <span className="font-bold">{toggleTarget.is_enabled ? "ENABLED" : "DISABLED"}</span> to{" "}
                <span className="font-bold text-brand-primary">{!toggleTarget.is_enabled ? "ENABLED" : "DISABLED"}</span>
              </div>
            </div>

            <div className="space-y-2 text-xs">
              <label className="block text-slate-600 dark:text-slate-400 font-semibold">
                Audit Reason / Justification *
              </label>
              <textarea
                rows={2}
                placeholder="State the operational reason for this toggle (recorded in audit ledger)"
                value={toggleReason}
                onChange={(e) => setToggleReason(e.target.value)}
                className="w-full p-2 rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button
                type="button"
                variant="secondary"
                onClick={() => setToggleTarget(null)}
              >
                Cancel
              </Button>
              <Button
                type="button"
                variant="primary"
                onClick={handleConfirmToggle}
                className="bg-brand-primary hover:bg-brand-primary text-white"
                disabled={submittingToggle}
              >
                Confirm & Commit Toggle
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
});
