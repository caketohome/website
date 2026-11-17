-- Accounting setup data for the live database.
-- 1. Expense category -> GL account mapping (from frontend/migrate_c5_expense_accounting.js CATEGORY_COA_MAP).
--    Without it, expense posting has no ledger account to debit.
-- 2. Company legal details (from CakeToHome_Policies_and_Terms.docx, section 12) shown on tax invoices.
-- Only fills empty values; never overwrites existing data.
BEGIN;

WITH map(cat_id, code) AS (VALUES
  ('excat_rent', '5210'), ('excat_electricity', '5220'), ('excat_internet', '5280'),
  ('excat_salaries', '5250'), ('excat_marketing', '5260'), ('excat_packaging', '5130'),
  ('excat_maintenance', '5270'), ('excat_office', '5299'), ('excat_fuel', '5230'),
  ('excat_cleaning', '5299'), ('excat_other', '5299')
)
UPDATE public.expense_category ec
SET gl_account_id = a.id, gl_account_code = a.code, updated_at = NOW()
FROM map JOIN public.accounting_account a ON a.code = map.code AND a.is_active AND a.deleted_at IS NULL
WHERE ec.id = map.cat_id AND ec.gl_account_id IS NULL;

UPDATE public.company SET
  registered_address = COALESCE(registered_address, '16/956, Thannimukku, Mayyanad, Kollam, Kerala - 691303'),
  city = COALESCE(city, 'Kollam'),
  pin_code = COALESCE(pin_code, '691303'),
  fssai = COALESCE(fssai, '21326133002408'),
  phone = COALESCE(phone, '+91 81389 16888'),
  email = COALESCE(email, 'caketohomeoffice@gmail.com'),
  website = COALESCE(website, 'https://cakestohome.com/'),
  updated_at = NOW()
WHERE id = 'cth_company_64fc4c1a-03ec-447b-af8c-70115d2007fd';

COMMIT;
