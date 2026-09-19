const { Pool } = require('../frontend/node_modules/pg');
const pool = new Pool({
  connectionString: 'postgresql://postgres.uubwhsnnrnicyczwqlbq:caketohomeqwerty@aws-1-ap-south-1.pooler.supabase.com:6543/postgres',
  ssl: { rejectUnauthorized: false }
});

async function main() {
  const pcp = await pool.query('SELECT * FROM product_category_product LIMIT 20');
  console.log('product_category_product sample:', pcp.rows);
  const pcpCount = await pool.query('SELECT count(*) FROM product_category_product');
  console.log('product_category_product total count:', pcpCount.rows[0].count);

  const metaSample = await pool.query("SELECT id, title, metadata->>'category' as cat, metadata->>'category_id' as cat_id, metadata->>'category_slug' as cat_slug FROM product");
  const withCat = metaSample.rows.filter(r => r.cat || r.cat_id || r.cat_slug);
  console.log(`Products with category metadata: ${withCat.length} / ${metaSample.rows.length}`);
  console.log('Sample with category:', withCat.slice(0, 5));

  const withoutCat = metaSample.rows.filter(r => !r.cat && !r.cat_id && !r.cat_slug);
  console.log(`Products WITHOUT category metadata: ${withoutCat.length} / ${metaSample.rows.length}`);
  console.log('Sample without category:', withoutCat.slice(0, 5));

  await pool.end();
}

main().catch(console.error);
