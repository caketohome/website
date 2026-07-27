/**
 * CakeToHome Storefront Analytics Data Layer
 */

import { apiClient } from "../api-client";

export async function trackEvent(eventType: string, payload: Record<string, unknown> = {}): Promise<void> {
  // Best-effort event tracking
}

export const trackPageView = (slug: string) => trackEvent("page_view", { slug });
export const trackBannerClick = (bannerId: string, linkUrl: string) => trackEvent("banner_click", { banner_id: bannerId, link_url: linkUrl });
export const trackNavClick = (label: string, location: string, url: string) => trackEvent("nav_click", { label, location, url });
export const trackBlogRead = (slug: string) => trackEvent("blog_read", { slug });
export const trackSearch = (query: string) => trackEvent("search", { query });
export const trackProductView = (productId: string) => trackEvent("product_view", { product_id: productId });
export const trackAddToCart = (productId: string, variantId?: string, quantity?: number) => trackEvent("add_to_cart", { product_id: productId, variant_id: variantId, quantity });
export const trackReviewSubmitted = (productId: string, rating: number) => trackEvent("review_submitted", { product_id: productId, rating });
