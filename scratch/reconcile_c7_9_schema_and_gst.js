/**
 * Reconcile C7.9 design lock against actual PostgreSQL database and inspect GST/company registrations.
 * STRICTLY READ-ONLY: BEGIN READ ONLY ... ROLLBACK.
 */
const path = require('path');
const fs = require('fs');
const { Pool } = require(path.join(__dirname, '../frontend/node_modules/pg'));

let cs = process.env.DATABASE_URL;
if (!cs) {
  for (const l of fs.readFileSync(path.join(__dirname, '../frontend/.env'), 'utf8').split('\n')) {
    const m = l.match(/^DATABASE_URL\s*=\s*"?([^"\r\n]+)"?/);
    if (m) { cs = m[1].trim(); break; }
  }
}

const pool = new Pool({ connectionString: cs, ssl: cs.includes('supabase') ? { rejectUnauthorized: false } : false });

const Q = {
  c7_9_tables_exist: `
    SELECT table_name 
    FROM information_schema.tables 
    WHERE table_schema = 'public' 
      AND table_name IN (
        'corporate_account',
        'corporate_account_contact',
        'corporate_account_member',
        'corporate_employee',
        'corporate_employee_event',
        'corporate_account_event',
        'corporate_employee_import_batch'
      )
    ORDER BY 1
  `,
  fk_targets_exist: `
    SELECT table_name, column_name, data_type 
    FROM information_schema.columns 
    WHERE table_schema = 'public' 
      AND (
        (table_name = 'customer' AND column_name IN ('id', 'is_corporate', 'company_name', 'gstin')) OR
        (table_name = 'user' AND column_name IN ('id', 'email', 'role'))
      )
    ORDER BY table_name, column_name
  `,
  pgcrypto_check: `
    SELECT extname, extversion FROM pg_extension WHERE extname = 'pgcrypto'
  `,
  uuid_gen_check: `
    SELECT gen_random_uuid()::text as sample_uuid
  `,
  coa_count: `
    SELECT count(*) as coa_account_count FROM accounting_account
  `,
  voucher_counts: `
    SELECT 
      (SELECT count(*) FROM accounting_voucher) as vouchers,
      (SELECT count(*) FROM accounting_journal_entry) as journal_entries,
      (SELECT count(*) FROM accounting_journal_line) as journal_lines
  `,
  company_cols: `
    SELECT column_name, data_type FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'company' ORDER BY ordinal_position
  `,
  company_records: `
    SELECT * FROM company ORDER BY id
  `,
  gst_reg_cols: `
    SELECT column_name, data_type FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'gst_registration' ORDER BY ordinal_position
  `,
  gst_registrations: `
    SELECT * FROM gst_registration ORDER BY id
  `
};

(async () => {
  const results = {};
  const client = await pool.connect();
  try {
    await client.query('BEGIN READ ONLY');
    for (const [key, sql] of Object.entries(Q)) {
      try {
        await client.query('SAVEPOINT s');
        const res = await client.query(sql);
        results[key] = res.rows;
        await client.query('RELEASE SAVEPOINT s');
      } catch (err) {
        results[key] = { error: err.message };
        await client.query('ROLLBACK TO SAVEPOINT s');
      }
    }
    await client.query('ROLLBACK');
  } finally {
    client.release();
    await pool.end();
  }
  const outPath = path.join(__dirname, 'reconcile_c7_9_schema_and_gst.json');
  fs.writeFileSync(outPath, JSON.stringify(results, null, 2));
  console.log(JSON.stringify(results, null, 2));
})().catch(err => {
  console.error(err);
  process.exit(1);
});
