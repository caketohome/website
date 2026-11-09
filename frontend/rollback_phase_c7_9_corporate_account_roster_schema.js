/**
 * CakeToHome ERP — Phase C7.9 Step 9A Schema Rollback Script
 * Reverses the 7 corporate account tables and triggers.
 *
 * SAFETY INVARIANTS:
 * - Refuses to drop if ANY of the 7 tables contains rows.
 * - Atomic transaction (BEGIN ... COMMIT with ROLLBACK on error).
 * - Leaves all existing tables, accounting ledgers, and CoA intact.
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

async function rollbackStep9A() {
  console.log('=============================================================================');
  console.log('CakeToHome ERP — Phase C7.9 Step 9A Schema Rollback');
  console.log('=============================================================================\n');

  const conn = getConnectionString();
  const client = new Client({
    connectionString: conn,
    ssl: conn.includes('supabase') ? { rejectUnauthorized: false } : false
  });
  await client.connect();

  const targetTables = [
    'corporate_employee_event',
    'corporate_account_event',
    'corporate_employee_import_batch',
    'corporate_employee',
    'corporate_account_member',
    'corporate_account_contact',
    'corporate_account'
  ];

  try {
    console.log('[1/3] Checking table rows before rollback...');
    for (const t of targetTables) {
      const exists = (await client.query(`
        SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name=$1)
      `, [t])).rows[0].exists;
      if (exists) {
        const count = (await client.query(`SELECT count(*)::int as c FROM public.${t}`)).rows[0].c;
        if (count > 0) {
          throw new Error(`REFUSAL: Table public.${t} has ${count} rows. Reverse script refuses to run if any table has rows.`);
        }
      }
    }
    console.log('  ✓ All target tables are strictly empty (or non-existent).');

    await client.query('BEGIN;');
    console.log('\n[2/3] Dropping triggers, functions, and tables in reverse dependency order...');

    await client.query(`
      DROP TRIGGER IF EXISTS trg_ce_prevent_delete ON public.corporate_employee;
      DROP TRIGGER IF EXISTS trg_cee_append_only ON public.corporate_employee_event;
      DROP TRIGGER IF EXISTS trg_cax_append_only ON public.corporate_account_event;

      DROP FUNCTION IF EXISTS public.fn_corporate_employee_block_delete();
      DROP FUNCTION IF EXISTS public.fn_corporate_employee_event_immutable();
      DROP FUNCTION IF EXISTS public.fn_corporate_account_event_immutable();

      DROP TABLE IF EXISTS public.corporate_employee_event CASCADE;
      DROP TABLE IF EXISTS public.corporate_account_event CASCADE;
      DROP TABLE IF EXISTS public.corporate_employee_import_batch CASCADE;
      DROP TABLE IF EXISTS public.corporate_employee CASCADE;
      DROP TABLE IF EXISTS public.corporate_account_member CASCADE;
      DROP TABLE IF EXISTS public.corporate_account_contact CASCADE;
      DROP TABLE IF EXISTS public.corporate_account CASCADE;
    `);

    await client.query('COMMIT;');
    console.log('  ✓ Rollback committed successfully.');

    console.log('\n[3/3] Verifying dropped state...');
    for (const t of targetTables) {
      const exists = (await client.query(`
        SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name=$1)
      `, [t])).rows[0].exists;
      if (exists) throw new Error(`Table ${t} still exists after drop!`);
    }
    console.log('  ✓ Verified: all 7 tables cleanly removed.');

  } catch (err) {
    try { await client.query('ROLLBACK;'); } catch (_) {}
    console.error('\n❌ Rollback aborted:', err.message);
    throw err;
  } finally {
    await client.end();
  }
}

if (require.main === module) {
  rollbackStep9A().catch(err => {
    console.error('Fatal execution error:', err);
    process.exit(1);
  });
}

module.exports = { rollbackStep9A };
