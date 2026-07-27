"use server";

import { revalidateTag } from "next/cache";
import { cookies } from "next/headers";
import { apiClient } from "../api-client";
import { getCacheTag } from "../data/cookies";

export async function createCart(data?: any, shop_id: string = "default_shop"): Promise<any> {
  const cart = {
    id: `cart_${Date.now()}`,
    items: [],
    subtotal: 0,
    total: 0,
  };
  cookies().set("_cth_cart_id", cart.id);
  revalidateTag(getCacheTag("carts"));
  return cart;
}

export async function addToCart(variantId: string, shopId: string = "default_shop", metadata?: Record<string, any>): Promise<any> {
  let cartId = cookies().get("_cth_cart_id")?.value;
  if (!cartId) {
    const cart = await createCart({}, shopId);
    cartId = cart?.id;
  }
  try {
    const result = await apiClient.addToCart({
      cartId: cartId!,
      productId: metadata?.productId || variantId,
      variantId,
      quantity: metadata?.quantity || 1,
      selectedOptions: metadata?.selectedOptions,
    });
    revalidateTag(getCacheTag("carts"));
    return result;
  } catch (e: any) {
    console.warn("Failed to add item via API client, returning local stub:", e.message);
    revalidateTag(getCacheTag("carts"));
    return { id: cartId, variantId, quantity: 1 };
  }
}

export async function removeItemFromCart(lineItemId: string): Promise<void | { message: string }> {
  const cartId = cookies().get("_cth_cart_id")?.value || cookies().get("_medusa_cart_id")?.value;
  if (cartId && lineItemId) {
    try {
      await apiClient.deleteLineItem(cartId, lineItemId);
    } catch (e: any) {
      console.warn("Failed to delete line item via API client, invalidating cache tag", e.message);
    }
  }
  revalidateTag(getCacheTag("carts"));
}

export async function getSavedItems(): Promise<any[]> {
  const cookieVal = cookies().get("_cth_saved_items")?.value;
  if (!cookieVal) return [];
  try {
    return JSON.parse(cookieVal);
  } catch {
    return [];
  }
}

export async function saveItemForLater(lineItemId: string, variantId: string, shopId: string, title: string, thumbnail: string | null, price: number | null): Promise<void> {
  await removeItemFromCart(lineItemId);
  const savedItems = await getSavedItems();
  if (!savedItems.some((item) => item.variant_id === variantId)) {
    savedItems.push({ variant_id: variantId, shop_id: shopId, title, thumbnail, price });
    cookies().set("_cth_saved_items", JSON.stringify(savedItems), { path: "/", maxAge: 60 * 60 * 24 * 30 });
  }
}

export async function moveToCartFromSaved(variantId: string, shopId: string): Promise<void> {
  await addToCart(variantId, shopId);
  const savedItems = await getSavedItems();
  const filtered = savedItems.filter((item) => item.variant_id !== variantId);
  cookies().set("_cth_saved_items", JSON.stringify(filtered), { path: "/", maxAge: 60 * 60 * 24 * 30 });
}
