-- ============================================================================
-- CakeToHome ERP — Phase C7.11 Step 11A Migration: Geographic Assignment Schema
-- Table: public.corporate_delivery_assignment & public.corporate_assignment_event
-- ============================================================================

BEGIN;

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

COMMIT;
