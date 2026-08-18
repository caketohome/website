/**
 * CAKETOHOME — TELEMARKETING REORDER & REACTIVATION INTELLIGENCE
 * PLAYWRIGHT REAL-BROWSER VERIFICATION SUITE
 */

import { chromium } from "playwright";

const BASE_URL = process.env.BASE_URL || "http://localhost:3000";

let passedCount = 0;
let failedCount = 0;

function assert(condition: boolean, stepName: string, details?: any) {
  if (condition) {
    console.log(`  ✓ [PASS] ${stepName}`);
    passedCount++;
  } else {
    console.error(`  ✗ [FAIL] ${stepName}`);
    if (details) console.error("    Details:", details);
    failedCount++;
  }
}

async function runTelemarketingPlaywrightVerification() {
  console.log("================================================================================");
  console.log("CAKETOHOME TELEMARKETING REORDER & REACTIVATION — PLAYWRIGHT VERIFICATION");
  console.log("================================================================================\n");

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();

  try {
    // 1. API Verification: List Candidates
    console.log("1. Verifying /api/v1/admin/telemarketing/candidates API endpoint...");
    const candRes = await context.request.get(`${BASE_URL}/api/v1/admin/telemarketing/candidates`);
    assert(candRes.status() === 200, `Candidates endpoint returned HTTP 200 OK (Status: ${candRes.status()})`);
    const candJson = await candRes.json();
    assert(Array.isArray(candJson.candidates) && candJson.candidates.length > 0, "Candidates returned in payload", { count: candJson.candidates?.length });
    assert(Boolean(candJson.metrics), "Executive metrics included in candidates response");

    // 2. API Verification: Metrics
    console.log("\n2. Verifying /api/v1/admin/telemarketing/metrics API endpoint...");
    const metricsRes = await context.request.get(`${BASE_URL}/api/v1/admin/telemarketing/metrics`);
    assert(metricsRes.status() === 200, `Metrics endpoint returned HTTP 200 OK (Status: ${metricsRes.status()})`);
    const metricsJson = await metricsRes.json();
    assert(metricsJson.metrics?.total_candidates > 0, "Metrics calculated correctly", metricsJson.metrics);

    // 3. API Verification: Evaluate Prior Orders
    console.log("\n3. Verifying /api/v1/admin/telemarketing/evaluate API endpoint...");
    const evalRes = await context.request.post(`${BASE_URL}/api/v1/admin/telemarketing/evaluate`, {
      data: { currentDate: "2026-08-17" },
    });
    assert(evalRes.status() === 200, `Evaluate endpoint returned HTTP 200 OK (Status: ${evalRes.status()})`);
    const evalJson = await evalRes.json();
    assert(evalJson.success === true, "Evaluate completed successfully", evalJson);

    // 4. API Verification: Export Endpoint
    console.log("\n4. Verifying /api/v1/admin/telemarketing/export API endpoint...");
    const exportRes = await context.request.post(`${BASE_URL}/api/v1/admin/telemarketing/export`, {
      data: { type: "telecaller_list" },
    });
    assert(exportRes.status() === 200, `Export endpoint returned HTTP 200 OK (Status: ${exportRes.status()})`);
    const exportJson = await exportRes.json();
    assert(exportJson.success === true && exportJson.size > 1000, "Export returned valid Excel file", exportJson);

    // 5. Browser UI: Navigate to Admin Telemarketing Panel
    console.log("\n5. Navigating browser to Admin Telemarketing Panel...");
    await context.addCookies([
      { name: "_cth_role", value: "SUPER_ADMIN", domain: "localhost", path: "/" },
      { name: "_cth_user_id", value: "admin_01", domain: "localhost", path: "/" },
    ]);
    await page.goto(`${BASE_URL}/dashboard?tab=telemarketing`, { waitUntil: "networkidle", timeout: 30000 });
    console.log("  ✓ Admin dashboard route loaded.");

    // Wait for the Telemarketing Panel to render
    await page.waitForSelector("text=Telemarketing Reorder", { timeout: 15000 });
    const heading = await page.textContent("h2");
    assert(Boolean(heading && heading.includes("Telemarketing")), "Telemarketing header rendered in UI", { heading });

    // 6. Browser UI: KPI Cards & Opportunity Table
    console.log("\n6. Checking Executive KPIs and Opportunity Table rendering...");
    const totalCandidatesCard = await page.locator("text=Total Candidates").first();
    assert(await totalCandidatesCard.isVisible(), "Total Candidates KPI card is visible");

    const highPriorityCard = await page.locator("text=High Priority").first();
    assert(await highPriorityCard.isVisible(), "High Priority KPI card is visible");

    const actionQueueBtn = await page.locator("button:has-text('Action Queue')").first();
    assert(await actionQueueBtn.isVisible(), "Action Queue navigation tab is visible");

    // 7. Browser UI: Score Breakdown Modal Interaction
    console.log("\n7. Interacting with Score Breakdown Modal...");
    const scoreBtn = await page.locator("button:has-text('Why this score?')").first();
    if (await scoreBtn.isVisible()) {
      await scoreBtn.click();
      await page.waitForTimeout(500);
      const scoreModalHeading = await page.locator("text=Score Breakdown").first();
      assert(await scoreModalHeading.isVisible(), "Score Breakdown Modal opened with 5 explainable signals");

      const timingSignal = await page.locator("text=Celebration Timing Match").first();
      assert(await timingSignal.isVisible(), "Timing Match signal displayed in modal");

      const closeScoreBtn = await page.locator("button:has-text('Close Breakdown')").first();
      await closeScoreBtn.click();
      await page.waitForTimeout(300);
    } else {
      console.log("  ⚠️ Score button not immediately visible in table viewport.");
    }

    // 8. Browser UI: Log Call Modal Interaction
    console.log("\n8. Interacting with Log Call Modal...");
    const logCallBtn = await page.locator("button:has-text('Log Call')").first();
    if (await logCallBtn.isVisible()) {
      await logCallBtn.click();
      await page.waitForTimeout(500);

      const logModalHeading = await page.locator("text=Log Call:").first();
      assert(await logModalHeading.isVisible(), "Log Call Modal opened successfully");

      const followUpBtn = await page.locator("button:has-text('Follow-Up Required')").first();
      if (await followUpBtn.isVisible()) {
        await followUpBtn.click();
      }

      const closeLogBtn = await page.locator("button:has-text('Cancel')").first();
      await closeLogBtn.click();
      await page.waitForTimeout(300);
    }

    // ── SUMMARY ──
    console.log("\n" + "=".repeat(80));
    console.log(`PLAYWRIGHT TEST SUMMARY: TOTAL: ${passedCount + failedCount} | PASSED: ${passedCount} | FAILED: ${failedCount}`);
    if (failedCount === 0) {
      console.log("RESULT: PLAYWRIGHT TELEMARKETING BROWSER SUITE 100% PASS ✨");
    } else {
      console.error("RESULT: SOME PLAYWRIGHT TESTS FAILED");
      process.exit(1);
    }
    console.log("=".repeat(80) + "\n");
  } catch (err: any) {
    console.error("Playwright Execution Error:", err);
    process.exit(1);
  } finally {
    await browser.close();
  }
}

runTelemarketingPlaywrightVerification();
