const path = require('path');
const { chromium } = require(path.join(__dirname, '../frontend/node_modules/playwright'));

(async () => {
  console.log("=== Testing Real ProductCard Favorites on /products ===");
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();

  await context.addCookies([
    { name: "_cth_role", value: "CUSTOMER", domain: "localhost", path: "/" },
    { name: "_cth_user_id", value: "usr_e2e_1787894282794", domain: "localhost", path: "/" },
    { name: "_cth_phone", value: "+919876543210", domain: "localhost", path: "/" },
    { name: "_cth_jwt", value: "dummy_jwt_token", domain: "localhost", path: "/" },
  ]);

  const page = await context.newPage();

  page.on('dialog', async dialog => {
    console.log(`Dialog: "${dialog.message()}"`);
    await dialog.accept();
  });

  page.on('response', res => {
    const u = res.url();
    if (u.includes('/api/customer/favorites')) {
      console.log(`[FAVORITES API] ${res.status()} ${res.request().method()} ${u}`);
    }
  });

  await page.goto('http://localhost:3000/products', { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForTimeout(2000);

  const cards = await page.$$('[data-testid="product-card"]');
  console.log(`Found ${cards.length} real product cards on /products`);

  if (cards.length > 0) {
    const firstCard = cards[0];
    const favBtn = await firstCard.$('button[aria-label*="Favorites" i]');
    if (favBtn) {
      const ariaBefore = await favBtn.getAttribute('aria-label');
      console.log(`Initial button aria: "${ariaBefore}"`);

      console.log("Clicking favorites button on first card...");
      await favBtn.click();
      await page.waitForTimeout(2000);

      const ariaAfter = await favBtn.getAttribute('aria-label');
      console.log(`Button aria after click: "${ariaAfter}"`);

      const headerAria = await page.evaluate(() => {
        const link = document.querySelector('a[href="/account/wishlist"]');
        return link ? link.getAttribute('aria-label') : 'not found';
      });
      console.log(`Header favorites aria: "${headerAria}"`);

      // Click again to toggle off
      console.log("Clicking again to toggle off...");
      await favBtn.click();
      await page.waitForTimeout(2000);

      const ariaFinal = await favBtn.getAttribute('aria-label');
      console.log(`Button aria after toggle off: "${ariaFinal}"`);

      const headerAriaFinal = await page.evaluate(() => {
        const link = document.querySelector('a[href="/account/wishlist"]');
        return link ? link.getAttribute('aria-label') : 'not found';
      });
      console.log(`Header favorites aria final: "${headerAriaFinal}"`);
    } else {
      console.log("Favorites button not found in first product card.");
    }
  }

  await browser.close();
  console.log("Done.");
})();
