"use client";

/**
 * CakeToHome ERP — Expense Management & General Ledger Panel (Admin)
 * Phase C5: Fully Integrated Double-Entry Expense Accounting
 *
 * Capabilities:
 * - Direct Settlement vs Supplier Credit/Accruals (AP 2111 with supplier dimension)
 * - Bank / UPI leaf GL account resolution (Bank Account master)
 * - Teller Cash Custody integration (C4 movement) or Petty Cash (GL 1114/1111)
 * - Indian GST: ITC Eligible vs Ineligible (capitalized per Sec 17(5)) & RCM liability (GL 2121-2129)
 * - Real-time General Ledger voucher inspection & balanced double-entry breakdown
 * - Maker-Checker Segregation of Duties (SoD) & GL Reversal Engine
 */

import React, { useState, useEffect, useCallback } from "react";
import {
  Receipt,
  FileText,
  RotateCcw,
  CheckCircle2,
  AlertTriangle,
  Send,
  Eye,
  Trash2,
  Building2,
  CreditCard,
  Layers,
  ArrowRight,
} from "lucide-react";
import type {
  ExpenseRow,
  ExpenseCategoryRow,
  ExpenseStatus,
  ExpenseCreateInput,
  ExpensePaymentMethod,
  ExpenseSettlementType,
  ExpenseItcEligibility,
} from "@frontend/lib/types/expense.types";

// ─── Types & Constants ────────────────────────────────────────────────────────

type Tab = "list" | "create" | "categories";

const STATUS_COLORS: Record<ExpenseStatus, string> = {
  DRAFT:            "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300",
  SUBMITTED:        "bg-blue-100 text-blue-800 dark:bg-blue-950/60 dark:text-blue-300",
  APPROVED:         "bg-brand-gold-light text-brand-gold-dark dark:bg-brand-gold-dark/60 dark:text-brand-gold/40",
  REJECTED:         "bg-red-100 text-red-800 dark:bg-red-950/60 dark:text-red-300",
  AWAITING_PAYMENT: "bg-brand-light text-brand-navy dark:bg-brand-navy/60 dark:text-brand-primary/30",
  PAID:             "bg-brand-light text-brand-navy dark:bg-brand-navy/60 dark:text-brand-primary/30",
  POSTED:           "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300",
  REVERSED:         "bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300",
  CANCELLED:        "bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400",
};

const PAYMENT_METHODS: ExpensePaymentMethod[] = ["CASH", "UPI", "BANK_TRANSFER", "CHEQUE", "CARD", "OTHER"];

