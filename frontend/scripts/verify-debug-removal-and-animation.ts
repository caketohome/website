/**
 * CakeToHome — Debug Overlay Removal Verification & Animation Proof Suite
 * Run with: npx tsx scripts/verify-debug-removal-and-animation.ts
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

async function runDebugRemovalVerification() {
  console.log("================================================================================");
  console.log("CAKETOHOME — DEBUG OVERLAY REMOVAL & CLEAN ANIMATION VERIFICATION");
  console.log("================================================================================\n");

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    deviceScaleFactor: 1,
  });
  const page = await context.newPage();

  const results: Record<string, "PASS" | "FAIL"> = {
    debug_hud_removed: "FAIL",
    debug_pill_removed: "FAIL",
    no_debug_text_in_dom: "FAIL",
    frame_animation_preserved: "FAIL",
    reverse_scroll_preserved: "FAIL",
    sticky_and_catalog_release: "FAIL",
  };

  try {
    console.log("1. Navigating to Clean Homepage http://localhost:3000/ ...");
    await page.goto("http://localhost:3000/", { waitUntil: "domcontentloaded", timeout: 15000 });
    await page.waitForTimeout(2000);

    // ── Check 1: Absence of Debug HUD and Debug Badge in DOM & Text Content ──
    console.log("\n2. Scanning for any leftover Debug HUD, Badge, or Text...");
    const debugTextCheck = await page.evaluate(() => {
      const pageText = document.body.innerText || "";
      const hasHudHeading = pageText.includes("SCROLL DEBUG HUD");
      const hasScrollY = pageText.includes("scrollY:");
      const hasSectionTop = pageText.includes("sectionTop:");
      const hasSectionHeight = pageText.includes("sectionHeight:");
      const hasLoadedFrames = pageText.includes("loadedFrames:");
      const hasCanvasVisible = pageText.includes("canvasVisible:");
      const hasFrameCounter = /Frame:\s*\d+\s*\/\s*112/i.test(pageText);
      const hasProgressPercent = /Progress:\s*\d+%/i.test(pageText);

      // Check specific classes/attributes
      const hudEl = document.querySelector(".hero-debug-hud, [ref='hudRef'], [ref='debugBadgeRef']");
      const badgePill = Array.from(document.querySelectorAll(".scroll-frame-sticky div")).find(
        (el) => el.textContent && el.textContent.includes("Frame:")
      );

      return {
        hasHudHeading,
        hasScrollY,
        hasSectionTop,
        hasSectionHeight,
        hasLoadedFrames,
        hasCanvasVisible,
        hasFrameCounter,
        hasProgressPercent,
        hasHudEl: !!hudEl,
        hasBadgePill: !!badgePill,
      };
    });

    console.log("   Debug Scanner Results:", debugTextCheck);

    if (!debugTextCheck.hasHudHeading && !debugTextCheck.hasScrollY && !debugTextCheck.hasSectionTop && !debugTextCheck.hasLoadedFrames) {
      results.debug_hud_removed = "PASS";
      console.log("   [PASS] DEBUG HUD: Completely removed from storefront.");
    }

    if (!debugTextCheck.hasFrameCounter && !debugTextCheck.hasProgressPercent && !debugTextCheck.hasBadgePill) {
      results.debug_pill_removed = "PASS";
      console.log("   [PASS] FRAME/PROGRESS BADGE: Completely removed from storefront.");
    }

    if (!debugTextCheck.hasHudHeading && !debugTextCheck.hasScrollY && !debugTextCheck.hasFrameCounter) {
      results.no_debug_text_in_dom = "PASS";
      console.log("   [PASS] NO DEBUG TEXT: Zero debug telemetry in customer DOM.");
    }

    // ── Check 2: Animation Functionality & Pixel Differentiation ─────────────
    console.log("\n3. Testing Clean Homepage Frame Animation (0% -> 25% -> 50% -> 75% -> 100%)...");

    // Capture 0% Initial Frame
    const clean0Path = path.join(ARTIFACT_DIR, "clean_hero_00_frame1.png");
    const buf0 = await page.screenshot({ path: clean0Path, fullPage: false });

    // Scroll 25%
    await page.mouse.wheel(0, 1125);
    await page.waitForTimeout(500);
    const clean25Path = path.join(ARTIFACT_DIR, "clean_hero_25pct.png");
    const buf25 = await page.screenshot({ path: clean25Path, fullPage: false });

    // Scroll 50%
    await page.mouse.wheel(0, 1125);
    await page.waitForTimeout(500);
    const clean50Path = path.join(ARTIFACT_DIR, "clean_hero_50pct.png");
    const buf50 = await page.screenshot({ path: clean50Path, fullPage: false });

    // Scroll 75%
    await page.mouse.wheel(0, 1125);
    await page.waitForTimeout(500);
    const clean75Path = path.join(ARTIFACT_DIR, "clean_hero_75pct.png");
    const buf75 = await page.screenshot({ path: clean75Path, fullPage: false });

    // Scroll 100%
    await page.mouse.wheel(0, 1125);
    await page.waitForTimeout(500);
    const clean100Path = path.join(ARTIFACT_DIR, "clean_hero_100pct.png");
    const buf100 = await page.screenshot({ path: clean100Path, fullPage: false });

    const diff0to25 = getPixelBufferDiff(buf0, buf25);
    const diff25to50 = getPixelBufferDiff(buf25, buf50);
    const diff50to75 = getPixelBufferDiff(buf50, buf75);
    const diff75to100 = getPixelBufferDiff(buf75, buf100);

    console.log(`   Diff 0% -> 25%: ${(diff0to25 * 100).toFixed(2)}% difference`);
    console.log(`   Diff 25% -> 50%: ${(diff25to50 * 100).toFixed(2)}% difference`);
    console.log(`   Diff 50% -> 75%: ${(diff50to75 * 100).toFixed(2)}% difference`);
    console.log(`   Diff 75% -> 100%: ${(diff75to100 * 100).toFixed(2)}% difference`);

    if (diff0to25 > 0.01 && diff25to50 > 0.01 && diff50to75 > 0.01 && diff75to100 > 0.01) {
      results.frame_animation_preserved = "PASS";
      console.log("   [PASS] SCROLL ANIMATION PRESERVED: Distinct frame pixels render smoothly without debug overlays.");
    }

    // ── Check 3: Reverse Scroll Verification ──────────────────────────────────
    console.log("\n4. Testing Reverse Scroll (100% -> 50% -> 0%)...");
    await page.mouse.wheel(0, -2250);
    await page.waitForTimeout(500);
    const rev50Path = path.join(ARTIFACT_DIR, "clean_hero_reverse_50pct.png");
    const revBuf50 = await page.screenshot({ path: rev50Path, fullPage: false });

    await page.mouse.wheel(0, -2250);
    await page.waitForTimeout(500);
    const rev0Path = path.join(ARTIFACT_DIR, "clean_hero_reverse_0pct.png");
    const revBuf0 = await page.screenshot({ path: rev0Path, fullPage: false });

    const diffRev100to50 = getPixelBufferDiff(buf100, revBuf50);
    const diffRev50to0 = getPixelBufferDiff(revBuf50, revBuf0);

    if (diffRev100to50 > 0.01 && diffRev50to0 > 0.01) {
      results.reverse_scroll_preserved = "PASS";
      console.log("   [PASS] REVERSE SCROLL: Reversed cleanly back to Frame 1.");
    }

    // ── Check 4: Sticky Release into Catalog ──────────────────────────────────
    console.log("\n5. Verifying Sticky Release into Catalog...");
    await page.evaluate(() => {
      const section = document.querySelector(".scroll-frame-section") as HTMLElement | null;
      const h = section ? section.offsetHeight : 5400;
      window.scrollTo({ top: h + 300, behavior: "instant" as any });
    });
    await page.waitForTimeout(600);

    const catalogVisible = await page.locator("text=Shop by Occasion").first().isVisible().catch(() => false);
    const catalogPath = path.join(ARTIFACT_DIR, "clean_hero_catalog_released.png");
    await page.screenshot({ path: catalogPath, fullPage: false });

    if (catalogVisible) {
      results.sticky_and_catalog_release = "PASS";
      console.log("   [PASS] CATALOG RELEASE: Seamlessly transitions into Shop by Occasion.");
    }

  } catch (err: any) {
    console.error("Verification error:", err.message);
  } finally {
    await browser.close();
  }

  console.log("\n================================================================================");
  console.log("DEBUG REMOVAL & CLEAN ANIMATION SUMMARY");
  console.log("================================================================================\n");

  for (const [k, v] of Object.entries(results)) {
    console.log(`${k}: ${v}`);
  }

  const allPassed = Object.values(results).every((v) => v === "PASS");
  if (!allPassed) {
    process.exit(1);
  }
}

runDebugRemovalVerification().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
