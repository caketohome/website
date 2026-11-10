"use server";

import { revalidateTag } from "next/cache";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { apiClient } from "../api-client";
import { getCacheTag } from "../data/cookies";

export async function getCheckoutAvailabilityAction(payload: {
  cart_id?: string;
  delivery_type?: "delivery" | "pickup";
  pincode?: string;
  latitude?: number;
  longitude?: number;
  lat?: number;
  lng?: number;
  address?: string;
  branch_id?: string;
  date?: string;
  slot_id?: string;
  coupon_code?: string;
}) {
  const cookieStore = cookies();
  if ((payload.payment_method as string) === "razorpay") {
    return {
      success: false,
      error: "Razorpay payment gateway is decommissioned. Please select Cashfree for online payments.",
    };
  }

  const cartId = payload.cart_id || cookieStore.get("_cth_cart_id")?.value || cookieStore.get("_medusa_cart_id")?.value || "cart_guest";
  const pincode = payload.pincode || cookieStore.get("delivery_pincode")?.value;

  try {
    const { ApiEngine } = await import("../api-engine");
    return ApiEngine.getCheckoutAvailability({
      ...payload,
      cart_id: cartId,
      pincode,
    });
  } catch (err: any) {
    return {
      success: false,
      serviceable: false,
      status_message: err.message || "Failed to check availability.",
    };
  }
}

export async function validateCheckoutAction(payload: {
  cart_id?: string;
  customer_id?: string;
  address?: any;
  address_id?: string;
  pincode?: string;
  latitude?: number;
  longitude?: number;
  lat?: number;
  lng?: number;
  delivery_date?: string;
  delivery_slot_id?: string;
  delivery_type?: string;
  branch_id?: string;
  coupon_code?: string;
  occasion?: string;
}) {
  const cookieStore = cookies();
  const cartId = payload.cart_id || cookieStore.get("_cth_cart_id")?.value || cookieStore.get("_medusa_cart_id")?.value || "cart_guest";
  const customerId = payload.customer_id || cookieStore.get("_cth_user_id")?.value || "cus_guest";
  const pincode = payload.pincode || cookieStore.get("delivery_pincode")?.value || payload.address?.pincode;

  try {
    const result = await apiClient.validateCheckout({
      ...payload,
      cart_id: cartId,
      customer_id: customerId,
      pincode,
    });
    return result;
  } catch (err: any) {
    return {
      valid: false,
      errors: [{ code: "VALIDATION_FAILED", message: err.message || "Failed to validate checkout." }],
    };
  }
}

export async function confirmCheckoutAction(payload: {
  cart_id?: string;
  customer_id?: string;
  address: any;
  pincode?: string;
  latitude?: number;
  longitude?: number;
  delivery_date: string;
  delivery_slot_id: string;
  delivery_type?: string;
  branch_id?: string;
  coupon_code?: string;
  payment_method: "cod" | "razorpay" | "cashfree" | "test_mode" | "wallet";
  payment_details?: any;
  occasion?: string;
  ordered_for_self?: boolean;
  recipient_name?: string;
  recipient_phone?: string;
  gift_message?: string;
  special_instructions?: string;
  location_source?: string;
}) {
  const cookieStore = cookies();
  const cartId = payload.cart_id || cookieStore.get("_cth_cart_id")?.value || cookieStore.get("_medusa_cart_id")?.value || "cart_guest";
  const customerId = payload.customer_id || cookieStore.get("_cth_user_id")?.value || "cus_guest";

  try {
    const result = await apiClient.confirmCheckout({
      ...payload,
      cart_id: cartId,
      customer_id: customerId,
    });

    if (result.success && result.order_id) {
      cookieStore.set("_cth_order_id", result.order_id, { path: "/", maxAge: 60 * 60 * 24 * 7 });
      cookieStore.set("_medusa_order_id", result.order_id, { path: "/", maxAge: 60 * 60 * 24 * 7 });
      cookieStore.set("_cth_cart_id", "", { path: "/", maxAge: 0 });
      cookieStore.set("_medusa_cart_id", "", { path: "/", maxAge: 0 });

      revalidateTag(getCacheTag("carts"));
      revalidateTag(getCacheTag("orders"));
    }

    return result;
  } catch (err: any) {
    return {
      success: false,
      error: err.message || "Order placement failed.",
    };
  }
}

