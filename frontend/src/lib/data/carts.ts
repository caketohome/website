/**
 * CakeToHome Storefront Cart Data Layer
 * Connects cart operations to custom /api/v1/cart endpoint.
 */

import { cookies } from "next/headers";
import { apiClient } from "../api-client";

export async function retrieveCart(cartId?: string) {
  const resolvedCartId = cartId || cookies().get("_cth_cart_id")?.value || cookies().get("_medusa_cart_id")?.value;
  if (!resolvedCartId) {
    return {
      id: "",
      items: [],
      subtotal: 0,
      total: 0,
      currency_code: "inr",
    };
  }
  
  if (typeof window === "undefined") {
    try {
      const { ApiEngine } = await import("../api-engine");
      const cart = ApiEngine.getCart(resolvedCartId);
      if (cart && Array.isArray(cart.items) && cart.items.length > 0) {
        return cart;
      }

      // Check authoritative PostgreSQL database
      const { CartRepository } = await import("../repositories/cart.repository");
      const pgCart = await CartRepository.findCartById(resolvedCartId);
      if (pgCart && Array.isArray(pgCart.items) && pgCart.items.length > 0) {
        ApiEngine.saveCart(pgCart);
        return pgCart;
      }

      if (cart) {
        return cart;
      }
    } catch (err: any) {
      console.warn("[retrieveCart] Server data error:", err.message);
    }
  }

  try {
    const res = await apiClient.getCart(resolvedCartId);
    return res?.cart || res;
  } catch (err) {
    return {
      id: resolvedCartId,
      items: [],
      subtotal: 0,
      total: 0,
      currency_code: "inr",
    };
  }
}

