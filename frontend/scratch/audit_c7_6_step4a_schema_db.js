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

async function auditStep4A() {
  console.log("==================================================================");
  console.log("  INDEPENDENT POSTGRESQL AUDIT — PHASE C7.6 STEP 4A               ");
  console.log("  Cost Allocation Tables, Constraints, and Schema Invariants      ");
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
    // 1. Table existence: All 4 cost allocation tables exist
    const tables = [
      'cost_allocation_rule',
      'cost_allocation_rule_target',
      'cost_allocation_run',
      'cost_allocation_run_line'
    ];
    for (const t of tables) {
      const tRes = await client.query(`
        SELECT count(*)::int as count 
        FROM information_schema.tables 
        WHERE table_schema = 'public' AND table_name = $1;
      `, [t]);
      assert.strictEqual(tRes.rows[0].count, 1, `Table public.${t} must exist`);
      pass(`Table public.${t} exists in information_schema`);
    }

    // 2. Columns verification on cost_allocation_rule
    const ruleCols = await client.query(`
      SELECT column_name, data_type, is_nullable 
      FROM information_schema.columns 
      WHERE table_schema = 'public' AND table_name = 'cost_allocation_rule';
    `);
    const ruleColNames = ruleCols.rows.map(r => r.column_name);
    const expectedRuleCols = [
      'id', 'rule_code', 'name', 'description', 'rule_type',
      'source_cost_centre_id', 'source_account_id', 'version',
      'is_active', 'effective_from', 'effective_to', 'metadata',
      'created_by', 'created_at', 'updated_at', 'deleted_at'
    ];
    for (const col of expectedRuleCols) {
      assert.ok(ruleColNames.includes(col), `cost_allocation_rule must have column ${col}`);
    }
    pass(`public.cost_allocation_rule has all ${expectedRuleCols.length} expected columns`);

    // 3. Columns verification on cost_allocation_rule_target
    const targetCols = await client.query(`
      SELECT column_name, data_type, is_nullable 
      FROM information_schema.columns 
      WHERE table_schema = 'public' AND table_name = 'cost_allocation_rule_target';
    `);
    const targetColNames = targetCols.rows.map(r => r.column_name);
    const expectedTargetCols = [
      'id', 'rule_id', 'target_cost_centre_id', 'target_account_id',
      'percentage', 'sort_order', 'created_at', 'updated_at'
    ];
    for (const col of expectedTargetCols) {
      assert.ok(targetColNames.includes(col), `cost_allocation_rule_target must have column ${col}`);
    }
    pass(`public.cost_allocation_rule_target has all ${expectedTargetCols.length} expected columns`);

    // 4. Columns verification on cost_allocation_run
    const runCols = await client.query(`
      SELECT column_name, data_type, is_nullable 
      FROM information_schema.columns 
      WHERE table_schema = 'public' AND table_name = 'cost_allocation_run';
    `);
    const runColNames = runCols.rows.map(r => r.column_name);
    const expectedRunCols = [
      'id', 'run_number', 'rule_id', 'rule_version', 'fiscal_year',
      'period_name', 'allocation_date', 'source_cost_centre_id',
      'source_account_id', 'total_source_amount', 'total_allocated_amount',
      'rounding_difference', 'status', 'accounting_voucher_id',
      'reversal_voucher_id', 'rule_snapshot', 'narration', 'metadata',
      'executed_by', 'executed_at', 'approved_by', 'approved_at',
      'reversed_by', 'reversed_at', 'reversal_reason'
    ];
    for (const col of expectedRunCols) {
      assert.ok(runColNames.includes(col), `cost_allocation_run must have column ${col}`);
    }
    pass(`public.cost_allocation_run has all ${expectedRunCols.length} expected columns`);

    // 5. Columns verification on cost_allocation_run_line
    const lineCols = await client.query(`
      SELECT column_name, data_type, is_nullable 
      FROM information_schema.columns 
      WHERE table_schema = 'public' AND table_name = 'cost_allocation_run_line';
    `);
    const lineColNames = lineCols.rows.map(r => r.column_name);
    const expectedLineCols = [
      'id', 'run_id', 'source_journal_line_id', 'target_cost_centre_id',
      'target_account_id', 'target_percentage', 'allocated_amount',
      'sort_order', 'created_at'
    ];
    for (const col of expectedLineCols) {
      assert.ok(lineColNames.includes(col), `cost_allocation_run_line must have column ${col}`);
    }
    pass(`public.cost_allocation_run_line has all ${expectedLineCols.length} expected columns`);

    // 6. Foreign Key Constraints Audit
    const fkRes = await client.query(`
      SELECT
        tc.table_name, 
        kcu.column_name, 
        ccu.table_name AS foreign_table_name,
        ccu.column_name AS foreign_column_name,
        tc.constraint_name
      FROM information_schema.table_constraints AS tc 
      JOIN information_schema.key_column_usage AS kcu
        ON tc.constraint_name = kcu.constraint_name
        AND tc.table_schema = kcu.table_schema
      JOIN information_schema.constraint_column_usage AS ccu
        ON ccu.constraint_name = tc.constraint_name
        AND ccu.table_schema = tc.table_schema
      WHERE tc.constraint_type = 'FOREIGN KEY' 
        AND tc.table_schema = 'public'
        AND tc.table_name IN ('cost_allocation_rule', 'cost_allocation_rule_target', 'cost_allocation_run', 'cost_allocation_run_line');
    `);

    const fks = fkRes.rows.map(r => `${r.table_name}.${r.column_name} -> ${r.foreign_table_name}.${r.foreign_column_name}`);
    
    assert.ok(fks.includes('cost_allocation_rule.source_cost_centre_id -> cost_centre.id'), "FK source_cost_centre_id missing");
    assert.ok(fks.includes('cost_allocation_rule.source_account_id -> accounting_account.id'), "FK source_account_id missing");
    assert.ok(fks.includes('cost_allocation_rule_target.rule_id -> cost_allocation_rule.id'), "FK rule_id missing on target");
    assert.ok(fks.includes('cost_allocation_rule_target.target_cost_centre_id -> cost_centre.id'), "FK target_cost_centre_id missing");
    assert.ok(fks.includes('cost_allocation_run.rule_id -> cost_allocation_rule.id'), "FK rule_id missing on run");
    assert.ok(fks.includes('cost_allocation_run.accounting_voucher_id -> accounting_voucher.id'), "FK accounting_voucher_id missing on run");
    assert.ok(fks.includes('cost_allocation_run_line.run_id -> cost_allocation_run.id'), "FK run_id missing on line");
    assert.ok(fks.includes('cost_allocation_run_line.target_cost_centre_id -> cost_centre.id'), "FK target_cost_centre_id missing on line");
    pass(`All foreign key constraints verified across all 4 allocation tables (${fkRes.rows.length} FK constraints)`);

    // 7. Check Constraints Audit
    const chkRes = await client.query(`
      SELECT conname, pg_get_constraintdef(c.oid) as def
      FROM pg_constraint c
      JOIN pg_class t ON c.conrelid = t.oid
      WHERE t.relname IN ('cost_allocation_rule', 'cost_allocation_rule_target', 'cost_allocation_run')
        AND c.contype = 'c';
    `);
    const connames = chkRes.rows.map(r => r.conname);
    assert.ok(connames.includes('chk_cost_allocation_rule_type'), "chk_cost_allocation_rule_type missing");
    assert.ok(connames.includes('chk_target_percentage'), "chk_target_percentage missing");
    assert.ok(connames.includes('chk_cost_allocation_run_status'), "chk_cost_allocation_run_status missing");
    pass(`Check constraints verified by name (chk_cost_allocation_rule_type, chk_target_percentage, chk_cost_allocation_run_status)`);

    // 8. Unique Constraints Audit
    const uqRes = await client.query(`
      SELECT conname, pg_get_constraintdef(c.oid) as def
      FROM pg_constraint c
      JOIN pg_class t ON c.conrelid = t.oid
      WHERE t.relname IN ('cost_allocation_rule', 'cost_allocation_rule_target', 'cost_allocation_run')
        AND c.contype = 'u';
    `);
    const uqDefs = uqRes.rows.map(r => r.def);
    assert.ok(uqDefs.some(d => d.includes('rule_code')), "Unique rule_code constraint missing");
    assert.ok(uqDefs.some(d => d.includes('rule_id, target_cost_centre_id')), "Unique (rule_id, target_cost_centre_id) constraint missing");
    assert.ok(uqDefs.some(d => d.includes('run_number')), "Unique run_number constraint missing");
    pass(`Unique constraints verified (rule_code, rule_id+target_cc, run_number)`);

    // 9. Chart of Accounts invariant: exactly 100 accounts
    const coaRes = await client.query('SELECT count(*)::int as count FROM public.accounting_account;');
    assert.strictEqual(coaRes.rows[0].count, 100, `CoA count must remain 100, got ${coaRes.rows[0].count}`);
    pass(`Chart of Accounts count strictly preserved at exactly 100 accounts`);

    // 10. Trial Balance invariant: Dr ₹3,380.00 = Cr ₹3,380.00
    const tbRes = await client.query(`
      SELECT 
        COALESCE(SUM(debit_amount), 0)::numeric(15,2) as dr,
        COALESCE(SUM(credit_amount), 0)::numeric(15,2) as cr
      FROM public.accounting_journal_line;
    `);
    assert.strictEqual(tbRes.rows[0].dr, tbRes.rows[0].cr, "Trial Balance must balance");
    assert.strictEqual(tbRes.rows[0].dr, '3380.00', "Trial Balance Dr must be 3380.00");
    pass(`Trial Balance strictly balanced at Dr ₹${tbRes.rows[0].dr} === Cr ₹${tbRes.rows[0].cr}`);

    // 11. Accounting voucher count unchanged (6)
    const vRes = await client.query('SELECT count(*)::int as count FROM public.accounting_voucher;');
    assert.strictEqual(vRes.rows[0].count, 6, `Voucher count must remain 6, got ${vRes.rows[0].count}`);
    pass(`Accounting voucher count unchanged (got ${vRes.rows[0].count})`);

    // 12. Accounting journal entry count unchanged (4)
    const jeRes = await client.query('SELECT count(*)::int as count FROM public.accounting_journal_entry;');
    assert.strictEqual(jeRes.rows[0].count, 4, `Journal entry count must remain 4, got ${jeRes.rows[0].count}`);
    pass(`Accounting journal entry count unchanged (got ${jeRes.rows[0].count})`);

    // 13. Accounting journal line count unchanged (10)
    const jlRes = await client.query('SELECT count(*)::int as count FROM public.accounting_journal_line;');
    assert.strictEqual(jlRes.rows[0].count, 10, `Journal line count must remain 10, got ${jlRes.rows[0].count}`);
    pass(`Accounting journal line count unchanged (got ${jlRes.rows[0].count})`);

    // 14. Zero historical cost centre references
    const ccVchRes = await client.query('SELECT count(*)::int as count FROM public.accounting_voucher WHERE cost_centre_id IS NOT NULL;');
    const ccJlRes = await client.query('SELECT count(*)::int as count FROM public.accounting_journal_line WHERE cost_centre_id IS NOT NULL;');
    assert.strictEqual(ccVchRes.rows[0].count, 0, "Historical vouchers must have NULL cost centre");
    assert.strictEqual(ccJlRes.rows[0].count, 0, "Historical lines must have NULL cost centre");
    pass(`Historical vouchers (0) and lines (0) have zero backfill references`);

    // 15. Zero database locks
    const lockRes = await client.query('SELECT count(*)::int as count FROM pg_locks WHERE NOT granted;');
    assert.strictEqual(lockRes.rows[0].count, 0, "Must have zero blocked locks");
    pass(`Database tables have zero pending or ungranted database locks`);

    console.log("\n==================================================================");
    console.log(`  AUDIT SUCCESS: ${passed} / ${passed} CHECKS PASSED (100% Green)`);
    console.log("==================================================================\n");

  } finally {
    await client.end();
  }
}

auditStep4A().catch(err => {
  console.error("Audit failure:", err);
  process.exit(1);
});
