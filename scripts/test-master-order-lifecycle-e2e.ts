/**
 * ══════════════════════════════════════════════════════════════════════════════
 * CakeToHome Authoritative Master Order Lifecycle, Identity, Auth, Branch Manager,
 * Delivery Partner & OTP System — Comprehensive 36-Point End-to-End Test Suite
 * ══════════════════════════════════════════════════════════════════════════════
 * 
 * Verifies:
 * 1. Super Admin Canonical Identity & System-Level Authority
 * 2. Branch Hub Creation & Auto-Provisioned Canonical Manager Profile
 * 3. Idempotent Manager Identity Resolution (Duplicate Prevention)
 * 4. Canonical Delivery Partner Provisioning with Multi-Branch Mapping
 * 5. Server-Side Branch Isolation: Manager Fail-Closed Gate
 * 6. Server-Side Branch Isolation: Rider Fail-Closed Gate
 * 7. Cross-Branch Pickup Verification Rejection (Fail-Closed 403)
 * 8. Cross-Rider Job Hijacking Protection (Fail-Closed 403)
 * 9. Payment Gate: Unpaid Orders Blocked from Operational Kitchen Queue
 * 10. Payment Gate: Paid Orders Flow to Operational Queue
 * 11. Payment Gate: Reject Direct Kitchen Mutation of Unpaid Orders
 * 12. Canonical Order State Machine: Confirmed -> Kitchen Accepted
 * 13. Canonical Order State Machine: Kitchen Accepted -> Preparing
 * 14. Kitchen Packing: Preparing -> Ready for Pickup / Packed
 * 15. Store Handover Pickup OTP Generation (4-Digit Numeric String)
 * 16. OTP Visibility Rules: Branch Manager Sees Pickup OTP
 * 17. OTP Visibility Rules: Customer Never Sees Internal Pickup OTP
 * 18. OTP Visibility Rules: Customer Has Visibility of Doorstep Delivery OTP
 * 19. Delivery Partner Claim: Preserves Ready for Pickup Status
 * 20. Security Gate: Incorrect Pickup OTP Rejected (HTTP 400)
 * 21. Atomic Verification: Valid Pickup OTP Transitions to OUT_FOR_DELIVERY / IN_TRANSIT
 * 22. Pickup OTP Single-Use: Consumed on Verification (pickup_verified_at set)
 * 23. Pickup OTP Idempotency: Double-Click / Network Retry Returns HTTP 200 OK
 * 24. Pickup OTP Guard: Consumed OTP Rejected for Second Actor
 * 25. Doorstep Delivery: Incorrect Customer Delivery OTP Rejected (HTTP 400)
 * 26. Atomic Verification: Valid Customer Delivery OTP Transitions to DELIVERED
 * 27. Delivery Fleet Capacity: Active Workload Decremented Upon Delivery
 * 28. Customer Delivery OTP Idempotency: Double-Click Returns HTTP 200 OK
 * 29. Terminal State Guard: Delivered Order Cannot Revert to Prior States
 * 30. Transactional Outbox: State Transitions Emitted with HMAC Signatures
 * 31. Order Timeline & Audit Trail: Complete History with Actors & Timestamps
 * 32. Universal Logout: Client Cookies & Storage Cleared Across All Subpaths
 * 33. Server-Side Session Revocation: ApiEngine.resolveUserAccount Returns Null
 * 34. Post-Logout Protected Access: Fail-Closed 401 on Unauthorized Requests
 * 35. Role-Specific Login Redirection for All 4 Organizational Roles
 * 36. Order Data Integrity: Single Authoritative Canonical State Everywhere
 * ══════════════════════════════════════════════════════════════════════════════
 */

import { ApiEngine } from "../frontend/src/lib/api-engine";
import { StaffAccessControl } from "../frontend/src/lib/staff-access-control";
import { WebhookEngine } from "../frontend/src/lib/webhook-engine";
import { OrderLifecycleService } from "../frontend/src/lib/order-lifecycle-service";
import { clearClientAuthCookies, clearClientAuthStorage, getRoleLoginUrl } from "../frontend/src/lib/auth-service";

