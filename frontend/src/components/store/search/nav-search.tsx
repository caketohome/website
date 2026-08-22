"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import { Search, X, Loader2, ArrowRight, Sparkles, Cake } from "lucide-react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { searchProductsAction } from "@frontend/lib/actions/catalog";
import type { SearchResult } from "@frontend/lib/data/catalog-client";

const POPULAR_SEARCH_SUGGESTIONS = [
  "Chocolate Truffle",
  "Red Velvet",
  "Mango Mousse",
  "Black Forest",
  "Butterscotch",
  "Cheesecake",
];

export function NavSearch() {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [selectedIndex, setSelectedIndex] = useState<number>(-1);

  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const modalRef = useRef<HTMLDivElement>(null);
  const requestIdRef = useRef<number>(0);

  // Open modal handler
  const handleOpen = useCallback(() => {
    setIsOpen(true);
    setSelectedIndex(-1);
    // Focus input after state update
    setTimeout(() => {
      inputRef.current?.focus();
    }, 50);
  }, []);

  // Close modal handler
  const handleClose = useCallback(() => {
    setIsOpen(false);
    setQuery("");
    setResults([]);
    setHasSearched(false);
    setErrorMessage(null);
    setSelectedIndex(-1);
  }, []);

  // Global shortcut (Ctrl+K or Cmd+K) to open search, and Escape to close
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        if (isOpen) {
          handleClose();
        } else {
          handleOpen();
        }
      } else if (e.key === "Escape" && isOpen) {
        e.preventDefault();
        handleClose();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, handleOpen, handleClose]);

  // Click outside to close
  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (e: MouseEvent) => {
      if (modalRef.current && !modalRef.current.contains(e.target as Node)) {
        handleClose();
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isOpen, handleClose]);

  // Debounced API Search
  useEffect(() => {
    const trimmed = query.trim();

    if (trimmed.length < 2) {
      setResults([]);
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

  // Navigate to full search page
  const handleFullSearchSubmit = (searchQuery?: string) => {
    const targetQ = (searchQuery ?? query).trim();
    if (!targetQ) return;
    handleClose();
    router.push(`/search?q=${encodeURIComponent(targetQ)}`);
  };

  // Keyboard navigation within results
  const handleInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      if (selectedIndex >= 0 && selectedIndex < results.length) {
        const selected = results[selectedIndex];
        handleClose();
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
    }
  };

  return (
    <>
      {/* ── Header Trigger Button (Desktop & Mobile) ── */}
      <button
        type="button"
        onClick={handleOpen}
        aria-label="Search products"
        title="Search cakes (Ctrl+K)"
        className="flex items-center gap-1.5 sm:gap-2 px-2 sm:px-3 py-1.5 rounded-full text-white/80 hover:text-white bg-white/5 hover:bg-white/10 border border-white/10 hover:border-rose-500/40 transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-rose-500/50 shrink-0"
      >
        <Search className="w-4 h-4 sm:w-4 sm:h-4 text-rose-400 shrink-0" />
        <span className="hidden md:inline text-xs font-medium text-white/70">
          Search cakes...
        </span>
        <kbd className="hidden lg:inline-flex items-center px-1.5 py-0.5 text-[10px] font-semibold text-white/50 bg-white/10 rounded border border-white/10 ml-1">
          ⌘K
        </kbd>
      </button>

      {/* ── Search Modal & Overlay ── */}
      {isOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Product Search Modal"
          className="fixed inset-0 z-[100] flex items-start justify-center pt-16 sm:pt-24 px-3 sm:px-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-150"
        >
          <div
            ref={modalRef}
            className="w-full max-w-2xl bg-[#18181b] border border-white/15 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[80vh] text-white animate-in zoom-in-95 duration-150"
          >
            {/* Input Header */}
            <div className="flex items-center px-4 py-3.5 border-b border-white/10 bg-[#1f1f23] gap-3">
              <Search className="w-5 h-5 text-rose-400 shrink-0" />
              <input
                ref={inputRef}
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={handleInputKeyDown}
                placeholder="Search cakes, flavours, categories (e.g. Belgian Chocolate)..."
                aria-label="Search products"
                autoComplete="off"
                className="w-full bg-transparent text-sm sm:text-base text-white placeholder:text-white/40 focus:outline-none"
              />
              {isLoading && (
                <Loader2 className="w-4 h-4 text-rose-400 animate-spin shrink-0" />
              )}
              {query && !isLoading && (
                <button
                  type="button"
                  onClick={() => {
                    setQuery("");
                    inputRef.current?.focus();
                  }}
                  className="text-white/40 hover:text-white transition-colors p-1"
                  aria-label="Clear search input"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
              <button
                type="button"
                onClick={handleClose}
                aria-label="Close search"
                className="text-xs px-2 py-1 rounded bg-white/10 hover:bg-white/20 text-white/70 hover:text-white transition-colors shrink-0"
              >
                ESC
              </button>
            </div>

            {/* Content Area (Scrollable) */}
            <div className="flex-1 overflow-y-auto p-4 divide-y divide-white/5 max-h-[60vh]">
              {/* 1. Initial State: Quick Suggestions */}
              {!query.trim() && (
                <div className="space-y-4 py-2">
                  <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-rose-400">
                    <Sparkles className="w-3.5 h-3.5" />
                    Popular Searches
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {POPULAR_SEARCH_SUGGESTIONS.map((suggestion) => (
                      <button
                        key={suggestion}
                        type="button"
                        onClick={() => {
                          setQuery(suggestion);
                        }}
                        className="text-xs px-3 py-1.5 rounded-full bg-white/5 hover:bg-rose-500/20 text-white/80 hover:text-rose-200 border border-white/10 hover:border-rose-500/40 transition-all text-left flex items-center gap-1.5"
                      >
                        <span>🎂</span>
                        <span>{suggestion}</span>
                      </button>
                    ))}
                  </div>

                  <div className="pt-4 border-t border-white/5">
                    <p className="text-xs text-white/50">
                      💡 Tip: Type cake names, flavours like &quot;Red Velvet&quot;, or categories like &quot;Cheesecakes&quot;.
                    </p>
                  </div>
                </div>
              )}

              {/* 2. Loading State */}
              {isLoading && query.trim().length >= 2 && results.length === 0 && (
                <div className="py-12 flex flex-col items-center justify-center text-center gap-3 text-white/60">
                  <Loader2 className="w-6 h-6 text-rose-500 animate-spin" />
                  <p className="text-sm">Searching our gourmet ovens for &ldquo;{query}&rdquo;...</p>
                </div>
              )}

              {/* 3. Error State */}
              {errorMessage && (
                <div className="py-8 text-center text-rose-400 text-sm">
                  <p>{errorMessage}</p>
                </div>
              )}

              {/* 4. No Results State */}
              {!isLoading && hasSearched && results.length === 0 && !errorMessage && query.trim().length >= 2 && (
                <div className="py-8 text-center flex flex-col items-center justify-center gap-3">
                  <div className="w-12 h-12 rounded-full bg-rose-500/10 flex items-center justify-center text-rose-400">
                    <Cake className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-white">
                      No cakes found for &ldquo;{query}&rdquo;
                    </h3>
                    <p className="text-xs text-white/50 mt-1">
                      Try searching for a flavour like Chocolate, Mango, or Red Velvet.
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2 justify-center mt-2">
                    {POPULAR_SEARCH_SUGGESTIONS.slice(0, 4).map((s) => (
                      <button
                        key={s}
                        type="button"
                        onClick={() => setQuery(s)}
                        className="text-xs px-2.5 py-1 rounded-full bg-white/5 hover:bg-rose-500/20 text-white/70 border border-white/10"
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* 5. Live Search Results List */}
              {results.length > 0 && (
                <div className="space-y-1 py-1">
                  <div className="flex justify-between items-center px-2 py-1.5 text-xs text-white/40 font-medium">
                    <span>MATCHING CAKES ({totalCount})</span>
                    <span>Use ↑↓ to navigate, Enter to select</span>
                  </div>

                  {results.map((product, idx) => {
                    const isSelected = selectedIndex === idx;
                    const prodUrl = `/products/${product.product_id || product.handle}`;

                    return (
                      <Link
                        key={product.product_id || product.handle || idx}
                        href={prodUrl}
                        onClick={handleClose}
                        onMouseEnter={() => setSelectedIndex(idx)}
                        className={`flex items-center gap-3.5 p-2.5 rounded-xl transition-all ${
                          isSelected
                            ? "bg-rose-500/20 border border-rose-500/40"
                            : "hover:bg-white/5 border border-transparent"
                        }`}
                      >
                        {/* Thumbnail */}
                        <div className="w-14 h-14 rounded-lg bg-black/40 border border-white/10 overflow-hidden relative shrink-0">
                          {product.thumbnail ? (
                            <Image
                              src={product.thumbnail}
                              alt={product.title}
                              fill
                              sizes="56px"
                              className="object-cover"
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-xl">
                              🎂
                            </div>
                          )}
                        </div>

                        {/* Info */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <h4 className="text-sm font-semibold text-white truncate">
                              {product.title}
                            </h4>
                            {product.category && (
                              <span className="text-[10px] px-2 py-0.5 rounded-full bg-white/10 text-white/80 font-medium shrink-0">
                                {product.category}
                              </span>
                            )}
                          </div>

                          <div className="flex items-center gap-3 mt-1 text-xs text-white/60">
                            {product.flavour && (
                              <span>Flavour: <span className="text-white/80 font-medium">{product.flavour}</span></span>
                            )}
                            {product.weight && (
                              <span>• {product.weight}</span>
                            )}
                            {product.rating > 0 && (
                              <span className="text-amber-400 font-semibold flex items-center gap-0.5">
                                ★ {product.rating.toFixed(1)}
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Price & Action */}
                        <div className="text-right shrink-0">
                          <div className="text-sm font-bold text-rose-400">
                            ₹{product.price}
                          </div>
                          <div className="text-[10px] text-white/40">Starting at</div>
                        </div>
                      </Link>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Footer / View All Results */}
            {query.trim().length >= 2 && results.length > 0 && (
              <div className="p-3 border-t border-white/10 bg-[#1f1f23] flex items-center justify-between">
                <span className="text-xs text-white/50">
                  Showing top {results.length} of {totalCount} matching items
                </span>
                <button
                  type="button"
                  onClick={() => handleFullSearchSubmit()}
                  className="flex items-center gap-1.5 text-xs font-semibold text-rose-400 hover:text-rose-300 transition-colors px-3 py-1.5 rounded-lg hover:bg-rose-500/10"
                >
                  <span>View all results for &ldquo;{query}&rdquo;</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
