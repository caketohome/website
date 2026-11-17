-- Live data corrections (2026-11-17):
-- 1. Kerala cities were created with letter state code 'KL'; city.state_code holds the GST numeric code ('32').
-- 2. Archive the two fake Bengaluru stores (soft delete; restorable).
-- FY2027-28 periods are NOT created here: the automatic rollover creates them from 1 April 2027.
BEGIN;

UPDATE public.city SET state_code = '32', updated_at = NOW()
WHERE state_id = 'state_kl' AND state_code = 'KL';

UPDATE public.branch SET deleted_at = NOW(), is_open = false, updated_at = NOW()
WHERE id IN ('br_indiranagar_01', 'br_whitefield_06') AND deleted_at IS NULL;

COMMIT;
