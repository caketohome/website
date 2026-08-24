/**
 * CakeToHome Storefront Catalog & Search Data Layer
 * Connects product catalog, search, and reviews to custom NestJS Core API (/api/v1/products).
 */

import { apiClient } from "../api-client";
import { ApiEngine } from "../api-engine";

export interface CategoryOption {
  id: string;
  name: string;
  slug: string;
  product_count?: number;
}

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
  category_slug?: string;
  primary_category_id?: string;
  category_ids?: string[];
  categories?: Array<{ id: string; name: string; slug: string; description?: string }>;
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
  categories?: CategoryOption[];
  flavours?: string[];
  facets?: any;
  suggestions?: string[];
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
  categories: CategoryOption[];
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
  title?: string;
  name?: string;
  thumbnail?: string | null;
  price?: number | null;
  selling_price?: number | null;
  mrp?: number | null;
  rating?: number;
  review_count?: number;
  category?: string;
  category_slug?: string;
  weight?: string;
  weight_prices?: any[];
  is_available?: boolean;
  variant_id?: string;
  shop_id?: string;
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
    const categoryVal = filters.category || (Array.isArray(filters.category_id) ? filters.category_id[0] : filters.category_id);
    const searchRes = ApiEngine.searchProducts({
      q: filters.q,
      category: categoryVal,
      flavour: filters.flavour,
      weight: filters.weight,
      min_price: filters.min_price,
      max_price: filters.max_price,
      branchId: filters.shop_id,
      pincode: filters.pincode,
      limit: filters.limit || 48,
      offset: filters.offset || 0,
      sort: filters.sort,
      include_test_products: filters.include_test_products,
    });

    let mappedResults: SearchResult[] = searchRes.products.map((p: any) => ({
      product_id: p.id || p.product_id,
      variant_id: p.variant_id || `var_${p.id || p.product_id}`,
      title: p.title || p.name || "Gourmet Cake",
      description: p.description || p.short_description || "Freshly baked cake.",
      thumbnail: p.thumbnail === "https://images.unsplash.com/photo-1588195538326-c5b1e9f80a1b?auto=format&fit=crop&q=80&w=800"
        ? "https://images.unsplash.com/photo-1588195538326-c5b1e9f80a1b?auto=format&fit=crop&q=80&w=800"
        : (p.thumbnail || p.image_url || "https://images.unsplash.com/photo-1578985545062-69928b1d9587"),
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
      primary_category_id: p.primary_category_id,
      category: p.category || (p.categories && p.categories[0]?.name) || "Chocolate Cakes",
      category_slug: p.category_slug || (p.category ? p.category.toLowerCase().replace(/[^a-z0-9]+/g, "-") : (p.categories && p.categories[0]?.slug) || "chocolate-cakes"),
      category_ids: p.category_ids || [],
      categories: p.categories || [],
      flavour: p.flavour || p.flavour_name || p.cake_base || "Chocolate",
      weight: p.weight || "1 kg",
    }));

    // Dietary Switches
    if (filters.sugar_free !== undefined) {
      mappedResults = mappedResults.filter((p) => Boolean(p.sugar_free) === filters.sugar_free);
    }
    if (filters.gluten_free !== undefined) {
      mappedResults = mappedResults.filter((p) => Boolean(p.gluten_free) === filters.gluten_free);
    }
    if (filters.vegan !== undefined) {
      mappedResults = mappedResults.filter((p) => Boolean(p.vegan) === filters.vegan);
    }

    return {
      results: mappedResults,
      count: searchRes.total,
      offset: searchRes.offset,
      limit: searchRes.limit,
      categories: searchRes.categories,
      flavours: searchRes.flavours,
      facets: searchRes.facets,
      suggestions: searchRes.suggestions,
    };
  } catch (err) {
    console.error("[searchProducts Data Layer Error]", err);
    return { results: [], count: 0, offset: 0, limit: 20 };
  }
}

