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

async function check() {
  const client = new Client({ connectionString: getConn(), ssl: { rejectUnauthorized: false } });
  await client.connect();
  const res = await client.query('SELECT period_name, start_date::text, end_date::text, is_locked FROM accounting_fiscal_period ORDER BY start_date');
  console.log('--- Accounting Fiscal Periods ---');
  console.table(res.rows);
  const setting = await client.query("SELECT key, value, description FROM setting WHERE key = 'accounting_start_date'");
  console.log('--- Setting Table ---');
  console.table(setting.rows);
  await client.end();
}

check();
