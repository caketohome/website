"use client";

import React from "react";
import { Heading, Text, Input, Label, Textarea, Select } from "@medusajs/ui";
import { Gift, Database, CheckSquare, Sparkles, LayoutGrid, Sliders, Eye, Image as ImageIcon } from "lucide-react";

interface OccasionsGridEditorProps {
  config: Record<string, any>;
  allOccasions: any[];
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

export function OccasionsGridEditor({ config, allOccasions = [], onChange }: OccasionsGridEditorProps) {
  const dataSource = config.data_source || "pim";
  const occasionMode = config.occasion_mode || "all_active";
  const selectedOccasions: string[] = Array.isArray(config.selected_occasions) ? config.selected_occasions : [];

  const toggleOccasion = (occIdOrSlug: string) => {
    const isSelected = selectedOccasions.includes(occIdOrSlug);
    const updated = isSelected
      ? selectedOccasions.filter(id => id !== occIdOrSlug)
      : [...selectedOccasions, occIdOrSlug];
    onChange("selected_occasions", updated);
  };

  return (
    <div className="flex flex-col gap-4">
      {/* 1. Headings & Eyebrow */}
      <div className="p-3.5 bg-ui-bg-subtle rounded-2xl border border-ui-border-base flex flex-col gap-3">
        <Text className="text-xs font-bold uppercase tracking-wider text-pink-600 flex items-center gap-1.5">
          <Gift className="w-3.5 h-3.5" /> Occasion Section Headings
        </Text>

        <Field label="Section Eyebrow / Label">
          <Input
            value={config.section_label || config.badge_text || ""}
            onChange={(e) => onChange("section_label", e.target.value)}
            placeholder="CELEBRATIONS & OCCASIONS"
          />
        </Field>

        <Field label="Section Heading">
          <Input
            value={config.heading || ""}
            onChange={(e) => onChange("heading", e.target.value)}
            placeholder="Celebrate Every Occasion"
          />
        </Field>

        <Field label="Section Subheading">
          <Textarea
            value={config.subheading || ""}
            onChange={(e) => onChange("subheading", e.target.value)}
            placeholder="Handcrafted cakes tailored for birthdays, anniversaries, and joyful milestones"
            rows={2}
          />
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field label="View All Button Text">
            <Input
              value={config.view_all_text || ""}
              onChange={(e) => onChange("view_all_text", e.target.value)}
              placeholder="View All Occasions →"
            />
          </Field>
          <Field label="View All URL">
            <Input
              value={config.view_all_url || ""}
              onChange={(e) => onChange("view_all_url", e.target.value)}
              placeholder="/occasions"
            />
          </Field>
        </div>
      </div>

      {/* 2. PIM Data Source Configuration */}
      <div className="p-3.5 bg-ui-bg-subtle rounded-2xl border border-ui-border-base flex flex-col gap-3">
        <Text className="text-xs font-bold uppercase tracking-wider text-rose-600 flex items-center gap-1.5">
          <Database className="w-3.5 h-3.5" /> Data Source & PIM Integration
        </Text>

        <Field label="Occasion Data Source">
          <Select value={dataSource} onValueChange={(v) => onChange("data_source", v)}>
            <Select.Trigger><Select.Value /></Select.Trigger>
            <Select.Content>
              <Select.Item value="pim">PIM Database Occasions (Live)</Select.Item>
              <Select.Item value="manual">Manual Occasion Cards</Select.Item>
            </Select.Content>
          </Select>
        </Field>

        {dataSource === "pim" && (
          <div className="p-2.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-[11px] text-emerald-800 dark:text-emerald-300 flex items-center gap-2">
            <Sparkles className="w-4 h-4 shrink-0 text-emerald-600" />
            <span>Cards are rendered from live PIM occasion records with individual cover images.</span>
          </div>
        )}

        {dataSource === "pim" && (
          <Field label="Occasion Selection Mode">
            <Select value={occasionMode} onValueChange={(v) => onChange("occasion_mode", v)}>
              <Select.Trigger><Select.Value /></Select.Trigger>
              <Select.Content>
                <Select.Item value="all_active">All Active Occasions ({allOccasions.length})</Select.Item>
                <Select.Item value="selected">Select Specific Occasions ({selectedOccasions.length} chosen)</Select.Item>
                <Select.Item value="featured">Featured Occasions Only</Select.Item>
              </Select.Content>
            </Select>
          </Field>
        )}

        {/* Live PIM Occasion Checkboxes */}
        {dataSource === "pim" && occasionMode === "selected" && (
          <div className="flex flex-col gap-2 p-3 bg-ui-bg-base rounded-xl border border-ui-border-base">
            <div className="flex items-center justify-between">
              <Text className="text-xs font-bold text-ui-fg-base">Available PIM Occasions</Text>
              {selectedOccasions.length > 0 && (
                <button
                  type="button"
                  onClick={() => onChange("selected_occasions", [])}
                  className="text-[10px] text-red-500 hover:underline"
                >
                  Clear Selection
                </button>
              )}
            </div>

            {allOccasions.length === 0 ? (
              <p className="text-xs text-ui-fg-muted italic">No occasions found in PIM database.</p>
            ) : (
              <div className="max-h-48 overflow-y-auto flex flex-col gap-1.5 p-1">
                {allOccasions.map((occ) => {
                  const key = occ.slug || occ.id || occ.name;
                  const isChecked = selectedOccasions.includes(key) || selectedOccasions.includes(occ.id);
                  return (
                    <label
                      key={occ.id || occ.name}
                      className={`flex items-center justify-between p-2 rounded-lg cursor-pointer text-xs border transition-all ${isChecked ? "bg-rose-50 border-rose-300 font-bold text-rose-700" : "bg-ui-bg-subtle/50 border-ui-border-base hover:bg-ui-bg-subtle"}`}
                    >
                      <span className="flex items-center gap-2 truncate">
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => toggleOccasion(key)}
                          className="rounded border-ui-border-base text-rose-600 focus:ring-rose-500"
                        />
                        <span className="truncate">{occ.emoji || occ.icon || "🎂"} {occ.name || occ.title}</span>
                      </span>
                      {occ.is_featured && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 shrink-0">Featured</span>
                      )}
                    </label>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>

      {/* 3. Layout & Presentation Settings */}
      <div className="p-3.5 bg-ui-bg-subtle rounded-2xl border border-ui-border-base flex flex-col gap-3">
        <Text className="text-xs font-bold uppercase tracking-wider text-blue-600 flex items-center gap-1.5">
          <LayoutGrid className="w-3.5 h-3.5" /> Layout & Grid Configuration
        </Text>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Display Layout">
            <Select value={config.layout || "grid"} onValueChange={(v) => onChange("layout", v)}>
              <Select.Trigger><Select.Value /></Select.Trigger>
              <Select.Content>
                <Select.Item value="grid">Grid (Responsive Tiles)</Select.Item>
                <Select.Item value="carousel">Carousel (Horizontal Scroll)</Select.Item>
              </Select.Content>
            </Select>
          </Field>

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
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Card Aspect Ratio">
            <Select value={config.aspect_ratio || "aspect-[4/3]"} onValueChange={(v) => onChange("aspect_ratio", v)}>
              <Select.Trigger><Select.Value /></Select.Trigger>
              <Select.Content>
                <Select.Item value="aspect-[4/3]">4:3 Standard</Select.Item>
                <Select.Item value="aspect-square">1:1 Square</Select.Item>
                <Select.Item value="aspect-[16/9]">16:9 Landscape</Select.Item>
                <Select.Item value="aspect-[3/4]">3:4 Portrait</Select.Item>
                <Select.Item value="aspect-[2/3]">2:3 Tall</Select.Item>
              </Select.Content>
            </Select>
          </Field>

          <Field label="Overlay Gradient Opacity">
            <Select value={String(config.overlay_opacity ?? 80)} onValueChange={(v) => onChange("overlay_opacity", parseInt(v) || 80)}>
              <Select.Trigger><Select.Value /></Select.Trigger>
              <Select.Content>
                <Select.Item value="90">90% Dark Contrast</Select.Item>
                <Select.Item value="80">80% Standard Tint</Select.Item>
                <Select.Item value="65">65% Medium Subtle</Select.Item>
                <Select.Item value="50">50% Light Wash</Select.Item>
                <Select.Item value="30">30% Minimal Wash</Select.Item>
              </Select.Content>
            </Select>
          </Field>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Image Fit">
            <Select value={config.image_fit || "cover"} onValueChange={(v) => onChange("image_fit", v)}>
              <Select.Trigger><Select.Value /></Select.Trigger>
              <Select.Content>
                <Select.Item value="cover">Cover (Fill & Crop)</Select.Item>
                <Select.Item value="contain">Contain (Full Image)</Select.Item>
              </Select.Content>
            </Select>
          </Field>

          <Field label="Image Focal Position">
            <Select value={config.image_position || "center"} onValueChange={(v) => onChange("image_position", v)}>
              <Select.Trigger><Select.Value /></Select.Trigger>
              <Select.Content>
                <Select.Item value="center">Center</Select.Item>
                <Select.Item value="top">Top Focus</Select.Item>
                <Select.Item value="bottom">Bottom Focus</Select.Item>
              </Select.Content>
            </Select>
          </Field>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Card Border Radius">
            <Select value={config.card_radius || "rounded-2xl"} onValueChange={(v) => onChange("card_radius", v)}>
              <Select.Trigger><Select.Value /></Select.Trigger>
              <Select.Content>
                <Select.Item value="rounded-2xl">2xl Large Curvature</Select.Item>
                <Select.Item value="rounded-xl">xl Medium Curvature</Select.Item>
                <Select.Item value="rounded-3xl">3xl Extra Curvature</Select.Item>
                <Select.Item value="rounded-lg">lg Subtle Curvature</Select.Item>
                <Select.Item value="rounded-none">Square / No Radius</Select.Item>
              </Select.Content>
            </Select>
          </Field>

          <Field label="Max Cards Count (Limit)">
            <Input
              type="number"
              value={config.limit || ""}
              onChange={(e) => onChange("limit", e.target.value ? parseInt(e.target.value) : undefined)}
              placeholder="All active occasions"
            />
          </Field>
        </div>
      </div>

      {/* 4. Display Toggles */}
      <div className="p-3.5 bg-ui-bg-subtle rounded-2xl border border-ui-border-base flex flex-col gap-3">
        <Text className="text-xs font-bold uppercase tracking-wider text-purple-600 flex items-center gap-1.5">
          <Eye className="w-3.5 h-3.5" /> Card Content Elements
        </Text>

        <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-xs">
          <div className="flex items-center justify-between">
            <span>Show Occasion Emoji</span>
            <Toggle checked={config.show_emoji !== false} onChange={(v) => onChange("show_emoji", v)} label="Show Emoji" />
          </div>
          <div className="flex items-center justify-between">
            <span>Show Occasion Title</span>
            <Toggle checked={config.show_title !== false} onChange={(v) => onChange("show_title", v)} label="Show Title" />
          </div>
          <div className="flex items-center justify-between">
            <span>Show Short Description</span>
            <Toggle checked={config.show_description !== false} onChange={(v) => onChange("show_description", v)} label="Show Description" />
          </div>
          <div className="flex items-center justify-between">
            <span>Show Explore CTA Link</span>
            <Toggle checked={config.show_cta !== false} onChange={(v) => onChange("show_cta", v)} label="Show CTA" />
          </div>
        </div>
      </div>
    </div>
  );
}
