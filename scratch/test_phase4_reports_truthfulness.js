/**
 * CakeToHome Phase 4 Verification Test: PostgreSQL Operational Reports Truthfulness
 */

const http = require('http');

function fetchJson(url, options = {}) {
  return new Promise((resolve, reject) => {
    const u = new URL(url);
    const req = http.request({
      hostname: u.hostname,
      port: u.port || 3000,
      path: u.pathname + u.search,
      method: options.method || 'GET',
      headers: options.headers || {},
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          resolve({ status: res.statusCode, data: json });
        } catch (e) {
          resolve({ status: res.statusCode, text: data });
        }
      });
    });
    req.on('error', reject);
    if (options.body) {
      req.write(typeof options.body === 'string' ? options.body : JSON.stringify(options.body));
    }
    req.end();
  });
}

async function run() {
  console.log('=== PHASE 4 VERIFICATION: OPERATIONAL REPORTS TRUTHFULNESS ===\n');
  let passed = 0;
  let total = 0;

  function assert(condition, message) {
    total++;
    if (condition) {
      console.log(`✅ PASS: ${message}`);
      passed++;
    } else {
      console.error(`❌ FAIL: ${message}`);
    }
  }

  try {
    // 1. Test Physical Inventory Valuation Report
    console.log('--- 1. Testing Physical Inventory Valuation Report ---');
    const invRes = await fetchJson('http://localhost:3000/api/v1/admin/reports/inventory');
    assert(invRes.status === 200, 'GET /admin/reports/inventory returns status 200');
    const inv = invRes.data?.data || invRes.data;

    // Check: Valuation should NOT be the old synthetic totalVal (which was ~57 cakes * 50 * 599 = 1,700,000+)
    // Instead, it must equal accessory_stock_val (physical accessories valuation)
    assert(typeof inv.total_valuation === 'number', `total_valuation is numeric: ₹${inv.total_valuation}`);
    assert(inv.total_valuation === inv.accessory_stock_val, `total_valuation matches physical accessory valuation (₹${inv.accessory_stock_val})`);
    assert(inv.ingredient_base_val === 0, `ingredient_base_val is 0 (no synthetic cake valuation)`);
    assert(inv.total_physical_skus > 0, `total_physical_skus reports actual active accessories (${inv.total_physical_skus} SKUs)`);

    // 2. Test Cake Availability Matrix Report
    console.log('\n--- 2. Testing Cake Availability Matrix Report ---');
    const cakeAvailRes = await fetchJson('http://localhost:3000/api/v1/admin/reports/cake-availability');
    assert(cakeAvailRes.status === 200, 'GET /admin/reports/cake-availability returns status 200');
    const cakeAvail = cakeAvailRes.data?.data || cakeAvailRes.data;

    assert(cakeAvail.total_branches > 0, `Reports total branches (${cakeAvail.total_branches})`);
    assert(cakeAvail.total_cakes > 0, `Reports total made-to-order cakes (${cakeAvail.total_cakes})`);
    assert(Array.isArray(cakeAvail.matrix) && cakeAvail.matrix.length > 0, `Matrix generated with ${cakeAvail.matrix?.length} branch-cake fulfillment mappings`);
    const sampleMapping = cakeAvail.matrix?.[0];
    assert(typeof sampleMapping?.is_available === 'boolean', `Matrix mapping has boolean is_available: ${sampleMapping?.is_available}`);
    assert(!!sampleMapping?.status, `Matrix mapping includes fulfillment status: "${sampleMapping?.status}" (${sampleMapping?.reason})`);

    // 3. Test Item-Wise Product Performance Report
    console.log('\n--- 3. Testing Item-Wise Product Performance Report ---');
    const prodReportRes = await fetchJson('http://localhost:3000/api/v1/admin/reports/products');
    assert(prodReportRes.status === 200, 'GET /admin/reports/products returns status 200');
    const prodReport = prodReportRes.data?.data || prodReportRes.data;
    assert(Array.isArray(prodReport.products) && prodReport.products.length > 0, `Item-wise report lists ${prodReport.products?.length} products`);
    const sampleProd = prodReport.products?.[0];
    assert(typeof sampleProd?.units_sold === 'number', `Item includes units_sold: ${sampleProd?.units_sold}`);

    // 4. Test Branch-Wise Performance Report
    console.log('\n--- 4. Testing Branch-Wise Performance Report ---');
    const branchReportRes = await fetchJson('http://localhost:3000/api/v1/admin/reports/branches');
    assert(branchReportRes.status === 200, 'GET /admin/reports/branches returns status 200');
    const branchReport = branchReportRes.data?.data || branchReportRes.data;
    assert(Array.isArray(branchReport.branches) && branchReport.branches.length > 0, `Branch-wise report lists ${branchReport.branches?.length} operational hubs`);

    // 5. Test Sales Report
    console.log('\n--- 5. Testing Sales Report ---');
    const salesReportRes = await fetchJson('http://localhost:3000/api/v1/admin/reports/sales');
    assert(salesReportRes.status === 200, 'GET /admin/reports/sales returns status 200');
    const salesReport = salesReportRes.data?.data || salesReportRes.data;
    assert(Array.isArray(salesReport.sales_by_period), `Sales report includes sales_by_period breakdown`);
    assert(typeof salesReport.accessory_attach_rate === 'string', `Sales report calculates accessory_attach_rate: ${salesReport.accessory_attach_rate}`);

    console.log(`\n=== PHASE 4 TESTS COMPLETE: ${passed}/${total} PASSED ===`);
  } catch (err) {
    console.error('Test error:', err);
  }
}

run();
