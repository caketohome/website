const path = require('path');
const { chromium } = require(path.join(__dirname, '../frontend/node_modules/playwright'));

(async () => {
  console.log("=== Wishlist Interaction & Persistence Test (Logged-in Customer) ===");
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();

  await context.addCookies([
    { name: "_cth_role", value: "CUSTOMER", domain: "localhost", path: "/" },
    { name: "_cth_user_id", value: "usr_e2e_1787894282794", domain: "localhost", path: "/" },
    { name: "_cth_phone", value: "+919876543210", domain: "localhost", path: "/" },
    { name: "_cth_jwt", value: "dummy_jwt_token", domain: "localhost", path: "/" },
  ]);

  const page = await context.newPage();

  // Handle any confirmation dialog if triggered
  page.on('dialog', async dialog => {
    console.log(`Dialog message: "${dialog.message()}"`);
    await dialog.accept();
  });

  // Track /api/customer/favorites and /api/auth/me
  page.on('response', res => {
    const u = res.url();
    if (u.includes('/api/auth/me') || u.includes('/api/customer/favorites')) {
      console.log(`[API Response] ${res.status()} ${u}`);
    }
  });

  await page.goto('http://localhost:3000', { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForTimeout(2000);

  // Check initial wishlist aria-label
  const initialAria = await page.evaluate(() => {
    const link = document.querySelector('a[href="/account/wishlist"]');
    return link ? link.getAttribute('aria-label') : 'not found';
  });
  console.log(`Initial header wishlist aria: "${initialAria}"`);

  // Find wishlist button on first product card
  const wishlistBtn = await page.$('[data-testid="product-card"] button[aria-label*="Favorites" i], [data-testid="product-card"] button[aria-label*="Wishlist" i]');
  if (wishlistBtn) {
    const btnAria = await wishlistBtn.getAttribute('aria-label');
    console.log(`Found wishlist button: "${btnAria}". Clicking to toggle...`);
    await wishlistBtn.click();
    await page.waitForTimeout(2000);

    const afterClickAria = await page.evaluate(() => {
      const link = document.querySelector('a[href="/account/wishlist"]');
      return link ? link.getAttribute('aria-label') : 'not found';
    });
    console.log(`Header wishlist aria after click: "${afterClickAria}"`);

    const btnAriaAfter = await wishlistBtn.getAttribute('aria-label');
    console.log(`Product card button aria after click: "${btnAriaAfter}"`);

    // Click again to toggle back
    console.log(`Clicking again to toggle back...`);
    await wishlistBtn.click();
    await page.waitForTimeout(2000);

    const finalAria = await page.evaluate(() => {
      const link = document.querySelector('a[href="/account/wishlist"]');
      return link ? link.getAttribute('aria-label') : 'not found';
    });
    console.log(`Header wishlist aria after toggle back: "${finalAria}"`);
  } else {
    console.log("No wishlist button found on product card.");
  }

  await browser.close();
  console.log("Wishlist test completed successfully.");
})();
