const path = require('path');
const { chromium } = require(path.join(__dirname, '../frontend/node_modules/playwright'));

async function debugPage() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  await page.setViewportSize({ width: 375, height: 667 });
  await page.goto('http://localhost:3000', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2500);

  const overflowInfo = await page.evaluate(() => {
    const winWidth = window.innerWidth;
    const docWidth = document.documentElement.scrollWidth;
    const bodyWidth = document.body.scrollWidth;

    const overflowingElements = [];
    document.querySelectorAll('*').forEach(el => {
      const rect = el.getBoundingClientRect();
      if (rect.right > winWidth + 1 || rect.width > winWidth + 1) {
        overflowingElements.push({
          tag: el.tagName,
          className: el.className ? String(el.className).substring(0, 100) : '',
          id: el.id,
          width: Math.round(rect.width),
          right: Math.round(rect.right),
          text: el.textContent ? el.textContent.substring(0, 50).trim() : ''
        });
      }
    });

    const header = document.querySelector('header');
    const headerRect = header ? header.getBoundingClientRect() : null;
    const headerChildren = header ? Array.from(header.children).map(c => ({
      tag: c.tagName,
      className: String(c.className).substring(0, 100),
      height: Math.round(c.getBoundingClientRect().height)
    })) : [];

    return {
      winWidth,
      docWidth,
      bodyWidth,
      overflowingCount: overflowingElements.length,
      overflowingElements: overflowingElements.slice(0, 15),
      headerHeight: headerRect ? Math.round(headerRect.height) : 0,
      headerChildren
    };
  });

  console.log("=== OVERFLOW & HEADER DEBUG ===");
  console.log(JSON.stringify(overflowInfo, null, 2));

  await browser.close();
}

debugPage().catch(console.error);
