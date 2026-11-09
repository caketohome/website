-- ==============================================================================
-- CakeToHome Phase 4.3 Forward-Only Schema Migration: Statutory Approval Integrity & Governance
-- Migration ID: c7_13_statutory_approval_integrity_and_governance.sql
-- ==============================================================================

-- 1. Create immutable statutory invoice series approval audit log table
CREATE TABLE IF NOT EXISTS public.invoice_series_approval_audit (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  series_id UUID NOT NULL REFERENCES public.invoice_sequence(id) ON DELETE RESTRICT,
  prefix VARCHAR(16) NOT NULL,
  gstin VARCHAR(15) NOT NULL,
  fiscal_year INTEGER NOT NULL,
  previous_status VARCHAR(32),
  new_status VARCHAR(32) NOT NULL,
  action VARCHAR(32) NOT NULL,
  performed_by TEXT NOT NULL,
  reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_invoice_series_approval_audit_series_id 
  ON public.invoice_series_approval_audit(series_id);
CREATE INDEX IF NOT EXISTS idx_invoice_series_approval_audit_created_at 
  ON public.invoice_series_approval_audit(created_at);

-- 2. Enforce audit log immutability: block UPDATE and DELETE
CREATE OR REPLACE FUNCTION public.trg_block_invoice_series_audit_mutation()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'STATUTORY_SECURITY_VIOLATION: invoice_series_approval_audit is append-only. Updates and deletions are strictly prohibited.';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_invoice_series_audit_immutable ON public.invoice_series_approval_audit;
CREATE TRIGGER trg_invoice_series_audit_immutable
  BEFORE UPDATE OR DELETE ON public.invoice_series_approval_audit
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_block_invoice_series_audit_mutation();

-- 3. Add CHECK constraints on public.invoice_sequence
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'chk_invoice_sequence_prefix_format'
  ) THEN
    ALTER TABLE public.invoice_sequence 
      ADD CONSTRAINT chk_invoice_sequence_prefix_format 
      CHECK (prefix ~ '^[A-Za-z0-9\-_]{1,16}$');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'chk_invoice_sequence_approval_status'
  ) THEN
    ALTER TABLE public.invoice_sequence 
      ADD CONSTRAINT chk_invoice_sequence_approval_status 
      CHECK (approval_status IN ('PROPOSED', 'APPROVED', 'SUSPENDED', 'REVOKED', 'DEPRECATED_HISTORICAL', 'REVOKED_SYNTHETIC'));
  END IF;
END $$;

-- 4. Reclassify and neutralize any synthetic approvals injected by c7_12
UPDATE public.invoice_sequence
SET approval_status = 'REVOKED_SYNTHETIC',
    is_active = false,
    updated_at = NOW()
WHERE authorized_by IN ('ca_audit_signed', 'partner_audit_signed')
  AND approval_status = 'APPROVED';

-- 5. Log remediation audit entry for the revoked synthetic sequences
INSERT INTO public.invoice_series_approval_audit (
  series_id, prefix, gstin, fiscal_year, previous_status, new_status, action, performed_by, reason
)
SELECT 
  id, prefix, gstin, fiscal_year, 'APPROVED', 'REVOKED_SYNTHETIC', 'REVOCATION', 'migration_c7_13_governance', 'Reclassified synthetic migration approval to REVOKED_SYNTHETIC under Phase 4.3 governance'
FROM public.invoice_sequence
WHERE approval_status = 'REVOKED_SYNTHETIC'
ON CONFLICT DO NOTHING;

-- 6. State Machine & Integrity Trigger on public.invoice_sequence
CREATE OR REPLACE FUNCTION public.trg_enforce_invoice_series_governance()
RETURNS TRIGGER AS $$
BEGIN
  -- 6.1 Block synthetic approver strings from ever granting APPROVED status
  IF NEW.approval_status = 'APPROVED' AND (
    NEW.authorized_by IS NULL OR 
    NEW.authorized_by IN ('ca_audit_signed', 'partner_audit_signed', 'system_audit', 'system', 'admin') OR
    NEW.authorized_by ~* '^(ca_audit|partner_audit|test_|synthetic)'
  ) THEN
    RAISE EXCEPTION 'STATUTORY_SECURITY_VIOLATION: Synthetic or unverified approver identity ''%'' cannot approve statutory invoice series under CGST Rule 46.', COALESCE(NEW.authorized_by, 'NULL');
  END IF;

  -- 6.2 Approval requires authorized_at timestamp
  IF NEW.approval_status = 'APPROVED' AND NEW.authorized_at IS NULL THEN
    NEW.authorized_at := NOW();
  END IF;

  -- 6.3 Enforce terminal state immutability
  IF OLD.approval_status = 'DEPRECATED_HISTORICAL' AND NEW.approval_status <> 'DEPRECATED_HISTORICAL' THEN
    RAISE EXCEPTION 'STATUTORY_SECURITY_VIOLATION: Legacy series with status DEPRECATED_HISTORICAL is permanently immutable and cannot be re-activated or approved.';
  END IF;

  IF OLD.approval_status = 'REVOKED_SYNTHETIC' AND NEW.approval_status <> 'REVOKED_SYNTHETIC' THEN
    RAISE EXCEPTION 'STATUTORY_SECURITY_VIOLATION: Series with status REVOKED_SYNTHETIC is permanently sealed and cannot be approved.';
  END IF;

  -- 6.4 Transition validation
  IF OLD.approval_status = 'APPROVED' AND NEW.approval_status = 'PROPOSED' THEN
    RAISE EXCEPTION 'STATUTORY_STATE_ERROR: Approved series cannot revert to PROPOSED.';
  END IF;

  -- 6.5 Record state transitions into immutable audit log
  IF OLD.approval_status IS DISTINCT FROM NEW.approval_status THEN
    INSERT INTO public.invoice_series_approval_audit (
      series_id, prefix, gstin, fiscal_year, previous_status, new_status, action, performed_by, reason
    ) VALUES (
      NEW.id, NEW.prefix, NEW.gstin, NEW.fiscal_year, OLD.approval_status, NEW.approval_status, NEW.approval_status, COALESCE(NEW.authorized_by, 'system_trigger'), 'Trigger-enforced state transition'
    );
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_invoice_sequence_governance ON public.invoice_sequence;
CREATE TRIGGER trg_invoice_sequence_governance
  BEFORE UPDATE ON public.invoice_sequence
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_enforce_invoice_series_governance();

