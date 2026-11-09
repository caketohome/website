-- =============================================================================
-- CakeToHome ERP — Phase C7.9 Step 7A Database Migration
-- Corporate Account Master & Employee Roster Schema Foundations
-- =============================================================================
--
-- ARCHITECTURAL INVARIANTS:
-- 1. Strictly Additive: Creates 7 new corporate domain tables. Alters zero
--    existing tables (customer, company, order, invoice, branch untouched).
-- 2. One-to-One Corporate Account Linkage: Full UNIQUE on customer_id ensures
--    each corporate account maps to exactly one customer record.
-- 3. Strict Employee Identity & Lifecycle: UNIQUE on (account_id, employee_code_key)
--    across all statuses prevents duplicate employee codes. Hard DELETE is
--    blocked via trigger; employees must be deactivated (status = 'INACTIVE').
-- 4. Immutable Audit Event Semantics: Trigger blocks UPDATE and DELETE on
--    corporate_account_event and corporate_employee_event tables.
-- 5. Authorized Corporate Staff: corporate_account_member provides scoped
--    delegation (ROSTER_MANAGER, ROSTER_VIEWER) tied to the corporate account.
-- 6. Zero Accounting Drift: CoA preserved at 100 accounts; zero posting changes.
-- =============================================================================

-- ─── 1. Table: public.corporate_account ──────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.corporate_account (
  id TEXT PRIMARY KEY DEFAULT ('ca_' || gen_random_uuid()::text),
  customer_id TEXT NOT NULL UNIQUE REFERENCES public.customer(id) ON DELETE RESTRICT,
  legal_name VARCHAR(255) NOT NULL,
  trade_name VARCHAR(255) NULL,
  legal_name_key VARCHAR(255) NOT NULL,
  gstin VARCHAR(15) NULL,
  pan VARCHAR(10) NULL,
  billing_address JSONB NOT NULL DEFAULT '{}'::jsonb,
  registered_address JSONB NOT NULL DEFAULT '{}'::jsonb,
  status VARCHAR(50) NOT NULL DEFAULT 'PENDING'
    CHECK (status IN ('PENDING', 'APPROVED', 'SUSPENDED', 'CLOSED')),
  approved_by TEXT NULL REFERENCES public."user"(id) ON DELETE RESTRICT,
  approved_at TIMESTAMPTZ NULL,
  suspended_by TEXT NULL REFERENCES public."user"(id) ON DELETE RESTRICT,
  suspended_at TIMESTAMPTZ NULL,
  suspended_reason TEXT NULL,
  closed_by TEXT NULL REFERENCES public."user"(id) ON DELETE RESTRICT,
  closed_at TIMESTAMPTZ NULL,
  closed_reason TEXT NULL,
  credit_requested_limit NUMERIC(15, 2) NULL
    CHECK (credit_requested_limit IS NULL OR credit_requested_limit >= 0.00),
  credit_requested_terms_days INTEGER NULL
    CHECK (credit_requested_terms_days IS NULL OR credit_requested_terms_days >= 0),
  credit_requested_by TEXT NULL REFERENCES public."user"(id) ON DELETE RESTRICT,
  credit_requested_at TIMESTAMPTZ NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_by TEXT NULL REFERENCES public."user"(id) ON DELETE RESTRICT,
  updated_by TEXT NULL REFERENCES public."user"(id) ON DELETE RESTRICT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ NULL,
  CONSTRAINT chk_ca_gstin CHECK (gstin IS NULL OR gstin ~ '^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$'),
  CONSTRAINT chk_ca_pan CHECK (pan IS NULL OR pan ~ '^[A-Z]{5}[0-9]{4}[A-Z]{1}$'),
  CONSTRAINT chk_ca_pan_gstin_match CHECK (gstin IS NULL OR pan IS NULL OR substring(gstin from 3 for 10) = pan)
);

