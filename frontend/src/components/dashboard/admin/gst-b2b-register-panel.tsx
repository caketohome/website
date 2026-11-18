"use client";

/**
 * GST B2B Sales Register — tax invoices issued to GST-registered buyers, rate-wise (GSTR-1 B2B).
 * Includes cakes sold by marketplace partners (seller = partner GSTIN) so corporates can match input
 * tax credit (GSTR-2B) and partners can file their GSTR-1.
 * Data source: GET /api/v1/admin/accounting/gst-b2b
 */

import { useCallback, useEffect, useState } from "react";

type Row = {
  invoice_number: string;
  invoice_date: string;
  seller_gstin: string | null;
  seller_name: string | null;
  is_partner_sale: boolean;
  buyer_gstin: string;
  buyer_name: string | null;
  place_of_supply: string | null;
  gst_rate: number;
  taxable_value: number;
  cgst: number;
  sgst: number;
  igst: number;
  invoice_value: number;
};

const inr = (n: number) => `₹${(n || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

function currentMonthRange(): { from: string; to: string } {
  const now = new Date(Date.now() + 5.5 * 3600 * 1000);
  const y = now.getUTCFullYear();
  const m = now.getUTCMonth();
  const last = new Date(Date.UTC(y, m + 1, 0)).getUTCDate();
  const mm = String(m + 1).padStart(2, "0");
  return { from: `${y}-${mm}-01`, to: `${y}-${mm}-${String(last).padStart(2, "0")}` };
}

function csvCell(v: unknown) {
  const s = v == null ? "" : String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function GstB2bRegisterPanel() {
  const [range, setRange] = useState(currentMonthRange);
  const [seller, setSeller] = useState<"all" | "own" | "partner">("all");
  const [rows, setRows] = useState<Row[]>([]);
  const [totals, setTotals] = useState({ invoices: 0, taxable_value: 0, cgst: 0, sgst: 0, igst: 0 });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/v1/admin/accounting/gst-b2b?from=${range.from}&to=${range.to}&seller=${seller}`);
      const json = await res.json();
      if (!res.ok || !json?.success) throw new Error(json?.error || "Failed to load B2B register.");
      setRows(json.rows || []);
      setTotals(json.totals || { invoices: 0, taxable_value: 0, cgst: 0, sgst: 0, igst: 0 });
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [range, seller]);

  useEffect(() => {
    load();
  }, [load]);

  const exportCsv = () => {
    const head = ["Seller GSTIN", "Seller", "Sold by", "Buyer GSTIN", "Buyer", "Invoice No", "Invoice Date", "Invoice Value", "Place of Supply", "Rate %", "Taxable Value", "CGST", "SGST", "IGST"];
    const lines = rows.map((r) =>
      [r.seller_gstin, r.seller_name, r.is_partner_sale ? "Partner" : "Own", r.buyer_gstin, r.buyer_name, r.invoice_number, r.invoice_date, r.invoice_value, r.place_of_supply, r.gst_rate, r.taxable_value, r.cgst, r.sgst, r.igst]
        .map(csvCell)
        .join(",")
    );
    const blob = new Blob([[head.join(","), ...lines].join("\n")], { type: "text/csv" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `gst-b2b-${range.from}-to-${range.to}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const inputCls = "px-3 py-1.5 text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white";
  const card = "p-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900";

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-slate-900 dark:text-white">GST B2B Sales Register</h2>
          <p className="text-xs text-slate-500">Invoices to GST-registered buyers, rate-wise. Partner-sold cakes show the partner as seller (their GSTR-1).</p>
        </div>
        <div className="flex flex-wrap items-end gap-2">
          <label className="text-xs text-slate-600 dark:text-slate-400">
            From
            <input type="date" value={range.from} onChange={(e) => setRange({ ...range, from: e.target.value })} className={`block ${inputCls}`} />
          </label>
          <label className="text-xs text-slate-600 dark:text-slate-400">
            To
            <input type="date" value={range.to} onChange={(e) => setRange({ ...range, to: e.target.value })} className={`block ${inputCls}`} />
          </label>
          <label className="text-xs text-slate-600 dark:text-slate-400">
            Sold by
            <select value={seller} onChange={(e) => setSeller(e.target.value as any)} className={`block ${inputCls}`}>
              <option value="all">All</option>
              <option value="own">Our sales</option>
              <option value="partner">Partner sales</option>
            </select>
          </label>
          <button onClick={exportCsv} disabled={rows.length === 0} className="px-3 py-1.5 text-xs font-semibold rounded-xl bg-slate-900 text-white dark:bg-white dark:text-slate-900 disabled:opacity-40">
            Export CSV
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        <div className={card}><div className="text-xs text-slate-500">Invoices</div><div className="text-xl font-bold text-slate-900 dark:text-white">{totals.invoices}</div></div>
        <div className={card}><div className="text-xs text-slate-500">Taxable value</div><div className="text-xl font-bold text-slate-900 dark:text-white">{inr(totals.taxable_value)}</div></div>
        <div className={card}><div className="text-xs text-slate-500">CGST</div><div className="text-xl font-bold text-slate-900 dark:text-white">{inr(totals.cgst)}</div></div>
        <div className={card}><div className="text-xs text-slate-500">SGST</div><div className="text-xl font-bold text-slate-900 dark:text-white">{inr(totals.sgst)}</div></div>
        <div className={card}><div className="text-xs text-slate-500">IGST</div><div className="text-xl font-bold text-slate-900 dark:text-white">{inr(totals.igst)}</div></div>
      </div>

      {error && <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs">{error}</div>}

      <div className="overflow-x-auto rounded-2xl border border-slate-200 dark:border-slate-800">
        <table className="w-full text-xs">
          <thead className="bg-slate-50 dark:bg-slate-800/60 text-slate-600 dark:text-slate-300">
            <tr>
              <th className="text-left p-2.5">Date</th>
              <th className="text-left p-2.5">Invoice</th>
              <th className="text-left p-2.5">Seller GSTIN</th>
              <th className="text-left p-2.5">Buyer GSTIN</th>
              <th className="text-left p-2.5">Buyer</th>
              <th className="text-left p-2.5">Place of supply</th>
              <th className="text-right p-2.5">Rate</th>
              <th className="text-right p-2.5">Taxable</th>
              <th className="text-right p-2.5">CGST</th>
              <th className="text-right p-2.5">SGST</th>
              <th className="text-right p-2.5">IGST</th>
              <th className="text-right p-2.5">Invoice value</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
            {loading ? (
              <tr><td colSpan={12} className="p-4 text-center text-slate-500">Loading…</td></tr>
            ) : rows.length === 0 ? (
              <tr><td colSpan={12} className="p-4 text-center text-slate-500">No B2B invoices in this period.</td></tr>
            ) : (
              rows.map((r) => (
                <tr key={`${r.invoice_number}-${r.gst_rate}`} className="text-slate-800 dark:text-slate-200">
                  <td className="p-2.5">{r.invoice_date}</td>
                  <td className="p-2.5 font-mono">{r.invoice_number}</td>
                  <td className="p-2.5 font-mono">
                    {r.seller_gstin || "—"}
                    {r.is_partner_sale && <span className="ml-1 px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 text-[10px]">Partner</span>}
                  </td>
                  <td className="p-2.5 font-mono">{r.buyer_gstin}</td>
                  <td className="p-2.5">{r.buyer_name || "—"}</td>
                  <td className="p-2.5">{r.place_of_supply || "—"}</td>
                  <td className="p-2.5 text-right">{r.gst_rate}%</td>
                  <td className="p-2.5 text-right">{inr(r.taxable_value)}</td>
                  <td className="p-2.5 text-right">{inr(r.cgst)}</td>
                  <td className="p-2.5 text-right">{inr(r.sgst)}</td>
                  <td className="p-2.5 text-right">{inr(r.igst)}</td>
                  <td className="p-2.5 text-right font-semibold">{inr(r.invoice_value)}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
