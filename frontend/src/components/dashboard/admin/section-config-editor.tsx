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
import { FeaturesSectionEditor } from "./features-section-editor";
import { SplitHeroEditor } from "./split-hero-editor";
import { OccasionsGridEditor } from "./occasions-grid-editor";
import { ProductGridEditor } from "./product-grid-editor";
import { extractFilterValues } from "@frontend/lib/cms/pim-product-resolver";
import { getSectionDefinition } from "@frontend/lib/cms/section-registry";

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
      <label className="text-xs font-bold text-slate-900 dark:text-slate-100 flex items-center justify-between">{label}</label>
      {children}
      {hint && <p className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">{hint}</p>}
    </div>
  );
}

function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors focus:outline-none ${checked ? "bg-brand-navy border border-brand-gold/50" : "bg-ui-bg-component border border-ui-border-base"}`}
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
  const sectionDef = getSectionDefinition(section.type);
  const editorType = sectionDef?.editorType || section.type;
  const filterValues = extractFilterValues(allProducts, allCategories, allOccasions);
  const isPromo = section.type === "promotional_banner" || section.type === "promo";
  const isAnnounce = section.type === "announcement_bar" || section.type === "announcement";

  if (isPromo) {
    return (
      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between pb-3 border-b border-ui-border-base">
          <button onClick={onClose} className="text-xs font-semibold text-brand-navy hover:text-brand-deep dark:text-brand-gold flex items-center gap-1">
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
          <button onClick={onClose} className="text-xs font-semibold text-brand-navy hover:text-brand-deep dark:text-brand-gold flex items-center gap-1">
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

  const isKitchenStory = section.type === "kitchen_story" || section.type === "scroll_frame" || editorType === "scroll_story";
  if (isKitchenStory) {
    return (
      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between pb-3 border-b border-ui-border-base">
          <button onClick={onClose} className="text-xs font-semibold text-brand-navy hover:text-brand-deep dark:text-brand-gold flex items-center gap-1">
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
        <button onClick={onClose} className="text-xs font-semibold text-brand-navy hover:text-brand-deep dark:text-brand-gold flex items-center gap-1">
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
                isActive ? "bg-brand-navy text-white shadow-sm border border-brand-gold/30" : "text-ui-fg-muted hover:bg-ui-bg-subtle hover:text-ui-fg-base"
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
          {/* 1a. SPLIT HERO COMPREHENSIVE */}
          {(editorType === "split_hero" || section.type === "split_hero") && (
            <SplitHeroEditor
              config={config}
              onChange={(k, v) => updateSectionConfig(section.id, k, v)}
              openImagePicker={openImagePicker}
            />
          )}

          {/* 1b. HERO / VISUAL / SPLIT / VIDEO SECTIONS */}
          {((editorType === "hero" || editorType === "hero_video" || editorType === "full_width_image" || editorType === "video_text" || editorType === "before_after" || section.type === "hero") && editorType !== "split_hero" && section.type !== "split_hero") && (
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
                  placeholder="Fresh, birthday & wedding cakes across Kerala..."
                  rows={2}
                />
              </Field>
              <Field label="Badge Text">
                <Input
                  data-testid="hero-badge-input"
                  value={config.badge_text || config.badge || ""}
                  onChange={(e) => updateSectionConfig(section.id, "badge_text", e.target.value)}
                  placeholder="100% Fresh • Express 2-Hour Delivery"
                />
              </Field>

              {(editorType === "hero_video" || editorType === "video_text") && (
                <div className="p-3 bg-ui-bg-subtle rounded-xl border border-ui-border-base flex flex-col gap-2.5">
                  <Text className="text-xs font-bold text-brand-primary uppercase">Video Settings</Text>
                  <Field label="Video URL (MP4 / WebM / YouTube Embed)">
                    <Input
                      value={config.video_url || ""}
                      onChange={(e) => updateSectionConfig(section.id, "video_url", e.target.value)}
                      placeholder="https://assets.mixkit.co/videos/preview/..."
                    />
                  </Field>
                  <div className="flex items-center justify-between">
                    <Text className="text-xs">Autoplay Video</Text>
                    <Toggle checked={config.autoplay !== false} onChange={(v) => updateSectionConfig(section.id, "autoplay", v)} label="Autoplay" />
                  </div>
                  <div className="flex items-center justify-between">
                    <Text className="text-xs">Mute Audio</Text>
                    <Toggle checked={config.muted !== false} onChange={(v) => updateSectionConfig(section.id, "muted", v)} label="Mute Audio" />
                  </div>
                </div>
              )}

              {(editorType === "split_hero" || editorType === "video_text") && (
                <Field label="Media Alignment">
                  <Select value={config.media_position || config.image_position || "right"} onValueChange={(v) => updateSectionConfig(section.id, "media_position", v)}>
                    <Select.Trigger><Select.Value /></Select.Trigger>
                    <Select.Content>
                      <Select.Item value="left">Media Left, Content Right</Select.Item>
                      <Select.Item value="right">Content Left, Media Right</Select.Item>
                    </Select.Content>
                  </Select>
                </Field>
              )}

              {editorType === "before_after" && (
                <div className="p-3 bg-ui-bg-subtle rounded-xl border border-ui-border-base flex flex-col gap-2.5">
                  <Text className="text-xs font-bold text-brand-gold uppercase">Before & After Slider Settings</Text>
                  <div className="grid grid-cols-2 gap-2">
                    <Field label="Before Image">
                      <div className="flex gap-1">
                        <Input value={config.before_image_url || ""} onChange={(e) => updateSectionConfig(section.id, "before_image_url", e.target.value)} placeholder="Upload or paste URL" />
                        <Button variant="secondary" size="small" onClick={() => openImagePicker("Before Image", config.before_image_url, (sel) => updateSectionConfig(section.id, "before_image_url", sel.url))}><ImageIcon className="w-3.5 h-3.5" /></Button>
                      </div>
                    </Field>
                    <Field label="Before Label">
                      <Input value={config.before_label || "Baking Process"} onChange={(e) => updateSectionConfig(section.id, "before_label", e.target.value)} />
                    </Field>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <Field label="After Image">
                      <div className="flex gap-1">
                        <Input value={config.after_image_url || ""} onChange={(e) => updateSectionConfig(section.id, "after_image_url", e.target.value)} placeholder="Upload or paste URL" />
                        <Button variant="secondary" size="small" onClick={() => openImagePicker("After Image", config.after_image_url, (sel) => updateSectionConfig(section.id, "after_image_url", sel.url))}><ImageIcon className="w-3.5 h-3.5" /></Button>
                      </div>
                    </Field>
                    <Field label="After Label">
                      <Input value={config.after_label || "Finished Creation"} onChange={(e) => updateSectionConfig(section.id, "after_label", e.target.value)} />
                    </Field>
                  </div>
                </div>
              )}

              {/* Primary & Secondary CTAs */}
              <div className="p-3 bg-ui-bg-subtle rounded-xl border border-ui-border-base flex flex-col gap-2.5">
                <Text className="text-xs font-bold text-brand-navy dark:text-brand-gold uppercase">Call To Action Buttons</Text>
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

              {/* Hero Banner Responsive Image Uploader */}
              <CmsImageUploader
                label="Hero Background / Banner Image"
                sectionId={section.id}
                config={config}
                updateConfig={(key, val) => updateSectionConfig(section.id, key, val)}
                openImagePicker={openImagePicker}
                headingFallback={config.headline || section.name || "Hero Banner"}
              />
            </>
          )}

          {/* 2. PRODUCT SECTIONS & PIM INTEGRATION */}
          {(editorType === "product_grid" ||
            editorType === "product_carousel" ||
            editorType === "product_spotlight" ||
            editorType === "comparison_table" ||
            section.type === "product_grid" ||
            section.type === "best_sellers" ||
            section.type === "new_arrivals" ||
            section.type === "featured_cakes" ||
            section.type === "featured_products" ||
            section.type === "trending" ||
            section.type === "trending_products" ||
            section.type === "recommendations" ||
            section.type === "recently_viewed" ||
            section.type === "related_products" ||
            section.type === "quick_shop" ||
            section.type === "birthday_cakes" ||
            section.type === "anniversary_cakes" ||
            section.type === "wedding_cakes" ||
            section.type === "kids_cakes" ||
            section.type === "corporate_cakes" ||
            section.type === "festival_cakes" ||
            section.type === "celebration_cakes" ||
            section.type === "chef_recommendations") && (
            <ProductGridEditor
              config={config}
              allProducts={allProducts}
              allCategories={allCategories}
              allOccasions={allOccasions}
              isCarousel={editorType === "product_carousel" || section.type === "product_carousel"}
              onChange={(k, v) => updateSectionConfig(section.id, k, v)}
            />
          )}

          {/* 3. CATEGORY SECTIONS & EXPLORERS */}
          {(editorType === "category_grid" || editorType === "category_carousel" || editorType === "category_explorer" || section.type === "category_grid") && (
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
              <Field label="Category Display Layout">
                <Select value={config.layout || "grid"} onValueChange={(v) => updateSectionConfig(section.id, "layout", v)}>
                  <Select.Trigger><Select.Value /></Select.Trigger>
                  <Select.Content>
                    <Select.Item value="grid">Grid (Standard)</Select.Item>
                    <Select.Item value="carousel">Carousel (Horizontal Scroll)</Select.Item>
                    <Select.Item value="tiles">Masonry Tiles</Select.Item>
                  </Select.Content>
                </Select>
              </Field>
              {allCategories.length > 0 && (
                <div className="flex flex-col gap-1.5 p-3 bg-ui-bg-subtle rounded-xl border border-ui-border-base">
                  <Text className="text-xs font-bold">Categories Included (Leave empty for all)</Text>
                  <div className="flex flex-wrap gap-1.5 max-h-36 overflow-y-auto">
                    {allCategories.map((c) => {
                      const isSel = (config.category_ids || []).includes(c.id);
                      return (
                        <button
                          key={c.id}
                          type="button"
                          onClick={() => {
                            const cur = config.category_ids || [];
                            const next = isSel ? cur.filter((id: string) => id !== c.id) : [...cur, c.id];
                            updateSectionConfig(section.id, "category_ids", next);
                          }}
                          className={`px-2.5 py-1 rounded-lg text-xs font-semibold border transition-all ${isSel ? "bg-brand-navy text-white border-brand-navy shadow-xs" : "bg-ui-bg-base border-ui-border-base text-ui-fg-base hover:border-brand-gold"}`}
                        >
                          {c.name}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </>
          )}

          {/* 4. OCCASIONS SECTIONS */}
          {(editorType === "occasion_grid" || editorType === "occasion_carousel" || section.type === "occasions_grid" || section.type === "occasion_carousel") && (
            <OccasionsGridEditor
              config={config}
              allOccasions={allOccasions}
              onChange={(k, v) => updateSectionConfig(section.id, k, v)}
            />
          )}

          {/* 5. DEAL / CAMPAIGN / FLASH SALE BANNERS */}
          {(editorType === "deal_banner" || section.type === "campaign_banner" || section.type === "limited_time_offer" || section.type === "flash_sale" || section.type === "coupon_banner") && (
            <>
              <Field label="Offer Heading">
                <Input value={config.heading || ""} onChange={(e) => updateSectionConfig(section.id, "heading", e.target.value)} placeholder="⚡ Limited-Time Weekend Flash Sale" />
              </Field>
              <Field label="Offer Subtitle">
                <Input value={config.subheading || ""} onChange={(e) => updateSectionConfig(section.id, "subheading", e.target.value)} placeholder="Enjoy flat 25% OFF on all gourmet truffle and velvet cakes" />
              </Field>
              <div className="grid grid-cols-2 gap-2">
                <Field label="Coupon Code">
                  <Input value={config.coupon_code || ""} onChange={(e) => updateSectionConfig(section.id, "coupon_code", e.target.value)} placeholder="CELEBRATE25" />
                </Field>
                <Field label="Discount Badge Text">
                  <Input value={config.discount_text || ""} onChange={(e) => updateSectionConfig(section.id, "discount_text", e.target.value)} placeholder="FLAT 25% OFF" />
                </Field>
              </div>
              <div className="p-3 bg-ui-bg-subtle rounded-xl border border-ui-border-base flex flex-col gap-2">
                <div className="flex items-center justify-between">
                  <Text className="text-xs font-bold">Countdown Timer</Text>
                  <Toggle checked={config.show_countdown !== false} onChange={(v) => updateSectionConfig(section.id, "show_countdown", v)} label="Show Countdown" />
                </div>
                {config.show_countdown !== false && (
                  <Field label="Offer Expiry Date (ISO string or datetime)">
                    <Input type="datetime-local" value={config.end_date || ""} onChange={(e) => updateSectionConfig(section.id, "end_date", e.target.value)} />
                  </Field>
                )}
              </div>
              <div className="grid grid-cols-2 gap-2">
                <Field label="CTA Button Text"><Input value={config.cta_text || "Claim Offer"} onChange={(e) => updateSectionConfig(section.id, "cta_text", e.target.value)} /></Field>
                <Field label="CTA Destination URL"><Input value={config.cta_url || "/products"} onChange={(e) => updateSectionConfig(section.id, "cta_url", e.target.value)} /></Field>
              </div>
            </>
          )}

          {/* 6. BRAND STORY / IMAGE + TEXT */}
          {(editorType === "brand_story" || editorType === "image_text" || section.type === "brand_story" || section.type === "image_text" || section.type === "our_bakery" || section.type === "our_kitchen" || section.type === "founder_story" || section.type === "craftsmanship" || section.type === "ingredients" || section.type === "behind_the_scenes" || section.type === "meet_the_bakers") && (
            <>
              <Field label="Badge / Tag"><Input value={config.badge_text || ""} onChange={(e) => updateSectionConfig(section.id, "badge_text", e.target.value)} placeholder="About Our Kitchen" /></Field>
              <Field label="Heading"><Input value={config.heading || ""} onChange={(e) => updateSectionConfig(section.id, "heading", e.target.value)} placeholder="Handcrafted with Pure Ingredients" /></Field>
              <Field label="Body Text"><Textarea value={config.body || ""} onChange={(e) => updateSectionConfig(section.id, "body", e.target.value)} rows={3} /></Field>
              <div className="grid grid-cols-2 gap-2">
                <Field label="CTA Text"><Input value={config.cta_text || ""} onChange={(e) => updateSectionConfig(section.id, "cta_text", e.target.value)} placeholder="Learn More" /></Field>
                <Field label="CTA URL"><Input value={config.cta_url || ""} onChange={(e) => updateSectionConfig(section.id, "cta_url", e.target.value)} placeholder="/products" /></Field>
              </div>
              <Field label="Image Position">
                <Select value={config.image_position || "left"} onValueChange={(v) => updateSectionConfig(section.id, "image_position", v)}>
                  <Select.Trigger><Select.Value /></Select.Trigger>
                  <Select.Content>
                    <Select.Item value="left">Image on Left</Select.Item>
                    <Select.Item value="right">Image on Right</Select.Item>
                  </Select.Content>
                </Select>
              </Field>
              <CmsImageUploader
                label="Story / Showcase Image"
                sectionId={section.id}
                config={config}
                updateConfig={(key, val) => updateSectionConfig(section.id, key, val)}
                openImagePicker={openImagePicker}
                headingFallback={config.heading || section.name || "Kitchen Story"}
              />
            </>
          )}

          {/* 7. FEATURES & BENEFITS & TRUST */}
          {(editorType === "features" || editorType === "trust_badges" || section.type === "features" || section.type === "trust_badges" || section.type === "why_choose_us" || section.type === "certifications" || section.type === "quality_promise" || section.type === "freshness_promise" || section.type === "delivery_promise") && (
            <FeaturesSectionEditor
              config={config}
              onChange={(k, v) => updateSectionConfig(section.id, k, v)}
            />
          )}

          {/* 8. FAQ & ACCORDION */}
          {(editorType === "faq" || section.type === "faq") && (
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

          {/* 9. TESTIMONIALS & REVIEWS */}
          {(editorType === "testimonials" || section.type === "testimonials" || section.type === "reviews") && (
            <>
              <Field label="Heading"><Input value={config.heading || ""} onChange={(e) => updateSectionConfig(section.id, "heading", e.target.value)} placeholder="What Our Customers Say" /></Field>
              <Field label="Subtitle"><Input value={config.subheading || ""} onChange={(e) => updateSectionConfig(section.id, "subheading", e.target.value)} placeholder="Over 50,000+ celebrations sweetened across the city" /></Field>
              <Field label="Reviews Source">
                <Select value={config.source || "manual"} onValueChange={(v) => updateSectionConfig(section.id, "source", v)}>
                  <Select.Trigger><Select.Value /></Select.Trigger>
                  <Select.Content>
                    <Select.Item value="manual">Curated Testimonials</Select.Item>
                    <Select.Item value="reviews">Live Verified Customer Reviews</Select.Item>
                  </Select.Content>
                </Select>
              </Field>
              {config.source !== "reviews" && (
                <div className="flex flex-col gap-2">
                  <Text className="text-xs font-bold">Testimonials ({(config.testimonials || []).length})</Text>
                  {(config.testimonials || []).map((t: any, ti: number) => (
                    <div key={ti} className="p-2.5 bg-ui-bg-subtle rounded-xl flex flex-col gap-1.5 border border-ui-border-base text-xs">
                      <Input value={t.name || ""} onChange={(e) => {
                        const list = [...(config.testimonials || [])];
                        list[ti] = { ...list[ti], name: e.target.value };
                        updateSectionConfig(section.id, "testimonials", list);
                      }} placeholder="Customer Name (e.g. Priya Sharma)" />
                      <Input value={t.occasion || ""} onChange={(e) => {
                        const list = [...(config.testimonials || [])];
                        list[ti] = { ...list[ti], occasion: e.target.value };
                        updateSectionConfig(section.id, "testimonials", list);
                      }} placeholder="Occasion / City (e.g. 1st Birthday • Koramangala)" />
                      <Textarea value={t.quote || ""} onChange={(e) => {
                        const list = [...(config.testimonials || [])];
                        list[ti] = { ...list[ti], quote: e.target.value };
                        updateSectionConfig(section.id, "testimonials", list);
                      }} placeholder="Customer review quote..." rows={2} />
                      <button onClick={() => {
                        const list = (config.testimonials || []).filter((_: any, i: number) => i !== ti);
                        updateSectionConfig(section.id, "testimonials", list);
                      }} className="self-end text-[10px] text-red-500 hover:underline">Remove</button>
                    </div>
                  ))}
                  <Button variant="secondary" size="small" onClick={() => {
                    const list = [...(config.testimonials || []), { name: "", occasion: "", quote: "", rating: 5 }];
                    updateSectionConfig(section.id, "testimonials", list);
                  }}><Plus className="w-3.5 h-3.5 mr-1" /> Add Testimonial</Button>
                </div>
              )}
            </>
          )}

          {/* 10. STATISTICS & NUMBERS */}
          {(editorType === "statistics" || section.type === "statistics" || section.type === "rating_summary") && (
            <>
              <Field label="Heading"><Input value={config.heading || ""} onChange={(e) => updateSectionConfig(section.id, "heading", e.target.value)} placeholder="Our Numbers Speak for Themselves" /></Field>
              <div className="flex flex-col gap-2">
                <Text className="text-xs font-bold">Statistic Counters ({(config.stats || []).length})</Text>
                {(config.stats || []).map((st: any, si: number) => (
                  <div key={si} className="p-2.5 bg-ui-bg-subtle rounded-xl grid grid-cols-2 gap-2 border border-ui-border-base text-xs">
                    <Input value={st.value || ""} onChange={(e) => {
                      const list = [...(config.stats || [])];
                      list[si] = { ...list[si], value: e.target.value };
                      updateSectionConfig(section.id, "stats", list);
                    }} placeholder="Value (e.g. 50,000+)" />
                    <Input value={st.label || ""} onChange={(e) => {
                      const list = [...(config.stats || [])];
                      list[si] = { ...list[si], label: e.target.value };
                      updateSectionConfig(section.id, "stats", list);
                    }} placeholder="Label (e.g. Happy Celebrations)" />
                  </div>
                ))}
                <Button variant="secondary" size="small" onClick={() => {
                  const list = [...(config.stats || []), { value: "100%", label: "Fresh Guarantee" }];
                  updateSectionConfig(section.id, "stats", list);
                }}><Plus className="w-3.5 h-3.5 mr-1" /> Add Statistic</Button>
              </div>
            </>
          )}

          {/* 11. TIMELINE */}
          {(editorType === "timeline" || section.type === "timeline" || section.type === "bakery_timeline") && (
            <>
              <Field label="Timeline Heading"><Input value={config.heading || ""} onChange={(e) => updateSectionConfig(section.id, "heading", e.target.value)} placeholder="Our Journey of Flavor" /></Field>
              <div className="flex flex-col gap-2">
                <Text className="text-xs font-bold">Milestones / Steps ({(config.events || []).length})</Text>
                {(config.events || []).map((ev: any, ei: number) => (
                  <div key={ei} className="p-2.5 bg-ui-bg-subtle rounded-xl flex flex-col gap-1.5 border border-ui-border-base text-xs">
                    <div className="grid grid-cols-2 gap-2">
                      <Input value={ev.year || ""} onChange={(e) => {
                        const list = [...(config.events || [])];
                        list[ei] = { ...list[ei], year: e.target.value };
                        updateSectionConfig(section.id, "events", list);
                      }} placeholder="Year or Step (e.g. 2021)" />
                      <Input value={ev.title || ""} onChange={(e) => {
                        const list = [...(config.events || [])];
                        list[ei] = { ...list[ei], title: e.target.value };
                        updateSectionConfig(section.id, "events", list);
                      }} placeholder="Title (e.g. First Micro-Bakery)" />
                    </div>
                    <Textarea value={ev.desc || ""} onChange={(e) => {
                      const list = [...(config.events || [])];
                      list[ei] = { ...list[ei], desc: e.target.value };
                      updateSectionConfig(section.id, "events", list);
                    }} placeholder="Description..." rows={2} />
                    <button onClick={() => {
                      const list = (config.events || []).filter((_: any, i: number) => i !== ei);
                      updateSectionConfig(section.id, "events", list);
                    }} className="self-end text-[10px] text-red-500 hover:underline">Remove</button>
                  </div>
                ))}
                <Button variant="secondary" size="small" onClick={() => {
                  const list = [...(config.events || []), { year: "2024", title: "Milestone", desc: "" }];
                  updateSectionConfig(section.id, "events", list);
                }}><Plus className="w-3.5 h-3.5 mr-1" /> Add Milestone</Button>
              </div>
            </>
          )}

          {/* 12. GALLERY & VIDEO GALLERY */}
          {(editorType === "gallery" || editorType === "video_gallery" || section.type === "image_gallery" || section.type === "kitchen_gallery") && (
            <>
              <Field label="Gallery Heading"><Input value={config.heading || ""} onChange={(e) => updateSectionConfig(section.id, "heading", e.target.value)} placeholder="Our Fresh Kitchen Creations" /></Field>
              <Field label="Layout Style">
                <Select value={config.layout || "grid"} onValueChange={(v) => updateSectionConfig(section.id, "layout", v)}>
                  <Select.Trigger><Select.Value /></Select.Trigger>
                  <Select.Content>
                    <Select.Item value="grid">Grid</Select.Item>
                    <Select.Item value="masonry">Masonry</Select.Item>
                  </Select.Content>
                </Select>
              </Field>
              <div className="flex flex-col gap-2">
                <Text className="text-xs font-bold">Gallery Images ({(config.images || []).length})</Text>
                {(config.images || []).map((img: any, ii: number) => (
                  <div key={ii} className="p-2.5 bg-ui-bg-subtle rounded-xl grid grid-cols-2 gap-2 border border-ui-border-base text-xs">
                    <div className="flex gap-1">
                      <Input value={typeof img === "string" ? img : img.url || ""} onChange={(e) => {
                        const list = [...(config.images || [])];
                        list[ii] = typeof img === "string" ? e.target.value : { ...img, url: e.target.value };
                        updateSectionConfig(section.id, "images", list);
                      }} placeholder="Upload or paste URL" />
                      <Button variant="secondary" size="small" onClick={() => openImagePicker("Gallery Image", typeof img === "string" ? img : img.url, (sel) => {
                        const list = [...(config.images || [])];
                        list[ii] = typeof img === "string" ? { url: sel.url, caption: "" } : { ...img, url: sel.url };
                        updateSectionConfig(section.id, "images", list);
                      })}><ImageIcon className="w-3.5 h-3.5" /></Button>
                      <Button variant="secondary" size="small" onClick={() => {
                        updateSectionConfig(section.id, "images", (config.images || []).filter((_: any, j: number) => j !== ii));
                      }}><Trash2 className="w-3.5 h-3.5" /></Button>
                    </div>
                    <Input value={typeof img === "object" ? img.caption || "" : ""} onChange={(e) => {
                      const list = [...(config.images || [])];
                      list[ii] = { url: typeof img === "string" ? img : img.url, caption: e.target.value };
                      updateSectionConfig(section.id, "images", list);
                    }} placeholder="Caption" />
                  </div>
                ))}
                <Button variant="secondary" size="small" onClick={() => openImagePicker("Add Gallery Image", "", (sel) => {
                  updateSectionConfig(section.id, "images", [...(config.images || []), { url: sel.url, caption: "" }]);
                })}><Plus className="w-3.5 h-3.5 mr-1" /> Upload Image</Button>
              </div>
            </>
          )}

          {/* 12b. PULL QUOTE */}
          {(editorType === "quote" || section.type === "quote") && (
            <>
              <Field label="Quote Text">
                <Textarea value={config.text || ""} onChange={(e) => updateSectionConfig(section.id, "text", e.target.value)} placeholder="“A birthday without cake is just a meeting...”" rows={3} />
              </Field>
              <div className="grid grid-cols-2 gap-2">
                <Field label="Author Name">
                  <Input value={config.author || ""} onChange={(e) => updateSectionConfig(section.id, "author", e.target.value)} placeholder="Chef Alexandre" />
                </Field>
                <Field label="Author Role / Attribution">
                  <Input value={config.role || ""} onChange={(e) => updateSectionConfig(section.id, "role", e.target.value)} placeholder="Master Patissier, CakeToHome" />
                </Field>
              </div>
            </>
          )}

          {/* 13. LEAD GENERATION FORMS */}
          {(editorType === "contact_form" || editorType === "newsletter" || editorType === "enquiry_form" || section.type === "contact_form" || section.type === "corporate_enquiry" || section.type === "custom_cake_enquiry") && (
            <>
              <Field label="Form Heading"><Input value={config.heading || ""} onChange={(e) => updateSectionConfig(section.id, "heading", e.target.value)} placeholder="Get in Touch with Our Bakers" /></Field>
              <Field label="Form Subtitle"><Input value={config.subheading || ""} onChange={(e) => updateSectionConfig(section.id, "subheading", e.target.value)} placeholder="Have a custom design or corporate order? We respond within 15 minutes." /></Field>
              <Field label="Form Type">
                <Select value={config.form_type || "contact"} onValueChange={(v) => updateSectionConfig(section.id, "form_type", v)}>
                  <Select.Trigger><Select.Value /></Select.Trigger>
                  <Select.Content>
                    <Select.Item value="contact">General Contact Form</Select.Item>
                    <Select.Item value="newsletter">Email Newsletter Subscribe</Select.Item>
                    <Select.Item value="corporate">Corporate Bulk Order Enquiry</Select.Item>
                    <Select.Item value="custom_cake">Custom Cake Design Request</Select.Item>
                    <Select.Item value="callback">Callback Request</Select.Item>
                  </Select.Content>
                </Select>
              </Field>
              <div className="grid grid-cols-2 gap-2">
                <Field label="Submit Button Text"><Input value={config.submit_text || "Submit"} onChange={(e) => updateSectionConfig(section.id, "submit_text", e.target.value)} /></Field>
                <Field label="Success Message"><Input value={config.success_message || "Thank you! We will get back to you shortly."} onChange={(e) => updateSectionConfig(section.id, "success_message", e.target.value)} /></Field>
              </div>
            </>
          )}

          {/* 14. DELIVERY & LOCATION COVERAGE */}
          {(editorType === "delivery_coverage" || editorType === "store_locator" || section.type === "location_coverage") && (
            <>
              <Field label="Badge"><Input value={config.badge || ""} onChange={(e) => updateSectionConfig(section.id, "badge", e.target.value)} placeholder="Coverage Area" /></Field>
              <Field label="Heading"><Input value={config.heading || ""} onChange={(e) => updateSectionConfig(section.id, "heading", e.target.value)} placeholder="📍 We Deliver Fresh Cakes Across Bangalore" /></Field>
              <Field label="Subheading"><Input value={config.subheading || ""} onChange={(e) => updateSectionConfig(section.id, "subheading", e.target.value)} placeholder="Same-day & 2-hour express delivery available" /></Field>
              {editorType === "store_locator" ? (
                <div className="p-3 bg-ui-bg-subtle rounded-xl border border-ui-border-base flex flex-col gap-2">
                  <Text className="text-xs font-bold">Store / Branch Details</Text>
                  <Field label="Address"><Input value={config.address || ""} onChange={(e) => updateSectionConfig(section.id, "address", e.target.value)} placeholder="123 100ft Road, Indiranagar" /></Field>
                  <div className="grid grid-cols-2 gap-2">
                    <Field label="Phone"><Input value={config.phone || ""} onChange={(e) => updateSectionConfig(section.id, "phone", e.target.value)} placeholder="+91 98765 43210" /></Field>
                    <Field label="Hours"><Input value={config.hours || ""} onChange={(e) => updateSectionConfig(section.id, "hours", e.target.value)} placeholder="8 AM - 11 PM Daily" /></Field>
                  </div>
                </div>
              ) : (
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
              )}
            </>
          )}

          {/* 15. CTA SECTION */}
          {(editorType === "cta" || section.type === "cta" || section.type === "shop_now_cta") && (
            <>
              <Field label="Heading"><Input value={config.heading || ""} onChange={(e) => updateSectionConfig(section.id, "heading", e.target.value)} placeholder="Ready to Celebrate?" /></Field>
              <Field label="Subheading"><Input value={config.subheading || ""} onChange={(e) => updateSectionConfig(section.id, "subheading", e.target.value)} placeholder="Order handcrafted cakes baked fresh..." /></Field>
              <Field label="Style Preset / Theme Variant">
                <Select value={config.variant || config.style_preset || config.style || "navy"} onValueChange={(v) => updateSectionConfig(section.id, "variant", v)}>
                  <Select.Trigger><Select.Value /></Select.Trigger>
                  <Select.Content>
                    <Select.Item value="navy">Navy Luxury (Default)</Select.Item>
                    <Select.Item value="cream">Warm Cream Editorial</Select.Item>
                    <Select.Item value="chocolate">Dark Chocolate</Select.Item>
                    <Select.Item value="minimal_gold">Gold-Accent Minimal</Select.Item>
                    <Select.Item value="soft_pink">Soft Pink Accent</Select.Item>
                    <Select.Item value="celebration">Image-Backed Celebration</Select.Item>
                  </Select.Content>
                </Select>
              </Field>
              <div className="grid grid-cols-2 gap-2">
                <Field label="CTA Text"><Input value={config.cta_text || ""} onChange={(e) => updateSectionConfig(section.id, "cta_text", e.target.value)} placeholder="Order Now" /></Field>
                <Field label="CTA URL"><Input value={config.cta_url || ""} onChange={(e) => updateSectionConfig(section.id, "cta_url", e.target.value)} placeholder="/products" /></Field>
              </div>
            </>
          )}

          {/* 16. TEXT / SEO / RICH TEXT */}
          {(editorType === "text_content" || editorType === "seo_content" || editorType === "rich_text" || section.type === "text_content" || section.type === "seo_content" || section.type === "rich_text" || section.type === "location_content" || section.type === "internal_links") && (
            <>
              <Field label="Heading"><Input value={config.heading || ""} onChange={(e) => updateSectionConfig(section.id, "heading", e.target.value)} placeholder="Cake Delivery" /></Field>
              <Field label="Content Body"><Textarea value={config.content || ""} onChange={(e) => updateSectionConfig(section.id, "content", e.target.value)} rows={4} /></Field>
            </>
          )}

          {/* 16b. BLOG & EDITORIAL ARTICLES */}
          {(editorType === "blog_grid" || section.type === "blog_grid" || section.type === "blog_carousel" || section.type === "featured_article") && (
            <>
              <Field label="Blog Heading"><Input value={config.heading || ""} onChange={(e) => updateSectionConfig(section.id, "heading", e.target.value)} placeholder="The Sweet Gazette • Cake Trends & Baking Guides" /></Field>
              <Field label="Subtitle"><Input value={config.subheading || ""} onChange={(e) => updateSectionConfig(section.id, "subheading", e.target.value)} placeholder="Tips, recipes, celebration ideas, and behind-the-scenes bakery stories" /></Field>
              <Field label="Layout Mode">
                <Select value={config.layout || "grid"} onValueChange={(v) => updateSectionConfig(section.id, "layout", v)}>
                  <Select.Trigger><Select.Value /></Select.Trigger>
                  <Select.Content>
                    <Select.Item value="grid">Grid (Standard)</Select.Item>
                    <Select.Item value="carousel">Carousel (Swipeable)</Select.Item>
                  </Select.Content>
                </Select>
              </Field>
            </>
          )}

          {/* 16c. RELATED CONTENT & DISCOVERY */}
          {(editorType === "related_content" || section.type === "related_categories_content" || section.type === "related_products_content") && (
            <>
              <Field label="Heading"><Input value={config.heading || ""} onChange={(e) => updateSectionConfig(section.id, "heading", e.target.value)} placeholder="Explore Related Categories" /></Field>
              <Field label="Max Discovery Links">
                <Input type="number" value={config.limit || 8} onChange={(e) => updateSectionConfig(section.id, "limit", parseInt(e.target.value) || 8)} />
              </Field>
            </>
          )}

          {/* 17. FOOTER & NAVIGATION */}
          {(editorType === "footer" || editorType === "social_links" || editorType === "breadcrumbs" || editorType === "mega_menu" || editorType === "header" || editorType === "internal_links") && (
            <>
              <Field label="Section Title"><Input value={config.heading || config.title || ""} onChange={(e) => updateSectionConfig(section.id, "heading", e.target.value)} placeholder="Navigation / Links" /></Field>
              {editorType === "social_links" && (
                <div className="p-3 bg-ui-bg-subtle rounded-xl border border-ui-border-base flex flex-col gap-2">
                  <Text className="text-xs font-bold">Social Media Handles</Text>
                  <Field label="Instagram"><Input value={config.instagram || ""} onChange={(e) => updateSectionConfig(section.id, "instagram", e.target.value)} placeholder="https://instagram.com/caketohome" /></Field>
                  <Field label="WhatsApp"><Input value={config.whatsapp || ""} onChange={(e) => updateSectionConfig(section.id, "whatsapp", e.target.value)} placeholder="+91 98765 43210" /></Field>
                  <Field label="Facebook"><Input value={config.facebook || ""} onChange={(e) => updateSectionConfig(section.id, "facebook", e.target.value)} placeholder="https://facebook.com/..." /></Field>
                </div>
              )}
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

          {/* Carousel / Horizontal Scroll Mode for Product, Category & Occasion Grids */}
          {(editorType === "product_grid" ||
            editorType === "product_carousel" ||
            editorType === "category_grid" ||
            editorType === "category_carousel" ||
            editorType === "occasion_grid" ||
            editorType === "occasion_carousel" ||
            section.type === "product_grid" ||
            section.type === "best_sellers" ||
            section.type === "new_arrivals" ||
            section.type === "category_grid" ||
            section.type === "occasions_grid") && (
            <div className="p-3 bg-ui-bg-subtle rounded-xl border border-ui-border-base flex flex-col gap-2.5">
              <Text className="text-xs font-bold text-brand-navy dark:text-brand-gold uppercase">Layout & Carousel Controls</Text>
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
            <Text className="text-xs font-bold text-brand-navy dark:text-brand-gold">Active Breakpoint</Text>
            <div className="flex items-center gap-1 bg-ui-bg-base p-0.5 rounded-lg border border-ui-border-base">
              {(["desktop", "tablet", "mobile"] as const).map((d) => (
                <button
                  key={d}
                  onClick={() => setActiveDevice(d)}
                  className={`px-2 py-0.5 text-[10px] font-bold rounded ${activeDevice === d ? "bg-brand-navy text-white shadow-xs" : "text-ui-fg-muted hover:text-ui-fg-base"}`}
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

          {(editorType === "product_grid" ||
            editorType === "product_carousel" ||
            editorType === "category_grid" ||
            editorType === "category_carousel" ||
            editorType === "occasion_grid" ||
            editorType === "occasion_carousel" ||
            section.type === "product_grid" ||
            section.type === "best_sellers" ||
            section.type === "new_arrivals" ||
            section.type === "category_grid" ||
            section.type === "occasions_grid") && (
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
