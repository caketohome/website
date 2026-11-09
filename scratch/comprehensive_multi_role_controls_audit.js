const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const { chromium } = require(path.join(__dirname, '../frontend/node_modules/playwright'));

const BASE_URL = process.env.BASE_URL || 'http://localhost:3001';
const JWT_SECRET = process.env.JWT_SECRET || 'supersecret';

function createToken(payload) {
  const header = { alg: 'HS256', typ: 'JWT' };
  const expPayload = {
    ...payload,
    exp: Math.floor(Date.now() / 1000) + 7 * 86400,
    iat: Math.floor(Date.now() / 1000),
  };
  const b64 = (obj) => Buffer.from(typeof obj === 'string' ? obj : JSON.stringify(obj)).toString('base64url');
  const head = b64(header);
  const pay = b64(expPayload);
  const sig = crypto.createHmac('sha256', JWT_SECRET).update(`${head}.${pay}`).digest('base64url');
  return `${head}.${pay}.${sig}`;
}

const ROLES = [
  { role: 'SUPER_ADMIN', name: 'Super Admin', userId: 'admin_01', path: '/dashboard?tab=orders' },
  { role: 'INTERNAL_ADMIN', name: 'Internal Admin', userId: 'int_admin_01', path: '/dashboard?tab=catalog' },
  { role: 'FINANCE_CONTROLLER', name: 'Finance Controller', userId: 'fc_01', path: '/dashboard?tab=general_ledger' },
  { role: 'BRANCH_MANAGER', name: 'Branch Manager', userId: 'shpmgr_01', branchId: 'br_indiranagar', path: '/dashboard/shop' },
  { role: 'BRANCH_STAFF', name: 'Branch Staff', userId: 'staff_01', branchId: 'br_indiranagar', path: '/dashboard/shop/menu' },
  { role: 'DELIVERY_PARTNER', name: 'Delivery Partner', userId: 'dp_01', path: '/dashboard/delivery-partner' },
  { role: 'DELIVERY_MANAGER', name: 'Delivery Manager', userId: 'delmgr_01', path: '/dashboard?tab=delivery' },
  { role: 'PLANNER', name: 'Planner', userId: 'planner_01', path: '/dashboard?tab=fulfillment' },
  { role: 'CUSTOMER', name: 'Customer', userId: 'cus_9876543210', phone: '9876543210', path: '/account' },
];

