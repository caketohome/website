const path = require('path');
const { chromium } = require(path.join(__dirname, '../frontend/node_modules/playwright'));

async function capture() {
  console.log('Launching Playwright Chromium...');
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 }
  });

  // Set Super Admin Auth Cookies for dashboard access
  await context.addCookies([
    { name: "_cth_role", value: "SUPER_ADMIN", domain: "localhost", path: "/" },
    { name: "_cth_user_id", value: "admin_01", domain: "localhost", path: "/" },
    { name: "_cth_jwt", value: "mock_jwt_super_admin", domain: "localhost", path: "/" },
    { name: "_cth_phone", value: "9876543210", domain: "localhost", path: "/" },
    { name: "cth_user_role", value: "SUPER_ADMIN", domain: "localhost", path: "/" },
  ]);

  // Inject admin session into localStorage before load
  await context.addInitScript(() => {
    localStorage.setItem('cake_user', JSON.stringify({
      id: 'admin_01',
      email: 'admin@cakes2home.com',
      role: 'SUPER_ADMIN',
      name: 'Super Admin',
      phone: '9876543210',
      branch_id: 'br_koramangala'
    }));
  });

  const page = await context.newPage();
  console.log('Navigating to http://localhost:3001/dashboard?tab=teller_custody ...');
  await page.goto('http://localhost:3001/dashboard?tab=teller_custody', { waitUntil: 'domcontentloaded', timeout: 30000 });

  // Wait for React to mount and hydrate
  console.log('Waiting for page elements to render...');
  await page.waitForTimeout(5000);

  console.log('Current URL after navigation:', page.url());

  const screenshotBranchPath = 'C:/Users/alexc/.gemini/antigravity-ide/brain/5dd5bf9c-3ed3-43b4-8b83-eb2279c7d272/screenshots/D_teller_custody.png';
  await page.screenshot({ path: screenshotBranchPath, fullPage: false });
  console.log('Saved Branch Cash screenshot to:', screenshotBranchPath);

  // Check visible text
  const content = await page.innerText('body');
  const hasNoActiveShift = content.includes('No Active Cash Shift');
  const hasBranchCash = content.includes('Branch Cash Custody') || content.includes('Cash in Hand');
  console.log('Page checks:');
  console.log('  Contains "No Active Cash Shift":', hasNoActiveShift);
  console.log('  Contains "Branch Cash Custody / Cash in Hand":', hasBranchCash);

  // Now click on Counter Till / Drawer subtab
  const drawerTab = page.locator('button:has-text("Counter Till / Drawer")');
  if (await drawerTab.count() > 0) {
    console.log('Clicking "Counter Till / Drawer" subtab...');
    await drawerTab.first().click();
    await page.waitForTimeout(3000);

    const screenshotDrawerPath = 'C:/Users/alexc/.gemini/antigravity-ide/brain/5dd5bf9c-3ed3-43b4-8b83-eb2279c7d272/screenshots/D_teller_continuous_drawer.png';
    await page.screenshot({ path: screenshotDrawerPath, fullPage: false });
    console.log('Saved Drawer screenshot to:', screenshotDrawerPath);

    const drawerContent = await page.innerText('body');
    const drawerHasNoActiveShift = drawerContent.includes('No Active Cash Shift');
    const drawerHasContinuous = drawerContent.includes('Continuous Branch Cash Custody') || drawerContent.includes('Ready & Operational');
    console.log('Drawer Tab checks:');
    console.log('  Contains "No Active Cash Shift":', drawerHasNoActiveShift);
    console.log('  Contains "Continuous Branch Cash Custody / Ready & Operational":', drawerHasContinuous);
  } else {
    console.log('Warning: Counter Till / Drawer button not found in page');
  }

  await browser.close();
  console.log('Capture completed successfully.');
}

capture().catch(err => {
  console.error('Capture failed:', err);
  process.exit(1);
});
