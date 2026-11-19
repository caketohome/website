"use client";

/** Shown on an order when the receiver reported a problem at the door. Delivery stays locked until resolved. */
import { useCallback, useEffect, useState } from "react";

export function HandoffProblemPanel({ orderId, onResolved }: { orderId: string; onResolved?: () => void }) {
  const [pb, setPb] = useState<{ open: boolean; problem?: string; reported_at?: string; by_phone?: string } | null>(null);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState<"" | "replace" | "accept">("");
  const [msg, setMsg] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const r = await fetch(`/api/v1/orders/${encodeURIComponent(orderId)}/handoff-problem`, { cache: "no-store", credentials: "same-origin" });
      const j = await r.json();
      if (r.ok && j.success) setPb(j);
    } catch { /* ignore */ }
  }, [orderId]);

  useEffect(() => { if (orderId) load(); }, [orderId, load]);

  const act = async (action: "replace" | "accept") => {
    const question = action === "replace"
      ? "Send a new cake? The same rider brings the damaged cake back and delivers the new one with new codes."
      : "Mark the problem as checked and let the rider complete the delivery as it is?";
    if (!window.confirm(question)) return;
    setBusy(action);
    setMsg(null);
    try {
      const r = await fetch(`/api/v1/orders/${encodeURIComponent(orderId)}/handoff-problem`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ action, note }),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok || !j.success) throw new Error(j.error || `HTTP ${r.status}`);
      setMsg(action === "replace" ? "Replacement started. The order is back in the kitchen; the rider has been told." : "Problem marked as checked. Delivery is unlocked.");
      await load();
      onResolved?.();
    } catch (e: any) {
      setMsg(e.message);
    } finally {
      setBusy("");
    }
  };

  if (!pb?.open && !msg) return null;

  return (
    <div className="rounded-xl border border-rose-300 bg-rose-50 dark:bg-rose-950/30 p-4 flex flex-col gap-3 text-sm">
      {pb?.open && (
        <>
          <div>
            <div className="font-semibold text-rose-800 dark:text-rose-300">Receiver reported a problem — delivery is locked</div>
            <div className="text-rose-900 dark:text-rose-200 mt-1">“{pb.problem || "No details given"}”</div>
            <div className="text-xs text-rose-700/80 mt-1">
              {pb.reported_at ? new Date(pb.reported_at).toLocaleString() : ""}{pb.by_phone ? ` · from ${pb.by_phone}` : ""}
            </div>
          </div>
          <input
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Note (optional)"
            className="w-full rounded-lg border border-rose-200 bg-white dark:bg-slate-900 px-3 py-2 text-sm"
          />
          <div className="flex flex-wrap gap-2">
            <button type="button" disabled={!!busy} onClick={() => act("replace")} className="rounded-lg bg-rose-600 text-white px-3 py-2 text-xs font-semibold disabled:opacity-50">
              {busy === "replace" ? "Starting…" : "Send a new cake (same rider)"}
            </button>
            <button type="button" disabled={!!busy} onClick={() => act("accept")} className="rounded-lg border border-rose-300 px-3 py-2 text-xs font-semibold text-rose-800 dark:text-rose-200 disabled:opacity-50">
              {busy === "accept" ? "Saving…" : "Checked — deliver as is"}
            </button>
          </div>
        </>
      )}
      {msg && <div className="text-xs text-slate-700 dark:text-slate-300">{msg}</div>}
    </div>
  );
}
