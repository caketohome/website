-- Branch reimbursements may be paid back by bank transfer or in cash.
BEGIN;
ALTER TABLE public.branch_reimbursement ADD COLUMN IF NOT EXISTS payment_method TEXT CHECK (payment_method IN ('BANK', 'CASH'));
ALTER TABLE public.branch_reimbursement ADD COLUMN IF NOT EXISTS cash_account_id TEXT;
COMMIT;
