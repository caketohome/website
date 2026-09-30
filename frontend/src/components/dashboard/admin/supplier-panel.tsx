"use client";

import React, { useState, useEffect, useCallback } from "react";
import type { SupplierRow } from "@frontend/lib/types/purchase.types";

// ─── Types ────────────────────────────────────────────────────────────────────

interface SupplierFormData {
  name: string;
  gstin: string;
  phone: string;
  email: string;
  address: string;
  city: string;
  state: string;
  branch_id: string;
  is_active: boolean;
}

const EMPTY_FORM: SupplierFormData = {
  name: "", gstin: "", phone: "", email: "",
  address: "", city: "", state: "", branch_id: "", is_active: true,
};

// ─── API helpers ──────────────────────────────────────────────────────────────

async function apiGet(path: string) {
  const res = await fetch(`/api/v1/${path}`);
  return res.json();
}

async function apiPost(path: string, body: unknown) {
  const res = await fetch(`/api/v1/${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return res.json();
}

async function apiPut(path: string, body: unknown) {
  const res = await fetch(`/api/v1/${path}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return res.json();
}

async function apiDelete(path: string) {
  const res = await fetch(`/api/v1/${path}`, { method: "DELETE" });
  return res.json();
}

// ─── SupplierPanel ────────────────────────────────────────────────────────────

export default function SupplierPanel() {
  const [suppliers, setSuppliers] = useState<SupplierRow[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [showInactive, setShowInactive] = useState(false);

  // Form state
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<SupplierFormData>(EMPTY_FORM);
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({
        search,
        is_active: showInactive ? "false" : "true",
        limit: "50",
        offset: "0",
      });
      const data = await apiGet(`admin/suppliers?${params}`);
      if (data.success) {
        setSuppliers(data.data?.suppliers ?? []);
        setTotal(data.data?.total ?? 0);
      } else {
        setError(data.error || "Failed to load suppliers.");
      }
    } catch {
      setError("Network error loading suppliers.");
    } finally {
      setLoading(false);
    }
  }, [search, showInactive]);

  useEffect(() => { load(); }, [load]);

  const openCreate = () => {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setFormError(null);
    setShowForm(true);
  };

  const openEdit = (s: SupplierRow) => {
    setEditingId(s.id);
    setForm({
      name: s.name, gstin: s.gstin ?? "", phone: s.phone ?? "",
      email: s.email ?? "", address: s.address ?? "", city: s.city ?? "",
      state: s.state ?? "", branch_id: s.branch_id ?? "", is_active: s.is_active,
    });
    setFormError(null);
    setShowForm(true);
  };

  const handleSave = async () => {
    if (!form.name.trim()) { setFormError("Supplier name is required."); return; }
    setSaving(true);
    setFormError(null);
    try {
      const payload = {
        name: form.name.trim(),
        gstin: form.gstin || null,
        phone: form.phone || null,
        email: form.email || null,
        address: form.address || null,
        city: form.city || null,
        state: form.state || null,
        branch_id: form.branch_id || null,
        is_active: form.is_active,
      };
      const result = editingId
        ? await apiPut(`admin/suppliers/${editingId}`, payload)
        : await apiPost("admin/suppliers", payload);
      if (result.success) {
        setShowForm(false);
        load();
      } else {
        setFormError(result.error || "Save failed.");
      }
    } catch {
      setFormError("Network error saving supplier.");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Deactivate supplier "${name}"? This will prevent new purchases from being assigned to them.`)) return;
    const result = await apiDelete(`admin/suppliers/${id}`);
    if (result.success) {
      load();
    } else {
      alert(result.error || "Failed to deactivate supplier.");
    }
  };

  const inputCls = "w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500";
  const labelCls = "block text-xs font-medium text-gray-600 mb-1";

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">Suppliers</h2>
          <p className="text-xs text-gray-500 mt-0.5">{total} supplier{total !== 1 ? "s" : ""}</p>
        </div>
        <button
          onClick={openCreate}
          className="bg-blue-600 text-white text-sm px-4 py-2 rounded hover:bg-blue-700 transition"
        >
          + Add Supplier
        </button>
      </div>

      {/* Filters */}
      <div className="flex gap-3 items-center">
        <input
          type="text"
          placeholder="Search by name, phone, GSTIN…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="flex-1 border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={showInactive}
            onChange={e => setShowInactive(e.target.checked)}
            className="rounded"
          />
          Show inactive
        </label>
      </div>

      {/* State: Loading */}
      {loading && (
        <div className="text-center py-12 text-gray-400 text-sm">Loading suppliers…</div>
      )}

      {/* State: Error */}
      {!loading && error && (
        <div className="bg-red-50 border border-red-200 rounded p-4 text-sm text-red-700">
          {error}
          <button onClick={load} className="ml-3 underline text-red-600">Retry</button>
        </div>
      )}

      {/* State: Empty */}
      {!loading && !error && suppliers.length === 0 && (
        <div className="text-center py-16 text-gray-400">
          <p className="text-base font-medium">No suppliers found</p>
          <p className="text-sm mt-1">Add your first supplier to start recording purchases.</p>
          <button onClick={openCreate} className="mt-4 bg-blue-600 text-white text-sm px-4 py-2 rounded hover:bg-blue-700 transition">
            + Add Supplier
          </button>
        </div>
      )}

      {/* Supplier Table */}
      {!loading && !error && suppliers.length > 0 && (
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 text-sm">
            <thead className="bg-gray-50">
              <tr>
                {["Name", "GSTIN", "Phone", "City", "State", "Status", "Actions"].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-100">
              {suppliers.map(s => (
                <tr key={s.id} className="hover:bg-gray-50 transition">
                  <td className="px-4 py-3 font-medium text-gray-900">{s.name}</td>
                  <td className="px-4 py-3 text-gray-500 font-mono text-xs">{s.gstin || <span className="italic text-gray-300">—</span>}</td>
                  <td className="px-4 py-3 text-gray-600">{s.phone || <span className="italic text-gray-300">—</span>}</td>
                  <td className="px-4 py-3 text-gray-600">{s.city || "—"}</td>
                  <td className="px-4 py-3 text-gray-600">{s.state || "—"}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${s.is_active ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"}`}>
                      {s.is_active ? "Active" : "Inactive"}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <button onClick={() => openEdit(s)} className="text-blue-600 hover:underline text-xs">Edit</button>
                      {s.is_active && (
                        <button onClick={() => handleDelete(s.id, s.name)} className="text-red-500 hover:underline text-xs">Deactivate</button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Form Modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-xl mx-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between px-6 py-4 border-b">
              <h3 className="font-semibold text-gray-900">{editingId ? "Edit Supplier" : "Add Supplier"}</h3>
              <button onClick={() => setShowForm(false)} className="text-gray-400 hover:text-gray-600 text-xl leading-none">&times;</button>
            </div>
            <div className="px-6 py-4 space-y-4">
              <div>
                <label className={labelCls}>Name <span className="text-red-500">*</span></label>
                <input className={inputCls} value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Supplier name" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelCls}>GSTIN</label>
                  <input className={inputCls} value={form.gstin} onChange={e => setForm(f => ({ ...f, gstin: e.target.value.toUpperCase() }))} placeholder="29ABCDE1234F1Z5" maxLength={15} />
                </div>
                <div>
                  <label className={labelCls}>Phone</label>
                  <input className={inputCls} value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} placeholder="+91 98765 43210" />
                </div>
              </div>
              <div>
                <label className={labelCls}>Email</label>
                <input className={inputCls} type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} placeholder="supplier@example.com" />
              </div>
              <div>
                <label className={labelCls}>Address</label>
                <textarea className={inputCls} rows={2} value={form.address} onChange={e => setForm(f => ({ ...f, address: e.target.value }))} placeholder="Street address" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelCls}>City</label>
                  <input className={inputCls} value={form.city} onChange={e => setForm(f => ({ ...f, city: e.target.value }))} placeholder="Bangalore" />
                </div>
                <div>
                  <label className={labelCls}>State</label>
                  <input className={inputCls} value={form.state} onChange={e => setForm(f => ({ ...f, state: e.target.value }))} placeholder="Karnataka" />
                </div>
              </div>
              {editingId && (
                <div>
                  <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
                    <input type="checkbox" checked={form.is_active} onChange={e => setForm(f => ({ ...f, is_active: e.target.checked }))} className="rounded" />
                    Active
                  </label>
                </div>
              )}
              {formError && (
                <div className="bg-red-50 border border-red-200 rounded p-3 text-sm text-red-700">{formError}</div>
              )}
            </div>
            <div className="flex justify-end gap-3 px-6 py-4 border-t bg-gray-50">
              <button onClick={() => setShowForm(false)} className="text-sm text-gray-600 hover:text-gray-800 px-4 py-2">Cancel</button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="bg-blue-600 text-white text-sm px-5 py-2 rounded hover:bg-blue-700 disabled:opacity-50 transition"
              >
                {saving ? "Saving…" : editingId ? "Save Changes" : "Add Supplier"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
