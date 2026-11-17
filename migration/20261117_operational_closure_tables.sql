-- Branch & Partner Holiday / Closure Scheduling tables.
-- Extracted from frontend/scripts/run_marketplace_migrations.js (section 3) so it can be
-- applied alone: DDL only, idempotent, no seed data.
BEGIN;

CREATE TABLE IF NOT EXISTS "operational_closure" (
  "id" text PRIMARY KEY,
  "entity_type" text NOT NULL CHECK (entity_type IN ('BRANCH', 'PARTNER', 'ORGANIZATION')),
  "entity_id" text NOT NULL,
  "start_date" date NOT NULL,
  "end_date" date NOT NULL,
  "is_full_day" boolean NOT NULL DEFAULT true,
  "opening_time" text NULL,
  "closing_time" text NULL,
  "closure_type" text NOT NULL CHECK (closure_type IN ('HOLIDAY', 'MAINTENANCE', 'PLANNED_CLOSURE', 'EMERGENCY')),
  "reason" text NOT NULL,
  "status" text NOT NULL CHECK (status IN ('SCHEDULED', 'ACTIVE', 'COMPLETED', 'CANCELLED')) DEFAULT 'SCHEDULED',
  "actor_id" text NOT NULL,
  "actor_role" text NOT NULL,
  "created_at" timestamptz NOT NULL DEFAULT NOW(),
  "updated_at" timestamptz NOT NULL DEFAULT NOW(),
  "deleted_at" timestamptz NULL,
  CONSTRAINT "chk_closure_date_order" CHECK (end_date >= start_date)
);

CREATE INDEX IF NOT EXISTS "idx_operational_closure_entity_dates"
  ON "operational_closure"(entity_type, entity_id, start_date, end_date);

CREATE TABLE IF NOT EXISTS "operational_closure_impact" (
  "id" text PRIMARY KEY,
  "closure_id" text NOT NULL REFERENCES "operational_closure"(id) ON DELETE CASCADE,
  "order_id" text NOT NULL,
  "order_delivery_date" date NOT NULL,
  "impact_status" text NOT NULL CHECK (impact_status IN ('PENDING_REVIEW', 'REASSIGNED', 'RESCHEDULED', 'CANCELLED_WITH_REFUND', 'OVERRIDDEN_FOR_FULFILLMENT')) DEFAULT 'PENDING_REVIEW',
  "resolution_note" text NULL,
  "resolved_by" text NULL,
  "resolved_at" timestamptz NULL,
  "created_at" timestamptz NOT NULL DEFAULT NOW(),
  CONSTRAINT "uq_closure_impact_order" UNIQUE (closure_id, order_id)
);

CREATE INDEX IF NOT EXISTS "idx_closure_impact_status"
  ON "operational_closure_impact"(impact_status);

COMMIT;
