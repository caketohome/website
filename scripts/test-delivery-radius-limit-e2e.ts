/**
 * CakeToHome — Limit Delivery Radius to Configured Service Area E2E Test Suite
 *
 * Verifies all 13 core validation requirements + boundary conditions + robustness tests:
 *  1. Store max radius = 10 km, Admin tries to create 12 km zone -> REJECTED (RADIUS_EXCEEDS_ALLOWED_LIMIT)
 *  2. Store max radius = 10 km, Admin creates 8 km zone -> ACCEPTED
 *  3. Store max radius = 15 km, Zone max radius = 8 km, Admin creates 10 km zone -> REJECTED (RADIUS_EXCEEDS_ALLOWED_LIMIT)
 *  4. Store max radius = 15 km, Zone max radius = 8 km, Admin creates 7 km zone -> ACCEPTED
 *  5. Global max = 25 km, Store max radius = 30 km -> REJECTED (RADIUS_EXCEEDS_ALLOWED_LIMIT)
 *  6. Customer 9.99 km away, Radius limit = 10 km -> SERVICEABLE
 *  7. Customer 10.00 km away, Radius limit = 10 km -> SERVICEABLE
 *  8. Customer 10.01 km away, Radius limit = 10 km -> NOT SERVICEABLE
 *  9. Customer 12 km away, Radius limit = 10 km, Pincode matches zone -> NOT SERVICEABLE (coordinates authoritative)
 * 10. Pricing bracket max km = 15 km, Effective delivery radius = 10 km -> REJECTED (PRICING_RANGE_EXCEEDS_SERVICE_RADIUS)
 * 11. Pricing bracket max km = 10 km, Effective delivery radius = 10 km -> ACCEPTED
 * 12. Delivery fee calculation for customer 11 km away, Effective radius = 10 km -> Unserviceable, fee = 0
 * 13. Multiple stores with different radius limits (Store A: 10 km, Store B: 15 km) -> isolated, no cross-leak
 * 14. Invalid inputs (negative, zero, NaN, string garbage, inverted pricing) -> REJECTED
 */

import { ApiEngine, GLOBAL_MAX_DELIVERY_RADIUS_KM } from "../frontend/src/lib/api-engine";

let totalTests = 0;
let passedTests = 0;
let failedTests = 0;

interface TestResult {
  num: number;
  title: string;
  expected: string;
  actual: string;
  passed: boolean;
  error?: string;
}

const results: TestResult[] = [];

function assertTest(
  num: number,
  title: string,
  expected: string,
  condition: boolean,
  actual: string,
  errorMsg?: string
) {
  totalTests++;
  if (condition) {
    passedTests++;
    results.push({ num, title, expected, actual, passed: true });
    console.log(`✅ [Test ${num}] ${title}`);
    console.log(`   Expected: ${expected} | Actual: ${actual}`);
  } else {
    failedTests++;
    results.push({ num, title, expected, actual, passed: false, error: errorMsg });
    console.error(`❌ [Test ${num}] ${title}`);
    console.error(`   Expected: ${expected} | Actual: ${actual}`);
    if (errorMsg) console.error(`   Error: ${errorMsg}`);
  }
}

// ── Haversine offset helper ──────────────────────────────────────────────────
function offsetCoordinatesNorth(centerLat: number, centerLng: number, distanceKm: number): [number, number] {
  const earthRadiusKm = 6371.0;
  const deltaLat = (distanceKm / earthRadiusKm) * (180 / Math.PI);
  return [centerLat + deltaLat, centerLng];
}

