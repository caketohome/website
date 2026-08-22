"use server";

import {
  pauseSubscription,
  resumeSubscription,
  cancelSubscription,
  addToWishlist,
  removeFromWishlist,
  listWishlist,
  submitReview,
  createStockNotification,
  createSubscription,
  searchProducts,
} from "../data/catalog";
import type { SearchFilters, SearchResponse } from "../data/catalog";

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

export async function submitReviewAction(
  productId: string,
  input: {
    rating: number;
    title?: string;
    body?: string;
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
  const { getCatalogFilterOptions } = await import("../data/catalog");
  return getCatalogFilterOptions();
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
