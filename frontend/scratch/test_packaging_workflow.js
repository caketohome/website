/**
 * CakeToHome ERP — Phase 4F Step 3C.2.2 Packaging Catalog Workflow Test Suite
 *
 * Covers all 12 Mandatory Verification Requirements:
 * 1. Authorized actor: PRODUCTS.CREATE → creation succeeds.
 * 2. Unauthorized actor: PRODUCTS.CREATE absent → 403.
 * 3. Unauthenticated: → 401.
 * 4. Caller attempts to supply another userId: → ignored/rejected.
 * 5. Caller attempts to supply another role: → ignored/rejected.
 * 6. merchandise_type: → PACKAGING.
 * 7. product + variant: → atomically created.
 * 8. duplicate SKU: → rejected.
 * 9. invalid required fields: → rejected.
 * 10. rollback: → zero persistent test products.
 * 11. branch_inventory: → unchanged (424).
 * 12. accounting: → unchanged (0 vouchers/journals/lots/movements).
 */

const fs = require('fs');
const path = require('path');
const { Client } = require('../node_modules/pg');

function getConnectionString() {
  if (process.env.PG_URL) return process.env.PG_URL;
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL;
  const envPath = path.join(__dirname, '../../backend/.env');
  const envContent = fs.readFileSync(envPath, 'utf8');
  for (const line of envContent.split('\n')) {
    if (line.startsWith('DATABASE_URL=')) return line.substring('DATABASE_URL='.length).trim();
  }
  throw new Error("No database connection string found");
}

