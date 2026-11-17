"use client";

import React, { useState, useEffect, useCallback } from "react";
import {
  X,
  Receipt,
  FileCheck2,
  AlertTriangle,
  CheckCircle2,
  RefreshCw,
  Coins,
  ArrowRight,
  ExternalLink,
  Plus,
  Ban,
  Clock,
} from "lucide-react";
import type { ExpenseRow, ExpenseCategoryRow } from "@frontend/lib/types/expense.types";

interface DrawerExpensePaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  branchId: string;
  branchName: string;
  tellerSessionId?: string;
  availableDrawerCash: number;
  onExpensePaid: () => void;
}

export function DrawerExpensePaymentModal({
  isOpen,
  onClose,
  branchId,
  branchName,
  tellerSessionId,
  availableDrawerCash,
  onExpensePaid,
}: DrawerExpensePaymentModalProps) {
  const [activeTab, setActiveTab] = useState<"pending_payment" | "review" | "submit">("pending_payment");
  const [expenses, setExpenses] = useState<ExpenseRow[]>([]);
  const [categories, setCategories] = useState<ExpenseCategoryRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // New Request Form State
  const [newDesc, setNewDesc] = useState("");
  const [newCatId, setNewCatId] = useState("");
  const [newAmount, setNewAmount] = useState("");
  const [newBillUrl, setNewBillUrl] = useState("");
  const [newNotes, setNewNotes] = useState("");

  // Reject State
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [rejectionReason, setRejectionReason] = useState("");

  const formatCurrency = (val: number | string | null | undefined) => {
    const num = Number(val || 0);
    return "₹" + num.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  // Load branch expenses
  const loadExpenses = useCallback(async () => {
    if (!branchId) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/v1/admin/expenses?branch_id=${branchId}&limit=50`);
      const data = await res.json();
      if (res.ok && data.data?.expenses) {
        setExpenses(data.data.expenses);
      } else {
        setError(data.error || "Failed to load branch expenses.");
      }
    } catch (e: any) {
      setError(e.message || "Failed to fetch expenses.");
    } finally {
      setLoading(false);
    }
  }, [branchId]);

  // Load categories
  const loadCategories = useCallback(async () => {
    try {
      const res = await fetch("/api/v1/admin/expense-categories");
      const data = await res.json();
      if (data.data) {
        setCategories(data.data);
      }
    } catch {
      // Fallback
    }
  }, []);

  useEffect(() => {
    if (isOpen) {
      loadExpenses();
      loadCategories();
      setSuccessMessage(null);
      setError(null);
      setRejectingId(null);
    }
  }, [isOpen, loadExpenses, loadCategories]);

  // Submit new expense request
  const handleSubmitNewExpense = async (e: React.FormEvent) => {
    e.preventDefault();
    const amt = parseFloat(newAmount);
    if (isNaN(amt) || amt <= 0) {
      setError("Please enter a positive expense amount.");
      return;
    }

    setActionLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/v1/admin/expenses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          branch_id: branchId,
          description: newDesc.trim(),
          category_id: newCatId || undefined,
          subtotal: amt,
          taxable_value: amt,
          total: amt,
          payment_method: "CASH",
          settlement_type: "DIRECT_PAYMENT",
          expense_date: new Date().toISOString().slice(0, 10),
          notes: newNotes || undefined,
          metadata: {
            bill_attachment_url: newBillUrl.trim() || undefined,
            business_purpose: newDesc.trim(),
          },
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        setError(data.error || "Failed to submit expense request.");
        return;
      }

      // Auto-submit for review
      await fetch(`/api/v1/admin/expenses/${data.data.id}/status`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "SUBMITTED" }),
      });

      setSuccessMessage("Expense request submitted for manager review. (No cash deducted yet).");
      setNewDesc("");
      setNewAmount("");
      setNewBillUrl("");
      setNewNotes("");
      setActiveTab("review");
      loadExpenses();
    } catch (e: any) {
      setError(e.message || "Failed to submit expense.");
    } finally {
      setActionLoading(false);
    }
  };

  // Manager approves expense (authorization to pay, cash NOT deducted)
  const handleApproveExpense = async (expId: string) => {
    setActionLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/v1/admin/expenses/${expId}/approve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        setError(data.error || "Failed to approve expense.");
        return;
      }
      setSuccessMessage("Expense approved! It is now eligible for payment from cash drawer.");
      loadExpenses();
    } catch (e: any) {
      setError(e.message || "Approval failed.");
    } finally {
      setActionLoading(false);
    }
  };

  // Manager rejects expense
  const handleRejectExpense = async (expId: string) => {
    if (!rejectionReason.trim()) {
      setError("Please provide a rejection reason.");
      return;
    }
    setActionLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/v1/admin/expenses/${expId}/reject`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rejection_reason: rejectionReason.trim() }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        setError(data.error || "Failed to reject expense.");
        return;
      }
      setSuccessMessage("Expense request rejected. No cash was deducted.");
      setRejectingId(null);
      setRejectionReason("");
      loadExpenses();
    } catch (e: any) {
      setError(e.message || "Rejection failed.");
    } finally {
      setActionLoading(false);
    }
  };

  // Manager pays approved expense from drawer cash
  const handlePayFromDrawer = async (exp: ExpenseRow) => {
    if (Number(exp.total) > availableDrawerCash) {
      setError(`Cannot disburse ${formatCurrency(exp.total)}: exceeds available drawer cash (${formatCurrency(availableDrawerCash)}).`);
      return;
    }

    setActionLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/v1/admin/expenses/${exp.id}/pay-drawer`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          branch_id: branchId,
          teller_session_id: tellerSessionId,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        setError(data.error || "Failed to pay expense from drawer.");
        return;
      }
      setSuccessMessage(`Successfully disbursed ${formatCurrency(exp.total)} for "${exp.description}". Drawer cash and GL ledger updated!`);
      loadExpenses();
      onExpensePaid();
    } catch (e: any) {
      setError(e.message || "Disbursement failed.");
    } finally {
      setActionLoading(false);
    }
  };

  if (!isOpen) return null;

  const approvedAwaitingPayment = expenses.filter(
    (e) => (e.status === "APPROVED" || e.status === "AWAITING_PAYMENT") && e.payment_method === "CASH"
  );
  const pendingReview = expenses.filter((e) => e.status === "SUBMITTED");

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-brand-gold-light dark:bg-brand-gold-dark/40 text-brand-gold-dark dark:text-brand-gold/40 rounded-lg">
              <Receipt className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-900 dark:text-white">
                Branch Cash Expenses & Bill Approvals
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {branchName} • Available Physical Cash in Drawer:{" "}
                <span className="font-bold text-slate-800 dark:text-slate-200">
                  {formatCurrency(availableDrawerCash)}
                </span>
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="Close modal"
            className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Tab navigation */}
        <div className="flex border-b border-slate-200 dark:border-slate-800 px-6 pt-2 bg-slate-50/50 dark:bg-slate-800/20">
          <button
            onClick={() => setActiveTab("pending_payment")}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors flex items-center space-x-2 ${
              activeTab === "pending_payment"
                ? "border-brand-gold text-brand-gold dark:text-brand-gold"
                : "border-transparent text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
            }`}
          >
            <Coins className="h-4 w-4" />
            <span>Approved Awaiting Payment ({approvedAwaitingPayment.length})</span>
          </button>
          <button
            onClick={() => setActiveTab("review")}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors flex items-center space-x-2 ${
              activeTab === "review"
                ? "border-brand-gold text-brand-gold dark:text-brand-gold"
                : "border-transparent text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
            }`}
          >
            <FileCheck2 className="h-4 w-4" />
            <span>Review & Approvals ({pendingReview.length})</span>
          </button>
          <button
            onClick={() => setActiveTab("submit")}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors flex items-center space-x-2 ${
              activeTab === "submit"
                ? "border-brand-gold text-brand-gold dark:text-brand-gold"
                : "border-transparent text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
            }`}
          >
            <Plus className="h-4 w-4" />
            <span>New Expense Request</span>
          </button>
        </div>

        {/* Notifications */}
        {error && (
          <div className="mx-6 mt-4 p-3 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 rounded-lg text-sm text-red-700 dark:text-red-300 flex items-center space-x-2">
            <AlertTriangle className="h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}
        {successMessage && (
          <div className="mx-6 mt-4 p-3 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 rounded-lg text-sm text-emerald-700 dark:text-emerald-300 flex items-center space-x-2">
            <CheckCircle2 className="h-4 w-4 shrink-0" />
            <span>{successMessage}</span>
          </div>
        )}

        {/* Content Body */}
        <div className="p-6 overflow-y-auto flex-1">
          {/* TAB 1: PENDING PAYMENT */}
          {activeTab === "pending_payment" && (
            <div className="space-y-4">
              {loading ? (
                <div className="py-8 text-center text-xs text-slate-500 flex items-center justify-center space-x-2">
                  <RefreshCw className="h-4 w-4 animate-spin" />
                  <span>Loading expenses...</span>
                </div>
              ) : approvedAwaitingPayment.length === 0 ? (
                <div className="py-12 text-center bg-slate-50 dark:bg-slate-800/20 border border-dashed rounded-xl">
                  <CheckCircle2 className="h-8 w-8 text-emerald-500 mx-auto mb-2 opacity-60" />
                  <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                    No approved expenses awaiting cash payment
                  </p>
                  <p className="text-xs text-slate-500 mt-1">
                    All approved expenses for {branchName} have been paid or none are currently scheduled.
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto border border-slate-200 dark:border-slate-800 rounded-lg">
                  <table className="w-full text-xs text-left">
                    <thead className="bg-slate-50 dark:bg-slate-800/60 text-slate-600 dark:text-slate-300 font-semibold border-b">
                      <tr>
                        <th className="px-4 py-3">Date</th>
                        <th className="px-4 py-3">Description</th>
                        <th className="px-4 py-3">Bill / Attachment</th>
                        <th className="px-4 py-3 text-right">Amount</th>
                        <th className="px-4 py-3 text-center">Status</th>
                        <th className="px-4 py-3 text-right">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                      {approvedAwaitingPayment.map((exp) => {
                        const isOverdraft = Number(exp.total) > availableDrawerCash;
                        const billUrl = typeof exp.metadata?.bill_attachment_url === "string" ? exp.metadata.bill_attachment_url : undefined;
                        return (
                          <tr key={exp.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30">
                            <td className="px-4 py-3 text-slate-500 font-mono">
                              {exp.expense_date}
                            </td>
                            <td className="px-4 py-3">
                              <div className="font-semibold text-slate-900 dark:text-white">
                                {exp.description}
                              </div>
                              <div className="text-[10px] text-slate-400">
                                Ref: {exp.reference_no || exp.id}
                              </div>
                            </td>
                            <td className="px-4 py-3">
                              {billUrl ? (
                                <a
                                  href={billUrl}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="inline-flex items-center text-blue-600 hover:underline space-x-1"
                                >
                                  <span>View Bill</span>
                                  <ExternalLink className="h-3 w-3" />
                                </a>
                              ) : (
                                <span className="text-slate-400 italic">No attachment</span>
                              )}
                            </td>
                            <td className="px-4 py-3 text-right font-bold text-base text-slate-900 dark:text-white">
                              {formatCurrency(exp.total)}
                            </td>
                            <td className="px-4 py-3 text-center">
                              <span className="inline-flex px-2 py-0.5 rounded text-[10px] font-semibold bg-brand-gold-light text-brand-gold-dark dark:bg-brand-gold-dark/40 dark:text-brand-gold/40">
                                Approved / Ready
                              </span>
                            </td>
                            <td className="px-4 py-3 text-right">
                              <button
                                onClick={() => handlePayFromDrawer(exp)}
                                disabled={actionLoading || isOverdraft}
                                title={isOverdraft ? "Disbursement exceeds available cash" : "Disburse cash from drawer"}
                                className={`px-3 py-1.5 text-xs font-bold rounded-md transition-colors ${
                                  isOverdraft
                                    ? "bg-slate-200 text-slate-400 cursor-not-allowed"
                                    : "bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm"
                                }`}
                              >
                                {isOverdraft ? "Insufficient Cash" : "Pay from Drawer"}
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* TAB 2: REVIEW & APPROVALS */}
          {activeTab === "review" && (
            <div className="space-y-4">
              {pendingReview.length === 0 ? (
                <div className="py-12 text-center bg-slate-50 dark:bg-slate-800/20 border border-dashed rounded-xl">
                  <CheckCircle2 className="h-8 w-8 text-slate-400 mx-auto mb-2 opacity-60" />
                  <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                    No submitted requests awaiting review
                  </p>
                  <p className="text-xs text-slate-500 mt-1">
                    All branch expense submissions have been reviewed.
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {pendingReview.map((exp) => {
                    const isRejecting = rejectingId === exp.id;
                    const billUrl = typeof exp.metadata?.bill_attachment_url === "string" ? exp.metadata.bill_attachment_url : undefined;
                    return (
                      <div
                        key={exp.id}
                        className="p-4 border border-slate-200 dark:border-slate-700 rounded-xl bg-slate-50/50 dark:bg-slate-800/30 flex flex-col md:flex-row md:items-center justify-between gap-4"
                      >
                        <div className="space-y-1">
                          <div className="flex items-center space-x-2">
                            <span className="font-bold text-slate-900 dark:text-white text-sm">
                              {exp.description}
                            </span>
                            <span className="text-[10px] px-2 py-0.5 rounded font-mono bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300">
                              SUBMITTED
                            </span>
                          </div>
                          <p className="text-xs text-slate-500">
                            Requested Date: {exp.expense_date} • Requester: {exp.created_by || "Staff"}
                            {exp.notes ? ` • Notes: ${String(exp.notes)}` : ""}
                          </p>
                          {billUrl && (
                            <a
                              href={billUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-flex items-center text-xs text-blue-600 hover:underline space-x-1"
                            >
                              <span>Inspect Bill Receipt Attachment</span>
                              <ExternalLink className="h-3 w-3" />
                            </a>
                          )}
                        </div>

                        <div className="flex items-center space-x-4">
                          <span className="text-lg font-bold text-slate-900 dark:text-white">
                            {formatCurrency(exp.total)}
                          </span>

                          {isRejecting ? (
                            <div className="flex items-center space-x-2">
                              <input
                                type="text"
                                placeholder="Rejection reason..."
                                value={rejectionReason}
                                onChange={(e) => setRejectionReason(e.target.value)}
                                className="px-2 py-1 text-xs border rounded bg-white dark:bg-slate-800"
                              />
                              <button
                                onClick={() => handleRejectExpense(exp.id)}
                                disabled={actionLoading}
                                className="px-3 py-1 text-xs font-bold bg-red-600 text-white rounded hover:bg-red-700"
                              >
                                Confirm Reject
                              </button>
                              <button
                                onClick={() => setRejectingId(null)}
                                className="px-2 py-1 text-xs text-slate-500"
                              >
                                Cancel
                              </button>
                            </div>
                          ) : (
                            <div className="flex items-center space-x-2">
                              <button
                                onClick={() => setRejectingId(exp.id)}
                                className="px-3 py-1.5 text-xs font-semibold text-red-700 bg-red-50 hover:bg-red-100 dark:bg-red-950/40 dark:hover:bg-red-900/40 rounded-lg transition-colors"
                              >
                                Reject
                              </button>
                              <button
                                onClick={() => handleApproveExpense(exp.id)}
                                disabled={actionLoading}
                                className="px-4 py-1.5 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-sm transition-colors flex items-center space-x-1"
                              >
                                <CheckCircle2 className="h-3.5 w-3.5" />
                                <span>Approve Request</span>
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* TAB 3: SUBMIT NEW REQUEST */}
          {activeTab === "submit" && (
            <form onSubmit={handleSubmitNewExpense} className="space-y-4 max-w-xl">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Expense Description & Business Purpose <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={newDesc}
                  onChange={(e) => setNewDesc(e.target.value)}
                  placeholder="e.g. Kitchen supplies, dairy replenishment, store maintenance"
                  className="w-full px-3 py-2 text-xs border border-slate-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Expense Category
                  </label>
                  <select
                    value={newCatId}
                    onChange={(e) => setNewCatId(e.target.value)}
                    className="w-full px-3 py-2 text-xs border border-slate-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800"
                  >
                    <option value="">-- General Operating (5299) --</option>
                    {categories.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name} {c.gl_account_code ? `(${c.gl_account_code})` : ""}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Requested Amount (₹) <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0.01"
                    required
                    value={newAmount}
                    onChange={(e) => setNewAmount(e.target.value)}
                    placeholder="e.g. 250.00"
                    className="w-full px-3 py-2 text-xs border border-slate-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 font-semibold"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Bill / Receipt Attachment URL
                </label>
                <input
                  type="text"
                  value={newBillUrl}
                  onChange={(e) => setNewBillUrl(e.target.value)}
                  placeholder="e.g. https://... or scanned receipt reference"
                  className="w-full px-3 py-2 text-xs border border-slate-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Supporting Notes / Supplier Info
                </label>
                <textarea
                  rows={2}
                  value={newNotes}
                  onChange={(e) => setNewNotes(e.target.value)}
                  placeholder="e.g. Vendor: Local Supermarket, Cash paid at counter."
                  className="w-full px-3 py-2 text-xs border border-slate-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800"
                />
              </div>

              <div className="flex justify-end pt-2">
                <button
                  type="submit"
                  disabled={actionLoading || !newDesc || !newAmount}
                  className="px-5 py-2 text-xs font-bold text-white bg-brand-gold hover:bg-brand-gold-dark disabled:opacity-50 rounded-lg transition-colors flex items-center space-x-2"
                >
                  {actionLoading ? <RefreshCw className="h-4 w-4 animate-spin" /> : <ArrowRight className="h-4 w-4" />}
                  <span>Submit Expense Request</span>
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
