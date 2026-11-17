-- Non-accounting schema catch-up for the live database. Additive, idempotent, no seed data.
-- Live DB has no public."user" table, so user-reference columns are plain TEXT without FK.
BEGIN;

-- ══ Source: backend/src/migrations/20261012_phase_c7_9_corporate_account_roster_schema.sql (user FKs removed) ══
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
  approved_by TEXT NULL,
  approved_at TIMESTAMPTZ NULL,
  suspended_by TEXT NULL,
  suspended_at TIMESTAMPTZ NULL,
  suspended_reason TEXT NULL,
  closed_by TEXT NULL,
  closed_at TIMESTAMPTZ NULL,
  closed_reason TEXT NULL,
  credit_requested_limit NUMERIC(15, 2) NULL
    CHECK (credit_requested_limit IS NULL OR credit_requested_limit >= 0.00),
  credit_requested_terms_days INTEGER NULL
    CHECK (credit_requested_terms_days IS NULL OR credit_requested_terms_days >= 0),
  credit_requested_by TEXT NULL,
  credit_requested_at TIMESTAMPTZ NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_by TEXT NULL,
  updated_by TEXT NULL,
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
  user_id TEXT NOT NULL,
  member_role VARCHAR(50) NOT NULL
    CHECK (member_role IN ('ROSTER_MANAGER', 'ROSTER_VIEWER')),
  status VARCHAR(50) NOT NULL DEFAULT 'ACTIVE'
    CHECK (status IN ('ACTIVE', 'REVOKED')),
  granted_by TEXT NOT NULL,
  granted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  revoked_by TEXT NULL,
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
  coordinate_verified_by TEXT NULL,
  coordinate_verified_at TIMESTAMPTZ NULL,
  status VARCHAR(50) NOT NULL DEFAULT 'ACTIVE'
    CHECK (status IN ('ACTIVE', 'INACTIVE')),
  deactivated_by TEXT NULL,
  deactivated_at TIMESTAMPTZ NULL,
  deactivated_reason TEXT NULL,
  reactivated_by TEXT NULL,
  reactivated_at TIMESTAMPTZ NULL,
  reactivated_reason TEXT NULL,
  version INTEGER NOT NULL DEFAULT 1 CHECK (version >= 1),
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_by TEXT NULL,
  updated_by TEXT NULL,
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
  actor_id TEXT NULL,
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
  actor_id TEXT NULL,
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
  created_by TEXT NULL,
  committed_by TEXT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  committed_at TIMESTAMPTZ NULL
);

CREATE INDEX IF NOT EXISTS idx_cei_account_id ON public.corporate_employee_import_batch (account_id);
CREATE INDEX IF NOT EXISTS idx_cei_status ON public.corporate_employee_import_batch (status);
CREATE UNIQUE INDEX IF NOT EXISTS idx_cei_account_file_hash_committed 
  ON public.corporate_employee_import_batch (account_id, file_hash) 
  WHERE status = 'COMMITTED';


-- ══ Source: backend/src/migrations/20261009_phase_c7_7_corporate_gifting_schema.sql (user FKs removed) ══
-- =============================================================================
-- CakeToHome ERP — Phase C7.7 Step 7A Database Migration
-- Corporate Gifting Batch & Recipient Schema Foundations
-- =============================================================================
-- 
-- ARCHITECTURAL INVARIANTS:
-- 1. One Master Corporate Invoice: The batch links to a single consolidated
--    corporate invoice (public.invoice). Individual recipients do NOT carry
--    independent invoice references, preventing duplicate billing.
-- 2. Audit & Duplicate Replay Defense: Customer + SHA-256 file hash unique index
--    prevents duplicate concurrent uploads of identical spreadsheets.
-- 3. Row-Level Identity & Traceability: Each recipient is bound to a deterministic
--    source row_number (UNIQUE within batch).
-- 4. Multi-Delivery Scheduling: Recipient records support individual delivery
--    dates, slots, addresses, and future linkage to public.order / public.delivery.
-- 5. Cost Centre Attribution: Optional linkage to public.cost_centre preserves
--    C7.6 multidimensional management accounting governance.
-- 6. Zero Historical Mutation: Migration is purely additive. CoA locked at 100 accounts.
-- =============================================================================

-- ─── 1. Table: public.corporate_gifting_batch ────────────────────────────────

