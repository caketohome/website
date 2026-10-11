"use client";

import React, { useState, useEffect } from "react";
import {
  X,
  BookOpen,
  Calendar,
  Building2,
  FileText,
  CreditCard,
  ArrowUpRight,
  ArrowDownLeft,
  Search,
  Filter,
  ShieldCheck,
} from "lucide-react";

interface CustomerLedgerModalProps {
  customerId: string;
  onClose: () => void;
}

export function CustomerLedgerModal({
  customerId,
  onClose,
}: CustomerLedgerModalProps) {
  const [data, setData] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  useEffect(() => {
    async function loadLedger() {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`/api/v1/admin/corporate-customers/${customerId}/ledger`).then((r) => r.json());
        if (!res.success) {
          throw new Error(res.message || res.error || "Failed to load customer subledger.");
        }
        setData(res.data);
      } catch (err: any) {
        setError(err.message || "Failed to load subledger");
      } finally {
        setLoading(false);
      }
    }
    loadLedger();
  }, [customerId]);

  if (loading) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
        <div className="w-full max-w-3xl p-8 bg-white dark:bg-slate-900 rounded-2xl shadow-2xl flex flex-col items-center justify-center gap-3">
          <div className="w-8 h-8 border-3 border-indigo-600 border-t-transparent rounded-full animate-spin" />
          <p className="text-sm text-slate-500">Calculating authoritative customer subledger...</p>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
        <div className="w-full max-w-md p-6 bg-white dark:bg-slate-900 rounded-2xl shadow-2xl space-y-4">
          <div className="text-red-600 font-bold">Error Loading Subledger</div>
          <p className="text-sm text-slate-600 dark:text-slate-400">{error || "Customer subledger not found"}</p>
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

  const entries = (data.entries || []).filter((e: any) => {
    if (!search.trim()) return true;
    const term = search.toLowerCase();
    return (
      e.document_no?.toLowerCase().includes(term) ||
      e.reference_no?.toLowerCase().includes(term) ||
      e.narration?.toLowerCase().includes(term)
    );
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
      <div className="relative w-full max-w-5xl bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400">
              <BookOpen className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-bold text-slate-900 dark:text-white">
                  Customer Subledger (Account 1121)
                </h2>
                <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 font-bold">
                  {data.credit_status || "ACTIVE"}
                </span>
              </div>
              <p className="text-xs text-slate-500">
                {data.company_name || data.customer_name} • GSTIN: <span className="font-mono text-slate-700 dark:text-slate-300">{data.gstin || "Unregistered"}</span>
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 overflow-y-auto space-y-5 flex-1">
          {/* Party Balance & Credit Metrics */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800">
              <span className="text-[11px] font-semibold text-slate-500">Approved Credit Limit</span>
              <div className="text-base font-bold text-slate-900 dark:text-white">
                ₹{Number(data.credit_limit || 0).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
              </div>
              <span className="text-[10px] text-slate-400">{data.payment_terms_days} days terms</span>
            </div>
            <div className="p-3 rounded-xl bg-blue-50/50 dark:bg-blue-950/20 border border-blue-200/50 dark:border-blue-900/30">
              <span className="text-[11px] font-semibold text-blue-600 dark:text-blue-400">Total Invoiced (Dr)</span>
              <div className="text-base font-bold text-blue-700 dark:text-blue-300">
                ₹{Number(data.total_invoiced || 0).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
              </div>
            </div>
            <div className="p-3 rounded-xl bg-emerald-50/50 dark:bg-emerald-950/20 border border-emerald-200/50 dark:border-emerald-900/30">
              <span className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400">Total Collected (Cr)</span>
              <div className="text-base font-bold text-emerald-700 dark:text-emerald-300">
                ₹{Number(data.total_received || 0).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
              </div>
            </div>
            <div className="p-3 rounded-xl bg-amber-50/50 dark:bg-amber-950/20 border border-amber-200/50 dark:border-amber-900/30">
              <span className="text-[11px] font-semibold text-amber-600 dark:text-amber-400">Authoritative Balance</span>
              <div className="text-base font-bold text-amber-700 dark:text-amber-300">
                ₹{Number(data.closing_balance || 0).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
              </div>
              <span className="text-[10px] text-amber-600 dark:text-amber-400 font-semibold">Net Trade AR</span>
            </div>
          </div>

          {/* Search Bar */}
          <div className="flex items-center gap-3">
            <div className="relative flex-1">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Filter ledger by Document #, UTR / Reference, or narration..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-9 pr-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-800 text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
          </div>

          {/* Chronological Subledger Table */}
          <div className="rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 font-semibold">
                <tr>
                  <th className="p-2.5">Date</th>
                  <th className="p-2.5">Type</th>
                  <th className="p-2.5">Doc #</th>
                  <th className="p-2.5">Ref / UTR</th>
                  <th className="p-2.5">Narration</th>
                  <th className="p-2.5 text-right">Debit (Dr)</th>
                  <th className="p-2.5 text-right">Credit (Cr)</th>
                  <th className="p-2.5 text-right">Balance</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                {entries.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="p-6 text-center text-slate-500">
                      No ledger transactions found matching filters.
                    </td>
                  </tr>
                ) : (
                  entries.map((entry: any) => (
                    <tr key={entry.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                      <td className="p-2.5 text-slate-600 dark:text-slate-400 whitespace-nowrap">
                        {entry.date}
                      </td>
                      <td className="p-2.5 whitespace-nowrap">
                        <span
                          className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                            entry.entry_type === "INVOICE"
                              ? "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-400"
                              : entry.entry_type === "RECEIPT"
                              ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400"
                              : "bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-400"
                          }`}
                        >
                          {entry.entry_type}
                        </span>
                      </td>
                      <td className="p-2.5 font-semibold text-slate-900 dark:text-white whitespace-nowrap">
                        {entry.document_no}
                      </td>
                      <td className="p-2.5 font-mono text-[11px] text-slate-600 dark:text-slate-400 whitespace-nowrap">
                        {entry.reference_no || "-"}
                      </td>
                      <td className="p-2.5 text-slate-700 dark:text-slate-300 max-w-xs truncate" title={entry.narration}>
                        {entry.narration}
                        {entry.allocated_invoices && (
                          <div className="text-[10px] text-slate-400">
                            Alloc: {entry.allocated_invoices.map((ai: any) => `${ai.invoice_number} (₹${ai.amount})`).join(", ")}
                          </div>
                        )}
                      </td>
                      <td className="p-2.5 text-right font-semibold text-blue-600 dark:text-blue-400 whitespace-nowrap">
                        {entry.debit > 0 ? `₹${entry.debit.toFixed(2)}` : "-"}
                      </td>
                      <td className="p-2.5 text-right font-semibold text-emerald-600 dark:text-emerald-400 whitespace-nowrap">
                        {entry.credit > 0 ? `₹${entry.credit.toFixed(2)}` : "-"}
                      </td>
                      <td className="p-2.5 text-right font-bold text-slate-900 dark:text-white whitespace-nowrap">
                        ₹{entry.running_balance.toFixed(2)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
