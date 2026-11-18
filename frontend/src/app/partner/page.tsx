"use client";

/**
 * Marketplace partner portal. A partner contact signs in by OTP (access granted by an admin) and sees only
 * their own data: unpaid balance, payout history with commission invoices, and recent orders.
 */

import { useEffect, useState } from "react";

const inr = (n: any) => `₹${Number(n || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const d10 = (s: any) => (s ? String(s).slice(0, 10) : "—");

export default function PartnerPortalPage() {
  const [data, setData] = useState<any | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/v1/partner/portal/summary", { cache: "no-store" })
      .then(async (r) => {
        if (r.status === 401) {
          window.location.href = "/login?next=/partner";
          return null;
        }
        const j = await r.json();
        if (!r.ok || !j.success) throw new Error(j.error === "FORBIDDEN" ? "This login does not have partner portal access." : j.error || "Could not load your account.");
        return j;
      })
      .then((j) => j && setData(j))
      .catch((e) => setError(e.message));
  }, []);

  const card = "rounded-2xl border border-slate-200 bg-white p-4";

  if (error) {
    return (
      <main className="mx-auto max-w-3xl px-4 py-16">
        <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800">{error}</div>
      </main>
    );
  }
  if (!data) return <main className="mx-auto max-w-3xl px-4 py-16 text-sm text-slate-500">Loading your partner account…</main>;

  const { partner, agreement, unpaid, payouts, orders } = data;

  return (
    <main className="mx-auto max-w-6xl space-y-5 px-4 py-8">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-900">{partner.trade_name}</h1>
          <p className="text-xs text-slate-500">
            {partner.legal_name} · GSTIN {partner.gstin || "—"} · {partner.status.replace(/_/g, " ")}
          </p>
        </div>
        <button
          onClick={async () => {
            await fetch("/api/auth/logout", { method: "POST" }).catch(() => {});
            window.location.href = "/login";
          }}
          className="rounded-xl border border-slate-300 px-3 py-1.5 text-xs font-semibold"
        >
          Sign out
        </button>
      </header>

      <section className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div className={card}>
          <div className="text-xs text-slate-500">Unpaid balance (delivered orders)</div>
          <div className="text-2xl font-bold text-slate-900">{inr(unpaid.net_payable)}</div>
          <div className="text-[11px] text-slate-500">{unpaid.order_count} order(s) awaiting payout</div>
        </div>
        <div className={card}>
          <div className="text-xs text-slate-500">Commission terms</div>
          <div className="text-lg font-bold text-slate-900">
            {agreement ? `${agreement.commission_rate}%${agreement.fixed_fee_per_order ? ` + ${inr(agreement.fixed_fee_per_order)}/order` : ""}` : "—"}
          </div>
          <div className="text-[11px] text-slate-500">+18% GST on commission · 0.5% GST TCS · 0.1% TDS (194-O)</div>
        </div>
        <div className={card}>
          <div className="text-xs text-slate-500">Payout account</div>
          <div className="text-lg font-bold text-slate-900">{partner.bank_account || "Not on file"}</div>
          <div className="text-[11px] text-slate-500">To change it, contact CakeToHome support.</div>
        </div>
      </section>

      <section className={card}>
        <h2 className="mb-2 text-sm font-bold text-slate-900">Payouts</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="text-slate-500">
              <tr>
                <th className="p-2 text-left">Period</th><th className="p-2 text-right">Orders</th>
                <th className="p-2 text-right">Your sales</th><th className="p-2 text-right">Commission + GST</th>
                <th className="p-2 text-right">TCS + TDS</th><th className="p-2 text-right">Paid to you</th>
                <th className="p-2 text-left">Commission invoice</th><th className="p-2 text-left">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {payouts.length === 0 ? (
                <tr><td colSpan={8} className="p-3 text-center text-slate-500">No payouts yet.</td></tr>
              ) : payouts.map((p: any) => (
                <tr key={p.id}>
                  <td className="p-2">{d10(p.period_start)} → {d10(p.period_end)}</td>
                  <td className="p-2 text-right">{p.order_count}</td>
                  <td className="p-2 text-right">{inr(p.partner_sales_gross)}</td>
                  <td className="p-2 text-right">{inr(p.commission_amount + p.commission_gst)}</td>
                  <td className="p-2 text-right">{inr(p.tcs_amount + p.tds_194o_amount)}</td>
                  <td className="p-2 text-right font-semibold">{inr(p.net_payable)}</td>
                  <td className="p-2 font-mono">{p.commission_invoice_number || "—"}</td>
                  <td className="p-2">{p.status === "PAID" ? `Paid ${d10(p.paid_at)}${p.payment_reference ? ` · UTR ${p.payment_reference}` : ""}` : p.status}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className={card}>
        <h2 className="mb-2 text-sm font-bold text-slate-900">Recent orders</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="text-slate-500">
              <tr>
                <th className="p-2 text-left">Order</th><th className="p-2 text-left">Placed</th>
                <th className="p-2 text-left">Delivery date</th><th className="p-2 text-left">Status</th>
                <th className="p-2 text-left">Invoice</th><th className="p-2 text-right">Order value</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {orders.length === 0 ? (
                <tr><td colSpan={6} className="p-3 text-center text-slate-500">No orders yet.</td></tr>
              ) : orders.map((o: any) => (
                <tr key={o.id}>
                  <td className="p-2 font-mono">#{o.display_id || o.id.slice(-8)}</td>
                  <td className="p-2">{d10(o.created_at)}</td>
                  <td className="p-2">{o.delivery_date || "—"}</td>
                  <td className="p-2">{o.partner_order_status || o.status}</td>
                  <td className="p-2 font-mono">{o.invoice_number || "—"}</td>
                  <td className="p-2 text-right">{inr(o.grand_total)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}
