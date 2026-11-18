"use client";

/**
 * TDS Register — read-only. Lists TDS recorded at payment/collection time:
 *  - Deducted by us (2130 TDS Payable): to deposit with the government (Form 26Q).
 *  - Deducted from us (1125 TDS Receivable): claim against income tax (check Form 26AS).
 * Data source: GET /api/v1/admin/accounting/tds-register
 */

import { useCallback, useEffect, useState } from "react";

type TdsRow = {
  voucher_no: string;
  voucher_date: string;
  direction: "DEDUCTED_BY_US" | "DEDUCTED_FROM_US";
  section: string | null;
  base_amount: number | null;
  tds_amount: number;
  party_name: string | null;
  narration: string | null;
};

const inr = (n: number) => `₹${(n || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

function currentFyRange(): { from: string; to: string } {
  const now = new Date(Date.now() + 5.5 * 3600 * 1000);
  const y = now.getUTCMonth() + 1 >= 4 ? now.getUTCFullYear() : now.getUTCFullYear() - 1;
  return { from: `${y}-04-01`, to: `${y + 1}-03-31` };
}

export function TdsRegisterPanel() {
  const [range, setRange] = useState(currentFyRange);
  const [rows, setRows] = useState<TdsRow[]>([]);
  const [totals, setTotals] = useState({ deducted_by_us: 0, deducted_from_us: 0 });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [gstr8, setGstr8] = useState<any[]>([]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/v1/admin/accounting/tds-register?from=${range.from}&to=${range.to}`);
      const json = await res.json();
      if (!res.ok || !json?.success) throw new Error(json?.error || "Failed to load TDS register.");
      setRows(json.rows || []);
      setTotals(json.totals || { deducted_by_us: 0, deducted_from_us: 0 });
      const g = await fetch(`/api/v1/admin/accounting/gstr8?from=${range.from}&to=${range.to}`).then((r) => r.json()).catch(() => null);
      setGstr8(g?.rows || []);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [range]);

  useEffect(() => {
    load();
  }, [load]);

  const inputCls = "px-3 py-1.5 text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white";

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-slate-900 dark:text-white">TDS Register</h2>
          <p className="text-xs text-slate-500">TDS recorded when supplier payments are made or corporate receipts are collected.</p>
        </div>
        <div className="flex items-end gap-2">
          <label className="text-xs text-slate-600 dark:text-slate-400">
            From
            <input type="date" value={range.from} onChange={(e) => setRange({ ...range, from: e.target.value })} className={`block ${inputCls}`} />
          </label>
          <label className="text-xs text-slate-600 dark:text-slate-400">
            To
            <input type="date" value={range.to} onChange={(e) => setRange({ ...range, to: e.target.value })} className={`block ${inputCls}`} />
          </label>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="p-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
          <div className="text-xs text-slate-500">Deducted by us — to deposit (2130)</div>
          <div className="text-xl font-bold text-slate-900 dark:text-white">{inr(totals.deducted_by_us)}</div>
        </div>
        <div className="p-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
          <div className="text-xs text-slate-500">Deducted by customers — to claim (1125)</div>
          <div className="text-xl font-bold text-slate-900 dark:text-white">{inr(totals.deducted_from_us)}</div>
        </div>
      </div>

      {error && <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs">{error}</div>}

      <div className="overflow-x-auto rounded-2xl border border-slate-200 dark:border-slate-800">
        <table className="w-full text-xs">
          <thead className="bg-slate-50 dark:bg-slate-800/60 text-slate-600 dark:text-slate-300">
            <tr>
              <th className="text-left p-2.5">Date</th>
              <th className="text-left p-2.5">Voucher</th>
              <th className="text-left p-2.5">Type</th>
              <th className="text-left p-2.5">Section</th>
              <th className="text-left p-2.5">Party</th>
              <th className="text-right p-2.5">Amount paid / received</th>
              <th className="text-right p-2.5">TDS</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
            {loading ? (
              <tr><td colSpan={7} className="p-4 text-center text-slate-500">Loading…</td></tr>
            ) : rows.length === 0 ? (
              <tr><td colSpan={7} className="p-4 text-center text-slate-500">No TDS recorded in this period.</td></tr>
            ) : (
              rows.map((r) => (
                <tr key={`${r.voucher_no}-${r.direction}`} className="text-slate-800 dark:text-slate-200">
                  <td className="p-2.5">{r.voucher_date}</td>
                  <td className="p-2.5 font-mono">{r.voucher_no}</td>
                  <td className="p-2.5">{r.direction === "DEDUCTED_BY_US" ? "Deducted by us" : "Deducted by customer"}</td>
                  <td className="p-2.5">{r.section || "—"}</td>
                  <td className="p-2.5">{r.party_name || "—"}</td>
                  <td className="p-2.5 text-right">{r.base_amount == null ? "—" : inr(r.base_amount)}</td>
                  <td className="p-2.5 text-right font-semibold">{inr(r.tds_amount)}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div>
        <h3 className="text-sm font-bold text-slate-900 dark:text-white">GST TCS collected — GSTR-8</h3>
        <p className="text-xs text-slate-500 mb-2">
          0.5% TCS on marketplace partners' net taxable supplies, by return period and partner GSTIN (file by the 10th of the next month).
        </p>
        <div className="overflow-x-auto rounded-2xl border border-slate-200 dark:border-slate-800">
          <table className="w-full text-xs">
            <thead className="bg-slate-50 dark:bg-slate-800/60 text-slate-600 dark:text-slate-300">
              <tr>
                <th className="text-left p-2.5">Return period</th>
                <th className="text-left p-2.5">Partner GSTIN</th>
                <th className="text-left p-2.5">Partner</th>
                <th className="text-right p-2.5">Supplies</th>
                <th className="text-right p-2.5">Net taxable value</th>
                <th className="text-right p-2.5">TCS (0.5%)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
              {gstr8.length === 0 ? (
                <tr><td colSpan={6} className="p-4 text-center text-slate-500">No marketplace TCS in this period.</td></tr>
              ) : (
                gstr8.map((g) => (
                  <tr key={`${g.return_period}-${g.partner_gstin}`} className="text-slate-800 dark:text-slate-200">
                    <td className="p-2.5">{g.return_period}</td>
                    <td className="p-2.5 font-mono">{g.partner_gstin || "—"}</td>
                    <td className="p-2.5">{g.partner_legal_name || "—"}</td>
                    <td className="p-2.5 text-right">{g.supply_count}</td>
                    <td className="p-2.5 text-right">{inr(g.net_taxable_value)}</td>
                    <td className="p-2.5 text-right font-semibold">{inr(g.tcs_amount)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
