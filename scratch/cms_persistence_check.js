/**
 * Phase D — CMS Persistence Verification
 * Step D.1: Capture baseline from PostgreSQL
 * Step D.3: Verify mutation was written to PostgreSQL
 * Step D.5: Restore baseline
 */
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://postgres.uubwhsnnrnicyczwqlbq:caketohomeqwerty@aws-1-ap-south-1.pooler.supabase.com:6543/postgres',
  ssl: { rejectUnauthorized: false }
});

async function main() {
  const mode = process.argv[2] || 'baseline';
  
  try {
    // Query the home page
    const pageRes = await pool.query(
      `SELECT id, slug, title, status, blocks, updated_at FROM "cms_page" WHERE id = 'cmspg_home' LIMIT 1`
    );
    
    if (pageRes.rows.length === 0) {
      console.log('ERROR: cmspg_home not found in PostgreSQL');
      process.exit(1);
    }
    
    const page = pageRes.rows[0];
    let blocks = {};
    try {
      blocks = typeof page.blocks === 'string' ? JSON.parse(page.blocks) : page.blocks;
    } catch {}
    
    console.log(`=== CMS Page: ${page.id} ===`);
    console.log(`  slug: ${page.slug}`);
    console.log(`  title: ${page.title}`);
    console.log(`  status: ${page.status}`);
    console.log(`  updated_at: ${page.updated_at}`);
    console.log(`  subheading: ${blocks.subheading || '(empty)'}`);
    console.log(`  h1: ${blocks.h1 || '(empty)'}`);
    console.log(`  sections count: ${(blocks.sections || []).length}`);
    
    if (mode === 'baseline') {
      // Save baseline to file
      const fs = require('fs');
      fs.writeFileSync(
        require('path').join(__dirname, 'cms_baseline_snapshot.json'),
        JSON.stringify({
          timestamp: new Date().toISOString(),
          page_id: page.id,
          title: page.title,
          subheading: blocks.subheading || '',
          h1: blocks.h1 || '',
          updated_at: page.updated_at,
          sections_count: (blocks.sections || []).length,
          full_blocks: blocks
        }, null, 2)
      );
      console.log('\nBaseline saved to scratch/cms_baseline_snapshot.json');
    }
    
    // Also check homepage sections
    const secRes = await pool.query(
      `SELECT id, section_type, name, title, sort_order, is_active FROM "cms_homepage_section" 
       WHERE id LIKE 'sec_home_%' AND deleted_at IS NULL ORDER BY sort_order ASC LIMIT 10`
    );
    console.log(`\n=== Homepage Sections (${secRes.rows.length} active) ===`);
    secRes.rows.forEach((s, i) => {
      console.log(`  ${i+1}. [${s.id}] ${s.section_type} — "${s.name || s.title}" (order: ${s.sort_order}, active: ${s.is_active})`);
    });
    
  } finally {
    await pool.end();
  }
}

main().catch(err => { console.error(err); process.exit(1); });
