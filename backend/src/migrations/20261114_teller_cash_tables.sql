-- Teller cash tables used by code but never migrated.
-- Columns derived from: delivery-handover.service.ts, petty-cash.repository.ts, vault-custody.repository.ts.
-- (20261004 phase C teller migration was edited to drop its FK to the non-existent public."user";
--  staff ids are profiles.id uuids stored as TEXT.)
-- NOT applied to production. Apply only with explicit authorization.

BEGIN;

CREATE TABLE IF NOT EXISTS public.delivery_cash_handover (
  id TEXT PRIMARY KEY,
  handover_number TEXT NOT NULL UNIQUE,
  branch_id TEXT NOT NULL REFERENCES public.branch(id) ON DELETE RESTRICT,
  delivery_partner_id TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'SUBMITTED'
    CHECK (status IN ('DRAFT','SUBMITTED','ACKNOWLEDGED','REJECTED','CANCELLED')),
  expected_amount NUMERIC(14,2) NOT NULL DEFAULT 0 CHECK (expected_amount >= 0),
  declared_amount NUMERIC(14,2) NOT NULL DEFAULT 0 CHECK (declared_amount >= 0),
  acknowledged_amount NUMERIC(14,2) NOT NULL DEFAULT 0 CHECK (acknowledged_amount >= 0),
  shortage_amount NUMERIC(14,2) NOT NULL DEFAULT 0 CHECK (shortage_amount >= 0),
  surplus_amount NUMERIC(14,2) NOT NULL DEFAULT 0 CHECK (surplus_amount >= 0),
  digital_amount NUMERIC(14,2) NOT NULL DEFAULT 0 CHECK (digital_amount >= 0),
  order_ids TEXT[] NOT NULL DEFAULT '{}',
  discrepancy_reason TEXT,
  submitted_by TEXT,
  submitted_at TIMESTAMPTZ,
  received_by TEXT,
  acknowledged_at TIMESTAMPTZ,
  teller_session_id TEXT,
  teller_movement_id TEXT,
  settlement_voucher_id TEXT REFERENCES public.accounting_voucher(id) ON DELETE RESTRICT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_dch_branch_status ON public.delivery_cash_handover (branch_id, status);
CREATE INDEX IF NOT EXISTS idx_dch_partner ON public.delivery_cash_handover (delivery_partner_id);
CREATE INDEX IF NOT EXISTS idx_dch_order_ids ON public.delivery_cash_handover USING GIN (order_ids);

CREATE TABLE IF NOT EXISTS public.petty_cash_request (
  id TEXT PRIMARY KEY DEFAULT ('pcr_' || replace(gen_random_uuid()::text, '-', '')),
  request_number TEXT NOT NULL UNIQUE,
  branch_id TEXT NOT NULL REFERENCES public.branch(id) ON DELETE RESTRICT,
  request_type TEXT NOT NULL CHECK (request_type IN ('INITIAL_FUNDING','EXPENSE_CLAIM','REIMBURSEMENT')),
  amount NUMERIC(14,2) NOT NULL CHECK (amount > 0),
  purpose TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'SUBMITTED'
    CHECK (status IN ('DRAFT','SUBMITTED','APPROVED','REJECTED','DISBURSED','CANCELLED')),
  expense_category_id TEXT,
  tax_rate NUMERIC(6,2) NOT NULL DEFAULT 0,
  gst_amount NUMERIC(14,2) NOT NULL DEFAULT 0 CHECK (gst_amount >= 0),
  net_expense_amount NUMERIC(14,2) NOT NULL DEFAULT 0 CHECK (net_expense_amount >= 0),
  input_gst_account_code TEXT,
  expense_account_code TEXT,
  voucher_id TEXT,
  payment_voucher_id TEXT,
  maker_id TEXT NOT NULL,
  made_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  checker_id TEXT,
  checked_at TIMESTAMPTZ,
  checker_notes TEXT,
  disburser_id TEXT,
  disbursed_at TIMESTAMPTZ,
  disburser_notes TEXT,
  bank_account_id TEXT,
  receipt_reference TEXT,
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  -- maker-checker: approver/rejecter cannot be the maker
  CONSTRAINT chk_pcr_maker_checker CHECK (checker_id IS NULL OR checker_id <> maker_id)
);
CREATE INDEX IF NOT EXISTS idx_pcr_branch_status ON public.petty_cash_request (branch_id, status);

CREATE TABLE IF NOT EXISTS public.branch_vault_movement (
  id TEXT PRIMARY KEY DEFAULT ('bvm_' || replace(gen_random_uuid()::text, '-', '')),
  branch_id TEXT NOT NULL REFERENCES public.branch(id) ON DELETE RESTRICT,
  direction TEXT NOT NULL CHECK (direction IN ('IN','OUT')),
  movement_type TEXT NOT NULL
    CHECK (movement_type IN ('SAFE_DROP','VAULT_INITIAL_FLOAT','SAFE_TO_TILL','BANK_DEPOSIT','MANUAL_ADJUSTMENT')),
  amount NUMERIC(14,2) NOT NULL CHECK (amount > 0),
  source_type TEXT NOT NULL
    CHECK (source_type IN ('SAFE_DROP','SAFE_TO_TILL','BANK_DEPOSIT_SLIP','INITIAL_FLOAT','MANUAL_ADJUSTMENT')),
  source_id TEXT NOT NULL,
  teller_session_id TEXT,
  teller_movement_id TEXT,
  performed_by TEXT NOT NULL,
  witnessed_by TEXT,
  narration TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  -- one vault movement per source event (no double counting)
  CONSTRAINT uq_bvm_source UNIQUE (source_type, source_id, direction)
);
CREATE INDEX IF NOT EXISTS idx_bvm_branch ON public.branch_vault_movement (branch_id, created_at);

-- Append-only vault ledger
CREATE OR REPLACE FUNCTION public.bvm_block_mutation() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'branch_vault_movement is append-only; post a reversing movement instead';
END $$;
DROP TRIGGER IF EXISTS trg_bvm_append_only ON public.branch_vault_movement;
CREATE TRIGGER trg_bvm_append_only BEFORE UPDATE OR DELETE ON public.branch_vault_movement
  FOR EACH ROW EXECUTE FUNCTION public.bvm_block_mutation();

ALTER TABLE public.delivery_cash_handover ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.petty_cash_request ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.branch_vault_movement ENABLE ROW LEVEL SECURITY;

-- bank_deposit_slip on live predates the Phase 4F 4.10 shape the code writes.
ALTER TABLE public.bank_deposit_slip ADD COLUMN IF NOT EXISTS denominations JSONB NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE public.bank_deposit_slip ADD COLUMN IF NOT EXISTS bank_ref_number TEXT;
ALTER TABLE public.bank_deposit_slip ADD COLUMN IF NOT EXISTS bank_value_date DATE;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_bank_deposit_sod_preparer_approver') THEN
    ALTER TABLE public.bank_deposit_slip
      ADD CONSTRAINT chk_bank_deposit_sod_preparer_approver CHECK (approved_by IS NULL OR prepared_by <> approved_by) NOT VALID,
      ADD CONSTRAINT chk_bank_deposit_sod_preparer_poster CHECK (posted_by IS NULL OR prepared_by <> posted_by) NOT VALID;
  END IF;
END $$;

-- GL 5296 Cash Over/Short: required by teller settlement + manual adjustments, missing on live.
INSERT INTO public.accounting_account (code, name, type, subtype, parent_id, level, is_group, is_system, is_active, created_by)
SELECT '5296', 'Cash Over/Short', 'EXPENSE', 'OPERATING_EXPENSE', p.id, p.level + 1, false, true, true, 'migration_20261114'
FROM public.accounting_account p
WHERE p.code = '5200'
  AND NOT EXISTS (SELECT 1 FROM public.accounting_account WHERE code = '5296');

COMMIT;
