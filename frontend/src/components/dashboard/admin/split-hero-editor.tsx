"use client";

import React, { useState } from "react";
import { Heading, Text, Input, Label, Textarea, Select, Button, Badge } from "@medusajs/ui";
import {
  Sparkles, Image as ImageIcon, Video, MousePointerClick, Layout,
  Sliders, Smartphone, Palette, ShieldCheck, Clock, Award, Star,
  Plus, Trash2, ArrowUp, ArrowDown, Eye, Layers
} from "lucide-react";

interface SplitHeroEditorProps {
  config: Record<string, any>;
  onChange: (key: string, val: any) => void;
  openImagePicker?: (title: string, current: any, onSelect: (sel: any) => void) => void;
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

export function SplitHeroEditor({ config, onChange, openImagePicker }: SplitHeroEditorProps) {
  const [activeTab, setActiveTab] = useState<"content" | "media" | "layout" | "buttons" | "features">("content");

  const primaryCta = config.primary_cta || {
    text: config.cta_primary_text || config.cta_text || "Explore Cakes",
    url: config.cta_primary_url || config.cta_url || "/products",
    variant: "primary",
    new_tab: false,
  };

  const secondaryCta = config.secondary_cta || {
    text: config.cta_secondary_text || "Express Delivery",
    url: config.cta_secondary_url || "/delivery",
    variant: "secondary",
    new_tab: false,
  };

  const features: any[] = Array.isArray(config.features) ? config.features : [];

  const updatePrimaryCta = (field: string, val: any) => {
    const updated = { ...primaryCta, [field]: val };
    onChange("primary_cta", updated);
    if (field === "text") onChange("cta_primary_text", val);
    if (field === "url") onChange("cta_primary_url", val);
  };

  const updateSecondaryCta = (field: string, val: any) => {
    const updated = { ...secondaryCta, [field]: val };
    onChange("secondary_cta", updated);
    if (field === "text") onChange("cta_secondary_text", val);
    if (field === "url") onChange("cta_secondary_url", val);
  };

  const updateFeature = (index: number, field: string, val: any) => {
    const next = [...features];
    next[index] = { ...next[index], [field]: val };
    onChange("features", next);
  };

  const addFeature = () => {
    if (features.length >= 6) return;
    const newItem = {
      id: `feat_${Date.now()}`,
      icon: "Sparkles",
      title: "100% Fresh Ingredients",
      description: "Baked daily on order with zero preservatives.",
      icon_color: "#e11d48",
      text_color: "",
      is_visible: true,
    };
    onChange("features", [...features, newItem]);
  };

  const removeFeature = (index: number) => {
    const next = features.filter((_, i) => i !== index);
    onChange("features", next);
  };

  return (
    <div className="flex flex-col gap-4">
      {/* Editor Sub-Tabs */}
      <div className="flex items-center gap-1.5 border-b border-ui-border-base pb-2 overflow-x-auto">
        <button
          type="button"
          onClick={() => setActiveTab("content")}
          className={`px-3 py-1 rounded-lg text-xs font-bold transition flex items-center gap-1 ${
            activeTab === "content" ? "bg-rose-600 text-white shadow-sm" : "bg-ui-bg-subtle text-ui-fg-subtle"
          }`}
        >
          <Sparkles className="w-3.5 h-3.5" /> Content
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("media")}
          className={`px-3 py-1 rounded-lg text-xs font-bold transition flex items-center gap-1 ${
            activeTab === "media" ? "bg-rose-600 text-white shadow-sm" : "bg-ui-bg-subtle text-ui-fg-subtle"
          }`}
        >
          <ImageIcon className="w-3.5 h-3.5" /> Media & Video
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("layout")}
          className={`px-3 py-1 rounded-lg text-xs font-bold transition flex items-center gap-1 ${
            activeTab === "layout" ? "bg-rose-600 text-white shadow-sm" : "bg-ui-bg-subtle text-ui-fg-subtle"
          }`}
        >
          <Layout className="w-3.5 h-3.5" /> Layout & Ratios
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("buttons")}
          className={`px-3 py-1 rounded-lg text-xs font-bold transition flex items-center gap-1 ${
            activeTab === "buttons" ? "bg-rose-600 text-white shadow-sm" : "bg-ui-bg-subtle text-ui-fg-subtle"
          }`}
        >
          <MousePointerClick className="w-3.5 h-3.5" /> CTAs
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("features")}
          className={`px-3 py-1 rounded-lg text-xs font-bold transition flex items-center gap-1 ${
            activeTab === "features" ? "bg-rose-600 text-white shadow-sm" : "bg-ui-bg-subtle text-ui-fg-subtle"
          }`}
        >
          <Layers className="w-3.5 h-3.5" /> Feature Bullets ({features.length}/6)
        </button>
      </div>

      {/* 1. Content Settings */}
      {activeTab === "content" && (
        <div className="p-3.5 bg-ui-bg-subtle rounded-2xl border border-ui-border-base flex flex-col gap-3">
          <Text className="text-xs font-bold uppercase tracking-wider text-rose-600 flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5" /> Content & Headlines
          </Text>

          <Field label="Eyebrow Label">
            <Input
              value={config.eyebrow || ""}
              onChange={(e) => onChange("eyebrow", e.target.value)}
              placeholder="Bakery & Confectionery"
            />
          </Field>

          <Field label="Main Headline" hint="High-impact hero title">
            <Input
              value={config.headline || ""}
              onChange={(e) => onChange("headline", e.target.value)}
              placeholder="Baked Fresh Daily With Pure Ingredients"
            />
          </Field>

          <Field label="Subheadline">
            <Input
              value={config.subheadline || ""}
              onChange={(e) => onChange("subheadline", e.target.value)}
              placeholder="Handcrafted cakes, croissants, and celebratory bakes."
            />
          </Field>

          <Field label="Longer Description Paragraph">
            <Textarea
              value={config.description || config.body || ""}
              onChange={(e) => {
                onChange("description", e.target.value);
                onChange("body", e.target.value);
              }}
              placeholder="Every celebration deserves a showstopper. Choose from our curated collection..."
              rows={2}
            />
          </Field>

          <Field label="Trust Badge Pill Text">
            <Input
              value={config.badge_text || config.badge || ""}
              onChange={(e) => onChange("badge_text", e.target.value)}
              placeholder="Freshly Baked Daily"
            />
          </Field>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
            <Field label="Floating Trust Text">
              <Input
                value={config.trust_text || ""}
                onChange={(e) => onChange("trust_text", e.target.value)}
                placeholder="Baked Fresh on Order"
              />
            </Field>
            <Field label="Floating Rating Text">
              <Input
                value={config.rating_text || ""}
                onChange={(e) => onChange("rating_text", e.target.value)}
                placeholder="★ 4.9 (1.2k+ reviews)"
              />
            </Field>
            <Field label="Delivery Text">
              <Input
                value={config.delivery_text || ""}
                onChange={(e) => onChange("delivery_text", e.target.value)}
                placeholder="2-Hour Express Delivery"
              />
            </Field>
          </div>
        </div>
      )}

      {/* 2. Media Settings */}
      {activeTab === "media" && (
        <div className="p-3.5 bg-ui-bg-subtle rounded-2xl border border-ui-border-base flex flex-col gap-3">
          <Text className="text-xs font-bold uppercase tracking-wider text-brand-primary flex items-center gap-1.5">
            <ImageIcon className="w-3.5 h-3.5" /> Media & Video
          </Text>

          <Field label="Desktop Hero Image URL">
            <Input
              value={config.desktop_image || config.image_url || ""}
              onChange={(e) => {
                onChange("desktop_image", e.target.value);
                onChange("image_url", e.target.value);
              }}
              placeholder="Upload an image (stored in S3)"
            />
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Tablet Image (Optional)">
              <Input
                value={config.tablet_image || ""}
                onChange={(e) => onChange("tablet_image", e.target.value)}
                placeholder="https://..."
              />
            </Field>
            <Field label="Mobile Image (Optional)">
              <Input
                value={config.mobile_image || ""}
                onChange={(e) => onChange("mobile_image", e.target.value)}
                placeholder="https://..."
              />
            </Field>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Video URL (Optional MP4/WebM)">
              <Input
                value={config.video_url || ""}
                onChange={(e) => onChange("video_url", e.target.value)}
                placeholder="https://assets.mixkit.co/videos/..."
              />
            </Field>
            <Field label="Video Poster Image URL">
              <Input
                value={config.poster_image || ""}
                onChange={(e) => onChange("poster_image", e.target.value)}
                placeholder="https://..."
              />
            </Field>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Image Fit">
              <Select value={config.object_fit || "cover"} onValueChange={(v) => onChange("object_fit", v)}>
                <Select.Trigger><Select.Value /></Select.Trigger>
                <Select.Content>
                  <Select.Item value="cover">Cover (Fill Container)</Select.Item>
                  <Select.Item value="contain">Contain (Show Whole Image)</Select.Item>
                </Select.Content>
              </Select>
            </Field>
            <Field label="Image Position / Focal Point">
              <Select value={config.image_position || "center"} onValueChange={(v) => onChange("image_position", v)}>
                <Select.Trigger><Select.Value /></Select.Trigger>
                <Select.Content>
                  <Select.Item value="center">Center</Select.Item>
                  <Select.Item value="top">Top</Select.Item>
                  <Select.Item value="bottom">Bottom</Select.Item>
                  <Select.Item value="left">Left</Select.Item>
                  <Select.Item value="right">Right</Select.Item>
                </Select.Content>
              </Select>
            </Field>
          </div>

          <Field label="Image Alt Description">
            <Input
              value={config.image_alt || ""}
              onChange={(e) => onChange("image_alt", e.target.value)}
              placeholder="Gourmet handcrafted celebration cake"
            />
          </Field>
        </div>
      )}

      {/* 3. Layout & Column Ratios */}
      {activeTab === "layout" && (
        <div className="p-3.5 bg-ui-bg-subtle rounded-2xl border border-ui-border-base flex flex-col gap-3">
          <Text className="text-xs font-bold uppercase tracking-wider text-blue-600 flex items-center gap-1.5">
            <Layout className="w-3.5 h-3.5" /> Layout & Split Ratios
          </Text>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Content Alignment">
              <Select
                value={config.content_position || config.media_position || "left"}
                onValueChange={(v) => {
                  onChange("content_position", v);
                  onChange("media_position", v === "left" ? "right" : "left");
                }}
              >
                <Select.Trigger><Select.Value /></Select.Trigger>
                <Select.Content>
                  <Select.Item value="left">Content Left, Media Right</Select.Item>
                  <Select.Item value="right">Media Left, Content Right</Select.Item>
                </Select.Content>
              </Select>
            </Field>

            <Field label="Column Split Ratio">
              <Select value={config.ratio || "50_50"} onValueChange={(v) => onChange("ratio", v)}>
                <Select.Trigger><Select.Value /></Select.Trigger>
                <Select.Content>
                  <Select.Item value="50_50">50% Content / 50% Media</Select.Item>
                  <Select.Item value="40_60">40% Content / 60% Media</Select.Item>
                  <Select.Item value="60_40">60% Content / 40% Media</Select.Item>
                  <Select.Item value="30_70">30% Content / 70% Media</Select.Item>
                  <Select.Item value="70_30">70% Content / 30% Media</Select.Item>
                </Select.Content>
              </Select>
            </Field>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Mobile Responsive Stack Order">
              <Select value={config.mobile_stack_order || "image_first"} onValueChange={(v) => onChange("mobile_stack_order", v)}>
                <Select.Trigger><Select.Value /></Select.Trigger>
                <Select.Content>
                  <Select.Item value="image_first">Image on Top, Content Below</Select.Item>
                  <Select.Item value="content_first">Content on Top, Image Below</Select.Item>
                </Select.Content>
              </Select>
            </Field>

            <Field label="Section Height">
              <Select value={config.height || "medium"} onValueChange={(v) => onChange("height", v)}>
                <Select.Trigger><Select.Value /></Select.Trigger>
                <Select.Content>
                  <Select.Item value="auto">Auto Content</Select.Item>
                  <Select.Item value="small">Compact (400px)</Select.Item>
                  <Select.Item value="medium">Standard (550px)</Select.Item>
                  <Select.Item value="large">Large (700px)</Select.Item>
                  <Select.Item value="full">Full Viewport (100vh)</Select.Item>
                </Select.Content>
              </Select>
            </Field>
          </div>
        </div>
      )}

      {/* 4. Action Buttons (Primary & Secondary CTAs) */}
      {activeTab === "buttons" && (
        <div className="p-3.5 bg-ui-bg-subtle rounded-2xl border border-ui-border-base flex flex-col gap-3">
          <Text className="text-xs font-bold uppercase tracking-wider text-emerald-600 flex items-center gap-1.5">
            <MousePointerClick className="w-3.5 h-3.5" /> Call-To-Action Buttons
          </Text>

          {/* Primary CTA */}
          <div className="p-3 bg-ui-bg-base rounded-xl border border-ui-border-base flex flex-col gap-2.5">
            <Text className="text-xs font-bold text-rose-600">Primary CTA Button</Text>
            <div className="grid grid-cols-2 gap-2">
              <Field label="Button Text">
                <Input
                  value={primaryCta.text || ""}
                  onChange={(e) => updatePrimaryCta("text", e.target.value)}
                  placeholder="Shop All Cakes"
                />
              </Field>
              <Field label="Button Link URL">
                <Input
                  value={primaryCta.url || ""}
                  onChange={(e) => updatePrimaryCta("url", e.target.value)}
                  placeholder="/products"
                />
              </Field>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs text-ui-fg-muted">Open in New Tab</span>
              <input
                type="checkbox"
                checked={primaryCta.new_tab === true}
                onChange={(e) => updatePrimaryCta("new_tab", e.target.checked)}
                className="rounded border-ui-border-base text-rose-600 focus:ring-rose-500"
              />
            </div>
          </div>

          {/* Secondary CTA */}
          <div className="p-3 bg-ui-bg-base rounded-xl border border-ui-border-base flex flex-col gap-2.5">
            <Text className="text-xs font-bold text-ui-fg-base">Secondary CTA Button</Text>
            <div className="grid grid-cols-2 gap-2">
              <Field label="Button Text">
                <Input
                  value={secondaryCta.text || ""}
                  onChange={(e) => updateSecondaryCta("text", e.target.value)}
                  placeholder="Express Delivery"
                />
              </Field>
              <Field label="Button Link URL">
                <Input
                  value={secondaryCta.url || ""}
                  onChange={(e) => updateSecondaryCta("url", e.target.value)}
                  placeholder="/delivery"
                />
              </Field>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs text-ui-fg-muted">Open in New Tab</span>
              <input
                type="checkbox"
                checked={secondaryCta.new_tab === true}
                onChange={(e) => updateSecondaryCta("new_tab", e.target.checked)}
                className="rounded border-ui-border-base text-rose-600 focus:ring-rose-500"
              />
            </div>
          </div>
        </div>
      )}

      {/* 5. Embedded Feature Bullets Repeater */}
      {activeTab === "features" && (
        <div className="p-3.5 bg-ui-bg-subtle rounded-2xl border border-ui-border-base flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <div>
              <Text className="text-xs font-bold uppercase tracking-wider text-rose-600 flex items-center gap-1.5">
                <Layers className="w-3.5 h-3.5" /> Feature Bullets (1–6 Items)
              </Text>
              <Text className="text-[11px] text-ui-fg-muted">
                Highlights shown directly underneath the Split Hero headline.
              </Text>
            </div>
            {features.length < 6 && (
              <Button size="small" variant="secondary" onClick={addFeature} className="text-xs">
                <Plus className="w-3.5 h-3.5" /> Add Feature
              </Button>
            )}
          </div>

          {features.length === 0 ? (
            <div className="text-center py-6 text-ui-fg-subtle border border-dashed border-ui-border-base rounded-xl">
              <Sparkles className="w-6 h-6 mx-auto mb-1 opacity-30 text-rose-500" />
              <p className="text-xs font-medium">No embedded features configured.</p>
              <p className="text-[10px] text-ui-fg-muted">Click "+ Add Feature" to highlight up to 6 bakery guarantees.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {features.map((feat, idx) => (
                <div key={feat.id || idx} className="p-3 bg-ui-bg-base rounded-xl border border-ui-border-base space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-rose-600">Feature #{idx + 1}</span>
                    <button
                      type="button"
                      onClick={() => removeFeature(idx)}
                      className="text-ui-fg-muted hover:text-rose-600 text-xs"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <div>
                      <Label className="text-[11px]">Title</Label>
                      <Input
                        value={feat.title || ""}
                        onChange={(e) => updateFeature(idx, "title", e.target.value)}
                        placeholder="100% Real Dairy Butter"
                        className="text-xs mt-0.5"
                      />
                    </div>
                    <div>
                      <Label className="text-[11px]">Description</Label>
                      <Input
                        value={feat.description || ""}
                        onChange={(e) => updateFeature(idx, "description", e.target.value)}
                        placeholder="Baked fresh on order"
                        className="text-xs mt-0.5"
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
