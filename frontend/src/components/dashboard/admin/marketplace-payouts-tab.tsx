"use client";

/**
 * Marketplace partner payouts: preview a partner's unpaid posted orders for a period, create the payout
 * (issues our commission tax invoice), then pay it (posts Dr Partner Payable / Cr Bank).
 */

import { useCallback, useEffect, useState } from "react";

type PartnerOption = { id: string; code: string; trade_name?: string; legal_name: string; status: string };

const inr = (n: any) => `₹${Number(n || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const today = () => new Date(Date.now() + 5.5 * 3600 * 1000).toISOString().slice(0, 10);
const monthStart = () => today().slice(0, 8) + "01";

export function MarketplacePayoutsTab({ partners }: { partners: PartnerOption[] }) {
  const payable = partners.filter((p) => p.status === "APPROVED" || p.status === "ACTIVE" || p.status === "SUSPENDED");
  const [partnerId, setPartnerId] = useState(payable[0]?.id || "");
  const [from, setFrom] = useState(monthStart());
  const [to, setTo] = useState(today());
  const [statement, setStatement] = useState<any | null>(null);
  const [payouts, setPayouts] = useState<any[]>([]);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  useEffect(() => {
    if (!partnerId && payable[0]) setPartnerId(payable[0].id);
  }, [payable, partnerId]);

  const loadPayouts = useCallback(async () => {
    const res = await fetch(`/api/v1/admin/marketplace/payouts${partnerId ? `?partner_id=${encodeURIComponent(partnerId)}` : ""}`);
    const json = await res.json().catch(() => ({}));
    setPayouts(json.payouts || []);
  }, [partnerId]);

  useEffect(() => {
    loadPayouts();
  }, [loadPayouts]);

  const call = async (fn: () => Promise<Response>, okText: string) => {
    setBusy(true);
    setMsg(null);
    try {
      const res = await fn();
      const json = await res.json().catch(() => ({}));
      if (!res.ok || json.success === false) throw new Error(json.error || "Request failed.");
      setMsg({ ok: true, text: okText });
      return json;
    } catch (e: any) {
      setMsg({ ok: false, text: e.message });
      return null;
    } finally {
      setBusy(false);
    }
  };

  const preview = async () => {
    const json = await call(
      () => fetch(`/api/v1/admin/marketplace/payouts/preview?partner_id=${encodeURIComponent(partnerId)}&from=${from}&to=${to}`),
      "Statement loaded."
    );
    if (json) setStatement(json.statement);
  };

  const create = async () => {
    const json = await call(
      () => fetch("/api/v1/admin/marketplace/payouts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ partner_id: partnerId, period_start: from, period_end: to }),
      }),
      "Payout created with commission invoice."
    );
    if (json) {
      setStatement(null);
      loadPayouts();
    }
  };

  const pay = async (p: any) => {
    const reference = window.prompt(`Pay ${inr(p.net_payable)} to ${p.partner_trade_name}.\nEnter the bank transfer UTR / reference:`);
    if (!reference) return;
    const json = await call(
      () => fetch(`/api/v1/admin/marketplace/payouts/${encodeURIComponent(p.id)}/pay`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ payment_date: today(), payment_method: "BANK_TRANSFER", reference }),
      }),
      `Paid ${inr(p.net_payable)} — posted to the ledger.`
    );
    if (json) loadPayouts();
  };

  const cancel = async (p: any) => {
    const reason = window.prompt("Reason for cancelling this draft payout?");
    if (!reason) return;
    const json = await call(
      () => fetch(`/api/v1/admin/marketplace/payouts/${encodeURIComponent(p.id)}/cancel`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason }),
      }),
      "Draft payout cancelled."
    );
    if (json) loadPayouts();
  };

  const input = "px-3 py-1.5 text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white";
  const t = statement?.totals;

  return (
    <div className="space-y-4">
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-4 space-y-3">
        <div className="flex flex-wrap items-end gap-2">
          <label className="text-xs text-slate-600 dark:text-slate-400">
            Partner
            <select value={partnerId} onChange={(e) => { setPartnerId(e.target.value); setStatement(null); }} className={`block ${input}`}>
              {payable.length === 0 && <option value="">No approved partners</option>}
              {payable.map((p) => (
                <option key={p.id} value={p.id}>{p.trade_name || p.legal_name} ({p.code})</option>
              ))}
            </select>
          </label>
          <label className="text-xs text-slate-600 dark:text-slate-400">
            From
            <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className={`block ${input}`} />
          </label>
          <label className="text-xs text-slate-600 dark:text-slate-400">
            To
            <input type="date" value={to} onChange={(e) => setTo(e.target.value)} className={`block ${input}`} />
          </label>
          <button onClick={preview} disabled={busy || !partnerId} className="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 text-xs font-bold disabled:opacity-50">
            Preview statement
          </button>
        </div>

        {msg && (
          <div className={`p-2.5 rounded-xl text-xs ${msg.ok ? "bg-emerald-50 text-emerald-800 border border-emerald-200" : "bg-rose-50 text-rose-800 border border-rose-200"}`}>
            {msg.text}
          </div>
        )}

        {statement && (
          <div className="space-y-3">
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2 text-xs">
              {[
                ["Orders", t.order_count],
                ["Partner sales", inr(t.partner_sale_gross)],
                ["Commission", inr(t.commission)],
                ["GST on commission", inr(t.commission_gst)],
                ["TCS 0.5% + TDS 194-O", inr(Number(t.tcs) + Number(t.tds_194o))],
                ["Net payable", inr(t.net_payable)],
              ].map(([k, v]) => (
                <div key={String(k)} className="p-3 rounded-xl border border-slate-200 dark:border-slate-800">
                  <div className="text-slate-500">{k}</div>
                  <div className="font-bold text-slate-900 dark:text-white">{v}</div>
                </div>
              ))}
            </div>
            <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800">
              <table className="w-full text-xs">
                <thead className="bg-slate-50 dark:bg-slate-800/60 text-slate-600">
                  <tr>
                    <th className="text-left p-2">Date</th><th className="text-left p-2">Voucher</th>
                    <th className="text-right p-2">Sale</th><th className="text-right p-2">Commission</th>
                    <th className="text-right p-2">GST</th><th className="text-right p-2">TCS</th>
                    <th className="text-right p-2">TDS</th><th className="text-right p-2">Net</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                  {statement.lines.length === 0 ? (
                    <tr><td colSpan={8} className="p-3 text-center text-slate-500">No unpaid posted orders in this period.</td></tr>
                  ) : statement.lines.map((l: any) => (
                    <tr key={l.order_id}>
                      <td className="p-2">{l.voucher_date}</td><td className="p-2 font-mono">{l.voucher_no}</td>
                      <td className="p-2 text-right">{inr(l.partner_sale_gross)}</td><td className="p-2 text-right">{inr(l.commission)}</td>
                      <td className="p-2 text-right">{inr(l.commission_gst)}</td><td className="p-2 text-right">{inr(l.tcs)}</td>
                      <td className="p-2 text-right">{inr(l.tds_194o)}</td><td className="p-2 text-right font-semibold">{inr(l.net_payable)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {statement.lines.length > 0 && (
              <button onClick={create} disabled={busy} className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold disabled:opacity-50">
                Create payout of {inr(t.net_payable)} + commission invoice
              </button>
            )}
          </div>
        )}
      </div>

      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-x-auto">
        <table className="w-full text-xs">
          <thead className="bg-slate-50 dark:bg-slate-800/60 text-slate-600">
            <tr>
              <th className="text-left p-2.5">Partner</th><th className="text-left p-2.5">Period</th>
              <th className="text-left p-2.5">Commission invoice</th><th className="text-right p-2.5">Orders</th>
              <th className="text-right p-2.5">Net payable</th><th className="text-left p-2.5">Status</th>
              <th className="text-right p-2.5">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
            {payouts.length === 0 ? (
              <tr><td colSpan={7} className="p-4 text-center text-slate-500">No payouts yet.</td></tr>
            ) : payouts.map((p) => (
              <tr key={p.id}>
                <td className="p-2.5">{p.partner_trade_name}</td>
                <td className="p-2.5">{String(p.period_start).slice(0, 10)} → {String(p.period_end).slice(0, 10)}</td>
                <td className="p-2.5 font-mono">{p.commission_invoice_number || "—"}</td>
                <td className="p-2.5 text-right">{p.order_count}</td>
                <td className="p-2.5 text-right font-semibold">{inr(p.net_payable)}</td>
                <td className="p-2.5">{p.status}{p.payment_reference ? ` · ${p.payment_reference}` : ""}</td>
                <td className="p-2.5 text-right space-x-1.5 whitespace-nowrap">
                  {p.status === "DRAFT" && (
                    <>
                      <button onClick={() => pay(p)} disabled={busy} className="px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-semibold disabled:opacity-50">Pay</button>
                      <button onClick={() => cancel(p)} disabled={busy} className="px-2.5 py-1 rounded-lg border border-slate-300 font-semibold disabled:opacity-50">Cancel</button>
                    </>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
