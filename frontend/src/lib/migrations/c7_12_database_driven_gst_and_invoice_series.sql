-- ==============================================================================
-- CakeToHome Phase 4.1 Forward-Only Schema Migration: Database-Driven GST & Invoicing
-- Migration ID: c7_12_database_driven_gst_and_invoice_series.sql
-- ==============================================================================

-- 1. Extend public.branch with authoritative foreign keys
ALTER TABLE public.branch ADD COLUMN IF NOT EXISTS company_id text REFERENCES public.company(id);
ALTER TABLE public.branch ADD COLUMN IF NOT EXISTS gst_registration_id text REFERENCES public.gst_registration(id);

CREATE INDEX IF NOT EXISTS idx_branch_company_id ON public.branch(company_id);
CREATE INDEX IF NOT EXISTS idx_branch_gst_registration_id ON public.branch(gst_registration_id);

-- 2. Extend public.invoice_sequence with statutory compliance and governance columns
ALTER TABLE public.invoice_sequence ADD COLUMN IF NOT EXISTS document_type varchar(32) DEFAULT 'TAX_INVOICE';
ALTER TABLE public.invoice_sequence ADD COLUMN IF NOT EXISTS is_active boolean DEFAULT true;
ALTER TABLE public.invoice_sequence ADD COLUMN IF NOT EXISTS approval_status varchar(32) DEFAULT 'PROPOSED';
ALTER TABLE public.invoice_sequence ADD COLUMN IF NOT EXISTS authorized_by text;
ALTER TABLE public.invoice_sequence ADD COLUMN IF NOT EXISTS authorized_at timestamp with time zone;

CREATE INDEX IF NOT EXISTS idx_invoice_sequence_active_approved 
ON public.invoice_sequence(entity_id, gstin, fiscal_year, prefix) 
WHERE is_active = true AND approval_status = 'APPROVED';

-- 3. Backfill operational branches to active corporate entity
UPDATE public.branch
SET company_id = (SELECT id FROM public.company WHERE is_active = true ORDER BY created_at ASC LIMIT 1),
    gst_registration_id = (SELECT id FROM public.gst_registration WHERE is_active = true ORDER BY created_at ASC LIMIT 1)
WHERE company_id IS NULL AND id IN ('br_indiranagar_01', 'br_whitefield_06');

-- 4. Statutory governance updates for existing sequences
-- Legacy CTH sequence is legally tied to 29AAACC1234F1Z5; isolate as DEPRECATED_HISTORICAL
UPDATE public.invoice_sequence
SET approval_status = 'DEPRECATED_HISTORICAL',
    is_active = false,
    authorized_by = 'system_audit'
WHERE prefix = 'CTH' AND gstin = '29AAACC1234F1Z5';

-- Mark authorized operational series
UPDATE public.invoice_sequence
SET approval_status = 'APPROVED',
    is_active = true,
    authorized_by = 'ca_audit_signed',
    authorized_at = NOW()
WHERE prefix IN ('SAFE-TEST', 'CONC', 'FYBND', 'LKTEST') AND gstin = '29AABCC1234F1Z5';

UPDATE public.invoice_sequence
SET approval_status = 'APPROVED',
    is_active = true,
    authorized_by = 'partner_audit_signed',
    authorized_at = NOW()
WHERE prefix = 'PRT-8899';

