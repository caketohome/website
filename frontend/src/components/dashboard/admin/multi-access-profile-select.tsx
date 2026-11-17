"use client";

import React, { useState, useRef, useEffect, useMemo, useCallback } from "react";
import {
  Shield,
  Check,
  X,
  Search,
  ChevronDown,
  Info,
  Sparkles,
  AlertCircle,
  Lock,
  Layers,
} from "lucide-react";
import { AccessProfile, PermissionDefinition } from "@frontend/lib/staff-access-control";

export interface MultiAccessProfileSelectProps {
  profiles: AccessProfile[];
  selectedProfileIds: string[];
  onChange: (selectedIds: string[]) => void;
  isLoading?: boolean;
  error?: string | null;
  required?: boolean;
  disabled?: boolean;
  label?: string;
  catalog?: PermissionDefinition[];
  className?: string;
}

export function MultiAccessProfileSelect({
  profiles = [],
  selectedProfileIds = [],
  onChange,
  isLoading = false,
  error = null,
  required = true,
  disabled = false,
  label = "Assigned Access Profiles *",
  catalog = [],
  className = "",
}: MultiAccessProfileSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [focusedIndex, setFocusedIndex] = useState(-1);
  const [inspectingProfile, setInspectingProfile] = useState<AccessProfile | null>(null);

  const containerRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const optionsListRef = useRef<HTMLDivElement>(null);

  // Available (non-archived) profiles
  const activeProfiles = useMemo(() => {
    return profiles.filter((p) => p.status !== "ARCHIVED");
  }, [profiles]);

  // Filtered by search query
  const filteredProfiles = useMemo(() => {
    if (!searchQuery.trim()) return activeProfiles;
    const q = searchQuery.toLowerCase().trim();
    return activeProfiles.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        p.description.toLowerCase().includes(q) ||
        p.permissions.some((perm) => perm.toLowerCase().includes(q))
    );
  }, [activeProfiles, searchQuery]);

  // Selected profile objects
  const selectedProfiles = useMemo(() => {
    return activeProfiles.filter((p) => selectedProfileIds.includes(p.id));
  }, [activeProfiles, selectedProfileIds]);

  // Deduplicated UNION of all unique permissions across selected profiles
  const uniqueEffectivePermissions = useMemo(() => {
    const permSet = new Set<string>();
    selectedProfiles.forEach((p) => {
      (p.permissions || []).forEach((perm) => permSet.add(perm));
    });
    return Array.from(permSet);
  }, [selectedProfiles]);

  // Close on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
        setInspectingProfile(null);
      }
    };
    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isOpen]);

  // Focus search input when popover opens
  useEffect(() => {
    if (isOpen && searchInputRef.current) {
      setTimeout(() => {
        searchInputRef.current?.focus();
      }, 50);
    } else {
      setSearchQuery("");
      setFocusedIndex(-1);
    }
  }, [isOpen]);

  const toggleProfile = useCallback(
    (profileId: string) => {
      if (disabled) return;
      if (selectedProfileIds.includes(profileId)) {
        onChange(selectedProfileIds.filter((id) => id !== profileId));
      } else {
        onChange([...selectedProfileIds, profileId]);
      }
    },
    [selectedProfileIds, onChange, disabled]
  );

  const removeProfile = (profileId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (disabled) return;
    onChange(selectedProfileIds.filter((id) => id !== profileId));
  };

  const selectAll = () => {
    if (disabled) return;
    const allIds = activeProfiles.map((p) => p.id);
    onChange(allIds);
  };

  const clearAll = (e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (disabled) return;
    onChange([]);
  };

  // Keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (disabled) return;

    if (!isOpen) {
      if (e.key === "Enter" || e.key === " " || e.key === "ArrowDown") {
        e.preventDefault();
        setIsOpen(true);
      }
      return;
    }

    if (e.key === "Escape") {
      e.preventDefault();
      setIsOpen(false);
      setInspectingProfile(null);
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      setFocusedIndex((prev) => (prev < filteredProfiles.length - 1 ? prev + 1 : 0));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setFocusedIndex((prev) => (prev > 0 ? prev - 1 : filteredProfiles.length - 1));
    } else if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      if (focusedIndex >= 0 && focusedIndex < filteredProfiles.length) {
        toggleProfile(filteredProfiles[focusedIndex].id);
      }
    }
  };

  return (
    <div ref={containerRef} className={`relative w-full ${className}`}>
      {/* Label and Selected Metrics Header */}
      <div className="flex items-center justify-between gap-2 mb-1.5">
        <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
          <Shield className="w-3.5 h-3.5 text-brand-primary dark:text-brand-primary" />
          <span>{label}</span>
        </label>
        {selectedProfiles.length > 0 && (
          <div className="flex items-center gap-1.5">
            <span className="text-[11px] font-bold text-brand-primary dark:text-brand-primary bg-brand-light dark:bg-brand-navy/80 px-2 py-0.5 rounded-full border border-brand-primary/30 dark:border-brand-navy flex items-center gap-1 shadow-2xs">
              <Layers className="w-3 h-3" />
              {selectedProfiles.length} Profile{selectedProfiles.length > 1 ? "s" : ""} •{" "}
              <span className="text-emerald-600 dark:text-emerald-400 font-extrabold">
                {uniqueEffectivePermissions.length} Unique Perms
              </span>
            </span>
          </div>
        )}
      </div>

      {/* Main Trigger Control Button */}
      <div
        tabIndex={disabled ? -1 : 0}
        role="combobox"
        aria-expanded={isOpen}
        aria-haspopup="listbox"
        aria-controls="access-profiles-listbox"
        aria-label={label}
        onClick={() => !disabled && setIsOpen((prev) => !prev)}
        onKeyDown={handleKeyDown}
        className={`w-full min-h-[42px] px-3 py-1.5 rounded-xl border transition-all duration-200 flex items-center justify-between gap-2 cursor-pointer select-none ${
          disabled
            ? "bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-slate-700 opacity-60 cursor-not-allowed"
            : isOpen
            ? "border-brand-primary ring-2 ring-brand-primary/20 bg-white dark:bg-slate-900 shadow-sm"
            : "border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-slate-300 dark:hover:border-slate-700 shadow-2xs"
        }`}
      >
        {/* Selected Chips Container */}
        <div className="flex flex-wrap items-center gap-1.5 flex-1 min-w-0 py-0.5">
          {isLoading ? (
            <span className="text-xs text-slate-400 flex items-center gap-1.5">
              <span className="w-3.5 h-3.5 border-2 border-brand-primary border-t-transparent rounded-full animate-spin" />
              Loading access profiles...
            </span>
          ) : selectedProfiles.length === 0 ? (
            <span className="text-xs text-slate-400 dark:text-slate-500">
              Select one or more access profiles (e.g. Telecaller, Support)...
            </span>
          ) : (
            selectedProfiles.map((prof) => (
              <span
                key={prof.id}
                className="inline-flex items-center gap-1 pl-2 pr-1.5 py-0.5 rounded-lg text-xs font-semibold bg-brand-light dark:bg-brand-navy/90 text-brand-navy dark:text-brand-primary/30 border border-brand-primary/30 dark:border-brand-navy/80 animate-in fade-in zoom-in-95 group shadow-2xs"
              >
                <span>{prof.name}</span>
                <span className="text-[10px] opacity-75 font-mono">({prof.permissions.length})</span>
                {!disabled && (
                  <button
                    type="button"
                    onClick={(e) => removeProfile(prof.id, e)}
                    className="p-0.5 hover:bg-brand-primary/30 dark:hover:bg-brand-navy rounded text-brand-primary dark:text-brand-primary hover:text-brand-navy dark:hover:text-brand-light transition-colors cursor-pointer"
                    aria-label={`Remove profile ${prof.name}`}
                  >
                    <X className="w-3 h-3" />
                  </button>
                )}
              </span>
            ))
          )}
        </div>

        {/* Action Controls & Chevron */}
        <div className="flex items-center gap-1.5 shrink-0 ml-1">
          {selectedProfiles.length > 0 && !disabled && (
            <button
              type="button"
              onClick={clearAll}
              className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-md text-[11px] transition-colors"
              title="Clear all selected profiles"
              aria-label="Clear all profiles"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
          <ChevronDown
            className={`w-4 h-4 text-slate-400 transition-transform duration-200 ${
              isOpen ? "rotate-180 text-brand-primary dark:text-brand-primary" : ""
            }`}
          />
        </div>
      </div>

      {/* Validation Message */}
      {required && selectedProfiles.length === 0 && !isLoading && (
        <p className="text-[11px] text-brand-gold dark:text-brand-gold mt-1 flex items-center gap-1">
          <AlertCircle className="w-3 h-3 shrink-0" />
          <span>At least one access profile is required for standard staff accounts.</span>
        </p>
      )}

      {error && (
        <p className="text-[11px] text-red-600 dark:text-red-400 mt-1 flex items-center gap-1">
          <AlertCircle className="w-3 h-3 shrink-0" />
          <span>{error}</span>
        </p>
      )}

      {/* ── FLOATING POPOVER DROPDOWN MENU ─────────────────────────────────── */}
      {isOpen && (
        <div
          id="access-profiles-listbox"
          role="listbox"
          aria-multiselectable="true"
          className="absolute z-50 left-0 right-0 mt-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[380px] animate-in fade-in slide-in-from-top-2"
        >
          {/* Search Header Bar */}
          <div className="p-2.5 bg-slate-50 dark:bg-slate-950/80 border-b border-slate-200 dark:border-slate-800 flex items-center gap-2">
            <div className="relative flex-1">
              <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                ref={searchInputRef}
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search profiles by name or permissions..."
                className="w-full pl-8 pr-7 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 focus:outline-none focus:border-brand-primary"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery("")}
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-0.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>

            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={selectAll}
                className="px-2 py-1 text-[10px] font-semibold text-brand-primary dark:text-brand-primary hover:bg-brand-light dark:hover:bg-brand-navy rounded transition-colors whitespace-nowrap"
              >
                Select All
              </button>
              <span className="text-slate-300 dark:text-slate-700">|</span>
              <button
                type="button"
                onClick={() => clearAll()}
                className="px-2 py-1 text-[10px] font-semibold text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 rounded transition-colors whitespace-nowrap"
              >
                Clear
              </button>
            </div>
          </div>

          {/* Options Scroll List */}
          <div ref={optionsListRef} className="overflow-y-auto p-1.5 space-y-1 flex-1">
            {isLoading ? (
              <div className="p-6 text-center text-xs text-slate-400">
                <span className="inline-block w-4 h-4 border-2 border-brand-primary border-t-transparent rounded-full animate-spin mb-2" />
                <p>Loading access profiles from database...</p>
              </div>
            ) : filteredProfiles.length === 0 ? (
              <div className="p-6 text-center text-xs text-slate-400">
                <Shield className="w-6 h-6 mx-auto mb-1.5 opacity-40 text-brand-primary" />
                <p className="font-semibold">No access profiles found.</p>
                {searchQuery && <p className="text-[10px] mt-0.5">Try searching with a different keyword.</p>}
              </div>
            ) : (
              filteredProfiles.map((prof, index) => {
                const isSelected = selectedProfileIds.includes(prof.id);
                const isFocused = index === focusedIndex;

                return (
                  <div
                    key={prof.id}
                    role="option"
                    aria-selected={isSelected}
                    onClick={() => toggleProfile(prof.id)}
                    className={`group p-2.5 rounded-xl border transition-all flex items-start justify-between gap-3 cursor-pointer ${
                      isSelected
                        ? "bg-brand-light/70 dark:bg-brand-navy/50 border-brand-primary/30 dark:border-brand-navy/80 shadow-2xs"
                        : isFocused
                        ? "bg-slate-100 dark:bg-slate-800 border-slate-300 dark:border-slate-700"
                        : "bg-transparent border-transparent hover:bg-slate-50 dark:hover:bg-slate-800/60"
                    }`}
                  >
                    {/* Checkbox and Profile Info */}
                    <div className="flex items-start gap-2.5 min-w-0 flex-1">
                      <div
                        className={`w-4 h-4 mt-0.5 rounded-md border flex items-center justify-center transition-colors shrink-0 ${
                          isSelected
                            ? "bg-brand-primary border-brand-primary text-white"
                            : "border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 group-hover:border-brand-primary"
                        }`}
                      >
                        {isSelected && <Check className="w-3 h-3 stroke-[3]" />}
                      </div>

                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5">
                          <span className="font-bold text-xs text-slate-900 dark:text-slate-100">
                            {prof.name}
                          </span>
                          {prof.is_system && (
                            <span className="text-[9px] font-semibold px-1.5 py-0.2 rounded bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
                              System
                            </span>
                          )}
                        </div>
                        {prof.description && (
                          <p className="text-[11px] text-slate-500 dark:text-slate-400 line-clamp-1 mt-0.5 leading-tight">
                            {prof.description}
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Permission Count Badge & Details Button */}
                    <div className="flex items-center gap-1.5 shrink-0 self-center">
                      <span className="text-[11px] font-bold text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-md border border-slate-200 dark:border-slate-700 font-mono">
                        {prof.permissions.length} perms
                      </span>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setInspectingProfile(inspectingProfile?.id === prof.id ? null : prof);
                        }}
                        className="p-1 hover:bg-brand-light dark:hover:bg-brand-navy/60 rounded text-slate-400 hover:text-brand-primary dark:hover:text-brand-primary/30 transition-colors"
                        title="View profile permissions details"
                        aria-label={`Inspect ${prof.name} permissions`}
                      >
                        <Info className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Inspect Profile Permissions Details Popover */}
          {inspectingProfile && (
            <div className="p-3 bg-brand-navy/90 text-white border-t border-brand-navy/80 animate-in fade-in slide-in-from-bottom-2">
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-xs font-bold text-brand-primary/30 flex items-center gap-1">
                  <Shield className="w-3 h-3 text-brand-primary" />
                  {inspectingProfile.name} ({inspectingProfile.permissions.length} Permissions)
                </span>
                <button
                  type="button"
                  onClick={() => setInspectingProfile(null)}
                  className="p-0.5 text-brand-primary/30 hover:text-white"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
              <div className="flex flex-wrap gap-1 max-h-24 overflow-y-auto pr-1">
                {inspectingProfile.permissions.map((perm) => (
                  <span
                    key={perm}
                    className="text-[10px] px-1.5 py-0.5 rounded bg-brand-navy text-brand-primary/30 border border-brand-navy font-mono"
                  >
                    {perm}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Popover Footer Summary */}
          <div className="p-2.5 bg-slate-50 dark:bg-slate-950 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between text-xs">
            <div className="text-[11px] text-slate-500">
              <span className="font-bold text-brand-primary dark:text-brand-primary">
                {selectedProfiles.length}
              </span>{" "}
              selected (
              <span className="font-bold text-emerald-600 dark:text-emerald-400">
                {uniqueEffectivePermissions.length}
              </span>{" "}
              effective perms)
            </div>
            <button
              type="button"
              onClick={() => {
                setIsOpen(false);
                setInspectingProfile(null);
              }}
              className="px-3 py-1 bg-brand-primary hover:bg-brand-navy text-white rounded-lg text-xs font-bold transition-colors shadow-xs cursor-pointer"
            >
              Done
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
