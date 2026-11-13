-- Live accounting configuration (values chosen by the business owner, 2026-11-14):
--   accounting start date 2026-04-01; FY2026-27 as 12 monthly periods;
--   petty cash imprest limit ₹5,000 per branch; opening drawer cash ₹0 (no opening journal needed).
-- Idempotent. Apply AFTER 20261114_teller_cash_tables.sql. Do not apply to production without authorization.

BEGIN;

INSERT INTO public.setting (id, key, value, "group", description)
SELECT 'setting_accounting_start_date', 'accounting_start_date', '2026-04-01', 'accounting',
       'Official ledger cut-off: postings dated before this are rejected'
WHERE NOT EXISTS (SELECT 1 FROM public.setting WHERE key = 'accounting_start_date' AND deleted_at IS NULL);

INSERT INTO public.accounting_fiscal_period (fiscal_year, period_name, start_date, end_date, is_locked)
SELECT 'FY2026-27',
       to_char(m, 'Mon-YYYY'),
       m::date,
       (m + interval '1 month' - interval '1 day')::date,
       false
FROM generate_series(date '2026-04-01', date '2027-03-01', interval '1 month') AS m
WHERE NOT EXISTS (
  SELECT 1 FROM public.accounting_fiscal_period p
  WHERE p.start_date <= (m + interval '1 month' - interval '1 day')::date AND p.end_date >= m::date
);

UPDATE public.branch
SET metadata = COALESCE(metadata, '{}'::jsonb) || '{"petty_cash_imprest_limit": 5000}'::jsonb
WHERE metadata->>'petty_cash_imprest_limit' IS NULL;

COMMIT;
