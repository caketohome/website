/**
 * CakeToHome ERP — Phase 4F Step 3C.2.1 Hardening Migration
 * Branch Inventory Referential Integrity & Non-Negativity Hardening
 *
 * Implements:
 * 1. Foreign Key: branch_inventory.product_id -> public.product(id)
 *    ON UPDATE CASCADE ON DELETE RESTRICT
 * 2. Foreign Key: branch_inventory.variant_id -> public.product_variant(id)
 *    ON UPDATE CASCADE ON DELETE RESTRICT
 * 3. Check Constraint: branch_inventory.quantity >= 0
 * 4. Check Constraint: branch_inventory.reserved >= 0
 *
 * SAFETY INVARIANTS:
 * - Transactional BEGIN ... COMMIT with automatic ROLLBACK on any failure.
 * - Zero mutation of historical orders (173), payments (53), or existing stock (424).
 * - Accounting accounts remain 98, start date unconfigured, 0 vouchers, 0 journal entries.
 * - Idempotent execution (safe to re-run).
 */

const fs = require('fs');
const path = require('path');
const { Client } = require('./node_modules/pg');

function getConnectionString() {
  if (process.env.PG_URL) return process.env.PG_URL;
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL;
  const envPath = path.join(__dirname, '../backend/.env');
  const envContent = fs.readFileSync(envPath, 'utf8');
  for (const line of envContent.split('\n')) {
    if (line.startsWith('DATABASE_URL=')) return line.substring('DATABASE_URL='.length).trim();
  }
  throw new Error("No database connection string found in environment or backend/.env");
}

