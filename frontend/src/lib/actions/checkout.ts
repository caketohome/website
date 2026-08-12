"use server";

import { revalidateTag } from "next/cache";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { apiClient } from "../api-client";
import { getCacheTag } from "../data/cookies";

export async function updateCart(data: Record<string, unknown>) {
  const cartId = cookies().get("_cth_cart_id")?.value || "cart_guest";
  revalidateTag(getCacheTag("carts"));
  return { id: cartId, ...data };
}

export async function completeCart() {
  const cartId = cookies().get("_cth_cart_id")?.value || "cart_guest";
  revalidateTag(getCacheTag("carts"));
  return { id: cartId, status: "completed" };
}

export async function addPaymentSession(cartId: string) {
  return { id: `pay_sess_${Date.now()}` };
}

export async function createDelivery(cartId: string, shopId: string, deliveryDate?: string | null, deliverySlotId?: string | null) {
  revalidateTag(getCacheTag("deliveries"));
  return { id: `dlv_${Date.now()}`, cartId, shopId, deliveryDate, deliverySlotId };
}

export async function placeOrder(prevState: any, data: FormData) {
  const cartId = cookies().get("_cth_cart_id")?.value || "cart_guest";

  const firstName = data.get("first-name")?.toString();
  const lastName = data.get("last-name")?.toString();
  const phone = data.get("phone")?.toString();
  const email = data.get("email")?.toString();
  const shopId = data.get("shop-id")?.toString();
  const zip = data.get("zip")?.toString() || cookies().get("delivery_pincode")?.value;

  if (!firstName || !phone || !shopId) {
    return { message: "Please fill in all required fields" };
  }

  // Revalidate cart items availability against destination pincode/branch
  try {
    const { ApiEngine } = await import("../api-engine");
    const cart = ApiEngine.getCart(cartId);
    if (cart && Array.isArray(cart.items) && cart.items.length > 0) {
      let targetBranch: any = null;
      if (zip) {
        targetBranch = ApiEngine.resolveSmartBranch({ pincode: zip })?.branch;
      }
      if (!targetBranch && shopId) {
        targetBranch = ApiEngine.resolveBranchRecord(shopId);
      }
      if (targetBranch && targetBranch.product_availability) {
        for (const item of cart.items) {
          const pId = item.product_id || item.id;
          const override = targetBranch.product_availability[pId] || { status: "AVAILABLE" };
          const st = (override.status || "").toUpperCase();
          if (st === "OUT_OF_STOCK" || st === "UNAVAILABLE" || st === "OUT_TODAY" || st === "HIDDEN" || st === "TEMPORARILY_HIDDEN") {
            return { message: `"${item.title || "Product"}" is not available for delivery at pincode ${zip || targetBranch.pincode} (${targetBranch.name}). Please remove it to proceed.` };
          }
        }
      }
    }
  } catch (err: any) {
    console.error("Cart validation error during checkout:", err);
  }

  cookies().set("_cth_cart_id", "", { maxAge: 0 });
  cookies().set("_cth_order_id", `ord_${Date.now()}`);

  redirect("/your-order");
}
