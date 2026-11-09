const fs = require('fs');
const path = require('path');
const { chromium } = require('../frontend/node_modules/playwright');

const SCREENSHOT_DIR = 'C:/Users/alexc/.gemini/antigravity-ide/brain/cb7b6e1f-0b22-4701-9b04-b4142f6ebf68/browser_screenshots';
if (!fs.existsSync(SCREENSHOT_DIR)) {
  fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
}

const MODULES = [
  { id: 'accounting_work_queue', name: 'Financial Work Queue', expectedText: 'Central Accounting Work Queue' },
  { id: 'bills_payable', name: 'Bills Payable (AP)', expectedText: 'Bills Payable' },
  { id: 'bills_receivable', name: 'Bills Receivable (AR)', expectedText: 'Bills Receivable' },
  { id: 'teller_custody', name: 'Teller Cash Custody', expectedText: 'Teller' },
  { id: 'manual_journals', name: 'Manual Journals', expectedText: 'Manual Journal' },
  { id: 'cost_allocations', name: 'Cost Allocations', expectedText: 'Cost Allocation' },
  { id: 'gateway_settlements', name: 'Gateway Settlements', expectedText: 'Gateway Settlement' },
  { id: 'bank_accounts', name: 'Bank Accounts', expectedText: 'Bank Account' },
  { id: 'bank_reconciliation', name: 'Bank Reconciliation (BRS)', expectedText: 'Bank Reconciliation' },
  { id: 'general_ledger', name: 'General Ledger', expectedText: 'General Ledger' },
  { id: 'profit_loss', name: 'Profit & Loss', expectedText: 'Profit' },
  { id: 'balance_sheet', name: 'Balance Sheet', expectedText: 'Balance Sheet' },
  { id: 'cash_flow', name: 'Cash Flow', expectedText: 'Cash Flow' },
  { id: 'accounting_setup', name: 'Accounting Setup', expectedText: 'Accounting Setup' }
];

async function run() {
  console.log('=== RUNNING COMPLETE BROWSER VERIFICATION SUITE ===\n');
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 }
  });

  await context.addCookies([
    { name: '_cth_role', value: 'SUPER_ADMIN', domain: 'localhost', path: '/' },
    { name: '_cth_user_id', value: 'admin_01', domain: 'localhost', path: '/' },
  ]);

  const page = await context.newPage();
  const pageErrors = [];
  page.on('pageerror', err => {
    console.error(`[PAGE ERROR]: ${err.message}`);
    pageErrors.push(err.message);
  });

  const results = [];

  for (const m of MODULES) {
    const url = `http://localhost:3001/dashboard?tab=${m.id}`;
    console.log(`Testing [${m.name}] -> ${url}`);
    const start = Date.now();

    try {
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
      // Allow dynamic imports and data fetching to settle
      await page.waitForTimeout(3000);

      const title = await page.title();
      const bodyText = await page.innerText('body');
      const containsExpected = bodyText.toLowerCase().includes(m.expectedText.toLowerCase());

      const screenshotPath = path.join(SCREENSHOT_DIR, `${m.id}.png`);
      await page.screenshot({ path: screenshotPath, fullPage: false });

      console.log(`  ✓ Rendered in ${Date.now() - start}ms | Contains "${m.expectedText}": ${containsExpected} | Screenshot saved.`);
      results.push({
        id: m.id,
        name: m.name,
        success: true,
        durationMs: Date.now() - start,
        containsExpected,
        screenshot: screenshotPath,
        textSnippet: bodyText.substring(0, 300).replace(/\n+/g, ' ')
      });
    } catch (err) {
      console.error(`  ❌ Failed to render ${m.name}: ${err.message}`);
      results.push({
        id: m.id,
        name: m.name,
        success: false,
        error: err.message
      });
    }
  }

  await browser.close();

  console.log('\n=== BROWSER SUITE RESULTS ===');
  const passed = results.filter(r => r.success && r.containsExpected);
  console.log(`Total Pages: ${MODULES.length} | Passed: ${passed.length} | Failed: ${MODULES.length - passed.length}`);
  console.log(`Unhandled page errors during session: ${pageErrors.length}`);

  fs.writeFileSync('scratch/browser_verification_results.json', JSON.stringify({ results, pageErrors }, null, 2));
}

run().catch(console.error);
