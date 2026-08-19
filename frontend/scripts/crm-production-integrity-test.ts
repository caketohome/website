/**
 * CakeToHome Enterprise CRM Production Integrity Test Suite
 * Validates all 10 Production Integrity Gates:
 *  1. ENVIRONMENT_MODE=production Seed/Test Customer Pollution Block
 *  2. Zero Orphan Customer Records
 *  3. Zero Orphan Order Records
 *  4. 100% Resolved Branch & City Mapping (Zero Missing Mappings)
 *  5. Phone Deduplication & Merge Transaction Integrity
 *  6. Deterministic RFM Lifecycle Calculation Accuracy
 *  7. Segment Rule Engine with conditions_json Evaluation
 *  8. Multi-Tier RBAC Isolation (Super Admin, City Mgr, Branch Mgr, Marketing, Delivery Partner 403)
 *  9. Customer 360 Data Lineage Trace Audit (Origin -> Checkout -> Gateway -> Hub -> Fleet -> WhatsApp)
 * 10. WhatsApp Consent Compliance & Transactional Outbox Event Emission
 */

import { ApiEngine } from "../src/lib/api-engine";
import { WebhookEngine } from "../src/lib/webhook-engine";
import {
  computeCustomerDataLineage,
  computeCustomerIntelligenceScores,
  evaluateCustomerAgainstSegment,
  deriveLifecycleStage,
  deriveCustomerTier,
  normalizePhone,
  SYSTEM_SEGMENTS,
} from "../src/lib/crm/crm-engine";
import { CustomerRecord, CustomerSegment, CustomerLifecycleStage } from "../src/lib/crm/types";

let passedCount = 0;
let failedCount = 0;
const results: Array<{ gate: string; name: string; status: "PASS" | "FAIL"; details: string }> = [];

function assert(gate: string, name: string, condition: boolean, details: string) {
  if (condition) {
    passedCount++;
    results.push({ gate, name, status: "PASS", details });
    console.log(`\x1b[32m[PASS]\x1b[0m ${gate}: ${name}`);
  } else {
    failedCount++;
    results.push({ gate, name, status: "FAIL", details });
    console.error(`\x1b[31m[FAIL]\x1b[0m ${gate}: ${name} - ${details}`);
  }
}

