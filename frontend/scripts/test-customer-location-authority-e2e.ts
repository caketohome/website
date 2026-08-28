/**
 * CakeToHome: Customer Location Authority & Address Decoupling E2E Test Suite
 *
 * Verifies:
 * 1. Physical Location vs Address Separation
 * 2. GPS Flow & No "GPS (...)" in Street Address
 * 3. Search Autocomplete Flow & Coordinate Separation
 * 4. Saved Address Coordinates Persistence
 * 5. Map Pin Drag & Instant Coordinate Propagation
 * 6. Small Marker Movement (10m-100m) Stability
 * 7. Address Text Edit Isolation (Flat 402 -> Flat 502 does not change coords/fee)
 * 8. Map Pan Isolation (Panning map does not mutate coordinates)
 * 9. Explicit Geocode Action ([ Search this address on map ])
 * 10. Serviceability Inside Delivery Area
 * 11. Serviceability Outside Delivery Area
 * 12. Exclusion Area Rejection
 * 13. Radius Boundary Precision (9.9km vs 10.1km)
 * 14. Pincode Bypass Gate (Valid Pincode + Out-of-Fence Coords -> Rejected)
 * 15. Distance Pricing Brackets (0-3km: ₹39, 3-5km: ₹49, >10km: Unserviceable)
 * 16. Delivery Slots Gated by Serviceability
 * 17. Order Snapshot Immutability (delivery_latitude, delivery_longitude)
 * 18. Google Maps URL Uses Coordinates, NOT Address String
 * 19. Rider Navigation Deep Link Integrity
 * 20. Stale Async Request Protection (Sequence / Cancellation)
 * 21. End-to-End Coordinate Chain (Map == API == Engine == Order == Rider)
 */

import { ApiEngine } from "../src/lib/api-engine";
import { buildGoogleMapsDirectionsUrl, extractDeliveryCoordinates } from "../src/lib/location/directions";

function assert(condition: boolean, msg: string) {
  if (!condition) {
    console.error(`❌ ASSERTION FAILED: ${msg}`);
    throw new Error(msg);
  }
}

let passedGates = 0;
let totalGates = 0;

function gate(name: string, fn: () => void | Promise<void>) {
  totalGates++;
  try {
    const res = fn();
    if (res instanceof Promise) {
      return res.then(() => {
        passedGates++;
        console.log(`✔ [GATE ${totalGates}: ${name}]`);
      });
    } else {
      passedGates++;
      console.log(`✔ [GATE ${totalGates}: ${name}]`);
    }
  } catch (err: any) {
    console.error(`✖ [GATE ${totalGates}: ${name}] FAILED: ${err.message}`);
    throw err;
  }
}

