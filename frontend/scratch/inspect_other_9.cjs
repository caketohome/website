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
    SELECT o.id, o.order_number, o.status, 
           o.metadata->>'delivery_status' as delivery_status,
           o.metadata->>'total' as total,
           o.metadata->>'items' as items,
           o.created_at
    FROM public."order" o
    LEFT JOIN public.invoice i ON i.order_id = o.id
    WHERE o.status = 'completed' 
      AND (o.metadata->>'delivery_status' IS NULL OR o.metadata->>'delivery_status' != 'delivered')
      AND i.id IS NULL
    ORDER BY o.created_at ASC;
  `);
  console.log('The other 9 completed orders without delivered status:');
  console.table(res.rows);

  await client.end();
}
run().catch(console.error);