CREATE INDEX IF NOT EXISTS idx_ca_customer_id ON public.corporate_account (customer_id);
CREATE INDEX IF NOT EXISTS idx_ca_status ON public.corporate_account (status);
CREATE INDEX IF NOT EXISTS idx_ca_legal_name_key ON public.corporate_account (legal_name_key);
CREATE INDEX IF NOT EXISTS idx_ca_created_at ON public.corporate_account (created_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS idx_ca_gstin_active 
  ON public.corporate_account (gstin) 
  WHERE gstin IS NOT NULL AND deleted_at IS NULL;

-- ─── 2. Table: public.corporate_account_contact ──────────────────────────────

CREATE TABLE IF NOT EXISTS public.corporate_account_contact (
  id TEXT PRIMARY KEY DEFAULT ('cac_' || gen_random_uuid()::text),
  account_id TEXT NOT NULL REFERENCES public.corporate_account(id) ON DELETE RESTRICT,
  contact_type VARCHAR(50) NOT NULL
    CHECK (contact_type IN ('PRIMARY', 'SECONDARY', 'ACCOUNTS_PAYABLE', 'BILLING')),
  name VARCHAR(255) NOT NULL,
  email VARCHAR(255) NOT NULL,
  phone VARCHAR(50) NOT NULL,
  designation VARCHAR(100) NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ NULL
);

CREATE INDEX IF NOT EXISTS idx_cac_account_id ON public.corporate_account_contact (account_id);
CREATE INDEX IF NOT EXISTS idx_cac_contact_type ON public.corporate_account_contact (contact_type);
CREATE UNIQUE INDEX IF NOT EXISTS idx_cac_one_active_primary 
  ON public.corporate_account_contact (account_id) 
  WHERE contact_type = 'PRIMARY' AND is_active = true AND deleted_at IS NULL;

-- ─── 3. Table: public.corporate_account_member ───────────────────────────────

CREATE TABLE IF NOT EXISTS public.corporate_account_member (
  id TEXT PRIMARY KEY DEFAULT ('cam_' || gen_random_uuid()::text),
  account_id TEXT NOT NULL REFERENCES public.corporate_account(id) ON DELETE RESTRICT,
  user_id TEXT NOT NULL REFERENCES public."user"(id) ON DELETE RESTRICT,
  member_role VARCHAR(50) NOT NULL
    CHECK (member_role IN ('ROSTER_MANAGER', 'ROSTER_VIEWER')),
  status VARCHAR(50) NOT NULL DEFAULT 'ACTIVE'
    CHECK (status IN ('ACTIVE', 'REVOKED')),
  granted_by TEXT NOT NULL REFERENCES public."user"(id) ON DELETE RESTRICT,
  granted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  revoked_by TEXT NULL REFERENCES public."user"(id) ON DELETE RESTRICT,
  revoked_at TIMESTAMPTZ NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_cam_account_id ON public.corporate_account_member (account_id);
CREATE INDEX IF NOT EXISTS idx_cam_user_id ON public.corporate_account_member (user_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_cam_account_user_active 
  ON public.corporate_account_member (account_id, user_id) 
  WHERE status = 'ACTIVE';

-- ─── 4. Table: public.corporate_employee ─────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.corporate_employee (
  id TEXT PRIMARY KEY DEFAULT ('ce_' || gen_random_uuid()::text),
  account_id TEXT NOT NULL REFERENCES public.corporate_account(id) ON DELETE RESTRICT,
  employee_code VARCHAR(100) NOT NULL,
  employee_code_key VARCHAR(100) NOT NULL,
  full_name VARCHAR(255) NOT NULL,
  phone VARCHAR(50) NOT NULL,
  email VARCHAR(255) NULL,
  department VARCHAR(100) NULL,
  designation VARCHAR(100) NULL,
  default_address JSONB NOT NULL DEFAULT '{}'::jsonb,
  city_key VARCHAR(100) NULL,
  default_latitude NUMERIC(10, 7) NULL,
  default_longitude NUMERIC(10, 7) NULL,
  coordinate_source VARCHAR(50) NULL
    CHECK (coordinate_source IS NULL OR coordinate_source IN ('USER_SUPPLIED', 'GEOCODED', 'ADMIN_VERIFIED')),
  coordinate_verified BOOLEAN NOT NULL DEFAULT false,
  coordinate_verified_by TEXT NULL REFERENCES public."user"(id) ON DELETE RESTRICT,
  coordinate_verified_at TIMESTAMPTZ NULL,
  status VARCHAR(50) NOT NULL DEFAULT 'ACTIVE'
    CHECK (status IN ('ACTIVE', 'INACTIVE')),
  deactivated_by TEXT NULL REFERENCES public."user"(id) ON DELETE RESTRICT,
  deactivated_at TIMESTAMPTZ NULL,
  deactivated_reason TEXT NULL,
  reactivated_by TEXT NULL REFERENCES public."user"(id) ON DELETE RESTRICT,
  reactivated_at TIMESTAMPTZ NULL,
  reactivated_reason TEXT NULL,
  version INTEGER NOT NULL DEFAULT 1 CHECK (version >= 1),
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_by TEXT NULL REFERENCES public."user"(id) ON DELETE RESTRICT,
  updated_by TEXT NULL REFERENCES public."user"(id) ON DELETE RESTRICT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_ce_account_employee_code UNIQUE (account_id, employee_code_key),
  CONSTRAINT chk_ce_coords_both_or_neither CHECK (
    (default_latitude IS NULL AND default_longitude IS NULL) OR 
    (default_latitude IS NOT NULL AND default_longitude IS NOT NULL)
  ),
  CONSTRAINT chk_ce_coords_india_bbox CHECK (
    default_latitude IS NULL OR (
      default_latitude BETWEEN 6.0 AND 38.0 AND 
      default_longitude BETWEEN 68.0 AND 98.0
    )
  )
);

CREATE INDEX IF NOT EXISTS idx_ce_account_id ON public.corporate_employee (account_id);
CREATE INDEX IF NOT EXISTS idx_ce_status ON public.corporate_employee (status);
CREATE INDEX IF NOT EXISTS idx_ce_phone ON public.corporate_employee (phone);
CREATE INDEX IF NOT EXISTS idx_ce_email ON public.corporate_employee (email) WHERE email IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_ce_city_key ON public.corporate_employee (city_key) WHERE city_key IS NOT NULL;

-- Trigger: Block DELETE on corporate_employee (Soft Deactivation via status = 'INACTIVE' required)
CREATE OR REPLACE FUNCTION public.fn_corporate_employee_block_delete()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'Hard deletion of corporate_employee is prohibited. Use status = INACTIVE.';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_ce_prevent_delete ON public.corporate_employee;
CREATE TRIGGER trg_ce_prevent_delete
  BEFORE DELETE ON public.corporate_employee
  FOR EACH ROW
  EXECUTE FUNCTION public.fn_corporate_employee_block_delete();

-- ─── 5. Table: public.corporate_employee_event ───────────────────────────────

CREATE TABLE IF NOT EXISTS public.corporate_employee_event (
  id TEXT PRIMARY KEY DEFAULT ('cee_' || gen_random_uuid()::text),
  employee_id TEXT NOT NULL REFERENCES public.corporate_employee(id) ON DELETE RESTRICT,
  account_id TEXT NOT NULL REFERENCES public.corporate_account(id) ON DELETE RESTRICT,
  event_type VARCHAR(50) NOT NULL
    CHECK (event_type IN ('CREATED', 'UPDATED', 'DEACTIVATED', 'REACTIVATED', 'IMPORTED', 'COORDINATES_VERIFIED')),
  actor_id TEXT NULL REFERENCES public."user"(id) ON DELETE RESTRICT,
  actor_role VARCHAR(50) NULL,
  reason TEXT NULL,
  before_state JSONB NULL,
  after_state JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_cee_employee_id ON public.corporate_employee_event (employee_id);
CREATE INDEX IF NOT EXISTS idx_cee_account_id ON public.corporate_employee_event (account_id);
CREATE INDEX IF NOT EXISTS idx_cee_event_type ON public.corporate_employee_event (event_type);
CREATE INDEX IF NOT EXISTS idx_cee_created_at ON public.corporate_employee_event (created_at DESC);

-- Trigger: Append-only enforcement for corporate_employee_event
CREATE OR REPLACE FUNCTION public.fn_corporate_employee_event_immutable()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'corporate_employee_event is append-only. UPDATE and DELETE are prohibited.';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_cee_append_only ON public.corporate_employee_event;
CREATE TRIGGER trg_cee_append_only
  BEFORE UPDATE OR DELETE ON public.corporate_employee_event
  FOR EACH ROW
  EXECUTE FUNCTION public.fn_corporate_employee_event_immutable();

-- ─── 6. Table: public.corporate_account_event ────────────────────────────────

CREATE TABLE IF NOT EXISTS public.corporate_account_event (
  id TEXT PRIMARY KEY DEFAULT ('cax_' || gen_random_uuid()::text),
  account_id TEXT NOT NULL REFERENCES public.corporate_account(id) ON DELETE RESTRICT,
  event_type VARCHAR(50) NOT NULL
    CHECK (event_type IN ('CREATED', 'UPDATED', 'SUBMITTED', 'APPROVED', 'SUSPENDED', 'REACTIVATED', 'CLOSED', 'CUSTOMER_LINKED', 'CREDIT_REQUESTED', 'CREDIT_ACTIVATED', 'MEMBER_GRANTED', 'MEMBER_REVOKED')),
  actor_id TEXT NULL REFERENCES public."user"(id) ON DELETE RESTRICT,
  actor_role VARCHAR(50) NULL,
  reason TEXT NULL,
  before_state JSONB NULL,
  after_state JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_cax_account_id ON public.corporate_account_event (account_id);
CREATE INDEX IF NOT EXISTS idx_cax_event_type ON public.corporate_account_event (event_type);
CREATE INDEX IF NOT EXISTS idx_cax_created_at ON public.corporate_account_event (created_at DESC);

-- Trigger: Append-only enforcement for corporate_account_event
CREATE OR REPLACE FUNCTION public.fn_corporate_account_event_immutable()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'corporate_account_event is append-only. UPDATE and DELETE are prohibited.';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_cax_append_only ON public.corporate_account_event;
CREATE TRIGGER trg_cax_append_only
  BEFORE UPDATE OR DELETE ON public.corporate_account_event
  FOR EACH ROW
  EXECUTE FUNCTION public.fn_corporate_account_event_immutable();

-- ─── 7. Table: public.corporate_employee_import_batch ────────────────────────

CREATE TABLE IF NOT EXISTS public.corporate_employee_import_batch (
  id TEXT PRIMARY KEY DEFAULT ('cei_' || gen_random_uuid()::text),
  account_id TEXT NOT NULL REFERENCES public.corporate_account(id) ON DELETE RESTRICT,
  file_hash VARCHAR(64) NOT NULL,
  filename VARCHAR(255) NOT NULL,
  status VARCHAR(50) NOT NULL DEFAULT 'DRY_RUN_OK'
    CHECK (status IN ('DRY_RUN_OK', 'DRY_RUN_FAILED', 'COMMITTED', 'FAILED')),
  total_rows INTEGER NOT NULL DEFAULT 0 CHECK (total_rows >= 0),
  valid_rows INTEGER NOT NULL DEFAULT 0 CHECK (valid_rows >= 0),
  invalid_rows INTEGER NOT NULL DEFAULT 0 CHECK (invalid_rows >= 0),
  inserted_rows INTEGER NOT NULL DEFAULT 0 CHECK (inserted_rows >= 0),
  row_errors JSONB NOT NULL DEFAULT '[]'::jsonb,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_by TEXT NULL REFERENCES public."user"(id) ON DELETE RESTRICT,
  committed_by TEXT NULL REFERENCES public."user"(id) ON DELETE RESTRICT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  committed_at TIMESTAMPTZ NULL
);

CREATE INDEX IF NOT EXISTS idx_cei_account_id ON public.corporate_employee_import_batch (account_id);
CREATE INDEX IF NOT EXISTS idx_cei_status ON public.corporate_employee_import_batch (status);
CREATE UNIQUE INDEX IF NOT EXISTS idx_cei_account_file_hash_committed 
  ON public.corporate_employee_import_batch (account_id, file_hash) 
  WHERE status = 'COMMITTED';
