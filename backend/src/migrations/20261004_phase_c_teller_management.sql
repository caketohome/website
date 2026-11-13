-- CakeToHome ERP — Phase C: Teller, Teller Session, Cash Custody & Settlement
-- Migration: 20261004_phase_c_teller_management.sql
-- Purpose: Complete enterprise Teller Master, Session, and Cash Custody Ledger schema.
-- Invariants:
--   1. 5296 Cash Over / Short account exists under parent 5200 (OPERATING_EXPENSE).
--   2. A user may have AT MOST ONE active teller assignment company-wide.
--   3. Composite FK (teller_id, branch_id) guarantees teller_session.branch_id = teller.branch_id.
--   4. A teller station may have AT MOST ONE active session (OPEN, CLOSING, PENDING_VERIFICATION).
--   5. Composite FK (teller_session_id, branch_id) guarantees teller_movement.branch_id = teller_session.branch_id.
--   6. Movement idempotency: UNIQUE(source_type, source_id) for system-derived movements prevents duplicate custody projections.
--   7. Variance = (closing_count - expected_cash) strictly checked at database level.
--   8. Zero-variance settlements require settlement_voucher_id IS NULL; non-zero variance requires settlement_voucher_id IS NOT NULL.
--   9. Strict Segregation of Duties (SoD): opener != verifier, closer != verifier, opener != settler, closer != settler, verifier != settler.
--  10. SETTLED and CANCELLED sessions and their cash movements are 100% immutable via PostgreSQL triggers.

-- ═══════════════════════════════════════════════════════════════════════════════
-- 1. CHART OF ACCOUNTS: 5296 CASH OVER / SHORT
-- ═══════════════════════════════════════════════════════════════════════════════

INSERT INTO public.accounting_account (
  id,
  code,
  name,
  type,
  subtype,
  parent_id,
  level,
  is_group,
  is_system,
  is_active,
  description,
  created_by,
  created_at,
  updated_at
)
SELECT
  (gen_random_uuid())::text,
  '5296',
  'Cash Over / Short',
  'EXPENSE',
  'OPERATING_EXPENSE',
  id,
  3,
  false,
  true,
  true,
  'Variance between physical cash count and expected cash in teller custody during shift settlement',
  'system_phase_c_migration',
  NOW(),
  NOW()
FROM public.accounting_account
WHERE code = '5200'
ON CONFLICT (code) DO NOTHING;

-- ═══════════════════════════════════════════════════════════════════════════════
-- 2. TELLER MASTER TABLE
-- ═══════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.teller (
  id TEXT PRIMARY KEY DEFAULT (gen_random_uuid())::text,
  branch_id TEXT NOT NULL REFERENCES public.branch(id) ON DELETE RESTRICT,
  user_id TEXT NOT NULL,
  name VARCHAR(150) NOT NULL,
  code VARCHAR(50) NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
  created_by TEXT NOT NULL DEFAULT 'system',
  updated_by TEXT NOT NULL DEFAULT 'system',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT chk_teller_status CHECK (status IN ('ACTIVE', 'INACTIVE')),
  CONSTRAINT chk_teller_code_len CHECK (length(trim(code)) >= 2),
  CONSTRAINT chk_teller_name_len CHECK (length(trim(name)) >= 2),
  CONSTRAINT uq_teller_branch_code UNIQUE (branch_id, code),
  CONSTRAINT uq_teller_id_branch UNIQUE (id, branch_id)
);

-- Decision A: At most ONE ACTIVE teller assignment per user across the company
CREATE UNIQUE INDEX IF NOT EXISTS uq_teller_active_user 
  ON public.teller (user_id) 
  WHERE status = 'ACTIVE';

CREATE INDEX IF NOT EXISTS idx_teller_branch_id 
  ON public.teller (branch_id);

CREATE INDEX IF NOT EXISTS idx_teller_user_id 
  ON public.teller (user_id);

