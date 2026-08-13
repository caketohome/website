"use server";

import { revalidateTag } from "next/cache";
import { cookies } from "next/headers";
import { apiClient } from "../api-client";
import { getCacheTag } from "../data/cookies";

export async function getActiveCartId(): Promise<string | null> {
  const cookieStore = cookies();
  const cthId = cookieStore.get("_cth_cart_id")?.value;
  if (cthId) return cthId;

  // Legacy fallback & migration
  const medusaId = cookieStore.get("_medusa_cart_id")?.value;
  if (medusaId) {
    cookieStore.set("_cth_cart_id", medusaId, { path: "/", maxAge: 60 * 60 * 24 * 30 });
    return medusaId;
  }
  return null;
}

export async function createCart(data?: any, shop_id: string = "default_shop"): Promise<any> {
  const cookieStore = cookies();
  const newCartId = `cart_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
  const cartPayload = {
    id: newCartId,
    shop_id,
    items: [],
    subtotal: 0,
    total: 0,
    currency_code: "inr",
    ...(data || {}),
  };

  try {
    await apiClient.createCart(cartPayload);
  } catch (err: any) {
    console.warn("Failed to create cart on backend API, using local payload:", err.message);
  }

  cookieStore.set("_cth_cart_id", newCartId, { path: "/", maxAge: 60 * 60 * 24 * 30 });
  cookieStore.set("_medusa_cart_id", newCartId, { path: "/", maxAge: 60 * 60 * 24 * 30 });
  revalidateTag(getCacheTag("carts"));
  return cartPayload;
}

export async function addToCart(variantId: string, shopId: string = "default_shop", metadata?: Record<string, any>): Promise<any> {
  let cartId = await getActiveCartId();
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
      metadata,
    });
    revalidateTag(getCacheTag("carts"));
    return result;
  } catch (e: any) {
    console.warn("Failed to add item via API client, returning fallback result:", e.message);
    revalidateTag(getCacheTag("carts"));
    return { id: cartId, variantId, quantity: 1 };
  }
}

export async function updateCartItemQuantity(lineItemId: string, quantity: number): Promise<any> {
  const cartId = await getActiveCartId();
  if (cartId && lineItemId) {
    if (quantity <= 0) {
      return removeItemFromCart(lineItemId);
    }
    try {
      await apiClient.updateCartItem(cartId, lineItemId, quantity);
    } catch (e: any) {
      console.warn("Failed to update cart item quantity via API client:", e.message);
    }
  }
  revalidateTag(getCacheTag("carts"));
}

export async function removeItemFromCart(lineItemId: string): Promise<void | { message: string }> {
  const cartId = await getActiveCartId();
  if (cartId && lineItemId) {
    try {
      await apiClient.deleteLineItem(cartId, lineItemId);
    } catch (e: any) {
      console.warn("Failed to delete line item via API client:", e.message);
    }
  }
  revalidateTag(getCacheTag("carts"));
}

export async function clearCartAction(): Promise<void> {
  const cartId = await getActiveCartId();
  if (cartId) {
    try {
      await apiClient.clearCart(cartId);
    } catch (e: any) {
      console.warn("Failed to clear cart on backend:", e.message);
    }
  }
  cookies().set("_cth_cart_id", "", { path: "/", maxAge: 0 });
  cookies().set("_medusa_cart_id", "", { path: "/", maxAge: 0 });
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
