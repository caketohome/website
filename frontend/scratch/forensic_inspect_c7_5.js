const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');

const envPath = path.join(__dirname, '../.env');
const env = fs.readFileSync(envPath, 'utf8');
let dbUrl = '';
for (const line of env.split('\n')) {
  if (line.trim().startsWith('DATABASE_URL=')) {
    dbUrl = line.trim().substring('DATABASE_URL='.length).trim();
    if ((dbUrl.startsWith('"') && dbUrl.endsWith('"')) || (dbUrl.startsWith("'") && dbUrl.endsWith("'"))) {
      dbUrl = dbUrl.slice(1, -1);
    }
  }
}

const pool = new Pool({ connectionString: dbUrl });

async function run() {
  console.log('--- 1. ALL CASH / CLEARING / RECONCILIATION / RELEVANT COA ACCOUNTS ---');
  const coaRes = await pool.query(`
    SELECT *
    FROM public.accounting_account
    WHERE code LIKE '11%' OR code LIKE '12%' OR name ILIKE '%cash%' OR name ILIKE '%bank%' OR name ILIKE '%clear%' OR name ILIKE '%transit%' OR name ILIKE '%short%' OR name ILIKE '%over%' OR name ILIKE '%suspense%'
    ORDER BY code
  `);
  console.table(coaRes.rows);

  console.log('\n--- 2. ALL TELLER-RELATED TABLES AND COLUMNS IN PUBLIC SCHEMA ---');
  const tellerTablesRes = await pool.query(`
    SELECT table_name, column_name, data_type, is_nullable, column_default
    FROM information_schema.columns
    WHERE table_schema = 'public' AND (table_name LIKE 'teller%' OR table_name LIKE '%cash%' OR table_name = 'branch' OR table_name = 'company' OR table_name = 'bank_account')
    ORDER BY table_name, ordinal_position
  `);
  
  const tables = {};
  for (const row of tellerTablesRes.rows) {
    if (!tables[row.table_name]) tables[row.table_name] = [];
    tables[row.table_name].push(`${row.column_name} (${row.data_type}${row.is_nullable === 'NO' ? ' NOT NULL' : ''}${row.column_default ? ' DEFAULT ' + row.column_default : ''})`);
  }
  for (const [t, cols] of Object.entries(tables)) {
    console.log(`\nTable: ${t}`);
    console.log(cols.join(', '));
  }

  console.log('\n--- 3. CHECK FOR ANY CASH OVER/SHORT OR VARIANCE EXPENSE/INCOME ACCOUNTS ---');
  const expRes = await pool.query(`
    SELECT code, name, type, subtype
    FROM public.accounting_account
    WHERE code LIKE '5%' OR code LIKE '6%' OR code LIKE '4%' OR code LIKE '2%'
    AND (name ILIKE '%variance%' OR name ILIKE '%short%' OR name ILIKE '%over%' OR name ILIKE '%diff%' OR name ILIKE '%round%' OR name ILIKE '%miscellaneous%')
    ORDER BY code
  `);
  console.table(expRes.rows);

  console.log('\n--- 4. EXISTING BRANCH COLUMNS & SAMPLES ---');
  const bCols = await pool.query(`SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'branch' AND table_schema = 'public'`);
  console.log('Branch columns:', bCols.rows.map(r => `${r.column_name} (${r.data_type})`).join(', '));
  const branches = await pool.query(`SELECT id, name, code, metadata FROM public.branch LIMIT 10`);
  console.table(branches.rows);

  console.log('\n--- 5. EXISTING BANK ACCOUNTS IN SYSTEM ---');
  const bankAccs = await pool.query(`
    SELECT ba.id, ba.bank_name, ba.account_number, ba.gl_account_id, acc.code, acc.name, ba.status
    FROM public.bank_account ba
    LEFT JOIN public.accounting_account acc ON ba.gl_account_id = acc.id
    ORDER BY ba.id
  `);
  console.table(bankAccs.rows);

  console.log('\n--- 6. TELLER ENUMS / CHECK CONSTRAINTS ---');
  const constraints = await pool.query(`
    SELECT conname, pg_get_constraintdef(c.oid)
    FROM pg_constraint c
    JOIN pg_namespace n ON n.oid = c.connamespace
    WHERE n.nspname = 'public' AND conrelid::regclass::text IN ('public.teller_session', 'public.teller_movement', 'public.teller', 'public.accounting_voucher')
  `);
  for (const r of constraints.rows) {
    console.log(`${r.conname}: ${r.pg_get_constraintdef}`);
  }

  await pool.end();
}

run().catch(err => {
  console.error(err);
  process.exit(1);
});
