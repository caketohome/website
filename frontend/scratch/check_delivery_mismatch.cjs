const fs = require('fs');
const path = require('path');
const { Client } = require('pg');

let envFile = path.resolve(__dirname, '../../.env');
if (!fs.existsSync(envFile)) envFile = path.resolve(__dirname, '../.env');
const env = fs.readFileSync(envFile, 'utf8');
let dbUrl = '';
for (const line of env.split('\n')) {
  if (line.trim().startsWith('DATABASE_URL=')) {
    dbUrl = line.trim().substring('DATABASE_URL='.length).trim();
    if ((dbUrl.startsWith('"') && dbUrl.endsWith('"')) || (dbUrl.startsWith("'") && dbUrl.endsWith("'"))) {
      dbUrl = dbUrl.slice(1, -1);
    }
  }
}

async function run() {
  const client = new Client({ connectionString: dbUrl, ssl: { rejectUnauthorized: false } });
  await client.connect();

  const res = await client.query(`
    SELECT 
      COUNT(*) FILTER (WHERE o.metadata->>'delivery_status' = 'delivered' AND i.id IS NULL) as delivered_missing_invoice_real,
      COUNT(*) FILTER (WHERE o.status = 'completed' AND i.id IS NULL) as completed_missing_invoice,
      COUNT(*) FILTER (WHERE o.status::text = 'delivered' AND i.id IS NULL) as status_delivered_missing_invoice
    FROM public."order" o
    LEFT JOIN public.invoice i ON i.order_id = o.id;
  `);
  console.log('--- DELIVERED MISSING INVOICE COUNTS ---');
  console.table(res.rows);

  await client.end();
}
run().catch(console.error);
