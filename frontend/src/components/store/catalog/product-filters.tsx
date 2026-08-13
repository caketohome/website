"use client";

import type { SearchFilters, CatalogFilterOptions } from "@frontend/lib/data/catalog";
import { Badge, Button, Input, Switch, Label } from "@medusajs/ui";
import { useState, useEffect } from "react";
import { Filter, X, Check, SlidersHorizontal, ArrowUpDown } from "lucide-react";

const SORT_OPTIONS: Array<{ value: NonNullable<SearchFilters["sort"]>; label: string }> = [
  { value: "relevance", label: "Relevance" },
  { value: "price_asc", label: "Price: Low to High" },
  { value: "price_desc", label: "Price: High to Low" },
  { value: "rating", label: "Top Rated" },
  { value: "newest", label: "Newest Arrivals" },
  { value: "bestseller", label: "Best Selling" },
];

const PRICE_PRESETS = [
  { label: "All Prices", min: undefined, max: undefined },
  { label: "Under ₹500", min: undefined, max: 499 },
  { label: "₹500 – ₹999", min: 500, max: 999 },
  { label: "₹1,000 – ₹1,499", min: 1000, max: 1499 },
  { label: "₹1,500 – ₹1,999", min: 1500, max: 1999 },
  { label: "₹2,000+", min: 2000, max: undefined },
];

