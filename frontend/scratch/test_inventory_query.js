const fs = require('fs');
const path = require('path');
const { Client } = require('pg');

function getConnectionString() {
  const envPath = path.join(__dirname, '../.env');
  const lines = fs.readFileSync(envPath, 'utf8').split('\n');
  for (const l of lines) {
    if (l.trim().startsWith('DATABASE_URL=')) {
      let v = l.trim().substring('DATABASE_URL='.length).trim();
      if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
        v = v.slice(1, -1);
      }
      return v;
    }
  }
}

async function run() {
  const client = new Client({ connectionString: getConnectionString(), ssl: { rejectUnauthorized: false } });
  await client.connect();
  try {
    const q = `
      SELECT bi.id, bi.product_id, bi.variant_id, bi.quantity, bi.reserved, 
             (bi.quantity - bi.reserved) as available_stock,
             p.title as name, p.metadata->>'category' as category
      FROM public.branch_inventory bi
      LEFT JOIN public.product p ON bi.product_id = p.id
      WHERE bi.branch_id = 'br_indiranagar' AND bi.deleted_at IS NULL
      ORDER BY bi.created_at ASC;
    `;
    const res = await client.query(q);
    console.log('branch_inventory for br_indiranagar count:', res.rowCount);
    console.log(res.rows);
  } finally {
    await client.end();
  }
}

run().catch(console.error);
