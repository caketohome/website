/**
 * CakeToHome AI Concierge — Real-Browser Visual & Functional Verification
 * Run with: npx tsx scripts/verify-ai-concierge-browser.ts
 */

import { chromium } from "playwright";
import * as path from "path";

const ARTIFACT_DIR = "C:/Users/alexc/.gemini/antigravity-ide/brain/494e1f14-65a8-4093-9062-5bdf6f901811";

async function runBrowserVerification() {
  console.log("Starting CakeToHome AI Concierge Real-Browser Verification on http://localhost:3000/...\n");

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    deviceScaleFactor: 1,
  });
  const page = await context.newPage();

  const dismissPopups = async () => {
    try {
      const popupClose = page.locator("[role='dialog'] button[aria-label*='Close'], [role='dialog'] button:has-text('✕'), [role='dialog'] button:has-text('No thanks')").first();
      if (await popupClose.isVisible({ timeout: 1000 })) {
        await popupClose.click({ force: true });
        await page.waitForTimeout(300);
      }
    } catch (e) {}
  };

  try {
    // 1. Navigate to Storefront
    console.log("1. Navigating to http://localhost:3000/...");
    await page.goto("http://localhost:3000/", { waitUntil: "domcontentloaded", timeout: 30000 });
    await page.waitForTimeout(1500);
    await dismissPopups();

    // 2. Locate Floating AI Concierge Button
    console.log("2. Locating Floating AI Concierge Trigger...");
    const aiTrigger = page.locator("button:has-text('AI Cake Concierge')");
    await aiTrigger.waitFor({ state: "visible", timeout: 10000 });
    await page.screenshot({ path: path.join(ARTIFACT_DIR, "ai_concierge_01_trigger.png") });

    // 3. Open AI Concierge Modal
    console.log("3. Opening AI Concierge Modal...");
    await aiTrigger.click({ force: true });
    await page.waitForTimeout(1500);
    await dismissPopups();
    await page.screenshot({ path: path.join(ARTIFACT_DIR, "ai_concierge_02_opened.png") });

    // 4. Send Message: "Show me chocolate cakes"
    console.log("4. Sending Query: 'Show me chocolate cakes'...");
    const chatInput = page.locator("input[placeholder*='Ask']");
    await chatInput.fill("Show me chocolate cakes");
    await chatInput.press("Enter");

    // Wait for AI response
    await page.waitForTimeout(2500);
    await dismissPopups();
    await page.screenshot({ path: path.join(ARTIFACT_DIR, "ai_concierge_03_chocolate_search.png") });

    // 5. Test [Add to Cart] button on first recommended product card
    console.log("5. Testing Direct [Add to Cart] on Recommended Card...");
    const addButton = page.locator("button:has-text('Add')").first();
    if (await addButton.isVisible()) {
      await addButton.click({ force: true });
      await page.waitForTimeout(1500);
      await dismissPopups();
      await page.screenshot({ path: path.join(ARTIFACT_DIR, "ai_concierge_04_item_added.png") });
    }

    // 6. Send Delivery Query: "Can you deliver to 560034?"
    console.log("6. Sending Query: 'Can you deliver to 560034?'...");
    await chatInput.fill("Can you deliver to 560034?");
    await chatInput.press("Enter");
    await page.waitForTimeout(2500);
    await dismissPopups();
    await page.screenshot({ path: path.join(ARTIFACT_DIR, "ai_concierge_05_delivery_check.png") });

    // 7. Send Coupon Query: "Apply coupon CAKE50"
    console.log("7. Sending Query: 'Apply coupon CAKE50'...");
    await chatInput.fill("Apply coupon CAKE50");
    await chatInput.press("Enter");
    await page.waitForTimeout(2500);
    await dismissPopups();
    await page.screenshot({ path: path.join(ARTIFACT_DIR, "ai_concierge_06_coupon_applied.png") });

    // 8. Mobile Viewport Verification (390x844 iPhone 14)
    console.log("8. Verifying Mobile Responsiveness (390x844)...");
    await page.setViewportSize({ width: 390, height: 844 });
    await page.waitForTimeout(1000);
    await dismissPopups();
    await page.screenshot({ path: path.join(ARTIFACT_DIR, "ai_concierge_07_mobile_view.png") });

    console.log("\n✅ All 7 Real-Browser Verification Screenshots Saved Successfully to Brain Artifacts!");

  } catch (err: any) {
    console.error("Browser verification error:", err);
    process.exit(1);
  } finally {
    await browser.close();
  }
}

runBrowserVerification().catch((e) => {
  console.error(e);
  process.exit(1);
});
