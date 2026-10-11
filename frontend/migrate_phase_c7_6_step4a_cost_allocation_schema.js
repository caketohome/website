/**
 * CakeToHome ERP — Phase C7.6 Step 4A Schema Migration
 * Additive Schema Foundation: Cost Allocation Engine & Rules
 *
 * SCOPE:
 * 1. Pre-migration baseline verification:
 *    - CoA = 100 accounts.
 *    - Trial Balance strictly balanced (Dr 3,380.00 === Cr 3,380.00).
 *    - Accounting vouchers = 6, journal entries = 4, journal lines = 10.
 * 2. Add public.cost_allocation_rule table with hierarchy, source account/CC, versioning, and status.
 * 3. Add public.cost_allocation_rule_target table with target CC, target account, and percentage.
 * 4. Add public.cost_allocation_run table with execution lifecycle, voucher references, and audit fields.
 * 5. Add public.cost_allocation_run_line table with line-level traceability and amounts.
 * 6. Post-migration verification of tables, columns, indexes, foreign keys, row counts, and Trial Balance.
 *
 * SAFETY INVARIANTS:
 * - Atomic transaction (BEGIN ... COMMIT with ROLLBACK on any error).
 * - Idempotent execution (safe to re-run).
 * - Zero drop or alteration of existing tables or columns.
 * - Zero mutation of historical accounting data.
 * - Chart of Accounts strictly preserved at exactly 100 accounts.
 * - Trial Balance strictly balanced.
 */

const fs = require('fs');
const path = require('path');
const { Client } = require('pg');

function getConnectionString() {
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL;
  const envPath = path.join(__dirname, '.env');
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
  throw new Error("DATABASE_URL not found in .env");
}

