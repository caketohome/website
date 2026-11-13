/**
 * CakeToHome Storefront Catalog & Search Data Layer
 * Connects product catalog, search, and reviews to custom NestJS Core API (/api/v1/products).
 */

import { apiClient } from "../api-client";
import { ProductRepository } from "../repositories/product.repository";
import { BranchRepository } from "../repositories/branch.repository";
import { OfferRepository } from "../repositories/offer.repository";
import { InventoryService } from "../services/inventory.service";

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

export interface CategoryOption {
  id: string;
  name: string;
  slug: string;
  product_count?: number;
}


export function getCategoryPlaceholder(category?: string | null, merchandise_type?: string | null): string {
  const cat = String(category || "").toLowerCase();
  const merch = String(merchandise_type || "").toLowerCase();
  const isAccessory = 
    merch === "accessory" ||
    merch === "merchandise" ||
    merch === "packaging" ||
    cat.includes("accessory") ||
    cat.includes("accessories") ||
    cat.includes("topper") ||
    cat.includes("candle") ||
    cat.includes("card") ||
    cat.includes("party") ||
    cat.includes("balloon") ||
    cat.includes("flower") ||
    cat.includes("plush") ||
    cat.includes("toy") ||
    cat.includes("hamper");

  return isAccessory ? "/images/placeholder-accessory.svg" : "/images/placeholder-cake.jpg";
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
  occasion?: string;
  occasion_id?: string;
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
  const limit = filters.limit || 48;
  const offset = filters.offset || 0;

  // Authoritative Server Data Path: Query PostgreSQL directly
  if (typeof window === "undefined") {
    try {
      const categoryVal = filters.category || (Array.isArray(filters.category_id) ? filters.category_id[0] : filters.category_id);
      const page = Math.floor(offset / limit) + 1;

      const paginated = await ProductRepository.listProducts({
        page,
        pageSize: limit,
        limit,
        offset,
        category_id: categoryVal,
        occasion: filters.occasion || filters.occasion_id,
        q: filters.q,
        flavour: filters.flavour,
        min_price: filters.min_price,
        max_price: filters.max_price,
        sort: filters.sort,
      });

      let mappedResults: SearchResult[] = paginated.items.map((p: any) => ({
        product_id: p.id || p.product_id,
        variant_id: p.variant_id || `var_${p.id || p.product_id}`,
        title: p.title || p.name || "Gourmet Cake",
        description: p.description || p.short_description || "",
        thumbnail: p.thumbnail || getCategoryPlaceholder(p.category || (p.categories && p.categories[0]?.name), p.merchandise_type),
        handle: p.handle || p.slug || "cake",
        price: Math.max(0, Number(p.price || p.selling_price) || 0),
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
        category: p.category || "",
        category_slug: p.category_slug || "",
        category_ids: p.category_ids || [],
        categories: p.categories || [],
        flavour: p.flavour || "",
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
      if (filters.weight && filters.weight !== "all") {
        const targetW = String(filters.weight).toLowerCase().trim();
        mappedResults = mappedResults.filter((p) => {
          const pw = String(p.weight || "").toLowerCase().trim();
          return pw === targetW || pw.includes(targetW) || targetW.includes(pw);
        });
      }

      return {
        results: mappedResults,
        count: paginated.total,
        offset,
        limit,
      };
    } catch (err) {
      console.error("[searchProducts ProductRepository Error]:", err);
      return {
        results: [],
        count: 0,
        offset,
        limit,
      };
    }
  }

  try {
    const categoryVal = filters.category || (Array.isArray(filters.category_id) ? filters.category_id[0] : filters.category_id);
    const engine = await getServerApiEngine();
    if (engine?.ensureHydrated) {
      await engine.ensureHydrated();
    }
    const searchRes = engine?.searchProducts ? engine.searchProducts({
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
    }) : { products: [], total: 0, offset: 0, limit: 20, categories: [], flavours: [], facets: {}, suggestions: [] };

    let mappedResults: SearchResult[] = (searchRes.products || []).map((p: any) => ({
      product_id: p.id || p.product_id,
      variant_id: p.variant_id || `var_${p.id || p.product_id}`,
      title: p.title || p.name || "Gourmet Cake",
      description: p.description || p.short_description || "",
      thumbnail: p.thumbnail || p.image || p.image_url || (Array.isArray(p.images) && p.images[0]) || (Array.isArray(p.gallery) && p.gallery[0]) || getCategoryPlaceholder(p.category || (p.categories && p.categories[0]?.name), p.merchandise_type),
      handle: p.handle || p.slug || "cake",
      price: Math.max(0, Number(p.price || p.selling_price) || 0),
      rating: Number(p.rating) || 0,
      review_count: Number(p.review_count) || 0,
      sugar_free: Boolean(p.sugar_free),
      gluten_free: Boolean(p.gluten_free),
      vegan: Boolean(p.vegan),
      is_featured: Boolean(p.is_featured),
      is_bestseller: Boolean(p.is_bestseller),
      is_new_arrival: Boolean(p.is_new_arrival),
      branch_status: p.branch_status || "AVAILABLE",
      is_out_of_stock_at_branch: Boolean(p.is_out_of_stock_at_branch),
      primary_category_id: p.primary_category_id,
      category: p.category || (p.categories && p.categories[0]?.name) || "",
      category_slug: p.category_slug || (p.category ? p.category.toLowerCase().replace(/[^a-z0-9]+/g, "-") : (p.categories && p.categories[0]?.slug) || ""),
      category_ids: p.category_ids || [],
      categories: p.categories || [],
      flavour: p.flavour || p.flavour_name || p.cake_base || "",
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
    let validProducts: any[] = [];

    if (typeof window === "undefined") {
      const [cats, prods] = await Promise.all([
        listPimCategories(),
        listProducts(),
      ]);
      categoriesList = cats.map((c: any) => ({
        id: c.id,
        name: c.name,
        slug: c.slug,
        product_count: typeof c.product_count === "number" ? c.product_count : 0,
      }));
      validProducts = (prods || []).filter((p: any) => {
        const titleLower = (p.title || p.name || "").toLowerCase();
        return (
          !titleLower.startsWith("api test") &&
          !titleLower.startsWith("test cake") &&
          !titleLower.startsWith("e2e special") &&
          !titleLower.startsWith("empirical cake") &&
          !titleLower.startsWith("header verification")
        );
      });
    } else {
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

      const rawList = prodRes?.products || prodRes?.results || prodRes?.data || [];
      validProducts = rawList.filter((p: any) => {
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

    const flavoursSet = new Set<string>();
    const weightsSet = new Set<string>();
    let minPrice = Infinity;
    let maxPrice = -Infinity;

    validProducts.forEach((p: any) => {
      if (p.flavour) {
        const fStr = typeof p.flavour === "object" ? (p.flavour.name || p.flavour.flavour || "") : String(p.flavour).trim();
        if (fStr) flavoursSet.add(fStr);
      }
      if (p.weight != null) {
        const rawW = typeof p.weight === "object" ? (p.weight.weight_name || p.weight.name || "") : p.weight;
        const num = Number(rawW);
        if (!isNaN(num) && typeof rawW !== "string") {
          weightsSet.add(num < 50 ? `${num} kg` : `${num} g`);
        } else if (rawW) {
          weightsSet.add(String(rawW).trim());
        }
      }
      if (Array.isArray(p.weight_prices)) {
        p.weight_prices.forEach((wp: any) => {
          if (wp?.weight_name && typeof wp.weight_name === "string") {
            weightsSet.add(wp.weight_name.trim());
          }
        });
      }
      const pPrice = Number(p.price || p.selling_price || 0);
      if (pPrice > 0) {
        if (pPrice < minPrice) minPrice = pPrice;
        if (pPrice > maxPrice) maxPrice = pPrice;
      }
    });

    const sortedWeights = Array.from(weightsSet).sort((a, b) => {
      const numA = parseFloat(a) || 0;
      const numB = parseFloat(b) || 0;
      return numA - numB;
    });

    return {
      categories: categoriesList,
      flavours: Array.from(flavoursSet).sort(),
      weights: sortedWeights,
      minPrice: isFinite(minPrice) ? minPrice : 0,
      maxPrice: isFinite(maxPrice) ? maxPrice : 0,
    };
  } catch (err) {
    console.error("[getCatalogFilterOptions Error]", err);
    return {
      categories: [],
      flavours: [],
      weights: [],
      minPrice: 0,
      maxPrice: 0,
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
  if (typeof window === "undefined") {
    try {
      const { ReviewRepository } = await import("../repositories/review.repository");
      const reviews = await ReviewRepository.findByProductId(productId, options);
      return { reviews, total: reviews.length };
    } catch {
      return { reviews: [], total: 0 };
    }
  }
  const engine = await getServerApiEngine();
  return engine?.getProductReviews ? engine.getProductReviews(productId, options) : { reviews: [], total: 0 };
}

export async function submitReview(
  productId: string,
  input: { orderId?: string; rating: number; title: string; reviewText?: string; body?: string; comment?: string }
): Promise<any> {
  const customerUid = await getAuthenticatedCustomerUid();
  if (!customerUid) {
    return { success: false, error: "Authentication required to submit review", statusCode: 401 };
  }
  if (typeof window === "undefined") {
    try {
      const { ReviewRepository } = await import("../repositories/review.repository");
      await ReviewRepository.save({
        product_id: productId,
        customer_uid: customerUid,
        order_id: input.orderId || null,
        rating: input.rating,
        title: input.title,
        review_text: input.reviewText || input.body || input.comment || "",
      });
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err?.message || "Failed to save review" };
    }
  }
  const engine = await getServerApiEngine();
  return engine?.submitProductReview ? engine.submitProductReview(customerUid, {
    productId,
    orderId: input.orderId,
    rating: input.rating,
    title: input.title,
    reviewText: input.reviewText || input.body || input.comment || "",
  }) : { success: false, error: "Service unavailable" };
}

export async function getAuthenticatedCustomerUid(): Promise<string | null> {
  try {
    const { retrieveSession } = await import("./sessions");
    const { verifyAuthToken } = await import("../security/auth-session");
    const token = retrieveSession();
    const session = token ? verifyAuthToken(token) : null;
    return session?.customerUid || null; // never from client-set cookies
  } catch {
    return null;
  }
}

export async function listWishlist(): Promise<WishlistItem[]> {
  const customerUid = await getAuthenticatedCustomerUid();
  if (!customerUid) return [];
  if (typeof window === "undefined") {
    try {
      const { FavoriteRepository } = await import("../repositories/favorite.repository");
      const { ProductRepository } = await import("../repositories/product.repository");
      const favs = await FavoriteRepository.findByCustomerUid(customerUid);
      const items: WishlistItem[] = [];
      for (const f of favs) {
        const prod = await ProductRepository.findById(f.product_id);
        if (prod) {
          items.push({
            id: f.id,
            product_id: f.product_id,
            title: prod.title || "Cake",
            name: prod.title || "Cake",
            thumbnail: prod.thumbnail || null,
            price: prod.price || 0,
            selling_price: prod.selling_price || prod.price || 0,
            mrp: prod.mrp || 0,
            rating: prod.rating || 4.9,
            review_count: prod.review_count || 0,
            category: prod.category || "Cakes",
            category_slug: prod.category_slug || "cakes",
            weight: prod.weight || "1 kg",
            variant_id: (prod as any).variants?.[0]?.id || `wp_${f.product_id}_default`,
            weight_prices: (prod as any).variants || [],
            is_available: (prod as any).is_available !== false,
            created_at: f.created_at,
          });
        }
      }
      return items;
    } catch {
      return [];
    }
  }
  const engine = await getServerApiEngine();
  const favs = engine?.getCustomerFavorites ? engine.getCustomerFavorites(customerUid) : [];
  return (favs || []).map((f: any) => ({
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
  if (typeof window === "undefined") {
    try {
      const { FavoriteRepository } = await import("../repositories/favorite.repository");
      await FavoriteRepository.save({ customer_uid: customerUid, product_id: productId } as any);
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err?.message };
    }
  }
  const engine = await getServerApiEngine();
  return engine?.addCustomerFavorite ? engine.addCustomerFavorite(customerUid, productId) : { success: false };
}

export async function removeFromWishlist(productId: string): Promise<any> {
  const customerUid = await getAuthenticatedCustomerUid();
  if (!customerUid) {
    return { success: false, error: "UNAUTHORIZED", message: "Please log in to manage your Favorites.", statusCode: 401 };
  }
  if (typeof window === "undefined") {
    try {
      const { FavoriteRepository } = await import("../repositories/favorite.repository");
      await FavoriteRepository.delete(customerUid, productId);
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err?.message };
    }
  }
  const engine = await getServerApiEngine();
  return engine?.removeCustomerFavorite ? engine.removeCustomerFavorite(customerUid, productId) : { success: false };
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

export const DEFAULT_CATALOG_PRODUCTS: any[] = [];

export async function listPublicOffers(): Promise<any[]> {
  if (typeof window === "undefined") {
    try {
      const offers = await OfferRepository.findAll();
      const now = new Date();
      return offers
        .filter((o) => {
          if (!o.is_active || o.status === "inactive") return false;
          if (o.starts_at && new Date(o.starts_at) > now) return false;
          if (o.ends_at && new Date(o.ends_at) < now) return false;
          return true;
        })
        .map((o, idx) => {
          const bgs = [
            "from-rose-500 to-pink-600",
            "from-amber-500 to-orange-600",
            "from-purple-600 to-indigo-600",
            "from-emerald-500 to-teal-600",
          ];
          return {
            id: o.id,
            code: o.code,
            title: o.name || `Special Offer ${o.code}`,
            desc: o.description || (o.min_order ? `On orders above ₹${o.min_order}` : "Special discount on select cakes"),
            discount_type: o.discount_type || o.type,
            discount_value: o.discount_value,
            min_order: o.min_order,
            bg: bgs[idx % bgs.length],
          };
        });
    } catch (err) {
      console.error("[listPublicOffers Error]", err);
      return [];
    }
  }
  return [];
}

export async function listProducts(options?: { branchId?: string; pincode?: string }): Promise<any[]> {
  // Authoritative PostgreSQL Data Layer (Server Component path)
  if (typeof window === "undefined") {
    try {
      const products = await ProductRepository.findAll(100);

      let targetBranchId = options?.branchId;
      if (!targetBranchId && options?.pincode) {
        try {
          const resolved = await BranchRepository.findByPincode(options.pincode);
          if (resolved) {
            targetBranchId = resolved.id;
          }
        } catch {}
      }

      let stockMap = new Map<string, number>();
      if (targetBranchId && products.length > 0) {
        try {
          const productIds = products.map((p: any) => p.id || p.product_id);
          stockMap = await InventoryService.getBatchStock(targetBranchId, productIds);
        } catch (err) {
          console.error("[listProducts Inventory Error]", err);
        }
      }

      return products.map((p: any) => {
        const prodId = p.id || p.product_id;
        const stock = stockMap.get(prodId);
        const hasStockData = targetBranchId ? stockMap.has(prodId) : false;
        const isOos = hasStockData && stock !== undefined && stock <= 0;

        return {
          id: prodId,
          product_id: prodId,
          title: p.title || p.name || "Gourmet Cake",
          name: p.title || p.name || "Gourmet Cake",
          handle: p.handle || p.slug || prodId,
          slug: p.slug || p.handle || prodId,
          description: p.description || "",
          short_description: p.short_description || p.description || "",
          thumbnail: p.thumbnail || (Array.isArray(p.gallery) && p.gallery[0]) || "/images/placeholder-cake.jpg",
          image: p.thumbnail || (Array.isArray(p.gallery) && p.gallery[0]) || "/images/placeholder-cake.jpg",
          images: p.gallery && p.gallery.length > 0 ? p.gallery : [p.thumbnail || "/images/placeholder-cake.jpg"],
          gallery: p.gallery || [],
          price: Math.max(0, Number(p.selling_price || p.price) || 599),
          selling_price: Math.max(0, Number(p.selling_price || p.price) || 599),
          mrp: Math.max(0, Number(p.mrp) || 799),
          cost_price: Math.max(0, Number(p.cost_price) || 350),
          rating: Number(p.rating) || 4.9,
          review_count: Number(p.review_count) || 12,
          category: p.category || "Cakes",
          category_slug: p.category_slug || "cakes",
          primary_category_id: p.primary_category_id || "cat_chocolate",
          category_ids: p.category_ids || [],
          flavour: p.flavour || "Chocolate",
          weight: p.weight || "1 kg",
          weight_prices: p.weight_prices || [],
          variants: p.weight_prices || [],
          variant_id: p.weight_prices?.[0]?.id || `wp_${prodId}_default`,
          is_featured: Boolean(p.is_featured),
          is_bestseller: Boolean(p.is_bestseller),
          is_new_arrival: Boolean(p.is_new_arrival),
          sugar_free: Boolean(p.sugar_free),
          gluten_free: Boolean(p.gluten_free),
          vegan: Boolean(p.vegan),
          branch_status: isOos ? "OUT_OF_STOCK" : "AVAILABLE",
          is_out_of_stock_at_branch: isOos,
          status: p.status || "published",
        };
      });
    } catch (err) {
      console.error("[listProducts ProductRepository Error]:", err);
      return [];
    }
  }

  // Client-side fallback to API Client
  try {
    const res: any = await apiClient.getProducts(options);
    const rawList = res?.products || res?.results || res?.data;
    if (Array.isArray(rawList)) {
      return rawList;
    }
    return [];
  } catch {
    return [];
  }
}

export async function getProductById(id: string, pincode?: string): Promise<any | null> {
  // Authoritative PostgreSQL Data Layer
  if (typeof window === "undefined") {
    try {
      const product = await ProductRepository.findById(id);
      if (!product) return null;

      let isOos = false;
      if (pincode) {
        try {
          const resolved = await BranchRepository.findByPincode(pincode);
          if (resolved) {
            const stockMap = await InventoryService.getBatchStock(resolved.id, [product.id]);
            const stock = stockMap.get(product.id);
            if (stock !== undefined && stock <= 0) {
              isOos = true;
            }
          }
        } catch {}
      }

      return {
        ...product,
        branch_status: isOos ? "OUT_OF_STOCK" : "AVAILABLE",
        is_out_of_stock_at_branch: isOos,
      };
    } catch (err) {
      console.error("[getProductById ProductRepository Error]:", err);
      return null;
    }
  }

  try {
    const res: any = await (apiClient as any).getProduct?.(id, { pincode });
    return res?.product || res || null;
  } catch {
    return null;
  }
}

export async function getProductBySlug(slug: string, pincode?: string): Promise<any | null> {
  // Authoritative PostgreSQL Data Layer
  if (typeof window === "undefined") {
    try {
      const product = await ProductRepository.findBySlug(slug);
      if (!product) return null;

      let isOos = false;
      if (pincode) {
        try {
          const resolved = await BranchRepository.findByPincode(pincode);
          if (resolved) {
            const stockMap = await InventoryService.getBatchStock(resolved.id, [product.id]);
            const stock = stockMap.get(product.id);
            if (stock !== undefined && stock <= 0) {
              isOos = true;
            }
          }
        } catch {}
      }

      return {
        ...product,
        branch_status: isOos ? "OUT_OF_STOCK" : "AVAILABLE",
        is_out_of_stock_at_branch: isOos,
      };
    } catch (err) {
      console.error("[getProductBySlug ProductRepository Error]", err);
    }
  }

  try {
    const res: any = await (apiClient as any).getProduct?.(slug, { pincode });
    return res?.product || res || null;
  } catch {
    return null;
  }
}

export async function listPimCategories(): Promise<any[]> {
  // Authoritative PostgreSQL Data Layer
  if (typeof window === "undefined") {
    try {
      const { dbQuery } = await import("../db");
      let res: any = { rows: [] };
      try {
        res = await dbQuery(`
          SELECT 
            pc.id,
            pc.name,
            pc.handle as slug,
            COALESCE(pc.metadata->>'image', 'https://images.unsplash.com/photo-1578985545062-69928b1d9587') as image,
            COALESCE(pc.metadata->>'icon', 'cake') as icon,
            COALESCE(pc.metadata->>'color', 'bg-rose-50 border-rose-200 text-rose-900') as color,
            COUNT(p.id)::int as product_count
          FROM product_category pc
          LEFT JOIN product_category_product pcp ON pcp.product_category_id = pc.id
          LEFT JOIN product p ON (p.id = pcp.product_id OR p.metadata->>'primary_category_id' = pc.id OR p.metadata->>'category_slug' = pc.handle) AND p.deleted_at IS NULL
          WHERE pc.deleted_at IS NULL
          GROUP BY pc.id, pc.name, pc.handle, pc.metadata
          ORDER BY product_count DESC, pc.name ASC
        `);
      } catch {
        res = { rows: [] };
      }

      if (res.rows && res.rows.length > 0) {
        return res.rows.map((r: any) => ({
          id: r.id,
          name: r.name,
          slug: r.slug,
          image: r.image,
          icon: r.icon === 'cake' ? '🎂' : (r.icon || '🎂'),
          color: r.color,
          product_count: Number(r.product_count) || 0,
          count: `${Number(r.product_count) || 0} items`,
        }));
      }

      // If product_category table is empty, dynamically derive from product metadata in PostgreSQL
      const derived = await dbQuery(`
        SELECT 
          COALESCE(metadata->>'category', 'Artisanal Cakes') as name,
          COALESCE(metadata->>'category_slug', 'cakes') as slug,
          COALESCE(metadata->>'primary_category_id', 'cat_' || LOWER(REGEXP_REPLACE(metadata->>'category', '[^a-zA-Z0-9]+', '_', 'g'))) as id,
          COUNT(*)::int as product_count,
          COALESCE(
            MAX(metadata->>'thumbnail'), 
            MAX(metadata->>'image'),
            MAX(metadata->>'banner_url')
          ) as sample_image
        FROM product 
        WHERE deleted_at IS NULL
        GROUP BY 1, 2, 3
        ORDER BY product_count DESC
      `);

      return (derived.rows || []).map((r: any) => {
        const slug = String(r.slug || "").toLowerCase();
        const id = String(r.id || "").toLowerCase();
        const name = String(r.name || "").toLowerCase();

        let icon = "🎂";
        let color = "bg-rose-50 border-rose-200 text-rose-900";
        let fallbackImage = "https://images.unsplash.com/photo-1578985545062-69928b1d9587?auto=format&fit=crop&q=80&w=800";

        if (slug.includes("accessories") || id.includes("accessories") || name.includes("accessories")) {
          icon = "🎉";
          color = "bg-amber-50 border-amber-200 text-amber-900";
          fallbackImage = "/images/gold-acrylic-topper.jpg";
        } else if (slug.includes("bouquet") || id.includes("bouquet") || name.includes("flower")) {
          icon = "💐";
          color = "bg-emerald-50 border-emerald-200 text-emerald-900";
          fallbackImage = "https://images.unsplash.com/photo-1561181286-d3fee7d55364?auto=format&fit=crop&q=80&w=800";
        } else if (slug.includes("cupcake") || id.includes("cupcake") || name.includes("cupcake")) {
          icon = "🧁";
          color = "bg-pink-50 border-pink-200 text-pink-900";
          fallbackImage = "https://images.unsplash.com/photo-1576618148400-f54bed99fcfd?auto=format&fit=crop&q=80&w=800";
        } else if (slug.includes("pastr") || id.includes("pastr") || name.includes("pastr")) {
          icon = "🥐";
          color = "bg-orange-50 border-orange-200 text-orange-900";
          fallbackImage = "https://images.unsplash.com/photo-1555507036-ab1f4038808a?auto=format&fit=crop&q=80&w=800";
        } else if (slug.includes("chocolate") || name.includes("chocolate")) {
          icon = "🍫";
          color = "bg-amber-900/10 border-amber-800/20 text-amber-950";
          fallbackImage = "https://images.unsplash.com/photo-1606313564200-e75d5e30476c?auto=format&fit=crop&q=80&w=800";
        }

        const chosenImage = r.sample_image || fallbackImage;

        return {
          id: r.id,
          name: r.name,
          slug: r.slug,
          image: chosenImage,
          image_url: chosenImage,
          banner_url: chosenImage,
          icon,
          color,
          product_count: Number(r.product_count) || 0,
          count: `${Number(r.product_count) || 0} items`,
        };
      });
    } catch (err) {
      console.error("[listPimCategories PostgreSQL Error]", err);
    }
  }

  try {
    const res: any = await (apiClient as any).getCategories?.();
    const list = res?.categories || res?.data;
    if (Array.isArray(list) && list.length > 0) return list;
    return [];
  } catch {
    return [];
  }
}

export async function listOccasions(): Promise<any[]> {
  // Authoritative PostgreSQL Data Layer
  if (typeof window === "undefined") {
    try {
      const { dbQuery } = await import("../db");
      // Check CMS page for explicit occasion configuration
      const pageRes = await dbQuery(`SELECT published_config, draft_config FROM "cms_page" WHERE id = 'cmspg_home' AND deleted_at IS NULL LIMIT 1`).catch(() => ({ rows: [] }));
      if (pageRes.rows && pageRes.rows.length > 0) {
        let blocks: any = pageRes.rows[0].published_config || pageRes.rows[0].draft_config;
        if (typeof blocks === "string") {
          try { blocks = JSON.parse(blocks); } catch {}
        }
        const sections = blocks?.published_config?.sections || blocks?.sections || [];
        const occSec = sections.find((s: any) => s.type === "occasions_grid" || s.type === "occasion_carousel");
        if (occSec && Array.isArray(occSec.config?.manual_occasions) && occSec.config.manual_occasions.length > 0) {
          return occSec.config.manual_occasions;
        }
      }

      // Extract distinct occasions from PostgreSQL product metadata
      const occRes = await dbQuery(`
        SELECT 
          metadata->>'occasion' as title,
          metadata->>'occasion' as name,
          LOWER(REGEXP_REPLACE(metadata->>'occasion', '[^a-zA-Z0-9]+', '-', 'g')) as slug,
          'occ_' || LOWER(REGEXP_REPLACE(metadata->>'occasion', '[^a-zA-Z0-9]+', '_', 'g')) as id,
          MAX(COALESCE(metadata->>'thumbnail', metadata->>'image')) as image,
          MAX(COALESCE(metadata->>'thumbnail', metadata->>'image')) as cover_image,
          COUNT(*)::int as count
        FROM product
        WHERE metadata->>'occasion' IS NOT NULL 
          AND metadata->>'occasion' != ''
          AND deleted_at IS NULL
        GROUP BY 1, 2, 3, 4
        ORDER BY count DESC
      `);

      if (occRes.rows && occRes.rows.length > 0) {
        return occRes.rows.map((r: any) => ({
          id: r.id,
          title: r.title,
          name: r.name,
          slug: r.slug,
          image: r.image || "https://images.unsplash.com/photo-1558636508-e0db3814bd1d",
          cover_image: r.cover_image || "https://images.unsplash.com/photo-1558636508-e0db3814bd1d",
          icon: "🎂",
          active: true,
          is_active: true,
        }));
      }

      return [];
    } catch (err) {
      console.error("[listOccasions PostgreSQL Error]", err);
    }
  }

  try {
    const res: any = await apiClient.getOccasions();
    const list = res?.occasions || res?.data;
    if (Array.isArray(list) && list.length > 0) return list;
    return [];
  } catch {
    return [];
  }
}
