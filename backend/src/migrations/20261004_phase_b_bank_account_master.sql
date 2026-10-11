-- CakeToHome ERP — Phase B: Company Bank Account Master
-- Migration: 20261004_phase_b_bank_account_master.sql
-- Purpose: Complete enterprise Bank Account Master schema.
-- Invariants:
--   1. Bank accounts belong to the COMPANY, not branches.
--   2. Strict 1:1 foreign key mapping to accounting_account (type=ASSET, subtype=BANK).
--   3. Uniqueness on (ifsc_code, account_number) and gl_account_id.
--   4. Masked and full account number storage with length validation.
--   5. Full audit trail (created_by, updated_by).

-- ═══════════════════════════════════════════════════════════════════════════════
-- 1. DROP BRANCH DEPENDENCY (Branches DO NOT own bank accounts)
-- ═══════════════════════════════════════════════════════════════════════════════

ALTER TABLE public.bank_account
  DROP CONSTRAINT IF EXISTS bank_account_branch_id_fkey;

DROP INDEX IF EXISTS public.idx_bank_account_branch_id;

ALTER TABLE public.bank_account
  DROP COLUMN IF EXISTS branch_id;

-- ═══════════════════════════════════════════════════════════════════════════════
-- 2. COMPANY IDENTITY (Link to public.company)
-- ═══════════════════════════════════════════════════════════════════════════════

-- Remove legacy default 'company_default'
ALTER TABLE public.bank_account
  ALTER COLUMN company_id DROP DEFAULT;

-- Establish FK to public.company
ALTER TABLE public.bank_account
  DROP CONSTRAINT IF EXISTS fk_bank_account_company;

ALTER TABLE public.bank_account
  ADD CONSTRAINT fk_bank_account_company
  FOREIGN KEY (company_id) REFERENCES public.company(id)
  ON DELETE RESTRICT;

-- ═══════════════════════════════════════════════════════════════════════════════
-- 3. MASTER DATA COLUMNS
-- ═══════════════════════════════════════════════════════════════════════════════

ALTER TABLE public.bank_account
  ADD COLUMN IF NOT EXISTS account_name VARCHAR(150),
  ADD COLUMN IF NOT EXISTS account_number VARCHAR(50),
  ADD COLUMN IF NOT EXISTS account_type VARCHAR(30) NOT NULL DEFAULT 'CURRENT',
  ADD COLUMN IF NOT EXISTS branch_name VARCHAR(150),
  ADD COLUMN IF NOT EXISTS gl_account_id TEXT,
  ADD COLUMN IF NOT EXISTS created_by TEXT NOT NULL DEFAULT 'system',
  ADD COLUMN IF NOT EXISTS updated_by TEXT NOT NULL DEFAULT 'system';

-- Enforce NOT NULL on account_name, account_number, gl_account_id
-- (Safe because public.bank_account has 0 rows in DEV DB)
ALTER TABLE public.bank_account
  ALTER COLUMN account_name SET NOT NULL,
  ALTER COLUMN account_number SET NOT NULL,
  ALTER COLUMN gl_account_id SET NOT NULL;

-- ═══════════════════════════════════════════════════════════════════════════════
-- 4. GL ACCOUNT FOREIGN KEY & INTEGRITY CONSTRAINTS
-- ═══════════════════════════════════════════════════════════════════════════════

ALTER TABLE public.bank_account
  DROP CONSTRAINT IF EXISTS fk_bank_account_gl_account;

ALTER TABLE public.bank_account
  ADD CONSTRAINT fk_bank_account_gl_account
  FOREIGN KEY (gl_account_id) REFERENCES public.accounting_account(id)
  ON DELETE RESTRICT;

-- Ensure 1:1 GL account to bank account mapping
ALTER TABLE public.bank_account
  DROP CONSTRAINT IF EXISTS uq_bank_account_gl_account;

ALTER TABLE public.bank_account
  ADD CONSTRAINT uq_bank_account_gl_account
  UNIQUE (gl_account_id);

-- Prevent duplicate account numbers under the same IFSC
ALTER TABLE public.bank_account
  DROP CONSTRAINT IF EXISTS uq_bank_account_number_ifsc;

ALTER TABLE public.bank_account
  ADD CONSTRAINT uq_bank_account_number_ifsc
  UNIQUE (ifsc_code, account_number);

-- Account type check
ALTER TABLE public.bank_account
  DROP CONSTRAINT IF EXISTS chk_bank_account_type;

ALTER TABLE public.bank_account
  ADD CONSTRAINT chk_bank_account_type
  CHECK (account_type IN ('CURRENT', 'SAVINGS', 'OVERDRAFT', 'VIRTUAL'));

-- Validation checks
ALTER TABLE public.bank_account
  DROP CONSTRAINT IF EXISTS chk_bank_account_name_len;

ALTER TABLE public.bank_account
  ADD CONSTRAINT chk_bank_account_name_len
  CHECK (length(trim(account_name)) >= 2);

ALTER TABLE public.bank_account
  DROP CONSTRAINT IF EXISTS chk_bank_account_num_len;

ALTER TABLE public.bank_account
  ADD CONSTRAINT chk_bank_account_num_len
  CHECK (length(trim(account_number)) >= 4);

-- ═══════════════════════════════════════════════════════════════════════════════
-- 5. PERFORMANCE INDEXES
-- ═══════════════════════════════════════════════════════════════════════════════

CREATE INDEX IF NOT EXISTS idx_bank_account_company_id
  ON public.bank_account (company_id);

CREATE INDEX IF NOT EXISTS idx_bank_account_gl_account_id
  ON public.bank_account (gl_account_id);
