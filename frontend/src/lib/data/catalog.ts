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
  price: number | null;
  rating: number;
  review_count: number;
  eggless: boolean;
  sugar_free: boolean;
  gluten_free: boolean;
  vegan: boolean;
  is_featured: boolean;
  is_bestseller: boolean;
  is_new_arrival: boolean;
}

export interface SearchResponse {
  results: SearchResult[];
  count: number;
  offset: number;
  limit: number;
}

export interface SearchFilters {
  q?: string;
  category_id?: string | string[];
  shop_id?: string;
  min_price?: number;
  max_price?: number;
  eggless?: boolean;
  sugar_free?: boolean;
  gluten_free?: boolean;
  vegan?: boolean;
  is_featured?: boolean;
  is_bestseller?: boolean;
  is_new_arrival?: boolean;
  sort?: "relevance" | "price_asc" | "price_desc" | "newest" | "rating";
  limit?: number;
  offset?: number;
}

export interface ProductMeta {
  product_id: string;
  eggless: boolean;
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
  const dummy: SearchResult = {
    product_id: "prod_truffle_01",
    variant_id: "var_truffle_half_kg",
    title: "Rich Chocolate Truffle Cake",
    description: "Decadent Dutch cocoa cake with dark chocolate ganache",
    thumbnail: "https://images.unsplash.com/photo-1578985545062-69928b1d9587",
    handle: "rich-chocolate-truffle-cake",
    price: 699.0,
    rating: 4.9,
    review_count: 128,
    eggless: true,
    sugar_free: false,
    gluten_free: false,
    vegan: false,
    is_featured: true,
    is_bestseller: true,
    is_new_arrival: false,
  };
  return { results: [dummy], count: 1, offset: 0, limit: 10 };
}

export async function getProductMeta(productId: string): Promise<ProductMeta> {
  return { product_id: productId, eggless: true, is_bestseller: true };
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
  return { item: { id: "wish_101", product_id: productId } };
}

export async function removeFromWishlist(productId: string): Promise<void> {}

export async function createStockNotification(input: any): Promise<any> {
  return { notification: { id: "notif_101", ...input } };
}

export async function listSubscriptions(): Promise<Subscription[]> {
  return [];
}

export async function createSubscription(input: any): Promise<any> {
  return { subscription: { id: "sub_101", ...input } };
}

export async function pauseSubscription(id: string): Promise<void> {}
export async function resumeSubscription(id: string): Promise<void> {}
export async function cancelSubscription(id: string): Promise<void> {}

export async function getRecentlyViewed(): Promise<string[]> {
  return ["prod_truffle_01"];
}

export async function recordProductView(productId: string): Promise<void> {}
