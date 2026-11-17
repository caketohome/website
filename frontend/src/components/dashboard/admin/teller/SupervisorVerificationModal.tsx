"use client";

import React, { useState } from "react";
import {
  X,
  AlertCircle,
  CheckCircle2,
  AlertTriangle,
  Loader2,
  ShieldCheck,
  ShieldAlert,
} from "lucide-react";
import type { TellerSessionRow } from "@frontend/lib/types/teller.types";

interface SupervisorVerificationModalProps {
  isOpen: boolean;
  onClose: () => void;
  session: TellerSessionRow;
  currentUserId?: string;
  onSuccess: () => void;
}

export function SupervisorVerificationModal({
  isOpen,
  onClose,
  session,
  currentUserId,
  onSuccess,
}: SupervisorVerificationModalProps) {
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  // 3-Tier Segregation of Duties (SoD) Checks
  const isOpener = currentUserId && session.opened_by === currentUserId;
  const isCloser = currentUserId && session.closed_by === currentUserId;
  const hasSodViolation = isOpener || isCloser;

  const formatAmount = (num: number | string | null | undefined) => {
    if (num === null || num === undefined) return "0.00";
    const val = Number(num);
    return isNaN(val) ? "0.00" : val.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  const varianceNum = Number(session.variance || 0);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (hasSodViolation) {
      setError("Segregation of Duties: You cannot verify a session you opened or closed.");
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/v1/admin/teller/sessions/${session.id}/verify`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          notes: notes.trim() || undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        setError(data.message || data.error || "Failed to verify count.");
        return;
      }

      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err.message || "Network error during verification.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fadeIn">
      <div className="bg-white rounded-2xl max-w-lg w-full shadow-2xl border border-slate-100 overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-brand-light/50">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-brand-light text-brand-navy flex items-center justify-center">
              <ShieldCheck className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-800">Supervisor Count Verification</h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Verify physical drawer count for session <span className="font-mono">{session.id.slice(0, 14)}</span>
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl flex items-start gap-2.5 text-xs text-rose-700">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-600" />
              <span>{error}</span>
            </div>
          )}

          {/* SoD Warning Banner */}
          {hasSodViolation && (
            <div className="p-3.5 bg-rose-50 border border-rose-300 rounded-xl flex items-start gap-2.5 text-xs text-rose-800">
              <ShieldAlert className="w-5 h-5 shrink-0 text-rose-600 mt-0.5" />
              <div>
                <p className="font-bold">Segregation of Duties (SoD) Restriction</p>
                <p className="text-[11px] text-rose-700 mt-0.5">
                  You are registered as the {isOpener ? "session opener" : "session closer"} (<code>{currentUserId}</code>).
                  Under CakeToHome ERP internal controls, physical count verification must be performed by an independent supervisor.
                </p>
              </div>
            </div>
          )}

          {/* Cash Summary Card */}
          <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-3">
            <div className="grid grid-cols-2 gap-4 text-xs">
              <div>
                <span className="text-slate-400 text-[10px] block uppercase font-semibold">Shift Opener</span>
                <span className="font-medium text-slate-700">{session.opened_by}</span>
              </div>
              <div>
                <span className="text-slate-400 text-[10px] block uppercase font-semibold">Closed By</span>
                <span className="font-medium text-slate-700">{session.closed_by || "—"}</span>
              </div>
            </div>

            <div className="pt-2 border-t border-slate-200 grid grid-cols-3 gap-3 text-center">
              <div className="p-2 bg-white rounded-lg border border-slate-100">
                <span className="text-[10px] text-slate-400 uppercase block font-semibold">Expected</span>
                <span className="text-sm font-bold font-mono text-slate-800">
                  ₹{formatAmount(session.expected_cash)}
                </span>
              </div>
              <div className="p-2 bg-white rounded-lg border border-slate-100">
                <span className="text-[10px] text-slate-400 uppercase block font-semibold">Counted</span>
                <span className="text-sm font-bold font-mono text-slate-800">
                  ₹{formatAmount(session.closing_count)}
                </span>
              </div>
              <div className="p-2 bg-white rounded-lg border border-slate-100">
                <span className="text-[10px] text-slate-400 uppercase block font-semibold">Variance</span>
                <span
                  className={`text-sm font-bold font-mono ${
                    varianceNum === 0
                      ? "text-emerald-700"
                      : varianceNum < 0
                      ? "text-rose-700"
                      : "text-brand-navy"
                  }`}
                >
                  {varianceNum > 0 ? "+" : ""}₹{formatAmount(session.variance)}
                </span>
              </div>
            </div>

            {/* Variance Interpretation */}
            <div className="flex items-center justify-between text-xs pt-1">
              <span className="text-slate-500">Status:</span>
              {varianceNum === 0 ? (
                <span className="inline-flex items-center gap-1 text-emerald-700 font-semibold">
                  <CheckCircle2 className="w-3.5 h-3.5" /> Balanced (Zero Variance)
                </span>
              ) : varianceNum < 0 ? (
                <span className="inline-flex items-center gap-1 text-rose-700 font-semibold">
                  <AlertTriangle className="w-3.5 h-3.5" /> Cash Shortage (-₹{formatAmount(Math.abs(varianceNum))})
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 text-brand-navy font-semibold">
                  <CheckCircle2 className="w-3.5 h-3.5" /> Cash Excess (+₹{formatAmount(varianceNum)})
                </span>
              )}
            </div>
          </div>

          {/* Supervisor Notes */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Verification Notes <span className="text-slate-400 font-normal">(Optional)</span>
            </label>
            <textarea
              rows={2}
              placeholder="e.g. Physical count verified and coins re-counted in presence of cashier."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-xl text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-primary/20 focus:border-brand-primary"
            />
          </div>

          {/* Actions */}
          <div className="pt-2 flex items-center justify-end gap-2.5">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="px-4 py-2 text-xs font-medium text-slate-600 hover:bg-slate-100 rounded-xl transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading || !!hasSodViolation}
              className="px-4 py-2 text-xs font-semibold text-white bg-brand-primary hover:bg-brand-navy rounded-xl shadow-sm transition-colors flex items-center gap-1.5 disabled:opacity-50"
            >
              {loading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              <span>Confirm & Verify Count</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
