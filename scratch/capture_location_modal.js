const path = require('path');
const { chromium } = require(path.join(process.cwd(), 'frontend/node_modules/playwright'));

async function run() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();

  console.log('Navigating to http://localhost:3000/...');
  await page.goto('http://localhost:3000/', { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForTimeout(2000);

  // Click Set location button
  const locBtn = page.getByRole('button', { name: /set location|location/i }).first();
  if (await locBtn.isVisible()) {
    console.log('Clicking location button...');
    await locBtn.click();
    await page.waitForTimeout(1000);
    await page.screenshot({ path: 'scratch/screenshots/location_modal.png' });
    console.log('Saved location modal screenshot');
  } else {
    console.log('Location button not found');
  }

  await browser.close();
}

run().catch(err => { console.error(err); process.exit(1); });
