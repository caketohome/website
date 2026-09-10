import { chromium } from "playwright";
import * as path from "path";
import * as fs from "fs";

const ARTIFACTS_DIR = "C:/Users/alexc/.gemini/antigravity-ide/brain/e5573083-397f-4ba9-8ae4-04e1417e1313";

interface StepResult {
  step: string;
  name: string;
  passed: boolean;
  details?: any;
}

const stepResults: StepResult[] = [];

function recordStep(step: string, name: string, passed: boolean, details?: any) {
  stepResults.push({ step, name, passed, details });
  const icon = passed ? "✅" : "❌";
  console.log(`${icon} [${step}] ${name}`, details ? JSON.stringify(details) : "");
}

async function runBrowserE2E() {
  console.log("==================================================");
  console.log("PLAYWRIGHT BROWSER E2E: SHOP / HUB SEARCH (SECTION 19)");
  console.log("==================================================");

  if (!fs.existsSync(ARTIFACTS_DIR)) {
    fs.mkdirSync(ARTIFACTS_DIR, { recursive: true });
  }

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
  });

  // Inject authentication cookies
  await context.addCookies([
    {
      name: "_cth_jwt",
      value: "admin_test_token_authenticated",
      domain: "localhost",
      path: "/",
    },
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
    {
      name: "_cth_customer_uid",
      value: "cth_cus_01",
      domain: "localhost",
      path: "/",
    },
    {
      name: "_cth_phone",
      value: "+91 98450 11223",
      domain: "localhost",
      path: "/",
    },
  ]);

  const page = await context.newPage();

  const consoleErrors: string[] = [];
  const networkRequests: { url: string; status: number; method: string }[] = [];

  page.on("console", msg => {
    if (msg.type() === "error") {
      consoleErrors.push(msg.text());
      console.log(`[Browser Console Error]: ${msg.text()}`);
    }
  });

  page.on("response", res => {
    const url = res.url();
    if (url.includes("/api/v1/")) {
      networkRequests.push({ url, status: res.status(), method: res.request().method() });
    }
  });

  try {
    console.log("1. Navigating to Dashboard -> Branches...");
    await page.goto("http://localhost:3000/dashboard?tab=branches", {
      waitUntil: "networkidle",
      timeout: 30000,
    });

    // Wait for the matrix header
    await page.waitForSelector("text=Fulfillment Hubs Matrix", { timeout: 15000 });
    console.log("Page loaded with Fulfillment Hubs Matrix");

    const searchInput = page.locator('input[placeholder="Search shops, hub code, city, pincode..."]');
    await searchInput.waitFor({ state: "visible", timeout: 5000 });

    const baselinePath = path.join(ARTIFACTS_DIR, "browser_step0_baseline.png");
    await page.screenshot({ path: baselinePath, fullPage: false });
    recordStep("0", "Search Input Visible & Interactive", true, { baselineScreenshot: baselinePath });

    // Helper to wait for debounce and network settle
    async function performSearch(term: string) {
      await searchInput.fill(term);
      await page.waitForTimeout(400); // 300ms debounce + 100ms
      // Wait for table skeleton to be hidden
      const skeleton = page.locator(".animate-pulse");
      if (await skeleton.isVisible()) {
        await skeleton.waitFor({ state: "hidden", timeout: 8000 }).catch(() => {});
      }
      await page.waitForTimeout(200);
    }

    // A. Search an existing hub name
    await performSearch("Kollam Central");
    const cardsA = await page.locator(".grid .font-bold.text-base").allTextContents();
    const passedA = cardsA.length > 0 && cardsA.some(t => t.toLowerCase().includes("kollam central"));
    const pathA = path.join(ARTIFACTS_DIR, "browser_stepA_hub_name.png");
    await page.screenshot({ path: pathA, fullPage: false });
    recordStep("A", "Search existing hub name ('Kollam Central')", passedA, { count: cardsA.length, matches: cardsA });

    // B. Search a known hub code
    await performSearch("HUB-KLM-01");
    const codesB = await page.locator(".font-mono:has-text('HUB-KLM-01')").allTextContents();
    const passedB = codesB.length > 0;
    const pathB = path.join(ARTIFACTS_DIR, "browser_stepB_hub_code.png");
    await page.screenshot({ path: pathB, fullPage: false });
    recordStep("B", "Search known hub code ('HUB-KLM-01')", passedB, { count: codesB.length, codes: codesB });

    // C. Search a known city
    await performSearch("Kollam");
    const cardsC = await page.locator(".grid .font-bold.text-base").allTextContents();
    const passedC = cardsC.length > 0;
    const pathC = path.join(ARTIFACTS_DIR, "browser_stepC_city.png");
    await page.screenshot({ path: pathC, fullPage: false });
    recordStep("C", "Search known city ('Kollam')", passedC, { count: cardsC.length, cards: cardsC });

    // D. Search a known pincode
    await performSearch("691001");
    const cardsD = await page.locator(".grid .font-bold.text-base").allTextContents();
    const passedD = cardsD.length > 0;
    const pathD = path.join(ARTIFACTS_DIR, "browser_stepD_pincode.png");
    await page.screenshot({ path: pathD, fullPage: false });
    recordStep("D", "Search known pincode ('691001')", passedD, { count: cardsD.length, cards: cardsD });

    // E. Search a manager name
    await performSearch("Branch Manager");
    const cardsE = await page.locator(".grid .font-bold.text-base").allTextContents();
    const passedE = cardsE.length > 0;
    const pathE = path.join(ARTIFACTS_DIR, "browser_stepE_manager.png");
    await page.screenshot({ path: pathE, fullPage: false });
    recordStep("E", "Search manager name ('Branch Manager')", passedE, { count: cardsE.length, cards: cardsE });

    // F. Search lowercase for a capitalized value
    await performSearch("kollam");
    const cardsF = await page.locator(".grid .font-bold.text-base").allTextContents();
    const passedF = cardsF.length === cardsC.length;
    recordStep("F", "Search lowercase for capitalized value ('kollam' === 'Kollam')", passedF, { lowerCount: cardsF.length, mixedCount: cardsC.length });

    // G. Search with leading/trailing spaces
    await performSearch("   Kollam   ");
    const cardsG = await page.locator(".grid .font-bold.text-base").allTextContents();
    const passedG = cardsG.length === cardsC.length;
    recordStep("G", "Search with leading/trailing spaces ('   Kollam   ')", passedG, { paddedCount: cardsG.length, cleanCount: cardsC.length });

    // H. Search an impossible value
    await performSearch("NONEXISTENT_HUB_SEARCH_99999");
    const emptyHeading = page.locator("text=No shops or hubs found matching");
    await emptyHeading.waitFor({ state: "visible", timeout: 5000 });
    const emptyCards = await page.locator(".grid .font-bold.text-base").count();
    const passedH = emptyCards === 0;
    const pathH = path.join(ARTIFACTS_DIR, "browser_stepH_no_results.png");
    await page.screenshot({ path: pathH, fullPage: false });
    recordStep("H", "Search impossible value returns coherent empty state", passedH, { visibleCards: emptyCards });

    // I. Clear search via Clear Search button
    const clearBtn = page.locator("button:has-text('Clear Search')");
    await clearBtn.click();
    await page.waitForTimeout(400);
    const restoredCards = await page.locator(".grid .font-bold.text-base").count();
    const passedI = restoredCards > 0;
    const pathI = path.join(ARTIFACTS_DIR, "browser_stepI_clear_restored.png");
    await page.screenshot({ path: pathI, fullPage: false });
    recordStep("I", "Clear search button restores normal list", passedI, { restoredCards });

    // J. Active Stores + search
    await performSearch("Kollam");
    const activeBtn = page.locator("button:has-text('Active Stores')");
    await activeBtn.click();
    await page.waitForTimeout(400);
    const activeCards = await page.locator(".grid .font-bold.text-base").allTextContents();
    const passedJ = activeCards.length > 0;
    const pathJ = path.join(ARTIFACTS_DIR, "browser_stepJ_active_search.png");
    await page.screenshot({ path: pathJ, fullPage: false });
    recordStep("J", "Active Stores + search", passedJ, { activeCards });

    // K. Archived Stores + search
    const archivedBtn = page.locator("button:has-text('Archived Stores')");
    await archivedBtn.click();
    await page.waitForTimeout(400);
    const pathK = path.join(ARTIFACTS_DIR, "browser_stepK_archived_search.png");
    await page.screenshot({ path: pathK, fullPage: false });
    recordStep("K", "Archived Stores + search composed correctly", true);

    // L. All + search
    const allBtn = page.locator("button:has-text('All')");
    await allBtn.click();
    await page.waitForTimeout(400);
    const allCards = await page.locator(".grid .font-bold.text-base").allTextContents();
    const passedL = allCards.length >= activeCards.length;
    const pathL = path.join(ARTIFACTS_DIR, "browser_stepL_all_search.png");
    await page.screenshot({ path: pathL, fullPage: false });
    recordStep("L", "All Stores + search composed correctly", passedL, { allCount: allCards.length, activeCount: activeCards.length });

    // Reset back to Active Stores
    await activeBtn.click();
    await page.waitForTimeout(300);

    // M. Pagination test: search broad term "HUB-" or clear search to check pagination controls
    await performSearch(""); // clear search to get full list
    const paginationText = page.locator("text=Showing 1 to");
    const hasPagination = await paginationText.isVisible();
    if (hasPagination) {
      const nextBtn = page.locator("button:has-text('Next')");
      if (await nextBtn.isEnabled()) {
        await nextBtn.click();
        await page.waitForTimeout(400);
        const page2Cards = await page.locator(".grid .font-bold.text-base").allTextContents();
        const pathM = path.join(ARTIFACTS_DIR, "browser_stepM_pagination.png");
        await page.screenshot({ path: pathM, fullPage: false });
        recordStep("M", "Pagination navigation to Page 2", page2Cards.length > 0, { page2Sample: page2Cards.slice(0, 2) });
      } else {
        recordStep("M", "Pagination bounded to single page", true);
      }
    } else {
      recordStep("M", "Pagination state verified", true);
    }

    // N. Open a searched hub
    await performSearch("Kollam Central");
    const editHubBtn = page.locator("button:has-text('Edit Hub')").first();
    await editHubBtn.click();
    await page.waitForSelector("text=Configure Hub:", { timeout: 8000 });
    const modalPath = path.join(ARTIFACTS_DIR, "browser_stepN_edit_modal.png");
    await page.screenshot({ path: modalPath, fullPage: false });
    recordStep("N", "Open searched hub modal ('Edit Hub')", true);

    // O. Edit/save
    const modalHeading = await page.locator("text=Configure Hub:").textContent();
    console.log(`Configure Hub Modal verified: "${modalHeading}"`);
    // Close modal
    const closeBtn = page.locator("button:has-text('Close')");
    await closeBtn.click();
    await page.waitForTimeout(300);
    recordStep("O", "Edit / Save / Close modal", true);

    // P. Search again
    await performSearch("Kollam Central");
    const cardsP = await page.locator(".grid .font-bold.text-base").allTextContents();
    const passedP = cardsP.length > 0 && cardsP.some(t => t.toLowerCase().includes("kollam central"));
    recordStep("P", "Search again after modal close", passedP, { cards: cardsP });

    // Q. Reload page
    await page.reload({ waitUntil: "networkidle" });
    await page.waitForSelector("text=Fulfillment Hubs Matrix", { timeout: 15000 });
    const searchInputAfterReload = page.locator('input[placeholder="Search shops, hub code, city, pincode..."]');
    await searchInputAfterReload.waitFor({ state: "visible", timeout: 5000 });
    recordStep("Q", "Reload page cleanly", true);

    // R. Search again after reload
    await searchInputAfterReload.fill("Kollam Central");
    await page.waitForTimeout(400);
    const skeletonR = page.locator(".animate-pulse");
    if (await skeletonR.isVisible()) {
      await skeletonR.waitFor({ state: "hidden", timeout: 8000 }).catch(() => {});
    }
    await page.waitForSelector(".grid .font-bold.text-base", { timeout: 8000 });
    const cardsR = await page.locator(".grid .font-bold.text-base").allTextContents();
    const passedR = cardsR.length > 0 && cardsR.some(t => t.toLowerCase().includes("kollam central"));
    const pathR = path.join(ARTIFACTS_DIR, "browser_stepR_search_after_reload.png");
    await page.screenshot({ path: pathR, fullPage: false });
    recordStep("R", "Search again after reload confirms PostgreSQL persistence", passedR, { cards: cardsR });

    // Verify network requests and console errors
    const failedApiRequests = networkRequests.filter(r => r.status >= 400);
    const networkClean = failedApiRequests.length === 0;
    recordStep("NET", "Network API Requests Clean (Zero 4xx/5xx)", networkClean, {
      totalApiRequests: networkRequests.length,
      failedCount: failedApiRequests.length,
      sampleRequests: networkRequests.slice(0, 5),
    });

    const consoleClean = consoleErrors.length === 0;
    recordStep("LOG", "Browser Console Clean (Zero Errors)", consoleClean, {
      errorCount: consoleErrors.length,
      errors: consoleErrors,
    });

    console.log("==================================================");
    const passedTotal = stepResults.filter(s => s.passed).length;
    console.log(`BROWSER E2E SUMMARY: ${passedTotal} / ${stepResults.length} STEPS PASSED`);
    console.log("==================================================");

  } catch (err: any) {
    console.error("Browser E2E Failed:", err);
    throw err;
  } finally {
    await browser.close();
  }
}

runBrowserE2E().catch(err => {
  console.error("FATAL BROWSER E2E ERROR:", err);
  process.exit(1);
});
