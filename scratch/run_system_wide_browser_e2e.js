const fs = require('fs');
const path = require('path');
const { chromium } = require('../frontend/node_modules/playwright');

const SCREENSHOT_DIR = 'C:/Users/alexc/.gemini/antigravity-ide/brain/31411221-4244-440e-aa25-9554dab9f914/browser_screenshots';
if (!fs.existsSync(SCREENSHOT_DIR)) {
  fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
}

const TEST_SCENARIOS = [
  // Super Admin / Finance Dashboard Tabs
  { role: 'SUPER_ADMIN', name: 'Admin Dashboard: Overview', url: 'http://localhost:3001/dashboard?tab=overview', selector: 'body', filename: 'admin_overview.png' },
  { role: 'SUPER_ADMIN', name: 'Admin: Bills Receivable (AR)', url: 'http://localhost:3001/dashboard?tab=bills_receivable', selector: 'body', filename: 'admin_bills_receivable.png' },
  { role: 'SUPER_ADMIN', name: 'Admin: Bills Payable (AP)', url: 'http://localhost:3001/dashboard?tab=bills_payable', selector: 'body', filename: 'admin_bills_payable.png' },
  { role: 'SUPER_ADMIN', name: 'Admin: Central Accounting Work Queue', url: 'http://localhost:3001/dashboard?tab=accounting_work_queue', selector: 'body', filename: 'admin_accounting_work_queue.png' },
  { role: 'SUPER_ADMIN', name: 'Admin: General Ledger', url: 'http://localhost:3001/dashboard?tab=general_ledger', selector: 'body', filename: 'admin_general_ledger.png' },
  { role: 'SUPER_ADMIN', name: 'Admin: Trial Balance', url: 'http://localhost:3001/dashboard?tab=trial_balance', selector: 'body', filename: 'admin_trial_balance.png' },
  { role: 'SUPER_ADMIN', name: 'Admin: Profit & Loss', url: 'http://localhost:3001/dashboard?tab=profit_loss', selector: 'body', filename: 'admin_profit_loss.png' },
  { role: 'SUPER_ADMIN', name: 'Admin: Balance Sheet', url: 'http://localhost:3001/dashboard?tab=balance_sheet', selector: 'body', filename: 'admin_balance_sheet.png' },
  { role: 'SUPER_ADMIN', name: 'Admin: Teller Cash Custody', url: 'http://localhost:3001/dashboard?tab=teller_custody', selector: 'body', filename: 'admin_teller_custody.png' },
  { role: 'SUPER_ADMIN', name: 'Admin: Tax Master', url: 'http://localhost:3001/dashboard?tab=tax_master', selector: 'body', filename: 'admin_tax_master.png' },
  { role: 'SUPER_ADMIN', name: 'Admin: Orders Management', url: 'http://localhost:3001/dashboard?tab=orders', selector: 'body', filename: 'admin_orders.png' },
  { role: 'SUPER_ADMIN', name: 'Admin: Catalog & PIM', url: 'http://localhost:3001/dashboard?tab=catalog', selector: 'body', filename: 'admin_catalog.png' },
  { role: 'SUPER_ADMIN', name: 'Admin: Branches & Outlets', url: 'http://localhost:3001/dashboard?tab=branches', selector: 'body', filename: 'admin_branches.png' },
  { role: 'SUPER_ADMIN', name: 'Admin: Delivery & Fleet', url: 'http://localhost:3001/dashboard?tab=delivery', selector: 'body', filename: 'admin_delivery.png' },
  { role: 'SUPER_ADMIN', name: 'Admin: Bank Accounts', url: 'http://localhost:3001/dashboard?tab=bank_accounts', selector: 'body', filename: 'admin_bank_accounts.png' },
  { role: 'SUPER_ADMIN', name: 'Admin: Bank Reconciliation (BRS)', url: 'http://localhost:3001/dashboard?tab=bank_reconciliation', selector: 'body', filename: 'admin_bank_reconciliation.png' },

  // Branch Manager Console
  { role: 'BRANCH_MANAGER', name: 'Branch Operations Console', url: 'http://localhost:3001/dashboard/shop', selector: 'body', filename: 'branch_manager_shop.png' },

  // Delivery Partner Console
  { role: 'DELIVERY_PARTNER', name: 'Delivery Partner Console', url: 'http://localhost:3001/dashboard/delivery-partner', selector: 'body', filename: 'delivery_partner_console.png' },

  // Customer Storefront
  { role: 'ANONYMOUS', name: 'Customer: Storefront Home (Desktop)', url: 'http://localhost:3001/', selector: 'body', filename: 'storefront_home_desktop.png', viewport: { width: 1440, height: 900 } },
  { role: 'ANONYMOUS', name: 'Customer: Storefront Home (Tablet)', url: 'http://localhost:3001/', selector: 'body', filename: 'storefront_home_tablet.png', viewport: { width: 768, height: 1024 } },
  { role: 'ANONYMOUS', name: 'Customer: Storefront Home (Mobile)', url: 'http://localhost:3001/', selector: 'body', filename: 'storefront_home_mobile.png', viewport: { width: 375, height: 667 } },
  { role: 'ANONYMOUS', name: 'Customer: Login & OTP Page', url: 'http://localhost:3001/login', selector: 'body', filename: 'customer_login.png' },
  { role: 'ANONYMOUS', name: 'Customer: Cart Page', url: 'http://localhost:3001/cart', selector: 'body', filename: 'customer_cart.png' }
];

