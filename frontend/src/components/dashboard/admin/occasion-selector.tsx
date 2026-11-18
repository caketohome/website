"use client";

import React, { useState, useEffect, useRef } from "react";
import { Label, Badge, Button, Input, Text } from "@medusajs/ui";
import { Plus, X, Search, Check, Sparkles, AlertCircle, ChevronDown, ChevronUp } from "lucide-react";
import { apiClient } from "@frontend/lib/api-client";

export interface OccasionOption {
  id: string;
  name: string;
  slug: string;
  icon?: string;
  description?: string;
  status: "active" | "archived";
}

interface OccasionSelectorProps {
  label?: string;
  selectedIds: string[];
  onChange: (selectedIds: string[]) => void;
  helperText?: string;
}

export function OccasionSelector({
  label = "Occasions",
  selectedIds = [],
  onChange,
  helperText,
}: OccasionSelectorProps) {
  const [occasions, setOccasions] = useState<OccasionOption[]>([]);
  const [loading, setLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [focusedIndex, setFocusedIndex] = useState(-1);

  // Inline "Create Occasion" Modal State
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newOccasionName, setNewOccasionName] = useState("");
  const [newOccasionSlug, setNewOccasionSlug] = useState("");
  const [newOccasionIcon, setNewOccasionIcon] = useState("🎉");
  const [newOccasionDesc, setNewOccasionDesc] = useState("");
  const [createSubmitting, setCreateSubmitting] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  const containerRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const fetchOccasions = async () => {
    setLoading(true);
    try {
      const res: any = await apiClient.getOccasions();
      setOccasions(res?.occasions || []);
    } catch {
      // Fallback
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOccasions();
  }, []);

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const filteredOccasions = occasions.filter(
    (o) =>
      o.status !== "archived" &&
      (o.name.toLowerCase().includes(search.toLowerCase()) ||
        o.slug.toLowerCase().includes(search.toLowerCase()))
  );

  const toggleSelect = (id: string) => {
    if (selectedIds.includes(id)) {
      onChange(selectedIds.filter((item) => item !== id));
    } else {
      onChange([...selectedIds, id]);
    }
  };

  const removeOccasion = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    onChange(selectedIds.filter((item) => item !== id));
  };

  const handleSelectAll = () => {
    const allActiveIds = occasions.filter((o) => o.status !== "archived").map((o) => o.id);
    onChange(allActiveIds);
  };

  const handleClearAll = () => {
    onChange([]);
  };

  // Keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!isOpen) {
      if (e.key === "ArrowDown" || e.key === "Enter") {
        setIsOpen(true);
        e.preventDefault();
      }
      return;
    }

    if (e.key === "ArrowDown") {
      e.preventDefault();
      setFocusedIndex((prev) => (prev < filteredOccasions.length - 1 ? prev + 1 : 0));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setFocusedIndex((prev) => (prev > 0 ? prev - 1 : filteredOccasions.length - 1));
    } else if (e.key === "Enter" && focusedIndex >= 0 && filteredOccasions[focusedIndex]) {
      e.preventDefault();
      toggleSelect(filteredOccasions[focusedIndex].id);
    } else if (e.key === "Escape") {
      setIsOpen(false);
    }
  };

  const handleOpenCreateModal = (e: React.MouseEvent) => {
    e.stopPropagation();
    setNewOccasionName(search.trim());
    setNewOccasionSlug(search.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-"));
    setNewOccasionIcon("🎉");
    setNewOccasionDesc("");
    setCreateError(null);
    setShowCreateModal(true);
    setIsOpen(false);
  };

  const handleSaveNewOccasion = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newOccasionName.trim()) {
      setCreateError("Occasion name is required.");
      return;
    }

    setCreateSubmitting(true);
    setCreateError(null);

    try {
      const res: any = await apiClient.createAdminOccasion({
        name: newOccasionName.trim(),
        slug: newOccasionSlug.trim() || newOccasionName.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-"),
        icon: newOccasionIcon.trim() || "🎉",
        description: newOccasionDesc.trim(),
        status: "active",
      });

      const createdOccasion = res?.occasion;
      if (createdOccasion?.id) {
        await fetchOccasions();
        // Immediately select the newly created occasion
        if (!selectedIds.includes(createdOccasion.id)) {
          onChange([...selectedIds, createdOccasion.id]);
        }
        setShowCreateModal(false);
        setSearch("");
      }
    } catch (err: any) {
      setCreateError(err.message || "Failed to create occasion.");
    } finally {
      setCreateSubmitting(false);
    }
  };

  const getOccasionDisplay = (id: string) => {
    const found = occasions.find((o) => o.id === id || o.slug === id);
    if (found) {
      return { name: found.name, icon: found.icon || "🎉" };
    }
    return { name: id.replace(/^occ_/, "").replace(/_/g, " "), icon: "🎉" };
  };

  return (
    <div className="space-y-1.5" ref={containerRef} onKeyDown={handleKeyDown}>
      <div className="flex items-center justify-between">
        <Label className="font-semibold text-xs text-ui-fg-base flex items-center gap-1.5">
          <Sparkles className="w-3.5 h-3.5 text-brand-primary" /> {label}
        </Label>
        {selectedIds.length > 0 && (
          <span className="text-[11px] text-brand-primary font-bold">
            {selectedIds.length} Selected
          </span>
        )}
      </div>

      {/* Pill Display & Interactive Dropdown Trigger */}
      <div
        onClick={() => {
          setIsOpen(!isOpen);
          if (!isOpen) {
            setTimeout(() => searchInputRef.current?.focus(), 100);
          }
        }}
        className="min-h-[42px] p-2 bg-ui-bg-field border border-ui-border-base rounded-lg cursor-pointer hover:border-brand-primary focus-within:ring-2 focus-within:ring-brand-primary/30 transition-all flex flex-wrap items-center gap-1.5"
      >
        {selectedIds.length === 0 ? (
          <span className="text-xs text-ui-fg-muted px-1.5">
            Select target celebration occasions (e.g. Birthday, Anniversary)...
          </span>
        ) : (
          selectedIds.map((id) => {
            const { name, icon } = getOccasionDisplay(id);
            return (
              <Badge
                key={id}
                color="purple"
                className="text-xs pl-2 pr-1 py-0.5 flex items-center gap-1 font-semibold shadow-sm animate-in fade-in"
              >
                <span>{icon}</span>
                <span>{name}</span>
                <button
                  type="button"
                  onClick={(e) => removeOccasion(id, e)}
                  className="p-0.5 hover:bg-brand-primary/30 dark:hover:bg-brand-navy rounded-full text-brand-navy transition"
                >
                  <X className="w-3 h-3" />
                </button>
              </Badge>
            );
          })
        )}

        <div className="ml-auto flex items-center gap-1">
          <span className="text-[11px] text-brand-primary font-bold flex items-center gap-0.5 hover:underline px-1">
            <Plus className="w-3 h-3" /> Add
          </span>
          {isOpen ? <ChevronUp className="w-4 h-4 text-ui-fg-subtle" /> : <ChevronDown className="w-4 h-4 text-ui-fg-subtle" />}
        </div>
      </div>

      {helperText && (
        <Text className="text-[11px] text-ui-fg-subtle">{helperText}</Text>
      )}

      {/* Searchable Multi-Select Dropdown Menu */}
      {isOpen && (
        <div className="relative z-50">
          <div className="absolute top-1 left-0 right-0 bg-white dark:bg-slate-900 border border-ui-border-base rounded-xl shadow-2xl p-2.5 space-y-2 animate-in fade-in-50 zoom-in-95">
            {/* Search Input Box */}
            <div className="relative">
              <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-ui-fg-subtle" />
              <input
                ref={searchInputRef}
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search occasions (e.g., Birthday, Wedding, Diwali)..."
                className="w-full pl-8 pr-3 py-1.5 text-xs rounded-md border border-ui-border-base bg-ui-bg-subtle focus:outline-none focus:ring-1 focus:ring-brand-primary"
              />
            </div>

            {/* Quick Actions (Select All / Clear) */}
            <div className="flex items-center justify-between px-1 text-[11px]">
              <span className="text-ui-fg-muted">{filteredOccasions.length} occasions available</span>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={handleSelectAll}
                  className="text-brand-primary hover:underline font-semibold"
                >
                  Select All
                </button>
                <span className="text-ui-border-base">|</span>
                <button
                  type="button"
                  onClick={handleClearAll}
                  className="text-rose-600 hover:underline font-semibold"
                >
                  Clear All
                </button>
              </div>
            </div>

            {/* Scrollable Occasions List */}
            <div className="max-h-56 overflow-y-auto divide-y divide-ui-border-base/50 pr-1">
              {filteredOccasions.length === 0 ? (
                <div className="p-4 text-center space-y-2">
                  <Text className="text-xs text-ui-fg-muted">
                    No matching occasion found for &quot;{search}&quot;
                  </Text>
                  <Button
                    size="small"
                    type="button"
                    onClick={handleOpenCreateModal}
                    className="text-xs bg-brand-primary hover:bg-brand-navy text-white"
                  >
                    <Plus className="w-3 h-3" /> Create &quot;{search}&quot;
                  </Button>
                </div>
              ) : (
                filteredOccasions.map((occ, idx) => {
                  const isSelected = selectedIds.includes(occ.id) || selectedIds.includes(occ.slug);
                  const isFocused = idx === focusedIndex;
                  return (
                    <div
                      key={occ.id}
                      onClick={() => toggleSelect(occ.id)}
                      className={`p-2 rounded-lg flex items-center justify-between cursor-pointer transition ${
                        isSelected
                          ? "bg-brand-light dark:bg-brand-navy/40 text-brand-navy dark:text-brand-primary"
                          : isFocused
                          ? "bg-ui-bg-subtle"
                          : "hover:bg-ui-bg-subtle/70"
                      }`}
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="text-sm shrink-0">{occ.icon || "🎉"}</span>
                        <div className="flex flex-col min-w-0">
                          <span className="text-xs font-semibold truncate">{occ.name}</span>
                          {occ.description && (
                            <span className="text-[10px] text-ui-fg-muted truncate">{occ.description}</span>
                          )}
                        </div>
                      </div>

                      <div
                        className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 transition ${
                          isSelected
                            ? "bg-brand-primary border-brand-primary text-white"
                            : "border-ui-border-base bg-white dark:bg-slate-800"
                        }`}
                      >
                        {isSelected && <Check className="w-3 h-3 stroke-[3]" />}
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Bottom Create Button Bar */}
            <div className="pt-2 border-t border-ui-border-base flex items-center justify-between">
              <Button
                size="small"
                variant="transparent"
                type="button"
                onClick={handleOpenCreateModal}
                className="text-xs text-brand-primary hover:bg-brand-light dark:hover:bg-brand-navy flex items-center gap-1"
              >
                <Plus className="w-3.5 h-3.5" /> + Create New Occasion
              </Button>
              <Button
                size="small"
                variant="secondary"
                type="button"
                onClick={() => setIsOpen(false)}
                className="text-xs"
              >
                Done
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Inline Create Occasion Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-white dark:bg-slate-900 rounded-2xl border border-ui-border-base shadow-2xl w-full max-w-md p-6 space-y-4 animate-in fade-in zoom-in-95"
          >
            <div className="flex items-center justify-between border-b border-ui-border-base pb-3">
              <div className="flex items-center gap-2">
                <span className="text-xl">🎉</span>
                <div>
                  <h3 className="font-bold text-sm text-ui-fg-base">Create New Occasion</h3>
                  <p className="text-xs text-ui-fg-subtle">Add custom occasion to CakeToHome taxonomy</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowCreateModal(false)}
                className="text-ui-fg-muted hover:text-ui-fg-base p-1 rounded-full hover:bg-ui-bg-subtle"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {createError && (
              <div className="p-2.5 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 text-rose-500" />
                <span>{createError}</span>
              </div>
            )}

            <form onSubmit={handleSaveNewOccasion} className="space-y-3.5">
              <div>
                <Label htmlFor="occ_name" className="text-xs font-semibold">
                  Occasion Name *
                </Label>
                <Input
                  id="occ_name"
                  value={newOccasionName}
                  onChange={(e) => {
                    setNewOccasionName(e.target.value);
                    setNewOccasionSlug(e.target.value.toLowerCase().replace(/[^a-z0-9]+/g, "-"));
                  }}
                  placeholder="e.g. Baby Shower, Golden Jubilee"
                  required
                  className="text-xs mt-1"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label htmlFor="occ_icon" className="text-xs font-semibold">
                    Emoji / Icon
                  </Label>
                  <Input
                    id="occ_icon"
                    value={newOccasionIcon}
                    onChange={(e) => setNewOccasionIcon(e.target.value)}
                    placeholder="🎂"
                    className="text-xs mt-1"
                  />
                </div>
                <div>
                  <Label htmlFor="occ_slug" className="text-xs font-semibold">
                    URL Slug
                  </Label>
                  <Input
                    id="occ_slug"
                    value={newOccasionSlug}
                    onChange={(e) => setNewOccasionSlug(e.target.value)}
                    placeholder="baby-shower"
                    className="text-xs mt-1"
                  />
                </div>
              </div>

              <div>
                <Label htmlFor="occ_desc" className="text-xs font-semibold">
                  Description
                </Label>
                <Input
                  id="occ_desc"
                  value={newOccasionDesc}
                  onChange={(e) => setNewOccasionDesc(e.target.value)}
                  placeholder="Summary for storefront occasion browsing and recommendations"
                  className="text-xs mt-1"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-ui-border-base">
                <Button
                  type="button"
                  variant="transparent"
                  onClick={() => setShowCreateModal(false)}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  isLoading={createSubmitting}
                  className="bg-brand-primary hover:bg-brand-navy text-white"
                >
                  Save & Apply Occasion
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
