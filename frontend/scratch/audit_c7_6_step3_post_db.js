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
  throw new Error("DATABASE_URL not found in .env");
}

async function audit() {
  console.log("==================================================================");
  console.log("  INDEPENDENT POSTGRESQL AUDIT — PHASE C7.6 STEP 3                ");
  console.log("==================================================================\n");

  const conn = getConnectionString();
  const client = new Client({
    connectionString: conn,
    ssl: conn.includes('supabase') ? { rejectUnauthorized: false } : false,
  });
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

    // 2. All 100 accounts are active and is_system = true
    const actRes = await client.query(`SELECT COUNT(*) as count FROM public.accounting_account WHERE is_active = true AND is_system = true AND deleted_at IS NULL;`);
    const actCount = parseInt(actRes.rows[0].count, 10);
    assert.strictEqual(actCount, 100, `All accounts must be active system accounts, got ${actCount}`);
    pass(`All 100 accounts are active, system-owned, non-deleted master accounts`);

    // 3. Exactly 24 groups and 76 leaves
    const grpRes = await client.query(`SELECT COUNT(*) as count FROM public.accounting_account WHERE is_group = true;`);
    const leafRes = await client.query(`SELECT COUNT(*) as count FROM public.accounting_account WHERE is_group = false;`);
    assert.strictEqual(parseInt(grpRes.rows[0].count, 10), 24, "Must have 24 group accounts");
    assert.strictEqual(parseInt(leafRes.rows[0].count, 10), 76, "Must have 76 leaf accounts");
    pass(`Hierarchy intact: exactly 24 group headers and 76 leaf posting accounts`);

    // 4. Trial balance is strictly balanced at Dr 3380 = Cr 3380
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

    // 5. Accounting voucher count unchanged (6)
    const vchRes = await client.query(`SELECT COUNT(*) as count FROM public.accounting_voucher;`);
    const vchCount = parseInt(vchRes.rows[0].count, 10);
    assert.strictEqual(vchCount, 6, `Voucher count must be 6, got ${vchCount}`);
    pass(`Accounting voucher count unchanged (got ${vchCount})`);

    // 6. Journal entry count unchanged (4)
    const jeRes = await client.query(`SELECT COUNT(*) as count FROM public.accounting_journal_entry;`);
    const jeCount = parseInt(jeRes.rows[0].count, 10);
    assert.strictEqual(jeCount, 4, `Journal entry count must be 4, got ${jeCount}`);
    pass(`Accounting journal entry count unchanged (got ${jeCount})`);

    // 7. Journal line count unchanged (10)
    const jlRes = await client.query(`SELECT COUNT(*) as count FROM public.accounting_journal_line;`);
    const jlCount = parseInt(jlRes.rows[0].count, 10);
    assert.strictEqual(jlCount, 10, `Journal line count must be 10, got ${jlCount}`);
    pass(`Accounting journal line count unchanged (got ${jlCount})`);

    // 8. Zero historical cost-centre references (no backfill occurred)
    const ccJlRes = await client.query(`SELECT COUNT(*) as count FROM public.accounting_journal_line WHERE cost_centre_id IS NOT NULL;`);
    const ccJlCount = parseInt(ccJlRes.rows[0].count, 10);
    assert.strictEqual(ccJlCount, 0, `Lines with cost_centre_id must be 0, got ${ccJlCount}`);
    pass(`Historical journal lines with cost_centre_id = 0 (Zero backfill invariant preserved)`);

    const ccVchRes = await client.query(`SELECT COUNT(*) as count FROM public.accounting_voucher WHERE cost_centre_id IS NOT NULL;`);
    const ccVchCount = parseInt(ccVchRes.rows[0].count, 10);
    assert.strictEqual(ccVchCount, 0, `Vouchers with cost_centre_id must be 0, got ${ccVchCount}`);
    pass(`Historical vouchers with cost_centre_id = 0 (Zero backfill invariant preserved)`);

    // 9. Residual cost centres = 0
    const ccRes = await client.query(`SELECT COUNT(*) as count FROM public.cost_centre;`);
    const ccCount = parseInt(ccRes.rows[0].count, 10);
    assert.strictEqual(ccCount, 0, `Residual cost centres must be 0, got ${ccCount}`);
    pass(`Cost centre table has 0 residual test rows`);

    // 10. Zero orphan journal lines or entries
    const orpLineRes = await client.query(`
      SELECT COUNT(*) as count FROM public.accounting_journal_line jl
      LEFT JOIN public.accounting_journal_entry je ON jl.journal_entry_id = je.id
      WHERE je.id IS NULL;
    `);
    assert.strictEqual(parseInt(orpLineRes.rows[0].count, 10), 0, "No orphan lines");
    pass(`Zero orphan journal lines without valid journal entries`);

    const orpEntryRes = await client.query(`
      SELECT COUNT(*) as count FROM public.accounting_journal_entry je
      LEFT JOIN public.accounting_voucher v ON je.voucher_id = v.id
      WHERE v.id IS NULL;
    `);
    assert.strictEqual(parseInt(orpEntryRes.rows[0].count, 10), 0, "No orphan entries");
    pass(`Zero orphan journal entries without valid accounting vouchers`);

    // 11. Foreign key constraints to cost_centre exist and active
    const fkRes = await client.query(`
      SELECT conname, confdeltype 
      FROM pg_constraint 
      WHERE conname IN ('accounting_voucher_cost_centre_id_fkey', 'accounting_journal_line_cost_centre_id_fkey');
    `);
    assert.strictEqual(fkRes.rows.length, 2, "Both cost_centre foreign key constraints must exist");
    pass(`Foreign keys accounting_voucher_cost_centre_id_fkey and accounting_journal_line_cost_centre_id_fkey intact`);

    // 12. Zero database locks
    const lockRes = await client.query(`
      SELECT COUNT(*) as count 
      FROM pg_locks l
      JOIN pg_stat_activity a ON l.pid = a.pid
      WHERE a.query ILIKE '%accounting_%' AND l.granted = false;
    `);
    assert.strictEqual(parseInt(lockRes.rows[0].count, 10), 0, "No pending locks");
    pass(`Accounting tables have zero pending or ungranted database locks`);

    console.log(`\n==================================================================`);
    console.log(`  POSTGRESQL AUDIT RESULT: ${passed} PASSED / 0 FAILED (100% Green)`);
    console.log(`==================================================================\n`);
  } catch (err) {
    console.error("AUDIT FAILED:", err);
    process.exit(1);
  } finally {
    await client.end();
  }
}

audit();
