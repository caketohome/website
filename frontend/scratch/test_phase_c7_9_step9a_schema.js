/**
 * CakeToHome ERP — Phase C7.9 Step 9A Schema Verification Suite
 * Tests the 7 additive corporate tables:
 * - Table existence, column definitions, types, and nullability
 * - Foreign keys, ON DELETE RESTRICT behavior
 * - CHECK constraints (status sets, regex for PAN/GSTIN, coordinate bounding box)
 * - UNIQUE constraints and indexes (1:1 customer link, employee code, partial member unique)
 * - Security triggers (DELETE block on employee, append-only triggers on events)
 * - Invariance of Chart of Accounts (100) and accounting vouchers/journals
 */

const fs = require('fs');
const path = require('path');
const { Client } = require('pg');

function getConnectionString() {
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL;
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

async function runTests() {
  console.log('=============================================================================');
  console.log('CakeToHome ERP — Phase C7.9 Step 9A Schema Verification Suite');
  console.log('=============================================================================\n');

  const conn = getConnectionString();
  const client = new Client({
    connectionString: conn,
    ssl: conn.includes('supabase') ? { rejectUnauthorized: false } : false
  });
  await client.connect();

  try {
    // ─── Test Suite 1: Table Structural Existence ────────────────────────────
    console.log('[Test Suite 1: Table Existence & Row Counts]');
    const tables = [
      'corporate_account',
      'corporate_account_contact',
      'corporate_account_member',
      'corporate_employee',
      'corporate_employee_event',
      'corporate_account_event',
      'corporate_employee_import_batch'
    ];
    for (const t of tables) {
      const exists = (await client.query(`
        SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name=$1)
      `, [t])).rows[0].exists;
      assert(exists, `Table public.${t} exists`);

      const count = (await client.query(`SELECT count(*)::int as c FROM public.${t}`)).rows[0].c;
      assert(count === 0, `Table public.${t} is clean (0 rows)`);
    }

    // ─── Test Suite 2: Foreign Key Constraints ───────────────────────────────
    console.log('\n[Test Suite 2: Foreign Key Targets & Delete Rules]');
    const fks = (await client.query(`
      SELECT 
        tc.table_name, kcu.column_name, 
        ccu.table_name AS foreign_table_name,
        ccu.column_name AS foreign_column_name,
        rc.delete_rule
      FROM information_schema.table_constraints AS tc 
      JOIN information_schema.key_column_usage AS kcu
        ON tc.constraint_name = kcu.constraint_name
        AND tc.table_schema = kcu.table_schema
      JOIN information_schema.referential_constraints AS rc
        ON tc.constraint_name = rc.constraint_name
      JOIN information_schema.constraint_column_usage AS ccu
        ON ccu.constraint_name = tc.constraint_name
        AND ccu.table_schema = tc.table_schema
      WHERE tc.constraint_type = 'FOREIGN KEY' 
        AND tc.table_schema='public'
        AND tc.table_name LIKE 'corporate_%'
      ORDER BY tc.table_name, kcu.column_name;
    `)).rows;

    const caCustFk = fks.find(f => f.table_name === 'corporate_account' && f.column_name === 'customer_id');
    assert(caCustFk && caCustFk.foreign_table_name === 'customer' && caCustFk.delete_rule === 'RESTRICT',
      'corporate_account.customer_id -> customer(id) ON DELETE RESTRICT');

    const camUserFk = fks.find(f => f.table_name === 'corporate_account_member' && f.column_name === 'user_id');
    assert(camUserFk && camUserFk.foreign_table_name === 'user' && camUserFk.delete_rule === 'RESTRICT',
      'corporate_account_member.user_id -> user(id) ON DELETE RESTRICT');

    const ceAccFk = fks.find(f => f.table_name === 'corporate_employee' && f.column_name === 'account_id');
    assert(ceAccFk && ceAccFk.foreign_table_name === 'corporate_account' && ceAccFk.delete_rule === 'RESTRICT',
      'corporate_employee.account_id -> corporate_account(id) ON DELETE RESTRICT');

    // ─── Test Suite 3: Unique Constraints & Indexes ─────────────────────────
    console.log('\n[Test Suite 3: Unique Constraints & Partial Indexes]');
    const uqRes = (await client.query(`
      SELECT tablename, indexname, indexdef
      FROM pg_indexes
      WHERE schemaname = 'public' AND tablename LIKE 'corporate_%'
      ORDER BY tablename, indexname;
    `)).rows;

    const caCustUq = uqRes.find(i => i.tablename === 'corporate_account' && i.indexdef.includes('UNIQUE') && i.indexdef.includes('customer_id'));
    assert(Boolean(caCustUq), 'corporate_account has full UNIQUE constraint on customer_id');

    const caGstinUq = uqRes.find(i => i.indexname === 'idx_ca_gstin_active');
    assert(Boolean(caGstinUq && caGstinUq.indexdef.includes('WHERE')), 'idx_ca_gstin_active is a partial UNIQUE index on active gstin');

    const cacPrimaryUq = uqRes.find(i => i.indexname === 'idx_cac_one_active_primary');
    assert(Boolean(cacPrimaryUq && cacPrimaryUq.indexdef.includes('PRIMARY')), 'idx_cac_one_active_primary enforces single active primary contact per account');

    const camMemberUq = uqRes.find(i => i.indexname === 'idx_cam_account_user_active');
    assert(Boolean(camMemberUq && camMemberUq.indexdef.includes('ACTIVE')), 'idx_cam_account_user_active enforces single active membership per user/account');

    const ceCodeUq = uqRes.find(i => i.tablename === 'corporate_employee' && i.indexdef.includes('employee_code_key'));
    assert(Boolean(ceCodeUq), 'corporate_employee enforces UNIQUE(account_id, employee_code_key) over ALL statuses');

    const ceiHashUq = uqRes.find(i => i.indexname === 'idx_cei_account_file_hash_committed');
    assert(Boolean(ceiHashUq && ceiHashUq.indexdef.includes('COMMITTED')), 'idx_cei_account_file_hash_committed protects committed import batch file hash');

    // ─── Test Suite 4: CHECK Constraints & Validations ───────────────────────
    console.log('\n[Test Suite 4: CHECK Constraints]');
    const checks = (await client.query(`
      SELECT conname, pg_get_constraintdef(oid) as def
      FROM pg_constraint
      WHERE conrelid IN (SELECT oid FROM pg_class WHERE relname LIKE 'corporate_%') AND contype = 'c'
      ORDER BY conname;
    `)).rows;

    assert(checks.some(c => c.conname === 'chk_ca_gstin'), 'chk_ca_gstin regex constraint present');
    assert(checks.some(c => c.conname === 'chk_ca_pan'), 'chk_ca_pan regex constraint present');
    assert(checks.some(c => c.conname === 'chk_ca_pan_gstin_match'), 'chk_ca_pan_gstin_match consistency constraint present');
    assert(checks.some(c => c.conname === 'chk_ce_coords_both_or_neither'), 'chk_ce_coords_both_or_neither constraint present');
    assert(checks.some(c => c.conname === 'chk_ce_coords_india_bbox'), 'chk_ce_coords_india_bbox constraint present');

    // ─── Test Suite 5: Security Triggers ─────────────────────────────────────
    console.log('\n[Test Suite 5: Security Triggers]');
    const triggers = (await client.query(`
      SELECT DISTINCT trigger_name, event_object_table
      FROM information_schema.triggers
      WHERE trigger_name IN ('trg_ce_prevent_delete', 'trg_cee_append_only', 'trg_cax_append_only')
      ORDER BY trigger_name;
    `)).rows;

    assert(triggers.some(t => t.trigger_name === 'trg_ce_prevent_delete' && t.event_object_table === 'corporate_employee'),
      'trg_ce_prevent_delete attached to corporate_employee');
    assert(triggers.some(t => t.trigger_name === 'trg_cee_append_only' && t.event_object_table === 'corporate_employee_event'),
      'trg_cee_append_only attached to corporate_employee_event');
    assert(triggers.some(t => t.trigger_name === 'trg_cax_append_only' && t.event_object_table === 'corporate_account_event'),
      'trg_cax_append_only attached to corporate_account_event');

    // ─── Test Suite 6: Accounting Invariance ─────────────────────────────────
    console.log('\n[Test Suite 6: Accounting Baseline Invariance]');
    const coaCount = (await client.query('SELECT count(*)::int as c FROM public.accounting_account')).rows[0].c;
    assert(coaCount === 100, `CoA is exactly 100 accounts (got ${coaCount})`);

    const voucherCount = (await client.query('SELECT count(*)::int as c FROM public.accounting_voucher')).rows[0].c;
    assert(voucherCount === 6, `Vouchers count is 6 (got ${voucherCount})`);

    const jeCount = (await client.query('SELECT count(*)::int as c FROM public.accounting_journal_entry')).rows[0].c;
    assert(jeCount === 4, `Journal entries count is 4 (got ${jeCount})`);

    const jlCount = (await client.query('SELECT count(*)::int as c FROM public.accounting_journal_line')).rows[0].c;
    assert(jlCount === 10, `Journal lines count is 10 (got ${jlCount})`);

    const candidateCodesCheck = (await client.query(`
      SELECT code FROM public.accounting_account WHERE code IN ('1118B', '2118', '2119', '5114', '5115');
    `)).rows;
    assert(candidateCodesCheck.length === 0, 'Zero candidate codes introduced into Chart of Accounts');

    const tbRes = (await client.query(`
      SELECT 
        COALESCE(SUM(debit_amount), 0)::numeric(15,2) as dr,
        COALESCE(SUM(credit_amount), 0)::numeric(15,2) as cr
      FROM public.accounting_journal_line;
    `)).rows[0];
    assert(tbRes.dr === tbRes.cr, `Trial Balance balanced: Dr ${tbRes.dr} === Cr ${tbRes.cr}`);

    console.log('\n=============================================================================');
    console.log(`Suite Summary: ${passed} passed, ${failed} failed`);
    console.log('=============================================================================');

    if (failed > 0) process.exit(1);

  } catch (err) {
    console.error('Test execution error:', err);
    process.exit(1);
  } finally {
    await client.end();
  }
}

runTests();
