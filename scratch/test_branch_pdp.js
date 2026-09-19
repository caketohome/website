const path = require('path');
const { chromium } = require(path.join(__dirname, '../frontend/node_modules/playwright'));

async function test() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  await context.addCookies([
    { name: '_cakes2home_branch_id', value: 'br_koramangala', domain: 'localhost', path: '/' }
  ]);
  const page = await context.newPage();
  await page.goto('http://localhost:3000/products/chocolate-fudge-cupcake', { waitUntil: 'networkidle' });

  const content = await page.content();
  console.log('Has Temporarily Unavailable:', content.includes('Temporarily Unavailable at this Kitchen'));
  console.log('Has Sold Out:', content.includes('Sold Out'));
  console.log('Has Freshly Baked:', content.includes('Freshly Baked on Order'));

  const addBtn = page.locator('[data-testid="pdp-add-to-bag"]').first();
  console.log('Add to Bag button disabled:', await addBtn.isDisabled());
  console.log('Add to Bag button text:', (await addBtn.textContent()).trim());

  await browser.close();
}

test().catch(console.error);
