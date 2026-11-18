"use client";

/**
 * Chart of Accounts — every ledger with its live balance. Create a ledger under any group (type and next
 * code are set automatically), rename it, or deactivate it when its balance is zero. Bank (1112-NN) and
 * partner (2112-NN) ledgers are created automatically when you add a bank account / approve a partner.
 */

import { useCallback, useEffect, useMemo, useState } from "react";

type Node = { id: string; code: string; name: string; type: string; parent_id: string | null; is_group: boolean; is_system: boolean; is_active: boolean; description: string | null; balance: number; postings: number };

const inr = (n: number) => `₹${Math.abs(n).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const NORMAL_DEBIT = new Set(["ASSET", "EXPENSE"]);

export function ChartOfAccountsPanel() {
  const [nodes, setNodes] = useState<Node[]>([]);
  const [search, setSearch] = useState("");
  const [showInactive, setShowInactive] = useState(false);
  const [creating, setCreating] = useState<{ parent_id: string; name: string; description: string; is_group: boolean } | null>(null);
  const [msg, setMsg] = useState<{ kind: "ok" | "err"; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const j = await fetch("/api/v1/admin/accounting/chart", { cache: "no-store" }).then((r) => r.json()).catch(() => null);
    if (j?.success) setNodes(j.accounts || []);
    else setMsg({ kind: "err", text: j?.message || j?.error || "Could not load the chart of accounts." });
  }, []);
  useEffect(() => {
    load();
  }, [load]);

  const post = async (url: string, body: any) => {
    setBusy(true);
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
      setBusy(false);
    }
  };

  const children = useMemo(() => {
    const m = new Map<string | null, Node[]>();
    for (const n of nodes) {
      const k = n.parent_id && nodes.some((x) => x.id === n.parent_id) ? n.parent_id : null;
      if (!m.has(k)) m.set(k, []);
      m.get(k)!.push(n);
    }
    return m;
  }, [nodes]);
  const groups = nodes.filter((n) => n.is_group && n.is_active);
  const q = search.trim().toLowerCase();
  const matches = (n: Node): boolean =>
    (!q || n.code.toLowerCase().includes(q) || n.name.toLowerCase().includes(q) || (children.get(n.id) || []).some(matches)) &&
    (showInactive || n.is_active || (children.get(n.id) || []).some((c) => c.is_active));

  const showBal = (n: Node) => {
    if (Math.abs(n.balance) < 0.005) return "—";
    const naturalDr = NORMAL_DEBIT.has(n.type);
    const isDr = n.balance > 0;
    return `${inr(n.balance)} ${isDr ? "Dr" : "Cr"}${(naturalDr && !isDr) || (!naturalDr && isDr) ? " ⚠" : ""}`;
  };

  const rename = async (n: Node) => {
    const name = window.prompt(`Rename ${n.code}`, n.name);
    if (!name || name === n.name) return;
    if (await post(`/api/v1/admin/accounting/chart/${encodeURIComponent(n.id)}`, { name })) setMsg({ kind: "ok", text: "Ledger renamed." });
  };
  const toggle = async (n: Node) => {
    if (n.is_active && !window.confirm(`Deactivate ${n.code} ${n.name}? It won't be offered for new entries.`)) return;
    if (await post(`/api/v1/admin/accounting/chart/${encodeURIComponent(n.id)}`, { is_active: !n.is_active })) setMsg({ kind: "ok", text: n.is_active ? "Ledger deactivated." : "Ledger reactivated." });
  };
  const create = async () => {
    if (!creating) return;
    const j = await post("/api/v1/admin/accounting/chart", creating);
    if (j) {
      setMsg({ kind: "ok", text: `Created ${j.account.code} ${j.account.name}.` });
      setCreating(null);
    }
  };

  const row = (n: Node, depth: number): React.ReactNode => {
    if (!matches(n)) return null;
    return (
      <div key={n.id}>
        <div className={`flex items-center gap-2 px-3 py-2 text-xs border-b border-slate-100 dark:border-slate-800 ${n.is_active ? "" : "opacity-50"}`} style={{ paddingLeft: 12 + depth * 18 }}>
          <span className="font-mono w-24 shrink-0 text-slate-500">{n.code}</span>
          <span className={`flex-1 ${n.is_group ? "font-bold text-slate-900 dark:text-white" : "text-slate-800 dark:text-slate-200"}`}>
            {n.name}
            {n.is_system && <span className="ml-2 text-[10px] px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-500">system</span>}
            {!n.is_active && <span className="ml-2 text-[10px] text-slate-500">inactive</span>}
          </span>
          <span className="w-32 text-right font-mono">{showBal(n)}</span>
          <span className="w-44 text-right whitespace-nowrap">
            {n.is_group && n.is_active && (
              <button onClick={() => setCreating({ parent_id: n.id, name: "", description: "", is_group: false })} className="text-[#1D2F5D] dark:text-brand-gold font-semibold mr-3">+ Ledger</button>
            )}
            {!n.is_system && <button onClick={() => rename(n)} className="text-slate-600 mr-3">Rename</button>}
            {!n.is_system && <button onClick={() => toggle(n)} className={n.is_active ? "text-rose-600" : "text-emerald-700"}>{n.is_active ? "Deactivate" : "Activate"}</button>}
          </span>
        </div>
        {(children.get(n.id) || []).map((c) => row(c, depth + 1))}
      </div>
    );
  };

  const input = "px-3 py-2 text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white";

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-slate-900 dark:text-white">Chart of Accounts</h2>
          <p className="text-xs text-slate-500">All ledgers with posted balances. Click <strong>+ Ledger</strong> on a group to create a ledger under it. Bank and partner ledgers are created automatically.</p>
        </div>
        <div className="flex items-center gap-2">
          <input className={input} placeholder="Search code or name" value={search} onChange={(e) => setSearch(e.target.value)} />
          <label className="text-xs flex items-center gap-1"><input type="checkbox" checked={showInactive} onChange={(e) => setShowInactive(e.target.checked)} /> Show inactive</label>
          <button onClick={() => setCreating({ parent_id: groups[0]?.id || "", name: "", description: "", is_group: false })} className="px-3 py-2 text-xs font-semibold rounded-xl bg-[#1D2F5D] text-white">+ New ledger</button>
        </div>
      </div>

      {msg && <div className={`p-3 rounded-xl text-xs border ${msg.kind === "ok" ? "bg-emerald-50 border-emerald-200 text-emerald-800" : "bg-rose-50 border-rose-200 text-rose-800"}`}>{msg.text}</div>}

      {creating && (
        <div className="p-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <label className="text-xs text-slate-600 dark:text-slate-400">Under group
              <select className={`${input} w-full`} value={creating.parent_id} onChange={(e) => setCreating({ ...creating, parent_id: e.target.value })}>
                {groups.map((g) => <option key={g.id} value={g.id}>{g.code} · {g.name} ({g.type.toLowerCase()})</option>)}
              </select>
            </label>
            <label className="text-xs text-slate-600 dark:text-slate-400">Ledger name
              <input className={`${input} w-full`} value={creating.name} onChange={(e) => setCreating({ ...creating, name: e.target.value })} placeholder="e.g. Loan from Director" />
            </label>
            <label className="text-xs text-slate-600 dark:text-slate-400">Description (optional)
              <input className={`${input} w-full`} value={creating.description} onChange={(e) => setCreating({ ...creating, description: e.target.value })} />
            </label>
          </div>
          <label className="text-xs flex items-center gap-2"><input type="checkbox" checked={creating.is_group} onChange={(e) => setCreating({ ...creating, is_group: e.target.checked })} /> This is a group (holds other ledgers, can't be posted to)</label>
          <div className="flex gap-2">
            <button onClick={create} disabled={busy || !creating.name.trim() || !creating.parent_id} className="px-4 py-2 text-xs font-semibold rounded-xl bg-[#1D2F5D] text-white disabled:opacity-50">{busy ? "Creating…" : "Create ledger"}</button>
            <button onClick={() => setCreating(null)} className="px-4 py-2 text-xs rounded-xl border border-slate-300">Cancel</button>
          </div>
          <p className="text-[11px] text-slate-500">Type (asset, liability, income, expense) and the next free code are taken from the group.</p>
        </div>
      )}

      <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden">
        <div className="flex items-center gap-2 px-3 py-2 text-[11px] font-semibold bg-slate-50 dark:bg-slate-800/60 text-slate-600 dark:text-slate-300">
          <span className="w-24">Code</span><span className="flex-1">Ledger</span><span className="w-32 text-right">Balance</span><span className="w-44 text-right">Actions</span>
        </div>
        {nodes.length === 0 ? <p className="p-4 text-xs text-slate-500">Loading…</p> : (children.get(null) || []).map((n) => row(n, 0))}
      </div>
      <p className="text-[11px] text-slate-500">⚠ marks a balance on the unusual side (e.g. a bank ledger in credit) — worth checking.</p>
    </div>
  );
}
