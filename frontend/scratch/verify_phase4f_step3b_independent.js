/**
 * CakeToHome ERP — Phase 4F Step 3B Independent Verification Script
 * Validates all 13 points in Section M:
 * 1. New valuation table exists.
 * 2. Correct columns exist.
 * 3. Correct data types exist.
 * 4. Correct FKs exist.
 * 5. Correct CHECK constraints exist.
 * 6. Correct indexes exist.
 * 7. New table contains ZERO rows.
 * 8. branch_inventory remains exactly 424 rows.
 * 9. No synthetic cake inventory exists.
 * 10. CoA remains 98 rows.
 * 11. Voucher/journal counts remain zero.
 * 12. Accounting start date remains unconfigured.
 * 13. Fiscal periods remain zero.
 */

const fs = require('fs');
const path = require('path');
const { Client } = require('../node_modules/pg');

function getConnectionString() {
  const envPath = path.join(__dirname, '../../backend/.env');
  const envContent = fs.readFileSync(envPath, 'utf8');
  for (const line of envContent.split('\n')) {
    if (line.startsWith('DATABASE_URL=')) return line.substring('DATABASE_URL='.length).trim();
  }
  throw new Error('No DATABASE_URL in backend/.env');
}

async function verifyStep3B() {
  console.log('=============================================================================');
  console.log('PHASE 4F STEP 3B INDEPENDENT DATABASE VERIFICATION');
  console.log('=============================================================================\n');

  const client = new Client({ connectionString: getConnectionString() });
  await client.connect();

  let failed = false;
  function assert(condition, message) {
    if (!condition) {
      console.error(`❌ FAIL: ${message}`);
      failed = true;
    } else {
      console.log(`✅ PASS: ${message}`);
    }
  }

  try {
    // 1. New valuation table exists
    const tableRes = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' AND table_name = 'inventory_cost_lot'
    `);
    assert(tableRes.rows.length === 1, '1. New valuation table public.inventory_cost_lot exists');

    // 2. Correct columns exist
    const colsRes = await client.query(`
      SELECT column_name, data_type, udt_name, is_nullable, column_default
      FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'inventory_cost_lot'
      ORDER BY ordinal_position
    `);
    const colNames = colsRes.rows.map(r => r.column_name);
    const expectedCols = [
      'id', 'branch_id', 'product_id', 'variant_id', 'item_type',
      'purchase_id', 'purchase_item_id', 'supplier_id',
      'received_quantity', 'remaining_quantity', 'unit_cost', 'total_cost',
      'currency', 'received_at', 'status',
      'reversal_of_lot_id', 'reversed_by_lot_id',
      'created_by', 'created_at', 'updated_at'
    ];
    const missingCols = expectedCols.filter(c => !colNames.includes(c));
    assert(missingCols.length === 0, `2. Correct columns exist (missing: ${missingCols.join(', ') || 'none'})`);

    // 3. Correct data types exist
    const colTypes = {};
    colsRes.rows.forEach(r => { colTypes[r.column_name] = r.udt_name; });
    assert(colTypes['received_quantity'] === 'numeric', `3a. received_quantity is numeric (got ${colTypes['received_quantity']})`);
    assert(colTypes['remaining_quantity'] === 'numeric', `3b. remaining_quantity is numeric (got ${colTypes['remaining_quantity']})`);
    assert(colTypes['unit_cost'] === 'numeric', `3c. unit_cost is numeric (got ${colTypes['unit_cost']})`);
    assert(colTypes['total_cost'] === 'numeric', `3d. total_cost is numeric (got ${colTypes['total_cost']})`);
    assert(colTypes['currency'] === 'varchar', `3e. currency is varchar (got ${colTypes['currency']})`);
    assert(colTypes['received_at'] === 'date', `3f. received_at is date (got ${colTypes['received_at']})`);
    assert(colTypes['status'] === 'text', `3g. status is text (got ${colTypes['status']})`);

    // 4. Correct FKs exist
    const fkRes = await client.query(`
      SELECT
        kcu.column_name, 
        ccu.table_name AS foreign_table_name,
        ccu.column_name AS foreign_column_name 
      FROM 
        information_schema.table_constraints AS tc 
        JOIN information_schema.key_column_usage AS kcu
          ON tc.constraint_name = kcu.constraint_name AND tc.table_schema = kcu.table_schema
        JOIN information_schema.constraint_column_usage AS ccu
          ON ccu.constraint_name = tc.constraint_name AND ccu.table_schema = tc.table_schema
      WHERE tc.constraint_type = 'FOREIGN KEY' AND tc.table_name = 'inventory_cost_lot'
      ORDER BY kcu.column_name;
    `);
    const fks = {};
    fkRes.rows.forEach(r => { fks[r.column_name] = `${r.foreign_table_name}.${r.foreign_column_name}`; });
    console.log('   Observed FKs:', JSON.stringify(fks));
    assert(fks['branch_id'] === 'branch.id', '4a. branch_id FK -> branch.id');
    assert(fks['product_id'] === 'product.id', '4b. product_id FK -> product.id');
    assert(fks['variant_id'] === 'product_variant.id', '4c. variant_id FK -> product_variant.id');
    assert(fks['purchase_id'] === 'purchase.id', '4d. purchase_id FK -> purchase.id');
    assert(fks['purchase_item_id'] === 'purchase_item.id', '4e. purchase_item_id FK -> purchase_item.id');
    assert(fks['supplier_id'] === 'supplier.id', '4f. supplier_id FK -> supplier.id');
    assert(fks['reversal_of_lot_id'] === 'inventory_cost_lot.id', '4g. reversal_of_lot_id FK -> inventory_cost_lot.id');
    assert(fks['reversed_by_lot_id'] === 'inventory_cost_lot.id', '4h. reversed_by_lot_id FK -> inventory_cost_lot.id');

    // 5. Correct CHECK constraints exist
    const chkRes = await client.query(`
      SELECT conname, pg_get_constraintdef(c.oid) as def
      FROM pg_constraint c
      JOIN pg_class t ON c.conrelid = t.oid
      WHERE t.relname = 'inventory_cost_lot' AND c.contype = 'c';
    `);
    const chkDefs = chkRes.rows.map(r => `${r.conname}: ${r.def}`);
    console.log('   Observed CHECK constraints:');
    chkDefs.forEach(d => console.log('     -', d));
    assert(chkDefs.some(d => d.includes('remaining_quantity <= received_quantity')), '5a. Constraint: remaining_quantity <= received_quantity');
    assert(chkDefs.some(d => d.includes('received_quantity > 0::numeric') || d.includes('received_quantity > (0)')), '5b. Constraint: received_quantity > 0');
    assert(chkDefs.some(d => d.includes('remaining_quantity >= 0::numeric') || d.includes('remaining_quantity >= (0)')), '5c. Constraint: remaining_quantity >= 0');
    assert(chkDefs.some(d => d.includes('unit_cost >= 0::numeric') || d.includes('unit_cost >= (0)')), '5d. Constraint: unit_cost >= 0');
    assert(chkDefs.some(d => d.includes('total_cost >= 0::numeric') || d.includes('total_cost >= (0)')), '5e. Constraint: total_cost >= 0');
    assert(chkDefs.some(d => d.includes('status') && d.includes('ACTIVE') && d.includes('DEPLETED') && d.includes('REVERSED')), '5f. Constraint: status in ACTIVE, DEPLETED, REVERSED');
    assert(chkDefs.some(d => d.includes('item_type') && d.includes('CAKE') && d.includes('ACCESSORY') && d.includes('PACKAGING')), '5g. Constraint: item_type in CAKE, ACCESSORY, PACKAGING');

    // 6. Correct indexes exist
    const idxRes = await client.query(`
      SELECT indexname, indexdef 
      FROM pg_indexes 
      WHERE tablename = 'inventory_cost_lot'
      ORDER BY indexname;
    `);
    const idxNames = idxRes.rows.map(r => r.indexname);
    console.log('   Observed indexes:', idxNames.join(', '));
    assert(idxNames.includes('idx_inventory_cost_lot_fifo'), '6a. idx_inventory_cost_lot_fifo exists');
    assert(idxNames.includes('idx_inventory_cost_lot_purchase'), '6b. idx_inventory_cost_lot_purchase exists');
    assert(idxNames.includes('idx_inventory_cost_lot_purchase_item'), '6c. idx_inventory_cost_lot_purchase_item exists');
    assert(idxNames.includes('idx_inventory_cost_lot_branch'), '6d. idx_inventory_cost_lot_branch exists');
    assert(idxNames.includes('idx_inventory_cost_lot_supplier'), '6e. idx_inventory_cost_lot_supplier exists');

    // 7. New table contains ZERO rows
    const lotCount = await client.query('SELECT COUNT(*) as cnt FROM public.inventory_cost_lot');
    assert(parseInt(lotCount.rows[0].cnt, 10) === 0, `7. inventory_cost_lot has 0 rows (got ${lotCount.rows[0].cnt})`);

    // 8. branch_inventory remains exactly 424 rows
    const biCount = await client.query('SELECT COUNT(*) as cnt FROM public.branch_inventory');
    assert(parseInt(biCount.rows[0].cnt, 10) === 424, `8. branch_inventory remains exactly 424 rows (got ${biCount.rows[0].cnt})`);

    // 9. No synthetic cake inventory exists
    // Verify that branch_inventory has 0 cake products (only the 8 original accessory products acc_01..acc_08 exist)
    const cakeInventory = await client.query(`
      SELECT COUNT(*) as cnt 
      FROM public.branch_inventory bi
      WHERE bi.product_id NOT LIKE 'acc_%'
    `);
    assert(parseInt(cakeInventory.rows[0].cnt, 10) === 0, `9. Zero synthetic cake inventory rows in branch_inventory (got ${cakeInventory.rows[0].cnt})`);

    // 10. CoA remains 98 rows
    const coaCount = await client.query('SELECT COUNT(*) as cnt FROM public.accounting_account');
    assert(parseInt(coaCount.rows[0].cnt, 10) === 98, `10a. CoA remains 98 rows (got ${coaCount.rows[0].cnt})`);

    // Verify 1132 and 5110 names
    const a1132 = await client.query(`SELECT name FROM public.accounting_account WHERE code = '1132'`);
    const a5110 = await client.query(`SELECT name FROM public.accounting_account WHERE code = '5110'`);
    assert(a1132.rows[0].name === 'Merchandise Inventory - Cakes', `10b. Account 1132 name is "Merchandise Inventory - Cakes" (got "${a1132.rows[0].name}")`);
    assert(a5110.rows[0].name === 'COGS - Cakes', `10c. Account 5110 name is "COGS - Cakes" (got "${a5110.rows[0].name}")`);

    // 11. Voucher/journal counts remain zero
    const vCount = await client.query('SELECT COUNT(*) as cnt FROM public.accounting_voucher');
    const jeCount = await client.query('SELECT COUNT(*) as cnt FROM public.accounting_journal_entry');
    const jlCount = await client.query('SELECT COUNT(*) as cnt FROM public.accounting_journal_line');
    assert(parseInt(vCount.rows[0].cnt, 10) === 0, `11a. accounting_voucher is 0 (got ${vCount.rows[0].cnt})`);
    assert(parseInt(jeCount.rows[0].cnt, 10) === 0, `11b. accounting_journal_entry is 0 (got ${jeCount.rows[0].cnt})`);
    assert(parseInt(jlCount.rows[0].cnt, 10) === 0, `11c. accounting_journal_line is 0 (got ${jlCount.rows[0].cnt})`);

    // 12. Accounting start date remains unconfigured
    const settingRes = await client.query(`SELECT value FROM public.setting WHERE key = 'accounting_start_date'`);
    assert(settingRes.rows.length === 0, '12. Accounting start date remains unconfigured (0 rows)');

    // 13. Fiscal periods remain zero
    const fpCount = await client.query('SELECT COUNT(*) as cnt FROM public.accounting_fiscal_period');
    assert(parseInt(fpCount.rows[0].cnt, 10) === 0, `13. Fiscal periods remain 0 (got ${fpCount.rows[0].cnt})`);

    // Historical operational data integrity
    const orderCount = await client.query('SELECT COUNT(*) as cnt FROM public."order"');
    const ptCount = await client.query('SELECT COUNT(*) as cnt FROM public.payment_transaction');
    const purCount = await client.query('SELECT COUNT(*) as cnt FROM public.purchase');
    const purItemCount = await client.query('SELECT COUNT(*) as cnt FROM public.purchase_item');
    const purPayCount = await client.query('SELECT COUNT(*) as cnt FROM public.purchase_payment');

    assert(parseInt(orderCount.rows[0].cnt, 10) === 173, `Historical orders remain 173 (got ${orderCount.rows[0].cnt})`);
    assert(parseInt(ptCount.rows[0].cnt, 10) === 53, `Historical payment_transactions remain 53 (got ${ptCount.rows[0].cnt})`);
    assert(parseInt(purCount.rows[0].cnt, 10) === 0, `purchase remains 0 (got ${purCount.rows[0].cnt})`);
    assert(parseInt(purItemCount.rows[0].cnt, 10) === 0, `purchase_item remains 0 (got ${purItemCount.rows[0].cnt})`);
    assert(parseInt(purPayCount.rows[0].cnt, 10) === 0, `purchase_payment remains 0 (got ${purPayCount.rows[0].cnt})`);

    console.log('\n-----------------------------------------------------------------------------');
    if (failed) {
      console.error('VERIFICATION RESULT: BLOCKED ❌');
      process.exit(1);
    } else {
      console.log('VERIFICATION RESULT: PASS ✅');
    }

  } catch (err) {
    console.error('Verification script error:', err);
    process.exit(1);
  } finally {
    await client.end();
  }
}

verifyStep3B();
