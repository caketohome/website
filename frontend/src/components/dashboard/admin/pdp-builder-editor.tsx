"use client";

import React from "react";
import { Heading, Text, Input, Label, Textarea, Select } from "@medusajs/ui";
import {
  ShoppingBag, Eye, Layout, ShieldCheck, Truck, Sparkles, Sliders
} from "lucide-react";

interface PdpBuilderEditorProps {
  config: Record<string, any>;
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

export function PdpBuilderEditor({ config, onChange }: PdpBuilderEditorProps) {
  return (
    <div className="flex flex-col gap-4">
      {/* 1. Gallery & Layout */}
      <div className="p-3.5 bg-ui-bg-subtle rounded-2xl border border-ui-border-base flex flex-col gap-3">
        <Text className="text-xs font-bold uppercase tracking-wider text-rose-600 flex items-center gap-1.5">
          <Layout className="w-3.5 h-3.5" /> Gallery & Page Layout
        </Text>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Gallery Position">
            <Select value={config.gallery_layout || "left"} onValueChange={(v) => onChange("gallery_layout", v)}>
              <Select.Trigger><Select.Value /></Select.Trigger>
              <Select.Content>
                <Select.Item value="left">Gallery Left / Info Right</Select.Item>
                <Select.Item value="right">Info Left / Gallery Right</Select.Item>
                <Select.Item value="stacked">Full-Width Stacked</Select.Item>
              </Select.Content>
            </Select>
          </Field>

          <Field label="Thumbnails Position">
            <Select value={config.thumbnail_position || "bottom"} onValueChange={(v) => onChange("thumbnail_position", v)}>
              <Select.Trigger><Select.Value /></Select.Trigger>
              <Select.Content>
                <Select.Item value="bottom">Bottom Horizontal</Select.Item>
                <Select.Item value="left">Left Vertical Strip</Select.Item>
                <Select.Item value="right">Right Vertical Strip</Select.Item>
              </Select.Content>
            </Select>
          </Field>
        </div>

        <div className="grid grid-cols-2 gap-2 text-xs pt-1">
          <div className="flex items-center justify-between">
            <span>Enable Hover Zoom</span>
            <Toggle checked={config.enable_zoom !== false} onChange={(v) => onChange("enable_zoom", v)} label="Zoom" />
          </div>
          <div className="flex items-center justify-between">
            <span>Enable Lightbox Fullscreen</span>
            <Toggle checked={config.enable_lightbox !== false} onChange={(v) => onChange("enable_lightbox", v)} label="Lightbox" />
          </div>
        </div>
      </div>

      {/* 2. Product Information Display Elements */}
      <div className="p-3.5 bg-ui-bg-subtle rounded-2xl border border-ui-border-base flex flex-col gap-3">
        <Text className="text-xs font-bold uppercase tracking-wider text-purple-600 flex items-center gap-1.5">
          <Eye className="w-3.5 h-3.5" /> Block Visibility Toggles
        </Text>

        <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-xs">
          <div className="flex items-center justify-between">
            <span>Show SKU</span>
            <Toggle checked={config.show_sku !== false} onChange={(v) => onChange("show_sku", v)} label="Show SKU" />
          </div>
          <div className="flex items-center justify-between">
            <span>Show Star Rating</span>
            <Toggle checked={config.show_rating !== false} onChange={(v) => onChange("show_rating", v)} label="Show Rating" />
          </div>
          <div className="flex items-center justify-between">
            <span>Show Review Count</span>
            <Toggle checked={config.show_reviews !== false} onChange={(v) => onChange("show_reviews", v)} label="Show Reviews" />
          </div>
          <div className="flex items-center justify-between">
            <span>Show Price</span>
            <Toggle checked={config.show_price !== false} onChange={(v) => onChange("show_price", v)} label="Show Price" />
          </div>
          <div className="flex items-center justify-between">
            <span>Show Strikethrough Price</span>
            <Toggle checked={config.show_compare_price !== false} onChange={(v) => onChange("show_compare_price", v)} label="Show Compare Price" />
          </div>
          <div className="flex items-center justify-between">
            <span>Show Delivery Checker</span>
            <Toggle checked={config.show_delivery_checker !== false} onChange={(v) => onChange("show_delivery_checker", v)} label="Show Delivery Checker" />
          </div>
          <div className="flex items-center justify-between">
            <span>Show Custom Inscription</span>
            <Toggle checked={config.show_customization !== false} onChange={(v) => onChange("show_customization", v)} label="Show Customization" />
          </div>
          <div className="flex items-center justify-between">
            <span>Show Quantity Selector</span>
            <Toggle checked={config.show_quantity !== false} onChange={(v) => onChange("show_quantity", v)} label="Show Quantity" />
          </div>
          <div className="flex items-center justify-between">
            <span>Show Wishlist Button</span>
            <Toggle checked={config.show_wishlist !== false} onChange={(v) => onChange("show_wishlist", v)} label="Show Wishlist" />
          </div>
          <div className="flex items-center justify-between">
            <span>Show Ingredients Accordion</span>
            <Toggle checked={config.show_ingredients !== false} onChange={(v) => onChange("show_ingredients", v)} label="Show Ingredients" />
          </div>
          <div className="flex items-center justify-between">
            <span>Show Allergens Warning</span>
            <Toggle checked={config.show_allergens !== false} onChange={(v) => onChange("show_allergens", v)} label="Show Allergens" />
          </div>
          <div className="flex items-center justify-between">
            <span>Show Trust Badges</span>
            <Toggle checked={config.show_trust_badges !== false} onChange={(v) => onChange("show_trust_badges", v)} label="Show Trust Badges" />
          </div>
        </div>
      </div>

      {/* 3. Action Buttons & Sticky Bar */}
      <div className="p-3.5 bg-ui-bg-subtle rounded-2xl border border-ui-border-base flex flex-col gap-3">
        <Text className="text-xs font-bold uppercase tracking-wider text-emerald-600 flex items-center gap-1.5">
          <ShoppingBag className="w-3.5 h-3.5" /> Call-To-Action Buttons
        </Text>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Add to Cart Text">
            <Input
              value={config.add_to_cart_text || "Add to Cart"}
              onChange={(e) => onChange("add_to_cart_text", e.target.value)}
              placeholder="Add to Cart"
            />
          </Field>
          <Field label="Buy Now Text">
            <Input
              value={config.buy_now_text || "Buy Now"}
              onChange={(e) => onChange("buy_now_text", e.target.value)}
              placeholder="Buy Now"
            />
          </Field>
        </div>

        <div className="grid grid-cols-2 gap-2 text-xs pt-1">
          <div className="flex items-center justify-between">
            <span>Sticky Bar Desktop</span>
            <Toggle checked={config.sticky_add_to_cart_desktop !== false} onChange={(v) => onChange("sticky_add_to_cart_desktop", v)} label="Sticky Desktop" />
          </div>
          <div className="flex items-center justify-between">
            <span>Sticky Bar Mobile</span>
            <Toggle checked={config.sticky_add_to_cart_mobile !== false} onChange={(v) => onChange("sticky_add_to_cart_mobile", v)} label="Sticky Mobile" />
          </div>
        </div>
      </div>

      {/* 4. Related Products */}
      <div className="p-3.5 bg-ui-bg-subtle rounded-2xl border border-ui-border-base flex flex-col gap-3">
        <Text className="text-xs font-bold uppercase tracking-wider text-blue-600 flex items-center gap-1.5">
          <Sparkles className="w-3.5 h-3.5" /> Related Products Recommendation
        </Text>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Recommendation Source">
            <Select value={config.related_source || "same_category"} onValueChange={(v) => onChange("related_source", v)}>
              <Select.Trigger><Select.Value /></Select.Trigger>
              <Select.Content>
                <Select.Item value="same_category">Same Category</Select.Item>
                <Select.Item value="same_flavour">Same Flavour</Select.Item>
                <Select.Item value="same_occasion">Same Occasion</Select.Item>
                <Select.Item value="bestsellers">Bakery Bestsellers</Select.Item>
                <Select.Item value="trending">Trending Creations</Select.Item>
              </Select.Content>
            </Select>
          </Field>

          <Field label="Product Count">
            <Select value={String(config.related_limit || 4)} onValueChange={(v) => onChange("related_limit", parseInt(v) || 4)}>
              <Select.Trigger><Select.Value /></Select.Trigger>
              <Select.Content>
                <Select.Item value="4">4 Cakes</Select.Item>
                <Select.Item value="8">8 Cakes</Select.Item>
              </Select.Content>
            </Select>
          </Field>
        </div>
      </div>
    </div>
  );
}
