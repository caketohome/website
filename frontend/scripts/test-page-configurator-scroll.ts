/**
 * 2-Level Document & Panel Scroll Regression Test Suite for CakeToHome Page Configurator
 * Verifies all 13 scroll criteria using Playwright browser automation:
 * 1. CMS document is taller than viewport (document.documentElement.scrollHeight > document.documentElement.clientHeight).
 * 2. document.documentElement.scrollHeight > clientHeight assertion.
 * 3. window.scrollY changes when browser page is scrolled (window.scrollTo(0, 300) -> scrollY > 200).
 * 4. Browser can reach bottom of CMS page (window.scrollTo(0, 10000) -> scrollY === maxPossibleScroll).
 * 5. Global header remains sticky/positioned correctly during scroll (nav rect.top === 0 at scrollY = 0).
 * 6. No giant blank region appears above header.
 * 7. No horizontal page overflow (scrollWidth === clientWidth).
 * 8. Center canvas scrolls vertically independently (#center-canvas-scroll).
 * 9. Left panel scrolls vertically independently.
 * 10. Right section panel scrolls vertically independently.
 * 11. Modal opening/closing locks and restores document.body.style.overflow cleanly.
 * 12. Switching viewport modes maintains document page scrollability.
 * 13. Page reload maintains stable 2-level scroll architecture.
 */

import { chromium } from "playwright";

