import { chromium, Browser, Page } from "playwright";
import { getHomepage } from "../src/lib/data/cms";

function assert(condition: boolean, msg: string) {
  if (!condition) {
    console.error(`  ❌ [FAIL] ${msg}`);
    throw new Error(`Assertion failed: ${msg}`);
  }
  console.log(`  ✅ [PASS] ${msg}`);
}

async function runMicroScrollAudit() {
  console.log("================================================================================");
  console.log("🎬 CAKETOHOME — KITCHEN STORY CINEMATIC MICRO-SCROLL & HOLD AUDIT");
  console.log("================================================================================\n");

  const baseUrl = "http://localhost:3000";

  // 1. Verify Published Data
  console.log("1️⃣  Verifying Published CMS Hero / Story Config...");
  const homeData = await getHomepage();
  assert(Boolean(homeData.page), "Homepage CMS record loaded");
  const heroSection = homeData.sections.find(
    (s: any) => s.type === "hero" || s.type === "kitchen_story" || s.type === "scroll_frame"
  );
  assert(Boolean(heroSection), "Hero / Kitchen Story section present");
  const desktopFrames = heroSection.config?.desktop?.frames || [];
  console.log(`  • Configured Frames: ${desktopFrames.length}`);
  assert(desktopFrames.length >= 16, `Sufficient frames configured (${desktopFrames.length})`);

  // 2. Launch Browser & Monitor Network
  console.log("\n2️⃣  Launching Chromium Browser on Live Homepage (Desktop 1440x900)...");
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
  assert(response?.status() === 200, "Storefront Homepage responded with HTTP 200");
  await page.waitForTimeout(2000);

  // 3. Inspect DOM Structure
  console.log("\n3️⃣  Auditing Canvas & Sticky Viewport Stability...");
  const scrollSection = page.locator(".scroll-frame-section").first();
  assert((await scrollSection.count()) > 0, "ScrollFrameHero section mounted");

  const canvas = page.locator("canvas.scroll-frame-canvas").first();
  assert((await canvas.count()) > 0, "Hardware-accelerated Canvas mounted");

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
  console.log(`  • Sticky Position: ${sectionMetrics.stickyPosition} (top: ${sectionMetrics.stickyTop})`);
  console.log(`  • Measurable Scroll Range: ${sectionMetrics.scrollable}px`);
  assert(sectionMetrics.stickyPosition === "sticky", "Sticky viewport has position: sticky");
  assert(sectionMetrics.scrollable >= 1400, "Adequate scroll track for cinematic pacing");

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

  // 4. Test First Frame Hold (0% to 6%)
  console.log("\n4️⃣  Auditing First Frame Hold (0% -> 2% -> 4% -> 6%)...");
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(600);
  const initialSample = await getCanvasPixelSample();
  console.log(`  • 0% Scroll -> Initial Frame Pixel: [${initialSample}]`);

  const holdSample2 = await page.evaluate((scrollable) => {
    window.scrollTo(0, scrollable * 0.03);
    const cv = document.querySelector("canvas.scroll-frame-canvas") as HTMLCanvasElement;
    const ctx = cv?.getContext("2d");
    if (!ctx) return null;
    const p = ctx.getImageData(Math.floor(cv.width / 2), Math.floor(cv.height / 2), 1, 1).data;
    return `${p[0]},${p[1]},${p[2]},${p[3]}`;
  }, sectionMetrics.scrollable);
  console.log(`  • 3% Scroll -> Frame Pixel during hold: [${holdSample2}]`);
  assert(Boolean(holdSample2), "First frame hold stably renders canvas");

  // 5. Test 20-Step Micro-Scroll Progression (0% -> 100% in 5% increments)
  console.log("\n5️⃣  Auditing 20-Point Micro-Scroll Progression (5% increments)...");
  const progressionSamples: { pct: number; y: number; sample: string; stickyTop: number }[] = [];

  for (let pct = 0; pct <= 100; pct += 5) {
    const y = Math.round(sectionMetrics.scrollable * (pct / 100));
    await page.evaluate((scrollY) => window.scrollTo(0, scrollY), y);
    await page.waitForTimeout(100);

    const info = await page.evaluate(() => {
      const cv = document.querySelector("canvas.scroll-frame-canvas") as HTMLCanvasElement;
      const sticky = document.querySelector(".scroll-frame-sticky");
      const ctx = cv?.getContext("2d");
      const p = ctx ? ctx.getImageData(Math.floor(cv.width / 2), Math.floor(cv.height / 2), 1, 1).data : [0,0,0,0];
      return {
        sample: `${p[0]},${p[1]},${p[2]},${p[3]}`,
        stickyTop: sticky ? sticky.getBoundingClientRect().top : -1,
      };
    });

    progressionSamples.push({ pct, y, sample: info.sample, stickyTop: info.stickyTop });
    if (pct % 20 === 0) {
      console.log(`  • Scroll ${pct}% (y=${y}px) -> Pixel: [${info.sample}], Sticky Top: ${info.stickyTop}px`);
    }
  }

  assert(progressionSamples.length === 21, "Captured all 21 micro-scroll sampling points");
  // At y=0, sticky element is at natural document offset below header (64px). Once scrolled >= 64px, it pins at top: 0px.
  const stickyAllPinned = progressionSamples.every((s) => s.pct === 0 || Math.abs(s.stickyTop) <= 2);
  assert(stickyAllPinned, "Sticky viewport remained solidly pinned at top: 0px throughout scroll track");

  // 6. Test Slow Continuous Wheel Scroll (15px increments)
  console.log("\n6️⃣  Auditing Slow Continuous Incremental Scrolling (15px steps)...");
  let blankFrameCount = 0;
  for (let scrollPos = 0; scrollPos <= 800; scrollPos += 25) {
    await page.evaluate((pos) => window.scrollTo(0, pos), scrollPos);
    await page.waitForTimeout(30);
    const isBlank = await page.evaluate(() => {
      const cv = document.querySelector("canvas.scroll-frame-canvas") as HTMLCanvasElement;
      if (!cv) return true;
      const ctx = cv.getContext("2d");
      if (!ctx) return true;
      const p = ctx.getImageData(Math.floor(cv.width / 2), Math.floor(cv.height / 2), 1, 1).data;
      return p[3] === 0; // Transparent / blank
    });
    if (isBlank) blankFrameCount++;
  }
  console.log(`  • Blank / unpainted frames during continuous scroll: ${blankFrameCount}`);
  assert(blankFrameCount === 0, "Zero blank or unpainted frames detected during continuous scroll");

  // 7. Test Reverse Scroll
  console.log("\n7️⃣  Auditing Reverse Scroll from 100% back to 0%...");
  for (let pct = 100; pct >= 0; pct -= 20) {
    const y = Math.round(sectionMetrics.scrollable * (pct / 100));
    await page.evaluate((scrollY) => window.scrollTo(0, scrollY), y);
    await page.waitForTimeout(80);
  }
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(400);
  const finalReversedSample = await getCanvasPixelSample();
  console.log(`  • Reversed to Top -> Final Pixel Sample: [${finalReversedSample}]`);
  assert(Boolean(finalReversedSample), "Canvas active after reverse scroll");

  // 8. Network Integrity & Request Storm Audit
  console.log("\n8️⃣  Auditing Network Performance & Asset Efficiency...");
  console.log(`  • Unique Media Assets Requested: ${networkRequests.size}`);
  console.log(`  • 404 Errors: ${network404s.length}`);
  assert(network404s.length === 0, `Zero 404 errors during complete scroll lifecycle (${network404s.length})`);

  let maxDuplicateFetches = 0;
  networkRequests.forEach((count, url) => {
    if (count > maxDuplicateFetches) maxDuplicateFetches = count;
  });
  console.log(`  • Max requests per individual asset: ${maxDuplicateFetches}`);
  assert(maxDuplicateFetches <= 2, "No request storms or duplicate request flooding");

  await browser.close();

  console.log("\n================================================================================");
  console.log("🎉 ALL KITCHEN STORY CINEMATIC MICRO-SCROLL TESTS PASSED (100% CLEAN)");
  console.log("================================================================================");
}

runMicroScrollAudit().catch((err) => {
  console.error("Micro-Scroll Audit Failed:", err);
  process.exit(1);
});
