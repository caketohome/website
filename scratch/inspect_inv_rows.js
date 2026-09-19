const path = require('path');
const { Pool } = require(path.join(__dirname, '../frontend/node_modules/pg'));

const pool = new Pool({
  connectionString: 'postgresql://postgres.uubwhsnnrnicyczwqlbq:caketohomeqwerty@aws-1-ap-south-1.pooler.supabase.com:6543/postgres',
  ssl: { rejectUnauthorized: false }
});

async function main() {
  console.log('--- 1. Unique Products in branch_inventory ---');
  const invProducts = await pool.query(`
    SELECT DISTINCT 
      bi.product_id,
      p.title as db_title,
      p.metadata->>'category' as category,
      p.metadata->>'category_slug' as cat_slug,
      count(*) as row_count,
      avg(bi.quantity) as avg_qty
    FROM branch_inventory bi
    LEFT JOIN product p ON p.id = bi.product_id
    GROUP BY bi.product_id, p.title, p.metadata->>'category', p.metadata->>'category_slug'
    ORDER BY row_count DESC;
  `);
  console.table(invProducts.rows);

  console.log('\n--- 2. Any rows with quantity != 50 or reserved > 0 ---');
  const nonStandardRows = await pool.query(`
    SELECT bi.*, p.title 
    FROM branch_inventory bi
    LEFT JOIN product p ON p.id = bi.product_id
    WHERE bi.quantity != 50 OR bi.reserved > 0;
  `);
  console.log(`Non-50 quantity or reserved > 0 rows: ${nonStandardRows.rows.length}`);
  console.log(nonStandardRows.rows);

  console.log('\n--- 3. Are there accessory products in product table? ---');
  const accProducts = await pool.query(`
    SELECT id, title, handle, metadata->>'category' as category, metadata->>'category_slug' as cat_slug
    FROM product
    WHERE metadata->>'category' ILIKE '%acc%' 
       OR metadata->>'category_slug' ILIKE '%acc%'
       OR metadata->>'category' ILIKE '%topper%'
       OR metadata->>'category' ILIKE '%candle%'
       OR title ILIKE '%topper%'
       OR title ILIKE '%candle%';
  `);
  console.log('Accessory products in DB product table:', accProducts.rows);

  await pool.end();
}

main().catch(console.error);
