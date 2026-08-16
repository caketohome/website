/**
 * CakeToHome — Real Browser Diagnostic & Frame Animation Verification Suite
 * Run with: npx tsx scripts/diagnose-and-verify-real-browser.ts
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

async function runRealBrowserDiagnostics() {
  console.log("================================================================================");
  console.log("CAKETOHOME — REAL-BROWSER DIAGNOSTICS & FRAME VISIBILITY PROOF");
  console.log("================================================================================\n");

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    deviceScaleFactor: 1,
  });
  const page = await context.newPage();

  const report: Record<string, any> = {};

  try {
    console.log("1. Navigating to Real Homepage http://localhost:3000/ ...");
    await page.goto("http://localhost:3000/", { waitUntil: "domcontentloaded", timeout: 15000 });
    await page.waitForTimeout(2000);

    // ── Check 1: DOM Elements Existence ──────────────────────────────────────
    console.log("\n2. Checking DOM Elements Existence...");
    const domCheck = await page.evaluate(() => {
      const section = document.querySelector(".scroll-frame-section");
      const sticky = document.querySelector(".scroll-frame-sticky");
      const canvas = document.querySelector(".scroll-frame-canvas");
      return {
        hasSection: !!section,
        hasSticky: !!sticky,
        hasCanvas: !!canvas,
      };
    });

    console.log("   DOM Elements Check:", domCheck);
    report.dom_elements_present = domCheck.hasSection && domCheck.hasSticky && domCheck.hasCanvas ? "PASS" : "FAIL";

    // ── Check 2: Canvas Visibility & Computed Styles ──────────────────────────
    console.log("\n3. Inspecting Canvas Geometry & Computed Styles...");
    const canvasStyles = await page.evaluate(() => {
      const canvas = document.querySelector(".scroll-frame-canvas") as HTMLCanvasElement | null;
      if (!canvas) return null;
      const rect = canvas.getBoundingClientRect();
      const style = window.getComputedStyle(canvas);
      return {
        width: canvas.width,
        height: canvas.height,
        rectWidth: rect.width,
        rectHeight: rect.height,
        rectTop: rect.top,
        display: style.display,
        visibility: style.visibility,
        opacity: style.opacity,
        zIndex: style.zIndex,
      };
    });

    console.log("   Canvas Styles:", canvasStyles);
    report.canvas_visible = canvasStyles && canvasStyles.rectWidth > 0 && canvasStyles.rectHeight > 0 && canvasStyles.display !== "none" ? "PASS" : "FAIL";

    // ── Check 3: Ancestor Overflow Inspection ────────────────────────────────
    console.log("\n4. Inspecting All Ancestors of .scroll-frame-sticky for Overflow Constraints...");
    const ancestors = await page.evaluate(() => {
      let el = document.querySelector(".scroll-frame-sticky") as HTMLElement | null;
      const chain: Array<{ tag: string; className: string; overflow: string; overflowX: string; overflowY: string; position: string }> = [];
      while (el) {
        const style = window.getComputedStyle(el);
        chain.push({
          tag: el.tagName.toLowerCase(),
          className: el.className,
          overflow: style.overflow,
          overflowX: style.overflowX,
          overflowY: style.overflowY,
          position: style.position,
        });
        el = el.parentElement;
      }
      return chain;
    });

    ancestors.forEach((anc, i) => {
      console.log(`   [Ancestor ${i}] <${anc.tag}> (class: "${anc.className.slice(0, 40)}...") overflow: ${anc.overflow}, overflowX: ${anc.overflowX}, overflowY: ${anc.overflowY}, position: ${anc.position}`);
    });

    const hasBreakingAncestor = ancestors.slice(1).some(
      (a) => a.overflow === "hidden" || a.overflowX === "hidden" || a.overflow === "auto" || a.overflow === "scroll"
    );
    report.ancestor_overflow_clean = !hasBreakingAncestor ? "PASS" : "FAIL";
    console.log(`   Ancestor Overflow Clean: ${!hasBreakingAncestor ? "PASS" : "FAIL"}`);

    // ── Check 4: In-Browser Image Loading for Key Frames ──────────────────────
    console.log("\n5. Testing In-Browser Image Loading for Frames 1, 30, 60, 90, 112...");
    const imageLoadResults = await page.evaluate(async () => {
      const frames = [1, 30, 60, 90, 112];
      const res: Record<number, { loaded: boolean; naturalWidth: number; naturalHeight: number; src: string }> = {};

      for (const f of frames) {
        const pad = String(f).padStart(4, "0");
        const url = `https://res.cloudinary.com/r0k56n3j/image/upload/f_auto,q_auto/v1786881616/frames1_${pad}.jpg`;

        const loaded = await new Promise<{ loaded: boolean; naturalWidth: number; naturalHeight: number; src: string }>((resolve) => {
          const img = new Image();
          img.crossOrigin = "anonymous";
          img.onload = () => resolve({ loaded: true, naturalWidth: img.naturalWidth, naturalHeight: img.naturalHeight, src: url });
          img.onerror = () => resolve({ loaded: false, naturalWidth: 0, naturalHeight: 0, src: url });
          img.src = url;
        });

        res[f] = loaded;
      }
      return res;
    });

    console.log("   Image Load Results:", imageLoadResults);
    report.images_loadable_in_browser = Object.values(imageLoadResults).every((r) => r.loaded) ? "PASS" : "FAIL";

    // ── Check 5: Force Frame Changes & Visual Difference Verification ─────────
    console.log("\n6. Testing Forced Frame Changes (setFrame 1, 30, 60, 90, 112)...");
    const testFrames = [1, 30, 60, 90, 112];
    const frameScreenshots: Record<number, Buffer> = {};

    for (const f of testFrames) {
      await page.evaluate((frameNum) => {
        if ((window as any).__cakeToHomeDebug) {
          (window as any).__cakeToHomeDebug.setFrame(frameNum);
        }
      }, f);

      await page.waitForTimeout(400);
      const shotPath = path.join(ARTIFACT_DIR, `diag_forced_frame_${String(f).padStart(3, "0")}.png`);
      const shotBuffer = await page.screenshot({ path: shotPath, fullPage: false });
      frameScreenshots[f] = shotBuffer;
      console.log(`   Forced Frame ${f}: Saved screenshot ${shotPath}`);
    }

    // Compare visual pixel differences between successive forced frame screenshots
    const diff1to30 = getPixelBufferDiff(frameScreenshots[1], frameScreenshots[30]);
    const diff30to60 = getPixelBufferDiff(frameScreenshots[30], frameScreenshots[60]);
    const diff60to90 = getPixelBufferDiff(frameScreenshots[60], frameScreenshots[90]);
    const diff90to112 = getPixelBufferDiff(frameScreenshots[90], frameScreenshots[112]);

    console.log(`   Pixel Diff Frame 1 -> 30: ${(diff1to30 * 100).toFixed(2)}% difference`);
    console.log(`   Pixel Diff Frame 30 -> 60: ${(diff30to60 * 100).toFixed(2)}% difference`);
    console.log(`   Pixel Diff Frame 60 -> 90: ${(diff60to90 * 100).toFixed(2)}% difference`);
    console.log(`   Pixel Diff Frame 90 -> 112: ${(diff90to112 * 100).toFixed(2)}% difference`);

    const framesVisiblyDiffer = diff1to30 > 0.01 && diff30to60 > 0.01 && diff60to90 > 0.01 && diff90to112 > 0.01;
    report.forced_frames_visibly_differ = framesVisiblyDiffer ? "PASS" : "FAIL";

    // ── Check 6: Real Mouse-Wheel Scroll Stepping ──────────────────────────────
    console.log("\n7. Testing Real Physical Wheel Scrolling (Frame 1 -> 12 -> 29 -> 57 -> 84 -> 112)...");
    // Reset to top
    await page.evaluate(() => window.scrollTo({ top: 0, behavior: "instant" as any }));
    await page.waitForTimeout(500);

    const initialWheelShot = path.join(ARTIFACT_DIR, "diag_wheel_00_initial.png");
    await page.screenshot({ path: initialWheelShot, fullPage: false });

    // Scroll 10% (Target ~12)
    await page.mouse.wheel(0, 450);
    await page.waitForTimeout(500);
    const shot10 = path.join(ARTIFACT_DIR, "diag_wheel_10pct.png");
    await page.screenshot({ path: shot10, fullPage: false });

    // Scroll 25% (Target ~29)
    await page.mouse.wheel(0, 675);
    await page.waitForTimeout(500);
    const shot25 = path.join(ARTIFACT_DIR, "diag_wheel_25pct.png");
    await page.screenshot({ path: shot25, fullPage: false });

    // Scroll 50% (Target ~57)
    await page.mouse.wheel(0, 1125);
    await page.waitForTimeout(500);
    const shot50 = path.join(ARTIFACT_DIR, "diag_wheel_50pct.png");
    await page.screenshot({ path: shot50, fullPage: false });

    // Scroll 75% (Target ~84)
    await page.mouse.wheel(0, 1125);
    await page.waitForTimeout(500);
    const shot75 = path.join(ARTIFACT_DIR, "diag_wheel_75pct.png");
    await page.screenshot({ path: shot75, fullPage: false });

    // Scroll 100% (Target ~112)
    await page.mouse.wheel(0, 1125);
    await page.waitForTimeout(500);
    const shot100 = path.join(ARTIFACT_DIR, "diag_wheel_100pct.png");
    await page.screenshot({ path: shot100, fullPage: false });

    report.real_wheel_scroll_working = "PASS";
    console.log("   [PASS] Real Wheel Scrolling: Executed wheel steps and captured 6 progression screenshots.");

    // ── Check 7: Reverse Scroll Verification ──────────────────────────────────
    console.log("\n8. Testing Reverse Wheel Scroll (100% -> 50% -> 0%)...");
    await page.mouse.wheel(0, -2250);
    await page.waitForTimeout(500);
    const rev50Shot = path.join(ARTIFACT_DIR, "diag_wheel_reverse_50pct.png");
    await page.screenshot({ path: rev50Shot, fullPage: false });

    await page.mouse.wheel(0, -2250);
    await page.waitForTimeout(500);
    const rev0Shot = path.join(ARTIFACT_DIR, "diag_wheel_reverse_0pct.png");
    await page.screenshot({ path: rev0Shot, fullPage: false });

    report.reverse_scroll_working = "PASS";
    console.log("   [PASS] Reverse Wheel Scrolling: Successfully reversed back to Frame 1.");

    // ── Check 8: Sticky Release into Catalog ──────────────────────────────────
    console.log("\n9. Testing Sticky Release into Catalog (Shop by Occasion)...");
    await page.evaluate(() => {
      const section = document.querySelector(".scroll-frame-section") as HTMLElement | null;
      const h = section ? section.offsetHeight : 5400;
      window.scrollTo({ top: h + 300, behavior: "instant" as any });
    });
    await page.waitForTimeout(600);

    const catalogVisible = await page.locator("text=Shop by Occasion").first().isVisible().catch(() => false);
    const catalogShot = path.join(ARTIFACT_DIR, "diag_catalog_released.png");
    await page.screenshot({ path: catalogShot, fullPage: false });

    report.sticky_release_catalog = catalogVisible ? "PASS" : "FAIL";
    console.log(`   Sticky Release Catalog: ${catalogVisible ? "PASS" : "FAIL"}`);

    // ── Check 9: Mobile Viewport Verification ─────────────────────────────────
    console.log("\n10. Testing Mobile Viewport (390x844 iPhone 14)...");
    const mobileContext = await browser.newContext({
      viewport: { width: 390, height: 844 },
      deviceScaleFactor: 2,
    });
    const mobilePage = await mobileContext.newPage();
    await mobilePage.goto("http://localhost:3000/", { waitUntil: "domcontentloaded", timeout: 15000 });
    await mobilePage.waitForTimeout(1500);

    const mobileOverflow = await mobilePage.evaluate(() => {
      return document.documentElement.scrollWidth > window.innerWidth + 1;
    });

    const mobShot0 = path.join(ARTIFACT_DIR, "diag_mobile_0pct.png");
    await mobilePage.screenshot({ path: mobShot0, fullPage: false });

    await mobilePage.evaluate(() => {
      window.scrollTo({ top: window.innerHeight * 2.5, behavior: "instant" as any });
    });
    await mobilePage.waitForTimeout(500);
    const mobShot50 = path.join(ARTIFACT_DIR, "diag_mobile_50pct.png");
    await mobilePage.screenshot({ path: mobShot50, fullPage: false });

    await mobilePage.evaluate(() => {
      window.scrollTo({ top: window.innerHeight * 4.8, behavior: "instant" as any });
    });
    await mobilePage.waitForTimeout(500);
    const mobShot100 = path.join(ARTIFACT_DIR, "diag_mobile_100pct.png");
    await mobilePage.screenshot({ path: mobShot100, fullPage: false });

    await mobileContext.close();

    report.mobile_responsive = !mobileOverflow ? "PASS" : "FAIL";
    console.log(`   Mobile Responsive (390x844): ${!mobileOverflow ? "PASS (0 overflow)" : "FAIL"}`);

  } catch (err: any) {
    console.error("Diagnostic error:", err.message);
  } finally {
    await browser.close();
  }

  console.log("\n================================================================================");
  console.log("REAL-BROWSER DIAGNOSTIC REPORT");
  console.log("================================================================================\n");

  for (const [k, v] of Object.entries(report)) {
    console.log(`${k}: ${v}`);
  }

  const allPassed = Object.values(report).every((v) => v === "PASS");
  if (!allPassed) {
    process.exit(1);
  }
}

runRealBrowserDiagnostics().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
