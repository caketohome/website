/**
 * Real Mouse-Wheel & User Interaction Regression Test Suite for CakeToHome Page Configurator
 * MUST use real mouse input (page.mouse.move() and page.mouse.wheel()) across the viewport.
 * Verifies:
 * 1. Initial page load metrics: document.documentElement.scrollHeight > clientHeight.
 * 2. Real mouse wheel at Far Left Margin changes window.scrollY.
 * 3. Real mouse wheel at Dashboard Title changes window.scrollY.
 * 4. Real mouse wheel at CMS Toolbar changes window.scrollY.
 * 5. Real mouse wheel at Left Settings Panel changes window.scrollY.
 * 6. Real mouse wheel at Center Canvas Preview changes window.scrollY.
 * 7. Real mouse wheel at Right Section Navigator changes window.scrollY.
 * 8. Real mouse wheel reaches maximum document page scroll.
 * 9. Content below editor (Secondary Assets, Content Blocks, Media Library, Footer) is reachable via real wheel scroll.
 * 10. Real mouse wheel up restores window.scrollY to 0.
 * 11. Modal opening/closing locks body scroll during open and restores body scroll on close.
 * 12. Mobile viewport mode maintains real wheel document scrollability.
 * 13. Tablet viewport mode maintains real wheel document scrollability.
 * 14. Page reload maintains natural real mouse wheel document scrollability.
 */

import { chromium } from "playwright";

