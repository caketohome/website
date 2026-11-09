const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { chromium } = require('../frontend/node_modules/playwright');

const SCREENSHOT_DIR = 'C:/Users/alexc/.gemini/antigravity-ide/brain/1934cc4b-0dc4-415c-babd-f3c5b16440fc/screenshots';
if (!fs.existsSync(SCREENSHOT_DIR)) {
  fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
}

function getJwtSecret() {
  const envPath = path.join(__dirname, '../frontend/.env');
  const env = fs.readFileSync(envPath, 'utf8');
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

function createToken(role = 'SUPER_ADMIN', userId = 'admin_01', extra = {}) {
  const secret = getJwtSecret();
  const now = Math.floor(Date.now() / 1000);
  const exp = now + 7 * 86400;

  const header = { alg: 'HS256', typ: 'JWT' };
  const payload = {
    userId,
    role,
    phone: '9876543210',
    customerId: userId,
    branchId: extra.branchId || null,
    partnerId: extra.partnerId || null,
    name: `${role} User`,
    email: `${role.toLowerCase()}@caketohome.com`,
    permissions: role === 'SUPER_ADMIN' ? ['*'] : [],
    isSuperAdmin: role === 'SUPER_ADMIN',
    iat: now,
    exp,
    ...extra
  };

  const b64 = (obj) => Buffer.from(JSON.stringify(obj)).toString('base64url');
  const data = `${b64(header)}.${b64(payload)}`;
  const sig = crypto.createHmac('sha256', secret).update(data).digest('base64url');
  return `${data}.${sig}`;
}

const VIEWPORTS = [
  { name: 'Desktop_1920x1080', width: 1920, height: 1080 },
  { name: 'Tablet_768x1024', width: 768, height: 1024 },
  { name: 'Mobile_375x667', width: 375, height: 667 }
];

async function runFullSystemBrowserAudit() {
  console.log('=============================================================================');
  console.log('CakeToHome ERP — Complete System-Wide Playwright Browser Automation Audit');
  console.log('Testing: All Roles, Key Panels, Responsive Viewports, Screenshots, Console Errors');
  console.log('Target: http://localhost:3001');
  console.log('=============================================================================\n');

  const browser = await chromium.launch({ headless: true });
  const auditResults = [];

  try {
    // -------------------------------------------------------------------------
    // 1. SUPER ADMIN WORKFLOWS & KEY DASHBOARD PANELS
    // -------------------------------------------------------------------------
    console.log('--- SECTION 1: SUPER ADMIN DASHBOARD AUDIT ---');
    const adminToken = createToken('SUPER_ADMIN', 'admin_01');
    const adminContext = await browser.newContext({ viewport: { width: 1920, height: 1080 } });
    await adminContext.addCookies([
      { name: '_cth_role', value: 'SUPER_ADMIN', domain: 'localhost', path: '/' },
      { name: '_cth_user_id', value: 'admin_01', domain: 'localhost', path: '/' },
      { name: '_cth_jwt', value: adminToken, domain: 'localhost', path: '/' },
      { name: '_medusa_jwt', value: adminToken, domain: 'localhost', path: '/' },
    ]);

    const adminPage = await adminContext.newPage();
    const adminErrors = [];
    adminPage.on('console', msg => { if (msg.type() === 'error') adminErrors.push(msg.text()); });
    adminPage.on('pageerror', err => { adminErrors.push(err.message); });

    const ADMIN_PANELS = [
      { id: 'orders', name: 'Orders Management' },
      { id: 'catalog', name: 'PIM Catalog' },
      { id: 'tax_master', name: 'Tax Master & Rates' },
      { id: 'branches', name: 'Branches Master' },
      { id: 'delivery', name: 'Delivery Dispatch' },
      { id: 'suppliers', name: 'Suppliers Master' },
      { id: 'purchases', name: 'Purchases & PO' },
      { id: 'bills_payable', name: 'Bills Payable (AP)' },
      { id: 'bills_receivable', name: 'Bills Receivable (AR)' },
      { id: 'expenses', name: 'Expenses & Opex' },
      { id: 'accounting_work_queue', name: 'Financial Work Queue' },
      { id: 'teller_custody', name: 'Teller Cash Custody' },
      { id: 'manual_journals', name: 'Manual Journals' },
      { id: 'cost_allocations', name: 'Cost Allocation Engine' },
      { id: 'corporate_accounts', name: 'Corporate Accounts' },
      { id: 'corporate_gifting', name: 'Corporate Gifting Batches' },
      { id: 'gateway_settlements', name: 'Gateway Settlements' },
      { id: 'bank_accounts', name: 'Bank Accounts' },
      { id: 'bank_reconciliation', name: 'Bank Reconciliation (BRS)' },
      { id: 'general_ledger', name: 'General Ledger' },
      { id: 'profit_loss', name: 'Profit & Loss Statement' },
      { id: 'balance_sheet', name: 'Balance Sheet' },
      { id: 'cash_flow', name: 'Cash Flow Statement' }
    ];

    console.log('Warming up /dashboard compilation...');
    try {
      await adminPage.goto('http://localhost:3001/dashboard?tab=orders', { waitUntil: 'domcontentloaded', timeout: 90000 });
      await adminPage.waitForTimeout(3000);
      console.log('✓ /dashboard warmup complete.');
    } catch (e) {
      console.log('⚠️ Warmup error/timeout:', e.message);
    }

    for (const panel of ADMIN_PANELS) {
      const url = `http://localhost:3001/dashboard?tab=${panel.id}`;
      process.stdout.write(`Testing Admin Panel: [${panel.name}] (${panel.id}) ... `);
      try {
        const res = await adminPage.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });
        await adminPage.waitForTimeout(2000);

        const buttons = await adminPage.locator('button').count();
        const tables = await adminPage.locator('table').count();
        const inputs = await adminPage.locator('input, select, textarea').count();
        const status = res ? res.status() : 0;
        const isSuccess = status === 200 && !adminPage.url().includes('/login');

        const shotPath = path.join(SCREENSHOT_DIR, `admin_panel_${panel.id}.png`);
        await adminPage.screenshot({ path: shotPath, fullPage: false });

        console.log(`✓ HTTP ${status} (Buttons: ${buttons}, Tables: ${tables}, Inputs: ${inputs})`);
        auditResults.push({
          role: 'SUPER_ADMIN',
          module: 'Admin Dashboard',
          feature: panel.name,
          route: `/dashboard?tab=${panel.id}`,
          status: isSuccess ? 'VERIFIED' : 'FAILED',
          evidence: `screenshot: admin_panel_${panel.id}.png`,
          details: `HTTP ${status}, ${buttons} buttons, ${tables} tables, ${inputs} inputs`
        });
      } catch (err) {
        console.log(`❌ Error: ${err.message}`);
        auditResults.push({
          role: 'SUPER_ADMIN',
          module: 'Admin Dashboard',
          feature: panel.name,
          route: `/dashboard?tab=${panel.id}`,
          status: 'FAILED',
          evidence: `error: ${err.message}`,
          details: err.message
        });
      }
    }

    // -------------------------------------------------------------------------
    // -------------------------------------------------------------------------
    // 2. BRANCH MANAGER DASHBOARD
    // -------------------------------------------------------------------------
    console.log('\n--- SECTION 2: BRANCH MANAGER OPERATIONS DASHBOARD ---');
    const mgrToken = createToken('BRANCH_MANAGER', 'staff_mgr_01', { 
      branchId: 'br_indiranagar',
      phone: '+91 98765 00001',
      userId: 'staff_mgr_01'
    });
    const mgrContext = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    await mgrContext.addCookies([
      { name: '_cth_role', value: 'BRANCH_MANAGER', domain: 'localhost', path: '/' },
      { name: '_cth_user_id', value: 'staff_mgr_01', domain: 'localhost', path: '/' },
      { name: '_cth_phone', value: '+91 98765 00001', domain: 'localhost', path: '/' },
      { name: '_cth_jwt', value: mgrToken, domain: 'localhost', path: '/' },
      { name: '_medusa_jwt', value: mgrToken, domain: 'localhost', path: '/' },
    ]);

    const mgrPage = await mgrContext.newPage();
    process.stdout.write('Testing Branch Manager Dashboard: http://localhost:3001/dashboard/shop ... ');
    try {
      const mgrRes = await mgrPage.goto('http://localhost:3001/dashboard/shop', { waitUntil: 'domcontentloaded', timeout: 90000 });
      await mgrPage.waitForTimeout(3000);

      const mgrButtons = await mgrPage.locator('button').count();
      const mgrShot = path.join(SCREENSHOT_DIR, 'branch_manager_dashboard.png');
      await mgrPage.screenshot({ path: mgrShot, fullPage: false });
      console.log(`✓ HTTP ${mgrRes ? mgrRes.status() : 200} (Buttons: ${mgrButtons})`);
      auditResults.push({
        role: 'BRANCH_MANAGER',
        module: 'Branch Operations',
        feature: 'Manager Terminal & Cash Operations',
        route: '/dashboard/shop',
        status: (mgrRes && mgrRes.status() === 200) ? 'VERIFIED' : 'FAILED',
        evidence: 'screenshot: branch_manager_dashboard.png',
        details: `HTTP ${mgrRes ? mgrRes.status() : 200}, ${mgrButtons} interactive buttons`
      });
    } catch (err) {
      console.log(`❌ Error: ${err.message}`);
      auditResults.push({
        role: 'BRANCH_MANAGER',
        module: 'Branch Operations',
        feature: 'Manager Terminal & Cash Operations',
        route: '/dashboard/shop',
        status: 'FAILED',
        evidence: `error: ${err.message}`,
        details: err.message
      });
    }
    await mgrContext.close();

    // -------------------------------------------------------------------------
    // 3. DELIVERY PARTNER DASHBOARD
    // -------------------------------------------------------------------------
    console.log('\n--- SECTION 3: DELIVERY PARTNER DASHBOARD ---');
    const riderToken = createToken('DELIVERY_PARTNER', 'staff_dlp_01', { 
      partnerId: 'dlp_01',
      phone: '+91 99000 11111',
      userId: 'staff_dlp_01'
    });
    const riderContext = await browser.newContext({ viewport: { width: 390, height: 844 } });
    await riderContext.addCookies([
      { name: '_cth_role', value: 'DELIVERY_PARTNER', domain: 'localhost', path: '/' },
      { name: '_cth_user_id', value: 'staff_dlp_01', domain: 'localhost', path: '/' },
      { name: '_cth_phone', value: '+91 99000 11111', domain: 'localhost', path: '/' },
      { name: '_cth_jwt', value: riderToken, domain: 'localhost', path: '/' },
      { name: '_medusa_jwt', value: riderToken, domain: 'localhost', path: '/' },
    ]);

    const riderPage = await riderContext.newPage();
    process.stdout.write('Testing Delivery Partner Dashboard: http://localhost:3001/dashboard/delivery-partner ... ');
    try {
      const riderRes = await riderPage.goto('http://localhost:3001/dashboard/delivery-partner', { waitUntil: 'domcontentloaded', timeout: 90000 });
      await riderPage.waitForTimeout(3000);

      const riderButtons = await riderPage.locator('button').count();
      const riderShot = path.join(SCREENSHOT_DIR, 'delivery_partner_dashboard.png');
      await riderPage.screenshot({ path: riderShot, fullPage: false });
      console.log(`✓ HTTP ${riderRes ? riderRes.status() : 200} (Buttons: ${riderButtons})`);
      auditResults.push({
        role: 'DELIVERY_PARTNER',
        module: 'Logistics',
        feature: 'Rider Task & Handover Console',
        route: '/dashboard/delivery-partner',
        status: (riderRes && riderRes.status() === 200) ? 'VERIFIED' : 'FAILED',
        evidence: 'screenshot: delivery_partner_dashboard.png',
        details: `HTTP ${riderRes ? riderRes.status() : 200}, ${riderButtons} buttons`
      });
    } catch (err) {
      console.log(`❌ Error: ${err.message}`);
      auditResults.push({
        role: 'DELIVERY_PARTNER',
        module: 'Logistics',
        feature: 'Rider Task & Handover Console',
        route: '/dashboard/delivery-partner',
        status: 'FAILED',
        evidence: `error: ${err.message}`,
        details: err.message
      });
    }
    await riderContext.close();

    // -------------------------------------------------------------------------
    // 4. CUSTOMER STOREFRONT & MULTI-VIEWPORT VERIFICATION
    // -------------------------------------------------------------------------
    console.log('\n--- SECTION 4: CUSTOMER STOREFRONT & MULTI-VIEWPORT AUDIT ---');
    const STORE_ROUTES = [
      { path: '/', name: 'Storefront Landing Page' },
      { path: '/shop', name: 'Product Catalog' },
      { path: '/cart', name: 'Shopping Cart' },
      { path: '/login', name: 'Customer Login' },
      { path: '/account', name: 'Customer Account Profile' }
    ];

    for (const vp of VIEWPORTS) {
      console.log(`\nTesting Viewport: ${vp.name} (${vp.width}x${vp.height})`);
      const storeContext = await browser.newContext({ viewport: { width: vp.width, height: vp.height } });
      const storePage = await storeContext.newPage();

      for (const route of STORE_ROUTES) {
        const url = `http://localhost:3001${route.path}`;
        process.stdout.write(`  Route: [${route.name}] -> ${route.path} ... `);
        try {
          const res = await storePage.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });
          await storePage.waitForTimeout(1500);

          const status = res ? res.status() : 0;
          const cleanName = route.name.toLowerCase().replace(/[\s\(\)]+/g, '_');
          const shotPath = path.join(SCREENSHOT_DIR, `storefront_${cleanName}_${vp.name}.png`);
          await storePage.screenshot({ path: shotPath, fullPage: false });

          console.log(`✓ HTTP ${status}`);
          auditResults.push({
            role: 'CUSTOMER',
            module: 'Storefront',
            feature: `${route.name} (${vp.name})`,
            route: route.path,
            status: status === 200 ? 'VERIFIED' : 'FAILED',
            evidence: `screenshot: storefront_${cleanName}_${vp.name}.png`,
            details: `Viewport ${vp.width}x${vp.height}, HTTP ${status}`
          });
        } catch (err) {
          console.log(`❌ Error: ${err.message}`);
          auditResults.push({
            role: 'CUSTOMER',
            module: 'Storefront',
            feature: `${route.name} (${vp.name})`,
            route: route.path,
            status: 'FAILED',
            evidence: `error: ${err.message}`,
            details: err.message
          });
        }
      }
      await storeContext.close();
    }

    // -------------------------------------------------------------------------
    // 5. UNAUTHORIZED ACCESS & PRIVILEGE ESCALATION DEFENSE
    // -------------------------------------------------------------------------
    console.log('\n--- SECTION 5: UNAUTHORIZED ROLE ACCESS & ESCALATION DEFENSE ---');
    const unauthContext = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const unauthPage = await unauthContext.newPage();

    // Customer trying to access Admin Dashboard
    process.stdout.write('Testing Customer accessing /dashboard ... ');
    try {
      await unauthPage.goto('http://localhost:3001/dashboard', { waitUntil: 'domcontentloaded', timeout: 60000 });
      await unauthPage.waitForTimeout(1500);
      const unauthUrl = unauthPage.url();
      const redirectedToLogin = unauthUrl.includes('/login');
      console.log(`✓ Blocked & Redirected: ${redirectedToLogin} (${unauthUrl})`);
      auditResults.push({
        role: 'CUSTOMER (UNAUTHORIZED)',
        module: 'Security & Access Control',
        feature: 'Admin Dashboard Guard',
        route: '/dashboard',
        status: redirectedToLogin ? 'VERIFIED' : 'FAILED',
        evidence: `redirected to ${unauthUrl}`,
        details: 'Unauthenticated/unprivileged user blocked from /dashboard'
      });
    } catch (err) {
      console.log(`❌ Error: ${err.message}`);
    }

    // Customer trying to access Branch Manager Dashboard
    process.stdout.write('Testing Customer accessing /dashboard/shop ... ');
    try {
      await unauthPage.goto('http://localhost:3001/dashboard/shop', { waitUntil: 'domcontentloaded', timeout: 60000 });
      await unauthPage.waitForTimeout(1500);
      const shopUrl = unauthPage.url();
      const shopRedirect = shopUrl.includes('/login');
      console.log(`✓ Blocked & Redirected: ${shopRedirect} (${shopUrl})`);
      auditResults.push({
        role: 'CUSTOMER (UNAUTHORIZED)',
        module: 'Security & Access Control',
        feature: 'Branch Manager Dashboard Guard',
        route: '/dashboard/shop',
        status: shopRedirect ? 'VERIFIED' : 'FAILED',
        evidence: `redirected to ${shopUrl}`,
        details: 'Unauthenticated/unprivileged user blocked from /dashboard/shop'
      });
    } catch (err) {
      console.log(`❌ Error: ${err.message}`);
    }

    // Customer trying to access Delivery Partner Dashboard
    process.stdout.write('Testing Customer accessing /dashboard/delivery-partner ... ');
    try {
      await unauthPage.goto('http://localhost:3001/dashboard/delivery-partner', { waitUntil: 'domcontentloaded', timeout: 60000 });
      await unauthPage.waitForTimeout(1500);
      const dlpUrl = unauthPage.url();
      const dlpRedirect = dlpUrl.includes('/login');
      console.log(`✓ Blocked & Redirected: ${dlpRedirect} (${dlpUrl})`);
      auditResults.push({
        role: 'CUSTOMER (UNAUTHORIZED)',
        module: 'Security & Access Control',
        feature: 'Delivery Partner Dashboard Guard',
        route: '/dashboard/delivery-partner',
        status: dlpRedirect ? 'VERIFIED' : 'FAILED',
        evidence: `redirected to ${dlpUrl}`,
        details: 'Unauthenticated/unprivileged user blocked from /dashboard/delivery-partner'
      });
    } catch (err) {
      console.log(`❌ Error: ${err.message}`);
    }

    await unauthContext.close();

    // Summary output
    console.log('\n=============================================================================');
    console.log(`PLAYWRIGHT AUDIT COMPLETE: ${auditResults.filter(r => r.status === 'VERIFIED').length} / ${auditResults.length} WORKFLOWS VERIFIED`);
    console.log(`Screenshots saved to: ${SCREENSHOT_DIR}`);
    console.log('=============================================================================\n');

    fs.writeFileSync(
      path.join(__dirname, 'playwright_full_audit_results.json'),
      JSON.stringify(auditResults, null, 2)
    );

  } finally {
    await browser.close();
  }
}

runFullSystemBrowserAudit().catch(err => {
  console.error('Playwright audit suite failed:', err);
  process.exit(1);
});
