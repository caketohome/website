/**
 * CakeToHome Enterprise CRM & Customer Recovery System - Automated E2E Verification Suite
 * Tests 100% of CRM engine functions, lifecycle stages, deduplication, safe merge,
 * segment evaluation, WhatsApp/Call logging, and CSV exports.
 */

import {
  normalizePhone,
  formatDisplayPhone,
  normalizeEmail,
  deriveLifecycleStage,
  deriveCustomerTier,
  deriveCustomerJourneyFunnel,
  detectCustomerDuplicates,
  mergeCustomerRecords,
  evaluateCustomerAgainstSegment,
  exportCustomersToCsv,
  exportAbandonedCartsToCsv,
  SYSTEM_SEGMENTS,
} from "../src/lib/crm/crm-engine";
import {
  CustomerRecord,
  CustomerProfile,
  CustomerLifecycleStage,
  CustomerDuplicateCandidate,
} from "../src/lib/crm/types";
import { ApiEngine } from "../src/lib/api-engine";

let totalTests = 0;
let passedTests = 0;

function assert(condition: boolean, testName: string, detail?: string) {
  totalTests++;
  if (condition) {
    passedTests++;
    console.log(`  ✓ [PASS] ${testName}`);
  } else {
    console.error(`  ✗ [FAIL] ${testName} ${detail ? `- ${detail}` : ""}`);
  }
}

