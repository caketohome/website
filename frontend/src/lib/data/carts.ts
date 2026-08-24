/**
 * CakeToHome Storefront Cart Data Layer
 * Connects cart operations to custom /api/v1/cart endpoint.
 */

import { cookies } from "next/headers";
import { ApiEngine } from "../api-engine";
import { apiClient } from "../api-client";

export async function retrieveCart(cartId?: string) {
  const resolvedCartId = cartId || cookies().get("_cth_cart_id")?.value || cookies().get("_medusa_cart_id")?.value;
  
  if (typeof window === "undefined") {
    try {
      const cart = ApiEngine.getCart(resolvedCartId || "cart_guest_100");
      if (cart) {
        return cart;
      }
    } catch {
      // Fallback to apiClient if ApiEngine throws
    }
  }

  try {
    const res = await apiClient.getCart(resolvedCartId);
    return res?.cart || res;
  } catch (err) {
    return {
      id: resolvedCartId || "cart_guest_100",
      items: [],
      subtotal: 0,
      total: 0,
      currency_code: "inr",
    };
  }
}

