"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { Heading, Text, Badge, Button, Input } from "@medusajs/ui";
import { Search, Heart, Sparkles, Clock, ShieldCheck, Tag, ArrowRight, Gift } from "lucide-react";
import { searchProductsAction } from "@frontend/lib/actions/catalog";
import { type SearchResult } from "@frontend/lib/data/catalog-client";
import { addToCart } from "@frontend/lib/actions/carts";
import { ErrorComponent } from "@frontend/components/common/error-component";
import { ProductCard } from "@frontend/components/store/catalog/product-card";
import dynamic from "next/dynamic";

const ScrollFrameHero = dynamic(
  () => import("@frontend/components/store/animation/scroll-frame-hero").then((mod) => mod.ScrollFrameHero),
  {
    ssr: false,
    loading: () => (
      <section className="relative w-full min-h-[500px] flex items-center justify-center overflow-hidden bg-[#07090E] text-white">
        <div className="absolute inset-0 bg-gradient-to-t from-[#07090E]/95 via-[#1D2F5D]/30 to-[#07090E]/80 pointer-events-none" />
        <div className="relative z-10 p-6 sm:p-12 max-w-3xl flex flex-col items-center text-center gap-4">
          <span className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-full font-sans text-[11px] font-semibold tracking-[0.2em] uppercase mb-1 shadow-xl bg-[#D4AF37]/15 text-[#D4AF37] border border-[#D4AF37]/35">
            <Sparkles className="w-3.5 h-3.5 text-[#D4AF37]" />
            100% Fresh & Artisanal • Express 2-Hour Delivery
          </span>
          <Heading level="h1" className="font-serif text-3xl sm:text-5xl md:text-6xl font-normal sm:font-semibold tracking-[-0.025em] leading-[1.1] text-[#FAF9F6] drop-shadow-2xl">
            Freshly Baked Happiness
          </Heading>
          <Text className="font-sans text-sm sm:text-base text-stone-200/90 max-w-xl font-normal leading-relaxed drop-shadow-sm">
            Explore gourmet cakes, handcrafted chocolates, fresh pastries, and savory treats. Delivered directly from our nearest kitchen for maximum freshness.
          </Text>
          <div className="flex items-center gap-3 pt-2">
            <Link
              href="/search"
              className="rounded-full px-8 py-3.5 font-sans font-medium text-xs sm:text-sm uppercase tracking-[0.15em] bg-[#D4AF37] hover:bg-[#c59e2b] text-[#07090E] shadow-[0_10px_30px_rgba(212,175,55,0.3)] transition-all flex items-center gap-1.5"
            >
              Explore Cakes <ArrowRight className="w-4 h-4 ml-1" />
            </Link>
          </div>
        </div>
      </section>
    ),
  }
);

import { useFavorites } from "@/providers/favorites-provider";

export interface StorefrontProductHomepageProps {
  initialProducts?: any[];
  initialCategories?: any[];
  initialOffers?: any[];
}

export function StorefrontProductHomepage({
  initialProducts,
  initialCategories,
  initialOffers,
}: StorefrontProductHomepageProps = {}) {
  const [products, setProducts] = useState<SearchResult[]>(initialProducts || []);
  const [categories, setCategories] = useState<any[]>(initialCategories || []);
  const [offers, setOffers] = useState<any[]>(initialOffers || []);
  const [loading, setLoading] = useState(!initialProducts || initialProducts.length === 0);
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    if (initialProducts && initialProducts.length > 0) {
      setProducts(initialProducts);
      setLoading(false);
      return;
    }
    async function loadCatalog() {
      try {
        setLoading(true);
        const res = await searchProductsAction({ limit: 48 });
        if (res?.results && Array.isArray(res.results)) {
          setProducts(res.results);
        }
      } catch (err) {
        console.error("Error loading products from database:", err);
      } finally {
        setLoading(false);
      }
    }
    loadCatalog();
  }, [initialProducts]);

  useEffect(() => {
    if (initialCategories) {
      setCategories(initialCategories);
    }
  }, [initialCategories]);

  useEffect(() => {
    if (initialOffers) {
      setOffers(initialOffers);
    }
  }, [initialOffers]);

  const featuredProducts = (products.filter((p) => p.is_featured).length > 0 ? products.filter((p) => p.is_featured) : products).slice(0, 4);
  const bestSellers = (products.filter((p) => p.is_bestseller).length > 0 ? products.filter((p) => p.is_bestseller) : products).slice(0, 4);
  const newArrivals = (products.filter((p) => p.is_new_arrival).length > 0 ? products.filter((p) => p.is_new_arrival) : products).slice(0, 4);

  return (
    <div className="flex flex-col gap-12 w-full max-w-7xl mx-auto px-1 sm:px-4 md:px-6 py-2 sm:py-4">
      {/* Real Scroll-Driven Frame Animation Hero */}
      <ScrollFrameHero
        headline="Freshly Baked Happiness"
        subheadline="Explore gourmet cakes, handcrafted chocolates, fresh pastries, and savory treats. Delivered directly from our nearest kitchen for maximum freshness."
        badgeText="100% Fresh & Artisanal • Express 2-Hour Delivery"
      />

      {/* Offers & Promotions Bar - Live PostgreSQL Offers */}
      {offers.length > 0 && (
        <section className="flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <Heading level="h2" className="text-xl font-bold flex items-center gap-2">
              <Tag className="w-5 h-5 text-[#1D2F5D]" /> Special Offers & Coupons
            </Heading>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {offers.map((o) => (
              <div
                key={o.code || o.id}
                className={`p-5 rounded-2xl bg-gradient-to-br ${o.bg || "from-[#1D2F5D] to-[#D4AF37]"} text-white shadow-md flex flex-col justify-between gap-3`}
              >
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-wider bg-white/20 px-2 py-0.5 rounded-full">
                    Use Code: {o.code}
                  </span>
                  <h3 className="text-lg font-extrabold mt-2">{o.title}</h3>
                  <p className="text-xs text-white/90">{o.desc}</p>
                </div>
                <Link
                  href="/search"
                  className="text-xs font-bold text-white underline underline-offset-4 hover:opacity-80 flex items-center gap-1 w-fit"
                >
                  Claim Offer <ArrowRight className="w-3 h-3" />
                </Link>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Categories Grid - Live PostgreSQL Categories */}
      {categories.length > 0 && (
        <section className="flex flex-col gap-5">
          <div className="flex items-center justify-between">
            <Heading level="h2" className="text-xl font-bold">
              Explore Categories
            </Heading>
            <Link href="/search" className="text-xs font-semibold text-[#1D2F5D] hover:underline flex items-center gap-1">
              View All Categories <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3">
            {categories.map((cat) => (
              <Link
                key={cat.slug || cat.id}
                href={`/category/${cat.slug || cat.id}`}
                className={`p-3.5 rounded-2xl border ${cat.color || "bg-brand-gold-soft border-[#D4AF37]/30 text-[#1D2F5D]"} flex flex-col items-center text-center gap-2 hover:scale-105 transition-transform duration-200 shadow-sm`}
              >
                <span className="text-3xl">{cat.icon || "🎂"}</span>
                <span className="text-xs font-bold line-clamp-1">{cat.name}</span>
                <span className="text-[10px] opacity-75">{cat.count || `${cat.product_count || 0} items`}</span>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* Featured Products */}
      <section className="flex flex-col gap-5">
        <div className="flex items-center justify-between">
          <div>
            <Heading level="h2" className="text-xl font-bold font-serif text-[#1D2F5D] dark:text-[#FAF9F6]">Featured Cakes</Heading>
            <Text className="text-xs text-[#606C88] dark:text-[#C5CEE0]">Handcrafted gourmet cakes baked fresh daily</Text>
          </div>
          <Link href="/search?is_featured=true" className="text-xs font-semibold text-[#1D2F5D] dark:text-[#D4AF37] hover:text-[#D4AF37] transition-colors">
            See All →
          </Link>
        </div>
        <ProductGrid products={featuredProducts} />
      </section>

      {/* Best Sellers */}
      <section className="flex flex-col gap-5">
        <div className="flex items-center justify-between">
          <div>
            <Heading level="h2" className="text-xl font-bold font-serif text-[#1D2F5D] dark:text-[#FAF9F6]">Best Sellers</Heading>
            <Text className="text-xs text-[#606C88] dark:text-[#C5CEE0]">Customer favorites ordered most frequently</Text>
          </div>
          <Link href="/search?sort=rating" className="text-xs font-semibold text-[#1D2F5D] dark:text-[#D4AF37] hover:text-[#D4AF37] transition-colors">
            See All →
          </Link>
        </div>
        <ProductGrid products={bestSellers} />
      </section>

      {/* Birthday Cakes Collection */}
      <section className="flex flex-col gap-5 bg-[#FDFBF7] dark:bg-[#142040]/30 p-6 rounded-3xl border border-[#1D2F5D]/10 dark:border-white/10">
        <div className="flex items-center justify-between">
          <div>
            <Heading level="h2" className="text-xl font-bold font-serif text-[#1D2F5D] dark:text-[#FAF9F6] flex items-center gap-2">
              🎂 Birthday Cakes Collection
            </Heading>
            <Text className="text-xs text-[#606C88] dark:text-[#C5CEE0]">Make birthday celebrations extraordinary</Text>
          </div>
          <Link href="/category/birthday-cakes" className="text-xs font-bold text-[#1D2F5D] dark:text-[#D4AF37] hover:text-[#D4AF37] transition-colors">
            Explore Birthday Range →
          </Link>
        </div>
        <ProductGrid products={products.slice(0, 4)} />
      </section>

      {/* Anniversary Cakes Collection */}
      <section className="flex flex-col gap-5 bg-[#FDFBF7] dark:bg-[#142040]/30 p-6 rounded-3xl border border-[#1D2F5D]/10 dark:border-white/10">
        <div className="flex items-center justify-between">
          <div>
            <Heading level="h2" className="text-xl font-bold font-serif text-[#1D2F5D] dark:text-[#FAF9F6] flex items-center gap-2">
              💖 Anniversary Cakes Collection
            </Heading>
            <Text className="text-xs text-[#606C88] dark:text-[#C5CEE0]">Romantic heart-shaped & premium layered cakes</Text>
          </div>
          <Link href="/category/anniversary-cakes" className="text-xs font-bold text-[#1D2F5D] dark:text-[#D4AF37] hover:text-[#D4AF37] transition-colors">
            Explore Anniversary Range →
          </Link>
        </div>
        <ProductGrid products={products.slice(1, 5)} loading={loading} />
      </section>

      {/* Pastries & Treats */}
      <section className="flex flex-col gap-5">
        <div className="flex items-center justify-between">
          <div>
            <Heading level="h2" className="text-xl font-bold font-serif text-[#1D2F5D] dark:text-[#FAF9F6]">Pastries & Slices</Heading>
            <Text className="text-xs text-[#606C88] dark:text-[#C5CEE0]">Individual indulgence for sweet cravings</Text>
          </div>
          <Link href="/category/pastries" className="text-xs font-semibold text-[#1D2F5D] dark:text-[#D4AF37] hover:text-[#D4AF37] transition-colors">
            See All →
          </Link>
        </div>
        <ProductGrid products={products.slice(2, 6)} loading={loading} />
      </section>

      {/* Cookies & Chocolates */}
      <section className="flex flex-col gap-5">
        <div className="flex items-center justify-between">
          <div>
            <Heading level="h2" className="text-xl font-bold font-serif text-[#1D2F5D] dark:text-[#FAF9F6]">Cookies & Handcrafted Chocolates</Heading>
            <Text className="text-xs text-[#606C88] dark:text-[#C5CEE0]">Freshly baked cookies and pralines</Text>
          </div>
          <Link href="/category/chocolates" className="text-xs font-semibold text-[#1D2F5D] dark:text-[#D4AF37] hover:text-[#D4AF37] transition-colors">
            See All →
          </Link>
        </div>
        <ProductGrid products={products.slice(4, 8)} loading={loading} />
      </section>

      {/* New Arrivals */}
      <section className="flex flex-col gap-5">
        <div className="flex items-center justify-between">
          <div>
            <Heading level="h2" className="text-xl font-bold font-serif text-[#1D2F5D] dark:text-[#FAF9F6]">New Arrivals ✨</Heading>
            <Text className="text-xs text-[#606C88] dark:text-[#C5CEE0]">Discover our latest baker creations</Text>
          </div>
          <Link href="/search?is_new_arrival=true" className="text-xs font-semibold text-[#1D2F5D] dark:text-[#D4AF37] hover:text-[#D4AF37] transition-colors">
            See All →
          </Link>
        </div>
        <ProductGrid products={newArrivals} loading={loading} />
      </section>

      {/* Recommended For You */}
      <section className="flex flex-col gap-5 bg-gradient-to-r from-amber-50 to-orange-50 p-6 rounded-3xl border border-amber-200">
        <div className="flex items-center justify-between">
          <div>
            <Heading level="h2" className="text-xl font-bold text-amber-950 flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-amber-600" /> Recommended For You
            </Heading>
            <Text className="text-xs text-amber-800/80">Tailored suggestions based on popular choices in your area</Text>
          </div>
        </div>
        <ProductGrid products={products.slice(0, 4)} loading={loading} />
      </section>

      {/* Recently Viewed Placeholder Section */}
      <section className="flex flex-col gap-4 border-t pt-8">
        <Heading level="h2" className="text-lg font-bold">Recently Viewed</Heading>
        <div className="flex items-center gap-4 overflow-x-auto pb-2">
          {products.slice(0, 4).map((p) => (
            <Link
              key={`rv_${p.product_id}`}
              href={`/products/${p.handle || p.product_id}`}
              className="flex items-center gap-3 p-2.5 rounded-xl border bg-white min-w-[220px] hover:shadow-sm transition"
            >
              <div className="relative w-12 h-12 rounded-lg overflow-hidden bg-gray-100 shrink-0">
                {p.thumbnail && (
                  <Image src={p.thumbnail} alt={p.title} fill className="object-cover" />
                )}
              </div>
              <div className="flex flex-col truncate">
                <span className="text-xs font-semibold truncate">{p.title}</span>
                <span className="text-xs text-[#1D2F5D] font-bold">₹{p.price}</span>
              </div>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}

function ProductGrid({ products, loading }: { products: SearchResult[]; loading?: boolean }) {
  if (loading && (!products || products.length === 0)) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        {[1, 2, 3, 4].map((n) => (
          <div key={n} className="animate-pulse bg-gray-100 dark:bg-white/5 rounded-2xl h-80" />
        ))}
      </div>
    );
  }

  if (!products || products.length === 0) {
    return null;
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
      {products.map((product) => (
        <ProductCard key={product.product_id || (product as any).id} product={product} />
      ))}
    </div>
  );
}
