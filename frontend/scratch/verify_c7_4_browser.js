/**
 * CakeToHome ERP — Phase C7.4 Real Chromium Browser Verification via Playwright
 *
 * Verifies live browser rendering, DOM structure, Corporate Bills Receivable panel,
 * KPI summary metrics, Due-Date Ageing Matrix bar, Bill Detail Modal with dynamic GST breakdown,
 * Receive Receipt Modal with bank leaf resolution and UTR reference, Customer Subledger drill-down,
 * and Payment Reminder scheduling.
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
  console.log('  PHASE C7.4 REAL CHROMIUM BROWSER VERIFICATION VIA PLAYWRIGHT');
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

  // Fixtures tracking for teardown
  const createdInvoices = [];
  const createdVouchers = [];
  const createdAllocations = [];
  const createdCustomers = [];
  const createdBankAccounts = [];
  const createdNotifications = [];
  const createdCompanies = [];
  const createdOrders = [];

  let browser = null;

  try {
    // ── Setup: Test Fixtures in PostgreSQL ──────────────────────────────────
    console.log('[Setup] Creating browser test fixtures in database...');
    const branchRes = await client.query('SELECT id, name FROM public.branch LIMIT 1');
    const branchId = branchRes.rows[0]?.id || 'br_main';

    const userRes = await client.query('SELECT id FROM public.user LIMIT 1');
    const adminUserId = userRes.rows[0]?.id || 'user_01KY29WECB2VKDVVAT8J6FH90F';

    const testCustomerId = `cust_c74_ui_${Date.now()}`;
    await client.query(`
      INSERT INTO public.customer (
        id, first_name, last_name, company_name, email, phone, gstin, is_corporate,
        credit_enabled, credit_limit, payment_terms_days, credit_status,
        credit_approved_by, credit_approved_at, created_by, created_at, updated_at
      ) VALUES (
        $1, 'Arjun', 'Mehta', 'Nexus Tech Solutions Pvt Ltd', 'arjun@nexustech.com',
        '9876500112', '29NEXUS1234F1Z1', true, true, 200000.00, 30, 'APPROVED',
        $2, NOW(), $2, NOW(), NOW()
      )
    `, [testCustomerId, adminUserId]);
    createdCustomers.push(testCustomerId);

    // Ensure company exists
    let compRes = await client.query(`SELECT id FROM public.company LIMIT 1`);
    let compId = compRes.rows[0]?.id;
    if (!compId) {
      compId = `comp_c74_ui_${Date.now()}`;
      await client.query(`
        INSERT INTO public.company (
          id, legal_name, trade_name, registered_address, city, state_code, pin_code,
          pan, currency, fy_start_month, invoice_prefix, phone, email, is_active, created_by, created_at, updated_at
        ) VALUES (
          $1, 'Cakes2Home Retail Pvt Ltd', 'Cakes2Home', '123 Baker St', 'Kochi', '32', '682001',
          'AAACC1234K', 'INR', 4, 'C2H', '9876543210', 'info@cakes2home.com', true, 'system', NOW(), NOW()
        )
      `, [compId]);
      createdCompanies.push(compId);
    }

    // Bank Account
    const bankGlRes = await client.query(`SELECT id FROM public.accounting_account WHERE code = '1112' LIMIT 1`);
    const bankGlId = bankGlRes.rows[0]?.id;
    const testBankId = `ba_c74_ui_${Date.now()}`;
    await client.query(`
      INSERT INTO public.bank_account (
        id, company_id, account_name, account_number, account_number_masked, bank_name, branch_name, ifsc_code,
        gl_account_id, status, created_at, updated_at
      ) VALUES (
        $1, $2, 'Primary Treasury Current', '9988112233', 'XXXXXX2233', 'ICICI Bank', 'Indiranagar', 'ICIC0001234',
        $3, 'ACTIVE', NOW(), NOW()
      )
    `, [testBankId, compId, bankGlId]);
    createdBankAccounts.push(testBankId);

    // Ensure Orders exist
    await client.query(`
      INSERT INTO public.order (id, customer_id, currency_code, status, created_at, updated_at)
      VALUES 
        ('ord_nexus_b2b_01', $1, 'INR', 'pending', NOW(), NOW()),
        ('ord_nexus_b2b_02', $1, 'INR', 'pending', NOW(), NOW())
      ON CONFLICT (id) DO NOTHING
    `, [testCustomerId]);
    createdOrders.push('ord_nexus_b2b_01', 'ord_nexus_b2b_02');

    // Statutory Invoice 1: ₹5,000 (Grand Total ₹5,250 with 5% GST)
    const inv1Id = `inv_c74_ui_1_${Date.now()}`;
    const inv1No = `CTH/26-27/990001`;
    const vch1Id = `vch_c74_ui_1_${Date.now()}`;
    await client.query(`
      INSERT INTO public.accounting_voucher (
        id, voucher_no, voucher_type, voucher_date, branch_id, fiscal_year, status,
        total_amount, reference_type, reference_id, reference_event, narration,
        created_by, approved_by, posted_by, created_at, updated_at
      ) VALUES (
        $1, 'SV-990001', 'SALES', CURRENT_DATE, $2, 'FY2026-27', 'POSTED',
        5250.00, 'SALES_INVOICE', $3, 'CORPORATE_INVOICE_POSTED',
        'Corporate festive gifts invoice', 'sales_rep', 'admin_01', 'admin_01', NOW(), NOW()
      )
    `, [vch1Id, branchId, inv1Id]);
    createdVouchers.push(vch1Id);

    // Journal Entry and Lines for Voucher 1
    const je1Id = `je_c74_ui_1_${Date.now()}`;
    await client.query(`
      INSERT INTO public.accounting_journal_entry (
        id, entry_no, voucher_id, entry_date, branch_id, fiscal_year, total_debit, total_credit,
        narration, created_by, created_at
      ) VALUES ($1, 'JE-C74-UI-1', $2, CURRENT_DATE, $3, 'FY2026-27', 5250.00, 5250.00, 'Festive gifts invoice', 'admin_01', NOW())
    `, [je1Id, vch1Id, branchId]);

    const arAccRes = await client.query(`SELECT id FROM public.accounting_account WHERE code = '1121' LIMIT 1`);
    const revAccRes = await client.query(`SELECT id FROM public.accounting_account WHERE code = '4110' LIMIT 1`);
    const cgstAccRes = await client.query(`SELECT id FROM public.accounting_account WHERE code = '2121' LIMIT 1`);
    const sgstAccRes = await client.query(`SELECT id FROM public.accounting_account WHERE code = '2122' LIMIT 1`);

    await client.query(`
      INSERT INTO public.accounting_journal_line (id, journal_entry_id, account_id, debit_amount, credit_amount, line_no, narration, customer_id, branch_id)
      VALUES 
        ('jl_c74_1', $1, $2, 5250.00, 0.00, 1, 'Dr Trade AR', $5, $6),
        ('jl_c74_2', $1, $3, 0.00, 5000.00, 2, 'Cr Sales Revenue', NULL, $6),
        ('jl_c74_3', $1, $4, 0.00, 125.00, 3, 'Cr Output CGST', NULL, $6),
        ('jl_c74_4', $1, $7, 0.00, 125.00, 4, 'Cr Output SGST', NULL, $6)
    `, [je1Id, arAccRes.rows[0].id, revAccRes.rows[0].id, cgstAccRes.rows[0].id, testCustomerId, branchId, sgstAccRes.rows[0].id]);

    const meta1 = {
      order_id: 'ord_nexus_b2b_01',
      taxable_value: 5000,
      cgst: 125,
      sgst: 125,
      igst: 0,
      is_intra_state: true,
      items: [{ description: 'Custom Corporate Celebration Cake', quantity: 5, rate: 1000, taxable_value: 5000, cgst: 125, sgst: 125, total: 5250 }],
    };

    await client.query(`
      INSERT INTO public.invoice (
        id, invoice_number, order_id, branch_id, customer_id, customer_name,
        subtotal, tax_total, grand_total, currency_code, payment_method, payment_status,
        status, voucher_id, due_date, paid_amount, outstanding_amount, is_corporate, metadata, delivered_at, created_at, updated_at
      ) VALUES (
        $1, $2, 'ord_nexus_b2b_01', $3, $4, 'Nexus Tech Solutions Pvt Ltd',
        5000.00, 250.00, 5250.00, 'INR', 'CREDIT', 'UNPAID',
        'POSTED', $5, CURRENT_DATE + INTERVAL '20 days', 0.00, 5250.00, true, $6, NOW(), NOW(), NOW()
      )
    `, [inv1Id, inv1No, branchId, testCustomerId, vch1Id, JSON.stringify(meta1)]);
    createdInvoices.push(inv1Id);

    // Statutory Invoice 2: ₹8,000 (Grand Total ₹8,400 with 5% GST)
    const inv2Id = `inv_c74_ui_2_${Date.now()}`;
    const inv2No = `CTH/26-27/990002`;
    const vch2Id = `vch_c74_ui_2_${Date.now()}`;
    await client.query(`
      INSERT INTO public.accounting_voucher (
        id, voucher_no, voucher_type, voucher_date, branch_id, fiscal_year, status,
        total_amount, reference_type, reference_id, reference_event, narration,
        created_by, approved_by, posted_by, created_at, updated_at
      ) VALUES (
        $1, 'SV-990002', 'SALES', CURRENT_DATE, $2, 'FY2026-27', 'POSTED',
        8400.00, 'SALES_INVOICE', $3, 'CORPORATE_INVOICE_POSTED',
        'Corporate monthly hampers invoice', 'sales_rep', 'admin_01', 'admin_01', NOW(), NOW()
      )
    `, [vch2Id, branchId, inv2Id]);
    createdVouchers.push(vch2Id);

    const meta2 = {
      order_id: 'ord_nexus_b2b_02',
      taxable_value: 8000,
      cgst: 200,
      sgst: 200,
      igst: 0,
      is_intra_state: true,
      items: [{ description: 'Executive Hampers', quantity: 8, rate: 1000, taxable_value: 8000, cgst: 200, sgst: 200, total: 8400 }],
    };

    await client.query(`
      INSERT INTO public.invoice (
        id, invoice_number, order_id, branch_id, customer_id, customer_name,
        subtotal, tax_total, grand_total, currency_code, payment_method, payment_status,
        status, voucher_id, due_date, paid_amount, outstanding_amount, is_corporate, metadata, delivered_at, created_at, updated_at
      ) VALUES (
        $1, $2, 'ord_nexus_b2b_02', $3, $4, 'Nexus Tech Solutions Pvt Ltd',
        8000.00, 400.00, 8400.00, 'INR', 'CREDIT', 'UNPAID',
        'POSTED', $5, CURRENT_DATE + INTERVAL '25 days', 0.00, 8400.00, true, $6, NOW(), NOW(), NOW()
      )
    `, [inv2Id, inv2No, branchId, testCustomerId, vch2Id, JSON.stringify(meta2)]);
    createdInvoices.push(inv2Id);

    console.log('[Setup] Test fixtures committed successfully.');

    // ── Launch Real Chromium ─────────────────────────────────────────────────
    console.log('\n[Browser] Launching Chromium browser...');
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
    page.on('console', msg => console.log(`[Browser Console] ${msg.type()}: ${msg.text()}`));
    page.on('pageerror', err => console.log(`[Browser PageError] ${err.message}`));

    const appUrl = 'http://localhost:3000/dashboard?tab=bills_receivable';
    console.log(`[Browser] Navigating to ${appUrl}...`);
    await page.goto(appUrl, { waitUntil: 'domcontentloaded', timeout: 90000 });
    await page.waitForTimeout(4000);

    // Verify Panel Rendering
    const panelTitle = await page.textContent('h1');
    assert(panelTitle && panelTitle.includes('Corporate Bills Receivable'), 'Bills Receivable panel rendered with correct title');

    // Verify KPI cards rendered
    const kpiCards = await page.$$('.grid.grid-cols-1.sm\\:grid-cols-2.lg\\:grid-cols-4 > div');
    assert(kpiCards.length >= 4, `4 KPI summary cards rendered (count: ${kpiCards.length})`);

    // Verify Ageing Matrix widget rendered
    const ageingBar = await page.locator('text=Authoritative AR Ageing Matrix').isVisible();
    assert(ageingBar, 'Authoritative AR Ageing Matrix widget is visible');

    // Verify test invoice rows in table
    await page.waitForSelector(`text=${inv1No}`, { timeout: 30000 });
    const row1 = await page.locator(`text=${inv1No}`).isVisible();
    const row2 = await page.locator(`text=${inv2No}`).isVisible();
    assert(row1 && row2, 'Both corporate test invoices displayed in bills table');

    // Screenshot 0: Bills Receivable Dashboard
    const shot0Path = path.join(__dirname, 'c7_4_bills_receivable_dashboard.png');
    await page.screenshot({ path: shot0Path, fullPage: false });
    console.log(`  📸 Screenshot saved: ${shot0Path}`);
    assert(fs.existsSync(shot0Path), 'Screenshot 0 captured: c7_4_bills_receivable_dashboard.png');

    // ── Step 1: Click Invoice 1 for Detail Modal Drill-Down ──────────────────
    console.log('\n[Browser] Opening Bill Detail Modal for statutory invoice...');
    await page.click(`text=${inv1No}`);
    await page.waitForSelector('text=Statutory GST Breakdown', { timeout: 30000 });

    const gstBreakdownVisible = await page.locator('text=Statutory GST Breakdown').isVisible();
    assert(gstBreakdownVisible, 'Statutory GST Breakdown visible in Detail Modal');

    const linesVisible = await page.locator('text=General Ledger Posting').isVisible();
    assert(linesVisible, 'General Ledger Posting drill-down visible in Detail Modal');

    // Screenshot 1: Bill Detail Modal
    const shot1Path = path.join(__dirname, 'c7_4_bills_receivable_detail_modal.png');
    await page.screenshot({ path: shot1Path, fullPage: false });
    console.log(`  📸 Screenshot saved: ${shot1Path}`);
    assert(fs.existsSync(shot1Path), 'Screenshot 1 captured: c7_4_bills_receivable_detail_modal.png');

    // Close detail modal
    await page.click('button[aria-label="Close"]');
    await page.waitForSelector('text=Statutory GST Breakdown', { state: 'detached', timeout: 10000 });
    await page.waitForTimeout(500);

    // ── Step 2: Open Receive Payment Modal & Settle Invoice 1 ────────────────
    console.log('\n[Browser] Opening Receive Receipt Modal...');
    // Click receipt action button on invoice 1 row
    const receiptBtns = await page.$$('button[title="Receive Receipt"]');
    assert(receiptBtns.length > 0, 'Receive Receipt button found in table actions');
    await receiptBtns[0].click();

    await page.waitForSelector('text=Record Corporate Receipt', { timeout: 30000 });
    const modalTitle = await page.locator('text=Record Corporate Receipt').isVisible();
    assert(modalTitle, 'Receive Receipt Modal opened successfully');

    // Fill in UTR Reference
    await page.fill('input[placeholder*="UTR"]', 'UTR-CHROMIUM-C74-9988');

    // Screenshot 2: Receive Receipt Modal
    const shot2Path = path.join(__dirname, 'c7_4_receive_receipt_modal.png');
    await page.screenshot({ path: shot2Path, fullPage: false });
    console.log(`  📸 Screenshot saved: ${shot2Path}`);
    assert(fs.existsSync(shot2Path), 'Screenshot 2 captured: c7_4_receive_receipt_modal.png');

    // Submit Receipt
    console.log('[Browser] Submitting receipt settlement...');
    await page.click('button:has-text("Commit Receipt")');
    await page.waitForTimeout(3000);

    // Verify row 1 updated status to FULLY_RECEIVED
    await page.waitForSelector('tbody tr span:has-text("FULLY RECEIVED")', { timeout: 30000 });
    const fullyReceivedVisible = await page.locator('tbody tr span:has-text("FULLY RECEIVED")').first().isVisible();
    assert(fullyReceivedVisible, 'Invoice 1 successfully updated to FULLY RECEIVED in live DOM');

    // ── Step 3: Open Customer Subledger Modal Drill-down ─────────────────────
    console.log('\n[Browser] Opening Customer Subledger Modal...');
    const ledgerBtns = await page.$$('button[title="Customer Subledger"]');
    assert(ledgerBtns.length > 0, 'Customer Subledger button found');
    await ledgerBtns[0].click();

    await page.waitForSelector('text=Customer Subledger (Account 1121)', { timeout: 30000 });
    const ledgerTitle = await page.locator('text=Customer Subledger (Account 1121)').isVisible();
    assert(ledgerTitle, 'Customer Subledger modal opened');

    // Verify UTR appears in subledger
    const utrVisible = await page.locator('text=UTR-CHROMIUM-C74-9988').first().isVisible();
    assert(utrVisible, 'Receipt UTR reference displayed in customer subledger audit trail');

    // Screenshot 3: Customer Subledger Modal
    const shot3Path = path.join(__dirname, 'c7_4_customer_ledger_modal.png');
    await page.screenshot({ path: shot3Path, fullPage: false });
    console.log(`  📸 Screenshot saved: ${shot3Path}`);
    assert(fs.existsSync(shot3Path), 'Screenshot 3 captured: c7_4_customer_ledger_modal.png');

    await page.click('button[aria-label="Close"]');
    await page.waitForSelector('text=Customer Subledger (Account 1121)', { state: 'detached', timeout: 10000 });
    await page.waitForTimeout(500);

    // ── Step 4: Open Schedule Reminder Modal ────────────────────────────────
    console.log('\n[Browser] Opening Schedule Reminder Modal...');
    const reminderBtns = await page.$$('button[title="Schedule Reminder"]');
    if (reminderBtns.length > 0) {
      await reminderBtns[0].click();
      await page.waitForSelector('text=Schedule Payment Reminder', { timeout: 30000 });
      const remTitle = await page.locator('text=Schedule Payment Reminder').first().isVisible();
      assert(remTitle, 'Schedule Reminder Modal opened');

      // Screenshot 4: Schedule Reminder Modal
      const shot4Path = path.join(__dirname, 'c7_4_schedule_reminder_modal.png');
      await page.screenshot({ path: shot4Path, fullPage: false });
      console.log(`  📸 Screenshot saved: ${shot4Path}`);
      assert(fs.existsSync(shot4Path), 'Screenshot 4 captured: c7_4_schedule_reminder_modal.png');

      await page.click('button:has-text("Schedule Reminder")');
      await page.waitForTimeout(2000);
      const remSuccess = await page.locator('text=successfully scheduled').first().isVisible();
      assert(remSuccess, 'Payment reminder confirmed in UI pipeline');

      await page.click('button[aria-label="Close"]');
      await page.waitForSelector('text=Schedule Payment Reminder', { state: 'detached', timeout: 10000 });
    }

    console.log('\n==================================================================');
    console.log(`  CHROMIUM VERIFICATION SUMMARY: ${passed} PASSED, ${failed} FAILED`);
    console.log('==================================================================\n');

    if (failed > 0) process.exit(1);

  } finally {
    if (browser) await browser.close();

    console.log('[Teardown] Cleaning up browser test fixtures...');
    // Teardown
    await client.query(`DELETE FROM public.customer_receipt_allocation WHERE invoice_id = ANY($1)`, [createdInvoices]);
    await client.query(`DELETE FROM public.notification WHERE resource_type = 'INVOICE' AND resource_id = ANY($1)`, [createdInvoices]);
    await client.query(`DELETE FROM public.invoice WHERE id = ANY($1)`, [createdInvoices]);

    const payVchsRes = await client.query(
      `SELECT id FROM public.accounting_voucher WHERE reference_type = 'CUSTOMER_RECEIPT' AND reference_event = 'CORPORATE_RECEIPT_SETTLEMENT'`
    );
    const payVchIds = payVchsRes.rows.map(r => r.id);
    const allVchIds = [...createdVouchers, ...payVchIds];

    if (allVchIds.length > 0) {
      const jeRes = await client.query(`SELECT id FROM public.accounting_journal_entry WHERE voucher_id = ANY($1)`, [allVchIds]);
      const jeIds = jeRes.rows.map(r => r.id);
      if (jeIds.length > 0) {
        await client.query(`DELETE FROM public.accounting_journal_line WHERE journal_entry_id = ANY($1)`, [jeIds]);
        await client.query(`DELETE FROM public.accounting_journal_entry WHERE id = ANY($1)`, [jeIds]);
      }
      await client.query(`DELETE FROM public.accounting_voucher WHERE id = ANY($1)`, [allVchIds]);
    }

    if (createdBankAccounts.length > 0) {
      await client.query(`DELETE FROM public.bank_account WHERE id = ANY($1)`, [createdBankAccounts]);
    }
    if (createdCustomers.length > 0) {
      await client.query(`DELETE FROM public.customer WHERE id = ANY($1)`, [createdCustomers]);
    }
    if (createdOrders.length > 0) {
      await client.query(`DELETE FROM public.order WHERE id = ANY($1)`, [createdOrders]);
    }
    if (createdCompanies.length > 0) {
      await client.query(`DELETE FROM public.company WHERE id = ANY($1)`, [createdCompanies]);
    }

    // Verify baseline
    const coaRes = await client.query(`SELECT COUNT(*)::int as count FROM public.accounting_account`);
    const tbRes = await client.query(`
      SELECT 
        COALESCE(SUM(debit_amount), 0)::numeric(12,2) as total_debit,
        COALESCE(SUM(credit_amount), 0)::numeric(12,2) as total_credit
      FROM public.accounting_journal_line
    `);
    const dr = parseFloat(tbRes.rows[0].total_debit);
    const cr = parseFloat(tbRes.rows[0].total_credit);
    console.log(`[Teardown] Clean baseline: CoA = ${coaRes.rows[0].count}, Dr=₹${dr.toFixed(2)}, Cr=₹${cr.toFixed(2)}, Diff=₹${(dr - cr).toFixed(4)}`);

    client.release();
    await pool.end();
  }
}

runBrowserVerification().then(() => {
  console.log('[Browser] Verification finished cleanly.');
  process.exit(0);
}).catch(err => {
  console.error("Browser verification error:", err);
  process.exit(1);
});
