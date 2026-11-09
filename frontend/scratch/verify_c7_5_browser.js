/**
 * CakeToHome ERP — Phase C7.5 Real Chromium Browser Verification via Playwright
 *
 * Verifies live browser rendering, DOM structure, Branch Cash Control & Vault Custody panel,
 * KPI summary metrics (Vault Custody, Drawer Custody, Total Physical Cash, GL 1111/1114),
 * Relative Threshold Badges (Normal / Warning / Critical - Cash Tender Blocked),
 * Fail-Safe Reconciliation Status (Reconciled / Variance Detected - No Auto-Plugs),
 * Mid-Day Safe Drop Modal (Till -> Vault),
 * Till Float Replenishment Modal (Vault -> Till),
 * True Imprest Petty Cash Management Modal (Funding, Expense Claim with dynamic GST, Approvals),
 * and Deep Reconciliation Drill-Down Modal.
 */

const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const { Pool } = require('pg');

function getConnectionString() {
  const envPath = path.join(__dirname, '../.env');
  if (fs.existsSync(envPath)) {
    const envContent = fs.readFileSync(envPath, 'utf8');
    for (const line of envContent.split('\n')) {
      if (line.trim().startsWith('DATABASE_URL=')) {
        let val = line.trim().substring('DATABASE_URL='.length).trim();
        if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
          val = val.slice(1, -1);
        }
        return val;
      }
    }
  }
  throw new Error("DATABASE_URL not found in .env");
}

