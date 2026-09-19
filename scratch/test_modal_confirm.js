const path = require('path');
const { chromium } = require(path.resolve(__dirname, '../frontend/node_modules/playwright'));
const fs = require('fs');

async function testModalConfirm() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  page.on('console', msg => console.log('BROWSER CONSOLE:', msg.type(), msg.text()));
  page.on('pageerror', err => console.error('BROWSER PAGE ERROR:', err));

  console.log('Navigating to /products/chocolate-fudge-cupcake...');
  await page.goto('http://localhost:3000/products/chocolate-fudge-cupcake', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2000);

  const addToBagBtn = page.locator('[data-testid="pdp-add-to-bag"]').first();
  console.log('Clicking Add to Bag...');
  await addToBagBtn.click();

  const confirmBtn = page.locator('#btn-confirm-add-to-cart');
  await confirmBtn.waitFor({ state: 'visible', timeout: 5000 });
  console.log('Modal visible! Clicking continue...');
  await confirmBtn.click();

  // Wait 4 seconds for server action and drawer
  await page.waitForTimeout(4000);

  const drawer = page.locator('[data-testid="cart-drawer-panel"]').first();
  const isDrawerVisible = await drawer.isVisible();
  console.log('Is cart drawer visible?', isDrawerVisible);

  await page.screenshot({ path: path.resolve(__dirname, 'screenshots/after_modal_confirm.png') });
  console.log('Saved after_modal_confirm.png');

  await browser.close();
}

testModalConfirm().catch(console.error);
