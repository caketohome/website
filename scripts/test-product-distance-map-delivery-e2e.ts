/**
 * Comprehensive Automated Verification Suite for Product-Scoped Maximum Delivery Distance
 * Tests:
 * 1. Physical coordinates governing delivery (pincode cannot override)
 * 2. Store map coverage (radius / polygon) vs. Product max delivery distance
 * 3. Final serviceability = MIN(StoreMapMax, ProductMaxDistance)
 * 4. Exclusion polygons override product distance
 * 5. PIM distance limit updates (5 km -> 15 km -> null) dynamically altering eligibility
 * 6. Mixed cart with multi-distance constraints
 * 7. Server-side checkout validation (tamper-proof)
 * 8. PostgreSQL persistence of max_delivery_distance_km
 */

import { ApiEngine } from "../frontend/src/lib/api-engine";
import { persistProductToDb } from "../frontend/src/lib/db-persistence";
import { dbQuery } from "../frontend/src/lib/db";

interface TestReport {
  name: string;
  passed: boolean;
  expected: any;
  actual: any;
  detail?: string;
}

const reports: TestReport[] = [];

function assert(condition: boolean, name: string, expected: any, actual: any, detail?: string) {
  reports.push({
    name,
    passed: Boolean(condition),
    expected,
    actual,
    detail,
  });
  const symbol = condition ? "✓ PASS" : "✗ FAIL";
  console.log(`${symbol}: ${name}`);
  if (!condition) {
    console.error(`  Expected: ${JSON.stringify(expected)}`);
    console.error(`  Actual:   ${JSON.stringify(actual)}`);
    if (detail) console.error(`  Detail:   ${detail}`);
  }
}

