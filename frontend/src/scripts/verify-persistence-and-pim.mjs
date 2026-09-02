/**
 * Comprehensive CakeToHome Persistence, PIM, and Checkout Verification Suite
 */

const BASE_URL = "http://localhost:3000/api/v1";

async function runVerification() {
  console.log("================================================================================");
  console.log("🚀 STARTING CAKETOHOME MASTER DATA / PERSISTENCE / PIM / CHECKOUT VERIFICATION");
  console.log("================================================================================\n");

  let passedTests = 0;
  let failedTests = 0;

  function assert(condition, testName, details = "") {
    if (condition) {
      console.log(`✅ [PASS] ${testName}`);
      passedTests++;
    } else {
      console.error(`❌ [FAIL] ${testName} - ${details}`);
      failedTests++;
    }
  }

  try {
    // 1. Health Check
    console.log("--- 1. Testing System & Database Health ---");
    const healthRes = await fetch(`${BASE_URL}/health`);
    const healthData = await healthRes.json();
    assert(healthRes.ok && healthData.status === "healthy", "Health Check returns healthy", JSON.stringify(healthData));
    assert(healthData.storage === "postgres", "Health Check confirms PostgreSQL storage authority", healthData.storage);

    // 2. Master Variant Options
    console.log("\n--- 2. Testing Master Variant Options Persistence (Flavors & Shapes) ---");
    const initialFlavorsRes = await fetch(`${BASE_URL}/admin/catalog/flavors`);
    const initialFlavorsData = await initialFlavorsRes.json();
    assert(initialFlavorsRes.ok && Array.isArray(initialFlavorsData.flavors), "GET /admin/catalog/flavors returns valid list", `Count: ${initialFlavorsData.flavors?.length}`);
    const initialFlavorsCount = initialFlavorsData.flavors.length;

    // Create a new Master Flavor
    const testFlavorName = `Artisan Pistachio Truffle ${Date.now()}`;
    const createFlavorRes = await fetch(`${BASE_URL}/admin/catalog/flavors`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: testFlavorName,
        display_name: testFlavorName,
        price_modifier: 175,
        display_order: 10,
      }),
    });
    const createFlavorData = await createFlavorRes.json();
    assert(createFlavorRes.status === 201 && createFlavorData.success, "POST /admin/catalog/flavors creates flavor in DB", JSON.stringify(createFlavorData));
    const createdFlavorId = createFlavorData.flavor?.id;

    // Verify Master Flavor in DB List
    const afterFlavorsRes = await fetch(`${BASE_URL}/admin/catalog/flavors`);
    const afterFlavorsData = await afterFlavorsRes.json();
    const foundFlavor = afterFlavorsData.flavors.find(f => f.name === testFlavorName || f.id === createdFlavorId);
    assert(Boolean(foundFlavor), "Created flavor is present in GET /admin/catalog/flavors", `Found: ${foundFlavor?.name}`);

    // Create a new Master Shape
    const testShapeName = `Hexagonal Star ${Date.now()}`;
    const createShapeRes = await fetch(`${BASE_URL}/admin/catalog/shapes`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: testShapeName,
        display_name: testShapeName,
        price_modifier: 250,
        display_order: 10,
      }),
    });
    const createShapeData = await createShapeRes.json();
    assert(createShapeRes.status === 201 && createShapeData.success, "POST /admin/catalog/shapes creates shape in DB", JSON.stringify(createShapeData));
    const createdShapeId = createShapeData.shape?.id;

    // 3. Product Weight Matrix & PIM Persistence
    console.log("\n--- 3. Testing Product Weight Matrix & Option Mapping Persistence ---");
    const productsRes = await fetch(`${BASE_URL}/admin/catalog/products`);
    const productsData = await productsRes.json();
    const targetProduct = productsData.products?.[0] || { id: "prod_choco_truffle_01" };
    const productId = targetProduct.id || targetProduct.product_id;

    console.log(`Using target product: ${productId} (${targetProduct.title || targetProduct.name})`);

    // Save custom weight prices
    const customWeights = [
      { weight_name: "0.75 kg", selling_price: 699, mrp: 899, is_enabled: true, normalized_grams: 750 },
      { weight_name: "1.25 kg", selling_price: 1099, mrp: 1399, is_enabled: true, normalized_grams: 1250 },
      { weight_name: "2.5 kg", selling_price: 1999, mrp: 2499, is_enabled: true, normalized_grams: 2500 },
    ];
    const saveWeightsRes = await fetch(`${BASE_URL}/admin/catalog/products/${productId}/weight-prices`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ weight_prices: customWeights }),
    });
    const saveWeightsData = await saveWeightsRes.json();
    assert(saveWeightsRes.ok && saveWeightsData.success, "PUT /admin/catalog/products/:id/weight-prices persists weights to DB", JSON.stringify(saveWeightsData));

    // Save Flavor & Shape Mappings
    const mapFlavorRes = await fetch(`${BASE_URL}/admin/catalog/products/${productId}/flavor-mappings`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        mappings: [
          { flavor_id: createdFlavorId, name: testFlavorName, price_override: 175, is_enabled: true }
        ]
      }),
    });
    const mapFlavorData = await mapFlavorRes.json();
    assert(mapFlavorRes.ok && mapFlavorData.success, "POST flavor-mappings maps custom flavor to product", JSON.stringify(mapFlavorData));

    const mapShapeRes = await fetch(`${BASE_URL}/admin/catalog/products/${productId}/shape-mappings`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        mappings: [
          { shape_id: createdShapeId, name: testShapeName, price_override: 250, is_enabled: true }
        ]
      }),
    });
    const mapShapeData = await mapShapeRes.json();
    assert(mapShapeRes.ok && mapShapeData.success, "POST shape-mappings maps custom shape to product", JSON.stringify(mapShapeData));

    // Verify Product Weight Prices retrieval
    const getWeightsRes = await fetch(`${BASE_URL}/admin/catalog/products/${productId}/weight-prices`);
    const getWeightsData = await getWeightsRes.json();
    const retrievedWeights = getWeightsData.weight_prices || [];
    assert(retrievedWeights.length === 3, "GET weight-prices returns exactly the 3 configured weights (no default reset)", `Count: ${retrievedWeights.length}`);
    const has075 = retrievedWeights.some(w => w.weight_name === "0.75 kg" && Number(w.selling_price) === 699);
    assert(has075, "Custom 0.75 kg @ 699 persisted correctly", JSON.stringify(retrievedWeights[0]));

    // 4. Fulfillment Configuration & Store Pickup Toggle Governance
    console.log("\n--- 4. Testing Fulfillment Config & Store Pickup Governance ---");
    
    // Disable Store Pickup
    const disablePickupRes = await fetch(`${BASE_URL}/admin/fulfillment/config`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ store_pickup_enabled: false }),
    });
    const disablePickupData = await disablePickupRes.json();
    assert(disablePickupRes.ok && disablePickupData.config?.store_pickup_enabled === false, "POST /admin/fulfillment/config disables store pickup in DB", JSON.stringify(disablePickupData));

    // Validate Checkout with pickup -> MUST FAIL
    const pickupCheckoutRes = await fetch(`${BASE_URL}/checkout/validate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        cart_id: "cart_test_persistence",
        delivery_type: "pickup",
        items: [{ product_id: productId, quantity: 1, unit_price: 699, name: "Test Cake" }],
      }),
    });
    const pickupCheckoutData = await pickupCheckoutRes.json();
    const hasPickupDisabledError = pickupCheckoutData.errors?.some(e => e.code === "STORE_PICKUP_DISABLED");
    assert(hasPickupDisabledError, "Checkout validation strictly rejects pickup when store_pickup_enabled=false", JSON.stringify(pickupCheckoutData.errors));

    // Re-enable Store Pickup
    const enablePickupRes = await fetch(`${BASE_URL}/admin/fulfillment/config`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ store_pickup_enabled: true }),
    });
    const enablePickupData = await enablePickupRes.json();
    assert(enablePickupRes.ok && enablePickupData.config?.store_pickup_enabled === true, "POST /admin/fulfillment/config re-enables store pickup in DB", JSON.stringify(enablePickupData));

    // 5. Real Location Search Geocoding
    console.log("\n--- 5. Testing Geographic Location Search Engine ---");
    const geoSearchRes = await fetch(`${BASE_URL}/delivery/search-location?q=Indiranagar`);
    const geoSearchData = await geoSearchRes.json();
    assert(geoSearchRes.ok && Array.isArray(geoSearchData) && geoSearchData.length > 0, "Location search returns valid results with real coordinates", `Results: ${geoSearchData.length}`);
    const firstLoc = geoSearchData[0];
    assert(typeof firstLoc.latitude === "number" && typeof firstLoc.longitude === "number", "Location result contains numeric GPS coordinates", `Lat: ${firstLoc.latitude}, Lng: ${firstLoc.longitude}`);

    // Cleanup: Delete the test variant options to preserve database hygiene
    console.log("\n--- 6. Cleaning Up Test Variant Options ---");
    if (createdFlavorId) {
      const delFlv = await fetch(`${BASE_URL}/admin/catalog/flavors/${createdFlavorId}`, { method: "DELETE" });
      assert(delFlv.ok, `Soft-deleted test flavor ${createdFlavorId}`);
    }
    if (createdShapeId) {
      const delShp = await fetch(`${BASE_URL}/admin/catalog/shapes/${createdShapeId}`, { method: "DELETE" });
      assert(delShp.ok, `Soft-deleted test shape ${createdShapeId}`);
    }

  } catch (err) {
    console.error("💥 Unhandled exception during verification:", err);
    failedTests++;
  }

  console.log("\n================================================================================");
  console.log(`🏁 VERIFICATION COMPLETE: ${passedTests} PASSED, ${failedTests} FAILED`);
  console.log("================================================================================");
  
  if (failedTests > 0) {
    process.exit(1);
  }
}

runVerification();
