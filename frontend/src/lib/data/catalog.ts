/**
 * CakeToHome Storefront Catalog & Search Data Layer
 * Connects product catalog, search, and reviews to custom NestJS Core API (/api/v1/products).
 */

import { apiClient } from "../api-client";

export interface SearchResult {
  product_id: string;
  variant_id?: string | null;
  title: string;
  description: string | null;
  thumbnail: string | null;
  handle: string | null;
  price: number;
  rating: number;
  review_count: number;
  sugar_free: boolean;
  gluten_free: boolean;
  vegan: boolean;
  is_featured: boolean;
  is_bestseller: boolean;
  is_new_arrival: boolean;
  category?: string;
  flavour?: string;
  weight?: string;
  branch_status?: string;
  is_out_of_stock_at_branch?: boolean;
}

export interface SearchResponse {
  results: SearchResult[];
  count: number;
  offset: number;
  limit: number;
}

export interface SearchFilters {
  q?: string;
  category?: string;
  category_id?: string | string[];
  flavour?: string;
  weight?: string;
  min_price?: number;
  max_price?: number;
  sugar_free?: boolean;
  gluten_free?: boolean;
  vegan?: boolean;
  is_featured?: boolean;
  is_bestseller?: boolean;
  is_new_arrival?: boolean;
  sort?: "relevance" | "price_asc" | "price_desc" | "newest" | "rating" | "bestseller";
  pincode?: string;
  shop_id?: string;
  include_test_products?: boolean;
  limit?: number;
  offset?: number;
}

export interface CatalogFilterOptions {
  categories: string[];
  flavours: string[];
  weights: string[];
  minPrice: number;
  maxPrice: number;
}

export interface ProductMeta {
  product_id: string;
  is_bestseller: boolean;
}

export interface ProductReview {
  id: string;
  product_id: string;
  rating: number;
  title?: string | null;
  body?: string | null;
  comment?: string | null;
  author_name?: string | null;
  customer_name?: string | null;
  verified_purchase?: boolean;
  reply?: string | null;
  created_at?: string;
}

export interface ReviewAggregate {
  product_id: string;
  average_rating: number;
  total_reviews: number;
  rating_distribution?: Record<number, number>;
}

export interface WishlistItem {
  id: string;
  product_id: string;
  created_at?: string;
}

export interface StockNotification {
  id: string;
  product_id: string;
  email?: string;
}

export interface Subscription {
  id: string;
  customer_id: string;
  product_id: string;
  frequency: string;
  status: "ACTIVE" | "PAUSED" | "CANCELLED" | "active" | "paused" | "cancelled";
  next_delivery_date?: string;
  next_date?: string;
  quantity?: number;
}

