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
}

async function run() {
  const client = new Client({ connectionString: getConnectionString(), ssl: { rejectUnauthorized: false } });
  await client.connect();

  const tables = [
    'accounting_account',
    'accounting_voucher',
    'accounting_journal_entry',
    'accounting_journal_line',
    'accounting_fiscal_period'
  ];

  const results = {};
  for (const table of tables) {
    const res = await client.query(`SELECT count(*)::int as count FROM public.${table};`);
    results[table] = res.rows[0].count;
  }

  const orderRes = await client.query(`SELECT count(*)::int as count FROM public."order";`);
  results['order'] = orderRes.rows[0].count;

  const paymentRes = await client.query(`SELECT count(*)::int as count FROM public.payment_transaction;`);
  results['payment_transaction'] = paymentRes.rows[0].count;

  const settingRes = await client.query(`SELECT count(*)::int as count FROM public.setting WHERE key = 'accounting_start_date';`);
  results['accounting_start_date_configured'] = settingRes.rows[0].count;

  console.log("BASELINE VERIFICATION RESULTS:", JSON.stringify(results, null, 2));

  await client.end();
}

run().catch(console.error);
