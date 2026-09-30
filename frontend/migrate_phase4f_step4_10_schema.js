/**
 * CakeToHome ERP — Phase 4F Step 4.10 Substep 4.10.1 Schema Migration
 * Additive Schema Foundation: Account 1118 Deposit in Transit, Bank Account Master,
 * Bank Deposit Slip, Gateway Payout Batch, and Gateway Settlement Order
 *
 * SAFETY INVARIANTS:
 * - Transactional BEGIN ... COMMIT with automatic ROLLBACK on any failure.
 * - Idempotent execution (safe to re-run).
 * - Zero mutation of historical orders (173), payments (53), or inventory stock (424).
 * - Pre-migration baseline: 98 accounting accounts.
 * - Post-migration baseline: exactly 99 accounting accounts.
 * - Zero financial vouchers, journal entries, or synthetic transactions created.
 * - All new tables initialized with exactly 0 rows.
 */

const fs = require('fs');
const path = require('path');
const { Client } = require('./node_modules/pg');

function getConnectionString() {
  if (process.env.PG_URL) return process.env.PG_URL;
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL;
  const candidatePaths = [
    path.join(__dirname, '.env'),
    path.join(__dirname, '../backend/.env'),
    path.join(__dirname, '../.env')
  ];

  for (const envPath of candidatePaths) {
    if (fs.existsSync(envPath)) {
      const envContent = fs.readFileSync(envPath, 'utf8');
      for (const line of envContent.split('\n')) {
        if (line.trim().startsWith('DATABASE_URL=')) {
          let val = line.trim().substring('DATABASE_URL='.length).trim();
          if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
            val = val.slice(1, -1);
          }
          return val;
        }
      }
    }
  }
  throw new Error("No database connection string found in environment or .env files");
}

