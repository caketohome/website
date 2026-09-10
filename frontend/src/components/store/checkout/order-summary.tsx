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
 <Container className="flex flex-col gap-5 p-6 rounded-3xl bg-navy-surface border border-navy-accent/60 shadow-xl sticky top-24">
 <div className="flex items-center justify-between border-b border-navy-accent/60 pb-4">
 <div>
 <Heading level="h2" className="text-lg font-extrabold text-pearl flex items-center gap-2">
 <span>🎂</span> Order Summary
 </Heading>
 <p className="text-xs text-ash mt-0.5">
 {items.length} {items.length === 1 ? "handcrafted item" : "handcrafted items"}
 </p>
 </div>
 <span className="text-xs font-bold uppercase tracking-wider px-2.5 py-1 rounded-full bg-obsidian-base text-pearl border border-navy-accent/60 ">
 Fresh Batch
 </span>
 </div>

 {/* Fulfillment Branch Indicator */}
 {servicingBranch && (
 <div className="p-3 rounded-2xl bg-obsidian-base/70 border border-navy-accent/60 text-xs flex items-center justify-between">
 <div className="flex items-center gap-2">
 <span className="text-base">{deliveryType === "pickup" ? "🏪" : "🛵"}</span>
 <div>
 <p className="font-bold text-pearl ">
 {deliveryType === "pickup" ? "Pickup Store" : "Servicing Hub"}
 </p>
 <p className="text-[11px] text-ash truncate max-w-[200px]">
 {servicingBranch.name || servicingBranch.linked_store_name || "Bengaluru Kitchen"}
 </p>
 </div>
 </div>
 <span className="text-[10px] font-bold text-emerald-700 bg-emerald-100/70 px-2 py-0.5 rounded-full">
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
 const message = item.cake_message || item.metadata?.cake_message;

 return (
 <div
 key={item.id}
 className="flex items-start gap-3.5 p-3 rounded-2xl bg-obsidian-base border border-navy-accent/60 "
 >
 <div className="relative w-14 h-14 rounded-2xl overflow-hidden shrink-0 bg-navy-surface border border-navy-accent/60">
 <Image
 src={image}
 alt={item.title || "Cake"}
 className="object-cover"
 fill
 />
 </div>

 <div className="flex-1 min-w-0">
 <div className="flex justify-between items-start">
 <h3 className="text-xs font-bold text-pearl truncate pr-1">
 {item.title || item.name}
 </h3>
 <span className="text-xs font-extrabold text-pearl shrink-0">
 ₹{(unitPrice * quantity).toLocaleString("en-IN")}
 </span>
 </div>

 <div className="flex flex-wrap items-center gap-1.5 mt-1">
 <span className="text-[10px] font-semibold text-ash ">
 Qty: <b className="text-pearl ">{quantity}</b> × ₹{unitPrice}
 </span>
 {weight && (
 <span className="text-[10px] font-medium bg-rosegold/30/80 text-pearl px-1.5 py-0.5 rounded-xl">
 {weight}
 </span>
 )}
 </div>

 {message && (
 <p className="text-[10px] text-ash italic mt-1 truncate">
 "{message}"
 </p>
 )}
 </div>
 </div>
 );
 })}
 </div>

 {/* Pricing Breakdown */}
 <div className="border-t border-navy-accent/60 pt-4 flex flex-col gap-2.5 text-sm">
 <div className="flex justify-between text-ash ">
 <span>Items Subtotal</span>
 <span className="font-semibold text-pearl ">
 ₹{subtotal.toLocaleString("en-IN")}
 </span>
 </div>

 {discount > 0 && (
 <div className="flex justify-between text-emerald-600 font-medium">
 <span>Special Discount / Promo</span>
 <span>-₹{discount.toLocaleString("en-IN")}</span>
 </div>
 )}

 <div className="flex justify-between text-ash ">
 <div className="flex items-center gap-1.5">
 <span>{deliveryType === "pickup" ? "Branch Store Pickup" : "Delivery Fee"}</span>
 {deliveryType === "pickup" ? (
 <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded">
 STORE PICKUP (FREE)
 </span>
 ) : deliveryFee === 0 ? (
 <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded">
 FREE DELIVERY (Orders &gt; ₹999)
 </span>
 ) : pincode ? (
 <span className="text-[10px] font-medium text-ash">
 (Zone {pincode})
 </span>
 ) : null}
 </div>
 <span className="font-semibold text-pearl ">
 {deliveryFee === 0 ? "₹0" : `₹${deliveryFee}`}
 </span>
 </div>

 {slotSurcharge > 0 && (
 <div className="flex justify-between text-ash ">
 <span>Slot Surcharge ({selectedSlot?.slot_type || "Priority"})</span>
 <span className="font-semibold text-pearl ">
 ₹{slotSurcharge}
 </span>
 </div>
 )}

 {/* Statutory Tax Breakdown Accordion */}
 <div className="p-3 rounded-2xl bg-obsidian-base border border-navy-accent/60 text-xs flex flex-col gap-1.5 mt-1">
 <div className="flex justify-between font-semibold text-pearl ">
 <span className="flex items-center gap-1">
 <span>📋</span> GST (5% Included, HSN 19059090)
 </span>
 <span>₹{totalTax.toFixed(2)}</span>
 </div>
 <div className="flex justify-between text-ash pl-4">
 <span>CGST (2.5%)</span>
 <span>₹{cgst.toFixed(2)}</span>
 </div>
 <div className="flex justify-between text-ash pl-4">
 <span>SGST (2.5%)</span>
 <span>₹{sgst.toFixed(2)}</span>
 </div>
 </div>

 {/* Grand Total */}
 <div className="border-t border-navy-accent/60 pt-3.5 flex justify-between items-baseline">
 <div>
 <span className="text-base font-extrabold text-pearl ">
 Grand Total
 </span>
 <p className="text-[10px] text-ash/70">Inclusive of all taxes</p>
 </div>
 <span className="text-2xl font-black text-pearl tracking-tight">
 ₹{grandTotal.toLocaleString("en-IN")}
 </span>
 </div>
 </div>

 {/* Trust & Guarantee Pill */}
 <div className="grid grid-cols-3 gap-2 pt-2 text-center text-[10px] text-ash border-t border-navy-accent/60 ">
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