function fmtCurrency(amount: number | string | null | undefined): string {
  const val = Number(amount || 0);
  return "₹" + val.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

// ─── Expense Panel Component ──────────────────────────────────────────────────

export default function ExpensePanel() {
  const [tab, setTab] = useState<Tab>("list");
  const [expenses, setExpenses] = useState<ExpenseRow[]>([]);
  const [categories, setCategories] = useState<ExpenseCategoryRow[]>([]);
  const [selected, setSelected] = useState<ExpenseRow | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [search, setSearch] = useState("");

  // Aux state for dropdowns
  const [bankAccounts, setBankAccounts] = useState<any[]>([]);
  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [tellerSessions, setTellerSessions] = useState<any[]>([]);

  // Accounting Details for selected expense
  const [accountingDetails, setAccountingDetails] = useState<any | null>(null);
  const [loadingAccounting, setLoadingAccounting] = useState(false);

  // Reversal Modal
  const [reversalModalOpen, setReversalModalOpen] = useState(false);
  const [reversalReason, setReversalReason] = useState("");
  const [cashReturnDest, setCashReturnDest] = useState<"TELLER_DRAWER" | "PETTY_CASH">("PETTY_CASH");

  // Create form state
  const [form, setForm] = useState<Partial<ExpenseCreateInput>>({
    subtotal: 0,
    discount: 0,
    taxable_value: 0,
    cgst: 0,
    sgst: 0,
    igst: 0,
    total: 0,
    settlement_type: "DIRECT_PAYMENT",
    payment_method: "CASH",
    itc_eligibility: "ITC_ELIGIBLE",
    rcm_applicable: false,
  });

  // Category form state
  const [catForm, setCatForm] = useState({ name: "", description: "" });
  const [allCategories, setAllCategories] = useState<ExpenseCategoryRow[]>([]);

  const showSuccess = (msg: string) => { setSuccess(msg); setTimeout(() => setSuccess(null), 4000); };
  const showError   = (msg: string) => { setError(msg);   setTimeout(() => setError(null),   6000); };

  // ── Loaders ─────────────────────────────────────────────────────────────────

  const loadExpenses = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (statusFilter) params.set("status", statusFilter);
      if (search) params.set("search", search);
      params.set("limit", "100");
      const res = await fetch(`/api/v1/admin/expenses?${params}`);
      const data = await res.json();
      if (data.success) setExpenses(data.data?.expenses || []);
      else showError(data.error || "Failed to load expenses");
    } catch { showError("Network error loading expenses."); }
    finally { setLoading(false); }
  }, [statusFilter, search]);

  const loadCategories = useCallback(async (includeInactive = false) => {
    try {
      const res = await fetch(`/api/v1/admin/expense-categories?include_inactive=${includeInactive}`);
      const data = await res.json();
      if (data.success) {
        if (includeInactive) setAllCategories(data.data || []);
        else setCategories(data.data || []);
      }
    } catch {}
  }, []);

  const loadAuxData = useCallback(async () => {
    try {
      const [bankRes, suppRes, tellRes] = await Promise.all([
        fetch("/api/v1/admin/bank-accounts").then(r => r.json()).catch(() => ({})),
        fetch("/api/v1/admin/suppliers?limit=100").then(r => r.json()).catch(() => ({})),
        fetch("/api/v1/admin/teller/sessions/active").then(r => r.json()).catch(() => ({})),
      ]);
      if (bankRes.success && bankRes.data) setBankAccounts(bankRes.data);
      else if (bankRes.bankAccounts) setBankAccounts(bankRes.bankAccounts);
      if (suppRes.success && suppRes.data?.suppliers) setSuppliers(suppRes.data.suppliers);
      if (tellRes.success && tellRes.data?.sessions) setTellerSessions(tellRes.data.sessions);
      else if (Array.isArray(tellRes.data)) setTellerSessions(tellRes.data);
    } catch {}
  }, []);

  useEffect(() => {
    loadExpenses();
    loadCategories(false);
    loadAuxData();
  }, [loadExpenses, loadCategories, loadAuxData]);

  useEffect(() => {
    if (tab === "categories") loadCategories(true);
  }, [tab, loadCategories]);

  // Load accounting details when selected
  useEffect(() => {
    if (selected?.id) {
      setLoadingAccounting(true);
      fetch(`/api/v1/admin/expenses/${selected.id}/accounting`)
        .then(r => r.json())
        .then(d => {
          if (d.success) setAccountingDetails(d.data);
          else setAccountingDetails(null);
        })
        .catch(() => setAccountingDetails(null))
        .finally(() => setLoadingAccounting(false));
    } else {
      setAccountingDetails(null);
    }
  }, [selected?.id]);

  // ── Calculation & Form Change ───────────────────────────────────────────────

  const computeTotals = (f: Partial<ExpenseCreateInput>) => {
    const subtotal = Number(f.subtotal ?? 0);
    const discount = Number(f.discount ?? 0);
    const taxableValue = Math.max(0, subtotal - discount);
    const cgst = Number(f.cgst ?? 0);
    const sgst = Number(f.sgst ?? 0);
    const igst = Number(f.igst ?? 0);
    const total = +(taxableValue + cgst + sgst + igst).toFixed(2);
    return { ...f, taxable_value: +taxableValue.toFixed(2), total };
  };

  const handleFormChange = (field: keyof ExpenseCreateInput, value: unknown) => {
    const updated = { ...form, [field]: value };
    const withTotals = ["subtotal", "discount", "cgst", "sgst", "igst"].includes(field)
      ? computeTotals(updated)
      : updated;
    setForm(withTotals);
  };

  // ── Create Expense ─────────────────────────────────────────────────────────

  const handleCreate = async () => {
    if (!form.description?.trim()) return showError("Description is required.");
    if (!form.expense_date) return showError("Expense date is required.");
    if (form.settlement_type === "CREDIT_ACCRUAL" && !form.supplier_id) {
      return showError("Supplier is required for Credit / Accrual expenses.");
    }
    setLoading(true);
    try {
      const res = await fetch("/api/v1/admin/expenses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (data.success) {
        showSuccess("Expense created successfully in DRAFT.");
        setForm({
          subtotal: 0,
          discount: 0,
          taxable_value: 0,
          cgst: 0,
          sgst: 0,
          igst: 0,
          total: 0,
          settlement_type: "DIRECT_PAYMENT",
          payment_method: "CASH",
          itc_eligibility: "ITC_ELIGIBLE",
          rcm_applicable: false,
        });
        setTab("list");
        loadExpenses();
      } else {
        showError(data.error || "Failed to create expense.");
      }
    } catch { showError("Network error creating expense."); }
    finally { setLoading(false); }
  };

  // ── Lifecycle Transitions ──────────────────────────────────────────────────

  const handleStatusChange = async (expense: ExpenseRow, newStatus: ExpenseStatus) => {
    setLoading(true);
    try {
      let endpoint = `/api/v1/admin/expenses/${expense.id}/status`;
      let body: any = { status: newStatus };

      if (newStatus === "APPROVED") {
        endpoint = `/api/v1/admin/expenses/${expense.id}/approve`;
        body = {};
      } else if (newStatus === "POSTED") {
        endpoint = `/api/v1/admin/expenses/${expense.id}/post`;
        body = {};
      }

      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (data.success) {
        showSuccess(`Expense ${newStatus.toLowerCase()} successfully.`);
        loadExpenses();
        if (selected?.id === expense.id) {
          const updatedRes = await fetch(`/api/v1/admin/expenses/${expense.id}`);
          const updatedData = await updatedRes.json();
          if (updatedData.success && updatedData.data) {
            setSelected(updatedData.data);
          }
        }
      } else {
        showError(data.error || `Failed to update status to ${newStatus}.`);
      }
    } catch { showError("Network error updating expense status."); }
    finally { setLoading(false); }
  };

  // ── GL Reversal ────────────────────────────────────────────────────────────

  const handleExecuteReversal = async () => {
    if (!selected || !reversalReason.trim()) return showError("Reversal reason is required.");
    setLoading(true);
    try {
      const res = await fetch(`/api/v1/admin/expenses/${selected.id}/reverse`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          reversal_reason: reversalReason.trim(),
          cash_return_destination: selected.payment_method === "CASH" ? cashReturnDest : undefined,
        }),
      });
      const data = await res.json();
      if (data.success) {
        showSuccess("Expense reversed successfully in General Ledger.");
        setReversalModalOpen(false);
        setReversalReason("");
        const updatedRes = await fetch(`/api/v1/admin/expenses/${selected.id}`);
        const updatedData = await updatedRes.json();
        if (updatedData.success && updatedData.data) {
          setSelected(updatedData.data);
        }
        loadExpenses();
      } else {
        showError(data.error || "Failed to reverse expense.");
      }
    } catch { showError("Network error reversing expense."); }
    finally { setLoading(false); }
  };

  // ── Delete ─────────────────────────────────────────────────────────────────

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this draft expense? This cannot be undone.")) return;
    try {
      const res = await fetch(`/api/v1/admin/expenses/${id}`, { method: "DELETE" });
      const data = await res.json();
      if (data.success) {
        showSuccess("Expense deleted.");
        setSelected(null);
        loadExpenses();
      } else {
        showError(data.error || "Failed to delete.");
      }
    } catch { showError("Network error."); }
  };

  // ── Category Actions ───────────────────────────────────────────────────────

  const handleCreateCategory = async () => {
    if (!catForm.name.trim()) return showError("Category name is required.");
    try {
      const res = await fetch("/api/v1/admin/expense-categories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(catForm),
      });
      const data = await res.json();
      if (data.success) {
        showSuccess("Category created.");
        setCatForm({ name: "", description: "" });
        loadCategories(true);
        loadCategories(false);
      } else {
        showError(data.error || "Failed to create category.");
      }
    } catch { showError("Network error."); }
  };

  const handleToggleCategory = async (cat: ExpenseCategoryRow) => {
    try {
      const res = await fetch(`/api/v1/admin/expense-categories/${cat.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ is_active: !cat.is_active }),
      });
      const data = await res.json();
      if (data.success) { showSuccess("Category updated."); loadCategories(true); loadCategories(false); }
      else showError(data.error || "Failed.");
    } catch { showError("Network error."); }
  };

  // ─── RENDER ────────────────────────────────────────────────────────────────

  return (
    <div className="p-4 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-brand-gold/10 text-brand-gold dark:text-brand-gold flex items-center justify-center font-bold">
              <Receipt className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-xl font-black text-slate-900 dark:text-white tracking-tight">
                Expense Management &amp; General Ledger
              </h1>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Phase C5: Double-Entry Accruals · Custody Settlement · Indian GST &amp; RCM · SoD Lifecycle
              </p>
            </div>
          </div>
        </div>

        <div className="flex gap-2">
          {(["list", "create", "categories"] as Tab[]).map((t) => (
            <button
              key={t}
              onClick={() => { setTab(t); setSelected(null); }}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition ${
                tab === t
                  ? "bg-brand-gold text-white shadow-md shadow-brand-gold/20"
                  : "bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300"
              }`}
            >
              {t === "list" ? "Expenses" : t === "create" ? "+ New Expense" : "Categories & CoA"}
            </button>
          ))}
        </div>
      </div>

      {/* Alerts */}
      {success && (
        <div className="p-4 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-200 text-xs font-semibold flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{success}</span>
          </div>
          <button onClick={() => setSuccess(null)} className="text-emerald-600 font-bold">✕</button>
        </div>
      )}
      {error && (
        <div className="p-4 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-rose-800 dark:text-rose-200 text-xs font-semibold flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
            <span>{error}</span>
          </div>
          <button onClick={() => setError(null)} className="text-rose-600 font-bold">✕</button>
        </div>
      )}

      {/* ── LIST TAB ────────────────────────────────────────────────────────── */}
      {tab === "list" && !selected && (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm space-y-4">
          <div className="flex flex-col sm:flex-row gap-3">
            <input
              className="border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs flex-1 bg-transparent text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-brand-gold"
              placeholder="Search by description, reference, or supplier..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && loadExpenses()}
            />
            <select
              className="border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs bg-white dark:bg-slate-800 text-slate-900 dark:text-white outline-none"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
            >
              <option value="">All Statuses</option>
              {(["DRAFT", "SUBMITTED", "APPROVED", "POSTED", "REVERSED"] as ExpenseStatus[]).map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
            <button
              onClick={loadExpenses}
              disabled={loading}
              className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-xs font-bold transition"
            >
              Filter
            </button>
          </div>

          {loading ? (
            <div className="text-center py-12 text-xs text-slate-400 font-medium">Loading operational expenses...</div>
          ) : expenses.length === 0 ? (
            <div className="text-center py-12 text-xs text-slate-400 font-medium">No expenses found matching criteria.</div>
          ) : (
            <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 dark:bg-slate-800/60 text-slate-500 uppercase font-bold tracking-wider border-b border-slate-200 dark:border-slate-800">
                  <tr>
                    <th className="py-3 px-4">Date</th>
                    <th className="py-3 px-4">Description</th>
                    <th className="py-3 px-4">Category</th>
                    <th className="py-3 px-4">Settlement</th>
                    <th className="py-3 px-4 text-right">Taxable</th>
                    <th className="py-3 px-4 text-right">Total</th>
                    <th className="py-3 px-4 text-center">Status</th>
                    <th className="py-3 px-4">GL Voucher</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {expenses.map((e) => (
                    <tr
                      key={e.id}
                      onClick={() => setSelected(e)}
                      className="hover:bg-slate-50 dark:hover:bg-slate-800/40 cursor-pointer transition"
                    >
                      <td className="py-3 px-4 text-slate-600 dark:text-slate-400 whitespace-nowrap">{e.expense_date}</td>
                      <td className="py-3 px-4 max-w-xs truncate font-medium text-slate-900 dark:text-white">
                        {e.description}
                      </td>
                      <td className="py-3 px-4 text-slate-600 dark:text-slate-400">
                        {e.category_name || "General"}
                      </td>
                      <td className="py-3 px-4">
                        <span className="font-semibold text-slate-700 dark:text-slate-300">
                          {e.payment_method || "—"}
                        </span>
                        <span className="block text-[10px] text-slate-400 font-mono">
                          {e.settlement_type === "CREDIT_ACCRUAL" ? "CREDIT/AP" : e.settlement_type === "BRANCH_PAID" ? "BRANCH PAID" : "DIRECT"}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right font-mono text-slate-700 dark:text-slate-300">
                        {fmtCurrency(e.taxable_value)}
                      </td>
                      <td className="py-3 px-4 text-right font-mono font-bold text-brand-gold dark:text-brand-gold">
                        {fmtCurrency(e.total)}
                      </td>
                      <td className="py-3 px-4 text-center">
                        <span className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold ${STATUS_COLORS[e.status]}`}>
                          {e.status}
                        </span>
                      </td>
                      <td className="py-3 px-4 font-mono text-[11px] text-slate-500">
                        {e.voucher_no || (e.voucher_id ? `V-${e.voucher_id.slice(0, 8)}` : "—")}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ── DETAIL VIEW ─────────────────────────────────────────────────────── */}
      {tab === "list" && selected && (
        <div className="space-y-6">
          <button
            onClick={() => setSelected(null)}
            className="text-xs font-bold text-brand-gold hover:text-brand-gold-dark flex items-center gap-1.5 transition"
          >
            ← Back to expense register
          </button>

          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-sm space-y-6">
            {/* Top row */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-5">
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-lg font-black text-slate-900 dark:text-white tracking-tight">
                    {selected.description}
                  </h2>
                  <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold ${STATUS_COLORS[selected.status]}`}>
                    {selected.status}
                  </span>
                </div>
                <p className="text-xs text-slate-500 mt-1">
                  Recorded: {selected.expense_date} · Category: <strong className="text-slate-700 dark:text-slate-300">{selected.category_name || "General"}</strong>
                  {selected.branch_name && ` · Branch: ${selected.branch_name}`}
                </p>
              </div>

              {/* Lifecycle Actions */}
              <div className="flex items-center gap-2">
                {selected.status === "DRAFT" && (
                  <>
                    <button
                      onClick={() => handleStatusChange(selected, "SUBMITTED")}
                      disabled={loading}
                      className="px-4 py-2 rounded-xl text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white transition shadow-sm"
                    >
                      Submit for Approval
                    </button>
                    <button
                      onClick={() => handleDelete(selected.id)}
                      disabled={loading}
                      className="px-3 py-2 rounded-xl text-xs font-bold bg-rose-50 text-rose-600 hover:bg-rose-100 transition"
                    >
                      Delete
                    </button>
                  </>
                )}

                {selected.status === "SUBMITTED" && (
                  <>
                    <button
                      onClick={() => handleStatusChange(selected, "DRAFT")}
                      disabled={loading}
                      className="px-3 py-2 rounded-xl text-xs font-bold bg-slate-100 hover:bg-slate-200 text-slate-700 transition"
                    >
                      Return to Draft
                    </button>
                    <button
                      onClick={() => handleStatusChange(selected, "APPROVED")}
                      disabled={loading}
                      className="px-4 py-2 rounded-xl text-xs font-bold bg-brand-gold hover:bg-brand-gold-dark text-white transition shadow-sm"
                    >
                      Approve Claim
                    </button>
                  </>
                )}

                {selected.status === "APPROVED" && (
                  <button
                    onClick={() => handleStatusChange(selected, "POSTED")}
                    disabled={loading}
                    className="px-4 py-2 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white transition flex items-center gap-1.5 shadow-sm"
                  >
                    <Send className="w-3.5 h-3.5" />
                    <span>Post to General Ledger</span>
                  </button>
                )}

                {selected.status === "POSTED" && (
                  <button
                    onClick={() => {
                      setReversalReason("");
                      setReversalModalOpen(true);
                    }}
                    disabled={loading}
                    className="px-4 py-2 rounded-xl text-xs font-bold bg-rose-100 text-rose-700 hover:bg-rose-200 transition flex items-center gap-1.5"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>Reverse Expense</span>
                  </button>
                )}
              </div>
            </div>

            {/* Financial Metrics */}
            <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3 text-xs">
              <div className="bg-slate-50 dark:bg-slate-800/40 p-3 rounded-2xl">
                <span className="text-slate-400 block font-semibold text-[11px]">Subtotal</span>
                <span className="font-mono font-bold text-slate-800 dark:text-slate-200">{fmtCurrency(selected.subtotal)}</span>
              </div>
              <div className="bg-slate-50 dark:bg-slate-800/40 p-3 rounded-2xl">
                <span className="text-slate-400 block font-semibold text-[11px]">Discount</span>
                <span className="font-mono font-bold text-slate-800 dark:text-slate-200">{fmtCurrency(selected.discount)}</span>
              </div>
              <div className="bg-slate-50 dark:bg-slate-800/40 p-3 rounded-2xl">
                <span className="text-slate-400 block font-semibold text-[11px]">Taxable</span>
                <span className="font-mono font-bold text-slate-800 dark:text-slate-200">{fmtCurrency(selected.taxable_value)}</span>
              </div>
              <div className="bg-slate-50 dark:bg-slate-800/40 p-3 rounded-2xl">
                <span className="text-slate-400 block font-semibold text-[11px]">CGST</span>
                <span className="font-mono font-bold text-slate-800 dark:text-slate-200">{fmtCurrency(selected.cgst)}</span>
              </div>
              <div className="bg-slate-50 dark:bg-slate-800/40 p-3 rounded-2xl">
                <span className="text-slate-400 block font-semibold text-[11px]">SGST</span>
                <span className="font-mono font-bold text-slate-800 dark:text-slate-200">{fmtCurrency(selected.sgst)}</span>
              </div>
              <div className="bg-slate-50 dark:bg-slate-800/40 p-3 rounded-2xl">
                <span className="text-slate-400 block font-semibold text-[11px]">IGST</span>
                <span className="font-mono font-bold text-slate-800 dark:text-slate-200">{fmtCurrency(selected.igst)}</span>
              </div>
              <div className="bg-brand-gold-light/80 dark:bg-brand-gold-dark/30 border border-brand-gold/40 dark:border-brand-gold-dark/60 p-3 rounded-2xl">
                <span className="text-brand-gold-dark dark:text-brand-gold/40 block font-bold text-[11px]">Total Claim</span>
                <span className="font-mono font-black text-brand-gold dark:text-brand-gold text-sm">{fmtCurrency(selected.total)}</span>
              </div>
            </div>

            {/* Settlement & GST Dimension Metadata */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
              <div className="border border-slate-200 dark:border-slate-800 rounded-2xl p-4 space-y-2">
                <h4 className="font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                  <CreditCard className="w-4 h-4 text-slate-500" />
                  <span>Settlement &amp; Accounting Flow</span>
                </h4>
                <div className="grid grid-cols-2 gap-2 text-[11px]">
                  <div><span className="text-slate-400">Settlement Type:</span> <strong className="text-slate-700 dark:text-slate-300">{selected.settlement_type}</strong></div>
                  <div><span className="text-slate-400">Payment Method:</span> <strong className="text-slate-700 dark:text-slate-300">{selected.payment_method || "—"}</strong></div>
                  <div><span className="text-slate-400">Reference No:</span> <span className="font-mono">{selected.reference_no || "—"}</span></div>
                  <div><span className="text-slate-400">Supplier / Vendor:</span> <strong className="text-slate-700 dark:text-slate-300">{selected.supplier_name || "—"}</strong></div>
                  {selected.bank_account_name && (
                    <div className="col-span-2"><span className="text-slate-400">Bank Destination:</span> <strong className="text-blue-600">{selected.bank_account_name}</strong></div>
                  )}
                  {selected.teller_session_id && (
                    <div className="col-span-2"><span className="text-slate-400">Teller Cash Session:</span> <span className="font-mono">{selected.teller_session_id}</span></div>
                  )}
                </div>
              </div>

              <div className="border border-slate-200 dark:border-slate-800 rounded-2xl p-4 space-y-2">
                <h4 className="font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                  <Building2 className="w-4 h-4 text-slate-500" />
                  <span>Indian GST &amp; Tax Compliance</span>
                </h4>
                <div className="grid grid-cols-2 gap-2 text-[11px]">
                  <div><span className="text-slate-400">ITC Eligibility:</span> <strong className={selected.itc_eligibility === "ITC_ELIGIBLE" ? "text-emerald-600" : "text-brand-gold"}>{selected.itc_eligibility}</strong></div>
                  <div><span className="text-slate-400">RCM Applicable:</span> <strong className={selected.rcm_applicable ? "text-brand-primary" : "text-slate-600"}>{selected.rcm_applicable ? "YES" : "NO"}</strong></div>
                  <div><span className="text-slate-400">HSN / SAC Code:</span> <span className="font-mono">{selected.hsn_sac_code || "—"}</span></div>
                  <div><span className="text-slate-400">Vendor GSTIN:</span> <span className="font-mono">{selected.vendor_gstin || "—"}</span></div>
                </div>
              </div>
            </div>

            {/* General Ledger Live Double-Entry Breakdown */}
            <div className="border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-xs">
              <div className="px-5 py-3.5 bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
                <div>
                  <h4 className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-2">
                    <FileText className="w-4 h-4 text-blue-600" />
                    <span>General Ledger Double-Entry Audit Trail</span>
                  </h4>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    {accountingDetails?.voucher ? `Authoritative Voucher: ${accountingDetails.voucher.voucher_no || accountingDetails.voucher.id}` : "Pending General Ledger posting"}
                  </p>
                </div>
                {accountingDetails?.voucher && (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300">
                    ✓ BALANCED (Dr === Cr)
                  </span>
                )}
              </div>

              {loadingAccounting ? (
                <div className="text-center py-6 text-xs text-slate-400">Loading General Ledger records...</div>
              ) : !accountingDetails?.journal_lines || accountingDetails.journal_lines.length === 0 ? (
                <div className="p-6 text-center text-xs text-slate-400 font-medium">
                  {selected.status === "DRAFT" || selected.status === "SUBMITTED"
                    ? "Voucher will be prepared and balanced upon submission/approval, then posted to the General Ledger."
                    : "No journal entry lines recorded for this expense."}
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-100 dark:bg-slate-800/80 text-slate-600 uppercase font-bold tracking-wider">
                      <tr>
                        <th className="py-2.5 px-4">Line #</th>
                        <th className="py-2.5 px-4">GL Account</th>
                        <th className="py-2.5 px-4">Narration / Party Dimension</th>
                        <th className="py-2.5 px-4 text-right">Debit (Dr)</th>
                        <th className="py-2.5 px-4 text-right">Credit (Cr)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                      {accountingDetails.journal_lines.map((jl: any, idx: number) => (
                        <tr key={idx} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                          <td className="py-2.5 px-4 font-mono text-slate-400">{idx + 1}</td>
                          <td className="py-2.5 px-4 font-bold text-slate-900 dark:text-white">
                            <span className="font-mono text-blue-600 mr-1.5">{jl.account_code || "—"}</span>
                            <span>{jl.account_name || jl.account_id}</span>
                          </td>
                          <td className="py-2.5 px-4 text-slate-600 dark:text-slate-400 max-w-sm truncate">
                            {jl.narration || (jl.supplier_name ? `Party: ${jl.supplier_name}` : "—")}
                          </td>
                          <td className="py-2.5 px-4 text-right font-mono font-semibold text-slate-900 dark:text-white">
                            {Number(jl.debit) > 0 ? fmtCurrency(jl.debit) : "—"}
                          </td>
                          <td className="py-2.5 px-4 text-right font-mono font-semibold text-slate-900 dark:text-white">
                            {Number(jl.credit) > 0 ? fmtCurrency(jl.credit) : "—"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot className="bg-slate-50 dark:bg-slate-800/60 font-black border-t border-slate-200 dark:border-slate-800">
                      <tr>
                        <td colSpan={3} className="py-2.5 px-4 text-right uppercase text-[11px] text-slate-500">Totals</td>
                        <td className="py-2.5 px-4 text-right font-mono text-emerald-600">
                          {fmtCurrency(accountingDetails.journal_lines.reduce((acc: number, l: any) => acc + Number(l.debit || 0), 0))}
                        </td>
                        <td className="py-2.5 px-4 text-right font-mono text-emerald-600">
                          {fmtCurrency(accountingDetails.journal_lines.reduce((acc: number, l: any) => acc + Number(l.credit || 0), 0))}
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              )}

              {/* If reversed: show reversal audit block */}
              {accountingDetails?.reversal_voucher && (
                <div className="p-4 bg-rose-50/60 dark:bg-rose-950/20 border-t border-rose-200 dark:border-rose-900/60 text-xs space-y-2">
                  <div className="flex items-center gap-2 text-rose-700 dark:text-rose-300 font-bold">
                    <RotateCcw className="w-4 h-4" />
                    <span>Reversal Compensating Voucher: {accountingDetails.reversal_voucher.voucher_no || accountingDetails.reversal_voucher.id}</span>
                  </div>
                  <div className="text-[11px] text-slate-600 dark:text-slate-400">
                    <span>Reversed By: <strong>{selected.reversed_by}</strong> · Reason: <em>"{selected.reversal_reason}"</em></span>
                  </div>
                </div>
              )}
            </div>

            {/* Maker-Checker Audit Trail */}
            <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 text-xs flex flex-wrap gap-6 text-slate-600 dark:text-slate-400">
              <div><span className="text-slate-400 block">Created By (Maker):</span> <strong className="text-slate-800 dark:text-slate-200">{selected.created_by || "system"}</strong></div>
              <div><span className="text-slate-400 block">Approved By (Checker):</span> <strong className="text-slate-800 dark:text-slate-200">{selected.approved_by || "—"}</strong></div>
              <div><span className="text-slate-400 block">GL Posted At:</span> <strong className="text-slate-800 dark:text-slate-200">{selected.posted_at || "—"}</strong></div>
              {selected.reversed_at && (
                <div><span className="text-slate-400 block">Reversed At:</span> <strong className="text-rose-600">{selected.reversed_at}</strong></div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── CREATE TAB ──────────────────────────────────────────────────────── */}
      {tab === "create" && (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-sm max-w-3xl mx-auto space-y-5">
          <div>
            <h3 className="text-base font-black text-slate-900 dark:text-white">Record New Expense</h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Enter operational expenditure. Generates an unposted voucher draft complying with the Chart of Accounts.
            </p>
          </div>

          <div className="space-y-4">
            {/* Date & Category */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">Expense Date *</label>
                <input
                  type="date"
                  className="w-full border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs bg-white dark:bg-slate-800 text-slate-900 dark:text-white outline-none"
                  value={form.expense_date || ""}
                  onChange={(e) => handleFormChange("expense_date", e.target.value)}
                />
              </div>
              <div>
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">Category &amp; GL Account *</label>
                <select
                  className="w-full border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs bg-white dark:bg-slate-800 text-slate-900 dark:text-white outline-none"
                  value={form.category_id || ""}
                  onChange={(e) => handleFormChange("category_id", e.target.value || null)}
                >
                  <option value="">— Select Category —</option>
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} {c.gl_account_code ? `(${c.gl_account_code})` : ""}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Description */}
            <div>
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">Description *</label>
              <input
                className="w-full border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs bg-white dark:bg-slate-800 text-slate-900 dark:text-white outline-none"
                placeholder="e.g. Electricity bill for Koramangala store, monthly packing material purchase"
                value={form.description || ""}
                onChange={(e) => handleFormChange("description", e.target.value)}
              />
            </div>

            {/* Settlement Type & Payment Method */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 border-t border-slate-200 dark:border-slate-800 pt-4">
              <div>
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">Settlement Type *</label>
                <select
                  className="w-full border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs bg-white dark:bg-slate-800 text-slate-900 dark:text-white outline-none"
                  value={form.settlement_type}
                  onChange={(e) => handleFormChange("settlement_type", e.target.value as ExpenseSettlementType)}
                >
                  <option value="DIRECT_PAYMENT">Direct Payment (Immediate)</option>
                  <option value="CREDIT_ACCRUAL">Credit / Accrual (AP 2111)</option>
                  <option value="BRANCH_PAID">Paid by branch (reimburse later)</option>
                </select>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">Payment Method</label>
                <select
                  className="w-full border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs bg-white dark:bg-slate-800 text-slate-900 dark:text-white outline-none"
                  value={form.payment_method || ""}
                  onChange={(e) => handleFormChange("payment_method", e.target.value as ExpensePaymentMethod)}
                >
                  {PAYMENT_METHODS.map((m) => (
                    <option key={m} value={m}>{m}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">Supplier / Vendor</label>
                <select
                  className="w-full border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs bg-white dark:bg-slate-800 text-slate-900 dark:text-white outline-none"
                  value={form.supplier_id || ""}
                  onChange={(e) => handleFormChange("supplier_id", e.target.value || null)}
                >
                  <option value="">— Select Supplier —</option>
                  {suppliers.map((s) => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Conditional: Bank Account / Teller Drawer */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {["BANK_TRANSFER", "UPI", "CHEQUE", "CARD"].includes(form.payment_method || "") && (
                <div>
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                    Company Bank Account (GL Leaf)
                  </label>
                  <select
                    className="w-full border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs bg-white dark:bg-slate-800 text-slate-900 dark:text-white outline-none"
                    value={form.bank_account_id || ""}
                    onChange={(e) => handleFormChange("bank_account_id", e.target.value || null)}
                  >
                    <option value="">— Operating Bank Account (Default 1112) —</option>
                    {bankAccounts.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.bank_name} - {b.account_number} ({b.account_name})
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {form.payment_method === "CASH" && (
                <div>
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                    Cash Source (Teller Drawer vs Petty Cash)
                  </label>
                  <select
                    className="w-full border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs bg-white dark:bg-slate-800 text-slate-900 dark:text-white outline-none"
                    value={form.teller_session_id || ""}
                    onChange={(e) => handleFormChange("teller_session_id", e.target.value || null)}
                  >
                    <option value="">Petty Cash / Safe (GL 1114 - No Drawer Movement)</option>
                    {tellerSessions.map((ts) => (
                      <option key={ts.id} value={ts.id}>
                        Active Session: {ts.teller_name || ts.id.slice(0, 10)}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div>
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">Invoice / Reference No.</label>
                <input
                  className="w-full border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs bg-white dark:bg-slate-800 text-slate-900 dark:text-white outline-none"
                  placeholder="e.g. INV-2026-091"
                  value={form.reference_no || ""}
                  onChange={(e) => handleFormChange("reference_no", e.target.value || null)}
                />
              </div>
            </div>

            {/* GST Controls */}
            <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 space-y-3">
              <h4 className="text-xs font-bold text-slate-800 dark:text-slate-200">
                GST &amp; Tax Compliance Controls
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 text-xs">
                <div>
                  <label className="text-[11px] font-semibold text-slate-500 block mb-1">ITC Eligibility</label>
                  <select
                    className="w-full border border-slate-200 dark:border-slate-700 rounded-xl px-2.5 py-1.5 text-xs bg-white dark:bg-slate-800 text-slate-900 dark:text-white outline-none"
                    value={form.itc_eligibility}
                    onChange={(e) => handleFormChange("itc_eligibility", e.target.value as ExpenseItcEligibility)}
                  >
                    <option value="ITC_ELIGIBLE">Eligible (Dr Input GST 114x)</option>
                    <option value="ITC_INELIGIBLE">Ineligible (Capitalized to Expense)</option>
                  </select>
                </div>
                <div className="flex items-center gap-2 pt-6">
                  <input
                    type="checkbox"
                    id="rcm_cb"
                    checked={!!form.rcm_applicable}
                    onChange={(e) => handleFormChange("rcm_applicable", e.target.checked)}
                    className="rounded border-slate-300 text-brand-gold focus:ring-brand-gold"
                  />
                  <label htmlFor="rcm_cb" className="text-xs font-semibold text-slate-700 dark:text-slate-300 cursor-pointer">
                    RCM Applicable
                  </label>
                </div>
                <div>
                  <label className="text-[11px] font-semibold text-slate-500 block mb-1">HSN / SAC Code</label>
                  <input
                    className="w-full border border-slate-200 dark:border-slate-700 rounded-xl px-2.5 py-1.5 text-xs bg-white dark:bg-slate-800 text-slate-900 dark:text-white outline-none font-mono"
                    placeholder="e.g. 998311"
                    value={form.hsn_sac_code || ""}
                    onChange={(e) => handleFormChange("hsn_sac_code", e.target.value || null)}
                  />
                </div>
                <div>
                  <label className="text-[11px] font-semibold text-slate-500 block mb-1">Vendor GSTIN</label>
                  <input
                    className="w-full border border-slate-200 dark:border-slate-700 rounded-xl px-2.5 py-1.5 text-xs bg-white dark:bg-slate-800 text-slate-900 dark:text-white outline-none font-mono uppercase"
                    placeholder="29AAAAA0000A1Z5"
                    value={form.vendor_gstin || ""}
                    onChange={(e) => handleFormChange("vendor_gstin", e.target.value || null)}
                  />
                </div>
              </div>
            </div>

            {/* Financial Amounts */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 border-t border-slate-200 dark:border-slate-800 pt-4">
              <div>
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">Subtotal (₹) *</label>
                <input
                  type="number" min="0" step="0.01"
                  className="w-full border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-1.5 text-xs bg-white dark:bg-slate-800 text-slate-900 dark:text-white outline-none font-mono"
                  value={String(form.subtotal ?? 0)}
                  onChange={(e) => handleFormChange("subtotal", parseFloat(e.target.value) || 0)}
                />
              </div>
              <div>
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">Discount (₹)</label>
                <input
                  type="number" min="0" step="0.01"
                  className="w-full border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-1.5 text-xs bg-white dark:bg-slate-800 text-slate-900 dark:text-white outline-none font-mono"
                  value={String(form.discount ?? 0)}
                  onChange={(e) => handleFormChange("discount", parseFloat(e.target.value) || 0)}
                />
              </div>
              <div>
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">Taxable (₹)</label>
                <input
                  type="number" readOnly
                  className="w-full border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-1.5 text-xs bg-slate-50 dark:bg-slate-800/60 text-slate-700 dark:text-slate-300 font-mono"
                  value={String(form.taxable_value ?? 0)}
                />
              </div>
              <div>
                <label className="text-xs font-black text-brand-gold-dark dark:text-brand-gold/40 block mb-1">Total (₹)</label>
                <input
                  type="number" readOnly
                  className="w-full border border-brand-gold/40 dark:border-brand-gold-dark rounded-xl px-3 py-1.5 text-xs bg-brand-gold-light dark:bg-brand-gold-dark/40 text-brand-gold-dark dark:text-brand-gold/40 font-black font-mono"
                  value={String(form.total ?? 0)}
                />
              </div>
            </div>

            {/* Tax splits */}
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="text-xs font-semibold text-slate-500 block mb-1">CGST (₹)</label>
                <input
                  type="number" min="0" step="0.01"
                  className="w-full border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-1.5 text-xs bg-white dark:bg-slate-800 text-slate-900 dark:text-white outline-none font-mono"
                  value={String(form.cgst ?? 0)}
                  onChange={(e) => handleFormChange("cgst", parseFloat(e.target.value) || 0)}
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-500 block mb-1">SGST (₹)</label>
                <input
                  type="number" min="0" step="0.01"
                  className="w-full border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-1.5 text-xs bg-white dark:bg-slate-800 text-slate-900 dark:text-white outline-none font-mono"
                  value={String(form.sgst ?? 0)}
                  onChange={(e) => handleFormChange("sgst", parseFloat(e.target.value) || 0)}
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-500 block mb-1">IGST (₹)</label>
                <input
                  type="number" min="0" step="0.01"
                  className="w-full border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-1.5 text-xs bg-white dark:bg-slate-800 text-slate-900 dark:text-white outline-none font-mono"
                  value={String(form.igst ?? 0)}
                  onChange={(e) => handleFormChange("igst", parseFloat(e.target.value) || 0)}
                />
              </div>
            </div>

            {/* Notes */}
            <div>
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">Notes</label>
              <textarea
                className="w-full border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs bg-white dark:bg-slate-800 text-slate-900 dark:text-white outline-none"
                rows={2}
                placeholder="Any special remarks or narration..."
                value={form.notes || ""}
                onChange={(e) => handleFormChange("notes", e.target.value || null)}
              />
            </div>
          </div>

          <div className="flex items-center gap-3 pt-4 border-t border-slate-200 dark:border-slate-800">
            <button
              onClick={handleCreate}
              disabled={loading}
              className="px-6 py-2.5 bg-brand-gold hover:bg-brand-gold-dark disabled:opacity-50 text-white rounded-xl text-xs font-bold shadow-md shadow-brand-gold/20 transition"
            >
              {loading ? "Recording..." : "Create Expense Draft"}
            </button>
            <button
              onClick={() => setTab("list")}
              className="px-4 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-xl text-xs font-bold transition"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* ── CATEGORIES TAB ────────────────────────────────────────────────── */}
      {tab === "categories" && (
        <div className="space-y-6">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-sm max-w-xl">
            <h3 className="text-sm font-black text-slate-900 dark:text-white mb-1">Add Operational Category</h3>
            <p className="text-xs text-slate-500 mb-4">Each operational category maps to an authoritative Chart of Accounts code (5xxx).</p>
            <div className="flex gap-2">
              <input
                className="flex-1 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs bg-white dark:bg-slate-800 text-slate-900 dark:text-white outline-none"
                placeholder="Category name (e.g. Courier & Postage)"
                value={catForm.name}
                onChange={(e) => setCatForm({ ...catForm, name: e.target.value })}
              />
              <input
                className="flex-1 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs bg-white dark:bg-slate-800 text-slate-900 dark:text-white outline-none"
                placeholder="Description"
                value={catForm.description}
                onChange={(e) => setCatForm({ ...catForm, description: e.target.value })}
              />
              <button
                onClick={handleCreateCategory}
                className="px-4 py-2 bg-brand-gold hover:bg-brand-gold-dark text-white rounded-xl text-xs font-bold transition"
              >
                Add
              </button>
            </div>
          </div>

          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl overflow-hidden shadow-sm">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 dark:bg-slate-800/60 text-slate-500 uppercase font-bold tracking-wider border-b border-slate-200 dark:border-slate-800">
                <tr>
                  <th className="py-3 px-4">Category Name</th>
                  <th className="py-3 px-4">GL Account Mapping</th>
                  <th className="py-3 px-4">Description</th>
                  <th className="py-3 px-4 text-center">Status</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {allCategories.map((c) => (
                  <tr key={c.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition">
                    <td className="py-3 px-4 font-bold text-slate-900 dark:text-white">{c.name}</td>
                    <td className="py-3 px-4">
                      {c.gl_account_code ? (
                        <span className="font-mono font-bold text-blue-600 bg-blue-50 dark:bg-blue-950/60 px-2 py-0.5 rounded">
                          {c.gl_account_code}
                        </span>
                      ) : (
                        <span className="text-slate-400 font-mono">Unmapped (Default 5299)</span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-slate-500">{c.description || "—"}</td>
                    <td className="py-3 px-4 text-center">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${c.is_active ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300" : "bg-slate-100 text-slate-500"}`}>
                        {c.is_active ? "Active" : "Inactive"}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right">
                      <button
                        onClick={() => handleToggleCategory(c)}
                        className="text-xs font-bold text-brand-gold hover:text-brand-gold-dark"
                      >
                        {c.is_active ? "Deactivate" : "Activate"}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── REVERSAL MODAL ──────────────────────────────────────────────────── */}
      {reversalModalOpen && selected && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl w-full max-w-lg overflow-hidden shadow-2xl animate-in fade-in duration-200">
            <div className="px-6 py-5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
              <div>
                <h3 className="text-base font-black text-rose-600 dark:text-rose-400 flex items-center gap-2">
                  <RotateCcw className="w-5 h-5" />
                  <span>Reverse General Ledger Expense</span>
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Generates an exact inverted double-entry compensating voucher in GL.
                </p>
              </div>
              <button
                onClick={() => setReversalModalOpen(false)}
                className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 flex items-center justify-center font-bold text-slate-500"
              >
                ✕
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700/60 text-xs space-y-1.5">
                <div className="flex justify-between">
                  <span className="text-slate-500 font-semibold">Expense:</span>
                  <span className="font-bold text-slate-900 dark:text-white">{selected.description}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500 font-semibold">Total Amount:</span>
                  <span className="font-mono font-bold text-rose-600">{fmtCurrency(selected.total)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500 font-semibold">Settlement:</span>
                  <span className="font-bold text-slate-700 dark:text-slate-300">{selected.payment_method} ({selected.settlement_type})</span>
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                  Reason for GL Reversal <span className="text-rose-500">*</span>
                </label>
                <textarea
                  value={reversalReason}
                  onChange={(e) => setReversalReason(e.target.value)}
                  placeholder="e.g. Duplicate claim, wrong tax rate applied, cancelled vendor invoice..."
                  className="w-full text-xs p-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-rose-500 min-h-[80px]"
                />
              </div>

              {selected.payment_method === "CASH" && (
                <div>
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                    Cash Return Destination
                  </label>
                  <select
                    value={cashReturnDest}
                    onChange={(e) => setCashReturnDest(e.target.value as any)}
                    className="w-full text-xs p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white outline-none"
                  >
                    <option value="PETTY_CASH">Petty Cash Safe / Cash in Hand (GL 1114 / 1111)</option>
                    <option value="TELLER_DRAWER">Active Teller Drawer (Redeposit Movement)</option>
                  </select>
                </div>
              )}
            </div>

            <div className="px-6 py-4 bg-slate-50 dark:bg-slate-800/60 border-t border-slate-200 dark:border-slate-800 flex items-center justify-end gap-3">
              <button
                onClick={() => setReversalModalOpen(false)}
                className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
              >
                Cancel
              </button>
              <button
                onClick={handleExecuteReversal}
                disabled={loading || !reversalReason.trim()}
                className="px-5 py-2 rounded-xl text-xs font-bold bg-rose-600 hover:bg-rose-700 disabled:opacity-50 text-white transition shadow-md shadow-rose-600/20 flex items-center gap-1.5"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Confirm GL Reversal</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