async function runStep3c21Migration() {
  console.log('=============================================================================');
  console.log('CakeToHome ERP — Phase 4F Step 3C.2.1 Hardening Migration');
  console.log('Branch Inventory Referential Integrity & Constraint Hardening');
  console.log('=============================================================================\n');

  const client = new Client({ connectionString: getConnectionString() });
  await client.connect();

  try {
    console.log('[1/5] Recording pre-migration baseline invariants...');

    const expectedBaseline = {
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

    for (const [table, expectedCount] of Object.entries(expectedBaseline)) {
      const res = await client.query(`SELECT COUNT(*) as cnt FROM public."${table}"`);
      const actualCount = parseInt(res.rows[0].cnt, 10);
      if (actualCount !== expectedCount) {
        throw new Error(`PRE-MIGRATION INVARIANT VIOLATION: Table "${table}" count is ${actualCount}, expected ${expectedCount}`);
      }
      console.log(`  ✓ Table "${table}": ${actualCount} rows (expected: ${expectedCount})`);
    }

    const settingRes = await client.query(`SELECT value FROM public.setting WHERE key = 'accounting_start_date'`);
    if (settingRes.rows.length > 0) {
      throw new Error(`PRE-MIGRATION INVARIANT VIOLATION: accounting_start_date is configured, expected UNCONFIGURED`);
    }
    console.log('  ✓ Setting "accounting_start_date": UNCONFIGURED');

    console.log('\n[2/5] Performing pre-migration data validation on branch_inventory...');

    // A. Check for orphan product_id
    const orphanProd = await client.query(`
      SELECT COUNT(*) as cnt
      FROM public.branch_inventory bi
      LEFT JOIN public.product p ON bi.product_id = p.id
      WHERE p.id IS NULL
    `);
    const orphanProdCount = parseInt(orphanProd.rows[0].cnt, 10);
    if (orphanProdCount > 0) {
      throw new Error(`PRE-MIGRATION DATA FAILURE: Found ${orphanProdCount} branch_inventory rows with invalid product_id`);
    }
    console.log('  ✓ 0 orphan product_id rows in branch_inventory');

    // B. Check for orphan variant_id
    const orphanVar = await client.query(`
      SELECT COUNT(*) as cnt
      FROM public.branch_inventory bi
      LEFT JOIN public.product_variant pv ON bi.variant_id = pv.id
      WHERE pv.id IS NULL
    `);
    const orphanVarCount = parseInt(orphanVar.rows[0].cnt, 10);
    if (orphanVarCount > 0) {
      throw new Error(`PRE-MIGRATION DATA FAILURE: Found ${orphanVarCount} branch_inventory rows with invalid variant_id`);
    }
    console.log('  ✓ 0 orphan variant_id rows in branch_inventory');

    // C. Check for bi.product_id vs pv.product_id mismatch
    const mismatch = await client.query(`
      SELECT COUNT(*) as cnt
      FROM public.branch_inventory bi
      JOIN public.product_variant pv ON bi.variant_id = pv.id
      WHERE bi.product_id <> pv.product_id
    `);
    const mismatchCount = parseInt(mismatch.rows[0].cnt, 10);
    if (mismatchCount > 0) {
      throw new Error(`PRE-MIGRATION DATA FAILURE: Found ${mismatchCount} branch_inventory rows where product_id does not match variant.product_id`);
    }
    console.log('  ✓ 0 product_id vs variant.product_id mismatches');

    // D. Check for negative quantity or reserved
    const negCheck = await client.query(`
      SELECT 
        COUNT(*) FILTER (WHERE quantity < 0) as neg_qty,
        COUNT(*) FILTER (WHERE reserved < 0) as neg_res
      FROM public.branch_inventory
    `);
    if (parseInt(negCheck.rows[0].neg_qty, 10) > 0 || parseInt(negCheck.rows[0].neg_res, 10) > 0) {
      throw new Error(`PRE-MIGRATION DATA FAILURE: Found negative quantity or reserved rows in branch_inventory`);
    }
    console.log('  ✓ 0 negative quantity rows, 0 negative reserved rows');

    console.log('\n[3/5] Beginning migration transaction...');
    await client.query('BEGIN');

    // 1. Add Foreign Key branch_inventory.product_id -> product(id)
    console.log('  - Adding foreign key: branch_inventory.product_id -> product(id)...');
    await client.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint 
          WHERE conname = 'branch_inventory_product_id_foreign' 
            AND conrelid = 'public.branch_inventory'::regclass
        ) THEN
          ALTER TABLE public.branch_inventory
            ADD CONSTRAINT branch_inventory_product_id_foreign
            FOREIGN KEY (product_id) REFERENCES public.product(id)
            ON UPDATE CASCADE ON DELETE RESTRICT;
        END IF;
      END $$;
    `);
    console.log('    ✓ branch_inventory_product_id_foreign verified');

    // 2. Add Foreign Key branch_inventory.variant_id -> product_variant(id)
    console.log('  - Adding foreign key: branch_inventory.variant_id -> product_variant(id)...');
    await client.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint 
          WHERE conname = 'branch_inventory_variant_id_foreign' 
            AND conrelid = 'public.branch_inventory'::regclass
        ) THEN
          ALTER TABLE public.branch_inventory
            ADD CONSTRAINT branch_inventory_variant_id_foreign
            FOREIGN KEY (variant_id) REFERENCES public.product_variant(id)
            ON UPDATE CASCADE ON DELETE RESTRICT;
        END IF;
      END $$;
    `);
    console.log('    ✓ branch_inventory_variant_id_foreign verified');

    // 3. Add CHECK constraint: quantity >= 0
    console.log('  - Adding check constraint: quantity >= 0...');
    await client.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint 
          WHERE conname = 'branch_inventory_quantity_non_negative' 
            AND conrelid = 'public.branch_inventory'::regclass
        ) THEN
          ALTER TABLE public.branch_inventory
            ADD CONSTRAINT branch_inventory_quantity_non_negative
            CHECK (quantity >= 0);
        END IF;
      END $$;
    `);
    console.log('    ✓ branch_inventory_quantity_non_negative verified');

    // 4. Add CHECK constraint: reserved >= 0
    console.log('  - Adding check constraint: reserved >= 0...');
    await client.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint 
          WHERE conname = 'branch_inventory_reserved_non_negative' 
            AND conrelid = 'public.branch_inventory'::regclass
        ) THEN
          ALTER TABLE public.branch_inventory
            ADD CONSTRAINT branch_inventory_reserved_non_negative
            CHECK (reserved >= 0);
        END IF;
      END $$;
    `);
    console.log('    ✓ branch_inventory_reserved_non_negative verified');

    // Commit transaction
    await client.query('COMMIT');
    console.log('\n[4/5] Transaction committed successfully.');

    // ─────────────────────────────────────────────────────────────────────────
    // POST-MIGRATION VERIFICATION
    // ─────────────────────────────────────────────────────────────────────────
    console.log('\n[5/5] Performing post-migration verification...');

    // 1. Verify constraints in pg_constraint
    const finalConstraints = await client.query(`
      SELECT conname, contype, pg_get_constraintdef(c.oid) as def
      FROM pg_constraint c
      JOIN pg_class cl ON c.conrelid = cl.oid
      WHERE cl.relname = 'branch_inventory'
      ORDER BY conname
    `);
    console.log('\n  Active constraints on public.branch_inventory:');
    console.table(finalConstraints.rows);

    const conNames = finalConstraints.rows.map(r => r.conname);
    const requiredConstraints = [
      'branch_inventory_product_id_foreign',
      'branch_inventory_variant_id_foreign',
      'branch_inventory_quantity_non_negative',
      'branch_inventory_reserved_non_negative'
    ];

    for (const req of requiredConstraints) {
      if (!conNames.includes(req)) {
        throw new Error(`POST-MIGRATION VERIFICATION FAILURE: Constraint "${req}" missing from branch_inventory`);
      }
    }
    console.log('  ✓ All 4 required constraints present on branch_inventory.');

    // 2. Re-verify baseline counts
    for (const [table, expectedCount] of Object.entries(expectedBaseline)) {
      const res = await client.query(`SELECT COUNT(*) as cnt FROM public."${table}"`);
      const actualCount = parseInt(res.rows[0].cnt, 10);
      if (actualCount !== expectedCount) {
        throw new Error(`POST-MIGRATION INVARIANT VIOLATION: Table "${table}" count mutated to ${actualCount}, expected ${expectedCount}`);
      }
    }
    console.log('  ✓ All baseline table counts verified 100% intact (424 branch_inventory, 173 orders, 53 payments).');

    console.log('\n=============================================================================');
    console.log('Phase 4F Step 3C.2.1 Hardening Migration: COMPLETED SUCCESSFULLY ✅');
    console.log('=============================================================================');

  } catch (err) {
    console.error('\n❌ MIGRATION ERROR:', err.message);
    try {
      await client.query('ROLLBACK');
      console.log('  ↺ Transaction rolled back safely.');
    } catch (rbErr) {
      // rollback error ignore
    }
    process.exit(1);
  } finally {
    await client.end();
  }
}

runStep3c21Migration().catch(err => {
  console.error("Unhandled error:", err);
  process.exit(1);
});
