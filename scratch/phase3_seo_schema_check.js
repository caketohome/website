const { Pool } = require('pg');
const pool = new Pool({
  connectionString: '[REDACTED_DATABASE_CREDENTIAL]',
  ssl: { rejectUnauthorized: false }
});

async function main() {
  // Check for existing SEO-related tables
  const tables = await pool.query(`
    SELECT table_name FROM information_schema.tables
    WHERE table_name LIKE '%seo%' OR table_name LIKE '%redirect%' OR table_name LIKE '%sitemap%'
      OR table_name LIKE '%robot%' OR table_name LIKE '%keyword%' OR table_name LIKE '%crawl%'
    ORDER BY table_name
  `);
  console.log('=== SEO-related tables ===');
  tables.rows.forEach(r => console.log(r.table_name));

  // Check cms_page SEO columns
  const cmsCols = await pool.query(`
    SELECT column_name, data_type FROM information_schema.columns
    WHERE table_name = 'cms_page'
    ORDER BY ordinal_position
  `);
  console.log('\n=== cms_page columns ===');
  cmsCols.rows.forEach(c => console.log(`  ${c.column_name}: ${c.data_type}`));

  // Sample CMS page SEO data
  const pages = await pool.query('SELECT id, title, slug, meta_title, meta_description, canonical_url, og_image FROM cms_page LIMIT 5');
  console.log('\n=== cms_page SEO data (first 5) ===');
  pages.rows.forEach(p => console.log(JSON.stringify(p)));

  // Check cms_redirect
  const redirects = await pool.query('SELECT * FROM cms_redirect LIMIT 5');
  console.log('\n=== cms_redirect (first 5) ===');
  console.log(`Total: ${(await pool.query('SELECT COUNT(*) FROM cms_redirect')).rows[0].count} rows`);

  // Check if setting table has SEO entries
  const seoSettings = await pool.query("SELECT key, value FROM setting WHERE key LIKE '%seo%' OR key LIKE '%meta%' OR key LIKE '%robots%' ORDER BY key");
  console.log('\n=== SEO-related settings ===');
  seoSettings.rows.forEach(s => console.log(`  ${s.key} = ${typeof s.value === 'string' ? s.value.slice(0, 80) : JSON.stringify(s.value).slice(0, 80)}`));

  await pool.end();
}
main().catch(e => { console.error(e); process.exit(1); });
