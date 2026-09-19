const path = require('path');
const { chromium } = require(path.join(__dirname, '../frontend/node_modules/playwright'));

async function main() {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  await page.goto('http://localhost:3000', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2000);
  const items = await page.evaluate(() => {
    return Array.from(document.querySelectorAll('a[href*="/products?category="]')).map(a => ({
      tag: a.tagName,
      href: a.getAttribute('href'),
      className: a.className,
      parentTag: a.parentElement ? a.parentElement.tagName : null,
      parentClass: a.parentElement ? a.parentElement.className : null,
      text: a.textContent.trim().slice(0, 50)
    }));
  });
  console.log(JSON.stringify(items, null, 2));
  await browser.close();
}

main().catch(console.error);
