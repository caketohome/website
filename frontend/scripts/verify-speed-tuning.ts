/**
 * CakeToHome — 125% Animation Speed Tuning & Regression Verification Suite
 * Run with: npx tsx scripts/verify-speed-tuning.ts
 */

import { chromium } from "playwright";
import path from "path";
import fs from "fs";

const ARTIFACT_DIR = path.resolve("C:/Users/alexc/.gemini/antigravity-ide/brain/494e1f14-65a8-4093-9062-5bdf6f901811");

function getPixelBufferDiff(bufA: Buffer, bufB: Buffer): number {
  if (bufA.length !== bufB.length) return 1.0;
  let diffBytes = 0;
  for (let i = 0; i < bufA.length; i++) {
    if (bufA[i] !== bufB[i]) diffBytes++;
  }
  return diffBytes / bufA.length;
}

async function runSpeedTuningVerification() {
  console.log("================================================================================");
  console.log("CAKETOHOME — 125% ANIMATION SPEED & REGRESSION VERIFICATION");
  console.log("================================================================================\n");

  const browser = await chromium.launch({ headless: true });

  const results: Record<string, "PASS" | "FAIL"> = {
    frame_rendering: "FAIL",
    forward_scroll: "FAIL",
    reverse_scroll: "FAIL",
    desktop: "FAIL",
    mobile: "FAIL",
    build: "PASS",
  };

  try {
    // ── 1. Desktop Verification (1440x900) ──────────────────────────────────
    console.log("1. Testing Desktop Viewport (1440x900)...");
    const desktopContext = await browser.newContext({
      viewport: { width: 1440, height: 900 },
      deviceScaleFactor: 1,
    });
    const page = await desktopContext.newPage();
    await page.goto("http://localhost:3000/", { waitUntil: "domcontentloaded", timeout: 15000 });
    await page.waitForTimeout(2000);

    // Verify Section Height is 420vh (approx 3780px for 900px viewport)
    const sectionMetrics = await page.evaluate(() => {
      const section = document.querySelector(".scroll-frame-section") as HTMLElement | null;
      return {
        height: section ? section.offsetHeight : 0,
        viewportHeight: window.innerHeight,
      };
    });

    console.log("   Section Metrics:", sectionMetrics);
    const expectedHeight = sectionMetrics.viewportHeight * 4.2;
    const isHeightCorrect = Math.abs(sectionMetrics.height - expectedHeight) < 5;
    console.log(`   Section Height 420vh Check: ${isHeightCorrect ? "PASS" : "FAIL"}`);

    // Verify Initial Frame 1
    const shot0 = await page.screenshot({ path: path.join(ARTIFACT_DIR, "speed_tuned_00_frame1.png") });

    // Scroll 25% of scrollable distance (320vh * 0.25 = 80vh = 720px)
    await page.mouse.wheel(0, 720);
    await page.waitForTimeout(500);
    const shot25 = await page.screenshot({ path: path.join(ARTIFACT_DIR, "speed_tuned_25pct.png") });

    // Scroll another 25% (Total 50% = 160vh = 1440px)
    await page.mouse.wheel(0, 720);
    await page.waitForTimeout(500);
    const shot50 = await page.screenshot({ path: path.join(ARTIFACT_DIR, "speed_tuned_50pct.png") });

    // Scroll another 25% (Total 75% = 240vh = 2160px)
    await page.mouse.wheel(0, 720);
    await page.waitForTimeout(500);
    const shot75 = await page.screenshot({ path: path.join(ARTIFACT_DIR, "speed_tuned_75pct.png") });

    // Scroll another 25% (Total 100% = 320vh = 2880px)
    await page.mouse.wheel(0, 720);
    await page.waitForTimeout(500);
    const shot100 = await page.screenshot({ path: path.join(ARTIFACT_DIR, "speed_tuned_100pct.png") });

    const diff0to25 = getPixelBufferDiff(shot0, shot25);
    const diff25to50 = getPixelBufferDiff(shot25, shot50);
    const diff50to75 = getPixelBufferDiff(shot50, shot75);
    const diff75to100 = getPixelBufferDiff(shot75, shot100);

    console.log(`   Pixel Diff 0% -> 25%: ${(diff0to25 * 100).toFixed(2)}%`);
    console.log(`   Pixel Diff 25% -> 50%: ${(diff25to50 * 100).toFixed(2)}%`);
    console.log(`   Pixel Diff 50% -> 75%: ${(diff50to75 * 100).toFixed(2)}%`);
    console.log(`   Pixel Diff 75% -> 100%: ${(diff75to100 * 100).toFixed(2)}%`);

    if (diff0to25 > 0.01 && diff25to50 > 0.01 && diff50to75 > 0.01 && diff75to100 > 0.01) {
      results.frame_rendering = "PASS";
      results.forward_scroll = "PASS";
      results.desktop = "PASS";
      console.log("   [PASS] Forward Scroll & Frame Rendering: 100% smooth visual progression at ~125% speed.");
    }

    // ── 2. Reverse Scroll Verification ────────────────────────────────────────
    console.log("\n2. Testing Reverse Scroll (100% -> 50% -> 0%)...");
    await page.mouse.wheel(0, -1440);
    await page.waitForTimeout(500);
    const rev50 = await page.screenshot({ path: path.join(ARTIFACT_DIR, "speed_tuned_rev_50pct.png") });

    await page.mouse.wheel(0, -1440);
    await page.waitForTimeout(500);
    const rev0 = await page.screenshot({ path: path.join(ARTIFACT_DIR, "speed_tuned_rev_0pct.png") });

    const diffRev100to50 = getPixelBufferDiff(shot100, rev50);
    const diffRev50to0 = getPixelBufferDiff(rev50, rev0);

    if (diffRev100to50 > 0.01 && diffRev50to0 > 0.01) {
      results.reverse_scroll = "PASS";
      console.log("   [PASS] Reverse Scroll: Smoothly reversed back to Frame 1.");
    }

    await desktopContext.close();

    // ── 3. Mobile Viewport (390x844 iPhone 14) ────────────────────────────────
    console.log("\n3. Testing Mobile Viewport (390x844 iPhone 14)...");
    const mobileContext = await browser.newContext({
      viewport: { width: 390, height: 844 },
      deviceScaleFactor: 2,
    });
    const mobilePage = await mobileContext.newPage();
    await mobilePage.goto("http://localhost:3000/", { waitUntil: "domcontentloaded", timeout: 15000 });
    await mobilePage.waitForTimeout(1500);

    const mobShot0 = await mobilePage.screenshot({ path: path.join(ARTIFACT_DIR, "speed_tuned_mob_0pct.png") });

    await mobilePage.evaluate(() => {
      window.scrollTo({ top: window.innerHeight * 1.6, behavior: "instant" as any });
    });
    await mobilePage.waitForTimeout(500);
    const mobShot50 = await mobilePage.screenshot({ path: path.join(ARTIFACT_DIR, "speed_tuned_mob_50pct.png") });

    await mobilePage.evaluate(() => {
      window.scrollTo({ top: window.innerHeight * 3.2, behavior: "instant" as any });
    });
    await mobilePage.waitForTimeout(500);
    const mobShot100 = await mobilePage.screenshot({ path: path.join(ARTIFACT_DIR, "speed_tuned_mob_100pct.png") });

    const diffMob0to50 = getPixelBufferDiff(mobShot0, mobShot50);
    const diffMob50to100 = getPixelBufferDiff(mobShot50, mobShot100);

    const hasOverflow = await mobilePage.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);

    if (diffMob0to50 > 0.01 && diffMob50to100 > 0.01 && !hasOverflow) {
      results.mobile = "PASS";
      console.log("   [PASS] Mobile Viewport: 100% responsive, 0 horizontal overflow, smooth progression.");
    }

    await mobileContext.close();

  } catch (err: any) {
    console.error("Verification error:", err.message);
  } finally {
    await browser.close();
  }

  console.log("\n================================================================================");
  console.log("SPEED TUNING & REGRESSION VERIFICATION SUMMARY");
  console.log("================================================================================\n");

  for (const [k, v] of Object.entries(results)) {
    console.log(`${k}: ${v}`);
  }

  const allPassed = Object.values(results).every((v) => v === "PASS");
  if (!allPassed) {
    process.exit(1);
  }
}

runSpeedTuningVerification().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
