/**
 * Phase 4F Step 4.6 Forensic Inspection Script (Read-Only)
 */
const { Pool } = require('pg');
require('dotenv').config({ path: 'backend/.env' });

const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

async function runForensics() {
  const client = await pool.connect();
  try {
    console.log('=== Step 4.6 Forensic Database Inspection ===\n');

    // 1. Check all tables in public schema
    const tablesRes = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      ORDER BY table_name;
    `);
    console.log('--- 1. Tables in public schema ---');
    const tableNames = tablesRes.rows.map(r => r.table_name);
    console.log(tableNames.join(', '));

    // Look for return / refund tables
    const returnTables = tableNames.filter(t => t.includes('return') || t.includes('refund') || t.includes('credit'));
    console.log('\nPotential return/refund/credit tables:', returnTables);

    // 2. Chart of Accounts Inspection for 4190 and related accounts
    console.log('\n--- 2. Chart of Accounts Inspection ---');
    const coaRes = await client.query(`
      SELECT id, code, name, type, group_name, sub_group, is_leaf, is_active, is_system_controlled, balance_nature
      FROM public.accounting_account
      WHERE code IN ('4190', '4110', '4120', '4130', '1121', '1122', '1111', '1112', '1113', '1131', '1132', '5110', '5120', '2121', '2122', '2123', '2124', '2125', '2126', '2127', '2128', '2129', '2170', '2180', '5290')
      ORDER BY code;
    `);
    console.table(coaRes.rows);

    // Check specifically if 4190 exists
    const acc4190 = coaRes.rows.find(r => r.code === '4190');
    console.log('Account 4190 inspection:', acc4190 ? 'EXISTS' : 'DOES NOT EXIST');

    // Also check all 4xxx accounts
    const all4xxx = await client.query(`
      SELECT code, name, type, is_leaf, is_active, is_system_controlled
      FROM public.accounting_account
      WHERE code LIKE '4%'
      ORDER BY code;
    `);
    console.log('\nAll 4xxx revenue accounts:');
    console.table(all4xxx.rows);

    // Also check all 21xx liability accounts
    const all21xx = await client.query(`
      SELECT code, name, type, is_leaf, is_active, is_system_controlled
      FROM public.accounting_account
      WHERE code LIKE '21%'
      ORDER BY code;
    `);
    console.log('\nAll 21xx liability accounts:');
    console.table(all21xx.rows);

    // 3. Payment Transaction Columns & Constraints
    console.log('\n--- 3. payment_transaction Schema ---');
    const ptCols = await client.query(`
      SELECT column_name, data_type, is_nullable, column_default
      FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'payment_transaction'
      ORDER BY ordinal_position;
    `);
    console.table(ptCols.rows);

    // Check payment_transaction check constraints & enums
    const ptConstraints = await client.query(`
      SELECT conname, pg_get_constraintdef(c.oid) as def
      FROM pg_constraint c
      JOIN pg_namespace n ON n.oid = c.connamespace
      JOIN pg_class cl ON cl.oid = c.conrelid
      WHERE n.nspname = 'public' AND cl.relname = 'payment_transaction';
    `);
    console.log('\npayment_transaction constraints:');
    console.table(ptConstraints.rows);

    // Existing payment_transaction distinct statuses
    const ptStatuses = await client.query(`
      SELECT status, settlement_status, count(*) as count
      FROM public.payment_transaction
      GROUP BY status, settlement_status;
    `);
    console.log('\npayment_transaction distinct statuses in live DB:');
    console.table(ptStatuses.rows);

    // 4. accounting_voucher Voucher Types & Constraints
    console.log('\n--- 4. accounting_voucher Schema & Constraints ---');
    const avConstraints = await client.query(`
      SELECT conname, pg_get_constraintdef(c.oid) as def
      FROM pg_constraint c
      JOIN pg_namespace n ON n.oid = c.connamespace
      JOIN pg_class cl ON cl.oid = c.conrelid
      WHERE n.nspname = 'public' AND cl.relname = 'accounting_voucher';
    `);
    console.log('accounting_voucher constraints:');
    console.table(avConstraints.rows);

    // 5. inventory_movement Movement Types & Constraints
    console.log('\n--- 5. inventory_movement Schema & Constraints ---');
    const imConstraints = await client.query(`
      SELECT conname, pg_get_constraintdef(c.oid) as def
      FROM pg_constraint c
      JOIN pg_namespace n ON n.oid = c.connamespace
      JOIN pg_class cl ON cl.oid = c.conrelid
      WHERE n.nspname = 'public' AND cl.relname = 'inventory_movement';
    `);
    console.log('inventory_movement constraints:');
    console.table(imConstraints.rows);

    // 6. inventory_cost_lot & consumption constraints
    console.log('\n--- 6. inventory_cost_consumption Schema & Constraints ---');
    const iccCols = await client.query(`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'inventory_cost_consumption'
      ORDER BY ordinal_position;
    `);
    console.table(iccCols.rows);

    const iclConstraints = await client.query(`
      SELECT conname, pg_get_constraintdef(c.oid) as def
      FROM pg_constraint c
      JOIN pg_namespace n ON n.oid = c.connamespace
      JOIN pg_class cl ON cl.oid = c.conrelid
      WHERE n.nspname = 'public' AND cl.relname = 'inventory_cost_lot';
    `);
    console.log('inventory_cost_lot constraints:');
    console.table(iclConstraints.rows);

    // 7. Order columns and structure
    console.log('\n--- 7. order Schema & Columns ---');
    const ordCols = await client.query(`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'order'
      ORDER BY ordinal_position;
    `);
    console.table(ordCols.rows);

    // Order status distinct values in live DB
    const ordStatuses = await client.query(`
      SELECT status, count(*) as count
      FROM public."order"
      GROUP BY status;
    `);
    console.log('\norder distinct statuses in live DB:');
    console.table(ordStatuses.rows);

  } finally {
    client.release();
    await pool.end();
  }
}

runForensics().catch(err => {
  console.error('Forensics error:', err);
  process.exit(1);
});
