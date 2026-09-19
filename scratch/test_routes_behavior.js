const { chromium } = require(require('path').resolve(__dirname, '../frontend/node_modules/playwright'));

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  const testRoutes = [
    { name: 'Occasion Anniversary', url: 'http://localhost:3000/occasions/anniversary' },
    { name: 'Occasion Birthday', url: 'http://localhost:3000/occasions/birthday' },
    { name: 'Category Chocolate Cakes Slug', url: 'http://localhost:3000/category/chocolate-cakes' },
    { name: 'Products Category Param', url: 'http://localhost:3000/products?category=chocolate-cakes' },
    { name: 'Products Occasion Param', url: 'http://localhost:3000/products?occasion=anniversary' }
  ];

  for (const r of testRoutes) {
    try {
      const res = await page.goto(r.url, { waitUntil: 'domcontentloaded', timeout: 30000 });
      await page.waitForTimeout(1000);
      const status = res?.status();
      const title = await page.title();
      const info = await page.evaluate(() => {
        const h1 = document.querySelector('h1')?.innerText?.trim();
        const h2 = document.querySelector('h2')?.innerText?.trim();
        const productLinks = Array.from(document.querySelectorAll('a[href^="/products/"]')).map(a => a.innerText.trim()).filter(Boolean);
        const cakeCountBadge = document.querySelector('span[class*="rounded-full"]')?.innerText?.trim();
        const notFound = document.body.innerText.includes('This page could not be found') || document.body.innerText.includes('404');
        return { h1, h2, cakeCountBadge, productCount: productLinks.length, notFound, sampleProducts: productLinks.slice(0, 4) };
      });
      console.log(`\n=== ${r.name} (${r.url}) ===`);
      console.log(`Status: ${status} | Title: "${title}" | 404: ${info.notFound}`);
      console.log(`H1: "${info.h1}" | H2: "${info.h2}" | Product count: ${info.productCount}`);
      console.log(`Sample products:`, info.sampleProducts);
    } catch (e) {
      console.error(`Error loading ${r.name}:`, e.message);
    }
  }

  await browser.close();
})();
