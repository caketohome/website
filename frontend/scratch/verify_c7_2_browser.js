/**
 * CakeToHome ERP — Phase C7.2 Real Chromium Browser Verification via Playwright
 *
 * Verifies live browser rendering, DOM structure, Bills Payable register,
 * KPI summary metrics, Bill Detail Modal, Pay Bill Modal, partial payment settlement,
 * multi-bill batch selection, and live status recalculation.
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
  console.log('  PHASE C7.2 REAL CHROMIUM BROWSER VERIFICATION');
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
  const createdSuppliers = [];
  const createdBankAccounts = [];
  const createdCompanies = [];

  let browser = null;

  try {
    // ── Setup: Test Fixtures ───────────────────────────────────────────────
    console.log('[Setup] Creating browser test fixtures in database...');
    const branchRes = await client.query('SELECT id FROM public.branch LIMIT 1');
    const branchId = branchRes.rows[0]?.id || 'br_main';

    let compRes = await client.query('SELECT id FROM public.company LIMIT 1');
    let compId = compRes.rows[0]?.id;
    if (!compId) {
      compId = `comp_c72_b_${Date.now()}`;
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

    const supId = `sup_c72_ui_${Date.now()}`;
    await client.query(`
      INSERT INTO public.supplier (id, name, gstin, phone, branch_id, is_active, created_at, updated_at)
      VALUES ($1, 'Golden Grain Flour Mills', '29AABCG1234L1Z1', '9845112233', $2, true, NOW(), NOW())
    `, [supId, branchId]);
    createdSuppliers.push(supId);

    // Ensure active bank account
    let bankRes = await client.query(`SELECT id FROM public.bank_account WHERE status = 'ACTIVE' LIMIT 1`);
    let bankId = bankRes.rows[0]?.id;
    if (!bankId) {
      bankId = `bank_c72_ui_${Date.now()}`;
      await client.query(`
        INSERT INTO public.bank_account (
          id, company_id, bank_name, account_number_masked, ifsc_code, status, account_name, account_number, gl_account_id, branch_name, created_at, updated_at
        ) VALUES (
          $1, $2, 'HDFC Bank', 'XXXX9988', 'HDFC0001234', 'ACTIVE', 'Operating Current A/c', '50200099887766',
          (SELECT id FROM public.accounting_account WHERE code = '1112' LIMIT 1), 'MG Road', NOW(), NOW()
        )
      `, [bankId, compId]);
      createdBankAccounts.push(bankId);
    }

    // Bill A (₹3,000)
    const pAId = `pur_c72_ui_a_${Date.now()}`;
    const invA = `INV-UI-001-${Date.now().toString().slice(-4)}`;
    const vAId = `v_c72_ui_a_${Date.now()}`;
    await client.query(`
      INSERT INTO public.accounting_voucher (id, voucher_no, voucher_type, voucher_date, branch_id, fiscal_year, status, total_amount, reference_type, reference_id, reference_event, narration, created_by, approved_by, posted_by, created_at, updated_at)
      VALUES ($1, $2, 'JOURNAL', CURRENT_DATE, $3, 'FY2026-27', 'POSTED', 3000.00, 'PURCHASE', $4, 'INVOICE_POSTED', 'Wheat flour supply', 'admin_01', 'mgr_01', 'admin_01', NOW(), NOW());
    `, [vAId, `JV-UIA-${Date.now().toString().slice(-4)}`, branchId, pAId]);
    createdVouchers.push(vAId);

    await client.query(`
      INSERT INTO public.purchase (id, supplier_id, branch_id, invoice_no, invoice_date, due_date, subtotal, taxable_value, cgst, sgst, total, payment_method, status, voucher_id, posted_at, created_by, approved_by, created_at, updated_at)
      VALUES ($1, $2, $3, $4, CURRENT_DATE, CURRENT_DATE + INTERVAL '15 days', 3000.00, 3000.00, 0.00, 0.00, 3000.00, 'CREDIT', 'POSTED', $5, NOW(), 'buyer_01', 'mgr_01', NOW(), NOW());
    `, [pAId, supId, branchId, invA, vAId]);
    createdPurchases.push(pAId);

    // Bill B (₹4,500)
    const pBId = `pur_c72_ui_b_${Date.now()}`;
    const invB = `INV-UI-002-${Date.now().toString().slice(-4)}`;
    const vBId = `v_c72_ui_b_${Date.now()}`;
    await client.query(`
      INSERT INTO public.accounting_voucher (id, voucher_no, voucher_type, voucher_date, branch_id, fiscal_year, status, total_amount, reference_type, reference_id, reference_event, narration, created_by, approved_by, posted_by, created_at, updated_at)
      VALUES ($1, $2, 'JOURNAL', CURRENT_DATE, $3, 'FY2026-27', 'POSTED', 4500.00, 'PURCHASE', $4, 'INVOICE_POSTED', 'Baking yeast supply', 'admin_01', 'mgr_01', 'admin_01', NOW(), NOW());
    `, [vBId, `JV-UIB-${Date.now().toString().slice(-4)}`, branchId, pBId]);
    createdVouchers.push(vBId);

    await client.query(`
      INSERT INTO public.purchase (id, supplier_id, branch_id, invoice_no, invoice_date, due_date, subtotal, taxable_value, cgst, sgst, total, payment_method, status, voucher_id, posted_at, created_by, approved_by, created_at, updated_at)
      VALUES ($1, $2, $3, $4, CURRENT_DATE, CURRENT_DATE + INTERVAL '30 days', 4500.00, 4500.00, 0.00, 0.00, 4500.00, 'CREDIT', 'POSTED', $5, NOW(), 'buyer_01', 'mgr_01', NOW(), NOW());
    `, [pBId, supId, branchId, invB, vBId]);
    createdPurchases.push(pBId);

    console.log(`[Setup] Created 2 posted test bills: ${invA} (₹3000) and ${invB} (₹4500)`);

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

    // ── 1. Navigate to Bills Payable Dashboard ──────────────────────────────
    console.log('[1/6] Navigating to Bills Payable dashboard (/dashboard?tab=bills_payable)...');
    await page.goto('http://localhost:3000/dashboard?tab=bills_payable', { waitUntil: 'domcontentloaded', timeout: 90000 });
    await page.waitForTimeout(3000);

    const heading = await page.textContent('h1');
    assert(heading && heading.includes('Bills Payable'), `Dashboard loaded with heading: "${heading}"`);

    // Take screenshot of main dashboard
    await page.screenshot({ path: path.join(__dirname, 'c7_2_bills_payable_dashboard.png'), fullPage: false });
    assert(fs.existsSync(path.join(__dirname, 'c7_2_bills_payable_dashboard.png')), 'Captured screenshot: c7_2_bills_payable_dashboard.png');

    // ── 2. Check KPI Cards ──────────────────────────────────────────────────
    console.log('\n[2/6] Verifying KPI Summary Cards...');
    const pageContent = await page.content();
    assert(pageContent.includes('Total Outstanding'), 'Total Outstanding KPI card rendered');
    assert(pageContent.includes('Overdue Liabilities'), 'Overdue Liabilities KPI card rendered');
    assert(pageContent.includes('Due Soon / Current'), 'Due Soon / Current KPI card rendered');
    assert(pageContent.includes('Fully Settled Bills'), 'Fully Settled Bills KPI card rendered');

    // ── 3. Find and inspect Bill A in table ──────────────────────────────────
    console.log('\n[3/6] Inspecting Bill A in table & opening Bill Detail Modal...');
    const searchInput = page.locator('input[placeholder*="Search invoice"]');
    await searchInput.fill(invA);
    await page.waitForTimeout(1000);

    await page.waitForSelector(`text=${invA}`, { timeout: 15000 });
    const invALink = page.locator(`text=${invA}`);
    const isInvAVisible = await invALink.isVisible();
    assert(isInvAVisible, `Bill A (${invA}) found in Bills Payable register`);

    // Click to open detail modal
    await invALink.click();
    await page.waitForSelector('text=Invoice Line Items', { timeout: 10000 });
    await page.waitForTimeout(500);

    const modalTitle = await page.textContent('h2');
    assert(modalTitle && modalTitle.includes(invA), `Bill Detail Modal opened for: "${modalTitle}"`);

    await page.screenshot({ path: path.join(__dirname, 'c7_2_bill_detail_modal.png') });
    assert(fs.existsSync(path.join(__dirname, 'c7_2_bill_detail_modal.png')), 'Captured screenshot: c7_2_bill_detail_modal.png');

    // Close detail modal
    const closeBtn = page.locator('button:has-text("Close")');
    await closeBtn.click();
    await page.waitForTimeout(500);

    // ── 4. Disburse Partial Payment via PayBillModal ─────────────────────────
    console.log('\n[4/6] Executing Partial Payment (₹1,500.00) via PayBillModal...');
    // Clear search filter to see table rows
    await searchInput.fill('');
    await page.waitForTimeout(1000);

    // Locate "Pay" button next to invA
    const row = page.locator(`tr:has-text("${invA}")`);
    const payBtn = row.locator('button:has-text("Pay")');
    await payBtn.click();

    await page.waitForSelector('text=Disburse Bill Payment', { timeout: 10000 });
    const payModalHeader = await page.textContent('h2');
    assert(payModalHeader && payModalHeader.includes('Disburse Bill Payment'), 'PayBillModal opened successfully');

    // Change amount to partial payment: ₹1,500.00
    const amountInput = page.locator('input[type="number"]');
    await amountInput.fill('1500.00');

    // Fill reference / UTR
    const refInput = page.locator('input[placeholder*="UTR"]');
    if (await refInput.isVisible()) {
      await refInput.fill('UTR-BROWSER-TEST-001');
    }

    // Ensure disbursing bank account is selected
    const bankSelectLocator = page.locator('select').nth(2); // In modal or by label
    await page.waitForTimeout(1000);

    await page.screenshot({ path: path.join(__dirname, 'c7_2_pay_bill_modal.png') });
    assert(fs.existsSync(path.join(__dirname, 'c7_2_pay_bill_modal.png')), 'Captured screenshot: c7_2_pay_bill_modal.png');

    // Submit payment
    const disburseBtn = page.locator('button[type="submit"]:has-text("Disburse")');
    await disburseBtn.click();

    // Wait for modal to close and table to refresh
    await page.waitForSelector('text=Disburse Bill Payment', { state: 'detached', timeout: 20000 });
    await page.waitForTimeout(2000);

    // Re-verify Bill A in table: should be PARTIALLY_PAID with ₹1,500 outstanding
    await searchInput.fill(invA);
    await page.waitForTimeout(1000);

    const updatedRowText = await page.locator(`tr:has-text("${invA}")`).textContent();
    assert(
      updatedRowText && (updatedRowText.includes('PARTIALLY PAID') || updatedRowText.includes('PARTIALLY_PAID')),
      'Bill A dynamically updated to PARTIALLY_PAID status in table'
    );
    assert(
      updatedRowText && updatedRowText.includes('1500.00'),
      'Bill A outstanding balance decremented to ₹1,500.00'
    );

    // ── 5. Multi-Bill Batch Selection ───────────────────────────────────────
    console.log('\n[5/6] Testing Multi-Bill Batch Selection...');
    await searchInput.fill('');
    await page.waitForTimeout(1000);

    // Select Bill A and Bill B checkboxes
    const chkRowA = page.locator(`tr:has-text("${invA}") input[type="checkbox"]`);
    const chkRowB = page.locator(`tr:has-text("${invB}") input[type="checkbox"]`);

    if (await chkRowA.isVisible() && await chkRowB.isVisible()) {
      await chkRowA.check();
      await chkRowB.check();
      await page.waitForTimeout(500);

      const batchBanner = page.locator('text=bill(s) selected');
      const isBannerVisible = await batchBanner.isVisible();
      assert(isBannerVisible, 'Batch Selection Banner appeared with multi-bill selection');

      const batchPayBtn = page.locator('button:has-text("Pay Selected Bills")');
      const isBatchPayBtnVisible = await batchPayBtn.isVisible();
      assert(isBatchPayBtnVisible, 'Pay Selected Bills batch action button rendered');

      await page.screenshot({ path: path.join(__dirname, 'c7_2_batch_selection.png') });
      assert(fs.existsSync(path.join(__dirname, 'c7_2_batch_selection.png')), 'Captured screenshot: c7_2_batch_selection.png');
    } else {
      assert(false, 'Checkboxes for Bill A / Bill B not found');
    }

    // ── 6. Verification of Subledger Consistency ────────────────────────────
    console.log('\n[6/6] Verifying Database GL Audit Trail after settlement...');
    const payRows = await client.query(`
      SELECT pp.*, ppa.allocated_amount
      FROM public.purchase_payment pp
      JOIN public.purchase_payment_allocation ppa ON ppa.payment_id = pp.id
      WHERE ppa.purchase_id = $1;
    `, [pAId]);

    assert(payRows.rows.length === 1, '1 payment recorded with linked purchase_payment_allocation');
    assert(parseFloat(payRows.rows[0].allocated_amount) === 1500.00, 'Allocated amount matches ₹1,500.00');
    assert(Boolean(payRows.rows[0].voucher_id), `Payment has GL voucher linked: ${payRows.rows[0].voucher_id}`);

    if (payRows.rows.length > 0) {
      createdPayments.push(payRows.rows[0].id);
      if (payRows.rows[0].voucher_id) {
        createdVouchers.push(payRows.rows[0].voucher_id);
      }
    }

  } catch (err) {
    console.error('Browser verification failed with error:', err);
    failed++;
  } finally {
    if (browser) {
      await browser.close();
    }

    console.log('\n[Teardown] Cleaning up test fixtures...');
    try {
      if (createdPayments.length > 0) {
        await client.query(`DELETE FROM public.purchase_payment_allocation WHERE payment_id = ANY($1)`, [createdPayments]);
        await client.query(`DELETE FROM public.purchase_payment WHERE id = ANY($1)`, [createdPayments]);
      }
      if (createdPurchases.length > 0) {
        await client.query(`DELETE FROM public.purchase_payment_allocation WHERE purchase_id = ANY($1)`, [createdPurchases]);
        await client.query(`DELETE FROM public.purchase WHERE id = ANY($1)`, [createdPurchases]);
      }
      if (createdVouchers.length > 0) {
        const jeRes = await client.query(`SELECT id FROM public.accounting_journal_entry WHERE voucher_id = ANY($1)`, [createdVouchers]);
        const jeIds = jeRes.rows.map(r => r.id);
        if (jeIds.length > 0) {
          await client.query(`DELETE FROM public.accounting_journal_line WHERE journal_entry_id = ANY($1)`, [jeIds]);
          await client.query(`DELETE FROM public.accounting_journal_entry WHERE id = ANY($1)`, [jeIds]);
        }
        await client.query(`DELETE FROM public.accounting_voucher WHERE id = ANY($1)`, [createdVouchers]);
      }
      if (createdBankAccounts.length > 0) {
        await client.query(`DELETE FROM public.bank_account WHERE id = ANY($1)`, [createdBankAccounts]);
      }
      if (createdSuppliers.length > 0) {
        await client.query(`DELETE FROM public.supplier WHERE id = ANY($1)`, [createdSuppliers]);
      }
      if (createdCompanies.length > 0) {
        await client.query(`DELETE FROM public.company WHERE id = ANY($1)`, [createdCompanies]);
      }
      console.log('✓ Teardown complete. Restoring baseline.');
    } catch (tdErr) {
      console.error('Teardown error:', tdErr);
    } finally {
      client.release();
      await pool.end();
    }
  }

  console.log('\n==================================================================');
  console.log(`  PHASE C7.2 BROWSER VERIFICATION: ${passed} PASSED, ${failed} FAILED`);
  console.log('==================================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runBrowserVerification().catch(err => {
  console.error("Runner crash:", err);
  process.exit(1);
});
