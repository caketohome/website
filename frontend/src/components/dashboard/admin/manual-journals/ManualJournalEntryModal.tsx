"use client";

import React, { useState, useEffect, useMemo, useCallback } from "react";
import {
  X,
  Plus,
  Trash2,
  AlertCircle,
  CheckCircle2,
  FileText,
  Calendar,
  Building2,
  Save,
  Send,
  Scale,
  Users,
  Building,
} from "lucide-react";
import type {
  AccountingVoucherRow,
  ManualJournalLineItem,
} from "@frontend/lib/types/accounting.types";
import type {
  AccountOption,
  CustomerOption,
  SupplierOption,
  BranchOption,
  JournalFormLine,
} from "./types";

interface ManualJournalEntryModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (voucher: AccountingVoucherRow) => void;
  editVoucher?: AccountingVoucherRow | null;
  branches: BranchOption[];
  accounts: AccountOption[];
  customers: CustomerOption[];
  suppliers: SupplierOption[];
  currentBranchId?: string;
}

export function ManualJournalEntryModal({
  isOpen,
  onClose,
  onSuccess,
  editVoucher,
  branches,
  accounts,
  customers,
  suppliers,
  currentBranchId,
}: ManualJournalEntryModalProps) {
  // Form State
  const [branchId, setBranchId] = useState<string>("");
  const [voucherDate, setVoucherDate] = useState<string>("");
  const [narration, setNarration] = useState<string>("");
  const [lines, setLines] = useState<JournalFormLine[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Filter postable leaf accounts only (is_group === false)
  const postableAccounts = useMemo(() => {
    return accounts.filter((a) => !a.is_group);
  }, [accounts]);

  // Group accounts by account type for intuitive selection
  const groupedAccounts = useMemo(() => {
    const groups: Record<string, AccountOption[]> = {};
    for (const acc of postableAccounts) {
      if (!groups[acc.type]) groups[acc.type] = [];
      groups[acc.type].push(acc);
    }
    return groups;
  }, [postableAccounts]);

  // Helper to initialize blank lines (minimum 2 lines required)
  const createBlankLine = (lineNo: number): JournalFormLine => ({
    id: `temp_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    line_no: lineNo,
    account_id: "",
    account_code: "",
    account_name: "",
    account_type: "",
    debit_amount: "",
    credit_amount: "",
    customer_id: "",
    supplier_id: "",
    narration: "",
  });

  // Reset or Populate form on open
  useEffect(() => {
    if (!isOpen) return;

    setError(null);
    if (editVoucher) {
      // Editing existing draft
      setBranchId(editVoucher.branch_id);
      setVoucherDate(editVoucher.voucher_date.split("T")[0]);
      setNarration(editVoucher.narration || "");

      const rawLines = (editVoucher.metadata as any)?.lines as ManualJournalLineItem[] || [];
      if (rawLines.length >= 2) {
        setLines(
          rawLines.map((l, idx) => {
            const acc = accounts.find((a) => a.id === l.account_id);
            return {
              id: `line_${idx}_${l.account_id}`,
              line_no: idx + 1,
              account_id: l.account_id,
              account_code: acc?.code || l.account_code || "",
              account_name: acc?.name || l.account_name || "",
              account_type: acc?.type || l.account_type || "",
              debit_amount: Number(l.debit_amount) > 0 ? String(l.debit_amount) : "",
              credit_amount: Number(l.credit_amount) > 0 ? String(l.credit_amount) : "",
              customer_id: l.customer_id || "",
              supplier_id: l.supplier_id || "",
              narration: l.narration || "",
            };
          })
        );
      } else {
        setLines([createBlankLine(1), createBlankLine(2)]);
      }
    } else {
      // New Draft
      const defaultBranch = currentBranchId || (branches[0] ? branches[0].id : "");
      setBranchId(defaultBranch);
      setVoucherDate(new Date().toISOString().split("T")[0]);
      setNarration("");
      setLines([createBlankLine(1), createBlankLine(2)]);
    }
  }, [isOpen, editVoucher, branches, currentBranchId, accounts]);

  if (!isOpen) return null;

  // ── Line Mutation Handlers ──────────────────────────────────────────────────

  const handleAccountChange = (idx: number, accountId: string) => {
    const acc = postableAccounts.find((a) => a.id === accountId);
    setLines((prev) => {
      const copy = [...prev];
      const line = { ...copy[idx] };
      line.account_id = accountId;
      line.account_code = acc?.code || "";
      line.account_name = acc?.name || "";
      line.account_type = acc?.type || "";

      // Automatically clear customer / supplier if not an AR/AP account
      const isAR = acc?.code === "1121" || acc?.code === "1122";
      const isAP = acc?.code === "2111";
      if (!isAR) line.customer_id = "";
      if (!isAP) line.supplier_id = "";

      copy[idx] = line;
      return copy;
    });
  };

  const handleDebitChange = (idx: number, val: string) => {
    // Single-sided invariant: If debit is entered, credit must be 0/empty
    setLines((prev) => {
      const copy = [...prev];
      copy[idx] = {
        ...copy[idx],
        debit_amount: val,
        credit_amount: val && parseFloat(val) > 0 ? "" : copy[idx].credit_amount,
      };
      return copy;
    });
  };

  const handleCreditChange = (idx: number, val: string) => {
    // Single-sided invariant: If credit is entered, debit must be 0/empty
    setLines((prev) => {
      const copy = [...prev];
      copy[idx] = {
        ...copy[idx],
        credit_amount: val,
        debit_amount: val && parseFloat(val) > 0 ? "" : copy[idx].debit_amount,
      };
      return copy;
    });
  };

  const handleLineFieldChange = (idx: number, field: keyof JournalFormLine, val: string) => {
    setLines((prev) => {
      const copy = [...prev];
      copy[idx] = { ...copy[idx], [field]: val };
      return copy;
    });
  };

  const addLine = () => {
    setLines((prev) => [...prev, createBlankLine(prev.length + 1)]);
  };

  const removeLine = (idx: number) => {
    if (lines.length <= 2) {
      setError("A manual journal requires a minimum of 2 balanced lines.");
      return;
    }
    setLines((prev) => {
      const filtered = prev.filter((_, i) => i !== idx);
      return filtered.map((l, i) => ({ ...l, line_no: i + 1 }));
    });
  };

  // ── Presentation-Only Live Calculations (UI display only, server remains authoritative) ──

  const { totalDebits, totalCredits, difference, isBalanced } = useMemo(() => {
    let dr = 0;
    let cr = 0;
    for (const l of lines) {
      const d = parseFloat(l.debit_amount) || 0;
      const c = parseFloat(l.credit_amount) || 0;
      dr += d;
      cr += c;
    }
    const diff = Math.abs(dr - cr);
    return {
      totalDebits: dr,
      totalCredits: cr,
      difference: diff,
      isBalanced: diff < 0.005 && dr > 0,
    };
  }, [lines]);

  // ── Submit & Save Actions ────────────────────────────────────────────────────

  const handleSave = async (andSubmit = false) => {
    setError(null);

    // Basic UI guard
    if (!branchId) {
      setError("Please select a branch.");
      return;
    }
    if (!voucherDate) {
      setError("Please select a voucher date.");
      return;
    }
    if (lines.length < 2) {
      setError("A manual journal must contain at least 2 lines.");
      return;
    }

    // Convert form lines to API payload lines
    const payloadLines: ManualJournalLineItem[] = lines.map((l, idx) => ({
      line_no: idx + 1,
      account_id: l.account_id,
      debit_amount: parseFloat(l.debit_amount) || 0,
      credit_amount: parseFloat(l.credit_amount) || 0,
      customer_id: l.customer_id || undefined,
      supplier_id: l.supplier_id || undefined,
      narration: l.narration.trim() || undefined,
    }));

    setSubmitting(true);
    try {
      let savedVoucher: AccountingVoucherRow;

      if (editVoucher) {
        // PUT update
        const res = await fetch(`/api/v1/admin/accounting/journals/${editVoucher.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            voucher_date: voucherDate,
            narration: narration.trim(),
            lines: payloadLines,
            branch_id: branchId,
          }),
        });
        const data = await res.json();
        if (!res.ok || !data.success) {
          throw new Error(data.message || data.error || "Failed to update draft voucher.");
        }
        savedVoucher = data.data?.voucher || data.data;
      } else {
        // POST draft
        const res = await fetch("/api/v1/admin/accounting/journals/draft", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            branch_id: branchId,
            voucher_date: voucherDate,
            narration: narration.trim(),
            lines: payloadLines,
          }),
        });
        const data = await res.json();
        if (!res.ok || !data.success) {
          throw new Error(data.message || data.error || "Failed to create draft voucher.");
        }
        savedVoucher = data.data?.voucher || data.data;
      }

      // If user clicked "Save & Submit"
      if (andSubmit) {
        const subRes = await fetch(`/api/v1/admin/accounting/journals/${savedVoucher.id}/submit`, {
          method: "POST",
        });
        const subData = await subRes.json();
        if (!subRes.ok || !subData.success) {
          throw new Error(`Draft saved as ${savedVoucher.voucher_no}, but submission failed: ${subData.message || subData.error}`);
        }
        savedVoucher = subData.data?.voucher || subData.data;
      }

      onSuccess(savedVoucher);
      onClose();
    } catch (err: any) {
      setError(err.message || "Failed to save journal voucher.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="w-full max-w-5xl max-h-[92vh] flex flex-col rounded-xl bg-white shadow-2xl border border-slate-200 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50/90 px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-brand-light text-brand-primary">
              <FileText className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-slate-900">
                {editVoucher ? `Edit Draft Journal — ${editVoucher.voucher_no}` : "New Manual Journal Voucher (JV)"}
              </h3>
              <p className="text-xs text-slate-500">
                Authoritative double-entry general ledger voucher entry. Currency: INR (₹)
              </p>
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

        {/* Modal Form Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-5">
          {/* Error Banner */}
          {error && (
            <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-xs text-red-700 flex items-start gap-2">
              <AlertCircle className="h-4 w-4 shrink-0 text-red-500 mt-0.5" />
              <div className="flex-1">
                <span className="font-semibold">Validation or Server Error: </span>
                <span>{error}</span>
              </div>
              <button onClick={() => setError(null)} className="text-red-500 hover:text-red-700">
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          )}

          {/* Voucher Header Fields */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 rounded-lg border border-slate-200 bg-slate-50/50 p-4">
            {/* Branch */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Branch <span className="text-red-500">*</span>
              </label>
              <select
                value={branchId}
                onChange={(e) => setBranchId(e.target.value)}
                disabled={submitting || Boolean(editVoucher)}
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs text-slate-800 focus:border-brand-primary focus:outline-none focus:ring-1 focus:ring-brand-primary disabled:bg-slate-100"
              >
                <option value="">Select Branch...</option>
                {branches.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name} ({b.code || b.id})
                  </option>
                ))}
              </select>
            </div>

            {/* Voucher Date */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Voucher Date <span className="text-red-500">*</span>
              </label>
              <input
                type="date"
                value={voucherDate}
                onChange={(e) => setVoucherDate(e.target.value)}
                disabled={submitting}
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs text-slate-800 focus:border-brand-primary focus:outline-none focus:ring-1 focus:ring-brand-primary"
              />
            </div>

            {/* Currency & Type Indicator */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Voucher Type & Currency
              </label>
              <div className="flex items-center gap-2 px-3 py-2 rounded-lg border border-slate-200 bg-slate-100 text-xs text-slate-600 font-mono">
                <span className="font-semibold text-slate-800">JOURNAL</span>
                <span className="text-slate-400">|</span>
                <span>Base Currency: INR (₹)</span>
              </div>
            </div>

            {/* Header Narration */}
            <div className="col-span-1 sm:col-span-3">
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Journal Narration / Description <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={narration}
                onChange={(e) => setNarration(e.target.value)}
                disabled={submitting}
                placeholder="e.g. Month-end depreciation adjustment for kitchen equipment..."
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs text-slate-800 focus:border-brand-primary focus:outline-none focus:ring-1 focus:ring-brand-primary"
              />
            </div>
          </div>

          {/* Dynamic Multi-Line Entry Grid */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="text-xs font-semibold text-slate-900">
                  Journal Entry Lines ({lines.length})
                </h4>
                <p className="text-[11px] text-slate-500">
                  Select postable leaf accounts. Single-sided Dr/Cr per line. Total Debits must equal Total Credits.
                </p>
              </div>
              <button
                type="button"
                onClick={addLine}
                disabled={submitting}
                className="inline-flex items-center gap-1.5 rounded-lg border border-brand-primary/30 bg-brand-light px-3 py-1.5 text-xs font-medium text-brand-navy hover:bg-brand-light transition shadow-sm"
              >
                <Plus className="h-3.5 w-3.5" />
                Add Line
              </button>
            </div>

            {/* Lines Table */}
            <div className="rounded-lg border border-slate-200 overflow-hidden shadow-sm">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold">
                  <tr>
                    <th className="py-2.5 px-3 w-10 text-center">#</th>
                    <th className="py-2.5 px-3 w-72">Account (Leaf Only) <span className="text-red-500">*</span></th>
                    <th className="py-2.5 px-3 w-48">Party Dimension</th>
                    <th className="py-2.5 px-3 w-32 text-right">Debit (₹)</th>
                    <th className="py-2.5 px-3 w-32 text-right">Credit (₹)</th>
                    <th className="py-2.5 px-3">Line Memo</th>
                    <th className="py-2.5 px-2 w-10 text-center"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 bg-white">
                  {lines.map((line, idx) => {
                    const isAR = line.account_code === "1121" || line.account_code === "1122";
                    const isAP = line.account_code === "2111";

                    return (
                      <tr key={line.id} className="hover:bg-slate-50/50">
                        {/* Line # */}
                        <td className="py-2.5 px-3 text-center text-slate-400 font-mono">
                          {idx + 1}
                        </td>

                        {/* Account Selector */}
                        <td className="py-2.5 px-3">
                          <select
                            value={line.account_id}
                            onChange={(e) => handleAccountChange(idx, e.target.value)}
                            disabled={submitting}
                            className="w-full rounded border border-slate-300 bg-white px-2 py-1.5 text-xs text-slate-800 focus:border-brand-primary focus:outline-none focus:ring-1 focus:ring-brand-primary"
                          >
                            <option value="">Select Leaf Account...</option>
                            {Object.entries(groupedAccounts).map(([type, accs]) => (
                              <optgroup key={type} label={type}>
                                {accs.map((a) => (
                                  <option key={a.id} value={a.id}>
                                    {a.code} — {a.name}
                                  </option>
                                ))}
                              </optgroup>
                            ))}
                          </select>
                        </td>

                        {/* Party Dimension (AR -> Customer, AP -> Supplier) */}
                        <td className="py-2.5 px-3">
                          {isAR ? (
                            <select
                              value={line.customer_id}
                              onChange={(e) => handleLineFieldChange(idx, "customer_id", e.target.value)}
                              disabled={submitting}
                              className="w-full rounded border border-blue-300 bg-blue-50/50 px-2 py-1.5 text-xs text-blue-900 focus:border-blue-500 focus:outline-none"
                            >
                              <option value="">Select AR Customer...</option>
                              {customers.map((c) => (
                                <option key={c.id} value={c.id}>
                                  {c.first_name || c.name || c.id} {c.last_name || ""}
                                </option>
                              ))}
                            </select>
                          ) : isAP ? (
                            <select
                              value={line.supplier_id}
                              onChange={(e) => handleLineFieldChange(idx, "supplier_id", e.target.value)}
                              disabled={submitting}
                              className="w-full rounded border border-brand-gold/40 bg-brand-gold-light/50 px-2 py-1.5 text-xs text-brand-gold-dark focus:border-brand-gold focus:outline-none"
                            >
                              <option value="">Select AP Supplier...</option>
                              {suppliers.map((s) => (
                                <option key={s.id} value={s.id}>
                                  {s.name} ({s.code || s.id})
                                </option>
                              ))}
                            </select>
                          ) : (
                            <span className="text-[11px] text-slate-400 italic block py-1.5 px-1">
                              Not required
                            </span>
                          )}
                        </td>

                        {/* Debit Amount */}
                        <td className="py-2.5 px-3 text-right">
                          <input
                            type="number"
                            step="0.01"
                            min="0"
                            placeholder="0.00"
                            value={line.debit_amount}
                            onChange={(e) => handleDebitChange(idx, e.target.value)}
                            disabled={submitting}
                            className="w-full text-right rounded border border-slate-300 bg-white px-2 py-1.5 text-xs text-slate-800 font-mono focus:border-brand-primary focus:outline-none focus:ring-1 focus:ring-brand-primary"
                          />
                        </td>

                        {/* Credit Amount */}
                        <td className="py-2.5 px-3 text-right">
                          <input
                            type="number"
                            step="0.01"
                            min="0"
                            placeholder="0.00"
                            value={line.credit_amount}
                            onChange={(e) => handleCreditChange(idx, e.target.value)}
                            disabled={submitting}
                            className="w-full text-right rounded border border-slate-300 bg-white px-2 py-1.5 text-xs text-slate-800 font-mono focus:border-brand-primary focus:outline-none focus:ring-1 focus:ring-brand-primary"
                          />
                        </td>

                        {/* Line Memo */}
                        <td className="py-2.5 px-3">
                          <input
                            type="text"
                            placeholder="Optional line memo"
                            value={line.narration}
                            onChange={(e) => handleLineFieldChange(idx, "narration", e.target.value)}
                            disabled={submitting}
                            className="w-full rounded border border-slate-300 bg-white px-2 py-1.5 text-xs text-slate-800 focus:border-brand-primary focus:outline-none focus:ring-1 focus:ring-brand-primary"
                          />
                        </td>

                        {/* Remove Action */}
                        <td className="py-2.5 px-2 text-center">
                          <button
                            type="button"
                            onClick={() => removeLine(idx)}
                            disabled={submitting || lines.length <= 2}
                            title={lines.length <= 2 ? "Minimum 2 lines required" : "Remove line"}
                            className="rounded p-1 text-slate-400 hover:text-red-600 hover:bg-red-50 disabled:opacity-30 disabled:cursor-not-allowed transition"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Live Presentation Balance Summary Bar */}
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-center gap-6">
                <div>
                  <span className="text-[11px] text-slate-500 block">Total Debits</span>
                  <span className="text-sm font-semibold font-mono text-brand-navy">
                    ₹{totalDebits.toFixed(2)}
                  </span>
                </div>
                <div>
                  <span className="text-[11px] text-slate-500 block">Total Credits</span>
                  <span className="text-sm font-semibold font-mono text-brand-navy">
                    ₹{totalCredits.toFixed(2)}
                  </span>
                </div>
                <div>
                  <span className="text-[11px] text-slate-500 block">Difference</span>
                  <span className={`text-sm font-semibold font-mono ${difference === 0 ? "text-slate-700" : "text-brand-gold"}`}>
                    ₹{difference.toFixed(2)}
                  </span>
                </div>
              </div>

              {/* Balance Status Badge */}
              <div className="flex items-center gap-2">
                {isBalanced ? (
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-800 border border-emerald-200">
                    <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                    Double-Entry Balanced (₹0.00 Diff)
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-brand-gold-light px-3 py-1 text-xs font-semibold text-brand-gold-dark border border-brand-gold/40">
                    <Scale className="h-3.5 w-3.5 text-brand-gold" />
                    Unbalanced: Diff is ₹{difference.toFixed(2)}
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-between border-t border-slate-200 bg-slate-50/90 px-6 py-4">
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 transition"
          >
            Cancel
          </button>

          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={() => handleSave(false)}
              disabled={submitting}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-4 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 shadow-sm transition disabled:opacity-50"
            >
              {submitting ? "Saving..." : (
                <>
                  <Save className="h-3.5 w-3.5" />
                  Save as Draft
                </>
              )}
            </button>

            <button
              type="button"
              onClick={() => handleSave(true)}
              disabled={submitting || !isBalanced}
              title={!isBalanced ? "Journal must be balanced before submitting" : "Save and submit for checker approval"}
              className="inline-flex items-center gap-1.5 rounded-lg bg-brand-primary px-4 py-2 text-xs font-medium text-white shadow-sm hover:bg-brand-navy transition disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {submitting ? "Submitting..." : (
                <>
                  <Send className="h-3.5 w-3.5" />
                  Save & Submit for Approval
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
