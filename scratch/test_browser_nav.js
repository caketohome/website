const { chromium } = require('../frontend/node_modules/playwright');

async function run() {
  console.log('Launching browser...');
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  await context.addCookies([
    { name: '_cth_role', value: 'SUPER_ADMIN', domain: 'localhost', path: '/' },
    { name: '_cth_user_id', value: 'admin_01', domain: 'localhost', path: '/' },
  ]);

  const page = await context.newPage();
  page.on('console', msg => console.log('PAGE LOG:', msg.text()));
  page.on('pageerror', err => console.log('PAGE ERROR:', err.message));

  console.log('Navigating to dashboard?tab=accounting_work_queue...');
  const start = Date.now();
  await page.goto('http://localhost:3001/dashboard?tab=accounting_work_queue', {
    waitUntil: 'domcontentloaded',
    timeout: 90000
  });
  console.log(`DOM loaded in ${Date.now() - start}ms.`);

  // Wait 4 seconds for React hydration & API data fetch
  await page.waitForTimeout(4000);

  const title = await page.title();
  console.log('Title:', title);

  const text = await page.innerText('body');
  console.log('Body length:', text.length);
  console.log('Body preview (first 600 chars):');
  console.log(text.substring(0, 600));

  await browser.close();
  console.log('Browser test finished.');
}

run().catch(console.error);
