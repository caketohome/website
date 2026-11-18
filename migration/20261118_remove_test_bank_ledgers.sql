-- Remove 7 test bank ledgers left in the chart of accounts by earlier bank-account test runs
-- (1112-01 "SBI Operating 3344", 1112-02..07 "Axis Corporate Treasury ..."). Verified unreferenced:
-- no journal lines, no bank_account rows, no other table mentions their ids. Soft delete (reversible).
-- uq_accounting_account_code is unique over ALL rows (incl. deleted) and the bank-account code generator
-- skips deleted rows, so free the codes too or the first real bank account (1112-01) would collide.
BEGIN;
UPDATE public.accounting_account
   SET deleted_at = COALESCE(deleted_at, NOW()), is_active = false, updated_at = NOW(),
       code = 'DEL-' || code || '-' || right(id, 5),
       metadata = COALESCE(metadata, '{}'::jsonb) || jsonb_build_object('original_code', code, 'removed_reason', 'test bank ledger')
 WHERE code ~ '^1112-0[1-7]$'
   AND id LIKE 'acc_bank_%'
   AND NOT EXISTS (SELECT 1 FROM public.accounting_journal_line jl WHERE jl.account_id = accounting_account.id)
   AND NOT EXISTS (SELECT 1 FROM public.bank_account ba WHERE accounting_account.id IN (ba.gl_account_id, ba.offset_gl_account_id, ba.interest_gl_account_id, ba.bank_charges_gl_account_id));
COMMIT;