export async function getCatalogFilterOptions(): Promise<CatalogFilterOptions> {
  try {
    let categoriesList: CategoryOption[] = [];
    let rawList: any[] = [];

    try {
      const cats = ApiEngine.getCategories();
      categoriesList = cats.map((c: any) => ({
        id: c.id,
        name: c.name,
        slug: c.slug,
        product_count: typeof c.product_count === "number" ? c.product_count : 0,
      }));
      rawList = ApiEngine.getProducts();
    } catch {
      categoriesList = [];
      rawList = [];
    }

    if (categoriesList.length === 0 && typeof window !== "undefined") {
      const [catRes, prodRes]: [any, any] = await Promise.all([
        apiClient.getCategories().catch(() => null),
        apiClient.getProducts().catch(() => null),
      ]);

      categoriesList = (catRes?.categories || catRes?.results || []).map((c: any) => ({
        id: c.id,
        name: c.name,
        slug: c.slug,
        product_count: typeof c.product_count === "number" ? c.product_count : 0,
      }));

      rawList = prodRes?.products || prodRes?.results || prodRes?.data || [];
    }
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

    const flavoursSet = new Set<string>();
    const weightsSet = new Set<string>();
    let minPrice = Infinity;
    let maxPrice = -Infinity;

    validProducts.forEach((p: any) => {
      if (p.flavour) flavoursSet.add(p.flavour);
      if (p.weight) weightsSet.add(p.weight);
      const pPrice = Number(p.price || p.selling_price || 0);
      if (pPrice > 0) {
        if (pPrice < minPrice) minPrice = pPrice;
        if (pPrice > maxPrice) maxPrice = pPrice;
      }
    });

    ["Chocolate", "Red Velvet", "Mango", "Black Forest", "Butterscotch"].forEach((f) => flavoursSet.add(f));
    ["0.5 kg", "1 kg", "1.5 kg", "2 kg"].forEach((w) => weightsSet.add(w));

    return {
      categories: categoriesList.length > 0 ? categoriesList : [
        { id: "cat_chocolate", name: "Chocolate Cakes", slug: "chocolate-cakes", product_count: 2 },
        { id: "cat_red_velvet", name: "Red Velvet Cakes", slug: "red-velvet-cakes", product_count: 1 },
        { id: "cat_fruit_mousse", name: "Fruit & Mousse Cakes", slug: "fruit-mousse-cakes", product_count: 1 },
        { id: "cat_black_forest", name: "Black Forest Cakes", slug: "black-forest-cakes", product_count: 1 },
        { id: "cat_butterscotch", name: "Butterscotch & Caramel Cakes", slug: "butterscotch-caramel-cakes", product_count: 1 },
        { id: "cat_cheesecakes", name: "Cheesecakes & Artisanal", slug: "cheesecakes", product_count: 1 },
        { id: "cat_bestsellers", name: "Best Sellers", slug: "bestsellers", product_count: 3 },
      ],
      flavours: Array.from(flavoursSet),
      weights: Array.from(weightsSet),
      minPrice: isFinite(minPrice) ? minPrice : 500,
      maxPrice: isFinite(maxPrice) ? maxPrice : 800,
    };
  } catch {
    return {
      categories: [
        { id: "cat_chocolate", name: "Chocolate Cakes", slug: "chocolate-cakes", product_count: 2 },
        { id: "cat_red_velvet", name: "Red Velvet Cakes", slug: "red-velvet-cakes", product_count: 1 },
        { id: "cat_fruit_mousse", name: "Fruit & Mousse Cakes", slug: "fruit-mousse-cakes", product_count: 1 },
        { id: "cat_black_forest", name: "Black Forest Cakes", slug: "black-forest-cakes", product_count: 1 },
        { id: "cat_butterscotch", name: "Butterscotch & Caramel Cakes", slug: "butterscotch-caramel-cakes", product_count: 1 },
        { id: "cat_cheesecakes", name: "Cheesecakes & Artisanal", slug: "cheesecakes", product_count: 1 },
        { id: "cat_bestsellers", name: "Best Sellers", slug: "bestsellers", product_count: 3 },
      ],
      flavours: ["Chocolate", "Red Velvet", "Mango", "Black Forest", "Butterscotch"],
      weights: ["0.5 kg", "1 kg", "1.5 kg", "2 kg"],
      minPrice: 500,
      maxPrice: 800,
    };
  }
}

export async function getProductMeta(productId: string): Promise<ProductMeta> {
  return { product_id: productId, is_bestseller: true };
}

