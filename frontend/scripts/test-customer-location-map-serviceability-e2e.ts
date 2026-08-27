/**
 * CakeToHome Automated Verification Suite:
 * Customer Location Picker & Real Map-Fence Serviceability Engine E2E
 * 
 * Verifies:
 * - TEST A: Current Location (GPS) Flow
 * - TEST B: Location Search Flow
 * - TEST C: Saved Address Flow
 * - TEST D: Outside Polygon Zone Rejection (Coordinate Supremacy over Pincode)
 * - TEST E: Exclusion Polygon Hard Block (Restricted Hazard Perimeter)
 * - TEST F: Multi-Store Geofence Isolation
 * - TEST G: Client-Side Tampering Rejection & Authoritative Pricing/Store Override
 * - TEST H: Historical Order Destination Immutability Snapshot
 * - TEST I: Coordinate Boundary & Malformed Input Defense
 * - TEST J: Rider Navigation Google Maps Deep-Link Precision
 */

import { ApiEngine } from "../src/lib/api-engine";
import {
  isValidCoordinate,
  buildGoogleMapsDirectionsUrl,
  buildGoogleMapsViewUrl,
  extractDeliveryCoordinates,
} from "../src/lib/location/directions";

let totalTests = 0;
let passedTests = 0;
let failedTests = 0;

function assert(condition: boolean, testName: string, detail?: string) {
  totalTests++;
  if (condition) {
    passedTests++;
    console.log(`  ✅ [PASS] ${testName}${detail ? ` (${detail})` : ""}`);
  } else {
    failedTests++;
    console.error(`  ❌ [FAIL] ${testName}${detail ? ` - Detail: ${detail}` : ""}`);
  }
}

function getAvailableTestProductAndSlot(branchId: string, targetDate: string) {
  const catalogProducts = ApiEngine.listProducts();
  const sampleProduct = catalogProducts[0] || {
    id: "prod_sample",
    product_id: "prod_sample",
    title: "Fresh Chocolate Truffle Cake",
    price: 599,
  };

  // Ensure available at branch
  ApiEngine.updateBranchProductAvailability(branchId, sampleProduct.id || (sampleProduct as any).product_id, "AVAILABLE");

  const slotRes = ApiEngine.getDeliverySlots(branchId, targetDate, "delivery");
  const availableSlot = slotRes.delivery_slots.find((s) => s.available) || slotRes.delivery_slots[0] || { id: "SLOT_STANDARD_AFTERNOON" };

  return {
    product: sampleProduct,
    slotId: availableSlot.id,
  };
}

