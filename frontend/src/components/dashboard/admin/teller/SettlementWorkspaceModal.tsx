"use client";

import React, { useState, useEffect } from "react";
import {
  X,
  AlertCircle,
  CheckCircle2,
  AlertTriangle,
  Loader2,
  Landmark,
  ShieldAlert,
  FileText,
  Calendar,
  ArrowRight,
  ShieldCheck,
} from "lucide-react";
import type { TellerSessionRow } from "@frontend/lib/types/teller.types";

interface SettlementWorkspaceModalProps {
  isOpen: boolean;
  onClose: () => void;
  session: TellerSessionRow;
  currentUserId?: string;
  onSuccess: () => void;
}

export function SettlementWorkspaceModal({
  isOpen,
  onClose,
  session,
  currentUserId,
  onSuccess,
}: SettlementWorkspaceModalProps) {
  const [loadingPreview, setLoadingPreview] = useState(true);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [previewData, setPreviewData] = useState<any | null>(null);

  const [settlementDate, setSettlementDate] = useState(() => {
    return new Date().toISOString().split("T")[0];
  });
  const [settlementNotes, setSettlementNotes] = useState("");
  const [settling, setSettling] = useState(false);
  const [settleError, setSettleError] = useState<string | null>(null);
  const [settleSuccess, setSettleSuccess] = useState<any | null>(null);

  // 3-Tier Segregation of Duties (SoD) Checks
  const isOpener = currentUserId && session.opened_by === currentUserId;
  const isVerifier = currentUserId && session.verified_by === currentUserId;
  const isCloser = currentUserId && session.closed_by === currentUserId;
  const hasSodViolation = isOpener || isVerifier || isCloser;

  const formatAmount = (num: number | string | null | undefined) => {
    if (num === null || num === undefined) return "0.00";
    const val = Number(num);
    return isNaN(val) ? "0.00" : val.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  // Fetch preflight settlement preview from server
  useEffect(() => {
    if (!isOpen) return;
    let isMounted = true;

    async function fetchPreview() {
      setLoadingPreview(true);
      setPreviewError(null);
      try {
        const res = await fetch(`/api/v1/admin/teller/sessions/${session.id}/prepare-settlement`);
        const data = await res.json();
        if (!isMounted) return;

        if (!res.ok || !data.success) {
          setPreviewError(data.message || data.error || "Failed to load settlement preview.");
          return;
        }

        setPreviewData(data);
      } catch (err: any) {
        if (isMounted) setPreviewError(err.message || "Network error loading preview.");
      } finally {
        if (isMounted) setLoadingPreview(false);
      }
    }

    fetchPreview();
    return () => {
      isMounted = false;
    };
  }, [isOpen, session.id]);

  if (!isOpen) return null;

  const varianceNum = Number(session.variance || 0);

  const handleSettle = async (e: React.FormEvent) => {
    e.preventDefault();
    if (hasSodViolation) {
      setSettleError("Segregation of Duties: You cannot settle a session you opened, closed, or verified.");
      return;
    }

    setSettling(true);
    setSettleError(null);
    try {
      const res = await fetch(`/api/v1/admin/teller/sessions/${session.id}/settle`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          settlement_date: settlementDate,
          notes: settlementNotes.trim() || undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        setSettleError(data.message || data.error || "Failed to execute settlement.");
        return;
      }

      setSettleSuccess(data);
      onSuccess();
    } catch (err: any) {
      setSettleError(err.message || "Network error during settlement.");
    } finally {
      setSettling(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fadeIn">
      <div className="bg-white rounded-2xl max-w-lg w-full shadow-2xl border border-slate-100 overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-emerald-50/50">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-emerald-100 text-emerald-800 flex items-center justify-center">
              <Landmark className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-800">Financial Shift Settlement</h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Post variance journal voucher for session <span className="font-mono">{session.id.slice(0, 14)}</span>
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
        <div className="p-6 space-y-4">
          {settleSuccess ? (
            /* Success confirmation screen */
            <div className="text-center py-6 space-y-3">
              <div className="w-12 h-12 bg-emerald-100 text-emerald-700 rounded-full flex items-center justify-center mx-auto">
                <CheckCircle2 className="w-6 h-6" />
              </div>
              <h4 className="text-base font-bold text-slate-800">Session Successfully Settled!</h4>
              <p className="text-xs text-slate-500 max-w-sm mx-auto">
                The shift cash custody ledger is officially closed and balanced in the general ledger.
              </p>

              {settleSuccess.settlement_voucher_id ? (
                <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl inline-block text-left text-xs space-y-1">
                  <div className="text-slate-400 text-[10px] font-semibold uppercase">Posted Journal Voucher</div>
                  <div className="font-mono font-bold text-blue-700">{settleSuccess.settlement_voucher_id}</div>
                  <div className="text-[11px] text-slate-500">Status: <span className="text-emerald-700 font-semibold">POSTED</span></div>
                </div>
              ) : (
                <div className="p-2.5 bg-emerald-50 text-emerald-800 rounded-xl text-xs font-medium">
                  Zero Variance: Session closed cleanly with no accounting voucher required.
                </div>
              )}

              <div className="pt-3">
                <button
                  onClick={onClose}
                  className="px-5 py-2 text-xs font-semibold bg-slate-900 text-white rounded-xl hover:bg-slate-800 transition-colors"
                >
                  Done
                </button>
              </div>
            </div>
          ) : (
            <form onSubmit={handleSettle} className="space-y-4">
              {settleError && (
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl flex items-start gap-2.5 text-xs text-rose-700">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-600" />
                  <span>{settleError}</span>
                </div>
              )}

              {/* SoD Warning Banner */}
              {hasSodViolation && (
                <div className="p-3.5 bg-rose-50 border border-rose-300 rounded-xl flex items-start gap-2.5 text-xs text-rose-800">
                  <ShieldAlert className="w-5 h-5 shrink-0 text-rose-600 mt-0.5" />
                  <div>
                    <p className="font-bold">Segregation of Duties (SoD) Restriction</p>
                    <p className="text-[11px] text-rose-700 mt-0.5">
                      You are registered as the {isOpener ? "session opener" : isVerifier ? "supervisor count verifier" : "closer"} (<code>{currentUserId}</code>).
                      Settlement posting to the general ledger must be authorized by an independent accountant.
                    </p>
                  </div>
                </div>
              )}

              {/* Cash Summary Banner */}
              <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between text-xs">
                <div>
                  <span className="text-slate-400 text-[10px] block uppercase font-semibold">Verified Physical Count</span>
                  <span className="font-mono font-bold text-slate-800 text-sm">₹{formatAmount(session.closing_count)}</span>
                </div>
                <div className="text-center">
                  <span className="text-slate-400 text-[10px] block uppercase font-semibold">Expected Cash</span>
                  <span className="font-mono font-bold text-slate-800 text-sm">₹{formatAmount(session.expected_cash)}</span>
                </div>
                <div className="text-right">
                  <span className="text-slate-400 text-[10px] block uppercase font-semibold">Variance</span>
                  <span
                    className={`font-mono font-bold text-sm ${
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

              {/* Preflight GL Preview Section */}
              <div className="border border-slate-200 rounded-xl p-3.5 bg-white">
                <h4 className="text-xs font-bold text-slate-800 mb-2 flex items-center gap-1.5">
                  <FileText className="w-3.5 h-3.5 text-blue-600" />
                  Accounting Settlement Preflight
                </h4>

                {loadingPreview ? (
                  <div className="py-4 text-center text-xs text-slate-400 flex items-center justify-center gap-2">
                    <Loader2 className="w-4 h-4 animate-spin text-blue-600" />
                    <span>Loading server preflight calculation...</span>
                  </div>
                ) : previewError ? (
                  <div className="p-2.5 bg-rose-50 text-rose-700 rounded-lg text-xs">
                    {previewError}
                  </div>
                ) : previewData?.voucher_required ? (
                  <div className="space-y-2 text-xs">
                    <div className="p-2.5 bg-slate-50 rounded-lg border border-slate-100 font-mono text-[11px] space-y-1">
                      <div className="flex items-center justify-between text-slate-700">
                        <span><strong>Debit:</strong> Account {previewData.settlement_entry?.debit_account_code} {previewData.settlement_entry?.debit_account_code === "5296" ? "(Cash Over / Short)" : "(Cash in Hand)"}</span>
                        <span className="font-bold text-slate-900">₹{formatAmount(previewData.settlement_entry?.amount)}</span>
                      </div>
                      <div className="flex items-center justify-between text-slate-700">
                        <span><strong>Credit:</strong> Account {previewData.settlement_entry?.credit_account_code} {previewData.settlement_entry?.credit_account_code === "1111" ? "(Cash in Hand)" : "(Cash Over / Short)"}</span>
                        <span className="font-bold text-slate-900">₹{formatAmount(previewData.settlement_entry?.amount)}</span>
                      </div>
                    </div>
                    <p className="text-[11px] text-slate-500 italic">
                      Narration: &ldquo;{previewData.settlement_entry?.narration}&rdquo;
                    </p>
                  </div>
                ) : (
                  <div className="p-2.5 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-lg text-xs flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span>Zero variance detected. Session will settle cleanly without creating a GL voucher.</span>
                  </div>
                )}
              </div>

              {/* Settlement Form Inputs */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Settlement Date
                  </label>
                  <input
                    type="date"
                    required
                    value={settlementDate}
                    onChange={(e) => setSettlementDate(e.target.value)}
                    className="w-full px-3 py-1.5 text-xs bg-white border border-slate-200 rounded-xl text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Settlement Notes
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. End of shift balance verified"
                    value={settlementNotes}
                    onChange={(e) => setSettlementNotes(e.target.value)}
                    className="w-full px-3 py-1.5 text-xs bg-white border border-slate-200 rounded-xl text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                  />
                </div>
              </div>

              {/* Actions */}
              <div className="pt-2 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={onClose}
                  disabled={settling}
                  className="px-4 py-2 text-xs font-medium text-slate-600 hover:bg-slate-100 rounded-xl transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={settling || !!hasSodViolation || loadingPreview || !!previewError}
                  className="px-4 py-2 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl shadow-sm transition-colors flex items-center gap-1.5 disabled:opacity-50"
                >
                  {settling && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  <span>Post & Settle Session</span>
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
