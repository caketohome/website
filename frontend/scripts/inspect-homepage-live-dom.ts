import { chromium, Browser, Page } from "playwright";
import { getHomepage } from "../src/lib/data/cms";

async function main() {
  console.log("================================================================================");
  console.log("🔍 INSPECTING LIVE HOMEPAGE DOM & HERO COMPONENTS");
  console.log("================================================================================\n");

  // 1. Check getHomepage data
  const cms = await getHomepage();
  console.log(`CMS Page: "${cms?.page?.title}" (slug: ${cms?.page?.slug}, status: ${cms?.page?.status})`);
  console.log(`Total sections in CMS: ${cms?.sections?.length}`);
  cms?.sections?.forEach((s: any, idx: number) => {
    console.log(`  [${idx}] id: ${s.id} | type: ${s.type} | name: ${s.name} | anim: ${s.config?.animation_type} | disable_scroll: ${s.config?.disable_scroll_sequence}`);
  });

  // 2. Open Chromium on http://localhost:3000/
  const browser: Browser = await chromium.launch({ headless: true });
  const page: Page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

  const consoleLogs: string[] = [];
  page.on("console", (msg) => consoleLogs.push(`[${msg.type()}] ${msg.text()}`));

  console.log("\n2️⃣  Navigating to http://localhost:3000/...");
  await page.goto("http://localhost:3000/", { waitUntil: "domcontentloaded", timeout: 60000 });
  await page.waitForTimeout(3000);

  // 3. Inspect all hero sections in DOM
  const domInfo = await page.evaluate(() => {
    const allSections = Array.from(document.querySelectorAll("section"));
    const sectionSummaries = allSections.map((sec, idx) => {
      const id = sec.id;
      const className = sec.className;
      const hasCanvas = !!sec.querySelector("canvas");
      const hasImg = !!sec.querySelector("img");
      const hasPicture = !!sec.querySelector("picture");
      const isSticky = !!sec.querySelector(".scroll-frame-sticky") || sec.className.includes("sticky");
      const isScrollFrame = sec.className.includes("scroll-frame");
      const h1 = sec.querySelector("h1")?.textContent?.trim() || "";
      const h2 = sec.querySelector("h2")?.textContent?.trim() || "";
      const rect = sec.getBoundingClientRect();
      const style = window.getComputedStyle(sec);
      return {
        idx,
        id,
        className,
        hasCanvas,
        hasImg,
        hasPicture,
        isSticky,
        isScrollFrame,
        h1,
        h2,
        top: rect.top,
        height: rect.height,
        display: style.display,
        visibility: style.visibility,
        opacity: style.opacity,
      };
    });

    const scrollFrameSections = document.querySelectorAll(".scroll-frame-section");
    const staticHeroContainers = document.querySelectorAll("[class*='hero-container']");
    const canvases = document.querySelectorAll("canvas");
    const pictures = document.querySelectorAll("picture");

    return {
      totalSections: allSections.length,
      sectionSummaries,
      scrollFrameCount: scrollFrameSections.length,
      staticHeroContainerCount: staticHeroContainers.length,
      canvasesCount: canvases.length,
      picturesCount: pictures.length,
    };
  });

  console.log("\n3️⃣  DOM Inspection Summary:");
  console.log(`  • Total <section> elements: ${domInfo.totalSections}`);
  console.log(`  • .scroll-frame-section count: ${domInfo.scrollFrameCount}`);
  console.log(`  • .hero-container count: ${domInfo.staticHeroContainerCount}`);
  console.log(`  • <canvas> count: ${domInfo.canvasesCount}`);
  console.log(`  • <picture> count: ${domInfo.picturesCount}`);

  console.log("\n4️⃣  All Sections on Live Homepage:");
  domInfo.sectionSummaries.forEach((s) => {
    console.log(`\n  Section [${s.idx}]: ID="${s.id}" | class="${s.className}"`);
    console.log(`    - Height: ${s.height}px | Top: ${s.top}px | Display: ${s.display} | Opacity: ${s.opacity}`);
    console.log(`    - Has Canvas: ${s.hasCanvas} | Has Img: ${s.hasImg} | Has Picture: ${s.hasPicture} | Is Sticky: ${s.isSticky}`);
    if (s.h1) console.log(`    - H1: "${s.h1}"`);
    if (s.h2) console.log(`    - H2: "${s.h2}"`);
  });

  console.log("\n5️⃣  Console Logs during page load:");
  consoleLogs.slice(0, 15).forEach((l) => console.log(`  ${l}`));

  await browser.close();
}

main().catch(console.error);
