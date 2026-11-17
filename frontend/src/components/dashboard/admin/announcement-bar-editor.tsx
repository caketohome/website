"use client";

import React, { useState } from "react";
import {
  Text,
  Input,
  Label,
  Textarea,
  Select,
} from "@medusajs/ui";
import {
  Megaphone,
  Palette,
  Layout,
  Type,
  MousePointerClick,
  Sliders,
  Maximize2,
  Tag,
  ExternalLink,
  Calendar,
  PlayCircle,
  Database,
  CheckCircle2,
  Sparkles,
  RefreshCw,
  AlertCircle,
} from "lucide-react";
import { AnnouncementBarConfig } from "../../store/cms/announcement-bar-section";

interface AnnouncementBarEditorProps {
  config: AnnouncementBarConfig;
  onChange: (updatedConfig: AnnouncementBarConfig) => void;
}

function Field({
  label,
  hint,
  children,
}: {
  label: string | React.ReactNode;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label className="text-xs font-semibold text-ui-fg-base">{label}</Label>
      {children}
      {hint && <p className="text-[11px] text-ui-fg-muted">{hint}</p>}
    </div>
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

function Toggle({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors focus:outline-none ${
        checked ? "bg-rose-500" : "bg-ui-bg-component border border-ui-border-base"
      }`}
      aria-label={label}
    >
      <span
        className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform shadow ${
          checked ? "translate-x-4" : "translate-x-0.5"
        }`}
      />
    </button>
  );
}

type EditorTab = "general" | "content" | "action" | "marquee" | "design" | "dimensions" | "spacing" | "typography" | "behavior" | "schedule";

const BRAND_PRESETS = [
  {
    id: "espresso_gold",
    name: "Espresso & Gold",
    desc: "Luxury deep obsidian with honey gold accents & champagne badge",
    config: {
      bg_mode: "solid" as const,
      bg_color: "#172033",
      text_color: "#FFFFFF",
      accent_color: "#F59E0B",
      badge_bg: "rgba(217, 119, 6, 0.25)",
      badge_text_color: "#F5E8CC",
      coupon_bg: "rgba(255, 255, 255, 0.15)",
      coupon_text_color: "#F5E8CC",
      coupon_border_color: "rgba(245, 158, 11, 0.4)",
      cta_bg_color: "#D97706",
      cta_text_color: "#172033",
      cta_hover_bg: "#B45309",
      cta_hover_text: "#FFFFFF",
    },
  },
  {
    id: "artisan_ruby",
    name: "Artisan Ruby & Honey",
    desc: "Warm berry wine gradient with honey gold CTA",
    config: {
      bg_mode: "gradient" as const,
      gradient_start: "#881337",
      gradient_end: "#4C0519",
      gradient_direction: "90deg",
      text_color: "#FFFBEB",
      accent_color: "#F5E8CC",
      badge_bg: "rgba(245, 158, 11, 0.3)",
      badge_text_color: "#F5E8CC",
      coupon_bg: "#FFFFFF",
      coupon_text_color: "#881337",
      coupon_border_color: "rgba(255, 255, 255, 0.5)",
      cta_bg_color: "#F59E0B",
      cta_text_color: "#4C0519",
      cta_hover_bg: "#D97706",
      cta_hover_text: "#FFFFFF",
    },
  },
  {
    id: "vanilla_cream",
    name: "Vanilla Cream & Warm Bronze",
    desc: "Gentle bakery morning cream with roasted bronze text",
    config: {
      bg_mode: "solid" as const,
      bg_color: "#FFFBEB",
      text_color: "#1E293B",
      accent_color: "#D97706",
      badge_bg: "rgba(217, 119, 6, 0.15)",
      badge_text_color: "#B45309",
      coupon_bg: "#FFFFFF",
      coupon_text_color: "#172033",
      coupon_border_color: "#E5E7EB",
      cta_bg_color: "#172033",
      cta_text_color: "#FFFFFF",
      cta_hover_bg: "#1E293B",
      cta_hover_text: "#F5E8CC",
    },
  },
  {
    id: "forest_emerald",
    name: "Forest Emerald & Champagne",
    desc: "Festive celebration deep green & champagne gold",
    config: {
      bg_mode: "solid" as const,
      bg_color: "#064E3B",
      text_color: "#ECFDF5",
      accent_color: "#F5E8CC",
      badge_bg: "rgba(253, 230, 138, 0.2)",
      badge_text_color: "#F5E8CC",
      coupon_bg: "rgba(255, 255, 255, 0.15)",
      coupon_text_color: "#F5E8CC",
      coupon_border_color: "rgba(253, 230, 138, 0.3)",
      cta_bg_color: "#F5E8CC",
      cta_text_color: "#064E3B",
      cta_hover_bg: "#FCD34D",
      cta_hover_text: "#064E3B",
    },
  },
];

export function AnnouncementBarEditor({ config, onChange }: AnnouncementBarEditorProps) {
  const [activeTab, setActiveTab] = useState<EditorTab>("general");
  const [availableOffers, setAvailableOffers] = useState<any[]>([]);
  const [loadingOffers, setLoadingOffers] = useState(false);
  const [syncSuccessMsg, setSyncSuccessMsg] = useState<string | null>(null);

  React.useEffect(() => {
    let isMounted = true;
    setLoadingOffers(true);
    fetch("/api/v1/admin/offers")
      .then((r) => r.json())
      .then((data) => {
        if (!isMounted) return;
        setAvailableOffers(data?.offers || []);
      })
      .catch(() => {
        fetch("/api/v1/offers")
          .then((r) => r.json())
          .then((data) => {
            if (!isMounted) return;
            setAvailableOffers(data?.offers || []);
          })
          .catch(() => {});
      })
      .finally(() => {
        if (isMounted) setLoadingOffers(false);
      });
    return () => {
      isMounted = false;
    };
  }, []);

  const linkedOffer = availableOffers.find(
    (o) => config.coupon_code && o.code && o.code.toUpperCase() === config.coupon_code.toUpperCase()
  );

  const handleSelectOffer = (codeOrId: string) => {
    const selected = availableOffers.find((o) => o.code === codeOrId || o.id === codeOrId);
    if (!selected) return;

    const discVal = Number(selected.discount_value ?? selected.metadata?.discount_value ?? 0);
    const minOrder = Number(selected.min_order_value ?? selected.min_order ?? 0);
    const maxDisc = selected.max_discount_value ? Number(selected.max_discount_value) : null;

    let headline = selected.name || `Special Offer — ${selected.code}`;
    let badge = selected.type === "percentage" ? `${discVal}% OFF` : selected.type === "flat" ? `₹${discVal} OFF` : "FREE DELIVERY";
    let scrolling = `${selected.name} — Use code ${selected.code} at checkout!`;
    if (minOrder > 0) scrolling += ` Min order ₹${minOrder}.`;

    onChange({
      ...config,
      coupon_code: selected.code,
      badge_text: badge,
      text: headline,
      scrolling_text: scrolling,
      cta_url: `/products?promo=${selected.code}`,
      action_enabled: true,
      action_type: config.action_type === "none" ? "copy_coupon" : config.action_type || "copy_coupon",
    });

    setSyncSuccessMsg(`Announcement synchronized with Marketing Offer: ${selected.code}`);
    setTimeout(() => setSyncSuccessMsg(null), 3500);
  };

  const updateProp = (key: keyof AnnouncementBarConfig, val: any) => {
    onChange({ ...config, [key]: val });
  };

  const updateScheduleProp = (key: string, val: any) => {
    onChange({
      ...config,
      schedule: { ...(config.schedule || {}), [key]: val },
    });
  };

  const displayMode = config.display_mode || "static";
  const actionEnabled = config.action_enabled !== false;
  const actionType = config.action_type || "none";

  const tabs: { id: EditorTab; label: string; icon: any }[] = [
    { id: "general", label: "General", icon: Megaphone },
    { id: "content", label: "Content", icon: Type },
    { id: "action", label: "Action", icon: MousePointerClick },
    ...(displayMode === "marquee" ? [{ id: "marquee" as EditorTab, label: "Marquee", icon: PlayCircle }] : []),
    { id: "design", label: "Design", icon: Palette },
    { id: "dimensions", label: "Size", icon: Maximize2 },
    { id: "spacing", label: "Spacing", icon: Layout },
    { id: "typography", label: "Type", icon: Type },
    { id: "behavior", label: "Position", icon: Sliders },
    { id: "schedule", label: "Schedule", icon: Calendar },
  ];

  return (
    <div className="flex flex-col gap-3">
      {/* HEADER */}
      <div className="p-3 bg-gradient-to-r from-rose-500/10 via-brand-gold/10 to-brand-gold/10 rounded-xl border border-rose-200/50 dark:border-rose-900/30 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Megaphone className="w-4 h-4 text-rose-600" />
          <div>
            <Text className="text-xs font-bold text-ui-fg-base">Full-Width Announcement Bar</Text>
            <Text className="text-[10px] text-ui-fg-muted">Edge-to-edge promotional bar & coupon actions</Text>
          </div>
        </div>
        <Toggle
          checked={config.enabled !== false}
          onChange={(v) => updateProp("enabled", v)}
          label="Enable Announcement Bar"
        />
      </div>

      {/* TAB BAR */}
      <div className="flex items-center gap-1 overflow-x-auto pb-1 border-b border-ui-border-base scrollbar-none text-xs">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
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
      {/* 1. GENERAL TAB */}
      {/* ═══════════════════════════════════════════════════════════ */}
      {activeTab === "general" && (
        <div className="flex flex-col gap-3">
          {/* Master Enable */}
          <div className="p-3 bg-ui-bg-subtle rounded-xl border border-ui-border-base flex items-center justify-between">
            <div>
              <Text className="text-xs font-bold">Announcement Bar</Text>
              <Text className="text-[10px] text-ui-fg-muted">Show/hide on live storefront</Text>
            </div>
            <Toggle
              checked={config.enabled !== false}
              onChange={(v) => updateProp("enabled", v)}
              label="Enable announcement"
            />
          </div>

          {/* Display Mode */}
          <Field label="Display Mode" hint="Static shows fixed text. Marquee scrolls continuously.">
            <Select
              value={displayMode}
              onValueChange={(v) => updateProp("display_mode", v as any)}
            >
              <Select.Trigger>
                <Select.Value />
              </Select.Trigger>
              <Select.Content>
                <Select.Item value="static">Static Text</Select.Item>
                <Select.Item value="marquee">Scrolling Marquee</Select.Item>
              </Select.Content>
            </Select>
          </Field>

          {/* Icon / Emoji */}
          <div className="grid grid-cols-2 gap-2">
            <Field label="Icon / Emoji" hint="Leading icon (e.g. ⚡, 🎂, 🎉)">
              <Input
                value={config.icon || ""}
                onChange={(e) => updateProp("icon", e.target.value)}
                placeholder="⚡"
              />
            </Field>
            <Field label="Badge Text" hint="E.g. LIMITED TIME, FLASH SALE">
              <Input
                value={config.badge_text || ""}
                onChange={(e) => updateProp("badge_text", e.target.value)}
                placeholder="LIMITED TIME"
              />
            </Field>
          </div>

          {config.badge_text && (
            <div className="grid grid-cols-2 gap-2 p-2 bg-ui-bg-subtle rounded-xl border border-ui-border-base">
              <ColorInput label="Badge BG" value={config.badge_bg} onChange={(v) => updateProp("badge_bg", v)} fallback="rgba(255,255,255,0.2)" />
              <ColorInput label="Badge Text" value={config.badge_text_color} onChange={(v) => updateProp("badge_text_color", v)} fallback="#FFFFFF" />
            </div>
          )}
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════ */}
      {/* 2. CONTENT TAB */}
      {/* ═══════════════════════════════════════════════════════════ */}
      {activeTab === "content" && (
        <div className="flex flex-col gap-3">
          {/* Synchronize with Marketing Offers */}
          <div className="p-3 bg-gradient-to-r from-brand-gold/10 via-rose-500/10 to-brand-gold/10 rounded-xl border border-brand-gold/60 dark:border-brand-gold-dark/40 flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5 text-xs font-bold text-brand-gold-dark dark:text-brand-gold">
                <Database className="w-3.5 h-3.5" />
                <span>Link to Marketing Offer (PostgreSQL)</span>
              </div>
              <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 border border-emerald-300/40 flex items-center gap-1">
                <CheckCircle2 className="w-2.5 h-2.5" /> Live Backend
              </span>
            </div>
            <p className="text-[11px] text-ui-fg-muted">
              Select an offer from Admin Panel → Marketing → Offers to auto-populate the announcement headline and coupon code.
            </p>
            {loadingOffers ? (
              <div className="text-xs text-ui-fg-muted flex items-center gap-1.5 py-1">
                <RefreshCw className="w-3 h-3 animate-spin" /> Loading PostgreSQL offers...
              </div>
            ) : availableOffers.length > 0 ? (
              <div className="flex flex-col gap-1.5">
                <Select
                  value={linkedOffer?.code || ""}
                  onValueChange={(val) => handleSelectOffer(val)}
                >
                  <Select.Trigger className="text-xs font-medium">
                    <Select.Value placeholder="Select a marketing offer to sync..." />
                  </Select.Trigger>
                  <Select.Content>
                    {availableOffers.map((off) => (
                      <Select.Item key={off.id || off.code} value={off.code || off.id}>
                        {off.code} — {off.name} ({off.type === "percentage" ? `${off.discount_value}% OFF` : `₹${off.discount_value} OFF`})
                      </Select.Item>
                    ))}
                  </Select.Content>
                </Select>
                {linkedOffer && (
                  <div className="p-2 rounded-lg bg-ui-bg-base border border-brand-gold/50 dark:border-brand-gold-dark/50 flex flex-col gap-1 text-[11px]">
                    <div className="flex items-center justify-between font-bold text-ui-fg-base">
                      <span>{linkedOffer.name}</span>
                      <span className="font-mono text-brand-gold-dark dark:text-brand-gold font-black">{linkedOffer.code}</span>
                    </div>
                    <div className="flex items-center gap-3 text-ui-fg-muted">
                      <span>Min Order: ₹{linkedOffer.min_order_value || 0}</span>
                      {linkedOffer.max_discount_value && <span>Max Cap: ₹{linkedOffer.max_discount_value}</span>}
                      <span>Status: <strong className="text-emerald-600 uppercase">{linkedOffer.status}</strong></span>
                    </div>
                  </div>
                )}
                {syncSuccessMsg && (
                  <p className="text-[11px] font-bold text-emerald-600 flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3" /> {syncSuccessMsg}
                  </p>
                )}
              </div>
            ) : (
              <p className="text-[11px] text-ui-fg-muted italic">No active marketing offers found in database.</p>
            )}
          </div>

          <Field label="Static Announcement Text" hint="Shown when display mode is 'Static'">
            <Textarea
              value={config.text || ""}
              onChange={(e) => updateProp("text", e.target.value)}
              placeholder="⚡ Monsoon Special — 50% OFF Up to ₹150 on All Cakes"
              rows={2}
            />
          </Field>

          <Field label="Scrolling / Marquee Text" hint="Shown when display mode is 'Marquee'. If empty, falls back to static text.">
            <Textarea
              value={config.scrolling_text || ""}
              onChange={(e) => updateProp("scrolling_text", e.target.value)}
              placeholder="🎂 Free Same Day Delivery Across Bangalore — Order Now!"
              rows={2}
            />
          </Field>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════ */}
      {/* 3. ACTION TAB */}
      {/* ═══════════════════════════════════════════════════════════ */}
      {activeTab === "action" && (
        <div className="flex flex-col gap-3">
          {/* Action Master Toggle */}
          <div className="p-3 bg-ui-bg-subtle rounded-xl border border-ui-border-base flex items-center justify-between">
            <div>
              <Text className="text-xs font-bold">CTA / Action</Text>
              <Text className="text-[10px] text-ui-fg-muted">Enable or disable all action buttons</Text>
            </div>
            <Toggle
              checked={actionEnabled}
              onChange={(v) => updateProp("action_enabled", v)}
              label="Enable actions"
            />
          </div>

          {actionEnabled && (
            <>
              <Field label="Action Type" hint="Controls customer interactivity">
                <Select
                  value={actionType}
                  onValueChange={(v) => updateProp("action_type", v as any)}
                >
                  <Select.Trigger>
                    <Select.Value />
                  </Select.Trigger>
                  <Select.Content>
                    <Select.Item value="none">None (Message Only)</Select.Item>
                    <Select.Item value="copy_coupon">Copy Coupon Code</Select.Item>
                    <Select.Item value="open_link">Open Link (CTA Navigation)</Select.Item>
                    <Select.Item value="copy_and_link">Copy Coupon + Open Link (Both)</Select.Item>
                  </Select.Content>
                </Select>
              </Field>

              {/* Coupon Fields */}
              {(actionType === "copy_coupon" || actionType === "copy_and_link") && (
                <div className="p-3 bg-ui-bg-subtle rounded-xl border border-ui-border-base flex flex-col gap-2.5">
                  <Text className="text-xs font-bold text-rose-600 uppercase flex items-center gap-1">
                    <Tag className="w-3.5 h-3.5" /> Coupon Configuration
                  </Text>
                  <div className="grid grid-cols-2 gap-2">
                    <Field label="Coupon Code">
                      <Input
                        value={config.coupon_code || ""}
                        onChange={(e) => updateProp("coupon_code", e.target.value.toUpperCase())}
                        placeholder="CAKE50"
                      />
                    </Field>
                    <Field label="Copy Button Text">
                      <Input value={config.copy_button_text || "Copy Code"} onChange={(e) => updateProp("copy_button_text", e.target.value)} />
                    </Field>
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    <Field label="Success Text">
                      <Input value={config.copy_success_text || "Copied!"} onChange={(e) => updateProp("copy_success_text", e.target.value)} />
                    </Field>
                    <ColorInput label="Pill BG" value={config.coupon_bg} onChange={(v) => updateProp("coupon_bg", v)} fallback="rgba(255,255,255,0.15)" />
                    <ColorInput label="Pill Text" value={config.coupon_text_color} onChange={(v) => updateProp("coupon_text_color", v)} fallback="#F5E8CC" />
                  </div>
                </div>
              )}

              {/* Link CTA Fields */}
              {(actionType === "open_link" || actionType === "copy_and_link") && (
                <div className="p-3 bg-ui-bg-subtle rounded-xl border border-ui-border-base flex flex-col gap-2.5">
                  <Text className="text-xs font-bold text-brand-gold-dark dark:text-brand-gold uppercase flex items-center gap-1">
                    <ExternalLink className="w-3.5 h-3.5" /> Link Configuration
                  </Text>
                  <div className="grid grid-cols-2 gap-2">
                    <Field label="CTA Button Text">
                      <Input value={config.cta_text || ""} onChange={(e) => updateProp("cta_text", e.target.value)} placeholder="Shop Now" />
                    </Field>
                    <Field label="CTA URL">
                      <Input value={config.cta_url || ""} onChange={(e) => updateProp("cta_url", e.target.value)} placeholder="/products" />
                    </Field>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <ColorInput label="CTA BG" value={config.cta_bg_color} onChange={(v) => updateProp("cta_bg_color", v)} fallback="#D97706" />
                    <ColorInput label="CTA Text" value={config.cta_text_color} onChange={(v) => updateProp("cta_text_color", v)} fallback="#172033" />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <ColorInput label="CTA Hover BG" value={config.cta_hover_bg} onChange={(v) => updateProp("cta_hover_bg", v)} fallback="#B45309" />
                    <ColorInput label="CTA Hover Text" value={config.cta_hover_text} onChange={(v) => updateProp("cta_hover_text", v)} fallback="#FFFFFF" />
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════ */}
      {/* 4. MARQUEE TAB (only visible when display_mode = marquee) */}
      {/* ═══════════════════════════════════════════════════════════ */}
      {activeTab === "marquee" && displayMode === "marquee" && (
        <div className="flex flex-col gap-3">
          <Field label="Scroll Speed">
            <Select
              value={config.scroll_speed || "normal"}
              onValueChange={(v) => updateProp("scroll_speed", v as any)}
            >
              <Select.Trigger>
                <Select.Value />
              </Select.Trigger>
              <Select.Content>
                <Select.Item value="slow">Slow (~30s)</Select.Item>
                <Select.Item value="normal">Normal (~20s)</Select.Item>
                <Select.Item value="fast">Fast (~10s)</Select.Item>
                <Select.Item value="custom">Custom Duration</Select.Item>
              </Select.Content>
            </Select>
          </Field>

          {config.scroll_speed === "custom" && (
            <Field label="Custom Duration (seconds)" hint="Time for one full scroll cycle">
              <Input
                type="number"
                value={config.scroll_speed_duration ?? 20}
                onChange={(e) => updateProp("scroll_speed_duration", parseInt(e.target.value) || 20)}
                min={3}
                max={120}
              />
            </Field>
          )}

          <Field label="Scroll Direction">
            <Select
              value={config.scroll_direction || "left"}
              onValueChange={(v) => updateProp("scroll_direction", v as any)}
            >
              <Select.Trigger>
                <Select.Value />
              </Select.Trigger>
              <Select.Content>
                <Select.Item value="left">Left ←</Select.Item>
                <Select.Item value="right">Right →</Select.Item>
              </Select.Content>
            </Select>
          </Field>

          <div className="p-3 bg-ui-bg-subtle rounded-xl border border-ui-border-base flex items-center justify-between">
            <div>
              <Text className="text-xs font-bold">Pause on Hover</Text>
              <Text className="text-[10px] text-ui-fg-muted">Stop scrolling when customer hovers</Text>
            </div>
            <Toggle
              checked={config.pause_on_hover !== false}
              onChange={(v) => updateProp("pause_on_hover", v)}
              label="Pause on hover"
            />
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════ */}
      {/* 5. DESIGN TAB */}
      {/* ═══════════════════════════════════════════════════════════ */}
      {activeTab === "design" && (
        <div className="flex flex-col gap-3">
          {/* Brand Presets */}
          <div className="flex flex-col gap-2 p-3 bg-gradient-to-r from-brand-gold/10 via-rose-500/10 to-brand-gold/10 rounded-xl border border-brand-gold/60 dark:border-brand-gold-dark/40">
            <div className="flex items-center gap-1.5 text-xs font-bold text-brand-gold-dark dark:text-brand-gold">
              <Sparkles className="w-3.5 h-3.5" />
              <span>Brand Theme Presets</span>
            </div>
            <p className="text-[11px] text-ui-fg-muted">
              One-click harmonized color palettes calibrated for luxury bakery storefront aesthetics.
            </p>
            <div className="grid grid-cols-2 gap-2">
              {BRAND_PRESETS.map((preset) => (
                <button
                  key={preset.id}
                  type="button"
                  onClick={() => onChange({ ...config, ...preset.config })}
                  className="p-2 rounded-lg border border-ui-border-base bg-ui-bg-base hover:border-brand-gold text-left transition-all active:scale-98 cursor-pointer flex flex-col gap-1 shadow-xs"
                >
                  <div className="flex items-center gap-1.5">
                    <div
                      className="w-3.5 h-3.5 rounded-full border border-black/20 shrink-0"
                      style={{
                        background: preset.config.bg_mode === "gradient"
                          ? `linear-gradient(90deg, ${preset.config.gradient_start}, ${preset.config.gradient_end})`
                          : preset.config.bg_color,
                      }}
                    />
                    <span className="text-[11px] font-bold text-ui-fg-base truncate">{preset.name}</span>
                  </div>
                  <span className="text-[10px] text-ui-fg-muted line-clamp-1">{preset.desc}</span>
                </button>
              ))}
            </div>
          </div>

          <Field label="Background Mode">
            <Select value={config.bg_mode || "solid"} onValueChange={(v) => updateProp("bg_mode", v as any)}>
              <Select.Trigger><Select.Value /></Select.Trigger>
              <Select.Content>
                <Select.Item value="solid">Solid Color</Select.Item>
                <Select.Item value="gradient">Gradient</Select.Item>
              </Select.Content>
            </Select>
          </Field>

          {config.bg_mode === "gradient" ? (
            <div className="flex flex-col gap-2 p-3 bg-ui-bg-subtle rounded-xl border border-ui-border-base">
              <div className="grid grid-cols-2 gap-2">
                <ColorInput label="Gradient Start" value={config.gradient_start} onChange={(v) => updateProp("gradient_start", v)} fallback="#172033" />
                <ColorInput label="Gradient End" value={config.gradient_end} onChange={(v) => updateProp("gradient_end", v)} fallback="#1E293B" />
              </div>
              <Field label="Direction">
                <Select value={config.gradient_direction || "90deg"} onValueChange={(v) => updateProp("gradient_direction", v)}>
                  <Select.Trigger><Select.Value /></Select.Trigger>
                  <Select.Content>
                    <Select.Item value="90deg">Horizontal →</Select.Item>
                    <Select.Item value="135deg">Diagonal ↘</Select.Item>
                    <Select.Item value="180deg">Vertical ↓</Select.Item>
                    <Select.Item value="45deg">Diagonal ↗</Select.Item>
                  </Select.Content>
                </Select>
              </Field>
            </div>
          ) : (
            <ColorInput label="Background Color" value={config.bg_color} onChange={(v) => updateProp("bg_color", v)} fallback="#172033" />
          )}

          <div className="grid grid-cols-2 gap-2">
            <ColorInput label="Text Color" value={config.text_color} onChange={(v) => updateProp("text_color", v)} fallback="#FFFFFF" />
            <ColorInput label="Accent Color" value={config.accent_color} onChange={(v) => updateProp("accent_color", v)} fallback="#F59E0B" />
          </div>

          <div className="grid grid-cols-2 gap-2">
            <ColorInput label="Top Border" value={config.border_top_color} onChange={(v) => updateProp("border_top_color", v)} fallback="transparent" />
            <ColorInput label="Bottom Border" value={config.border_bottom_color} onChange={(v) => updateProp("border_bottom_color", v)} fallback="rgba(245,158,11,0.2)" />
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════ */}
      {/* 6. DIMENSIONS TAB */}
      {/* ═══════════════════════════════════════════════════════════ */}
      {activeTab === "dimensions" && (
        <div className="flex flex-col gap-3">
          <div className="grid grid-cols-2 gap-2">
            <Field label="Height Mode">
              <Select value={config.height_mode || "auto"} onValueChange={(v) => updateProp("height_mode", v as any)}>
                <Select.Trigger><Select.Value /></Select.Trigger>
                <Select.Content>
                  <Select.Item value="auto">Auto (Compact)</Select.Item>
                  <Select.Item value="custom">Custom Height</Select.Item>
                </Select.Content>
              </Select>
            </Field>
            <Field label="Content Max Width" hint="E.g. 1440px or full">
              <Input value={config.content_max_width || "1440px"} onChange={(e) => updateProp("content_max_width", e.target.value)} />
            </Field>
          </div>

          {config.height_mode === "custom" && (
            <div className="grid grid-cols-3 gap-2 p-3 bg-ui-bg-subtle rounded-xl border border-ui-border-base">
              <Field label="Desktop"><Input value={String(config.desktop_height || "44px")} onChange={(e) => updateProp("desktop_height", e.target.value)} /></Field>
              <Field label="Tablet"><Input value={String(config.tablet_height || "44px")} onChange={(e) => updateProp("tablet_height", e.target.value)} /></Field>
              <Field label="Mobile"><Input value={String(config.mobile_height || "auto")} onChange={(e) => updateProp("mobile_height", e.target.value)} /></Field>
            </div>
          )}

          <Field label="Content Alignment">
            <Select value={config.content_alignment || "center"} onValueChange={(v) => updateProp("content_alignment", v as any)}>
              <Select.Trigger><Select.Value /></Select.Trigger>
              <Select.Content>
                <Select.Item value="center">Centered</Select.Item>
                <Select.Item value="space_between">Space Between</Select.Item>
                <Select.Item value="left">Left Aligned</Select.Item>
              </Select.Content>
            </Select>
          </Field>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════ */}
      {/* 7. SPACING TAB */}
      {/* ═══════════════════════════════════════════════════════════ */}
      {activeTab === "spacing" && (
        <div className="flex flex-col gap-3">
          <div className="grid grid-cols-3 gap-2">
            <Field label="Padding X (px)">
              <Input type="number" value={config.padding_x ?? 24} onChange={(e) => updateProp("padding_x", parseInt(e.target.value) || 0)} />
            </Field>
            <Field label="Padding Y (px)">
              <Input type="number" value={config.padding_y ?? 10} onChange={(e) => updateProp("padding_y", parseInt(e.target.value) || 0)} />
            </Field>
            <Field label="Element Gap (px)">
              <Input type="number" value={config.element_gap ?? 14} onChange={(e) => updateProp("element_gap", parseInt(e.target.value) || 0)} />
            </Field>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════ */}
      {/* 8. TYPOGRAPHY TAB */}
      {/* ═══════════════════════════════════════════════════════════ */}
      {activeTab === "typography" && (
        <div className="flex flex-col gap-3">
          <div className="grid grid-cols-3 gap-2">
            <Field label="Desktop Size"><Input value={config.desktop_font_size || "0.875rem"} onChange={(e) => updateProp("desktop_font_size", e.target.value)} /></Field>
            <Field label="Tablet Size"><Input value={config.tablet_font_size || "0.8125rem"} onChange={(e) => updateProp("tablet_font_size", e.target.value)} /></Field>
            <Field label="Mobile Size"><Input value={config.mobile_font_size || "0.75rem"} onChange={(e) => updateProp("mobile_font_size", e.target.value)} /></Field>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <Field label="Font Weight">
              <Select value={config.font_weight || "700"} onValueChange={(v) => updateProp("font_weight", v)}>
                <Select.Trigger><Select.Value /></Select.Trigger>
                <Select.Content>
                  <Select.Item value="900">Black (900)</Select.Item>
                  <Select.Item value="800">Extra Bold (800)</Select.Item>
                  <Select.Item value="700">Bold (700)</Select.Item>
                  <Select.Item value="600">Semi Bold (600)</Select.Item>
                  <Select.Item value="500">Medium (500)</Select.Item>
                </Select.Content>
              </Select>
            </Field>
            <Field label="Letter Spacing">
              <Input value={config.letter_spacing || "normal"} onChange={(e) => updateProp("letter_spacing", e.target.value)} placeholder="normal" />
            </Field>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════ */}
      {/* 9. BEHAVIOR TAB */}
      {/* ═══════════════════════════════════════════════════════════ */}
      {activeTab === "behavior" && (
        <div className="flex flex-col gap-3">
          <Field label="Bar Positioning">
            <Select value={config.position_mode || "static"} onValueChange={(v) => updateProp("position_mode", v as any)}>
              <Select.Trigger><Select.Value /></Select.Trigger>
              <Select.Content>
                <Select.Item value="static">Static (Scrolls with page)</Select.Item>
                <Select.Item value="sticky">Sticky Top (Fixed above content)</Select.Item>
              </Select.Content>
            </Select>
          </Field>
          <div className="p-3 bg-ui-bg-subtle rounded-xl border border-ui-border-base flex items-center justify-between">
            <div>
              <Text className="text-xs font-bold">Dismissible Close Button (X)</Text>
              <Text className="text-[10px] text-ui-fg-muted">Allows customers to hide for this session</Text>
            </div>
            <Toggle checked={config.dismissible || false} onChange={(v) => updateProp("dismissible", v)} label="Dismissible" />
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════ */}
      {/* 10. SCHEDULE TAB */}
      {/* ═══════════════════════════════════════════════════════════ */}
      {activeTab === "schedule" && (
        <div className="flex flex-col gap-3">
          <div className="p-3 bg-ui-bg-subtle rounded-xl border border-ui-border-base flex items-center justify-between">
            <div>
              <Text className="text-xs font-bold">Campaign Scheduling</Text>
              <Text className="text-[10px] text-ui-fg-muted">Auto-activate and auto-expire</Text>
            </div>
            <Toggle checked={config.schedule?.enabled || false} onChange={(v) => updateScheduleProp("enabled", v)} label="Enable scheduling" />
          </div>

          {config.schedule?.enabled && (
            <div className="flex flex-col gap-2.5 p-3 bg-ui-bg-subtle rounded-xl border border-ui-border-base">
              <div className="grid grid-cols-2 gap-2">
                <Field label="Start Date/Time">
                  <Input type="datetime-local" value={config.schedule?.start || ""} onChange={(e) => updateScheduleProp("start", e.target.value)} />
                </Field>
                <Field label="End Date/Time">
                  <Input type="datetime-local" value={config.schedule?.end || ""} onChange={(e) => updateScheduleProp("end", e.target.value)} />
                </Field>
              </div>
              <Field label="Timezone">
                <Input value={config.schedule?.timezone || "Asia/Kolkata"} disabled />
              </Field>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
