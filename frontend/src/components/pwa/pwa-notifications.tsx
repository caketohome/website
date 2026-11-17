"use client";

import { useEffect, useRef, useState } from "react";
import { useAuth } from "@/providers/auth-provider";

const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || "";
const DISMISS_KEY = "cth_pwa_prompt_dismissed";

function urlBase64ToUint8Array(base64: string) {
  const padded = (base64 + "=".repeat((4 - (base64.length % 4)) % 4)).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(padded);
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
}

const pushSupported = () =>
  typeof window !== "undefined" && "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;

const isStandalone = () =>
  typeof window !== "undefined" &&
  (window.matchMedia("(display-mode: standalone)").matches || (navigator as any).standalone === true);

const isIos = () => typeof navigator !== "undefined" && /iphone|ipad|ipod/i.test(navigator.userAgent);

async function subscribeThisDevice(): Promise<boolean> {
  const reg = await navigator.serviceWorker.ready;
  const sub =
    (await reg.pushManager.getSubscription()) ||
    (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY) }));
  const res = await fetch("/api/push/subscribe", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify(sub.toJSON()),
  });
  return res.ok;
}

/**
 * Registers the service worker, offers "install app" and order-alert notifications for
 * logged-in customers, branch managers and delivery partners, and plays the alert sound
 * when a push arrives while the app is open.
 */
export function PwaNotifications() {
  const { isAuthenticated } = useAuth();
  const [permission, setPermission] = useState<NotificationPermission | "unsupported">("unsupported");
  const [installEvent, setInstallEvent] = useState<any>(null);
  const [dismissed, setDismissed] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const wasAuthed = useRef(false);

  // Service worker + install prompt + in-app sound on push.
  useEffect(() => {
    try {
      setDismissed(sessionStorage.getItem(DISMISS_KEY) === "1");
    } catch {
      setDismissed(false);
    }
    if (!("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/sw.js").catch((err) => {
      console.warn("[PWA] service worker registration failed:", err?.message);
      setError("This browser couldn't set up alerts for this site.");
    });
    setPermission(pushSupported() ? Notification.permission : "unsupported");

    audioRef.current = new Audio("/notification.mp3");
    audioRef.current.preload = "auto";
    // Browsers block sound until the user interacts with the page; unlock on the first tap/key.
    const unlock = () => {
      const a = audioRef.current;
      if (!a) return;
      a.muted = true;
      a.play()
        .then(() => {
          a.pause();
          a.currentTime = 0;
        })
        .catch(() => null)
        .finally(() => {
          a.muted = false;
        });
    };
    window.addEventListener("pointerdown", unlock, { once: true });
    window.addEventListener("keydown", unlock, { once: true });

    const onMessage = (e: MessageEvent) => {
      if (e.data?.type !== "cth-push" || !audioRef.current) return;
      audioRef.current.currentTime = 0;
      audioRef.current.play().catch(() => null);
    };
    navigator.serviceWorker.addEventListener("message", onMessage);

    const onInstall = (e: Event) => {
      e.preventDefault();
      setInstallEvent(e);
    };
    window.addEventListener("beforeinstallprompt", onInstall);
    return () => {
      window.removeEventListener("pointerdown", unlock);
      window.removeEventListener("keydown", unlock);
      navigator.serviceWorker.removeEventListener("message", onMessage);
      window.removeEventListener("beforeinstallprompt", onInstall);
    };
  }, []);

  // Keep this device linked to whoever is logged in; unlink on logout (shared phones).
  useEffect(() => {
    if (!pushSupported() || !VAPID_PUBLIC_KEY) return;
    if (isAuthenticated) {
      wasAuthed.current = true;
      if (Notification.permission === "granted")
        subscribeThisDevice()
          .then((ok) => !ok && setError("Couldn't turn on alerts. Try again."))
          .catch((err) => {
            console.warn("[PWA] push subscribe failed:", err?.message);
            setError("Couldn't turn on alerts on this browser.");
          });
    } else if (wasAuthed.current) {
      wasAuthed.current = false;
      navigator.serviceWorker.ready
        .then((reg) => reg.pushManager.getSubscription())
        .then((sub) => sub?.unsubscribe())
        .catch(() => null);
    }
  }, [isAuthenticated]);

  const enableAlerts = async () => {
    setBusy(true);
    setError(null);
    try {
      // Unlock audio during this tap so later alerts can play sound.
      audioRef.current?.play().then(() => audioRef.current?.pause()).catch(() => null);
      const result = await Notification.requestPermission();
      setPermission(result);
      if (result === "granted" && !(await subscribeThisDevice())) setError("Couldn't turn on alerts. Try again.");
      if (result === "denied") setError("Alerts are blocked. Allow notifications for this site in your browser settings.");
    } catch {
      setError("Couldn't turn on alerts on this browser.");
    } finally {
      setBusy(false);
    }
  };

  const install = async () => {
    if (!installEvent) return;
    installEvent.prompt();
    await installEvent.userChoice.catch(() => null);
    setInstallEvent(null);
  };

  const dismiss = () => {
    setDismissed(true);
    try {
      sessionStorage.setItem(DISMISS_KEY, "1");
    } catch {}
  };

  if (!isAuthenticated || dismissed) return null;

  const iosNeedsInstall = isIos() && !isStandalone();
  const canEnableAlerts = permission === "default" && Boolean(VAPID_PUBLIC_KEY);
  const blocked = permission === "denied";
  const showInstall = Boolean(installEvent) || iosNeedsInstall;
  if (!canEnableAlerts && !blocked && !showInstall && !error) return null;

  return (
    <div className="fixed inset-x-4 bottom-4 z-[60] mx-auto max-w-md rounded-2xl border border-slate-200 bg-white p-4 shadow-xl">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-slate-900">Get order alerts</p>
          <p className="mt-1 text-xs text-slate-600">
            {iosNeedsInstall
              ? "On iPhone, tap the Share button, then “Add to Home Screen”. Open CakeToHome from the home screen to turn on alerts."
              : "Hear a sound and get a notification when an order needs you, even when the app is closed."}
          </p>
          {blocked && !error && (
            <p className="mt-2 text-xs text-red-600">
              Notifications are blocked for this site. Click the icon left of the address bar → Site settings →
              Notifications → Allow, then reload.
            </p>
          )}
          {error && <p className="mt-2 text-xs text-red-600">{error}</p>}
        </div>
        <button onClick={dismiss} aria-label="Dismiss" className="text-slate-400 hover:text-slate-600">
          ✕
        </button>
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        {canEnableAlerts && !iosNeedsInstall && (
          <button
            onClick={enableAlerts}
            disabled={busy}
            className="rounded-lg bg-slate-900 px-3 py-2 text-xs font-semibold text-white disabled:opacity-60"
          >
            {busy ? "Turning on…" : "Turn on alerts"}
          </button>
        )}
        {installEvent && (
          <button onClick={install} className="rounded-lg border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-800">
            Install app
          </button>
        )}
      </div>
    </div>
  );
}
