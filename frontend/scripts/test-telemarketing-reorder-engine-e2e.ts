import { TelemarketingEngine } from "../src/lib/telemarketing-engine";
import { ApiEngine } from "../src/lib/api-engine";
import { StaffAccessControl } from "../src/lib/staff-access-control";
import { TelemarketingExportService } from "../src/lib/telemarketing-export-service";
import { normalizePhone, formatDisplayPhone } from "../src/lib/crm/crm-engine";

let passedCount = 0;
let failedCount = 0;

function assert(condition: boolean, testName: string, details?: any) {
  if (condition) {
    console.log(`  ✓ [PASS] ${testName}`);
    passedCount++;
  } else {
    console.error(`  ✗ [FAIL] ${testName}`);
    if (details) console.error("    Details:", details);
    failedCount++;
  }
}

async function runTelemarketingMasterTestSuite() {
  console.log("\n" + "=".repeat(80));
  console.log("CAKETOHOME TELEMARKETING REORDER & REACTIVATION INTELLIGENCE — E2E SUITE");
  console.log("=".repeat(80) + "\n");

  // ── GROUP 1: CANONICAL CUSTOMER IDENTITY & PROFILE INTEGRATION ──
  console.log("1. Testing Canonical Customer Identity & Profile Integration");
  const candidates = TelemarketingEngine.listCandidates({ limit: 50 }).candidates;
  assert(candidates.length > 0, "Telemarketing opportunity pool contains active candidates", { count: candidates.length });

  const firstCand = candidates[0];
  assert(Boolean(firstCand.customer_uid), "Candidate has valid canonical customer_uid", { customer_uid: firstCand.customer_uid });
  assert(firstCand.customer_uid.startsWith("cth_cus_") || firstCand.customer_uid.startsWith("cus_"), "customer_uid follows canonical format", { uid: firstCand.customer_uid });

  const resolvedByUid = TelemarketingEngine.getCandidateByCustomerUid(firstCand.customer_uid);
  assert(Boolean(resolvedByUid) && resolvedByUid?.id === firstCand.id, "getCandidateByCustomerUid resolves exact matching opportunity", { id: resolvedByUid?.id });

  const custProfile = ApiEngine.getCustomerProfile(firstCand.customer_uid);
  if (custProfile) {
    assert(
      custProfile.customer_uid === firstCand.customer_uid || normalizePhone(custProfile.phone) === normalizePhone(firstCand.customer_phone),
      "Customer 360 profile resolves with matching canonical customer identity",
      { profileUid: custProfile.customer_uid, candUid: firstCand.customer_uid }
    );
    assert(Boolean(custProfile.reorder_opportunity), "Customer 360 profile includes linked reorder_opportunity");
  } else {
    const newCust = ApiEngine.findOrCreateCustomerByPhone({
      name: firstCand.customer_name,
      phone: firstCand.customer_phone,
      email: firstCand.customer_email || undefined,
    });
    if (newCust) {
      const profile = ApiEngine.getCustomerProfile(newCust.customer_uid);
      assert(Boolean(profile), "Created canonical profile and resolved Customer 360 link", { uid: profile?.customer_uid });
      assert(Boolean(profile?.reorder_opportunity), "Customer 360 profile includes linked reorder_opportunity");
    }
  }

  // ── GROUP 2: COMPLETED ORDERS EVALUATION & IDEMPOTENCY ──
  console.log("\n2. Testing Real Completed Orders Evaluation & Idempotency");
  const testHistoricalOrders = [
    {
      id: "ord_test_anniversary_01",
      order_number: "CTH-ORD-TEST-01",
      customer_uid: "cth_cus_9887766554",
      customer_name: "Kavita Reddy",
      customer_phone: "+91 98877 66554",
      customer_email: "kavita.r@example.com",
      city: "Bengaluru",
      city_id: "bengaluru",
      area: "Koramangala",
      pincode: "560034",
      branch_id: "res_01KXYMAHGFPRY1G9TZKEVGAGAT",
      branch_name: "Indiranagar Flagship Kitchen",
      order_date: "2025-08-19T15:00:00.000Z",
      order_status: "COMPLETED",
      items: [
        {
          product_id: "prod_belgian_truffle",
          name: "Belgian Dark Chocolate Truffle Cake (1 Kg)",
          price: 1299,
          quantity: 1,
        }
      ],
      occasion: "Birthday Celebration",
      total: 1299,
    },
    {
      id: "ord_test_anniversary_02",
      order_number: "CTH-ORD-TEST-02",
      customer_uid: "cth_cus_9112233445",
      customer_name: "Rohan Nair",
      customer_phone: "+91 91122 33445",
      customer_email: "rohan.n@example.com",
      city: "Bengaluru",
      city_id: "bengaluru",
      area: "Indiranagar",
      pincode: "560038",
      branch_id: "res_01KXYMAHGFPRY1G9TZKEVGAGAT",
      branch_name: "Indiranagar Flagship Kitchen",
      order_date: "2025-08-21T18:30:00.000Z",
      order_status: "COMPLETED",
      items: [
        {
          product_id: "prod_red_velvet",
          name: "Red Velvet Cream Cheese Heart Cake (1 Kg)",
          price: 1199,
          quantity: 1,
        }
      ],
      occasion: "Wedding Anniversary",
      total: 1199,
    },
  ];

  // First Run
  const evalRun1 = TelemarketingEngine.evaluateHistoricalOrders(testHistoricalOrders, "2026-08-17");
  assert(evalRun1.evaluated === 2, "Scanned 2 completed test orders", { evaluated: evalRun1.evaluated });
  assert(evalRun1.new_candidates >= 1, "Identified and generated new reorder candidates", { new: evalRun1.new_candidates });

  // Second Run (Strict Idempotency Check)
  const evalRun2 = TelemarketingEngine.evaluateHistoricalOrders(testHistoricalOrders, "2026-08-17");
  assert(evalRun2.new_candidates === 0, "Idempotent execution: 0 duplicate candidates created on second evaluation", { new: evalRun2.new_candidates, updated: evalRun2.updated_candidates });

  // ── GROUP 3: 5-SIGNAL DETERMINISTIC SCORING ENGINE ──
  console.log("\n3. Testing 5-Signal Deterministic Scoring Engine");
  const scoreBreakdown = TelemarketingEngine.calculateDeterministicScore({
    daysDiff: 2, // Within 3 days
    occasion: "Birthday Celebration",
    historicalOrderCount: 4,
    repeatPurchaseCount: 3,
    lifetimeSpend: 5500,
    aov: 1375,
    marketingConsent: true,
  });

  assert(scoreBreakdown.timing_score === 30, "Timing Match score gives max 30 pts for ±2 days window", { timing: scoreBreakdown.timing_score });
  assert(scoreBreakdown.occasion_score === 25, "Occasion score gives max 25 pts for explicit Birthday Celebration", { occasion: scoreBreakdown.occasion_score });
  assert(scoreBreakdown.purchase_frequency_score === 20, "Frequency score gives max 20 pts for 4+ orders", { freq: scoreBreakdown.purchase_frequency_score });
  assert(scoreBreakdown.customer_value_score === 15, "Customer Value score gives max 15 pts for LTV > ₹5,000", { val: scoreBreakdown.customer_value_score });
  assert(scoreBreakdown.engagement_score === 10, "Engagement score gives max 10 pts for active consent", { eng: scoreBreakdown.engagement_score });
  assert(scoreBreakdown.total === 100, "5-signal composite score sums correctly to 100", { total: scoreBreakdown.total });

  // Lower tier check
  const lowerScore = TelemarketingEngine.calculateDeterministicScore({
    daysDiff: 12,
    occasion: "Family Gathering",
    historicalOrderCount: 1,
    repeatPurchaseCount: 0,
    lifetimeSpend: 799,
    aov: 799,
    marketingConsent: true,
  });
  assert(lowerScore.total < 70, "Standard order yields lower score", { total: lowerScore.total });

  // ── GROUP 4: EXPECTED DATE, CONFIDENCE & SAFE PITCH GENERATION ──
  console.log("\n4. Testing Expected Date & Customer-Safe Pitch Generation");
  const pitchRes = TelemarketingEngine.generateSafePitch({
    customerName: "Priya Sharma",
    productName: "Belgian Dark Chocolate Truffle Cake (1 Kg)",
    occasion: "Birthday Celebration",
    orderDateStr: "18 Aug 2025",
    opportunityType: "BIRTHDAY_REORDER",
    cityName: "Bengaluru",
  });

  assert(pitchRes.pitch.includes("Priya"), "Pitch uses real customer first name");
  assert(pitchRes.pitch.includes("Belgian Dark Chocolate Truffle Cake"), "Pitch references real prior product");
  assert(pitchRes.pitch.includes("birthday"), "Pitch references real occasion");
  assert(!pitchRes.pitch.includes("husband") && !pitchRes.pitch.includes("son"), "Safe pitch does NOT invent family relations or unverified promises");

  // ── GROUP 5: STAFF ACCESS CONTROL & TELECALLER ASSIGNMENT ──
  console.log("\n5. Testing Staff Access Control & Telecaller Assignment");
  const staffMembers = StaffAccessControl.listStaffMembers();
  assert(staffMembers.length > 0, "Staff access profile system returns active staff", { count: staffMembers.length });

  const testCand = candidates[0];
  const assignedCand = TelemarketingEngine.assignCandidate(testCand.id, "staff_01", "Priya Sharma");
  assert(assignedCand.assigned_staff_id === "staff_01", "Assigned staff_id updated");
  assert(assignedCand.assigned_to === "Priya Sharma", "Assigned staff name updated");
  assert(assignedCand.call_notes.some((n) => n.note.includes("Priya Sharma")), "Assignment logged in audit notes");

  // ── GROUP 6: CALL LOGGING & FOLLOW-UP SCHEDULING ──
  console.log("\n6. Testing Call Logging & Follow-Up Scheduling");
  const tomorrowStr = new Date(Date.now() + 86400000).toISOString().slice(0, 10);
  const loggedCand = TelemarketingEngine.logCall({
    candidateId: testCand.id,
    outcome: "FOLLOW_UP",
    note: "Customer is traveling today. Requested call tomorrow afternoon for party planning.",
    staffId: "staff_01",
    staffName: "Priya Sharma",
    nextFollowupDate: tomorrowStr,
  });

  assert(loggedCand.contact_status === "FOLLOW_UP", "Status transitioned to FOLLOW_UP");
  assert(loggedCand.next_followup_date === tomorrowStr, "Next follow-up date scheduled correctly", { date: loggedCand.next_followup_date });
  assert(loggedCand.call_notes.length > 0, "Call note stored in history timeline");
  assert(loggedCand.call_notes[0].note.includes("traveling today"), "Call note text preserved");

  // ── GROUP 7: ORDER CONVERSION & ATTRIBUTED REVENUE ──
  console.log("\n7. Testing Order Conversion & Attributed Revenue");
  const initialMetrics = TelemarketingEngine.getCandidateMetrics();
  const attributedCand = TelemarketingEngine.recordAttributedOrder(testCand.id, "ord_test_conv_9999", 1599);

  assert(attributedCand.contact_status === "CONVERTED", "Opportunity status updated to CONVERTED");
  assert(attributedCand.converted_order_id === "ord_test_conv_9999", "converted_order_id stamped");
  assert(attributedCand.conversion_value === 1599, "conversion_value attributed accurately (₹1,599)", { rev: attributedCand.conversion_value });

  const updatedMetrics = TelemarketingEngine.getCandidateMetrics();
  assert(updatedMetrics.revenue_generated >= initialMetrics.revenue_generated + 1599, "Executive metrics reflect attributed revenue increase", {
    prev: initialMetrics.revenue_generated,
    curr: updatedMetrics.revenue_generated,
  });

  // Test automatic checkout matching
  const matched = TelemarketingEngine.matchAndAttributeCheckoutOrder(candidates[1].customer_uid, "ord_auto_conv_888", 1299);
  assert(matched === true, "matchAndAttributeCheckoutOrder matches active outreach opportunity for customer_uid");

  // ── GROUP 8: SERVER-SIDE FILTERS & EXCEL EXPORTS ──
  console.log("\n8. Testing Server-Side Filters & Excel Exports");
  const highPriorityList = TelemarketingEngine.listCandidates({ priority: "HIGH" });
  assert(highPriorityList.candidates.every((c) => c.priority === "HIGH"), "Priority filter returns strictly HIGH priority candidates");

  const searchList = TelemarketingEngine.listCandidates({ search: "Priya" });
  assert(searchList.candidates.some((c) => c.customer_name.toLowerCase().includes("priya")), "Search matches customer name");

  const callingListRes = await TelemarketingExportService.generateTelecallerCallingList();
  assert(callingListRes.buffer.byteLength > 1000, "Generated valid Telecaller Calling List Excel buffer", { bytes: callingListRes.buffer.byteLength });

  const masterWorkbookRes = await TelemarketingExportService.generateExcelWorkbook();
  assert(masterWorkbookRes.buffer.byteLength > 2000, "Generated valid Master 6-Sheet Telemarketing Workbook Excel buffer", { bytes: masterWorkbookRes.buffer.byteLength });

  // ── SUMMARY ──
  console.log("\n" + "=".repeat(80));
  console.log(`TOTAL TESTS: ${passedCount + failedCount} | PASSED: ${passedCount} | FAILED: ${failedCount}`);
  if (failedCount === 0) {
    console.log("RESULT: ALL TELEMARKETING REORDER TESTS PASSED (100% SUCCESS) ✨");
  } else {
    console.error("RESULT: SOME TESTS FAILED");
    process.exit(1);
  }
  console.log("=".repeat(80) + "\n");
}

runTelemarketingMasterTestSuite().catch((err) => {
  console.error("Test Suite Execution Failed:", err);
  process.exit(1);
});
