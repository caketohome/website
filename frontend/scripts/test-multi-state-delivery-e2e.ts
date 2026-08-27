/**
 * CakeToHome — Master Multi-State / Multi-City / Multi-Store / Map-Fenced Delivery E2E Test Suite
 * 
 * Verifies:
 * 1. State Master Registry & Multi-City Hierarchy
 * 2. State Master CRUD Operations
 * 3. Multi-State Polygon Map-Fencing & Point-in-Polygon (PIP) Resolution
 * 4. Polygon Exclusion Filtering & Non-serviceable GPS Rejection
 * 5. Multi-State Pincode Direct Resolution
 * 6. Multi-State Statutory Tax Calculations (Intra-State CGST/SGST vs Inter-State IGST)
 * 7. Order Finalization & Immutable Multi-State Compliance Snapshotting
 */

import { ApiEngine } from "../src/lib/api-engine";

let totalTests = 0;
let passedTests = 0;
let failedTests = 0;

function assert(condition: boolean, testName: string, details?: any) {
  totalTests++;
  if (condition) {
    passedTests++;
    console.log(`  ✅ PASS: ${testName}`);
  } else {
    failedTests++;
    console.error(`  ❌ FAIL: ${testName}`, details ? details : "");
  }
}

async function runTestSuite() {
  console.log("===============================================================================");
  console.log("🧪 CAKETOHOME — MULTI-STATE & MAP-FENCED DELIVERY ARCHITECTURE E2E SUITE");
  console.log("===============================================================================\n");

  // ──────────────────────────────────────────────────────────────────────────
  // TEST SUITE 1: Master State Registry & Hierarchy
  // ──────────────────────────────────────────────────────────────────────────
  console.log("▶ [TEST SUITE 1] State Master Registry & Geographic Hierarchy");

  const states = ApiEngine.listStates(true);
  assert(states.length >= 10, `State Master contains >= 10 key seed states (Found: ${states.length})`);

  const kerala = ApiEngine.getStateByCode("KL");
  assert(!!kerala && kerala.name === "Kerala" && kerala.gst_state_code === "32", "Kerala resolved via KL (GST: 32)");

  const tamilNadu = ApiEngine.getStateByCode("TN");
  assert(!!tamilNadu && tamilNadu.name === "Tamil Nadu" && tamilNadu.gst_state_code === "33", "Tamil Nadu resolved via TN (GST: 33)");

  const maharashtra = ApiEngine.getStateByCode("MH");
  assert(!!maharashtra && maharashtra.name === "Maharashtra" && maharashtra.gst_state_code === "27", "Maharashtra resolved via MH (GST: 27)");

  const karnataka = ApiEngine.getStateByCode("KA");
  assert(!!karnataka && karnataka.name === "Karnataka" && karnataka.gst_state_code === "29", "Karnataka resolved via KA (GST: 29)");

  const delhi = ApiEngine.getStateByCode("DL");
  assert(!!delhi && delhi.name === "Delhi NCR" && delhi.gst_state_code === "07", "Delhi resolved via DL (GST: 07)");

  const cities = ApiEngine.listCities(true);
  assert(cities.length >= 5, `City registry contains multi-state seed cities (Found: ${cities.length})`);

  const kochiCity = cities.find(c => c.slug === "kochi" || c.name.toLowerCase().includes("kochi"));
  assert(!!kochiCity && (kochiCity.stateCode === "KL" || kochiCity.state === "Kerala"), "Kochi city linked to Kerala (KL)");

  const mumbaiCity = cities.find(c => c.slug === "mumbai" || c.name.toLowerCase().includes("mumbai"));
  assert(!!mumbaiCity && (mumbaiCity.stateCode === "MH" || mumbaiCity.state === "Maharashtra"), "Mumbai city linked to Maharashtra (MH)");

  // ──────────────────────────────────────────────────────────────────────────
  // TEST SUITE 2: State Master Dynamic CRUD
  // ──────────────────────────────────────────────────────────────────────────
  console.log("\n▶ [TEST SUITE 2] State Master CRUD Engine");

  const testCode = `T${Math.floor(10 + Math.random() * 89)}`;
  const existing = ApiEngine.getStateByCode(testCode);
  if (existing) {
    ApiEngine.archiveState(existing.id);
  }

  const newState = ApiEngine.createState({
    name: `Test State ${testCode}`,
    code: testCode,
    gst_state_code: "99",
    country_code: "IN",
    display_order: 99,
  });
  assert(!!newState && newState.code === testCode, `State '${testCode}' created dynamically`);

  const retrieved = ApiEngine.getStateByCode(testCode);
  assert(!!retrieved && retrieved.gst_state_code === "99", `State '${testCode}' retrieved by code '${testCode}'`);

  const updated = ApiEngine.updateState(newState.id, { name: `Test State ${testCode} Updated` });
  assert(!!updated && updated.name === `Test State ${testCode} Updated`, `State '${testCode}' updated successfully`);

  const archived = ApiEngine.archiveState(newState.id);
  assert(!!archived && archived.status === "archived", `State '${testCode}' archived`);

  const activeAfterArchive = ApiEngine.listStates(false).find(s => s.code === testCode);
  assert(!activeAfterArchive, "Archived state excluded from active storefront list");

  const restored = ApiEngine.restoreState(newState.id);
  assert(!!restored && restored.status === "active", `State '${testCode}' restored to active status`);

  // ──────────────────────────────────────────────────────────────────────────
  // TEST SUITE 3: Multi-State Polygon Map-Fencing & Point-in-Polygon (PIP)
  // ──────────────────────────────────────────────────────────────────────────
  console.log("\n▶ [TEST SUITE 3] Geospatial Polygon Map-Fencing & PIP Resolution");

  // Test PIP Algorithm directly
  const trianglePolygon = [
    { lat: 10, lng: 10 },
    { lat: 10, lng: 20 },
    { lat: 20, lng: 15 },
  ];
  assert(ApiEngine.isPointInPolygon(12, 15, trianglePolygon), "Ray-Casting PIP correctly identifies point inside polygon");
  assert(!ApiEngine.isPointInPolygon(5, 5, trianglePolygon), "Ray-Casting PIP correctly identifies point outside polygon");

  // Test Bengaluru Indiranagar GPS resolution (12.9784, 77.6408)
  const blrRes = ApiEngine.resolveDeliveryContext(undefined, 12.9784, 77.6408);
  assert(blrRes.serviceable === true, "Indiranagar GPS coordinates (12.9784, 77.6408) is serviceable");
  assert(blrRes.store?.id === "br_indiranagar" || blrRes.storeId === "br_indiranagar", "Indiranagar GPS resolves to Indiranagar Flagship Kitchen");
  assert(blrRes.stateCode === "KA" || blrRes.stateName === "Karnataka", "Indiranagar GPS resolves to Karnataka (KA)");

  // Test Kochi Ernakulam Marine Drive GPS resolution (9.9816, 76.2753)
  const kochiRes = ApiEngine.resolveDeliveryContext(undefined, 9.9816, 76.2753);
  assert(kochiRes.serviceable === true, "Kochi Marine Drive GPS (9.9816, 76.2753) is serviceable");
  assert(kochiRes.store?.id === "br_kochi_ernakulam" || kochiRes.storeId === "br_kochi_ernakulam", "Kochi GPS resolves to Kochi Ernakulam Gourmet Hub");
  assert(kochiRes.stateCode === "KL" || kochiRes.stateName === "Kerala", "Kochi GPS resolves to Kerala (KL)");

  // Test Mumbai Bandra GPS resolution (19.0596, 72.8295)
  const mumbaiRes = ApiEngine.resolveDeliveryContext(undefined, 19.0596, 72.8295);
  assert(mumbaiRes.serviceable === true, "Mumbai Bandra GPS (19.0596, 72.8295) is serviceable");
  assert(mumbaiRes.store?.id === "br_mumbai_bandra" || mumbaiRes.storeId === "br_mumbai_bandra", "Mumbai GPS resolves to Mumbai Bandra Hub");
  assert(mumbaiRes.stateCode === "MH" || mumbaiRes.stateName === "Maharashtra", "Mumbai GPS resolves to Maharashtra (MH)");

  // Test Non-Serviceable GPS Coordinates (e.g. Arabian Sea or Thar Desert: 26.5000, 70.0000)
  const desertRes = ApiEngine.resolveDeliveryContext(undefined, 26.5000, 70.0000);
  assert(desertRes.serviceable === false, "Remote unserviced GPS (26.5000, 70.0000) is rejected as unserviceable");

  // ──────────────────────────────────────────────────────────────────────────
  // TEST SUITE 4: Multi-State Pincode Direct Resolution
  // ──────────────────────────────────────────────────────────────────────────
  console.log("\n▶ [TEST SUITE 4] Multi-State Pincode Direct Resolution");

  const pinBlr = ApiEngine.resolveDeliveryContext("560038");
  assert(pinBlr.serviceable === true, "PIN 560038 is serviceable");
  assert(pinBlr.store?.id === "br_indiranagar", "PIN 560038 serviced by Indiranagar Hub");
  assert(pinBlr.stateCode === "KA", "PIN 560038 state is Karnataka (KA)");

  const pinKochi = ApiEngine.resolveDeliveryContext("682016");
  assert(pinKochi.serviceable === true, "PIN 682016 (Kochi) is serviceable");
  assert(pinKochi.store?.id === "br_kochi_ernakulam", "PIN 682016 serviced by Kochi Hub");
  assert(pinKochi.stateCode === "KL", "PIN 682016 state is Kerala (KL)");

  const pinMumbai = ApiEngine.resolveDeliveryContext("400050");
  assert(pinMumbai.serviceable === true, "PIN 400050 (Mumbai) is serviceable");
  assert(pinMumbai.store?.id === "br_mumbai_bandra", "PIN 400050 serviced by Mumbai Hub");
  assert(pinMumbai.stateCode === "MH", "PIN 400050 state is Maharashtra (MH)");

  const pinChennai = ApiEngine.resolveDeliveryContext("600017");
  assert(pinChennai.serviceable === true, "PIN 600017 (Chennai) is serviceable");
  assert(pinChennai.store?.id === "br_chennai_tnagar", "PIN 600017 serviced by Chennai Hub");
  assert(pinChennai.stateCode === "TN", "PIN 600017 state is Tamil Nadu (TN)");

  const pinInvalid = ApiEngine.resolveDeliveryContext("999999");
  assert(pinInvalid.serviceable === false, "Invalid PIN 999999 safely rejected as unserviceable");

  // ──────────────────────────────────────────────────────────────────────────
  // TEST SUITE 5: Statutory Tax Calculations (Intra-State vs Inter-State)
  // ──────────────────────────────────────────────────────────────────────────
  console.log("\n▶ [TEST SUITE 5] Multi-State GST & Statutory Tax Engine");

  // Intra-State Karnataka
  const taxBlr = ApiEngine.resolveTaxContext({
    branchId: "br_indiranagar",
    customerAddress: { state: "Karnataka", city: "Bengaluru", postal_code: "560038" },
  });
  assert(taxBlr.isIntraState === true, "Karnataka seller to Karnataka customer is INTRA-STATE");
  assert(taxBlr.sellerStateCode === "29" && taxBlr.customerStateCode === "29", "Karnataka tax codes are 29 -> 29");

  // Intra-State Kerala
  const taxKochi = ApiEngine.resolveTaxContext({
    branchId: "br_kochi_ernakulam",
    customerAddress: { state: "Kerala", city: "Kochi", postal_code: "682016" },
  });
  assert(taxKochi.isIntraState === true, "Kerala seller to Kerala customer is INTRA-STATE");
  assert(taxKochi.sellerStateCode === "32" && taxKochi.customerStateCode === "32", "Kerala tax codes are 32 -> 32");

  // Intra-State Maharashtra
  const taxMumbai = ApiEngine.resolveTaxContext({
    branchId: "br_mumbai_bandra",
    customerAddress: { state: "Maharashtra", city: "Mumbai", postal_code: "400050" },
  });
  assert(taxMumbai.isIntraState === true, "Maharashtra seller to Maharashtra customer is INTRA-STATE");
  assert(taxMumbai.sellerStateCode === "27" && taxMumbai.customerStateCode === "27", "Maharashtra tax codes are 27 -> 27");

  // Inter-State Karnataka seller to Kerala customer
  const taxInterState = ApiEngine.resolveTaxContext({
    branchId: "br_indiranagar",
    customerAddress: { state: "Kerala", city: "Kochi", postal_code: "682016" },
  });
  assert(taxInterState.isIntraState === false, "Karnataka seller to Kerala customer is INTER-STATE");
  assert(taxInterState.supplyType === "INTER-STATE", "Supply type is INTER-STATE (IGST applicable)");

  // ──────────────────────────────────────────────────────────────────────────
  // TEST SUITE 6: Order Finalization & Multi-State Snapshotting
  // ──────────────────────────────────────────────────────────────────────────
  console.log("\n▶ [TEST SUITE 6] Order Finalization & Multi-State Compliance Snapshotting");

  // Create a cart for testing Kerala order
  const cartRes = ApiEngine.getCart(`cart_test_kl_${Date.now()}`);
  const cartId = cartRes.id || (cartRes as any).cart?.id;

  // Add an item to cart
  const products = ApiEngine.listProducts();
  const testProduct = products[0];
  ApiEngine.addItemToCart(cartId, {
    product_id: testProduct?.id || "prod_belgian_chocolate",
    title: testProduct?.title || "Belgian Truffle Cake",
    quantity: 1,
    unit_price: 899,
    weight: "1.0 kg",
    hsn_code: "19059090",
    gst_rate_pct: 5,
  });

  const orderResult = ApiEngine.confirmCheckout({
    cart_id: cartId,
    pincode: "682016",
    address: {
      first_name: "Rahul",
      last_name: "Menon",
      phone: "+91 98470 12345",
      email: "rahul.menon@example.com",
      line1: "Flat 3B, Skywalk Marine Drive",
      city: "Kochi",
      state: "Kerala",
      pincode: "682016",
      country: "India",
    },
    delivery_date: new Date(Date.now() + 86400000).toISOString().slice(0, 10),
    delivery_slot_id: "slot_eve",
    payment_method: "cod",
  });

  assert(orderResult.success === true, "Kerala order confirmed successfully");
  const createdOrder = (orderResult as any).order;
  assert(createdOrder?.state === "Kerala", "Order snapshotted state: Kerala");
  assert(createdOrder?.city === "Kochi", "Order snapshotted city: Kochi");
  assert(createdOrder?.branch_id === "br_kochi_ernakulam", "Order allocated to Kochi Hub (br_kochi_ernakulam)");
  assert(createdOrder?.compliance_snapshot?.seller_state === "Kerala", "Order compliance snapshotted seller state: Kerala");
  assert(createdOrder?.compliance_snapshot?.seller_state_code === "32", "Order compliance snapshotted seller state code: 32");

  // ──────────────────────────────────────────────────────────────────────────
  // SUMMARY
  // ──────────────────────────────────────────────────────────────────────────
  console.log("\n===============================================================================");
  console.log(`🏁 TEST RESULTS: Total: ${totalTests} | Passed: ${passedTests} | Failed: ${failedTests}`);
  console.log(`📊 SUCCESS RATE: ${((passedTests / totalTests) * 100).toFixed(1)}%`);
  console.log("===============================================================================");

  if (failedTests > 0) {
    process.exit(1);
  }
}

runTestSuite().catch((err) => {
  console.error("Test execution failed:", err);
  process.exit(1);
});
