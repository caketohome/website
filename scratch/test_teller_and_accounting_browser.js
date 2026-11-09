const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { chromium } = require('../frontend/node_modules/playwright');

const ARTIFACT_DIR = 'C:/Users/alexc/.gemini/antigravity-ide/brain/c5d580fa-dc4a-4a99-a5c0-f219a8837fc4/screenshots_browser';
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

function createToken(role, userId, branchId = 'br_indiranagar') {
  const secret = getJwtSecret();
  const now = Math.floor(Date.now() / 1000);
  const exp = now + 86400;

  const header = { alg: 'HS256', typ: 'JWT' };
  const payload = {
    userId,
    role,
    phone: '9876543210',
    customerId: userId,
    branchId,
    name: role === 'SUPER_ADMIN' ? 'Super Admin' : 'Branch Manager',
    email: `${userId}@caketohome.com`,
    permissions: role === 'SUPER_ADMIN' ? ['*'] : ['BRANCH_MANAGER', 'TELLER.VIEW', 'TELLER.SESSION_OPEN', 'TELLER.SESSION_CLOSE'],
    isSuperAdmin: role === 'SUPER_ADMIN',
    iat: now,
    exp,
  };

  const b64 = (obj) => Buffer.from(JSON.stringify(obj)).toString('base64url');
  const data = `${b64(header)}.${b64(payload)}`;
  const sig = crypto.createHmac('sha256', secret).update(data).digest('base64url');
  return `${data}.${sig}`;
}

