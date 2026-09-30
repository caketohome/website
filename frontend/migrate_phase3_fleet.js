/**
 * CakeToHome ERP — Phase 3: Fleet / Delivery Cost DB Migration
 *
 * New tables:
 *   vehicle        — canonical vehicle entity (branch-scoped)
 *   vehicle_trip   — manual odometer trip records
 *   fleet_fuel     — fuel fill-up records (optional FK to expense)
 *
 * Column addition:
 *   driver_profile.branch_id  (nullable, additive, 0 existing rows)
 *
 * Existing tables/data are NOT modified or dropped.
 * All DDL is idempotent (IF NOT EXISTS / IF NOT EXISTS / ON CONFLICT DO NOTHING).
 */

const { Client } = require('./node_modules/pg');
const c = new Client({ connectionString: process.env.PG_URL, ssl: { rejectUnauthorized: false } });

const migration = `
-- ─────────────────────────────────────────────────────────────────────────────
-- Phase 3: Fleet / Delivery Cost Module
-- ─────────────────────────────────────────────────────────────────────────────

-- 1. Extend driver_profile with branch_id (additive, nullable)
ALTER TABLE public.driver_profile
  ADD COLUMN IF NOT EXISTS branch_id TEXT REFERENCES public.branch(id) ON DELETE SET NULL;

-- 2. Canonical Vehicle Entity
CREATE TABLE IF NOT EXISTS public.vehicle (
  id               TEXT         NOT NULL PRIMARY KEY,
  branch_id        TEXT         NOT NULL REFERENCES public.branch(id) ON DELETE RESTRICT,
  registration_no  TEXT         NOT NULL,
  vehicle_type     TEXT         NOT NULL DEFAULT 'BIKE',
  make_model       TEXT,
  year             INTEGER,
  is_active        BOOLEAN      NOT NULL DEFAULT TRUE,
  current_odometer NUMERIC(10,1) NOT NULL DEFAULT 0,
  ownership_type   TEXT         NOT NULL DEFAULT 'OWN',
  notes            TEXT,
  created_by       TEXT,
  created_at       TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  deleted_at       TIMESTAMPTZ,
  CONSTRAINT vehicle_reg_branch_unique UNIQUE (registration_no, branch_id),
  CONSTRAINT vehicle_type_check CHECK (
    vehicle_type = ANY(ARRAY['BIKE','SCOOTER','VAN','TRUCK','OTHER'])
  ),
  CONSTRAINT vehicle_ownership_check CHECK (
    ownership_type = ANY(ARRAY['OWN','LEASED','RENTAL'])
  ),
  CONSTRAINT vehicle_odometer_non_negative CHECK (current_odometer >= 0)
);

CREATE INDEX IF NOT EXISTS idx_vehicle_branch_id
  ON public.vehicle (branch_id) WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_vehicle_active
  ON public.vehicle (branch_id, is_active) WHERE deleted_at IS NULL;

-- 3. Vehicle Trip / Manual Odometer
CREATE TABLE IF NOT EXISTS public.vehicle_trip (
  id                TEXT          NOT NULL PRIMARY KEY,
  branch_id         TEXT          NOT NULL REFERENCES public.branch(id) ON DELETE RESTRICT,
  vehicle_id        TEXT          NOT NULL REFERENCES public.vehicle(id) ON DELETE RESTRICT,
  driver_partner_id TEXT          REFERENCES public.delivery_partner(id) ON DELETE SET NULL,
  delivery_id       TEXT          REFERENCES public.delivery(id) ON DELETE SET NULL,
  trip_date         DATE          NOT NULL,
  start_odometer    NUMERIC(10,1) NOT NULL,
  end_odometer      NUMERIC(10,1),
  distance_km       NUMERIC(8,2),
  purpose           TEXT          NOT NULL DEFAULT 'DELIVERY',
  notes             TEXT,
  created_by        TEXT,
  created_at        TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  CONSTRAINT trip_odometer_check CHECK (
    end_odometer IS NULL OR end_odometer >= start_odometer
  ),
  CONSTRAINT trip_distance_check CHECK (
    distance_km IS NULL OR distance_km >= 0
  ),
  CONSTRAINT trip_purpose_check CHECK (
    purpose = ANY(ARRAY['DELIVERY','PICKUP','MAINTENANCE','OTHER'])
  )
);

CREATE INDEX IF NOT EXISTS idx_trip_branch_id
  ON public.vehicle_trip (branch_id);

CREATE INDEX IF NOT EXISTS idx_trip_vehicle_id
  ON public.vehicle_trip (vehicle_id);

CREATE INDEX IF NOT EXISTS idx_trip_driver_partner_id
  ON public.vehicle_trip (driver_partner_id) WHERE driver_partner_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_trip_trip_date
  ON public.vehicle_trip (trip_date);

-- 4. Fleet Fuel Records
CREATE TABLE IF NOT EXISTS public.fleet_fuel (
  id                TEXT          NOT NULL PRIMARY KEY,
  branch_id         TEXT          NOT NULL REFERENCES public.branch(id) ON DELETE RESTRICT,
  vehicle_id        TEXT          NOT NULL REFERENCES public.vehicle(id) ON DELETE RESTRICT,
  driver_partner_id TEXT          REFERENCES public.delivery_partner(id) ON DELETE SET NULL,
  expense_id        TEXT          REFERENCES public.expense(id) ON DELETE SET NULL,
  fuel_date         DATE          NOT NULL,
  quantity_litres   NUMERIC(8,2)  NOT NULL,
  rate_per_litre    NUMERIC(8,2)  NOT NULL,
  fuel_amount       NUMERIC(14,2) NOT NULL,
  odometer_at_fill  NUMERIC(10,1),
  fuel_station      TEXT,
  invoice_no        TEXT,
  notes             TEXT,
  created_by        TEXT,
  created_at        TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  deleted_at        TIMESTAMPTZ,
  CONSTRAINT fuel_quantity_positive CHECK (quantity_litres > 0),
  CONSTRAINT fuel_rate_positive CHECK (rate_per_litre > 0),
  CONSTRAINT fuel_amount_positive CHECK (fuel_amount > 0)
);

CREATE INDEX IF NOT EXISTS idx_fuel_branch_id
  ON public.fleet_fuel (branch_id) WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_fuel_vehicle_id
  ON public.fleet_fuel (vehicle_id) WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_fuel_date
  ON public.fleet_fuel (fuel_date) WHERE deleted_at IS NULL;
`;

