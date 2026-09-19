const { chromium } = require(require('path').resolve(__dirname, '../frontend/node_modules/playwright'));
const path = require('path');
const fs = require('fs');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  await page.goto('http://localhost:3000/', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1500);

  // Test 1: Style footer with proper dark luxury styling
  await page.evaluate(() => {
    const footer = document.querySelector('footer');
    if (footer) {
      // Remove broken bg-ui-fg-base text-ui-fg-on-inverted
      footer.className = 'flex flex-col gap-3 justify-center items-center py-6 px-4 bg-[#07090E] border-t border-white/10 text-slate-400 pb-20 sm:pb-8';
      const text = footer.querySelector('p, span, .text-ui-fg');
      if (text) {
        text.className = 'text-xs text-center text-slate-400 leading-relaxed max-w-sm';
      }
    }
  });

  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await page.waitForTimeout(500);

  const outDir = path.join(__dirname, 'screenshots_repaired');
  await page.screenshot({ path: path.join(outDir, 'test_footer_styled_mobile.png'), fullPage: false });

  // Test desktop
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await page.waitForTimeout(500);
  await page.screenshot({ path: path.join(outDir, 'test_footer_styled_desktop.png'), fullPage: false });

  console.log('Screenshots saved: test_footer_styled_mobile.png and test_footer_styled_desktop.png');
  await browser.close();
})();