-- ═══════════════════════════════════════════════════════════════════════════════
-- 3. TELLER SESSION TABLE
-- ═══════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.teller_session (
  id TEXT PRIMARY KEY DEFAULT (gen_random_uuid())::text,
  teller_id TEXT NOT NULL,
  branch_id TEXT NOT NULL,
  status VARCHAR(30) NOT NULL DEFAULT 'OPEN',
  opening_float NUMERIC(15, 2) NOT NULL DEFAULT 0.00,
  expected_cash NUMERIC(15, 2) NOT NULL DEFAULT 0.00,
  closing_count NUMERIC(15, 2),
  variance NUMERIC(15, 2),
  opened_by TEXT NOT NULL,
  opened_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  closed_by TEXT,
  closed_at TIMESTAMPTZ,
  verified_by TEXT,
  verified_at TIMESTAMPTZ,
  settled_by TEXT,
  settled_at TIMESTAMPTZ,
  settlement_voucher_id TEXT REFERENCES public.accounting_voucher(id) ON DELETE RESTRICT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT chk_teller_session_status CHECK (
    status IN ('OPEN', 'CLOSING', 'PENDING_VERIFICATION', 'SETTLED', 'CANCELLED')
  ),
  CONSTRAINT chk_teller_session_opening_float CHECK (opening_float >= 0.00),
  CONSTRAINT chk_teller_session_closing_count CHECK (closing_count IS NULL OR closing_count >= 0.00),

  -- Branch Consistency: relational composite foreign key prevents teller_session.branch_id != teller.branch_id
  CONSTRAINT fk_teller_session_teller_branch 
    FOREIGN KEY (teller_id, branch_id) 
    REFERENCES public.teller(id, branch_id) 
    ON UPDATE CASCADE ON DELETE RESTRICT,

  -- Unique id & branch for downstream movement anchoring
  CONSTRAINT uq_teller_session_id_branch UNIQUE (id, branch_id),

  -- Mathematical Variance Invariant: closing_count - expected_cash
  CONSTRAINT chk_teller_session_variance CHECK (
    (closing_count IS NULL AND variance IS NULL) OR
    (closing_count IS NOT NULL AND variance IS NOT NULL AND variance = (closing_count - expected_cash))
  ),

  -- Segregation of Duties (SoD) Invariants
  CONSTRAINT chk_teller_session_sod_opener_verifier CHECK (
    verified_by IS NULL OR opened_by <> verified_by
  ),
  CONSTRAINT chk_teller_session_sod_closer_verifier CHECK (
    verified_by IS NULL OR closed_by IS NULL OR closed_by <> verified_by
  ),
  CONSTRAINT chk_teller_session_sod_opener_settler CHECK (
    settled_by IS NULL OR opened_by <> settled_by
  ),
  CONSTRAINT chk_teller_session_sod_closer_settler CHECK (
    settled_by IS NULL OR closed_by IS NULL OR closed_by <> settled_by
  ),
  CONSTRAINT chk_teller_session_sod_verifier_settler CHECK (
    settled_by IS NULL OR verified_by IS NULL OR verified_by <> settled_by
  ),

  -- Settlement Voucher Invariant:
  -- Non-zero variance requires settlement voucher; zero variance must have NULL voucher
  CONSTRAINT chk_teller_session_settled_invariants CHECK (
    status != 'SETTLED' OR (
      closed_by IS NOT NULL AND
      closed_at IS NOT NULL AND
      verified_by IS NOT NULL AND
      verified_at IS NOT NULL AND
      settled_by IS NOT NULL AND
      settled_at IS NOT NULL AND
      closing_count IS NOT NULL AND
      variance IS NOT NULL AND
      ((variance <> 0.00 AND settlement_voucher_id IS NOT NULL) OR 
       (variance = 0.00 AND settlement_voucher_id IS NULL))
    )
  )
);

-- At most ONE active session per teller in OPEN, CLOSING, PENDING_VERIFICATION
CREATE UNIQUE INDEX IF NOT EXISTS uq_teller_session_active 
  ON public.teller_session (teller_id) 
  WHERE status IN ('OPEN', 'CLOSING', 'PENDING_VERIFICATION');

CREATE INDEX IF NOT EXISTS idx_teller_session_teller_id 
  ON public.teller_session (teller_id);

CREATE INDEX IF NOT EXISTS idx_teller_session_branch_id 
  ON public.teller_session (branch_id);

CREATE INDEX IF NOT EXISTS idx_teller_session_status 
  ON public.teller_session (status);

CREATE INDEX IF NOT EXISTS idx_teller_session_settlement_voucher_id 
  ON public.teller_session (settlement_voucher_id) 
  WHERE settlement_voucher_id IS NOT NULL;

