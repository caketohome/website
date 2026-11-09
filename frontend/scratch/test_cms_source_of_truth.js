/**
 * Targeted Verification Suite: CMS / Page Builder PostgreSQL Source of Truth
 * Strictly isolated, timeout-guarded, cleanly torn down with zero residual records.
 */

const fs = require('fs');
const path = require('path');
const { Client } = require('pg');
const Module = require('module');

const OVERALL_TIMEOUT_MS = 30000;
let client = null;

const timer = setTimeout(async () => {
  console.error(`[TIMEOUT] test_cms_source_of_truth exceeded ${OVERALL_TIMEOUT_MS}ms`);
  if (client) {
    try { await client.end(); } catch {}
  }
  process.exit(1);
}, OVERALL_TIMEOUT_MS);
if (timer.unref) timer.unref();

function getDbUrl() {
  const envPath = path.join(__dirname, '../.env');
  const lines = fs.readFileSync(envPath, 'utf8').split('\n');
  for (const l of lines) {
    if (l.trim().startsWith('DATABASE_URL=')) {
      return l.trim().substring('DATABASE_URL='.length).trim().replace(/['"]/g, '');
    }
  }
  throw new Error('DATABASE_URL not found');
}

const dbUrl = getDbUrl();
process.env.DATABASE_URL = dbUrl;

// Module Alias Resolution for @frontend/
const originalResolveFilename = Module._resolveFilename;
Module._resolveFilename = function (request, parent, isMain, options) {
  if (request.startsWith('@frontend/')) {
    const sub = request.substring('@frontend/'.length);
    const mapped = path.resolve(__dirname, '../src', sub);
    return originalResolveFilename.call(this, mapped, parent, isMain, options);
  }
  return originalResolveFilename.call(this, request, parent, isMain, options);
};

// Register TypeScript compilation hook
const ts = require('../node_modules/typescript');
require.extensions['.ts'] = function (module, filename) {
  const content = fs.readFileSync(filename, 'utf8');
  const compiled = ts.transpileModule(content, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
      esModuleInterop: true,
    },
  });
  return module._compile(compiled.outputText, filename);
};

