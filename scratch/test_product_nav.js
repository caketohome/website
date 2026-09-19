const path = require('path');
const { chromium } = require(path.join(__dirname, '../frontend/node_modules/playwright'));

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  await page.setViewportSize({ width: 375, height: 667 });
  await page.goto('http://localhost:3000', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2000);

  const links = await page.evaluate(() => {
    return Array.from(document.querySelectorAll('a[href*="/products/"]')).map(a => {
      const rect = a.getBoundingClientRect();
      return {
        href: a.getAttribute('href'),
        rect: { top: rect.top, left: rect.left, width: rect.width, height: rect.height },
        className: a.className,
        zIndex: window.getComputedStyle(a).zIndex
      };
    });
  });

  console.log('Total /products/ links:', links.length);
  console.log('First 3 links:', links.slice(0, 3));

  if (links.length > 0) {
    const firstLink = page.locator('a[href*="/products/"]').first();
    console.log('Clicking first link...');
    await firstLink.click();
    await page.waitForTimeout(3000);
    console.log('Navigated URL:', page.url());
  }

  await browser.close();
})();
