"use client";

import React, { useState } from "react";
import { Heading, Text, Button, Input, Label, Textarea, Select } from "@medusajs/ui";
import {
  Sparkles, Clock, Truck, ShieldCheck, Award, Heart, Star, Gift,
  Zap, Check, Tag, Smile, CheckCircle2, Plus, Trash2, ArrowUp,
  ArrowDown, Copy, ExternalLink, Palette, LayoutGrid
} from "lucide-react";

interface FeaturesSectionEditorProps {
  config: Record<string, any>;
  onChange: (key: string, val: any) => void;
}

const AVAILABLE_ICONS = [
  { name: "Sparkles", label: "Sparkles / Artisan", icon: Sparkles },
  { name: "Clock", label: "Clock / Fast Delivery", icon: Clock },
  { name: "Truck", label: "Truck / Express Shipping", icon: Truck },
  { name: "ShieldCheck", label: "Shield / Safe & Hygienic", icon: ShieldCheck },
  { name: "Award", label: "Award / Premium Quality", icon: Award },
  { name: "Heart", label: "Heart / Made with Love", icon: Heart },
  { name: "Star", label: "Star / 5-Star Rated", icon: Star },
  { name: "Gift", label: "Gift / Celebration Bakes", icon: Gift },
  { name: "Zap", label: "Zap / Midnight Slots", icon: Zap },
  { name: "CheckCircle2", label: "Check / Pure Ingredients", icon: CheckCircle2 },
  { name: "Tag", label: "Tag / Best Value", icon: Tag },
  { name: "Smile", label: "Smile / 100% Satisfaction", icon: Smile },
];

function Field({ label, hint, children }: { label: string | React.ReactNode; hint?: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label className="text-xs font-semibold text-ui-fg-base">{label}</Label>
      {children}
      {hint && <p className="text-[11px] text-ui-fg-muted">{hint}</p>}
    </div>
  );
}

function ColorField({ label, value, onChange, fallback = "#e11d48" }: { label: string; value?: string; onChange: (val: string) => void; fallback?: string }) {
  const safeVal = value || fallback;
  return (
    <div className="flex flex-col gap-1">
      <span className="text-[11px] text-ui-fg-muted font-medium">{label}</span>
      <div className="flex items-center gap-2">
        <input
          type="color"
          value={safeVal.startsWith("#") ? safeVal : fallback}
          onChange={(e) => onChange(e.target.value)}
          className="h-7 w-8 rounded border border-ui-border-base cursor-pointer p-0.5 bg-transparent"
        />
        <Input
          size="small"
          value={value || ""}
          onChange={(e) => onChange(e.target.value)}
          placeholder={fallback}
          className="text-xs h-7 font-mono"
        />
      </div>
    </div>
  );
}

