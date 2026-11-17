-- Align displayed invoice prefix with the approved invoice series (CH).
BEGIN;

UPDATE public.setting
SET value = jsonb_set(value::jsonb, '{invoice_prefix}', '"CH"')::text, updated_at = NOW()
WHERE id = 'set_invoice_settings' AND value::jsonb->>'invoice_prefix' = 'CTH';

UPDATE public.company
SET invoice_prefix = 'CH', updated_at = NOW()
WHERE id = 'cth_company_64fc4c1a-03ec-447b-af8c-70115d2007fd' AND invoice_prefix = 'CTH';

COMMIT;
