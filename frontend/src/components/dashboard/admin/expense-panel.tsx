"use client";

/**
 * CakeToHome ERP — Expense Panel (Admin)
 * Phase 2: Expense management UI with lifecycle, category management, and reports.
 *
 * Architecture:
 * - All data from /api/v1/admin/expenses* (server-side branch scope)
 * - Categories loaded from /api/v1/admin/expense-categories
 * - No hardcoded amounts or fake data
 * - Follows existing admin panel patterns (supplier-panel, purchase-panel)
 */

import React, { useState, useEffect, useCallback } from "react";
import type {
  ExpenseRow,
  ExpenseCategoryRow,
  ExpenseStatus,
  ExpenseCreateInput,
  ExpensePaymentMethod,
} from "@frontend/lib/types/expense.types";

// ─── Types ────────────────────────────────────────────────────────────────────

type Tab = "list" | "create" | "categories";

const STATUS_COLORS: Record<ExpenseStatus, string> = {
  DRAFT:     "bg-gray-100 text-gray-700",
  SUBMITTED: "bg-blue-100 text-blue-700",
  APPROVED:  "bg-green-100 text-green-700",
  POSTED:    "bg-purple-100 text-purple-700",
};

const PAYMENT_METHODS: ExpensePaymentMethod[] = ["CASH", "UPI", "BANK_TRANSFER", "CHEQUE", "CARD", "OTHER"];

