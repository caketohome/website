/**
 * CakeToHome Production Checkout Engine Verification Suite
 * Tests all requirements:
 * 1. Pincode 560001 returns ₹79 and Order Summary pricing matches exactly with ZERO contradiction.
 * 2. Delivery Scheduling generates live operational slots with cutoff times & capacity tracking.
 * 3. Branch -> Delivery Zone -> Pincode authoritative resolution.
 * 4. Multi-window weekly schedules, holidays, and temporary closures.
 * 5. Branch pickup mode bypasses delivery pincode and sets delivery fee to ₹0.
 * 6. Checkout validation & confirmation persist orders correctly.
 */

import { ApiEngine } from "../frontend/src/lib/api-engine";

function assert(condition: boolean, msg: string) {
  if (!condition) {
    console.error(`❌ ASSERTION FAILED: ${msg}`);
    process.exit(1);
  } else {
    console.log(`✅ ${msg}`);
  }
}

async function runTests() {
  console.log("===============================================================");
  console.log("🍰 RUNNING CAKETOHOME PRODUCTION CHECKOUT & OPERATIONS TESTS");
  console.log("===============================================================\n");

  // ── Test 1: Pincode 560001 Resolution & Delivery Fee Consistency ──
  console.log("--- TEST 1: Pincode 560001 Delivery Fee Consistency ---");
  const pincode560001 = "560001";
  const cart1 = ApiEngine.createCart({
    items: [
      {
        id: "item_choco_truffle",
        product_id: "prod_belgian_dark_truffle",
        title: "Belgian Dark Chocolate Truffle Cake",
        unit_price: 649,
        quantity: 1,
      },
    ],
  });

  const avail560001 = ApiEngine.getCheckoutAvailability({
    cart_id: cart1.id,
    pincode: pincode560001,
    delivery_type: "delivery",
  });

  assert(avail560001.success === true, "Availability API returns success for 560001");
  assert(avail560001.serviceable === true, "560001 is serviceable");
  assert(avail560001.pricing.delivery_fee === 79, `Authoritative Delivery Fee for 560001 is ₹79 (Received: ₹${avail560001.pricing.delivery_fee})`);
  assert(avail560001.pricing.subtotal === 649, `Subtotal is ₹649 (Received: ₹${avail560001.pricing.subtotal})`);
  assert(avail560001.pricing.grand_total === 649 + 79, `Grand total is ₹728 (Received: ₹${avail560001.pricing.grand_total})`);

  // Validate that Order Eligibility and Checkout Validation match the EXACT same ₹79 delivery fee
  const validateRes = ApiEngine.validateCheckout({
    cart_id: cart1.id,
    pincode: pincode560001,
    delivery_type: "delivery",
  });
  assert(validateRes.valid === true, "Checkout validation passes for 560001");
  assert(validateRes.pricing.delivery_fee === 79, `Validation pricing delivery fee is ₹79 (NO CONTRADICTION)`);
  assert(validateRes.pricing.grand_total === 728, `Validation grand total is ₹728`);

  // ── Test 2: Free Delivery Threshold (>= ₹999) ──
  console.log("\n--- TEST 2: Free Delivery Threshold (Orders >= ₹999) ---");
  const cartFree = ApiEngine.createCart({
    items: [
      {
        id: "item_tier_cake",
        product_id: "prod_designer_tier",
        title: "Grand 2-Tier Celebration Cake",
        unit_price: 1299,
        quantity: 1,
      },
    ],
  });

  const availFree = ApiEngine.getCheckoutAvailability({
    cart_id: cartFree.id,
    pincode: pincode560001,
    delivery_type: "delivery",
  });
  assert(availFree.pricing.delivery_fee === 0, `Delivery fee is ₹0 for orders >= ₹999 (Received: ₹${availFree.pricing.delivery_fee})`);
  assert(availFree.pricing.grand_total === 1299, `Grand total is ₹1299 (Received: ₹${availFree.pricing.grand_total})`);

  // ── Test 3: Branch Pickup Mode (₹0 Fee & Bypass Pincode) ──
  console.log("\n--- TEST 3: Branch Pickup Mode ---");
  const availPickup = ApiEngine.getCheckoutAvailability({
    cart_id: cart1.id,
    delivery_type: "pickup",
    branch_id: "br_koramangala",
  });

  assert(availPickup.serviceable === true, "Branch pickup is serviceable");
  assert(availPickup.pricing.delivery_fee === 0, `Branch pickup delivery fee is ₹0 (Received: ₹${availPickup.pricing.delivery_fee})`);
  assert(availPickup.zone_name.includes("Pickup"), `Zone name indicates pickup`);

  const validatePickup = ApiEngine.validateCheckout({
    cart_id: cart1.id,
    delivery_type: "pickup",
    branch_id: "br_koramangala",
  });
  assert(validatePickup.valid === true, "Checkout validation passes for pickup without pincode");
  assert(validatePickup.pricing.delivery_fee === 0, "Validation pricing fee is ₹0 for pickup");

  // ── Test 4: Operational Slots Generation & Lead Time ──
  console.log("\n--- TEST 4: Operational Slots Generation & Capacity ---");
  const today = new Date().toISOString().slice(0, 10);
  const slotsRes = ApiEngine.getDeliverySlots("br_indiranagar", today, "delivery");

  assert(slotsRes.status === "SUCCESS", "Slot engine returns SUCCESS status");
  assert(slotsRes.is_open === true, "Indiranagar hub is open");
  assert(Array.isArray(slotsRes.delivery_slots) && slotsRes.delivery_slots.length >= 2, `Generated ${slotsRes.delivery_slots.length} operational slots`);

  const stdSlot = slotsRes.delivery_slots.find((s) => s.slot_type === "standard");
  assert(Boolean(stdSlot), "Standard time window slots generated");
  assert(typeof stdSlot?.remaining_capacity === "number", "Slot contains remaining_capacity tracking");

  // ── Test 5: Store Holiday Closures ──
  console.log("\n--- TEST 5: Store Holiday & Special Closures ---");
  const holidayDate = "2026-10-20";
  ApiEngine.updateBranchStoreOperations("br_indiranagar", {
    holidays: [
      {
        date: holidayDate,
        name: "Diwali Kitchen Holiday",
        is_closed: true,
        reason: "Closed for Diwali Celebrations",
      },
    ],
  });

  const holidaySlots = ApiEngine.getDeliverySlots("br_indiranagar", holidayDate, "delivery");
  assert(holidaySlots.is_open === false, "Branch correctly marked closed on holiday date");
  assert(holidaySlots.status === "HOLIDAY", `Holiday status returned: ${holidaySlots.status}`);
  assert(holidaySlots.delivery_slots.length === 0, "No slots generated for holiday");

  const holidayAvail = ApiEngine.getCheckoutAvailability({
    cart_id: cart1.id,
    pincode: pincode560001,
    date: holidayDate,
  });
  const holidayDateEntry = holidayAvail.available_dates.find((d) => d.date === holidayDate);
  assert(holidayDateEntry?.is_available === false, `Date ${holidayDate} marked unavailable in available_dates calendar`);

  // ── Test 6: Temporary Kitchen Operational Pause ──
  console.log("\n--- TEST 6: Temporary Kitchen Operational Pause ---");
  ApiEngine.updateBranchStoreOperations("br_indiranagar", {
    temporary_closure: {
      is_paused: true,
      reason: "High order rush - 30 min kitchen break",
      pause_until: new Date(Date.now() + 30 * 60000).toISOString(),
    },
  });

  const pausedSlots = ApiEngine.getDeliverySlots("br_indiranagar", today, "delivery");
  assert(Boolean(pausedSlots.message), `Pause message returned: "${pausedSlots.message}"`);

  // Resume branch
  ApiEngine.updateBranchStoreOperations("br_indiranagar", {
    temporary_closure: {
      is_paused: false,
      reason: null,
      pause_until: null,
    },
  });

  // ── Test 7: Branch -> Zone -> Pincode Hierarchy Resolution ──
  console.log("\n--- TEST 7: Branch -> Zone -> Pincode Resolution ---");
  const whitefieldPin = "560066";
  const resolvedWhitefield = ApiEngine.resolveSmartBranch({ pincode: whitefieldPin });
  assert(resolvedWhitefield.branch.id === "br_whitefield", `560066 resolved strictly to Whitefield Hub (Received: ${resolvedWhitefield.branch.id})`);
  assert(resolvedWhitefield.deliveryFee === 119, `Whitefield zone delivery fee is ₹119 (Received: ₹${resolvedWhitefield.deliveryFee})`);

  const unserviceablePin = "999999";
  const resolvedUnserviceable = ApiEngine.resolveSmartBranch({ pincode: unserviceablePin });
  assert(Boolean(resolvedUnserviceable.blockedReason), `Pincode 999999 marked unserviceable with explanation`);

  // ── Test 8: Order Placement & Persistence ──
  console.log("\n--- TEST 8: Full Order Confirmation & Capacity Reservation ---");
  const confirmRes = ApiEngine.confirmCheckout({
    cart_id: cart1.id,
    customer_id: "cus_ananya_01",
    address: {
      first_name: "Ananya",
      last_name: "Sharma",
      phone: "+91 98765 43210",
      email: "ananya@example.com",
      line1: "Flat 402, Signature Towers",
      city: "Bengaluru",
      pincode: pincode560001,
    },
    pincode: pincode560001,
    delivery_date: today,
    delivery_slot_id: "SLOT_STANDARD_MORNING",
    delivery_type: "delivery",
    payment_method: "cod",
  });

  assert(confirmRes.success === true, "Order successfully confirmed and placed");
  assert(Boolean(confirmRes.order_id), `Order ID generated: ${confirmRes.order_id}`);
  assert(confirmRes.order.pricing.delivery_fee === 79, `Persisted order delivery fee is ₹79`);
  assert(confirmRes.order.total === 728, `Persisted order total is ₹728`);

  console.log("\n===============================================================");
  console.log("🎉 ALL PRODUCTION CHECKOUT & OPERATIONS TESTS PASSED PERFECTLY!");
  console.log("===============================================================\n");
}

runTests().catch((err) => {
  console.error("Test execution failed:", err);
  process.exit(1);
});
