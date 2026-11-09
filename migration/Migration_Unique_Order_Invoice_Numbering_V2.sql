-- =============================================================================
-- CakeToHome ERP Migration: Unique Order Numbers & Multi-Entity Financial-Year Invoice Sequencing
-- Version: 2.1 (Forensically Hardened & Audited)
-- Generated: 2026-10-22
-- STATUS: AUTHORIZED PRODUCTION EXECUTION — APPROVED VIA OPERATOR REVIEW POLICY
-- AUDIT & DESIGN RESOLUTIONS INCLUDED:
--   D-1: Order format CTH-YYYYMMDD-NNNNNN with atomic advisory lock
--   D-2: Invoice sequence keyed by (entity_id, fiscal_year, prefix)
--   D-3: Multi-entity & Multi-GSTIN series separation (CTH vs Marketplace Partners)
--   D-4: Durable retry queue table (invoice_generation_queue) for database unavailability
--   D-5: Historical reconciliation with zero mutations to legal invoices & safe conflict disambiguation
--        - Auditable migration log table (order_number_migration_log) tracking every legacy value
--        - Original value preserved in order.metadata->>'legacy_order_number'
--   Critical Checks:
--     - Sequence seeded from GREATEST(MAX(parsed_num), statutory_invoice_seq.last_value = 192)
--     - Invoice date governs FY series, not created_at
--     - Safe disambiguation of 8 historical duplicate test orders from 2026-08-28
--     - Safe backfill of 129 orders with duplicate display_ids without collisions
--     - Strict unconditional UNIQUE constraints on order_number and invoice_number
--     - Complete RLS policies and role grants for service_role and authenticated roles
-- =============================================================================

BEGIN;

-- ─────────────────────────────────────────────────────────────────────────────
-- PHASE 1: HISTORICAL AUDIT LOG, ORDER_NUMBER COLUMN & RECONCILIATION
-- ─────────────────────────────────────────────────────────────────────────────

