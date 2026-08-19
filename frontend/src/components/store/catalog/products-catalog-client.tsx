"use client";

import { useState, useEffect, useCallback, useTransition } from "react";
import { useSearchParams, useRouter, usePathname } from "next/navigation";
import { Heading, Text, Input, Button, Badge } from "@medusajs/ui";
import { searchProductsAction, getCatalogFilterOptionsAction } from "@frontend/lib/actions/catalog";
import type { SearchFilters, SearchResult, CatalogFilterOptions } from "@frontend/lib/data/catalog";
import { ProductFilters, ActiveFilterChips, MobileFilterDrawer } from "@frontend/components/store/catalog/product-filters";
import { ProductCard } from "@frontend/components/store/catalog/product-card";
import { ErrorComponent } from "@frontend/components/common/error-component";
import { SlidersHorizontal, Search, Cake, MapPin, RefreshCw, X } from "lucide-react";

export function ProductsCatalogClient() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  // Parse filters from URL
  const [filters, setFilters] = useState<SearchFilters>(() => {
    const params: SearchFilters = {};
    const cat = searchParams.get("category");
    if (cat) params.category = cat;

    const flav = searchParams.get("flavour");
    if (flav) params.flavour = flav;

    const w = searchParams.get("weight");
    if (w) params.weight = w;

    const minP = searchParams.get("min_price");
    if (minP) params.min_price = Number(minP);

    const maxP = searchParams.get("max_price");
    if (maxP) params.max_price = Number(maxP);

    if (searchParams.get("sugar_free") === "true") params.sugar_free = true;
    if (searchParams.get("gluten_free") === "true") params.gluten_free = true;
    if (searchParams.get("vegan") === "true") params.vegan = true;

    const sort = searchParams.get("sort");
    if (sort) params.sort = sort as SearchFilters["sort"];

    const q = searchParams.get("q");
    if (q) params.q = q;

    return params;
  });

  const [qInput, setQInput] = useState(searchParams.get("q") || "");
  const [filterOptions, setFilterOptions] = useState<CatalogFilterOptions | undefined>(undefined);
  const [results, setResults] = useState<SearchResult[]>([]);
  const [count, setCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false);
  const [, startTransition] = useTransition();

  // Sync state to URL
  const updateUrl = useCallback(
    (newFilters: SearchFilters) => {
      const p = new URLSearchParams();
      if (newFilters.q) p.set("q", newFilters.q);
      if (newFilters.category) p.set("category", newFilters.category);
      if (newFilters.flavour) p.set("flavour", newFilters.flavour);
      if (newFilters.weight) p.set("weight", newFilters.weight);
      if (newFilters.min_price !== undefined) p.set("min_price", String(newFilters.min_price));
      if (newFilters.max_price !== undefined) p.set("max_price", String(newFilters.max_price));
      if (newFilters.sugar_free) p.set("sugar_free", "true");
      if (newFilters.gluten_free) p.set("gluten_free", "true");
      if (newFilters.vegan) p.set("vegan", "true");
      if (newFilters.sort) p.set("sort", newFilters.sort);

      const queryString = p.toString();
      const targetUrl = queryString ? `${pathname}?${queryString}` : pathname;
      startTransition(() => {
        router.replace(targetUrl, { scroll: false });
      });
    },
    [pathname, router]
  );

  // Fetch filter options on mount
  useEffect(() => {
    getCatalogFilterOptionsAction()
      .then((opts) => setFilterOptions(opts))
      .catch(() => null);
  }, []);

  // Execute catalog search
  const executeSearch = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await searchProductsAction({ ...filters, limit: 48 });
      setResults(res?.results || []);
      setCount(res?.count || 0);
    } catch (err: any) {
      console.error("[Catalog Search Error]:", err);
      setError("Failed to load catalog products.");
      setResults([]);
      setCount(0);
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    executeSearch();
  }, [executeSearch]);

  const handleFilterChange = (nextFilters: SearchFilters) => {
    setFilters(nextFilters);
    updateUrl(nextFilters);
  };

  // Debounced search input
  useEffect(() => {
    const timer = setTimeout(() => {
      if (qInput !== (filters.q || "")) {
        const next = { ...filters, q: qInput.trim() || undefined };
        setFilters(next);
        updateUrl(next);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [qInput, filters, updateUrl]);

  // Compute active filter count
  const activeCount = [
    filters.category,
    filters.flavour,
    filters.weight,
    filters.min_price !== undefined || filters.max_price !== undefined ? "price" : undefined,
    filters.sugar_free,
    filters.gluten_free,
    filters.vegan,
  ].filter(Boolean).length;

  return (
    <div className="flex flex-col gap-6 max-w-7xl mx-auto w-full px-4 md:px-8 py-8 font-sans">
      {/* Top Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-slate-200 dark:border-slate-800 pb-6">
        <div>
          <Heading level="h1" className="text-2xl md:text-3xl font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
            <Cake className="w-7 h-7 text-rose-600" /> Handcrafted Gourmet Cakes
          </Heading>
          <Text className="text-slate-500 text-sm mt-1">
            Freshly baked in Bangalore with 100% real ingredients • Express & Midnight Delivery Available
          </Text>
        </div>

        {/* Search Input & Mobile Filter Toggle */}
        <div className="flex items-center gap-3 w-full md:w-auto">
          <div className="relative flex-1 md:w-80">
            <Search className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
            <Input
              type="search"
              placeholder="Search cakes by name, flavour..."
              value={qInput}
              onChange={(e) => setQInput(e.target.value)}
              className="pl-9 h-10 text-xs rounded-xl"
            />
            {qInput && (
              <button
                onClick={() => setQInput("")}
                className="absolute right-3 top-3 text-slate-400 hover:text-slate-600"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          <Button
            variant="secondary"
            onClick={() => setMobileDrawerOpen(true)}
            className="md:hidden flex items-center gap-1.5 h-10 px-4 rounded-xl text-xs font-bold shrink-0 border-slate-200 dark:border-slate-800"
          >
            <SlidersHorizontal className="w-4 h-4 text-rose-600" />
            <span>Filters</span>
            {activeCount > 0 && (
              <Badge color="red" className="text-[10px] px-1.5 py-0.5 rounded-full ml-0.5">
                {activeCount}
              </Badge>
            )}
          </Button>
        </div>
      </div>

      {/* Main Catalog Body */}
      <div className="flex flex-col md:flex-row gap-8">
        {/* Desktop Sidebar Filters */}
        <aside className="hidden md:flex w-64 shrink-0 flex-col gap-4 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm h-fit sticky top-24">
          <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
            <span className="font-bold text-sm text-slate-900 dark:text-white flex items-center gap-2">
              <SlidersHorizontal className="w-4 h-4 text-rose-600" /> Filters
            </span>
            {activeCount > 0 && (
              <Badge color="purple" className="text-[10px] px-2 py-0.5 rounded-full font-bold">
                {activeCount} Active
              </Badge>
            )}
          </div>
          <ProductFilters filters={filters} onChange={handleFilterChange} options={filterOptions} />
        </aside>

        {/* Product Grid Area */}
        <main className="flex-1 flex flex-col gap-4">
          {/* Active Filter Chips & Counter Header */}
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between text-xs text-slate-500 font-medium">
              <span>
                Showing <strong className="text-slate-900 dark:text-white">{results.length}</strong> of{" "}
                <strong className="text-slate-900 dark:text-white">{count}</strong> cakes
              </span>
              <span className="hidden sm:inline-flex items-center gap-1 text-[11px]">
                <MapPin className="w-3.5 h-3.5 text-rose-500" /> Serviceable in Bangalore
              </span>
            </div>

            <ActiveFilterChips filters={filters} onChange={handleFilterChange} />
          </div>

          {/* Results State */}
          {error ? (
            <ErrorComponent title="Failed to load catalog" message={error} onRetry={executeSearch} />
          ) : loading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 py-8">
              {[1, 2, 3, 4, 5, 6].map((i) => (
                <div key={i} className="h-72 rounded-2xl bg-slate-100 dark:bg-slate-800 animate-pulse" />
              ))}
            </div>
          ) : results.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 px-4 border border-dashed border-slate-200 dark:border-slate-800 rounded-3xl bg-slate-50/50 dark:bg-slate-900/50 text-center">
              <div className="w-16 h-16 rounded-full bg-rose-50 dark:bg-rose-950/40 flex items-center justify-center text-3xl mb-4">
                🎂
              </div>
              <Heading level="h3" className="text-lg font-bold text-slate-900 dark:text-white mb-1">
                No cakes match your criteria
              </Heading>
              <Text className="text-xs text-slate-500 max-w-sm mb-6">
                Try clearing some filters or searching for different cake flavours like Chocolate, Red Velvet, or Mango.
              </Text>
              <Button
                variant="secondary"
                onClick={() => handleFilterChange({})}
                className="text-xs font-bold px-6 py-2 rounded-xl bg-rose-600 text-white hover:bg-rose-700"
              >
                Clear All Filters
              </Button>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {results.map((product) => (
                <ProductCard key={product.product_id} product={product} />
              ))}
            </div>
          )}
        </main>
      </div>

      {/* Mobile Drawer */}
      <MobileFilterDrawer
        isOpen={mobileDrawerOpen}
        onClose={() => setMobileDrawerOpen(false)}
        filters={filters}
        onChange={handleFilterChange}
        options={filterOptions}
        activeCount={activeCount}
      />
    </div>
  );
}
