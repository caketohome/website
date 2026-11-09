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

  console.log('--- Invoices in public.invoice ---');
  const inv = await client.query('SELECT * FROM public.invoice');
  console.table(inv.rows);

  console.log('--- Customer Payments / Receipts in public.payment ---');
  const payments = await client.query('SELECT * FROM public.payment LIMIT 10');
  console.table(payments.rows);

  await client.end();
}

run();