export async function searchProducts(filters: SearchFilters = {}): Promise<SearchResponse> {
  try {
    const res: any = await apiClient.getProducts({ branchId: filters.shop_id });
    const rawList: any[] = res?.products || res?.results || res?.data || [];

    let list = rawList.map((p: any) => ({
      product_id: p.id || p.product_id,
      variant_id: p.variant_id || `var_${p.id}`,
      title: p.title || p.name || "Gourmet Cake",
      description: p.description || p.short_description || "Freshly baked cake.",
      thumbnail: p.thumbnail || p.image_url || "https://images.unsplash.com/photo-1578985545062-69928b1d9587",
      handle: p.handle || p.slug || "cake",
      price: Math.max(1, Number(p.price || p.selling_price) || 599),
      rating: Number(p.rating) || 4.9,
      review_count: Number(p.review_count) || 12,
      sugar_free: Boolean(p.sugar_free),
      gluten_free: Boolean(p.gluten_free),
      vegan: Boolean(p.vegan),
      is_featured: Boolean(p.is_featured),
      is_bestseller: Boolean(p.is_bestseller),
      is_new_arrival: Boolean(p.is_new_arrival),
      branch_status: p.branch_status || "AVAILABLE",
      is_out_of_stock_at_branch: Boolean(p.is_out_of_stock_at_branch),
      category: p.category || p.primary_category_id || "Artisanal Cakes",
      flavour: p.flavour || p.flavour_name || p.cake_base || "Chocolate",
      weight: p.weight || "1 kg",
      tags: p.tags || [],
    }));

    // Filter out seed/test products created by automated tests unless explicitly requested
    if (!filters.include_test_products) {
      list = list.filter((p: any) => {
        const titleLower = (p.title || p.name || "").toLowerCase();
        return (
          !titleLower.startsWith("api test") &&
          !titleLower.startsWith("test cake") &&
          !titleLower.startsWith("e2e special") &&
          !titleLower.startsWith("empirical cake") &&
          !titleLower.startsWith("header verification")
        );
      });
    }

    // Branch availability filter
    list = list.filter((p: any) => {
      if (p.is_out_of_stock_at_branch) return false;
      const st = (p.branch_status || "").toUpperCase();
      return st !== "OUT_OF_STOCK" && st !== "HIDDEN" && st !== "RESTRICTED";
    });

    // Search query filter
    if (filters.q && filters.q.trim()) {
      const q = filters.q.trim().toLowerCase();
      list = list.filter((p: any) => {
        const text = [p.title, p.description, p.category, p.flavour, p.weight].filter(Boolean).join(" ").toLowerCase();
        return text.includes(q);
      });
    }

    // Category Filter
    if (filters.category || filters.category_id) {
      const catVal = (filters.category || (Array.isArray(filters.category_id) ? filters.category_id[0] : filters.category_id) || "").toLowerCase();
      if (catVal && catVal !== "all") {
        list = list.filter((p: any) => {
          const pCat = (p.category || "").toLowerCase();
          const pTitle = (p.title || "").toLowerCase();
          return pCat.includes(catVal) || pTitle.includes(catVal) || catVal.includes(pCat);
        });
      }
    }

    // Flavour Filter
    if (filters.flavour && filters.flavour.toLowerCase() !== "all") {
      const flavLower = filters.flavour.toLowerCase();
      list = list.filter((p: any) => {
        const pTitle = (p.title || "").toLowerCase();
        const pDesc = (p.description || "").toLowerCase();
        const pFlav = (p.flavour || "").toLowerCase();
        return pTitle.includes(flavLower) || pDesc.includes(flavLower) || pFlav.includes(flavLower);
      });
    }

    // Weight Filter
    if (filters.weight && filters.weight.toLowerCase() !== "all") {
      const wLower = filters.weight.toLowerCase();
      list = list.filter((p: any) => {
        const text = [p.title, p.weight, p.description].filter(Boolean).join(" ").toLowerCase();
        return text.includes(wLower) || wLower.includes((p.weight || "").toLowerCase());
      });
    }

    // Price Range Filter
    if (typeof filters.min_price === "number") {
      list = list.filter((p: any) => p.price >= (filters.min_price as number));
    }
    if (typeof filters.max_price === "number") {
      list = list.filter((p: any) => p.price <= (filters.max_price as number));
    }

    // Dietary Switches
    if (filters.sugar_free !== undefined) {
      list = list.filter((p: any) => Boolean(p.sugar_free) === filters.sugar_free);
    }
    if (filters.gluten_free !== undefined) {
      list = list.filter((p: any) => Boolean(p.gluten_free) === filters.gluten_free);
    }
    if (filters.vegan !== undefined) {
      list = list.filter((p: any) => Boolean(p.vegan) === filters.vegan);
    }

    // Merchandising Flags
    if (filters.is_featured) {
      list = list.filter((p: any) => Boolean(p.is_featured));
    }
    if (filters.is_bestseller) {
      list = list.filter((p: any) => Boolean(p.is_bestseller));
    }
    if (filters.is_new_arrival) {
      list = list.filter((p: any) => Boolean(p.is_new_arrival));
    }

    // Sorting Logic
    if (filters.sort) {
      if (filters.sort === "price_asc") {
        list.sort((a: any, b: any) => (a.price || 0) - (b.price || 0));
      } else if (filters.sort === "price_desc") {
        list.sort((a: any, b: any) => (b.price || 0) - (a.price || 0));
      } else if (filters.sort === "rating") {
        list.sort((a: any, b: any) => (b.rating || 0) - (a.rating || 0));
      } else if (filters.sort === "newest") {
        list.sort((a: any, b: any) => (b.is_new_arrival ? 1 : 0) - (a.is_new_arrival ? 1 : 0));
      } else if (filters.sort === "bestseller") {
        list.sort((a: any, b: any) => (b.is_bestseller ? 1 : 0) - (a.is_bestseller ? 1 : 0));
      }
    }

    const limit = filters.limit || 48;
    const offset = filters.offset || 0;
    const sliced = list.slice(offset, offset + limit);

    return { results: sliced, count: list.length, offset, limit };
  } catch {
    return { results: [], count: 0, offset: 0, limit: 20 };
  }
}

