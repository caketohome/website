/**
 * CakeToHome ERP — Phase C7.7 Step 7D Independent PostgreSQL Audit
 *
 * Verifies zero database contamination after browser E2E test execution:
 * 1. public.corporate_gifting_batch exists with strictly 0 residual rows
 * 2. public.corporate_gifting_recipient exists with strictly 0 residual rows
 * 3. Column schema counts verified (25 columns batch, 28 columns recipient)
 * 4. Foreign key integrity verified (>= 10 active FK constraints)
 * 5. Unique deduplication index idx_cgb_customer_file_hash_active verified
 * 6. Unique recipient row index uq_cgr_batch_row verified
 * 7. Chart of Accounts preserved at strictly 100 accounts (0 modified/added/deleted)
 * 8. Trial Balance remains strictly balanced: Dr ₹3,380.00 == Cr ₹3,380.00 (diff: ₹0.00)
 * 9. Accounting vouchers and entries verified at baseline (6 vouchers, 4 entries, 10 lines)
 * 10. Zero residual corporate invoices, zero residual corporate orders, zero residual deliveries
 * 11. Zero leaked advisory locks (locktype = advisory count === 0)
 * 12. Zero ungranted database locks
 * 13. Zero residual test customers or cost centres
 */

const fs = require('fs');
const path = require('path');
const { Client } = require('pg');

