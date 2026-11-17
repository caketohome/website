-- Tax master (tax-resolver.service.ts) writes product.updated_at when assigning a tax rate.
BEGIN;
ALTER TABLE public.product ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
COMMIT;
