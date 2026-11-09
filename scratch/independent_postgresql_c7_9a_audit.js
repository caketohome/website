/**
 * CakeToHome ERP — Phase C7.9a Independent PostgreSQL Post-Flight Audit
 * Queries live PostgreSQL database directly to produce evidence for:
 * 1. Existence and column counts of all 7 corporate tables
 * 2. Exact foreign keys, delete actions, constraints, and indexes
 * 3. Security triggers on corporate tables
 * 4. Invariance of CoA (100 rows), vouchers (6), JEs (4), JLs (10)
 * 5. Zero candidate CoA account codes (1118B, 2118, 2119, 5114, 5115)
 * 6. Zero alteration of non-corporate tables
 */

const fs = require('fs');
const path = require('path');
const { Pool } = require(path.join(__dirname, '../frontend/node_modules/pg'));

let cs = process.env.DATABASE_URL;
if (!cs) {
  for (const l of fs.readFileSync(path.join(__dirname, '../frontend/.env'), 'utf8').split('\n')) {
    const m = l.match(/^DATABASE_URL\s*=\s*"?([^"\r\n]+)"?/);
    if (m) { cs = m[1].trim(); break; }
  }
}

const pool = new Pool({ connectionString: cs, ssl: cs.includes('supabase') ? { rejectUnauthorized: false } : false });

const queries = {
  // 1. Seven corporate tables exist with column count and row count
  corporate_tables_summary: `
    SELECT 
      t.table_name,
      count(c.column_name)::int as column_count,
      (SELECT count(*)::int FROM information_schema.tables WHERE table_schema='public' AND table_name=t.table_name) as exists_flag
    FROM information_schema.tables t
    JOIN information_schema.columns c 
      ON t.table_name = c.table_name AND t.table_schema = c.table_schema
    WHERE t.table_schema = 'public' 
      AND t.table_name IN (
        'corporate_account',
        'corporate_account_contact',
        'corporate_account_member',
        'corporate_employee',
        'corporate_employee_event',
        'corporate_account_event',
        'corporate_employee_import_batch'
      )
    GROUP BY t.table_name
    ORDER BY t.table_name;
  `,

  // 2. Exact table row counts (must all be 0)
  corporate_tables_row_counts: `
    SELECT 
      'corporate_account' as tbl, count(*)::int as rows FROM public.corporate_account
    UNION ALL SELECT 'corporate_account_contact', count(*)::int FROM public.corporate_account_contact
    UNION ALL SELECT 'corporate_account_member', count(*)::int FROM public.corporate_account_member
    UNION ALL SELECT 'corporate_employee', count(*)::int FROM public.corporate_employee
    UNION ALL SELECT 'corporate_employee_event', count(*)::int FROM public.corporate_employee_event
    UNION ALL SELECT 'corporate_account_event', count(*)::int FROM public.corporate_account_event
    UNION ALL SELECT 'corporate_employee_import_batch', count(*)::int FROM public.corporate_employee_import_batch
    ORDER BY tbl;
  `,

  // 3. Foreign key constraints and delete actions
  foreign_keys: `
    SELECT 
      tc.table_name, 
      kcu.column_name, 
      ccu.table_name AS foreign_table, 
      ccu.column_name AS foreign_column,
      rc.delete_rule
    FROM information_schema.table_constraints tc
    JOIN information_schema.key_column_usage kcu 
      ON tc.constraint_name = kcu.constraint_name AND tc.table_schema = kcu.table_schema
    JOIN information_schema.referential_constraints rc 
      ON tc.constraint_name = rc.constraint_name
    JOIN information_schema.constraint_column_usage ccu 
      ON ccu.constraint_name = tc.constraint_name AND ccu.table_schema = tc.table_schema
    WHERE tc.constraint_type = 'FOREIGN KEY' 
      AND tc.table_schema = 'public'
      AND tc.table_name LIKE 'corporate_%'
    ORDER BY tc.table_name, kcu.column_name;
  `,

  // 4. Indexes and unique constraints
  indexes_and_uniques: `
    SELECT 
      tablename, 
      indexname, 
      indexdef
    FROM pg_indexes
    WHERE schemaname = 'public' 
      AND tablename LIKE 'corporate_%'
    ORDER BY tablename, indexname;
  `,

  // 5. Check constraints
  check_constraints: `
    SELECT 
      cl.relname as table_name,
      con.conname as constraint_name,
      pg_get_constraintdef(con.oid) as definition
    FROM pg_constraint con
    JOIN pg_class cl ON con.conrelid = cl.oid
    JOIN pg_namespace ns ON cl.relnamespace = ns.oid
    WHERE ns.nspname = 'public' 
      AND cl.relname LIKE 'corporate_%' 
      AND con.contype = 'c'
    ORDER BY cl.relname, con.conname;
  `,

  // 6. Security triggers
  security_triggers: `
    SELECT 
      event_object_table as table_name,
      trigger_name,
      event_manipulation as event,
      action_timing as timing
    FROM information_schema.triggers
    WHERE trigger_schema = 'public' 
      AND trigger_name IN ('trg_ce_prevent_delete', 'trg_cee_append_only', 'trg_cax_append_only')
    ORDER BY event_object_table, trigger_name, event_manipulation;
  `,

  // 7. Accounting invariants (CoA count, voucher counts, Trial Balance)
  accounting_invariants: `
    SELECT 
      (SELECT count(*)::int FROM public.accounting_account) as coa_account_count,
      (SELECT count(*)::int FROM public.accounting_voucher) as voucher_count,
      (SELECT count(*)::int FROM public.accounting_journal_entry) as journal_entry_count,
      (SELECT count(*)::int FROM public.accounting_journal_line) as journal_line_count,
      (SELECT COALESCE(SUM(debit_amount), 0)::numeric(15,2) FROM public.accounting_journal_line) as trial_balance_debit,
      (SELECT COALESCE(SUM(credit_amount), 0)::numeric(15,2) FROM public.accounting_journal_line) as trial_balance_credit;
  `,

  // 8. Verify candidate codes are strictly NOT present
  candidate_codes_absent: `
    SELECT code, name FROM public.accounting_account 
    WHERE code IN ('1118B', '2118', '2119', '5114', '5115');
  `,

  // 9. Verify no non-corporate tables were modified or created
  table_list_delta: `
    SELECT table_name 
    FROM information_schema.tables 
    WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
    ORDER BY table_name;
  `
};

(async () => {
  const client = await pool.connect();
  const results = {};
  try {
    await client.query('BEGIN READ ONLY');
    for (const [key, sql] of Object.entries(queries)) {
      const res = await client.query(sql);
      results[key] = res.rows;
    }
    await client.query('ROLLBACK');
  } finally {
    client.release();
    await pool.end();
  }

  const outPath = path.join(__dirname, 'independent_postgresql_c7_9a_audit.json');
  fs.writeFileSync(outPath, JSON.stringify(results, null, 2));
  console.log('Independent PostgreSQL Audit Results:\n');
  console.log(JSON.stringify(results, null, 2));
})().catch(err => {
  console.error('Audit execution failed:', err);
  process.exit(1);
});
