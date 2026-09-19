"use server";

import {
  pauseSubscription,
  resumeSubscription,
  cancelSubscription,
  addToWishlist,
  removeFromWishlist,
  listWishlist,
  listProductReviews,
  submitReview,
  createStockNotification,
  createSubscription,
  searchProducts,
  getCatalogFilterOptions,
} from "../data/catalog";
import type { SearchFilters, SearchResponse, SearchResult } from "../data/catalog";
import { ProductRepository } from "../repositories/product.repository";

export async function pauseSubscriptionAction(id: string) {
  return pauseSubscription(id);
}

export async function resumeSubscriptionAction(id: string) {
  return resumeSubscription(id);
}

export async function cancelSubscriptionAction(id: string) {
  return cancelSubscription(id);
}

export async function listWishlistAction() {
  return listWishlist();
}

export async function addToWishlistAction(productId: string) {
  return addToWishlist(productId);
}

export async function removeFromWishlistAction(productId: string) {
  return removeFromWishlist(productId);
}

export async function listProductReviewsAction(
  productId: string,
  options?: { page?: number; pageSize?: number; sort?: "recent" | "highest" | "lowest" | "helpful"; ratingFilter?: number; verifiedOnly?: boolean }
) {
  return listProductReviews(productId, options);
}

export async function submitReviewAction(
  productId: string,
  input: {
    orderId?: string;
    rating: number;
    title: string;
    reviewText?: string;
    body?: string;
    comment?: string;
    images?: string[];
  }
) {
  return submitReview(productId, input);
}

export async function createStockNotificationAction(input: {
  product_id: string;
  variant_id?: string;
  email?: string;
  phone?: string;
}) {
  return createStockNotification(input);
}

export async function createSubscriptionAction(input: {
  product_id: string;
  variant_id?: string;
  frequency?: "weekly" | "fortnightly" | "monthly" | "custom";
  quantity?: number;
  next_date: string;
  max_deliveries?: number | null;
}) {
  return createSubscription(input);
}

export async function searchProductsAction(filters: SearchFilters = {}): Promise<SearchResponse> {
  try {
    return await searchProducts(filters);
  } catch (err: any) {
    console.error("searchProductsAction error:", err);
    return { results: [], count: 0, offset: 0, limit: filters.limit || 20 };
  }
}

export async function getCatalogFilterOptionsAction() {
  return getCatalogFilterOptions();
}

export async function getCompareProductsAction(ids: string[]): Promise<SearchResult[]> {
  if (!ids || ids.length === 0) return [];
  try {
    const products = await ProductRepository.findByIds(ids);
    return products.map((p) => ({
      product_id: p.id || p.product_id || "",
      variant_id: `var_${p.id || p.product_id}`,
      title: p.title || p.name || "Gourmet Cake",
      description: p.description || p.short_description || "",
      thumbnail: p.thumbnail || (Array.isArray(p.gallery) && p.gallery[0]) || "/images/placeholder-cake.jpg",
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
      branch_status: "AVAILABLE",
      is_out_of_stock_at_branch: false,
      primary_category_id: p.primary_category_id,
      category: p.category || "",
      category_slug: p.category_slug || "",
      category_ids: p.category_ids || [],
      categories: [],
      flavour: p.flavour || "",
      weight: p.weight || "1 kg",
    }));
  } catch (err: any) {
    console.error("getCompareProductsAction error:", err);
    return [];
  }
}

export async function revalidateProductAction(productHandle?: string, productId?: string) {
  try {
    const { revalidatePath, revalidateTag } = await import("next/cache");
    if (productHandle) revalidatePath(`/products/${productHandle}`);
    if (productId) revalidateTag(`product-${productId}`);
    revalidateTag("products");
    return { success: true };
  } catch (e: any) {
    console.warn("Revalidation warning:", e.message);
    return { success: false, error: e.message };
  }
}
