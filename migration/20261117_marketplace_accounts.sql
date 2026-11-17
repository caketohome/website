-- Commission-marketplace ledger accounts (we are the e-commerce operator; partners are the sellers).
--   2112 Marketplace Partner Payable   — partner's share of customer collections, owed until payout
--   2131 GST TCS Payable (Sec 52)      — 0.5% TCS on partners' net taxable supplies (GSTR-8)
--   4150 Marketplace Commission Income — our commission (18% GST on it posts to 2123/2124 or 2126)
-- 194-O TDS (0.1%) posts to existing 2130 TDS Payable with section 194O.
BEGIN;

INSERT INTO public.accounting_account (code, name, type, subtype, parent_id, level, is_group, is_system, is_active, description, created_by, created_at, updated_at)
SELECT v.code, v.name, v.type, v.subtype, p.id, p.level + 1, false, true, true, v.description, 'system_seed', NOW(), NOW()
FROM (VALUES
  ('2112', 'Marketplace Partner Payable', 'LIABILITY', 'PAYABLE', '2110', 'Collections owed to marketplace partners until payout'),
  ('2131', 'GST TCS Payable (Sec 52)', 'LIABILITY', 'CURRENT_LIABILITY', '2120', 'GST collected at source on marketplace partner supplies; filed in GSTR-8'),
  ('4150', 'Marketplace Commission Income', 'REVENUE', 'DIRECT_REVENUE', '4100', 'Commission earned on marketplace partner sales')
) AS v(code, name, type, subtype, parent_code, description)
JOIN public.accounting_account p ON p.code = v.parent_code
WHERE NOT EXISTS (SELECT 1 FROM public.accounting_account a WHERE a.code = v.code);

COMMIT;
