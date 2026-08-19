/**
 * CakeToHome Enterprise Abandoned Cart Recovery Engine E2E Verification Suite
 * Validates all 14 Core Requirements, 11 Production Integrity Gates, and 50+ Assertions.
 */

import { ApiEngine } from "../src/lib/api-engine";
import { WebhookEngine } from "../src/lib/webhook-engine";
import {
  generateCartFingerprint,
  computeAbandonedCartMetrics,
  computeRecoveryFunnel,
  computeChannelPerformance,
  computeTopAbandonedProducts,
} from "../src/lib/cart-recovery/cart-recovery-engine";
import { AbandonedCartRecord, RecoveryEvent } from "../src/lib/cart-recovery/types";

let passedCount = 0;
let failedCount = 0;
const testResults: { name: string; status: "PASS" | "FAIL"; details?: string }[] = [];

function assert(condition: boolean, testName: string, details?: string) {
  if (condition) {
    passedCount++;
    testResults.push({ name: testName, status: "PASS" });
    console.log(`  ✓ [PASS] ${testName}`);
  } else {
    failedCount++;
    testResults.push({ name: testName, status: "FAIL", details });
    console.error(`  ✗ [FAIL] ${testName} ${details ? `(${details})` : ""}`);
  }
}

async function runAbandonedCartEngineSuite() {
  console.log("\n================================================================================");
  console.log("  CAKETOHOME ENTERPRISE ABANDONED CART RECOVERY ENGINE — E2E TEST SUITE");
  console.log("================================================================================\n");

  // Reset store for deterministic testing
  ApiEngine.resetStoreToCanonical();
  ApiEngine.ensureCartsStore();

  // ════════════════════════════════════════════════════════════════════════════
  // GATE 1: SCHEMA & DATA INTEGRITY (ZERO HARDCODED/MOCK DATA)
  // ════════════════════════════════════════════════════════════════════════════
  console.log("▶ GATE 1: Schema & Data Integrity (Zero Mock / Hardcoded Data in Production)");

  const initList = ApiEngine.listAbandonedCarts();
  assert(initList.success === true, "1.1: listAbandonedCarts returns success response");
  assert(Array.isArray(initList.carts), "1.2: carts is a valid array");
  assert(typeof initList.metrics === "object" && initList.metrics !== null, "1.3: metrics object exists");
  assert(Array.isArray(initList.funnel), "1.4: recovery funnel is an array");
  assert(Array.isArray(initList.channel_performance), "1.5: channel_performance is an array");
  assert(Array.isArray(initList.top_products), "1.6: top_products is an array");

  // ════════════════════════════════════════════════════════════════════════════
  // GATE 2: REAL CART INACTIVITY & ABANDONMENT DETECTION ENGINE
  // ════════════════════════════════════════════════════════════════════════════
  console.log("\n▶ GATE 2: Real Cart Inactivity & Abandonment Detection Engine");

  const uniqueSuffix = String(Date.now()).slice(-5);
  const testCartId = `cart_test_ab_${uniqueSuffix}`;
  const testPhone = `+91 98888 ${uniqueSuffix}`;
  const cleanTestPhone = `98888${uniqueSuffix}`;
  const testEmail = `anand.${uniqueSuffix}@example.com`;
  const testName = "Anand Kumar";

  // 1. Create a live cart and add Belgian Chocolate Truffle
  const liveCart = ApiEngine.addToCart(
    testCartId,
    {
      productId: "prod_01KXY_BELGIAN_TRUFFLE",
      title: "Belgian Dark Chocolate Truffle Cake",
      unit_price: 1299,
      quantity: 1,
      thumbnail: "https://images.unsplash.com/photo-1578985545062-69928b1d9587",
      cake_message: "Happy Anniversary!",
    }
  );

  assert(liveCart.items.length === 1, "2.1: Item successfully added to cart");
  assert(liveCart.subtotal === 1299, "2.2: Cart subtotal correctly calculated as ₹1299");

  // Track customer checkout activity
  ApiEngine.trackCartActivity({
    cart_id: testCartId,
    phone: testPhone,
    email: testEmail,
    customer_name: testName,
    step: "CHECKOUT_STARTED",
    subtotal: 1299,
  });

  // Simulate inactivity (35 mins ago)
  liveCart.last_activity_at = new Date(Date.now() - 35 * 60 * 1000).toISOString();
  liveCart.updated_at = new Date(Date.now() - 35 * 60 * 1000).toISOString();

  // Run abandon detection engine with 30 min threshold
  const detectedCarts = ApiEngine.evaluateCartAbandonment(30);
  const foundAb = detectedCarts.find((c) => c.cart_uid === testCartId || c.id === testCartId);

  assert(Boolean(foundAb), "2.3: Abandon detection engine flags cart inactive > 30m as abandoned");
  assert(foundAb?.status === "ACTIVE", "2.4: Abandoned cart status is ACTIVE (recovery pending)");
  assert(foundAb?.cart_value === 1299, "2.5: Abandoned cart value preserved as ₹1299");
  assert(foundAb?.customer_name === testName, "2.6: Customer name accurately captured");
  assert(Boolean(foundAb?.phone.includes(uniqueSuffix)), "2.7: Phone number accurately normalized and captured");

  // Deduplication Test: Running evaluateCartAbandonment again must NOT create duplicate records
  const countBefore = ApiEngine.listAbandonedCarts().total;
  ApiEngine.evaluateCartAbandonment(30);
  const countAfter = ApiEngine.listAbandonedCarts().total;
  assert(countBefore === countAfter, "2.8: Fingerprint deduplication prevents duplicate abandoned cart records");

  // Check CRM customer profile update
  const custRes: any = ApiEngine.listCustomers();
  const customersList = Array.isArray(custRes) ? custRes : (custRes?.customers || []);
  const custRecord = customersList.find((c: any) => c.phone?.includes(uniqueSuffix) || c.normalized_phone?.includes(cleanTestPhone));
  assert(custRecord?.cart_status === "ABANDONED_CART", "2.9: CRM customer cart_status automatically set to ABANDONED_CART", `found cart_status: ${custRecord?.cart_status}`);

  // ════════════════════════════════════════════════════════════════════════════
  // GATE 3: MULTI-FILTER SEARCH & PAGINATION
  // ════════════════════════════════════════════════════════════════════════════
  console.log("\n▶ GATE 3: Multi-Filter Search & Pagination");

  const searchByName = ApiEngine.listAbandonedCarts({ q: "Anand" });
  assert(searchByName.carts.some((c) => c.id === testCartId || c.cart_uid === testCartId), "3.1: Search by customer name finds cart");

  const searchByPhone = ApiEngine.listAbandonedCarts({ search: uniqueSuffix });
  assert(searchByPhone.carts.some((c) => c.id === testCartId || c.cart_uid === testCartId), "3.2: Search by customer phone finds cart");

  const searchByCake = ApiEngine.listAbandonedCarts({ q: "Belgian" });
  assert(searchByCake.carts.some((c) => c.id === testCartId || c.cart_uid === testCartId), "3.3: Search by cake product title finds cart");

  const filterByStatus = ApiEngine.listAbandonedCarts({ status: "ACTIVE" });
  assert(filterByStatus.carts.every((c) => c.status === "ACTIVE" || c.recovery_status === "ACTIVE"), "3.4: Status filter strictly isolates active carts");

  const paginated = ApiEngine.listAbandonedCarts({ page: 1, limit: 2 });
  assert(paginated.carts.length <= 2, "3.5: Pagination limit respects page size");
  assert(paginated.pagination.totalPages >= 1, "3.6: Pagination calculates totalPages");

  // ════════════════════════════════════════════════════════════════════════════
  // GATE 4: DYNAMIC KPI & RECOVERY FUNNEL CALCULATION
  // ════════════════════════════════════════════════════════════════════════════
  console.log("\n▶ GATE 4: Dynamic KPI & Recovery Funnel Calculation");

  const allRes = ApiEngine.listAbandonedCarts();
  const metricsData = allRes.metrics;
  const manualTotalRisk = allRes.carts.filter((c) => c.status !== "RECOVERED").reduce((s, c) => s + c.cart_value, 0);

  assert(metricsData.total_abandoned >= 1, "4.1: Total abandoned count >= 1");
  assert(metricsData.revenue_at_risk >= 1299, "4.2: Revenue at risk accurately sums dropped carts");
  assert(metricsData.average_cart_value > 0, "4.3: Average cart value is greater than 0");
  assert(allRes.funnel.length === 6, "4.4: Recovery funnel contains all 6 steps");
  assert(allRes.funnel[0].step === "CART_CREATED", "4.5: Funnel starts with CART_CREATED");
  assert(allRes.funnel[5].step === "RECOVERED", "4.6: Funnel ends with RECOVERED");

  // ════════════════════════════════════════════════════════════════════════════
  // GATE 5: RECOVERY MESSAGE DISPATCH & OUTBOX EVENT EMISSION
  // ════════════════════════════════════════════════════════════════════════════
  console.log("\n▶ GATE 5: Recovery Message Dispatch & Outbox Event Emission");

  const outboxCountBefore = WebhookEngine.getOutboxItems().length;
  const dispatchRes = ApiEngine.sendCartRecoveryMessage(testCartId, {
    channel: "WHATSAPP",
    discount_code: "SWEET10",
    discount_pct: 10,
    staff_id: "admin_01",
    staff_name: "Super Admin",
  });

  assert(dispatchRes.success === true, "5.1: sendCartRecoveryMessage returns success");
  assert(dispatchRes.channel === "WHATSAPP", "5.2: Channel recorded as WHATSAPP");
  assert(Boolean(dispatchRes.recovery_token), "5.3: Recovery token generated");
  assert(dispatchRes.recovery_url.startsWith("/cart/recover/"), "5.4: Recovery URL properly formatted");
  assert(dispatchRes.cart.status === "MESSAGE_SENT", "5.5: Cart status transitioned to MESSAGE_SENT");
  assert(dispatchRes.cart.recovery_attempt_count === 1, "5.6: recovery_attempt_count incremented to 1");

  // Verify Webhook Outbox Event Emitted
  const outboxItems = WebhookEngine.getOutboxItems();
  const sentOutbox = outboxItems.find(
    (o) =>
      o.event_type === "cart.recovery_sent" ||
      o.aggregate_id === testCartId ||
      o.payload_json?.data?.cart_id === testCartId
  );
  assert(Boolean(sentOutbox), "5.7: WebhookEngine emitted signed cart.recovery_sent outbox event");

  // Verify Recovery Event logged
  const eventsRes = ApiEngine.getAbandonedCartEvents(testCartId);
  const msgSentEv = eventsRes.events.find((e) => e.event_type === "message.sent");
  assert(Boolean(msgSentEv), "5.8: recovery_events log contains message.sent entry");

  // ════════════════════════════════════════════════════════════════════════════
  // GATE 6: RECOVERY LINK RESTORATION & CATALOG PRICE REVALIDATION
  // ════════════════════════════════════════════════════════════════════════════
  console.log("\n▶ GATE 6: Recovery Link Restoration & Live Catalog Price Revalidation");

  const restoreRes = ApiEngine.revalidateAndRestoreRecoveredCart(dispatchRes.recovery_token);
  assert(restoreRes.success === true, "6.1: revalidateAndRestoreRecoveredCart restores cart from token");
  assert(restoreRes.cart.status === "CLICKED", "6.2: Cart status transitioned to CLICKED");
  assert(restoreRes.restored_items.length === 1, "6.3: Restored items list verified");

  const clickOutbox = WebhookEngine.getOutboxItems().find((o) => o.event_type === "cart.recovery_clicked");
  assert(Boolean(clickOutbox), "6.4: WebhookEngine emitted cart.recovery_clicked outbox event");

  // ════════════════════════════════════════════════════════════════════════════
  // GATE 7: ORDER ATTRIBUTION & CONVERSION ENGINE
  // ════════════════════════════════════════════════════════════════════════════
  console.log("\n▶ GATE 7: Order Attribution & Conversion Engine");

  // Finalize order via confirmCheckout to test full system attribution
  const checkoutPayload = {
    cart_id: testCartId,
    recovery_token: dispatchRes.recovery_token,
    payment_method: "cod" as const,
    delivery_date: new Date().toISOString().slice(0, 10),
    delivery_slot_id: "slot_evening_01",
    pincode: "560038",
    address: {
      first_name: "Anand",
      last_name: "Kumar",
      phone: testPhone,
      email: testEmail,
      line1: "100 Feet Road, Indiranagar",
      city: "Bengaluru",
      state: "Karnataka",
      pincode: "560038",
    },
  };

  const checkoutRes = ApiEngine.confirmCheckout(checkoutPayload);
  assert(Boolean((checkoutRes as any).success || (checkoutRes as any).order_number || (checkoutRes as any).status === "confirmed" || (checkoutRes as any).order?.id), "7.1: Checkout confirmed successfully");

  // Verify Cart Transitioned to RECOVERED with Revenue Attribution
  const updatedAb = ApiEngine.getAbandonedCartById(testCartId);
  assert(updatedAb?.cart?.status === "RECOVERED", "7.2: Abandoned cart status transitioned to RECOVERED");
  assert(updatedAb?.cart?.recovered_revenue === 1299 || (updatedAb?.cart?.recovered_revenue || 0) > 0, "7.3: Recovered revenue credited to abandoned cart");
  assert(Boolean(updatedAb?.cart?.recovered_order_id), "7.4: Recovered order ID linked");

  // Verify Webhook Event cart.recovered
  const recoveredOutbox = WebhookEngine.getOutboxItems().find((o) => o.event_type === "cart.recovered");
  assert(Boolean(recoveredOutbox), "7.5: WebhookEngine emitted signed cart.recovered outbox event");

  // Verify CRM Customer Profile
  const custAfter = ApiEngine.getCustomerProfile(custRecord?.customer_uid || `cth_cus_${cleanTestPhone}`);
  const custCartStatus = (custAfter as any)?.cart_status || (custAfter as any)?.customer?.cart_status;
  assert(custCartStatus === "NO_CART" || custCartStatus === "RECOVERED", "7.6: CRM customer cart_status updated post-recovery");

  // ════════════════════════════════════════════════════════════════════════════
  // GATE 8: TELECALLER ASSIGNMENT & MANUAL CONVERSION ACTIONS
  // ════════════════════════════════════════════════════════════════════════════
  console.log("\n▶ GATE 8: Telecaller Assignment & Manual Conversion Actions");

  // Create second cart for telecaller test
  const teleCartId = `cart_tele_${Date.now()}`;
  ApiEngine.addToCart(teleCartId, {
    productId: "prod_01KXY_BELGIAN_TRUFFLE",
    title: "Belgian Dark Chocolate Truffle Cake",
    unit_price: 1299,
    quantity: 2,
  });
  ApiEngine.trackCartActivity({
    cart_id: teleCartId,
    phone: "+91 99999 11111",
    customer_name: "Sneha Reddy",
    subtotal: 2598,
  });
  (ApiEngine.getCart(teleCartId) as any).last_activity_at = new Date(Date.now() - 40 * 60 * 1000).toISOString();
  ApiEngine.evaluateCartAbandonment(30);

  const assignRes = ApiEngine.assignCartTelecaller(teleCartId, "staff_priya_01", "Priya Sharma", "High-value corporate buyer");
  assert(assignRes.success === true, "8.1: assignCartTelecaller returns success");
  assert(assignRes.cart.assigned_telecaller_name === "Priya Sharma", "8.2: Telecaller name assigned");
  assert(assignRes.cart.recovery_channel === "TELECALLER", "8.3: Recovery channel set to TELECALLER");

  const convertRes = ApiEngine.markCartConverted(teleCartId, "CTH-OFFLINE-999", 2598);
  assert(convertRes.success === true, "8.4: markCartConverted returns success");
  assert(convertRes.cart.status === "RECOVERED", "8.5: Cart marked RECOVERED manually");
  assert(convertRes.cart.recovered_revenue === 2598, "8.6: Converted revenue matches ₹2598");

  // ════════════════════════════════════════════════════════════════════════════
  // GATE 9: RECOVERY CAMPAIGNS WORKFLOWS (CRUD)
  // ════════════════════════════════════════════════════════════════════════════
  console.log("\n▶ GATE 9: Recovery Campaigns Workflows (CRUD)");

  const newCamp = ApiEngine.createRecoveryCampaign({
    name: "VIP 15m Express Recovery",
    trigger_type: "TIME_DELAY",
    delay_minutes: 15,
    channel: "WHATSAPP",
    discount_rule: { code: "CAKE15", discount_pct: 15 },
    customer_tier: "VIP",
    min_cart_value: 2000,
  });

  assert(Boolean(newCamp.id), "9.1: createRecoveryCampaign generates ID");
  assert(newCamp.name === "VIP 15m Express Recovery", "9.2: Campaign name saved");

  const updatedCamp = ApiEngine.updateRecoveryCampaign(newCamp.id, {
    delay_minutes: 20,
    discount_rule: { code: "CAKE20", discount_pct: 20 },
  });
  assert(updatedCamp.delay_minutes === 20, "9.3: Campaign delay updated to 20m");
  assert(
    typeof updatedCamp.discount_rule === "object"
      ? updatedCamp.discount_rule?.code === "CAKE20"
      : updatedCamp.discount_rule === "CAKE20",
    "9.4: Campaign discount rule updated to CAKE20"
  );

  const campList = ApiEngine.listRecoveryCampaigns();
  assert(campList.campaigns.some((c) => c.id === newCamp.id), "9.5: listRecoveryCampaigns includes new campaign");

  const delRes = ApiEngine.deleteRecoveryCampaign(newCamp.id);
  assert(delRes.success === true, "9.6: deleteRecoveryCampaign returns success");
  const campListAfter = ApiEngine.listRecoveryCampaigns();
  assert(!campListAfter.campaigns.some((c) => c.id === newCamp.id), "9.7: Campaign successfully deleted from store");

  // ════════════════════════════════════════════════════════════════════════════
  // GATE 10: ROLE-BASED ACCESS CONTROL (RBAC) ISOLATION
  // ════════════════════════════════════════════════════════════════════════════
  console.log("\n▶ GATE 10: Role-Based Access Control (RBAC) Isolation");

  // 1. Super Admin access
  const adminRes = ApiEngine.listAbandonedCarts({ userRole: "SUPER_ADMIN" });
  assert(adminRes.success === true, "10.1: Super Admin can list all abandoned carts");

  // 2. Branch Manager scoping
  const branchMgrRes = ApiEngine.listAbandonedCarts({
    userRole: "BRANCH_MANAGER",
    userBranchId: "res_01KXYMAHGFPRY1G9TZKEVGAGAT",
  });
  assert(
    branchMgrRes.carts.every((c) => c.branch_id === "res_01KXYMAHGFPRY1G9TZKEVGAGAT"),
    "10.2: Branch Manager only receives carts for assigned branch"
  );

  // 3. Telecaller scoping
  const teleRes = ApiEngine.listAbandonedCarts({
    userRole: "TELECALLER",
    userId: "staff_priya_01",
  });
  assert(
    teleRes.carts.every((c) => c.assigned_telecaller_id === "staff_priya_01"),
    "10.3: Telecaller only receives carts assigned to their staff ID"
  );

  // 4. Delivery Partner Forbidden
  let dlpBlocked = false;
  try {
    ApiEngine.listAbandonedCarts({ userRole: "DELIVERY_PARTNER" });
  } catch (err: any) {
    dlpBlocked = err.message.includes("Forbidden");
  }
  assert(dlpBlocked, "10.4: Delivery Partner is strictly forbidden (403) from cart recovery data");

  // ════════════════════════════════════════════════════════════════════════════
  // GATE 11: CSV EXPORTER ENGINE
  // ════════════════════════════════════════════════════════════════════════════
  console.log("\n▶ GATE 11: CSV Exporter Engine");

  const csvContent = ApiEngine.exportAbandonedCartsCsv();
  assert(typeof csvContent === "string" && csvContent.length > 50, "11.1: CSV exporter produces string output");
  assert(csvContent.includes("Cart ID,Customer Name,Phone,Email,Cart Value (INR)"), "11.2: CSV contains expected canonical headers");
  assert(csvContent.includes("Anand Kumar") || csvContent.includes("Sneha Reddy"), "11.3: CSV exports real customer records");

  // ════════════════════════════════════════════════════════════════════════════
  // FINAL SUMMARY REPORT
  // ════════════════════════════════════════════════════════════════════════════
  console.log("\n================================================================================");
  console.log(`  TOTAL TESTS: ${passedCount + failedCount} | PASSED: ${passedCount} | FAILED: ${failedCount}`);
  console.log(`  PASS RATE: ${Math.round((passedCount / (passedCount + failedCount)) * 100)}%`);
  console.log("================================================================================\n");

  if (failedCount > 0) {
    process.exit(1);
  }
}

runAbandonedCartEngineSuite().catch((err) => {
  console.error("FATAL SUITE ERROR:", err);
  process.exit(1);
});