CREATE TABLE IF NOT EXISTS public.corporate_gifting_batch (
  id TEXT PRIMARY KEY DEFAULT ('cgb_' || gen_random_uuid()::text),
  customer_id TEXT NOT NULL REFERENCES public.customer(id) ON DELETE RESTRICT,
  company_id TEXT NULL REFERENCES public.company(id) ON DELETE RESTRICT,
  batch_name VARCHAR(255) NOT NULL,
  source_filename VARCHAR(255) NOT NULL,
  file_hash VARCHAR(64) NOT NULL,
  file_size_bytes BIGINT NULL,
  status VARCHAR(50) NOT NULL DEFAULT 'DRAFT'
    CHECK (status IN ('DRAFT', 'VALIDATED', 'SCHEDULED', 'PROCESSING', 'COMPLETED', 'CANCELLED', 'FAILED')),
  total_recipients INTEGER NOT NULL DEFAULT 0 CHECK (total_recipients >= 0),
  total_amount NUMERIC(15, 2) NOT NULL DEFAULT 0.00 CHECK (total_amount >= 0.00),
  validated_recipients INTEGER NOT NULL DEFAULT 0 CHECK (validated_recipients >= 0),
  invalid_recipients INTEGER NOT NULL DEFAULT 0 CHECK (invalid_recipients >= 0),
  processed_recipients INTEGER NOT NULL DEFAULT 0 CHECK (processed_recipients >= 0),
  scheduled_delivery_date DATE NULL,
  invoice_id TEXT NULL REFERENCES public.invoice(id) ON DELETE SET NULL,
  order_id TEXT NULL REFERENCES public."order"(id) ON DELETE SET NULL,
  cost_centre_id TEXT NULL REFERENCES public.cost_centre(id) ON DELETE RESTRICT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_by TEXT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  cancelled_by TEXT NULL,
  cancelled_at TIMESTAMPTZ NULL,
  cancellation_reason TEXT NULL,
  deleted_at TIMESTAMPTZ NULL
);

-- ─── 2. Table: public.corporate_gifting_recipient ────────────────────────────

CREATE TABLE IF NOT EXISTS public.corporate_gifting_recipient (
  id TEXT PRIMARY KEY DEFAULT ('cgr_' || gen_random_uuid()::text),
  batch_id TEXT NOT NULL REFERENCES public.corporate_gifting_batch(id) ON DELETE RESTRICT,
  row_number INTEGER NOT NULL CHECK (row_number >= 1),
  employee_id VARCHAR(100) NULL,
  recipient_name VARCHAR(255) NOT NULL,
  recipient_phone VARCHAR(50) NOT NULL,
  delivery_address TEXT NOT NULL,
  delivery_pincode VARCHAR(20) NOT NULL,
  delivery_city VARCHAR(100) NULL,
  delivery_state VARCHAR(100) NULL,
  delivery_date DATE NOT NULL,
  delivery_slot VARCHAR(50) NULL,
  product_id TEXT NULL REFERENCES public.product(id) ON DELETE RESTRICT,
  variant_id TEXT NULL REFERENCES public.product_variant(id) ON DELETE RESTRICT,
  sku VARCHAR(100) NOT NULL,
  quantity INTEGER NOT NULL DEFAULT 1 CHECK (quantity > 0),
  unit_price NUMERIC(15, 2) NOT NULL DEFAULT 0.00 CHECK (unit_price >= 0.00),
  line_total NUMERIC(15, 2) NOT NULL DEFAULT 0.00 CHECK (line_total >= 0.00),
  gift_message TEXT NULL,
  validation_status VARCHAR(50) NOT NULL DEFAULT 'PENDING'
    CHECK (validation_status IN ('PENDING', 'VALID', 'INVALID')),
  validation_errors JSONB NULL,
  order_id TEXT NULL REFERENCES public."order"(id) ON DELETE SET NULL,
  delivery_id TEXT NULL REFERENCES public.delivery(id) ON DELETE SET NULL,
  status VARCHAR(50) NOT NULL DEFAULT 'PENDING'
    CHECK (status IN ('PENDING', 'ORDER_CREATED', 'DISPATCHED', 'DELIVERED', 'FAILED', 'CANCELLED')),
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ NULL,
  CONSTRAINT uq_cgr_batch_row UNIQUE (batch_id, row_number)
);

-- ─── 3. Indexes & Constraints ────────────────────────────────────────────────

