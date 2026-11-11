const path = require('path');
const { chromium } = require(path.resolve(__dirname, '../frontend/node_modules/playwright'));

async function main() {
  const browser = await chromium.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const page = await browser.newPage({
    viewport: { width: 1280, height: 900 }
  });

  const targetUrl = 'http://127.0.0.1:3000/your-order?order_id=ord_live_nb_1794401032340';
  console.log('Navigating to:', targetUrl);
  await page.goto(targetUrl, { waitUntil: 'networkidle', timeout: 60000 });
  await page.waitForTimeout(2000);

  const shotPath = path.resolve(__dirname, '../artifacts/phase-9-browser-verification/06-order-live-status-confirmed-desktop.png');
  await page.screenshot({ path: shotPath, fullPage: true });
  console.log('Captured screenshot to:', shotPath);

  const text = await page.locator('body').innerText();
  console.log('Page text snippet:\n', text.substring(0, 500));

  await browser.close();
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
