const path = require('path');
const { Pool } = require(path.join(__dirname, '../frontend/node_modules/pg'));
const pool = new Pool({
  connectionString: 'postgresql://postgres.uubwhsnnrnicyczwqlbq:caketohomeqwerty@aws-1-ap-south-1.pooler.supabase.com:6543/postgres',
  ssl: { rejectUnauthorized: false }
});

async function main() {
  const res = await pool.query("SELECT id, name, section_type, title, subtitle, config, sort_order, is_active FROM cms_homepage_section WHERE id LIKE 'sec_home_%' ORDER BY sort_order ASC");
  res.rows.forEach(r => {
    let cfg = {};
    try { cfg = typeof r.config === 'string' ? JSON.parse(r.config) : r.config; } catch {}
    console.log(`\n=== Section [${r.id}] (${r.section_type}) ===`);
    console.log('Title:', r.title, '| Subtitle:', r.subtitle);
    console.log('Config keys:', Object.keys(cfg || {}));
  });
  await pool.end();
}

main().catch(console.error);
