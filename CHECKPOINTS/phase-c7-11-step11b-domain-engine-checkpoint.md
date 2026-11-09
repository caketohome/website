# Checkpoint: Phase C7.11 — Step 11B: Corporate Routing Domain Geographic Matching Engine

**Phase:** C7.11 Corporate Delivery Geographic Matching and Routing  
**Step:** 11B — Domain Geographic Matching Engine & Repository Support  
**Date:** 2026-10-13  
**Status:** COMPLETE & VERIFIED (STOP APPLIED AT STEP 11B BOUNDARY)

---

## 1. Scope & Execution Boundary

Step 11B was explicitly authorized to implement and verify ONLY the Domain Geographic Matching Engine and its repository support for corporate delivery assignments.
- **Authorized in Step 11B**:
  - `CorporateRoutingRepository`: parameterized PostgreSQL queries, `PoolClient` transaction passthrough, atomic assignment upserts on `(entity_type, entity_id)` unique constraint, candidate store/partner catalog queries, append-only audit event logging.
  - `CorporateRoutingService`: pure geometry reuse from `DeliveryCoverageService` (point-in-polygon raycasting, Haversine distance), fail-closed coordinate verification, exclusion precedence, deterministic store & delivery partner selection with documented tie-breakers, idempotent assignment evaluation, batch matching pipeline.
  - Test suite `frontend/scratch/test_phase_c7_11_step11b_engine.js` covering 10 core scenarios + edge cases.
- **Strictly NOT Authorized / NOT Executed**:
  - Step 11C APIs and controllers.
  - Step 11D final audit.
  - Phases C7.12–C7.16.
  - Production routing activation or deployment.
  - Git commits, pushes, merges, rebases, stashes, resets, or branch switching.

---

## 2. Source Files Added & Modified

| File | Type | Changes / Purpose |
|---|---|---|
| `frontend/src/lib/repositories/corporate-routing.repository.ts` | Source (New) | Repository layer handling atomic assignment upserts, entity queries, candidate store/partner catalog queries with JSONB geometry, and append-only audit event insertions. |
| `frontend/src/lib/repositories/index.ts` | Source (Modified) | Re-exports `CorporateRoutingRepository` and associated types. |
| `frontend/src/lib/services/corporate-routing.service.ts` | Source (New) | Domain matching engine implementing fail-closed coordinate checks, exclusion precedence, polygon > radius priority, partner selection tie-breaking, idempotency checks, and `matchDeliveriesBatch`. |
| `frontend/src/lib/services/index.ts` | Source (Modified) | Re-exports `CorporateRoutingService` and match outcome interfaces. |
| `frontend/scratch/test_phase_c7_11_step11b_engine.js` | Test Suite (New) | Comprehensive 45-assertion test suite validating all 10 core scenarios, edge cases, trigger defenses, and PostgreSQL invariants. |

---

## 3. Domain Matching Rules & Deterministic Precedence

The engine operates with 100% deterministic rules, zero fallback guessing, and complete independence from B2C retail routing defaults:

### 3.1 Coordinate Verification
- `null`, `undefined`, missing coordinates $\to$ `UNASSIGNED / COORDINATES_MISSING`.
- `NaN`, $\pm\infty$, latitude outside $[-90..90]$, longitude outside $[-180..180]$, or unverified sentinel coordinates $\to$ `UNASSIGNED / COORDINATES_INVALID`.
- Sanitize coordinates for `chk_cda_coordinates` check constraint: invalid coordinates are nulled in database numeric columns while preserved in `evaluation_metadata`.

### 3.2 Exclusion Precedence
- Active exclusion polygons take strict priority over positive coverage.
- If a delivery coordinate falls inside any applicable exclusion polygon, the engine immediately yields `UNASSIGNED / INSIDE_EXCLUSION`.

### 3.3 Store Eligibility & Selection Precedence
1. **Corporate Eligibility Guard**: Store must have persisted `is_corporate_routing_eligible = true`. Ineligible stores covering the coordinate yield `UNASSIGNED / STORE_NOT_ELIGIBLE`.
2. **Match Class**: `POLYGON` strictly beats circle `RADIUS`.
3. **Store Priority**: Higher configured `zone_priority` integer wins (`DESC`).
4. **Distance**: Shorter spherical Haversine distance to store centroid wins (`ASC`).
5. **Stable Tie-Breaker**: Lexicographical `store_id ASC`.

### 3.4 Delivery Partner Eligibility & Selection Precedence
1. **Partner Active Guard**: Must have active profile (`status = 'ACTIVE'`) and active coverage on the winning store. Zero active partners $\to$ `UNASSIGNED / NO_ELIGIBLE_PARTNER`.
2. **Partner Priority**: Higher configured `priority` integer wins (`DESC`).
3. **Fleet Type Tie-Breaker**: `OWN_FLEET` (Rank 1) > `COURIER` (Rank 2) > `3PL_AGGREGATOR` (Rank 3).
4. **Rating**: Higher partner rating wins (`DESC`).
5. **Stable Tie-Breaker**: Lexicographical `partner_id ASC`.

