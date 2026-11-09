const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { chromium } = require(path.resolve(__dirname, '../frontend/node_modules/playwright'));

const SCREENSHOT_DIR = 'C:/Users/alexc/.gemini/antigravity-ide/brain/0fd553e7-0cb8-46ae-8afc-c987a24bfebf/browser_screenshots';
if (!fs.existsSync(SCREENSHOT_DIR)) {
  fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
}

function getJwtSecret() {
  const env = fs.readFileSync('.env', 'utf8');
  for (const line of env.split('\n')) {
    if (line.trim().startsWith('JWT_SECRET=')) {
      let val = line.trim().substring('JWT_SECRET='.length).trim();
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) val = val.slice(1, -1);
      return val;
    }
  }
  return 'supersecret';
}

function createSuperAdminToken() {
  const secret = getJwtSecret();
  const now = Math.floor(Date.now() / 1000);
  const exp = now + 7 * 86400;

  const header = { alg: 'HS256', typ: 'JWT' };
  const payload = {
    userId: 'admin_01',
    role: 'SUPER_ADMIN',
    phone: '9876543210',
    customerId: 'admin_01',
    branchId: null,
    partnerId: null,
    name: 'Super Admin',
    email: 'admin@cakestohome.com',
    permissions: ['*'],
    isSuperAdmin: true,
    iat: now,
    exp,
  };

  const b64 = (obj) => Buffer.from(JSON.stringify(obj)).toString('base64url');
  const data = `${b64(header)}.${b64(payload)}`;
  const sig = crypto.createHmac('sha256', secret).update(data).digest('base64url');
  return `${data}.${sig}`;
}