export async function placeOrder(prevState: any, data: FormData) {
  const cookieStore = cookies();
  const cartId = cookieStore.get("_cth_cart_id")?.value || cookieStore.get("_medusa_cart_id")?.value || "cart_guest";
  const customerId = cookieStore.get("_cth_user_id")?.value || "cus_guest";

  const firstName = data.get("first-name")?.toString() || data.get("name")?.toString() || "Customer";
  const lastName = data.get("last-name")?.toString() || "";
  const phone = data.get("phone")?.toString();
  const email = data.get("email")?.toString() || "customer@cakes2home.com";
  const addressLine1 = data.get("address-line1")?.toString() || data.get("address")?.toString() || "Address on File";
  const addressLine2 = data.get("address-line2")?.toString() || "";
  const city = data.get("city")?.toString() || cookieStore.get("delivery_city")?.value || "";
  const state = data.get("state")?.toString() || "";
  const pincode = data.get("zip")?.toString() || data.get("pincode")?.toString() || cookieStore.get("delivery_pincode")?.value || "";
  const landmark = data.get("landmark")?.toString() || "";

  const deliveryType = data.get("delivery_type")?.toString() || data.get("delivery-type")?.toString() || "delivery";
  const branchId = data.get("branch_id")?.toString() || data.get("branch-id")?.toString() || undefined;

  const rawLat = data.get("latitude")?.toString() || data.get("lat")?.toString();
  const rawLng = data.get("longitude")?.toString() || data.get("lng")?.toString();
  const locationSource = data.get("location_source")?.toString() || data.get("source")?.toString() || undefined;
  const latitude = rawLat ? parseFloat(rawLat) : undefined;
  const longitude = rawLng ? parseFloat(rawLng) : undefined;

  const deliveryDate = data.get("delivery-date")?.toString() || data.get("delivery_date")?.toString() || new Date().toISOString().slice(0, 10);
  const deliverySlotId = data.get("delivery-slot")?.toString() || data.get("delivery_slot_id")?.toString() || "slot_morning";
  let paymentMethod = (data.get("payment-method")?.toString() || "razorpay") as "cod" | "razorpay" | "cashfree" | "test_mode";
  if (paymentMethod === "cashfree") paymentMethod = "razorpay";

  const occasion = data.get("occasion")?.toString() || "Celebration";
  const orderedForSelf = data.get("ordered-for-self")?.toString() !== "false" && data.get("ordered_for_self")?.toString() !== "false";
  const recipientName = data.get("recipient-name")?.toString() || data.get("recipient_name")?.toString();
  const recipientPhone = data.get("recipient-phone")?.toString() || data.get("recipient_phone")?.toString();
  const giftMessage = data.get("gift-message")?.toString() || data.get("gift_message")?.toString();
  const specialInstructions = data.get("special-instructions")?.toString() || data.get("special_instructions")?.toString();

  if (!firstName || !phone) {
    return { message: "Please fill in all required contact fields (Name and Mobile Phone)." };
  }

  if (deliveryType === "delivery" && (!addressLine1 && (!latitude || !longitude))) {
    return { message: "Please enter your delivery street address or select your location on the map." };
  }

  if (deliveryType === "pickup" && !branchId) {
    return { message: "Please select a bakery hub for store pickup." };
  }

  const result = await confirmCheckoutAction({
    cart_id: cartId,
    customer_id: customerId,
    address: {
      first_name: firstName,
      last_name: lastName,
      phone,
      email,
      line1: addressLine1,
      line2: addressLine2,
      city,
      state,
      pincode,
      landmark,
      latitude,
      longitude,
    },
    pincode,
    latitude,
    longitude,
    location_source: locationSource,
    delivery_date: deliveryDate,
    delivery_slot_id: deliverySlotId,
    delivery_type: deliveryType,
    branch_id: branchId,
    payment_method: paymentMethod,
    occasion,
    ordered_for_self: orderedForSelf,
    recipient_name: recipientName,
    recipient_phone: recipientPhone,
    gift_message: giftMessage,
    special_instructions: specialInstructions,
  });

  if (!result.success) {
    return { message: result.error || "Failed to place order. Please verify your details." };
  }

  if (paymentMethod === "cashfree") {
    const orderId = result.order_id || "";
    const amount = Number(result.pricing?.grand_total || result.total || 525);
    redirect(`/checkout/cashfree?order_id=${encodeURIComponent(orderId)}&amount=${amount}`);
  }

  redirect(`/your-order?order_id=${encodeURIComponent(result.order_id || "")}`);
}

