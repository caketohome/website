const { Pool } = require('pg');
const pool = new Pool({
  connectionString: 'postgresql://postgres.uubwhsnnrnicyczwqlbq:caketohomeqwerty@aws-1-ap-south-1.pooler.supabase.com:6543/postgres',
  ssl: { rejectUnauthorized: false }
});

async function main() {
  const tables = ['cms_redirect', 'audit_log', 'config_audit_log', 'media', 'login_event', 'security_event', 'inventory_item', 'inventory_level', 'category', 'product_category', 'tax_rate', 'tax_region'];
  for (const t of tables) {
    try {
      const cols = await pool.query(
        "SELECT column_name, data_type FROM information_schema.columns WHERE table_name = $1 ORDER BY ordinal_position", [t]
      );
      if (cols.rows.length > 0) {
        const count = await pool.query(`SELECT COUNT(*) as cnt FROM "${t}"`);
        console.log(`=== ${t} (${cols.rows.length} cols, ${count.rows[0].cnt} rows) ===`);
        cols.rows.forEach(c => console.log(`  ${c.column_name}: ${c.data_type}`));
      } else {
        console.log(`=== ${t}: TABLE NOT FOUND ===`);
      }
    } catch (e) {
      console.log(`=== ${t}: ERROR — ${e.message} ===`);
    }
  }
  await pool.end();
}
main().catch(e => { console.error(e); process.exit(1); });
