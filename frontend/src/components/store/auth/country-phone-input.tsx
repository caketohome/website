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
        className="flex items-center gap-1.5 shrink-0 bg-white border border-brand-border border-r-0 rounded-l-xl px-3 py-3 text-xs font-bold text-brand-text hover:bg-brand-surface-muted hover:border-brand-text-muted/40 focus:outline-none focus:border-brand-primary focus:ring-2 focus:ring-brand-primary/20 transition-all disabled:opacity-50 disabled:cursor-not-allowed select-none min-w-[90px]"
      >
        <span className="text-base leading-none" aria-hidden="true">
          {selectedCountry.flag}
        </span>
        <span className="font-mono text-brand-text">+{selectedCountry.dialCode}</span>
        <ChevronDown
          className={`w-3 h-3 text-brand-text-muted transition-transform duration-200 ${open ? "rotate-180" : ""}`}
        />
      </button>

      {/* Divider */}
      <div className="w-px bg-brand-border self-stretch" />

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
        className="flex-1 min-w-0 bg-white border border-brand-border border-l-0 rounded-r-xl px-4 py-3 text-sm text-brand-text font-mono placeholder:text-brand-text-muted/70 focus:outline-none focus:border-brand-primary focus:ring-2 focus:ring-brand-primary/20 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
      />

      {/* Dropdown */}
      {open && (
        <div className="absolute top-full left-0 z-50 mt-1 w-72 bg-white border border-brand-border rounded-xl shadow-lg overflow-hidden">
          {/* Search */}
          <div className="p-2 border-b border-brand-border">
            <div className="relative flex items-center">
              <Search className="absolute left-2.5 w-3.5 h-3.5 text-brand-text-muted pointer-events-none" />
              <input
                ref={searchRef}
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search country or code…"
                className="w-full bg-white border border-brand-border rounded-lg pl-8 pr-7 py-2 text-xs text-brand-text placeholder:text-brand-text-muted/70 focus:outline-none focus:border-brand-primary transition-colors"
              />
              {search && (
                <button
                  type="button"
                  onClick={() => setSearch("")}
                  className="absolute right-2 text-brand-text-muted hover:text-brand-text"
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
              <li className="px-4 py-3 text-xs text-brand-text-muted text-center">
                No countries found
              </li>
            ) : (
              filtered.map((country) => (
                <li key={country.iso2} role="option" aria-selected={country.iso2 === selectedCountry.iso2}>
                  <button
                    type="button"
                    onClick={() => handleSelect(country)}
                    className={`w-full flex items-center gap-3 px-3 py-2 text-left hover:bg-brand-surface-muted transition-colors text-xs ${
                      country.iso2 === selectedCountry.iso2
                        ? "bg-brand-light text-brand-primary"
                        : "text-brand-text"
                    }`}
                  >
                    <span className="text-base leading-none w-5 text-center shrink-0">
                      {country.flag}
                    </span>
                    <span className="flex-1 truncate">{country.name}</span>
                    <span className="font-mono text-brand-text-muted shrink-0">
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

