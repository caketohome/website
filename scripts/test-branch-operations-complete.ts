import { ApiEngine } from "../frontend/src/lib/api-engine";

function assert(condition: boolean, message: string) {
  if (!condition) {
    console.error(`❌ FAILED: ${message}`);
    throw new Error(`Assertion failed: ${message}`);
  } else {
    console.log(`✅ PASSED: ${message}`);
  }
}

async function runBranchOperationsCompleteSuite() {
  console.log("==================================================================");
  console.log("🍰 CAKETOHOME — COMPLETE BRANCH OPERATIONS, HOURS & ZONES AUDIT");
  console.log("==================================================================\n");

  ApiEngine.ensureOrdersStore();
  const store = ApiEngine.getStore();
  if (!store.products || store.products.length === 0) {
    store.products = [
      {
        id: "prod_1",
        product_id: "prod_1",
        title: "Belgian Chocolate Truffle Cake",
        name: "Belgian Chocolate Truffle Cake",
        price: 649,
        category: "Cakes",
        rating: 4.9,
        is_active: true,
      } as any,
    ];
  }
  const timestamp = Date.now().toString().slice(-6);
  const branches = ApiEngine.listBranches();
  const branchA = branches[0] || { id: "br_indiranagar", name: "Indiranagar Flagship Bakery" };
  const branchB = branches[1] || { id: "br_koramangala", name: "Koramangala Central Hub" };

  console.log(`[SETUP] Branch A: ${branchA.name} (${branchA.id})`);
  console.log(`[SETUP] Branch B: ${branchB.name} (${branchB.id})\n`);

  // ──────────────────────────────────────────────────────────────────────────
  // PHASE 1: BRANCH MANAGER OPERATIONS & ORDER PIPELINE
  // ──────────────────────────────────────────────────────────────────────────
  console.log("--- PHASE 1: LIVE ORDER PIPELINE & MANAGEMENT ---");

  // Create a test order for Branch A
  const cartId = `cart_br_op_${timestamp}`;
  ApiEngine.createCart({ id: cartId });
  ApiEngine.addToCart(cartId, {
    productId: "prod_1",
    quantity: 1,
    price: 649,
  });

  const today = new Date().toISOString().slice(0, 10);
  const slotsRes = ApiEngine.getDeliverySlots(branchA.id, today);
  const slot = slotsRes.delivery_slots?.[0] || { id: "slot_evening", label: "02:00 PM - 04:00 PM", time_window: "02:00 PM - 04:00 PM" };

  const checkoutRes = await ApiEngine.createOrder({
    customer_id: "cus_test_br",
    customer_name: "Test Customer",
    customer_phone: "+91 98765 11111",
    customer_email: "test.customer@example.com",
    delivery_type: "delivery",
    pincode: "560038",
    address_line: "100ft Road, Indiranagar",
    delivery_date: today,
    delivery_slot: slot.time_window || "02:00 PM - 04:00 PM",
    delivery_slot_id: slot.id,
    payment_method: "online",
    items: [
      {
        product_id: "prod_1",
        title: "Belgian Chocolate Truffle Cake",
        unit_price: 649,
        quantity: 1,
        weight: "1 kg",
        message_on_cake: "Happy Birthday Alex!",
        special_instructions: "Handle with extra care",
      },
    ],
  });

  console.log("CHECKOUT RESULT:", checkoutRes);
  const orderId = checkoutRes?.order_id || checkoutRes?.order?.id || checkoutRes?.id;
  const orderNumber = checkoutRes?.order_number || checkoutRes?.order?.order_number;
  assert(Boolean(orderId), "Branch A test order created");

  // Order Details & KOT Check
  const orderDetails = ApiEngine.getOrderDetails(orderId);
  assert(orderDetails !== null, `Order ${orderNumber} details retrieved`);
  assert(orderDetails.items && orderDetails.items.length > 0, "Order contains items for KOT ticket");

  // Branch A Manager Order Isolation
  const branchAOrders = ApiEngine.getBranchOrders(branchA.id);
  const foundInA = (branchAOrders.orders || []).some((o: any) => o.id === orderId || o.order_number === orderNumber);
  assert(foundInA, `Order ${orderNumber} is visible to assigned Branch A`);

  const branchBOrders = ApiEngine.getBranchOrders(branchB.id);
  const foundInB = (branchBOrders.orders || []).some((o: any) => o.id === orderId || o.order_number === orderNumber);
  assert(!foundInB, `Order ${orderNumber} is NOT visible to unassigned Branch B (Isolation)`);

  // Delivery Partner Assignment & Branch Security
  console.log("\n--- PHASE 1.3: RIDER ASSIGNMENT SECURITY & OTP WORKFLOW ---");
  const riderA = ApiEngine.createAdminDeliveryPartner({
    name: `Branch A Rider ${timestamp}`,
    phone: `+91 99111${timestamp}`,
    primary_branch_id: branchA.id,
    status: "active",
  });
  const riderB = ApiEngine.createAdminDeliveryPartner({
    name: `Branch B Rider ${timestamp}`,
    phone: `+91 99222${timestamp}`,
    primary_branch_id: branchB.id,
    status: "active",
  });

  // Assign Authorized Rider A to Branch A Order -> Succeeded
  const assignRes = ApiEngine.manualAssignOrderDelivery(orderId, riderA.id);
  assert(assignRes && assignRes.success, "Authorized Branch A rider assigned to Branch A order");

  // Attempt to Assign Unauthorized Rider B to Branch A Order -> Rejection
  try {
    ApiEngine.manualAssignOrderDelivery(orderId, riderB.id);
    assert(false, "Unauthorized Branch B rider assignment should fail");
  } catch (err: any) {
    assert(err.message.includes("Forbidden") || err.message.includes("not assigned to order branch"), "Unauthorized rider assignment blocked by security guard");
  }

  // Fetch assigned order details for generated OTPs
  const assignedDetails = ApiEngine.getOrderDetails(orderId);
  const pickupOtp = assignedDetails?.delivery?.pickup_otp || assignedDetails?.pickup_otp || "1234";
  const deliveryOtp = assignedDetails?.delivery?.delivery_otp || assignedDetails?.delivery_otp || "5678";

  // Invalid Pickup OTP -> Rejection
  const invalidPickup = ApiEngine.verifyPickupOtpBackend(orderId, "0000", riderA.id);
  assert(invalidPickup.success === false, "Invalid Pickup OTP rejected");

  // Valid Pickup OTP -> Transition to out_for_delivery
  const validPickup = ApiEngine.verifyPickupOtpBackend(orderId, pickupOtp, riderA.id);
  assert(validPickup.success === true, "Valid Pickup OTP verified");
  assert(validPickup.order.status === "out_for_delivery", "Order transitioned to out_for_delivery");

  // Re-used Pickup OTP by same assigned rider -> Idempotent OK (already_verified: true)
  // order-lifecycle-service.ts:799 returns success:true, already_verified:true for same-rider replay.
  const reusedPickup = ApiEngine.verifyPickupOtpBackend(orderId, pickupOtp, riderA.id);
  assert(reusedPickup.already_verified === true, "Reused Pickup OTP by same rider returns already_verified flag (idempotent replay)");

  // Customer OTP -> Transition to delivered
  const validDelivery = await ApiEngine.verifyCustomerOtpBackend(orderId, deliveryOtp, riderA.id);
  assert(validDelivery.success === true, "Valid Customer Delivery OTP verified");
  assert(validDelivery.order.status === "delivered", "Order transitioned to delivered");

  // ──────────────────────────────────────────────────────────────────────────
  // PHASE 2 & 3: BRANCH-SPECIFIC PRODUCT AVAILABILITY & INVENTORY
  // ──────────────────────────────────────────────────────────────────────────
  console.log("\n--- PHASE 2 & 3: BRANCH-SPECIFIC PRODUCT AVAILABILITY ---");
  const testProductId = "prod_1";

  // Set Store A -> OUT_OF_STOCK
  ApiEngine.setBranchProductAvailability(branchA.id, testProductId, { status: "out_of_stock", reason: "Kitchen shortage" });
  const availA = ApiEngine.getBranchProductAvailability(branchA.id, testProductId);
  assert(availA.status === "out_of_stock", "Store A product status updated to out_of_stock");

  // Store B remains AVAILABLE
  const availB = ApiEngine.getBranchProductAvailability(branchB.id, testProductId);
  assert(availB.status === "available", "Store B product status remains AVAILABLE (Isolated)");

  // Checkout Validation for Store A Zone (560038) -> Blocked
  const checkA = ApiEngine.validateOrderEligibility({ pincode: "560038", product_ids: [testProductId] });
  assert(checkA.eligible === false, "Checkout for Store A pincode 560038 blocked for out_of_stock product");

  // Checkout Validation for Store B Zone (560034) -> Eligible
  const checkB = ApiEngine.validateOrderEligibility({ pincode: "560034", product_ids: [testProductId] });
  assert(checkB.eligible === true, "Checkout for Store B pincode 560034 remains eligible");

  // Re-enable Store A
  ApiEngine.setBranchProductAvailability(branchA.id, testProductId, { status: "available" });
  const restoredA = ApiEngine.getBranchProductAvailability(branchA.id, testProductId);
  assert(restoredA.status === "available", "Store A product availability restored");

  // ──────────────────────────────────────────────────────────────────────────
  // PHASE 4 & 5: STORE OPERATING HOURS, TEMPORARY CLOSURE & HOLIDAYS
  // ──────────────────────────────────────────────────────────────────────────
  console.log("\n--- PHASE 4 & 5: STORE OPERATING HOURS & TEMPORARY CLOSURE ---");
  
  // Test Temporary Operational Pause
  ApiEngine.updateBranchStoreOperations(branchA.id, { temporary_closure: { is_paused: true, reason: "Kitchen Rush Hour Pause" } });
  const pausedSlots = ApiEngine.getDeliverySlots(branchA.id, new Date().toISOString().slice(0, 10));
  assert(pausedSlots.message?.includes("temporarily paused") || pausedSlots.message?.includes("Kitchen operations"), "Temporary kitchen pause returns operational warning message");

  // Re-open kitchen
  ApiEngine.updateBranchStoreOperations(branchA.id, { temporary_closure: { is_paused: false } });
  const activeSlots = ApiEngine.getDeliverySlots(branchA.id, new Date().toISOString().slice(0, 10));
  assert(activeSlots.delivery_slots.length > 0, "Delivery slots restored after clearing pause");

  // ──────────────────────────────────────────────────────────────────────────
  // PHASE 6 & 7: DELIVERY SLOT ENGINE & PINCODE/ZONE RESOLUTION
  // ──────────────────────────────────────────────────────────────────────────
  console.log("\n--- PHASE 6 & 7: PINCODE, ZONE & DELIVERY SLOT ENGINE ---");

  // Pincode 560038 -> Indiranagar Branch
  const resIndiranagar = ApiEngine.resolveSmartBranch({ pincode: "560038" });
  assert(!resIndiranagar.blockedReason && resIndiranagar.resolvedBy !== "unserviceable_pincode", "Pincode 560038 is serviceable");
  assert(resIndiranagar.branch.id === branchA.id || resIndiranagar.branch.id === "br_indiranagar" || resIndiranagar.branch.name.includes("Indiranagar"), "Pincode 560038 resolves to Indiranagar Branch");

  // Pincode 560034 -> Koramangala Branch
  const resKoramangala = ApiEngine.resolveSmartBranch({ pincode: "560034" });
  assert(!resKoramangala.blockedReason && resKoramangala.resolvedBy !== "unserviceable_pincode", "Pincode 560034 is serviceable");

  // Unserviceable Pincode 110001
  const resUnserviceable = ApiEngine.resolveSmartBranch({ pincode: "110001" });
  assert(resUnserviceable.resolvedBy === "unserviceable_pincode" || Boolean(resUnserviceable.blockedReason), "Unserviceable pincode 110001 correctly rejected");

  console.log("\n==================================================================");
  console.log("🎉 ALL BRANCH OPERATIONS, OPERATING HOURS & ZONE AUDIT TESTS PASSED!");
  console.log("==================================================================\n");
}

runBranchOperationsCompleteSuite().catch((err) => {
  console.error("❌ BRANCH OPERATIONS SUITE FAILED:", err);
  process.exit(1);
});
