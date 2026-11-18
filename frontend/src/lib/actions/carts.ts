"use server";

import { revalidateTag } from "next/cache";
import { cookies } from "next/headers";
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

  const { ApiEngine } = await import("../api-engine");
  await ApiEngine.ensureHydrated();
  ApiEngine.saveCart(cartPayload);

  const { CartRepository } = await import("../repositories/cart.repository");
  await CartRepository.saveCart({
    id: newCartId,
    branch_id: shop_id,
    currency_code: "inr",
    subtotal: 0,
    total: 0,
    metadata: { shop_id, ...(data?.metadata || {}) },
  });

  cookieStore.set("_cth_cart_id", newCartId, { path: "/", maxAge: 60 * 60 * 24 * 30 });
  cookieStore.set("_medusa_cart_id", newCartId, { path: "/", maxAge: 60 * 60 * 24 * 30 });
  revalidateTag(getCacheTag("carts"));
  return cartPayload;
}

export async function addToCart(
  variantId: string,
  shopId: string = "default_shop",
  metadata?: Record<string, any>
): Promise<any> {
  let cartId = await getActiveCartId();
  if (!cartId) {
    const cart = await createCart({}, shopId);
    cartId = cart?.id;
  }

  try {
    const { ApiEngine } = await import("../api-engine");
    const { CartRepository } = await import("../repositories/cart.repository");
    await ApiEngine.ensureHydrated();

    // Load authoritative cart from PostgreSQL into ApiEngine before mutating
    const existingDbCart = await CartRepository.findCartById(cartId!);
    if (existingDbCart) {
      ApiEngine.syncCartFromDb(existingDbCart);
    }

    const itemPayload = {
      cartId: cartId!,
      productId: metadata?.productId || metadata?.product_id || variantId,
      product_id: metadata?.productId || metadata?.product_id || variantId,
      variantId,
      variant_id: variantId,
      quantity: Math.max(1, Number(metadata?.quantity || 1)),
      selectedOptions: metadata?.selectedOptions,
      metadata,
      ...metadata,
    };

    const mutatedCart = ApiEngine.addToCart(cartId!, itemPayload);

    // Atomically persist cart + all line items in PostgreSQL
    const persistedCart = await CartRepository.saveCartWithItems({
      ...mutatedCart,
      id: cartId!,
      branch_id: shopId || mutatedCart.branch_id,
      currency_code: mutatedCart.currency_code || "inr",
      metadata: {
        ...(mutatedCart.metadata || {}),
        shop_id: shopId,
        subtotal: mutatedCart.subtotal,
        total: mutatedCart.total,
      },
    });

    let authoritativeCart = persistedCart
      ? ApiEngine.syncCartFromDb(persistedCart)
      : mutatedCart;

    const cookieStore = cookies();

    // Signed-in shopper: attach the cart to them so an abandoned cart can be recovered.
    try {
      const { resolveServerSession } = await import("../security/auth-session");
      const session = resolveServerSession({ cookies: cookieStore, headers: { get: () => "" } });
      if (session?.userId && session.role === "CUSTOMER") {
        const { claimCartForCustomer } = await import("../cart-recovery/claim-cart");
        if (await claimCartForCustomer(cartId!, { userId: session.userId, phone: session.phone, name: session.name })) {
          const claimed = await CartRepository.findCartById(cartId!);
          if (claimed) authoritativeCart = ApiEngine.syncCartFromDb(claimed);
        }
      }
    } catch {
      // never block add-to-cart on recovery bookkeeping
    }

    cookieStore.set("_cth_cart_id", cartId!, { path: "/", maxAge: 60 * 60 * 24 * 30 });
    cookieStore.set("_medusa_cart_id", cartId!, { path: "/", maxAge: 60 * 60 * 24 * 30 });
    revalidateTag(getCacheTag("carts"));
    return { success: true, cart: authoritativeCart, cartId };
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
    const { CartRepository } = await import("../repositories/cart.repository");
    await ApiEngine.ensureHydrated();

    const existingDbCart = await CartRepository.findCartById(cartId);
    if (existingDbCart) {
      ApiEngine.syncCartFromDb(existingDbCart);
    }

    ApiEngine.updateCartItem(cartId, lineItemId, quantity);
    await CartRepository.updateLineItemQuantity(cartId, lineItemId, quantity);

    const updatedDbCart = await CartRepository.findCartById(cartId);
    const authoritativeCart = updatedDbCart
      ? ApiEngine.syncCartFromDb(updatedDbCart)
      : ApiEngine.getCart(cartId);

    revalidateTag(getCacheTag("carts"));
    return { success: true, cart: authoritativeCart };
  } catch (e: any) {
    console.error("[updateCartItemQuantity Action Failed]:", e.message || e);
    throw new Error(e.message || "Failed to update item quantity");
  }
}

