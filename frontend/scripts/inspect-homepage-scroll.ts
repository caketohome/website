import { chromium } from "playwright";
import * as path from "path";

const ARTIFACT_DIR = "C:/Users/alexc/.gemini/antigravity-ide/brain/494e1f14-65a8-4093-9062-5bdf6f901811";

async function inspectHomepageScroll() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();

  console.log("Navigating to http://localhost:3000/...");
  await page.goto("http://localhost:3000/", { waitUntil: "domcontentloaded", timeout: 20000 });
  await page.waitForTimeout(1500);

  // Dismiss popup if present
  try {
    const popupClose = page.locator("[role='dialog'] button[aria-label*='Close'], [role='dialog'] button:has-text('✕'), [role='dialog'] button:has-text('No thanks')").first();
    if (await popupClose.isVisible({ timeout: 1000 })) {
      await popupClose.click({ force: true });
      await page.waitForTimeout(300);
    }
  } catch (e) {}

  const scrollPositions = [0, 800, 1600, 2400, 3200, 4000, 5000];

  for (const pos of scrollPositions) {
    await page.evaluate((y) => window.scrollTo(0, y), pos);
    await page.waitForTimeout(500);
    const filename = `homepage_scroll_${pos}px.png`;
    await page.screenshot({ path: path.join(ARTIFACT_DIR, filename) });
    console.log(`Saved screenshot at ${pos}px: ${filename}`);
  }

  await browser.close();
}

inspectHomepageScroll().catch(console.error);
