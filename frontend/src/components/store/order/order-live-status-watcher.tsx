"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

interface OrderLiveStatusWatcherProps {
  orderId: string;
  initialStatus: string;
  initialPaymentStatus: string;
  orderNumber?: string;
}

export function OrderLiveStatusWatcher({
  orderId,
  initialStatus,
  initialPaymentStatus,
  orderNumber,
}: OrderLiveStatusWatcherProps) {
  const router = useRouter();
  const [status, setStatus] = useState<string>(initialStatus || "pending");
  const [paymentStatus, setPaymentStatus] = useState<string>(initialPaymentStatus || "pending");
  const [isSyncing, setIsSyncing] = useState<boolean>(
    !["paid", "captured"].includes((initialPaymentStatus || "").toLowerCase())
  );
  const [confirmedTime, setConfirmedTime] = useState<string | null>(null);

  useEffect(() => {
    // If already paid and confirmed, no need to poll
    const isCurrentlyPaid = ["paid", "captured"].includes((paymentStatus || "").toLowerCase());
    const isCurrentlyConfirmed = ["confirmed", "preparing", "ready_for_pickup", "out_for_delivery", "delivered"].includes(
      (status || "").toLowerCase()
    );

    if (isCurrentlyPaid && isCurrentlyConfirmed) {
      setIsSyncing(false);
      return;
    }

    let isMounted = true;
    let pollCount = 0;
    const maxPolls = 30; // 30 polls * 2s = 60s max auto-polling window

    const intervalId = setInterval(async () => {
      if (!isMounted) return;
      pollCount++;

      try {
        const res = await fetch(`/api/v1/orders/${encodeURIComponent(orderId)}/status`, {
          cache: "no-store",
          headers: { "Accept": "application/json" },
        });

        if (res.ok) {
          const data = await res.json();
          if (data && data.found) {
            setStatus(data.status);
            setPaymentStatus(data.payment_status);

            const nowPaid = data.is_paid || ["paid", "captured"].includes(String(data.payment_status).toLowerCase());
            const nowConfirmed = data.is_confirmed || data.status === "confirmed";

            if (nowPaid && nowConfirmed) {
              clearInterval(intervalId);
              setIsSyncing(false);
              setConfirmedTime(new Date().toLocaleTimeString());
              // Auto-refresh the server component without losing client state
              router.refresh();
            }
          }
        }
      } catch (err) {
        console.warn("[OrderLiveStatusWatcher] Polling error:", err);
      }

      if (pollCount >= maxPolls) {
        clearInterval(intervalId);
        setIsSyncing(false);
      }
    }, 2000);

    return () => {
      isMounted = false;
      clearInterval(intervalId);
    };
  }, [orderId, paymentStatus, status, router]);

  const isPaid = ["paid", "captured"].includes((paymentStatus || "").toLowerCase());
  const isConfirmed = ["confirmed", "preparing", "ready_for_pickup", "out_for_delivery", "delivered"].includes(
    (status || "").toLowerCase()
  );

  return (
    <div className="w-full my-3">
      {isSyncing ? (
        <div className="flex items-center justify-between p-3.5 px-4 rounded-2xl bg-brand-gold/10 border border-brand-gold/20 text-brand-gold/40 text-xs">
          <div className="flex items-center gap-2.5">
            <span className="relative flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-brand-gold opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-brand-gold"></span>
            </span>
            <span className="font-semibold text-brand-gold-light">
              Verifying payment confirmation with Razorpay gateway...
            </span>
          </div>
          <span className="text-[11px] text-brand-gold/80 hidden sm:inline">
            Auto-syncing real-time • No refresh needed
          </span>
        </div>
      ) : isPaid && isConfirmed ? (
        <div className="flex items-center justify-between p-3.5 px-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-200 text-xs shadow-sm">
          <div className="flex items-center gap-2">
            <span className="text-[#16834A] font-bold">✓</span>
            <span className="font-semibold text-emerald-100">
              Payment Authenticated & Captured — Order Confirmed in Real-Time
            </span>
            {confirmedTime && (
              <span className="text-[10px] bg-emerald-500/20 px-2 py-0.5 rounded text-[#16834A] font-mono">
                {confirmedTime}
              </span>
            )}
          </div>
          <span className="text-[11px] text-[#16834A]/80 font-mono hidden sm:inline">
            {orderNumber || orderId}
          </span>
        </div>
      ) : null}
    </div>
  );
}

