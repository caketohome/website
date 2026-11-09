const { Client } = require('../frontend/node_modules/pg');
const fs = require('fs');
const env = fs.readFileSync('./frontend/.env', 'utf8');
const dbUrl = env.split('\n').find(l => l.startsWith('DATABASE_URL=')).split('=')[1].trim();
const client = new Client({ connectionString: dbUrl, ssl: { rejectUnauthorized: false } });
client.connect().then(async () => {
  const q = await client.query(`
    SELECT b.id, b.name, COUNT(bi.product_id) as acc_count
    FROM public.branch b
    JOIN public.branch_inventory bi ON bi.branch_id = b.id
    JOIN public.product p ON p.id = bi.product_id
    WHERE bi.quantity - bi.reserved >= 5 AND p.merchandise_type = 'ACCESSORY' AND b.deleted_at IS NULL
    GROUP BY b.id, b.name
  `);
  console.log('Branches with stocked accessories:', q.rows);
  await client.end();
}).catch(console.error);
