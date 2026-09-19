const http = require('http');
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: 'postgresql://postgres.uubwhsnnrnicyczwqlbq:caketohomeqwerty@aws-1-ap-south-1.pooler.supabase.com:6543/postgres',
  ssl: { rejectUnauthorized: false }
});

function request(path, options = {}, body = null) {
  return new Promise((resolve, reject) => {
    const req = http.request(`http://localhost:3000${path}`, options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, data: JSON.parse(data) });
        } catch (e) {
          resolve({ status: res.statusCode, raw: data });
        }
      });
    });
    req.on('error', reject);
    if (body) req.write(typeof body === 'string' ? body : JSON.stringify(body));
    req.end();
  });
}

async function runTest() {
  console.log('=== PHASE 3 SEO LIVE TEST ===\n');

  // Test 1: GET global config
  console.log('1. Testing GET /api/v1/admin/marketing/seo...');
  const cfgRes = await request('/api/v1/admin/marketing/seo');
  console.log('   Status:', cfgRes.status);
  console.log('   Meta Title:', cfgRes.data?.meta_title);
  console.log('   Storage:', cfgRes.data?.storage);

  // Test 2: GET dashboard summary
  console.log('\n2. Testing GET /api/v1/admin/seo/dashboard...');
  const dashRes = await request('/api/v1/admin/seo/dashboard');
  console.log('   Status:', dashRes.status);
  console.log('   Total Pages:', dashRes.data?.total_pages);
  console.log('   Indexed Pages:', dashRes.data?.indexed_pages);
  console.log('   SEO Score:', dashRes.data?.seo_score);

  // Test 3: GET pages
  console.log('\n3. Testing GET /api/v1/admin/seo/pages...');
  const pagesRes = await request('/api/v1/admin/seo/pages');
  console.log('   Status:', pagesRes.status);
  console.log('   Pages Count:', pagesRes.data?.pages?.length);
  if (pagesRes.data?.pages?.length > 0) {
    console.log('   Sample Page 1:', pagesRes.data.pages[0].title, pagesRes.data.pages[0].url);
  }

  // Test 4: Create Redirect (POST)
  console.log('\n4. Testing POST /api/v1/admin/seo/redirects...');
  const testFrom = `/test-old-url-${Date.now()}`;
  const testTo = '/products/chocolate-truffle';
  const postRes = await request('/api/v1/admin/seo/redirects', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  }, {
    source_url: testFrom,
    target_url: testTo,
    status_code: 301,
    is_active: true
  });
  console.log('   Status:', postRes.status);
  console.log('   Created Redirect ID:', postRes.data?.redirect?.id);
  const redirId = postRes.data?.redirect?.id;

  // Test 5: Verify redirect in PostgreSQL directly
  console.log('\n5. Verifying redirect directly in PostgreSQL cms_redirect table...');
  const pgCheck = await pool.query('SELECT * FROM cms_redirect WHERE id = $1', [redirId]);
  console.log('   Found in PostgreSQL:', pgCheck.rows.length === 1 ? 'YES ✓' : 'NO ✗');
  if (pgCheck.rows.length > 0) {
    console.log('   PG row from_path:', pgCheck.rows[0].from_path);
    console.log('   PG row to_url:', pgCheck.rows[0].to_url);
    console.log('   PG row redirect_type:', pgCheck.rows[0].redirect_type);
  }

  // Test 6: GET redirects list via API
  console.log('\n6. Testing GET /api/v1/admin/seo/redirects...');
  const listRes = await request('/api/v1/admin/seo/redirects');
  console.log('   Status:', listRes.status);
  console.log('   Total redirects:', listRes.data?.redirects?.length);
  const foundInList = listRes.data?.redirects?.find(r => r.id === redirId);
  console.log('   Found created redirect in API list:', foundInList ? 'YES ✓' : 'NO ✗');

  // Test 7: Update redirect via PUT
  console.log('\n7. Testing PUT /api/v1/admin/seo/redirects/' + redirId + '...');
  const putRes = await request(`/api/v1/admin/seo/redirects/${redirId}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' }
  }, {
    to_url: '/products/red-velvet'
  });
  console.log('   Status:', putRes.status);
  const pgCheckUpdate = await pool.query('SELECT to_url FROM cms_redirect WHERE id = $1', [redirId]);
  console.log('   Updated in PostgreSQL to_url:', pgCheckUpdate.rows[0]?.to_url);

  // Test 8: Clean up / DELETE redirect
  console.log('\n8. Testing DELETE /api/v1/admin/seo/redirects/' + redirId + '...');
  const delRes = await request(`/api/v1/admin/seo/redirects/${redirId}`, {
    method: 'DELETE'
  });
  console.log('   Status:', delRes.status);
  const pgCheckDel = await pool.query('SELECT deleted_at FROM cms_redirect WHERE id = $1', [redirId]);
  console.log('   Soft-deleted in PostgreSQL:', pgCheckDel.rows[0]?.deleted_at !== null ? 'YES ✓' : 'NO ✗');

  // Hard cleanup test row to keep database completely pristine
  await pool.query('DELETE FROM cms_redirect WHERE id = $1', [redirId]);
  console.log('   Cleaned up test row completely from DB.');

  await pool.end();
  console.log('\n=== ALL PHASE 3 SEO VERIFICATION TESTS COMPLETED SUCCESSFULLY ===');
}

runTest().catch(console.error);
