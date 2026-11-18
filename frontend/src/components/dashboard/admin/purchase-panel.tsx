"use client";

import React, { useState, useEffect, useCallback } from "react";
import type {
  PurchaseRow,
  PurchaseStatus,
  PurchaseItemInput,
  SupplierRow,
} from "@frontend/lib/types/purchase.types";

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function apiGet(path: string) {
  const res = await fetch(`/api/v1/${path}`);
  return res.json();
}
async function apiPost(path: string, body: unknown) {
  const res = await fetch(`/api/v1/${path}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  return res.json();
}
async function apiDelete(path: string) {
  const res = await fetch(`/api/v1/${path}`, { method: "DELETE" });
  return res.json();
}

function fmt(n: number | null | undefined) {
  if (n == null) return "—";
  return "₹" + Number(n).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

const STATUS_COLORS: Record<PurchaseStatus, string> = {
  DRAFT:     "bg-gray-100 text-gray-600",
  SUBMITTED: "bg-brand-gold-light text-brand-gold-dark",
  APPROVED:  "bg-green-100 text-green-700",
  POSTED:    "bg-blue-100 text-blue-700",
};

const EMPTY_ITEM: PurchaseItemInput = {
  description: "", quantity: 1, rate: 0, discount: 0,
  taxable_value: 0, total: 0,
};

// ─── PurchasePanel ────────────────────────────────────────────────────────────

export default function PurchasePanel() {
  const [view, setView] = useState<"list" | "create" | "detail">("list");
  const [purchases, setPurchases] = useState<PurchaseRow[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedPurchase, setSelectedPurchase] = useState<PurchaseRow | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [suppliers, setSuppliers] = useState<SupplierRow[]>([]);
  // Quick-add supplier from the purchase form (bank details optional)
  const EMPTY_SUP = { name: "", gstin: "", phone: "", state: "", showBank: false, holder: "", account: "", ifsc: "", bank: "", upi: "" };
  const [newSup, setNewSup] = useState<typeof EMPTY_SUP | null>(null);
  const [supErr, setSupErr] = useState<string | null>(null);
  const [supSaving, setSupSaving] = useState(false);
  const saveNewSupplier = async () => {
    if (!newSup) return;
    setSupErr(null);
    if (!newSup.name.trim()) { setSupErr("Supplier name is required."); return; }
    const bank = newSup.showBank && (newSup.account || newSup.ifsc || newSup.upi)
      ? { account_holder: newSup.holder.trim() || newSup.name.trim(), account_number: newSup.account.replace(/\s/g, ""), ifsc: newSup.ifsc.trim().toUpperCase(), bank_name: newSup.bank.trim(), upi_id: newSup.upi.trim() }
      : null;
    setSupSaving(true);
    try {
      const res = await apiPost("admin/suppliers", {
        name: newSup.name.trim(),
        gstin: newSup.gstin.trim() || null,
        phone: newSup.phone.trim() || null,
        state: newSup.state.trim() || null,
        metadata: bank ? { bank_details: bank } : {},
      });
      if (!res?.success) throw new Error(res?.error || "Could not create supplier.");
      const created = res.data;
      setSuppliers((list) => [...list, created].sort((a: any, b: any) => String(a.name).localeCompare(String(b.name))));
      setForm((f) => ({ ...f, supplier_id: created.id }));
      setNewSup(null);
    } catch (e: any) {
      setSupErr(e.message);
    } finally {
      setSupSaving(false);
    }
  };

  // Form state
  const [form, setForm] = useState({
    supplier_id: "", invoice_no: "", invoice_date: "", payment_method: "",
    credit_terms_days: "", due_date: "",
  });
  const [items, setItems] = useState<PurchaseItemInput[]>([{ ...EMPTY_ITEM }]);
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const params = new URLSearchParams({ limit: "50", offset: "0" });
      if (statusFilter) params.set("status", statusFilter);
      const [purchData, suppData] = await Promise.all([
        apiGet(`admin/purchases?${params}`),
        apiGet("admin/suppliers?limit=200"),
      ]);
      if (purchData.success) { setPurchases(purchData.data?.purchases ?? []); setTotal(purchData.data?.total ?? 0); }
      else setError(purchData.error || "Failed to load purchases.");
      if (suppData.success) setSuppliers(suppData.data?.suppliers ?? []);
    } catch { setError("Network error."); }
    finally { setLoading(false); }
  }, [statusFilter]);

  useEffect(() => { load(); }, [load]);

  // ── Computed totals from items ──────────────────────────────────────────────
  const recalc = (newItems: PurchaseItemInput[]) => {
    return newItems.map(item => {
      const taxable = Math.max(0, item.quantity * item.rate - (item.discount ?? 0));
      const cgst = ((item.cgst_rate ?? 0) / 100) * taxable;
      const sgst = ((item.sgst_rate ?? 0) / 100) * taxable;
      const igst = ((item.igst_rate ?? 0) / 100) * taxable;
      return { ...item, taxable_value: taxable, cgst, sgst, igst, total: taxable + cgst + sgst + igst };
    });
  };

  const updateItem = (idx: number, field: keyof PurchaseItemInput, value: unknown) => {
    setItems(prev => {
      const next = [...prev];
      next[idx] = { ...next[idx], [field]: value };
      return recalc(next);
    });
  };

  const addItem = () => setItems(prev => [...prev, { ...EMPTY_ITEM }]);
  const removeItem = (idx: number) => setItems(prev => prev.filter((_, i) => i !== idx));

  const totals = items.reduce((acc, item) => ({
    subtotal: acc.subtotal + item.quantity * item.rate,
    discount: acc.discount + (item.discount ?? 0),
    taxable: acc.taxable + item.taxable_value,
    cgst: acc.cgst + (item.cgst ?? 0),
    sgst: acc.sgst + (item.sgst ?? 0),
    igst: acc.igst + (item.igst ?? 0),
    total: acc.total + item.total,
  }), { subtotal: 0, discount: 0, taxable: 0, cgst: 0, sgst: 0, igst: 0, total: 0 });

  const handleCreate = async () => {
    if (items.some(i => !i.description.trim())) { setFormError("All items must have a description."); return; }
    if (items.some(i => i.quantity <= 0)) { setFormError("All item quantities must be > 0."); return; }
    setSaving(true); setFormError(null);
    try {
      const payload = {
        supplier_id: form.supplier_id || null,
        invoice_no: form.invoice_no || null,
        invoice_date: form.invoice_date || null,
        payment_method: form.payment_method || null,
        credit_terms_days: form.credit_terms_days ? parseInt(form.credit_terms_days) : null,
        due_date: form.due_date || null,
        subtotal: totals.subtotal, discount: totals.discount,
        taxable_value: totals.taxable, cgst: totals.cgst, sgst: totals.sgst,
        igst: totals.igst, total: totals.total,
        items,
      };
      const result = await apiPost("admin/purchases", payload);
      if (result.success) { setView("list"); load(); }
      else setFormError(result.error || "Failed to create purchase.");
    } catch { setFormError("Network error."); }
    finally { setSaving(false); }
  };

  const handleStatusTransition = async (id: string, status: PurchaseStatus) => {
    const result = await apiPost(`admin/purchases/${id}/status`, { status });
    if (result.success) {
      load();
      if (selectedPurchase?.id === id) {
        const updated = await apiGet(`admin/purchases/${id}`);
        if (updated.success) setSelectedPurchase(updated.data);
      }
    } else {
      alert(result.error || "Status transition failed.");
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this DRAFT purchase?")) return;
    const result = await apiDelete(`admin/purchases/${id}`);
    if (result.success) { setView("list"); load(); }
    else alert(result.error || "Delete failed.");
  };

  const openDetail = async (p: PurchaseRow) => {
    const result = await apiGet(`admin/purchases/${p.id}`);
    if (result.success) { setSelectedPurchase(result.data); setView("detail"); }
  };

  const inputCls = "w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500";
  const labelCls = "block text-xs font-medium text-gray-600 mb-1";
  const numInputCls = "border border-gray-300 rounded px-2 py-1 text-sm w-full focus:outline-none focus:ring-1 focus:ring-blue-400 text-right";

  // ── LIST VIEW ──────────────────────────────────────────────────────────────
  if (view === "list") {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Purchases</h2>
            <p className="text-xs text-gray-500 mt-0.5">{total} purchase{total !== 1 ? "s" : ""}</p>
          </div>
          <button onClick={() => { setForm({ supplier_id: "", invoice_no: "", invoice_date: "", payment_method: "", credit_terms_days: "", due_date: "" }); setItems([{ ...EMPTY_ITEM }]); setFormError(null); setView("create"); }}
            className="bg-blue-600 text-white text-sm px-4 py-2 rounded hover:bg-blue-700 transition">
            + New Purchase
          </button>
        </div>

        {/* Status filter */}
        <div className="flex gap-2">
          {["", "DRAFT", "SUBMITTED", "APPROVED", "POSTED"].map(s => (
            <button key={s} onClick={() => setStatusFilter(s)}
              className={`text-xs px-3 py-1.5 rounded-full border transition ${statusFilter === s ? "bg-blue-600 text-white border-blue-600" : "bg-white text-gray-600 border-gray-300 hover:border-blue-400"}`}>
              {s || "All"}
            </button>
          ))}
        </div>

        {loading && <div className="text-center py-12 text-gray-400 text-sm">Loading purchases…</div>}
        {!loading && error && (
          <div className="bg-red-50 border border-red-200 rounded p-4 text-sm text-red-700">
            {error} <button onClick={load} className="ml-2 underline">Retry</button>
          </div>
        )}
        {!loading && !error && purchases.length === 0 && (
          <div className="text-center py-16 text-gray-400">
            <p className="text-base font-medium">No purchases found</p>
            <p className="text-sm mt-1">Create your first purchase entry to begin recording procurement.</p>
          </div>
        )}
        {!loading && !error && purchases.length > 0 && (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 text-sm">
              <thead className="bg-gray-50">
                <tr>
                  {["Invoice No.", "Date", "Supplier", "Branch", "Total", "Status", "Due Date", "Actions"].map(h => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-100">
                {purchases.map(p => (
                  <tr key={p.id} className="hover:bg-gray-50 transition cursor-pointer" onClick={() => openDetail(p)}>
                    <td className="px-4 py-3 font-mono text-xs text-gray-700">{p.invoice_no || <span className="italic text-gray-300">Draft</span>}</td>
                    <td className="px-4 py-3 text-gray-600">{p.invoice_date ? new Date(p.invoice_date).toLocaleDateString("en-IN") : "—"}</td>
                    <td className="px-4 py-3 font-medium text-gray-900">{p.supplier_name || <span className="italic text-gray-400">No supplier</span>}</td>
                    <td className="px-4 py-3 text-gray-600">{p.branch_name || p.branch_id}</td>
                    <td className="px-4 py-3 text-gray-900 font-medium text-right">{fmt(p.total)}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[p.status]}`}>
                        {p.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-600">{p.due_date ? new Date(p.due_date).toLocaleDateString("en-IN") : "—"}</td>
                    <td className="px-4 py-3" onClick={e => e.stopPropagation()}>
                      <div className="flex gap-2">
                        {p.status === "DRAFT" && (
                          <button onClick={() => handleStatusTransition(p.id, "SUBMITTED")}
                            className="text-xs text-brand-gold-dark border border-brand-gold/40 rounded px-2 py-0.5 hover:bg-brand-gold-light">Submit</button>
                        )}
                        {p.status === "SUBMITTED" && (
                          <button onClick={() => handleStatusTransition(p.id, "APPROVED")}
                            className="text-xs text-green-700 border border-green-300 rounded px-2 py-0.5 hover:bg-green-50">Approve</button>
                        )}
                        {p.status === "DRAFT" && (
                          <button onClick={() => handleDelete(p.id)}
                            className="text-xs text-red-500 hover:underline">Delete</button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    );
  }

  // ── CREATE VIEW ────────────────────────────────────────────────────────────
  if (view === "create") {
    return (
      <div className="space-y-6 max-w-4xl">
        <div className="flex items-center gap-3">
          <button onClick={() => setView("list")} className="text-gray-500 hover:text-gray-700 text-sm">← Back</button>
          <h2 className="text-lg font-semibold text-gray-900">New Purchase Entry</h2>
        </div>

        {/* Purchase Header */}
        <div className="bg-white border border-gray-200 rounded-lg p-5 space-y-4">
          <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">Purchase Details</h3>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelCls}>Supplier</label>
              <div className="flex gap-2">
                <select className={inputCls} value={form.supplier_id} onChange={e => setForm(f => ({ ...f, supplier_id: e.target.value }))}>
                  <option value="">— No supplier —</option>
                  {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}{s.gstin ? ` (${s.gstin})` : ""}</option>)}
                </select>
                <button type="button" onClick={() => { setSupErr(null); setNewSup({ ...EMPTY_SUP }); }} className="shrink-0 px-3 rounded-lg border border-gray-300 text-xs font-semibold text-[#1D2F5D] hover:bg-gray-50">+ New</button>
              </div>
            </div>
            {newSup && (
              <div className="col-span-2 rounded-lg border border-blue-200 bg-blue-50/40 p-3 space-y-2">
                <p className="text-xs font-semibold text-gray-700">New supplier</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <input className={inputCls} placeholder="Supplier name *" value={newSup.name} onChange={e => setNewSup({ ...newSup, name: e.target.value })} />
                  <input className={inputCls} placeholder="GSTIN (optional)" value={newSup.gstin} onChange={e => setNewSup({ ...newSup, gstin: e.target.value.toUpperCase() })} />
                  <input className={inputCls} placeholder="Phone (optional)" value={newSup.phone} onChange={e => setNewSup({ ...newSup, phone: e.target.value })} />
                  <input className={inputCls} placeholder="State (optional)" value={newSup.state} onChange={e => setNewSup({ ...newSup, state: e.target.value })} />
                </div>
                <label className="flex items-center gap-2 text-xs text-gray-700">
                  <input type="checkbox" checked={newSup.showBank} onChange={e => setNewSup({ ...newSup, showBank: e.target.checked })} /> Add bank details (optional — can be added later)
                </label>
                {newSup.showBank && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <input className={inputCls} placeholder="Account holder name" value={newSup.holder} onChange={e => setNewSup({ ...newSup, holder: e.target.value })} />
                    <input className={inputCls} placeholder="Account number" inputMode="numeric" value={newSup.account} onChange={e => setNewSup({ ...newSup, account: e.target.value })} />
                    <input className={inputCls} placeholder="IFSC (e.g. SBIN0001234)" value={newSup.ifsc} onChange={e => setNewSup({ ...newSup, ifsc: e.target.value.toUpperCase() })} />
                    <input className={inputCls} placeholder="Bank name" value={newSup.bank} onChange={e => setNewSup({ ...newSup, bank: e.target.value })} />
                    <input className={inputCls} placeholder="UPI ID (optional)" value={newSup.upi} onChange={e => setNewSup({ ...newSup, upi: e.target.value })} />
                  </div>
                )}
                {supErr && <p className="text-xs text-red-600">{supErr}</p>}
                <div className="flex gap-2">
                  <button type="button" onClick={saveNewSupplier} disabled={supSaving} className="px-3 py-1.5 rounded-lg bg-[#1D2F5D] text-white text-xs font-semibold disabled:opacity-50">{supSaving ? "Saving…" : "Save supplier"}</button>
                  <button type="button" onClick={() => setNewSup(null)} className="px-3 py-1.5 rounded-lg border border-gray-300 text-xs">Cancel</button>
                </div>
              </div>
            )}
            <div>
              <label className={labelCls}>Invoice No.</label>
              <input className={inputCls} value={form.invoice_no} onChange={e => setForm(f => ({ ...f, invoice_no: e.target.value }))} placeholder="INV-2024-001" />
            </div>
            <div>
              <label className={labelCls}>Invoice Date</label>
              <input className={inputCls} type="date" value={form.invoice_date} onChange={e => setForm(f => ({ ...f, invoice_date: e.target.value }))} />
            </div>
            <div>
              <label className={labelCls}>Payment Method</label>
              <select className={inputCls} value={form.payment_method} onChange={e => setForm(f => ({ ...f, payment_method: e.target.value }))}>
                <option value="">— Select —</option>
                {["CASH", "UPI", "BANK_TRANSFER", "CHEQUE", "CARD", "OTHER"].map(m => <option key={m} value={m}>{m.replace("_", " ")}</option>)}
              </select>
            </div>
            <div>
              <label className={labelCls}>Credit Terms (days)</label>
              <input className={inputCls} type="number" min="0" value={form.credit_terms_days} onChange={e => setForm(f => ({ ...f, credit_terms_days: e.target.value }))} placeholder="0 = cash" />
            </div>
            <div>
              <label className={labelCls}>Due Date</label>
              <input className={inputCls} type="date" value={form.due_date} onChange={e => setForm(f => ({ ...f, due_date: e.target.value }))} />
            </div>
          </div>
        </div>

        {/* Line Items */}
        <div className="bg-white border border-gray-200 rounded-lg p-5 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">Line Items</h3>
            <button onClick={addItem} className="text-xs text-blue-600 hover:underline">+ Add Item</button>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full text-xs">
              <thead>
                <tr className="text-gray-500 border-b">
                  {["Description", "HSN", "Qty", "Rate (₹)", "Discount (₹)", "CGST%", "SGST%", "IGST%", "Total (₹)", ""].map(h => (
                    <th key={h} className="pb-2 text-left font-medium pr-2">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {items.map((item, idx) => (
                  <tr key={idx} className="border-b border-gray-50">
                    <td className="py-1.5 pr-2"><input className={numInputCls + " text-left"} value={item.description} onChange={e => updateItem(idx, "description", e.target.value)} placeholder="Description" /></td>
                    <td className="py-1.5 pr-2 w-20"><input className={numInputCls + " text-left"} value={item.hsn_code ?? ""} onChange={e => updateItem(idx, "hsn_code", e.target.value)} placeholder="HSN" /></td>
                    <td className="py-1.5 pr-2 w-16"><input className={numInputCls} type="number" min="0.01" step="0.01" value={item.quantity} onChange={e => updateItem(idx, "quantity", parseFloat(e.target.value) || 0)} /></td>
                    <td className="py-1.5 pr-2 w-24"><input className={numInputCls} type="number" min="0" step="0.01" value={item.rate} onChange={e => updateItem(idx, "rate", parseFloat(e.target.value) || 0)} /></td>
                    <td className="py-1.5 pr-2 w-20"><input className={numInputCls} type="number" min="0" step="0.01" value={item.discount ?? 0} onChange={e => updateItem(idx, "discount", parseFloat(e.target.value) || 0)} /></td>
                    <td className="py-1.5 pr-2 w-16"><input className={numInputCls} type="number" min="0" max="100" step="0.01" value={item.cgst_rate ?? 0} onChange={e => updateItem(idx, "cgst_rate", parseFloat(e.target.value) || 0)} /></td>
                    <td className="py-1.5 pr-2 w-16"><input className={numInputCls} type="number" min="0" max="100" step="0.01" value={item.sgst_rate ?? 0} onChange={e => updateItem(idx, "sgst_rate", parseFloat(e.target.value) || 0)} /></td>
                    <td className="py-1.5 pr-2 w-16"><input className={numInputCls} type="number" min="0" max="100" step="0.01" value={item.igst_rate ?? 0} onChange={e => updateItem(idx, "igst_rate", parseFloat(e.target.value) || 0)} /></td>
                    <td className="py-1.5 pr-2 w-24 font-medium text-right">{item.total.toFixed(2)}</td>
                    <td className="py-1.5">
                      {items.length > 1 && (
                        <button onClick={() => removeItem(idx)} className="text-red-400 hover:text-red-600 text-base leading-none">&times;</button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Summary */}
          <div className="flex justify-end">
            <div className="text-xs space-y-1 text-right min-w-48">
              <div className="flex justify-between gap-8"><span className="text-gray-500">Subtotal</span><span>{fmt(totals.subtotal)}</span></div>
              <div className="flex justify-between gap-8"><span className="text-gray-500">Discount</span><span>− {fmt(totals.discount)}</span></div>
              <div className="flex justify-between gap-8"><span className="text-gray-500">Taxable</span><span>{fmt(totals.taxable)}</span></div>
              <div className="flex justify-between gap-8"><span className="text-gray-500">CGST</span><span>{fmt(totals.cgst)}</span></div>
              <div className="flex justify-between gap-8"><span className="text-gray-500">SGST</span><span>{fmt(totals.sgst)}</span></div>
              <div className="flex justify-between gap-8"><span className="text-gray-500">IGST</span><span>{fmt(totals.igst)}</span></div>
              <div className="flex justify-between gap-8 pt-1 border-t font-semibold text-sm"><span>Total</span><span className="text-blue-700">{fmt(totals.total)}</span></div>
            </div>
          </div>
        </div>

        {formError && (
          <div className="bg-red-50 border border-red-200 rounded p-3 text-sm text-red-700">{formError}</div>
        )}
        <div className="flex justify-end gap-3">
          <button onClick={() => setView("list")} className="text-sm text-gray-600 hover:text-gray-800 px-4 py-2">Cancel</button>
          <button onClick={handleCreate} disabled={saving} className="bg-blue-600 text-white text-sm px-6 py-2 rounded hover:bg-blue-700 disabled:opacity-50 transition">
            {saving ? "Saving…" : "Save as Draft"}
          </button>
        </div>
      </div>
    );
  }

  // ── DETAIL VIEW ─────────────────────────────────────────────────────────────
  if (view === "detail" && selectedPurchase) {
    const p = selectedPurchase;
    return (
      <div className="space-y-4 max-w-3xl">
        <div className="flex items-center gap-3">
          <button onClick={() => setView("list")} className="text-gray-500 hover:text-gray-700 text-sm">← Back</button>
          <h2 className="text-lg font-semibold text-gray-900">Purchase {p.invoice_no || p.id}</h2>
          <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[p.status]}`}>{p.status}</span>
        </div>

        {/* Meta */}
        <div className="bg-white border border-gray-200 rounded-lg p-5 grid grid-cols-2 gap-4 text-sm">
          <div><span className="text-gray-500 text-xs">Supplier</span><p className="font-medium">{p.supplier_name || "—"}</p></div>
          <div><span className="text-gray-500 text-xs">Branch</span><p className="font-medium">{p.branch_name || p.branch_id}</p></div>
          <div><span className="text-gray-500 text-xs">Invoice No.</span><p className="font-mono">{p.invoice_no || "—"}</p></div>
          <div><span className="text-gray-500 text-xs">Invoice Date</span><p>{p.invoice_date ? new Date(p.invoice_date).toLocaleDateString("en-IN") : "—"}</p></div>
          <div><span className="text-gray-500 text-xs">Payment Method</span><p>{p.payment_method || "—"}</p></div>
          <div><span className="text-gray-500 text-xs">Due Date</span><p>{p.due_date ? new Date(p.due_date).toLocaleDateString("en-IN") : "—"}</p></div>
          {p.approved_by && <div><span className="text-gray-500 text-xs">Approved By</span><p>{p.approved_by}</p></div>}
          {p.posted_at && <div><span className="text-gray-500 text-xs">Posted At</span><p>{new Date(p.posted_at).toLocaleString("en-IN")}</p></div>}
        </div>

        {/* Items */}
        {p.items && p.items.length > 0 && (
          <div className="bg-white border border-gray-200 rounded-lg p-5">
            <h3 className="text-sm font-semibold text-gray-700 mb-3">Line Items</h3>
            <table className="min-w-full text-xs">
              <thead>
                <tr className="text-gray-500 border-b">
                  {["Description", "HSN", "Qty", "Rate", "Discount", "Taxable", "CGST", "SGST", "IGST", "Total"].map(h => (
                    <th key={h} className="pb-2 text-right first:text-left font-medium pr-3">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {p.items.map((item, i) => (
                  <tr key={i} className="border-b border-gray-50 hover:bg-gray-50">
                    <td className="py-1.5 pr-3 text-left">{item.description}</td>
                    <td className="py-1.5 pr-3 text-right font-mono">{item.hsn_code || "—"}</td>
                    <td className="py-1.5 pr-3 text-right">{Number(item.quantity).toFixed(2)}</td>
                    <td className="py-1.5 pr-3 text-right">{fmt(item.rate)}</td>
                    <td className="py-1.5 pr-3 text-right">{fmt(item.discount)}</td>
                    <td className="py-1.5 pr-3 text-right">{fmt(item.taxable_value)}</td>
                    <td className="py-1.5 pr-3 text-right">{fmt(item.cgst)}</td>
                    <td className="py-1.5 pr-3 text-right">{fmt(item.sgst)}</td>
                    <td className="py-1.5 pr-3 text-right">{fmt(item.igst)}</td>
                    <td className="py-1.5 pr-3 text-right font-semibold">{fmt(item.total)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="flex justify-end mt-3">
              <div className="text-xs space-y-1 text-right min-w-48">
                <div className="flex justify-between gap-8"><span className="text-gray-500">Subtotal</span><span>{fmt(p.subtotal)}</span></div>
                <div className="flex justify-between gap-8"><span className="text-gray-500">Discount</span><span>− {fmt(p.discount)}</span></div>
                <div className="flex justify-between gap-8"><span className="text-gray-500">Taxable</span><span>{fmt(p.taxable_value)}</span></div>
                <div className="flex justify-between gap-8"><span className="text-gray-500">CGST</span><span>{fmt(p.cgst)}</span></div>
                <div className="flex justify-between gap-8"><span className="text-gray-500">SGST</span><span>{fmt(p.sgst)}</span></div>
                <div className="flex justify-between gap-8"><span className="text-gray-500">IGST</span><span>{fmt(p.igst)}</span></div>
                <div className="flex justify-between gap-8 pt-1 border-t font-semibold text-sm"><span>Total</span><span className="text-blue-700">{fmt(p.total)}</span></div>
              </div>
            </div>
          </div>
        )}

        {/* Payments */}
        {p.payments && p.payments.length > 0 && (
          <div className="bg-white border border-gray-200 rounded-lg p-5">
            <h3 className="text-sm font-semibold text-gray-700 mb-3">Payments</h3>
            <table className="min-w-full text-xs">
              <thead><tr className="text-gray-500 border-b">
                {["Date", "Method", "Reference", "Amount"].map(h => (
                  <th key={h} className="pb-2 text-left font-medium pr-3 last:text-right">{h}</th>
                ))}
              </tr></thead>
              <tbody>
                {p.payments.map((pay, i) => (
                  <tr key={i} className="border-b border-gray-50">
                    <td className="py-1.5 pr-3">{new Date(pay.payment_date).toLocaleDateString("en-IN")}</td>
                    <td className="py-1.5 pr-3">{pay.method}</td>
                    <td className="py-1.5 pr-3 font-mono text-gray-500">{pay.reference || "—"}</td>
                    <td className="py-1.5 pr-3 text-right font-semibold">{fmt(pay.amount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-3">
          {p.status === "DRAFT" && (
            <>
              <button onClick={() => handleStatusTransition(p.id, "SUBMITTED")}
                className="bg-brand-gold text-white text-sm px-4 py-2 rounded hover:bg-brand-gold-dark transition">
                Submit for Approval
              </button>
              <button onClick={() => handleDelete(p.id)}
                className="border border-red-300 text-red-600 text-sm px-4 py-2 rounded hover:bg-red-50 transition">
                Delete
              </button>
            </>
          )}
          {p.status === "SUBMITTED" && (
            <>
              <button onClick={() => handleStatusTransition(p.id, "APPROVED")}
                className="bg-green-600 text-white text-sm px-4 py-2 rounded hover:bg-green-700 transition">
                Approve
              </button>
              <button onClick={() => handleStatusTransition(p.id, "DRAFT")}
                className="border border-gray-300 text-gray-600 text-sm px-4 py-2 rounded hover:bg-gray-50 transition">
                Return to Draft
              </button>
            </>
          )}
          {p.status === "APPROVED" && (
            <div className="flex items-center gap-2 text-sm text-gray-500">
              <span className="text-green-600 font-medium">✓ Approved</span>
              <span>— Accounting posting available in Phase 7/8.</span>
            </div>
          )}
          {p.status === "POSTED" && (
            <div className="text-sm text-blue-600 font-medium">✓ Posted — No further changes permitted.</div>
          )}
        </div>
      </div>
    );
  }

  return null;
}
