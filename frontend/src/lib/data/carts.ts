/**
 * CakeToHome Storefront Cart Data Layer
 * Connects cart operations to authoritative PostgreSQL CartRepository and /api/v1/cart endpoint.
 */

import { cookies } from "next/headers";
import { apiClient } from "../api-client";

export async function retrieveCart(cartId?: string) {
  const resolvedCartId =
    cartId ||
    cookies().get("_cth_cart_id")?.value ||
    cookies().get("_medusa_cart_id")?.value;
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
      const { CartRepository } = await import("../repositories/cart.repository");
      await ApiEngine.ensureHydrated();

      // 1. Check authoritative PostgreSQL database first
      const pgCart = await CartRepository.findCartById(resolvedCartId);
      if (pgCart) {
        const synced = ApiEngine.syncCartFromDb(pgCart);
        return synced || pgCart;
      }

      // 2. Fallback to in-memory ApiEngine cart if not yet in PostgreSQL
      const cart = ApiEngine.getCart(resolvedCartId);
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
