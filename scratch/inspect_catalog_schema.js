const path = require('path');
const { Pool } = require(path.join(__dirname, '../frontend/node_modules/pg'));
const pool = new Pool({
  connectionString: 'postgresql://postgres.uubwhsnnrnicyczwqlbq:caketohomeqwerty@aws-1-ap-south-1.pooler.supabase.com:6543/postgres',
  ssl: { rejectUnauthorized: false }
});

async function run() {
  const cols = await pool.query(`
    SELECT table_name, column_name, data_type
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name IN ('product_option', 'product_option_value', 'product_category', 'product_category_product', 'variant_option')
    ORDER BY table_name, ordinal_position
  `);
  console.log('Columns:');
  for (const c of cols.rows) {
    console.log(`${c.table_name}.${c.column_name} (${c.data_type})`);
  }

  // Check product_option data
  try {
    const po = await pool.query('SELECT * FROM product_option LIMIT 10');
    console.log('\nproduct_option rows:', po.rows);
  } catch (e) {
    console.log('product_option err:', e.message);
  }

  // Check how products and categories are linked
  const cats = await pool.query(`
    SELECT pc.id, pc.name, pc.handle, count(pcp.product_id) as product_count
    FROM product_category pc
    LEFT JOIN product_category_product pcp ON pcp.product_category_id = pc.id
    GROUP BY pc.id, pc.name, pc.handle
  `);
  console.log('\nCategories:');
  for (const cat of cats.rows) {
    console.log(`- [${cat.id}] ${cat.name} (${cat.handle}): ${cat.product_count} products`);
  }

  await pool.end();
}
run().catch(console.error);
