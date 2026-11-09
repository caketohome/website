const { Pool } = require('pg');
const pool = new Pool({
  connectionString: '[REDACTED_DATABASE_CREDENTIAL]',
  ssl: { rejectUnauthorized: false }
});

async function main() {
  // 1. List all tables
  const tables = await pool.query(
    "SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename"
  );
  console.log('=== PostgreSQL Tables ===');
  tables.rows.forEach(t => console.log(' ', t.tablename));
  console.log(`\nTotal: ${tables.rows.length} tables`);

  // 2. Check for SEO/media/redirect tables
  console.log('\n=== SEO/Media/Redirect Related Tables ===');
  const seoTables = tables.rows.filter(t =>
    t.tablename.includes('seo') || t.tablename.includes('media') ||
    t.tablename.includes('redirect') || t.tablename.includes('sitemap') ||
    t.tablename.includes('robot') || t.tablename.includes('audit') ||
    t.tablename.includes('location') || t.tablename.includes('crawler') ||
    t.tablename.includes('visibility')
  );
  if (seoTables.length === 0) {
    console.log('  None found (new tables needed)');
  } else {
    seoTables.forEach(t => console.log(' ', t.tablename));
  }

  // 3. Check existing table structures for key tables
  const keyTables = ['product', 'category', 'branch', 'customer', 'order', 'cms_page', 'cms_homepage_section', 'setting', 'offer', 'inventory'];
  for (const tableName of keyTables) {
    const exists = tables.rows.find(t => t.tablename === tableName);
    if (exists) {
      const cols = await pool.query(
        "SELECT column_name, data_type, is_nullable FROM information_schema.columns WHERE table_name = $1 ORDER BY ordinal_position",
        [tableName]
      );
      console.log(`\n=== ${tableName} (${cols.rows.length} columns) ===`);
      cols.rows.forEach(c => console.log(`  ${c.column_name}: ${c.data_type} ${c.is_nullable === 'NO' ? 'NOT NULL' : ''}`));
    }
  }

  await pool.end();
}

main().catch(e => { console.error(e); process.exit(1); });
