const path = require('path');
const { chromium } = require(path.join(__dirname, '../frontend/node_modules/playwright'));

async function test() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  await context.addCookies([
    { name: '_cakes2home_branch_id', value: 'br_indiranagar', domain: 'localhost', path: '/' }
  ]);
  const page = await context.newPage();

  // First, set Indiranagar to OUT_OF_STOCK via PATCH
  const patchRes = await fetch('http://localhost:3000/api/v1/branches/br_indiranagar/products/prod_01KXYMAJKNDZ4T2YVA7K144XP5/availability', {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      'x-user-role': 'SUPER_ADMIN',
      'Cookie': '_cth_role=SUPER_ADMIN; _cth_user_id=admin_01;'
    },
    body: JSON.stringify({ status: 'OUT_OF_STOCK' })
  });
  console.log('PATCH to OUT_OF_STOCK status:', patchRes.status);

  await page.goto('http://localhost:3000/products/chocolate-fudge-cupcake', { waitUntil: 'networkidle' });
  await page.waitForTimeout(2000);

  const content = await page.content();
  console.log('Has Temporarily Unavailable:', content.includes('Temporarily Unavailable at this Kitchen'));
  console.log('Has Sold Out:', content.includes('Sold Out'));

  // Restore to AVAILABLE
  await fetch('http://localhost:3000/api/v1/branches/br_indiranagar/products/prod_01KXYMAJKNDZ4T2YVA7K144XP5/availability', {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      'x-user-role': 'SUPER_ADMIN',
      'Cookie': '_cth_role=SUPER_ADMIN; _cth_user_id=admin_01;'
    },
    body: JSON.stringify({ status: 'AVAILABLE' })
  });

  await browser.close();
}

test().catch(console.error);
