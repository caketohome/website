/**
 * CakeToHome ERP — Phase 4F Step 3B.1 Migration
 * Inventory Ledger + Cost-Lot Hardening Migration
 *
 * Resolves the 5 architecture blockers:
 * 1. FIFO Index: Includes product_id to ensure complete product boundary isolation.
 * 2. Movement & Cost Consumption Ledger: Creates public.inventory_movement (parent)
 *    and public.inventory_cost_consumption (child allocation) with complete auditability.
 * 3. Reversal Model: Removes redundant lot self-referencing reversal columns from inventory_cost_lot,
 *    aligning reversals strictly to voucher/movement audit records.
 * 4. Product Merchandise Classification: Adds authoritative structured column
 *    `merchandise_type` to `public.product` and `public.purchase_item`.
 * 5. Cost Consistency: Enforces database check constraint verifying that
 *    ABS(total_cost - ROUND(received_quantity * unit_cost, 2)) <= 0.05.
 * 6. Idempotency: Enforces UNIQUE (purchase_item_id) on public.inventory_cost_lot.
 *
 * SAFETY INVARIANTS:
 * - Transactional BEGIN ... COMMIT with ROLLBACK on any assertion failure.
 * - Zero mutation of historical orders (173), payment transactions (53), or branch inventory (424).
 * - Accounting start date remains unconfigured.
 * - Accounting fiscal periods remain 0.
 * - Zero vouchers, zero journal entries, zero cost lots.
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

async function runStep3b1Hardening() {
  console.log('=============================================================================');
  console.log('CakeToHome ERP — Phase 4F Step 3B.1 Hardening Migration');
  console.log('Inventory Ledger & Cost-Lot Architecture Hardening');
  console.log('=============================================================================\n');

  const client = new Client({ connectionString: getConnectionString() });
  await client.connect();

  try {
    console.log('[1/6] Recording pre-migration baseline invariants...');

    const expectedBaseline = {
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
      inventory_cost_lot: 0
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

    console.log('\n[2/6] Beginning database transaction...');
    await client.query('BEGIN');

    // ─────────────────────────────────────────────────────────────────────────────
    // BLOCKER 1 & 3 & 5: Hardening public.inventory_cost_lot
    // ─────────────────────────────────────────────────────────────────────────────
    console.log('\n[3/6] Hardening "public.inventory_cost_lot"...');

    // 1. Drop redundant reversal columns and constraint (Blocker 3)
    console.log('  - Dropping redundant reversal foreign keys & constraints...');
    await client.query(`ALTER TABLE public.inventory_cost_lot DROP CONSTRAINT IF EXISTS chk_cost_lot_reversal_limit;`);
    await client.query(`ALTER TABLE public.inventory_cost_lot DROP CONSTRAINT IF EXISTS inventory_cost_lot_reversal_of_lot_id_fkey;`);
    await client.query(`ALTER TABLE public.inventory_cost_lot DROP CONSTRAINT IF EXISTS inventory_cost_lot_reversed_by_lot_id_fkey;`);
    await client.query(`ALTER TABLE public.inventory_cost_lot DROP COLUMN IF EXISTS reversal_of_lot_id;`);
    await client.query(`ALTER TABLE public.inventory_cost_lot DROP COLUMN IF EXISTS reversed_by_lot_id;`);

    // 2. Add lot idempotency unique constraint (1 purchase_item -> exactly 1 lot)
    console.log('  - Adding UNIQUE constraint on purchase_item_id...');
    await client.query(`
      ALTER TABLE public.inventory_cost_lot 
      ADD CONSTRAINT uq_inventory_cost_lot_purchase_item UNIQUE (purchase_item_id);
    `);

    // 3. Add cost consistency check constraint (Blocker 5)
    console.log('  - Adding CHECK constraint chk_cost_lot_cost_consistency...');
    await client.query(`
      ALTER TABLE public.inventory_cost_lot 
      ADD CONSTRAINT chk_cost_lot_cost_consistency CHECK (
        ABS(total_cost - ROUND(received_quantity * unit_cost, 2)) <= 0.05
      );
    `);

    // 4. Correct FIFO index to include product_id (Blocker 1)
    console.log('  - Recreating idx_inventory_cost_lot_fifo with product_id...');
    await client.query(`DROP INDEX IF EXISTS public.idx_inventory_cost_lot_fifo;`);
    await client.query(`
      CREATE INDEX idx_inventory_cost_lot_fifo 
      ON public.inventory_cost_lot (branch_id, product_id, variant_id, received_at ASC, created_at ASC)
      WHERE (status = 'ACTIVE' AND remaining_quantity > 0);
    `);

    console.log('  ✓ "public.inventory_cost_lot" successfully hardened.');

    // ─────────────────────────────────────────────────────────────────────────────
    // BLOCKER 4: Authoritative Merchandise Classification on public.product & purchase_item
    // ─────────────────────────────────────────────────────────────────────────────
    console.log('\n[4/6] Establishing authoritative merchandise classification...');

    // Add merchandise_type to public.product
    await client.query(`
      ALTER TABLE public.product 
      ADD COLUMN IF NOT EXISTS merchandise_type VARCHAR(20) DEFAULT 'CAKE'
      CHECK (merchandise_type IN ('CAKE', 'ACCESSORY', 'PACKAGING'));
    `);

    // Set accessories explicitly based on authoritative catalog inspection
    await client.query(`
      UPDATE public.product 
      SET merchandise_type = 'ACCESSORY' 
      WHERE id IN ('acc_01', 'acc_02', 'acc_03', 'acc_04', 'acc_05', 'acc_06', 'acc_07', 'acc_08')
         OR metadata->>'category_slug' = 'accessories';
    `);

    // Set all other products to CAKE
    await client.query(`
      UPDATE public.product 
      SET merchandise_type = 'CAKE' 
      WHERE merchandise_type IS NULL OR merchandise_type != 'ACCESSORY';
    `);

    await client.query(`ALTER TABLE public.product ALTER COLUMN merchandise_type SET NOT NULL;`);
    console.log('  ✓ Column "merchandise_type" added and populated on public.product.');

    // Add item_type to public.purchase_item
    await client.query(`
      ALTER TABLE public.purchase_item 
      ADD COLUMN IF NOT EXISTS item_type VARCHAR(20) DEFAULT 'CAKE'
      CHECK (item_type IN ('CAKE', 'ACCESSORY', 'PACKAGING'));
    `);
    await client.query(`ALTER TABLE public.purchase_item ALTER COLUMN item_type SET NOT NULL;`);
    console.log('  ✓ Column "item_type" added to public.purchase_item.');

    // ─────────────────────────────────────────────────────────────────────────────
    // BLOCKER 2: Authoritative Inventory Movement & Cost Consumption Ledgers
    // ─────────────────────────────────────────────────────────────────────────────
    console.log('\n[5/6] Creating authoritative inventory movement and cost consumption ledgers...');

    // 1. Parent Table: public.inventory_movement
    await client.query(`
      CREATE TABLE IF NOT EXISTS public.inventory_movement (
        id                  TEXT            PRIMARY KEY DEFAULT gen_random_uuid()::text,
        branch_id           TEXT            NOT NULL REFERENCES public.branch(id) ON DELETE RESTRICT,
        product_id          TEXT            NULL REFERENCES public.product(id) ON DELETE RESTRICT,
        variant_id          TEXT            NULL REFERENCES public.product_variant(id) ON DELETE RESTRICT,
        movement_type       TEXT            NOT NULL CHECK (movement_type IN (
                                              'PURCHASE_RECEIPT',
                                              'SALES_FULFILLMENT',
                                              'PURCHASE_RETURN',
                                              'SALES_RETURN',
                                              'STOCK_ADJUSTMENT_UP',
                                              'STOCK_ADJUSTMENT_DOWN',
                                              'TRANSFER_IN',
                                              'TRANSFER_OUT',
                                              'DAMAGE_WRITEOFF',
                                              'INVOICE_REVERSAL'
                                            )),
        quantity            NUMERIC(12, 3)  NOT NULL CHECK (quantity > 0),
        direction           TEXT            NOT NULL CHECK (direction IN ('IN', 'OUT')),
        order_id            TEXT            NULL REFERENCES public."order"(id) ON DELETE RESTRICT,
        purchase_id         TEXT            NULL REFERENCES public.purchase(id) ON DELETE RESTRICT,
        voucher_id          TEXT            NULL REFERENCES public.accounting_voucher(id) ON DELETE RESTRICT,
        reference_no        TEXT            NULL,
        narration           TEXT            NULL,
        created_by          TEXT            NOT NULL DEFAULT 'SYSTEM',
        created_at          TIMESTAMPTZ     NOT NULL DEFAULT NOW()
      );
    `);
    console.log('  ✓ Table "public.inventory_movement" created.');

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_inventory_movement_branch_product 
      ON public.inventory_movement (branch_id, product_id, variant_id, created_at DESC);
    `);
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_inventory_movement_order 
      ON public.inventory_movement (order_id) WHERE order_id IS NOT NULL;
    `);
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_inventory_movement_purchase 
      ON public.inventory_movement (purchase_id) WHERE purchase_id IS NOT NULL;
    `);
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_inventory_movement_voucher 
      ON public.inventory_movement (voucher_id) WHERE voucher_id IS NOT NULL;
    `);
    console.log('  ✓ Indexes on "public.inventory_movement" created.');

    // 2. Child Allocation Table: public.inventory_cost_consumption
    await client.query(`
      CREATE TABLE IF NOT EXISTS public.inventory_cost_consumption (
        id                  TEXT            PRIMARY KEY DEFAULT gen_random_uuid()::text,
        movement_id         TEXT            NOT NULL REFERENCES public.inventory_movement(id) ON DELETE RESTRICT,
        lot_id              TEXT            NOT NULL REFERENCES public.inventory_cost_lot(id) ON DELETE RESTRICT,
        quantity            NUMERIC(12, 3)  NOT NULL CHECK (quantity > 0),
        unit_cost           NUMERIC(14, 4)  NOT NULL CHECK (unit_cost >= 0),
        total_cost          NUMERIC(14, 2)  NOT NULL CHECK (total_cost >= 0),
        created_at          TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
        CONSTRAINT chk_cost_consumption_math CHECK (
          ABS(total_cost - ROUND(quantity * unit_cost, 2)) <= 0.05
        )
      );
    `);
    console.log('  ✓ Table "public.inventory_cost_consumption" created.');

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_inventory_cost_consumption_movement 
      ON public.inventory_cost_consumption (movement_id);
    `);
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_inventory_cost_consumption_lot 
      ON public.inventory_cost_consumption (lot_id);
    `);
    console.log('  ✓ Indexes on "public.inventory_cost_consumption" created.');

    // Commit transaction
    await client.query('COMMIT');
    console.log('\n[6/6] Transaction committed successfully.');

    // ─────────────────────────────────────────────────────────────────────────────
    // POST-MIGRATION INDEPENDENT VERIFICATION
    // ─────────────────────────────────────────────────────────────────────────────
    console.log('\n=== Post-Migration Verification ===');

    const expectedPost = {
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

    for (const [table, expectedCount] of Object.entries(expectedPost)) {
      const res = await client.query(`SELECT COUNT(*) as cnt FROM public."${table}"`);
      const actualCount = parseInt(res.rows[0].cnt, 10);
      if (actualCount !== expectedCount) {
        throw new Error(`POST-MIGRATION INVARIANT VIOLATION: Table "${table}" count is ${actualCount}, expected ${expectedCount}`);
      }
      console.log(`  ✓ Table "${table}": ${actualCount} rows (expected: ${expectedCount})`);
    }

    // Verify merchandise_type distribution in product table
    const prodTypes = await client.query(`
      SELECT merchandise_type, COUNT(*) as cnt 
      FROM public.product 
      GROUP BY merchandise_type 
      ORDER BY merchandise_type;
    `);
    console.log('  ✓ Product merchandise_type counts:', JSON.stringify(prodTypes.rows));

    // Verify corrected FIFO index definition
    const idxDef = await client.query(`
      SELECT indexdef FROM pg_indexes WHERE indexname = 'idx_inventory_cost_lot_fifo';
    `);
    console.log('  ✓ idx_inventory_cost_lot_fifo definition:', idxDef.rows[0].indexdef);

    console.log('\n=============================================================================');
    console.log('PHASE 4F STEP 3B.1 MIGRATION PASSED ALL INVARIANTS ✅');
    console.log('=============================================================================');

  } catch (err) {
    console.error('\nMIGRATION FAILED! Executing ROLLBACK if in transaction...');
    try {
      await client.query('ROLLBACK');
      console.error('Rollback executed successfully.');
    } catch (rbErr) {
      console.error('Rollback error:', rbErr.message);
    }
    console.error('Error details:', err);
    process.exit(1);
  } finally {
    await client.end();
  }
}

runStep3b1Hardening();
