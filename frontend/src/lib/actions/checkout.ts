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

  if (!firstName || !phone || !shopId) {
    return { message: "Please fill in all required fields" };
  }

  cookies().set("_cth_cart_id", "", { maxAge: 0 });
  cookies().set("_cth_order_id", `ord_${Date.now()}`);

  redirect("/your-order");
}