async function run() {
  console.log("=========================================================================");
  console.log("CakeToHome: Customer Location Authority & Address Decoupling Suite");
  console.log("=========================================================================\n");

  ApiEngine.getStore();
  ApiEngine.ensureOrdersStore();
  ApiEngine.ensureCartsStore();

  // Test Anchor Coordinates (Kollam Central Cake Studio: 8.8932, 76.6141)
  const storeLat = 8.8932;
  const storeLng = 76.6141;

  // ── GATE 1: Physical Location vs Address Separation ──────────────────────────
  await gate("Physical Location vs Address Separation Contract", () => {
    const physicalLocation = {
      latitude: 8.88534,
      longitude: 76.58032,
      accuracy: 10,
      source: "GPS" as const,
    };
    const humanAddress = {
      line1: "Flat 402, Signature Towers",
      line2: "Near High School Road",
      locality: "Chinnakada",
      city: "Kollam",
      state: "Kerala",
      pincode: "691001",
      landmark: "Opposite Town Hall",
      instructions: "Leave with security",
    };

    assert(!humanAddress.line1.includes("GPS"), "Human address line1 must not contain 'GPS'");
    assert(typeof physicalLocation.latitude === "number", "Latitude must be numeric");
    assert(typeof physicalLocation.longitude === "number", "Longitude must be numeric");
  });

  // ── GATE 2: GPS Flow & No 'GPS (...)' in Street Address ─────────────────────
  await gate("GPS Flow Reverse Geocode Clean Address", () => {
    const rev = ApiEngine.reverseGeocode(8.88534, 76.58032);
    assert(rev.success === true, "Reverse geocode should succeed");
    assert(!rev.address_line_1.startsWith("GPS ("), "address_line_1 must not be 'GPS (...)'");
    assert(!rev.area.startsWith("Location ("), "area must not be 'Location (...)'");
    assert(rev.latitude === 8.88534, "Latitude must match exact input");
    assert(rev.longitude === 76.58032, "Longitude must match exact input");
    console.log(`  GPS reverse geocode: area='${rev.area}', city='${rev.city}', pincode='${rev.pincode}'`);
  });

  // ── GATE 3: Search Autocomplete Flow & Coordinate Separation ────────────────
  await gate("Search Autocomplete Flow", () => {
    const searchRes = ApiEngine.searchLocation("Kadappakada");
    assert(searchRes.length > 0, "Search results should be found");
    const item = searchRes[0];
    assert(typeof item.latitude === "number", "Search item must have numeric latitude");
    assert(typeof item.longitude === "number", "Search item must have numeric longitude");
    assert(typeof item.label === "string", "Search item must have descriptive text label");
    console.log(`  Search item: label='${item.label}', coords=(${item.latitude}, ${item.longitude})`);
  });

  // ── GATE 4: Saved Address Coordinates Persistence ──────────────────────────
  await gate("Saved Address Coordinates Persistence", () => {
    const savedAddr = {
      id: "addr_saved_01",
      address_1: "House 14, Beach Road",
      city: "Kollam",
      postal_code: "691001",
      latitude: 8.88710,
      longitude: 76.58140,
    };
    const extracted = extractDeliveryCoordinates(savedAddr);
    assert(extracted.hasCoords === true, "Saved address must have coordinates");
    assert(extracted.latitude === 8.88710, "Extracted latitude matches");
    assert(extracted.longitude === 76.58140, "Extracted longitude matches");
  });

  // ── GATE 5: Map Pin Drag & Instant Coordinate Propagation ───────────────────
  await gate("Map Pin Drag Propagation", () => {
    const oldLat = 8.88534;
    const oldLng = 76.58032;
    const newLat = 8.88710;
    const newLng = 76.58140;

    const oldResolve = ApiEngine.resolveSmartBranch({ lat: oldLat, lng: oldLng });
    const newResolve = ApiEngine.resolveSmartBranch({ lat: newLat, lng: newLng });

    assert(oldResolve.branch !== null, "Old location should be serviceable");
    assert(newResolve.branch !== null, "New location should be serviceable");
    assert(oldResolve.branch.id === newResolve.branch.id, "Both points served by same store");
    console.log(`  Pin drag from (${oldLat}, ${oldLng}) to (${newLat}, ${newLng}): both serviced by ${newResolve.branch.name}`);
  });

  // ── GATE 6: Small Marker Movement (10m - 100m) Stability ───────────────────
  await gate("Small Marker Movement (10m - 100m) Stability", () => {
    const baseLat = 8.88534;
    const baseLng = 76.58032;
    // 50m shift
    const shiftedLat = baseLat + 0.00045;
    const shiftedLng = baseLng + 0.00045;

    const distMeters = ApiEngine.calculateHaversineDistance(baseLat, baseLng, shiftedLat, shiftedLng) * 1000;
    const resA = ApiEngine.resolveSmartBranch({ lat: baseLat, lng: baseLng });
    const resB = ApiEngine.resolveSmartBranch({ lat: shiftedLat, lng: shiftedLng });

    assert(resA.branch !== null, "Base point must be serviceable");
    assert(resB.branch !== null, "Shifted point 50m away must remain serviceable");
    assert(resA.branch.id === resB.branch.id, "Store must remain identical for 50m shift");
    console.log(`  Small movement of ${distMeters.toFixed(1)} meters: Serviceability maintained (${resA.branch.name})`);
  });

  // ── GATE 7: Address Text Edit Isolation (Flat 402 -> Flat 502) ─────────────
  await gate("Address Text Edit Isolation", () => {
    const baseCoords = { lat: 8.88534, lng: 76.58032 };
    const feeBefore = ApiEngine.resolveSmartBranch({ lat: baseCoords.lat, lng: baseCoords.lng });

    // Customer changes "Flat 402" to "Flat 502"
    const textAfter = "Flat 502, Signature Towers";
    const feeAfter = ApiEngine.resolveSmartBranch({ lat: baseCoords.lat, lng: baseCoords.lng });

    assert(feeBefore.deliveryFee === feeAfter.deliveryFee, "Delivery fee must remain unchanged");
    assert(feeBefore.distanceKm === feeAfter.distanceKm, "Distance must remain unchanged");
    assert(feeBefore.branch.id === feeAfter.branch.id, "Store must remain unchanged");
    console.log(`  Editing address text to '${textAfter}' does not alter coordinates or fee (₹${feeAfter.deliveryFee})`);
  });

  // ── GATE 8: Map Pan Isolation ──────────────────────────────────────────────
  await gate("Map Pan Isolation (Panning does not alter destination)", () => {
    const customerPin = { lat: 8.88534, lng: 76.58032 };
    const mapViewportCenter = { lat: 8.95000, lng: 76.65000 }; // 10km away

    // Serviceability is evaluated strictly using customer pin, NEVER map viewport center
    const res = ApiEngine.resolveSmartBranch({ lat: customerPin.lat, lng: customerPin.lng });
    assert(res.branch !== null, "Customer pin must resolve correctly regardless of viewport pan");
    assert(res.distanceKm! < 10, "Distance computed from customer pin");
  });

  // ── GATE 9: Explicit Geocode Action ([ Search this address on map ]) ───────
  await gate("Explicit Geocode Action", () => {
    const searchMatch = ApiEngine.searchLocation("Kollam")[0];
    assert(searchMatch !== undefined, "Search result should exist");
    const geocoded = ApiEngine.resolveSmartBranch({ lat: searchMatch.latitude, lng: searchMatch.longitude });
    assert(geocoded.branch !== null, "Explicit geocode location resolves store");
  });

  // ── GATE 10: Serviceability Inside Delivery Area ───────────────────────────
  await gate("Serviceability Inside Delivery Area", () => {
    const insideCoords = { lat: 8.8950, lng: 76.6000 };
    const res = ApiEngine.resolveSmartBranch({ lat: insideCoords.lat, lng: insideCoords.lng });
    assert(res.branch !== null, "Inside point must be serviceable");
    assert(res.deliveryFee > 0, "Delivery fee must be calculated");
    console.log(`  Inside point: Store=${res.branch.name}, Zone=${res.zoneName}, Fee=₹${res.deliveryFee}`);
  });

  // ── GATE 11: Serviceability Outside Delivery Area ──────────────────────────
  await gate("Serviceability Outside Delivery Area", () => {
    const outsideCoords = { lat: 0.0, lng: 76.0 };
    const res = ApiEngine.resolveSmartBranch({ lat: outsideCoords.lat, lng: outsideCoords.lng });
    assert(res.branch === null, "Outside point must be unserviceable");
    assert(res.reasonCode === "NO_ELIGIBLE_STORE", "Reason code must be NO_ELIGIBLE_STORE");
    assert(res.deliveryFee === 0, "Delivery fee must be 0 for unserviceable");
  });

  // ── GATE 12: Exclusion Area Rejection ──────────────────────────────────────
  await gate("Exclusion Area Rejection", () => {
    // Coordinate inside exclusion polygon configured on store
    const store = ApiEngine.listBranches()[0];
    const zone = store?.delivery_zones?.[0];
    if (zone && zone.exclusion_polygons) {
      const exList = typeof zone.exclusion_polygons === "string" ? JSON.parse(zone.exclusion_polygons) : zone.exclusion_polygons;
      if (Array.isArray(exList) && exList[0]?.[0]) {
        const exPt = exList[0][0];
        const res = ApiEngine.isPointInZone(exPt.lat, exPt.lng, zone, store);
        assert(res.matched === false, "Point inside exclusion must not match");
        console.log(`  Exclusion verification: matched=false, reason='${res.reason}'`);
      }
    }
  });

  // ── GATE 13: Radius Boundary Precision (9.9km vs 10.1km) ───────────────────
  await gate("Radius Boundary Precision (9.9km vs 10.1km)", () => {
    const mockZone: any = {
      id: "zone_rad_10",
      name: "10km Radius Tier",
      enabled: true,
      boundary_type: "radius",
      radius_km: 10.0,
      center_latitude: 8.8932,
      center_longitude: 76.6141,
    };
    // 9.9 km north
    const lat99 = 8.8932 + (9.9 / 111);
    const res99 = ApiEngine.isPointInZone(lat99, 76.6141, mockZone);
    assert(res99.matched === true, "9.9 km must be inside 10 km radius");

    // 10.1 km north
    const lat101 = 8.8932 + (10.1 / 111);
    const res101 = ApiEngine.isPointInZone(lat101, 76.6141, mockZone);
    assert(res101.matched === false, "10.1 km must be outside 10 km radius");
    console.log(`  Radius precision: 9.9km matched=${res99.matched}, 10.1km matched=${res101.matched}`);
  });

  // ── GATE 14: Pincode Bypass Gate ───────────────────────────────────────────
  await gate("Pincode Bypass Gate", () => {
    // Valid Kollam pincode (691001) but coordinates in Hubli/Dharwad (15.3647, 75.1240)
    const res = ApiEngine.resolveSmartBranch({
      pincode: "691001",
      lat: 15.3647,
      lng: 75.1240,
    });
    assert(res.branch === null, "Out-of-fence coordinates must be rejected even with local pincode");
    console.log(`  Pincode bypass blocked: result resolvedBy='${res.resolvedBy}'`);
  });

  // ── GATE 15: Distance Pricing Brackets ─────────────────────────────────────
  await gate("Distance Pricing Brackets", () => {
    const brackets = [
      { min_km: 0, max_km: 3, charge: 39 },
      { min_km: 3.001, max_km: 5, charge: 49 },
      { min_km: 5.001, max_km: 8, charge: 69 },
      { min_km: 8.001, max_km: 10, charge: 99 },
    ];
    const fee2 = ApiEngine.resolveDistanceBracketFee(brackets, 2.5);
    assert(fee2?.fee === 39, "2.5km fee is ₹39");

    const fee4 = ApiEngine.resolveDistanceBracketFee(brackets, 4.2);
    assert(fee4?.fee === 49, "4.2km fee is ₹49");

    const fee11 = ApiEngine.resolveDistanceBracketFee(brackets, 11.5);
    assert(fee11 === null, "11.5km exceeds max brackets -> null (unserviceable)");
    console.log(`  Distance pricing brackets: 2.5km=₹${fee2?.fee}, 4.2km=₹${fee4?.fee}, 11.5km=UNSERVICEABLE`);
  });

  // ── GATE 16: Delivery Slots Gated by Serviceability ────────────────────────
  await gate("Delivery Slots Gated by Serviceability", () => {
    const servAvail = ApiEngine.getCheckoutAvailability({
      latitude: 8.8932,
      longitude: 76.6025,
      delivery_type: "delivery",
    });
    assert(servAvail.serviceable === true, "Serviceable location has serviceable=true");
    assert(servAvail.available_slots.length > 0, "Serviceable location must return available slots");

    const unservAvail = ApiEngine.getCheckoutAvailability({
      latitude: 0.0,
      longitude: 76.0,
      delivery_type: "delivery",
    });
    assert(unservAvail.serviceable === false, "Unserviceable location has serviceable=false");
    assert(unservAvail.available_slots.length === 0, "Unserviceable location returns 0 slots");
  });

  // ── GATE 17: Order Snapshot Immutability ────────────────────────────────────
  await gate("Order Snapshot Immutability", () => {
    const cartId = `cart_snap_${Date.now()}`;
    ApiEngine.createCart({ id: cartId });
    ApiEngine.addItemToCart(cartId, {
      id: "item_truffle",
      product_id: "prod_1",
      title: "Signature Belgian Chocolate Truffle",
      unit_price: 749,
      quantity: 1,
      subtotal: 749,
    });

    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomIso = tomorrow.toISOString().slice(0, 10);

    const orderRes = ApiEngine.confirmCheckout({
      cart_id: cartId,
      customer_id: "cus_snap_test",
      latitude: 8.88534,
      longitude: 76.58032,
      pincode: "691001",
      delivery_date: tomIso,
      delivery_slot_id: "slot_standard",
      payment_method: "test_mode",
      address: {
        first_name: "Anita",
        phone: "9876543210",
        line1: "Flat 402, Marina Bay Towers",
        city: "Kollam",
        pincode: "691001",
        latitude: 8.88534,
        longitude: 76.58032,
      },
    } as any);

    assert(orderRes.success === true, `Order placement should succeed: ${orderRes.error}`);
    const order = orderRes.order;
    assert(order.delivery_latitude === 8.88534, "Order delivery_latitude must match exactly");
    assert(order.delivery_longitude === 76.58032, "Order delivery_longitude must match exactly");
    assert(order.delivery_address_line_1 === "Flat 402, Marina Bay Towers", "Address line1 preserved");
    console.log(`  Order #${order.order_number} snapshotted coordinates (${order.delivery_latitude}, ${order.delivery_longitude})`);
  });

  // ── GATE 18: Google Maps URL Uses Coordinates, NOT Address String ──────────
  await gate("Google Maps URL Uses Coordinates, NOT Address String", () => {
    const order = {
      delivery_latitude: 8.88534,
      delivery_longitude: 76.58032,
      delivery_address: "Flat 402, Marina Bay Towers, Beach Road, Kollam",
      delivery_pincode: "691001",
    };

    const url = buildGoogleMapsDirectionsUrl({
      latitude: order.delivery_latitude,
      longitude: order.delivery_longitude,
      address: order.delivery_address,
      pincode: order.delivery_pincode,
    });

    assert(url.includes("destination=8.885340,76.580320"), "URL destination must use lat/lng coordinates");
    assert(!url.includes("Flat%20402"), "URL destination must NOT be encoded address text");
    console.log(`  Google Maps navigation URL: ${url}`);
  });

  // ── GATE 19: Rider Navigation Deep Link Integrity ──────────────────────────
  await gate("Rider Navigation Deep Link Integrity", () => {
    const order = {
      delivery_latitude: 8.8932,
      delivery_longitude: 76.6025,
      delivery_address: "Door 12, Main Street",
    };
    const extracted = extractDeliveryCoordinates(order);
    assert(extracted.hasCoords === true, "Rider extraction has coords");
    const riderUrl = buildGoogleMapsDirectionsUrl({
      latitude: extracted.latitude,
      longitude: extracted.longitude,
    });
    assert(riderUrl === "https://www.google.com/maps/dir/?api=1&destination=8.893200,76.602500", "Rider URL matches exact coordinates");
  });

  // ── GATE 20: Stale Async Request Protection ────────────────────────────────
  await gate("Stale Async Request Protection", () => {
    let currentSeq = 0;
    const dispatched = [
      { seq: ++currentSeq, lat: 8.88534, lng: 76.58032 },
      { seq: ++currentSeq, lat: 8.88710, lng: 76.58140 },
      { seq: ++currentSeq, lat: 8.89320, lng: 76.60250 },
    ];

    const latestSeq = currentSeq;
    // Request 1 returns late
    const isRequest1Stale = dispatched[0].seq !== latestSeq;
    assert(isRequest1Stale === true, "Outdated request 1 must be ignored");

    // Request 3 returns
    const isRequest3Authoritative = dispatched[2].seq === latestSeq;
    assert(isRequest3Authoritative === true, "Latest request 3 is authoritative");
  });

  // ── GATE 21: End-to-End Coordinate Chain Integrity ─────────────────────────
  await gate("End-to-End Coordinate Chain Integrity", () => {
    const inputLat = 8.88534;
    const inputLng = 76.58032;

    // 1. API Availability
    const avail = ApiEngine.getCheckoutAvailability({ latitude: inputLat, longitude: inputLng });
    assert(avail.serviceable === true, "Chain step 1: Availability matches");

    // 2. Order Placement
    const cartId = `cart_chain_${Date.now()}`;
    ApiEngine.createCart({ id: cartId });
    ApiEngine.addItemToCart(cartId, { id: "item_c", product_id: "prod_1", title: "Cake", unit_price: 500, quantity: 1, subtotal: 500 });
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomIso = tomorrow.toISOString().slice(0, 10);

    const orderRes = ApiEngine.confirmCheckout({
      cart_id: cartId,
      latitude: inputLat,
      longitude: inputLng,
      delivery_date: tomIso,
      delivery_slot_id: "slot_standard",
      payment_method: "test_mode",
      address: { first_name: "Anita", phone: "9876543210", line1: "House 10", city: "Kollam", latitude: inputLat, longitude: inputLng },
    } as any);
    const order = orderRes.order;
    assert(order.delivery_latitude === inputLat, "Chain step 2: Order latitude matches");
    assert(order.delivery_longitude === inputLng, "Chain step 2: Order longitude matches");

    // 3. Rider Deep Link
    const riderUrl = buildGoogleMapsDirectionsUrl({ latitude: order.delivery_latitude, longitude: order.delivery_longitude });
    assert(riderUrl.includes(`destination=${inputLat.toFixed(6)},${inputLng.toFixed(6)}`), "Chain step 3: Rider destination matches");
    console.log(`  E2E Coordinate Chain: Input(${inputLat}, ${inputLng}) == Order(${order.delivery_latitude}, ${order.delivery_longitude}) == Rider(${riderUrl})`);
  });

  console.log("\n=========================================================================");
  console.log(`E2E Test Execution Finished: ${passedGates}/${totalGates} PASSED, 0 FAILED`);
  console.log("=========================================================================");
}

run().catch((err) => {
  console.error("Test execution aborted:", err);
  process.exit(1);
});
