-- Accounting schema catch-up for the live database.
-- Creates objects the accounting code queries but the live DB lacks. Idempotent, no seed data.
-- Sources:
--   cost_centre, purchase_payment_allocation, customer_receipt_allocation, customer credit cols
--       <- frontend/migrate_phase_c7_1_schema_foundations.js
--   cost_allocation_*  <- frontend/migrate_phase_c7_6_step4a_cost_allocation_schema.js
--   invoice_generation_queue <- migration/Migration_Unique_Order_Invoice_Numbering_V2.sql (phase 4)
--   allocate_invoice_number  <- frontend/src/lib/migrations/c7_12_database_driven_gst_and_invoice_series.sql
--   audit_log, notification  <- Medusa module table shapes
--   purchase_payment         <- no DDL in repo; built from PurchasePaymentRow (src/lib/types/purchase.types.ts)
-- Deviations: live DB has no public."user" table, so created_by/approved_by-style columns are plain
-- text with no FK. Does NOT touch order numbering (order.service.ts has a working fallback).
BEGIN;

-- ── Cost centres ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.cost_centre (
  id TEXT PRIMARY KEY DEFAULT ('cc_' || gen_random_uuid()::text),
  code VARCHAR(50) UNIQUE NOT NULL,
  name VARCHAR(255) NOT NULL,
  department VARCHAR(100) NOT NULL,
  parent_id TEXT REFERENCES public.cost_centre(id) ON DELETE RESTRICT,
  company_id TEXT REFERENCES public.company(id) ON DELETE RESTRICT,
  branch_id TEXT REFERENCES public.branch(id) ON DELETE RESTRICT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_by TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_cost_centre_department ON public.cost_centre(department);
CREATE INDEX IF NOT EXISTS idx_cost_centre_parent_id ON public.cost_centre(parent_id);
CREATE INDEX IF NOT EXISTS idx_cost_centre_branch_id ON public.cost_centre(branch_id);
CREATE INDEX IF NOT EXISTS idx_cost_centre_company_id ON public.cost_centre(company_id);

-- Existing cost_centre_id columns on voucher/journal line were added without an FK.
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_accounting_voucher_cost_centre') THEN
    ALTER TABLE public.accounting_voucher ADD CONSTRAINT fk_accounting_voucher_cost_centre
      FOREIGN KEY (cost_centre_id) REFERENCES public.cost_centre(id) ON DELETE RESTRICT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_accounting_journal_line_cost_centre') THEN
    ALTER TABLE public.accounting_journal_line ADD CONSTRAINT fk_accounting_journal_line_cost_centre
      FOREIGN KEY (cost_centre_id) REFERENCES public.cost_centre(id) ON DELETE RESTRICT;
  END IF;
END $$;
CREATE INDEX IF NOT EXISTS idx_accounting_voucher_cost_centre_id
  ON public.accounting_voucher(cost_centre_id) WHERE cost_centre_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_accounting_journal_line_cost_centre_id
  ON public.accounting_journal_line(cost_centre_id) WHERE cost_centre_id IS NOT NULL;

-- ── Supplier payments (Bills Payable) ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.purchase_payment (
  id TEXT PRIMARY KEY,
  purchase_id TEXT NOT NULL REFERENCES public.purchase(id) ON DELETE RESTRICT,
  amount NUMERIC(15, 2) NOT NULL CHECK (amount > 0),
  method TEXT NOT NULL CHECK (method IN ('CASH', 'UPI', 'BANK_TRANSFER', 'CHEQUE', 'CARD', 'OTHER')),
  payment_date DATE NOT NULL,
  reference TEXT,
  created_by TEXT,
  voucher_id TEXT REFERENCES public.accounting_voucher(id) ON DELETE SET NULL,
  bank_account_id TEXT REFERENCES public.bank_account(id) ON DELETE RESTRICT,
  teller_session_id TEXT REFERENCES public.teller_session(id) ON DELETE RESTRICT,
  branch_id TEXT REFERENCES public.branch(id) ON DELETE RESTRICT,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_purchase_payment_purchase_id ON public.purchase_payment(purchase_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_purchase_payment_voucher_id ON public.purchase_payment(voucher_id) WHERE voucher_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_purchase_payment_bank_account_id ON public.purchase_payment(bank_account_id) WHERE bank_account_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_purchase_payment_teller_session_id ON public.purchase_payment(teller_session_id) WHERE teller_session_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_purchase_payment_branch_id ON public.purchase_payment(branch_id) WHERE branch_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.purchase_payment_allocation (
  id TEXT PRIMARY KEY DEFAULT ('ppa_' || gen_random_uuid()::text),
  payment_id TEXT NOT NULL REFERENCES public.purchase_payment(id) ON DELETE RESTRICT,
  purchase_id TEXT NOT NULL REFERENCES public.purchase(id) ON DELETE RESTRICT,
  allocated_amount NUMERIC(15, 2) NOT NULL CHECK (allocated_amount > 0),
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_ppa_payment_id ON public.purchase_payment_allocation(payment_id);
CREATE INDEX IF NOT EXISTS idx_ppa_purchase_id ON public.purchase_payment_allocation(purchase_id);

-- ── Customer receipts (Accounts Receivable) ──────────────────────────────────
CREATE TABLE IF NOT EXISTS public.customer_receipt_allocation (
  id TEXT PRIMARY KEY DEFAULT ('cra_' || gen_random_uuid()::text),
  invoice_id TEXT NOT NULL REFERENCES public.invoice(id) ON DELETE RESTRICT,
  voucher_id TEXT REFERENCES public.accounting_voucher(id) ON DELETE RESTRICT,
  payment_transaction_id TEXT REFERENCES public.payment_transaction(id) ON DELETE RESTRICT,
  allocated_amount NUMERIC(15, 2) NOT NULL CHECK (allocated_amount > 0),
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT chk_cra_source CHECK (voucher_id IS NOT NULL OR payment_transaction_id IS NOT NULL)
);
CREATE INDEX IF NOT EXISTS idx_cra_invoice_id ON public.customer_receipt_allocation(invoice_id);
CREATE INDEX IF NOT EXISTS idx_cra_voucher_id ON public.customer_receipt_allocation(voucher_id);
CREATE INDEX IF NOT EXISTS idx_cra_payment_tx_id ON public.customer_receipt_allocation(payment_transaction_id);

ALTER TABLE public.customer
  ADD COLUMN IF NOT EXISTS is_corporate BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS credit_enabled BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS credit_limit NUMERIC(15, 2) NOT NULL DEFAULT 0.00 CHECK (credit_limit >= 0),
  ADD COLUMN IF NOT EXISTS payment_terms_days INTEGER NOT NULL DEFAULT 0 CHECK (payment_terms_days >= 0),
  ADD COLUMN IF NOT EXISTS gstin VARCHAR(15),
  ADD COLUMN IF NOT EXISTS credit_balance NUMERIC(15, 2) NOT NULL DEFAULT 0.00,
  ADD COLUMN IF NOT EXISTS credit_status VARCHAR(50) NOT NULL DEFAULT 'INACTIVE',
  ADD COLUMN IF NOT EXISTS credit_approved_by TEXT,
  ADD COLUMN IF NOT EXISTS credit_approved_at TIMESTAMPTZ;

-- ── Cost allocation ──────────────────────────────────────────────────────────
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
  created_by TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ,
  CONSTRAINT chk_cost_allocation_rule_type CHECK (rule_type IN ('FIXED_PERCENTAGE', 'REVENUE_RATIO', 'EQUAL_SPLIT'))
);
CREATE INDEX IF NOT EXISTS idx_cost_allocation_rule_source_cc ON public.cost_allocation_rule(source_cost_centre_id);
CREATE INDEX IF NOT EXISTS idx_cost_allocation_rule_source_acct ON public.cost_allocation_rule(source_account_id);
CREATE INDEX IF NOT EXISTS idx_cost_allocation_rule_active ON public.cost_allocation_rule(is_active) WHERE deleted_at IS NULL;

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
CREATE INDEX IF NOT EXISTS idx_rule_target_cc_id ON public.cost_allocation_rule_target(target_cost_centre_id);
CREATE INDEX IF NOT EXISTS idx_rule_target_acct_id ON public.cost_allocation_rule_target(target_account_id) WHERE target_account_id IS NOT NULL;

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
  executed_by TEXT,
  executed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  approved_by TEXT,
  approved_at TIMESTAMPTZ,
  reversed_by TEXT,
  reversed_at TIMESTAMPTZ,
  reversal_reason TEXT,
  CONSTRAINT chk_cost_allocation_run_status CHECK (status IN ('PREVIEW', 'DRAFT', 'SUBMITTED', 'POSTED', 'REVERSED'))
);
CREATE INDEX IF NOT EXISTS idx_cost_allocation_run_rule_id ON public.cost_allocation_run(rule_id);
CREATE INDEX IF NOT EXISTS idx_cost_allocation_run_period ON public.cost_allocation_run(fiscal_year, period_name);
CREATE INDEX IF NOT EXISTS idx_cost_allocation_run_voucher ON public.cost_allocation_run(accounting_voucher_id) WHERE accounting_voucher_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_cost_allocation_run_status ON public.cost_allocation_run(status);

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

-- ── Audit log (fiscal period lock/unlock, year close/reopen) ─────────────────
CREATE TABLE IF NOT EXISTS public.audit_log (
  id TEXT PRIMARY KEY,
  actor_id TEXT,
  actor_type TEXT,
  action TEXT NOT NULL,
  entity TEXT,
  entity_id TEXT,
  ip_address TEXT,
  user_agent TEXT,
  metadata TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_audit_log_entity ON public.audit_log(entity, entity_id);

-- ── Invoice payment reminders (Bills Receivable) ─────────────────────────────
CREATE TABLE IF NOT EXISTS public.notification (
  id TEXT PRIMARY KEY,
  "to" TEXT NOT NULL,
  channel TEXT NOT NULL,
  template TEXT NOT NULL,
  data JSONB,
  trigger_type TEXT,
  resource_id TEXT,
  resource_type TEXT,
  receiver_id TEXT,
  original_notification_id TEXT,
  idempotency_key TEXT,
  external_id TEXT,
  provider_id TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_notification_resource ON public.notification(resource_type, resource_id) WHERE deleted_at IS NULL;

-- ── Invoice generation retry queue ───────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.invoice_generation_queue (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  order_id TEXT NOT NULL,
  entity_id TEXT NOT NULL DEFAULT 'CAKETOHOME_PARENT',
  prefix TEXT NOT NULL DEFAULT 'CTH',
  status TEXT NOT NULL DEFAULT 'PENDING',
  attempts INTEGER NOT NULL DEFAULT 0,
  max_attempts INTEGER NOT NULL DEFAULT 5,
  last_error TEXT,
  next_run_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  locked_at TIMESTAMPTZ,
  locked_by TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_invoice_queue_order UNIQUE (order_id)
);
ALTER TABLE public.invoice_generation_queue ENABLE ROW LEVEL SECURITY;

-- ── Statutory invoice number allocation (fail-closed, CGST Rule 46) ──────────
CREATE OR REPLACE FUNCTION public.allocate_invoice_number(
  p_prefix text,
  p_order_id text DEFAULT NULL::text,
  p_entity_id text DEFAULT 'CAKETOHOME_PARENT'::text,
  p_gstin text DEFAULT NULL::text,
  p_issue_date timestamp with time zone DEFAULT now()
)
 RETURNS TABLE(invoice_number text, fiscal_year integer, sequence_value integer)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_fy INTEGER;
  v_fy_short TEXT;
  v_seq INTEGER;
  v_date_tz TIMESTAMPTZ;
  v_existing_invoice_number TEXT;
  v_existing_fy INTEGER;
  v_existing_seq INTEGER;
  v_conflicting_gstin TEXT;
  v_approval_status TEXT;
  v_is_active BOOLEAN;
BEGIN
  IF p_prefix IS NULL OR p_prefix = '' THEN
    RAISE EXCEPTION 'STATUTORY_ERROR: Cannot allocate invoice number. Prefix is required and cannot be empty.';
  END IF;

  IF p_gstin IS NULL OR p_gstin !~ '^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$' THEN
    RAISE EXCEPTION 'STATUTORY_ERROR: Cannot allocate invoice number. Seller GSTIN (%) is missing or does not conform to 15-character GST Rule 46 format.', COALESCE(p_gstin, 'NULL');
  END IF;

  v_date_tz := COALESCE(p_issue_date, NOW()) AT TIME ZONE 'Asia/Kolkata';

  IF EXTRACT(MONTH FROM v_date_tz) >= 4 THEN
    v_fy := EXTRACT(YEAR FROM v_date_tz)::int;
  ELSE
    v_fy := EXTRACT(YEAR FROM v_date_tz)::int - 1;
  END IF;

  v_fy_short := LPAD((v_fy % 100)::text, 2, '0') || '-' || LPAD(((v_fy + 1) % 100)::text, 2, '0');

  PERFORM pg_advisory_xact_lock(hashtext(p_entity_id || '::' || p_prefix || '::' || v_fy::text)::bigint);

  IF p_order_id IS NOT NULL THEN
    SELECT ial.invoice_number, ial.fiscal_year, ial.sequence_value
    INTO v_existing_invoice_number, v_existing_fy, v_existing_seq
    FROM public.invoice_allocation_log ial
    WHERE ial.entity_id = p_entity_id
      AND ial.gstin = p_gstin
      AND ial.fiscal_year = v_fy
      AND ial.prefix = p_prefix
      AND ial.order_id = p_order_id
      AND ial.status IN ('ALLOCATED', 'COMMITTED')
    ORDER BY ial.allocated_at DESC
    LIMIT 1;

    IF v_existing_invoice_number IS NOT NULL THEN
      RETURN QUERY SELECT v_existing_invoice_number, v_existing_fy, v_existing_seq;
      RETURN;
    END IF;
  END IF;

  SELECT s.gstin INTO v_conflicting_gstin
  FROM public.invoice_sequence s
  WHERE s.fiscal_year = v_fy
    AND s.prefix = p_prefix
    AND s.gstin <> p_gstin
  LIMIT 1;

  IF v_conflicting_gstin IS NOT NULL THEN
    RAISE EXCEPTION 'INVOICE_SERIES_PREFIX_CONFLICT: Series prefix ''%'' in FY % is legally bound to GSTIN ''%''. It cannot be used for seller GSTIN ''%''.',
      p_prefix, v_fy, v_conflicting_gstin, p_gstin;
  END IF;

  SELECT s.approval_status, s.is_active INTO v_approval_status, v_is_active
  FROM public.invoice_sequence s
  WHERE s.entity_id = p_entity_id
    AND s.gstin = p_gstin
    AND s.fiscal_year = v_fy
    AND s.prefix = p_prefix
  LIMIT 1;

  IF v_approval_status IS NULL THEN
    RAISE EXCEPTION 'UNAUTHORIZED_INVOICE_SERIES: Series prefix ''%'' in FY % for GSTIN ''%'' is not registered in invoice_sequence.',
      p_prefix, v_fy, p_gstin;
  END IF;

  IF v_approval_status <> 'APPROVED' OR v_is_active IS NOT TRUE THEN
    RAISE EXCEPTION 'UNAUTHORIZED_INVOICE_SERIES: Series prefix ''%'' in FY % for GSTIN ''%'' has approval_status ''%'' (is_active=%).',
      p_prefix, v_fy, p_gstin, v_approval_status, COALESCE(v_is_active::text, 'false');
  END IF;

  UPDATE public.invoice_sequence
  SET last_seq = invoice_sequence.last_seq + 1,
      updated_at = NOW()
  WHERE invoice_sequence.entity_id = p_entity_id
    AND invoice_sequence.gstin = p_gstin
    AND invoice_sequence.fiscal_year = v_fy
    AND invoice_sequence.prefix = p_prefix
  RETURNING invoice_sequence.last_seq INTO v_seq;

  INSERT INTO public.invoice_allocation_log (
    entity_id, gstin, fiscal_year, prefix, sequence_value, invoice_number, order_id, status
  ) VALUES (
    p_entity_id, p_gstin, v_fy, p_prefix, v_seq,
    p_prefix || '/' || v_fy_short || '/' || LPAD(v_seq::text, 6, '0'),
    p_order_id, 'ALLOCATED'
  );

  RETURN QUERY SELECT
    p_prefix || '/' || v_fy_short || '/' || LPAD(v_seq::text, 6, '0'),
    v_fy,
    v_seq;
END;
$function$;

COMMIT;
