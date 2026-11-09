const fs = require('fs');
const { Client } = require('pg');
const envContent = fs.readFileSync('.env', 'utf8');
const match = envContent.match(/DATABASE_URL=([^\r\n]+)/);
const client = new Client({ connectionString: match[1].trim(), ssl: { rejectUnauthorized: false } });

async function check() {
  await client.connect();

  const dup99991 = await client.query(`
    SELECT id, display_id, status, created_at, metadata->>'customer_name' as cust_name, metadata->>'payment_method' as pm
    FROM public."order"
    WHERE display_id = 99991
    ORDER BY created_at;
  `);
  console.log("display_id 99991 rows (cnt: " + dup99991.rows.length + "):");
  dup99991.rows.forEach(r => console.log(`  id=${r.id} status=${r.status} created=${r.created_at.toISOString()} pm=${r.pm}`));

  const dup99001 = await client.query(`
    SELECT id, display_id, status, created_at, metadata->>'customer_name' as cust_name
    FROM public."order"
    WHERE display_id in (99001, 99002)
    ORDER BY display_id, created_at;
  `);
  console.log("display_id 99001 & 99002 rows:");
  dup99001.rows.forEach(r => console.log(`  id=${r.id} display_id=${r.display_id} status=${r.status} created=${r.created_at.toISOString()}`));

  // Check the 8 rows with duplicate metadata order numbers
  const dupMeta = await client.query(`
    SELECT id, display_id, metadata->>'order_number' as order_number, status, created_at
    FROM public."order"
    WHERE metadata->>'order_number' in ('CTH-20260828-101', 'CTH-20260828-214')
    ORDER BY metadata->>'order_number', created_at;
  `);
  console.log("Duplicate metadata->>'order_number' rows:");
  dupMeta.rows.forEach(r => console.log(`  id=${r.id} order_number=${r.order_number} display_id=${r.display_id} created=${r.created_at.toISOString()}`));

  await client.end();
}

check().catch(console.error);
