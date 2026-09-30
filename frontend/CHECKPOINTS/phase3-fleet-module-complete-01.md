# CakeToHome ERP — Phase 3: Fleet / Delivery Cost Module Complete

**Date**: 2026-09-23T16:05:00+05:30  
**Branch**: task/dev  
**HEAD**: f7d9a47 (no new git commits — changes uncommitted as per project instructions)

---

## Executive Summary

Phase 3 (Fleet / Delivery Cost Module) is fully implemented, verified, and reconciled.

- Forensic inspection was completed before creating any schema.
- Existing delivery infrastructure (`delivery`, `delivery_partner`, `delivery_delivery_partner`) and `FLEET.*` permissions were reused rather than duplicated.
- 3 new database tables (`vehicle`, `vehicle_trip`, `fleet_fuel`) and 1 additive column (`driver_profile.branch_id`) were migrated with zero destructive changes.
- Manual odometer distance derivation (`distance_km = end_odometer - start_odometer`) is strictly enforced on both DB and service layers.
- 9 database-backed fleet reports were implemented without fabricated metrics (missing timestamps and data return `null` / `—`).
- No accounting journal entries (Phase 4).
- No cake inventory interactions.
- TypeScript check (`npx tsc --noEmit`): **EXIT 0**.
- Next.js Production Build (`npm run build`): **EXIT 0** (34 pages compiled, `/dashboard/shop/fleet` generated).

---

## 1. Forensic Inspection & Architecture Decisions

| Entity / Asset | Live DB / Code State | Decision | Rationale |
|---|---|---|---|
| `delivery` table | 57 rows in DB | **REUSED** | Canonical delivery record; linked via `delivery_id` in trips and reports |
| `delivery_partner` table | 30 rows in DB | **REUSED** | Canonical driver identity (first name, last name, phone, email) |
| `delivery_delivery_partner` | 5 rows in DB | **REUSED** | Delivery-to-driver assignment junction |
| `driver_profile` table | 0 rows in DB | **EXTENDED** | Added `branch_id TEXT REFERENCES branch(id)` as a nullable column |
| `driver_attendance` table | 0 rows in DB | **PRESERVED** | Shift check-in/out; out of scope for manual vehicle odometer & fuel costs |
| `driver_location` table | 0 rows in DB | **PRESERVED** | Real-time GPS stream; out of scope for manual odometer cost tracking |
| `expense` table (Phase 2) | 0 rows in DB | **REUSED** | `fleet_fuel.expense_id` provides optional linkage for cost consolidation |
| `expense_category` (Phase 2)| 11 rows in DB | **REUSED** | "Fuel & Transport" category pre-seeded in Phase 2 |
| `DeliveryService.calculateDistanceKm` | Exists in codebase | **PRESERVED** | Preserved as single Haversine authority; not duplicated |
| `FLEET.VIEW/MANAGE/EXPORT` | Lines 195-197 in `staff-access-control.ts` | **REUSED** | Catalog already contained full permission set |

---

## 2. Database Changes (Additive & Idempotent)

```sql
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
  CONSTRAINT vehicle_type_check CHECK (vehicle_type = ANY(ARRAY['BIKE','SCOOTER','VAN','TRUCK','OTHER'])),
  CONSTRAINT vehicle_ownership_check CHECK (ownership_type = ANY(ARRAY['OWN','LEASED','RENTAL']))
);

-- 3. Vehicle Trip (Manual Odometer Logs)
CREATE TABLE IF NOT EXISTS public.vehicle_trip (
  id                TEXT         NOT NULL PRIMARY KEY,
  branch_id         TEXT         NOT NULL REFERENCES public.branch(id) ON DELETE RESTRICT,
  vehicle_id        TEXT         NOT NULL REFERENCES public.vehicle(id) ON DELETE RESTRICT,
  driver_partner_id TEXT         REFERENCES public.delivery_partner(id) ON DELETE SET NULL,
  delivery_id       TEXT         REFERENCES public.delivery(id) ON DELETE SET NULL,
  trip_date         DATE         NOT NULL DEFAULT CURRENT_DATE,
  start_odometer    NUMERIC(10,1) NOT NULL,
  end_odometer      NUMERIC(10,1),
  distance_km       NUMERIC(10,2),
  purpose           TEXT         NOT NULL DEFAULT 'DELIVERY',
  notes             TEXT,
  created_by        TEXT,
  created_at        TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  CONSTRAINT trip_odometer_check CHECK (end_odometer IS NULL OR end_odometer >= start_odometer),
  CONSTRAINT trip_distance_check CHECK (distance_km IS NULL OR distance_km >= 0),
  CONSTRAINT trip_purpose_check CHECK (purpose = ANY(ARRAY['DELIVERY','PICKUP','MAINTENANCE','OTHER']))
);

-- 4. Fleet Fuel Fill-Up Records
CREATE TABLE IF NOT EXISTS public.fleet_fuel (
  id                TEXT          NOT NULL PRIMARY KEY,
  branch_id         TEXT          NOT NULL REFERENCES public.branch(id) ON DELETE RESTRICT,
  vehicle_id        TEXT          NOT NULL REFERENCES public.vehicle(id) ON DELETE RESTRICT,
  driver_partner_id TEXT          REFERENCES public.delivery_partner(id) ON DELETE SET NULL,
  expense_id        TEXT          REFERENCES public.expense(id) ON DELETE SET NULL,
  fuel_date         DATE          NOT NULL DEFAULT CURRENT_DATE,
  quantity_litres   NUMERIC(10,2) NOT NULL,
  rate_per_litre    NUMERIC(10,2) NOT NULL,
  fuel_amount       NUMERIC(14,2) NOT NULL,
  odometer_at_fill  NUMERIC(10,1),
  fuel_station      TEXT,
  invoice_no        TEXT,
  notes             TEXT,
  created_by        TEXT,
  created_at        TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  deleted_at        TIMESTAMPTZ,
  CONSTRAINT fuel_positive_qty CHECK (quantity_litres > 0),
  CONSTRAINT fuel_positive_rate CHECK (rate_per_litre > 0),
  CONSTRAINT fuel_positive_amount CHECK (fuel_amount > 0)
);

-- 13 Indexes:
idx_vehicle_branch_id, idx_vehicle_active, vehicle_reg_branch_unique, vehicle_pkey,
idx_trip_branch_id, idx_trip_vehicle_id, idx_trip_driver_partner_id, idx_trip_trip_date, vehicle_trip_pkey,
idx_fuel_branch_id, idx_fuel_vehicle_id, idx_fuel_date, fleet_fuel_pkey
```

