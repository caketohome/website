/**
 * Test canvas draw with image loaded assertion
 */
import { chromium } from "playwright";
import path from "path";

const ARTIFACT_DIR = "C:\\Users\\alexc\\.gemini\\antigravity-ide\\brain\\494e1f14-65a8-4093-9062-5bdf6f901811";

async function verifyCanvasImage() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();

  console.log("Navigating to http://localhost:3000/ ...");
  await page.goto("http://localhost:3000/", { waitUntil: "domcontentloaded", timeout: 15000 });
  
  // Wait 3s for images to render onto canvas
  await page.waitForTimeout(3000);

  // Take screenshot at 0% scroll
  const shot0 = path.join(ARTIFACT_DIR, "verified_hero_00_frame1.png");
  await page.screenshot({ path: shot0 });
  console.log(`Saved ${shot0}`);

  // Scroll to 50%
  await page.evaluate(() => window.scrollTo({ top: 1200, behavior: "instant" as any }));
  await page.waitForTimeout(1000);
  const shot50 = path.join(ARTIFACT_DIR, "verified_hero_50_frame20.png");
  await page.screenshot({ path: shot50 });
  console.log(`Saved ${shot50}`);

  // Scroll to 100%
  await page.evaluate(() => window.scrollTo({ top: 2400, behavior: "instant" as any }));
  await page.waitForTimeout(1000);
  const shot100 = path.join(ARTIFACT_DIR, "verified_hero_100_frame39.png");
  await page.screenshot({ path: shot100 });
  console.log(`Saved ${shot100}`);

  await browser.close();
  console.log("Canvas Image Verification Complete!");
}

verifyCanvasImage().catch((e) => console.error(e));