export async function updateCartItemMessage(
  lineItemId: string,
  cakeMessage: string | null
): Promise<any> {
  const cartId = await getActiveCartId();
  if (!cartId || !lineItemId) {
    throw new Error("Invalid cart or item reference");
  }
  try {
    const { ApiEngine } = await import("../api-engine");
    const { CartRepository } = await import("../repositories/cart.repository");
    await ApiEngine.ensureHydrated();

    const existingDbCart = await CartRepository.findCartById(cartId);
    if (existingDbCart) {
      ApiEngine.syncCartFromDb(existingDbCart);
    }

    ApiEngine.updateCartItemMessage(cartId, lineItemId, cakeMessage);
    await CartRepository.updateLineItemMessage(cartId, lineItemId, cakeMessage);

    const updatedDbCart = await CartRepository.findCartById(cartId);
    const authoritativeCart = updatedDbCart
      ? ApiEngine.syncCartFromDb(updatedDbCart)
      : ApiEngine.getCart(cartId);

    revalidateTag(getCacheTag("carts"));
    return { success: true, cart: authoritativeCart };
  } catch (e: any) {
    console.error("[updateCartItemMessage Action Failed]:", e.message || e);
    throw new Error(e.message || "Failed to update cake message");
  }
}

export async function removeItemFromCart(lineItemId: string): Promise<any> {
  const cartId = await getActiveCartId();
  if (!cartId || !lineItemId) {
    throw new Error("Invalid cart or item reference");
  }
  try {
    const { ApiEngine } = await import("../api-engine");
    const { CartRepository } = await import("../repositories/cart.repository");
    await ApiEngine.ensureHydrated();

    const existingDbCart = await CartRepository.findCartById(cartId);
    if (existingDbCart) {
      ApiEngine.syncCartFromDb(existingDbCart);
    }

    ApiEngine.removeCartItem(cartId, lineItemId);
    await CartRepository.removeLineItem(cartId, lineItemId);

    const updatedDbCart = await CartRepository.findCartById(cartId);
    const authoritativeCart = updatedDbCart
      ? ApiEngine.syncCartFromDb(updatedDbCart)
      : ApiEngine.getCart(cartId);

    revalidateTag(getCacheTag("carts"));
    return { success: true, cart: authoritativeCart };
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
      await ApiEngine.ensureHydrated();
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

export async function saveItemForLater(
  lineItemId: string,
  variantId: string,
  shopId: string,
  title: string,
  thumbnail: string | null,
  price: number | null
): Promise<void> {
  await removeItemFromCart(lineItemId);
  const savedItems = await getSavedItems();
  if (!savedItems.some((item) => item.variant_id === variantId)) {
    savedItems.push({ variant_id: variantId, shop_id: shopId, title, thumbnail, price });
    cookies().set("_cth_saved_items", JSON.stringify(savedItems), {
      path: "/",
      maxAge: 60 * 60 * 24 * 30,
    });
  }
}

export async function moveToCartFromSaved(variantId: string, shopId: string): Promise<void> {
  await addToCart(variantId, shopId);
  const savedItems = await getSavedItems();
  const filtered = savedItems.filter((item) => item.variant_id !== variantId);
  cookies().set("_cth_saved_items", JSON.stringify(filtered), {
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
}
