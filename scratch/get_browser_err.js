const path = require('path');
const { chromium } = require(path.resolve(__dirname, '../frontend/node_modules/playwright'));
(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  page.on('pageerror', err => console.log('PAGEERROR_MSG:', err.message, '\nSTACK:\n', err.stack));
  page.on('console', msg => {
    if (msg.type() === 'error') console.log('CONSOLE_ERR:', msg.text());
  });
  await page.goto('http://localhost:3000/products/chocolate-fudge-cupcake', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2000);
  const btn = page.locator('[data-testid="pdp-add-to-bag"]').first();
  await btn.click();
  await page.waitForTimeout(4000);
  await browser.close();
})().catch(console.error);