export async function listProductReviews(
  productId: string,
  options?: { page?: number; pageSize?: number; sort?: "recent" | "highest" | "lowest" | "helpful"; ratingFilter?: number; verifiedOnly?: boolean }
): Promise<any> {
  return ApiEngine.getProductReviews(productId, options);
}

export async function submitReview(
  productId: string,
  input: { orderId?: string; rating: number; title: string; reviewText?: string; body?: string; comment?: string }
): Promise<any> {
  const customerUid = await getAuthenticatedCustomerUid();
  if (!customerUid) {
    return { success: false, error: "Authentication required to submit review", statusCode: 401 };
  }
  return ApiEngine.submitProductReview(customerUid, {
    productId,
    orderId: input.orderId,
    rating: input.rating,
    title: input.title,
    reviewText: input.reviewText || input.body || input.comment || "",
  });
}

export async function getAuthenticatedCustomerUid(): Promise<string | null> {
  try {
    const { cookies } = await import("next/headers");
    const cookieStore = cookies();
    const cookieCustomerUid = cookieStore.get("_cth_customer_uid")?.value;
    const cookieUserId = cookieStore.get("_cth_user_id")?.value;
    const cookiePhone = cookieStore.get("_cth_phone")?.value;
    const cookieRole = cookieStore.get("_cth_role")?.value;

    const resolved = ApiEngine.resolveUserAccount({
      customerUid: cookieCustomerUid,
      userId: cookieUserId,
      phone: cookiePhone,
      role: cookieRole,
    });

    return resolved?.customer_uid || resolved?.id || cookieCustomerUid || null;
  } catch {
    return null;
  }
}

export async function listWishlist(): Promise<WishlistItem[]> {
  const customerUid = await getAuthenticatedCustomerUid();
  if (!customerUid) return [];
  const favs = ApiEngine.getCustomerFavorites(customerUid);
  return favs.map((f: any) => ({
    id: f.id,
    product_id: f.product_id,
    title: f.title || f.name,
    name: f.title || f.name,
    thumbnail: f.thumbnail,
    price: f.price || f.selling_price,
    selling_price: f.selling_price || f.price,
    mrp: f.mrp,
    rating: f.rating,
    review_count: f.review_count,
    category: f.category,
    category_slug: f.category_slug,
    weight: f.weight,
    variant_id: f.weight_prices?.[0]?.weight_id || `wp_${f.product_id}_default`,
    weight_prices: f.weight_prices || [],
    is_available: f.is_available !== false,
    created_at: f.created_at,
  }));
}

export async function addToWishlist(productId: string): Promise<any> {
  const customerUid = await getAuthenticatedCustomerUid();
  if (!customerUid) {
    return { success: false, error: "UNAUTHORIZED", message: "Please log in to save cakes to your Favorites.", statusCode: 401 };
  }
  return ApiEngine.addCustomerFavorite(customerUid, productId);
}

export async function removeFromWishlist(productId: string): Promise<any> {
  const customerUid = await getAuthenticatedCustomerUid();
  if (!customerUid) {
    return { success: false, error: "UNAUTHORIZED", message: "Please log in to manage your Favorites.", statusCode: 401 };
  }
  return ApiEngine.removeCustomerFavorite(customerUid, productId);
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
    thumbnail: "https://images.unsplash.com/photo-1588195538326-c5b1e9f80a1b?auto=format&fit=crop&q=80&w=800",
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
      { id: "cat_fruit", name: "Fresh Fruit Cakes", slug: "fruit-cakes", image: "https://images.unsplash.com/photo-1588195538326-c5b1e9f80a1b" },
      { id: "cat_cheesecake", name: "Cheesecakes", slug: "cheesecakes", image: "https://images.unsplash.com/photo-1533134242443-d4fd215305ad" },
    ];
  } catch {
    return [
      { id: "cat_chocolate", name: "Chocolate Cakes", slug: "chocolate-cakes", image: "https://images.unsplash.com/photo-1578985545062-69928b1d9587" },
      { id: "cat_red_velvet", name: "Red Velvet Cakes", slug: "red-velvet-cakes", image: "https://images.unsplash.com/photo-1616541823729-00fe0aacd32c" },
      { id: "cat_fruit", name: "Fresh Fruit Cakes", slug: "fruit-cakes", image: "https://images.unsplash.com/photo-1588195538326-c5b1e9f80a1b" },
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
