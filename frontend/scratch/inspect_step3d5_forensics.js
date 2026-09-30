const fs = require('fs');
const path = require('path');
const { Client } = require('../node_modules/pg');

function getConnectionString() {
  if (process.env.PG_URL) return process.env.PG_URL;
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL;
  const envPath = path.join(__dirname, '../../backend/.env');
  const envContent = fs.readFileSync(envPath, 'utf8');
  for (const line of envContent.split('\n')) {
    if (line.startsWith('DATABASE_URL=')) return line.substring('DATABASE_URL='.length).trim();
  }
  throw new Error("No database connection string found");
}

async function inspect() {
  const client = new Client({ connectionString: getConnectionString() });
  await client.connect();

  console.log('=== 1. purchase_payment columns ===');
  const ppCols = await client.query(`
    SELECT column_name, data_type, is_nullable, column_default
    FROM information_schema.columns
    WHERE table_name = 'purchase_payment'
    ORDER BY ordinal_position
  `);
  console.table(ppCols.rows);

  console.log('\n=== 2. purchase_payment constraints ===');
  const ppCons = await client.query(`
    SELECT conname, contype, pg_get_constraintdef(oid) as def
    FROM pg_constraint
    WHERE conrelid = 'public.purchase_payment'::regclass
  `);
  console.table(ppCons.rows);

  console.log('\n=== 3. purchase_payment indexes ===');
  const ppIdx = await client.query(`
    SELECT indexname, indexdef
    FROM pg_indexes
    WHERE tablename = 'purchase_payment'
  `);
  console.table(ppIdx.rows);

  console.log('\n=== 4. purchase table columns relating to payment & status ===');
  const pCols = await client.query(`
    SELECT column_name, data_type, is_nullable, column_default
    FROM information_schema.columns
    WHERE table_name = 'purchase'
    ORDER BY ordinal_position
  `);
  console.table(pCols.rows);

  console.log('\n=== 5. purchase table constraints ===');
  const pCons = await client.query(`
    SELECT conname, contype, pg_get_constraintdef(oid) as def
    FROM pg_constraint
    WHERE conrelid = 'public.purchase'::regclass
  `);
  console.table(pCons.rows);

  console.log('\n=== 6. accounting_voucher voucher_type and source_type constraints ===');
  const vCons = await client.query(`
    SELECT conname, contype, pg_get_constraintdef(oid) as def
    FROM pg_constraint
    WHERE conrelid = 'public.accounting_voucher'::regclass
  `);
  console.table(vCons.rows);

  console.log('\n=== 7. Cash, Bank, and AP accounts in CoA ===');
  const coa = await client.query(`
    SELECT *
    FROM public.accounting_account
    WHERE code IN ('1111', '1112', '1113', '1114', '2111', '2112', '4120', '5250')
       OR code LIKE '111%' OR code LIKE '211%'
    ORDER BY code
  `);
  console.table(coa.rows);

  await client.end();
}

inspect().catch(console.error);
