-- Set the business's real GST identity (source: CakeToHome_Policies_and_Terms.docx, section 12).
-- GSTIN 32CQWPP4392J1Z2 (Kerala); PAN CQWPP4392J is GSTIN characters 3-12.
-- Safe only while no invoice numbers have been issued (guarded below).
BEGIN;

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM public.invoice_allocation_log) OR EXISTS (SELECT 1 FROM public.invoice_sequence WHERE last_seq > 0) THEN
    RAISE EXCEPTION 'Invoice numbers already issued; re-binding series GSTIN is not allowed.';
  END IF;
END $$;

UPDATE public.gst_registration
SET gstin = '32CQWPP4392J1Z2', updated_at = NOW()
WHERE id = 'gst_kerala_primary';

UPDATE public.invoice_sequence
SET gstin = '32CQWPP4392J1Z2', updated_at = NOW()
WHERE gstin = '29AABCC1234F1Z5' AND entity_id = 'CAKETOHOME_PARENT';

UPDATE public.company
SET pan = 'CQWPP4392J', updated_at = NOW()
WHERE id = 'cth_company_64fc4c1a-03ec-447b-af8c-70115d2007fd' AND pan = 'AABCC1234F';

-- Placeholder branch GSTIN would override gst_registration in order snapshots.
UPDATE public.branch
SET metadata = metadata - 'gstin'
WHERE metadata->>'gstin' = '29AAACC1234F1Z5';

COMMIT;
