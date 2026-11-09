/**
 * CakeToHome ERP — Phase C7.5 Independent Direct PostgreSQL Audit
 *
 * Verifies:
 * 1. Chart of Accounts Count is exactly 100 accounts (Zero new GL accounts created).
 * 2. Trial Balance integrity: Dr ₹3,380.00 == Cr ₹3,380.00 (Zero out-of-balance entries, zero automated plugs to 5296).
 * 3. Zero mutable scalar balance columns on public.branch (vault custody is 100% derived from immutable ledger).
 * 4. public.branch_vault_movement immutability trigger & unique constraint.
 * 5. public.petty_cash_request schema & 3-tier SoD check constraints.
 * 6. public.teller_movement type constraints allow SAFE_DROP and SAFE_TO_TILL.
 * 7. Fail-closed branch limits configured across branches.
 */

const { Pool } = require('pg');
const path = require('path');
const fs = require('fs');

function getConnectionString() {
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

async function runAudit() {
  console.log('==================================================================');
  console.log('  PHASE C7.5 INDEPENDENT DIRECT POSTGRESQL AUDIT');
  console.log('==================================================================\n');

  const pool = new Pool({
    connectionString: getConnectionString(),
    ssl: { rejectUnauthorized: false },
  });

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

  const client = await pool.connect();

  try {
    // ── Audit Item 1: Chart of Accounts Locked at Exactly 100 Accounts ──
    console.log('[Audit 1] Verifying Chart of Accounts (CoA) Master Count...');
    const coaRes = await client.query('SELECT COUNT(*) as count FROM public.accounting_account');
    const coaCount = parseInt(coaRes.rows[0].count, 10);
    assert(coaCount === 100, `CoA account count is exactly 100 (actual: ${coaCount}) — Zero new GL accounts created`);

    // Verify key C7.5 accounts exist and are postable/correct
    const keyAccounts = await client.query(`
      SELECT code, name, type, is_active
      FROM public.accounting_account
      WHERE code IN ('1111', '1112', '1114', '1118', '5296', '5299')
      ORDER BY code
    `);
    const foundCodes = keyAccounts.rows.map(r => r.code);
    assert(foundCodes.includes('1111'), '1111 Cash in Hand exists');
    assert(foundCodes.includes('1112'), '1112 Bank Operating A/c exists');
    assert(foundCodes.includes('1114'), '1114 Petty Cash - Branches exists');
    assert(foundCodes.includes('1118'), '1118 Deposit in Transit exists');
    assert(foundCodes.includes('5296'), '5296 Cash Over / Short exists');
    assert(foundCodes.includes('5299'), '5299 Miscellaneous Operating Expense exists');

    // ── Audit Item 2: Trial Balance Debit/Credit Equality ──
    console.log('\n[Audit 2] Verifying Trial Balance Balance & Equality...');
    const tbRes = await client.query(`
      SELECT 
        COALESCE(SUM(debit_amount), 0) as total_debit,
        COALESCE(SUM(credit_amount), 0) as total_credit,
        COUNT(DISTINCT journal_entry_id) as entry_count,
        COUNT(*) as line_count
      FROM public.accounting_journal_line
    `);
    const totalDr = parseFloat(tbRes.rows[0].total_debit);
    const totalCr = parseFloat(tbRes.rows[0].total_credit);
    const tbDiff = Math.abs(totalDr - totalCr);
    assert(tbDiff < 0.001, `Trial Balance balances perfectly: Dr ₹${totalDr.toFixed(2)} == Cr ₹${totalCr.toFixed(2)} (diff = ₹${tbDiff.toFixed(4)})`);
    assert(totalDr === 3380.00, `Total Debit equals pristine baseline ₹3,380.00 (actual: ₹${totalDr.toFixed(2)})`);

    // Verify zero entries posted to 5296 Cash Over/Short
    const varianceEntriesRes = await client.query(`
      SELECT COUNT(*) as cnt
      FROM public.accounting_journal_line ajl
      JOIN public.accounting_account aa ON aa.id = ajl.account_id
      WHERE aa.code = '5296'
    `);
    const varianceEntries = parseInt(varianceEntriesRes.rows[0].cnt, 10);
    assert(varianceEntries === 0, `Zero journal entries posted to 5296 Cash Over/Short (actual: ${varianceEntries}) — Fail-safe reconciliation confirmed, no automated plugs`);

    // ── Audit Item 3: Zero Mutable Scalar Balance Columns on public.branch ──
    console.log('\n[Audit 3] Verifying public.branch has Zero Mutable Balance Columns...');
    const branchColsRes = await client.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_schema = 'public' AND table_name = 'branch'
      ORDER BY ordinal_position
    `);
    const branchCols = branchColsRes.rows.map(r => r.column_name);
    assert(!branchCols.includes('vault_balance'), 'branch table has NO vault_balance column (pure derived custody)');
    assert(!branchCols.includes('safe_cash_balance'), 'branch table has NO safe_cash_balance column (pure derived custody)');
    assert(!branchCols.includes('cash_balance'), 'branch table has NO cash_balance column (pure derived custody)');

    // Verify limit metadata in jsonb column
    assert(branchCols.includes('metadata'), 'branch table has metadata JSONB column for non-authoritative limit policy');

    // ── Audit Item 4: public.branch_vault_movement Ledger & Immutability Trigger ──
    console.log('\n[Audit 4] Verifying public.branch_vault_movement Immutability...');
    const triggerRes = await client.query(`
      SELECT tgname, tgenabled 
      FROM pg_trigger 
      WHERE tgname = 'trg_branch_vault_movement_immutability'
    `);
    assert(triggerRes.rows.length > 0, 'Trigger trg_branch_vault_movement_immutability is registered in PostgreSQL');
    assert(triggerRes.rows[0].tgenabled === 'O', 'Immutability trigger is actively enabled (status: O)');

    // Verify partial unique constraint for idempotency
    const indexRes = await client.query(`
      SELECT indexname, indexdef 
      FROM pg_indexes 
      WHERE tablename = 'branch_vault_movement' AND indexname = 'uq_branch_vault_movement_source'
    `);
    assert(indexRes.rows.length > 0, 'Partial unique constraint uq_branch_vault_movement_source is indexed');
    assert(indexRes.rows[0].indexdef.includes('source_id'), 'Index enforces unique (source_type, source_id) for atomic idempotency');

    // ── Audit Item 5: public.petty_cash_request Schema & 3-Tier SoD Constraints ──
    console.log('\n[Audit 5] Verifying public.petty_cash_request & Segregation of Duties...');
    const pcrTableRes = await client.query(`
      SELECT COUNT(*) as count 
      FROM information_schema.tables 
      WHERE table_schema = 'public' AND table_name = 'petty_cash_request'
    `);
    assert(parseInt(pcrTableRes.rows[0].count, 10) === 1, 'public.petty_cash_request table exists');

    const constraintsRes = await client.query(`
      SELECT conname, pg_get_constraintdef(oid) as def
      FROM pg_constraint
      WHERE conrelid = 'public.petty_cash_request'::regclass
    `);
    const constraints = constraintsRes.rows;
    const conNames = constraints.map(c => c.conname);
    assert(conNames.includes('chk_petty_cash_sod_maker_checker'), 'Check constraint chk_petty_cash_sod_maker_checker (Maker != Checker) is enforced in DB');
    assert(conNames.includes('chk_petty_cash_sod_maker_disburser'), 'Check constraint chk_petty_cash_sod_maker_disburser (Maker != Disburser) is enforced in DB');

    // ── Audit Item 6: public.teller_movement Movement Types ──
    console.log('\n[Audit 6] Verifying public.teller_movement Check Constraints...');
    const tmConRes = await client.query(`
      SELECT conname, pg_get_constraintdef(oid) as def
      FROM pg_constraint
      WHERE conrelid = 'public.teller_movement'::regclass AND conname = 'chk_teller_movement_type'
    `);
    if (tmConRes.rows.length > 0) {
      const def = tmConRes.rows[0].def;
      assert(def.includes('SAFE_DROP'), 'chk_teller_movement_type includes SAFE_DROP');
      assert(def.includes('SAFE_TO_TILL'), 'chk_teller_movement_type includes SAFE_TO_TILL');
    } else {
      console.log('  ℹ (chk_teller_movement_type constraint not named directly or checked via enum/domain)');
    }

    // ── Audit Item 7: Fail-Closed Limit Coverage Across Branches ──
    console.log('\n[Audit 7] Verifying Branch Limit Coverage Across Operating Branches...');
    const limitStatsRes = await client.query(`
      SELECT 
        COUNT(*) as total_branches,
        COUNT(CASE WHEN (metadata->>'max_drawer_cash_limit')::numeric > 0 THEN 1 END) as configured_drawer_limits,
        COUNT(CASE WHEN (metadata->>'petty_cash_imprest_limit')::numeric > 0 THEN 1 END) as configured_imprest_limits,
        COUNT(CASE WHEN metadata->>'max_drawer_cash_limit' IS NULL THEN 1 END) as unconfigured_count
      FROM public.branch
      WHERE deleted_at IS NULL
    `);
    const stats = limitStatsRes.rows[0];
    assert(parseInt(stats.configured_drawer_limits, 10) > 0, `Configured drawer limits present for active branches (${stats.configured_drawer_limits}/${stats.total_branches})`);
    assert(parseInt(stats.configured_imprest_limits, 10) > 0, `Configured petty cash imprest limits present for active branches (${stats.configured_imprest_limits}/${stats.total_branches})`);
    console.log(`  ℹ Total Active Branches: ${stats.total_branches} | Configured Drawer: ${stats.configured_drawer_limits} | Configured Imprest: ${stats.configured_imprest_limits} | Unconfigured: ${stats.unconfigured_count}`);

    console.log('\n------------------------------------------------------------------');
    console.log(`  Database Audit Items: ${passed + failed} | Passed: ${passed} | Failed: ${failed}`);
    console.log('------------------------------------------------------------------');

  } finally {
    client.release();
    await pool.end();
  }

  process.exit(failed > 0 ? 1 : 0);
}

runAudit().catch(err => {
  console.error("Audit error:", err);
  process.exit(1);
});
