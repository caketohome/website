import { chromium } from "playwright";
import path from "path";
import fs from "fs";

const ARTIFACT_DIR = "C:/Users/alexc/.gemini/antigravity-ide/brain/a76353c5-992a-418f-a1ad-01fa9d597fac";

async function verifyVisual112Frames() {
  if (!fs.existsSync(ARTIFACT_DIR)) {
    fs.mkdirSync(ARTIFACT_DIR, { recursive: true });
  }

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1920, height: 1080 } });
  const page = await context.newPage();

  console.log("1. Loading http://localhost:3000/ ...");
  await page.goto("http://localhost:3000/", { waitUntil: "domcontentloaded", timeout: 25000 });
  
  // Wait 3s for initial batch of images to be ready
  await page.waitForTimeout(3000);

  const sectionInfo = await page.evaluate(() => {
    const sec = document.querySelector(".scroll-frame-section");
    return {
      top: sec?.getBoundingClientRect().top || 0,
      height: sec?.getBoundingClientRect().height || 2500,
    };
  });

  const headerOffset = Math.max(0, sectionInfo.top);
  const totalScrollable = sectionInfo.height - 1080;

  console.log(`Section parameters: headerOffset=${headerOffset}px, totalScrollable=${totalScrollable}px`);

  const steps = [
    { name: "START (0%)", pct: 0.00, file: "frame112_step_000_start.png", expectedFrame: 1 },
    { name: "25%", pct: 0.25, file: "frame112_step_025_quarter.png", expectedFrame: 29 },
    { name: "50%", pct: 0.50, file: "frame112_step_050_half.png", expectedFrame: 57 },
    { name: "75%", pct: 0.75, file: "frame112_step_075_threequarter.png", expectedFrame: 84 },
    { name: "END (100%)", pct: 1.00, file: "frame112_step_100_end.png", expectedFrame: 112 },
  ];

  const results: Record<string, any> = {};

  console.log("\n2. Capturing Forward Scroll Steps...");
  for (const step of steps) {
    const targetY = headerOffset + (totalScrollable * step.pct);
    await page.evaluate((y) => {
      window.scrollTo(0, y);
      window.dispatchEvent(new Event('scroll'));
    }, targetY);

    // Wait for RAF interpolation and image render
    await page.waitForTimeout(1000);

    const screenshotPath = path.join(ARTIFACT_DIR, step.file);
    await page.screenshot({ path: screenshotPath, fullPage: false });

    const state = await page.evaluate(() => {
      const d = (window as any).__cakeToHomeDebug;
      return {
        currentFrame: d ? Math.round(d.getCurrentFrame()) : null,
        targetFrame: d ? Math.round(d.getTargetFrame()) : null,
        loadedCount: d ? d.getLoadedCount() : null,
        scrollY: window.scrollY,
      };
    });

    results[step.name] = { ...state, expectedFrame: step.expectedFrame, screenshot: step.file };
    console.log(`   ${step.name}: Target ~${step.expectedFrame}, Active Frame ${state.currentFrame}, Loaded: ${state.loadedCount}/112 -> Saved ${step.file}`);
  }

  console.log("\n3. Testing Reverse Scroll (100% -> 50% -> 0%)...");
  const reverseSteps = [
    { name: "REVERSE 50%", pct: 0.50, file: "frame112_step_reverse_050.png", expectedFrame: 57 },
    { name: "REVERSE 0% (START)", pct: 0.00, file: "frame112_step_reverse_000.png", expectedFrame: 1 },
  ];

  for (const step of reverseSteps) {
    const targetY = headerOffset + (totalScrollable * step.pct);
    await page.evaluate((y) => {
      window.scrollTo(0, y);
      window.dispatchEvent(new Event('scroll'));
    }, targetY);

    await page.waitForTimeout(1000);

    const screenshotPath = path.join(ARTIFACT_DIR, step.file);
    await page.screenshot({ path: screenshotPath, fullPage: false });

    const state = await page.evaluate(() => {
      const d = (window as any).__cakeToHomeDebug;
      return {
        currentFrame: d ? Math.round(d.getCurrentFrame()) : null,
        targetFrame: d ? Math.round(d.getTargetFrame()) : null,
        loadedCount: d ? d.getLoadedCount() : null,
      };
    });

    results[step.name] = { ...state, expectedFrame: step.expectedFrame, screenshot: step.file };
    console.log(`   ${step.name}: Target ~${step.expectedFrame}, Active Frame ${state.currentFrame} -> Saved ${step.file}`);
  }

  // Mobile viewport check
  console.log("\n4. Testing Mobile Viewport (390x844)...");
  await page.setViewportSize({ width: 390, height: 844 });
  await page.evaluate(() => {
    window.scrollTo(0, 0);
    window.dispatchEvent(new Event('scroll'));
  });
  await page.waitForTimeout(1000);
  
  const mobileScreenshotPath = path.join(ARTIFACT_DIR, "frame112_mobile_390x844_start.png");
  await page.screenshot({ path: mobileScreenshotPath, fullPage: false });
  console.log(`   Mobile Start Frame 1 saved: ${mobileScreenshotPath}`);

  await browser.close();

  console.log("\n================================================================================");
  console.log("112-FRAME VISUAL VERIFICATION SUMMARY");
  console.log("================================================================================");
  console.log(JSON.stringify(results, null, 2));
  console.log("================================================================================\n");
}

verifyVisual112Frames().catch(console.error);
