"use client";

import React, { useState } from "react";
import {
  X,
  AlertCircle,
  Loader2,
  Lock,
  Calculator,
  CheckCircle2,
  AlertTriangle,
} from "lucide-react";

interface CloseSessionModalProps {
  isOpen: boolean;
  onClose: () => void;
  sessionId: string;
  expectedCash: number;
  tellerCode?: string;
  onSuccess: () => void;
}

export function CloseSessionModal({
  isOpen,
  onClose,
  sessionId,
  expectedCash,
  tellerCode,
  onSuccess,
}: CloseSessionModalProps) {
  const [closingCount, setClosingCount] = useState<string>("");
  const [notes, setNotes] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const countNum = parseFloat(closingCount);
  const hasValidCount = !isNaN(countNum) && countNum >= 0;
  const liveVariance = hasValidCount ? countNum - expectedCash : null;

  const formatAmount = (num: number) => {
    return num.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!hasValidCount) {
      setError("Please declare a valid physical cash count (0 or greater).");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(`/api/v1/admin/teller/sessions/${sessionId}/close`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          closing_count: countNum,
          notes: notes.trim() || undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        setError(data.message || data.error || "Failed to close cash session.");
        return;
      }

      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err.message || "Network error while closing session.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fadeIn">
      <div className="bg-white rounded-2xl max-w-md w-full shadow-2xl border border-slate-100 overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-brand-gold-light/50">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-brand-gold-light text-brand-gold-dark flex items-center justify-center">
              <Lock className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-800">Close Cash Shift</h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Declare physical drawer count for {tellerCode || sessionId.slice(0, 10)}
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

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl flex items-start gap-2.5 text-xs text-rose-700">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-600" />
              <span>{error}</span>
            </div>
          )}

          {/* Expected Cash Reminder */}
          <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between">
            <div>
              <span className="text-xs text-slate-500 block">System Expected Cash in Drawer</span>
              <span className="text-[11px] text-slate-400">Opening float + custody movements</span>
            </div>
            <div className="text-right">
              <span className="text-base font-bold font-mono text-slate-800">
                ₹{formatAmount(expectedCash)}
              </span>
            </div>
          </div>

          {/* Physical Cash Input */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Physical Cash Count (₹) <span className="text-rose-500">*</span>
            </label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-medium text-sm">₹</span>
              <input
                type="number"
                step="0.01"
                min="0"
                required
                placeholder="0.00"
                value={closingCount}
                onChange={(e) => setClosingCount(e.target.value)}
                className="w-full pl-8 pr-3 py-2 text-base bg-white border border-slate-200 rounded-xl text-slate-800 font-mono font-bold placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-gold/20 focus:border-brand-gold"
              />
            </div>
            <p className="text-[11px] text-slate-400 mt-1">
              Count all physical currency bills and coins currently in the till.
            </p>
          </div>

          {/* Live Variance Calculation */}
          {hasValidCount && liveVariance !== null && (
            <div
              className={`p-3 rounded-xl border flex items-center justify-between text-xs ${
                liveVariance === 0
                  ? "bg-emerald-50 border-emerald-200 text-emerald-800"
                  : liveVariance < 0
                  ? "bg-rose-50 border-rose-200 text-rose-800"
                  : "bg-brand-light border-brand-primary/30 text-brand-navy"
              }`}
            >
              <div className="flex items-center gap-2">
                {liveVariance === 0 ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                ) : (
                  <AlertTriangle className="w-4 h-4 text-brand-gold" />
                )}
                <span className="font-semibold">
                  {liveVariance === 0
                    ? "Drawer Perfectly Balanced"
                    : liveVariance < 0
                    ? "Cash Shortage Detected"
                    : "Cash Excess Detected"}
                </span>
              </div>
              <div className="font-mono font-bold text-sm">
                {liveVariance > 0 ? "+" : ""}₹{formatAmount(liveVariance)}
              </div>
            </div>
          )}

          {/* Notes */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Closing Notes <span className="text-slate-400 font-normal">(Optional)</span>
            </label>
            <textarea
              rows={2}
              placeholder="e.g. Discrepancy explanation or shift handover note"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-xl text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-gold/20 focus:border-brand-gold"
            />
          </div>

          <div className="p-3 bg-brand-gold-light/70 border border-brand-gold/60 rounded-xl text-[11px] text-brand-gold-dark leading-relaxed">
            <strong>Next Step:</strong> Upon closing, this session transitions to <code>CLOSING</code> and requires an independent supervisor count verification before accounting settlement.
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
              disabled={loading || !hasValidCount}
              className="px-4 py-2 text-xs font-semibold text-white bg-brand-gold hover:bg-brand-gold-dark rounded-xl shadow-sm transition-colors flex items-center gap-1.5 disabled:opacity-50"
            >
              {loading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              <span>Confirm & Close Shift</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
