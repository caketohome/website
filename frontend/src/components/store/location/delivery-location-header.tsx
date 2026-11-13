"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import { MapPin, Navigation, X, Building2, Globe2, Search, Loader2 } from "lucide-react";
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
export interface DeliveryLocationHeaderProps {
  variant?: "pill" | "bar" | "auto";
  className?: string;
}

export function DeliveryLocationHeader({
  variant = "auto",
  className = "",
}: DeliveryLocationHeaderProps = {}) {
  const [pincode, setPincode] = useState("");
  const [cityName, setCityName] = useState("");
  const [stateName, setStateName] = useState("");
  const [locationName, setLocationName] = useState("Select delivery location");
  const [eta, setEta] = useState("");
  const [fee, setFee] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<"search" | "browse" | "pincode">("search");
  const [inputPin, setInputPin] = useState("");
  const [isLocating, setIsLocating] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);

  // Search location state
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<Array<{ id: string; displayName: string; latitude: number; longitude: number; city?: string; pincode?: string }>>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const searchDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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

  const setDeliverySessionCookies = (pin: string, locName: string, etaTime: string, delFee: string, city?: string, state?: string, lat?: number, lng?: number) => {
    document.cookie = `delivery_pincode=${pin}; path=/; max-age=31536000; SameSite=Lax`;
    document.cookie = `delivery_location=${encodeURIComponent(locName)}; path=/; max-age=31536000; SameSite=Lax`;
    document.cookie = `delivery_eta=${encodeURIComponent(etaTime)}; path=/; max-age=31536000; SameSite=Lax`;
    document.cookie = `delivery_fee=${encodeURIComponent(delFee)}; path=/; max-age=31536000; SameSite=Lax`;
    if (city) document.cookie = `delivery_city=${encodeURIComponent(city)}; path=/; max-age=31536000; SameSite=Lax`;
    if (state) document.cookie = `delivery_state=${encodeURIComponent(state)}; path=/; max-age=31536000; SameSite=Lax`;
    if (typeof lat === "number" && typeof lng === "number") {
      document.cookie = `delivery_lat=${lat.toFixed(6)}; path=/; max-age=31536000; SameSite=Lax`;
      document.cookie = `delivery_lng=${lng.toFixed(6)}; path=/; max-age=31536000; SameSite=Lax`;
    }
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

  // Click outside listener for modal
  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isOpen]);

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
        const newLoc = resolvedCity
          ? `${resolvedCity}${resolvedState ? `, ${resolvedState}` : ""}${newPin ? ` — ${newPin}` : ""}`
          : (newPin ? `Pincode ${newPin}` : "Bangalore");
        const newEta = `${data.etaMinutes || 40} min`;
        const newFee = data.deliveryFee === 0 ? "FREE" : `₹${data.deliveryFee ?? 49}`;

        setPincode(newPin);
        setCityName(resolvedCity);
        setStateName(resolvedState);
        setLocationName(newLoc);
        setEta(newEta);
        setFee(newFee);

        setDeliverySessionCookies(newPin, newLoc, newEta, newFee, resolvedCity, resolvedState, lat, lng);
        setIsOpen(false);
        return;
      } else if (data && !data.serviceable) {
        setErrorMsg(data.blockedReason || "We currently don't deliver to this location. Please select another area or city.");
        return;
      }
    } catch {
      setErrorMsg("Unable to verify delivery serviceability. Please select your area or city.");
      return;
    }

    setErrorMsg("Please select your area or use GPS to set delivery location.");
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
        setErrorMsg("GPS permission was not granted. You can search your area or select your city above.");
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
    fetch(`/api/v1/cities/${city.slug}`)
      .then((r) => r.json())
      .then((data) => {
        const branch = data?.branches?.[0];
        const pin = branch?.pincode || (city as any).pincode || "";
        if (pin) {
          handleResolveLocation(pin);
        } else {
          // Resolve dynamically via delivery resolve API using city name
          fetch(`/api/v1/delivery/resolve?city=${encodeURIComponent(city.name)}`)
            .then((r) => r.json())
            .then((delData) => {
              const isServ = delData && delData.serviceable === true;
              const newLoc = `${city.name}, ${city.state}`;
              const newEta = isServ && delData.etaMinutes ? `${delData.etaMinutes} min` : "";
              const newFee = isServ && typeof delData.deliveryFee === "number" ? (delData.deliveryFee === 0 ? "FREE" : `₹${delData.deliveryFee}`) : "";
              setLocationName(newLoc);
              setEta(newEta);
              setFee(newFee);
              setDeliverySessionCookies("", newLoc, newEta, newFee, city.name, city.state);
              setIsOpen(false);
            })
            .catch(() => {
              const newLoc = `${city.name}, ${city.state}`;
              setLocationName(newLoc);
              setEta("");
              setFee("");
              setDeliverySessionCookies("", newLoc, "", "", city.name, city.state);
              setIsOpen(false);
            });
        }
      })
      .catch(() => {
        const newLoc = `${city.name}, ${city.state}`;
        setLocationName(newLoc);
        setEta("");
        setFee("");
        setDeliverySessionCookies("", newLoc, "", "", city.name, city.state);
        setIsOpen(false);
      });
  };

  const filteredCities = selectedStateCode
    ? cities.filter(c => c.stateCode === selectedStateCode || c.state_id === selectedStateCode)
    : cities;

  const displayLocationText = pincode
    ? `Deliver to ${pincode}`
    : cityName
    ? `Deliver to ${cityName}`
    : "Select delivery location";

  return (
    <div ref={containerRef} className={`relative z-50 ${variant === "bar" ? "w-full" : "shrink-0"} ${className}`}>
      {variant === "bar" ? (
        /* Mobile Full-Width Sub-Header Bar */
        <button
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          aria-label="Select delivery location"
          className="w-full flex items-center justify-between px-3 py-1.5 text-xs text-slate-800 bg-white hover:bg-navy-accent/[0.04] transition-colors focus:outline-none focus:bg-navy-accent/[0.06]"
        >
          <div className="flex items-center gap-2 min-w-0 pr-2">
            <MapPin className="w-3.5 h-3.5 text-[#2563EB] animate-pulse shrink-0" />
            <span className="font-semibold text-xs text-slate-800 truncate">
              {displayLocationText}
            </span>
            {eta && (
              <span className="text-[10px] text-slate-500 font-medium shrink-0 bg-blue-50/60 px-1.5 py-0.5 rounded">
                ⚡ {eta}{fee ? ` • ${fee}` : ""}
              </span>
            )}
          </div>
          <span className="text-[11px] font-semibold text-[#0F172A] dark:text-[#2563EB] hover:underline shrink-0 ml-1">
            Change ›
          </span>
        </button>
      ) : (
        /* Desktop / Standard Pill Button */
        <button
          type="button"
          onClick={() => {
            console.log("[DeliveryLocationHeader] CLICKED! Previous isOpen:", isOpen);
            setIsOpen((prev) => !prev);
          }}
          aria-label="Select delivery location"
          className="flex items-center gap-1.5 sm:gap-2 px-2.5 sm:px-3 py-1 sm:py-1.5 rounded-lg border border-slate-200 bg-blue-50/60 text-slate-800 hover:bg-blue-100/60 transition-colors font-medium text-xs shadow-sm max-w-[200px] lg:max-w-none focus:outline-none focus:ring-2 focus:ring-navy-accent/20"
        >
          <MapPin className="w-3.5 h-3.5 text-[#2563EB] animate-pulse shrink-0" />
          <div className="flex flex-col text-left overflow-hidden">
            <span className="font-semibold text-[11px] sm:text-xs text-slate-800 truncate max-w-[110px] sm:max-w-[170px]">
              {pincode ? `Deliver to ${pincode}` : (cityName ? `${cityName}` : "Select location")}
            </span>
            <span className="text-[9px] sm:text-[10px] text-slate-500 truncate hidden sm:inline">
              {cityName ? `${cityName}${stateName ? `, ${stateName}` : ""}` : "Check serviceability"}
              {eta ? ` • ETA: ${eta}` : ""}
              {fee ? ` • ${fee}` : ""}
            </span>
          </div>
        </button>
      )}

      {isOpen && (
        <>
          {/* Mobile Backdrop */}
          <div
            className="fixed inset-0 bg-black/40 z-[999] backdrop-blur-[2px] sm:hidden"
            onClick={() => setIsOpen(false)}
          />
          <div className="fixed inset-x-3 top-24 sm:absolute sm:inset-x-auto sm:left-0 sm:top-full sm:mt-2 w-[calc(100vw-24px)] sm:w-88 max-w-96 rounded-2xl border border-slate-200 dark:border-white/15 bg-white/95 dark:bg-[#0D152B]/90 backdrop-blur-xl supports-[backdrop-filter]:bg-white/90 supports-[backdrop-filter]:dark:bg-[#0D152B]/85 text-slate-900 dark:text-white shadow-[0_20px_50px_rgba(20,32,64,0.25)] p-4 flex flex-col gap-3 z-[1000] opacity-100 popover-solid-panel">
            <div className="flex justify-between items-center">
              <h3 className="font-bold text-sm text-[#0F172A] dark:text-white">Select Delivery Location</h3>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                aria-label="Close location selector"
                className="text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white p-1"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

          {/* Mode Switcher Tabs */}
          <div className="flex rounded-lg bg-slate-100 dark:bg-slate-800 p-1 text-xs">
            <button
              onClick={() => setActiveTab("search")}
              className={`flex-1 py-1.5 rounded-md font-medium transition-all ${
                activeTab === "search"
                  ? "bg-white dark:bg-slate-900 text-[#0F172A] dark:text-[#2563EB] shadow-sm font-semibold"
                  : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
              }`}
            >
              Search Area
            </button>
            <button
              onClick={() => setActiveTab("browse")}
              className={`flex-1 py-1.5 rounded-md font-medium transition-all ${
                activeTab === "browse"
                  ? "bg-white dark:bg-slate-900 text-[#0F172A] dark:text-[#2563EB] shadow-sm font-semibold"
                  : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
              }`}
            >
              State & City
            </button>
            <button
              onClick={() => setActiveTab("pincode")}
              className={`flex-1 py-1.5 rounded-md font-medium transition-all ${
                activeTab === "pincode"
                  ? "bg-white dark:bg-slate-900 text-[#0F172A] dark:text-[#2563EB] shadow-sm font-semibold"
                  : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
              }`}
            >
              PIN (Optional)
            </button>
          </div>

          {/* Search Location Tab */}
          {activeTab === "search" && (
            <div className="flex flex-col gap-2.5">
              <Button
                size="small"
                variant="secondary"
                disabled={isLocating}
                onClick={handleGPSLocation}
                className="w-full flex items-center justify-center gap-2 text-xs font-bold py-2.5 bg-[#2563EB] hover:bg-[#1D4ED8] text-white rounded-xl shadow-sm transition-all active:scale-[0.98] border-none"
              >
                {isLocating ? (
                  <Loader2 className="w-4 h-4 animate-spin text-[#2563EB]" />
                ) : (
                  <Navigation className="w-4 h-4 text-[#2563EB]" />
                )}
                {isLocating ? "Detecting GPS location..." : "Use Current GPS Location"}
              </Button>

              <div className="flex items-center gap-2 my-0.5">
                <div className="border-t border-slate-200 dark:border-slate-800 flex-1" />
                <span className="text-[10px] text-slate-500 dark:text-slate-400 uppercase font-bold tracking-wider">or search</span>
                <div className="border-t border-slate-200 dark:border-slate-800 flex-1" />
              </div>

              <Label className="text-xs font-semibold text-slate-700 dark:text-slate-200 flex items-center gap-1">
                <Search className="w-3.5 h-3.5 text-[#2563EB]" />
                Search by Area or Landmark
              </Label>
              <div className="relative">
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => {
                    const q = e.target.value;
                    setSearchQuery(q);
                    setErrorMsg("");
                    if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
                    if (q.trim().length < 2) { setSearchResults([]); return; }
                    setSearchLoading(true);
                    searchDebounceRef.current = setTimeout(async () => {
                      try {
                        const res = await fetch(`/api/v1/delivery/search-location?q=${encodeURIComponent(q.trim())}`);
                        if (res.ok) {
                          const data = await res.json();
                          setSearchResults((data.results || []).slice(0, 6).map((r: any, idx: number) => ({
                            id: r.id || `sr_${idx}`,
                            displayName: r.display_name || r.formatted_address || r.area_name || r.name || q,
                            latitude: typeof r.latitude === "number" ? r.latitude : (typeof r.lat === "number" ? r.lat : 0),
                            longitude: typeof r.longitude === "number" ? r.longitude : (typeof r.lng === "number" ? r.lng : 0),
                            city: r.city || r.city_name || "",
                            pincode: r.pincode || "",
                          })));
                        }
                      } catch {} finally { setSearchLoading(false); }
                    }, 300);
                  }}
                  placeholder="e.g. Indiranagar, Koramangala, MG Road..."
                  className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#2563EB]/40"
                  autoFocus
                />
                {searchLoading && <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 animate-spin" />}
              </div>
              {searchResults.length > 0 && (
                <div className="border border-slate-200 dark:border-slate-700 rounded-lg overflow-hidden max-h-44 overflow-y-auto">
                  {searchResults.map((r) => (
                    <button
                      key={r.id}
                      onClick={() => {
                        if (r.latitude && r.longitude) {
                          handleResolveLocation(r.pincode || "", r.latitude, r.longitude);
                        } else if (r.pincode) {
                          handleResolveLocation(r.pincode);
                        }
                        setSearchQuery("");
                        setSearchResults([]);
                      }}
                      className="w-full text-left px-3 py-2 text-xs hover:bg-brand-gold-soft dark:hover:bg-slate-800 border-b border-slate-100 dark:border-slate-800 last:border-0 flex items-center gap-2"
                    >
                      <MapPin className="w-3 h-3 text-[#2563EB] flex-shrink-0" />
                      <div className="min-w-0">
                        <div className="font-medium text-slate-700 dark:text-slate-200 truncate">{r.displayName}</div>
                        {r.city && <div className="text-[10px] text-slate-400">{r.city}{r.pincode ? ` — ${r.pincode}` : ""}</div>}
                      </div>
                    </button>
                  ))}
                </div>
              )}
              {/* Bangalore Quick-Pick Area Chips */}
              <div className="flex flex-col gap-1.5 mt-2">
                <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Popular Delivery Hubs:</span>
                <div className="flex flex-wrap gap-1.5">
                  {([
                    // shortcut: no verified Kerala hubs configured yet; chips hidden until supplied
                  ] as { name: string; pin: string }[]).map((area) => (
                    <button
                      key={area.name}
                      type="button"
                      onClick={() => handleResolveLocation(area.pin)}
                      className="px-2.5 py-1 rounded-full text-[11px] font-medium bg-slate-100 hover:bg-amber-50 hover:text-[#0F172A] hover:border-blue-200 border border-slate-200 transition-all"
                    >
                      📍 {area.name}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {activeTab === "browse" && (
            <div className="flex flex-col gap-3">
              <div>
                <Label className="text-xs flex items-center gap-1 mb-1">
                  <Globe2 className="w-3.5 h-3.5 text-[#2563EB]" />
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
                  <Building2 className="w-3.5 h-3.5 text-[#2563EB]" />
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

          {activeTab === "pincode" && (
            <>
              <form onSubmit={handleSubmitPincode} className="flex flex-col gap-2">
                <Label htmlFor="header-pincode" className="text-xs">
                  Enter Delivery PIN Code (Optional)
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
          )}

          {errorMsg && <Text className="text-xs text-red-500 font-medium text-center">{errorMsg}</Text>}
        </div>
        </>
      )}
    </div>
  );
}
