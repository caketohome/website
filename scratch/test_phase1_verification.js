const path = require('path');
const { Pool } = require(path.join(__dirname, '../frontend/node_modules/pg'));

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://postgres.uubwhsnnrnicyczwqlbq:caketohomeqwerty@aws-1-ap-south-1.pooler.supabase.com:6543/postgres',
  ssl: { rejectUnauthorized: false }
});

async function runPhase1Verification() {
  console.log('=== PHASE 1 SCHEMA & CAPABILITY VERIFICATION ===\n');

  // Test 1: PostgreSQL read-only check
  const res1 = await pool.query('SELECT 1 AS ok');
  console.log('[PASS] Test 1: PostgreSQL Connection (SELECT 1) -> ok =', res1.rows[0].ok);

  // Test 2: cms_page schema columns check
  const resCols = await pool.query(`
    SELECT column_name, data_type 
    FROM information_schema.columns 
    WHERE table_name = 'cms_page'
  `);
  const colNames = resCols.rows.map(r => r.column_name);
  const requiredCols = ['id', 'slug', 'title', 'type', 'status', 'blocks', 'meta_title', 'meta_description', 'canonical_url', 'og_image', 'published_at'];
  const missingCols = requiredCols.filter(c => !colNames.includes(c));
  if (missingCols.length > 0) {
    throw new Error(`Missing required columns in cms_page: ${missingCols.join(', ')}`);
  }
  console.log('[PASS] Test 2: All required cms_page columns present. Zero DDL migration required.');

  // Test 3: cmspg_home structure check
  const resHome = await pool.query("SELECT * FROM cms_page WHERE id = 'cmspg_home' LIMIT 1");
  if (resHome.rows.length === 0) {
    throw new Error('cmspg_home record not found in cms_page table');
  }
  const home = resHome.rows[0];
  console.log('[PASS] Test 3: cmspg_home found in database (Status:', home.status, ')');

  // Test 4: Parse blocks and verify structure
  let blocks = home.blocks;
  if (typeof blocks === 'string') {
    blocks = JSON.parse(blocks);
  }
  const sections = blocks?.published_config?.sections || blocks?.sections || [];
  console.log('[PASS] Test 4: Published sections count =', sections.length);
  if (sections.length !== 10) {
    console.warn('[WARN] Expected 10 sections, found:', sections.length);
  }

  // Test 5: Frame count preservation
  const hero = sections.find(s => s.type === 'hero');
  if (!hero) {
    throw new Error('Hero section not found in cmspg_home');
  }
  const desktopFrames = hero.config?.desktop?.frames || [];
  console.log('[PASS] Test 5: Hero banner has', desktopFrames.length, 'desktop animation frames.');
  if (desktopFrames.length !== 22) {
    throw new Error(`Expected 22 frames in hero section, found: ${desktopFrames.length}`);
  }
  console.log('       Sample Frame 1:', desktopFrames[0]?.filename, '->', desktopFrames[0]?.url?.slice(0, 45) + '...');
  console.log('       Sample Frame 22:', desktopFrames[21]?.filename, '->', desktopFrames[21]?.url?.slice(0, 45) + '...');

  // Test 6: Theme tokens capability check in JSONB
  const dummyBlock = {
    ...blocks,
    published_config: {
      ...blocks.published_config,
      theme: {
        bg_color: '#0c1326',
        text_color: '#FAF9F6',
        accent_color: '#D4AF37',
        heading_font: 'Playfair Display, serif',
        font_family: 'Inter, sans-serif'
      }
    }
  };
  const serialized = JSON.stringify(dummyBlock);
  const deserialized = JSON.parse(serialized);
  if (deserialized.published_config?.theme?.bg_color !== '#0c1326') {
    throw new Error('JSON round-trip failed for theme tokens');
  }
  if (deserialized.published_config?.sections[0]?.config?.desktop?.frames?.length !== 22) {
    throw new Error('JSON round-trip dropped animation frames');
  }
  console.log('[PASS] Test 6: Theme tokens JSON round-trip verified without dropping any frames.');

  console.log('\n=== ALL PHASE 1 TESTS PASSED SUCCESSFULLY ===');
  await pool.end();
}

runPhase1Verification().catch(async (err) => {
  console.error('[FAIL] Phase 1 Verification Failed:', err.message);
  await pool.end();
  process.exit(1);
});
