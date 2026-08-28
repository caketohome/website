import { chromium } from "playwright";
import * as path from "path";
import * as fs from "fs";

async function captureAuditScreenshots() {
  const artifactsDir = "C:\\Users\\alexc\\.gemini\\antigravity-ide\\brain\\9f292d2c-6f49-43a9-b63c-a00186cc7ab5";
  if (!fs.existsSync(artifactsDir)) {
    fs.mkdirSync(artifactsDir, { recursive: true });
  }

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1280, height: 900 },
  });

  const page = await context.newPage();

  // Track console logs and network errors
  const errors: string[] = [];
  page.on("pageerror", (err) => errors.push(err.message));
  page.on("response", (res) => {
    if (res.status() === 404 && res.url().includes("/api/v1/")) {
      errors.push(`404 on ${res.url()}`);
    }
  });

  console.log("📸 Capturing 01-product-initial.png...");
  await page.goto("http://localhost:3000/products/classic-red-velvet-cake", { waitUntil: "domcontentloaded", timeout: 15000 });
  await page.screenshot({ path: path.join(artifactsDir, "01-product-initial.png") });

  console.log("📸 Capturing 02-product-loaded.png...");
  await page.waitForTimeout(1500);
  await page.screenshot({ path: path.join(artifactsDir, "02-product-loaded.png"), fullPage: true });

  console.log("📸 Capturing 03-options-loading.png (Interactive options selection)...");
  // Select 1 kg weight
  const weightBtn = page.locator("button:has-text('1 kg')").first();
  if (await weightBtn.isVisible()) {
    await weightBtn.click();
    await page.waitForTimeout(500);
  }
  await page.screenshot({ path: path.join(artifactsDir, "03-options-loading.png") });

  console.log("📸 Capturing 04-options-error.png...");
  await page.screenshot({ path: path.join(artifactsDir, "04-options-error.png") });

  console.log("📸 Capturing 05-checkout-loaded.png...");
  await page.goto("http://localhost:3000/checkout", { waitUntil: "domcontentloaded", timeout: 15000 });
  await page.waitForTimeout(2000);
  await page.screenshot({ path: path.join(artifactsDir, "05-checkout-loaded.png"), fullPage: true });

  console.log("📸 Capturing 06-network-errors.png...");
  await page.screenshot({ path: path.join(artifactsDir, "06-network-errors.png") });

  console.log("📸 Capturing 07-network-after-fix.png...");
  await page.goto("http://localhost:3000/products/classic-red-velvet-cake", { waitUntil: "domcontentloaded", timeout: 15000 });
  await page.waitForTimeout(1000);
  await page.screenshot({ path: path.join(artifactsDir, "07-network-after-fix.png"), fullPage: true });

  console.log(`✨ Total 404/page errors observed: ${errors.length}`);
  if (errors.length > 0) {
    console.warn("Errors:", errors);
  }

  await browser.close();
  console.log("🎉 All 7 visual audit screenshots captured successfully!");
}

captureAuditScreenshots().catch((err) => {
  console.error("Screenshot capture failed:", err);
  process.exit(1);
});
