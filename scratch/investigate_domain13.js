const { Pool } = require('pg');
const pool = new Pool({
  connectionString: 'postgresql://postgres.uubwhsnnrnicyczwqlbq:caketohomeqwerty@aws-1-ap-south-1.pooler.supabase.com:6543/postgres',
  ssl: { rejectUnauthorized: false }
});

async function main() {
  const res = await pool.query("SELECT id, status, blocks FROM cms_page WHERE id = 'cmspg_home'");
  const row = res.rows[0];
  const blocks = typeof row.blocks === 'string' ? JSON.parse(row.blocks) : row.blocks;

  console.log('=== Domain 13 Investigation ===');
  console.log('page id:', row.id);
  console.log('status:', row.status);
  console.log('version_history type:', typeof blocks.version_history);
  console.log('version_history isArray:', Array.isArray(blocks.version_history));
  console.log('version_history length:', (blocks.version_history || []).length);
  console.log('version_history value:', JSON.stringify(blocks.version_history));

  // The test at line 190 says: const passed = isPublished;
  // isPublished = row.status === 'published'
  // But the result JSON shows passed=false, dbCount=0, apiCount=0
  // This means row.status !== 'published' at the time the test ran.
  //
  // BUT our baseline capture showed status='published'.
  // The CMS persistence test mutated the page and restored it.
  // Let's check if the restore set status correctly.

  console.log('\n=== Test Logic Analysis ===');
  const isPublished = row.status === 'published';
  const hasHistory = Array.isArray(blocks.version_history) && blocks.version_history.length > 0;
  console.log('isPublished:', isPublished);
  console.log('hasHistory:', hasHistory);
  console.log('test passed would be:', isPublished);

  await pool.end();
}

main().catch(e => { console.error(e); process.exit(1); });
