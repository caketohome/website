"use client";

/**
 * Small Leaflet map that shows a set of live points (riders, customer, kitchen)
 * and keeps them in view. Leaflet + its CSS load only in the browser.
 */
import { useEffect, useRef, useState } from "react";

export interface LiveMapPoint {
  id: string;
  lat: number;
  lng: number;
  label: string;
  kind: "rider" | "customer" | "kitchen";
  stale?: boolean;
}

const COLORS: Record<LiveMapPoint["kind"], string> = { rider: "#1D2F5D", customer: "#059669", kitchen: "#B45309" };

export function LiveMap({ points, height = 320 }: { points: LiveMapPoint[]; height?: number }) {
  const boxRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<any>(null);
  const layerRef = useRef<any>(null);
  const fittedRef = useRef(false);
  const [L, setL] = useState<any>(null);

  useEffect(() => {
    let cancelled = false;
    if (!document.getElementById("leaflet-live-css")) {
      const link = document.createElement("link");
      link.id = "leaflet-live-css";
      link.rel = "stylesheet";
      link.href = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
      document.head.appendChild(link);
    }
    import("leaflet").then((m) => { if (!cancelled) setL((m as any).default || m); }).catch(() => {});
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (!L || !boxRef.current || mapRef.current) return;
    const first = points[0];
    const map = L.map(boxRef.current, { zoom: 14, center: first ? [first.lat, first.lng] : [10.85, 76.27], attributionControl: false });
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", { maxZoom: 19 }).addTo(map);
    layerRef.current = L.layerGroup().addTo(map);
    mapRef.current = map;
    return () => { map.remove(); mapRef.current = null; layerRef.current = null; fittedRef.current = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [L]);

  useEffect(() => {
    if (!L || !mapRef.current || !layerRef.current) return;
    layerRef.current.clearLayers();
    for (const p of points) {
      const color = p.stale ? "#94A3B8" : COLORS[p.kind];
      const icon = L.divIcon({
        className: "",
        html: `<div style="width:18px;height:18px;border-radius:50%;background:${color};border:3px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,.35)"></div>`,
        iconSize: [18, 18],
        iconAnchor: [9, 9],
      });
      L.marker([p.lat, p.lng], { icon }).bindTooltip(p.label, { direction: "top", offset: [0, -8] }).addTo(layerRef.current);
    }
    if (points.length && !fittedRef.current) {
      if (points.length === 1) mapRef.current.setView([points[0].lat, points[0].lng], 15);
      else mapRef.current.fitBounds(L.latLngBounds(points.map((p) => [p.lat, p.lng])), { padding: [30, 30], maxZoom: 16 });
      fittedRef.current = true;
    }
  }, [L, points]);

  return <div ref={boxRef} style={{ height }} className="w-full rounded-xl overflow-hidden border border-slate-200 dark:border-slate-800 z-0" />;
}
