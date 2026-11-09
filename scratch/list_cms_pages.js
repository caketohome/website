const path = require('path');
const { Pool } = require(path.join(__dirname, '../frontend/node_modules/pg'));
const pool = new Pool({
  connectionString: '[REDACTED_DATABASE_CREDENTIAL]',
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
