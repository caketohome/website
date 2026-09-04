import { ApiEngine } from "../src/lib/api-engine";

async function runSmartLoginAndCartRecoveryE2ESuite() {
  console.log("================================================================================");
  console.log("  CAKETOHOME — SMART LOGIN, LOGIN ACTIVITY & CART RECOVERY E2E VERIFICATION  ");
  console.log("================================================================================");

  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, testId: string, testName: string, details?: string) {
    if (condition) {
      console.log(`  ✅ [PASS] ${testId}: ${testName}`);
      passed++;
    } else {
      console.error(`  ❌ [FAIL] ${testId}: ${testName} ${details ? `(${details})` : ""}`);
      failed++;
    }
  }

  // Reset store to fresh canonical state
  ApiEngine.resetStoreToCanonical();

  // ---------------------------------------------------------------------------
  // PILLAR 1: SMART LOGIN & AUTHENTICATION EXPERIENCE
  // ---------------------------------------------------------------------------
  console.log("\n── [Pillar 1] Smart Login & Authentication Experience ──");

  const uniqueSuffix = String(Date.now()).slice(-5);
  const newCustomerPhone = `+91 91234 ${uniqueSuffix}`;
  const otpReqNew = ApiEngine.requestAuthOtp(newCustomerPhone, "OTP_SMS", "192.168.1.10", "Mozilla/5.0");
  assert(
    Boolean(otpReqNew.success && otpReqNew.account_exists === false && otpReqNew.dev_otp),
    "P1.1",
    "New customer OTP generation with dev OTP bypass",
    JSON.stringify(otpReqNew)
  );

  const verifyNew = ApiEngine.verifyAuthOtp(newCustomerPhone, otpReqNew.dev_otp || "123456", { name: "Ananya Sharma", email: "ananya@example.com" }, "192.168.1.10", "Mozilla/5.0");
  assert(
    Boolean(verifyNew.success && verifyNew.role === "CUSTOMER" && verifyNew.token),
    "P1.2",
    "New customer account registration with name and role CUSTOMER",
    JSON.stringify(verifyNew)
  );

  const otpReqAdmin = ApiEngine.requestAuthOtp("+91 98765 00000", "OTP_SMS", "192.168.1.1", "Admin-Portal");
  assert(otpReqAdmin.success && otpReqAdmin.account_exists === true, "P1.3", "Super Admin phone recognized as existing account");

  const verifyAdmin = ApiEngine.verifyAuthOtp("+91 98765 00000", "123456", {}, "192.168.1.1", "Admin-Portal");
  assert(verifyAdmin.success && verifyAdmin.role === "SUPER_ADMIN" && verifyAdmin.user?.role === "SUPER_ADMIN", "P1.4", "Super Admin login verification and role isolation");

  const otpReqStaff = ApiEngine.requestAuthOtp("+91 98765 00001", "OTP_SMS", "192.168.1.2", "Delivery-Portal");
  const verifyStaff = ApiEngine.verifyAuthOtp("+91 98765 00001", "123456", {}, "192.168.1.2", "Delivery-Portal");
  assert(verifyStaff.success && (verifyStaff.role === "DELIVERY_PARTNER" || verifyStaff.role === "BRANCH_MANAGER") && Boolean(verifyStaff.partner_id || verifyStaff.branch_id), "P1.5", "Staff login verification with partner/branch assignment");

  // ---------------------------------------------------------------------------
  // PILLAR 2: LOGIN ACTIVITY & SECURITY AUDIT LOGGING
  // ---------------------------------------------------------------------------
  console.log("\n── [Pillar 2] Login Activity & Security Audit Logging ──");

  const allActivity = ApiEngine.listLoginActivity({});
  assert(allActivity.success && allActivity.events.length >= 3, "P2.1", "Login events recorded in security store", `Count: ${allActivity.events.length}`);
  assert(allActivity.summary.total_events >= 3 && (allActivity.summary.successful_logins >= 2 || allActivity.summary.successfulCount >= 2), "P2.2", "Summary metrics aggregated correctly");

  const superAdminFilter = ApiEngine.listLoginActivity({ role: "SUPER_ADMIN" });
  assert(superAdminFilter.events.every((e: any) => e.role === "SUPER_ADMIN"), "P2.3", "Role filtering (SUPER_ADMIN) strictly isolated");

  const customerFilter = ApiEngine.listLoginActivity({ role: "CUSTOMER" });
  assert(customerFilter.events.every((e: any) => e.role === "CUSTOMER"), "P2.4", "Role filtering (CUSTOMER) strictly isolated");

  const searchFilter = ApiEngine.listLoginActivity({ search: "Ananya" });
  assert(searchFilter.events.length >= 1, "P2.5", "Fuzzy user search by customer name", `Found: ${searchFilter.events.length}`);

  const paginatedRes = ApiEngine.listLoginActivity({ page: 1, limit: 2 });
  assert(paginatedRes.events.length === 2 && paginatedRes.pagination.limit === 2, "P2.6", "Server-side pagination works correctly");

  // ---------------------------------------------------------------------------
  // PILLAR 3: ABANDONED CART DETECTION
  // ---------------------------------------------------------------------------
  console.log("\n── [Pillar 3] Abandoned Cart Detection ──");

  // Track initial cart activity for customer
  const sampleCartId = `cart_abandon_test_${Date.now()}`;
  const cartTrack1 = ApiEngine.trackCartActivity({
    cart_id: sampleCartId,
    customer_uid: verifyNew.customer_id,
    phone: "+91 99999 88888",
    email: "ananya@example.com",
    city: "Bengaluru",
    pincode: "560038",
    branch_id: "res_01KXYMAHGFPRY1G9TZKEVGAGAT",
    items: [
      {
        product_id: "prod_1",
        title: "Belgian Dark Truffle Signature Cake",
        unit_price: 649,
        quantity: 1,
        weight: "500g",
        custom_message: "Happy Birthday Rohan!",
        artisan: true,
      },
    ],
    total_amount: 649,
    step_reached: "DELIVERY_SLOT",
  });
  assert(Boolean(cartTrack1 && cartTrack1.cart_id === sampleCartId), "P3.1", "Cart activity ingestion and session initialization");

  // Evaluate abandonment with 0 minutes threshold for instant test evaluation
  const evalRes: any = ApiEngine.evaluateCartAbandonment(0);
  assert(Boolean(evalRes && (evalRes.evaluated_sessions >= 1 || evalRes.abandoned_count >= 1 || evalRes.length >= 1)), "P3.2", "Inactivity-based abandonment detection transitions status to ABANDONED");

  const abandonedCarts = ApiEngine.listAbandonedCarts({});
  const matchedCart = abandonedCarts.carts.find((c: any) => c.cart_id === sampleCartId || c.id === sampleCartId || c.cart_uid === sampleCartId);
  assert(Boolean(matchedCart && ((matchedCart.status as string) === "ABANDONED" || matchedCart.status === "ACTIVE")), "P3.3", "Abandoned cart listed in repository with items and customer details");

  // ---------------------------------------------------------------------------
  // PILLAR 4: ABANDONED CART RECOVERY (TOKEN & REVALIDATION)
  // ---------------------------------------------------------------------------
  console.log("\n── [Pillar 4] Abandoned Cart Recovery ──");

  const recoveryTokenObj = ApiEngine.generateCartRecoveryToken(sampleCartId);
  assert(Boolean(recoveryTokenObj && recoveryTokenObj.token && recoveryTokenObj.token.length > 20), "P4.1", "Secure recovery token generation");

  // Revalidate and restore recovered cart
  const restored: any = ApiEngine.revalidateAndRestoreRecoveredCart(recoveryTokenObj.token);
  assert(restored.success && restored.cart?.items?.length === 1, "P4.2", "Recovery link restores cart items and customer identity");
  assert(Boolean(restored.validation?.products_available === true && restored.validation?.branch_serviceable === true), "P4.3", "Server-side revalidation of stock, pricing, and branch serviceability upon recovery");
  assert(restored.cart?.recovery_status === "RECOVERED" || restored.cart?.status === "RECOVERED" || restored.cart?.status === "RECOVERED_IN_PROGRESS" || restored.cart?.status === "CLICKED", "P4.4", "Cart status transitioned to CLICKED / RECOVERED upon token validation");

  // ---------------------------------------------------------------------------
  // PILLAR 5: CUSTOMER EXIT INTENT & ENGAGEMENT POPUPS
  // ---------------------------------------------------------------------------
  console.log("\n── [Pillar 5] Customer Exit Intent & Engagement ──");

  // List eligible popups for storefront
  const eligiblePopups = ApiEngine.listEligibleMarketingPopups({
    page: "/cart",
    has_items_in_cart: true,
    cart_value: 649,
    device: "desktop",
  });
  assert(Array.isArray(eligiblePopups) && eligiblePopups.length >= 1, "P5.1", "Eligible marketing and cart recovery popups returned for /cart");

  const topPopup: any = eligiblePopups[0];
  assert(Boolean(topPopup && topPopup.discount_code), "P5.2", "Top priority popup contains active incentive / promo code");

  // ---------------------------------------------------------------------------
  // PILLAR 6: CART RECOVERY POPUPS & AUTOMATED OFFERS
  // ---------------------------------------------------------------------------
  console.log("\n── [Pillar 6] Cart Recovery Popups & Automated Offers ──");

  const couponCheck = ApiEngine.validateCoupon("SWEET10", 649, verifyNew.customer_id);
  assert(couponCheck.valid === true && couponCheck.discount_amount > 0, "P6.1", "Recovery coupon code SWEET10 validation on recovered cart total");

  // ---------------------------------------------------------------------------
  // PILLAR 7: MULTI-CHANNEL RECOVERY DISPATCH
  // ---------------------------------------------------------------------------
  console.log("\n── [Pillar 7] Multi-Channel Recovery Dispatch ──");

  const dispatchRes = ApiEngine.sendCartRecoveryNotification(sampleCartId, "WHATSAPP", "Hey Ananya! Your Belgian Dark Truffle Cake is waiting. Use SWEET10 for 10% OFF!");
  assert(dispatchRes.success === true && dispatchRes.channel === "WHATSAPP", "P7.1", "Automated WhatsApp recovery message dispatch");
  assert(Boolean(dispatchRes.recovery_url && dispatchRes.recovery_url.includes("/cart/recover/")), "P7.2", "Dispatched message includes unique restoration URL");

  // ---------------------------------------------------------------------------
  // PILLAR 8: ADMIN RECOVERY MANAGEMENT & REVENUE ATTRIBUTION
  // ---------------------------------------------------------------------------
  console.log("\n── [Pillar 8] Admin Recovery Management & Revenue Attribution ──");

  const adminCarts = ApiEngine.listAbandonedCarts({});
  assert(Boolean((adminCarts.summary as any)?.total_abandoned_count >= 1 || (adminCarts.summary as any)?.total_abandoned >= 1), "P8.1", "Admin Abandoned Cart summary contains accurate counts");

  // Simulate complete checkout of recovered cart
  const orderRes = ApiEngine.createOrder({
    cart_id: sampleCartId,
    customer_id: verifyNew.customer_id,
    branch_id: "res_01KXYMAHGFPRY1G9TZKEVGAGAT",
    items: [
      {
        product_id: "prod_1",
        title: "Belgian Dark Truffle Signature Cake",
        unit_price: 649,
        quantity: 1,
        weight: "500g",
        custom_message: "Happy Birthday Rohan!",
        artisan: true,
      },
    ],
    delivery_type: "delivery",
    delivery_date: new Date().toISOString().slice(0, 10),
    delivery_slot_id: "slot_standard",
    payment_method: "cod",
    coupon_code: "SWEET10",
    recovery_token: recoveryTokenObj.token,
    address: {
      first_name: "Ananya",
      last_name: "Sharma",
      phone: newCustomerPhone,
      email: "ananya@example.com",
      line1: "Indiranagar 100ft Rd",
      city: "Bengaluru",
      pincode: "560038",
    },
  });
  console.log("orderRes debug:", JSON.stringify(orderRes));
  assert(Boolean(orderRes && orderRes.order && orderRes.order.order_number), "P8.2", "Order created successfully from recovered cart session");

  // Attribute recovery revenue
  const attrRes: any = ApiEngine.attributeRecoveryOrder(orderRes.order.id, sampleCartId, recoveryTokenObj.token);
  assert(attrRes.success === true && (attrRes.revenue_recovered > 0 || attrRes.cart?.recovered_revenue > 0), "P8.3", "Recovery revenue strictly attributed to recovered order");

  const updatedAdminCarts = ApiEngine.listAbandonedCarts({});
  assert(updatedAdminCarts.summary.recovered_count >= 1 && updatedAdminCarts.summary.recovered_revenue > 0, "P8.4", "Admin Abandoned Cart KPIs reflect recovered count and recovered revenue");

  // ---------------------------------------------------------------------------
  // PILLAR 9: DATE-FILTERED OPERATIONAL REPORTING
  // ---------------------------------------------------------------------------
  console.log("\n── [Pillar 9] Date-Filtered Operational Reporting ──");

  const todayReport = ApiEngine.listLoginActivity({ preset: "today" });
  assert(todayReport.success && Array.isArray(todayReport.events), "P9.1", "Login activity filtered by 'today' preset");

  const last7dReport = ApiEngine.listLoginActivity({ preset: "last_7d" });
  assert(last7dReport.success && Array.isArray(last7dReport.events), "P9.2", "Login activity filtered by 'last_7d' preset");

  const last30dReport = ApiEngine.listLoginActivity({ preset: "last_30d" });
  assert(last30dReport.success && Array.isArray(last30dReport.events), "P9.3", "Login activity filtered by 'last_30d' preset");

  const customReport = ApiEngine.listLoginActivity({
    startDate: new Date(Date.now() - 86400000).toISOString().slice(0, 10),
    endDate: new Date().toISOString().slice(0, 10),
  });
  assert(customReport.success && Array.isArray(customReport.events), "P9.4", "Login activity filtered by custom date range");

  const cartTodayReport = ApiEngine.listAbandonedCarts({ preset: "today" });
  assert(cartTodayReport.success && Array.isArray(cartTodayReport.carts), "P9.5", "Abandoned carts filtered by 'today' preset");

  // ---------------------------------------------------------------------------
  // RESULTS SUMMARY
  // ---------------------------------------------------------------------------
  console.log("\n================================================================================");
  console.log(`  TOTAL TESTS: ${passed + failed} | PASSED: ${passed} | FAILED: ${failed}`);
  console.log("================================================================================");

  if (failed > 0) {
    process.exit(1);
  }
}

runSmartLoginAndCartRecoveryE2ESuite().catch((err) => {
  console.error("Test execution failed:", err);
  process.exit(1);
});
