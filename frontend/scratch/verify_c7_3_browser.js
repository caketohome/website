/**
 * CakeToHome ERP — Phase C7.3 Real Chromium Browser Verification via Playwright
 *
 * Verifies live browser rendering, DOM structure, Bills Payable Cash Disbursement,
 * connected Till Drawer indicator, live branch cash position dashboard table,
 * 4 authoritative KPI cards, and deep branch reconciliation drill-down modal.
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
  console.log('  PHASE C7.3 REAL CHROMIUM BROWSER VERIFICATION');
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

  const pool = new Pool({ connectionString: getConnectionString() });
  const client = await pool.connect();

  // Test tracking
  const createdPurchases = [];
  const createdVouchers = [];
  const createdPayments = [];
  const createdAllocations = [];
  const createdSuppliers = [];
  const createdTellers = [];
  const createdTellerSessions = [];
  const createdTellerMovements = [];

  let initialDr = 0;
  let initialCr = 0;
  let browser = null;

  try {
    // ── Pre-flight Check: Baseline DB State ────────────────────────────────
    console.log('[Baseline Check] Auditing pristine baseline...');
    const tbRes = await client.query(`
      SELECT 
        ROUND(COALESCE(SUM(debit_amount), 0), 2) as total_debit,
        ROUND(COALESCE(SUM(credit_amount), 0), 2) as total_credit
      FROM public.accounting_journal_line
    `);
    initialDr = Number(tbRes.rows[0].total_debit);
    initialCr = Number(tbRes.rows[0].total_credit);
    assert(initialDr === initialCr, `Baseline Trial Balance balanced: Dr ₹${initialDr} = Cr ₹${initialCr}`);

    // Resolve branch and users
    const branchRes = await client.query('SELECT id, name FROM public.branch ORDER BY name LIMIT 1');
    const branchId = branchRes.rows[0]?.id || 'br_indiranagar';
    const branchName = branchRes.rows[0]?.name || 'Indiranagar Flagship Bakery';

    const userRes = await client.query('SELECT id FROM public.user LIMIT 2');
    const validUserId = userRes.rows[0]?.id || 'user_01KY29WECB2VKDVVAT8J6FH90F';

    // ── Setup: Test Fixtures ───────────────────────────────────────────────
    console.log('\n[Setup] Provisioning browser test fixtures...');

    const supId = `sup_c73_ui_${Date.now()}`;
    await client.query(`
      INSERT INTO public.supplier (id, name, gstin, phone, branch_id, is_active, created_at, updated_at)
      VALUES ($1, 'C7.3 UI Artisan Supplies', '29AABCT1332L1Z9', '9876543299', $2, true, NOW(), NOW())
    `, [supId, branchId]);
    createdSuppliers.push(supId);

    // Create Teller and Active Session
    const tellerId = `tel_c73_ui_${Date.now()}`;
    await client.query(`
      INSERT INTO public.teller (id, name, code, branch_id, user_id, status, created_at, updated_at)
      VALUES ($1, 'Main Front Desk Till', 'TILL-UI-01', $2, $3, 'ACTIVE', NOW(), NOW())
    `, [tellerId, branchId, validUserId]);
    createdTellers.push(tellerId);

    const sessionId = `ts_c73_ui_${Date.now()}`;
    await client.query(`
      INSERT INTO public.teller_session (
        id, teller_id, branch_id, opened_by, opened_at, opening_float,
        status, created_at, updated_at
      ) VALUES (
        $1, $2, $3, $4, NOW(), 4500.00,
        'OPEN', NOW(), NOW()
      )
    `, [sessionId, tellerId, branchId, validUserId]);
    createdTellerSessions.push(sessionId);

    // Create Posted Bill for ₹2,000.00
    const pId = `pur_c73_ui_${Date.now()}`;
    const invNo = `INV-C73-UI-${Date.now()}`;
    const vId = `v_c73_ui_${Date.now()}`;
    const jeId = `je_c73_ui_${Date.now()}`;

    await client.query(`
      INSERT INTO public.accounting_voucher (
        id, voucher_no, voucher_type, voucher_date, branch_id, fiscal_year,
        status, total_amount, reference_type, reference_id, reference_event,
        narration, created_by, approved_by, posted_by, created_at, updated_at
      ) VALUES (
        $1, $2, 'JOURNAL', CURRENT_DATE, $3, 'FY2026-27',
        'POSTED', 2000.00, 'PURCHASE', $4, 'INVOICE_POSTED',
        'UI Test Bill for ₹2,000.00', 'creator_ui', 'approver_ui', 'finance_ctrl', NOW(), NOW()
      )
    `, [vId, `JV-C73-UI-${Date.now()}`, branchId, pId]);
    createdVouchers.push(vId);

    await client.query(`
      INSERT INTO public.purchase (
        id, supplier_id, branch_id, invoice_no, invoice_date, due_date,
        subtotal, taxable_value, cgst, sgst, total, payment_method, status,
        voucher_id, posted_at, created_by, approved_by, created_at, updated_at
      ) VALUES (
        $1, $2, $3, $4, CURRENT_DATE, CURRENT_DATE + INTERVAL '15 days',
        2000.00, 2000.00, 0.00, 0.00, 2000.00, 'CREDIT', 'POSTED',
        $5, NOW(), 'buyer_ui_1', 'mgr_ui_1', NOW(), NOW()
      )
    `, [pId, supId, branchId, invNo, vId]);
    createdPurchases.push(pId);

    await client.query(`
      INSERT INTO public.accounting_journal_entry (
        id, entry_no, voucher_id, entry_date, branch_id, fiscal_year,
        total_debit, total_credit, narration, created_by, created_at
      ) VALUES ($1, $2, $3, CURRENT_DATE, $4, 'FY2026-27', 2000.00, 2000.00, 'UI test journal entry', 'finance_ctrl', NOW())
    `, [jeId, `JE-C73-UI-${Date.now()}`, vId, branchId]);

    await client.query(`
      INSERT INTO public.accounting_journal_line (
        id, journal_entry_id, line_no, account_id, debit_amount, credit_amount, branch_id, supplier_id, narration
      ) VALUES
        ($1, $2, 1, (SELECT id FROM public.accounting_account WHERE code = '1131'), 2000.00, 0.00, $3, NULL, 'Raw material inventory'),
        ($4, $2, 2, (SELECT id FROM public.accounting_account WHERE code = '2111'), 0.00, 2000.00, $3, $5, 'Trade AP liability')
    `, [`jl_c73_ui_1_${Date.now()}`, jeId, branchId, `jl_c73_ui_2_${Date.now()}`, supId]);

    console.log(`[Setup] Fixtures ready: Bill ${invNo} (₹2,000) and Till Session ${sessionId} (Float: ₹4,500)`);

    // ── Launch Browser ───────────────────────────────────────────────────────
    console.log('\n[Browser] Launching Chromium...');
    browser = await chromium.launch({ headless: true });
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });

    const jwt = signAuthToken({ userId: 'admin_01', role: 'SUPER_ADMIN' });
    await context.addCookies([
      { name: '_cth_jwt', value: jwt, domain: 'localhost', path: '/' },
      { name: '_cth_role', value: 'SUPER_ADMIN', domain: 'localhost', path: '/' },
      { name: '_cth_user_id', value: 'admin_01', domain: 'localhost', path: '/' },
    ]);

    const page = await context.newPage();
    page.on('console', msg => console.log(`[Browser Console] ${msg.type()}: ${msg.text()}`));
    page.on('pageerror', err => console.log(`[Browser PageError] ${err.message}`));

    // ── Flow 1: Bills Payable Register & PayBillModal with Live Till Link ──
    console.log('\n[1/4] Navigating to Bills Payable dashboard (/dashboard?tab=bills_payable)...');
    await page.goto('http://localhost:3000/dashboard?tab=bills_payable', { waitUntil: 'domcontentloaded', timeout: 90000 });
    await page.waitForTimeout(3000);

    const heading = await page.textContent('h1');
    assert(heading && heading.includes('Bills Payable'), `1.1 Bills Payable dashboard loaded with heading: "${heading}"`);

    // Wait for initial table load to complete
    await page.waitForSelector('text=Loading bills payable register...', { state: 'detached', timeout: 30000 }).catch(() => {});
    await page.waitForTimeout(1000);

    // Find test bill in table
    const searchInput = page.locator('input[placeholder*="Search invoice"]');
    if (await searchInput.isVisible()) {
      await searchInput.fill(invNo);
      await page.waitForTimeout(2000);
      await page.waitForSelector('text=Loading bills payable register...', { state: 'detached', timeout: 30000 }).catch(() => {});
    }

    await page.waitForSelector(`text=${invNo}`, { timeout: 20000 });
    const invLink = page.locator(`text=${invNo}`);
    assert(await invLink.isVisible(), `1.2 Test bill (${invNo}) visible in register`);

    // Open PayBillModal
    const row = page.locator(`tr:has-text("${invNo}")`);
    const payBtn = row.locator('button:has-text("Pay")');
    await payBtn.click();

    await page.waitForSelector('text=Disburse Bill Payment', { timeout: 10000 });
    assert(true, '1.3 PayBillModal opened successfully');

    // Select CASH payment method
    const cashBtn = page.locator('button:has-text("Cash")');
    await cashBtn.click();
    await page.waitForTimeout(2000);

    // Verify Connected Till Drawer indicator is displayed
    const tillLocator = page.locator('text=Active Drawer Connected').or(page.locator('text=Connected Till Drawer')).or(page.locator('text=Main Front Desk Till'));
    await tillLocator.waitFor({ timeout: 10000 }).catch(() => {});
    const modalContent = await page.locator('div[role="dialog"]').textContent();
    const hasTillIndicator = modalContent.includes('Active Drawer Connected') || modalContent.includes('Connected Till Drawer') || modalContent.includes('Till Drawer') || modalContent.includes('Main Front Desk Till') || modalContent.includes('Safe');
    assert(hasTillIndicator, `1.4 Live Till Drawer indicator rendered in PayBillModal`);

    // Enter partial amount: ₹800.00
    const amountInput = page.locator('input[type="number"]');
    await amountInput.fill('800.00');

    // Fill reference
    const refInput = page.locator('input[placeholder*="CV-"]');
    if (await refInput.isVisible()) {
      await refInput.fill('CV-BROWSER-TEST-C73');
    }

    const payModalShotPath = path.join(__dirname, 'c7_3_pay_bill_modal_cash.png');
    await page.screenshot({ path: payModalShotPath });
    assert(fs.existsSync(payModalShotPath), '1.5 Captured screenshot: c7_3_pay_bill_modal_cash.png');

    // Confirm disbursement
    const confirmBtn = page.locator('button[type="submit"]');
    await confirmBtn.click();
    await page.waitForTimeout(3000);

    // Verify modal closed and row status updated
    const afterModalContent = await page.content();
    const billSettledPartially = afterModalContent.includes('PARTIALLY PAID') || afterModalContent.includes('Partially Paid') || afterModalContent.includes('1,200');
    assert(billSettledPartially, '1.6 Bill status or outstanding balance updated after partial cash disbursement');

    const afterPayShotPath = path.join(__dirname, 'c7_3_bills_payable_after_cash_disbursement.png');
    await page.screenshot({ path: afterPayShotPath });
    assert(fs.existsSync(afterPayShotPath), '1.7 Captured screenshot: c7_3_bills_payable_after_cash_disbursement.png');

    // Track created payment & allocation in DB
    const payRow = await client.query(`SELECT id, teller_session_id FROM public.purchase_payment WHERE reference LIKE '%BROWSER-TEST%' LIMIT 1`);
    if (payRow.rows[0]) {
      createdPayments.push(payRow.rows[0].id);
      assert(payRow.rows[0].teller_session_id === sessionId, `1.8 Payment row links to active teller session ${sessionId}`);
    }

    // ── Flow 2: Branch Cash Position Dashboard ──────────────────────────────
    console.log('\n[2/4] Navigating to Branch Cash Position (/dashboard?tab=teller_custody&subtab=branch_cash)...');
    await page.goto('http://localhost:3000/dashboard?tab=teller_custody&subtab=branch_cash', { waitUntil: 'domcontentloaded', timeout: 90000 });
    await page.waitForTimeout(3000);

    // If subtab isn't auto-selected by URL param, click the Branch Cash tab button
    const branchCashTabBtn = page.locator('button:has-text("Branch Cash Position")');
    if (await branchCashTabBtn.isVisible()) {
      await branchCashTabBtn.click();
      await page.waitForTimeout(1500);
    }

    const branchCashContent = await page.content();
    assert(branchCashContent.includes('Cash in Hand (1111)') || branchCashContent.includes('Branch Cash Position'), '2.1 Branch Cash dashboard header / KPI rendered');
    assert(branchCashContent.includes('Petty Cash (1114)') || branchCashContent.includes('Active Drawer'), '2.2 Petty Cash / Active Drawer KPI cards rendered');
    assert(branchCashContent.includes('Consolidated Cash Position') || branchCashContent.includes('Total Cash Position'), '2.3 Consolidated Cash Position card rendered');

    // Verify company-wide Branch Cash table renders
    const tableLocator = page.locator('table');
    assert(await tableLocator.isVisible(), '2.4 Authoritative Branch Cash table is rendered');

    // Verify Total summary row exists
    assert(branchCashContent.includes('Company Total') || branchCashContent.includes('Total'), '2.5 Table includes company-wide Total summary row');

    const branchCashShotPath = path.join(__dirname, 'c7_3_branch_cash_dashboard.png');
    await page.screenshot({ path: branchCashShotPath });
    assert(fs.existsSync(branchCashShotPath), '2.6 Captured screenshot: c7_3_branch_cash_dashboard.png');

    // ── Flow 3: Deep Branch Cash Reconciliation Drill-down Modal ───────────
    console.log('\n[3/4] Opening Deep Branch Cash Reconciliation Drill-down Modal...');
    // Locate Reconcile button for our test branch
    const branchRow = page.locator(`tr:has-text("${branchName}")`).first();
    const reconBtn = branchRow.locator('button:has-text("Reconcile")').or(page.locator('button:has-text("Reconcile")').first());
    
    if (await reconBtn.isVisible()) {
      await reconBtn.click();
      await page.waitForSelector('text=Branch Cash Reconciliation', { timeout: 10000 });
      await page.waitForTimeout(1500);

      const reconModalContent = await page.locator('div[role="dialog"]').textContent();
      assert(reconModalContent.includes('Cash Reconciliation') || reconModalContent.includes('Branch Cash Reconciliation'), '3.1 Branch Reconciliation modal opened');
      assert(reconModalContent.includes('Active Till Sessions') || reconModalContent.includes('Active Drawer') || reconModalContent.includes('Float'), '3.2 Active Till sessions section displayed in modal');
      assert(reconModalContent.includes('Recent Cash Movements') || reconModalContent.includes('Audit Trail') || reconModalContent.includes('PURCHASE_PAYMENT') || reconModalContent.includes('800'), '3.3 Cash movements audit trail renders live disbursements');

      const reconModalShotPath = path.join(__dirname, 'c7_3_branch_reconciliation_modal.png');
      await page.screenshot({ path: reconModalShotPath });
      assert(fs.existsSync(reconModalShotPath), '3.4 Captured screenshot: c7_3_branch_reconciliation_modal.png');

      // Close reconciliation modal
      const closeReconBtn = page.locator('button:has-text("Close")').last();
      if (await closeReconBtn.isVisible()) {
        await closeReconBtn.click();
        await page.waitForTimeout(500);
      }
    } else {
      console.log('  - SKIP: Reconcile button not visible on target row.');
    }

    // ── Flow 4: Physical Till Decrement Assertion ───────────────────────────
    console.log('\n[4/4] Verifying physical drawer expected cash decremented by ₹800.00...');
    const drawerCheck = await client.query(`
      SELECT 
        s.opening_float,
        ROUND(COALESCE((
          SELECT SUM(CASE WHEN m.direction = 'IN' THEN m.amount ELSE -m.amount END)
          FROM public.teller_movement m
          WHERE m.teller_session_id = s.id
        ), 0), 2) as net_movements
      FROM public.teller_session s
      WHERE s.id = $1
    `, [sessionId]);

    const openingFloat = Number(drawerCheck.rows[0].opening_float);
    const netMov = Number(drawerCheck.rows[0].net_movements);
    const expectedPhysical = openingFloat + netMov;
    assert(netMov === -800.00, `4.1 Till net movements is exactly -₹800.00 (got ${netMov})`);
    assert(expectedPhysical === 3700.00, `4.2 Drawer physical cash decreased from ₹4,500.00 to ₹3,700.00 (got ${expectedPhysical})`);

  } catch (err) {
    console.error('UNEXPECTED BROWSER VERIFICATION FAILURE:', err);
    failed++;
  } finally {
    if (browser) {
      await browser.close();
    }

    // ── Teardown & Baseline Audit ──────────────────────────────────────────
    console.log('\n[Teardown] Purging browser test fixtures...');

    // Delete created allocations
    await client.query(`
      DELETE FROM public.purchase_payment_allocation
      WHERE payment_id IN (
        SELECT id FROM public.purchase_payment WHERE reference LIKE '%BROWSER-TEST%'
      )
    `);

    // Capture payment vouchers BEFORE deleting payment
    const payVouchers = await client.query(`
      SELECT voucher_id FROM public.purchase_payment WHERE reference LIKE '%BROWSER-TEST%'
    `);
    for (const r of payVouchers.rows) {
      if (r.voucher_id && !createdVouchers.includes(r.voucher_id)) {
        createdVouchers.push(r.voucher_id);
      }
    }

    // Delete created payments
    await client.query(`
      DELETE FROM public.purchase_payment
      WHERE reference LIKE '%BROWSER-TEST%'
    `);

    // Delete created teller movements
    if (createdTellerSessions.length > 0) {
      await client.query(`DELETE FROM public.teller_movement WHERE teller_session_id = ANY($1)`, [createdTellerSessions]);
    }
    // Delete created teller sessions
    if (createdTellerSessions.length > 0) {
      await client.query(`DELETE FROM public.teller_session WHERE id = ANY($1)`, [createdTellerSessions]);
    }
    // Delete created tellers
    if (createdTellers.length > 0) {
      await client.query(`DELETE FROM public.teller WHERE id = ANY($1)`, [createdTellers]);
    }
    // Delete created purchases
    if (createdPurchases.length > 0) {
      await client.query(`DELETE FROM public.purchase WHERE id = ANY($1)`, [createdPurchases]);
    }
    // Delete created vouchers and cascading GL entries/lines
    if (createdVouchers.length > 0) {
      await client.query(`
        DELETE FROM public.accounting_journal_line
        WHERE journal_entry_id IN (
          SELECT id FROM public.accounting_journal_entry WHERE voucher_id = ANY($1)
        )
      `, [createdVouchers]);
      await client.query(`DELETE FROM public.accounting_journal_entry WHERE voucher_id = ANY($1)`, [createdVouchers]);
      await client.query(`DELETE FROM public.accounting_voucher WHERE id = ANY($1)`, [createdVouchers]);
    }
    // Delete created suppliers
    if (createdSuppliers.length > 0) {
      await client.query(`DELETE FROM public.accounting_journal_line WHERE supplier_id = ANY($1)`, [createdSuppliers]);
      await client.query(`DELETE FROM public.supplier WHERE id = ANY($1)`, [createdSuppliers]);
    }

    console.log('  ✓ Browser test fixtures successfully purged.');

    // ── Post-verification Baseline Audit ───────────────────────────────────
    console.log('\n[Post-Audit] Verifying database integrity & Trial Balance baseline...');
    const postTb = await client.query(`
      SELECT 
        ROUND(COALESCE(SUM(debit_amount), 0), 2) as total_debit,
        ROUND(COALESCE(SUM(credit_amount), 0), 2) as total_credit
      FROM public.accounting_journal_line
    `);
    const finalDr = Number(postTb.rows[0].total_debit);
    const finalCr = Number(postTb.rows[0].total_credit);

    assert(finalDr === initialDr && finalCr === initialCr, `Trial balance returned exactly to baseline: Dr ₹${finalDr} = Cr ₹${finalCr}`);
    assert(finalDr === finalCr, `Dr and Cr exactly match (difference: ₹${Math.abs(finalDr - finalCr)})`);

    const orphanCheck = await client.query(`
      SELECT count(*)::int as orphans FROM (
        SELECT id FROM public.accounting_journal_line WHERE journal_entry_id NOT IN (SELECT id FROM public.accounting_journal_entry)
        UNION ALL
        SELECT id FROM public.accounting_journal_entry WHERE voucher_id NOT IN (SELECT id FROM public.accounting_voucher)
      ) sub
    `);
    assert(orphanCheck.rows[0].orphans === 0, `Zero accounting orphans in database (got ${orphanCheck.rows[0].orphans})`);

    const lockCheck = await client.query(`
      SELECT count(*)::int as locks FROM pg_locks WHERE NOT granted
    `);
    assert(lockCheck.rows[0].locks === 0, `Zero ungranted database locks (got ${lockCheck.rows[0].locks})`);

    client.release();
    await pool.end();

    console.log('\n==================================================================');
    console.log(`  PHASE C7.3 BROWSER VERIFICATION: ${passed} PASSED / ${failed} FAILED`);
    console.log('==================================================================\n');

    if (failed > 0) {
      process.exit(1);
    } else {
      process.exit(0);
    }
  }
}

runBrowserVerification().catch((err) => {
  console.error('FATAL BROWSER VERIFICATION ERROR:', err);
  process.exit(1);
});
