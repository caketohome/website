import { Container, Heading, Text } from "@medusajs/ui";
import Image from "next/image";

export interface OrderSummaryPricing {
  subtotal: number;
  discount: number;
  delivery_fee: number;
  slot_surcharge: number;
  tax: number;
  grand_total: number;
  distance_km?: number | null;
}

export function OrderSummary({
  cart,
  pricing,
  extras = [],
  deliveryType = "delivery",
  servicingBranch,
  selectedSlot,
  pincode,
}: {
  cart: any;
  pricing?: OrderSummaryPricing;
  /** Surprise services chosen at checkout (charged as order lines; GST added on top). */
  extras?: Array<{ name: string; price: number; gst_rate: number }>;
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
  // Delivery fee comes only from the server quote (distance from the hub to the customer's location).
  const feeKnown = deliveryType === "pickup" || typeof pricing?.delivery_fee === "number";
  const deliveryFee = deliveryType === "pickup" ? (pricing?.delivery_fee ?? 0) : Number(pricing?.delivery_fee ?? 0);
  const slotSurcharge = pricing?.slot_surcharge ?? (selectedSlot?.extra_charge || 0);

  const netItems = Math.max(0, subtotal - discount);
  const totalTax = pricing?.tax ?? Math.round((netItems - (netItems / 1.05)) * 100) / 100;
  const extrasSubtotal = Math.round(extras.reduce((t, e) => t + Number(e.price || 0), 0) * 100) / 100;
  const extrasTax = Math.round(extras.reduce((t, e) => t + Number(e.price || 0) * Number(e.gst_rate || 0) / 100, 0) * 100) / 100;
  const cgst = Math.round((totalTax / 2) * 100) / 100;
  const sgst = Math.round((totalTax / 2) * 100) / 100;

  const grandTotal = Math.round(((pricing?.grand_total ?? Math.round(netItems + deliveryFee + slotSurcharge)) + extrasSubtotal + extrasTax) * 100) / 100;

  return (
    <Container className="flex flex-col gap-5 p-6 rounded-3xl bg-white border border-slate-200 shadow-lg sticky top-24">
      <div className="flex items-center justify-between border-b border-slate-200/80 pb-4">
        <div>
          <Heading level="h2" className="text-lg font-extrabold text-brand-text flex items-center gap-2">
            <span>🎂</span> Order Summary
          </Heading>
          <p className="text-xs text-slate-500 mt-0.5">
            {items.length} {items.length === 1 ? "handcrafted item" : "handcrafted items"}
          </p>
        </div>
        <span className="text-xs font-bold uppercase tracking-wider px-2.5 py-1 rounded-full bg-blue-50 text-brand-primary border border-blue-200">
          Fresh Batch
        </span>
      </div>

      {/* Fulfillment Branch Indicator */}
      {servicingBranch && (
        <div className="p-3 rounded-2xl bg-slate-50 border border-slate-200/80 text-xs flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-base">{deliveryType === "pickup" ? "🏪" : "🛵"}</span>
            <div>
              <p className="font-bold text-brand-text">
                {deliveryType === "pickup" ? "Pickup Store" : "Servicing Hub"}
              </p>
              <p className="text-[11px] text-slate-500 truncate max-w-[200px]">
                {servicingBranch.name || servicingBranch.linked_store_name || "Kitchen"}
              </p>
            </div>
          </div>
          <span className="text-[10px] font-bold text-emerald-700 bg-emerald-100/80 px-2 py-0.5 rounded-full border border-emerald-200">
            ● Active Kitchen
          </span>
        </div>
      )}

      {/* Items List */}
      <div className="flex flex-col gap-3.5 max-h-64 overflow-y-auto pr-1">
        {items.map((item: any) => {
          const image = item.thumbnail || item.image_url || "/images/placeholder-cake.webp";
          const unitPrice = Number(item.unit_price || item.price || 0);
          const quantity = Number(item.quantity || 1);
          const weight = item.weight || item.metadata?.weight || null;
          const message = item.cake_message || item.metadata?.cake_message;

          return (
            <div
              key={item.id}
              className="flex items-start gap-3.5 p-3 rounded-2xl bg-slate-50 border border-slate-200/80"
            >
              <div className="relative w-14 h-14 rounded-xl overflow-hidden shrink-0 bg-white border border-slate-200">
                <Image
                  src={image}
                  alt={item.title || "Cake"}
                  className="object-cover"
                  fill
                />
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex justify-between items-start">
                  <h3 className="text-xs font-bold text-brand-text truncate pr-1">
                    {item.title || item.name}
                  </h3>
                  <span className="text-xs font-extrabold text-brand-text shrink-0">
                    ₹{(unitPrice * quantity).toLocaleString("en-IN")}
                  </span>
                </div>

                <div className="flex flex-wrap items-center gap-1.5 mt-1">
                  <span className="text-[10px] font-semibold text-slate-500">
                    Qty: <b className="text-slate-800">{quantity}</b> × ₹{unitPrice}
                  </span>
                  {weight && (
                    <span className="text-[10px] font-medium bg-white border border-slate-200 text-slate-700 px-1.5 py-0.5 rounded-md">
                      {weight}
                    </span>
                  )}
                </div>

                {message && (
                  <p className="text-[10px] text-slate-500 italic mt-1 truncate">
                    "{message}"
                  </p>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Pricing Breakdown */}
      <div className="border-t border-slate-200/80 pt-4 flex flex-col gap-2.5 text-sm">
        <div className="flex justify-between text-slate-600">
          <span>Items Subtotal</span>
          <span className="font-semibold text-brand-text">
            ₹{subtotal.toLocaleString("en-IN")}
          </span>
        </div>

        {discount > 0 && (
          <div className="flex justify-between text-emerald-600 font-medium">
            <span>Special Discount / Promo</span>
            <span>-₹{discount.toLocaleString("en-IN")}</span>
          </div>
        )}

        <div className="flex justify-between text-slate-600">
          <div className="flex items-center gap-1.5">
            <span>{deliveryType === "pickup" ? "Branch Store Pickup" : "Delivery Fee"}</span>
            {deliveryType === "pickup" ? (
              <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200">
                STORE PICKUP (FREE)
              </span>
            ) : (
              <span className="text-[10px] font-medium text-slate-500">
                (based on your location)
              </span>
            )}
          </div>
          <span className="font-semibold text-brand-text">
            {feeKnown ? `₹${deliveryFee}` : "Select location"}
          </span>
        </div>

        {slotSurcharge > 0 && (
          <div className="flex justify-between text-slate-600">
            <span>Slot Surcharge ({selectedSlot?.slot_type || "Priority"})</span>
            <span className="font-semibold text-brand-text">
              ₹{slotSurcharge}
            </span>
          </div>
        )}

        {extras.length > 0 && (
          <div className="flex flex-col gap-1 text-xs">
            {extras.map((e, i) => (
              <div key={i} className="flex justify-between text-slate-700">
                <span>🎁 {e.name}</span>
                <span>{e.price > 0 ? `₹${e.price.toLocaleString("en-IN")}${e.gst_rate ? ` + ₹${(Math.round(e.price * e.gst_rate) / 100).toFixed(2)} GST` : ""}` : "Free"}</span>
              </div>
            ))}
          </div>
        )}

        {/* Statutory Tax Breakdown Accordion */}
        <div className="p-3 rounded-2xl bg-slate-50 border border-slate-200/80 text-xs flex flex-col gap-1.5 mt-1">
          <div className="flex justify-between font-semibold text-slate-700">
            <span className="flex items-center gap-1">
              <span>📋</span> Statutory GST (Intra-State)
            </span>
            <span>₹{totalTax.toFixed(2)}</span>
          </div>
          <div className="flex justify-between text-slate-500 pl-4">
            <span>CGST (2.5%)</span>
            <span>₹{cgst.toFixed(2)}</span>
          </div>
          <div className="flex justify-between text-slate-500 pl-4">
            <span>SGST (2.5%)</span>
            <span>₹{sgst.toFixed(2)}</span>
          </div>
        </div>

        {/* Grand Total */}
        <div className="border-t border-slate-200 pt-3.5 flex justify-between items-baseline">
          <div>
            <span className="text-base font-extrabold text-brand-text">
              Grand Total
            </span>
            <p className="text-[10px] text-slate-400">Inclusive of all taxes</p>
          </div>
          <span className="text-2xl font-black text-brand-primary tracking-tight">
            ₹{grandTotal.toLocaleString("en-IN")}
          </span>
        </div>
      </div>

      {/* Trust & Guarantee Pill */}
      <div className="grid grid-cols-3 gap-2 pt-2 text-center text-[10px] text-slate-500 border-t border-slate-200">
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
