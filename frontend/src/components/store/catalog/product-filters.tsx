"use client";

import type { SearchFilters, CatalogFilterOptions } from "@frontend/lib/data/catalog";
import { Button, Input, Label } from "@medusajs/ui";
import { useState, useEffect } from "react";
import { X, Check, SlidersHorizontal, ArrowUpDown } from "lucide-react";

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

function normalizeWeightLabel(w: any): string {
  if (w == null) return "";
  if (typeof w === "object") {
    return String(w.weight_name || w.name || w.label || w.value || w.title || "").trim();
  }
  const str = String(w).trim();
  if (!str) return "";
  const num = Number(str);
  if (!isNaN(num)) {
    return num < 50 ? `${num} kg` : `${num} g`;
  }
  return str;
}

function normalizeFlavourLabel(f: any): string {
  if (f == null) return "";
  if (typeof f === "object") {
    return String(f.name || f.flavour || f.flavor || f.label || f.value || f.title || "").trim();
  }
  return String(f).trim();
}

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

  function applyCustomPrice() {
    onChange({
      ...filters,
      min_price: minPrice ? Number(minPrice) : undefined,
      max_price: maxPrice ? Number(maxPrice) : undefined,
    });
  }

  const categoriesList = (options?.categories || []).map((c: any) => {
    if (typeof c === "string") {
      return { id: c, name: c, slug: c.toLowerCase().replace(/\s+/g, "-"), count: undefined };
    }
    return {
      id: c?.id || c?.slug || "",
      name: c?.name || c?.title || c?.slug || "",
      slug: c?.slug || c?.id || "",
      count: c?.product_count,
    };
  }).filter((c) => Boolean(c.name && c.slug));

  const finalCategories = categoriesList.length > 0 ? categoriesList : [
    { id: "cat_chocolate", name: "Chocolate Cakes", slug: "chocolate-cakes", count: 2 },
    { id: "cat_red_velvet", name: "Red Velvet Cakes", slug: "red-velvet-cakes", count: 1 },
    { id: "cat_fruit_mousse", name: "Fruit & Mousse Cakes", slug: "fruit-mousse-cakes", count: 1 },
    { id: "cat_black_forest", name: "Black Forest Cakes", slug: "black-forest-cakes", count: 1 },
    { id: "cat_butterscotch", name: "Butterscotch & Caramel Cakes", slug: "butterscotch-caramel-cakes", count: 1 },
    { id: "cat_cheesecakes", name: "Cheesecakes & Artisanal", slug: "cheesecakes", count: 1 },
    { id: "cat_bestsellers", name: "Best Sellers", slug: "bestsellers", count: 3 },
  ];

  const rawFlavours = options?.flavours && options.flavours.length > 0
    ? options.flavours
    : [
        "Chocolate",
        "Red Velvet",
        "Mango",
        "Black Forest",
        "Butterscotch",
        "Vanilla",
        "Fruit",
      ];

  const flavoursList = Array.from(
    new Set(rawFlavours.map(normalizeFlavourLabel).filter(Boolean))
  );
  const flavours = flavoursList.length > 0 ? flavoursList : [
    "Chocolate",
    "Red Velvet",
    "Mango",
    "Black Forest",
    "Butterscotch",
    "Vanilla",
    "Fruit",
  ];

  const rawWeights = options?.weights && options.weights.length > 0
    ? options.weights
    : ["0.5 kg", "1 kg", "1.5 kg", "2 kg", "2.5 kg", "3 kg+"];

  const weightsList = Array.from(
    new Set(rawWeights.map(normalizeWeightLabel).filter(Boolean))
  );
  const weights = weightsList.length > 0 ? weightsList : ["0.5 kg", "1 kg", "1.5 kg", "2 kg", "2.5 kg", "3 kg+"];

  return (
    <div className="flex flex-col gap-6 text-xs text-slate-800 dark:text-slate-200 font-sans">
      {/* Sort By */}
      <div className="flex flex-col gap-2">
        <Label className="font-bold text-xs flex items-center gap-1.5 text-slate-900 dark:text-white">
          <ArrowUpDown className="w-3.5 h-3.5 text-[#1D2F5D]" /> Sort By
        </Label>
        <select
          data-testid="sort-select"
          className="w-full h-9 px-3 border border-slate-200 dark:border-slate-800 rounded-xl bg-white dark:bg-slate-900 text-xs font-medium text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-[#D4AF37]/50/20 cursor-pointer"
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

      {/* Cake Category */}
      <div className="flex flex-col gap-2">
        <Label className="font-bold text-xs text-slate-900 dark:text-white">Cake Category</Label>
        <select
          data-testid="category-select"
          className="w-full h-9 px-3 border border-slate-200 dark:border-slate-800 rounded-xl bg-white dark:bg-slate-900 text-xs font-medium text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-[#D4AF37]/50/20 cursor-pointer"
          value={filters.category ?? "all"}
          onChange={(e) => onChange({ ...filters, category: e.target.value === "all" ? undefined : e.target.value })}
        >
          <option value="all">All Categories</option>
          {finalCategories.map((cat) => (
            <option key={cat.id || cat.slug} value={cat.slug}>
              {cat.name}{typeof cat.count === "number" && cat.count > 0 ? ` (${cat.count})` : ""}
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
                ? "bg-[#1D2F5D] text-white border-[#1D2F5D] shadow-sm"
                : "border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 hover:bg-slate-100"
            }`}
          >
            All
          </button>
          {flavours.map((f) => {
            const fStr = normalizeFlavourLabel(f);
            const currentFlavour = String(filters.flavour ?? "").toLowerCase().trim();
            const isSelected = !!currentFlavour && currentFlavour === fStr.toLowerCase().trim();
            return (
              <button
                key={fStr}
                type="button"
                onClick={() => onChange({ ...filters, flavour: isSelected ? undefined : fStr })}
                className={`px-2.5 py-1 rounded-lg border text-[11px] font-semibold transition ${
                  isSelected
                    ? "bg-[#1D2F5D] text-white border-[#1D2F5D] shadow-sm"
                    : "border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 hover:bg-slate-100"
                }`}
              >
                {fStr}
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
                ? "bg-[#1D2F5D] text-white border-[#1D2F5D] shadow-sm"
                : "border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 hover:bg-slate-100"
            }`}
          >
            All
          </button>
          {weights.map((w) => {
            const wStr = normalizeWeightLabel(w);
            const currentWeight = String(filters.weight ?? "").toLowerCase().trim();
            const isSelected = !!currentWeight && currentWeight === wStr.toLowerCase().trim();
            return (
              <button
                key={wStr}
                type="button"
                onClick={() => onChange({ ...filters, weight: isSelected ? undefined : wStr })}
                className={`px-2.5 py-1 rounded-lg border text-[11px] font-semibold transition ${
                  isSelected
                    ? "bg-[#1D2F5D] text-white border-[#1D2F5D] shadow-sm"
                    : "border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 hover:bg-slate-100"
                }`}
              >
                {wStr}
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
                    ? "bg-brand-gold-soft dark:bg-[#0c1326]/40 text-[#152347] dark:text-[#D4AF37]/80 font-bold border border-[#D4AF37]/30 dark:border-[#D4AF37]/20"
                    : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
                }`}
              >
                <span>{p.label}</span>
                {isSelected && <Check className="w-3.5 h-3.5 text-[#1D2F5D]" />}
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
              suppressHydrationWarning
              className="h-8 text-xs"
            />
            <span className="text-slate-400">—</span>
            <Input
              type="number"
              placeholder="Max"
              value={maxPrice}
              onChange={(e) => setMaxPrice(e.target.value)}
              suppressHydrationWarning
              className="h-8 text-xs"
            />
          </div>
          <Button size="small" variant="secondary" onClick={applyCustomPrice} className="h-7 text-xs font-bold mt-0.5">
            Apply Range
          </Button>
        </div>
      </div>

      {/* Clear All Button */}
      <Button
        variant="transparent"
        size="small"
        onClick={() => onChange({})}
        className="text-xs font-bold text-[#1D2F5D] hover:text-[#152347] mt-2"
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
  if (filters.category && filters.category !== "all") {
    const formattedCat = String(filters.category)
      .replace(/^(cat_|pcat_)/, "")
      .split("-")
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
      .join(" ");
    chips.push({ key: "category", label: `Category: ${formattedCat}` });
  }
  if (filters.flavour && filters.flavour !== "all") chips.push({ key: "flavour", label: `Flavour: ${normalizeFlavourLabel(filters.flavour)}` });
  if (filters.weight && filters.weight !== "all") chips.push({ key: "weight", label: `Weight: ${normalizeWeightLabel(filters.weight)}` });
  if (filters.min_price !== undefined || filters.max_price !== undefined) {
    if (filters.min_price !== undefined && filters.max_price !== undefined) {
      chips.push({ key: "min_price", label: `Price: ₹${filters.min_price} – ₹${filters.max_price}` });
    } else if (filters.min_price !== undefined) {
      chips.push({ key: "min_price", label: `Price: ₹${filters.min_price}+` });
    } else if (filters.max_price !== undefined) {
      chips.push({ key: "max_price", label: `Price: Under ₹${filters.max_price}` });
    }
  }

  if (chips.length === 0) return null;

  function removeChip(key: keyof SearchFilters) {
    const updated = { ...filters };
    if (key === "min_price" || key === "max_price") {
      delete updated.min_price;
      delete updated.max_price;
    } else {
      delete updated[key];
    }
    onChange(updated);
  }

  return (
    <div className="flex flex-wrap items-center gap-2 py-2">
      <span className="text-xs font-semibold text-slate-500">Active Filters:</span>
      {chips.map((c) => (
        <button
          key={c.key}
          type="button"
          onClick={() => removeChip(c.key)}
          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-brand-gold-soft dark:bg-[#0c1326]/50 border border-[#D4AF37]/30 dark:border-[#D4AF37]/20 text-[#152347] dark:text-[#D4AF37]/80 text-xs font-medium hover:bg-brand-gold-soft transition"
        >
          <span>{c.label}</span>
          <X className="w-3 h-3 text-[#D4AF37]" />
        </button>
      ))}
      <button
        type="button"
        onClick={() => onChange({})}
        className="text-xs font-bold text-slate-500 hover:text-[#1D2F5D] underline ml-2"
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
    <div data-testid="mobile-filter-drawer" className="fixed inset-0 z-50 flex justify-end bg-black/60 backdrop-blur-sm animate-fadeIn">
      <div className="w-full max-w-sm bg-white dark:bg-slate-900 h-full flex flex-col shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50 dark:bg-slate-850">
          <div className="flex items-center gap-2">
            <SlidersHorizontal className="w-4 h-4 text-[#1D2F5D]" />
            <span className="font-bold text-sm text-slate-900 dark:text-white">Filter Cakes</span>
            {activeCount > 0 && (
              <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-[#1D2F5D] text-white">
                {activeCount}
              </span>
            )}
          </div>
          <button type="button" onClick={onClose} className="p-1 rounded-lg text-slate-400 hover:text-slate-600">
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
          <Button onClick={onClose} className="flex-1 bg-[#1D2F5D] hover:bg-[#152347] text-white text-xs font-bold">
            Apply Filters {activeCount > 0 ? `(${activeCount})` : ""}
          </Button>
        </div>
      </div>
    </div>
  );
}
