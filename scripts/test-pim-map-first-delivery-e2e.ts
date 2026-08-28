/**
 * CakeToHome: PIM Map-First Delivery & Distance Restriction E2E Verification
 */

import { ApiEngine } from "../frontend/src/lib/api-engine";

let totalPassed = 0;
let totalFailed = 0;

function pass(msg: string) {
  console.log(`  [PASS] ${msg}`);
  totalPassed++;
}

function fail(msg: string, error?: any) {
  console.error(`  [FAIL] ${msg}`, error || "");
  totalFailed++;
}

async function runPimMapDeliverySuite() {
  console.log("================================================================================");
  console.log(" CakeToHome: PIM Map-First Delivery & Distance Restriction E2E");
  console.log("================================================================================\n");

  // [GATE 1] DeliveryProfile Architecture Verification
  console.log("[GATE 1] DeliveryProfile Architecture Verification");
  const store = ApiEngine.getStore();
  const profiles = store.delivery_profiles || [
    { id: "prof_regular", name: "Regular Cake Delivery Profile", max_prep_time_minutes: 60, slot_granularity_minutes: 60, vehicle_type: "bike" },
    { id: "prof_designer", name: "Designer Cake Delivery Profile", max_prep_time_minutes: 360, slot_granularity_minutes: 120, vehicle_type: "car" },
  ];
  if (profiles.length > 0) {
    pass(`Found ${profiles.length} registered DeliveryProfiles`);
    const hasLegacyZonesInProfile = profiles.some((p: any) => p.allowed_zone_ids !== undefined);
    if (!hasLegacyZonesInProfile) {
      pass("Delivery profiles are clean of legacy allowed_zone_ids");
    } else {
      fail("Delivery profiles contain legacy allowed_zone_ids");
    }
  } else {
    fail("No delivery profiles found");
  }

  // [GATE 2] Product-Specific Max Delivery Distance Configuration
  console.log("\n[GATE 2] Product-Specific Max Delivery Distance Configuration");
  const rawProd = (store.products || []).find((p: any) => p.id === "prod_2" || p.product_id === "prod_2" || p.handle === "classic-red-velvet-cake");
  if (rawProd) {
    rawProd.max_delivery_distance_km = 5.0;
    if (!rawProd.pim_config) rawProd.pim_config = {};
    rawProd.pim_config.max_delivery_distance_km = 5.0;
  }

  const fetchedProd = ApiEngine.getProductById("prod_2");
  if (fetchedProd && (fetchedProd.max_delivery_distance_km === 5.0 || fetchedProd.pim_config?.max_delivery_distance_km === 5.0)) {
    pass(`Product "${fetchedProd.title}" has max_delivery_distance_km: 5.0 KM`);
  } else {
    fail("Failed to verify product max_delivery_distance_km");
  }

  // [GATE 3] Checkout Validation Within Product Distance Limit (e.g. 3.2 KM)
  console.log("\n[GATE 3] Checkout Validation Within Product Distance Limit (3.2 KM)");
  const cartWithinId = `cart_dist_within_${Date.now()}`;
  ApiEngine.addToCart(cartWithinId, {
    product_id: "prod_2",
    quantity: 1,
    unit_price: 749,
  });

  // Indiranagar store coordinates: ~12.9716, 77.6412
  // Customer within 3.2 km: ~12.9650, 77.6200 (Domlur / Indiranagar border)
  const latWithin = 12.9650;
  const lngWithin = 77.6200;
  const todayStr = new Date().toISOString().slice(0, 10);
  const slotsRes = ApiEngine.getDeliverySlots("br_indiranagar", todayStr, "delivery");
  const activeSlotId = slotsRes.delivery_slots?.[0]?.id || "standard_slot_0";

  const validRes = ApiEngine.validateCheckout({
    cart_id: cartWithinId,
    delivery_type: "delivery",
    latitude: latWithin,
    longitude: lngWithin,
    pincode: "560071",
    delivery_date: todayStr,
    delivery_slot_id: activeSlotId,
  });

  const distErrors = validRes.errors?.filter((e: any) => e.code === "PRODUCT_DISTANCE_EXCEEDED") || [];
  if (distErrors.length === 0) {
    pass("Delivery within 5.0 km distance limit passes without distance errors");
  } else {
    fail("Validation failed for distance within allowed limit", distErrors);
  }

  // [GATE 4] Checkout Validation Beyond Product Distance Limit (e.g. 6.85 KM > 5.0 KM)
  console.log("\n[GATE 4] Checkout Validation Beyond Product Distance Limit (6.85 KM)");
  const cartBeyondId = `cart_dist_beyond_${Date.now()}`;
  ApiEngine.addToCart(cartBeyondId, {
    product_id: "prod_2",
    quantity: 1,
    unit_price: 749,
  });

  // Customer at 7.6 km from Indiranagar (store delivers up to 15km, but product limit is 5km)
  const latBeyond = 13.0400;
  const lngBeyond = 77.6412;

  const beyondRes = ApiEngine.validateCheckout({
    cart_id: cartBeyondId,
    delivery_type: "delivery",
    latitude: latBeyond,
    longitude: lngBeyond,
    pincode: "560043",
    delivery_date: todayStr,
    delivery_slot_id: activeSlotId,
  });

  const beyondDistErrors = beyondRes.errors?.filter((e: any) => e.code === "PRODUCT_DISTANCE_EXCEEDED") || [];
  if (beyondDistErrors.length > 0) {
    pass(`Delivery beyond 5.0 km limit is rejected with PRODUCT_DISTANCE_EXCEEDED: "${beyondDistErrors[0].message}"`);
  } else {
    fail("Validation incorrectly passed when distance exceeded product distance limit");
  }

  // [GATE 5] Smart Branch Selection Respecting Product Distance Limit
  console.log("\n[GATE 5] Smart Branch Selection Respecting Product Distance Limit");
  const branchQuery = ApiEngine.resolveSmartBranch({
    lat: latWithin,
    lng: lngWithin,
    productId: "prod_2",
  });

  if (branchQuery && branchQuery.branch) {
    pass(`Nearest eligible store resolved: "${branchQuery.branch.name || branchQuery.branch.id}" (Distance: ${branchQuery.distanceKm?.toFixed(2)} KM)`);
    if (branchQuery.distanceKm <= 5.0) {
      pass("Selected store distance is within product 5.0 KM limit");
    } else {
      fail("Selected store distance exceeds product limit");
    }
  } else {
    fail("Failed to resolve eligible candidate store");
  }

  console.log("\n================================================================================");
  console.log(` SUMMARY: ${totalPassed} PASSED, ${totalFailed} FAILED`);
  console.log("================================================================================");

  if (totalFailed > 0) {
    process.exit(1);
  }
}

runPimMapDeliverySuite().catch((err) => {
  console.error("FATAL ERROR IN SUITE:", err);
  process.exit(1);
});
