const path = require('path');
const { chromium } = require(path.join(__dirname, '../frontend/node_modules/playwright'));

async function check() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await page.goto('http://localhost:3000/products', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2000);
  const info = await page.evaluate(() => {
    function getDetails(el) {
      if (!el) return null;
      const cs = window.getComputedStyle(el);
      return {
        tag: el.tagName,
        className: typeof el.className === 'string' ? el.className : '',
        bgColor: cs.backgroundColor,
        color: cs.color
      };
    }
    return {
      html: getDetails(document.documentElement),
      body: getDetails(document.body),
      main: getDetails(document.querySelector('main')),
      catalogRoot: getDetails(document.querySelector('[data-testid="products-catalog-root"]')),
      h1: getDetails(document.querySelector('h1'))
    };
  });
  console.log(JSON.stringify(info, null, 2));
  await page.screenshot({ path: path.join(__dirname, 'screenshots_repaired/products_clean_check.png') });
  console.log('Saved products_clean_check.png');
  await browser.close();
}

check().catch(console.error);
