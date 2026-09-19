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
    branch_id: shop_id,
    items: [],
    subtotal: 0,
    total: 0,
    currency_code: "inr",
    ...(data || {}),
  };

  try {
    const { ApiEngine } = await import("../api-engine");
    ApiEngine.saveCart(cartPayload);
  } catch (err: any) {
    console.warn("[createCart] ApiEngine warning:", err.message);
  }

  try {
    const { CartRepository } = await import("../repositories/cart.repository");
    await CartRepository.saveCart({ id: newCartId, currency_code: "inr", metadata: { shop_id } });
  } catch (err: any) {
    console.warn("[createCart] CartRepository warning:", err.message);
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
    const { ApiEngine } = await import("../api-engine");
    const itemPayload = {
      cartId: cartId!,
      productId: metadata?.productId || variantId,
      product_id: metadata?.productId || variantId,
      variantId,
      variant_id: variantId,
      quantity: Math.max(1, Number(metadata?.quantity || 1)),
      selectedOptions: metadata?.selectedOptions,
      metadata,
      ...metadata,
    };

    const cart = ApiEngine.addToCart(cartId!, itemPayload);

    // Authoritative PostgreSQL persistence
    try {
      const { CartRepository } = await import("../repositories/cart.repository");
      await CartRepository.saveCart({
        id: cartId!,
        currency_code: cart.currency_code || "inr",
        metadata: { shop_id: shopId, subtotal: cart.subtotal, total: cart.total },
      });

      if (cart && Array.isArray(cart.items)) {
        const addedItem = cart.items.find(
          (i: any) =>
            i.variant_id === variantId ||
            i.product_id === (metadata?.productId || variantId) ||
            i.id === variantId
        ) || cart.items[cart.items.length - 1];

        if (addedItem) {
          await CartRepository.upsertLineItem(cartId!, addedItem);
        }
      }
    } catch (pgErr: any) {
      console.warn("[addToCart] PostgreSQL persistence warning:", pgErr.message);
    }

    const cookieStore = cookies();
    cookieStore.set("_cth_cart_id", cartId!, { path: "/", maxAge: 60 * 60 * 24 * 30 });
    cookieStore.set("_medusa_cart_id", cartId!, { path: "/", maxAge: 60 * 60 * 24 * 30 });
    revalidateTag(getCacheTag("carts"));
    return { success: true, cart, cartId };
  } catch (e: any) {
    console.error("[addToCart Action Failed]:", e.message || e);
    revalidateTag(getCacheTag("carts"));
    throw new Error(e.message || "Failed to add item to cart. Please try again.");
  }
}

export async function updateCartItemQuantity(lineItemId: string, quantity: number): Promise<any> {
  const cartId = await getActiveCartId();
  if (!cartId || !lineItemId) {
    throw new Error("Invalid cart or item reference");
  }
  if (quantity <= 0) {
    return removeItemFromCart(lineItemId);
  }
  try {
    const { ApiEngine } = await import("../api-engine");
    const cart = ApiEngine.updateCartItem(cartId, lineItemId, quantity);

    try {
      const { CartRepository } = await import("../repositories/cart.repository");
      await CartRepository.updateLineItemQuantity(cartId, lineItemId, quantity);
    } catch (pgErr: any) {
      console.warn("[updateCartItemQuantity] PostgreSQL update warning:", pgErr.message);
    }

    revalidateTag(getCacheTag("carts"));
    return { success: true, cart };
  } catch (e: any) {
    console.error("[updateCartItemQuantity Action Failed]:", e.message || e);
    throw new Error(e.message || "Failed to update item quantity");
  }
}

export async function removeItemFromCart(lineItemId: string): Promise<any> {
  const cartId = await getActiveCartId();
  if (!cartId || !lineItemId) {
    throw new Error("Invalid cart or item reference");
  }
  try {
    const { ApiEngine } = await import("../api-engine");
    const cart = ApiEngine.deleteLineItem(cartId, lineItemId);

    try {
      const { CartRepository } = await import("../repositories/cart.repository");
      await CartRepository.removeLineItem(cartId, lineItemId);
    } catch (pgErr: any) {
      console.warn("[removeItemFromCart] PostgreSQL delete warning:", pgErr.message);
    }

    revalidateTag(getCacheTag("carts"));
    return { success: true, cart };
  } catch (e: any) {
    console.error("[removeItemFromCart Action Failed]:", e.message || e);
    throw new Error(e.message || "Failed to remove item from cart");
  }
}

export async function clearCartAction(): Promise<void> {
  const cartId = await getActiveCartId();
  if (cartId) {
    try {
      const { ApiEngine } = await import("../api-engine");
      ApiEngine.clearCart(cartId);

      const { CartRepository } = await import("../repositories/cart.repository");
      await CartRepository.clearCart(cartId);
    } catch (e: any) {
      console.warn("[clearCartAction] Clear warning:", e.message);
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
