const path = require('path');
const { chromium } = require(path.resolve(__dirname, '../frontend/node_modules/playwright'));

async function printErrors() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  const errors = [];
  page.on('console', msg => {
    errors.push(`[${msg.type()}] ${msg.text()}`);
  });
  page.on('pageerror', err => {
    errors.push(`[PAGEERROR] ${err.message}\n${err.stack}`);
  });

  await page.goto('http://localhost:3000/products/chocolate-fudge-cupcake', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(3000);

  console.log('--- Errors during page load ---');
  errors.forEach(e => console.log(e));
  errors.length = 0;

  console.log('\n--- Clicking Add to Bag ---');
  const btn = page.locator('[data-testid="pdp-add-to-bag"]').first();
  await btn.click({ force: true });
  await page.waitForTimeout(3000);

  console.log('--- Errors after click ---');
  errors.forEach(e => console.log(e));

  await browser.close();
}

printErrors().catch(console.error);
