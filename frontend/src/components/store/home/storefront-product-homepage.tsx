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
import dynamic from "next/dynamic";

const ScrollFrameHero = dynamic(
  () => import("@frontend/components/store/animation/scroll-frame-hero").then((mod) => mod.ScrollFrameHero),
  {
    ssr: false,
    loading: () => (
      <div className="w-full min-h-[500px] flex items-center justify-center bg-zinc-950 text-white/50 text-sm animate-pulse">
        Loading interactive experience...
      </div>
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
              <Tag className="w-5 h-5 text-rose-600" /> Special Offers & Coupons
            </Heading>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {offers.map((o) => (
              <div
                key={o.code || o.id}
                className={`p-5 rounded-2xl bg-gradient-to-br ${o.bg || "from-rose-500 to-pink-600"} text-white shadow-md flex flex-col justify-between gap-3`}
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
            <Link href="/search" className="text-xs font-semibold text-rose-600 hover:underline flex items-center gap-1">
              View All Categories <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3">
            {categories.map((cat) => (
              <Link
                key={cat.slug || cat.id}
                href={`/category/${cat.slug || cat.id}`}
                className={`p-3.5 rounded-2xl border ${cat.color || "bg-rose-50 border-rose-200 text-rose-900"} flex flex-col items-center text-center gap-2 hover:scale-105 transition-transform duration-200 shadow-sm`}
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
            <Heading level="h2" className="text-xl font-bold">Featured Cakes</Heading>
            <Text className="text-xs text-gray-500">Handcrafted gourmet cakes baked fresh daily</Text>
          </div>
          <Link href="/search?is_featured=true" className="text-xs font-semibold text-rose-600 hover:underline">
            See All →
          </Link>
        </div>
        <ProductGrid products={featuredProducts} />
      </section>

      {/* Best Sellers */}
      <section className="flex flex-col gap-5">
        <div className="flex items-center justify-between">
          <div>
            <Heading level="h2" className="text-xl font-bold">Best Sellers</Heading>
            <Text className="text-xs text-gray-500">Customer favorites ordered most frequently</Text>
          </div>
          <Link href="/search?sort=rating" className="text-xs font-semibold text-rose-600 hover:underline">
            See All →
          </Link>
        </div>
        <ProductGrid products={bestSellers} />
      </section>

      {/* Birthday Cakes Collection */}
      <section className="flex flex-col gap-5 bg-rose-50/50 p-6 rounded-3xl border border-rose-100">
        <div className="flex items-center justify-between">
          <div>
            <Heading level="h2" className="text-xl font-bold text-rose-950 flex items-center gap-2">
              🎂 Birthday Cakes Collection
            </Heading>
            <Text className="text-xs text-rose-700/80">Make birthday celebrations extraordinary</Text>
          </div>
          <Link href="/category/birthday-cakes" className="text-xs font-bold text-rose-700 hover:underline">
            Explore Birthday Range →
          </Link>
        </div>
        <ProductGrid products={products.slice(0, 4)} />
      </section>

      {/* Anniversary Cakes Collection */}
      <section className="flex flex-col gap-5 bg-pink-50/50 p-6 rounded-3xl border border-pink-100">
        <div className="flex items-center justify-between">
          <div>
            <Heading level="h2" className="text-xl font-bold text-pink-950 flex items-center gap-2">
              💖 Anniversary Cakes Collection
            </Heading>
            <Text className="text-xs text-pink-700/80">Romantic heart-shaped & premium layered cakes</Text>
          </div>
          <Link href="/category/anniversary-cakes" className="text-xs font-bold text-pink-700 hover:underline">
            Explore Anniversary Range →
          </Link>
        </div>
        <ProductGrid products={products.slice(1, 5)} loading={loading} />
      </section>

      {/* Pastries & Treats */}
      <section className="flex flex-col gap-5">
        <div className="flex items-center justify-between">
          <div>
            <Heading level="h2" className="text-xl font-bold">Pastries & Slices</Heading>
            <Text className="text-xs text-gray-500">Individual indulgence for sweet cravings</Text>
          </div>
          <Link href="/category/pastries" className="text-xs font-semibold text-rose-600 hover:underline">
            See All →
          </Link>
        </div>
        <ProductGrid products={products.slice(2, 6)} loading={loading} />
      </section>

      {/* Cookies & Chocolates */}
      <section className="flex flex-col gap-5">
        <div className="flex items-center justify-between">
          <div>
            <Heading level="h2" className="text-xl font-bold">Cookies & Handcrafted Chocolates</Heading>
            <Text className="text-xs text-gray-500">Freshly baked cookies and pralines</Text>
          </div>
          <Link href="/category/chocolates" className="text-xs font-semibold text-rose-600 hover:underline">
            See All →
          </Link>
        </div>
        <ProductGrid products={products.slice(4, 8)} loading={loading} />
      </section>

      {/* New Arrivals */}
      <section className="flex flex-col gap-5">
        <div className="flex items-center justify-between">
          <div>
            <Heading level="h2" className="text-xl font-bold">New Arrivals ✨</Heading>
            <Text className="text-xs text-gray-500">Discover our latest baker creations</Text>
          </div>
          <Link href="/search?is_new_arrival=true" className="text-xs font-semibold text-rose-600 hover:underline">
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
                <span className="text-xs text-rose-600 font-bold">₹{p.price}</span>
              </div>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}

function ProductGrid({ products, loading }: { products: SearchResult[]; loading?: boolean }) {
  const router = useRouter();
  const { isFavorited, toggleFavorite } = useFavorites();
  const [addingMap, setAddingMap] = useState<Record<string, boolean>>({});
  const [errorMap, setErrorMap] = useState<Record<string, string | null>>({});

  if (loading && (!products || products.length === 0)) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        {[1, 2, 3, 4].map((n) => (
          <div key={n} className="animate-pulse bg-gray-100 rounded-2xl h-72" />
        ))}
      </div>
    );
  }

  if (!products || products.length === 0) {
    return null;
  }

  const handleQuickAdd = async (e: React.MouseEvent, product: SearchResult) => {
    e.stopPropagation();
    e.preventDefault();
    setAddingMap((prev) => ({ ...prev, [product.product_id]: true }));
    setErrorMap((prev) => ({ ...prev, [product.product_id]: null }));
    try {
      await addToCart(product.variant_id || product.product_id, "default_shop");
      router.refresh();
    } catch (err: any) {
      console.error("Failed quick add to cart", err);
      setErrorMap((prev) => ({ ...prev, [product.product_id]: err.message || "Failed to add cake to cart. Please try again." }));
    } finally {
      setAddingMap((prev) => ({ ...prev, [product.product_id]: false }));
    }
  };

  const handleWishlist = async (e: React.MouseEvent, product: SearchResult) => {
    e.stopPropagation();
    e.preventDefault();
    await toggleFavorite(product.product_id, { title: product.title, handle: product.handle || undefined });
  };

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
      {products.map((product) => {
        const productHandle = product.handle || (product as any).slug || product.product_id || (product as any).id;
        const productHref = `/products/${productHandle}`;
        const wished = isFavorited(product.product_id);

        return (
          <div
            key={product.product_id}
            onClick={() => router.push(productHref)}
            className="group flex flex-col justify-between bg-white border border-gray-200 rounded-2xl overflow-hidden hover:shadow-xl transition-all duration-300 cursor-pointer"
          >
            {errorMap[product.product_id] && (
              <ErrorComponent
                compact
                message={errorMap[product.product_id]}
                onDismiss={() => setErrorMap((prev) => ({ ...prev, [product.product_id]: null }))}
                className="m-2"
              />
            )}
            <Link href={productHref} className="relative aspect-square w-full bg-gray-100 overflow-hidden block">
              {product.thumbnail ? (
                <Image
                  src={product.thumbnail}
                  alt={product.title}
                  fill
                  className="object-cover group-hover:scale-108 transition-transform duration-500"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-4xl">🎂</div>
              )}
              <div
                onClick={(e) => handleWishlist(e, product)}
                className={`absolute top-3 right-3 backdrop-blur-md p-1.5 rounded-full shadow-sm cursor-pointer transition z-10 ${
                  wished
                    ? "bg-rose-50 text-rose-600 border border-rose-200"
                    : "bg-white/80 text-gray-700 hover:text-rose-600 hover:bg-white"
                }`}
                title={wished ? "Remove from Favorites" : "Add to Favorites"}
              >
                <Heart className="w-4 h-4" fill={wished ? "currentColor" : "none"} />
              </div>
            </Link>

            <div className="p-4 flex flex-col gap-2 flex-1 justify-between">
              <Link href={productHref} className="block group-hover:no-underline">
                <div className="flex items-center justify-between text-xs text-gray-500 mb-1">
                  <span>⭐ {product.rating} ({product.review_count})</span>
                  {product.is_bestseller && (
                    <Badge size="small" color="orange">Bestseller</Badge>
                  )}
                </div>
                <h3 className="font-bold text-sm text-gray-900 group-hover:text-rose-600 transition line-clamp-1">
                  {product.title}
                </h3>
                <p className="text-xs text-gray-500 line-clamp-2 mt-1">
                  {product.description}
                </p>
              </Link>

              <div className="flex items-center justify-between pt-3 border-t border-gray-100 mt-2">
                <Link href={productHref} className="text-base font-extrabold text-gray-900 hover:text-rose-600">
                  ₹{product.price}
                </Link>
                <Link
                  href={productHref}
                  className="bg-rose-600 hover:bg-rose-700 text-white px-3.5 py-1.5 rounded-xl text-xs font-bold transition duration-200 shadow-sm flex items-center gap-1"
                >
                  View Cake →
                </Link>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
