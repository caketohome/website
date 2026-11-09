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

  console.log('--- ORDER STATUS BREAKDOWN ---');
  const statusRes = await client.query(`
    SELECT status, count(*) 
    FROM public."order" 
    GROUP BY status 
    ORDER BY count(*) DESC;
  `);
  console.table(statusRes.rows);

  console.log('\n--- INVOICE COUNT BY ORDER STATUS ---');
  const invJoin = await client.query(`
    SELECT 
      o.status, 
      count(o.id) as total_orders,
      count(i.id) as invoiced_orders,
      count(o.id) - count(i.id) as un_invoiced_orders
    FROM public."order" o
    LEFT JOIN public.invoice i ON i.order_id = o.id
    GROUP BY o.status;
  `);
  console.table(invJoin.rows);

  console.log('\n--- 5 INVOICE RECORDS DETAILED CHECK ---');
  const invs = await client.query(`
    SELECT i.id, i.invoice_number, i.order_id, o.status as order_status, o.order_number, i.grand_total, i.delivered_at, i.created_at
    FROM public.invoice i
    LEFT JOIN public."order" o ON o.id = i.order_id;
  `);
  console.table(invs.rows);

  await client.end();
}

run().catch(console.error);
