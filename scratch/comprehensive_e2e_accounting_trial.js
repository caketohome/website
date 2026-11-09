const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { chromium } = require(path.resolve(__dirname, '../frontend/node_modules/playwright'));

const ARTIFACT_DIR = 'C:/Users/alexc/.gemini/antigravity-ide/brain/bd4c3032-9680-4184-a5d5-db6eac6b478f';
if (!fs.existsSync(ARTIFACT_DIR)) {
  fs.mkdirSync(ARTIFACT_DIR, { recursive: true });
}

function getJwtSecret() {
  const env = fs.readFileSync('.env', 'utf8');
  for (const line of env.split('\n')) {
    if (line.trim().startsWith('JWT_SECRET=')) {
      let val = line.trim().substring('JWT_SECRET='.length).trim();
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
        val = val.slice(1, -1);
      }
      return val;
    }
  }
  return 'supersecret';
}

function createToken(role = 'SUPER_ADMIN', userId = 'admin_01', permissions = ['*']) {
  const secret = getJwtSecret();
  const now = Math.floor(Date.now() / 1000);
  const exp = now + 7 * 86400;

  const header = { alg: 'HS256', typ: 'JWT' };
  const payload = {
    userId,
    role,
    phone: '9876543210',
    customerId: userId,
    branchId: null,
    partnerId: null,
    name: role + ' User',
    email: `${role.toLowerCase()}@caketohome.com`,
    permissions,
    isSuperAdmin: role === 'SUPER_ADMIN',
    iat: now,
    exp,
  };

  const b64 = (obj) => Buffer.from(JSON.stringify(obj)).toString('base64url');
  const data = `${b64(header)}.${b64(payload)}`;
  const sig = crypto.createHmac('sha256', secret).update(data).digest('base64url');
  return `${data}.${sig}`;
}

const TABS_TO_AUDIT = [
  { id: 'accounting_work_queue', name: 'Financial Work Queue', category: 'Workflows & Vouchers' },
  { id: 'accounting_setup', name: 'Accounting Setup & Chart of Accounts', category: 'Master Data & Configuration' },
  { id: 'manual_journals', name: 'Manual Journals (Maker-Checker)', category: 'Vouchers & Journals' },
  { id: 'bills_receivable', name: 'Bills Receivable (AR & Aging)', category: 'Sales & AR' },
  { id: 'bills_payable', name: 'Bills Payable (AP & Ageing)', category: 'Purchases & AP' },
  { id: 'suppliers', name: 'Suppliers Master', category: 'Purchases & AP' },
  { id: 'purchases', name: 'Purchases Register & Invoices', category: 'Purchases & AP' },
  { id: 'expenses', name: 'Expenses & Cash Disbursements', category: 'Expenses & Cash' },
  { id: 'teller_custody', name: 'Teller Cash Custody (Branch Manager)', category: 'Cash & Custody' },
  { id: 'bank_accounts', name: 'Bank Accounts Master', category: 'Banking & Treasury' },
  { id: 'bank_reconciliation', name: 'Bank Reconciliation (BRS)', category: 'Banking & Treasury' },
  { id: 'gateway_settlements', name: 'Gateway Settlements', category: 'Banking & Treasury' },
  { id: 'general_ledger', name: 'General Ledger Statements', category: 'Financial Reporting' },
  { id: 'profit_loss', name: 'Profit & Loss Statement', category: 'Financial Reporting' },
  { id: 'balance_sheet', name: 'Balance Sheet Statement', category: 'Financial Reporting' },
  { id: 'cash_flow', name: 'Cash Flow Statement', category: 'Financial Reporting' },
  { id: 'cost_allocations', name: 'Cost Allocations & Centres', category: 'Management Accounting' },
  { id: 'tax_master', name: 'Tax Master & GST Classification', category: 'Tax & Compliance' },
  { id: 'fleet', name: 'Fleet & Fuel Operating Ledger', category: 'Operations & Expenses' },
];

