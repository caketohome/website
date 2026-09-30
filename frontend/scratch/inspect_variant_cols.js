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

  const cols = await client.query(`
    SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'product_variant' AND table_schema = 'public';
  `);
  console.log("product_variant columns:", cols.rows);

  const sample = await client.query(`SELECT id, title, sku, barcode, ean, upc, inventory_quantity, manage_inventory, product_id FROM public.product_variant LIMIT 5;`);
  console.log("product_variant sample:", sample.rows);

  await client.end();
}

run().catch(console.error);
