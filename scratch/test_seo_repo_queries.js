const { Pool } = require('pg');
const pool = new Pool({
  connectionString: 'postgresql://postgres.uubwhsnnrnicyczwqlbq:caketohomeqwerty@aws-1-ap-south-1.pooler.supabase.com:6543/postgres',
  ssl: { rejectUnauthorized: false }
});

async function run() {
  console.log('Testing SeoRepository DB queries:');

  // 1. Setting check / insert
  const settingCheck = await pool.query(`SELECT value FROM setting WHERE "group" = 'seo' AND key = 'global_config' AND deleted_at IS NULL LIMIT 1`);
  console.log('Setting check rows:', settingCheck.rows.length);

  // 2. cms_page query
  const pages = await pool.query(`
    SELECT id, slug, title, type, status, meta_title, meta_description,
           canonical_url, og_image, created_at, updated_at
    FROM cms_page
    WHERE deleted_at IS NULL
    ORDER BY updated_at DESC
    LIMIT 3
  `);
  console.log('CMS pages retrieved:', pages.rows.length);

  // 3. cms_redirect query
  const redirs = await pool.query(`SELECT * FROM cms_redirect WHERE deleted_at IS NULL`);
  console.log('CMS redirects count:', redirs.rows.length);

  // 4. Dashboard stats query
  const [pStats, rStats, prodStats] = await Promise.all([
    pool.query(`
      SELECT
        COUNT(*) AS total,
        COUNT(CASE WHEN meta_title IS NOT NULL AND meta_title != '' THEN 1 END) AS with_meta,
        COUNT(CASE WHEN meta_title IS NULL OR meta_title = '' THEN 1 END) AS without_meta,
        COUNT(CASE WHEN canonical_url IS NOT NULL AND canonical_url != '' THEN 1 END) AS with_canonical
      FROM cms_page WHERE deleted_at IS NULL
    `),
    pool.query(`
      SELECT
        COUNT(*) AS total,
        COUNT(CASE WHEN is_active = true THEN 1 END) AS active
      FROM cms_redirect WHERE deleted_at IS NULL
    `),
    pool.query(`SELECT COUNT(*) AS total FROM product WHERE deleted_at IS NULL`)
  ]);

  console.log('Stats:');
  console.log('  Pages:', pStats.rows[0]);
  console.log('  Redirects:', rStats.rows[0]);
  console.log('  Products:', prodStats.rows[0]);

  await pool.end();
  console.log('ALL QUERIES PASSED!');
}

run().catch(console.error);
