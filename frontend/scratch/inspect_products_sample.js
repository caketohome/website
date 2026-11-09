const fs = require('fs');
const path = require('path');
const { Client } = require('pg');

function getDbUrl() {
  const envPath = path.join(__dirname, '../.env');
  const lines = fs.readFileSync(envPath, 'utf8').split('\n');
  for (const l of lines) {
    if (l.trim().startsWith('DATABASE_URL=')) {
      return l.trim().substring('DATABASE_URL='.length).trim().replace(/['"]/g, '');
    }
  }
  throw new Error('DATABASE_URL not found');
}

async function main() {
  const client = new Client({ connectionString: getDbUrl(), ssl: { rejectUnauthorized: false } });
  await client.connect();

  const prods = await client.query(`
    SELECT id, title, handle, merchandise_type, metadata->>'category' as category, metadata->>'primary_category_id' as cat_id
    FROM "product"
    WHERE deleted_at IS NULL
    LIMIT 20;
  `);
  console.log("Sample products:", prods.rows);

  const categories = await client.query(`
    SELECT DISTINCT merchandise_type, metadata->>'category' as category
    FROM "product"
    WHERE deleted_at IS NULL;
  `);
  console.log("\nDistinct merchandise_type and categories:", categories.rows);

  const variants = await client.query(`
    SELECT id, product_id, title, sku, barcode
    FROM "product_variant"
    LIMIT 10;
  `);
  console.log("\nSample variants:", variants.rows);

  await client.end();
}

main().catch(console.error);
