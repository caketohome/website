const path = require('path');
const { chromium } = require(path.join(process.cwd(), 'frontend/node_modules/playwright'));

async function run() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();

  console.log('Visiting /cart...');
  await page.goto('http://localhost:3000/cart', { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForTimeout(1500);
  await page.screenshot({ path: 'scratch/screenshots/cart_diagnostic.png', fullPage: true });

  console.log('Visiting /checkout...');
  await page.goto('http://localhost:3000/checkout', { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForTimeout(1500);
  await page.screenshot({ path: 'scratch/screenshots/checkout_diagnostic.png', fullPage: true });

  await browser.close();
}

run().catch(err => { console.error(err); process.exit(1); });
