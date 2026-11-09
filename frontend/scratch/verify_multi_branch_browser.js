/**
 * CakeToHome ERP — Multi-Branch Cash Operations UI & Workflow Browser Verification via Playwright
 */

const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');

const SCREENSHOTS_DIR = 'C:/Users/alexc/.gemini/antigravity-ide/brain/32bebf93-8421-489f-96dd-e2ae2ce852e7/screenshots';

if (!fs.existsSync(SCREENSHOTS_DIR)) {
  fs.mkdirSync(SCREENSHOTS_DIR, { recursive: true });
}

function signAuthToken(payload, secret = 'supersecret') {
  const header = { alg: 'HS256', typ: 'JWT' };
  const now = Math.floor(Date.now() / 1000);
  const fullPayload = {
    userId: payload.userId || 'mgr_indiranagar',
    role: payload.role || 'BRANCH_MANAGER',
    branchId: payload.branchId || 'br_indiranagar',
    permissions: [
      'TELLER.VIEW', 'TELLER.SESSION_OPEN', 'TELLER.SESSION_CLOSE', 'TELLER.MOVEMENT_CREATE',
      'EXPENSE.VIEW', 'EXPENSE.CREATE', 'EXPENSE.APPROVE', 'EXPENSE.EDIT',
      'ACCOUNTING.VIEW', 'ACCOUNTING.CREATE', 'ACCOUNTING.APPROVE', 'ACCOUNTING.POST', 'ACCOUNTING.MANAGE'
    ],
    iat: now,
    exp: now + 7 * 86400,
    ...payload,
  };
  const encHeader = Buffer.from(JSON.stringify(header)).toString('base64url');
  const encPayload = Buffer.from(JSON.stringify(fullPayload)).toString('base64url');
  const sig = crypto.createHmac('sha256', secret).update(`${encHeader}.${encPayload}`).digest('base64url');
  return `${encHeader}.${encPayload}.${sig}`;
}

