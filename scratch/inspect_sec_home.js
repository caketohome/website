const path = require('path');
const { Pool } = require(path.join(__dirname, '../frontend/node_modules/pg'));
const pool = new Pool({
  connectionString: '[REDACTED_DATABASE_CREDENTIAL]',
  ssl: { rejectUnauthorized: false }
});

async function main() {
  const res = await pool.query("SELECT id, name, section_type, title, subtitle, sort_order, is_active FROM cms_homepage_section WHERE id LIKE 'sec_home_%' ORDER BY sort_order ASC");
  console.log('sec_home sections count:', res.rows.length);
  res.rows.forEach(r => console.log(` - [${r.id}] type=${r.section_type}, name="${r.name}", sort=${r.sort_order}, active=${r.is_active}`));
  await pool.end();
}

main().catch(console.error);
