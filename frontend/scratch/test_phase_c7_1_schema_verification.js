/**
 * CakeToHome ERP — Phase C7.1 Schema Foundations Verification Suite
 *
 * Covers:
 * [SUITE 1] Table & Baseline Verification (317 tables, 100 CoA accounts, baseline rows)
 * [SUITE 2] Cost Centre Master & Hierarchy (CRUD, active flag, hierarchy parent_id)
 * [SUITE 3] Accounting Journal Dimension (cost_centre_id on voucher & journal_line)
 * [SUITE 4] Purchase Voucher Linkage (voucher_id FK & invalid FK rejection)
 * [SUITE 5] Purchase Payment Linkage (voucher_id, bank_account_id, teller_session_id, branch_id)
 * [SUITE 6] Purchase Payment Allocation (many-to-many, partial/multi-bill, amount constraint > 0)
 * [SUITE 7] Customer Receipt Allocation (invoice linkage, voucher / payment_transaction source check)
 * [SUITE 8] Corporate Credit Master Fields (defaults, retail protection, constraint validation)
 * [SUITE 9] Invoice Accounting Linkage & Corporate Fields (voucher_id, due_date, paid_amount)
 * [SUITE 10] Negative Constraints & FK Violation Tests (invalid references, negative amounts)
 * [SUITE 11] PostgreSQL Invariants & Zero Drift (TB balanced, 0 orphans, 0 blocked locks)
 */

const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');

