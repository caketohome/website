const fs = require('fs');
const path = require('path');
const { Client } = require(path.join(__dirname, '../node_modules/pg'));

function getConnectionString() {
  const envPath = path.join(__dirname, '../../backend/.env');
  const envContent = fs.readFileSync(envPath, 'utf8');
  for (const line of envContent.split('\n')) {
    if (line.startsWith('DATABASE_URL=')) return line.substring('DATABASE_URL='.length).trim();
  }
}

async function verifyStep3c21() {
  console.log('=============================================================================');
  console.log('Phase 4F Step 3C.2.1 — Independent Verification & Constraint Testing');
  console.log('=============================================================================\n');

  const client = new Client({ connectionString: getConnectionString() });
  await client.connect();

  try {
    // 1. Check constraints on branch_inventory
    console.log('[1/4] Verifying catalog constraints in pg_catalog...');
    const conRes = await client.query(`
      SELECT conname, contype, pg_get_constraintdef(c.oid) as def
      FROM pg_constraint c
      JOIN pg_class cl ON c.conrelid = cl.oid
      WHERE cl.relname = 'branch_inventory'
      ORDER BY conname
    `);
    console.table(conRes.rows);

    const required = [
      'branch_inventory_product_id_foreign',
      'branch_inventory_variant_id_foreign',
      'branch_inventory_quantity_non_negative',
      'branch_inventory_reserved_non_negative',
      'branch_inventory_branch_id_foreign',
      'branch_inventory_pkey'
    ];
    const names = conRes.rows.map(r => r.conname);
    for (const r of required) {
      if (!names.includes(r)) {
        throw new Error(`MISSING CONSTRAINT: ${r}`);
      }
    }
    console.log('  ✓ All 6 required constraints actively enforced in PostgreSQL.');

    // Fetch a branch that doesn't have inventory for a clean test
    const emptyBranchRes = await client.query(`
      SELECT b.id 
      FROM public.branch b 
      LEFT JOIN public.branch_inventory bi ON b.id = bi.branch_id 
      WHERE bi.id IS NULL 
      LIMIT 1
    `);
    const testBranchId = emptyBranchRes.rows.length > 0 
      ? emptyBranchRes.rows[0].id 
      : (await client.query(`SELECT id FROM public.branch LIMIT 1`)).rows[0].id;

    // Fetch valid reference product and variant
    const sampleRow = await client.query(`SELECT branch_id, product_id, variant_id FROM public.branch_inventory LIMIT 1`);
    const validBranchId = sampleRow.rows[0].branch_id;
    const validProductId = sampleRow.rows[0].product_id;
    const validVariantId = sampleRow.rows[0].variant_id;
    console.log(`\n  Using valid reference: validProductId=${validProductId}, validVariantId=${validVariantId}, testBranchId=${testBranchId}`);

    // 2. Negative constraint test suite (all inside rollback transaction)
    console.log('\n[2/4] Testing negative constraint enforcement (atomic rollback)...');

    // Test 2A: Negative quantity
    await client.query('BEGIN');
    try {
      await client.query(`
        INSERT INTO public.branch_inventory (id, branch_id, product_id, variant_id, quantity, reserved)
        VALUES ('test_neg_q', $1, $2, $3, -5, 0)
      `, [testBranchId, validProductId, validVariantId]);
      throw new Error('FAIL: Inserting negative quantity was permitted!');
    } catch (e) {
      if (e.message.includes('branch_inventory_quantity_non_negative')) {
        console.log('  ✓ Negative quantity correctly rejected: branch_inventory_quantity_non_negative');
      } else {
        throw e;
      }
    } finally {
      await client.query('ROLLBACK');
    }

    // Test 2B: Negative reserved
    await client.query('BEGIN');
    try {
      await client.query(`
        INSERT INTO public.branch_inventory (id, branch_id, product_id, variant_id, quantity, reserved)
        VALUES ('test_neg_r', $1, $2, $3, 10, -2)
      `, [testBranchId, validProductId, validVariantId]);
      throw new Error('FAIL: Inserting negative reserved was permitted!');
    } catch (e) {
      if (e.message.includes('branch_inventory_reserved_non_negative')) {
        console.log('  ✓ Negative reserved correctly rejected: branch_inventory_reserved_non_negative');
      } else {
        throw e;
      }
    } finally {
      await client.query('ROLLBACK');
    }

    // Test 2C: Invalid foreign product_id
    await client.query('BEGIN');
    try {
      await client.query(`
        INSERT INTO public.branch_inventory (id, branch_id, product_id, variant_id, quantity, reserved)
        VALUES ('test_inv_prod', $1, 'nonexistent_prod_999', $2, 10, 0)
      `, [testBranchId, validVariantId]);
      throw new Error('FAIL: Inserting invalid product_id was permitted!');
    } catch (e) {
      if (e.message.includes('branch_inventory_product_id_foreign')) {
        console.log('  ✓ Invalid product_id correctly rejected: branch_inventory_product_id_foreign');
      } else {
        throw e;
      }
    } finally {
      await client.query('ROLLBACK');
    }

    // Test 2D: Invalid foreign variant_id
    await client.query('BEGIN');
    try {
      await client.query(`
        INSERT INTO public.branch_inventory (id, branch_id, product_id, variant_id, quantity, reserved)
        VALUES ('test_inv_var', $1, $2, 'nonexistent_var_999', 10, 0)
      `, [testBranchId, validProductId]);
      throw new Error('FAIL: Inserting invalid variant_id was permitted!');
    } catch (e) {
      if (e.message.includes('branch_inventory_variant_id_foreign')) {
        console.log('  ✓ Invalid variant_id correctly rejected: branch_inventory_variant_id_foreign');
      } else {
        throw e;
      }
    } finally {
      await client.query('ROLLBACK');
    }

    // Test 2E: ON DELETE RESTRICT on product with inventory
    await client.query('BEGIN');
    try {
      await client.query(`DELETE FROM public.product WHERE id = $1`, [validProductId]);
      throw new Error('FAIL: Hard deleting product with inventory was permitted!');
    } catch (e) {
      if (e.message.includes('branch_inventory_product_id_foreign')) {
        console.log('  ✓ ON DELETE RESTRICT on product with inventory correctly blocked: branch_inventory_product_id_foreign');
      } else {
        throw e;
      }
    } finally {
      await client.query('ROLLBACK');
    }

    // Test 2F: ON DELETE RESTRICT on variant with inventory
    await client.query('BEGIN');
    try {
      await client.query(`DELETE FROM public.product_variant WHERE id = $1`, [validVariantId]);
      throw new Error('FAIL: Hard deleting variant with inventory was permitted!');
    } catch (e) {
      if (e.message.includes('branch_inventory_variant_id_foreign')) {
        console.log('  ✓ ON DELETE RESTRICT on variant with inventory correctly blocked: branch_inventory_variant_id_foreign');
      } else {
        throw e;
      }
    } finally {
      await client.query('ROLLBACK');
    }

    // 3. Test idempotency
    console.log('\n[3/4] Testing migration script idempotency...');
    const { execSync } = require('child_process');
    const out = execSync('node frontend/migrate_phase4f_step3c21_hardening.js', { encoding: 'utf8' });
    if (out.includes('COMPLETED SUCCESSFULLY')) {
      console.log('  ✓ Migration re-run is completely idempotent.');
    } else {
      throw new Error('Migration re-run failed!');
    }

    // 4. Baseline invariants
    console.log('\n[4/4] Verifying all baseline counts remain untouched...');
    const baseline = {
      accounting_account: 98,
      accounting_voucher: 0,
      accounting_journal_entry: 0,
      accounting_fiscal_period: 0,
      purchase: 0,
      purchase_item: 0,
      branch_inventory: 424,
      order: 173,
      payment_transaction: 53,
      inventory_cost_lot: 0,
      inventory_movement: 0,
      inventory_cost_consumption: 0,
    };
    for (const [table, expected] of Object.entries(baseline)) {
      const res = await client.query(`SELECT COUNT(*) as cnt FROM public."${table}"`);
      const cnt = parseInt(res.rows[0].cnt, 10);
      if (cnt !== expected) {
        throw new Error(`INVARIANT MISMATCH in "${table}": got ${cnt}, expected ${expected}`);
      }
    }
    console.log('  ✓ All 12 baseline tables verified intact (424 branch_inventory, 173 orders, 53 payments, 98 accounts).');

    console.log('\n=============================================================================');
    console.log('Phase 4F Step 3C.2.1 Independent Verification: ALL TESTS PASSED ✅');
    console.log('=============================================================================');

  } finally {
    await client.end();
  }
}

verifyStep3c21().catch(err => {
  console.error('Verification failed:', err);
  process.exit(1);
});
