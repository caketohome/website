-- ============================================================================
-- CakeToHome ERP — Phase C7.10 Migration: Map-Fenced Coverage Configuration
-- Schema: Store Eligibility, Zone Exclusions, Partner Profile & Coverage Fences
-- ============================================================================

BEGIN;

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

COMMIT;
