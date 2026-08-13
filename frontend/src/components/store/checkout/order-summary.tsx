"use client";

import { Container, Heading, Text } from "@medusajs/ui";
import Image from "next/image";

export interface OrderSummaryPricing {
  subtotal: number;
  discount: number;
  delivery_fee: number;
  slot_surcharge: number;
  tax: number;
  grand_total: number;
}

export function OrderSummary({
  cart,
  pricing,
  deliveryType = "delivery",
  servicingBranch,
  selectedSlot,
  pincode,
}: {
  cart: any;
  pricing?: OrderSummaryPricing;
  deliveryType?: "delivery" | "pickup";
  servicingBranch?: any;
  selectedSlot?: any;
  pincode?: string;
}) {
  const items = Array.isArray(cart?.items) ? cart.items : [];
  const grossSubtotal = items.reduce(
    (acc: number, item: any) => acc + Number(item.unit_price || item.price || 0) * Number(item.quantity || 1),
    0
  );

  // If authoritative pricing prop is passed, use it; otherwise fallback to safe calculation
  const subtotal = pricing?.subtotal ?? grossSubtotal;
  const discount = pricing?.discount ?? Number(cart?.pricing?.discount || cart?.discount_total || 0);
  const deliveryFee = pricing?.delivery_fee ?? (deliveryType === "pickup" ? 0 : (subtotal >= 999 ? 0 : 79));
  const slotSurcharge = pricing?.slot_surcharge ?? (selectedSlot?.extra_charge || 0);

  const netItems = Math.max(0, subtotal - discount);
  const totalTax = pricing?.tax ?? Math.round((netItems - (netItems / 1.05)) * 100) / 100;
  const cgst = Math.round((totalTax / 2) * 100) / 100;
  const sgst = Math.round((totalTax / 2) * 100) / 100;

  const grandTotal = pricing?.grand_total ?? Math.round(netItems + deliveryFee + slotSurcharge);

  return (
    <Container className="flex flex-col gap-5 p-6 rounded-3xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 shadow-xl sticky top-24">
      <div className="flex items-center justify-between border-b border-zinc-100 dark:border-zinc-800 pb-4">
        <div>
          <Heading level="h2" className="text-lg font-extrabold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
            <span>🎂</span> Order Summary
          </Heading>
          <p className="text-xs text-zinc-500 mt-0.5">
            {items.length} {items.length === 1 ? "handcrafted item" : "handcrafted items"}
          </p>
        </div>
        <span className="text-xs font-bold uppercase tracking-wider px-2.5 py-1 rounded-full bg-rose-50 dark:bg-rose-950/50 text-rose-600 dark:text-rose-400 border border-rose-100 dark:border-rose-900/30">
          Fresh Batch
        </span>
      </div>

      {/* Fulfillment Branch Indicator */}
      {servicingBranch && (
        <div className="p-3 rounded-2xl bg-rose-50/70 dark:bg-rose-950/30 border border-rose-100 dark:border-rose-900/40 text-xs flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-base">{deliveryType === "pickup" ? "🏪" : "🛵"}</span>
            <div>
              <p className="font-bold text-zinc-900 dark:text-zinc-100">
                {deliveryType === "pickup" ? "Pickup Store" : "Servicing Hub"}
              </p>
              <p className="text-[11px] text-zinc-500 truncate max-w-[200px]">
                {servicingBranch.name || servicingBranch.linked_store_name || "Bengaluru Kitchen"}
              </p>
            </div>
          </div>
          <span className="text-[10px] font-bold text-emerald-700 dark:text-emerald-400 bg-emerald-100/70 dark:bg-emerald-950/60 px-2 py-0.5 rounded-full">
            ● Active Kitchen
          </span>
        </div>
      )}

      {/* Items List */}
      <div className="flex flex-col gap-3.5 max-h-64 overflow-y-auto pr-1">
        {items.map((item: any) => {
          const image = item.thumbnail || item.image_url || "https://images.unsplash.com/photo-1578985545062-69928b1d9587?auto=format&fit=crop&q=80&w=300";
          const unitPrice = Number(item.unit_price || item.price || 0);
          const quantity = Number(item.quantity || 1);
          const weight = item.weight || item.metadata?.weight || null;
          const eggless = item.eggless !== undefined ? item.eggless : item.metadata?.eggless;
          const message = item.cake_message || item.metadata?.cake_message;

          return (
            <div
              key={item.id}
              className="flex items-start gap-3.5 p-3 rounded-2xl bg-zinc-50 dark:bg-zinc-800/60 border border-zinc-100 dark:border-zinc-800/80"
            >
              <div className="relative w-14 h-14 rounded-xl overflow-hidden shrink-0 bg-white border border-zinc-200/50">
                <Image
                  src={image}
                  alt={item.title || "Cake"}
                  className="object-cover"
                  fill
                />
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex justify-between items-start">
                  <h3 className="text-xs font-bold text-zinc-900 dark:text-zinc-100 truncate pr-1">
                    {item.title || item.name}
                  </h3>
                  <span className="text-xs font-extrabold text-zinc-900 dark:text-zinc-100 shrink-0">
                    ₹{(unitPrice * quantity).toLocaleString("en-IN")}
                  </span>
                </div>

                <div className="flex flex-wrap items-center gap-1.5 mt-1">
                  <span className="text-[10px] font-semibold text-zinc-500 dark:text-zinc-400">
                    Qty: <b className="text-zinc-700 dark:text-zinc-200">{quantity}</b> × ₹{unitPrice}
                  </span>
                  {weight && (
                    <span className="text-[10px] font-medium bg-zinc-200/80 dark:bg-zinc-700 text-zinc-700 dark:text-zinc-300 px-1.5 py-0.5 rounded-md">
                      {weight}
                    </span>
                  )}
                  {eggless && (
                    <span className="text-[10px] font-medium bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 px-1.5 py-0.5 rounded-md border border-emerald-200 dark:border-emerald-900/30">
                      🌱 Eggless
                    </span>
                  )}
                </div>

                {message && (
                  <p className="text-[10px] text-zinc-500 italic mt-1 truncate">
                    "{message}"
                  </p>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Pricing Breakdown */}
      <div className="border-t border-zinc-100 dark:border-zinc-800 pt-4 flex flex-col gap-2.5 text-sm">
        <div className="flex justify-between text-zinc-600 dark:text-zinc-400">
          <span>Items Subtotal</span>
          <span className="font-semibold text-zinc-900 dark:text-zinc-100">
            ₹{subtotal.toLocaleString("en-IN")}
          </span>
        </div>

        {discount > 0 && (
          <div className="flex justify-between text-emerald-600 dark:text-emerald-400 font-medium">
            <span>Special Discount / Promo</span>
            <span>-₹{discount.toLocaleString("en-IN")}</span>
          </div>
        )}

        <div className="flex justify-between text-zinc-600 dark:text-zinc-400">
          <div className="flex items-center gap-1.5">
            <span>{deliveryType === "pickup" ? "Branch Store Pickup" : "Delivery Fee"}</span>
            {deliveryType === "pickup" ? (
              <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 dark:bg-emerald-950/50 px-1.5 py-0.5 rounded">
                STORE PICKUP (FREE)
              </span>
            ) : deliveryFee === 0 ? (
              <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 dark:bg-emerald-950/50 px-1.5 py-0.5 rounded">
                FREE DELIVERY (Orders &gt; ₹999)
              </span>
            ) : pincode ? (
              <span className="text-[10px] font-medium text-zinc-500">
                (Zone {pincode})
              </span>
            ) : null}
          </div>
          <span className="font-semibold text-zinc-900 dark:text-zinc-100">
            {deliveryFee === 0 ? "₹0" : `₹${deliveryFee}`}
          </span>
        </div>

        {slotSurcharge > 0 && (
          <div className="flex justify-between text-zinc-600 dark:text-zinc-400">
            <span>Slot Surcharge ({selectedSlot?.slot_type || "Priority"})</span>
            <span className="font-semibold text-zinc-900 dark:text-zinc-100">
              ₹{slotSurcharge}
            </span>
          </div>
        )}

        {/* Statutory Tax Breakdown Accordion */}
        <div className="p-3 rounded-2xl bg-zinc-50 dark:bg-zinc-800/40 border border-zinc-100 dark:border-zinc-800 text-xs flex flex-col gap-1.5 mt-1">
          <div className="flex justify-between font-semibold text-zinc-700 dark:text-zinc-300">
            <span className="flex items-center gap-1">
              <span>📋</span> GST (5% Included, HSN 19059090)
            </span>
            <span>₹{totalTax.toFixed(2)}</span>
          </div>
          <div className="flex justify-between text-zinc-500 pl-4">
            <span>CGST (2.5%)</span>
            <span>₹{cgst.toFixed(2)}</span>
          </div>
          <div className="flex justify-between text-zinc-500 pl-4">
            <span>SGST (2.5%)</span>
            <span>₹{sgst.toFixed(2)}</span>
          </div>
        </div>

        {/* Grand Total */}
        <div className="border-t border-zinc-200 dark:border-zinc-700/80 pt-3.5 flex justify-between items-baseline">
          <div>
            <span className="text-base font-extrabold text-zinc-900 dark:text-zinc-100">
              Grand Total
            </span>
            <p className="text-[10px] text-zinc-400">Inclusive of all taxes</p>
          </div>
          <span className="text-2xl font-black text-rose-600 dark:text-rose-400 tracking-tight">
            ₹{grandTotal.toLocaleString("en-IN")}
          </span>
        </div>
      </div>

      {/* Trust & Guarantee Pill */}
      <div className="grid grid-cols-3 gap-2 pt-2 text-center text-[10px] text-zinc-500 border-t border-zinc-100 dark:border-zinc-800">
        <div className="flex flex-col items-center gap-1">
          <span className="text-base">✨</span>
          <span>100% Fresh Daily</span>
        </div>
        <div className="flex flex-col items-center gap-1">
          <span className="text-base">🔒</span>
          <span>Safe & Sealed</span>
        </div>
        <div className="flex flex-col items-center gap-1">
          <span className="text-base">⚡</span>
          <span>Direct Kitchen Dispatch</span>
        </div>
      </div>
    </Container>
  );
}

