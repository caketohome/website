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

  console.log('--- Constraints on purchase ---');
  const pCon = await client.query(`
    SELECT conname, pg_get_constraintdef(c.oid) as def
    FROM pg_constraint c
    JOIN pg_class t ON c.conrelid = t.oid
    WHERE t.relname = 'purchase'
  `);
  console.log(pCon.rows);

  console.log('--- Columns on purchase ---');
  const pCols = await client.query(`
    SELECT column_name, data_type, is_nullable
    FROM information_schema.columns
    WHERE table_name = 'purchase'
  `);
  console.log(pCols.rows.map(r => `${r.column_name}: ${r.data_type} (null: ${r.is_nullable})`));

  console.log('--- Constraints on accounting_voucher ---');
  const vCon = await client.query(`
    SELECT conname, pg_get_constraintdef(c.oid) as def
    FROM pg_constraint c
    JOIN pg_class t ON c.conrelid = t.oid
    WHERE t.relname = 'accounting_voucher'
  `);
  console.log(vCon.rows);

  console.log('--- Constraints on inventory_movement ---');
  const mCon = await client.query(`
    SELECT conname, pg_get_constraintdef(c.oid) as def
    FROM pg_constraint c
    JOIN pg_class t ON c.conrelid = t.oid
    WHERE t.relname = 'inventory_movement'
  `);
  console.log(mCon.rows);

  console.log('--- Constraints on inventory_cost_lot ---');
  const lCon = await client.query(`
    SELECT conname, pg_get_constraintdef(c.oid) as def
    FROM pg_constraint c
    JOIN pg_class t ON c.conrelid = t.oid
    WHERE t.relname = 'inventory_cost_lot'
  `);
  console.log(lCon.rows);

  await client.end();
}

inspect().catch(console.error);
