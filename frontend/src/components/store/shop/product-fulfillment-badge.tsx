"use client";

import { useEffect, useState } from "react";
import type { FulfillmentCheckResult } from "@frontend/lib/fulfillment";

interface ProductFulfillmentBadgeProps {
  productId: string;
  branchId?: string;
  cityId?: string;
  className?: string;
  showDetails?: boolean;
}

export function ProductFulfillmentBadge({
  productId,
  branchId,
  cityId,
  className = "",
  showDetails = false,
}: ProductFulfillmentBadgeProps) {
  const [loading, setLoading] = useState(true);
  const [fulfillment, setFulfillment] = useState<FulfillmentCheckResult | null>(null);

  useEffect(() => {
    let isMounted = true;
    async function checkAvailability() {
      try {
        setLoading(true);
        const params = new URLSearchParams();
        params.set("product_id", productId);
        if (branchId) params.set("branch_id", branchId);
        if (cityId) params.set("city_id", cityId);

        const res = await fetch(`/api/v1/fulfillment/check?${params.toString()}`);
        if (!res.ok) throw new Error("Failed to check fulfillment");
        const data = await res.json();
        if (isMounted) {
          setFulfillment(data);
        }
      } catch (err) {
        if (isMounted) {
          // Fallback optimistic display
          setFulfillment(null);
        }
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    if (productId) {
      checkAvailability();
    }

    return () => {
      isMounted = false;
    };
  }, [productId, branchId, cityId]);

  if (loading) {
    return (
      <div className={`flex items-center gap-1.5 text-xs text-gray-400 animate-pulse ${className}`}>
        <div className="w-2 h-2 rounded-full bg-gray-300" />
        <span>Checking delivery timing...</span>
      </div>
    );
  }

  if (!fulfillment) {
    return (
      <div className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 ${className}`}>
        <span>⚡ Freshly baked & delivered in 2 hours</span>
      </div>
    );
  }

  // Determine badge styling and icon based on fulfillment eligibility & reason
  let badgeStyle = "bg-emerald-50 text-emerald-800 border-emerald-200";
  let icon = "⚡";
  let text = fulfillment.message || "Available for delivery today";

  if (!fulfillment.eligible) {
    if (fulfillment.reason === "SAME_DAY_CUTOFF_PASSED") {
      badgeStyle = "bg-brand-gold-light text-brand-gold-dark border-brand-gold/40";
      icon = "🌙";
      text = fulfillment.message || "Same-day cutoff passed — Pre-order for tomorrow";
    } else if (fulfillment.reason === "PRODUCT_REQUIRES_PREORDER") {
      badgeStyle = "bg-blue-50 text-blue-800 border-blue-200";
      icon = "📅";
      text = fulfillment.message || "Advance pre-order required";
    } else if (fulfillment.reason === "HOLIDAY" || fulfillment.reason === "OPERATIONS_CLOSED" || fulfillment.reason === "BRANCH_CLOSED") {
      badgeStyle = "bg-brand-gold-soft text-brand-navy border-brand-gold/30";
      icon = "🛑";
      text = fulfillment.message || "Currently closed";
    } else if (fulfillment.reason === "OUT_OF_STOCK") {
      badgeStyle = "bg-gray-100 text-gray-700 border-gray-300";
      icon = "⚠️";
      text = "Out of stock at this location";
    } else {
      badgeStyle = "bg-brand-gold-light text-brand-gold-dark border-brand-gold/40";
      icon = "⏳";
      text = fulfillment.message || "Delivery timing restricted";
    }
  } else if (fulfillment.requires_preorder) {
    badgeStyle = "bg-blue-50 text-blue-800 border-blue-200";
    icon = "📅";
  } else if (fulfillment.instant_delivery_available) {
    badgeStyle = "bg-emerald-50 text-emerald-800 border-emerald-200";
    icon = "⚡";
  }

  return (
    <div className={`flex flex-col gap-1.5 ${className}`}>
      <div className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold border transition shadow-sm w-fit ${badgeStyle}`}>
        <span>{icon}</span>
        <span>{text}</span>
      </div>

      {showDetails && fulfillment.earliest_available_datetime && (
        <div className="text-[11px] text-gray-500 font-medium flex items-center gap-1">
          <span>🕒 Earliest dispatch:</span>
          <span className="font-bold text-gray-800">
            {new Date(fulfillment.earliest_available_datetime).toLocaleString("en-IN", {
              weekday: "short",
              month: "short",
              day: "numeric",
              hour: "2-digit",
              minute: "2-digit",
            })}
          </span>
        </div>
      )}
    </div>
  );
}
