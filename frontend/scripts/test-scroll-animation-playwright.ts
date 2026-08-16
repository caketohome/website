/**
 * CakeToHome Playwright Visual QA & Viewport Test Suite
 * Run with: npx tsx scripts/test-scroll-animation-playwright.ts
 */

import { chromium } from "playwright";
import path from "path";

const VIEWPORTS = [
  { name: "1920x1080_desktop_hd", width: 1920, height: 1080 },
  { name: "1440x900_macbook", width: 1440, height: 900 },
  { name: "1280x800_laptop", width: 1280, height: 800 },
  { name: "1024x768_ipad_landscape", width: 1024, height: 768 },
  { name: "768x1024_ipad_portrait", width: 768, height: 1024 },
  { name: "390x844_iphone14", width: 390, height: 844 },
  { name: "375x812_mobile_small", width: 375, height: 812 },
];

const ARTIFACT_DIR = path.resolve("C:/Users/alexc/.gemini/antigravity-ide/brain/494e1f14-65a8-4093-9062-5bdf6f901811");

async function runPlaywrightVisualQA() {
  console.log("================================================================================");
  console.log("CAKETOHOME — PLAYWRIGHT MULTI-VIEWPORT SCROLL ANIMATION VISUAL QA");
  console.log("================================================================================\n");

  const browser = await chromium.launch({ headless: true });
  const results: Record<string, "PASS" | "FAIL"> = {};

  try {
    for (const vp of VIEWPORTS) {
      console.log(`Testing Viewport ${vp.name} (${vp.width}x${vp.height})...`);
      const context = await browser.newContext({
        viewport: { width: vp.width, height: vp.height },
        deviceScaleFactor: 1,
      });
      const page = await context.newPage();

      // Navigate to homepage with domcontentloaded
      await page.goto("http://localhost:3000/", { waitUntil: "domcontentloaded", timeout: 15000 });
      await page.waitForTimeout(2000);

      // Check canvas exists
      const canvasCount = await page.locator("canvas").count();
      const hasCanvas = canvasCount > 0;

      // 1. Initial Hero Screenshot (0% Scroll)
      const initialPath = path.join(ARTIFACT_DIR, `scroll_seq_${vp.name}_0pct.png`);
      await page.screenshot({ path: initialPath, fullPage: false });

      // 2. Scroll to 40% (Craftsmanship Highlight)
      await page.evaluate(() => {
        window.scrollTo({ top: window.innerHeight * 1.8, behavior: "instant" as any });
      });
      await page.waitForTimeout(800);
      const midPath = path.join(ARTIFACT_DIR, `scroll_seq_${vp.name}_40pct.png`);
      await page.screenshot({ path: midPath, fullPage: false });

      // 3. Scroll to 75% (Express Fleet Highlight)
      await page.evaluate(() => {
        window.scrollTo({ top: window.innerHeight * 3.2, behavior: "instant" as any });
      });
      await page.waitForTimeout(800);
      const fleetPath = path.join(ARTIFACT_DIR, `scroll_seq_${vp.name}_75pct.png`);
      await page.screenshot({ path: fleetPath, fullPage: false });

      // 4. Verify No Horizontal Overflow (allow max 1px subpixel rounding)
      const overflow = await page.evaluate(() => {
        return document.documentElement.scrollWidth > window.innerWidth + 1;
      });

      // 5. Verify Navigation and Header Visibility
      const navVisible = await page.locator("nav").first().isVisible();

      if (hasCanvas && !overflow && navVisible) {
        results[vp.name] = "PASS";
        console.log(`   [PASS] ${vp.name}: Canvas active, 0 horizontal overflow, nav sticky, screenshots captured.`);
      } else {
        results[vp.name] = "FAIL";
        console.error(`   [FAIL] ${vp.name}: canvas=${hasCanvas}, overflow=${overflow}, navVisible=${navVisible}`);
      }

      await context.close();
    }
  } catch (err: any) {
    console.error("Playwright QA error:", err.message);
  } finally {
    await browser.close();
  }

  console.log("\n================================================================================");
  console.log("PLAYWRIGHT MULTI-VIEWPORT VISUAL QA SUMMARY");
  console.log("================================================================================\n");

  for (const [k, v] of Object.entries(results)) {
    console.log(`${k}: ${v}`);
  }

  const allPassed = Object.values(results).length === VIEWPORTS.length && Object.values(results).every((v) => v === "PASS");
  if (allPassed) {
    process.exit(0);
  } else {
    process.exit(1);
  }
}

runPlaywrightVisualQA().catch((err) => {
  console.error("Fatal Playwright error:", err);
  process.exit(1);
});
