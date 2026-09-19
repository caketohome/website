const path = require('path');
const { chromium } = require(path.join(__dirname, '../frontend/node_modules/playwright'));

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  await page.goto('http://localhost:3000/products/belgian-chocolate-truffle-cake', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1000);

  // Scroll down
  await page.evaluate(() => {
    window.scrollTo(0, 800);
    window.dispatchEvent(new Event('scroll'));
  });
  await page.waitForTimeout(1000);

  const bar = await page.$('[data-testid="pdp-sticky-bar"]');
  console.log('Sticky bar present at scroll 800px:', bar !== null);
  if (bar) {
    const text = await bar.innerText();
    console.log('Sticky bar content:', text.replace(/\n+/g, ' '));
    await page.screenshot({ path: 'C:\\Users\\alexc\\.gemini\\antigravity-ide\\brain\\3002f95e-032a-416b-b5d6-0b0e5cba2669\\screenshots_pdp\\sticky_bar_mobile.png' });
    console.log('Saved sticky_bar_mobile.png');
  }

  // Scroll back up to top
  await page.evaluate(() => {
    window.scrollTo(0, 0);
    window.dispatchEvent(new Event('scroll'));
  });
  await page.waitForTimeout(800);
  const barTop = await page.$('[data-testid="pdp-sticky-bar"]');
  console.log('Sticky bar hidden at scroll 0px:', barTop === null);

  await browser.close();
})();
