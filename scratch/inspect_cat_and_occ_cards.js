const { chromium } = require(require('path').resolve(__dirname, '../frontend/node_modules/playwright'));

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  await page.goto('http://localhost:3000/', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1500);

  const cardLinks = await page.evaluate(() => {
    // Find all links on the page that could be category or occasion cards
    const links = Array.from(document.querySelectorAll('a'));
    return links.map(a => {
      const heading = a.querySelector('h2, h3, h4, span, p');
      const text = a.innerText.trim().replace(/\n+/g, ' — ');
      const href = a.getAttribute('href');
      return { text, href, title: heading?.innerText?.trim() };
    }).filter(l => l.href && (
      l.href.includes('/products') ||
      l.href.includes('/category') ||
      l.href.includes('/categories') ||
      l.href.includes('/occasions') ||
      l.href.includes('occasion') ||
      l.href.includes('category')
    ));
  });

  console.log('--- Found Cards on Homepage ---');
  console.log(JSON.stringify(cardLinks, null, 2));

  await browser.close();
})();
