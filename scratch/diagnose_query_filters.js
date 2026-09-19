const path = require('path');
const { Pool } = require(path.join(__dirname, '../frontend/node_modules/pg'));
const pool = new Pool({
  connectionString: 'postgresql://postgres.uubwhsnnrnicyczwqlbq:caketohomeqwerty@aws-1-ap-south-1.pooler.supabase.com:6543/postgres',
  ssl: { rejectUnauthorized: false }
});

(async () => {
  // Test 1: what is in product where category_slug = 'chocolate-cakes'
  const q1 = await pool.query("SELECT id, title, metadata->>'category' as cat, metadata->>'category_slug' as cat_slug, deleted_at FROM product WHERE (metadata->>'category_id' = $1 OR metadata->>'category' ILIKE $1 OR metadata->>'category_slug' ILIKE $1)", ['chocolate-cakes']);
  console.log('Query with ILIKE "chocolate-cakes":', q1.rows.length, 'rows');
  q1.rows.forEach(r => console.log('  -', r.title, 'deleted_at:', r.deleted_at));

  // Test 2: what about with deleted_at IS NULL
  const q2 = await pool.query("SELECT id, title, metadata->>'category' as cat, metadata->>'category_slug' as cat_slug FROM product WHERE deleted_at IS NULL AND (metadata->>'category_id' = $1 OR metadata->>'category' ILIKE $1 OR metadata->>'category_slug' ILIKE $1)", ['chocolate-cakes']);
  console.log('Query with deleted_at IS NULL and "chocolate-cakes":', q2.rows.length, 'rows');
  q2.rows.forEach(r => console.log('  -', r.title));

  // Test 3: what is the actual category name and slug in product_category?
  const catRows = await pool.query("SELECT id, name, handle FROM product_category");
  console.log('\nAll product_category rows:');
  console.table(catRows.rows);

  // Test 4: what are the categories in product metadata?
  const prodCats = await pool.query("SELECT DISTINCT metadata->>'category' as cat, metadata->>'category_slug' as cat_slug, metadata->>'category_id' as cat_id FROM product WHERE deleted_at IS NULL");
  console.log('\nDistinct categories in product metadata:');
  console.table(prodCats.rows);

  await pool.end();
})();
