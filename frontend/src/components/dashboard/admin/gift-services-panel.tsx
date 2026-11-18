"use client";

/**
 * Surprise & Gift Services — e.g. "Greeting card with your message", "Surprise video shoot".
 * Shown to customers at checkout when they send a gift. Paid services are charged with GST on the order;
 * a price of 0 makes it free. Nothing shows at checkout until a service is created and active.
 * Data: /api/v1/admin/gift-services (GET, POST) and /api/v1/admin/gift-services/:id (DELETE)
 */

import { useCallback, useEffect, useState } from "react";

type Service = {
  id?: string;
  name: string;
  description: string;
  price: number;
  gst_rate: number;
  hsn_sac: string;
  needs_note: boolean;
  note_label: string;
  is_active: boolean;
  display_order: number;
};

const EMPTY: Service = { name: "", description: "", price: 0, gst_rate: 18, hsn_sac: "", needs_note: false, note_label: "", is_active: true, display_order: 0 };

export function GiftServicesPanel() {
  const [services, setServices] = useState<Service[]>([]);
  const [editing, setEditing] = useState<Service | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    const j = await fetch("/api/v1/admin/gift-services", { cache: "no-store" }).then((r) => r.json()).catch(() => null);
    if (j?.success) setServices(j.services || []);
    else setError(j?.message || j?.error || "Could not load services.");
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const save = async () => {
    if (!editing) return;
    setSaving(true);
    setError(null);
    try {
      const r = await fetch("/api/v1/admin/gift-services", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editing),
      });
      const j = await r.json();
      if (!r.ok || !j.success) throw new Error(j.error || j.message || "Save failed.");
      setEditing(null);
      await load();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  };

  const toggleActive = async (s: Service) => {
    await fetch("/api/v1/admin/gift-services", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...s, is_active: !s.is_active }),
    });
    load();
  };

  const remove = async (s: Service) => {
    if (!s.id || !window.confirm(`Delete "${s.name}"? Customers will no longer see it at checkout.`)) return;
    await fetch(`/api/v1/admin/gift-services/${encodeURIComponent(s.id)}`, { method: "DELETE" });
    load();
  };

  const input = "w-full px-3 py-2 text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white";
  const set = (k: keyof Service, v: any) => setEditing((prev) => (prev ? { ...prev, [k]: v } : prev));

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-slate-900 dark:text-white">Surprise &amp; Gift Services</h2>
          <p className="text-xs text-slate-500">
            Extras customers can add when sending a cake as a gift — e.g. a greeting card or a surprise video. Set price 0 for free.
            Nothing shows at checkout until you add an active service.
          </p>
        </div>
        <button onClick={() => { setError(null); setEditing({ ...EMPTY, display_order: services.length + 1 }); }} className="px-4 py-2 text-xs font-semibold rounded-xl bg-[#1D2F5D] text-white">
          + Add service
        </button>
      </div>

      {error && <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs">{error}</div>}

      {editing && (
        <div className="p-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <label className="text-xs text-slate-600 dark:text-slate-400">Name *
              <input className={input} value={editing.name} onChange={(e) => set("name", e.target.value)} placeholder="Greeting card with your message" />
            </label>
            <label className="text-xs text-slate-600 dark:text-slate-400">Price (₹, 0 = free)
              <input type="number" min={0} step="1" className={input} value={editing.price} onChange={(e) => set("price", Number(e.target.value))} />
            </label>
            <label className="text-xs text-slate-600 dark:text-slate-400">GST rate
              <select className={input} value={editing.gst_rate} onChange={(e) => set("gst_rate", Number(e.target.value))}>
                {[0, 5, 12, 18, 28].map((r) => <option key={r} value={r}>{r}%</option>)}
              </select>
            </label>
            <label className="text-xs text-slate-600 dark:text-slate-400">HSN / SAC code * (for the tax invoice)
              <input className={input} value={editing.hsn_sac} onChange={(e) => set("hsn_sac", e.target.value)} placeholder="Goods: HSN (cards); services: SAC (photo/video)" />
            </label>
          </div>
          <label className="block text-xs text-slate-600 dark:text-slate-400">Description (shown to customer)
            <input className={input} value={editing.description} onChange={(e) => set("description", e.target.value)} placeholder="We record the recipient's reaction and WhatsApp you the video" />
          </label>
          <div className="flex flex-wrap items-center gap-4 text-xs">
            <label className="flex items-center gap-2"><input type="checkbox" checked={editing.needs_note} onChange={(e) => set("needs_note", e.target.checked)} /> Ask customer for details</label>
            {editing.needs_note && (
              <input className={`${input} max-w-xs`} value={editing.note_label} onChange={(e) => set("note_label", e.target.value)} placeholder="Message to print on the card" />
            )}
            <label className="flex items-center gap-2"><input type="checkbox" checked={editing.is_active} onChange={(e) => set("is_active", e.target.checked)} /> Show at checkout</label>
          </div>
          <div className="flex gap-2">
            <button onClick={save} disabled={saving} className="px-4 py-2 text-xs font-semibold rounded-xl bg-[#1D2F5D] text-white disabled:opacity-50">{saving ? "Saving…" : "Save"}</button>
            <button onClick={() => setEditing(null)} className="px-4 py-2 text-xs rounded-xl border border-slate-300">Cancel</button>
          </div>
        </div>
      )}

      <div className="overflow-x-auto rounded-2xl border border-slate-200 dark:border-slate-800">
        <table className="w-full text-xs">
          <thead className="bg-slate-50 dark:bg-slate-800/60 text-slate-600 dark:text-slate-300">
            <tr>
              <th className="text-left p-2.5">Service</th>
              <th className="text-right p-2.5">Price</th>
              <th className="text-right p-2.5">GST</th>
              <th className="text-left p-2.5">HSN/SAC</th>
              <th className="text-left p-2.5">Asks for</th>
              <th className="text-left p-2.5">Checkout</th>
              <th className="text-right p-2.5">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
            {services.length === 0 ? (
              <tr><td colSpan={7} className="p-4 text-center text-slate-500">No services yet. Add one to offer it at checkout.</td></tr>
            ) : (
              services.map((s) => (
                <tr key={s.id} className="text-slate-800 dark:text-slate-200">
                  <td className="p-2.5"><div className="font-semibold">{s.name}</div>{s.description && <div className="text-[11px] text-slate-500">{s.description}</div>}</td>
                  <td className="p-2.5 text-right">{s.price > 0 ? `₹${s.price}` : "Free"}</td>
                  <td className="p-2.5 text-right">{s.gst_rate}%</td>
                  <td className="p-2.5 font-mono">{s.hsn_sac}</td>
                  <td className="p-2.5">{s.needs_note ? s.note_label || "Details" : "—"}</td>
                  <td className="p-2.5">
                    <button onClick={() => toggleActive(s)} className={`px-2 py-0.5 rounded-md text-[11px] font-semibold ${s.is_active ? "bg-emerald-100 text-emerald-800" : "bg-slate-100 text-slate-600"}`}>
                      {s.is_active ? "Shown" : "Hidden"}
                    </button>
                  </td>
                  <td className="p-2.5 text-right whitespace-nowrap">
                    <button onClick={() => { setError(null); setEditing({ ...s }); }} className="text-[#1D2F5D] dark:text-brand-gold font-semibold mr-3">Edit</button>
                    <button onClick={() => remove(s)} className="text-rose-600 font-semibold">Delete</button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
