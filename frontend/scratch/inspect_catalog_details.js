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

  console.log("=== PRODUCT CATEGORIES IN DB ===");
  const catRes = await client.query(`
    SELECT id, name, handle, parent_category_id FROM public.product_category ORDER BY name;
  `);
  console.log(catRes.rows);

  console.log("=== ALL PRODUCTS IN DB (ID, TITLE, IS_GIFTCARD, METADATA) ===");
  const prodRes = await client.query(`
    SELECT id, title, handle, metadata FROM public.product ORDER BY title;
  `);
  prodRes.rows.forEach(p => console.log(`${p.id} | ${p.title} | ${JSON.stringify(p.metadata)}`));

  console.log("=== ACCESSORY INVENTORY IN BRANCH_INVENTORY ===");
  const accInv = await client.query(`
    SELECT DISTINCT product_id, available_stock, reserved_stock
    FROM public.branch_inventory
    LIMIT 10;
  `);
  console.log(accInv.rows);

  await client.end();
}

run().catch(console.error);
