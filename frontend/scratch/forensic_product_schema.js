const path = require('path');
const fs = require('fs');
const { Pool } = require('pg');

function getConnectionString() {
  const envPath = path.join(__dirname, '../.env');
  const envContent = fs.readFileSync(envPath, 'utf8');
  for (const line of envContent.split('\n')) {
    if (line.trim().startsWith('DATABASE_URL=')) {
      let val = line.trim().substring('DATABASE_URL='.length).trim();
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
        val = val.slice(1, -1);
      }
      return val;
    }
  }
  throw new Error("DATABASE_URL not found");
}

const pool = new Pool({ connectionString: getConnectionString() });

async function inspect() {
  const client = await pool.connect();
  try {
    for (const t of ['product', 'product_variant']) {
      const cols = (await client.query(`
        SELECT column_name, data_type, is_nullable
        FROM information_schema.columns
        WHERE table_schema='public' AND table_name=$1
        ORDER BY ordinal_position;
      `, [t])).rows;
      const count = (await client.query(`SELECT COUNT(*) FROM "${t}"`)).rows[0].count;
      console.log(`\n=== Columns for [${t}] (count: ${count}) ===`);
      cols.forEach(c => console.log(`  ${c.column_name}: ${c.data_type} (nullable: ${c.is_nullable})`));
    }

    // Sample some products & variants
    const prods = await client.query(`
      SELECT p.id, p.title, pv.id as variant_id, pv.sku, pv.barcode
      FROM product p
      LEFT JOIN product_variant pv ON pv.product_id = p.id
      LIMIT 5
    `);
    console.log('\nSample products:', prods.rows);
  } finally {
    client.release();
    await pool.end();
  }
}
inspect().catch(console.error);