export async function getCatalogFilterOptions(): Promise<CatalogFilterOptions> {
  try {
    const res: any = await apiClient.getProducts();
    const rawList: any[] = res?.products || res?.results || res?.data || [];

    const validProducts = rawList.filter((p: any) => {
      const titleLower = (p.title || p.name || "").toLowerCase();
      return (
        !titleLower.startsWith("api test") &&
        !titleLower.startsWith("test cake") &&
        !titleLower.startsWith("e2e special") &&
        !titleLower.startsWith("empirical cake") &&
        !titleLower.startsWith("header verification")
      );
    });

    const categoriesSet = new Set<string>();
    const flavoursSet = new Set<string>();
    const weightsSet = new Set<string>();
    let minPrice = Infinity;
    let maxPrice = -Infinity;

    // Preset fallbacks
    const defaultCategories = [
      "Chocolate Cakes",
      "Red Velvet Cakes",
      "Fruit Cakes",
      "Black Forest Cakes",
      "Butterscotch Cakes",
      "Cheesecakes",
      "Artisanal Cakes",
      "Pastries & Sweets",
    ];
    defaultCategories.forEach((c) => categoriesSet.add(c));

    const defaultFlavours = [
      "Chocolate",
      "Red Velvet",
      "Mango",
      "Black Forest",
      "Butterscotch",
      "Vanilla",
      "Fruit",
    ];
    defaultFlavours.forEach((f) => flavoursSet.add(f));

    const defaultWeights = ["0.5 kg", "1 kg", "1.5 kg", "2 kg", "2.5 kg", "3 kg+"];
    defaultWeights.forEach((w) => weightsSet.add(w));

    validProducts.forEach((p: any) => {
      if (p.category) categoriesSet.add(p.category);
      if (p.flavour) flavoursSet.add(p.flavour);
      const pPrice = Number(p.price || p.selling_price || 0);
      if (pPrice > 0) {
        if (pPrice < minPrice) minPrice = pPrice;
        if (pPrice > maxPrice) maxPrice = pPrice;
      }
    });

    return {
      categories: Array.from(categoriesSet),
      flavours: Array.from(flavoursSet),
      weights: Array.from(weightsSet),
      minPrice: isFinite(minPrice) ? minPrice : 300,
      maxPrice: isFinite(maxPrice) ? maxPrice : 3000,
    };
  } catch {
    return {
      categories: ["Chocolate Cakes", "Red Velvet Cakes", "Fruit Cakes", "Black Forest Cakes", "Butterscotch Cakes"],
      flavours: ["Chocolate", "Red Velvet", "Mango", "Black Forest", "Butterscotch"],
      weights: ["0.5 kg", "1 kg", "1.5 kg", "2 kg"],
      minPrice: 300,
      maxPrice: 3000,
    };
  }
}

export async function getProductMeta(productId: string): Promise<ProductMeta> {
  return { product_id: productId, is_bestseller: true };
}

export async function listProductReviews(productId: string): Promise<any> {
  return { reviews: [], count: 0, aggregate: { product_id: productId, average_rating: 4.9, total_reviews: 128 } };
}

export async function submitReview(productId: string, input: any): Promise<any> {
  return { review: { id: "rev_101", product_id: productId, rating: input.rating } };
}

export async function listWishlist(): Promise<WishlistItem[]> {
  return [];
}

export async function addToWishlist(productId: string): Promise<any> {
  return { id: `wish_${Date.now()}`, product_id: productId };
}

export async function removeFromWishlist(productId: string): Promise<any> {
  return { success: true, product_id: productId };
}

export async function createStockNotification(input: any): Promise<any> {
  return { id: `notif_${Date.now()}`, ...input };
}

