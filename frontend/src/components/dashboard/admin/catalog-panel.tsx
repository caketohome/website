"use client";

import { useEffect, useState, memo, useCallback } from "react";
import { Container, Heading, Text, Badge, Input, Button } from "@medusajs/ui";
import dynamic from "next/dynamic";
import { apiClient } from "@frontend/lib/api-client";
import { Search, Plus, Cake, Trash2, Edit3, FolderTree, RefreshCw } from "lucide-react";
const PimEditorModal = dynamic(() => import("./pim-editor-modal").then((mod) => mod.PimEditorModal), { ssr: false });
import { CategoriesPanel } from "./categories-panel";
import { OccasionsPanel } from "./occasions-panel";
import { AccessoriesManagementPanel } from "./accessories-management-panel";
import { CrossSellRulesPanel } from "./cross-sell-rules-panel";
import { VariantsManagementPanel } from "./variants-management-panel";

import { GridSkeleton } from "./admin-skeletons";
import { WidgetErrorBoundary } from "./error-boundary";

export const CatalogPanel = memo(function CatalogPanel() {
  const [products, setProducts] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<"products" | "categories" | "occasions" | "accessories" | "rules" | "variants">("products");
  
  // PIM Modal State
  const [showPimModal, setShowPimModal] = useState(false);
  const [editingProduct, setEditingProduct] = useState<any | null>(null);

  const fetchCatalog = useCallback(() => {
    setLoading(true);
    setError(null);
    Promise.all([
      apiClient.getAdminProducts().then((r: any) => setProducts(r?.products || r?.data || [])).catch((err) => {
        console.error("[Catalog Panel Error] Failed to fetch products:", err);
        return [];
      }),
      apiClient.getAdminCategories().then((r: any) => setCategories(r?.categories || r?.data || [])).catch((err) => {
        console.error("[Catalog Panel Error] Failed to fetch categories:", err);
        return [];
      }),
    ])
      .catch((err) => {
        console.error("[Catalog Panel Error] Failed to fetch catalog data:", err);
        setError(err.message || "Failed to load catalog");
      })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    fetchCatalog();
  }, [fetchCatalog]);

  const handleOpenCreateModal = () => {
    setEditingProduct(null);
    setShowPimModal(true);
  };

  const handleOpenEditModal = (prod: any) => {
    setEditingProduct(prod);
    setShowPimModal(true);
  };

  const handleDeleteProduct = async (id: string, prodTitle: string) => {
    if (!confirm(`Are you sure you want to delete product "${prodTitle}"?`)) return;
    try {
      await apiClient.deleteAdminProduct(id);
      fetchCatalog();
    } catch (err: any) {
      alert(err.message || "Failed to delete product.");
    }
  };

  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState("all");

  const resolveCategoryName = (item: any) => {
    if (!item) return "Artisanal Cakes";
    if (item.category) return item.category;
    if (item.primary_category_id) {
      const match = categories.find((c) => c && (c.id === item.primary_category_id || c.name === item.primary_category_id));
      if (match) return match.name;
    }
    return "Artisanal Cakes";
  };

  const filtered = products.filter((p: any) => {
    if (!p) return false;
    const q = search.toLowerCase().trim();
    const matchesSearch = !q || (p.title || p.name || "").toLowerCase().includes(q);
    const matchesCategory =
      selectedCategoryFilter === "all" ||
      p.category === selectedCategoryFilter ||
      p.primary_category_id === selectedCategoryFilter;
    return matchesSearch && matchesCategory;
  });

  return (
    <div className="flex flex-col gap-6">
      {/* Header & Main Tabs */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <Heading level="h2" className="text-xl font-bold flex items-center gap-2">
            <Cake className="w-5 h-5 text-emerald-600" /> Enterprise Catalog & Accessory Management
          </Heading>
          <Text className="text-ui-fg-subtle text-sm">
            Manage Cake PIM, inventory-driven accessories, flowers, greeting cards, and cross-sell recommendation rules.
          </Text>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Badge
            color={tab === "products" ? "purple" : "grey"}
            className="cursor-pointer px-3.5 py-1.5 text-xs font-semibold"
            onClick={() => setTab("products")}
          >
            Products / Cakes ({products.length})
          </Badge>
          <Badge
            color={tab === "categories" ? "purple" : "grey"}
            className="cursor-pointer px-3.5 py-1.5 text-xs font-semibold flex items-center gap-1"
            onClick={() => setTab("categories")}
          >
            <FolderTree className="w-3.5 h-3.5" /> Categories ({categories.length})
          </Badge>
          <Badge
            color={tab === "occasions" ? "purple" : "grey"}
            className="cursor-pointer px-3.5 py-1.5 text-xs font-semibold"
            onClick={() => setTab("occasions")}
          >
            🎉 Occasions & Taxonomy
          </Badge>
          <Badge
            color={tab === "accessories" ? "purple" : "grey"}
            className="cursor-pointer px-3.5 py-1.5 text-xs font-semibold"
            onClick={() => setTab("accessories")}
          >
            🎁 Accessories & Gifts
          </Badge>
          <Badge
            color={tab === "rules" ? "purple" : "grey"}
            className="cursor-pointer px-3.5 py-1.5 text-xs font-semibold"
            onClick={() => setTab("rules")}
          >
            ⚡ Cross-Sell Rules
          </Badge>
          <Badge
            color={tab === "variants" ? "purple" : "grey"}
            className="cursor-pointer px-3.5 py-1.5 text-xs font-semibold"
            onClick={() => setTab("variants")}
          >
            🍫 Flavors &amp; Shapes
          </Badge>

          {tab === "products" && (
            <div className="flex items-center gap-2">
              <Button size="small" variant="secondary" onClick={fetchCatalog} className="flex items-center gap-1.5 text-xs">
                <RefreshCw className="w-3.5 h-3.5" /> Refresh
              </Button>
              <Button size="small" onClick={handleOpenCreateModal} className="flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white">
                <Plus className="w-4 h-4" /> Create Product
              </Button>
            </div>
          )}
        </div>
      </div>

      {error && (
        <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700 flex items-center justify-between">
          <span>⚠️ {error}</span>
          <Button size="small" variant="secondary" onClick={fetchCatalog}>Retry Fetch</Button>
        </div>
      )}

      {/* Render Sub Panels */}
      {tab === "categories" ? (
        <WidgetErrorBoundary moduleName="Categories Management Sub-Panel" compact>
          <CategoriesPanel />
        </WidgetErrorBoundary>
      ) : tab === "occasions" ? (
        <WidgetErrorBoundary moduleName="Occasion Taxonomy Sub-Panel" compact>
          <OccasionsPanel />
        </WidgetErrorBoundary>
      ) : tab === "accessories" ? (
        <WidgetErrorBoundary moduleName="Accessories & Gifts Sub-Panel" compact>
          <AccessoriesManagementPanel />
        </WidgetErrorBoundary>
      ) : tab === "rules" ? (
        <WidgetErrorBoundary moduleName="Cross-Sell Rules Sub-Panel" compact>
          <CrossSellRulesPanel />
        </WidgetErrorBoundary>
      ) : tab === "variants" ? (
        <WidgetErrorBoundary moduleName="Flavor & Shape Masters Sub-Panel" compact>
          <VariantsManagementPanel />
        </WidgetErrorBoundary>
      ) : (
        <>
          {/* Filter Bar */}
          <WidgetErrorBoundary moduleName="Catalog Filter Bar" compact>
            <Container className="p-4 flex flex-col md:flex-row items-center justify-between gap-4">
              <div className="relative w-full md:w-80">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-ui-fg-subtle" />
                <Input
                  placeholder={`Search ${tab}...`}
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-9"
                />
              </div>

              {tab === "products" && (
                <div className="flex items-center gap-2">
                  <Text className="text-xs text-ui-fg-subtle font-medium">Filter Category:</Text>
                  <select
                    value={selectedCategoryFilter}
                    onChange={(e) => setSelectedCategoryFilter(e.target.value)}
                    className="h-9 px-3 rounded-md border border-ui-border-base bg-ui-bg-field text-xs"
                  >
                    <option value="all">All Categories ({products.length})</option>
                    {categories.map((c) => (
                      <option key={c?.id || c?.name} value={c?.id || c?.name}>{c?.name}</option>
                    ))}
                  </select>
                </div>
              )}
            </Container>
          </WidgetErrorBoundary>

          {/* Product / Options Grid */}
          <WidgetErrorBoundary moduleName="Products Grid Widget" onRetry={fetchCatalog} compact>
            <Container className="p-6">
              <Text className="font-semibold text-base mb-4">
                Enterprise Cake Catalog ({filtered.length})
              </Text>

              {loading ? (
                <GridSkeleton count={6} />
              ) : filtered.length === 0 ? (
                <div className="text-center py-8 text-ui-fg-subtle flex flex-col items-center gap-2">
                  <Cake className="w-8 h-8 opacity-50" />
                  <Text>No items found matching search filter.</Text>
                  {products.length === 0 && (
                    <Button size="small" variant="secondary" onClick={fetchCatalog} className="mt-2 text-xs">
                      <RefreshCw className="w-3 h-3 mr-1" /> Retry Catalog
                    </Button>
                  )}
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {filtered.map((item: any) => {
                    if (!item) return null;
                    const title = item.title || item.name || "Untitled Item";
                    const priceVal = item.price || item.selling_price || item.amount || 0;
                    const catVal = resolveCategoryName(item);
                    const thumbnail = item.thumbnail || item.image_url || "https://images.unsplash.com/photo-1578985545062-69928b1d9587?auto=format&fit=crop&q=80&w=800";

                    return (
                      <WidgetErrorBoundary key={item.id} moduleName={`Product Card (${title})`} compact>
                        <div className="border border-ui-border-base rounded-xl p-4 bg-ui-bg-subtle/50 flex flex-col justify-between space-y-3 hover:shadow-md transition-shadow">
                          <div className="space-y-2">
                            <div className="aspect-video w-full rounded-lg overflow-hidden bg-ui-bg-field relative">
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img src={thumbnail} alt={title} loading="lazy" className="w-full h-full object-cover" />
                              <Badge color="purple" className="absolute top-2 left-2 text-[10px]">
                                {catVal}
                              </Badge>
                            </div>
                            <div>
                              <Text className="font-bold text-base line-clamp-1">{title}</Text>
                              <Text className="text-xs text-ui-fg-subtle line-clamp-2">
                                {item.description || "Handcrafted fresh gourmet cake."}
                              </Text>
                            </div>
                          </div>

                          <div className="pt-2 border-t border-ui-border-base flex items-center justify-between">
                            <div>
                              <Text className="text-[10px] text-ui-fg-subtle uppercase tracking-wider font-semibold">Starting Price</Text>
                              <Text className="font-bold text-emerald-600 text-lg">From ₹{priceVal}</Text>
                              {item.variants_json?.weights && Array.isArray(item.variants_json.weights) && (
                                <div className="flex flex-wrap gap-1 mt-1">
                                  {item.variants_json.weights.slice(0, 3).map((w: string) => (
                                    <Badge key={w} color="grey" className="text-[9px] px-1.5 py-0.5">{w}</Badge>
                                  ))}
                                </div>
                              )}
                            </div>
                            <div className="flex items-center gap-1">
                              <Button size="small" variant="transparent" onClick={() => handleOpenEditModal(item)} className="text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-950">
                                <Edit3 className="w-4 h-4 mr-1" /> Edit PIM
                              </Button>
                              <Button size="small" variant="transparent" onClick={() => handleDeleteProduct(item.id, title)} className="text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950">
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            </div>
                          </div>
                        </div>
                      </WidgetErrorBoundary>
                    );
                  })}
                </div>
              )}
            </Container>
          </WidgetErrorBoundary>
        </>
      )}

      {/* PIM Product Editor Modal */}
      {showPimModal && (
        <WidgetErrorBoundary moduleName="PIM Editor Modal" compact>
          <PimEditorModal
            product={editingProduct}
            categories={categories}
            onClose={() => setShowPimModal(false)}
            onSuccess={fetchCatalog}
          />
        </WidgetErrorBoundary>
      )}
    </div>
  );
});

