"use client";

import { placeOrder } from "@frontend/lib/actions";
import { apiClient } from "@frontend/lib/api-client";
import { HttpTypes } from "@medusajs/types";
import { Badge, Button, Heading, Input, Label, Text, Textarea } from "@medusajs/ui";
import { useFormState, useFormStatus } from "react-dom";
import { useState, useEffect, useRef, useCallback } from "react";
import { ErrorComponent } from "@frontend/components/common/error-component";
import { OrderSummary, OrderSummaryPricing } from "./order-summary";

const AVAILABLE_PICKUP_BRANCHES = [
  {
    id: "br_indiranagar",
    name: "Indiranagar Flagship Kitchen",
    address: "100 Feet Rd, Indiranagar, Bengaluru",
    pincode: "560038",
    timing: "09:00 AM - 11:00 PM",
    is_open: true,
  },
  {
    id: "br_koramangala",
    name: "Koramangala Main Hub",
    address: "80 Feet Rd, 4th Block, Koramangala, Bengaluru",
    pincode: "560034",
    timing: "09:00 AM - 11:30 PM",
    is_open: true,
  },
  {
    id: "br_hsr",
    name: "HSR Layout Express Studio",
    address: "27th Main Rd, Sector 1, HSR Layout, Bengaluru",
    pincode: "560102",
    timing: "09:00 AM - 11:00 PM",
    is_open: true,
  },
  {
    id: "br_whitefield",
    name: "Whitefield Gourmet Hub",
    address: "ITPL Main Rd, Whitefield, Bengaluru",
    pincode: "560066",
    timing: "09:00 AM - 10:30 PM",
    is_open: true,
  },
];

function Submit({ disabled }: { disabled?: boolean }) {
  const status = useFormStatus();

  return (
    <Button
      type="submit"
      size="large"
      className="w-full sm:w-auto mt-6 bg-rose-600 hover:bg-rose-700 text-white font-bold px-8 py-3 rounded-xl shadow-lg shadow-rose-600/20"
      isLoading={status.pending}
      disabled={disabled}
      aria-label="Confirm and place your cake order"
    >
      Place Order Now 🎂
    </Button>
  );
}

