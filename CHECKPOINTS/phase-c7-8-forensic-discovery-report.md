# CakeToHome ERP — Phase C7.8 Forensic Discovery Report
## Corporate Company Management, Employee Rosters & Map-Fenced Delivery Routing

> [!WARNING]
> **ERRATA (2026-10-11) — superseded in part by [`phase-c7-9-design-lock-and-acceptance-checklist.md`](phase-c7-9-design-lock-and-acceptance-checklist.md).**
> Corrections found in review (details and evidence in the lock §1): **R1** is understated (all of Phases A–C, C5, C6, C7.1–C7.7 are uncommitted, not only C7.7);
> **R9** is wrong ("53 identical coordinates" → 25/53 share one point); **R4** — 25 zones are radius-only, 12 polygon+radius, 7 PIN-only (the 7 orphans);
> **O4** is superseded (credit activation = Super Admin only; existing `approveCorporateCredit` path was missed); **O5** is overruled (no cleanup without classification and a reversible plan);
> **O6** — no default store/partner precedence; **ID convention** is `<prefix>_<uuid>` not `prefix_ULID`; `employee_ref_id` moves to **C7.13**;
> `res_01KXYMAHGF…` is a legacy Indiranagar alias used by ≥20 tests, not garbage. Treat the lock document as authoritative where they differ.

**Mode:** READ-ONLY. No source, schema, data or permissions were modified. Only scratch inspectors were added
(`scratch/forensic_c7_8_db_inspector.js`, `scratch/forensic_c7_8_db_followup.js`, and their JSON outputs).
**Evidence sources:** live PostgreSQL schema/constraints/indexes/row counts (2026-10-11), `api-engine.ts`,
`corporate-gifting.{service,repository,controller}.ts`, `staff-access-control.ts`, master plan.

---

## 1. Baseline

| Item | Value |
|---|---|
| Branch / HEAD | `task/dev` @ `0ae2ee0` (phase5c COD bridge) |
| Roadmap committed? | **No** — master plan + `LATEST_CHECKPOINT.md` edits are uncommitted |
| **C7.7 committed?** | **No — the entire C7.7 gifting subsystem is untracked** (service, repo, controller, panel, tests). Risk R1. |
| Working tree | Large set of pre-existing untracked/modified files preserved untouched |

---

## 2. Current-state inventory (evidence)

### 2.1 Customer / corporate identity
`customer` (56 live rows): already has `is_corporate`, `company_name`, `gstin`, `credit_enabled`, `credit_limit`,
`payment_terms_days`, `credit_balance`, `credit_status`, `credit_approved_by/at`. Indexes: partial `is_corporate`, `credit_enabled`, phone; unique `(email, has_account)`.
- **0 corporate customers, 0 credit-enabled, 0 with company_name** → no data migration risk; greenfield for corporate accounts.
- No billing address, contacts, approval status, or legal-name fields beyond `company_name`/`gstin`. No GSTIN format CHECK.
- `invoice.is_corporate` exists; `invoice.customer_id` + `branch_id` exist.

### 2.2 `company` table is NOT the corporate client
`company` = **the ERP operator's own legal entity** (singleton: unique partial index on `is_active=true`, 0 rows, PAN/state_code checks).
`corporate_gifting_batch.company_id → company(id)` points to the *operator* company. **Naming collision** — the corporate-client account must not reuse `company`. (R2)

### 2.3 Employees
- **No employee/roster/corporate-account table exists** (searched all 325 public tables).
- Only employee-like data: `corporate_gifting_recipient.employee_id` (varchar, per-batch free text, `UNIQUE(batch_id,row_number)`, **no uniqueness on employee_id, no link to customer**). Recipients are batch-scoped snapshots, 0 rows.
- C7.7 therefore has no concept of a persistent employee. C7.9 must introduce one and link recipients by nullable FK, keeping snapshot columns for history (D2).

