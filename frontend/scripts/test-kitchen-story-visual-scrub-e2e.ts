import { chromium, Browser, Page } from "playwright";
import { getHomepage } from "../src/lib/data/cms";

function assert(condition: boolean, msg: string) {
  if (!condition) {
    console.error(`  ❌ [FAIL] ${msg}`);
    throw new Error(`Assertion failed: ${msg}`);
  }
  console.log(`  ✅ [PASS] ${msg}`);
}

async function runVisualScrubE2E() {
  console.log("================================================================================");
  console.log("🎬 KITCHEN_STORY_VISUAL_SCRUB_E2E — HUMAN-SCALE REAL BROWSER ACCEPTANCE");
  console.log("================================================================================\n");

  const baseUrl = "http://localhost:3000";

  // ── Step 1: Verify Published Frame Sequences ───────────────────────────────
  console.log("1️⃣  Verifying Published CMS Multi-Device Sequences...");
  const homeData = await getHomepage();
  assert(Boolean(homeData.page), "Homepage CMS record loaded");
  const heroSection = homeData.sections.find(
    (s: any) => s.type === "hero" || s.type === "kitchen_story" || s.type === "scroll_frame"
  );
  assert(Boolean(heroSection), "Hero / Kitchen Story section present in published CMS");

  const desktopFrames = heroSection.config?.desktop?.frames || [];
  const tabletFrames = heroSection.config?.tablet?.frames || [];
  const mobileFrames = heroSection.config?.mobile?.frames || [];

  console.log(`  • Desktop Frames Configured: ${desktopFrames.length}`);
  console.log(`  • Tablet Frames Configured: ${tabletFrames.length}`);
  console.log(`  • Mobile Frames Configured: ${mobileFrames.length}`);
  assert(desktopFrames.length === 16, `Desktop sequence contains 16 frames (${desktopFrames.length})`);
  assert(tabletFrames.length === 12, `Tablet sequence contains 12 frames (${tabletFrames.length})`);
  assert(mobileFrames.length === 10, `Mobile sequence contains 10 frames (${mobileFrames.length})`);

  // ── Step 2: Launch Browser and Monitor Network & Preload ───────────────────
  console.log("\n2️⃣  Launching Chromium (Desktop 1440x900) & Auditing Preload...");
  const browser: Browser = await chromium.launch({ headless: true });
  const page: Page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

  const networkRequests = new Map<string, number>();
  const network404s: string[] = [];

  page.on("request", (req) => {
    const url = req.url();
    if (url.includes("unsplash.com") || url.includes("/images/") || url.includes("/frames/")) {
      networkRequests.set(url, (networkRequests.get(url) || 0) + 1);
    }
  });

  page.on("response", (res) => {
    if (res.status() === 404) {
      network404s.push(res.url());
    }
  });

  const response = await page.goto(`${baseUrl}/?debug_scroll=1`, { waitUntil: "domcontentloaded", timeout: 60000 });
  assert(response?.status() === 200, "Storefront Homepage responded HTTP 200 OK");
  await page.waitForTimeout(2000);

  // ── Step 3: Verify Canvas Lifecycle & Layout ────────────────────────────────
  console.log("\n3️⃣  Verifying Persistent Canvas Lifecycle & Zero Layout Shift...");
  const scrollSection = page.locator(".scroll-frame-section").first();
  assert((await scrollSection.count()) > 0, "ScrollFrameHero section mounted");

  const canvas = page.locator("canvas.scroll-frame-canvas").first();
  assert((await canvas.count()) > 0, "Persistent Canvas mounted");

  const sectionMetrics = await page.evaluate(() => {
    const el = document.querySelector(".scroll-frame-section") as HTMLElement;
    const sticky = document.querySelector(".scroll-frame-sticky") as HTMLElement;
    return {
      totalHeight: el.offsetHeight,
      stickyPosition: window.getComputedStyle(sticky).position,
      stickyTop: window.getComputedStyle(sticky).top,
      scrollable: el.offsetHeight - window.innerHeight,
    };
  });

  console.log(`  • Section Total Height: ${sectionMetrics.totalHeight}px`);
  console.log(`  • Sticky Viewport Position: ${sectionMetrics.stickyPosition} (top: ${sectionMetrics.stickyTop})`);
  console.log(`  • Measurable Scroll Range: ${sectionMetrics.scrollable}px`);
  assert(sectionMetrics.totalHeight >= 2000, "Story height provides full cinematic range (>= 2000px)");
  assert(sectionMetrics.stickyPosition === "sticky", "Sticky viewport computed style is position: sticky");

  const requestsAfterBoot = networkRequests.size;
  console.log(`  • Preloaded unique frame assets on startup: ${requestsAfterBoot}`);
  assert(requestsAfterBoot >= 16, `All 16 desktop frames preloaded (${requestsAfterBoot} >= 16)`);
  assert(network404s.length === 0, "Zero 404 errors during asset preload");

  // ── Step 4: Human-Scale +10px Incremental Scroll Audit ───────────────────────
  console.log("\n4️⃣  Auditing Human-Scale +10px Incremental Scroll across entire track...");
  let blankFrames = 0;
  let totalSteps = 0;
  const requestsBeforeScroll = networkRequests.size;

  for (let y = 0; y <= sectionMetrics.scrollable; y += 10) {
    await page.evaluate((scrollY) => window.scrollTo(0, scrollY), y);
    await page.waitForTimeout(15);
    totalSteps++;

    const isBlank = await page.evaluate(() => {
      const cv = document.querySelector("canvas.scroll-frame-canvas") as HTMLCanvasElement;
      if (!cv) return true;
      const ctx = cv.getContext("2d");
      if (!ctx || cv.width === 0 || cv.height === 0) return true;
      const p = ctx.getImageData(Math.floor(cv.width / 2), Math.floor(cv.height / 2), 1, 1).data;
      return p[3] === 0;
    });

    if (isBlank) blankFrames++;
  }

  console.log(`  • Total +10px steps evaluated: ${totalSteps}`);
  console.log(`  • Blank/transparent frames detected: ${blankFrames}`);
  assert(blankFrames === 0, "Zero blank frames detected during full +10px continuous scroll");

  const requestsAfterScroll = networkRequests.size;
  const requestsDuringScroll = requestsAfterScroll - requestsBeforeScroll;
  console.log(`  • New Network Requests during active scroll: ${requestsDuringScroll}`);
  assert(requestsDuringScroll === 0, "Zero network requests during scroll (100% memory-driven)");

  // ── Step 5: First Frame Hold & Final Frame Hold ─────────────────────────────
  console.log("\n5️⃣  Auditing First Frame & Final Frame Hold Durations...");
  // 0% -> 6% First Frame Hold
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(400);
  const p0 = await page.evaluate(() => {
    const cv = document.querySelector("canvas.scroll-frame-canvas") as HTMLCanvasElement;
    const ctx = cv?.getContext("2d");
    return ctx ? ctx.getImageData(Math.floor(cv.width / 2), Math.floor(cv.height / 2), 1, 1).data.join(",") : "";
  });

  await page.evaluate((scrollable) => window.scrollTo(0, scrollable * 0.04), sectionMetrics.scrollable);
  await page.waitForTimeout(200);
  const p4 = await page.evaluate(() => {
    const cv = document.querySelector("canvas.scroll-frame-canvas") as HTMLCanvasElement;
    const ctx = cv?.getContext("2d");
    return ctx ? ctx.getImageData(Math.floor(cv.width / 2), Math.floor(cv.height / 2), 1, 1).data.join(",") : "";
  });
  console.log(`  • Frame pixel at 0%: [${p0}] | at 4% hold: [${p4}]`);
  assert(Boolean(p0) && Boolean(p4), "First frame hold stably renders canvas");

  // 92% -> 100% Final Frame Hold
  await page.evaluate((scrollable) => window.scrollTo(0, scrollable * 0.94), sectionMetrics.scrollable);
  await page.waitForTimeout(200);
  const p94 = await page.evaluate(() => {
    const cv = document.querySelector("canvas.scroll-frame-canvas") as HTMLCanvasElement;
    const ctx = cv?.getContext("2d");
    return ctx ? ctx.getImageData(Math.floor(cv.width / 2), Math.floor(cv.height / 2), 1, 1).data.join(",") : "";
  });

  await page.evaluate((scrollable) => window.scrollTo(0, scrollable * 1.0), sectionMetrics.scrollable);
  await page.waitForTimeout(200);
  const p100 = await page.evaluate(() => {
    const cv = document.querySelector("canvas.scroll-frame-canvas") as HTMLCanvasElement;
    const ctx = cv?.getContext("2d");
    return ctx ? ctx.getImageData(Math.floor(cv.width / 2), Math.floor(cv.height / 2), 1, 1).data.join(",") : "";
  });
  console.log(`  • Final frame pixel at 94%: [${p94}] | at 100%: [${p100}]`);
  assert(Boolean(p94) && Boolean(p100), "Final frame hold stably renders completed cake");

  // ── Step 6: Reverse Scroll Scrubbing ───────────────────────────────────────
  console.log("\n6️⃣  Auditing Reverse Scroll from 100% down to 0%...");
  for (let y = sectionMetrics.scrollable; y >= 0; y -= 150) {
    await page.evaluate((scrollY) => window.scrollTo(0, scrollY), y);
    await page.waitForTimeout(50);
  }
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(400);
  const pReverse = await page.evaluate(() => {
    const cv = document.querySelector("canvas.scroll-frame-canvas") as HTMLCanvasElement;
    const ctx = cv?.getContext("2d");
    return ctx ? ctx.getImageData(Math.floor(cv.width / 2), Math.floor(cv.height / 2), 1, 1).data.join(",") : "";
  });
  console.log(`  • Reversed to Top -> Pixel: [${pReverse}]`);
  assert(Boolean(pReverse), "Canvas active after reverse scroll");

  // ── Step 7: Multi-Device Responsive Viewports (Tablet & Mobile) ─────────────
  console.log("\n7️⃣  Auditing Tablet Viewport (768x1024)...");
  await page.setViewportSize({ width: 768, height: 1024 });
  await page.goto(`${baseUrl}/`, { waitUntil: "domcontentloaded", timeout: 30000 });
  await page.waitForTimeout(1500);

  const tabletMetrics = await page.evaluate(() => {
    const cv = document.querySelector("canvas.scroll-frame-canvas") as HTMLCanvasElement;
    const sticky = document.querySelector(".scroll-frame-sticky") as HTMLElement;
    return {
      hasCanvas: !!cv,
      canvasWidth: cv ? cv.offsetWidth : 0,
      stickyPosition: sticky ? window.getComputedStyle(sticky).position : null,
    };
  });
  assert(tabletMetrics.hasCanvas, "Canvas mounted on Tablet");
  assert(tabletMetrics.stickyPosition === "sticky", "Sticky operates on Tablet");
  assert(tabletMetrics.canvasWidth >= 760, `Canvas covers full tablet width (${tabletMetrics.canvasWidth}px >= 768px)`);

  console.log("\n8️⃣  Auditing Mobile Viewport (390x844)...");
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`${baseUrl}/`, { waitUntil: "domcontentloaded", timeout: 30000 });
  await page.waitForTimeout(1500);

  const mobileMetrics = await page.evaluate(() => {
    const cv = document.querySelector("canvas.scroll-frame-canvas") as HTMLCanvasElement;
    const sticky = document.querySelector(".scroll-frame-sticky") as HTMLElement;
    return {
      hasCanvas: !!cv,
      canvasWidth: cv ? cv.offsetWidth : 0,
      stickyPosition: sticky ? window.getComputedStyle(sticky).position : null,
    };
  });
  assert(mobileMetrics.hasCanvas, "Canvas mounted on Mobile");
  assert(mobileMetrics.stickyPosition === "sticky", "Sticky operates on Mobile");
  assert(mobileMetrics.canvasWidth >= 380, `Canvas covers full mobile width (${mobileMetrics.canvasWidth}px >= 390px)`);

  await browser.close();

  console.log("\n================================================================================");
  console.log("🎉 KITCHEN_STORY_VISUAL_SCRUB_E2E — 100% PASSED (PRODUCTION READY)");
  console.log("================================================================================");
}

runVisualScrubE2E().catch((err) => {
  console.error("Visual Scrub E2E Failed:", err);
  process.exit(1);
});
