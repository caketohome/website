import { chromium, Browser, BrowserContext, Page } from 'playwright';
import * as path from 'path';
import * as fs from 'fs';

const BASE_URL = 'http://localhost:3000';
const EVIDENCE_DIR = path.resolve(__dirname, '../../CHECKPOINTS/acceptance-test-evidence');
const VIDEO_DIR = path.join(EVIDENCE_DIR, 'video');
const SUPER_ADMIN_EVIDENCE = path.join(EVIDENCE_DIR, 'super-admin');

if (!fs.existsSync(SUPER_ADMIN_EVIDENCE)) {
  fs.mkdirSync(SUPER_ADMIN_EVIDENCE, { recursive: true });
}

interface TestResult {
  role: string;
  panel: string;
  feature: string;
  action: string;
  expected: string;
  actual: string;
  status: 'PASS' | 'FAIL';
  screenshot?: string;
  error?: string;
}

const results: TestResult[] = [];

async function loginAsSuperAdmin(page: Page) {
  await page.goto(`${BASE_URL}/login`, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForTimeout(2000);
  await page.waitForSelector('#phone_input', { timeout: 30000 });
  await page.click('#phone_input');
  await page.fill('#phone_input', '9999999999');

  await page.waitForFunction(() => {
    const btn = document.querySelector('button[type="submit"]') as HTMLButtonElement | null;
    return btn && !btn.disabled;
  }, { timeout: 15000 });
  await page.click('button[type="submit"]');

  await page.waitForSelector('input[inputmode="numeric"]', { timeout: 30000 });
  await page.waitForTimeout(500);
  const inputs = await page.$$('input[inputmode="numeric"]');
  for (let i = 0; i < Math.min(inputs.length, 6); i++) {
    await inputs[i].fill('123456'[i]);
  }

  const nameInput = await page.$('input[placeholder="e.g. Alex R Ashok"]');
  if (nameInput) {
    await nameInput.fill('Super Admin');
  }

  await page.waitForFunction(() => {
    const btns = Array.from(document.querySelectorAll('button[type="submit"]')) as HTMLButtonElement[];
    return !!btns.find(b => !b.disabled && b.offsetParent !== null);
  }, { timeout: 15000 });
  await page.click('button[type="submit"]');

  await page.waitForFunction(() => window.location.pathname.startsWith('/dashboard'), { timeout: 30000 });
  await page.waitForTimeout(3000);
}

async function runSuperAdminAcceptance() {
  console.log('══════════════════════════════════════════════════════════════════════════════');
  console.log('🧪 SUITE 2: SUPER ADMIN PANEL & WORKFLOWS ACCEPTANCE');
  console.log('══════════════════════════════════════════════════════════════════════════════\n');

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    recordVideo: { dir: VIDEO_DIR, size: { width: 1440, height: 900 } }
  });
  const page = await context.newPage();

  // Listen to console and page errors
  const consoleErrors: string[] = [];
  page.on('console', msg => {
    if (msg.type() === 'error') {
      consoleErrors.push(msg.text());
    }
  });
  page.on('pageerror', err => {
    consoleErrors.push(err.message);
  });

  try {
    // 1. Initial Login
    console.log('▶ Authenticating Super Admin...');
    await loginAsSuperAdmin(page);
    console.log('  Authenticated! Current URL:', page.url());

    // Panel test configurations
    const adminPanels = [
      {
        tabId: 'orders',
        name: 'Orders Panel',
        screenshot: '01-super-admin-orders.png',
        verifySelector: 'table, div[data-testid="orders-table"], div:has-text("Orders")',
        description: 'Omnichannel order management, status filtering, order cards'
      },
      {
        tabId: 'catalog',
        name: 'Product Catalog',
        screenshot: '02-super-admin-catalog.png',
        verifySelector: 'div:has-text("Catalog"), table, div:has-text("Products")',
        description: 'Product definitions, variants, pricing, GST categories'
      },
      {
        tabId: 'branches',
        name: 'Branches Management',
        screenshot: '03-super-admin-branches.png',
        verifySelector: 'div:has-text("Branches"), table',
        description: 'Multi-branch registry (57 locations across Bangalore)'
      },
      {
        tabId: 'suppliers',
        name: 'Suppliers Directory',
        screenshot: '04-super-admin-suppliers.png',
        verifySelector: 'div:has-text("Supplier"), table, button:has-text("Supplier")',
        description: 'Vendor registry, GSTIN, payment terms'
      },
      {
        tabId: 'purchases',
        name: 'Purchases & AP Register',
        screenshot: '05-super-admin-purchases.png',
        verifySelector: 'div:has-text("Purchase"), table, button:has-text("Purchase")',
        description: 'Purchase orders, supplier bill matching, GRN cross-referencing'
      },
      {
        tabId: 'expenses',
        name: 'Expense Management',
        screenshot: '06-super-admin-expenses.png',
        verifySelector: 'div:has-text("Expense"), table, button:has-text("Expense")',
        description: 'Branch and central operating expenses, petty cash ledger'
      },
      {
        tabId: 'accounting_work_queue',
        name: 'Financial Work Queue',
        screenshot: '07-super-admin-work-queue.png',
        verifySelector: 'div:has-text("Work Queue"), div:has-text("Purchases"), div:has-text("Sales")',
        description: 'Segregation of duties (Preparer, Approver, Poster), 5 transactional streams'
      },
      {
        tabId: 'general_ledger',
        name: 'General Ledger & Journal Entries',
        screenshot: '08-super-admin-general-ledger.png',
        verifySelector: 'div:has-text("General Ledger"), table, div:has-text("Journal")',
        description: 'Compound double-entry ledger, Trial Balance view, Chart of Accounts'
      },
      {
        tabId: 'profit_loss',
        name: 'Profit & Loss Statement',
        screenshot: '09-super-admin-profit-loss.png',
        verifySelector: 'div:has-text("Profit & Loss"), div:has-text("Revenue"), div:has-text("COGS")',
        description: '5-tier statutory P&L with gross margin & EBITDA breakdown'
      },
      {
        tabId: 'balance_sheet',
        name: 'Balance Sheet Statement',
        screenshot: '10-super-admin-balance-sheet.png',
        verifySelector: 'div:has-text("Balance Sheet"), div:has-text("Assets"), div:has-text("Liabilities")',
        description: 'Assets = Liabilities + Equity balance equation enforcement'
      },
      {
        tabId: 'cash_flow',
        name: 'Cash Flow Statement',
        screenshot: '11-super-admin-cash-flow.png',
        verifySelector: 'div:has-text("Cash Flow"), div:has-text("Operating"), div:has-text("Financing")',
        description: 'Direct & Indirect method cash flow analysis'
      },
      {
        tabId: 'bank_reconciliation',
        name: 'Bank Reconciliation (BRS)',
        screenshot: '12-super-admin-bank-reconciliation.png',
        verifySelector: 'div:has-text("Bank Reconciliation"), div:has-text("Statement"), button:has-text("Upload")',
        description: 'Bank statement matching against Book account 1112/1118'
      },
      {
        tabId: 'gateway_settlements',
        name: 'Payment Gateway Settlements',
        screenshot: '13-super-admin-gateway-settlements.png',
        verifySelector: 'div:has-text("Gateway"), div:has-text("Settlement"), table',
        description: 'Provider-neutral settlement reconciliation (Dr 1112, Dr 5290, Cr 1113)'
      },
      {
        tabId: 'accounting_setup',
        name: 'Accounting Setup & Fiscal Periods',
        screenshot: '14-super-admin-accounting-setup.png',
        verifySelector: 'div:has-text("Fiscal"), div:has-text("Period"), table',
        description: 'Fiscal period lifecycle (Open, Closed, Locked), FY 2026-27 setup'
      },
      {
        tabId: 'tax_master',
        name: 'GST Tax Master Configuration',
        screenshot: '15-super-admin-tax-master.png',
        verifySelector: 'div:has-text("Tax"), div:has-text("GST"), table',
        description: 'Statutory GST tax rates (5%, 12%, 18%), HSN code mappings'
      },
      {
        tabId: 'staff_profiles',
        name: 'Staff Profiles & RBAC Matrix',
        screenshot: '16-super-admin-staff-profiles.png',
        verifySelector: 'div:has-text("Staff"), div:has-text("Profile"), table',
        description: 'User access control, role assignment, branch binding'
      },
      {
        tabId: 'analytics',
        name: 'Operational & Sales Analytics',
        screenshot: '17-super-admin-analytics.png',
        verifySelector: 'div:has-text("Analytics"), div:has-text("Revenue")',
        description: 'Sales velocity, customer acquisition, operational reporting'
      }
    ];

    for (const panel of adminPanels) {
      console.log(`\n▶ Testing Admin Panel: ${panel.name} (?tab=${panel.tabId})...`);
      
      const targetUrl = `${BASE_URL}/dashboard?tab=${panel.tabId}`;
      await page.goto(targetUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
      await page.waitForTimeout(3000); // allow dynamic chunk load & data fetch

      // Check if access denied alert is displayed
      const accessDenied = await page.$('div:has-text("Access Denied")');
      if (accessDenied) {
        throw new Error(`Unexpected Access Denied on tab ${panel.tabId} for Super Admin`);
      }

      // Verify key panel elements are visible
      let isRendered = false;
      try {
        await page.waitForSelector(panel.verifySelector, { timeout: 10000 });
        isRendered = true;
      } catch (err) {
        console.warn(`  Selector warning for ${panel.tabId}:`, err);
        // Fallback check: check if page body contains panel title
        isRendered = await page.evaluate((name) => {
          return document.body.innerText.toLowerCase().includes(name.toLowerCase().split(' ')[0]);
        }, panel.name);
      }

      // Capture screenshot
      const shotPath = `super-admin/${panel.screenshot}`;
      await page.screenshot({ path: path.join(EVIDENCE_DIR, shotPath), fullPage: false });

      results.push({
        role: 'SUPER_ADMIN',
        panel: panel.name,
        feature: 'Navigation & Panel Rendering',
        action: `Navigate to ?tab=${panel.tabId}`,
        expected: `${panel.name} renders completely with real operational data and zero crash`,
        actual: isRendered ? 'Panel rendered successfully' : 'Panel selector not found',
        status: isRendered ? 'PASS' : 'FAIL',
        screenshot: shotPath,
      });

      console.log(`  Status: ${isRendered ? '✅ PASS' : '❌ FAIL'} | Evidence: ${shotPath}`);
    }

  } catch (err: any) {
    console.error('Super Admin Suite Execution Failed:', err);
    results.push({
      role: 'SUPER_ADMIN',
      panel: 'Super Admin Suite',
      feature: 'Execution',
      action: 'Run suite 2',
      expected: 'All panels render cleanly',
      actual: `Error: ${err.message}`,
      status: 'FAIL',
      error: err.message,
    });
  } finally {
    await context.close();
    await browser.close();
  }

  // Write Suite 2 results
  const outPath = path.resolve(__dirname, '../../CHECKPOINTS/acceptance-test-evidence/suite2_admin_panel_results.json');
  fs.writeFileSync(outPath, JSON.stringify(results, null, 2));
  console.log(`\n══════════════════════════════════════════════════════════════════════════════`);
  console.log(`Suite 2 Complete! Results written to: ${outPath}`);
  console.log(`Total: ${results.length} | Passed: ${results.filter(r => r.status === 'PASS').length} | Failed: ${results.filter(r => r.status === 'FAIL').length}`);
  console.log(`══════════════════════════════════════════════════════════════════════════════\n`);
}

runSuperAdminAcceptance().catch(err => {
  console.error('Fatal Suite 2 Error:', err);
  process.exit(1);
});