// ─── Expense Panel ────────────────────────────────────────────────────────────

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

  // Create form
  const [form, setForm] = useState<Partial<ExpenseCreateInput>>({
    subtotal: 0,
    discount: 0,
    taxable_value: 0,
    cgst: 0,
    sgst: 0,
    igst: 0,
    total: 0,
  });

  // Category form
  const [catForm, setCatForm] = useState({ name: "", description: "" });
  const [allCategories, setAllCategories] = useState<ExpenseCategoryRow[]>([]);

  const showSuccess = (msg: string) => { setSuccess(msg); setTimeout(() => setSuccess(null), 3000); };
  const showError   = (msg: string) => { setError(msg);   setTimeout(() => setError(null),   5000); };

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

  useEffect(() => { loadExpenses(); loadCategories(false); }, [loadExpenses, loadCategories]);
  useEffect(() => { if (tab === "categories") loadCategories(true); }, [tab, loadCategories]);

  // ── Create Expense ─────────────────────────────────────────────────────────

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

  const handleCreate = async () => {
    if (!form.description?.trim()) return showError("Description is required.");
    if (!form.expense_date) return showError("Expense date is required.");
    setLoading(true);
    try {
      const res = await fetch("/api/v1/admin/expenses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (data.success) {
        showSuccess("Expense created successfully.");
        setForm({ subtotal: 0, discount: 0, taxable_value: 0, cgst: 0, sgst: 0, igst: 0, total: 0 });
        setTab("list");
        loadExpenses();
      } else {
        showError(data.error || "Failed to create expense.");
      }
    } catch { showError("Network error."); }
    finally { setLoading(false); }
  };

  // ── Status Transition ──────────────────────────────────────────────────────

  const handleStatusChange = async (expense: ExpenseRow, newStatus: ExpenseStatus) => {
    try {
      const res = await fetch(`/api/v1/admin/expenses/${expense.id}/status`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });
      const data = await res.json();
      if (data.success) {
        showSuccess(`Expense ${newStatus.toLowerCase()}.`);
        loadExpenses();
        if (selected?.id === expense.id) setSelected({ ...selected, status: newStatus });
      } else {
        showError(data.error || "Failed to update status.");
      }
    } catch { showError("Network error."); }
  };

  // ── Delete ─────────────────────────────────────────────────────────────────

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this expense? This cannot be undone.")) return;
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

  // ── Category Management ────────────────────────────────────────────────────

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
    <div className="p-4 max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-bold text-gray-800">Expense Management</h2>
        <div className="flex gap-2">
          {(["list", "create", "categories"] as Tab[]).map((t) => (
            <button
              key={t}
              onClick={() => { setTab(t); setSelected(null); }}
              className={`px-3 py-1.5 rounded text-sm font-medium transition-colors ${
                tab === t ? "bg-orange-600 text-white" : "bg-gray-100 text-gray-700 hover:bg-gray-200"
              }`}
            >
              {t === "list" ? "Expenses" : t === "create" ? "+ New Expense" : "Categories"}
            </button>
          ))}
        </div>
      </div>

      {/* Alerts */}
      {success && <div className="mb-3 p-3 bg-green-50 border border-green-200 text-green-700 rounded text-sm">{success}</div>}
      {error   && <div className="mb-3 p-3 bg-red-50   border border-red-200   text-red-700   rounded text-sm">{error}</div>}

      {/* ── LIST TAB ─────────────────────────────────────────────────────── */}
      {tab === "list" && !selected && (
        <div>
          <div className="flex gap-2 mb-4">
            <input
              className="border rounded px-3 py-1.5 text-sm flex-1"
              placeholder="Search expenses..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && loadExpenses()}
            />
            <select
              className="border rounded px-3 py-1.5 text-sm"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
            >
              <option value="">All Statuses</option>
              {(["DRAFT","SUBMITTED","APPROVED","POSTED"] as ExpenseStatus[]).map(s => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
            <button onClick={loadExpenses} className="px-3 py-1.5 bg-gray-600 text-white rounded text-sm">Search</button>
          </div>

          {loading ? (
            <div className="text-center py-8 text-gray-500">Loading...</div>
          ) : expenses.length === 0 ? (
            <div className="text-center py-8 text-gray-400">No expenses found. Click "+ New Expense" to create one.</div>
          ) : (
            <div className="overflow-auto rounded border">
              <table className="w-full text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="text-left p-3 font-medium text-gray-600">Date</th>
                    <th className="text-left p-3 font-medium text-gray-600">Description</th>
                    <th className="text-left p-3 font-medium text-gray-600">Category</th>
                    <th className="text-left p-3 font-medium text-gray-600">Supplier</th>
                    <th className="text-right p-3 font-medium text-gray-600">Total (₹)</th>
                    <th className="text-left p-3 font-medium text-gray-600">Payment</th>
                    <th className="text-left p-3 font-medium text-gray-600">Status</th>
                    <th className="p-3"></th>
                  </tr>
                </thead>
                <tbody>
                  {expenses.map((e) => (
                    <tr key={e.id} className="border-t hover:bg-gray-50 cursor-pointer" onClick={() => setSelected(e)}>
                      <td className="p-3 whitespace-nowrap">{e.expense_date}</td>
                      <td className="p-3 max-w-xs truncate">{e.description}</td>
                      <td className="p-3">{(e as any).category_name || "—"}</td>
                      <td className="p-3">{(e as any).supplier_name || "—"}</td>
                      <td className="p-3 text-right font-mono">{Number(e.total).toLocaleString("en-IN", { minimumFractionDigits: 2 })}</td>
                      <td className="p-3">{e.payment_method || "—"}</td>
                      <td className="p-3">
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[e.status]}`}>
                          {e.status}
                        </span>
                      </td>
                      <td className="p-3" onClick={(ev) => ev.stopPropagation()}>
                        {e.status === "DRAFT" && (
                          <button
                            onClick={() => handleDelete(e.id)}
                            className="text-red-500 hover:text-red-700 text-xs"
                          >Delete</button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ── DETAIL VIEW ───────────────────────────────────────────────────── */}
      {tab === "list" && selected && (
        <div>
          <button onClick={() => setSelected(null)} className="mb-4 text-sm text-orange-600 hover:underline">← Back to list</button>
          <div className="border rounded p-5 bg-white shadow-sm">
            <div className="flex justify-between items-start mb-4">
              <div>
                <h3 className="font-semibold text-lg text-gray-800">{selected.description}</h3>
                <p className="text-sm text-gray-500">{selected.expense_date} · {(selected as any).category_name || "No category"}</p>
                {(selected as any).supplier_name && <p className="text-sm text-gray-500">Supplier: {(selected as any).supplier_name}</p>}
                {selected.reference_no && <p className="text-sm text-gray-500">Ref: {selected.reference_no}</p>}
              </div>
              <span className={`px-3 py-1 rounded-full text-sm font-medium ${STATUS_COLORS[selected.status]}`}>
                {selected.status}
              </span>
            </div>

            {/* Financial summary */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4 text-sm">
              {[
                { label: "Subtotal", value: selected.subtotal },
                { label: "Discount", value: selected.discount },
                { label: "Taxable", value: selected.taxable_value },
                { label: "CGST", value: selected.cgst },
                { label: "SGST", value: selected.sgst },
                { label: "IGST", value: selected.igst },
                { label: "Total", value: selected.total, bold: true },
              ].map(({ label, value, bold }) => (
                <div key={label} className="bg-gray-50 rounded p-3">
                  <p className="text-gray-500 text-xs">{label}</p>
                  <p className={`font-mono ${bold ? "font-semibold text-base" : "text-sm"}`}>
                    ₹{Number(value).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                  </p>
                </div>
              ))}
            </div>

            {selected.notes && (
              <div className="mb-4 p-3 bg-yellow-50 rounded text-sm text-gray-700">
                <strong>Notes:</strong> {selected.notes}
              </div>
            )}

            {/* Lifecycle actions */}
            <div className="flex gap-2 flex-wrap">
              {selected.status === "DRAFT" && (
                <button
                  onClick={() => handleStatusChange(selected, "SUBMITTED")}
                  className="px-4 py-2 bg-blue-600 text-white rounded text-sm hover:bg-blue-700"
                >Submit for Approval</button>
              )}
              {selected.status === "SUBMITTED" && (
                <>
                  <button
                    onClick={() => handleStatusChange(selected, "DRAFT")}
                    className="px-4 py-2 bg-gray-500 text-white rounded text-sm hover:bg-gray-600"
                  >Return to Draft</button>
                  <button
                    onClick={() => handleStatusChange(selected, "APPROVED")}
                    className="px-4 py-2 bg-green-600 text-white rounded text-sm hover:bg-green-700"
                  >Approve</button>
                </>
              )}
              {selected.status === "APPROVED" && (
                <button
                  onClick={() => handleStatusChange(selected, "POSTED")}
                  className="px-4 py-2 bg-purple-600 text-white rounded text-sm hover:bg-purple-700"
                >Post Expense</button>
              )}
              {selected.status === "DRAFT" && (
                <button
                  onClick={() => handleDelete(selected.id)}
                  className="px-4 py-2 bg-red-100 text-red-700 rounded text-sm hover:bg-red-200"
                >Delete</button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── CREATE TAB ────────────────────────────────────────────────────── */}
      {tab === "create" && (
        <div className="border rounded p-5 bg-white shadow-sm max-w-2xl">
          <h3 className="font-semibold text-gray-800 mb-4">New Expense</h3>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-gray-500 block mb-1">Expense Date *</label>
                <input
                  type="date"
                  className="w-full border rounded px-3 py-1.5 text-sm"
                  value={form.expense_date || ""}
                  onChange={(e) => handleFormChange("expense_date", e.target.value)}
                />
              </div>
              <div>
                <label className="text-xs text-gray-500 block mb-1">Category</label>
                <select
                  className="w-full border rounded px-3 py-1.5 text-sm"
                  value={form.category_id || ""}
                  onChange={(e) => handleFormChange("category_id", e.target.value || null)}
                >
                  <option value="">— Select Category —</option>
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label className="text-xs text-gray-500 block mb-1">Description *</label>
              <input
                className="w-full border rounded px-3 py-1.5 text-sm"
                placeholder="e.g. Monthly rent for Koramangala branch"
                value={form.description || ""}
                onChange={(e) => handleFormChange("description", e.target.value)}
              />
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="text-xs text-gray-500 block mb-1">Reference No.</label>
                <input className="w-full border rounded px-3 py-1.5 text-sm" value={form.reference_no || ""} onChange={(e) => handleFormChange("reference_no", e.target.value || null)} />
              </div>
              <div>
                <label className="text-xs text-gray-500 block mb-1">Payment Method</label>
                <select className="w-full border rounded px-3 py-1.5 text-sm" value={form.payment_method || ""} onChange={(e) => handleFormChange("payment_method", e.target.value || null)}>
                  <option value="">—</option>
                  {PAYMENT_METHODS.map((m) => <option key={m} value={m}>{m}</option>)}
                </select>
              </div>
            </div>

            {/* Financials */}
            <div className="grid grid-cols-3 gap-3 border-t pt-3">
              {[
                { key: "subtotal", label: "Subtotal (₹) *" },
                { key: "discount", label: "Discount (₹)" },
              ].map(({ key, label }) => (
                <div key={key}>
                  <label className="text-xs text-gray-500 block mb-1">{label}</label>
                  <input
                    type="number" min="0" step="0.01"
                    className="w-full border rounded px-3 py-1.5 text-sm"
                    value={String(form[key as keyof typeof form] ?? 0)}
                    onChange={(e) => handleFormChange(key as keyof ExpenseCreateInput, parseFloat(e.target.value) || 0)}
                  />
                </div>
              ))}
              <div>
                <label className="text-xs text-gray-500 block mb-1">Taxable Value (₹)</label>
                <input
                  type="number" readOnly
                  className="w-full border rounded px-3 py-1.5 text-sm bg-gray-50"
                  value={String(form.taxable_value ?? 0)}
                />
              </div>
            </div>
            <div className="grid grid-cols-4 gap-3">
              {[
                { key: "cgst", label: "CGST (₹)" },
                { key: "sgst", label: "SGST (₹)" },
                { key: "igst", label: "IGST (₹)" },
              ].map(({ key, label }) => (
                <div key={key}>
                  <label className="text-xs text-gray-500 block mb-1">{label}</label>
                  <input
                    type="number" min="0" step="0.01"
                    className="w-full border rounded px-3 py-1.5 text-sm"
                    value={String(form[key as keyof typeof form] ?? 0)}
                    onChange={(e) => handleFormChange(key as keyof ExpenseCreateInput, parseFloat(e.target.value) || 0)}
                  />
                </div>
              ))}
              <div>
                <label className="text-xs font-semibold text-gray-700 block mb-1">Total (₹)</label>
                <input
                  type="number" readOnly
                  className="w-full border rounded px-3 py-1.5 text-sm bg-orange-50 font-semibold"
                  value={String(form.total ?? 0)}
                />
              </div>
            </div>

            <div>
              <label className="text-xs text-gray-500 block mb-1">Notes</label>
              <textarea
                className="w-full border rounded px-3 py-1.5 text-sm"
                rows={2}
                value={form.notes || ""}
                onChange={(e) => handleFormChange("notes", e.target.value || null)}
              />
            </div>
          </div>

          <div className="flex gap-2 mt-4">
            <button
              onClick={handleCreate}
              disabled={loading}
              className="px-5 py-2 bg-orange-600 text-white rounded text-sm hover:bg-orange-700 disabled:opacity-50"
            >
              {loading ? "Saving..." : "Create Expense (DRAFT)"}
            </button>
            <button onClick={() => setTab("list")} className="px-4 py-2 bg-gray-100 text-gray-700 rounded text-sm hover:bg-gray-200">Cancel</button>
          </div>
        </div>
      )}

      {/* ── CATEGORIES TAB ────────────────────────────────────────────────── */}
      {tab === "categories" && (
        <div>
          <div className="border rounded p-4 bg-white shadow-sm mb-4 max-w-lg">
            <h3 className="font-semibold text-gray-800 mb-3">Add Category</h3>
            <div className="flex gap-2">
              <input
                className="flex-1 border rounded px-3 py-1.5 text-sm"
                placeholder="Category name"
                value={catForm.name}
                onChange={(e) => setCatForm({ ...catForm, name: e.target.value })}
              />
              <input
                className="flex-1 border rounded px-3 py-1.5 text-sm"
                placeholder="Description (optional)"
                value={catForm.description}
                onChange={(e) => setCatForm({ ...catForm, description: e.target.value })}
              />
              <button onClick={handleCreateCategory} className="px-3 py-1.5 bg-orange-600 text-white rounded text-sm">Add</button>
            </div>
          </div>

          <div className="border rounded overflow-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="text-left p-3 font-medium text-gray-600">Category</th>
                  <th className="text-left p-3 font-medium text-gray-600">Description</th>
                  <th className="text-left p-3 font-medium text-gray-600">Status</th>
                  <th className="p-3"></th>
                </tr>
              </thead>
              <tbody>
                {allCategories.map((c) => (
                  <tr key={c.id} className="border-t hover:bg-gray-50">
                    <td className="p-3 font-medium">{c.name}</td>
                    <td className="p-3 text-gray-500">{c.description || "—"}</td>
                    <td className="p-3">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${c.is_active ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"}`}>
                        {c.is_active ? "Active" : "Inactive"}
                      </span>
                    </td>
                    <td className="p-3 text-right">
                      <button
                        onClick={() => handleToggleCategory(c)}
                        className="text-xs text-blue-600 hover:underline"
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
    </div>
  );
}