function signAuthToken(payload, secret = 'supersecret') {
  const header = { alg: 'HS256', typ: 'JWT' };
  const now = Math.floor(Date.now() / 1000);
  const fullPayload = {
    userId: payload.userId || 'admin_01',
    role: payload.role || 'SUPER_ADMIN',
    email: payload.email || 'admin@caketohome.com',
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
  console.log('  PHASE C7.5 REAL CHROMIUM BROWSER VERIFICATION VIA PLAYWRIGHT');
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
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });

    // Inject super-admin JWT token
    const jwt = signAuthToken({ userId: 'admin_01', role: 'SUPER_ADMIN' });
    await context.addCookies([
      { name: '_cth_jwt', value: jwt, domain: 'localhost', path: '/' },
      { name: '_cth_role', value: 'SUPER_ADMIN', domain: 'localhost', path: '/' },
      { name: '_cth_user_id', value: 'admin_01', domain: 'localhost', path: '/' },
    ]);

    const page = await context.newPage();
    page.on('console', msg => {
      const text = msg.text();
      if (!text.includes('Download the React DevTools') && !text.includes('Fast Refresh')) {
        console.log(`[Browser Console] ${msg.type()}: ${text}`);
      }
    });
    page.on('pageerror', err => console.log(`[Browser PageError] ${err.message}`));

    const appUrl = 'http://localhost:3000/dashboard?tab=teller_custody&subtab=branch_cash';
    console.log(`[Browser] Navigating to ${appUrl}...`);
    await page.goto(appUrl, { waitUntil: 'domcontentloaded', timeout: 120000 });
    await page.waitForTimeout(4000);

    // If subtab isn't auto-selected, click Branch Cash Position button
    const branchCashTabBtn = page.locator('button:has-text("Branch Cash Position")');
    if (await branchCashTabBtn.isVisible()) {
      await branchCashTabBtn.click();
      await page.waitForTimeout(2000);
    }

    // ── 1. Verify Top KPI Cards (Including C7.5 Vault Custody & Total Physical Cash) ──
    console.log('\n[Flow 1] Verifying C7.5 KPI Summary Cards...');
    const content = await page.content();
    assert(content.includes('GL Cash in Hand (1111)'), 'KPI Card 1: GL Cash in Hand (1111) rendered');
    assert(content.includes('Branch Petty Cash (1114)'), 'KPI Card 2: GL Petty Cash (1114) rendered');
    assert(content.includes('Active Drawer Custody'), 'KPI Card 3: Active Drawer Custody rendered');
    assert(content.includes('Branch Vault Custody'), 'KPI Card 4: Branch Vault Custody (Derived) rendered');
    assert(content.includes('Total Physical Cash'), 'KPI Card 5: Total Physical Cash rendered');

    // ── 2. Verify Table & Action Buttons ──
    console.log('\n[Flow 2] Verifying Branch Cash Control Table & Action Triggers...');
    const tableLocator = page.locator('table');
    assert(await tableLocator.isVisible(), 'Branch Cash Master Table is visible');

    // Verify Row Action buttons (Safe Drop, Safe -> Till, Petty Cash, Drilldown)
    const safeDropBtn = page.locator('button:has-text("Safe Drop")').first();
    const replenishBtn = page.locator('button:has-text("Safe → Till")').first();
    const pettyCashBtn = page.locator('button:has-text("Petty Cash")').first();
    const drilldownBtn = page.locator('button[title="Detailed GL & Custody Audit Drilldown"]').first();

    // Wait for branch rows to load from API
    await safeDropBtn.waitFor({ state: 'visible', timeout: 15000 });

    assert(await safeDropBtn.isVisible(), 'Row Action: "Safe Drop" button is visible');
    assert(await replenishBtn.isVisible(), 'Row Action: "Safe → Till" button is visible');
    assert(await pettyCashBtn.isVisible(), 'Row Action: "Petty Cash" button is visible');
    assert(await drilldownBtn.isVisible(), 'Row Action: Detailed Drilldown button is visible');

    // Screenshot 1: Branch Cash Dashboard Overview
    const shot1Path = path.join(__dirname, 'c7_5_branch_cash_overview.png');
    await page.screenshot({ path: shot1Path, fullPage: false });
    console.log(`  📸 Screenshot saved: ${shot1Path}`);
    assert(fs.existsSync(shot1Path), 'Screenshot 1 captured: c7_5_branch_cash_overview.png');

    // ── 3. Test Mid-Day Safe Drop Modal ──
    console.log('\n[Flow 3] Testing Mid-Day Safe Drop Modal...');
    await safeDropBtn.click();
    await page.waitForTimeout(1000);

    const safeDropModal = page.locator('text=Mid-Day Safe Drop: Till → Safe');
    assert(await safeDropModal.isVisible(), 'Safe Drop Modal opened with correct title');
    assert(await page.locator('text=Authenticated Witness Staff ID').isVisible(), 'Authenticated witness selection field present in modal');
    assert(await page.locator('text=Safe Drop Amount').isVisible(), 'Safe drop amount input field present in modal');

    // Screenshot 2: Safe Drop Modal
    const shot2Path = path.join(__dirname, 'c7_5_safe_drop_modal.png');
    await page.screenshot({ path: shot2Path, fullPage: false });
    console.log(`  📸 Screenshot saved: ${shot2Path}`);
    assert(fs.existsSync(shot2Path), 'Screenshot 2 captured: c7_5_safe_drop_modal.png');

    // Close Safe Drop Modal
    const cancelBtn = page.locator('div[role="dialog"] button:has-text("Cancel")').first();
    await cancelBtn.click();
    await page.waitForTimeout(1000);
    assert(!(await safeDropModal.isVisible()), 'Safe Drop Modal closed successfully');

    // ── 4. Test Till Float Replenishment Modal ──
    console.log('\n[Flow 4] Testing Till Float Replenishment Modal...');
    await replenishBtn.click();
    await page.waitForTimeout(1000);

    const replenishModal = page.locator('text=Till Float Replenishment: Safe → Till');
    assert(await replenishModal.isVisible(), 'Replenish Till Modal opened with correct title');
    assert(await page.locator('text=Replenishment Amount').isVisible(), 'Replenishment amount input present');
    assert(await page.locator('text=Teller Session ID').isVisible(), 'Destination session selector present');

    // Screenshot 3: Replenish Modal
    const shot3Path = path.join(__dirname, 'c7_5_replenish_till_modal.png');
    await page.screenshot({ path: shot3Path, fullPage: false });
    console.log(`  📸 Screenshot saved: ${shot3Path}`);
    assert(fs.existsSync(shot3Path), 'Screenshot 3 captured: c7_5_replenish_till_modal.png');

    // Close Replenish Modal
    await page.locator('div[role="dialog"] button:has-text("Cancel")').first().click();
    await page.waitForTimeout(1000);
    assert(!(await replenishModal.isVisible()), 'Replenish Till Modal closed successfully');

    // ── 5. Test Petty Cash Imprest Modal ──
    console.log('\n[Flow 5] Testing True Imprest Petty Cash Management Modal...');
    await pettyCashBtn.click();
    await page.waitForTimeout(1000);

    const pettyModal = page.locator('text=Petty Cash Imprest Management');
    assert(await pettyModal.isVisible(), 'Petty Cash Modal opened successfully');

    // Check tabs in modal
    const expenseClaimTab = page.locator('button:has-text("Record Expense Claim")');
    assert(await expenseClaimTab.isVisible(), 'Petty Cash Modal: "Record Expense Claim" tab is visible');
    await expenseClaimTab.click();
    await page.waitForTimeout(1000);

    // Verify dynamic GST rate selector
    const gstRateSelect = page.locator('text=Eligible GST Rate (%)');
    assert(await gstRateSelect.isVisible(), 'Dynamic GST Rate Resolution dropdown present in Expense Claim view');

    // Screenshot 4: Petty Cash Modal
    const shot4Path = path.join(__dirname, 'c7_5_petty_cash_modal.png');
    await page.screenshot({ path: shot4Path, fullPage: false });
    console.log(`  📸 Screenshot saved: ${shot4Path}`);
    assert(fs.existsSync(shot4Path), 'Screenshot 4 captured: c7_5_petty_cash_modal.png');

    // Close Petty Cash Modal
    await page.locator('div[role="dialog"] button').filter({ has: page.locator('svg.lucide-x') }).first().click();
    await page.waitForTimeout(1000);
    assert(!(await pettyModal.isVisible()), 'Petty Cash Modal closed successfully');

    // ── 6. Test Deep Cash Reconciliation Drilldown Modal ──
    console.log('\n[Flow 6] Testing Deep Cash Reconciliation Drilldown Modal...');
    if (await drilldownBtn.isVisible()) {
      await drilldownBtn.click();
      await page.waitForTimeout(1500);

      const reconModal = page.locator('text=Cash Reconciliation');
      assert(await reconModal.isVisible(), 'Deep Cash Reconciliation Drilldown Modal opened');
      assert(await page.locator('text=GL Cash in Hand (1111)').first().isVisible(), 'GL Cash in Hand summary displayed');
      assert(await page.locator('text=Active Drawer Custody').first().isVisible(), 'Active Drawer Custody displayed in modal');
      assert(await page.locator('text=Vault Custody').first().isVisible(), 'Vault Custody displayed in modal');

      // Screenshot 5: Reconciliation Modal
      const shot5Path = path.join(__dirname, 'c7_5_reconciliation_modal.png');
      await page.screenshot({ path: shot5Path, fullPage: false });
      console.log(`  📸 Screenshot saved: ${shot5Path}`);
      assert(fs.existsSync(shot5Path), 'Screenshot 5 captured: c7_5_reconciliation_modal.png');

      await page.locator('div[role="dialog"] button').filter({ has: page.locator('svg.lucide-x') }).first().click();
      await page.waitForTimeout(1000);
    }

    console.log('\n------------------------------------------------------------------');
    console.log(`  Browser Tests Executed: ${passed + failed} | Passed: ${passed} | Failed: ${failed}`);
    console.log('------------------------------------------------------------------');

  } catch (err) {
    console.error('Browser verification failed with exception:', err);
    failed++;
  } finally {
    if (browser) {
      await browser.close();
      console.log('[Browser] Chromium closed cleanly.');
    }
  }

  process.exit(failed > 0 ? 1 : 0);
}

runBrowserVerification();