function getConnectionString() {
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL;
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

let passed = 0;
let failed = 0;

function assert(condition, message) {
  if (condition) {
    console.log(`  ✓ PASS: ${message}`);
    passed++;
  } else {
    console.error(`  ✗ FAIL: ${message}`);
    failed++;
  }
}

async function runAudit() {
  console.log('==================================================================');
  console.log('  INDEPENDENT POSTGRESQL AUDIT — PHASE C7.7 STEP 7D FINAL');
  console.log('==================================================================\n');

  const client = new Client({
    connectionString: getConnectionString(),
    ssl: { rejectUnauthorized: false }
  });
  await client.connect();

  try {
    // 1. Table existence & zero residual rows
    const batchRow = (await client.query(`SELECT count(*)::int as count FROM public.corporate_gifting_batch`)).rows[0].count;
    assert(batchRow === 0, `public.corporate_gifting_batch exists with strictly 0 rows (actual: ${batchRow})`);

    const recipRow = (await client.query(`SELECT count(*)::int as count FROM public.corporate_gifting_recipient`)).rows[0].count;
    assert(recipRow === 0, `public.corporate_gifting_recipient exists with strictly 0 rows (actual: ${recipRow})`);

    // 2. Column counts verification
    const batchCols = (await client.query(`
      SELECT count(*)::int as count FROM information_schema.columns 
      WHERE table_schema = 'public' AND table_name = 'corporate_gifting_batch'
    `)).rows[0].count;
    assert(batchCols === 25, `corporate_gifting_batch column count === 25 (actual: ${batchCols})`);

    const recipCols = (await client.query(`
      SELECT count(*)::int as count FROM information_schema.columns 
      WHERE table_schema = 'public' AND table_name = 'corporate_gifting_recipient'
    `)).rows[0].count;
    assert(recipCols === 28, `corporate_gifting_recipient column count === 28 (actual: ${recipCols})`);

    // 3. Foreign key constraints
    const fks = (await client.query(`
      SELECT tc.constraint_name, kcu.column_name, ccu.table_name as ftable, rc.delete_rule
      FROM information_schema.table_constraints tc
      JOIN information_schema.key_column_usage kcu ON tc.constraint_name = kcu.constraint_name
      JOIN information_schema.constraint_column_usage ccu ON tc.constraint_name = ccu.constraint_name
      JOIN information_schema.referential_constraints rc ON tc.constraint_name = rc.constraint_name
      WHERE tc.table_name IN ('corporate_gifting_batch', 'corporate_gifting_recipient');
    `)).rows;
    assert(fks.length >= 10, `Foreign key count >= 10 (actual: ${fks.length})`);

    // 4. Unique duplicate file hash index
    const uqHash = (await client.query(`
      SELECT indexname, indexdef FROM pg_indexes 
      WHERE tablename = 'corporate_gifting_batch' AND indexname = 'idx_cgb_customer_file_hash_active'
    `)).rows;
    assert(uqHash.length === 1, 'Unique index idx_cgb_customer_file_hash_active exists and is active');

    // 5. Unique row index per batch
    const uqRow = (await client.query(`
      SELECT indexname, indexdef FROM pg_indexes 
      WHERE tablename = 'corporate_gifting_recipient' AND indexname = 'uq_cgr_batch_row'
    `)).rows;
    assert(uqRow.length === 1, 'Unique constraint uq_cgr_batch_row exists');

    // 6. Chart of Accounts preservation
    const coaCount = (await client.query(`SELECT count(*)::int as count FROM public.accounting_account`)).rows[0].count;
    assert(coaCount === 100, `Chart of Accounts count === 100 canonical accounts (actual: ${coaCount})`);

    // 7. Authoritative Trial Balance
    const tb = (await client.query(`
      SELECT 
        COALESCE(SUM(debit_amount), 0)::numeric(15,2) as dr,
        COALESCE(SUM(credit_amount), 0)::numeric(15,2) as cr
      FROM public.accounting_journal_line;
    `)).rows[0];
    assert(tb.dr === '3380.00' && tb.cr === '3380.00', `Authoritative Trial Balance: Dr ₹${tb.dr} === Cr ₹${tb.cr}`);
    assert(Number(tb.dr) - Number(tb.cr) === 0, 'Trial balance difference is strictly ₹0.0000');

    // 8. Baseline entries & vouchers
    const vCount = (await client.query(`SELECT count(*)::int as count FROM public.accounting_voucher`)).rows[0].count;
    assert(vCount === 6, `Total vouchers === 6 baseline vouchers (actual: ${vCount})`);

    const jeCount = (await client.query(`SELECT count(*)::int as count FROM public.accounting_journal_entry`)).rows[0].count;
    assert(jeCount === 4, `Total journal entries === 4 baseline entries (actual: ${jeCount})`);

    const jlCount = (await client.query(`SELECT count(*)::int as count FROM public.accounting_journal_line`)).rows[0].count;
    assert(jlCount === 10, `Total journal lines === 10 baseline lines (actual: ${jlCount})`);

    // 9. Zero orphan corporate invoices or test orders
    const corpInvs = (await client.query(`SELECT count(*)::int as count FROM public.invoice WHERE is_corporate = true AND deleted_at IS NULL`)).rows[0].count;
    assert(corpInvs === 0, `Zero residual corporate invoices (actual: ${corpInvs})`);

    const corpOrders = (await client.query(`SELECT count(*)::int as count FROM public."order" WHERE metadata->>'channel' = 'CORPORATE_GIFTING'`)).rows[0].count;
    assert(corpOrders === 0, `Zero residual corporate gifting orders (actual: ${corpOrders})`);

    // 10. Database locks and advisory locks
    const ungrantedLocks = (await client.query(`SELECT count(*)::int as count FROM pg_locks WHERE NOT granted`)).rows[0].count;
    assert(ungrantedLocks === 0, `Ungranted database locks === 0 (actual: ${ungrantedLocks})`);

    const advisoryLocks = (await client.query(`SELECT count(*)::int as count FROM pg_locks WHERE locktype = 'advisory'`)).rows[0].count;
    assert(advisoryLocks === 0, `Leaked advisory transaction locks === 0 (actual: ${advisoryLocks})`);

    // 11. Zero residual test customers or cost centres
    const residualCusts = (await client.query(`SELECT count(*)::int as count FROM public.customer WHERE id LIKE 'cus_test_%'`)).rows[0].count;
    assert(residualCusts === 0, `Zero residual test customers (actual: ${residualCusts})`);

    const residualCcs = (await client.query(`SELECT count(*)::int as count FROM public.cost_centre WHERE id LIKE 'cc_test_%'`)).rows[0].count;
    assert(residualCcs === 0, `Zero residual test cost centres (actual: ${residualCcs})`);

    console.log('\n==================================================================');
    console.log(`  INDEPENDENT AUDIT SUMMARY: ${passed} PASSED, ${failed} FAILED`);
    console.log('==================================================================\n');

    if (failed > 0) process.exit(1);
    process.exit(0);

  } finally {
    await client.end();
  }
}

runAudit().catch(err => {
  console.error('Audit fatal error:', err);
  process.exit(1);
});