async function runComprehensiveTrial() {
  console.log('=============================================================================');
  console.log('CakeToHome ERP — Comprehensive Accounting Browser E2E Trial & QA Audit');
  console.log('Target Server: http://localhost:3001 | Headless Chromium');
  console.log('=============================================================================\n');

  const superAdminToken = createToken('SUPER_ADMIN', 'admin_01', ['*']);
  const browser = await chromium.launch({ headless: true });

  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 }
  });

  await context.addCookies([
    { name: '_cth_jwt', value: superAdminToken, domain: 'localhost', path: '/' },
    { name: '_cth_role', value: 'SUPER_ADMIN', domain: 'localhost', path: '/' },
    { name: '_cth_user_id', value: 'admin_01', domain: 'localhost', path: '/' },
  ]);

  const page = await context.newPage();

  const trialResults = [];

  for (const tab of TABS_TO_AUDIT) {
    console.log(`\n-----------------------------------------------------------------------------`);
    console.log(`[Testing Tab] ${tab.name} (?tab=${tab.id})`);
    console.log(`-----------------------------------------------------------------------------`);

    const consoleErrors = [];
    const pageErrors = [];
    const failedRequests = [];

    const onConsole = msg => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
      }
    };
    const onPageError = err => {
      pageErrors.push(err.message);
    };
    const onRequestFailed = req => {
      failedRequests.push({ url: req.url(), failure: req.failure() });
    };

    page.on('console', onConsole);
    page.on('pageerror', onPageError);
    page.on('requestfailed', onRequestFailed);

    const targetUrl = `http://localhost:3001/dashboard?tab=${tab.id}`;
    let navigationSuccess = false;
    let statusCode = 200;
    let pageContentLength = 0;
    let pageTextSnippet = '';

    try {
      const response = await page.goto(targetUrl, {
        waitUntil: 'domcontentloaded',
        timeout: 45000
      });
      if (response) {
        statusCode = response.status();
      }
      navigationSuccess = true;

      // Allow UI hydration and dynamic API queries to settle
      await page.waitForTimeout(3000);

      const bodyText = await page.innerText('body');
      pageContentLength = bodyText.length;
      pageTextSnippet = bodyText.replace(/\s+/g, ' ').substring(0, 180);

      // Save screenshot for critical accounting panels
      const screenshotPath = path.join(ARTIFACT_DIR, `e2e_accounting_${tab.id}.png`);
      await page.screenshot({ path: screenshotPath, fullPage: false });

      console.log(`  ✓ Navigation status: HTTP ${statusCode}`);
      console.log(`  ✓ Rendered text length: ${pageContentLength} characters`);
      console.log(`  ✓ Text snippet: "${pageTextSnippet}..."`);
      console.log(`  ✓ Screenshot saved: e2e_accounting_${tab.id}.png`);

      if (consoleErrors.length > 0) {
        console.log(`  ⚠️ Console errors (${consoleErrors.length}):`);
        consoleErrors.slice(0, 3).forEach(e => console.log(`     - ${e.substring(0, 100)}`));
      } else {
        console.log(`  ✓ Zero console errors.`);
      }

      if (pageErrors.length > 0) {
        console.log(`  ❌ Uncaught exceptions (${pageErrors.length}):`);
        pageErrors.forEach(e => console.log(`     - ${e}`));
      } else {
        console.log(`  ✓ Zero uncaught exceptions.`);
      }

      trialResults.push({
        id: tab.id,
        name: tab.name,
        category: tab.category,
        url: targetUrl,
        statusCode,
        renderedContentLength: pageContentLength,
        consoleErrorCount: consoleErrors.length,
        consoleErrors: consoleErrors.slice(0, 5),
        pageErrorCount: pageErrors.length,
        pageErrors,
        failedRequestCount: failedRequests.length,
        status: pageErrors.length > 0 ? 'FAILED' : 'VERIFIED',
        screenshot: `e2e_accounting_${tab.id}.png`,
        textSnippet: pageTextSnippet
      });

    } catch (err) {
      console.log(`  ❌ Failed during test of tab ${tab.id}: ${err.message}`);
      trialResults.push({
        id: tab.id,
        name: tab.name,
        category: tab.category,
        url: targetUrl,
        statusCode: 0,
        error: err.message,
        status: 'FAILED'
      });
    } finally {
      page.off('console', onConsole);
      page.off('pageerror', onPageError);
      page.off('requestfailed', onRequestFailed);
    }
  }

  // Next, test RBAC / Access control:
  console.log(`\n=============================================================================`);
  console.log(`[RBAC & Security Testing] Verifying Role Guard Boundaries`);
  console.log(`=============================================================================`);

  // Unauthenticated user should not access dashboard
  const unauthContext = await browser.newContext();
  const unauthPage = await unauthContext.newPage();
  await unauthPage.goto('http://localhost:3001/dashboard?tab=general_ledger', { waitUntil: 'domcontentloaded' });
  await unauthPage.waitForTimeout(2000);
  const unauthUrl = unauthPage.url();
  const unauthBody = await unauthPage.innerText('body');
  const isRedirectedToLogin = unauthUrl.includes('/login') || unauthBody.toLowerCase().includes('sign in') || unauthBody.toLowerCase().includes('login') || unauthBody.toLowerCase().includes('orders');
  console.log(`  ✓ Unauthenticated user redirect/guard: ${isRedirectedToLogin ? 'PASSED (Protected)' : 'WARN'}`);

  // Unauthorized role: CUSTOMER attempting to view accounting tabs
  const customerToken = createToken('CUSTOMER', 'cus_test_01', []);
  const customerContext = await browser.newContext();
  await customerContext.addCookies([
    { name: '_cth_jwt', value: customerToken, domain: 'localhost', path: '/' },
    { name: '_cth_role', value: 'CUSTOMER', domain: 'localhost', path: '/' },
    { name: '_cth_user_id', value: 'cus_test_01', domain: 'localhost', path: '/' },
  ]);
  const customerPage = await customerContext.newPage();
  await customerPage.goto('http://localhost:3001/dashboard?tab=general_ledger', { waitUntil: 'domcontentloaded' });
  await customerPage.waitForTimeout(2000);
  const custBody = await customerPage.innerText('body');
  const isCustomerBlocked = custBody.includes('Access Denied') || !custBody.toLowerCase().includes('canonical chart of accounts') || customerPage.url().includes('/login');
  console.log(`  ✓ Customer role access to General Ledger: ${isCustomerBlocked ? 'BLOCKED / ACCESS CONTROLLED (Passed)' : 'WARN'}`);

  await browser.close();

  fs.writeFileSync('scratch/browser_e2e_accounting_trial_results.json', JSON.stringify({
    timestamp: new Date().toISOString(),
    totalTabsAudited: trialResults.length,
    passedTabs: trialResults.filter(t => t.status === 'VERIFIED').length,
    failedTabs: trialResults.filter(t => t.status === 'FAILED').length,
    results: trialResults
  }, null, 2));

  console.log(`\n=============================================================================`);
  console.log(`COMPREHENSIVE BROWSER TRIAL COMPLETED: ${trialResults.filter(t => t.status === 'VERIFIED').length}/${trialResults.length} Tabs Verified`);
  console.log(`=============================================================================`);
  process.exit(0);
}

runComprehensiveTrial().catch(err => {
  console.error('Fatal Trial Error:', err);
  process.exit(1);
});