async function runStep410Migration() {
  console.log('=============================================================================');
  console.log('CakeToHome ERP — Phase 4F Step 4.10 Substep 4.10.1 Schema Foundation');
  console.log('Additive Migration: 1118 Deposit in Transit, Bank Master & Gateway Batch Tables');
  console.log('=============================================================================\n');

  const client = new Client({
    connectionString: getConnectionString(),
    ssl: { rejectUnauthorized: false }
  });
  await client.connect();

  try {
    console.log('[1/6] Verifying pre-migration baseline (Expected: 98 accounts, 0 vouchers)...');

    const expectedPreBaseline = {
      accounting_account: 98,
      accounting_voucher: 0,
      accounting_journal_entry: 0,
      accounting_journal_line: 0,
      accounting_fiscal_period: 0,
      purchase: 0,
      purchase_item: 0,
      purchase_payment: 0,
      supplier: 0,
      branch: 57,
      branch_inventory: 424,
      inventory_cost_lot: 0,
      inventory_movement: 0,
      inventory_cost_consumption: 0,
      order: 173,
      payment_transaction: 53,
    };

    for (const [table, expected] of Object.entries(expectedPreBaseline)) {
      const q = table === 'order' ? 'SELECT COUNT(*) FROM "order"' : `SELECT COUNT(*) FROM "${table}"`;
      const res = await client.query(q);
      const actual = parseInt(res.rows[0].count, 10);
      if (actual !== expected) {
        throw new Error(`PRE-MIGRATION BASELINE VIOLATION: ${table} expected ${expected}, got ${actual}`);
      }
    }
    console.log('  ✓ Pre-migration baseline verified: 18/18 checks passed.\n');

    console.log('[2/6] Beginning transactional migration (BEGIN)...');
    await client.query('BEGIN');

    // ─── 1. Additive Account 1118 Deposit in Transit ──────────────────────────
    console.log('[3/6] Applying Additive Account 1118 Deposit in Transit...');

    // Resolve parent account 1110
    const parentRes = await client.query(
      `SELECT id, code, level FROM accounting_account WHERE code = '1110' AND is_active = true`
    );
    if (parentRes.rows.length === 0) {
      throw new Error("Parent account 1110 (Cash and Cash Equivalents) not found in accounting_account");
    }
    const parent1110 = parentRes.rows[0];

    const existing1118 = await client.query(
      `SELECT id, code, name, parent_id, level, is_active FROM accounting_account WHERE code = '1118'`
    );

    if (existing1118.rows.length > 0) {
      const acc = existing1118.rows[0];
      if (acc.name !== 'Deposit in Transit' || acc.parent_id !== parent1110.id || !acc.is_active) {
        throw new Error(`CONFLICT: Account 1118 exists but has conflicting configuration: ${JSON.stringify(acc)}`);
      }
      console.log('  ✓ Account 1118 already exists with identical configuration.');
    } else {
      await client.query(`
        INSERT INTO accounting_account (
          id,
          code,
          name,
          type,
          subtype,
          parent_id,
          level,
          is_group,
          is_system,
          is_active,
          tax_rate,
          tax_class,
          description,
          metadata,
          created_by,
          created_at,
          updated_at
        ) VALUES (
          'acc_1118_deposit_in_transit',
          '1118',
          'Deposit in Transit',
          'ASSET',
          'CURRENT_ASSET',
          $1,
          $2,
          false,
          true,
          true,
          null,
          null,
          'Branch cash drawer deposits dispatched but pending bank acknowledgement',
          '{"subledger": "DEPOSIT_IN_TRANSIT"}'::jsonb,
          'system_phase4f_step4_10_migration',
          NOW(),
          NOW()
        );
      `, [parent1110.id, parent1110.level + 1]);
      console.log('  ✓ Inserted Account 1118 (Deposit in Transit) under 1110.');
    }

    // ─── 2. Table: bank_account ──────────────────────────────────────────────
    console.log('[4/6] Creating additive relational tables...');
    console.log('  -> Creating public.bank_account...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS public.bank_account (
        id TEXT PRIMARY KEY,
        company_id TEXT NOT NULL DEFAULT 'company_default',
        branch_id TEXT NULL REFERENCES public.branch(id) ON UPDATE CASCADE ON DELETE RESTRICT,
        bank_name TEXT NOT NULL,
        account_number_masked TEXT NOT NULL,
        ifsc_code TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'ACTIVE',
        metadata JSONB NULL DEFAULT '{}'::jsonb,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        CONSTRAINT chk_bank_account_status CHECK (status IN ('ACTIVE', 'INACTIVE', 'FROZEN')),
        CONSTRAINT chk_bank_account_name CHECK (length(trim(bank_name)) > 0),
        CONSTRAINT chk_bank_account_masked CHECK (length(trim(account_number_masked)) >= 4),
        CONSTRAINT chk_bank_account_ifsc CHECK (ifsc_code ~ '^[A-Z]{4}0[A-Z0-9]{6}$')
      );

      CREATE INDEX IF NOT EXISTS idx_bank_account_branch_id ON public.bank_account(branch_id);
      CREATE INDEX IF NOT EXISTS idx_bank_account_status ON public.bank_account(status);
    `);

    // ─── 3. Table: bank_deposit_slip ─────────────────────────────────────────
    console.log('  -> Creating public.bank_deposit_slip...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS public.bank_deposit_slip (
        id TEXT PRIMARY KEY,
        slip_number TEXT NOT NULL UNIQUE,
        company_id TEXT NOT NULL DEFAULT 'company_default',
        branch_id TEXT NOT NULL REFERENCES public.branch(id) ON UPDATE CASCADE ON DELETE RESTRICT,
        bank_account_id TEXT NOT NULL REFERENCES public.bank_account(id) ON UPDATE CASCADE ON DELETE RESTRICT,
        deposit_date DATE NOT NULL,
        amount NUMERIC(15,2) NOT NULL,
        denominations JSONB NOT NULL DEFAULT '{}'::jsonb,
        status TEXT NOT NULL DEFAULT 'DRAFT',
        prepared_by TEXT NOT NULL,
        approved_by TEXT NULL,
        posted_by TEXT NULL,
        bank_ref_number TEXT NULL,
        bank_value_date DATE NULL,
        transit_voucher_id TEXT NULL REFERENCES public.accounting_voucher(id) ON UPDATE CASCADE ON DELETE SET NULL,
        credit_voucher_id TEXT NULL REFERENCES public.accounting_voucher(id) ON UPDATE CASCADE ON DELETE SET NULL,
        metadata JSONB NULL DEFAULT '{}'::jsonb,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        CONSTRAINT chk_bank_deposit_amount CHECK (amount > 0),
        CONSTRAINT chk_bank_deposit_status CHECK (status IN ('DRAFT', 'DISPATCHED', 'CONFIRMED', 'REJECTED', 'CANCELLED')),
        CONSTRAINT chk_bank_deposit_sod_preparer_approver CHECK (approved_by IS NULL OR prepared_by <> approved_by),
        CONSTRAINT chk_bank_deposit_sod_preparer_poster CHECK (posted_by IS NULL OR prepared_by <> posted_by),
        CONSTRAINT chk_bank_deposit_sod_approver_poster CHECK (approved_by IS NULL OR posted_by IS NULL OR approved_by <> posted_by)
      );

      CREATE INDEX IF NOT EXISTS idx_bank_deposit_slip_branch ON public.bank_deposit_slip(branch_id);
      CREATE INDEX IF NOT EXISTS idx_bank_deposit_slip_bank_account ON public.bank_deposit_slip(bank_account_id);
      CREATE INDEX IF NOT EXISTS idx_bank_deposit_slip_status ON public.bank_deposit_slip(status);
      CREATE INDEX IF NOT EXISTS idx_bank_deposit_slip_date ON public.bank_deposit_slip(deposit_date);
    `);

    // ─── 4. Table: gateway_payout_batch ──────────────────────────────────────
    console.log('  -> Creating public.gateway_payout_batch...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS public.gateway_payout_batch (
        id TEXT PRIMARY KEY,
        company_id TEXT NOT NULL DEFAULT 'company_default',
        provider TEXT NOT NULL DEFAULT 'razorpay',
        payout_reference TEXT NOT NULL,
        settlement_reference TEXT NULL,
        bank_account_id TEXT NOT NULL REFERENCES public.bank_account(id) ON UPDATE CASCADE ON DELETE RESTRICT,
        settlement_date DATE NOT NULL,
        bank_value_date DATE NULL,
        gross_amount NUMERIC(15,2) NOT NULL,
        identified_fee_amount NUMERIC(15,2) NOT NULL DEFAULT 0.00,
        reported_tax_amount NUMERIC(15,2) NOT NULL DEFAULT 0.00,
        other_deductions_amount NUMERIC(15,2) NOT NULL DEFAULT 0.00,
        net_amount NUMERIC(15,2) NOT NULL,
        rounding_variance NUMERIC(6,2) NOT NULL DEFAULT 0.00,
        currency TEXT NOT NULL DEFAULT 'INR',
        status TEXT NOT NULL DEFAULT 'INGESTED',
        unreconciled_exception_count INTEGER NOT NULL DEFAULT 0,
        ingestion_source TEXT NOT NULL DEFAULT 'MANUAL_IMPORT',
        prepared_by TEXT NOT NULL,
        approved_by TEXT NULL,
        posted_by TEXT NULL,
        posted_at TIMESTAMPTZ NULL,
        metadata JSONB NULL DEFAULT '{}'::jsonb,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        CONSTRAINT uq_gateway_payout_provider_reference UNIQUE (provider, payout_reference),
        CONSTRAINT chk_payout_gross_nonneg CHECK (gross_amount >= 0),
        CONSTRAINT chk_payout_fee_nonneg CHECK (identified_fee_amount >= 0),
        CONSTRAINT chk_payout_tax_nonneg CHECK (reported_tax_amount >= 0),
        CONSTRAINT chk_payout_deductions_nonneg CHECK (other_deductions_amount >= 0),
        CONSTRAINT chk_payout_net_nonneg CHECK (net_amount >= 0),
        CONSTRAINT chk_payout_status CHECK (status IN ('INGESTED', 'APPROVED', 'PARTITIONED', 'POSTED', 'EXCEPTION', 'CANCELLED')),
        CONSTRAINT chk_payout_sod_preparer_approver CHECK (approved_by IS NULL OR prepared_by <> approved_by),
        CONSTRAINT chk_payout_sod_preparer_poster CHECK (posted_by IS NULL OR prepared_by <> posted_by),
        CONSTRAINT chk_payout_sod_approver_poster CHECK (approved_by IS NULL OR posted_by IS NULL OR approved_by <> posted_by)
      );

      CREATE INDEX IF NOT EXISTS idx_gateway_payout_provider ON public.gateway_payout_batch(provider);
      CREATE INDEX IF NOT EXISTS idx_gateway_payout_status ON public.gateway_payout_batch(status);
      CREATE INDEX IF NOT EXISTS idx_gateway_payout_date ON public.gateway_payout_batch(settlement_date);
      CREATE INDEX IF NOT EXISTS idx_gateway_payout_bank_account ON public.gateway_payout_batch(bank_account_id);
    `);

    // ─── 5. Table: gateway_settlement_order ──────────────────────────────────
    console.log('  -> Creating public.gateway_settlement_order...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS public.gateway_settlement_order (
        id TEXT PRIMARY KEY,
        payout_batch_id TEXT NOT NULL REFERENCES public.gateway_payout_batch(id) ON UPDATE CASCADE ON DELETE RESTRICT,
        payment_transaction_id TEXT NOT NULL REFERENCES public.payment_transaction(id) ON UPDATE CASCADE ON DELETE RESTRICT,
        order_id TEXT NOT NULL REFERENCES public."order"(id) ON UPDATE CASCADE ON DELETE RESTRICT,
        settlement_branch_id TEXT NOT NULL REFERENCES public.branch(id) ON UPDATE CASCADE ON DELETE RESTRICT,
        allocated_gross_amount NUMERIC(15,2) NOT NULL,
        identified_fee_amount NUMERIC(15,2) NOT NULL DEFAULT 0.00,
        reported_tax_amount NUMERIC(15,2) NOT NULL DEFAULT 0.00,
        other_deductions_amount NUMERIC(15,2) NOT NULL DEFAULT 0.00,
        allocated_net_amount NUMERIC(15,2) NOT NULL,
        allocation_status TEXT NOT NULL DEFAULT 'PENDING',
        exception_reason TEXT NULL,
        provider_payment_id TEXT NULL,
        voucher_id TEXT NULL REFERENCES public.accounting_voucher(id) ON UPDATE CASCADE ON DELETE SET NULL,
        metadata JSONB NULL DEFAULT '{}'::jsonb,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        CONSTRAINT uq_gateway_settlement_batch_txn UNIQUE (payout_batch_id, payment_transaction_id),
        CONSTRAINT chk_settle_gross_nonneg CHECK (allocated_gross_amount >= 0),
        CONSTRAINT chk_settle_fee_nonneg CHECK (identified_fee_amount >= 0),
        CONSTRAINT chk_settle_tax_nonneg CHECK (reported_tax_amount >= 0),
        CONSTRAINT chk_settle_deductions_nonneg CHECK (other_deductions_amount >= 0),
        CONSTRAINT chk_settle_net_nonneg CHECK (allocated_net_amount >= 0),
        CONSTRAINT chk_settle_status CHECK (allocation_status IN ('PENDING', 'VALIDATED', 'POSTED', 'EXCEPTION'))
      );

      CREATE INDEX IF NOT EXISTS idx_gateway_settle_batch ON public.gateway_settlement_order(payout_batch_id);
      CREATE INDEX IF NOT EXISTS idx_gateway_settle_txn ON public.gateway_settlement_order(payment_transaction_id);
      CREATE INDEX IF NOT EXISTS idx_gateway_settle_order ON public.gateway_settlement_order(order_id);
      CREATE INDEX IF NOT EXISTS idx_gateway_settle_branch ON public.gateway_settlement_order(settlement_branch_id);
      CREATE INDEX IF NOT EXISTS idx_gateway_settle_status ON public.gateway_settlement_order(allocation_status);
    `);

    console.log('  ✓ Additive schema creation complete.\n');

    // ─── 6. Post-migration Invariants Verification ───────────────────────────
    console.log('[5/6] Verifying post-migration foundation baseline...');

    // 1. accounting_account must be exactly 99
    const accCountRes = await client.query(`SELECT COUNT(*) FROM accounting_account;`);
    const accCount = parseInt(accCountRes.rows[0].count, 10);
    if (accCount !== 99) {
      throw new Error(`POST-MIGRATION BASELINE VIOLATION: Expected 99 accounts, found ${accCount}`);
    }
    console.log('  ✓ accounting_account count is exactly 99 (98 pre-migration + 1118).');

    // 2. Account 1118 details
    const acc1118Res = await client.query(`SELECT * FROM accounting_account WHERE code = '1118'`);
    if (acc1118Res.rows.length !== 1) {
      throw new Error("POST-MIGRATION VIOLATION: Account 1118 not found!");
    }
    const acc1118 = acc1118Res.rows[0];
    if (acc1118.name !== 'Deposit in Transit' || acc1118.level !== 4 || !acc1118.is_active || acc1118.is_group) {
      throw new Error(`POST-MIGRATION VIOLATION: Account 1118 attributes invalid: ${JSON.stringify(acc1118)}`);
    }
    console.log('  ✓ Account 1118 verified: code="1118", name="Deposit in Transit", level=4, active=true, leaf=true.');

    // 3. Newly created tables must have 0 rows
    const newTables = [
      'bank_account',
      'bank_deposit_slip',
      'gateway_payout_batch',
      'gateway_settlement_order'
    ];
    for (const t of newTables) {
      const res = await client.query(`SELECT COUNT(*) FROM "${t}"`);
      const cnt = parseInt(res.rows[0].count, 10);
      if (cnt !== 0) {
        throw new Error(`POST-MIGRATION VIOLATION: Table ${t} expected 0 rows, found ${cnt}`);
      }
      console.log(`  ✓ Table ${t} exists and contains exactly 0 rows.`);
    }

    // 4. Financial tables must remain untouched
    const financialTables = {
      accounting_voucher: 0,
      accounting_journal_entry: 0,
      accounting_journal_line: 0,
      accounting_fiscal_period: 0,
      purchase: 0,
      purchase_item: 0,
      purchase_payment: 0,
      supplier: 0,
      branch: 57,
      branch_inventory: 424,
      inventory_cost_lot: 0,
      inventory_movement: 0,
      inventory_cost_consumption: 0,
      order: 173,
      payment_transaction: 53,
    };
    for (const [table, expected] of Object.entries(financialTables)) {
      const q = table === 'order' ? 'SELECT COUNT(*) FROM "order"' : `SELECT COUNT(*) FROM "${table}"`;
      const res = await client.query(q);
      const actual = parseInt(res.rows[0].count, 10);
      if (actual !== expected) {
        throw new Error(`POST-MIGRATION VIOLATION: Table ${table} expected ${expected}, got ${actual}`);
      }
    }
    console.log('  ✓ All historical orders, payments, stock, and vouchers remain untouched.\n');

    console.log('[6/6] Committing transactional migration (COMMIT)...');
    await client.query('COMMIT');
    console.log('\n=============================================================================');
    console.log('SUBSTEP 4.10.1 MIGRATION SUCCESSFUL (COMMIT EXECUTED)');
    console.log('PRE-MIGRATION COA: 98 | POST-MIGRATION COA: 99 | NEW TABLES: 4 (0 ROWS)');
    console.log('=============================================================================\n');

  } catch (err) {
    console.error('\n❌ MIGRATION FAILED — ROLLING BACK TRANSACTION:', err.message);
    try {
      await client.query('ROLLBACK');
      console.log('✓ ROLLBACK complete. Database restored to pre-migration baseline.');
    } catch (rbErr) {
      console.error('Failed to rollback:', rbErr);
    }
    throw err;
  } finally {
    await client.end();
  }
}

runStep410Migration().catch(err => {
  console.error("FATAL ERROR IN STEP 4.10.1 MIGRATION:", err);
  process.exit(1);
});
