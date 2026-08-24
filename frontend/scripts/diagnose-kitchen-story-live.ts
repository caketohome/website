import { chromium, Browser, Page } from "playwright";
import { getHomepage } from "../src/lib/data/cms";

async function diagnose() {
  console.log("================================================================================");
  console.log("🔎 DIAGNOSING KITCHEN STORY / SCROLL-FRAME RENDER PIPELINE");
  console.log("================================================================================\n");

  // 1. Check data loader getHomepage()
  console.log("1️⃣  Checking getHomepage() Data Loader output...");
  const homeData = await getHomepage();
  console.log("  • Page status:", homeData.page?.status);
  console.log("  • Sections count:", homeData.sections?.length);

  const heroSection = homeData.sections?.find(
    (s: any) => s.type === "hero" || s.type === "kitchen_story" || s.type === "scroll_frame"
  );
  console.log("  • Hero section found:", !!heroSection);
  if (heroSection) {
    console.log("    - Section ID:", heroSection.id);
    console.log("    - Section Type:", heroSection.type);
    console.log("    - Section Name:", heroSection.name);
    console.log("    - Enabled:", heroSection.enabled);
    console.log("    - Desktop Frames Count:", heroSection.config?.desktop?.frames?.length);
    console.log("    - Tablet Frames Count:", heroSection.config?.tablet?.frames?.length);
    console.log("    - Mobile Frames Count:", heroSection.config?.mobile?.frames?.length);
    console.log("    - Animation Type:", heroSection.config?.desktop?.animation_type);
    console.log("    - Disable Scroll Sequence:", heroSection.config?.disable_scroll_sequence);
  }

  // 2. Launch browser and inspect live homepage
  console.log("\n2️⃣  Launching Chromium and inspecting Live Homepage (http://localhost:3000/)...");
  const browser: Browser = await chromium.launch({ headless: true });
  const page: Page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

  const consoleLogs: string[] = [];
  page.on("console", msg => consoleLogs.push(`[${msg.type()}] ${msg.text()}`));

  await page.goto("http://localhost:3000/", { waitUntil: "domcontentloaded", timeout: 60000 });
  await page.waitForTimeout(2000);

  // 3. Check mounted DOM structure
  console.log("\n3️⃣  Inspecting Mounted DOM Elements...");
  const domInfo = await page.evaluate(() => {
    const scrollSection = document.querySelector(".scroll-frame-section");
    const canvas = document.querySelector("canvas.scroll-frame-canvas");
    const stickyViewport = document.querySelector(".scroll-frame-sticky");
    const secWrap = scrollSection?.closest("[class*='sec-wrap']");

    // Check all ancestors for overflow or transform
    const ancestors: { tag: string; classes: string; transform: string; overflow: string; overflowX: string; overflowY: string; position: string }[] = [];
    let curr: HTMLElement | null = scrollSection as HTMLElement;
    while (curr && curr !== document.body) {
      const style = window.getComputedStyle(curr);
      ancestors.push({
        tag: curr.tagName,
        classes: curr.className,
        transform: style.transform,
        overflow: style.overflow,
        overflowX: style.overflowX,
        overflowY: style.overflowY,
        position: style.position,
      });
      curr = curr.parentElement;
    }

    return {
      hasScrollSection: !!scrollSection,
      hasCanvas: !!canvas,
      hasStickyViewport: !!stickyViewport,
      scrollSectionHeight: scrollSection ? (scrollSection as HTMLElement).offsetHeight : 0,
      stickyPosition: stickyViewport ? window.getComputedStyle(stickyViewport).position : null,
      stickyTop: stickyViewport ? window.getComputedStyle(stickyViewport).top : null,
      ancestors,
    };
  });

  console.log("  • Has .scroll-frame-section:", domInfo.hasScrollSection);
  console.log("  • Has canvas.scroll-frame-canvas:", domInfo.hasCanvas);
  console.log("  • Has .scroll-frame-sticky:", domInfo.hasStickyViewport);
  console.log("  • Scroll Section Total Height:", domInfo.scrollSectionHeight, "px");
  console.log("  • Sticky Viewport Position:", domInfo.stickyPosition);
  console.log("  • Sticky Viewport Top:", domInfo.stickyTop);

  // 4. Test Scroll and check if canvas / frame advances
  console.log("\n5️⃣  Testing Scroll Scrubbing...");
  await page.evaluate(() => window.scrollTo(0, 500));
  await page.waitForTimeout(500);
  const scroll500 = await page.evaluate(() => {
    const sticky = document.querySelector(".scroll-frame-sticky");
    const rect = sticky ? sticky.getBoundingClientRect() : null;
    return {
      scrollY: window.scrollY,
      stickyBoundingTop: rect ? rect.top : null,
      stickyBoundingBottom: rect ? rect.bottom : null,
    };
  });
  console.log("  • After scrolling 500px -> scrollY:", scroll500.scrollY, "sticky bounding top:", scroll500.stickyBoundingTop);

  await page.evaluate(() => window.scrollTo(0, 1500));
  await page.waitForTimeout(500);
  const scroll1500 = await page.evaluate(() => {
    const sticky = document.querySelector(".scroll-frame-sticky");
    const rect = sticky ? sticky.getBoundingClientRect() : null;
    return {
      scrollY: window.scrollY,
      stickyBoundingTop: rect ? rect.top : null,
      stickyBoundingBottom: rect ? rect.bottom : null,
    };
  });
  console.log("  • After scrolling 1500px -> scrollY:", scroll1500.scrollY, "sticky bounding top:", scroll1500.stickyBoundingTop);

  await browser.close();
  console.log("\n================================================================================");
}

diagnose().catch(err => {
  console.error("Diagnosis error:", err);
  process.exit(1);
});
