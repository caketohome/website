-- Remove the seeded "Main Branch Cash Drawer" (cash_main_01, created_by system_seed) showing a made-up
-- ₹5,000 balance. Only if nothing has been posted against it. Soft delete (reversible).
BEGIN;
UPDATE public.cash_account
   SET deleted_at = NOW(), status = 'INACTIVE', updated_at = NOW(), updated_by = 'cleanup_fake_seed'
 WHERE id = 'cash_main_01'
   AND created_by = 'system_seed'
   AND deleted_at IS NULL
   AND NOT EXISTS (SELECT 1 FROM public.petty_cash_request p WHERE to_jsonb(p)::text LIKE '%cash_main_01%')
   AND NOT EXISTS (SELECT 1 FROM public.delivery_cash_handover d WHERE to_jsonb(d)::text LIKE '%cash_main_01%');
COMMIT;
