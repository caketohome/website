"use client";

import React, { useState } from "react";
import {
  Wallet,
  ArrowDownLeft,
  ArrowUpRight,
  Plus,
  Lock,
  Clock,
  Building,
  UserCheck,
  CheckCircle2,
  AlertTriangle,
  FileCheck2,
  AlertCircle,
  Loader2,
  Scale,
} from "lucide-react";
import type { TellerRow, TellerSessionRow, TellerMovementRow } from "@frontend/lib/types/teller.types";
import { MovementLedgerTable } from "./MovementLedgerTable";
import { ManualAdjustmentModal } from "./ManualAdjustmentModal";
import { CloseSessionModal } from "./CloseSessionModal";

interface ActiveDrawerTabProps {
  activeSession: TellerSessionRow | null;
  activeTeller: TellerRow | null;
  tellers: TellerRow[];
  branches: { id: string; name: string; code?: string }[];
  selectedBranchId: string;
  onSelectBranch: (branchId: string) => void;
  onSelectTeller: (tellerId: string) => void;
  movements: TellerMovementRow[];
  loadingMovements: boolean;
  onRefreshMovements: () => void;
  onSessionChanged: () => void;
  onNavigateToWorkQueue: () => void;
  userRole?: string;
  userId?: string;
}

export function ActiveDrawerTab({
  activeSession,
  activeTeller,
  tellers,
  branches,
  selectedBranchId,
  onSelectBranch,
  onSelectTeller,
  movements,
  loadingMovements,
  onRefreshMovements,
  onSessionChanged,
  onNavigateToWorkQueue,
  userRole,
  userId,
}: ActiveDrawerTabProps) {
  const [showOpenModal, setShowOpenModal] = useState(false);
  const [showAdjustModal, setShowAdjustModal] = useState(false);
  const [showCloseModal, setShowCloseModal] = useState(false);

  // Open Shift Form State
  const [openingFloat, setOpeningFloat] = useState("500");
  const [openNotes, setOpenNotes] = useState("");
  const [openingLoading, setOpeningLoading] = useState(false);
  const [openError, setOpenError] = useState<string | null>(null);

  const formatAmount = (num: number | string | null | undefined) => {
    if (num === null || num === undefined) return "0.00";
    const val = Number(num);
    return isNaN(val) ? "0.00" : val.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  // Calculate live movement totals for the UI
  const totalCashIn = movements
    .filter((m) => m.direction === "IN")
    .reduce((sum, m) => sum + Number(m.amount || 0), 0);

  const totalCashOut = movements
    .filter((m) => m.direction === "OUT")
    .reduce((sum, m) => sum + Number(m.amount || 0), 0);

  const currentExpectedCash = activeSession?.expected_cash !== null && activeSession?.expected_cash !== undefined
    ? Number(activeSession.expected_cash)
    : Number(activeSession?.opening_float || 0) + totalCashIn - totalCashOut;

  // Handle Open Session Submit
  const handleOpenSession = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeTeller) {
      setOpenError("Please select a teller counter first.");
      return;
    }

    const floatNum = parseFloat(openingFloat);
    if (isNaN(floatNum) || floatNum < 0) {
      setOpenError("Opening float must be a non-negative number.");
      return;
    }

    setOpeningLoading(true);
    setOpenError(null);
    try {
      const res = await fetch("/api/v1/admin/teller/sessions/open", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          teller_id: activeTeller.id,
          branch_id: selectedBranchId,
          opening_float: floatNum,
          notes: openNotes.trim() || undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        setOpenError(data.message || data.error || "Failed to open cash session.");
        return;
      }

      setShowOpenModal(false);
      setOpenNotes("");
      onSessionChanged();
    } catch (err: any) {
      setOpenError(err.message || "Network error while opening session.");
    } finally {
      setOpeningLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Station Selector & Context Banner */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
          {/* Branch Picker */}
          <div>
            <label className="block text-[10px] font-semibold uppercase tracking-wider text-slate-400 mb-1">
              Branch Location
            </label>
            <select
              value={selectedBranchId}
              onChange={(e) => onSelectBranch(e.target.value)}
              className="text-xs py-1.5 px-3 bg-slate-50 border border-slate-200 rounded-xl font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
            >
              {branches.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name} {b.code ? `(${b.code})` : ""}
                </option>
              ))}
            </select>
          </div>

          {/* Teller Counter Picker */}
          <div>
            <label className="block text-[10px] font-semibold uppercase tracking-wider text-slate-400 mb-1">
              Teller Counter Station
            </label>
            <select
              value={activeTeller?.id || ""}
              onChange={(e) => onSelectTeller(e.target.value)}
              className="text-xs py-1.5 px-3 bg-slate-50 border border-slate-200 rounded-xl font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
            >
              {tellers.length === 0 ? (
                <option value="">No counters configured for this branch</option>
              ) : (
                tellers.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name} ({t.code})
                  </option>
                ))
              )}
            </select>
          </div>
        </div>

        {/* Counter Info & Status */}
        {activeTeller && (
          <div className="flex items-center gap-3 text-xs text-slate-600 bg-slate-50 py-2 px-3.5 rounded-xl border border-slate-200/80">
            <UserCheck className="w-4 h-4 text-slate-400" />
            <div>
              <span className="text-[11px] text-slate-400 block">Assigned Operator</span>
              <span className="font-semibold text-slate-700">{activeTeller.user_id}</span>
            </div>
          </div>
        )}
      </div>

      {/* Main Session View Area */}
      {!activeSession ? (
        /* No Active Session State */
        <div className="bg-white rounded-2xl border border-dashed border-slate-300 p-12 text-center shadow-sm">
          <div className="w-14 h-14 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center mx-auto mb-4 border border-blue-100 shadow-sm">
            <Wallet className="w-7 h-7" />
          </div>
          <h3 className="text-lg font-bold text-slate-800">No Active Cash Shift</h3>
          <p className="text-xs text-slate-500 max-w-md mx-auto mt-1 leading-relaxed">
            {activeTeller
              ? `Counter station "${activeTeller.name}" does not currently have an open cash session.`
              : "Select a teller counter above to start shift operations."}
          </p>

          {activeTeller && (
            <div className="mt-6">
              <button
                onClick={() => setShowOpenModal(true)}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-semibold bg-blue-600 text-white hover:bg-blue-700 shadow-sm transition-colors"
              >
                <Plus className="w-4 h-4" />
                <span>Open New Cash Shift</span>
              </button>
            </div>
          )}
        </div>
      ) : activeSession.status === "OPEN" ? (
        /* Active OPEN Session View */
        <div className="space-y-6">
          {/* Header Status & Shift Actions Bar */}
          <div className="bg-gradient-to-r from-slate-900 to-slate-800 rounded-2xl p-6 text-white shadow-lg flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2.5 mb-1.5">
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold tracking-wide uppercase bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                  Shift Open
                </span>
                <span className="text-slate-400 text-xs font-mono">
                  ID: {activeSession.id}
                </span>
              </div>
              <p className="text-xs text-slate-300 flex items-center gap-3">
                <span>Opened by: <strong>{activeSession.opened_by}</strong></span>
                <span>•</span>
                <span>Time: {new Date(activeSession.opened_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
              </p>
            </div>

            {/* Action Buttons */}
            <div className="flex items-center gap-2.5">
              <button
                onClick={() => setShowAdjustModal(true)}
                className="px-3.5 py-2 rounded-xl text-xs font-semibold bg-white/10 hover:bg-white/20 text-white border border-white/10 transition-colors flex items-center gap-1.5 shadow-sm"
              >
                <Plus className="w-3.5 h-3.5 text-blue-300" />
                <span>Cash Adjustment</span>
              </button>

              <button
                onClick={() => setShowCloseModal(true)}
                className="px-4 py-2 rounded-xl text-xs font-semibold bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold transition-colors flex items-center gap-1.5 shadow-sm"
              >
                <Lock className="w-3.5 h-3.5" />
                <span>Close Shift & Count</span>
              </button>
            </div>
          </div>

          {/* 4 Live Financial Metric Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Opening Float */}
            <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
              <div className="flex items-center justify-between text-slate-500 mb-2">
                <span className="text-xs font-semibold uppercase tracking-wider">Opening Float</span>
                <Wallet className="w-4 h-4 text-blue-500" />
              </div>
              <div className="text-2xl font-bold font-mono text-slate-800">
                ₹{formatAmount(activeSession.opening_float)}
              </div>
              <p className="text-[11px] text-slate-400 mt-1">Custody baseline at shift start</p>
            </div>

            {/* Total Inflows */}
            <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
              <div className="flex items-center justify-between text-slate-500 mb-2">
                <span className="text-xs font-semibold uppercase tracking-wider">Cash Collected (IN)</span>
                <ArrowDownLeft className="w-4 h-4 text-emerald-500" />
              </div>
              <div className="text-2xl font-bold font-mono text-emerald-700">
                +₹{formatAmount(totalCashIn)}
              </div>
              <p className="text-[11px] text-slate-400 mt-1">Sales, COD & manual cash-in</p>
            </div>

            {/* Total Outflows */}
            <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
              <div className="flex items-center justify-between text-slate-500 mb-2">
                <span className="text-xs font-semibold uppercase tracking-wider">Cash Disbursed (OUT)</span>
                <ArrowUpRight className="w-4 h-4 text-rose-500" />
              </div>
              <div className="text-2xl font-bold font-mono text-rose-700">
                -₹{formatAmount(totalCashOut)}
              </div>
              <p className="text-[11px] text-slate-400 mt-1">Refunds, deposits & expenses</p>
            </div>

            {/* Current Expected Cash */}
            <div className="bg-blue-50/60 rounded-2xl border border-blue-200 p-5 shadow-sm">
              <div className="flex items-center justify-between text-blue-700 mb-2">
                <span className="text-xs font-bold uppercase tracking-wider">Expected Cash in Till</span>
                <Scale className="w-4 h-4 text-blue-600" />
              </div>
              <div className="text-2xl font-extrabold font-mono text-blue-900">
                ₹{formatAmount(currentExpectedCash)}
              </div>
              <p className="text-[11px] text-blue-700/80 mt-1">Float + Inflows - Outflows</p>
            </div>
          </div>

          {/* Live Movement Ledger */}
          <MovementLedgerTable
            movements={movements}
            loading={loadingMovements}
            onRefresh={onRefreshMovements}
            expectedCash={currentExpectedCash}
            openingFloat={Number(activeSession.opening_float)}
          />
        </div>
      ) : (
        /* Session Closed (CLOSING or PENDING_VERIFICATION) */
        <div className="bg-white rounded-2xl border border-slate-200 p-8 text-center shadow-sm">
          <div className="w-12 h-12 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center mx-auto mb-3 border border-amber-100">
            <Clock className="w-6 h-6" />
          </div>
          <h3 className="text-base font-bold text-slate-800">
            Shift Closed ({activeSession.status})
          </h3>
          <p className="text-xs text-slate-500 max-w-md mx-auto mt-1 leading-relaxed">
            {activeSession.status === "CLOSING"
              ? "This shift has been closed with declared physical count and is awaiting supervisor verification."
              : "Physical count has been verified by supervisor. It is currently awaiting accountant settlement."}
          </p>

          <div className="mt-4 inline-flex items-center gap-6 p-4 bg-slate-50 border border-slate-200 rounded-xl font-mono text-xs">
            <div>
              <span className="text-slate-400 text-[10px] block uppercase">Physical Count</span>
              <span className="font-bold text-slate-800">₹{formatAmount(activeSession.closing_count)}</span>
            </div>
            <div>
              <span className="text-slate-400 text-[10px] block uppercase">Expected</span>
              <span className="font-bold text-slate-800">₹{formatAmount(activeSession.expected_cash)}</span>
            </div>
            <div>
              <span className="text-slate-400 text-[10px] block uppercase">Variance</span>
              <span className={`font-bold ${Number(activeSession.variance) === 0 ? "text-emerald-600" : Number(activeSession.variance) < 0 ? "text-rose-600" : "text-teal-600"}`}>
                {Number(activeSession.variance) > 0 ? "+" : ""}₹{formatAmount(activeSession.variance)}
              </span>
            </div>
          </div>

          <div className="mt-6">
            <button
              onClick={onNavigateToWorkQueue}
              className="px-4 py-2 text-xs font-semibold bg-slate-900 text-white rounded-xl hover:bg-slate-800 transition-colors"
            >
              View in Verification & Settlement Queue →
            </button>
          </div>
        </div>
      )}

      {/* Open Shift Modal */}
      {showOpenModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fadeIn">
          <div className="bg-white rounded-2xl max-w-md w-full shadow-2xl border border-slate-100 overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-blue-50/40">
              <h3 className="text-base font-bold text-slate-800">Open Cash Shift</h3>
              <button
                onClick={() => setShowOpenModal(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100"
              >
                <Lock className="w-5 h-5 hidden" />
                <span>✕</span>
              </button>
            </div>

            <form onSubmit={handleOpenSession} className="p-6 space-y-4">
              {openError && (
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700 flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0 text-rose-600 mt-0.5" />
                  <span>{openError}</span>
                </div>
              )}

              <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs space-y-1 text-slate-600">
                <p><strong>Station:</strong> {activeTeller?.name} ({activeTeller?.code})</p>
                <p><strong>Branch:</strong> {branches.find((b) => b.id === selectedBranchId)?.name || selectedBranchId}</p>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Opening Float (₹) <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-medium">₹</span>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    required
                    value={openingFloat}
                    onChange={(e) => setOpeningFloat(e.target.value)}
                    className="w-full pl-8 pr-3 py-2 text-base font-mono font-bold bg-white border border-slate-200 rounded-xl text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                  />
                </div>
                <p className="text-[11px] text-slate-400 mt-1">
                  Initial change fund physically present in the drawer at start of shift.
                </p>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Notes <span className="text-slate-400 font-normal">(Optional)</span>
                </label>
                <textarea
                  rows={2}
                  placeholder="e.g. Morning opening shift"
                  value={openNotes}
                  onChange={(e) => setOpenNotes(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-xl text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setShowOpenModal(false)}
                  disabled={openingLoading}
                  className="px-4 py-2 text-xs font-medium text-slate-600 hover:bg-slate-100 rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={openingLoading}
                  className="px-4 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-xl shadow-sm flex items-center gap-1.5"
                >
                  {openingLoading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  <span>Open Shift</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Manual Adjustment Modal */}
      {showAdjustModal && activeSession && (
        <ManualAdjustmentModal
          isOpen={showAdjustModal}
          onClose={() => setShowAdjustModal(false)}
          sessionId={activeSession.id}
          tellerCode={activeTeller?.code}
          onSuccess={() => {
            onRefreshMovements();
            onSessionChanged();
          }}
        />
      )}

      {/* Close Shift Modal */}
      {showCloseModal && activeSession && (
        <CloseSessionModal
          isOpen={showCloseModal}
          onClose={() => setShowCloseModal(false)}
          sessionId={activeSession.id}
          expectedCash={currentExpectedCash}
          tellerCode={activeTeller?.code}
          onSuccess={() => {
            onSessionChanged();
          }}
        />
      )}
    </div>
  );
}
