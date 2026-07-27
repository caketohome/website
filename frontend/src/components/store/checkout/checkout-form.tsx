"use client";

import { placeOrder, checkDeliveryAvailabilityAction, getDeliverySlotsAction } from "@frontend/lib/actions";
import { HttpTypes } from "@medusajs/types";
import { Badge, Button, Heading, Input, Label, Text, Textarea } from "@medusajs/ui";
import { useFormState, useFormStatus } from "react-dom";
import { useState, useEffect, useRef } from "react";
import { ErrorComponent } from "@frontend/components/common/error-component";
import {
  clientGetWalletBalance,
  clientGetLoyaltyLedger,
  clientValidateGiftCard
} from "@frontend/lib/data/rewards-client";

function Submit({ disabled }: { disabled?: boolean }) {
  const status = useFormStatus();

  return (
    <Button
      type="submit"
      size="large"
      className="w-full sm:w-auto mt-6"
      isLoading={status.pending}
      disabled={disabled}
      aria-label="Confirm and place your cake order"
    >
      Place Order
    </Button>
  );
}

export default function CheckoutForm({ cart }: { cart: HttpTypes.StoreCart }) {
  const [state, action] = useFormState(placeOrder, { message: "" });
  const [zip, setZip] = useState(cart.shipping_address?.postal_code || "");
  const [checking, setChecking] = useState(false);
  const [result, setResult] = useState<{
    serviceable: boolean;
    deliveryFee: number;
    checked: boolean;
    message?: string;
  } | null>(null);

  const shopId = cart.metadata?.shop_id as string;

  // Active step state: 1 = Contact, 2 = Mode & Schedule, 3 = Review & Notes
  const [step, setStep] = useState<1 | 2 | 3>(1);

  // References for focus management
  const firstNameRef = useRef<HTMLInputElement>(null);
  const zipInputRef = useRef<HTMLInputElement>(null);
  const notesRef = useRef<HTMLTextAreaElement>(null);

  // Contact fields state (for local validation before moving to step 2)
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");

  // Delivery type selection (Delivery vs Branch Pickup)
  const [deliveryType, setDeliveryType] = useState<"delivery" | "pickup">("delivery");

  // Gifting & Order for Someone Else State
  const [orderedForSelf, setOrderedForSelf] = useState<boolean>(true);
  const [recipientName, setRecipientName] = useState<string>("");
  const [recipientPhone, setRecipientPhone] = useState<string>("");
  const [recipientAltPhone, setRecipientAltPhone] = useState<string>("");
  const [recipientAddress, setRecipientAddress] = useState<string>("");
  const [recipientPincode, setRecipientPincode] = useState<string>("");
  const [recipientLandmark, setRecipientLandmark] = useState<string>("");
  const [deliveryInstructions, setDeliveryInstructions] = useState<string>("");

  // Gift Options State
  const [giftWrap, setGiftWrap] = useState<boolean>(false);
  const [greetingCard, setGreetingCard] = useState<boolean>(false);
  const [giftMessage, setGiftMessage] = useState<string>("");
  const [anonymousDelivery, setAnonymousDelivery] = useState<boolean>(false);
  const [hideInvoice, setHideInvoice] = useState<boolean>(true);
  const [occasion, setOccasion] = useState<string>("birthday");

  // Scheduled Surprise Delivery State
  const [isSurpriseDelivery, setIsSurpriseDelivery] = useState<boolean>(false);
  const [scheduledDate, setScheduledDate] = useState<string>("");
  const [scheduledSlot, setScheduledSlot] = useState<string>("morning_9_12");

  // Rewards integration states
  const [wallet, setWallet] = useState<any>(null);
  const [loyalty, setLoyalty] = useState<any>(null);
  const [useWallet, setUseWallet] = useState<boolean>(false);
  const [walletAmount, setWalletAmount] = useState<number>(0);
  const [useLoyalty, setUseLoyalty] = useState<boolean>(false);
  const [loyaltyPointsToRedeem, setLoyaltyPointsToRedeem] = useState<number>(0);

  const [giftCardCodeInput, setGiftCardCodeInput] = useState<string>("");
  const [appliedGiftCard, setAppliedGiftCard] = useState<any>(null);
  const [giftCardError, setGiftCardError] = useState<string>("");
  const [giftCardSuccess, setGiftCardSuccess] = useState<string>("");

  useEffect(() => {
    async function fetchCustomerRewards() {
      try {
        const wRes = await clientGetWalletBalance().catch(() => null);
        if (wRes && wRes.wallet) {
          setWallet(wRes.wallet);
        }
        const lRes = await clientGetLoyaltyLedger().catch(() => null);
        if (lRes && lRes.ledger) {
          setLoyalty(lRes.ledger);
        }
      } catch (err) {
        console.warn("Failed to load rewards info for guest customer:", err);
      }
    }
    fetchCustomerRewards();
  }, []);

  const handleApplyGiftCard = async () => {
    setGiftCardError("");
    setGiftCardSuccess("");
    if (!giftCardCodeInput) return;
    try {
      const res = await clientValidateGiftCard(giftCardCodeInput);
      if (res && res.valid) {
        setAppliedGiftCard(res.gift_card);
        setGiftCardSuccess(`Gift card applied! Balance: ₹${(res.gift_card.current_balance / 100).toFixed(2)}`);
      } else {
        setGiftCardError(res.message || "Invalid or inactive gift card.");
      }
    } catch (e: any) {
      setGiftCardError(e.message || "Failed to validate gift card.");
    }
  };

  const getCurrencySymbol = (code: string) => {
    return code?.toLowerCase() === "inr" ? "₹" : "€";
  };
  const currencySymbol = getCurrencySymbol(cart.currency_code);
  const cartTotal = typeof cart.total === "number" ? cart.total : 0;

  const pointsValue = useLoyalty ? (loyaltyPointsToRedeem / 10) * 100 : 0; // convert to cents: e.g. 100 points = ₹10 = 1000 cents
  const walletValue = useWallet ? walletAmount : 0;
  const giftCardValue = appliedGiftCard 
    ? Math.min(appliedGiftCard.current_balance, cartTotal * 100 - walletValue - pointsValue) 
    : 0;

  const totalDiscount = walletValue + pointsValue + giftCardValue;
  const netPayable = Math.max(0, cartTotal * 100 - totalDiscount);


  // Dates and Slots state
  const getDates = () => {
    const dates = [];
    const today = new Date();
    for (let i = 0; i < 7; i++) {
      const d = new Date(today);
      d.setDate(today.getDate() + i);
      const yyyy = d.getFullYear();
      const mm = String(d.getMonth() + 1).padStart(2, "0");
      const dd = String(d.getDate()).padStart(2, "0");
      const dateString = `${yyyy}-${mm}-${dd}`;
      const formatted = d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
      dates.push({
        value: dateString,
        label: i === 0 ? `Today (${formatted})` : i === 1 ? `Tomorrow (${formatted})` : formatted,
      });
    }
    return dates;
  };

  const datesOptions = getDates();
  const [selectedDate, setSelectedDate] = useState(datesOptions[0].value);
  const [selectedSlotId, setSelectedSlotId] = useState("");
  const [slots, setSlots] = useState<any[]>([]);
  const [loadingSlots, setLoadingSlots] = useState(false);

  // Load and refresh slots
  const loadSlots = async (silent = false) => {
    if (!shopId || !selectedDate) return;
    if (!silent) setLoadingSlots(true);
    try {
      const res = await getDeliverySlotsAction(shopId, selectedDate);
      setSlots(res.delivery_slots || []);
    } catch (e) {
      console.error("Error loading delivery slots", e);
      setSlots([]);
    } finally {
      if (!silent) setLoadingSlots(false);
    }
  };

  // Trigger initial slot load
  useEffect(() => {
    loadSlots();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shopId, selectedDate]);

  // Set interval to automatically refresh slot capacities every 30 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      loadSlots(true);
    }, 30000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shopId, selectedDate]);

  const handleCheckPincode = async () => {
    if (!zip) return;
    setChecking(true);
    try {
      const res = await checkDeliveryAvailabilityAction(zip);
      setResult({
        serviceable: res.serviceable,
        deliveryFee: res.delivery_fee,
        checked: true,
        message: res.message,
      });
    } catch (e) {
      console.error(e);
      setResult({
        serviceable: false,
        deliveryFee: 0,
        checked: true,
        message: "Error verifying pincode serviceability",
      });
    } finally {
      setChecking(false);
    }
  };

  // Step 1 Validation
  const isStep1Valid = firstName.trim() !== "" && lastName.trim() !== "" && phone.trim() !== "" && email.includes("@");

  // Step 2 Validation
  const [address, setAddress] = useState("");
  const [city, setCity] = useState("");
  const isStep2Valid = deliveryType === "delivery"
    ? (result?.serviceable ?? false) && address.trim() !== "" && city.trim() !== "" && selectedSlotId !== ""
    : selectedSlotId !== "";

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

  return (
    <div className="flex flex-col w-full gap-6">
      <Heading level="h1" className="text-3xl font-extrabold tracking-tight border-b pb-2">Checkout</Heading>

      {/* Stepper Progress Indicator */}
      <div className="flex justify-between items-center w-full bg-ui-bg-subtle p-4 rounded-xl border border-ui-border-base shadow-sm" role="progressbar" aria-label="Checkout Progress">
        <button
          type="button"
          onClick={() => setStep(1)}
          className={`flex items-center gap-2 text-sm font-semibold transition-all ${
            step === 1 ? "text-ui-fg-interactive" : "text-ui-fg-subtle hover:text-ui-fg-base"
          }`}
        >
          <span className={`w-6 h-6 flex items-center justify-center rounded-full text-xs border ${
            step > 1 ? "bg-ui-bg-interactive text-ui-fg-on-color border-transparent" : "border-ui-border-strong"
          }`}>
            {step > 1 ? "✓" : "1"}
          </span>
          Contact
        </button>
        <div className="flex-1 h-px bg-ui-border-strong mx-4 hidden sm:block" />
        <button
          type="button"
          disabled={!isStep1Valid}
          onClick={() => setStep(2)}
          className={`flex items-center gap-2 text-sm font-semibold transition-all disabled:opacity-50 disabled:cursor-not-allowed ${
            step === 2 ? "text-ui-fg-interactive" : "text-ui-fg-subtle hover:text-ui-fg-base"
          }`}
        >
          <span className={`w-6 h-6 flex items-center justify-center rounded-full text-xs border ${
            step > 2 ? "bg-ui-bg-interactive text-ui-fg-on-color border-transparent" : "border-ui-border-strong"
          }`}>
            {step > 2 ? "✓" : "2"}
          </span>
          Mode & Schedule
        </button>
        <div className="flex-1 h-px bg-ui-border-strong mx-4 hidden sm:block" />
        <button
          type="button"
          disabled={!isStep1Valid || !isStep2Valid}
          onClick={() => setStep(3)}
          className={`flex items-center gap-2 text-sm font-semibold transition-all disabled:opacity-50 disabled:cursor-not-allowed ${
            step === 3 ? "text-ui-fg-interactive" : "text-ui-fg-subtle hover:text-ui-fg-base"
          }`}
        >
          <span className="w-6 h-6 flex items-center justify-center rounded-full text-xs border border-ui-border-strong">
            3
          </span>
          Review & Notes
        </button>
      </div>

      <form className="flex flex-col gap-6 w-full" action={action}>
        
        {/* Step 1: Customer Information & Delivery Target Toggle */}
        {step === 1 && (
          <div className="border border-ui-border-base rounded-xl p-6 bg-ui-bg-base flex flex-col gap-6 shadow-sm animate-fadeIn">
            <Heading level="h2" className="text-lg font-bold border-b pb-2">1. Order Type & Contact</Heading>
            
            {/* Gifting / Target Selection Toggle */}
            <div className="flex flex-col gap-2">
              <Label className="font-semibold text-sm">Who is this order for?</Label>
              <div className="flex gap-3">
                <Button
                  type="button"
                  variant={orderedForSelf ? "secondary" : "transparent"}
                  onClick={() => setOrderedForSelf(true)}
                  className={`flex-1 py-2.5 text-center border font-semibold text-xs sm:text-sm ${
                    orderedForSelf ? "border-rose-500 bg-rose-50 dark:bg-rose-950 text-rose-700" : ""
                  }`}
                >
                  👤 Deliver to Me
                </Button>
                <Button
                  type="button"
                  variant={!orderedForSelf ? "secondary" : "transparent"}
                  onClick={() => setOrderedForSelf(false)}
                  className={`flex-1 py-2.5 text-center border font-semibold text-xs sm:text-sm ${
                    !orderedForSelf ? "border-rose-500 bg-rose-50 dark:bg-rose-950 text-rose-700" : ""
                  }`}
                >
                  🎁 Deliver to Someone Else
                </Button>
              </div>
              <input type="hidden" name="ordered_for_self" value={orderedForSelf ? "true" : "false"} />
            </div>

            <div className="border-t pt-4">
              <Text className="font-semibold text-sm text-ui-fg-muted mb-3">Your Details (Purchaser)</Text>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label className="font-semibold text-xs">First Name</Label>
                  <Input 
                    ref={firstNameRef}
                    placeholder="John" 
                    name="first-name" 
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    required 
                    className="mt-1" 
                  />
                </div>
                <div>
                  <Label className="font-semibold text-xs">Last Name</Label>
                  <Input 
                    placeholder="Doe" 
                    name="last-name" 
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    required 
                    className="mt-1" 
                  />
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-3">
                <div>
                  <Label className="font-semibold text-xs">Phone Number</Label>
                  <Input 
                    placeholder="555-555-5555" 
                    name="phone" 
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    required 
                    className="mt-1" 
                  />
                </div>
                <div>
                  <Label className="font-semibold text-xs">Email Address</Label>
                  <Input 
                    placeholder="john@doe.com" 
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

            {/* Recipient Details Section (When Deliver to Someone Else is selected) */}
            {!orderedForSelf && (
              <div className="border-t pt-4 flex flex-col gap-4 bg-rose-50/50 dark:bg-rose-950/20 p-4 rounded-xl border border-rose-200">
                <div className="flex items-center gap-2">
                  <span className="text-lg">🎁</span>
                  <Heading level="h3" className="text-sm font-bold text-rose-800 dark:text-rose-200">
                    Recipient Information
                  </Heading>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label className="font-semibold text-xs">Recipient Full Name *</Label>
                    <Input
                      placeholder="e.g. Jane Smith"
                      name="recipient_name"
                      value={recipientName}
                      onChange={(e) => setRecipientName(e.target.value)}
                      required={!orderedForSelf}
                      className="mt-1 bg-white dark:bg-black"
                    />
                  </div>
                  <div>
                    <Label className="font-semibold text-xs">Recipient Mobile Number *</Label>
                    <Input
                      placeholder="+91 98765 43210"
                      name="recipient_phone"
                      value={recipientPhone}
                      onChange={(e) => setRecipientPhone(e.target.value)}
                      required={!orderedForSelf}
                      className="mt-1 bg-white dark:bg-black"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label className="font-semibold text-xs">Alternate Mobile (Optional)</Label>
                    <Input
                      placeholder="+91 98765 00000"
                      name="recipient_alt_phone"
                      value={recipientAltPhone}
                      onChange={(e) => setRecipientAltPhone(e.target.value)}
                      className="mt-1 bg-white dark:bg-black"
                    />
                  </div>
                  <div>
                    <Label className="font-semibold text-xs">Landmark / Delivery Note (Optional)</Label>
                    <Input
                      placeholder="Near City Hospital / Ring doorbell twice"
                      name="recipient_landmark"
                      value={recipientLandmark}
                      onChange={(e) => setRecipientLandmark(e.target.value)}
                      className="mt-1 bg-white dark:bg-black"
                    />
                  </div>
                </div>

                {/* Gift Customization Controls */}
                <div className="border-t border-rose-200 pt-3 flex flex-col gap-3">
                  <Text className="font-semibold text-xs text-rose-900 dark:text-rose-100">Gift Customizations & Privacy</Text>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div>
                      <Label className="font-semibold text-xs">Occasion</Label>
                      <select
                        name="occasion"
                        value={occasion}
                        onChange={(e) => setOccasion(e.target.value)}
                        className="mt-1 w-full p-2 border rounded-lg text-xs bg-white dark:bg-black border-ui-border-strong"
                      >
                        <option value="birthday">🎂 Birthday</option>
                        <option value="anniversary">💍 Anniversary</option>
                        <option value="congratulations">🎉 Congratulations</option>
                        <option value="wedding">💒 Wedding</option>
                        <option value="baby_shower">👶 Baby Shower</option>
                        <option value="festival">🪔 Festival / Holiday</option>
                        <option value="other">💖 Just Because / Other</option>
                      </select>
                    </div>

                    <div className="flex flex-col justify-end gap-2">
                      <label className="flex items-center gap-2 text-xs cursor-pointer">
                        <input
                          type="checkbox"
                          name="gift_wrap"
                          checked={giftWrap}
                          onChange={(e) => setGiftWrap(e.target.checked)}
                          className="rounded text-rose-600 focus:ring-rose-500"
                        />
                        <span>🎁 Add Gift Wrap (+₹30)</span>
                      </label>
                      <label className="flex items-center gap-2 text-xs cursor-pointer">
                        <input
                          type="checkbox"
                          name="hide_invoice"
                          checked={hideInvoice}
                          onChange={(e) => setHideInvoice(e.target.checked)}
                          className="rounded text-rose-600 focus:ring-rose-500"
                        />
                        <span className="font-medium text-rose-700 dark:text-rose-300">
                          📄 Hide Invoice & Pricing from Package
                        </span>
                      </label>
                    </div>
                  </div>

                  <div>
                    <Label className="font-semibold text-xs">Custom Gift Card Message</Label>
                    <Textarea
                      name="gift_message"
                      placeholder="Write your heartful message here..."
                      value={giftMessage}
                      onChange={(e) => setGiftMessage(e.target.value)}
                      className="mt-1 text-xs bg-white dark:bg-black"
                      rows={2}
                    />
                  </div>

                  <label className="flex items-center gap-2 text-xs cursor-pointer mt-1">
                    <input
                      type="checkbox"
                      name="anonymous_delivery"
                      checked={anonymousDelivery}
                      onChange={(e) => setAnonymousDelivery(e.target.checked)}
                      className="rounded text-rose-600 focus:ring-rose-500"
                    />
                    <span>🔒 Anonymous Delivery (Keep purchaser identity secret from recipient)</span>
                  </label>
                </div>
              </div>
            )}

            <Button
              type="button"
              disabled={!isStep1Valid}
              onClick={() => setStep(2)}
              className="mt-2 w-full sm:w-fit self-end"
            >
              Continue to Delivery & Slots
            </Button>
          </div>
        )}

        {/* Step 2: Mode & Scheduling */}
        {step === 2 && (
          <div className="flex flex-col gap-6 animate-fadeIn">
            {/* Mode Selection */}
            <div className="border border-ui-border-base rounded-xl p-6 bg-ui-bg-base flex flex-col gap-4 shadow-sm">
              <Heading level="h2" className="text-lg font-bold border-b pb-2">2. Order Mode</Heading>
              <div className="flex gap-4">
                <Button
                  type="button"
                  variant={deliveryType === "delivery" ? "secondary" : "transparent"}
                  onClick={() => setDeliveryType("delivery")}
                  className="flex-1 py-3 text-center border font-semibold"
                  aria-pressed={deliveryType === "delivery"}
                >
                  🏍️ Home Delivery
                </Button>
                <Button
                  type="button"
                  variant={deliveryType === "pickup" ? "secondary" : "transparent"}
                  onClick={() => setDeliveryType("pickup")}
                  className="flex-1 py-3 text-center border font-semibold"
                  aria-pressed={deliveryType === "pickup"}
                >
                  🏪 Branch Pickup
                </Button>
              </div>
              <input type="hidden" name="delivery_type" value={deliveryType} />
            </div>

            {/* Address fields (Home Delivery only) */}
            {deliveryType === "delivery" && (
              <div className="border border-ui-border-base rounded-xl p-6 bg-ui-bg-base flex flex-col gap-4 shadow-sm">
                <Heading level="h2" className="text-lg font-bold border-b pb-2">3. Delivery Address</Heading>
                
                <div className="flex flex-col gap-2">
                  <Label htmlFor="checkout-zip" className="font-semibold text-sm">Pincode / Zip Code</Label>
                  <div className="flex gap-2 items-center mt-1">
                    <Input 
                      ref={zipInputRef}
                      id="checkout-zip"
                      placeholder="e.g. 110001" 
                      name="zip" 
                      value={zip}
                      onChange={(e) => {
                        setZip(e.target.value);
                        setResult(null);
                      }}
                      required
                      className="flex-1"
                      aria-required="true"
                    />
                    <Button 
                      type="button" 
                      variant="secondary" 
                      onClick={handleCheckPincode}
                      isLoading={checking}
                    >
                      Verify Pincode
                    </Button>
                  </div>
                  {result && result.checked && (
                    <div className="mt-1">
                      {result.serviceable ? (
                        <Badge color="green">
                          ✓ Serviceable! Delivery Fee: €{Number(result.deliveryFee).toFixed(2)}
                        </Badge>
                      ) : (
                        <Badge color="red">
                          ✗ {result.message || "This location is not serviceable for cake delivery"}
                        </Badge>
                      )}
                    </div>
                  )}
                  {!result && (
                    <div className="text-xs text-ui-fg-subtle italic mt-1">
                      Please enter and verify your pincode to check delivery serviceability.
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-1 gap-4">
                  <div>
                    <Label className="font-semibold text-sm">Street Address</Label>
                    <Input 
                      placeholder="1234 Main St" 
                      name="address" 
                      value={address}
                      onChange={(e) => setAddress(e.target.value)}
                      required 
                      className="mt-1" 
                      aria-required="true"
                    />
                  </div>
                  <div>
                    <Label className="font-semibold text-sm">City</Label>
                    <Input 
                      placeholder="San Francisco" 
                      name="city" 
                      value={city}
                      onChange={(e) => setCity(e.target.value)}
                      required 
                      className="mt-1" 
                      aria-required="true"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Date & Time Slot Picker */}
            <div className="border border-ui-border-base rounded-xl p-6 bg-ui-bg-base flex flex-col gap-4 shadow-sm">
              <Heading level="h2" className="text-lg font-bold border-b pb-2">
                {deliveryType === "delivery" ? "4. Delivery Scheduling" : "3. Pickup Scheduling"}
              </Heading>

              {/* Date Picker */}
              <div className="flex flex-col gap-1">
                <Label className="font-semibold text-sm">Select Date</Label>
                <select
                  value={selectedDate}
                  onChange={(e) => setSelectedDate(e.target.value)}
                  className="mt-1 block w-full rounded-md border border-ui-border-base bg-ui-bg-base px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-ui-border-interactive"
                  aria-label="Select delivery date"
                >
                  {datesOptions.map((date) => (
                    <option key={date.value} value={date.value}>
                      {date.label}
                    </option>
                  ))}
                </select>
                <input type="hidden" name="delivery_date" value={selectedDate} />
              </div>

              {/* Time Slot Picker Grid */}
              <div className="flex flex-col gap-2 mt-2">
                <Label className="font-semibold text-sm">Select Time Slot</Label>
                
                {loadingSlots ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-1">
                    {[1, 2, 3, 4].map((i) => (
                      <div key={i} className="animate-pulse bg-ui-bg-subtle border rounded-lg h-20 w-full" />
                    ))}
                  </div>
                ) : slots.length === 0 ? (
                  <div className="bg-ui-bg-subtle border border-dashed rounded-lg p-6 text-center">
                    <Text className="text-sm text-ui-fg-subtle italic">No operational slots configured for this date.</Text>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-1">
                    {slots.map((slot) => {
                      const isAvailable = slot.available;
                      const isSelected = selectedSlotId === slot.id;
                      const isAlmostFull = isAvailable && slot.remaining_capacity <= 3;

                      return (
                        <button
                          key={slot.id}
                          type="button"
                          disabled={!isAvailable}
                          onClick={() => setSelectedSlotId(slot.id)}
                          className={`flex flex-col text-left border rounded-lg p-3 transition-all ${
                            isSelected 
                              ? "border-ui-border-interactive bg-ui-bg-subtle-hover shadow-sm ring-1 ring-ui-border-interactive" 
                              : isAvailable 
                                ? "border-ui-border-base hover:bg-ui-bg-subtle" 
                                : "bg-ui-bg-disabled opacity-50 cursor-not-allowed"
                          }`}
                          aria-label={`${slot.slot_name}, timing ${slot.start_time} to ${slot.end_time}. ${isAvailable ? "" : "Sold Out."} ${slot.extra_charge > 0 ? `Extra charge of €${Number(slot.extra_charge).toFixed(2)}` : ""}`}
                        >
                          <div className="flex justify-between items-center w-full">
                            <span className="font-bold text-sm">{slot.slot_name}</span>
                            {!isAvailable && (
                              <Badge color="red" size="small">Sold Out</Badge>
                            )}
                            {isAlmostFull && (
                              <Badge color="orange" size="small">🔥 Only {slot.remaining_capacity} left!</Badge>
                            )}
                          </div>
                          <span className="text-xs text-ui-fg-subtle mt-0.5">
                            Timing: {slot.start_time} - {slot.end_time}
                          </span>
                          {slot.extra_charge > 0 && (
                            <span className="text-xs text-ui-fg-orange font-semibold mt-1">
                              +€{Number(slot.extra_charge).toFixed(2)} Surcharge
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                )}
                <input type="hidden" name="delivery_slot_id" value={selectedSlotId} />
              </div>
            </div>

            <div className="flex justify-between mt-4">
              <Button type="button" variant="secondary" onClick={() => setStep(1)}>
                Back to Contact
              </Button>
              <Button type="button" disabled={!isStep2Valid} onClick={() => setStep(3)}>
                Continue to Review
              </Button>
            </div>
          </div>
        )}

        {/* Step 3: Review & Final Notes */}
        {step === 3 && (
          <div className="flex flex-col gap-6 animate-fadeIn">
            {/* Overview Card */}
            <div className="border border-ui-border-base rounded-xl p-6 bg-ui-bg-base flex flex-col gap-4 shadow-sm">
              <Heading level="h2" className="text-lg font-bold border-b pb-2">Order Summary Review</Heading>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-sm">
                <div className="flex flex-col gap-1">
                  <Text className="font-bold text-ui-fg-subtle">Customer Details</Text>
                  <Text>{firstName} {lastName}</Text>
                  <Text>{phone}</Text>
                  <Text>{email}</Text>
                </div>
                <div className="flex flex-col gap-1">
                  <Text className="font-bold text-ui-fg-subtle">Delivery Mode & Schedule</Text>
                  <Text className="capitalize font-semibold">{deliveryType} Order</Text>
                  {deliveryType === "delivery" ? (
                    <Text>{address}, {city} (Pincode: {zip})</Text>
                  ) : (
                    <Text className="italic text-ui-fg-subtle">Collect directly from branch store</Text>
                  )}
                  <Text className="mt-1 font-semibold text-ui-fg-interactive">
                    🗓️ Date: {selectedDate} | Slot: {slots.find((s) => s.id === selectedSlotId)?.slot_name || "Selected slot"}
                  </Text>
                </div>
              </div>
            </div>

            {/* Unified Rewards Redemption Widget */}
            {(wallet || (loyalty && loyalty.points >= 100)) && (
              <div className="border border-ui-border-base rounded-xl p-6 bg-ui-bg-base flex flex-col gap-4 shadow-sm">
                <Heading level="h2" className="text-lg font-bold border-b pb-2">Apply Customer Rewards</Heading>
                
                {/* Wallet balance */}
                {wallet && wallet.balance > 0 && (
                  <div className="flex flex-col gap-2">
                    <div className="flex items-center justify-between">
                      <label className="flex items-center gap-2 text-sm font-semibold cursor-pointer">
                        <input
                          type="checkbox"
                          checked={useWallet}
                          onChange={(e) => {
                            setUseWallet(e.target.checked);
                            if (e.target.checked) {
                              const ptsVal = useLoyalty ? (loyaltyPointsToRedeem / 10) * 100 : 0;
                              const maxApply = Math.min(wallet.balance, cartTotal * 100 - ptsVal);
                              setWalletAmount(maxApply);
                            } else {
                              setWalletAmount(0);
                            }
                          }}
                        />
                        Apply Store Credit (Wallet)
                      </label>
                      <span className="text-sm font-semibold">{currencySymbol}{(wallet.balance / 100).toFixed(2)} available</span>
                    </div>
                    {useWallet && (
                      <div className="pl-6 flex flex-col gap-1">
                        <Text className="text-xs text-ui-fg-subtle">
                          Applying {currencySymbol}{(walletAmount / 100).toFixed(2)} to this order.
                        </Text>
                        <input
                          type="number"
                          value={walletAmount}
                          onChange={(e) => {
                            const val = Math.min(wallet.balance, Number(e.target.value), cartTotal * 100 - (useLoyalty ? (loyaltyPointsToRedeem / 10) * 100 : 0));
                            setWalletAmount(val);
                          }}
                          className="w-32 px-2 py-1 text-xs border border-ui-border-base rounded bg-ui-bg-field"
                        />
                      </div>
                    )}
                  </div>
                )}

                {/* Loyalty points */}
                {loyalty && loyalty.points >= 100 && (
                  <div className="flex flex-col gap-2 border-t pt-3 mt-1">
                    <div className="flex items-center justify-between">
                      <label className="flex items-center gap-2 text-sm font-semibold cursor-pointer">
                        <input
                          type="checkbox"
                          checked={useLoyalty}
                          onChange={(e) => {
                            setUseLoyalty(e.target.checked);
                            if (!e.target.checked) {
                              setLoyaltyPointsToRedeem(0);
                            }
                          }}
                        />
                        Redeem Loyalty Points
                      </label>
                      <span className="text-sm font-semibold">{loyalty.points} points available</span>
                    </div>
                    {useLoyalty && (
                      <div className="pl-6 flex flex-col gap-2">
                        <div className="flex items-center gap-2 text-xs">
                          <span>Use</span>
                          <input
                            type="number"
                            min="100"
                            max={loyalty.points}
                            step="100"
                            value={loyaltyPointsToRedeem}
                            onChange={(e) => {
                              const pts = Math.min(loyalty.points, Math.floor(Number(e.target.value) / 100) * 100);
                              setLoyaltyPointsToRedeem(pts);
                              if (useWallet) {
                                const maxApply = Math.min(wallet.balance, cartTotal * 100 - (pts / 10) * 100);
                                setWalletAmount(maxApply);
                              }
                            }}
                            className="w-24 px-2 py-1 border border-ui-border-base rounded bg-ui-bg-field text-center font-mono"
                          />
                          <span>points for a discount of {currencySymbol}{(loyaltyPointsToRedeem / 10).toFixed(2)}.</span>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Gift Card code input */}
                <div className="flex flex-col gap-2 border-t pt-3 mt-1">
                  <Label className="font-semibold text-sm">Apply Gift Card Code</Label>
                  <div className="flex gap-2">
                    <Input
                      placeholder="GC-XXXX-XXXX"
                      value={giftCardCodeInput}
                      onChange={(e) => setGiftCardCodeInput(e.target.value)}
                      className="flex-1 text-sm font-mono"
                    />
                    <Button type="button" variant="secondary" onClick={handleApplyGiftCard}>
                      Apply
                    </Button>
                  </div>
                  {giftCardError && (
                    <Text className="text-xs text-ui-fg-red font-semibold">{giftCardError}</Text>
                  )}
                  {giftCardSuccess && (
                    <Text className="text-xs text-green-600 font-semibold">{giftCardSuccess}</Text>
                  )}
                </div>

                {/* Applied summary & breakdown */}
                <div className="bg-ui-bg-subtle p-4 rounded-lg mt-2 flex flex-col gap-1 text-xs border">
                  <div className="flex justify-between font-semibold border-b pb-1 mb-1">
                    <span>Summary of discounts</span>
                    <span>Values</span>
                  </div>
                  {useWallet && walletAmount > 0 && (
                    <div className="flex justify-between text-ui-fg-subtle">
                      <span>Wallet Credit Applied:</span>
                      <span>-{currencySymbol}{(walletAmount / 100).toFixed(2)}</span>
                    </div>
                  )}
                  {useLoyalty && loyaltyPointsToRedeem > 0 && (
                    <div className="flex justify-between text-ui-fg-subtle">
                      <span>Loyalty Discount:</span>
                      <span>-{currencySymbol}{(loyaltyPointsToRedeem / 10).toFixed(2)}</span>
                    </div>
                  )}
                  {appliedGiftCard && (
                    <div className="flex justify-between text-ui-fg-subtle">
                      <span>Gift Card ({appliedGiftCard.code}):</span>
                      <span>-{currencySymbol}{(Math.min(appliedGiftCard.current_balance, cartTotal * 100 - walletValue - pointsValue) / 100).toFixed(2)}</span>
                    </div>
                  )}
                  <div className="flex justify-between font-bold text-sm text-ui-fg-base pt-2 border-t mt-1">
                    <span>Remaining Payable Amount:</span>
                    <span>{currencySymbol}{(netPayable / 100).toFixed(2)}</span>
                  </div>
                </div>

                {/* Hidden form fields to pass to the placeOrder server action */}
                <input type="hidden" name="applied_wallet" value={useWallet ? walletAmount : 0} />
                <input type="hidden" name="applied_points" value={useLoyalty ? loyaltyPointsToRedeem : 0} />
                <input type="hidden" name="applied_gift_card" value={appliedGiftCard ? appliedGiftCard.code : ""} />
                <input type="hidden" name="applied_gift_card_amount" value={appliedGiftCard ? Math.min(appliedGiftCard.current_balance, cartTotal * 100 - walletValue - pointsValue) : 0} />
              </div>
            )}

            {/* Additional Notes */}
            <div className="border border-ui-border-base rounded-xl p-6 bg-ui-bg-base flex flex-col gap-4 shadow-sm">
              <Heading level="h2" className="text-lg font-bold border-b pb-2">Delivery Instructions / Notes</Heading>
              <div>
                <Label className="font-semibold text-sm">Order Notes</Label>
                <Textarea 
                  ref={notesRef}
                  placeholder="Leave any instructions (e.g. ring bell, leave at front door, gate code, message on cake box, etc.)" 
                  name="notes" 
                  className="mt-1"
                />
              </div>
            </div>

            <input type="hidden" name="shop-id" value={shopId} />
            <input type="hidden" name="first-name" value={firstName} />
            <input type="hidden" name="last-name" value={lastName} />
            <input type="hidden" name="phone" value={phone} />
            <input type="hidden" name="email" value={email} />
            <input type="hidden" name="address" value={address} />
            <input type="hidden" name="city" value={city} />
            <input type="hidden" name="zip" value={zip} />

            <div className="flex justify-between items-center border-t pt-4">
              <Button type="button" variant="secondary" onClick={() => setStep(2)}>
                Back to Details
              </Button>
              <div className="flex flex-col items-end gap-2">
                <Submit disabled={isSubmitDisabled} />
                {isSubmitDisabled && (
                  <Text className="text-xs text-ui-fg-red mt-1">
                    * Please ensure all previous step fields are valid.
                  </Text>
                )}
              </div>
            </div>
          </div>
        )}

        {state.message && (
          <ErrorComponent
            title="Order Submission Failed"
            message={state.message}
          />
        )}
      </form>
    </div>
  );
}
