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

const SAMPLE_PRODUCTS: SearchResult[] = [
  {
    product_id: "prod_1",
    title: "Belgian Chocolate Truffle Cake",
    description: "Rich, velvety Belgian dark chocolate layers frosted with silky ganache.",
    thumbnail: "https://images.unsplash.com/photo-1578985545062-69928b1d9587?auto=format&fit=crop&q=80&w=800",
    handle: "belgian-chocolate-truffle-cake",
    price: 649,
    rating: 4.9,
    review_count: 142,
    eggless: true,
    sugar_free: false,
    gluten_free: false,
    vegan: false,
    is_featured: true,
    is_bestseller: true,
    is_new_arrival: false,
  },
  {
    product_id: "prod_2",
    title: "Classic Red Velvet Cream Cheese Cake",
    description: "Moist red velvet sponge layers filled with signature cream cheese frosting.",
    thumbnail: "https://images.unsplash.com/photo-1616541823729-00fe0aacd32c?auto=format&fit=crop&q=80&w=800",
    handle: "classic-red-velvet-cake",
    price: 749,
    rating: 4.8,
    review_count: 98,
    eggless: true,
    sugar_free: false,
    gluten_free: false,
    vegan: false,
    is_featured: true,
    is_bestseller: true,
    is_new_arrival: false,
  },
  {
    product_id: "prod_3",
    title: "Fresh Alphonsa Mango Mousse Cake",
    description: "Seasonal Alphonso mango pulp whipped into light, airy mousse layers.",
    thumbnail: "https://images.unsplash.com/photo-1535141192574-5d4897c13136?auto=format&fit=crop&q=80&w=800",
    handle: "mango-mousse-cake",
    price: 699,
    rating: 4.9,
    review_count: 76,
    eggless: true,
    sugar_free: false,
    gluten_free: false,
    vegan: false,
    is_featured: true,
    is_bestseller: false,
    is_new_arrival: true,
  },
  {
    product_id: "prod_4",
    title: "Black Forest Gateau Special",
    description: "Traditional German cherry gateau topped with dark chocolate shavings.",
    thumbnail: "https://images.unsplash.com/photo-1606890737304-57a1ca8a5b62?auto=format&fit=crop&q=80&w=800",
    handle: "black-forest-gateau",
    price: 549,
    rating: 4.7,
    review_count: 210,
    eggless: true,
    sugar_free: false,
    gluten_free: false,
    vegan: false,
    is_featured: false,
    is_bestseller: true,
    is_new_arrival: false,
  },
  {
    product_id: "prod_5",
    title: "Butterscotch Caramel Crunch Cake",
    description: "Crunchy praline & salted caramel folded in whipped vanilla cream.",
    thumbnail: "https://images.unsplash.com/photo-1565958011703-44f9829ba187?auto=format&fit=crop&q=80&w=800",
    handle: "butterscotch-caramel-cake",
    price: 599,
    rating: 4.8,
    review_count: 115,
    eggless: true,
    sugar_free: false,
    gluten_free: false,
    vegan: false,
    is_featured: true,
    is_bestseller: false,
    is_new_arrival: false,
  },
  {
    product_id: "prod_6",
    title: "Artisanal Choco-Chip Cookies (Pack of 8)",
    description: "Freshly baked butter cookies packed with melted Belgian chocolate chips.",
    thumbnail: "https://images.unsplash.com/photo-1499636136210-6f4ee915583e?auto=format&fit=crop&q=80&w=800",
    handle: "choco-chip-cookies",
    price: 249,
    rating: 4.9,
    review_count: 64,
    eggless: true,
    sugar_free: false,
    gluten_free: false,
    vegan: false,
    is_featured: false,
    is_bestseller: true,
    is_new_arrival: false,
  },
  {
    product_id: "prod_7",
    title: "French Vanilla Bean Blueberry Pastry",
    description: "Layered French vanilla pastry drizzled with organic wild blueberry compote.",
    thumbnail: "https://images.unsplash.com/photo-1587314168485-3236d6710814?auto=format&fit=crop&q=80&w=800",
    handle: "blueberry-pastry",
    price: 149,
    rating: 4.9,
    review_count: 52,
    eggless: true,
    sugar_free: false,
    gluten_free: false,
    vegan: false,
    is_featured: true,
    is_bestseller: false,
    is_new_arrival: true,
  },
  {
    product_id: "prod_8",
    title: "Gourmet Hazelnut Praline Chocolates (Box of 12)",
    description: "Handcrafted dark chocolate pralines filled with toasted Italian hazelnuts.",
    thumbnail: "https://images.unsplash.com/photo-1549007994-cb92caebd54b?auto=format&fit=crop&q=80&w=800",
    handle: "hazelnut-chocolates-box",
    price: 499,
    rating: 4.9,
    review_count: 88,
    eggless: true,
    sugar_free: false,
    gluten_free: true,
    vegan: false,
    is_featured: true,
    is_bestseller: true,
    is_new_arrival: false,
  },
];

