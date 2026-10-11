"use client";

import React from "react";
import {
  Eye,
  Edit2,
  Check,
  CheckCircle2,
  RotateCcw,
  Ban,
  FileText,
  ChevronLeft,
  ChevronRight,
  ArrowRight,
  ShieldAlert,
} from "lucide-react";
import type { ManualJournalListItem } from "./types";
import type { VoucherStatus } from "@frontend/lib/types/accounting.types";

interface ManualJournalListTableProps {
  journals: ManualJournalListItem[];
  loading: boolean;
  total: number;
  page: number;
  limit: number;
  onPageChange: (page: number) => void;
  onViewDetail: (voucherId: string) => void;
  onEditDraft: (item: ManualJournalListItem) => void;
  currentUserId?: string;
}

export function ManualJournalListTable({
  journals,
  loading,
  total,
  page,
  limit,
  onPageChange,
  onViewDetail,
  onEditDraft,
  currentUserId,
}: ManualJournalListTableProps) {
  const totalPages = Math.max(1, Math.ceil(total / limit));

  // Render Status Badge
  const renderStatusBadge = (status: VoucherStatus | string) => {
    switch (status) {
      case "DRAFT":
        return (
          <span className="inline-flex items-center rounded-md bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-700">
            DRAFT
          </span>
        );
      case "SUBMITTED":
        return (
          <span className="inline-flex items-center rounded-md bg-blue-50 px-2 py-0.5 text-[11px] font-semibold text-blue-700 border border-blue-200">
            SUBMITTED
          </span>
        );
      case "APPROVED":
        return (
          <span className="inline-flex items-center rounded-md bg-indigo-50 px-2 py-0.5 text-[11px] font-semibold text-indigo-700 border border-indigo-200">
            APPROVED
          </span>
        );
      case "POSTED":
        return (
          <span className="inline-flex items-center rounded-md bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-700 border border-emerald-200">
            POSTED
          </span>
        );
      case "CANCELLED":
        return (
          <span className="inline-flex items-center rounded-md bg-rose-50 px-2 py-0.5 text-[11px] font-semibold text-rose-700 border border-rose-200">
            CANCELLED
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center rounded-md bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-700">
            {status}
          </span>
        );
    }
  };

  return (
    <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs">
          <thead className="border-b border-slate-200 bg-slate-50/75 text-slate-600 font-semibold">
            <tr>
              <th className="py-3 px-4">Voucher No</th>
              <th className="py-3 px-4">Date</th>
              <th className="py-3 px-4">Branch</th>
              <th className="py-3 px-4">Narration</th>
              <th className="py-3 px-4 text-center">Status</th>
              <th className="py-3 px-4 text-right">Amount (₹)</th>
              <th className="py-3 px-4 text-center">Lines</th>
              <th className="py-3 px-4 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 bg-white">
            {loading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <tr key={i} className="animate-pulse">
                  <td className="py-3.5 px-4"><div className="h-4 w-32 bg-slate-200 rounded" /></td>
                  <td className="py-3.5 px-4"><div className="h-4 w-20 bg-slate-200 rounded" /></td>
                  <td className="py-3.5 px-4"><div className="h-4 w-24 bg-slate-200 rounded" /></td>
                  <td className="py-3.5 px-4"><div className="h-4 w-48 bg-slate-200 rounded" /></td>
                  <td className="py-3.5 px-4 text-center"><div className="h-4 w-16 bg-slate-200 rounded mx-auto" /></td>
                  <td className="py-3.5 px-4 text-right"><div className="h-4 w-20 bg-slate-200 rounded ml-auto" /></td>
                  <td className="py-3.5 px-4 text-center"><div className="h-4 w-8 bg-slate-200 rounded mx-auto" /></td>
                  <td className="py-3.5 px-4 text-right"><div className="h-4 w-16 bg-slate-200 rounded ml-auto" /></td>
                </tr>
              ))
            ) : journals.length === 0 ? (
              <tr>
                <td colSpan={8} className="py-12 text-center text-slate-500">
                  <FileText className="h-8 w-8 text-slate-300 mx-auto mb-2" />
                  <p className="font-medium text-slate-700">No manual journals found</p>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    Try adjusting your filters or click &ldquo;+ New Manual Journal&rdquo; to create a draft voucher.
                  </p>
                </td>
              </tr>
            ) : (
              journals.map((j) => {
                const isReversed = Boolean(j.reversed_by_voucher_id || (j.metadata as any)?.is_reversed);
                const isReversal = Boolean(j.reversal_of_voucher_id || j.reference_type === "MANUAL_REVERSAL");

                return (
                  <tr key={j.id} className="hover:bg-slate-50/75 transition group">
                    {/* Voucher No & Badges */}
                    <td className="py-3 px-4 font-mono font-medium text-slate-900">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <button
                          onClick={() => onViewDetail(j.id)}
                          className="text-indigo-600 hover:text-indigo-800 hover:underline transition font-semibold"
                        >
                          {j.voucher_no}
                        </button>
                        {isReversed && (
                          <span className="inline-flex items-center rounded bg-amber-50 px-1.5 py-0.2 text-[10px] font-medium text-amber-700 border border-amber-200">
                            Reversed
                          </span>
                        )}
                        {isReversal && (
                          <span className="inline-flex items-center rounded bg-purple-50 px-1.5 py-0.2 text-[10px] font-medium text-purple-700 border border-purple-200">
                            Reversal
                          </span>
                        )}
                      </div>
                    </td>

                    {/* Date */}
                    <td className="py-3 px-4 text-slate-600 whitespace-nowrap">
                      {new Date(j.voucher_date).toLocaleDateString("en-IN", {
                        day: "2-digit",
                        month: "short",
                        year: "numeric",
                      })}
                    </td>

                    {/* Branch */}
                    <td className="py-3 px-4 text-slate-700">
                      <span className="font-medium truncate block max-w-[130px]" title={j.branch_name || j.branch_id}>
                        {j.branch_name || j.branch_id}
                      </span>
                    </td>

                    {/* Narration */}
                    <td className="py-3 px-4 text-slate-600">
                      <span className="line-clamp-1 max-w-[240px]" title={j.narration || ""}>
                        {j.narration || <span className="text-slate-300 italic">No narration</span>}
                      </span>
                    </td>

                    {/* Status */}
                    <td className="py-3 px-4 text-center">
                      {renderStatusBadge(j.status)}
                    </td>

                    {/* Total Amount (₹) */}
                    <td className="py-3 px-4 text-right font-mono font-semibold text-slate-800 whitespace-nowrap">
                      ₹{Number(j.total_amount).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                    </td>

                    {/* Lines Count */}
                    <td className="py-3 px-4 text-center">
                      <span className="inline-flex items-center rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-mono font-medium text-slate-600">
                        {j.line_count || ((j.metadata as any)?.lines?.length) || 2} lines
                      </span>
                    </td>

                    {/* Actions */}
                    <td className="py-3 px-4 text-right whitespace-nowrap">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          type="button"
                          onClick={() => onViewDetail(j.id)}
                          title="View Voucher Details & Audit Trail"
                          className="rounded p-1 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 transition"
                        >
                          <Eye className="h-4 w-4" />
                        </button>

                        {j.status === "DRAFT" && (
                          <button
                            type="button"
                            onClick={() => onEditDraft(j)}
                            title="Edit Draft Voucher"
                            className="rounded p-1 text-slate-400 hover:text-blue-600 hover:bg-blue-50 transition"
                          >
                            <Edit2 className="h-4 w-4" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination Footer */}
      <div className="flex items-center justify-between border-t border-slate-200 bg-slate-50/75 px-4 py-3 text-xs text-slate-600">
        <div>
          Showing{" "}
          <span className="font-semibold text-slate-800">
            {journals.length === 0 ? 0 : (page - 1) * limit + 1}
          </span>{" "}
          to{" "}
          <span className="font-semibold text-slate-800">
            {Math.min(page * limit, total)}
          </span>{" "}
          of <span className="font-semibold text-slate-800">{total}</span> vouchers
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => onPageChange(page - 1)}
            disabled={page <= 1 || loading}
            className="inline-flex items-center gap-1 rounded border border-slate-200 bg-white px-2.5 py-1 font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition"
          >
            <ChevronLeft className="h-3.5 w-3.5" />
            Previous
          </button>
          <span className="font-mono text-slate-700">
            Page {page} of {totalPages}
          </span>
          <button
            type="button"
            onClick={() => onPageChange(page + 1)}
            disabled={page >= totalPages || loading}
            className="inline-flex items-center gap-1 rounded border border-slate-200 bg-white px-2.5 py-1 font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition"
          >
            Next
            <ChevronRight className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}
