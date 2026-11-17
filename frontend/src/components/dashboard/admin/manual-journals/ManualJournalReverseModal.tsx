"use client";

import React, { useState } from "react";
import { AlertTriangle, RotateCcw, X, ShieldAlert, CheckCircle2 } from "lucide-react";
import type { AccountingVoucherRow } from "@frontend/lib/types/accounting.types";

interface ManualJournalReverseModalProps {
  voucher: AccountingVoucherRow;
  currentUserId?: string;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (reversalResult: any) => void;
}

export function ManualJournalReverseModal({
  voucher,
  currentUserId,
  isOpen,
  onClose,
  onSuccess,
}: ManualJournalReverseModalProps) {
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  // Visual Segregation of Duties check: Creator cannot reverse own voucher
  const isCreator = Boolean(currentUserId && voucher.created_by === currentUserId);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isCreator) {
      setError("Segregation of Duties: Voucher creator cannot authorize reversal. An independent controller must perform this action.");
      return;
    }

    if (!reason.trim() || reason.trim().length < 5) {
      setError("Please provide a meaningful reversal reason (minimum 5 characters).");
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const res = await fetch(`/api/v1/admin/accounting/journals/${voucher.id}/reverse`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          reason: reason.trim(),
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.message || data.error || "Failed to reverse manual journal voucher.");
      }

      onSuccess(data.data);
      onClose();
    } catch (err: any) {
      setError(err.message || "An unexpected error occurred during reversal.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="w-full max-w-lg rounded-xl bg-white shadow-2xl border border-slate-200 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50/80 px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-brand-gold-light text-brand-gold">
              <RotateCcw className="h-5 w-5" />
            </div>
            <div>
              <h3 className="font-semibold text-slate-900">Authorize Journal Reversal</h3>
              <p className="text-xs text-slate-500 font-mono">{voucher.voucher_no}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            disabled={submitting}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {/* Audit Warning */}
          <div className="rounded-lg border border-brand-gold/40 bg-brand-gold-light/70 p-3.5 flex gap-3 text-xs text-brand-gold-dark">
            <AlertTriangle className="h-4 w-4 text-brand-gold shrink-0 mt-0.5" />
            <div>
              <p className="font-medium">Compensating Reversal Invariant</p>
              <p className="mt-0.5 text-brand-gold-dark">
                This operation creates a compensating journal voucher that strictly inverts all Debits and Credits and posts it atomically to the General Ledger. The original voucher will be marked as reversed with bidirectional audit linkage.
              </p>
            </div>
          </div>

          {/* Segregation of Duties Notice */}
          {isCreator && (
            <div className="rounded-lg border border-red-200 bg-red-50 p-3.5 flex gap-3 text-xs text-red-800">
              <ShieldAlert className="h-4 w-4 text-red-600 shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold">Segregation of Duties (SoD) Restriction</p>
                <p className="mt-0.5 text-red-700">
                  You created this voucher (<span className="font-mono">{voucher.created_by}</span>). Under financial controls, creators are barred from reversing their own entries. An independent finance user must authorize this action.
                </p>
              </div>
            </div>
          )}

          {/* Voucher Summary Card */}
          <div className="grid grid-cols-2 gap-3 rounded-lg border border-slate-200 bg-slate-50/50 p-3 text-xs">
            <div>
              <span className="text-slate-500 block">Voucher Date</span>
              <span className="font-medium text-slate-800">
                {new Date(voucher.voucher_date).toLocaleDateString("en-IN", {
                  day: "2-digit",
                  month: "short",
                  year: "numeric",
                })}
              </span>
            </div>
            <div>
              <span className="text-slate-500 block">Total Amount</span>
              <span className="font-medium text-slate-800">
                ₹{Number(voucher.total_amount).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
              </span>
            </div>
            <div className="col-span-2">
              <span className="text-slate-500 block">Original Narration</span>
              <span className="font-medium text-slate-800 line-clamp-2">
                {voucher.narration || "No narration provided"}
              </span>
            </div>
          </div>

          {/* Reason Input */}
          <div className="space-y-1.5">
            <label className="block text-xs font-semibold text-slate-700">
              Reversal Reason / Justification <span className="text-red-500">*</span>
            </label>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              disabled={submitting || isCreator}
              rows={3}
              placeholder="e.g. Audit correction: reclassifying delivery vehicle fuel expense to operating branch 2..."
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs text-slate-800 placeholder-slate-400 focus:border-brand-primary focus:outline-none focus:ring-1 focus:ring-brand-primary disabled:bg-slate-100 disabled:cursor-not-allowed"
            />
            <p className="text-[11px] text-slate-500">
              Required by audit policy. Will be recorded permanently on the compensating voucher.
            </p>
          </div>

          {/* Error Message */}
          {error && (
            <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-xs text-red-700 flex items-start gap-2">
              <AlertTriangle className="h-4 w-4 shrink-0 text-red-500 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {/* Footer Actions */}
          <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              className="rounded-lg border border-slate-200 px-4 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting || isCreator || reason.trim().length < 5}
              className="inline-flex items-center gap-1.5 rounded-lg bg-red-600 px-4 py-2 text-xs font-medium text-white shadow-sm hover:bg-red-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {submitting ? (
                <>
                  <div className="h-3 w-3 animate-spin rounded-full border-2 border-white border-t-transparent" />
                  Posting Reversal...
                </>
              ) : (
                <>
                  <RotateCcw className="h-3.5 w-3.5" />
                  Confirm & Post Reversal
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
