const fs = require('fs');
const path = require('path');
const { Client } = require('../node_modules/pg');

function getConnectionString() {
  const envPath = path.join(__dirname, '../../backend/.env');
  const envContent = fs.readFileSync(envPath, 'utf8');
  for (const line of envContent.split('\n')) {
    if (line.startsWith('DATABASE_URL=')) return line.substring('DATABASE_URL='.length).trim();
  }
}

async function inspect() {
  const client = new Client({ connectionString: getConnectionString() });
  await client.connect();

  console.log('=== 1. PURCHASE COLUMNS ===');
  const pCols = await client.query(`
    SELECT column_name, data_type, is_nullable, column_default
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'purchase'
    ORDER BY ordinal_position;
  `);
  console.table(pCols.rows);

  console.log('\n=== 2. PURCHASE_ITEM COLUMNS ===');
  const piCols = await client.query(`
    SELECT column_name, data_type, is_nullable, column_default
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'purchase_item'
    ORDER BY ordinal_position;
  `);
  console.table(piCols.rows);

  console.log('\n=== 3. SUPPLIER COLUMNS ===');
  const sCols = await client.query(`
    SELECT column_name, data_type, is_nullable, column_default
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'supplier'
    ORDER BY ordinal_position;
  `);
  console.table(sCols.rows);

  console.log('\n=== 4. BRANCH COLUMNS ===');
  const bCols = await client.query(`
    SELECT column_name, data_type, is_nullable, column_default
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'branch'
    ORDER BY ordinal_position;
  `);
  console.table(bCols.rows);

  console.log('\n=== 5. RELEVANT COA ACCOUNTS (113x, 114x, 211x, 5xxx) ===');
  const coa = await client.query(`
    SELECT id, code, name, type, is_active
    FROM public.accounting_account
    WHERE code LIKE '113%' OR code LIKE '114%' OR code LIKE '211%' OR code LIKE '511%' OR code LIKE '512%' OR code LIKE '513%' OR code LIKE '5%'
    ORDER BY code;
  `);
  console.table(coa.rows);

  console.log('\n=== 6. CONSTRAINTS ON PURCHASE & PURCHASE_ITEM ===');
  const cons = await client.query(`
    SELECT cl.relname, c.conname, c.contype, pg_get_constraintdef(c.oid) as def
    FROM pg_constraint c
    JOIN pg_class cl ON c.conrelid = cl.oid
    WHERE cl.relname IN ('purchase', 'purchase_item')
    ORDER BY cl.relname, c.conname;
  `);
  console.table(cons.rows);

  console.log('\n=== 7. EXISTING BRANCH ROWS (SAMPLE STATE/CITY/LOCATION DATA) ===');
  const branchSample = await client.query(`
    SELECT b.id, b.name, b.code, b.address, b.city_id, c.name as city_name, c.state as city_state, b.metadata
    FROM public.branch b
    LEFT JOIN public.city c ON b.city_id = c.id
    LIMIT 5;
  `);
  console.table(branchSample.rows);

  console.log('\n=== 8. COMPLETE PURCHASE TABLE COLUMNS ===');
  const allPCols = await client.query(`
    SELECT column_name, data_type, is_nullable, column_default
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'purchase'
    ORDER BY ordinal_position;
  `);
  console.table(allPCols.rows);

  console.log('\n=== 9. BRANCH METADATA SAMPLE ===');
  const bMeta = await client.query('SELECT id, name, code, metadata FROM public.branch LIMIT 3');
  console.log(JSON.stringify(bMeta.rows, null, 2));

  console.log('\n=== 10. CITIES IN DATABASE ===');
  const c = await client.query('SELECT id, name, state FROM public.city');
  console.table(c.rows);

  console.log('\n=== 11. COMPANY / TAX SETTINGS ===');
  const s = await client.query("SELECT key, value FROM public.setting WHERE key ILIKE '%gst%' OR key ILIKE '%tax%' OR key ILIKE '%company%' OR key ILIKE '%state%'");
  console.table(s.rows);

  console.log('\n=== 12. ACCOUNTING_VOUCHER COLUMNS ===');
  const vCols = await client.query(`
    SELECT column_name, data_type, is_nullable, column_default
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'accounting_voucher'
    ORDER BY ordinal_position;
  `);
  console.table(vCols.rows);

  await client.end();
}

inspect().catch(err => { console.error(err); process.exit(1); });
