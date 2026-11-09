"use client";

import React, { useState, useMemo } from "react";
import {
  Search,
  Filter,
  RefreshCw,
  Clock,
  Landmark,
  CheckCircle2,
  AlertTriangle,
  FileText,
  Eye,
  ChevronRight,
  X,
  Layers,
} from "lucide-react";
import type { TellerSessionRow, TellerMovementRow } from "@frontend/lib/types/teller.types";
import { MovementLedgerTable } from "./MovementLedgerTable";

interface SessionHistoryTabProps {
  sessions: TellerSessionRow[];
  loading: boolean;
  onRefresh: () => void;
  branches: { id: string; name: string }[];
  selectedBranchId: string;
  onSelectBranch: (id: string) => void;
}

export function SessionHistoryTab({
  sessions,
  loading,
  onRefresh,
  branches,
  selectedBranchId,
  onSelectBranch,
}: SessionHistoryTabProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [inspectingSession, setInspectingSession] = useState<TellerSessionRow | null>(null);
  const [inspectingMovements, setInspectingMovements] = useState<TellerMovementRow[]>([]);
  const [loadingMovements, setLoadingMovements] = useState(false);

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
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch {
      return ts;
    }
  };

  const selectedBranchObj = branches.find((b) => b.id === selectedBranchId);

  const filteredSessions = useMemo(() => {
    return sessions.filter((s) => {
      if (statusFilter !== "ALL" && s.status !== statusFilter) {
        return false;
      }
      if (selectedBranchId && s.branch_id !== selectedBranchId) {
        return false;
      }
      if (searchTerm.trim()) {
        const q = searchTerm.toLowerCase();
        const id = s.id.toLowerCase();
        const teller = (s.teller_id || "").toLowerCase();
        const openedBy = (s.opened_by || "").toLowerCase();
        const voucher = (s.settlement_voucher_id || "").toLowerCase();
        const branchName = (s.branch_name || "").toLowerCase();
        return id.includes(q) || teller.includes(q) || openedBy.includes(q) || voucher.includes(q) || branchName.includes(q);
      }
      return true;
    });
  }, [sessions, statusFilter, selectedBranchId, searchTerm]);

  const handleClearFilters = () => {
    setStatusFilter("ALL");
    setSearchTerm("");
    onSelectBranch("");
  };

  // Load movements when inspecting a session
  const handleInspectSession = async (session: TellerSessionRow) => {
    setInspectingSession(session);
    setLoadingMovements(true);
    try {
      const res = await fetch(`/api/v1/admin/teller/sessions/${session.id}/movements`);
      const data = await res.json();
      if (data.success && data.movements) {
        setInspectingMovements(data.movements);
      } else {
        setInspectingMovements([]);
      }
    } catch {
      setInspectingMovements([]);
    } finally {
      setLoadingMovements(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "SETTLED":
        return <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">SETTLED</span>;
      case "PENDING_VERIFICATION":
        return <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-purple-50 text-purple-700 border border-purple-200">PENDING_VERIFICATION</span>;
      case "CLOSING":
        return <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-50 text-amber-700 border border-amber-200">CLOSING</span>;
      case "OPEN":
        return <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-blue-50 text-blue-700 border border-blue-200">OPEN</span>;
      case "CANCELLED":
        return <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-slate-100 text-slate-600 border border-slate-200">CANCELLED</span>;
      default:
        return <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-slate-100 text-slate-700">{status}</span>;
    }
  };

  return (
    <div className="space-y-6">
      {/* Controls & Filter Bar */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h3 className="text-base font-bold text-slate-800 flex items-center gap-2">
            <Clock className="w-5 h-5 text-blue-600" />
            Session History & Financial Audit Trail
          </h3>
          <p className="text-xs text-slate-500 mt-0.5">
            Immutable log of all closed and settled teller shift drawers across operating branches
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 w-full sm:w-auto">
          {/* Branch Filter */}
          <select
            value={selectedBranchId || "ALL"}
            onChange={(e) => onSelectBranch(e.target.value === "ALL" ? "" : e.target.value)}
            className="text-xs py-1.5 px-3 bg-white border border-slate-200 rounded-xl text-slate-700 focus:outline-none focus:ring-1 focus:ring-blue-500 font-medium"
          >
            <option value="ALL">All Branches</option>
            {branches.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </select>

          {/* Search */}
          <div className="relative flex-1 sm:w-48">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search ID, voucher..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 text-xs bg-white border border-slate-200 rounded-xl text-slate-700 placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>

          {/* Status Filter */}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="text-xs py-1.5 px-3 bg-white border border-slate-200 rounded-xl text-slate-700 focus:outline-none focus:ring-1 focus:ring-blue-500"
          >
            <option value="ALL">All Statuses</option>
            <option value="SETTLED">Settled</option>
            <option value="PENDING_VERIFICATION">Pending Verification</option>
            <option value="CLOSING">Closing</option>
            <option value="OPEN">Open</option>
          </select>

          <button
            onClick={onRefresh}
            disabled={loading}
            className="p-1.5 rounded-xl border border-slate-200 hover:bg-slate-100 text-slate-600 transition-colors disabled:opacity-50"
            title="Refresh history"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin text-blue-600" : ""}`} />
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                <th className="py-3 px-4">Session ID</th>
                <th className="py-3 px-4">Branch / Counter</th>
                <th className="py-3 px-4">Cashier / Opened</th>
                <th className="py-3 px-4 text-right">Opening Float</th>
                <th className="py-3 px-4 text-right">Physical Count</th>
                <th className="py-3 px-4 text-right">Expected</th>
                <th className="py-3 px-4 text-right">Variance</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4">Settlement Voucher</th>
                <th className="py-3 px-4 text-center">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs">
              {loading ? (
                <tr>
                  <td colSpan={10} className="py-12 text-center text-slate-500">
                    <RefreshCw className="w-6 h-6 mx-auto text-blue-600 animate-spin mb-2" />
                    <p className="font-semibold text-slate-700">Loading session audit history...</p>
                    <p className="text-[11px] text-slate-400 mt-0.5">Fetching immutable shift records from PostgreSQL</p>
                  </td>
                </tr>
              ) : sessions.length === 0 ? (
                <tr>
                  <td colSpan={10} className="py-12 text-center text-slate-400">
                    <FileText className="w-8 h-8 mx-auto text-slate-300 mb-2" />
                    <p className="font-medium text-slate-600">No shift sessions recorded yet</p>
                    <p className="text-[11px] text-slate-400 mt-0.5">
                      Completed shift sessions will appear in this historical register once opened and settled
                    </p>
                  </td>
                </tr>
              ) : filteredSessions.length === 0 ? (
                <tr>
                  <td colSpan={10} className="py-12 text-center text-slate-500">
                    <AlertTriangle className="w-8 h-8 mx-auto text-amber-500 mb-2" />
                    <p className="font-semibold text-slate-700">No sessions match the current filters</p>
                    <p className="text-[11px] text-slate-400 mt-0.5 mb-3">
                      {selectedBranchId ? `Branch: ${selectedBranchObj?.name || selectedBranchId}` : "All branches"}
                      {statusFilter !== "ALL" ? ` • Status: ${statusFilter}` : ""}
                      {searchTerm ? ` • Query: "${searchTerm}"` : ""}
                    </p>
                    <button
                      onClick={handleClearFilters}
                      className="px-3.5 py-1.5 text-xs font-semibold bg-blue-50 text-blue-600 hover:bg-blue-100 rounded-xl transition-colors"
                    >
                      Clear Filters & View All
                    </button>
                  </td>
                </tr>
              ) : (
                filteredSessions.map((s) => {
                  const variance = Number(s.variance || 0);

                  return (
                    <tr key={s.id} className="hover:bg-slate-50/70 transition-colors">
                      <td className="py-3 px-4 font-mono font-medium text-slate-800 whitespace-nowrap">
                        {s.id}
                      </td>
                      <td className="py-3 px-4 text-slate-700 whitespace-nowrap">
                        <div className="font-semibold text-slate-800">{s.branch_name || s.branch_id}</div>
                        <div className="text-[10px] text-slate-400 font-mono">{s.teller_name || s.teller_code || s.teller_id}</div>
                      </td>
                      <td className="py-3 px-4 whitespace-nowrap">
                        <div className="font-medium text-slate-800">{s.opened_by}</div>
                        <div className="text-[10px] text-slate-400">{formatDate(s.opened_at)}</div>
                      </td>
                      <td className="py-3 px-4 text-right font-mono text-slate-700">
                        ₹{formatAmount(s.opening_float)}
                      </td>
                      <td className="py-3 px-4 text-right font-mono text-slate-700">
                        {s.closing_count !== null ? `₹${formatAmount(s.closing_count)}` : "—"}
                      </td>
                      <td className="py-3 px-4 text-right font-mono text-slate-700">
                        {s.expected_cash !== null ? `₹${formatAmount(s.expected_cash)}` : "—"}
                      </td>
                      <td className="py-3 px-4 text-right font-mono font-semibold whitespace-nowrap">
                        {s.variance !== null ? (
                          <span
                            className={
                              variance === 0
                                ? "text-emerald-700"
                                : variance < 0
                                ? "text-rose-700"
                                : "text-teal-700"
                            }
                          >
                            {variance > 0 ? "+" : ""}₹{formatAmount(s.variance)}
                          </span>
                        ) : (
                          <span className="text-slate-400 font-normal">—</span>
                        )}
                      </td>
                      <td className="py-3 px-4 whitespace-nowrap">
                        {getStatusBadge(s.status)}
                      </td>
                      <td className="py-3 px-4 font-mono text-[11px] whitespace-nowrap">
                        {s.settlement_voucher_id ? (
                          <span className="inline-flex items-center gap-1 text-blue-700 bg-blue-50 px-2 py-0.5 rounded border border-blue-200">
                            {s.settlement_voucher_id}
                          </span>
                        ) : s.status === "SETTLED" ? (
                          <span className="text-emerald-700 text-[10px]">Zero Variance (No Voucher)</span>
                        ) : (
                          <span className="text-slate-400">—</span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-center whitespace-nowrap">
                        <button
                          onClick={() => handleInspectSession(s)}
                          className="p-1.5 rounded-lg text-slate-500 hover:text-blue-600 hover:bg-blue-50 transition-colors"
                          title="Inspect full movement ledger"
                        >
                          <Eye className="w-4 h-4" />
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

      {/* Inspect Session Drawer / Modal */}
      {inspectingSession && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fadeIn">
          <div className="bg-white rounded-2xl max-w-3xl w-full max-h-[90vh] shadow-2xl border border-slate-100 flex flex-col overflow-hidden">
            {/* Header */}
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
              <div className="flex items-center gap-2">
                <Layers className="w-5 h-5 text-blue-600" />
                <div>
                  <h3 className="text-base font-bold text-slate-800">
                    Session Audit Inspection: <span className="font-mono">{inspectingSession.id}</span>
                  </h3>
                  <p className="text-xs text-slate-500">
                    Full lifecycle timeline & physical cash movement register
                  </p>
                </div>
              </div>
              <button
                onClick={() => setInspectingSession(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Content Area */}
            <div className="p-6 overflow-y-auto space-y-6">
              {/* Lifecycle Audit Strip */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-4 bg-slate-50 border border-slate-200 rounded-xl text-xs">
                <div>
                  <span className="text-[10px] text-slate-400 uppercase font-semibold block">Opened By</span>
                  <div className="font-semibold text-slate-800">{inspectingSession.opened_by}</div>
                  <div className="text-[10px] text-slate-400">{formatDate(inspectingSession.opened_at)}</div>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 uppercase font-semibold block">Closed By</span>
                  <div className="font-semibold text-slate-800">{inspectingSession.closed_by || "—"}</div>
                  <div className="text-[10px] text-slate-400">{formatDate(inspectingSession.closed_at)}</div>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 uppercase font-semibold block">Verified By</span>
                  <div className="font-semibold text-slate-800">{inspectingSession.verified_by || "—"}</div>
                  <div className="text-[10px] text-slate-400">{formatDate(inspectingSession.verified_at)}</div>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 uppercase font-semibold block">Settled By</span>
                  <div className="font-semibold text-slate-800">{inspectingSession.settled_by || "—"}</div>
                  <div className="text-[10px] text-slate-400">{formatDate(inspectingSession.settled_at)}</div>
                </div>
              </div>

              {/* Movement Ledger Table */}
              <div>
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">
                  Session Movements Log
                </h4>
                <MovementLedgerTable
                  movements={inspectingMovements}
                  loading={loadingMovements}
                  openingFloat={Number(inspectingSession.opening_float)}
                />
              </div>
            </div>

            {/* Footer */}
            <div className="px-6 py-3 border-t border-slate-100 flex items-center justify-end bg-slate-50/50">
              <button
                onClick={() => setInspectingSession(null)}
                className="px-4 py-1.5 text-xs font-semibold bg-slate-900 text-white rounded-xl hover:bg-slate-800"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