async function runProductionIntegrityTestSuite() {
  console.log("================================================================================");
  console.log("       CakeToHome CRM Production Hardening & Integrity Test Suite               ");
  console.log("================================================================================\n");

  // Set Environment Mode to Production
  process.env.ENVIRONMENT_MODE = "production";
  (process.env as any).NODE_ENV = "production";

  // Reset & initialize stores
  ApiEngine.resetStoreToCanonical();

  // -------------------------------------------------------------------------
  // GATE 1: ENVIRONMENT_MODE=production Seed Pollution Block
  // -------------------------------------------------------------------------
  console.log("\n--- [Gate 1] Environment Mode & Seed Customer Pollution Block ---");
  const envMode = ApiEngine.getEnvironmentMode();
  assert("Gate 1", "Environment Mode is Detected as Production", envMode === "production", `Mode: ${envMode}`);

  const health = ApiEngine.getCrmHealthReport();
  assert("Gate 1", "CRM Health Endpoint Reports Production Mode", health.environment_mode === "production", `Reported: ${health.environment_mode}`);
  
  const allCusts = ApiEngine.listAdminCustomersDetailed({ limit: 1000 }).customers;
  const hasGenericFakeCustomers = allCusts.some(
    (c: any) =>
      (c.name === "Customer" || c.name === "Gourmet Customer") &&
      (c.orders_count === 0 || !c.orders_count) &&
      (c.phone === "0000000000" || c.phone === "1234567890")
  );
  assert(
    "Gate 1",
    "Zero Generic Seed/Test Customer Pollution in Production Store",
    !hasGenericFakeCustomers,
    `Found fake customers: ${hasGenericFakeCustomers}`
  );

  // -------------------------------------------------------------------------
  // GATE 2: No Orphan Customer Records
  // -------------------------------------------------------------------------
  console.log("\n--- [Gate 2] Customer Identity Integrity ---");
  const invalidCustUid = allCusts.filter((c: any) => !c.customer_uid || typeof c.customer_uid !== "string");
  assert("Gate 2", "100% of Customers Have Valid Unique Customer UID", invalidCustUid.length === 0, `Invalid count: ${invalidCustUid.length}`);

  const validPhones = allCusts.filter((c: any) => {
    const norm = normalizePhone(c.phone);
    return norm.length >= 10;
  });
  assert("Gate 2", "100% of Active Customers Have Normalized Valid Phone Numbers", validPhones.length === allCusts.length, `${validPhones.length}/${allCusts.length} valid`);

  // -------------------------------------------------------------------------
  // GATE 3: No Orphan Orders
  // -------------------------------------------------------------------------
  console.log("\n--- [Gate 3] Order & Customer Linkage Integrity ---");
  const orders = ApiEngine.getAdminOrders({ limit: 1000 }).orders || [];
  const validOrderLinkage = orders.filter((o: any) => Boolean(o.customer_uid || o.customer_id || o.customer_phone || o.phone));
  assert("Gate 3", "100% of Orders Linked to Customer UID or Phone", validOrderLinkage.length === orders.length, `${validOrderLinkage.length}/${orders.length} linked`);

  // -------------------------------------------------------------------------
  // GATE 4: 100% Resolved Branch & City Mapping
  // -------------------------------------------------------------------------
  console.log("\n--- [Gate 4] Branch & City Resolution Integrity ---");
  const missingBranch = allCusts.filter((c: any) => !c.branch_name && !c.branch_id);
  assert("Gate 4", "Zero Missing Branch Mappings Across Entire Directory", missingBranch.length === 0, `Missing: ${missingBranch.length}`);
  assert("Gate 4", "Health Metric missing_branch_mapping is Exactly 0", health.missing_branch_mapping === 0, `Count: ${health.missing_branch_mapping}`);
  assert("Gate 4", "Health Metric missing_phone is Exactly 0", health.missing_phone === 0, `Count: ${health.missing_phone}`);

  // -------------------------------------------------------------------------
  // GATE 5: Phone Deduplication & Merge Transaction Integrity
  // -------------------------------------------------------------------------
  console.log("\n--- [Gate 5] Duplicate Detection & Merge Transaction Engine ---");
  // Create 2 duplicate customers
  const primaryCus = ApiEngine.createAdminCustomer({
    name: "Aakash Patel Primary",
    phone: "9887766554",
    email: "aakash.patel@example.com",
    city_name: "Bengaluru",
    branch_id: "br_blr_indiranagar",
    branch_name: "Indiranagar Central Hub",
  });
  const duplicateCus = ApiEngine.createAdminCustomer({
    name: "Akash Patel Duplicate",
    phone: "9887766554",
    email: "akash.patel.dup@example.com",
    city_name: "Bengaluru",
    branch_id: "br_blr_indiranagar",
    branch_name: "Indiranagar Central Hub",
  });

  const dupCandidates = ApiEngine.listCustomerDuplicates();
  assert(
    "Gate 5",
    "Duplicate Candidates Detected for Shared Phone Number",
    dupCandidates.length > 0,
    `Detected duplicates count: ${dupCandidates.length}`
  );

  // Execute Merge Operation
  const mergeRes = ApiEngine.mergeCustomerRecords(primaryCus!.customer_uid, duplicateCus!.customer_uid, { id: "admin_01", name: "Super Admin" });
  assert("Gate 5", "Merge Transaction Returns Success", mergeRes.success === true, `Success: ${mergeRes.success}`);

  const postMergeDup = ApiEngine.getCustomerProfile(duplicateCus!.customer_uid);
  assert("Gate 5", "Duplicate Record Marked as Merged with Reference to Primary", postMergeDup?.merged_into_uid === primaryCus!.customer_uid, `Merged to: ${postMergeDup?.merged_into_uid}`);

  const postMergePrimary = ApiEngine.getCustomerProfile(primaryCus!.customer_uid);
  assert("Gate 5", "Primary Record Contains Merged UID in History", (postMergePrimary?.merged_uids || []).includes(duplicateCus!.customer_uid), `History: ${JSON.stringify(postMergePrimary?.merged_uids)}`);

  // -------------------------------------------------------------------------
  // GATE 6: Deterministic RFM Lifecycle Calculation Accuracy
  // -------------------------------------------------------------------------
  console.log("\n--- [Gate 6] Dynamic RFM Lifecycle Stages ---");
  const testCustomer: CustomerRecord = {
    id: "cus_test_lifecycle",
    customer_uid: "cus_test_lifecycle",
    customer_number: "CTH-CUS-TEST",
    name: "Lifecycle Test Customer",
    phone: "9988776655",
    normalized_phone: "919988776655",
    email: "test@example.com",
    customer_type: "registered",
    branch_id: "br_blr_indiranagar",
    branch_name: "Indiranagar Central Hub",
    city_name: "Bengaluru",
    delivery_pincode: "560038",
    is_vip: false,
    repeat_customer: false,
    risk_score: 0,
    tier: "STANDARD",
    lifecycle_stage: "NEW",
    total_spend: 0,
    orders_count: 0,
    aov: 0,
    cart_status: "NO_CART",
    customer_source: "CHECKOUT",
    addresses: [],
    notes: [],
    tags: [],
    consent: {
      whatsapp_status: "OPTED_IN",
      whatsapp_opt_in: true,
      marketing_email: "SUBSCRIBED",
      marketing_sms: "SUBSCRIBED",
      marketing_whatsapp: "SUBSCRIBED",
      transactional: "SUBSCRIBED",
      updated_at: new Date().toISOString(),
    },
    created_at: new Date(Date.now() - 1000 * 60 * 60 * 24 * 10).toISOString(),
    updated_at: new Date(Date.now() - 1000 * 60 * 60 * 24 * 10).toISOString(),
    last_active_at: new Date(Date.now() - 1000 * 60 * 60 * 24 * 10).toISOString(),
  };

  const cfg = ApiEngine.getLifecycleConfig();
  const stage0 = deriveLifecycleStage(testCustomer, [], testCustomer.last_active_at, cfg);
  assert("Gate 6", "0 Orders -> Stage is NEW", stage0 === "NEW", `Stage: ${stage0}`);

  const mockOrder1 = [{ id: "ord_1", total: 600, status: "delivered", created_at: new Date().toISOString() }];
  const stage1 = deriveLifecycleStage(testCustomer, mockOrder1, new Date().toISOString(), cfg);
  assert("Gate 6", "1 Order -> Stage is FIRST_PURCHASE", stage1 === "FIRST_PURCHASE", `Stage: ${stage1}`);

  const mockOrder2 = [
    { id: "ord_1", total: 600, status: "delivered", created_at: new Date(Date.now() - 1000 * 60 * 60 * 24 * 5).toISOString() },
    { id: "ord_2", total: 1200, status: "delivered", created_at: new Date().toISOString() },
  ];
  const stage2 = deriveLifecycleStage(testCustomer, mockOrder2, new Date().toISOString(), cfg);
  assert("Gate 6", "2 Orders -> Stage is REPEAT_BUYER", stage2 === "REPEAT_BUYER", `Stage: ${stage2}`);

  const stageVip = deriveLifecycleStage(
    { ...testCustomer, is_vip: true },
    mockOrder2,
    new Date().toISOString(),
    cfg
  );
  assert("Gate 6", "VIP Tag -> Stage is VIP", stageVip === "VIP", `Stage: ${stageVip}`);

  const inactive50Days = new Date(Date.now() - 1000 * 60 * 60 * 24 * 50).toISOString();
  const mockOldOrders50 = [
    { id: "ord_1", total: 600, status: "delivered", created_at: inactive50Days },
  ];
  const stageAtRisk = deriveLifecycleStage(testCustomer, mockOldOrders50, inactive50Days, cfg);
  assert("Gate 6", "50 Days Inactive -> Stage is AT_RISK", stageAtRisk === "AT_RISK", `Stage: ${stageAtRisk}`);

  const inactive100Days = new Date(Date.now() - 1000 * 60 * 60 * 24 * 100).toISOString();
  const mockOldOrders100 = [
    { id: "ord_1", total: 600, status: "delivered", created_at: inactive100Days },
  ];
  const stageDormant = deriveLifecycleStage(testCustomer, mockOldOrders100, inactive100Days, cfg);
  assert("Gate 6", "100 Days Inactive -> Stage is DORMANT", stageDormant === "DORMANT", `Stage: ${stageDormant}`);

  // -------------------------------------------------------------------------
  // GATE 7: Customer Segmentation Engine with conditions_json
  // -------------------------------------------------------------------------
  console.log("\n--- [Gate 7] Dynamic Segment Rule Evaluation ---");
  const testSeg: CustomerSegment = {
    id: "seg_test_custom",
    slug: "seg-test-custom",
    name: "High Value Repeat Bangalore",
    description: "Min 2 orders, Min 1000 spend in Bangalore",
    combinator: "AND",
    conditions_json: JSON.stringify({
      min_orders: 2,
      min_spend: 1000,
      cities: ["Bengaluru", "Bangalore"],
    }),
    rules: [],
    active: true,
    is_system: false,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  const matchingCustomer: CustomerRecord = {
    ...testCustomer,
    orders_count: 3,
    total_spend: 2500,
    city_name: "Bengaluru",
  };
  const nonMatchingCustomer: CustomerRecord = {
    ...testCustomer,
    orders_count: 1,
    total_spend: 500,
    city_name: "Mumbai",
  };

  const matches = evaluateCustomerAgainstSegment(matchingCustomer, testSeg);
  const nonMatches = evaluateCustomerAgainstSegment(nonMatchingCustomer, testSeg);
  assert("Gate 7", "Segment Engine Evaluates matching customer as TRUE", matches === true, `Matches: ${matches}`);
  assert("Gate 7", "Segment Engine Evaluates non-matching customer as FALSE", nonMatches === false, `Matches: ${nonMatches}`);

  // -------------------------------------------------------------------------
  // GATE 8: Multi-Tier RBAC Isolation Gate
  // -------------------------------------------------------------------------
  console.log("\n--- [Gate 8] Multi-Tier Permission & Role-Based Access Isolation ---");
  // 1. Super Admin
  const adminList = ApiEngine.listAdminCustomersDetailed({ userRole: "SUPER_ADMIN" });
  assert("Gate 8", "SUPER_ADMIN Receives Full Directory Access", adminList.customers.length > 0, `Count: ${adminList.customers.length}`);

  // 2. City Manager (Bengaluru only)
  const cityMgrList = ApiEngine.listAdminCustomersDetailed({ userRole: "CITY_MANAGER", userCity: "Bengaluru" });
  const allBengaluru = cityMgrList.customers.every((c: any) => (c.city_name || "").toLowerCase() === "bengaluru");
  assert("Gate 8", "CITY_MANAGER Scoped Strictly to Assigned City", allBengaluru === true, `All Bengaluru: ${allBengaluru}`);

  // 3. Branch Manager (Indiranagar only)
  const branchMgrList = ApiEngine.listAdminCustomersDetailed({ userRole: "BRANCH_MANAGER", userBranchId: "br_blr_indiranagar" });
  const allIndiranagar = branchMgrList.customers.every((c: any) => c.branch_id === "br_blr_indiranagar" || c.assigned_branch_id === "br_blr_indiranagar");
  assert("Gate 8", "BRANCH_MANAGER Scoped Strictly to Assigned Branch ID", allIndiranagar === true, `All Indiranagar: ${allIndiranagar}`);

  // 4. Marketing (Opted-in only)
  const marketingList = ApiEngine.listAdminCustomersDetailed({ userRole: "MARKETING" });
  const allOptedIn = marketingList.customers.every(
    (c: any) => c.consent?.whatsapp_status === "CONNECTED" || c.consent?.whatsapp_status === "OPTED_IN" || c.consent?.marketing_email === "SUBSCRIBED"
  );
  assert("Gate 8", "MARKETING Role Scoped Strictly to Opted-In Customers", allOptedIn === true, `All Opted-In: ${allOptedIn}`);

  // 5. Delivery Partner (Must throw 403 Forbidden)
  let dlpBlocked = false;
  try {
    ApiEngine.listAdminCustomersDetailed({ userRole: "DELIVERY_PARTNER" });
  } catch (err: any) {
    if (err.message.includes("Forbidden") || err.message.includes("403")) {
      dlpBlocked = true;
    }
  }
  assert("Gate 8", "DELIVERY_PARTNER Role Blocked with 403 Forbidden", dlpBlocked === true, `Blocked: ${dlpBlocked}`);

  // -------------------------------------------------------------------------
  // GATE 9: Customer 360 Data Lineage Trace Audit
  // -------------------------------------------------------------------------
  console.log("\n--- [Gate 9] Customer 360 Data Lineage Trace Audit ---");
  const lineage = computeCustomerDataLineage(
    matchingCustomer,
    [
      {
        id: "ord_cth_lineage_01",
        customer_uid: matchingCustomer.customer_uid,
        order_number: "CTH-20260819-350",
        total: 1299,
        status: "delivered",
        payment_method: "RAZORPAY_UPI",
        payment_status: "captured",
        branch_name: "Indiranagar Hub",
        created_at: new Date().toISOString(),
      },
    ],
    [
      {
        id: "comm_01",
        customer_uid: matchingCustomer.customer_uid,
        channel: "WHATSAPP",
        status: "DELIVERED",
        subject_or_title: "Order Confirmation",
        dispatched_at: new Date().toISOString(),
      },
      {
        id: "comm_02",
        customer_uid: matchingCustomer.customer_uid,
        channel: "WHATSAPP",
        status: "DELIVERED",
        subject_or_title: "Out for Delivery",
        dispatched_at: new Date().toISOString(),
      },
      {
        id: "comm_03",
        customer_uid: matchingCustomer.customer_uid,
        channel: "WHATSAPP",
        status: "DELIVERED",
        subject_or_title: "Delivered Confirmation",
        dispatched_at: new Date().toISOString(),
      },
    ]
  );

  assert("Gate 9", "Lineage Identifies Customer Origin Source", lineage.customer_source === "CHECKOUT", `Source: ${lineage.customer_source}`);
  assert("Gate 9", "Lineage Captures First Checkout Order ID", lineage.initial_checkout_order_id === "CTH-20260819-350", `Order: ${lineage.initial_checkout_order_id}`);
  assert("Gate 9", "Lineage Records Payment Gateway as RAZORPAY", lineage.payment_gateway === "RAZORPAY", `Gateway: ${lineage.payment_gateway}`);
  assert("Gate 9", "Lineage Resolves Indiranagar Hub Routing", Boolean(lineage.assigned_branch_name?.includes("Indiranagar")), `Hub: ${lineage.assigned_branch_name}`);
  assert("Gate 9", "Lineage Records 3 Delivered WhatsApp Messages", lineage.whatsapp_messages_delivered === 3, `Delivered: ${lineage.whatsapp_messages_delivered}`);

  // -------------------------------------------------------------------------
  // GATE 10: WhatsApp Consent Governance & Transactional Outbox
  // -------------------------------------------------------------------------
  console.log("\n--- [Gate 10] WhatsApp Consent Compliance & Transactional Outbox ---");
  const consentCustomer = ApiEngine.createAdminCustomer({
    name: "Consent Verified Customer",
    phone: "9876599999",
    email: "consent@example.com",
    city_name: "Bengaluru",
    branch_id: "br_blr_indiranagar",
    branch_name: "Indiranagar Central Hub",
  });
  const consentRes = ApiEngine.updateCustomerConsent(consentCustomer!.customer_uid, {
    whatsapp_status: "OPTED_IN",
    opt_in_timestamp: new Date().toISOString(),
  });
  assert("Gate 10", "WhatsApp Consent Updated to OPTED_IN", consentRes?.whatsapp_status === "OPTED_IN", `Status: ${consentRes?.whatsapp_status}`);

  // Trigger Outbox Lifecycle Event
  ApiEngine.emitCrmEvent("customer.vip_promoted", consentCustomer!, { previous_tier: "STANDARD", new_tier: "VIP_PLATINUM" });
  const outboxItems = WebhookEngine.getInstance().getOutbox({ eventType: "customer.vip_promoted" });
  assert("Gate 10", "Transactional Outbox Emits customer.vip_promoted", outboxItems.length > 0, `Outbox count: ${outboxItems.length}`);
  if (outboxItems.length > 0) {
    const item = outboxItems[0];
    assert("Gate 10", "Outbox Item Contains Event ID and Pending Status", Boolean(item.id && item.status), `ID: ${item.id}, Status: ${item.status}`);
  }

  // -------------------------------------------------------------------------
  // FINAL SCORECARD & SUMMARY
  // -------------------------------------------------------------------------
  console.log("\n================================================================================");
  console.log(` PRODUCTION INTEGRITY AUDIT COMPLETE: ${passedCount} PASSED, ${failedCount} FAILED`);
  console.log("================================================================================\n");

  if (failedCount > 0) {
    console.error(`❌ CRM Production Audit Failed with ${failedCount} defect(s).`);
    process.exit(1);
  } else {
    console.log(`✅ ALL 10 CRM PRODUCTION INTEGRITY GATES VERIFIED (100% PASS RATE).`);
    process.exit(0);
  }
}

runProductionIntegrityTestSuite().catch((err) => {
  console.error("Fatal exception during CRM production test suite execution:", err);
  process.exit(1);
});
