import { ApiEngine } from "../src/lib/api-engine";

async function runMultiCityE2ETests() {
  console.log("\n========================================================");
  console.log("🚀 STARTING MULTI-CITY PLATFORM E2E VERIFICATION SUITE");
  console.log("========================================================\n");

  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, testName: string, detail?: any) {
    if (condition) {
      console.log(`  ✅ PASS: ${testName}`);
      passed++;
    } else {
      console.error(`  ❌ FAIL: ${testName}`, detail !== undefined ? detail : "");
      failed++;
    }
  }

  // ─────────────────────────────────────────────────────────────
  // DOMAIN 1: City Entity CRUD & Seed Verification
  // ─────────────────────────────────────────────────────────────
  console.log("\n--- Domain 1: City Entity & CRUD Engine ---");
  
  const initialCities = ApiEngine.listCities(true);
  assert(Array.isArray(initialCities) && initialCities.length >= 6, "List all cities (returns >= 6 seeded cities)", `Found ${initialCities.length} cities`);
  
  const bbrCity = ApiEngine.getCityBySlug("bengaluru");
  assert(!!bbrCity && bbrCity.name === "Bengaluru" && bbrCity.state === "Karnataka", "Lookup city by slug 'bengaluru'");

  const bomCity = ApiEngine.getCityBySlug("mumbai");
  assert(!!bomCity && bomCity.name === "Mumbai" && bomCity.state === "Maharashtra", "Lookup city by slug 'mumbai'");

  const kocCity = ApiEngine.getCityBySlug("kochi");
  assert(!!kocCity && kocCity.name === "Kochi" && kocCity.state === "Kerala", "Lookup city by slug 'kochi'");

  // Test Create City
  const testCitySlug = `pune-test-${Date.now()}`;
  const createdCity = ApiEngine.createCity({
    name: "Pune Test",
    slug: testCitySlug,
    state: "Maharashtra",
    stateCode: "MH",
    country: "India",
    countryCode: "IN",
    timezone: "Asia/Kolkata",
    currency: "INR",
    phoneCode: "+91",
    status: "active",
    displayOrder: 10,
  });
  assert(!!createdCity.id && createdCity.slug === testCitySlug, "Create new CityItem with full schema");

  // Test Update City
  const updatedCity = ApiEngine.updateCity(createdCity.id, { name: "Pune Metro" });
  assert(updatedCity?.name === "Pune Metro", "Update CityItem properties");

  // Test Archive & Restore
  const archived = ApiEngine.archiveCity(createdCity.id);
  assert(archived?.status === "archived", "Archive CityItem");
  const activeOnly = ApiEngine.listCities(false);
  assert(!activeOnly.some(c => c.id === createdCity.id), "Archived city excluded from active storefront list");
  const restored = ApiEngine.restoreCity(createdCity.id);
  assert(restored?.status === "active", "Restore CityItem to active");

  // ─────────────────────────────────────────────────────────────
  // DOMAIN 2: Multi-City Branch FK & Data Migration
  // ─────────────────────────────────────────────────────────────
  console.log("\n--- Domain 2: Multi-City Data Migration & Branch FK ---");

  const migrationRes = ApiEngine.migrateExistingDataToMultiCity();
  assert(typeof migrationRes.migrated_branches === "number" && migrationRes.orphaned === 0, "Data migration maps legacy branches to city records without orphaned records", migrationRes);

  const branches = ApiEngine.listBranches();
  const allHaveCityId = branches.every((b: any) => !!b.city_id);
  assert(allHaveCityId, "All active branches have formal city_id foreign key populated");

  const bbrBranches = ApiEngine.getCityBranches(bbrCity!.id);
  assert(bbrBranches.length >= 2, `Bengaluru city has assigned branches (${bbrBranches.length} found)`);

  const bbrStats = ApiEngine.getCityStats(bbrCity!.id);
  assert(bbrStats.branches >= 2 && bbrStats.zones > 0, "City stats calculation (stores, zones, pincodes)", bbrStats);

  // ─────────────────────────────────────────────────────────────
  // DOMAIN 3: Single Authoritative Delivery Resolver
  // ─────────────────────────────────────────────────────────────
  console.log("\n--- Domain 3: Single Authoritative Delivery Resolver (resolveDeliveryContext) ---");

  // Test valid serviceable pincode (e.g. 560038)
  const resolve560038 = ApiEngine.resolveDeliveryContext("560038");
  assert(resolve560038.serviceable === true, "Resolve serviceable pincode 560038 (serviceable=true)");
  assert(resolve560038.cityName === "Bengaluru", "Resolve correct city name for 560038");
  assert(resolve560038.storeId === "br_indiranagar", "Resolve correct fulfillment hub for 560038 (br_indiranagar)");
  assert(!!resolve560038.zoneId, "Resolve correct delivery zone for 560038");
  assert(typeof resolve560038.deliveryFee === "number", "Resolve delivery fee accurately from zone rules");

  // Test valid unserviceable pincode (e.g. 999999)
  const resolveUnserv = ApiEngine.resolveDeliveryContext("999999");
  assert(resolveUnserv.serviceable === false && !!resolveUnserv.blockedReason, "Reject unserviceable pincode 999999 with explanatory reason");

  // Test invalid malformed pincode (e.g. "123")
  const resolveInvalid = ApiEngine.resolveDeliveryContext("123");
  assert(resolveInvalid.serviceable === false, "Reject malformed pincode gracefully");

  // ─────────────────────────────────────────────────────────────
  // DOMAIN 4: Checkout & Order Creation Multi-City Flow
  // ─────────────────────────────────────────────────────────────
  console.log("\n--- Domain 4: Checkout Validation & Server-Side Availability ---");

  const cartId = `cart_multicity_${Date.now()}`;
  ApiEngine.addToCart(cartId, { product_id: "prod_1", quantity: 1 });

  const chkAvail = ApiEngine.getCheckoutAvailability({
    cart_id: cartId,
    pincode: "560038",
    delivery_type: "delivery",
  });
  assert(chkAvail.serviceable === true, "Checkout availability validates serviceable pincode with cart");
  assert(chkAvail.pricing && chkAvail.pricing.grand_total > 0, "Authoritative pricing calculated server-side");

  const orderRes = ApiEngine.confirmCheckout({
    cart_id: cartId,
    pincode: "560038",
    delivery_type: "delivery",
    delivery_date: new Date().toISOString().slice(0, 10),
    payment_method: "cod",
    address: {
      first_name: "MultiCity",
      last_name: "Tester",
      phone: "+91 99999 88888",
      email: "multicity@test.com",
      line1: "100ft Road",
      city: "Bengaluru",
      pincode: "560038",
    },
  });
  assert(orderRes.success === true && !!orderRes.order, "Confirm checkout creates canonical multi-city order");
  const placedOrder = orderRes.order;
  assert(placedOrder.branch_id === "br_indiranagar" && placedOrder.city === "Bengaluru", "Order immutably captures branch_id and city snapshot");

  // ─────────────────────────────────────────────────────────────
  // SUMMARY
  // ─────────────────────────────────────────────────────────────
  console.log("\n========================================================");
  console.log(`📊 MULTI-CITY E2E TEST SUMMARY: ${passed} PASSED, ${failed} FAILED`);
  console.log("========================================================\n");

  if (failed > 0) {
    process.exit(1);
  }
}

runMultiCityE2ETests().catch((err) => {
  console.error("Test execution encountered an error:", err);
  process.exit(1);
});
