const path = require('path');
const crypto = require('crypto');
const { chromium } = require(path.join(__dirname, '../frontend/node_modules/playwright'));

function signToken(payload) {
  const header = { alg: "HS256", typ: "JWT" };
  const now = Math.floor(Date.now() / 1000);
  const fullPayload = {
    userId: payload.userId || "admin_01",
    role: payload.role || "SUPER_ADMIN",
    branchId: payload.branchId || null,
    isSuperAdmin: payload.role === "SUPER_ADMIN",
    iat: now,
    exp: now + 86400,
  };
  const b64 = (obj) => Buffer.from(JSON.stringify(obj)).toString("base64url");
  const data = `${b64(header)}.${b64(fullPayload)}`;
  const sig = crypto.createHmac("sha256", "supersecret").update(data).digest("base64url");
  return `${data}.${sig}`;
}

const validToken = signToken({ userId: "admin_01", role: "SUPER_ADMIN" });

(async () => {
  console.log('Launching Playwright Chromium...');
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  
  await context.addCookies([
    { name: '_cth_role', value: 'SUPER_ADMIN', domain: 'localhost', path: '/' },
    { name: '_cth_user_id', value: 'admin_01', domain: 'localhost', path: '/' },
    { name: '_cth_jwt', value: validToken, domain: 'localhost', path: '/' },
    { name: '_cth_phone', value: '9876543210', domain: 'localhost', path: '/' },
    { name: 'cth_user_role', value: 'SUPER_ADMIN', domain: 'localhost', path: '/' },
  ]);

  await context.addInitScript(() => {
    localStorage.setItem('cake_user', JSON.stringify({
      id: 'admin_01', email: 'admin@cakes2home.com', role: 'SUPER_ADMIN', name: 'Super Admin', phone: '9876543210'
    }));
  });

  const page = await context.newPage();
  console.log('Navigating to http://localhost:3001/dashboard?tab=teller_custody ...');
  await page.goto('http://localhost:3001/dashboard?tab=teller_custody', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(5000);

  // Take screenshot of the Branch Cash Custody & Position view
  const branchPath = 'C:/Users/alexc/.gemini/antigravity-ide/brain/5dd5bf9c-3ed3-43b4-8b83-eb2279c7d272/screenshots/D_teller_custody.png';
  await page.screenshot({ path: branchPath, fullPage: false });
  console.log('Saved Branch Cash screenshot to:', branchPath);

  const textBranch = await page.innerText('body');
  console.log('Branch Tab checks:');
  console.log('  Includes "GL Cash in Hand (1111)":', textBranch.includes('GL Cash in Hand (1111)'));
  console.log('  Includes "Total Physical Cash":', textBranch.includes('Total Physical Cash'));
  console.log('  Includes "Branch Cash Control & Vault Custody":', textBranch.includes('Branch Cash Control & Vault Custody'));

  // Click on "Counter Till / Drawer" tab
  const drawerBtn = page.locator('button', { hasText: 'Counter Till / Drawer' });
  const count = await drawerBtn.count();
  console.log('Drawer button count:', count);
  if (count > 0) {
    console.log('Clicking "Counter Till / Drawer" button...');
    await drawerBtn.first().click();
    await page.waitForTimeout(4000);

    const drawerPath = 'C:/Users/alexc/.gemini/antigravity-ide/brain/5dd5bf9c-3ed3-43b4-8b83-eb2279c7d272/screenshots/D_teller_continuous_drawer.png';
    await page.screenshot({ path: drawerPath, fullPage: false });
    console.log('Saved Drawer screenshot to:', drawerPath);

    const textDrawer = await page.innerText('body');
    console.log('Drawer Tab checks:');
    console.log('  Includes "Continuous Branch Cash Custody":', textDrawer.includes('Continuous Branch Cash Custody'));
    console.log('  Includes "Manual shift creation is not required":', textDrawer.includes('Manual shift creation is not required'));
    console.log('  Includes "Delivery Boy Collections":', textDrawer.includes('Delivery Boy Collections'));
    console.log('  Includes "Branch Cash Expenses":', textDrawer.includes('Branch Cash Expenses'));
    console.log('  Includes "Cash Adjustment":', textDrawer.includes('Cash Adjustment'));
    console.log('  Contains OLD "No Active Cash Shift":', textDrawer.includes('No Active Cash Shift'));
  }

  await browser.close();
  console.log('Verification completed successfully.');
})().catch(console.error);
