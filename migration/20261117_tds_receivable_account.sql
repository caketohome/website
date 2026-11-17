-- TDS Receivable: TDS deducted by corporate customers on their payments to us (claimable against income tax).
-- 2130 TDS Payable already exists for TDS we deduct when paying suppliers.
BEGIN;

INSERT INTO public.accounting_account (code, name, type, subtype, parent_id, level, is_group, is_system, is_active, description, created_by, created_at, updated_at)
SELECT '1125', 'TDS Receivable', 'ASSET', 'CURRENT_ASSET', p.id, p.level + 1, false, true, true,
       'TDS deducted by customers on receipts; claimed against income tax (Form 26AS)', 'system_seed', NOW(), NOW()
FROM public.accounting_account p
WHERE p.code = '1120'
  AND NOT EXISTS (SELECT 1 FROM public.accounting_account WHERE code = '1125');

COMMIT;
