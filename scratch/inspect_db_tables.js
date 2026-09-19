const path = require('path');
const { Pool } = require(path.join(__dirname, '../frontend/node_modules/pg'));
const pool = new Pool({
  connectionString: 'postgresql://postgres.uubwhsnnrnicyczwqlbq:caketohomeqwerty@aws-1-ap-south-1.pooler.supabase.com:6543/postgres',
  ssl: { rejectUnauthorized: false }
});

async function main() {
  const tablesRes = await pool.query(`
    SELECT table_name 
    FROM information_schema.tables 
    WHERE table_schema = 'public' 
    ORDER BY table_name;
  `);
  console.log('Public tables in PostgreSQL:', tablesRes.rows.map(r => r.table_name));

  // Check counts for key tables
  for (const t of ['product', 'product_category', 'branch', 'customer', 'order', 'order_item', 'line_item', 'setting', 'offer', 'cms_page', 'cms_homepage_section', 'delivery_zone']) {
    try {
      const c = await pool.query(`SELECT count(*) FROM "${t}"`);
      console.log(`Table "${t}": ${c.rows[0].count} rows`);
    } catch (e) {
      console.log(`Table "${t}": does not exist or error: ${e.message}`);
    }
  }
  await pool.end();
}

main().catch(console.error);
