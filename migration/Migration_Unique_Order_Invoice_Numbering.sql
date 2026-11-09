-- =============================================================================
-- CakeToHome ERP Migration: Unique Order Numbers & Financial-Year Invoice Sequencing
-- Generated: 2026-10-21
-- Phase: 1 (Schema Hardening) + Phase 2 (Atomic Allocation Functions)
--
-- SAFETY: All DDL is idempotent (IF NOT EXISTS / CREATE OR REPLACE).
--         All backfills use WHERE ... IS NULL guards.
--         Zero mutations to historical data values.
-- =============================================================================

BEGIN;

-- ─────────────────────────────────────────────────────────────────────────────
-- PHASE 1A: ORDER_NUMBER — Promote from JSONB metadata to first-class column
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE public."order" ADD COLUMN IF NOT EXISTS order_number TEXT;

-- Backfill existing orders from metadata
UPDATE public."order"
SET order_number = metadata->>'order_number'
WHERE order_number IS NULL
  AND metadata->>'order_number' IS NOT NULL;

-- For any remaining rows that have no metadata order_number, derive from display_id
UPDATE public."order"
SET order_number = 'ORD-' || LPAD(COALESCE(display_id::text, id), 6, '0')
WHERE order_number IS NULL;

-- Verify zero duplicates before creating UNIQUE index
-- (This will fail the transaction cleanly if duplicates exist, requiring manual dedup)
CREATE UNIQUE INDEX IF NOT EXISTS idx_order_order_number_unique
  ON public."order" (order_number) WHERE deleted_at IS NULL;


-- ─────────────────────────────────────────────────────────────────────────────
-- PHASE 1B: ORDER_SEQUENCE — Atomic monotonic counter for order numbers
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.order_sequence (
  id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  prefix      TEXT NOT NULL DEFAULT 'CTH',
  last_seq    INTEGER NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_order_sequence_prefix UNIQUE (prefix)
);

-- Seed with the count of existing orders to avoid collision
INSERT INTO public.order_sequence (prefix, last_seq)
VALUES ('CTH', COALESCE(
  (SELECT COUNT(*) FROM public."order" WHERE deleted_at IS NULL),
  0
))
ON CONFLICT ON CONSTRAINT uq_order_sequence_prefix DO UPDATE
  SET last_seq = GREATEST(order_sequence.last_seq, EXCLUDED.last_seq);


-- ─────────────────────────────────────────────────────────────────────────────
-- PHASE 1C: INVOICE_NUMBER — Add UNIQUE constraint
-- ─────────────────────────────────────────────────────────────────────────────

CREATE UNIQUE INDEX IF NOT EXISTS idx_invoice_invoice_number_unique
  ON public.invoice (invoice_number) WHERE deleted_at IS NULL;


-- ─────────────────────────────────────────────────────────────────────────────
-- PHASE 1D: INVOICE_SEQUENCE — FY-aware counter table replacing raw PG sequence
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.invoice_sequence (
  id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  fiscal_year INTEGER NOT NULL,          -- e.g. 2026 for FY 2026-27
  prefix      TEXT NOT NULL DEFAULT 'CTH',
  last_seq    INTEGER NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_invoice_sequence_fy_prefix UNIQUE (fiscal_year, prefix)
);

-- Seed from existing invoices: extract max sequence per FY
INSERT INTO public.invoice_sequence (fiscal_year, prefix, last_seq)
SELECT
  CASE
    WHEN EXTRACT(MONTH FROM i.created_at) >= 4 THEN EXTRACT(YEAR FROM i.created_at)::int
    ELSE EXTRACT(YEAR FROM i.created_at)::int - 1
  END AS fiscal_year,
  'CTH' AS prefix,
  MAX(
    CASE
      WHEN i.invoice_number ~ '^CTH/\d{2}-\d{2}/\d+$'
      THEN CAST(SPLIT_PART(i.invoice_number, '/', 3) AS INTEGER)
      ELSE 0
    END
  ) AS last_seq
FROM public.invoice i
WHERE i.invoice_number LIKE 'CTH/%' AND i.deleted_at IS NULL
GROUP BY 1
ON CONFLICT ON CONSTRAINT uq_invoice_sequence_fy_prefix DO UPDATE
  SET last_seq = GREATEST(invoice_sequence.last_seq, EXCLUDED.last_seq),
      updated_at = NOW();


