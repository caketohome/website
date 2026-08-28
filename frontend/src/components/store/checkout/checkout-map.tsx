"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { MapPin, Loader2 } from "lucide-react";

// ── Types ──────────────────────────────────────────────────────────────────
export interface CheckoutMapProps {
  /** Initial latitude (customer's location) */
  latitude?: number;
  /** Initial longitude (customer's location) */
  longitude?: number;
  /** Store/branch latitude (shown when serviceable) */
  storeLat?: number;
  /** Store/branch longitude (shown when serviceable) */
  storeLng?: number;
  /** Store name for popup */
  storeName?: string;
  /** Whether the current location is serviceable */
  serviceable?: boolean;
  /** Map height in pixels */
  height?: number;
  /** Callback when customer drags the marker to a new location */
  onLocationChange?: (lat: number, lng: number) => void;
  /** Show loading state */
  loading?: boolean;
  /** Disable interaction */
  disabled?: boolean;
}

// ── Component ──────────────────────────────────────────────────────────────
/**
 * Lightweight Leaflet map for checkout.
 * - Draggable customer marker
 * - Store marker when serviceable
 * - Visual serviceable/not-serviceable state
 * - Does NOT expose zone boundaries to customer
 */
export function CheckoutMap({
  latitude,
  longitude,
  storeLat,
  storeLng,
  storeName,
  serviceable,
  height = 280,
  onLocationChange,
  loading = false,
  disabled = false,
}: CheckoutMapProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>(null);
  const customerMarkerRef = useRef<any>(null);
  const storeMarkerRef = useRef<any>(null);
  const routeLineRef = useRef<any>(null);
  const [L, setL] = useState<any>(null);
  const [mapReady, setMapReady] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Dynamic Leaflet Import (SSR-safe) ──────────────────────────────────
  useEffect(() => {
    if (typeof window === "undefined") return;
    let cancelled = false;

    async function loadLeaflet() {
      try {
        // Check if Leaflet CSS is already injected
        if (!document.getElementById("leaflet-checkout-css")) {
          const link = document.createElement("link");
          link.id = "leaflet-checkout-css";
          link.rel = "stylesheet";
          link.href = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
          link.crossOrigin = "";
          document.head.appendChild(link);
        }
        const leaflet = await import("leaflet");
        if (!cancelled) setL(leaflet.default || leaflet);
      } catch (e) {
        console.error("[CheckoutMap] Failed to load Leaflet:", e);
      }
    }

    loadLeaflet();
    return () => { cancelled = true; };
  }, []);

  // ── Initialize Map ─────────────────────────────────────────────────────
  useEffect(() => {
    if (!L || !mapContainerRef.current || mapRef.current) return;

    const defaultLat = latitude || 12.9716;
    const defaultLng = longitude || 77.5946;

    const map = L.map(mapContainerRef.current, {
      center: [defaultLat, defaultLng],
      zoom: 15,
      zoomControl: true,
      attributionControl: false,
      scrollWheelZoom: true,
    });

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19,
    }).addTo(map);

    mapRef.current = map;
    setMapReady(true);

    return () => {
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
        setMapReady(false);
      }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [L]);

  // ── Create Customer Pin Icon ───────────────────────────────────────────
  const createCustomerIcon = useCallback((isServiceable?: boolean) => {
    if (!L) return undefined;
    const color = isServiceable === true ? "#10b981" : isServiceable === false ? "#ef4444" : "#6366f1";
    return L.divIcon({
      className: "checkout-customer-marker",
      html: `<div style="
        width:32px;height:32px;border-radius:50%;background:${color};
        border:3px solid white;box-shadow:0 2px 8px rgba(0,0,0,0.3);
        display:flex;align-items:center;justify-content:center;
        transition:background 0.3s ease;
      "><svg viewBox="0 0 24 24" width="16" height="16" fill="white"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5a2.5 2.5 0 010-5 2.5 2.5 0 010 5z"/></svg></div>`,
      iconSize: [32, 32],
      iconAnchor: [16, 32],
    });
  }, [L]);

  // ── Create Store Icon ──────────────────────────────────────────────────
  const createStoreIcon = useCallback(() => {
    if (!L) return undefined;
    return L.divIcon({
      className: "checkout-store-marker",
      html: `<div style="
        width:28px;height:28px;border-radius:50%;background:#f97316;
        border:2px solid white;box-shadow:0 2px 6px rgba(0,0,0,0.25);
        display:flex;align-items:center;justify-content:center;
      "><svg viewBox="0 0 24 24" width="14" height="14" fill="white"><path d="M20 4H4v2h16V4zm1 10v-2l-1-5H4l-1 5v2h1v6h10v-6h4v6h2v-6h1zm-9 4H6v-4h6v4z"/></svg></div>`,
      iconSize: [28, 28],
      iconAnchor: [14, 28],
    });
  }, [L]);

  // ── Update Customer Marker ─────────────────────────────────────────────
  useEffect(() => {
    if (!L || !mapReady || !mapRef.current) return;
    if (typeof latitude !== "number" || typeof longitude !== "number") {
      if (customerMarkerRef.current) {
        customerMarkerRef.current.remove();
        customerMarkerRef.current = null;
      }
      return;
    }

    const icon = createCustomerIcon(serviceable);

    if (customerMarkerRef.current) {
      customerMarkerRef.current.setLatLng([latitude, longitude]);
      customerMarkerRef.current.setIcon(icon);
    } else {
      const marker = L.marker([latitude, longitude], {
        icon,
        draggable: !disabled,
        autoPan: true,
        title: "Your delivery location",
      }).addTo(mapRef.current);

      marker.bindPopup(
        `<div style="font-size:13px;font-weight:500;">📍 Your delivery location</div>
         <div style="font-size:11px;color:#6b7280;margin-top:2px;">Drag to adjust</div>`,
        { closeButton: false, offset: [0, -20] }
      );

      marker.on("dragend", () => {
        const pos = marker.getLatLng();
        if (onLocationChange) {
          // Debounce to avoid rapid re-resolution
          if (debounceRef.current) clearTimeout(debounceRef.current);
          debounceRef.current = setTimeout(() => {
            onLocationChange(
              Number(pos.lat.toFixed(6)),
              Number(pos.lng.toFixed(6))
            );
          }, 250);
        }
      });

      customerMarkerRef.current = marker;
    }

    // Pan map to customer location
    mapRef.current.setView([latitude, longitude], mapRef.current.getZoom(), { animate: true });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [L, mapReady, latitude, longitude, serviceable, disabled]);

  // ── Update Store Marker ────────────────────────────────────────────────
  useEffect(() => {
    if (!L || !mapReady || !mapRef.current) return;

    // Remove existing store marker
    if (storeMarkerRef.current) {
      storeMarkerRef.current.remove();
      storeMarkerRef.current = null;
    }
    // Remove existing route line
    if (routeLineRef.current) {
      routeLineRef.current.remove();
      routeLineRef.current = null;
    }

    if (serviceable && typeof storeLat === "number" && typeof storeLng === "number") {
      const icon = createStoreIcon();
      const marker = L.marker([storeLat, storeLng], {
        icon,
        interactive: true,
        title: storeName || "Store",
      }).addTo(mapRef.current);

      marker.bindPopup(
        `<div style="font-size:13px;font-weight:500;">🏪 ${storeName || "CakeToHome Kitchen"}</div>`,
        { closeButton: false, offset: [0, -20] }
      );

      storeMarkerRef.current = marker;

      // Draw a dashed line from store to customer
      if (typeof latitude === "number" && typeof longitude === "number") {
        const line = L.polyline(
          [[storeLat, storeLng], [latitude, longitude]],
          { color: "#10b981", weight: 2, dashArray: "6, 8", opacity: 0.6 }
        ).addTo(mapRef.current);
        routeLineRef.current = line;

        // Fit bounds to show both markers
        const bounds = L.latLngBounds([
          [storeLat, storeLng],
          [latitude, longitude],
        ]);
        mapRef.current.fitBounds(bounds, { padding: [40, 40], maxZoom: 15 });
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [L, mapReady, storeLat, storeLng, storeName, serviceable, latitude, longitude]);

  // ── Render ─────────────────────────────────────────────────────────────
  return (
    <div className="relative w-full rounded-xl overflow-hidden border border-slate-200 dark:border-slate-700" style={{ height }}>
      <div ref={mapContainerRef} className="w-full h-full" style={{ zIndex: 1 }} />

      {/* Loading overlay */}
      {loading && (
        <div className="absolute inset-0 bg-white/60 dark:bg-slate-900/60 flex items-center justify-center z-[500]">
          <div className="flex items-center gap-2 bg-white dark:bg-slate-800 rounded-lg px-4 py-2 shadow-lg">
            <Loader2 className="w-4 h-4 animate-spin text-indigo-500" />
            <span className="text-sm text-slate-600 dark:text-slate-300">Checking delivery...</span>
          </div>
        </div>
      )}

      {/* No location set */}
      {(!latitude || !longitude) && !loading && (
        <div className="absolute inset-0 bg-slate-50/90 dark:bg-zinc-900/90 backdrop-blur-[2px] flex flex-col items-center justify-center z-[400] p-4 text-center">
          <div className="w-11 h-11 rounded-2xl bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-900/50 flex items-center justify-center text-rose-600 mb-2 shadow-sm">
            <MapPin className="w-5 h-5" />
          </div>
          <p className="text-sm font-bold text-zinc-900 dark:text-zinc-100">Select Your Delivery Location</p>
          <p className="text-xs text-zinc-500 max-w-xs mt-1">Use Current Location (GPS), search your area, or select a saved address to view your delivery map.</p>
        </div>
      )}

      {/* Serviceable badge */}
      {serviceable === true && !loading && latitude && (
        <div className="absolute top-3 right-3 z-[500] bg-emerald-500/90 text-white text-xs font-medium px-3 py-1.5 rounded-full shadow-md backdrop-blur-sm">
          ✓ We deliver here
        </div>
      )}
      {serviceable === false && !loading && latitude && (
        <div className="absolute top-3 right-3 z-[500] bg-red-500/90 text-white text-xs font-medium px-3 py-1.5 rounded-full shadow-md backdrop-blur-sm">
          ✕ Outside delivery zone
        </div>
      )}
    </div>
  );
}