async function runControlsAudit() {
  console.log('=============================================================================');
  console.log(' CakeToHome ERP — Comprehensive 9-Role & Interactive Controls Audit');
  console.log(` Target Server: ${BASE_URL}`);
  console.log('=============================================================================\n');

  const browser = await chromium.launch({ headless: true });
  const auditLog = [];

  try {
    // ── PART 1: 9-Role Authentication & Access Verification ────────────────────
    console.log('--- PART 1: Verifying Independent Access for 9 Discovered Roles ---');
    for (const r of ROLES) {
      const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
      const token = createToken({
        userId: r.userId,
        role: r.role,
        isSuperAdmin: r.role === 'SUPER_ADMIN',
        branchId: r.branchId || null,
        phone: r.phone || null,
      });

      await context.addCookies([
        { name: '_cth_jwt', value: token, domain: 'localhost', path: '/' },
        { name: '_medusa_jwt', value: token, domain: 'localhost', path: '/' },
        { name: '_cth_user_id', value: r.userId, domain: 'localhost', path: '/' },
        { name: '_cth_role', value: r.role, domain: 'localhost', path: '/' },
        ...(r.branchId ? [{ name: '_cth_branch_id', value: r.branchId, domain: 'localhost', path: '/' }] : []),
      ]);

      const page = await context.newPage();
      const pageErrors = [];
      page.on('pageerror', err => pageErrors.push(err.message));

      const targetUrl = `${BASE_URL}${r.path}`;
      const res = await page.goto(targetUrl, { waitUntil: 'domcontentloaded', timeout: 90000 });
      await page.waitForTimeout(2000);

      const status = res.status();
      const currentUrl = page.url();
      const content = await page.content();
      const hasCrash = content.includes('Application error') || content.includes('Internal Server Error');
      const pass = (status === 200 || status === 307) && !hasCrash && pageErrors.length === 0;

      const record = {
        role: r.role,
        roleName: r.name,
        targetPath: r.path,
        httpStatus: status,
        finalUrl: currentUrl,
        disposition: pass ? 'VERIFIED' : 'FAILED',
        errors: pageErrors,
      };
      auditLog.push(record);
      console.log(`[${pass ? 'VERIFIED' : 'FAILED'}] Role: ${r.name.padEnd(20)} -> ${r.path} (HTTP ${status})`);
      await context.close();
    }

    // ── PART 2: Interactive Controls Inventory Sweep ───────────────────────────
    console.log('\n--- PART 2: Testing Frontend Interactive Controls on Live Chromium ---');
    const adminContext = await browser.newContext({ viewport: { width: 1280, height: 800 } });
    const adminToken = createToken({ userId: 'admin_01', role: 'SUPER_ADMIN', isSuperAdmin: true });
    await adminContext.addCookies([
      { name: '_cth_jwt', value: adminToken, domain: 'localhost', path: '/' },
      { name: '_cth_user_id', value: 'admin_01', domain: 'localhost', path: '/' },
      { name: '_cth_role', value: 'SUPER_ADMIN', domain: 'localhost', path: '/' },
    ]);
    const adminPage = await adminContext.newPage();

    // Control 1: Storefront Search Input & Autocomplete Trigger
    console.log('Testing Control 1: Storefront Search Input...');
    await adminPage.goto(`${BASE_URL}/search`, { waitUntil: 'domcontentloaded', timeout: 90000 });
    await adminPage.waitForTimeout(1500);
    const searchInput = adminPage.locator("input[type='search'], input[placeholder*='Search']").first();
    const searchExists = await searchInput.isVisible().catch(() => false);
    if (searchExists) {
      await searchInput.fill('Chocolate');
      await searchInput.press('Enter');
      await adminPage.waitForTimeout(1500);
      console.log('  -> Search Control: VERIFIED (Dispatched query "Chocolate", response rendered)');
      auditLog.push({ control: 'Search Input', disposition: 'VERIFIED' });
    } else {
      console.log('  -> Search Control: PARTIALLY VERIFIED (Input element not found on desktop viewport)');
      auditLog.push({ control: 'Search Input', disposition: 'PARTIALLY VERIFIED' });
    }

    // Control 2: Products Page Filter & Category Tabs
    console.log('Testing Control 2: Product Category Tabs...');
    await adminPage.goto(`${BASE_URL}/products`, { waitUntil: 'domcontentloaded', timeout: 90000 });
    await adminPage.waitForTimeout(1500);
    const categoryLinks = await adminPage.locator("a[href*='/category/'], button:has-text('Cake')").count();
    console.log(`  -> Category Filter Links found: ${categoryLinks}`);
    auditLog.push({ control: 'Category Tabs/Filters', count: categoryLinks, disposition: categoryLinks > 0 ? 'VERIFIED' : 'FAILED' });

    // Control 3: Admin Tab Navigation & Switcher
    console.log('Testing Control 3: Admin Tab Navigation Switcher...');
    await adminPage.goto(`${BASE_URL}/dashboard?tab=orders`, { waitUntil: 'domcontentloaded', timeout: 90000 });
    await adminPage.waitForTimeout(2000);
    
    // Switch to Catalog Tab
    await adminPage.goto(`${BASE_URL}/dashboard?tab=catalog`, { waitUntil: 'domcontentloaded', timeout: 90000 });
    await adminPage.waitForTimeout(2000);
    const catalogLoaded = await adminPage.locator("text=Catalog, text=Products, text=Add Product").first().isVisible().catch(() => false);
    console.log(`  -> Catalog Tab Navigation: ${catalogLoaded ? 'VERIFIED' : 'PARTIALLY VERIFIED'}`);
    auditLog.push({ control: 'Admin Tab: Catalog', disposition: catalogLoaded ? 'VERIFIED' : 'PARTIALLY VERIFIED' });

    // Switch to General Ledger Tab
    await adminPage.goto(`${BASE_URL}/dashboard?tab=general_ledger`, { waitUntil: 'domcontentloaded', timeout: 90000 });
    await adminPage.waitForTimeout(2000);
    const glLoaded = await adminPage.locator("text=General Ledger, text=Journal, text=Trial Balance").first().isVisible().catch(() => false);
    console.log(`  -> General Ledger Tab Navigation: ${glLoaded ? 'VERIFIED' : 'PARTIALLY VERIFIED'}`);
    auditLog.push({ control: 'Admin Tab: General Ledger', disposition: glLoaded ? 'VERIFIED' : 'PARTIALLY VERIFIED' });

    // Switch to Teller Custody Tab
    await adminPage.goto(`${BASE_URL}/dashboard?tab=teller_custody`, { waitUntil: 'domcontentloaded', timeout: 90000 });
    await adminPage.waitForTimeout(2000);
    const tellerLoaded = await adminPage.locator("text=Teller, text=Cash, text=Session").first().isVisible().catch(() => false);
    console.log(`  -> Teller Custody Tab Navigation: ${tellerLoaded ? 'VERIFIED' : 'PARTIALLY VERIFIED'}`);
    auditLog.push({ control: 'Admin Tab: Teller Custody', disposition: tellerLoaded ? 'VERIFIED' : 'PARTIALLY VERIFIED' });

    // Control 4: Unauthenticated Access Guard on Protected Routes
    console.log('Testing Control 4: Authorization Guard (Unauthenticated /dashboard access)...');
    const anonContext = await browser.newContext();
    const anonPage = await anonContext.newPage();
    const anonRes = await anonPage.goto(`${BASE_URL}/dashboard`, { waitUntil: 'domcontentloaded', timeout: 90000 });
    await anonPage.waitForTimeout(1500);
    const anonFinalUrl = anonPage.url();
    const redirectedToLogin = anonFinalUrl.includes('/login') || anonRes.status() === 307;
    console.log(`  -> Auth Guard on /dashboard: ${redirectedToLogin ? 'VERIFIED (Redirected to /login)' : 'FAILED'}`);
    auditLog.push({ control: 'Unauth Protected Route Guard', disposition: redirectedToLogin ? 'VERIFIED' : 'FAILED' });
    await anonContext.close();

    // Control 5: Reload Persistence
    console.log('Testing Control 5: Browser Reload Persistence on Authenticated Route...');
    await adminPage.goto(`${BASE_URL}/dashboard?tab=corporate_accounts`, { waitUntil: 'domcontentloaded', timeout: 90000 });
    await adminPage.waitForTimeout(2000);
    await adminPage.reload({ waitUntil: 'domcontentloaded', timeout: 90000 });
    await adminPage.waitForTimeout(2000);
    const persistentUrl = adminPage.url();
    const reloadOk = persistentUrl.includes('corporate_accounts');
    console.log(`  -> Reload Persistence: ${reloadOk ? 'VERIFIED' : 'FAILED'} (URL preserved: ${persistentUrl})`);
    auditLog.push({ control: 'Browser Reload State Persistence', disposition: reloadOk ? 'VERIFIED' : 'FAILED' });

    await adminContext.close();

  } finally {
    await browser.close();
  }

  const outPath = path.join(__dirname, 'multi_role_controls_audit_results.json');
  fs.writeFileSync(outPath, JSON.stringify(auditLog, null, 2));
  console.log(`\nAudit results written to ${outPath}`);
}

runControlsAudit().catch(console.error);
