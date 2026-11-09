"use client";

import React, { useState } from "react";
import {
  X,
  AlertCircle,
  ArrowDownLeft,
  ArrowUpRight,
  Loader2,
  CheckCircle2,
} from "lucide-react";

interface ManualAdjustmentModalProps {
  isOpen: boolean;
  onClose: () => void;
  sessionId?: string;
  branchId?: string;
  tellerCode?: string;
  onSuccess: () => void;
}

export function ManualAdjustmentModal({
  isOpen,
  onClose,
  sessionId,
  branchId,
  tellerCode,
  onSuccess,
}: ManualAdjustmentModalProps) {
  const [direction, setDirection] = useState<"IN" | "OUT">("IN");
  const [amount, setAmount] = useState<string>("");
  const [narration, setNarration] = useState<string>("");
  const [referenceId, setReferenceId] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const numAmount = parseFloat(amount);
    if (isNaN(numAmount) || numAmount <= 0) {
      setError("Please enter a valid amount greater than zero.");
      return;
    }

    if (!narration.trim() || narration.trim().length < 3) {
      setError("Explicit narration of at least 3 characters is required.");
      return;
    }

    setLoading(true);
    try {
      const endpoint = sessionId
        ? `/api/v1/admin/teller/sessions/${sessionId}/movements`
        : `/api/v1/admin/teller/movements`;

      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          branch_id: branchId,
          teller_session_id: sessionId,
          direction,
          amount: numAmount,
          narration: narration.trim(),
          reference_id: referenceId.trim() || undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        setError(data.message || data.error || "Failed to record manual adjustment.");
        return;
      }

      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err.message || "Network error while saving movement.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fadeIn">
      <div className="bg-white rounded-2xl max-w-md w-full shadow-2xl border border-slate-100 overflow-hidden transform transition-all">
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
          <div>
            <h3 className="text-base font-bold text-slate-800">Record Cash Adjustment</h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Drawer adjustment for session: <span className="font-mono font-medium text-slate-700">{tellerCode || (sessionId ? sessionId.slice(0, 12) : (branchId ? `Branch: ${branchId}` : "Continuous Custody"))}</span>
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body / Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl flex items-start gap-2.5 text-xs text-rose-700">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-600" />
              <span>{error}</span>
            </div>
          )}

          {/* Direction Selector */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              Movement Direction <span className="text-rose-500">*</span>
            </label>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setDirection("IN")}
                className={`py-2.5 px-3 rounded-xl border text-xs font-medium flex items-center justify-center gap-2 transition-all ${
                  direction === "IN"
                    ? "bg-emerald-50 border-emerald-400 text-emerald-800 shadow-sm ring-1 ring-emerald-400"
                    : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50"
                }`}
              >
                <ArrowDownLeft className={`w-4 h-4 ${direction === "IN" ? "text-emerald-600" : "text-slate-400"}`} />
                <span>Cash IN (+)</span>
              </button>

              <button
                type="button"
                onClick={() => setDirection("OUT")}
                className={`py-2.5 px-3 rounded-xl border text-xs font-medium flex items-center justify-center gap-2 transition-all ${
                  direction === "OUT"
                    ? "bg-rose-50 border-rose-400 text-rose-800 shadow-sm ring-1 ring-rose-400"
                    : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50"
                }`}
              >
                <ArrowUpRight className={`w-4 h-4 ${direction === "OUT" ? "text-rose-600" : "text-slate-400"}`} />
                <span>Cash OUT (-)</span>
              </button>
            </div>
            <p className="text-[11px] text-slate-400 mt-1">
              {direction === "IN" ? "Add float or cash injection into drawer" : "Petty cash payout or mid-day drawer skim"}
            </p>
          </div>

          {/* Amount Input */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Amount (₹) <span className="text-rose-500">*</span>
            </label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-medium text-sm">₹</span>
              <input
                type="number"
                step="0.01"
                min="0.01"
                required
                placeholder="0.00"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="w-full pl-8 pr-3 py-2 text-sm bg-white border border-slate-200 rounded-xl text-slate-800 font-mono font-medium placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
              />
            </div>
          </div>

          {/* Narration */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Narration / Reason <span className="text-rose-500">*</span>
            </label>
            <textarea
              rows={2}
              required
              placeholder="e.g. Mid-day change coin float top-up"
              value={narration}
              onChange={(e) => setNarration(e.target.value)}
              className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-xl text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
            />
          </div>

          {/* External Reference ID (Optional) */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Reference ID <span className="text-slate-400 font-normal">(Optional)</span>
            </label>
            <input
              type="text"
              placeholder="e.g. SLIP-10492"
              value={referenceId}
              onChange={(e) => setReferenceId(e.target.value)}
              className="w-full px-3 py-1.5 text-xs bg-white border border-slate-200 rounded-xl text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
            />
          </div>

          {/* Buttons */}
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
              disabled={loading}
              className="px-4 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-xl shadow-sm transition-colors flex items-center gap-1.5 disabled:opacity-50"
            >
              {loading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              <span>Record Movement</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
