const path = require('path');
const { chromium } = require(path.join(process.cwd(), 'frontend/node_modules/playwright'));

async function run() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  await context.addCookies([
    { name: '_cth_role', value: 'SUPER_ADMIN', domain: 'localhost', path: '/' },
    { name: '_cth_user_id', value: 'admin_01', domain: 'localhost', path: '/' }
  ]);
  const page = await context.newPage();

  page.on('console', msg => console.log('[BROWSER]', msg.type(), msg.text()));
  page.on('pageerror', err => console.error('[PAGE_ERROR]', err.message));

  console.log('Navigating to http://localhost:3000/dashboard?tab=popups...');
  await page.goto('http://localhost:3000/dashboard?tab=popups', { waitUntil: 'networkidle', timeout: 30000 });

  await page.screenshot({ path: 'scratch/screenshots/dashboard_popups.png', fullPage: true });
  console.log('Screenshot saved to scratch/screenshots/dashboard_popups.png');

  // Check if Create Campaign button exists
  const createBtn = page.getByRole('button', { name: /create|new popup|new campaign/i }).first();
  if (await createBtn.isVisible()) {
    console.log('Clicking Create Campaign button...');
    await createBtn.click();
    await page.waitForTimeout(1500);
    await page.screenshot({ path: 'scratch/screenshots/popup_editor_drawer.png', fullPage: true });
    console.log('Screenshot of drawer saved to scratch/screenshots/popup_editor_drawer.png');

    const drawerInfo = await page.evaluate(() => {
      const inputs = Array.from(document.querySelectorAll('input, select, textarea')).map(i => ({
        tagName: i.tagName,
        type: i.type,
        color: window.getComputedStyle(i).color,
        bg: window.getComputedStyle(i).backgroundColor,
        placeholder: i.placeholder
      }));
      const labels = Array.from(document.querySelectorAll('label, .text-xs')).map(l => ({
        text: l.innerText ? l.innerText.slice(0, 40) : '',
        color: window.getComputedStyle(l).color
      })).slice(0, 15);
      return { inputsCount: inputs.length, inputsSample: inputs.slice(0, 5), labelsSample: labels };
    });
    console.log('Drawer elements:', JSON.stringify(drawerInfo, null, 2));
  } else {
    console.log('Create button not found or visible');
  }

  await browser.close();
}

run().catch(err => {
  console.error('Test error:', err);
  process.exit(1);
});
