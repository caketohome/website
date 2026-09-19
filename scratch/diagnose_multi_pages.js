const { chromium } = require(require('path').resolve(__dirname, '../frontend/node_modules/playwright'));
const path = require('path');
const fs = require('fs');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const routes = [
    { name: 'home', path: '/' },
    { name: 'pdp', path: '/products/chocolate-truffle' },
    { name: 'cart', path: '/cart' },
    { name: 'search', path: '/search' }
  ];

  const outDir = path.join(__dirname, 'screenshots_repaired');
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

  for (const r of routes) {
    const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
    try {
      console.log(`\nNavigating to ${r.path}...`);
      await page.goto(`http://localhost:3000${r.path}`, { waitUntil: 'domcontentloaded', timeout: 15000 });
      await page.waitForTimeout(1500);

      const info = await page.evaluate(() => {
        const main = document.querySelector('main');
        const footer = document.querySelector('footer');
        const body = document.body;
        
        return {
          bodyScrollHeight: body.scrollHeight,
          bodyClientHeight: body.clientHeight,
          mainMinHeight: main ? window.getComputedStyle(main).minHeight : null,
          mainHeight: main ? window.getComputedStyle(main).height : null,
          footerOffsetTop: footer ? footer.offsetTop : null,
          footerHeight: footer ? footer.offsetHeight : null,
          footerBg: footer ? window.getComputedStyle(footer).backgroundColor : null,
          footerColor: footer ? window.getComputedStyle(footer).color : null,
          footerClass: footer ? footer.className : null
        };
      });

      console.log(`[${r.name}] Info:`, JSON.stringify(info, null, 2));

      await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
      await page.waitForTimeout(500);
      await page.screenshot({ path: path.join(outDir, `multi_${r.name}_mobile.png`), fullPage: false });
    } catch (e) {
      console.error(`Error loading ${r.path}:`, e.message);
    } finally {
      await page.close();
    }
  }

  await browser.close();
})();
