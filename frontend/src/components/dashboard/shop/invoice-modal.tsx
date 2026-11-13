"use client";

import React, { useEffect, useState } from "react";
import { fetchBranchOrderInvoice } from "@frontend/lib/data/manager";

interface InvoiceModalProps {
  orderId: string | null;
  isOpen: boolean;
  onClose: () => void;
}

export default function InvoiceModal({ orderId, isOpen, onClose }: InvoiceModalProps) {
  const [invoice, setInvoice] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen && orderId) {
      setLoading(true);
      setErrorMessage(null);
      setInvoice(null);
      fetchBranchOrderInvoice(orderId)
        .then((res: any) => {
          if (res.success && res.invoice) {
            setInvoice(res.invoice);
          } else {
            setErrorMessage(res.error || res.message || "Tax invoice not committed for this order.");
          }
        })
        .catch((err: any) => {
          setErrorMessage(err.message || "Failed to load authoritative invoice.");
        })
        .finally(() => setLoading(false));
    }
  }, [isOpen, orderId]);

  if (!isOpen || !orderId) return null;

  const isTestMode = invoice?.is_test || invoice?.test_watermark || String(invoice?.branch_fssai || "").includes("TEST");

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white dark:bg-zinc-900 w-full max-w-xl rounded-2xl shadow-2xl border border-zinc-200 dark:border-zinc-800 overflow-hidden relative">
        {/* Modal Top Bar */}
        <div className="p-4 bg-zinc-900 text-white flex justify-between items-center print:hidden">
          <div className="flex items-center gap-2">
            <span className="text-lg">🧾</span>
            <h3 className="font-bold text-sm">Official GST Tax Invoice</h3>
          </div>
          <div className="flex gap-2">
            {invoice && (
              <button
                onClick={() => window.print()}
                className="px-3 py-1 bg-rose-600 hover:bg-rose-700 text-xs font-bold rounded-lg transition"
              >
                Print Invoice
              </button>
            )}
            <button onClick={onClose} className="p-1 text-zinc-400 hover:text-white">
              ✕
            </button>
          </div>
        </div>

        {/* Visible Test Watermark Banner in Test Mode */}
        {isTestMode && (
          <div className="bg-amber-500 text-black font-extrabold text-center py-1.5 px-4 text-xs uppercase tracking-widest border-b border-amber-600 print:block shadow-inner" id="shop-invoice-test-banner">
            ⚠️ TEST — NOT A VALID TAX INVOICE (SYNTHETIC FIXTURE — NOT FOR STATUTORY FILING)
          </div>
        )}

        {/* Printable GST Invoice Body */}
        {loading ? (
          <div className="p-8 text-center text-zinc-500 text-sm">Loading Authoritative Tax Invoice...</div>
        ) : invoice ? (
          <div className="p-8 text-zinc-900 dark:text-zinc-100 text-xs space-y-6 bg-white dark:bg-zinc-900 print:p-0 print:text-black">
            {/* Header */}
            <div className="flex justify-between items-start border-b border-zinc-200 dark:border-zinc-800 pb-4">
              <div>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src="/assets/brand/caketo-home-logo-navy.png"
                  alt="CakeToHome"
                  className="h-9 w-auto object-contain mb-1.5 print:block dark:hidden"
                />
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src="/assets/brand/caketo-home-logo-white.png"
                  alt="CakeToHome"
                  className="h-9 w-auto object-contain mb-1.5 hidden dark:block print:hidden"
                />
                <p className="text-[11px] text-zinc-600 dark:text-zinc-300 font-semibold">{invoice.branch_name || "CakeToHome Kitchen Hub"}</p>
                <p className="text-[10px] text-zinc-400">GSTIN: {invoice.branch_gstin || "UNVERIFIED_GSTIN"}</p>
                <p className="text-[10px] text-zinc-400">FSSAI Lic No: {invoice.branch_fssai || "UNVERIFIED_FSSAI"}</p>
              </div>
              <div className="text-right">
                <span className="px-2.5 py-1 bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 font-bold rounded text-[10px] uppercase">
                  Tax Invoice
                </span>
                <p className="font-bold text-sm text-zinc-900 dark:text-white mt-1">{invoice.invoice_number}</p>
                <p className="text-[10px] text-zinc-400">Order: #{invoice.order_number}</p>
                <p className="text-[10px] text-zinc-400">{invoice.invoice_date ? new Date(invoice.invoice_date).toLocaleDateString("en-IN") : "—"}</p>
              </div>
            </div>

            {/* Bill To */}
            <div className="grid grid-cols-2 gap-4 p-3 bg-zinc-50 dark:bg-zinc-950/60 rounded-xl border border-zinc-200 dark:border-zinc-800">
              <div>
                <p className="font-bold text-[10px] text-zinc-400 uppercase">Customer Bill To:</p>
                <p className="font-semibold text-zinc-900 dark:text-white text-sm">{invoice.customer?.name || "—"}</p>
                <p className="text-zinc-600 dark:text-zinc-400">
                  {typeof invoice.customer?.delivery_address === "string"
                    ? invoice.customer?.delivery_address
                    : (invoice.customer?.delivery_address && typeof invoice.customer?.delivery_address === "object"
                        ? [
                            (invoice.customer.delivery_address as any).line1 || (invoice.customer.delivery_address as any).address_1,
                            (invoice.customer.delivery_address as any).line2 || (invoice.customer.delivery_address as any).address_2,
                            (invoice.customer.delivery_address as any).landmark,
                            (invoice.customer.delivery_address as any).city,
                            (invoice.customer.delivery_address as any).pincode,
                          ].filter(Boolean).join(", ")
                        : "—")}
                </p>
              </div>
              <div>
                <p className="font-bold text-[10px] text-zinc-400 uppercase">Payment Details:</p>
                <p className="font-semibold text-emerald-600 dark:text-emerald-400">{invoice.payment?.method || "—"}</p>
                <p className="text-zinc-500">Status: <b className="text-zinc-800 dark:text-zinc-200 uppercase">{invoice.payment?.status || "PENDING"}</b></p>
                <p className="text-[10px] text-zinc-400 font-mono mt-1">Txn: {invoice.payment?.transaction_id || "—"}</p>
              </div>
            </div>

            {/* Line Items Table */}
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-zinc-300 dark:border-zinc-700 text-[10px] font-bold text-zinc-500 uppercase">
                  <th className="pb-2">Description</th>
                  <th className="pb-2 text-center">HSN</th>
                  <th className="pb-2 text-center">Qty</th>
                  <th className="pb-2 text-right">Taxable</th>
                  <th className="pb-2 text-right">GST</th>
                  <th className="pb-2 text-right">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
                {(invoice.items || []).map((item: any, i: number) => (
                  <tr key={i} className="py-2">
                    <td className="py-2.5 font-medium">{item.description}</td>
                    <td className="py-2.5 text-center font-mono text-[10px]">{item.hsn_sac}</td>
                    <td className="py-2.5 text-center">{item.quantity}</td>
                    <td className="py-2.5 text-right">₹{Number(item.taxable_amount || 0).toLocaleString("en-IN")}</td>
                    <td className="py-2.5 text-right">5%</td>
                    <td className="py-2.5 text-right font-bold">₹{Number(item.total || 0).toLocaleString("en-IN")}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* Totals */}
            <div className="border-t border-zinc-300 dark:border-zinc-700 pt-3 space-y-1.5 text-right">
              <div className="flex justify-between text-zinc-500">
                <span>Subtotal (Taxable Value):</span>
                <span>₹{Number(invoice.pricing?.subtotal || 0).toLocaleString("en-IN")}</span>
              </div>
              <div className="flex justify-between text-zinc-500">
                <span>CGST:</span>
                <span>₹{Number(invoice.pricing?.cgst || 0).toLocaleString("en-IN")}</span>
              </div>
              <div className="flex justify-between text-zinc-500">
                <span>SGST:</span>
                <span>₹{Number(invoice.pricing?.sgst || 0).toLocaleString("en-IN")}</span>
              </div>
              <div className="flex justify-between text-zinc-500">
                <span>Delivery Charges:</span>
                <span>₹{Number(invoice.pricing?.delivery_fee || 0).toLocaleString("en-IN")}</span>
              </div>
              <div className="flex justify-between text-sm font-bold text-zinc-900 dark:text-white pt-2 border-t border-zinc-200 dark:border-zinc-800">
                <span>Total (Incl. all taxes):</span>
                <span className="text-rose-600 dark:text-rose-400">₹{Number(invoice.pricing?.total || 0).toLocaleString("en-IN")}</span>
              </div>
            </div>

            {/* Footer */}
            <div className="text-center text-[10px] text-zinc-400 pt-4 border-t border-zinc-200 dark:border-zinc-800">
              <p>Thank you for choosing CakeToHome! This is a computer-generated tax invoice.</p>
              <p className="mt-0.5">For support inquiries: care@cakes2home.com</p>
            </div>
          </div>
        ) : (
          <div className="p-8 text-center text-rose-500 font-medium space-y-2" id="shop-invoice-error">
            <p className="font-bold text-sm">❌ Invoice Print Denied</p>
            <p className="text-xs text-zinc-400">{errorMessage || "No committed statutory tax invoice exists for this order. Invoices must be generated upon delivery."}</p>
          </div>
        )}
      </div>
    </div>
  );
}
