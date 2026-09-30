/**
 * CakeToHome ERP — Phase 4B: Accounting Foundation DB Migration
 *
 * Authoritative Schema:
 *  - CHECKPOINTS/phase4a-accounting-schema-design-01.md
 *  - CHECKPOINTS/phase4a-schema-verification-01.md
 *
 * Invariants Enforced:
 *  1. Universal TEXT identifiers for all accounting PKs and internal FKs
 *  2. Operational FKs link to canonical TEXT IDs (branch, customer, supplier)
 *  3. Double-entry 3-tier model with deferred constraint trigger trg_check_journal_balance
 *  4. Single-sided journal lines with NUMERIC(15,2) precision
 *  5. Segregation of duties: approved_by IS NULL OR approved_by != created_by
 *  6. Posted voucher immutability: status != 'CANCELLED' OR posted_at IS NULL
 *  7. Idempotency with reference_event to support multi-stage payment transactions
 *  8. Strict isolation: 0 seed data, 0 historical order mutation, 0 start-date configuration
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
    if (line.startsWith('DATABASE_URL=')) {
      return line.substring('DATABASE_URL='.length).trim();
    }
  }
  throw new Error("No database connection string found in environment or backend/.env");
}

const migrationSql = `
BEGIN;

-- =============================================================================
-- Table 1: public.accounting_account
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.accounting_account (
  id              TEXT            PRIMARY KEY DEFAULT gen_random_uuid()::text,
  code            VARCHAR(20)     NOT NULL,
  name            VARCHAR(100)    NOT NULL,
  type            VARCHAR(20)     NOT NULL,
  subtype         VARCHAR(30)     NOT NULL,
  parent_id       TEXT            NULL REFERENCES public.accounting_account(id) ON DELETE RESTRICT,
  level           INTEGER         NOT NULL DEFAULT 1,
  is_group        BOOLEAN         NOT NULL DEFAULT false,
  is_system       BOOLEAN         NOT NULL DEFAULT false,
  is_active       BOOLEAN         NOT NULL DEFAULT true,
  tax_rate        NUMERIC(5, 2)   NULL,
  tax_class       VARCHAR(30)     NULL,
  description     TEXT            NULL,
  metadata        JSONB           NULL,
  created_by      TEXT            NOT NULL,
  created_at      TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
  deleted_at      TIMESTAMPTZ     NULL,

  -- Constraints
  CONSTRAINT uq_accounting_account_code UNIQUE (code),
  CONSTRAINT chk_account_type CHECK (type IN ('ASSET', 'LIABILITY', 'EQUITY', 'REVENUE', 'EXPENSE')),
  CONSTRAINT chk_account_subtype CHECK (subtype IN (
    'CURRENT_ASSET', 'CASH', 'BANK', 'GATEWAY_CLEARING', 'RECEIVABLE', 'INVENTORY', 'INPUT_TAX', 'FIXED_ASSET',
    'CURRENT_LIABILITY', 'PAYABLE', 'OUTPUT_TAX', 'STAFF_PAYABLE', 'CUSTOMER_ADVANCE', 'LONG_TERM_LIABILITY',
    'CAPITAL', 'RETAINED_EARNINGS', 'OPENING_OFFSET',
    'DIRECT_REVENUE', 'INDIRECT_REVENUE', 'DELIVERY_REVENUE',
    'COGS', 'OPERATING_EXPENSE', 'FINANCIAL_EXPENSE'
  )),
  CONSTRAINT chk_account_level CHECK (level >= 1 AND level <= 5)
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_accounting_account_code 
  ON public.accounting_account(code) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_accounting_account_type 
  ON public.accounting_account(type, subtype);
CREATE INDEX IF NOT EXISTS idx_accounting_account_parent 
  ON public.accounting_account(parent_id);
CREATE INDEX IF NOT EXISTS idx_accounting_account_active 
  ON public.accounting_account(is_active) WHERE deleted_at IS NULL;

-- =============================================================================
-- Table 2: public.accounting_voucher
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.accounting_voucher (
  id                      TEXT            PRIMARY KEY DEFAULT gen_random_uuid()::text,
  voucher_no              VARCHAR(60)     NOT NULL,
  voucher_type            VARCHAR(30)     NOT NULL,
  voucher_date            DATE            NOT NULL,
  branch_id               TEXT            NOT NULL REFERENCES public.branch(id) ON DELETE RESTRICT,
  fiscal_year             VARCHAR(10)     NOT NULL,
  status                  VARCHAR(20)     NOT NULL DEFAULT 'DRAFT',
  total_amount            NUMERIC(15, 2)  NOT NULL DEFAULT 0.00,
  currency                VARCHAR(3)      NOT NULL DEFAULT 'INR',
  reference_type          VARCHAR(30)     NULL,
  reference_id            TEXT            NULL,
  reference_event         VARCHAR(30)     NOT NULL DEFAULT 'PRIMARY',
  narration               TEXT            NOT NULL,
  
  -- Workflow and Segregation of Duties Audit Fields
  created_by              TEXT            NOT NULL,
  submitted_by            TEXT            NULL,
  submitted_at            TIMESTAMPTZ     NULL,
  approved_by             TEXT            NULL,
  approved_at             TIMESTAMPTZ     NULL,
  posted_by               TEXT            NULL,
  posted_at               TIMESTAMPTZ     NULL,
  cancelled_by            TEXT            NULL,
  cancelled_at            TIMESTAMPTZ     NULL,
  
  -- Reversal Audit Relationship
  reversed_by_voucher_id  TEXT            NULL REFERENCES public.accounting_voucher(id) ON DELETE SET NULL,
  reversal_of_voucher_id  TEXT            NULL REFERENCES public.accounting_voucher(id) ON DELETE SET NULL,
  
  metadata                JSONB           NULL,
  created_at              TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
  updated_at              TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
  deleted_at              TIMESTAMPTZ     NULL,

  -- Constraints
  CONSTRAINT uq_accounting_voucher_no UNIQUE (voucher_no),
  CONSTRAINT chk_voucher_type CHECK (voucher_type IN (
    'SALES', 'PURCHASE', 'PAYMENT', 'RECEIPT', 'EXPENSE', 'JOURNAL', 'CONTRA', 'CREDIT_NOTE', 'DEBIT_NOTE', 'OPENING_BALANCE'
  )),
  CONSTRAINT chk_voucher_status CHECK (status IN ('DRAFT', 'SUBMITTED', 'APPROVED', 'POSTED', 'CANCELLED')),
  CONSTRAINT chk_voucher_total CHECK (total_amount >= 0.00),
  CONSTRAINT chk_voucher_segregation CHECK (approved_by IS NULL OR approved_by != created_by),
  CONSTRAINT chk_voucher_posted_immutable CHECK (status != 'CANCELLED' OR posted_at IS NULL),
  CONSTRAINT chk_voucher_reversal_limit CHECK (reversal_of_voucher_id IS NULL OR reversed_by_voucher_id IS NULL)
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_accounting_voucher_no 
  ON public.accounting_voucher(voucher_no);
CREATE INDEX IF NOT EXISTS idx_accounting_voucher_branch_date 
  ON public.accounting_voucher(branch_id, voucher_date DESC);
CREATE INDEX IF NOT EXISTS idx_accounting_voucher_type_status 
  ON public.accounting_voucher(voucher_type, status);
CREATE INDEX IF NOT EXISTS idx_accounting_voucher_ref 
  ON public.accounting_voucher(reference_type, reference_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_accounting_voucher_source_idempotency 
  ON public.accounting_voucher(reference_type, reference_id, reference_event) 
  WHERE status != 'CANCELLED' AND reference_type != 'MANUAL';
CREATE INDEX IF NOT EXISTS idx_accounting_voucher_fiscal 
  ON public.accounting_voucher(fiscal_year);

-- =============================================================================
-- Table 3: public.accounting_journal_entry
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.accounting_journal_entry (
  id              TEXT            PRIMARY KEY DEFAULT gen_random_uuid()::text,
  entry_no        VARCHAR(60)     NOT NULL,
  voucher_id      TEXT            NOT NULL UNIQUE REFERENCES public.accounting_voucher(id) ON DELETE RESTRICT,
  entry_date      DATE            NOT NULL,
  branch_id       TEXT            NOT NULL REFERENCES public.branch(id) ON DELETE RESTRICT,
  fiscal_year     VARCHAR(10)     NOT NULL,
  total_debit     NUMERIC(15, 2)  NOT NULL,
  total_credit    NUMERIC(15, 2)  NOT NULL,
  is_reversed     BOOLEAN         NOT NULL DEFAULT false,
  reversed_at     TIMESTAMPTZ     NULL,
  narration       TEXT            NULL,
  created_by      TEXT            NOT NULL,
  created_at      TIMESTAMPTZ     NOT NULL DEFAULT NOW(),

  -- Constraints
  CONSTRAINT uq_accounting_journal_entry_no UNIQUE (entry_no),
  CONSTRAINT chk_journal_balanced CHECK (total_debit = total_credit),
  CONSTRAINT chk_journal_positive CHECK (total_debit > 0.00)
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_accounting_journal_entry_no 
  ON public.accounting_journal_entry(entry_no);
CREATE UNIQUE INDEX IF NOT EXISTS idx_accounting_journal_voucher 
  ON public.accounting_journal_entry(voucher_id);
CREATE INDEX IF NOT EXISTS idx_accounting_journal_branch_date 
  ON public.accounting_journal_entry(branch_id, entry_date DESC);
CREATE INDEX IF NOT EXISTS idx_accounting_journal_fiscal 
  ON public.accounting_journal_entry(fiscal_year);

-- =============================================================================
-- Table 4: public.accounting_journal_line
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.accounting_journal_line (
  id                TEXT            PRIMARY KEY DEFAULT gen_random_uuid()::text,
  journal_entry_id  TEXT            NOT NULL REFERENCES public.accounting_journal_entry(id) ON DELETE RESTRICT,
  line_no           INTEGER         NOT NULL,
  account_id        TEXT            NOT NULL REFERENCES public.accounting_account(id) ON DELETE RESTRICT,
  debit_amount      NUMERIC(15, 2)  NOT NULL DEFAULT 0.00,
  credit_amount     NUMERIC(15, 2)  NOT NULL DEFAULT 0.00,
  branch_id         TEXT            NOT NULL REFERENCES public.branch(id) ON DELETE RESTRICT,
  
  -- Sub-ledger Dimensions
  customer_id       TEXT            NULL REFERENCES public.customer(id) ON DELETE RESTRICT,
  supplier_id       TEXT            NULL REFERENCES public.supplier(id) ON DELETE RESTRICT,
  
  -- Tax Classification Dimensions
  tax_rate          NUMERIC(5, 2)   NULL,
  tax_class         VARCHAR(30)     NULL,
  
  narration         TEXT            NULL,
  metadata          JSONB           NULL,

  -- Constraints
  CONSTRAINT uq_journal_line_order UNIQUE (journal_entry_id, line_no),
  CONSTRAINT chk_jline_debit_nonneg CHECK (debit_amount >= 0.00),
  CONSTRAINT chk_jline_credit_nonneg CHECK (credit_amount >= 0.00),
  CONSTRAINT chk_jline_single_sided CHECK (
    (debit_amount > 0.00 AND credit_amount = 0.00) OR
    (credit_amount > 0.00 AND debit_amount = 0.00)
  )
);

CREATE INDEX IF NOT EXISTS idx_accounting_jline_entry 
  ON public.accounting_journal_line(journal_entry_id);
CREATE INDEX IF NOT EXISTS idx_accounting_jline_account_branch 
  ON public.accounting_journal_line(account_id, branch_id);
CREATE INDEX IF NOT EXISTS idx_accounting_jline_customer 
  ON public.accounting_journal_line(customer_id) WHERE customer_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_accounting_jline_supplier 
  ON public.accounting_journal_line(supplier_id) WHERE supplier_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_accounting_jline_branch 
  ON public.accounting_journal_line(branch_id);

-- Double-Entry Balance Deferred Constraint Trigger
CREATE OR REPLACE FUNCTION public.fn_check_journal_balance()
RETURNS TRIGGER AS $$
DECLARE
  v_debit NUMERIC(15, 2);
  v_credit NUMERIC(15, 2);
BEGIN
  SELECT COALESCE(SUM(debit_amount), 0), COALESCE(SUM(credit_amount), 0)
  INTO v_debit, v_credit
  FROM public.accounting_journal_line
  WHERE journal_entry_id = NEW.journal_entry_id;

  IF v_debit <> v_credit THEN
    RAISE EXCEPTION 'Double-entry violation: Journal entry % debits (%) != credits (%)', 
      NEW.journal_entry_id, v_debit, v_credit;
  END IF;

  IF v_debit <= 0 THEN
    RAISE EXCEPTION 'Double-entry violation: Journal entry % cannot have zero or negative total amount', NEW.journal_entry_id;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_check_journal_balance ON public.accounting_journal_line;

CREATE CONSTRAINT TRIGGER trg_check_journal_balance
AFTER INSERT OR UPDATE ON public.accounting_journal_line
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW
EXECUTE FUNCTION public.fn_check_journal_balance();

-- =============================================================================
-- Table 5: public.accounting_fiscal_period
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.accounting_fiscal_period (
  id              TEXT            PRIMARY KEY DEFAULT gen_random_uuid()::text,
  fiscal_year     VARCHAR(10)     NOT NULL,
  period_name     VARCHAR(30)     NOT NULL,
  start_date      DATE            NOT NULL,
  end_date        DATE            NOT NULL,
  is_locked       BOOLEAN         NOT NULL DEFAULT false,
  locked_at       TIMESTAMPTZ     NULL,
  locked_by       TEXT            NULL,
  created_at      TIMESTAMPTZ     NOT NULL DEFAULT NOW(),

  -- Constraints
  CONSTRAINT uq_fiscal_period UNIQUE (fiscal_year, period_name),
  CONSTRAINT chk_fiscal_dates CHECK (end_date >= start_date)
);

CREATE INDEX IF NOT EXISTS idx_accounting_fiscal_year 
  ON public.accounting_fiscal_period(fiscal_year);

COMMIT;
`;

async function run() {
  const connectionString = getConnectionString();
  const client = new Client({ connectionString, ssl: { rejectUnauthorized: false } });
  
  await client.connect();
  console.log("Connected to PostgreSQL database safely.");

  try {
    console.log("Executing Phase 4B Accounting Schema Migration transaction...");
    await client.query(migrationSql);
    console.log("Phase 4B DDL execution committed successfully.");

    // Structural Verification
    const tablesRes = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
        AND table_name IN ('accounting_account', 'accounting_voucher', 'accounting_journal_entry', 'accounting_journal_line', 'accounting_fiscal_period')
      ORDER BY table_name;
    `);
    console.log("Created Accounting Tables:", tablesRes.rows.map(r => r.table_name));

    const triggerRes = await client.query(`
      SELECT trigger_name, event_manipulation, action_statement, action_timing
      FROM information_schema.triggers
      WHERE event_object_schema = 'public'
        AND event_object_table = 'accounting_journal_line'
        AND trigger_name = 'trg_check_journal_balance';
    `);
    console.log("Deferred Constraint Trigger:", triggerRes.rows);

  } catch (err) {
    console.error("Migration transaction aborted. Error:", err.message);
    process.exit(1);
  } finally {
    await client.end();
  }
}

run().catch(err => {
  console.error("Fatal migration error:", err.message);
  process.exit(1);
});
