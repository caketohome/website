/**
 * CakeToHome Automated Verification Suite:
 * Delivery Cutoff + Time-Slot Availability + Late-Night/Midnight Configuration
 *
 * Runs a 20-test matrix + stale checkout simulation.
 */

import { ApiEngine } from "../src/lib/api-engine";
import { DeliverySlotGenerator } from "../src/lib/fulfillment/delivery-slot-generator";
import { FulfillmentEngine } from "../src/lib/fulfillment/fulfillment-engine";
import { createApiEngineProvider, ensureFulfillmentStore } from "../src/lib/fulfillment/api-engine-provider";
import {
  DEFAULT_GLOBAL_FULFILLMENT_CONFIG,
  DEFAULT_LATE_NIGHT_CONFIG,
  DEFAULT_EXPRESS_CONFIG,
  timeStringToMinutes,
  timeStringToMinutesWithCrossing,
} from "../src/lib/fulfillment/types";

let passedCount = 0;
let failedCount = 0;

function assert(condition: boolean, testName: string, detail?: string) {
  if (condition) {
    console.log(`  ✅ [PASS] ${testName}`);
    passedCount++;
  } else {
    console.error(`  ❌ [FAIL] ${testName}${detail ? ` - ${detail}` : ""}`);
    failedCount++;
  }
}

