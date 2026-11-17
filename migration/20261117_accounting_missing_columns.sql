-- Accounting column catch-up for the live database.
-- Live bank/settlement tables were created from an older layout than the code uses. All affected
-- tables are empty, so this adds the columns the code reads/writes and relaxes NOT NULL on legacy
-- columns the code never writes (nothing is dropped). Idempotent, no data written.
-- Sources:
--   bank_statement_import/line, bank_reconciliation_match <- frontend/migrate_phase4f_step4_10_5A_bank_reconciliation_schema.js
--   gateway_settlement_order  <- frontend/migrate_phase4f_step4_10_schema.js
--   expense, expense_category <- frontend/migrate_c5_expense_accounting.js
--   company, gst_registration <- backend/src/migrations/20261004_phase_a_company_gst_master.sql
--   branch.company_id/gst_registration_id, invoice_sequence.authorized_* <- src/lib/migrations/c7_12_*.sql
BEGIN;

-- ── Bank statement import ────────────────────────────────────────────────────
ALTER TABLE public.bank_statement_import
  ADD COLUMN IF NOT EXISTS company_id TEXT DEFAULT 'company_default',
  ADD COLUMN IF NOT EXISTS source_filename TEXT,
  ADD COLUMN IF NOT EXISTS source_format TEXT DEFAULT 'CSV',
  ADD COLUMN IF NOT EXISTS file_sha256 TEXT,
  ADD COLUMN IF NOT EXISTS file_size_bytes INTEGER,
  ADD COLUMN IF NOT EXISTS statement_period_start DATE,
  ADD COLUMN IF NOT EXISTS statement_period_end DATE,
  ADD COLUMN IF NOT EXISTS total_lines_imported INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS total_debit_amount NUMERIC(15,2) NOT NULL DEFAULT 0.00,
  ADD COLUMN IF NOT EXISTS total_credit_amount NUMERIC(15,2) NOT NULL DEFAULT 0.00,
  ADD COLUMN IF NOT EXISTS imported_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
ALTER TABLE public.bank_statement_import ALTER COLUMN file_name DROP NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS uq_bsi_file_sha256 ON public.bank_statement_import(bank_account_id, file_sha256) WHERE file_sha256 IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_bsi_period ON public.bank_statement_import(statement_period_start, statement_period_end);

-- ── Bank statement line ──────────────────────────────────────────────────────
ALTER TABLE public.bank_statement_line
  ADD COLUMN IF NOT EXISTS bank_reference TEXT,
  ADD COLUMN IF NOT EXISTS running_balance NUMERIC(15,2),
  ADD COLUMN IF NOT EXISTS line_hash TEXT,
  ADD COLUMN IF NOT EXISTS reconciliation_status TEXT NOT NULL DEFAULT 'UNMATCHED',
  ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_bsl_reconciliation_status') THEN
    ALTER TABLE public.bank_statement_line ADD CONSTRAINT chk_bsl_reconciliation_status
      CHECK (reconciliation_status IN ('UNMATCHED', 'MATCHED', 'PARTIALLY_MATCHED', 'EXCEPTION'));
  END IF;
END $$;
CREATE UNIQUE INDEX IF NOT EXISTS uq_bsl_line_hash ON public.bank_statement_line(import_id, line_hash) WHERE line_hash IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_bsl_reconciliation_status ON public.bank_statement_line(reconciliation_status);
CREATE INDEX IF NOT EXISTS idx_bsl_import_id ON public.bank_statement_line(import_id);

-- ── Bank reconciliation match ────────────────────────────────────────────────
ALTER TABLE public.bank_reconciliation_match
  ADD COLUMN IF NOT EXISTS match_source_type TEXT,
  ADD COLUMN IF NOT EXISTS match_source_id TEXT,
  ADD COLUMN IF NOT EXISTS match_status TEXT NOT NULL DEFAULT 'PROPOSED',
  ADD COLUMN IF NOT EXISTS variance_amount NUMERIC(15,2) NOT NULL DEFAULT 0.00,
  ADD COLUMN IF NOT EXISTS matched_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
ALTER TABLE public.bank_reconciliation_match
  ALTER COLUMN bank_account_id DROP NOT NULL,
  ALTER COLUMN source_type DROP NOT NULL,
  ALTER COLUMN source_id DROP NOT NULL;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_brm_match_status') THEN
    ALTER TABLE public.bank_reconciliation_match ADD CONSTRAINT chk_brm_match_status
      CHECK (match_status IN ('PROPOSED', 'CONFIRMED', 'REJECTED', 'REVERSED'));
  END IF;
END $$;
CREATE INDEX IF NOT EXISTS idx_brm_source ON public.bank_reconciliation_match(match_source_type, match_source_id);
CREATE INDEX IF NOT EXISTS idx_brm_match_status ON public.bank_reconciliation_match(match_status);

-- ── Bank reconciliation session ──────────────────────────────────────────────
ALTER TABLE public.bank_reconciliation_session
  ADD COLUMN IF NOT EXISTS prepared_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ADD COLUMN IF NOT EXISTS total_matched_count INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS total_unmatched_count INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS total_exception_count INTEGER NOT NULL DEFAULT 0;

