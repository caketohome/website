"use client";

import { useEffect, useState } from "react";
import type { CartFulfillmentCheckResult, DeliverySlot } from "@frontend/lib/fulfillment";

interface CartItem {
  id?: string;
  product_id: string;
  title?: string;
  name?: string;
  quantity?: number;
}

interface CartFulfillmentValidatorProps {
  items: CartItem[];
  branchId?: string;
  cityId?: string;
  requestedDate?: string;
  requestedTime?: string;
  onValidationComplete?: (result: CartFulfillmentCheckResult) => void;
  className?: string;
}

export function CartFulfillmentValidator({
  items,
  branchId,
  cityId,
  requestedDate,
  requestedTime,
  onValidationComplete,
  className = "",
}: CartFulfillmentValidatorProps) {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<CartFulfillmentCheckResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!items || items.length === 0) {
      setResult(null);
      return;
    }

    let isMounted = true;
    async function validateCartFulfillment() {
      try {
        setLoading(true);
        setError(null);

        const payload = {
          items: items.map((item) => ({
            product_id: item.product_id || (item as any).id,
            quantity: item.quantity || 1,
          })),
          branch_id: branchId,
          city_id: cityId,
          date: requestedDate,
          time: requestedTime,
        };

        const res = await fetch("/api/v1/fulfillment/cart-check", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });

        if (!res.ok) throw new Error("Failed to check cart fulfillment timing");
        const data: CartFulfillmentCheckResult = await res.json();

        if (isMounted) {
          setResult(data);
          onValidationComplete?.(data);
        }
      } catch (err: any) {
        if (isMounted) {
          setError(err.message || "Failed to validate delivery availability");
        }
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    validateCartFulfillment();

    return () => {
      isMounted = false;
    };
  }, [items, branchId, cityId, requestedDate, requestedTime, onValidationComplete]);

  if (!items || items.length === 0) return null;

  if (loading) {
    return (
      <div className={`p-4 rounded-2xl bg-amber-50/60 border border-amber-200/80 animate-pulse flex items-center gap-3 ${className}`}>
        <div className="w-5 h-5 rounded-full border-2 border-amber-600 border-t-transparent animate-spin shrink-0" />
        <div className="flex flex-col gap-1">
          <span className="text-xs font-bold text-amber-900">Calculating kitchen baking & delivery slots...</span>
          <span className="text-[11px] text-amber-700">Verifying live branch capacity & cutoff times</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={`p-3 rounded-xl bg-gray-50 border border-gray-200 text-xs text-gray-600 ${className}`}>
        <span>ℹ️ Standard 2-hour delivery available at checkout.</span>
      </div>
    );
  }

  if (!result) return null;

  const hasIneligibleItems = result.items.some((i) => !i.eligible);

  return (
    <div className={`flex flex-col gap-3 p-4 rounded-2xl border transition-all ${
      hasIneligibleItems
        ? "bg-amber-50/80 border-amber-300"
        : "bg-emerald-50/60 border-emerald-200"
    } ${className}`}>
      {/* Header Banner */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="text-lg">{hasIneligibleItems ? "🌙" : "⚡"}</span>
          <div className="flex flex-col">
            <span className={`text-xs font-black uppercase tracking-wider ${
              hasIneligibleItems ? "text-amber-900" : "text-emerald-900"
            }`}>
              {hasIneligibleItems ? "Fulfillment Notice" : "Live Kitchen Timing"}
            </span>
            <span className={`text-xs font-medium ${
              hasIneligibleItems ? "text-amber-800" : "text-emerald-800"
            }`}>
              {result.message}
            </span>
          </div>
        </div>

        {result.effective_preparation_minutes > 0 && (
          <div className="px-2.5 py-1 rounded-full bg-white/80 border text-[11px] font-bold text-gray-800 shrink-0 shadow-sm">
            🕒 ~{result.effective_preparation_minutes} min prep
          </div>
        )}
      </div>

      {/* Item-Specific Ineligibility / Pre-order Warnings */}
      {hasIneligibleItems && (
        <div className="flex flex-col gap-1.5 pt-2 border-t border-amber-200/80">
          <span className="text-[11px] font-bold text-amber-900 uppercase tracking-wider">Item Restrictions:</span>
          {result.items
            .filter((item) => !item.eligible)
            .map((item) => {
              const matchedItem = items.find((i) => (i.product_id || (i as any).id) === item.product_id);
              const title = matchedItem?.title || matchedItem?.name || `Product (${item.product_id})`;
              return (
                <div
                  key={item.product_id}
                  className="flex items-center justify-between p-2 rounded-xl bg-white/80 border border-amber-200 text-xs text-amber-950"
                >
                  <span className="font-semibold truncate flex-1">{title}</span>
                  <span className="text-[11px] font-bold text-amber-800 shrink-0 ml-2">
                    {item.message || "Advance pre-order required"}
                  </span>
                </div>
              );
            })}
        </div>
      )}

      {/* Earliest Delivery Date Hint */}
      {result.earliest_available_datetime && (
        <div className="flex items-center justify-between text-xs pt-2 border-t border-gray-200/60">
          <span className="text-gray-600 font-medium">Earliest Delivery Window:</span>
          <span className="font-bold text-gray-900">
            {new Date(result.earliest_available_datetime).toLocaleString("en-IN", {
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
