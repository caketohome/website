-- ==============================================================================
-- CakeToHome Phase 4.4 Forward-Only Schema Migration: Database Trigger & Truncate Governance
-- Migration ID: c7_14_database_trigger_and_truncate_governance.sql
-- ==============================================================================

-- 1. Upgrade invoice_sequence governance trigger to intercept INSERT and UPDATE
CREATE OR REPLACE FUNCTION public.trg_enforce_invoice_series_governance()
RETURNS TRIGGER AS $$
BEGIN
  -- 1.1 Direct insertion in APPROVED status is strictly prohibited
  IF TG_OP = 'INSERT' AND NEW.approval_status = 'APPROVED' THEN
    RAISE EXCEPTION 'STATUTORY_SECURITY_VIOLATION: Direct insertion of series in APPROVED status is prohibited. Series must be created in PROPOSED status and approved through authorized workflow.'
      USING ERRCODE = '23514';
  END IF;

  -- 1.2 Block synthetic approver strings from ever granting APPROVED status
  IF NEW.approval_status = 'APPROVED' AND (
    NEW.authorized_by IS NULL OR 
    NEW.authorized_by IN ('ca_audit_signed', 'partner_audit_signed', 'system_audit', 'system', 'admin') OR
    NEW.authorized_by ~* '^(ca_audit|partner_audit|test_|synthetic)'
  ) THEN
    RAISE EXCEPTION 'STATUTORY_SECURITY_VIOLATION: Synthetic or unverified approver identity ''%'' cannot approve statutory invoice series under CGST Rule 46.', COALESCE(NEW.authorized_by, 'NULL')
      USING ERRCODE = '23514';
  END IF;

  -- 1.3 Approval requires authorized_at timestamp
  IF NEW.approval_status = 'APPROVED' AND NEW.authorized_at IS NULL THEN
    NEW.authorized_at := NOW();
  END IF;

  -- 1.4 For UPDATE: enforce terminal state immutability
  IF TG_OP = 'UPDATE' THEN
    IF OLD.approval_status = 'DEPRECATED_HISTORICAL' AND NEW.approval_status <> 'DEPRECATED_HISTORICAL' THEN
      RAISE EXCEPTION 'STATUTORY_SECURITY_VIOLATION: Legacy series with status DEPRECATED_HISTORICAL is permanently immutable and cannot be re-activated or approved.'
        USING ERRCODE = '23514';
    END IF;

    IF OLD.approval_status = 'REVOKED_SYNTHETIC' AND NEW.approval_status <> 'REVOKED_SYNTHETIC' THEN
      RAISE EXCEPTION 'STATUTORY_SECURITY_VIOLATION: Series with status REVOKED_SYNTHETIC is permanently sealed and cannot be approved.'
        USING ERRCODE = '23514';
    END IF;

    -- Transition validation: Approved series cannot revert to PROPOSED
    IF OLD.approval_status = 'APPROVED' AND NEW.approval_status = 'PROPOSED' THEN
      RAISE EXCEPTION 'STATUTORY_STATE_ERROR: Approved series cannot revert to PROPOSED.'
        USING ERRCODE = '23514';
    END IF;

    -- Record state transitions into immutable audit log
    IF OLD.approval_status IS DISTINCT FROM NEW.approval_status THEN
      INSERT INTO public.invoice_series_approval_audit (
        series_id, prefix, gstin, fiscal_year, previous_status, new_status, action, performed_by, reason
      ) VALUES (
        NEW.id, NEW.prefix, NEW.gstin, NEW.fiscal_year, OLD.approval_status, NEW.approval_status, NEW.approval_status, COALESCE(NEW.authorized_by, 'system_trigger'), 'Trigger-enforced state transition'
      );
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_invoice_sequence_governance ON public.invoice_sequence;
CREATE TRIGGER trg_invoice_sequence_governance
  BEFORE INSERT OR UPDATE ON public.invoice_sequence
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_enforce_invoice_series_governance();

-- 2. Statement-level TRUNCATE protection on invoice_series_approval_audit
CREATE OR REPLACE FUNCTION public.trg_block_invoice_series_audit_truncate()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'STATUTORY_SECURITY_VIOLATION: invoice_series_approval_audit is append-only. TRUNCATE is strictly prohibited.'
    USING ERRCODE = '23514';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_invoice_series_audit_truncate ON public.invoice_series_approval_audit;
CREATE TRIGGER trg_invoice_series_audit_truncate
  BEFORE TRUNCATE ON public.invoice_series_approval_audit
  FOR EACH STATEMENT
  EXECUTE FUNCTION public.trg_block_invoice_series_audit_truncate();

-- 3. Mark triggers ENABLE ALWAYS so replication role cannot suppress them
ALTER TABLE public.invoice_sequence
  ENABLE ALWAYS TRIGGER trg_invoice_sequence_governance;

ALTER TABLE public.invoice_series_approval_audit
  ENABLE ALWAYS TRIGGER trg_invoice_series_audit_immutable;

ALTER TABLE public.invoice_series_approval_audit
  ENABLE ALWAYS TRIGGER trg_invoice_series_audit_truncate;
