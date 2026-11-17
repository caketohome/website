"use client";

import React, { useState, useEffect } from "react";
import {
  X,
  CreditCard,
  Building2,
  Calendar,
  AlertCircle,
  CheckCircle2,
  Lock,
  Layers,
  ArrowRight,
} from "lucide-react";
import type { BankAccountOption } from "./types";
import { TdsFields } from "../TdsFields";

interface TargetInvoice {
  invoice_id: string;
  invoice_number: string;
  customer_id: string;
  customer_name: string;
  branch_id: string;
  branch_name: string | null;
  total_amount: number;
  paid_amount: number;
  outstanding_amount: number;
}

interface ReceiveReceiptModalProps {
  invoices: TargetInvoice[];
  onClose: () => void;
  onSuccess: (result: any) => void;
}

export function ReceiveReceiptModal({
  invoices,
  onClose,
  onSuccess,
}: ReceiveReceiptModalProps) {
  const [bankAccounts, setBankAccounts] = useState<BankAccountOption[]>([]);
  const [selectedBankAccountId, setSelectedBankAccountId] = useState<string>("");
  const [paymentMethod, setPaymentMethod] = useState<
    "BANK_TRANSFER" | "NEFT" | "RTGS" | "IMPS" | "CHEQUE" | "OTHER_BANK_SETTLEMENT"
  >("BANK_TRANSFER");
  const [receiptDate, setReceiptDate] = useState<string>(
    new Date().toISOString().split("T")[0]
  );
  const [reference, setReference] = useState<string>("");
  const [narration, setNarration] = useState<string>("");
  const [tdsSection, setTdsSection] = useState<string>("");
  const [tdsAmount, setTdsAmount] = useState<string>("");

  // Allocation state: invoiceId -> string amount
  const [allocations, setAllocations] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Close on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  // Initialize allocations with outstanding amounts
  useEffect(() => {
    const initAlloc: Record<string, string> = {};
    for (const inv of invoices) {
      initAlloc[inv.invoice_id] = inv.outstanding_amount.toFixed(2);
    }
    setAllocations(initAlloc);
  }, [invoices]);

  // Load active bank accounts
  useEffect(() => {
    async function loadBanks() {
      try {
        const res = await fetch("/api/v1/admin/bank-accounts").then((r) => r.json());
        if (res.data && Array.isArray(res.data)) {
          setBankAccounts(res.data);
          if (res.data.length > 0) {
            setSelectedBankAccountId(res.data[0].id);
          }
        }
      } catch (err) {
        console.warn("Failed to fetch bank accounts:", err);
      }
    }
    loadBanks();
  }, []);

  const primaryInvoice = invoices[0];
  const customerId = primaryInvoice?.customer_id;
  const customerName = primaryInvoice?.customer_name;
  const branchId = primaryInvoice?.branch_id;

  // Calculate total receipt allocation
  const totalAllocation = Object.values(allocations).reduce((sum, val) => {
    const num = parseFloat(val);
    return sum + (isNaN(num) ? 0 : num);
  }, 0);

  const parsedTds = tdsSection ? Math.max(0, parseFloat(tdsAmount) || 0) : 0;

  const isElectronic = ["BANK_TRANSFER", "NEFT", "RTGS", "IMPS"].includes(paymentMethod);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (isElectronic && (!reference || !reference.trim())) {
      setError("Transaction/UTR reference ID is mandatory for electronic bank receipts.");
      return;
    }

    const allocList = Object.entries(allocations)
      .map(([invId, amtStr]) => ({
        invoiceId: invId,
        amount: parseFloat(amtStr),
      }))
      .filter((a) => !isNaN(a.amount) && a.amount > 0);

    if (allocList.length === 0) {
      setError("Please specify at least one positive receipt allocation amount.");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/v1/admin/bills-receivable/receipt", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customer_id: customerId,
          branch_id: branchId,
          receipt_date: receiptDate,
          payment_method: paymentMethod,
          bank_account_id: selectedBankAccountId || null,
          reference: reference.trim() || null,
          narration: narration.trim() || null,
          allocations: allocList,
          tds_section: parsedTds > 0 ? tdsSection : undefined,
          tds_amount: parsedTds > 0 ? parsedTds : undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.message || data.error || "Failed to record customer receipt.");
      }

      onSuccess(data.data);
    } catch (err: any) {
      setError(err.message || "Failed to record receipt");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
      <div className="relative w-full max-w-2xl bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
              <CreditCard className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-900 dark:text-white">
                Record Corporate Receipt
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Customer: <span className="font-semibold text-slate-700 dark:text-slate-300">{customerName}</span> ({invoices.length} invoice{invoices.length > 1 ? "s" : ""})
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

        {/* Content Form */}
        <form onSubmit={handleSubmit} className="p-6 overflow-y-auto space-y-5 flex-1">
          {error && (
            <div className="flex items-start gap-3 p-3.5 rounded-xl bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900/50 text-red-700 dark:text-red-400 text-sm">
              <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
              <div className="flex-1">{error}</div>
            </div>
          )}

          {/* Settlement Details Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1.5">
                Receipt Date *
              </label>
              <div className="relative">
                <input
                  type="date"
                  value={receiptDate}
                  onChange={(e) => setReceiptDate(e.target.value)}
                  required
                  className="w-full px-3 py-2 text-sm rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-brand-primary outline-none"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1.5">
                Payment Method *
              </label>
              <select
                value={paymentMethod}
                onChange={(e) => setPaymentMethod(e.target.value as any)}
                className="w-full px-3 py-2 text-sm rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-brand-primary outline-none"
              >
                <option value="BANK_TRANSFER">Bank Transfer (NEFT/RTGS/IMPS)</option>
                <option value="NEFT">NEFT</option>
                <option value="RTGS">RTGS</option>
                <option value="IMPS">IMPS</option>
                <option value="CHEQUE">Cheque</option>
                <option value="OTHER_BANK_SETTLEMENT">Other Bank Settlement</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1.5">
                Deposit Bank Account (Resolves Leaf GL)
              </label>
              <select
                value={selectedBankAccountId}
                onChange={(e) => setSelectedBankAccountId(e.target.value)}
                className="w-full px-3 py-2 text-sm rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-brand-primary outline-none"
              >
                {bankAccounts.length === 0 ? (
                  <option value="">Default Operating Bank (GL 1112)</option>
                ) : (
                  bankAccounts.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.bank_name} — {b.account_name} ({b.account_number.slice(-4)})
                    </option>
                  ))
                )}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1.5">
                Transaction / UTR Reference {isElectronic ? "*" : "(Optional)"}
              </label>
              <input
                type="text"
                value={reference}
                onChange={(e) => setReference(e.target.value)}
                placeholder="e.g. UTR129384756 / CHQ-001234"
                required={isElectronic}
                className="w-full px-3 py-2 text-sm rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-brand-primary outline-none"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1.5">
              Narration / Notes
            </label>
            <input
              type="text"
              value={narration}
              onChange={(e) => setNarration(e.target.value)}
              placeholder="e.g. Corporate gifting settlement for festive batch"
              className="w-full px-3 py-2 text-sm rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-brand-primary outline-none"
            />
          </div>

          {/* Allocation Breakdown Table */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400">
                Invoice Allocation Breakdown
              </label>
              <span className="text-xs text-slate-500">
                Total Allocated:{" "}
                <span className="font-bold text-slate-900 dark:text-white">
                  ₹{totalAllocation.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                </span>
              </span>
            </div>

            <div className="rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden divide-y divide-slate-200 dark:divide-slate-800">
              {invoices.map((inv) => {
                const allocVal = parseFloat(allocations[inv.invoice_id] || "0") || 0;
                const remaining = Math.max(0, inv.outstanding_amount - allocVal);

                return (
                  <div
                    key={inv.invoice_id}
                    className="p-3 bg-white dark:bg-slate-800/40 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs"
                  >
                    <div>
                      <div className="font-bold text-slate-900 dark:text-white">
                        {inv.invoice_number}
                      </div>
                      <div className="text-slate-500">
                        Total: ₹{inv.total_amount.toFixed(2)} | Outstanding:{" "}
                        <span className="font-semibold text-brand-gold dark:text-brand-gold">
                          ₹{inv.outstanding_amount.toFixed(2)}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      <div className="flex items-center gap-1.5">
                        <span className="text-slate-500">Pay ₹</span>
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          max={inv.outstanding_amount}
                          value={allocations[inv.invoice_id] || ""}
                          onChange={(e) =>
                            setAllocations({
                              ...allocations,
                              [inv.invoice_id]: e.target.value,
                            })
                          }
                          className="w-28 px-2 py-1 text-right text-xs font-semibold rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-emerald-500 outline-none"
                        />
                      </div>
                      <span className="text-[11px] text-slate-400">
                        Rem: ₹{remaining.toFixed(2)}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* TDS deducted by the corporate customer (rare: 194Q large buyers, 194C catering) */}
          <TdsFields
            section={tdsSection}
            amount={tdsAmount}
            onSectionChange={setTdsSection}
            onAmountChange={setTdsAmount}
            grossAmount={totalAllocation}
            netLabel="Received in bank"
          />

          {/* Action Buttons */}
          <div className="pt-2 flex items-center justify-end gap-3 border-t border-slate-200 dark:border-slate-800">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="px-4 py-2 text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading || totalAllocation <= 0}
              className="flex items-center gap-2 px-5 py-2 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 rounded-xl shadow-xs transition-colors"
            >
              {loading ? (
                <span>Posting Receipt...</span>
              ) : (
                <>
                  <span>Commit Receipt (₹{Math.max(0, totalAllocation - parsedTds).toFixed(2)})</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
