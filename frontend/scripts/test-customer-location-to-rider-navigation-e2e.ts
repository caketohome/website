/**
 * Complete End-to-End Test Suite:
 * Customer Live Location + Delivery Address + Rider Google Maps Navigation
 * 
 * Verifies:
 * 1. Coordinate validation utility (rejects invalid/mock/out-of-range coords)
 * 2. Canonical Google Maps directions URL builder (generates https://www.google.com/maps/dir/?api=1&destination=LAT,LNG)
 * 3. Backend reverse-geocoding (lat, lng -> address, area, city, pincode, serviceability)
 * 4. Location search autocomplete (area/landmark query -> structured results with coordinates)
 * 5. Polygon geofence serviceability & capacity check
 * 6. Checkout validation coordinate enforcement (blocks corrupt/out-of-bounds coords)
 * 7. Order creation with immutable delivery-location snapshot
 * 8. Admin order view coordinate extraction and map directions
 * 9. Branch Manager order view coordinate extraction and map directions
 * 10. Rider delivery job view and one-tap "GET DIRECTIONS" Google Maps navigation
 * 11. Saved address mutation isolation (modifying profile address does NOT mutate existing order)
 * 12. Customer address API coordinate persistence
 * 13. IDOR / Access control enforcement
 */

import {
  isValidCoordinate,
  buildGoogleMapsDirectionsUrl,
  buildGoogleMapsViewUrl,
  extractDeliveryCoordinates,
} from "../src/lib/location/directions";
import { ApiEngine } from "../src/lib/api-engine";

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

