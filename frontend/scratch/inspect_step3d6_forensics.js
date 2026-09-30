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
  throw new Error('No database connection string found');
}

async function run() {
  const client = new Client({ connectionString: getConnectionString() });
  await client.connect();

    const tblRes = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
        AND (table_name LIKE '%return%' OR table_name LIKE '%debit%' OR table_name LIKE '%purchase%')
      ORDER BY table_name
    `);
    console.log('Tables matching return/debit/purchase:', tblRes.rows.map(r => r.table_name));

  const tables = [
    'accounting_account',
    'accounting_voucher',
    'accounting_journal_entry',
    'accounting_journal_line',
    'accounting_fiscal_period',
    'purchase',
    'purchase_item',
    'purchase_payment',
    'inventory_cost_lot',
    'inventory_movement',
    'inventory_cost_consumption',
    'branch_inventory',
    'product',
    'product_variant',
    'supplier',
    'branch',
    'order',
    'payment_transaction'
  ];

  console.log('=== TABLE ROW COUNTS ===');
  for (const t of tables) {
    const q = t === 'order' ? 'SELECT COUNT(*) FROM public."order"' : `SELECT COUNT(*) FROM public.${t}`;
    try {
      const res = await client.query(q);
      console.log(`${t}: ${res.rows[0].count}`);
    } catch (e) {
      console.log(`${t}: ERROR ${e.message}`);
    }
  }

  console.log('\n=== ACCOUNTING START DATE CONFIG ===');
  const cfg = await client.query("SELECT * FROM public.setting WHERE key = 'accounting_start_date'");
  console.log('accounting_start_date rows:', cfg.rows);

  console.log('\n=== VOUCHER TYPES IN DB CHECK CONSTRAINT ===');
  const vchCheck = await client.query(`
    SELECT conname, pg_get_constraintdef(oid) 
    FROM pg_constraint 
    WHERE conrelid = 'public.accounting_voucher'::regclass 
      AND conname = 'chk_voucher_type'
  `);
  console.log(vchCheck.rows);

  console.log('\n=== VOUCHER REVERSAL CONSTRAINTS ===');
  const revCheck = await client.query(`
    SELECT conname, pg_get_constraintdef(oid) 
    FROM pg_constraint 
    WHERE conrelid = 'public.accounting_voucher'::regclass 
      AND conname LIKE '%revers%'
  `);
  console.log(revCheck.rows);

  console.log('\n=== REVERSAL / DEBIT NOTE / CREDIT NOTE COLUMNS IN VOUCHER ===');
  const vchCols = await client.query(`
    SELECT column_name, data_type, is_nullable
    FROM information_schema.columns
    WHERE table_name = 'accounting_voucher'
    ORDER BY ordinal_position
  `);
  console.log(vchCols.rows.map(r => `${r.column_name} (${r.data_type}, nullable: ${r.is_nullable})`));

  console.log('\n=== JOURNAL REVERSAL COLUMNS ===');
  const jnlCols = await client.query(`
    SELECT column_name, data_type, is_nullable
    FROM information_schema.columns
    WHERE table_name = 'accounting_journal_entry'
    ORDER BY ordinal_position
  `);
  console.log(jnlCols.rows.map(r => `${r.column_name} (${r.data_type}, nullable: ${r.is_nullable})`));

  console.log('\n=== INVENTORY MOVEMENT TYPES ===');
  const movCheck = await client.query(`
    SELECT conname, pg_get_constraintdef(oid) 
    FROM pg_constraint 
    WHERE conrelid = 'public.inventory_movement'::regclass 
      AND conname = 'chk_movement_type'
  `);
  console.log(movCheck.rows);

  console.log('\n=== INVENTORY MOVEMENT COLUMNS ===');
  const movCols = await client.query(`
    SELECT column_name, data_type, is_nullable
    FROM information_schema.columns
    WHERE table_name = 'inventory_movement'
    ORDER BY ordinal_position
  `);
  console.log(movCols.rows.map(r => `${r.column_name} (${r.data_type}, nullable: ${r.is_nullable})`));

  console.log('\n=== INVENTORY COST LOT STATUSES & CONSTRAINTS ===');
  const lotCheck = await client.query(`
    SELECT conname, pg_get_constraintdef(oid) 
    FROM pg_constraint 
    WHERE conrelid = 'public.inventory_cost_lot'::regclass
  `);
  console.log(lotCheck.rows.map(r => `${r.conname}: ${r.pg_get_constraintdef}`));

  console.log('\n=== INVENTORY COST CONSUMPTION COLUMNS ===');
  const conCols = await client.query(`
    SELECT column_name, data_type, is_nullable
    FROM information_schema.columns
    WHERE table_name = 'inventory_cost_consumption'
    ORDER BY ordinal_position
  `);
  console.log(conCols.rows.map(r => `${r.column_name} (${r.data_type}, nullable: ${r.is_nullable})`));

  console.log('\n=== PURCHASE CONSTRAINTS & COLUMNS ===');
  const pchCols = await client.query(`
    SELECT column_name, data_type, is_nullable
    FROM information_schema.columns
    WHERE table_name = 'purchase'
    ORDER BY ordinal_position
  `);
  console.log(pchCols.rows.map(r => `${r.column_name} (${r.data_type}, nullable: ${r.is_nullable})`));

  console.log('\n=== PURCHASE CHECK CONSTRAINTS ===');
  const pchCheck = await client.query(`
    SELECT conname, pg_get_constraintdef(oid) 
    FROM pg_constraint 
    WHERE conrelid = 'public.purchase'::regclass
  `);
  console.log(pchCheck.rows.map(r => `${r.conname}: ${r.pg_get_constraintdef}`));

  console.log('\n=== PURCHASE PAYMENT CHECK CONSTRAINTS & COLUMNS ===');
  const payCols = await client.query(`
    SELECT column_name, data_type, is_nullable
    FROM information_schema.columns
    WHERE table_name = 'purchase_payment'
    ORDER BY ordinal_position
  `);
  console.log(payCols.rows.map(r => `${r.column_name} (${r.data_type}, nullable: ${r.is_nullable})`));

  await client.end();
}

run().catch(console.error);
