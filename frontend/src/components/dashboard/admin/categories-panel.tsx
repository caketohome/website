"use client";

import { useEffect, useState } from "react";
import { Container, Heading, Text, Badge, Input, Button, Label } from "@medusajs/ui";
import { apiClient } from "@frontend/lib/api-client";
import { Plus, FolderTree, Edit3, Trash2, RotateCcw, Search, AlertCircle, CheckCircle, ChevronRight, ChevronDown, Layers, Globe, ShieldAlert } from "lucide-react";
import { CategoryImageUploader } from "./category-image-uploader";
import { OccasionSelector } from "./occasion-selector";

export function CategoriesPanel() {
  const [categories, setCategories] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [branches, setBranches] = useState<any[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingCategory, setEditingCategory] = useState<any | null>(null);

  // Tree Expand/Collapse State
  const [expandedIds, setExpandedIds] = useState<Record<string, boolean>>({});

  // Delete Safety Warning Modal State
  const [deleteWarning, setDeleteWarning] = useState<{ category: any; count: number } | null>(null);

  // Form State
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [description, setDescription] = useState("");
  const [parentId, setParentId] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [bannerUrl, setBannerUrl] = useState("");
  const [mobileBannerUrl, setMobileBannerUrl] = useState("");
  const [iconUrl, setIconUrl] = useState("");
  const [displayOrder, setDisplayOrder] = useState("1");
  const [displayPriority, setDisplayPriority] = useState("10");
  const [status, setStatus] = useState("active");
  const [visibility, setVisibility] = useState("public");
  const [isFeatured, setIsFeatured] = useState(false);
  const [isHomepage, setIsHomepage] = useState(false);
  const [seoTitle, setSeoTitle] = useState("");
  const [seoDescription, setSeoDescription] = useState("");
  const [seoKeywords, setSeoKeywords] = useState("");
  const [canonicalUrl, setCanonicalUrl] = useState("");
  const [ogImage, setOgImage] = useState("");
  const [selectedBranches, setSelectedBranches] = useState<string[]>(["res_01KXYMAHGFPRY1G9TZKEVGAGAT"]);
  const [occasionIds, setOccasionIds] = useState<string[]>(["occ_birthday"]);

  const [submitting, setSubmitting] = useState(false);
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const fetchCategories = () => {
    setLoading(true);
    Promise.all([
      apiClient.getAdminCategories().then((r: any) => setCategories(r?.categories || r?.data || [])).catch(() => null),
      apiClient.getAdminProducts().then((r: any) => setProducts(r?.products || r?.data || [])).catch(() => null),
      apiClient.getAdminBranches().then((r: any) => setBranches(r?.branches || r?.data || [])).catch(() => null),
    ]).finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchCategories();
  }, []);

  const toggleExpand = (id: string) => {
    setExpandedIds((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const getProductCountForCategory = (cat: any): number => {
    return products.filter(
      (p) =>
        p.category === cat.name ||
        p.category === cat.id ||
        p.primary_category_id === cat.id ||
        (Array.isArray(p.secondary_category_ids) && p.secondary_category_ids.includes(cat.id))
    ).length;
  };

  const resetForm = () => {
    setName("");
    setSlug("");
    setDescription("");
    setParentId("");
    setImageUrl("");
    setBannerUrl("");
    setMobileBannerUrl("");
    setIconUrl("");
    setDisplayOrder("1");
    setDisplayPriority("10");
    setStatus("active");
    setVisibility("public");
    setIsFeatured(false);
    setIsHomepage(false);
    setSeoTitle("");
    setSeoDescription("");
    setSeoKeywords("");
    setCanonicalUrl("");
    setOgImage("");
    setSelectedBranches(["res_01KXYMAHGFPRY1G9TZKEVGAGAT"]);
    setOccasionIds(["occ_birthday"]);
    setEditingCategory(null);
    setErrorMsg(null);
  };

  const handleOpenCreateModal = () => {
    resetForm();
    setShowModal(true);
  };

  const handleOpenEditModal = (cat: any) => {
    setEditingCategory(cat);
    setName(cat.name || "");
    setSlug(cat.slug || "");
    setDescription(cat.description || "");
    setParentId(cat.parent_id || "");
    setImageUrl(cat.image_url || "");
    setBannerUrl(cat.banner_url || "");
    setMobileBannerUrl(cat.mobile_banner_url || "");
    setIconUrl(cat.icon_url || "");
    setDisplayOrder(String(cat.display_order || 1));
    setDisplayPriority(String(cat.display_priority || 10));
    setStatus(cat.status || "active");
    setVisibility(cat.visibility || "public");
    setIsFeatured(Boolean(cat.is_featured));
    setIsHomepage(Boolean(cat.is_homepage));
    setSeoTitle(cat.seo_title || "");
    setSeoDescription(cat.seo_description || "");
    setSeoKeywords(cat.seo_keywords || "");
    setCanonicalUrl(cat.canonical_url || "");
    setOgImage(cat.og_image || "");
    setSelectedBranches(Array.isArray(cat.branch_ids) ? cat.branch_ids : ["res_01KXYMAHGFPRY1G9TZKEVGAGAT"]);
    setOccasionIds(Array.isArray(cat.occasion_ids) ? cat.occasion_ids : ["occ_birthday"]);
    setShowModal(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setSubmitting(true);
    setSuccessMsg(null);
    setErrorMsg(null);

    const generatedSlug = slug.trim()
      ? slug.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-")
      : name.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-");

    const payload = {
      name,
      slug: generatedSlug,
      description,
      parent_id: parentId || null,
      image_url: imageUrl || "https://images.unsplash.com/photo-1578985545062-69928b1d9587?auto=format&fit=crop&q=80&w=800",
      banner_url: bannerUrl || "https://images.unsplash.com/photo-1578985545062-69928b1d9587?auto=format&fit=crop&q=80&w=800",
      mobile_banner_url: mobileBannerUrl || bannerUrl,
      icon_url: iconUrl,
      display_order: parseInt(displayOrder, 10) || 1,
      display_priority: parseInt(displayPriority, 10) || 10,
      status,
      visibility,
      is_featured: isFeatured,
      is_homepage: isHomepage,
      seo_title: seoTitle || name,
      seo_description: seoDescription || description,
      seo_keywords: seoKeywords,
      canonical_url: canonicalUrl,
      og_image: ogImage || imageUrl,
      branch_ids: selectedBranches,
      occasion_ids: occasionIds,
    };

    try {
      if (editingCategory) {
        await apiClient.updateAdminCategory(editingCategory.id, payload);
        setSuccessMsg(`Successfully updated category "${name}"!`);
      } else {
        await apiClient.createAdminCategory(payload);
        setSuccessMsg(`Successfully created category "${name}"!`);
      }
      fetchCategories();
      setTimeout(() => {
        setShowModal(false);
        resetForm();
        setSuccessMsg(null);
      }, 1200);
    } catch (err: any) {
      setErrorMsg(err.message || "Failed to save category.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteAttempt = (cat: any) => {
    const assignedCount = getProductCountForCategory(cat);
    if (assignedCount > 0) {
      setDeleteWarning({ category: cat, count: assignedCount });
    } else {
      if (confirm(`Are you sure you want to archive category "${cat.name}"?`)) {
        handleDelete(cat.id);
      }
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await apiClient.deleteAdminCategory(id);
      fetchCategories();
      setDeleteWarning(null);
    } catch (err: any) {
      alert(err.message || "Failed to archive category.");
    }
  };

  const handleRestore = async (id: string) => {
    try {
      await apiClient.restoreAdminCategory(id);
      fetchCategories();
    } catch (err: any) {
      alert(err.message || "Failed to restore category.");
    }
  };

  const filtered = categories.filter((c) =>
    c.name.toLowerCase().includes(search.toLowerCase()) ||
    c.slug.toLowerCase().includes(search.toLowerCase())
  );

  const topLevelCategories = filtered.filter((c) => !c.parent_id);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <Heading level="h2" className="text-xl font-bold flex items-center gap-2">
            <FolderTree className="w-5 h-5 text-brand-primary" /> Dedicated Category Management
          </Heading>
          <Text className="text-ui-fg-subtle text-sm">
            Manage category tree hierarchy, banners, mobile icons, branch availability, and SEO metadata.
          </Text>
        </div>
        <Button size="small" onClick={handleOpenCreateModal} className="flex items-center gap-1.5 bg-brand-primary hover:bg-brand-navy text-white">
          <Plus className="w-4 h-4" /> Create Category
        </Button>
      </div>

      {/* Filter & Search Bar */}
      <Container className="p-4 flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="relative w-full md:w-80">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-ui-fg-subtle" />
          <Input
            placeholder="Search categories by name or slug..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <div className="flex items-center gap-2 text-xs text-ui-fg-subtle">
          <span>Total: <strong className="text-ui-fg-base">{categories.length}</strong></span>
          <span>•</span>
          <span>Active: <strong className="text-emerald-600">{categories.filter(c => c.status === "active").length}</strong></span>
          <span>•</span>
          <span>Archived: <strong className="text-rose-600">{categories.filter(c => c.status === "archived").length}</strong></span>
        </div>
      </Container>

      {/* Delete Safety Rule Warning Modal */}
      {deleteWarning && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/65 p-4">
          <div className="bg-white dark:bg-slate-900 border border-rose-300 dark:border-rose-800 rounded-xl shadow-2xl p-6 max-w-md w-full space-y-4 opacity-100">
            <div className="flex items-center gap-3 text-rose-600">
              <ShieldAlert className="w-7 h-7 shrink-0" />
              <div>
                <Heading level="h3" className="text-lg font-bold text-rose-600">Category Deletion Blocked</Heading>
                <Text className="text-xs text-ui-fg-subtle">Referential Integrity Protection</Text>
              </div>
            </div>
            <div className="p-3 bg-rose-50 dark:bg-rose-950/30 rounded-lg border border-rose-200 text-xs text-rose-800 dark:text-rose-300">
              Category <strong>"{deleteWarning.category.name}"</strong> contains <strong>{deleteWarning.count} active product(s)</strong>.
              <br className="my-1" />
              Please reassign these products first or archive the category to keep historical data intact.
            </div>
            <div className="flex items-center justify-end gap-2 pt-2">
              <Button size="small" variant="transparent" onClick={() => setDeleteWarning(null)}>Cancel</Button>
              <Button size="small" onClick={() => handleDelete(deleteWarning.category.id)} className="bg-rose-600 hover:bg-rose-700 text-white">
                Archive Category (Keep Data Safe)
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Category Create/Edit Modal */}
      {showModal && (
        <Container className="p-6 border-2 border-brand-primary/30 bg-brand-light/20 dark:bg-brand-navy/20">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <FolderTree className="w-5 h-5 text-brand-primary" />
              <Text className="font-semibold text-base">{editingCategory ? `Edit Category "${editingCategory.name}"` : "Create New Category"}</Text>
            </div>
            <Button size="small" variant="transparent" onClick={() => setShowModal(false)}>Close</Button>
          </div>

          {successMsg && (
            <div className="p-3 mb-4 rounded bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300 flex items-center gap-2 text-sm font-medium">
              <CheckCircle className="w-4 h-4" /> {successMsg}
            </div>
          )}

          {errorMsg && (
            <div className="p-3 mb-4 rounded bg-rose-50 text-rose-700 dark:bg-rose-950 dark:text-rose-300 flex items-center gap-2 text-sm font-medium">
              <AlertCircle className="w-4 h-4" /> {errorMsg}
            </div>
          )}

          <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="cat_name">Category Name *</Label>
              <Input id="cat_name" placeholder="e.g. Gourmet Truffle Cakes" value={name} onChange={(e) => setName(e.target.value)} required />
            </div>

            <div>
              <Label htmlFor="cat_slug">Custom Slug</Label>
              <Input id="cat_slug" placeholder="gourmet-truffle-cakes" value={slug} onChange={(e) => setSlug(e.target.value)} />
            </div>

            <div className="md:col-span-2">
              <Label htmlFor="cat_desc">Description</Label>
              <Input id="cat_desc" placeholder="Category summary for storefront and search engine optimization" value={description} onChange={(e) => setDescription(e.target.value)} />
            </div>

            <div>
              <Label htmlFor="cat_parent">Parent Category (Hierarchical Tree)</Label>
              <select
                id="cat_parent"
                value={parentId}
                onChange={(e) => setParentId(e.target.value)}
                className="w-full h-10 px-3 rounded-md border border-ui-border-base bg-ui-bg-field text-sm"
              >
                <option value="">None (Top-Level Primary Category)</option>
                {categories.filter((c) => c.id !== editingCategory?.id).map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>

            <div>
              <Label htmlFor="cat_order">Display Order</Label>
              <Input id="cat_order" type="number" value={displayOrder} onChange={(e) => setDisplayOrder(e.target.value)} />
            </div>

            <div className="md:col-span-2 space-y-4 pt-3 pb-3 border-t border-b border-ui-border-base bg-ui-bg-subtle/30 p-4 rounded-xl">
              <CategoryImageUploader
                label="Category Thumbnail"
                value={imageUrl}
                onChange={(url) => setImageUrl(url)}
                type="thumbnail"
                helperText="Optimal for category cards and menu navigation (600×600px square WebP)"
                onUploadingChange={setIsUploadingImage}
              />

              <CategoryImageUploader
                label="Category Hero Banner"
                value={bannerUrl}
                onChange={(url) => setBannerUrl(url)}
                type="hero"
                helperText="Optimal for storefront category header & promotional hero banners (1920×1080px landscape WebP)"
                onUploadingChange={setIsUploadingImage}
              />

              {/* Category Occasion Mapping */}
              <div className="pt-2 border-t border-ui-border-base">
                <OccasionSelector
                  label="Category Default Occasion Mapping"
                  selectedIds={occasionIds}
                  onChange={setOccasionIds}
                  helperText="Products in this category inherit these occasions unless explicitly overridden."
                />
              </div>
            </div>

            <div>
              <Label htmlFor="cat_status">Category Status</Label>
              <select
                id="cat_status"
                value={status}
                onChange={(e) => setStatus(e.target.value)}
                className="w-full h-10 px-3 rounded-md border border-ui-border-base bg-ui-bg-field text-sm"
              >
                <option value="active">Active (Visible)</option>
                <option value="draft">Draft (Hidden)</option>
                <option value="archived">Archived (Soft-Deleted)</option>
              </select>
            </div>

            <div>
              <Label htmlFor="cat_vis">Visibility Scope</Label>
              <select
                id="cat_vis"
                value={visibility}
                onChange={(e) => setVisibility(e.target.value)}
                className="w-full h-10 px-3 rounded-md border border-ui-border-base bg-ui-bg-field text-sm"
              >
                <option value="public">Public (All Storefronts)</option>
                <option value="branch_restricted">Branch Restricted</option>
                <option value="members_only">VIP Members Only</option>
              </select>
            </div>

            <div className="md:col-span-2 flex items-center justify-end gap-2 pt-4 border-t border-ui-border-base">
              <Button type="button" variant="transparent" onClick={() => setShowModal(false)}>Cancel</Button>
              <Button
                type="submit"
                isLoading={submitting}
                disabled={submitting || isUploadingImage}
                className="bg-brand-primary hover:bg-brand-navy text-white"
              >
                {isUploadingImage ? "Uploading Image..." : editingCategory ? "Update Category" : "Save & Register Category"}
              </Button>
            </div>
          </form>
        </Container>
      )}

      {/* Expandable Category Tree Hierarchy */}
      <Container className="p-6">
        <Text className="font-semibold text-base mb-4">Expandable Category Tree Hierarchy ({filtered.length})</Text>

        {loading ? (
          <Text className="text-sm text-ui-fg-subtle p-4">Loading category tree...</Text>
        ) : filtered.length === 0 ? (
          <div className="text-center py-8 text-ui-fg-subtle">
            <FolderTree className="w-8 h-8 mx-auto mb-2 opacity-50" />
            <Text>No categories match search filter.</Text>
          </div>
        ) : (
          <div className="space-y-2">
            {topLevelCategories.map((topCat) => {
              const children = filtered.filter((c) => c.parent_id === topCat.id || c.parent_id === topCat.name);
              const isExpanded = Boolean(expandedIds[topCat.id]);
              const productCount = getProductCountForCategory(topCat);

              return (
                <div key={topCat.id} className="border border-ui-border-base rounded-lg bg-ui-bg-subtle/40 overflow-hidden">
                  <div className="p-4 flex items-center justify-between hover:bg-brand-light/20 dark:hover:bg-brand-navy/20 transition-colors">
                    <div className="flex items-center gap-3">
                      {children.length > 0 ? (
                        <button type="button" onClick={() => toggleExpand(topCat.id)} className="p-1 hover:bg-ui-bg-field rounded">
                          {isExpanded ? <ChevronDown className="w-4 h-4 text-brand-primary" /> : <ChevronRight className="w-4 h-4 text-ui-fg-subtle" />}
                        </button>
                      ) : (
                        <span className="w-6" />
                      )}
                      {topCat.image_url && (
                        <img
                          src={topCat.image_url}
                          alt={topCat.name}
                          className="w-8 h-8 rounded-md object-cover border border-ui-border-base shrink-0 bg-ui-bg-field"
                        />
                      )}
                      <div>
                        <div className="flex items-center gap-2">
                          <Text className="font-bold text-base text-ui-fg-base">{topCat.name}</Text>
                          <Badge color={topCat.status === "active" ? "green" : topCat.status === "draft" ? "orange" : "red"}>
                            {topCat.status.toUpperCase()}
                          </Badge>
                          <Badge color="purple" className="text-[10px]">
                            {productCount} Products
                          </Badge>
                        </div>
                        <Text className="text-xs text-ui-fg-subtle">/{topCat.slug}</Text>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <Button size="small" variant="transparent" onClick={() => handleOpenEditModal(topCat)} className="text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-950">
                        <Edit3 className="w-4 h-4" /> Edit
                      </Button>
                      {topCat.status === "archived" ? (
                        <Button size="small" variant="transparent" onClick={() => handleRestore(topCat.id)} className="text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950">
                          <RotateCcw className="w-4 h-4" /> Restore
                        </Button>
                      ) : (
                        <Button size="small" variant="transparent" onClick={() => handleDeleteAttempt(topCat)} className="text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950">
                          <Trash2 className="w-4 h-4" /> Archive
                        </Button>
                      )}
                    </div>
                  </div>

                  {/* Sub-Category Children Tree */}
                  {isExpanded && children.length > 0 && (
                    <div className="bg-ui-bg-base border-t border-ui-border-base divide-y divide-ui-border-base pl-8">
                      {children.map((child) => {
                        const childProdCount = getProductCountForCategory(child);
                        return (
                          <div key={child.id} className="p-3 flex items-center justify-between">
                            <div className="flex items-center gap-2.5">
                              {child.image_url && (
                                <img
                                  src={child.image_url}
                                  alt={child.name}
                                  className="w-7 h-7 rounded object-cover border border-ui-border-base shrink-0 bg-ui-bg-field"
                                />
                              )}
                              <div>
                                <div className="flex items-center gap-2">
                                  <Text className="font-semibold text-sm text-ui-fg-base">↳ {child.name}</Text>
                                  <Badge color="grey" className="text-[10px]">{childProdCount} Products</Badge>
                                </div>
                                <Text className="text-[11px] text-ui-fg-subtle">/{child.slug}</Text>
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              <Button size="small" variant="transparent" onClick={() => handleOpenEditModal(child)} className="text-blue-600">
                                Edit
                              </Button>
                              <Button size="small" variant="transparent" onClick={() => handleDeleteAttempt(child)} className="text-rose-600">
                                Archive
                              </Button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </Container>
    </div>
  );
}
