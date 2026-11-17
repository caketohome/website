"use client";

import React, { useState, useEffect, useRef } from "react";
import { Container, Heading, Text, Badge, Input, Button, Label, Textarea } from "@medusajs/ui";
import { apiClient } from "@frontend/lib/api-client";
import {
  Sparkles, Plus, Edit3, Trash2, RotateCcw, Search, AlertCircle,
  CheckCircle, RefreshCw, Wand2, ArrowUpDown, Image as ImageIcon,
  Upload, Eye, Globe, Star, Check, X, Shield, FolderOpen, Layers,
  ExternalLink, Sliders, Smartphone, Monitor
} from "lucide-react";
import { compressImageToWebP } from "@frontend/lib/util/image-compressor";
import { MediaSelectorModal, MediaSelection } from "./media-selector-modal";

export function OccasionsPanel() {
  const [occasions, setOccasions] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "archived">("all");

  // Modal State
  const [showModal, setShowModal] = useState(false);
  const [modalTab, setModalTab] = useState<"identity" | "media" | "display" | "seo" | "products">("identity");
  const [editingOccasion, setEditingOccasion] = useState<any | null>(null);

  // Form Fields
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [icon, setIcon] = useState("🎉");
  const [description, setDescription] = useState("");
  const [longDescription, setLongDescription] = useState("");
  
  // Media Fields
  const [coverImage, setCoverImage] = useState("");
  const [mobileCoverImage, setMobileCoverImage] = useState("");
  const [thumbnailImage, setThumbnailImage] = useState("");
  const [secondaryImage, setSecondaryImage] = useState("");
  const [altText, setAltText] = useState("");
  const [imagePosition, setImagePosition] = useState<"center" | "top" | "bottom" | "left" | "right">("center");

  // Display Fields
  const [displayOrder, setDisplayOrder] = useState("1");
  const [status, setStatus] = useState<"active" | "archived">("active");
  const [featured, setFeatured] = useState(false);
  const [showOnHomepage, setShowOnHomepage] = useState(true);
  const [showInGrid, setShowInGrid] = useState(true);
  const [showInNav, setShowInNav] = useState(true);
  const [showInSearch, setShowInSearch] = useState(true);

  // SEO Fields
  const [seoTitle, setSeoTitle] = useState("");
  const [seoDescription, setSeoDescription] = useState("");
  const [seoKeywords, setSeoKeywords] = useState("");
  const [ogImage, setOgImage] = useState("");
  const [canonicalUrl, setCanonicalUrl] = useState("");

  // Merchandising Fields
  const [featuredProductIds, setFeaturedProductIds] = useState<string[]>([]);
  const [includedCategoryIds, setIncludedCategoryIds] = useState<string[]>([]);

  // Uploading / Media State
  const [uploadingTarget, setUploadingTarget] = useState<"cover" | "mobile" | "thumb" | null>(null);
  const [mediaPickerTarget, setMediaPickerTarget] = useState<"cover" | "mobile" | "thumb" | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [msg, setMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Migration Trigger State
  const [migrating, setMigrating] = useState(false);

  // File Inputs
  const coverInputRef = useRef<HTMLInputElement>(null);
  const mobileInputRef = useRef<HTMLInputElement>(null);
  const thumbInputRef = useRef<HTMLInputElement>(null);

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
    setModalTab("identity");
    setName("");
    setSlug("");
    setIcon("🎉");
    setDescription("");
    setLongDescription("");
    setCoverImage("");
    setMobileCoverImage("");
    setThumbnailImage("");
    setSecondaryImage("");
    setAltText("");
    setImagePosition("center");
    setDisplayOrder(String(occasions.length + 1));
    setStatus("active");
    setFeatured(false);
    setShowOnHomepage(true);
    setShowInGrid(true);
    setShowInNav(true);
    setShowInSearch(true);
    setSeoTitle("");
    setSeoDescription("");
    setSeoKeywords("");
    setOgImage("");
    setCanonicalUrl("");
    setFeaturedProductIds([]);
    setIncludedCategoryIds([]);
    setShowModal(true);
    setMsg(null);
  };

  const handleOpenEdit = (occ: any) => {
    setEditingOccasion(occ);
    setModalTab("identity");
    setName(occ.name || "");
    setSlug(occ.slug || "");
    setIcon(occ.icon || "🎉");
    setDescription(occ.description || occ.short_description || "");
    setLongDescription(occ.long_description || "");
    const cover = occ.cover_image || occ.image_url || "";
    setCoverImage(cover);
    setMobileCoverImage(occ.mobile_cover_image || cover);
    setThumbnailImage(occ.thumbnail_image || occ.thumbnail || cover);
    setSecondaryImage(occ.secondary_image || "");
    setAltText(occ.alt_text || `${occ.name} celebration cake`);
    setImagePosition(occ.image_position || "center");
    setDisplayOrder(String(occ.display_order || 1));
    setStatus(occ.status || "active");
    setFeatured(occ.featured === true || occ.is_featured === true);
    setShowOnHomepage(occ.show_on_homepage !== false);
    setShowInGrid(occ.show_in_grid !== false);
    setShowInNav(occ.show_in_nav !== false);
    setShowInSearch(occ.show_in_search !== false);
    setSeoTitle(occ.seo_title || "");
    setSeoDescription(occ.seo_description || "");
    setSeoKeywords(occ.seo_keywords || "");
    setOgImage(occ.og_image || cover);
    setCanonicalUrl(occ.canonical_url || `https://caketohome.com/occasions/${occ.slug}`);
    setFeaturedProductIds(Array.isArray(occ.featured_product_ids) ? occ.featured_product_ids : []);
    setIncludedCategoryIds(Array.isArray(occ.included_category_ids) ? occ.included_category_ids : []);
    setShowModal(true);
    setMsg(null);
  };

  const handleFileUpload = async (file: File, target: "cover" | "mobile" | "thumb") => {
    const validTypes = ["image/jpeg", "image/png", "image/webp", "image/avif"];
    if (!validTypes.includes(file.type.toLowerCase())) {
      setMsg({ type: "error", text: "Invalid file type. Please upload JPG, PNG, WebP, or AVIF image." });
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      setMsg({ type: "error", text: "File size exceeds 10MB limit." });
      return;
    }

    setUploadingTarget(target);
    try {
      const isHero = target === "cover";
      const compressedDataUrl = await compressImageToWebP(file, {
        maxWidth: isHero ? 1920 : 800,
        maxHeight: isHero ? 1080 : 800,
        quality: isHero ? 0.85 : 0.82,
        maxSizeBytes: isHero ? 900 * 1024 : 350 * 1024,
      });

      if (target === "cover") {
        setCoverImage(compressedDataUrl);
        if (!mobileCoverImage) setMobileCoverImage(compressedDataUrl);
        if (!thumbnailImage) setThumbnailImage(compressedDataUrl);
      } else if (target === "mobile") {
        setMobileCoverImage(compressedDataUrl);
      } else if (target === "thumb") {
        setThumbnailImage(compressedDataUrl);
      }
      setMsg({ type: "success", text: "Image optimized and loaded successfully." });
    } catch (err: any) {
      setMsg({ type: "error", text: err.message || "Failed to process image." });
    } finally {
      setUploadingTarget(null);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setSubmitting(true);
    setMsg(null);

    const cleanSlug = slug.trim() || name.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-");
    const payload = {
      name: name.trim(),
      slug: cleanSlug,
      icon: icon.trim() || "🎉",
      description: description.trim(),
      short_description: description.trim(),
      long_description: longDescription.trim(),
      cover_image: coverImage.trim(),
      image_url: coverImage.trim(),
      mobile_cover_image: (mobileCoverImage || coverImage).trim(),
      thumbnail_image: (thumbnailImage || coverImage).trim(),
      secondary_image: secondaryImage.trim(),
      alt_text: altText.trim() || `${name.trim()} celebration cake`,
      image_position: imagePosition,
      display_order: Number(displayOrder) || 1,
      status,
      featured,
      is_featured: featured,
      show_on_homepage: showOnHomepage,
      show_in_grid: showInGrid,
      show_in_nav: showInNav,
      show_in_search: showInSearch,
      seo_title: seoTitle.trim() || `${name.trim()} Cakes Online Kerala | CakeToHome`,
      seo_description: seoDescription.trim() || `Order handcrafted ${name.trim()} cakes delivered in 2 hours across Kerala.`,
      seo_keywords: seoKeywords.trim(),
      og_image: (ogImage || coverImage).trim(),
      canonical_url: canonicalUrl.trim() || `https://caketohome.com/occasions/${cleanSlug}`,
      featured_product_ids: featuredProductIds,
      included_category_ids: includedCategoryIds,
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
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-gradient-to-r from-brand-navy/10 via-brand-navy/5 to-brand-gold/10 dark:from-brand-navy/30 dark:via-brand-deep/40 dark:to-brand-navy/30 p-5 rounded-2xl border border-brand-gold/30 shadow-sm">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Heading level="h2" className="text-xl font-extrabold flex items-center gap-2 text-brand-navy dark:text-[#F4F5F8]">
              <Sparkles className="w-6 h-6 text-brand-gold animate-pulse" /> Structured Occasion Taxonomy & Recommendation Matrix
            </Heading>
            <Badge color="purple" className="text-xs font-bold">Enterprise PIM</Badge>
          </div>
          <Text className="text-xs text-ui-fg-subtle">
            Manage celebration occasions, high-res cover imagery, SEO metadata, and product discovery mappings.
          </Text>
        </div>

        <div className="flex items-center gap-2.5 shrink-0">
          <Button
            size="small"
            variant="secondary"
            onClick={handleRunMigration}
            isLoading={migrating}
            className="text-xs flex items-center gap-1.5 border-brand-primary/30 dark:border-brand-navy"
          >
            <Wand2 className="w-3.5 h-3.5 text-brand-primary" /> Auto-Migrate Legacy Occasions
          </Button>
          <Button
            size="small"
            onClick={handleOpenCreate}
            className="bg-brand-primary hover:bg-brand-navy text-white text-xs font-bold flex items-center gap-1.5 shadow-md shadow-brand-primary/20"
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
        <Container className="p-6 border-2 border-brand-primary/30 dark:border-brand-navy shadow-xl rounded-2xl animate-in fade-in-50 zoom-in-95">
          <div className="flex items-center justify-between pb-4 mb-4 border-b border-ui-border-base">
            <div className="flex items-center gap-3">
              <span className="text-3xl p-2 bg-brand-light dark:bg-brand-navy/60 rounded-xl border border-brand-primary/30 dark:border-brand-navy shrink-0">
                {icon || "🎉"}
              </span>
              <div>
                <Heading level="h3" className="text-lg font-bold text-ui-fg-base">
                  {editingOccasion ? `Edit Occasion: ${editingOccasion.name}` : "Create Celebration Occasion"}
                </Heading>
                <Text className="text-xs text-ui-fg-subtle">
                  Complete PIM customization: identity, cover imagery, SEO tags, and product associations.
                </Text>
              </div>
            </div>
            <Button size="small" variant="transparent" onClick={() => setShowModal(false)}>✕</Button>
          </div>

          {/* Modal Tabs */}
          <div className="flex items-center gap-2 border-b border-ui-border-base pb-3 mb-5 overflow-x-auto">
            <button
              type="button"
              onClick={() => setModalTab("identity")}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 ${
                modalTab === "identity" ? "bg-brand-primary text-white shadow-sm" : "bg-ui-bg-subtle text-ui-fg-subtle hover:text-ui-fg-base"
              }`}
            >
              <Sparkles className="w-3.5 h-3.5" /> Identity & Content
            </button>
            <button
              type="button"
              onClick={() => setModalTab("media")}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 ${
                modalTab === "media" ? "bg-brand-primary text-white shadow-sm" : "bg-ui-bg-subtle text-ui-fg-subtle hover:text-ui-fg-base"
              }`}
            >
              <ImageIcon className="w-3.5 h-3.5" /> Media & Cover Imagery
            </button>
            <button
              type="button"
              onClick={() => setModalTab("display")}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 ${
                modalTab === "display" ? "bg-brand-primary text-white shadow-sm" : "bg-ui-bg-subtle text-ui-fg-subtle hover:text-ui-fg-base"
              }`}
            >
              <Eye className="w-3.5 h-3.5" /> Display & Discovery
            </button>
            <button
              type="button"
              onClick={() => setModalTab("seo")}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 ${
                modalTab === "seo" ? "bg-brand-primary text-white shadow-sm" : "bg-ui-bg-subtle text-ui-fg-subtle hover:text-ui-fg-base"
              }`}
            >
              <Globe className="w-3.5 h-3.5" /> SEO & Social
            </button>
            <button
              type="button"
              onClick={() => setModalTab("products")}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 ${
                modalTab === "products" ? "bg-brand-primary text-white shadow-sm" : "bg-ui-bg-subtle text-ui-fg-subtle hover:text-ui-fg-base"
              }`}
            >
              <Layers className="w-3.5 h-3.5" /> Products ({featuredProductIds.length})
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* 1. Identity Tab */}
            {modalTab === "identity" && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
                    placeholder="e.g. Birthday, Silver Jubilee, Wedding"
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
                    className="mt-1 font-mono text-xs"
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
                    <option value="active">Active (Visible across catalog, filters & homepage)</option>
                    <option value="archived">Archived (Hidden from storefront navigation)</option>
                  </select>
                </div>

                <div className="md:col-span-2">
                  <Label htmlFor="occ_form_desc" className="text-xs font-semibold">Short Subtitle / Description</Label>
                  <Input
                    id="occ_form_desc"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Brief highlight: e.g. Handcrafted cakes tailored for life's sweetest birthdays."
                    className="mt-1"
                  />
                </div>

                <div className="md:col-span-2">
                  <Label htmlFor="occ_form_long_desc" className="text-xs font-semibold">Long Editorial / Brand Story</Label>
                  <Textarea
                    id="occ_form_long_desc"
                    value={longDescription}
                    onChange={(e) => setLongDescription(e.target.value)}
                    placeholder="Full occasion story for dedicated occasion landing pages..."
                    rows={3}
                    className="mt-1"
                  />
                </div>
              </div>
            )}

            {/* 2. Media & Cover Imagery Tab */}
            {modalTab === "media" && (
              <div className="space-y-5">
                {/* Cover Image (Desktop) */}
                <div className="p-4 bg-ui-bg-subtle rounded-2xl border border-ui-border-base space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Monitor className="w-4 h-4 text-brand-primary" />
                      <Text className="text-xs font-bold text-ui-fg-base uppercase tracking-wider">
                        Primary Cover Image (Desktop / Storefront Grid)
                      </Text>
                    </div>
                    {coverImage && (
                      <button
                        type="button"
                        onClick={() => setCoverImage("")}
                        className="text-[11px] text-rose-600 hover:underline flex items-center gap-1"
                      >
                        <Trash2 className="w-3 h-3" /> Remove Cover
                      </button>
                    )}
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-start">
                    {/* Preview Window */}
                    <div className="relative rounded-xl border border-ui-border-base overflow-hidden aspect-[16/9] bg-ui-bg-base flex items-center justify-center group shadow-sm">
                      {coverImage ? (
                        <>
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={coverImage}
                            alt={altText || name}
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                          />
                          <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                            <span className="text-white text-xs font-bold px-2 py-1 bg-black/60 rounded-md">
                              {name} Cover
                            </span>
                          </div>
                        </>
                      ) : (
                        <div className="text-center p-4 text-ui-fg-subtle">
                          <ImageIcon className="w-8 h-8 mx-auto mb-1 opacity-40" />
                          <p className="text-[11px]">No cover image set.</p>
                        </div>
                      )}
                    </div>

                    {/* Upload / URL Controls */}
                    <div className="md:col-span-2 space-y-2.5">
                      <div className="flex flex-wrap items-center gap-2">
                        <input
                          type="file"
                          ref={coverInputRef}
                          accept="image/jpeg,image/png,image/webp,image/avif"
                          className="hidden"
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) handleFileUpload(file, "cover");
                          }}
                        />
                        <Button
                          type="button"
                          size="small"
                          variant="secondary"
                          onClick={() => coverInputRef.current?.click()}
                          isLoading={uploadingTarget === "cover"}
                          className="text-xs flex items-center gap-1.5"
                        >
                          <Upload className="w-3.5 h-3.5" /> Upload File (WebP Auto-Compress)
                        </Button>

                        <Button
                          type="button"
                          size="small"
                          variant="transparent"
                          onClick={() => setMediaPickerTarget("cover")}
                          className="text-xs flex items-center gap-1.5 border border-ui-border-base"
                        >
                          <FolderOpen className="w-3.5 h-3.5 text-brand-primary" /> Choose From Media Library
                        </Button>
                      </div>

                      <div>
                        <Label htmlFor="occ_cover_url" className="text-[11px] text-ui-fg-muted font-medium">Or paste image URL:</Label>
                        <Input
                          id="occ_cover_url"
                          value={coverImage}
                          onChange={(e) => setCoverImage(e.target.value)}
                          placeholder="https://images.unsplash.com/photo-..."
                          className="mt-0.5 text-xs font-mono"
                        />
                      </div>

                      <div className="grid grid-cols-2 gap-3 pt-1">
                        <div>
                          <Label htmlFor="occ_alt_text" className="text-[11px] text-ui-fg-muted font-medium">Image Alt Text (SEO)</Label>
                          <Input
                            id="occ_alt_text"
                            value={altText}
                            onChange={(e) => setAltText(e.target.value)}
                            placeholder="e.g. Handcrafted chocolate birthday cake"
                            className="text-xs mt-0.5"
                          />
                        </div>
                        <div>
                          <Label htmlFor="occ_focal_pos" className="text-[11px] text-ui-fg-muted font-medium">Focal Position</Label>
                          <select
                            id="occ_focal_pos"
                            value={imagePosition}
                            onChange={(e: any) => setImagePosition(e.target.value)}
                            className="w-full h-8 px-2 rounded-md border border-ui-border-base bg-ui-bg-field text-xs mt-0.5"
                          >
                            <option value="center">Center (Default)</option>
                            <option value="top">Top Focus</option>
                            <option value="bottom">Bottom Focus</option>
                            <option value="left">Left Focus</option>
                            <option value="right">Right Focus</option>
                          </select>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Mobile Cover & Thumbnail Variants */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Mobile Cover */}
                  <div className="p-3.5 bg-ui-bg-subtle rounded-2xl border border-ui-border-base space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5">
                        <Smartphone className="w-3.5 h-3.5 text-brand-primary" />
                        <Text className="text-xs font-bold text-ui-fg-base">Mobile Cover Variant</Text>
                      </div>
                      {mobileCoverImage && (
                        <button type="button" onClick={() => setMobileCoverImage("")} className="text-[10px] text-rose-600 hover:underline">
                          Clear
                        </button>
                      )}
                    </div>
                    <div className="flex gap-3 items-center">
                      <div className="w-16 h-16 rounded-lg border border-ui-border-base overflow-hidden shrink-0 bg-ui-bg-base flex items-center justify-center">
                        {mobileCoverImage || coverImage ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={mobileCoverImage || coverImage} alt="Mobile Cover" className="w-full h-full object-cover" />
                        ) : (
                          <Smartphone className="w-4 h-4 opacity-30" />
                        )}
                      </div>
                      <div className="flex-1 space-y-1">
                        <Input
                          value={mobileCoverImage}
                          onChange={(e) => setMobileCoverImage(e.target.value)}
                          placeholder="Mobile image URL..."
                          className="text-xs font-mono h-7"
                        />
                        <div className="flex gap-1.5">
                          <input
                            type="file"
                            ref={mobileInputRef}
                            accept="image/*"
                            className="hidden"
                            onChange={(e) => {
                              const file = e.target.files?.[0];
                              if (file) handleFileUpload(file, "mobile");
                            }}
                          />
                          <Button
                            type="button"
                            size="small"
                            variant="secondary"
                            onClick={() => mobileInputRef.current?.click()}
                            isLoading={uploadingTarget === "mobile"}
                            className="text-[10px] h-6 px-2"
                          >
                            Upload Mobile
                          </Button>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Thumbnail Image */}
                  <div className="p-3.5 bg-ui-bg-subtle rounded-2xl border border-ui-border-base space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5">
                        <Layers className="w-3.5 h-3.5 text-brand-gold" />
                        <Text className="text-xs font-bold text-ui-fg-base">Square Thumbnail</Text>
                      </div>
                      {thumbnailImage && (
                        <button type="button" onClick={() => setThumbnailImage("")} className="text-[10px] text-rose-600 hover:underline">
                          Clear
                        </button>
                      )}
                    </div>
                    <div className="flex gap-3 items-center">
                      <div className="w-16 h-16 rounded-lg border border-ui-border-base overflow-hidden shrink-0 bg-ui-bg-base flex items-center justify-center">
                        {thumbnailImage || coverImage ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={thumbnailImage || coverImage} alt="Thumbnail" className="w-full h-full object-cover" />
                        ) : (
                          <ImageIcon className="w-4 h-4 opacity-30" />
                        )}
                      </div>
                      <div className="flex-1 space-y-1">
                        <Input
                          value={thumbnailImage}
                          onChange={(e) => setThumbnailImage(e.target.value)}
                          placeholder="Thumbnail URL..."
                          className="text-xs font-mono h-7"
                        />
                        <div className="flex gap-1.5">
                          <input
                            type="file"
                            ref={thumbInputRef}
                            accept="image/*"
                            className="hidden"
                            onChange={(e) => {
                              const file = e.target.files?.[0];
                              if (file) handleFileUpload(file, "thumb");
                            }}
                          />
                          <Button
                            type="button"
                            size="small"
                            variant="secondary"
                            onClick={() => thumbInputRef.current?.click()}
                            isLoading={uploadingTarget === "thumb"}
                            className="text-[10px] h-6 px-2"
                          >
                            Upload Thumbnail
                          </Button>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* 3. Display & Discovery Tab */}
            {modalTab === "display" && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="p-4 bg-ui-bg-subtle rounded-xl border border-ui-border-base flex items-center justify-between">
                  <div>
                    <Text className="text-xs font-bold text-ui-fg-base">Featured Occasion</Text>
                    <Text className="text-[11px] text-ui-fg-muted">Highlight with gold star in storefront grids & hero collections.</Text>
                  </div>
                  <input
                    type="checkbox"
                    checked={featured}
                    onChange={(e) => setFeatured(e.target.checked)}
                    className="w-4 h-4 rounded text-brand-primary focus:ring-brand-primary"
                  />
                </div>

                <div className="p-4 bg-ui-bg-subtle rounded-xl border border-ui-border-base flex items-center justify-between">
                  <div>
                    <Text className="text-xs font-bold text-ui-fg-base">Show on Homepage</Text>
                    <Text className="text-[11px] text-ui-fg-muted">Display in the homepage curated occasions carousel.</Text>
                  </div>
                  <input
                    type="checkbox"
                    checked={showOnHomepage}
                    onChange={(e) => setShowOnHomepage(e.target.checked)}
                    className="w-4 h-4 rounded text-brand-primary focus:ring-brand-primary"
                  />
                </div>

                <div className="p-4 bg-ui-bg-subtle rounded-xl border border-ui-border-base flex items-center justify-between">
                  <div>
                    <Text className="text-xs font-bold text-ui-fg-base">Show in Occasion Grid</Text>
                    <Text className="text-[11px] text-ui-fg-muted">Make available in CMS Occasions Grid sections.</Text>
                  </div>
                  <input
                    type="checkbox"
                    checked={showInGrid}
                    onChange={(e) => setShowInGrid(e.target.checked)}
                    className="w-4 h-4 rounded text-brand-primary focus:ring-brand-primary"
                  />
                </div>

                <div className="p-4 bg-ui-bg-subtle rounded-xl border border-ui-border-base flex items-center justify-between">
                  <div>
                    <Text className="text-xs font-bold text-ui-fg-base">Show in Main Navigation</Text>
                    <Text className="text-[11px] text-ui-fg-muted">Feature under the Occasions menu dropdown.</Text>
                  </div>
                  <input
                    type="checkbox"
                    checked={showInNav}
                    onChange={(e) => setShowInNav(e.target.checked)}
                    className="w-4 h-4 rounded text-brand-primary focus:ring-brand-primary"
                  />
                </div>

                <div className="p-4 bg-ui-bg-subtle rounded-xl border border-ui-border-base flex items-center justify-between">
                  <div>
                    <Text className="text-xs font-bold text-ui-fg-base">Show in Search Filters</Text>
                    <Text className="text-[11px] text-ui-fg-muted">Allow customers to filter catalog cakes by this occasion.</Text>
                  </div>
                  <input
                    type="checkbox"
                    checked={showInSearch}
                    onChange={(e) => setShowInSearch(e.target.checked)}
                    className="w-4 h-4 rounded text-brand-primary focus:ring-brand-primary"
                  />
                </div>
              </div>
            )}

            {/* 4. SEO & Social Tab */}
            {modalTab === "seo" && (
              <div className="space-y-3">
                <div>
                  <Label htmlFor="occ_seo_title" className="text-xs font-semibold">SEO Meta Title</Label>
                  <Input
                    id="occ_seo_title"
                    value={seoTitle}
                    onChange={(e) => setSeoTitle(e.target.value)}
                    placeholder={`e.g. Order ${name || "Celebration"} Cakes Online in Kerala | CakeToHome`}
                    className="mt-1 text-xs"
                  />
                </div>

                <div>
                  <Label htmlFor="occ_seo_desc" className="text-xs font-semibold">SEO Meta Description</Label>
                  <Textarea
                    id="occ_seo_desc"
                    value={seoDescription}
                    onChange={(e) => setSeoDescription(e.target.value)}
                    placeholder={`Handcrafted ${name || "celebration"} cakes delivered fresh across Kerala with 2-hour express delivery...`}
                    rows={2}
                    className="mt-1 text-xs"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label htmlFor="occ_seo_keys" className="text-xs font-semibold">SEO Keywords</Label>
                    <Input
                      id="occ_seo_keys"
                      value={seoKeywords}
                      onChange={(e) => setSeoKeywords(e.target.value)}
                      placeholder="birthday cake online, cake delivery kerala"
                      className="mt-1 text-xs"
                    />
                  </div>
                  <div>
                    <Label htmlFor="occ_canon_url" className="text-xs font-semibold">Canonical URL</Label>
                    <Input
                      id="occ_canon_url"
                      value={canonicalUrl}
                      onChange={(e) => setCanonicalUrl(e.target.value)}
                      placeholder={`https://caketohome.com/occasions/${slug || "birthday"}`}
                      className="mt-1 text-xs font-mono"
                    />
                  </div>
                </div>

                <div>
                  <Label htmlFor="occ_og_img" className="text-xs font-semibold">OpenGraph Social Share Image URL</Label>
                  <Input
                    id="occ_og_img"
                    value={ogImage}
                    onChange={(e) => setOgImage(e.target.value)}
                    placeholder={coverImage || "https://images.unsplash.com/..."}
                    className="mt-1 text-xs font-mono"
                  />
                </div>
              </div>
            )}

            {/* 5. Products & Category Mapping */}
            {modalTab === "products" && (
              <div className="space-y-4">
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <Text className="text-xs font-bold text-ui-fg-base">
                      Featured Products for {name || "this Occasion"} ({featuredProductIds.length} mapped)
                    </Text>
                    {featuredProductIds.length > 0 && (
                      <button
                        type="button"
                        onClick={() => setFeaturedProductIds([])}
                        className="text-[11px] text-rose-600 hover:underline"
                      >
                        Clear All Mappings
                      </button>
                    )}
                  </div>

                  <div className="max-h-56 overflow-y-auto p-2 bg-ui-bg-subtle rounded-xl border border-ui-border-base grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {products.map((p) => {
                      const isSelected = featuredProductIds.includes(p.id);
                      return (
                        <label
                          key={p.id}
                          className={`flex items-center gap-2.5 p-2 rounded-lg cursor-pointer text-xs border transition ${
                            isSelected
                              ? "bg-brand-light border-brand-primary/30 font-bold text-brand-navy dark:bg-brand-navy/60 dark:text-brand-primary/30"
                              : "bg-white dark:bg-slate-900 border-ui-border-base hover:bg-ui-bg-base"
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => {
                              setFeaturedProductIds(prev =>
                                isSelected ? prev.filter(id => id !== p.id) : [...prev, p.id]
                              );
                            }}
                            className="rounded text-brand-primary focus:ring-brand-primary"
                          />
                          <span className="truncate">{p.title || p.name}</span>
                        </label>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}

            {/* Modal Actions */}
            <div className="flex items-center justify-between pt-4 border-t border-ui-border-base">
              <div className="text-xs text-ui-fg-muted">
                {coverImage ? <span className="text-emerald-600 font-medium flex items-center gap-1"><Check className="w-3.5 h-3.5" /> Cover Image Configured</span> : <span className="text-brand-gold font-medium flex items-center gap-1"><AlertCircle className="w-3.5 h-3.5" /> Using curated fallback cover</span>}
              </div>
              <div className="flex items-center gap-2">
                <Button type="button" variant="transparent" onClick={() => setShowModal(false)}>Cancel</Button>
                <Button type="submit" isLoading={submitting} className="bg-brand-primary hover:bg-brand-navy text-white font-semibold">
                  {editingOccasion ? "Save & Update Occasion" : "Register New Occasion"}
                </Button>
              </div>
            </div>
          </form>
        </Container>
      )}

      {/* Media Selector Modal */}
      {mediaPickerTarget && (
        <MediaSelectorModal
          isOpen={true}
          onClose={() => setMediaPickerTarget(null)}
          onSelect={(sel: MediaSelection) => {
            if (mediaPickerTarget === "cover") {
              setCoverImage(sel.url);
              if (sel.alt) setAltText(sel.alt);
            } else if (mediaPickerTarget === "mobile") {
              setMobileCoverImage(sel.url);
            } else if (mediaPickerTarget === "thumb") {
              setThumbnailImage(sel.url);
            }
            setMediaPickerTarget(null);
          }}
          title={`Select ${mediaPickerTarget === "cover" ? "Cover Image" : mediaPickerTarget === "mobile" ? "Mobile Cover" : "Thumbnail"} for ${name || "Occasion"}`}
        />
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
                  statusFilter === "all" ? "bg-white dark:bg-slate-800 text-brand-primary shadow-sm" : "text-ui-fg-subtle"
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
            <RefreshCw className="w-6 h-6 animate-spin text-brand-primary" />
            <Text className="text-xs">Loading occasion taxonomy...</Text>
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-12 text-ui-fg-subtle">
            <Sparkles className="w-8 h-8 mx-auto mb-2 opacity-40 text-brand-primary" />
            <Text className="text-sm">No occasions match search criteria.</Text>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
            {filtered.map((occ) => {
              const prodCount = getProductCountForOccasion(occ);
              const catCount = getCategoryCountForOccasion(occ);
              const isArchived = occ.status === "archived";
              const cover = occ.cover_image || occ.image_url || occ.thumbnail_image || "https://images.unsplash.com/photo-1558301211-0d8c8ddee6ec?auto=format&fit=crop&q=80&w=600";

              return (
                <div
                  key={occ.id}
                  className={`rounded-2xl border transition-all overflow-hidden flex flex-col justify-between ${
                    isArchived
                      ? "border-ui-border-base bg-ui-bg-subtle/40 opacity-70"
                      : "border-ui-border-base bg-white dark:bg-slate-900 hover:border-brand-primary/30 hover:shadow-md"
                  }`}
                >
                  {/* Card Cover Header with distinct Image */}
                  <div className="relative h-28 w-full overflow-hidden bg-ui-bg-subtle">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={cover}
                      alt={occ.alt_text || occ.name}
                      className="w-full h-full object-cover"
                      loading="lazy"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-transparent" />
                    
                    <div className="absolute top-2 left-2 flex items-center gap-1.5">
                      <span className="text-xl p-1 bg-black/50 backdrop-blur-sm rounded-lg border border-white/20">
                        {occ.icon || "🎉"}
                      </span>
                      {occ.featured && (
                        <span className="bg-brand-gold text-white text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1 shadow-sm">
                          <Star className="w-2.5 h-2.5 fill-white" /> Featured
                        </span>
                      )}
                    </div>

                    <div className="absolute top-2 right-2">
                      <Badge color={isArchived ? "red" : "green"} className="text-[10px] uppercase font-bold shadow-sm">
                        {occ.status}
                      </Badge>
                    </div>

                    <div className="absolute bottom-2 left-3 right-3 text-white">
                      <Text className="font-extrabold text-sm leading-tight drop-shadow truncate">
                        {occ.name}
                      </Text>
                      <Text className="text-[10px] text-brand-primary/30 font-mono">/occasions/{occ.slug}</Text>
                    </div>
                  </div>

                  {/* Card Body */}
                  <div className="p-3.5 space-y-2 flex-1 flex flex-col justify-between">
                    <Text className="text-xs text-ui-fg-subtle line-clamp-2">
                      {occ.description || occ.short_description || "Handcrafted celebration cakes."}
                    </Text>

                    <div className="pt-2 border-t border-ui-border-base flex items-center justify-between text-xs">
                      <div className="flex items-center gap-1.5">
                        <Badge color="purple" className="text-[10px]">
                          🎂 {prodCount} Products
                        </Badge>
                        <Badge color="grey" className="text-[10px]">
                          📁 {catCount} Cats
                        </Badge>
                      </div>

                      <div className="flex items-center gap-1">
                        <Button
                          size="small"
                          variant="transparent"
                          onClick={() => handleOpenEdit(occ)}
                          className="text-brand-primary hover:bg-brand-light dark:hover:bg-brand-navy p-1.5 h-7"
                          title="Edit Occasion"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                        </Button>
                        {isArchived ? (
                          <Button
                            size="small"
                            variant="transparent"
                            onClick={() => handleRestore(occ.id, occ.name)}
                            className="text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950 p-1.5 h-7"
                            title="Restore Occasion"
                          >
                            <RotateCcw className="w-3.5 h-3.5" />
                          </Button>
                        ) : (
                          <Button
                            size="small"
                            variant="transparent"
                            onClick={() => handleArchive(occ.id, occ.name)}
                            className="text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950 p-1.5 h-7"
                            title="Archive Occasion"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        )}
                      </div>
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
