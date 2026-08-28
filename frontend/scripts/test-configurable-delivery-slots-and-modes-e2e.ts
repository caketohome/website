import { ApiEngine } from "../src/lib/api-engine";
import { FulfillmentEngine, DeliverySlotGenerator, DEFAULT_SLOT_CONFIG } from "../src/lib/fulfillment";
import { createApiEngineProvider, ensureFulfillmentStore } from "../src/lib/fulfillment/api-engine-provider";

async function runTests() {
  console.log("================================================================================");
  console.log("🎯 CAKETOHOME — CONFIGURABLE DELIVERY SLOTS & SERVICEABILITY VERIFICATION SUITE");
  console.log("================================================================================\n");

  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, testName: string, details?: string) {
    if (condition) {
      console.log(`  ✅ PASS: ${testName}`);
      if (details) console.log(`     ↳ ${details}`);
      passed++;
    } else {
      console.error(`  ❌ FAIL: ${testName}`);
      if (details) console.error(`     ↳ ${details}`);
      failed++;
    }
  }

  // Set up clean test store
  const store = ApiEngine.getStore();
  ensureFulfillmentStore(store);

  // -------------------------------------------------------------------------
  // TEST 1: Serviceability First — Out-of-coverage coordinates return unserviceable with NO slots
  // -------------------------------------------------------------------------
  console.log("--- TEST GROUP 1: Serviceability-First Location Check ---");
  const unserviceableRes = ApiEngine.getCheckoutAvailability({
    latitude: 28.6139, // New Delhi (Far outside Kerala branches)
    longitude: 77.2090,
    delivery_type: "delivery",
  });

  assert(
    unserviceableRes.serviceable === false,
    "Gate 1: Coordinates outside branch delivery coverage are marked unserviceable",
    `serviceable: ${unserviceableRes.serviceable}, status: ${unserviceableRes.status_message}`
  );

  assert(
    unserviceableRes.available_slots.length === 0,
    "Gate 2: Unserviceable location returns 0 delivery slots (Blocks slot leakage)",
    `slots count: ${unserviceableRes.available_slots.length}`
  );

  assert(
    unserviceableRes.available_dates.length === 0,
    "Gate 3: Unserviceable location returns 0 available dates",
    `dates count: ${unserviceableRes.available_dates.length}`
  );

  // -------------------------------------------------------------------------
  // TEST 2: Serviceable Location — Resolves store, zone, fee, ETA, and valid slots
  // -------------------------------------------------------------------------
  console.log("\n--- TEST GROUP 2: Serviceable Location Resolution ---");
  const serviceableRes = ApiEngine.getCheckoutAvailability({
    latitude: 8.8932, // Kollam Central Cake Studio coverage
    longitude: 76.6141,
    pincode: "691001",
    delivery_type: "delivery",
  });

  assert(
    serviceableRes.serviceable === true,
    "Gate 4: In-coverage coordinates return serviceable = true",
    `serviceable: ${serviceableRes.serviceable}, store: ${serviceableRes.branch_name}`
  );

  assert(
    typeof serviceableRes.distance_km === "number" && serviceableRes.distance_km > 0,
    "Gate 5: Exact Euclidean/Haversine distance is calculated",
    `distance_km: ${serviceableRes.distance_km}`
  );

  assert(
    typeof serviceableRes.eta_minutes === "number" && serviceableRes.eta_minutes > 0,
    "Gate 6: Delivery ETA minutes is calculated",
    `eta_minutes: ${serviceableRes.eta_minutes}`
  );

  assert(
    serviceableRes.available_slots.length > 0,
    "Gate 7: Serviceable location returns active delivery slots",
    `slots count: ${serviceableRes.available_slots.length}`
  );

  // -------------------------------------------------------------------------
  // TEST 3: Express 45-Min Same-Day Suppression Rule
  // -------------------------------------------------------------------------
  console.log("\n--- TEST GROUP 3: Express 45-Min Same-Day Only Rule ---");
  const todayIso = new Date().toISOString().slice(0, 10);
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const tomorrowIso = tomorrow.toISOString().slice(0, 10);

  const branchId = serviceableRes.branch_id || "br_default";

  // Slots for TODAY
  const todaySlots = ApiEngine.getDeliverySlots(branchId, todayIso, "delivery");
  const todayHasExpress = todaySlots.delivery_slots.some((s) => s.slot_type === "express");

  assert(
    todayHasExpress,
    "Gate 8: Express 45-Min slot IS present for Today's date",
    `Today slots count: ${todaySlots.delivery_slots.length}, express present: ${todayHasExpress}`
  );

  // Slots for TOMORROW
  const tomorrowSlots = ApiEngine.getDeliverySlots(branchId, tomorrowIso, "delivery");
  const tomorrowHasExpress = tomorrowSlots.delivery_slots.some((s) => s.slot_type === "express");

  assert(
    tomorrowHasExpress === false,
    "Gate 9: Express 45-Min slot is strictly SUPPRESSED for Tomorrow's date (Rule 3)",
    `Tomorrow slots count: ${tomorrowSlots.delivery_slots.length}, express present: ${tomorrowHasExpress}`
  );

  // -------------------------------------------------------------------------
  // TEST 4: Midnight Delivery Scheduled Availability Rule
  // -------------------------------------------------------------------------
  console.log("\n--- TEST GROUP 4: Midnight Delivery Pre-order Availability ---");
  const tomorrowHasMidnight = tomorrowSlots.delivery_slots.some((s) => s.slot_type === "midnight");

  assert(
    tomorrowHasMidnight === true,
    "Gate 10: Midnight surprise delivery IS available for tomorrow / future dates",
    `Tomorrow midnight present: ${tomorrowHasMidnight}`
  );

  // -------------------------------------------------------------------------
  // TEST 5: Dynamic Slot Interval & Duration Customization (Zero Code Change)
  // -------------------------------------------------------------------------
  console.log("\n--- TEST GROUP 5: Dynamic Slot Duration & Interval Customization ---");
  // 30-minute intervals
  const slots30m = ApiEngine.getDeliverySlots(branchId, tomorrowIso, "delivery", {
    slotDurationMins: 30,
    slotIntervalMins: 30,
  });

  const has30mSlots = slots30m.delivery_slots.some((s) => s.slot_type === "standard" && (s.end_time.endsWith(":30") || s.start_time.endsWith(":30")));
  assert(
    has30mSlots,
    "Gate 11: Dynamic 30-min duration and interval generates 30-min slot windows (e.g., 09:00 - 09:30)",
    `Sample 30m slot: ${slots30m.delivery_slots.find((s) => s.slot_type === "standard")?.slot_name}`
  );

  // 60-minute intervals
  const slots60m = ApiEngine.getDeliverySlots(branchId, tomorrowIso, "delivery", {
    slotDurationMins: 60,
    slotIntervalMins: 60,
  });

  const has60mSlots = slots60m.delivery_slots.some((s) => s.slot_type === "standard" && s.start_time.endsWith(":00") && s.end_time.endsWith(":00"));
  assert(
    has60mSlots,
    "Gate 12: Dynamic 60-min duration and interval generates 1-hour slot windows (e.g., 09:00 - 10:00)",
    `Sample 60m slot: ${slots60m.delivery_slots.find((s) => s.slot_type === "standard")?.slot_name}`
  );

  // -------------------------------------------------------------------------
  // TEST 6: Live Capacity & Concurrency Row-Lock Enforcement
  // -------------------------------------------------------------------------
  console.log("\n--- TEST GROUP 6: Slot Capacity Exhaustion Tracking ---");
  const testSlotId = "SLOT_DELIVERY_1400_1500";
  const capacityLimit = 2;

  // Insert mock orders into store to saturate capacity
  const mockOrder1 = {
    id: "ord_test_cap_1",
    branch_id: branchId,
    delivery_date: tomorrowIso,
    delivery_slot_id: testSlotId,
    status: "confirmed",
  };
  const mockOrder2 = {
    id: "ord_test_cap_2",
    branch_id: branchId,
    delivery_date: tomorrowIso,
    delivery_slot_id: testSlotId,
    status: "preparing",
  };

  store.orders = store.orders || [];
  store.orders.push(mockOrder1, mockOrder2);

  const capacitySlots = ApiEngine.getDeliverySlots(branchId, tomorrowIso, "delivery", {
    slotDurationMins: 60,
    slotIntervalMins: 60,
    slotCapacity: capacityLimit,
  });

  const saturatedSlot = capacitySlots.delivery_slots.find((s) => s.id === testSlotId);

  assert(
    saturatedSlot !== undefined && saturatedSlot.remaining_capacity === 0 && saturatedSlot.available === false,
    "Gate 13: Saturated slot is marked FULL with 0 remaining capacity",
    `slot: ${saturatedSlot?.id}, remaining: ${saturatedSlot?.remaining_capacity}, available: ${saturatedSlot?.available}, status: ${saturatedSlot?.status}`
  );

  // Clean up mock orders
  store.orders = store.orders.filter((o: any) => !o.id.startsWith("ord_test_cap_"));

  // -------------------------------------------------------------------------
  // TEST 7: Backend Order Creation Slot Revalidation
  // -------------------------------------------------------------------------
  console.log("\n--- TEST GROUP 7: Backend Order Placement Slot Validation ---");

  // Create a cart for testing
  const cartRes = ApiEngine.createCart();
  ApiEngine.addToCart(cartRes.id, {
    id: "prod_choco_truffle",
    product_id: "prod_choco_truffle",
    title: "Belgian Chocolate Truffle",
    price: 699,
    quantity: 1,
  });

  // Test with an invalid / unavailable slot
  const invalidSlotOrder = ApiEngine.validateCheckout({
    cart_id: cartRes.id,
    customer_id: "cust_test_1",
    address: {
      address_line_1: "123 Test Street",
      city: "Kollam",
      pincode: "691001",
      latitude: 8.8932,
      longitude: 76.6141,
    },
    pincode: "691001",
    delivery_type: "delivery",
    delivery_date: tomorrowIso,
    delivery_slot_id: "SLOT_NON_EXISTENT_9999",
  });

  assert(
    invalidSlotOrder.valid === false && invalidSlotOrder.errors.some((e: any) => e.field === "delivery_slot_id"),
    "Gate 14: Submitting an order with a non-existent slot is rejected",
    `valid: ${invalidSlotOrder.valid}, error: ${invalidSlotOrder.errors?.[0]?.message}`
  );

  // Test with a valid slot
  const validSlot = tomorrowSlots.delivery_slots.find((s) => s.available);
  const validSlotOrder = ApiEngine.validateCheckout({
    cart_id: cartRes.id,
    customer_id: "cust_test_1",
    address: {
      address_line_1: "123 Test Street",
      city: "Kollam",
      pincode: "691001",
      latitude: 8.8932,
      longitude: 76.6141,
    },
    pincode: "691001",
    delivery_type: "delivery",
    delivery_date: tomorrowIso,
    delivery_slot_id: validSlot?.id,
  });

  assert(
    validSlotOrder.valid === true,
    "Gate 15: Submitting an order with a valid available slot succeeds",
    `valid: ${validSlotOrder.valid}, total: ₹${validSlotOrder.grand_total}, slot: ${validSlot?.id}`
  );

  // -------------------------------------------------------------------------
  // FINAL SUMMARY
  // -------------------------------------------------------------------------
  console.log("\n================================================================================");
  console.log(`📊 RESULTS: ${passed} PASSED | ${failed} FAILED`);
  console.log("================================================================================\n");

  if (failed > 0) {
    process.exit(1);
  } else {
    console.log("🎉 ALL CONFIGURABLE DELIVERY SLOTS & SERVICEABILITY GATES VERIFIED SUCCESSFULLY!");
  }
}

runTests().catch((e) => {
  console.error("Test execution fatal error:", e);
  process.exit(1);
});
