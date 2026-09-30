/**
 * Forensic inspection - focused on CoA, payment_transaction, accounting_voucher, inventory_movement
 */
const fs = require('fs');
const path = require('path');
const { Client } = require('../node_modules/pg');

function getConnectionString() {
  if (process.env.PG_URL) return process.env.PG_URL;
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL;
  const envPath = path.join(__dirname, '../../backend/.env');
  const envContent = fs.readFileSync(envPath, 'utf8');
  for (const line of envContent.split('\n')) {
    if (line.startsWith('DATABASE_URL=')) {
      let val = line.substring('DATABASE_URL='.length).trim();
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
        val = val.slice(1, -1);
      }
      return val;
    }
  }
  throw new Error("No database connection string found");
}

async function runFocused() {
  const client = new Client({ connectionString: getConnectionString() });
  await client.connect();
  try {
    console.log('--- A. Chart of Accounts 4xxx and 4190 check ---');
    const acc4190 = await client.query(`
      SELECT id, code, name, type, subtype, level, is_group, is_system, is_active, tax_rate, tax_class
      FROM public.accounting_account
      WHERE code = '4190';
    `);
    console.log('Account 4190 row:', acc4190.rows);

    const relatedCoa = await client.query(`
      SELECT code, name, type, subtype, is_group, is_system, is_active
      FROM public.accounting_account
      WHERE code IN ('1111', '1112', '1113', '1121', '1122', '1131', '1132', '1133', '2111', '2121', '2122', '2123', '2124', '2125', '2126', '2170', '2180', '4110', '4120', '4130', '4190', '5110', '5120', '5130', '5290')
      ORDER BY code;
    `);
    console.log('\nRelated CoA accounts:');
    console.table(relatedCoa.rows);

    console.log('\n--- B. payment_transaction constraints & types ---');
    const ptCons = await client.query(`
      SELECT conname, pg_get_constraintdef(c.oid) as def
      FROM pg_constraint c
      JOIN pg_namespace n ON n.oid = c.connamespace
      JOIN pg_class cl ON cl.oid = c.conrelid
      WHERE n.nspname = 'public' AND cl.relname = 'payment_transaction';
    `);
    console.table(ptCons.rows);

    const ptStatusEnums = await client.query(`
      SELECT t.typname, e.enumlabel
      FROM pg_type t
      JOIN pg_enum e ON t.oid = e.enumtypid
      WHERE t.typname IN ('payment_transaction_status', 'payment_status', 'order_status');
    `);
    console.log('\nEnum labels:');
    console.table(ptStatusEnums.rows);

    console.log('\n--- C. accounting_voucher constraints ---');
    const avCons = await client.query(`
      SELECT conname, pg_get_constraintdef(c.oid) as def
      FROM pg_constraint c
      JOIN pg_namespace n ON n.oid = c.connamespace
      JOIN pg_class cl ON cl.oid = c.conrelid
      WHERE n.nspname = 'public' AND cl.relname = 'accounting_voucher';
    `);
    console.table(avCons.rows);

    console.log('\n--- D. inventory_movement constraints ---');
    const imCons = await client.query(`
      SELECT conname, pg_get_constraintdef(c.oid) as def
      FROM pg_constraint c
      JOIN pg_namespace n ON n.oid = c.connamespace
      JOIN pg_class cl ON cl.oid = c.conrelid
      WHERE n.nspname = 'public' AND cl.relname = 'inventory_movement';
    `);
    console.table(imCons.rows);

  } finally {
    await client.end();
  }
}

runFocused().catch(console.error);
