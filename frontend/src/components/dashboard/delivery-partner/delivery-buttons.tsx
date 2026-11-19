"use client";

import { useState } from "react";
import {
  passDelivery,
  proceedDelivery,
  reportDeliveryException,
} from "@frontend/lib/actions";
import { apiClient } from "@frontend/lib/api-client";
import { DeliveryDTO, DeliveryStatus, DeliveryPartnerDTO } from "@frontend/lib/types";
import { Button, Input, Label } from "@medusajs/ui";
import { Key, CheckCircle, Navigation, Phone, AlertTriangle, Truck, MapPin, ShieldAlert } from "lucide-react";
import { buildGoogleMapsDirectionsUrl, extractDeliveryCoordinates } from "@frontend/lib/location/directions";

export default function DeliveryPartnerDeliveryButtons({
  delivery,
  delivery_partner,
}: {
  delivery: DeliveryDTO;
  delivery_partner: DeliveryPartnerDTO;
}) {
  const [proceedIsLoading, setProceedIsLoading] = useState(false);
  const [declineIsLoading, setDeclineIsLoading] = useState(false);
  const [showPickupModal, setShowPickupModal] = useState(false);
  const [showCustomerOtpModal, setShowCustomerOtpModal] = useState(false);
  const [showExceptionModal, setShowExceptionModal] = useState(false);

  const [pickupOtpInput, setPickupOtpInput] = useState("");
  const [customerOtpInput, setCustomerOtpInput] = useState("");
  const [otpError, setOtpError] = useState("");
  const [actionError, setActionError] = useState("");

  const [exceptionType, setExceptionType] = useState("ADDRESS_NOT_FOUND");
  const [exceptionDesc, setExceptionDesc] = useState("");
  const [exceptionSuccess, setExceptionSuccess] = useState(false);

  const handleProceedDelivery = async () => {
    setActionError("");
    setProceedIsLoading(true);
    const res = await proceedDelivery(delivery, delivery_partner.id);
    setProceedIsLoading(false);
    if (res && res.success === false) {
      setActionError(res.error || "Failed to accept delivery job");
      return;
    }
    window.location.reload();
  };

  const handleDeclineDelivery = async () => {
    setActionError("");
    setDeclineIsLoading(true);
    const res = await passDelivery(delivery.id, delivery_partner.id);
    setDeclineIsLoading(false);
    if (res && res.success === false) {
      setActionError(res.error || "Failed to decline delivery job");
      return;
    }
    window.location.reload();
  };

  const handleVerifyPickupOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setOtpError("");
    setProceedIsLoading(true);

    const targetOrderId = (delivery as any).order_id || delivery.id;
    try {
      const res = await apiClient.verifyPickupOtp(targetOrderId, pickupOtpInput, delivery_partner.id);
      setProceedIsLoading(false);

      if (res && (res.success || res.already_verified)) {
        setShowPickupModal(false);
        setPickupOtpInput("");
        window.location.reload();
        return;
      }

      setOtpError(res?.error || "Invalid Kitchen Pickup OTP code. Verification failed.");
    } catch (err: any) {
      setProceedIsLoading(false);
      setOtpError(err?.message || "Invalid Kitchen Pickup OTP code. Verification failed.");
    }
  };

  const handleVerifyCustomerOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setOtpError("");
    setProceedIsLoading(true);

    const targetOrderId = (delivery as any).order_id || delivery.id;
    try {
      const res = await apiClient.verifyCustomerOtp(targetOrderId, customerOtpInput, delivery_partner.id);
      setProceedIsLoading(false);

      if (res && (res.success || res.already_verified)) {
        setShowCustomerOtpModal(false);
        setCustomerOtpInput("");
        window.location.reload();
        return;
      }

      setOtpError(res?.error || "Invalid Customer Delivery OTP code. Verification failed.");
    } catch (err: any) {
      setProceedIsLoading(false);
      setOtpError(err?.message || "Invalid Customer Delivery OTP code. Verification failed.");
    }
  };

  const handleReportException = async (e: React.FormEvent) => {
    e.preventDefault();
    setProceedIsLoading(true);
    const res = await reportDeliveryException(delivery.id, delivery_partner.id, exceptionType, exceptionDesc);
    setProceedIsLoading(false);
    if (res && res.success) {
      setExceptionSuccess(true);
      setTimeout(() => {
        setShowExceptionModal(false);
        setExceptionSuccess(false);
        window.location.reload();
      }, 1000);
    } else {
      alert(res?.error || "Unable to report exception.");
    }
  };

  const openGoogleMaps = () => {
    const coords = extractDeliveryCoordinates(delivery);
    const url = buildGoogleMapsDirectionsUrl({
      latitude: coords.latitude,
      longitude: coords.longitude,
      address: delivery.recipient_address || delivery.order?.delivery_address || delivery.order?.shipping_address?.address_1,
      pincode: delivery.recipient_pincode || delivery.order?.delivery_pincode || delivery.order?.pincode,
    });
    window.open(url, "_blank", "noopener,noreferrer");
  };

  const customerPhone = String(delivery.recipient_phone || delivery.order?.shipping_address?.phone || "").trim();
  const callCustomer = () => {
    if (customerPhone) window.location.href = `tel:${customerPhone.replace(/\s+/g, "")}`;
  };

  const d: any = delivery;
  const pickup = d.pickup as { name?: string; address?: string; latitude?: number | null; longitude?: number | null } | null;
  const openKitchenDirections = () => {
    const url = buildGoogleMapsDirectionsUrl({ latitude: pickup?.latitude, longitude: pickup?.longitude, address: pickup?.address || pickup?.name });
    window.open(url, "_blank", "noopener,noreferrer");
  };
  const hasPickupLocation = Boolean(pickup && ((pickup.latitude && pickup.longitude) || pickup.address));
  const isCod = Boolean(d.is_cod);
  const codAmount = Number(d.cod_amount || 0);
  const [qr, setQr] = useState<{ svg: string; expires_at: string } | null>(null);
  const [qrLoading, setQrLoading] = useState(false);
  const showHandoffQr = async () => {
    setActionError("");
    setQrLoading(true);
    try {
      const r = await fetch(`/api/v1/rider/jobs/${encodeURIComponent(String(delivery.order_id || delivery.id))}/handoff-qr`, {
        method: "POST",
        credentials: "same-origin",
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok || !j.success) throw new Error(j.error || `HTTP ${r.status}`);
      setQr({ svg: j.qr_svg, expires_at: j.expires_at });
    } catch (e: any) {
      setActionError(e.message);
    } finally {
      setQrLoading(false);
    }
  };
  const [codCollected, setCodCollected] = useState<boolean>(Boolean(d.cod_collected));
  const [codLoading, setCodLoading] = useState(false);
  const confirmCashCollected = async () => {
    if (!window.confirm(`Confirm you collected ₹${codAmount.toFixed(2)} in cash for this order?`)) return;
    setActionError("");
    setCodLoading(true);
    try {
      const r = await fetch("/api/v1/rider/cod/collect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ order_id: delivery.order_id || delivery.id, amount: codAmount }),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok || !j.success) throw new Error(j.message || j.error || `HTTP ${r.status}`);
      setCodCollected(true);
    } catch (e: any) {
      setActionError(e.message);
    } finally {
      setCodLoading(false);
    }
  };

  return (
    <div className="flex flex-col items-end gap-1.5">
      {actionError && (
        <span className="text-[11px] font-bold text-rose-600 bg-rose-50 dark:bg-rose-950/50 border border-rose-200 px-2 py-0.5 rounded">
          ⚠️ {actionError}
        </span>
      )}
      <div className="flex items-center gap-2 flex-wrap justify-end">
        {/* ── AVAILABLE JOBS ────────────────────────────────────────── */}
        {delivery.delivery_status === DeliveryStatus.SHOP_ACCEPTED && (
          <>
            <Button variant="transparent" size="small" onClick={handleDeclineDelivery} isLoading={declineIsLoading}>
              Decline
            </Button>
            <Button variant="primary" size="small" onClick={handleProceedDelivery} isLoading={proceedIsLoading} className="bg-rose-600 hover:bg-rose-700 text-white">
              Claim Job
            </Button>
          </>
        )}

      {/* ── CLAIMED (kitchen preparing) ────────────────────────────── */}
      {(delivery.delivery_status === DeliveryStatus.PICKUP_CLAIMED || delivery.delivery_status === DeliveryStatus.SHOP_PREPARING) && hasPickupLocation && (
        <Button variant="secondary" size="small" onClick={openKitchenDirections} className="flex items-center gap-1 text-xs">
          <Navigation className="w-3.5 h-3.5" /> Directions to kitchen
        </Button>
      )}

      {/* ── READY FOR PICKUP ───────────────────────────────────────── */}
      {delivery.delivery_status === DeliveryStatus.READY_FOR_PICKUP && (
        <>
          {hasPickupLocation && (
            <Button variant="secondary" size="small" onClick={openKitchenDirections} className="flex items-center gap-1 text-xs">
              <Navigation className="w-3.5 h-3.5" /> Directions to kitchen
            </Button>
          )}
          <Button
            variant="primary"
            size="small"
            onClick={() => setShowPickupModal(true)}
            className="bg-brand-gold hover:bg-brand-gold-dark text-white flex items-center gap-1"
          >
            <Key className="w-3.5 h-3.5" /> Verify Pickup OTP
          </Button>
        </>
      )}

      {/* ── CASH ON DELIVERY ───────────────────────────────────────── */}
      {isCod && codAmount > 0 && delivery.delivery_status === DeliveryStatus.IN_TRANSIT && (
        <span className="w-full text-right text-sm font-bold text-amber-700 dark:text-amber-400">Collect ₹{codAmount.toFixed(2)} cash</span>
      )}
      {isCod && codAmount > 0 && delivery.delivery_status === DeliveryStatus.DELIVERED && (
        codCollected ? (
          <span className="text-xs font-semibold text-emerald-700">Cash ₹{codAmount.toFixed(2)} recorded</span>
        ) : (
          <Button variant="primary" size="small" onClick={confirmCashCollected} isLoading={codLoading} className="bg-amber-600 hover:bg-amber-700 text-white">
            Confirm ₹{codAmount.toFixed(2)} cash collected
          </Button>
        )
      )}

      {/* ── IN TRANSIT / OUT FOR DELIVERY ──────────────────────────── */}
      {delivery.delivery_status === DeliveryStatus.IN_TRANSIT && (
        <>
          <Button
            variant="primary"
            size="small"
            onClick={openGoogleMaps}
            className="bg-blue-600 hover:bg-blue-700 text-white font-extrabold flex items-center gap-1 text-xs shadow-sm"
            data-testid="rider-get-directions-btn"
          >
            <Navigation className="w-3.5 h-3.5" /> Directions to customer
          </Button>
          {customerPhone && (
            <Button variant="secondary" size="small" onClick={callCustomer} className="flex items-center gap-1 text-xs">
              <Phone className="w-3.5 h-3.5 text-emerald-600" /> Call
            </Button>
          )}
          <Button variant="transparent" size="small" onClick={() => setShowExceptionModal(true)} className="text-xs text-rose-600 hover:bg-rose-50">
            <AlertTriangle className="w-3.5 h-3.5 mr-1" /> Issue
          </Button>
          <Button variant="secondary" size="small" onClick={showHandoffQr} isLoading={qrLoading} className="text-xs">
            Show QR to receiver
          </Button>
          <Button
            variant="primary"
            size="small"
            onClick={() => setShowCustomerOtpModal(true)}
            className="bg-emerald-600 hover:bg-emerald-700 text-white flex items-center gap-1"
          >
            <CheckCircle className="w-3.5 h-3.5" /> Enter Customer OTP
          </Button>
        </>
      )}
      </div>

      {/* ── HANDOFF QR (receiver scans, signs in, confirms safe receipt, reads code) ── */}
      {qr && (
        <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4" onClick={() => setQr(null)}>
          <div className="bg-white rounded-2xl p-5 w-full max-w-sm flex flex-col items-center gap-3" onClick={(e) => e.stopPropagation()}>
            <div className="text-base font-semibold text-slate-900">Ask the receiver to scan</div>
            {/* QR is an SVG generated on our server by the qrcode library */}
            <div className="w-64 h-64 [&_svg]:w-full [&_svg]:h-full" dangerouslySetInnerHTML={{ __html: qr.svg }} />
            <p className="text-xs text-slate-600 text-center">
              They sign in with their phone, confirm the cake arrived safely, then read you the delivery code. Valid until {new Date(qr.expires_at).toLocaleTimeString()}.
            </p>
            <div className="flex gap-2 w-full">
              <button type="button" onClick={() => setQr(null)} className="flex-1 min-h-[44px] rounded-lg border border-slate-300 text-sm">Close</button>
              <button type="button" onClick={() => { setQr(null); setShowCustomerOtpModal(true); }} className="flex-1 min-h-[44px] rounded-lg bg-emerald-600 text-white text-sm font-semibold">Enter code</button>
            </div>
          </div>
        </div>
      )}

      {/* ── PICKUP OTP MODAL ────────────────────────────────────────── */}
      {showPickupModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-ui-bg-base border border-ui-border-base rounded-2xl p-6 max-w-md w-full shadow-2xl flex flex-col gap-4">
            <div className="flex items-center justify-between pb-3 border-b border-ui-border-base">
              <div className="flex items-center gap-2">
                <Truck className="w-5 h-5 text-brand-gold" />
                <span className="font-bold text-base text-ui-fg-base">Kitchen Pickup OTP Verification</span>
              </div>
              <button onClick={() => setShowPickupModal(false)} className="text-ui-fg-muted hover:text-ui-fg-base text-sm font-bold">✕</button>
            </div>
            <p className="text-xs text-ui-fg-subtle">
              Request the 4-digit Kitchen Pickup OTP from the bakery manager at store dispatch.
            </p>
            {otpError && (
              <div className="p-2.5 bg-rose-50 border border-rose-200 text-rose-700 rounded-lg text-xs font-semibold">
                ⚠️ {otpError}
              </div>
            )}
            <form onSubmit={handleVerifyPickupOtp} className="flex flex-col gap-3">
              <div className="flex flex-col gap-1">
                <Label className="text-xs font-semibold">4-Digit Pickup PIN</Label>
                <Input
                  type="text"
                  placeholder="e.g. 1294"
                  maxLength={6}
                  value={pickupOtpInput}
                  onChange={(e) => setPickupOtpInput(e.target.value)}
                  className="text-center font-mono text-lg tracking-widest"
                  autoFocus
                  required
                />
              </div>
              <div className="flex justify-end gap-2 mt-2">
                <Button type="button" variant="secondary" onClick={() => setShowPickupModal(false)}>Cancel</Button>
                <Button type="submit" variant="primary" isLoading={proceedIsLoading} className="bg-brand-gold hover:bg-brand-gold-dark text-white">
                  Verify & Start Delivery
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── CUSTOMER OTP MODAL ──────────────────────────────────────── */}
      {showCustomerOtpModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-ui-bg-base border border-ui-border-base rounded-2xl p-6 max-w-md w-full shadow-2xl flex flex-col gap-4">
            <div className="flex items-center justify-between pb-3 border-b border-ui-border-base">
              <div className="flex items-center gap-2">
                <CheckCircle className="w-5 h-5 text-emerald-600" />
                <span className="font-bold text-base text-ui-fg-base">Customer Delivery Completion OTP</span>
              </div>
              <button onClick={() => setShowCustomerOtpModal(false)} className="text-ui-fg-muted hover:text-ui-fg-base text-sm font-bold">✕</button>
            </div>
            <p className="text-xs text-ui-fg-subtle">
              Ask recipient <strong className="text-ui-fg-base">{delivery.recipient_name}</strong> for their 4-digit Delivery OTP code sent to their phone.
            </p>
            {otpError && (
              <div className="p-2.5 bg-rose-50 border border-rose-200 text-rose-700 rounded-lg text-xs font-semibold">
                ⚠️ {otpError}
              </div>
            )}
            <form onSubmit={handleVerifyCustomerOtp} className="flex flex-col gap-3">
              <div className="flex flex-col gap-1">
                <Label className="text-xs font-semibold">4-Digit Delivery PIN</Label>
                <Input
                  type="text"
                  placeholder="e.g. 4819"
                  maxLength={6}
                  value={customerOtpInput}
                  onChange={(e) => setCustomerOtpInput(e.target.value)}
                  className="text-center font-mono text-lg tracking-widest"
                  autoFocus
                  required
                />
              </div>
              <div className="flex justify-end gap-2 mt-2">
                <Button type="button" variant="secondary" onClick={() => setShowCustomerOtpModal(false)}>Cancel</Button>
                <Button type="submit" variant="primary" isLoading={proceedIsLoading} className="bg-emerald-600 hover:bg-emerald-700 text-white">
                  Verify & Mark Delivered
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── EXCEPTION REPORT MODAL ───────────────────────────────────── */}
      {showExceptionModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-ui-bg-base border border-ui-border-base rounded-2xl p-6 max-w-md w-full shadow-2xl flex flex-col gap-4">
            <div className="flex items-center justify-between pb-3 border-b border-ui-border-base">
              <div className="flex items-center gap-2">
                <ShieldAlert className="w-5 h-5 text-rose-600" />
                <span className="font-bold text-base text-ui-fg-base">Report Delivery Issue</span>
              </div>
              <button onClick={() => setShowExceptionModal(false)} className="text-ui-fg-muted hover:text-ui-fg-base text-sm font-bold">✕</button>
            </div>
            {exceptionSuccess ? (
              <div className="p-4 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl text-center font-bold text-sm">
                ✅ Exception Reported to Branch Manager & Dispatch Admin!
              </div>
            ) : (
              <form onSubmit={handleReportException} className="flex flex-col gap-3">
                <div className="flex flex-col gap-1">
                  <Label className="text-xs font-semibold">Issue Category</Label>
                  <select
                    value={exceptionType}
                    onChange={(e) => setExceptionType(e.target.value)}
                    className="w-full bg-ui-bg-subtle border border-ui-border-base rounded-lg p-2 text-xs font-medium text-ui-fg-base"
                  >
                    <option value="CUSTOMER_NOT_AVAILABLE">Customer Not Available / Unreachable</option>
                    <option value="WRONG_ADDRESS">Incorrect / Untraceable Delivery Address</option>
                    <option value="CAKE_DAMAGED">Cake Damaged in Transit</option>
                    <option value="CUSTOMER_REFUSED">Customer Refused Delivery</option>
                    <option value="VEHICLE_BREAKDOWN">Vehicle / Fleet Breakdown</option>
                    <option value="STORE_PREPARATION_DELAY">Store Preparation Delay</option>
                    <option value="OTHER">Other Delivery Issue</option>
                  </select>
                </div>
                <div className="flex flex-col gap-1">
                  <Label className="text-xs font-semibold">Issue Description & Notes</Label>
                  <textarea
                    rows={3}
                    placeholder="Provide details about the issue..."
                    value={exceptionDesc}
                    onChange={(e) => setExceptionDesc(e.target.value)}
                    className="w-full bg-ui-bg-subtle border border-ui-border-base rounded-lg p-2 text-xs font-medium text-ui-fg-base"
                    required
                  />
                </div>
                <div className="flex justify-end gap-2 mt-2">
                  <Button type="button" variant="secondary" onClick={() => setShowExceptionModal(false)}>Cancel</Button>
                  <Button type="submit" variant="primary" isLoading={proceedIsLoading} className="bg-rose-600 hover:bg-rose-700 text-white">
                    Report Issue
                  </Button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
