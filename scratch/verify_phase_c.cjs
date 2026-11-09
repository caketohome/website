const path = require('path');
const { Client } = require(path.resolve(__dirname, '../frontend/node_modules/pg'));

const DB_URL = '[REDACTED_DATABASE_CREDENTIAL]';

async function main() {
  const c = new Client({ connectionString: DB_URL, ssl: { rejectUnauthorized: false } });
  await c.connect();
  await c.query('BEGIN TRANSACTION READ ONLY');

  console.log('=== PHASE C: 1. ACCOUNTING START DATE SETTING ===');
  const setRes = await c.query("SELECT * FROM public.setting WHERE key = 'accounting_start_date'");
  console.log(JSON.stringify(setRes.rows, null, 2));

  console.log('\n=== PHASE C: 2. FISCAL PERIODS IN DATABASE ===');
  const fpRes = await c.query('SELECT * FROM public.accounting_fiscal_period ORDER BY start_date ASC');
  console.log(JSON.stringify(fpRes.rows, null, 2));

  console.log('\n=== PHASE C: 3. JOURNAL ENTRIES SUMMARY ===');
  const jeSummary = await c.query(`
    SELECT 
      count(*) as total_entries,
      min(entry_date) as earliest_entry_date,
      max(entry_date) as latest_entry_date,
      min(created_at) as earliest_created_at,
      max(created_at) as latest_created_at,
      count(CASE WHEN entry_date < '2026-04-01' THEN 1 END) as entries_before_start_date,
      count(CASE WHEN entry_date >= '2026-04-01' THEN 1 END) as entries_on_or_after_start_date,
      count(CASE WHEN is_reversed = true THEN 1 END) as reversed_entries,
      count(CASE WHEN is_reversed = false THEN 1 END) as active_entries
    FROM public.accounting_journal_entry
  `);
  console.log(JSON.stringify(jeSummary.rows, null, 2));

  console.log('\n=== PHASE C: 4. SAMPLE 5 POSTED JOURNAL ENTRIES WITH NARRATIONS ===');
  const jeSamples = await c.query(`
    SELECT id, entry_no, voucher_id, entry_date, fiscal_year, total_debit, total_credit, narration, created_by, created_at
    FROM public.accounting_journal_entry
    ORDER BY created_at ASC
    LIMIT 5
  `);
  console.log(JSON.stringify(jeSamples.rows, null, 2));

  console.log('\n=== PHASE C: 5. AUDIT LOG OR SETTINGS LOG ===');
  // Check if any audit table exists for settings
  const auditTables = await c.query(`
    SELECT table_name 
    FROM information_schema.tables 
    WHERE table_schema = 'public' AND table_name LIKE '%audit%'
  `);
  console.log('Audit tables:', auditTables.rows.map(r => r.table_name));

  await c.query('COMMIT');
  await c.end();
}

main().catch(console.error);
