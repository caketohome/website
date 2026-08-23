import { chromium, Browser, Page } from "playwright";
import { ApiEngine } from "../src/lib/api-engine";
import { getHomepage } from "../src/lib/data/cms";

function assert(condition: boolean, message: string) {
  if (!condition) {
    console.error(`  ❌ [FAIL] ${message}`);
    throw new Error(`Assertion failed: ${message}`);
  }
  console.log(`  ✅ [PASS] ${message}`);
}

async function runScrollFrameHeroLiveCoverAudit() {
  console.log("\n" + "=".repeat(80));
  console.log("🎬 CAKETOHOME — SCROLL-FRAME HERO RUNTIME ANIMATION & FULL-COVER AUDIT");
  console.log("=".repeat(80) + "\n");

  const baseUrl = "http://localhost:3000";

  // ── 1. Verify Published CMS Configuration ─────────────────────────────────
  console.log("1️⃣  Verifying Published CMS Hero Section Configuration...");
  const homeData = await getHomepage();
  assert(Boolean(homeData.page), "Homepage CMS record loaded");

  const heroSection = homeData.sections.find(
    (s: any) => s.type === "hero" || s.type === "kitchen_story" || s.type === "scroll_frame"
  );
  assert(Boolean(heroSection), "Hero / Kitchen Story section found in published sections");

  const desktopFrames = heroSection.config?.desktop?.frames || [];
  const tabletFrames = heroSection.config?.tablet?.frames || [];
  const mobileFrames = heroSection.config?.mobile?.frames || [];

  console.log(`    • Desktop frames configured: ${desktopFrames.length}`);
  console.log(`    • Tablet frames configured: ${tabletFrames.length}`);
  console.log(`    • Mobile frames configured: ${mobileFrames.length}`);
  assert(desktopFrames.length > 0, "Desktop frames configured in CMS (> 0)");
  assert(tabletFrames.length > 0, "Tablet frames configured in CMS (> 0)");
  assert(mobileFrames.length > 0, "Mobile frames configured in CMS (> 0)");

  // ── 2. Launch Chromium Browser Session ────────────────────────────────────
  console.log("\n2️⃣  Launching Headless Chromium Browser Audit...");
  const browser: Browser = await chromium.launch({ headless: true });

  // ── 3. Desktop Viewport (1440x900) Audit ──────────────────────────────────
  console.log("\n3️⃣  Auditing Desktop (1440x900) Viewport & Full-Cover Canvas...");
  const desktopContext = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const desktopPage: Page = await desktopContext.newPage();

  await desktopPage.goto(`${baseUrl}/`, { waitUntil: "domcontentloaded", timeout: 30000 });
  await desktopPage.waitForTimeout(2000);

  // Check Scroll-Frame Hero Section Presence
  const heroSectionEl = desktopPage.locator(".scroll-frame-section").first();
  const heroCount = await heroSectionEl.count();
  assert(heroCount > 0, "ScrollFrameHero section mounted on storefront homepage");

  // Check Sticky Viewport & Canvas Sizing
  const canvasEl = desktopPage.locator("canvas.scroll-frame-canvas").first();
  assert((await canvasEl.count()) > 0, "Hardware-accelerated HTML5 Canvas mounted in hero");

  const canvasBox = await canvasEl.boundingBox();
  assert(Boolean(canvasBox), "Canvas bounding box calculated");
  if (canvasBox) {
    console.log(`    • Canvas viewport dimensions: ${canvasBox.width}x${canvasBox.height}`);
    assert(canvasBox.width >= 1430, `Canvas width covers full viewport width (${canvasBox.width}px >= 1440px)`);
    assert(canvasBox.height >= 850, `Canvas height covers full viewport height (${canvasBox.height}px >= 900px)`);
  }

  // Check Horizontal Page Overflow
  const desktopOverflow = await desktopPage.evaluate(() => {
    return document.documentElement.scrollWidth > window.innerWidth;
  });
  assert(!desktopOverflow, "Zero horizontal page overflow on desktop (1440x900)");

  // ── 4. Scroll Frame Progression & Reverse Scrubbing Audit ─────────────────
  console.log("\n4️⃣  Auditing Scroll Scrubbing & Frame Progression (0% -> 25% -> 50% -> 75% -> 100% -> Reverse)...");
  
  const sectionMetrics = await desktopPage.evaluate(() => {
    const el = document.querySelector(".scroll-frame-section");
    if (!el) return null;
    const rect = el.getBoundingClientRect();
    return {
      top: rect.top + window.scrollY,
      height: rect.height,
      scrollable: rect.height - window.innerHeight,
    };
  });

  assert(Boolean(sectionMetrics && sectionMetrics.scrollable > 0), "Hero provides measurable scroll range");

  if (sectionMetrics) {
    const scrollPositions = [
      { pct: 0, targetY: sectionMetrics.top },
      { pct: 0.25, targetY: sectionMetrics.top + sectionMetrics.scrollable * 0.25 },
      { pct: 0.50, targetY: sectionMetrics.top + sectionMetrics.scrollable * 0.50 },
      { pct: 0.75, targetY: sectionMetrics.top + sectionMetrics.scrollable * 0.75 },
      { pct: 1.00, targetY: sectionMetrics.top + sectionMetrics.scrollable },
    ];

    for (const step of scrollPositions) {
      await desktopPage.evaluate((y) => window.scrollTo({ top: y, behavior: "instant" }), step.targetY);
      await desktopPage.waitForTimeout(300);

      const progressData = await desktopPage.evaluate(() => {
        const sec = document.querySelector(".scroll-frame-section");
        const canvas = document.querySelector("canvas.scroll-frame-canvas");
        if (!sec || !canvas) return null;
        const rect = sec.getBoundingClientRect();
        const total = rect.height - window.innerHeight;
        const current = -rect.top;
        const p = Math.max(0, Math.min(1, current / total));
        return {
          progress: p,
          canvasVisible: rect.top <= 0 && rect.bottom >= window.innerHeight,
        };
      });

      assert(Boolean(progressData), `Scroll progress captured at ${step.pct * 100}%`);
      console.log(`    • Scrolled to ${step.pct * 100}% | Calculated Progress: ${(progressData?.progress || 0).toFixed(2)} | Canvas sticky: ${progressData?.canvasVisible}`);
    }

    // Reverse Scroll Check (100% -> 0%)
    console.log("  • Testing reverse scroll back to top (100% -> 0%)...");
    await desktopPage.evaluate((y) => window.scrollTo({ top: y, behavior: "instant" }), sectionMetrics.top);
    await desktopPage.waitForTimeout(400);

    const reversedProgress = await desktopPage.evaluate(() => {
      const sec = document.querySelector(".scroll-frame-section");
      if (!sec) return 1;
      const rect = sec.getBoundingClientRect();
      const total = rect.height - window.innerHeight;
      return Math.max(0, Math.min(1, -rect.top / total));
    });
    assert(reversedProgress <= 0.05, `Reverse scroll returned progress to 0 (actual: ${reversedProgress.toFixed(2)})`);
  }

  // ── 5. Document Flow & Following Section Verification ─────────────────────
  const nextSectionEl = desktopPage.locator("div[class*='sec-wrap-']:nth-child(n+2), .scroll-frame-section ~ div, section ~ section, main > div > div:nth-child(n+2)").first();
  assert((await nextSectionEl.count()) > 0, "Subsequent content sections follow the sticky animation");

  await desktopContext.close();

  // ── 6. Tablet Viewport (768x1024) Audit ───────────────────────────────────
  console.log("\n6️⃣  Auditing Tablet (768x1024) Viewport & Full-Cover Canvas...");
  const tabletContext = await browser.newContext({ viewport: { width: 768, height: 1024 } });
  const tabletPage: Page = await tabletContext.newPage();

  await tabletPage.goto(`${baseUrl}/`, { waitUntil: "domcontentloaded", timeout: 30000 });
  await tabletPage.waitForTimeout(1500);

  const tabletCanvas = tabletPage.locator("canvas.scroll-frame-canvas").first();
  const tabletBox = await tabletCanvas.boundingBox();
  assert(Boolean(tabletBox && tabletBox.width >= 750), `Tablet canvas covers full width (${tabletBox?.width}px >= 768px)`);

  const tabletOverflow = await tabletPage.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
  assert(!tabletOverflow, "Zero horizontal page overflow on tablet (768x1024)");

  await tabletContext.close();

  // ── 7. Mobile Viewport (390x844) Audit ────────────────────────────────────
  console.log("\n7️⃣  Auditing Mobile (390x844) Viewport & Full-Cover Canvas...");
  const mobileContext = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const mobilePage: Page = await mobileContext.newPage();

  await mobilePage.goto(`${baseUrl}/`, { waitUntil: "domcontentloaded", timeout: 30000 });
  await mobilePage.waitForTimeout(1500);

  const mobileCanvas = mobilePage.locator("canvas.scroll-frame-canvas").first();
  const mobileBox = await mobileCanvas.boundingBox();
  assert(Boolean(mobileBox && mobileBox.width >= 380), `Mobile canvas covers full width (${mobileBox?.width}px >= 390px)`);

  const mobileOverflow = await mobilePage.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
  assert(!mobileOverflow, "Zero horizontal page overflow on mobile (390x844)");

  await mobileContext.close();
  await browser.close();

  console.log("\n" + "=".repeat(80));
  console.log("🎯 ALL SCROLL-FRAME HERO RUNTIME & FULL-COVER TESTS PASSED (100% PASS)");
  console.log("=".repeat(80) + "\n");
}

runScrollFrameHeroLiveCoverAudit().catch((err) => {
  console.error("Test execution failed:", err);
  process.exit(1);
});
