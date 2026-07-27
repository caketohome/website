"use client";

import React, { useState, useEffect } from "react";
import { MapPin, Navigation, X, Check } from "lucide-react";
import { Button, Input, Label, Text } from "@medusajs/ui";

/**
 * DeliveryLocationHeader Component
 * Single-brand storefront location widget.
 * Displays customer's delivery PIN code/address and ETA without EVER exposing
 * internal branch names or branch IDs.
 */
export function DeliveryLocationHeader() {
  const [pincode, setPincode] = useState("560001");
  const [locationName, setLocationName] = useState("Central Pincode 560001");
  const [eta, setEta] = useState("40-50 min");
  const [fee, setFee] = useState("₹49");
  const [isOpen, setIsOpen] = useState(false);
  const [inputPin, setInputPin] = useState("");
  const [isLocating, setIsLocating] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  const getCookie = (name: string): string | null => {
    if (typeof document === "undefined") return null;
    const value = `; ${document.cookie}`;
    const parts = value.split(`; ${name}=`);
    if (parts.length === 2) return parts.pop()?.split(";").shift() || null;
    return null;
  };

  const setDeliverySessionCookies = (pin: string, locName: string, etaTime: string, delFee: string) => {
    document.cookie = `delivery_pincode=${pin}; path=/; max-age=31536000; SameSite=Lax`;
    document.cookie = `delivery_location=${encodeURIComponent(locName)}; path=/; max-age=31536000; SameSite=Lax`;
    document.cookie = `delivery_eta=${encodeURIComponent(etaTime)}; path=/; max-age=31536000; SameSite=Lax`;
    document.cookie = `delivery_fee=${encodeURIComponent(delFee)}; path=/; max-age=31536000; SameSite=Lax`;
  };

  useEffect(() => {
    const savedPin = getCookie("delivery_pincode");
    const savedLoc = getCookie("delivery_location");
    const savedEta = getCookie("delivery_eta");
    const savedFee = getCookie("delivery_fee");

    if (savedPin) setPincode(savedPin);
    if (savedLoc) setLocationName(decodeURIComponent(savedLoc));
    if (savedEta) setEta(decodeURIComponent(savedEta));
    if (savedFee) setFee(decodeURIComponent(savedFee));
  }, []);

  const handleResolveLocation = async (pinInput: string, lat?: number, lng?: number) => {
    setErrorMsg("");
    try {
      const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:9000";
      const publishableKey =
        process.env.NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY ||
        "pk_e43cf3cbad60b9429ac28f7e46cd59022feeb003e3b339782cd5529906377bae";

      const res = await fetch(`${backendUrl}/store/delivery/resolve`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-publishable-api-key": publishableKey,
        },
        body: JSON.stringify({
          pincode: pinInput,
          latitude: lat,
          longitude: lng,
        }),
      });

      const data = await res.json();
      if (res.ok && data) {
        const newPin = data.delivery_pincode || pinInput || "560001";
        const newLoc = `Pincode ${newPin}`;
        const newEta = `${data.estimated_delivery_minutes || 45} min`;
        const newFee = `₹${data.delivery_fee ?? 49}`;

        setPincode(newPin);
        setLocationName(newLoc);
        setEta(newEta);
        setFee(newFee);

        setDeliverySessionCookies(newPin, newLoc, newEta, newFee);
        setIsOpen(false);
      } else {
        setErrorMsg("Location not serviceable yet. Please enter a valid PIN code.");
      }
    } catch {
      setErrorMsg("Could not resolve location. Please try again.");
    }
  };

  const handleSubmitPincode = (e: React.FormEvent) => {
    e.preventDefault();
    if (inputPin.trim().length >= 6) {
      handleResolveLocation(inputPin.trim());
    } else {
      setErrorMsg("Please enter a valid 6-digit PIN code.");
    }
  };

  const handleGPSLocation = () => {
    if (!navigator.geolocation) {
      setErrorMsg("Geolocation is not supported by your browser.");
      return;
    }

    setIsLocating(true);
    setErrorMsg("");

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setIsLocating(false);
        handleResolveLocation("", pos.coords.latitude, pos.coords.longitude);
      },
      () => {
        setIsLocating(false);
        setErrorMsg("GPS permission denied. Please enter your PIN code manually.");
      },
      { timeout: 8000 }
    );
  };

  return (
    <div className="relative z-50">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-ui-border-strong bg-ui-bg-subtle text-ui-fg-base hover:bg-ui-bg-subtle-hover transition-colors font-medium text-xs shadow-sm"
      >
        <MapPin className="w-3.5 h-3.5 text-rose-500 animate-pulse shrink-0" />
        <div className="flex flex-col text-left">
          <span className="font-semibold text-xs text-rose-600 dark:text-rose-400 truncate max-w-[170px]">
            Deliver to {pincode}
          </span>
          <span className="text-[10px] text-ui-fg-muted">
            ETA: {eta} • Delivery: {fee}
          </span>
        </div>
      </button>

      {isOpen && (
        <div className="absolute left-0 mt-2 w-80 rounded-xl border border-ui-border-strong bg-ui-bg-base text-ui-fg-base shadow-xl p-4 flex flex-col gap-3">
          <div className="flex justify-between items-center">
            <h3 className="font-semibold text-sm">Enter Delivery Location</h3>
            <button onClick={() => setIsOpen(false)} className="text-ui-fg-muted hover:text-ui-fg-base">
              <X className="w-4 h-4" />
            </button>
          </div>

          <form onSubmit={handleSubmitPincode} className="flex flex-col gap-2">
            <Label htmlFor="header-pincode" className="text-xs">
              Delivery PIN Code
            </Label>
            <div className="flex gap-2">
              <Input
                id="header-pincode"
                type="text"
                maxLength={6}
                placeholder="e.g. 560001"
                value={inputPin}
                onChange={(e) => setInputPin(e.target.value.replace(/\D/g, ""))}
                autoFocus
              />
              <Button type="submit" size="small" variant="primary">
                Set
              </Button>
            </div>
          </form>

          <div className="flex items-center gap-2 my-1">
            <div className="border-t border-ui-border-strong flex-1" />
            <span className="text-[10px] text-ui-fg-muted uppercase">or</span>
            <div className="border-t border-ui-border-strong flex-1" />
          </div>

          <Button
            variant="secondary"
            size="small"
            onClick={handleGPSLocation}
            disabled={isLocating}
            className="flex items-center justify-center gap-2 w-full text-xs"
          >
            <Navigation className="w-3.5 h-3.5" />
            {isLocating ? "Locating..." : "Use GPS Current Location"}
          </Button>

          {errorMsg && <Text className="text-xs text-red-500 font-medium text-center">{errorMsg}</Text>}
        </div>
      )}
    </div>
  );
}
