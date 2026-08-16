/**
 * CakeToHome Popup & Engagement Manager - Safe Dynamic Template Interpolator
 * Replaces template placeholders (e.g. {{customer_name}}, {{cart_total}}, {{coupon_code}})
 * with sanitized context values without arbitrary code execution or XSS.
 */

import { EngagementContext, PopupOfferConfig } from "./types";

/**
 * Escapes HTML characters to prevent XSS attacks.
 */
export function escapeHtml(str: string): string {
  if (!str || typeof str !== "string") return "";
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

/**
 * Safely renders a template string by replacing {{variable}} placeholders with context values.
 */
export function renderTemplate(
  template: string | undefined | null,
  context: EngagementContext,
  offer?: PopupOfferConfig | null
): string {
  if (!template || typeof template !== "string") return "";

  return template.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_match, key: string) => {
    switch (key.toLowerCase()) {
      case "customer_name":
        return context.customer?.name ? escapeHtml(context.customer.name) : "Valued Customer";

      case "product_name":
        return context.product?.name ? escapeHtml(context.product.name) : "Gourmet Artisan Cake";

      case "product_price":
        return context.product?.price ? `₹${context.product.price}` : "₹599";

      case "cart_item_count":
        return String(context.cart?.itemCount || 0);

      case "cart_total":
        return `₹${context.cart?.total || 0}`;

      case "coupon_code":
        return offer?.couponCode ? escapeHtml(offer.couponCode) : "SWEET10";

      case "coupon_discount":
        return "10% OFF";

      case "coupon_expiry":
        return "Midnight";

      case "city":
      case "city_name":
        return context.customer?.cityId
          ? escapeHtml(context.customer.cityId.replace("city_", "").replace(/_/g, " ").toUpperCase())
          : "your area";

      case "branch_name":
        return context.customer?.branchId
          ? escapeHtml(context.customer.branchId.replace("br_", "").replace(/_/g, " ").toUpperCase())
          : "Local Bakery Hub";

      case "delivery_eta":
        return "60 mins";

      case "delivery_fee":
        return "₹0";

      case "occasion_name":
        return context.product?.occasion ? escapeHtml(context.product.occasion) : "Celebration";

      default:
        return "";
    }
  });
}
