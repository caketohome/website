const path = require('path');
const fs = require('fs');
const { chromium } = require(path.join(__dirname, '../frontend/node_modules/playwright'));

const BASE_URL = 'http://localhost:3000';
const SCREENSHOT_DIR = path.join(__dirname, 'screenshots/final_verification');

async function run() {
  const browser = await chromium.launch({ headless: true });

  // 1. Location Modal
  console.log('1. Capturing Location Modal open on Search Area...');
  {
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await ctx.newPage();
    await page.goto(`${BASE_URL}/`, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForTimeout(2000);

    // Click the Set Location button
    const locBtn = page.locator('button[aria-label="Select delivery location"]').first();
    await locBtn.click();
    await page.waitForTimeout(1000);

    const filename = '02_location_modal_search_area.png';
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, filename) });
    console.log(`Saved: ${filename}`);
    await ctx.close();
  }

  // 2. Active Checkout Step 1
  console.log('\n2. Adding product to cart and capturing Checkout Step 1...');
  {
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await ctx.newPage();

    // First go to /search or product page to add an item
    await page.goto(`${BASE_URL}/search`, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForTimeout(2000);

    // Click first "Add to Cart" or "Select" button
    const addBtn = page.locator('button:has-text("Add to Cart"), button:has-text("Add"), button:has-text("Order")').first();
    if (await addBtn.isVisible()) {
      await addBtn.click();
      await page.waitForTimeout(2000);
    }

    // Now go to /checkout
    await page.goto(`${BASE_URL}/checkout`, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForTimeout(2500);

    const filename = '03_checkout_step1_active.png';
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, filename), fullPage: true });
    console.log(`Saved: ${filename}`);
    await ctx.close();
  }

  await browser.close();
  console.log('Done.');
}

run().catch(console.error);
