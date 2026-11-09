const path = require('path');
const { chromium } = require(path.join(__dirname, '../frontend/node_modules/playwright'));

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  await context.addCookies([
    { name: '_cth_role', value: 'SUPER_ADMIN', domain: 'localhost', path: '/' },
    { name: '_cth_user_id', value: 'admin_01', domain: 'localhost', path: '/' },
    { name: '_cth_jwt', value: 'mock_jwt_super_admin', domain: 'localhost', path: '/' },
    { name: '_cth_phone', value: '9999999999', domain: 'localhost', path: '/' },
  ]);
  const page = await context.newPage();
  await page.goto('http://localhost:3001/dashboard?tab=teller_custody', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(5000);

  console.log('Current URL:', page.url());
  const bodyText = await page.innerText('body');
  console.log('--- BODY TEXT START ---');
  console.log(bodyText.substring(0, 1500));
  console.log('--- BODY TEXT END ---');

  await browser.close();
})().catch(console.error);
