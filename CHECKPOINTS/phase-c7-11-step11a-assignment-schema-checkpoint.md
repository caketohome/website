# Checkpoint: Phase C7.11 — Step 11A: Corporate Geographic Assignment Schema Foundations

**Phase:** C7.11 Corporate Delivery Geographic Matching and Routing  
**Step:** 11A — Assignment Schema Foundations & Immutability Trigger  
**Date:** 2026-10-13  
**Status:** COMPLETE & VERIFIED (STOP APPLIED AT STEP 11A BOUNDARY)

---

## 1. Objectives & Approved Decisions Implemented

Step 11A implements the database foundations for persisting corporate delivery geographic matching outcomes, fail-closed unassigned states, diagnostic routing reasons, and append-only manual override audit trails in strict accordance with the approved C7.11 design decisions:

1. **Dedicated Assignment Persistence (Decision 1)**:
   - Created standalone table `public.corporate_delivery_assignment`.
   - Isolates routing outcomes from retail orders, customer accounting, employee rosters, and gifting recipient records.
   - Preserves recipient addresses and delivery scheduling without rewriting commercial records.
2. **Strict Fail-Closed Status & Reason Enums (Decision 2)**:
   - Default status: `'UNASSIGNED'`.
   - Default reason: `'PENDING_EVALUATION'`.
   - Status CHECK constraint: `('ASSIGNED', 'UNASSIGNED', 'MANUAL_OVERRIDE', 'PENDING_REVIEW')`.
   - Reason Code CHECK constraint: `('MATCHED_POLYGON', 'MATCHED_RADIUS', 'OUTSIDE_COVERAGE', 'INSIDE_EXCLUSION', 'COORDINATES_MISSING', 'COORDINATES_INVALID', 'STORE_NOT_ELIGIBLE', 'NO_ELIGIBLE_PARTNER', 'MANUAL_OVERRIDE', 'PENDING_EVALUATION')`.
3. **No Accounting / Invoicing Coupling (Decision 7 & 8)**:
   - `UNASSIGNED` is strictly a routing outcome, not an accounting event.
   - Zero interaction with Chart of Accounts, vouchers, journal entries, or invoices.
   - The single-master-invoice rule for corporate gifting remains completely preserved.
4. **Append-Only Assignment Event Audit Trail (Decision 6)**:
   - Created `public.corporate_assignment_event` table.
   - Enforced by database trigger `trg_corporate_assignment_event_immutability` raising SQLSTATE `27000` on any UPDATE or DELETE.
   - Tracks `BATCH_MATCHED`, `MANUALLY_OVERRIDDEN`, `REASSIGNED`, and `UNASSIGNED_TRIGGERED`.

---

## 2. Schema Architecture & Catalog Details

### 2.1 `public.corporate_delivery_assignment` (26 Columns)
```sql
CREATE TABLE public.corporate_delivery_assignment (
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
```

### 2.2 `public.corporate_assignment_event` (9 Columns)
```sql
CREATE TABLE public.corporate_assignment_event (
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
```

### 2.3 Indexes & Immutability Trigger
- `uq_cda_entity`: `UNIQUE (entity_type, entity_id)`
- `idx_cda_status`: `ON public.corporate_delivery_assignment(status)`
- `idx_cda_account_id`: `ON public.corporate_delivery_assignment(account_id)`
- `idx_cda_assigned_store_id`: `ON public.corporate_delivery_assignment(assigned_store_id)`
- `idx_cda_assigned_partner_id`: `ON public.corporate_delivery_assignment(assigned_partner_id)`
- `idx_cda_normalized_city`: `ON public.corporate_delivery_assignment(normalized_city_key)`
- `idx_cda_assigned_at`: `ON public.corporate_delivery_assignment(assigned_at DESC)`
- `trg_corporate_assignment_event_immutability`: Blocks `UPDATE` and `DELETE` on `corporate_assignment_event` with SQLSTATE `27000`.

---

## 3. Test & Verification Evidence

### 3.1 Migration Runner & Verification Suite (`run_c7_11_step11a_migration.js`)
- Preflight accounting integrity verified (100 CoA accounts, ₹3,380.00 balanced TB, 30 partners, 53 active branches).
- Executed atomic migration DDL.
- Verified catalog columns, unique constraints, and foreign key definitions.
- Verified functional immutability defense: UPDATE and DELETE on audit events rejected with SQLSTATE `27000`.
- Verified clean fixture teardown.
- Postflight accounting re-check confirmed: zero modifications to financial baseline.
- **Result:** **35 / 35 PASSED (0 FAILED)**.

### 3.2 Live Database Read-Only Invariant Verification
```json
{
  "coa_count": 100,
  "vouchers_count": 6,
  "jes_count": 4,
  "jls_count": 10,
  "total_dr": "3380.00",
  "total_cr": "3380.00",
  "delivery_partners_active": 30,
  "branches_active": 53,
  "corporate_delivery_assignments_count": 0,
  "corporate_assignment_events_count": 0,
  "assignment_event_immutability_trigger": true
}
```

### 3.3 TypeScript Compilation Validation
- TypeScript interfaces created: [`frontend/src/lib/types/corporate-routing.types.ts`](file:///e:/vig/cakes2home-main/cakes2home-main/frontend/src/lib/types/corporate-routing.types.ts)
- Exported in [`frontend/src/lib/types/index.ts`](file:///e:/vig/cakes2home-main/cakes2home-main/frontend/src/lib/types/index.ts)
- Static type check: `npx tsc --noEmit` (**0 errors, Exit code 0**).

---

## 4. Preservation & Scope Boundary

- **Git Status:** Preserved all working tree changes; zero commits, resets, stashes, or pushes.
- **Accounting State:** Chart of Accounts (100 accounts) and Trial Balance (Dr ₹3,380.00 / Cr ₹3,380.00) remain unchanged.
- **Master Data:** 30 delivery partners and 53 active branches remain unchanged.
- **Stop Condition:** Step 11A is complete. **Step 11B (Domain Matching Engine) is NOT STARTED** and awaits explicit user authorization.
