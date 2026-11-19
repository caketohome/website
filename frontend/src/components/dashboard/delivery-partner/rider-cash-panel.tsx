"use client";

/** Rider: cash collected on cash-on-delivery orders, and handing it over to the branch. */
import { useCallback, useEffect, useState } from "react";

interface CashOrder { order_id: string; order_number: string; branch_id: string; amount: number; collected_at: string }
interface Handover { id: string; status: string; declared_amount?: number; expected_amount?: number; created_at?: string; submitted_at?: string }
interface CashState {
  cash_in_hand: number;
  orders: CashOrder[];
  handoverable: Record<string, { amount: number; orders: number }>;
  handovers: Handover[];
}

const rupees = (n: number) => `₹${Number(n || 0).toFixed(2)}`;

export function RiderCashPanel() {
  const [data, setData] = useState<CashState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [handoverBranch, setHandoverBranch] = useState<string | null>(null);
  const [declared, setDeclared] = useState("");
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const r = await fetch("/api/v1/rider/cod", { cache: "no-store", credentials: "same-origin" });
      const j = await r.json();
      if (!r.ok || !j.success) throw new Error(j.error || `HTTP ${r.status}`);
      setData(j);
      setError(null);
    } catch (e: any) {
      setError(e.message);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const submit = async () => {
    if (!handoverBranch) return;
    setBusy(true);
    setError(null);
    try {
      const r = await fetch("/api/v1/rider/cod/handover", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ branch_id: handoverBranch, declared_amount: Number(declared), discrepancy_reason: reason || undefined }),
      });
      const j = await r.json();
      if (!r.ok || !j.success) throw new Error(j.error || `HTTP ${r.status}`);
      setDone(`Handover of ${rupees(Number(declared))} sent. The branch will count and confirm it.`);
      setHandoverBranch(null);
      setDeclared("");
      setReason("");
      await load();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  if (!data && !error) return null;
  const branches = Object.entries(data?.handoverable || {});
  const pending = (data?.handovers || []).filter((h) => ["SUBMITTED", "DRAFT"].includes(String(h.status).toUpperCase()));

  return (
    <div className="rounded-2xl border border-ui-border-base bg-ui-bg-base p-4 flex flex-col gap-3">
      <div className="flex items-baseline justify-between gap-3">
        <div>
          <div className="text-sm font-semibold text-ui-fg-base">Cash on delivery</div>
          <div className="text-xs text-ui-fg-subtle">Cash you collected that is not yet settled with the branch</div>
        </div>
        <div className="text-xl font-bold text-ui-fg-base">{rupees(data?.cash_in_hand || 0)}</div>
      </div>

      {error && <div className="text-xs text-rose-600">{error}</div>}
      {done && <div className="text-xs text-emerald-700">{done}</div>}

      {data && data.orders.length > 0 && (
        <div className="divide-y divide-ui-border-base rounded-lg border border-ui-border-base text-xs">
          {data.orders.map((o) => (
            <div key={o.order_id} className="flex justify-between px-3 py-2">
              <span>#{o.order_number}</span>
              <span className="font-medium">{rupees(o.amount)}</span>
            </div>
          ))}
        </div>
      )}

      {pending.length > 0 && (
        <div className="text-xs text-amber-700 dark:text-amber-400">
          {pending.length} handover{pending.length > 1 ? "s" : ""} waiting for the branch to count and confirm.
        </div>
      )}

      {branches.map(([branchId, b]) =>
        handoverBranch === branchId ? (
          <div key={branchId} className="flex flex-col gap-2 rounded-lg border border-ui-border-base p-3">
            <div className="text-xs text-ui-fg-subtle">Expected {rupees(b.amount)} for {b.orders} order{b.orders > 1 ? "s" : ""}. Count the cash and enter the amount.</div>
            <input
              inputMode="decimal"
              value={declared}
              onChange={(e) => setDeclared(e.target.value)}
              placeholder="Cash amount"
              className="w-full rounded-lg border border-ui-border-base bg-ui-bg-field px-3 py-2 text-sm"
            />
            {declared !== "" && Math.round(Number(declared) * 100) !== Math.round(b.amount * 100) && (
              <input
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Reason for the difference"
                className="w-full rounded-lg border border-ui-border-base bg-ui-bg-field px-3 py-2 text-sm"
              />
            )}
            <div className="flex gap-2 justify-end">
              <button type="button" onClick={() => setHandoverBranch(null)} className="px-3 py-2 text-xs text-ui-fg-subtle">Cancel</button>
              <button type="button" disabled={busy || declared === ""} onClick={submit} className="px-3 py-2 rounded-lg bg-brand-navy text-white text-xs font-semibold disabled:opacity-50">
                {busy ? "Sending…" : "Hand over cash"}
              </button>
            </div>
          </div>
        ) : (
          <button
            key={branchId}
            type="button"
            onClick={() => { setHandoverBranch(branchId); setDeclared(String(b.amount)); setDone(null); }}
            className="w-full rounded-lg bg-brand-navy text-white py-2.5 text-sm font-semibold"
          >
            Hand over {rupees(b.amount)} to branch
          </button>
        )
      )}

      {data && data.orders.length === 0 && pending.length === 0 && (
        <div className="text-xs text-ui-fg-subtle">No cash to hand over.</div>
      )}
    </div>
  );
}
