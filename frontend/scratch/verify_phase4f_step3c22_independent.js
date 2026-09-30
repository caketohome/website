/**
 * CakeToHome ERP — Phase 4F Step 3C.2.2 Independent PostgreSQL Verification
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

async function verifyIndependent() {
  console.log('=============================================================================');
  console.log('CakeToHome ERP — Phase 4F Step 3C.2.2 Independent PostgreSQL Verification');
  console.log('=============================================================================\n');

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
    // 1. Accounting Accounts
    const accCount = parseInt((await client.query('SELECT COUNT(*) FROM public.accounting_account')).rows[0].count, 10);
    assert(accCount === 98, `accounting_account = 98 (actual: ${accCount})`);

    // 2. Vouchers, Journals, Lines
    const vchCount = parseInt((await client.query('SELECT COUNT(*) FROM public.accounting_voucher')).rows[0].count, 10);
    assert(vchCount === 0, `accounting_voucher = 0 (actual: ${vchCount})`);

    const jnlCount = parseInt((await client.query('SELECT COUNT(*) FROM public.accounting_journal_entry')).rows[0].count, 10);
    assert(jnlCount === 0, `accounting_journal_entry = 0 (actual: ${jnlCount})`);

    const jnlLineCount = parseInt((await client.query('SELECT COUNT(*) FROM public.accounting_journal_line')).rows[0].count, 10);
    assert(jnlLineCount === 0, `accounting_journal_line = 0 (actual: ${jnlLineCount})`);

    const fpdCount = parseInt((await client.query('SELECT COUNT(*) FROM public.accounting_fiscal_period')).rows[0].count, 10);
    assert(fpdCount === 0, `accounting_fiscal_period = 0 (actual: ${fpdCount})`);

    // 3. Purchase Tables
    const pchCount = parseInt((await client.query('SELECT COUNT(*) FROM public.purchase')).rows[0].count, 10);
    assert(pchCount === 0, `purchase = 0 (actual: ${pchCount})`);

    const pchiCount = parseInt((await client.query('SELECT COUNT(*) FROM public.purchase_item')).rows[0].count, 10);
    assert(pchiCount === 0, `purchase_item = 0 (actual: ${pchiCount})`);

    const pchpCount = parseInt((await client.query('SELECT COUNT(*) FROM public.purchase_payment')).rows[0].count, 10);
    assert(pchpCount === 0, `purchase_payment = 0 (actual: ${pchpCount})`);

    // 4. Branch Inventory
    const binvCount = parseInt((await client.query('SELECT COUNT(*) FROM public.branch_inventory')).rows[0].count, 10);
    assert(binvCount === 424, `branch_inventory = 424 (actual: ${binvCount})`);

    // 5. Orders and Payments
    const ordCount = parseInt((await client.query('SELECT COUNT(*) FROM public."order"')).rows[0].count, 10);
    assert(ordCount === 173, `order = 173 (actual: ${ordCount})`);

    const ptxCount = parseInt((await client.query('SELECT COUNT(*) FROM public.payment_transaction')).rows[0].count, 10);
    assert(ptxCount === 53, `payment_transaction = 53 (actual: ${ptxCount})`);

    // 6. Inventory Cost Lots & Movements
    const lotCount = parseInt((await client.query('SELECT COUNT(*) FROM public.inventory_cost_lot')).rows[0].count, 10);
    assert(lotCount === 0, `inventory_cost_lot = 0 (actual: ${lotCount})`);

    const movCount = parseInt((await client.query('SELECT COUNT(*) FROM public.inventory_movement')).rows[0].count, 10);
    assert(movCount === 0, `inventory_movement = 0 (actual: ${movCount})`);

    const conCount = parseInt((await client.query('SELECT COUNT(*) FROM public.inventory_cost_consumption')).rows[0].count, 10);
    assert(conCount === 0, `inventory_cost_consumption = 0 (actual: ${conCount})`);

    // 7. Packaging Products in Catalog
    const pkgCount = parseInt((await client.query("SELECT COUNT(*) FROM public.product WHERE merchandise_type = 'PACKAGING'")).rows[0].count, 10);
    assert(pkgCount === 0, `packaging products = 0 (actual: ${pkgCount})`);

    // 8. Accounting Start Date Configuration
    const cfgTblRes = await client.query("SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'accounting_config'");
    const startDateConfig = cfgTblRes.rows.length === 0 ? "UNCONFIGURED" : "CONFIGURED";
    assert(startDateConfig === "UNCONFIGURED", `accounting_start_date = UNCONFIGURED (actual: ${startDateConfig})`);

    // 9. Verify No Synthetic/Test Products Persisted
    const synProdCount = parseInt((await client.query("SELECT COUNT(*) FROM public.product WHERE id LIKE 'prod_pkg_%' OR title LIKE '%SYNTHETIC%'")).rows[0].count, 10);
    assert(synProdCount === 0, `synthetic/test packaging products in database = 0 (actual: ${synProdCount})`);

    const synVarCount = parseInt((await client.query("SELECT COUNT(*) FROM public.product_variant WHERE id LIKE 'var_pkg_%' OR sku LIKE 'TEST-PKG-%'")).rows[0].count, 10);
    assert(synVarCount === 0, `synthetic/test packaging variants in database = 0 (actual: ${synVarCount})`);

    // 10. Verify Catalog Baseline Unchanged
    const prodCount = parseInt((await client.query('SELECT COUNT(*) FROM public.product')).rows[0].count, 10);
    assert(prodCount === 65, `product count = 65 baseline (actual: ${prodCount})`);

    const varCount = parseInt((await client.query('SELECT COUNT(*) FROM public.product_variant')).rows[0].count, 10);
    assert(varCount === 27, `product_variant count = 27 baseline (actual: ${varCount})`);

    console.log('\n=============================================================================');
    console.log(`INDEPENDENT VERIFICATION RESULT: ${passCount} PASSED, ${failCount} FAILED`);
    console.log('=============================================================================');

    if (failCount > 0) {
      process.exit(1);
    }
  } catch (err) {
    console.error('VERIFICATION ERROR:', err);
    process.exit(1);
  } finally {
    await client.end();
  }
}

verifyIndependent();
