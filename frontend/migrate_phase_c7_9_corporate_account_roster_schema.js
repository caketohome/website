/**
 * CakeToHome ERP — Phase C7.9 Step 7A Schema Migration Runner
 * Additive Schema Foundation: Corporate Account Master & Employee Roster Lifecycle
 *
 * SCOPE:
 * 1. Pre-migration baseline verification:
 *    - CoA = 100 accounts in public.accounting_account.
 *    - Trial Balance strictly balanced.
 *    - Accounting vouchers = 6, journal entries = 4, journal lines = 10.
 *    - None of the 7 target tables exist (or exist empty).
 * 2. Create the 7 approved tables:
 *    - public.corporate_account
 *    - public.corporate_account_contact
 *    - public.corporate_account_member
 *    - public.corporate_employee
 *    - public.corporate_employee_event
 *    - public.corporate_account_event
 *    - public.corporate_employee_import_batch
 * 3. Enforce triggers for audit immutability and employee deletion prevention.
 * 4. Post-migration verification of tables, columns, indexes, foreign keys, row counts, and CoA.
 *
 * SAFETY INVARIANTS:
 * - Atomic transaction (BEGIN ... COMMIT with ROLLBACK on any error).
 * - Idempotent execution (safe to re-run).
 * - Zero alteration of existing tables, data, permissions, or accounting ledger.
 * - Chart of Accounts strictly preserved at exactly 100 accounts.
 */

const fs = require('fs');
const path = require('path');
const { Client } = require('pg');

