const path = require('path');
const { Pool } = require(path.join(__dirname, '../frontend/node_modules/pg'));
const pool = new Pool({
  connectionString: 'postgresql://postgres.uubwhsnnrnicyczwqlbq:caketohomeqwerty@aws-1-ap-south-1.pooler.supabase.com:6543/postgres',
  ssl: { rejectUnauthorized: false }
});

async function main() {
  const res = await pool.query(`SELECT * FROM "cms_homepage_section" WHERE deleted_at IS NULL AND is_active = true ORDER BY sort_order ASC`);
  console.log(`Found ${res.rows.length} active sections in cms_homepage_section:`);
  const sections = res.rows.map(s => {
    let cfg = {};
    if (s.config) {
      try { cfg = typeof s.config === 'string' ? JSON.parse(s.config) : s.config; } catch {}
    }
    return {
      id: s.id,
      type: s.section_type || s.type,
      name: s.name,
      config: cfg,
      order: s.sort_order ?? 0,
      enabled: s.is_active !== false,
    };
  });
  sections.forEach(s => {
    console.log(` - [${s.id}] type=${s.type}, name="${s.name}", order=${s.order}, enabled=${s.enabled}`);
  });
  await pool.end();
}

main().catch(console.error);