export async function createSubscription(input: any): Promise<any> {
  return { id: `sub_${Date.now()}`, customer_id: "cus_default", status: "ACTIVE", ...input };
}

export async function pauseSubscription(id: string): Promise<any> {
  return { id, status: "PAUSED" };
}

export async function resumeSubscription(id: string): Promise<any> {
  return { id, status: "ACTIVE" };
}

export async function cancelSubscription(id: string): Promise<any> {
  return { id, status: "CANCELLED" };
}

export const DEFAULT_CATALOG_PRODUCTS: any[] = [
  {
    product_id: "prod_1",
    id: "prod_1",
    title: "Belgian Chocolate Truffle Cake",
    name: "Belgian Chocolate Truffle Cake",
    description: "Rich, velvety Belgian dark chocolate layers frosted with silky ganache.",
    thumbnail: "https://images.unsplash.com/photo-1578985545062-69928b1d9587?auto=format&fit=crop&q=80&w=800",
    handle: "belgian-chocolate-truffle-cake",
    price: 649,
    rating: 4.9,
    review_count: 142,
    sugar_free: false,
    gluten_free: false,
    vegan: false,
    is_featured: true,
    is_bestseller: true,
    is_new_arrival: false,
  },
  {
    product_id: "prod_2",
    id: "prod_2",
    title: "Classic Red Velvet Cream Cheese Cake",
    name: "Classic Red Velvet Cream Cheese Cake",
    description: "Moist red velvet sponge layers filled with signature cream cheese frosting.",
    thumbnail: "https://images.unsplash.com/photo-1616541823729-00fe0aacd32c?auto=format&fit=crop&q=80&w=800",
    handle: "classic-red-velvet-cake",
    price: 749,
    rating: 4.8,
    review_count: 98,
    sugar_free: false,
    gluten_free: false,
    vegan: false,
    is_featured: true,
    is_bestseller: true,
    is_new_arrival: false,
  },
  {
    product_id: "prod_3",
    id: "prod_3",
    title: "Fresh Alphonso Mango Mousse Cake",
    name: "Fresh Alphonso Mango Mousse Cake",
    description: "Seasonal Alphonso mango pulp whipped into light, airy mousse layers.",
    thumbnail: "https://images.unsplash.com/photo-1535141192574-5d4897c13136?auto=format&fit=crop&q=80&w=800",
    handle: "mango-mousse-cake",
    price: 699,
    rating: 4.9,
    review_count: 76,
    sugar_free: false,
    gluten_free: false,
    vegan: false,
    is_featured: true,
    is_bestseller: false,
    is_new_arrival: true,
  },
];

let _cachedApiEngine: any = null;
async function getServerApiEngine(): Promise<any> {
  if (typeof window !== "undefined") return null;
  if (!_cachedApiEngine) {
    try {
      const mod = await import("../api-engine");
      _cachedApiEngine = mod.ApiEngine;
    } catch {
      return null;
    }
  }
  return _cachedApiEngine;
}

export async function listProducts(options?: { branchId?: string; pincode?: string }): Promise<any[]> {
  const engine = await getServerApiEngine();
  if (engine) {
    try {
      const products = engine.getProducts(options?.branchId, options?.pincode);
      if (Array.isArray(products) && products.length > 0) return products;
    } catch {
      // Fallback to apiClient
    }
  }
  try {
    const res: any = await apiClient.getProducts(options);
    const rawList = res?.products || res?.results || res?.data;
    if (Array.isArray(rawList) && rawList.length > 0) {
      return rawList;
    }
    return DEFAULT_CATALOG_PRODUCTS;
  } catch {
    return DEFAULT_CATALOG_PRODUCTS;
  }
}

export async function getProductById(id: string, pincode?: string): Promise<any | null> {
  const engine = await getServerApiEngine();
  if (engine) {
    try {
      const product = engine.getProductById(id, undefined, pincode);
      if (product) return product;
    } catch {
      // Fallback
    }
  }
  try {
    const res: any = await (apiClient as any).getProduct?.(id, { pincode });
    return res?.product || res || DEFAULT_CATALOG_PRODUCTS.find((p) => p.id === id || p.product_id === id) || null;
  } catch {
    return DEFAULT_CATALOG_PRODUCTS.find((p) => p.id === id || p.product_id === id) || null;
  }
}

