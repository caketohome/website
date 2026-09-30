/**
 * CakeToHome ERP — Phase 4F Step 4.10.5-A Schema Migration
 * Additive Schema Foundation: Bank Statement Import, Statement Lines,
 * Reconciliation Sessions, and Reconciliation Matches
 *
 * SAFETY INVARIANTS:
 * - Transactional BEGIN ... COMMIT with automatic ROLLBACK on any failure.
 * - Idempotent execution (safe to re-run).
 * - Zero mutation of historical orders (173), payments (53), or inventory stock (424).
 * - Pre-migration baseline: 99 accounting accounts.
 * - Post-migration baseline: exactly 99 accounting accounts (no new accounts added).
 * - Zero financial vouchers, journal entries, or synthetic transactions created.
 * - All new tables initialized with exactly 0 rows.
 * - All existing tables remain at their frozen row counts.
 *
 * ACCOUNTING SAFETY:
 * - No vouchers created.
 * - No journal entries created.
 * - No journal lines created.
 * - No Stage-2 postings.
 * - No gateway settlement postings.
 * - No automatic suspense postings.
 * - No historical backfill.
 * - No inferred accounting.
 *
 * EVIDENCE-ONLY DESIGN:
 * - bank_statement_import represents immutable source-evidence metadata.
 * - bank_statement_line represents immutable individual bank statement transactions.
 * - bank_reconciliation_session represents a controlled reconciliation session.
 * - bank_reconciliation_match represents explicit match relationships.
 * - None of these tables create or reference accounting vouchers/journals directly.
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

async function runStep4105AMigration() {
  console.log('=============================================================================');
  console.log('CakeToHome ERP — Phase 4F Step 4.10.5-A Schema Foundation');
  console.log('Additive Migration: Bank Statement Import, Lines, Reconciliation Session & Match');
  console.log('=============================================================================\n');

  const client = new Client({
    connectionString: getConnectionString(),
    ssl: { rejectUnauthorized: false }
  });
  await client.connect();

  try {
    // ─── Pre-migration baseline verification ──────────────────────────────────
    console.log('[1/7] Verifying pre-migration baseline...');

    const expectedPreBaseline = {
      accounting_account: 99,
      accounting_voucher: 0,
      accounting_journal_entry: 0,
      accounting_journal_line: 0,
      accounting_fiscal_period: 0,
      gateway_payout_batch: 0,
      gateway_settlement_order: 0,
      bank_account: 0,
      bank_deposit_slip: 0,
      order: 173,
      payment_transaction: 53,
      branch: 57,
      branch_inventory: 424,
    };

    for (const [table, expected] of Object.entries(expectedPreBaseline)) {
      const q = table === 'order' ? 'SELECT COUNT(*) FROM "order"' : `SELECT COUNT(*) FROM "${table}"`;
      const res = await client.query(q);
      const actual = parseInt(res.rows[0].count, 10);
      if (actual !== expected) {
        throw new Error(`PRE-MIGRATION BASELINE VIOLATION: ${table} expected ${expected}, got ${actual}`);
      }
    }
    console.log('  ✓ Pre-migration baseline verified: 13/13 checks passed.\n');

    // ─── Verify no new reconciliation tables exist yet ─────────────────────────
    console.log('[2/7] Checking for pre-existing reconciliation tables...');
    const reconcTables = ['bank_statement_import', 'bank_statement_line', 'bank_reconciliation_session', 'bank_reconciliation_match'];
    for (const t of reconcTables) {
      const tableExists = await client.query(`
        SELECT EXISTS (
          SELECT 1 FROM information_schema.tables 
          WHERE table_schema = 'public' AND table_name = $1
        ) AS exists
      `, [t]);
      if (tableExists.rows[0].exists) {
        console.log(`  ⚠ Table ${t} already exists (idempotent re-run).`);
      } else {
        console.log(`  ✓ Table ${t} does not exist yet — will create.`);
      }
    }
    console.log('');

    // ─── BEGIN Transaction ────────────────────────────────────────────────────
    console.log('[3/7] Beginning transactional migration (BEGIN)...');
    await client.query('BEGIN');

    // ─── 1. Table: bank_statement_import ──────────────────────────────────────
    console.log('[4/7] Creating additive reconciliation schema tables...');
    console.log('  -> Creating public.bank_statement_import...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS public.bank_statement_import (
        id TEXT PRIMARY KEY,
        bank_account_id TEXT NOT NULL REFERENCES public.bank_account(id) ON UPDATE CASCADE ON DELETE RESTRICT,
        company_id TEXT NOT NULL DEFAULT 'company_default',

        -- Source file metadata (immutable evidence)
        source_filename TEXT NOT NULL,
        source_format TEXT NOT NULL DEFAULT 'CSV',
        file_sha256 TEXT NOT NULL,
        file_size_bytes INTEGER NULL,

        -- Statement period
        statement_period_start DATE NOT NULL,
        statement_period_end DATE NOT NULL,

        -- Import metadata
        total_lines_imported INTEGER NOT NULL DEFAULT 0,
        total_debit_amount NUMERIC(15,2) NOT NULL DEFAULT 0.00,
        total_credit_amount NUMERIC(15,2) NOT NULL DEFAULT 0.00,

        -- Status lifecycle
        status TEXT NOT NULL DEFAULT 'IMPORTED',

        -- Audit trail
        imported_by TEXT NOT NULL,
        imported_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        
        metadata JSONB NULL DEFAULT '{}'::jsonb,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

        -- Constraints
        CONSTRAINT chk_bsi_status CHECK (
          status IN ('IMPORTED', 'PROCESSING', 'COMPLETED', 'FAILED', 'SUPERSEDED')
        ),
        CONSTRAINT chk_bsi_source_format CHECK (
          source_format IN ('CSV', 'OFX', 'MT940', 'CUSTOM', 'MANUAL')
        ),
        CONSTRAINT chk_bsi_period_valid CHECK (
          statement_period_start <= statement_period_end
        ),
        CONSTRAINT chk_bsi_filename_nonempty CHECK (
          length(trim(source_filename)) > 0
        ),
        CONSTRAINT chk_bsi_sha256_nonempty CHECK (
          length(trim(file_sha256)) > 0
        ),
        CONSTRAINT chk_bsi_total_lines_nonneg CHECK (
          total_lines_imported >= 0
        ),
        CONSTRAINT chk_bsi_total_debit_nonneg CHECK (
          total_debit_amount >= 0
        ),
        CONSTRAINT chk_bsi_total_credit_nonneg CHECK (
          total_credit_amount >= 0
        ),
        CONSTRAINT uq_bsi_file_sha256 UNIQUE (bank_account_id, file_sha256)
      );

      CREATE INDEX IF NOT EXISTS idx_bsi_bank_account ON public.bank_statement_import(bank_account_id);
      CREATE INDEX IF NOT EXISTS idx_bsi_status ON public.bank_statement_import(status);
      CREATE INDEX IF NOT EXISTS idx_bsi_period ON public.bank_statement_import(statement_period_start, statement_period_end);
      CREATE INDEX IF NOT EXISTS idx_bsi_imported_at ON public.bank_statement_import(imported_at);
    `);
    console.log('  ✓ bank_statement_import created.');

    // ─── 2. Table: bank_statement_line ────────────────────────────────────────
    console.log('  -> Creating public.bank_statement_line...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS public.bank_statement_line (
        id TEXT PRIMARY KEY,
        import_id TEXT NOT NULL REFERENCES public.bank_statement_import(id) ON UPDATE CASCADE ON DELETE RESTRICT,
        bank_account_id TEXT NOT NULL REFERENCES public.bank_account(id) ON UPDATE CASCADE ON DELETE RESTRICT,

        -- Source line identity (immutable)
        line_number INTEGER NOT NULL,

        -- Transaction dates
        transaction_date DATE NOT NULL,
        value_date DATE NULL,

        -- Description/narration from bank
        description TEXT NOT NULL DEFAULT '',
        bank_reference TEXT NULL,

        -- Amount fields: preserve source evidence faithfully
        debit_amount NUMERIC(15,2) NOT NULL DEFAULT 0.00,
        credit_amount NUMERIC(15,2) NOT NULL DEFAULT 0.00,
        running_balance NUMERIC(15,2) NULL,

        -- Deterministic deduplication identity
        line_hash TEXT NOT NULL,

        -- Reconciliation state
        reconciliation_status TEXT NOT NULL DEFAULT 'UNMATCHED',

        -- Audit
        metadata JSONB NULL DEFAULT '{}'::jsonb,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

        -- Constraints
        CONSTRAINT chk_bsl_line_number_pos CHECK (line_number > 0),
        CONSTRAINT chk_bsl_debit_nonneg CHECK (debit_amount >= 0),
        CONSTRAINT chk_bsl_credit_nonneg CHECK (credit_amount >= 0),
        CONSTRAINT chk_bsl_single_sided CHECK (
          NOT (debit_amount > 0 AND credit_amount > 0)
        ),
        CONSTRAINT chk_bsl_nonzero_amount CHECK (
          debit_amount > 0 OR credit_amount > 0
        ),
        CONSTRAINT chk_bsl_reconciliation_status CHECK (
          reconciliation_status IN ('UNMATCHED', 'MATCHED', 'PARTIALLY_MATCHED', 'EXCEPTION')
        ),
        CONSTRAINT chk_bsl_line_hash_nonempty CHECK (
          length(trim(line_hash)) > 0
        ),
        CONSTRAINT uq_bsl_import_line UNIQUE (import_id, line_number),
        CONSTRAINT uq_bsl_line_hash UNIQUE (import_id, line_hash)
      );

      CREATE INDEX IF NOT EXISTS idx_bsl_import_id ON public.bank_statement_line(import_id);
      CREATE INDEX IF NOT EXISTS idx_bsl_bank_account ON public.bank_statement_line(bank_account_id);
      CREATE INDEX IF NOT EXISTS idx_bsl_transaction_date ON public.bank_statement_line(transaction_date);
      CREATE INDEX IF NOT EXISTS idx_bsl_value_date ON public.bank_statement_line(value_date);
      CREATE INDEX IF NOT EXISTS idx_bsl_reconciliation_status ON public.bank_statement_line(reconciliation_status);
      CREATE INDEX IF NOT EXISTS idx_bsl_bank_reference ON public.bank_statement_line(bank_reference);
    `);
    console.log('  ✓ bank_statement_line created.');

    // ─── 3. Table: bank_reconciliation_session ────────────────────────────────
    console.log('  -> Creating public.bank_reconciliation_session...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS public.bank_reconciliation_session (
        id TEXT PRIMARY KEY,
        bank_account_id TEXT NOT NULL REFERENCES public.bank_account(id) ON UPDATE CASCADE ON DELETE RESTRICT,
        company_id TEXT NOT NULL DEFAULT 'company_default',

        -- Reconciliation period
        period_start DATE NOT NULL,
        period_end DATE NOT NULL,

        -- Statement balances (as reported by the bank)
        opening_balance_per_bank NUMERIC(15,2) NULL,
        closing_balance_per_bank NUMERIC(15,2) NULL,

        -- Session status lifecycle
        status TEXT NOT NULL DEFAULT 'DRAFT',

        -- Segregation of Duties: preparer / reviewer / approver
        prepared_by TEXT NOT NULL,
        reviewed_by TEXT NULL,
        approved_by TEXT NULL,

        -- Timestamps for status transitions
        prepared_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        reviewed_at TIMESTAMPTZ NULL,
        approved_at TIMESTAMPTZ NULL,

        -- Summary totals (computed, not authoritative)
        total_matched_count INTEGER NOT NULL DEFAULT 0,
        total_unmatched_count INTEGER NOT NULL DEFAULT 0,
        total_exception_count INTEGER NOT NULL DEFAULT 0,

        -- Linked imports
        metadata JSONB NULL DEFAULT '{}'::jsonb,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

        -- Constraints
        CONSTRAINT chk_brs_status CHECK (
          status IN ('DRAFT', 'IN_PROGRESS', 'REVIEWED', 'APPROVED', 'CLOSED', 'CANCELLED')
        ),
        CONSTRAINT chk_brs_period_valid CHECK (
          period_start <= period_end
        ),
        CONSTRAINT chk_brs_matched_count_nonneg CHECK (
          total_matched_count >= 0
        ),
        CONSTRAINT chk_brs_unmatched_count_nonneg CHECK (
          total_unmatched_count >= 0
        ),
        CONSTRAINT chk_brs_exception_count_nonneg CHECK (
          total_exception_count >= 0
        ),
        CONSTRAINT chk_brs_sod_preparer_reviewer CHECK (
          reviewed_by IS NULL OR prepared_by <> reviewed_by
        ),
        CONSTRAINT chk_brs_sod_preparer_approver CHECK (
          approved_by IS NULL OR prepared_by <> approved_by
        ),
        CONSTRAINT chk_brs_sod_reviewer_approver CHECK (
          approved_by IS NULL OR reviewed_by IS NULL OR reviewed_by <> approved_by
        )
      );

      CREATE INDEX IF NOT EXISTS idx_brs_bank_account ON public.bank_reconciliation_session(bank_account_id);
      CREATE INDEX IF NOT EXISTS idx_brs_status ON public.bank_reconciliation_session(status);
      CREATE INDEX IF NOT EXISTS idx_brs_period ON public.bank_reconciliation_session(period_start, period_end);
    `);
    console.log('  ✓ bank_reconciliation_session created.');

    // ─── 4. Table: bank_reconciliation_match ──────────────────────────────────
    console.log('  -> Creating public.bank_reconciliation_match...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS public.bank_reconciliation_match (
        id TEXT PRIMARY KEY,
        session_id TEXT NOT NULL REFERENCES public.bank_reconciliation_session(id) ON UPDATE CASCADE ON DELETE RESTRICT,
        statement_line_id TEXT NOT NULL REFERENCES public.bank_statement_line(id) ON UPDATE CASCADE ON DELETE RESTRICT,

        -- Match target: polymorphic reference to the internal source document
        match_source_type TEXT NOT NULL,
        match_source_id TEXT NOT NULL,

        -- Match classification
        match_type TEXT NOT NULL DEFAULT 'EXACT',

        -- Amount matched (may differ from full statement line for partial matches)
        matched_amount NUMERIC(15,2) NOT NULL,

        -- Match confidence / quality
        match_status TEXT NOT NULL DEFAULT 'PROPOSED',

        -- Match metadata (rule applied, variance, etc.)
        variance_amount NUMERIC(15,2) NOT NULL DEFAULT 0.00,

        -- Audit trail
        matched_by TEXT NOT NULL,
        matched_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        confirmed_by TEXT NULL,
        confirmed_at TIMESTAMPTZ NULL,

        metadata JSONB NULL DEFAULT '{}'::jsonb,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

        -- Constraints
        CONSTRAINT chk_brm_source_type CHECK (
          match_source_type IN (
            'BANK_DEPOSIT_SLIP',
            'GATEWAY_PAYOUT_BATCH',
            'PURCHASE_PAYMENT',
            'CUSTOMER_REFUND',
            'DIRECT_BANK_ENTRY',
            'OTHER'
          )
        ),
        CONSTRAINT chk_brm_match_type CHECK (
          match_type IN ('EXACT', 'PARTIAL', 'MANUAL', 'RULE_BASED')
        ),
        CONSTRAINT chk_brm_match_status CHECK (
          match_status IN ('PROPOSED', 'CONFIRMED', 'REJECTED', 'REVERSED')
        ),
        CONSTRAINT chk_brm_matched_amount_pos CHECK (
          matched_amount > 0
        ),
        CONSTRAINT chk_brm_source_id_nonempty CHECK (
          length(trim(match_source_id)) > 0
        ),
        CONSTRAINT chk_brm_sod_matcher_confirmer CHECK (
          confirmed_by IS NULL OR matched_by <> confirmed_by
        ),
        CONSTRAINT uq_brm_session_line_source UNIQUE (session_id, statement_line_id, match_source_type, match_source_id)
      );

      CREATE INDEX IF NOT EXISTS idx_brm_session ON public.bank_reconciliation_match(session_id);
      CREATE INDEX IF NOT EXISTS idx_brm_statement_line ON public.bank_reconciliation_match(statement_line_id);
      CREATE INDEX IF NOT EXISTS idx_brm_source ON public.bank_reconciliation_match(match_source_type, match_source_id);
      CREATE INDEX IF NOT EXISTS idx_brm_match_status ON public.bank_reconciliation_match(match_status);
    `);
    console.log('  ✓ bank_reconciliation_match created.');
    console.log('  ✓ Additive reconciliation schema creation complete.\n');

    // ─── Post-migration Invariants Verification ───────────────────────────────
    console.log('[5/7] Verifying post-migration foundation baseline...');

    // 1. accounting_account must remain exactly 99 (no new accounts added)
    const accCountRes = await client.query(`SELECT COUNT(*) FROM accounting_account;`);
    const accCount = parseInt(accCountRes.rows[0].count, 10);
    if (accCount !== 99) {
      throw new Error(`POST-MIGRATION BASELINE VIOLATION: Expected 99 accounts, found ${accCount}`);
    }
    console.log('  ✓ accounting_account count remains exactly 99.');

    // 2. Newly created tables must have 0 rows
    const newTables = [
      'bank_statement_import',
      'bank_statement_line',
      'bank_reconciliation_session',
      'bank_reconciliation_match'
    ];
    for (const t of newTables) {
      const res = await client.query(`SELECT COUNT(*) FROM "${t}"`);
      const cnt = parseInt(res.rows[0].count, 10);
      if (cnt !== 0) {
        throw new Error(`POST-MIGRATION VIOLATION: Table ${t} expected 0 rows, found ${cnt}`);
      }
      console.log(`  ✓ Table ${t} exists and contains exactly 0 rows.`);
    }

    // 3. Existing frozen tables must remain untouched
    const frozenTables = {
      accounting_voucher: 0,
      accounting_journal_entry: 0,
      accounting_journal_line: 0,
      accounting_fiscal_period: 0,
      gateway_payout_batch: 0,
      gateway_settlement_order: 0,
      bank_account: 0,
      bank_deposit_slip: 0,
      order: 173,
      payment_transaction: 53,
      branch: 57,
      branch_inventory: 424,
    };
    for (const [table, expected] of Object.entries(frozenTables)) {
      const q = table === 'order' ? 'SELECT COUNT(*) FROM "order"' : `SELECT COUNT(*) FROM "${table}"`;
      const res = await client.query(q);
      const actual = parseInt(res.rows[0].count, 10);
      if (actual !== expected) {
        throw new Error(`POST-MIGRATION VIOLATION: Table ${table} expected ${expected}, got ${actual}`);
      }
    }
    console.log('  ✓ All historical orders, payments, stock, and vouchers remain untouched.');

    // 4. Verify FK constraints exist on new tables
    console.log('\n[6/7] Verifying FK constraints and indexes...');
    const fkQuery = await client.query(`
      SELECT
        tc.constraint_name,
        tc.table_name,
        kcu.column_name,
        ccu.table_name AS foreign_table_name,
        ccu.column_name AS foreign_column_name
      FROM information_schema.table_constraints tc
      JOIN information_schema.key_column_usage kcu
        ON tc.constraint_name = kcu.constraint_name
      JOIN information_schema.constraint_column_usage ccu
        ON ccu.constraint_name = tc.constraint_name
      WHERE tc.constraint_type = 'FOREIGN KEY'
        AND tc.table_name IN (
          'bank_statement_import',
          'bank_statement_line',
          'bank_reconciliation_session',
          'bank_reconciliation_match'
        )
      ORDER BY tc.table_name, tc.constraint_name;
    `);
    console.log(`  ✓ Found ${fkQuery.rows.length} FK constraints on new tables:`);
    for (const fk of fkQuery.rows) {
      console.log(`    ${fk.table_name}.${fk.column_name} -> ${fk.foreign_table_name}.${fk.foreign_column_name}`);
    }

    // 5. Verify check constraints exist
    const chkQuery = await client.query(`
      SELECT tc.constraint_name, tc.table_name
      FROM information_schema.table_constraints tc
      WHERE tc.constraint_type = 'CHECK'
        AND tc.table_name IN (
          'bank_statement_import',
          'bank_statement_line',
          'bank_reconciliation_session',
          'bank_reconciliation_match'
        )
      ORDER BY tc.table_name, tc.constraint_name;
    `);
    console.log(`  ✓ Found ${chkQuery.rows.length} CHECK constraints on new tables.`);

    // 6. Verify indexes
    const idxQuery = await client.query(`
      SELECT indexname, tablename
      FROM pg_indexes
      WHERE tablename IN (
        'bank_statement_import',
        'bank_statement_line',
        'bank_reconciliation_session',
        'bank_reconciliation_match'
      )
      ORDER BY tablename, indexname;
    `);
    console.log(`  ✓ Found ${idxQuery.rows.length} indexes on new tables.`);

    console.log('\n[7/7] Committing transactional migration (COMMIT)...');
    await client.query('COMMIT');
    console.log('\n=============================================================================');
    console.log('SUBSTEP 4.10.5-A MIGRATION SUCCESSFUL (COMMIT EXECUTED)');
    console.log('PRE-MIGRATION COA: 99 | POST-MIGRATION COA: 99 | NEW TABLES: 4 (0 ROWS)');
    console.log('EXISTING TABLES: ALL FROZEN BASELINES VERIFIED');
    console.log('ACCOUNTING POSTINGS: 0 (ZERO)');
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

runStep4105AMigration().catch(err => {
  console.error("FATAL ERROR IN STEP 4.10.5-A MIGRATION:", err);
  process.exit(1);
});