c.connect().then(async () => {
  try {
    console.log('Running Phase 3 fleet migration...');
    await c.query(migration);
    console.log('Migration SQL complete.');

    // Verify vehicle table
    const veh = await c.query(
      "SELECT table_name FROM information_schema.tables WHERE table_schema='public' AND table_name IN ('vehicle','vehicle_trip','fleet_fuel') ORDER BY table_name"
    );
    console.log('Tables created:', veh.rows.map(r => r.table_name).join(', '));

    // Verify driver_profile.branch_id
    const col = await c.query(
      "SELECT column_name, data_type FROM information_schema.columns WHERE table_schema='public' AND table_name='driver_profile' AND column_name='branch_id'"
    );
    console.log('driver_profile.branch_id:', col.rows.length > 0 ? 'ADDED' : 'MISSING');

    // Verify indexes
    const idx = await c.query(
      "SELECT indexname FROM pg_indexes WHERE schemaname='public' AND tablename IN ('vehicle','vehicle_trip','fleet_fuel') ORDER BY indexname"
    );
    console.log('Indexes:', idx.rows.length);
    idx.rows.forEach(r => console.log(' ', r.indexname));

    // Verify existing data untouched
    const del = await c.query("SELECT COUNT(*) FROM public.delivery");
    const dp = await c.query("SELECT COUNT(*) FROM public.delivery_partner");
    const ae = await c.query("SELECT COUNT(*) FROM public.analytics_expense");
    console.log('delivery rows (must be 57):', del.rows[0].count);
    console.log('delivery_partner rows (must be 30):', dp.rows[0].count);
    console.log('analytics_expense rows (must be 0):', ae.rows[0].count);

    await c.end();
    process.exit(0);
  } catch (e) {
    console.error('Migration error:', e.message);
    await c.end();
    process.exit(1);
  }
}).catch(e => { console.error('Connect error:', e.message); process.exit(1); });