async function main() {
  client = new Client({ connectionString: dbUrl, ssl: { rejectUnauthorized: false } });
  await client.connect();

  let passed = 0;
  let failed = 0;
  function assert(condition, desc) {
    if (condition) {
      console.log(`  [PASS] ${desc}`);
      passed++;
    } else {
      console.error(`  [FAIL] ${desc}`);
      failed++;
    }
  }

  console.log('\n======================================================');
  console.log('CMS & PAGE BUILDER POSTGRESQL SOURCE OF TRUTH SUITE');
  console.log('======================================================\n');

  const testPageId = `test_pg_${Date.now()}`;
  const testSlug = `test-page-${Date.now()}`;

  try {
    // 1. Verify CmsRepository directly against PostgreSQL
    const { CmsRepository } = require('../src/lib/repositories/cms.repository');

    // Test A: Create Draft Page
    console.log('1. Testing Page Creation in PostgreSQL:');
    const created = await CmsRepository.savePage({
      id: testPageId,
      slug: testSlug,
      title: 'E2E Source of Truth Test Page',
      type: 'landing',
      status: 'draft',
      meta_title: 'Test SEO Title',
      meta_description: 'Test SEO Description',
      sections: [
        { id: 'sec_1', type: 'hero', name: 'Hero Banner', order: 1, enabled: true },
        { id: 'sec_2', type: 'products_grid', name: 'Product Grid', order: 2, enabled: true },
      ],
      draft_config: { banners: [{ id: 'ban_1', title: 'Summer Cake Fest' }] },
    });
    assert(created.id === testPageId, 'Page created with correct ID');
    assert(created.status === 'draft', 'Page status is draft');
    assert(created.sections.length === 2, 'Page sections persisted (length 2)');

    // Verify row directly in PostgreSQL
    const dbRow = await client.query('SELECT * FROM cms_page WHERE id = $1', [testPageId]);
    assert(dbRow.rows.length === 1, 'PostgreSQL cms_page contains exactly 1 row');
    assert(dbRow.rows[0].slug === testSlug, 'PostgreSQL slug matches');

    // Test B: Publish Page
    console.log('\n2. Testing Page Publication and Revision Snapshot:');
    const pubRes = await CmsRepository.publishPage(testPageId);
    assert(pubRes.success === true, 'Publication succeeded');
    assert(pubRes.page.status === 'published', 'Page status updated to published');
    assert(pubRes.page.published_config !== null, 'Published config generated');

    // Verify revision row in relational cms_revision table
    const revRows = await client.query('SELECT * FROM cms_revision WHERE page_id = $1', [testPageId]);
    assert(revRows.rows.length >= 1, `PostgreSQL cms_revision contains ${revRows.rows.length} revision(s)`);

    // Test C: Reorder Sections
    console.log('\n3. Testing Atomic Section Reordering:');
    const reorderRes = await CmsRepository.reorderSections(testPageId, ['sec_2', 'sec_1']);
    assert(reorderRes.success === true, 'Reorder succeeded');
    assert(reorderRes.page.sections[0].id === 'sec_2', 'First section is now sec_2');
    assert(reorderRes.page.sections[1].id === 'sec_1', 'Second section is now sec_1');

    // Test D: Duplicate Page
    console.log('\n4. Testing Page Duplication in PostgreSQL:');
    const dupPage = await CmsRepository.duplicatePage(testPageId);
    assert(dupPage !== null, 'Duplicated page returned');
    assert(dupPage.id !== testPageId, 'Duplicate has unique ID');
    assert(dupPage.slug.includes('-copy'), 'Duplicate slug has copy suffix');
    assert(dupPage.status === 'draft', 'Duplicate created as draft');

    // Verify duplicate in PostgreSQL
    const dupRow = await client.query('SELECT * FROM cms_page WHERE id = $1', [dupPage.id]);
    assert(dupRow.rows.length === 1, 'Duplicate row confirmed in PostgreSQL');

    // Clean up duplicate immediately
    await CmsRepository.deletePage(dupPage.id);
    const dupAfter = await client.query('SELECT * FROM cms_page WHERE id = $1', [dupPage.id]);
    assert(dupAfter.rows.length === 0, 'Duplicate cleanly deleted from PostgreSQL');

    // Test E: Rollback Page
    console.log('\n5. Testing Revision Rollback:');
    const rolledBack = await CmsRepository.rollbackPage(testPageId, 1);
    assert(rolledBack !== null, 'Rollback returned restored page');
    assert(rolledBack.status === 'published', 'Rolled back page is published');

    // Test F: Blocks and Content retrieval from PostgreSQL
    console.log('\n6. Testing CMS Blocks Retrieval from PostgreSQL:');
    const blocks = await CmsRepository.findAllBlocks();
    assert(Array.isArray(blocks) && blocks.length > 0, `Found ${blocks.length} CMS blocks in PostgreSQL`);

  } finally {
    // Teardown test fixtures
    console.log('\n--- Teardown Test Fixtures ---');
    await client.query('DELETE FROM cms_revision WHERE page_id = $1', [testPageId]);
    await client.query('DELETE FROM cms_page WHERE id = $1', [testPageId]);
    const remaining = await client.query('SELECT count(*) FROM cms_page WHERE id = $1', [testPageId]);
    assert(Number(remaining.rows[0].count) === 0, 'Zero residual test page rows in PostgreSQL');
    await client.end();
    if (globalThis.__cth_pg_pool__) {
      try { await globalThis.__cth_pg_pool__.end(); } catch {}
    }
  }

  console.log('\n======================================================');
  console.log(`TEST SUMMARY: ${passed} PASSED | ${failed} FAILED`);
  console.log('======================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

main().catch(err => {
  console.error('[UNCAUGHT EXCEPTION]', err);
  process.exit(1);
});
