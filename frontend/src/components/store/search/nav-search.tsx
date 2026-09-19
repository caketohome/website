"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import { Search, X, Loader2, ArrowRight, Sparkles, Cake, Heart, Clock, History } from "lucide-react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { searchProductsAction } from "@frontend/lib/actions/catalog";
import type { SearchResult } from "@frontend/lib/data/catalog";
import { useFavorites } from "@/providers/favorites-provider";
import { useAuth } from "@/providers/auth-provider";

const POPULAR_SEARCH_SUGGESTIONS = [
  "Chocolate Truffle",
  "Red Velvet",
  "Black Forest",
  "Mango Mousse",
  "Butterscotch",
  "Cheesecake",
  "Fresh Fruit",
  "Rasmalai Cake",
];

export interface NavSearchProps {
  mode?: "embedded" | "trigger-only" | "auto";
  className?: string;
}

export function NavSearch({ mode = "auto", className = "" }: NavSearchProps = {}) {
  const [isOpen, setIsOpen] = useState(false);
  const [isMobileExpanded, setIsMobileExpanded] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [matchedCategories, setMatchedCategories] = useState<Array<{ id: string; name: string; slug: string; count?: number }>>([]);
  const [matchedFlavours, setMatchedFlavours] = useState<string[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [selectedIndex, setSelectedIndex] = useState<number>(-1);
  const [recentSearches, setRecentSearches] = useState<string[]>([]);

  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const mobileInputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const requestIdRef = useRef<number>(0);

  // Favorites hook for inline bookmarking
  const { isFavorited, toggleFavorite } = useFavorites();
  const { currentUser } = useAuth();

  // User-scoped recent searches key
  const customerKey = currentUser?.id || (currentUser as any)?.user_id || currentUser?.phone || "guest";
  const recentSearchesKey = `cth_recent_searches_${customerKey}`;

  // Load recent searches from localStorage
  useEffect(() => {
    try {
      const stored = localStorage.getItem(recentSearchesKey) || localStorage.getItem("cth_recent_searches");
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed)) {
          setRecentSearches(parsed.slice(0, 5));
        }
      }
    } catch {
      // Ignore localStorage errors
    }
  }, [recentSearchesKey]);

  const saveRecentSearch = useCallback((term: string) => {
    const clean = term.trim();
    if (!clean || clean.length < 2) return;
    try {
      setRecentSearches((prev) => {
        const updated = [clean, ...prev.filter((item) => item.toLowerCase() !== clean.toLowerCase())].slice(0, 5);
        localStorage.setItem(recentSearchesKey, JSON.stringify(updated));
        return updated;
      });
    } catch {
      // Ignore
    }
  }, [recentSearchesKey]);

  const clearRecentSearches = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    try {
      localStorage.removeItem(recentSearchesKey);
      setRecentSearches([]);
    } catch {}
  }, [recentSearchesKey]);

  // Global shortcut (Ctrl+K or Cmd+K) to focus search, and Escape to close
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        inputRef.current?.focus();
        setIsOpen(true);
      } else if (e.key === "Escape") {
        if (isOpen || isMobileExpanded) {
          e.preventDefault();
          setIsOpen(false);
          setIsMobileExpanded(false);
          inputRef.current?.blur();
          mobileInputRef.current?.blur();
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, isMobileExpanded]);

  // Click outside to close dropdown
  useEffect(() => {
    if (!isOpen && !isMobileExpanded) return;

    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
        setIsMobileExpanded(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isOpen, isMobileExpanded]);

  // Debounced API Search with Cancellation
  useEffect(() => {
    const trimmed = query.trim();

    if (trimmed.length < 2) {
      setResults([]);
      setMatchedCategories([]);
      setMatchedFlavours([]);
      setTotalCount(0);
      setIsLoading(false);
      setHasSearched(false);
      setErrorMessage(null);
      setSelectedIndex(-1);
      return;
    }

    setIsLoading(true);
    setErrorMessage(null);
    const currentRequestId = ++requestIdRef.current;

    const timer = setTimeout(async () => {
      try {
        const data = await searchProductsAction({
          q: trimmed,
          limit: 6,
        });

        // Ensure we only update if this is the most recent request
        if (currentRequestId === requestIdRef.current) {
          setResults(data.results || []);
          setMatchedCategories((data.categories as any) || []);
          setMatchedFlavours(data.flavours || []);
          setTotalCount(data.count || 0);
          setHasSearched(true);
          setIsLoading(false);
          setSelectedIndex(-1);
        }
      } catch (err) {
        if (currentRequestId === requestIdRef.current) {
          console.error("Live search error:", err);
          setErrorMessage("Unable to search cakes right now. Please try again.");
          setIsLoading(false);
          setHasSearched(true);
        }
      }
    }, 250); // 250ms debounce

    return () => clearTimeout(timer);
  }, [query]);

  // Navigate to full products search view
  const handleFullSearchSubmit = useCallback((searchQuery?: string) => {
    const targetQ = (searchQuery ?? query).trim();
    if (!targetQ) return;
    saveRecentSearch(targetQ);
    setIsOpen(false);
    setIsMobileExpanded(false);
    router.push(`/products?search=${encodeURIComponent(targetQ)}`);
  }, [query, router, saveRecentSearch]);

  // Keyboard navigation within results
  const handleInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      if (selectedIndex >= 0 && selectedIndex < results.length) {
        const selected = results[selectedIndex];
        saveRecentSearch(selected.title || query);
        setIsOpen(false);
        setIsMobileExpanded(false);
        router.push(`/products/${selected.product_id || selected.handle}`);
      } else {
        handleFullSearchSubmit();
      }
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIndex((prev) => (prev < results.length - 1 ? prev + 1 : prev));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIndex((prev) => (prev > 0 ? prev - 1 : -1));
    } else if (e.key === "Escape") {
      e.preventDefault();
      setIsOpen(false);
      setIsMobileExpanded(false);
      inputRef.current?.blur();
      mobileInputRef.current?.blur();
    }
  };

  const handleSelectSuggestion = (suggestion: string) => {
    setQuery(suggestion);
    saveRecentSearch(suggestion);
    inputRef.current?.focus();
    mobileInputRef.current?.focus();
  };

  const handleSelectCategory = (catSlug: string) => {
    setIsOpen(false);
    setIsMobileExpanded(false);
    router.push(`/products?category=${encodeURIComponent(catSlug)}`);
  };

  return (
    <div ref={containerRef} className={`relative flex items-center ${mode === "trigger-only" ? "w-auto" : "w-full"} ${className}`}>
      {/* ── DESKTOP SEARCH BAR (Embedded Header Input) ── */}
      {(mode === "embedded" || mode === "auto") && (
        <div className={`${mode === "auto" ? "hidden md:flex" : "flex"} items-center relative w-full transition-all`}>
          <div className="relative w-full flex items-center">
            {/* Search Icon on the LEFT */}
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-navy-accent/50 pointer-events-none transition-colors" />

            <input
              ref={inputRef}
              type="text"
              value={query}
              onFocus={() => setIsOpen(true)}
              onChange={(e) => {
                setQuery(e.target.value);
                if (!isOpen) setIsOpen(true);
              }}
              onKeyDown={handleInputKeyDown}
              placeholder="Search cakes, flavours, categories..."
              aria-label="Search products"
              autoComplete="off"
              suppressHydrationWarning
              className="w-full h-10 pl-10 pr-14 rounded-xl bg-navy-accent/5 hover:bg-navy-accent/10 focus:bg-white border border-navy-accent/15 focus:border-navy-glow text-sm text-navy-accent placeholder:text-navy-accent/50 focus:outline-none focus:ring-2 focus:ring-navy-glow/20 transition-all shadow-inner"
            />

            {/* Right Controls: Spinner / Clear button / Shortcut badge */}
            <div className="absolute right-2.5 top-1/2 -translate-y-1/2 flex items-center gap-1.5">
              {isLoading ? (
                <Loader2 className="w-4 h-4 text-[#D4AF37] animate-spin" />
              ) : query ? (
                <button
                  type="button"
                  onMouseDown={(e) => {
                    e.preventDefault();
                    setQuery("");
                    setResults([]);
                    setTotalCount(0);
                    inputRef.current?.focus();
                  }}
                  className="text-navy-accent/40 hover:text-navy-accent transition-colors p-1 rounded-full hover:bg-navy-accent/10"
                  aria-label="Clear search"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              ) : (
                <kbd className="hidden lg:inline-flex items-center px-1.5 py-0.5 text-[10px] font-medium text-navy-accent/50 bg-navy-accent/5 rounded border border-navy-accent/10 pointer-events-none">
                  ⌘K
                </kbd>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── MOBILE SEARCH TRIGGER BUTTON ── */}
      {(mode === "trigger-only" || mode === "auto") && (
        <div className={mode === "auto" ? "flex md:hidden w-full justify-end" : "flex items-center"}>
          <button
            type="button"
            onClick={() => {
              setIsMobileExpanded(true);
              setIsOpen(true);
              setTimeout(() => mobileInputRef.current?.focus(), 50);
            }}
            aria-label="Search cakes and bakery items"
            title="Search cakes"
            className="flex items-center justify-center min-w-[40px] min-h-[40px] sm:min-w-[44px] sm:min-h-[44px] p-2 rounded-xl text-navy-accent/80 hover:text-navy-accent hover:bg-navy-accent/5 transition-colors focus:outline-none focus:ring-2 focus:ring-navy-accent/20"
          >
            <Search className="w-5 h-5 text-navy-accent/80" />
          </button>
        </div>
      )}

      {/* ── MOBILE EXPANDED HEADER BAR OVERLAY ── */}
      {isMobileExpanded && (
        <>
          <div
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[90] md:hidden"
            onClick={() => {
              setIsMobileExpanded(false);
              setIsOpen(false);
            }}
          />
          <div className="fixed inset-x-0 top-0 h-16 bg-[#0D152B]/95 backdrop-blur-xl supports-[backdrop-filter]:bg-[#0D152B]/90 z-[110] flex items-center px-3 gap-2 border-b border-white/10 shadow-2xl animate-in fade-in-0 duration-150 md:hidden">
            <div className="relative flex-1 flex items-center">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#D4AF37] pointer-events-none" />
              <input
                ref={mobileInputRef}
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={handleInputKeyDown}
                placeholder="Search cakes, flavours..."
                aria-label="Search products mobile"
                autoComplete="off"
                suppressHydrationWarning
                className="w-full h-10 pl-10 pr-10 rounded-xl bg-[#142040]/70 border border-white/20 text-sm text-white placeholder:text-white/40 focus:outline-none focus:border-[#D4AF37]"
              />
              {query && (
                <button
                  type="button"
                  onMouseDown={(e) => {
                    e.preventDefault();
                    setQuery("");
                    mobileInputRef.current?.focus();
                  }}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-white/40 hover:text-white p-1"
                  aria-label="Clear mobile search"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
            <button
              type="button"
              onClick={() => {
                setIsMobileExpanded(false);
                setIsOpen(false);
              }}
              className="text-xs font-semibold text-white/70 hover:text-white px-2.5 py-1.5 rounded-lg hover:bg-white/10 shrink-0"
            >
              Cancel
            </button>
          </div>
        </>
      )}

      {/* ── EMBEDDED RELATIVE DROPDOWN ── */}
      {isOpen && (
        <div
          className={`
            ${isMobileExpanded ? "fixed inset-x-2.5 top-18 z-[100]" : "absolute left-0 right-0 top-full mt-2 w-full min-w-[340px] sm:min-w-[420px] max-w-[540px] z-50"}
            bg-[#0D152B]/95 border border-white/15 rounded-2xl shadow-[0_20px_50px_rgba(13,21,43,0.7)] overflow-hidden text-white animate-in fade-in-0 zoom-in-95 duration-150 backdrop-blur-xl supports-[backdrop-filter]:bg-[#0D152B]/85
          `}
          style={{ maxHeight: "calc(80vh - 70px)" }}
        >
          {/* Scrollable Result Stream */}
          <div className="overflow-y-auto max-h-[60vh] p-3 divide-y divide-white/10">
            {/* 1. INITIAL STATE: Recent & Popular Searches */}
            {!query.trim() && (
              <div className="space-y-4 py-1">
                {/* Recent Searches */}
                {recentSearches.length > 0 && (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-[11px] font-semibold uppercase tracking-wider text-white/50">
                      <div className="flex items-center gap-1.5">
                        <History className="w-3.5 h-3.5 text-[#D4AF37]" />
                        <span>Recent Searches</span>
                      </div>
                      <button
                        type="button"
                        onMouseDown={clearRecentSearches}
                        className="text-[10px] text-white/40 hover:text-[#D4AF37] transition-colors lowercase"
                      >
                        clear
                      </button>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {recentSearches.map((item) => (
                        <button
                          key={item}
                          type="button"
                          onMouseDown={(e) => {
                            e.preventDefault();
                            handleSelectSuggestion(item);
                          }}
                          className="text-xs px-3 py-1.5 rounded-full bg-white/5 hover:bg-white/10 text-white/80 hover:text-white border border-white/10 transition-all flex items-center gap-1.5 cursor-pointer"
                        >
                          <Clock className="w-3 h-3 text-white/40" />
                          <span>{item}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Popular Searches */}
                <div className="space-y-2">
                  <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-[#D4AF37]">
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>Popular Searches</span>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {POPULAR_SEARCH_SUGGESTIONS.map((suggestion) => (
                      <button
                        key={suggestion}
                        type="button"
                        onMouseDown={(e) => {
                          e.preventDefault();
                          handleSelectSuggestion(suggestion);
                        }}
                        className="text-xs px-3 py-1.5 rounded-full bg-white/5 hover:bg-[#D4AF37]/20 text-white/80 hover:text-[#D4AF37]/60 border border-white/10 hover:border-[#D4AF37]/40 transition-all flex items-center gap-1.5 cursor-pointer"
                      >
                        <span>🎂</span>
                        <span>{suggestion}</span>
                      </button>
                    ))}
                  </div>
                </div>

                <div className="pt-2 border-t border-white/5">
                  <p className="text-[11px] text-white/45">
                    💡 Tip: Search by name, flavour (e.g. &ldquo;Truffle&rdquo;), or category.
                  </p>
                </div>
              </div>
            )}

            {/* 2. LOADING SKELETON STATE */}
            {isLoading && query.trim().length >= 2 && results.length === 0 && (
              <div className="py-4 space-y-3">
                <div className="flex items-center gap-2 text-xs text-[#D4AF37] px-1 font-medium">
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Searching fresh bakery catalogue...</span>
                </div>
                {[1, 2, 3].map((n) => (
                  <div key={n} className="flex items-center gap-3 p-2 rounded-xl bg-white/[0.03] animate-pulse">
                    <div className="w-12 h-12 rounded-lg bg-white/10 shrink-0" />
                    <div className="flex-1 space-y-1.5">
                      <div className="h-3.5 bg-white/10 rounded w-3/4" />
                      <div className="h-2.5 bg-white/5 rounded w-1/2" />
                    </div>
                    <div className="w-12 h-4 bg-white/10 rounded shrink-0" />
                  </div>
                ))}
              </div>
            )}

            {/* 3. ERROR STATE */}
            {errorMessage && (
              <div className="py-4 text-center text-[#D4AF37] text-xs">
                <p>{errorMessage}</p>
              </div>
            )}

            {/* 4. NO RESULTS STATE */}
            {!isLoading && hasSearched && results.length === 0 && !errorMessage && query.trim().length >= 2 && (
              <div className="py-6 text-center flex flex-col items-center justify-center gap-2.5">
                <div className="w-10 h-10 rounded-full bg-[#D4AF37]/10 flex items-center justify-center text-[#D4AF37]">
                  <Cake className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-sm font-semibold text-white">
                    No cakes found for &ldquo;{query}&rdquo;
                  </h4>
                  <p className="text-xs text-white/50 mt-0.5">
                    Try searching for &ldquo;Chocolate&rdquo;, &ldquo;Velvet&rdquo;, or &ldquo;Cheesecake&rdquo;.
                  </p>
                </div>
                <div className="flex flex-wrap gap-1.5 justify-center mt-1">
                  {POPULAR_SEARCH_SUGGESTIONS.slice(0, 4).map((s) => (
                    <button
                      key={s}
                      type="button"
                      onMouseDown={(e) => {
                        e.preventDefault();
                        handleSelectSuggestion(s);
                      }}
                      className="text-xs px-2.5 py-1 rounded-full bg-white/5 hover:bg-[#D4AF37]/20 text-white/70 border border-white/10 cursor-pointer"
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* 5. MATCHING CATEGORIES & FLAVOURS CHIPS */}
            {results.length > 0 && (matchedCategories.length > 0 || matchedFlavours.length > 0) && (
              <div className="py-2 space-y-1.5">
                <div className="text-[10px] font-semibold uppercase tracking-wider text-white/40 px-1">
                  Matching Categories &amp; Flavours
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {matchedCategories.slice(0, 3).map((cat) => (
                    <button
                      key={cat.slug}
                      type="button"
                      onMouseDown={(e) => {
                        e.preventDefault();
                        handleSelectCategory(cat.slug);
                      }}
                      className="text-xs px-2.5 py-1 rounded-lg bg-[#D4AF37]/15 hover:bg-[#D4AF37]/25 text-[#D4AF37]/80 border border-[#D4AF37]/30 transition-colors flex items-center gap-1 cursor-pointer"
                    >
                      <span>📂</span>
                      <span>{cat.name}</span>
                    </button>
                  ))}
                  {matchedFlavours.slice(0, 3).map((flav) => (
                    <button
                      key={flav}
                      type="button"
                      onMouseDown={(e) => {
                        e.preventDefault();
                        handleSelectSuggestion(flav);
                      }}
                      className="text-xs px-2.5 py-1 rounded-lg bg-white/5 hover:bg-white/10 text-white/80 border border-white/10 transition-colors flex items-center gap-1 cursor-pointer"
                    >
                      <span>✨</span>
                      <span>{flav}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* 6. CANONICAL SEARCH RESULTS LIST */}
            {results.length > 0 && (
              <div className="space-y-1 py-1">
                <div className="flex justify-between items-center px-1 py-1 text-[11px] text-white/40 font-medium">
                  <span>PRODUCTS ({totalCount})</span>
                  <span className="hidden sm:inline">Use ↑↓ to navigate, Enter to open</span>
                </div>

                {results.map((product, idx) => {
                  const isSelected = selectedIndex === idx;
                  const prodUrl = `/products/${product.product_id || product.handle}`;
                  const isFav = isFavorited(product.product_id);

                  return (
                    <div
                      key={product.product_id || product.handle || idx}
                      onMouseEnter={() => setSelectedIndex(idx)}
                      className={`group relative flex items-center gap-3 p-2 rounded-xl transition-all ${
                        isSelected
                          ? "bg-[#D4AF37]/20 border border-[#D4AF37]/40"
                          : "hover:bg-white/5 border border-transparent"
                      }`}
                    >
                      {/* Product Link */}
                      <Link
                        href={prodUrl}
                        onMouseDown={(e) => {
                          // Allow natural navigation but save search
                          saveRecentSearch(product.title || query);
                          setIsOpen(false);
                          setIsMobileExpanded(false);
                        }}
                        className="flex items-center gap-3 flex-1 min-w-0"
                      >
                        {/* Thumbnail */}
                        <div className="w-12 h-12 sm:w-13 sm:h-13 rounded-lg bg-black/40 border border-white/10 overflow-hidden relative shrink-0">
                          {product.thumbnail ? (
                            <Image
                              src={product.thumbnail}
                              alt={product.title}
                              fill
                              sizes="52px"
                              className="object-cover group-hover:scale-105 transition-transform duration-200"
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-lg">
                              🎂
                            </div>
                          )}
                        </div>

                        {/* Product Info */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5">
                            <h4 className="text-xs sm:text-sm font-semibold text-white truncate">
                              {product.title}
                            </h4>
                            {product.category && (
                              <span className="hidden sm:inline-block text-[9px] px-1.5 py-0.5 rounded bg-white/10 text-white/70 font-medium shrink-0">
                                {product.category}
                              </span>
                            )}
                          </div>

                          <div className="flex items-center gap-2 mt-0.5 text-[11px] text-white/55">
                            {product.flavour && (
                              <span className="truncate">{product.flavour}</span>
                            )}
                            {product.rating > 0 && (
                              <span className="text-amber-400 font-semibold flex items-center gap-0.5 shrink-0">
                                ★ {product.rating.toFixed(1)}
                              </span>
                            )}
                            {product.review_count > 0 && (
                              <span className="text-white/40">({product.review_count})</span>
                            )}
                          </div>
                        </div>

                        {/* Price Display */}
                        <div className="text-right shrink-0 pr-1">
                          <div className="text-xs sm:text-sm font-bold text-[#D4AF37]">
                            ₹{product.price}
                          </div>
                          <div className="text-[9px] text-white/40">From</div>
                        </div>
                      </Link>

                      {/* Favorite Button */}
                      <button
                        type="button"
                        onMouseDown={async (e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          await toggleFavorite(product.product_id, { title: product.title, handle: product.handle || undefined });
                        }}
                        aria-label={isFav ? "Remove from wishlist" : "Add to wishlist"}
                        className={`p-1.5 rounded-full transition-all shrink-0 ${
                          isFav
                            ? "text-[#D4AF37] bg-[#D4AF37]/15 hover:bg-[#D4AF37]/25"
                            : "text-white/30 hover:text-white/80 hover:bg-white/10 opacity-0 group-hover:opacity-100 focus:opacity-100"
                        }`}
                      >
                        <Heart className={`w-3.5 h-3.5 ${isFav ? "fill-current" : ""}`} />
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* ── FOOTER: View All Results Link ── */}
          {query.trim().length >= 2 && results.length > 0 && (
            <div className="p-2.5 border-t border-white/10 bg-[#0D152B]/95 backdrop-blur-md flex items-center justify-between">
              <span className="text-[11px] text-white/45">
                Showing top {results.length} of {totalCount} results
              </span>
              <button
                type="button"
                onMouseDown={(e) => {
                  e.preventDefault();
                  handleFullSearchSubmit();
                }}
                className="flex items-center gap-1 text-xs font-semibold text-[#D4AF37] hover:text-[#D4AF37]/80 transition-colors px-2.5 py-1 rounded-lg hover:bg-[#D4AF37]/10 cursor-pointer"
              >
                <span>View all for &ldquo;{query}&rdquo;</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default NavSearch;
