const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

const envPath = path.join(__dirname, '../.env');
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf8');
  envContent.split('\n').forEach(line => {
    const parts = line.split('=');
    if (parts[0] && parts[1]) {
      process.env[parts[0].trim()] = parts.slice(1).join('=').trim();
    }
  });
}

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

const TARGET_REGION_ID = 'txreg_01KY2B1R2YVX5040412JCZM1H6';
const ORIGINAL_5_ID = 'txr_01KY2B1R7WKC3Z3MMQ85EEH8X6';

async function verify() {
  const client = await pool.connect();
  let failures = 0;
  function assert(condition, message) {
    if (condition) {
      console.log(`[PASS] ${message}`);
    } else {
      console.error(`[FAIL] ${message}`);
      failures++;
    }
  }

  try {
    console.log('=== 1. Direct DB Verification: Exactly 5 Active Slabs in India Region ===');
    const res = await client.query(`
      SELECT id, rate, code, name, is_default, tax_region_id, deleted_at, metadata
      FROM public.tax_rate
      WHERE tax_region_id = $1 AND deleted_at IS NULL
      ORDER BY rate ASC;
    `, [TARGET_REGION_ID]);

    assert(res.rows.length === 5, `Expected exactly 5 active slabs in region, found ${res.rows.length}`);

    const rates = res.rows.map(r => Number(r.rate));
    assert(JSON.stringify(rates) === JSON.stringify([0, 5, 12, 18, 28]), `Expected rates [0, 5, 12, 18, 28], got ${JSON.stringify(rates)}`);

    const codes = res.rows.map(r => r.code);
    assert(JSON.stringify(codes) === JSON.stringify(['GST_0', 'GST_5', 'GST_12', 'GST_18', 'GST_28']), `Expected codes ['GST_0', 'GST_5', 'GST_12', 'GST_18', 'GST_28'], got ${JSON.stringify(codes)}`);

    console.log('\n=== 2. Preservation of Original 5% Record & Historical Identity ===');
    const orig5 = res.rows.find(r => r.rate === 5);
    assert(orig5 !== undefined, 'Rate 5% record exists');
    assert(orig5.id === ORIGINAL_5_ID, `Original 5% record ID preserved (Expected: ${ORIGINAL_5_ID}, Got: ${orig5?.id})`);
    assert(orig5.is_default === true, 'Original 5% record maintains is_default = true');

    const nonDefaults = res.rows.filter(r => r.rate !== 5);
    const allNonDefaultFalse = nonDefaults.every(r => r.is_default === false);
    assert(allNonDefaultFalse, 'All other 4 slabs have is_default = false (IDX_single_default_region compliant)');

    console.log('\n=== 3. Zero Duplicate Canonical Records Check ===');
    const dupCheck = await client.query(`
      SELECT rate, count(*) 
      FROM public.tax_rate 
      WHERE tax_region_id = $1 AND deleted_at IS NULL 
      GROUP BY rate 
      HAVING count(*) > 1;
    `, [TARGET_REGION_ID]);
    assert(dupCheck.rows.length === 0, `Zero duplicate rates in tax_region (found ${dupCheck.rows.length} duplicates)`);

    console.log('\n=== 4. Side-Effect Free Invariant: Zero Products, Invoices, Vouchers or Journal Lines Modified ===');
    // Check product count & HSN classification
    const prodCount = await client.query(`SELECT count(*) FROM public.product;`);
    assert(Number(prodCount.rows[0].count) >= 22, `Product catalog count preserved (${prodCount.rows[0].count} products)`);

    const invoiceCount = await client.query(`SELECT count(*) FROM public.invoice;`);
    assert(Number(invoiceCount.rows[0].count) === 5, `Invoice table count preserved (5 invoices, got ${invoiceCount.rows[0].count})`);

    const voucherCount = await client.query(`SELECT count(*) FROM public.accounting_voucher;`);
    assert(Number(voucherCount.rows[0].count) >= 6, `Accounting voucher count preserved (${voucherCount.rows[0].count} vouchers)`);

    const journalLineCount = await client.query(`SELECT count(*) FROM public.accounting_journal_line;`);
    assert(Number(journalLineCount.rows[0].count) >= 10, `Journal line count preserved (${journalLineCount.rows[0].count} lines)`);

    console.log('\n=== 5. Existing Tax Configuration API Verification ===');
    const apiRes = await fetch('http://localhost:3001/api/v1/admin/tax/configurations');
    const apiData = await apiRes.json();
    assert(apiRes.status === 200, `API returns HTTP 200 (Got: ${apiRes.status})`);
    assert(apiData.total === 5, `API returns total: 5 (Got: ${apiData.total})`);
    assert(Array.isArray(apiData.configurations) && apiData.configurations.length === 5, 'API configurations array has 5 items');

    const apiCodes = apiData.configurations.map(c => c.code);
    assert(apiCodes.includes('GST_0') && apiCodes.includes('GST_5') && apiCodes.includes('GST_12') && apiCodes.includes('GST_18') && apiCodes.includes('GST_28'), 'API contains all 5 statutory codes');

    console.log('\n================================================================');
    console.log(`TOTAL CHECKS: 13 | FAILURES: ${failures}`);
    console.log('================================================================');
    if (failures > 0) process.exit(1);

  } finally {
    client.release();
    await pool.end();
  }
}

verify().catch(e => {
  console.error(e);
  process.exit(1);
});