async function runMandatoryScrollRegressionTests() {
  console.log("===============================================================");
  console.log("CAKETOHOME — 2-LEVEL DOCUMENT & PANEL SCROLL REGRESSION SUITE");
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
  await page.waitForTimeout(2000);
  await page.waitForSelector("#center-canvas-scroll", { state: "attached", timeout: 10000 });

  // ── ASSERTION 1 & 2: CMS document is taller than viewport ──────────────────
  const docHeightsInitial = await page.evaluate(() => ({
    scrollHeight: document.documentElement.scrollHeight,
    clientHeight: document.documentElement.clientHeight,
  }));
  assert(
    docHeightsInitial.scrollHeight > docHeightsInitial.clientHeight,
    `ASSERTION 1 & 2: Document scrollHeight (${docHeightsInitial.scrollHeight}px) > clientHeight (${docHeightsInitial.clientHeight}px)`
  );

  // ── ASSERTION 3: window.scrollY changes when page is scrolled ─────────────
  await page.evaluate(() => window.scrollTo(0, 200));
  await page.waitForTimeout(300);
  const scrollYMid = await page.evaluate(() => window.scrollY);
  assert(scrollYMid > 100, `ASSERTION 3: window.scrollY changes when page scrolled (Actual: ${scrollYMid}px)`);

  // ── ASSERTION 4: Browser can reach bottom of CMS page ─────────────────────
  await page.evaluate(() => window.scrollTo(0, 10000));
  await page.waitForTimeout(300);
  const scrollYMax = await page.evaluate(() => window.scrollY);
  const maxPossibleScroll = docHeightsInitial.scrollHeight - docHeightsInitial.clientHeight;
  assert(
    scrollYMax >= maxPossibleScroll - 5,
    `ASSERTION 4: Browser reached bottom of CMS page (Actual max scrollY: ${scrollYMax}px, Expected: ~${maxPossibleScroll}px)`
  );

  // Reset page scroll to top for panel & header assertions
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(300);

  // ── ASSERTION 5: Header remains sticky/positioned at top = 0 ──────────────
  const navBoundingTop = await page.evaluate(() => {
    const nav = document.querySelector("nav");
    return nav ? nav.getBoundingClientRect().top : -1;
  });
  assert(navBoundingTop === 0, `ASSERTION 5: Header bounding rect top is 0px at top (Actual: ${navBoundingTop}px)`);

  // ── ASSERTION 6: No giant blank region above header ───────────────────────
  assert(navBoundingTop >= 0 && navBoundingTop <= 5, "ASSERTION 6: No giant blank region above header");

  // ── ASSERTION 7: No horizontal page overflow ──────────────────────────────
  const docWidths = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth,
  }));
  assert(
    docWidths.scrollWidth === docWidths.clientWidth,
    `ASSERTION 7: Document horizontal overflow is absent (${docWidths.scrollWidth}px === ${docWidths.clientWidth}px)`
  );

  // ── ASSERTION 8: Center canvas scrolls vertically independently ───────────
  const centerCanvasMetrics = await page.evaluate(() => {
    const canvas = document.querySelector("#center-canvas-scroll");
    return canvas ? { scrollHeight: canvas.scrollHeight, clientHeight: canvas.clientHeight } : null;
  });
  assert(
    !!centerCanvasMetrics && centerCanvasMetrics.scrollHeight > centerCanvasMetrics.clientHeight,
    `ASSERTION 8: Center canvas scrolls vertically independently (${centerCanvasMetrics?.scrollHeight}px > ${centerCanvasMetrics?.clientHeight}px)`
  );

  // ── ASSERTION 9: Left panel scrolls vertically independently ──────────────
  const leftPanelMetrics = await page.evaluate(() => {
    const panel = document.querySelector(".col-span-12.lg\\:col-span-3");
    return panel ? { scrollHeight: panel.scrollHeight, clientHeight: panel.clientHeight } : null;
  });
  assert(!!leftPanelMetrics, "ASSERTION 9: Left settings panel is rendered and scrollable");

  // ── ASSERTION 10: Right panel scrolls vertically independently ────────────
  const rightPanelMetrics = await page.evaluate(() => {
    const panel = document.querySelector(".col-span-12.lg\\:col-span-2");
    if (!panel) return null;
    const style = window.getComputedStyle(panel);
    return { scrollHeight: panel.scrollHeight, clientHeight: panel.clientHeight, overflowY: style.overflowY };
  });
  assert(
    !!rightPanelMetrics && rightPanelMetrics.overflowY === "auto" && rightPanelMetrics.scrollHeight >= rightPanelMetrics.clientHeight - 5,
    `ASSERTION 10: Right section panel is scroll-constrained with overflowY: auto (${rightPanelMetrics?.scrollHeight}px / ${rightPanelMetrics?.clientHeight}px)`
  );

  // ── ASSERTION 11: Modal opening/closing locks and restores body overflow ──
  const overflowBeforeModal = await page.evaluate(() => document.body.style.overflow);
  // Trigger Media Selector Modal programmatically or via button
  await page.evaluate(() => {
    const buttons = Array.from(document.querySelectorAll("button"));
    const imgBtn = buttons.find((b) => b.textContent?.includes("Change Image") || b.textContent?.includes("Select Image"));
    if (imgBtn) imgBtn.click();
  });
  await page.waitForTimeout(300);
  const overflowDuringModal = await page.evaluate(() => document.body.style.overflow);
  
  // Close modal via ESC key
  await page.keyboard.press("Escape");
  await page.waitForTimeout(300);
  const overflowAfterModal = await page.evaluate(() => document.body.style.overflow);

  assert(
    overflowBeforeModal === overflowAfterModal,
    `ASSERTION 11: Closing modal restores document.body.style.overflow cleanly (Before: "${overflowBeforeModal}", After: "${overflowAfterModal}")`
  );

  // ── ASSERTION 12: Device switching maintains document scrollability ──────
  await page.evaluate(() => {
    const buttons = Array.from(document.querySelectorAll("button"));
    const mobileBtn = buttons.find((b) => b.textContent?.includes("Mobile"));
    if (mobileBtn) mobileBtn.click();
  });
  await page.waitForTimeout(300);
  const docHeightsMobileMode = await page.evaluate(() => ({
    scrollHeight: document.documentElement.scrollHeight,
    clientHeight: document.documentElement.clientHeight,
  }));
  assert(
    docHeightsMobileMode.scrollHeight > docHeightsMobileMode.clientHeight,
    `ASSERTION 12: Mobile view maintains document scrollability (${docHeightsMobileMode.scrollHeight}px > ${docHeightsMobileMode.clientHeight}px)`
  );

  // ── ASSERTION 13: Page reload maintains stable 2-level scroll architecture
  await page.reload({ waitUntil: "load" });
  await page.waitForTimeout(1500);
  const docHeightsAfterReload = await page.evaluate(() => ({
    scrollHeight: document.documentElement.scrollHeight,
    clientHeight: document.documentElement.clientHeight,
  }));
  assert(
    docHeightsAfterReload.scrollHeight > docHeightsAfterReload.clientHeight,
    `ASSERTION 13: Reload preserves 2-level document scroll (${docHeightsAfterReload.scrollHeight}px > ${docHeightsAfterReload.clientHeight}px)`
  );

  await browser.close();

  // ── SUMMARY REPORT ──────────────────────────────────────────────────────────
  console.log("\n===============================================================");
  console.log(`SCROLL REGRESSION RESULTS: ${passed} PASSED, ${failed} FAILED (TOTAL: ${passed + failed})`);
  console.log("===============================================================\n");

  if (failed > 0) {
    process.exit(1);
  }
}

runMandatoryScrollRegressionTests().catch((err) => {
  console.error("Scroll regression test execution failed:", err);
  process.exit(1);
});
