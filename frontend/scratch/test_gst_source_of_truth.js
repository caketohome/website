/**
 * Targeted Verification Suite: GST Registration Source of Truth & Removal of Fake GSTINs
 * Ensures zero fabricated "29AAAAA0000A1Z5" fallback values across repositories, services, and reports.
 */

const fs = require('fs');
const path = require('path');
const { Client } = require('pg');
const Module = require('module');

const OVERALL_TIMEOUT_MS = 30000;
let client = null;

const timer = setTimeout(async () => {
  console.error(`[TIMEOUT] test_gst_source_of_truth exceeded ${OVERALL_TIMEOUT_MS}ms`);
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
    const rel = request.replace('@frontend/', '');
    const target = path.join(__dirname, '../src', rel);
    return originalResolveFilename.call(this, target, parent, isMain, options);
  }
  return originalResolveFilename.call(this, request, parent, isMain, options);
};

// TypeScript Transpile Hook
require.extensions['.ts'] = function (module, filename) {
  const ts = require('typescript');
  const content = fs.readFileSync(filename, 'utf8');
  const compiled = ts.transpileModule(content, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2020,
      esModuleInterop: true,
      skipLibCheck: true,
    },
    fileName: filename,
  });
  return module._compile(compiled.outputText, filename);
};

let passed = 0;
let failed = 0;

function assert(cond, msg) {
  if (cond) {
    console.log(`  [PASS] ${msg}`);
    passed++;
  } else {
    console.error(`  [FAIL] ${msg}`);
    failed++;
  }
}

async function runTests() {
  console.log('=== GST REGISTRATION SOURCE OF TRUTH VERIFICATION ===\n');

  client = new Client({ connectionString: dbUrl, ssl: { rejectUnauthorized: false } });
  await client.connect();

  const { ReportRepository } = require('../src/lib/repositories/report.repository');
  const { GstRegistrationRepository } = require('../src/lib/repositories/gst-registration.repository');
  const { ReportService } = require('../src/lib/services/report.service');
  const { DeliveryInvoicingService } = require('../src/lib/services/delivery-invoicing.service');

  try {
    // 1. Database-backed seller GST resolution
    console.log('Step 1: ReportRepository.getSellerGstInfo() against PostgreSQL');
    const sellerGstInfo = await ReportRepository.getSellerGstInfo();
    console.log('  Resolved seller GST info:', sellerGstInfo);
    assert(sellerGstInfo !== undefined, 'Seller GST info returned');
    assert(sellerGstInfo.gstin !== '29AAAAA0000A1Z5', 'GSTIN is NOT fabricated 29AAAAA0000A1Z5 fallback');

    // 2. ReportService wrapping with dynamic GST resolution
    console.log('\nStep 2: ReportService.getTransactionalMetrics() response metadata');
    const metrics = await ReportService.getTransactionalMetrics({
      startDate: '2026-01-01',
      endDate: '2026-10-14',
    });
    assert(metrics.meta.dataSource === 'postgresql', 'Report data source is postgresql');
    assert(metrics.meta.sellerGstin !== '29AAAAA0000A1Z5', 'Report meta.sellerGstin is NOT fabricated 29AAAAA0000A1Z5');

    // 3. GST/HSN Summary GST resolution
    console.log('\nStep 3: ReportService.getGstHsnSummary() response metadata');
    const gstHsn = await ReportService.getGstHsnSummary({
      startDate: '2026-01-01',
      endDate: '2026-10-14',
    });
    assert(gstHsn.data.sellerGstin !== '29AAAAA0000A1Z5', 'gstHsn.data.sellerGstin is NOT fabricated 29AAAAA0000A1Z5');
    assert(gstHsn.meta.sellerGstin !== '29AAAAA0000A1Z5', 'gstHsn.meta.sellerGstin is NOT fabricated 29AAAAA0000A1Z5');

    // 4. GstRegistrationRepository.listAll() queries PostgreSQL
    console.log('\nStep 4: GstRegistrationRepository.listAll()');
    const allRegs = await GstRegistrationRepository.listAll();
    assert(Array.isArray(allRegs), 'GstRegistrationRepository.listAll() returns an array');
    console.log(`  Found ${allRegs.length} GST registrations in PostgreSQL`);

    // 5. DeliveryInvoicingService seller GST resolution
    console.log('\nStep 5: DeliveryInvoicingService does not fabricate GSTIN');
    const mockOrderSnap = {
      id: 'ord_test_sample',
      order_number: 'TEST-001',
      status: 'delivered',
      created_at: new Date().toISOString(),
      customer: { name: 'Test Customer', phone: '+919999999999' },
      items: [{ product_id: 'prod_1', title: 'Cake', quantity: 1, unit_price: 500, total: 500 }],
      total_amount: 500,
      subtotal: 500,
      tax_amount: 25,
      delivery_charge: 0,
      // intentionally omitted seller_gstin
    };
    const invResult = await DeliveryInvoicingService.generateInvoiceOnDelivery(null, mockOrderSnap);
    assert(invResult.success === true, 'Invoice generation succeeds for delivered order');
    assert(invResult.invoice.seller_gstin !== '29AAAAA0000A1Z5', 'Invoice seller_gstin is NOT fabricated 29AAAAA0000A1Z5');
    assert(invResult.invoice.seller_gstin === null || invResult.invoice.seller_gstin === undefined, 'Invoice seller_gstin is null when not in DB');

    // 6. Verified that no active code path injects 29AAAAA0000A1Z5
    console.log('\nStep 6: Codebase verification for 29AAAAA0000A1Z5 in services and repositories');
    const serviceFiles = fs.readdirSync(path.join(__dirname, '../src/lib/services')).filter(f => f.endsWith('.ts'));
    let foundInServices = false;
    for (const sf of serviceFiles) {
      const content = fs.readFileSync(path.join(__dirname, '../src/lib/services', sf), 'utf8');
      // allow comments or regex validation examples
      const lines = content.split('\n');
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        if (line.includes('29AAAAA0000A1Z5') && !line.includes('//') && !line.includes('!== "29AAAAA0000A1Z5"') && !line.includes('Expected format') && !line.includes('Expected 15-character')) {
          console.error(`  Found 29AAAAA0000A1Z5 in ${sf}:${i + 1}: ${line.trim()}`);
          foundInServices = true;
        }
      }
    }
    assert(!foundInServices, 'No active service injects fabricated 29AAAAA0000A1Z5');

  } finally {
    if (client) {
      try { await client.end(); } catch {}
    }
    clearTimeout(timer);
  }

  console.log(`\n=== RESULTS: ${passed} PASSED | ${failed} FAILED ===\n`);
  if (failed > 0) process.exit(1);
}

runTests().catch(err => {
  console.error('[FATAL]', err);
  process.exit(1);
});
