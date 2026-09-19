const path = require('path');
const { Pool } = require(path.join(__dirname, '../frontend/node_modules/pg'));
const pool = new Pool({
  connectionString: 'postgresql://postgres.uubwhsnnrnicyczwqlbq:caketohomeqwerty@aws-1-ap-south-1.pooler.supabase.com:6543/postgres',
  ssl: { rejectUnauthorized: false }
});

(async () => {
  const res = await pool.query("SELECT id, title, slug, blocks, updated_at FROM cms_page WHERE id = 'cmspg_home'");
  const row = res.rows[0];
  console.log('id:', row.id);
  console.log('title:', row.title);
  console.log('updated_at:', row.updated_at);
  const blocks = typeof row.blocks === 'string' ? JSON.parse(row.blocks) : row.blocks;
  console.log('Keys of blocks:', Object.keys(blocks || {}));
  console.log('blocks.subheading:', blocks?.subheading);
  console.log('blocks.draft_config:', blocks?.draft_config ? Object.keys(blocks.draft_config) : 'none');
  await pool.end();
})();
