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
  console.log('  INDEPENDENT POSTGRESQL AUDIT — PHASE C7.4 ACCEPTANCE VERIFICATION');
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

    // 2. Exact CoA Account Definitions from Live PostgreSQL
    console.log('\n--- 1. Live CoA Account Definitions & Semantics ---');
    const accountsRes = await client.query(`
      SELECT code, name, type, subtype, is_active, tax_rate, tax_class 
      FROM public.accounting_account 
      WHERE code IN ('1121', '4110', '4120', '4130', '2121', '2122', '2123', '2124', '2125', '2126', '2127', '2128', '2129')
      ORDER BY code
    `);
    const accMap = new Map(accountsRes.rows.map(r => [r.code, r]));

    // 1121
    const a1121 = accMap.get('1121');
    assert(a1121 && a1121.type === 'ASSET' && a1121.subtype === 'RECEIVABLE' && a1121.is_active, 
      `1121 Trade AR: ASSET/RECEIVABLE, active (name: "${a1121?.name}")`);

    // 4110 & 4120 & 4130
    const a4110 = accMap.get('4110');
    assert(a4110 && a4110.type === 'REVENUE' && a4110.subtype === 'DIRECT_REVENUE', 
      `4110 Cake Sales Revenue: REVENUE/DIRECT_REVENUE (name: "${a4110?.name}")`);
    const a4120 = accMap.get('4120');
    assert(a4120 && a4120.type === 'REVENUE' && a4120.subtype === 'DIRECT_REVENUE', 
      `4120 Accessory Sales Revenue: REVENUE/DIRECT_REVENUE (name: "${a4120?.name}")`);
    const a4130 = accMap.get('4130');
    assert(a4130 && a4130.type === 'REVENUE' && a4130.subtype === 'DELIVERY_REVENUE', 
      `4130 Delivery Revenue: REVENUE/DELIVERY_REVENUE (name: "${a4130?.name}")`);

    // 2121 & 2122 (5% Intra)
    const a2121 = accMap.get('2121');
    assert(a2121 && a2121.tax_rate === '2.50' && a2121.tax_class === 'GST_FOOD_5', 
      `2121 Output CGST 2.5% (Food/Bakery): rate=2.50, class=GST_FOOD_5`);
    const a2122 = accMap.get('2122');
    assert(a2122 && a2122.tax_rate === '2.50' && a2122.tax_class === 'GST_FOOD_5', 
      `2122 Output SGST 2.5% (Food/Bakery): rate=2.50, class=GST_FOOD_5`);

    // 2125 (5% Inter)
    const a2125 = accMap.get('2125');
    assert(a2125 && a2125.tax_rate === '5.00' && a2125.tax_class === 'GST_FOOD_5', 
      `2125 Output IGST 5.0% (Interstate Food): rate=5.00, class=GST_FOOD_5`);

    // 2123 & 2124 (18% Intra)
    const a2123 = accMap.get('2123');
    assert(a2123 && a2123.tax_rate === '9.00' && a2123.tax_class === 'GST_STANDARD_18', 
      `2123 Output CGST 9.0% (Accessories): rate=9.00, class=GST_STANDARD_18`);
    const a2124 = accMap.get('2124');
    assert(a2124 && a2124.tax_rate === '9.00' && a2124.tax_class === 'GST_STANDARD_18', 
      `2124 Output SGST 9.0% (Accessories): rate=9.00, class=GST_STANDARD_18`);

    // 2126 (18% Inter)
    const a2126 = accMap.get('2126');
    assert(a2126 && a2126.tax_rate === '18.00' && a2126.tax_class === 'GST_STANDARD_18', 
      `2126 Output IGST 18.0% (Interstate Accessories): rate=18.00, class=GST_STANDARD_18`);

    // 2127 & 2128 (12% Intra)
    const a2127 = accMap.get('2127');
    assert(a2127 && a2127.tax_rate === '6.00' && a2127.tax_class === 'GST_TOYS_12', 
      `2127 Output CGST 6.0% (Toys): rate=6.00, class=GST_TOYS_12`);
    const a2128 = accMap.get('2128');
    assert(a2128 && a2128.tax_rate === '6.00' && a2128.tax_class === 'GST_TOYS_12', 
      `2128 Output SGST 6.0% (Toys): rate=6.00, class=GST_TOYS_12`);

    // 2129 (12% Inter)
    const a2129 = accMap.get('2129');
    assert(a2129 && a2129.tax_rate === '12.00' && a2129.tax_class === 'GST_TOYS_12', 
      `2129 Output IGST 12.0% (Interstate Toys): rate=12.00, class=GST_TOYS_12`);

    // 3. Genuine Commercial Order Integrity
    console.log('\n--- 2. Commercial Order Integrity & Foreign Key Invariants ---');
    // Check foreign key constraint on invoice(order_id)
    const fkRes = await client.query(`
      SELECT conname, pg_get_constraintdef(c.oid) as def
      FROM pg_constraint c
      JOIN pg_namespace n ON n.oid = c.connamespace
      WHERE n.nspname = 'public' AND conrelid = 'public.invoice'::regclass AND c.contype = 'f'
        AND pg_get_constraintdef(c.oid) LIKE '%order%';
    `);
    assert(fkRes.rows.length >= 1, `public.invoice has explicit FOREIGN KEY referencing public.order(id)`);

    // Check zero dummy orders
    const dummyOrdRes = await client.query(`SELECT count(*) FROM public.order WHERE id LIKE 'ord_inv_%'`);
    assert(parseInt(dummyOrdRes.rows[0].count, 10) === 0, `0 auto-created dummy orders (ord_inv_*) exist in public.order`);

    // Check every existing invoice references an existing valid order
    const invalidOrdInvRes = await client.query(`
      SELECT count(*) FROM public.invoice inv
      WHERE NOT EXISTS (SELECT 1 FROM public.order o WHERE o.id = inv.order_id)
    `);
    assert(parseInt(invalidOrdInvRes.rows[0].count, 10) === 0, `100% invoices reference a valid existing commercial order`);

    // 4. Orphan Vouchers, Entries, Lines
    console.log('\n--- 3. Orphan Detection & Relational Integrity ---');
    const orphanVoucherRes = await client.query(`
      SELECT count(*) FROM public.accounting_voucher v
      WHERE NOT EXISTS (SELECT 1 FROM public.branch b WHERE b.id = v.branch_id)
    `);
    assert(parseInt(orphanVoucherRes.rows[0].count, 10) === 0, `0 orphan vouchers without branch attribution`);

    const orphanEntryRes = await client.query(`
      SELECT count(*) FROM public.accounting_journal_entry je
      WHERE NOT EXISTS (SELECT 1 FROM public.accounting_voucher v WHERE v.id = je.voucher_id)
    `);
    assert(parseInt(orphanEntryRes.rows[0].count, 10) === 0, `0 orphan journal entries without linked voucher`);

    const orphanLineRes = await client.query(`
      SELECT count(*) FROM public.accounting_journal_line jl
      WHERE NOT EXISTS (SELECT 1 FROM public.accounting_journal_entry je WHERE je.id = jl.journal_entry_id)
    `);
    assert(parseInt(orphanLineRes.rows[0].count, 10) === 0, `0 orphan journal lines without parent entry`);

    // 5. Customer Receipt Allocations Integrity
    const orphanCraRes = await client.query(`
      SELECT count(*) FROM public.customer_receipt_allocation cra
      WHERE NOT EXISTS (SELECT 1 FROM public.invoice inv WHERE inv.id = cra.invoice_id)
    `);
    assert(parseInt(orphanCraRes.rows[0].count, 10) === 0, `0 orphan customer receipt allocations`);

    // 6. Zero Residual Test Entities from C7.4
    const testCust = await client.query("SELECT count(*) FROM public.customer WHERE id LIKE 'cust_c74_%' OR id LIKE 'cust_corp_%' OR id LIKE 'cust_retail_%' OR id LIKE 'cust_pending_%'");
    assert(parseInt(testCust.rows[0].count, 10) === 0, `0 residual C7.4 test customers in DB`);

    const testInv = await client.query("SELECT count(*) FROM public.invoice WHERE id LIKE 'inv_c74_%' OR id LIKE 'inv_corp_%'");
    assert(parseInt(testInv.rows[0].count, 10) === 0, `0 residual C7.4 test invoices in DB`);

    const testOrders = await client.query("SELECT count(*) FROM public.order WHERE id LIKE 'ord_b2b_%' OR id LIKE 'ord_parallel_%' OR id LIKE 'ord_retail_%' OR id LIKE 'ord_nexus_%'");
    assert(parseInt(testOrders.rows[0].count, 10) === 0, `0 residual C7.4 test commercial orders in DB`);

    const testVouchers = await client.query("SELECT count(*) FROM public.accounting_voucher WHERE id LIKE 'vch_c74_%' OR reference_event = 'CORPORATE_RECEIPT_SETTLEMENT'");
    assert(parseInt(testVouchers.rows[0].count, 10) === 0, `0 residual C7.4 test vouchers in DB`);

    const testNotif = await client.query("SELECT count(*) FROM public.notification WHERE trigger_type = 'PAYMENT_REMINDER' AND id LIKE 'notif_c74_%'");
    assert(parseInt(testNotif.rows[0].count, 10) === 0, `0 residual C7.4 test notifications in DB`);

    // 7. Retail Zero Credit Policy Invariant across Database
    console.log('\n--- 4. Credit Policy & Locking Invariants ---');
    const retailCreditRes = await client.query(`
      SELECT count(*) FROM public.customer 
      WHERE (is_corporate IS FALSE OR is_corporate IS NULL) 
        AND (credit_enabled IS TRUE OR credit_limit > 0)
    `);
    assert(parseInt(retailCreditRes.rows[0].count, 10) === 0, `100% retail customers strictly zero credit enabled (found: ${retailCreditRes.rows[0].count})`);

    // 8. Database Locks & Deadlock Check
    const lockRes = await client.query(`
      SELECT count(*) FROM pg_locks l
      JOIN pg_stat_activity a ON l.pid = a.pid
      WHERE a.pid != pg_backend_pid() AND l.granted = false
    `);
    const lockCount = parseInt(lockRes.rows[0].count, 10);
    assert(lockCount === 0, `0 database deadlocks or ungranted lock contentions (actual: ${lockCount})`);

    // 9. Baseline Counts: Vouchers, Entries, Lines
    console.log('\n--- 5. Authoritative Baseline & Trial Balance Verification ---');
    const vcRes = await client.query('SELECT count(*) FROM public.accounting_voucher');
    const ecRes = await client.query('SELECT count(*) FROM public.accounting_journal_entry');
    const lcRes = await client.query('SELECT count(*) FROM public.accounting_journal_line');
    assert(parseInt(vcRes.rows[0].count, 10) === 6, `Total vouchers === 6 baseline vouchers (actual: ${vcRes.rows[0].count})`);
    assert(parseInt(ecRes.rows[0].count, 10) === 4, `Total journal entries === 4 baseline entries (actual: ${ecRes.rows[0].count})`);
    assert(parseInt(lcRes.rows[0].count, 10) === 10, `Total journal lines === 10 baseline lines (actual: ${lcRes.rows[0].count})`);

    // 10. Authoritative Trial Balance Baseline
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
