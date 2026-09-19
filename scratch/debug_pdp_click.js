const { chromium } = require('../frontend/node_modules/playwright');
const path = require('path');
const fs = require('fs');

async function debugPdpClick() {
  const screenshotsDir = path.join(__dirname, 'screenshots');
  if (!fs.existsSync(screenshotsDir)) {
    fs.mkdirSync(screenshotsDir, { recursive: true });
  }

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await context.newPage();

  page.on('console', msg => console.log('BROWSER CONSOLE:', msg.type(), msg.text()));
  page.on('pageerror', err => console.error('BROWSER PAGE ERROR:', err));

  console.log('Navigating to /products/chocolate-fudge-cupcake...');
  await page.goto('http://localhost:3000/products/chocolate-fudge-cupcake', { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForTimeout(2000);

  // Click Add to Bag
  const addToBagBtn = page.locator('[data-testid="pdp-add-to-bag"]').first();
  console.log('Clicking Add to Bag...');
  await addToBagBtn.click();
  await page.waitForTimeout(1000);

  await page.screenshot({ path: path.join(screenshotsDir, 'debug_after_click.png'), fullPage: false });
  console.log('Captured debug_after_click.png');

  // Check if confirmation modal or error banner or drawer is present
  const confirmModal = page.locator('#empty-message-confirmation-modal');
  console.log('Is empty-message modal visible?', await confirmModal.isVisible().catch(() => false));

  const errorBanner = page.locator('text=Unable to add');
  console.log('Is error banner visible?', await errorBanner.isVisible().catch(() => false));

  const successBanner = page.locator('text=Successfully added');
  console.log('Is success banner visible?', await successBanner.isVisible().catch(() => false));

  const drawer = page.locator('[data-testid="cart-drawer-panel"]');
  console.log('Is drawer visible?', await drawer.isVisible().catch(() => false));

  // If confirm modal is visible, click continue
  if (await confirmModal.isVisible().catch(() => false)) {
    console.log('Clicking continue on confirm modal...');
    const continueBtn = page.locator('#btn-confirm-add-to-cart');
    await continueBtn.click();
    await page.waitForTimeout(2000);
    await page.screenshot({ path: path.join(screenshotsDir, 'debug_after_continue.png'), fullPage: false });
    console.log('Is drawer visible after continue?', await drawer.isVisible().catch(() => false));
    console.log('Is success banner visible after continue?', await successBanner.isVisible().catch(() => false));
  }

  await browser.close();
}

debugPdpClick().catch(console.error);