---

## 3. Files Created & Modified

### Created Files (8)
| Layer | Path | Description |
|---|---|---|
| Migration | `frontend/migrate_phase3_fleet.js` | DDL migration script with idempotent checks |
| Types | `src/lib/types/fleet.types.ts` | Complete DTOs, Enums, Filter interfaces, Report rows |
| Repository | `src/lib/repositories/vehicle.repository.ts` | Branch-scoped Vehicle CRUD, registration uniqueness guard |
| Repository | `src/lib/repositories/vehicle-trip.repository.ts` | Trip CRUD, odometer validation, distance derivation |
| Repository | `src/lib/repositories/fleet-fuel.repository.ts` | Fuel CRUD, rate×qty amount verification, soft delete |
| Repository | `src/lib/repositories/fleet-report.repository.ts` | 9 database-backed reports with factual aggregations |
| Service | `src/lib/services/fleet.service.ts` | Branch isolation enforcement, session resolution, reports wrapper |
| UI Component | `src/components/dashboard/admin/fleet-panel.tsx` | Full admin management UI, modals, tables, reports viewer |
| Page Route | `src/app/dashboard/shop/fleet/page.tsx` | Standalone page route at `/dashboard/shop/fleet` |

### Modified Files (6)
| File | Changes Made |
|---|---|
| `src/lib/repositories/index.ts` | Exported `vehicle.repository`, `vehicle-trip.repository`, `fleet-fuel.repository`, `fleet-report.repository` |
| `src/lib/services/index.ts` | Exported `fleet.service` |
| `src/app/api/v1/[...path]/route.ts` | Added `FleetService` import; added 25 fleet endpoints across GET, POST, PUT, DELETE with branch isolation |
| `src/lib/staff-access-control.ts` | Added `fleet: { module: "FLEET", action: "VIEW" }` to `TAB_PERMISSION_MAP` |
| `src/components/dashboard/admin/admin-tabs.tsx` | Added `fleet` tab with `Truck` icon |
| `src/app/dashboard/page.tsx` | Added `FleetPanel` dynamic loader, updated `AdminTabId` union, added `fleet: FleetPanel` to `PANEL_MAP` |

---

## 4. API Endpoints Catalog (25 Routes)

