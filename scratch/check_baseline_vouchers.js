const fs = require('fs');
const path = require('path');
const { Client } = require('../frontend/node_modules/pg');

function getConn() {
  const env = fs.readFileSync('.env', 'utf8');
  for (const line of env.split('\n')) {
    if (line.trim().startsWith('DATABASE_URL=')) {
      let val = line.trim().substring('DATABASE_URL='.length).trim();
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
        val = val.slice(1, -1);
      }
      return val;
    }
  }
}

async function run() {
  const client = new Client({ connectionString: getConn(), ssl: { rejectUnauthorized: false } });
  await client.connect();

  console.log('--- VOUCHERS ---');
  const v = await client.query('SELECT id, voucher_no, voucher_type, voucher_date, fiscal_year, status FROM accounting_voucher ORDER BY voucher_date');
  console.log(v.rows);

  console.log('\n--- JOURNALS ---');
  const j = await client.query('SELECT id, voucher_id, entry_no, entry_date, fiscal_year FROM accounting_journal_entry ORDER BY entry_date');
  console.log(j.rows);

  console.log('\n--- FISCAL PERIODS ---');
  const fp = await client.query('SELECT * FROM accounting_fiscal_period');
  console.log(fp.rows);

  console.log('\n--- SETTINGS ---');
  const s = await client.query("SELECT * FROM setting WHERE key LIKE '%account%'");
  console.log(s.rows);

  await client.end();
}

run().catch(console.error);