export default function CheckoutForm({ cart }: { cart: HttpTypes.StoreCart }) {
  const [state, action] = useFormState(placeOrder, { message: "" });
  const [zip, setZip] = useState(cart.shipping_address?.postal_code || "560001");
  const [checking, setChecking] = useState(false);
  
  // Delivery type selection (Delivery vs Branch Pickup)
  const [deliveryType, setDeliveryType] = useState<"delivery" | "pickup">("delivery");
  const [selectedBranchId, setSelectedBranchId] = useState<string>("br_indiranagar");

  // Step state: 1 = Contact & Occasion, 2 = Fulfillment & Schedule, 3 = Payment & Finalize
  const [step, setStep] = useState<1 | 2 | 3>(1);

  // References for focus management
  const firstNameRef = useRef<HTMLInputElement>(null);
  const zipInputRef = useRef<HTMLInputElement>(null);
  const notesRef = useRef<HTMLTextAreaElement>(null);

  // Contact fields
  const [firstName, setFirstName] = useState("Ananya");
  const [lastName, setLastName] = useState("Sharma");
  const [phone, setPhone] = useState("+91 98765 43210");
  const [email, setEmail] = useState("ananya.sharma@example.com");

  // Address fields
  const [address, setAddress] = useState("Flat 402, Signature Towers, 12th Main Road");
  const [city, setCity] = useState("");

  // Gifting & Recipient State
  const [orderedForSelf, setOrderedForSelf] = useState<boolean>(true);
  const [recipientName, setRecipientName] = useState<string>("");
  const [recipientPhone, setRecipientPhone] = useState<string>("");
  const [recipientAltPhone, setRecipientAltPhone] = useState<string>("");
  const [recipientLandmark, setRecipientLandmark] = useState<string>("");
  const [deliveryInstructions, setDeliveryInstructions] = useState<string>("");
  const [giftWrap, setGiftWrap] = useState<boolean>(false);
  const [giftMessage, setGiftMessage] = useState<string>("");
  const [anonymousDelivery, setAnonymousDelivery] = useState<boolean>(false);
  const [hideInvoice, setHideInvoice] = useState<boolean>(true);
  const [occasion, setOccasion] = useState<string>("birthday");

  // Coupons / Promo
  const [giftCardCodeInput, setGiftCardCodeInput] = useState<string>("");
  const [appliedCouponCode, setAppliedCouponCode] = useState<string>("");
  const [couponDiscount, setCouponDiscount] = useState<number>(0);
  const [couponError, setCouponError] = useState<string>("");
  const [couponSuccess, setCouponSuccess] = useState<string>("");
  const [paymentMethod, setPaymentMethod] = useState<"cod" | "razorpay" | "test_mode">("cod");

  // Availability, Dates, Slots & Real-time Pricing State
  const [availability, setAvailability] = useState<{
    serviceable: boolean;
    branch_id: string | null;
    branch_name: string | null;
    delivery_type: string;
    zone_name: string;
    status_message: string;
    operating_status: string;
    available_dates: Array<{ date: string; label: string; is_available: boolean; reason?: string }>;
    available_slots: Array<any>;
    pricing: OrderSummaryPricing;
  } | null>(null);

  const [selectedDate, setSelectedDate] = useState<string>(new Date().toISOString().slice(0, 10));
  const [selectedSlotId, setSelectedSlotId] = useState<string>("");
  const [loadingAvailability, setLoadingAvailability] = useState(false);

  // Authoritative Availability Resolution Engine
  const fetchAvailability = useCallback(async (customParams?: {
    zip?: string;
    type?: "delivery" | "pickup";
    branch?: string;
    date?: string;
    slot?: string;
    coupon?: string;
  }) => {
    setLoadingAvailability(true);
    const targetZip = customParams?.zip ?? zip;
    const targetType = customParams?.type ?? deliveryType;
    const targetBranch = customParams?.branch ?? selectedBranchId;
    const targetDate = customParams?.date ?? selectedDate;
    const targetSlot = customParams?.slot ?? selectedSlotId;
    const targetCoupon = customParams?.coupon ?? appliedCouponCode;

    try {
      const res = await apiClient.getCheckoutAvailability({
        cart_id: cart.id,
        delivery_type: targetType,
        pincode: targetType === "delivery" ? targetZip : undefined,
        branch_id: targetType === "pickup" ? targetBranch : undefined,
        date: targetDate,
        slot_id: targetSlot || undefined,
        coupon_code: targetCoupon || undefined,
      });

      if (res && res.success) {
        setAvailability(res);
        if (res.branch_id) {
          setSelectedBranchId(res.branch_id);
        }
        // Auto-select first available slot if current is invalid
        const validSlots = res.available_slots || [];
        const isCurrentSlotValid = validSlots.some((s: any) => s.id === targetSlot && s.available);
        if (!isCurrentSlotValid) {
          const firstAvailable = validSlots.find((s: any) => s.available);
          if (firstAvailable) {
            setSelectedSlotId(firstAvailable.id);
          }
        }
      }
    } catch (e) {
      console.error("Failed to load checkout availability", e);
    } finally {
      setLoadingAvailability(false);
    }
  }, [cart.id, zip, deliveryType, selectedBranchId, selectedDate, selectedSlotId, appliedCouponCode]);

  // Initial Load
  useEffect(() => {
    fetchAvailability();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Periodic Refresh of Slots & Capacity every 30 seconds
  useEffect(() => {
    const timer = setInterval(() => {
      fetchAvailability();
    }, 30000);
    return () => clearInterval(timer);
  }, [fetchAvailability]);

  // Pincode Verification Handler
  const handleCheckPincode = async () => {
    if (!zip || zip.trim().length < 6) return;
    setChecking(true);
    await fetchAvailability({ zip });
    setChecking(false);
  };

  // Delivery Mode Toggle
  const handleModeChange = (type: "delivery" | "pickup") => {
    setDeliveryType(type);
    fetchAvailability({ type });
  };

  // Branch Selection for Pickup
  const handleBranchSelect = (branchId: string) => {
    setSelectedBranchId(branchId);
    fetchAvailability({ branch: branchId, type: "pickup" });
  };

  // Date Selection Handler
  const handleDateChange = (date: string) => {
    setSelectedDate(date);
    fetchAvailability({ date });
  };

  // Slot Selection Handler
  const handleSlotSelect = (slotId: string) => {
    setSelectedSlotId(slotId);
    fetchAvailability({ slot: slotId });
  };

  // Promo Code Handler
  const handleApplyGiftCard = async () => {
    setCouponError("");
    setCouponSuccess("");
    if (!giftCardCodeInput.trim()) return;

    const code = giftCardCodeInput.trim().toUpperCase();
    try {
      const res = await apiClient.applyPromoCode(cart.id || "", code);
      if (res?.valid) {
        setAppliedCouponCode(res.code);
        setCouponDiscount(res.discount || 0);
        setCouponSuccess(`🎉 Coupon ${res.code} applied! You saved ₹${res.discount}.`);
        fetchAvailability({ coupon: res.code });
      } else {
        setCouponError(res?.error || "Invalid or expired coupon code.");
      }
    } catch (e: any) {
      setCouponError(e.message || "Failed to validate promo code.");
    }
  };

  // Step 1 Validation
  const isStep1Valid = firstName.trim() !== "" && phone.trim().length >= 10 && email.includes("@");

  // Step 2 Validation
  const isStep2Valid = deliveryType === "delivery"
    ? Boolean(availability?.serviceable && address.trim() !== "" && city.trim() !== "" && selectedSlotId !== "")
    : Boolean(selectedBranchId && selectedSlotId !== "");

  // Focus management on step change
  useEffect(() => {
    if (step === 1) {
      firstNameRef.current?.focus();
    } else if (step === 2) {
      zipInputRef.current?.focus();
    } else if (step === 3) {
      notesRef.current?.focus();
    }
  }, [step]);

  const isSubmitDisabled = !isStep1Valid || !isStep2Valid;
  const currentSlots = availability?.available_slots || [];
  const activeDates = availability?.available_dates || [];
  const currentSlotObj = currentSlots.find((s) => s.id === selectedSlotId);
  const servicingBranchObj = AVAILABLE_PICKUP_BRANCHES.find((b) => b.id === selectedBranchId) || {
    id: selectedBranchId,
    name: availability?.branch_name || "Flagship Hub",
    address: "Bengaluru Kitchen",
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 w-full font-sans">
      {/* LEFT COLUMN: 3-Step Checkout Flow */}
      <div className="lg:col-span-7 flex flex-col gap-6">
        <div className="flex justify-between items-center border-b border-zinc-200 dark:border-zinc-800 pb-3">
          <div>
            <Heading level="h1" className="text-2xl md:text-3xl font-extrabold tracking-tight text-zinc-900 dark:text-zinc-100">
              Cake Delivery Checkout
            </Heading>
            <p className="text-xs text-zinc-500 mt-0.5">Direct Bakery Kitchen Fulfillment</p>
          </div>
          <span className="text-xs font-semibold px-3 py-1 rounded-full bg-rose-50 dark:bg-rose-950 text-rose-600 dark:text-rose-400 border border-rose-200/60">
            🔒 SSL Encrypted
          </span>
        </div>

        {/* Stepper Progress Indicator */}
        <div className="flex justify-between items-center w-full bg-zinc-50 dark:bg-zinc-900/80 p-3.5 rounded-2xl border border-zinc-200 dark:border-zinc-800 shadow-sm" role="progressbar" aria-label="Checkout Progress">
          <button
            type="button"
            onClick={() => setStep(1)}
            className={`flex items-center gap-2 text-xs md:text-sm font-semibold transition-all ${
              step === 1 ? "text-rose-600 dark:text-rose-400" : "text-zinc-500 hover:text-zinc-800"
            }`}
          >
            <span className={`w-6 h-6 flex items-center justify-center rounded-full text-xs font-bold ${
              step > 1 ? "bg-rose-600 text-white" : step === 1 ? "border-2 border-rose-600 text-rose-600" : "border border-zinc-400 text-zinc-400"
            }`}>
              {step > 1 ? "✓" : "1"}
            </span>
            <span>1. Contact</span>
          </button>
          <div className="flex-1 h-px bg-zinc-200 dark:border-zinc-700 mx-2 hidden sm:block" />
          <button
            type="button"
            disabled={!isStep1Valid}
            onClick={() => setStep(2)}
            className={`flex items-center gap-2 text-xs md:text-sm font-semibold transition-all disabled:opacity-40 disabled:cursor-not-allowed ${
              step === 2 ? "text-rose-600 dark:text-rose-400" : "text-zinc-500 hover:text-zinc-800"
            }`}
          >
            <span className={`w-6 h-6 flex items-center justify-center rounded-full text-xs font-bold ${
              step > 2 ? "bg-rose-600 text-white" : step === 2 ? "border-2 border-rose-600 text-rose-600" : "border border-zinc-400 text-zinc-400"
            }`}>
              {step > 2 ? "✓" : "2"}
            </span>
            <span>2. Mode & Slots</span>
          </button>
          <div className="flex-1 h-px bg-zinc-200 dark:border-zinc-700 mx-2 hidden sm:block" />
          <button
            type="button"
            disabled={!isStep1Valid || !isStep2Valid}
            onClick={() => setStep(3)}
            className={`flex items-center gap-2 text-xs md:text-sm font-semibold transition-all disabled:opacity-40 disabled:cursor-not-allowed ${
              step === 3 ? "text-rose-600 dark:text-rose-400" : "text-zinc-500 hover:text-zinc-800"
            }`}
          >
            <span className={`w-6 h-6 flex items-center justify-center rounded-full text-xs font-bold ${
              step === 3 ? "border-2 border-rose-600 text-rose-600" : "border border-zinc-400 text-zinc-400"
            }`}>
              3
            </span>
            <span>3. Review & Pay</span>
          </button>
        </div>

        <form className="flex flex-col gap-6 w-full" action={action}>
          {/* STEP 1: Contact & Gifting Details */}
          {step === 1 && (
            <div className="border border-zinc-200 dark:border-zinc-800 rounded-3xl p-6 bg-white dark:bg-zinc-900 flex flex-col gap-6 shadow-sm animate-fadeIn">
              <div className="flex justify-between items-center border-b border-zinc-100 dark:border-zinc-800 pb-3">
                <Heading level="h2" className="text-lg font-bold text-zinc-900 dark:text-zinc-100">
                  1. Contact & Celebration Details
                </Heading>
                <span className="text-xs text-zinc-500">Step 1 of 3</span>
              </div>

              {/* Who is this order for? */}
              <div className="flex flex-col gap-2">
                <Label className="font-semibold text-xs text-zinc-700 dark:text-zinc-300">Who are we baking for?</Label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setOrderedForSelf(true)}
                    className={`py-3 px-4 rounded-xl border text-left font-semibold text-xs md:text-sm transition-all flex items-center gap-2.5 ${
                      orderedForSelf
                        ? "border-rose-500 bg-rose-50/60 dark:bg-rose-950/40 text-rose-900 dark:text-rose-100 ring-2 ring-rose-500/20"
                        : "border-zinc-200 dark:border-zinc-800 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50"
                    }`}
                  >
                    <span className="text-lg">👤</span>
                    <span>For Myself</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setOrderedForSelf(false)}
                    className={`py-3 px-4 rounded-xl border text-left font-semibold text-xs md:text-sm transition-all flex items-center gap-2.5 ${
                      !orderedForSelf
                        ? "border-rose-500 bg-rose-50/60 dark:bg-rose-950/40 text-rose-900 dark:text-rose-100 ring-2 ring-rose-500/20"
                        : "border-zinc-200 dark:border-zinc-800 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50"
                    }`}
                  >
                    <span className="text-lg">🎁</span>
                    <span>Send as a Gift</span>
                  </button>
                </div>
                <input type="hidden" name="ordered_for_self" value={orderedForSelf ? "true" : "false"} />
              </div>

              {/* Purchaser Details */}
              <div className="flex flex-col gap-4">
                <Text className="font-bold text-xs uppercase tracking-wider text-zinc-400">Purchaser Contact Details</Text>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label className="font-semibold text-xs text-zinc-700 dark:text-zinc-300">First Name *</Label>
                    <Input
                      ref={firstNameRef}
                      placeholder="Ananya"
                      name="first-name"
                      value={firstName}
                      onChange={(e) => setFirstName(e.target.value)}
                      required
                      className="mt-1"
                    />
                  </div>
                  <div>
                    <Label className="font-semibold text-xs text-zinc-700 dark:text-zinc-300">Last Name *</Label>
                    <Input
                      placeholder="Sharma"
                      name="last-name"
                      value={lastName}
                      onChange={(e) => setLastName(e.target.value)}
                      required
                      className="mt-1"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label className="font-semibold text-xs text-zinc-700 dark:text-zinc-300">Mobile Phone *</Label>
                    <Input
                      placeholder="+91 98765 43210"
                      name="phone"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      required
                      className="mt-1"
                    />
                  </div>
                  <div>
                    <Label className="font-semibold text-xs text-zinc-700 dark:text-zinc-300">Email Address (for invoice & updates) *</Label>
                    <Input
                      placeholder="ananya@example.com"
                      name="email"
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                      className="mt-1"
                    />
                  </div>
                </div>
              </div>

              {/* Recipient Details Section (When Gifting) */}
              {!orderedForSelf && (
                <div className="border border-rose-200 dark:border-rose-900/50 bg-rose-50/50 dark:bg-rose-950/20 p-5 rounded-2xl flex flex-col gap-4">
                  <div className="flex items-center gap-2">
                    <span className="text-lg">🎀</span>
                    <Heading level="h3" className="text-sm font-bold text-rose-900 dark:text-rose-100">
                      Gift Recipient Information
                    </Heading>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Label className="font-semibold text-xs">Recipient Full Name *</Label>
                      <Input
                        placeholder="e.g. Rahul Verma"
                        name="recipient_name"
                        value={recipientName}
                        onChange={(e) => setRecipientName(e.target.value)}
                        required={!orderedForSelf}
                        className="mt-1 bg-white dark:bg-black"
                      />
                    </div>
                    <div>
                      <Label className="font-semibold text-xs">Recipient Mobile Phone *</Label>
                      <Input
                        placeholder="+91 98765 00000"
                        name="recipient_phone"
                        value={recipientPhone}
                        onChange={(e) => setRecipientPhone(e.target.value)}
                        required={!orderedForSelf}
                        className="mt-1 bg-white dark:bg-black"
                      />
                    </div>
                  </div>
                  <div>
                    <Label className="font-semibold text-xs">Custom Gift Card Message</Label>
                    <Textarea
                      name="gift_message"
                      placeholder="Happy Birthday! Wishing you joy, sweet moments, and all the happiness in the world. With love, Ananya."
                      value={giftMessage}
                      onChange={(e) => setGiftMessage(e.target.value)}
                      className="mt-1 text-xs bg-white dark:bg-black"
                      rows={2}
                    />
                  </div>
                  <div className="flex flex-wrap gap-4 pt-1 text-xs">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        name="hide_invoice"
                        checked={hideInvoice}
                        onChange={(e) => setHideInvoice(e.target.checked)}
                        className="rounded text-rose-600"
                      />
                      <span className="font-medium">📄 Hide Invoice from Cake Box</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        name="anonymous_delivery"
                        checked={anonymousDelivery}
                        onChange={(e) => setAnonymousDelivery(e.target.checked)}
                        className="rounded text-rose-600"
                      />
                      <span>🤫 Anonymous Delivery (Secret Surprise)</span>
                    </label>
                  </div>
                </div>
              )}

              <Button
                type="button"
                disabled={!isStep1Valid}
                onClick={() => setStep(2)}
                className="mt-2 w-full sm:w-fit self-end bg-rose-600 hover:bg-rose-700 text-white font-bold py-2.5 px-6 rounded-xl"
              >
                Continue to Delivery Mode & Slots →
              </Button>
            </div>
          )}

          {/* STEP 2: Delivery Mode, Branch/Pincode & Scheduling */}
          {step === 2 && (
            <div className="flex flex-col gap-6 animate-fadeIn">
              {/* Order Mode Toggle */}
              <div className="border border-zinc-200 dark:border-zinc-800 rounded-3xl p-6 bg-white dark:bg-zinc-900 flex flex-col gap-4 shadow-sm">
                <div className="flex justify-between items-center border-b border-zinc-100 dark:border-zinc-800 pb-3">
                  <Heading level="h2" className="text-lg font-bold text-zinc-900 dark:text-zinc-100">
                    2. Fulfillment Method
                  </Heading>
                  <span className="text-xs text-zinc-500">Step 2 of 3</span>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <button
                    type="button"
                    onClick={() => handleModeChange("delivery")}
                    className={`py-4 px-4 rounded-2xl border text-left font-semibold transition-all flex flex-col gap-1.5 ${
                      deliveryType === "delivery"
                        ? "border-rose-500 bg-rose-50/60 dark:bg-rose-950/40 text-rose-900 dark:text-rose-100 ring-2 ring-rose-500/20"
                        : "border-zinc-200 dark:border-zinc-800 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50"
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-xl">🛵</span>
                      <span className="font-bold text-sm md:text-base">Home Delivery</span>
                    </div>
                    <span className="text-[11px] text-zinc-500">
                      Direct delivery to doorstep via temperature-controlled courier
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleModeChange("pickup")}
                    className={`py-4 px-4 rounded-2xl border text-left font-semibold transition-all flex flex-col gap-1.5 ${
                      deliveryType === "pickup"
                        ? "border-rose-500 bg-rose-50/60 dark:bg-rose-950/40 text-rose-900 dark:text-rose-100 ring-2 ring-rose-500/20"
                        : "border-zinc-200 dark:border-zinc-800 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50"
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-xl">🏪</span>
                      <span className="font-bold text-sm md:text-base">Store Pickup (FREE)</span>
                    </div>
                    <span className="text-[11px] text-emerald-600 font-bold">
                      Zero delivery charge • Collect from nearest kitchen hub
                    </span>
                  </button>
                </div>
                <input type="hidden" name="delivery_type" value={deliveryType} />
              </div>

              {/* Mode 1: Home Delivery Pincode & Street Address */}
              {deliveryType === "delivery" ? (
                <div className="border border-zinc-200 dark:border-zinc-800 rounded-3xl p-6 bg-white dark:bg-zinc-900 flex flex-col gap-4 shadow-sm">
                  <Heading level="h2" className="text-base font-bold text-zinc-900 dark:text-zinc-100 border-b border-zinc-100 dark:border-zinc-800 pb-2 flex items-center gap-2">
                    <span>📍</span> Delivery Location & Pincode Verification
                  </Heading>

                  <div className="flex flex-col gap-2">
                    <Label htmlFor="checkout-zip" className="font-semibold text-xs text-zinc-700 dark:text-zinc-300">
                      Delivery Pincode *
                    </Label>
                    <div className="flex gap-2 items-center">
                      <Input
                        ref={zipInputRef}
                        id="checkout-zip"
                        placeholder="e.g. 560001 or 560038"
                        name="zip"
                        value={zip}
                        maxLength={6}
                        onChange={(e) => setZip(e.target.value.replace(/\D/g, ""))}
                        onBlur={handleCheckPincode}
                        required
                        className="flex-1 font-mono font-bold tracking-wider text-base"
                      />
                      <Button
                        type="button"
                        variant="secondary"
                        onClick={handleCheckPincode}
                        isLoading={checking || loadingAvailability}
                        className="px-5 font-semibold"
                      >
                        Verify Pincode
                      </Button>
                    </div>

                    {/* Authoritative Serviceability Feedback Banner */}
                    {availability && (
                      <div className="mt-2">
                        {availability.serviceable ? (
                          <div className="p-3.5 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900/50 flex flex-col gap-1">
                            <div className="flex items-center justify-between">
                              <span className="text-xs font-bold text-emerald-800 dark:text-emerald-300 flex items-center gap-1.5">
                                <span>✓</span> Serviceable Zone ({availability.zone_name})
                              </span>
                              <span className="text-xs font-extrabold text-emerald-900 dark:text-emerald-100 bg-emerald-100 dark:bg-emerald-900/80 px-2.5 py-0.5 rounded-md">
                                {availability.pricing.delivery_fee === 0 ? "FREE DELIVERY" : `Fee: ₹${availability.pricing.delivery_fee}.00`}
                              </span>
                            </div>
                            <p className="text-[11px] text-emerald-700 dark:text-emerald-400">
                              {availability.status_message}
                            </p>
                          </div>
                        ) : (
                          <div className="p-3.5 rounded-2xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/50 flex flex-col gap-1">
                            <span className="text-xs font-bold text-rose-800 dark:text-rose-300 flex items-center gap-1.5">
                              <span>✗</span> Outside Direct Delivery Zone
                            </span>
                            <p className="text-[11px] text-rose-700 dark:text-rose-400">
                              {availability.status_message} Try pincode <b>560001</b>, <b>560034</b>, <b>560038</b>, or select Store Pickup.
                            </p>
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  <div className="grid grid-cols-1 gap-4 pt-2">
                    <div>
                      <Label className="font-semibold text-xs text-zinc-700 dark:text-zinc-300">Street Address / Flat / Building *</Label>
                      <Input
                        placeholder="Flat 402, Signature Towers, 12th Main Road, HAL 2nd Stage"
                        name="address"
                        value={address}
                        onChange={(e) => setAddress(e.target.value)}
                        required
                        className="mt-1"
                      />
                    </div>
                    <div>
                      <Label className="font-semibold text-xs text-zinc-700 dark:text-zinc-300">City / Area *</Label>
                      <Input
                        placeholder="City"
                        name="city"
                        value={city}
                        onChange={(e) => setCity(e.target.value)}
                        required
                        className="mt-1"
                      />
                    </div>
                  </div>
                </div>
              ) : (
                /* Mode 2: Store Pickup Branch Selection */
                <div className="border border-zinc-200 dark:border-zinc-800 rounded-3xl p-6 bg-white dark:bg-zinc-900 flex flex-col gap-4 shadow-sm">
                  <Heading level="h2" className="text-base font-bold text-zinc-900 dark:text-zinc-100 border-b border-zinc-100 dark:border-zinc-800 pb-2 flex items-center gap-2">
                    <span>🏪</span> Select Bakery Hub for Pickup
                  </Heading>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                    {AVAILABLE_PICKUP_BRANCHES.map((b) => {
                      const isSelected = selectedBranchId === b.id;
                      return (
                        <button
                          key={b.id}
                          type="button"
                          onClick={() => handleBranchSelect(b.id)}
                          className={`p-4 rounded-2xl border text-left transition-all flex flex-col gap-1.5 ${
                            isSelected
                              ? "border-rose-500 bg-rose-50/70 dark:bg-rose-950/40 text-rose-900 dark:text-rose-100 ring-2 ring-rose-500/20"
                              : "border-zinc-200 dark:border-zinc-800 hover:border-zinc-300"
                          }`}
                        >
                          <div className="flex justify-between items-center">
                            <span className="font-bold text-sm text-zinc-900 dark:text-zinc-100">{b.name}</span>
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-400">
                              Open Daily
                            </span>
                          </div>
                          <p className="text-xs text-zinc-500">{b.address}</p>
                          <span className="text-[11px] text-zinc-400 font-mono mt-1">🕒 {b.timing}</span>
                        </button>
                      );
                    })}
                  </div>
                  <input type="hidden" name="branch_id" value={selectedBranchId} />
                </div>
              )}

              {/* Delivery / Pickup Date & Slot Scheduling */}
              <div className="border border-zinc-200 dark:border-zinc-800 rounded-3xl p-6 bg-white dark:bg-zinc-900 flex flex-col gap-4 shadow-sm">
                <div className="flex justify-between items-center border-b border-zinc-100 dark:border-zinc-800 pb-2">
                  <Heading level="h2" className="text-base font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
                    <span>🗓️</span> {deliveryType === "delivery" ? "Delivery Scheduling" : "Pickup Scheduling"}
                  </Heading>
                  <span className="text-xs font-semibold text-zinc-500">
                    From: <b>{servicingBranchObj.name}</b>
                  </span>
                </div>

                {/* Date Selector */}
                <div className="flex flex-col gap-1.5">
                  <Label className="font-semibold text-xs text-zinc-700 dark:text-zinc-300">Select Date</Label>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    {activeDates.slice(0, 8).map((d) => {
                      const isSelected = selectedDate === d.date;
                      return (
                        <button
                          key={d.date}
                          type="button"
                          disabled={!d.is_available}
                          onClick={() => handleDateChange(d.date)}
                          className={`p-2.5 rounded-xl border text-center transition-all flex flex-col items-center justify-center ${
                            isSelected
                              ? "border-rose-500 bg-rose-500 text-white font-bold shadow-md shadow-rose-500/20"
                              : d.is_available
                                ? "border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-800/50 text-zinc-800 dark:text-zinc-200 hover:border-rose-300"
                                : "border-zinc-200 opacity-40 cursor-not-allowed bg-zinc-100 text-zinc-400"
                          }`}
                        >
                          <span className="text-xs font-bold">{d.label}</span>
                          {!d.is_available && (
                            <span className="text-[9px] text-rose-500 font-semibold">{d.reason || "Closed"}</span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                  <input type="hidden" name="delivery_date" value={selectedDate} />
                </div>

                {/* Slots Grid */}
                <div className="flex flex-col gap-2 mt-3">
                  <div className="flex justify-between items-center">
                    <Label className="font-semibold text-xs text-zinc-700 dark:text-zinc-300">
                      Select Time Window ({deliveryType === "delivery" ? "Delivery Slot" : "Pickup Window"})
                    </Label>
                    <span className="text-[11px] text-zinc-400">Real-time slot capacity tracking</span>
                  </div>

                  {loadingAvailability ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-1">
                      {[1, 2, 3, 4].map((i) => (
                        <div key={i} className="animate-pulse bg-zinc-100 dark:bg-zinc-800 rounded-xl h-16 w-full" />
                      ))}
                    </div>
                  ) : currentSlots.length === 0 ? (
                    <div className="bg-zinc-50 dark:bg-zinc-800/40 border border-dashed border-zinc-300 dark:border-zinc-700 rounded-2xl p-6 text-center">
                      <Text className="text-xs text-zinc-500 italic">No operational slots available for this date. Please select another date.</Text>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-1">
                      {currentSlots.map((slot: any) => {
                        const isAvailable = slot.available;
                        const isSelected = selectedSlotId === slot.id;
                        const isAlmostFull = isAvailable && slot.remaining_capacity <= 4;

                        return (
                          <button
                            key={slot.id}
                            type="button"
                            disabled={!isAvailable}
                            onClick={() => handleSlotSelect(slot.id)}
                            className={`flex flex-col text-left border rounded-2xl p-3.5 transition-all ${
                              isSelected
                                ? "border-rose-500 bg-rose-50/80 dark:bg-rose-950/40 ring-2 ring-rose-500/20 shadow-sm"
                                : isAvailable
                                  ? "border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 hover:border-zinc-300"
                                  : "border-zinc-200 bg-zinc-50 dark:bg-zinc-800/40 opacity-50 cursor-not-allowed"
                            }`}
                          >
                            <div className="flex justify-between items-start w-full">
                              <span className="font-bold text-xs md:text-sm text-zinc-900 dark:text-zinc-100 pr-1">
                                {slot.slot_name}
                              </span>
                              {!isAvailable ? (
                                <Badge color="red" size="small">
                                  {slot.status === "PAST_CUTOFF" ? "Cutoff Passed" : "Fully Booked"}
                                </Badge>
                              ) : isAlmostFull ? (
                                <Badge color="orange" size="small">
                                  🔥 {slot.remaining_capacity} left
                                </Badge>
                              ) : (
                                <Badge color="green" size="small">
                                  Available
                                </Badge>
                              )}
                            </div>

                            <div className="flex justify-between items-center mt-2 text-xs">
                              <span className="text-zinc-500 font-mono text-[11px]">
                                {slot.start_time} - {slot.end_time}
                              </span>
                              {slot.extra_charge > 0 && (
                                <span className="font-extrabold text-rose-600 dark:text-rose-400 text-xs">
                                  +₹{slot.extra_charge} Surcharge
                                </span>
                              )}
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  )}
                  <input type="hidden" name="delivery_slot_id" value={selectedSlotId} />
                </div>
              </div>

              <div className="flex justify-between items-center mt-2">
                <Button type="button" variant="secondary" onClick={() => setStep(1)} className="rounded-xl">
                  ← Back to Contact
                </Button>
                <Button
                  type="button"
                  disabled={!isStep2Valid}
                  onClick={() => setStep(3)}
                  className="bg-rose-600 hover:bg-rose-700 text-white font-bold py-2.5 px-6 rounded-xl"
                >
                  Continue to Review & Pay →
                </Button>
              </div>
            </div>
          )}

          {/* STEP 3: Review, Payment Method & Final Notes */}
          {step === 3 && (
            <div className="flex flex-col gap-6 animate-fadeIn">
              {/* Review Card */}
              <div className="border border-zinc-200 dark:border-zinc-800 rounded-3xl p-6 bg-white dark:bg-zinc-900 flex flex-col gap-4 shadow-sm">
                <Heading level="h2" className="text-base font-bold text-zinc-900 dark:text-zinc-100 border-b border-zinc-100 dark:border-zinc-800 pb-2">
                  1. Order Details Summary
                </Heading>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-xs">
                  <div className="flex flex-col gap-1.5">
                    <span className="font-bold text-zinc-400 uppercase tracking-wider">Customer & Contact</span>
                    <p className="font-bold text-sm text-zinc-900 dark:text-zinc-100">{firstName} {lastName}</p>
                    <p className="text-zinc-600 dark:text-zinc-400">📱 {phone}</p>
                    <p className="text-zinc-600 dark:text-zinc-400">✉️ {email}</p>
                    {!orderedForSelf && recipientName && (
                      <p className="mt-1 font-semibold text-rose-600">
                        🎁 Recipient: {recipientName} ({recipientPhone})
                      </p>
                    )}
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <span className="font-bold text-zinc-400 uppercase tracking-wider">Fulfillment & Slot</span>
                    <p className="font-bold text-sm text-zinc-900 dark:text-zinc-100 capitalize">
                      {deliveryType === "delivery" ? `🛵 Home Delivery (${zip})` : `🏪 Store Pickup (${servicingBranchObj.name})`}
                    </p>
                    {deliveryType === "delivery" && (
                      <p className="text-zinc-600 dark:text-zinc-400">{address}, {city}</p>
                    )}
                    <p className="mt-1 font-bold text-rose-600 dark:text-rose-400">
                      🗓️ Date: {selectedDate} | Slot: {currentSlotObj?.slot_name || selectedSlotId}
                    </p>
                  </div>
                </div>
              </div>

              {/* Payment Method Selector */}
              <div className="border border-zinc-200 dark:border-zinc-800 rounded-3xl p-6 bg-white dark:bg-zinc-900 flex flex-col gap-4 shadow-sm">
                <div className="flex justify-between items-center border-b border-zinc-100 dark:border-zinc-800 pb-2">
                  <Heading level="h2" className="text-base font-bold text-zinc-900 dark:text-zinc-100">
                    2. Payment Method
                  </Heading>
                  <span className="text-xs text-emerald-600 font-bold flex items-center gap-1">
                    <span>🔒</span> 100% Encrypted & Safe
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <button
                    type="button"
                    onClick={() => setPaymentMethod("razorpay")}
                    className={`p-4 rounded-2xl border text-left flex flex-col gap-2 transition-all ${
                      paymentMethod === "razorpay"
                        ? "border-rose-500 bg-rose-50/60 dark:bg-rose-950/40 ring-2 ring-rose-500/20"
                        : "border-zinc-200 dark:border-zinc-800 hover:border-zinc-300"
                    }`}
                  >
                    <div className="flex justify-between items-center">
                      <span className="text-2xl">💳</span>
                      <span className={`w-4 h-4 rounded-full border flex items-center justify-center ${
                        paymentMethod === "razorpay" ? "border-rose-600 bg-rose-600 text-white text-[10px]" : "border-zinc-400"
                      }`}>
                        {paymentMethod === "razorpay" && "✓"}
                      </span>
                    </div>
                    <div>
                      <h4 className="font-bold text-xs md:text-sm text-zinc-900 dark:text-zinc-100">Online UPI / Card</h4>
                      <p className="text-[11px] text-zinc-500 mt-0.5">Google Pay, PhonePe, Cards, NetBanking</p>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setPaymentMethod("cod")}
                    className={`p-4 rounded-2xl border text-left flex flex-col gap-2 transition-all ${
                      paymentMethod === "cod"
                        ? "border-rose-500 bg-rose-50/60 dark:bg-rose-950/40 ring-2 ring-rose-500/20"
                        : "border-zinc-200 dark:border-zinc-800 hover:border-zinc-300"
                    }`}
                  >
                    <div className="flex justify-between items-center">
                      <span className="text-2xl">💵</span>
                      <span className={`w-4 h-4 rounded-full border flex items-center justify-center ${
                        paymentMethod === "cod" ? "border-rose-600 bg-rose-600 text-white text-[10px]" : "border-zinc-400"
                      }`}>
                        {paymentMethod === "cod" && "✓"}
                      </span>
                    </div>
                    <div>
                      <h4 className="font-bold text-xs md:text-sm text-zinc-900 dark:text-zinc-100">Cash on Delivery</h4>
                      <p className="text-[11px] text-zinc-500 mt-0.5">Pay upon delivery verification</p>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setPaymentMethod("test_mode")}
                    className={`p-4 rounded-2xl border text-left flex flex-col gap-2 transition-all ${
                      paymentMethod === "test_mode"
                        ? "border-rose-500 bg-rose-50/60 dark:bg-rose-950/40 ring-2 ring-rose-500/20"
                        : "border-zinc-200 dark:border-zinc-800 hover:border-zinc-300"
                    }`}
                  >
                    <div className="flex justify-between items-center">
                      <span className="text-2xl">⚡</span>
                      <span className={`w-4 h-4 rounded-full border flex items-center justify-center ${
                        paymentMethod === "test_mode" ? "border-rose-600 bg-rose-600 text-white text-[10px]" : "border-zinc-400"
                      }`}>
                        {paymentMethod === "test_mode" && "✓"}
                      </span>
                    </div>
                    <div>
                      <h4 className="font-bold text-xs md:text-sm text-zinc-900 dark:text-zinc-100">Sandbox Test</h4>
                      <p className="text-[11px] text-zinc-500 mt-0.5">Simulate instant verified checkout</p>
                    </div>
                  </button>
                </div>
              </div>

              {/* Coupon / Promo Code */}
              <div className="border border-zinc-200 dark:border-zinc-800 rounded-3xl p-6 bg-white dark:bg-zinc-900 flex flex-col gap-3 shadow-sm">
                <Label className="font-semibold text-xs text-zinc-700 dark:text-zinc-300">3. Apply Coupon / Voucher</Label>
                <div className="flex gap-2">
                  <Input
                    placeholder="e.g. CAKE50 or SWEET15"
                    value={giftCardCodeInput}
                    onChange={(e) => setGiftCardCodeInput(e.target.value.toUpperCase())}
                    className="flex-1 text-xs font-mono uppercase"
                  />
                  <Button type="button" variant="secondary" onClick={handleApplyGiftCard} className="px-5 font-semibold">
                    Apply
                  </Button>
                </div>
                {couponError && <p className="text-xs text-rose-600 font-semibold">{couponError}</p>}
                {couponSuccess && <p className="text-xs text-emerald-600 font-semibold">{couponSuccess}</p>}
              </div>

              {/* Delivery Instructions */}
              <div className="border border-zinc-200 dark:border-zinc-800 rounded-3xl p-6 bg-white dark:bg-zinc-900 flex flex-col gap-3 shadow-sm">
                <Label className="font-semibold text-xs text-zinc-700 dark:text-zinc-300">
                  4. Special Kitchen or Delivery Instructions
                </Label>
                <Textarea
                  ref={notesRef}
                  placeholder="e.g. Handle with extreme care, ring bell twice, keep cold until evening party."
                  name="special-instructions"
                  value={deliveryInstructions}
                  onChange={(e) => setDeliveryInstructions(e.target.value)}
                  rows={2}
                />
              </div>

              {/* Hidden Form Data bindings for server action */}
              <input type="hidden" name="first-name" value={firstName} />
              <input type="hidden" name="last-name" value={lastName} />
              <input type="hidden" name="phone" value={phone} />
              <input type="hidden" name="email" value={email} />
              <input type="hidden" name="address-line1" value={deliveryType === "delivery" ? address : `STORE PICKUP (${servicingBranchObj.name})`} />
              <input type="hidden" name="address-line2" value="" />
              <input type="hidden" name="city" value={city} />
              <input type="hidden" name="state" value="Karnataka" />
              <input type="hidden" name="zip" value={deliveryType === "delivery" ? zip : "560038"} />
              <input type="hidden" name="delivery-date" value={selectedDate} />
              <input type="hidden" name="delivery-slot" value={selectedSlotId} />
              <input type="hidden" name="payment-method" value={paymentMethod} />
              <input type="hidden" name="occasion" value={occasion} />
              <input type="hidden" name="ordered-for-self" value={orderedForSelf ? "true" : "false"} />
              <input type="hidden" name="recipient-name" value={recipientName} />
              <input type="hidden" name="recipient-phone" value={recipientPhone} />
              <input type="hidden" name="gift-message" value={giftMessage} />

              <div className="flex justify-between items-center border-t border-zinc-200 dark:border-zinc-800 pt-4">
                <Button type="button" variant="secondary" onClick={() => setStep(2)} className="rounded-xl">
                  ← Back to Mode & Slots
                </Button>
                <div className="flex flex-col items-end gap-1">
                  <Submit disabled={isSubmitDisabled} />
                  {isSubmitDisabled && (
                    <Text className="text-xs text-rose-600 mt-1">
                      * Please ensure all previous step fields are valid.
                    </Text>
                  )}
                </div>
              </div>
            </div>
          )}

          {state?.message && (
            <ErrorComponent
              title="Order Submission Issue"
              message={state.message}
            />
          )}
        </form>
      </div>

      {/* RIGHT COLUMN: Real-Time Synced Order Summary */}
      <div className="lg:col-span-5">
        <OrderSummary
          cart={cart}
          pricing={availability?.pricing}
          deliveryType={deliveryType}
          servicingBranch={servicingBranchObj}
          selectedSlot={currentSlotObj}
          pincode={deliveryType === "delivery" ? zip : undefined}
        />
      </div>
    </div>
  );
}