### 2.4 Delivery / routing architecture
| Layer | Finding |
|---|---|
| `branch` (53 live, all open) | `latitude/longitude float8` populated on **53/53**; `is_open`; metadata JSON holds `max_delivery_radius_km`, `operational_status`, `delivery_zones`, `deliverable_areas`, `extended_status` etc. FK `city_id`. |
| `delivery_zone` (44) | Columns: `pincode, branch_id, delivery_fee, is_serviceable, polygon_coordinates jsonb, radius_km, center_latitude/longitude, priority, estimated_delivery_minutes, manual_override_branch_id, name`. **12 with polygon (≥3 pts), 37 radius, 44 PIN, 0 manual overrides**, across 28 branches. Only PK + pincode + (branch,serviceable,priority) indexes. **No FK on branch_id/override.** |
| `delivery_partner` (30) | Only person fields (name/email/phone/avatar). **No coverage, status, type, priority, or store link.** |
| `delivery_delivery_partner`, `order_staff_assignment` | Exist (Medusa link / staff assignment); not coverage-related. |
| `geo_zone` (7) / `service_zone` (1) | Medusa-native; unused by ERP routing. |
| `delivery` (57) | Has recipient address/pincode, `delivery_partner_id`, status; **no lat/lng, no branch_id, no assignment source/audit**. |
| `order` | **No `branch_id`**; branch only recoverable via `invoice.branch_id`/metadata. |
| PostGIS | **Not installed.** Available on server: `postgis 3.3.7`, `earthdistance`, `cube` (installable via `CREATE EXTENSION`; needs approval). Installed: `pgcrypto, uuid-ossp, supabase_vault, pg_stat_statements`. |

### 2.5 Existing map-fence engine (major reusable asset)
`ApiEngine` (`api-engine.ts`):
- `isPointInPolygon` (ray casting, tuple/object), `isPointInZone` (polygon, radius, HYBRID, zone/store exclusion polygons, effective radius = min(25 km global, branch, zone)), `calculateHaversineDistance`.
- `resolveSmartBranch` PATH A (coords): evaluates every operational branch's enabled zones by priority, collects candidates, **selects nearest eligible store, tie-break `routing_priority`**; returns `unserviceable_coords` / `INSIDE_EXCLUSION_ZONE` / `NO_ELIGIBLE_STORE` when nothing matches.
- `resolveDeliveryContext` wraps it with state/city/GST/fee/ETA.
- Admin UI exists: `branch-zone-manager.tsx`, `map-fence-editor.tsx`, `coverage-map.tsx`; persistence in `branch.repository.ts` / `db-persistence.ts`.

**Violations of D3/D4/D5 present in the same engine** (must not be inherited by corporate routing):
1. PATH B (no coords) falls back to city-name substring match, PIN match, then **`operational[0]` / "indiranagar" hub** (`locality_fallback`) — silent guess.
2. `blocked_area`/`fallback_default` returns `branches[0]`.
3. `resolveDeliveryContext` without coords derives coords **from the branch**, then "validates" — circular proof.
4. Zone ID fallback `"zone_core"`, fixed `distance_km: 3.5` fabrication.
5. Engine is in-memory/hydrated (`listBranches`); DB schema lacks `enabled`, `fence_type`, `exclusion_polygons`, `max_serviceable_km` columns on `delivery_zone` → those live in branch metadata JSON, so DB-only SQL cannot reproduce engine semantics. 
6. Nearest-store rule is not "explicit priority" as D4 requires for store-vs-partner.

### 2.6 Current gifting handling of location (C7.7)
- Validates only `^[1-9][0-9]{5}$` PIN; **no coordinates, no geocoding, no zone check**.
- **One branch for the whole batch**: `requestedBranchId` or oldest branch (`ORDER BY created_at ASC LIMIT 1`) — silent default, drives GST state/GSTIN (hardcoded fallbacks `"Karnataka"`, `29AAAAA0000A1Z5`).
- Recipient has `delivery_city/state/pincode` text only; `delivery_id` FK to `delivery`.
- Single master invoice invariant (D6) intact.

