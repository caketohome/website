import { chromium } from "../frontend/node_modules/playwright";
import type { Browser, Page } from "../frontend/node_modules/playwright";

interface BrowserTestResult {
  step: string;
  passed: boolean;
  details: string;
}

const testResults: BrowserTestResult[] = [];

function record(step: string, passed: boolean, details: string) {
  testResults.push({ step, passed, details });
  const icon = passed ? "✅ PASS" : "❌ FAIL";
  console.log(`  ${icon} [${step}]: ${details}`);
}

async function runBrowserVerification() {
  console.log("================================================================================");
  console.log("  CAKETOHOME — REAL BROWSER ORDER COMMAND CENTER FILTER VERIFICATION E2E       ");
  console.log("================================================================================\n");

  const browser: Browser = await chromium.launch({
    headless: true,
  });

  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
  });

  await context.addCookies([
    {
      name: "_cth_role",
      value: "SUPER_ADMIN",
      domain: "localhost",
      path: "/",
    },
    {
      name: "_cth_user_id",
      value: "admin_01",
      domain: "localhost",
      path: "/",
    },
  ]);

  const page: Page = await context.newPage();

  page.on("console", (msg) => console.log(`[Browser Console ${msg.type()}]:`, msg.text()));
  page.on("response", async (res) => {
    if (res.url().includes("/admin/orders")) {
      try {
        const text = await res.text();
        console.log(`[API Response ${res.status()} ${res.url()}]:`, text.slice(0, 300));
      } catch {}
    }
  });

  try {
    // 1. Initial Page Load
    console.log("[PHASE 1] Navigating to Order Command Center (/dashboard?tab=orders)...");
    const initResponsePromise = page.waitForResponse((res) => res.url().includes("/admin/orders") && res.status() === 200);
    await page.goto("http://localhost:3000/dashboard?tab=orders", { waitUntil: "domcontentloaded" });
    await initResponsePromise;
    await page.waitForSelector("table tbody tr", { timeout: 15000 });

    const titleEl = page.locator("h2:has-text('Enterprise Order Command Center')").first();
    const isTitleVisible = await titleEl.isVisible();
    record("1. Heading Verification", isTitleVisible, "Enterprise Order Command Center heading rendered cleanly");

    // Check baseline orders count badge
    const badgeText = await page.locator("span:has-text('Orders Total')").first().textContent();
    const baselineOrdersCount = parseInt(badgeText?.replace(/\D/g, "") || "0", 10);
    record("2. Baseline Orders Badge", baselineOrdersCount > 0, `Baseline Total Orders badge: ${badgeText} (${baselineOrdersCount} orders)`);

    // 2. Payment Status Filter (Paid / Captured)
    console.log("\n[PHASE 2] Testing Payment Status Filter...");
    const paymentSelect = page.locator("select[data-testid='payment-filter']");
    const paidResponsePromise = page.waitForResponse((res) => res.url().includes("payment_status=paid") && res.status() === 200);
    await paymentSelect.selectOption("paid");
    await paidResponsePromise;
    await page.waitForTimeout(500);

    const paidBadgeText = await page.locator("span:has-text('Orders Total')").first().textContent();
    const paidOrdersCount = parseInt(paidBadgeText?.replace(/\D/g, "") || "0", 10);
    const paidUrl = page.url();
    record(
      "3. Payment = Paid Filter",
      paidOrdersCount > 0 && paidUrl.includes("payment_status=paid"),
      `Paid Count: ${paidOrdersCount} orders | URL synced: ${paidUrl}`
    );

    // 3. Payment Status Filter (Pending)
    const pendResponsePromise = page.waitForResponse((res) => res.url().includes("payment_status=pending") && res.status() === 200);
    await paymentSelect.selectOption("pending");
    await pendResponsePromise;
    await page.waitForTimeout(500);

    const pendBadgeText = await page.locator("span:has-text('Orders Total')").first().textContent();
    const pendOrdersCount = parseInt(pendBadgeText?.replace(/\D/g, "") || "0", 10);
    const pendUrl = page.url();
    record(
      "4. Payment = Pending Filter",
      pendOrdersCount > 0 && pendUrl.includes("payment_status=pending"),
      `Pending Count: ${pendOrdersCount} orders | URL synced: ${pendUrl}`
    );

    // 4. Branch Hub Filter
    console.log("\n[PHASE 3] Testing Branch Hub Filter...");
    const branchSelect = page.locator("select[data-testid='branch-filter']");
    const branchResponsePromise = page.waitForResponse((res) => res.url().includes("branch_id=") && res.status() === 200);
    await branchSelect.selectOption("br_indiranagar");
    await branchResponsePromise;
    await page.waitForTimeout(500);

    const branchBadgeText = await page.locator("span:has-text('Orders Total')").first().textContent();
    const branchOrdersCount = parseInt(branchBadgeText?.replace(/\D/g, "") || "0", 10);
    const branchUrl = page.url();
    record(
      "5. Branch Specific Filter",
      branchOrdersCount > 0 && branchUrl.includes("branch_id="),
      `Branch Filter Count: ${branchOrdersCount} orders | URL synced: ${branchUrl}`
    );

    // 5. Date Preset Filter (Today / Last 30 Days)
    console.log("\n[PHASE 4] Testing Date Preset Filter...");
    const dateSelect = page.locator("select[data-testid='date-preset-filter']");
    const dateResponsePromise = page.waitForResponse((res) => res.url().includes("date_preset=last_30_days") && res.status() === 200);
    await dateSelect.selectOption("last_30_days");
    await dateResponsePromise;
    await page.waitForTimeout(500);

    const dateBadgeText = await page.locator("span:has-text('Orders Total')").first().textContent();
    const dateOrdersCount = parseInt(dateBadgeText?.replace(/\D/g, "") || "0", 10);
    const dateUrl = page.url();
    record(
      "6. Date Preset = Last 30 Days",
      dateOrdersCount > 0 && dateUrl.includes("date_preset=last_30_days"),
      `Date Filter Count: ${dateOrdersCount} orders | URL synced: ${dateUrl}`
    );

    // 6. Search Bar Filtering
    console.log("\n[PHASE 5] Testing Search Filtering...");
    const searchInput = page.locator("input[placeholder*='Search order']");
    const searchResponsePromise = page.waitForResponse((res) => res.url().includes("q=CTH-LIVE-001") && res.status() === 200);
    await searchInput.fill("CTH-LIVE-001");
    await searchResponsePromise;
    await page.waitForTimeout(500);

    const searchUrl = page.url();
    const rowCount = await page.locator("tbody tr").count();
    record(
      "7. Search Query Execution",
      searchUrl.includes("q=CTH-LIVE-001") && rowCount > 0,
      `Search query applied | Rendered ${rowCount} matching customer rows for 'CTH-LIVE-001'`
    );

    // 7. Clear Filters Action
    console.log("\n[PHASE 6] Testing Clear All Filters Button...");
    const clearBtn = page.locator("button[data-testid='clear-filters-button']");
    const isClearBtnVisible = await clearBtn.isVisible();
    record("8. Clear Filters Button Visible", isClearBtnVisible, "Clear Filters button appeared dynamically when filters were active");

    if (isClearBtnVisible) {
      const clearResponsePromise = page.waitForResponse((res) => res.url().includes("admin/orders") && res.status() === 200);
      await clearBtn.click();
      await clearResponsePromise;
      await page.waitForTimeout(500);

      const restoredBadgeText = await page.locator("span:has-text('Orders Total')").first().textContent();
      const restoredCount = parseInt(restoredBadgeText?.replace(/\D/g, "") || "0", 10);
      record(
        "9. Clear Filters Restores Catalog",
        restoredCount === baselineOrdersCount,
        `Restored total orders: ${restoredCount} (matches baseline ${baselineOrdersCount})`
      );
    }

    // 8. URL Persistence & Reload
    console.log("\n[PHASE 7] Testing Direct URL Navigation & State Persistence...");
    const reloadResponsePromise = page.waitForResponse((res) => res.url().includes("admin/orders") && res.status() === 200);
    await page.goto("http://localhost:3000/dashboard?tab=orders&payment_status=paid&date_preset=last_30_days", { waitUntil: "domcontentloaded" });
    await reloadResponsePromise;
    await page.waitForTimeout(500);

    const reloadedPaymentVal = await paymentSelect.inputValue();
    const reloadedDateVal = await dateSelect.inputValue();
    record(
      "10. URL Query Param Hydration on Reload",
      reloadedPaymentVal === "paid" && reloadedDateVal === "last_30_days",
      `Payment Select: '${reloadedPaymentVal}' | Date Select: '${reloadedDateVal}' correctly hydrated from URL`
    );

    // 9. Zero-Result State
    console.log("\n[PHASE 8] Testing Empty State Handling...");
    const emptyResponsePromise = page.waitForResponse((res) => res.url().includes("q=NON_EXISTENT_ORDER_99999_XYZ") && res.status() === 200);
    await searchInput.fill("NON_EXISTENT_ORDER_99999_XYZ");
    await emptyResponsePromise;
    await page.waitForTimeout(500);

    const emptyStateContainer = page.locator("div[data-testid='orders-empty-state']");
    const isEmptyVisible = await emptyStateContainer.isVisible();
    const emptyResetBtn = page.locator("button[data-testid='empty-clear-filters']");
    const isResetVisible = await emptyResetBtn.isVisible();

    record(
      "11. Empty State with Reset CTA",
      isEmptyVisible && isResetVisible,
      "Meaningful empty state rendered with 'Reset All Filters' button"
    );

    if (isResetVisible) {
      const resetResponsePromise = page.waitForResponse((res) => res.url().includes("admin/orders") && res.status() === 200);
      await emptyResetBtn.click();
      await resetResponsePromise;
      await page.waitForTimeout(500);
      const afterEmptyRestoredCount = parseInt((await page.locator("span:has-text('Orders Total')").first().textContent())?.replace(/\D/g, "") || "0", 10);
      record(
        "12. Reset CTA Restores Orders",
        afterEmptyRestoredCount > 0,
        `Restored orders count after empty reset: ${afterEmptyRestoredCount}`
      );
    }

  } catch (err: any) {
    console.error("Browser Verification Error:", err);
    record("Browser Exception", false, err.message);
  } finally {
    await browser.close();
  }

  console.log("\n================================================================================");
  const passCount = testResults.filter((r) => r.passed).length;
  console.log(`  BROWSER VERIFICATION RESULTS: ${passCount} / ${testResults.length} PASSED (${((passCount / testResults.length) * 100).toFixed(1)}%)`);
  console.log("================================================================================\n");

  if (passCount !== testResults.length) {
    process.exit(1);
  }
}

runBrowserVerification().catch(console.error);
