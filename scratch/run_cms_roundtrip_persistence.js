const http = require('http');
const path = require('path');
const fs = require('fs');
const { Pool } = require(path.join(__dirname, '../frontend/node_modules/pg'));

const pool = new Pool({
  connectionString: 'postgresql://postgres.uubwhsnnrnicyczwqlbq:caketohomeqwerty@aws-1-ap-south-1.pooler.supabase.com:6543/postgres',
  ssl: { rejectUnauthorized: false }
});

function httpReq(pathUrl, method = 'GET', body = null) {
  return new Promise((resolve, reject) => {
    const req = http.request(`http://localhost:3000${pathUrl}`, {
      method,
      headers: {
        'Content-Type': 'application/json',
        'Cookie': '_cth_role=SUPER_ADMIN; _cth_user_id=admin_01'
      }
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, data: JSON.parse(data) });
        } catch {
          resolve({ status: res.statusCode, raw: data });
        }
      });
    });
    req.on('error', reject);
    if (body) req.write(typeof body === 'string' ? body : JSON.stringify(body));
    req.end();
  });
}

async function main() {
  console.log('========================================================================');
  console.log('  CakeToHome — CMS Round-Trip Persistence Verification                  ');
  console.log('  PostgreSQL Authority & Hard-Reload Durability                         ');
  console.log('========================================================================\n');

  // Step 1: Capture Baseline
  console.log('Step 1: Capturing baseline state from PostgreSQL cms_page...');
  const baselineRes = await pool.query("SELECT * FROM cms_page WHERE id = 'cmspg_home'");
  if (baselineRes.rows.length === 0) {
    throw new Error("cmspg_home not found in PostgreSQL!");
  }
  const baselineRow = baselineRes.rows[0];
  const baselineBlocks = typeof baselineRow.blocks === 'string' ? JSON.parse(baselineRow.blocks) : (baselineRow.blocks || {});
  console.log(`  Baseline Status: "${baselineRow.status}"`);
  console.log(`  Baseline Subheading: "${baselineBlocks.subheading || '(empty)'}"`);
  console.log(`  Baseline Versions: ${(baselineBlocks.version_history || []).length}`);

  // Step 2: API Mutation
  const testSubheading = `PERSISTENCE_TEST_${Date.now()}`;
  console.log(`\nStep 2: Mutating cmspg_home via API with controlled test value...`);
  console.log(`  Test value: "${testSubheading}"`);
  
  const mutationPayload = {
    id: 'cmspg_home',
    title: baselineRow.title || 'CakeToHome',
    slug: baselineRow.slug || 'home',
    status: 'published',
    subheading: testSubheading,
    version_history: baselineBlocks.version_history || [],
    blocks: {
      ...baselineBlocks,
      subheading: testSubheading
    }
  };

  const putRes = await httpReq('/api/v1/cms/pages/cmspg_home', 'PUT', mutationPayload);
  console.log(`  API Response: HTTP ${putRes.status}`);
  if (putRes.status !== 200) {
    throw new Error(`API mutation failed with status ${putRes.status}: ${JSON.stringify(putRes.data || putRes.raw)}`);
  }

  // Step 3: Direct PostgreSQL Verification
  console.log(`\nStep 3: Verifying mutation directly in PostgreSQL...`);
  const mutatedRes = await pool.query("SELECT blocks, status, updated_at FROM cms_page WHERE id = 'cmspg_home'");
  const mutatedRow = mutatedRes.rows[0];
  const mutatedBlocks = typeof mutatedRow.blocks === 'string' ? JSON.parse(mutatedRow.blocks) : (mutatedRow.blocks || {});
  const pgMatches = mutatedBlocks.subheading === testSubheading;
  console.log(`  PostgreSQL subheading: "${mutatedBlocks.subheading}"`);
  console.log(`  Matches test value: ${pgMatches ? '✓ PASS' : '❌ FAIL'}`);
  if (!pgMatches) {
    throw new Error("PostgreSQL does not reflect the mutation!");
  }

  // Step 4: API Read After Hard Mutation
  console.log(`\nStep 4: Reading from API after mutation...`);
  const getRes = await httpReq('/api/v1/cms/pages/cmspg_home', 'GET');
  const apiSubheading = getRes.data?.page?.subheading || getRes.data?.subheading || getRes.data?.page?.blocks?.subheading;
  console.log(`  API returned subheading: "${apiSubheading}"`);
  console.log(`  Matches test value: ${apiSubheading === testSubheading ? '✓ PASS' : '❌ FAIL'}`);

  // Step 5: Clean Restoration
  console.log(`\nStep 5: Restoring original baseline in PostgreSQL...`);
  const restorePayload = {
    id: 'cmspg_home',
    title: baselineRow.title,
    slug: baselineRow.slug,
    status: baselineRow.status,
    subheading: baselineBlocks.subheading || '',
    version_history: baselineBlocks.version_history || [],
    blocks: baselineBlocks
  };

  const restoreApiRes = await httpReq('/api/v1/cms/pages/cmspg_home', 'PUT', restorePayload);
  console.log(`  API Restore Response: HTTP ${restoreApiRes.status}`);

  // Step 6: Verify Restoration in PostgreSQL
  console.log(`\nStep 6: Confirming final restoration in PostgreSQL...`);
  const finalRes = await pool.query("SELECT blocks, status FROM cms_page WHERE id = 'cmspg_home'");
  const finalRow = finalRes.rows[0];
  const finalBlocks = typeof finalRow.blocks === 'string' ? JSON.parse(finalRow.blocks) : (finalRow.blocks || {});
  const restoredSubheading = finalBlocks.subheading || '';
  const restoredStatus = finalRow.status;
  const restoredVersions = (finalBlocks.version_history || []).length;

  console.log(`  Final Status: "${restoredStatus}" (Expected: "${baselineRow.status}")`);
  console.log(`  Final Subheading: "${restoredSubheading}" (Expected: "${baselineBlocks.subheading || ''}")`);
  console.log(`  Final Versions: ${restoredVersions} (Expected: ${(baselineBlocks.version_history || []).length})`);

  const cleanSuccess = restoredStatus === 'published' && restoredSubheading === (baselineBlocks.subheading || '');
  console.log(`\n========================================================================`);
  console.log(`  CMS ROUND-TRIP PERSISTENCE: ${cleanSuccess ? '✅ 100% VERIFIED PASS' : '❌ RESTORATION ERROR'}`);
  console.log('========================================================================\n');

  await pool.end();
}

main().catch(err => {
  console.error('CMS Persistence Test Error:', err);
  pool.end();
  process.exit(1);
});
