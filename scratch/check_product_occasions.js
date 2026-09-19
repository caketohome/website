const path = require('path');
const { Pool } = require(path.join(__dirname, '../frontend/node_modules/pg'));
const pool = new Pool({
  connectionString: 'postgresql://postgres.uubwhsnnrnicyczwqlbq:caketohomeqwerty@aws-1-ap-south-1.pooler.supabase.com:6543/postgres',
  ssl: { rejectUnauthorized: false }
});

(async () => {
  const res = await pool.query("SELECT id, title, metadata->>'occasion' as occ, metadata->>'occasion_ids' as occ_ids, metadata->>'category' as cat, metadata->>'category_slug' as cat_slug FROM product LIMIT 30");
  console.log(`Total rows checked: ${res.rows.length}`);
  res.rows.forEach(r => {
    console.log(`- ${r.title}: occ="${r.occ}", occ_ids=${r.occ_ids}, cat="${r.cat}", cat_slug="${r.cat_slug}"`);
  });

  const distRes = await pool.query("SELECT metadata->>'occasion' as occ, COUNT(*) as cnt FROM product GROUP BY metadata->>'occasion'");
  console.log('\nOccasion distribution:');
  console.table(distRes.rows);

  const catDistRes = await pool.query("SELECT metadata->>'category' as cat, metadata->>'category_slug' as cat_slug, COUNT(*) as cnt FROM product GROUP BY metadata->>'category', metadata->>'category_slug'");
  console.log('\nCategory distribution:');
  console.table(catDistRes.rows);

  await pool.end();
})();
