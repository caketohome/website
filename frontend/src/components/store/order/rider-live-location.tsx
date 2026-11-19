"use client";

/** Customer view: where the rider is, while the order is out for delivery. Polls every 20 s. */
import { useEffect, useState } from "react";
import dynamic from "next/dynamic";

const LiveMap = dynamic(() => import("@frontend/components/common/live-map").then((m) => m.LiveMap), { ssr: false });

interface RiderPos {
  tracking: boolean;
  rider_name?: string;
  latitude?: number | null;
  longitude?: number | null;
  updated_at?: string | null;
  destination?: { latitude: number; longitude: number } | null;
}

function km(a: { latitude: number; longitude: number }, b: { latitude: number; longitude: number }) {
  const R = 6371, toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.latitude - a.latitude), dLng = toRad(b.longitude - a.longitude);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.latitude)) * Math.cos(toRad(b.latitude)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

export function RiderLiveLocation({ orderId }: { orderId: string }) {
  const [pos, setPos] = useState<RiderPos | null>(null);

  useEffect(() => {
    let stop = false;
    const load = async () => {
      try {
        const r = await fetch(`/api/v1/track/${encodeURIComponent(orderId)}/rider`, { credentials: "same-origin", cache: "no-store" });
        if (!r.ok) { if (!stop) setPos(null); return; }
        const j = await r.json();
        if (!stop) setPos(j);
      } catch { /* keep last */ }
    };
    load();
    const t = setInterval(load, 20_000);
    return () => { stop = true; clearInterval(t); };
  }, [orderId]);

  if (!pos?.tracking || pos.latitude == null || pos.longitude == null) return null;
  const rider = { latitude: pos.latitude, longitude: pos.longitude };
  const points = [
    { id: "rider", lat: rider.latitude, lng: rider.longitude, label: pos.rider_name ? `${pos.rider_name} (rider)` : "Rider", kind: "rider" as const },
    ...(pos.destination ? [{ id: "dest", lat: pos.destination.latitude, lng: pos.destination.longitude, label: "Delivery address", kind: "customer" as const }] : []),
  ];
  const distance = pos.destination ? km(rider, pos.destination) : null;

  return (
    <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 space-y-3">
      <div className="flex items-baseline justify-between gap-3">
        <h3 className="text-sm font-semibold text-slate-900 dark:text-white">Your rider is on the way</h3>
        {pos.updated_at && <span className="text-[11px] text-slate-500">Updated {new Date(pos.updated_at).toLocaleTimeString()}</span>}
      </div>
      {distance !== null && <p className="text-xs text-slate-600 dark:text-slate-400">About {distance < 1 ? `${Math.round(distance * 1000)} m` : `${distance.toFixed(1)} km`} away</p>}
      <LiveMap points={points} height={260} />
    </div>
  );
}
