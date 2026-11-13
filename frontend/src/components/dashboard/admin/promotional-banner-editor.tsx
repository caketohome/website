"use client";

import React, { useState } from "react";
import {
  Heading,
  Text,
  Badge,
  Button,
  Input,
  Label,
  Textarea,
  Select,
} from "@medusajs/ui";
import {
  Palette,
  Layout,
  Type,
  MousePointerClick,
  Sparkles,
  Sliders,
  Maximize2,
  Square,
  Tag,
  ImageIcon,
  Smartphone,
  Monitor,
  Tablet as TabletIcon,
  Percent,
  Link2,
  RefreshCw,
  Database,
  CheckCircle2,
  ShieldCheck,
  AlertCircle,
} from "lucide-react";

interface PromotionalBannerEditorProps {
  section: any;
  sectionConfigDevice: "desktop" | "tablet" | "mobile";
  setSectionConfigDevice: (d: "desktop" | "tablet" | "mobile") => void;
  updateSectionConfig: (sectionId: string, key: string, value: any) => void;
  updateSectionNestedConfig: (sectionId: string, device: "desktop" | "tablet" | "mobile", childKey: string, value: any) => void;
  openImagePicker?: (title: string, current: any, callback: (sel: any) => void) => void;
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

export function PromotionalBannerEditor({
  section,
  sectionConfigDevice,
  setSectionConfigDevice,
  updateSectionConfig,
  updateSectionNestedConfig,
  openImagePicker,
}: PromotionalBannerEditorProps) {
  const [activeSubTab, setActiveSubTab] = useState<
    "content" | "offercode" | "dimensions" | "spacing" | "background" | "border" | "typography" | "cta" | "layout"
  >("content");

  const [availableOffers, setAvailableOffers] = useState<any[]>([]);
  const [loadingOffers, setLoadingOffers] = useState(false);
  const [syncSuccessMsg, setSyncSuccessMsg] = useState<string | null>(null);

  const config = section.config || {};
  const currentDeviceConfig = config[sectionConfigDevice] || {};

  const handleUpdate = (key: string, value: any) => {
    updateSectionConfig(section.id, key, value);
  };

  // Hydrate marketing offers from PostgreSQL
  React.useEffect(() => {
    let isMounted = true;
    setLoadingOffers(true);
    fetch("/api/v1/admin/offers")
      .then((r) => r.json())
      .then((data) => {
        if (!isMounted) return;
        const list = data?.offers || [];
        setAvailableOffers(list);
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
    (o) =>
      (config.offer_id && o.id === config.offer_id) ||
      (config.coupon_code && o.code && o.code.toUpperCase() === config.coupon_code.toUpperCase()) ||
      (config.offer_code && o.code && o.code.toUpperCase() === config.offer_code.toUpperCase())
  );

  const handleSelectOffer = (offerCodeOrId: string) => {
    const selected = availableOffers.find(
      (o) => o.code === offerCodeOrId || o.id === offerCodeOrId
    );
    if (!selected) return;

    handleUpdate("offer_id", selected.id);
    handleUpdate("offer_code", selected.code);
    handleUpdate("coupon_code", selected.code);

    const discVal = Number(selected.discount_value ?? selected.metadata?.discount_value ?? 0);
    const minOrder = Number(selected.min_order_value ?? selected.min_order ?? 0);
    const maxDisc = selected.max_discount_value ? Number(selected.max_discount_value) : null;

    handleUpdate("headline", selected.name || `Special Offer — ${selected.code}`);
    
    let generatedSubheadline = selected.description || "";
    if (!generatedSubheadline) {
      if (selected.type === "percentage") {
        generatedSubheadline = `Flat ${discVal}% OFF${maxDisc ? ` up to ₹${maxDisc}` : ""}${minOrder > 0 ? ` on orders above ₹${minOrder}` : ""}`;
      } else if (selected.type === "flat") {
        generatedSubheadline = `Flat ₹${discVal} OFF${minOrder > 0 ? ` on orders above ₹${minOrder}` : ""}`;
      } else if (selected.type === "free_delivery") {
        generatedSubheadline = `Free Doorstep Delivery${minOrder > 0 ? ` on orders above ₹${minOrder}` : ""}`;
      } else {
        generatedSubheadline = `Special promotional offer. Apply code ${selected.code} at checkout.`;
      }
    }
    handleUpdate("subheadline", generatedSubheadline);
    handleUpdate("cta_url", `/products?promo=${selected.code}`);

    setSyncSuccessMsg(`Offer details synced from Marketing Offers: ${selected.code}`);
    setTimeout(() => setSyncSuccessMsg(null), 3500);
  };

  const handleDevicePropUpdate = (prop: string, value: any) => {
    updateSectionNestedConfig(section.id, sectionConfigDevice, prop, value);
  };

  return (
    <div className="flex flex-col gap-3">
      {/* SECTION HEADER & QUICK PREVIEW */}
      <div className="p-3 bg-gradient-to-r from-amber-500/10 via-rose-500/10 to-purple-500/10 rounded-xl border border-amber-200/50 dark:border-amber-900/30 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-xl">🎉</span>
          <div>
            <Text className="text-xs font-bold text-ui-fg-base">
              Promotional Offer Banner Editor
            </Text>
            <Text className="text-[10px] text-ui-fg-muted">
              Full visual, dimensional, typography, offer-code & CTA controls
            </Text>
          </div>
        </div>
        <Badge color="orange" className="text-[10px] font-bold">
          CMS Canonical
        </Badge>
      </div>

      {/* DEVICE BREAKPOINT CONTROLLER */}
      <div className="flex items-center justify-between p-2 bg-ui-bg-subtle rounded-xl border border-ui-border-base">
        <span className="text-[11px] font-bold text-rose-600 flex items-center gap-1">
          <Sliders className="w-3.5 h-3.5" /> Breakpoint View:
        </span>
        <div className="flex items-center gap-1 bg-ui-bg-base p-0.5 rounded-lg border border-ui-border-base">
          {(["desktop", "tablet", "mobile"] as const).map((d) => (
            <button
              key={d}
              onClick={() => setSectionConfigDevice(d)}
              className={`px-2.5 py-1 text-[10px] font-bold rounded flex items-center gap-1 transition-all ${
                sectionConfigDevice === d
                  ? "bg-rose-500 text-white shadow-sm"
                  : "text-ui-fg-muted hover:text-ui-fg-base"
              }`}
            >
              {d === "desktop" && <Monitor className="w-3 h-3" />}
              {d === "tablet" && <TabletIcon className="w-3 h-3" />}
              {d === "mobile" && <Smartphone className="w-3 h-3" />}
              {d === "desktop" ? "Desktop (1440)" : d === "tablet" ? "Tablet (768)" : "Mobile (375)"}
            </button>
          ))}
        </div>
      </div>

      {/* EDITOR SUB-NAVIGATION TABS */}
      <div className="flex items-center gap-1 overflow-x-auto pb-1 border-b border-ui-border-base scrollbar-none text-xs">
        {[
          { id: "content", label: "Content", icon: Tag },
          { id: "offercode", label: "Offer Code & Badge", icon: Percent },
          { id: "dimensions", label: "Dimensions", icon: Maximize2 },
          { id: "spacing", label: "Spacing", icon: Layout },
          { id: "background", label: "Background", icon: Palette },
          { id: "border", label: "Border", icon: Square },
          { id: "typography", label: "Typography", icon: Type },
          { id: "cta", label: "CTA Button", icon: MousePointerClick },
          { id: "layout", label: "Layout", icon: Sliders },
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = activeSubTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveSubTab(tab.id as any)}
              className={`px-2.5 py-1.5 rounded-lg font-bold flex items-center gap-1.5 whitespace-nowrap text-xs transition-all ${
                isActive
                  ? "bg-rose-500 text-white shadow-sm"
                  : "text-ui-fg-muted hover:bg-ui-bg-subtle hover:text-ui-fg-base"
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* ────────────────────────────────────────────────────────────────────────── */}
      {/* 1. CONTENT TAB */}
      {/* ────────────────────────────────────────────────────────────────────────── */}
      {activeSubTab === "content" && (
        <div className="flex flex-col gap-3">
          {/* MARKETING OFFERS SOURCE OF TRUTH CARD */}
          <div className="p-3.5 bg-gradient-to-r from-amber-500/10 via-rose-500/10 to-ui-bg-subtle rounded-xl border border-amber-300 dark:border-amber-800 flex flex-col gap-2.5 shadow-sm">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <Database className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                <Text className="text-xs font-bold text-ui-fg-base">
                  Marketing Offers (Single Source of Truth)
                </Text>
              </div>
              <Badge color={linkedOffer ? "green" : "orange"} className="text-[10px] font-bold">
                {linkedOffer ? "DB Linked" : "Unlinked"}
              </Badge>
            </div>

            <Text className="text-[11px] text-ui-fg-muted">
              Select an offer from <strong className="text-ui-fg-base">Admin Panel → Marketing → Offers</strong>. The promotional banner automatically uses the offer's real title, code, and terms, while backend promotion rules remain strictly authoritative.
            </Text>

            <div className="flex items-center gap-2">
              <select
                value={linkedOffer?.code || config.coupon_code || ""}
                onChange={(e) => handleSelectOffer(e.target.value)}
                className="w-full text-xs py-1.5 px-2.5 rounded-lg border border-ui-border-base bg-ui-bg-base text-ui-fg-base font-semibold focus:outline-none focus:ring-1 focus:ring-rose-500 cursor-pointer"
              >
                <option value="">-- Choose Marketing Offer to Display --</option>
                {availableOffers.map((off) => (
                  <option key={off.id || off.code} value={off.code}>
                    [{off.code}] {off.name} ({off.status}, {off.type === "percentage" ? `${off.discount_value || off.metadata?.discount_value || 50}% OFF` : `₹${off.discount_value || off.metadata?.discount_value || 100} OFF`}, Min ₹{off.min_order_value || 0})
                  </option>
                ))}
              </select>

              {linkedOffer && (
                <Button
                  variant="secondary"
                  size="small"
                  onClick={() => handleSelectOffer(linkedOffer.code)}
                  className="shrink-0 text-xs flex items-center gap-1"
                  title="Re-sync headline, description and code from database record"
                >
                  <RefreshCw className="w-3 h-3" /> Sync
                </Button>
              )}
            </div>

            {syncSuccessMsg && (
              <div className="p-2 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-300 dark:border-emerald-800 rounded-lg flex items-center gap-1.5 text-[11px] text-emerald-800 dark:text-emerald-300 font-semibold">
                <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                <span>{syncSuccessMsg}</span>
              </div>
            )}

            {linkedOffer && (
              <div className="p-2.5 bg-ui-bg-base rounded-lg border border-ui-border-base flex flex-col gap-1 text-[11px]">
                <div className="flex items-center justify-between font-bold text-ui-fg-base">
                  <span>Linked: {linkedOffer.name} ({linkedOffer.code})</span>
                  <span className="text-emerald-600 dark:text-emerald-400 capitalize">{linkedOffer.status}</span>
                </div>
                <div className="grid grid-cols-2 gap-x-2 gap-y-0.5 text-ui-fg-muted text-[10px]">
                  <span>Discount: <strong className="text-ui-fg-base">{linkedOffer.type === "percentage" ? `${linkedOffer.discount_value || linkedOffer.metadata?.discount_value || 50}%` : `₹${linkedOffer.discount_value || 100}`}</strong></span>
                  <span>Max Cap: <strong className="text-ui-fg-base">{linkedOffer.max_discount_value ? `₹${linkedOffer.max_discount_value}` : "None"}</strong></span>
                  <span>Min Order: <strong className="text-ui-fg-base">₹{linkedOffer.min_order_value || 0}</strong></span>
                  <span>Expiry: <strong className="text-ui-fg-base">{linkedOffer.never_expires ? "Never" : linkedOffer.ends_at ? new Date(linkedOffer.ends_at).toLocaleDateString() : "Active"}</strong></span>
                </div>
                <div className="text-[10px] text-amber-700 dark:text-amber-400 mt-1 flex items-center gap-1">
                  <ShieldCheck className="w-3 h-3 shrink-0" />
                  <span>Enforced at checkout by backend PostgreSQL engine.</span>
                </div>
              </div>
            )}
          </div>
          <Field label="Heading / Headline" hint="Main attention-grabbing promotion text">
            <Input
              value={config.headline || config.heading || ""}
              onChange={(e) => handleUpdate("headline", e.target.value)}
              placeholder="🎉 Monsoon Special — Flat 50% OFF"
            />
          </Field>

          <Field label="Subtitle / Description" hint="Supporting terms or guidance">
            <Textarea
              value={config.subheadline || config.description || ""}
              onChange={(e) => handleUpdate("subheadline", e.target.value)}
              placeholder="Valid on all birthday & anniversary cakes above ₹299"
              rows={2}
            />
          </Field>

          <div className="grid grid-cols-2 gap-2">
            <Field label="Icon / Emoji" hint="Displayed beside headline">
              <Input
                value={config.icon || "🎉"}
                onChange={(e) => handleUpdate("icon", e.target.value)}
                placeholder="🎉"
              />
            </Field>
            <Field label="CTA Button Text" hint="Action button label">
              <Input
                value={config.cta_text || "Claim Offer"}
                onChange={(e) => handleUpdate("cta_text", e.target.value)}
                placeholder="Claim Offer"
              />
            </Field>
          </div>

          <Field label="CTA Link / URL" hint="Destination route or product collection">
            <Input
              value={config.cta_url || config.cta_link || ""}
              onChange={(e) => handleUpdate("cta_url", e.target.value)}
              placeholder="/products?promo=CAKE50"
            />
          </Field>

          {/* Banner Graphic Picker */}
          <div className="p-3 bg-ui-bg-subtle rounded-xl border border-ui-border-base flex items-center justify-between">
            <div>
              <Label className="text-xs font-semibold">Optional Banner Graphic / Illustration</Label>
              <Text className="text-[10px] text-ui-fg-muted truncate max-w-[180px]">
                {config.graphic_image || "No graphic selected"}
              </Text>
            </div>
            {openImagePicker && (
              <Button
                variant="secondary"
                size="small"
                onClick={() =>
                  openImagePicker("Banner Graphic", { url: config.graphic_image }, (sel) =>
                    handleUpdate("graphic_image", sel.url)
                  )
                }
              >
                <ImageIcon className="w-3.5 h-3.5 mr-1" /> Select Graphic
              </Button>
            )}
          </div>
        </div>
      )}

      {/* ────────────────────────────────────────────────────────────────────────── */}
      {/* 2. OFFER CODE & BADGE TAB */}
      {/* ────────────────────────────────────────────────────────────────────────── */}
      {activeSubTab === "offercode" && (
        <div className="flex flex-col gap-3">
          {/* Coupon Code Controls */}
          <div className="p-3 bg-ui-bg-subtle rounded-xl border border-ui-border-base flex flex-col gap-2.5">
            <div className="flex items-center justify-between">
              <Text className="text-xs font-bold text-rose-600 uppercase">Offer Code Pill Styling</Text>
              <Toggle
                checked={config.coupon_visible !== false}
                onChange={(v) => handleUpdate("coupon_visible", v)}
                label="Offer Code Pill Visibility"
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <Field label="Coupon / Offer Code" hint="E.g. CAKE50">
                <Input
                  value={config.coupon_code || config.offer_code || ""}
                  onChange={(e) => handleUpdate("coupon_code", e.target.value.toUpperCase())}
                  placeholder="CAKE50"
                />
              </Field>
              <Field label="Pill Label Prefix" hint="E.g. Use Code: or Save with:">
                <Input
                  value={config.coupon_label ?? "Use Code:"}
                  onChange={(e) => handleUpdate("coupon_label", e.target.value)}
                  placeholder="Use Code:"
                />
              </Field>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <ColorInput
                label="Pill Background"
                value={config.coupon_bg || "#ffffff"}
                onChange={(val) => handleUpdate("coupon_bg", val)}
                fallback="#ffffff"
              />
              <ColorInput
                label="Pill Text Color"
                value={config.coupon_text_color || "#8A3F00"}
                onChange={(val) => handleUpdate("coupon_text_color", val)}
                fallback="#8A3F00"
              />
            </div>
            <div className="grid grid-cols-3 gap-2">
              <ColorInput
                label="Pill Border Color"
                value={config.coupon_border_color || "#F6C85F"}
                onChange={(val) => handleUpdate("coupon_border_color", val)}
                fallback="#F6C85F"
              />
              <Field label="Border Radius (px)">
                <Input
                  type="number"
                  value={config.coupon_border_radius ?? 10}
                  onChange={(e) => handleUpdate("coupon_border_radius", parseInt(e.target.value) || 0)}
                />
              </Field>
              <Field label="Padding X (px)">
                <Input
                  type="number"
                  value={config.coupon_padding_x ?? 12}
                  onChange={(e) => handleUpdate("coupon_padding_x", parseInt(e.target.value) || 0)}
                />
              </Field>
            </div>
          </div>

          {/* Badge Controls */}
          <div className="p-3 bg-ui-bg-subtle rounded-xl border border-ui-border-base flex flex-col gap-2.5">
            <div className="flex items-center justify-between">
              <Text className="text-xs font-bold text-rose-600 uppercase">Banner Badge Styling</Text>
              <Toggle
                checked={config.badge_visible !== false}
                onChange={(v) => handleUpdate("badge_visible", v)}
                label="Badge Visibility"
              />
            </div>
            <Field label="Badge Text" hint="E.g. LIMITED TIME OFFER">
              <Input
                value={config.badge_text || "LIMITED TIME OFFER"}
                onChange={(e) => handleUpdate("badge_text", e.target.value)}
                placeholder="LIMITED TIME OFFER"
              />
            </Field>
            <div className="grid grid-cols-3 gap-2">
              <ColorInput
                label="Badge Background"
                value={config.badge_bg || "rgba(245, 158, 11, 0.18)"}
                onChange={(val) => handleUpdate("badge_bg", val)}
                fallback="rgba(245, 158, 11, 0.18)"
              />
              <ColorInput
                label="Badge Text Color"
                value={config.badge_text_color || "#92400e"}
                onChange={(val) => handleUpdate("badge_text_color", val)}
                fallback="#92400e"
              />
              <ColorInput
                label="Badge Border Color"
                value={config.badge_border_color || "rgba(245, 158, 11, 0.35)"}
                onChange={(val) => handleUpdate("badge_border_color", val)}
                fallback="rgba(245, 158, 11, 0.35)"
              />
            </div>
          </div>
        </div>
      )}

      {/* ────────────────────────────────────────────────────────────────────────── */}
      {/* 3. DIMENSIONS TAB */}
      {/* ────────────────────────────────────────────────────────────────────────── */}
      {activeSubTab === "dimensions" && (
        <div className="flex flex-col gap-3">
          <div className="grid grid-cols-2 gap-2">
            <Field label="Section Width Mode">
              <Select
                value={config.section_width_mode || "container"}
                onValueChange={(v) => handleUpdate("section_width_mode", v)}
              >
                <Select.Trigger>
                  <Select.Value />
                </Select.Trigger>
                <Select.Content>
                  <Select.Item value="container">Container (Centered)</Select.Item>
                  <Select.Item value="full">Full Width (100vw)</Select.Item>
                  <Select.Item value="custom">Custom Width</Select.Item>
                </Select.Content>
              </Select>
            </Field>
            <Field label="Max Width" hint="E.g. 1400px, 1280px">
              <Input
                value={config.max_width || "1400px"}
                onChange={(e) => handleUpdate("max_width", e.target.value)}
                placeholder="1400px"
              />
            </Field>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <Field label="Inner Banner Card Width" hint="Width of the styled card">
              <Input
                value={config.inner_banner_width || "100%"}
                onChange={(e) => handleUpdate("inner_banner_width", e.target.value)}
                placeholder="100% or 1200px"
              />
            </Field>
            <Field label="Height Mode">
              <Select
                value={config.height_mode || "auto"}
                onValueChange={(v) => handleUpdate("height_mode", v)}
              >
                <Select.Trigger>
                  <Select.Value />
                </Select.Trigger>
                <Select.Content>
                  <Select.Item value="auto">Auto (Content-Driven)</Select.Item>
                  <Select.Item value="custom">Custom Height</Select.Item>
                </Select.Content>
              </Select>
            </Field>
          </div>

          {/* Breakpoint-Specific Height Overrides */}
          <div className="p-3 bg-ui-bg-subtle rounded-xl border border-ui-border-base flex flex-col gap-2">
            <Text className="text-[11px] font-bold text-rose-600 uppercase">
              {sectionConfigDevice} Height Controls
            </Text>
            <div className="grid grid-cols-3 gap-2">
              <Field label="Min Height">
                <Input
                  value={currentDeviceConfig.min_height || (sectionConfigDevice === "mobile" ? "auto" : "110px")}
                  onChange={(e) => handleDevicePropUpdate("min_height", e.target.value)}
                  placeholder="e.g. 110px"
                />
              </Field>
              <Field label="Custom Height">
                <Input
                  value={currentDeviceConfig.height || "auto"}
                  onChange={(e) => handleDevicePropUpdate("height", e.target.value)}
                  placeholder="auto or 140px"
                />
              </Field>
              <Field label="Max Height">
                <Input
                  value={currentDeviceConfig.max_height || "none"}
                  onChange={(e) => handleDevicePropUpdate("max_height", e.target.value)}
                  placeholder="none"
                />
              </Field>
            </div>
          </div>
        </div>
      )}

      {/* ────────────────────────────────────────────────────────────────────────── */}
      {/* 4. SPACING TAB */}
      {/* ────────────────────────────────────────────────────────────────────────── */}
      {activeSubTab === "spacing" && (
        <div className="flex flex-col gap-3">
          {/* Banner Padding */}
          <div className="p-3 bg-ui-bg-subtle rounded-xl border border-ui-border-base flex flex-col gap-2">
            <Text className="text-[11px] font-bold uppercase text-ui-fg-subtle">
              Inner Banner Card Padding ({sectionConfigDevice})
            </Text>
            <div className="grid grid-cols-4 gap-2">
              <Field label="Top">
                <Input
                  type="number"
                  value={currentDeviceConfig.padding_top ?? 22}
                  onChange={(e) => handleDevicePropUpdate("padding_top", parseInt(e.target.value) || 0)}
                />
              </Field>
              <Field label="Right">
                <Input
                  type="number"
                  value={currentDeviceConfig.padding_right ?? 32}
                  onChange={(e) => handleDevicePropUpdate("padding_right", parseInt(e.target.value) || 0)}
                />
              </Field>
              <Field label="Bottom">
                <Input
                  type="number"
                  value={currentDeviceConfig.padding_bottom ?? 22}
                  onChange={(e) => handleDevicePropUpdate("padding_bottom", parseInt(e.target.value) || 0)}
                />
              </Field>
              <Field label="Left">
                <Input
                  type="number"
                  value={currentDeviceConfig.padding_left ?? 32}
                  onChange={(e) => handleDevicePropUpdate("padding_left", parseInt(e.target.value) || 0)}
                />
              </Field>
            </div>
          </div>

          {/* Section Outer Margins */}
          <div className="p-3 bg-ui-bg-subtle rounded-xl border border-ui-border-base flex flex-col gap-2">
            <Text className="text-[11px] font-bold uppercase text-ui-fg-subtle">
              Outer Section Margin ({sectionConfigDevice})
            </Text>
            <div className="grid grid-cols-4 gap-2">
              <Field label="Top">
                <Input
                  type="number"
                  value={currentDeviceConfig.margin_top ?? 0}
                  onChange={(e) => handleDevicePropUpdate("margin_top", parseInt(e.target.value) || 0)}
                />
              </Field>
              <Field label="Right">
                <Input
                  type="number"
                  value={currentDeviceConfig.margin_right ?? 0}
                  onChange={(e) => handleDevicePropUpdate("margin_right", parseInt(e.target.value) || 0)}
                />
              </Field>
              <Field label="Bottom">
                <Input
                  type="number"
                  value={currentDeviceConfig.margin_bottom ?? 0}
                  onChange={(e) => handleDevicePropUpdate("margin_bottom", parseInt(e.target.value) || 0)}
                />
              </Field>
              <Field label="Left">
                <Input
                  type="number"
                  value={currentDeviceConfig.margin_left ?? 0}
                  onChange={(e) => handleDevicePropUpdate("margin_left", parseInt(e.target.value) || 0)}
                />
              </Field>
            </div>
          </div>

          {/* Internal Elements Gap */}
          <div className="grid grid-cols-3 gap-2">
            <Field label="Content Gap (px)">
              <Input
                type="number"
                value={currentDeviceConfig.content_gap ?? (sectionConfigDevice === "mobile" ? 16 : 24)}
                onChange={(e) => handleDevicePropUpdate("content_gap", parseInt(e.target.value) || 16)}
              />
            </Field>
            <Field label="Text Gap (px)">
              <Input
                type="number"
                value={currentDeviceConfig.text_gap ?? 6}
                onChange={(e) => handleDevicePropUpdate("text_gap", parseInt(e.target.value) || 6)}
              />
            </Field>
            <Field label="CTA Gap (px)">
              <Input
                type="number"
                value={currentDeviceConfig.cta_gap ?? 12}
                onChange={(e) => handleDevicePropUpdate("cta_gap", parseInt(e.target.value) || 12)}
              />
            </Field>
          </div>
        </div>
      )}

      {/* ────────────────────────────────────────────────────────────────────────── */}
      {/* 5. BACKGROUND TAB */}
      {/* ────────────────────────────────────────────────────────────────────────── */}
      {activeSubTab === "background" && (
        <div className="flex flex-col gap-3">
          <div className="grid grid-cols-2 gap-2">
            <ColorInput
              label="Banner Card Background"
              value={config.bg_color || "#FFF2C2"}
              onChange={(val) => handleUpdate("bg_color", val)}
              fallback="#FFF2C2"
            />
            <ColorInput
              label="Outer Section Background"
              value={config.section_bg_color || "transparent"}
              onChange={(val) => handleUpdate("section_bg_color", val)}
              fallback="transparent"
            />
          </div>

          {/* Gradient System */}
          <div className="p-3 bg-ui-bg-subtle rounded-xl border border-ui-border-base flex flex-col gap-2.5">
            <div className="flex items-center justify-between">
              <Text className="text-xs font-bold">Gradient Background on Card</Text>
              <Toggle
                checked={config.gradient_enabled !== false}
                onChange={(v) => handleUpdate("gradient_enabled", v)}
                label="Toggle Gradient"
              />
            </div>
            {config.gradient_enabled !== false && (
              <div className="flex flex-col gap-2 pt-1">
                <div className="grid grid-cols-2 gap-2">
                  <ColorInput
                    label="Gradient Start"
                    value={config.gradient_start || "#FFF2C2"}
                    onChange={(val) => handleUpdate("gradient_start", val)}
                    fallback="#FFF2C2"
                  />
                  <ColorInput
                    label="Gradient End"
                    value={config.gradient_end || "#FFE494"}
                    onChange={(val) => handleUpdate("gradient_end", val)}
                    fallback="#FFE494"
                  />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <Field label="Direction / Angle">
                    <Select
                      value={config.gradient_direction || "90deg"}
                      onValueChange={(v) => handleUpdate("gradient_direction", v)}
                    >
                      <Select.Trigger>
                        <Select.Value />
                      </Select.Trigger>
                      <Select.Content>
                        <Select.Item value="90deg">Horizontal (90° →)</Select.Item>
                        <Select.Item value="135deg">Diagonal (135° ↘)</Select.Item>
                        <Select.Item value="180deg">Vertical (180° ↓)</Select.Item>
                        <Select.Item value="45deg">Up-Diagonal (45° ↗)</Select.Item>
                      </Select.Content>
                    </Select>
                  </Field>
                  <Field label="Gradient Type">
                    <Select
                      value={config.gradient_type || "linear"}
                      onValueChange={(v) => handleUpdate("gradient_type", v)}
                    >
                      <Select.Trigger>
                        <Select.Value />
                      </Select.Trigger>
                      <Select.Content>
                        <Select.Item value="linear">Linear</Select.Item>
                        <Select.Item value="radial">Radial</Select.Item>
                      </Select.Content>
                    </Select>
                  </Field>
                </div>
              </div>
            )}
          </div>

          {/* Background Image & Overlay */}
          <div className="p-3 bg-ui-bg-subtle rounded-xl border border-ui-border-base flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <Label className="text-xs font-semibold">Background Pattern / Image</Label>
              {openImagePicker && (
                <Button
                  variant="secondary"
                  size="small"
                  onClick={() =>
                    openImagePicker("Banner BG Image", { url: config.bg_image }, (sel) =>
                      handleUpdate("bg_image", sel.url)
                    )
                  }
                >
                  <ImageIcon className="w-3.5 h-3.5 mr-1" /> Select BG
                </Button>
              )}
            </div>
            <Input
              value={config.bg_image || ""}
              onChange={(e) => handleUpdate("bg_image", e.target.value)}
              placeholder="https://... or pattern URL"
            />
            {config.bg_image && (
              <div className="grid grid-cols-2 gap-2 pt-1">
                <Field label="Image Position">
                  <Select
                    value={config.bg_image_position || "center"}
                    onValueChange={(v) => handleUpdate("bg_image_position", v)}
                  >
                    <Select.Trigger>
                      <Select.Value />
                    </Select.Trigger>
                    <Select.Content>
                      <Select.Item value="center">Center</Select.Item>
                      <Select.Item value="top">Top</Select.Item>
                      <Select.Item value="bottom">Bottom</Select.Item>
                      <Select.Item value="right">Right</Select.Item>
                    </Select.Content>
                  </Select>
                </Field>
                <Field label="Overlay Opacity (%)">
                  <Input
                    type="number"
                    value={config.overlay_opacity ?? 0}
                    onChange={(e) => handleUpdate("overlay_opacity", parseInt(e.target.value) || 0)}
                    min={0}
                    max={100}
                  />
                </Field>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ────────────────────────────────────────────────────────────────────────── */}
      {/* 6. BORDER & SHADOW TAB */}
      {/* ────────────────────────────────────────────────────────────────────────── */}
      {activeSubTab === "border" && (
        <div className="flex flex-col gap-3">
          <div className="p-3 bg-ui-bg-subtle rounded-xl border border-ui-border-base flex flex-col gap-2.5">
            <div className="flex items-center justify-between">
              <Text className="text-xs font-bold">Border Outline</Text>
              <Toggle
                checked={config.border_enabled !== false}
                onChange={(v) => handleUpdate("border_enabled", v)}
                label="Toggle Border"
              />
            </div>
            {config.border_enabled !== false && (
              <div className="grid grid-cols-3 gap-2">
                <Field label="Border Width (px)">
                  <Input
                    type="number"
                    value={config.border_width ?? 1.5}
                    onChange={(e) => handleUpdate("border_width", parseInt(e.target.value) || 0)}
                  />
                </Field>
                <Field label="Border Style">
                  <Select
                    value={config.border_style || "solid"}
                    onValueChange={(v) => handleUpdate("border_style", v)}
                  >
                    <Select.Trigger>
                      <Select.Value />
                    </Select.Trigger>
                    <Select.Content>
                      <Select.Item value="solid">Solid</Select.Item>
                      <Select.Item value="dashed">Dashed</Select.Item>
                      <Select.Item value="dotted">Dotted</Select.Item>
                    </Select.Content>
                  </Select>
                </Field>
                <ColorInput
                  label="Border Color"
                  value={config.border_color || "#F6C85F"}
                  onChange={(val) => handleUpdate("border_color", val)}
                  fallback="#F6C85F"
                />
              </div>
            )}
          </div>

          {/* Border Radius */}
          <div className="p-3 bg-ui-bg-subtle rounded-xl border border-ui-border-base flex flex-col gap-2">
            <Text className="text-[11px] font-bold uppercase text-ui-fg-subtle">
              Corner Rounding / Border Radius (px)
            </Text>
            <div className="grid grid-cols-2 gap-2">
              <Field label="All Corners Radius">
                <Input
                  type="number"
                  value={config.border_radius ?? 24}
                  onChange={(e) => handleUpdate("border_radius", parseInt(e.target.value) || 0)}
                  placeholder="24"
                />
              </Field>
              <Field label="Preset">
                <Select
                  value={String(config.border_radius ?? 24)}
                  onValueChange={(v) => handleUpdate("border_radius", parseInt(v))}
                >
                  <Select.Trigger>
                    <Select.Value />
                  </Select.Trigger>
                  <Select.Content>
                    <Select.Item value="0">Square (0px)</Select.Item>
                    <Select.Item value="8">Subtle (8px)</Select.Item>
                    <Select.Item value="16">Rounded (16px)</Select.Item>
                    <Select.Item value="24">Pill Curved (24px)</Select.Item>
                    <Select.Item value="36">High Curve (36px)</Select.Item>
                  </Select.Content>
                </Select>
              </Field>
            </div>
          </div>

          {/* Box Shadow */}
          <div className="p-3 bg-ui-bg-subtle rounded-xl border border-ui-border-base flex flex-col gap-2">
            <Text className="text-[11px] font-bold uppercase text-ui-fg-subtle">
              Elevation & Shadow
            </Text>
            <Field label="Shadow Level">
              <Select
                value={config.shadow_preset || "medium"}
                onValueChange={(v) => handleUpdate("shadow_preset", v)}
              >
                <Select.Trigger>
                  <Select.Value />
                </Select.Trigger>
                <Select.Content>
                  <Select.Item value="none">None</Select.Item>
                  <Select.Item value="small">Small (Subtle)</Select.Item>
                  <Select.Item value="medium">Medium (Floating)</Select.Item>
                  <Select.Item value="large">Large (High Pop)</Select.Item>
                  <Select.Item value="custom">Custom CSS Shadow</Select.Item>
                </Select.Content>
              </Select>
            </Field>
            {config.shadow_preset === "custom" && (
              <Input
                value={config.custom_shadow || ""}
                onChange={(e) => handleUpdate("custom_shadow", e.target.value)}
                placeholder="0 10px 25px -5px rgba(0,0,0,0.1)"
              />
            )}
          </div>
        </div>
      )}

      {/* ────────────────────────────────────────────────────────────────────────── */}
      {/* 7. TYPOGRAPHY TAB */}
      {/* ────────────────────────────────────────────────────────────────────────── */}
      {activeSubTab === "typography" && (
        <div className="flex flex-col gap-3">
          {/* Headline Typography */}
          <div className="p-3 bg-ui-bg-subtle rounded-xl border border-ui-border-base flex flex-col gap-2.5">
            <Text className="text-xs font-bold text-rose-600 uppercase">
              Headline Typography ({sectionConfigDevice})
            </Text>
            <div className="grid grid-cols-2 gap-2">
              <Field label="Font Size">
                <Input
                  value={currentDeviceConfig.headline_font_size || (sectionConfigDevice === "mobile" ? "1.2rem" : "1.65rem")}
                  onChange={(e) => handleDevicePropUpdate("headline_font_size", e.target.value)}
                  placeholder="1.65rem or 24px"
                />
              </Field>
              <Field label="Font Weight">
                <Select
                  value={config.headline_font_weight || "900"}
                  onValueChange={(v) => handleUpdate("headline_font_weight", v)}
                >
                  <Select.Trigger>
                    <Select.Value />
                  </Select.Trigger>
                  <Select.Content>
                    <Select.Item value="900">Black (900)</Select.Item>
                    <Select.Item value="800">Extra Bold (800)</Select.Item>
                    <Select.Item value="700">Bold (700)</Select.Item>
                    <Select.Item value="600">Semi Bold (600)</Select.Item>
                  </Select.Content>
                </Select>
              </Field>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <ColorInput
                label="Headline Text Color"
                value={config.text_color || config.headline_color || "#8A3F00"}
                onChange={(val) => {
                  handleUpdate("text_color", val);
                  handleUpdate("headline_color", val);
                }}
                fallback="#8A3F00"
              />
              <Field label="Text Alignment">
                <Select
                  value={currentDeviceConfig.text_alignment || (sectionConfigDevice === "mobile" ? "center" : "left")}
                  onValueChange={(v) => handleDevicePropUpdate("text_alignment", v)}
                >
                  <Select.Trigger>
                    <Select.Value />
                  </Select.Trigger>
                  <Select.Content>
                    <Select.Item value="left">Left</Select.Item>
                    <Select.Item value="center">Center</Select.Item>
                    <Select.Item value="right">Right</Select.Item>
                  </Select.Content>
                </Select>
              </Field>
            </div>
          </div>

          {/* Subheadline Typography */}
          <div className="p-3 bg-ui-bg-subtle rounded-xl border border-ui-border-base flex flex-col gap-2.5">
            <Text className="text-xs font-bold text-rose-600 uppercase">
              Subtitle Typography ({sectionConfigDevice})
            </Text>
            <div className="grid grid-cols-2 gap-2">
              <Field label="Subtitle Font Size">
                <Input
                  value={currentDeviceConfig.subtitle_font_size || (sectionConfigDevice === "mobile" ? "0.85rem" : "0.95rem")}
                  onChange={(e) => handleDevicePropUpdate("subtitle_font_size", e.target.value)}
                  placeholder="0.95rem or 14px"
                />
              </Field>
              <ColorInput
                label="Subtitle Text Color"
                value={config.subtitle_color || "#6B3100"}
                onChange={(val) => handleUpdate("subtitle_color", val)}
                fallback="#6B3100"
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <Field label="Line Height">
                <Input
                  value={config.subtitle_line_height || "1.45"}
                  onChange={(e) => handleUpdate("subtitle_line_height", e.target.value)}
                  placeholder="1.45"
                />
              </Field>
              <Field label="Subtitle Max Width">
                <Input
                  value={config.subtitle_max_width || "680px"}
                  onChange={(e) => handleUpdate("subtitle_max_width", e.target.value)}
                  placeholder="680px"
                />
              </Field>
            </div>
          </div>
        </div>
      )}

      {/* ────────────────────────────────────────────────────────────────────────── */}
      {/* 8. CTA BUTTON TAB */}
      {/* ────────────────────────────────────────────────────────────────────────── */}
      {activeSubTab === "cta" && (
        <div className="flex flex-col gap-3">
          <div className="grid grid-cols-2 gap-2">
            <ColorInput
              label="CTA Background Color"
              value={config.cta_bg_color || "#E11D48"}
              onChange={(val) => handleUpdate("cta_bg_color", val)}
              fallback="#E11D48"
            />
            <ColorInput
              label="CTA Text Color"
              value={config.cta_text_color || "#FFFFFF"}
              onChange={(val) => handleUpdate("cta_text_color", val)}
              fallback="#FFFFFF"
            />
          </div>

          <div className="grid grid-cols-2 gap-2">
            <ColorInput
              label="CTA Hover Background"
              value={config.cta_hover_bg || "#BE123C"}
              onChange={(val) => handleUpdate("cta_hover_bg", val)}
              fallback="#BE123C"
            />
            <ColorInput
              label="CTA Hover Text Color"
              value={config.cta_hover_text_color || "#FFFFFF"}
              onChange={(val) => handleUpdate("cta_hover_text_color", val)}
              fallback="#FFFFFF"
            />
          </div>

          <div className="grid grid-cols-3 gap-2">
            <Field label="CTA Border Radius (px)">
              <Input
                type="number"
                value={config.cta_border_radius ?? 14}
                onChange={(e) => handleUpdate("cta_border_radius", parseInt(e.target.value) || 0)}
              />
            </Field>
            <Field label="Padding X (px)">
              <Input
                type="number"
                value={config.cta_padding_x ?? 24}
                onChange={(e) => handleUpdate("cta_padding_x", parseInt(e.target.value) || 0)}
              />
            </Field>
            <Field label="Padding Y (px)">
              <Input
                type="number"
                value={config.cta_padding_y ?? 12}
                onChange={(e) => handleUpdate("cta_padding_y", parseInt(e.target.value) || 0)}
              />
            </Field>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <Field label="CTA Font Weight">
              <Select
                value={config.cta_font_weight || "700"}
                onValueChange={(v) => handleUpdate("cta_font_weight", v)}
              >
                <Select.Trigger>
                  <Select.Value />
                </Select.Trigger>
                <Select.Content>
                  <Select.Item value="900">Black</Select.Item>
                  <Select.Item value="700">Bold</Select.Item>
                  <Select.Item value="600">Semi Bold</Select.Item>
                </Select.Content>
              </Select>
            </Field>
            <Field label="CTA Width Mode">
              <Select
                value={currentDeviceConfig.cta_width_mode || (sectionConfigDevice === "mobile" ? "full" : "auto")}
                onValueChange={(v) => handleDevicePropUpdate("cta_width_mode", v)}
              >
                <Select.Trigger>
                  <Select.Value />
                </Select.Trigger>
                <Select.Content>
                  <Select.Item value="auto">Auto (Fit Content)</Select.Item>
                  <Select.Item value="full">Full Width (100%)</Select.Item>
                  <Select.Item value="fixed">Fixed (200px)</Select.Item>
                </Select.Content>
              </Select>
            </Field>
          </div>
        </div>
      )}

      {/* ────────────────────────────────────────────────────────────────────────── */}
      {/* 9. LAYOUT & VISIBILITY TAB */}
      {/* ────────────────────────────────────────────────────────────────────────── */}
      {activeSubTab === "layout" && (
        <div className="flex flex-col gap-3">
          <div className="p-3 bg-ui-bg-subtle rounded-xl border border-ui-border-base flex flex-col gap-2.5">
            <Text className="text-xs font-bold text-rose-600 uppercase">
              Layout Alignment ({sectionConfigDevice})
            </Text>
            <div className="grid grid-cols-2 gap-2">
              <Field label="Banner Layout Orientation">
                <Select
                  value={currentDeviceConfig.layout_direction || (sectionConfigDevice === "mobile" ? "vertical" : "horizontal")}
                  onValueChange={(v) => handleDevicePropUpdate("layout_direction", v)}
                >
                  <Select.Trigger>
                    <Select.Value />
                  </Select.Trigger>
                  <Select.Content>
                    <Select.Item value="horizontal">Horizontal (Text Left / CTA Right)</Select.Item>
                    <Select.Item value="horizontal-center">Horizontal (Centered)</Select.Item>
                    <Select.Item value="vertical">Vertical (Stacked)</Select.Item>
                  </Select.Content>
                </Select>
              </Field>
              <Field label="Vertical Alignment">
                <Select
                  value={config.vertical_align || "center"}
                  onValueChange={(v) => handleUpdate("vertical_align", v)}
                >
                  <Select.Trigger>
                    <Select.Value />
                  </Select.Trigger>
                  <Select.Content>
                    <Select.Item value="center">Center</Select.Item>
                    <Select.Item value="start">Top</Select.Item>
                    <Select.Item value="end">Bottom</Select.Item>
                  </Select.Content>
                </Select>
              </Field>
            </div>
          </div>

          {/* Visibility Controls */}
          <div className="p-3 bg-ui-bg-subtle rounded-xl border border-ui-border-base flex flex-col gap-2.5">
            <div className="flex items-center justify-between">
              <Text className="text-xs font-bold">Section Visibility</Text>
              <Toggle
                checked={section.enabled !== false}
                onChange={(v) => handleUpdate("enabled", v)}
                label="Section Visibility"
              />
            </div>
            <Field label="Target Devices">
              <Select
                value={config.target_devices || "all"}
                onValueChange={(v) => handleUpdate("target_devices", v)}
              >
                <Select.Trigger>
                  <Select.Value />
                </Select.Trigger>
                <Select.Content>
                  <Select.Item value="all">All Devices (Desktop + Tablet + Mobile)</Select.Item>
                  <Select.Item value="desktop_only">Desktop Only</Select.Item>
                  <Select.Item value="mobile_only">Mobile Only</Select.Item>
                  <Select.Item value="tablet_desktop">Tablet & Desktop Only</Select.Item>
                </Select.Content>
              </Select>
            </Field>
          </div>
        </div>
      )}
    </div>
  );
}