### 2.7 Customer addresses
`customer_address` (34): `metadata.latitude` present on 34/34; customer `metadata.addresses[]` also carries lat/lng for some. Coordinates exist for saved addresses but **no address→coordinate resolver for gifting rows**. No geocoding provider/key found in schema; provider selection remains open.

### 2.8 RBAC
- `StaffAccessControl` (`staff-access-control.ts`): module/action registry. Existing: `CORPORATE_GIFTING.{VIEW,TEMPLATE,VALIDATE,EXECUTE}`; category "Corporate & Institutional". Tables: `user`, `user_rbac_role`, `invite_rbac_role`, `audit_log`, `config_audit_log`.
- Controller pattern: `assertPermission`, CUSTOMER role may act only on own customer id; staff must name customerId.
- **Missing**: `CORPORATE_ACCOUNTS.*`, `CORPORATE_EMPLOYEES.*`, `DELIVERY_COVERAGE.*`, `DELIVERY_ROUTING.*`, `LOCATION_REVIEW.*` (Super Admin only).
- `user` has no staff-role column; role resolved via `user_rbac_role`.

### 2.9 Accounting guard rails
`accounting_voucher` (6), `accounting_journal_line` (10, has `customer_id`, `branch_id`, `cost_centre_id`), posted-immutability triggers (C-phase tests `test_immutability_triggers.js`). Routing data must live in new tables referenced *from* operational rows, never altering `invoice`/voucher/journal rows (D7). `cost_centre` has 0 rows.

---

## 3. Gap analysis

| Need | Exists | Gap |
|---|---|---|
| Corporate profile (legal name, billing, GSTIN, contacts, credit terms, approval) | Partial on `customer` | Contacts, billing address, approval workflow, status, GSTIN validation, audit |
| 1:1 account↔customer | — | New `corporate_account` with `UNIQUE(customer_id)`; backfill none |
| Employee master | None | New `corporate_employee` + status history; `UNIQUE(account_id, employee_code)` |
| Bulk employee import | C7.7 Excel/ExcelJS infra, file hash dedupe | New template, validator, dry-run, duplicate-ID detection |
| Deactivate/reactivate | — | Status + immutable history events |
| Polygon storage | jsonb on `delivery_zone` | Fine for now; PostGIS optional for scale |
| Store coverage fences | Yes (zones) | Normalised DB columns for enabled/exclusions; FK integrity |
| Partner coverage fences | **None** | New `delivery_partner_coverage` (+ partner status/type/priority) |
| Explicit store/partner priority | Store `routing_priority`; no partner rule | New `delivery_routing_rule` table |
| Address→coordinates | Only saved addresses | Geocode abstraction + provider decision + cached result with confidence |
| Matching engine w/o guessing | Engine has silent fallbacks | New pure `corporate-routing` service; **no PIN/city fallback**; uses fence primitives only |
| Super Admin review queue | None | New `delivery_location_review` + decision log |
| Per-recipient assignment + audit | Batch-level single branch | New `corporate_delivery_assignment` (+ history) |
| Permissions | Gifting only | New modules listed in 2.8 |

---

## 4. Proposed migration plan (for C7.9–C7.13; **not executed**)

All additive, idempotent, `IF NOT EXISTS`, soft-delete-aware, text IDs matching existing `prefix_ULID` style.

**C7.9**
- `corporate_account(id, customer_id UNIQUE FK→customer RESTRICT, legal_name, trade_name, gstin CHECK regex, pan, billing_address jsonb, primary_contact jsonb, status CHECK('PENDING','APPROVED','SUSPENDED','CLOSED'), approved_by/at, created_by, timestamps, deleted_at)`.
- `corporate_account_contact(id, account_id, name, email, phone, role, is_primary)`.
- `corporate_employee(id, account_id FK RESTRICT, employee_code, name, phone, email, department, default_address jsonb, default_lat/lng, status CHECK('ACTIVE','INACTIVE'), deactivated_at/by/reason, …)` with partial unique `(account_id, employee_code) WHERE deleted_at IS NULL` (case-normalised).
- `corporate_employee_event(id, employee_id, event_type, actor, payload, created_at)` append-only.
- `corporate_gifting_recipient.employee_ref_id` nullable FK→`corporate_employee` ON DELETE RESTRICT (snapshot columns retained).
- `corporate_employee_import_batch` (reuse file-hash dedupe pattern).