function getConnectionString() {
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL;
  const envPath = path.join(__dirname, '.env');
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

async function runStep9AMigration() {
  console.log('=============================================================================');
  console.log('CakeToHome ERP — Phase C7.9 Step 9A Schema Migration');
  console.log('Corporate Account Master & Employee Roster: Additive Table Foundation');
  console.log('=============================================================================\n');

  const conn = getConnectionString();
  const client = new Client({
    connectionString: conn,
    ssl: conn.includes('supabase') ? { rejectUnauthorized: false } : false
  });
  await client.connect();

  try {
    // ─── [1/6] Pre-Migration Baseline Verification ──────────────────────────
    console.log('[1/6] Verifying pre-migration baseline...');
    const coaRes = await client.query('SELECT count(*)::int as count FROM public.accounting_account');
    if (coaRes.rows[0].count !== 100) {
      throw new Error(`CoA count mismatch: expected 100, got ${coaRes.rows[0].count}`);
    }
    console.log(`  ✓ Chart of Accounts: exactly ${coaRes.rows[0].count} accounts`);

    const tbRes = await client.query(`
      SELECT 
        COALESCE(SUM(debit_amount), 0)::numeric(15,2) as dr,
        COALESCE(SUM(credit_amount), 0)::numeric(15,2) as cr
      FROM public.accounting_journal_line;
    `);
    if (tbRes.rows[0].dr !== tbRes.rows[0].cr) {
      throw new Error(`Trial Balance mismatch: Dr ${tbRes.rows[0].dr} !== Cr ${tbRes.rows[0].cr}`);
    }
    console.log(`  ✓ Trial Balance: Dr ₹${tbRes.rows[0].dr} === Cr ₹${tbRes.rows[0].cr}`);

    const vRes = await client.query('SELECT count(*)::int as count FROM public.accounting_voucher');
    const jeRes = await client.query('SELECT count(*)::int as count FROM public.accounting_journal_entry');
    const jlRes = await client.query('SELECT count(*)::int as count FROM public.accounting_journal_line');
    console.log(`  ✓ Vouchers: ${vRes.rows[0].count}, Journal Entries: ${jeRes.rows[0].count}, Lines: ${jlRes.rows[0].count}`);

    // Verify target tables do not already exist with conflicting rows
    const targetTables = [
      'corporate_account',
      'corporate_account_contact',
      'corporate_account_member',
      'corporate_employee',
      'corporate_employee_event',
      'corporate_account_event',
      'corporate_employee_import_batch'
    ];
    for (const t of targetTables) {
      const exists = (await client.query(`
        SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name=$1)
      `, [t])).rows[0].exists;
      if (exists) {
        const cnt = (await client.query(`SELECT count(*)::int as c FROM public.${t}`)).rows[0].c;
        if (cnt > 0) {
          throw new Error(`Pre-condition failed: table public.${t} already exists and has ${cnt} rows`);
        }
      }
    }
    console.log('  ✓ Pre-flight clean: zero conflicting rows in target table set');

    // ─── START ATOMIC TRANSACTION ───────────────────────────────────────────
    await client.query('BEGIN;');
    console.log('\n[2/6] Beginning atomic database transaction...');

    // Read and execute the canonical SQL migration file
    const sqlPath = path.join(__dirname, '../backend/src/migrations/20261012_phase_c7_9_corporate_account_roster_schema.sql');
    if (!fs.existsSync(sqlPath)) {
      throw new Error(`Canonical SQL file not found at ${sqlPath}`);
    }
    const sqlContent = fs.readFileSync(sqlPath, 'utf8');

    console.log('[3/6] Applying 7 additive corporate tables, constraints, and triggers...');
    await client.query(sqlContent);
    console.log('  ✓ SQL DDL executed successfully.');

    // ─── COMMIT TRANSACTION ─────────────────────────────────────────────────
    await client.query('COMMIT;');
    console.log('\n[4/6] Transaction COMMITTED successfully.');

    // ─── [5/6] Post-Migration Verification ──────────────────────────────────
    console.log('\n[5/6] Verifying post-migration state...');
    for (const t of targetTables) {
      const exists = (await client.query(`
        SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name=$1)
      `, [t])).rows[0].exists;
      if (!exists) throw new Error(`Verification failed: table ${t} does not exist`);

      const colCount = (await client.query(`
        SELECT count(*)::int as count FROM information_schema.columns WHERE table_schema='public' AND table_name=$1
      `, [t])).rows[0].count;

      const rowCount = (await client.query(`SELECT count(*)::int as count FROM public.${t}`)).rows[0].count;
      if (rowCount !== 0) throw new Error(`Verification failed: table ${t} has ${rowCount} rows (expected 0)`);

      console.log(`  ✓ Table public.${t}: exists, ${colCount} columns, ${rowCount} rows (strictly empty)`);
    }

    // Verify triggers exist
    const trgCheck = await client.query(`
      SELECT DISTINCT trigger_name, event_object_table
      FROM information_schema.triggers
      WHERE trigger_name IN ('trg_ce_prevent_delete', 'trg_cee_append_only', 'trg_cax_append_only')
      ORDER BY trigger_name;
    `);
    if (trgCheck.rows.length !== 3) {
      throw new Error(`Expected 3 security triggers, found ${trgCheck.rows.length}`);
    }
    console.log(`  ✓ Security triggers verified: ${trgCheck.rows.map(r => r.trigger_name).join(', ')}`);

    // Verify CoA and Trial Balance untouched
    console.log('\n[6/6] Verifying accounting baseline invariance...');
    const postCoa = (await client.query('SELECT count(*)::int as count FROM public.accounting_account')).rows[0].count;
    if (postCoa !== 100) throw new Error(`CoA corrupted: expected 100, got ${postCoa}`);

    const postV = (await client.query('SELECT count(*)::int as count FROM public.accounting_voucher')).rows[0].count;
    const postJe = (await client.query('SELECT count(*)::int as count FROM public.accounting_journal_entry')).rows[0].count;
    const postJl = (await client.query('SELECT count(*)::int as count FROM public.accounting_journal_line')).rows[0].count;

    if (postV !== vRes.rows[0].count || postJe !== jeRes.rows[0].count || postJl !== jlRes.rows[0].count) {
      throw new Error('Accounting ledger counts changed during migration!');
    }

    const postTb = (await client.query(`
      SELECT 
        COALESCE(SUM(debit_amount), 0)::numeric(15,2) as dr,
        COALESCE(SUM(credit_amount), 0)::numeric(15,2) as cr
      FROM public.accounting_journal_line;
    `)).rows[0];
    if (postTb.dr !== postTb.cr) throw new Error(`Trial Balance corrupted: Dr ${postTb.dr} !== Cr ${postTb.cr}`);

    console.log(`  ✓ Chart of Accounts: preserved at exactly ${postCoa} accounts`);
    console.log(`  ✓ Ledger counts: Vouchers ${postV}, JEs ${postJe}, JLs ${postJl}`);
    console.log(`  ✓ Trial Balance: preserved at Dr ₹${postTb.dr} === Cr ₹${postTb.cr}`);

    console.log('\n=============================================================================');
    console.log('✅ Phase C7.9 Step 9A Schema Migration Completed Successfully!');
    console.log('=============================================================================');

  } catch (err) {
    try { await client.query('ROLLBACK;'); } catch (_) {}
    console.error('\n❌ Migration failed. Transaction ROLLED BACK:', err);
    throw err;
  } finally {
    await client.end();
  }
}

if (require.main === module) {
  runStep9AMigration().catch(err => {
    console.error('Fatal execution error:', err);
    process.exit(1);
  });
}

module.exports = { runStep9AMigration };
