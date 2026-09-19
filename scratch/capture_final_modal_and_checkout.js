const path = require('path');
const { chromium } = require(path.join(__dirname, '../frontend/node_modules/playwright'));

const BASE_URL = 'http://localhost:3000';
const SCREENSHOT_DIR = path.join(__dirname, 'screenshots/final_verification');

async function main() {
  const browser = await chromium.launch({ headless: true });

  // 1. Capture Location Modal
  console.log('--- 1. Capturing Location Modal ("Search Area" Tab) ---');
  {
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    await page.goto(`${BASE_URL}/`, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForTimeout(3000);

    const visibleBtn = page.locator('button[aria-label="Select delivery location"]:visible').first();
    await visibleBtn.click();
    await page.waitForTimeout(1500);

    const outPath = path.join(SCREENSHOT_DIR, '02_location_modal_search_area.png');
    await page.screenshot({ path: outPath });
    console.log('Saved:', outPath);
    await page.close();
  }

  // 2. Add product to cart and capture active Checkout Step 1
  console.log('\n--- 2. Adding Product to Cart & Capturing Checkout Step 1 ---');
  {
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    
    // Go to product PDP
    console.log('Navigating to product page...');
    await page.goto(`${BASE_URL}/products/chocolate-truffle`, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForTimeout(2000);

    // Click Add to Cart
    const addBtn = page.locator('button#btn-add-to-cart, button:has-text("Add to Cart"), button:has-text("Add To Cart")').first();
    if (await addBtn.isVisible()) {
      console.log('Clicking Add to Cart...');
      await addBtn.click();
      await page.waitForTimeout(1000);

      // Check for confirm add-to-cart modal
      const confirmBtn = page.locator('#btn-confirm-add-to-cart, button:has-text("Continue"), button:has-text("Add with")').first();
      if (await confirmBtn.isVisible()) {
        console.log('Clicking Confirm Add to Cart...');
        await confirmBtn.click();
        await page.waitForTimeout(1500);
      }
    }

    // Now go to /checkout
    console.log('Navigating to checkout...');
    await page.goto(`${BASE_URL}/checkout`, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForTimeout(2500);

    const outPath = path.join(SCREENSHOT_DIR, '03_checkout_step1_active.png');
    await page.screenshot({ path: outPath, fullPage: true });
    console.log('Saved:', outPath);
    await page.close();
  }

  await browser.close();
  console.log('\nCompleted successfully.');
}

main().catch(console.error);
