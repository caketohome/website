-- CakeToHome ERP — Phase A: Company Master & GST Registration
-- Migration: 20261004_phase_a_company_gst_master.sql
-- Purpose: Create database-backed legal entity (company) and GST registration tables.
-- Replaces: Hardcoded "company_default" fallback across 9 files.
-- Constraints: INR only, Indian FY (April-March), real GSTIN validation.

-- ═══════════════════════════════════════════════════════════════════════════════
-- 1. COMPANY TABLE — Legal Entity Master
-- ═══════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.company (
    id              TEXT PRIMARY KEY DEFAULT 'cth_company_' || gen_random_uuid()::text,
    legal_name      TEXT NOT NULL,
    trade_name      TEXT,
    registered_address TEXT,
    city            TEXT,
    state_code      TEXT NOT NULL,          -- 2-digit Indian state code (e.g., '29' for Karnataka)
    pin_code        TEXT,
    pan             TEXT,                   -- PAN: AAAAA9999A format
    cin             TEXT,                   -- Company Identification Number (if applicable)
    fssai           TEXT,                   -- FSSAI License Number
    currency        TEXT NOT NULL DEFAULT 'INR',
    fy_start_month  INTEGER NOT NULL DEFAULT 4,   -- Financial year start month (4 = April)
    invoice_prefix  TEXT NOT NULL DEFAULT 'CTH',
    phone           TEXT,
    email           TEXT,
    website         TEXT,
    is_active       BOOLEAN NOT NULL DEFAULT true,
    metadata        JSONB DEFAULT '{}',
    created_by      TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Enforce single-company constraint for CakeToHome (single legal entity)
-- If multi-company is needed later, remove this constraint.
CREATE UNIQUE INDEX IF NOT EXISTS idx_company_singleton
    ON public.company (is_active) WHERE is_active = true;

-- PAN format check (optional — not enforced if PAN not yet provided)
ALTER TABLE public.company
    ADD CONSTRAINT chk_company_pan_format
    CHECK (pan IS NULL OR pan ~ '^[A-Z]{5}[0-9]{4}[A-Z]$');

-- Currency locked to INR
ALTER TABLE public.company
    ADD CONSTRAINT chk_company_currency_inr
    CHECK (currency = 'INR');

-- FY start month must be valid
ALTER TABLE public.company
    ADD CONSTRAINT chk_company_fy_start_month
    CHECK (fy_start_month BETWEEN 1 AND 12);

-- State code must be 2-digit
ALTER TABLE public.company
    ADD CONSTRAINT chk_company_state_code
    CHECK (state_code ~ '^\d{2}$');

-- ═══════════════════════════════════════════════════════════════════════════════
-- 2. GST REGISTRATION TABLE — Multi-State GST Registrations
-- ═══════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.gst_registration (
    id              TEXT PRIMARY KEY DEFAULT 'gst_' || gen_random_uuid()::text,
    company_id      TEXT NOT NULL REFERENCES public.company(id) ON DELETE RESTRICT,
    gstin           TEXT NOT NULL,          -- 15-char GSTIN: 29AAAAA0000A1Z5
    state_code      TEXT NOT NULL,          -- 2-digit state code matching first 2 chars of GSTIN
    registration_type TEXT NOT NULL DEFAULT 'REGULAR',  -- REGULAR, COMPOSITION, ISD, etc.
    legal_name      TEXT,                   -- Name as registered with GST authorities
    is_active       BOOLEAN NOT NULL DEFAULT true,
    effective_from  DATE,
    effective_to    DATE,
    metadata        JSONB DEFAULT '{}',
    created_by      TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- GSTIN must be unique across registrations
CREATE UNIQUE INDEX IF NOT EXISTS idx_gst_registration_gstin_unique
    ON public.gst_registration (gstin);

-- GSTIN format validation (15 characters, standard Indian GSTIN pattern)
ALTER TABLE public.gst_registration
    ADD CONSTRAINT chk_gst_gstin_format
    CHECK (gstin ~ '^\d{2}[A-Z]{5}\d{4}[A-Z]\d[A-Z0-9][A-Z0-9]$');

-- State code consistency: first 2 chars of GSTIN must match state_code
ALTER TABLE public.gst_registration
    ADD CONSTRAINT chk_gst_state_code_matches_gstin
    CHECK (substring(gstin FROM 1 FOR 2) = state_code);

-- State code format
ALTER TABLE public.gst_registration
    ADD CONSTRAINT chk_gst_state_code_format
    CHECK (state_code ~ '^\d{2}$');

-- Registration type enum
ALTER TABLE public.gst_registration
    ADD CONSTRAINT chk_gst_registration_type
    CHECK (registration_type IN ('REGULAR', 'COMPOSITION', 'ISD', 'CASUAL', 'SEZ', 'NRTP'));

-- Index for lookups by company
CREATE INDEX IF NOT EXISTS idx_gst_registration_company_id
    ON public.gst_registration (company_id);

-- Index for active registrations by state
CREATE INDEX IF NOT EXISTS idx_gst_registration_active_state
    ON public.gst_registration (state_code, is_active) WHERE is_active = true;