-- ═══════════════════════════════════════════════════════════════════════════════
-- 4. TELLER MOVEMENT TABLE
-- ═══════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.teller_movement (
  id TEXT PRIMARY KEY DEFAULT (gen_random_uuid())::text,
  teller_session_id TEXT NOT NULL,
  branch_id TEXT NOT NULL,
  direction VARCHAR(10) NOT NULL,
  movement_type VARCHAR(50) NOT NULL,
  amount NUMERIC(15, 2) NOT NULL,
  source_type VARCHAR(50),
  source_id TEXT,
  narration TEXT,
  created_by TEXT NOT NULL DEFAULT 'system',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT chk_teller_movement_direction CHECK (direction IN ('IN', 'OUT')),
  CONSTRAINT chk_teller_movement_amount CHECK (amount > 0.00),
  CONSTRAINT chk_teller_movement_type CHECK (
    movement_type IN ('CASH_SALE', 'COD_HANDOVER', 'CUSTOMER_REFUND', 'EXPENSE_PAYMENT', 'BANK_DEPOSIT', 'ADJUSTMENT')
  ),
  CONSTRAINT chk_teller_movement_direction_type CHECK (
    (movement_type = 'CASH_SALE' AND direction = 'IN') OR
    (movement_type = 'COD_HANDOVER' AND direction = 'IN') OR
    (movement_type = 'CUSTOMER_REFUND' AND direction = 'OUT') OR
    (movement_type = 'EXPENSE_PAYMENT' AND direction = 'OUT') OR
    (movement_type = 'BANK_DEPOSIT' AND direction = 'OUT') OR
    (movement_type = 'ADJUSTMENT' AND direction IN ('IN', 'OUT'))
  ),

  -- Branch Consistency: relational composite foreign key prevents teller_movement.branch_id != teller_session.branch_id
  CONSTRAINT fk_teller_movement_session_branch 
    FOREIGN KEY (teller_session_id, branch_id) 
    REFERENCES public.teller_session(id, branch_id) 
    ON UPDATE CASCADE ON DELETE RESTRICT
);

-- Idempotency: system-derived source events project to physical custody at most ONCE
CREATE UNIQUE INDEX IF NOT EXISTS uq_teller_movement_system_source 
  ON public.teller_movement (source_type, source_id) 
  WHERE source_type IS NOT NULL AND source_id IS NOT NULL AND source_type <> 'MANUAL';

CREATE INDEX IF NOT EXISTS idx_teller_movement_session_id 
  ON public.teller_movement (teller_session_id);

CREATE INDEX IF NOT EXISTS idx_teller_movement_branch_id 
  ON public.teller_movement (branch_id);

CREATE INDEX IF NOT EXISTS idx_teller_movement_created_at 
  ON public.teller_movement (created_at);

-- ═══════════════════════════════════════════════════════════════════════════════
-- 5. IMMUTABILITY TRIGGERS & ENFORCEMENT FUNCTIONS
-- ═══════════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.fn_teller_session_immutability()
RETURNS trigger AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF OLD.status IN ('SETTLED', 'CANCELLED') THEN
      RAISE EXCEPTION 'Teller session % in % status is immutable and cannot be deleted', OLD.id, OLD.status
        USING ERRCODE = '55000';
    END IF;
    RETURN OLD;
  ELSIF TG_OP = 'UPDATE' THEN
    IF OLD.status IN ('SETTLED', 'CANCELLED') THEN
      RAISE EXCEPTION 'Teller session % in % status is immutable and cannot be modified', OLD.id, OLD.status
        USING ERRCODE = '55000';
    END IF;
    RETURN NEW;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_teller_session_immutability ON public.teller_session;
CREATE TRIGGER trg_teller_session_immutability
  BEFORE UPDATE OR DELETE ON public.teller_session
  FOR EACH ROW EXECUTE FUNCTION public.fn_teller_session_immutability();


CREATE OR REPLACE FUNCTION public.fn_teller_movement_immutability()
RETURNS trigger AS $$
DECLARE
  v_session_status VARCHAR(30);
BEGIN
  IF TG_OP = 'INSERT' THEN
    SELECT status INTO v_session_status FROM public.teller_session WHERE id = NEW.teller_session_id;
    IF v_session_status = 'SETTLED' THEN
      RAISE EXCEPTION 'Cannot add cash movement to settled teller session %', NEW.teller_session_id
        USING ERRCODE = '55000';
    ELSIF v_session_status = 'CANCELLED' THEN
      RAISE EXCEPTION 'Cannot add cash movement to cancelled teller session %', NEW.teller_session_id
        USING ERRCODE = '55000';
    END IF;
    RETURN NEW;
  ELSIF TG_OP = 'UPDATE' THEN
    SELECT status INTO v_session_status FROM public.teller_session WHERE id = OLD.teller_session_id;
    IF v_session_status IN ('SETTLED', 'CANCELLED') THEN
      RAISE EXCEPTION 'Cash movements on % teller session % are immutable and cannot be modified', v_session_status, OLD.teller_session_id
        USING ERRCODE = '55000';
    END IF;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    SELECT status INTO v_session_status FROM public.teller_session WHERE id = OLD.teller_session_id;
    IF v_session_status IN ('SETTLED', 'CANCELLED') THEN
      RAISE EXCEPTION 'Cash movements on % teller session % are immutable and cannot be deleted', v_session_status, OLD.teller_session_id
        USING ERRCODE = '55000';
    END IF;
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_teller_movement_immutability ON public.teller_movement;
CREATE TRIGGER trg_teller_movement_immutability
  BEFORE INSERT OR UPDATE OR DELETE ON public.teller_movement
  FOR EACH ROW EXECUTE FUNCTION public.fn_teller_movement_immutability();
