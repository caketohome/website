const path = require('path');
const { Pool } = require(path.join(__dirname, '../frontend/node_modules/pg'));
const pool = new Pool({
  connectionString: 'postgresql://postgres.uubwhsnnrnicyczwqlbq:caketohomeqwerty@aws-1-ap-south-1.pooler.supabase.com:6543/postgres',
  ssl: { rejectUnauthorized: false }
});

(async () => {
  const res = await pool.query("SELECT id, slug, title, status, updated_at FROM cms_page ORDER BY updated_at DESC");
  console.log('Total cms_page rows:', res.rows.length);
  res.rows.forEach(r => {
    console.log(`- [${r.id}] slug: "${r.slug}" | title: "${r.title}" | status: ${r.status} | updated: ${r.updated_at}`);
  });
  await pool.end();
})();
