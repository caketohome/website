/**
 * Capture interaction modals:
 * 1. Delivery Handover Count & Confirm dialog
 * 2. Expense Review & Approvals tab
 */

const { chromium } = require('playwright');
const path = require('path');
const crypto = require('crypto');

const SCREENSHOTS_DIR = 'C:/Users/alexc/.gemini/antigravity-ide/brain/32bebf93-8421-489f-96dd-e2ae2ce852e7/screenshots';

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

async function captureInteractions() {
  let browser = null;
  try {
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
    await page.goto('http://localhost:3001/dashboard?tab=teller_custody', { waitUntil: 'domcontentloaded', timeout: 120000 });
    await page.waitForSelector('button:has-text("Delivery Boy Collections")', { timeout: 60000 });
    await page.waitForTimeout(2000);

    // 1. Open Delivery Boy Collections and click "Count & Confirm"
    const deliveryBtn = await page.waitForSelector('button:has-text("Delivery Boy Collections")');
    await deliveryBtn.click();
    await page.waitForTimeout(2000);

    const countBtn = await page.waitForSelector('button:has-text("Count & Confirm")');
    await countBtn.click();
    await page.waitForTimeout(1000);

    const screenshot4Path = path.join(SCREENSHOTS_DIR, '04_handover_manager_count_dialog.png');
    await page.screenshot({ path: screenshot4Path });
    console.log(`Saved -> ${screenshot4Path}`);

    // Close modal
    const closeBtn = await page.waitForSelector('button[aria-label="Close modal"]');
    await closeBtn.click();
    await page.waitForTimeout(1000);

    // 2. Open Branch Expenses and click "Review & Approvals"
    const expenseBtn = await page.waitForSelector('button:has-text("Branch Cash Expenses")');
    await expenseBtn.click();
    await page.waitForTimeout(2000);

    const reviewTab = await page.waitForSelector('button:has-text("Review & Approvals")');
    await reviewTab.click();
    await page.waitForTimeout(1000);

    const screenshot5Path = path.join(SCREENSHOTS_DIR, '05_expense_review_and_approvals.png');
    await page.screenshot({ path: screenshot5Path });
    console.log(`Saved -> ${screenshot5Path}`);

  } catch (err) {
    console.error('Error:', err);
  } finally {
    if (browser) await browser.close();
  }
}

captureInteractions();
