const fs = require('fs');
const path = require('path');
const { Client } = require(path.resolve(__dirname, '../frontend/node_modules/pg'));

function getConn() {
  const env = fs.readFileSync('.env', 'utf8');
  for (const line of env.split('\n')) {
    if (line.trim().startsWith('DATABASE_URL=')) {
      let val = line.trim().substring('DATABASE_URL='.length).trim();
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) val = val.slice(1, -1);
      return val;
    }
  }
}

async function auditBaseline() {
  const connStr = getConn();
  const url = new URL(connStr);
  console.log('=============================================================================');
  console.log('Task 1: Shared PostgreSQL Database Identity & Configuration Baseline');
  console.log('=============================================================================');
  console.log(`Database Host:     ${url.hostname}`);
  console.log(`Database Port:     ${url.port}`);
  console.log(`Database Name:     ${url.pathname.replace('/', '')}`);
  console.log(`Database User:     ${url.username}`);
  console.log(`SSL Mode:          require (rejectUnauthorized: false)`);
  console.log('Credentials:       PROTECTED / NOT PRINTED\n');

  const client = new Client({ connectionString: connStr, ssl: { rejectUnauthorized: false } });
  await client.connect();

  // 1. Accounting Start Date Setting
  console.log('[1] Accounting Start Date in public.setting:');
  const settingRes = await client.query(`
    SELECT id, "group", key, value, description, created_at, updated_at 
    FROM public.setting 
    WHERE key = 'accounting_start_date' AND deleted_at IS NULL
  `);
  console.table(settingRes.rows);

  // 2. Fiscal Periods in public.accounting_fiscal_period
  console.log('\n[2] Fiscal Periods in public.accounting_fiscal_period:');
  const periodsRes = await client.query(`
    SELECT id, fiscal_year, period_name, start_date::text, end_date::text, is_locked, created_at 
    FROM public.accounting_fiscal_period 
    ORDER BY start_date ASC
  `);
  console.table(periodsRes.rows);

  // 3. The 4 Historical Journal Entries (Headers & Lines)
  console.log('\n[3] Historical Journal Entries (public.accounting_journal_entry):');
  const jeRes = await client.query(`
    SELECT * 
    FROM public.accounting_journal_entry 
    ORDER BY entry_date ASC, created_at ASC
  `);
  console.table(jeRes.rows);

  // 4. Discover Account Table Name
  const tablesRes = await client.query(`
    SELECT table_name FROM information_schema.tables 
    WHERE table_schema='public' AND (table_name LIKE '%account%' OR table_name LIKE '%chart%')
  `);
  console.log('Account/Chart tables found:', tablesRes.rows.map(r => r.table_name));

  const acctTable = tablesRes.rows.some(r => r.table_name === 'accounting_account') ? 'accounting_account' 
    : (tablesRes.rows.some(r => r.table_name === 'chart_of_accounts') ? 'chart_of_accounts' : 'accounting_chart_of_accounts');

  console.log('\n[4] Historical Journal Entry Lines (public.accounting_journal_line):');
  const jelRes = await client.query(`
    SELECT jel.id, jel.journal_entry_id, je.entry_no, jel.account_id, ca.code as account_code, ca.name as account_name, 
           jel.debit_amount, jel.credit_amount, jel.narration, jel.cost_centre_id, je.created_at
    FROM public.accounting_journal_line jel
    JOIN public.accounting_journal_entry je ON jel.journal_entry_id = je.id
    LEFT JOIN public.accounting_account ca ON jel.account_id = ca.id
    ORDER BY je.entry_no ASC, jel.id ASC
  `);
  console.table(jelRes.rows);

  // 5. Source Vouchers behind the 4 Journal Entries
  console.log('\n[5] Source Vouchers (public.accounting_voucher):');
  const vchRes = await client.query(`
    SELECT id, voucher_no, voucher_type, voucher_date::text, status, total_amount, reference_type, reference_id, narration, created_at
    FROM public.accounting_voucher
    ORDER BY voucher_date ASC, created_at ASC
  `);
  console.table(vchRes.rows);

  // 6. Baseline Account Balances Summary
  console.log('\n[6] Read-Only Account Balances Summary (from Journal Lines):');
  const tbRes = await client.query(`
    SELECT ca.code as account_code, ca.name as account_name, ca.type as account_type,
           SUM(jel.debit_amount) AS total_debit,
           SUM(jel.credit_amount) AS total_credit,
           (SUM(jel.debit_amount) - SUM(jel.credit_amount)) AS net_balance
    FROM public.accounting_journal_line jel
    JOIN public.accounting_account ca ON jel.account_id = ca.id
    GROUP BY ca.code, ca.name, ca.type
    ORDER BY ca.code ASC
  `);
  console.table(tbRes.rows);

  // 6. Check Available Schemas or Databases for Safe Testing
  console.log('\n[7] Database Schemas Available:');
  const schemasRes = await client.query(`
    SELECT schema_name 
    FROM information_schema.schemata 
    WHERE schema_name NOT IN ('pg_catalog', 'information_schema', 'pg_toast')
    ORDER BY schema_name
  `);
  console.table(schemasRes.rows);

  await client.end();
}

auditBaseline().catch(err => {
  console.error('Task 1 inspection failed:', err);
  process.exit(1);
});