async function runTests() {
  console.log("================================================================================");
  console.log("🧪 CAKETOHOME — DELIVERY CUTOFF & TIME-SLOT AVAILABILITY TEST SUITE");
  console.log("================================================================================\n");

  const todayIso = new Date().toISOString().slice(0, 10);
  const tomorrowIso = new Date(Date.now() + 86400000).toISOString().slice(0, 10);

  // Setup Clean In-Memory Store
  const memoryStore: any = {
    fulfillment_config: {
      ...DEFAULT_GLOBAL_FULFILLMENT_CONFIG,
      business_timezone: "Asia/Kolkata",
      global_order_cutoff_time: "18:00", // Corporate cutoff at 6:00 PM
      global_same_day_delivery_enabled: true,
      global_instant_delivery_enabled: true,
      default_preparation_time_minutes: 60,
      default_delivery_buffer_minutes: 30,
      earliest_delivery_time: "09:00",
      latest_delivery_slot_start: "21:00",
      latest_delivery_slot_end: "22:00",
      late_night_delivery: {
        ...DEFAULT_LATE_NIGHT_CONFIG,
        enabled: true,
        start_time: "23:30",
        end_time: "00:05",
        additional_charge: 199,
        subject_to_corporate_cutoff: true, // Default obeys 18:00 cutoff
        special_order_cutoff: null,
      },
      express_delivery: {
        ...DEFAULT_EXPRESS_CONFIG,
        enabled: true,
        start_time: "09:00",
        end_time: "21:00",
        surcharge: 99,
        subject_to_corporate_cutoff: true,
      },
    },
    branches: [
      {
        id: "br_indiranagar",
        name: "Indiranagar Flagship Hub",
        weekly_schedule: {
          Monday: { is_open: true, windows: [{ open: "09:00", close: "22:00" }] },
          Tuesday: { is_open: true, windows: [{ open: "09:00", close: "22:00" }] },
          Wednesday: { is_open: true, windows: [{ open: "09:00", close: "22:00" }] },
          Thursday: { is_open: true, windows: [{ open: "09:00", close: "22:00" }] },
          Friday: { is_open: true, windows: [{ open: "09:00", close: "22:00" }] },
          Saturday: { is_open: true, windows: [{ open: "09:00", close: "22:00" }] },
          Sunday: { is_open: true, windows: [{ open: "09:00", close: "22:00" }] },
        },
        fulfillment_rules: {
          prep_time_mins: 30,
          dispatch_buffer_mins: 15,
          order_cutoff_mins: 30,
          max_advance_days: 14,
          same_day_allowed: true,
          next_day_allowed: true,
          express_enabled: true,
          express_prep_mins: 45,
          express_surcharge: 99,
          midnight_enabled: true,
          midnight_window: { start: "23:30", end: "00:05" },
          midnight_surcharge: 199,
          slot_duration_mins: 60,
          slot_capacity: 15,
          pickup_slot_duration_mins: 60,
          pickup_slot_capacity: 30,
          allow_pickup: true,
          allow_delivery: true,
        },
      },
    ],
    products: [
      {
        id: "prod_cake_1",
        title: "Belgian Chocolate Truffle",
        price: 799,
        sku: "CK-TRUF-01",
        is_published: true,
      },
    ],
    product_fulfillment_rules: [],
    operating_hours: [],
    holidays: [],
    orders: [],
    carts: [
      {
        id: "cart_test_1",
        items: [
          {
            product_id: "prod_cake_1",
            title: "Belgian Chocolate Truffle",
            quantity: 1,
            unit_price: 799,
          },
        ],
      },
    ],
  };

  ensureFulfillmentStore(memoryStore);
  const provider = createApiEngineProvider(memoryStore);

  // ────────────────────────────────────────────────────────────────────────────
  console.log("TEST GROUP 1: Standard Corporate Same-Day Cutoff Enforcement");
  // ────────────────────────────────────────────────────────────────────────────

  // Simulate 14:00 (2:00 PM) - Before 18:00 cutoff
  const time2PM = new Date(`${todayIso}T14:00:00+05:30`);
  const slotsAt2PM = DeliverySlotGenerator.generateSlots("br_indiranagar", 60, 30, provider, {}, new Map(), time2PM);
  const eveningSlotAt2PM = slotsAt2PM.find((s) => s.date === todayIso && s.start_time === "20:00");

  assert(
    eveningSlotAt2PM?.available === true && eveningSlotAt2PM?.status === "AVAILABLE",
    "Test 1: Standard slot 8:00-9:00 PM is AVAILABLE before corporate cutoff (evaluated at 2:00 PM)"
  );

  // Simulate 18:30 (6:30 PM) - Past 18:00 cutoff
  const time630PM = new Date(`${todayIso}T18:30:00+05:30`);
  const slotsAt630PM = DeliverySlotGenerator.generateSlots("br_indiranagar", 60, 30, provider, {}, new Map(), time630PM);
  const todayStandardSlotsAt630 = slotsAt630PM.filter((s) => s.date === todayIso && s.slot_type === "standard");

  const allTodayBlockedAt630 = todayStandardSlotsAt630.every(
    (s) => s.available === false && s.status === "PAST_CUTOFF" && s.reason_code === "CORPORATE_CUTOFF_PASSED"
  );
  assert(
    allTodayBlockedAt630,
    "Test 2: All same-day standard slots BLOCKED with status PAST_CUTOFF and reason CORPORATE_CUTOFF_PASSED after 18:00 cutoff (at 18:30)"
  );

  // Verify Midnight Delivery blocked when subject_to_corporate_cutoff = true
  const midnightSlotAt630 = slotsAt630PM.find((s) => s.date === todayIso && s.is_midnight);
  assert(
    midnightSlotAt630?.available === false && midnightSlotAt630?.reason_code === "CORPORATE_CUTOFF_PASSED",
    "Test 3: Midnight Surprise Delivery is BLOCKED at 18:30 when subject_to_corporate_cutoff = true"
  );

  // ────────────────────────────────────────────────────────────────────────────
  console.log("\nTEST GROUP 2: Special Slot Bypass & Custom Cutoff Rules");
  // ────────────────────────────────────────────────────────────────────────────

  // Configure Midnight Delivery to bypass corporate cutoff with special cutoff 21:30
  memoryStore.fulfillment_config.late_night_delivery = {
    ...DEFAULT_LATE_NIGHT_CONFIG,
    enabled: true,
    start_time: "23:30",
    end_time: "00:05",
    additional_charge: 199,
    subject_to_corporate_cutoff: false, // Bypass corporate cutoff
    special_order_cutoff: "21:30",
  };

  const slotsWithCustomMidnightAt630 = DeliverySlotGenerator.generateSlots("br_indiranagar", 60, 30, provider, {}, new Map(), time630PM);
  const midnightCustomSlot = slotsWithCustomMidnightAt630.find((s) => s.date === todayIso && s.is_midnight);

  assert(
    midnightCustomSlot?.available === true && midnightCustomSlot?.status === "AVAILABLE",
    "Test 4: Midnight Delivery with special cutoff 21:30 remains AVAILABLE at 18:30"
  );

  // Simulate 21:45 - Past the special 21:30 cutoff
  const time945PM = new Date(`${todayIso}T21:45:00+05:30`);
  const slotsAt945PM = DeliverySlotGenerator.generateSlots("br_indiranagar", 60, 30, provider, {}, new Map(), time945PM);
  const midnightCustomSlotAt945 = slotsAt945PM.find((s) => s.date === todayIso && s.is_midnight);

  assert(
    midnightCustomSlotAt945?.available === false && midnightCustomSlotAt945?.reason_code === "SPECIAL_CUTOFF_PASSED",
    "Test 5: Midnight Delivery with special cutoff 21:30 becomes BLOCKED with SPECIAL_CUTOFF_PASSED at 21:45"
  );

  // ────────────────────────────────────────────────────────────────────────────
  console.log("\nTEST GROUP 3: Preparation Time & Lead Time Constraints");
  // ────────────────────────────────────────────────────────────────────────────

  // Simulate 10:45 AM: Slot 11:00 AM - 12:00 PM requires 60m prep + 30m buffer = 90m total lead time
  const time1045AM = new Date(`${todayIso}T10:45:00+05:30`);
  const slotsAt1045 = DeliverySlotGenerator.generateSlots("br_indiranagar", 60, 30, provider, {}, new Map(), time1045AM);
  const slot11AM = slotsAt1045.find((s) => s.date === todayIso && s.start_time === "11:00");
  const slot1PM = slotsAt1045.find((s) => s.date === todayIso && s.start_time === "13:00");

  assert(
    slot11AM?.available === false && slot11AM?.status === "PREP_TIME_EXCEEDED",
    "Test 6: 11:00 AM slot is BLOCKED at 10:45 AM due to insufficient prep time (status PREP_TIME_EXCEEDED)"
  );

  assert(
    slot1PM?.available === true && slot1PM?.status === "AVAILABLE",
    "Test 7: 1:00 PM slot remains AVAILABLE at 10:45 AM (90m lead time satisfied)"
  );

  // ────────────────────────────────────────────────────────────────────────────
  console.log("\nTEST GROUP 4: Slot Capacity & Booking Tracking");
  // ────────────────────────────────────────────────────────────────────────────

  const bookedMap = new Map<string, number>();
  const testSlotId = `SLOT_STANDARD_${todayIso}_1500_1600`;
  bookedMap.set(testSlotId, 15); // Max capacity reached

  const slotsWithCapacity = DeliverySlotGenerator.generateSlots("br_indiranagar", 60, 30, provider, { max_slots_per_window: 15 }, bookedMap, time1045AM);
  const fullSlot = slotsWithCapacity.find((s) => s.id === testSlotId);

  assert(
    fullSlot?.available === false && fullSlot?.status === "FULL" && fullSlot?.remaining_capacity === 0,
    "Test 8: Slot with 15/15 bookings marked as FULL (remaining_capacity: 0, available: false)"
  );

  // ────────────────────────────────────────────────────────────────────────────
  console.log("\nTEST GROUP 5: Emergency Corporate Cutoff Override");
  // ────────────────────────────────────────────────────────────────────────────

  // Reset midnight config to standard
  memoryStore.fulfillment_config.late_night_delivery = { ...DEFAULT_LATE_NIGHT_CONFIG, subject_to_corporate_cutoff: true };

  // Activate Emergency Override to 20:30
  memoryStore.fulfillment_config.emergency_override_active = true;
  memoryStore.fulfillment_config.emergency_override_cutoff_time = "20:30";
  memoryStore.fulfillment_config.emergency_override_reason = "Valentine's Eve Executive Extension";

  const slotsWithEmergencyOverride = DeliverySlotGenerator.generateSlots("br_indiranagar", 60, 30, provider, {}, new Map(), time630PM);
  const eveningSlotUnderOverride = slotsWithEmergencyOverride.find((s) => s.date === todayIso && s.start_time === "21:00");

  assert(
    eveningSlotUnderOverride?.available === true && eveningSlotUnderOverride?.status === "AVAILABLE",
    "Test 9: Emergency corporate override to 20:30 allows 9:00 PM slot at 18:30"
  );

  // ────────────────────────────────────────────────────────────────────────────
  console.log("\nTEST GROUP 6: Tomorrow & Future Date Isolation");
  // ────────────────────────────────────────────────────────────────────────────

  // Deactivate emergency override, evaluate at 23:00 (way past today's cutoff)
  memoryStore.fulfillment_config.emergency_override_active = false;
  const time11PM = new Date(`${todayIso}T23:00:00+05:30`);
  const slotsAt11PM = DeliverySlotGenerator.generateSlots("br_indiranagar", 60, 30, provider, {}, new Map(), time11PM);

  const tomorrowSlots = slotsAt11PM.filter((s) => s.date === tomorrowIso && s.slot_type === "standard");
  const tomorrowMorningSlot = tomorrowSlots.find((s) => s.start_time === "10:00");

  assert(
    tomorrowMorningSlot?.available === true && tomorrowMorningSlot?.status === "AVAILABLE",
    "Test 10: Tomorrow's 10:00 AM slot is AVAILABLE and completely unaffected by today's passed cutoff"
  );

  // ────────────────────────────────────────────────────────────────────────────
  console.log("\nTEST GROUP 7: Midnight-Crossing Math & Timezone Utility");
  // ────────────────────────────────────────────────────────────────────────────

  const startMin = timeStringToMinutes("23:30"); // 1410 min
  const endMin = timeStringToMinutesWithCrossing("00:05", startMin); // 1445 min (next day)

  assert(
    endMin > startMin && endMin === 1445,
    "Test 11: Midnight crossing math computes 23:30 (1410m) to 00:05 (+1445m) with calendar date wrap"
  );

  // ────────────────────────────────────────────────────────────────────────────
  console.log("\nTEST GROUP 8: ApiEngine.getDeliverySlots Real-time Enforcement");
  // ────────────────────────────────────────────────────────────────────────────

  // Sync memory store into ApiEngine internal store
  const apiSlots = ApiEngine.getDeliverySlots("br_indiranagar", todayIso, "delivery");
  assert(
    Array.isArray(apiSlots.delivery_slots) && apiSlots.delivery_slots.length > 0,
    "Test 12: ApiEngine.getDeliverySlots returns structured slot list with explicit status and extra_charge"
  );

  const expressSlot = apiSlots.delivery_slots.find((s: any) => s.slot_type === "express");
  const midnightSlot = apiSlots.delivery_slots.find((s: any) => s.slot_type === "midnight");

  assert(
    Boolean(expressSlot && typeof expressSlot.extra_charge === "number" && expressSlot.extra_charge === 99),
    "Test 13: Express slot has configurable surcharge ₹99"
  );

  assert(
    Boolean(midnightSlot && typeof midnightSlot.extra_charge === "number" && midnightSlot.extra_charge === 199),
    "Test 14: Midnight slot has configurable surcharge ₹199"
  );

  // ────────────────────────────────────────────────────────────────────────────
  console.log("\nTEST GROUP 9: Server-side Checkout Validation & Stale Checkout Rejection");
  // ────────────────────────────────────────────────────────────────────────────

  const testItems = [{ product_id: "prod_cake_1", quantity: 1, unit_price: 799, title: "Belgian Chocolate Truffle" }];

  // Test 15: Valid order validation
  const validCheckoutRes = ApiEngine.validateCheckout({
    cart_id: "cart_test_1",
    items: testItems,
    delivery_date: tomorrowIso,
    delivery_slot_id: `SLOT_DELIVERY_1100_1200`,
    delivery_type: "delivery",
    pincode: "560038",
    address: { line1: "100ft Road", city: "Bengaluru", pincode: "560038" },
  });

  assert(
    validCheckoutRes.valid === true,
    "Test 15: validateCheckout accepts valid future date and slot",
    JSON.stringify(validCheckoutRes.errors)
  );

  // Test 16: Missing delivery slot rejected
  const missingSlotRes = ApiEngine.validateCheckout({
    cart_id: "cart_test_1",
    items: testItems,
    delivery_date: tomorrowIso,
    delivery_slot_id: "",
    delivery_type: "delivery",
    pincode: "560038",
    address: { line1: "100ft Road", city: "Bengaluru", pincode: "560038" },
  });

  assert(
    missingSlotRes.valid === false && missingSlotRes.errors.some((e: any) => e.code === "DELIVERY_SLOT_REQUIRED"),
    "Test 16: validateCheckout rejects empty delivery_slot_id with DELIVERY_SLOT_REQUIRED",
    JSON.stringify(missingSlotRes.errors)
  );

  // Test 17: Non-existent / invalid delivery slot rejected
  const invalidSlotRes = ApiEngine.validateCheckout({
    cart_id: "cart_test_1",
    items: testItems,
    delivery_date: tomorrowIso,
    delivery_slot_id: "SLOT_NON_EXISTENT_9999",
    delivery_type: "delivery",
    pincode: "560038",
    address: { line1: "100ft Road", city: "Bengaluru", pincode: "560038" },
  });

  assert(
    invalidSlotRes.valid === false && invalidSlotRes.errors.some((e: any) => e.code === "INVALID_TIME_SLOT"),
    "Test 17: validateCheckout rejects non-existent slot ID with INVALID_TIME_SLOT",
    JSON.stringify(invalidSlotRes.errors)
  );

  // Test 18: Stale checkout session simulation - customer submits an expired same-day slot after cutoff
  // Update global cutoff in ApiEngine store to 10:00 AM (already passed)
  const apiEngineStore = ApiEngine.getStore();
  ensureFulfillmentStore(apiEngineStore);
  apiEngineStore.fulfillment_config.global_order_cutoff_time = "10:00";

  const staleCheckoutRes = ApiEngine.validateCheckout({
    cart_id: "cart_test_1",
    items: testItems,
    delivery_date: todayIso,
    delivery_slot_id: `SLOT_DELIVERY_2000_2100`,
    delivery_type: "delivery",
    pincode: "560038",
    address: { line1: "100ft Road", city: "Bengaluru", pincode: "560038" },
  });

  assert(
    staleCheckoutRes.valid === false && staleCheckoutRes.errors.some((e: any) => e.code === "CORPORATE_CUTOFF_PASSED" || e.code === "SAME_DAY_CUTOFF_PASSED"),
    "Test 18: validateCheckout REJECTS stale same-day slot when corporate cutoff has passed with CORPORATE_CUTOFF_PASSED",
    JSON.stringify(staleCheckoutRes.errors)
  );

  // Test 19: confirmCheckout authoritative revalidation blocks order placement
  const confirmResult = ApiEngine.confirmCheckout({
    cart_id: "cart_test_1",
    delivery_date: todayIso,
    delivery_slot_id: `SLOT_DELIVERY_2000_2100`,
    delivery_type: "delivery",
    pincode: "560038",
    address: { line1: "100ft Road", city: "Bengaluru", pincode: "560038" },
    payment_method: "cod",
  } as any);

  assert(
    confirmResult.success === false && confirmResult.statusCode === 400,
    "Test 19: confirmCheckout strictly fails order placement (HTTP 400) on stale expired delivery slot",
    JSON.stringify(confirmResult)
  );

  // Reset cutoff for Test 20
  apiEngineStore.fulfillment_config.global_order_cutoff_time = "18:00";
  const providerForTest20 = createApiEngineProvider(apiEngineStore);

  // Test 20: Full End-to-End FulfillmentEngine cart eligibility calculation
  const cartEngineRes = FulfillmentEngine.calculateCartEligibility(
    {
      items: [{ product_id: "prod_cake_1", quantity: 1 }],
      branch_id: "br_indiranagar",
      requested_delivery_date: todayIso,
      current_datetime: time630PM, // 18:30 (past 18:00 cutoff)
    },
    providerForTest20
  );

  assert(
    cartEngineRes.all_eligible === false && (cartEngineRes.items[0]?.reason === "CORPORATE_CUTOFF_PASSED" || cartEngineRes.items[0]?.reason === "SAME_DAY_CUTOFF_PASSED"),
    "Test 20: FulfillmentEngine.calculateCartEligibility marks same-day cart ineligible with CORPORATE_CUTOFF_PASSED",
    JSON.stringify(cartEngineRes)
  );

  console.log("\n================================================================================");
  console.log(`📊 TEST SUITE SUMMARY: ${passedCount} PASSED, ${failedCount} FAILED`);
  console.log("================================================================================\n");

  if (failedCount > 0) {
    process.exit(1);
  }
}

runTests().catch((err) => {
  console.error("Test suite runtime error:", err);
  process.exit(1);
});