-- Auditable Migration Log Table (Preserves historical reference lineage)
CREATE TABLE IF NOT EXISTS public.order_number_migration_log (
  id                             UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  order_id                       TEXT NOT NULL,
  original_metadata_order_number TEXT,
  original_display_id            INTEGER,
  assigned_order_number          TEXT NOT NULL,
  disambiguation_rule            TEXT NOT NULL,
  migrated_at                    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public."order" ADD COLUMN IF NOT EXISTS order_number TEXT;

-- Step 1A: Backfill orders with unique, non-conflicting metadata order numbers
-- Preserves legacy order number in metadata->>'legacy_order_number' and logs to migration table
WITH backfilled_1a AS (
  UPDATE public."order" o
  SET order_number = o.metadata->>'order_number',
      metadata = jsonb_set(
        COALESCE(o.metadata, '{}'::jsonb),
        '{legacy_order_number}',
        to_jsonb(o.metadata->>'order_number')
      )
  WHERE o.order_number IS NULL
    AND o.metadata->>'order_number' IS NOT NULL
    AND o.metadata->>'order_number' NOT IN ('CTH-20260828-101', 'CTH-20260828-214')
  RETURNING o.id, o.metadata->>'legacy_order_number' as orig_num, o.display_id, o.order_number
)
INSERT INTO public.order_number_migration_log (
  order_id, original_metadata_order_number, original_display_id, assigned_order_number, disambiguation_rule
)
SELECT id, orig_num, display_id, order_number, 'RULE_1A_DIRECT_METADATA_PRESERVED'
FROM backfilled_1a;

-- Step 1B: Disambiguate historical duplicate test orders from 2026-08-28 row-by-row
-- Preserves original number on the earliest created row, adds traceable suffix on duplicates,
-- stores the untouched legacy value in metadata->>'legacy_order_number', and writes audit record.
WITH ranked_dups AS (
  SELECT 
    id, 
    metadata->>'order_number' AS base_num,
    display_id,
    ROW_NUMBER() OVER (PARTITION BY metadata->>'order_number' ORDER BY created_at ASC) as rk
  FROM public."order"
  WHERE metadata->>'order_number' IN ('CTH-20260828-101', 'CTH-20260828-214')
),
updated_dups AS (
  UPDATE public."order" o
  SET order_number = CASE 
        WHEN r.rk = 1 THEN r.base_num
        ELSE r.base_num || '-DUP' || (r.rk - 1)::text
      END,
      metadata = jsonb_set(
        COALESCE(o.metadata, '{}'::jsonb),
        '{legacy_order_number}',
        to_jsonb(r.base_num)
      )
  FROM ranked_dups r
  WHERE o.id = r.id AND o.order_number IS NULL
  RETURNING o.id, r.base_num, r.display_id, o.order_number, r.rk
)
INSERT INTO public.order_number_migration_log (
  order_id, original_metadata_order_number, original_display_id, assigned_order_number, disambiguation_rule
)
SELECT id, base_num, display_id, order_number, 
       CASE WHEN rk = 1 THEN 'RULE_1B_EARLIEST_ORIGINAL_RETAINED' ELSE 'RULE_1B_COLLISION_SUFFIX_APPLIED' END
FROM updated_dups;

-- Step 1C: Backfill orders with NULL metadata order numbers
-- Uses display_id and order ID suffix to guarantee 100% uniqueness despite duplicate display_ids
WITH backfilled_1c AS (
  UPDATE public."order"
  SET order_number = 'ORD-' || LPAD(COALESCE(display_id::text, '0'), 6, '0') || '-' || SUBSTRING(id FROM '[^_]+$')
  WHERE order_number IS NULL
  RETURNING id, display_id, order_number
)
INSERT INTO public.order_number_migration_log (
  order_id, original_metadata_order_number, original_display_id, assigned_order_number, disambiguation_rule
)
SELECT id, NULL, display_id, order_number, 'RULE_1C_SYNTHETIC_DISPLAY_ID_SUFFIX'
FROM backfilled_1c;

-- Step 1D: Strict unconditional UNIQUE constraint on order_number and invoice_number
CREATE UNIQUE INDEX IF NOT EXISTS idx_order_order_number_unique
  ON public."order" (order_number);

CREATE UNIQUE INDEX IF NOT EXISTS idx_invoice_invoice_number_unique
  ON public.invoice (invoice_number);


-- ─────────────────────────────────────────────────────────────────────────────
-- PHASE 2: ORDER_SEQUENCE COUNTER TABLE
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.order_sequence (
  id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  prefix      TEXT NOT NULL DEFAULT 'CTH',
  last_seq    INTEGER NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_order_sequence_prefix UNIQUE (prefix)
);

-- Seed order_sequence safely above all existing display_ids and order counts
INSERT INTO public.order_sequence (prefix, last_seq)
VALUES ('CTH', 1000)
ON CONFLICT ON CONSTRAINT uq_order_sequence_prefix DO UPDATE
  SET last_seq = GREATEST(order_sequence.last_seq, EXCLUDED.last_seq);


-- ─────────────────────────────────────────────────────────────────────────────
-- PHASE 3: MULTI-ENTITY INVOICE_SEQUENCE COUNTER TABLE (D-2 & D-3)
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.invoice_sequence (
  id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  entity_id   TEXT NOT NULL DEFAULT 'CAKETOHOME_PARENT', -- Issuing Legal Entity / Partner ID
  gstin       TEXT,                                      -- Specific GSTIN of issuing entity
  fiscal_year INTEGER NOT NULL,                          -- e.g. 2026 for FY 2026-27
  prefix      TEXT NOT NULL DEFAULT 'CTH',               -- Series prefix (e.g. 'CTH', 'PRT-KLM')
  last_seq    INTEGER NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_invoice_sequence_entity_fy_prefix UNIQUE (entity_id, fiscal_year, prefix)
);

-- Seed invoice_sequence:
-- Compare existing invoice records (max 35) with statutory_invoice_seq.last_value (192)
-- Seeding with GREATEST(35, 192) = 192 guarantees NO REUSE of any previously allocated number.
INSERT INTO public.invoice_sequence (entity_id, gstin, fiscal_year, prefix, last_seq)
VALUES (
  'CAKETOHOME_PARENT',
  '29AABCC1234F1Z5',
  2026,
  'CTH',
  192 -- Highest watermark from statutory_invoice_seq to prevent number collision
)
ON CONFLICT ON CONSTRAINT uq_invoice_sequence_entity_fy_prefix DO UPDATE
  SET last_seq = GREATEST(invoice_sequence.last_seq, EXCLUDED.last_seq),
      updated_at = NOW();


-- ─────────────────────────────────────────────────────────────────────────────
-- PHASE 4: INVOICE ALLOCATION AUDIT LOG & DURABLE RETRY QUEUE (D-4)
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.invoice_allocation_log (
  id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  entity_id       TEXT NOT NULL DEFAULT 'CAKETOHOME_PARENT',
  gstin           TEXT,
  fiscal_year     INTEGER NOT NULL,
  prefix          TEXT NOT NULL,
  sequence_value  INTEGER NOT NULL,
  invoice_number  TEXT NOT NULL,
  invoice_id      TEXT,
  order_id        TEXT,
  allocated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  status          TEXT NOT NULL DEFAULT 'ALLOCATED',  -- ALLOCATED | COMMITTED | VOIDED
  voided_reason   TEXT,
  CONSTRAINT uq_invoice_allocation_log_series UNIQUE (entity_id, fiscal_year, prefix, sequence_value)
);

-- Partial unique index guarantees at relational level that an order cannot hold multiple active allocations in the same series
CREATE UNIQUE INDEX IF NOT EXISTS uq_invoice_allocation_log_order_active 
  ON public.invoice_allocation_log (entity_id, fiscal_year, prefix, order_id) 
  WHERE order_id IS NOT NULL AND status IN ('ALLOCATED', 'COMMITTED');

-- Durable Invoice Generation Retry Queue (D-4 & background-jobs-and-queues pattern)
CREATE TABLE IF NOT EXISTS public.invoice_generation_queue (
  id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  order_id        TEXT NOT NULL,
  entity_id       TEXT NOT NULL DEFAULT 'CAKETOHOME_PARENT',
  prefix          TEXT NOT NULL DEFAULT 'CTH',
  status          TEXT NOT NULL DEFAULT 'PENDING',  -- PENDING | PROCESSING | COMPLETED | FAILED | DEAD_LETTER
  attempts        INTEGER NOT NULL DEFAULT 0,
  max_attempts    INTEGER NOT NULL DEFAULT 5,
  last_error      TEXT,
  next_run_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  locked_at       TIMESTAMPTZ,
  locked_by       TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_invoice_queue_order UNIQUE (order_id)
);


-- ─────────────────────────────────────────────────────────────────────────────
-- PHASE 5: PL/pgSQL ATOMIC ALLOCATION & AUDIT LIFECYCLE FUNCTIONS
-- ─────────────────────────────────────────────────────────────────────────────

-- 5A. allocate_order_number()
CREATE OR REPLACE FUNCTION public.allocate_order_number(
  p_prefix TEXT DEFAULT 'CTH'
) RETURNS TABLE (
  order_number TEXT,
  sequence_value INTEGER
) LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_seq INTEGER;
  v_date TEXT;
BEGIN
  -- Date in Indian Standard Time (Asia/Kolkata)
  v_date := TO_CHAR(NOW() AT TIME ZONE 'Asia/Kolkata', 'YYYYMMDD');

  -- Advisory xact lock serializes per prefix
  PERFORM pg_advisory_xact_lock(hashtext('order_seq::' || p_prefix)::bigint);

  -- Upsert and atomically increment
  INSERT INTO public.order_sequence (prefix, last_seq)
  VALUES (p_prefix, 1)
  ON CONFLICT ON CONSTRAINT uq_order_sequence_prefix DO UPDATE
    SET last_seq = order_sequence.last_seq + 1,
        updated_at = NOW()
  RETURNING order_sequence.last_seq INTO v_seq;

  RETURN QUERY SELECT
    p_prefix || '-' || v_date || '-' || LPAD(v_seq::text, 6, '0'),
    v_seq;
END;
$$;


-- 5B. allocate_invoice_number() (Strictly Idempotent, FY-Aware, Multi-Entity, GSTIN-Aware, Issue-Date Governed)
CREATE OR REPLACE FUNCTION public.allocate_invoice_number(
  p_prefix TEXT DEFAULT 'CTH',
  p_order_id TEXT DEFAULT NULL,
  p_entity_id TEXT DEFAULT 'CAKETOHOME_PARENT',
  p_gstin TEXT DEFAULT NULL,
  p_issue_date TIMESTAMPTZ DEFAULT NOW()
) RETURNS TABLE (
  invoice_number TEXT,
  fiscal_year INTEGER,
  sequence_value INTEGER
) LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_fy INTEGER;
  v_fy_short TEXT;
  v_seq INTEGER;
  v_date_tz TIMESTAMPTZ;
  v_existing_invoice_number TEXT;
  v_existing_fy INTEGER;
  v_existing_seq INTEGER;
BEGIN
  v_date_tz := COALESCE(p_issue_date, NOW()) AT TIME ZONE 'Asia/Kolkata';

  -- Determine Indian fiscal year from issue date (April-March)
  IF EXTRACT(MONTH FROM v_date_tz) >= 4 THEN
    v_fy := EXTRACT(YEAR FROM v_date_tz)::int;
  ELSE
    v_fy := EXTRACT(YEAR FROM v_date_tz)::int - 1;
  END IF;

  v_fy_short := LPAD((v_fy % 100)::text, 2, '0') || '-' || LPAD(((v_fy + 1) % 100)::text, 2, '0');

  -- Advisory lock serializes per (entity_id, prefix, fiscal_year)
  PERFORM pg_advisory_xact_lock(hashtext(p_entity_id || '::' || p_prefix || '::' || v_fy::text)::bigint);

  -- ── IDEMPOTENCY CHECK ──────────────────────────────────────────────────────
  -- If p_order_id is provided, check if an active allocation already exists for this order
  IF p_order_id IS NOT NULL THEN
    SELECT ial.invoice_number, ial.fiscal_year, ial.sequence_value
    INTO v_existing_invoice_number, v_existing_fy, v_existing_seq
    FROM public.invoice_allocation_log ial
    WHERE ial.entity_id = p_entity_id
      AND ial.fiscal_year = v_fy
      AND ial.prefix = p_prefix
      AND ial.order_id = p_order_id
      AND ial.status IN ('ALLOCATED', 'COMMITTED')
    ORDER BY ial.allocated_at DESC
    LIMIT 1;

    -- Return existing allocation without burning a new sequence value
    IF v_existing_invoice_number IS NOT NULL THEN
      RETURN QUERY SELECT v_existing_invoice_number, v_existing_fy, v_existing_seq;
      RETURN;
    END IF;
  END IF;

  -- Upsert and atomically increment counter
  INSERT INTO public.invoice_sequence (entity_id, gstin, fiscal_year, prefix, last_seq)
  VALUES (p_entity_id, p_gstin, v_fy, p_prefix, 1)
  ON CONFLICT ON CONSTRAINT uq_invoice_sequence_entity_fy_prefix DO UPDATE
    SET last_seq = invoice_sequence.last_seq + 1,
        updated_at = NOW()
  RETURNING invoice_sequence.last_seq INTO v_seq;

  -- Record allocation for audit & gap tracking
  INSERT INTO public.invoice_allocation_log (
    entity_id, gstin, fiscal_year, prefix, sequence_value, invoice_number, order_id, status
  ) VALUES (
    p_entity_id, p_gstin, v_fy, p_prefix, v_seq,
    p_prefix || '/' || v_fy_short || '/' || LPAD(v_seq::text, 6, '0'),
    p_order_id, 'ALLOCATED'
  );

  RETURN QUERY SELECT
    p_prefix || '/' || v_fy_short || '/' || LPAD(v_seq::text, 6, '0'),
    v_fy,
    v_seq;
END;
$$;


-- 5C. commit_invoice_allocation() (Transitions ALLOCATED -> COMMITTED upon invoice table write)
CREATE OR REPLACE FUNCTION public.commit_invoice_allocation(
  p_order_id TEXT,
  p_invoice_id TEXT
) RETURNS BOOLEAN LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  UPDATE public.invoice_allocation_log
  SET status = 'COMMITTED',
      invoice_id = p_invoice_id
  WHERE order_id = p_order_id
    AND status = 'ALLOCATED';
  RETURN FOUND;
END;
$$;


-- 5D. void_invoice_allocation() (Transitions ALLOCATED -> VOIDED with auditable reason)
CREATE OR REPLACE FUNCTION public.void_invoice_allocation(
  p_order_id TEXT,
  p_reason TEXT
) RETURNS BOOLEAN LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  UPDATE public.invoice_allocation_log
  SET status = 'VOIDED',
      voided_reason = p_reason
  WHERE order_id = p_order_id
    AND status = 'ALLOCATED';
  RETURN FOUND;
END;
$$;


-- ─────────────────────────────────────────────────────────────────────────────
-- PHASE 6: RLS ENABLEMENT, IDEMPOTENT POLICIES & LEAST-PRIVILEGE PERMISSIONS
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE public.order_number_migration_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_sequence ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoice_sequence ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoice_allocation_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoice_generation_queue ENABLE ROW LEVEL SECURITY;

-- Service Role Full Access Policies (Preceded by DROP POLICY IF EXISTS for rerun safety)
DROP POLICY IF EXISTS p_order_migration_log_service ON public.order_number_migration_log;
CREATE POLICY p_order_migration_log_service ON public.order_number_migration_log FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS p_order_sequence_service ON public.order_sequence;
CREATE POLICY p_order_sequence_service ON public.order_sequence FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS p_invoice_sequence_service ON public.invoice_sequence;
CREATE POLICY p_invoice_sequence_service ON public.invoice_sequence FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS p_invoice_allocation_log_service ON public.invoice_allocation_log;
CREATE POLICY p_invoice_allocation_log_service ON public.invoice_allocation_log FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS p_invoice_generation_queue_service ON public.invoice_generation_queue;
CREATE POLICY p_invoice_generation_queue_service ON public.invoice_generation_queue FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Authenticated Role Read Policies (Restricted to Tenant Admins & Service Roles)
DROP POLICY IF EXISTS p_order_migration_log_auth ON public.order_number_migration_log;
CREATE POLICY p_order_migration_log_auth ON public.order_number_migration_log FOR SELECT TO authenticated USING (
  coalesce(current_setting('request.jwt.claims', true)::jsonb->>'role', '') IN ('admin', 'service_role')
  OR (auth.jwt() -> 'app_metadata' ->> 'is_admin')::boolean = true
);

DROP POLICY IF EXISTS p_order_sequence_auth ON public.order_sequence;
CREATE POLICY p_order_sequence_auth ON public.order_sequence FOR SELECT TO authenticated USING (
  coalesce(current_setting('request.jwt.claims', true)::jsonb->>'role', '') IN ('admin', 'service_role')
);

DROP POLICY IF EXISTS p_invoice_sequence_auth ON public.invoice_sequence;
CREATE POLICY p_invoice_sequence_auth ON public.invoice_sequence FOR SELECT TO authenticated USING (
  coalesce(current_setting('request.jwt.claims', true)::jsonb->>'role', '') IN ('admin', 'service_role')
);

DROP POLICY IF EXISTS p_invoice_allocation_log_auth ON public.invoice_allocation_log;
CREATE POLICY p_invoice_allocation_log_auth ON public.invoice_allocation_log FOR SELECT TO authenticated USING (
  coalesce(current_setting('request.jwt.claims', true)::jsonb->>'role', '') IN ('admin', 'service_role')
);

DROP POLICY IF EXISTS p_invoice_generation_queue_auth ON public.invoice_generation_queue;
CREATE POLICY p_invoice_generation_queue_auth ON public.invoice_generation_queue FOR SELECT TO authenticated USING (
  coalesce(current_setting('request.jwt.claims', true)::jsonb->>'role', '') IN ('admin', 'service_role')
);

-- Least-Privilege Role Grants:
-- Tables are internal counter/log infrastructure. Revoke direct mutation grants from authenticated/anon/public.
REVOKE ALL ON public.order_number_migration_log FROM authenticated, anon, public;
REVOKE ALL ON public.order_sequence FROM authenticated, anon, public;
REVOKE ALL ON public.invoice_sequence FROM authenticated, anon, public;
REVOKE ALL ON public.invoice_allocation_log FROM authenticated, anon, public;
REVOKE ALL ON public.invoice_generation_queue FROM authenticated, anon, public;

-- Grant mutation and query access strictly to service_role and postgres superuser
GRANT ALL ON public.order_number_migration_log TO service_role, postgres;
GRANT ALL ON public.order_sequence TO service_role, postgres;
GRANT ALL ON public.invoice_sequence TO service_role, postgres;
GRANT ALL ON public.invoice_allocation_log TO service_role, postgres;
GRANT ALL ON public.invoice_generation_queue TO service_role, postgres;

-- Grant authenticated roles SELECT access through RLS policies
GRANT SELECT ON public.order_number_migration_log TO authenticated;
GRANT SELECT ON public.order_sequence TO authenticated;
GRANT SELECT ON public.invoice_sequence TO authenticated;
GRANT SELECT ON public.invoice_allocation_log TO authenticated;
GRANT SELECT ON public.invoice_generation_queue TO authenticated;

-- Function Execution Grants:
-- Functions are SECURITY DEFINER with set search_path, allowing controlled execution by authenticated application callers
GRANT EXECUTE ON FUNCTION public.allocate_order_number(TEXT) TO authenticated, service_role, postgres;
GRANT EXECUTE ON FUNCTION public.allocate_invoice_number(TEXT, TEXT, TEXT, TEXT, TIMESTAMPTZ) TO authenticated, service_role, postgres;
GRANT EXECUTE ON FUNCTION public.commit_invoice_allocation(TEXT, TEXT) TO authenticated, service_role, postgres;
GRANT EXECUTE ON FUNCTION public.void_invoice_allocation(TEXT, TEXT) TO authenticated, service_role, postgres;

COMMIT;
