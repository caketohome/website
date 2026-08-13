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
      const params = new URLSearchParams();
      if (pinInput) params.set("pincode", pinInput);
      if (lat) params.set("lat", String(lat));
      if (lng) params.set("lng", String(lng));

      const res = await fetch(`/api/v1/branches?${params.toString()}`);
      const data = await res.json();

      if (res.ok && data && data.success) {
        const newPin = pinInput || data.branch?.pincode || "560001";
        const newLoc = `Pincode ${newPin}`;
        const newEta = `${data.etaminutes || 40} min`;
        const newFee = `₹${data.deliveryFee ?? 49}`;

        setPincode(newPin);
        setLocationName(newLoc);
        setEta(newEta);
        setFee(newFee);

        setDeliverySessionCookies(newPin, newLoc, newEta, newFee);
        setIsOpen(false);
        return;
      }
    } catch {
      // Fall through to local lookup
    }

    // Fallback to static local lookup
    const cleanPin = pinInput.replace(/\D/g, "");
    if (cleanPin.length === 6) {
      const newPin = cleanPin;
      const newLoc = `Pincode ${newPin}`;
      const newEta = "40-50 min";
      const newFee = "₹49";

      setPincode(newPin);
      setLocationName(newLoc);
      setEta(newEta);
      setFee(newFee);
      setDeliverySessionCookies(newPin, newLoc, newEta, newFee);
      setIsOpen(false);
    } else if (!pinInput && (lat || lng)) {
      setErrorMsg("Could not resolve GPS location. Please enter PIN code manually.");
    } else {
      setErrorMsg("Location not serviceable yet. Please enter a valid PIN code.");
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
    <div className="relative z-50 shrink-0">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-1.5 sm:gap-2 px-2 sm:px-3 py-1 sm:py-1.5 rounded-lg border border-white/20 bg-white/10 text-white hover:bg-white/15 transition-colors font-medium text-xs shadow-sm max-w-[160px] sm:max-w-none"
      >
        <MapPin className="w-3.5 h-3.5 text-[#FF4D6D] animate-pulse shrink-0" />
        <div className="flex flex-col text-left overflow-hidden">
          <span className="font-semibold text-[11px] sm:text-xs text-white truncate max-w-[95px] sm:max-w-[170px]">
            Deliver to {pincode}
          </span>
          <span className="text-[9px] sm:text-[10px] text-white/75 truncate hidden sm:inline">
            ETA: {eta} • Delivery: {fee}
          </span>
        </div>
      </button>

      {isOpen && (
        <div className="absolute left-0 mt-2 w-[calc(100vw-24px)] sm:w-80 max-w-80 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-2xl p-4 flex flex-col gap-3 z-[1000] opacity-100 popover-solid-panel">
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
