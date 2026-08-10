"use client";

import type { SearchFilters } from "@frontend/lib/data/catalog";
import { Badge, Button, Input, Select, Switch, Label } from "@medusajs/ui";
import { useState, useEffect } from "react";

const SORT_OPTIONS: Array<{ value: NonNullable<SearchFilters["sort"]>; label: string }> = [
    { value: "relevance", label: "Relevance" },
    { value: "price_asc", label: "Price: Low to High" },
    { value: "price_desc", label: "Price: High to Low" },
    { value: "rating", label: "Top Rated" },
    { value: "newest", label: "Newest" },
];

/**
 * Product filter sidebar — reusable across catalog, category, and search pages.
 *
 * All filters are controlled by the parent via the `filters` + `onChange` props.
 * Dietary toggles, price range, and sort are supported.
 */
export function ProductFilters({
    filters,
    onChange,
}: {
    filters: SearchFilters;
    onChange: (filters: SearchFilters) => void;
}) {
    const [minPrice, setMinPrice] = useState(filters.min_price?.toString() ?? "");
    const [maxPrice, setMaxPrice] = useState(filters.max_price?.toString() ?? "");

    function toggle(key: keyof SearchFilters, value: boolean) {
        onChange({ ...filters, [key]: value || undefined });
    }

    function applyPrice() {
        onChange({
            ...filters,
            min_price: minPrice ? Number(minPrice) : undefined,
            max_price: maxPrice ? Number(maxPrice) : undefined,
        });
    }

    const dietaryToggles: Array<{ key: keyof SearchFilters; label: string }> = [
        { key: "eggless", label: "Eggless" },
        { key: "sugar_free", label: "Sugar-Free" },
        { key: "gluten_free", label: "Gluten-Free" },
        { key: "vegan", label: "Vegan" },
    ];

    const merchandisingToggles: Array<{ key: keyof SearchFilters; label: string }> = [
        { key: "is_featured", label: "Featured" },
        { key: "is_bestseller", label: "Bestsellers" },
        { key: "is_new_arrival", label: "New Arrivals" },
    ];

    const [mounted, setMounted] = useState(false);
    useEffect(() => setMounted(true), []);

    return (
        <div className="flex flex-col gap-6">
            <div className="flex flex-col gap-2">
                <Label>Sort by</Label>
                {mounted ? (
                    <Select
                        value={filters.sort ?? "relevance"}
                        onValueChange={(value) =>
                            onChange({ ...filters, sort: value as SearchFilters["sort"] })
                        }
                    >
                        <Select.Trigger>
                            <Select.Value />
                        </Select.Trigger>
                        <Select.Content>
                            {SORT_OPTIONS.map((opt) => (
                                <Select.Item key={opt.value} value={opt.value}>
                                    {opt.label}
                                </Select.Item>
                            ))}
                        </Select.Content>
                    </Select>
                ) : (
                    <select
                        className="w-full h-10 px-3 border rounded-md bg-transparent text-sm"
                        value={filters.sort ?? "relevance"}
                        onChange={(e) => onChange({ ...filters, sort: e.target.value as any })}
                    >
                        {SORT_OPTIONS.map((opt) => (
                            <option key={opt.value} value={opt.value}>
                                {opt.label}
                            </option>
                        ))}
                    </select>
                )}
            </div>

            <div className="flex flex-col gap-2">
                <Label>Price Range (₹)</Label>
                <div className="flex gap-2 items-center">
                    <Input
                        type="number"
                        placeholder="Min"
                        value={minPrice}
                        onChange={(e) => setMinPrice(e.target.value)}
                        className="w-full"
                    />
                    <span>—</span>
                    <Input
                        type="number"
                        placeholder="Max"
                        value={maxPrice}
                        onChange={(e) => setMaxPrice(e.target.value)}
                        className="w-full"
                    />
                </div>
                <Button size="small" variant="secondary" onClick={applyPrice}>
                    Apply Price
                </Button>
            </div>

            <div className="flex flex-col gap-3">
                <Label>Dietary</Label>
                {dietaryToggles.map((t) => (
                    <div key={t.key} className="flex items-center justify-between">
                        <span className="text-sm">{t.label}</span>
                        <Switch
                            checked={!!filters[t.key]}
                            onCheckedChange={(v) => toggle(t.key, v)}
                        />
                    </div>
                ))}
            </div>

            <div className="flex flex-col gap-3">
                <Label>Merchandising</Label>
                {merchandisingToggles.map((t) => (
                    <div key={t.key} className="flex items-center justify-between">
                        <span className="text-sm">{t.label}</span>
                        <Switch
                            checked={!!filters[t.key]}
                            onCheckedChange={(v) => toggle(t.key, v)}
                        />
                    </div>
                ))}
            </div>

            <Button
                variant="transparent"
                size="small"
                onClick={() => onChange({})}
            >
                Clear all filters
            </Button>
        </div>
    );
}

/**
 * Active filter chips — shows applied filters with remove buttons.
 */
export function ActiveFilterChips({
    filters,
    onChange,
}: {
    filters: SearchFilters;
    onChange: (filters: SearchFilters) => void;
}) {
    const chips: Array<{ key: keyof SearchFilters; label: string }> = [];
    if (filters.eggless) chips.push({ key: "eggless", label: "Eggless" });
    if (filters.sugar_free) chips.push({ key: "sugar_free", label: "Sugar-Free" });
    if (filters.gluten_free) chips.push({ key: "gluten_free", label: "Gluten-Free" });
    if (filters.vegan) chips.push({ key: "vegan", label: "Vegan" });
    if (filters.is_featured) chips.push({ key: "is_featured", label: "Featured" });
    if (filters.is_bestseller) chips.push({ key: "is_bestseller", label: "Bestseller" });
    if (filters.is_new_arrival) chips.push({ key: "is_new_arrival", label: "New" });
    if (filters.min_price !== undefined)
        chips.push({ key: "min_price", label: `Min ₹${filters.min_price}` });
    if (filters.max_price !== undefined)
        chips.push({ key: "max_price", label: `Max ₹${filters.max_price}` });

    if (chips.length === 0) return null;

    return (
        <div className="flex flex-wrap gap-2">
            {chips.map((c) => (
                <Badge
                    key={c.key}
                    color="purple"
                    className="cursor-pointer"
                    onClick={() => onChange({ ...filters, [c.key]: undefined })}
                >
                    {c.label} ✕
                </Badge>
            ))}
        </div>
    );
}
