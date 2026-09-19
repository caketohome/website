const path = require('path');
const { chromium } = require(path.join(__dirname, '../frontend/node_modules/playwright'));

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 }
  });
  const page = await context.newPage();
  
  await page.goto('http://127.0.0.1:3000', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1000);

  // Scroll down 1200px
  await page.evaluate(() => window.scrollTo(0, 1200));
  await page.waitForTimeout(300);

  // Click visible cart button
  const cartButtons = await page.$$('button[aria-label="Shopping Cart"]');
  for (const btn of cartButtons) {
    if (await btn.isVisible()) {
      await btn.click();
      break;
    }
  }
  await page.waitForTimeout(500);

  const hierarchy = await page.evaluate(() => {
    const bag = document.querySelector('[class*="bg-[#0D152B]"]');
    if (!bag) return { error: 'bag not found' };

    const chain = [];
    let el = bag;
    while (el) {
      const style = window.getComputedStyle(el);
      const rect = el.getBoundingClientRect();
      chain.push({
        tag: el.tagName,
        id: el.id,
        className: el.className ? el.className.toString().slice(0, 80) : '',
        rect: { top: rect.top, left: rect.left, width: rect.width, height: rect.height },
        position: style.position,
        top: style.top,
        left: style.left,
        transform: style.transform,
        contain: style.contain,
        filter: style.filter,
        backdropFilter: style.backdropFilter,
        willChange: style.willChange
      });
      el = el.parentElement;
    }
    return chain;
  });

  console.log('DOM Hierarchy from Bag to Root:');
  console.log(JSON.stringify(hierarchy, null, 2));

  await browser.close();
})();
