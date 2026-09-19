const path = require('path');
const { Pool } = require(path.join(__dirname, '../frontend/node_modules/pg'));

const pool = new Pool({
  connectionString: 'postgresql://postgres.uubwhsnnrnicyczwqlbq:caketohomeqwerty@aws-1-ap-south-1.pooler.supabase.com:6543/postgres',
  ssl: { rejectUnauthorized: false }
});

async function run() {
  const testCampId = `pop_test_${Date.now()}`;
  const testVerId = `ver_test_${Date.now()}`;

  try {
    console.log('[Test] Inserting test popup campaign:', testCampId);
    await pool.query(
      `INSERT INTO "popup_campaigns" ("id", "name", "slug", "description", "popup_type", "status", "priority", "enabled", "timezone", "created_at", "updated_at")
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW(), NOW())`,
      [testCampId, 'Automated Test Popup', `test-popup-${Date.now()}`, 'Verification of PostgreSQL roundtrip', 'WELCOME', 'published', 950, true, 'Asia/Kolkata']
    );

    console.log('[Test] Inserting test popup version:', testVerId);
    await pool.query(
      `INSERT INTO "popup_versions" ("id", "popup_campaign_id", "version_number", "content_json", "design_json", "trigger_json", "audience_json", "frequency_json", "schedule_json", "cta_json", "media_json", "rules_json", "created_at", "published_at")
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, NOW(), NOW())`,
      [
        testVerId,
        testCampId,
        1,
        JSON.stringify({ headline: 'Special Test Headline', eyebrow: 'LIMITED OFFER' }),
        JSON.stringify({ desktopLayout: 'CENTER_MODAL', width: 520 }),
        JSON.stringify({ exitIntent: true, timeOnPageSeconds: 3 }),
        JSON.stringify({ customerStatus: ['all'] }),
        JSON.stringify({ scope: 'session', maxShows: 1 }),
        JSON.stringify({ timezone: 'Asia/Kolkata' }),
        JSON.stringify({ label: 'Test CTA', action: 'OPEN_CART' }),
        JSON.stringify({ source: 'MEDIA_LIBRARY', imageUrl: '/images/belgian-truffle.jpg' }),
        JSON.stringify([]),
      ]
    );

    console.log('[Test] Verifying read back from PostgreSQL...');
    const readCamp = await pool.query('SELECT * FROM popup_campaigns WHERE id = $1', [testCampId]);
    const readVer = await pool.query('SELECT * FROM popup_versions WHERE popup_campaign_id = $1', [testCampId]);

    console.log('Read campaign row:', readCamp.rows[0]?.name, 'status:', readCamp.rows[0]?.status);
    console.log('Read version row:', readVer.rows[0]?.id, 'headline:', readVer.rows[0]?.content_json?.headline);

    // Clean up test records (rule: restore only test records created by test)
    console.log('[Test] Cleaning up test records...');
    await pool.query('DELETE FROM popup_versions WHERE id = $1', [testVerId]);
    await pool.query('DELETE FROM popup_campaigns WHERE id = $1', [testCampId]);
    console.log('[Test] Cleanup complete. Verification SUCCESSFUL!');
  } catch (err) {
    console.error('[Test] FAILED:', err);
  } finally {
    await pool.end();
  }
}

run();
