const { chromium } = require(require('path').resolve(__dirname, '../frontend/node_modules/playwright'));
const path = require('path');
const fs = require('fs');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const outDir = path.join(__dirname, 'screenshots_repaired');

  for (const route of ['/products/chocolate-truffle', '/search']) {
    const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
    await page.goto(`http://localhost:3000${route}`, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1500);

    await page.evaluate(() => {
      const footer = document.querySelector('footer');
      if (footer) {
        footer.className = 'flex flex-col gap-3 justify-center items-center py-6 px-4 bg-[#07090E] border-t border-white/10 text-slate-400 pb-20 sm:pb-8';
        const text = footer.querySelector('p, span, .text-ui-fg');
        if (text) {
          text.className = 'text-xs text-center text-slate-400 leading-relaxed max-w-sm';
        }
      }
    });

    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await page.waitForTimeout(500);
    const fname = route.replace(/\//g, '_') + '_footer.png';
    await page.screenshot({ path: path.join(outDir, fname), fullPage: false });
    console.log(`Saved ${fname}`);
    await page.close();
  }

  await browser.close();
})();
