const { chromium } = require('playwright');
const crypto = require('crypto');
const path = require('path');

const SECRET = process.env.JWT_SECRET || 'supersecret';

function createJwt(userId, role, branchId = null) {
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
  const payload = Buffer.from(JSON.stringify({
    userId,
    role,
    branchId,
    exp: Math.floor(Date.now() / 1000) + 7 * 86400,
    iat: Math.floor(Date.now() / 1000)
  })).toString('base64url');
  const sig = crypto.createHmac('sha256', SECRET).update(`${header}.${payload}`).digest('base64url');
  return `${header}.${payload}.${sig}`;
}

const SCREENSHOT_DIR = 'C:\\Users\\alexc\\.gemini\\antigravity-ide\\brain\\32bebf93-8421-489f-96dd-e2ae2ce852e7\\screenshots';

async function captureAdminView() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });

  const adminToken = createJwt('admin_01', 'SUPER_ADMIN', null);
  await context.addCookies([
    { name: '_cth_jwt', value: adminToken, domain: 'localhost', path: '/' },
    { name: '_cth_role', value: 'SUPER_ADMIN', domain: 'localhost', path: '/' },
    { name: '_cth_user_id', value: 'admin_01', domain: 'localhost', path: '/' }
  ]);

  const page = await context.newPage();
  await page.goto('http://localhost:3001/dashboard?tab=teller_custody&subtab=branch_cash', { timeout: 60000 });
  await page.waitForTimeout(3000);

  const rowCount = await page.locator('tbody tr').count();
  console.log(`Super Admin Branch Cash Position row count: ${rowCount}`);

  const shotPath = path.join(SCREENSHOT_DIR, '05_super_admin_branch_cash_position.png');
  await page.screenshot({ path: shotPath, fullPage: true });
  console.log(`Saved: ${shotPath}`);

  await browser.close();
}

captureAdminView();
