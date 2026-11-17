"use client";

import React, { useState } from "react";
import { Heading, Text, Input, Label, Textarea, Select, Button } from "@medusajs/ui";
import {
  Tag, Database, Sliders, CheckSquare, Sparkles, LayoutGrid,
  Eye, ShoppingCart, Heart, DollarSign
} from "lucide-react";

interface ProductGridEditorProps {
  config: Record<string, any>;
  allProducts: any[];
  allCategories: any[];
  allOccasions: any[];
  isCarousel?: boolean;
  onChange: (key: string, val: any) => void;
}

function Field({ label, hint, children }: { label: string | React.ReactNode; hint?: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label className="text-xs font-semibold text-ui-fg-base">{label}</Label>
      {children}
      {hint && <p className="text-[11px] text-ui-fg-muted">{hint}</p>}
    </div>
  );
}

function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors focus:outline-none ${checked ? "bg-rose-500" : "bg-ui-bg-component border border-ui-border-base"}`}
      aria-label={label}
    >
      <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform shadow ${checked ? "translate-x-4" : "translate-x-0.5"}`} />
    </button>
  );
}

export function ProductGridEditor({
  config,
  allProducts = [],
  allCategories = [],
  allOccasions = [],
  isCarousel = false,
  onChange,
}: ProductGridEditorProps) {
  const [productSearch, setProductSearch] = useState("");
  const dataSource = config.data_source || (config.mode === "manual" ? "manual" : "pim_query");
  const selectedProductIds: string[] = Array.isArray(config.product_ids) ? config.product_ids : [];

  // Extract unique flavours and weights from products for filter options
  const flavours = Array.from(new Set(allProducts.map(p => p.flavour || p.metadata?.flavour).filter(Boolean)));
  const weights = ["500g", "1 kg", "1.5 kg", "2 kg"];

  return (
    <div className="flex flex-col gap-4">
      {/* 1. Headings */}
      <div className="p-3.5 bg-ui-bg-subtle rounded-2xl border border-ui-border-base flex flex-col gap-3">
        <Text className="text-xs font-bold uppercase tracking-wider text-rose-600 flex items-center gap-1.5">
          <Tag className="w-3.5 h-3.5" /> Section Title & Headings
        </Text>

        <Field label="Section Heading">
          <Input
            value={config.heading || ""}
            onChange={(e) => onChange("heading", e.target.value)}
            placeholder="Bestselling Cakes"
          />
        </Field>

        <Field label="Section Subheading">
          <Textarea
            value={config.subheading || ""}
            onChange={(e) => onChange("subheading", e.target.value)}
            placeholder="Our most loved creations, freshly baked upon order"
            rows={2}
          />
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field label="View All Button Text">
            <Input
              value={config.view_all_text || ""}
              onChange={(e) => onChange("view_all_text", e.target.value)}
              placeholder="View All Cakes →"
            />
          </Field>
          <Field label="View All URL">
            <Input
              value={config.view_all_url || ""}
              onChange={(e) => onChange("view_all_url", e.target.value)}
              placeholder="/products"
            />
          </Field>
        </div>
      </div>

      {/* 2. PIM Data Source Configuration */}
      <div className="p-3.5 bg-ui-bg-subtle rounded-2xl border border-ui-border-base flex flex-col gap-3">
        <Text className="text-xs font-bold uppercase tracking-wider text-brand-primary flex items-center gap-1.5">
          <Database className="w-3.5 h-3.5" /> Product Data Source & Query
        </Text>

        <Field label="Product Source">
          <Select
            value={dataSource}
            onValueChange={(v) => {
              onChange("data_source", v);
              if (v === "manual") onChange("mode", "manual");
              else if (config.mode === "manual") onChange("mode", "best_sellers");
            }}
          >
            <Select.Trigger><Select.Value /></Select.Trigger>
            <Select.Content>
              <Select.Item value="pim_query">Live PIM Query (Dynamic Filters)</Select.Item>
              <Select.Item value="manual">Manual Specific Cake Selection</Select.Item>
            </Select.Content>
          </Select>
        </Field>

        {dataSource === "pim_query" && (
          <>
            <div className="p-2.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-[11px] text-emerald-800 dark:text-emerald-300 flex items-center gap-2">
              <Sparkles className="w-4 h-4 shrink-0 text-emerald-600" />
              <span>This section is populated from live PIM data.</span>
            </div>

            <Field label="Collection Preset">
              <Select value={config.mode || "best_sellers"} onValueChange={(v) => onChange("mode", v)}>
                <Select.Trigger><Select.Value /></Select.Trigger>
                <Select.Content>
                  <Select.Item value="best_sellers">🔥 Bestselling Cakes</Select.Item>
                  <Select.Item value="new_arrivals">✨ New Arrivals</Select.Item>
                  <Select.Item value="featured">⭐ Featured Selections</Select.Item>
                  <Select.Item value="trending">📈 Trending Celebrations</Select.Item>
                  <Select.Item value="all">🎂 All Active Cakes</Select.Item>
                  <Select.Item value="category">📁 Filter by Specific Category</Select.Item>
                  <Select.Item value="occasion">🎁 Filter by Specific Occasion</Select.Item>
                </Select.Content>
              </Select>
            </Field>

            <div className="grid grid-cols-2 gap-3">
              <Field label="Category Filter">
                <Select value={config.category_filter || "all"} onValueChange={(v) => onChange("category_filter", v === "all" ? "" : v)}>
                  <Select.Trigger><Select.Value /></Select.Trigger>
                  <Select.Content>
                    <Select.Item value="all">All Categories</Select.Item>
                    {allCategories.map(cat => (
                      <Select.Item key={cat.id || cat.slug} value={cat.slug || cat.id}>
                        {cat.name}
                      </Select.Item>
                    ))}
                  </Select.Content>
                </Select>
              </Field>

              <Field label="Occasion Filter">
                <Select value={config.occasion_filter || "all"} onValueChange={(v) => onChange("occasion_filter", v === "all" ? "" : v)}>
                  <Select.Trigger><Select.Value /></Select.Trigger>
                  <Select.Content>
                    <Select.Item value="all">All Occasions</Select.Item>
                    {allOccasions.map(occ => (
                      <Select.Item key={occ.id || occ.slug} value={occ.slug || occ.id}>
                        {occ.name}
                      </Select.Item>
                    ))}
                  </Select.Content>
                </Select>
              </Field>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <Field label="Flavour Filter">
                <Select value={config.flavor_filter || "all"} onValueChange={(v) => onChange("flavor_filter", v === "all" ? "" : v)}>
                  <Select.Trigger><Select.Value /></Select.Trigger>
                  <Select.Content>
                    <Select.Item value="all">All Flavours</Select.Item>
                    {flavours.map(fl => (
                      <Select.Item key={String(fl)} value={String(fl)}>
                        {String(fl)}
                      </Select.Item>
                    ))}
                  </Select.Content>
                </Select>
              </Field>

              <Field label="Weight Filter">
                <Select value={config.weight_filter || "all"} onValueChange={(v) => onChange("weight_filter", v === "all" ? "" : v)}>
                  <Select.Trigger><Select.Value /></Select.Trigger>
                  <Select.Content>
                    <Select.Item value="all">All Weights</Select.Item>
                    {weights.map(wt => (
                      <Select.Item key={wt} value={wt}>
                        {wt}
                      </Select.Item>
                    ))}
                  </Select.Content>
                </Select>
              </Field>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <Field label="Sort Order">
                <Select value={config.sort || "best_selling"} onValueChange={(v) => onChange("sort", v)}>
                  <Select.Trigger><Select.Value /></Select.Trigger>
                  <Select.Content>
                    <Select.Item value="best_selling">Best Selling</Select.Item>
                    <Select.Item value="newest">Newest First</Select.Item>
                    <Select.Item value="price_low_high">Price: Low to High</Select.Item>
                    <Select.Item value="price_high_low">Price: High to Low</Select.Item>
                    <Select.Item value="rating">Highest Rated</Select.Item>
                  </Select.Content>
                </Select>
              </Field>

              <Field label="Result Limit">
                <Select value={String(config.limit || 8)} onValueChange={(v) => onChange("limit", parseInt(v) || 8)}>
                  <Select.Trigger><Select.Value /></Select.Trigger>
                  <Select.Content>
                    <Select.Item value="4">4 Cakes</Select.Item>
                    <Select.Item value="8">8 Cakes (Standard)</Select.Item>
                    <Select.Item value="12">12 Cakes</Select.Item>
                    <Select.Item value="16">16 Cakes</Select.Item>
                    <Select.Item value="24">24 Cakes</Select.Item>
                    <Select.Item value="48">48 Cakes</Select.Item>
                  </Select.Content>
                </Select>
              </Field>
            </div>
          </>
        )}

        {/* Manual Product Selection */}
        {dataSource === "manual" && (
          <div className="flex flex-col gap-2 p-3 bg-ui-bg-base rounded-xl border border-ui-border-base">
            <div className="flex items-center justify-between">
              <Text className="text-xs font-bold text-ui-fg-base">
                Selected Products ({selectedProductIds.length})
              </Text>
              {selectedProductIds.length > 0 && (
                <button
                  type="button"
                  onClick={() => onChange("product_ids", [])}
                  className="text-[10px] text-red-500 hover:underline"
                >
                  Clear All
                </button>
              )}
            </div>

            <Input
              value={productSearch}
              onChange={(e) => setProductSearch(e.target.value)}
              placeholder="Search products by title..."
              size="small"
            />

            <div className="max-h-48 overflow-y-auto flex flex-col gap-1 border border-ui-border-base rounded-xl p-1 bg-ui-bg-base">
              {allProducts.filter(p => !productSearch || p.title?.toLowerCase().includes(productSearch.toLowerCase())).slice(0, 30).map(p => {
                const pid = p.id || p.product_id;
                const isSel = selectedProductIds.includes(pid);
                return (
                  <div
                    key={pid}
                    onClick={() => {
                      const next = isSel ? selectedProductIds.filter(id => id !== pid) : [...selectedProductIds, pid];
                      onChange("product_ids", next);
                    }}
                    className={`p-2 rounded-lg cursor-pointer text-xs flex items-center justify-between transition-all ${isSel ? "bg-rose-500 text-white font-bold" : "hover:bg-ui-bg-subtle"}`}
                  >
                    <span className="truncate">{p.title}</span>
                    <span className="shrink-0 ml-2">₹{p.price || 0}</span>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* 3. Card Display Elements Toggles */}
      <div className="p-3.5 bg-ui-bg-subtle rounded-2xl border border-ui-border-base flex flex-col gap-3">
        <Text className="text-xs font-bold uppercase tracking-wider text-ui-fg-base flex items-center gap-1.5">
          <Eye className="w-3.5 h-3.5" /> Product Card Display Options
        </Text>

        <div className="grid grid-cols-2 gap-x-4 gap-y-2.5 text-xs">
          <div className="flex items-center justify-between">
            <span>Show Image</span>
            <Toggle checked={config.show_image !== false} onChange={(v) => onChange("show_image", v)} label="Show Image" />
          </div>
          <div className="flex items-center justify-between">
            <span>Show Dietary Badge</span>
            <Toggle checked={config.show_badge !== false} onChange={(v) => onChange("show_badge", v)} label="Show Badge" />
          </div>
          <div className="flex items-center justify-between">
            <span>Show Star Rating</span>
            <Toggle checked={config.show_rating !== false} onChange={(v) => onChange("show_rating", v)} label="Show Rating" />
          </div>
          <div className="flex items-center justify-between">
            <span>Show Review Count</span>
            <Toggle checked={config.show_review_count !== false} onChange={(v) => onChange("show_review_count", v)} label="Show Review Count" />
          </div>
          <div className="flex items-center justify-between">
            <span>Show Price</span>
            <Toggle checked={config.show_price !== false} onChange={(v) => onChange("show_price", v)} label="Show Price" />
          </div>
          <div className="flex items-center justify-between">
            <span>Show Compare-At Price</span>
            <Toggle checked={config.show_compare_price !== false} onChange={(v) => onChange("show_compare_price", v)} label="Show Compare Price" />
          </div>
          <div className="flex items-center justify-between">
            <span>Show Weight Tag</span>
            <Toggle checked={config.show_weight !== false} onChange={(v) => onChange("show_weight", v)} label="Show Weight" />
          </div>
          <div className="flex items-center justify-between">
            <span>Show Flavour Tag</span>
            <Toggle checked={config.show_flavour !== false} onChange={(v) => onChange("show_flavour", v)} label="Show Flavour" />
          </div>
          <div className="flex items-center justify-between">
            <span>Show Quick Add Button</span>
            <Toggle checked={config.show_quick_add !== false} onChange={(v) => onChange("show_quick_add", v)} label="Show Quick Add" />
          </div>
          <div className="flex items-center justify-between">
            <span>Show Wishlist Button</span>
            <Toggle checked={config.show_wishlist !== false} onChange={(v) => onChange("show_wishlist", v)} label="Show Wishlist" />
          </div>
          <div className="flex items-center justify-between">
            <span>Show Stock Status</span>
            <Toggle checked={config.show_stock !== false} onChange={(v) => onChange("show_stock", v)} label="Show Stock" />
          </div>
        </div>
      </div>

      {/* 4. Grid & Responsive Settings */}
      <div className="p-3.5 bg-ui-bg-subtle rounded-2xl border border-ui-border-base flex flex-col gap-3">
        <Text className="text-xs font-bold uppercase tracking-wider text-blue-600 flex items-center gap-1.5">
          <LayoutGrid className="w-3.5 h-3.5" /> Grid Columns & Spacing
        </Text>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Desktop Grid Columns">
            <Select value={String(config.columns || 4)} onValueChange={(v) => onChange("columns", parseInt(v) || 4)}>
              <Select.Trigger><Select.Value /></Select.Trigger>
              <Select.Content>
                <Select.Item value="2">2 Columns</Select.Item>
                <Select.Item value="3">3 Columns</Select.Item>
                <Select.Item value="4">4 Columns (Standard)</Select.Item>
                <Select.Item value="5">5 Columns</Select.Item>
                <Select.Item value="6">6 Columns</Select.Item>
              </Select.Content>
            </Select>
          </Field>

          <Field label="Grid Gap (px)">
            <Select value={String(config.gap || 24)} onValueChange={(v) => onChange("gap", parseInt(v) || 24)}>
              <Select.Trigger><Select.Value /></Select.Trigger>
              <Select.Content>
                <Select.Item value="12">12px (Compact)</Select.Item>
                <Select.Item value="16">16px</Select.Item>
                <Select.Item value="24">24px (Standard)</Select.Item>
                <Select.Item value="32">32px (Spacious)</Select.Item>
              </Select.Content>
            </Select>
          </Field>
        </div>

        {isCarousel && (
          <div className="p-3 bg-ui-bg-base rounded-xl border border-ui-border-base flex flex-col gap-2.5 mt-2">
            <Text className="text-xs font-bold text-brand-gold uppercase">Carousel Settings</Text>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="flex items-center justify-between">
                <span>Autoplay</span>
                <Toggle checked={config.autoplay !== false} onChange={(v) => onChange("autoplay", v)} label="Autoplay" />
              </div>
              <div className="flex items-center justify-between">
                <span>Infinite Loop</span>
                <Toggle checked={config.infinite_loop !== false} onChange={(v) => onChange("infinite_loop", v)} label="Loop" />
              </div>
              <div className="flex items-center justify-between">
                <span>Show Arrows</span>
                <Toggle checked={config.show_arrows !== false} onChange={(v) => onChange("show_arrows", v)} label="Arrows" />
              </div>
              <div className="flex items-center justify-between">
                <span>Show Dots</span>
                <Toggle checked={config.show_dots !== false} onChange={(v) => onChange("show_dots", v)} label="Dots" />
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
