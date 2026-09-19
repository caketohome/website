const path = require('path');
const { chromium } = require(path.join(process.cwd(), 'frontend/node_modules/playwright'));

async function run() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();

  // Test /products/chocolate-truffle
  console.log('Testing /products/chocolate-truffle...');
  const res1 = await page.goto('http://localhost:3000/products/chocolate-truffle', { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForTimeout(2000);
  await page.screenshot({ path: 'scratch/screenshots/pdp_chocolate_truffle.png', fullPage: true });
  console.log('chocolate-truffle status:', res1.status());

  // Test /products/red-bee
  console.log('Testing /products/red-bee...');
  const res2 = await page.goto('http://localhost:3000/products/red-bee', { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForTimeout(2000);
  await page.screenshot({ path: 'scratch/screenshots/pdp_red_bee.png', fullPage: true });
  console.log('red-bee status:', res2.status());

  await browser.close();
}

run().catch(err => { console.error(err); process.exit(1); });
