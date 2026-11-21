"use client";

import React, { useState } from "react";
import {
  acceptBranchOrder,
  rejectBranchOrder,
  holdBranchOrder,
  delayBranchOrder,
  markBranchOrderReady,
} from "@frontend/lib/data/manager";
import { buildGoogleMapsDirectionsUrl, extractDeliveryCoordinates } from "@frontend/lib/location/directions";
import { HandoffProblemPanel } from "@frontend/components/dashboard/handoff-problem-panel";

interface OrderDetailsDrawerProps {
  order: any;
  isOpen: boolean;
  onClose: () => void;
  onRefresh: () => void;
  onOpenKot: (order: any) => void;
  onOpenInvoice: (order: any) => void;
  onOpenAssignRider: (order: any) => void;
}

export default function OrderDetailsDrawer({
  order,
  isOpen,
  onClose,
  onRefresh,
  onOpenKot,
  onOpenInvoice,
  onOpenAssignRider,
}: OrderDetailsDrawerProps) {
  const [loading, setLoading] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [showDelayInput, setShowDelayInput] = useState(false);
  const [delayReason, setDelayReason] = useState("");
  const [delayEta, setDelayEta] = useState("+30 mins");
  const [showRejectInput, setShowRejectInput] = useState(false);
  const [rejectReason, setRejectReason] = useState("");
  const [photoZoom, setPhotoZoom] = useState(false);

  if (!isOpen || !order) return null;

  const handleAction = async (actionFn: () => Promise<any>, successMsg?: string) => {
    try {
      setLoading(true);
      setActionError(null);
      const res = await actionFn();
      if (!res.success && res.error) {
        setActionError(res.error);
      } else {
        onRefresh();
      }
    } catch (err: any) {
      setActionError(err.message || "Failed to complete action");
    } finally {
      setLoading(false);
    }
  };

  const isPhotoCake = order.is_photo_cake || !!order.customization?.photo_url || (order.items || []).some((i: any) => (i.title || "").toLowerCase().includes("photo"));
  const photoUrl = order.photo_url || order.customization?.photo_url || (isPhotoCake ? "/images/placeholder-cake.webp" : null);

  return (
    <div className="fixed inset-0 z-50 overflow-hidden bg-black/60 backdrop-blur-sm flex justify-end animate-in fade-in duration-200">
      <div className="w-full max-w-2xl bg-white dark:bg-zinc-900 h-full shadow-2xl flex flex-col border-l border-brand-border dark:border-zinc-800">
        <div className="px-6 pt-4 empty:hidden">
          <HandoffProblemPanel orderId={order.id} />
        </div>
        {/* Header */}
        <div className="p-6 border-b border-brand-border dark:border-zinc-800 flex items-center justify-between bg-brand-surface-muted dark:bg-zinc-950">
          <div>
            <div className="flex items-center gap-3">
              <h2 className="text-xl font-bold text-brand-navy dark:text-white">
                Order #{order.order_number || order.id}
              </h2>
              <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold uppercase tracking-wider ${
                order.priority === "EXPRESS" ? "bg-brand-gold-light text-brand-gold-dark dark:bg-brand-gold-dark dark:text-brand-gold" :
                order.priority === "MIDNIGHT" ? "bg-brand-light text-brand-navy dark:bg-brand-navy dark:text-brand-primary" :
                "bg-brand-surface-muted text-brand-text dark:bg-zinc-800 dark:text-zinc-300"
              }`}>
                {order.priority || "NORMAL"}
              </span>
              <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                order.status === "delivered" ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300" :
                order.status === "cancelled" ? "bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300" :
                "bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300"
              }`}>
                {order.status}
              </span>
            </div>
            <p className="text-xs text-brand-text-muted dark:text-zinc-400 mt-1">
              Slot: <span className="font-semibold text-brand-text dark:text-zinc-300">{order.delivery_slot || "2:00 PM - 4:00 PM"}</span> ({order.delivery_date || "Today"})
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-brand-surface-muted dark:hover:bg-zinc-800 text-brand-text-muted hover:text-zinc-900 dark:hover:text-white transition"
          >
            ✕
          </button>
        </div>

        {/* Action Error Alert */}
        {actionError && (
          <div className="mx-6 mt-4 p-3 bg-brand-light dark:bg-rose-950/50 border border-brand-primary/20 dark:border-rose-900 rounded-lg text-brand-primary dark:text-rose-300 text-sm">
            {actionError}
          </div>
        )}

        {/* Scrollable Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Customer Information */}
          <div className="p-4 bg-brand-surface-muted dark:bg-zinc-950/60 rounded-xl border border-brand-border dark:border-zinc-800">
            <h3 className="text-xs font-bold text-brand-text-muted uppercase tracking-wider mb-3">Customer Information</h3>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-xs text-brand-text-muted">Full Name</p>
                <p className="font-semibold text-brand-navy dark:text-white">{order.customer_name || order.customer?.name || "Customer"}</p>
              </div>
              <div>
                <p className="text-xs text-brand-text-muted">Contact Phone</p>
                <a href={`tel:${order.customer_phone || order.customer?.phone}`} className="font-semibold text-brand-primary dark:text-rose-400 hover:underline">
                  {order.customer_phone || order.customer?.phone || "No phone on order"}
                </a>
              </div>
              <div className="col-span-2">
                <div className="flex items-center justify-between">
                  <p className="text-xs text-brand-text-muted">Delivery Address</p>
                  {(() => {
                    const coords = extractDeliveryCoordinates(order);
                    const mapsUrl = buildGoogleMapsDirectionsUrl({
                      latitude: coords.latitude,
                      longitude: coords.longitude,
                      address: order.delivery_address || order.customer?.delivery_address,
                      pincode: order.delivery_pincode || order.pincode || order.customer?.pincode,
                    });
                    return (
                      <a
                        href={mapsUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="text-[11px] font-bold text-brand-primary dark:text-rose-400 hover:underline"
                      >
                        📍 Open in Maps ↗
                      </a>
                    );
                  })()}
                </div>
                <p className="font-medium text-brand-text dark:text-zinc-200">
                  {(() => {
                    const addr = order.delivery_address || order.customer?.delivery_address;
                    if (typeof addr === "string") return addr;
                    if (addr && typeof addr === "object") {
                      return [addr.line1 || addr.address_1 || addr.address, addr.line2 || addr.address_2, addr.landmark, addr.city, addr.pincode].filter(Boolean).join(", ");
                    }
                    return "Indiranagar Flagship Zone";
                  })()}
                </p>
                <p className="text-xs text-brand-text-muted mt-0.5">Pincode: {order.delivery_pincode || order.pincode || order.customer?.pincode || "560038"}</p>
                {(() => {
                  const coords = extractDeliveryCoordinates(order);
                  if (coords.hasCoords && typeof coords.latitude === "number" && typeof coords.longitude === "number") {
                    return (
                      <p className="font-mono text-[10px] text-blue-600 dark:text-blue-400 font-bold mt-1">
                        🎯 GPS Coordinates: {coords.latitude.toFixed(5)}, {coords.longitude.toFixed(5)} ({order.delivery_zone_name || "Delivery Zone"})
                      </p>
                    );
                  }
                  return null;
                })()}
                {(order.delivery_instructions || order.customer?.delivery_instructions) && (
                  <p className="text-xs text-brand-gold-dark dark:text-brand-gold mt-1 italic">
                    💬 Note: &quot;{order.delivery_instructions || order.customer?.delivery_instructions}&quot;
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* Photo Cake Preview Banner */}
          {isPhotoCake && photoUrl && (
            <div className="p-4 bg-gradient-to-r from-brand-navy/10 to-brand-gold/10 dark:from-brand-navy/30 dark:to-brand-navy/30 rounded-xl border border-brand-gold/30">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold uppercase tracking-wider text-brand-navy dark:text-brand-gold flex items-center gap-1.5">
                  📸 Photo Cake Uploaded Image Asset
                </span>
                <button
                  onClick={() => setPhotoZoom(true)}
                  className="text-xs font-semibold text-brand-navy dark:text-brand-gold hover:underline"
                >
                  Zoom & Inspect Preview →
                </button>
              </div>
              <div className="flex gap-4 items-center mt-2">
                <img
                  src={photoUrl}
                  alt="Photo Cake Preview"
                  className="w-20 h-20 rounded-lg object-cover border border-brand-primary/30 shadow-sm cursor-pointer hover:opacity-90 transition"
                  onClick={() => setPhotoZoom(true)}
                />
                <div className="text-xs text-brand-text-muted dark:text-zinc-300">
                  <p className="font-semibold text-brand-navy dark:text-white">Edible Sugar Sheet Print Ready</p>
                  <p className="text-brand-text-muted">Centering: Top surface circular frame</p>
                  <a
                    href={photoUrl}
                    target="_blank"
                    rel="noreferrer"
                    download={`photo-cake-${order.order_number}.jpg`}
                    className="inline-block mt-1 font-semibold text-brand-primary hover:underline"
                  >
                    Download Original High-Res Asset ↗
                  </a>
                </div>
              </div>
            </div>
          )}

          {/* Cake Customization & Specifications */}
          <div className="p-4 bg-brand-surface-muted dark:bg-zinc-950/60 rounded-xl border border-brand-border dark:border-zinc-800">
            <h3 className="text-xs font-bold text-brand-text-muted uppercase tracking-wider mb-3">Cake Customization & Add-ons</h3>
            <div className="space-y-3 text-sm">
              <div className="p-3 bg-white dark:bg-zinc-900 rounded-lg border border-brand-border dark:border-zinc-800">
                <p className="text-xs text-brand-text-muted">Custom Inscription on Cake:</p>
                <p className="font-bold text-brand-primary dark:text-rose-400 italic text-base mt-0.5">
                  &ldquo;{order.customization?.cake_message || order.custom_message || "None (Standard Cake)"}&rdquo;
                </p>
              </div>
              {order.customization?.gift_message && (
                <div className="p-3 bg-white dark:bg-zinc-900 rounded-lg border border-brand-border dark:border-zinc-800">
                  <p className="text-xs text-brand-text-muted">Gift Card Message:</p>
                  <p className="text-xs font-medium text-brand-text dark:text-zinc-300 italic mt-0.5">
                    &ldquo;{order.customization.gift_message}&rdquo;
                  </p>
                </div>
              )}
              <div className="grid grid-cols-2 gap-3 text-xs">
                <div className="p-2.5 bg-white dark:bg-zinc-900 rounded-lg border border-brand-border dark:border-zinc-800">
                  <span className="text-brand-text-muted">Candle Included:</span>
                  <p className="font-semibold text-brand-text dark:text-zinc-200">{order.customization?.candle || "Gold Sparkler Candle"}</p>
                </div>
                <div className="p-2.5 bg-white dark:bg-zinc-900 rounded-lg border border-brand-border dark:border-zinc-800">
                  <span className="text-brand-text-muted">Knife Included:</span>
                  <p className="font-semibold text-brand-text dark:text-zinc-200">{order.customization?.knife || "Premium Wooden Cake Knife"}</p>
                </div>
              </div>
              {order.special_instructions && (
                <div className="p-2.5 bg-brand-gold-light dark:bg-brand-gold-dark/30 rounded-lg border border-brand-gold/40 dark:border-brand-gold-dark/50 text-xs text-brand-gold-dark dark:text-brand-gold">
                  <span className="font-bold">Special Notes: </span>
                  {order.special_instructions}
                </div>
              )}
            </div>
          </div>

          {/* Order Items Table */}
          <div>
            <h3 className="text-xs font-bold text-brand-text-muted uppercase tracking-wider mb-3">Order Items</h3>
            <div className="space-y-2">
              {(order.items || []).map((item: any, idx: number) => (
                <div key={idx} className="p-3 bg-brand-surface-muted dark:bg-zinc-950/60 rounded-xl border border-brand-border dark:border-zinc-800 flex justify-between items-center">
                  <div>
                    <h4 className="font-semibold text-sm text-brand-navy dark:text-white">{item.title || item.name}</h4>
                    <p className="text-xs text-brand-text-muted">
                      Qty: {item.quantity || 1} • Weight: {item.weight || "1.0 kg"} • Flavor: {item.flavor || "Standard"}
                    </p>
                  </div>
                  <span className="font-bold text-sm text-brand-navy dark:text-white">
                    ₹{item.total || (Number(item.quantity || 1) * Number(item.unit_price || 0)) || order.total || 0}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Pricing & GST Breakdown */}
          <div className="p-4 bg-brand-surface-muted dark:bg-zinc-950/60 rounded-xl border border-brand-border dark:border-zinc-800 text-sm space-y-2">
            <div className="flex justify-between text-brand-text-muted dark:text-zinc-400 text-xs">
              <span>Item Subtotal:</span>
              <span>₹{order.pricing?.subtotal || order.subtotal || order.total || 0}</span>
            </div>
            <div className="flex justify-between text-brand-text-muted dark:text-zinc-400 text-xs">
              <span>CGST (2.5%):</span>
              <span>₹{order.pricing?.cgst || "0.00"}</span>
            </div>
            <div className="flex justify-between text-brand-text-muted dark:text-zinc-400 text-xs">
              <span>SGST (2.5%):</span>
              <span>₹{order.pricing?.sgst || "0.00"}</span>
            </div>
            {(order.pricing?.delivery_fee || order.delivery_fee) ? (
              <div className="flex justify-between text-brand-text-muted dark:text-zinc-400 text-xs">
                <span>Delivery Fee:</span>
                <span>₹{order.pricing?.delivery_fee || order.delivery_fee}</span>
              </div>
            ) : null}
            {(order.pricing?.discount_total || order.discount_total) ? (
              <div className="flex justify-between text-emerald-600 dark:text-emerald-400 text-xs">
                <span>Discount:</span>
                <span>-₹{order.pricing?.discount_total || order.discount_total}</span>
              </div>
            ) : null}
            <div className="pt-2 border-t border-brand-border dark:border-zinc-800 flex justify-between font-bold text-brand-navy dark:text-white text-base">
              <span>Total Amount:</span>
              <span className="text-brand-primary dark:text-rose-400">₹{order.pricing?.total || order.total || 0}</span>
            </div>
          </div>

          {/* Kitchen Pickup OTP Card for Store Dispatch */}
          {order.pickup_otp ? (
            <div className="p-4 bg-gradient-to-r from-brand-gold-light to-brand-gold-light dark:from-brand-gold-dark/40 dark:to-brand-gold-dark/40 rounded-xl border border-brand-gold/40 dark:border-brand-gold-dark/60 shadow-sm flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-brand-gold-dark dark:text-brand-gold flex items-center gap-1.5">
                  🔑 Kitchen Pickup OTP (Store Dispatch Handover)
                </span>
                <span className={`px-2 py-0.5 rounded text-[10px] font-mono font-black uppercase ${
                  order.pickup_verified_at || order.status === "out_for_delivery" || order.delivery_status === "in_transit"
                    ? "bg-emerald-200 text-emerald-900 dark:bg-emerald-900 dark:text-emerald-100"
                    : "bg-brand-gold/40 text-brand-gold-dark dark:bg-brand-gold-dark dark:text-brand-gold-light"
                }`}>
                  {order.pickup_verified_at || order.status === "out_for_delivery" || order.delivery_status === "in_transit"
                    ? "✓ Verified by Rider"
                    : "Staff Confidential"}
                </span>
              </div>
              <div className="flex items-center justify-between mt-1">
                <p className="text-xs text-brand-text-muted dark:text-zinc-300">
                  {order.pickup_verified_at || order.status === "out_for_delivery" || order.delivery_status === "in_transit"
                    ? "Handover complete. Order is currently in transit to customer."
                    : "Share this 4-digit code with the delivery rider upon physical package handover:"}
                </p>
                <span className="px-3 py-1 bg-brand-gold text-white font-mono font-black text-lg tracking-widest rounded-lg shadow-sm">
                  {order.pickup_otp}
                </span>
              </div>
            </div>
          ) : (
            <div className="p-3 bg-brand-surface-muted dark:bg-zinc-950/50 rounded-xl border border-brand-border dark:border-zinc-800 text-xs text-brand-text-muted flex items-center justify-between">
              <span>🔑 Kitchen Pickup OTP:</span>
              <span className="font-semibold text-brand-text-muted dark:text-zinc-400">Generated upon &ldquo;Mark Ready for Pickup&rdquo;</span>
            </div>
          )}

          {/* Assigned Delivery Partner Details */}
          <div className="p-4 bg-brand-surface-muted dark:bg-zinc-950/60 rounded-xl border border-brand-border dark:border-zinc-800">
            <div className="flex justify-between items-center mb-2">
              <h3 className="text-xs font-bold text-brand-text-muted uppercase tracking-wider">Delivery Partner</h3>
              <button
                onClick={() => onOpenAssignRider(order)}
                className="text-xs font-semibold text-brand-primary dark:text-rose-400 hover:underline"
              >
                {order.driver_name ? "Reassign Rider →" : "Assign Rider →"}
              </button>
            </div>
            {order.driver_name ? (
              <div className="flex items-center justify-between text-sm">
                <div>
                  <p className="font-semibold text-brand-navy dark:text-white">{order.driver_name}</p>
                  <p className="text-xs text-brand-text-muted">{order.driver_phone || "No phone on file"}</p>
                </div>
                <span className="text-xs px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 font-semibold">
                  {order.delivery_status || "Assigned"}
                </span>
              </div>
            ) : (
              <p className="text-xs text-brand-text-muted italic">No delivery partner assigned yet for this branch delivery.</p>
            )}
          </div>
        </div>

        {/* Footer Actions */}
        <div className="p-4 border-t border-brand-border dark:border-zinc-800 bg-brand-surface-muted dark:bg-zinc-950 flex flex-wrap gap-2 justify-between items-center">
          <div className="flex gap-2">
            <button
              onClick={() => onOpenKot(order)}
              className="px-3 py-2 text-xs font-semibold rounded-lg bg-zinc-200 dark:bg-zinc-800 hover:bg-zinc-300 text-brand-navy dark:text-white transition flex items-center gap-1.5"
            >
              🖨️ Print KOT ({order.kot_reprint_count || 1})
            </button>
            {order.invoice_number && order.invoice_number !== "PENDING_INVOICE" ? (
              <button
                onClick={() => onOpenInvoice(order)}
                className="px-3 py-2 text-xs font-semibold rounded-lg bg-emerald-100 hover:bg-emerald-200 text-emerald-900 border border-emerald-300 dark:bg-emerald-950 dark:text-emerald-300 transition flex items-center gap-1.5"
                id="btn-shop-gst-invoice"
              >
                🧾 GST Invoice
              </button>
            ) : (
              <button
                disabled
                className="px-3 py-2 text-xs font-semibold rounded-lg bg-brand-surface-muted dark:bg-zinc-800 text-brand-text-muted dark:text-zinc-500 border border-brand-border dark:border-zinc-700 cursor-not-allowed opacity-60 flex items-center gap-1.5"
                title="Tax invoice not committed. Only available after statutory generation upon delivery."
                id="btn-shop-gst-invoice-disabled"
              >
                🧾 Invoice Pending
              </button>
            )}
          </div>

          <div className="flex gap-2">
            {order.status === "confirmed" || order.status === "pending" ? (
              <>
                <button
                  disabled={loading}
                  onClick={() => handleAction(() => acceptBranchOrder(order.id), "Order Accepted")}
                  className="px-4 py-2 text-xs font-bold rounded-lg bg-brand-navy hover:bg-brand-primary text-white shadow-sm transition disabled:opacity-50"
                >
                  ✓ Accept Order
                </button>
                <button
                  disabled={loading}
                  onClick={() => setShowRejectInput(true)}
                  className="px-3 py-2 text-xs font-semibold rounded-lg bg-rose-100 dark:bg-rose-950/50 hover:bg-rose-200 text-brand-primary dark:text-rose-300 transition"
                >
                  Reject
                </button>
              </>
            ) : order.status === "kitchen_accepted" || order.status === "preparing" ? (
              <button
                disabled={loading}
                onClick={() => handleAction(() => markBranchOrderReady(order.id), "Marked Ready")}
                className="px-4 py-2 text-xs font-bold rounded-lg bg-brand-primary hover:bg-brand-secondary text-white shadow-sm transition disabled:opacity-50"
              >
                🎂 Mark Ready for Pickup
              </button>
            ) : null}

            <button
              onClick={() => setShowDelayInput(true)}
              className="px-3 py-2 text-xs font-semibold rounded-lg border border-brand-gold/40 text-brand-gold-dark dark:text-brand-gold hover:bg-brand-gold-light dark:hover:bg-brand-gold-dark/50 transition"
            >
              ⏳ Delay Order
            </button>
          </div>
        </div>

        {/* Reject Dialog */}
        {showRejectInput && (
          <div className="p-4 bg-brand-light dark:bg-rose-950/80 border-t border-brand-primary/20 dark:border-rose-900 space-y-2">
            <p className="text-xs font-bold text-rose-800 dark:text-rose-200">State Reason for Rejecting Order:</p>
            <input
              type="text"
              placeholder="e.g., Out of raw materials / Capacity overload"
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              className="w-full text-xs p-2 rounded-lg border border-rose-300 dark:border-rose-800 bg-white dark:bg-zinc-900 text-brand-navy dark:text-white"
            />
            <div className="flex justify-end gap-2">
              <button onClick={() => setShowRejectInput(false)} className="text-xs px-3 py-1 text-brand-text-muted">Cancel</button>
              <button
                disabled={!rejectReason}
                onClick={() => {
                  setShowRejectInput(false);
                  handleAction(() => rejectBranchOrder(order.id, rejectReason));
                }}
                className="text-xs px-3 py-1 bg-brand-navy text-white font-bold rounded-lg disabled:opacity-50"
              >
                Confirm Reject
              </button>
            </div>
          </div>
        )}

        {/* Delay Dialog */}
        {showDelayInput && (
          <div className="p-4 bg-brand-gold-light dark:bg-brand-gold-dark/80 border-t border-brand-gold/40 dark:border-brand-gold-dark space-y-2">
            <p className="text-xs font-bold text-brand-gold-dark dark:text-brand-gold">Delay Notification Details:</p>
            <div className="grid grid-cols-2 gap-2">
              <input
                type="text"
                placeholder="Reason (e.g. Frosting in progress)"
                value={delayReason}
                onChange={(e) => setDelayReason(e.target.value)}
                className="text-xs p-2 rounded-lg border border-brand-gold/40 dark:border-brand-gold-dark bg-white dark:bg-zinc-900 text-brand-navy dark:text-white"
              />
              <select
                value={delayEta}
                onChange={(e) => setDelayEta(e.target.value)}
                className="text-xs p-2 rounded-lg border border-brand-gold/40 dark:border-brand-gold-dark bg-white dark:bg-zinc-900 text-brand-navy dark:text-white"
              >
                <option value="+15 mins">+15 Minutes</option>
                <option value="+30 mins">+30 Minutes</option>
                <option value="+45 mins">+45 Minutes</option>
                <option value="+60 mins">+60 Minutes</option>
              </select>
            </div>
            <div className="flex justify-end gap-2">
              <button onClick={() => setShowDelayInput(false)} className="text-xs px-3 py-1 text-brand-text-muted">Cancel</button>
              <button
                disabled={!delayReason}
                onClick={() => {
                  setShowDelayInput(false);
                  handleAction(() => delayBranchOrder(order.id, delayReason, delayEta));
                }}
                className="text-xs px-3 py-1 bg-brand-gold text-white font-bold rounded-lg disabled:opacity-50"
              >
                Notify Customer of Delay
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Photo Zoom Modal */}
      {photoZoom && (
        <div
          className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4 cursor-pointer"
          onClick={() => setPhotoZoom(false)}
        >
          <div className="relative max-w-2xl bg-white dark:bg-zinc-900 p-2 rounded-2xl shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <img src={photoUrl || ""} alt="Photo Zoom" className="max-h-[80vh] w-auto rounded-xl object-contain" />
            <button
              onClick={() => setPhotoZoom(false)}
              className="absolute top-4 right-4 bg-black/60 text-white w-8 h-8 rounded-full flex items-center justify-center font-bold"
            >
              ✕
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
