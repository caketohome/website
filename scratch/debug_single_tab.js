const { chromium } = require('../frontend/node_modules/playwright');

async function testTab(tab) {
  console.log(`\n=== DEBUGGING TAB: ${tab} ===`);
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  await context.addCookies([
    { name: '_cth_role', value: 'SUPER_ADMIN', domain: 'localhost', path: '/' },
    { name: '_cth_user_id', value: 'admin_01', domain: 'localhost', path: '/' },
    { name: '_cth_jwt', value: 'mock_jwt_super_admin', domain: 'localhost', path: '/' }
  ]);

  const page = await context.newPage();
  page.on('console', msg => console.log('CONSOLE:', msg.text()));
  page.on('pageerror', err => console.log('PAGE ERROR:', err.message));

  const url = `http://localhost:3001/dashboard?tab=${tab}`;
  console.log('Navigating to:', url);
  const resp = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });
  console.log('HTTP Status:', resp.status());
  console.log('Current URL:', page.url());

  await page.waitForTimeout(4000);
  console.log('After 4s URL:', page.url());
  const text = await page.innerText('body');
  console.log('Text preview:', text.substring(0, 300).replace(/\n+/g, ' '));

  await browser.close();
}

async function run() {
  await testTab('gateway_settlements');
  await testTab('accounting_work_queue');
  await testTab('cost_allocations');
}

run().catch(console.error);
