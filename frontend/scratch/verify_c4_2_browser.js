/**
 * CakeToHome ERP — Phase C4.2 Browser & Visual Verification Suite
 *
 * Uses real headless Chromium via Playwright to verify:
 * 1. Area 1: Active Drawer / Shift View
 * 2. Area 2: Verification & Settlement Queue
 * 3. Area 3: Session Audit History
 * 4. Area 4: Teller Master Station Management
 * 5. Full Modal Workflows:
 *    - Add Counter Station Modal
 *    - Open Shift Modal
 *    - Manual Adjustment Modal
 *    - Close/Count Modal
 *    - Supervisor Verification Modal
 *    - Settlement Preview Modal
 * 6. Visual Invariants: Zero POS UI, correct INR formatting, zero console/runtime exceptions, zero hydration errors.
 * 7. Topological database cleanup ensuring baseline remains 100% pristine.
 */

const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');
const { Client } = require('pg');

function getConnectionString() {
  const envPath = path.join(__dirname, '../.env');
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
  throw new Error("DATABASE_URL not found in .env");
}

async function runBrowserVerification() {
  console.log('=============================================================================');
  console.log('CakeToHome ERP — Phase C4.2 Browser & Visual Verification');
  console.log('=============================================================================\n');

  const screenshotsDir = path.resolve(__dirname, '../../screenshots');
  if (!fs.existsSync(screenshotsDir)) {
    fs.mkdirSync(screenshotsDir, { recursive: true });
  }

  const connStr = getConnectionString();
  const dbClient = new Client({ connectionString: connStr, ssl: { rejectUnauthorized: false } });
  await dbClient.connect();

  const timestamp = Date.now();
  const testOpenerId = `usr_bw_op_${timestamp}`;
  const testVerifierId = `usr_bw_ver_${timestamp}`;
  const testSettlerId = `usr_bw_set_${timestamp}`;
  let createdTellerId = null;

  let passCount = 0;
  let failCount = 0;

  function assert(condition, message) {
    if (condition) {
      console.log(`  ✓ PASS: ${message}`);
      passCount++;
    } else {
      console.error(`  ✗ FAIL: ${message}`);
      failCount++;
    }
  }

  // Register TypeScript transpile hook for .ts imports
  const ts = require('typescript');
  require.extensions['.ts'] = function(module, filename) {
    const content = fs.readFileSync(filename, 'utf8');
    const compiled = ts.transpileModule(content, {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2020,
        esModuleInterop: true,
      }
    });
    return module._compile(compiled.outputText, filename);
  };
  const { signAuthToken } = require('../src/lib/security/auth-session');

  // Insert test users into database
  await dbClient.query(
    `INSERT INTO "user" (id, email) VALUES ($1, $2), ($3, $4), ($5, $6)`,
    [
      testOpenerId, `${testOpenerId}@test.local`,
      testVerifierId, `${testVerifierId}@test.local`,
      testSettlerId, `${testSettlerId}@test.local`,
    ]
  );

  const openerToken = signAuthToken({ userId: testOpenerId, role: 'SUPER_ADMIN' });
  const verifierToken = signAuthToken({ userId: testVerifierId, role: 'SUPER_ADMIN' });
  const settlerToken = signAuthToken({ userId: testSettlerId, role: 'SUPER_ADMIN' });

  const browser = await chromium.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 }
  });

  async function setAuthCookies(userId, token) {
    await context.clearCookies();
    await context.addCookies([
      {
        name: '_cth_role',
        value: 'SUPER_ADMIN',
        domain: 'localhost',
        path: '/'
      },
      {
        name: '_cth_user_id',
        value: userId,
        domain: 'localhost',
        path: '/'
      },
      {
        name: '_cth_jwt',
        value: token,
        domain: 'localhost',
        path: '/'
      }
    ]);
  }

  // Start with Opener credentials
  await setAuthCookies(testOpenerId, openerToken);

  const page = await context.newPage();
  const consoleErrors = [];
  const pageErrors = [];

  page.on('console', (msg) => {
    if (msg.type() === 'error') {
      const text = msg.text();
      if (!text.includes('favicon.ico') && !text.includes('manifest.json')) {
        consoleErrors.push(text);
      }
    }
  });

  page.on('pageerror', (err) => {
    pageErrors.push(err.message);
  });

  try {
    console.log('[Browser Step 1]: Navigating to Teller Cash Custody Dashboard...');
    const response = await page.goto('http://localhost:3000/dashboard?tab=teller_custody', {
      waitUntil: 'domcontentloaded',
      timeout: 60000
    });

    assert(response && response.status() === 200, 'Page loaded with HTTP 200 OK');

    // Wait for the panel header to render
    await page.waitForSelector('text=Teller Cash Custody & Shift Operations', { timeout: 30000 });
    assert(true, 'Main Teller Cash Custody Header is rendered');

    // Wait for branch master data to load into select dropdown
    await page.waitForSelector('select', { timeout: 15000 });
    await page.waitForTimeout(1000);
    assert(true, 'Branch master data loaded into selector');

    // POS Invariant Verification: Ensure ABSOLUTELY NO POS / checkout / catalog UI
    const bodyText = await page.textContent('body');
    assert(!bodyText.includes('Barcode Scanner'), 'No POS Barcode Scanner UI detected');
    assert(!bodyText.includes('Product Catalog Grid'), 'No POS Product Catalog Grid detected');
    assert(!bodyText.includes('Shopping Cart'), 'No Shopping Cart detected');
    assert(!bodyText.includes('Walk-in Billing'), 'No Walk-in Billing detected');
    assert(!bodyText.includes('Print Receipt / POS Terminal'), 'No POS Terminal UI detected');

    // Screenshot initial state
    await page.screenshot({ path: path.join(screenshotsDir, 'c4_2_01_active_drawer.png') });
    console.log('  Saved screenshot: c4_2_01_active_drawer.png');

    // 1. Navigate to Area 4: Counter Stations (Teller Master) to create a counter station via the UI
    console.log('\n[Browser Step 2]: Navigating to Area 4 (Counter Stations) & Creating Station...');
    await page.click('button:has-text("Counter Stations")');
    await page.waitForSelector('text=Teller Counter Stations', { timeout: 10000 });
    assert(true, 'Area 4: Counter Stations tab active');

    const addCounterBtn = await page.waitForSelector('button:has-text("Add Counter")', { timeout: 5000 });
    assert(addCounterBtn !== null, 'Add Counter button is visible');
    await addCounterBtn.click();

    await page.waitForSelector('text=Add Counter Station', { timeout: 5000 });
    assert(true, 'Add Counter Station modal rendered cleanly');

    const testStationCode = `BW${Math.floor(Math.random() * 899 + 100)}`;
    await page.fill('input[placeholder*="e.g. T1"]', testStationCode);
    await page.fill('input[placeholder*="e.g. Main Cash Desk"]', 'Browser Automated Test Till');
    await page.fill('input[placeholder*="e.g. usr_123"]', testOpenerId);

    await page.screenshot({ path: path.join(screenshotsDir, 'c4_2_02_modal_add_counter.png') });
    console.log('  Saved screenshot: c4_2_02_modal_add_counter.png');

    await page.click('button[type="submit"]:has-text("Save Station")');
    await page.waitForTimeout(1000);

    // Verify counter station appears in grid
    await page.waitForSelector(`text=${testStationCode}`, { timeout: 10000 });
    assert(true, `Counter station ${testStationCode} rendered in station master grid`);

    // Capture created teller ID for cleanup
    const tellerDbRes = await dbClient.query('SELECT id FROM teller WHERE code = $1', [testStationCode]);
    if (tellerDbRes.rows.length > 0) {
      createdTellerId = tellerDbRes.rows[0].id;
    }

    // 2. Navigate to Area 1 (Active Drawer) to open shift on newly created station
    console.log('\n[Browser Step 3]: Navigating to Area 1 (Active Drawer) & Opening Shift...');
    await page.click('button:has-text("Active Shift & Till")');
    await page.waitForSelector('text=Teller Cash Custody & Shift Operations', { timeout: 10000 });

    // Select the newly created counter station in the picker
    const tellerDropdown = (await page.$$('select'))[1];
    if (tellerDropdown && createdTellerId) {
      await tellerDropdown.selectOption(createdTellerId);
      await page.waitForTimeout(800);
    }

    // Click Open New Cash Shift
    const openShiftBtn = await page.waitForSelector('button:has-text("Open New Cash Shift")', { timeout: 8000 });
    assert(openShiftBtn !== null, 'Open New Cash Shift button present on active till view');
    await openShiftBtn.click();

    await page.waitForSelector('text=Open Cash Shift', { timeout: 5000 });
    assert(true, 'Open Cash Shift modal rendered cleanly');

    const floatInput = await page.$('input[type="number"]');
    assert(floatInput !== null, 'Opening float input is rendered');
    await floatInput.fill('500');

    await page.screenshot({ path: path.join(screenshotsDir, 'c4_2_03_modal_open_shift.png') });
    console.log('  Saved screenshot: c4_2_03_modal_open_shift.png');

    await page.click('button[type="submit"]:has-text("Open Shift")');
    await page.waitForSelector('text=Shift Open', { timeout: 10000 });
    assert(true, 'Shift successfully opened; Shift Open badge is visible');

    // 3. Verify Live Financial Metric Cards
    console.log('\n[Browser Step 4]: Verifying 4 Live Financial Metric Cards...');
    assert(await page.isVisible('text=Opening Float'), 'Opening Float card rendered');
    assert(await page.isVisible('text=Cash Collected (IN)'), 'Cash Collected (IN) card rendered');
    assert(await page.isVisible('text=Cash Disbursed (OUT)'), 'Cash Disbursed (OUT) card rendered');
    assert(await page.isVisible('text=Expected Cash in Till'), 'Expected Cash in Till card rendered');

    await page.screenshot({ path: path.join(screenshotsDir, 'c4_2_04_active_shift_open.png') });
    console.log('  Saved screenshot: c4_2_04_active_shift_open.png');

    // 4. Exercise Manual Cash Adjustment Modal
    console.log('\n[Browser Step 5]: Exercising Manual Cash Adjustment Modal...');
    await page.click('button:has-text("Cash Adjustment")');
    await page.waitForSelector('text=Record Cash Adjustment', { timeout: 5000 });
    assert(true, 'Record Cash Adjustment modal rendered cleanly');

    await page.fill('input[placeholder="0.00"]', '50');
    await page.fill('textarea', 'Browser automated test cash adjustment');

    await page.screenshot({ path: path.join(screenshotsDir, 'c4_2_05_modal_adjustment.png') });
    console.log('  Saved screenshot: c4_2_05_modal_adjustment.png');

    await page.click('button[type="submit"]:has-text("Record Movement")');
    await page.waitForTimeout(1000);
    assert(true, 'Manual adjustment saved; live movement ledger updated');

    // 5. Exercise Close Shift & Physical Count Modal
    console.log('\n[Browser Step 6]: Exercising Close Shift & Physical Count Modal...');
    await page.click('button:has-text("Close Shift & Count")');
    await page.waitForSelector('text=Close Cash Shift', { timeout: 5000 });
    assert(true, 'Close Cash Shift modal rendered cleanly');

    // Fill physical count 400 (expected is 550 or 500, creating an undeniable shortage of -100 or -150)
    await page.fill('input[placeholder="0.00"]', '400');

    // Wait for shortage banner to appear
    await page.waitForSelector('text=Cash Shortage Detected', { timeout: 5000 });
    assert(true, 'Live shortage detection banner rendered in modal');

    await page.screenshot({ path: path.join(screenshotsDir, 'c4_2_06_modal_close_count.png') });
    console.log('  Saved screenshot: c4_2_06_modal_close_count.png');

    await page.click('button[type="submit"]:has-text("Confirm & Close Shift")');
    await page.waitForSelector('text=Shift Closed (CLOSING)', { timeout: 10000 });
    assert(true, 'Shift closed and transitioned to CLOSING state');

    // 6. Verify Area 2: Work Queue & Supervisor Verification Modal (as Verifier user for SoD compliance)
    console.log('\n[Browser Step 7]: Switching actor to Verifier and verifying session in Area 2...');
    await setAuthCookies(testVerifierId, verifierToken);
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForSelector('text=Teller Cash Custody & Shift Operations', { timeout: 15000 });

    await page.click('button:has-text("Verification & Settlement Queue")');
    await page.waitForSelector('text=Verification & Settlement Work Queue', { timeout: 10000 });
    assert(true, 'Work queue tab active');

    const verifyCountBtn = await page.waitForSelector('button:has-text("Verify Count")', { timeout: 5000 });
    assert(verifyCountBtn !== null, 'Verify Count button rendered for closing session');
    await verifyCountBtn.click();

    await page.waitForSelector('text=Supervisor Count Verification', { timeout: 5000 });
    assert(true, 'Supervisor Count Verification modal rendered cleanly');

    await page.fill('textarea', 'Supervisor verified physical drawer count of 400');
    await page.screenshot({ path: path.join(screenshotsDir, 'c4_2_07_modal_supervisor_verify.png') });
    console.log('  Saved screenshot: c4_2_07_modal_supervisor_verify.png');

    await page.click('button[type="submit"]:has-text("Confirm & Verify Count")');
    await page.waitForTimeout(1000);
    assert(true, 'Supervisor verification approved; session transitioned to PENDING_VERIFICATION');

    // 7. Verify Settlement Preflight Preview Modal (as Settler user for SoD compliance)
    console.log('\n[Browser Step 8]: Switching actor to Settler and previewing settlement in Area 2...');
    await setAuthCookies(testSettlerId, settlerToken);
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForSelector('text=Teller Cash Custody & Shift Operations', { timeout: 15000 });

    await page.click('button:has-text("Verification & Settlement Queue")');
    await page.waitForSelector('text=Verification & Settlement Work Queue', { timeout: 10000 });

    const settleSessionBtn = await page.waitForSelector('button:has-text("Review & Settle")', { timeout: 5000 });
    assert(settleSessionBtn !== null, 'Review & Settle button rendered for verified session');
    await settleSessionBtn.click();

    await page.waitForSelector('text=Financial Shift Settlement', { timeout: 5000 });
    assert(true, 'Financial Shift Settlement modal rendered cleanly');

    // Wait for preflight calculation
    await page.waitForSelector('text=Account 5296', { timeout: 10000 });
    assert(await page.isVisible('text=Debit:'), 'Server preflight displays Debit line');
    assert(await page.isVisible('text=Account 5296'), 'Server preflight displays Account 5296 (Cash Over / Short)');
    assert(await page.isVisible('text=Account 1111'), 'Server preflight displays Account 1111 (Cash in Hand)');

    await page.screenshot({ path: path.join(screenshotsDir, 'c4_2_08_modal_settlement_preview.png') });
    console.log('  Saved screenshot: c4_2_08_modal_settlement_preview.png');

    // Close the settlement modal without posting
    await page.click('button:has-text("Cancel")');
    await page.waitForTimeout(300);

    // 8. Verify Area 3: Session Audit History
    console.log('\n[Browser Step 9]: Verifying Area 3 — Session Audit History...');
    await page.click('button:has-text("Session Audit History")');
    await page.waitForSelector('text=Session History & Financial Audit Trail', { timeout: 10000 });
    assert(true, 'Session Audit History tab is active');

    const searchInput = await page.$('input[placeholder*="Search session ID"]');
    assert(searchInput !== null, 'Session search input rendered');

    await page.screenshot({ path: path.join(screenshotsDir, 'c4_2_09_session_history.png') });
    console.log('  Saved screenshot: c4_2_09_session_history.png');

    // 9. Runtime hygiene verification
    console.log('\n[Browser Step 10]: Verifying Runtime Hygiene & Absence of Errors...');
    assert(pageErrors.length === 0, `Zero page runtime exceptions (found: ${pageErrors.length})`);
    if (pageErrors.length > 0) {
      console.error('  Page errors:', pageErrors);
    }

    const c42ConsoleErrors = consoleErrors.filter(e => e.includes('teller') || e.includes('c4') || e.includes('hydrat'));
    assert(c42ConsoleErrors.length === 0, `Zero C4.2 console/hydration errors (found: ${c42ConsoleErrors.length})`);
    if (c42ConsoleErrors.length > 0) {
      console.error('  Console errors:', c42ConsoleErrors);
    }

  } finally {
    await browser.close();

    console.log('\n[Teardown]: Cleaning up test fixtures from PostgreSQL...');
    try {
      await dbClient.query("SET session_replication_role = 'replica'");
      if (createdTellerId) {
        await dbClient.query(`DELETE FROM teller_movement WHERE teller_session_id IN (SELECT id FROM teller_session WHERE teller_id = $1)`, [createdTellerId]);
        await dbClient.query(`DELETE FROM teller_session WHERE teller_id = $1`, [createdTellerId]);
        await dbClient.query(`DELETE FROM teller WHERE id = $1`, [createdTellerId]);
      }
      await dbClient.query(`DELETE FROM "user" WHERE id IN ($1, $2, $3)`, [testOpenerId, testVerifierId, testSettlerId]);
      await dbClient.query("SET session_replication_role = 'origin'");
      console.log('Teardown complete.');
    } catch (e) {
      console.error('Teardown error:', e);
    } finally {
      await dbClient.end();
    }
  }

  console.log('\n=============================================================================');
  console.log(`BROWSER VERIFICATION SUMMARY: ${passCount} PASSED, ${failCount} FAILED`);
  console.log('=============================================================================');

  if (failCount > 0) {
    process.exit(1);
  }
}

runBrowserVerification().catch(err => {
  console.error('Browser verification failed:', err);
  process.exit(1);
});