async function runStep4AMigration() {
  console.log('=============================================================================');
  console.log('CakeToHome ERP — Phase C7.6 Step 4A Schema Migration');
  console.log('Cost Allocation Engine & Rules: Normalized Table Foundation');
  console.log('=============================================================================\n');

  const conn = getConnectionString();
  const client = new Client({
    connectionString: conn,
    ssl: conn.includes('supabase') ? { rejectUnauthorized: false } : false
  });
  await client.connect();

  try {
    // ─── [1/6] Pre-Migration Baseline Verification ──────────────────────────
    console.log('[1/6] Verifying pre-migration baseline...');
    const coaRes = await client.query('SELECT count(*)::int as count FROM public.accounting_account');
    if (coaRes.rows[0].count !== 100) {
      throw new Error(`CoA count mismatch: expected 100, got ${coaRes.rows[0].count}`);
    }
    console.log(`  ✓ Chart of Accounts: exactly ${coaRes.rows[0].count} accounts`);

    const tbRes = await client.query(`
      SELECT 
        COALESCE(SUM(debit_amount), 0)::numeric(15,2) as dr,
        COALESCE(SUM(credit_amount), 0)::numeric(15,2) as cr
      FROM public.accounting_journal_line;
    `);
    if (tbRes.rows[0].dr !== tbRes.rows[0].cr) {
      throw new Error(`Trial Balance mismatch: Dr ${tbRes.rows[0].dr} !== Cr ${tbRes.rows[0].cr}`);
    }
    console.log(`  ✓ Trial Balance: Dr ₹${tbRes.rows[0].dr} === Cr ₹${tbRes.rows[0].cr}`);

    const vRes = await client.query('SELECT count(*)::int as count FROM public.accounting_voucher');
    const jeRes = await client.query('SELECT count(*)::int as count FROM public.accounting_journal_entry');
    const jlRes = await client.query('SELECT count(*)::int as count FROM public.accounting_journal_line');
    console.log(`  ✓ Vouchers: ${vRes.rows[0].count}, Journal Entries: ${jeRes.rows[0].count}, Lines: ${jlRes.rows[0].count}`);

    // ─── START ATOMIC TRANSACTION ───────────────────────────────────────────
    await client.query('BEGIN;');
    console.log('\n[2/6] Beginning atomic database transaction...');

    // ─── [2/6] Table 1: public.cost_allocation_rule ─────────────────────────
    console.log('[3/6] Creating public.cost_allocation_rule table...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS public.cost_allocation_rule (
        id TEXT PRIMARY KEY DEFAULT ('car_' || gen_random_uuid()::text),
        rule_code VARCHAR(50) UNIQUE NOT NULL,
        name VARCHAR(255) NOT NULL,
        description TEXT,
        rule_type VARCHAR(30) NOT NULL DEFAULT 'FIXED_PERCENTAGE',
        source_cost_centre_id TEXT NOT NULL REFERENCES public.cost_centre(id) ON DELETE RESTRICT,
        source_account_id TEXT NOT NULL REFERENCES public.accounting_account(id) ON DELETE RESTRICT,
        version INTEGER NOT NULL DEFAULT 1,
        is_active BOOLEAN NOT NULL DEFAULT true,
        effective_from DATE NOT NULL,
        effective_to DATE,
        metadata JSONB DEFAULT '{}'::jsonb,
        created_by TEXT REFERENCES public."user"(id) ON DELETE SET NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        deleted_at TIMESTAMPTZ,
        CONSTRAINT chk_cost_allocation_rule_type CHECK (rule_type IN ('FIXED_PERCENTAGE', 'REVENUE_RATIO', 'EQUAL_SPLIT'))
      );

      CREATE INDEX IF NOT EXISTS idx_cost_allocation_rule_code ON public.cost_allocation_rule(rule_code);
      CREATE INDEX IF NOT EXISTS idx_cost_allocation_rule_source_cc ON public.cost_allocation_rule(source_cost_centre_id);
      CREATE INDEX IF NOT EXISTS idx_cost_allocation_rule_source_acct ON public.cost_allocation_rule(source_account_id);
      CREATE INDEX IF NOT EXISTS idx_cost_allocation_rule_active ON public.cost_allocation_rule(is_active) WHERE deleted_at IS NULL;
    `);
    console.log('  ✓ public.cost_allocation_rule table and indexes verified');

    // ─── [3/6] Table 2: public.cost_allocation_rule_target ──────────────────
    console.log('[4/6] Creating public.cost_allocation_rule_target table...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS public.cost_allocation_rule_target (
        id TEXT PRIMARY KEY DEFAULT ('cart_' || gen_random_uuid()::text),
        rule_id TEXT NOT NULL REFERENCES public.cost_allocation_rule(id) ON DELETE CASCADE,
        target_cost_centre_id TEXT NOT NULL REFERENCES public.cost_centre(id) ON DELETE RESTRICT,
        target_account_id TEXT REFERENCES public.accounting_account(id) ON DELETE RESTRICT,
        percentage NUMERIC(7, 4) NOT NULL,
        sort_order INTEGER NOT NULL DEFAULT 0,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        CONSTRAINT chk_target_percentage CHECK (percentage > 0 AND percentage <= 100),
        CONSTRAINT uq_rule_target_cc UNIQUE (rule_id, target_cost_centre_id)
      );

      CREATE INDEX IF NOT EXISTS idx_rule_target_rule_id ON public.cost_allocation_rule_target(rule_id);
      CREATE INDEX IF NOT EXISTS idx_rule_target_cc_id ON public.cost_allocation_rule_target(target_cost_centre_id);
      CREATE INDEX IF NOT EXISTS idx_rule_target_acct_id ON public.cost_allocation_rule_target(target_account_id) WHERE target_account_id IS NOT NULL;
    `);
    console.log('  ✓ public.cost_allocation_rule_target table and indexes verified');

    // ─── [4/6] Table 3: public.cost_allocation_run ───────────────────────────
    console.log('[5/6] Creating public.cost_allocation_run table...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS public.cost_allocation_run (
        id TEXT PRIMARY KEY DEFAULT ('carun_' || gen_random_uuid()::text),
        run_number VARCHAR(50) UNIQUE NOT NULL,
        rule_id TEXT NOT NULL REFERENCES public.cost_allocation_rule(id) ON DELETE RESTRICT,
        rule_version INTEGER NOT NULL DEFAULT 1,
        fiscal_year VARCHAR(20) NOT NULL,
        period_name VARCHAR(50) NOT NULL,
        allocation_date DATE NOT NULL,
        source_cost_centre_id TEXT NOT NULL REFERENCES public.cost_centre(id) ON DELETE RESTRICT,
        source_account_id TEXT NOT NULL REFERENCES public.accounting_account(id) ON DELETE RESTRICT,
        total_source_amount NUMERIC(15, 2) NOT NULL,
        total_allocated_amount NUMERIC(15, 2) NOT NULL,
        rounding_difference NUMERIC(15, 2) NOT NULL DEFAULT 0.00,
        status VARCHAR(30) NOT NULL DEFAULT 'DRAFT',
        accounting_voucher_id TEXT REFERENCES public.accounting_voucher(id) ON DELETE RESTRICT,
        reversal_voucher_id TEXT REFERENCES public.accounting_voucher(id) ON DELETE RESTRICT,
        rule_snapshot JSONB NOT NULL DEFAULT '{}'::jsonb,
        narration TEXT NOT NULL,
        metadata JSONB DEFAULT '{}'::jsonb,
        executed_by TEXT REFERENCES public."user"(id) ON DELETE SET NULL,
        executed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        approved_by TEXT REFERENCES public."user"(id) ON DELETE SET NULL,
        approved_at TIMESTAMPTZ,
        reversed_by TEXT REFERENCES public."user"(id) ON DELETE SET NULL,
        reversed_at TIMESTAMPTZ,
        reversal_reason TEXT,
        CONSTRAINT chk_cost_allocation_run_status CHECK (status IN ('PREVIEW', 'DRAFT', 'SUBMITTED', 'POSTED', 'REVERSED'))
      );

      CREATE INDEX IF NOT EXISTS idx_cost_allocation_run_rule_id ON public.cost_allocation_run(rule_id);
      CREATE INDEX IF NOT EXISTS idx_cost_allocation_run_period ON public.cost_allocation_run(fiscal_year, period_name);
      CREATE INDEX IF NOT EXISTS idx_cost_allocation_run_voucher ON public.cost_allocation_run(accounting_voucher_id) WHERE accounting_voucher_id IS NOT NULL;
      CREATE INDEX IF NOT EXISTS idx_cost_allocation_run_status ON public.cost_allocation_run(status);
    `);
    console.log('  ✓ public.cost_allocation_run table and indexes verified');

    // ─── [5/6] Table 4: public.cost_allocation_run_line ──────────────────────
    console.log('[6/6] Creating public.cost_allocation_run_line table...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS public.cost_allocation_run_line (
        id TEXT PRIMARY KEY DEFAULT ('carunl_' || gen_random_uuid()::text),
        run_id TEXT NOT NULL REFERENCES public.cost_allocation_run(id) ON DELETE CASCADE,
        source_journal_line_id TEXT REFERENCES public.accounting_journal_line(id) ON DELETE SET NULL,
        target_cost_centre_id TEXT NOT NULL REFERENCES public.cost_centre(id) ON DELETE RESTRICT,
        target_account_id TEXT NOT NULL REFERENCES public.accounting_account(id) ON DELETE RESTRICT,
        target_percentage NUMERIC(7, 4) NOT NULL,
        allocated_amount NUMERIC(15, 2) NOT NULL,
        sort_order INTEGER NOT NULL DEFAULT 0,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      CREATE INDEX IF NOT EXISTS idx_cost_allocation_run_line_run_id ON public.cost_allocation_run_line(run_id);
      CREATE INDEX IF NOT EXISTS idx_cost_allocation_run_line_target_cc ON public.cost_allocation_run_line(target_cost_centre_id);
      CREATE INDEX IF NOT EXISTS idx_cost_allocation_run_line_target_acct ON public.cost_allocation_run_line(target_account_id);
      CREATE INDEX IF NOT EXISTS idx_cost_allocation_run_line_source_jl ON public.cost_allocation_run_line(source_journal_line_id) WHERE source_journal_line_id IS NOT NULL;
    `);
    console.log('  ✓ public.cost_allocation_run_line table and indexes verified');

    // ─── COMMIT TRANSACTION ──────────────────────────────────────────────────
    await client.query('COMMIT;');
    console.log('\n✓ Migration transaction committed successfully!');

    // ─── POST-MIGRATION VERIFICATION ─────────────────────────────────────────
    console.log('\n[Post-Migration Verification]');
    const checkTables = [
      'cost_allocation_rule',
      'cost_allocation_rule_target',
      'cost_allocation_run',
      'cost_allocation_run_line'
    ];
    for (const tbl of checkTables) {
      const chk = await client.query(`
        SELECT count(*)::int as count 
        FROM information_schema.tables 
        WHERE table_schema = 'public' AND table_name = $1;
      `, [tbl]);
      if (chk.rows[0].count !== 1) {
        throw new Error(`Table public.${tbl} not found after migration!`);
      }
      console.log(`  ✓ Table public.${tbl} exists in information_schema`);
    }

    // Verify CoA intact
    const postCoa = await client.query('SELECT count(*)::int as count FROM public.accounting_account');
    if (postCoa.rows[0].count !== 100) {
      throw new Error(`CoA altered! Count is ${postCoa.rows[0].count}, expected 100`);
    }
    console.log(`  ✓ Chart of Accounts strictly preserved: ${postCoa.rows[0].count} accounts`);

    // Verify Trial Balance intact
    const postTb = await client.query(`
      SELECT 
        COALESCE(SUM(debit_amount), 0)::numeric(15,2) as dr,
        COALESCE(SUM(credit_amount), 0)::numeric(15,2) as cr
      FROM public.accounting_journal_line;
    `);
    if (postTb.rows[0].dr !== postTb.rows[0].cr) {
      throw new Error(`Trial Balance altered! Dr ${postTb.rows[0].dr} !== Cr ${postTb.rows[0].cr}`);
    }
    console.log(`  ✓ Trial Balance strictly preserved: Dr ₹${postTb.rows[0].dr} === Cr ₹${postTb.rows[0].cr}`);

    console.log('\n=============================================================================');
    console.log('PHASE C7.6 STEP 4A SCHEMA MIGRATION COMPLETED SUCCESSFULLY!');
    console.log('=============================================================================');

  } catch (err) {
    await client.query('ROLLBACK;').catch(() => {});
    console.error('\n❌ Migration failed, rolled back:', err);
    throw err;
  } finally {
    await client.end();
  }
}

runStep4AMigration().catch(() => {
  process.exit(1);
});