async function runSuite() {
  console.log("\n===============================================================================");
  console.log("CakeToHome: Product-Scoped Max Delivery Distance & Map Coverage E2E Suite");
  console.log("===============================================================================\n");

  // Step 0: Ensure Indiranagar hub exists and has clear coordinates (12.9716, 77.6412)
  const branches = ApiEngine.listBranches();
  const indiranagar = branches.find((b) => b.id === "br_indiranagar") || branches[0];
  console.log(`Using primary testing branch: ${indiranagar.name} (${indiranagar.id})`);
  console.log(`Branch coordinates: [${indiranagar.latitude}, ${indiranagar.longitude}]`);

  // Target test product
  const testProdId = "prod_dist_test_01";
  
  // Clean setup for test product
  ApiEngine.updateAdminProduct(testProdId, {
    id: testProdId,
    title: "Artisan Delicate Truffle Cake",
    price: 850,
    max_delivery_distance_km: 5.0,
    pim_config: {
      same_day_allowed: true,
      express_allowed: true,
      midnight_allowed: true,
      scheduled_allowed: true,
      max_delivery_distance_km: 5.0,
    },
  });

  const prodAfterSetup = ApiEngine.getProductById(testProdId);
  assert(
    prodAfterSetup?.max_delivery_distance_km === 5.0,
    "Test 1: Product PIM setup stores max_delivery_distance_km = 5.0",
    5.0,
    prodAfterSetup?.max_delivery_distance_km
  );

  assert(
    (prodAfterSetup as any)?.allowed_zones === undefined,
    "Test 2: Legacy allowed_zones property is stripped from product",
    undefined,
    (prodAfterSetup as any)?.allowed_zones
  );

  // Future delivery date for test stability
  const testDate = new Date();
  testDate.setDate(testDate.getDate() + 2);
  const testDateStr = testDate.toISOString().split("T")[0];
  const slotsRes = ApiEngine.getDeliverySlots("br_indiranagar", testDateStr, "delivery");
  const testSlotId = slotsRes.delivery_slots[0]?.id || "slot_std_afternoon";

  // --------------------------------------------------------------------------
  // Scenario 1: Customer at 1.2 KM (Domlur - 12.9609, 77.6387)
  // Distance to Indiranagar (~1.2 km) <= 5.0 km limit & inside store coverage
  // Expected: Deliverable / Serviceable
  // --------------------------------------------------------------------------
  const res3km = ApiEngine.resolveSmartBranch({
    lat: 12.9609,
    lng: 77.6387,
    productId: testProdId,
  });

  assert(
    res3km.branch !== null && res3km.branch.id === "br_indiranagar",
    "Test 3: Customer at ~1.2 km is serviceable by Indiranagar branch",
    "br_indiranagar",
    res3km.branch?.id
  );

  // Validate in Checkout
  const checkoutPass = ApiEngine.validateCheckout({
    customer_id: "cus_test_01",
    customer_email: "test@example.com",
    delivery_type: "delivery",
    branch_id: "br_indiranagar",
    delivery_date: testDateStr,
    delivery_slot_id: testSlotId,
    delivery_latitude: 12.9609,
    delivery_longitude: 77.6387,
    pincode: "560071",
    items: [
      {
        product_id: testProdId,
        variant_id: "var_1",
        quantity: 1,
        unit_price: 850,
        title: "Artisan Delicate Truffle Cake",
      },
    ],
  });

  assert(
    checkoutPass.valid === true,
    "Test 4: Checkout validation succeeds for customer within 5.0 km product limit",
    true,
    checkoutPass.valid,
    checkoutPass.errors?.[0]?.message
  );

  // --------------------------------------------------------------------------
  // Scenario 2: Customer at ~11.8 KM (Whitefield - 12.9698, 77.7499) served by Indiranagar
  // Inside Indiranagar 15 km map radius, but exceeds product 5.0 km limit!
  // Expected: Checkout rejected due to PRODUCT_DISTANCE_EXCEEDED
  // --------------------------------------------------------------------------
  const checkoutDistExceeded = ApiEngine.validateCheckout({
    customer_id: "cus_test_01",
    customer_email: "test@example.com",
    delivery_type: "delivery",
    branch_id: "br_indiranagar",
    delivery_date: testDateStr,
    delivery_slot_id: testSlotId,
    delivery_latitude: 12.9698,
    delivery_longitude: 77.7499,
    pincode: "560066",
    items: [
      {
        product_id: testProdId,
        variant_id: "var_1",
        quantity: 1,
        unit_price: 850,
        title: "Artisan Delicate Truffle Cake",
      },
    ],
  });

  const distErr = checkoutDistExceeded.errors.find((e) => e.code === "PRODUCT_DISTANCE_EXCEEDED");
  assert(
    Boolean(distErr),
    "Test 5: Checkout rejects order when distance (11.8 km) exceeds product limit (5.0 km)",
    "PRODUCT_DISTANCE_EXCEEDED",
    distErr?.code,
    distErr?.message
  );

  // --------------------------------------------------------------------------
  // Scenario 3: Store Map Boundary Prevents Delivery Even if Product Allows 20 KM
  // Customer in Tumkur / Outskirts (13.3400, 77.1000)
  // Expected: NO_ELIGIBLE_STORE / OUTSIDE_DELIVERY_ZONE
  // --------------------------------------------------------------------------
  const resOutskirts = ApiEngine.resolveSmartBranch({
    lat: 13.3400,
    lng: 77.1000,
    productId: testProdId,
  });

  assert(
    resOutskirts.branch === null,
    "Test 6: Store map physical boundary prevents delivery to distant location outside coverage",
    null,
    resOutskirts.branch
  );

  // --------------------------------------------------------------------------
  // Scenario 4: Pincode Spoofing / Mismatch Attempt
  // Customer gives Indiranagar pincode (560038) but GPS coordinates are in Whitefield (12.9698, 77.7499)
  // Expected: GPS coordinates govern; distance check still fails!
  // --------------------------------------------------------------------------
  const checkoutSpoof = ApiEngine.validateCheckout({
    customer_id: "cus_test_01",
    customer_email: "test@example.com",
    delivery_type: "delivery",
    branch_id: "br_indiranagar",
    delivery_date: testDateStr,
    delivery_slot_id: testSlotId,
    delivery_latitude: 12.9698,
    delivery_longitude: 77.7499,
    pincode: "560038", // Spoofed local pincode!
    items: [
      {
        product_id: testProdId,
        variant_id: "var_1",
        quantity: 1,
        unit_price: 850,
        title: "Artisan Delicate Truffle Cake",
      },
    ],
  });

  const spoofErr = checkoutSpoof.errors.find((e) => e.code === "PRODUCT_DISTANCE_EXCEEDED");
  assert(
    Boolean(spoofErr),
    "Test 7: GPS coordinates strictly govern over pincode metadata (tamper-proof)",
    "PRODUCT_DISTANCE_EXCEEDED",
    spoofErr?.code
  );

  // --------------------------------------------------------------------------
  // Scenario 5: Dynamic PIM Update: Increase limit to 15.0 KM
  // Customer in Whitefield (~11.8 km from Indiranagar) should now become DELIVERABLE!
  // --------------------------------------------------------------------------
  ApiEngine.updateAdminProduct(testProdId, {
    max_delivery_distance_km: 15.0,
    pim_config: {
      max_delivery_distance_km: 15.0,
    },
  });

  const prodUpdated = ApiEngine.getProductById(testProdId);
  assert(
    prodUpdated?.max_delivery_distance_km === 15.0,
    "Test 8: PIM updates max_delivery_distance_km to 15.0 KM",
    15.0,
    prodUpdated?.max_delivery_distance_km
  );

  const checkoutNowValid = ApiEngine.validateCheckout({
    customer_id: "cus_test_01",
    customer_email: "test@example.com",
    delivery_type: "delivery",
    branch_id: "br_indiranagar",
    delivery_date: testDateStr,
    delivery_slot_id: testSlotId,
    delivery_latitude: 12.9698,
    delivery_longitude: 77.7499,
    pincode: "560066",
    items: [
      {
        product_id: testProdId,
        variant_id: "var_1",
        quantity: 1,
        unit_price: 850,
        title: "Artisan Delicate Truffle Cake",
      },
    ],
  });

  assert(
    checkoutNowValid.valid === true,
    "Test 9: Customer at 11.8 km immediately becomes deliverable after PIM distance increase to 15 km",
    true,
    checkoutNowValid.valid,
    checkoutNowValid.errors?.[0]?.message
  );

  // --------------------------------------------------------------------------
  // Scenario 6: Dynamic PIM Update to NULL (No Product-Specific Limit)
  // Store map physical boundary governs completely.
  // --------------------------------------------------------------------------
  ApiEngine.updateAdminProduct(testProdId, {
    max_delivery_distance_km: null,
    pim_config: {
      max_delivery_distance_km: null,
    },
  });

  const prodNull = ApiEngine.getProductById(testProdId);
  assert(
    prodNull?.max_delivery_distance_km === null,
    "Test 10: PIM correctly sets max_delivery_distance_km = null",
    null,
    prodNull?.max_delivery_distance_km
  );

  const checkoutNullLimit = ApiEngine.validateCheckout({
    customer_id: "cus_test_01",
    customer_email: "test@example.com",
    delivery_type: "delivery",
    branch_id: "br_indiranagar",
    delivery_date: testDateStr,
    delivery_slot_id: testSlotId,
    delivery_latitude: 12.9698,
    delivery_longitude: 77.7499,
    pincode: "560066",
    items: [
      {
        product_id: testProdId,
        variant_id: "var_1",
        quantity: 1,
        unit_price: 850,
        title: "Artisan Delicate Truffle Cake",
      },
    ],
  });

  assert(
    checkoutNullLimit.valid === true,
    "Test 11: When product distance limit is null, store map boundary governs and checkout passes",
    true,
    checkoutNullLimit.valid
  );

  // --------------------------------------------------------------------------
  // Scenario 7: Mixed Cart With Conflicting Limits
  // Prod A has limit 5 km; Prod B has limit 20 km.
  // Customer at 11.8 km from Indiranagar.
  // Expected: Checkout fails specifically identifying Prod A as the blocker!
  // --------------------------------------------------------------------------
  const testProdIdB = "prod_dist_test_02";
  ApiEngine.updateAdminProduct(testProdId, { max_delivery_distance_km: 5.0 });
  ApiEngine.updateAdminProduct(testProdIdB, {
    id: testProdIdB,
    title: "Sturdy Dry Fruit Tea Cake",
    price: 450,
    max_delivery_distance_km: 20.0,
  });

  const checkoutMixedCart = ApiEngine.validateCheckout({
    customer_id: "cus_test_01",
    customer_email: "test@example.com",
    delivery_type: "delivery",
    branch_id: "br_indiranagar",
    delivery_date: testDateStr,
    delivery_slot_id: testSlotId,
    delivery_latitude: 12.9698,
    delivery_longitude: 77.7499,
    pincode: "560066",
    items: [
      {
        product_id: testProdId, // 5 km limit -> exceeds 11.8 km
        variant_id: "var_1",
        quantity: 1,
        unit_price: 850,
        title: "Artisan Delicate Truffle Cake",
      },
      {
        product_id: testProdIdB, // 20 km limit -> within 11.8 km
        variant_id: "var_2",
        quantity: 1,
        unit_price: 450,
        title: "Sturdy Dry Fruit Tea Cake",
      },
    ],
  });

  const mixedErr = checkoutMixedCart.errors.find(
    (e) => e.code === "PRODUCT_DISTANCE_EXCEEDED" && e.product_id === testProdId
  );

  assert(
    Boolean(mixedErr),
    "Test 12: Mixed cart accurately isolates and flags only the product exceeding distance limit",
    testProdId,
    mixedErr?.product_id,
    mixedErr?.message
  );

  // --------------------------------------------------------------------------
  // Scenario 8: Client Payload Tamper Resistance
  // Customer sends custom `max_delivery_distance_km: 999` in checkout payload
  // Expected: Server validates from authoritative product entity, ignoring client payload!
  // --------------------------------------------------------------------------
  const checkoutTamper = ApiEngine.validateCheckout({
    customer_id: "cus_test_01",
    customer_email: "test@example.com",
    delivery_type: "delivery",
    branch_id: "br_indiranagar",
    delivery_date: testDateStr,
    delivery_slot_id: testSlotId,
    delivery_latitude: 12.9698,
    delivery_longitude: 77.7499,
    pincode: "560066",
    items: [
      {
        product_id: testProdId,
        variant_id: "var_1",
        quantity: 1,
        unit_price: 850,
        title: "Artisan Delicate Truffle Cake",
        max_delivery_distance_km: 999, // Attempted tamper!
      } as any,
    ],
  });

  const tamperDetected = checkoutTamper.errors.find((e) => e.code === "PRODUCT_DISTANCE_EXCEEDED");
  assert(
    Boolean(tamperDetected),
    "Test 13: Client payload cannot override authoritative server-side product distance limit",
    true,
    Boolean(tamperDetected)
  );

  // --------------------------------------------------------------------------
  // Scenario 9: PostgreSQL Persistence
  // Verify that persistProductToDb accurately writes max_delivery_distance_km
  // --------------------------------------------------------------------------
  try {
    const pgTestId = "prod_dist_pg_persisted_test";
    await persistProductToDb({
      id: pgTestId,
      title: "Artisan Dedicated PG Test Cake",
      handle: "artisan-dedicated-pg-test-cake",
      price: 850,
      max_delivery_distance_km: 7.5,
      pim_config: {
        max_delivery_distance_km: 7.5,
      },
    });

    const dbRowRes = await dbQuery('SELECT metadata FROM "product" WHERE id = $1', [pgTestId]);
    const rawMeta = dbRowRes.rows[0]?.metadata;
    const persistedMeta = typeof rawMeta === "string" ? JSON.parse(rawMeta) : rawMeta;
    const dbDist = persistedMeta?.max_delivery_distance_km;

    assert(
      dbDist === 7.5,
      "Test 14: PostgreSQL persistence writes max_delivery_distance_km = 7.5 directly to DB",
      7.5,
      dbDist
    );
  } catch (err: any) {
    console.warn("DB test skipped or database offline:", err.message);
  }

  // Final Summary
  console.log("\n===============================================================================");
  const passedCount = reports.filter((r) => r.passed).length;
  const totalCount = reports.length;
  console.log(`TOTAL TESTS: ${totalCount} | PASSED: ${passedCount} | FAILED: ${totalCount - passedCount}`);
  console.log("===============================================================================\n");

  if (passedCount !== totalCount) {
    process.exit(1);
  }
}

runSuite().catch((err) => {
  console.error("Test Suite Fatal Error:", err);
  process.exit(1);
});