-- ─────────────────────────────────────────────────────────────────────────────
-- PHASE 1E: INVOICE ALLOCATION AUDIT LOG — GST gap tracking
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.invoice_allocation_log (
  id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  fiscal_year     INTEGER NOT NULL,
  prefix          TEXT NOT NULL,
  sequence_value  INTEGER NOT NULL,
  invoice_number  TEXT NOT NULL,
  invoice_id      TEXT,
  order_id        TEXT,
  allocated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  status          TEXT NOT NULL DEFAULT 'ALLOCATED',  -- ALLOCATED | COMMITTED | VOIDED
  voided_reason   TEXT,
  CONSTRAINT uq_invoice_allocation_fy_prefix_seq UNIQUE (fiscal_year, prefix, sequence_value)
);


-- ─────────────────────────────────────────────────────────────────────────────
-- PHASE 2A: allocate_order_number() — Atomic order number allocation
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.allocate_order_number(
  p_prefix TEXT DEFAULT 'CTH'
) RETURNS TABLE (
  order_number TEXT,
  sequence_value INTEGER
) LANGUAGE plpgsql AS $$
DECLARE
  v_seq INTEGER;
  v_date TEXT;
BEGIN
  v_date := TO_CHAR(NOW() AT TIME ZONE 'Asia/Kolkata', 'YYYYMMDD');

  -- Advisory lock serializes per prefix. hashtext returns int4; cast to bigint.
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


-- ─────────────────────────────────────────────────────────────────────────────
-- PHASE 2B: allocate_invoice_number() — Atomic FY-aware invoice number allocation
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.allocate_invoice_number(
  p_prefix TEXT DEFAULT 'CTH',
  p_order_id TEXT DEFAULT NULL
) RETURNS TABLE (
  invoice_number TEXT,
  fiscal_year INTEGER,
  sequence_value INTEGER
) LANGUAGE plpgsql AS $$
DECLARE
  v_fy INTEGER;
  v_fy_short TEXT;
  v_seq INTEGER;
BEGIN
  -- Determine current Indian fiscal year (April-March)
  IF EXTRACT(MONTH FROM NOW() AT TIME ZONE 'Asia/Kolkata') >= 4 THEN
    v_fy := EXTRACT(YEAR FROM NOW() AT TIME ZONE 'Asia/Kolkata')::int;
  ELSE
    v_fy := EXTRACT(YEAR FROM NOW() AT TIME ZONE 'Asia/Kolkata')::int - 1;
  END IF;

  v_fy_short := LPAD((v_fy % 100)::text, 2, '0') || '-' || LPAD(((v_fy + 1) % 100)::text, 2, '0');

  -- Advisory lock serializes per (prefix, fiscal_year)
  PERFORM pg_advisory_xact_lock(hashtext(p_prefix || '::inv::' || v_fy::text)::bigint);

  -- Upsert and atomically increment
  INSERT INTO public.invoice_sequence (fiscal_year, prefix, last_seq)
  VALUES (v_fy, p_prefix, 1)
  ON CONFLICT ON CONSTRAINT uq_invoice_sequence_fy_prefix DO UPDATE
    SET last_seq = invoice_sequence.last_seq + 1,
        updated_at = NOW()
  RETURNING invoice_sequence.last_seq INTO v_seq;

  -- Record allocation for GST gap tracking
  INSERT INTO public.invoice_allocation_log (
    fiscal_year, prefix, sequence_value, invoice_number, order_id
  ) VALUES (
    v_fy, p_prefix, v_seq,
    p_prefix || '/' || v_fy_short || '/' || LPAD(v_seq::text, 6, '0'),
    p_order_id
  );

  RETURN QUERY SELECT
    p_prefix || '/' || v_fy_short || '/' || LPAD(v_seq::text, 6, '0'),
    v_fy,
    v_seq;
END;
$$;


-- ─────────────────────────────────────────────────────────────────────────────
-- PHASE 2C: Enable RLS on new tables
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE public.order_sequence ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoice_sequence ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoice_allocation_log ENABLE ROW LEVEL SECURITY;


COMMIT;