-- ── Gateway settlement order ─────────────────────────────────────────────────
ALTER TABLE public.gateway_settlement_order
  ADD COLUMN IF NOT EXISTS allocated_gross_amount NUMERIC(15,2),
  ADD COLUMN IF NOT EXISTS identified_fee_amount NUMERIC(15,2) NOT NULL DEFAULT 0.00,
  ADD COLUMN IF NOT EXISTS reported_tax_amount NUMERIC(15,2) NOT NULL DEFAULT 0.00,
  ADD COLUMN IF NOT EXISTS other_deductions_amount NUMERIC(15,2) NOT NULL DEFAULT 0.00,
  ADD COLUMN IF NOT EXISTS allocated_net_amount NUMERIC(15,2),
  ADD COLUMN IF NOT EXISTS allocation_status TEXT NOT NULL DEFAULT 'PENDING',
  ADD COLUMN IF NOT EXISTS exception_reason TEXT,
  ADD COLUMN IF NOT EXISTS provider_payment_id TEXT,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
ALTER TABLE public.gateway_settlement_order
  ALTER COLUMN gross_order_amount DROP NOT NULL,
  ALTER COLUMN net_order_share DROP NOT NULL;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_settle_status') THEN
    ALTER TABLE public.gateway_settlement_order ADD CONSTRAINT chk_settle_status
      CHECK (allocation_status IN ('PENDING', 'VALIDATED', 'POSTED', 'EXCEPTION'));
  END IF;
END $$;
CREATE INDEX IF NOT EXISTS idx_gateway_settle_status ON public.gateway_settlement_order(allocation_status);

-- ── Expenses ─────────────────────────────────────────────────────────────────
ALTER TABLE public.expense_category
  ADD COLUMN IF NOT EXISTS gl_account_id TEXT REFERENCES public.accounting_account(id) ON DELETE RESTRICT,
  ADD COLUMN IF NOT EXISTS gl_account_code VARCHAR(10);

ALTER TABLE public.expense
  ADD COLUMN IF NOT EXISTS voucher_id TEXT REFERENCES public.accounting_voucher(id) ON DELETE RESTRICT,
  ADD COLUMN IF NOT EXISTS bank_account_id TEXT REFERENCES public.bank_account(id) ON DELETE RESTRICT,
  ADD COLUMN IF NOT EXISTS teller_session_id TEXT REFERENCES public.teller_session(id) ON DELETE RESTRICT,
  ADD COLUMN IF NOT EXISTS company_id TEXT REFERENCES public.company(id) ON DELETE RESTRICT,
  ADD COLUMN IF NOT EXISTS settlement_type VARCHAR(20) NOT NULL DEFAULT 'DIRECT_PAYMENT',
  ADD COLUMN IF NOT EXISTS itc_eligibility VARCHAR(20) NOT NULL DEFAULT 'ITC_ELIGIBLE',
  ADD COLUMN IF NOT EXISTS rcm_applicable BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS hsn_sac_code TEXT,
  ADD COLUMN IF NOT EXISTS vendor_gstin TEXT,
  ADD COLUMN IF NOT EXISTS reversal_voucher_id TEXT REFERENCES public.accounting_voucher(id) ON DELETE RESTRICT,
  ADD COLUMN IF NOT EXISTS reversed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS reversed_by TEXT,
  ADD COLUMN IF NOT EXISTS reversal_reason TEXT;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'expense_settlement_type_check') THEN
    ALTER TABLE public.expense ADD CONSTRAINT expense_settlement_type_check
      CHECK (settlement_type IN ('DIRECT_PAYMENT', 'CREDIT_ACCRUAL'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'expense_itc_eligibility_check') THEN
    ALTER TABLE public.expense ADD CONSTRAINT expense_itc_eligibility_check
      CHECK (itc_eligibility IN ('ITC_ELIGIBLE', 'ITC_INELIGIBLE'));
  END IF;
END $$;
CREATE INDEX IF NOT EXISTS idx_expense_voucher_id ON public.expense(voucher_id) WHERE voucher_id IS NOT NULL;

-- ── Company / GST registration / branch links ────────────────────────────────
ALTER TABLE public.company
  ADD COLUMN IF NOT EXISTS registered_address TEXT,
  ADD COLUMN IF NOT EXISTS city TEXT,
  ADD COLUMN IF NOT EXISTS pin_code TEXT,
  ADD COLUMN IF NOT EXISTS fssai TEXT,
  ADD COLUMN IF NOT EXISTS phone TEXT,
  ADD COLUMN IF NOT EXISTS email TEXT,
  ADD COLUMN IF NOT EXISTS website TEXT,
  ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS created_by TEXT;

ALTER TABLE public.gst_registration
  ADD COLUMN IF NOT EXISTS effective_from DATE,
  ADD COLUMN IF NOT EXISTS effective_to DATE,
  ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS created_by TEXT;

ALTER TABLE public.branch
  ADD COLUMN IF NOT EXISTS company_id TEXT REFERENCES public.company(id),
  ADD COLUMN IF NOT EXISTS gst_registration_id TEXT REFERENCES public.gst_registration(id);
CREATE INDEX IF NOT EXISTS idx_branch_company_id ON public.branch(company_id);
CREATE INDEX IF NOT EXISTS idx_branch_gst_registration_id ON public.branch(gst_registration_id);

ALTER TABLE public.invoice_sequence
  ADD COLUMN IF NOT EXISTS authorized_by TEXT,
  ADD COLUMN IF NOT EXISTS authorized_at TIMESTAMPTZ;

-- ── Receivables / settlements read these ─────────────────────────────────────
ALTER TABLE public.customer ADD COLUMN IF NOT EXISTS company_name TEXT;
ALTER TABLE public."order" ADD COLUMN IF NOT EXISTS canceled_at TIMESTAMPTZ;
ALTER TABLE public.order_item ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

COMMIT;