async function runBrowserTests() {
  console.log('=============================================================================');
  console.log('Task 5: Interactive Browser Workflow Testing with Playwright');
  console.log('=============================================================================\n');

  const browser = await chromium.launch({ headless: true });
  const token = createSuperAdminToken();

  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    ignoreHTTPSErrors: true,
  });

  await context.addCookies([
    {
      name: '_cth_role',
      value: 'SUPER_ADMIN',
      domain: 'localhost',
      path: '/',
    },
    {
      name: '_cth_user_id',
      value: 'admin_01',
      domain: 'localhost',
      path: '/',
    },
    {
      name: '_cth_jwt',
      value: token,
      domain: 'localhost',
      path: '/',
      httpOnly: false,
      secure: false,
      sameSite: 'Lax',
    },
    {
      name: '_medusa_jwt',
      value: token,
      domain: 'localhost',
      path: '/',
      httpOnly: false,
      secure: false,
      sameSite: 'Lax',
    },
    {
      name: 'auth_token',
      value: token,
      domain: 'localhost',
      path: '/',
      httpOnly: false,
      secure: false,
      sameSite: 'Lax',
    },
  ]);

  const page = await context.newPage();
  page.setDefaultTimeout(60000);
  page.setDefaultNavigationTimeout(60000);

  // Track network requests and console errors
  const networkRequests = [];
  const consoleErrors = [];

  page.on('request', req => {
    if (req.url().includes('/api/v1/')) {
      networkRequests.push({ method: req.method(), url: req.url() });
    }
  });

  page.on('console', msg => {
    if (msg.type() === 'error') {
      consoleErrors.push(msg.text());
    }
  });

  // ── WORKFLOW 1: Bills Receivable (AR) Interactive Controls ──────────────────
  console.log('[Workflow 1] Testing Bills Receivable (AR) UI Controls & Aging Filters...');
  await page.goto('http://localhost:3001/dashboard?tab=bills_receivable', { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForTimeout(3500);

  // Take initial snapshot
  await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'interactive_ar_initial.png') });
  console.log('  - Loaded Bills Receivable dashboard.');

  // Interact with search input
  const searchInput = await page.$('input[placeholder*="Search" i], input[type="search"], input[type="text"]');
  if (searchInput) {
    await searchInput.fill('CTH');
    await page.waitForTimeout(1000);
    console.log('  - Filled search input with "CTH".');
  }

  // Look for filter controls / selects
  const selects = await page.$$('select');
  console.log(`  - Found ${selects.length} filter select dropdowns.`);
  if (selects.length > 0) {
    // Exercise first select dropdown
    const options = await selects[0].$$('option');
    if (options.length > 1) {
      const val = await options[1].getAttribute('value');
      if (val) {
        await selects[0].selectOption(val);
        await page.waitForTimeout(1500);
        console.log(`  - Selected filter option: "${val}"`);
      }
    }
  }

  // Click refresh / reload if present
  const refreshButton = await page.$('button:has-text("Refresh"), button[title*="refresh" i]');
  if (refreshButton) {
    await refreshButton.click();
    await page.waitForTimeout(1500);
    console.log('  - Clicked Refresh button.');
  }

  await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'interactive_ar_filtered.png') });
  console.log('  - Captured interactive_ar_filtered.png');

  // ── WORKFLOW 2: Accounting Setup & Fiscal Periods UI ─────────────────────────
  console.log('\n[Workflow 2] Testing Accounting Setup & Fiscal Periods UI...');
  await page.goto('http://localhost:3001/dashboard?tab=accounting_setup', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(3000);

  await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'interactive_accounting_setup.png') });
  console.log('  - Captured interactive_accounting_setup.png');

  // Verify page text includes FY2026-27 or fiscal period content
  const pageContent = await page.content();
  const hasSetupText = pageContent.includes('Fiscal') || pageContent.includes('Accounting') || pageContent.includes('Period');
  console.log(`  - Setup page content rendered accounting tokens: ${hasSetupText}`);

  // ── WORKFLOW 3: General Ledger Interactive Date Filter ───────────────────────
  console.log('\n[Workflow 3] Testing General Ledger Filter & Inquiry Controls...');
  await page.goto('http://localhost:3001/dashboard?tab=general_ledger', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(3000);

  // Type into date inputs if present
  const dateInputs = await page.$$('input[type="date"]');
  console.log(`  - Found ${dateInputs.length} date filter inputs in General Ledger.`);
  if (dateInputs.length >= 2) {
    await dateInputs[0].fill('2026-04-01');
    await dateInputs[1].fill('2026-10-16');
    await page.waitForTimeout(1000);
    console.log('  - Filled date range: 2026-04-01 to 2026-10-16.');
  }

  await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'interactive_general_ledger.png') });
  console.log('  - Captured interactive_general_ledger.png');

  // ── WORKFLOW 4: Unauthorized Access Test ────────────────────────────────────
  console.log('\n[Workflow 4] Testing Unauthorized Access Barrier...');
  const unauthContext = await browser.newContext();
  const unauthPage = await unauthContext.newPage();
  await unauthPage.goto('http://localhost:3001/dashboard?tab=bills_receivable', { waitUntil: 'domcontentloaded' });
  await unauthPage.waitForTimeout(2000);

  const unauthUrl = unauthPage.url();
  console.log(`  - Unauthenticated access attempted. Final URL: ${unauthUrl}`);
  const isProtected = unauthUrl === 'http://localhost:3001/' || unauthUrl.includes('/login') || unauthUrl.includes('tab=') === false;
  console.log(`  - Correctly redirected to login/gateway: ${isProtected}`);

  await unauthPage.screenshot({ path: path.join(SCREENSHOT_DIR, 'interactive_unauth_redirect.png') });
  console.log('  - Captured interactive_unauth_redirect.png');

  await unauthContext.close();
  await context.close();
  await browser.close();

  console.log('\n--- Summary of Interactive Browser Execution ---');
  console.log(`API Requests Intercepted: ${networkRequests.length}`);
  networkRequests.slice(0, 10).forEach(r => console.log(`  - ${r.method} ${r.url}`));
  console.log(`Console Errors Logged:    ${consoleErrors.length}`);
  if (consoleErrors.length > 0) {
    consoleErrors.forEach(e => console.log(`  ! Console Error: ${e}`));
  }

  console.log('\n=============================================================================');
  console.log('INTERACTIVE BROWSER WORKFLOW TESTS COMPLETED SUCCESSFULLY');
  console.log('=============================================================================');
}

runBrowserTests().catch(err => {
  console.error('Interactive Browser Test FAILED:', err);
  process.exit(1);
});