async function runMasterAudit() {
  console.log('================================================================================');
  console.log('CAKETOHOME ERP — FULL SYSTEM-WIDE BROWSER E2E VERIFICATION & AUDIT');
  console.log('Target Base: http://localhost:3001');
  console.log('Screenshot Directory: ' + SCREENSHOT_DIR);
  console.log('================================================================================\n');

  const browser = await chromium.launch({ headless: true });
  const results = [];

  for (const t of TEST_SCENARIOS) {
    const defaultViewport = t.viewport || { width: 1440, height: 900 };
    const context = await browser.newContext({ viewport: defaultViewport });

    // Set role-appropriate cookies
    if (t.role === 'SUPER_ADMIN') {
      await context.addCookies([
        { name: '_cth_role', value: 'SUPER_ADMIN', domain: 'localhost', path: '/' },
        { name: '_cth_user_id', value: 'admin_01', domain: 'localhost', path: '/' },
        { name: '_cth_jwt', value: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.e30.mock', domain: 'localhost', path: '/' }
      ]);
    } else if (t.role === 'BRANCH_MANAGER') {
      await context.addCookies([
        { name: '_cth_role', value: 'shop', domain: 'localhost', path: '/' },
        { name: '_cth_jwt', value: 'mock_jwt_access_token', domain: 'localhost', path: '/' },
        { name: '_cth_user_id', value: 'shpmgr_indiranagar', domain: 'localhost', path: '/' }
      ]);
    } else if (t.role === 'DELIVERY_PARTNER') {
      await context.addCookies([
        { name: '_cth_role', value: 'delivery_partner', domain: 'localhost', path: '/' },
        { name: '_cth_jwt', value: 'mock_dp_token', domain: 'localhost', path: '/' },
        { name: '_cth_user_id', value: 'dp_01', domain: 'localhost', path: '/' }
      ]);
    }

    const page = await context.newPage();
    const pageErrors = [];
    const consoleLogs = [];

    page.on('pageerror', err => {
      pageErrors.push(err.message);
    });
    page.on('console', msg => {
      if (msg.type() === 'error') {
        consoleLogs.push(msg.text());
      }
    });

    console.log(`[Testing ${t.role}] ${t.name} -> ${t.url}`);
    const startTime = Date.now();
    let status = 'PASSED';
    let errorMessage = null;

    try {
      const response = await page.goto(t.url, { waitUntil: 'domcontentloaded', timeout: 35000 });
      const httpStatus = response ? response.status() : 0;
      await page.waitForTimeout(3000); // Allow dynamic React rendering

      const title = await page.title();
      const bodyLength = (await page.content()).length;
      const screenshotPath = path.join(SCREENSHOT_DIR, t.filename);
      await page.screenshot({ path: screenshotPath, fullPage: true });

      const passed = httpStatus === 200 && pageErrors.length === 0;
      status = passed ? 'VERIFIED' : (pageErrors.length > 0 ? 'PARTIALLY_VERIFIED' : 'FAILED');

      results.push({
        name: t.name,
        role: t.role,
        url: t.url,
        status,
        httpStatus,
        title,
        bodyLength,
        durationMs: Date.now() - startTime,
        pageErrors,
        consoleErrors: consoleLogs.slice(0, 3),
        screenshot: screenshotPath
      });

      console.log(`  ✓ Status: ${status} (HTTP ${httpStatus}) | Duration: ${Date.now() - startTime}ms | Errors: ${pageErrors.length}`);
    } catch (err) {
      console.error(`  ❌ Failed: ${err.message}`);
      results.push({
        name: t.name,
        role: t.role,
        url: t.url,
        status: 'FAILED',
        error: err.message,
        durationMs: Date.now() - startTime,
        pageErrors,
        consoleErrors: consoleLogs.slice(0, 3)
      });
    } finally {
      await context.close();
    }
  }

  await browser.close();

  fs.writeFileSync('scratch/system_wide_browser_e2e_results.json', JSON.stringify(results, null, 2));

  console.log('\n================================================================================');
  console.log(`AUDIT FINISHED: ${results.filter(r => r.status === 'VERIFIED').length} / ${results.length} Scenarios VERIFIED`);
  console.log('================================================================================');
}

runMasterAudit().catch(err => {
  console.error('Fatal audit error:', err);
  process.exit(1);
});
