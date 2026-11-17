"use client";

import React, { useState, useEffect } from "react";
import {
  X,
  FileText,
  Calendar,
  Building2,
  Receipt,
  Clock,
  CheckCircle2,
  AlertTriangle,
  CreditCard,
  Bell,
  ArrowDownLeft,
  ChevronRight,
  ShieldCheck,
  Tag,
} from "lucide-react";

interface BillReceivableDetailModalProps {
  invoiceId: string;
  onClose: () => void;
  onOpenReceiptModal?: (bill: any) => void;
  onOpenReminderModal?: (invoiceId: string) => void;
}

export function BillReceivableDetailModal({
  invoiceId,
  onClose,
  onOpenReceiptModal,
  onOpenReminderModal,
}: BillReceivableDetailModalProps) {
  const [data, setData] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  useEffect(() => {
    async function loadDetail() {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`/api/v1/admin/bills-receivable/${invoiceId}`).then((r) => r.json());
        if (!res.success) {
          throw new Error(res.message || res.error || "Failed to load invoice details.");
        }
        setData(res.data);
      } catch (err: any) {
        setError(err.message || "Failed to load detail");
      } finally {
        setLoading(false);
      }
    }
    loadDetail();
  }, [invoiceId]);

  if (loading) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
        <div className="w-full max-w-3xl p-8 bg-white dark:bg-slate-900 rounded-2xl shadow-2xl flex flex-col items-center justify-center gap-3">
          <div className="w-8 h-8 border-3 border-brand-primary border-t-transparent rounded-full animate-spin" />
          <p className="text-sm text-slate-500">Loading statutory invoice & accounting subledger...</p>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
        <div className="w-full max-w-md p-6 bg-white dark:bg-slate-900 rounded-2xl shadow-2xl space-y-4">
          <div className="text-red-600 font-bold">Error Loading Invoice</div>
          <p className="text-sm text-slate-600 dark:text-slate-400">{error || "Invoice not found"}</p>
          <button
            onClick={onClose}
            className="w-full py-2 bg-slate-100 dark:bg-slate-800 rounded-xl text-sm font-semibold"
          >
            Close
          </button>
        </div>
      </div>
    );
  }

  const { invoice, gst_breakdown, items, voucher, journal_entry, receipt_allocations, credit_notes } = data;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
      <div className="relative w-full max-w-4xl bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-brand-primary/10 text-brand-primary dark:text-brand-primary">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-bold text-slate-900 dark:text-white">
                  {invoice.invoice_number}
                </h2>
                <span
                  className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                    invoice.status === "FULLY_RECEIVED"
                      ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-400"
                      : invoice.status === "PARTIALLY_RECEIVED"
                      ? "bg-brand-gold-light text-brand-gold-dark dark:bg-brand-gold-dark/40 dark:text-brand-gold"
                      : invoice.status === "OVERDUE"
                      ? "bg-rose-100 text-rose-800 dark:bg-rose-900/40 dark:text-rose-400"
                      : "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-400"
                  }`}
                >
                  {invoice.status.replace("_", " ")}
                </span>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400">
                  {invoice.ageing_bucket}
                </span>
              </div>
              <p className="text-xs text-slate-500">
                Order: <span className="font-semibold text-slate-700 dark:text-slate-300">{invoice.order_id || "N/A"}</span> • Customer: <span className="font-semibold text-slate-700 dark:text-slate-300">{invoice.customer_name}</span>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {onOpenReminderModal && invoice.outstanding_amount > 0 && (
              <button
                onClick={() => onOpenReminderModal(invoice.invoice_id)}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-brand-primary dark:text-brand-primary bg-brand-light dark:bg-brand-navy/40 hover:bg-brand-light dark:hover:bg-brand-navy/40 rounded-xl transition-colors"
              >
                <Bell className="w-3.5 h-3.5" />
                <span>Schedule Reminder</span>
              </button>
            )}
            {onOpenReceiptModal && invoice.outstanding_amount > 0 && (
              <button
                onClick={() => onOpenReceiptModal(invoice)}
                className="flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl shadow-xs transition-colors"
              >
                <CreditCard className="w-3.5 h-3.5" />
                <span>Receive Payment</span>
              </button>
            )}
            <button
              onClick={onClose}
              aria-label="Close"
              className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1">
          {/* Key Metric Summary Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800">
              <span className="text-[11px] font-semibold text-slate-500">Invoice Total</span>
              <div className="text-base font-bold text-slate-900 dark:text-white">
                ₹{invoice.total_amount.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
              </div>
            </div>
            <div className="p-3 rounded-xl bg-emerald-50/50 dark:bg-emerald-950/20 border border-emerald-200/50 dark:border-emerald-900/30">
              <span className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400">Paid Collections</span>
              <div className="text-base font-bold text-emerald-700 dark:text-emerald-300">
                ₹{invoice.paid_amount.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
              </div>
            </div>
            <div className="p-3 rounded-xl bg-brand-light/50 dark:bg-brand-navy/20 border border-brand-primary/50 dark:border-brand-navy/30">
              <span className="text-[11px] font-semibold text-brand-primary dark:text-brand-primary">Credit Notes / Returns</span>
              <div className="text-base font-bold text-brand-navy dark:text-brand-primary/30">
                ₹{invoice.returns_amount.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
              </div>
            </div>
            <div className="p-3 rounded-xl bg-brand-gold-light/50 dark:bg-brand-gold-dark/20 border border-brand-gold/50 dark:border-brand-gold-dark/30">
              <span className="text-[11px] font-semibold text-brand-gold dark:text-brand-gold">Open Outstanding AR</span>
              <div className="text-base font-bold text-brand-gold-dark dark:text-brand-gold/40">
                ₹{invoice.outstanding_amount.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
              </div>
            </div>
          </div>

          {/* Statutory & GST Information */}
          <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/20 space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 flex items-center gap-2">
              <Tag className="w-4 h-4 text-brand-primary" />
              Statutory GST Breakdown
            </h3>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
              <div>
                <span className="text-slate-500">Taxable Value:</span>{" "}
                <span className="font-semibold text-slate-900 dark:text-white">
                  ₹{gst_breakdown.taxable_value.toFixed(2)}
                </span>
              </div>
              {gst_breakdown.is_intra_state ? (
                <>
                  <div>
                    <span className="text-slate-500">CGST:</span>{" "}
                    <span className="font-semibold text-slate-900 dark:text-white">
                      ₹{gst_breakdown.cgst.toFixed(2)}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-500">SGST:</span>{" "}
                    <span className="font-semibold text-slate-900 dark:text-white">
                      ₹{gst_breakdown.sgst.toFixed(2)}
                    </span>
                  </div>
                </>
              ) : (
                <div>
                  <span className="text-slate-500">IGST:</span>{" "}
                  <span className="font-semibold text-slate-900 dark:text-white">
                    ₹{gst_breakdown.igst.toFixed(2)}
                  </span>
                </div>
              )}
              <div>
                <span className="text-slate-500">Customer GSTIN:</span>{" "}
                <span className="font-semibold text-slate-900 dark:text-white">
                  {gst_breakdown.gstin || "Unregistered"}
                </span>
              </div>
              <div>
                <span className="text-slate-500">Due Date:</span>{" "}
                <span className="font-semibold text-slate-900 dark:text-white">
                  {invoice.due_date} ({invoice.payment_terms_days} days)
                </span>
              </div>
            </div>
          </div>

          {/* Line Items Table */}
          {items && items.length > 0 && (
            <div className="space-y-2">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                Merchandise Line Items ({items.length})
              </h3>
              <div className="rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
                    <tr>
                      <th className="p-2.5">Description</th>
                      <th className="p-2.5 text-right">Qty</th>
                      <th className="p-2.5 text-right">Rate</th>
                      <th className="p-2.5 text-right">Taxable</th>
                      <th className="p-2.5 text-right">Tax</th>
                      <th className="p-2.5 text-right">Total</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                    {items.map((it: any, idx: number) => (
                      <tr key={idx} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                        <td className="p-2.5 font-medium text-slate-900 dark:text-white">
                          {it.description}
                        </td>
                        <td className="p-2.5 text-right text-slate-600 dark:text-slate-400">{it.quantity}</td>
                        <td className="p-2.5 text-right text-slate-600 dark:text-slate-400">₹{it.rate?.toFixed(2)}</td>
                        <td className="p-2.5 text-right text-slate-600 dark:text-slate-400">₹{it.taxable_value?.toFixed(2)}</td>
                        <td className="p-2.5 text-right text-slate-600 dark:text-slate-400">
                          ₹{(Number(it.cgst || 0) + Number(it.sgst || 0) + Number(it.igst || 0)).toFixed(2)}
                        </td>
                        <td className="p-2.5 text-right font-bold text-slate-900 dark:text-white">₹{it.total?.toFixed(2)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Double-Entry GL Journal Entry Drill-down */}
          {journal_entry && journal_entry.lines && (
            <div className="space-y-2">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4 text-emerald-500" />
                General Ledger Posting ({journal_entry.lines.length} lines)
              </h3>
              <div className="rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
                    <tr>
                      <th className="p-2.5">Line</th>
                      <th className="p-2.5">Narration</th>
                      <th className="p-2.5 text-right">Debit (Dr)</th>
                      <th className="p-2.5 text-right">Credit (Cr)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                    {journal_entry.lines.map((l: any, idx: number) => (
                      <tr key={idx}>
                        <td className="p-2.5 text-slate-500 font-mono text-[11px]">{l.line_no}</td>
                        <td className="p-2.5 text-slate-900 dark:text-white">{l.narration}</td>
                        <td className="p-2.5 text-right font-semibold text-emerald-600 dark:text-emerald-400">
                          {Number(l.debit_amount) > 0 ? `₹${Number(l.debit_amount).toFixed(2)}` : "-"}
                        </td>
                        <td className="p-2.5 text-right font-semibold text-blue-600 dark:text-blue-400">
                          {Number(l.credit_amount) > 0 ? `₹${Number(l.credit_amount).toFixed(2)}` : "-"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Receipt Allocations History */}
          <div className="space-y-2">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
              <CreditCard className="w-4 h-4 text-emerald-500" />
              Allocated Receipts ({receipt_allocations?.length || 0})
            </h3>
            {(!receipt_allocations || receipt_allocations.length === 0) ? (
              <div className="p-4 rounded-xl border border-dashed border-slate-200 dark:border-slate-800 text-center text-xs text-slate-500">
                No receipts recorded against this invoice yet.
              </div>
            ) : (
              <div className="rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden divide-y divide-slate-200 dark:divide-slate-800 text-xs">
                {receipt_allocations.map((rcpt: any) => (
                  <div key={rcpt.allocation_id} className="p-3 flex items-center justify-between gap-3">
                    <div>
                      <div className="font-semibold text-slate-900 dark:text-white">
                        Voucher: {rcpt.voucher_no || rcpt.voucher_id} • {rcpt.payment_method}
                      </div>
                      <div className="text-slate-500 text-[11px]">
                        Date: {rcpt.receipt_date} • Ref/UTR:{" "}
                        <span className="font-mono text-slate-700 dark:text-slate-300">
                          {rcpt.reference || "None"}
                        </span>{" "}
                        • Bank: {rcpt.bank_name || "Main Bank"}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-bold text-emerald-600 dark:text-emerald-400">
                        ₹{rcpt.amount.toFixed(2)}
                      </div>
                      <div className="text-[10px] text-slate-400">By {rcpt.created_by}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
