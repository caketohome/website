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

async function check() {
  const client = new Client({ connectionString: getConnectionString() });
  await client.connect();

  const cols = await client.query(`
    SELECT column_name FROM information_schema.columns WHERE table_name = 'product' AND column_name LIKE '%delete%'
  `);
  console.log("Delete columns in product:", cols.rows);

  const variants = await client.query(`SELECT id, product_id, title FROM public.product_variant LIMIT 5;`);
  console.log("Product variants:", variants.rows);

  await client.end();
}

check();
