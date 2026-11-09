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

  console.log('--- SAMPLE OF 5 COMPLETED ORDERS WITHOUT INVOICES ---');
  const res = await client.query(`
    SELECT o.id, o.order_number, o.status, 
           o.metadata->>'delivery_status' as delivery_status,
           o.metadata->>'fulfillment_status' as fulfillment_status,
           o.metadata->>'delivered_at' as delivered_at,
           o.metadata->>'invoice_number' as meta_inv_number,
           o.created_at
    FROM public."order" o
    LEFT JOIN public.invoice i ON i.order_id = o.id
    WHERE o.status = 'completed' AND i.id IS NULL
    LIMIT 5;
  `);
  console.table(res.rows);

  console.log('\n--- SAMPLE OF PENDING ORDERS METADATA ---');
  const pendingSample = await client.query(`
    SELECT o.id, o.order_number, o.status, 
           o.metadata->>'delivery_status' as delivery_status,
           o.metadata->>'delivered_at' as delivered_at
    FROM public."order" o
    WHERE o.status = 'pending'
    LIMIT 5;
  `);
  console.table(pendingSample.rows);

  // Check what ReportRepository.getOrderRegister returns for orderStatus
  const ordRegSample = await client.query(`
    SELECT DISTINCT 
      status::text as db_status, 
      metadata->>'delivery_status' as delivery_status,
      count(*) 
    FROM public."order"
    GROUP BY status, metadata->>'delivery_status';
  `);
  console.log('\n--- COMBINATION OF STATUS AND METADATA DELIVERY STATUS ---');
  console.table(ordRegSample.rows);

  await client.end();
}

run().catch(console.error);
