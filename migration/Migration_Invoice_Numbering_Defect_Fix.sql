-- ============================================================================
-- PROPOSED MIGRATION: Statutory Invoice Scope Disambiguation & Defect Fix
-- File: migration/Migration_Invoice_Numbering_Defect_Fix.sql
-- Status: PROPOSED / UNEXECUTED (REVIEW ONLY — DO NOT EXECUTE ON PRODUCTION)
-- Execution Authorization: STRICTLY NOT AUTHORIZED (Isolated Test Environment Only)
-- Release Verdict: HOLD / STAGED NO-GO
-- ============================================================================
-- Statutory & Architectural Rationale:
-- 1. Defect Identified in Prior Draft:
--    The expression `gstin = COALESCE(EXCLUDED.gstin, invoice_sequence.gstin)`
--    in an UPSERT with constraint (entity_id, fiscal_year, prefix) permitted
--    an existing sequence row to be silently mutated and reassigned to a
--    different seller GSTIN. Under CGST Rule 46(b), sequential serial numbers
--    belong strictly to a specific registered person (GSTIN). A counter must
--    NEVER be silently transferred or commingled across differing registrations.
-- 2. Correct Scope Authority:
--    The true numbering scope must be strictly defined by:
--      (entity_id, gstin, fiscal_year, prefix)
--    If an entity changes its GST registration, the new GSTIN CANNOT silently
--    inherit or overwrite an existing series. Any attempt to use an existing
--    series prefix with a differing GSTIN is explicitly rejected as an
--    AMBIGUOUS_GSTIN_SEQUENCE_SCOPE error.
-- 3. Inactive Sequence:
--    `statutory_invoice_seq` (last_value = 192) is formally acknowledged as an
--    unreferenced legacy sequence. It is preserved without modification.
-- ============================================================================

-- Step 1: Update Unique Constraint on invoice_sequence to include GSTIN
DO $$
BEGIN
  -- Drop obsolete entity_fy_prefix constraint if exists
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'uq_invoice_sequence_entity_fy_prefix'
      AND conrelid = 'public.invoice_sequence'::regclass
  ) THEN
    ALTER TABLE public.invoice_sequence
      DROP CONSTRAINT uq_invoice_sequence_entity_fy_prefix;
  END IF;

  -- Add definitive statutory scope constraint: (entity_id, gstin, fiscal_year, prefix)
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'uq_invoice_sequence_entity_gstin_fy_prefix'
      AND conrelid = 'public.invoice_sequence'::regclass
  ) THEN
    ALTER TABLE public.invoice_sequence
      ADD CONSTRAINT uq_invoice_sequence_entity_gstin_fy_prefix
        UNIQUE (entity_id, gstin, fiscal_year, prefix);
  END IF;
END $$;

-- Step 2: Update allocate_invoice_number() with Strict Scope Disambiguation
CREATE OR REPLACE FUNCTION public.allocate_invoice_number(
  p_prefix TEXT DEFAULT 'CTH',
  p_order_id TEXT DEFAULT NULL,
  p_entity_id TEXT DEFAULT 'CAKETOHOME_PARENT',
  p_gstin TEXT DEFAULT NULL,
  p_issue_date TIMESTAMPTZ DEFAULT NOW()
) RETURNS TABLE (
  invoice_number TEXT,
  fiscal_year INTEGER,
  sequence_value INTEGER
) LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_fy INTEGER;
  v_fy_short TEXT;
  v_seq INTEGER;
  v_date_tz TIMESTAMPTZ;
  v_existing_invoice_number TEXT;
  v_existing_fy INTEGER;
  v_existing_seq INTEGER;
  v_conflicting_gstin TEXT;
BEGIN
  -- 1. Statutory Validation: Reject missing or malformed GSTIN (CGST Rule 46)
  IF p_gstin IS NULL OR p_gstin !~ '^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$' THEN
    RAISE EXCEPTION 'STATUTORY_ERROR: Cannot allocate invoice number. Seller GSTIN (%) is missing or does not conform to 15-character GST Rule 46 format.', COALESCE(p_gstin, 'NULL');
  END IF;

  v_date_tz := COALESCE(p_issue_date, NOW()) AT TIME ZONE 'Asia/Kolkata';

  -- 2. Determine Indian fiscal year from issue date (April-March)
  IF EXTRACT(MONTH FROM v_date_tz) >= 4 THEN
    v_fy := EXTRACT(YEAR FROM v_date_tz)::int;
  ELSE
    v_fy := EXTRACT(YEAR FROM v_date_tz)::int - 1;
  END IF;

  v_fy_short := LPAD((v_fy % 100)::text, 2, '0') || '-' || LPAD(((v_fy + 1) % 100)::text, 2, '0');

  -- 3. Advisory lock serializes per (entity_id, prefix, fiscal_year) to prevent concurrent prefix-claim races across differing GSTINs
  PERFORM pg_advisory_xact_lock(hashtext(p_entity_id || '::' || p_prefix || '::' || v_fy::text)::bigint);

  -- 4. Idempotency Check: Return existing allocation for order without burning sequence
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

  -- 5. Scope Conflict Guard: Verify prefix in this FY is not already owned by a DIFFERENT GSTIN
  SELECT s.gstin INTO v_conflicting_gstin
  FROM public.invoice_sequence s
  WHERE s.entity_id = p_entity_id
    AND s.fiscal_year = v_fy
    AND s.prefix = p_prefix
    AND s.gstin <> p_gstin
  LIMIT 1;

  IF v_conflicting_gstin IS NOT NULL THEN
    RAISE EXCEPTION 'AMBIGUOUS_GSTIN_SEQUENCE_SCOPE: Series prefix ''%'' in FY % is already bound to GSTIN ''%''. Cannot allocate for differing GSTIN ''%''. Each legal registration must have an independent series under CGST Rule 46.',
      p_prefix, v_fy, v_conflicting_gstin, p_gstin;
  END IF;

  -- 6. Atomic increment on strictly scoped counter (entity_id, gstin, fiscal_year, prefix)
  INSERT INTO public.invoice_sequence (entity_id, gstin, fiscal_year, prefix, last_seq)
  VALUES (p_entity_id, p_gstin, v_fy, p_prefix, 1)
  ON CONFLICT ON CONSTRAINT uq_invoice_sequence_entity_gstin_fy_prefix DO UPDATE
    SET last_seq = invoice_sequence.last_seq + 1,
        updated_at = NOW()
  RETURNING invoice_sequence.last_seq INTO v_seq;

  -- 7. Audit log insertion
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
$$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    GRANT EXECUTE ON FUNCTION public.allocate_invoice_number(TEXT, TEXT, TEXT, TEXT, TIMESTAMPTZ) TO authenticated;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
    GRANT EXECUTE ON FUNCTION public.allocate_invoice_number(TEXT, TEXT, TEXT, TEXT, TIMESTAMPTZ) TO service_role;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'postgres') THEN
    GRANT EXECUTE ON FUNCTION public.allocate_invoice_number(TEXT, TEXT, TEXT, TEXT, TIMESTAMPTZ) TO postgres;
  END IF;
END $$;

-- End of Proposed Migration