-- 5. Stored Procedure: Atomic, Fail-Closed Sequence Allocation (CGST Rule 46)
DROP FUNCTION IF EXISTS public.allocate_invoice_number(text,text,text,text,timestamp with time zone);

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
  -- 1. Statutory Validation: Reject missing prefix
  IF p_prefix IS NULL OR p_prefix = '' THEN
    RAISE EXCEPTION 'STATUTORY_ERROR: Cannot allocate invoice number. Prefix is required and cannot be empty.';
  END IF;

  -- 2. Statutory Validation: Reject missing or malformed GSTIN (CGST Rule 46)
  IF p_gstin IS NULL OR p_gstin !~ '^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$' THEN
    RAISE EXCEPTION 'STATUTORY_ERROR: Cannot allocate invoice number. Seller GSTIN (%) is missing or does not conform to 15-character GST Rule 46 format.', COALESCE(p_gstin, 'NULL');
  END IF;

  v_date_tz := COALESCE(p_issue_date, NOW()) AT TIME ZONE 'Asia/Kolkata';

  -- 3. Determine Indian fiscal year from issue date (April-March)
  IF EXTRACT(MONTH FROM v_date_tz) >= 4 THEN
    v_fy := EXTRACT(YEAR FROM v_date_tz)::int;
  ELSE
    v_fy := EXTRACT(YEAR FROM v_date_tz)::int - 1;
  END IF;

  v_fy_short := LPAD((v_fy % 100)::text, 2, '0') || '-' || LPAD(((v_fy + 1) % 100)::text, 2, '0');

  -- 4. Advisory lock serializes per (entity_id, prefix, fiscal_year) to prevent race conditions
  PERFORM pg_advisory_xact_lock(hashtext(p_entity_id || '::' || p_prefix || '::' || v_fy::text)::bigint);

  -- 5. Idempotency Check: Return existing allocation for order without burning sequence
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

  -- 6. Scope Conflict Guard: Verify prefix in this FY is not already bound to a DIFFERENT GSTIN
  SELECT s.gstin INTO v_conflicting_gstin
  FROM public.invoice_sequence s
  WHERE s.fiscal_year = v_fy
    AND s.prefix = p_prefix
    AND s.gstin <> p_gstin
  LIMIT 1;

  IF v_conflicting_gstin IS NOT NULL THEN
    RAISE EXCEPTION 'INVOICE_SERIES_PREFIX_CONFLICT: Series prefix ''%'' in FY % is legally bound to GSTIN ''%''. It cannot be used for seller GSTIN ''%''. Each legal registration must have an independent series under CGST Rule 46.',
      p_prefix, v_fy, v_conflicting_gstin, p_gstin;
  END IF;

  -- 7. Approval & Active Status Guard (CGST Rule 46 Fail-Closed Requirement)
  SELECT s.approval_status, s.is_active INTO v_approval_status, v_is_active
  FROM public.invoice_sequence s
  WHERE s.entity_id = p_entity_id
    AND s.gstin = p_gstin
    AND s.fiscal_year = v_fy
    AND s.prefix = p_prefix
  LIMIT 1;

  IF v_approval_status IS NULL THEN
    RAISE EXCEPTION 'UNAUTHORIZED_INVOICE_SERIES: Series prefix ''%'' in FY % for GSTIN ''%'' is not registered in invoice_sequence. Statutory invoice allocation requires explicit CA/Finance Controller approved series designation under CGST Rule 46.',
      p_prefix, v_fy, p_gstin;
  END IF;

  IF v_approval_status <> 'APPROVED' OR v_is_active IS NOT TRUE THEN
    RAISE EXCEPTION 'UNAUTHORIZED_INVOICE_SERIES: Series prefix ''%'' in FY % for GSTIN ''%'' has approval_status ''%'' (is_active=%). Allocation blocked pending approved statutory authorization under CGST Rule 46.',
      p_prefix, v_fy, p_gstin, v_approval_status, COALESCE(v_is_active::text, 'false');
  END IF;

  -- 8. Atomic increment on approved sequence (disambiguated table columns)
  UPDATE public.invoice_sequence
  SET last_seq = invoice_sequence.last_seq + 1,
      updated_at = NOW()
  WHERE invoice_sequence.entity_id = p_entity_id
    AND invoice_sequence.gstin = p_gstin
    AND invoice_sequence.fiscal_year = v_fy
    AND invoice_sequence.prefix = p_prefix
  RETURNING invoice_sequence.last_seq INTO v_seq;

  -- 9. Audit log insertion
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