### 3.5 Idempotency & Immutability
- Repeat runs with unchanged outcomes emit **0 duplicate audit events** and produce no assignment row churn.
- Real assignment state changes atomically append 1 event to `corporate_assignment_event`.
- The PostgreSQL trigger `trg_corporate_assignment_event_immutability` blocks any `UPDATE` or `DELETE` attempt with SQLSTATE `27000`.

---

## 4. Verification & Test Evidence

### 4.1 TypeScript Static Analysis
- **Command**: `npx tsc --noEmit`
- **Working Directory**: `frontend`
- **Result**: Exit code `0`, 0 errors.

### 4.2 Step 11B Domain Engine Suite (`test_phase_c7_11_step11b_engine.js`)
- **Total Assertions**: 45
- **Passed**: 45
- **Failed**: 0

| Scenario / Check | Assertion Count | Result |
|---|---|---|
| Preflight Database Invariants | 6 checks | ✅ PASS |
| Scenario 1: Missing coordinates $\to$ `UNASSIGNED / COORDINATES_MISSING` | 3 checks | ✅ PASS |
| Scenario 2: Invalid coordinates $\to$ `UNASSIGNED / COORDINATES_INVALID` | 2 checks | ✅ PASS |
| Scenario 3: Point inside exclusion polygon $\to$ `UNASSIGNED / INSIDE_EXCLUSION` | 3 checks | ✅ PASS |
| Scenario 4: Point outside all eligible coverage $\to$ `UNASSIGNED / OUTSIDE_COVERAGE` | 2 checks | ✅ PASS |
| Scenario 5: Ineligible store coverage $\to$ `UNASSIGNED / STORE_NOT_ELIGIBLE` | 3 checks | ✅ PASS |
| Scenario 6: Store match with no active partner $\to$ `UNASSIGNED / NO_ELIGIBLE_PARTNER` | 3 checks | ✅ PASS |
| Scenario 7: Polygon match strictly beats circle radius-only match | 3 checks | ✅ PASS |
| Scenario 8: Store priority, distance, and stable tie-breaker determinism | 2 checks | ✅ PASS |
| Scenario 9: Partner priority, fleet tie-breaker (`OWN_FLEET` > `COURIER`), and rating | 2 checks | ✅ PASS |
| Scenario 10: Repeat-run idempotency & trigger immutability defense (SQLSTATE 27000) | 4 checks | ✅ PASS |
| Edge Case: Unique constraint defense on `(entity_type, entity_id)` | 1 check | ✅ PASS |
| Edge Case: Check constraint `chk_cda_reason_code` rejects invalid codes | 1 check | ✅ PASS |
| Edge Case: Coordinate on polygon boundary evaluates deterministically | 1 check | ✅ PASS |
| Edge Case: Atomic rollback leaves 0 assignments on audit insert failure | 1 check | ✅ PASS |
| Postflight Database Invariants & Residual Cleanup | 8 checks | ✅ PASS |

### 4.3 Regression Test Suites
- **Step 10B Domain & Geometry Suite**: `node scratch/test_phase_c7_10_step10b_domain.js` $\to$ **27/27 PASSED** (0 failed).
- **Step 10C API Regression Suite**: `node scratch/test_phase_c7_10_step10c_api.js` $\to$ **20/20 PASSED** (0 failed, clean postflight teardown).
- Lingering background process PID 16596 confirmed and safely terminated via task cancellation.

---

## 5. Authoritative Database Invariants Baseline

Independent PostgreSQL catalog queries confirm the master financial and entity baseline is 100% intact:

| Invariant Item | Target Baseline | Live Database Value | Status |
|---|---|---|---|
| Chart of Accounts (`accounting_account`) | 100 | 100 | ✅ INTACT |
| Accounting Vouchers (`accounting_voucher`) | 6 | 6 | ✅ INTACT |
| Journal Entries (`accounting_journal_entry`) | 4 | 4 | ✅ INTACT |
| Journal Lines (`accounting_journal_line`) | 10 | 10 | ✅ INTACT |
| Trial Balance Dr Total | ₹3,380.00 | ₹3,380.00 | ✅ INTACT |
| Trial Balance Cr Total | ₹3,380.00 | ₹3,380.00 | ✅ INTACT |
| Active Delivery Partners (`delivery_partner`) | 30 | 30 | ✅ INTACT |
| Active Branches (`branch`) | 53 | 53 | ✅ INTACT |
| Residual Test Assignments | 0 | 0 | ✅ CLEAN |
| Residual Test Audit Events | 0 | 0 | ✅ CLEAN |

---

## 6. Known Limitations & Open Items

1. **No External Geocoding**: The engine requires valid GPS coordinates on the input. Geocoding addresses or PIN codes is deliberately prohibited in Step 11B per specification.
2. **Step 11C Pending**: The Next.js API endpoints (`POST /api/v1/corporate-routing/match-batch`, `GET /assignments`, manual override APIs) remain unimplemented and require authorization for Step 11C.

---

## 7. Mandatory Stop Confirmation

- Step 11B is complete and verified.
- Work is strictly stopped at the Step 11B boundary.
- Zero Git commits or branch switches performed.
- Step 11C remains unauthorized.
