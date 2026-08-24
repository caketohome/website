"use client";

import React, { useState } from "react";
import {
  Heading, Text, Badge, Button, Input, Label, Textarea, Select,
} from "@medusajs/ui";
import {
  Sliders, PlayCircle, Layers, Palette, Eye, Type, Image as ImageIcon,
  Plus, Trash2, ArrowUp, ArrowDown, XCircle, Sparkles, Check, ChevronDown,
  ChevronUp, Tag, MapPin, Truck, Clock, ShieldCheck, Heart, Star, Gift, Award
} from "lucide-react";
import { MediaSelection } from "./media-selector-modal";
import { PromotionalBannerEditor } from "./promotional-banner-editor";
import { AnnouncementBarEditor } from "./announcement-bar-editor";
import { ScrollFrameEditor } from "./scroll-frame-editor";
import { CmsImageUploader } from "./cms-image-uploader";

interface SectionConfigEditorProps {
  section: any;
  allProducts: any[];
  allCategories: any[];
  allOccasions: any[];
  updateSectionField: (id: string, key: string, value: any) => void;
  updateSectionConfig: (id: string, key: string, value: any) => void;
  updateSectionWholeConfig?: (id: string, newFullConfig: any) => void;
  updateSectionNestedConfig: (id: string, device: "desktop" | "tablet" | "mobile", key: string, value: any) => void;
  openImagePicker: (title: string, current: any, onSelect: (sel: MediaSelection) => void) => void;
  onClose: () => void;
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

function ColorInput({
  label,
  value,
  onChange,
  fallback = "#ffffff",
}: {
  label: string;
  value?: string;
  onChange: (val: string) => void;
  fallback?: string;
}) {
  const safeVal = value || fallback;
  return (
    <Field label={label}>
      <div className="flex items-center gap-2">
        <input
          type="color"
          value={safeVal.startsWith("#") ? safeVal : fallback}
          onChange={(e) => onChange(e.target.value)}
          className="h-8 w-9 rounded-lg border border-ui-border-base cursor-pointer p-0.5 shrink-0 bg-transparent"
        />
        <Input
          value={value || ""}
          onChange={(e) => onChange(e.target.value)}
          placeholder={fallback}
          className="text-xs"
        />
      </div>
    </Field>
  );
}

type SectionSubTab = "content" | "animation" | "responsive" | "style" | "visibility";

export function SectionConfigEditor({
  section,
  allProducts,
  allCategories,
  allOccasions,
  updateSectionField,
  updateSectionConfig,
  updateSectionWholeConfig,
  updateSectionNestedConfig,
  openImagePicker,
  onClose,
}: SectionConfigEditorProps) {
  const [subTab, setSubTab] = useState<SectionSubTab>("content");
  const [activeDevice, setActiveDevice] = useState<"desktop" | "tablet" | "mobile">("desktop");
  const [productSearch, setProductSearch] = useState("");
  const [newAreaInput, setNewAreaInput] = useState("");

  const config = section.config || {};
  const isPromo = section.type === "promotional_banner" || section.type === "promo";
  const isAnnounce = section.type === "announcement_bar" || section.type === "announcement";

  if (isPromo) {
    return (
      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between pb-3 border-b border-ui-border-base">
          <button onClick={onClose} className="text-xs font-semibold text-rose-600 hover:text-rose-700 flex items-center gap-1">
            ← Back to Page Settings
          </button>
          <Badge color="purple" className="text-[10px]">{section.type}</Badge>
        </div>
        <Field label="Section Admin Label">
          <Input value={section.name || ""} onChange={(e) => updateSectionField(section.id, "name", e.target.value)} />
        </Field>
        <PromotionalBannerEditor
          section={section}
          sectionConfigDevice={activeDevice}
          setSectionConfigDevice={setActiveDevice}
          updateSectionConfig={updateSectionConfig}
          updateSectionNestedConfig={updateSectionNestedConfig}
          openImagePicker={openImagePicker}
        />
      </div>
    );
  }

  if (isAnnounce) {
    return (
      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between pb-3 border-b border-ui-border-base">
          <button onClick={onClose} className="text-xs font-semibold text-rose-600 hover:text-rose-700 flex items-center gap-1">
            ← Back to Page Settings
          </button>
          <Badge color="purple" className="text-[10px]">{section.type}</Badge>
        </div>
        <Field label="Section Admin Label">
          <Input value={section.name || ""} onChange={(e) => updateSectionField(section.id, "name", e.target.value)} />
        </Field>
        <AnnouncementBarEditor
          config={config}
          onChange={(newCfg) => {
            Object.keys(newCfg).forEach((k) => {
              updateSectionConfig(section.id, k, (newCfg as any)[k]);
            });
          }}
        />
      </div>
    );
  }

  const isKitchenStory = section.type === "kitchen_story" || section.type === "scroll_frame";
  if (isKitchenStory) {
    return (
      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between pb-3 border-b border-ui-border-base">
          <button onClick={onClose} className="text-xs font-semibold text-rose-600 hover:text-rose-700 flex items-center gap-1">
            ← Back to Page Settings
          </button>
          <Badge color="purple" className="text-[10px]">Kitchen Story / Scroll-Frame</Badge>
        </div>
        <Field label="Section Admin Label">
          <Input value={section.name || ""} onChange={(e) => updateSectionField(section.id, "name", e.target.value)} />
        </Field>
        <ScrollFrameEditor
          config={config}
          onChange={(newCfg) => {
            Object.keys(newCfg).forEach((k) => {
              updateSectionConfig(section.id, k, (newCfg as any)[k]);
            });
          }}
        />
      </div>
    );
  }

  const animationConfig = config.animation || {};
  const updateAnimation = (key: string, val: any) => {
    updateSectionConfig(section.id, "animation", { ...animationConfig, [key]: val });
  };

  const carouselConfig = config.carousel || {};
  const updateCarousel = (key: string, val: any) => {
    updateSectionConfig(section.id, "carousel", { ...carouselConfig, [key]: val });
  };

  const visibilityConfig = config.visibility || {};
  const updateVisibility = (key: string, val: any) => {
    updateSectionConfig(section.id, "visibility", { ...visibilityConfig, [key]: val });
  };

  const moveArrayItem = (arr: any[], from: number, to: number) => {
    if (to < 0 || to >= arr.length) return arr;
    const copy = [...arr];
    const [item] = copy.splice(from, 1);
    copy.splice(to, 0, item);
    return copy;
  };

  return (
    <div className="flex flex-col gap-4">
      {/* Header */}
      <div className="flex items-center justify-between pb-3 border-b border-ui-border-base">
        <button onClick={onClose} className="text-xs font-semibold text-rose-600 hover:text-rose-700 flex items-center gap-1">
          ← Back to Page Settings
        </button>
        <Badge color="purple" className="text-[10px]">{section.type}</Badge>
      </div>

      <Field label="Section Admin Label">
        <Input value={section.name || ""} onChange={(e) => updateSectionField(section.id, "name", e.target.value)} />
      </Field>

      {/* Subtab Navigation */}
      <div className="flex items-center gap-1 overflow-x-auto pb-1 border-b border-ui-border-base scrollbar-none text-xs">
        {[
          { id: "content" as const, label: "Content", icon: Type },
          { id: "animation" as const, label: "Motion", icon: PlayCircle },
          { id: "responsive" as const, label: "Responsive", icon: Sliders },
          { id: "style" as const, label: "Style", icon: Palette },
          { id: "visibility" as const, label: "Visibility", icon: Eye },
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = subTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setSubTab(tab.id)}
              className={`px-2.5 py-1.5 rounded-lg font-bold flex items-center gap-1.5 whitespace-nowrap text-xs transition-all ${
                isActive ? "bg-rose-500 text-white shadow-sm" : "text-ui-fg-muted hover:bg-ui-bg-subtle hover:text-ui-fg-base"
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* ═══════════════════════════════════════════════════════════ */}
      {/* SUBTAB 1: CONTENT */}
      {/* ═══════════════════════════════════════════════════════════ */}
      {subTab === "content" && (
        <div className="flex flex-col gap-3">
          {/* HERO CONTENT */}
          {section.type === "hero" && (
            <>
              <Field label="Headline">
                <Input
                  data-testid="hero-headline-input"
                  value={config.headline || ""}
                  onChange={(e) => updateSectionConfig(section.id, "headline", e.target.value)}
                  placeholder="Handcrafted Gourmet Cakes Delivered in 2 Hours"
                />
              </Field>
              <Field label="Subheadline">
                <Textarea
                  data-testid="hero-subheadline-input"
                  value={config.subheadline || ""}
                  onChange={(e) => updateSectionConfig(section.id, "subheadline", e.target.value)}
                  placeholder="Fresh, artisanal birthday & wedding cakes across Bangalore..."
                  rows={2}
                />
              </Field>
              <Field label="Badge Text">
                <Input
                  data-testid="hero-badge-input"
                  value={config.badge_text || ""}
                  onChange={(e) => updateSectionConfig(section.id, "badge_text", e.target.value)}
                  placeholder="100% Fresh & Artisanal • Express 2-Hour Delivery"
                />
              </Field>

              {/* Phase 1 CTAs */}
              <div className="p-3 bg-ui-bg-subtle rounded-xl border border-ui-border-base flex flex-col gap-2.5">
                <Text className="text-xs font-bold text-rose-600 uppercase">Primary & Secondary Call To Action</Text>
                <div className="grid grid-cols-2 gap-2">
                  <Field label="Primary CTA Text">
                    <Input
                      data-testid="hero-primary-cta-text-input"
                      value={config.cta_primary_text || config.cta_text || ""}
                      onChange={(e) => updateSectionConfig(section.id, "cta_primary_text", e.target.value)}
                      placeholder="Explore Cakes"
                    />
                  </Field>
                  <Field label="Primary CTA URL">
                    <Input
                      data-testid="hero-primary-cta-url-input"
                      value={config.cta_primary_url || config.cta_url || ""}
                      onChange={(e) => updateSectionConfig(section.id, "cta_primary_url", e.target.value)}
                      placeholder="/products"
                    />
                  </Field>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <Field label="Secondary CTA Text">
                    <Input
                      data-testid="hero-secondary-cta-text-input"
                      value={config.cta_secondary_text || ""}
                      onChange={(e) => updateSectionConfig(section.id, "cta_secondary_text", e.target.value)}
                      placeholder="Birthday Specials"
                    />
                  </Field>
                  <Field label="Secondary CTA URL">
                    <Input
                      data-testid="hero-secondary-cta-url-input"
                      value={config.cta_secondary_url || ""}
                      onChange={(e) => updateSectionConfig(section.id, "cta_secondary_url", e.target.value)}
                      placeholder="/products?occasion=birthday"
                    />
                  </Field>
                </div>
              </div>

              {/* Scroll Sequence Overlays */}
              <div className="p-3 bg-ui-bg-subtle rounded-xl border border-ui-border-base flex flex-col gap-2.5">
                <Text className="text-xs font-bold text-amber-600 uppercase">Phase 2: Master Chocolatier Story</Text>
                <Field label="Craft Badge">
                  <Input value={config.craft_badge || ""} onChange={(e) => updateSectionConfig(section.id, "craft_badge", e.target.value)} placeholder="Master Chocolatier Recipe" />
                </Field>
                <Field label="Craft Heading">
                  <Input value={config.craft_heading || ""} onChange={(e) => updateSectionConfig(section.id, "craft_heading", e.target.value)} placeholder="Every Layer, A Symphony of Flavor" />
                </Field>
                <Field label="Craft Text">
                  <Textarea value={config.craft_text || ""} onChange={(e) => updateSectionConfig(section.id, "craft_text", e.target.value)} placeholder="Crafted with Belgian cocoa, Madagascan vanilla..." rows={2} />
                </Field>
              </div>

              <div className="p-3 bg-ui-bg-subtle rounded-xl border border-ui-border-base flex flex-col gap-2.5">
                <Text className="text-xs font-bold text-emerald-600 uppercase">Phase 3: Transit & Delivery Guarantee</Text>
                <Field label="Fleet Badge">
                  <Input value={config.fleet_badge || ""} onChange={(e) => updateSectionConfig(section.id, "fleet_badge", e.target.value)} placeholder="Climate-Controlled Transit" />
                </Field>
                <Field label="Fleet Heading">
                  <Input value={config.fleet_heading || ""} onChange={(e) => updateSectionConfig(section.id, "fleet_heading", e.target.value)} placeholder="Pristine & Chilled To Your Table" />
                </Field>
                <Field label="Fleet Text">
                  <Textarea value={config.fleet_text || ""} onChange={(e) => updateSectionConfig(section.id, "fleet_text", e.target.value)} placeholder="Specially engineered shock-absorbent cake domes..." rows={2} />
                </Field>
                <div className="grid grid-cols-2 gap-2">
                  <Field label="Fleet CTA Text"><Input value={config.fleet_cta_text || ""} onChange={(e) => updateSectionConfig(section.id, "fleet_cta_text", e.target.value)} placeholder="Order for Today" /></Field>
                  <Field label="Fleet CTA URL"><Input value={config.fleet_cta_url || ""} onChange={(e) => updateSectionConfig(section.id, "fleet_cta_url", e.target.value)} placeholder="/products" /></Field>
                </div>
              </div>

              {/* Hero Banner Responsive Image Uploader */}
              <CmsImageUploader
                label="Hero Banner Image"
                sectionId={section.id}
                config={config}
                updateConfig={(key, val) => updateSectionConfig(section.id, key, val)}
                openImagePicker={openImagePicker}
                headingFallback={config.headline || section.name || "Hero Banner"}
              />
            </>
          )}

          {/* PRODUCT GRIDS / BEST SELLERS / NEW ARRIVALS */}
          {(section.type === "product_grid" || section.type === "best_sellers" || section.type === "new_arrivals" || section.type === "featured_cakes") && (
            <>
              <Field label="Section Heading">
                <Input value={config.heading || ""} onChange={(e) => updateSectionConfig(section.id, "heading", e.target.value)} placeholder="🏆 Best-Selling Cakes" />
              </Field>
              <Field label="Section Subtitle">
                <Input value={config.subheading || ""} onChange={(e) => updateSectionConfig(section.id, "subheading", e.target.value)} placeholder="Freshly baked artisan recipes ready for express delivery" />
              </Field>
              <div className="grid grid-cols-2 gap-2">
                <Field label="View All Text"><Input value={config.view_all_text || ""} onChange={(e) => updateSectionConfig(section.id, "view_all_text", e.target.value)} placeholder="View All" /></Field>
                <Field label="View All URL"><Input value={config.view_all_url || ""} onChange={(e) => updateSectionConfig(section.id, "view_all_url", e.target.value)} placeholder="/products" /></Field>
              </div>
              <Field label="Product Mode">
                <Select value={config.mode || "best_sellers"} onValueChange={(v) => updateSectionConfig(section.id, "mode", v)}>
                  <Select.Trigger><Select.Value /></Select.Trigger>
                  <Select.Content>
                    <Select.Item value="best_sellers">Best Sellers (Automated)</Select.Item>
                    <Select.Item value="new_arrivals">New Arrivals (Automated)</Select.Item>
                    <Select.Item value="featured">Featured Cakes</Select.Item>
                    <Select.Item value="all">All Catalog</Select.Item>
                    <Select.Item value="manual">Manual Selection</Select.Item>
                  </Select.Content>
                </Select>
              </Field>

              {config.mode === "manual" && (
                <div className="flex flex-col gap-2">
                  <Input value={productSearch} onChange={(e) => setProductSearch(e.target.value)} placeholder="Search products..." />
                  <div className="max-h-40 overflow-y-auto flex flex-col gap-1 border border-ui-border-base rounded-xl p-1 bg-ui-bg-subtle">
                    {allProducts.filter((p) => !productSearch || p.title?.toLowerCase().includes(productSearch.toLowerCase())).map((p) => {
                      const pid = p.id || p.product_id;
                      const isSel = (config.product_ids || []).includes(pid);
                      return (
                        <div
                          key={pid}
                          onClick={() => {
                            const cur = config.product_ids || [];
                            const next = isSel ? cur.filter((id: string) => id !== pid) : [...cur, pid];
                            updateSectionConfig(section.id, "product_ids", next);
                          }}
                          className={`p-1.5 rounded-lg cursor-pointer text-xs flex items-center justify-between ${isSel ? "bg-rose-500 text-white font-bold" : "hover:bg-ui-bg-base"}`}
                        >
                          <span className="truncate">{p.title}</span>
                          <span>₹{p.price}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </>
          )}

          {/* CATEGORY GRID */}
          {section.type === "category_grid" && (
            <>
              <Field label="Heading">
                <Input value={config.heading || ""} onChange={(e) => updateSectionConfig(section.id, "heading", e.target.value)} placeholder="Shop by Occasion & Flavour" />
              </Field>
              <Field label="Subtitle">
                <Input value={config.subheading || ""} onChange={(e) => updateSectionConfig(section.id, "subheading", e.target.value)} placeholder="Find the perfect cake handcrafted for your celebration" />
              </Field>
              <div className="grid grid-cols-2 gap-2">
                <Field label="View All Text"><Input value={config.view_all_text || ""} onChange={(e) => updateSectionConfig(section.id, "view_all_text", e.target.value)} placeholder="View All Categories" /></Field>
                <Field label="View All URL"><Input value={config.view_all_url || ""} onChange={(e) => updateSectionConfig(section.id, "view_all_url", e.target.value)} placeholder="/category" /></Field>
              </div>
            </>
          )}

          {/* BRAND STORY / IMAGE + TEXT */}
          {(section.type === "brand_story" || section.type === "image_text") && (
            <>
              <Field label="Badge / Tag"><Input value={config.badge_text || ""} onChange={(e) => updateSectionConfig(section.id, "badge_text", e.target.value)} placeholder="About Our Kitchen" /></Field>
              <Field label="Heading"><Input value={config.heading || ""} onChange={(e) => updateSectionConfig(section.id, "heading", e.target.value)} placeholder="Handcrafted with Pure Ingredients" /></Field>
              <Field label="Body Text"><Textarea value={config.body || ""} onChange={(e) => updateSectionConfig(section.id, "body", e.target.value)} rows={3} /></Field>
              <div className="grid grid-cols-2 gap-2">
                <Field label="CTA Text"><Input value={config.cta_text || ""} onChange={(e) => updateSectionConfig(section.id, "cta_text", e.target.value)} placeholder="Learn More" /></Field>
                <Field label="CTA URL"><Input value={config.cta_url || ""} onChange={(e) => updateSectionConfig(section.id, "cta_url", e.target.value)} placeholder="/products" /></Field>
              </div>
              <CmsImageUploader
                label="Our Kitchen Story Image"
                sectionId={section.id}
                config={config}
                updateConfig={(key, val) => updateSectionConfig(section.id, key, val)}
                openImagePicker={openImagePicker}
                headingFallback={config.heading || section.name || "Kitchen Story"}
              />
            </>
          )}

          {/* FEATURES */}
          {section.type === "features" && (
            <>
              <Field label="Section Heading"><Input value={config.heading || ""} onChange={(e) => updateSectionConfig(section.id, "heading", e.target.value)} placeholder="Why CakeToHome is Bangalore's #1 Choice" /></Field>
              <div className="flex flex-col gap-2">
                <Text className="text-xs font-bold">Feature Items ({(config.features || []).length})</Text>
                {(config.features || []).map((feat: any, fi: number) => (
                  <div key={fi} className="p-2.5 bg-ui-bg-subtle rounded-xl flex flex-col gap-2 border border-ui-border-base text-xs">
                    <Input value={feat.title || ""} onChange={(e) => {
                      const list = [...(config.features || [])];
                      list[fi] = { ...list[fi], title: e.target.value };
                      updateSectionConfig(section.id, "features", list);
                    }} placeholder="Feature Title" />
                    <Input value={feat.desc || ""} onChange={(e) => {
                      const list = [...(config.features || [])];
                      list[fi] = { ...list[fi], desc: e.target.value };
                      updateSectionConfig(section.id, "features", list);
                    }} placeholder="Description" />
                    <button onClick={() => {
                      const list = (config.features || []).filter((_: any, i: number) => i !== fi);
                      updateSectionConfig(section.id, "features", list);
                    }} className="self-end text-[10px] text-red-500 hover:underline">Remove</button>
                  </div>
                ))}
                <Button variant="secondary" size="small" onClick={() => {
                  const list = [...(config.features || []), { icon: "Sparkles", title: "New Feature", desc: "Description" }];
                  updateSectionConfig(section.id, "features", list);
                }}><Plus className="w-3.5 h-3.5 mr-1" /> Add Feature</Button>
              </div>
            </>
          )}

          {/* FAQ */}
          {section.type === "faq" && (
            <>
              <Field label="FAQ Heading"><Input value={config.heading || ""} onChange={(e) => updateSectionConfig(section.id, "heading", e.target.value)} placeholder="Frequently Asked Questions" /></Field>
              <div className="flex flex-col gap-2">
                <Text className="text-xs font-bold">Questions & Answers ({(config.faqs || []).length})</Text>
                {(config.faqs || []).map((faq: any, fi: number) => (
                  <div key={fi} className="p-2.5 bg-ui-bg-subtle rounded-xl flex flex-col gap-2 border border-ui-border-base text-xs">
                    <Input value={faq.q || ""} onChange={(e) => {
                      const list = [...(config.faqs || [])];
                      list[fi] = { ...list[fi], q: e.target.value };
                      updateSectionConfig(section.id, "faqs", list);
                    }} placeholder="Question" />
                    <Textarea value={faq.a || ""} onChange={(e) => {
                      const list = [...(config.faqs || [])];
                      list[fi] = { ...list[fi], a: e.target.value };
                      updateSectionConfig(section.id, "faqs", list);
                    }} placeholder="Answer" rows={2} />
                    <button onClick={() => {
                      const list = (config.faqs || []).filter((_: any, i: number) => i !== fi);
                      updateSectionConfig(section.id, "faqs", list);
                    }} className="self-end text-[10px] text-red-500 hover:underline">Remove</button>
                  </div>
                ))}
                <Button variant="secondary" size="small" onClick={() => {
                  const list = [...(config.faqs || []), { q: "", a: "" }];
                  updateSectionConfig(section.id, "faqs", list);
                }}><Plus className="w-3.5 h-3.5 mr-1" /> Add FAQ Item</Button>
              </div>
            </>
          )}

          {/* LOCATION COVERAGE */}
          {section.type === "location_coverage" && (
            <>
              <Field label="Badge"><Input value={config.badge || ""} onChange={(e) => updateSectionConfig(section.id, "badge", e.target.value)} placeholder="Coverage Area" /></Field>
              <Field label="Heading"><Input value={config.heading || ""} onChange={(e) => updateSectionConfig(section.id, "heading", e.target.value)} placeholder="📍 We Deliver Fresh Cakes Across Bangalore" /></Field>
              <Field label="Subheading"><Input value={config.subheading || ""} onChange={(e) => updateSectionConfig(section.id, "subheading", e.target.value)} placeholder="Same-day & 2-hour express delivery available" /></Field>
              <div className="flex flex-col gap-2">
                <Text className="text-xs font-bold">Delivery Areas ({(config.areas || []).length})</Text>
                <div className="flex gap-2">
                  <Input value={newAreaInput} onChange={(e) => setNewAreaInput(e.target.value)} placeholder="Add area name..." onKeyDown={(e) => {
                    if (e.key === "Enter" && newAreaInput.trim()) {
                      e.preventDefault();
                      updateSectionConfig(section.id, "areas", [...(config.areas || []), newAreaInput.trim()]);
                      setNewAreaInput("");
                    }
                  }} />
                  <Button variant="secondary" size="small" onClick={() => {
                    if (newAreaInput.trim()) {
                      updateSectionConfig(section.id, "areas", [...(config.areas || []), newAreaInput.trim()]);
                      setNewAreaInput("");
                    }
                  }}><Plus className="w-3.5 h-3.5" /></Button>
                </div>
                <div className="flex flex-wrap gap-1.5 p-2 bg-ui-bg-subtle rounded-xl border border-ui-border-base max-h-36 overflow-y-auto">
                  {(config.areas || []).map((area: string, ai: number) => (
                    <span key={ai} className="px-2 py-1 bg-white dark:bg-ui-bg-base rounded-lg border text-xs flex items-center gap-1 shadow-sm">
                      {area}
                      <button onClick={() => updateSectionConfig(section.id, "areas", (config.areas || []).filter((_: any, i: number) => i !== ai))} className="text-ui-fg-muted hover:text-red-500">×</button>
                    </span>
                  ))}
                </div>
              </div>
            </>
          )}

          {/* CTA SECTION */}
          {section.type === "cta" && (
            <>
              <Field label="Heading"><Input value={config.heading || ""} onChange={(e) => updateSectionConfig(section.id, "heading", e.target.value)} placeholder="Ready to Celebrate?" /></Field>
              <Field label="Subheading"><Input value={config.subheading || ""} onChange={(e) => updateSectionConfig(section.id, "subheading", e.target.value)} placeholder="Order handcrafted cakes baked fresh..." /></Field>
              <div className="grid grid-cols-2 gap-2">
                <Field label="CTA Text"><Input value={config.cta_text || ""} onChange={(e) => updateSectionConfig(section.id, "cta_text", e.target.value)} placeholder="Order Now" /></Field>
                <Field label="CTA URL"><Input value={config.cta_url || ""} onChange={(e) => updateSectionConfig(section.id, "cta_url", e.target.value)} placeholder="/products" /></Field>
              </div>
            </>
          )}

          {/* TEXT / SEO CONTENT */}
          {(section.type === "text_content" || section.type === "seo_content") && (
            <>
              <Field label="Heading"><Input value={config.heading || ""} onChange={(e) => updateSectionConfig(section.id, "heading", e.target.value)} placeholder="Artisanal Cake Delivery" /></Field>
              <Field label="Content Body"><Textarea value={config.content || ""} onChange={(e) => updateSectionConfig(section.id, "content", e.target.value)} rows={4} /></Field>
            </>
          )}
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════ */}
      {/* SUBTAB 2: MOTION / ANIMATION */}
      {/* ═══════════════════════════════════════════════════════════ */}
      {subTab === "animation" && (
        <div className="flex flex-col gap-3">
          {/* Master Animation Toggle */}
          <div className="p-3 bg-ui-bg-subtle rounded-xl border border-ui-border-base flex items-center justify-between">
            <div>
              <Text className="text-xs font-bold">Section Entrance Animation</Text>
              <Text className="text-[10px] text-ui-fg-muted">GPU-accelerated viewport transitions</Text>
            </div>
            <Toggle
              checked={animationConfig.enabled !== false}
              onChange={(v) => updateAnimation("enabled", v)}
              label="Enable section animation"
            />
          </div>

          {animationConfig.enabled !== false && (
            <>
              <Field label="Animation Type">
                <Select value={animationConfig.type || "fade_up"} onValueChange={(v) => updateAnimation("type", v)}>
                  <Select.Trigger><Select.Value /></Select.Trigger>
                  <Select.Content>
                    <Select.Item value="none">None</Select.Item>
                    <Select.Item value="fade_up">Fade Up ↑</Select.Item>
                    <Select.Item value="fade_down">Fade Down ↓</Select.Item>
                    <Select.Item value="slide_left">Slide Left ←</Select.Item>
                    <Select.Item value="slide_right">Slide Right →</Select.Item>
                    <Select.Item value="scale">Scale Up 🔍</Select.Item>
                    <Select.Item value="reveal">Cinematic Reveal ✨</Select.Item>
                  </Select.Content>
                </Select>
              </Field>

              <div className="grid grid-cols-2 gap-2">
                <Field label="Trigger">
                  <Select value={animationConfig.trigger || "on_scroll"} onValueChange={(v) => updateAnimation("trigger", v)}>
                    <Select.Trigger><Select.Value /></Select.Trigger>
                    <Select.Content>
                      <Select.Item value="on_scroll">On Scroll (In View)</Select.Item>
                      <Select.Item value="on_load">On Page Load</Select.Item>
                    </Select.Content>
                  </Select>
                </Field>
                <Field label="Duration (ms)">
                  <Input type="number" value={animationConfig.duration ?? 600} onChange={(e) => updateAnimation("duration", parseInt(e.target.value) || 600)} min={200} max={2500} />
                </Field>
              </div>

              <div className="p-3 bg-ui-bg-subtle rounded-xl border border-ui-border-base flex items-center justify-between">
                <div>
                  <Text className="text-xs font-bold">Animate Once Only</Text>
                  <Text className="text-[10px] text-ui-fg-muted">Do not re-animate on every scroll</Text>
                </div>
                <Toggle
                  checked={animationConfig.once !== false}
                  onChange={(v) => updateAnimation("once", v)}
                  label="Animate once only"
                />
              </div>
            </>
          )}

          {/* Hero / Kitchen Story Scroll Sequence & Multi-Device Frame Controller */}
          {(section.type === "hero" || section.type === "kitchen_story" || section.type === "scroll_frame") && (
            <div className="flex flex-col gap-3 pt-2 border-t border-ui-border-base">
              <ScrollFrameEditor
                config={config}
                onChange={(newCfg) => {
                  if (updateSectionWholeConfig) {
                    updateSectionWholeConfig(section.id, newCfg);
                  } else {
                    Object.keys(newCfg).forEach((k) => {
                      updateSectionConfig(section.id, k, (newCfg as any)[k]);
                    });
                  }
                }}
              />
            </div>
          )}

          {/* Carousel / Horizontal Scroll Mode for Product & Category Grids */}
          {(section.type === "product_grid" || section.type === "best_sellers" || section.type === "new_arrivals" || section.type === "category_grid") && (
            <div className="p-3 bg-ui-bg-subtle rounded-xl border border-ui-border-base flex flex-col gap-2.5">
              <Text className="text-xs font-bold text-rose-600 uppercase">Layout & Carousel Controls</Text>
              <Field label="Display Layout">
                <Select value={config.layout || "grid"} onValueChange={(v) => updateSectionConfig(section.id, "layout", v)}>
                  <Select.Trigger><Select.Value /></Select.Trigger>
                  <Select.Content>
                    <Select.Item value="grid">Grid Mode</Select.Item>
                    <Select.Item value="carousel">Carousel / Horizontal Scroll</Select.Item>
                  </Select.Content>
                </Select>
              </Field>

              {config.layout === "carousel" && (
                <>
                  <div className="flex items-center justify-between">
                    <Text className="text-xs font-medium">Autoplay Carousel</Text>
                    <Toggle checked={carouselConfig.autoplay ?? false} onChange={(v) => updateCarousel("autoplay", v)} label="Autoplay" />
                  </div>
                  {carouselConfig.autoplay && (
                    <Field label="Autoplay Speed (seconds)">
                      <Input type="number" value={carouselConfig.autoplay_speed ?? 4} onChange={(e) => updateCarousel("autoplay_speed", parseInt(e.target.value) || 4)} min={2} max={15} />
                    </Field>
                  )}
                  <div className="flex items-center justify-between">
                    <Text className="text-xs font-medium">Show Navigation Arrows</Text>
                    <Toggle checked={carouselConfig.show_arrows !== false} onChange={(v) => updateCarousel("show_arrows", v)} label="Arrows" />
                  </div>
                  <div className="flex items-center justify-between">
                    <Text className="text-xs font-medium">Show Navigation Dots</Text>
                    <Toggle checked={carouselConfig.show_dots !== false} onChange={(v) => updateCarousel("show_dots", v)} label="Dots" />
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════ */}
      {/* SUBTAB 3: RESPONSIVE */}
      {/* ═══════════════════════════════════════════════════════════ */}
      {subTab === "responsive" && (
        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between p-2 bg-ui-bg-subtle rounded-xl border border-ui-border-base">
            <Text className="text-xs font-bold text-rose-600">Active Breakpoint</Text>
            <div className="flex items-center gap-1 bg-ui-bg-base p-0.5 rounded-lg border border-ui-border-base">
              {(["desktop", "tablet", "mobile"] as const).map((d) => (
                <button
                  key={d}
                  onClick={() => setActiveDevice(d)}
                  className={`px-2 py-0.5 text-[10px] font-bold rounded ${activeDevice === d ? "bg-rose-500 text-white" : "text-ui-fg-muted"}`}
                >
                  {d === "desktop" ? "💻 Desktop" : d === "tablet" ? "📱 Tablet" : "📱 Mobile"}
                </button>
              ))}
            </div>
          </div>

          {section.type === "hero" && (
            <div className="flex flex-col gap-2">
              <Field label={`${activeDevice.toUpperCase()} Hero Height`}>
                <Input value={config[activeDevice]?.height || (activeDevice === "desktop" ? "500px" : activeDevice === "tablet" ? "440px" : "380px")} onChange={(e) => updateSectionNestedConfig(section.id, activeDevice, "height", e.target.value)} />
              </Field>
              <Field label={`${activeDevice.toUpperCase()} Text Alignment`}>
                <Select value={config[activeDevice]?.alignment || "center"} onValueChange={(v) => updateSectionNestedConfig(section.id, activeDevice, "alignment", v)}>
                  <Select.Trigger><Select.Value /></Select.Trigger>
                  <Select.Content>
                    <Select.Item value="left">Left Aligned</Select.Item>
                    <Select.Item value="center">Centered</Select.Item>
                    <Select.Item value="right">Right Aligned</Select.Item>
                  </Select.Content>
                </Select>
              </Field>
            </div>
          )}

          {(section.type === "product_grid" || section.type === "best_sellers" || section.type === "new_arrivals" || section.type === "category_grid") && (
            <div className="grid grid-cols-2 gap-2">
              <Field label="Columns">
                <Select value={String(config[activeDevice]?.columns || (activeDevice === "desktop" ? 4 : activeDevice === "tablet" ? 3 : 2))} onValueChange={(v) => updateSectionNestedConfig(section.id, activeDevice, "columns", parseInt(v))}>
                  <Select.Trigger><Select.Value /></Select.Trigger>
                  <Select.Content>
                    {[1, 2, 3, 4, 5, 6].map((c) => <Select.Item key={c} value={String(c)}>{c} Columns</Select.Item>)}
                  </Select.Content>
                </Select>
              </Field>
              <Field label="Gap (px)">
                <Input type="number" value={config[activeDevice]?.gap ?? (activeDevice === "desktop" ? 16 : 12)} onChange={(e) => updateSectionNestedConfig(section.id, activeDevice, "gap", parseInt(e.target.value) || 12)} />
              </Field>
            </div>
          )}
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════ */}
      {/* SUBTAB 4: STYLE & SPACING */}
      {/* ═══════════════════════════════════════════════════════════ */}
      {subTab === "style" && (
        <div className="flex flex-col gap-3">
          <div className="grid grid-cols-2 gap-2">
            <Field label="Padding Top (px)">
              <Input type="number" value={config.paddingTop ?? 0} onChange={(e) => updateSectionConfig(section.id, "paddingTop", parseInt(e.target.value) || 0)} />
            </Field>
            <Field label="Padding Bottom (px)">
              <Input type="number" value={config.paddingBottom ?? 0} onChange={(e) => updateSectionConfig(section.id, "paddingBottom", parseInt(e.target.value) || 0)} />
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <Field label="Margin Top (px)">
              <Input type="number" value={config.marginTop ?? 0} onChange={(e) => updateSectionConfig(section.id, "marginTop", parseInt(e.target.value) || 0)} />
            </Field>
            <Field label="Margin Bottom (px)">
              <Input type="number" value={config.marginBottom ?? 0} onChange={(e) => updateSectionConfig(section.id, "marginBottom", parseInt(e.target.value) || 0)} />
            </Field>
          </div>
          <ColorInput label="Section Background" value={config.background?.color} onChange={(v) => updateSectionConfig(section.id, "background", { ...(config.background || {}), color: v })} fallback="#ffffff" />
          <Field label="Border Radius">
            <Input value={config.background?.borderRadius || "0px"} onChange={(e) => updateSectionConfig(section.id, "background", { ...(config.background || {}), borderRadius: e.target.value })} placeholder="e.g. 16px" />
          </Field>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════ */}
      {/* SUBTAB 5: VISIBILITY */}
      {/* ═══════════════════════════════════════════════════════════ */}
      {subTab === "visibility" && (
        <div className="flex flex-col gap-3">
          <div className="p-3 bg-ui-bg-subtle rounded-xl border border-ui-border-base flex items-center justify-between">
            <div>
              <Text className="text-xs font-bold">Section Active</Text>
              <Text className="text-[10px] text-ui-fg-muted">Master section switch</Text>
            </div>
            <Toggle checked={section.enabled !== false} onChange={(v) => updateSectionField(section.id, "enabled", v)} label="Section enabled" />
          </div>
          <div className="p-3 bg-ui-bg-subtle rounded-xl border border-ui-border-base flex items-center justify-between">
            <div>
              <Text className="text-xs font-bold">Show on Desktop</Text>
              <Text className="text-[10px] text-ui-fg-muted">Viewports &gt;= 1024px</Text>
            </div>
            <Toggle checked={visibilityConfig.desktop !== false} onChange={(v) => updateVisibility("desktop", v)} label="Desktop visibility" />
          </div>
          <div className="p-3 bg-ui-bg-subtle rounded-xl border border-ui-border-base flex items-center justify-between">
            <div>
              <Text className="text-xs font-bold">Show on Tablet</Text>
              <Text className="text-[10px] text-ui-fg-muted">Viewports 640px - 1023px</Text>
            </div>
            <Toggle checked={visibilityConfig.tablet !== false} onChange={(v) => updateVisibility("tablet", v)} label="Tablet visibility" />
          </div>
          <div className="p-3 bg-ui-bg-subtle rounded-xl border border-ui-border-base flex items-center justify-between">
            <div>
              <Text className="text-xs font-bold">Show on Mobile</Text>
              <Text className="text-[10px] text-ui-fg-muted">Viewports &lt; 640px</Text>
            </div>
            <Toggle checked={visibilityConfig.mobile !== false} onChange={(v) => updateVisibility("mobile", v)} label="Mobile visibility" />
          </div>
        </div>
      )}
    </div>
  );
}
