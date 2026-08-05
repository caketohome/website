/**
 * CakeToHome Storefront Cart Data Layer
 * Connects cart operations to custom NestJS Core API (/api/v1/cart).
 */

import { apiClient } from "../api-client";

export async function retrieveCart(cartId?: string) {
  try {
    const res = await apiClient.getCart(cartId);
    return res?.cart || res;
  } catch (err) {
    return {
      id: cartId || "cart_guest_100",
      items: [],
      subtotal: 0,
      total: 0,
    };
  }
}
