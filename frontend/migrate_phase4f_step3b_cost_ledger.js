/**
 * CakeToHome ERP — Phase 4F Step 3B Migration
 * Inventory Cost Ledger (`public.inventory_cost_lot`) + CoA Semantic Alignment
 *
 * Invariants Enforced:
 * 1. Transactional safety: All DDL and DML operations execute within BEGIN ... COMMIT.
 * 2. Pre-migration & Post-migration assertion gates:
 *    - accounting_account = 98
 *    - accounting_voucher = 0
 *    - accounting_journal_entry = 0
 *    - accounting_journal_line = 0
 *    - accounting_fiscal_period = 0
 *    - purchase = 0
 *    - purchase_item = 0
 *    - purchase_payment = 0
 *    - branch_inventory = 424
 *    - order = 173
 *    - payment_transaction = 53
 *    - setting (accounting_start_date) = 0
 *    - inventory_cost_lot = 0
 * 3. Semantic CoA correction:
 *    - Account 1132: 'Bakery Raw Materials & Ingredients' -> 'Merchandise Inventory - Cakes'
 *    - Account 5110: 'Raw Material Consumption / Bakery Ingredients' -> 'COGS - Cakes'
 *    - Codes, types, subtypes, levels, parents, and balances remain unchanged.
 * 4. Authoritative purchase-lot schema:
 *    - High-precision NUMERIC for quantities and financial values.
 *    - Strict CHECK constraints preventing negative costs, quantities, or over-consumption.
 *    - Zero synthetic stock created.
 *    - Zero historical cost fabrication.
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

async function runStep3bMigration() {
  console.log('=============================================================================');
  console.log('CakeToHome ERP — Phase 4F Step 3B Migration');
  console.log('Inventory Cost Ledger + CoA Semantic Migration');
  console.log('=============================================================================\n');

  const client = new Client({ connectionString: getConnectionString() });
  await client.connect();

  try {
    console.log('[1/5] Recording pre-migration counts and verifying baseline invariants...');

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
      payment_transaction: 53
    };

    for (const [table, expectedCount] of Object.entries(expectedBaseline)) {
      const res = await client.query(`SELECT COUNT(*) as cnt FROM public."${table}"`);
      const actualCount = parseInt(res.rows[0].cnt, 10);
      if (actualCount !== expectedCount) {
        throw new Error(`PRE-MIGRATION INVARIANT VIOLATION: Table "${table}" count is ${actualCount}, expected ${expectedCount}`);
      }
      console.log(`  ✓ Table "${table}": ${actualCount} rows (expected: ${expectedCount})`);
    }

    // Verify accounting_start_date is unconfigured
    const settingRes = await client.query(`SELECT value FROM public.setting WHERE key = 'accounting_start_date'`);
    if (settingRes.rows.length > 0) {
      throw new Error(`PRE-MIGRATION INVARIANT VIOLATION: accounting_start_date is configured (${settingRes.rows[0].value}), expected UNCONFIGURED`);
    }
    console.log('  ✓ Setting "accounting_start_date": UNCONFIGURED');

    // Verify current names of 1132 and 5110 before update
    const acct1132 = await client.query(`SELECT code, name, is_group FROM public.accounting_account WHERE code = '1132'`);
    const acct5110 = await client.query(`SELECT code, name, is_group FROM public.accounting_account WHERE code = '5110'`);

    if (acct1132.rows.length !== 1 || acct5110.rows.length !== 1) {
      throw new Error('PRE-MIGRATION ERROR: Target accounts 1132 or 5110 not found in database');
    }

    console.log(`  ✓ Account 1132 current: "${acct1132.rows[0].name}"`);
    console.log(`  ✓ Account 5110 current: "${acct5110.rows[0].name}"`);

    console.log('\n[2/5] Beginning database transaction...');
    await client.query('BEGIN');

    // ─────────────────────────────────────────────────────────────────────────────
    // STEP A: Chart of Accounts Semantic Renaming
    // ─────────────────────────────────────────────────────────────────────────────
    console.log('\n[3/5] Executing Chart of Accounts semantic correction...');

    const update1132 = await client.query(`
      UPDATE public.accounting_account
      SET name = 'Merchandise Inventory - Cakes',
          description = 'Authoritative balance sheet asset account for physically held cake merchandise purchased from commercial bakeries for resale.',
          updated_at = NOW()
      WHERE code = '1132' AND is_group = false
      RETURNING id, code, name;
    `);
    if (update1132.rowCount !== 1) {
      throw new Error(`Failed to update account 1132: rowCount was ${update1132.rowCount}`);
    }
    console.log(`  ✓ Account 1132 renamed to: "${update1132.rows[0].name}"`);

    const update5110 = await client.query(`
      UPDATE public.accounting_account
      SET name = 'COGS - Cakes',
          description = 'Cost of Goods Sold recognized upon fulfillment of purchased cake merchandise to customers.',
          updated_at = NOW()
      WHERE code = '5110' AND is_group = false
      RETURNING id, code, name;
    `);
    if (update5110.rowCount !== 1) {
      throw new Error(`Failed to update account 5110: rowCount was ${update5110.rowCount}`);
    }
    console.log(`  ✓ Account 5110 renamed to: "${update5110.rows[0].name}"`);

    // ─────────────────────────────────────────────────────────────────────────────
    // STEP B: Create Inventory Cost Lot Table & Indexes
    // ─────────────────────────────────────────────────────────────────────────────
    console.log('\n[4/5] Creating table "public.inventory_cost_lot" and indexes...');

    await client.query(`
      CREATE TABLE IF NOT EXISTS public.inventory_cost_lot (
        id                  TEXT            PRIMARY KEY DEFAULT gen_random_uuid()::text,
        branch_id           TEXT            NOT NULL REFERENCES public.branch(id) ON DELETE RESTRICT,
        product_id          TEXT            NULL REFERENCES public.product(id) ON DELETE RESTRICT,
        variant_id          TEXT            NULL REFERENCES public.product_variant(id) ON DELETE RESTRICT,
        item_type           TEXT            NOT NULL CHECK (item_type IN ('CAKE', 'ACCESSORY', 'PACKAGING')),
        purchase_id         TEXT            NOT NULL REFERENCES public.purchase(id) ON DELETE RESTRICT,
        purchase_item_id    TEXT            NOT NULL REFERENCES public.purchase_item(id) ON DELETE RESTRICT,
        supplier_id         TEXT            NOT NULL REFERENCES public.supplier(id) ON DELETE RESTRICT,
        received_quantity   NUMERIC(12, 3)  NOT NULL CHECK (received_quantity > 0),
        remaining_quantity  NUMERIC(12, 3)  NOT NULL CHECK (remaining_quantity >= 0),
        unit_cost           NUMERIC(14, 4)  NOT NULL CHECK (unit_cost >= 0),
        total_cost          NUMERIC(14, 2)  NOT NULL CHECK (total_cost >= 0),
        currency            VARCHAR(3)      NOT NULL DEFAULT 'INR',
        received_at         DATE            NOT NULL,
        status              TEXT            NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'DEPLETED', 'REVERSED')),
        reversal_of_lot_id  TEXT            NULL REFERENCES public.inventory_cost_lot(id) ON DELETE RESTRICT,
        reversed_by_lot_id  TEXT            NULL REFERENCES public.inventory_cost_lot(id) ON DELETE RESTRICT,
        created_by          TEXT            NOT NULL DEFAULT 'SYSTEM',
        created_at          TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
        updated_at          TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
        CONSTRAINT chk_cost_lot_qty_bound CHECK (remaining_quantity <= received_quantity),
        CONSTRAINT chk_cost_lot_reversal_limit CHECK (reversal_of_lot_id IS NULL OR reversed_by_lot_id IS NULL)
      );
    `);
    console.log('  ✓ Table "public.inventory_cost_lot" created / verified.');

    // Partial index for fast FIFO lot resolution on active lots with available quantity
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_inventory_cost_lot_fifo 
      ON public.inventory_cost_lot (branch_id, variant_id, received_at ASC, created_at ASC)
      WHERE (status = 'ACTIVE' AND remaining_quantity > 0);
    `);
    console.log('  ✓ Index "idx_inventory_cost_lot_fifo" created.');

    // Traceability indexes
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_inventory_cost_lot_purchase
      ON public.inventory_cost_lot (purchase_id);
    `);
    console.log('  ✓ Index "idx_inventory_cost_lot_purchase" created.');

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_inventory_cost_lot_purchase_item
      ON public.inventory_cost_lot (purchase_item_id);
    `);
    console.log('  ✓ Index "idx_inventory_cost_lot_purchase_item" created.');

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_inventory_cost_lot_branch
      ON public.inventory_cost_lot (branch_id);
    `);
    console.log('  ✓ Index "idx_inventory_cost_lot_branch" created.');

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_inventory_cost_lot_supplier
      ON public.inventory_cost_lot (supplier_id);
    `);
    console.log('  ✓ Index "idx_inventory_cost_lot_supplier" created.');

    // Commit transaction
    await client.query('COMMIT');
    console.log('\n[5/5] Transaction committed successfully.');

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
      inventory_cost_lot: 0
    };

    for (const [table, expectedCount] of Object.entries(expectedPost)) {
      const res = await client.query(`SELECT COUNT(*) as cnt FROM public."${table}"`);
      const actualCount = parseInt(res.rows[0].cnt, 10);
      if (actualCount !== expectedCount) {
        throw new Error(`POST-MIGRATION INVARIANT VIOLATION: Table "${table}" count is ${actualCount}, expected ${expectedCount}`);
      }
      console.log(`  ✓ Table "${table}": ${actualCount} rows (expected: ${expectedCount})`);
    }

    // Verify renamed account names
    const check1132 = await client.query(`SELECT code, name, description FROM public.accounting_account WHERE code = '1132'`);
    const check5110 = await client.query(`SELECT code, name, description FROM public.accounting_account WHERE code = '5110'`);

    if (check1132.rows[0].name !== 'Merchandise Inventory - Cakes') {
      throw new Error(`Account 1132 name is "${check1132.rows[0].name}", expected "Merchandise Inventory - Cakes"`);
    }
    if (check5110.rows[0].name !== 'COGS - Cakes') {
      throw new Error(`Account 5110 name is "${check5110.rows[0].name}", expected "COGS - Cakes"`);
    }
    console.log(`  ✓ Verified 1132 name: "${check1132.rows[0].name}"`);
    console.log(`  ✓ Verified 5110 name: "${check5110.rows[0].name}"`);

    // Verify schema of inventory_cost_lot
    const cols = await client.query(`
      SELECT column_name, data_type, udt_name, is_nullable
      FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'inventory_cost_lot'
      ORDER BY ordinal_position
    `);
    console.log(`  ✓ Table "inventory_cost_lot" schema has ${cols.rows.length} columns:`);
    for (const c of cols.rows) {
      console.log(`      - ${c.column_name}: ${c.udt_name} (nullable: ${c.is_nullable})`);
    }

    console.log('\n=============================================================================');
    console.log('PHASE 4F STEP 3B MIGRATION PASSED ALL INVARIANTS ✅');
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

runStep3bMigration();
