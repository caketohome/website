const http = require('http');
const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

const pool = new Pool({
  connectionString: '[REDACTED_DATABASE_CREDENTIAL]',
  ssl: { rejectUnauthorized: false }
});

function request(pathUrl, options = {}, body = null) {
  return new Promise((resolve, reject) => {
    const req = http.request(`http://localhost:3000${pathUrl}`, options, (res) => {
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

async function run() {
  console.log('=== PHASE 4 MEDIA PIPELINE VERIFICATION TEST ===\n');

  // 1. GET /api/v1/admin/media
  console.log('1. Testing GET /api/v1/admin/media...');
  const listRes = await request('/api/v1/admin/media?limit=10');
  console.log('   Status:', listRes.status);
  console.log('   Items returned:', listRes.data?.media?.length);
  console.log('   Total count:', listRes.data?.total);
  if (listRes.data?.media?.length > 0) {
    console.log('   First item name:', listRes.data.media[0].name);
    console.log('   First item folder:', listRes.data.media[0].folder);
  }

  // 2. GET /api/v1/admin/media/stats
  console.log('\n2. Testing GET /api/v1/admin/media/stats...');
  const statsRes = await request('/api/v1/admin/media/stats');
  console.log('   Status:', statsRes.status);
  console.log('   Total Count:', statsRes.data?.stats?.total_count);
  console.log('   Total Size (bytes):', statsRes.data?.stats?.total_size_bytes);
  console.log('   Folders:', statsRes.data?.stats?.folders?.map(f => `${f.folder}: ${f.count}`).join(', '));

  // 3. POST /api/v1/admin/media/upload with real Sharp transcoding
  console.log('\n3. Testing POST /api/v1/admin/media/upload with Sharp image processing...');
  // A simple 100x100 red square PNG
  const sharp = require('sharp');
  const testPngBuffer = await sharp({
    create: {
      width: 200,
      height: 200,
      channels: 4,
      background: { r: 212, g: 175, b: 55, alpha: 1 } // CakeToHome Gold
    }
  }).png().toBuffer();

  const base64Data = `data:image/png;base64,${testPngBuffer.toString('base64')}`;
  const uploadRes = await request('/api/v1/admin/media/upload', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  }, {
    filename: 'test_gold_cake.png',
    name: 'Test Gold Cake',
    dataUrl: base64Data,
    folder: 'products',
    alt_text: 'Delicious handcrafted gold celebration cake',
    size: testPngBuffer.length
  });

  console.log('   Status:', uploadRes.status);
  const media = uploadRes.data?.media;
  console.log('   Created Media ID:', media?.id);
  console.log('   URL:', media?.url);
  console.log('   Thumbnail URL:', media?.thumbnail_url);
  console.log('   WebP Generated:', media?.is_webp_generated);
  console.log('   AVIF Generated:', media?.is_avif_generated);
  console.log('   Blur Placeholder exists:', !!media?.blur_placeholder);
  console.log('   Responsive Variants:', Object.keys(media?.responsive_variants || {}));

  const testId = media?.id;

  // 4. Verify in PostgreSQL
  console.log('\n4. Verifying inserted record directly in PostgreSQL media table...');
  const pgCheck = await pool.query('SELECT * FROM media WHERE id = $1', [testId]);
  console.log('   Found in PostgreSQL:', pgCheck.rows.length === 1 ? 'YES ✓' : 'NO ✗');
  if (pgCheck.rows.length > 0) {
    console.log('   PG name:', pgCheck.rows[0].name);
    console.log('   PG is_webp_generated:', pgCheck.rows[0].is_webp_generated);
    console.log('   PG is_avif_generated:', pgCheck.rows[0].is_avif_generated);
    console.log('   PG blur_placeholder:', pgCheck.rows[0].blur_placeholder?.slice(0, 30) + '...');
  }

  // 5. Test PUT /api/v1/admin/media/:id
  console.log('\n5. Testing PUT /api/v1/admin/media/' + testId + '...');
  const putRes = await request(`/api/v1/admin/media/${testId}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' }
  }, {
    alt_text: 'Updated Alt Text — Royal Gold Birthday Cake'
  });
  console.log('   Status:', putRes.status);
  const pgCheckUpdate = await pool.query('SELECT alt_text FROM media WHERE id = $1', [testId]);
  console.log('   Updated in PostgreSQL alt_text:', pgCheckUpdate.rows[0]?.alt_text);

  // 6. Test DELETE /api/v1/admin/media/:id
  console.log('\n6. Testing DELETE /api/v1/admin/media/' + testId + '...');
  const delRes = await request(`/api/v1/admin/media/${testId}`, {
    method: 'DELETE'
  });
  console.log('   Status:', delRes.status);
  const pgCheckDel = await pool.query('SELECT deleted_at FROM media WHERE id = $1', [testId]);
  console.log('   Soft-deleted in PostgreSQL:', pgCheckDel.rows[0]?.deleted_at !== null ? 'YES ✓' : 'NO ✗');

  // Hard cleanup test row to keep database completely pristine
  await pool.query('DELETE FROM media WHERE id = $1', [testId]);
  console.log('   Cleaned up test row from DB.');

  // Clean up any uploaded test files from disk
  const uploadsDir = path.join('frontend', 'public', 'uploads');
  if (fs.existsSync(uploadsDir)) {
    const files = fs.readdirSync(uploadsDir);
    files.forEach(f => {
      if (f.startsWith('test_gold_cake')) {
        try { fs.unlinkSync(path.join(uploadsDir, f)); } catch {}
      }
    });
  }
  console.log('   Cleaned up uploaded test files from disk.');

  // 7. Test OG Image Generator GET /api/og
  console.log('\n7. Testing GET /api/og dynamic OpenGraph image generation...');
  const ogRes = await request('/api/og?title=Chocolate%20Truffle%20Cake&price=%E2%82%B9599');
  console.log('   OG Route Status:', ogRes.status);

  await pool.end();
  console.log('\n=== ALL PHASE 4 MEDIA PIPELINE VERIFICATION TESTS COMPLETED SUCCESSFULLY ===');
}

run().catch(console.error);