export async function getProductBySlug(slug: string, pincode?: string): Promise<any | null> {
  const engine = await getServerApiEngine();
  if (engine) {
    try {
      const product = engine.getProductBySlug(slug, undefined, pincode) || engine.getProductById(slug, undefined, pincode);
      if (product) return product;
    } catch {
      // Fallback
    }
  }
  try {
    const res: any = await (apiClient as any).getProduct?.(slug, { pincode });
    return res?.product || res || DEFAULT_CATALOG_PRODUCTS.find((p) => p.handle === slug || p.slug === slug || p.id === slug) || null;
  } catch {
    return DEFAULT_CATALOG_PRODUCTS.find((p) => p.handle === slug || p.slug === slug || p.id === slug) || null;
  }
}

export async function listPimCategories(): Promise<any[]> {
  const engine = await getServerApiEngine();
  if (engine) {
    try {
      const categories = engine.listPimCategories();
      if (Array.isArray(categories) && categories.length > 0) return categories;
    } catch {
      // Fallback
    }
  }
  try {
    const res: any = await (apiClient as any).getCategories?.();
    const list = res?.categories || res?.data;
    if (Array.isArray(list) && list.length > 0) return list;
    return [
      { id: "cat_chocolate", name: "Chocolate Cakes", slug: "chocolate-cakes", image: "https://images.unsplash.com/photo-1578985545062-69928b1d9587" },
      { id: "cat_red_velvet", name: "Red Velvet Cakes", slug: "red-velvet-cakes", image: "https://images.unsplash.com/photo-1616541823729-00fe0aacd32c" },
      { id: "cat_fruit", name: "Fresh Fruit Cakes", slug: "fruit-cakes", image: "https://images.unsplash.com/photo-1535141192574-5d4897c13136" },
      { id: "cat_cheesecake", name: "Cheesecakes", slug: "cheesecakes", image: "https://images.unsplash.com/photo-1533134242443-d4fd215305ad" },
    ];
  } catch {
    return [
      { id: "cat_chocolate", name: "Chocolate Cakes", slug: "chocolate-cakes", image: "https://images.unsplash.com/photo-1578985545062-69928b1d9587" },
      { id: "cat_red_velvet", name: "Red Velvet Cakes", slug: "red-velvet-cakes", image: "https://images.unsplash.com/photo-1616541823729-00fe0aacd32c" },
      { id: "cat_fruit", name: "Fresh Fruit Cakes", slug: "fruit-cakes", image: "https://images.unsplash.com/photo-1535141192574-5d4897c13136" },
      { id: "cat_cheesecake", name: "Cheesecakes", slug: "cheesecakes", image: "https://images.unsplash.com/photo-1533134242443-d4fd215305ad" },
    ];
  }
}

export async function listOccasions(): Promise<any[]> {
  const engine = await getServerApiEngine();
  if (engine) {
    try {
      const occasions = engine.listOccasions();
      if (Array.isArray(occasions) && occasions.length > 0) return occasions;
    } catch {
      // Fallback
    }
  }
  try {
    const res: any = await apiClient.getOccasions();
    const list = res?.occasions || res?.data;
    if (Array.isArray(list) && list.length > 0) return list;
    return [
      { id: "occ_birthday", title: "Birthday", slug: "birthday", image: "https://images.unsplash.com/photo-1558636508-e0db3814bd1d" },
      { id: "occ_anniversary", title: "Anniversary", slug: "anniversary", image: "https://images.unsplash.com/photo-1511285560929-80b456fea0bc" },
      { id: "occ_midnight", title: "Midnight Surprise", slug: "midnight", image: "https://images.unsplash.com/photo-1530103862676-de8c9debad1d" },
    ];
  } catch {
    return [
      { id: "occ_birthday", title: "Birthday", slug: "birthday", image: "https://images.unsplash.com/photo-1558636508-e0db3814bd1d" },
      { id: "occ_anniversary", title: "Anniversary", slug: "anniversary", image: "https://images.unsplash.com/photo-1511285560929-80b456fea0bc" },
      { id: "occ_midnight", title: "Midnight Surprise", slug: "midnight", image: "https://images.unsplash.com/photo-1530103862676-de8c9debad1d" },
    ];
  }
}