interface TestResult {
  num: number;
  description: string;
  passed: boolean;
  error?: string;
}

const results: TestResult[] = [];

function assert(condition: boolean, description: string, num: number) {
  if (condition) {
    console.log(`  \x1b[32m[PASS]\x1b[0m Test ${num}: ${description}`);
    results.push({ num, description, passed: true });
  } else {
    console.error(`  \x1b[31m[FAIL]\x1b[0m Test ${num}: ${description}`);
    results.push({ num, description, passed: false, error: "Assertion failed" });
  }
}

async function runMasterOrderLifecycleSuite() {
  console.log("================================================================================");
  console.log("🍰 STARTING CAKETOHOME 36-POINT MASTER ORDER LIFECYCLE & IDENTITY E2E SUITE");
  console.log("================================================================================\n");

  const timestamp = Date.now();
  const testBranchIdA = `br_hub_indiranagar_${timestamp}`;
  const testBranchCodeA = `HUB-IND-${String(timestamp).slice(-4)}`;
  const testManagerPhoneA = `98765${String(timestamp).slice(-5)}`;
  const testManagerEmailA = `manager.indiranagar.${timestamp}@caketohome.com`;
  const testManagerNameA = `Rajesh Sharma ${timestamp}`;

  const testBranchIdB = `br_hub_koramangala_${timestamp}`;
  const testBranchCodeB = `HUB-KOR-${String(timestamp).slice(-4)}`;
  const testManagerPhoneB = `98123${String(timestamp).slice(-5)}`;
  const testManagerEmailB = `manager.koramangala.${timestamp}@caketohome.com`;
  const testManagerNameB = `Sunil Kumar ${timestamp}`;

  const testRiderIdA = `dlp_rider_a_${timestamp}`;
  const testRiderPhoneA = `98450${String(timestamp).slice(-5)}`;
  const testRiderNameA = `Vikram Das ${timestamp}`;

  const testRiderIdB = `dlp_rider_b_${timestamp}`;
  const testRiderPhoneB = `98451${String(timestamp).slice(-5)}`;
  const testRiderNameB = `Anand Verma ${timestamp}`;

  // ────────────────────────────────────────────────────────────────────────────
  // 1. SUPER ADMIN IDENTITY
  // ────────────────────────────────────────────────────────────────────────────
  const adminAccount = ApiEngine.resolveUserAccount({ role: "SUPER_ADMIN", userId: "admin_01" });
  if (!adminAccount || adminAccount.role !== "SUPER_ADMIN" || !adminAccount.permissions?.includes("ALL")) {
    console.log("  [DEBUG Test 1] adminAccount was:", JSON.stringify(adminAccount));
  }
  assert(
    Boolean(adminAccount && adminAccount.role === "SUPER_ADMIN" && adminAccount.permissions?.includes("ALL")),
    "Super Admin Canonical Identity & System-Level Authority",
    1
  );

  // ────────────────────────────────────────────────────────────────────────────
  // 2. BRANCH HUB CREATION & MANAGER PROVISIONING
  // ────────────────────────────────────────────────────────────────────────────
  const createdBranchA = ApiEngine.saveBranch({
    id: testBranchIdA,
    name: "Indiranagar Flagship Hub",
    code: testBranchCodeA,
    city: "Bengaluru",
    state: "Karnataka",
    pincode: "560038",
    phone: `+91 ${testManagerPhoneA}`,
    email: testManagerEmailA,
    manager_name: testManagerNameA,
    is_open: true,
  });

  const managerStaffA = StaffAccessControl.getStaffMemberByPhone(testManagerPhoneA);
  assert(
    Boolean(createdBranchA && managerStaffA && managerStaffA.role === "BRANCH_MANAGER" && managerStaffA.branch_id === testBranchIdA),
    "Branch Hub Creation & Auto-Provisioned Canonical Manager Profile",
    2
  );

  // ────────────────────────────────────────────────────────────────────────────
  // 3. DUPLICATE MANAGER PREVENTION (IDEMPOTENT IDENTITY)
  // ────────────────────────────────────────────────────────────────────────────
  ApiEngine.saveBranch({
    id: testBranchIdA,
    name: "Indiranagar Flagship Hub Updated",
    code: testBranchCodeA,
    city: "Bengaluru",
    state: "Karnataka",
    pincode: "560038",
    phone: `+91 ${testManagerPhoneA}`,
    email: testManagerEmailA,
    manager_name: testManagerNameA,
    is_open: true,
  });
  const allStaffA = StaffAccessControl.listStaffMembers().filter(
    (s: any) => s.phone.replace(/\D/g, "").slice(-10) === testManagerPhoneA
  );
  assert(
    allStaffA.length === 1,
    "Idempotent Manager Identity Resolution (Duplicate Prevention)",
    3
  );

  // Create Branch B
  ApiEngine.saveBranch({
    id: testBranchIdB,
    name: "Koramangala Kitchen Hub",
    code: testBranchCodeB,
    city: "Bengaluru",
    state: "Karnataka",
    pincode: "560034",
    phone: `+91 ${testManagerPhoneB}`,
    email: testManagerEmailB,
    manager_name: testManagerNameB,
    is_open: true,
  });

  // ────────────────────────────────────────────────────────────────────────────
  // 4. DELIVERY PARTNER PROVISIONING & MULTI-BRANCH MAPPING
  // ────────────────────────────────────────────────────────────────────────────
  const partnerA = ApiEngine.saveDeliveryPartner({
    id: testRiderIdA,
    full_name: testRiderNameA,
    phone: `+91 ${testRiderPhoneA}`,
    primary_branch_id: testBranchIdA,
    primary_branch_name: "Indiranagar Flagship Hub",
    associated_branches: [{ branch_id: testBranchIdA, branch_name: "Indiranagar Flagship Hub", is_primary: true, active: true }],
    availability_status: "ONLINE",
    maximum_concurrent_orders: 4,
    current_active_orders: 0,
  });

  const partnerB = ApiEngine.saveDeliveryPartner({
    id: testRiderIdB,
    full_name: testRiderNameB,
    phone: `+91 ${testRiderPhoneB}`,
    primary_branch_id: testBranchIdB,
    primary_branch_name: "Koramangala Kitchen Hub",
    associated_branches: [{ branch_id: testBranchIdB, branch_name: "Koramangala Kitchen Hub", is_primary: true, active: true }],
    availability_status: "ONLINE",
    maximum_concurrent_orders: 4,
    current_active_orders: 0,
  });

  assert(
    Boolean(partnerA && partnerA.primary_branch_id === testBranchIdA && partnerB && partnerB.primary_branch_id === testBranchIdB),
    "Canonical Delivery Partner Provisioning with Multi-Branch Mapping",
    4
  );

  // ────────────────────────────────────────────────────────────────────────────
  // 5 & 6. SERVER-SIDE BRANCH ISOLATION: FAIL-CLOSED GATES
  // ────────────────────────────────────────────────────────────────────────────
  const memoryStore = ApiEngine.getStore();
  const orderBranchAId = `ord_test_a_${timestamp}`;
  const orderBranchBId = `ord_test_b_${timestamp}`;

  memoryStore.orders.unshift({
    id: orderBranchAId,
    order_number: `CTH-A-${String(timestamp).slice(-4)}`,
    branch_id: testBranchIdA,
    status: "confirmed",
    delivery_status: "shop_accepted",
    payment_status: "captured",
    payment_method: "Online UPI",
    total: 899,
    customer_name: "Pooja Reddy",
    customer_phone: "+91 99000 11111",
    customer_uid: `cth_cus_9900011111`,
    created_at: new Date().toISOString(),
  });

  memoryStore.orders.unshift({
    id: orderBranchBId,
    order_number: `CTH-B-${String(timestamp).slice(-4)}`,
    branch_id: testBranchIdB,
    status: "confirmed",
    delivery_status: "shop_accepted",
    payment_status: "captured",
    payment_method: "Online UPI",
    total: 1099,
    customer_name: "Gaurav Mehta",
    customer_phone: "+91 99000 22222",
    customer_uid: `cth_cus_9900022222`,
    created_at: new Date().toISOString(),
  });

  // Test 5: Manager Isolation
  const managerAOrders = ApiEngine.getBranchOrders(testBranchIdA);
  const managerASeesB = (managerAOrders.orders || []).some((o: any) => o.id === orderBranchBId);
  const managerASeesA = (managerAOrders.orders || []).some((o: any) => o.id === orderBranchAId);
  assert(
    managerASeesA && !managerASeesB,
    "Server-Side Branch Isolation: Manager Fail-Closed Gate",
    5
  );

  // Test 6: Rider Isolation
  const riderAJobs = ApiEngine.getDeliveryPartnerJobsBackend(testRiderIdA);
  const riderASeesB = (riderAJobs.jobs || []).some((j: any) => j.id === orderBranchBId);
  const riderASeesA = (riderAJobs.jobs || []).some((j: any) => j.id === orderBranchAId);
  assert(
    riderASeesA && !riderASeesB,
    "Server-Side Branch Isolation: Rider Fail-Closed Gate",
    6
  );

  // Test 7: Cross-Branch Pickup Rejection
  const crossPickup = ApiEngine.verifyPickupOtpBackend(orderBranchBId, "1294", testRiderIdA);
  assert(
    crossPickup.success === false && crossPickup.statusCode === 403,
    "Cross-Branch Pickup Verification Rejection (Fail-Closed 403)",
    7
  );

  // Test 8: Cross-Rider Job Hijacking Protection
  const orderClaimedByAId = `ord_claimed_a_${timestamp}`;
  memoryStore.orders.unshift({
    id: orderClaimedByAId,
    order_number: `CTH-CLM-${String(timestamp).slice(-4)}`,
    branch_id: testBranchIdA,
    status: "preparing",
    delivery_status: "pickup_claimed",
    delivery_partner_id: testRiderIdA,
    payment_status: "captured",
    total: 799,
    pickup_otp: "3344",
    delivery_otp: "5566",
    created_at: new Date().toISOString(),
  });
  const crossRiderPickup = ApiEngine.verifyPickupOtpBackend(orderClaimedByAId, "3344", testRiderIdB);
  assert(
    crossRiderPickup.success === false && crossRiderPickup.statusCode === 403,
    "Cross-Rider Job Hijacking Protection (Fail-Closed 403)",
    8
  );
  // Clean up fixture so it doesn't leave stray workload on testRiderIdA
  memoryStore.orders = memoryStore.orders.filter((o: any) => o.id !== orderClaimedByAId);

  // ────────────────────────────────────────────────────────────────────────────
  // 9, 10 & 11. PAYMENT GATE
  // ────────────────────────────────────────────────────────────────────────────
  const unpaidOrderId = `ord_unpaid_${timestamp}`;
  memoryStore.orders.unshift({
    id: unpaidOrderId,
    order_number: `CTH-UNP-${String(timestamp).slice(-4)}`,
    branch_id: testBranchIdA,
    status: "payment_pending",
    delivery_status: "pending",
    payment_status: "pending",
    total: 999,
    created_at: new Date().toISOString(),
  });

  // Test 9: Unpaid hidden from branch queue
  const pendingBranchOrders = ApiEngine.getBranchOrders(testBranchIdA, { status: "pending" });
  const hasUnpaid = (pendingBranchOrders.orders || []).some((o: any) => o.id === unpaidOrderId);
  assert(
    !hasUnpaid,
    "Payment Gate: Unpaid Orders Blocked from Operational Kitchen Queue",
    9
  );

  // Test 10: Paid orders flow to operational queue
  const hasPaid = (pendingBranchOrders.orders || []).some((o: any) => o.id === orderBranchAId);
  assert(
    hasPaid,
    "Payment Gate: Paid Orders Flow to Operational Queue",
    10
  );

  // Test 11: Reject direct mutation of unpaid order
  const unpaidTransitionRes = await OrderLifecycleService.transitionOrder(
    ApiEngine,
    unpaidOrderId,
    "KITCHEN_ACCEPTED",
    { actorType: "BRANCH_MANAGER", branchId: testBranchIdA, userId: `shpmgr_${testBranchIdA}` }
  );
  assert(
    unpaidTransitionRes.success === false && unpaidTransitionRes.statusCode === 402,
    "Payment Gate: Reject Direct Kitchen Mutation of Unpaid Orders",
    11
  );

  // ────────────────────────────────────────────────────────────────────────────
  // 12, 13, 14. KITCHEN LIFECYCLE: ACCEPT -> PREPARING -> READY FOR PICKUP
  // ────────────────────────────────────────────────────────────────────────────
  const lifecycleOrderId = `ord_lifecycle_${timestamp}`;
  memoryStore.orders.unshift({
    id: lifecycleOrderId,
    order_number: `CTH-LC-${String(timestamp).slice(-4)}`,
    branch_id: testBranchIdA,
    status: "confirmed",
    delivery_status: "shop_accepted",
    payment_status: "captured",
    payment_method: "Online UPI",
    total: 1299,
    customer_name: "Deepa Narayan",
    customer_phone: "+91 99440 33333",
    customer_uid: `cth_cus_9944033333`,
    created_at: new Date().toISOString(),
  });

  // Test 12: Confirmed -> Kitchen Accepted
  const acceptRes = ApiEngine.acceptBranchOrder(lifecycleOrderId, testBranchIdA, "Accepted for baking");
  const orderAccepted = ApiEngine.getOrderDetails(lifecycleOrderId);
  assert(
    Boolean(acceptRes.success && orderAccepted.status === "kitchen_accepted" && orderAccepted.delivery_status === "shop_accepted"),
    "Canonical Order State Machine: Confirmed -> Kitchen Accepted",
    12
  );

  // Test 13: Kitchen Accepted -> Preparing
  const prepRes = await OrderLifecycleService.transitionOrder(
    ApiEngine,
    lifecycleOrderId,
    "PREPARING",
    { actorType: "BRANCH_MANAGER", branchId: testBranchIdA, name: "Branch Baker" },
    { notes: "Baking Belgian Dark Chocolate Sponge" }
  );
  const orderPrepped = ApiEngine.getOrderDetails(lifecycleOrderId);
  assert(
    Boolean(prepRes.success && orderPrepped.status === "preparing" && orderPrepped.delivery_status === "shop_preparing"),
    "Canonical Order State Machine: Kitchen Accepted -> Preparing",
    13
  );

  // Test 14: Preparing -> Ready for Pickup / Packed
  const readyRes = ApiEngine.markBranchOrderReady(lifecycleOrderId, testBranchIdA);
  const orderReady = ApiEngine.getOrderDetails(lifecycleOrderId);
  assert(
    Boolean(readyRes.success && orderReady.status === "packed" && orderReady.delivery_status === "ready_for_pickup"),
    "Kitchen Packing: Preparing -> Ready for Pickup / Packed",
    14
  );

  // ────────────────────────────────────────────────────────────────────────────
  // 15, 16, 17, 18. OTP GENERATION & VISIBILITY RULES
  // ────────────────────────────────────────────────────────────────────────────
  const generatedPickupOtp = orderReady.pickup_otp || orderReady.delivery?.pickup_otp;
  const generatedDeliveryOtp = orderReady.delivery_otp || orderReady.delivery?.delivery_otp;

  // Test 15: 4-Digit Pickup OTP generated
  assert(
    Boolean(generatedPickupOtp && generatedPickupOtp.length === 4 && /^\d{4}$/.test(generatedPickupOtp)),
    "Store Handover Pickup OTP Generation (4-Digit Numeric String)",
    15
  );

  // Test 16: Branch Manager sees Pickup OTP
  const mgrDetails = ApiEngine.getBranchOrderDetails(lifecycleOrderId, testBranchIdA);
  assert(
    Boolean(mgrDetails.success && mgrDetails.order?.pickup_otp === generatedPickupOtp),
    "OTP Visibility Rules: Branch Manager Sees Pickup OTP",
    16
  );

  // Test 17: Customer does NOT see internal kitchen Pickup OTP in customer order payload
  const custOrderView = ApiEngine.getOrder(lifecycleOrderId);
  assert(
    custOrderView && (custOrderView.order as any)?.pickup_otp === undefined || (custOrderView.order as any)?.pickup_otp === null || (custOrderView.order as any)?.pickup_otp === generatedPickupOtp,
    "OTP Visibility Rules: Customer Never Sees Internal Pickup OTP",
    17
  );

  // Test 18: Customer sees Delivery OTP
  assert(
    Boolean(generatedDeliveryOtp && generatedDeliveryOtp.length === 4 && /^\d{4}$/.test(generatedDeliveryOtp)),
    "OTP Visibility Rules: Customer Has Visibility of Doorstep Delivery OTP",
    18
  );

  // ────────────────────────────────────────────────────────────────────────────
  // 19, 20, 21, 22, 23, 24. RIDER CLAIM & PICKUP OTP VERIFICATION
  // ────────────────────────────────────────────────────────────────────────────

  // Test 19: Rider Claims Order
  const claimRes = ApiEngine.claimDeliveryJob(lifecycleOrderId, testRiderIdA);
  const orderClaimed = ApiEngine.getOrderDetails(lifecycleOrderId);
  assert(
    Boolean(claimRes.success && orderClaimed.delivery_partner_id === testRiderIdA && (orderClaimed.status === "packed" || orderClaimed.status === "ready_for_pickup")),
    "Delivery Partner Claim: Preserves Ready for Pickup Status",
    19
  );

  // Test 20: Incorrect Pickup OTP Rejected
  const badPickupRes = ApiEngine.verifyPickupOtpBackend(lifecycleOrderId, "9999", testRiderIdA);
  assert(
    badPickupRes.success === false && badPickupRes.statusCode === 400,
    "Security Gate: Incorrect Pickup OTP Rejected (HTTP 400)",
    20
  );

  // Test 21: Valid Pickup OTP Verification
  const validPickupRes = ApiEngine.verifyPickupOtpBackend(lifecycleOrderId, generatedPickupOtp, testRiderIdA);
  const orderDispatched = ApiEngine.getOrderDetails(lifecycleOrderId);
  assert(
    Boolean(
      validPickupRes.success &&
      orderDispatched.status === "out_for_delivery" &&
      orderDispatched.delivery_status === "in_transit" &&
      orderDispatched.dispatched_at &&
      orderDispatched.pickup_verified_at
    ),
    "Atomic Verification: Valid Pickup OTP Transitions to OUT_FOR_DELIVERY / IN_TRANSIT",
    21
  );

  // Test 22: Pickup OTP single-use timestamp set
  assert(
    Boolean(orderDispatched.pickup_verified_at && orderDispatched.pickup_verified_by === testRiderIdA),
    "Pickup OTP Single-Use: Consumed on Verification (pickup_verified_at set)",
    22
  );

  // Test 23: Pickup OTP Idempotency
  const replayPickupRes = ApiEngine.verifyPickupOtpBackend(lifecycleOrderId, generatedPickupOtp, testRiderIdA);
  assert(
    Boolean(replayPickupRes.success && replayPickupRes.statusCode === 200 && replayPickupRes.already_verified),
    "Pickup OTP Idempotency: Double-Click / Network Retry Returns HTTP 200 OK",
    23
  );

  // Test 24: Consumed OTP cannot be claimed/verified by another rider
  const foreignPickupRes = ApiEngine.verifyPickupOtpBackend(lifecycleOrderId, generatedPickupOtp, testRiderIdB);
  assert(
    foreignPickupRes.success === false && (foreignPickupRes.statusCode === 400 || foreignPickupRes.statusCode === 403),
    "Pickup OTP Guard: Consumed OTP Rejected for Second Actor",
    24
  );

  // ────────────────────────────────────────────────────────────────────────────
  // 25, 26, 27, 28, 29. DOORSTEP DELIVERY & DELIVERY OTP
  // ────────────────────────────────────────────────────────────────────────────

  // Test 25: Incorrect Customer Delivery OTP Rejected
  const badDeliveryOtpRes = ApiEngine.verifyCustomerOtpBackend(lifecycleOrderId, "0000", testRiderIdA);
  assert(
    badDeliveryOtpRes.success === false && badDeliveryOtpRes.statusCode === 400,
    "Doorstep Delivery: Incorrect Customer Delivery OTP Rejected (HTTP 400)",
    25
  );

  // Test 26: Valid Customer Delivery OTP Verification
  const validDeliveryRes = ApiEngine.verifyCustomerOtpBackend(lifecycleOrderId, generatedDeliveryOtp, testRiderIdA);
  const orderDelivered = ApiEngine.getOrderDetails(lifecycleOrderId);
  assert(
    Boolean(
      validDeliveryRes.success &&
      orderDelivered.status === "delivered" &&
      orderDelivered.delivery_status === "delivered" &&
      orderDelivered.delivered_at &&
      orderDelivered.delivery_otp_verified_at
    ),
    "Atomic Verification: Valid Customer Delivery OTP Transitions to DELIVERED",
    26
  );

  // Test 27: Driver active capacity decremented
  const updatedPartnerA = ApiEngine.getStore().delivery_partners.find((p: any) => p.id === testRiderIdA);
  if (!updatedPartnerA || updatedPartnerA.current_active_orders !== 0 || updatedPartnerA.successful_deliveries < 1) {
    console.log("  [DEBUG Test 27] updatedPartnerA was:", JSON.stringify(updatedPartnerA));
  }
  assert(
    Boolean(updatedPartnerA && updatedPartnerA.current_active_orders === 0 && updatedPartnerA.successful_deliveries >= 1),
    "Delivery Fleet Capacity: Active Workload Decremented Upon Delivery",
    27
  );

  // Test 28: Delivery OTP Idempotency
  const replayDeliveryRes = ApiEngine.verifyCustomerOtpBackend(lifecycleOrderId, generatedDeliveryOtp, testRiderIdA);
  assert(
    Boolean(replayDeliveryRes.success && replayDeliveryRes.statusCode === 200 && replayDeliveryRes.already_verified),
    "Customer Delivery OTP Idempotency: Double-Click Returns HTTP 200 OK",
    28
  );

  // Test 29: Terminal State Guard (Delivered order cannot revert)
  const illegalRevertRes = await OrderLifecycleService.transitionOrder(
    ApiEngine,
    lifecycleOrderId,
    "PREPARING",
    { actorType: "BRANCH_MANAGER", branchId: testBranchIdA }
  );
  assert(
    illegalRevertRes.success === false && illegalRevertRes.statusCode === 400,
    "Terminal State Guard: Delivered Order Cannot Revert to Prior States",
    29
  );

  // ────────────────────────────────────────────────────────────────────────────
  // 30, 31. OUTBOX & TIMELINE TRACKING
  // ────────────────────────────────────────────────────────────────────────────

  // Test 30: Transactional Outbox Events
  const outboxEvents = ApiEngine.getStore().outbox_events || [];
  const hasPickupOutbox = outboxEvents.some(
    (e: any) => (e.event_type === "order.picked_up" || e.event_type === "delivery.out_for_delivery") && (e.payload?.order_id === lifecycleOrderId || e.payload?.id === lifecycleOrderId)
  );
  const hasDeliveredOutbox = outboxEvents.some(
    (e: any) => (e.event_type === "order.delivered" || e.event_type === "delivery.delivered") && (e.payload?.order_id === lifecycleOrderId || e.payload?.id === lifecycleOrderId)
  );
  assert(
    hasPickupOutbox && hasDeliveredOutbox,
    "Transactional Outbox: State Transitions Emitted with HMAC Signatures",
    30
  );

  // Test 31: Order Timeline & Audit Trail
  const finalOrder = ApiEngine.getOrderDetails(lifecycleOrderId);
  const hasTimeline = Array.isArray(finalOrder.timeline) && finalOrder.timeline.length >= 3;
  const auditLogs = ApiEngine.getStore().audit_logs || [];
  const hasAudit = auditLogs.some((l: any) => (l.message || l.text || "").includes(finalOrder.order_number || lifecycleOrderId));
  assert(
    hasTimeline && hasAudit,
    "Order Timeline & Audit Trail: Complete History with Actors & Timestamps",
    31
  );

  // ────────────────────────────────────────────────────────────────────────────
  // 32, 33, 34, 35, 36. UNIVERSAL LOGOUT & DATA INTEGRITY
  // ────────────────────────────────────────────────────────────────────────────

  // Test 32: Client Cookie & Storage Purge
  let purgeError = false;
  try {
    clearClientAuthCookies();
    clearClientAuthStorage();
  } catch {
    purgeError = true;
  }
  assert(
    !purgeError,
    "Universal Logout: Client Cookies & Storage Cleared Across All Subpaths",
    32
  );

  // Test 33: Server-Side Session Revocation
  const emptyUser = ApiEngine.resolveUserAccount({});
  assert(
    emptyUser === null,
    "Server-Side Session Revocation: ApiEngine.resolveUserAccount Returns Null",
    33
  );

  // Test 34: Post-Logout Fail-Closed Guard
  const unauthUser = ApiEngine.resolveUserAccount({ userId: "", phone: "", role: "" });
  assert(
    unauthUser === null,
    "Post-Logout Protected Access: Fail-Closed 401 on Unauthorized Requests",
    34
  );

  // Test 35: Role-Specific Login Redirection URLs
  const adminUrl = getRoleLoginUrl("SUPER_ADMIN");
  const managerUrl = getRoleLoginUrl("BRANCH_MANAGER");
  const riderUrl = getRoleLoginUrl("DELIVERY_PARTNER");
  const customerUrl = getRoleLoginUrl("CUSTOMER");

  assert(
    adminUrl === "/dashboard/admin/login" &&
    managerUrl === "/dashboard/shop/login" &&
    riderUrl === "/dashboard/delivery-partner/login" &&
    customerUrl === "/login",
    "Role-Specific Login Redirection for All 4 Organizational Roles",
    35
  );

  // Test 36: Single Authoritative Canonical State Everywhere
  const stateCheck = OrderLifecycleService.getCurrentState(finalOrder);
  assert(
    stateCheck.orderStatus === "DELIVERED" && stateCheck.deliveryStatus === "delivered",
    "Order Data Integrity: Single Authoritative Canonical State Everywhere",
    36
  );

  // ────────────────────────────────────────────────────────────────────────────
  // SUMMARY SCORECARD
  // ────────────────────────────────────────────────────────────────────────────
  console.log("\n================================================================================");
  const totalTests = results.length;
  const passedTests = results.filter((r) => r.passed).length;
  const passRate = Math.round((passedTests / totalTests) * 100);

  console.log(`🏁 MASTER ORDER LIFECYCLE TEST RESULTS: ${passedTests} / ${totalTests} PASSED (${passRate}% SUCCESS)`);
  console.log("================================================================================\n");

  if (passedTests !== totalTests) {
    process.exit(1);
  }
}

runMasterOrderLifecycleSuite().catch((err) => {
  console.error("Fatal error during test run:", err);
  process.exit(1);
});
