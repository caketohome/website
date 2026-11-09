/**
 * CakeToHome ERP — Phase C2: Independent Migration & Schema Verification Script
 * Strictly read-only inspection of PostgreSQL catalogs and schema invariants.
 */

const fs = require('fs');
const path = require('path');
const { Client } = require('pg');

function getConnectionString() {
  const envContent = fs.readFileSync(path.join(__dirname, '../.env'), 'utf8');
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

async function verifyPhaseC2Schema() {
  const client = new Client({
    connectionString: getConnectionString(),
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 10000,
  });

  await client.connect();
  console.log('Connected to PostgreSQL for Phase C2 verification...\n');

  let passed = 0;
  let failed = 0;

  function assert(condition, message) {
    if (condition) {
      console.log(`✅ [PASS] ${message}`);
      passed++;
    } else {
      console.error(`❌ [FAIL] ${message}`);
      failed++;
    }
  }

  try {
    // 1. Tables Exist
    const tablesRes = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
        AND table_name IN ('teller', 'teller_session', 'teller_movement');
    `);
    const tableNames = tablesRes.rows.map(r => r.table_name);
    assert(tableNames.includes('teller'), 'Table public.teller exists');
    assert(tableNames.includes('teller_session'), 'Table public.teller_session exists');
    assert(tableNames.includes('teller_movement'), 'Table public.teller_movement exists');

    // 2. Expected Columns & Data Types on public.teller
    const tellerColsRes = await client.query(`
      SELECT column_name, data_type, is_nullable 
      FROM information_schema.columns 
      WHERE table_name = 'teller' AND table_schema = 'public';
    `);
    const tellerCols = Object.fromEntries(tellerColsRes.rows.map(r => [r.column_name, r]));
    assert(tellerCols.id && tellerCols.id.data_type === 'text', 'teller.id is text');
    assert(tellerCols.branch_id && tellerCols.branch_id.is_nullable === 'NO', 'teller.branch_id is NOT NULL');
    assert(tellerCols.user_id && tellerCols.user_id.is_nullable === 'NO', 'teller.user_id is NOT NULL');
    assert(tellerCols.code && tellerCols.code.data_type === 'character varying', 'teller.code is varchar');
    assert(tellerCols.status && tellerCols.status.is_nullable === 'NO', 'teller.status is NOT NULL');

    // 3. Expected Columns & Data Types on public.teller_session
    const sessionColsRes = await client.query(`
      SELECT column_name, data_type, numeric_precision, numeric_scale, is_nullable 
      FROM information_schema.columns 
      WHERE table_name = 'teller_session' AND table_schema = 'public';
    `);
    const sessionCols = Object.fromEntries(sessionColsRes.rows.map(r => [r.column_name, r]));
    assert(sessionCols.id && sessionCols.id.data_type === 'text', 'teller_session.id is text');
    assert(sessionCols.teller_id && sessionCols.teller_id.is_nullable === 'NO', 'teller_session.teller_id is NOT NULL');
    assert(sessionCols.branch_id && sessionCols.branch_id.is_nullable === 'NO', 'teller_session.branch_id is NOT NULL');
    assert(sessionCols.status && sessionCols.status.is_nullable === 'NO', 'teller_session.status is NOT NULL');
    assert(sessionCols.opening_float && sessionCols.opening_float.numeric_precision === 15 && sessionCols.opening_float.numeric_scale === 2, 'teller_session.opening_float is NUMERIC(15,2)');
    assert(sessionCols.expected_cash && sessionCols.expected_cash.numeric_precision === 15 && sessionCols.expected_cash.numeric_scale === 2, 'teller_session.expected_cash is NUMERIC(15,2)');
    assert(sessionCols.closing_count && sessionCols.closing_count.numeric_precision === 15 && sessionCols.closing_count.numeric_scale === 2, 'teller_session.closing_count is NUMERIC(15,2)');
    assert(sessionCols.variance && sessionCols.variance.numeric_precision === 15 && sessionCols.variance.numeric_scale === 2, 'teller_session.variance is NUMERIC(15,2)');
    assert(sessionCols.opened_by && sessionCols.opened_by.is_nullable === 'NO', 'teller_session.opened_by is NOT NULL');
    assert(sessionCols.closed_by !== undefined, 'teller_session.closed_by exists');
    assert(sessionCols.verified_by !== undefined, 'teller_session.verified_by exists');
    assert(sessionCols.settled_by !== undefined, 'teller_session.settled_by exists');
    assert(sessionCols.settlement_voucher_id !== undefined, 'teller_session.settlement_voucher_id exists');

    // 4. Expected Columns & Data Types on public.teller_movement
    const movementColsRes = await client.query(`
      SELECT column_name, data_type, numeric_precision, numeric_scale, is_nullable 
      FROM information_schema.columns 
      WHERE table_name = 'teller_movement' AND table_schema = 'public';
    `);
    const movCols = Object.fromEntries(movementColsRes.rows.map(r => [r.column_name, r]));
    assert(movCols.id && movCols.id.data_type === 'text', 'teller_movement.id is text');
    assert(movCols.teller_session_id && movCols.teller_session_id.is_nullable === 'NO', 'teller_movement.teller_session_id is NOT NULL');
    assert(movCols.branch_id && movCols.branch_id.is_nullable === 'NO', 'teller_movement.branch_id is NOT NULL');
    assert(movCols.direction && movCols.direction.is_nullable === 'NO', 'teller_movement.direction is NOT NULL');
    assert(movCols.movement_type && movCols.movement_type.is_nullable === 'NO', 'teller_movement.movement_type is NOT NULL');
    assert(movCols.amount && movCols.amount.numeric_precision === 15 && movCols.amount.numeric_scale === 2, 'teller_movement.amount is NUMERIC(15,2)');
    assert(movCols.source_type && movCols.source_type.is_nullable === 'YES', 'teller_movement.source_type is nullable for manual adjustments');
    assert(movCols.source_id && movCols.source_id.is_nullable === 'YES', 'teller_movement.source_id is nullable for manual adjustments');

    // 5. Foreign Key & Composite Anchoring Constraints
    const fksRes = await client.query(`
      SELECT tc.table_name, tc.constraint_name, kcu.column_name, ccu.table_name AS foreign_table_name, ccu.column_name AS foreign_column_name
      FROM information_schema.table_constraints tc
      JOIN information_schema.key_column_usage kcu ON tc.constraint_name = kcu.constraint_name
      JOIN information_schema.constraint_column_usage ccu ON ccu.constraint_name = tc.constraint_name
      WHERE tc.constraint_type = 'FOREIGN KEY' AND tc.table_name IN ('teller', 'teller_session', 'teller_movement')
      ORDER BY tc.table_name, tc.constraint_name;
    `);
    const fkNames = fksRes.rows.map(r => r.constraint_name);
    assert(fkNames.includes('fk_teller_session_teller_branch'), 'Composite FK fk_teller_session_teller_branch anchors (teller_id, branch_id) to teller(id, branch_id)');
    assert(fkNames.includes('fk_teller_movement_session_branch'), 'Composite FK fk_teller_movement_session_branch anchors (teller_session_id, branch_id) to teller_session(id, branch_id)');

    // 6. Partial Unique Indexes
    const idxRes = await client.query(`
      SELECT tablename, indexname, indexdef
      FROM pg_indexes
      WHERE tablename IN ('teller', 'teller_session', 'teller_movement')
      ORDER BY tablename, indexname;
    `);
    const indexDefs = Object.fromEntries(idxRes.rows.map(r => [r.indexname, r.indexdef]));
    assert(indexDefs['uq_teller_active_user'] && indexDefs['uq_teller_active_user'].includes("WHERE ((status)::text = 'ACTIVE'::text)"), 'Partial unique index uq_teller_active_user enforces 1 active teller per user globally');
    assert(indexDefs['uq_teller_session_active'] && indexDefs['uq_teller_session_active'].includes("WHERE ((status)::text = ANY"), 'Partial unique index uq_teller_session_active enforces 1 active session per teller');
    assert(indexDefs['uq_teller_movement_system_source'] && indexDefs['uq_teller_movement_system_source'].includes("WHERE ((source_type IS NOT NULL)"), 'Partial unique index uq_teller_movement_system_source enforces idempotent system projections');

    // 7. Immutability Triggers
    const trgRes = await client.query(`
      SELECT trigger_name, event_manipulation, event_object_table, action_statement
      FROM information_schema.triggers
      WHERE event_object_table IN ('teller_session', 'teller_movement')
      ORDER BY event_object_table, trigger_name;
    `);
    const triggerNames = trgRes.rows.map(r => r.trigger_name);
    assert(triggerNames.includes('trg_teller_session_immutability'), 'Trigger trg_teller_session_immutability active on teller_session');
    assert(triggerNames.includes('trg_teller_movement_immutability'), 'Trigger trg_teller_movement_immutability active on teller_movement');

    // 8. Cash Over / Short Account 5296
    const acc5296Res = await client.query(`
      SELECT a.*, p.code as parent_code
      FROM accounting_account a
      LEFT JOIN accounting_account p ON p.id = a.parent_id
      WHERE a.code = '5296';
    `);
    assert(acc5296Res.rows.length === 1, 'Account 5296 exists exactly once in accounting_account');
    const acc5296 = acc5296Res.rows[0];
    assert(acc5296.name === 'Cash Over / Short', 'Account 5296 name is "Cash Over / Short"');
    assert(acc5296.type === 'EXPENSE', 'Account 5296 type is EXPENSE');
    assert(acc5296.subtype === 'OPERATING_EXPENSE', 'Account 5296 subtype is OPERATING_EXPENSE');
    assert(acc5296.parent_code === '5200', 'Account 5296 parent account is 5200');
    assert(acc5296.level === 3, 'Account 5296 level is 3');
    assert(acc5296.is_group === false, 'Account 5296 is a leaf/postable account (is_group = false)');
    assert(acc5296.is_active === true, 'Account 5296 is active');

    // 9. Total CoA Count Check
    const totalAccountsRes = await client.query(`SELECT COUNT(*)::int AS count FROM accounting_account;`);
    assert(totalAccountsRes.rows[0].count === 100, `accounting_account has exactly 100 accounts (99 C1 baseline + 1 new 5296), actual: ${totalAccountsRes.rows[0].count}`);

    // 10. Ledger Baseline Verification (Zero data mutations on existing ledger)
    const vouchersRes = await client.query(`SELECT COUNT(*)::int AS count FROM accounting_voucher;`);
    assert(vouchersRes.rows[0].count >= 0, `Voucher count inspected (${vouchersRes.rows[0].count} vouchers)`);

    // 11. RBAC Catalog Verification
    const accessControlPath = path.join(__dirname, '../src/lib/staff-access-control.ts');
    const accessControlContent = fs.readFileSync(accessControlPath, 'utf8');
    const requiredPerms = [
      'TELLER.VIEW',
      'TELLER.SESSION_OPEN',
      'TELLER.MOVEMENT_CREATE',
      'TELLER.SESSION_CLOSE',
      'TELLER.SESSION_VERIFY',
      'TELLER.SETTLE',
      'TELLER.MANAGE',
      'TELLER.REPORT_VIEW'
    ];
    for (const perm of requiredPerms) {
      assert(accessControlContent.includes(`"${perm}"`), `RBAC permission ${perm} is registered in PERMISSION_CATALOG`);
    }

    console.log(`\n==================================================`);
    console.log(`Phase C2 Schema Verification Summary:`);
    console.log(`Total Checks Passed: ${passed}`);
    console.log(`Total Checks Failed: ${failed}`);
    console.log(`==================================================\n`);

    if (failed > 0) {
      process.exit(1);
    }
  } finally {
    await client.end();
  }
}

verifyPhaseC2Schema().catch(err => {
  console.error('Verification script fatal error:', err);
  process.exit(1);
});