| Method | Endpoint | Permission | Description |
|---|---|---|---|
| `GET` | `admin/fleet/vehicles` | `FLEET.VIEW` | List branch vehicles with filters (type, active, search) |
| `GET` | `admin/fleet/vehicles/:id` | `FLEET.VIEW` | Get single vehicle details (branch-isolated) |
| `POST` | `admin/fleet/vehicles` | `FLEET.MANAGE` | Register a new vehicle in session branch |
| `PUT` | `admin/fleet/vehicles/:id` | `FLEET.MANAGE` | Update vehicle info (branch-isolated) |
| `DELETE` | `admin/fleet/vehicles/:id` | `FLEET.MANAGE` | Soft-delete vehicle (blocks if open trips exist) |
| `GET` | `admin/fleet/trips` | `FLEET.VIEW` | List trips with filters (vehicle, driver, dates, purpose) |
| `GET` | `admin/fleet/trips/:id` | `FLEET.VIEW` | Get single trip details |
| `POST` | `admin/fleet/trips` | `FLEET.MANAGE` | Create trip / start odometer log |
| `PUT` | `admin/fleet/trips/:id` | `FLEET.MANAGE` | Record end odometer (derives distance_km) |
| `GET` | `admin/fleet/fuel` | `FLEET.VIEW` | List fuel fill-ups with filters |
| `GET` | `admin/fleet/fuel/:id` | `FLEET.VIEW` | Get single fuel record |
| `POST` | `admin/fleet/fuel` | `FLEET.MANAGE` | Record fuel fill-up (server validates qty × rate ≈ amount) |
| `PUT` | `admin/fleet/fuel/:id` | `FLEET.MANAGE` | Update fuel entry |
| `DELETE` | `admin/fleet/fuel/:id` | `FLEET.MANAGE` | Soft-delete fuel record |
| `GET` | `admin/fleet/drivers` | `FLEET.VIEW` | Read-only delivery partner list with delivery count |
| `GET` | `admin/fleet/reports/delivery` | `FLEET.VIEW` / `EXPORT` | Report 1: Delivery status, partner, timing |
| `GET` | `admin/fleet/reports/driver` | `FLEET.VIEW` / `EXPORT` | Report 2: Assigned, completed, failed per driver |
| `GET` | `admin/fleet/reports/vehicle` | `FLEET.VIEW` / `EXPORT` | Report 3: Trips, km, fuel aggregated per vehicle |
| `GET` | `admin/fleet/reports/km` | `FLEET.VIEW` / `EXPORT` | Report 4: Daily/period KM log by vehicle/driver |
| `GET` | `admin/fleet/reports/fuel` | `FLEET.VIEW` / `EXPORT` | Report 5: Fill-up register and total cost |
| `GET` | `admin/fleet/reports/fuel-efficiency` | `FLEET.VIEW` / `EXPORT` | Report 6: KM per Litre (returns null when data missing) |
| `GET` | `admin/fleet/reports/cost-per-km` | `FLEET.VIEW` / `EXPORT` | Report 7: Fuel cost per KM (returns null when missing) |
| `GET` | `admin/fleet/reports/driver-performance` | `FLEET.VIEW` / `EXPORT` | Report 8: Factual counts and KM only (no fake ratings) |
| `GET` | `admin/fleet/reports/delivery-exceptions` | `FLEET.VIEW` / `EXPORT` | Report 9: Failed, cancelled, unassigned deliveries |

---

## 5. Design Invariants Verified

1. **Manual Odometer Integrity**: Client cannot forge `distance_km`. The distance is derived exclusively via `end_odometer - start_odometer`. DB check constraints reject `end_odometer < start_odometer`.
2. **Zero Fabricated Metrics**: When timestamps or fuel data are missing, values return `null` (rendered as `—` in UI). No synthetic ratings, fabricated delivery durations, or estimated speed calculations.
3. **Session-Enforced Branch Isolation**: Branch ID is resolved strictly from `resolveUserContext(req).branchId` for branch managers. Non-super-admins cannot read or write vehicles, trips, or fuel across branch boundaries.
4. **Fuel Amount Validation**: `quantity_litres × rate_per_litre` must match `fuel_amount` within ±₹0.50 margin of error.
5. **No Accounting Entries**: No journal vouchers, accounts, or ledger entries created (Phase 4 scope).
6. **No Cake Inventory Impact**: Fleet operations do not modify cake SKU stocks or store quantities.
7. **Existing Infrastructure Preserved**: `delivery` (57 rows), `delivery_partner` (30 rows), and `delivery_delivery_partner` (5 rows) intact.

---

## 6. Verification Results

| Test / Check | Command / Query | Status | Details |
|---|---|---|---|
| Database DDL | `node migrate_phase3_fleet.js` | **PASS (EXIT 0)** | 3 tables created, 1 column added, 13 indexes |
| Live DB Verification | `verify_phase3_db.js` | **PASS (EXIT 0)** | Roundtrip transactional test: vehicle -> trip -> fuel -> efficiency -> cost/km -> rollback |
| Type Checking | `npx tsc --noEmit --skipLibCheck` | **PASS (EXIT 0)** | 0 TypeScript errors across frontend codebase |
| Production Build | `npm run build` | **PASS (EXIT 0)** | 34 static and dynamic routes compiled cleanly |

---

## Status Summary

- **Phase 0 — Reporting Cleanup**: COMPLETE ✅
- **Phase 1 — Supplier + Purchase**: COMPLETE ✅ (Audited & Branch isolation verified)
- **Phase 2 — Expense Module**: COMPLETE ✅ (Reconciled & Built)
- **Phase 3 — Fleet / Delivery Cost**: COMPLETE ✅ (Migrated, Implemented, Tested, TSC 0, Build 0)
- **Phase 4 — Accounting Foundations**: READY TO START (Next Phase)