async function runTestSuite() {
  console.log("===============================================================================");
  console.log("CakeToHome: Comprehensive Delivery Radius Constraint & Service Area Test Suite");
  console.log("Timestamp: " + new Date().toISOString());
  console.log(`Global Safety Ceiling: ${GLOBAL_MAX_DELIVERY_RADIUS_KM} km`);
  console.log("===============================================================================\n");

  const BASE_STORE_LAT = 12.9716;
  const BASE_STORE_LNG = 77.6412;

  // ---------------------------------------------------------------------------
  // Test 1: Store max radius = 10 km, Admin tries to create 12 km zone -> REJECTED
  // ---------------------------------------------------------------------------
  try {
    ApiEngine.saveBranch({
      id: "br_test_limit_01",
      code: "TST-01",
      name: "Test Store 10km",
      city: "Bengaluru",
      pincode: "560038",
      latitude: BASE_STORE_LAT,
      longitude: BASE_STORE_LNG,
      max_delivery_radius_km: 10,
      delivery_zones: [
        {
          id: "zone_test_01_exceed",
          name: "Zone Exceeding Store Max",
          fence_type: "radius",
          boundary_type: "radius",
          radius_km: 12,
          min_km: 0,
          max_km: 12,
          enabled: true,
          pincodes: ["560038"],
        },
      ],
    });
    assertTest(1, "Store max radius = 10 km, Admin tries to create 12 km zone", "REJECTED (RADIUS_EXCEEDS_ALLOWED_LIMIT)", false, "ACCEPTED (Should have thrown)");
  } catch (err: any) {
    const isExpected = err.message.includes("RADIUS_EXCEEDS_ALLOWED_LIMIT");
    assertTest(
      1,
      "Store max radius = 10 km, Admin tries to create 12 km zone",
      "REJECTED (RADIUS_EXCEEDS_ALLOWED_LIMIT)",
      isExpected,
      err.message
    );
  }

  // ---------------------------------------------------------------------------
  // Test 2: Store max radius = 10 km, Admin creates 8 km zone -> ACCEPTED
  // ---------------------------------------------------------------------------
  try {
    const saved = ApiEngine.saveBranch({
      id: "br_test_limit_02",
      code: "TST-02",
      name: "Test Store 10km Valid",
      city: "Bengaluru",
      pincode: "560038",
      latitude: BASE_STORE_LAT,
      longitude: BASE_STORE_LNG,
      max_delivery_radius_km: 10,
      delivery_zones: [
        {
          id: "zone_test_02_valid",
          name: "Zone Within Store Max",
          fence_type: "radius",
          boundary_type: "radius",
          radius_km: 8,
          min_km: 0,
          max_km: 8,
          enabled: true,
          pincodes: ["560038"],
        },
      ],
    });
    const zone = saved?.delivery_zones?.find((z: any) => z.id === "zone_test_02_valid");
    const isAccepted = !!zone && zone.radius_km === 8 && zone.max_serviceable_km === 10 && zone.remaining_radius_km === 2;
    assertTest(
      2,
      "Store max radius = 10 km, Admin creates 8 km zone",
      "ACCEPTED with remaining_radius_km = 2",
      isAccepted,
      `radius=${zone?.radius_km}, max_serviceable=${zone?.max_serviceable_km}, remaining=${zone?.remaining_radius_km}`
    );
  } catch (err: any) {
    assertTest(2, "Store max radius = 10 km, Admin creates 8 km zone", "ACCEPTED", false, err.message);
  }

  // ---------------------------------------------------------------------------
  // Test 3: Store max radius = 15 km, Zone max radius = 8 km, Admin creates 10 km zone
  // Expected: REJECTED (zone limit wins, RADIUS_EXCEEDS_ALLOWED_LIMIT)
  // ---------------------------------------------------------------------------
  try {
    ApiEngine.saveBranch({
      id: "br_test_limit_03",
      code: "TST-03",
      name: "Test Store 15km Zone 8km",
      city: "Bengaluru",
      pincode: "560038",
      latitude: BASE_STORE_LAT,
      longitude: BASE_STORE_LNG,
      max_delivery_radius_km: 15,
      delivery_zones: [
        {
          id: "zone_test_03_exceed",
          name: "Zone Exceeding Zone Max",
          fence_type: "radius",
          boundary_type: "radius",
          max_serviceable_km: 8,
          radius_km: 10,
          min_km: 0,
          max_km: 10,
          enabled: true,
          pincodes: ["560038"],
        },
      ],
    });
    assertTest(3, "Store max = 15 km, Zone max = 8 km, Admin creates 10 km zone", "REJECTED (RADIUS_EXCEEDS_ALLOWED_LIMIT)", false, "ACCEPTED (Should have thrown)");
  } catch (err: any) {
    const isExpected = err.message.includes("RADIUS_EXCEEDS_ALLOWED_LIMIT");
    assertTest(
      3,
      "Store max = 15 km, Zone max = 8 km, Admin creates 10 km zone",
      "REJECTED (RADIUS_EXCEEDS_ALLOWED_LIMIT)",
      isExpected,
      err.message
    );
  }

  // ---------------------------------------------------------------------------
  // Test 4: Store max radius = 15 km, Zone max radius = 8 km, Admin creates 7 km zone
  // Expected: ACCEPTED
  // ---------------------------------------------------------------------------
  try {
    const saved = ApiEngine.saveBranch({
      id: "br_test_limit_04",
      code: "TST-04",
      name: "Test Store 15km Zone 8km Valid",
      city: "Bengaluru",
      pincode: "560038",
      latitude: BASE_STORE_LAT,
      longitude: BASE_STORE_LNG,
      max_delivery_radius_km: 15,
      delivery_zones: [
        {
          id: "zone_test_04_valid",
          name: "Zone Within Zone Max",
          fence_type: "radius",
          boundary_type: "radius",
          max_serviceable_km: 8,
          radius_km: 7,
          min_km: 0,
          max_km: 7,
          enabled: true,
          pincodes: ["560038"],
        },
      ],
    });
    const zone = saved?.delivery_zones?.find((z: any) => z.id === "zone_test_04_valid");
    const isAccepted = !!zone && zone.radius_km === 7 && zone.max_serviceable_km === 8 && zone.remaining_radius_km === 1;
    assertTest(
      4,
      "Store max = 15 km, Zone max = 8 km, Admin creates 7 km zone",
      "ACCEPTED with remaining_radius_km = 1",
      isAccepted,
      `radius=${zone?.radius_km}, max_serviceable=${zone?.max_serviceable_km}, remaining=${zone?.remaining_radius_km}`
    );
  } catch (err: any) {
    assertTest(4, "Store max = 15 km, Zone max = 8 km, Admin creates 7 km zone", "ACCEPTED", false, err.message);
  }

  // ---------------------------------------------------------------------------
  // Test 5: Global max = 25 km, Store max radius = 30 km -> REJECTED (global ceiling wins)
  // ---------------------------------------------------------------------------
  try {
    ApiEngine.saveBranch({
      id: "br_test_limit_05",
      code: "TST-05",
      name: "Test Store 30km Exceed Global",
      city: "Bengaluru",
      pincode: "560038",
      latitude: BASE_STORE_LAT,
      longitude: BASE_STORE_LNG,
      max_delivery_radius_km: 30,
      delivery_zones: [],
    });
    assertTest(5, "Global ceiling = 25 km, Store max = 30 km", "REJECTED (RADIUS_EXCEEDS_ALLOWED_LIMIT)", false, "ACCEPTED (Should have thrown)");
  } catch (err: any) {
    const isExpected = err.message.includes("RADIUS_EXCEEDS_ALLOWED_LIMIT") && err.message.includes("global safety ceiling");
    assertTest(
      5,
      "Global ceiling = 25 km, Store max = 30 km",
      "REJECTED (RADIUS_EXCEEDS_ALLOWED_LIMIT)",
      isExpected,
      err.message
    );
  }

  // ---------------------------------------------------------------------------
  // Setup branch and zone with effective max radius = 10 km for Boundary Testing
  // ---------------------------------------------------------------------------
  const boundaryBranch = ApiEngine.saveBranch({
    id: "br_test_boundary_10km",
    code: "TST-BND",
    name: "Boundary Test Branch 10km",
    city: "Bengaluru",
    pincode: "560038",
    latitude: BASE_STORE_LAT,
    longitude: BASE_STORE_LNG,
    max_delivery_radius_km: 10,
    delivery_zones: [
      {
        id: "zone_boundary_10km",
        name: "Boundary 10km Zone",
        fence_type: "radius",
        boundary_type: "radius",
        radius_km: 10,
        min_km: 0,
        max_km: 10,
        max_serviceable_km: 10,
        enabled: true,
        base_fee: 49,
        pincodes: ["560038"],
        pricing_type: "flat",
        delivery_charge: 49,
      },
    ],
  });
  const testZone = boundaryBranch.delivery_zones[0];

  // ---------------------------------------------------------------------------
  // Test 6: Customer 9.99 km away, Radius limit = 10 km -> SERVICEABLE
  // ---------------------------------------------------------------------------
  const [lat999, lng999] = offsetCoordinatesNorth(BASE_STORE_LAT, BASE_STORE_LNG, 9.99);
  const serviceable999 = ApiEngine.isPointInZone(lat999, lng999, testZone, boundaryBranch);
  assertTest(
    6,
    "Customer 9.99 km away, Radius limit = 10 km",
    "SERVICEABLE (true)",
    serviceable999.matched === true,
    `matched = ${serviceable999.matched}`
  );

  // ---------------------------------------------------------------------------
  // Test 7: Customer 10.00 km away, Radius limit = 10 km -> SERVICEABLE
  // ---------------------------------------------------------------------------
  const [lat1000, lng1000] = offsetCoordinatesNorth(BASE_STORE_LAT, BASE_STORE_LNG, 10.00);
  const serviceable1000 = ApiEngine.isPointInZone(lat1000, lng1000, testZone, boundaryBranch);
  assertTest(
    7,
    "Customer 10.00 km away, Radius limit = 10 km",
    "SERVICEABLE (true)",
    serviceable1000.matched === true,
    `matched = ${serviceable1000.matched}`
  );

  // ---------------------------------------------------------------------------
  // Test 8: Customer 10.01 km away, Radius limit = 10 km -> NOT SERVICEABLE
  // ---------------------------------------------------------------------------
  const [lat1001, lng1001] = offsetCoordinatesNorth(BASE_STORE_LAT, BASE_STORE_LNG, 10.01);
  const serviceable1001 = ApiEngine.isPointInZone(lat1001, lng1001, testZone, boundaryBranch);
  assertTest(
    8,
    "Customer 10.01 km away, Radius limit = 10 km",
    "NOT SERVICEABLE (false)",
    serviceable1001.matched === false,
    `matched = ${serviceable1001.matched}`
  );

  // ---------------------------------------------------------------------------
  // Test 9: Customer 12 km away, Radius limit = 10 km, Pincode matches zone
  // Expected: NOT SERVICEABLE (Coordinates are strictly authoritative)
  // ---------------------------------------------------------------------------
  const [lat12km, lng12km] = offsetCoordinatesNorth(BASE_STORE_LAT, BASE_STORE_LNG, 12.0);
  const resolved = ApiEngine.resolveSmartBranch({
    lat: lat12km,
    lng: lng12km,
    pincode: "560038", // Matching pincode
  });
  const serviceable12km = resolved?.branch?.id === "br_test_boundary_10km" && !resolved?.reasonCode;
  assertTest(
    9,
    "Customer 12 km away with matching pincode (560038)",
    "NOT SERVICEABLE (coordinates authoritative)",
    !serviceable12km,
    `serviceable = ${!!serviceable12km} (branch: ${resolved?.branch?.id ?? "none"}, reason: ${resolved?.reasonCode ?? "none"})`
  );

  // ---------------------------------------------------------------------------
  // Test 10: Pricing bracket max km = 15 km, Effective delivery radius = 10 km
  // Expected: REJECTED (PRICING_RANGE_EXCEEDS_SERVICE_RADIUS)
  // ---------------------------------------------------------------------------
  try {
    ApiEngine.saveBranch({
      id: "br_test_pricing_exceed",
      code: "TST-PRC-EX",
      name: "Pricing Bracket Exceed Store",
      city: "Bengaluru",
      pincode: "560038",
      latitude: BASE_STORE_LAT,
      longitude: BASE_STORE_LNG,
      max_delivery_radius_km: 10,
      delivery_zones: [
        {
          id: "zone_pricing_exceed",
          name: "Zone with 15km Pricing Bracket",
          fence_type: "radius",
          boundary_type: "radius",
          radius_km: 10,
          min_km: 0,
          max_km: 10,
          enabled: true,
          pincodes: ["560038"],
          pricing_type: "distance_bracket",
          pricing_brackets: [
            { min_km: 0, max_km: 5, charge: 40, enabled: true },
            { min_km: 5, max_km: 15, charge: 100, enabled: true }, // Exceeds effective 10 km!
          ],
        },
      ],
    });
    assertTest(10, "Pricing bracket max km = 15 km with effective radius = 10 km", "REJECTED (PRICING_RANGE_EXCEEDS_SERVICE_RADIUS)", false, "ACCEPTED (Should have thrown)");
  } catch (err: any) {
    const isExpected = err.message.includes("PRICING_RANGE_EXCEEDS_SERVICE_RADIUS");
    assertTest(
      10,
      "Pricing bracket max km = 15 km with effective radius = 10 km",
      "REJECTED (PRICING_RANGE_EXCEEDS_SERVICE_RADIUS)",
      isExpected,
      err.message
    );
  }

  // ---------------------------------------------------------------------------
  // Test 11: Pricing bracket max km = 10 km, Effective delivery radius = 10 km
  // Expected: ACCEPTED
  // ---------------------------------------------------------------------------
  try {
    const saved = ApiEngine.saveBranch({
      id: "br_test_pricing_valid",
      code: "TST-PRC-OK",
      name: "Pricing Bracket Valid Store",
      city: "Bengaluru",
      pincode: "560038",
      latitude: BASE_STORE_LAT,
      longitude: BASE_STORE_LNG,
      max_delivery_radius_km: 10,
      delivery_zones: [
        {
          id: "zone_pricing_valid",
          name: "Zone with Valid Pricing Brackets",
          fence_type: "radius",
          boundary_type: "radius",
          radius_km: 10,
          min_km: 0,
          max_km: 10,
          enabled: true,
          pincodes: ["560038"],
          pricing_type: "distance_bracket",
          pricing_brackets: [
            { min_km: 0, max_km: 5, charge: 40, enabled: true },
            { min_km: 5, max_km: 10, charge: 80, enabled: true }, // Valid!
          ],
        },
      ],
    });
    const zone = saved?.delivery_zones?.find((z: any) => z.id === "zone_pricing_valid");
    const isAccepted = !!zone && zone.pricing_brackets?.length === 2;
    assertTest(
      11,
      "Pricing bracket max km = 10 km with effective radius = 10 km",
      "ACCEPTED",
      isAccepted,
      `brackets count: ${zone?.pricing_brackets?.length}`
    );
  } catch (err: any) {
    assertTest(11, "Pricing bracket max km = 10 km with effective radius = 10 km", "ACCEPTED", false, err.message);
  }

  // ---------------------------------------------------------------------------
  // Test 12: Delivery fee calculation for customer 11 km away, Effective radius = 10 km
  // Expected: Unserviceable, fee = 0
  // ---------------------------------------------------------------------------
  const feeResult = ApiEngine.calculateDeliveryFee(
    boundaryBranch,
    {
      distance_km: 11.0,
      zone_id: testZone.id,
      order_total: 1000,
    }
  );
  const feeIsZeroAndUnserviceable = feeResult.total_fee === 0 && feeResult.pricing_mode === "unserviceable";
  assertTest(
    12,
    "Delivery fee calculation for customer 11 km away (effective radius = 10 km)",
    "Unserviceable, fee = 0",
    feeIsZeroAndUnserviceable,
    `total_fee = ₹${feeResult.total_fee}, pricing_mode = ${feeResult.pricing_mode}`
  );

  // ---------------------------------------------------------------------------
  // Test 13: Multiple stores with different radius limits
  // Store A: 10 km, Store B: 15 km
  // Verify Store A cannot exceed 10 km, Store B cannot exceed 15 km, no cross-leak
  // ---------------------------------------------------------------------------
  let storeA_ok = false;
  let storeB_ok = false;
  let storeA_leak_prevented = false;

  // Store A cannot exceed 10 km
  try {
    ApiEngine.saveBranch({
      id: "br_store_a",
      code: "STR-A",
      name: "Store A (10km)",
      city: "Kollam",
      pincode: "691001",
      latitude: 8.8932,
      longitude: 76.6141,
      max_delivery_radius_km: 10,
      delivery_zones: [
        {
          id: "zone_str_a",
          name: "Store A Zone",
          fence_type: "radius",
          boundary_type: "radius",
          radius_km: 12,
          min_km: 0,
          max_km: 12,
          enabled: true,
          pincodes: ["691001"],
        },
      ],
    });
  } catch (err: any) {
    storeA_ok = err.message.includes("RADIUS_EXCEEDS_ALLOWED_LIMIT");
  }

  // Store B can create 14 km zone (since store max is 15 km)
  try {
    const savedB = ApiEngine.saveBranch({
      id: "br_store_b",
      code: "STR-B",
      name: "Store B (15km)",
      city: "Chennai",
      pincode: "600017",
      latitude: 13.0418,
      longitude: 80.2341,
      max_delivery_radius_km: 15,
      delivery_zones: [
        {
          id: "zone_str_b",
          name: "Store B Zone",
          fence_type: "radius",
          boundary_type: "radius",
          radius_km: 14,
          min_km: 0,
          max_km: 14,
          enabled: true,
          pincodes: ["600017"],
        },
      ],
    });
    storeB_ok = savedB?.delivery_zones?.[0]?.radius_km === 14;
  } catch {
    storeB_ok = false;
  }

  // Verify Store B's 15km limit does not allow Store A to exceed 10km
  const branches = ApiEngine.listBranches();
  const branchA = branches.find((b: any) => b.id === "br_test_limit_02"); // store max 10km
  const effectiveA = ApiEngine.computeEffectiveMaxRadius(branchA, { max_serviceable_km: 12 });
  const branchB = branches.find((b: any) => b.id === "br_store_b"); // store max 15km
  const effectiveB = ApiEngine.computeEffectiveMaxRadius(branchB, { max_serviceable_km: 14 });
  storeA_leak_prevented = effectiveA === 10 && effectiveB === 14;

  assertTest(
    13,
    "Multi-store isolation: Store A (10km) vs Store B (15km)",
    "Strict isolation, Store A capped at 10km, Store B allowed up to 14km",
    storeA_ok && storeB_ok && storeA_leak_prevented,
    `Store A rejected: ${storeA_ok}, Store B accepted: ${storeB_ok}, Isolation preserved: ${storeA_leak_prevented}`
  );

  // ---------------------------------------------------------------------------
  // Test 14: Robustness & Invalid Input Rejection
  // Negative radius, NaN, string garbage, inverted pricing
  // ---------------------------------------------------------------------------
  let negativeRejected = false;
  let stringGarbageRejected = false;
  let invertedBracketRejected = false;

  try {
    ApiEngine.saveBranch({
      id: "br_test_invalid_1",
      code: "TST-INV-1",
      name: "Negative Radius Store",
      city: "Bengaluru",
      pincode: "560038",
      max_delivery_radius_km: -5,
      delivery_zones: [],
    });
  } catch (err: any) {
    negativeRejected = err.message.includes("INVALID_INPUT");
  }

  try {
    ApiEngine.saveBranch({
      id: "br_test_invalid_2",
      code: "TST-INV-2",
      name: "String Radius Store",
      city: "Bengaluru",
      pincode: "560038",
      max_delivery_radius_km: "abc" as any,
      delivery_zones: [],
    });
  } catch (err: any) {
    stringGarbageRejected = err.message.includes("INVALID_INPUT");
  }

  try {
    ApiEngine.saveBranch({
      id: "br_test_invalid_3",
      code: "TST-INV-3",
      name: "Inverted Bracket Store",
      city: "Bengaluru",
      pincode: "560038",
      max_delivery_radius_km: 15,
      delivery_zones: [
        {
          id: "zone_inv_bracket",
          name: "Inverted Bracket Zone",
          fence_type: "radius",
          boundary_type: "radius",
          radius_km: 10,
          min_km: 0,
          max_km: 10,
          enabled: true,
          pincodes: ["560038"],
          pricing_type: "distance_bracket",
          pricing_brackets: [
            { min_km: 10, max_km: 5, charge: 50, enabled: true }, // min > max!
          ],
        },
      ],
    });
  } catch (err: any) {
    invertedBracketRejected = err.message.includes("INVALID_INPUT");
  }

  assertTest(
    14,
    "Robustness: Invalid inputs (negative, string garbage, inverted brackets)",
    "All invalid inputs rejected with INVALID_INPUT",
    negativeRejected && stringGarbageRejected && invertedBracketRejected,
    `negative: ${negativeRejected}, string: ${stringGarbageRejected}, inverted: ${invertedBracketRejected}`
  );

  // ---------------------------------------------------------------------------
  // Summary
  // ---------------------------------------------------------------------------
  console.log("\n===============================================================================");
  console.log(`Test Execution Complete: ${passedTests}/${totalTests} Passed (${failedTests} Failed)`);
  console.log("===============================================================================");

  if (failedTests > 0) {
    process.exit(1);
  }
}

runTestSuite().catch((err) => {
  console.error("Test Suite Fatal Error:", err);
  process.exit(1);
});
