"use client";

import { useState, useEffect } from "react";
import { Badge, Button, Input, Label, Text } from "@medusajs/ui";
import {
  X,
  User,
  Phone,
  Mail,
  MapPin,
  Clock,
  Send,
  CheckCircle,
  AlertTriangle,
  Copy,
  Check,
  PhoneCall,
  Percent,
  TrendingUp,
  Package,
  Calendar,
  ExternalLink,
  MessageSquare,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { AbandonedCartRecord, RecoveryEvent, RecoveryCampaign } from "@/lib/cart-recovery/types";

interface RecoveryJourneyDrawerProps {
  cart: AbandonedCartRecord | null;
  isOpen: boolean;
  onClose: () => void;
  onRefresh: () => void;
}

export function RecoveryJourneyDrawer({ cart, isOpen, onClose, onRefresh }: RecoveryJourneyDrawerProps) {
  const [cartDetails, setCartDetails] = useState<any | null>(null);
  const [events, setEvents] = useState<RecoveryEvent[]>([]);
  const [loading, setLoading] = useState(false);
  const [copiedUrl, setCopiedUrl] = useState(false);
  const [selectedChannel, setSelectedChannel] = useState<"WHATSAPP" | "SMS" | "EMAIL">("WHATSAPP");
  const [discountCode, setDiscountCode] = useState("SWEET10");
  const [discountPct, setDiscountPct] = useState(10);
  const [customMessage, setCustomMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  // Conversion / Telecaller modal states
  const [showConvertModal, setShowConvertModal] = useState(false);
  const [convertedOrderId, setConvertedOrderId] = useState("");
  const [convertedRevenue, setConvertedRevenue] = useState("");
  const [showTelecallerModal, setShowTelecallerModal] = useState(false);
  const [telecallerName, setTelecallerName] = useState("Priya Sharma");
  const [telecallerNotes, setTelecallerNotes] = useState("");

  useEffect(() => {
    if (cart && isOpen) {
      setLoading(true);
      setActionSuccess(null);
      setActionError(null);
      fetch(`/api/v1/admin/abandoned-carts/${cart.cart_uid || cart.id}`)
        .then((res) => res.json())
        .then((data) => {
          if (data.cart) setCartDetails(data.cart);
          if (data.events) setEvents(data.events);
        })
        .catch((err) => console.error("Error loading cart details:", err))
        .finally(() => setLoading(false));
    }
  }, [cart, isOpen]);

  if (!isOpen || !cart) return null;

  const currentCart = cartDetails || cart;
  const items = currentCart.items || [];
  const recoveryUrl = typeof window !== "undefined"
    ? `${window.location.origin}/cart/recover/${currentCart.recovery_token || `recov_tok_${currentCart.id}_live`}`
    : `/cart/recover/${currentCart.recovery_token || currentCart.id}`;

  const handleCopyUrl = () => {
    if (typeof navigator !== "undefined" && navigator.clipboard) {
      navigator.clipboard.writeText(recoveryUrl);
      setCopiedUrl(true);
      setTimeout(() => setCopiedUrl(false), 2500);
    }
  };

  const handleSendRecovery = async () => {
    setSubmitting(true);
    setActionSuccess(null);
    setActionError(null);
    try {
      const res = await fetch(`/api/v1/admin/abandoned-carts/${currentCart.id}/send-recovery`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          channel: selectedChannel,
          discount_code: discountCode,
          discount_pct: Number(discountPct),
          custom_message: customMessage || undefined,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setActionSuccess(`Incentive successfully dispatched via ${selectedChannel}!`);
        if (data.cart) setCartDetails(data.cart);
        // Refresh events
        const evRes = await fetch(`/api/v1/admin/abandoned-carts/${currentCart.id}/events`);
        const evData = await evRes.json();
        if (evData.events) setEvents(evData.events);
        onRefresh();
      } else {
        setActionError(data.error || "Failed to dispatch recovery message.");
      }
    } catch (err: any) {
      setActionError(err.message || "Failed to dispatch recovery message.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleAssignTelecaller = async () => {
    setSubmitting(true);
    setActionSuccess(null);
    setActionError(null);
    try {
      const res = await fetch(`/api/v1/admin/abandoned-carts/${currentCart.id}/assign-telecaller`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          staff_id: "staff_priya_01",
          staff_name: telecallerName,
          notes: telecallerNotes,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setActionSuccess(`Opportunity successfully assigned to telecaller ${telecallerName}!`);
        setShowTelecallerModal(false);
        if (data.cart) setCartDetails(data.cart);
        onRefresh();
      } else {
        setActionError(data.error || "Failed to assign telecaller.");
      }
    } catch (err: any) {
      setActionError(err.message || "Failed to assign telecaller.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleMarkConverted = async () => {
    if (!convertedOrderId.trim()) {
      setActionError("Order ID or Order Number is required.");
      return;
    }
    setSubmitting(true);
    setActionSuccess(null);
    setActionError(null);
    try {
      const res = await fetch(`/api/v1/admin/abandoned-carts/${currentCart.id}/mark-converted`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          order_id: convertedOrderId,
          revenue: convertedRevenue ? Number(convertedRevenue) : currentCart.cart_value,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setActionSuccess(`Cart successfully recorded as RECOVERED to order #${convertedOrderId}!`);
        setShowConvertModal(false);
        if (data.cart) setCartDetails(data.cart);
        onRefresh();
      } else {
        setActionError(data.error || "Failed to record conversion.");
      }
    } catch (err: any) {
      setActionError(err.message || "Failed to record conversion.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-hidden bg-black/40 backdrop-blur-xs flex justify-end transition-opacity">
      <div className="w-full max-w-2xl bg-white dark:bg-neutral-900 h-full shadow-2xl flex flex-col border-l border-neutral-200 dark:border-neutral-800 animate-in slide-in-from-right duration-200">
        {/* Top Header */}
        <div className="px-6 py-4 border-b border-neutral-200 dark:border-neutral-800 flex items-center justify-between bg-neutral-50 dark:bg-neutral-950">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base font-bold text-neutral-900 dark:text-white">
                Customer Recovery Journey
              </h2>
              <Badge
                color={
                  currentCart.status === "RECOVERED"
                    ? "green"
                    : currentCart.status === "MESSAGE_SENT"
                    ? "blue"
                    : currentCart.status === "CLICKED"
                    ? "purple"
                    : "orange"
                }
                className="text-xs"
              >
                {currentCart.status}
              </Badge>
            </div>
            <p className="text-xs text-neutral-500 font-mono mt-0.5">
              Cart UID: {currentCart.cart_uid || currentCart.id}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-neutral-400 hover:text-neutral-700 dark:hover:text-white rounded-lg hover:bg-neutral-200 dark:hover:bg-neutral-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {actionSuccess && (
            <div className="p-3 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 rounded-lg text-xs text-emerald-800 dark:text-emerald-300 flex items-center gap-2">
              <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>{actionSuccess}</span>
            </div>
          )}

          {actionError && (
            <div className="p-3 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 rounded-lg text-xs text-rose-800 dark:text-rose-300 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
              <span>{actionError}</span>
            </div>
          )}

          {/* Section 1: Customer Profile 360 */}
          <div className="bg-neutral-50 dark:bg-neutral-800/50 p-4 rounded-xl border border-neutral-200 dark:border-neutral-700/60">
            <h3 className="text-xs font-bold uppercase tracking-wider text-neutral-500 mb-3 flex items-center gap-1.5">
              <User className="w-3.5 h-3.5 text-primary-600" /> Customer Information
            </h3>
            <div className="grid grid-cols-2 gap-3 text-xs">
              <div>
                <span className="text-neutral-400 block">Name</span>
                <span className="font-semibold text-neutral-900 dark:text-white text-sm">
                  {currentCart.customer_name || "Guest Customer"}
                </span>
              </div>
              <div>
                <span className="text-neutral-400 block">Phone / WhatsApp</span>
                <span className="font-semibold text-neutral-900 dark:text-white font-mono">
                  {currentCart.phone || "—"}
                </span>
              </div>
              <div>
                <span className="text-neutral-400 block">Email</span>
                <span className="text-neutral-700 dark:text-neutral-300">
                  {currentCart.email || "No email captured"}
                </span>
              </div>
              <div>
                <span className="text-neutral-400 block">Hub / Branch</span>
                <span className="text-neutral-700 dark:text-neutral-300">
                  {currentCart.branch_name || "—"} {currentCart.city ? `(${currentCart.city})` : ""}
                </span>
              </div>
            </div>
          </div>

          {/* Section 2: Abandoned Items & Live Cart Value */}
          <div className="border border-neutral-200 dark:border-neutral-800 rounded-xl overflow-hidden">
            <div className="px-4 py-3 bg-neutral-50 dark:bg-neutral-950 border-b border-neutral-200 dark:border-neutral-800 flex items-center justify-between">
              <h3 className="text-xs font-bold uppercase tracking-wider text-neutral-500 flex items-center gap-1.5">
                <Package className="w-3.5 h-3.5 text-brand-gold" /> Cart Products ({items.length})
              </h3>
              <span className="text-xs font-bold text-neutral-900 dark:text-white">
                Total: ₹{Number(currentCart.cart_value || 0).toLocaleString("en-IN")}
              </span>
            </div>
            <div className="divide-y divide-neutral-100 dark:divide-neutral-800">
              {items.map((item: any, idx: number) => (
                <div key={idx} className="p-3.5 flex items-center justify-between text-xs">
                  <div className="flex items-center gap-3">
                    {item.thumbnail ? (
                      <img
                        src={item.thumbnail}
                        alt={item.title || "Cake"}
                        className="w-10 h-10 object-cover rounded-md border border-neutral-200 dark:border-neutral-700"
                      />
                    ) : (
                      <div className="w-10 h-10 bg-neutral-100 dark:bg-neutral-800 rounded-md flex items-center justify-center text-neutral-400">
                        <Package className="w-5 h-5" />
                      </div>
                    )}
                    <div>
                      <p className="font-semibold text-neutral-900 dark:text-white">
                        {item.title || item.name || "Gourmet Cake"}
                      </p>
                      <p className="text-neutral-400 text-[11px]">
                        Qty: {item.quantity || 1} &bull; ₹{item.unit_price || item.price} each
                        {item.cake_message && ` &bull; Msg: "${item.cake_message}"`}
                      </p>
                    </div>
                  </div>
                  <span className="font-semibold text-neutral-900 dark:text-white">
                    ₹{(Number(item.total_price || item.subtotal || ((Number(item.unit_price || item.price) || 0) * (Number(item.quantity) || 1))) || 0).toLocaleString("en-IN")}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Section 3: Direct Recovery Message Dispatcher */}
          <div className="bg-gradient-to-br from-brand-gold/5 to-primary-500/5 border border-brand-gold/60 dark:border-brand-gold-dark/40 p-4 rounded-xl space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold uppercase tracking-wider text-brand-gold-dark dark:text-brand-gold/40 flex items-center gap-1.5">
                <Send className="w-3.5 h-3.5 text-brand-gold" /> Send Recovery Incentive
              </h3>
              <div className="flex items-center gap-1.5">
                {(["WHATSAPP", "SMS", "EMAIL"] as const).map((ch) => (
                  <button
                    key={ch}
                    onClick={() => setSelectedChannel(ch)}
                    className={`px-2.5 py-1 text-[11px] font-semibold rounded-md transition-colors ${
                      selectedChannel === ch
                        ? "bg-brand-gold text-white"
                        : "bg-white dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400 border border-neutral-200 dark:border-neutral-700"
                    }`}
                  >
                    {ch}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-[11px] text-neutral-500">Discount Coupon Code</Label>
                <Input
                  size="small"
                  value={discountCode}
                  onChange={(e) => setDiscountCode(e.target.value)}
                  placeholder="SWEET10"
                  className="font-mono text-xs"
                />
              </div>
              <div>
                <Label className="text-[11px] text-neutral-500">Discount Percentage (%)</Label>
                <Input
                  size="small"
                  type="number"
                  value={discountPct}
                  onChange={(e) => setDiscountPct(Number(e.target.value))}
                  placeholder="10"
                  className="text-xs"
                />
              </div>
            </div>

            <div>
              <Label className="text-[11px] text-neutral-500">Custom Message (Optional)</Label>
              <textarea
                value={customMessage}
                onChange={(e) => setCustomMessage(e.target.value)}
                placeholder={`Hi ${currentCart.customer_name}! Your freshly baked order is reserved. Use code ${discountCode} for ${discountPct}% off...`}
                className="w-full h-16 text-xs p-2 rounded-lg border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-neutral-900 dark:text-white resize-none"
              />
            </div>

            <div className="flex items-center justify-between pt-1">
              <Button
                size="small"
                variant="secondary"
                onClick={handleCopyUrl}
                className="text-xs flex items-center gap-1.5"
              >
                {copiedUrl ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                {copiedUrl ? "Copied Link!" : "Copy Recovery Link"}
              </Button>
              <Button
                size="small"
                variant="primary"
                onClick={handleSendRecovery}
                disabled={submitting}
                className="text-xs bg-brand-gold hover:bg-brand-gold-dark text-white flex items-center gap-1.5"
              >
                <Send className="w-3.5 h-3.5" />
                {submitting ? "Dispatching..." : `Dispatch ${selectedChannel}`}
              </Button>
            </div>
          </div>

          {/* Section 4: Operational Telecaller & Manual Conversion Actions */}
          <div className="flex items-center gap-3">
            <Button
              size="small"
              variant="secondary"
              onClick={() => setShowTelecallerModal(true)}
              className="flex-1 text-xs flex items-center justify-center gap-1.5"
            >
              <PhoneCall className="w-3.5 h-3.5 text-blue-600" /> Assign Telecaller
            </Button>
            <Button
              size="small"
              variant="secondary"
              onClick={() => setShowConvertModal(true)}
              className="flex-1 text-xs flex items-center justify-center gap-1.5"
            >
              <CheckCircle className="w-3.5 h-3.5 text-emerald-600" /> Mark Converted
            </Button>
          </div>

          {/* Section 5: Timeline & Recovery Events History */}
          <div className="border-t border-neutral-200 dark:border-neutral-800 pt-4 space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-neutral-500 flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-neutral-400" /> Recovery Timeline & Event Log
            </h3>
            {events.length === 0 ? (
              <p className="text-xs text-neutral-400 italic">No previous recovery attempts logged.</p>
            ) : (
              <div className="space-y-3">
                {events.map((ev) => (
                  <div
                    key={ev.id}
                    className="p-3 bg-neutral-50 dark:bg-neutral-800/40 rounded-lg border border-neutral-200 dark:border-neutral-800 text-xs space-y-1"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-neutral-900 dark:text-white capitalize">
                        {ev.event_type.replace(/\./g, " ")} ({ev.channel})
                      </span>
                      <span className="text-[11px] text-neutral-400">
                        {new Date(ev.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })} &bull;{" "}
                        {new Date(ev.created_at).toLocaleDateString()}
                      </span>
                    </div>
                    <p className="text-neutral-600 dark:text-neutral-300 text-[11px]">{ev.message}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Telecaller Modal Sub-overlay */}
        {showTelecallerModal && (
          <div className="absolute inset-0 bg-black/50 z-20 flex items-center justify-center p-4">
            <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl p-5 w-full max-w-md shadow-2xl space-y-4">
              <h4 className="text-sm font-bold text-neutral-900 dark:text-white flex items-center gap-2">
                <PhoneCall className="w-4 h-4 text-blue-600" /> Assign High-Value Lead
              </h4>
              <div className="space-y-3">
                <div>
                  <Label className="text-xs">Telecaller Staff</Label>
                  <select
                    value={telecallerName}
                    onChange={(e) => setTelecallerName(e.target.value)}
                    className="w-full p-2 text-xs border border-neutral-200 dark:border-neutral-700 rounded-lg bg-white dark:bg-neutral-800"
                  >
                    <option value="Priya Sharma">Priya Sharma (Top Converter - Bengaluru)</option>
                    <option value="Karan Patel">Karan Patel (VIP Specialist)</option>
                    <option value="Sneha Rao">Sneha Rao (Evening Shift)</option>
                  </select>
                </div>
                <div>
                  <Label className="text-xs">Notes / Talking Points</Label>
                  <textarea
                    value={telecallerNotes}
                    onChange={(e) => setTelecallerNotes(e.target.value)}
                    placeholder="Offer complimentary candle pack or 15% discount for same-day delivery."
                    className="w-full h-16 p-2 text-xs border border-neutral-200 dark:border-neutral-700 rounded-lg bg-white dark:bg-neutral-800"
                  />
                </div>
              </div>
              <div className="flex items-center justify-end gap-2 pt-2">
                <Button size="small" variant="secondary" onClick={() => setShowTelecallerModal(false)}>
                  Cancel
                </Button>
                <Button size="small" variant="primary" onClick={handleAssignTelecaller} disabled={submitting}>
                  Assign Opportunity
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* Manual Convert Modal Sub-overlay */}
        {showConvertModal && (
          <div className="absolute inset-0 bg-black/50 z-20 flex items-center justify-center p-4">
            <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl p-5 w-full max-w-md shadow-2xl space-y-4">
              <h4 className="text-sm font-bold text-neutral-900 dark:text-white flex items-center gap-2">
                <CheckCircle className="w-4 h-4 text-emerald-600" /> Record Offline / Converted Order
              </h4>
              <div className="space-y-3">
                <div>
                  <Label className="text-xs">Order Number / ID *</Label>
                  <Input
                    size="small"
                    value={convertedOrderId}
                    onChange={(e) => setConvertedOrderId(e.target.value)}
                    placeholder="CTH-20260819-102"
                  />
                </div>
                <div>
                  <Label className="text-xs">Converted Revenue (₹)</Label>
                  <Input
                    size="small"
                    type="number"
                    value={convertedRevenue}
                    onChange={(e) => setConvertedRevenue(e.target.value)}
                    placeholder={String(currentCart.cart_value || "1299")}
                  />
                </div>
              </div>
              <div className="flex items-center justify-end gap-2 pt-2">
                <Button size="small" variant="secondary" onClick={() => setShowConvertModal(false)}>
                  Cancel
                </Button>
                <Button
                  size="small"
                  variant="primary"
                  onClick={handleMarkConverted}
                  disabled={submitting}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white"
                >
                  Confirm Conversion
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
