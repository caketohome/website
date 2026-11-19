"use client";

/**
 * On-duty switch + live location sharing for the rider PWA.
 * While on duty the phone's GPS is sent every ~15 s (or after ~50 m of movement).
 * Browsers only share location while the app is open, so the screen is kept awake.
 */
import { useCallback, useEffect, useRef, useState } from "react";

const DUTY_KEY = "cth_rider_on_duty";
const MIN_INTERVAL_MS = 15_000;
const MIN_MOVE_M = 50;

function metersBetween(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const R = 6371000, toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat), dLng = toRad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

export function RiderDutyTracker() {
  const [onDuty, setOnDuty] = useState(false);
  const [status, setStatus] = useState<string>("Off duty");
  const [error, setError] = useState<string | null>(null);
  const [lastSent, setLastSent] = useState<Date | null>(null);
  const [accuracy, setAccuracy] = useState<number | null>(null);
  const watchRef = useRef<number | null>(null);
  const lastRef = useRef<{ lat: number; lng: number; at: number } | null>(null);
  const wakeRef = useRef<any>(null);

  const send = useCallback(async (pos: GeolocationPosition) => {
    const p = { lat: pos.coords.latitude, lng: pos.coords.longitude };
    setAccuracy(Math.round(pos.coords.accuracy));
    const last = lastRef.current;
    if (last && Date.now() - last.at < MIN_INTERVAL_MS && metersBetween(last, p) < MIN_MOVE_M) return;
    lastRef.current = { ...p, at: Date.now() };
    try {
      const r = await fetch("/api/v1/rider/location", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ latitude: p.lat, longitude: p.lng, accuracy: pos.coords.accuracy, heading: pos.coords.heading, speed: pos.coords.speed }),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j.error || `HTTP ${r.status}`);
      setLastSent(new Date());
      setError(null);
      setStatus("Sharing live location");
    } catch (e: any) {
      setError(`Could not send location: ${e.message}`);
    }
  }, []);

  const keepAwake = async () => {
    try { wakeRef.current = await (navigator as any).wakeLock?.request("screen"); } catch { /* not supported */ }
  };

  const setAvailability = (status: "ONLINE" | "OFFLINE") =>
    fetch("/api/v1/delivery-partner/availability", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "same-origin",
      body: JSON.stringify({ status }),
    }).catch(() => {});

  const start = useCallback(() => {
    setAvailability("ONLINE"); // must be ONLINE to claim jobs and verify OTPs
    if (!("geolocation" in navigator)) { setError("This phone/browser cannot share location."); return; }
    setStatus("Getting your location…");
    watchRef.current = navigator.geolocation.watchPosition(send, (err) => {
      setError(err.code === err.PERMISSION_DENIED
        ? "Location permission is blocked. Allow location for this site in your phone settings."
        : `Location unavailable (${err.message}).`);
    }, { enableHighAccuracy: true, maximumAge: 10_000, timeout: 30_000 });
    keepAwake();
  }, [send]);

  const stop = useCallback(async () => {
    if (watchRef.current !== null) navigator.geolocation.clearWatch(watchRef.current);
    watchRef.current = null;
    lastRef.current = null;
    try { await wakeRef.current?.release?.(); } catch { /* ignore */ }
    wakeRef.current = null;
    await fetch("/api/v1/rider/location", { method: "DELETE", credentials: "same-origin" }).catch(() => {});
    await setAvailability("OFFLINE");
    setStatus("Off duty");
  }, []);

  useEffect(() => {
    let saved = false;
    try { saved = localStorage.getItem(DUTY_KEY) === "1"; } catch { /* ignore */ }
    if (saved) { setOnDuty(true); start(); }
    const onVisible = () => { if (document.visibilityState === "visible" && watchRef.current !== null) keepAwake(); };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      document.removeEventListener("visibilitychange", onVisible);
      if (watchRef.current !== null) navigator.geolocation.clearWatch(watchRef.current);
    };
  }, [start]);

  const toggle = async () => {
    const next = !onDuty;
    setOnDuty(next);
    try { localStorage.setItem(DUTY_KEY, next ? "1" : "0"); } catch { /* ignore */ }
    if (next) start(); else await stop();
  };

  return (
    <div className="rounded-2xl border border-ui-border-base bg-ui-bg-base p-4 flex flex-col gap-3">
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="text-sm font-semibold text-ui-fg-base">{onDuty ? "On duty" : "Off duty"}</div>
          <div className="text-xs text-ui-fg-subtle">{status}</div>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={onDuty}
          onClick={toggle}
          className={`relative inline-flex h-8 w-14 shrink-0 items-center rounded-full transition ${onDuty ? "bg-emerald-600" : "bg-slate-300 dark:bg-slate-700"}`}
        >
          <span className={`inline-block h-6 w-6 rounded-full bg-white shadow transition ${onDuty ? "translate-x-7" : "translate-x-1"}`} />
          <span className="sr-only">Toggle on duty</span>
        </button>
      </div>
      {onDuty && (
        <div className="text-xs text-ui-fg-subtle">
          {lastSent ? `Last sent ${lastSent.toLocaleTimeString()}` : "Waiting for first GPS fix…"}
          {accuracy !== null && ` · accuracy ±${accuracy} m`}
          <div className="mt-1">Keep this app open while delivering. Your location is shared only while you are on duty.</div>
        </div>
      )}
      {error && <div className="text-xs text-rose-600">{error}</div>}
    </div>
  );
}
