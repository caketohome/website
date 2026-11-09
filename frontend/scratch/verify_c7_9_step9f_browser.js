/**
 * CakeToHome ERP — Phase C7.9 Step 9F Real Chromium Browser E2E Verification
 *
 * Verifies live browser rendering, DOM structure, Corporate Accounts panel,
 * account registration modal, four-eyes approval dialog, employee roster table,
 * coordinates verification badge, bulk roster import wizard with template download,
 * and clean database teardown.
 */

const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const { Pool } = require('pg');
const assert = require('assert');

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
    permissions: payload.permissions,
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
  console.log("==================================================================");
  console.log("  CAKETOHOME ERP — PHASE C7.9 STEP 9F: BROWSER E2E VERIFICATION   ");
  console.log("==================================================================\n");

  const connStr = getConnectionString();
  const pool = new Pool({
    connectionString: connStr,
    ssl: connStr.includes('supabase') ? { rejectUnauthorized: false } : false,
    max: 5,
  });

  const createdAccountIds = [];
  const createdCustomerIds = [];
  const createdUserIds = [];

  let browser = null;

  try {
    // -------------------------------------------------------------------------
    // PREFLIGHT
    // -------------------------------------------------------------------------
    const coaRes = await pool.query(`SELECT count(*)::int as count FROM public.accounting_account;`);
    assert.strictEqual(coaRes.rows[0].count, 100, `CoA baseline strictly 100 (actual: ${coaRes.rows[0].count})`);

    const tbRes = await pool.query(`
      SELECT 
        COALESCE(SUM(debit_amount), 0)::numeric(12,2) AS total_dr,
        COALESCE(SUM(credit_amount), 0)::numeric(12,2) AS total_cr
      FROM public.accounting_journal_line;
    `);
    const preDr = Number(tbRes.rows[0].total_dr);
    const preCr = Number(tbRes.rows[0].total_cr);
    assert.strictEqual(preDr, preCr, "Trial balance must be balanced");
    assert.strictEqual(preDr, 3380.00, "Trial balance must be 3380.00");

    console.log(`  [PREFLIGHT] CoA: 100 | TB: Dr ₹${preDr.toFixed(2)} = Cr ₹${preCr.toFixed(2)} | Baseline Intact\n`);

    // -------------------------------------------------------------------------
    // FIXTURES & ACTOR USERS
    // -------------------------------------------------------------------------
    const tsSuffix = Date.now().toString().slice(-6);
    const panDigits = tsSuffix.slice(-4);
    const gstin = `29AAACF${panDigits}K1Z5`;
    const pan = `AAACF${panDigits}K`;

    const adminUserRes = await pool.query(`SELECT id FROM public."user" WHERE email = 'admin@cakes2home.com' LIMIT 1;`);
    const adminUserId = adminUserRes.rows[0]?.id || 'user_01KY2P5955X24AT3X5R94H1G59';

    const makerUserId = `usr_maker_${tsSuffix}`;
    await pool.query(`
      INSERT INTO public."user" (id, email, first_name, last_name, created_at, updated_at)
      VALUES ($1, $2, 'Roster', 'Maker', NOW(), NOW())
      ON CONFLICT (id) DO NOTHING;
    `, [makerUserId, `${makerUserId}@cakes2home.com`]);
    createdUserIds.push(makerUserId);

    // -------------------------------------------------------------------------
    // BROWSER LAUNCH
    // -------------------------------------------------------------------------
    console.log('[Browser] Launching Chromium browser via Playwright...');
    browser = await chromium.launch({ headless: true });
    const context = await browser.newContext({ viewport: { width: 1440, height: 950 } });

    // Inject Super Admin Session
    const jwtAdmin = signAuthToken({ userId: adminUserId, role: 'SUPER_ADMIN' });
    await context.addCookies([
      { name: '_cth_jwt', value: jwtAdmin, domain: 'localhost', path: '/' },
      { name: '_cth_role', value: 'SUPER_ADMIN', domain: 'localhost', path: '/' },
      { name: '_cth_user_id', value: adminUserId, domain: 'localhost', path: '/' },
    ]);

    const page = await context.newPage();
    page.on('console', msg => {
      const text = msg.text();
      if (!text.includes('React DevTools') && !text.includes('Fast Refresh') && !text.includes('Download the React')) {
        console.log(`[Browser Console] ${msg.type()}: ${text}`);
      }
    });

    page.on('response', async res => {
      if (res.status() >= 400) {
        try {
          const body = await res.text();
          console.log(`[API Error ${res.status()}] ${res.url()} => ${body}`);
        } catch {}
      }
    });

    // -------------------------------------------------------------------------
    // FLOW 1: Navigate to Corporate Accounts Panel
    // -------------------------------------------------------------------------
    console.log('\n[Flow 1] Navigating to Corporate Accounts & Roster Panel...');
    const appUrl = 'http://localhost:3000/dashboard?tab=corporate_accounts';
    await page.goto(appUrl, { waitUntil: 'domcontentloaded', timeout: 120000 });
    await page.waitForSelector('text=Corporate Account Master', { timeout: 30000 });
    await page.waitForTimeout(2000);

    const bodyText = await page.content();
    assert(bodyText.includes("Corporate Account Master") && bodyText.includes("Roster"), 'Header: "Corporate Account Master & Roster" rendered');
    assert(bodyText.includes("Register Account"), 'Action: "Register Account" button rendered');

    // Screenshot 1: Accounts Directory
    const shot1Path = path.join(__dirname, 'c7_9_step9f_01_accounts_directory.png');
    await page.screenshot({ path: shot1Path });
    console.log(`  📸 Screenshot saved: ${shot1Path}`);
    assert(fs.existsSync(shot1Path), 'Screenshot 1 captured');

    // -------------------------------------------------------------------------
    // FLOW 2: Register Corporate Account via UI
    // -------------------------------------------------------------------------
    console.log('\n[Flow 2] Registering corporate account master via UI...');
    await page.getByRole('button', { name: 'Register Account' }).click();
    await page.waitForTimeout(500);

    // Fill form
    await page.getByPlaceholder('e.g. Tata Consultancy Services Ltd').fill(`Federal Corp ${tsSuffix} Pvt Ltd`);
    await page.getByPlaceholder('e.g. TCS Global').fill(`Federal Corp`);
    await page.getByPlaceholder('29AABCT1332L1ZV', { exact: true }).fill(gstin);
    await page.getByPlaceholder('AABCT1332L', { exact: true }).fill(pan);
    await page.getByPlaceholder('Contact Name').fill('Rajiv Nambiar');
    await page.getByPlaceholder('Email').fill(`rajiv_${tsSuffix}@federal.corp`);
    await page.getByPlaceholder('Phone').fill('9812345678');

    await page.getByRole('button', { name: 'Create Draft Master' }).click();
    
    // Poll for account creation in database
    let acctRes;
    for (let attempt = 0; attempt < 20; attempt++) {
      await page.waitForTimeout(500);
      acctRes = await pool.query(`SELECT id, customer_id, status FROM public.corporate_account WHERE gstin = $1`, [gstin]);
      if (acctRes.rows.length > 0) break;
    }
    assert.strictEqual(acctRes.rows.length, 1, "Account created in database");
    const accountId = acctRes.rows[0].id;
    const customerId = acctRes.rows[0].customer_id;
    createdAccountIds.push(accountId);
    createdCustomerIds.push(customerId);
    assert.strictEqual(acctRes.rows[0].status, 'PENDING', "Initial status is PENDING");
    console.log(`  ✓ Account registered: ${accountId} (Customer: ${customerId})`);

    // Screenshot 2: Account Profile Card
    const shot2Path = path.join(__dirname, 'c7_9_step9f_02_account_profile.png');
    await page.screenshot({ path: shot2Path });
    console.log(`  📸 Screenshot saved: ${shot2Path}`);
    assert(fs.existsSync(shot2Path), 'Screenshot 2 captured');

    // -------------------------------------------------------------------------
    // FLOW 3: Four-Eyes Approval & SoD Defense
    // -------------------------------------------------------------------------
    console.log('\n[Flow 3] Executing Four-Eyes Approval with Segregation of Duties (SoD) testing...');
    const approveBtn = page.getByRole('button', { name: 'Approve Account' });
    if (await approveBtn.isVisible()) {
      await approveBtn.click();
      await page.waitForTimeout(500);

      // Verify modal text
      const modalContent = await page.content();
      assert(modalContent.includes("Four-Eyes Approval: Corporate Account"), "Approval dialog rendered");
      assert(modalContent.includes("Segregation of Duties Enforcement"), "SoD notice displayed");

      // Attempt 1: Creator self-approval (MUST BE REJECTED by Four-Eyes SoD guard)
      console.log('  Testing Maker-Checker defense (creator self-approval attempt)...');
      await page.getByRole('button', { name: 'Confirm Four-Eyes Approval' }).click();
      await page.waitForTimeout(1500);

      const afterSelfApprove = await pool.query(`SELECT status FROM public.corporate_account WHERE id = $1`, [accountId]);
      assert.strictEqual(afterSelfApprove.rows[0].status, 'PENDING', "Account remains PENDING due to SoD rejection");
      console.log('  ✓ SoD Defense Verified: Self-approval blocked');

      // Now simulate draft created by maker 'makerUserId', approved by independent Super Admin checker
      await pool.query(`UPDATE public.corporate_account SET created_by = $1 WHERE id = $2`, [makerUserId, accountId]);

      // Re-trigger approval dialog as independent checker if closed
      const confirmApproveBtn = page.getByRole('button', { name: 'Confirm Four-Eyes Approval' });
      if (!await confirmApproveBtn.isVisible()) {
        const reApproveBtn = page.getByRole('button', { name: 'Approve Account' });
        if (await reApproveBtn.isVisible()) {
          await reApproveBtn.click();
          await page.waitForTimeout(500);
        }
      }
      await page.getByRole('button', { name: 'Confirm Four-Eyes Approval' }).click();
      await page.waitForTimeout(3000);

      const approvedCheck = await pool.query(`SELECT status, approved_by FROM public.corporate_account WHERE id = $1`, [accountId]);
      assert.strictEqual(approvedCheck.rows[0].status, 'APPROVED', "Account status transitioned to APPROVED");
      console.log(`  ✓ Four-Eyes Approval Verified: Status is now APPROVED (Approved By: ${approvedCheck.rows[0].approved_by})`);
    }

    // Screenshot 3: Approved Account with Credit Governance
    const shot3Path = path.join(__dirname, 'c7_9_step9f_03_account_approved.png');
    await page.screenshot({ path: shot3Path });
    console.log(`  📸 Screenshot saved: ${shot3Path}`);
    assert(fs.existsSync(shot3Path), 'Screenshot 3 captured');

    // -------------------------------------------------------------------------
    // FLOW 4: Add Employee to Roster & Verify Coordinates
    // -------------------------------------------------------------------------
    console.log('\n[Flow 4] Adding employee to roster and verifying coordinates...');
    await page.getByRole('button', { name: 'Add Employee' }).click();
    await page.waitForTimeout(500);

    const empCode = `EMP-FED-${panDigits}`;
    await page.getByPlaceholder('e.g. EMP-101').fill(empCode);
    await page.getByPlaceholder('e.g. Anita Desai').fill('Kavita Verma');
    await page.getByPlaceholder('9876543210').fill('9876543210');
    await page.getByPlaceholder('anita@corp.com').fill(`kavita_${tsSuffix}@federal.corp`);
    await page.getByPlaceholder('Engineering').fill('Operations');
    await page.getByPlaceholder('Lead Architect').fill('Logistics Manager');
    await page.getByPlaceholder('12.9716').fill('12.9716');
    await page.getByPlaceholder('77.5946').fill('77.5946');

    await page.getByRole('button', { name: 'Enroll Employee' }).click();
    await page.waitForTimeout(3000);

    const empRes = await pool.query(`SELECT id, employee_code, coordinate_verified FROM public.corporate_employee WHERE account_id = $1`, [accountId]);
    assert.strictEqual(empRes.rows.length, 1, "Employee enrolled in roster");
    console.log(`  ✓ Employee created: ${empRes.rows[0].employee_code}`);

    // Verify Coordinates via UI
    const verifyCoordsBtn = page.getByRole('button', { name: 'Verify' });
    if (await verifyCoordsBtn.isVisible()) {
      await verifyCoordsBtn.click();
      await page.waitForTimeout(2000);
      const coordCheck = await pool.query(`SELECT coordinate_verified, coordinate_verified_by FROM public.corporate_employee WHERE id = $1`, [empRes.rows[0].id]);
      assert.strictEqual(coordCheck.rows[0].coordinate_verified, true, "Coordinates verified by Super Admin");
      console.log(`  ✓ Coordinates verified: verified_by = ${coordCheck.rows[0].coordinate_verified_by}`);
    }

    // Screenshot 4: Employee Roster View
    const shot4Path = path.join(__dirname, 'c7_9_step9f_04_roster_management.png');
    await page.screenshot({ path: shot4Path });
    console.log(`  📸 Screenshot saved: ${shot4Path}`);
    assert(fs.existsSync(shot4Path), 'Screenshot 4 captured');

    // -------------------------------------------------------------------------
    // FLOW 5: Bulk Import Wizard & Template Download
    // -------------------------------------------------------------------------
    console.log('\n[Flow 5] Opening Bulk Roster Import Wizard...');
    await page.getByRole('button', { name: 'Bulk Import', exact: true }).click();
    await page.waitForTimeout(1000);

    const importModalText = await page.content();
    assert(importModalText.includes("Bulk Employee Roster Import Wizard"), "Import modal rendered");
    assert(importModalText.includes("Download Standard Template"), "Template download section rendered");
    assert(importModalText.includes("Validate Workbook (Read-Only)"), "Dry-run validation action rendered");

    // Screenshot 5: Bulk Import Wizard
    const shot5Path = path.join(__dirname, 'c7_9_step9f_05_bulk_import_wizard.png');
    await page.screenshot({ path: shot5Path });
    console.log(`  📸 Screenshot saved: ${shot5Path}`);
    assert(fs.existsSync(shot5Path), 'Screenshot 5 captured');

    console.log("\n  ✓ ALL BROWSER E2E FLOWS COMPLETED SUCCESSFULLY!");
  } finally {
    if (browser) {
      await browser.close();
    }

    // -------------------------------------------------------------------------
    // CLEANUP & TEARDOWN
    // -------------------------------------------------------------------------
    console.log('\n[Teardown] Cleaning test fixtures with replica role...');
    const client = await pool.connect();
    try {
      await client.query("SET session_replication_role = 'replica';");
      if (createdAccountIds.length > 0) {
        await client.query("DELETE FROM public.corporate_employee_event WHERE account_id = ANY($1);", [createdAccountIds]);
        await client.query("DELETE FROM public.corporate_account_event WHERE account_id = ANY($1);", [createdAccountIds]);
        await client.query("DELETE FROM public.corporate_employee_import_batch WHERE account_id = ANY($1);", [createdAccountIds]);
        await client.query("DELETE FROM public.corporate_employee WHERE account_id = ANY($1);", [createdAccountIds]);
        await client.query("DELETE FROM public.corporate_account_member WHERE account_id = ANY($1);", [createdAccountIds]);
        await client.query("DELETE FROM public.corporate_account_contact WHERE account_id = ANY($1);", [createdAccountIds]);
        await client.query("DELETE FROM public.corporate_account WHERE id = ANY($1);", [createdAccountIds]);
      }
      // Safety sweep for test fixtures by pattern
      await client.query("DELETE FROM public.corporate_employee_event WHERE account_id IN (SELECT id FROM public.corporate_account WHERE legal_name LIKE 'Federal Corp%');");
      await client.query("DELETE FROM public.corporate_employee WHERE account_id IN (SELECT id FROM public.corporate_account WHERE legal_name LIKE 'Federal Corp%');");
      await client.query("DELETE FROM public.corporate_account_event WHERE account_id IN (SELECT id FROM public.corporate_account WHERE legal_name LIKE 'Federal Corp%');");
      await client.query("DELETE FROM public.corporate_account_contact WHERE account_id IN (SELECT id FROM public.corporate_account WHERE legal_name LIKE 'Federal Corp%');");
      await client.query("DELETE FROM public.corporate_account_member WHERE account_id IN (SELECT id FROM public.corporate_account WHERE legal_name LIKE 'Federal Corp%');");
      await client.query("DELETE FROM public.corporate_account WHERE legal_name LIKE 'Federal Corp%';");
      await client.query("DELETE FROM public.customer WHERE company_name LIKE 'Federal Corp%';");

      if (createdCustomerIds.length > 0) {
        await client.query("DELETE FROM public.customer WHERE id = ANY($1);", [createdCustomerIds]);
      }
      if (createdUserIds.length > 0) {
        await client.query('DELETE FROM public."user" WHERE id = ANY($1);', [createdUserIds]);
      }
      await client.query("DELETE FROM public.\"user\" WHERE id LIKE 'usr_maker_%';");
      await client.query("SET session_replication_role = 'origin';");
      console.log('  ✓ Teardown successful: All test fixtures cleanly removed');
    } finally {
      client.release();
    }

    // -------------------------------------------------------------------------
    // POSTFLIGHT AUDIT
    // -------------------------------------------------------------------------
    const [coaCheck, vCheck, jeCheck, jlCheck, tbCheck, caCheck] = await Promise.all([
      pool.query('SELECT count(*)::int as count FROM public.accounting_account;'),
      pool.query('SELECT count(*)::int as count FROM public.accounting_voucher;'),
      pool.query('SELECT count(*)::int as count FROM public.accounting_journal_entry;'),
      pool.query('SELECT count(*)::int as count FROM public.accounting_journal_line;'),
      pool.query('SELECT COALESCE(SUM(debit_amount),0)::numeric(12,2) as dr, COALESCE(SUM(credit_amount),0)::numeric(12,2) as cr FROM public.accounting_journal_line;'),
      pool.query('SELECT count(*)::int as count FROM public.corporate_account;'),
    ]);

    assert.strictEqual(coaCheck.rows[0].count, 100, "CoA remains strictly 100");
    assert.strictEqual(vCheck.rows[0].count, 6, "Vouchers remain 6");
    assert.strictEqual(jeCheck.rows[0].count, 4, "JEs remain 4");
    assert.strictEqual(jlCheck.rows[0].count, 10, "JLs remain 10");
    assert.strictEqual(Number(tbCheck.rows[0].dr), 3380.00, "TB Debit remains 3380.00");
    assert.strictEqual(Number(tbCheck.rows[0].cr), 3380.00, "TB Credit remains 3380.00");
    assert.strictEqual(caCheck.rows[0].count, 0, "Corporate tables cleanly 0 rows");

    console.log(`  ✓ Postflight Audit: CoA = 100 | Vouchers = 6 | JEs = 4 | JLs = 10 | TB = ₹3380.00 | Corp Tables = 0 rows`);
    await pool.end();
  }
}

runBrowserVerification().catch(err => {
  console.error("FATAL BROWSER E2E ERROR:", err);
  process.exit(1);
});
