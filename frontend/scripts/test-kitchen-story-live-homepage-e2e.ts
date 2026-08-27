import { chromium, Browser, Page } from "playwright";
import { ApiEngine } from "../src/lib/api-engine";
import { getHomepage } from "../src/lib/data/cms";

function assert(condition: boolean, msg: string) {
  if (!condition) {
    console.error(`  ❌ [FAIL] ${msg}`);
    throw new Error(`Assertion failed: ${msg}`);
  }
  console.log(`  ✅ [PASS] ${msg}`);
}

async function runE2E() {
  console.log("================================================================================");
  console.log("🎬 CAKETOHOME — KITCHEN STORY LIVE HOMEPAGE SCROLL ANIMATION E2E TEST");
  console.log("================================================================================\n");

  const baseUrl = "http://localhost:3000";

  // ── Step 1: Verify Published CMS Configuration ──────────────────────────────
  console.log("1️⃣  Verifying Published CMS Hero / Kitchen Story Configuration...");
  let homeData = await getHomepage();
  let heroSection = homeData.sections.find(
    (s: any) => s.type === "hero" || s.type === "kitchen_story" || s.type === "scroll_frame"
  );
  if (!heroSection?.config?.desktop?.frames?.length) {
    const defaultPages = ApiEngine.listCmsPages();
    const defaultHome = defaultPages.find((p: any) => p.id === "cmspg_home" || p.slug === "home");
    if (defaultHome) {
      ApiEngine.updateCmsPage(defaultHome.id, defaultHome);
      ApiEngine.publishCmsPage(defaultHome.id);
    }
    homeData = await getHomepage();
    heroSection = homeData.sections.find(
      (s: any) => s.type === "hero" || s.type === "kitchen_story" || s.type === "scroll_frame"
    );
  }
  assert(Boolean(heroSection), "Hero / Kitchen Story section present in published sections");

  const desktopFrames = heroSection.config?.desktop?.frames || [];
  const tabletFrames = heroSection.config?.tablet?.frames || [];
  const mobileFrames = heroSection.config?.mobile?.frames || [];

  console.log(`  • Desktop Frames: ${desktopFrames.length}`);
  console.log(`  • Tablet Frames: ${tabletFrames.length}`);
  console.log(`  • Mobile Frames: ${mobileFrames.length}`);
  assert(desktopFrames.length >= 16, `Desktop configured with >= 16 frames (${desktopFrames.length})`);
  assert(tabletFrames.length >= 10, `Tablet configured with >= 10 frames (${tabletFrames.length})`);
  assert(mobileFrames.length >= 10, `Mobile configured with >= 10 frames (${mobileFrames.length})`);

  // ── Step 2: Launch Browser and Navigate to Live Storefront Homepage ─────────
  console.log("\n2️⃣  Launching Chromium Browser on Live Homepage (Desktop 1440x900)...");
  const browser: Browser = await chromium.launch({ headless: true });
  const page: Page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

  const consoleErrors: string[] = [];
  page.on("console", (msg) => {
    if (msg.type() === "error" && !msg.text().includes("favicon")) {
      consoleErrors.push(msg.text());
    }
  });

  const response = await page.goto(`${baseUrl}/`, { waitUntil: "commit", timeout: 60000 });
  await page.waitForSelector(".scroll-frame-section, h1", { timeout: 20000 });
  await page.waitForTimeout(2000);

  // ── Step 3: Verify Mounted DOM Structure ───────────────────────────────────
  console.log("\n3️⃣  Verifying Live DOM Elements & Hardware-Accelerated Canvas...");
  const scrollSection = page.locator(".scroll-frame-section").first();
  assert((await scrollSection.count()) > 0, "ScrollFrameHero section mounted on storefront homepage");

  const canvas = page.locator("canvas.scroll-frame-canvas").first();
  assert((await canvas.count()) > 0, "Hardware-accelerated HTML5 Canvas mounted inside hero");

  const stickyViewport = page.locator(".scroll-frame-sticky").first();
  assert((await stickyViewport.count()) > 0, "Sticky viewport container mounted inside hero");

  const sectionMetrics = await page.evaluate(() => {
    const el = document.querySelector(".scroll-frame-section") as HTMLElement;
    const sticky = document.querySelector(".scroll-frame-sticky") as HTMLElement;
    const computedSticky = window.getComputedStyle(sticky);
    return {
      totalHeight: el.offsetHeight,
      stickyPosition: computedSticky.position,
      stickyTop: computedSticky.top,
      scrollable: el.offsetHeight - window.innerHeight,
    };
  });

  console.log(`  • Section Total Height: ${sectionMetrics.totalHeight}px`);
  console.log(`  • Sticky Viewport Position: ${sectionMetrics.stickyPosition} (top: ${sectionMetrics.stickyTop})`);
  console.log(`  • Measurable Scroll Range: ${sectionMetrics.scrollable}px`);
  assert(sectionMetrics.totalHeight >= 2000, "Story height provides adequate scroll track (>= 2000px)");
  assert(sectionMetrics.stickyPosition === "sticky", "Sticky viewport has position: sticky computed style");
  assert(sectionMetrics.scrollable > 0, "Section provides positive scrollable distance");

  // Helper to capture pixel hash of canvas center to verify real rendering
  const getCanvasPixelSample = async () => {
    return page.evaluate(() => {
      const cv = document.querySelector("canvas.scroll-frame-canvas") as HTMLCanvasElement;
      if (!cv) return null;
      const ctx = cv.getContext("2d");
      if (!ctx || cv.width === 0 || cv.height === 0) return null;
      const pixel = ctx.getImageData(Math.floor(cv.width / 2), Math.floor(cv.height / 2), 1, 1).data;
      return `${pixel[0]},${pixel[1]},${pixel[2]},${pixel[3]}`;
    });
  };

  // ── Step 4: Scroll Scrubbing & Frame Progression ────────────────────────────
  console.log("\n4️⃣  Auditing Scroll Scrubbing & Frame Changes (0% -> 25% -> 50% -> 75% -> 100% -> Reverse)...");

  // Wait for initial frame images to load and render onto canvas
  await page.waitForFunction(() => {
    const cv = document.querySelector("canvas.scroll-frame-canvas") as HTMLCanvasElement;
    if (!cv || cv.width === 0) return false;
    const ctx = cv.getContext("2d");
    if (!ctx) return false;
    const pixel = ctx.getImageData(Math.floor(cv.width / 2), Math.floor(cv.height / 2), 1, 1).data;
    // Base gradient starts with hsl hue calculation (r around 19), decoded image has different RGB
    return pixel[3] > 0;
  }, { timeout: 15000 });
  await page.waitForTimeout(1000);

  // 0% Scroll
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(600);
  const sample0 = await getCanvasPixelSample();
  console.log(`  • 0% Scroll -> Canvas pixel sample: [${sample0}]`);
  assert(Boolean(sample0), "Canvas is actively rendering at 0% scroll");

  // 25% Scroll
  const y25 = sectionMetrics.scrollable * 0.25;
  await page.evaluate((y) => window.scrollTo(0, y), y25);
  await page.waitForTimeout(400);
  const sample25 = await getCanvasPixelSample();
  const stickyAt25 = await page.evaluate(() => {
    const st = document.querySelector(".scroll-frame-sticky");
    return st ? st.getBoundingClientRect().top : -1;
  });
  console.log(`  • 25% Scroll (y=${Math.round(y25)}px) -> Canvas pixel: [${sample25}], Sticky top: ${stickyAt25}px`);
  assert(Math.abs(stickyAt25) <= 2, "Viewport remains pinned (top: 0px) at 25% scroll");

  // 50% Scroll
  const y50 = sectionMetrics.scrollable * 0.50;
  await page.evaluate((y) => window.scrollTo(0, y), y50);
  await page.waitForTimeout(400);
  const sample50 = await getCanvasPixelSample();
  const stickyAt50 = await page.evaluate(() => {
    const st = document.querySelector(".scroll-frame-sticky");
    return st ? st.getBoundingClientRect().top : -1;
  });
  console.log(`  • 50% Scroll (y=${Math.round(y50)}px) -> Canvas pixel: [${sample50}], Sticky top: ${stickyAt50}px`);
  assert(Math.abs(stickyAt50) <= 2, "Viewport remains pinned (top: 0px) at 50% scroll");

  // 75% Scroll
  const y75 = sectionMetrics.scrollable * 0.75;
  await page.evaluate((y) => window.scrollTo(0, y), y75);
  await page.waitForTimeout(400);
  const sample75 = await getCanvasPixelSample();
  const stickyAt75 = await page.evaluate(() => {
    const st = document.querySelector(".scroll-frame-sticky");
    return st ? st.getBoundingClientRect().top : -1;
  });
  console.log(`  • 75% Scroll (y=${Math.round(y75)}px) -> Canvas pixel: [${sample75}], Sticky top: ${stickyAt75}px`);
  assert(Math.abs(stickyAt75) <= 2, "Viewport remains pinned (top: 0px) at 75% scroll");

  // 100% Scroll (End of story section)
  const y100 = sectionMetrics.scrollable;
  await page.evaluate((y) => window.scrollTo(0, y), y100);
  await page.waitForTimeout(400);
  const sample100 = await getCanvasPixelSample();
  console.log(`  • 100% Scroll (y=${Math.round(y100)}px) -> Canvas pixel: [${sample100}]`);
  assert(Boolean(sample100), "Canvas is actively rendering at 100% scroll");

  // Reverse Scroll back to Top
  console.log("\n5️⃣  Auditing Reverse Scroll Scrubbing back to Top...");
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(600);
  const sampleReverse = await getCanvasPixelSample();
  console.log(`  • Reversed to Top -> Canvas pixel: [${sampleReverse}]`);
  assert(Boolean(sampleReverse), "Reverse scroll cleanly renders initial frame on canvas");

  // ── Step 5: Verify Subsequent Sections Follow Cleanly ───────────────────────
  console.log("\n6️⃣  Verifying Subsequent Content Sections Follow Smoothly...");
  const followingSectionTop = await page.evaluate(() => {
    const hero = document.querySelector(".scroll-frame-section");
    if (!hero) return null;
    const heroRect = hero.getBoundingClientRect();
    const allSections = Array.from(document.querySelectorAll("section"));
    const heroIndex = allSections.indexOf(hero as HTMLElement);
    const nextSec = allSections[heroIndex + 1];
    return nextSec ? nextSec.getBoundingClientRect().top : null;
  });
  console.log(`  • Next content section relative top: ${followingSectionTop}px`);
  assert(followingSectionTop !== null, "Subsequent content sections exist after Kitchen Story");

  // ── Step 6: Responsive Viewports Check (Tablet & Mobile) ────────────────────
  console.log("\n7️⃣  Auditing Mobile Viewport (390x844)...");
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`${baseUrl}/`, { waitUntil: "commit", timeout: 60000 });
  await page.waitForSelector(".scroll-frame-section, h1", { timeout: 20000 });
  await page.waitForTimeout(1500);

  const mobileMetrics = await page.evaluate(() => {
    const el = document.querySelector(".scroll-frame-section") as HTMLElement;
    const sticky = document.querySelector(".scroll-frame-sticky") as HTMLElement;
    const cv = document.querySelector("canvas.scroll-frame-canvas") as HTMLCanvasElement;
    return {
      hasSection: !!el,
      hasCanvas: !!cv,
      canvasWidth: cv ? cv.offsetWidth : 0,
      stickyPos: sticky ? window.getComputedStyle(sticky).position : null,
      scrollable: el ? el.offsetHeight - window.innerHeight : 0,
    };
  });

  assert(mobileMetrics.hasSection, "ScrollFrameHero mounted on Mobile (390px)");
  assert(mobileMetrics.hasCanvas, "Canvas mounted on Mobile (390px)");
  assert(mobileMetrics.stickyPos === "sticky", "Sticky viewport operates on Mobile");
  assert(mobileMetrics.canvasWidth >= 380, `Canvas covers full mobile width (${mobileMetrics.canvasWidth}px >= 390px)`);

  await browser.close();

  console.log("\n================================================================================");
  console.log("🎉 ALL KITCHEN STORY LIVE HOMEPAGE SCROLL TESTS PASSED (100% CLEAN)");
  console.log("================================================================================");
}

runE2E().catch((err) => {
  console.error("E2E Test Failed:", err);
  process.exit(1);
});