**C7.10**
- `delivery_partner` additive columns/new `delivery_partner_profile(partner_id, partner_type, status, priority)`.
- `delivery_partner_coverage(id, partner_id, name, polygon jsonb, exclusion_polygons jsonb, is_active, priority)`.
- Optional approved decision: `CREATE EXTENSION postgis` + `geography` mirror column with GiST index; otherwise keep jsonb + engine primitives (recommended initially; see O3).
- Add FK `delivery_zone.branch_id → branch` only after orphan check.

**C7.11**
- `delivery_routing_rule(id, scope, target_type 'STORE'|'PARTNER', target_id, priority, conditions jsonb, is_active)`.
- `delivery_geocode_result(id, input_hash UNIQUE, provider, lat, lng, confidence, raw jsonb, created_at)`.
- `corporate_delivery_assignment(id, recipient_id UNIQUE, status CHECK('UNASSIGNED','ASSIGNED','NEEDS_REVIEW','REASSIGNED','FAILED'), target_type, target_id, zone_id, method, lat, lng, decided_by, decided_at)` + `corporate_delivery_assignment_history` (append-only, trigger blocks UPDATE/DELETE).

**C7.12** `delivery_location_review(id, recipient_id, reason_code, candidates jsonb, status, resolved_by/at, resolution jsonb)`.

**C7.13** Recipient-level wiring only; no new invoice paths; reassignment writes history, never touches `invoice`/`accounting_*`.

---

## 5. Integration points

1. `corporate-gifting.service.ts` validation step (line ~561 PIN check) → add geocode + route step, producing assignment + review rows; batch branch (line ~391-409) becomes *billing/GST branch* only, decoupled from delivery target.
2. `corporate-gifting.repository.ts` insert (~398) → persist coordinates/employee ref.
3. `corporate-gifting.controller.ts` `assertPermission` pattern → new controllers `corporate-account`, `corporate-employee`, `delivery-coverage`, `location-review`.
4. `staff-access-control.ts` registry (~253, ~855) → new modules.
5. `ApiEngine.isPointInPolygon/isPointInZone/calculateHaversineDistance` → import as pure geometry only; **do not call `resolveSmartBranch` PATH B or `resolveDeliveryContext` fallbacks**.
6. `branch-zone-manager.tsx`, `map-fence-editor.tsx` → reuse for store fences; extend for partners and Super Admin review (map library already in repo via `coverage-map.tsx`).
7. `delivery` creation → set `delivery_partner_id`; assignment authority remains in new table.

---

## 6. Risk register

| ID | Risk | Severity | Mitigation / Decision |
|---|---|---|---|
| R1 | C7.7 and roadmap uncommitted; any later `clean`/switch loses accepted work | **High** | Owner to commit C7.7 before C7.9 migrations |
| R2 | `company` vs corporate client name collision | Med | Use `corporate_account`; document |
| R3 | Existing engine silent fallbacks contradict D3–D5 | **High** | Separate pure routing service; never reuse PATH B |
| R4 | Zone semantics split between DB columns and branch metadata JSON; 12/44 polygons, 37/44 radius; zone rows may be partly radius-only | Med | Routing treats radius-only as eligible only if explicit; normalise in C7.10; report inventory |
| R5 | No geocoding provider/keys; accuracy/cost/latency unknown | **High** | Decision O1; fail to review queue when confidence < threshold |
| R6 | Partner model has no coverage/priority concept | Med | New profile/coverage tables |
| R7 | Overlapping fences across stores/partners → ambiguity | Med | Overlap → explicit priority rule, else NEEDS_REVIEW |
| R8 | Hardcoded GST fallbacks in gifting service (`29AAAAA0000A1Z5`, "Karnataka") | Med | Fail closed in C7.13 if branch GSTIN missing |
| R9 | Test-pollution data in `branch`/`delivery_zone` ("Postgres Pipeline Branch …", identical coords 12.9716,77.6412 across 53 branches) | Med | Fences/priorities may be meaningless; need data clean-up decision before E2E |
| R10 | Concurrent bulk reassignment / duplicate employee import | Med | Unique indexes, `SELECT … FOR UPDATE`, file-hash dedupe |
| R11 | PII (employee phone/address) retention | Low | Soft-delete + masking in review UI |
| R12 | Git `fork bomb` bug on default `git.exe` | Low | Use mingit path |