export function FeaturesSectionEditor({ config, onChange }: FeaturesSectionEditorProps) {
  const [activeItemIndex, setActiveItemIndex] = useState<number | null>(0);
  const features: any[] = Array.isArray(config.features) ? config.features : [];

  const updateFeature = (index: number, field: string, val: any) => {
    const next = [...features];
    next[index] = { ...next[index], [field]: val };
    onChange("features", next);
  };

  const addFeature = () => {
    const newItem = {
      id: `feat_${Date.now()}`,
      icon: "Sparkles",
      icon_type: "lucide",
      title: "New Feature / Benefit",
      description: "Describe the unique ingredient, process, or guarantee.",
      icon_color: "#e11d48",
      title_color: "",
      description_color: "",
      bg_color: "",
      border_color: "",
      link_text: "",
      link_url: "",
      open_in_new_tab: false,
    };
    const next = [...features, newItem];
    onChange("features", next);
    setActiveItemIndex(next.length - 1);
  };

  const duplicateFeature = (index: number) => {
    const item = features[index];
    const clone = {
      ...item,
      id: `feat_${Date.now()}`,
      title: `${item.title || "Feature"} (Copy)`,
    };
    const next = [...features];
    next.splice(index + 1, 0, clone);
    onChange("features", next);
    setActiveItemIndex(index + 1);
  };

  const removeFeature = (index: number) => {
    const next = features.filter((_, i) => i !== index);
    onChange("features", next);
    if (activeItemIndex === index) {
      setActiveItemIndex(next.length > 0 ? Math.max(0, index - 1) : null);
    } else if (activeItemIndex !== null && activeItemIndex > index) {
      setActiveItemIndex(activeItemIndex - 1);
    }
  };

  const moveFeature = (index: number, direction: "up" | "down") => {
    const target = direction === "up" ? index - 1 : index + 1;
    if (target < 0 || target >= features.length) return;
    const next = [...features];
    const [moved] = next.splice(index, 1);
    next.splice(target, 0, moved);
    onChange("features", next);
    setActiveItemIndex(target);
  };

  return (
    <div className="flex flex-col gap-4">
      {/* Section Level Controls */}
      <div className="p-3.5 bg-ui-bg-subtle rounded-2xl border border-ui-border-base flex flex-col gap-3">
        <div className="flex items-center gap-2">
          <LayoutGrid className="w-4 h-4 text-rose-600" />
          <Text className="text-xs font-bold uppercase tracking-wider text-rose-600">Features Section Settings</Text>
        </div>

        <Field label="Section Heading">
          <Input
            value={config.heading || ""}
            onChange={(e) => onChange("heading", e.target.value)}
            placeholder="Why CakeToHome is Bangalore's #1 Choice"
          />
        </Field>

        <Field label="Section Subtitle">
          <Textarea
            value={config.subtitle || config.subheading || ""}
            onChange={(e) => {
              onChange("subtitle", e.target.value);
              onChange("subheading", e.target.value);
            }}
            placeholder="We take immense pride in every handcrafted layer, delivering pure joy to your doorstep"
            rows={2}
          />
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Heading Alignment">
            <Select value={config.alignment || "center"} onValueChange={(v) => onChange("alignment", v)}>
              <Select.Trigger><Select.Value /></Select.Trigger>
              <Select.Content>
                <Select.Item value="left">Left Aligned</Select.Item>
                <Select.Item value="center">Center Aligned</Select.Item>
                <Select.Item value="right">Right Aligned</Select.Item>
              </Select.Content>
            </Select>
          </Field>

          <Field label="Desktop Grid Columns">
            <Select value={String(config.columns || 4)} onValueChange={(v) => onChange("columns", parseInt(v) || 4)}>
              <Select.Trigger><Select.Value /></Select.Trigger>
              <Select.Content>
                <Select.Item value="1">1 Column</Select.Item>
                <Select.Item value="2">2 Columns</Select.Item>
                <Select.Item value="3">3 Columns</Select.Item>
                <Select.Item value="4">4 Columns (Standard)</Select.Item>
                <Select.Item value="6">6 Columns</Select.Item>
                <Select.Item value="8">8 Columns</Select.Item>
                <Select.Item value="12">12 Columns</Select.Item>
              </Select.Content>
            </Select>
          </Field>
        </div>
      </div>

      {/* Feature Items Repeater */}
      <div className="flex flex-col gap-2.5">
        <div className="flex items-center justify-between">
          <Text className="text-xs font-bold text-ui-fg-base">
            Feature Cards ({features.length})
          </Text>
          <Button variant="secondary" size="small" onClick={addFeature} className="text-xs flex items-center gap-1">
            <Plus className="w-3.5 h-3.5" /> Add Feature
          </Button>
        </div>

        {features.length === 0 ? (
          <div className="p-6 text-center border border-dashed border-ui-border-base rounded-2xl bg-ui-bg-subtle text-ui-fg-muted text-xs">
            No features added yet. Click &quot;Add Feature&quot; to highlight bakery benefits.
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {features.map((item, idx) => {
              const isExpanded = activeItemIndex === idx;
              const IconComp = AVAILABLE_ICONS.find(i => i.name === item.icon)?.icon || Sparkles;

              return (
                <div
                  key={item.id || idx}
                  className={`border rounded-xl transition-all overflow-hidden bg-ui-bg-base ${isExpanded ? "border-rose-300 shadow-sm" : "border-ui-border-base"}`}
                >
                  {/* Card Header Summary */}
                  <div
                    onClick={() => setActiveItemIndex(isExpanded ? null : idx)}
                    className="p-3 flex items-center justify-between cursor-pointer hover:bg-ui-bg-subtle/50 transition-colors"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div
                        className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0 border border-ui-border-base"
                        style={{ backgroundColor: item.bg_color || "#fff1f2", color: item.icon_color || "#e11d48" }}
                      >
                        <IconComp className="w-4 h-4" />
                      </div>
                      <span className="text-xs font-bold text-ui-fg-base truncate">
                        #{idx + 1}: {item.title || "Untitled Feature"}
                      </span>
                    </div>

                    {/* Repeater Actions */}
                    <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                      <button
                        type="button"
                        disabled={idx === 0}
                        onClick={() => moveFeature(idx, "up")}
                        className="p-1 text-ui-fg-muted hover:text-ui-fg-base disabled:opacity-30 rounded"
                        title="Move Up"
                      >
                        <ArrowUp className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        disabled={idx === features.length - 1}
                        onClick={() => moveFeature(idx, "down")}
                        className="p-1 text-ui-fg-muted hover:text-ui-fg-base disabled:opacity-30 rounded"
                        title="Move Down"
                      >
                        <ArrowDown className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => duplicateFeature(idx)}
                        className="p-1 text-ui-fg-muted hover:text-ui-fg-base rounded"
                        title="Duplicate"
                      >
                        <Copy className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => removeFeature(idx)}
                        className="p-1 text-red-500 hover:text-red-700 rounded"
                        title="Delete"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  {/* Expanded Item Form */}
                  {isExpanded && (
                    <div className="p-3.5 pt-0 border-t border-ui-border-base bg-ui-bg-subtle/30 flex flex-col gap-3 mt-2">
                      <div className="flex items-center justify-between pt-2 pb-1 border-b border-ui-border-base">
                        <span className="text-xs font-bold text-ui-fg-base">Card Visibility</span>
                        <label className="flex items-center gap-2 cursor-pointer text-xs">
                          <input
                            type="checkbox"
                            checked={item.visible !== false}
                            onChange={(e) => updateFeature(idx, "visible", e.target.checked)}
                            className="rounded border-ui-border-base text-rose-600 focus:ring-rose-500"
                          />
                          <span className={item.visible !== false ? "text-emerald-600 font-bold" : "text-ui-fg-muted"}>
                            {item.visible !== false ? "Visible on Storefront" : "Hidden"}
                          </span>
                        </label>
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                        <Field label="Preset Lucide Icon">
                          <Select value={item.icon || "Sparkles"} onValueChange={(v) => updateFeature(idx, "icon", v)}>
                            <Select.Trigger><Select.Value /></Select.Trigger>
                            <Select.Content>
                              {AVAILABLE_ICONS.map((ico) => (
                                <Select.Item key={ico.name} value={ico.name}>
                                  {ico.label}
                                </Select.Item>
                              ))}
                            </Select.Content>
                          </Select>
                        </Field>

                        <Field label="Or Custom Emoji / Icon" hint="Type an emoji like 🎂, 🌿, 🚚, 🛡️, ⭐">
                          <Input
                            size="small"
                            value={item.icon || ""}
                            onChange={(e) => updateFeature(idx, "icon", e.target.value)}
                            placeholder="e.g. 🎂 or Sparkles"
                          />
                        </Field>
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                        <ColorField
                          label="Icon Tint Color"
                          value={item.icon_color}
                          onChange={(val) => updateFeature(idx, "icon_color", val)}
                          fallback="#e11d48"
                        />
                        <Field label="Icon Background Color">
                          <Input
                            size="small"
                            value={item.icon_bg_color || ""}
                            onChange={(e) => updateFeature(idx, "icon_bg_color", e.target.value)}
                            placeholder="e.g. #fff1f2 or transparent"
                          />
                        </Field>
                      </div>

                      <Field label="Feature Title">
                        <Input
                          value={item.title || ""}
                          onChange={(e) => updateFeature(idx, "title", e.target.value)}
                          placeholder="e.g. 100% Real Dairy Butter"
                        />
                      </Field>

                      <Field label="Feature Description">
                        <Textarea
                          value={item.description || item.desc || ""}
                          onChange={(e) => {
                            updateFeature(idx, "description", e.target.value);
                            updateFeature(idx, "desc", e.target.value);
                          }}
                          placeholder="Explain the guarantee, ingredient, or standard..."
                          rows={2}
                        />
                      </Field>

                      <div className="grid grid-cols-2 gap-3">
                        <ColorField
                          label="Card Background Color"
                          value={item.bg_color}
                          onChange={(val) => updateFeature(idx, "bg_color", val)}
                          fallback="#ffffff"
                        />
                        <ColorField
                          label="Card Border Color"
                          value={item.border_color}
                          onChange={(val) => updateFeature(idx, "border_color", val)}
                          fallback="#e2e8f0"
                        />
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                        <Field label="Optional Link Text">
                          <Input
                            size="small"
                            value={item.link_text || ""}
                            onChange={(e) => updateFeature(idx, "link_text", e.target.value)}
                            placeholder="Learn More"
                          />
                        </Field>
                        <Field label="Optional Link URL">
                          <Input
                            size="small"
                            value={item.link_url || ""}
                            onChange={(e) => updateFeature(idx, "link_url", e.target.value)}
                            placeholder="/about"
                          />
                        </Field>
                      </div>

                      <div className="flex items-center justify-between pt-1">
                        <span className="text-xs text-ui-fg-muted">Open Link in New Tab</span>
                        <input
                          type="checkbox"
                          checked={item.open_in_new_tab === true}
                          onChange={(e) => updateFeature(idx, "open_in_new_tab", e.target.checked)}
                          className="rounded border-ui-border-base text-rose-600 focus:ring-rose-500"
                        />
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