-- Batch Indexes
CREATE INDEX IF NOT EXISTS idx_cgb_customer_id ON public.corporate_gifting_batch (customer_id);
CREATE INDEX IF NOT EXISTS idx_cgb_status ON public.corporate_gifting_batch (status);
CREATE INDEX IF NOT EXISTS idx_cgb_created_at ON public.corporate_gifting_batch (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_cgb_invoice_id ON public.corporate_gifting_batch (invoice_id) WHERE invoice_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_cgb_order_id ON public.corporate_gifting_batch (order_id) WHERE order_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_cgb_cost_centre_id ON public.corporate_gifting_batch (cost_centre_id) WHERE cost_centre_id IS NOT NULL;

-- Unique constraint for duplicate file hash upload protection per customer
CREATE UNIQUE INDEX IF NOT EXISTS idx_cgb_customer_file_hash_active 
  ON public.corporate_gifting_batch (customer_id, file_hash) 
  WHERE status != 'FAILED' AND deleted_at IS NULL;

-- Recipient Indexes
CREATE INDEX IF NOT EXISTS idx_cgr_batch_id ON public.corporate_gifting_recipient (batch_id);
CREATE INDEX IF NOT EXISTS idx_cgr_validation_status ON public.corporate_gifting_recipient (validation_status);
CREATE INDEX IF NOT EXISTS idx_cgr_status ON public.corporate_gifting_recipient (status);
CREATE INDEX IF NOT EXISTS idx_cgr_delivery_date ON public.corporate_gifting_recipient (delivery_date);
CREATE INDEX IF NOT EXISTS idx_cgr_order_id ON public.corporate_gifting_recipient (order_id) WHERE order_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_cgr_delivery_id ON public.corporate_gifting_recipient (delivery_id) WHERE delivery_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_cgr_variant_id ON public.corporate_gifting_recipient (variant_id) WHERE variant_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_cgr_phone ON public.corporate_gifting_recipient (recipient_phone);


-- ══ Source: frontend/src/lib/migrations/c7_10_coverage_configuration.sql (user FKs removed) ══
-- ============================================================================
-- CakeToHome ERP — Phase C7.10 Migration: Map-Fenced Coverage Configuration
-- Schema: Store Eligibility, Zone Exclusions, Partner Profile & Coverage Fences
-- ============================================================================

-- 1. Store Eligibility Allow-List on Branch
ALTER TABLE public.branch 
ADD COLUMN IF NOT EXISTS is_corporate_routing_eligible boolean NOT NULL DEFAULT false;

-- 2. Add Exclusion Polygons to Delivery Zone
ALTER TABLE public.delivery_zone 
ADD COLUMN IF NOT EXISTS exclusion_polygons jsonb DEFAULT NULL;

-- 3. Delivery Partner Operational Profile
CREATE TABLE IF NOT EXISTS public.delivery_partner_profile (
    id text PRIMARY KEY,
    partner_id text NOT NULL REFERENCES public.delivery_partner(id) ON DELETE RESTRICT,
    partner_type varchar(32) NOT NULL DEFAULT 'OWN_FLEET', -- OWN_FLEET, COURIER, 3PL_AGGREGATOR
    status varchar(32) NOT NULL DEFAULT 'ACTIVE', -- ACTIVE, INACTIVE, SUSPENDED
    primary_branch_id text REFERENCES public.branch(id) ON DELETE SET NULL,
    max_concurrent_orders integer NOT NULL DEFAULT 5,
    rating numeric(3, 2) DEFAULT 5.00,
    contract_reference varchar(64),
    metadata jsonb DEFAULT '{}'::jsonb,
    created_at timestamptz NOT NULL DEFAULT NOW(),
    updated_at timestamptz NOT NULL DEFAULT NOW(),
    CONSTRAINT chk_dp_profile_status CHECK (status IN ('ACTIVE', 'INACTIVE', 'SUSPENDED')),
    CONSTRAINT chk_dp_profile_type CHECK (partner_type IN ('OWN_FLEET', 'COURIER', '3PL_AGGREGATOR')),
    CONSTRAINT chk_dp_profile_capacity CHECK (max_concurrent_orders > 0 AND max_concurrent_orders <= 50)
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_dp_profile_partner ON public.delivery_partner_profile(partner_id);
CREATE INDEX IF NOT EXISTS idx_dp_profile_branch ON public.delivery_partner_profile(primary_branch_id);
CREATE INDEX IF NOT EXISTS idx_dp_profile_status ON public.delivery_partner_profile(status);

-- 4. Delivery Partner Coverage Geofence Configuration
CREATE TABLE IF NOT EXISTS public.delivery_partner_coverage (
    id text PRIMARY KEY,
    partner_id text NOT NULL REFERENCES public.delivery_partner(id) ON DELETE RESTRICT,
    branch_id text NOT NULL REFERENCES public.branch(id) ON DELETE RESTRICT,
    fence_type varchar(16) NOT NULL DEFAULT 'HYBRID', -- POLYGON, RADIUS, HYBRID
    polygon_coordinates jsonb DEFAULT NULL, -- Array of [lat, lng] or {lat, lng}
    radius_km numeric(6, 2) DEFAULT NULL,
    center_latitude numeric(10, 7) DEFAULT NULL,
    center_longitude numeric(10, 7) DEFAULT NULL,
    priority integer NOT NULL DEFAULT 10,
    is_active boolean NOT NULL DEFAULT true,
    metadata jsonb DEFAULT '{}'::jsonb,
    created_at timestamptz NOT NULL DEFAULT NOW(),
    updated_at timestamptz NOT NULL DEFAULT NOW(),
    CONSTRAINT chk_dp_coverage_fence CHECK (fence_type IN ('POLYGON', 'RADIUS', 'HYBRID')),
    CONSTRAINT chk_dp_coverage_priority CHECK (priority >= 1 AND priority <= 100),
    CONSTRAINT chk_dp_coverage_radius CHECK (radius_km IS NULL OR (radius_km > 0 AND radius_km <= 25.0))
);

CREATE INDEX IF NOT EXISTS idx_dp_coverage_partner ON public.delivery_partner_coverage(partner_id);
CREATE INDEX IF NOT EXISTS idx_dp_coverage_branch ON public.delivery_partner_coverage(branch_id);
CREATE INDEX IF NOT EXISTS idx_dp_coverage_active ON public.delivery_partner_coverage(is_active);

-- 5. Structured Coverage Audit Trail (Append-Only)
CREATE TABLE IF NOT EXISTS public.delivery_coverage_event (
    id text PRIMARY KEY,
    entity_type varchar(32) NOT NULL, -- STORE_ZONE, PARTNER_COVERAGE, STORE_ELIGIBILITY
    entity_id text NOT NULL,
    event_type varchar(32) NOT NULL,
    actor_id text NOT NULL,
    actor_role varchar(32) NOT NULL,
    reason text,
    before_state jsonb,
    after_state jsonb,
    created_at timestamptz NOT NULL DEFAULT NOW(),
    CONSTRAINT chk_coverage_event_type CHECK (
        event_type IN (
            'ZONE_CREATED', 'ZONE_UPDATED', 'ZONE_DEACTIVATED',
            'EXCLUSION_MODIFIED', 'ELIGIBILITY_TOGGLED',
            'PARTNER_PROFILE_CREATED', 'PARTNER_PROFILE_UPDATED',
            'PARTNER_COVERAGE_CREATED', 'PARTNER_COVERAGE_UPDATED',
            'PARTNER_COVERAGE_DEACTIVATED'
        )
    )
);

CREATE INDEX IF NOT EXISTS idx_coverage_event_entity ON public.delivery_coverage_event(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_coverage_event_actor ON public.delivery_coverage_event(actor_id);
CREATE INDEX IF NOT EXISTS idx_coverage_event_created ON public.delivery_coverage_event(created_at DESC);

-- 6. Immutability Trigger for Audit Trail
CREATE OR REPLACE FUNCTION public.trg_delivery_coverage_event_immutability()
RETURNS trigger AS $$
BEGIN
    RAISE EXCEPTION 'delivery_coverage_event is append-only: UPDATE and DELETE operations are strictly prohibited.'
        USING ERRCODE = '27000';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_delivery_coverage_event_immutability ON public.delivery_coverage_event;
CREATE TRIGGER trg_delivery_coverage_event_immutability
BEFORE UPDATE OR DELETE ON public.delivery_coverage_event
FOR EACH ROW EXECUTE FUNCTION public.trg_delivery_coverage_event_immutability();


-- ══ Source: frontend/src/lib/migrations/c7_11_assignment_schema.sql (user FKs removed) ══
-- ============================================================================
-- CakeToHome ERP — Phase C7.11 Step 11A Migration: Geographic Assignment Schema
-- Table: public.corporate_delivery_assignment & public.corporate_assignment_event
-- ============================================================================

-- 1. Create Corporate Delivery Assignment Table
CREATE TABLE IF NOT EXISTS public.corporate_delivery_assignment (
    id text PRIMARY KEY DEFAULT ('cda_' || gen_random_uuid()::text),
    entity_type varchar(32) NOT NULL,
    entity_id text NOT NULL,
    account_id text REFERENCES public.corporate_account(id) ON DELETE SET NULL,
    recipient_name varchar(255),
    recipient_phone varchar(50),
    delivery_address text NOT NULL,
    delivery_city varchar(100),
    normalized_city_key varchar(100),
    delivery_pincode varchar(20),
    latitude numeric(10, 7),
    longitude numeric(10, 7),
    status varchar(32) NOT NULL DEFAULT 'UNASSIGNED',
    reason_code varchar(64) NOT NULL DEFAULT 'PENDING_EVALUATION',
    assigned_store_id text REFERENCES public.branch(id) ON DELETE SET NULL,
    assigned_zone_id text REFERENCES public.delivery_zone(id) ON DELETE SET NULL,
    assigned_partner_id text REFERENCES public.delivery_partner(id) ON DELETE SET NULL,
    distance_km numeric(6, 2),
    matched_rule varchar(64),
    diagnostics_message text,
    evaluation_metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
    assigned_at timestamptz,
    assigned_by text,
    override_reason text,
    created_at timestamptz NOT NULL DEFAULT NOW(),
    updated_at timestamptz NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_cda_entity UNIQUE (entity_type, entity_id),
    CONSTRAINT chk_cda_status CHECK (status IN ('ASSIGNED', 'UNASSIGNED', 'MANUAL_OVERRIDE', 'PENDING_REVIEW')),
    CONSTRAINT chk_cda_entity_type CHECK (entity_type IN ('ROSTER_EMPLOYEE', 'GIFTING_RECIPIENT', 'DIRECT_ORDER')),
    CONSTRAINT chk_cda_reason_code CHECK (
        reason_code IN (
            'MATCHED_POLYGON', 'MATCHED_RADIUS', 'OUTSIDE_COVERAGE',
            'INSIDE_EXCLUSION', 'COORDINATES_MISSING', 'COORDINATES_INVALID',
            'STORE_NOT_ELIGIBLE', 'NO_ELIGIBLE_PARTNER', 'MANUAL_OVERRIDE',
            'PENDING_EVALUATION'
        )
    ),
    CONSTRAINT chk_cda_coordinates CHECK (
        (latitude IS NULL AND longitude IS NULL) OR
        (latitude >= -90.0 AND latitude <= 90.0 AND longitude >= -180.0 AND longitude <= 180.0)
    )
);

CREATE INDEX IF NOT EXISTS idx_cda_status ON public.corporate_delivery_assignment(status);
CREATE INDEX IF NOT EXISTS idx_cda_account_id ON public.corporate_delivery_assignment(account_id);
CREATE INDEX IF NOT EXISTS idx_cda_assigned_store_id ON public.corporate_delivery_assignment(assigned_store_id);
CREATE INDEX IF NOT EXISTS idx_cda_assigned_partner_id ON public.corporate_delivery_assignment(assigned_partner_id);
CREATE INDEX IF NOT EXISTS idx_cda_normalized_city ON public.corporate_delivery_assignment(normalized_city_key);
CREATE INDEX IF NOT EXISTS idx_cda_assigned_at ON public.corporate_delivery_assignment(assigned_at DESC);

-- 2. Create Corporate Assignment Audit Event Table (Append-Only)
CREATE TABLE IF NOT EXISTS public.corporate_assignment_event (
    id text PRIMARY KEY DEFAULT ('cae_' || gen_random_uuid()::text),
    assignment_id text NOT NULL REFERENCES public.corporate_delivery_assignment(id) ON DELETE CASCADE,
    event_type varchar(32) NOT NULL,
    actor_id text NOT NULL,
    actor_role varchar(32) NOT NULL,
    reason text,
    before_state jsonb,
    after_state jsonb,
    created_at timestamptz NOT NULL DEFAULT NOW(),
    CONSTRAINT chk_cae_event_type CHECK (
        event_type IN (
            'BATCH_MATCHED', 'MANUALLY_OVERRIDDEN', 'REASSIGNED', 'UNASSIGNED_TRIGGERED'
        )
    )
);

CREATE INDEX IF NOT EXISTS idx_cae_assignment_id ON public.corporate_assignment_event(assignment_id);
CREATE INDEX IF NOT EXISTS idx_cae_actor_id ON public.corporate_assignment_event(actor_id);
CREATE INDEX IF NOT EXISTS idx_cae_created_at ON public.corporate_assignment_event(created_at DESC);

-- 3. Immutability Trigger for Assignment Event Log
CREATE OR REPLACE FUNCTION public.trg_corporate_assignment_event_immutability()
RETURNS trigger AS $$
BEGIN
    RAISE EXCEPTION 'corporate_assignment_event is append-only: UPDATE and DELETE operations are strictly prohibited.'
        USING ERRCODE = '27000';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_corporate_assignment_event_immutability ON public.corporate_assignment_event;
CREATE TRIGGER trg_corporate_assignment_event_immutability
BEFORE UPDATE OR DELETE ON public.corporate_assignment_event
FOR EACH ROW EXECUTE FUNCTION public.trg_corporate_assignment_event_immutability();


-- ══ Fleet (frontend/migrate_phase3_fleet.js) + driver tables (no DDL in repo; shaped from fleet.service.ts / fleet-report.repository.ts) ══
CREATE TABLE IF NOT EXISTS public.driver_profile (
  id TEXT PRIMARY KEY DEFAULT ('drv_' || gen_random_uuid()::text),
  partner_id TEXT NOT NULL REFERENCES public.delivery_partner(id) ON DELETE RESTRICT,
  branch_id TEXT REFERENCES public.branch(id) ON DELETE SET NULL,
  license_number TEXT,
  vehicle_type TEXT,
  vehicle_number TEXT,
  is_verified BOOLEAN NOT NULL DEFAULT false,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_driver_profile_partner ON public.driver_profile(partner_id) WHERE deleted_at IS NULL;

CREATE TABLE IF NOT EXISTS public.delivery_delivery_partner (
  id TEXT PRIMARY KEY DEFAULT ('ddp_' || gen_random_uuid()::text),
  delivery_id TEXT NOT NULL REFERENCES public.delivery(id) ON DELETE CASCADE,
  delivery_partner_id TEXT NOT NULL REFERENCES public.delivery_partner(id) ON DELETE RESTRICT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_ddp_delivery ON public.delivery_delivery_partner(delivery_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_ddp_partner ON public.delivery_delivery_partner(delivery_partner_id) WHERE deleted_at IS NULL;

CREATE TABLE IF NOT EXISTS public.vehicle (
  id TEXT NOT NULL PRIMARY KEY,
  branch_id TEXT NOT NULL REFERENCES public.branch(id) ON DELETE RESTRICT,
  registration_no TEXT NOT NULL,
  vehicle_type TEXT NOT NULL DEFAULT 'BIKE',
  make_model TEXT,
  year INTEGER,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  current_odometer NUMERIC(10,1) NOT NULL DEFAULT 0,
  ownership_type TEXT NOT NULL DEFAULT 'OWN',
  notes TEXT,
  created_by TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ,
  CONSTRAINT vehicle_reg_branch_unique UNIQUE (registration_no, branch_id),
  CONSTRAINT vehicle_type_check CHECK (vehicle_type = ANY(ARRAY['BIKE','SCOOTER','VAN','TRUCK','OTHER'])),
  CONSTRAINT vehicle_ownership_check CHECK (ownership_type = ANY(ARRAY['OWN','LEASED','RENTAL'])),
  CONSTRAINT vehicle_odometer_non_negative CHECK (current_odometer >= 0)
);
CREATE INDEX IF NOT EXISTS idx_vehicle_branch_id ON public.vehicle (branch_id) WHERE deleted_at IS NULL;

CREATE TABLE IF NOT EXISTS public.vehicle_trip (
  id TEXT NOT NULL PRIMARY KEY,
  branch_id TEXT NOT NULL REFERENCES public.branch(id) ON DELETE RESTRICT,
  vehicle_id TEXT NOT NULL REFERENCES public.vehicle(id) ON DELETE RESTRICT,
  driver_partner_id TEXT REFERENCES public.delivery_partner(id) ON DELETE SET NULL,
  delivery_id TEXT REFERENCES public.delivery(id) ON DELETE SET NULL,
  trip_date DATE NOT NULL,
  start_odometer NUMERIC(10,1) NOT NULL,
  end_odometer NUMERIC(10,1),
  distance_km NUMERIC(8,2),
  purpose TEXT NOT NULL DEFAULT 'DELIVERY',
  notes TEXT,
  created_by TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT trip_odometer_check CHECK (end_odometer IS NULL OR end_odometer >= start_odometer),
  CONSTRAINT trip_distance_check CHECK (distance_km IS NULL OR distance_km >= 0),
  CONSTRAINT trip_purpose_check CHECK (purpose = ANY(ARRAY['DELIVERY','PICKUP','MAINTENANCE','OTHER']))
);
CREATE INDEX IF NOT EXISTS idx_trip_vehicle_id ON public.vehicle_trip (vehicle_id);
CREATE INDEX IF NOT EXISTS idx_trip_trip_date ON public.vehicle_trip (trip_date);

CREATE TABLE IF NOT EXISTS public.fleet_fuel (
  id TEXT NOT NULL PRIMARY KEY,
  branch_id TEXT NOT NULL REFERENCES public.branch(id) ON DELETE RESTRICT,
  vehicle_id TEXT NOT NULL REFERENCES public.vehicle(id) ON DELETE RESTRICT,
  driver_partner_id TEXT REFERENCES public.delivery_partner(id) ON DELETE SET NULL,
  expense_id TEXT REFERENCES public.expense(id) ON DELETE SET NULL,
  fuel_date DATE NOT NULL,
  quantity_litres NUMERIC(8,2) NOT NULL,
  rate_per_litre NUMERIC(8,2) NOT NULL,
  fuel_amount NUMERIC(14,2) NOT NULL,
  odometer_at_fill NUMERIC(10,1),
  fuel_station TEXT,
  invoice_no TEXT,
  notes TEXT,
  created_by TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ,
  CONSTRAINT fuel_quantity_positive CHECK (quantity_litres > 0),
  CONSTRAINT fuel_rate_positive CHECK (rate_per_litre > 0),
  CONSTRAINT fuel_amount_positive CHECK (fuel_amount > 0)
);
CREATE INDEX IF NOT EXISTS idx_fuel_vehicle_id ON public.fleet_fuel (vehicle_id) WHERE deleted_at IS NULL;

-- ══ Delivery / branch / zone columns used by coverage, fleet, order and gifting code ══
ALTER TABLE public.delivery
  ADD COLUMN IF NOT EXISTS eta TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS gift_message TEXT,
  ADD COLUMN IF NOT EXISTS scheduled_delivery_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
ALTER TABLE public.branch
  ADD COLUMN IF NOT EXISTS latitude NUMERIC(10,7),
  ADD COLUMN IF NOT EXISTS longitude NUMERIC(10,7),
  ADD COLUMN IF NOT EXISTS shop_id TEXT,
  ADD COLUMN IF NOT EXISTS is_corporate_routing_eligible BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE public.delivery_zone
  ADD COLUMN IF NOT EXISTS delivery_fee NUMERIC(10,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS is_serviceable BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS polygon_coordinates JSONB,
  ADD COLUMN IF NOT EXISTS exclusion_polygons JSONB,
  ADD COLUMN IF NOT EXISTS radius_km NUMERIC(6,2),
  ADD COLUMN IF NOT EXISTS center_latitude NUMERIC(10,7),
  ADD COLUMN IF NOT EXISTS center_longitude NUMERIC(10,7),
  ADD COLUMN IF NOT EXISTS estimated_delivery_minutes INTEGER,
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

-- ══ Storefront: categories (Medusa product_category shape), lead enquiries ══
CREATE TABLE IF NOT EXISTS public.product_category (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  handle TEXT NOT NULL,
  mpath TEXT,
  is_active BOOLEAN NOT NULL DEFAULT false,
  is_internal BOOLEAN NOT NULL DEFAULT false,
  rank INTEGER NOT NULL DEFAULT 0,
  parent_category_id TEXT REFERENCES public.product_category(id) ON DELETE CASCADE,
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_product_category_handle ON public.product_category(handle) WHERE deleted_at IS NULL;
CREATE TABLE IF NOT EXISTS public.product_category_product (
  product_id TEXT NOT NULL REFERENCES public.product(id) ON DELETE CASCADE,
  product_category_id TEXT NOT NULL REFERENCES public.product_category(id) ON DELETE CASCADE,
  PRIMARY KEY (product_id, product_category_id)
);

CREATE TABLE IF NOT EXISTS public.lead_enquiry (
  id VARCHAR(120) PRIMARY KEY,
  type VARCHAR(50) NOT NULL,
  name VARCHAR(255) NOT NULL,
  phone VARCHAR(50) NOT NULL,
  email VARCHAR(255),
  details TEXT,
  status VARCHAR(50) DEFAULT 'new',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ══ Marketplace shared inventory & feature flags (frontend/scripts/run_marketplace_migrations.js, DDL only, no seed) ══
CREATE TABLE IF NOT EXISTS public.shared_inventory (
  id TEXT PRIMARY KEY,
  product_id TEXT NOT NULL,
  variant_id TEXT NOT NULL,
  merchandise_type TEXT NOT NULL CHECK (merchandise_type IN ('CAKE', 'BOUQUET')),
  title TEXT NOT NULL,
  quantity INTEGER NOT NULL DEFAULT 0 CHECK (quantity >= 0),
  reserved INTEGER NOT NULL DEFAULT 0 CHECK (reserved >= 0),
  safety_threshold INTEGER NOT NULL DEFAULT 5,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ,
  CONSTRAINT uq_shared_inventory_product_variant UNIQUE (product_id, variant_id),
  CONSTRAINT chk_reserved_le_quantity CHECK (reserved <= quantity)
);
CREATE TABLE IF NOT EXISTS public.inventory_reservation (
  id TEXT PRIMARY KEY,
  shared_inventory_id TEXT NOT NULL REFERENCES public.shared_inventory(id) ON DELETE CASCADE,
  order_id TEXT,
  cart_id TEXT,
  entity_type TEXT,
  entity_id TEXT,
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  status TEXT NOT NULL CHECK (status IN ('RESERVED', 'RELEASED', 'CONSUMED')) DEFAULT 'RESERVED',
  channel_type TEXT,
  channel_id TEXT,
  expires_at TIMESTAMPTZ NOT NULL,
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_inv_reservation_order ON public.inventory_reservation(order_id);
CREATE INDEX IF NOT EXISTS idx_inv_reservation_cart ON public.inventory_reservation(cart_id);

-- corporate-account.repository.ts touches updated_at on import batches
ALTER TABLE public.corporate_employee_import_batch ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
CREATE INDEX IF NOT EXISTS idx_inv_reservation_expiry ON public.inventory_reservation(status, expires_at);
ALTER TABLE public.inventory_movement
  ADD COLUMN IF NOT EXISTS shared_inventory_id TEXT REFERENCES public.shared_inventory(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS partner_id TEXT,
  ADD COLUMN IF NOT EXISTS actor_role TEXT,
  ADD COLUMN IF NOT EXISTS previous_quantity INTEGER,
  ADD COLUMN IF NOT EXISTS new_quantity INTEGER,
  ADD COLUMN IF NOT EXISTS previous_reserved INTEGER,
  ADD COLUMN IF NOT EXISTS new_reserved INTEGER;

CREATE TABLE IF NOT EXISTS public.feature_flag (
  id TEXT PRIMARY KEY,
  key TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT NULL,
  category TEXT NOT NULL CHECK (category IN ('INVENTORY', 'MARKETPLACE', 'OPERATIONS', 'ACCOUNTING', 'STOREFRONT')),
  scope TEXT NOT NULL CHECK (scope IN ('GLOBAL', 'BRANCH', 'PARTNER')) DEFAULT 'GLOBAL',
  entity_id TEXT NOT NULL DEFAULT 'global',
  is_enabled BOOLEAN NOT NULL DEFAULT false,
  is_system_mandatory BOOLEAN NOT NULL DEFAULT false,
  metadata JSONB NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_feature_flag_key_scope_entity UNIQUE (key, scope, entity_id)
);
CREATE TABLE IF NOT EXISTS public.feature_flag_audit (
  id TEXT PRIMARY KEY,
  flag_id TEXT NOT NULL,
  key TEXT NOT NULL,
  scope TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  previous_value BOOLEAN NULL,
  new_value BOOLEAN NOT NULL,
  actor_id TEXT NOT NULL,
  actor_role TEXT NOT NULL,
  reason TEXT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_feature_flag_audit_key ON public.feature_flag_audit(key, created_at DESC);

-- ══ Popups (backend/create_popup_engagement_tables.js); live tables are empty stubs ══
ALTER TABLE public.popup_campaigns
  ADD COLUMN IF NOT EXISTS name VARCHAR(255),
  ADD COLUMN IF NOT EXISTS slug VARCHAR(255),
  ADD COLUMN IF NOT EXISTS description TEXT,
  ADD COLUMN IF NOT EXISTS popup_type VARCHAR(64),
  ADD COLUMN IF NOT EXISTS status VARCHAR(32) NOT NULL DEFAULT 'draft',
  ADD COLUMN IF NOT EXISTS priority INTEGER NOT NULL DEFAULT 10,
  ADD COLUMN IF NOT EXISTS enabled BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS start_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS end_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS timezone VARCHAR(64) NOT NULL DEFAULT 'Asia/Kolkata',
  ADD COLUMN IF NOT EXISTS created_by VARCHAR(64),
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
CREATE UNIQUE INDEX IF NOT EXISTS uq_popup_campaigns_slug ON public.popup_campaigns(slug) WHERE slug IS NOT NULL;
ALTER TABLE public.popup_versions
  ADD COLUMN IF NOT EXISTS popup_campaign_id TEXT REFERENCES public.popup_campaigns(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS content_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS design_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS trigger_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS audience_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS frequency_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS schedule_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS cta_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS offer_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS media_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS rules_json JSONB NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS published_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

-- ══ Misc columns read/written by storefront, SEO, reviews, orders ══
ALTER TABLE public.product
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'published',
  ADD COLUMN IF NOT EXISTS thumbnail TEXT,
  ADD COLUMN IF NOT EXISTS is_giftcard BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS discountable BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE public.cms_page
  ADD COLUMN IF NOT EXISTS published_config JSONB,
  ADD COLUMN IF NOT EXISTS draft_config JSONB,
  ADD COLUMN IF NOT EXISTS is_published BOOLEAN GENERATED ALWAYS AS (status = 'published') STORED;
ALTER TABLE public.cms_redirect
  ADD COLUMN IF NOT EXISTS to_url VARCHAR(2048),
  ADD COLUMN IF NOT EXISTS redirect_type INTEGER NOT NULL DEFAULT 301;
ALTER TABLE public.cms_redirect ALTER COLUMN to_path DROP NOT NULL;
ALTER TABLE public.customer ADD COLUMN IF NOT EXISTS has_account BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE public.order_status_history
  ADD COLUMN IF NOT EXISTS changed_by TEXT,
  ADD COLUMN IF NOT EXISTS notes TEXT;
ALTER TABLE public.product_review
  ADD COLUMN IF NOT EXISTS customer_id TEXT,
  ADD COLUMN IF NOT EXISTS body TEXT,
  ADD COLUMN IF NOT EXISTS reply TEXT,
  ADD COLUMN IF NOT EXISTS replied_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS verified_purchase BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE public.product_review ALTER COLUMN customer_uid DROP NOT NULL;

-- ══ Order numbering (migration/Migration_Unique_Order_Invoice_Numbering_V2.sql phases 2 + 5A) ══
CREATE TABLE IF NOT EXISTS public.order_sequence (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  prefix TEXT NOT NULL DEFAULT 'CTH',
  last_seq INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_order_sequence_prefix UNIQUE (prefix)
);
ALTER TABLE public.order_sequence ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.allocate_order_number(p_prefix TEXT DEFAULT 'CTH')
RETURNS TABLE (order_number TEXT, sequence_value INTEGER)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp
AS $$
DECLARE
  v_seq INTEGER;
  v_date TEXT;
BEGIN
  v_date := TO_CHAR(NOW() AT TIME ZONE 'Asia/Kolkata', 'YYYYMMDD');
  PERFORM pg_advisory_xact_lock(hashtext('order_seq::' || p_prefix)::bigint);
  INSERT INTO public.order_sequence (prefix, last_seq)
  VALUES (p_prefix, 1)
  ON CONFLICT ON CONSTRAINT uq_order_sequence_prefix DO UPDATE
    SET last_seq = order_sequence.last_seq + 1, updated_at = NOW()
  RETURNING order_sequence.last_seq INTO v_seq;
  RETURN QUERY SELECT p_prefix || '-' || v_date || '-' || LPAD(v_seq::text, 6, '0'), v_seq;
END;
$$;


COMMIT;