---

## 7. Decision traceability

| Decision | Evidence-backed implication |
|---|---|
| D1 | `customer` already has corporate/credit columns; add `corporate_account.customer_id UNIQUE` |
| D2 | `corporate_employee.status` + append-only events; FKs RESTRICT |
| D3 | Coords only: reuse geometry primitives; PIN/city used only to *pre-fill/hint* |
| D4 | New `delivery_routing_rule`; no `operational[0]` fallback |
| D5 | `NEEDS_REVIEW` + `delivery_location_review`; Super Admin permission |
| D6 | No new invoice code path; assignment table is independent |
| D7 | Assignment history append-only; no writes to `invoice`/`accounting_*` |

---

## 8. Exact implementation sequence

1. **Pre-gate:** commit C7.7 (owner), freeze regression baselines (Section 11 of master plan).
2. **C7.9a** migration (account, contact, employee, event, import batch) + schema test; **C7.9b** repository/service (CRUD, deactivate/reactivate, GSTIN/dup validation); **C7.9c** bulk import dry-run/execute; **C7.9d** controller + RBAC + UI panel; **C7.9e** E2E + PG audit.
3. **C7.10a** partner profile/coverage migration + coverage normalisation report; **C7.10b** repository; **C7.10c** UI (extend `map-fence-editor`); verify store fence data integrity.
4. **C7.11a** geocode abstraction + cache (provider per O1); **C7.11b** pure matcher (point-in-fence, exclusion, priority, ambiguity detection); **C7.11c** assignment/history tables + service; unit tests with fixtures including `Kollam/KOLLAM/kollam` equivalence and "city alone never assigns".
5. **C7.12** review queue repo/service/controller/UI (Super Admin only), reprocess flow.
6. **C7.13** wire into gifting validation/execute; recipient-level assignments; reassignment; verify single-invoice invariant.
7. **C7.14** Playwright, RBAC matrix, concurrency, independent PG audit, `tsc --noEmit`, rerun all frozen suites.

Each step: migrations idempotent and transaction-wrapped; no destructive ops; independent audit script per step (project convention).

---

## 9. Open questions requiring owner decision

| # | Question | Recommendation |
|---|---|---|
| O1 | Geocoding provider (Google / MapMyIndia / Nominatim / user-supplied coordinates in Excel) | Add optional `latitude/longitude` columns to template + provider-agnostic interface; pick provider later |
| O2 | Employee address ownership: stored on roster vs per-batch row | Roster default + per-row override |
| O3 | Install PostGIS now? | Defer; jsonb + existing primitives sufficient at 44 zones; revisit at scale |
| O4 | Who can approve corporate accounts? | New `CORPORATE_ACCOUNTS.APPROVE`, Super Admin + Finance |
| O5 | Clean polluted test branches/zones before C7.10? | Yes, via approved script |
| O6 | Partner vs store precedence default | Explicit rule per account/zone; none = review |

---

## 10. Verification of read-only compliance
- No migrations, no writes to DB (only `SELECT`/catalog queries).
- No changes to `frontend/src`, `package.json`, or permissions.
- Added files: two scratch inspectors + JSON outputs under `scratch/` (untracked), this report.

**Status:** C7.8 discovery complete. **Implementation authorization: NONE** until owner approves Section 9 decisions and the C7.7 commit gate.
