/**
 * CakeToHome ERP — Phase 4F Step 3B.1 Independent Verification Script
 * Validates all schema, index, constraint, and data invariants after hardening.
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

async function verifyAll() {
  console.log('=============================================================================');
  console.log('CakeToHome ERP — Phase 4F Step 3B.1 Independent Verification');
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
    // ─────────────────────────────────────────────────────────────────────────
    // 1. BLOCKER 1: FIFO Index Product Isolation
    // ─────────────────────────────────────────────────────────────────────────
    console.log('[1/7] Verifying Blocker 1: FIFO Index Product Isolation...');
    const fifoIdxRes = await client.query(`
      SELECT indexname, indexdef 
      FROM pg_indexes 
      WHERE tablename = 'inventory_cost_lot' AND indexname = 'idx_inventory_cost_lot_fifo';
    `);
    assert(fifoIdxRes.rows.length === 1, 'idx_inventory_cost_lot_fifo exists');
    const fifoDef = fifoIdxRes.rows[0]?.indexdef || '';
    assert(fifoDef.includes('branch_id') && fifoDef.includes('product_id') && fifoDef.includes('variant_id'),
      'idx_inventory_cost_lot_fifo covers (branch_id, product_id, variant_id)');
    assert(fifoDef.includes("status = 'ACTIVE'") && /remaining_quantity > (\(0\)::numeric|0)/.test(fifoDef),
      'idx_inventory_cost_lot_fifo is partial for ACTIVE lots with remaining_quantity > 0');

    // ─────────────────────────────────────────────────────────────────────────
    // 2. BLOCKER 2: Movement & Cost Consumption Ledgers
    // ─────────────────────────────────────────────────────────────────────────
    console.log('\n[2/7] Verifying Blocker 2: Movement & Cost Consumption Ledgers...');
    
    // inventory_movement
    const movColsRes = await client.query(`
      SELECT column_name, data_type, is_nullable 
      FROM information_schema.columns 
      WHERE table_name = 'inventory_movement' AND table_schema = 'public'
      ORDER BY ordinal_position;
    `);
    const movColNames = movColsRes.rows.map(r => r.column_name);
    assert(movColNames.includes('id'), 'inventory_movement has id');
    assert(movColNames.includes('branch_id'), 'inventory_movement has branch_id');
    assert(movColNames.includes('product_id'), 'inventory_movement has product_id');
    assert(movColNames.includes('variant_id'), 'inventory_movement has variant_id');
    assert(movColNames.includes('movement_type'), 'inventory_movement has movement_type');
    assert(movColNames.includes('quantity'), 'inventory_movement has quantity');
    assert(movColNames.includes('direction'), 'inventory_movement has direction');
    assert(movColNames.includes('order_id'), 'inventory_movement has order_id');
    assert(movColNames.includes('purchase_id'), 'inventory_movement has purchase_id');
    assert(movColNames.includes('voucher_id'), 'inventory_movement has voucher_id');
    assert(movColNames.includes('created_by'), 'inventory_movement has created_by');
    assert(movColNames.includes('created_at'), 'inventory_movement has created_at');

    // Foreign keys on inventory_movement
    const movFks = await client.query(`
      SELECT tc.constraint_name, ccu.table_name AS foreign_table_name, kcu.column_name
      FROM information_schema.table_constraints AS tc
      JOIN information_schema.key_column_usage AS kcu
        ON tc.constraint_name = kcu.constraint_name
      JOIN information_schema.constraint_column_usage AS ccu
        ON ccu.constraint_name = tc.constraint_name
      WHERE tc.constraint_type = 'FOREIGN KEY' AND tc.table_name = 'inventory_movement';
    `);
    const fkMap = {};
    movFks.rows.forEach(r => { fkMap[r.column_name] = r.foreign_table_name; });
    assert(fkMap['branch_id'] === 'branch', 'inventory_movement.branch_id references branch');
    assert(fkMap['product_id'] === 'product', 'inventory_movement.product_id references product');
    assert(fkMap['variant_id'] === 'product_variant', 'inventory_movement.variant_id references product_variant');
    assert(fkMap['order_id'] === 'order', 'inventory_movement.order_id references order');
    assert(fkMap['purchase_id'] === 'purchase', 'inventory_movement.purchase_id references purchase');
    assert(fkMap['voucher_id'] === 'accounting_voucher', 'inventory_movement.voucher_id references accounting_voucher');

    // inventory_cost_consumption
    const consColsRes = await client.query(`
      SELECT column_name, data_type, is_nullable 
      FROM information_schema.columns 
      WHERE table_name = 'inventory_cost_consumption' AND table_schema = 'public'
      ORDER BY ordinal_position;
    `);
    const consColNames = consColsRes.rows.map(r => r.column_name);
    assert(consColNames.includes('id'), 'inventory_cost_consumption has id');
    assert(consColNames.includes('movement_id'), 'inventory_cost_consumption has movement_id');
    assert(consColNames.includes('lot_id'), 'inventory_cost_consumption has lot_id');
    assert(consColNames.includes('quantity'), 'inventory_cost_consumption has quantity');
    assert(consColNames.includes('unit_cost'), 'inventory_cost_consumption has unit_cost');
    assert(consColNames.includes('total_cost'), 'inventory_cost_consumption has total_cost');
    assert(consColNames.includes('created_at'), 'inventory_cost_consumption has created_at');

    // Foreign keys on inventory_cost_consumption
    const consFks = await client.query(`
      SELECT tc.constraint_name, ccu.table_name AS foreign_table_name, kcu.column_name
      FROM information_schema.table_constraints AS tc
      JOIN information_schema.key_column_usage AS kcu
        ON tc.constraint_name = kcu.constraint_name
      JOIN information_schema.constraint_column_usage AS ccu
        ON ccu.constraint_name = tc.constraint_name
      WHERE tc.constraint_type = 'FOREIGN KEY' AND tc.table_name = 'inventory_cost_consumption';
    `);
    const consFkMap = {};
    consFks.rows.forEach(r => { consFkMap[r.column_name] = r.foreign_table_name; });
    assert(consFkMap['movement_id'] === 'inventory_movement', 'inventory_cost_consumption.movement_id references inventory_movement');
    assert(consFkMap['lot_id'] === 'inventory_cost_lot', 'inventory_cost_consumption.lot_id references inventory_cost_lot');

    // ─────────────────────────────────────────────────────────────────────────
    // 3. BLOCKER 3: Reversal Model Resolution
    // ─────────────────────────────────────────────────────────────────────────
    console.log('\n[3/7] Verifying Blocker 3: Reversal Model Resolution...');
    const lotColsRes = await client.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'inventory_cost_lot' AND table_schema = 'public';
    `);
    const lotColNames = lotColsRes.rows.map(r => r.column_name);
    assert(!lotColNames.includes('reversal_of_lot_id'), 'inventory_cost_lot.reversal_of_lot_id removed');
    assert(!lotColNames.includes('reversed_by_lot_id'), 'inventory_cost_lot.reversed_by_lot_id removed');

    // Check uniqueness constraint on purchase_item_id
    const lotUqRes = await client.query(`
      SELECT tc.constraint_name, kcu.column_name
      FROM information_schema.table_constraints tc
      JOIN information_schema.key_column_usage kcu
        ON tc.constraint_name = kcu.constraint_name
      WHERE tc.table_name = 'inventory_cost_lot' AND tc.constraint_type = 'UNIQUE';
    `);
    const uqCol = lotUqRes.rows.find(r => r.column_name === 'purchase_item_id');
    assert(Boolean(uqCol), 'inventory_cost_lot has UNIQUE(purchase_item_id) constraint');

    // ─────────────────────────────────────────────────────────────────────────
    // 4. BLOCKER 4: Authoritative Merchandise Classification
    // ─────────────────────────────────────────────────────────────────────────
    console.log('\n[4/7] Verifying Blocker 4: Merchandise Classification...');
    const prodColRes = await client.query(`
      SELECT column_name, data_type, is_nullable 
      FROM information_schema.columns 
      WHERE table_name = 'product' AND column_name = 'merchandise_type';
    `);
    assert(prodColRes.rows.length === 1, 'product.merchandise_type column exists');
    assert(prodColRes.rows[0].is_nullable === 'NO', 'product.merchandise_type is NOT NULL');

    const merchBreakdown = await client.query(`
      SELECT merchandise_type, COUNT(*) as cnt 
      FROM public.product 
      GROUP BY merchandise_type 
      ORDER BY merchandise_type;
    `);
    const breakdown = {};
    merchBreakdown.rows.forEach(r => { breakdown[r.merchandise_type] = parseInt(r.cnt, 10); });
    assert(breakdown['ACCESSORY'] === 8, '8 products classified as ACCESSORY (acc_01..acc_08)');
    assert(breakdown['CAKE'] === 57, '57 products classified as CAKE');
    assert(!breakdown['PACKAGING'], '0 customer-facing products classified as PACKAGING');

    const piColRes = await client.query(`
      SELECT column_name, data_type, is_nullable 
      FROM information_schema.columns 
      WHERE table_name = 'purchase_item' AND column_name = 'item_type';
    `);
    assert(piColRes.rows.length === 1, 'purchase_item.item_type column exists');
    assert(piColRes.rows[0].is_nullable === 'NO', 'purchase_item.item_type is NOT NULL');

    // ─────────────────────────────────────────────────────────────────────────
    // 5. BLOCKER 5: Cost Consistency Check Constraint
    // ─────────────────────────────────────────────────────────────────────────
    console.log('\n[5/7] Verifying Blocker 5: Cost Consistency Check Constraint...');
    const checkConstraintsRes = await client.query(`
      SELECT conname, pg_get_constraintdef(c.oid) as def
      FROM pg_constraint c
      JOIN pg_class cl ON cl.oid = c.conrelid
      WHERE cl.relname = 'inventory_cost_lot' AND c.contype = 'c';
    `);
    const mathConstraint = checkConstraintsRes.rows.find(r => r.conname === 'chk_cost_lot_cost_consistency');
    assert(Boolean(mathConstraint), 'chk_cost_lot_cost_consistency constraint exists on inventory_cost_lot');
    assert(mathConstraint?.def?.includes('total_cost') && mathConstraint?.def?.includes('0.05'),
      'chk_cost_lot_cost_consistency validates ABS(total_cost - ROUND(received_quantity * unit_cost, 2)) <= 0.05');

    // Test constraint enforcement via trial rollback transaction
    await client.query('BEGIN');
    let inconsistentBlocked = false;
    try {
      // Attempt invalid math: qty = 10, unit_cost = 100, total_cost = 500 (difference = 500 != 1000)
      await client.query(`
        INSERT INTO public.inventory_cost_lot (
          id, branch_id, product_id, variant_id, item_type, purchase_id, purchase_item_id,
          supplier_id, received_quantity, remaining_quantity, unit_cost, total_cost,
          currency, received_at, status, created_by
        ) VALUES (
          'test_bad_math', 'branch_01', 'acc_01', NULL, 'ACCESSORY', 'purch_01', 'item_01',
          'supp_01', 10, 10, 100.0000, 500.00,
          'INR', NOW(), 'ACTIVE', 'TEST'
        );
      `);
    } catch (err) {
      if (err.message.includes('chk_cost_lot_cost_consistency') || err.code === '23514') {
        inconsistentBlocked = true;
      }
    } finally {
      await client.query('ROLLBACK');
    }
    assert(inconsistentBlocked, 'DB successfully rejects inconsistent cost combinations (qty=10, rate=100, total=500)');

    // ─────────────────────────────────────────────────────────────────────────
    // 6. Complete Database Baseline Invariants
    // ─────────────────────────────────────────────────────────────────────────
    console.log('\n[6/7] Verifying Complete Database Baseline Counts...');
    const tablesToCheck = {
      accounting_account: 98,
      accounting_voucher: 0,
      accounting_journal_entry: 0,
      accounting_journal_line: 0,
      accounting_fiscal_period: 0,
      purchase: 0,
      purchase_item: 0,
      purchase_payment: 0,
      branch_inventory: 424,
      order: 173,
      payment_transaction: 53,
      inventory_cost_lot: 0,
      inventory_movement: 0,
      inventory_cost_consumption: 0
    };

    for (const [table, expectedCount] of Object.entries(tablesToCheck)) {
      const res = await client.query(`SELECT COUNT(*) as cnt FROM public."${table}"`);
      const actualCount = parseInt(res.rows[0].cnt, 10);
      assert(actualCount === expectedCount, `Table "${table}": count is ${actualCount} (expected: ${expectedCount})`);
    }

    const startSettingRes = await client.query(`SELECT value FROM public.setting WHERE key = 'accounting_start_date'`);
    assert(startSettingRes.rows.length === 0, 'Setting "accounting_start_date" remains UNCONFIGURED');

    // ─────────────────────────────────────────────────────────────────────────
    // 7. Summary
    // ─────────────────────────────────────────────────────────────────────────
    console.log('\n=============================================================================');
    console.log(`TOTAL CHECKS: ${passCount + failCount} | PASSED: ${passCount} | FAILED: ${failCount}`);
    console.log('=============================================================================');

    if (failCount === 0) {
      console.log('\nALL STEP 3B.1 INVARIANTS PASS! ✅\n');
    } else {
      console.error(`\nFAILED ${failCount} INVARIANTS! ❌\n`);
      process.exit(1);
    }

  } catch (err) {
    console.error('Verification error:', err);
    process.exit(1);
  } finally {
    await client.end();
  }
}

verifyAll();
