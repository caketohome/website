"use client";

import React, { useState, useEffect, useMemo } from "react";
import {
  X,
  CreditCard,
  Building2,
  Calendar,
  AlertCircle,
  CheckCircle2,
  ArrowRight,
  ShieldAlert,
  Wallet,
  Receipt,
} from "lucide-react";
import type { BankAccountOption } from "./types";

interface BillToPay {
  purchase_id: string;
  invoice_no: string | null;
  supplier_id: string;
  supplier_name: string;
  branch_id: string;
  outstanding_amount: number;
}

interface PayBillModalProps {
  bills: BillToPay[];
  onClose: () => void;
  onSuccess: () => void;
}

export function PayBillModal({ bills, onClose, onSuccess }: PayBillModalProps) {
  if (!bills || bills.length === 0) return null;

  const supplierId = bills[0].supplier_id;
  const supplierName = bills[0].supplier_name;
  const branchId = bills[0].branch_id;

  const totalOutstanding = useMemo(() => {
    return bills.reduce((sum, b) => sum + Number(b.outstanding_amount), 0);
  }, [bills]);

  // Form State
  const [paymentAmount, setPaymentAmount] = useState<string>(totalOutstanding.toFixed(2));
  const [paymentMethod, setPaymentMethod] = useState<"BANK_TRANSFER" | "UPI" | "CHEQUE" | "CASH">("BANK_TRANSFER");
  const [bankAccountId, setBankAccountId] = useState<string>("");
  const [reference, setReference] = useState<string>("");
  const [paymentDate, setPaymentDate] = useState<string>(() => new Date().toISOString().split("T")[0]);
  const [narration, setNarration] = useState<string>("");

  // Master bank accounts
  const [bankAccounts, setBankAccounts] = useState<BankAccountOption[]>([]);
  const [loadingBanks, setLoadingBanks] = useState(false);

  // Active teller session for Cash payments
  const [activeTellerSession, setActiveTellerSession] = useState<any | null>(null);
  const [activeTellerSessionId, setActiveTellerSessionId] = useState<string | null>(null);
  const [loadingTeller, setLoadingTeller] = useState(false);

  // Submission state
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch active bank accounts
  useEffect(() => {
    setLoadingBanks(true);
    fetch("/api/v1/admin/bank-accounts")
      .then((r) => r.json())
      .then((res) => {
        const banks = res.bank_accounts || res.bankAccounts || res.data || res.items || [];
        setBankAccounts(banks);
        if (banks.length > 0) {
          setBankAccountId(banks[0].id);
        }
      })
      .catch(() => {
        // Fallback
      })
      .finally(() => setLoadingBanks(false));
  }, []);

  // Check active teller sessions when cash is selected
  useEffect(() => {
    if (paymentMethod === "CASH" && branchId) {
      setLoadingTeller(true);
      fetch(`/api/v1/admin/teller/sessions?status=OPEN&branch_id=${branchId}`)
        .then((r) => r.json())
        .then((res) => {
          const sessions = res.sessions || res.data || [];
          if (Array.isArray(sessions) && sessions.length > 0) {
            setActiveTellerSession(sessions[0]);
            setActiveTellerSessionId(sessions[0].id);
          } else {
            setActiveTellerSession(null);
            setActiveTellerSessionId(null);
          }
        })
        .catch(() => {
          setActiveTellerSession(null);
          setActiveTellerSessionId(null);
        })
        .finally(() => setLoadingTeller(false));
    } else {
      setActiveTellerSession(null);
      setActiveTellerSessionId(null);
    }
  }, [paymentMethod, branchId]);

  const parsedAmount = parseFloat(paymentAmount) || 0;
  const isOverpayment = parsedAmount > totalOutstanding + 0.01;
  const isZeroOrNegative = parsedAmount <= 0;

  // Compute allocations across bills (FIFO allocation)
  const computedAllocations = useMemo(() => {
    let remaining = parsedAmount;
    const result: Array<{ purchaseId: string; amount: number }> = [];

    for (const bill of bills) {
      if (remaining <= 0) break;
      const billOut = Number(bill.outstanding_amount);
      const alloc = Math.min(billOut, remaining);
      if (alloc > 0) {
        result.push({
          purchaseId: bill.purchase_id,
          amount: Math.round(alloc * 100) / 100,
        });
        remaining = Math.round((remaining - alloc) * 100) / 100;
      }
    }
    return result;
  }, [bills, parsedAmount]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (isZeroOrNegative) {
      setError("Payment amount must be greater than zero.");
      return;
    }
    if (isOverpayment) {
      setError(`Payment cannot exceed total outstanding balance of ₹${totalOutstanding.toFixed(2)}.`);
      return;
    }
    if ((paymentMethod === "BANK_TRANSFER" || paymentMethod === "UPI") && !reference.trim()) {
      setError("Transaction reference / UTR number is mandatory for electronic settlements.");
      return;
    }
    if ((paymentMethod === "BANK_TRANSFER" || paymentMethod === "UPI" || paymentMethod === "CHEQUE") && !bankAccountId) {
      setError("Please select a disbursing bank account.");
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        supplier_id: supplierId,
        branch_id: branchId,
        payment_method: paymentMethod,
        payment_amount: parsedAmount,
        payment_date: paymentDate,
        reference: reference.trim() || undefined,
        bank_account_id: paymentMethod !== "CASH" ? bankAccountId : undefined,
        teller_session_id: paymentMethod === "CASH" && activeTellerSessionId ? activeTellerSessionId : undefined,
        narration: narration.trim() || undefined,
        allocations: computedAllocations,
      };

      const res = await fetch("/api/v1/admin/bills-payable/pay", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error || "Failed to process disbursement.");
      }

      onSuccess();
    } catch (err: any) {
      setError(err.message || "An error occurred while disbursing payment.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div role="dialog" aria-modal="true" className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="relative w-full max-w-xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/60">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-emerald-50 text-emerald-600 dark:bg-emerald-950/60 dark:text-emerald-400">
              <CreditCard className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
                Disburse Bill Payment
              </h2>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">
                Supplier: <span className="font-medium text-zinc-700 dark:text-zinc-300">{supplierName}</span>
                {bills.length > 1 && ` • ${bills.length} bills selected`}
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

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 dark:bg-rose-950/40 dark:border-rose-900/60 dark:text-rose-300 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Selected Bills Summary Card */}
          <div className="p-3.5 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-800/40 space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="text-zinc-500">Selected Bill(s):</span>
              <span className="font-mono font-medium text-zinc-800 dark:text-zinc-200">
                {bills.map((b) => b.invoice_no || b.purchase_id.substring(0, 8)).join(", ")}
              </span>
            </div>
            <div className="flex items-center justify-between text-xs pt-2 border-t border-zinc-200 dark:border-zinc-800">
              <span className="text-zinc-500">Total Outstanding Balance:</span>
              <span className="font-semibold text-zinc-900 dark:text-zinc-100">
                ₹{totalOutstanding.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
              </span>
            </div>
          </div>

          {/* Payment Amount & Date */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                Disbursement Amount (₹) *
              </label>
              <input
                type="number"
                step="0.01"
                min="0.01"
                max={totalOutstanding}
                value={paymentAmount}
                onChange={(e) => setPaymentAmount(e.target.value)}
                className={`w-full px-3 py-2 text-sm rounded-xl border bg-white dark:bg-zinc-800/60 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 ${
                  isOverpayment
                    ? "border-rose-500 focus:ring-rose-400"
                    : "border-zinc-300 dark:border-zinc-700 focus:ring-brand-primary"
                }`}
                required
              />
              <div className="flex items-center justify-between mt-1 text-[11px]">
                <button
                  type="button"
                  onClick={() => setPaymentAmount(totalOutstanding.toFixed(2))}
                  className="text-brand-primary hover:text-brand-navy dark:text-brand-primary underline"
                >
                  Pay Full Balance
                </button>
                {parsedAmount < totalOutstanding && parsedAmount > 0 && (
                  <span className="text-brand-gold dark:text-brand-gold">
                    Partial: ₹{(totalOutstanding - parsedAmount).toFixed(2)} remaining
                  </span>
                )}
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                Disbursement Date *
              </label>
              <input
                type="date"
                value={paymentDate}
                onChange={(e) => setPaymentDate(e.target.value)}
                className="w-full px-3 py-2 text-sm rounded-xl border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800/60 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-brand-primary"
                required
              />
            </div>
          </div>

          {/* Payment Method */}
          <div>
            <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1.5">
              Disbursement Method *
            </label>
            <div className="grid grid-cols-4 gap-2">
              {[
                { id: "BANK_TRANSFER", label: "NEFT / RTGS" },
                { id: "UPI", label: "UPI" },
                { id: "CHEQUE", label: "Cheque" },
                { id: "CASH", label: "Cash" },
              ].map((m) => (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => setPaymentMethod(m.id as any)}
                  className={`py-2 px-2 text-xs font-medium rounded-xl border text-center transition ${
                    paymentMethod === m.id
                      ? "bg-brand-light border-brand-primary text-brand-navy dark:bg-brand-navy/60 dark:border-brand-primary dark:text-brand-primary/30 shadow-sm"
                      : "border-zinc-200 dark:border-zinc-800 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-800/40"
                  }`}
                >
                  {m.label}
                </button>
              ))}
            </div>
          </div>

          {/* Bank Account Selector (if not Cash) */}
          {paymentMethod !== "CASH" && (
            <div>
              <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                Disbursing Bank Account *
              </label>
              <select
                value={bankAccountId}
                onChange={(e) => setBankAccountId(e.target.value)}
                className="w-full px-3 py-2 text-xs rounded-xl border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800/60 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-brand-primary"
                required
              >
                {bankAccounts.map((ba) => (
                  <option key={ba.id} value={ba.id}>
                    {ba.bank_name} — {ba.account_name} ({ba.account_number_masked})
                  </option>
                ))}
                {bankAccounts.length === 0 && (
                  <option value="">Primary Operating Account (HDFC Bank)</option>
                )}
              </select>
            </div>
          )}

          {/* Active Till Drawer Status for Cash Payments */}
          {paymentMethod === "CASH" && (
            <div className="p-3.5 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-800/40 text-xs space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-zinc-800 dark:text-zinc-200 flex items-center gap-1.5">
                  <Wallet className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                  Branch Cash Custody:
                </span>
                {loadingTeller ? (
                  <span className="text-[11px] text-zinc-400">Checking open tills...</span>
                ) : activeTellerSession ? (
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800">
                    <CheckCircle2 className="w-3 h-3" />
                    Active Drawer Connected
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-brand-gold-light text-brand-gold-dark border border-brand-gold/40 dark:bg-brand-gold-dark/60 dark:text-brand-gold/40 dark:border-brand-gold-dark">
                    Branch Safe / Petty Cash
                  </span>
                )}
              </div>
              <p className="text-[11px] text-zinc-500 dark:text-zinc-400 leading-relaxed">
                {activeTellerSession
                  ? `Till Session #${activeTellerSession.id.substring(0, 8)} (${activeTellerSession.teller_id || "Active Till"}). Payout will automatically record a cash OUT movement and decrement physical expected cash.`
                  : "No open teller till for this branch. Settlement will debit Trade AP (2111) and credit Branch Cash (1111) directly without till drawer deduction."}
              </p>
            </div>
          )}

          {/* Reference / UTR Number */}
          <div>
            <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1">
              {paymentMethod === "CASH"
                ? "Cash Voucher / Receipt Ref (Optional)"
                : "Transaction Reference / UTR Number *"}
            </label>
            <input
              type="text"
              placeholder={paymentMethod === "CASH" ? "e.g. CV-2026-001" : "e.g. UTR9928374615"}
              value={reference}
              onChange={(e) => setReference(e.target.value)}
              className="w-full px-3 py-2 text-xs rounded-xl border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800/60 text-zinc-900 dark:text-zinc-100 font-mono focus:outline-none focus:ring-2 focus:ring-brand-primary"
              required={paymentMethod !== "CASH"}
            />
          </div>

          {/* Narration */}
          <div>
            <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1">
              Narration / Ledger Remarks (Optional)
            </label>
            <input
              type="text"
              placeholder="e.g. Settlement for raw ingredient invoices"
              value={narration}
              onChange={(e) => setNarration(e.target.value)}
              className="w-full px-3 py-2 text-xs rounded-xl border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800/60 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-brand-primary"
            />
          </div>

          {/* Segregation of Duties Notice */}
          <div className="flex items-start gap-2 p-3 rounded-xl bg-brand-gold-light/60 border border-brand-gold/40 dark:bg-brand-gold-dark/20 dark:border-brand-gold-dark/40 text-[11px] text-brand-gold-dark dark:text-brand-gold/40">
            <ShieldAlert className="w-4 h-4 shrink-0 mt-0.5" />
            <div>
              <span className="font-semibold">Segregation of Duties:</span> Payment disbursement
              generates an atomic payment voucher crediting bank/cash and debiting Trade AP (Account 2111)
              with the supplier dimension.
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center justify-end gap-3 pt-3 border-t border-zinc-200 dark:border-zinc-800">
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              className="px-4 py-2 text-xs font-medium text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-xl transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting || isOverpayment || isZeroOrNegative}
              className="inline-flex items-center gap-1.5 px-5 py-2 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-xl shadow-sm transition"
            >
              {submitting ? "Processing Settlement..." : `Disburse ₹${parsedAmount.toFixed(2)}`}
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