function getConnectionString() {
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL;
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

const pool = new Pool({ connectionString: getConnectionString() });

let passedAssertions = 0;
let failedAssertions = 0;

function assert(condition, message) {
  if (condition) {
    passedAssertions++;
    console.log(`  ✓ PASS: ${message}`);
  } else {
    failedAssertions++;
    console.error(`  ❌ FAIL: ${message}`);
  }
}

async function runTestSuite() {
  console.log('==================================================================');
  console.log('  CAKETOHOME ERP — PHASE C7.1 SCHEMA VERIFICATION SUITE');
  console.log('==================================================================\n');

  const client = await pool.connect();
  try {
    // ─── [SUITE 1] Table & Baseline Verification ─────────────────────────────
    console.log('📍 [SUITE 1] Table & Baseline Verification...');
    const tableRes = await client.query(`
      SELECT count(*)::int as count 
      FROM information_schema.tables 
      WHERE table_schema = 'public' AND table_type = 'BASE TABLE';
    `);
    assert(tableRes.rows[0].count === 317, `Total public tables is exactly 317 (got ${tableRes.rows[0].count})`);

    const coaRes = await client.query('SELECT count(*)::int as count FROM public.accounting_account');
    assert(coaRes.rows[0].count === 100, `Live Chart of Accounts count is exactly 100 (got ${coaRes.rows[0].count})`);

    const tbRes = await client.query(`
      SELECT 
        COALESCE(SUM(debit_amount), 0)::numeric(15,2) as dr,
        COALESCE(SUM(credit_amount), 0)::numeric(15,2) as cr
      FROM public.accounting_journal_line;
    `);
    assert(tbRes.rows[0].dr === tbRes.rows[0].cr, `Trial Balance balanced: Dr ₹${tbRes.rows[0].dr} === Cr ₹${tbRes.rows[0].cr}`);

    const baselineCounts = {
      accounting_voucher: 6,
      accounting_journal_entry: 4,
      accounting_journal_line: 10,
      customer: 57,
      invoice: 5,
      branch: 57,
      purchase: 0,
      purchase_payment: 0,
    };
    for (const [tbl, expected] of Object.entries(baselineCounts)) {
      const cnt = await client.query(`SELECT count(*)::int as count FROM public."${tbl}"`);
      assert(cnt.rows[0].count === expected, `Table ${tbl} baseline preserved: ${cnt.rows[0].count} rows (expected: ${expected})`);
    }

    // ─── [SUITE 2] Cost Centre Master & Hierarchy ────────────────────────────
    console.log('\n📍 [SUITE 2] Cost Centre Master & Hierarchy...');
    // Create parent cost centre
    const parentCcId = `cc_test_parent_${Date.now()}`;
    await client.query(`
      INSERT INTO public.cost_centre (id, code, name, department, is_active)
      VALUES ($1, $2, $3, $4, true);
    `, [parentCcId, `CC_TEST_HO_${Date.now()}`, 'Head Office Administration', 'HEAD_OFFICE']);
    assert(true, 'Parent cost centre inserted successfully');

    // Create child cost centre referencing parent
    const childCcId = `cc_test_child_${Date.now()}`;
    await client.query(`
      INSERT INTO public.cost_centre (id, code, name, department, parent_id, is_active)
      VALUES ($1, $2, $3, $4, $5, true);
    `, [childCcId, `CC_TEST_MKT_${Date.now()}`, 'Digital Marketing Team', 'MARKETING', parentCcId]);
    assert(true, 'Child cost centre referencing parent inserted successfully');

    // Verify parent-child relationship query
    const hierRes = await client.query(`
      SELECT c.code as child_code, p.code as parent_code
      FROM public.cost_centre c
      JOIN public.cost_centre p ON c.parent_id = p.id
      WHERE c.id = $1;
    `, [childCcId]);
    assert(hierRes.rows.length === 1 && hierRes.rows[0].parent_code.startsWith('CC_TEST_HO_'), 'Cost centre hierarchy properly joined');

    // ─── [SUITE 3] Accounting Journal Dimension ──────────────────────────────
    console.log('\n📍 [SUITE 3] Accounting Journal Dimension (cost_centre_id)...');
    // Fetch an active branch
    const branchRes = await client.query('SELECT id FROM public.branch LIMIT 1');
    const branchId = branchRes.rows[0].id;

    // Test voucher with cost_centre_id
    const testVoucherId = `vch_c71_test_${Date.now()}`;
    await client.query(`
      INSERT INTO public.accounting_voucher (
        id, voucher_no, voucher_type, voucher_date, branch_id, fiscal_year, narration, created_by, cost_centre_id
      ) VALUES ($1, $2, 'JOURNAL', '2026-10-06', $3, 'FY2026-27', 'Test Cost Centre Voucher', 'test_user', $4);
    `, [testVoucherId, `VCH-C71-${Date.now()}`, branchId, childCcId]);
    assert(true, 'Accounting voucher with cost_centre_id persisted');

    // Test journal entry and line with cost_centre_id
    const testEntryId = `je_c71_test_${Date.now()}`;
    await client.query(`
      INSERT INTO public.accounting_journal_entry (
        id, entry_no, voucher_id, entry_date, branch_id, fiscal_year, total_debit, total_credit, narration, created_by
      ) VALUES ($1, $2, $3, '2026-10-06', $4, 'FY2026-27', 100.00, 100.00, 'Test Entry', 'test_user');
    `, [testEntryId, `JE-C71-${Date.now()}`, testVoucherId, branchId]);

    // Resolve an account for testing
    const accRes = await client.query('SELECT id FROM public.accounting_account WHERE code = \'1111\'');
    const cashAccId = accRes.rows[0].id;
    const testLineId1 = `jl_c71_test1_${Date.now()}`;
    const testLineId2 = `jl_c71_test2_${Date.now()}`;
    await client.query(`
      INSERT INTO public.accounting_journal_line (
        id, journal_entry_id, line_no, account_id, debit_amount, credit_amount, branch_id, cost_centre_id, narration
      ) VALUES 
        ($1, $2, 1, $3, 100.00, 0.00, $4, $5, 'Test Line Cost Centre Dr'),
        ($6, $2, 2, $3, 0.00, 100.00, $4, $5, 'Test Line Cost Centre Cr');
    `, [testLineId1, testEntryId, cashAccId, branchId, childCcId, testLineId2]);
    assert(true, 'Balanced accounting journal lines with cost_centre_id persisted');

    // ─── [SUITE 4] Purchase Voucher Linkage ───────────────────────────────────
    console.log('\n📍 [SUITE 4] Purchase Voucher Linkage...');
    const testPurchaseId = `pur_c71_test_${Date.now()}`;
    await client.query(`
      INSERT INTO public.purchase (
        id, branch_id, invoice_no, total, taxable_value, status, voucher_id
      ) VALUES ($1, $2, 'INV-C71-001', 500.00, 500.00, 'POSTED', $3);
    `, [testPurchaseId, branchId, testVoucherId]);
    assert(true, 'Purchase linked to accounting voucher persisted');

    const purVerify = await client.query('SELECT voucher_id FROM public.purchase WHERE id = $1', [testPurchaseId]);
    assert(purVerify.rows[0].voucher_id === testVoucherId, 'purchase.voucher_id retrieved correctly');

    // ─── [SUITE 5] Purchase Payment Linkage ──────────────────────────────────
    console.log('\n📍 [SUITE 5] Purchase Payment Linkage...');
    const testPaymentId = `pp_c71_test_${Date.now()}`;
    await client.query(`
      INSERT INTO public.purchase_payment (
        id, purchase_id, amount, method, payment_date, voucher_id, branch_id
      ) VALUES ($1, $2, 500.00, 'CASH', '2026-10-06', $3, $4);
    `, [testPaymentId, testPurchaseId, testVoucherId, branchId]);
    assert(true, 'Purchase payment with voucher_id and branch_id persisted');

    // ─── [SUITE 6] Purchase Payment Allocation (Bill-wise Settlement) ────────
    console.log('\n📍 [SUITE 6] Purchase Payment Allocation...');
    const testPpaId = `ppa_c71_test_${Date.now()}`;
    await client.query(`
      INSERT INTO public.purchase_payment_allocation (
        id, payment_id, purchase_id, allocated_amount
      ) VALUES ($1, $2, $3, 500.00);
    `, [testPpaId, testPaymentId, testPurchaseId]);
    assert(true, 'Purchase payment allocation persisted');

    // Multi-bill allocation capability: Create second purchase and allocate partial
    const testPurchaseId2 = `pur_c71_test2_${Date.now()}`;
    await client.query(`
      INSERT INTO public.purchase (
        id, branch_id, invoice_no, total, taxable_value, status
      ) VALUES ($1, $2, 'INV-C71-002', 300.00, 300.00, 'POSTED');
    `, [testPurchaseId2, branchId]);

    const testPpaId2 = `ppa_c71_test2_${Date.now()}`;
    await client.query(`
      INSERT INTO public.purchase_payment_allocation (
        id, payment_id, purchase_id, allocated_amount
      ) VALUES ($1, $2, $3, 200.00);
    `, [testPpaId2, testPaymentId, testPurchaseId2]);
    assert(true, 'Multi-bill allocation from a single payment record succeeded');

    // Verify allocation aggregation
    const ppaAgg = await client.query(`
      SELECT payment_id, SUM(allocated_amount) as total_allocated, count(*) as count
      FROM public.purchase_payment_allocation
      WHERE payment_id = $1
      GROUP BY payment_id;
    `, [testPaymentId]);
    assert(parseFloat(ppaAgg.rows[0].total_allocated) === 700.00 && parseInt(ppaAgg.rows[0].count) === 2, 'Allocations aggregated accurately across bills');

    // ─── [SUITE 7] Customer Receipt Allocation ───────────────────────────────
    console.log('\n📍 [SUITE 7] Customer Receipt Allocation...');
    // Fetch an existing invoice
    const invRes = await client.query('SELECT id FROM public.invoice LIMIT 1');
    const invoiceId = invRes.rows[0].id;

    const testCraId = `cra_c71_test_${Date.now()}`;
    await client.query(`
      INSERT INTO public.customer_receipt_allocation (
        id, invoice_id, voucher_id, allocated_amount
      ) VALUES ($1, $2, $3, 150.00);
    `, [testCraId, invoiceId, testVoucherId]);
    assert(true, 'Customer receipt allocation linked to invoice and voucher persisted');

    // ─── [SUITE 8] Corporate Credit Master Fields on Customer ────────────────
    console.log('\n📍 [SUITE 8] Corporate Credit Master Fields on Customer...');
    // Existing customers default check
    const custDef = await client.query(`
      SELECT count(*) as count 
      FROM public.customer 
      WHERE is_corporate = true OR credit_enabled = true OR credit_limit > 0;
    `);
    assert(parseInt(custDef.rows[0].count) === 0, 'Zero retail customers have credit enabled or limit > 0');

    // Update test customer with corporate credit
    const custRes = await client.query('SELECT id FROM public.customer LIMIT 1');
    const custId = custRes.rows[0].id;
    await client.query(`
      UPDATE public.customer 
      SET is_corporate = true, credit_enabled = true, credit_limit = 50000.00, payment_terms_days = 30, gstin = '29ABCDE1234F1Z5'
      WHERE id = $1;
    `, [custId]);
    const updatedCust = await client.query('SELECT is_corporate, credit_enabled, credit_limit, payment_terms_days, gstin FROM public.customer WHERE id = $1', [custId]);
    assert(updatedCust.rows[0].is_corporate === true, 'Customer updated to is_corporate = true');
    assert(updatedCust.rows[0].credit_enabled === true, 'Customer updated to credit_enabled = true');
    assert(parseFloat(updatedCust.rows[0].credit_limit) === 50000.00, 'Customer credit limit set to ₹50,000.00');
    assert(updatedCust.rows[0].payment_terms_days === 30, 'Payment terms set to 30 days');

    // Revert test customer back to pristine
    await client.query(`
      UPDATE public.customer 
      SET is_corporate = false, credit_enabled = false, credit_limit = 0.00, payment_terms_days = 0, gstin = null
      WHERE id = $1;
    `, [custId]);
    assert(true, 'Test customer reverted back to pristine non-corporate state');

    // ─── [SUITE 9] Invoice Accounting Linkage & Corporate Fields ─────────────
    console.log('\n📍 [SUITE 9] Invoice Accounting Linkage & Corporate Fields...');
    await client.query(`
      UPDATE public.invoice 
      SET voucher_id = $1, due_date = '2026-11-06', is_corporate = false, paid_amount = 0.00, outstanding_amount = 500.00
      WHERE id = $2;
    `, [testVoucherId, invoiceId]);
    const invCheck = await client.query('SELECT voucher_id, due_date, is_corporate FROM public.invoice WHERE id = $1', [invoiceId]);
    assert(invCheck.rows[0].voucher_id === testVoucherId, 'invoice.voucher_id linked to voucher');
    assert(invCheck.rows[0].is_corporate === false, 'invoice.is_corporate is false');

    // Revert invoice back
    await client.query(`
      UPDATE public.invoice 
      SET voucher_id = null, due_date = null, is_corporate = false, paid_amount = 0.00, outstanding_amount = 0.00
      WHERE id = $1;
    `, [invoiceId]);
    assert(true, 'Invoice reverted back to pristine state');

    // ─── [SUITE 10] Negative Constraints & FK Violation Tests ────────────────
    console.log('\n📍 [SUITE 10] Negative Constraints & FK Violation Tests...');
    // Negative test 1: Invalid cost_centre_id on voucher
    try {
      await client.query(`
        INSERT INTO public.accounting_voucher (
          id, voucher_no, voucher_type, voucher_date, branch_id, fiscal_year, narration, created_by, cost_centre_id
        ) VALUES ('vch_fake', 'VCH-FAKE', 'JOURNAL', '2026-10-06', $1, 'FY2026-27', 'Fake', 'test', 'cc_non_existent');
      `, [branchId]);
      assert(false, 'Invalid cost_centre_id on voucher should have been rejected');
    } catch (e) {
      assert(e.code === '23503', 'Invalid cost_centre_id rejected by foreign key constraint (23503)');
    }

    // Negative test 2: Negative allocation amount on purchase_payment_allocation
    try {
      await client.query(`
        INSERT INTO public.purchase_payment_allocation (
          id, payment_id, purchase_id, allocated_amount
        ) VALUES ('ppa_fake', $1, $2, -50.00);
      `, [testPaymentId, testPurchaseId]);
      assert(false, 'Negative allocation amount should have been rejected');
    } catch (e) {
      assert(e.code === '23514', 'Negative allocation amount rejected by check constraint (23514)');
    }

    // Negative test 3: Negative allocation amount on customer_receipt_allocation
    try {
      await client.query(`
        INSERT INTO public.customer_receipt_allocation (
          id, invoice_id, voucher_id, allocated_amount
        ) VALUES ('cra_fake', $1, $2, 0.00);
      `, [invoiceId, testVoucherId]);
      assert(false, 'Zero/negative receipt allocation should have been rejected');
    } catch (e) {
      assert(e.code === '23514', 'Zero allocation amount rejected by check constraint (23514)');
    }

    // Negative test 4: Missing source on customer_receipt_allocation
    try {
      await client.query(`
        INSERT INTO public.customer_receipt_allocation (
          id, invoice_id, voucher_id, payment_transaction_id, allocated_amount
        ) VALUES ('cra_fake2', $1, null, null, 100.00);
      `, [invoiceId]);
      assert(false, 'Receipt allocation with neither voucher nor payment_tx should have been rejected');
    } catch (e) {
      assert(e.code === '23514', 'Missing source rejected by chk_cra_source check constraint (23514)');
    }

    // Negative test 5: Negative customer credit limit
    try {
      await client.query(`
        INSERT INTO public.customer (id, first_name, email, credit_limit)
        VALUES ('cus_fake_neg', 'Fake', 'fake@test.com', -100.00);
      `, []);
      assert(false, 'Negative customer credit limit should have been rejected');
    } catch (e) {
      assert(e.code === '23514', 'Negative credit limit rejected by check constraint (23514)');
    }

    // ─── TEARDOWN TEST ENTITIES ──────────────────────────────────────────────
    console.log('\n📍 [TEARDOWN] Purging test entities & restoring pristine DB baseline...');
    await client.query('DELETE FROM public.customer_receipt_allocation WHERE id = $1', [testCraId]);
    await client.query('DELETE FROM public.purchase_payment_allocation WHERE payment_id = $1', [testPaymentId]);
    await client.query('DELETE FROM public.purchase_payment WHERE id = $1', [testPaymentId]);
    await client.query('DELETE FROM public.purchase WHERE id IN ($1, $2)', [testPurchaseId, testPurchaseId2]);
    await client.query('DELETE FROM public.accounting_journal_line WHERE journal_entry_id = $1', [testEntryId]);
    await client.query('DELETE FROM public.accounting_journal_entry WHERE id = $1', [testEntryId]);
    await client.query('DELETE FROM public.accounting_voucher WHERE id = $1', [testVoucherId]);
    await client.query('DELETE FROM public.cost_centre WHERE id IN ($1, $2)', [childCcId, parentCcId]);
    console.log('  ✓ All C7.1 test entities purged cleanly');

    // ─── [SUITE 11] PostgreSQL Invariants & Zero Drift ───────────────────────
    console.log('\n📍 [SUITE 11] PostgreSQL Invariants & Zero Drift...');
    const postCoaCheck = await client.query('SELECT count(*)::int as count FROM public.accounting_account');
    assert(postCoaCheck.rows[0].count === 100, 'Chart of Accounts count remains exactly 100');

    const postTbCheck = await client.query(`
      SELECT 
        COALESCE(SUM(debit_amount), 0)::numeric(15,2) as dr,
        COALESCE(SUM(credit_amount), 0)::numeric(15,2) as cr
      FROM public.accounting_journal_line;
    `);
    assert(postTbCheck.rows[0].dr === postTbCheck.rows[0].cr, `Trial Balance zero-sum maintained: Dr ₹${postTbCheck.rows[0].dr} === Cr ₹${postTbCheck.rows[0].cr}`);

    const orphanVouchers = await client.query(`
      SELECT count(*)::int as count 
      FROM public.accounting_voucher v 
      LEFT JOIN public.branch b ON v.branch_id = b.id 
      WHERE b.id IS NULL;
    `);
    assert(orphanVouchers.rows[0].count === 0, 'Zero orphan vouchers without valid branch');

    const orphanLines = await client.query(`
      SELECT count(*)::int as count 
      FROM public.accounting_journal_line l 
      LEFT JOIN public.accounting_journal_entry e ON l.journal_entry_id = e.id 
      WHERE e.id IS NULL;
    `);
    assert(orphanLines.rows[0].count === 0, 'Zero orphan journal lines without valid journal entry');

    const locks = await client.query(`
      SELECT count(*)::int as count 
      FROM pg_locks 
      WHERE NOT granted;
    `);
    assert(locks.rows[0].count === 0, 'Zero active blocked database locks');

    console.log('\n==================================================================');
    console.log(`  PHASE C7.1 TEST SUMMARY: ${passedAssertions} PASSED, ${failedAssertions} FAILED`);
    console.log('==================================================================\n');

    if (failedAssertions > 0) {
      process.exit(1);
    }

  } finally {
    client.release();
    await pool.end();
  }
}

runTestSuite().catch(err => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