const CATEGORIES = [
  { name: "Birthday Cakes", icon: "🎂", slug: "birthday-cakes", count: "42 items", color: "bg-rose-50 border-rose-200 text-rose-900" },
  { name: "Anniversary Cakes", icon: "💖", slug: "anniversary-cakes", count: "35 items", color: "bg-pink-50 border-pink-200 text-pink-900" },
  { name: "Pastries", icon: "🥐", slug: "pastries", count: "28 items", color: "bg-amber-50 border-amber-200 text-amber-900" },
  { name: "Snacks", icon: "🥨", slug: "snacks", count: "24 items", color: "bg-orange-50 border-orange-200 text-orange-900" },
  { name: "Cookies", icon: "🍪", slug: "cookies", count: "19 items", color: "bg-yellow-50 border-yellow-200 text-yellow-900" },
  { name: "Chocolates", icon: "🍫", slug: "chocolates", count: "30 items", color: "bg-amber-100 border-amber-300 text-amber-950" },
  { name: "Beverages", icon: "☕", slug: "beverages", count: "15 items", color: "bg-blue-50 border-blue-200 text-blue-900" },
  { name: "New Arrivals", icon: "✨", slug: "new-arrivals", count: "22 items", color: "bg-purple-50 border-purple-200 text-purple-900" },
];

const OFFERS = [
  { code: "CAKE100", title: "Flat ₹100 OFF", desc: "On orders above ₹599", bg: "from-rose-500 to-pink-600" },
  { code: "EXPRESS2H", title: "Free 2-Hour Express Delivery", desc: "No minimum order requirement", bg: "from-amber-500 to-orange-600" },
  { code: "SWEET15", title: "Extra 15% OFF", desc: "On all Birthday & Anniversary orders", bg: "from-purple-600 to-indigo-600" },
];