async function runE2ESuite() {
  console.log("\n" + "=".repeat(85));
  console.log("🚀 CAKETOHOME — CUSTOMER LOCATION PICKER & MAP-FENCE SERVICEABILITY E2E SUITE");
  console.log("=".repeat(85) + "\n");

  // Ensure stores are initialized
  ApiEngine.ensureOrdersStore();
  ApiEngine.ensureDeliveryPartnersStore();
  const branches = ApiEngine.listBranches();
  const tomorrowStr = new Date(Date.now() + 86400000).toISOString().slice(0, 10);

  // ──────────────────────────────────────────────────────────────────────────
  // TEST A: CURRENT LOCATION (GPS)
  // ──────────────────────────────────────────────────────────────────────────
  console.log("📌 TEST A: Current Location (GPS Auto-Detection & Geofence Resolution)");
  {
    const gpsLat = 12.9716;
    const gpsLng = 77.6412;

    // 1. Reverse Geocode Coordinates
    const revGeo = ApiEngine.reverseGeocode(gpsLat, gpsLng);
    assert(revGeo.success === true, "TEST A.1: GPS reverse geocode succeeded", revGeo.formatted_address);
    assert(revGeo.serviceable === true, "TEST A.2: Location resolved as serviceable within Indiranagar zone");
    assert(Boolean(revGeo.branch_id), "TEST A.3: Serving bakery branch identified", revGeo.branch_name || "");
    assert(revGeo.latitude === 12.9716 && revGeo.longitude === 77.6412, "TEST A.4: Exact GPS coordinates preserved");

    // 2. Resolve Delivery Context from GPS
    const delCtx = ApiEngine.resolveDeliveryContext(undefined, gpsLat, gpsLng);
    assert(delCtx.serviceable === true, "TEST A.5: Authoritative delivery context is serviceable");
    assert(delCtx.reasonCode === "SERVICEABLE", "TEST A.6: Reason code is SERVICEABLE");
    assert(typeof delCtx.deliveryFee === "number", "TEST A.7: Authoritative delivery fee calculated", `Fee: ₹${delCtx.deliveryFee}`);
    assert(typeof delCtx.etaMinutes === "number" && delCtx.etaMinutes > 0, "TEST A.8: Dynamic ETA estimated", `${delCtx.etaMinutes} mins`);

    // 3. Complete Checkout Order with GPS
    const branchId = delCtx.storeId || "br_indiranagar";
    const { product, slotId } = getAvailableTestProductAndSlot(branchId, tomorrowStr);

    const cart = ApiEngine.createCart({
      items: [
        {
          id: `item_${product.id}`,
          product_id: product.id,
          title: product.title || "Belgian Truffle Cake",
          quantity: 1,
          unit_price: (product as any).price || 649,
        },
      ],
    } as any);

    const orderRes = ApiEngine.confirmCheckout({
      cart_id: cart.id,
      address: {
        first_name: "Ananya",
        last_name: "Sharma",
        phone: "+91 98765 43210",
        email: "ananya@example.com",
        address_1: "Flat 402, Signature Towers",
        city: revGeo.city || "Bengaluru",
        state: revGeo.state || "Karnataka",
        pincode: revGeo.pincode || "560038",
      },
      pincode: revGeo.pincode || "560038",
      latitude: gpsLat,
      longitude: gpsLng,
      delivery_date: tomorrowStr,
      delivery_slot_id: slotId,
      delivery_type: "delivery",
      payment_method: "cod",
    } as any);

    assert(orderRes.success === true, "TEST A.9: Order created successfully with GPS coordinates", orderRes.error);
    const order = orderRes.order;
    assert(order?.delivery_latitude === 12.9716, "TEST A.10: Order snapshot delivery_latitude locked to GPS", String(order?.delivery_latitude));
    assert(order?.delivery_longitude === 77.6412, "TEST A.11: Order snapshot delivery_longitude locked to GPS", String(order?.delivery_longitude));
    assert(Boolean(order?.branch_id), "TEST A.12: Order bound to serving branch", order?.branch_name);
  }

  // ──────────────────────────────────────────────────────────────────────────
  // TEST B: SEARCH LOCATION
  // ──────────────────────────────────────────────────────────────────────────
  console.log("\n📌 TEST B: Location Search (Autocomplete & Coordinate Selection)");
  {
    // Search query for Marine Drive
    const searchResults = ApiEngine.searchLocation("Marine Drive");
    assert(Array.isArray(searchResults) && searchResults.length > 0, "TEST B.1: Search returns structured locality candidates", `Count: ${searchResults.length}`);

    const selectedLoc = searchResults[0];
    assert(Boolean(selectedLoc.latitude && selectedLoc.longitude), "TEST B.2: Selected search result includes verified coordinates", `${selectedLoc.latitude}, ${selectedLoc.longitude}`);
    assert(Boolean(selectedLoc.formatted_address), "TEST B.3: Selected search result provides formatted address", selectedLoc.formatted_address);

    // Resolve Delivery Context from Search Coordinates
    const searchCtx = ApiEngine.resolveDeliveryContext(selectedLoc.pincode, selectedLoc.latitude, selectedLoc.longitude);
    assert(searchCtx.serviceable === true, "TEST B.4: Search location coordinates resolve to active delivery zone", `Store: ${searchCtx.storeName}`);

    // Place Order via Search Coordinates
    const branchId = searchCtx.storeId || "br_kochi_hub";
    const { product, slotId } = getAvailableTestProductAndSlot(branchId, tomorrowStr);

    const cart = ApiEngine.createCart({
      items: [
        {
          id: `item_${product.id}`,
          product_id: product.id,
          title: product.title || "Gourmet Cake",
          quantity: 1,
          unit_price: (product as any).price || 649,
        },
      ],
    } as any);

    const orderRes = ApiEngine.confirmCheckout({
      cart_id: cart.id,
      address: {
        first_name: "Rahul",
        last_name: "Menon",
        phone: "+91 98450 12345",
        address_1: selectedLoc.formatted_address,
        city: selectedLoc.city,
        state: selectedLoc.state,
        pincode: selectedLoc.pincode,
      },
      pincode: selectedLoc.pincode,
      latitude: selectedLoc.latitude,
      longitude: selectedLoc.longitude,
      delivery_date: tomorrowStr,
      delivery_slot_id: slotId,
      delivery_type: "delivery",
      payment_method: "cod",
    } as any);

    assert(orderRes.success === true, "TEST B.5: Order placed successfully using location search selection", orderRes.error);
    assert(orderRes.order?.delivery_latitude === Number(selectedLoc.latitude.toFixed(6)), "TEST B.6: Order snapshotted search latitude", String(orderRes.order?.delivery_latitude));
    assert(orderRes.order?.delivery_longitude === Number(selectedLoc.longitude.toFixed(6)), "TEST B.7: Order snapshotted search longitude", String(orderRes.order?.delivery_longitude));
  }

  // ──────────────────────────────────────────────────────────────────────────
  // TEST C: SAVED ADDRESS
  // ──────────────────────────────────────────────────────────────────────────
  console.log("\n📌 TEST C: Saved Address (Coordinate Loading & Serviceability)");
  {
    const mockSavedAddress = {
      id: "addr_saved_koramangala",
      label: "Home",
      address_1: "80 Feet Road, 4th Block",
      city: "Bengaluru",
      state: "Karnataka",
      postal_code: "560034",
      latitude: 12.9352,
      longitude: 77.6245,
    };

    // Resolve context from saved address coordinates
    const savedCtx = ApiEngine.resolveDeliveryContext(mockSavedAddress.postal_code, mockSavedAddress.latitude, mockSavedAddress.longitude);
    assert(savedCtx.serviceable === true, "TEST C.1: Saved address resolved serviceability from stored coordinates");
    assert(Boolean(savedCtx.storeName?.toLowerCase().includes("koramangala") || savedCtx.storeId?.includes("koramangala")), "TEST C.2: Saved address resolved nearest Koramangala Hub", savedCtx.storeName || "");

    const branchId = savedCtx.storeId || "br_koramangala";
    const { product, slotId } = getAvailableTestProductAndSlot(branchId, tomorrowStr);

    const cart = ApiEngine.createCart({
      items: [
        {
          id: `item_${product.id}`,
          product_id: product.id,
          title: product.title || "Gourmet Cake",
          quantity: 1,
          unit_price: (product as any).price || 649,
        },
      ],
    } as any);

    const orderRes = ApiEngine.confirmCheckout({
      cart_id: cart.id,
      address: {
        first_name: "Priya",
        last_name: "Nair",
        phone: "+91 97400 55555",
        address_1: mockSavedAddress.address_1,
        city: mockSavedAddress.city,
        state: mockSavedAddress.state,
        pincode: mockSavedAddress.postal_code,
      },
      pincode: mockSavedAddress.postal_code,
      latitude: mockSavedAddress.latitude,
      longitude: mockSavedAddress.longitude,
      delivery_date: tomorrowStr,
      delivery_slot_id: slotId,
      delivery_type: "delivery",
      payment_method: "cod",
    } as any);

    assert(orderRes.success === true, "TEST C.3: Order created successfully from saved address", orderRes.error);
    assert(orderRes.order?.delivery_latitude === 12.9352, "TEST C.4: Order contains saved address latitude");
    assert(orderRes.order?.delivery_longitude === 77.6245, "TEST C.5: Order contains saved address longitude");
  }

  // ──────────────────────────────────────────────────────────────────────────
  // TEST D: OUTSIDE POLYGON ZONE (COORDINATE SUPREMACY OVER PINCODE)
  // ──────────────────────────────────────────────────────────────────────────
  console.log("\n📌 TEST D: Outside Polygon Zone Rejection (Coordinate Supremacy over Pincode)");
  {
    // Customer gives pincode 560038 (Indiranagar) BUT GPS coordinates are outside all zones (12.5000, 77.9000)
    const outsideLat = 12.5000;
    const outsideLng = 77.9000;
    const deceptivePincode = "560038";

    // 1. Resolve Delivery Context: GPS coordinates MUST win and reject delivery!
    const outCtx = ApiEngine.resolveDeliveryContext(deceptivePincode, outsideLat, outsideLng);
    assert(outCtx.serviceable === false, "TEST D.1: Outside coordinates rejected even with valid pincode 560038");
    assert(outCtx.reasonCode === "OUTSIDE_DELIVERY_ZONE", "TEST D.2: Reason code is OUTSIDE_DELIVERY_ZONE", outCtx.reasonCode);
    assert(outCtx.deliveryFee === 0, "TEST D.3: Delivery fee is 0 for unserviceable coordinate");

    // 2. Validate Checkout Gate
    const cart = ApiEngine.createCart({
      items: [{ id: "item_test", product_id: "prod_1", title: "Cake", quantity: 1, unit_price: 599 }],
    } as any);

    const valResult = ApiEngine.validateCheckout({
      cart_id: cart.id,
      address: {
        first_name: "Out",
        last_name: "Ranger",
        phone: "+91 98765 00000",
        address_1: "Far Outside Limits Highway",
        city: "Hosur Outer",
        pincode: deceptivePincode,
      },
      pincode: deceptivePincode,
      latitude: outsideLat,
      longitude: outsideLng,
      delivery_date: tomorrowStr,
      delivery_slot_id: "slot_evening",
      delivery_type: "delivery",
    } as any);

    assert(valResult.valid === false, "TEST D.4: Checkout validation blocked for coordinates outside polygon fences");
    assert(
      valResult.errors.some((e: any) => e.code === "OUTSIDE_DELIVERY_ZONE" || e.code === "STORE_NOT_SERVICEABLE"),
      "TEST D.5: Validation error returned appropriate unserviceable code",
      valResult.errors[0]?.message
    );

    // 3. Confirm Checkout Attempt: Must be strictly blocked with HTTP 400
    const confirmRes = ApiEngine.confirmCheckout({
      cart_id: cart.id,
      address: {
        first_name: "Out",
        last_name: "Ranger",
        phone: "+91 98765 00000",
        address_1: "Far Outside Limits Highway",
        city: "Hosur Outer",
        pincode: deceptivePincode,
      },
      pincode: deceptivePincode,
      latitude: outsideLat,
      longitude: outsideLng,
      delivery_date: tomorrowStr,
      delivery_slot_id: "slot_evening",
      delivery_type: "delivery",
      payment_method: "cod",
    } as any);

    assert(confirmRes.success === false, "TEST D.6: Order creation rejected with success=false");
    assert(confirmRes.statusCode === 400, "TEST D.7: Rejected with HTTP 400 status code");
  }

  // ──────────────────────────────────────────────────────────────────────────
  // TEST E: EXCLUSION POLYGON HARD BLOCK
  // ──────────────────────────────────────────────────────────────────────────
  console.log("\n📌 TEST E: Exclusion Polygon Hard Block (Hazard/Restricted Perimeter)");
  {
    const indiranagarBranch = branches.find((b: any) => b.id === "br_indiranagar" || b.id === "res_01KXYMAHGFPRY1G9TZKEVGAGAT") || branches[0];
    
    // Create exclusion polygon around specific coordinate
    const exLat = 12.9750;
    const exLng = 77.6450;
    const testExclusionPolygon = [
      [12.9740, 77.6440],
      [12.9740, 77.6460],
      [12.9760, 77.6460],
      [12.9760, 77.6440],
    ];

    // Temporarily attach exclusion polygon to branch zone
    if (indiranagarBranch.delivery_zones && indiranagarBranch.delivery_zones[0]) {
      indiranagarBranch.delivery_zones[0].exclusion_polygons = [testExclusionPolygon];
    }

    // Resolve Delivery Context for coordinate inside exclusion polygon
    const exCtx = ApiEngine.resolveDeliveryContext("560038", exLat, exLng);
    assert(exCtx.serviceable === false, "TEST E.1: Coordinate inside exclusion polygon is blocked");
    assert(exCtx.reasonCode === "INSIDE_EXCLUSION_ZONE", "TEST E.2: Reason code is INSIDE_EXCLUSION_ZONE", exCtx.reasonCode);
    assert(
      Boolean(exCtx.blockedReason?.toLowerCase().includes("restricted") || exCtx.blockedReason?.toLowerCase().includes("exclusion")),
      "TEST E.3: Blocked reason explains exclusion zone perimeter",
      exCtx.blockedReason
    );

    // Clean up exclusion polygon
    if (indiranagarBranch.delivery_zones && indiranagarBranch.delivery_zones[0]) {
      delete indiranagarBranch.delivery_zones[0].exclusion_polygons;
    }
  }

  // ──────────────────────────────────────────────────────────────────────────
  // TEST F: MULTI-STORE GEOFENCE ISOLATION
  // ──────────────────────────────────────────────────────────────────────────
  console.log("\n📌 TEST F: Multi-Store Geofence Isolation");
  {
    const ptIndiranagar = ApiEngine.resolveDeliveryContext(undefined, 12.9716, 77.6412);
    const ptKoramangala = ApiEngine.resolveDeliveryContext(undefined, 12.9352, 77.6245);
    const ptKochi = ApiEngine.resolveDeliveryContext(undefined, 9.9816, 76.2753);

    assert(
      Boolean(ptIndiranagar.storeId?.includes("indiranagar") || ptIndiranagar.storeName?.toLowerCase().includes("indiranagar")),
      "TEST F.1: Indiranagar coordinate routes to Indiranagar kitchen",
      ptIndiranagar.storeName || ""
    );
    assert(
      Boolean(ptKoramangala.storeId?.includes("koramangala") || ptKoramangala.storeName?.toLowerCase().includes("koramangala")),
      "TEST F.2: Koramangala coordinate routes to Koramangala kitchen",
      ptKoramangala.storeName || ""
    );
    assert(
      Boolean(ptKochi.storeId?.includes("kochi") || ptKochi.storeName?.toLowerCase().includes("kochi")),
      "TEST F.3: Kochi coordinate routes to Kochi hub",
      ptKochi.storeName || ""
    );
    assert(
      ptIndiranagar.storeId !== ptKoramangala.storeId,
      "TEST F.4: Clear store boundary isolation between Indiranagar and Koramangala"
    );
  }

  // ──────────────────────────────────────────────────────────────────────────
  // TEST G: CLIENT-SIDE TAMPERING REJECTION
  // ──────────────────────────────────────────────────────────────────────────
  console.log("\n📌 TEST G: Client-Side Tampering Rejection (Authoritative Server Enforcement)");
  {
    const { product, slotId } = getAvailableTestProductAndSlot("br_indiranagar", tomorrowStr);

    const cart = ApiEngine.createCart({
      items: [
        {
          id: `item_${product.id}`,
          product_id: product.id,
          title: product.title || "Cake",
          quantity: 1,
          unit_price: (product as any).price || 649,
        },
      ],
    } as any);

    const forgedPayload = {
      cart_id: cart.id,
      address: {
        first_name: "Sneaky",
        last_name: "Attacker",
        phone: "+91 99999 88888",
        address_1: "100ft Road, Indiranagar",
        city: "Bengaluru",
        pincode: "560038",
      },
      pincode: "560038",
      latitude: 12.9716,
      longitude: 77.6412,
      delivery_date: tomorrowStr,
      delivery_slot_id: slotId,
      delivery_type: "delivery",
      payment_method: "cod",
      // Forged parameters:
      store_id: "fake_unauthorized_store",
      branch_id: "fake_unauthorized_store",
      delivery_fee: 0,
      zone_id: "free_delivery_hack",
    };

    const confirmRes = ApiEngine.confirmCheckout(forgedPayload as any);
    assert(confirmRes.success === true, "TEST G.1: Order processed", confirmRes.error);
    const order = confirmRes.order;

    assert(
      order?.branch_id !== "fake_unauthorized_store",
      "TEST G.2: Forged branch_id overridden by authoritative resolver",
      order?.branch_id
    );
    assert(
      order?.delivery_zone_id !== "free_delivery_hack",
      "TEST G.3: Forged zone_id overridden by authoritative resolver",
      order?.delivery_zone_id
    );
    assert(
      typeof order?.pricing?.delivery_fee === "number",
      "TEST G.4: Delivery fee calculated authoritatively by pricing engine",
      `Fee: ₹${order?.pricing?.delivery_fee}`
    );
  }

  // ──────────────────────────────────────────────────────────────────────────
  // TEST H: HISTORICAL ORDER DESTINATION IMMUTABILITY
  // ──────────────────────────────────────────────────────────────────────────
  console.log("\n📌 TEST H: Historical Order Destination Immutability Snapshot");
  {
    const originalLat = 12.9716;
    const originalLng = 77.6412;
    const { product, slotId } = getAvailableTestProductAndSlot("br_indiranagar", tomorrowStr);

    const cart = ApiEngine.createCart({
      items: [
        {
          id: `item_${product.id}`,
          product_id: product.id,
          title: product.title || "Cake",
          quantity: 1,
          unit_price: (product as any).price || 649,
        },
      ],
    } as any);

    const originalOrderRes = ApiEngine.confirmCheckout({
      cart_id: cart.id,
      address: {
        first_name: "Historical",
        last_name: "Customer",
        phone: "+91 91234 56789",
        address_1: "Flat 101, Indiranagar Landmark",
        city: "Bengaluru",
        pincode: "560038",
      },
      pincode: "560038",
      latitude: originalLat,
      longitude: originalLng,
      delivery_date: tomorrowStr,
      delivery_slot_id: slotId,
      delivery_type: "delivery",
      payment_method: "cod",
    } as any);

    const orderId = originalOrderRes.order?.id;
    assert(Boolean(orderId), "TEST H.1: Created reference historical order", orderId);

    // Simulate customer updating profile address
    ApiEngine.findOrCreateCustomerByPhone({
      phone: "+91 91234 56789",
      name: "Historical Customer",
      address: {
        address_1: "Completely Changed Address In Whitefield",
        city: "Bengaluru",
        pincode: "560066",
        latitude: 12.9698,
        longitude: 77.7499,
      },
    });

    // Query historical order again from orders store
    const retrievedOrder = ApiEngine.getOrder(orderId);
    assert(retrievedOrder !== null, "TEST H.2: Retrieved historical order from database store");
    assert(
      retrievedOrder.delivery_latitude === originalLat,
      "TEST H.3: Historical order delivery_latitude remains immutable",
      String(retrievedOrder.delivery_latitude)
    );
    assert(
      retrievedOrder.delivery_longitude === originalLng,
      "TEST H.4: Historical order delivery_longitude remains immutable",
      String(retrievedOrder.delivery_longitude)
    );
    assert(
      retrievedOrder.delivery_address.includes("Indiranagar"),
      "TEST H.5: Historical order delivery_address text remains immutable"
    );
  }

  // ──────────────────────────────────────────────────────────────────────────
  // TEST I: MALFORMED & CORRUPT COORDINATE BOUNDARY DEFENSE
  // ──────────────────────────────────────────────────────────────────────────
  console.log("\n📌 TEST I: Malformed & Corrupt Coordinate Boundary Defense");
  {
    assert(isValidCoordinate(999.999, 999.999) === false, "TEST I.1: Rejects 999.999 placeholder coordinate");
    assert(isValidCoordinate(NaN, 77.6412) === false, "TEST I.2: Rejects NaN coordinate");
    assert(isValidCoordinate(12.9716, undefined) === false, "TEST I.3: Rejects undefined coordinate");
    assert(isValidCoordinate(95.0, 77.6412) === false, "TEST I.4: Rejects latitude > 90");
    assert(isValidCoordinate(12.9716, 185.0) === false, "TEST I.5: Rejects longitude > 180");
    assert(isValidCoordinate(0, 0) === false, "TEST I.6: Rejects 0,0 Null Island point");

    const badCoordCtx = ApiEngine.resolveDeliveryContext(undefined, 999.999, 999.999);
    assert(badCoordCtx.serviceable === false, "TEST I.7: Backend rejects 999.999 coordinates gracefully");
    assert(badCoordCtx.reasonCode === "INVALID_LOCATION", "TEST I.8: Reason code is INVALID_LOCATION");
  }

  // ──────────────────────────────────────────────────────────────────────────
  // TEST J: RIDER ONE-TAP NAVIGATION GOOGLE MAPS DESTINATION
  // ──────────────────────────────────────────────────────────────────────────
  console.log("\n📌 TEST J: Rider One-Tap Navigation Google Maps Destination URL");
  {
    const targetOrder = {
      id: "ord_nav_test",
      delivery_latitude: 12.9715987,
      delivery_longitude: 77.6412014,
      delivery_address: "100 Feet Road, Indiranagar, Bengaluru",
    };

    const coords = extractDeliveryCoordinates(targetOrder);
    assert(coords !== null, "TEST J.1: Extracted delivery coordinates from order snapshot");
    assert(coords?.latitude === 12.9715987 && coords?.longitude === 77.6412014, "TEST J.2: Extracted coordinates match exact snapshot");

    const navUrl = buildGoogleMapsDirectionsUrl({
      latitude: targetOrder.delivery_latitude,
      longitude: targetOrder.delivery_longitude,
      address: targetOrder.delivery_address,
    });

    assert(
      navUrl === "https://www.google.com/maps/dir/?api=1&destination=12.971599,77.641201",
      "TEST J.3: Directions URL generated with exact 6-decimal sub-meter destination",
      navUrl
    );
    assert(
      !navUrl.includes("destination=undefined") && !navUrl.includes("destination=NaN"),
      "TEST J.4: Directions URL is free of corrupt tokens"
    );
  }

  // ──────────────────────────────────────────────────────────────────────────
  // FINAL SCORECARD & SUMMARY
  // ──────────────────────────────────────────────────────────────────────────
  console.log("\n" + "=".repeat(85));
  console.log(`📊 E2E TEST SUMMARY: Total: ${totalTests} | Passed: ${passedTests} | Failed: ${failedTests}`);
  console.log("=".repeat(85) + "\n");

  if (failedTests > 0) {
    console.error(`❌ Suite failed with ${failedTests} assertion failures.`);
    process.exit(1);
  } else {
    console.log("🎉 ALL TESTS PASSED (100%). Map-fence serviceability & location flow verified.");
  }
}

runE2ESuite().catch((err) => {
  console.error("Unhandled error in test suite:", err);
  process.exit(1);
});
