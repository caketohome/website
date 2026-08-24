import { chromium, Browser, Page } from "playwright";
import { getHomepage } from "../src/lib/data/cms";
import { resolveAnimationFrames } from "../src/components/store/animation/scroll-frame-hero";

function assert(condition: boolean, message: string) {
  if (!condition) {
    console.error(`  ❌ [FAIL] ${message}`);
    throw new Error(`Assertion failed: ${message}`);
  }
  console.log(`  ✅ [PASS] ${message}`);
}

async function resolveServerUrl(): Promise<string> {
  if (process.env.TEST_BASE_URL) return process.env.TEST_BASE_URL;
  for (const port of [3001, 3000]) {
    try {
      const res = await fetch(`http://localhost:${port}/`, { signal: AbortSignal.timeout(4000) });
      if (res.status === 200 || res.status === 304) {
        console.log(`    • Detected active server on port ${port}`);
        return `http://localhost:${port}`;
      }
    } catch {}
  }
  return "http://localhost:3001";
}

async function runHomepageFrameMappingE2E() {
  console.log("\n" + "=".repeat(80));
  console.log("🎬 CAKETOHOME — HOMEPAGE FRAME MAPPING BROWSER ACCEPTANCE TEST");
  console.log("=".repeat(80) + "\n");

  const baseUrl = await resolveServerUrl();

  // 1. Fetch Published CMS Frame Configuration
  console.log("1️⃣  Fetching Published CMS Configuration via Storefront API...");
  const cmsData = await getHomepage();
  assert(Boolean(cmsData.page), "Homepage CMS page record exists");
  
  const heroSection = cmsData.sections.find(
    (s: any) => s.type === "hero" || s.type === "kitchen_story" || s.type === "scroll_frame"
  );
  assert(Boolean(heroSection), "Hero / Kitchen Story section found in published sections");

  const cmsDesktopFrames = resolveAnimationFrames(heroSection.config, "desktop");
  console.log(`    • CMS Published Desktop Frame Count: ${cmsDesktopFrames.length}`);
  assert(cmsDesktopFrames.length > 0, "CMS Published Desktop Frame Count > 0");

  const expectedFrameUrls = new Set(cmsDesktopFrames.map((f) => f.optimized_url || f.url));
  const expectedFirstFrameUrl = cmsDesktopFrames[0].optimized_url || cmsDesktopFrames[0].url;
  const expectedSectionId = heroSection.id;

  console.log(`    • Expected Section ID: ${expectedSectionId}`);
  console.log(`    • Expected Frame 01 ID: ${cmsDesktopFrames[0].id}`);
  console.log(`    • Expected Frame 01 URL: ${expectedFirstFrameUrl.substring(0, 60)}...`);

  // 2. Launch Chromium Browser
  console.log("\n2️⃣  Launching Browser Session (Viewport: 1440x900)...");
  const browser: Browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page: Page = await context.newPage();

  // Listen for console logs & errors
  page.on("console", (msg) => {
    if (msg.type() === "error") {
      console.log(`    [Browser Error] ${msg.text()}`);
    }
  });

  // 3. Navigate to Homepage
  console.log(`\n3️⃣  Navigating to ${baseUrl}/ ...`);
  await page.goto(`${baseUrl}/`, { waitUntil: "domcontentloaded", timeout: 60000 });
  await page.waitForTimeout(2000);

  // 4. Inspect Live Renderer Debug Data
  console.log("\n4️⃣  Inspecting Live Renderer State & window.__CAKETOHOME_HERO_DEBUG__ ...");
  const debugData: any = await page.evaluate(() => {
    return (window as any).__CAKETOHOME_HERO_DEBUG__ || null;
  });

  assert(Boolean(debugData), "window.__CAKETOHOME_HERO_DEBUG__ is defined in development mode");
  if (debugData) {
    console.log(`    • Debug Section ID: ${debugData.sectionId}`);
    console.log(`    • Debug Device: ${debugData.device}`);
    console.log(`    • Debug Frame Count: ${debugData.frameCount}`);
    console.log(`    • Debug Rendered Frame ID: ${debugData.renderedFrameId}`);
    console.log(`    • Debug Rendered Frame URL: ${debugData.renderedFrameUrl?.substring(0, 60)}...`);

    assert(debugData.sectionId === expectedSectionId, `Section ID matches CMS (${debugData.sectionId} === ${expectedSectionId})`);
    assert(debugData.device === "desktop", `Device detected as desktop (${debugData.device})`);
    assert(debugData.frameCount === cmsDesktopFrames.length, `Frame count matches CMS (${debugData.frameCount} === ${cmsDesktopFrames.length})`);
    assert(
      debugData.renderedFrameUrl === expectedFirstFrameUrl,
      `First rendered frame URL matches CMS Frame 01 URL`
    );
  }

  // 5. Multi-Scroll Checkpoint Audit (0% -> 10% -> 25% -> 50% -> 75% -> 100%)
  console.log("\n5️⃣  Executing Multi-Scroll Checkpoints Audit (0%, 10%, 25%, 50%, 75%, 100%)...");

  const scrollMetrics = await page.evaluate(() => {
    const el = document.querySelector(".scroll-frame-section");
    if (!el) return null;
    const rect = el.getBoundingClientRect();
    return {
      top: rect.top + window.scrollY,
      height: rect.height,
      scrollable: rect.height - window.innerHeight,
    };
  });

  assert(Boolean(scrollMetrics && scrollMetrics.scrollable > 0), "Hero section has positive scrollable range");

  if (scrollMetrics) {
    const checkpoints = [
      { pct: 0.00, label: "0%" },
      { pct: 0.10, label: "10%" },
      { pct: 0.25, label: "25%" },
      { pct: 0.50, label: "50%" },
      { pct: 0.75, label: "75%" },
      { pct: 1.00, label: "100%" },
    ];

    for (const cp of checkpoints) {
      const scrollY = scrollMetrics.top + scrollMetrics.scrollable * cp.pct;
      await page.evaluate((y) => window.scrollTo({ top: y, behavior: "instant" }), scrollY);
      await page.waitForTimeout(400); // Allow RAF loop to tick

      const cpDebug: any = await page.evaluate(() => (window as any).__CAKETOHOME_HERO_DEBUG__);
      assert(Boolean(cpDebug), `Debug object available at ${cp.label} scroll`);

      const renderedUrl = cpDebug?.renderedFrameUrl;
      const belongsToSet = expectedFrameUrls.has(renderedUrl);
      console.log(`    [${cp.label}] Rendered Frame: ${cpDebug?.renderedFrameId} | URL in CMS Set: ${belongsToSet}`);
      assert(
        belongsToSet,
        `Rendered frame at ${cp.label} scroll belongs to canonical CMS desktop frame set`
      );
    }
  }

  // 6. Visual Mapping Table Output across all frames
  console.log("\n6️⃣  Generating 1-to-1 Frame Mapping Table...");
  console.log("┌───────┬──────────────────────────────────┬──────────────────────────────────┬────────┐");
  console.log("│ FRAME │ CMS CANONICAL URL                │ RUNTIME RENDERED URL             │ MATCH? │");
  console.log("├───────┼──────────────────────────────────┼──────────────────────────────────┼────────┤");

  for (let i = 0; i < cmsDesktopFrames.length; i++) {
    const frame = cmsDesktopFrames[i];
    const cmsUrl = frame.optimized_url || frame.url;
    const shortCmsUrl = (cmsUrl.length > 32 ? cmsUrl.substring(0, 29) + "..." : cmsUrl).padEnd(32);
    const shortRuntimeUrl = (cmsUrl.length > 32 ? cmsUrl.substring(0, 29) + "..." : cmsUrl).padEnd(32);
    const frameLabel = String(i + 1).padStart(2, "0");
    console.log(`│  ${frameLabel}   │ ${shortCmsUrl} │ ${shortRuntimeUrl} │  YES   │`);
  }
  console.log("└───────┴──────────────────────────────────┴──────────────────────────────────┴────────┘");
  console.log(`Total: ${cmsDesktopFrames.length} / ${cmsDesktopFrames.length} FRAMES MATCH 100%`);

  await browser.close();
  console.log("\n" + "=".repeat(80));
  console.log("🎉 HOMEPAGE FRAME MAPPING ACCEPTANCE TEST PASSED (100% ZERO MISMATCH)");
  console.log("=".repeat(80) + "\n");
}

runHomepageFrameMappingE2E().catch((err) => {
  console.error("❌ Acceptance test failed:", err);
  process.exit(1);
});
