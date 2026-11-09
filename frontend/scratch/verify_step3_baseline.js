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

async function verifyBaseline() {
  console.log("==================================================================");
  console.log("  POSTGRESQL AUDIT — STEP 3 FORENSIC / DESIGN LOCK               ");
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
    const totalDr = parseFloat(tbRes.rows[0].total_dr);
    const totalCr = parseFloat(tbRes.rows[0].total_cr);
    const diff = parseFloat(tbRes.rows[0].diff);
    assert.strictEqual(totalDr, 3380, `Trial balance Dr must be 3380, got ${totalDr}`);
    assert.strictEqual(totalCr, 3380, `Trial balance Cr must be 3380, got ${totalCr}`);
    assert.strictEqual(diff, 0, `Trial balance diff must be 0, got ${diff}`);
    pass(`Trial Balance strictly balanced: Dr ₹${totalDr.toFixed(2)} = Cr ₹${totalCr.toFixed(2)} (diff ₹${diff.toFixed(2)})`);

    // 3. Accounting vouchers = 6
    const vchRes = await client.query(`SELECT COUNT(*) as count FROM public.accounting_voucher;`);
    const vchCount = parseInt(vchRes.rows[0].count, 10);
    assert.strictEqual(vchCount, 6, `Voucher count must be 6, got ${vchCount}`);
    pass(`Accounting voucher count unchanged (got ${vchCount})`);

    // 4. Journal entries = 4
    const jeRes = await client.query(`SELECT COUNT(*) as count FROM public.accounting_journal_entry;`);
    const jeCount = parseInt(jeRes.rows[0].count, 10);
    assert.strictEqual(jeCount, 4, `Journal entry count must be 4, got ${jeCount}`);
    pass(`Journal entry count unchanged (got ${jeCount})`);

    // 5. Journal lines = 10
    const jlRes = await client.query(`SELECT COUNT(*) as count FROM public.accounting_journal_line;`);
    const jlCount = parseInt(jlRes.rows[0].count, 10);
    assert.strictEqual(jlCount, 10, `Journal line count must be 10, got ${jlCount}`);
    pass(`Journal line count unchanged (got ${jlCount})`);

    // 6. Zero historical cost centre references
    const ccJlRes = await client.query(`SELECT COUNT(*) as count FROM public.accounting_journal_line WHERE cost_centre_id IS NOT NULL;`);
    assert.strictEqual(parseInt(ccJlRes.rows[0].count, 10), 0);
    pass(`Historical journal lines with cost_centre_id = 0`);

    const ccVchRes = await client.query(`SELECT COUNT(*) as count FROM public.accounting_voucher WHERE cost_centre_id IS NOT NULL;`);
    assert.strictEqual(parseInt(ccVchRes.rows[0].count, 10), 0);
    pass(`Historical vouchers with cost_centre_id = 0`);

    // 7. Cost centre master count = 0 (clean baseline)
    const ccRes = await client.query(`SELECT COUNT(*) as count FROM public.cost_centre;`);
    assert.strictEqual(parseInt(ccRes.rows[0].count, 10), 0);
    pass(`Cost centre table has 0 residual rows`);

    // 8. Database locks check
    const lockRes = await client.query(`
      SELECT COUNT(*) as count 
      FROM pg_locks l
      JOIN pg_stat_activity a ON l.pid = a.pid
      WHERE a.query ILIKE '%accounting_%' AND l.granted = false;
    `);
    assert.strictEqual(parseInt(lockRes.rows[0].count, 10), 0);
    pass(`Accounting tables have zero pending locks`);

    console.log(`\nAll ${passed}/${passed} audits passed cleanly.`);
  } catch (err) {
    console.error("Verification failed:", err);
    process.exit(1);
  } finally {
    await client.end();
  }
}

verifyBaseline();
