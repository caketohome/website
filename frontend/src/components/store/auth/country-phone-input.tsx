"use client";

import React, { useState, useRef, useEffect, useCallback } from "react";
import { ChevronDown, Search, X } from "lucide-react";
import { COUNTRIES, DEFAULT_COUNTRY, type Country } from "@frontend/lib/auth/countries";

export interface CountryPhoneInputProps {
  /** National number value (what the user types in the number field) */
  value: string;
  onChange: (value: string) => void;
  /** Currently selected country */
  selectedCountry: Country;
  onCountryChange: (country: Country) => void;
  disabled?: boolean;
  autoFocus?: boolean;
}

export function CountryPhoneInput({
  value,
  onChange,
  selectedCountry,
  onCountryChange,
  disabled = false,
  autoFocus = false,
}: CountryPhoneInputProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const dropdownRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const phoneRef = useRef<HTMLInputElement>(null);

  // Filter countries by name or dial code
  const filtered = search
    ? COUNTRIES.filter(
        (c) =>
          c.name.toLowerCase().includes(search.toLowerCase()) ||
          c.dialCode.includes(search.replace(/\D/g, "")) ||
          c.iso2.toLowerCase().includes(search.toLowerCase())
      )
    : COUNTRIES;

  // Close dropdown on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpen(false);
        setSearch("");
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  // Focus search when dropdown opens
  useEffect(() => {
    if (open) {
      setTimeout(() => searchRef.current?.focus(), 50);
    }
  }, [open]);

  const handleSelect = useCallback(
    (country: Country) => {
      onCountryChange(country);
      setOpen(false);
      setSearch("");
      // Focus the number input after country selection
      setTimeout(() => phoneRef.current?.focus(), 50);
    },
    [onCountryChange]
  );

  const handleToggle = () => {
    if (!disabled) setOpen((v) => !v);
  };

  return (
    <div className="relative flex items-stretch w-full" ref={dropdownRef}>
      {/* Country Selector Button */}
      <button
        type="button"
        onClick={handleToggle}
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={`Country: ${selectedCountry.name} +${selectedCountry.dialCode}`}
        className="flex items-center gap-1.5 shrink-0 bg-neutral-950 border border-neutral-800 border-r-0 rounded-l-xl px-3 py-3 text-xs font-bold text-neutral-300 hover:bg-neutral-900 hover:border-neutral-700 focus:outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20 transition-all disabled:opacity-50 disabled:cursor-not-allowed select-none min-w-[90px]"
      >
        <span className="text-base leading-none" aria-hidden="true">
          {selectedCountry.flag}
        </span>
        <span className="font-mono text-neutral-300">+{selectedCountry.dialCode}</span>
        <ChevronDown
          className={`w-3 h-3 text-neutral-500 transition-transform duration-200 ${open ? "rotate-180" : ""}`}
        />
      </button>

      {/* Divider */}
      <div className="w-px bg-neutral-800 self-stretch" />

      {/* Phone Number Input */}
      <input
        ref={phoneRef}
        id="phone_input"
        type="tel"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={selectedCountry.placeholder ?? "Enter phone number"}
        disabled={disabled}
        autoFocus={autoFocus}
        autoComplete="tel-national"
        inputMode="tel"
        className="flex-1 min-w-0 bg-neutral-950 border border-neutral-800 border-l-0 rounded-r-xl px-4 py-3 text-sm text-white font-mono placeholder-neutral-600 focus:outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
      />

      {/* Dropdown */}
      {open && (
        <div className="absolute top-full left-0 z-50 mt-1 w-72 bg-neutral-950 border border-neutral-800 rounded-xl shadow-2xl shadow-black/60 overflow-hidden">
          {/* Search */}
          <div className="p-2 border-b border-neutral-800">
            <div className="relative flex items-center">
              <Search className="absolute left-2.5 w-3.5 h-3.5 text-neutral-500 pointer-events-none" />
              <input
                ref={searchRef}
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search country or code…"
                className="w-full bg-neutral-900 border border-neutral-800 rounded-lg pl-8 pr-7 py-2 text-xs text-white placeholder-neutral-600 focus:outline-none focus:border-amber-500 transition-colors"
              />
              {search && (
                <button
                  type="button"
                  onClick={() => setSearch("")}
                  className="absolute right-2 text-neutral-500 hover:text-neutral-300"
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>
          </div>

          {/* Country List */}
          <ul
            role="listbox"
            aria-label="Select country"
            className="max-h-56 overflow-y-auto overscroll-contain"
          >
            {filtered.length === 0 ? (
              <li className="px-4 py-3 text-xs text-neutral-500 text-center">
                No countries found
              </li>
            ) : (
              filtered.map((country) => (
                <li key={country.iso2} role="option" aria-selected={country.iso2 === selectedCountry.iso2}>
                  <button
                    type="button"
                    onClick={() => handleSelect(country)}
                    className={`w-full flex items-center gap-3 px-3 py-2 text-left hover:bg-neutral-800 transition-colors text-xs ${
                      country.iso2 === selectedCountry.iso2
                        ? "bg-amber-500/10 text-amber-400"
                        : "text-neutral-200"
                    }`}
                  >
                    <span className="text-base leading-none w-5 text-center shrink-0">
                      {country.flag}
                    </span>
                    <span className="flex-1 truncate">{country.name}</span>
                    <span className="font-mono text-neutral-500 shrink-0">
                      +{country.dialCode}
                    </span>
                  </button>
                </li>
              ))
            )}
          </ul>
        </div>
      )}
    </div>
  );
}

