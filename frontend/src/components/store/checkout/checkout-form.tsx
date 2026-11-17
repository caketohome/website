"use client";

import { placeOrder } from "@frontend/lib/actions/checkout";
import { apiClient } from "@frontend/lib/api-client";
import { PENDING_COUPON_KEY } from "@frontend/lib/util/clipboard";
import { HttpTypes } from "@frontend/lib/types";
import { Badge, Button, Heading, Input, Label, Text, Textarea } from "@medusajs/ui";
import { useFormState, useFormStatus } from "react-dom";
import { useState, useEffect, useRef, useCallback } from "react";
import { ErrorComponent } from "@frontend/components/common/error-component";
import dynamic from "next/dynamic";
import { OrderSummary, OrderSummaryPricing } from "./order-summary";
import { MapPin, Navigation, Search, CheckCircle2, Crosshair, AlertCircle, AlertTriangle, Bookmark, Loader2 } from "lucide-react";
import { isValidCoordinate } from "@frontend/lib/location/directions";

const CheckoutMap = dynamic(
  () => import("./checkout-map").then((mod) => mod.CheckoutMap),
  {
    ssr: false,
    loading: () => (
      <div className="w-full h-[240px] rounded-2xl bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 flex items-center justify-center text-xs text-zinc-500 animate-pulse">
        <Loader2 className="w-4 h-4 animate-spin text-brand-text mr-2" />
        Loading delivery map...
      </div>
    ),
  }
);

export interface PickupBranch {
 id: string;
 name: string;
 address: string;
 pincode: string;
 timing?: string;
 is_open?: boolean;
}

export type LocationSource = "GPS" | "SEARCH" | "MAP_PIN" | "SAVED_ADDRESS" | "EXPLICIT_GEOCODE" | null;

export interface CustomerLocation {
 latitude: number | null;
 longitude: number | null;
 accuracy: number | null;
 source: LocationSource;
}

function Submit({ disabled, paymentMethod }: { disabled?: boolean; paymentMethod?: string }) {
 const status = useFormStatus();

  return (
  <Button
  type="submit"
  size="large"
  className="w-full sm:w-auto mt-6 bg-brand-primary hover:bg-brand-secondary text-white font-sans font-bold tracking-wider text-[14px] px-8 py-4 rounded-xl shadow-lg border border-blue-200 transition-all hover:scale-[1.01]"
  isLoading={status.pending}
  disabled={disabled}
  aria-label="Confirm and place your cake order"
  >
  {paymentMethod === "razorpay" || (paymentMethod === "razorpay" || paymentMethod === "cashfree")
    ? "Proceed to Razorpay Payment 💳"
    : paymentMethod === "cod"
    ? "Confirm Cash on Delivery 💵"
    : "Place Order Now 🎂"}
  </Button>
  );
}

