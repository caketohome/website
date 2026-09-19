const path = require('path');
const { Pool } = require(path.join(__dirname, '../frontend/node_modules/pg'));
const pool = new Pool({
  connectionString: 'postgresql://postgres.uubwhsnnrnicyczwqlbq:caketohomeqwerty@aws-1-ap-south-1.pooler.supabase.com:6543/postgres',
  ssl: { rejectUnauthorized: false }
});

(async () => {
  // 1. Check all occasions in DB / ApiEngine
  const occRes = await pool.query("SELECT id, name, slug, is_active FROM occasion ORDER BY id ASC");
  console.log('--- Occasions in DB (' + occRes.rows.length + ') ---');
  console.log(occRes.rows);

  // 2. Check all categories in DB
  const catRes = await pool.query("SELECT id, name, handle FROM product_category ORDER BY id ASC");
  console.log('\n--- Categories in DB (' + catRes.rows.length + ') ---');
  console.log(catRes.rows);

  // 3. Check products metadata for occasion and category tags
  const prodRes = await pool.query("SELECT id, title, metadata->>'category' as category, metadata->>'category_slug' as category_slug, metadata->>'category_id' as category_id, metadata->>'occasion' as occasion, metadata->>'occasion_ids' as occasion_ids FROM product LIMIT 10");
  console.log('\n--- Sample Products in DB ---');
  console.log(prodRes.rows);

  await pool.end();
})();