async function run() {
  console.log('=============================================================================');
  console.log('CakeToHome ERP — Playwright Browser End-to-End Teller & Accounting Test');
  console.log('=============================================================================\n');

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 }
  });

  const consoleErrors = [];
  const results = [];

  // ── TEST 1: Admin Dashboard Teller Custody Workspace ──
  console.log('--- TEST 1: Admin Dashboard Teller Custody Workspace (/dashboard?tab=teller_custody) ---');
  const adminToken = createToken('SUPER_ADMIN', 'admin_01');
  await context.addCookies([
    { name: '_cth_role', value: 'SUPER_ADMIN', domain: 'localhost', path: '/' },
    { name: '_cth_user_id', value: 'admin_01', domain: 'localhost', path: '/' },
    { name: '_cth_jwt', value: adminToken, domain: 'localhost', path: '/' },
    { name: '_medusa_jwt', value: adminToken, domain: 'localhost', path: '/' },
  ]);

  const page = await context.newPage();
  page.on('console', msg => {
    if (msg.type() === 'error') {
      const txt = msg.text();
      // Ignore favicon or non-critical 404 for media assets
      if (!txt.includes('favicon') && !txt.includes('images/')) {
        consoleErrors.push(`[Admin Console Error] ${txt}`);
      }
    }
  });

  try {
    const resp = await page.goto('http://localhost:3001/dashboard?tab=teller_custody', {
      waitUntil: 'domcontentloaded',
      timeout: 30000
    });
    await page.waitForTimeout(3500);

    const title = await page.title();
    const heading = await page.locator('h1, h2').first().innerText().catch(() => 'No heading');
    const buttons = await page.locator('button').count();
    const tables = await page.locator('table').count();

    const screen1Path = path.join(ARTIFACT_DIR, '01_admin_teller_custody.png');
    await page.screenshot({ path: screen1Path, fullPage: false });

    console.log(`  ✓ Loaded HTTP ${resp.status()} | Title: "${title}"`);
    console.log(`  ✓ Primary Heading: "${heading}"`);
    console.log(`  ✓ UI Elements: ${buttons} buttons, ${tables} tables`);
    console.log(`  ✓ Screenshot saved: ${screen1Path}`);

    results.push({ test: 'Admin Teller Custody Panel', pass: resp.status() === 200, details: `HTTP ${resp.status()}, ${buttons} buttons` });
  } catch (err) {
    console.error('  ❌ Failed Admin Teller Custody test:', err.message);
    results.push({ test: 'Admin Teller Custody Panel', pass: false, error: err.message });
  }

  // ── TEST 2: Shop Manager Workspace — Cash Management Tab ──
  console.log('\n--- TEST 2: Shop Manager Workspace (/dashboard/shop - Cash Tab) ---');
  const managerToken = createToken('BRANCH_MANAGER', 'shpmgr_01', 'br_indiranagar');
  await context.clearCookies();
  await context.addCookies([
    { name: '_cth_role', value: 'BRANCH_MANAGER', domain: 'localhost', path: '/' },
    { name: '_cth_user_id', value: 'shpmgr_01', domain: 'localhost', path: '/' },
    { name: '_cth_jwt', value: managerToken, domain: 'localhost', path: '/' },
    { name: '_medusa_jwt', value: managerToken, domain: 'localhost', path: '/' },
  ]);

  const shopPage = await context.newPage();
  shopPage.on('console', msg => {
    if (msg.type() === 'error') {
      const txt = msg.text();
      if (!txt.includes('favicon') && !txt.includes('images/')) {
        consoleErrors.push(`[Shop Console Error] ${txt}`);
      }
    }
  });

  try {
    const resp = await shopPage.goto('http://localhost:3001/dashboard/shop', {
      waitUntil: 'domcontentloaded',
      timeout: 30000
    });
    await shopPage.waitForTimeout(3000);

    // Click on Cash & Teller tab (Tab 5)
    console.log('  Locating Cash & Teller tab button...');
    const cashTabBtn = shopPage.locator('button', { hasText: /Cash & Teller/i });
    if (await cashTabBtn.count() > 0) {
      await cashTabBtn.first().click();
      await shopPage.waitForTimeout(2500);
      console.log('  ✓ Switched to Cash & Teller tab');
    } else {
      console.log('  ⚠️ Cash & Teller tab button not found by text, checking tabs...');
    }

    const pageContent = await shopPage.content();
    const hasCanonicalCard = pageContent.includes('Canonical Teller Custody') || pageContent.includes('Branch Teller Cash Drawer & Custody Terminal');
    const hasExpectedCash = pageContent.includes('Expected Drawer Cash');
    const hasLaunchLink = pageContent.includes('/dashboard?tab=teller_custody');

    // Verify obsolete buttons are gone
    const hasOldOpenDrawerBtn = await shopPage.locator('button', { hasText: /^Open Drawer$/i }).count();
    const hasOldCloseDrawerBtn = await shopPage.locator('button', { hasText: /^Close Drawer$/i }).count();

    const screen2Path = path.join(ARTIFACT_DIR, '02_shop_manager_cash_tab.png');
    await shopPage.screenshot({ path: screen2Path, fullPage: false });

    console.log(`  ✓ Canonical Terminal Card Visible: ${hasCanonicalCard}`);
    console.log(`  ✓ Expected Drawer Cash Metric Visible: ${hasExpectedCash}`);
    console.log(`  ✓ Launch Link to Master Teller Workspace: ${hasLaunchLink}`);
    console.log(`  ✓ Obsolete 'Open Drawer' Button Count: ${hasOldOpenDrawerBtn} (Expected 0)`);
    console.log(`  ✓ Obsolete 'Close Drawer' Button Count: ${hasOldCloseDrawerBtn} (Expected 0)`);
    console.log(`  ✓ Screenshot saved: ${screen2Path}`);

    const pass = hasCanonicalCard && hasExpectedCash && hasLaunchLink && hasOldOpenDrawerBtn === 0 && hasOldCloseDrawerBtn === 0;
    results.push({
      test: 'Shop Manager Consolidated Cash Terminal',
      pass,
      details: `Canonical card=${hasCanonicalCard}, obsolete buttons removed=${hasOldOpenDrawerBtn === 0 && hasOldCloseDrawerBtn === 0}`
    });
  } catch (err) {
    console.error('  ❌ Failed Shop Manager Cash Tab test:', err.message);
    results.push({ test: 'Shop Manager Consolidated Cash Terminal', pass: false, error: err.message });
  }

  // ── TEST 3: Core Accounting Panels in Admin Dashboard ──
  console.log('\n--- TEST 3: Core Accounting Panels (/dashboard) ---');
  await context.clearCookies();
  await context.addCookies([
    { name: '_cth_role', value: 'SUPER_ADMIN', domain: 'localhost', path: '/' },
    { name: '_cth_user_id', value: 'admin_01', domain: 'localhost', path: '/' },
    { name: '_cth_jwt', value: adminToken, domain: 'localhost', path: '/' },
    { name: '_medusa_jwt', value: adminToken, domain: 'localhost', path: '/' },
  ]);

  const accTabs = [
    { tab: 'general_ledger', label: 'General Ledger' },
    { tab: 'profit_loss', label: 'Profit & Loss' },
    { tab: 'balance_sheet', label: 'Balance Sheet' },
    { tab: 'bank_accounts', label: 'Bank Accounts Master' },
    { tab: 'bank_reconciliation', label: 'Bank Reconciliation' }
  ];

  for (const t of accTabs) {
    try {
      const url = `http://localhost:3001/dashboard?tab=${t.tab}`;
      const resp = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
      await page.waitForTimeout(2500);

      const scrPath = path.join(ARTIFACT_DIR, `03_acc_${t.tab}.png`);
      await page.screenshot({ path: scrPath, fullPage: false });

      console.log(`  ✓ [${t.label}] Loaded HTTP ${resp.status()} | Screenshot: ${scrPath}`);
      results.push({ test: `Admin Tab: ${t.label}`, pass: resp.status() === 200, details: `HTTP ${resp.status()}` });
    } catch (err) {
      console.error(`  ❌ [${t.label}] failed:`, err.message);
      results.push({ test: `Admin Tab: ${t.label}`, pass: false, error: err.message });
    }
  }

  await browser.close();

  console.log('\n=============================================================================');
  console.log('BROWSER TEST SUMMARY:');
  for (const r of results) {
    console.log(`  [${r.pass ? 'PASS' : 'FAIL'}] ${r.test} ${r.details ? '- ' + r.details : ''}`);
  }
  console.log(`Total Console Errors: ${consoleErrors.length}`);
  if (consoleErrors.length > 0) {
    console.log('Console Errors Sample:', consoleErrors.slice(0, 5));
  }
  console.log('=============================================================================');

  const allPassed = results.every(r => r.pass);
  process.exit(allPassed ? 0 : 1);
}

run().catch(err => {
  console.error('Fatal browser test failure:', err);
  process.exit(1);
});
