/**
 * Phase D.2/D.3/D.5 — CMS Persistence Mutation Test
 * 
 * D.2: Mutate the home page subheading via the API
 * D.3: Verify the mutation persisted in PostgreSQL
 * D.5: Restore the original baseline
 */
const TEST_SUBHEADING = `PERSISTENCE_TEST_${Date.now()}`;

async function mutateViaApi(subheading) {
  console.log(`\n=== D.2: Mutating subheading via API ===`);
  console.log(`  New value: "${subheading}"`);
  
  const res = await fetch('http://localhost:3000/api/v1/cms/pages/cmspg_home', {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      'Cookie': '_cth_role=SUPER_ADMIN; _cth_user_id=admin_01'
    },
    body: JSON.stringify({
      id: 'cmspg_home',
      subheading: subheading
    })
  });
  
  console.log(`  API Response: HTTP ${res.status}`);
  const body = await res.json().catch(() => null);
  if (body && body.page) {
    console.log(`  Returned subheading: "${body.page.subheading || '(empty)'}"`);
  } else if (body && body.error) {
    console.log(`  ERROR: ${body.error}`);
  } else {
    console.log(`  Response body:`, JSON.stringify(body).slice(0, 200));
  }
  return res.status;
}

async function verifyInPostgres(expectedSubheading) {
  console.log(`\n=== D.3: Verifying in PostgreSQL ===`);
  
  const { Pool } = require('pg');
  const pool = new Pool({
    connectionString: 'postgresql://postgres.uubwhsnnrnicyczwqlbq:caketohomeqwerty@aws-1-ap-south-1.pooler.supabase.com:6543/postgres',
    ssl: { rejectUnauthorized: false }
  });
  
  try {
    const res = await pool.query(
      `SELECT blocks, updated_at FROM "cms_page" WHERE id = 'cmspg_home' LIMIT 1`
    );
    const page = res.rows[0];
    let blocks = {};
    try {
      blocks = typeof page.blocks === 'string' ? JSON.parse(page.blocks) : page.blocks;
    } catch {}
    
    const actualSubheading = blocks.subheading || '';
    const match = actualSubheading === expectedSubheading;
    
    console.log(`  Expected: "${expectedSubheading}"`);
    console.log(`  Actual:   "${actualSubheading}"`);
    console.log(`  Match:    ${match ? '✓ PASS' : '✗ FAIL'}`);
    console.log(`  updated_at: ${page.updated_at}`);
    
    return match;
  } finally {
    await pool.end();
  }
}

async function verifyOnStorefront() {
  console.log(`\n=== D.4: Verifying on storefront after hard reload ===`);
  
  const res = await fetch('http://localhost:3000/', {
    headers: { 'Cache-Control': 'no-cache' }
  });
  const html = await res.text();
  console.log(`  Storefront HTTP: ${res.status}`);
  console.log(`  HTML length: ${html.length}`);
  
  // Also check the API endpoint directly
  const apiRes = await fetch('http://localhost:3000/api/v1/cms/pages/cmspg_home');
  const apiBody = await apiRes.json().catch(() => null);
  if (apiBody && apiBody.page) {
    console.log(`  API subheading: "${apiBody.page.subheading || '(empty)'}"`);
  }
  
  return true;
}

async function main() {
  const mode = process.argv[2] || 'full';
  const fs = require('fs');
  const path = require('path');
  
  // Load baseline
  let baseline = {};
  try {
    baseline = JSON.parse(fs.readFileSync(path.join(__dirname, 'cms_baseline_snapshot.json'), 'utf-8'));
  } catch {
    console.log('WARNING: No baseline snapshot found. Run cms_persistence_check.js baseline first.');
  }
  
  const originalSubheading = baseline.subheading || 'Fresh Artisan Patisserie Delivered Daily [Verified 02:34:04]';
  
  if (mode === 'full' || mode === 'mutate') {
    // D.2: Mutate
    const status = await mutateViaApi(TEST_SUBHEADING);
    if (status !== 200) {
      console.log('\n✗ MUTATION FAILED — skipping remaining steps');
      process.exit(1);
    }
    
    // Small delay for write to propagate
    await new Promise(r => setTimeout(r, 1000));
    
    // D.3: Verify in PostgreSQL
    const persisted = await verifyInPostgres(TEST_SUBHEADING);
    if (!persisted) {
      console.log('\n✗ PERSISTENCE FAILED — data not written to PostgreSQL');
      process.exit(1);
    }
    
    // D.4: Verify on storefront
    await verifyOnStorefront();
    
    // D.5: Restore baseline
    console.log(`\n=== D.5: Restoring original subheading ===`);
    const restoreStatus = await mutateViaApi(originalSubheading);
    if (restoreStatus === 200) {
      // Verify restore
      await new Promise(r => setTimeout(r, 500));
      const restored = await verifyInPostgres(originalSubheading);
      console.log(`\n=== FINAL RESULT ===`);
      console.log(`  Mutation:    ✓ PASS`);
      console.log(`  Persistence: ✓ PASS`);
      console.log(`  Restoration: ${restored ? '✓ PASS' : '✗ FAIL'}`);
    } else {
      console.log(`\n✗ RESTORE FAILED — manual intervention needed`);
      console.log(`  Original value: "${originalSubheading}"`);
    }
  }
  
  if (mode === 'restore') {
    await mutateViaApi(originalSubheading);
    await new Promise(r => setTimeout(r, 500));
    await verifyInPostgres(originalSubheading);
  }
}

main().catch(err => { console.error(err); process.exit(1); });