async function runBrowserVerification() {
  console.log('==================================================================');
  console.log('  MULTI-BRANCH CASH OPERATIONS UI & WORKFLOW BROWSER VERIFICATION');
  console.log('==================================================================\n');

  let passed = 0;
  let failed = 0;

  function assert(cond, msg) {
    if (cond) {
      console.log(`  ✓ PASS: ${msg}`);
      passed++;
    } else {
      console.error(`  ✗ FAIL: ${msg}`);
      failed++;
    }
  }

  let browser = null;

  try {
    console.log('[Browser] Launching Chromium browser...');
    browser = await chromium.launch({ headless: true });
    const context = await browser.newContext({ viewport: { width: 1440, height: 950 } });

    const jwt = signAuthToken({
      userId: 'mgr_indiranagar',
      role: 'BRANCH_MANAGER',
      branchId: 'br_indiranagar'
    });

    await context.addCookies([
      { name: '_cth_jwt', value: jwt, domain: 'localhost', path: '/' },
      { name: '_cth_role', value: 'BRANCH_MANAGER', domain: 'localhost', path: '/' },
      { name: '_cth_user_id', value: 'mgr_indiranagar', domain: 'localhost', path: '/' },
      { name: '_cth_branch_id', value: 'br_indiranagar', domain: 'localhost', path: '/' },
    ]);

    const page = await context.newPage();
    page.on('console', msg => {
      const text = msg.text();
      if (!text.includes('Download the React DevTools') && !text.includes('Fast Refresh')) {
        console.log(`[Browser Console] ${msg.type()}: ${text}`);
      }
    });
    page.on('pageerror', err => console.log(`[Browser PageError] ${err.message}`));

    const appUrl = 'http://localhost:3001/dashboard?tab=teller_custody';
    console.log(`[Browser] Navigating to ${appUrl}...`);
    await page.goto(appUrl, { waitUntil: 'domcontentloaded', timeout: 120000 });
    
    console.log('[Browser] Waiting for Active Drawer and components to hydrate...');
    await page.waitForSelector('button:has-text("Delivery Boy Collections")', { timeout: 60000 });
    await page.waitForTimeout(2000);

    // ── 1. Verify Active Drawer & Action Buttons ──
    console.log('\n[Flow 1] Verifying Active Drawer View and Action Buttons...');
    const pageContent = await page.content();
    assert(pageContent.includes('Active Drawer') || pageContent.includes('Teller & Cash Custody'), 'Active Drawer / Teller tab rendered');
    assert(pageContent.includes('Delivery Boy Collections'), '"Delivery Boy Collections" action button rendered');
    assert(pageContent.includes('Branch Cash Expenses'), '"Branch Cash Expenses" action button rendered');

    const screenshot1Path = path.join(SCREENSHOTS_DIR, '01_active_drawer_with_actions.png');
    await page.screenshot({ path: screenshot1Path, fullPage: true });
    console.log(`[Screenshot Saved] -> ${screenshot1Path}`);

    // ── 2. Test Delivery Boy Collections Modal ──
    console.log('\n[Flow 2] Opening Delivery Boy Collections Modal...');
    const deliveryBtn = await page.waitForSelector('button:has-text("Delivery Boy Collections")', { timeout: 10000 });
    await deliveryBtn.click();
    await page.waitForTimeout(2000);

    const modalContent = await page.content();
    assert(modalContent.includes('Delivery Boy Cash Collections & Handovers'), 'Handover Modal title rendered');
    assert(modalContent.includes('Pending Manager Count'), '"Pending Manager Count" tab rendered');
    assert(modalContent.includes('New Handover Declaration'), '"New Handover Declaration" tab rendered');
    assert(modalContent.includes('Acknowledged History'), '"Acknowledged History" tab rendered');

    const screenshot2Path = path.join(SCREENSHOTS_DIR, '02_delivery_handover_modal.png');
    await page.screenshot({ path: screenshot2Path, fullPage: false });
    console.log(`[Screenshot Saved] -> ${screenshot2Path}`);

    // Close modal
    const closeBtn = await page.waitForSelector('button[aria-label="Close modal"]', { timeout: 5000 });
    await closeBtn.click();
    await page.waitForTimeout(1000);

    // ── 3. Test Branch Cash Expenses Modal ──
    console.log('\n[Flow 3] Opening Branch Cash Expenses Modal...');
    const expenseBtn = await page.waitForSelector('button:has-text("Branch Cash Expenses")', { timeout: 10000 });
    await expenseBtn.click();
    await page.waitForTimeout(2000);

    const expenseModalContent = await page.content();
    assert(expenseModalContent.includes('Branch Cash Expenses & Bill Approvals'), 'Expense Modal title rendered');
    assert(expenseModalContent.includes('Approved Awaiting Payment'), '"Approved Awaiting Payment" tab rendered');
    assert(expenseModalContent.includes('Review & Approvals'), '"Review & Approvals" tab rendered');
    assert(expenseModalContent.includes('New Expense Request'), '"New Expense Request" tab rendered');

    const screenshot3Path = path.join(SCREENSHOTS_DIR, '03_drawer_expense_modal.png');
    await page.screenshot({ path: screenshot3Path, fullPage: false });
    console.log(`[Screenshot Saved] -> ${screenshot3Path}`);

    // Close expense modal
    const closeExpBtn = await page.waitForSelector('button[aria-label="Close modal"]', { timeout: 5000 });
    await closeExpBtn.click();
    await page.waitForTimeout(1000);

    console.log('\n==================================================================');
    console.log(`BROWSER VERIFICATION: TOTAL: ${passed + failed} | PASSED: ${passed} | FAILED: ${failed}`);
    console.log('==================================================================\n');

  } catch (err) {
    console.error('Browser verification failed with exception:', err);
  } finally {
    if (browser) await browser.close();
  }
}

runBrowserVerification();
