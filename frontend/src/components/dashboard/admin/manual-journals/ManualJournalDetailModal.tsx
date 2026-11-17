"use client";

import React, { useState, useEffect, useCallback } from "react";
import {
  X,
  FileText,
  Clock,
  CheckCircle2,
  AlertCircle,
  Building2,
  Calendar,
  RotateCcw,
  Send,
  Check,
  Ban,
  ShieldCheck,
  ShieldAlert,
  ArrowRight,
  ExternalLink,
  Layers,
  Copy,
} from "lucide-react";
import type {
  ManualJournalDetailResult,
  AccountingVoucherRow,
} from "@frontend/lib/types/accounting.types";
import { ManualJournalReverseModal } from "./ManualJournalReverseModal";

interface ManualJournalDetailModalProps {
  voucherId: string;
  currentUserId?: string;
  isOpen: boolean;
  onClose: () => void;
  onEditDraft?: (voucher: AccountingVoucherRow) => void;
  onStatusChanged?: () => void;
  onSelectVoucher?: (targetVoucherId: string) => void;
}

export function ManualJournalDetailModal({
  voucherId,
  currentUserId,
  isOpen,
  onClose,
  onEditDraft,
  onStatusChanged,
  onSelectVoucher,
}: ManualJournalDetailModalProps) {
  const [detail, setDetail] = useState<ManualJournalDetailResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"proposed" | "posted">("proposed");
  const [reverseModalOpen, setReverseModalOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  const fetchDetail = useCallback(async () => {
    if (!voucherId) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/v1/admin/accounting/journals/${voucherId}`);
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.message || data.error || "Failed to load manual journal details.");
      }
      setDetail(data.data);
      if (data.data.voucher.status === "POSTED") {
        setActiveTab("posted");
      } else {
        setActiveTab("proposed");
      }
    } catch (err: any) {
      setError(err.message || "Failed to load journal voucher.");
    } finally {
      setLoading(false);
    }
  }, [voucherId]);

  useEffect(() => {
    if (isOpen) {
      fetchDetail();
    } else {
      setDetail(null);
      setError(null);
      setSuccessMsg(null);
    }
  }, [isOpen, fetchDetail]);

  if (!isOpen) return null;

  const voucher = detail?.voucher;
  const isMaker = Boolean(currentUserId && voucher?.created_by === currentUserId);
  const isReversed = Boolean(voucher?.reversed_by_voucher_id || (voucher?.metadata as any)?.is_reversed);
  const isReversalVoucher = Boolean(voucher?.reversal_of_voucher_id || voucher?.reference_type === "MANUAL_REVERSAL");

  const copyVoucherNo = () => {
    if (voucher?.voucher_no) {
      navigator.clipboard.writeText(voucher.voucher_no);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  // ── Action Handlers ──────────────────────────────────────────────────────────

  const handleSubmitDraft = async () => {
    if (!voucher) return;
    setActionLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/v1/admin/accounting/journals/${voucher.id}/submit`, {
        method: "POST",
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.message || data.error || "Submission failed.");
      }
      setSuccessMsg("Journal draft submitted for review successfully.");
      await fetchDetail();
      onStatusChanged?.();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setActionLoading(false);
    }
  };

  const handleApprove = async () => {
    if (!voucher) return;
    if (isMaker) {
      setError("Segregation of Duties: Creator cannot approve their own journal voucher.");
      return;
    }
    setActionLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/v1/admin/accounting/journals/${voucher.id}/approve`, {
        method: "POST",
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.message || data.error || "Approval failed.");
      }
      setSuccessMsg("Journal voucher approved successfully.");
      await fetchDetail();
      onStatusChanged?.();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setActionLoading(false);
    }
  };

  const handlePost = async () => {
    if (!voucher) return;
    if (isMaker) {
      setError("Segregation of Duties: Creator cannot post their own journal voucher to the General Ledger.");
      return;
    }
    setActionLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/v1/admin/accounting/journals/${voucher.id}/post`, {
        method: "POST",
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.message || data.error || "GL posting failed.");
      }
      setSuccessMsg("Journal voucher atomically posted to General Ledger.");
      await fetchDetail();
      onStatusChanged?.();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setActionLoading(false);
    }
  };

  const handleCancel = async () => {
    if (!voucher) return;
    if (!window.confirm(`Are you sure you want to cancel voucher ${voucher.voucher_no}? This action is irreversible.`)) {
      return;
    }
    setActionLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/v1/admin/accounting/journals/${voucher.id}/cancel`, {
        method: "POST",
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.message || data.error || "Cancellation failed.");
      }
      setSuccessMsg("Journal voucher cancelled.");
      await fetchDetail();
      onStatusChanged?.();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setActionLoading(false);
    }
  };

  // Status Badge Helper
  const renderStatusBadge = (status: string) => {
    switch (status) {
      case "DRAFT":
        return <span className="inline-flex items-center rounded-md bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-700">DRAFT</span>;
      case "SUBMITTED":
        return <span className="inline-flex items-center rounded-md bg-blue-50 px-2.5 py-1 text-xs font-semibold text-blue-700 border border-blue-200">SUBMITTED (Pending Approval)</span>;
      case "APPROVED":
        return <span className="inline-flex items-center rounded-md bg-brand-light px-2.5 py-1 text-xs font-semibold text-brand-navy border border-brand-primary/30">APPROVED (Ready to Post)</span>;
      case "POSTED":
        return <span className="inline-flex items-center rounded-md bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700 border border-emerald-200">POSTED TO GL</span>;
      case "CANCELLED":
        return <span className="inline-flex items-center rounded-md bg-rose-50 px-2.5 py-1 text-xs font-semibold text-rose-700 border border-rose-200">CANCELLED</span>;
      default:
        return <span className="inline-flex items-center rounded-md bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-700">{status}</span>;
    }
  };

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm animate-in fade-in duration-150">
        <div className="w-full max-w-4xl max-h-[90vh] flex flex-col rounded-xl bg-white shadow-2xl border border-slate-200 overflow-hidden">
          
          {/* Header */}
          <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50/90 px-6 py-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-brand-light text-brand-primary">
                <FileText className="h-5 w-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-base font-semibold text-slate-900">
                    {voucher ? voucher.voucher_no : "Manual Journal Voucher"}
                  </h3>
                  {voucher && (
                    <button
                      onClick={copyVoucherNo}
                      title="Copy Voucher Number"
                      className="text-slate-400 hover:text-slate-600 transition"
                    >
                      <Copy className="h-3.5 w-3.5" />
                    </button>
                  )}
                  {copied && <span className="text-[11px] text-emerald-600">Copied!</span>}
                </div>
                <p className="text-xs text-slate-500">
                  Manual Journal / General Ledger Voucher Lifecycle
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              {voucher && renderStatusBadge(voucher.status)}
              <button
                onClick={onClose}
                className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
          </div>

          {/* Body Content */}
          <div className="flex-1 overflow-y-auto p-6 space-y-6">
            {loading ? (
              <div className="py-16 text-center">
                <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-brand-primary border-t-transparent" />
                <p className="mt-3 text-xs text-slate-500">Loading authoritative journal details...</p>
              </div>
            ) : error && !detail ? (
              <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-xs text-red-700 flex items-start gap-2">
                <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            ) : voucher ? (
              <>
                {/* Feedback Banners */}
                {successMsg && (
                  <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-xs text-emerald-800 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
                      <span>{successMsg}</span>
                    </div>
                    <button onClick={() => setSuccessMsg(null)} className="text-emerald-600 hover:text-emerald-800">
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                )}

                {error && (
                  <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-xs text-red-700 flex items-start gap-2">
                    <AlertCircle className="h-4 w-4 shrink-0 mt-0.5 text-red-500" />
                    <span className="flex-1">{error}</span>
                    <button onClick={() => setError(null)} className="text-red-600 hover:text-red-800">
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                )}

                {/* Reversal Linkage Notice */}
                {isReversed && (
                  <div className="rounded-lg border border-brand-gold/40 bg-brand-gold-light p-4 flex items-start justify-between gap-4">
                    <div className="flex items-start gap-3">
                      <RotateCcw className="h-5 w-5 text-brand-gold shrink-0 mt-0.5" />
                      <div>
                        <h4 className="text-xs font-semibold text-brand-gold-dark">Voucher Has Been Reversed</h4>
                        <p className="text-xs text-brand-gold-dark mt-0.5">
                          Compensating reversal voucher was posted to GL. Reversal reason:{" "}
                          <span className="italic font-medium">
                            {(voucher.metadata as any)?.reversal_reason || "Correction"}
                          </span>
                        </p>
                      </div>
                    </div>
                    {voucher.reversed_by_voucher_id && onSelectVoucher && (
                      <button
                        onClick={() => onSelectVoucher(voucher.reversed_by_voucher_id!)}
                        className="inline-flex items-center gap-1 text-xs font-medium text-brand-gold-dark bg-brand-gold-light hover:bg-brand-gold/40 px-2.5 py-1.5 rounded-md transition shrink-0"
                      >
                        View Reversal Voucher
                        <ArrowRight className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                )}

                {isReversalVoucher && (
                  <div className="rounded-lg border border-brand-primary/30 bg-brand-light p-4 flex items-start justify-between gap-4">
                    <div className="flex items-start gap-3">
                      <RotateCcw className="h-5 w-5 text-brand-primary shrink-0 mt-0.5" />
                      <div>
                        <h4 className="text-xs font-semibold text-brand-navy">Compensating Reversal Voucher</h4>
                        <p className="text-xs text-brand-navy mt-0.5">
                          This is an authoritative compensating journal entry reversing an earlier transaction.
                        </p>
                      </div>
                    </div>
                    {voucher.reversal_of_voucher_id && onSelectVoucher && (
                      <button
                        onClick={() => onSelectVoucher(voucher.reversal_of_voucher_id!)}
                        className="inline-flex items-center gap-1 text-xs font-medium text-brand-navy bg-brand-light hover:bg-brand-primary/30 px-2.5 py-1.5 rounded-md transition shrink-0"
                      >
                        View Original Voucher
                        <ArrowRight className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                )}

                {/* Primary Metadata Cards */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                  <div className="rounded-lg border border-slate-200 bg-slate-50/50 p-3">
                    <span className="text-slate-500 block">Voucher Date</span>
                    <span className="font-semibold text-slate-800 mt-0.5 block">
                      {new Date(voucher.voucher_date).toLocaleDateString("en-IN", {
                        day: "2-digit",
                        month: "short",
                        year: "numeric",
                      })}
                    </span>
                  </div>
                  <div className="rounded-lg border border-slate-200 bg-slate-50/50 p-3">
                    <span className="text-slate-500 block">Total Amount</span>
                    <span className="font-semibold text-brand-navy mt-0.5 block text-sm">
                      ₹{Number(voucher.total_amount).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                  <div className="rounded-lg border border-slate-200 bg-slate-50/50 p-3">
                    <span className="text-slate-500 block">Branch Scoping</span>
                    <span className="font-semibold text-slate-800 mt-0.5 block truncate">
                      {voucher.branch_id}
                    </span>
                  </div>
                  <div className="rounded-lg border border-slate-200 bg-slate-50/50 p-3">
                    <span className="text-slate-500 block">Reference Type</span>
                    <span className="font-semibold text-slate-800 mt-0.5 block">
                      {voucher.reference_type || "MANUAL"}
                    </span>
                  </div>
                </div>

                {/* Narration */}
                <div className="rounded-lg border border-slate-200 bg-slate-50/30 p-3 text-xs">
                  <span className="text-slate-500 block font-medium">Header Narration / Purpose</span>
                  <p className="text-slate-800 mt-1 font-sans">
                    {voucher.narration || "No narration specified."}
                  </p>
                </div>

                {/* Segregation of Duties Audit Card */}
                <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
                  <div className="flex items-center justify-between border-b border-slate-100 pb-2 mb-3">
                    <div className="flex items-center gap-2">
                      <ShieldCheck className="h-4 w-4 text-emerald-600" />
                      <h4 className="text-xs font-semibold text-slate-900">
                        Four-Eyes Segregation of Duties (SoD) Audit Trail
                      </h4>
                    </div>
                    <span className="text-[11px] text-slate-500">Maker ≠ Checker ≠ Poster</span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
                    {/* Maker */}
                    <div className="rounded-md border border-slate-100 bg-slate-50/50 p-2.5">
                      <span className="text-slate-500 text-[11px] block font-medium">Maker / Preparer</span>
                      <p className="font-semibold text-slate-800 mt-1 font-mono truncate">{voucher.created_by}</p>
                      <p className="text-[11px] text-slate-500 mt-0.5">
                        Created: {new Date(voucher.created_at).toLocaleString("en-IN")}
                      </p>
                      {voucher.submitted_at && (
                        <p className="text-[11px] text-blue-600 mt-0.5">
                          Submitted: {new Date(voucher.submitted_at).toLocaleTimeString("en-IN")}
                        </p>
                      )}
                    </div>

                    {/* Checker */}
                    <div className="rounded-md border border-slate-100 bg-slate-50/50 p-2.5">
                      <span className="text-slate-500 text-[11px] block font-medium">Checker / Approver</span>
                      {voucher.approved_by ? (
                        <>
                          <p className="font-semibold text-brand-navy mt-1 font-mono truncate">{voucher.approved_by}</p>
                          <p className="text-[11px] text-slate-500 mt-0.5">
                            Approved: {new Date(voucher.approved_at!).toLocaleString("en-IN")}
                          </p>
                        </>
                      ) : (
                        <p className="text-slate-400 italic mt-1 text-[11px]">
                          {voucher.status === "DRAFT" ? "Pending Submission" : "Awaiting Checker Approval"}
                        </p>
                      )}
                    </div>

                    {/* Poster */}
                    <div className="rounded-md border border-slate-100 bg-slate-50/50 p-2.5">
                      <span className="text-slate-500 text-[11px] block font-medium">Poster / GL Authority</span>
                      {voucher.posted_by ? (
                        <>
                          <p className="font-semibold text-emerald-700 mt-1 font-mono truncate">{voucher.posted_by}</p>
                          <p className="text-[11px] text-slate-500 mt-0.5">
                            Posted: {new Date(voucher.posted_at!).toLocaleString("en-IN")}
                          </p>
                          {detail.journal_entry && (
                            <p className="text-[11px] text-slate-600 font-mono mt-0.5">
                              JE #{detail.journal_entry.entry_no}
                            </p>
                          )}
                        </>
                      ) : (
                        <p className="text-slate-400 italic mt-1 text-[11px]">
                          {voucher.status === "APPROVED" ? "Awaiting Poster Action" : "Not Posted to GL"}
                        </p>
                      )}
                    </div>
                  </div>
                </div>

                {/* Journal Lines Tabs */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between border-b border-slate-200">
                    <div className="flex gap-2">
                      <button
                        onClick={() => setActiveTab("proposed")}
                        className={`border-b-2 px-3 py-2 text-xs font-semibold transition ${
                          activeTab === "proposed"
                            ? "border-brand-primary text-brand-primary"
                            : "border-transparent text-slate-500 hover:text-slate-700"
                        }`}
                      >
                        Proposed Lines Snapshot ({detail.proposed_lines.length})
                      </button>
                      <button
                        onClick={() => setActiveTab("posted")}
                        disabled={voucher.status !== "POSTED"}
                        className={`border-b-2 px-3 py-2 text-xs font-semibold transition ${
                          activeTab === "posted"
                            ? "border-emerald-600 text-emerald-600"
                            : voucher.status !== "POSTED"
                            ? "border-transparent text-slate-300 cursor-not-allowed"
                            : "border-transparent text-slate-500 hover:text-slate-700"
                        }`}
                      >
                        Authoritative GL Lines ({detail.posted_lines.length})
                      </button>
                    </div>
                    <span className="text-[11px] text-slate-500">All amounts in INR (₹)</span>
                  </div>

                  {/* Lines Table */}
                  <div className="rounded-lg border border-slate-200 overflow-hidden">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold">
                        <tr>
                          <th className="py-2.5 px-3 w-12 text-center">#</th>
                          <th className="py-2.5 px-3">Account</th>
                          <th className="py-2.5 px-3">Party Dimension</th>
                          <th className="py-2.5 px-3 text-right w-28">Debit (₹)</th>
                          <th className="py-2.5 px-3 text-right w-28">Credit (₹)</th>
                          <th className="py-2.5 px-3">Line Description</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 bg-white">
                        {activeTab === "proposed" ? (
                          detail.proposed_lines.map((line, idx) => (
                            <tr key={idx} className="hover:bg-slate-50/50">
                              <td className="py-2.5 px-3 text-center text-slate-400 font-mono">{idx + 1}</td>
                              <td className="py-2.5 px-3">
                                <div className="font-medium text-slate-800">
                                  {line.account_code ? (
                                    <span className="font-mono text-brand-primary mr-1.5">{line.account_code}</span>
                                  ) : null}
                                  {line.account_name || line.account_id}
                                </div>
                                {line.account_type && (
                                  <span className="text-[10px] text-slate-400 uppercase">{line.account_type}</span>
                                )}
                              </td>
                              <td className="py-2.5 px-3">
                                {line.customer_id ? (
                                  <span className="inline-flex items-center gap-1 rounded bg-blue-50 px-1.5 py-0.5 text-[11px] text-blue-700 border border-blue-200">
                                    Customer: {line.customer_name || line.customer_id}
                                  </span>
                                ) : line.supplier_id ? (
                                  <span className="inline-flex items-center gap-1 rounded bg-brand-gold-light px-1.5 py-0.5 text-[11px] text-brand-gold-dark border border-brand-gold/40">
                                    Supplier: {line.supplier_name || line.supplier_id}
                                  </span>
                                ) : (
                                  <span className="text-slate-400">—</span>
                                )}
                              </td>
                              <td className="py-2.5 px-3 text-right font-mono font-medium text-slate-800">
                                {Number(line.debit_amount) > 0 ? (
                                  `₹${Number(line.debit_amount).toFixed(2)}`
                                ) : (
                                  <span className="text-slate-300">—</span>
                                )}
                              </td>
                              <td className="py-2.5 px-3 text-right font-mono font-medium text-slate-800">
                                {Number(line.credit_amount) > 0 ? (
                                  `₹${Number(line.credit_amount).toFixed(2)}`
                                ) : (
                                  <span className="text-slate-300">—</span>
                                )}
                              </td>
                              <td className="py-2.5 px-3 text-slate-600">
                                {line.narration || <span className="text-slate-400 italic">None</span>}
                              </td>
                            </tr>
                          ))
                        ) : (
                          detail.posted_lines.map((line, idx) => (
                            <tr key={line.id || idx} className="hover:bg-slate-50/50">
                              <td className="py-2.5 px-3 text-center text-slate-400 font-mono">{idx + 1}</td>
                              <td className="py-2.5 px-3">
                                <span className="font-mono text-emerald-600 font-medium">
                                  {line.account_id}
                                </span>
                              </td>
                              <td className="py-2.5 px-3">
                                {line.customer_id ? (
                                  <span className="inline-flex items-center gap-1 rounded bg-blue-50 px-1.5 py-0.5 text-[11px] text-blue-700">
                                    Cus: {line.customer_id}
                                  </span>
                                ) : line.supplier_id ? (
                                  <span className="inline-flex items-center gap-1 rounded bg-brand-gold-light px-1.5 py-0.5 text-[11px] text-brand-gold-dark">
                                    Supp: {line.supplier_id}
                                  </span>
                                ) : (
                                  <span className="text-slate-400">—</span>
                                )}
                              </td>
                              <td className="py-2.5 px-3 text-right font-mono font-semibold text-slate-800">
                                {Number(line.debit_amount) > 0 ? (
                                  `₹${Number(line.debit_amount).toFixed(2)}`
                                ) : (
                                  <span className="text-slate-300">—</span>
                                )}
                              </td>
                              <td className="py-2.5 px-3 text-right font-mono font-semibold text-slate-800">
                                {Number(line.credit_amount) > 0 ? (
                                  `₹${Number(line.credit_amount).toFixed(2)}`
                                ) : (
                                  <span className="text-slate-300">—</span>
                                )}
                              </td>
                              <td className="py-2.5 px-3 text-slate-600">
                                {line.narration || <span className="text-slate-400 italic">None</span>}
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                      <tfoot className="bg-slate-50/80 border-t border-slate-200 font-semibold text-slate-800">
                        <tr>
                          <td colSpan={3} className="py-2.5 px-3 text-right">
                            Total:
                          </td>
                          <td className="py-2.5 px-3 text-right font-mono text-brand-navy">
                            ₹
                            {(activeTab === "proposed"
                              ? detail.proposed_lines.reduce((s, l) => s + Number(l.debit_amount || 0), 0)
                              : detail.posted_lines.reduce((s, l) => s + Number(l.debit_amount || 0), 0)
                            ).toFixed(2)}
                          </td>
                          <td className="py-2.5 px-3 text-right font-mono text-brand-navy">
                            ₹
                            {(activeTab === "proposed"
                              ? detail.proposed_lines.reduce((s, l) => s + Number(l.credit_amount || 0), 0)
                              : detail.posted_lines.reduce((s, l) => s + Number(l.credit_amount || 0), 0)
                            ).toFixed(2)}
                          </td>
                          <td></td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                </div>
              </>
            ) : null}
          </div>

          {/* Footer Action Controls */}
          {voucher && (
            <div className="flex items-center justify-between border-t border-slate-200 bg-slate-50/90 px-6 py-4">
              <div className="flex items-center gap-2">
                {/* Cancel Voucher Button for unposted vouchers */}
                {["DRAFT", "SUBMITTED", "APPROVED"].includes(voucher.status) && (
                  <button
                    type="button"
                    onClick={handleCancel}
                    disabled={actionLoading}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-red-200 bg-white px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50 transition disabled:opacity-50"
                  >
                    <Ban className="h-3.5 w-3.5" />
                    Cancel Voucher
                  </button>
                )}
              </div>

              <div className="flex items-center gap-2.5">
                {/* DRAFT Actions */}
                {voucher.status === "DRAFT" && (
                  <>
                    {onEditDraft && (
                      <button
                        type="button"
                        onClick={() => {
                          onEditDraft(voucher);
                          onClose();
                        }}
                        disabled={actionLoading}
                        className="rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 transition"
                      >
                        Edit Draft
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={handleSubmitDraft}
                      disabled={actionLoading}
                      className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-4 py-2 text-xs font-medium text-white shadow-sm hover:bg-blue-700 transition disabled:opacity-50"
                    >
                      {actionLoading ? "Submitting..." : (
                        <>
                          <Send className="h-3.5 w-3.5" />
                          Submit for Approval
                        </>
                      )}
                    </button>
                  </>
                )}

                {/* SUBMITTED Actions (Approval) */}
                {voucher.status === "SUBMITTED" && (
                  <button
                    type="button"
                    onClick={handleApprove}
                    disabled={actionLoading || isMaker}
                    title={isMaker ? "Maker cannot approve own voucher (SoD)" : "Approve Voucher"}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-brand-primary px-4 py-2 text-xs font-medium text-white shadow-sm hover:bg-brand-navy transition disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {actionLoading ? "Approving..." : (
                      <>
                        <Check className="h-3.5 w-3.5" />
                        Approve Voucher
                      </>
                    )}
                  </button>
                )}

                {/* APPROVED Actions (GL Posting) */}
                {voucher.status === "APPROVED" && (
                  <button
                    type="button"
                    onClick={handlePost}
                    disabled={actionLoading || isMaker}
                    title={isMaker ? "Maker cannot post own voucher to GL (SoD)" : "Commit Voucher to General Ledger"}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-4 py-2 text-xs font-medium text-white shadow-sm hover:bg-emerald-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {actionLoading ? "Posting to GL..." : (
                      <>
                        <CheckCircle2 className="h-3.5 w-3.5" />
                        Post to General Ledger
                      </>
                    )}
                  </button>
                )}

                {/* POSTED Actions (Reversal) */}
                {voucher.status === "POSTED" && !isReversed && (
                  <button
                    type="button"
                    onClick={() => setReverseModalOpen(true)}
                    disabled={actionLoading || isMaker}
                    title={isMaker ? "Creator cannot reverse own voucher (SoD)" : "Reverse this journal entry"}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-red-300 bg-white px-3.5 py-2 text-xs font-medium text-red-700 hover:bg-red-50 transition disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <RotateCcw className="h-3.5 w-3.5" />
                    Reverse Journal Entry
                  </button>
                )}

                <button
                  type="button"
                  onClick={onClose}
                  className="rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 transition"
                >
                  Close
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Reversal Confirmation Modal */}
      {reverseModalOpen && voucher && (
        <ManualJournalReverseModal
          voucher={voucher}
          currentUserId={currentUserId}
          isOpen={reverseModalOpen}
          onClose={() => setReverseModalOpen(false)}
          onSuccess={() => {
            fetchDetail();
            onStatusChanged?.();
          }}
        />
      )}
    </>
  );
}