async function runTestSuite() {
  console.log('=============================================================================');
  console.log('CakeToHome ERP — Phase 4F Step 3C.2.2 Packaging Catalog Workflow Test Suite');
  console.log('=============================================================================\n');

  // Register native typescript compiler hook for .ts imports
  const ts = require('../node_modules/typescript');
  require.extensions['.ts'] = function(module, filename) {
    const content = fs.readFileSync(filename, 'utf8');
    const compiled = ts.transpileModule(content, {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2020,
        esModuleInterop: true,
      }
    });
    return module._compile(compiled.outputText, filename);
  };

  process.env.DATABASE_URL = getConnectionString();

  const { StaffAccessControl, hasEffectivePermission } = require('../src/lib/staff-access-control');
  const { signAuthToken, resolveServerSession } = require('../src/lib/security/auth-session');
  const { ProductRepository } = require('../src/lib/repositories/product.repository');
  const { ProductService } = require('../src/lib/services/product.service');
  const { POST } = require('../src/app/api/v1/admin/catalog/packaging/route');

  const client = new Client({ connectionString: getConnectionString() });
  await client.connect();

  let passCount = 0;
  let failCount = 0;

  function assert(condition, message) {
    if (condition) {
      console.log(`  ✓ PASS: ${message}`);
      passCount++;
    } else {
      console.error(`  ✗ FAIL: ${message}`);
      failCount++;
    }
  }

  try {
    // -------------------------------------------------------------------------
    // Capture Baseline Counts
    // -------------------------------------------------------------------------
    console.log('[Phase 1] Capturing PostgreSQL Baseline State...');
    const bInvInitial = parseInt((await client.query('SELECT COUNT(*) FROM public.branch_inventory')).rows[0].count, 10);
    const prodInitial = parseInt((await client.query('SELECT COUNT(*) FROM public.product')).rows[0].count, 10);
    const varInitial = parseInt((await client.query('SELECT COUNT(*) FROM public.product_variant')).rows[0].count, 10);
    const pkgInitial = parseInt((await client.query("SELECT COUNT(*) FROM public.product WHERE merchandise_type = 'PACKAGING'")).rows[0].count, 10);
    const vchInitial = parseInt((await client.query('SELECT COUNT(*) FROM public.accounting_voucher')).rows[0].count, 10);
    const jnlInitial = parseInt((await client.query('SELECT COUNT(*) FROM public.accounting_journal_entry')).rows[0].count, 10);
    const lotInitial = parseInt((await client.query('SELECT COUNT(*) FROM public.inventory_cost_lot')).rows[0].count, 10);
    const movInitial = parseInt((await client.query('SELECT COUNT(*) FROM public.inventory_movement')).rows[0].count, 10);

    assert(bInvInitial === 424, `Initial branch_inventory is 424 (found ${bInvInitial})`);
    assert(pkgInitial === 0, `Initial packaging product count is 0 (found ${pkgInitial})`);
    assert(vchInitial === 0, `Initial accounting vouchers is 0 (found ${vchInitial})`);
    assert(lotInitial === 0, `Initial inventory cost lots is 0 (found ${lotInitial})`);
    assert(movInitial === 0, `Initial inventory movements is 0 (found ${movInitial})`);

    // -------------------------------------------------------------------------
    // TEST 1, 2, 3: AUTHENTICATION & AUTHORIZATION RBAC CHECKS
    // -------------------------------------------------------------------------
    console.log('\n[Phase 2] Testing Authentication & RBAC Authorization...');

    // Token for authorized catalog admin (usr_amit_catalog -> prof_catalog_admin -> PRODUCTS.CREATE)
    const catalogAdminToken = signAuthToken({
      userId: 'usr_amit_catalog',
      role: 'STAFF',
      name: 'Amit Patel (Catalog Manager)',
      email: 'amit.catalog@cakes2home.com'
    });

    // Token for branch manager (usr_mgr_01 -> no PRODUCTS.CREATE)
    const branchManagerToken = signAuthToken({
      userId: 'usr_mgr_01',
      role: 'BRANCH_MANAGER',
      name: 'Branch Manager',
      email: 'mgr@cakes2home.com'
    });

    // Token for standard customer (cth_cus_test -> no PRODUCTS.CREATE)
    const customerToken = signAuthToken({
      userId: 'cth_cus_test_01',
      role: 'CUSTOMER',
      name: 'Test Customer',
      email: 'customer@test.com'
    });

    // Test 3: Unauthenticated request -> 401
    const unauthHeaders = new Map([['content-type', 'application/json']]);
    const unauthReq = {
      headers: { get: (k) => unauthHeaders.get(k.toLowerCase()) || null },
      json: async () => ({ title: 'Test Box', sku: 'TEST-UNAUTH' })
    };
    const unauthRes = await POST(unauthReq);
    assert(unauthRes.status === 401, `Requirement 3: Unauthenticated request rejected with HTTP 401 (got ${unauthRes.status})`);

    // Test 2: Unauthorized actor (usr_mgr_01) -> 403
    const branchMgrHeaders = new Map([
      ['authorization', `Bearer ${branchManagerToken}`],
      ['content-type', 'application/json']
    ]);
    const unauthzReq = {
      headers: { get: (k) => branchMgrHeaders.get(k.toLowerCase()) },
      json: async () => ({ title: 'Test Box', sku: 'TEST-UNAUTHZ' })
    };
    const unauthzRes = await POST(unauthzReq);
    assert(unauthzRes.status === 403, `Requirement 2: Actor without PRODUCTS.CREATE rejected with HTTP 403 (got ${unauthzRes.status})`);

    // Test Customer unauthorized -> 403
    const cusHeaders = new Map([
      ['authorization', `Bearer ${customerToken}`],
      ['content-type', 'application/json']
    ]);
    const cusReq = {
      headers: { get: (k) => cusHeaders.get(k.toLowerCase()) },
      json: async () => ({ title: 'Test Box', sku: 'TEST-CUS' })
    };
    const cusRes = await POST(cusReq);
    assert(cusRes.status === 403, `Customer rejected with HTTP 403 (got ${cusRes.status})`);

    // Test 4 & 5: Caller attempts to spoof userId and role in payload
    console.log('\n[Phase 3] Testing Identity Spoofing Protection & Route Validation...');
    // A regular customer provides body { userId: "usr_amit_catalog", role: "SUPER_ADMIN" }
    const spoofReq = {
      headers: { get: (k) => cusHeaders.get(k.toLowerCase()) },
      json: async () => ({
        title: 'Spoofed Box',
        sku: 'TEST-SPOOF-01',
        userId: 'usr_amit_catalog',
        role: 'SUPER_ADMIN'
      })
    };
    const spoofRes = await POST(spoofReq);
    assert(spoofRes.status === 403, `Requirement 4 & 5: Body payload spoofing userId & role rejected based on verified session (HTTP 403)`);

    // Authorized actor with invalid input returns HTTP 400
    const catHeaders = new Map([
      ['authorization', `Bearer ${catalogAdminToken}`],
      ['content-type', 'application/json']
    ]);
    const badInputReq = {
      headers: { get: (k) => catHeaders.get(k.toLowerCase()) || null },
      json: async () => ({ title: '', sku: '' })
    };
    const badInputRes = await POST(badInputReq);
    assert(badInputRes.status === 400, `Authorized actor with invalid input rejected by route with HTTP 400 (got ${badInputRes.status})`);

    // Direct permission resolver check
    const catalogAdminSession = resolveServerSession({
      headers: { get: (k) => k.toLowerCase() === 'authorization' ? `Bearer ${catalogAdminToken}` : null }
    });
    assert(hasEffectivePermission(catalogAdminSession, 'PRODUCTS.CREATE') === true, 'Catalog Admin has effective permission PRODUCTS.CREATE');
    assert(hasEffectivePermission(catalogAdminSession, 'ACCOUNTING.POST') === false, 'Catalog Admin does NOT have ACCOUNTING.POST (Least Privilege)');

    // -------------------------------------------------------------------------
    // TEST 9: INPUT VALIDATION CHECKS
    // -------------------------------------------------------------------------
    console.log('\n[Phase 4] Testing Service Validation Guards...');

    // Missing title
    let valError1 = null;
    try {
      await ProductService.createPackagingProduct({ title: '', sku: 'TEST-SKU-VAL' }, 'usr_amit_catalog');
    } catch (e) {
      valError1 = e.message;
    }
    assert(valError1 && valError1.includes("Validation error: 'title' is required"), `Requirement 9: Empty title rejected (${valError1})`);

    // Missing SKU
    let valError2 = null;
    try {
      await ProductService.createPackagingProduct({ title: 'Valid Title', sku: '' }, 'usr_amit_catalog');
    } catch (e) {
      valError2 = e.message;
    }
    assert(valError2 && valError2.includes("Validation error: 'sku' is required"), `Requirement 9: Empty SKU rejected (${valError2})`);

    // Invalid status
    let valError3 = null;
    try {
      await ProductService.createPackagingProduct({ title: 'Valid Title', sku: 'SKU-001', status: 'invalid_status' }, 'usr_amit_catalog');
    } catch (e) {
      valError3 = e.message;
    }
    assert(valError3 && valError3.includes("Validation error: 'status' must be one of"), `Requirement 9: Invalid status rejected (${valError3})`);

    // Negative cost_price
    let valError4 = null;
    try {
      await ProductService.createPackagingProduct({ title: 'Valid Title', sku: 'SKU-001', cost_price: -10 }, 'usr_amit_catalog');
    } catch (e) {
      valError4 = e.message;
    }
    assert(valError4 && valError4.includes("Validation error: 'cost_price' must be a non-negative number"), `Requirement 9: Negative cost_price rejected (${valError4})`);

    // Invalid GST rate
    let valError5 = null;
    try {
      await ProductService.createPackagingProduct({ title: 'Valid Title', sku: 'SKU-001', gst_rate: 150 }, 'usr_amit_catalog');
    } catch (e) {
      valError5 = e.message;
    }
    assert(valError5 && valError5.includes("Validation error: 'gst_rate' must be between 0 and 100"), `Requirement 9: Invalid GST rate (>100) rejected (${valError5})`);

    // -------------------------------------------------------------------------
    // TEST 1, 6, 7, 8: ATOMIC PRODUCT + VARIANT CREATION & ROLLBACK (TRANSACTION GUARDED)
    // -------------------------------------------------------------------------
    console.log('\n[Phase 5] Testing Product + Variant Atomic Creation inside Isolated Transaction...');

    await client.query('BEGIN');
    console.log('  ↳ Transaction started (BEGIN)');

    const testInput = {
      title: 'SYNTHETIC Eco Corrugated Cake Box (10x10x5)',
      sku: 'TEST-PKG-BOX-1010-001',
      handle: 'synthetic-eco-corrugated-cake-box-1010-001',
      description: 'Test synthetic packaging item for catalog workflow testing',
      status: 'draft',
      uqc: 'NOS',
      hsn_code: '48191000',
      gst_rate: 18,
      cost_price: 14.50, // Non-authoritative / informational
      metadata: { test_run_id: 'step3c22_sim' }
    };

    // Test 1: Authorized actor succeeds
    const creationResult = await ProductService.createPackagingProduct(testInput, 'usr_amit_catalog', client);
    assert(creationResult && creationResult.product && creationResult.variant, 'Requirement 1: Authorized creation returned product + variant');

    // Test 6: merchandise_type = 'PACKAGING'
    assert(creationResult.product.merchandise_type === 'PACKAGING', `Requirement 6: product.merchandise_type is 'PACKAGING' (got ${creationResult.product.merchandise_type})`);
    assert(creationResult.product.status === 'draft', `product.status is 'draft' (got ${creationResult.product.status})`);

    // Test 7: Atomic product + variant creation
    assert(creationResult.variant.product_id === creationResult.product.id, `Requirement 7: Variant references created product ID (${creationResult.variant.product_id})`);
    assert(creationResult.variant.sku === 'TEST-PKG-BOX-1010-001', `Variant SKU matches input SKU (${creationResult.variant.sku})`);
    assert(creationResult.variant.manage_inventory === true, 'Variant manage_inventory is TRUE (inventory-compatible)');

    // Verify DB state inside transaction
    const prodDb = (await client.query('SELECT * FROM public.product WHERE id = $1', [creationResult.product.id])).rows[0];
    assert(prodDb && prodDb.merchandise_type === 'PACKAGING', 'DB verification: product persisted in transaction with PACKAGING merchandise type');
    assert(prodDb.metadata.cost_price === 14.50, 'DB verification: metadata.cost_price stored non-authoritatively');
    assert(prodDb.metadata.uqc === 'NOS', 'DB verification: metadata.uqc is NOS');
    assert(prodDb.metadata.hsn_code === '48191000', 'DB verification: metadata.hsn_code is 48191000');
    assert(prodDb.metadata.gst_rate === 18, 'DB verification: metadata.gst_rate is 18');

    const varDb = (await client.query('SELECT * FROM public.product_variant WHERE id = $1', [creationResult.variant.id])).rows[0];
    assert(varDb && varDb.manage_inventory === true, 'DB verification: variant persisted in transaction with manage_inventory = true');

    // Verify audit log inside transaction
    const auditDb = (await client.query("SELECT * FROM public.audit_log WHERE entity_id = $1 AND action = 'catalog.packaging_product_created'", [creationResult.product.id])).rows[0];
    assert(auditDb && auditDb.actor_id === 'usr_amit_catalog', `DB verification: audit_log recorded with action 'catalog.packaging_product_created' and actor 'usr_amit_catalog'`);

    // Test 8: Duplicate SKU rejection
    console.log('\n[Phase 6] Testing Duplicate SKU and Duplicate Handle Enforcement...');
    let dupSkuError = null;
    try {
      await ProductService.createPackagingProduct({
        title: 'Another Box with Same SKU',
        sku: 'TEST-PKG-BOX-1010-001', // Duplicate SKU
        handle: 'another-box-distinct-handle'
      }, 'usr_amit_catalog', client);
    } catch (e) {
      dupSkuError = e;
    }
    assert(dupSkuError && dupSkuError.code === 'DUPLICATE_SKU', `Requirement 8: Duplicate SKU rejected with code DUPLICATE_SKU (${dupSkuError?.message})`);

    // Test Duplicate Handle rejection
    let dupHandleError = null;
    try {
      await ProductService.createPackagingProduct({
        title: 'Different Title',
        sku: 'TEST-PKG-BOX-DISTINCT-002',
        handle: 'synthetic-eco-corrugated-cake-box-1010-001' // Duplicate Handle
      }, 'usr_amit_catalog', client);
    } catch (e) {
      dupHandleError = e;
    }
    assert(dupHandleError && dupHandleError.code === 'DUPLICATE_HANDLE', `Duplicate Handle rejected with code DUPLICATE_HANDLE (${dupHandleError?.message})`);

    // Test 11 (inside tx): branch_inventory must NOT be seeded automatically
    const txBInvCount = parseInt((await client.query('SELECT COUNT(*) FROM public.branch_inventory')).rows[0].count, 10);
    assert(txBInvCount === bInvInitial, `Requirement 11: branch_inventory not mutated by product master creation (${txBInvCount} === ${bInvInitial})`);

    // -------------------------------------------------------------------------
    // TEST 10: COMPLETE ROLLBACK
    // -------------------------------------------------------------------------
    console.log('\n[Phase 7] Executing Complete Rollback...');
    await client.query('ROLLBACK');
    console.log('  ↳ Transaction rolled back (ROLLBACK)');

    // -------------------------------------------------------------------------
    // POST-ROLLBACK INDEPENDENT VERIFICATION
    // -------------------------------------------------------------------------
    console.log('\n[Phase 8] Post-Rollback Independent PostgreSQL Verification...');

    const postProdCount = parseInt((await client.query('SELECT COUNT(*) FROM public.product')).rows[0].count, 10);
    const postVarCount = parseInt((await client.query('SELECT COUNT(*) FROM public.product_variant')).rows[0].count, 10);
    const postPkgCount = parseInt((await client.query("SELECT COUNT(*) FROM public.product WHERE merchandise_type = 'PACKAGING'")).rows[0].count, 10);
    const postBInvCount = parseInt((await client.query('SELECT COUNT(*) FROM public.branch_inventory')).rows[0].count, 10);
    const postVchCount = parseInt((await client.query('SELECT COUNT(*) FROM public.accounting_voucher')).rows[0].count, 10);
    const postJnlCount = parseInt((await client.query('SELECT COUNT(*) FROM public.accounting_journal_entry')).rows[0].count, 10);
    const postLotCount = parseInt((await client.query('SELECT COUNT(*) FROM public.inventory_cost_lot')).rows[0].count, 10);
    const postMovCount = parseInt((await client.query('SELECT COUNT(*) FROM public.inventory_movement')).rows[0].count, 10);
    const testProdCheck = (await client.query("SELECT COUNT(*) FROM public.product WHERE id = $1", [creationResult.product.id])).rows[0].count;
    const testSkuCheck = (await client.query("SELECT COUNT(*) FROM public.product_variant WHERE sku = 'TEST-PKG-BOX-1010-001'")).rows[0].count;

    assert(parseInt(testProdCheck, 10) === 0, `Requirement 10: Test product was completely removed by rollback (count = 0)`);
    assert(parseInt(testSkuCheck, 10) === 0, `Requirement 10: Test variant was completely removed by rollback (count = 0)`);
    assert(postPkgCount === 0, `Requirement 10: Zero persistent packaging products in database (${postPkgCount})`);
    assert(postProdCount === prodInitial, `Product count unchanged (${postProdCount} === ${prodInitial})`);
    assert(postVarCount === varInitial, `Product variant count unchanged (${postVarCount} === ${varInitial})`);
    assert(postBInvCount === 424, `Requirement 11: branch_inventory count unchanged at 424 (${postBInvCount})`);
    assert(postVchCount === 0, `Requirement 12: accounting_voucher count unchanged at 0 (${postVchCount})`);
    assert(postJnlCount === 0, `Requirement 12: accounting_journal_entry count unchanged at 0 (${postJnlCount})`);
    assert(postLotCount === 0, `Requirement 12: inventory_cost_lot count unchanged at 0 (${postLotCount})`);
    assert(postMovCount === 0, `Requirement 12: inventory_movement count unchanged at 0 (${postMovCount})`);

    console.log('\n=============================================================================');
    console.log(`TEST SUITE SUMMARY: ${passCount} PASSED, ${failCount} FAILED`);
    console.log('=============================================================================');

    if (failCount > 0) {
      process.exit(1);
    }
  } catch (err) {
    console.error('\nUNHANDLED TEST SUITE ERROR:', err);
    try { await client.query('ROLLBACK'); } catch (_) {}
    process.exit(1);
  } finally {
    await client.end();
  }
}

runTestSuite();
