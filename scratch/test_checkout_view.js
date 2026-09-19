const path = require('path');
const { chromium } = require(path.join(__dirname, '../frontend/node_modules/playwright'));

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  
  const consoleMsgs = [];
  page.on('console', msg => consoleMsgs.push({ type: msg.type(), text: msg.text() }));

  console.log('Testing /checkout route on 375px and 1280px...');
  for (const width of [375, 1280]) {
    await page.setViewportSize({ width, height: 800 });
    const res = await page.goto('http://localhost:3000/checkout', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1000);
    const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
    const clientWidth = await page.evaluate(() => document.documentElement.clientWidth);
    const overflow = scrollWidth > clientWidth;
    console.log(`[${width}px] HTTP status: ${res.status()} | Overflow: ${overflow ? 'FAIL (' + scrollWidth + ' > ' + clientWidth + ')' : 'PASS'}`);
  }

  const errors = consoleMsgs.filter(m => m.type === 'error');
  console.log('Console errors:', errors.length ? errors : 'None');

  await browser.close();
})();
