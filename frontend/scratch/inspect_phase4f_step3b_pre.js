const fs = require('fs');
const path = require('path');
const { Client } = require('../node_modules/pg');

function getConnectionString() {
  const envPath = path.join(__dirname, '../../backend/.env');
  const envContent = fs.readFileSync(envPath, 'utf8');
  for (const line of envContent.split('\n')) {
    if (line.startsWith('DATABASE_URL=')) return line.substring('DATABASE_URL='.length).trim();
  }
  throw new Error('No DATABASE_URL in backend/.env');
}

async function inspect() {
  const client = new Client({ connectionString: getConnectionString() });
  await client.connect();

  const tables = [
    'accounting_account', 'purchase', 'purchase_item', 'branch_inventory', 
    'product', 'product_variant', 'branch', 'supplier', 
    'accounting_voucher', 'accounting_journal_entry', 'accounting_journal_line', 
    'accounting_fiscal_period', 'order', 'payment_transaction', 'purchase_payment'
  ];
  
  const counts = {};
  for (const t of tables) {
    try {
      const res = await client.query(`SELECT COUNT(*) as count FROM public."${t}"`);
      counts[t] = parseInt(res.rows[0].count, 10);
    } catch (e) {
      counts[t] = 'ERROR: ' + e.message;
    }
  }
  console.log('TABLE COUNTS:');
  console.log(JSON.stringify(counts, null, 2));

  // Check 1131, 1132, 1133, 5110, 5120, 5130
  const accts = await client.query(`
    SELECT id, code, name, type, subtype, level, is_group, is_active, description 
    FROM public.accounting_account 
    WHERE code IN ('1131', '1132', '1133', '5110', '5120', '5130') 
    ORDER BY code
  `);
  console.log('TARGET ACCOUNTS IN DB:');
  console.log(JSON.stringify(accts.rows, null, 2));

  // Search existing tables for valuation/lot/cost/ledger
  const valTables = await client.query(`
    SELECT table_name 
    FROM information_schema.tables 
    WHERE table_schema = 'public' 
      AND (
        table_name ILIKE '%lot%' 
        OR table_name ILIKE '%valuation%' 
        OR table_name ILIKE '%stock_ledger%' 
        OR table_name ILIKE '%cost%'
        OR table_name ILIKE '%moving_average%'
        OR table_name ILIKE '%fifo%'
      )
  `);
  console.log('EXISTING TABLES MATCHING VALUATION/LOT/COST:');
  console.log(JSON.stringify(valTables.rows, null, 2));

  // Check columns and types of relevant tables:
  const inspectionTables = ['purchase', 'purchase_item', 'branch_inventory', 'product', 'product_variant', 'branch', 'supplier'];
  for (const t of inspectionTables) {
    const cols = await client.query(`
      SELECT column_name, data_type, udt_name, is_nullable, column_default
      FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = $1
      ORDER BY ordinal_position
    `, [t]);
    console.log(`COLUMNS FOR ${t}:`);
    console.log(JSON.stringify(cols.rows.map(c => `${c.column_name} (${c.udt_name}, nullable: ${c.is_nullable})`), null, 2));
  }

  // Check accounting_start_date
  const settingRes = await client.query(`SELECT key, value FROM public.setting WHERE key = 'accounting_start_date'`);
  console.log('ACCOUNTING_START_DATE:');
  console.log(JSON.stringify(settingRes.rows, null, 2));

  await client.end();
}

inspect().catch(err => {
  console.error('Inspection failed:', err);
  process.exit(1);
});
