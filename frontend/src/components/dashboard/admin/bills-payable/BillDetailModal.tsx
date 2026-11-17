"use client";

import React, { useEffect, useState } from "react";
import {
  X,
  Building2,
  Calendar,
  CreditCard,
  FileText,
  AlertCircle,
  Clock,
  CheckCircle2,
  Receipt,
  User,
  ArrowRight,
  ExternalLink,
} from "lucide-react";

interface BillDetailModalProps {
  purchaseId: string | null;
  onClose: () => void;
  onOpenPay?: (bill: any) => void;
}

export function BillDetailModal({
  purchaseId,
  onClose,
  onOpenPay,
}: BillDetailModalProps) {
  const [data, setData] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!purchaseId) return;
    setLoading(true);
    setError(null);

    fetch(`/api/v1/admin/bills-payable/${purchaseId}`)
      .then(async (res) => {
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          throw new Error(err.error || "Failed to load bill details");
        }
        return res.json();
      })
      .then((res) => {
        setData(res);
        setLoading(false);
      })
      .catch((err) => {
        setError(err.message);
        setLoading(false);
      });
  }, [purchaseId]);

  if (!purchaseId) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="relative w-full max-w-4xl max-h-[90vh] flex flex-col bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/60">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-brand-light text-brand-primary dark:bg-brand-navy/60 dark:text-brand-primary">
              <Receipt className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
                  Bill #{data?.bill?.invoice_no || purchaseId}
                </h2>
                {data?.bill?.status && (
                  <span
                    className={`px-2 py-0.5 text-xs font-medium rounded-full ${
                      data.bill.status === "PAID"
                        ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-400"
                        : data.bill.status === "OVERDUE"
                        ? "bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-400"
                        : data.bill.status === "PARTIALLY_PAID"
                        ? "bg-brand-gold-light text-brand-gold-dark dark:bg-brand-gold-dark/60 dark:text-brand-gold"
                        : "bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300"
                    }`}
                  >
                    {data.bill.status.replace("_", " ")}
                  </span>
                )}
              </div>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
                Supplier: <span className="font-medium text-zinc-700 dark:text-zinc-300">{data?.bill?.supplier_name}</span>
                {data?.bill?.supplier_gstin && ` • GSTIN: ${data.bill.supplier_gstin}`}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {loading && (
            <div className="flex items-center justify-center py-16 text-zinc-500">
              <Clock className="w-5 h-5 animate-spin mr-2" />
              <span>Loading bill financial details...</span>
            </div>
          )}

          {error && (
            <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 dark:bg-rose-950/40 dark:border-rose-900/60 dark:text-rose-300 text-sm flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {!loading && data && (
            <>
              {/* Financial Snapshot Grid */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div className="p-3.5 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-800/40">
                  <span className="text-xs text-zinc-500 dark:text-zinc-400">Total Billed</span>
                  <p className="text-lg font-bold text-zinc-900 dark:text-zinc-100 mt-0.5">
                    ₹{Number(data.bill.total).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                  </p>
                </div>
                <div className="p-3.5 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-emerald-50/40 dark:bg-emerald-950/20">
                  <span className="text-xs text-emerald-700 dark:text-emerald-400 font-medium">Paid Amount</span>
                  <p className="text-lg font-bold text-emerald-700 dark:text-emerald-400 mt-0.5">
                    ₹{Number(data.bill.paid_amount).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                  </p>
                </div>
                <div className="p-3.5 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-brand-gold-light/40 dark:bg-brand-gold-dark/20">
                  <span className="text-xs text-brand-gold-dark dark:text-brand-gold font-medium">Debit Notes / Ret</span>
                  <p className="text-lg font-bold text-brand-gold-dark dark:text-brand-gold mt-0.5">
                    ₹{Number(data.bill.returns_amount).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                  </p>
                </div>
                <div className="p-3.5 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-brand-light/40 dark:bg-brand-navy/20">
                  <span className="text-xs text-brand-navy dark:text-brand-primary font-medium">Balance Outstanding</span>
                  <p className="text-lg font-bold text-brand-navy dark:text-brand-primary mt-0.5">
                    ₹{Number(data.bill.outstanding_amount).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                  </p>
                </div>
              </div>

              {/* Bill Details Metadata */}
              <div className="p-4 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 grid grid-cols-2 md:grid-cols-4 gap-4 text-xs">
                <div>
                  <span className="text-zinc-400 block mb-0.5">Invoice Date</span>
                  <span className="font-medium text-zinc-800 dark:text-zinc-200">
                    {data.bill.invoice_date ? new Date(data.bill.invoice_date).toLocaleDateString("en-IN") : "—"}
                  </span>
                </div>
                <div>
                  <span className="text-zinc-400 block mb-0.5">Due Date</span>
                  <span
                    className={`font-medium ${
                      data.bill.is_overdue ? "text-rose-600 font-semibold" : "text-zinc-800 dark:text-zinc-200"
                    }`}
                  >
                    {data.bill.due_date ? new Date(data.bill.due_date).toLocaleDateString("en-IN") : "Immediate"}
                    {data.bill.is_overdue && ` (${data.bill.days_overdue}d overdue)`}
                  </span>
                </div>
                <div>
                  <span className="text-zinc-400 block mb-0.5">Operating Branch</span>
                  <span className="font-medium text-zinc-800 dark:text-zinc-200">{data.bill.branch_name}</span>
                </div>
                <div>
                  <span className="text-zinc-400 block mb-0.5">Linked GL Voucher</span>
                  {data.bill.voucher_no ? (
                    <span className="inline-flex items-center gap-1 font-mono font-medium text-brand-primary dark:text-brand-primary">
                      {data.bill.voucher_no}
                    </span>
                  ) : (
                    <span className="text-zinc-400 font-mono italic">None</span>
                  )}
                </div>
              </div>

              {/* Line Items Table */}
              <div>
                <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 mb-2">
                  Invoice Line Items ({data.items?.length || 0})
                </h3>
                <div className="border border-zinc-200 dark:border-zinc-800 rounded-xl overflow-hidden">
                  <table className="w-full text-xs text-left">
                    <thead className="bg-zinc-50 dark:bg-zinc-800/60 text-zinc-500 border-b border-zinc-200 dark:border-zinc-800">
                      <tr>
                        <th className="py-2.5 px-3">Item / Description</th>
                        <th className="py-2.5 px-3 text-right">Quantity</th>
                        <th className="py-2.5 px-3 text-right">Unit Price</th>
                        <th className="py-2.5 px-3 text-right">Tax Rate</th>
                        <th className="py-2.5 px-3 text-right">Line Total</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
                      {data.items?.map((item: any) => (
                        <tr key={item.id} className="hover:bg-zinc-50/50 dark:hover:bg-zinc-800/40">
                          <td className="py-2.5 px-3 font-medium text-zinc-800 dark:text-zinc-200">
                            {item.item_name}
                          </td>
                          <td className="py-2.5 px-3 text-right text-zinc-600 dark:text-zinc-400">{item.quantity}</td>
                          <td className="py-2.5 px-3 text-right text-zinc-600 dark:text-zinc-400">
                            ₹{Number(item.unit_price).toFixed(2)}
                          </td>
                          <td className="py-2.5 px-3 text-right text-zinc-600 dark:text-zinc-400">
                            {item.tax_rate ? `${item.tax_rate}%` : "0%"}
                          </td>
                          <td className="py-2.5 px-3 text-right font-medium text-zinc-900 dark:text-zinc-100">
                            ₹{Number(item.total_price).toFixed(2)}
                          </td>
                        </tr>
                      ))}
                      {(!data.items || data.items.length === 0) && (
                        <tr>
                          <td colSpan={5} className="py-4 text-center text-zinc-400 italic">
                            No individual items listed.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Payment Settlement History */}
              <div>
                <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 mb-2">
                  Disbursement History ({data.payments?.length || 0})
                </h3>
                {data.payments && data.payments.length > 0 ? (
                  <div className="border border-zinc-200 dark:border-zinc-800 rounded-xl overflow-hidden">
                    <table className="w-full text-xs text-left">
                      <thead className="bg-zinc-50 dark:bg-zinc-800/60 text-zinc-500 border-b border-zinc-200 dark:border-zinc-800">
                        <tr>
                          <th className="py-2.5 px-3">Date</th>
                          <th className="py-2.5 px-3">Method</th>
                          <th className="py-2.5 px-3">Reference / UTR</th>
                          <th className="py-2.5 px-3">GL Voucher</th>
                          <th className="py-2.5 px-3 text-right">Allocated Amount</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
                        {data.payments.map((p: any) => (
                          <tr key={p.id} className="hover:bg-zinc-50/50 dark:hover:bg-zinc-800/40">
                            <td className="py-2.5 px-3 text-zinc-700 dark:text-zinc-300">
                              {p.payment_date ? new Date(p.payment_date).toLocaleDateString("en-IN") : "—"}
                            </td>
                            <td className="py-2.5 px-3 font-medium text-zinc-800 dark:text-zinc-200">
                              <span className="px-2 py-0.5 rounded text-[11px] bg-zinc-100 dark:bg-zinc-800">
                                {p.method}
                              </span>
                            </td>
                            <td className="py-2.5 px-3 font-mono text-zinc-600 dark:text-zinc-400">
                              {p.reference || "—"}
                            </td>
                            <td className="py-2.5 px-3 font-mono text-brand-primary dark:text-brand-primary">
                              {p.voucher_no || p.voucher_id || "—"}
                            </td>
                            <td className="py-2.5 px-3 text-right font-semibold text-emerald-600 dark:text-emerald-400">
                              ₹{Number(p.allocated_amount || p.amount).toFixed(2)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="p-4 rounded-xl border border-dashed border-zinc-200 dark:border-zinc-800 text-center text-xs text-zinc-400">
                    No disbursement payments recorded yet against this bill.
                  </div>
                )}
              </div>
            </>
          )}
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/60">
          <button
            onClick={onClose}
            className="px-4 py-2 text-xs font-medium text-zinc-700 dark:text-zinc-300 hover:bg-zinc-200/60 dark:hover:bg-zinc-800 rounded-xl transition"
          >
            Close
          </button>
          {data?.bill?.outstanding_amount > 0 && onOpenPay && (
            <button
              onClick={() => {
                onClose();
                onOpenPay(data.bill);
              }}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-brand-primary hover:bg-brand-navy rounded-xl shadow-sm transition"
            >
              <span>Disburse Payment (₹{Number(data.bill.outstanding_amount).toFixed(2)})</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
