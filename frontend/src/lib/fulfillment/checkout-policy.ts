/**
 * Checkout policy: which payment methods and fulfillment modes customers may use.
 * Shared by the checkout availability response (to hide options) and order
 * confirmation (to reject them server-side).
 */

/** Sandbox "test_mode" payments mark orders paid without money changing hands. Off unless explicitly enabled. */
export function testPaymentsAllowed(): boolean {
  return process.env.ALLOW_TEST_PAYMENTS === "true";
}

export function isCodEnabled(config: { cod_enabled?: boolean } | null | undefined): boolean {
  return config?.cod_enabled !== false;
}

export function isStorePickupEnabled(config: { store_pickup_enabled?: boolean } | null | undefined): boolean {
  return config?.store_pickup_enabled !== false;
}

/** Returns a customer-facing error message if the requested combination is not allowed, else null. */
export function checkoutPolicyError(params: {
  paymentMethod?: string | null;
  deliveryType?: string | null;
  config: { cod_enabled?: boolean; store_pickup_enabled?: boolean } | null | undefined;
  /** Staff taking an order at the counter may record cash/card/UPI; customers may not. */
  staff?: boolean;
}): { code: string; message: string } | null {
  const method = String(params.paymentMethod || "").toLowerCase().trim();
  // Customers only get the choices checkout offers; any other name would create a confirmed, unpaid order.
  if (!params.staff && !["cod", "razorpay", "online", "test_mode"].includes(method)) {
    return { code: "PAYMENT_METHOD_NOT_ALLOWED", message: "Please choose Pay Online or Cash on Delivery." };
  }
  const isCod = method === "cod" || method === "cash" || method.includes("cash on delivery");
  if (isCod && !isCodEnabled(params.config)) {
    return { code: "COD_DISABLED", message: "Cash on Delivery is currently unavailable. Please pay online." };
  }
  if (method === "test_mode" && !testPaymentsAllowed()) {
    return { code: "TEST_PAYMENTS_DISABLED", message: "This payment method is not available." };
  }
  if (String(params.deliveryType || "").toLowerCase() === "pickup" && !isStorePickupEnabled(params.config)) {
    return { code: "STORE_PICKUP_DISABLED", message: "Store pickup is currently unavailable. Please choose delivery." };
  }
  return null;
}
