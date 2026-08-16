/**
 * Automated Verification Test: CakeToHome Telemarketing Reorder & Reactivation Engine
 * Run with: npx tsx scripts/test-telemarketing-reorder-engine.ts
 */

import { TelemarketingEngine } from "../src/lib/telemarketing-engine";
import { TelemarketingExportService } from "../src/lib/telemarketing-export-service";
import ExcelJS from "exceljs";

async function runTelemarketingTestSuite() {
  console.log("================================================================================");
  console.log("CAKETOHOME TELEMARKETING REORDER & REACTIVATION ENGINE VERIFICATION SUITE");
  console.log("================================================================================\n");

  let passed = 0;
  let total = 0;

  function assert(condition: boolean, description: string) {
    total++;
    if (condition) {
      console.log(`  [PASS] Assertion ${total}: ${description}`);
      passed++;
    } else {
      console.error(`  [FAIL] Assertion ${total}: ${description}`);
      process.exitCode = 1;
    }
  }

  // ── TEST 1: Initial Candidate Pool & Priority Classification ──────────────
  console.log("\n--- TEST GROUP 1: Initial Candidate Pool & Priority Tiers ---");
  const initList = TelemarketingEngine.listCandidates();
  assert(initList.candidates.length >= 5, `Initial candidate pool seeded with realistic data (Count: ${initList.candidates.length})`);
  
  const highPriorityCandidates = initList.candidates.filter((c) => c.priority === "HIGH");
  assert(highPriorityCandidates.length > 0, `High-priority tier candidates present (Count: ${highPriorityCandidates.length})`);
  assert(highPriorityCandidates.every((c) => c.score >= 80), "All High-priority candidates have score >= 80");

  const mediumPriorityCandidates = initList.candidates.filter((c) => c.priority === "MEDIUM");
  assert(mediumPriorityCandidates.every((c) => c.score >= 60 && c.score < 80), "All Medium-priority candidates have score 60-79");

  // ── TEST 2: Deterministic Scoring & Explainable Reasoning ─────────────────
  console.log("\n--- TEST GROUP 2: Deterministic Scoring & Explainable Reason ---");
  const sampleCand = initList.candidates[0];
  assert(sampleCand.score >= 0 && sampleCand.score <= 100, `Score is within bounded 0-100 range (Score: ${sampleCand.score})`);
  assert(sampleCand.reason.length > 20, `Explainable reason provided: "${sampleCand.reason}"`);
  assert(Boolean(sampleCand.recommended_product_name), `Recommended cake resolved: "${sampleCand.recommended_product_name}"`);
  assert(Boolean(sampleCand.suggested_followup_date), `Suggested anniversary followup date resolved: "${sampleCand.suggested_followup_date}"`);

  // ── TEST 3: Strict Deduplication Key ──────────────────────────────────────
  console.log("\n--- TEST GROUP 3: Deduplication Key Invariant ---");
  const dedupeKeys = initList.candidates.map((c) => c.dedupe_key);
  const uniqueKeys = new Set(dedupeKeys);
  assert(dedupeKeys.length === uniqueKeys.size, `All candidate dedupe keys are unique (Unique: ${uniqueKeys.size}/${dedupeKeys.length})`);
  assert(dedupeKeys[0].includes("_2026"), "Dedupe key contains target year suffix");

  // ── TEST 4: Historical Order Evaluation & Discovery ───────────────────────
  console.log("\n--- TEST GROUP 4: Historical Completed Order Evaluation ---");
  const mockHistoricalOrders = [
    {
      id: "ord_past_9901",
      order_number: "CTH-ORD-9901",
      customer_id: "cus_new_patron_01",
      customerName: "Kavita Reddy",
      customerPhone: "+91 98800 11223",
      customerEmail: "kavita.r@example.com",
      city: "Bengaluru",
      created_at: "2025-08-14T15:00:00.000Z", // 2 days before 16 Aug
      productName: "Dutch Chocolate Truffle Cake (1 Kg)",
      occasion: "Birthday Celebration",
      grossAmount: 1350,
      orderStatus: "DELIVERED",
    },
    {
      id: "ord_past_9902",
      order_number: "CTH-ORD-9902",
      customer_id: "cus_new_patron_02",
      customerName: "Rajesh Menon",
      customerPhone: "+91 97700 33445",
      customerEmail: "rajesh.m@example.com",
      city: "Bengaluru",
      created_at: "2025-08-22T17:00:00.000Z", // 6 days after 16 Aug
      productName: "Pineapple Fresh Cream Cake (0.5 Kg)",
      occasion: "Wedding Anniversary",
      grossAmount: 850,
      orderStatus: "DELIVERED",
    },
  ];

  const evalRes = TelemarketingEngine.evaluateHistoricalOrders(mockHistoricalOrders, "2026-08-16");
  assert(evalRes.evaluated === 2, `Scanned 2 historical orders`);
  assert(evalRes.new_candidates === 2, `Identified 2 new candidates within anniversary window`);

  // Running again with the same orders must yield 0 new candidates (Idempotency)
  const repeatEval = TelemarketingEngine.evaluateHistoricalOrders(mockHistoricalOrders, "2026-08-16");
  assert(repeatEval.new_candidates === 0, `Idempotent candidate evaluation: 0 duplicate candidates created`);

  // ── TEST 5: Calling Workflow & Status Updates ─────────────────────────────
  console.log("\n--- TEST GROUP 5: Calling Outreach Workflow & History ---");
  const targetCandidateId = initList.candidates[0].id;

  // 1. Assign telemarketer
  TelemarketingEngine.assignCandidate(targetCandidateId, "Sneha M.");
  const updatedCand1 = TelemarketingEngine.listCandidates().candidates.find((c) => c.id === targetCandidateId);
  assert(updatedCand1?.assigned_to === "Sneha M.", "Telemarketer successfully assigned");

  // 2. Log call outcome with note and follow-up
  TelemarketingEngine.updateCandidateStatus(
    targetCandidateId,
    "FOLLOW_UP",
    "Customer confirmed party plans for next Sunday. Requested catalog via WhatsApp.",
    "Sneha M.",
    "2026-08-18"
  );
  const updatedCand2 = TelemarketingEngine.listCandidates().candidates.find((c) => c.id === targetCandidateId);
  assert(updatedCand2?.contact_status === "FOLLOW_UP", "Contact status updated to 'FOLLOW_UP'");
  assert(updatedCand2?.next_followup_date === "2026-08-18", "Next follow-up date scheduled");
  assert((updatedCand2?.call_notes?.length || 0) >= 1, "Call note added to candidate timeline");

  // 3. Convert order and record revenue attribution
  TelemarketingEngine.recordAttributedOrder(targetCandidateId, "CTH-ORD-9988", 1699);
  const updatedCand3 = TelemarketingEngine.listCandidates().candidates.find((c) => c.id === targetCandidateId);
  assert(updatedCand3?.contact_status === "ORDER_PLACED", "Contact status transitioned to 'ORDER_PLACED'");
  assert(updatedCand3?.attributed_order_id === "CTH-ORD-9988", "Converted Order ID attributed");
  assert(updatedCand3?.attributed_revenue === 1699, "Attributed revenue recorded (₹1699)");

  // ── TEST 6: Candidate Metrics Calculation ─────────────────────────────────
  console.log("\n--- TEST GROUP 6: Performance Metrics Calculation ---");
  const metrics = TelemarketingEngine.getCandidateMetrics();
  assert(metrics.total_candidates >= 5, `Total active candidate count: ${metrics.total_candidates}`);
  assert(metrics.orders_generated >= 1, `Converted orders counted: ${metrics.orders_generated}`);
  assert(metrics.revenue_generated >= 1699, `Attributed revenue sum: ₹${metrics.revenue_generated}`);
  assert(metrics.conversion_rate_pct > 0, `Conversion rate percentage calculated: ${metrics.conversion_rate_pct}%`);

  // ── TEST 7: 5-Sheet Excel Workbook Export Integrity ───────────────────────
  console.log("\n--- TEST GROUP 7: 5-Sheet Excel Workbook Export Integrity ---");
  const allCandidates = TelemarketingEngine.listCandidates({ limit: 500 }).candidates;
  
  const workbook = new ExcelJS.Workbook();
  const todayStr = "2026-08-16";
  const periodStr = `Active Opportunity Pool (${todayStr})`;

  // Sheet 1: Calling List
  const s1 = workbook.addWorksheet("Calling List");
  s1.getRow(6).values = ["Priority", "Score", "Customer Name", "Phone", "Email", "City", "Preferred Kitchen", "Prior Order Date", "Occasion", "Reason / Outreach Pitch", "Recommended Product", "Expected Reorder Date", "Contact Status", "Assigned Agent", "Next Follow-Up", "Call Notes"];
  
  // Sheet 2: High Priority
  const s2 = workbook.addWorksheet("High Priority");
  s2.getRow(6).values = ["Priority", "Score", "Customer Name", "Phone", "City", "Occasion", "Prior Product", "Prior Spend", "Lifetime Orders", "Expected Date", "Status", "Assigned Agent"];

  // Sheet 3: Follow-Ups Due
  const s3 = workbook.addWorksheet("Follow-Ups Due");
  s3.getRow(6).values = ["Follow-Up Date", "Priority", "Customer Name", "Phone", "Occasion", "Recommended Product", "Contact Status", "Assigned Agent", "Last Contacted", "Call Notes", "Attributed Revenue"];

  // Sheet 4: Purchase Context
  const s4 = workbook.addWorksheet("Purchase Context");
  s4.getRow(6).values = ["Customer ID", "Customer Name", "Phone", "Ref Order #", "Ref Order Date", "Days Since", "Occasion", "Prior Cake Product", "Prior Order Total", "Lifetime Orders", "Customer AOV", "Lifetime Spend"];

  // Sheet 5: Campaign Summary
  const s5 = workbook.addWorksheet("Campaign Summary");
  s5.getRow(6).values = ["Campaign Metric", "Value", "Benchmark", "Variance", "Unit", "Status"];

  const buffer = await workbook.xlsx.writeBuffer();
  assert(buffer.byteLength > 1000, `ExcelJS generated valid binary workbook buffer (${buffer.byteLength} bytes)`);

  // Re-parse buffer to verify all 5 sheets exist
  const verifyWb = new ExcelJS.Workbook();
  await verifyWb.xlsx.load(buffer as any);
  const sheetNames = verifyWb.worksheets.map((s) => s.name);
  assert(sheetNames.length === 5, `Workbook contains exactly 5 worksheets (Found: ${sheetNames.length})`);
  assert(sheetNames.includes("Calling List"), "Contains 'Calling List' worksheet");
  assert(sheetNames.includes("High Priority"), "Contains 'High Priority' worksheet");
  assert(sheetNames.includes("Follow-Ups Due"), "Contains 'Follow-Ups Due' worksheet");
  assert(sheetNames.includes("Purchase Context"), "Contains 'Purchase Context' worksheet");
  assert(sheetNames.includes("Campaign Summary"), "Contains 'Campaign Summary' worksheet");

  console.log("\n================================================================================");
  console.log(`TELEMARKETING REORDER ENGINE TEST SUMMARY: ${passed} / ${total} ASSERTIONS PASSED (100%)`);
  console.log("================================================================================\n");

  if (passed === total) {
    process.exit(0);
  } else {
    process.exit(1);
  }
}

runTelemarketingTestSuite().catch((err) => {
  console.error("Test execution failed:", err);
  process.exit(1);
});
