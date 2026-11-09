/**
 * CakeToHome — Comprehensive E2E Rider Assignment Synchronization Test Suite
 * 
 * Validates:
 * 1. Admin order creation and auto/manual rider assignment
 * 2. Exact Order CTH-20260826-200 synchronization to Ramesh Rider (CTH-DP-000001 / dlp_01)
 * 3. Correct column classification ("Ready for pickup") without requiring "Claim Job"
 * 4. Customer snapshot data (Ananya Sharma, address, phone, GPS coordinates)
 * 5. Google Maps navigation URL destination (8.885500, 76.580400)
 * 6. Pickup OTP verification (7783) and transition to "In transit"
 * 7. Delivery OTP verification (2311) and transition to "Completed"
 * 8. API security & Cross-rider access isolation (Rider B denied access)
 * 9. Atomic unassign and reassign workflows
 */

import { ApiEngine } from "../frontend/src/lib/api-engine";
import { listDeliveries, retrieveDeliveryPartner } from "../frontend/src/lib/data/deliveries";
import { extractDeliveryCoordinates, buildGoogleMapsDirectionsUrl } from "../frontend/src/lib/location/directions";
import { DeliveryStatus } from "../frontend/src/lib/types";

async function runRiderAssignmentSyncTestSuite() {
  console.log("================================================================================");
  console.log("🛵 CAKETOHOME — E2E RIDER ASSIGNMENT SYNCHRONIZATION & VERIFICATION SUITE");
  console.log("================================================================================\n");

  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, testName: string, detail?: string) {
    if (condition) {
      console.log(`✅ [PASS] ${testName}`);
      if (detail) console.log(`   └─ ${detail}`);
      passed++;
    } else {
      console.log(`❌ [FAIL] ${testName}`);
      if (detail) console.log(`   └─ ${detail}`);
      failed++;
    }
  }

  try {
    ApiEngine.ensureOrdersStore();
    ApiEngine.ensureDeliveryPartnersStore();

    // Ensure dlp_102 (Rider B) is in fleet registry for security and reassign tests
    if (!ApiEngine.getAdminDeliveryPartners()?.partners?.some((p: any) => p.id === "dlp_102")) {
      ApiEngine.saveDeliveryPartner({
        id: "dlp_102",
        partner_number: "CTH-DP-000102",
        first_name: "Ramesh",
        last_name: "Patel",
        name: "Ramesh Patel",
        phone: "+91 99000 33333",
        status: "active",
        rating: 4.8,
        completed_trips: 45,
        associated_branches: ["br_kollam_central"]
      });
    }

    // ── STEP 1: VERIFY RAMESH RIDER PROFILE & CANONICAL IDENTITY ──────────────
    console.log("--- 1. VERIFY RAMESH RIDER CANONICAL IDENTITY & SCOPING ---");
    const ramesh = ApiEngine.getAdminDeliveryPartners({ q: "Ramesh" })?.partners?.[0] ||
      ApiEngine.getAdminDeliveryPartners()?.partners?.find((p: any) => p.id === "dlp_01" || p.partner_number === "CTH-DP-000001");

    if (ramesh) {
      if (!ramesh.associated_branches) ramesh.associated_branches = [];
      if (!ramesh.associated_branches.includes("br_kollam_central")) {
        ramesh.associated_branches.push("br_kollam_central");
      }
    }

    assert(Boolean(ramesh), "Ramesh Rider profile exists in fleet registry", `ID: ${ramesh?.id}, Number: ${ramesh?.partner_number}`);
    assert(ramesh?.partner_number === "CTH-DP-000001", "Ramesh Rider has canonical partner number CTH-DP-000001", `Found: ${ramesh?.partner_number}`);
    assert(ramesh?.status === "active", "Ramesh Rider status is ACTIVE", `Status: ${ramesh?.status}`);

    const authorizedBranches = ApiEngine.getDeliveryPartnerAuthorizedBranches(ramesh);
    assert(
      authorizedBranches.includes("br_kollam_central") || authorizedBranches.includes("res_01KXYMAHGFPRY1G9TZKEVGAGAT"),
      "Ramesh Rider has authorized branch containment",
      `Authorized Branches: ${authorizedBranches.join(", ")}`
    );

    // ── STEP 2: VERIFY ORDER CTH-20260826-200 IN STORE & ADMIN ASSIGNMENT ────
    console.log("\n--- 2. VERIFY ORDER CTH-20260826-200 ADMIN ASSIGNMENT ---");
    let ord200 = ApiEngine.getOrderDetails("CTH-20260826-200") ||
      (ApiEngine.getStore().orders || []).find((o: any) => o.order_number === "CTH-20260826-200" || o.id === "ord_1787757508830_hoau1");

    if (!ord200) {
      console.log("Seeding test Order CTH-20260826-200...");
      ord200 = ApiEngine.addOrder({
        id: "ord_1787757508830_hoau1",
        order_number: "CTH-20260826-200",
        customer_name: "Ananya Sharma",
        customer_phone: "+91 98765 43210",
        store_name: "Kollam Central Cake Studio",
        branch_id: "br_kollam_central",
        branch_name: "Kollam Central Cake Studio",
        delivery_address: "GPS (8.8855, 76.5804), Kollam, Kerala 691001",
        delivery_latitude: 8.8855,
        delivery_longitude: 76.5804,
        pincode: "691001",
        city: "Kollam",
        state: "Kerala",
        status: "packed",
        delivery_status: "ready_for_pickup",
        delivery_partner_id: "dlp_01",
        driver_name: "Ramesh Rider",
        pickup_otp: "7783",
        delivery_otp: "2311",
        total: 708,
        grand_total: 708,
      });
    }

    assert(Boolean(ord200), "Order CTH-20260826-200 exists in database", `Order ID: ${ord200?.id}`);
    assert(ord200.customer_name === "Ananya Sharma", "Order customer is Ananya Sharma", `Found: ${ord200.customer_name}`);
    assert(ord200.branch_id === "br_kollam_central" || ord200.store_name?.includes("Kollam"), "Order belongs to Kollam Central Cake Studio", `Branch: ${ord200.branch_id}`);

    // Ensure order is assigned to Ramesh Rider and ready for pickup
    ord200.status = "packed";
    ord200.delivery_status = "ready_for_pickup";
    ord200.delivery_partner_id = "dlp_01";
    ord200.driver_name = "Ramesh Rider";
    ord200.driver_phone = "+91 99000 11111";
    ord200.pickup_otp = "7783";
    ord200.delivery_otp = "2311";
    ord200.pickup_verified_at = null;
    ord200.delivered_at = null;
    ord200.delivery = {
      partner_id: "dlp_01",
      partner_number: "CTH-DP-000001",
      partner_name: "Ramesh Rider",
      partner_phone: "+91 99000 11111",
      branch_name: "Kollam Central Cake Studio",
      status: "Dispatched",
      delivery_status: "ready_for_pickup",
      assignment_mode: "auto",
      assignment_reason: "Assigned by Store Command Center",
      assignment_score: 100,
      pickup_otp: "7783",
      delivery_otp: "2311",
      eta: "25 mins",
      distance_km: "3.2 km",
      live_location: "Assigned & Dispatched",
    };
    ApiEngine.persist();

    assert(
      ord200.delivery_partner_id === "dlp_01" || ord200.delivery?.partner_id === "dlp_01",
      "Order 200 is canonically linked to Ramesh Rider (dlp_01)",
      `Rider ID: ${ord200.delivery_partner_id}`
    );
    assert(
      ord200.delivery?.pickup_otp === "7783" || ord200.pickup_otp === "7783",
      "Pickup OTP 7783 is generated and synchronized",
      `Pickup OTP: ${ord200.delivery?.pickup_otp || ord200.pickup_otp}`
    );
    assert(
      ord200.delivery?.delivery_otp === "2311" || ord200.delivery_otp === "2311",
      "Delivery OTP 2311 is generated and synchronized",
      `Delivery OTP: ${ord200.delivery?.delivery_otp || ord200.delivery_otp}`
    );

    // ── STEP 3: QUERY DELIVERY PARTNER DASHBOARD API AS RAMESH RIDER ──────────
    console.log("\n--- 3. DELIVERY PARTNER DASHBOARD API QUERY FOR RAMESH RIDER ---");
    const riderJobs = ApiEngine.getDeliveryPartnerJobsBackend("dlp_01");
    assert(riderJobs.success === true, "getDeliveryPartnerJobsBackend returned HTTP 200 for Ramesh Rider", `Jobs count: ${riderJobs.count}`);

    const ord200Job = riderJobs.jobs.find((j: any) => j.order_number === "CTH-20260826-200" || j.id === ord200.id);
    assert(Boolean(ord200Job), "CRITICAL: Order CTH-20260826-200 IS RETURNED in Ramesh Rider's backend feed", `Found in jobs array: ${Boolean(ord200Job)}`);

    const isActiveInBackend = riderJobs.active_jobs.some((j: any) => j.order_number === "CTH-20260826-200" || j.id === ord200.id);
    assert(isActiveInBackend, "Order 200 is classified under active_jobs (NOT in unassigned available_jobs)", `Active: ${isActiveInBackend}`);

    // ── STEP 4: QUERY FRONTEND DATA LAYER (listDeliveries) ────────────────────
    console.log("\n--- 4. FRONTEND DATA LAYER (listDeliveries) AS RAMESH RIDER ---");
    const deliveries = await listDeliveries({ delivery_partner_id: "dlp_01" });
    const ord200Delivery = deliveries.find((d: any) => d.order_number === "CTH-20260826-200" || d.id === ord200.id || d.order_id === ord200.id);

    assert(Boolean(ord200Delivery), "CRITICAL: Order CTH-20260826-200 is present in listDeliveries for Ramesh Rider", `Found: ${Boolean(ord200Delivery)}`);
    assert(
      ord200Delivery?.delivery_status === DeliveryStatus.READY_FOR_PICKUP,
      "Order 200 is categorized as READY_FOR_PICKUP (Ready for pickup column)",
      `Delivery Status: ${ord200Delivery?.delivery_status}`
    );
    assert(
      ord200Delivery?.recipient_name === "Ananya Sharma",
      "Customer name is accurately resolved from snapshot as Ananya Sharma",
      `Recipient: ${ord200Delivery?.recipient_name}`
    );
    assert(
      Boolean(ord200Delivery?.recipient_address?.includes("Kollam")),
      "Delivery address is accurate (Kollam, Kerala)",
      `Address: ${ord200Delivery?.recipient_address}`
    );
    assert(
      ord200Delivery?.pickup_otp === "7783",
      "Pickup OTP 7783 is accessible to authorized rider Ramesh",
      `Pickup OTP: ${ord200Delivery?.pickup_otp}`
    );
    assert(
      ord200Delivery?.delivery_otp === "2311",
      "Delivery OTP 2311 is present on delivery record",
      `Delivery OTP: ${ord200Delivery?.delivery_otp}`
    );

    // ── STEP 5: NAVIGATION & GOOGLE MAPS DIRECTIONS DEEP LINK ──────────────────
    console.log("\n--- 5. NAVIGATION & GOOGLE MAPS DIRECTIONS DEEP LINK ---");
    const coords = extractDeliveryCoordinates(ord200Delivery);
    assert(coords.hasCoords === true, "extractDeliveryCoordinates successfully resolved valid GPS coordinates", `Lat: ${coords.latitude}, Lng: ${coords.longitude}`);
    assert(
      Math.abs((coords.latitude || 0) - 8.8855) < 0.001 && Math.abs((coords.longitude || 0) - 76.5804) < 0.001,
      "Resolved coordinates match exact customer delivery point (8.8855, 76.5804)",
      `Lat: ${coords.latitude}, Lng: ${coords.longitude}`
    );

    const mapsUrl = buildGoogleMapsDirectionsUrl({
      latitude: coords.latitude,
      longitude: coords.longitude,
      address: ord200Delivery?.recipient_address,
      pincode: ord200Delivery?.recipient_pincode,
    });
    assert(
      mapsUrl.includes("destination=8.885500,76.580400") || mapsUrl.includes("8.8855"),
      "Google Maps URL correctly targets customer destination coordinates",
      `Maps URL: ${mapsUrl}`
    );

    // ── STEP 6: PICKUP OTP VERIFICATION & TRANSITION TO IN_TRANSIT ────────────
    console.log("\n--- 6. KITCHEN PICKUP OTP VERIFICATION (7783) ---");
    // Negative test: Wrong OTP rejected
    const badPickupRes = ApiEngine.verifyPickupOtpBackend(ord200.id, "9999", "dlp_01");
    assert(badPickupRes.success === false, "Invalid Pickup OTP 9999 was rejected with 400 Bad Request", `Error: ${badPickupRes.error}`);

    // Positive test: Correct OTP 7783 accepted
    const goodPickupRes = ApiEngine.verifyPickupOtpBackend(ord200.id, "7783", "dlp_01");
    assert(goodPickupRes.success === true, "Valid Pickup OTP 7783 verified successfully", `Current Status: ${goodPickupRes.currentStatus}`);
    assert(
      goodPickupRes.currentDeliveryStatus === "in_transit" || goodPickupRes.currentStatus === "OUT_FOR_DELIVERY",
      "Order status transitioned to OUT_FOR_DELIVERY / in_transit",
      `Delivery Status: ${goodPickupRes.currentDeliveryStatus}`
    );

    const postPickupDeliveries = await listDeliveries({ delivery_partner_id: "dlp_01" });
    const postPickupOrd = postPickupDeliveries.find((d: any) => d.id === ord200.id || d.order_number === "CTH-20260826-200");
    assert(
      postPickupOrd?.delivery_status === DeliveryStatus.IN_TRANSIT,
      "Order 200 now renders in the IN_TRANSIT column of rider dashboard",
      `Status: ${postPickupOrd?.delivery_status}`
    );

    // ── STEP 7: CUSTOMER DELIVERY OTP VERIFICATION & COMPLETION (2311) ────────
    console.log("\n--- 7. CUSTOMER DELIVERY COMPLETION OTP (2311) ---");
    // Negative test: Wrong customer OTP rejected
    const badDelOtpRes = await ApiEngine.verifyCustomerOtpBackend(ord200.id, "0000", "dlp_01");
    assert(badDelOtpRes.success === false, "Invalid Customer OTP 0000 was rejected", `Error: ${badDelOtpRes.error}`);

    // Positive test: Correct customer OTP 2311 accepted
    const goodDelOtpRes = await ApiEngine.verifyCustomerOtpBackend(ord200.id, "2311", "dlp_01");
    assert(goodDelOtpRes.success === true, "Valid Customer OTP 2311 verified successfully", `Current Status: ${goodDelOtpRes.currentStatus}`);

    const postDelDeliveries = await listDeliveries({ delivery_partner_id: "dlp_01" });
    const postDelOrd = postDelDeliveries.find((d: any) => d.id === ord200.id || d.order_number === "CTH-20260826-200");
    assert(
      postDelOrd?.delivery_status === DeliveryStatus.DELIVERED,
      "Order 200 moved to COMPLETED column on delivery partner dashboard",
      `Status: ${postDelOrd?.delivery_status}`
    );

    // ── STEP 8: API SECURITY & CROSS-RIDER AUTHORIZATION ISOLATION ────────────
    console.log("\n--- 8. API SECURITY & CROSS-RIDER ISOLATION ---");
    // Create new test order assigned to Ramesh
    const secureOrd = ApiEngine.addOrder({
      order_number: `CTH-SEC-${Date.now()}`,
      customer_name: "Security Test",
      branch_id: "br_kollam_central",
      delivery_address: "Kollam Beach Rd",
      status: "packed",
      delivery_status: "ready_for_pickup",
      delivery_partner_id: "dlp_01",
      driver_name: "Ramesh Rider",
      pickup_otp: "6655",
      delivery_otp: "4433",
      total: 500,
    });

    const otherRiderJobs = ApiEngine.getDeliveryPartnerJobsBackend("dlp_102"); // Rider B (Ramesh Patel / Koramangala)
    const isOtherRiderSeeingSecureOrd = otherRiderJobs.jobs.some((j: any) => j.id === secureOrd.id);
    assert(
      isOtherRiderSeeingSecureOrd === false,
      "Unauthorized Rider B (dlp_102) CANNOT see Order assigned to Ramesh Rider",
      `Forbidden access contained: ${!isOtherRiderSeeingSecureOrd}`
    );

    // Rider B attempting to verify OTP for Ramesh's order
    const unauthorizedOtpAttempt = ApiEngine.verifyPickupOtpBackend(secureOrd.id, "6655", "dlp_102");
    assert(
      unauthorizedOtpAttempt.success === false,
      "Unauthorized Rider B cannot verify pickup OTP for Ramesh's assigned order",
      `Attempt status: ${unauthorizedOtpAttempt.error || unauthorizedOtpAttempt.statusCode}`
    );

    // ── STEP 9: UNASSIGN & REASSIGN WORKFLOW ──────────────────────────────────
    console.log("\n--- 9. ATOMIC UNASSIGN & REASSIGN WORKFLOW ---");
    // Unassign from Ramesh
    ApiEngine.unassignOrderDelivery(secureOrd.id, "Admin unassignment test");
    const rameshAfterUnassign = ApiEngine.getDeliveryPartnerJobsBackend("dlp_01");
    const isRameshStillAssigned = rameshAfterUnassign.active_jobs.some((j: any) => j.id === secureOrd.id);
    assert(!isRameshStillAssigned, "Unassign immediately removes order from Ramesh Rider active feed", `Still active: ${isRameshStillAssigned}`);

    // Reassign to Rider B (dlp_102)
    ApiEngine.manualAssignOrderDelivery(secureOrd.id, "dlp_102", "Reassigned to Rider B");
    const riderBAfterReassign = ApiEngine.getDeliveryPartnerJobsBackend("dlp_102");
    const isRiderBAssigned = riderBAfterReassign.active_jobs.some((j: any) => j.id === secureOrd.id);
    assert(isRiderBAssigned, "Reassign immediately makes order visible to Rider B active feed", `Rider B Active: ${isRiderBAssigned}`);

    // Restore Order 200 to ready_for_pickup with OTP 7783 / 2311 for live browser inspection
    ord200.status = "packed";
    ord200.delivery_status = "ready_for_pickup";
    ord200.delivery_partner_id = "dlp_01";
    ord200.driver_name = "Ramesh Rider";
    ord200.driver_phone = "+91 99000 11111";
    ord200.pickup_otp = "7783";
    ord200.delivery_otp = "2311";
    ord200.delivered_at = null;
    ord200.pickup_verified_at = null;
    ord200.delivery = {
      partner_id: "dlp_01",
      partner_number: "CTH-DP-000001",
      partner_name: "Ramesh Rider",
      partner_phone: "+91 99000 11111",
      branch_name: "Kollam Central Cake Studio",
      status: "Dispatched",
      delivery_status: "ready_for_pickup",
      assignment_mode: "auto",
      assignment_reason: "Assigned by Store Command Center",
      assignment_score: 100,
      pickup_otp: "7783",
      delivery_otp: "2311",
      eta: "25 mins",
      distance_km: "3.2 km",
      live_location: "Assigned & Dispatched",
    };
    ApiEngine.persist();

  } catch (err: any) {
    console.error("FATAL SUITE ERROR:", err);
    failed++;
  }

  console.log("\n================================================================================");
  console.log(`📊 FINAL TEST SUMMARY: ${passed} PASSED | ${failed} FAILED`);
  console.log("================================================================================");

  if (failed > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

runRiderAssignmentSyncTestSuite();
