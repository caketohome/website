const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

const envContent = fs.readFileSync(path.resolve(__dirname, '../.env'), 'utf8');
let dbUrl;
for (const line of envContent.split('\n')) {
  if (line.startsWith('DATABASE_URL=')) {
    dbUrl = line.substring('DATABASE_URL='.length).trim();
    break;
  }
}

const client = new Client({ connectionString: dbUrl, ssl: { rejectUnauthorized: false } });

async function run() {
  await client.connect();

  console.log('=== 1. ACCOUNTING_VOUCHER COLUMNS & CONSTRAINTS ===');
  const vCols = await client.query(`
    SELECT column_name, data_type, column_default, is_nullable 
    FROM information_schema.columns 
    WHERE table_name = 'accounting_voucher'
    ORDER BY ordinal_position
  `);
  vCols.rows.forEach(r => console.log(`   Col: ${r.column_name} (${r.data_type})`));

  const vConstraints = await client.query(`
    SELECT conname, pg_get_constraintdef(oid) 
    FROM pg_constraint 
    WHERE conrelid = 'public.accounting_voucher'::regclass
  `);
  vConstraints.rows.forEach(r => console.log(`  ${r.conname}: ${r.pg_get_constraintdef}`));

  console.log('\n=== 2. ACCOUNTING_FISCAL_PERIOD SCHEMA ===');
  const fpCols = await client.query(`
    SELECT column_name, data_type, column_default, is_nullable 
    FROM information_schema.columns 
    WHERE table_name = 'accounting_fiscal_period'
    ORDER BY ordinal_position
  `);
  fpCols.rows.forEach(r => console.log(`  ${r.column_name} (${r.data_type}, nullable=${r.is_nullable}, default=${r.column_default})`));

  console.log('\n=== 3. ACCOUNTING_FISCAL_PERIOD CONSTRAINTS ===');
  const fpConstraints = await client.query(`
    SELECT conname, pg_get_constraintdef(oid) 
    FROM pg_constraint 
    WHERE conrelid = 'public.accounting_fiscal_period'::regclass
  `);
  fpConstraints.rows.forEach(r => console.log(`  ${r.conname}: ${r.pg_get_constraintdef}`));

  console.log('\n=== 4. EQUITY & NOMINAL ACCOUNTS FORENSIC ===');
  const accounts = await client.query(`
    SELECT code, name, type, subtype, parent_id, is_active, is_group
    FROM public.accounting_account
    WHERE code IN ('3110', '3120', '3210', '3220', '3300')
       OR type IN ('REVENUE', 'EXPENSE')
    ORDER BY code ASC
  `);
  console.log(`  Found ${accounts.rows.length} accounts:`);
  accounts.rows.filter(a => ['3110', '3120', '3210', '3220', '3300'].includes(a.code)).forEach(a => {
    console.log(`   Equity: [${a.code}] ${a.name} (type=${a.type}, subtype=${a.subtype})`);
  });

  const revCount = accounts.rows.filter(a => a.type === 'REVENUE' && !a.is_group).length;
  const expCount = accounts.rows.filter(a => a.type === 'EXPENSE' && !a.is_group).length;
  console.log(`   Leaf Revenue accounts: ${revCount}`);
  console.log(`   Leaf Expense accounts: ${expCount}`);

  await client.end();
}

run().catch(console.error);
