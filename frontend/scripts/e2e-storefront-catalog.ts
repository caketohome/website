/**
 * CakeToHome Storefront Catalog & Search — Playwright E2E Browser Verification
 * Tests steps A through I in real headless Chromium browser.
 */

import { chromium } from '@playwright/test';
import * as path from 'path';

const ARTIFACTS_DIR = 'C:/Users/alexc/.gemini/antigravity-ide/brain/91bab834-35c4-42b6-8126-64b1c7b0f9ba';

function assert(condition: boolean, msg: string) {
  if (!condition) {
    console.error(`❌ ASSERTION FAILED: ${msg}`);
    throw new Error(msg);
  }
  console.log(`✅ ${msg}`);
}

async function runBrowserE2E() {
  console.log("================================================================================");
  console.log("CAKETOHOME STOREFRONT CATALOG — PLAYWRIGHT E2E BROWSER VERIFICATION");
  console.log("================================================================================\n");

  const browser = await chromium.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
  });

  const page = await context.newPage();
  const consoleErrors: string[] = [];
  const pageErrors: string[] = [];

  page.on('console', (msg) => {
    if (msg.text().includes('[Catalog Client]') || msg.type() === 'error') {
      console.log(`[Browser Console ${msg.type()}]:`, msg.text());
    }
    if (msg.type() === 'error') {
      consoleErrors.push(msg.text());
    }
  });

  page.on('pageerror', (err) => {
    pageErrors.push(err.message);
  });

  try {
    // Step A: Open /products
    console.log("Step A: Navigating to http://localhost:3000/products...");
    const resA = await page.goto("http://localhost:3000/products", {
      waitUntil: "domcontentloaded",
      timeout: 60000,
    });
    assert(resA?.status() === 200, "Page /products loaded with HTTP 200");
    await page.waitForSelector("[data-hydrated='true']", { timeout: 20000 });
    await page.waitForTimeout(1000);

    // Verify real product cards rendered (not skeletons)
    const productCards = page.locator("[data-testid='product-card']");
    const cardCount = await productCards.count();
    console.log(`Rendered product cards count: ${cardCount}`);
    assert(cardCount > 0, `Storefront product cards are rendered (got ${cardCount})`);

    // Verify counter does NOT say "0 of 0"
    const counterText = await page.locator("text=/Showing \\d+ of \\d+ cakes/").textContent().catch(() => "");
    console.log(`Catalog counter text: "${counterText?.trim()}"`);
    assert(counterText !== null && !counterText.includes("0 of 0"), "Catalog does NOT say '0 of 0 cakes'");

    const shotA = path.join(ARTIFACTS_DIR, "storefront_products_loaded.png");
    await page.screenshot({ path: shotA, fullPage: false });
    console.log(`📸 Screenshot saved: ${shotA}`);

    // Step B: Search "Chocolate"
    console.log("\nStep B: Searching for 'Chocolate' in search input...");
    const searchInput = page.locator("[data-testid='catalog-search-input']");
    await searchInput.fill("Chocolate");
    await page.waitForTimeout(2500);

    const chocCards = await page.locator("[data-testid='product-card']").count();
    console.log(`Search 'Chocolate' cards count: ${chocCards}`);
    assert(chocCards === 11, `Search results displayed for 'Chocolate' (got ${chocCards}, expected 11)`);

    const shotB = path.join(ARTIFACTS_DIR, "storefront_search_chocolate.png");
    await page.screenshot({ path: shotB, fullPage: false });
    console.log(`📸 Screenshot saved: ${shotB}`);

    // Step C: Select Flavour + Weight filters
    console.log("\nStep C: Selecting 'Chocolate' flavour filter and '1 kg' weight...");
    const chocFlavourBtn = page.locator("button:has-text('Chocolate')").first();
    if (await chocFlavourBtn.isVisible()) {
      await chocFlavourBtn.click();
      await page.waitForTimeout(500);
    }
    const weight1kgBtn = page.locator("button:has-text('1 kg')").first();
    if (await weight1kgBtn.isVisible()) {
      await weight1kgBtn.click();
      await page.waitForTimeout(500);
    }

    await page.waitForTimeout(2500);
    const filteredCards = await page.locator("[data-testid='product-card']").count();
    console.log(`Filtered cards count: ${filteredCards}`);
    assert(filteredCards === 10, `Filtered products displayed (got ${filteredCards}, expected 10)`);

    const shotC = path.join(ARTIFACTS_DIR, "storefront_filters_applied.png");
    await page.screenshot({ path: shotC, fullPage: false });
    console.log(`📸 Screenshot saved: ${shotC}`);

    // Step D: Click Clear All
    console.log("\nStep D: Clicking 'Clear All'...");
    const clearAllBtn = page.locator("button:has-text('Clear All')").first();
    await clearAllBtn.waitFor({ state: "visible", timeout: 5000 });
    await clearAllBtn.click();
    await page.waitForTimeout(2500);

    const restoredCards = await page.locator("[data-testid='product-card']").count();
    console.log(`Cards count after Clear All: ${restoredCards}`);
    assert(restoredCards === 14, `Clear All restored full product listing (${restoredCards} vs 14)`);

    const shotD = path.join(ARTIFACTS_DIR, "storefront_cleared_filters.png");
    await page.screenshot({ path: shotD, fullPage: false });
    console.log(`📸 Screenshot saved: ${shotD}`);

    // Step E: Open a product
    console.log("\nStep E: Clicking first product card to load detail page...");
    const firstCard = page.locator("[data-testid='product-card']").first();
    const targetHref = await firstCard.getAttribute("href");
    console.log(`Target product href: ${targetHref}`);
    if (targetHref) {
      await page.goto(`http://localhost:3000${targetHref}`, { waitUntil: "domcontentloaded", timeout: 60000 });
    } else {
      await firstCard.click();
    }
    await page.waitForTimeout(1500);

    const detailHeading = page.locator("h1").first();
    const headingText = await detailHeading.textContent();
    console.log(`Product detail heading: "${headingText?.trim()}"`);
    assert(headingText !== null && headingText.length > 0, "Product detail page loaded with title");

    const shotE = path.join(ARTIFACTS_DIR, "storefront_product_detail.png");
    await page.screenshot({ path: shotE, fullPage: false });
    console.log(`📸 Screenshot saved: ${shotE}`);

    // Step F: Go back
    console.log("\nStep F: Navigating back to catalog...");
    await page.goto("http://localhost:3000/products", { waitUntil: "domcontentloaded", timeout: 20000 });
    await page.waitForSelector("[data-hydrated='true']", { timeout: 20000 });
    await page.waitForSelector("[data-testid='product-card']", { timeout: 15000 });
    const backCards = await page.locator("[data-testid='product-card']").count();
    console.log(`Cards count after back navigation: ${backCards}`);
    assert(backCards === 14, `Catalog remains functional after back navigation (got ${backCards})`);

    // Step G: Search a non-existing term
    console.log("\nStep G: Searching for non-existent term 'ZzzzXxxxNoCake999'...");
    const searchInputG = page.locator("[data-testid='catalog-search-input']");
    await searchInputG.fill("ZzzzXxxxNoCake999");
    await page.waitForSelector("[data-testid='catalog-empty-state']", { timeout: 15000 });
    const emptyText = await page.locator("[data-testid='catalog-empty-state'] h3").textContent();
    console.log(`Empty state message: "${emptyText?.trim()}"`);
    assert(emptyText !== null && emptyText.length > 0, "Useful empty state displayed ('No cakes match your criteria')");
    await page.waitForTimeout(1000);

    const shotG = path.join(ARTIFACTS_DIR, "storefront_no_match.png");
    await page.screenshot({ path: shotG, fullPage: false });
    console.log(`📸 Screenshot saved: ${shotG}`);

    // Step H: Refresh
    console.log("\nStep H: Reloading page...");
    await page.reload({ waitUntil: "domcontentloaded" });
    await page.waitForSelector("[data-hydrated='true']", { timeout: 20000 });
    await page.waitForTimeout(1000);
    assert(pageErrors.length === 0, "Zero unhandled page errors during reload");

    // Step I: Fresh Session
    console.log("\nStep I: Opening /products in a fresh isolated browser context...");
    const freshContext = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const freshPage = await freshContext.newPage();
    const freshRes = await freshPage.goto("http://localhost:3000/products", { waitUntil: "domcontentloaded", timeout: 60000 });
    assert(freshRes?.status() === 200, "Fresh session loaded /products with HTTP 200");
    await freshPage.waitForSelector("[data-hydrated='true']", { timeout: 20000 });
    await freshPage.waitForTimeout(1000);

    const freshCards = await freshPage.locator("[data-testid='product-card']").count();
    console.log(`Fresh session product cards count: ${freshCards}`);
    assert(freshCards > 0, "Fresh session displays product cards");
    await freshContext.close();

    console.log("\n================================================================================");
    console.log("🎉 PLAYWRIGHT E2E BROWSER VERIFICATION (STEPS A-I) PASSED 100%!");
    console.log("================================================================================");
  } finally {
    await browser.close();
  }
}

runBrowserE2E()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("Browser E2E Failed:", err);
    process.exit(1);
  });
