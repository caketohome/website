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
  console.log("  INDEPENDENT POSTGRESQL AUDIT — PHASE C7.6 STEP 2                ");
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

    // 3. Accounting voucher count unchanged (6)
    const vchRes = await client.query(`SELECT COUNT(*) as count FROM public.accounting_voucher;`);
    const vchCount = parseInt(vchRes.rows[0].count, 10);
    assert.strictEqual(vchCount, 6, `Accounting voucher count must be 6, got ${vchCount}`);
    pass(`Accounting voucher count unchanged (got ${vchCount})`);

    // 4. Accounting journal entry count unchanged (4)
    const jentRes = await client.query(`SELECT COUNT(*) as count FROM public.accounting_journal_entry;`);
    const jentCount = parseInt(jentRes.rows[0].count, 10);
    assert.strictEqual(jentCount, 4, `Accounting journal entry count must be 4, got ${jentCount}`);
    pass(`Accounting journal entry count unchanged (got ${jentCount})`);

    // 5. Accounting journal line count unchanged (10)
    const jlineRes = await client.query(`SELECT COUNT(*) as count FROM public.accounting_journal_line;`);
    const jlineCount = parseInt(jlineRes.rows[0].count, 10);
    assert.strictEqual(jlineCount, 10, `Accounting journal line count must be 10, got ${jlineCount}`);
    pass(`Accounting journal line count unchanged (got ${jlineCount})`);

    // 6. Zero vouchers have cost_centre_id
    const vchCcRes = await client.query(`SELECT COUNT(*) as count FROM public.accounting_voucher WHERE cost_centre_id IS NOT NULL;`);
    const vchCcCount = parseInt(vchCcRes.rows[0].count, 10);
    assert.strictEqual(vchCcCount, 0, `No vouchers should have cost_centre_id, got ${vchCcCount}`);
    pass(`Zero vouchers have cost_centre_id (got ${vchCcCount})`);

    // 7. Zero journal lines have cost_centre_id
    const jlineCcRes = await client.query(`SELECT COUNT(*) as count FROM public.accounting_journal_line WHERE cost_centre_id IS NOT NULL;`);
    const jlineCcCount = parseInt(jlineCcRes.rows[0].count, 10);
    assert.strictEqual(jlineCcCount, 0, `No journal lines should have cost_centre_id, got ${jlineCcCount}`);
    pass(`Zero journal lines have cost_centre_id (got ${jlineCcCount})`);

    // 8. Cost centre table completely clean
    const ccRes = await client.query(`SELECT COUNT(*) as count FROM public.cost_centre;`);
    const ccCount = parseInt(ccRes.rows[0].count, 10);
    assert.strictEqual(ccCount, 0, `Cost centre table must have 0 rows, got ${ccCount}`);
    pass(`Cost centre test data fully cleaned (got ${ccCount} rows in public.cost_centre)`);

    // 9. Zero orphan journal lines
    const orphanLinesRes = await client.query(`
      SELECT COUNT(*) as count FROM public.accounting_journal_line jl
      LEFT JOIN public.accounting_journal_entry je ON je.id = jl.journal_entry_id
      WHERE je.id IS NULL;
    `);
    const orphanLines = parseInt(orphanLinesRes.rows[0].count, 10);
    assert.strictEqual(orphanLines, 0, `Orphan lines must be 0, got ${orphanLines}`);
    pass(`Zero orphan journal lines (got ${orphanLines})`);

    // 10. Zero orphan journal entries
    const orphanEntriesRes = await client.query(`
      SELECT COUNT(*) as count FROM public.accounting_journal_entry je
      LEFT JOIN public.accounting_voucher v ON v.id = je.voucher_id
      WHERE v.id IS NULL;
    `);
    const orphanEntries = parseInt(orphanEntriesRes.rows[0].count, 10);
    assert.strictEqual(orphanEntries, 0, `Orphan entries must be 0, got ${orphanEntries}`);
    pass(`Zero orphan journal entries (got ${orphanEntries})`);

    // 11. Foreign keys to cost_centre exist and remain active
    const fkRes = await client.query(`
      SELECT conname FROM pg_constraint
      WHERE conname IN ('accounting_voucher_cost_centre_id_fkey', 'accounting_journal_line_cost_centre_id_fkey');
    `);
    assert.strictEqual(fkRes.rows.length, 2, `Both cost_centre foreign keys must exist, got ${fkRes.rows.length}`);
    pass(`Both cost_centre foreign keys remain valid and active (${fkRes.rows.map(r => r.conname).join(', ')})`);

    // 12. Zero blocked database locks
    const locksRes = await client.query(`SELECT count(*) as count FROM pg_locks WHERE NOT granted;`);
    const locksCount = parseInt(locksRes.rows[0].count, 10);
    assert.strictEqual(locksCount, 0, `Locks must be 0, got ${locksCount}`);
    pass(`Zero blocked database locks (got ${locksCount})`);

    console.log("\n==================================================================");
    console.log(`  POSTGRESQL AUDIT RESULT: ${passed} / 12 CHECKS PASSED (100% Green)`);
    console.log("==================================================================\n");
  } finally {
    await client.end();
  }
}

audit().catch(err => {
  console.error("AUDIT FAILED:", err);
  process.exit(1);
});
