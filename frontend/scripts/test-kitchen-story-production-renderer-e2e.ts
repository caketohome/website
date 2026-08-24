import { chromium, Browser, Page } from "playwright";

function assert(condition: boolean, msg: string) {
  if (!condition) {
    console.error(`  ❌ [FAIL] ${msg}`);
    throw new Error(`Assertion failed: ${msg}`);
  }
  console.log(`  ✅ [PASS] ${msg}`);
}

async function runProductionRendererE2E() {
  console.log("================================================================================");
  console.log("🎬 KITCHEN_STORY_PRODUCTION_RENDERER_E2E — DOM IDENTITY & LIFECYCLE AUDIT");
  console.log("================================================================================\n");

  const baseUrl = "http://localhost:3000";
  const browser: Browser = await chromium.launch({ headless: true });
  const page: Page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

  const consoleLogs: string[] = [];
  page.on("console", (msg) => {
    consoleLogs.push(`[${msg.type()}] ${msg.text()}`);
  });

  // ── Step 1: Open Live Homepage ──────────────────────────────────────────────
  console.log("1️⃣  Navigating to live homepage: http://localhost:3000/...");
  const response = await page.goto(`${baseUrl}/`, { waitUntil: "domcontentloaded", timeout: 60000 });
  assert(response?.status() === 200, "Storefront Homepage responded HTTP 200 OK");
  await page.waitForTimeout(2000);

  // ── Step 2: Assert EXACTLY ONE Hero Renderer in the Live DOM ────────────────
  console.log("\n2️⃣  Auditing Hero Renderers in Live DOM...");
  const heroElements = await page.evaluate(() => {
    const renderers = Array.from(document.querySelectorAll("[data-cms-renderer]"));
    const heroRenderers = renderers.filter((r) => {
      const type = r.getAttribute("data-section-type");
      const id = r.getAttribute("data-section-id");
      return type === "hero" || id === "sec_home_hero";
    });

    const scrollFrameSections = document.querySelectorAll(".scroll-frame-section");
    const staticContainers = document.querySelectorAll("[class*='hero-container']");
    const canvases = document.querySelectorAll("canvas.scroll-frame-canvas");

    return {
      heroRenderersCount: heroRenderers.length,
      heroRendererTypes: heroRenderers.map((r) => r.getAttribute("data-cms-renderer")),
      scrollFrameSectionCount: scrollFrameSections.length,
      staticContainersCount: staticContainers.length,
      canvasesCount: canvases.length,
    };
  });

  console.log(`  • Detected Hero Renderers count: ${heroElements.heroRenderersCount}`);
  console.log(`  • Detected Hero Renderer types: ${JSON.stringify(heroElements.heroRendererTypes)}`);
  console.log(`  • .scroll-frame-section count: ${heroElements.scrollFrameSectionCount}`);
  console.log(`  • .hero-container (static) count: ${heroElements.staticContainersCount}`);
  console.log(`  • Canvas elements count: ${heroElements.canvasesCount}`);

  assert(heroElements.heroRenderersCount === 1, `Exactly ONE hero renderer in DOM (${heroElements.heroRenderersCount} === 1)`);
  assert(heroElements.heroRendererTypes[0] === "scroll-frame-hero", "Selected renderer is 'scroll-frame-hero'");
  assert(heroElements.scrollFrameSectionCount === 1, "Exactly ONE .scroll-frame-section mounted");
  assert(heroElements.staticContainersCount === 0, "Static hero container is ABSENT from DOM");
  assert(heroElements.canvasesCount === 1, "Exactly ONE <canvas> mounted for hero animation");

  // ── Step 3: Verify ScrollFrameHero Remains Mounted During Active Scroll ─────
  console.log("\n3️⃣  Auditing Scroll Scrubbing — Ensuring ScrollFrameHero Stays Mounted...");
  const sectionMetrics = await page.evaluate(() => {
    const el = document.querySelector(".scroll-frame-section") as HTMLElement;
    return {
      height: el.offsetHeight,
      scrollable: el.offsetHeight - window.innerHeight,
    };
  });

  // Scroll through 0%, 25%, 50%, 75%, 100% of the track
  for (const pct of [0, 0.25, 0.5, 0.75, 1.0]) {
    const y = sectionMetrics.scrollable * pct;
    await page.evaluate((scrollY) => window.scrollTo(0, scrollY), y);
    await page.waitForTimeout(100);

    const check = await page.evaluate(() => {
      const sf = document.querySelector(".scroll-frame-section[data-cms-renderer='scroll-frame-hero']");
      const cv = document.querySelector("canvas.scroll-frame-canvas");
      const staticHero = document.querySelector("[data-cms-renderer='static-hero'], [class*='hero-container']");
      return {
        hasScrollFrame: !!sf,
        hasCanvas: !!cv,
        hasStaticHero: !!staticHero,
      };
    });

    assert(check.hasScrollFrame, `ScrollFrameHero remains mounted at ${(pct * 100).toFixed(0)}% scroll`);
    assert(check.hasCanvas, `Canvas remains mounted at ${(pct * 100).toFixed(0)}% scroll`);
    assert(!check.hasStaticHero, `StaticHero remains ABSENT at ${(pct * 100).toFixed(0)}% scroll`);
  }

  // ── Step 4: Verify Next Section Appears Only After Story Track Completes ─────
  console.log("\n4️⃣  Auditing Section Transition & Flow...");
  const transitionCheck = await page.evaluate((scrollable) => {
    // Scroll right past the story track into subsequent categories section
    window.scrollTo(0, scrollable + 300);
    const sf = document.querySelector(".scroll-frame-section");
    const nextSec = sf?.parentElement?.querySelector("section:nth-of-type(2)") || Array.from(document.querySelectorAll("h2")).find(h => h.textContent?.includes("Categories"))?.closest("div");
    const nextRect = nextSec?.getBoundingClientRect();
    return {
      nextTop: nextRect ? nextRect.top : -999,
      nextVisible: nextRect ? nextRect.top < window.innerHeight : false,
    };
  }, sectionMetrics.scrollable);

  console.log(`  • Next Section Top after story release: ${transitionCheck.nextTop}px (visible: ${transitionCheck.nextVisible})`);
  assert(transitionCheck.nextVisible, "Next section (Categories) enters viewport naturally after story release");

  // ── Step 5: Test Hard Page Reload ──────────────────────────────────────────
  console.log("\n5️⃣  Auditing Hard Page Reload (SSR & Hydration Determinism)...");
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.waitForTimeout(2000);

  const reloadCheck = await page.evaluate(() => {
    const sf = document.querySelector(".scroll-frame-section[data-cms-renderer='scroll-frame-hero']");
    const cv = document.querySelector("canvas.scroll-frame-canvas");
    const staticHero = document.querySelector("[data-cms-renderer='static-hero'], [class*='hero-container']");
    return {
      hasScrollFrame: !!sf,
      hasCanvas: !!cv,
      hasStaticHero: !!staticHero,
    };
  });

  assert(reloadCheck.hasScrollFrame, "ScrollFrameHero mounted after hard reload");
  assert(reloadCheck.hasCanvas, "Canvas mounted after hard reload");
  assert(!reloadCheck.hasStaticHero, "StaticHero absent after hard reload");

  await browser.close();

  console.log("\n================================================================================");
  console.log("🎉 KITCHEN_STORY_PRODUCTION_RENDERER_E2E — 100% PASSED (PRODUCTION READY)");
  console.log("================================================================================");
}

runProductionRendererE2E().catch((err) => {
  console.error("Renderer E2E Failed:", err);
  process.exit(1);
});
