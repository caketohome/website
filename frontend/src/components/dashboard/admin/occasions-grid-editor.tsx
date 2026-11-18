"use client";

import React, { useState, useEffect, useMemo } from "react";
import { Heading, Text, Input, Label, Textarea, Select, Button, Badge } from "@medusajs/ui";
import {
  Gift, Database, CheckSquare, Sparkles, LayoutGrid, Sliders,
  Eye, Image as ImageIcon, Plus, Trash2, ArrowUp, ArrowDown,
  Search, Check, X, ChevronDown, ChevronUp, ExternalLink,
  Layers, Link as LinkIcon, AlertCircle, RefreshCw, CheckCircle2
} from "lucide-react";
import { MediaSelectorModal, type MediaSelection } from "./media-selector-modal";
import { apiClient } from "@frontend/lib/api-client";

export interface ManualOccasionCard {
  id: string;
  name: string;
  title?: string;
  slug: string;
  emoji?: string;
  icon?: string;
  cover_image?: string;
  image?: string;
  thumbnail_image?: string;
  short_description?: string;
  description?: string;
  url?: string;
  link?: string;
  is_active?: boolean;
  display_order?: number;
}

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
      className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors focus:outline-none ${checked ? "bg-brand-navy border border-brand-gold/50" : "bg-ui-bg-component border border-ui-border-base"}`}
      aria-label={label}
    >
      <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform shadow ${checked ? "translate-x-4" : "translate-x-0.5"}`} />
    </button>
  );
}

const EMOJI_PRESETS = ["🎂", "💍", "🎓", "👶", "🎉", "💖", "💐", "🌟", "🎄", "🎆", "✨", "👑"];

// ── Occasion Chooser Modal Component ─────────────────────────────────────────
interface OccasionChooserModalProps {
  isOpen: boolean;
  onClose: () => void;
  onApply: (selectedOccasions: any[]) => void;
  availableOccasions: any[];
  currentCards: ManualOccasionCard[];
}

