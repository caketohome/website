"use client";

import { useState, useEffect, useCallback, useTransition, useRef } from "react";
import { useSearchParams, useRouter, usePathname } from "next/navigation";
import { Heading, Text, Input, Button, Badge } from "@medusajs/ui";
import { searchProductsAction, getCatalogFilterOptionsAction } from "@frontend/lib/actions/catalog";
import type { SearchFilters, SearchResult, CatalogFilterOptions } from "@frontend/lib/data/catalog";
import { ProductFilters, ActiveFilterChips, MobileFilterDrawer } from "@frontend/components/store/catalog/product-filters";
import { ProductCard } from "@frontend/components/store/catalog/product-card";
import { ErrorComponent } from "@frontend/components/common/error-component";
import { SlidersHorizontal, Search, Cake, MapPin, X } from "lucide-react";

interface ProductsCatalogClientProps {
  initialProducts?: SearchResult[];
  initialCount?: number;
  initialFilters?: SearchFilters;
  initialFilterOptions?: CatalogFilterOptions;
}

export function ProductsCatalogClient({
  initialProducts = [],
  initialCount = 0,
  initialFilters = {},
  initialFilterOptions,
}: ProductsCatalogClientProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  // Parse filters from URL, falling back to initialFilters
  const [filters, setFilters] = useState<SearchFilters>(() => {
    const params: SearchFilters = { ...initialFilters };
    const cat = searchParams.get("category");
    if (cat) params.category = cat;

    const occ = searchParams.get("occasion") || searchParams.get("occasion_id");
    if (occ) params.occasion = occ;

    const flav = searchParams.get("flavour");
    if (flav) params.flavour = flav;

    const w = searchParams.get("weight");
    if (w) params.weight = w;

    const minP = searchParams.get("min_price");
    if (minP) params.min_price = Number(minP);

    const maxP = searchParams.get("max_price");
    if (maxP) params.max_price = Number(maxP);

    const sort = searchParams.get("sort");
    if (sort) params.sort = sort as SearchFilters["sort"];

    const q = searchParams.get("search") || searchParams.get("q");
    if (q) params.q = q;

    return params;
  });

  const [qInput, setQInput] = useState(searchParams.get("search") || searchParams.get("q") || initialFilters.q || "");
  const [filterOptions, setFilterOptions] = useState<CatalogFilterOptions | undefined>(initialFilterOptions);
  const [results, setResults] = useState<SearchResult[]>(initialProducts);
  const [count, setCount] = useState<number>(initialCount || initialProducts.length);
  const [loading, setLoading] = useState<boolean>(initialProducts.length === 0);
  const [error, setError] = useState<string | null>(null);
  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false);
  const [, startTransition] = useTransition();

  const isFirstMount = useRef(true);
  const latestSearchId = useRef(0);
  const lastUrlString = useRef<string>(searchParams.toString());

  // Sync state to URL
  const updateUrl = useCallback(
    (newFilters: SearchFilters) => {
      const p = new URLSearchParams();
      if (newFilters.q) p.set("q", newFilters.q);
      if (newFilters.category && newFilters.category !== "all") p.set("category", newFilters.category);
      if (newFilters.occasion && newFilters.occasion !== "all") p.set("occasion", newFilters.occasion);
      if (newFilters.flavour && newFilters.flavour !== "all") p.set("flavour", newFilters.flavour);
      if (newFilters.weight && newFilters.weight !== "all") p.set("weight", newFilters.weight);
      if (newFilters.min_price !== undefined) p.set("min_price", String(newFilters.min_price));
      if (newFilters.max_price !== undefined) p.set("max_price", String(newFilters.max_price));
      if (newFilters.sort) p.set("sort", newFilters.sort);

      const queryString = p.toString();
      lastUrlString.current = queryString;
      const targetUrl = queryString ? `${pathname}?${queryString}` : pathname;
      if (typeof window !== "undefined") {
        window.history.replaceState(null, "", targetUrl);
      }
      startTransition(() => {
        router.replace(targetUrl, { scroll: false });
      });
    },
    [pathname, router]
  );

  // Fetch filter options if not provided via SSR
  useEffect(() => {
    if (!filterOptions || !filterOptions.categories || filterOptions.categories.length === 0) {
      getCatalogFilterOptionsAction()
        .then((opts) => {
          if (opts) setFilterOptions(opts);
        })
        .catch(() => null);
    }
  }, [filterOptions]);

  // Execute catalog search on filter change
  const executeSearch = useCallback(async (currentFilters: SearchFilters) => {
    const searchId = ++latestSearchId.current;
    console.log("[Catalog Client] executeSearch called with:", JSON.stringify(currentFilters));
    setLoading(true);
    setError(null);
    try {
      const res = await searchProductsAction({ ...currentFilters, limit: 48 });
      console.log("[Catalog Client] executeSearch got results:", res?.results?.length, "count:", res?.count);
      if (searchId === latestSearchId.current) {
        setResults(res?.results || []);
        setCount(res?.count || 0);
      }
    } catch (err: any) {
      console.error("[Catalog Search Error]:", err);
      if (searchId === latestSearchId.current) {
        setError("Failed to load catalog products. Please try again.");
        setResults([]);
        setCount(0);
      }
    } finally {
      if (searchId === latestSearchId.current) {
        setLoading(false);
      }
    }
  }, []);

  // Sync state when SSR props update
  useEffect(() => {
    if (isFirstMount.current) {
      isFirstMount.current = false;
      if (initialProducts && initialProducts.length > 0) {
        setResults(initialProducts);
        setCount(initialCount || initialProducts.length);
        setLoading(false);
      } else {
        executeSearch(filters);
      }
    }
  }, [initialProducts, initialCount]);

  // Sync state when URL searchParams update externally (e.g. browser back/forward or header search navigation)
  useEffect(() => {
    const currentParamsString = searchParams.toString();
    if (currentParamsString === lastUrlString.current) {
      return; // Skip sync if this update was triggered by our own updateUrl
    }
    lastUrlString.current = currentParamsString;

    const qParam = searchParams.get("search") || searchParams.get("q") || undefined;
    const catParam = searchParams.get("category") || undefined;
    const occParam = searchParams.get("occasion") || searchParams.get("occasion_id") || undefined;
    const flavParam = searchParams.get("flavour") || undefined;
    const weightParam = searchParams.get("weight") || undefined;
    const minPParam = searchParams.get("min_price") ? Number(searchParams.get("min_price")) : undefined;
    const maxPParam = searchParams.get("max_price") ? Number(searchParams.get("max_price")) : undefined;
    const sortParam = (searchParams.get("sort") as SearchFilters["sort"]) || undefined;

    const next = {
      q: qParam,
      category: catParam,
      occasion: occParam,
      flavour: flavParam,
      weight: weightParam,
      min_price: minPParam,
      max_price: maxPParam,
      sort: sortParam,
    };
    setFilters(next);
    setQInput(qParam || "");
    executeSearch(next);
  }, [searchParams, executeSearch]);

  const handleFilterChange = (nextFilters: SearchFilters) => {
    console.log("[Catalog Client] handleFilterChange called with:", JSON.stringify(nextFilters));
    setFilters(nextFilters);
    setQInput(nextFilters.q || "");
    updateUrl(nextFilters);
    executeSearch(nextFilters);
  };

  // Debounced search input
  useEffect(() => {
    const timer = setTimeout(() => {
      setFilters((prev) => {
        const trimmed = qInput.trim() || undefined;
        if (trimmed !== prev.q) {
          const next = { ...prev, q: trimmed };
          updateUrl(next);
          executeSearch(next);
          return next;
        }
        return prev;
      });
    }, 300);
    return () => clearTimeout(timer);
  }, [qInput, updateUrl, executeSearch]);

  // Compute active filter count (excluding default/empty values)
  const activeCount = [
    filters.category && filters.category !== "all" ? "category" : undefined,
    filters.occasion && filters.occasion !== "all" ? "occasion" : undefined,
    filters.flavour && filters.flavour !== "all" ? "flavour" : undefined,
    filters.weight && filters.weight !== "all" ? "weight" : undefined,
    filters.min_price !== undefined || filters.max_price !== undefined ? "price" : undefined,
    filters.q ? "q" : undefined,
  ].filter(Boolean).length;

  const [isHydrated, setIsHydrated] = useState(false);
  useEffect(() => {
    setIsHydrated(true);
  }, []);

  return (
    <div
      data-testid="products-catalog-root"
      data-hydrated={isHydrated ? "true" : "false"}
      className="flex flex-col gap-6 max-w-7xl mx-auto w-full px-4 md:px-8 py-8 font-sans"
    >
      {/* Top Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-slate-200 dark:border-slate-800 pb-6">
        <div>
          <h1 className="text-2xl md:text-3xl font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
            <Cake className="w-7 h-7 text-brand-navy dark:text-brand-gold" /> Handcrafted Gourmet Cakes
          </h1>
          <p className="text-slate-600 dark:text-slate-300 text-sm mt-1">
            Freshly baked in Kerala with 100% real ingredients • Express & Scheduled Delivery Available
          </p>
        </div>

        {/* Search Input & Mobile Filter Toggle */}
        <div className="flex items-center gap-3 w-full md:w-auto">
          <div className="relative flex-1 md:w-80">
            <Search className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
            <Input
              data-testid="catalog-search-input"
              type="search"
              placeholder="Search cakes by name, flavour..."
              value={qInput}
              onChange={(e) => setQInput(e.target.value)}
              suppressHydrationWarning
              className="pl-9 h-10 text-xs rounded-xl"
            />
            {qInput && (
              <button
                type="button"
                onClick={() => setQInput("")}
                className="absolute right-3 top-3 text-slate-400 hover:text-slate-600"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          <button
            type="button"
            data-testid="mobile-filter-button"
            onClick={() => setMobileDrawerOpen(true)}
            className="md:hidden flex items-center gap-1.5 h-10 px-4 rounded-xl text-xs font-bold shrink-0 border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 hover:bg-slate-50 transition shadow-sm"
          >
            <SlidersHorizontal className="w-4 h-4 text-brand-navy" />
            <span>Filters</span>
            {activeCount > 0 && (
              <span className="text-[10px] px-1.5 py-0.5 rounded-full ml-0.5 bg-brand-navy text-white font-bold">
                {activeCount}
              </span>
            )}
          </button>
        </div>
      </div>

      {/* Main Catalog Body */}
      <div className="flex flex-col md:flex-row gap-8">
        {/* Desktop Sidebar Filters */}
        <aside className="hidden md:flex w-64 shrink-0 flex-col gap-4 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm h-fit sticky top-24">
          <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
            <span className="font-bold text-sm text-slate-900 dark:text-white flex items-center gap-2">
              <SlidersHorizontal className="w-4 h-4 text-brand-navy" /> Filters
            </span>
            {activeCount > 0 && (
              <Badge color="grey" className="text-[10px] px-2 py-0.5 rounded-full font-bold">
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
            <div className="flex items-center justify-between text-xs text-slate-600 dark:text-slate-300 font-medium">
              <span>
                Showing <strong className="text-slate-900 dark:text-brand-gold font-bold">{results.length}</strong> of{" "}
                <strong className="text-slate-900 dark:text-brand-gold font-bold">{count || results.length}</strong> artisan cakes & treats
              </span>
              <span className="hidden sm:inline-flex items-center gap-1 text-[11px] text-slate-600 dark:text-slate-300">
                <MapPin className="w-3.5 h-3.5 text-brand-gold" /> Serviceable in Kerala
              </span>
            </div>

            <ActiveFilterChips filters={filters} onChange={handleFilterChange} />
          </div>

          {/* Results State */}
          {error ? (
            <ErrorComponent title="Failed to load catalog" message={error} onRetry={() => executeSearch(filters)} />
          ) : loading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 py-4">
              {[1, 2, 3, 4, 5, 6].map((i) => (
                <div key={i} className="h-72 rounded-2xl bg-slate-100 dark:bg-slate-800 animate-pulse" />
              ))}
            </div>
          ) : results.length === 0 ? (
            <div data-testid="catalog-empty-state" className="flex flex-col items-center justify-center py-20 px-4 border border-dashed border-slate-200 dark:border-slate-800 rounded-3xl bg-slate-50/50 dark:bg-slate-900/50 text-center">
              <div className="w-16 h-16 rounded-full bg-brand-gold-soft dark:bg-brand-deep/40 flex items-center justify-center text-3xl mb-4">
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
                className="text-xs font-bold px-6 py-2 rounded-xl bg-brand-navy text-white hover:bg-brand-deep"
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
