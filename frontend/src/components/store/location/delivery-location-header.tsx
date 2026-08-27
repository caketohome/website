"use client";

import React, { useState, useEffect } from "react";
import { MapPin, Navigation, X, Building2, Globe2 } from "lucide-react";
import { Button, Input, Label, Text } from "@medusajs/ui";

/**
 * DeliveryLocationHeader Component
 * Canonical Multi-State / Multi-City / Multi-Store storefront location widget.
 * Displays customer's delivery PIN code/address and ETA without exposing internal branch details.
 * Supports:
 * 1. Pincode Input
 * 2. GPS Auto-detection (with non-destructive consent)
 * 3. State -> City Cascade Selector
 */
export function DeliveryLocationHeader() {
  const [pincode, setPincode] = useState("");
  const [cityName, setCityName] = useState("");
  const [stateName, setStateName] = useState("");
  const [locationName, setLocationName] = useState("Set your location");
  const [eta, setEta] = useState("");
  const [fee, setFee] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<"pincode" | "browse">("pincode");
  const [inputPin, setInputPin] = useState("");
  const [isLocating, setIsLocating] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  // Cascade selector state
  const [states, setStates] = useState<Array<{ id: string; code: string; name: string }>>([]);
  const [cities, setCities] = useState<Array<{ id: string; name: string; state: string; stateCode: string; state_id?: string; slug: string }>>([]);
  const [selectedStateCode, setSelectedStateCode] = useState<string>("");
  const [selectedCityId, setSelectedCityId] = useState<string>("");
  const [loadingCascade, setLoadingCascade] = useState<boolean>(false);

  const getCookie = (name: string): string | null => {
    if (typeof document === "undefined") return null;
    const value = `; ${document.cookie}`;
    const parts = value.split(`; ${name}=`);
    if (parts.length === 2) return parts.pop()?.split(";").shift() || null;
    return null;
  };

  const setDeliverySessionCookies = (pin: string, locName: string, etaTime: string, delFee: string, city?: string, state?: string) => {
    document.cookie = `delivery_pincode=${pin}; path=/; max-age=31536000; SameSite=Lax`;
    document.cookie = `delivery_location=${encodeURIComponent(locName)}; path=/; max-age=31536000; SameSite=Lax`;
    document.cookie = `delivery_eta=${encodeURIComponent(etaTime)}; path=/; max-age=31536000; SameSite=Lax`;
    document.cookie = `delivery_fee=${encodeURIComponent(delFee)}; path=/; max-age=31536000; SameSite=Lax`;
    if (city) document.cookie = `delivery_city=${encodeURIComponent(city)}; path=/; max-age=31536000; SameSite=Lax`;
    if (state) document.cookie = `delivery_state=${encodeURIComponent(state)}; path=/; max-age=31536000; SameSite=Lax`;
  };

  useEffect(() => {
    const savedPin = getCookie("delivery_pincode");
    const savedLoc = getCookie("delivery_location");
    const savedEta = getCookie("delivery_eta");
    const savedFee = getCookie("delivery_fee");
    const savedCity = getCookie("delivery_city");
    const savedState = getCookie("delivery_state");

    if (savedPin) setPincode(savedPin);
    if (savedLoc) setLocationName(decodeURIComponent(savedLoc));
    if (savedEta) setEta(decodeURIComponent(savedEta));
    if (savedFee) setFee(decodeURIComponent(savedFee));
    if (savedCity) setCityName(decodeURIComponent(savedCity));
    if (savedState) setStateName(decodeURIComponent(savedState));
  }, []);

  // Fetch states and cities when modal opens
  useEffect(() => {
    if (isOpen && states.length === 0) {
      setLoadingCascade(true);
      Promise.all([
        fetch("/api/v1/states").then(r => r.json()).catch(() => ({ states: [] })),
        fetch("/api/v1/cities").then(r => r.json()).catch(() => ({ cities: [] })),
      ]).then(([statesRes, citiesRes]) => {
        if (statesRes?.states) setStates(statesRes.states);
        if (citiesRes?.cities) setCities(citiesRes.cities);
      }).finally(() => {
        setLoadingCascade(false);
      });
    }
  }, [isOpen, states.length]);

  const handleResolveLocation = async (pinInput: string, lat?: number, lng?: number) => {
    setErrorMsg("");
    try {
      const params = new URLSearchParams();
      if (pinInput) params.set("pincode", pinInput);
      if (lat) params.set("lat", String(lat));
      if (lng) params.set("lng", String(lng));

      const res = await fetch(`/api/v1/delivery/resolve?${params.toString()}`);
      const data = await res.json();

      if (res.ok && data && data.serviceable) {
        const newPin = pinInput || data.pincode || "";
        const resolvedCity = data.cityName || "";
        const resolvedState = data.stateName || "";
        const newLoc = resolvedCity ? `${resolvedCity}${resolvedState ? `, ${resolvedState}` : ""} — ${newPin}` : `Pincode ${newPin}`;
        const newEta = `${data.etaMinutes || 40} min`;
        const newFee = data.deliveryFee === 0 ? "FREE" : `₹${data.deliveryFee ?? 49}`;

        setPincode(newPin);
        setCityName(resolvedCity);
        setStateName(resolvedState);
        setLocationName(newLoc);
        setEta(newEta);
        setFee(newFee);

        setDeliverySessionCookies(newPin, newLoc, newEta, newFee, resolvedCity, resolvedState);
        setIsOpen(false);
        return;
      } else if (data && !data.serviceable) {
        setErrorMsg(data.blockedReason || "This location is not currently serviceable.");
        return;
      }
    } catch {
      // Fall through to local lookup
    }

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

  const handleCitySelect = (cityId: string) => {
    const city = cities.find(c => c.id === cityId);
    if (!city) return;
    setSelectedCityId(cityId);
    setCityName(city.name);
    setStateName(city.state);
    
    // Resolve location for this city
    fetch(`/api/v1/cities/${city.slug}`).then(r => r.json()).then(data => {
      const branch = data?.branches?.[0];
      const pin = branch?.pincode || (city as any).pincode || "";
      if (pin) {
        handleResolveLocation(pin);
      } else {
        const newLoc = `${city.name}, ${city.state}`;
        setLocationName(newLoc);
        setDeliverySessionCookies("", newLoc, "40 min", "₹49", city.name, city.state);
        setIsOpen(false);
      }
    }).catch(() => {
      const newLoc = `${city.name}, ${city.state}`;
      setLocationName(newLoc);
      setDeliverySessionCookies("", newLoc, "40 min", "₹49", city.name, city.state);
      setIsOpen(false);
    });
  };

  const filteredCities = selectedStateCode
    ? cities.filter(c => c.stateCode === selectedStateCode || c.state_id === selectedStateCode)
    : cities;

  return (
    <div className="relative z-50 shrink-0">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-1.5 sm:gap-2 px-2 sm:px-3 py-1 sm:py-1.5 rounded-lg border border-white/20 bg-white/10 text-white hover:bg-white/15 transition-colors font-medium text-xs shadow-sm max-w-[160px] sm:max-w-none"
      >
        <MapPin className="w-3.5 h-3.5 text-[#FF4D6D] animate-pulse shrink-0" />
        <div className="flex flex-col text-left overflow-hidden">
          <span className="font-semibold text-[11px] sm:text-xs text-white truncate max-w-[95px] sm:max-w-[170px]">
            {pincode ? `Deliver to ${pincode}` : (cityName ? `${cityName}` : "Set location")}
          </span>
          <span className="text-[9px] sm:text-[10px] text-white/75 truncate hidden sm:inline">
            {cityName && `${cityName}${stateName ? `, ${stateName}` : ""} • `}{eta && `ETA: ${eta}`}{fee && ` • ${fee}`}
          </span>
        </div>
      </button>

      {isOpen && (
        <div className="absolute left-0 mt-2 w-[calc(100vw-24px)] sm:w-88 max-w-96 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-2xl p-4 flex flex-col gap-3 z-[1000] opacity-100 popover-solid-panel">
          <div className="flex justify-between items-center">
            <h3 className="font-semibold text-sm">Select Delivery Location</h3>
            <button onClick={() => setIsOpen(false)} className="text-ui-fg-muted hover:text-ui-fg-base">
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Mode Switcher Tabs */}
          <div className="flex rounded-lg bg-slate-100 dark:bg-slate-800 p-1 text-xs">
            <button
              onClick={() => setActiveTab("pincode")}
              className={`flex-1 py-1.5 rounded-md font-medium transition-all ${
                activeTab === "pincode"
                  ? "bg-white dark:bg-slate-900 text-pink-600 shadow-sm font-semibold"
                  : "text-slate-600 dark:text-slate-400 hover:text-slate-900"
              }`}
            >
              PIN Code & GPS
            </button>
            <button
              onClick={() => setActiveTab("browse")}
              className={`flex-1 py-1.5 rounded-md font-medium transition-all ${
                activeTab === "browse"
                  ? "bg-white dark:bg-slate-900 text-pink-600 shadow-sm font-semibold"
                  : "text-slate-600 dark:text-slate-400 hover:text-slate-900"
              }`}
            >
              Select State & City
            </button>
          </div>

          {activeTab === "pincode" ? (
            <>
              <form onSubmit={handleSubmitPincode} className="flex flex-col gap-2">
                <Label htmlFor="header-pincode" className="text-xs">
                  Enter Delivery PIN Code
                </Label>
                <div className="flex gap-2">
                  <Input
                    id="header-pincode"
                    type="text"
                    maxLength={6}
                    placeholder="e.g. 560001, 682016, 600017"
                    value={inputPin}
                    onChange={(e) => setInputPin(e.target.value.replace(/\D/g, ""))}
                    autoFocus
                  />
                  <Button type="submit" size="small" variant="primary">
                    Check
                  </Button>
                </div>
              </form>

              <div className="flex items-center gap-2 my-1">
                <div className="border-t border-slate-200 dark:border-slate-800 flex-1" />
                <span className="text-[10px] text-slate-400 uppercase font-bold tracking-wider">or</span>
                <div className="border-t border-slate-200 dark:border-slate-800 flex-1" />
              </div>

              <Button
                variant="secondary"
                size="small"
                onClick={handleGPSLocation}
                disabled={isLocating}
                className="flex items-center justify-center gap-2 w-full text-xs"
              >
                <Navigation className="w-3.5 h-3.5" />
                {isLocating ? "Detecting GPS location..." : "Use GPS Current Location"}
              </Button>
            </>
          ) : (
            <div className="flex flex-col gap-3">
              <div>
                <Label className="text-xs flex items-center gap-1 mb-1">
                  <Globe2 className="w-3.5 h-3.5 text-pink-500" />
                  Select State
                </Label>
                <select
                  value={selectedStateCode}
                  onChange={(e) => {
                    setSelectedStateCode(e.target.value);
                    setSelectedCityId("");
                  }}
                  className="w-full text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-slate-900 dark:text-white"
                >
                  <option value="">All States ({states.length})</option>
                  {states.map((s) => (
                    <option key={s.id} value={s.code}>
                      {s.name} ({s.code})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <Label className="text-xs flex items-center gap-1 mb-1">
                  <Building2 className="w-3.5 h-3.5 text-pink-500" />
                  Select City
                </Label>
                <select
                  value={selectedCityId}
                  onChange={(e) => handleCitySelect(e.target.value)}
                  className="w-full text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-slate-900 dark:text-white"
                >
                  <option value="">Choose a city...</option>
                  {filteredCities.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} — {c.state}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          )}

          {errorMsg && <Text className="text-xs text-red-500 font-medium text-center">{errorMsg}</Text>}
        </div>
      )}
    </div>
  );
}
