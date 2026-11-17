"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { BellRing, Check, Volume2 } from "lucide-react";
import { acceptBranchOrder, fetchBranchOrders } from "@frontend/lib/data/manager";

const POLL_MS = 20_000;
const RING_MS = 4_000;
const WAITING = new Set(["pending", "confirmed"]);

/** Today's date in India (YYYY-MM-DD), matching how delivery dates are stored. */
export function todayIST(offsetDays = 0): string {
  const d = new Date(Date.now() + offsetDays * 86_400_000);
  return d.toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
}

export const isSameDayOrder = (ord: any) => String(ord?.delivery_date || "").slice(0, 10) === todayIST();

/**
 * Same-day order alarm for the branch screen.
 * While any order for TODAY is still waiting (pending/confirmed), it shows a red bar and
 * rings /notification.mp3 every few seconds until the order is accepted into the kitchen.
 * Pre-orders (later delivery dates) never ring.
 */
export function SameDayOrderAlarm({ onAccepted }: { onAccepted?: () => void }) {
  const [waiting, setWaiting] = useState<any[]>([]);
  const [soundBlocked, setSoundBlocked] = useState(false);
  const [acceptingId, setAcceptingId] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const notifiedRef = useRef<Set<string>>(new Set());

  const poll = useCallback(async () => {
    try {
      const res = await fetchBranchOrders({ status: "all", pageSize: "100" });
      const list = (res?.orders || []).filter(
        (o: any) => WAITING.has(String(o.status || "").toLowerCase()) && isSameDayOrder(o)
      );
      setWaiting(list);

      // One system notification per newly seen same-day order.
      for (const o of list) {
        if (notifiedRef.current.has(o.id)) continue;
        notifiedRef.current.add(o.id);
        if (typeof Notification !== "undefined" && Notification.permission === "granted" && "serviceWorker" in navigator) {
          navigator.serviceWorker.ready
            .then((reg) =>
              reg.showNotification("New same-day order", {
                body: `#${o.order_number || o.id} for today${o.delivery_slot ? ` (${o.delivery_slot})` : ""}. Accept to send it to the kitchen.`,
                tag: `same-day-${o.id}`,
                requireInteraction: true,
                icon: "/icon-192.png",
                data: { url: "/dashboard/shop" },
              })
            )
            .catch(() => null);
        }
      }
    } catch {
      /* keep the last known list; next poll retries */
    }
  }, []);

  useEffect(() => {
    poll();
    const t = setInterval(poll, POLL_MS);
    const onVisible = () => document.visibilityState === "visible" && poll();
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      clearInterval(t);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [poll]);

  // Ring until nothing same-day is waiting.
  useEffect(() => {
    if (!waiting.length) return;
    if (!audioRef.current) audioRef.current = new Audio("/notification.mp3");
    const ring = () => {
      const a = audioRef.current!;
      a.currentTime = 0;
      a.play().then(() => setSoundBlocked(false)).catch(() => setSoundBlocked(true));
    };
    ring();
    const t = setInterval(ring, RING_MS);
    return () => clearInterval(t);
  }, [waiting.length]);

  const accept = async (id: string) => {
    setAcceptingId(id);
    try {
      await acceptBranchOrder(id);
      setWaiting((w) => w.filter((o) => o.id !== id));
      onAccepted?.();
    } finally {
      setAcceptingId(null);
      poll();
    }
  };

  if (!waiting.length) return null;

  return (
    <div role="alert" className="mb-4 rounded-xl border border-[#C93636]/30 bg-[#FDECEC] p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="flex items-center gap-2 text-sm font-semibold text-[#C93636]">
          <BellRing className="h-4 w-4 animate-pulse" aria-hidden />
          {waiting.length === 1 ? "1 same-day order is waiting" : `${waiting.length} same-day orders are waiting`} — accept to
          send to the kitchen
        </p>
        {soundBlocked && (
          <button
            type="button"
            onClick={() => audioRef.current?.play().then(() => setSoundBlocked(false)).catch(() => null)}
            className="inline-flex items-center gap-1.5 rounded-lg border border-[#C93636]/30 bg-white px-3 py-1.5 text-xs font-semibold text-[#C93636]"
          >
            <Volume2 className="h-3.5 w-3.5" /> Turn on alarm sound
          </button>
        )}
      </div>
      <ul className="mt-3 space-y-2">
        {waiting.map((o) => (
          <li key={o.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-white px-3 py-2 border border-brand-border">
            <span className="text-sm text-brand-text">
              <b className="text-brand-navy">#{o.order_number || o.id}</b> · {o.customer_name || "Customer"}
              {o.delivery_slot ? ` · ${o.delivery_slot}` : ""}
            </span>
            <button
              type="button"
              onClick={() => accept(o.id)}
              disabled={acceptingId === o.id}
              className="inline-flex items-center gap-1.5 rounded-lg bg-brand-navy hover:bg-brand-primary px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-60"
            >
              <Check className="h-3.5 w-3.5" /> {acceptingId === o.id ? "Accepting…" : "Accept → Kitchen"}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
