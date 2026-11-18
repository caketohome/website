-- 1) Branch-paid expenses: a branch pays a company expense from its own money (e.g. no COD cash in the
--    drawer). The company owes the branch → liability 2154 "Due to Branches", tracked per branch in
--    branch_reimbursement until it is reimbursed (Pay) or cancelled (Reverse).
-- 2) Parent company (Baked) purchases are configured in setting(group='intercompany') — no table needed;
--    they are ordinary purchase bills against the Baked supplier (Bills Payable).
BEGIN;

INSERT INTO public.accounting_account (id, code, name, type, subtype, parent_id, level, is_group, is_system, is_active, description, created_by, created_at, updated_at)
SELECT 'acc_gl_2154_due_to_branches', '2154', 'Due to Branches (Branch-paid Reimbursements)', 'LIABILITY', 'CURRENT_LIABILITY',
       p.id, COALESCE(p.level, 2) + 1, false, true, true,
       'Company expenses paid by a branch from its own funds, owed back to the branch.', 'system_seed', NOW(), NOW()
  FROM public.accounting_account p
 WHERE p.code = '2150' AND p.deleted_at IS NULL
   AND NOT EXISTS (SELECT 1 FROM public.accounting_account a WHERE a.code = '2154');

ALTER TABLE public.expense DROP CONSTRAINT IF EXISTS expense_settlement_type_check;
ALTER TABLE public.expense ADD CONSTRAINT expense_settlement_type_check
  CHECK ((settlement_type)::text = ANY (ARRAY['DIRECT_PAYMENT', 'CREDIT_ACCRUAL', 'BRANCH_PAID']::text[]));

CREATE TABLE IF NOT EXISTS public.branch_reimbursement (
  id                  TEXT PRIMARY KEY,
  branch_id           TEXT NOT NULL,
  source_type         TEXT NOT NULL CHECK (source_type IN ('EXPENSE')),
  source_id           TEXT NOT NULL,
  source_voucher_id   TEXT,
  description         TEXT NOT NULL DEFAULT '',
  amount              NUMERIC(14,2) NOT NULL CHECK (amount > 0),
  status              TEXT NOT NULL DEFAULT 'OPEN' CHECK (status IN ('OPEN', 'PAID', 'REVERSED')),
  payment_voucher_id  TEXT,
  bank_account_id     TEXT,
  paid_at             TIMESTAMPTZ,
  paid_by             TEXT,
  reversed_at         TIMESTAMPTZ,
  reversed_by         TEXT,
  reversal_reason     TEXT,
  created_by          TEXT,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (source_type, source_id)
);
CREATE INDEX IF NOT EXISTS idx_branch_reimbursement_branch ON public.branch_reimbursement (branch_id, status);

COMMIT;

-- Fix: expense reversal sets status = 'REVERSED', which the status CHECK did not allow, so every
-- reversal failed at its final step.
BEGIN;
ALTER TABLE public.expense DROP CONSTRAINT IF EXISTS expense_status_check;
ALTER TABLE public.expense ADD CONSTRAINT expense_status_check
  CHECK (status = ANY (ARRAY['DRAFT', 'SUBMITTED', 'APPROVED', 'POSTED', 'REVERSED']));
COMMIT;
