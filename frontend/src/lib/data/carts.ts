/**
 * CakeToHome Storefront Cart Data Layer
 * Connects cart operations to custom NestJS Core API (/api/v1/cart).
 */

import { apiClient } from "../api-client";

export async function retrieveCart(cartId?: string) {
  try {
    return await apiClient.getCart(cartId);
  } catch (err) {
    return {
      id: cartId || "cart_guest_100",
      items: [],
      subtotal: "0.00",
      total: "0.00",
    };
  }
}
