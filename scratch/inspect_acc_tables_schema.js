const fs = require('fs');
const path = require('path');
const { Client } = require(path.resolve(__dirname, '../frontend/node_modules/pg'));

function getDbConn() {
  const env = fs.readFileSync('.env', 'utf8');
  for (const line of env.split('\n')) {
    if (line.trim().startsWith('DATABASE_URL=')) {
      let val = line.trim().substring('DATABASE_URL='.length).trim();
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) val = val.slice(1, -1);
      return val;
    }
  }
}

async function check() {
  const client = new Client({ connectionString: getDbConn(), ssl: { rejectUnauthorized: false } });
  await client.connect();
  const tables = [
    'accounting_account',
    'accounting_fiscal_period',
    'accounting_voucher',
    'accounting_journal_entry',
    'accounting_journal_line',
    'invoice',
    'purchase',
    'expense',
    'supplier',
    'bank_account',
    'teller',
    'teller_session',
    'teller_movement',
    'bank_statement_import',
    'bank_deposit_slip'
  ];
  for (const t of tables) {
    const res = await client.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_schema = 'public' AND table_name = $1
      ORDER BY ordinal_position
    `, [t]);
    console.log(`\nTABLE: ${t} (${res.rows.length} columns)`);
    console.log('  ' + res.rows.map(r => `${r.column_name} (${r.data_type})`).join(', '));
  }
  await client.end();
}

check().catch(console.error);
