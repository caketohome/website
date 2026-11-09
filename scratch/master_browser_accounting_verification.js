const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { chromium } = require('../frontend/node_modules/playwright');

const SCREENSHOT_DIR = 'C:/Users/alexc/.gemini/antigravity-ide/brain/cb7b6e1f-0b22-4701-9b04-b4142f6ebf68/browser_screenshots';
if (!fs.existsSync(SCREENSHOT_DIR)) {
  fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
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
    email: 'admin@caketohome.com',
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

const MODULES = [
  { id: 'accounting_work_queue', name: 'Financial Work Queue', headingSelector: 'h1, h2, h3, [data-testid="header"]' },
  { id: 'bills_payable', name: 'Bills Payable (AP)', headingSelector: 'h1, h2, h3' },
  { id: 'bills_receivable', name: 'Bills Receivable (AR)', headingSelector: 'h1, h2, h3' },
  { id: 'teller_custody', name: 'Teller Cash Custody', headingSelector: 'h1, h2, h3' },
  { id: 'manual_journals', name: 'Manual Journals', headingSelector: 'h1, h2, h3' },
  { id: 'cost_allocations', name: 'Cost Allocations', headingSelector: 'h1, h2, h3' },
  { id: 'gateway_settlements', name: 'Gateway Settlements', headingSelector: 'h1, h2, h3' },
  { id: 'bank_accounts', name: 'Bank Accounts Master', headingSelector: 'h1, h2, h3' },
  { id: 'bank_reconciliation', name: 'Bank Reconciliation (BRS)', headingSelector: 'h1, h2, h3' },
  { id: 'general_ledger', name: 'General Ledger', headingSelector: 'h1, h2, h3' },
  { id: 'profit_loss', name: 'Profit & Loss Statement', headingSelector: 'h1, h2, h3' },
  { id: 'balance_sheet', name: 'Balance Sheet Statement', headingSelector: 'h1, h2, h3' },
  { id: 'cash_flow', name: 'Cash Flow Statement', headingSelector: 'h1, h2, h3' },
  { id: 'accounting_setup', name: 'Accounting Setup & Config', headingSelector: 'h1, h2, h3' },
];

async function run() {
  console.log('=== STARTING MASTER BROWSER VERIFICATION SUITE ===\n');
  const token = createSuperAdminToken();
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 }
  });

  await context.addCookies([
    { name: '_cth_role', value: 'SUPER_ADMIN', domain: 'localhost', path: '/' },
    { name: '_cth_user_id', value: 'admin_01', domain: 'localhost', path: '/' },
    { name: '_cth_jwt', value: token, domain: 'localhost', path: '/' },
    { name: '_medusa_jwt', value: token, domain: 'localhost', path: '/' },
  ]);

  const page = await context.newPage();
  const consoleErrors = [];
  page.on('console', msg => {
    if (msg.type() === 'error') {
      consoleErrors.push(`[${msg.type()}] ${msg.text()}`);
    }
  });

  const pageErrors = [];
  page.on('pageerror', err => {
    pageErrors.push(err.message);
  });

  const auditResults = [];

  for (const m of MODULES) {
    const url = `http://localhost:3001/dashboard?tab=${m.id}`;
    console.log(`\n-------------------------------------------------------------`);
    console.log(`Testing [${m.name}] -> ${url}`);
    const start = Date.now();

    try {
      const resp = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 45000 });
      // Wait 3.5s for React hydration, query hooks, and table rendering
      await page.waitForTimeout(3500);

      const currentUrl = page.url();
      const status = resp ? resp.status() : 0;

      // Extract interactive elements count
      const buttons = await page.locator('button').count();
      const inputs = await page.locator('input, select, textarea').count();
      const tables = await page.locator('table').count();

      // Extract headings
      const headings = await page.locator(m.headingSelector).allTextContents();
      const cleanHeadings = headings.map(h => h.trim().replace(/\s+/g, ' ')).filter(h => h.length > 2);

      // Extract full text summary
      const bodyText = await page.innerText('body');
      const textSample = bodyText.substring(0, 350).replace(/\n+/g, ' ');

      // Capture screenshot
      const screenshotFile = `${m.id}.png`;
      const screenshotPath = path.join(SCREENSHOT_DIR, screenshotFile);
      await page.screenshot({ path: screenshotPath, fullPage: false });

      console.log(`  ✓ Rendered in ${Date.now() - start}ms | HTTP ${status}`);
      console.log(`  ✓ Current URL: ${currentUrl}`);
      console.log(`  ✓ UI Elements: ${buttons} buttons, ${inputs} inputs, ${tables} tables`);
      console.log(`  ✓ Headings: ${cleanHeadings.slice(0, 4).join(' | ')}`);
      console.log(`  ✓ Screenshot: ${screenshotPath}`);

      auditResults.push({
        id: m.id,
        name: m.name,
        success: true,
        httpStatus: status,
        finalUrl: currentUrl,
        durationMs: Date.now() - start,
        uiElements: { buttons, inputs, tables },
        headings: cleanHeadings,
        screenshotFile,
        textSample
      });
    } catch (err) {
      console.error(`  ❌ ERROR rendering ${m.name}: ${err.message}`);
      auditResults.push({
        id: m.id,
        name: m.name,
        success: false,
        error: err.message
      });
    }
  }

  await browser.close();

  console.log('\n=============================================================');
  console.log('MASTER BROWSER VERIFICATION AUDIT COMPLETE');
  console.log(`Total Pages Tested: ${MODULES.length}`);
  const passCount = auditResults.filter(r => r.success).length;
  console.log(`Successful Page Loads: ${passCount} / ${MODULES.length}`);
  console.log(`Page Errors: ${pageErrors.length}`);
  console.log(`Console Errors: ${consoleErrors.length}`);

  fs.writeFileSync('scratch/master_browser_accounting_results.json', JSON.stringify({
    timestamp: new Date().toISOString(),
    auditResults,
    pageErrors,
    consoleErrors
  }, null, 2));

  console.log('Results written to scratch/master_browser_accounting_results.json');
}

run().catch(console.error);
