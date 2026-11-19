"use client";

/** Admin / branch manager: riders on duty on a live map (refreshes every 15 s). */
import { useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";

const LiveMap = dynamic(() => import("@frontend/components/common/live-map").then((m) => m.LiveMap), { ssr: false });

interface RiderRow {
  partner_id: string;
  name: string;
  phone: string;
  latitude: number;
  longitude: number;
  accuracy_m: number | null;
  order_number: string | null;
  recorded_at: string;
}

const STALE_MS = 3 * 60_000;

function DispatchSettingsCard() {
  const [autoAssign, setAutoAssign] = useState(true);
  const [minutes, setMinutes] = useState("3");
  const [msg, setMsg] = useState<string | null>(null);
  const [canEdit, setCanEdit] = useState(true);
  useEffect(() => {
    fetch("/api/v1/admin/rider-dispatch", { cache: "no-store", credentials: "same-origin" })
      .then((r) => r.json())
      .then((j) => { if (j.success) { setAutoAssign(j.settings.auto_assign); setMinutes(String(j.settings.claim_window_minutes)); } })
      .catch(() => {});
  }, []);
  const save = async () => {
    setMsg(null);
    const r = await fetch("/api/v1/admin/rider-dispatch", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      credentials: "same-origin",
      body: JSON.stringify({ auto_assign: autoAssign, claim_window_minutes: Number(minutes) }),
    });
    const j = await r.json().catch(() => ({}));
    if (r.status === 403) setCanEdit(false);
    setMsg(r.ok && j.success ? "Saved." : j.error || "Could not save.");
  };
  return (
    <div className="rounded-xl border border-slate-200 dark:border-slate-800 p-4 flex flex-wrap items-end gap-4 text-sm">
      <div className="flex-1 min-w-[220px]">
        <div className="font-semibold text-slate-900 dark:text-white">How ready orders get a rider</div>
        <div className="text-xs text-slate-500">On-duty riders of the branch can claim a ready order. If nobody claims it in time, the nearest available rider is assigned. The branch is alerted either way.</div>
      </div>
      <label className="flex items-center gap-2 text-xs">
        <input type="checkbox" checked={autoAssign} onChange={(e) => setAutoAssign(e.target.checked)} disabled={!canEdit} />
        Auto-assign if not claimed
      </label>
      <label className="text-xs flex items-center gap-2">
        Claim window
        <input type="number" min={0} max={60} value={minutes} onChange={(e) => setMinutes(e.target.value)} disabled={!canEdit}
          className="w-16 rounded border border-slate-300 dark:border-slate-700 bg-transparent px-2 py-1" />
        min
      </label>
      {canEdit && <button type="button" onClick={save} className="rounded-lg bg-brand-navy text-white px-3 py-1.5 text-xs font-semibold">Save</button>}
      {msg && <span className="text-xs text-slate-500">{msg}</span>}
    </div>
  );
}

export function RiderLiveMapPanel() {
  const [riders, setRiders] = useState<RiderRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let stop = false;
    const load = async () => {
      try {
        const r = await fetch("/api/v1/admin/rider-locations", { cache: "no-store", credentials: "same-origin" });
        const j = await r.json();
        if (!r.ok || !j.success) throw new Error(j.error || `HTTP ${r.status}`);
        if (!stop) { setRiders(j.riders || []); setError(null); }
      } catch (e: any) {
        if (!stop) setError(e.message);
      } finally {
        if (!stop) setLoaded(true);
      }
    };
    load();
    const t = setInterval(load, 15_000);
    return () => { stop = true; clearInterval(t); };
  }, []);

  const now = Date.now();
  const points = useMemo(
    () => riders.map((r) => ({
      id: r.partner_id,
      lat: r.latitude,
      lng: r.longitude,
      label: `${r.name}${r.order_number ? ` · #${r.order_number}` : ""}`,
      kind: "rider" as const,
      stale: now - new Date(r.recorded_at).getTime() > STALE_MS,
    })),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [riders]
  );

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-bold text-slate-900 dark:text-white">Rider live map</h2>
        <p className="text-xs text-slate-500">Riders who are on duty in the rider app. Grey = no update in the last 3 minutes.</p>
      </div>
      <DispatchSettingsCard />
      {error && <div className="text-xs text-rose-600">{error}</div>}
      {loaded && riders.length === 0 && !error ? (
        <div className="rounded-xl border border-slate-200 dark:border-slate-800 p-6 text-sm text-slate-500">
          No riders are on duty right now. A rider appears here after switching to “On duty” in the rider app.
        </div>
      ) : (
        <LiveMap points={points} height={420} />
      )}
      {riders.length > 0 && (
        <div className="divide-y divide-slate-200 dark:divide-slate-800 rounded-xl border border-slate-200 dark:border-slate-800">
          {riders.map((r) => {
            const stale = now - new Date(r.recorded_at).getTime() > STALE_MS;
            return (
              <div key={r.partner_id} className="flex items-center justify-between gap-3 px-4 py-2.5 text-sm">
                <div className="min-w-0">
                  <div className="font-medium text-slate-900 dark:text-white truncate">{r.name}</div>
                  <div className="text-xs text-slate-500">{r.phone}{r.order_number ? ` · carrying #${r.order_number}` : " · no active order"}</div>
                </div>
                <div className={`text-xs whitespace-nowrap ${stale ? "text-slate-400" : "text-emerald-600"}`}>
                  {new Date(r.recorded_at).toLocaleTimeString()}{r.accuracy_m !== null ? ` · ±${r.accuracy_m} m` : ""}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
