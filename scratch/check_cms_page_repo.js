const path = require('path');
const { Pool } = require(path.join(__dirname, '../frontend/node_modules/pg'));
const pool = new Pool({
  connectionString: '[REDACTED_DATABASE_CREDENTIAL]',
  ssl: { rejectUnauthorized: false }
});

async function main() {
  const res = await pool.query("SELECT id, slug, status, blocks, updated_at FROM cms_page WHERE slug = 'home' OR id = 'cmspg_home'");
  console.log('Found rows:', res.rows.length);
  for (const r of res.rows) {
    console.log('\n--- Row id:', r.id, 'slug:', r.slug, 'status:', r.status);
    const b = typeof r.blocks === 'string' ? JSON.parse(r.blocks) : r.blocks;
    console.log('blocks keys:', Object.keys(b || {}));
    console.log('blocks.sections length:', Array.isArray(b?.sections) ? b.sections.length : typeof b?.sections);
    console.log('blocks.published_config keys:', b?.published_config ? Object.keys(b.published_config) : 'none');
    console.log('blocks.published_config.sections length:', Array.isArray(b?.published_config?.sections) ? b.published_config.sections.length : typeof b?.published_config?.sections);
  }
  await pool.end();
}

main().catch(console.error);
