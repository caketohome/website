-- ==============================================================================
-- CakeToHome ERP — Staged Exemption Script for 13 Phase 4.9 COD Test Fixtures
-- 
-- STATUS: STAGED FOR REVIEW ONLY — DO NOT EXECUTE WITHOUT EXPLICIT AUTHORIZATION
-- PURPOSE: Classifies 13 synthetic test orders as invoicing-exempt test fixtures.
-- ZERO SEQUENCE BURNING: Prevents consuming statutory numbers CTH/26-27/000194+
-- ZERO ACCOUNTING CORRUPTION: Prevents phantom sales vouchers and COD till drift
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- PRE-FLIGHT READ-ONLY VERIFICATION
-- ------------------------------------------------------------------------------
-- Confirm target orders exist and verify current state before any change:
SELECT 
  id, 
  order_number, 
  status, 
  metadata->>'delivery_status' as delivery_status,
  metadata->>'total' as total,
  metadata->>'classification' as current_classification,
  metadata->>'invoicing_exempt' as current_invoicing_exempt
FROM public."order"
WHERE id IN (
  'ord_test_cod_1792216816562',
  'ord_test_cod_1792216866898',
  'ord_test_cod_1792217303420',
  'ord_test_cod_1792217567929',
  'ord_test_cod_1792218199553',
  'ord_test_cod_1792218268062',
  'ord_test_cod_1792218470807',
  'ord_test_cod_1792219136677',
  'ord_test_cod_1792219161849',
  'ord_test_cod_1792219239431',
  'ord_test_cod_1792219314509',
  'ord_test_cod_1792219412950',
  'ord_test_cod_1792220817636'
)
ORDER BY created_at ASC;


-- ------------------------------------------------------------------------------
-- STAGED UPDATE STATEMENT (DO NOT EXECUTE WITHOUT APPROVAL)
-- ------------------------------------------------------------------------------
/*
BEGIN;

UPDATE public."order"
SET metadata = jsonb_set(
  jsonb_set(
    jsonb_set(
      COALESCE(metadata, '{}'::jsonb),
      '{classification}',
      '"TEST"'::jsonb
    ),
    '{invoicing_exempt}',
    'true'::jsonb
  ),
  '{invoicing_exemption}',
  jsonb_build_object(
    'exempt', true,
    'decision', 'OPTION_A_TEST_EXEMPTION',
    'reason', 'PHASE_4_9_COD_TEST_FIXTURE_NO_LINE_ITEMS',
    'statutory_basis', 'CGST_ACT_2017_SEC_31_NON_SUPPLY_FIXTURE',
    'reviewed_by', 'finance_compliance_reviewer',
    'authorized_at', NOW(),
    'preserved_total', metadata->>'total',
    'preserved_payment_method', metadata->>'payment_method',
    'preserved_cod_custody', metadata->'cod_custody_event'
  )
),
updated_at = NOW()
WHERE id IN (
  'ord_test_cod_1792216816562',
  'ord_test_cod_1792216866898',
  'ord_test_cod_1792217303420',
  'ord_test_cod_1792217567929',
  'ord_test_cod_1792218199553',
  'ord_test_cod_1792218268062',
  'ord_test_cod_1792218470807',
  'ord_test_cod_1792219136677',
  'ord_test_cod_1792219161849',
  'ord_test_cod_1792219239431',
  'ord_test_cod_1792219314509',
  'ord_test_cod_1792219412950',
  'ord_test_cod_1792220817636'
);

-- In-flight verification guard: Must affect exactly 13 rows
DO $$
DECLARE
  v_updated INT;
BEGIN
  GET DIAGNOSTICS v_updated = ROW_COUNT;
  IF v_updated != 13 THEN
    RAISE EXCEPTION 'STAGED EXEMPTION ABORT: Expected 13 rows updated, got %', v_updated;
  END IF;
END $$;

COMMIT;
*/


-- ------------------------------------------------------------------------------
-- ROLLBACK STATEMENT (IN CASE OF EMERGENCY REVERSAL)
-- ------------------------------------------------------------------------------
/*
BEGIN;

UPDATE public."order"
SET metadata = metadata - 'invoicing_exempt' - 'invoicing_exemption',
    updated_at = NOW()
WHERE id IN (
  'ord_test_cod_1792216816562',
  'ord_test_cod_1792216866898',
  'ord_test_cod_1792217303420',
  'ord_test_cod_1792217567929',
  'ord_test_cod_1792218199553',
  'ord_test_cod_1792218268062',
  'ord_test_cod_1792218470807',
  'ord_test_cod_1792219136677',
  'ord_test_cod_1792219161849',
  'ord_test_cod_1792219239431',
  'ord_test_cod_1792219314509',
  'ord_test_cod_1792219412950',
  'ord_test_cod_1792220817636'
);

COMMIT;
*/