export function ProductFilters({
  filters,
  onChange,
  options,
}: {
  filters: SearchFilters;
  onChange: (filters: SearchFilters) => void;
  options?: CatalogFilterOptions;
}) {
  const [minPrice, setMinPrice] = useState(filters.min_price?.toString() ?? "");
  const [maxPrice, setMaxPrice] = useState(filters.max_price?.toString() ?? "");

  useEffect(() => {
    setMinPrice(filters.min_price?.toString() ?? "");
    setMaxPrice(filters.max_price?.toString() ?? "");
  }, [filters.min_price, filters.max_price]);

  function toggleDietary(key: keyof SearchFilters, value: boolean) {
    onChange({ ...filters, [key]: value || undefined });
  }

  function applyCustomPrice() {
    onChange({
      ...filters,
      min_price: minPrice ? Number(minPrice) : undefined,
      max_price: maxPrice ? Number(maxPrice) : undefined,
    });
  }

  const categories = options?.categories || [
    "All Cakes",
    "Chocolate Cakes",
    "Red Velvet Cakes",
    "Fruit Cakes",
    "Black Forest Cakes",
    "Butterscotch Cakes",
    "Cheesecakes",
  ];

  const flavours = options?.flavours || [
    "Chocolate",
    "Red Velvet",
    "Mango",
    "Black Forest",
    "Butterscotch",
    "Vanilla",
    "Fruit",
  ];

  const weights = options?.weights || ["0.5 kg", "1 kg", "1.5 kg", "2 kg", "2.5 kg", "3 kg+"];

  return (
    <div className="flex flex-col gap-6 text-xs text-slate-800 dark:text-slate-200">
      {/* Sort By */}
      <div className="flex flex-col gap-2">
        <Label className="font-bold text-xs flex items-center gap-1.5 text-slate-900 dark:text-white">
          <ArrowUpDown className="w-3.5 h-3.5 text-rose-600" /> Sort By
        </Label>
        <select
          className="w-full h-9 px-3 border border-slate-200 dark:border-slate-800 rounded-xl bg-white dark:bg-slate-900 text-xs font-medium text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-rose-500/20"
          value={filters.sort ?? "relevance"}
          onChange={(e) => onChange({ ...filters, sort: e.target.value as any })}
        >
          {SORT_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </div>

      {/* Category Filter */}
      <div className="flex flex-col gap-2">
        <Label className="font-bold text-xs text-slate-900 dark:text-white">Cake Category</Label>
        <select
          className="w-full h-9 px-3 border border-slate-200 dark:border-slate-800 rounded-xl bg-white dark:bg-slate-900 text-xs font-medium text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-rose-500/20"
          value={filters.category ?? "all"}
          onChange={(e) => onChange({ ...filters, category: e.target.value === "all" ? undefined : e.target.value })}
        >
          <option value="all">All Categories</option>
          {categories.map((cat) => (
            <option key={cat} value={cat}>
              {cat}
            </option>
          ))}
        </select>
      </div>

      {/* Flavour Filter */}
      <div className="flex flex-col gap-2">
        <Label className="font-bold text-xs text-slate-900 dark:text-white">Flavour</Label>
        <div className="flex flex-wrap gap-1.5">
          <button
            type="button"
            onClick={() => onChange({ ...filters, flavour: undefined })}
            className={`px-2.5 py-1 rounded-lg border text-[11px] font-semibold transition ${
              !filters.flavour
                ? "bg-rose-600 text-white border-rose-600 shadow-sm"
                : "border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 hover:bg-slate-100"
            }`}
          >
            All
          </button>
          {flavours.map((f) => {
            const isSelected = filters.flavour?.toLowerCase() === f.toLowerCase();
            return (
              <button
                key={f}
                type="button"
                onClick={() => onChange({ ...filters, flavour: isSelected ? undefined : f })}
                className={`px-2.5 py-1 rounded-lg border text-[11px] font-semibold transition ${
                  isSelected
                    ? "bg-rose-600 text-white border-rose-600 shadow-sm"
                    : "border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 hover:bg-slate-100"
                }`}
              >
                {f}
              </button>
            );
          })}
        </div>
      </div>

      {/* Cake Weight Filter */}
      <div className="flex flex-col gap-2">
        <Label className="font-bold text-xs text-slate-900 dark:text-white">Cake Weight</Label>
        <div className="flex flex-wrap gap-1.5">
          <button
            type="button"
            onClick={() => onChange({ ...filters, weight: undefined })}
            className={`px-2.5 py-1 rounded-lg border text-[11px] font-semibold transition ${
              !filters.weight
                ? "bg-rose-600 text-white border-rose-600 shadow-sm"
                : "border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 hover:bg-slate-100"
            }`}
          >
            All
          </button>
          {weights.map((w) => {
            const isSelected = filters.weight?.toLowerCase() === w.toLowerCase();
            return (
              <button
                key={w}
                type="button"
                onClick={() => onChange({ ...filters, weight: isSelected ? undefined : w })}
                className={`px-2.5 py-1 rounded-lg border text-[11px] font-semibold transition ${
                  isSelected
                    ? "bg-rose-600 text-white border-rose-600 shadow-sm"
                    : "border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 hover:bg-slate-100"
                }`}
              >
                {w}
              </button>
            );
          })}
        </div>
      </div>

      {/* Price Range Filter */}
      <div className="flex flex-col gap-2.5">
        <Label className="font-bold text-xs text-slate-900 dark:text-white">Price Range</Label>
        <div className="flex flex-col gap-1.5">
          {PRICE_PRESETS.map((p) => {
            const isSelected = filters.min_price === p.min && filters.max_price === p.max;
            return (
              <button
                key={p.label}
                type="button"
                onClick={() => onChange({ ...filters, min_price: p.min, max_price: p.max })}
                className={`text-left px-2.5 py-1.5 rounded-lg text-[11px] font-semibold transition flex items-center justify-between ${
                  isSelected
                    ? "bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 font-bold border border-rose-200 dark:border-rose-800"
                    : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
                }`}
              >
                <span>{p.label}</span>
                {isSelected && <Check className="w-3.5 h-3.5 text-rose-600" />}
              </button>
            );
          })}
        </div>

        {/* Custom Price Range Inputs */}
        <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex flex-col gap-2">
          <span className="text-[10px] text-slate-500 font-medium">Custom Price (₹)</span>
          <div className="flex gap-2 items-center">
            <Input
              type="number"
              placeholder="Min"
              value={minPrice}
              onChange={(e) => setMinPrice(e.target.value)}
              className="h-8 text-xs"
            />
            <span className="text-slate-400">—</span>
            <Input
              type="number"
              placeholder="Max"
              value={maxPrice}
              onChange={(e) => setMaxPrice(e.target.value)}
              className="h-8 text-xs"
            />
          </div>
          <Button size="small" variant="secondary" onClick={applyCustomPrice} className="h-7 text-xs font-bold mt-0.5">
            Apply Range
          </Button>
        </div>
      </div>

      {/* Dietary & Preference Switches */}
      <div className="flex flex-col gap-3 pt-2 border-t border-slate-100 dark:border-slate-800">
        <Label className="font-bold text-xs text-slate-900 dark:text-white">Dietary & Preferences</Label>
        {[
          { key: "eggless" as const, label: "🌱 Eggless 100%" },
          { key: "sugar_free" as const, label: "🍯 Sugar-Free" },
          { key: "gluten_free" as const, label: "🌾 Gluten-Free" },
          { key: "vegan" as const, label: "🥑 Vegan" },
        ].map((t) => (
          <div key={t.key} className="flex items-center justify-between text-xs">
            <span className="font-medium text-slate-700 dark:text-slate-300">{t.label}</span>
            <Switch
              checked={Boolean(filters[t.key])}
              onCheckedChange={(v) => toggleDietary(t.key, v)}
            />
          </div>
        ))}
      </div>

      {/* Clear All Button */}
      <Button
        variant="transparent"
        size="small"
        onClick={() => onChange({})}
        className="text-xs font-bold text-rose-600 hover:text-rose-700 mt-2"
      >
        Clear All Filters
      </Button>
    </div>
  );
}

/**
 * Active filter chips bar — renders interactive chips above product grid.
 */
export function ActiveFilterChips({
  filters,
  onChange,
}: {
  filters: SearchFilters;
  onChange: (filters: SearchFilters) => void;
}) {
  const chips: Array<{ key: keyof SearchFilters; label: string }> = [];

  if (filters.q) chips.push({ key: "q", label: `Search: "${filters.q}"` });
  if (filters.category) chips.push({ key: "category", label: `Category: ${filters.category}` });
  if (filters.flavour) chips.push({ key: "flavour", label: `Flavour: ${filters.flavour}` });
  if (filters.weight) chips.push({ key: "weight", label: `Weight: ${filters.weight}` });
  if (filters.eggless) chips.push({ key: "eggless", label: "Eggless" });
  if (filters.sugar_free) chips.push({ key: "sugar_free", label: "Sugar-Free" });
  if (filters.gluten_free) chips.push({ key: "gluten_free", label: "Gluten-Free" });
  if (filters.vegan) chips.push({ key: "vegan", label: "Vegan" });
  if (filters.min_price !== undefined || filters.max_price !== undefined) {
    const minStr = filters.min_price !== undefined ? `₹${filters.min_price}` : "₹0";
    const maxStr = filters.max_price !== undefined ? `₹${filters.max_price}` : "Any";
    chips.push({ key: "min_price", label: `Price: ${minStr} – ${maxStr}` });
  }

  if (chips.length === 0) return null;

  const removeChip = (key: keyof SearchFilters) => {
    if (key === "min_price" || key === "max_price") {
      onChange({ ...filters, min_price: undefined, max_price: undefined });
    } else {
      onChange({ ...filters, [key]: undefined });
    }
  };

  return (
    <div className="flex flex-wrap items-center gap-2 py-2">
      <span className="text-xs font-semibold text-slate-500">Active Filters:</span>
      {chips.map((c) => (
        <button
          key={c.key}
          onClick={() => removeChip(c.key)}
          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300 text-xs font-medium hover:bg-rose-100 transition"
        >
          <span>{c.label}</span>
          <X className="w-3 h-3 text-rose-500" />
        </button>
      ))}
      <button
        onClick={() => onChange({})}
        className="text-xs font-bold text-slate-500 hover:text-rose-600 underline ml-2"
      >
        Clear All
      </button>
    </div>
  );
}

/**
 * Mobile Filter Drawer modal.
 */
export function MobileFilterDrawer({
  isOpen,
  onClose,
  filters,
  onChange,
  options,
  activeCount,
}: {
  isOpen: boolean;
  onClose: () => void;
  filters: SearchFilters;
  onChange: (filters: SearchFilters) => void;
  options?: CatalogFilterOptions;
  activeCount: number;
}) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/60 backdrop-blur-sm animate-fadeIn">
      <div className="w-full max-w-sm bg-white dark:bg-slate-900 h-full flex flex-col shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50 dark:bg-slate-850">
          <div className="flex items-center gap-2">
            <SlidersHorizontal className="w-4 h-4 text-rose-600" />
            <span className="font-bold text-sm text-slate-900 dark:text-white">Filter Cakes</span>
            {activeCount > 0 && (
              <Badge color="red" className="text-xs font-bold px-2 py-0.5 rounded-full">
                {activeCount}
              </Badge>
            )}
          </div>
          <button onClick={onClose} className="p-1 rounded-lg text-slate-400 hover:text-slate-600">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 overflow-y-auto flex-1">
          <ProductFilters filters={filters} onChange={onChange} options={options} />
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-850 flex items-center gap-3">
          <Button variant="secondary" onClick={() => onChange({})} className="flex-1 text-xs font-bold">
            Clear All
          </Button>
          <Button onClick={onClose} className="flex-1 bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold">
            Apply Filters ({activeCount})
          </Button>
        </div>
      </div>
    </div>
  );
}
