const path = require('path');
const crypto = require('crypto');
const { chromium } = require(path.resolve(__dirname, '../frontend/node_modules/@playwright/test'));

function signJwt() {
  const now = Math.floor(Date.now() / 1000);
  const p = {
    userId: 'admin_01',
    role: 'SUPER_ADMIN',
    phone: '9999999999',
    customerUid: 'admin_01',
    customerId: 'admin_01',
    branchId: null,
    partnerId: null,
    name: 'Super Admin',
    email: 'superadmin@cakes2home.com',
    isSuperAdmin: true,
    iat: now,
    exp: now + 3600
  };
  const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
  const d = `${b64({ alg: 'HS256', typ: 'JWT' })}.${b64(p)}`;
  return `${d}.${crypto.createHmac('sha256', 'supersecret').update(d).digest('base64url')}`;
}

(async () => {
  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext();
  await ctx.addCookies([
    { name: '_cth_jwt', value: signJwt(), domain: 'localhost', path: '/' },
    { name: '_cth_jwt', value: signJwt(), domain: '127.0.0.1', path: '/' }
  ]);
  const page = await ctx.newPage();
  page.on('pageerror', (e) => {
    console.log('PAGEERROR:', e.message);
    console.log('STACK:', e.stack);
  });
  page.on('console', (m) => {
    if (m.type() === 'error') {
      console.log('CONSOLE ERROR:', m.text().slice(0, 500), m.location());
    }
  });
  page.on('response', async (r) => {
    if (r.url().includes('/api/') || r.status() >= 400) {
      let bodyPreview = '';
      if (r.url().includes('/api/')) {
        try {
          bodyPreview = (await r.text()).slice(0, 200);
        } catch {}
      }
      console.log('RESP', r.status(), r.url().slice(0, 150), bodyPreview);
    }
  });

  console.log('Navigating to http://localhost:3000/accounting/bank-management ...');
  await page.goto('http://localhost:3000/accounting/bank-management', { waitUntil: 'networkidle', timeout: 180000 });
  await page.waitForTimeout(3000);
  const bodyText = await page.locator('body').innerText();
  console.log('Body contains HDFC:', bodyText.includes('HDFC'));
  console.log('Trying click Add Bank Account...');
  await page.getByRole('button', { name: /Add Bank Account/ }).first().click();
  await page.waitForTimeout(1000);
  const modalVisible = await page.getByPlaceholder('e.g. HDFC Bank, ICICI Bank, SBI').isVisible();
  console.log('Add Bank Modal visible after click:', modalVisible);
  await browser.close();
})();