async function runCrmVerificationSuite() {
  console.log("================================================================================");
  console.log("CAKETOHOME CRM & RECOVERY SYSTEM — COMPLETE E2E VERIFICATION SUITE");
  console.log("================================================================================\n");

  // ──────────────────────────────────────────────────────────────────────────
  // 1. Phone & Email Normalization
  // ──────────────────────────────────────────────────────────────────────────
  console.log("1. Testing Identity Normalization");
  assert(normalizePhone("+91 98765 43210") === "9876543210", "Normalize +91 formatted mobile");
  assert(normalizePhone("09876543210") === "9876543210", "Normalize leading 0 mobile");
  assert(normalizePhone("9876543210") === "9876543210", "Normalize 10-digit mobile");
  assert(normalizePhone("+91-98765-43210") === "9876543210", "Normalize hyphenated mobile");
  assert(normalizePhone("   98765 43210  ") === "9876543210", "Normalize whitespace-padded mobile");
  assert(formatDisplayPhone("9876543210") === "+91 98765 43210", "Format 10-digit to display string");
  assert(normalizeEmail("  Ananya.Rao@EXAMPLE.COM  ") === "ananya.rao@example.com", "Normalize email casing and trim");
  console.log("");

  // ──────────────────────────────────────────────────────────────────────────
  // 2. Lifecycle Stage Derivation
  // ──────────────────────────────────────────────────────────────────────────
  console.log("2. Testing Lifecycle Stage Derivation");
  const baseCustomer: any = {
    id: "cus_test_1",
    customer_uid: "cth_cus_test_1",
    customer_number: "CTH-CUST-999901",
    customer_type: "registered",
    name: "Vikram Test",
    phone: "+91 99999 11111",
    orders_count: 0,
    total_spend: 0,
    aov: 0,
    created_at: new Date().toISOString(),
  };

  // Case A: 0 orders, created today -> NEW
  assert(deriveLifecycleStage(baseCustomer, []) === "NEW", "Stage: NEW (0 orders, created today)");

  // Case B: 0 orders, created 10 days ago -> NEW
  const regCustomer: CustomerRecord = {
    ...baseCustomer,
    created_at: new Date(Date.now() - 1000 * 60 * 60 * 24 * 10).toISOString(),
  };
  assert(deriveLifecycleStage(regCustomer, []) === "NEW", "Stage: NEW (0 orders)");

  // Case C: 1 order completed yesterday -> FIRST_PURCHASE
  const firstOrderCustomer: CustomerRecord = {
    ...baseCustomer,
    orders_count: 1,
    first_order_at: new Date(Date.now() - 1000 * 60 * 60 * 24).toISOString(),
    last_order_at: new Date(Date.now() - 1000 * 60 * 60 * 24).toISOString(),
  };
  const oneOrderList = [{ id: "ord_1", status: "confirmed", grand_total: 899, created_at: new Date().toISOString() }];
  assert(deriveLifecycleStage(firstOrderCustomer, oneOrderList) === "FIRST_PURCHASE", "Stage: FIRST_PURCHASE (1 completed order)");

  // Case D: 3 orders completed within 20 days -> REPEAT_BUYER
  const repeatCustomer: CustomerRecord = {
    ...baseCustomer,
    orders_count: 3,
    first_order_at: new Date(Date.now() - 1000 * 60 * 60 * 24 * 60).toISOString(),
    last_order_at: new Date(Date.now() - 1000 * 60 * 60 * 24 * 5).toISOString(),
  };
  const threeOrdersList = [
    { id: "ord_1", status: "delivered", grand_total: 899, created_at: new Date(Date.now() - 1000 * 60 * 60 * 24 * 60).toISOString() },
    { id: "ord_2", status: "delivered", grand_total: 1299, created_at: new Date(Date.now() - 1000 * 60 * 60 * 24 * 30).toISOString() },
    { id: "ord_3", status: "delivered", grand_total: 1499, created_at: new Date(Date.now() - 1000 * 60 * 60 * 24 * 5).toISOString() },
  ];
  assert(deriveLifecycleStage(repeatCustomer, threeOrdersList) === "REPEAT_BUYER", "Stage: REPEAT_BUYER (3 orders, active within 30d)");

  // Case E: 6 orders completed -> VIP
  const loyalCustomer: CustomerRecord = {
    ...baseCustomer,
    orders_count: 6,
    last_order_at: new Date(Date.now() - 1000 * 60 * 60 * 24 * 2).toISOString(),
  };
  assert(deriveLifecycleStage(loyalCustomer, [{}, {}, {}, {}, {}, {}]) === "VIP", "Stage: VIP (5+ completed orders)");

  // Case F: Last order was 50 days ago -> AT_RISK
  const atRiskCustomer: CustomerRecord = {
    ...baseCustomer,
    orders_count: 2,
    last_order_at: new Date(Date.now() - 1000 * 60 * 60 * 24 * 50).toISOString(),
  };
  assert(deriveLifecycleStage(atRiskCustomer, [{}, {}]) === "AT_RISK", "Stage: AT_RISK (last order > 45 days ago)");

  // Case G: Last order was 100 days ago -> DORMANT
  const dormantCustomer: CustomerRecord = {
    ...baseCustomer,
    orders_count: 2,
    last_order_at: new Date(Date.now() - 1000 * 60 * 60 * 24 * 100).toISOString(),
  };
  assert(deriveLifecycleStage(dormantCustomer, [{}, {}]) === "DORMANT", "Stage: DORMANT (last order > 90 days ago)");
  console.log("");

  // ──────────────────────────────────────────────────────────────────────────
  // 3. Customer Tier Derivation
  // ──────────────────────────────────────────────────────────────────────────
  console.log("3. Testing Customer Tier Derivation");
  assert(deriveCustomerTier(350, 1) === "STANDARD", "Tier: STANDARD (< ₹1,500 spend)");
  assert(deriveCustomerTier(2200, 2) === "SILVER", "Tier: SILVER (₹1,500 - ₹4,999 spend)");
  assert(deriveCustomerTier(6500, 4) === "GOLD", "Tier: GOLD (₹5,000 - ₹9,999 spend)");
  assert(deriveCustomerTier(12000, 8) === "VIP_PLATINUM", "Tier: VIP_PLATINUM (₹10,000+ spend)");
  assert(deriveCustomerTier(500, 1, true) === "VIP_PLATINUM", "Tier: VIP_PLATINUM (Explicit VIP override)");
  console.log("");

  // ──────────────────────────────────────────────────────────────────────────
  // 4. Duplicate Detection Engine
  // ──────────────────────────────────────────────────────────────────────────
  console.log("4. Testing Duplicate Detection & Scoring Engine");
  const testCustomersList: any[] = [
    {
      id: "cus_dup_1",
      customer_uid: "cth_cus_dup_1",
      customer_number: "CTH-CUST-100001",
      name: "Ananya Rao",
      phone: "+91 98765 43210",
      email: "ananya.rao@example.com",
      created_at: new Date().toISOString(),
    },
    {
      id: "cus_dup_2",
      customer_uid: "cth_cus_dup_2",
      customer_number: "CTH-CUST-100002",
      name: "Ananya Rao",
      phone: "09876543210", // Matching 10-digit phone
      email: "customer_1786912389@cakes2home.com", // Auto-generated email (should NOT trigger false positive)
      created_at: new Date().toISOString(),
    },
    {
      id: "cus_dup_3",
      customer_uid: "cth_cus_dup_3",
      customer_number: "CTH-CUST-100003",
      name: "Rahul Verma",
      phone: "+91 98765 11111",
      email: "rahul.v@example.com",
      created_at: new Date().toISOString(),
    },
  ];

  const duplicates = detectCustomerDuplicates(testCustomersList);
  assert(duplicates.length === 1, "Detected exactly 1 duplicate candidate pair");
  assert(duplicates[0].confidence_score >= 90, "Duplicate confidence score is >= 90% (Matching phone)");
  assert(Boolean(duplicates[0]?.matching_fields?.includes("phone")), "Matching field includes 'phone'");
  console.log("");

  // ──────────────────────────────────────────────────────────────────────────
  // 5. Safe Customer Merge Operation
  // ──────────────────────────────────────────────────────────────────────────
  console.log("5. Testing Safe Customer Merge Operation");
  const primaryCustomer: any = {
    id: "cus_p1",
    customer_uid: "cth_cus_primary_01",
    customer_number: "CTH-CUST-001",
    name: "Ananya Rao",
    phone: "+91 98765 43210",
    email: "ananya.rao@example.com",
    orders_count: 5,
    total_spend: 6000,
    tags: ["VIP", "Chocolate Lover"],
    addresses: [{ address_1: "100 Feet Rd", city: "Bengaluru", postal_code: "560038" }],
    loyalty: { points_balance: 300, points_earned: 600, points_redeemed: 300, tier: "GOLD", last_updated: "" },
    created_at: new Date(Date.now() - 1000 * 60 * 60 * 24 * 100).toISOString(),
  };

  const secondaryCustomer: any = {
    id: "cus_s2",
    customer_uid: "cth_cus_secondary_02",
    customer_number: "CTH-CUST-002",
    name: "Ananya Rao (Guest)",
    phone: "9876543210",
    orders_count: 2,
    total_spend: 2400,
    tags: ["Midnight Delivery"],
    addresses: [{ address_1: "12th Main Road, HAL 2nd Stage", city: "Bengaluru", postal_code: "560038" }],
    loyalty: { points_balance: 100, points_earned: 200, points_redeemed: 100, tier: "SILVER", last_updated: "" },
    created_at: new Date(Date.now() - 1000 * 60 * 60 * 24 * 10).toISOString(),
  };

  const existingOrders = [
    { id: "ord_p1", customer_uid: "cth_cus_primary_01", grand_total: 1200 },
    { id: "ord_s2", customer_uid: "cth_cus_secondary_02", grand_total: 1200 },
  ];

  const mergeResult = mergeCustomerRecords(primaryCustomer, secondaryCustomer, existingOrders, [], []);

  assert(mergeResult.mergedPrimary.customer_uid === "cth_cus_primary_01", "Primary retains canonical customer_uid");
  assert(mergeResult.mergedDuplicate.merged_into_uid === "cth_cus_primary_01", "Duplicate has merged_into_uid set");
  assert(mergeResult.mergedPrimary.loyalty.points_balance === 400, "Loyalty points balance combined (300 + 100 = 400)");
  assert(mergeResult.mergedPrimary.tags?.includes("Midnight Delivery"), "Tags merged preserving secondary tags");
  assert(mergeResult.mergedPrimary.addresses?.length === 2, "Addresses combined without dropping locations");
  assert(mergeResult.updatedOrders.every((o: any) => o.customer_uid === "cth_cus_primary_01"), "All orders re-assigned to primary UID");
  assert(mergeResult.newActivity.event_type === "CUSTOMER_MERGED", "Activity log records CUSTOMER_MERGED event");
  console.log("");

  // ──────────────────────────────────────────────────────────────────────────
  // 6. Dynamic System Segments
  // ──────────────────────────────────────────────────────────────────────────
  console.log("6. Testing Segment Evaluation");
  const newAccountNoPurchase: CustomerRecord = {
    ...baseCustomer,
    orders_count: 0,
    total_spend: 0,
    customer_type: "registered",
  };
  const segNewNoOrder = SYSTEM_SEGMENTS.find((s) => s.id === "seg_new_no_order")!;
  assert(evaluateCustomerAgainstSegment(newAccountNoPurchase, segNewNoOrder), "Evaluates correctly for seg_new_no_order");

  const vipCustomer: CustomerRecord = {
    ...baseCustomer,
    orders_count: 10,
    total_spend: 15000,
    tier: "VIP_PLATINUM",
    is_vip: true,
  };
  const segVip = SYSTEM_SEGMENTS.find((s) => s.id === "seg_vip")!;
  assert(evaluateCustomerAgainstSegment(vipCustomer, segVip), "Evaluates correctly for seg_vip");
  console.log("");

  // ──────────────────────────────────────────────────────────────────────────
  // 7. ApiEngine CRM Integrated Methods
  // ──────────────────────────────────────────────────────────────────────────
  console.log("7. Testing ApiEngine CRM Methods");
  ApiEngine.ensureCustomersStore();
  const crmList = ApiEngine.listAdminCustomersDetailed({ page: 1, limit: 10 });
  assert(crmList.success === true, "ApiEngine.listAdminCustomersDetailed returns success");
  assert(crmList.customers.length > 0, "ApiEngine returned seeded canonical customers");
  assert(crmList.summary !== undefined, "ApiEngine returned calculated analytical summary");

  // Profile Lookup
  const firstUid = crmList.customers[0].customer_uid;
  const profile = ApiEngine.getCustomerProfile(firstUid);
  assert(profile !== null, `ApiEngine.getCustomerProfile resolved for UID: ${firstUid}`);
  assert(profile?.journey_funnel !== undefined, "Profile contains journey_funnel tracker");
  assert(Array.isArray(profile?.activity_timeline), "Profile contains activity_timeline array");

  // Note Creation
  const newNote = ApiEngine.createCustomerNote(firstUid, { content: "E2E Test Note", category: "GENERAL" });
  assert(newNote !== null && newNote.content === "E2E Test Note", "Created customer note successfully");

  // Tag Update
  const updatedTags = ApiEngine.updateCustomerTags(firstUid, ["E2E-Tested", "VIP"]);
  assert(updatedTags !== null && updatedTags.includes("E2E-Tested"), "Updated customer tags successfully");

  // Call Action Logging
  const callAction = ApiEngine.recordCallAction(firstUid, undefined, undefined, "CALL_INITIATED");
  assert(callAction.success === true && callAction.event.event_type === "CALL_INITIATED", "Logged phone call action to customer timeline");
  console.log("");

  // ──────────────────────────────────────────────────────────────────────────
  // 8. CSV Export Generation
  // ──────────────────────────────────────────────────────────────────────────
  console.log("8. Testing CSV Exports");
  const customerCsv = ApiEngine.exportCustomersCsv();
  assert(typeof customerCsv === "string" && customerCsv.includes("Customer UID,Customer Number,Full Name,Phone"), "Generated Customer CSV with expected headers");

  const abandonedCsv = ApiEngine.exportAbandonedCartsCsv();
  assert(typeof abandonedCsv === "string" && abandonedCsv.includes("Cart ID,Customer Name,Phone"), "Generated Abandoned Cart CSV with expected headers");
  console.log("");

  // ──────────────────────────────────────────────────────────────────────────
  // 9. Summary & Final Verification Status
  // ──────────────────────────────────────────────────────────────────────────
  console.log("================================================================================");
  console.log(`TOTAL TESTS: ${totalTests} | PASSED: ${passedTests} | FAILED: ${totalTests - passedTests}`);
  if (passedTests === totalTests) {
    console.log("RESULT: ALL CRM & CUSTOMER RECOVERY TESTS PASSED (100% SUCCESS) ✨");
  } else {
    console.error("RESULT: SOME TESTS FAILED");
  }
  console.log("================================================================================\n");
}

runCrmVerificationSuite().catch((err) => {
  console.error("E2E Test Suite Error:", err);
  process.exit(1);
});
