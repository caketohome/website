const path = require('path');
const { Pool } = require(path.join(__dirname, '../frontend/node_modules/pg'));
const pool = new Pool({
  connectionString: 'postgresql://postgres.uubwhsnnrnicyczwqlbq:caketohomeqwerty@aws-1-ap-south-1.pooler.supabase.com:6543/postgres',
  ssl: { rejectUnauthorized: false }
});

(async () => {
  const res = await pool.query("SELECT id, slug, status, blocks FROM cms_page WHERE id = 'cmspg_home'");
  const row = res.rows[0];
  const blocks = typeof row.blocks === 'string' ? JSON.parse(row.blocks) : row.blocks;
  console.log('Page status:', row.status);
  console.log('Sections count in blocks.sections:', (blocks?.sections || []).length);
  (blocks?.sections || []).forEach((s, idx) => {
    console.log(`[${idx}] id: ${s.id}, type: ${s.type}, name: ${s.name}, data_source: ${s.config?.data_source}`);
  });

  const pubSections = blocks?.published_config?.sections;
  console.log('Sections count in blocks.published_config.sections:', (pubSections || []).length);
  (pubSections || []).forEach((s, idx) => {
    console.log(`Pub [${idx}] id: ${s.id}, type: ${s.type}, name: ${s.name}, data_source: ${s.config?.data_source}`);
  });

  await pool.end();
})();