export default function CheckoutForm({ cart }: { cart: HttpTypes.StoreCart }) {
 const [state, action] = useFormState(placeOrder, { message: "" });
 const [zip, setZip] = useState(cart.shipping_address?.postal_code || "");
 const [checking, setChecking] = useState(false);
 
 // Delivery type selection (Delivery vs Branch Pickup)
 const [deliveryType, setDeliveryType] = useState<"delivery" | "pickup">("delivery");
 const [selectedBranchId, setSelectedBranchId] = useState<string>("");
 const [pickupBranches, setPickupBranches] = useState<PickupBranch[]>([]);
 // Hidden until the server confirms each option is switched on (avoids flashing disabled options).
 const [storePickupEnabled, setStorePickupEnabled] = useState<boolean>(false);
 const [codEnabled, setCodEnabled] = useState<boolean>(false);
 const [testPaymentsEnabled, setTestPaymentsEnabled] = useState<boolean>(false);
 const [storePickupFee, setStorePickupFee] = useState<number>(0);

 // Step state: 1 = Contact & Occasion, 2 = Fulfillment & Schedule, 3 = Payment & Finalize
 const [step, setStep] = useState<1 | 2 | 3>(1);

 // References for focus management
 const firstNameRef = useRef<HTMLInputElement>(null);
 const searchInputRef = useRef<HTMLInputElement>(null);
 const searchContainerRef = useRef<HTMLDivElement>(null);
 const notesRef = useRef<HTMLTextAreaElement>(null);

 // Contact fields (authoritative customer or empty)
 const [firstName, setFirstName] = useState(cart.shipping_address?.first_name || "");
 const [lastName, setLastName] = useState(cart.shipping_address?.last_name || "");
 const [phone, setPhone] = useState(cart.shipping_address?.phone || "");
 const [email, setEmail] = useState((cart as any).email || "");

 // ── 1. Authoritative Customer Map Location ─────────────────────────────
 const initialLat = (cart.shipping_address as any)?.latitude ? Number((cart.shipping_address as any).latitude) : null;
 const initialLng = (cart.shipping_address as any)?.longitude ? Number((cart.shipping_address as any).longitude) : null;

 const [customerLocation, setCustomerLocation] = useState<CustomerLocation>({
 latitude: initialLat,
 longitude: initialLng,
 accuracy: null,
 source: initialLat && initialLng ? "SAVED_ADDRESS" : null,
 });

 const latitude = customerLocation.latitude;
 const longitude = customerLocation.longitude;
 const locationSource = customerLocation.source;
 const gpsAccuracy = customerLocation.accuracy;
 const [locatingGps, setLocatingGps] = useState<boolean>(false);
 const [gpsError, setGpsError] = useState<string | null>(null);

 // ── 2. Delivery Address Text (Decoupled from Map Coordinates) ───────────
 const [address, setAddress] = useState(cart.shipping_address?.address_1 || "");
 const [city, setCity] = useState(cart.shipping_address?.city || "");
 const [isGeocodingAddress, setIsGeocodingAddress] = useState<boolean>(false);
 const [addressGeocodeNotice, setAddressGeocodeNotice] = useState<string | null>(null);

 // Stale response protection sequence counter
 const availabilitySeqRef = useRef<number>(0);

 // Search location autocomplete state
 const [locationSearchQuery, setLocationSearchQuery] = useState<string>("");
 const [locationSearchResults, setLocationSearchResults] = useState<any[]>([]);
 const [isSearchingLocation, setIsSearchingLocation] = useState<boolean>(false);
 const [showLocationDropdown, setShowLocationDropdown] = useState<boolean>(false);

 // Customer Saved Addresses
 const [savedAddresses, setSavedAddresses] = useState<any[]>([]);
 const [selectedAddressId, setSelectedAddressId] = useState<string>("");

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
 const [giftCardCodeInput, setGiftCardCodeInput] = useState<string>(cart?.promo_code || "");
 const [appliedCouponCode, setAppliedCouponCode] = useState<string>(cart?.promo_code || "");
 const [couponDiscount, setCouponDiscount] = useState<number>(cart?.discount_total || 0);
 const [couponError, setCouponError] = useState<string>("");
 const [couponSuccess, setCouponSuccess] = useState<string>(
   cart?.promo_code && (cart?.discount_total || 0) > 0
     ? `🎉 Coupon ${cart.promo_code} applied! You saved ₹${cart.discount_total}.`
     : ""
 );
 const [paymentMethod, setPaymentMethod] = useState<"cod" | "razorpay" | "cashfree" | "test_mode">("razorpay");
 // A hidden payment option must never stay selected.
 useEffect(() => {
 if ((paymentMethod === "cod" && !codEnabled) || (paymentMethod === "test_mode" && !testPaymentsEnabled)) {
 setPaymentMethod("razorpay");
 }
 }, [paymentMethod, codEnabled, testPaymentsEnabled]);

 // Availability, Dates, Slots & Real-time Pricing State
 const [availability, setAvailability] = useState<{
 serviceable: boolean;
 branch_id: string | null;
 branch_name: string | null;
 store_lat?: number;
 store_lng?: number;
 distance_km?: number | null;
 eta_minutes?: number | { min: number; max: number };
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
 const [notifiedLocation, setNotifiedLocation] = useState(false);

 // Authoritative Availability Resolution Engine with Stale Response Protection
 const fetchAvailability = useCallback(async (customParams?: {
 zip?: string;
 lat?: number;
 lng?: number;
 type?: "delivery" | "pickup";
 branch?: string;
 date?: string;
 slot?: string;
 coupon?: string;
 }) => {
 const seq = ++availabilitySeqRef.current;
 setLoadingAvailability(true);
 const targetZip = customParams?.zip ?? zip;
 const targetLat = customParams?.lat !== undefined ? customParams.lat : (latitude ?? undefined);
 const targetLng = customParams?.lng !== undefined ? customParams.lng : (longitude ?? undefined);
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
 latitude: typeof targetLat === "number" ? targetLat : undefined,
 longitude: typeof targetLng === "number" ? targetLng : undefined,
 branch_id: targetType === "pickup" ? targetBranch : undefined,
 date: targetDate,
 slot_id: targetSlot || undefined,
 coupon_code: targetCoupon || undefined,
 });

 // Stale response protection: Ignore if a newer request has already been dispatched
 if (seq !== availabilitySeqRef.current) {
 return;
 }

 if (res && res.success) {
 setAvailability(res);
 if (res.store_pickup_enabled !== undefined) {
 setStorePickupEnabled(Boolean(res.store_pickup_enabled));
 if (!res.store_pickup_enabled && targetType === "pickup") {
 setDeliveryType("delivery");
 }
 }
 if (res.store_pickup_convenience_fee !== undefined) {
 setStorePickupFee(Number(res.store_pickup_convenience_fee) || 0);
 }
 if (res.cod_enabled !== undefined) {
 setCodEnabled(Boolean(res.cod_enabled));
 }
 if (res.test_payments_enabled !== undefined) {
 setTestPaymentsEnabled(Boolean(res.test_payments_enabled));
 }
 if (res.branch_id) {
 setSelectedBranchId(res.branch_id);
 }
 // If current selected date is not available (e.g. same-day cutoff passed), auto-advance to first available date
 if (res.available_dates && res.available_dates.length > 0) {
 const currentDateEntry = res.available_dates.find((d: any) => d.date === targetDate);
 if (currentDateEntry && !currentDateEntry.is_available && !customParams?.date) {
 const nextOpenDate = res.available_dates.find((d: any) => d.is_available);
 if (nextOpenDate) {
 setSelectedDate(nextOpenDate.date);
 }
 }
 }
 // Auto-select first available slot if current is invalid
 const validSlots = res.available_slots || [];
 const isCurrentSlotValid = validSlots.some((s: any) => s.id === targetSlot && (s.available || s.is_available));
 if (!isCurrentSlotValid) {
 const firstAvailable = validSlots.find((s: any) => s.available || s.is_available);
 if (firstAvailable) {
 setSelectedSlotId(firstAvailable.id);
 } else {
 setSelectedSlotId("");
 }
 }
 }
 } catch (e) {
 if (seq === availabilitySeqRef.current) {
 console.error("Failed to load checkout availability", e);
 }
 } finally {
 if (seq === availabilitySeqRef.current) {
 setLoadingAvailability(false);
 }
 }
 }, [cart.id, zip, latitude, longitude, deliveryType, selectedBranchId, selectedDate, selectedSlotId, appliedCouponCode]);

 // Load Saved Addresses, Fulfillment Configuration, and Active Pickup Branches on mount
 useEffect(() => {
 fetch("/api/customer/address")
 .then((res) => res.json())
 .then((data) => {
 if (data && data.success && Array.isArray(data.data?.addresses)) {
 setSavedAddresses(data.data.addresses);
 }
 })
 .catch(() => {});

 fetch("/api/v1/fulfillment/config")
 .then((res) => res.json())
 .then((data) => {
 if (data && data.config) {
 const pickupOn = data.config.store_pickup_enabled !== false;
 setStorePickupEnabled(pickupOn);
 if (!pickupOn && deliveryType === "pickup") {
 setDeliveryType("delivery");
 }
 if (data.config.store_pickup_convenience_fee !== undefined) {
 setStorePickupFee(Number(data.config.store_pickup_convenience_fee) || 0);
 }
 setCodEnabled(data.config.cod_enabled !== false);
 }
 if (data && data.test_payments_enabled !== undefined) {
 setTestPaymentsEnabled(Boolean(data.test_payments_enabled));
 }
 })
 .catch(() => {});

 fetch("/api/v1/branches")
 .then((res) => res.json())
 .then((data) => {
 if (data && Array.isArray(data.branches) && data.branches.length > 0) {
 const eligible = data.branches
 .filter((b: any) => b.status === "active" && b.is_open !== false && b.pickup_enabled !== false && b.allow_pickup !== false)
 .map((b: any) => ({
 id: b.id,
 name: b.name,
 address: b.address || `${b.city || ""} Kitchen`.trim(),
 pincode: b.pincode || "",
 timing: b.timing || "09:00 AM - 11:00 PM",
 is_open: b.is_open !== false,
 }));
 if (eligible.length > 0) {
 setPickupBranches(eligible);
 setSelectedBranchId((prev) => (prev && eligible.some((b: any) => b.id === prev) ? prev : eligible[0].id));
 }
 }
 })
 .catch(() => {});
 }, [deliveryType]);

 // Handle GPS "Use Current Location"
 const handleUseCurrentLocation = () => {
 if (!navigator.geolocation) {
 setGpsError("Geolocation is not supported by your browser. Please search for your delivery address.");
 return;
 }
 setLocatingGps(true);
 setGpsError(null);

 navigator.geolocation.getCurrentPosition(
 async (pos) => {
 const lat = Number(pos.coords.latitude.toFixed(6));
 const lng = Number(pos.coords.longitude.toFixed(6));
 const accuracy = pos.coords.accuracy;
 setCustomerLocation({
 latitude: lat,
 longitude: lng,
 accuracy,
 source: "GPS",
 });

 try {
 const res = await apiClient.reverseGeocode(lat, lng);
 if (res && res.success) {
 if (res.address_line_1 && !res.address_line_1.startsWith("GPS (")) {
 setAddress((prev: string) => (prev && !prev.startsWith("GPS (") ? prev : (res.address_line_1 || "")));
 }
 if (res.city) setCity((prev: string) => (prev ? prev : (res.city || "")));
 if (res.pincode) setZip((prev: string) => (prev ? prev : (res.pincode || "")));
 if (res.formatted_address) setLocationSearchQuery(res.formatted_address);
 fetchAvailability({ zip: res.pincode, lat, lng });
 } else {
 fetchAvailability({ lat, lng });
 }
 } catch {
 fetchAvailability({ lat, lng });
 } finally {
 setLocatingGps(false);
 }
 },
 (err) => {
 setLocatingGps(false);
 if (err.code === 1) {
 setGpsError("Location access was not allowed. Search for your delivery address instead.");
 } else if (err.code === 2) {
 setGpsError("Position unavailable. Search for your delivery address instead.");
 } else if (err.code === 3) {
 setGpsError("Location request timed out. Search for your delivery address instead.");
 } else {
 setGpsError("Unable to retrieve GPS coordinates. Search for your delivery address instead.");
 }
 searchInputRef.current?.focus();
 },
 { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
 );
 };

 // Handle Location Search Autocomplete with AbortController and Stale Request Protection
 const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);
 const searchAbortControllerRef = useRef<AbortController | null>(null);
 const searchSeqRef = useRef<number>(0);

 // Dismiss autocomplete dropdown when clicking outside search container
 useEffect(() => {
 function handleClickOutside(e: MouseEvent) {
 if (searchContainerRef.current && !searchContainerRef.current.contains(e.target as Node)) {
 setShowLocationDropdown(false);
 }
 }
 document.addEventListener("mousedown", handleClickOutside);
 return () => document.removeEventListener("mousedown", handleClickOutside);
 }, []);

 const handleSearchLocationInput = (val: string) => {
 setLocationSearchQuery(val);
 if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
 if (searchAbortControllerRef.current) {
 searchAbortControllerRef.current.abort();
 searchAbortControllerRef.current = null;
 }

 if (!val || val.trim().length < 2) {
 setLocationSearchResults([]);
 setShowLocationDropdown(false);
 setIsSearchingLocation(false);
 return;
 }

 setIsSearchingLocation(true);
 setShowLocationDropdown(true);

 const seq = ++searchSeqRef.current;
 searchTimeoutRef.current = setTimeout(async () => {
 const controller = new AbortController();
 searchAbortControllerRef.current = controller;
 try {
 const res: any = await fetch(`/api/v1/delivery/search-location?q=${encodeURIComponent(val.trim())}`, {
 signal: controller.signal,
 }).then(r => r.json());

 if (seq === searchSeqRef.current) {
 setLocationSearchResults(res?.results || []);
 }
 } catch (err: any) {
 if (err.name !== "AbortError" && seq === searchSeqRef.current) {
 setLocationSearchResults([]);
 }
 } finally {
 if (seq === searchSeqRef.current) {
 setIsSearchingLocation(false);
 }
 }
 }, 300);
 };

 // Select Search Autocomplete Location Result
 const handleSelectSearchResult = (loc: any) => {
 setLocationSearchQuery(loc.label || loc.formatted_address);
 setShowLocationDropdown(false);
 if (typeof loc.latitude === "number" && typeof loc.longitude === "number") {
 const lat = Number(loc.latitude.toFixed(6));
 const lng = Number(loc.longitude.toFixed(6));
 setCustomerLocation({
 latitude: lat,
 longitude: lng,
 accuracy: null,
 source: "SEARCH",
 });
 if (loc.city) setCity((prev: string) => (prev ? prev : loc.city));
 if (loc.pincode) {
 setZip((prev: string) => (prev ? prev : loc.pincode));
 }
 fetchAvailability({
 zip: loc.pincode,
 lat,
 lng,
 });
 }
 };

 // Handle Location Pin Dragged on Map
 const handleLocationChangeFromMap = async (newLat: number, newLng: number) => {
 const lat = Number(newLat.toFixed(6));
 const lng = Number(newLng.toFixed(6));
 setCustomerLocation({
 latitude: lat,
 longitude: lng,
 accuracy: null,
 source: "MAP_PIN",
 });
 fetchAvailability({ lat, lng });

 // Reverse geocode in background to provide helpful city/pincode hints without overwriting user address
 try {
 const res = await apiClient.reverseGeocode(lat, lng);
 if (res && res.success) {
 if (res.city && !city) setCity(res.city);
 if (res.pincode && !zip) setZip(res.pincode);
 if (res.formatted_address) setLocationSearchQuery(res.formatted_address);
 }
 } catch {}
 };

 // Select Saved Address
 const handleSelectSavedAddress = (addr: any) => {
 setSelectedAddressId(addr.id);
 setAddress(addr.address_1 || addr.address || "");
 setCity(addr.city || "");
 const pin = addr.postal_code || addr.pincode || "";
 if (pin) setZip(pin);
 if (addr.landmark) setRecipientLandmark(addr.landmark);
 if (addr.instructions) setDeliveryInstructions(addr.instructions);

 if (typeof addr.latitude === "number" && typeof addr.longitude === "number") {
 const lat = Number(addr.latitude.toFixed(6));
 const lng = Number(addr.longitude.toFixed(6));
 setCustomerLocation({
 latitude: lat,
 longitude: lng,
 accuracy: null,
 source: "SAVED_ADDRESS",
 });
 fetchAvailability({ zip: pin, lat, lng });
 } else {
 setCustomerLocation({
 latitude: null,
 longitude: null,
 accuracy: null,
 source: null,
 });
 fetchAvailability({ zip: pin });
 }
 };

 // Explicit Location Action: Search typed address text on map
 const handleSearchAddressOnMap = async () => {
 const query = [address, city, zip].filter(Boolean).join(", ");
 if (!query || query.trim().length < 3) {
 setAddressGeocodeNotice("Please enter at least a street address or city to locate on map.");
 return;
 }
 setIsGeocodingAddress(true);
 setAddressGeocodeNotice(null);

 try {
 const res: any = await apiClient.searchDeliveryLocation(query);
 let match = res?.results?.[0];
 if (!match && (city || zip)) {
 const fbRes: any = await apiClient.searchDeliveryLocation([city, zip].filter(Boolean).join(" "));
 match = fbRes?.results?.[0];
 }

 if (match && typeof match.latitude === "number" && typeof match.longitude === "number") {
 const lat = Number(match.latitude.toFixed(6));
 const lng = Number(match.longitude.toFixed(6));
 setCustomerLocation({
 latitude: lat,
 longitude: lng,
 accuracy: null,
 source: "EXPLICIT_GEOCODE",
 });
 setAddressGeocodeNotice(`✓ Map updated to ${match.label || match.city || "location"}`);
 fetchAvailability({ lat, lng, zip: match.pincode || zip });
 } else {
 setAddressGeocodeNotice("Could not find this exact address on the map. Please use the search bar or move the pin.");
 }
 } catch {
 setAddressGeocodeNotice("Failed to locate address on map. Please use the search bar above.");
 } finally {
 setIsGeocodingAddress(false);
 }
 };

 // Initial Load: Only fetch if pickup mode or initial coordinates / 6-digit zip are present
 useEffect(() => {
 if (deliveryType === "pickup" || typeof latitude === "number" || (zip && zip.length === 6)) {
 fetchAvailability();
 }
 // eslint-disable-next-line react-hooks/exhaustive-deps
 }, []);

 // Periodic Refresh of Slots & Capacity every 30 seconds (stabilized ref)
 const fetchAvailabilityRef = useRef(fetchAvailability);
 useEffect(() => {
 fetchAvailabilityRef.current = fetchAvailability;
 }, [fetchAvailability]);

 useEffect(() => {
 const timer = setInterval(() => {
 fetchAvailabilityRef.current();
 }, 30000);
 return () => clearInterval(timer);
 }, []);

 // Pincode Verification Handler (Strict fallback ONLY if customer has not selected map coordinates)
 const handleCheckPincode = async () => {
 if (typeof latitude === "number" && typeof longitude === "number") {
 // Map coordinates are strictly authoritative. Editing/blurring pincode does NOT drop or override coordinates!
 return;
 }
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
 const todayIso = new Date().toISOString().slice(0, 10);
 const isTargetToday = date === todayIso;

 let targetSlot = selectedSlotId;
 if (!isTargetToday && selectedSlotId?.includes("EXPRESS")) {
 targetSlot = "";
 setSelectedSlotId("");
 }
 fetchAvailability({ date, slot: targetSlot });
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

  // Apply a coupon claimed from a promo banner or preserved on the cart.
  // Revalidates eligibility, minimum order, cap and expiry server-side.
  useEffect(() => {
    if (!cart?.id) return;
    let pending: string | null = null;
    try {
      pending = sessionStorage.getItem(PENDING_COUPON_KEY);
    } catch {}
    const targetCode = (pending || cart?.promo_code || "").trim().toUpperCase();
    if (!targetCode) return;
    setGiftCardCodeInput(targetCode);
    apiClient
      .applyPromoCode(cart.id, targetCode)
      .then((res: any) => {
        if (res?.valid) {
          setAppliedCouponCode(res.code);
          setCouponDiscount(res.discount || 0);
          setCouponSuccess(`🎉 Coupon ${res.code} applied! You saved ₹${res.discount}.`);
          fetchAvailability({ coupon: res.code });
        } else {
          setCouponError(res?.error || "Invalid or expired coupon code.");
        }
      })
      .catch((e: any) => setCouponError(e?.message || "Failed to validate promo code."));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cart?.id]);

  // Step 1 Validation
 const isStep1Valid = firstName.trim() !== "" && phone.trim().length >= 10 && email.includes("@");

 const currentSlots = availability?.available_slots || [];
 const activeDates = availability?.available_dates || [];
 const currentSlotObj = currentSlots.find((s: any) => s.id === selectedSlotId);
 const isSelectedSlotAvailable = Boolean(currentSlotObj && (currentSlotObj.available === true || currentSlotObj.is_available === true));

 // Step 2 Validation: Requires valid serviceable address/branch AND an active, bookable delivery slot
 const isStep2Valid = deliveryType === "delivery"
 ? Boolean(availability?.serviceable && address.trim() !== "" && city.trim() !== "" && selectedSlotId !== "" && isSelectedSlotAvailable)
 : Boolean(selectedBranchId && selectedSlotId !== "" && isSelectedSlotAvailable);

 // Focus management on step change
 useEffect(() => {
 if (step === 1) {
 firstNameRef.current?.focus();
 } else if (step === 2) {
 searchInputRef.current?.focus();
 } else if (step === 3) {
 notesRef.current?.focus();
 }
 }, [step]);

 const isSubmitDisabled = !isStep1Valid || !isStep2Valid;
 const servicingBranchObj = pickupBranches.find((b) => b.id === selectedBranchId) || {
 id: selectedBranchId,
 name: availability?.branch_name || "Flagship Hub",
 address: "Kitchen",
 pincode: "",
 };

 return (
 <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 w-full font-sans">
  {/* LEFT COLUMN: 3-Step Checkout Flow */}
  <div className="lg:col-span-7 flex flex-col gap-6">
    <div className="flex justify-between items-center border-b border-slate-200 dark:border-slate-200 pb-3">
      <div>
        <Heading level="h1" className="text-2xl md:text-3xl font-extrabold tracking-tight text-brand-text dark:text-slate-900">
          Cake Delivery Checkout
        </Heading>
        <p className="text-xs text-slate-600 dark:text-slate-500 mt-0.5 font-medium">Direct Bakery Kitchen Fulfillment</p>
      </div>
      <span className="text-xs font-semibold px-3 py-1 rounded-full bg-slate-100 dark:bg-slate-50 text-brand-text dark:text-slate-900 border border-slate-200 dark:border-slate-200">
        🔒 SSL Encrypted
      </span>
    </div>

    {/* Stepper Progress Indicator */}
    <div className="flex justify-between items-center w-full bg-white dark:bg-slate-50 p-3.5 rounded-2xl border border-slate-200 dark:border-slate-200 shadow-sm" role="progressbar" aria-label="Checkout Progress">
      <button
        type="button"
        onClick={() => setStep(1)}
        className={`flex items-center gap-2 text-xs md:text-sm font-semibold transition-all ${
          step === 1 ? "text-brand-text dark:text-slate-900 font-bold" : "text-slate-500 hover:text-slate-800 dark:hover:text-slate-900"
        }`}
      >
        <span className={`w-6 h-6 flex items-center justify-center rounded-full text-xs font-bold ${
          step > 1 ? "bg-brand-primary text-brand-primary border border-blue-200" : step === 1 ? "border-2 border-brand-primary text-white bg-brand-primary" : "border border-slate-300  text-slate-400"
        }`}>
          {step > 1 ? "✓" : "1"}
        </span>
        <span>1. Contact</span>
      </button>
      <div className="flex-1 h-px bg-blue-200 mx-2 hidden sm:block" />
      <button
        type="button"
        disabled={!isStep1Valid}
        onClick={() => setStep(2)}
        className={`flex items-center gap-2 text-xs md:text-sm font-semibold transition-all disabled:opacity-40 disabled:cursor-not-allowed ${
          step === 2 ? "text-brand-text dark:text-slate-900 font-bold" : "text-slate-500 hover:text-slate-800 dark:hover:text-slate-900"
        }`}
      >
        <span className={`w-6 h-6 flex items-center justify-center rounded-full text-xs font-bold ${
          step > 2 ? "bg-brand-primary text-brand-primary border border-blue-200" : step === 2 ? "border-2 border-brand-primary text-white bg-brand-primary" : "border border-slate-300  text-slate-400"
        }`}>
          {step > 2 ? "✓" : "2"}
        </span>
        <span>2. Mode & Slots</span>
      </button>
      <div className="flex-1 h-px bg-blue-200 mx-2 hidden sm:block" />
      <button
        type="button"
        disabled={!isStep1Valid || !isStep2Valid}
        onClick={() => setStep(3)}
        className={`flex items-center gap-2 text-xs md:text-sm font-semibold transition-all disabled:opacity-40 disabled:cursor-not-allowed ${
          step === 3 ? "text-brand-text dark:text-slate-900 font-bold" : "text-slate-500 hover:text-slate-800 dark:hover:text-slate-900"
        }`}
      >
        <span className={`w-6 h-6 flex items-center justify-center rounded-full text-xs font-bold ${
          step === 3 ? "border-2 border-brand-primary text-white bg-brand-primary" : "border border-slate-300  text-slate-400"
        }`}>
          3
        </span>
        <span>3. Review & Pay</span>
      </button>
    </div>

 <form className="flex flex-col gap-6 w-full" action={action}>
 {/* STEP 1: Contact & Gifting Details */}
 {step === 1 && (
 <div className="border border-slate-200 rounded-3xl p-6 bg-white flex flex-col gap-6 shadow-sm animate-fadeIn">
 <div className="flex justify-between items-center border-b border-slate-200 pb-3">
 <Heading level="h2" className="text-lg font-bold text-slate-900 ">
 1. Contact & Celebration Details
 </Heading>
 <span className="text-xs text-slate-500">Step 1 of 3</span>
 </div>

 {/* Who is this order for? */}
 <div className="flex flex-col gap-2">
 <Label className="font-semibold text-xs text-slate-900 ">Who are we baking for?</Label>
 <div className="grid grid-cols-2 gap-3">
 <button
 type="button"
 onClick={() => setOrderedForSelf(true)}
 className={`py-3 px-4 rounded-2xl border text-left font-semibold text-xs md:text-sm transition-all flex items-center gap-2.5 ${
 orderedForSelf
 ? "border-brand-primary bg-blue-50/60 text-slate-900 ring-2 ring-blue-500/20"
 : "border-slate-200 text-slate-900 hover:bg-slate-50"
 }`}
 >
 <span className="text-lg">👤</span>
 <span>For Myself</span>
 </button>
 <button
 type="button"
 onClick={() => setOrderedForSelf(false)}
 className={`py-3 px-4 rounded-2xl border text-left font-semibold text-xs md:text-sm transition-all flex items-center gap-2.5 ${
 !orderedForSelf
 ? "border-brand-primary bg-blue-50/60 text-slate-900 ring-2 ring-blue-500/20"
 : "border-slate-200 text-slate-900 hover:bg-slate-50"
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
 <Text className="font-bold text-xs uppercase tracking-wider text-slate-400">Purchaser Contact Details</Text>
 <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
 <div>
 <Label className="font-semibold text-xs text-slate-900 ">First Name *</Label>
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
 <Label className="font-semibold text-xs text-slate-900 ">Last Name *</Label>
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
 <Label className="font-semibold text-xs text-slate-900 ">Mobile Phone *</Label>
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
 <Label className="font-semibold text-xs text-slate-900 ">Email Address (for invoice & updates) *</Label>
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
 <div className="border border-slate-200 bg-slate-50 p-5 rounded-2xl flex flex-col gap-4">
 <div className="flex items-center gap-2">
 <span className="text-lg">🎀</span>
 <Heading level="h3" className="text-sm font-bold text-slate-900 ">
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
 className="mt-1 bg-white "
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
 className="mt-1 bg-white "
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
 className="mt-1 text-xs bg-white "
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
 className="rounded text-slate-900"
 />
 <span className="font-medium">📄 Hide Invoice from Cake Box</span>
 </label>
 <label className="flex items-center gap-2 cursor-pointer">
 <input
 type="checkbox"
 name="anonymous_delivery"
 checked={anonymousDelivery}
 onChange={(e) => setAnonymousDelivery(e.target.checked)}
 className="rounded text-slate-900"
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
 className="mt-2 w-full sm:w-fit self-end bg-brand-primary hover:bg-brand-secondary text-white font-bold py-2.5 px-6 rounded-2xl border border-blue-200 shadow-md"
 >
 Continue to Delivery Mode & Slots →
 </Button>
 </div>
 )}

 {/* STEP 2: Delivery Mode, Branch/Pincode & Scheduling */}
 {step === 2 && (
 <div className="flex flex-col gap-6 animate-fadeIn">
 {/* Order Mode Toggle */}
 <div className="border border-slate-200 rounded-3xl p-6 bg-white flex flex-col gap-4 shadow-sm">
 <div className="flex justify-between items-center border-b border-slate-200 pb-3">
 <Heading level="h2" className="text-lg font-bold text-slate-900 ">
 2. Fulfillment Method
 </Heading>
 <span className="text-xs text-slate-500">Step 2 of 3</span>
 </div>

 <div className={`grid ${storePickupEnabled ? "grid-cols-1 sm:grid-cols-2" : "grid-cols-1"} gap-3`}>
 <button
 type="button"
 onClick={() => handleModeChange("delivery")}
 className={`py-4 px-4 rounded-2xl border text-left font-semibold transition-all flex flex-col gap-1.5 ${
 deliveryType === "delivery"
 ? "border-brand-primary bg-blue-50/60 text-slate-900 ring-2 ring-blue-500/20"
 : "border-slate-200 text-slate-900 hover:bg-slate-50"
 }`}
 >
 <div className="flex items-center gap-2">
 <span className="text-xl">🛵</span>
 <span className="font-bold text-sm md:text-base">Home Delivery</span>
 </div>
 <span className="text-[11px] text-slate-500">
 Direct delivery to doorstep via temperature-controlled courier
 </span>
 </button>

 {storePickupEnabled && (
 <button
 type="button"
 onClick={() => handleModeChange("pickup")}
 className={`py-4 px-4 rounded-2xl border text-left font-semibold transition-all flex flex-col gap-1.5 ${
 deliveryType === "pickup"
 ? "border-brand-primary bg-blue-50/60 text-slate-900 ring-2 ring-blue-500/20"
 : "border-slate-200 text-slate-900 hover:bg-slate-50"
 }`}
 >
 <div className="flex items-center gap-2">
 <span className="text-xl">🏪</span>
 <span className="font-bold text-sm md:text-base">
 Store Pickup {storePickupFee === 0 ? "(FREE)" : `(₹${storePickupFee})`}
 </span>
 </div>
 <span className="text-[11px] text-emerald-600 font-bold">
 {storePickupFee === 0
 ? "Zero delivery charge • Collect from nearest kitchen hub"
 : `Convenience fee ₹${storePickupFee} • Collect from kitchen hub`}
 </span>
 </button>
 )}
 </div>
 <input type="hidden" name="delivery_type" value={deliveryType} />
 </div>

 {/* Mode 1: Home Delivery Location, Map-Fencing & Address Snapshot */}
 {deliveryType === "delivery" ? (
 <div className="border border-slate-200 rounded-3xl p-6 bg-white flex flex-col gap-4 shadow-sm">
 <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-200 pb-2">
 <Heading level="h2" className="text-base font-bold text-slate-900 flex items-center gap-2">
 <span>📍</span> Delivery Location &amp; Address Snapshot
 </Heading>
 <button
 type="button"
 onClick={handleUseCurrentLocation}
 disabled={locatingGps}
 className="flex items-center gap-1.5 px-3 py-1.5 rounded-2xl text-xs font-bold text-brand-primary bg-slate-50 border border-blue-200 hover:bg-brand-primary/20 transition shadow-sm"
 data-testid="use-current-location-btn"
 >
 {locatingGps ? (
 <>
 <Loader2 className="w-3.5 h-3.5 animate-spin text-slate-900" />
 <span>Detecting GPS...</span>
 </>
 ) : (
 <>
 <Crosshair className="w-3.5 h-3.5 text-slate-900" />
 <span>Use Current Location</span>
 </>
 )}
 </button>
 </div>

 {gpsError && (
 <div className="p-2.5 bg-brand-gold-light border border-brand-gold/40 rounded-2xl text-xs text-brand-gold-dark flex items-center gap-2">
 <AlertCircle className="w-4 h-4 shrink-0 text-brand-gold" />
 <span>{gpsError}</span>
 </div>
 )}

 {gpsAccuracy !== null && gpsAccuracy > 500 && (
 <div className="p-2.5 bg-brand-gold-light border border-brand-gold/40 rounded-2xl text-xs text-brand-gold-dark flex items-center gap-2">
 <AlertTriangle className="w-4 h-4 shrink-0 text-brand-gold" />
 <span>GPS location is approximate (~{Math.round(gpsAccuracy)}m accuracy). Please confirm your exact building name and street below.</span>
 </div>
 )}

 {/* Search Delivery Location Autocomplete */}
 <div ref={searchContainerRef} className="relative z-30">
 <Label className="font-semibold text-xs text-slate-900 mb-1 block">
 Search Area, Landmark, or Complex
 </Label>
 <div className="relative">
 <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
 <Input
 ref={searchInputRef}
 placeholder="Search area, landmark, street, or city..."
 value={locationSearchQuery}
 onChange={(e) => handleSearchLocationInput(e.target.value)}
 onFocus={() => {
 if (locationSearchResults.length > 0 || locationSearchQuery.trim().length >= 2) setShowLocationDropdown(true);
 }}
 style={{ color: "#0F172A", caretColor: "#C28A2C" }}
 className="pl-10 pr-10 text-xs sm:text-sm bg-slate-50 text-slate-900 placeholder:text-slate-400 border border-slate-200/80 focus:border-brand-primary focus:ring-1 focus:ring-brand-gold/50 focus:outline-none selection:bg-brand-primary/30 disabled:opacity-50 disabled:cursor-not-allowed [&:-webkit-autofill]:[box-shadow:0_0_0_1000px_#F8FAFC_inset] [&:-webkit-autofill]:[-webkit-text-fill-color:#0F172A]"
 />
 {isSearchingLocation && (
 <Loader2 className="absolute right-3.5 top-1/2 -translate-y-1/2 w-4 h-4 animate-spin text-brand-primary" />
 )}
 </div>

 {/* Autocomplete Results Dropdown */}
 {showLocationDropdown && (locationSearchResults.length > 0 || isSearchingLocation || (locationSearchQuery.trim().length >= 2 && !isSearchingLocation)) && (
 <div className="absolute left-0 right-0 top-full mt-1.5 bg-white/98 backdrop-blur-md border border-slate-200/80 rounded-2xl shadow-[0_16px_40px_rgba(0,0,0,0.6)] p-2 z-50 max-h-60 overflow-y-auto space-y-1">
 {isSearchingLocation ? (
 <div className="p-3 text-xs text-slate-500 flex items-center gap-2 justify-center">
 <Loader2 className="w-3.5 h-3.5 animate-spin text-brand-primary" />
 <span>Searching localities...</span>
 </div>
 ) : locationSearchResults.length > 0 ? (
 <>
 <div className="text-[10px] font-bold text-slate-400 px-3 py-1 uppercase tracking-wider">
 Suggested Delivery Localities
 </div>
 {locationSearchResults.map((loc: any) => (
 <div
 key={loc.id}
 onClick={() => handleSelectSearchResult(loc)}
 className="p-2.5 rounded-2xl hover:bg-slate-50 hover:bg-navy-accent/80 active:bg-navy-accent cursor-pointer flex items-center justify-between gap-3 text-xs transition"
 >
 <div className="flex items-center gap-2 min-w-0">
 <MapPin className="w-4 h-4 shrink-0 text-brand-primary" />
 <div className="truncate">
 <p className="font-bold text-slate-900 truncate">{loc.label}</p>
 <p className="text-[11px] text-slate-500 truncate">{loc.formatted_address}</p>
 </div>
 </div>
 {loc.pincode && (
 <span className="text-[10px] font-mono font-bold text-slate-900 bg-slate-50 border border-slate-200 px-2 py-0.5 rounded shrink-0">
 {loc.pincode}
 </span>
 )}
 </div>
 ))}
 </>
 ) : (
 <div className="p-3 text-xs text-slate-500 text-center">
 No matching localities found. Try another landmark or area.
 </div>
 )}
 </div>
 )}
 </div>

 {/* Customer Saved Addresses Chips */}
 {savedAddresses.length > 0 && (
 <div className="space-y-1.5 pt-1">
 <div className="flex items-center gap-1 text-[11px] font-bold text-slate-500 uppercase">
 <Bookmark className="w-3 h-3 text-slate-400" />
 <span>Saved Delivery Addresses:</span>
 </div>
 <div className="flex flex-wrap gap-2">
 {savedAddresses.map((addr) => {
 const isSel = selectedAddressId === addr.id;
 return (
 <button
 key={addr.id}
 type="button"
 onClick={() => handleSelectSavedAddress(addr)}
 className={`px-3 py-1.5 rounded-2xl border text-xs font-semibold flex items-center gap-1.5 transition ${
 isSel
 ? "bg-brand-primary text-white border-brand-primary shadow-sm"
 : "bg-slate-50 text-slate-900 border-slate-200 hover:border-blue-200"
 }`}
 >
 <span>{addr.label || addr.type || "Address"}</span>
 {addr.postal_code && (
 <span className="text-[10px] opacity-80">({addr.postal_code})</span>
 )}
 </button>
 );
 })}
 </div>
 </div>
 )}

 {/* Verified Coordinates Badge */}
 {typeof latitude === "number" && typeof longitude === "number" && (
 <div className="p-2.5 bg-blue-50/70 border border-blue-200 rounded-2xl flex items-center justify-between gap-2 text-xs">
 <div className="flex items-center gap-2">
 <Navigation className="w-3.5 h-3.5 text-blue-600 shrink-0" />
 <span className="font-mono text-[11px] font-bold text-blue-900 ">
 Delivery Coordinates: {latitude.toFixed(5)}, {longitude.toFixed(5)}
 </span>
 </div>
 <span className="text-[10px] font-bold text-blue-700 bg-blue-100 px-2 py-0.5 rounded">
 ✓ {locationSource === "GPS" ? "GPS Verified" : locationSource === "SEARCH" ? "Search Selected" : locationSource === "EXPLICIT_GEOCODE" ? "Address Geocoded" : "Map Pin Locked"}
 </span>
 </div>
 )}

 {/* Interactive Customer Location Map */}
 <div className="space-y-1.5 relative z-0">
 <div className="flex items-center justify-between text-xs">
 <Label className="font-semibold text-slate-900 flex items-center gap-1.5">
 <MapPin className="w-3.5 h-3.5 text-slate-900" /> Confirm Pin on Map 📍
 </Label>
 <span className="text-[10px] text-slate-500">Drag pin to adjust exact delivery doorstep</span>
 </div>
 <CheckoutMap
 latitude={typeof latitude === "number" ? latitude : undefined}
 longitude={typeof longitude === "number" ? longitude : undefined}
 storeLat={(availability as any)?.store_lat}
 storeLng={(availability as any)?.store_lng}
 storeName={availability?.branch_name || undefined}
 serviceable={availability ? availability.serviceable : undefined}
 height={240}
 loading={loadingAvailability}
 onLocationChange={handleLocationChangeFromMap}
 />
 </div>

 {/* Authoritative Serviceability Feedback Card */}
 {loadingAvailability ? (
 <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200 flex items-center gap-2 text-xs text-slate-500 animate-pulse">
 <Loader2 className="w-4 h-4 animate-spin text-slate-900" />
 <span>Checking delivery availability...</span>
 </div>
 ) : availability ? (
 <div>
 {availability.serviceable ? (
 <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 flex flex-col gap-2">
 <div className="flex items-center justify-between">
 <span className="text-xs font-bold text-emerald-800 flex items-center gap-1.5">
 <CheckCircle2 className="w-4 h-4 text-emerald-600" /> Delivery Available
 </span>
 <span className="text-xs font-extrabold text-emerald-900 bg-emerald-100 px-2.5 py-0.5 rounded-xl">
 {availability.pricing?.delivery_fee === 0 ? "FREE DELIVERY" : `₹${availability.pricing?.delivery_fee || 0}`}
 </span>
 </div>
 <div className="text-xs text-emerald-900 font-medium">
 Serving from: <span className="font-bold">{availability.branch_name || "Bakery Hub"}</span>
 </div>
 <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-emerald-700 font-medium">
 {(typeof availability.distance_km === "number" || typeof availability.pricing?.distance_km === "number") && (
 <span>Distance: {availability.distance_km ?? availability.pricing?.distance_km} km</span>
 )}
 {availability.pricing?.delivery_fee !== undefined && (
 <span>Delivery: {availability.pricing.delivery_fee === 0 ? "Free" : `₹${availability.pricing.delivery_fee}`}</span>
 )}
 {availability.eta_minutes && (
 <span>ETA: ~{typeof availability.eta_minutes === "object" ? `${availability.eta_minutes.min}-${availability.eta_minutes.max}` : availability.eta_minutes} mins</span>
 )}
 </div>
 </div>
 ) : (
 <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 flex flex-col gap-2">
 <div className="flex items-center justify-between">
 <span className="text-xs font-bold text-brand-text flex items-center gap-1.5">
 <span>❌</span> We currently don't deliver to this location
 </span>
 <div className="flex items-center gap-2">
 {!notifiedLocation ? (
 <button
 type="button"
 onClick={() => setNotifiedLocation(true)}
 className="text-[11px] font-bold text-brand-gold-dark hover:underline flex items-center gap-1"
 >
 <span>🔔</span> Notify Me
 </button>
 ) : (
 <span className="text-[11px] font-semibold text-emerald-700 flex items-center gap-1">
 <span>✓</span> We will notify you
 </span>
 )}
 <button
 type="button"
 onClick={() => {
 setLocationSearchQuery("");
 searchInputRef.current?.focus();
 }}
 className="text-[11px] font-bold text-brand-deep underline hover:no-underline ml-1"
 >
 Change Location
 </button>
 </div>
 </div>
 <p className="text-[11px] text-brand-deep ">
 {availability.status_message || "We currently don't deliver to this location. We're coming soon to your town."}
 </p>
 {notifiedLocation && (
 <p className="text-[10px] text-emerald-700 font-medium">
 ✓ You will receive an SMS and WhatsApp notification as soon as our bakery coverage launches in your area.
 </p>
 )}
 </div>
 )}
 </div>
 ) : (
 <div className="p-3.5 rounded-2xl bg-slate-50 border border-dashed border-slate-200 text-center text-xs text-slate-500">
 <span>📍 Select your delivery location using GPS, Search, or Saved Addresses</span>
 </div>
 )}

 {/* Section B: Delivery Address Text (Human-Readable) — ONLY when Serviceable */}
 {availability?.serviceable && (
 <div className="border-t border-slate-200 pt-4 flex flex-col gap-3">
 <div className="flex flex-col gap-0.5">
 <Heading level="h3" className="text-sm font-bold text-slate-900 flex items-center gap-2">
 <span>🏠</span> Delivery Address &amp; Gate Notes
 </Heading>
 <p className="text-[11px] text-slate-500">
 This address provides building, flat, and doorstep directions for our rider. Editing it will not alter your physical map pin above.
 </p>
 </div>

 <div className="grid grid-cols-1 gap-4 pt-1">
 <div>
 <Label className="font-semibold text-xs text-slate-900 ">Street Address / Flat / Building *</Label>
 <Input
 placeholder="House/Flat No., Building Name, Street/Road"
 name="address"
 value={address}
 onChange={(e) => setAddress(e.target.value)}
 required
 className="mt-1"
 />
 </div>
 <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
 <div>
 <Label className="font-semibold text-xs text-slate-900 ">City / Area *</Label>
 <Input
 placeholder="City / Locality"
 name="city"
 value={city}
 onChange={(e) => setCity(e.target.value)}
 required
 className="mt-1"
 />
 </div>
 <div>
 <Label className="font-semibold text-xs text-slate-900 ">Pincode <span className="text-[10px] text-slate-500 font-normal">(Optional)</span></Label>
 <Input
 placeholder="Auto-filled from map"
 name="zip"
 value={zip}
 maxLength={6}
 onChange={(e) => setZip(e.target.value.replace(/\D/g, ""))}
 onBlur={handleCheckPincode}
 className="mt-1 font-mono"
 />
 </div>
 <div>
 <Label className="font-semibold text-xs text-slate-900 ">Landmark (Optional)</Label>
 <Input
 placeholder="e.g. Near Metro Station / Park"
 name="landmark"
 value={recipientLandmark}
 onChange={(e) => setRecipientLandmark(e.target.value)}
 className="mt-1"
 />
 </div>
 </div>
 <div>
 <Label className="font-semibold text-xs text-slate-900 ">Delivery Instructions / Gate Notes</Label>
 <Input
 placeholder="e.g. Ring bell twice, leave with security if unavailable, call upon arrival"
 name="special-instructions"
 value={deliveryInstructions}
 onChange={(e) => setDeliveryInstructions(e.target.value)}
 className="mt-1 text-xs"
 />
 </div>

 {/* Explicit Map Re-anchoring Button */}
 <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pt-2 border-t border-slate-200 ">
 <p className="text-[11px] text-slate-500">
 Want to align your map pin to this typed address?
 </p>
 <button
 type="button"
 onClick={handleSearchAddressOnMap}
 disabled={isGeocodingAddress || (!address.trim() && !city.trim() && !zip.trim())}
 className="px-3 py-1.5 rounded-2xl border border-slate-200 bg-slate-50 hover:bg-brand-primary/30 :bg-zinc-750 text-xs font-semibold text-slate-900 flex items-center gap-1.5 transition disabled:opacity-50"
 >
 {isGeocodingAddress ? (
 <>
 <Loader2 className="w-3.5 h-3.5 animate-spin text-slate-900" />
 <span>Locating on Map...</span>
 </>
 ) : (
 <>
 <MapPin className="w-3.5 h-3.5 text-slate-900" />
 <span>Search this address on map</span>
 </>
 )}
 </button>
 </div>
 {addressGeocodeNotice && (
 <p className="text-[11px] text-slate-900 font-medium">
 {addressGeocodeNotice}
 </p>
 )}
 </div>
 </div>
 )}

 {/* Hidden GPS inputs submitted to placeOrder */}
 <input type="hidden" name="latitude" value={latitude ?? ""} />
 <input type="hidden" name="longitude" value={longitude ?? ""} />
 <input type="hidden" name="location_source" value={locationSource ?? ""} />
 </div>
 ) : (
 /* Mode 2: Store Pickup Branch Selection */
 <div className="border border-slate-200 rounded-3xl p-6 bg-white flex flex-col gap-4 shadow-sm">
 <Heading level="h2" className="text-base font-bold text-slate-900 border-b border-slate-200 pb-2 flex items-center gap-2">
 <span>🏪</span> Select Bakery Hub for Pickup
 </Heading>

 <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
 {pickupBranches.map((b) => {
 const isSelected = selectedBranchId === b.id;
 return (
 <button
 key={b.id}
 type="button"
 onClick={() => handleBranchSelect(b.id)}
 className={`p-4 rounded-2xl border text-left transition-all flex flex-col gap-1.5 ${
 isSelected
 ? "border-brand-primary bg-slate-50 text-slate-900 ring-2 ring-blue-500/20"
 : "border-slate-200 hover:border-blue-300"
 }`}
 >
 <div className="flex justify-between items-center">
 <span className="font-bold text-sm text-slate-900 ">{b.name}</span>
 <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 ">
 Open Daily
 </span>
 </div>
 <p className="text-xs text-slate-500">{b.address}</p>
 <span className="text-[11px] text-slate-400 font-mono mt-1">🕒 {b.timing || "09:00 AM - 11:00 PM"}</span>
 </button>
 );
 })}
 </div>
 <input type="hidden" name="branch_id" value={selectedBranchId} />
 </div>
 )}

 {/* Delivery / Pickup Date & Slot Scheduling — ONLY when Serviceable or Pickup */}
 {(deliveryType === "pickup" || availability?.serviceable) && (
 <div className="border border-slate-200 rounded-3xl p-6 bg-white flex flex-col gap-4 shadow-sm">
 <div className="flex justify-between items-center border-b border-slate-200 pb-2">
 <Heading level="h2" className="text-base font-bold text-slate-900 flex items-center gap-2">
 <span>🗓️</span> {deliveryType === "delivery" ? "Delivery Scheduling" : "Pickup Scheduling"}
 </Heading>
 <span className="text-xs font-semibold text-slate-500">
 From: <b>{servicingBranchObj.name}</b>
 </span>
 </div>

 {/* Date Selector */}
 <div className="flex flex-col gap-1.5">
 <Label className="font-semibold text-xs text-slate-900 ">Select Date</Label>
 <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
 {activeDates.slice(0, 8).map((d) => {
 const isSelected = selectedDate === d.date;
 return (
 <button
 key={d.date}
 type="button"
 disabled={!d.is_available}
 onClick={() => handleDateChange(d.date)}
 className={`p-2.5 rounded-2xl border text-center transition-all flex flex-col items-center justify-center ${
 isSelected
 ? "border-brand-primary bg-brand-primary text-white font-bold shadow-md shadow-brand-navy/30"
 : d.is_available
 ? "border-slate-200 bg-slate-50 text-slate-900 hover:border-blue-200"
 : "border-slate-200 opacity-40 cursor-not-allowed bg-white/5 text-slate-400"
 }`}
 >
 <span className="text-xs font-bold">{d.label}</span>
 {!d.is_available && (
 <span className="text-[9px] text-slate-900 font-semibold">{d.reason || "Closed"}</span>
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
 <Label className="font-semibold text-xs text-slate-900 ">
 Select Time Window ({deliveryType === "delivery" ? "Delivery Slot" : "Pickup Window"})
 </Label>
 <span className="text-[11px] text-slate-400">Authoritative cutoff & capacity validation</span>
 </div>

 {loadingAvailability ? (
 <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-1">
 {[1, 2, 3, 4].map((i) => (
 <div key={i} className="animate-pulse bg-navy-accent/40 rounded-2xl h-16 w-full" />
 ))}
 </div>
 ) : currentSlots.length === 0 ? (
 <div className="bg-slate-50 border border-dashed border-slate-200 rounded-2xl p-6 text-center">
 <Text className="text-xs text-slate-500 italic">No operational slots available for this date. Please select another date.</Text>
 </div>
 ) : (
 <div className="flex flex-col gap-3">
 {/* Same-day cutoff banner when all slots on current date are closed/expired */}
 {currentSlots.length > 0 && currentSlots.every((s: any) => !s.available) && (
 <div className="bg-brand-gold-light border border-brand-gold/40 rounded-2xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-brand-gold-dark ">
 <div className="flex items-center gap-2.5">
 <span className="text-xl">⏰</span>
 <div>
 <p className="font-bold text-xs md:text-sm">Same-Day Ordering Closed</p>
 <p className="text-[11px] text-brand-gold-dark ">
 Same-day acceptance cutoff has passed for this date. Pre-orders are open for tomorrow!
 </p>
 </div>
 </div>
 {activeDates.find((d) => d.date !== selectedDate && d.is_available) && (
 <button
 type="button"
 onClick={() => {
 const nextAvail = activeDates.find((d) => d.date !== selectedDate && d.is_available);
 if (nextAvail) handleDateChange(nextAvail.date);
 }}
 className="bg-brand-navy hover:bg-brand-primary text-white text-xs font-bold py-1.5 px-3.5 rounded-2xl whitespace-nowrap shadow-sm transition-all"
 >
 Switch to {activeDates.find((d) => d.date !== selectedDate && d.is_available)?.label} →
 </button>
 )}
 </div>
 )}

 <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-1">
 {currentSlots.map((slot: any) => {
 const isAvailable = Boolean(slot.available && slot.is_available !== false);
 const isSelected = selectedSlotId === slot.id;
 const isAlmostFull = isAvailable && slot.remaining_capacity <= 4;

 const isCutoffPassed = slot.status === "PAST_CUTOFF" || slot.reason_code === "CORPORATE_CUTOFF_PASSED" || slot.reason_code === "SPECIAL_CUTOFF_PASSED";
 const isPrepExceeded = slot.status === "PREP_TIME_EXCEEDED" || slot.reason_code === "PRODUCT_PREP_TIME";
 const isFull = slot.status === "FULL" || slot.reason_code === "SLOT_CAPACITY_FULL";
 const isClosed = slot.status === "CLOSED" || slot.reason_code === "STORE_CLOSED";

 return (
 <button
 key={slot.id}
 type="button"
 disabled={!isAvailable}
 onClick={() => {
 if (isAvailable) handleSlotSelect(slot.id);
 }}
 className={`flex flex-col text-left border rounded-2xl p-3.5 transition-all ${
 isSelected && isAvailable
 ? "border-brand-primary bg-slate-50/80 ring-2 ring-blue-500/20 shadow-sm"
 : isAvailable
 ? "border-slate-200 bg-white hover:border-blue-300 cursor-pointer"
 : "border-slate-200 bg-slate-50/80 opacity-60 cursor-not-allowed"
 }`}
 >
 <div className="flex justify-between items-start w-full">
 <span className="font-bold text-xs md:text-sm text-slate-900 pr-1">
 {slot.slot_name || slot.label}
 </span>
 {!isAvailable ? (
 <Badge color="red" size="small">
 {isCutoffPassed ? "Cutoff Passed" : isPrepExceeded ? "Prep Time Exceeded" : isFull ? "Fully Booked" : isClosed ? "Kitchen Closed" : "Unavailable"}
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
 <span className="text-slate-500 font-mono text-[11px]">
 {slot.start_time} - {slot.end_time}
 </span>
 {slot.extra_charge > 0 && (
 <span className="font-extrabold text-slate-900 text-xs">
 +₹{slot.extra_charge} Surcharge
 </span>
 )}
 </div>

 {!isAvailable && slot.reason_message && (
 <p className="text-[10px] text-red-500 mt-1.5 font-medium leading-tight">
 ⚠️ {slot.reason_message}
 </p>
 )}
 </button>
 );
 })}
 </div>
 </div>
 )}
 <input type="hidden" name="delivery_slot_id" value={selectedSlotId} />
 </div>
 </div>
 )}

 <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 mt-2">
 <Button type="button" variant="secondary" onClick={() => setStep(1)} className="rounded-2xl">
 ← Back to Contact
 </Button>
 <div className="flex flex-col items-end gap-1 w-full sm:w-auto">
 <Button
 type="button"
 disabled={!isStep2Valid}
 onClick={() => setStep(3)}
 className={`font-bold py-2.5 px-6 rounded-2xl w-full sm:w-auto transition-all ${
 isStep2Valid
 ? "bg-brand-primary hover:bg-brand-secondary text-white border border-blue-200 shadow-md"
 : "bg-navy-accent/40 text-slate-400 cursor-not-allowed"
 }`}
 >
 Continue to Review & Pay →
 </Button>
 {!isStep2Valid && (
 <span className="text-[11px] text-slate-400">
 {!selectedSlotId
 ? "Select an available delivery slot to proceed"
 : !isSelectedSlotAvailable
 ? "Selected slot is unavailable. Please select another slot."
 : "Complete delivery address & details to proceed"}
 </span>
 )}
 </div>
 </div>
 </div>
 )}

 {/* STEP 3: Review, Payment Method & Final Notes */}
 {step === 3 && (
 <div className="flex flex-col gap-6 animate-fadeIn">
 {/* Review Card */}
 <div className="border border-slate-200 rounded-3xl p-6 bg-white flex flex-col gap-4 shadow-sm">
 <Heading level="h2" className="text-base font-bold text-slate-900 border-b border-slate-200 pb-2">
 1. Order Details Summary
 </Heading>

 <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-xs">
 <div className="flex flex-col gap-1.5">
 <span className="font-bold text-slate-400 uppercase tracking-wider">Customer & Contact</span>
 <p className="font-bold text-sm text-slate-900 ">{firstName} {lastName}</p>
 <p className="text-slate-500 ">📱 {phone}</p>
 <p className="text-slate-500 ">✉️ {email}</p>
 {!orderedForSelf && recipientName && (
 <p className="mt-1 font-semibold text-slate-900">
 🎁 Recipient: {recipientName} ({recipientPhone})
 </p>
 )}
 </div>

 <div className="flex flex-col gap-1.5">
 <span className="font-bold text-slate-400 uppercase tracking-wider">Fulfillment & Slot</span>
 <p className="font-bold text-sm text-slate-900 capitalize">
 {deliveryType === "delivery" ? `🛵 Home Delivery (${zip})` : `🏪 Store Pickup (${servicingBranchObj.name})`}
 </p>
 {deliveryType === "delivery" && (
 <p className="text-slate-500 ">{address}, {city}</p>
 )}
 <p className="mt-1 font-bold text-slate-900 ">
 🗓️ Date: {selectedDate} | Slot: {currentSlotObj?.slot_name || selectedSlotId}
 </p>
 </div>
 </div>
 </div>

 {/* Payment Method Selector */}
 <div className="border border-slate-200 rounded-3xl p-6 bg-white flex flex-col gap-4 shadow-sm">
 <div className="flex justify-between items-center border-b border-slate-200 pb-2">
 <Heading level="h2" className="text-base font-bold text-slate-900 ">
 2. Payment Method
 </Heading>
 <span className="text-xs text-emerald-600 font-bold flex items-center gap-1">
 <span>🔒</span> 100% Encrypted & Safe
 </span>
 </div>

 <div className={`grid grid-cols-1 ${[true, codEnabled, testPaymentsEnabled].filter(Boolean).length === 3 ? "sm:grid-cols-3" : [true, codEnabled, testPaymentsEnabled].filter(Boolean).length === 2 ? "sm:grid-cols-2" : ""} gap-3`}>
 <button
 type="button"
 onClick={() => setPaymentMethod("razorpay")}
 className={`p-4 rounded-2xl border text-left flex flex-col gap-2 transition-all ${
 (paymentMethod === "razorpay" || paymentMethod === "cashfree")
 ? "border-brand-primary bg-blue-50/60 ring-2 ring-blue-500/20"
 : "border-slate-200 hover:border-blue-300"
 }`}
 >
 <div className="flex justify-between items-center">
 <span className="text-2xl">💳</span>
 <span className={`w-4 h-4 rounded-full border flex items-center justify-center ${
 (paymentMethod === "razorpay" || paymentMethod === "cashfree") ? "border-brand-primary bg-brand-primary text-brand-primary text-[10px]" : "border-stone/70"
 }`}>
 {(paymentMethod === "razorpay" || paymentMethod === "cashfree") && "✓"}
 </span>
 </div>
 <div>
 <h4 className="font-bold text-xs md:text-sm text-slate-900 ">Online Payment (Razorpay)</h4>
 <p className="text-[11px] text-slate-500 mt-0.5">Google Pay, PhonePe, Cards, NetBanking</p>
 </div>
 </button>

 {codEnabled && (
 <button
 type="button"
 onClick={() => setPaymentMethod("cod")}
 className={`p-4 rounded-2xl border text-left flex flex-col gap-2 transition-all ${
 paymentMethod === "cod"
 ? "border-brand-primary bg-blue-50/60 ring-2 ring-blue-500/20"
 : "border-slate-200 hover:border-blue-300"
 }`}
 >
 <div className="flex justify-between items-center">
 <span className="text-2xl">💵</span>
 <span className={`w-4 h-4 rounded-full border flex items-center justify-center ${
 paymentMethod === "cod" ? "border-brand-primary bg-brand-primary text-brand-primary text-[10px]" : "border-stone/70"
 }`}>
 {paymentMethod === "cod" && "✓"}
 </span>
 </div>
 <div>
 <h4 className="font-bold text-xs md:text-sm text-slate-900 ">Cash on Delivery</h4>
 <p className="text-[11px] text-slate-500 mt-0.5">Pay upon delivery verification</p>
 </div>
 </button>
 )}

 {testPaymentsEnabled && (
 <button
 type="button"
 onClick={() => setPaymentMethod("test_mode")}
 className={`p-4 rounded-2xl border text-left flex flex-col gap-2 transition-all ${
 paymentMethod === "test_mode"
 ? "border-brand-primary bg-blue-50/60 ring-2 ring-blue-500/20"
 : "border-slate-200 hover:border-blue-300"
 }`}
 >
 <div className="flex justify-between items-center">
 <span className="text-2xl">⚡</span>
 <span className={`w-4 h-4 rounded-full border flex items-center justify-center ${
 paymentMethod === "test_mode" ? "border-brand-primary bg-brand-primary text-brand-primary text-[10px]" : "border-stone/70"
 }`}>
 {paymentMethod === "test_mode" && "✓"}
 </span>
 </div>
 <div>
 <h4 className="font-bold text-xs md:text-sm text-slate-900 ">Sandbox Test</h4>
 <p className="text-[11px] text-slate-500 mt-0.5">Simulate instant verified checkout</p>
 </div>
 </button>
 )}
 </div>
 </div>

 {/* Coupon / Promo Code */}
 <div className="border border-slate-200 rounded-3xl p-6 bg-white flex flex-col gap-3 shadow-sm">
 <Label className="font-semibold text-xs text-slate-900 ">3. Apply Coupon / Voucher</Label>
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
 {couponError && <p className="text-xs text-slate-900 font-semibold">{couponError}</p>}
 {couponSuccess && <p className="text-xs text-emerald-600 font-semibold">{couponSuccess}</p>}
 </div>

 {/* Delivery Instructions */}
 <div className="border border-slate-200 rounded-3xl p-6 bg-white flex flex-col gap-3 shadow-sm">
 <Label className="font-semibold text-xs text-slate-900 ">
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
 <input type="hidden" name="city" value={city || (servicingBranchObj as any)?.city || ""} />
 <input type="hidden" name="state" value={(servicingBranchObj as any)?.state || ""} />
 <input type="hidden" name="zip" value={deliveryType === "delivery" ? zip : ((servicingBranchObj as any)?.pincode || "")} />
 <input type="hidden" name="delivery-date" value={selectedDate} />
 <input type="hidden" name="delivery-slot" value={selectedSlotId} />
 <input type="hidden" name="payment-method" value={paymentMethod} />
 <input type="hidden" name="occasion" value={occasion} />
 <input type="hidden" name="ordered-for-self" value={orderedForSelf ? "true" : "false"} />
 <input type="hidden" name="recipient-name" value={recipientName} />
 <input type="hidden" name="recipient-phone" value={recipientPhone} />
 <input type="hidden" name="gift-message" value={giftMessage} />

 <div className="flex justify-between items-center border-t border-slate-200 pt-4">
 <Button type="button" variant="secondary" onClick={() => setStep(2)} className="rounded-2xl">
 ← Back to Mode & Slots
 </Button>
 <div className="flex flex-col items-end gap-1">
 <Submit disabled={isSubmitDisabled} paymentMethod={paymentMethod} />
 {isSubmitDisabled && (
 <Text className="text-xs text-slate-900 mt-1">
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

