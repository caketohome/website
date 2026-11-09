const path = require('path');
const { Pool } = require(path.join(__dirname, '../frontend/node_modules/pg'));
const pool = new Pool({
  connectionString: '[REDACTED_DATABASE_CREDENTIAL]',
  ssl: { rejectUnauthorized: false },
  connectionTimeoutMillis: 10000
});

async function main() {
  const start = Date.now();
  const res = await pool.query('SELECT NOW() as now, version() as ver;');
  const duration = Date.now() - start;
  console.log('PostgreSQL Ping Success!');
  console.log('Latency:', duration, 'ms');
  console.log('Server time:', res.rows[0].now);
  console.log('Version:', res.rows[0].ver);
  
  // Count key tables (read-only)
  const tables = ['cms_page', 'cms_homepage_section', 'product', 'product_category', 'media', 'branch'];
  for (const t of tables) {
    const countRes = await pool.query(`SELECT count(*) as c FROM "${t}";`);
    console.log(`Table ${t}: ${countRes.rows[0].c} records`);
  }
  
  // Verify 3 legacy eggless records exist and are untouched
  const egglessRes = await pool.query(`SELECT id, title, metadata FROM product WHERE title ILIKE '%eggless%' OR metadata::text ILIKE '%eggless%';`);
  console.log(`Eggless products found: ${egglessRes.rows.length}`);
  egglessRes.rows.forEach(r => console.log(`  - [${r.id}] ${r.title} | metadata:`, r.metadata));
  
  await pool.end();
}

main().catch(err => {
  console.error('PostgreSQL Connection Error:', err.message);
  process.exit(1);
});
