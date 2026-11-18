-- order.payment_status defaulted to 'paid' and payment_method to 'online'. Insert paths that don't set the
-- columns (admin/manual orders via persistOrderToDb, OrderRepository.create) therefore recorded COD/unpaid
-- orders as paid online. Readers already fall back to metadata when the column is NULL, so drop the defaults.
-- Nullable columns, no triggers/checks depend on them. Existing rows are untouched.
BEGIN;
ALTER TABLE public."order" ALTER COLUMN payment_status DROP DEFAULT;
ALTER TABLE public."order" ALTER COLUMN payment_method DROP DEFAULT;
COMMIT;
