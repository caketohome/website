# CakeToHome ERP — Phase C7.10 Step 10A Checkpoint: Schema, Constraints & Immutability Triggers

**Phase:** C7.10 — Map-Fenced Store & Delivery-Partner Coverage Configuration  
**Step:** 10A — Relational Schema, Foreign Keys, Check Constraints & Immutability Trigger  
**Status:** ✅ 100% VERIFIED & AUDITED  
**Date:** October 13, 2026  
**Execution Environment:** Supabase PostgreSQL Pooler (`aws-1-ap-south-1.pooler.supabase.com:6543/postgres`)  

---

## 1. Migration Scope & DDL Changes
The migration script [`c7_10_coverage_configuration.sql`](file:///E:/vig/cakes2home-main/cakes2home-main/frontend/src/lib/migrations/c7_10_coverage_configuration.sql) was executed within a single ACID transaction. All DDL operations were additive, non-blocking, and backwards-compatible:

1. **`public.branch.is_corporate_routing_eligible` (BOOLEAN NOT NULL DEFAULT false):**
   - Established the corporate routing eligibility allow-list.
   - All 53 existing branches default to `false`. No test fixture branches can accidentally participate in corporate delivery routing without explicit administrator verification.
2. **`public.delivery_zone.exclusion_polygons` (JSONB DEFAULT NULL):**
   - Added persistent relational storage for restricted polygon sub-zones on delivery zones.
3. **`public.delivery_partner_profile`:**
   - Table created with foreign key `partner_id REFERENCES public.delivery_partner(id) ON DELETE RESTRICT`.
   - Fields: `partner_type` (`OWN_FLEET`, `COURIER`, `3PL_AGGREGATOR`), `status` (`ACTIVE`, `INACTIVE`, `SUSPENDED`), `primary_branch_id REFERENCES branch(id)`, `max_concurrent_orders`, `rating`, `contract_reference`, `metadata`, `created_at`, `updated_at`.
   - Constraints: `chk_dp_profile_status`, `chk_dp_profile_type`, `chk_dp_profile_capacity` ($1 \le \text{orders} \le 50$), unique index on `partner_id`.
4. **`public.delivery_partner_coverage`:**
   - Table created linking delivery partners to branches with explicit geometric service areas.
   - Fields: `partner_id`, `branch_id`, `fence_type` (`POLYGON`, `RADIUS`, `HYBRID`), `polygon_coordinates jsonb`, `radius_km numeric(6,2)`, `center_latitude numeric(10,7)`, `center_longitude numeric(10,7)`, `priority integer`, `is_active boolean`, `metadata`, `created_at`, `updated_at`.
   - Constraints: `chk_dp_coverage_fence`, `chk_dp_coverage_priority` ($1 \le \text{priority} \le 100$), `chk_dp_coverage_radius` ($\le 25.0\text{km}$).
5. **`public.delivery_coverage_event` (Immutable Audit Trail):**
   - Table created to record every polygon addition, exclusion update, radius adjustment, partner assignment, and eligibility toggle.
   - Fields: `entity_type`, `entity_id`, `event_type`, `actor_id`, `actor_role`, `reason`, `before_state`, `after_state`, `created_at`.
   - Constraints: `chk_coverage_event_type`.
6. **Immutability Trigger:**
   - `trg_delivery_coverage_event_immutability` (BEFORE UPDATE OR DELETE) attached to `delivery_coverage_event`. Raises exception `27000` on any modification or deletion attempt.

---

## 2. Empirical Verification Evidence
The independent migration runner [`run_c7_10_step10a_migration.js`](file:///E:/vig/cakes2home-main/cakes2home-main/frontend/scratch/run_c7_10_step10a_migration.js) confirmed:

| Check | Expected | Actual | Status |
|---|---|---|---|
| `branch.is_corporate_routing_eligible` | boolean, default `false` | boolean, default `false` | ✅ PASS |
| `delivery_zone.exclusion_polygons` | jsonb | jsonb | ✅ PASS |
| New Tables Created | 3 tables | `delivery_coverage_event`, `delivery_partner_coverage`, `delivery_partner_profile` | ✅ PASS |
| Immutability Trigger UPDATE Block | Exception `27000` | Blocked: `delivery_coverage_event is append-only` | ✅ PASS |
| Immutability Trigger DELETE Block | Exception `27000` | Blocked: `delivery_coverage_event is append-only` | ✅ PASS |
| Chart of Accounts Baseline | 100 accounts | 100 accounts | ✅ PASS |
| Accounting Vouchers | 6 vouchers | 6 vouchers | ✅ PASS |
| Journal Entries | 4 entries | 4 entries | ✅ PASS |
| Journal Lines | 10 lines | 10 lines | ✅ PASS |
| General Ledger Trial Balance | Dr ₹3,380.00 = Cr ₹3,380.00 | Dr ₹3,380.00 = Cr ₹3,380.00 (Balanced) | ✅ PASS |
| Delivery Partners Count | 30 rows preserved | 30 rows preserved | ✅ PASS |

---

## 3. Boundary & Next Step
Step 10A is complete. Next is **Step 10B: Domain Repositories & Coverage Services (Clean Architecture & Fail-Closed Logic)**.
