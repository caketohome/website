const path = require('path');
const { Pool } = require(path.join(__dirname, '../frontend/node_modules/pg'));
const pool = new Pool({
  connectionString: '[REDACTED_DATABASE_CREDENTIAL]',
  ssl: { rejectUnauthorized: false }
});

(async () => {
  const res = await pool.query("SELECT id, slug, title, status, blocks FROM cms_page");
  console.log(`Found ${res.rows.length} pages:`);
  res.rows.forEach(r => {
    const b = typeof r.blocks === 'string' ? JSON.parse(r.blocks) : r.blocks;
    const secs = b?.sections || [];
    const pubSecs = b?.published_config?.sections || [];
    if (secs.length > 0 || pubSecs.length > 0) {
      console.log(`Page [${r.id}] slug: "${r.slug}" - ${secs.length} draft secs, ${pubSecs.length} pub secs`);
      secs.forEach(s => console.log(`   - draft: ${s.type} (${s.name})`));
      pubSecs.forEach(s => console.log(`   - pub: ${s.type} (${s.name})`));
    }
  });
  await pool.end();
})();
