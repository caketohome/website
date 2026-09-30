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
  throw new Error("No database connection string found");
}

async function run() {
  const client = new Client({ connectionString: getConnectionString() });
  await client.connect();
  const prods = await client.query(`
    SELECT p.id, p.title, p.merchandise_type, pv.id as variant_id 
    FROM public.product p 
    JOIN public.product_variant pv ON p.id = pv.product_id 
    WHERE p.deleted_at IS NULL AND p.merchandise_type = 'ACCESSORY'
    LIMIT 5;
  `);
  console.log('ACCESSORY PRODUCTS:', prods.rows);
  await client.end();
}
run();