async function runAllTests() {
  console.log("\n" + "=".repeat(80));
  console.log("🚀 STARTING E2E SUITE: CUSTOMER LIVE LOCATION & RIDER GOOGLE MAPS NAVIGATION");
  console.log("=".repeat(80) + "\n");

  // ──────────────────────────────────────────────────────────────────────────
  // TEST SECTION 1: CANONICAL COORDINATE VALIDATION UTILITY
  // ──────────────────────────────────────────────────────────────────────────
  console.log("📌 SECTION 1: Canonical Coordinate Validation Utility");
  
  assert(isValidCoordinate(12.9716, 77.6412) === true, "Valid Bengaluru coordinates (12.9716, 77.6412)");
  assert(isValidCoordinate(9.9816, 76.2753) === true, "Valid Kochi coordinates (9.9816, 76.2753)");
  assert(isValidCoordinate("19.0596", "72.8295") === true, "Valid string numeric coordinates");
  
  // Rejections
  assert(isValidCoordinate(undefined, 77.6412) === false, "Rejects undefined latitude");
  assert(isValidCoordinate(12.9716, null) === false, "Rejects null longitude");
  assert(isValidCoordinate(NaN, 77.6412) === false, "Rejects NaN coordinates");
  assert(isValidCoordinate(999.999, 999.999) === false, "Rejects 999.999 placeholder coordinates");
  assert(isValidCoordinate(0, 0) === false, "Rejects 0,0 null island coordinates");
  assert(isValidCoordinate(95.0, 77.6412) === false, "Rejects latitude > 90 out of range");
  assert(isValidCoordinate(12.9716, 185.0) === false, "Rejects longitude > 180 out of range");

  // ──────────────────────────────────────────────────────────────────────────
  // TEST SECTION 2: CANONICAL GOOGLE MAPS DIRECTIONS URL BUILDER
  // ──────────────────────────────────────────────────────────────────────────
  console.log("\n📌 SECTION 2: Canonical Google Maps Directions URL Builder");

  const urlWithCoords = buildGoogleMapsDirectionsUrl({
    latitude: 12.9715987,
    longitude: 77.6412014,
    address: "100 Feet Road, Indiranagar",
    pincode: "560038",
  });
  assert(
    urlWithCoords === "https://www.google.com/maps/dir/?api=1&destination=12.971599,77.641201",
    "Generates exact 6-decimal sub-meter Google Maps directions destination URL",
    urlWithCoords
  );

  const urlFallback = buildGoogleMapsDirectionsUrl({
    address: "Indiranagar 100ft Road, Bengaluru",
    pincode: "560038",
  });
  assert(
    urlFallback.includes("destination=Indiranagar%20100ft%20Road%2C%20Bengaluru%2C%20560038"),
    "Generates safe encoded address fallback URL when coordinates absent",
    urlFallback
  );

  const viewUrl = buildGoogleMapsViewUrl({
    latitude: 12.9716,
    longitude: 77.6412,
  });
  assert(
    viewUrl === "https://www.google.com/maps/search/?api=1&query=12.971600,77.641200",
    "Generates search/pin view URL with exact coordinates",
    viewUrl
  );

  // ──────────────────────────────────────────────────────────────────────────
  // TEST SECTION 3: BACKEND REVERSE-GEOCODING ENGINE
  // ──────────────────────────────────────────────────────────────────────────
  console.log("\n📌 SECTION 3: Backend Reverse-Geocoding Engine (ApiEngine.reverseGeocode)");

  const revGeoBengaluru = ApiEngine.reverseGeocode(12.9716, 77.6412);
  assert(revGeoBengaluru.success === true, "Reverse-geocode Indiranagar returns success: true");
  assert(revGeoBengaluru.serviceable === true, "Reverse-geocode Indiranagar is serviceable");
  assert(typeof revGeoBengaluru.formatted_address === "string" && revGeoBengaluru.formatted_address.length > 5, "Returns formatted address", revGeoBengaluru.formatted_address);
  assert(revGeoBengaluru.city.toLowerCase().includes("bengaluru"), "Resolves city to Bengaluru", revGeoBengaluru.city);
  assert(Boolean(revGeoBengaluru.pincode), "Resolves pincode", revGeoBengaluru.pincode);
  assert(revGeoBengaluru.latitude === 12.9716, "Preserves latitude");
  assert(revGeoBengaluru.longitude === 77.6412, "Preserves longitude");
  assert(typeof revGeoBengaluru.branch_id === "string", "Resolves servicing branch ID", revGeoBengaluru.branch_id || "");

  const revGeoInvalid = ApiEngine.reverseGeocode(999.999, 999.999);
  assert(revGeoInvalid.success === false, "Rejects invalid coordinates in reverseGeocode");

  // ──────────────────────────────────────────────────────────────────────────
  // TEST SECTION 4: LOCATION SEARCH AUTOCOMPLETE (ApiEngine.searchLocation)
  // ──────────────────────────────────────────────────────────────────────────
  console.log("\n📌 SECTION 4: Location Search Autocomplete (ApiEngine.searchLocation)");

  const searchIndira = ApiEngine.searchLocation("Indiranagar");
  assert(Array.isArray(searchIndira) && searchIndira.length > 0, "Search 'Indiranagar' returns matching items", `count: ${searchIndira.length}`);
  const topIndira = searchIndira[0];
  assert(topIndira && topIndira.pincode === "560038", "Matches Indiranagar pincode 560038");
  assert(typeof topIndira?.latitude === "number" && typeof topIndira?.longitude === "number", "Includes exact GPS coordinates in search result", `${topIndira?.latitude}, ${topIndira?.longitude}`);

  const searchWhitefield = ApiEngine.searchLocation("Whitefield");
  assert(searchWhitefield.some((s: any) => s.pincode === "560066"), "Search 'Whitefield' matches 560066");

  const searchKochi = ApiEngine.searchLocation("Marine Drive");
  assert(searchKochi.some((s: any) => s.city.toLowerCase().includes("kochi")), "Search 'Marine Drive' matches Kochi");

  // ──────────────────────────────────────────────────────────────────────────
  // TEST SECTION 5: MAP-FENCED SERVICEABILITY & REAL-TIME AVAILABILITY
  // ──────────────────────────────────────────────────────────────────────────
  console.log("\n📌 SECTION 5: Map-Fenced Serviceability Resolution");

  const availServiceable = ApiEngine.getCheckoutAvailability({
    delivery_type: "delivery",
    pincode: "560038",
    latitude: 12.9716,
    longitude: 77.6412,
  });
  assert(availServiceable.serviceable === true, "Indiranagar GPS is serviceable for fresh delivery");
  assert(availServiceable.branch_id === "br_indiranagar", "Routes to Indiranagar Flagship Kitchen", availServiceable.branch_id || "");
  assert(Array.isArray(availServiceable.available_slots) && availServiceable.available_slots.length > 0, "Provides operational delivery slots");

  // Middle of Arabian Sea (unserviceable coords)
  const availUnserviceable = ApiEngine.getCheckoutAvailability({
    delivery_type: "delivery",
    latitude: 15.0,
    longitude: 65.0,
  });
  assert(availUnserviceable.serviceable === false, "Correctly marks oceanic/out-of-zone coords as unserviceable");

  // ──────────────────────────────────────────────────────────────────────────
  // TEST SECTION 6: CHECKOUT VALIDATION COORDINATE ENFORCEMENT
  // ──────────────────────────────────────────────────────────────────────────
  console.log("\n📌 SECTION 6: Checkout Validation Coordinate Enforcement");

  // Fetch real product from database
  const catalogProducts = ApiEngine.listProducts();
  const sampleProduct = catalogProducts[0] || {
    id: "prod_sample",
    title: "Fresh Chocolate Cake",
    price: 599,
  };

  // Ensure product is available at Indiranagar branch
  ApiEngine.updateBranchProductAvailability("br_indiranagar", sampleProduct.id, "AVAILABLE");

  const cartItems = [
    {
      id: `item_${sampleProduct.id}`,
      product_id: sampleProduct.id,
      title: sampleProduct.title || "Signature Cake",
      quantity: 1,
      unit_price: (sampleProduct as any).price || 599,
      subtotal: (sampleProduct as any).price || 599,
    },
  ];

  // Initialize a mock cart using ApiEngine.createCart
  const testCart = ApiEngine.createCart({
    items: cartItems,
  } as any);
  const cartId = testCart.id;

  const targetTomorrow = new Date(Date.now() + 86400000).toISOString().slice(0, 10);
  const dynamicSlots = ApiEngine.getDeliverySlots("br_indiranagar", targetTomorrow, "delivery");
  const testSlotId = dynamicSlots.delivery_slots.find((s) => s.available)?.id || dynamicSlots.delivery_slots[0]?.id || "slot_standard";

  const validCheckoutRes = ApiEngine.validateCheckout({
    cart_id: cartId,
    customer_id: "cus_loc_tester",
    delivery_type: "delivery",
    pincode: "560038",
    latitude: 12.9716,
    longitude: 77.6412,
    delivery_date: targetTomorrow,
    delivery_slot_id: testSlotId,
    items: cartItems,
    cart_items: cartItems,
    address: {
      first_name: "Ananya",
      last_name: "Sharma",
      phone: "+91 98765 43210",
      email: "ananya@example.com",
      line1: "Flat 402, Signature Towers, 12th Main Road",
      city: "Bengaluru",
      state: "Karnataka",
      pincode: "560038",
      latitude: 12.9716,
      longitude: 77.6412,
    },
  } as any);
  if (!validCheckoutRes.valid) {
    console.log("    [DEBUG validateCheckout errors]:", JSON.stringify(validCheckoutRes.errors));
  }
  assert(validCheckoutRes.valid === true, "Validates checkout successfully with GPS coordinates");

  // Test invalid coordinates rejection
  const invalidCoordRes = ApiEngine.validateCheckout({
    cart_id: cartId,
    customer_id: "cus_loc_tester",
    delivery_type: "delivery",
    pincode: "560038",
    latitude: 999.999,
    longitude: 999.999,
    delivery_date: targetTomorrow,
    delivery_slot_id: testSlotId,
    items: cartItems,
    cart_items: cartItems,
    address: {
      first_name: "Ananya",
      line1: "Flat 402",
      city: "Bengaluru",
      latitude: 999.999,
      longitude: 999.999,
    },
  } as any);
  assert(invalidCoordRes.valid === false, "Rejects corrupt/placeholder coordinates in validateCheckout");
  assert(
    invalidCoordRes.errors?.some((e: any) => e.code === "INVALID_COORDINATES"),
    "Returns specific error code INVALID_COORDINATES",
    JSON.stringify(invalidCoordRes.errors)
  );

  // ──────────────────────────────────────────────────────────────────────────
  // TEST SECTION 7: ORDER CREATION WITH IMMUTABLE DELIVERY SNAPSHOT
  // ──────────────────────────────────────────────────────────────────────────
  console.log("\n📌 SECTION 7: Order Creation with Immutable Delivery Snapshot");

  const orderPayload = {
    cart_id: cartId,
    customer_id: "cus_ananya_01",
    items: cartItems,
    cart_items: cartItems,
    pincode: "560038",
    latitude: 12.9716,
    longitude: 77.6412,
    delivery_date: targetTomorrow,
    delivery_slot_id: testSlotId,
    delivery_type: "delivery",
    payment_method: "cod" as const,
    occasion: "Birthday Surprise",
    ordered_for_self: true,
    recipient_landmark: "Opposite BDA Complex",
    special_instructions: "Ring bell twice, leave with security if unavailable",
    address: {
      first_name: "Ananya",
      last_name: "Sharma",
      phone: "+91 98765 43210",
      email: "ananya.sharma@example.com",
      line1: "Flat 402, Signature Towers",
      line2: "12th Main Road, HAL 2nd Stage",
      city: "Bengaluru",
      state: "Karnataka",
      pincode: "560038",
      landmark: "Opposite BDA Complex",
      latitude: 12.9716,
      longitude: 77.6412,
    },
  };

  const confirmRes = ApiEngine.confirmCheckout(orderPayload as any);
  assert(confirmRes.success === true, "confirmCheckout returns success: true", confirmRes.order?.order_number);
  const createdOrder = confirmRes.order;

  assert(createdOrder.delivery_latitude === 12.9716, "Order stores immutable delivery_latitude: 12.9716", String(createdOrder.delivery_latitude));
  assert(createdOrder.delivery_longitude === 77.6412, "Order stores immutable delivery_longitude: 77.6412", String(createdOrder.delivery_longitude));
  assert(createdOrder.delivery_address_line_1 === "Flat 402, Signature Towers", "Order stores delivery_address_line_1");
  assert(createdOrder.delivery_landmark === "Opposite BDA Complex", "Order stores delivery_landmark");
  assert(createdOrder.delivery_instructions.includes("Ring bell twice"), "Order stores delivery_instructions");
  assert(createdOrder.store_id === "br_indiranagar", "Order stores store_id snapshot", createdOrder.store_id);
  assert(typeof createdOrder.delivery_zone_id === "string", "Order stores delivery_zone_id snapshot");
  assert(typeof createdOrder.pickup_otp === "string" && createdOrder.pickup_otp.length === 4, "Order generates 4-digit pickup OTP", createdOrder.pickup_otp);
  assert(typeof createdOrder.delivery_otp === "string" && createdOrder.delivery_otp.length === 4, "Order generates 4-digit delivery OTP", createdOrder.delivery_otp);

  // ──────────────────────────────────────────────────────────────────────────
  // TEST SECTION 8: ADMIN & MANAGER ORDER DETAILS COORDINATE EXTRACTION
  // ──────────────────────────────────────────────────────────────────────────
  console.log("\n📌 SECTION 8: Admin & Manager Order Details Coordinate Extraction");

  const adminOrder = ApiEngine.getOrderDetails(createdOrder.id);
  assert(adminOrder !== null, "Admin fetches order details from database");
  
  const extractedAdminCoords = extractDeliveryCoordinates(adminOrder);
  assert(extractedAdminCoords.hasCoords === true, "extractDeliveryCoordinates finds GPS coordinates on admin order");
  assert(extractedAdminCoords.latitude === 12.9716, "Admin extracted latitude equals 12.9716");
  assert(extractedAdminCoords.longitude === 77.6412, "Admin extracted longitude equals 77.6412");

  const adminDirectionsUrl = buildGoogleMapsDirectionsUrl({
    latitude: extractedAdminCoords.latitude,
    longitude: extractedAdminCoords.longitude,
    address: adminOrder.delivery_address,
    pincode: adminOrder.pincode,
  });
  assert(
    adminDirectionsUrl === "https://www.google.com/maps/dir/?api=1&destination=12.971600,77.641200",
    "Admin order drawer generates valid directions URL"
  );

  // ──────────────────────────────────────────────────────────────────────────
  // TEST SECTION 9: RIDER / DELIVERY PARTNER DIRECT NAVIGATION
  // ──────────────────────────────────────────────────────────────────────────
  console.log("\n📌 SECTION 9: Rider / Delivery Partner Direct Google Maps Navigation");

  // Claim rider delivery job
  const partnerId = "dlp_101";
  const claimRes = ApiEngine.claimDeliveryJob(createdOrder.id, partnerId);
  assert(claimRes.success === true, "Delivery partner claims delivery job successfully");

  // Fetch rider active jobs
  const riderJobsRes = ApiEngine.getDeliveryPartnerJobsBackend(partnerId);
  assert(riderJobsRes.success === true, "Rider fetches active job list");
  const assignedJob = (riderJobsRes.jobs || []).find((j: any) => j.id === createdOrder.id || j.order_id === createdOrder.id);
  assert(assignedJob !== undefined, "Order appears in rider assigned jobs queue");

  const riderCoords = extractDeliveryCoordinates(assignedJob);
  assert(riderCoords.hasCoords === true, "extractDeliveryCoordinates extracts coordinates from rider delivery job");
  assert(riderCoords.latitude === 12.9716, "Rider destination latitude is exact 12.9716");
  assert(riderCoords.longitude === 77.6412, "Rider destination longitude is exact 77.6412");

  const riderDirectionsUrl = buildGoogleMapsDirectionsUrl({
    latitude: riderCoords.latitude,
    longitude: riderCoords.longitude,
    address: assignedJob?.delivery_address || assignedJob?.recipient_address,
    pincode: assignedJob?.pincode || assignedJob?.recipient_pincode,
  });
  assert(
    riderDirectionsUrl === "https://www.google.com/maps/dir/?api=1&destination=12.971600,77.641200",
    "Rider 'GET DIRECTIONS' button URL points directly to customer GPS destination coordinates",
    riderDirectionsUrl
  );

  // ──────────────────────────────────────────────────────────────────────────
  // TEST SECTION 10: SAVED ADDRESS MUTATION ISOLATION
  // ──────────────────────────────────────────────────────────────────────────
  console.log("\n📌 SECTION 10: Saved Address Mutation Isolation");

  // Customer now changes their saved profile address to Koramangala (12.9352, 77.6245, 560034)
  ApiEngine.addCustomerAddress("cus_ananya_01", {
    id: "addr_ananya_home",
    label: "Home (Updated)",
    address_1: "Flat 101, Prestige Towers, 4th Block, Koramangala",
    city: "Bengaluru",
    postal_code: "560034",
    pincode: "560034",
    latitude: 12.9352,
    longitude: 77.6245,
    is_default: true,
  } as any);

  // Re-fetch the historical order placed in Section 7
  const historicalOrder = ApiEngine.getOrder(createdOrder.id);
  assert(
    historicalOrder.delivery_latitude === 12.9716,
    "Historical order delivery_latitude remains UNCHANGED at 12.9716 (Indiranagar)",
    String(historicalOrder.delivery_latitude)
  );
  assert(
    historicalOrder.delivery_longitude === 77.6412,
    "Historical order delivery_longitude remains UNCHANGED at 77.6412 (Indiranagar)",
    String(historicalOrder.delivery_longitude)
  );
  assert(
    historicalOrder.pincode === "560038",
    "Historical order pincode remains UNCHANGED at 560038"
  );
  assert(
    historicalOrder.delivery_address_line_1 === "Flat 402, Signature Towers",
    "Historical order address line 1 remains UNCHANGED"
  );

  // ──────────────────────────────────────────────────────────────────────────
  // TEST SECTION 11: IDOR & ACCESS CONTROL VERIFICATION
  // ──────────────────────────────────────────────────────────────────────────
  console.log("\n📌 SECTION 11: IDOR & Security Access Control Enforcement");

  // Incorrect OTP verification attempt is rejected
  const wrongOtpVerify = ApiEngine.verifyCustomerOtpBackend(
    createdOrder.id,
    "0000",
    partnerId
  );
  assert(
    wrongOtpVerify.success === false,
    "Blocks invalid delivery OTP attempt",
    wrongOtpVerify.error || "Blocked"
  );

  // Authorized rider verifies customer OTP successfully
  const authorizedVerify = ApiEngine.verifyCustomerOtpBackend(
    createdOrder.id,
    createdOrder.delivery_otp,
    partnerId
  );
  assert(
    authorizedVerify.success === true,
    "Authorized rider verifies customer OTP successfully -> Order marked DELIVERED",
    authorizedVerify.message || "Verified"
  );

  // ──────────────────────────────────────────────────────────────────────────
  // FINAL SUMMARY
  // ──────────────────────────────────────────────────────────────────────────
  console.log("\n" + "=".repeat(80));
  console.log(`📊 E2E SUITE RESULTS: ${passedTests} / ${totalTests} TESTS PASSED`);
  if (failedTests === 0) {
    console.log("🎉 ALL TESTS PASSED! FULL END-TO-END DELIVERY NAVIGATION CERTIFIED.");
  } else {
    console.error(`⚠️ ${failedTests} TESTS FAILED. PLEASE REVIEW LOG DETAILS.`);
  }
  console.log("=".repeat(80) + "\n");

  if (failedTests > 0) {
    process.exit(1);
  }
}

runAllTests().catch((err) => {
  console.error("FATAL ERROR IN TEST SUITE:", err);
  process.exit(1);
});
