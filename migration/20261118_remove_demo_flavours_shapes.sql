-- Remove the 9 demo flavours and shapes seeded by the original code (Belgian Dark Chocolate, Red Velvet,
-- Alphonso Mango, Lotus Biscoff, Ferrero Rocher; Round, Heart, Square, 2-Tier Designer).
-- Unreferenced (no product selects them). Soft delete, same as the admin Delete button (reversible).
BEGIN;
UPDATE public.variant_option
   SET deleted_at = NOW(), status = 'archived', is_enabled = false, updated_at = NOW()
 WHERE id IN ('opt_f_01','opt_f_02','opt_f_03','opt_f_04','opt_f_05','opt_s_01','opt_s_02','opt_s_03','opt_s_04')
   AND type IN ('flavour','shape')
   AND deleted_at IS NULL;
COMMIT;
