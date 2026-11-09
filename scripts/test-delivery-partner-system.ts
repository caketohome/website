import { ApiEngine } from "../frontend/src/lib/api-engine";

async function runDeliveryPartnerTestSuite() {
  console.log("================================================================");
  console.log("🚀 CAKETOHOME — E2E DELIVERY PARTNER & AUTOMATIC DISPATCH SUITE");
  console.log("================================================================\n");

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
    // 1. Initial Store Setup & Partner Listing
    console.log("--- TEST 1: STORE INITIALIZATION & SEQUENTIAL PARTNER NUMBERING ---");
    const store = (ApiEngine as any).getStore ? (ApiEngine as any).getStore() : (ApiEngine as any).memoryStore;
    if (!store.products || store.products.length === 0) {
      store.products = [
        {
          id: "prod_1",
          product_id: "prod_1",
          title: "Belgian Chocolate Truffle Cake",
          name: "Belgian Chocolate Truffle Cake",
          price: 649,
          category: "Cakes",
          rating: 4.9,
          is_active: true,
        } as any,
      ];
    }
    ApiEngine.ensureDeliveryPartnersStore();
    const initialList = ApiEngine.getAdminDeliveryPartners();
    assert(
      initialList.count >= 4,
      "Initialized delivery partners store with seeded fleet records",
      `Count: ${initialList.count}`
    );

    const firstPartner = initialList.partners[0];
    assert(
      Boolean(firstPartner.partner_number && firstPartner.partner_number.startsWith("CTH-DP-")),
      "Partner number follows canonical format CTH-DP-XXXXXX",
      `First Partner Number: ${firstPartner.partner_number}`
    );

    // 2. Register New Delivery Partner
    console.log("\n--- TEST 2: REGISTER NEW DELIVERY PARTNER VIA ONBOARDING WIZARD PAYLOAD ---");
    const testPhone = `+91 99${Math.floor(10000000 + Math.random() * 90000000)}`;
    const nextNum = ApiEngine.generateNextPartnerNumber();
    const newPartnerPayload = {
      first_name: "Vikram",
      last_name: "Singh",
      phone: testPhone,
      alternate_phone: "+91 99887 76600",
      email: `vikram.${Date.now()}@cakes2home.com`,
      address: "12th Main, Indiranagar",
      city: "Bengaluru",
      state: "Karnataka",
      pincode: "560038",
      primary_branch_id: "res_01KXYMAHGFPRY1G9TZKEVGAGAT",
      primary_branch_name: "Indiranagar Flagship Kitchen",
      maximum_concurrent_orders: 5,
      pincodes: ["560038", "560008", "560071"],
      area: "Indiranagar",
      status: "active",
      availability_status: "ONLINE",
    };

    const registered = ApiEngine.createAdminDeliveryPartner(newPartnerPayload);
    assert(
      registered.partner_number === nextNum,
      "New partner received correct sequential partner number",
      `Expected: ${nextNum}, Got: ${registered.partner_number}`
    );
    assert(
      registered.full_name === "Vikram Singh" && registered.phone === testPhone,
      "Partner profile identity saved correctly",
      `Full Name: ${registered.full_name}, Phone: ${registered.phone}`
    );

    // 3. Duplicate Phone Prevention
    console.log("\n--- TEST 3: DUPLICATE PHONE NUMBER PREVENTION ---");
    let dupCaught = false;
    try {
      ApiEngine.createAdminDeliveryPartner({ ...newPartnerPayload, first_name: "Duplicate" });
    } catch (err: any) {
      dupCaught = true;
    }
    assert(dupCaught, "Duplicate mobile number registration rejected with validation error");

    // 4. Update Partner Availability & Profile
    console.log("\n--- TEST 4: UPDATE PARTNER AVAILABILITY & PROFILE ---");
    const availRes = ApiEngine.updatePartnerAvailability(registered.id, "OFFLINE", "Taking lunch break");
    assert(
      availRes.partner.availability_status === "OFFLINE",
      "Operational availability status toggled to OFFLINE",
      `New Status: ${availRes.partner.availability_status}`
    );

    ApiEngine.updatePartnerAvailability(registered.id, "ONLINE", "Resumed duty");

    // 5. Automatic Rider Assignment Engine (Order Dispatch)
    console.log("\n--- TEST 5: AUTOMATIC RIDER ASSIGNMENT ENGINE ---");
    const today = new Date().toISOString().split("T")[0];
    const testOrderPayload = {
      customer_name: "Rahul Mehta",
      customer_phone: "+91 98765 00112",
      address_line: "777 100 Feet Rd, Indiranagar",
      city: "Bengaluru",
      pincode: "560038",
      delivery_date: today,
      delivery_slot: "Express 45-Min Delivery",
      delivery_slot_id: "SLOT_EXPRESS_45MIN",
      items: [
        { product_id: "prod_1", title: "Belgian Chocolate Truffle Cake", quantity: 1, unit_price: 649 },
      ],
      payment_method: "online",
      branch_id: "res_01KXYMAHGFPRY1G9TZKEVGAGAT",
      total: 649,
    };

    const orderRes = await ApiEngine.confirmCheckout(testOrderPayload);
    const newOrder = orderRes?.order || orderRes;
    assert(Boolean(newOrder && newOrder.id), "Created new test order for dispatch test", `Order #: ${newOrder.order_number}`);

    const autoAssignRes = ApiEngine.autoAssignDeliveryDriver(newOrder.id);
    assert(
      autoAssignRes?.assigned === true,
      "Automatic dispatch engine selected an eligible delivery partner",
      `Assigned Partner: ${autoAssignRes?.partner?.full_name || autoAssignRes?.partner?.name} (${autoAssignRes?.partner?.partner_number})`
    );

    const updatedOrderDetails = ApiEngine.getOrderDetails(newOrder.id);
    assert(
      updatedOrderDetails?.delivery_partner_id === autoAssignRes?.partner?.id,
      "Order bound to canonical delivery partner ID",
      `Partner ID: ${updatedOrderDetails?.delivery_partner_id}`
    );

    assert(
      Boolean(updatedOrderDetails?.delivery?.pickup_otp && updatedOrderDetails?.delivery?.delivery_otp),
      "Pickup and Delivery OTPs generated upon assignment",
      `Pickup OTP: ${updatedOrderDetails?.delivery?.pickup_otp}, Delivery OTP: ${updatedOrderDetails?.delivery?.delivery_otp}`
    );

    // 6. Manual Rider Reassignment
    console.log("\n--- TEST 6: MANUAL ADMIN RIDER REASSIGNMENT ---");
    const partner2 = ApiEngine.getAdminDeliveryPartners().partners.find((p: any) => p.id !== autoAssignRes?.partner?.id && p.status === "active");
    if (partner2) {
      const reassignRes = ApiEngine.manualAssignOrderDelivery(newOrder.id, partner2.id, "Manager Operational Reassignment");
      assert(
        reassignRes?.partner?.id === partner2.id,
        "Manually reassigned order to alternative delivery partner",
        `New Partner: ${reassignRes?.partner?.full_name} (${reassignRes?.partner?.partner_number})`
      );
      assert(
        reassignRes?.order?.delivery?.assignment_mode === "manual",
        "Assignment mode badge updated to 'manual'",
        `Mode: ${reassignRes?.order?.delivery?.assignment_mode}`
      );
    } else {
      console.log("   (Skipped partner2 reassignment due to single active partner)");
    }

    // 7. Rider Unassignment & Honest Empty State
    console.log("\n--- TEST 7: UNASSIGNMENT & HONEST EMPTY STATE ---");
    const unassignRes = ApiEngine.unassignOrderDelivery(newOrder.id, "Customer requested slot delay");
    assert(
      unassignRes?.order?.delivery?.partner_name === "UNASSIGNED",
      "Order delivery partner set to honest UNASSIGNED state",
      `Status: ${unassignRes?.order?.delivery?.status}, Partner: ${unassignRes?.order?.delivery?.partner_name}`
    );

    // 8. Partner Deactivation
    console.log("\n--- TEST 8: PARTNER DEACTIVATION & AUDIT LOG ---");
    const deactivateRes = ApiEngine.deactivateDeliveryPartner(registered.id, "End of contract");
    assert(
      deactivateRes?.partner?.status === "inactive" && deactivateRes?.partner?.availability_status === "OFFLINE",
      "Deactivated delivery partner account while preserving records",
      `Account Status: ${deactivateRes?.partner?.status}, Availability: ${deactivateRes?.partner?.availability_status}`
    );

    // 9. Assignment Rules Configuration Engine
    console.log("\n--- TEST 9: ASSIGNMENT RULES CONFIGURATION ENGINE ---");
    const newRules = ApiEngine.updateDeliveryAssignmentRules({
      allow_cross_branch_fallback: true,
      require_working_hours: true,
    });
    assert(
      newRules.allow_cross_branch_fallback === true && newRules.require_working_hours === true,
      "Updated backend assignment engine policy rules",
      `Fallback: ${newRules.allow_cross_branch_fallback}, Require Shift Hours: ${newRules.require_working_hours}`
    );

    // 10. Store-Derived Inherited Coverage (No Manual Pincodes in Creation Payload)
    console.log("\n--- TEST 10: STORE-DERIVED INHERITED COVERAGE ---");
    const sureshPhone = `+91 91${Math.floor(10000000 + Math.random() * 90000000)}`;
    const sureshPayload = {
      first_name: "Suresh",
      last_name: "Kumar",
      phone: sureshPhone,
      primary_branch_id: "res_01KXYMAHGFPRY1G9TZKEVGAGAT", // Indiranagar
      status: "active",
      availability_status: "ONLINE",
    };
    const suresh = ApiEngine.createAdminDeliveryPartner(sureshPayload);
    const sureshCoverage = ApiEngine.getPartnerEffectiveCoverage(suresh.id);

    assert(
      sureshCoverage.pincodes.includes("560038"),
      "Partner 'Suresh' automatically inherited Indiranagar pincode (560038) without manual input",
      `Derived Pincodes: ${sureshCoverage.pincodes.join(", ")}`
    );

    // 11. Dynamic Inheritance when Branch Coverage Changes
    console.log("\n--- TEST 11: DYNAMIC INHERITANCE ON BRANCH COVERAGE CHANGE ---");
    const indiranagarBranch = (ApiEngine.getAdminBranches() || []).find((b: any) => b.id === "res_01KXYMAHGFPRY1G9TZKEVGAGAT");
    if (indiranagarBranch) {
      indiranagarBranch.applicable_pincodes = [...(indiranagarBranch.applicable_pincodes || ["560038", "560008"]), "560047"];
      ApiEngine.updateAdminBranch(indiranagarBranch.id, { applicable_pincodes: indiranagarBranch.applicable_pincodes });

      const updatedSureshCov = ApiEngine.getPartnerEffectiveCoverage(suresh.id);
      assert(
        updatedSureshCov.pincodes.includes("560047"),
        "Suresh dynamically inherited newly added pincode (560047) without editing partner record",
        `New Pincodes: ${updatedSureshCov.pincodes.join(", ")}`
      );
    }

    // 12. Partner Reassignment to Another Branch Updates Coverage
    console.log("\n--- TEST 12: PARTNER REASSIGNMENT TO DIFFERENT STORE ---");
    const updatedSuresh = ApiEngine.updateAdminDeliveryPartner(suresh.id, {
      primary_branch_id: "br_whitefield",
      associated_branches: [
        { branch_id: "br_whitefield", branch_name: "Whitefield Central Kitchen", is_primary: true },
      ],
    });

    const whitefieldCov = ApiEngine.getPartnerEffectiveCoverage(updatedSuresh.id);
    assert(
      whitefieldCov.pincodes.includes("560066") && !whitefieldCov.pincodes.includes("560038"),
      "Suresh now inherits Whitefield coverage (560066) and no longer inherits Indiranagar coverage",
      `Whitefield Derived Pincodes: ${whitefieldCov.pincodes.join(", ")}`
    );

    // 13. Auto Assignment Eligibility Based strictly on Store Coverage Match
    console.log("\n--- TEST 13: AUTO ASSIGNMENT ELIGIBILITY BASED ON STORE COVERAGE MATCH ---");
    const eligibleForWhitefield = ApiEngine.getEligibleDeliveryPartners({ pincode: "560066", branch_id: "br_whitefield" });
    const isSureshEligibleWhitefield = (eligibleForWhitefield.candidates || eligibleForWhitefield.partners || eligibleForWhitefield || []).some(
      (p: any) => p.id === suresh.id || p.partner_number === suresh.partner_number
    );
    assert(
      isSureshEligibleWhitefield,
      "Suresh is ELIGIBLE for Whitefield order pincode 560066",
      `Matched Whitefield Candidate: ${suresh.partner_number}`
    );

    const eligibleForUnserviced = ApiEngine.getEligibleDeliveryPartners({ pincode: "560099", branch_id: "br_whitefield" });
    const isSureshStrictMatchUnserviced = (eligibleForUnserviced.candidates || eligibleForUnserviced.partners || eligibleForUnserviced || []).some(
      (p: any) => (p.id === suresh.id || p.partner_number === suresh.partner_number) && !p.is_fallback
    );
    assert(
      !isSureshStrictMatchUnserviced,
      "Suresh is NOT ELIGIBLE as a coverage match for unserviced pincode 560099",
      `Pincode 560099 not covered by Suresh's assigned store`
    );

    // 14. Multiple Assigned Branches Union Coverage
    console.log("\n--- TEST 14: MULTIPLE ASSIGNED STORES UNION COVERAGE ---");
    const multiBranchSuresh = ApiEngine.updateAdminDeliveryPartner(suresh.id, {
      primary_branch_id: "res_01KXYMAHGFPRY1G9TZKEVGAGAT",
      associated_branches: [
        { branch_id: "res_01KXYMAHGFPRY1G9TZKEVGAGAT", branch_name: "Indiranagar Flagship Kitchen", is_primary: true },
        { branch_id: "br_whitefield", branch_name: "Whitefield Central Kitchen", is_primary: false },
      ],
    });

    const unionCov = ApiEngine.getPartnerEffectiveCoverage(multiBranchSuresh.id);
    assert(
      unionCov.pincodes.includes("560038") && unionCov.pincodes.includes("560066"),
      "Suresh effective coverage is the UNION of Indiranagar (560038) and Whitefield (560066)",
      `Union Pincodes Count: ${unionCov.pincodes.length}`
    );

    // Summary Report
    console.log("\n================================================================");
    console.log(`🎯 TEST SUITE SUMMARY: ${passed} PASSED | ${failed} FAILED`);
    console.log("================================================================");

    if (failed > 0) {
      process.exit(1);
    }
  } catch (err: any) {
    console.error("FATAL ERROR IN SUITE:", err);
    process.exit(1);
  }
}

runDeliveryPartnerTestSuite();
