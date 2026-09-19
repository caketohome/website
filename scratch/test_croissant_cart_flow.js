const path = require('path');
const { chromium } = require(path.resolve(__dirname, '../frontend/node_modules/playwright'));

async function testCroissantCart() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await context.newPage();

  console.log('Navigating to http://localhost:3000/products/butter-croissant...');
  await page.goto('http://localhost:3000/products/butter-croissant', { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForTimeout(2000);

  const addToBagBtn = page.locator('[data-testid="pdp-add-to-bag"]').first();
  await addToBagBtn.waitFor({ state: 'visible', timeout: 10000 });
  console.log('Clicking "Add to Cart" for Butter Croissant...');
  await addToBagBtn.click({ force: true });

  const confirmBtn = page.locator('#btn-confirm-add-to-cart');
  try {
    await confirmBtn.waitFor({ state: 'visible', timeout: 3000 });
    console.log('Clicking modal continue...');
    await confirmBtn.click({ force: true });
  } catch (_) {}

  const cartDrawer = page.locator('[data-testid="cart-drawer-panel"]').first();
  await cartDrawer.waitFor({ state: 'visible', timeout: 15000 });
  console.log('Cart drawer opened!');
  await page.waitForTimeout(1000);

  const itemsContainer = page.locator('[data-testid="cart-items-container"]').first();
  const text = await itemsContainer.textContent();
  console.log('Items in drawer:', text?.trim());

  const totalPayable = page.locator('[data-testid="cart-total-payable"]').first();
  const totalText = await totalPayable.textContent();
  console.log('Total Payable in Drawer:', totalText?.trim());

  await browser.close();
}

testCroissantCart().catch(console.error);