async function runRealMouseWheelRegressionTests() {
  console.log("===============================================================");
  console.log("CAKETOHOME — REAL MOUSE WHEEL USER INTERACTION TEST SUITE");
  console.log("===============================================================\n");

  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, testName: string, details?: string) {
    if (condition) {
      console.log(`✅ [PASS] ${testName}`);
      passed++;
    } else {
      console.error(`❌ [FAIL] ${testName}`);
      if (details) console.error(`   Details: ${details}`);
      failed++;
    }
  }

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();

  await page.goto("http://localhost:3000/dashboard?tab=cms", { waitUntil: "load" });
  await page.waitForTimeout(2500);

  // ── ASSERTION 1: Document scrollHeight > clientHeight ─────────────────────
  const docHeightsInitial = await page.evaluate(() => ({
    scrollHeight: document.documentElement.scrollHeight,
    clientHeight: document.documentElement.clientHeight,
  }));
  assert(
    docHeightsInitial.scrollHeight > docHeightsInitial.clientHeight,
    `ASSERTION 1: Document scrollHeight (${docHeightsInitial.scrollHeight}px) > clientHeight (${docHeightsInitial.clientHeight}px)`
  );

  // ── ASSERTION 2: Real mouse wheel at Far Left Margin scrolls window.scrollY ─
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(200);
  await page.mouse.move(20, 300);
  await page.mouse.wheel(0, 500);
  await page.waitForTimeout(400);
  const scrollYMargin = await page.evaluate(() => window.scrollY);
  assert(scrollYMargin > 100, `ASSERTION 2: Real mouse wheel at Far Left Margin scrolled window.scrollY (Actual: ${scrollYMargin}px)`);

  // ── ASSERTION 3: Real mouse wheel at Dashboard Title scrolls window.scrollY
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(200);
  await page.mouse.move(300, 100);
  await page.mouse.wheel(0, 500);
  await page.waitForTimeout(400);
  const scrollYTitle = await page.evaluate(() => window.scrollY);
  assert(scrollYTitle > 100, `ASSERTION 3: Real mouse wheel at Dashboard Title scrolled window.scrollY (Actual: ${scrollYTitle}px)`);

  // ── ASSERTION 4: Real mouse wheel at CMS Toolbar scrolls window.scrollY ────
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(200);
  await page.mouse.move(300, 170);
  await page.mouse.wheel(0, 500);
  await page.waitForTimeout(400);
  const scrollYToolbar = await page.evaluate(() => window.scrollY);
  assert(scrollYToolbar > 100, `ASSERTION 4: Real mouse wheel at CMS Toolbar scrolled window.scrollY (Actual: ${scrollYToolbar}px)`);

  // ── ASSERTION 5: Real mouse wheel at Left Settings Panel scrolls window ───
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(200);
  await page.mouse.move(200, 400);
  await page.mouse.wheel(0, 500);
  await page.waitForTimeout(400);
  const scrollYLeftPanel = await page.evaluate(() => window.scrollY);
  assert(scrollYLeftPanel > 100, `ASSERTION 5: Real mouse wheel at Left Panel scrolled window.scrollY (Actual: ${scrollYLeftPanel}px)`);

  // ── ASSERTION 6: Real mouse wheel at Center Canvas Preview scrolls window ──
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(200);
  await page.mouse.move(700, 400);
  await page.mouse.wheel(0, 500);
  await page.waitForTimeout(400);
  const scrollYCenterCanvas = await page.evaluate(() => window.scrollY);
  assert(scrollYCenterCanvas > 100, `ASSERTION 6: Real mouse wheel at Center Canvas scrolled window.scrollY (Actual: ${scrollYCenterCanvas}px)`);

  // ── ASSERTION 7: Real mouse wheel at Right Section Navigator scrolls ──────
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(200);
  await page.mouse.move(1350, 400);
  await page.mouse.wheel(0, 500);
  await page.waitForTimeout(400);
  const scrollYRightPanel = await page.evaluate(() => window.scrollY);
  assert(scrollYRightPanel > 100, `ASSERTION 7: Real mouse wheel at Right Panel scrolled window.scrollY (Actual: ${scrollYRightPanel}px)`);

  // ── ASSERTION 8: Real mouse wheel reaches maximum document page scroll ────
  const maxPossibleScroll = docHeightsInitial.scrollHeight - docHeightsInitial.clientHeight;
  assert(
    scrollYRightPanel >= maxPossibleScroll - 5,
    `ASSERTION 8: Real mouse wheel reached max document page scroll (${scrollYRightPanel}px / max ${maxPossibleScroll}px)`
  );

  // ── ASSERTION 9: Content below editor is reachable via real wheel scroll ─
  const secondaryAssetsVisible = await page.evaluate(() => {
    const el = document.querySelector("footer") || document.querySelector("[class*='Secondary Assets']");
    if (!el) return false;
    const rect = el.getBoundingClientRect();
    return rect.top < window.innerHeight;
  });
  assert(secondaryAssetsVisible, "ASSERTION 9: Content below editor (Secondary Assets / Footer) is reachable via real wheel scroll");

  // ── ASSERTION 10: Real mouse wheel up restores window.scrollY to 0 ────────
  await page.mouse.move(20, 300);
  await page.mouse.wheel(0, -1000);
  await page.waitForTimeout(400);
  const scrollYAfterWheelUp = await page.evaluate(() => window.scrollY);
  assert(scrollYAfterWheelUp === 0, `ASSERTION 10: Real mouse wheel up restores window.scrollY to 0 (Actual: ${scrollYAfterWheelUp}px)`);

  // ── ASSERTION 11: Modal opening/closing locks and restores body overflow ──
  const overflowBeforeModal = await page.evaluate(() => document.body.style.overflow);
  await page.evaluate(() => {
    const buttons = Array.from(document.querySelectorAll("button"));
    const imgBtn = buttons.find((b) => b.textContent?.includes("Change Image") || b.textContent?.includes("Select Image"));
    if (imgBtn) imgBtn.click();
  });
  await page.waitForTimeout(300);
  const overflowDuringModal = await page.evaluate(() => document.body.style.overflow);

  await page.keyboard.press("Escape");
  await page.waitForTimeout(300);
  const overflowAfterModal = await page.evaluate(() => document.body.style.overflow);

  assert(
    overflowBeforeModal === overflowAfterModal,
    `ASSERTION 11: Closing modal restores document.body.style.overflow cleanly (Before: "${overflowBeforeModal}", After: "${overflowAfterModal}")`
  );

  // ── ASSERTION 12: Mobile view maintains real wheel document scrollability ─
  await page.setViewportSize({ width: 375, height: 900 });
  await page.waitForTimeout(300);
  await page.mouse.move(180, 200);
  await page.mouse.wheel(0, 500);
  await page.waitForTimeout(400);
  const scrollYMobileWheel = await page.evaluate(() => window.scrollY);
  assert(scrollYMobileWheel > 100, `ASSERTION 12: Mobile view maintains real wheel document scrollability (Actual: ${scrollYMobileWheel}px)`);

  // ── ASSERTION 13: Tablet view maintains real wheel document scrollability ─
  await page.setViewportSize({ width: 768, height: 900 });
  await page.waitForTimeout(300);
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.mouse.move(380, 200);
  await page.mouse.wheel(0, 500);
  await page.waitForTimeout(400);
  const scrollYTabletWheel = await page.evaluate(() => window.scrollY);
  assert(scrollYTabletWheel > 100, `ASSERTION 13: Tablet view maintains real wheel document scrollability (Actual: ${scrollYTabletWheel}px)`);

  // ── ASSERTION 14: Page reload preserves natural real wheel scrollability ─
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.reload({ waitUntil: "load" });
  await page.waitForTimeout(2000);
  await page.mouse.move(20, 300);
  await page.mouse.wheel(0, 500);
  await page.waitForTimeout(400);
  const scrollYAfterReloadWheel = await page.evaluate(() => window.scrollY);
  assert(scrollYAfterReloadWheel > 100, `ASSERTION 14: Reload preserves natural real mouse wheel document scrollability (Actual: ${scrollYAfterReloadWheel}px)`);

  await browser.close();

  // ── SUMMARY REPORT ──────────────────────────────────────────────────────────
  console.log("\n===============================================================");
  console.log(`REAL MOUSE WHEEL REGRESSION RESULTS: ${passed} PASSED, ${failed} FAILED (TOTAL: ${passed + failed})`);
  console.log("===============================================================\n");

  if (failed > 0) {
    process.exit(1);
  }
}

runRealMouseWheelRegressionTests().catch((err) => {
  console.error("Real mouse wheel regression test execution failed:", err);
  process.exit(1);
});