export function StorefrontProductHomepage() {
  const [products, setProducts] = useState<SearchResult[]>(SAMPLE_PRODUCTS);
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    async function loadCatalog() {
      try {
        const res = await searchProductsAction({ limit: 48 });
        if (res?.results && res.results.length > 0) {
          setProducts(res.results);
        }
      } catch {
        // Fallback to rich curated samples if API is offline
      }
    }
    loadCatalog();
  }, []);

  const featuredProducts = (products.filter((p) => p.is_featured).length > 0 ? products.filter((p) => p.is_featured) : products).slice(0, 4);
  const bestSellers = (products.filter((p) => p.is_bestseller).length > 0 ? products.filter((p) => p.is_bestseller) : products).slice(0, 4);
  const newArrivals = (products.filter((p) => p.is_new_arrival).length > 0 ? products.filter((p) => p.is_new_arrival) : products).slice(0, 4);

  return (
    <div className="flex flex-col gap-12 w-full max-w-7xl mx-auto px-4 md:px-6 py-4">
      {/* Hero Banner Section */}
      <section className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-rose-900 via-pink-800 to-rose-950 text-white p-8 md:p-14 shadow-2xl">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-rose-400/20 via-transparent to-transparent opacity-60"></div>
        <div className="relative z-10 flex flex-col md:flex-row items-center justify-between gap-8">
          <div className="flex flex-col gap-5 max-w-2xl">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/10 backdrop-blur-md border border-white/20 text-xs font-semibold text-rose-200 w-fit">
              <Sparkles className="w-4 h-4 text-amber-300 animate-pulse" />
              100% Fresh & Artisanal • Express 2-Hour Delivery
            </div>
            <Heading level="h1" className="text-3xl md:text-5xl font-extrabold tracking-tight leading-tight text-white">
              Freshly Baked Happiness <br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-amber-200 via-rose-200 to-pink-100">
                Delivered To Your Doorstep
              </span>
            </Heading>
            <Text className="text-rose-100/90 text-sm md:text-base leading-relaxed">
              Explore gourmet cakes, handcrafted chocolates, fresh pastries, and savory treats. Delivered directly from our nearest kitchen for maximum freshness.
            </Text>

            {/* Quick Product Search Bar */}
            <div className="relative w-full max-w-lg mt-2">
              <Input
                type="text"
                placeholder="Search Belgian Chocolate, Red Velvet, Cookies..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-11 pr-24 py-3 rounded-xl bg-white text-gray-900 shadow-lg text-sm focus:ring-2 focus:ring-rose-400 border-0"
              />
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <Link
                href={`/search${searchQuery ? `?q=${encodeURIComponent(searchQuery)}` : ""}`}
                className="absolute right-1.5 top-1/2 -translate-y-1/2 bg-rose-600 hover:bg-rose-700 text-white px-4 py-1.5 rounded-lg text-xs font-semibold transition"
              >
                Search
              </Link>
            </div>

            {/* Trust Badges */}
            <div className="grid grid-cols-3 gap-4 mt-4 pt-4 border-t border-white/10 text-xs text-rose-100/80">
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-amber-300" />
                <span>2-Hour Delivery</span>
              </div>
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-emerald-300" />
                <span>Eggless Options</span>
              </div>
              <div className="flex items-center gap-2">
                <Gift className="w-4 h-4 text-pink-300" />
                <span>Gift & Surprise</span>
              </div>
            </div>
          </div>

          <div className="relative shrink-0 w-full md:w-80 aspect-square rounded-2xl overflow-hidden shadow-2xl border-4 border-white/10 hidden sm:block">
            <Image
              src="https://images.unsplash.com/photo-1578985545062-69928b1d9587?auto=format&fit=crop&q=80&w=800"
              alt="Gourmet CakeToHome Cake"
              fill
              className="object-cover hover:scale-105 transition duration-500"
              priority
            />
          </div>
        </div>
      </section>

      {/* Offers & Promotions Bar */}
      <section className="flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <Heading level="h2" className="text-xl font-bold flex items-center gap-2">
            <Tag className="w-5 h-5 text-rose-600" /> Special Offers & Coupons
          </Heading>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {OFFERS.map((o) => (
            <div
              key={o.code}
              className={`p-5 rounded-2xl bg-gradient-to-br ${o.bg} text-white shadow-md flex flex-col justify-between gap-3`}
            >
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider bg-white/20 px-2 py-0.5 rounded-full">
                  Use Code: {o.code}
                </span>
                <h3 className="text-lg font-extrabold mt-2">{o.title}</h3>
                <p className="text-xs text-white/90">{o.desc}</p>
              </div>
              <Link
                href="/category/birthday-cakes"
                className="text-xs font-bold text-white underline underline-offset-4 hover:opacity-80 flex items-center gap-1 w-fit"
              >
                Claim Offer <ArrowRight className="w-3 h-3" />
              </Link>
            </div>
          ))}
        </div>
      </section>

      {/* Categories Grid */}
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
          {CATEGORIES.map((cat) => (
            <Link
              key={cat.slug}
              href={`/category/${cat.slug}`}
              className={`p-3.5 rounded-2xl border ${cat.color} flex flex-col items-center text-center gap-2 hover:scale-105 transition-transform duration-200 shadow-sm`}
            >
              <span className="text-3xl">{cat.icon}</span>
              <span className="text-xs font-bold line-clamp-1">{cat.name}</span>
              <span className="text-[10px] opacity-75">{cat.count}</span>
            </Link>
          ))}
        </div>
      </section>

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
        <ProductGrid products={products.slice(1, 5)} />
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
        <ProductGrid products={products.slice(2, 6)} />
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
        <ProductGrid products={products.slice(4, 8)} />
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
        <ProductGrid products={newArrivals} />
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
        <ProductGrid products={products.slice(0, 4)} />
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

function ProductGrid({ products }: { products: SearchResult[] }) {
  const router = useRouter();
  const [addingMap, setAddingMap] = useState<Record<string, boolean>>({});
  const [errorMap, setErrorMap] = useState<Record<string, string | null>>({});

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

  const handleWishlist = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
  };

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
      {products.map((product) => {
        const productHandle = product.handle || product.slug || product.product_id || product.id;
        const productHref = `/products/${productHandle}`;

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
              {product.eggless && (
                <div className="absolute top-3 left-3 bg-emerald-600 text-white text-[10px] font-bold px-2 py-0.5 rounded-full shadow-sm z-10">
                  🌱 Eggless
                </div>
              )}
              <div
                onClick={handleWishlist}
                className="absolute top-3 right-3 bg-white/80 backdrop-blur-md p-1.5 rounded-full shadow-sm text-gray-700 hover:text-rose-600 cursor-pointer transition z-10"
              >
                <Heart className="w-4 h-4" />
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
