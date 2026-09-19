const path = require('path');
const { chromium } = require(path.join(__dirname, '../frontend/node_modules/playwright'));

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  page.on('console', m => console.log('PAGE LOG:', m.text()));
  page.on('response', r => {
    if (r.url().includes('/cart') || r.url().includes('/items')) {
      console.log('CART REQUEST:', r.request().method(), r.url(), 'STATUS:', r.status());
    }
  });

  await page.goto('http://localhost:3000/products/chocolate-truffle');
  await page.waitForTimeout(1500);

  // Check buttons
  const addBtn = await page.$('button#btn-add-to-cart, button:has-text("Add to Cart"), button:has-text("Add To Cart")');
  console.log('Add button found:', Boolean(addBtn));

  if (addBtn) {
    await addBtn.click();
    await page.waitForTimeout(1000);
  }

  // Check validation error
  const validationError = await page.$eval('.text-rose-500, [class*="validation"], [class*="error"]', e => e.textContent).catch(() => 'None');
  console.log('Validation error on page:', validationError);

  // Check confirm dialog
  const confirmBtn = await page.$('#btn-confirm-add-to-cart, button:has-text("Continue")');
  console.log('Confirm button modal found:', Boolean(confirmBtn));
  if (confirmBtn) {
    await confirmBtn.click();
    await page.waitForTimeout(2000);
  }

  const cookies = await page.context().cookies();
  console.log('Cookies after add to cart:', cookies.map(c => `${c.name}=${c.value}`));

  // Check cart contents via API
  const cartCookie = cookies.find(c => c.name === '_cth_cart_id' || c.name === '_medusa_cart_id');
  console.log('Cart cookie:', cartCookie ? cartCookie.value : 'MISSING');

  if (cartCookie) {
    const cartRes = await page.evaluate(async (cid) => {
      const res = await fetch(`/api/v1/cart/${cid}`);
      return res.json();
    }, cartCookie.value);
    console.log('Cart contents:', JSON.stringify(cartRes, null, 2));
  }

  await browser.close();
})();
