const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const { chromium } = require(path.resolve(__dirname, '../frontend/node_modules/playwright'));

function signTestToken(payload) {
  const secret = process.env.JWT_SECRET || 'supersecret';
  const header = { alg: 'HS256', typ: 'JWT' };
  const fullPayload = {
    userId: payload.userId || 'admin_01',
    role: payload.role || 'SUPER_ADMIN',
    phone: payload.phone || '+91 99999 00001',
    isSuperAdmin: true,
    exp: Math.floor(Date.now() / 1000) + 3600,
    iat: Math.floor(Date.now() / 1000),
  };
  const b64 = (obj) => Buffer.from(JSON.stringify(obj)).toString('base64url');
  const data = `${b64(header)}.${b64(fullPayload)}`;
  const sig = crypto.createHmac('sha256', secret).update(data).digest('base64url');
  return `${data}.${sig}`;
}

const adminToken = signTestToken({ userId: 'admin_01', role: 'SUPER_ADMIN' });

async function dumpDom() {
  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  await ctx.addCookies([
    { name: '_cth_jwt', value: adminToken, domain: 'localhost', path: '/' },
    { name: '_cth_role', value: 'SUPER_ADMIN', domain: 'localhost', path: '/' },
    { name: '_cth_user_id', value: 'admin_01', domain: 'localhost', path: '/' },
  ]);
  const page = await ctx.newPage();
  await page.goto('http://localhost:3001/dashboard?tab=teller', { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForTimeout(2000);

  const buttons = await page.locator('button').allInnerTexts();
  console.log('Buttons on page:', buttons.filter(b => b.trim().length > 0));

  const text = await page.locator('main').innerText().catch(() => page.locator('body').innerText());
  console.log('Page text snippet:\n', text.substring(0, 1000));

  await page.screenshot({ path: path.join(__dirname, 'screenshots_remediation/01_dashboard_teller_full.png'), fullPage: true });
  await browser.close();
}

dumpDom().catch(console.error);
