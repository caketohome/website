/**
 * CakeToHome Storefront Analytics Data Layer
 *
 * Page views, cake views, add-to-cart and searches are sent to /api/v1/store/track so the team can
 * see who browsed or looked at a cake and left without buying (Cart Recovery → Viewed but didn't buy).
 * Other events are accepted by these helpers but not stored.
 */

const STORED = new Set(["page_view", "product_view", "add_to_cart", "search"]);

export async function trackEvent(eventType: string, payload: Record<string, unknown> = {}): Promise<void> {
  if (typeof window === "undefined" || !STORED.has(eventType)) return;
  try {
    const body = JSON.stringify({ event_type: eventType, payload, path: window.location.pathname });
    // keepalive lets the beacon finish even when the shopper navigates away
    await fetch("/api/v1/store/track", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body,
      keepalive: true,
      credentials: "same-origin",
    });
  } catch {
    // best effort
  }
}

export const trackPageView = (slug: string) => trackEvent("page_view", { slug });
export const trackBannerClick = (bannerId: string, linkUrl: string) => trackEvent("banner_click", { banner_id: bannerId, link_url: linkUrl });
export const trackNavClick = (label: string, location: string, url: string) => trackEvent("nav_click", { label, location, url });
export const trackBlogRead = (slug: string) => trackEvent("blog_read", { slug });
export const trackSearch = (query: string) => trackEvent("search", { query });
export const trackProductView = (productId: string) => trackEvent("product_view", { product_id: productId });
export const trackAddToCart = (productId: string, variantId?: string, quantity?: number) => trackEvent("add_to_cart", { product_id: productId, variant_id: variantId, quantity });
export const trackReviewSubmitted = (productId: string, rating: number) => trackEvent("review_submitted", { product_id: productId, rating });
