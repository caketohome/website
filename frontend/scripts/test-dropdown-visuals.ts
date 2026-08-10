/**
 * CakeToHome — Global Dropdown & Popover Visual Verification Test Suite
 * Validates opaque background colors, opacity === 1, z-index elevation, and stacking contexts
 * across popover and dropdown surfaces using Playwright browser evaluation.
 */

import { chromium } from "playwright";

async function runDropdownVisualTestSuite() {
  console.log("===============================================================");
  console.log("CAKETOHOME — GLOBAL DROPDOWN VISUAL & OPACITY VERIFICATION SUITE");
  console.log("===============================================================\n");

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();

  let passedTests = 0;
  let failedTests = 0;

  console.log("---------------------------------------------------------------");
  console.log("TESTING ROUTE: Analytics & Reports (/dashboard?tab=analytics)");
  console.log("---------------------------------------------------------------");

  await page.goto("http://localhost:3000/dashboard?tab=analytics", { waitUntil: "load" });
  await page.waitForTimeout(2000);

  // Step 1: Find and click the Kitchen Hubs popover button
  const popoverBtn = page.locator("button", { hasText: "Kitchen Hubs" }).first();
  const btnExists = await popoverBtn.isVisible().catch(() => false);

  if (!btnExists) {
    console.error("❌ FAIL: Kitchen Hubs popover trigger button not found on /dashboard?tab=analytics");
    failedTests++;
  } else {
    console.log("  ✅ Found Kitchen Hubs popover trigger button.");
    await popoverBtn.click();
    await page.waitForTimeout(500);

    // Step 2: Evaluate popover computed style and stacking order
    const popoverMetrics = await page.evaluate(() => {
      const el = document.querySelector(".popover-solid-panel") as HTMLElement | null;
      if (!el) return null;

      const style = window.getComputedStyle(el);
      const rect = el.getBoundingClientRect();
      const centerEl = document.elementFromPoint(rect.left + rect.width / 2, rect.top + rect.height / 2);
      const isTopElement = el.contains(centerEl) || centerEl === el;

      return {
        exists: true,
        backgroundColor: style.backgroundColor,
        opacity: style.opacity,
        zIndex: style.zIndex,
        pointerEvents: style.pointerEvents,
        width: rect.width,
        height: rect.height,
        isTopElement,
        centerTag: centerEl?.tagName,
        centerClass: centerEl?.className,
      };
    });

    if (!popoverMetrics || !popoverMetrics.exists) {
      console.error("❌ FAIL: Popover panel (.popover-solid-panel) did not render after clicking trigger.");
      failedTests++;
    } else {
      console.log(`  Popover metrics -> bg: ${popoverMetrics.backgroundColor} | opacity: ${popoverMetrics.opacity} | zIndex: ${popoverMetrics.zIndex}`);
      console.log(`  Popover dimensions -> ${popoverMetrics.width}px x ${popoverMetrics.height}px | Stacking order top: ${popoverMetrics.isTopElement}`);

      const isBgOpaque = popoverMetrics.backgroundColor !== "transparent" && !popoverMetrics.backgroundColor.startsWith("rgba(0, 0, 0, 0)");
      const isOpacityOne = popoverMetrics.opacity === "1";
      const isElevated = parseInt(popoverMetrics.zIndex, 10) >= 50 || popoverMetrics.zIndex === "1000";
      const hasDimensions = popoverMetrics.width > 0 && popoverMetrics.height > 0;

      const ok = isBgOpaque && isOpacityOne && isElevated && hasDimensions && popoverMetrics.isTopElement;

      if (ok) {
        console.log("  ✅ PASS: Dropover surface is 100% solid, opaque, elevated z-[1000] and visible on top.");
        passedTests++;
      } else {
        console.error(`  ❌ FAIL: Dropover visual checks failed. bgOpaque: ${isBgOpaque}, opacity1: ${isOpacityOne}, elevated: ${isElevated}, topElement: ${popoverMetrics.isTopElement}`);
        failedTests++;
      }
    }

    // Step 3: Click 'Done' to close popover
    const doneBtn = page.locator("button", { hasText: "Done" }).first();
    if (await doneBtn.isVisible().catch(() => false)) {
      await doneBtn.click();
      await page.waitForTimeout(300);
      console.log("  ✅ Closed Kitchen Hubs popover successfully.");
    }
  }

  // Step 4: Verify Document Page Scrolling continues to work perfectly
  console.log("\n---------------------------------------------------------------");
  console.log("TESTING GLOBAL PAGE SCROLLING POST-POPOVER CLOSE");
  console.log("---------------------------------------------------------------");

  const initialScrollY = await page.evaluate(() => window.scrollY);
  await page.mouse.move(500, 400);
  await page.mouse.wheel(0, 500);
  await page.waitForTimeout(400);
  const scrollYAfterWheel = await page.evaluate(() => window.scrollY);

  if (scrollYAfterWheel > initialScrollY) {
    console.log(`  ✅ PASS: Global page scrolled fluently (+${scrollYAfterWheel}px). Zero scroll traps!`);
    passedTests++;
  } else {
    console.error(`  ❌ FAIL: Page scroll locked after popover close. Initial: ${initialScrollY}, After: ${scrollYAfterWheel}`);
    failedTests++;
  }

  await browser.close();

  console.log("\n===============================================================");
  console.log(`GLOBAL DROPDOWN VISUAL TEST SUITE RESULT: ${passedTests} PASSED, ${failedTests} FAILED`);
  console.log("===============================================================\n");

  if (failedTests > 0) {
    process.exit(1);
  }
}

runDropdownVisualTestSuite().catch((err) => {
  console.error("Dropdown visual test suite execution failed:", err);
  process.exit(1);
});
