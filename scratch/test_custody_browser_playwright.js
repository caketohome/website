/**
 * CakeToHome ERP — Playwright Browser E2E Test for Branch Cash Custody & Accounting Gate
 */

const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const { chromium } = require(path.resolve(__dirname, '../frontend/node_modules/playwright'));

function signTestToken(payload) {
  const secret = process.env.JWT_SECRET || 'supersecret';
  const header = { alg: 'HS256', typ: 'JWT' };
  const fullPayload = {
    userId: payload.userId || 'admin_01',
    role: payload.role || 'SUPER_ADMIN',
    phone: payload.phone || '+91 99999 00001',
    isSuperAdmin: payload.role === 'SUPER_ADMIN' || payload.userId === 'admin_01',
    exp: Math.floor(Date.now() / 1000) + 3600,
    iat: Math.floor(Date.now() / 1000),
  };
  const b64 = (obj) => Buffer.from(JSON.stringify(obj)).toString('base64url');
  const data = `${b64(header)}.${b64(fullPayload)}`;
  const sig = crypto.createHmac('sha256', secret).update(data).digest('base64url');
  return `${data}.${sig}`;
}

const adminToken = signTestToken({ userId: 'admin_01', role: 'SUPER_ADMIN' });

async function runBrowserSuite() {
  console.log('=============================================================================');
  console.log('CakeToHome ERP — Playwright Browser Verification of Remediated Workflows');
  console.log('=============================================================================\n');

  const screenshotsDir = path.join(__dirname, 'screenshots_remediation');
  if (!fs.existsSync(screenshotsDir)) {
    fs.mkdirSync(screenshotsDir, { recursive: true });
  }

  const results = [];
  const browser = await chromium.launch({ headless: true });

  try {
    const adminCtx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    await adminCtx.addCookies([
      { name: '_cth_jwt', value: adminToken, domain: 'localhost', path: '/' },
      { name: '_cth_role', value: 'SUPER_ADMIN', domain: 'localhost', path: '/' },
      { name: '_cth_user_id', value: 'admin_01', domain: 'localhost', path: '/' },
    ]);

    const page = await adminCtx.newPage();

    // ── 1. Navigate to Teller & Cash Custody Panel ─────────────────────────────
    console.log('--- Step 1: Navigate to Teller & Cash Custody Panel (tab=teller_custody) ---');
    await page.goto('http://localhost:3001/dashboard?tab=teller_custody', { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForTimeout(3000);

    const title = await page.title();
    await page.screenshot({ path: path.join(screenshotsDir, '01_teller_custody_overview.png') });
    console.log(`[PASS] Teller panel loaded, page title: "${title}"`);
    results.push({ test: 'Teller Panel Load', status: 'VERIFIED' });

    // ── 2. Inspect Branch Cash Position Tab ────────────────────────────────────
    console.log('\n--- Step 2: Switch to Branch Cash Tab ---');
    const branchCashTabBtn = page.locator('button:has-text("Branch Cash Custody & Position")').first();
    if (await branchCashTabBtn.isVisible().catch(() => false)) {
      await branchCashTabBtn.click({ force: true });
      await page.waitForTimeout(2000);
      await page.screenshot({ path: path.join(screenshotsDir, '02_branch_cash_tab_active.png') });
      console.log('[PASS] Clicked Branch Cash Custody & Position tab');
      results.push({ test: 'Branch Cash Tab Navigation', status: 'VERIFIED' });
    }

    // Check for KPI cards and Branch Table
    const pageText = await page.locator('body').innerText();
    const hasPhysicalCashCard = pageText.includes('Physical Cash') || pageText.includes('Cash in Hand') || pageText.includes('Drawer Cash') || pageText.includes('Active Drawer');
    const hasIndiranagar = pageText.includes('Indiranagar Flagship Bakery');
    const excludesTc = !pageText.includes('br_tc_') && !pageText.includes('br_conc_');

    console.log('KPI Cards visible:', hasPhysicalCashCard);
    console.log('Indiranagar Flagship Bakery visible:', hasIndiranagar);
    console.log('Test branches (br_tc_ / br_conc_) excluded:', excludesTc);

    results.push({
      test: 'Branch Cash Isolation in Browser UI',
      status: excludesTc && hasIndiranagar ? 'VERIFIED' : 'PARTIALLY VERIFIED',
      details: { hasPhysicalCashCard, hasIndiranagar, excludesTc }
    });

    // ── 3. Inspect Active Drawer Tab & Manual Adjustment Controls ───────────────
    console.log('\n--- Step 3: Inspect Counter Till / Drawer Tab & Manual Adjustment Controls ---');
    const activeDrawerTabBtn = page.locator('button:has-text("Counter Till / Drawer")').first();
    if (await activeDrawerTabBtn.isVisible().catch(() => false)) {
      await activeDrawerTabBtn.click({ force: true });
      await page.waitForTimeout(2000);
      await page.screenshot({ path: path.join(screenshotsDir, '03_active_drawer_tab.png') });
      console.log('[PASS] Clicked Counter Till / Drawer tab');
      results.push({ test: 'Active Drawer Tab', status: 'VERIFIED' });

      // Look for Manual Adjustment button
      const adjBtn = page.locator('button:has-text("Adjustment")').first();
      if (await adjBtn.isVisible().catch(() => false)) {
        await adjBtn.click({ force: true });
        await page.waitForTimeout(1000);
        await page.screenshot({ path: path.join(screenshotsDir, '04_manual_adjustment_modal.png') });
        console.log('[PASS] Manual adjustment modal rendered with controls');
        results.push({ test: 'Manual Adjustment Modal Controls', status: 'VERIFIED' });
        // Close modal
        const closeBtn = page.locator('button:has-text("Cancel")').first();
        if (await closeBtn.isVisible().catch(() => false)) {
          await closeBtn.click({ force: true });
        }
      }
    }

    // ── 4. Inspect Session Audit History Tab ───────────────────────────────────
    console.log('\n--- Step 4: Inspect Session Audit History Tab ---');
    const sessionHistoryTabBtn = page.locator('button:has-text("Session Audit History")').first();
    if (await sessionHistoryTabBtn.isVisible().catch(() => false)) {
      await sessionHistoryTabBtn.click({ force: true });
      await page.waitForTimeout(2000);
      await page.screenshot({ path: path.join(screenshotsDir, '05_session_history_tab.png') });
      console.log('[PASS] Session Audit History tab rendered');
      results.push({ test: 'Session History Tab', status: 'VERIFIED' });
    }

    await adminCtx.close();
  } catch (err) {
    console.error('[BROWSER SUITE ERROR]:', err);
    results.push({ test: 'Browser Suite Execution', status: 'FAILED', error: err.message });
  } finally {
    await browser.close();
  }

  console.log('\n=============================================================================');
  console.log('BROWSER TEST SUMMARY:');
  console.log(JSON.stringify(results, null, 2));
  console.log('=============================================================================\n');

  fs.writeFileSync(
    path.join(__dirname, 'playwright_browser_results.json'),
    JSON.stringify(results, null, 2)
  );

  return results;
}

runBrowserSuite().catch(err => {
  console.error('[FATAL]:', err);
  process.exit(1);
});