function OccasionChooserModal({
  isOpen,
  onClose,
  onApply,
  availableOccasions,
  currentCards,
}: OccasionChooserModalProps) {
  const [search, setSearch] = useState("");
  const [selectedKeys, setSelectedKeys] = useState<Set<string>>(new Set());

  // Initialize selected keys from currentCards when modal opens
  useEffect(() => {
    if (isOpen) {
      const keys = new Set<string>();
      currentCards.forEach((c) => {
        if (c.id) keys.add(c.id);
        if (c.slug) keys.add(c.slug);
      });
      setSelectedKeys(keys);
      setSearch("");
    }
  }, [isOpen, currentCards]);

  const filteredOccasions = useMemo(() => {
    const q = search.trim().toLowerCase();
    return availableOccasions.filter((occ) => {
      if (occ.status === "archived") return false;
      if (!q) return true;
      const name = (occ.name || occ.title || "").toLowerCase();
      const slug = (occ.slug || "").toLowerCase();
      return name.includes(q) || slug.includes(q);
    });
  }, [availableOccasions, search]);

  if (!isOpen) return null;

  const toggleSelect = (occ: any) => {
    const key = occ.id || occ.slug;
    setSelectedKeys((prev) => {
      const next = new Set(prev);
      if (next.has(key) || (occ.slug && next.has(occ.slug)) || (occ.id && next.has(occ.id))) {
        if (occ.id) next.delete(occ.id);
        if (occ.slug) next.delete(occ.slug);
      } else {
        next.add(key);
      }
      return next;
    });
  };

  const handleSelectAll = () => {
    setSelectedKeys((prev) => {
      const next = new Set(prev);
      filteredOccasions.forEach((occ) => {
        if (occ.id) next.add(occ.id);
        if (occ.slug) next.add(occ.slug);
      });
      return next;
    });
  };

  const handleDeselectAll = () => {
    setSelectedKeys(new Set());
  };

  const handleConfirm = () => {
    // Collect chosen occasions from availableOccasions matching selectedKeys
    const chosen = availableOccasions.filter((occ) => {
      return (occ.id && selectedKeys.has(occ.id)) || (occ.slug && selectedKeys.has(occ.slug));
    });
    onApply(chosen);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-ui-bg-base border border-ui-border-base rounded-2xl shadow-2xl max-w-2xl w-full max-h-[85vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="p-4 border-b border-ui-border-base flex items-center justify-between bg-ui-bg-subtle">
          <div>
            <h3 className="text-sm font-bold text-ui-fg-base flex items-center gap-2">
              <Gift className="w-4 h-4 text-brand-gold" /> Choose Occasion Cards
            </h3>
            <p className="text-[11px] text-ui-fg-muted mt-0.5">
              Select occasions from your catalog to display in this section.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-lg hover:bg-ui-bg-base text-ui-fg-muted hover:text-ui-fg-base transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Search & Actions Bar */}
        <div className="p-3 border-b border-ui-border-base bg-ui-bg-base flex flex-col sm:flex-row gap-2.5 items-center justify-between">
          <div className="relative w-full sm:flex-1">
            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-ui-fg-muted" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search occasions by name or slug..."
              className="w-full pl-8 pr-3 py-1.5 text-xs rounded-xl bg-ui-bg-subtle border border-ui-border-base focus:outline-none focus:ring-1 focus:ring-brand-navy dark:focus:ring-brand-gold"
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch("")}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-ui-fg-muted hover:text-ui-fg-base text-xs"
              >
                ×
              </button>
            )}
          </div>
          <div className="flex items-center gap-2 shrink-0 text-xs">
            <button
              type="button"
              onClick={handleSelectAll}
              className="px-2.5 py-1 rounded-lg border border-ui-border-base hover:bg-ui-bg-subtle text-[11px] font-medium"
            >
              Select All
            </button>
            <button
              type="button"
              onClick={handleDeselectAll}
              className="px-2.5 py-1 rounded-lg border border-ui-border-base hover:bg-ui-bg-subtle text-[11px] font-medium text-ui-fg-muted"
            >
              Clear
            </button>
          </div>
        </div>

        {/* Scrollable Occasions Grid */}
        <div className="p-4 overflow-y-auto max-h-[50vh] flex-1">
          {filteredOccasions.length === 0 ? (
            <div className="py-12 text-center text-xs text-ui-fg-muted">
              <Gift className="w-8 h-8 mx-auto mb-2 text-ui-fg-muted/60" />
              <p className="font-semibold">No occasions found</p>
              <p className="text-[11px] mt-0.5">Try searching with a different keyword</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {filteredOccasions.map((occ) => {
                const isSelected =
                  (occ.id && selectedKeys.has(occ.id)) ||
                  (occ.slug && selectedKeys.has(occ.slug));
                const coverImg = occ.cover_image || occ.image || occ.thumbnail_image;

                return (
                  <div
                    key={occ.id || occ.slug}
                    onClick={() => toggleSelect(occ)}
                    className={`p-2.5 rounded-xl border cursor-pointer transition-all flex items-center gap-3 select-none ${
                      isSelected
                        ? "bg-brand-navy/5 dark:bg-brand-gold/10 border-brand-navy dark:border-brand-gold ring-1 ring-brand-navy dark:ring-brand-gold"
                        : "bg-ui-bg-subtle/50 border-ui-border-base hover:bg-ui-bg-subtle"
                    }`}
                  >
                    {/* Checkbox indicator */}
                    <div
                      className={`w-4 h-4 rounded flex items-center justify-center shrink-0 transition-colors ${
                        isSelected
                          ? "bg-brand-navy dark:bg-brand-gold text-white dark:text-black"
                          : "border border-ui-border-base bg-ui-bg-base"
                      }`}
                    >
                      {isSelected && <Check className="w-3 h-3 stroke-[3]" />}
                    </div>

                    {/* Thumbnail */}
                    <div className="w-10 h-10 rounded-lg overflow-hidden bg-ui-bg-base border border-ui-border-base shrink-0 flex items-center justify-center text-base">
                      {coverImg ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={coverImg}
                          alt={occ.name || occ.title}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <span>{occ.emoji || occ.icon || "🎂"}</span>
                      )}
                    </div>

                    {/* Info */}
                    <div className="flex flex-col min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs font-bold text-ui-fg-base truncate">
                          {occ.emoji || occ.icon || "🎂"} {occ.name || occ.title}
                        </span>
                        {occ.is_featured && (
                          <span className="text-[9px] px-1.5 py-0.2 rounded bg-brand-gold-light text-brand-gold-dark shrink-0 font-medium">
                            Featured
                          </span>
                        )}
                      </div>
                      <span className="text-[10px] text-ui-fg-muted font-mono truncate">
                        /occasions/{occ.slug || (occ.id ? String(occ.id).replace(/^occ_/, "").replace(/_/g, "-") : "")}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-3.5 border-t border-ui-border-base bg-ui-bg-subtle flex items-center justify-between">
          <span className="text-xs text-ui-fg-muted font-medium">
            {availableOccasions.filter(o => selectedKeys.has(o.id) || selectedKeys.has(o.slug)).length} of {availableOccasions.length} occasions selected
          </span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-1.5 rounded-xl border border-ui-border-base text-xs font-semibold hover:bg-ui-bg-base transition-colors"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleConfirm}
              className="px-4 py-1.5 rounded-xl bg-brand-navy hover:bg-brand-deep text-white font-bold text-xs shadow-sm border border-brand-gold/40 flex items-center gap-1.5 transition-all"
            >
              <Check className="w-3.5 h-3.5" /> Apply Selection
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Main OccasionsGridEditor Component ────────────────────────────────────────
export function OccasionsGridEditor({ config, allOccasions = [], onChange }: OccasionsGridEditorProps) {
  const dataSource = config.data_source || "pim";
  const occasionMode = config.occasion_mode || "all_active";
  const selectedOccasions: string[] = Array.isArray(config.selected_occasions) ? config.selected_occasions : [];
  const manualOccasions: ManualOccasionCard[] = Array.isArray(config.manual_occasions)
    ? config.manual_occasions
    : Array.isArray(config.occasion_cards)
    ? config.occasion_cards
    : Array.isArray(config.manual_cards)
    ? config.manual_cards
    : [];

  const [expandedCardIndex, setExpandedCardIndex] = useState<number | null>(null);
  const [isChooserOpen, setIsChooserOpen] = useState(false);
  const [mediaPickerCardIndex, setMediaPickerCardIndex] = useState<number | null>(null);
  const [loadedOccasions, setLoadedOccasions] = useState<any[]>(allOccasions);

  // Ensure available occasions are loaded defensively
  useEffect(() => {
    if (allOccasions && allOccasions.length > 0) {
      setLoadedOccasions(allOccasions);
    } else {
      apiClient.getAdminOccasions().then((res: any) => {
        if (res?.occasions && Array.isArray(res.occasions)) {
          setLoadedOccasions(res.occasions);
        }
      }).catch(() => {});
    }
  }, [allOccasions]);

  // Handle data source toggle while preserving manual card selection
  const handleDataSourceChange = (newSource: string) => {
    onChange("data_source", newSource);
  };

  const togglePimOccasion = (occIdOrSlug: string) => {
    const isSelected = selectedOccasions.includes(occIdOrSlug);
    const updated = isSelected
      ? selectedOccasions.filter(id => id !== occIdOrSlug)
      : [...selectedOccasions, occIdOrSlug];
    onChange("selected_occasions", updated);
  };

  // ── Manual Cards Mutation Helpers ──
  const handleAddCustomCard = () => {
    const newCard: ManualOccasionCard = {
      id: `occ_manual_${Date.now()}`,
      name: "Custom Celebration",
      title: "Custom Celebration",
      slug: "custom-occasion",
      emoji: "🎂",
      icon: "🎂",
      cover_image: "",
      image: "",
      short_description: "Handcrafted cakes for your special milestone",
      description: "Handcrafted cakes for your special milestone",
      url: "/products",
      link: "/products",
      is_active: true,
      display_order: manualOccasions.length + 1,
    };
    const next = [...manualOccasions, newCard];
    onChange("manual_occasions", next);
    setExpandedCardIndex(next.length - 1);
  };

  const handleUpdateCard = (index: number, updates: Partial<ManualOccasionCard>) => {
    const next = [...manualOccasions];
    const current = next[index];
    if (!current) return;

    // Synchronize aliases (name <-> title, image <-> cover_image, url <-> link, etc.)
    const updated: ManualOccasionCard = {
      ...current,
      ...updates,
    };
    if ("name" in updates) updated.title = updates.name;
    if ("title" in updates && !("name" in updates)) updated.name = updates.title || "";
    if ("cover_image" in updates) updated.image = updates.cover_image;
    if ("image" in updates && !("cover_image" in updates)) updated.cover_image = updates.image;
    if ("url" in updates) updated.link = updates.url;
    if ("link" in updates && !("url" in updates)) updated.url = updates.link;
    if ("emoji" in updates) updated.icon = updates.emoji;
    if ("icon" in updates && !("emoji" in updates)) updated.emoji = updates.icon;
    if ("short_description" in updates) updated.description = updates.short_description;

    next[index] = updated;
    onChange("manual_occasions", next);
  };

  const handleRemoveCard = (index: number) => {
    const next = manualOccasions.filter((_, idx) => idx !== index);
    onChange("manual_occasions", next);
    if (expandedCardIndex === index) {
      setExpandedCardIndex(null);
    } else if (expandedCardIndex !== null && expandedCardIndex > index) {
      setExpandedCardIndex(expandedCardIndex - 1);
    }
  };

  const handleMoveCard = (index: number, direction: "up" | "down") => {
    const targetIdx = direction === "up" ? index - 1 : index + 1;
    if (targetIdx < 0 || targetIdx >= manualOccasions.length) return;
    const next = [...manualOccasions];
    const temp = next[index];
    next[index] = next[targetIdx];
    next[targetIdx] = temp;
    onChange("manual_occasions", next);
    if (expandedCardIndex === index) {
      setExpandedCardIndex(targetIdx);
    } else if (expandedCardIndex === targetIdx) {
      setExpandedCardIndex(index);
    }
  };

  const handleClearAllManual = () => {
    if (window.confirm("Are you sure you want to remove all manual occasion cards?")) {
      onChange("manual_occasions", []);
      setExpandedCardIndex(null);
    }
  };

  // Merge selected occasions from Chooser Modal into manualOccasions
  const handleApplyChooser = (chosenOccasions: any[]) => {
    const existingMap = new Map<string, ManualOccasionCard>();
    manualOccasions.forEach((c) => {
      if (c.id) existingMap.set(c.id, c);
      if (c.slug) existingMap.set(c.slug, c);
    });

    const merged: ManualOccasionCard[] = chosenOccasions.map((occ, idx) => {
      const existing = existingMap.get(occ.id) || (occ.slug ? existingMap.get(occ.slug) : undefined);
      if (existing) {
        // Preserve prior custom edits
        return {
          ...existing,
          display_order: idx + 1,
        };
      }
        const targetSlug = (occ.slug || occ.id || "").toLowerCase().replace(/^occ_/, "").replace(/_/g, "-");
        return {
        id: occ.id || `occ_${occ.slug || idx}`,
        name: occ.name || occ.title || "Occasion",
        title: occ.title || occ.name || "Occasion",
        slug: occ.slug || occ.id || "",
        emoji: occ.emoji || occ.icon || "🎂",
        icon: occ.icon || occ.emoji || "🎂",
        cover_image: occ.cover_image || occ.image || occ.thumbnail_image || "",
        image: occ.image || occ.cover_image || "",
        short_description: occ.short_description || occ.description || "",
        description: occ.description || occ.short_description || "",
        url: targetSlug ? `/occasions/${targetSlug}` : "/occasions",
        link: targetSlug ? `/occasions/${targetSlug}` : "/occasions",
        is_active: true,
        display_order: idx + 1,
      };
    });

    onChange("manual_occasions", merged);
  };

  return (
    <div className="flex flex-col gap-4">
      {/* 1. Headings & Eyebrow */}
      <div className="p-3.5 bg-ui-bg-subtle rounded-2xl border border-ui-border-base flex flex-col gap-3">
        <Text className="text-xs font-bold uppercase tracking-wider text-brand-navy dark:text-brand-gold flex items-center gap-1.5">
          <Gift className="w-3.5 h-3.5 text-brand-gold" /> Occasion Section Headings
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

      {/* 2. Data Source Configuration & Manual Chooser */}
      <div className="p-3.5 bg-ui-bg-subtle rounded-2xl border border-ui-border-base flex flex-col gap-3">
        <Text className="text-xs font-bold uppercase tracking-wider text-rose-600 flex items-center gap-1.5">
          <Database className="w-3.5 h-3.5" /> Data Source & Occasion Cards
        </Text>

        <Field label="Occasion Data Source">
          <Select value={dataSource} onValueChange={handleDataSourceChange}>
            <Select.Trigger data-testid="occasion-data-source-trigger"><Select.Value /></Select.Trigger>
            <Select.Content>
              <Select.Item value="pim">PIM Database Occasions (Live)</Select.Item>
              <Select.Item value="manual">Manual Occasion Cards</Select.Item>
            </Select.Content>
          </Select>
        </Field>

        {/* ── Mode A: PIM Database Live Mode ── */}
        {dataSource === "pim" && (
          <>
            <div className="p-2.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-[11px] text-emerald-800 dark:text-emerald-300 flex items-center gap-2">
              <Sparkles className="w-4 h-4 shrink-0 text-emerald-600" />
              <span>Cards are rendered dynamically from live PIM occasion records.</span>
            </div>

            <Field label="Occasion Selection Mode">
              <Select value={occasionMode} onValueChange={(v) => onChange("occasion_mode", v)}>
                <Select.Trigger><Select.Value /></Select.Trigger>
                <Select.Content>
                  <Select.Item value="all_active">All Active Occasions ({loadedOccasions.length})</Select.Item>
                  <Select.Item value="selected">Select Specific Occasions ({selectedOccasions.length} chosen)</Select.Item>
                  <Select.Item value="featured">Featured Occasions Only</Select.Item>
                </Select.Content>
              </Select>
            </Field>

            {occasionMode === "selected" && (
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

                {loadedOccasions.length === 0 ? (
                  <p className="text-xs text-ui-fg-muted italic">No occasions found in PIM database.</p>
                ) : (
                  <div className="max-h-48 overflow-y-auto flex flex-col gap-1.5 p-1">
                    {loadedOccasions.map((occ) => {
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
                              onChange={() => togglePimOccasion(key)}
                              className="rounded border-ui-border-base text-rose-600 focus:ring-rose-500"
                            />
                            <span className="truncate">{occ.emoji || occ.icon || "🎂"} {occ.name || occ.title}</span>
                          </span>
                          {occ.is_featured && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-brand-gold-light text-brand-gold-dark shrink-0">Featured</span>
                          )}
                        </label>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </>
        )}

        {/* ── Mode B: Manual Occasion Cards Chooser & Manager ── */}
        {dataSource === "manual" && (
          <div className="flex flex-col gap-3">
            {/* Info bar */}
            <div className="p-2.5 rounded-xl bg-brand-light dark:bg-brand-navy/40 border border-brand-primary/30 dark:border-brand-navy text-[11px] text-brand-navy dark:text-brand-primary flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 shrink-0 text-brand-primary" />
                <span>Curate specific cards, custom titles, artwork, and links.</span>
              </div>
              <span className="font-bold text-xs bg-brand-primary/60 dark:bg-brand-navy/60 px-2 py-0.5 rounded-md shrink-0">
                {manualOccasions.length} {manualOccasions.length === 1 ? "Card" : "Cards"}
              </span>
            </div>

            {/* Quick Action Buttons */}
            <div className="grid grid-cols-2 gap-2">
              <Button
                type="button"
                variant="secondary"
                size="small"
                data-testid="choose-from-pim-btn"
                onClick={() => setIsChooserOpen(true)}
                className="w-full text-xs font-bold border-brand-navy/30 hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center justify-center gap-1.5 py-2 rounded-xl"
              >
                <CheckSquare className="w-3.5 h-3.5 text-brand-navy dark:text-brand-gold" />
                <span>Choose from PIM</span>
              </Button>
              <Button
                type="button"
                variant="secondary"
                size="small"
                data-testid="add-custom-card-btn"
                onClick={handleAddCustomCard}
                className="w-full text-xs font-bold border-brand-navy/30 hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center justify-center gap-1.5 py-2 rounded-xl"
              >
                <Plus className="w-3.5 h-3.5 text-emerald-600" />
                <span>+ Custom Card</span>
              </Button>
            </div>

            {/* Cards List Section */}
            {manualOccasions.length === 0 ? (
              <div className="p-6 rounded-2xl border-2 border-dashed border-ui-border-base bg-ui-bg-base text-center flex flex-col items-center gap-2">
                <Gift className="w-8 h-8 text-ui-fg-muted/60" />
                <p className="text-xs font-bold text-ui-fg-base">No manual occasion cards chosen</p>
                <p className="text-[11px] text-ui-fg-muted max-w-xs">
                  Click &ldquo;Choose from PIM&rdquo; to quickly select from your catalog, or &ldquo;+ Custom Card&rdquo; to add custom artwork and links.
                </p>
              </div>
            ) : (
              <div className="flex flex-col gap-2">
                <div className="flex items-center justify-between px-1">
                  <span className="text-xs font-bold text-ui-fg-base">
                    Selected Occasion Cards ({manualOccasions.length})
                  </span>
                  <button
                    type="button"
                    onClick={handleClearAllManual}
                    className="text-[10px] text-red-500 hover:underline"
                  >
                    Clear All
                  </button>
                </div>

                <div className="flex flex-col gap-2">
                  {manualOccasions.map((card, idx) => {
                    const isExpanded = expandedCardIndex === idx;
                    const cardTitle = card.title || card.name || "Occasion";
                    const cardEmoji = card.emoji || card.icon || "🎂";
                    const cardImg = card.cover_image || card.image || card.thumbnail_image;
                    const cardSlug = (card.slug || card.id || "").toLowerCase().replace(/^occ_/, "").replace(/_/g, "-");
                    const cardHref = card.url || card.link || (cardSlug ? `/occasions/${cardSlug}` : "/occasions");

                    return (
                      <div
                        key={card.id || `card-${idx}`}
                        data-testid={`manual-occasion-card-${idx}`}
                        className={`rounded-xl border transition-all overflow-hidden bg-ui-bg-base ${
                          isExpanded
                            ? "border-brand-navy dark:border-brand-gold ring-1 ring-brand-navy/20 shadow-md"
                            : "border-ui-border-base hover:border-ui-border-strong"
                        }`}
                      >
                        {/* Card Header Row */}
                        <div
                          className="p-2.5 flex items-center justify-between gap-2 cursor-pointer hover:bg-ui-bg-subtle/50 transition-colors"
                          data-testid={`manual-occasion-card-header-${idx}`}
                          onClick={() => setExpandedCardIndex(isExpanded ? null : idx)}
                        >
                          <div className="flex items-center gap-2.5 min-w-0 flex-1">
                            {/* Order index */}
                            <span className="w-5 h-5 rounded-md bg-ui-bg-subtle border border-ui-border-base text-[10px] font-mono font-bold flex items-center justify-center shrink-0 text-ui-fg-muted">
                              {idx + 1}
                            </span>

                            {/* Thumbnail */}
                            <div className="w-8 h-8 rounded-lg overflow-hidden bg-ui-bg-subtle border border-ui-border-base shrink-0 flex items-center justify-center text-sm">
                              {cardImg ? (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img src={cardImg} alt={cardTitle} className="w-full h-full object-cover" />
                              ) : (
                                <span>{cardEmoji}</span>
                              )}
                            </div>

                            {/* Title & Link */}
                            <div className="flex flex-col min-w-0 flex-1">
                              <div className="flex items-center gap-1.5">
                                <span className="text-xs font-bold text-ui-fg-base truncate">
                                  {cardEmoji} {cardTitle}
                                </span>
                                {card.is_active === false && (
                                  <span className="text-[9px] px-1.5 py-0.2 rounded bg-neutral-200 text-neutral-700 font-medium">
                                    Hidden
                                  </span>
                                )}
                              </div>
                              <span className="text-[10px] text-ui-fg-muted truncate font-mono">
                                {cardHref || "No link"}
                              </span>
                            </div>
                          </div>

                          {/* Action Buttons */}
                          <div className="flex items-center gap-1 shrink-0" onClick={(e) => e.stopPropagation()}>
                            <button
                              type="button"
                              disabled={idx === 0}
                              onClick={() => handleMoveCard(idx, "up")}
                              title="Move Up"
                              data-testid={`manual-occasion-move-up-${idx}`}
                              className="p-1 rounded hover:bg-ui-bg-subtle text-ui-fg-muted hover:text-ui-fg-base disabled:opacity-30 disabled:cursor-not-allowed"
                            >
                              <ArrowUp className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              disabled={idx === manualOccasions.length - 1}
                              onClick={() => handleMoveCard(idx, "down")}
                              title="Move Down"
                              data-testid={`manual-occasion-move-down-${idx}`}
                              className="p-1 rounded hover:bg-ui-bg-subtle text-ui-fg-muted hover:text-ui-fg-base disabled:opacity-30 disabled:cursor-not-allowed"
                            >
                              <ArrowDown className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              data-testid={`manual-occasion-expand-${idx}`}
                              onClick={() => setExpandedCardIndex(isExpanded ? null : idx)}
                              className="p-1 rounded hover:bg-ui-bg-subtle text-ui-fg-muted hover:text-ui-fg-base"
                            >
                              {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                            </button>
                            <button
                              type="button"
                              onClick={() => handleRemoveCard(idx)}
                              title="Delete Card"
                              className="p-1 rounded hover:bg-red-50 text-ui-fg-muted hover:text-red-600 transition-colors"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>

                        {/* Collapsible Edit Drawer */}
                        {isExpanded && (
                          <div className="p-3.5 border-t border-ui-border-base bg-ui-bg-subtle flex flex-col gap-3 animate-in slide-in-from-top-1 duration-150">
                            <div className="grid grid-cols-2 gap-3">
                              <Field label="Card Title">
                                <Input
                                  size="small"
                                  data-testid={`manual-occasion-title-input-${idx}`}
                                  value={card.name || card.title || ""}
                                  onChange={(e) => handleUpdateCard(idx, { name: e.target.value, title: e.target.value })}
                                  placeholder="Birthday Celebrations"
                                />
                              </Field>

                              <Field label="Slug / Key">
                                <Input
                                  size="small"
                                  value={card.slug || ""}
                                  onChange={(e) => handleUpdateCard(idx, { slug: e.target.value })}
                                  placeholder="birthday"
                                />
                              </Field>
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                              <Field label="Card Emoji Symbol">
                                <div className="flex flex-col gap-1.5">
                                  <Input
                                    size="small"
                                    value={card.emoji || card.icon || ""}
                                    onChange={(e) => handleUpdateCard(idx, { emoji: e.target.value, icon: e.target.value })}
                                    placeholder="🎂"
                                  />
                                  <div className="flex flex-wrap gap-1">
                                    {EMOJI_PRESETS.map((em) => (
                                      <button
                                        key={em}
                                        type="button"
                                        onClick={() => handleUpdateCard(idx, { emoji: em, icon: em })}
                                        className="w-5 h-5 rounded hover:bg-ui-bg-base text-xs flex items-center justify-center transition-colors"
                                      >
                                        {em}
                                      </button>
                                    ))}
                                  </div>
                                </div>
                              </Field>

                              <Field label="Target Link URL" hint="Storefront destination link">
                                <Input
                                  size="small"
                                  value={card.url || card.link || ""}
                                  onChange={(e) => handleUpdateCard(idx, { url: e.target.value, link: e.target.value })}
                                  placeholder="/occasions/birthday"
                                />
                              </Field>
                            </div>

                            <Field label="Short Subtitle / Description">
                              <Textarea
                                value={card.short_description || card.description || ""}
                                onChange={(e) => handleUpdateCard(idx, { short_description: e.target.value, description: e.target.value })}
                                placeholder="Handcrafted artisanal creations for life's sweetest milestones"
                                rows={2}
                                className="text-xs"
                              />
                            </Field>

                            {/* Image Section */}
                            <Field label="Cover Image Artwork">
                              <div className="flex flex-col gap-2">
                                <div className="flex items-center gap-2">
                                  {cardImg ? (
                                    <div className="w-12 h-12 rounded-lg overflow-hidden border border-ui-border-base bg-ui-bg-base shrink-0 relative group">
                                      {/* eslint-disable-next-line @next/next/no-img-element */}
                                      <img src={cardImg} alt={cardTitle} className="w-full h-full object-cover" />
                                    </div>
                                  ) : (
                                    <div className="w-12 h-12 rounded-lg border-2 border-dashed border-ui-border-base bg-ui-bg-base flex items-center justify-center text-ui-fg-muted shrink-0">
                                      <ImageIcon className="w-5 h-5" />
                                    </div>
                                  )}

                                  <div className="flex-1 flex flex-col gap-1.5 min-w-0">
                                    <Input
                                      size="small"
                                      value={card.cover_image || card.image || ""}
                                      onChange={(e) => handleUpdateCard(idx, { cover_image: e.target.value, image: e.target.value })}
                                      placeholder="https://... image URL"
                                      className="text-xs"
                                    />
                                    <div className="flex items-center gap-2">
                                      <button
                                        type="button"
                                        onClick={() => setMediaPickerCardIndex(idx)}
                                        className="text-[11px] font-bold text-brand-navy dark:text-brand-gold hover:underline flex items-center gap-1"
                                      >
                                        <ImageIcon className="w-3 h-3" /> Select from Media Library
                                      </button>
                                      {cardImg && (
                                        <button
                                          type="button"
                                          onClick={() => handleUpdateCard(idx, { cover_image: "", image: "" })}
                                          className="text-[11px] text-red-500 hover:underline"
                                        >
                                          Clear Image
                                        </button>
                                      )}
                                    </div>
                                  </div>
                                </div>
                              </div>
                            </Field>

                            {/* Active Toggle */}
                            <div className="pt-2 border-t border-ui-border-base flex items-center justify-between text-xs">
                              <span className="font-semibold text-ui-fg-base">Card Active (Visible in Storefront)</span>
                              <Toggle
                                checked={card.is_active !== false}
                                onChange={(v) => handleUpdateCard(idx, { is_active: v })}
                                label="Toggle Card Visibility"
                              />
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
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
          <Field label="Card Visual Style">
            <Select value={config.card_style || "default"} onValueChange={(v) => onChange("card_style", v)}>
              <Select.Trigger><Select.Value /></Select.Trigger>
              <Select.Content>
                <Select.Item value="default">Default Solid Card</Select.Item>
                <Select.Item value="scrapbook">📖 Memory Scrapbook (Polaroid + Washi)</Select.Item>
                <Select.Item value="coquette">🎀 Coquette Blush (Ribbon + Scallop)</Select.Item>
                <Select.Item value="glass">🪟 Glassmorphism Frosted</Select.Item>
                <Select.Item value="tenebrism">🕯️ Tenebrism (Chiaroscuro Spotlight)</Select.Item>
                <Select.Item value="japandi">🌿 Japandi Minimalist (Wabi-Sabi)</Select.Item>
              </Select.Content>
            </Select>
          </Field>
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
        <Text className="text-xs font-bold uppercase tracking-wider text-brand-primary flex items-center gap-1.5">
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

      {/* Occasion Chooser Modal */}
      <OccasionChooserModal
        isOpen={isChooserOpen}
        onClose={() => setIsChooserOpen(false)}
        onApply={handleApplyChooser}
        availableOccasions={loadedOccasions}
        currentCards={manualOccasions}
      />

      {/* Media Selector Modal for Card Cover Artwork */}
      {mediaPickerCardIndex !== null && (
        <MediaSelectorModal
          isOpen={true}
          title={`Select Artwork for ${manualOccasions[mediaPickerCardIndex]?.name || "Occasion Card"}`}
          currentValue={{
            url: manualOccasions[mediaPickerCardIndex]?.cover_image || manualOccasions[mediaPickerCardIndex]?.image || "",
          }}
          onClose={() => setMediaPickerCardIndex(null)}
          onSelect={(selection: MediaSelection) => {
            if (mediaPickerCardIndex !== null) {
              handleUpdateCard(mediaPickerCardIndex, {
                cover_image: selection.url,
                image: selection.url,
              });
            }
            setMediaPickerCardIndex(null);
          }}
        />
      )}
    </div>
  );
}
