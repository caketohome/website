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

async function run() {
  const client = new Client({ connectionString: getConn(), ssl: { rejectUnauthorized: false } });
  await client.connect();

  const res = await client.query(`
    SELECT table_name 
    FROM information_schema.tables 
    WHERE table_schema = 'public' 
    ORDER BY table_name;
  `);

  console.log(`Found ${res.rows.length} public tables in PostgreSQL:`);
  console.log(res.rows.map(r => r.table_name).join(', '));

  // Count rows in key accounting tables
  const keyTables = [
    'accounting_account',
    'accounting_voucher',
    'accounting_journal_entry',
    'accounting_journal_line',
    'accounting_fiscal_period',
    'setting',
    'customer',
    'invoice',
    'customer_receipt',
    'customer_receipt_allocation',
    'supplier',
    'purchase_invoice',
    'expense',
    'expense_category',
    'teller',
    'teller_session',
    'teller_movement',
    'bank_account',
    'bank_reconciliation_session',
    'cost_centre',
    'cost_allocation_rule',
    'branch',
    'product',
    'product_variant',
    'inventory_item'
  ];

  console.log('\n--- ROW COUNTS IN KEY TABLES ---');
  for (const tbl of keyTables) {
    try {
      const countRes = await client.query(`SELECT COUNT(*) as count FROM public."${tbl}"`);
      console.log(`  ${tbl.padEnd(32)}: ${countRes.rows[0].count} rows`);
    } catch (err) {
      console.log(`  ${tbl.padEnd(32)}: TABLE DOES NOT EXIST OR ERROR (${err.message})`);
    }
  }

  await client.end();
}

run().catch(console.error);
