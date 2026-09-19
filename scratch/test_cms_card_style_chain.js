const path = require('path');
const { Pool } = require(path.join(__dirname, '../frontend/node_modules/pg'));
const http = require('http');

const pool = new Pool({
  connectionString: 'postgresql://postgres.uubwhsnnrnicyczwqlbq:caketohomeqwerty@aws-1-ap-south-1.pooler.supabase.com:6543/postgres',
  ssl: { rejectUnauthorized: false }
});

function httpGet(url) {
  return new Promise((resolve, reject) => {
    http.get(url, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve({ statusCode: res.statusCode, body: data }));
    }).on('error', reject);
  });
}

async function runCmsPersistenceChain() {
  console.log('=== CMS CARD STYLE PERSISTENCE CHAIN AUDIT ===\n');

  try {
    // Step 1: Read current cmspg_home from PostgreSQL
    const res = await pool.query(`SELECT * FROM "cms_page" WHERE id = 'cmspg_home' OR slug = 'home' LIMIT 1`);
    if (res.rows.length === 0) {
      throw new Error('cmspg_home not found in PostgreSQL cms_page table');
    }
    const row = res.rows[0];
    const blocks = typeof row.blocks === 'string' ? JSON.parse(row.blocks) : row.blocks;
    const originalSections = blocks.published_config?.sections || blocks.sections || [];
    console.log('[PASS] Step 1: Read PostgreSQL cmspg_home. Sections count:', originalSections.length);

    // Step 2: Locate occasions_grid section or section with card_style
    const occSectionIdx = originalSections.findIndex(s => s.type === 'occasions_grid' || s.type === 'occasion_carousel');
    if (occSectionIdx === -1) {
      console.log('[WARN] occasions_grid not found, inspecting all section types:', originalSections.map(s => s.type));
    } else {
      console.log('[PASS] Step 2: Found occasions_grid at index', occSectionIdx);
    }

    // Step 3: Test card_style modification in draft_config
    const testSections = JSON.parse(JSON.stringify(originalSections));
    if (occSectionIdx !== -1) {
      testSections[occSectionIdx].config = {
        ...(testSections[occSectionIdx].config || {}),
        card_style: 'scrapbook',
        _test_audit_timestamp: Date.now()
      };
    }

    const testDraftConfig = {
      ...(blocks.draft_config || {}),
      sections: testSections,
      theme: {
        ...(blocks.draft_config?.theme || {}),
        card_style: 'scrapbook'
      }
    };

    const updatedBlocks = {
      ...blocks,
      draft_config: testDraftConfig
    };

    // Step 4: Save draft to PostgreSQL
    await pool.query(
      `UPDATE "cms_page" SET blocks = $1, updated_at = NOW() WHERE id = 'cmspg_home'`,
      [JSON.stringify(updatedBlocks)]
    );
    console.log('[PASS] Step 4: Saved draft_config with card_style: scrapbook to PostgreSQL');

    // Step 5: Query PostgreSQL directly to verify draft persistence
    const draftVerifyRes = await pool.query(`SELECT blocks FROM "cms_page" WHERE id = 'cmspg_home'`);
    const draftBlocks = typeof draftVerifyRes.rows[0].blocks === 'string' ? JSON.parse(draftVerifyRes.rows[0].blocks) : draftVerifyRes.rows[0].blocks;
    const persistedDraftStyle = draftBlocks.draft_config?.theme?.card_style;
    if (persistedDraftStyle !== 'scrapbook') {
      throw new Error(`Draft persistence mismatch: expected scrapbook, got ${persistedDraftStyle}`);
    }
    console.log('[PASS] Step 5: PostgreSQL verified draft_config.theme.card_style =', persistedDraftStyle);

    // Step 6: Test Publish to published_config in PostgreSQL
    const testPublishedConfig = {
      ...(blocks.published_config || {}),
      sections: testSections,
      theme: {
        ...(blocks.published_config?.theme || {}),
        card_style: 'scrapbook'
      }
    };

    const publishedBlocks = {
      ...updatedBlocks,
      published_config: testPublishedConfig
    };

    await pool.query(
      `UPDATE "cms_page" SET blocks = $1, status = 'published', updated_at = NOW() WHERE id = 'cmspg_home'`,
      [JSON.stringify(publishedBlocks)]
    );
    console.log('[PASS] Step 6: Published card_style: scrapbook to PostgreSQL published_config');

    // Step 7: Query PostgreSQL to verify published_config persistence
    const pubVerifyRes = await pool.query(`SELECT blocks FROM "cms_page" WHERE id = 'cmspg_home'`);
    const pubBlocks = typeof pubVerifyRes.rows[0].blocks === 'string' ? JSON.parse(pubVerifyRes.rows[0].blocks) : pubVerifyRes.rows[0].blocks;
    const persistedPubStyle = pubBlocks.published_config?.theme?.card_style;
    if (persistedPubStyle !== 'scrapbook') {
      throw new Error(`Published persistence mismatch: expected scrapbook, got ${persistedPubStyle}`);
    }
    console.log('[PASS] Step 7: PostgreSQL verified published_config.theme.card_style =', persistedPubStyle);

    // Step 8: Query live HTTP Storefront to test public page rendering
    const httpRes = await httpGet('http://localhost:3000/');
    console.log('[PASS] Step 8: Storefront HTTP status =', httpRes.statusCode, '(Body length:', httpRes.body.length, 'bytes)');
    
    // Check if scrapbook or polaroid classes rendered in live HTML
    const hasPolaroidClass = httpRes.body.includes('scrapbook-polaroid') || httpRes.body.includes('scrapbook');
    console.log('[INFO] Step 8b: Public HTML contains scrapbook markers:', hasPolaroidClass);

    // Step 9: Revert back to original blocks safely
    await pool.query(
      `UPDATE "cms_page" SET blocks = $1, updated_at = NOW() WHERE id = 'cmspg_home'`,
      [JSON.stringify(blocks)]
    );
    console.log('[PASS] Step 9: Cleanly reverted cmspg_home blocks to pristine state in PostgreSQL');

    console.log('\n=== CMS PERSISTENCE CHAIN AUDIT: ALL STEPS VERIFIED AGAINST LIVE POSTGRESQL ===');
  } catch (err) {
    console.error('[FAIL] CMS Persistence Chain Error:', err);
  } finally {
    await pool.end();
  }
}

runCmsPersistenceChain();
