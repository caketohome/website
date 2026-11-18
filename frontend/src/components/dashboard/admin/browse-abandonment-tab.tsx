"use client";

/**
 * Viewed but didn't buy — visitors who browsed, looked at cakes or added to cart and have not ordered
 * since. Logged-in visitors show a phone so the team can follow up.
 * Data: GET /api/v1/admin/abandoned-carts/browse?days=7
 */

import { useEffect, useState } from "react";

type Row = {
  visitor_id: string;
  customer_id: string | null;
  phone: string | null;
  stage: "visited" | "viewed_cake" | "added_to_cart";
  page_views: number;
  product_views: number;
  add_to_carts: number;
  products_viewed: string;
  last_seen: string;
};

const STAGE_LABEL: Record<Row["stage"], string> = {
  visited: "Visited only",
  viewed_cake: "Viewed cakes",
  added_to_cart: "Added to cart",
};

export function BrowseAbandonmentTab() {
  const [days, setDays] = useState(7);
  const [onlyKnown, setOnlyKnown] = useState(false);
  const [data, setData] = useState<{ rows: Row[]; summary: any } | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setError(null);
    fetch(`/api/v1/admin/abandoned-carts/browse?days=${days}`, { cache: "no-store" })
      .then((r) => r.json())
      .then((j) => {
        if (!j?.success) throw new Error(j?.error || "Could not load visitors.");
        setData({ rows: j.rows || [], summary: j.summary || {} });
      })
      .catch((e) => setError(e.message));
  }, [days]);

  const rows = (data?.rows || []).filter((r) => !onlyKnown || r.customer_id);
  const card = "p-3 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900";

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-neutral-500">Visitors who browsed or looked at cakes and haven&apos;t ordered since. Logged-in visitors can be contacted.</p>
        <div className="flex items-center gap-2 text-xs">
          <select value={days} onChange={(e) => setDays(Number(e.target.value))} className="p-1.5 border rounded-lg bg-white dark:bg-neutral-800">
            <option value={1}>Last 24 hours</option>
            <option value={7}>Last 7 days</option>
            <option value={30}>Last 30 days</option>
          </select>
          <label className="flex items-center gap-1">
            <input type="checkbox" checked={onlyKnown} onChange={(e) => setOnlyKnown(e.target.checked)} /> Logged-in only
          </label>
        </div>
      </div>

      {data && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          <div className={card}><div className="text-[11px] text-neutral-500">Visitors who didn&apos;t buy</div><div className="text-lg font-bold">{data.summary.visitors ?? 0}</div></div>
          <div className={card}><div className="text-[11px] text-neutral-500">Logged in (contactable)</div><div className="text-lg font-bold">{data.summary.known ?? 0}</div></div>
          <div className={card}><div className="text-[11px] text-neutral-500">Viewed a cake</div><div className="text-lg font-bold">{data.summary.viewed_cake ?? 0}</div></div>
          <div className={card}><div className="text-[11px] text-neutral-500">Added to cart</div><div className="text-lg font-bold">{data.summary.added_to_cart ?? 0}</div></div>
        </div>
      )}

      {error && <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs">{error}</div>}

      <div className="overflow-x-auto rounded-xl border border-neutral-200 dark:border-neutral-800">
        <table className="w-full text-xs">
          <thead className="bg-neutral-50 dark:bg-neutral-800/60 text-neutral-600 dark:text-neutral-300">
            <tr>
              <th className="text-left p-2.5">Visitor</th>
              <th className="text-left p-2.5">Stage</th>
              <th className="text-left p-2.5">Cakes viewed</th>
              <th className="text-right p-2.5">Pages</th>
              <th className="text-right p-2.5">Cake views</th>
              <th className="text-left p-2.5">Last seen</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-200 dark:divide-neutral-800">
            {!data ? (
              <tr><td colSpan={6} className="p-4 text-center text-neutral-500">Loading…</td></tr>
            ) : rows.length === 0 ? (
              <tr><td colSpan={6} className="p-4 text-center text-neutral-500">No visitors in this period yet. Visits are recorded from now on.</td></tr>
            ) : (
              rows.map((r) => (
                <tr key={r.visitor_id}>
                  <td className="p-2.5">
                    {r.phone ? (
                      <a href={`tel:${r.phone}`} className="font-mono font-semibold text-brand-navy dark:text-brand-gold">{r.phone}</a>
                    ) : (
                      <span className="text-neutral-500">Guest · {r.visitor_id.slice(2, 10)}</span>
                    )}
                  </td>
                  <td className="p-2.5">{STAGE_LABEL[r.stage]}</td>
                  <td className="p-2.5 max-w-xs truncate" title={r.products_viewed}>{r.products_viewed || "—"}</td>
                  <td className="p-2.5 text-right">{r.page_views}</td>
                  <td className="p-2.5 text-right">{r.product_views}</td>
                  <td className="p-2.5">{new Date(r.last_seen).toLocaleString("en-IN", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
