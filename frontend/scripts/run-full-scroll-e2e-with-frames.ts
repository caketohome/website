/**
 * Comprehensive 39-Frame Scroll E2E Verification with Popup Dismissal
 */
import { chromium } from "playwright";
import path from "path";

const ARTIFACT_DIR = "C:\\Users\\alexc\\.gemini\\antigravity-ide\\brain\\494e1f14-65a8-4093-9062-5bdf6f901811";

async function runScrollSuite() {
  console.log("================================================================================");
  console.log("CAKETOHOME — CAPTURING UNOBSTRUCTED 39-FRAME VISUAL SUITE");
  console.log("================================================================================\n");

  const browser = await chromium.launch({
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });

  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    deviceScaleFactor: 1,
  });

  const page = await context.newPage();

  console.log("1. Navigating to http://localhost:3000/ ...");
  await page.goto("http://localhost:3000/", { waitUntil: "domcontentloaded", timeout: 20000 });
  await page.waitForTimeout(2500);

  // Helper to dismiss popup if present
  const dismissModal = async () => {
    try {
      const closeBtn = page.locator("button[aria-label*='Close'], button:has-text('✕'), button:has-text('Continue as Guest'), button:has-text('close')").first();
      if (await closeBtn.isVisible({ timeout: 500 })) {
        await closeBtn.click();
        await page.waitForTimeout(300);
      }
    } catch (_) {}
  };

  await dismissModal();

  // 1. Initial State (0% Scroll -> Frame 0001)
  console.log("2. Capturing Frame 0001 (0% Scroll)...");
  const shot0 = path.join(ARTIFACT_DIR, "frame39_clean_00_frame0001.png");
  await page.screenshot({ path: shot0 });
  console.log(`✓ Saved ${shot0}`);

  const sectionBox = await page.locator(".scroll-frame-section").boundingBox();
  const totalScrollable = (sectionBox?.height || 2340) - 900;

  // 2. 25% Scroll (Frame ~11)
  console.log("3. Scrolling to 25% (Target Frame ~11)...");
  await page.evaluate((y) => window.scrollTo({ top: y, behavior: "instant" as any }), 0.25 * totalScrollable);
  await page.waitForTimeout(1000);
  await dismissModal();
  const shot25 = path.join(ARTIFACT_DIR, "frame39_clean_25_frame0011.png");
  await page.screenshot({ path: shot25 });
  console.log(`✓ Saved ${shot25}`);

  // 3. 50% Scroll (Frame ~20)
  console.log("4. Scrolling to 50% (Target Frame ~20)...");
  await page.evaluate((y) => window.scrollTo({ top: y, behavior: "instant" as any }), 0.50 * totalScrollable);
  await page.waitForTimeout(1000);
  await dismissModal();
  const shot50 = path.join(ARTIFACT_DIR, "frame39_clean_50_frame0020.png");
  await page.screenshot({ path: shot50 });
  console.log(`✓ Saved ${shot50}`);

  // 4. 75% Scroll (Frame ~30)
  console.log("5. Scrolling to 75% (Target Frame ~30)...");
  await page.evaluate((y) => window.scrollTo({ top: y, behavior: "instant" as any }), 0.75 * totalScrollable);
  await page.waitForTimeout(1000);
  await dismissModal();
  const shot75 = path.join(ARTIFACT_DIR, "frame39_clean_75_frame0030.png");
  await page.screenshot({ path: shot75 });
  console.log(`✓ Saved ${shot75}`);

  // 5. 100% Scroll (Frame 39)
  console.log("6. Scrolling to 100% (Target Frame 0039 - Delivery Box)...");
  await page.evaluate((y) => window.scrollTo({ top: y, behavior: "instant" as any }), totalScrollable);
  await page.waitForTimeout(1000);
  await dismissModal();
  const shot100 = path.join(ARTIFACT_DIR, "frame39_clean_100_frame0039.png");
  await page.screenshot({ path: shot100 });
  console.log(`✓ Saved ${shot100}`);

  // 6. Reverse Scroll (100% -> 50% -> 0% Frame 0001)
  console.log("7. Reverse Scrolling to 50% (Target Frame ~20)...");
  await page.evaluate((y) => window.scrollTo({ top: y, behavior: "instant" as any }), 0.50 * totalScrollable);
  await page.waitForTimeout(1000);
  await dismissModal();
  const shotRev50 = path.join(ARTIFACT_DIR, "frame39_clean_reverse_50pct.png");
  await page.screenshot({ path: shotRev50 });
  console.log(`✓ Saved ${shotRev50}`);

  console.log("8. Reverse Scrolling back to 0% (Target Frame 0001)...");
  await page.evaluate((y) => window.scrollTo({ top: y, behavior: "instant" as any }), 0);
  await page.waitForTimeout(1000);
  await dismissModal();
  const shotRev0 = path.join(ARTIFACT_DIR, "frame39_clean_reverse_0pct.png");
  await page.screenshot({ path: shotRev0 });
  console.log(`✓ Saved ${shotRev0}`);

  // 7. Mobile Viewport (390x844 iPhone 14)
  console.log("9. Testing Mobile Viewport (390x844)...");
  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForTimeout(1000);
  await dismissModal();
  const shotMobile = path.join(ARTIFACT_DIR, "frame39_clean_mobile_390x844.png");
  await page.screenshot({ path: shotMobile });
  console.log(`✓ Saved ${shotMobile}`);

  await browser.close();

  console.log("\n================================================================================");
  console.log("🎉 UNOBSTRUCTED VISUAL VERIFICATION COMPLETE!");
  console.log("================================================================================\n");
}

runScrollSuite().catch((e) => {
  console.error(e);
  process.exit(1);
});
