const path = require('path');
const { chromium } = require(path.resolve(__dirname, '../frontend/node_modules/playwright'));

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  await page.goto('http://localhost:3000/products/chocolate-fudge-cupcake', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2000);

  const hasBus = await page.evaluate(() => Boolean(window.__CTH_CART_EVENT_BUS__));
  console.log('Has bus on window?', hasBus);

  await page.evaluate(() => {
    if (window.__CTH_CART_EVENT_BUS__) {
      window.__CTH_CART_EVENT_BUS__.emitOpenCart();
    }
  });
  await page.waitForTimeout(1000);

  const isDrawerVis = await page.locator('[data-testid="cart-drawer-panel"]').isVisible();
  console.log('Is drawer visible after bus emit?', isDrawerVis);

  // Take screenshot
  await page.screenshot({ path: path.resolve(__dirname, 'screenshots/test_bus_eval.png') });
  console.log('Saved test_bus_eval.png');

  await browser.close();
})().catch(console.error);
