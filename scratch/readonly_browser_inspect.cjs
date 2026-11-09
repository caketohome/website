const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { chromium } = require(path.resolve(__dirname, '../frontend/node_modules/@playwright/test'));
const { Client } = require(path.resolve(__dirname, '../frontend/node_modules/pg'));

const BASE_URL = 'http://localhost:3000';
const JWT_SECRET = 'supersecret';
const DB_URL = '[REDACTED_DATABASE_CREDENTIAL]';
const SCREENSHOT_DIR = path.resolve(__dirname, '../frontend/test-results/screenshots');

fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });

function signJwt(payload, secret = JWT_SECRET, expiresInSeconds = 7 * 86400) {
  const now = Math.floor(Date.now() / 1000);
  const exp = now + expiresInSeconds;
  const header = { alg: 'HS256', typ: 'JWT' };
  const fullPayload = {
    userId: payload.userId || 'admin_01',
    role: (payload.role || 'SUPER_ADMIN').toUpperCase(),
    phone: payload.phone || '9999999999',
    customerUid: payload.userId || 'admin_01',
    customerId: payload.userId || 'admin_01',
    name: payload.name || 'Admin',
    email: payload.email || 'admin@cakes2home.com',
    isSuperAdmin: true,
    iat: now,
    exp,
  };
  const b64 = (obj) => Buffer.from(JSON.stringify(obj)).toString('base64url');
  const data = `${b64(header)}.${b64(fullPayload)}`;
  const sig = crypto.createHmac('sha256', secret).update(data).digest('base64url');
  return `${data}.${sig}`;
}

async function main() {
  console.log('=== PHASE F: REAL-BROWSER READ-ONLY AUDIT & INSPECTION ===');
  console.log('Timestamp:', new Date().toISOString());

  const superAdminToken = signJwt({ userId: 'admin_01', role: 'SUPER_ADMIN' });

  // 1. Launch Chromium
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });

  await context.addCookies([
    { name: '_cth_jwt', value: superAdminToken, domain: 'localhost', path: '/' },
    { name: '_cth_role', value: 'SUPER_ADMIN', domain: 'localhost', path: '/' },
    { name: '_cth_user_id', value: 'admin_01', domain: 'localhost', path: '/' },
  ]);

  await context.addInitScript((token) => {
    window.localStorage.setItem('cth_access_token', token);
    window.localStorage.setItem('cth_admin_token', token);
  }, superAdminToken);

  const page = await context.newPage();

  // 2. Navigate to Settings / Business Profile
  console.log('\n[F-1] Navigating to Business Profile Settings...');
  await page.goto(`${BASE_URL}/dashboard?tab=settings`, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForSelector('#legal_name', { timeout: 30000 });

  const uiLegalName = await page.inputValue('#legal_name');
  const uiTradeName = await page.inputValue('#trade_name');
  const uiPan = await page.inputValue('#pan');
  const uiCin = await page.inputValue('#cin');
  const uiStateCode = await page.inputValue('#addr_state_code');

  const shot1 = path.join(SCREENSHOT_DIR, 'readonly_01_business_profile.png');
  await page.screenshot({ path: shot1, fullPage: true });
  console.log('  📸 Screenshot captured:', shot1);
  console.log('  UI Extracted Legal Name:', uiLegalName);
  console.log('  UI Extracted PAN (Masked):', uiPan ? uiPan.slice(0, 5) + '****' + uiPan.slice(-1) : 'NONE');
  console.log('  UI Extracted CIN (Masked):', uiCin ? uiCin.slice(0, 10) + '***********' : 'NONE');

  // 3. Navigate to Tax & GST
  console.log('\n[F-2] Inspecting Tax & GST Tab...');
  await page.click('button:has-text("Tax & GST")');
  await page.waitForSelector('text=Multi-State GST Registrations', { timeout: 10000 });

  const shot2 = path.join(SCREENSHOT_DIR, 'readonly_02_tax_gst.png');
  await page.screenshot({ path: shot2, fullPage: true });
  console.log('  📸 Screenshot captured:', shot2);

  // 4. Navigate to Accounting Setup
  console.log('\n[F-3] Navigating to Accounting Setup...');
  await page.goto(`${BASE_URL}/dashboard?tab=accounting_setup`, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForSelector('text=Accounting Start Date', { timeout: 15000 });

  const hasDateText = await page.locator('text=2026-04-01').isVisible().catch(() => false);
  const isLockedText = await page.locator('text=Locked — Journal entries exist').isVisible().catch(() => false);

  const shot3 = path.join(SCREENSHOT_DIR, 'readonly_03_accounting_setup.png');
  await page.screenshot({ path: shot3, fullPage: true });
  console.log('  📸 Screenshot captured:', shot3);
  console.log('  UI Displays 2026-04-01:', hasDateText);
  console.log('  UI Displays Locked Banner:', isLockedText);

  await browser.close();

  // 5. Compare with Live Database
  console.log('\n[F-4] Comparing UI Displays against Live PostgreSQL Source of Truth...');
  const c = new Client({ connectionString: DB_URL, ssl: { rejectUnauthorized: false } });
  await c.connect();
  await c.query('BEGIN TRANSACTION READ ONLY');

  const compDb = await c.query('SELECT * FROM public.company LIMIT 1');
  const setDb = await c.query("SELECT * FROM public.setting WHERE key = 'accounting_start_date'");
  await c.query('COMMIT');
  await c.end();

  const dbRow = compDb.rows[0];
  const setRow = setDb.rows[0];

  const report = {
    timestamp: new Date().toISOString(),
    environment: 'aws-1-ap-south-1.pooler.supabase.com:6543/postgres',
    uiState: {
      legalName: uiLegalName,
      panMasked: uiPan ? uiPan.slice(0, 5) + '****' + uiPan.slice(-1) : null,
      cinMasked: uiCin ? uiCin.slice(0, 10) + '***********' : null,
      stateCode: uiStateCode,
      accountingStartDateDisplayed: hasDateText ? '2026-04-01' : null,
      isLockedBannerVisible: isLockedText,
    },
    databaseState: {
      companyId: dbRow?.id,
      legalName: dbRow?.legal_name,
      panMasked: dbRow?.pan ? dbRow.pan.slice(0, 5) + '****' + dbRow.pan.slice(-1) : null,
      cinMasked: dbRow?.cin ? dbRow.cin.slice(0, 10) + '***********' : null,
      stateCode: dbRow?.state_code,
      accountingStartDatePersisted: setRow?.value,
    },
    mismatches: [],
    screenshots: [shot1, shot2, shot3],
  };

  if (uiLegalName !== dbRow?.legal_name) report.mismatches.push(`Legal Name UI '${uiLegalName}' != DB '${dbRow?.legal_name}'`);
  if (uiPan !== dbRow?.pan) report.mismatches.push('PAN mismatch');
  if (uiCin !== dbRow?.cin) report.mismatches.push('CIN mismatch');
  if (setRow?.value !== '2026-04-01') report.mismatches.push(`Accounting date DB '${setRow?.value}' != '2026-04-01'`);

  console.log('Mismatches detected between UI and DB:', report.mismatches.length);
  fs.writeFileSync(path.resolve(__dirname, 'phase_f_browser_audit.json'), JSON.stringify(report, null, 2));
  console.log('Report written to phase_f_browser_audit.json');
}

main().catch(console.error);
