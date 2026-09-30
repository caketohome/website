const fs = require('fs');
const path = require('path');
const { Client } = require('../node_modules/pg');

function getConnectionString() {
  const envContent = fs.readFileSync(path.join(__dirname, '../../backend/.env'), 'utf8');
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

async function run() {
  const client = new Client({ connectionString: getConnectionString() });
  await client.connect();

  try {
    console.log('=== CHECK CONSTRAINTS DETAIL ===');
    const tables = [
      'accounting_voucher',
      'accounting_journal_entry',
      'accounting_journal_line',
      'inventory_movement',
      'inventory_cost_lot',
      'inventory_cost_consumption',
      'branch_inventory'
    ];

    const conRes = await client.query(`
      SELECT cl.relname as table_name, c.conname, pg_get_constraintdef(c.oid) as def
      FROM pg_constraint c
      JOIN pg_class cl ON cl.oid = c.conrelid
      JOIN pg_namespace n ON n.oid = cl.relnamespace
      WHERE n.nspname = 'public'
        AND cl.relname = ANY($1)
        AND c.contype = 'c'
      ORDER BY cl.relname, c.conname;
    `, [tables]);
    conRes.rows.forEach(r => {
      console.log(`[${r.table_name}] ${r.conname}:\n  ${r.def}`);
    });

    console.log('\n=== VOUCHER TABLE COLUMNS ===');
    const vCols = await client.query(`
      SELECT column_name, data_type, is_nullable, column_default
      FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'accounting_voucher'
      ORDER BY ordinal_position;
    `);
    vCols.rows.forEach(r => {
      console.log(`  ${r.column_name.padEnd(28)} | ${r.data_type.padEnd(18)} | null:${r.is_nullable.padEnd(4)} | default:${r.column_default || ''}`);
    });

    console.log('\n=== JOURNAL ENTRY COLUMNS ===');
    const jCols = await client.query(`
      SELECT column_name, data_type, is_nullable, column_default
      FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'accounting_journal_entry'
      ORDER BY ordinal_position;
    `);
    jCols.rows.forEach(r => {
      console.log(`  ${r.column_name.padEnd(28)} | ${r.data_type.padEnd(18)} | null:${r.is_nullable.padEnd(4)} | default:${r.column_default || ''}`);
    });

    console.log('\n=== INVENTORY MOVEMENT COLUMNS ===');
    const mCols = await client.query(`
      SELECT column_name, data_type, is_nullable, column_default
      FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'inventory_movement'
      ORDER BY ordinal_position;
    `);
    mCols.rows.forEach(r => {
      console.log(`  ${r.column_name.padEnd(28)} | ${r.data_type.padEnd(18)} | null:${r.is_nullable.padEnd(4)} | default:${r.column_default || ''}`);
    });

  } finally {
    await client.end();
  }
}

run().catch(console.error);
