const { Client } = require('pg');
const fs = require('fs');
const path = require('path');
const assert = require('assert');

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

async function audit() {
  console.log("==================================================================");
  console.log("  INDEPENDENT POSTGRESQL AUDIT — PHASE C7.6 STEP 1                ");
  console.log("==================================================================\n");

  const conn = getConnectionString();
  const client = new Client({ connectionString: conn, ssl: conn.includes('supabase') ? { rejectUnauthorized: false } : false });
  await client.connect();

  let passed = 0;
  function pass(desc) {
    passed++;
    console.log(`  ✓ AUDIT PASS [${passed}]: ${desc}`);
  }

  try {
    // 1. CoA count is exactly 100
    const coaRes = await client.query(`SELECT COUNT(*) as count FROM public.accounting_account;`);
    const coaCount = parseInt(coaRes.rows[0].count, 10);
    assert.strictEqual(coaCount, 100, `CoA must be 100, got ${coaCount}`);
    pass(`Chart of Accounts count is exactly 100 (got ${coaCount})`);

    // 2. Trial balance is strictly balanced at Dr 3380 = Cr 3380
    const tbRes = await client.query(`
      SELECT 
        COALESCE(SUM(debit_amount), 0)::numeric(12,2) as total_dr,
        COALESCE(SUM(credit_amount), 0)::numeric(12,2) as total_cr,
        (COALESCE(SUM(debit_amount), 0) - COALESCE(SUM(credit_amount), 0))::numeric(12,2) as diff
      FROM public.accounting_journal_line;
    `);
    const dr = parseFloat(tbRes.rows[0].total_dr);
    const cr = parseFloat(tbRes.rows[0].total_cr);
    const diff = parseFloat(tbRes.rows[0].diff);
    assert.strictEqual(dr, 3380.00, `Total Dr must be 3380.00, got ${dr}`);
    assert.strictEqual(cr, 3380.00, `Total Cr must be 3380.00, got ${cr}`);
    assert.strictEqual(diff, 0.00, `Trial balance diff must be 0.00, got ${diff}`);
    pass(`Trial Balance strictly balanced: Dr ₹${dr.toFixed(2)} = Cr ₹${cr.toFixed(2)} (diff ₹${diff.toFixed(2)})`);

    // 3. Accounting vouchers count unchanged (exactly 6)
    const vchRes = await client.query(`SELECT COUNT(*) as count FROM public.accounting_voucher;`);
    const vchCount = parseInt(vchRes.rows[0].count, 10);
    assert.strictEqual(vchCount, 6, `Voucher count must be 6, got ${vchCount}`);
    pass(`Accounting voucher count unchanged (got ${vchCount})`);

    // 4. Accounting journal entries count unchanged (exactly 4)
    const jeRes = await client.query(`SELECT COUNT(*) as count FROM public.accounting_journal_entry;`);
    const jeCount = parseInt(jeRes.rows[0].count, 10);
    assert.strictEqual(jeCount, 4, `Journal entry count must be 4, got ${jeCount}`);
    pass(`Accounting journal entry count unchanged (got ${jeCount})`);

    // 5. Accounting journal lines count unchanged (exactly 10)
    const jlRes = await client.query(`SELECT COUNT(*) as count FROM public.accounting_journal_line;`);
    const jlCount = parseInt(jlRes.rows[0].count, 10);
    assert.strictEqual(jlCount, 10, `Journal line count must be 10, got ${jlCount}`);
    pass(`Accounting journal line count unchanged (got ${jlCount})`);

    // 6. Zero vouchers have cost_centre_id
    const vchCcRes = await client.query(`SELECT COUNT(*) as count FROM public.accounting_voucher WHERE cost_centre_id IS NOT NULL;`);
    const vchCcCount = parseInt(vchCcRes.rows[0].count, 10);
    assert.strictEqual(vchCcCount, 0, `Zero vouchers should have cost_centre_id, got ${vchCcCount}`);
    pass(`Zero vouchers have cost_centre_id (got ${vchCcCount})`);

    // 7. Zero journal lines have cost_centre_id
    const jlCcRes = await client.query(`SELECT COUNT(*) as count FROM public.accounting_journal_line WHERE cost_centre_id IS NOT NULL;`);
    const jlCcCount = parseInt(jlCcRes.rows[0].count, 10);
    assert.strictEqual(jlCcCount, 0, `Zero journal lines should have cost_centre_id, got ${jlCcCount}`);
    pass(`Zero journal lines have cost_centre_id (got ${jlCcCount})`);

    // 8. Cost centre table has 0 test rows remaining
    const ccRes = await client.query(`SELECT COUNT(*) as count FROM public.cost_centre;`);
    const ccCount = parseInt(ccRes.rows[0].count, 10);
    assert.strictEqual(ccCount, 0, `Cost centre count must be 0, got ${ccCount}`);
    pass(`Cost centre test data fully cleaned (got ${ccCount} rows in public.cost_centre)`);

    // 9. Zero orphan parent references
    const orphanParRes = await client.query(`
      SELECT COUNT(*) as count 
      FROM public.cost_centre c
      LEFT JOIN public.cost_centre p ON p.id = c.parent_id
      WHERE c.parent_id IS NOT NULL AND p.id IS NULL;
    `);
    const orphanParCount = parseInt(orphanParRes.rows[0].count, 10);
    assert.strictEqual(orphanParCount, 0, `Zero orphan parents, got ${orphanParCount}`);
    pass(`Zero orphan parent references in cost_centre (got ${orphanParCount})`);

    // 10. Zero ungranted database locks
    const lockRes = await client.query(`SELECT COUNT(*) as count FROM pg_locks WHERE NOT granted;`);
    const lockCount = parseInt(lockRes.rows[0].count, 10);
    assert.strictEqual(lockCount, 0, `Zero blocked locks, got ${lockCount}`);
    pass(`Zero blocked database locks (got ${lockCount})`);

    console.log("\n==================================================================");
    console.log(`  POSTGRESQL AUDIT RESULT: ${passed} / 10 CHECKS PASSED (100% Green)`);
    console.log("==================================================================\n");
  } catch (err) {
    console.error("AUDIT FAILED:", err);
    process.exitCode = 1;
  } finally {
    await client.end();
  }
}

audit();
