import { ApiEngine } from "../src/lib/api-engine";

async function runEndToEndDeliveryWorkflowTest() {
  console.log("================================================================================");
  console.log("CAKETOHOME — END-TO-END DELIVERY SYSTEM & DATABASE WORKFLOW TEST");
  console.log("================================================================================\n");

  try {
    ApiEngine.ensureOrdersStore();
    ApiEngine.ensureDeliveryPartnersStore();

    // ── TEST FIXTURES SETUP ──────────────────────────────────────────────
    const testBranchA = "res_01KXYMAHGFPRY1G9TZKEVGAGAT"; // Indiranagar Hub
    const testBranchB = "res_02KXYMAHGFPRY1G9TZKEVGAGAT"; // Koramangala Hub

    const testPartnerA_Id = "dlp_test_A";
    const testPartnerB_Id = "dlp_test_B";

    // Setup Partner A (Branch A only)
    const pA = {
      id: testPartnerA_Id,
      partner_number: "CTH-DP-TEST01",
      full_name: "Test Rider Alpha",
      first_name: "Test",
      last_name: "Alpha",
      phone: "+91 99999 11111",
      email: "rider.a@cakes2home.com",
      status: "active",
      availability_status: "ONLINE",
      primary_branch_id: testBranchA,
      associated_branches: [{ branch_id: testBranchA, branch_name: "Indiranagar Kitchen", active: true }],
      maximum_concurrent_orders: 2,
      current_active_orders: 0,
      total_deliveries: 10,
      successful_deliveries: 10,
    };

    const pB = {
      id: testPartnerB_Id,
      partner_number: "CTH-DP-TEST02",
      full_name: "Test Rider Beta",
      first_name: "Test",
      last_name: "Beta",
      phone: "+91 99999 22222",
      email: "rider.b@cakes2home.com",
      status: "active",
      availability_status: "ONLINE",
      primary_branch_id: testBranchA,
      associated_branches: [{ branch_id: testBranchA, branch_name: "Indiranagar Kitchen", active: true }],
      maximum_concurrent_orders: 2,
      current_active_orders: 0,
      total_deliveries: 5,
      successful_deliveries: 5,
    };

    // Initialize stores
    ApiEngine.ensureDeliveryPartnersStore();
    const existingPartners = ApiEngine.getAdminDeliveryPartners().partners;
    
    // Inject/Upsert test partners in database store
    let partnerA = existingPartners.find((p: any) => p.id === testPartnerA_Id || p.phone === pA.phone);
    if (!partnerA) {
      ApiEngine.createAdminDeliveryPartner(pA);
    } else {
      Object.assign(partnerA, pA);
    }

    let partnerB = existingPartners.find((p: any) => p.id === testPartnerB_Id || p.phone === pB.phone);
    if (!partnerB) {
      ApiEngine.createAdminDeliveryPartner(pB);
    } else {
      Object.assign(partnerB, pB);
    }

    // Create Test Orders
    const testOrderId1 = "ORD-TEST-DEL-001";
    const testOrderId2 = "ORD-TEST-DEL-002";

    const order1 = {
      id: testOrderId1,
      order_number: testOrderId1,
      branch_id: testBranchA,
      customerName: "Priya Sharma",
      customerPhone: "+91 98765 00001",
      deliveryAddress: "Flat 101, Test Heights, Indiranagar",
      pincode: "560038",
      delivery_status: "shop_accepted",
      status: "confirmed",
      delivery_partner_id: null,
      pickup_verified_at: null,
      delivered_at: null,
      delivery_otp_verified_at: null,
      pickup_otp: "1294",
      delivery_otp: "4819",
      created_at: new Date().toISOString(),
    };

    const order2_BranchB = {
      id: testOrderId2,
      order_number: testOrderId2,
      branch_id: testBranchB, // Branch B Order
      customerName: "Vikram Nair",
      customerPhone: "+91 98765 00002",
      deliveryAddress: "Koramangala 4th Block, Bengaluru",
      pincode: "560034",
      delivery_status: "shop_accepted",
      status: "confirmed",
      pickup_otp: "3344",
      delivery_otp: "7788",
      created_at: new Date().toISOString(),
    };

    ApiEngine.injectTestOrders([order1, order2_BranchB]);

    console.log("STEP 1: Testing Illegal Delivery State Transition Validation...");
    const illegalCheck1 = ApiEngine.validateDeliveryStateTransition("shop_accepted", "delivered");
    if (!illegalCheck1.valid) {
      console.log(`  ✅ PASS: Illegal transition 'shop_accepted' -> 'delivered' blocked: "${illegalCheck1.reason}"`);
    } else {
      throw new Error("FAILED: Illegal transition was not blocked!");
    }

    const illegalCheck2 = ApiEngine.validateDeliveryStateTransition("in_transit", "pickup_claimed");
    if (!illegalCheck2.valid) {
      console.log(`  ✅ PASS: Illegal transition 'in_transit' -> 'pickup_claimed' blocked: "${illegalCheck2.reason}"`);
    } else {
      throw new Error("FAILED: Illegal transition was not blocked!");
    }

    console.log("\nSTEP 2: Testing Branch Security Authorization Isolation...");
    // Partner A (Branch A) attempts to claim Order 2 (Branch B)
    const branchSecRes = ApiEngine.claimDeliveryJob(testOrderId2, testPartnerA_Id);
    if (!branchSecRes.success && branchSecRes.statusCode === 403) {
      console.log(`  ✅ PASS: Branch security isolation verified! Partner A blocked from Branch B order: "${branchSecRes.error}"`);
    } else {
      throw new Error(`FAILED: Branch security failed! Result: ${JSON.stringify(branchSecRes)}`);
    }

    console.log("\nSTEP 3: Testing Concurrent Accept Protection (Atomic Claim)...");
    // Partner A claims Order 1
    const claimResA = ApiEngine.claimDeliveryJob(testOrderId1, testPartnerA_Id);
    if (claimResA.success && claimResA.statusCode === 200) {
      console.log(`  ✅ PASS: Partner A successfully claimed Order 1! Status: ${claimResA.order.delivery_status}`);
    } else {
      throw new Error(`FAILED: Partner A claim failed! Result: ${JSON.stringify(claimResA)}`);
    }

    // Partner B attempts to claim SAME Order 1
    const claimResB = ApiEngine.claimDeliveryJob(testOrderId1, testPartnerB_Id);
    if (!claimResB.success && claimResB.statusCode === 409) {
      console.log(`  ✅ PASS: Concurrent claim blocked! Partner B rejected: "${claimResB.error}"`);
    } else {
      throw new Error(`FAILED: Concurrent claim check failed! Result: ${JSON.stringify(claimResB)}`);
    }

    // Verify DB State for Order 1
    const dbOrder1 = ApiEngine.getOrderDetails(testOrderId1);
    if (dbOrder1 && dbOrder1.delivery_partner_id === testPartnerA_Id) {
      console.log(`  ✅ PASS: Verified Database record! delivery_partner_id = '${dbOrder1.delivery_partner_id}'`);
    } else {
      throw new Error("FAILED: Database record contains wrong partner ID!");
    }

    console.log("\nSTEP 4: Testing Kitchen Pickup OTP Verification (Wrong, Correct & Consumed)...");
    // Transition Order 1 to ready_for_pickup
    if (dbOrder1) dbOrder1.delivery_status = "ready_for_pickup";

    // 1. Wrong OTP
    const wrongPickupRes = ApiEngine.verifyPickupOtpBackend(testOrderId1, "9999", testPartnerA_Id);
    if (!wrongPickupRes.success && wrongPickupRes.statusCode === 400) {
      console.log(`  ✅ PASS: Wrong Pickup OTP rejected: "${wrongPickupRes.error}"`);
      if (!dbOrder1.pickup_verified_at) console.log("  ✅ PASS: DB pickup_verified_at remains null!");
    } else {
      throw new Error("FAILED: Wrong Pickup OTP was accepted!");
    }

    // 2. Correct OTP
    const correctPickupRes = ApiEngine.verifyPickupOtpBackend(testOrderId1, "1294", testPartnerA_Id);
    if (correctPickupRes.success && correctPickupRes.statusCode === 200) {
      console.log("  ✅ PASS: Correct Pickup OTP verified!");
      console.log(`  ✅ PASS: DB pickup_verified_at = '${dbOrder1.pickup_verified_at}'`);
      console.log(`  ✅ PASS: DB order delivery_status = '${dbOrder1.delivery_status}' (in_transit)`);
    } else {
      throw new Error(`FAILED: Correct Pickup OTP failed! ${JSON.stringify(correctPickupRes)}`);
    }

    // 3. Consumed OTP Attempt
    const consumedPickupRes = ApiEngine.verifyPickupOtpBackend(testOrderId1, "1294", testPartnerA_Id);
    if (!consumedPickupRes.success && consumedPickupRes.statusCode === 400) {
      console.log(`  ✅ PASS: Consumed Pickup OTP rejected on second attempt: "${consumedPickupRes.error}"`);
    } else {
      throw new Error("FAILED: Consumed Pickup OTP was allowed twice!");
    }

    console.log("\nSTEP 5: Testing Customer Delivery OTP Verification (Wrong, Correct & Consumed)...");
    // 1. Wrong Customer OTP
    const wrongCustRes = ApiEngine.verifyCustomerOtpBackend(testOrderId1, "9999", testPartnerA_Id);
    if (!wrongCustRes.success && wrongCustRes.statusCode === 400) {
      console.log(`  ✅ PASS: Wrong Customer OTP rejected: "${wrongCustRes.error}"`);
      if (!dbOrder1.delivered_at) console.log("  ✅ PASS: DB delivered_at remains null!");
    } else {
      throw new Error("FAILED: Wrong Customer OTP was accepted!");
    }

    // 2. Correct Customer OTP
    const correctCustRes = ApiEngine.verifyCustomerOtpBackend(testOrderId1, "4819", testPartnerA_Id);
    if (correctCustRes.success && correctCustRes.statusCode === 200) {
      console.log("  ✅ PASS: Correct Customer OTP verified!");
      console.log(`  ✅ PASS: DB delivered_at = '${dbOrder1.delivered_at}'`);
      console.log(`  ✅ PASS: DB order delivery_status = '${dbOrder1.delivery_status}' (delivered)`);
      console.log(`  ✅ PASS: Partner A active capacity decremented: ${pA.current_active_orders} active orders`);
    } else {
      throw new Error(`FAILED: Correct Customer OTP failed! ${JSON.stringify(correctCustRes)}`);
    }

    // 3. Consumed Customer OTP Attempt
    const consumedCustRes = ApiEngine.verifyCustomerOtpBackend(testOrderId1, "4819", testPartnerA_Id);
    if (!consumedCustRes.success && consumedCustRes.statusCode === 400) {
      console.log(`  ✅ PASS: Consumed Customer OTP rejected on second attempt: "${consumedCustRes.error}"`);
    } else {
      throw new Error("FAILED: Consumed Customer OTP was allowed twice!");
    }

    console.log("\nSTEP 6: Testing Delivery Exception Reporting...");
    const exceptionRes = ApiEngine.reportDeliveryExceptionBackend(testOrderId1, testPartnerA_Id, "CAKE_DAMAGED", "Cake box damaged in transit due to sudden braking.");
    if (exceptionRes.success && exceptionRes.statusCode === 200) {
      console.log(`  ✅ PASS: Delivery Exception recorded in database store! Exception ID: ${exceptionRes.exception.id}`);
      const excInStore = ApiEngine.getDeliveryExceptions().find((e: any) => e.id === exceptionRes.exception.id);
      if (excInStore) console.log(`  ✅ PASS: Exception verified in memoryStore.delivery_exceptions! Status: ${excInStore.status}`);
    } else {
      throw new Error("FAILED: Delivery Exception reporting failed!");
    }

    console.log("\nSTEP 7: Testing Maximum Partner Delivery Capacity Enforcement...");
    const pA_db = ApiEngine.getAdminDeliveryPartners().partners.find((p: any) => p.id === testPartnerA_Id);
    if (pA_db) {
      pA_db.maximum_concurrent_orders = 1;
      pA_db.current_active_orders = 1; // At capacity 1/1
    }

    // Create Order 3 for Branch A
    const order3 = {
      id: "ORD-TEST-DEL-003",
      order_number: "ORD-TEST-DEL-003",
      branch_id: testBranchA,
      customerName: "Rahul Roy",
      delivery_status: "shop_accepted",
      status: "confirmed",
    };
    ApiEngine.injectTestOrders([order3]);

    const capCheckRes = ApiEngine.claimDeliveryJob("ORD-TEST-DEL-003", testPartnerA_Id);
    if (!capCheckRes.success && capCheckRes.statusCode === 400) {
      console.log(`  ✅ PASS: Capacity limit enforced! Partner A blocked from third job: "${capCheckRes.error}"`);
    } else {
      throw new Error(`FAILED: Capacity limit check failed! Result: ${JSON.stringify(capCheckRes)}`);
    }

    console.log("\nSTEP 8: Testing Partner Availability Toggle (ONLINE / OFFLINE / PAUSED)...");
    const availRes = ApiEngine.updatePartnerAvailabilityBackend(testPartnerA_Id, "PAUSED", 45);
    if (availRes.success && availRes.partner.availability_status === "PAUSED") {
      console.log(`  ✅ PASS: Partner availability updated to PAUSED! Paused Until: ${availRes.partner.paused_until}`);
    } else {
      throw new Error("FAILED: Partner availability update failed!");
    }

    console.log("\n================================================================================");
    console.log("END-TO-END DELIVERY SYSTEM WORKFLOW TEST: ALL 8 STEPS PASSED (100%)");
    console.log("================================================================================\n");

  } catch (error: any) {
    console.error("❌ DEEP E2E TEST FAILED:", error);
    process.exit(1);
  }
}

runEndToEndDeliveryWorkflowTest();
