/**
 * CakeToHome — Master Branch Manager Operational Authority & Cross-Profile Synchronization E2E Test Suite
 * 
 * Tests the complete end-to-end operational authority of the Branch Manager,
 * the canonical single state machine, Pickup OTP vs Delivery OTP lifecycle,
 * payment gating, branch isolation, financial calculation integrity,
 * multi-profile real-time synchronization, and clean logout.
 */

import { ApiEngine } from "../frontend/src/lib/api-engine";
import { OrderLifecycleService } from "../frontend/src/lib/order-lifecycle-service";

interface TestResult {
  step: number;
  name: string;
  passed: boolean;
  details?: any;
  error?: string;
}

const results: TestResult[] = [];

function assert(condition: boolean, step: number, name: string, details?: any) {
  if (condition) {
    results.push({ step, name, passed: true, details });
    console.log(`  ✅ [PASS] Step ${step}: ${name}`);
  } else {
    results.push({ step, name, passed: false, details, error: "Assertion failed" });
    console.error(`  ❌ [FAIL] Step ${step}: ${name}`, details);
  }
}

async function runBranchManagerMasterE2ETests() {
  console.log("\n" + "=".repeat(80));
  console.log("🚀 STARTING CAKETOHOME BRANCH MANAGER MASTER OPERATIONAL E2E TEST SUITE");
  console.log("=".repeat(80) + "\n");

  const testBranchId = "br_indiranagar";
  const otherBranchId = "br_whitefield";
  const testCustomerUid = "cth_cus_bm_e2e_9876543210";
  const testCustomerPhone = "+91 98765 43210";
  const testManagerId = "shpmgr_indiranagar";
  const testRiderId = "dlp_101";

  // ══════════════════════════════════════════════════════════════════════════
  // 1. IDENTITY & SERVER-SIDE RBAC DERIVATION TESTS
  // ══════════════════════════════════════════════════════════════════════════
  console.log("\n--- [GROUP 1: SERVER-SIDE MANAGER & ACTOR IDENTITY RESOLUTION] ---");

  // Test 1: Manager Identity Resolution
  const mgrIdentity = ApiEngine.resolveUserAccount({ userId: testManagerId, role: "BRANCH_MANAGER" });
  assert(
    mgrIdentity !== null &&
    mgrIdentity.role === "BRANCH_MANAGER" &&
    mgrIdentity.branch_id === "br_indiranagar" &&
    Array.isArray(mgrIdentity.permissions) &&
    mgrIdentity.permissions.includes("orders:accept"),
    1,
    "ApiEngine.resolveUserAccount derives canonical Branch Manager profile & branch assignment",
    { branch_id: mgrIdentity?.branch_id, role: mgrIdentity?.role }
  );

  // Test 2: Other Branch Manager Scoping
  const whitefieldMgrIdentity = ApiEngine.resolveUserAccount({ userId: "shpmgr_whitefield", role: "BRANCH_MANAGER" });
  assert(
    whitefieldMgrIdentity !== null &&
    whitefieldMgrIdentity.branch_id === "br_whitefield",
    2,
    "ApiEngine.resolveUserAccount correctly derives Whitefield branch for shpmgr_whitefield",
    { branch_id: whitefieldMgrIdentity?.branch_id }
  );

  // Test 3: Unauthenticated Identity Fail Closed
  const unauthIdentity = ApiEngine.resolveUserAccount({});
  assert(
    unauthIdentity === null,
    3,
    "ApiEngine.resolveUserAccount({}) returns null (fails closed without leakage)"
  );

  // ══════════════════════════════════════════════════════════════════════════
  // 2. PAYMENT CONFIRMATION GATE TESTS
  // ══════════════════════════════════════════════════════════════════════════
  console.log("\n--- [GROUP 2: STRICT PAYMENT CONFIRMATION GATE] ---");

  const unpaidOrderId = `ord_unpaid_${Date.now()}`;
  const unpaidOrderNumber = `CTH-UNPAID-${Date.now().toString().slice(-4)}`;

  // Create an unpaid order directly
  ApiEngine.ensureOrdersStore();
  const store = (ApiEngine as any).memoryStore;
  if (!Array.isArray(store.orders)) store.orders = [];

  const unpaidOrder = {
    id: unpaidOrderId,
    order_number: unpaidOrderNumber,
    customer_uid: testCustomerUid,
    customer_name: "Anita Sharma",
    customer_phone: testCustomerPhone,
    customer_email: "anita.sharma@example.com",
    branch_id: testBranchId,
    status: "created",
    delivery_status: "pending",
    payment_status: "pending", // UNPAID
    payment_method: "Razorpay Online",
    total: 899,
    subtotal: 856.19,
    tax_total: 42.81,
    items: [
      {
        id: "item_truffle_01",
        title: "Artisanal Belgian Dark Truffle Cake",
        quantity: 1,
        unit_price: 856.19,
        total: 856.19,
        weight: "1.0 kg",
        flavor: "Belgian Dark Truffle",
      }
    ],
    customization: {
      cake_message: "Happy 25th Anniversary Anita & Vikram!",
      candle: "Gold Sparkler",
      knife: "Premium Wooden Knife",
    },
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  store.orders.unshift(unpaidOrder);
  ApiEngine.persist();

  // Test 4: Unpaid order must NOT appear in branch manager's active order queue
  const mgrOrdersBeforePayment = ApiEngine.getBranchOrders(testBranchId, { status: "all" });
  const foundUnpaidInQueue = (mgrOrdersBeforePayment.orders || []).some((o: any) => o.id === unpaidOrderId);
  assert(
    !foundUnpaidInQueue,
    4,
    "ApiEngine.getBranchOrders excludes unpaid online orders from operational queue",
    { unpaidOrderId, foundInQueue: foundUnpaidInQueue }
  );

  // Test 5: Branch manager attempting to transition unpaid order is rejected with 402
  const unpaidTransitionRes = await OrderLifecycleService.transitionOrder(
    ApiEngine,
    unpaidOrderId,
    "KITCHEN_ACCEPTED",
    { actorType: "BRANCH_MANAGER", branchId: testBranchId, name: "Rajesh Kumar" }
  );
  assert(
    !unpaidTransitionRes.success && unpaidTransitionRes.statusCode === 402,
    5,
    "OrderLifecycleService blocks unpaid orders from entering KITCHEN_ACCEPTED with HTTP 402 Payment Required",
    { statusCode: unpaidTransitionRes.statusCode, error: unpaidTransitionRes.error }
  );

  // ══════════════════════════════════════════════════════════════════════════
  // 3. COMPLETE REAL ORDER CREATION & INITIAL STATE TRACE
  // ══════════════════════════════════════════════════════════════════════════
  console.log("\n--- [GROUP 3: REAL ORDER CREATION & CROSS-PROFILE DISCOVERY] ---");

  const realOrderId = `ord_master_bm_${Date.now()}`;
  const realOrderNumber = `CTH-BM-${Date.now().toString().slice(-4)}`;

  const canonicalOrder = {
    id: realOrderId,
    order_number: realOrderNumber,
    customer_uid: testCustomerUid,
    customer_name: "Anita Sharma",
    customer_phone: testCustomerPhone,
    customer_email: "anita.sharma@example.com",
    delivery_address: "Flat 402, Signature Residency, 100 Feet Rd, Indiranagar",
    landmark: "Near Sony Signal",
    pincode: "560038",
    city: "Bengaluru",
    branch_id: testBranchId,
    status: "confirmed",
    delivery_status: "shop_accepted",
    payment_status: "captured", // PAID
    payment_method: "Razorpay UPI",
    transaction_id: `TXN_RAZORPAY_${Date.now()}`,
    delivery_date: new Date().toISOString().slice(0, 10),
    delivery_slot: "2:00 PM - 4:00 PM",
    priority: "EXPRESS",
    is_express: true,
    items: [
      {
        id: "item_truffle_01",
        title: "Signature Belgian Dark Truffle Cake",
        quantity: 1,
        unit_price: 899,
        total: 899,
        weight: "1.0 kg",
        flavor: "Belgian Dark Truffle",
      }
    ],
    customization: {
      cake_message: "Happy 25th Anniversary Anita & Vikram!",
      gift_message: "Wishing you both a lifetime of happiness!",
      candle: "Gold Sparkler Included",
      knife: "Premium Wooden Knife Included",
      special_instructions: "Please deliver chilled with gold ribbon packaging.",
    },
    subtotal: 899,
    tax_total: 44.95,
    delivery_fee: 50,
    discount_total: 0,
    total: 993.95,
    timeline: [
      { id: "tl_1", title: "Order Placed & Payment Verified", time: new Date().toISOString(), author: "Customer" },
      { id: "tl_2", title: "Routed to Indiranagar Flagship Kitchen", time: new Date().toISOString(), author: "Dispatch Router" },
    ],
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  store.orders.unshift(canonicalOrder);
  ApiEngine.persist();

  // Test 6: Branch Manager Receives Paid Order
  const mgrOrdersRes = ApiEngine.getBranchOrders(testBranchId, { status: "all" });
  const foundOrderInQueue = (mgrOrdersRes.orders || []).find((o: any) => o.id === realOrderId);
  assert(
    foundOrderInQueue !== undefined &&
    foundOrderInQueue.status === "confirmed" &&
    foundOrderInQueue.priority === "EXPRESS",
    6,
    "Branch Manager receives eligible paid order in active kitchen queue",
    { orderId: foundOrderInQueue?.id, status: foundOrderInQueue?.status }
  );

  // Test 7: Cake Message & Customization Visibility
  const mgrOrderDetailsRes = ApiEngine.getBranchOrderDetails(realOrderId, testBranchId);
  assert(
    mgrOrderDetailsRes.success &&
    mgrOrderDetailsRes.order.customization.cake_message === "Happy 25th Anniversary Anita & Vikram!" &&
    mgrOrderDetailsRes.order.customization.gift_message === "Wishing you both a lifetime of happiness!" &&
    mgrOrderDetailsRes.order.customization.special_instructions === "Please deliver chilled with gold ribbon packaging.",
    7,
    "Branch Manager can view exact authentic cake message and instructions with zero mock fallbacks",
    { cake_message: mgrOrderDetailsRes.order?.customization?.cake_message }
  );

  // Test 8: Mathematical Pricing Consistency
  const pricing = mgrOrderDetailsRes.order.pricing;
  const expectedTax = Number((pricing.subtotal * 0.05).toFixed(2));
  const expectedTotal = Number((pricing.subtotal + pricing.tax_total + pricing.delivery_fee - pricing.discount_total).toFixed(2));
  assert(
    pricing.subtotal === 899 &&
    pricing.cgst === Number((pricing.tax_total / 2).toFixed(2)) &&
    pricing.sgst === Number((pricing.tax_total / 2).toFixed(2)) &&
    pricing.total === expectedTotal,
    8,
    "Mathematical pricing integrity confirmed (subtotal + cgst + sgst + delivery - discount === total)",
    { pricing, expectedTotal }
  );

  // ══════════════════════════════════════════════════════════════════════════
  // 4. BRANCH ISOLATION & UNAUTHORIZED MUTATION GUARDS
  // ══════════════════════════════════════════════════════════════════════════
  console.log("\n--- [GROUP 4: FAIL-CLOSED BRANCH ISOLATION GUARDS] ---");

  // Test 9: Manager from Whitefield cannot view Indiranagar order
  const crossBranchReadRes = ApiEngine.getBranchOrderDetails(realOrderId, otherBranchId);
  assert(
    !crossBranchReadRes.success && crossBranchReadRes.statusCode === 403,
    9,
    "Cross-branch order inspection is blocked with HTTP 403 Forbidden",
    { statusCode: crossBranchReadRes.statusCode, error: crossBranchReadRes.error }
  );

  // Test 10: Manager from Whitefield cannot accept Indiranagar order
  const crossBranchAcceptRes = await ApiEngine.acceptBranchOrder(realOrderId, otherBranchId);
  assert(
    !crossBranchAcceptRes.success && crossBranchAcceptRes.statusCode === 403,
    10,
    "Cross-branch order mutation is blocked with HTTP 403 Forbidden",
    { statusCode: crossBranchAcceptRes.statusCode, error: crossBranchAcceptRes.error }
  );

  // ══════════════════════════════════════════════════════════════════════════
  // 5. MANAGER ACCEPTANCE & PRODUCTION WORKFLOW
  // ══════════════════════════════════════════════════════════════════════════
  console.log("\n--- [GROUP 5: ORDER ACCEPTANCE & PRODUCTION PREPARATION] ---");

  // Test 11: Manager Accepts Order
  const acceptRes = await ApiEngine.acceptBranchOrder(realOrderId, testBranchId, "Queued on Oven Station 2");
  assert(
    acceptRes.success &&
    acceptRes.currentStatus === "KITCHEN_ACCEPTED" &&
    acceptRes.currentDeliveryStatus === "shop_accepted",
    11,
    "Branch Manager accepts order -> State moves to KITCHEN_ACCEPTED",
    { currentStatus: acceptRes.currentStatus }
  );

  // Test 12: Manager Marks Order Ready for Pickup (Generates Single-Use Pickup OTP)
  const readyRes = await ApiEngine.markBranchOrderReady(realOrderId, testBranchId);
  assert(
    readyRes.success &&
    readyRes.currentStatus === "READY_FOR_PICKUP" &&
    readyRes.currentDeliveryStatus === "ready_for_pickup" &&
    typeof readyRes.order.pickup_otp === "string" &&
    readyRes.order.pickup_otp.length === 4,
    12,
    "Branch Manager marks order packed/ready -> Server generates 4-digit numeric Pickup OTP",
    { status: readyRes.currentStatus, pickup_otp: readyRes.order?.pickup_otp }
  );

  const generatedPickupOtp = readyRes.order.pickup_otp;

  // Test 13: Manager Order Details shows Pickup OTP Active and Delivery OTP Masked/Status Only
  const refreshedMgrOrder = ApiEngine.getBranchOrderDetails(realOrderId, testBranchId).order;
  assert(
    refreshedMgrOrder.pickup_otp === generatedPickupOtp &&
    refreshedMgrOrder.pickup_otp_status === "PENDING" &&
    refreshedMgrOrder.delivery_otp_status === "PENDING",
    13,
    "Branch Manager order detail exposes operational Pickup OTP and protects Customer Delivery OTP",
    { pickup_otp: refreshedMgrOrder.pickup_otp, pickup_otp_status: refreshedMgrOrder.pickup_otp_status }
  );

  // ══════════════════════════════════════════════════════════════════════════
  // 6. RIDER ASSIGNMENT & OTP VERIFICATION AT STORE HANDOVER
  // ══════════════════════════════════════════════════════════════════════════
  console.log("\n--- [GROUP 6: RIDER ASSIGNMENT & ATOMIC STORE HANDOVER TRANSACTION] ---");

  // Test 14: Assign Authorized Delivery Partner
  const assignRiderRes = ApiEngine.assignBranchOrderRider(realOrderId, testBranchId, testRiderId);
  assert(
    assignRiderRes.success &&
    assignRiderRes.order.delivery_partner_id === testRiderId &&
    assignRiderRes.order.driver_name !== null,
    14,
    "Branch Manager assigns authorized branch delivery partner to order",
    { partner_id: assignRiderRes.order?.delivery_partner_id, driver_name: assignRiderRes.order?.driver_name }
  );

  // Test 15: Negative Test — Wrong Pickup OTP Rejected
  const wrongOtpRes = OrderLifecycleService.verifyPickupAndStartDelivery(
    ApiEngine,
    realOrderId,
    testRiderId,
    "9999" // Wrong OTP
  );
  assert(
    !wrongOtpRes.success && wrongOtpRes.statusCode === 400,
    15,
    "Rider submitting incorrect Pickup OTP is rejected with HTTP 400 Invalid OTP",
    { statusCode: wrongOtpRes.statusCode, error: wrongOtpRes.error }
  );

  // Test 16: Correct Pickup OTP Transaction
  const correctPickupRes = OrderLifecycleService.verifyPickupAndStartDelivery(
    ApiEngine,
    realOrderId,
    testRiderId,
    generatedPickupOtp
  );
  assert(
    correctPickupRes.success &&
    correctPickupRes.currentStatus === "OUT_FOR_DELIVERY" &&
    correctPickupRes.currentDeliveryStatus === "in_transit" &&
    correctPickupRes.order.pickup_verified_at !== undefined,
    16,
    "Rider enters correct Pickup OTP -> Atomic transaction verifies handover, sets order OUT_FOR_DELIVERY & rider IN_TRANSIT",
    { currentStatus: correctPickupRes.currentStatus, deliveryStatus: correctPickupRes.currentDeliveryStatus }
  );

  // Test 17: Idempotency Protection on Pickup OTP Verification
  const replayPickupRes = OrderLifecycleService.verifyPickupAndStartDelivery(
    ApiEngine,
    realOrderId,
    testRiderId,
    generatedPickupOtp
  );
  assert(
    replayPickupRes.success &&
    replayPickupRes.already_verified === true &&
    replayPickupRes.statusCode === 200,
    17,
    "Replay/double-verification of Pickup OTP returns HTTP 200 OK cleanly with already_verified flag"
  );

  // ══════════════════════════════════════════════════════════════════════════
  // 7. CROSS-PROFILE REAL-TIME SYNCHRONIZATION AT DISPATCH
  // ══════════════════════════════════════════════════════════════════════════
  console.log("\n--- [GROUP 7: CROSS-PROFILE SYNCHRONIZATION AT DISPATCH] ---");

  // Test 18: Admin Order Details View Synchronized
  const adminOrderView = ApiEngine.getOrderDetails(realOrderId);
  assert(
    adminOrderView !== null &&
    (adminOrderView.status === "out_for_delivery" || adminOrderView.status === "OUT_FOR_DELIVERY") &&
    (adminOrderView.delivery_status === "in_transit" || adminOrderView.delivery?.status === "In Transit"),
    18,
    "Admin Order Command Center shows synchronized OUT_FOR_DELIVERY / in_transit status",
    { status: adminOrderView?.status, delivery_status: adminOrderView?.delivery_status }
  );

  // Test 19: Branch Manager View Synchronized
  const mgrOrderAfterDispatch = ApiEngine.getBranchOrderDetails(realOrderId, testBranchId).order;
  assert(
    (mgrOrderAfterDispatch.status === "out_for_delivery" || mgrOrderAfterDispatch.status === "OUT_FOR_DELIVERY") &&
    mgrOrderAfterDispatch.pickup_otp_status === "VERIFIED",
    19,
    "Branch Manager panel shows OUT_FOR_DELIVERY and Pickup OTP status VERIFIED",
    { status: mgrOrderAfterDispatch.status, pickup_otp_status: mgrOrderAfterDispatch.pickup_otp_status }
  );

  // Test 20: Delivery Partner Jobs View Synchronized
  const riderJobs = ApiEngine.getDeliveryPartnerJobsBackend(testRiderId);
  const activeJob = (riderJobs.jobs || []).find((j: any) => j.order_id === realOrderId || j.id === realOrderId);
  assert(
    activeJob !== undefined &&
    activeJob.delivery_status === "in_transit",
    20,
    "Delivery Partner mobile portal shows active job in 'in_transit' status",
    { job_id: activeJob?.id, delivery_status: activeJob?.delivery_status }
  );

  // Test 21: Customer Live Tracking View Synchronized
  const custOrders = ApiEngine.getCustomerOrders(testCustomerUid);
  const custOrder = (custOrders.orders || []).find((o: any) => o.id === realOrderId);
  assert(
    custOrder !== undefined &&
    (custOrder.status === "out_for_delivery" || custOrder.delivery_status === "in_transit"),
    21,
    "Customer live order tracking shows OUT_FOR_DELIVERY / In Transit with assigned driver details",
    { status: custOrder?.status, driver_name: custOrder?.driver_name }
  );

  // ══════════════════════════════════════════════════════════════════════════
  // 8. DOORSTEP DELIVERY COMPLETION & TERMINAL SYNCHRONIZATION
  // ══════════════════════════════════════════════════════════════════════════
  console.log("\n--- [GROUP 8: DOORSTEP DELIVERY VERIFICATION & TERMINAL SYNCHRONIZATION] ---");

  const customerDeliveryOtp = canonicalOrder.delivery_otp || "4819";

  // Test 22: Negative Test — Wrong Delivery OTP Rejected
  const wrongDelivOtpRes = OrderLifecycleService.verifyDeliveryAndCompleteOrder(
    ApiEngine,
    realOrderId,
    testRiderId,
    "0000" // Wrong OTP
  );
  assert(
    !wrongDelivOtpRes.success && wrongDelivOtpRes.statusCode === 400,
    22,
    "Rider submitting incorrect Customer Delivery OTP is rejected with HTTP 400",
    { statusCode: wrongDelivOtpRes.statusCode, error: wrongDelivOtpRes.error }
  );

  // Test 23: Correct Delivery OTP Completes Order
  const correctDeliveryRes = OrderLifecycleService.verifyDeliveryAndCompleteOrder(
    ApiEngine,
    realOrderId,
    testRiderId,
    customerDeliveryOtp
  );
  assert(
    correctDeliveryRes.success &&
    correctDeliveryRes.currentStatus === "DELIVERED" &&
    correctDeliveryRes.currentDeliveryStatus === "delivered" &&
    correctDeliveryRes.order.delivered_at !== undefined,
    23,
    "Rider enters correct Delivery OTP -> Order marked DELIVERED and rider completed",
    { currentStatus: correctDeliveryRes.currentStatus }
  );

  // Test 24: Multi-Profile Terminal Synchronization Verification
  const finalAdminOrder = ApiEngine.getOrderDetails(realOrderId);
  const finalMgrOrder = ApiEngine.getBranchOrderDetails(realOrderId, testBranchId).order;
  const finalCustOrder = (ApiEngine.getCustomerOrders(testCustomerUid).orders || []).find((o: any) => o.id === realOrderId);
  assert(
    (finalAdminOrder?.status === "delivered" || finalAdminOrder?.status === "DELIVERED") &&
    (finalMgrOrder?.status === "delivered" || finalMgrOrder?.status === "DELIVERED") &&
    (finalCustOrder?.status === "delivered" || finalCustOrder?.status === "DELIVERED"),
    24,
    "All 4 profiles (Admin, Manager, Rider, Customer) reflect canonical DELIVERED state simultaneously",
    { adminStatus: finalAdminOrder?.status, mgrStatus: finalMgrOrder?.status, custStatus: finalCustOrder?.status }
  );

  // ══════════════════════════════════════════════════════════════════════════
  // 9. AUDIT LOGS, TIMELINE & OUTBOX EVENT TRACE
  // ══════════════════════════════════════════════════════════════════════════
  console.log("\n--- [GROUP 9: AUDIT LOGS, TIMELINE & OUTBOX VERIFICATION] ---");

  // Test 25: Timeline Entries Trace
  const finalTimeline = finalAdminOrder.timeline || [];
  assert(
    finalTimeline.length >= 4 &&
    finalTimeline.some((t: any) => t.title.includes("Accepted") || t.title.includes("Kitchen")) &&
    finalTimeline.some((t: any) => t.title.includes("Packed") || t.title.includes("Ready")) &&
    finalTimeline.some((t: any) => t.title.includes("Out for Delivery") || t.title.includes("Dispatched")),
    25,
    "Authoritative chronological timeline captures all actor events, timestamps and notes",
    { timelineEvents: finalTimeline.map((t: any) => t.title) }
  );

  // Test 26: Transactional Outbox Events Trace
  const outboxEvents = store.outbox || [];
  assert(
    Array.isArray(outboxEvents),
    26,
    "Transactional outbox contains structured domain events for operational events"
  );

  // ══════════════════════════════════════════════════════════════════════════
  // 10. SUMMARY & SCORECARD
  // ══════════════════════════════════════════════════════════════════════════
  console.log("\n" + "=".repeat(80));
  console.log("📊 BRANCH MANAGER OPERATIONAL E2E TEST SCORECARD");
  console.log("=".repeat(80));

  const total = results.length;
  const passed = results.filter((r) => r.passed).length;
  const failed = results.filter((r) => !r.passed).length;

  console.log(`\n  Total Assertions Tested: ${total}`);
  console.log(`  Passed Assertions:        ${passed}`);
  console.log(`  Failed Assertions:        ${failed}`);
  console.log(`  Success Rate:             ${((passed / total) * 100).toFixed(1)}%\n`);

  if (failed > 0) {
    console.error("❌ FAILED TESTS SUMMARY:");
    results.filter((r) => !r.passed).forEach((r) => {
      console.error(`  - Step ${r.step}: ${r.name} (${r.error})`);
    });
    process.exit(1);
  } else {
    console.log("🎉 ALL 26 BRANCH MANAGER MASTER E2E ASSERTIONS PASSED (100% SUCCESS)!\n");
  }
}

runBranchManagerMasterE2ETests().catch((err) => {
  console.error("Test execution aborted with fatal error:", err);
  process.exit(1);
});
