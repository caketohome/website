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

async function verifyStage1() {
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
    console.log('--- Verifying Stage 1 Schema Invariants ---');

    // 1. CoA count is still exactly 100
    const coaRes = await client.query('SELECT count(*) FROM public.accounting_account');
    const coaCount = parseInt(coaRes.rows[0].count, 10);
    assert(coaCount === 100, `CoA count is strictly 100 (got ${coaCount})`);

    // 2. Trial balance is balanced
    const tbRes = await client.query(`
      SELECT 
        COALESCE(SUM(debit_amount), 0) AS dr,
        COALESCE(SUM(credit_amount), 0) AS cr
      FROM public.accounting_journal_line
    `);
    const dr = parseFloat(tbRes.rows[0].dr);
    const cr = parseFloat(tbRes.rows[0].cr);
    assert(dr === 3380 && cr === 3380, `Trial balance is pristine: Dr ₹${dr} === Cr ₹${cr}`);

    // 3. branch_vault_movement table exists with immutability trigger
    const vmCols = await client.query(`
      SELECT column_name, data_type FROM information_schema.columns
      WHERE table_name = 'branch_vault_movement' AND table_schema = 'public'
    `);
    assert(vmCols.rows.length >= 12, `branch_vault_movement columns exist (found ${vmCols.rows.length})`);

    const vmTrig = await client.query(`
      SELECT trigger_name FROM information_schema.triggers
      WHERE event_object_table = 'branch_vault_movement' AND trigger_schema = 'public'
    `);
    assert(vmTrig.rows.some(r => r.trigger_name === 'trg_branch_vault_movement_immutability'), 'branch_vault_movement immutability trigger active');

    // 4. petty_cash_request table exists with SoD constraints
    const pcrCols = await client.query(`
      SELECT column_name FROM information_schema.columns
      WHERE table_name = 'petty_cash_request' AND table_schema = 'public'
    `);
    assert(pcrCols.rows.length >= 20, `petty_cash_request columns exist (found ${pcrCols.rows.length})`);

    const pcrCons = await client.query(`
      SELECT constraint_name FROM information_schema.table_constraints
      WHERE table_name = 'petty_cash_request' AND table_schema = 'public' AND constraint_type = 'CHECK'
    `);
    assert(pcrCons.rows.some(r => r.constraint_name === 'chk_petty_cash_sod_maker_checker'), 'Petty cash Maker != Checker SoD check constraint active');

    // 5. Branch limits seeded
    const unconfBranches = await client.query(`
      SELECT count(*) FROM public.branch
      WHERE metadata->'max_drawer_cash_limit' IS NULL OR metadata->'petty_cash_imprest_limit' IS NULL
    `);
    assert(parseInt(unconfBranches.rows[0].count, 10) === 0, `All branches have configured limits (unconfigured: ${unconfBranches.rows[0].count})`);

    console.log(`\nStage 1 Verification Summary: ${passed} Passed, ${failed} Failed`);
    if (failed > 0) process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

verifyStage1().catch(err => {
  console.error(err);
  process.exit(1);
});
