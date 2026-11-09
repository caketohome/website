const path = require('path');
const fs = require('fs');
const { Pool } = require('pg');

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
  throw new Error("DATABASE_URL not found");
}

async function runAudit() {
  console.log('==================================================================');
  console.log('  INDEPENDENT POSTGRESQL AUDIT — PHASE C7.2 POST-VERIFICATION');
  console.log('==================================================================\n');

  const pool = new Pool({ connectionString: getConnectionString() });
  const client = await pool.connect();
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

  try {
    // 1. Chart of Accounts Canonical Count
    const coaRes = await client.query('SELECT count(*) FROM public.accounting_account');
    const coaCount = parseInt(coaRes.rows[0].count, 10);
    assert(coaCount === 100, `CoA count === 100 canonical accounts (actual: ${coaCount})`);

    // 2. AP Account 2111
    const apRes = await client.query("SELECT id, code, name, type FROM public.accounting_account WHERE code = '2111'");
    assert(apRes.rows.length === 1, `AP Account 2111 exists in CoA (name: "${apRes.rows[0]?.name}", type: ${apRes.rows[0]?.type})`);

    // 3. Bank Account 1112 & Cash Account 1111
    const bankGl = await client.query("SELECT id, code, name FROM public.accounting_account WHERE code = '1112'");
    assert(bankGl.rows.length === 1, `Bank Account 1112 exists in CoA`);
    const cashGl = await client.query("SELECT id, code, name FROM public.accounting_account WHERE code = '1111'");
    assert(cashGl.rows.length === 1, `Cash in Hand 1111 exists in CoA`);

    // 4. Orphan Vouchers
    const orphanVoucherRes = await client.query(`
      SELECT count(*) FROM public.accounting_voucher v
      WHERE NOT EXISTS (SELECT 1 FROM public.branch b WHERE b.id = v.branch_id)
    `);
    assert(parseInt(orphanVoucherRes.rows[0].count, 10) === 0, `0 orphan vouchers without branch attribution`);

    // 5. Orphan Journal Entries
    const orphanEntryRes = await client.query(`
      SELECT count(*) FROM public.accounting_journal_entry je
      WHERE NOT EXISTS (SELECT 1 FROM public.accounting_voucher v WHERE v.id = je.voucher_id)
    `);
    assert(parseInt(orphanEntryRes.rows[0].count, 10) === 0, `0 orphan journal entries without linked voucher`);

    // 6. Orphan Journal Lines
    const orphanLineRes = await client.query(`
      SELECT count(*) FROM public.accounting_journal_line jl
      WHERE NOT EXISTS (SELECT 1 FROM public.accounting_journal_entry je WHERE je.id = jl.journal_entry_id)
    `);
    assert(parseInt(orphanLineRes.rows[0].count, 10) === 0, `0 orphan journal lines without parent entry`);

    // 7. Orphan Purchases
    const orphanPurRes = await client.query(`
      SELECT count(*) FROM public.purchase p
      WHERE NOT EXISTS (SELECT 1 FROM public.supplier s WHERE s.id = p.supplier_id)
    `);
    assert(parseInt(orphanPurRes.rows[0].count, 10) === 0, `0 orphan purchases without valid supplier`);

    // 8. Orphan Purchase Payments
    const orphanPayRes = await client.query(`
      SELECT count(*) FROM public.purchase_payment pp
      WHERE pp.purchase_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.purchase p WHERE p.id = pp.purchase_id)
    `);
    assert(parseInt(orphanPayRes.rows[0].count, 10) === 0, `0 orphan purchase payments without valid purchase`);

    // 9. Orphan Purchase Allocations
    const orphanAllocRes = await client.query(`
      SELECT count(*) FROM public.purchase_payment_allocation ppa
      WHERE NOT EXISTS (SELECT 1 FROM public.purchase_payment pp WHERE pp.id = ppa.payment_id)
         OR NOT EXISTS (SELECT 1 FROM public.purchase p WHERE p.id = ppa.purchase_id)
    `);
    assert(parseInt(orphanAllocRes.rows[0].count, 10) === 0, `0 orphan purchase payment allocations`);

    // 10. Database Locks Check
    const lockRes = await client.query(`
      SELECT count(*) FROM pg_locks l
      JOIN pg_stat_activity a ON l.pid = a.pid
      WHERE a.pid != pg_backend_pid() AND l.granted = false
    `);
    const lockCount = parseInt(lockRes.rows[0].count, 10);
    assert(lockCount === 0, `0 database deadlocks or ungranted lock contentions (actual: ${lockCount})`);

    // 11. Zero Test Data Residuals
    const testSup = await client.query("SELECT count(*) FROM public.supplier WHERE id LIKE 'sup_c72_%' OR name LIKE '%Test%'");
    assert(parseInt(testSup.rows[0].count, 10) === 0, `0 residual C7.2 test suppliers in DB`);

    const testPur = await client.query("SELECT count(*) FROM public.purchase WHERE id LIKE 'pur_c72_%'");
    assert(parseInt(testPur.rows[0].count, 10) === 0, `0 residual C7.2 test purchases in DB`);

    const testPay = await client.query("SELECT count(*) FROM public.purchase_payment WHERE id LIKE 'purp_%'");
    assert(parseInt(testPay.rows[0].count, 10) === 0, `0 residual C7.2 test purchase payments in DB`);

    const testAlloc = await client.query("SELECT count(*) FROM public.purchase_payment_allocation WHERE id LIKE 'ppa_c72_%'");
    assert(parseInt(testAlloc.rows[0].count, 10) === 0, `0 residual C7.2 test allocations in DB`);

    const testVouchers = await client.query("SELECT count(*) FROM public.accounting_voucher WHERE id LIKE 'v_c72_%' OR id LIKE 'vch_c72_%'");
    assert(parseInt(testVouchers.rows[0].count, 10) === 0, `0 residual C7.2 test vouchers in DB`);

    // 12. Total Trial Balance Baseline
    const tbRes = await client.query(`
      SELECT
        ROUND(COALESCE(SUM(debit_amount), 0), 2) AS total_dr,
        ROUND(COALESCE(SUM(credit_amount), 0), 2) AS total_cr
      FROM public.accounting_journal_line
    `);
    const totalDr = parseFloat(tbRes.rows[0].total_dr);
    const totalCr = parseFloat(tbRes.rows[0].total_cr);
    console.log(`\n  Authoritative Trial Balance: Dr ₹${totalDr.toFixed(2)} = Cr ₹${totalCr.toFixed(2)}`);
    assert(totalDr === 3380.00, `Total Dr === ₹3,380.00 (actual: ₹${totalDr.toFixed(2)})`);
    assert(totalCr === 3380.00, `Total Cr === ₹3,380.00 (actual: ₹${totalCr.toFixed(2)})`);
    assert(totalDr === totalCr, `Trial balance zero-sum integrity hold (difference = 0.00)`);

    // 13. Baseline Voucher, Entry, Line Counts
    const vcRes = await client.query('SELECT count(*) FROM public.accounting_voucher');
    const ecRes = await client.query('SELECT count(*) FROM public.accounting_journal_entry');
    const lcRes = await client.query('SELECT count(*) FROM public.accounting_journal_line');
    assert(parseInt(vcRes.rows[0].count, 10) === 6, `Total vouchers === 6 baseline vouchers (actual: ${vcRes.rows[0].count})`);
    assert(parseInt(ecRes.rows[0].count, 10) === 4, `Total journal entries === 4 baseline entries (actual: ${ecRes.rows[0].count})`);
    assert(parseInt(lcRes.rows[0].count, 10) === 10, `Total journal lines === 10 baseline lines (actual: ${lcRes.rows[0].count})`);

  } finally {
    client.release();
    await pool.end();
  }

  console.log('\n==================================================================');
  console.log(`  AUDIT RESULT: ${passed} PASSED, ${failed} FAILED`);
  console.log('==================================================================\n');

  if (failed > 0) process.exit(1);
}

runAudit().catch(err => {
  console.error("Audit failed:", err);
  process.exit(1);
});
