"use client";

import React, { useState } from "react";
import {
  Clock,
  ShieldCheck,
  Landmark,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  Search,
  UserCheck,
  ChevronRight,
  FileCheck2,
} from "lucide-react";
import type { TellerSessionRow } from "@frontend/lib/types/teller.types";
import { SupervisorVerificationModal } from "./SupervisorVerificationModal";
import { SettlementWorkspaceModal } from "./SettlementWorkspaceModal";

interface VerificationSettlementQueueTabProps {
  sessions: TellerSessionRow[];
  loading: boolean;
  onRefresh: () => void;
  currentUserId?: string;
  userRole?: string;
}

export function VerificationSettlementQueueTab({
  sessions,
  loading,
  onRefresh,
  currentUserId,
  userRole,
}: VerificationSettlementQueueTabProps) {
  const [selectedVerifySession, setSelectedVerifySession] = useState<TellerSessionRow | null>(null);
  const [selectedSettleSession, setSelectedSettleSession] = useState<TellerSessionRow | null>(null);
  const [queueFilter, setQueueFilter] = useState<"ALL" | "CLOSING" | "PENDING_VERIFICATION">("ALL");

  const closingSessions = sessions.filter((s) => s.status === "CLOSING");
  const pendingSessions = sessions.filter((s) => s.status === "PENDING_VERIFICATION");

  const formatAmount = (num: number | string | null | undefined) => {
    if (num === null || num === undefined) return "0.00";
    const val = Number(num);
    return isNaN(val) ? "0.00" : val.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  const formatDate = (ts: string | null) => {
    if (!ts) return "—";
    try {
      return new Date(ts).toLocaleString("en-IN", {
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch {
      return ts;
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Banner & KPI Summary */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h3 className="text-base font-bold text-slate-800 flex items-center gap-2">
            <FileCheck2 className="w-5 h-5 text-brand-primary" />
            Verification & Settlement Work Queue
          </h3>
          <p className="text-xs text-slate-500 mt-0.5">
            Internal financial control pipeline enforcing 3-tier Segregation of Duties (SoD)
          </p>
        </div>

        <div className="flex items-center gap-2">
          {/* Filter Pills */}
          <div className="flex bg-slate-100 p-1 rounded-xl text-xs font-medium">
            <button
              onClick={() => setQueueFilter("ALL")}
              className={`px-3 py-1 rounded-lg transition-colors ${
                queueFilter === "ALL" ? "bg-white text-slate-800 shadow-sm font-semibold" : "text-slate-600 hover:text-slate-800"
              }`}
            >
              All ({closingSessions.length + pendingSessions.length})
            </button>
            <button
              onClick={() => setQueueFilter("CLOSING")}
              className={`px-3 py-1 rounded-lg transition-colors ${
                queueFilter === "CLOSING" ? "bg-white text-slate-800 shadow-sm font-semibold" : "text-slate-600 hover:text-slate-800"
              }`}
            >
              Needs Verification ({closingSessions.length})
            </button>
            <button
              onClick={() => setQueueFilter("PENDING_VERIFICATION")}
              className={`px-3 py-1 rounded-lg transition-colors ${
                queueFilter === "PENDING_VERIFICATION" ? "bg-white text-slate-800 shadow-sm font-semibold" : "text-slate-600 hover:text-slate-800"
              }`}
            >
              Ready to Settle ({pendingSessions.length})
            </button>
          </div>

          <button
            onClick={onRefresh}
            disabled={loading}
            className="p-2 rounded-xl border border-slate-200 hover:bg-slate-100 text-slate-600 transition-colors disabled:opacity-50"
            title="Refresh queue"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin text-brand-primary" : ""}`} />
          </button>
        </div>
      </div>

      {/* Queue 1: Awaiting Supervisor Verification */}
      {(queueFilter === "ALL" || queueFilter === "CLOSING") && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="px-5 py-3.5 border-b border-slate-200 bg-brand-gold-light/40 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-brand-gold" />
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-800">
                1. Awaiting Supervisor Physical Count Verification
              </h4>
              <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-brand-gold-light text-brand-gold-dark">
                {closingSessions.length}
              </span>
            </div>
          </div>

          {closingSessions.length === 0 ? (
            <div className="p-8 text-center text-xs text-slate-400">
              No shifts currently waiting for supervisor count verification.
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {closingSessions.map((s) => {
                const variance = Number(s.variance || 0);
                const isOpener = currentUserId && s.opened_by === currentUserId;

                return (
                  <div key={s.id} className="p-4 sm:p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 hover:bg-slate-50/60 transition-colors">
                    <div className="space-y-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs font-bold text-slate-800">{s.id}</span>
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-brand-gold-light text-brand-gold-dark border border-brand-gold/40">
                          CLOSING
                        </span>
                        {isOpener && (
                          <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-rose-50 text-rose-600 border border-rose-200">
                            You Opened This
                          </span>
                        )}
                      </div>

                      <div className="text-xs text-slate-500 flex flex-wrap items-center gap-x-4 gap-y-1">
                        <span>Teller: <strong>{s.teller_id}</strong></span>
                        <span>Cashier: <strong>{s.opened_by}</strong></span>
                        <span>Closed: {formatDate(s.closed_at)}</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-6 w-full sm:w-auto justify-between sm:justify-end">
                      <div className="text-right">
                        <div className="text-[10px] uppercase font-semibold text-slate-400">Physical Count / Expected</div>
                        <div className="font-mono text-xs font-bold text-slate-700">
                          ₹{formatAmount(s.closing_count)} <span className="text-slate-400 font-normal">/ ₹{formatAmount(s.expected_cash)}</span>
                        </div>
                        <div className={`text-xs font-mono font-semibold ${variance === 0 ? "text-emerald-600" : variance < 0 ? "text-rose-600" : "text-brand-primary"}`}>
                          Variance: {variance > 0 ? "+" : ""}₹{formatAmount(s.variance)}
                        </div>
                      </div>

                      <button
                        onClick={() => setSelectedVerifySession(s)}
                        className="px-3.5 py-1.5 text-xs font-semibold bg-brand-primary hover:bg-brand-navy text-white rounded-xl shadow-sm transition-colors flex items-center gap-1 shrink-0"
                      >
                        <ShieldCheck className="w-3.5 h-3.5" />
                        <span>Verify Count</span>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Queue 2: Awaiting Accounting Settlement */}
      {(queueFilter === "ALL" || queueFilter === "PENDING_VERIFICATION") && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="px-5 py-3.5 border-b border-slate-200 bg-emerald-50/40 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Landmark className="w-4 h-4 text-emerald-600" />
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-800">
                2. Awaiting Accounting Final Settlement (GL Posting)
              </h4>
              <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-800">
                {pendingSessions.length}
              </span>
            </div>
          </div>

          {pendingSessions.length === 0 ? (
            <div className="p-8 text-center text-xs text-slate-400">
              No shifts currently waiting for accounting settlement.
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {pendingSessions.map((s) => {
                const variance = Number(s.variance || 0);
                const isOpenerOrVerifier = currentUserId && (s.opened_by === currentUserId || s.verified_by === currentUserId);

                return (
                  <div key={s.id} className="p-4 sm:p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 hover:bg-slate-50/60 transition-colors">
                    <div className="space-y-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs font-bold text-slate-800">{s.id}</span>
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-brand-light text-brand-navy border border-brand-primary/30">
                          PENDING_VERIFICATION
                        </span>
                        {variance === 0 ? (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                            Balanced
                          </span>
                        ) : variance < 0 ? (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-rose-50 text-rose-700 border border-rose-200">
                            Shortage (Dr 5296 / Cr 1111)
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-brand-light text-brand-navy border border-brand-primary/30">
                            Excess (Dr 1111 / Cr 5296)
                          </span>
                        )}
                        {isOpenerOrVerifier && (
                          <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-rose-50 text-rose-600 border border-rose-200">
                            SoD Conflict
                          </span>
                        )}
                      </div>

                      <div className="text-xs text-slate-500 flex flex-wrap items-center gap-x-4 gap-y-1">
                        <span>Teller: <strong>{s.teller_id}</strong></span>
                        <span>Cashier: <strong>{s.opened_by}</strong></span>
                        <span>Verified by: <strong>{s.verified_by}</strong> ({formatDate(s.verified_at)})</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-6 w-full sm:w-auto justify-between sm:justify-end">
                      <div className="text-right">
                        <div className="text-[10px] uppercase font-semibold text-slate-400">Final Physical / Variance</div>
                        <div className="font-mono text-xs font-bold text-slate-700">
                          ₹{formatAmount(s.closing_count)}
                        </div>
                        <div className={`text-xs font-mono font-bold ${variance === 0 ? "text-emerald-600" : variance < 0 ? "text-rose-600" : "text-brand-primary"}`}>
                          {variance > 0 ? "+" : ""}₹{formatAmount(s.variance)}
                        </div>
                      </div>

                      <button
                        onClick={() => setSelectedSettleSession(s)}
                        className="px-3.5 py-1.5 text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl shadow-sm transition-colors flex items-center gap-1 shrink-0"
                      >
                        <Landmark className="w-3.5 h-3.5" />
                        <span>Review & Settle</span>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Verification Modal */}
      {selectedVerifySession && (
        <SupervisorVerificationModal
          isOpen={!!selectedVerifySession}
          onClose={() => setSelectedVerifySession(null)}
          session={selectedVerifySession}
          currentUserId={currentUserId}
          onSuccess={() => {
            onRefresh();
          }}
        />
      )}

      {/* Settlement Workspace Modal */}
      {selectedSettleSession && (
        <SettlementWorkspaceModal
          isOpen={!!selectedSettleSession}
          onClose={() => setSelectedSettleSession(null)}
          session={selectedSettleSession}
          currentUserId={currentUserId}
          onSuccess={() => {
            onRefresh();
          }}
        />
      )}
    </div>
  );
}
