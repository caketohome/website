"use client";

import React, { useState, useEffect } from "react";
import { Container, Heading, Text, Badge, Input, Button, Label } from "@medusajs/ui";
import { apiClient } from "@frontend/lib/api-client";
import { Sparkles, Plus, Edit3, Trash2, RotateCcw, Search, AlertCircle, CheckCircle, RefreshCw, Wand2, ArrowUpDown } from "lucide-react";

export function OccasionsPanel() {
  const [occasions, setOccasions] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "archived">("all");

  // Modal State
  const [showModal, setShowModal] = useState(false);
  const [editingOccasion, setEditingOccasion] = useState<any | null>(null);
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [icon, setIcon] = useState("🎉");
  const [description, setDescription] = useState("");
  const [displayOrder, setDisplayOrder] = useState("1");
  const [status, setStatus] = useState<"active" | "archived">("active");
  const [submitting, setSubmitting] = useState(false);
  const [msg, setMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Migration Trigger State
  const [migrating, setMigrating] = useState(false);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [occRes, prodRes, catRes]: [any, any, any] = await Promise.all([
        apiClient.getAdminOccasions(),
        apiClient.getAdminProducts().catch(() => ({ products: [] })),
        apiClient.getAdminCategories().catch(() => ({ categories: [] })),
      ]);
      setOccasions(occRes?.occasions || []);
      setProducts(prodRes?.products || []);
      setCategories(catRes?.categories || []);
    } catch (err: any) {
      setMsg({ type: "error", text: err.message || "Failed to load occasions." });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleOpenCreate = () => {
    setEditingOccasion(null);
    setName("");
    setSlug("");
    setIcon("🎉");
    setDescription("");
    setDisplayOrder(String(occasions.length + 1));
    setStatus("active");
    setShowModal(true);
    setMsg(null);
  };

  const handleOpenEdit = (occ: any) => {
    setEditingOccasion(occ);
    setName(occ.name);
    setSlug(occ.slug);
    setIcon(occ.icon || "🎉");
    setDescription(occ.description || "");
    setDisplayOrder(String(occ.display_order || 1));
    setStatus(occ.status || "active");
    setShowModal(true);
    setMsg(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setSubmitting(true);
    setMsg(null);

    const payload = {
      name: name.trim(),
      slug: slug.trim() || name.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-"),
      icon: icon.trim() || "🎉",
      description: description.trim(),
      display_order: Number(displayOrder) || 1,
      status,
    };

    try {
      if (editingOccasion) {
        await apiClient.updateAdminOccasion(editingOccasion.id, payload);
        setMsg({ type: "success", text: `Occasion "${payload.name}" updated successfully.` });
      } else {
        await apiClient.createAdminOccasion(payload);
        setMsg({ type: "success", text: `Occasion "${payload.name}" registered successfully.` });
      }
      setShowModal(false);
      fetchData();
    } catch (err: any) {
      setMsg({ type: "error", text: err.message || "Failed to save occasion." });
    } finally {
      setSubmitting(false);
    }
  };

  const handleArchive = async (id: string, occName: string) => {
    if (!confirm(`Archive occasion "${occName}"? Products mapped to this occasion will retain their relationship.`)) return;
    try {
      await apiClient.deleteAdminOccasion(id);
      setMsg({ type: "success", text: `Occasion "${occName}" archived.` });
      fetchData();
    } catch (err: any) {
      setMsg({ type: "error", text: err.message || "Failed to archive occasion." });
    }
  };

  const handleRestore = async (id: string, occName: string) => {
    try {
      await apiClient.restoreAdminOccasion(id);
      setMsg({ type: "success", text: `Occasion "${occName}" restored to active.` });
      fetchData();
    } catch (err: any) {
      setMsg({ type: "error", text: err.message || "Failed to restore occasion." });
    }
  };

  const handleRunMigration = async () => {
    setMigrating(true);
    try {
      const res: any = await fetch("/api/v1/admin/occasions/migrate", { method: "POST" });
      const data = await res.json();
      setMsg({
        type: "success",
        text: `Taxonomy Migration Complete: Migrated ${data.result?.migratedProducts || 0} products and registered ${data.result?.mappedCount || 0} occasion mappings.`,
      });
      fetchData();
    } catch (err: any) {
      setMsg({ type: "error", text: err.message || "Migration failed." });
    } finally {
      setMigrating(false);
    }
  };

  const getProductCountForOccasion = (occ: any) => {
    return products.filter((p: any) => {
      const occIds: string[] = Array.isArray(p.occasion_ids) ? p.occasion_ids : [];
      return occIds.includes(occ.id) || occIds.includes(occ.slug) || (p.occasion && p.occasion.toLowerCase() === occ.name.toLowerCase());
    }).length;
  };

  const getCategoryCountForOccasion = (occ: any) => {
    return categories.filter((c: any) => {
      const occIds: string[] = Array.isArray(c.occasion_ids) ? c.occasion_ids : [];
      return occIds.includes(occ.id) || occIds.includes(occ.slug);
    }).length;
  };

  const filtered = occasions.filter((o) => {
    const matchSearch =
      o.name.toLowerCase().includes(search.toLowerCase()) ||
      o.slug.toLowerCase().includes(search.toLowerCase()) ||
      (o.description || "").toLowerCase().includes(search.toLowerCase());
    if (!matchSearch) return false;
    if (statusFilter === "active") return o.status !== "archived";
    if (statusFilter === "archived") return o.status === "archived";
    return true;
  });

  return (
    <div className="space-y-6">
      {/* Top Header Banner */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-gradient-to-r from-purple-50 via-indigo-50 to-pink-50 dark:from-purple-950/40 dark:via-indigo-950/40 dark:to-pink-950/40 p-5 rounded-2xl border border-purple-200/80 dark:border-purple-900/60 shadow-sm">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Heading level="h2" className="text-xl font-extrabold flex items-center gap-2 text-purple-950 dark:text-purple-100">
              <Sparkles className="w-6 h-6 text-purple-600 animate-pulse" /> Structured Occasion Taxonomy & Recommendation Matrix
            </Heading>
            <Badge color="purple" className="text-xs font-bold">Enterprise Engine</Badge>
          </div>
          <Text className="text-xs text-ui-fg-subtle">
            Manage celebration occasions, map products & categories, and power smart cross-sell and storefront occasion discovery.
          </Text>
        </div>

        <div className="flex items-center gap-2.5 shrink-0">
          <Button
            size="small"
            variant="secondary"
            onClick={handleRunMigration}
            isLoading={migrating}
            className="text-xs flex items-center gap-1.5 border-purple-300 dark:border-purple-800"
          >
            <Wand2 className="w-3.5 h-3.5 text-purple-600" /> Auto-Migrate Legacy Occasions
          </Button>
          <Button
            size="small"
            onClick={handleOpenCreate}
            className="bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold flex items-center gap-1.5 shadow-md shadow-purple-600/20"
          >
            <Plus className="w-4 h-4" /> + Create Occasion
          </Button>
        </div>
      </div>

      {/* Status Notifications */}
      {msg && (
        <div
          className={`p-3.5 rounded-xl text-xs font-semibold flex items-center justify-between shadow-sm animate-in fade-in ${
            msg.type === "success"
              ? "bg-emerald-50 border border-emerald-200 text-emerald-950"
              : "bg-rose-50 border border-rose-200 text-rose-950"
          }`}
        >
          <div className="flex items-center gap-2">
            {msg.type === "success" ? <CheckCircle className="w-4 h-4 text-emerald-600" /> : <AlertCircle className="w-4 h-4 text-rose-600" />}
            <span>{msg.text}</span>
          </div>
          <button type="button" onClick={() => setMsg(null)} className="text-ui-fg-subtle hover:text-ui-fg-base text-xs">
            ✕
          </button>
        </div>
      )}

      {/* Create / Edit Modal */}
      {showModal && (
        <Container className="p-6 border-2 border-purple-200 dark:border-purple-900 shadow-xl rounded-2xl animate-in fade-in-50 zoom-in-95">
          <div className="flex items-center justify-between pb-4 mb-4 border-b border-ui-border-base">
            <div className="flex items-center gap-2">
              <span className="text-2xl">{icon || "🎉"}</span>
              <div>
                <Heading level="h3" className="text-base font-bold text-ui-fg-base">
                  {editingOccasion ? `Edit Occasion: ${editingOccasion.name}` : "Create New Celebration Occasion"}
                </Heading>
                <Text className="text-xs text-ui-fg-subtle">
                  Structured occasion tags map directly to products, categories, and AI cross-sell rules.
                </Text>
              </div>
            </div>
            <Button size="small" variant="transparent" onClick={() => setShowModal(false)}>✕</Button>
          </div>

          <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="occ_form_name" className="text-xs font-semibold">Occasion Name *</Label>
              <Input
                id="occ_form_name"
                value={name}
                onChange={(e) => {
                  setName(e.target.value);
                  if (!editingOccasion) {
                    setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9]+/g, "-"));
                  }
                }}
                placeholder="e.g. Birthday, Silver Jubilee, Mother's Day"
                required
                className="mt-1"
              />
            </div>

            <div>
              <Label htmlFor="occ_form_slug" className="text-xs font-semibold">Storefront URL Slug *</Label>
              <Input
                id="occ_form_slug"
                value={slug}
                onChange={(e) => setSlug(e.target.value)}
                placeholder="e.g. birthday, silver-jubilee"
                required
                className="mt-1"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="occ_form_icon" className="text-xs font-semibold">Emoji Icon</Label>
                <Input
                  id="occ_form_icon"
                  value={icon}
                  onChange={(e) => setIcon(e.target.value)}
                  placeholder="🎂"
                  className="mt-1"
                />
              </div>
              <div>
                <Label htmlFor="occ_form_order" className="text-xs font-semibold">Display Priority</Label>
                <Input
                  id="occ_form_order"
                  type="number"
                  value={displayOrder}
                  onChange={(e) => setDisplayOrder(e.target.value)}
                  className="mt-1"
                />
              </div>
            </div>

            <div>
              <Label htmlFor="occ_form_status" className="text-xs font-semibold">Occasion Status</Label>
              <select
                id="occ_form_status"
                value={status}
                onChange={(e: any) => setStatus(e.target.value)}
                className="w-full h-10 px-3 rounded-md border border-ui-border-base bg-ui-bg-field text-sm mt-1"
              >
                <option value="active">Active (Available across catalog & recommendations)</option>
                <option value="archived">Archived (Hidden from new product assignment)</option>
              </select>
            </div>

            <div className="md:col-span-2">
              <Label htmlFor="occ_form_desc" className="text-xs font-semibold">Storefront Description & AI Context</Label>
              <Input
                id="occ_form_desc"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Curated celebration cakes & party accessories for..."
                className="mt-1"
              />
            </div>

            <div className="md:col-span-2 flex items-center justify-end gap-2 pt-4 border-t border-ui-border-base">
              <Button type="button" variant="transparent" onClick={() => setShowModal(false)}>Cancel</Button>
              <Button type="submit" isLoading={submitting} className="bg-purple-600 hover:bg-purple-700 text-white font-semibold">
                {editingOccasion ? "Update Occasion" : "Save & Register Occasion"}
              </Button>
            </div>
          </form>
        </Container>
      )}

      {/* Occasions List & Filtering */}
      <Container className="p-6 space-y-4">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <Text className="font-bold text-base text-ui-fg-base">
              Occasions Registry ({filtered.length})
            </Text>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 w-full sm:w-auto">
            {/* Search Input */}
            <div className="relative flex-1 sm:w-64">
              <Search className="w-4 h-4 absolute left-3 top-2.5 text-ui-fg-subtle" />
              <input
                type="text"
                placeholder="Search occasions..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-9 pr-3 py-1.5 text-xs rounded-lg border border-ui-border-base bg-ui-bg-field"
              />
            </div>

            {/* Filter Badges */}
            <div className="flex items-center gap-1 bg-ui-bg-subtle p-1 rounded-lg border border-ui-border-base text-xs">
              <button
                type="button"
                onClick={() => setStatusFilter("all")}
                className={`px-2.5 py-1 rounded font-semibold transition ${
                  statusFilter === "all" ? "bg-white dark:bg-slate-800 text-purple-600 shadow-sm" : "text-ui-fg-subtle"
                }`}
              >
                All
              </button>
              <button
                type="button"
                onClick={() => setStatusFilter("active")}
                className={`px-2.5 py-1 rounded font-semibold transition ${
                  statusFilter === "active" ? "bg-white dark:bg-slate-800 text-emerald-600 shadow-sm" : "text-ui-fg-subtle"
                }`}
              >
                Active
              </button>
              <button
                type="button"
                onClick={() => setStatusFilter("archived")}
                className={`px-2.5 py-1 rounded font-semibold transition ${
                  statusFilter === "archived" ? "bg-white dark:bg-slate-800 text-rose-600 shadow-sm" : "text-ui-fg-subtle"
                }`}
              >
                Archived
              </button>
            </div>
          </div>
        </div>

        {loading ? (
          <div className="text-center py-12 text-ui-fg-subtle flex flex-col items-center gap-2">
            <RefreshCw className="w-6 h-6 animate-spin text-purple-600" />
            <Text className="text-xs">Loading occasion taxonomy...</Text>
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-12 text-ui-fg-subtle">
            <Sparkles className="w-8 h-8 mx-auto mb-2 opacity-40 text-purple-500" />
            <Text className="text-sm">No occasions match search criteria.</Text>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
            {filtered.map((occ) => {
              const prodCount = getProductCountForOccasion(occ);
              const catCount = getCategoryCountForOccasion(occ);
              const isArchived = occ.status === "archived";

              return (
                <div
                  key={occ.id}
                  className={`p-4 rounded-xl border transition-all flex flex-col justify-between gap-3 ${
                    isArchived
                      ? "border-ui-border-base bg-ui-bg-subtle/40 opacity-70"
                      : "border-ui-border-base bg-white dark:bg-slate-900 hover:border-purple-300 hover:shadow-md"
                  }`}
                >
                  <div className="space-y-1.5">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="text-2xl p-1.5 bg-purple-50 dark:bg-purple-950/60 rounded-xl border border-purple-200 dark:border-purple-900 shrink-0">
                          {occ.icon || "🎉"}
                        </span>
                        <div className="min-w-0">
                          <Text className="font-bold text-sm text-ui-fg-base truncate">{occ.name}</Text>
                          <Text className="text-[11px] text-purple-600 font-mono">/occasions/{occ.slug}</Text>
                        </div>
                      </div>

                      <Badge color={isArchived ? "red" : "green"} className="text-[10px] uppercase font-bold shrink-0">
                        {occ.status}
                      </Badge>
                    </div>

                    {occ.description && (
                      <Text className="text-xs text-ui-fg-subtle line-clamp-2 mt-1">
                        {occ.description}
                      </Text>
                    )}
                  </div>

                  <div className="pt-2 border-t border-ui-border-base flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2">
                      <Badge color="purple" className="text-[10px]">
                        🎂 {prodCount} Products
                      </Badge>
                      <Badge color="grey" className="text-[10px]">
                        📁 {catCount} Categories
                      </Badge>
                    </div>

                    <div className="flex items-center gap-1">
                      <Button
                        size="small"
                        variant="transparent"
                        onClick={() => handleOpenEdit(occ)}
                        className="text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-950 p-1.5 h-7"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                      </Button>
                      {isArchived ? (
                        <Button
                          size="small"
                          variant="transparent"
                          onClick={() => handleRestore(occ.id, occ.name)}
                          className="text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950 p-1.5 h-7"
                        >
                          <RotateCcw className="w-3.5 h-3.5" />
                        </Button>
                      ) : (
                        <Button
                          size="small"
                          variant="transparent"
                          onClick={() => handleArchive(occ.id, occ.name)}
                          className="text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950 p-1.5 h-7"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Container>
    </div>
  );
}
