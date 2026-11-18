"use client";

/**
 * Parent Company & Branch Dues
 *  1. Parent company purchases (optional): stores buy what they sell from the parent (e.g. Baked). On each
 *     delivered own-store sale a purchase bill from the parent is posted and appears in Bills Payable.
 *  2. Branch dues: company expenses a branch paid from its own money ("Paid by branch" on Expenses).
 *     Shown as a negative branch balance with Pay / Undo payment / Reverse.
 */

import { useCallback, useEffect, useState } from "react";

const inr = (n: number) => `₹${(Number(n) || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export function IntercompanyPanel() {
  const [cfg, setCfg] = useState<any>(null);
  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [purchases, setPurchases] = useState<any[]>([]);
  const [reimb, setReimb] = useState<{ rows: any[]; branches: any[]; total_owed: number }>({ rows: [], branches: [], total_owed: 0 });
  const [banks, setBanks] = useState<any[]>([]);
  const [cashAccounts, setCashAccounts] = useState<any[]>([]);
  const [pendingOrders, setPendingOrders] = useState(0);
  const [branchList, setBranchList] = useState<any[]>([]);
  const [payFrom, setPayFrom] = useState<Record<string, string>>({}); // reimbursement id -> "bank:<id>" | "cash:<id>" | "cash:"
  const [msg, setMsg] = useState<{ kind: "ok" | "err"; text: string } | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    const [pc, br, bk] = await Promise.all([
      fetch("/api/v1/admin/accounting/parent-company", { cache: "no-store" }).then((r) => r.json()).catch(() => null),
      fetch("/api/v1/admin/accounting/branch-reimbursements", { cache: "no-store" }).then((r) => r.json()).catch(() => null),
      fetch("/api/v1/accounting/bank-accounts", { cache: "no-store" }).then((r) => r.json()).catch(() => null),
    ]);
    if (pc?.success) {
      setCfg(pc.config);
      setSuppliers(pc.suppliers || []);
      setPurchases(pc.purchases || []);
      setCashAccounts(pc.cashAccounts || []);
      setPendingOrders(Number(pc.pendingOrders || 0));
      setBranchList(pc.branches || []);
    }
    if (br?.success) setReimb({ rows: br.rows || [], branches: br.branches || [], total_owed: br.total_owed || 0 });
    if (bk?.success) setBanks((bk.data || bk.bankAccounts || []).filter((b: any) => b.status === "ACTIVE"));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const post = async (url: string, body: any, key: string) => {
    setBusy(key);
    setMsg(null);
    try {
      const r = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const j = await r.json();
      if (!r.ok || !j.success) throw new Error(j.error || j.message || "Request failed.");
      await load();
      return j;
    } catch (e: any) {
      setMsg({ kind: "err", text: e.message });
      return null;
    } finally {
      setBusy(null);
    }
  };

  const saveConfig = async () => {
    const j = await post("/api/v1/admin/accounting/parent-company", cfg, "cfg");
    if (j) setMsg({ kind: "ok", text: cfg.enabled ? "Saved. New deliveries from your stores will raise a purchase bill from the parent company." : "Saved. Parent company purchases are off." });
  };

  const payOptions = [
    ...banks.map((b) => ({ value: `bank:${b.id}`, label: `Bank · ${b.bank_name} ${b.account_number_masked || ""}` })),
    ...(banks.length === 0 ? [{ value: "bank:", label: "Bank · Bank Operating A/c (1112)" }] : []),
    ...cashAccounts.map((c) => ({ value: `cash:${c.id}`, label: `Cash · ${c.account_name}` })),
    { value: "cash:", label: "Cash · Cash in Hand (1111)" },
  ];
  const pay = async (row: any) => {
    const choice = payFrom[row.id] || payOptions[0].value;
    const [kind, accId] = choice.split(":");
    if (!window.confirm(`Pay ${inr(row.amount)} back to ${row.branch_name || row.branch_id} by ${kind === "cash" ? "cash" : "bank transfer"}?`)) return;
    const body = kind === "cash" ? { method: "CASH", cash_account_id: accId || null } : { method: "BANK", bank_account_id: accId || null };
    const j = await post(`/api/v1/admin/accounting/branch-reimbursements/${encodeURIComponent(row.id)}/pay`, body, row.id);
    if (j) setMsg({ kind: "ok", text: "Reimbursement paid and posted." });
  };
  const raiseBills = async () => {
    const j = await post("/api/v1/admin/accounting/parent-company/raise-bills", {}, "bills");
    if (j) {
      const made = (j.results || []).filter((r: any) => r.created);
      const issues = (j.results || []).filter((r: any) => !r.created && r.reason);
      setMsg({
        kind: issues.length && !made.length ? "err" : "ok",
        text: made.length
          ? `Raised ${made.length} bill(s) for ${made[0].period}. ${issues.map((r: any) => r.reason).join("; ")}`
          : issues.length
          ? issues.map((r: any) => r.reason).join("; ")
          : "Nothing to bill in this period yet.",
      });
    }
  };
  const undo = async (row: any) => {
    const reason = window.prompt("Why undo this reimbursement payment?");
    if (!reason) return;
    const j = await post(`/api/v1/admin/accounting/branch-reimbursements/${encodeURIComponent(row.id)}/undo-payment`, { reason }, row.id);
    if (j) setMsg({ kind: "ok", text: "Payment undone. The amount is owed to the branch again." });
  };
  const reverse = async (row: any) => {
    const reason = window.prompt("Why reverse this branch-paid expense? (The expense will be cancelled in the books.)");
    if (!reason) return;
    const j = await post(`/api/v1/admin/accounting/branch-reimbursements/${encodeURIComponent(row.id)}/reverse`, { reason }, row.id);
    if (j) setMsg({ kind: "ok", text: "Expense reversed. Nothing is owed to the branch for it." });
  };

  const card = "p-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900";
  const input = "w-full px-3 py-2 text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white";
  const set = (k: string, v: any) => setCfg((p: any) => ({ ...p, [k]: v }));
  const parent = suppliers.find((s) => s.id === cfg?.supplier_id);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-bold text-slate-900 dark:text-white">Parent Company &amp; Branch Dues</h2>
        <p className="text-xs text-slate-500">Purchases from your parent company, and money owed back to branches that paid company expenses.</p>
      </div>

      {msg && (
        <div className={`p-3 rounded-xl text-xs border ${msg.kind === "ok" ? "bg-emerald-50 border-emerald-200 text-emerald-800" : "bg-rose-50 border-rose-200 text-rose-800"}`}>{msg.text}</div>
      )}

      {/* 1. Parent company */}
      <section className={card}>
        <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
          <div>
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">Parent company purchases</h3>
            <p className="text-[11px] text-slate-500">
              When on, each sale delivered from your own stores raises a purchase bill from the parent company (shown in Bills Payable under its name).
              The store&apos;s profit is the sale minus that price. Partner-store sales are never included.
            </p>
          </div>
          {cfg && (
            <label className="flex items-center gap-2 text-xs font-semibold">
              <input type="checkbox" checked={Boolean(cfg.enabled)} onChange={(e) => set("enabled", e.target.checked)} /> On
            </label>
          )}
        </div>
        {!cfg ? (
          <p className="text-xs text-slate-500">Loading…</p>
        ) : (
          <div className="space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              <label className="text-xs text-slate-600 dark:text-slate-400">Parent company (supplier)
                <select className={input} value={cfg.supplier_id || ""} onChange={(e) => set("supplier_id", e.target.value || null)}>
                  <option value="">— choose —</option>
                  {suppliers.map((s) => <option key={s.id} value={s.id}>{s.name}{s.gstin ? ` · ${s.gstin}` : " · no GSTIN"}</option>)}
                </select>
                {suppliers.length === 0 && <span className="text-[10px] text-amber-700">Add the parent company (e.g. Baked) under Suppliers first.</span>}
              </label>
              <label className="text-xs text-slate-600 dark:text-slate-400">How the parent&apos;s price is set
                <select className={input} value={cfg.price_method} onChange={(e) => set("price_method", e.target.value)}>
                  <option value="PERCENT_OF_SALE">% of the sale value</option>
                  <option value="PRODUCT_COST">Product cost price</option>
                  <option value="COST_ELSE_PERCENT">Cost price, else % of sale</option>
                </select>
              </label>
              {cfg.price_method !== "PRODUCT_COST" && (
                <label className="text-xs text-slate-600 dark:text-slate-400">% of sale value
                  <input type="number" min={1} max={100} className={input} value={cfg.transfer_price_pct} onChange={(e) => set("transfer_price_pct", Number(e.target.value))} />
                </label>
              )}
              <label className="text-xs text-slate-600 dark:text-slate-400">Billing
                <select
                  className={input}
                  value={cfg.billing_mode === "PER_ORDER" ? "PER_ORDER" : cfg.billing_frequency}
                  onChange={(e) => (e.target.value === "PER_ORDER" ? set("billing_mode", "PER_ORDER") : setCfg((p: any) => ({ ...p, billing_mode: "PERIODIC", billing_frequency: e.target.value })))}
                >
                  <option value="DAILY">Daily</option>
                  <option value="WEEKLY">Weekly (Mon–Sun)</option>
                  <option value="SEMI_MONTHLY">Twice a month (1–15, 16–end)</option>
                  <option value="MONTHLY">Monthly</option>
                  <option value="PER_ORDER">Every delivered order</option>
                </select>
              </label>
              {cfg.billing_mode !== "PER_ORDER" && (
                <label className="text-xs text-slate-600 dark:text-slate-400">Bill covers
                  <select className={input} value={cfg.bill_scope} onChange={(e) => set("bill_scope", e.target.value)}>
                    <option value="PER_BRANCH">Each branch separately</option>
                    <option value="ALL_BRANCHES">All branches in one bill</option>
                  </select>
                </label>
              )}
              {cfg.billing_mode !== "PER_ORDER" && cfg.bill_scope === "ALL_BRANCHES" && (
                <label className="text-xs text-slate-600 dark:text-slate-400">Record combined bill under
                  <select className={input} value={cfg.billing_branch_id || ""} onChange={(e) => set("billing_branch_id", e.target.value || null)}>
                    <option value="">First branch</option>
                    {branchList.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
                  </select>
                </label>
              )}
              <label className="text-xs text-slate-600 dark:text-slate-400">GST on parent bills
                <select className={input} value={cfg.gst_mode} onChange={(e) => set("gst_mode", e.target.value)}>
                  <option value="WITHOUT_GST">Without GST (not registered yet)</option>
                  <option value="WITH_GST" disabled={Boolean(parent && !parent.gstin)}>With GST (input tax credit)</option>
                </select>
              </label>
              <label className="text-xs text-slate-600 dark:text-slate-400">Pay within (days)
                <input type="number" min={0} max={180} className={input} value={cfg.credit_days} onChange={(e) => set("credit_days", Number(e.target.value))} />
              </label>
            </div>
            <label className="flex items-center gap-2 text-xs">
              <input type="checkbox" checked={Boolean(cfg.include_accessories)} onChange={(e) => set("include_accessories", e.target.checked)} />
              Also buy accessories from the parent (otherwise cakes only)
            </label>
            {cfg.price_method !== "PERCENT_OF_SALE" && (
              <p className="text-[11px] text-slate-500">Cost price comes from each product (Catalog → product → weights &amp; cost). Products without a cost price {cfg.price_method === "PRODUCT_COST" ? "are reported and not billed" : "use the % instead"}.</p>
            )}
            <div className="flex flex-wrap items-center gap-2">
              <button onClick={saveConfig} disabled={busy === "cfg"} className="px-4 py-2 text-xs font-semibold rounded-xl bg-[#1D2F5D] text-white disabled:opacity-50">
                {busy === "cfg" ? "Saving…" : "Save settings"}
              </button>
              {cfg.enabled && cfg.billing_mode !== "PER_ORDER" && (
                <button onClick={raiseBills} disabled={busy === "bills"} className="px-4 py-2 text-xs font-semibold rounded-xl border border-slate-300 disabled:opacity-50">
                  {busy === "bills" ? "Raising…" : `Raise bill now for this period${pendingOrders ? ` (${pendingOrders} unbilled order${pendingOrders === 1 ? "" : "s"})` : ""}`}
                </button>
              )}
            </div>
            {cfg.enabled && cfg.billing_mode !== "PER_ORDER" && (
              <p className="text-[11px] text-slate-500">Finished periods are billed automatically; the current period is billed on its last day by the nightly job, or now with this button.</p>
            )}
            {purchases.length > 0 && (
              <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800 mt-2">
                <table className="w-full text-xs">
                  <thead className="bg-slate-50 dark:bg-slate-800/60 text-slate-600 dark:text-slate-300">
                    <tr><th className="text-left p-2">Bill</th><th className="text-left p-2">Order</th><th className="text-left p-2">Date</th><th className="text-right p-2">Amount</th><th className="text-left p-2">Status</th></tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                    {purchases.map((p) => (
                      <tr key={p.id}><td className="p-2 font-mono">{p.invoice_no}</td><td className="p-2">{p.order_number || "—"}</td><td className="p-2">{String(p.invoice_date || "").slice(0, 10)}</td><td className="p-2 text-right">{inr(p.total)}</td><td className="p-2">{p.status}</td></tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </section>

      {/* 2. Branch dues */}
      <section className={card}>
        <h3 className="text-sm font-bold text-slate-900 dark:text-white">Owed to branches</h3>
        <p className="text-[11px] text-slate-500 mb-3">
          Company expenses a branch paid from its own money (choose &quot;Paid by branch&quot; when recording an expense). Negative = the company owes the branch.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-3">
          <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800">
            <div className="text-[11px] text-slate-500">Total owed to branches</div>
            <div className="text-lg font-bold text-rose-700">{reimb.total_owed > 0 ? `−${inr(reimb.total_owed)}` : inr(0)}</div>
          </div>
          {reimb.branches.map((b) => (
            <div key={b.branch_id} className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800">
              <div className="text-[11px] text-slate-500">{b.branch_name} · {b.open_count} open</div>
              <div className="text-lg font-bold text-rose-700">−{inr(b.owed)}</div>
            </div>
          ))}
        </div>
        <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800">
          <table className="w-full text-xs">
            <thead className="bg-slate-50 dark:bg-slate-800/60 text-slate-600 dark:text-slate-300">
              <tr>
                <th className="text-left p-2">Branch</th><th className="text-left p-2">For</th><th className="text-left p-2">Date</th>
                <th className="text-right p-2">Amount</th><th className="text-left p-2">Status</th><th className="text-right p-2">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
              {reimb.rows.length === 0 ? (
                <tr><td colSpan={6} className="p-4 text-center text-slate-500">Nothing owed to branches.</td></tr>
              ) : (
                reimb.rows.map((r) => (
                  <tr key={r.id}>
                    <td className="p-2">{r.branch_name || r.branch_id}</td>
                    <td className="p-2">{r.description}</td>
                    <td className="p-2">{String(r.created_at).slice(0, 10)}</td>
                    <td className={`p-2 text-right font-semibold ${r.status === "OPEN" ? "text-rose-700" : ""}`}>{r.status === "OPEN" ? `−${inr(r.amount)}` : inr(r.amount)}</td>
                    <td className="p-2">{r.status === "OPEN" ? "Owed" : r.status === "PAID" ? `Paid ${r.payment_method === "CASH" ? "in cash" : "by bank"} ${String(r.paid_at || "").slice(0, 10)}` : "Reversed"}</td>
                    <td className="p-2 text-right whitespace-nowrap">
                      {r.status === "OPEN" && (
                        <>
                          <select
                            value={payFrom[r.id] || payOptions[0].value}
                            onChange={(e) => setPayFrom((p) => ({ ...p, [r.id]: e.target.value }))}
                            className="mr-2 p-1 border rounded-lg text-[11px]"
                            aria-label="Pay from"
                          >
                            {payOptions.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                          </select>
                          <button disabled={busy === r.id} onClick={() => pay(r)} className="px-2.5 py-1 rounded-lg bg-[#1D2F5D] text-white font-semibold mr-2 disabled:opacity-50">Pay</button>
                          <button disabled={busy === r.id} onClick={() => reverse(r)} className="px-2.5 py-1 rounded-lg border border-rose-300 text-rose-700 font-semibold disabled:opacity-50">Reverse</button>
                        </>
                      )}
                      {r.status === "PAID" && (
                        <button disabled={busy === r.id} onClick={() => undo(r)} className="px-2.5 py-1 rounded-lg border border-slate-300 font-semibold disabled:opacity-50">Undo payment</button>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        {banks.length === 0 && <p className="text-[11px] text-amber-700 mt-2">No active bank account yet — bank payments post to Bank Operating A/c (1112). Add your bank account under Bank Accounts.</p>}
      </section>
    </div>
  );
}
