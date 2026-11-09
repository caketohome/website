# Checkpoint: Phase C7.13 — Corporate Campaign Integration, Reassignment & Delivery Status

**Phase:** C7.13 Corporate Campaign Integration  
**Date:** 2026-10-14  
**Status:** 100% COMPLETE & VERIFIED (STOP APPLIED AT C7.13 BOUNDARY)  
**Git Branch:** `checkpoint/c-phases-baseline`  
**Git HEAD:** `d231cee7e55f716526e62f5799cc7377c555fed3` (`feat(delivery): wire platform delivery bridges, customer receipts, and gateway settlements for Phase 5C`)  
**Working Tree:** Preserved without commits, pushes, stashes, or resets.  

---

## 1. Scope & Execution Boundary

Phase C7.13 integrates corporate gifting bulk campaigns with automated geographic store-partner routing, persistent delivery records, manual overrides, and lifecycle status management.

### In-Scope (Implemented & Verified):
1. **Dry-Run Validation Routing Preview (`POST /api/v1/admin/corporate-gifting/validate`)**:
   - Parses Excel workbook in memory with zero database writes.
   - Computes candidate store-zone-partner matching preview for all parsed recipients.
   - Populates `routingPreview` metadata (`can_match`, `matched_store_id`, `reason_code`) on each recipient row.
   - Verified zero database rows created in `corporate_gifting_batch`, `corporate_gifting_recipient`, `delivery`, or `corporate_delivery_assignment`.

2. **Transactional Campaign Execution (`POST /api/v1/admin/corporate-gifting/execute`)**:
   - Acquires transaction-scoped customer advisory lock (`pg_advisory_xact_lock`) preventing credit exposure race conditions.
   - Creates commercial master umbrella order in `public."order"`.
   - Creates corporate gifting batch record in `public.corporate_gifting_batch`.
   - Creates child delivery records in `public.delivery` with initial status `pending`.
   - Inserts recipient items in `public.corporate_gifting_recipient`.
   - Automatically executes batch geographic matching via `CorporateRoutingService.matchDeliveriesBatch`, assigning eligible items to candidate stores and partners.
   - Issues exactly **one master corporate GST invoice** via `BillsReceivableService.createAndPostCorporateInvoice`, creating a single statutory sales voucher in `public.accounting_voucher` with balanced journal entries.
   - Synchronizes `public.delivery` records: assigned recipients receive `delivery_status = 'pickup_claimed'` and `delivery_partner_id = partner.id`, while unassigned recipients remain `pending` with null partner.

3. **Batch Routing Overview & PII Protection (`GET /api/v1/admin/corporate-gifting/batches/:id/routing` & `:id`)**:
   - Returns aggregated routing metrics: evaluated, assigned, unassigned count, and canonical reason code breakdown (`COORDINATES_MISSING`, `OUTSIDE_COVERAGE`, etc.).
   - Returns recipient detail list with phone number privacy masking (`98******01`) for staff lacking PII viewing clearance.

4. **Batch Re-Evaluation & Idempotency (`POST /api/v1/admin/corporate-gifting/batches/:id/route`)**:
   - Re-evaluates batch recipients against current candidate stores and partner coverages.
   - Idempotent execution emits zero duplicate audit events when assignments remain unchanged.

5. **Manual Recipient Reassignment & Override Preservation (`POST /api/v1/admin/corporate-gifting/recipients/:id/reassign`)**:
   - Allows authorized Super Admin to manually assign or override a recipient delivery to any corporate-eligible store and partner.
   - Requires audit justification reason (minimum 5 characters).
   - Updates assignment status and reason code to `MANUAL_OVERRIDE`.
   - Appends immutable `MANUALLY_OVERRIDDEN` event to `public.corporate_assignment_event`.
   - Synchronizes `public.delivery` record (`pickup_claimed` and partner ID).
   - Re-evaluating a batch with `forceReassign: false` **strictly preserves** manual overrides.
   - Re-evaluating a batch with `forceReassign: true` allows the automated engine to re-assign all recipients based strictly on geographic geometry.

6. **Delivery Lifecycle State Machine Enforcement (`POST /api/v1/admin/corporate-gifting/recipients/:id/delivery-status`)**:
   - Enforces canonical delivery progression: `assigned` (`pickup_claimed`) -> `out_for_delivery` (`in_transit`) -> `delivered`.
   - Strictly blocks illegal state jumps:
     - Direct jump from `pending` -> `delivered` rejected with HTTP 422 (`INVALID_STATUS_TRANSITION`).
     - Direct jump from `assigned` -> `delivered` rejected with HTTP 422 (`INVALID_STATUS_TRANSITION`).
     - Jumping to `out_for_delivery` from `pending` rejected with HTTP 422 (`INVALID_STATUS_TRANSITION`).
   - Terminal state protection: altering `delivered` or `cancelled` deliveries rejected with HTTP 422.
   - Idempotent repeated terminal updates return HTTP 200 with `idempotent: true`.
   - Maps recipient record status: `out_for_delivery` -> `DISPATCHED`, `delivered` -> `DELIVERED`, `failed` -> `FAILED`.

7. **Security & Partner Authorization Scoping**:
   - Authenticated session verification on all endpoints.
   - Cross-partner authorization enforcement: delivery partners can only update orders assigned to their partner ID; cross-partner attempts rejected with HTTP 403 (`PARTNER_ACCESS_DENIED`).
   - Corporate customers strictly blocked from updating fulfillment statuses (HTTP 403 `FORBIDDEN`).

8. **Strict Financial & Accounting Invariants**:
   - Exactly 1 master corporate invoice created per campaign batch.
   - Exactly 0 child delivery invoices or individual recipient invoices created.
   - Zero duplicate vouchers, journal entries, or ledger lines created during routing updates or delivery status transitions.
   - Chart of Accounts preserved at exactly 100 canonical accounts.
   - Trial Balance strictly balanced: Dr ₹3,380.00 = Cr ₹3,380.00.

### Out-of-Scope (Strictly NOT Started):
- Phase C7.14: Unified Browser E2E, Permission Tests & Concurrency Audits.
- Production cron activation, worker queues, or background routing daemons.
- Partner Marketplace workstream.
- Any modification to Chart of Accounts, journal entries, vouchers, or financial ledgers.

---

## 2. Real PostgreSQL Schema Discoveries & Remediations

During Phase C7.13 diagnosis and implementation, the real PostgreSQL database schema was forensic-audited and resolved:

| Table / Constraint | Real Database Behavior | Remediation Applied |
|---|---|---|
| `public.delivery.delivery_status` (`delivery_delivery_status_check`) | Check constraint strictly permits: `ARRAY['pending', 'shop_declined', 'shop_accepted', 'pickup_claimed', 'shop_preparing', 'ready_for_pickup', 'in_transit', 'delivered']`. `'assigned'` and `'out_for_delivery'` violate constraint 23514. | Updated service mapping: Partner assigned maps to `'pickup_claimed'`, out-for-delivery maps to `'in_transit'`. DTO layer transparently returns canonical names to API clients. |
| `public.invoice` | Table is `public.invoice` (there is no `public.corporate_invoice`). References `order_id` -> `public."order".id`. | Test cleanup and queries target `public.invoice` with proper foreign key deletion ordering (`invoice` -> `order_item` -> `order`). |
| `public.accounting_voucher` vs `accounting_journal_entry` | `reference_type` and `reference_id` exist on `public.accounting_voucher`, linked to `accounting_journal_entry` via `voucher_id`. | Cleanup queries in test suite updated to filter `voucher_id` via `accounting_voucher` instead of non-existent column on journal entry. |
| `CorporateGiftingController` Error Mapping | `INVALID_STATUS_TRANSITION`, `PARTNER_ACCESS_DENIED`, and `RECIPIENT_NOT_FOUND` fell back to generic 400. | Updated `handleCorporateGiftingError`: mapped `PARTNER_ACCESS_DENIED` -> 403, `RECIPIENT_NOT_FOUND` -> 404, `INVALID_STATUS_TRANSITION` -> 422. |
| Product Pricing & Catalog | `product_variant` has no standalone `price` column; pricing is stored in JSONB `metadata->>'selling_price'`, `metadata->>'price'`, or `weight_prices` array, alongside relational `product_variant_price_set` -> `price` joins. | Fixed `scratch/inspect_catalog.js` and services to extract effective prices from verified metadata and relational joins without referencing non-existent `pv.price`. |
| C7.13 Test Suite Timeout & Hang Protection | Tests could potentially block indefinitely if HTTP routes or queries stall on locks without statement/request timeouts. | Hardened `scratch/test_phase_c7_13_campaign_routing.js` with 15s per-HTTP timeout (`Promise.race`), `trackedQuery` logging every query with start/done timestamps and row counts, `SET statement_timeout = 10000;`, and guaranteed pool teardown on normal completion or timeout. |

---

## 3. Source Files Added & Modified

| File | Type | Changes / Purpose |
|---|---|---|
| `frontend/src/lib/services/corporate-routing.service.ts` | Service (Modified) | Updated `matchDeliveriesBatch`, `resolveUnresolvedAssignment` (`CORRECT_COORDINATES` and `MANUAL_ASSIGN`) to update `public.delivery` setting `delivery_status = 'pickup_claimed'` instead of `'assigned'` to satisfy check constraint 23514. |
| `frontend/src/lib/services/corporate-gifting.service.ts` | Service (Modified) | In `validateBatchImport`, populated `routingPreview` on each `parsedRecipients` item during dry run. In `reassignRecipientDelivery`, updated `public.delivery` setting `pickup_claimed` and return DTO `assigned`. In `updateRecipientDeliveryStatus`, implemented canonical status state machine, check-constraint-safe DB mapping, idempotency checks, and partner authorization guards. |
| `frontend/src/lib/controllers/corporate-gifting.controller.ts` | Controller (Modified) | Added `routingPreview` to `/validate` response. Added `routingSummary` camelCase and snake_case DTO normalization to `/execute` and `/batches/:id/route`. Added missing error code mappings (`PARTNER_ACCESS_DENIED` -> 403, `RECIPIENT_NOT_FOUND` -> 404, `INVALID_STATUS_TRANSITION` -> 422). |
| `frontend/src/components/dashboard/admin/corporate-gifting-panel.tsx` | UI Component (Modified) | Updated `renderDeliveryStatusBadge` to handle and display both `pickup_claimed` and `in_transit` alongside legacy status badges. |
| `scratch/inspect_catalog.js` & `frontend/scratch/inspect_catalog.js` | Tooling (Fixed & Hardened) | Completely eliminated invalid `pv.price` query; implemented verified read-only pricing extraction from `p.metadata` / `pv.metadata` / `price_set` joins with 30s deadline and clean connection teardown. |
| `frontend/scratch/test_phase_c7_13_campaign_routing.js` | Test Suite (Modified & Hardened) | Full 103-assertion C7.13 test suite with 90s bounded timeout, 15s per-HTTP timeout, `trackedQuery` progress logging, real schema alignment, preflight/postflight accounting baseline verifications, and safe fixture teardown. |

---

## 4. Verification & Test Evidence

### 4.1 Catalog Inspection Schema Audit
- **Command:** `node scratch/inspect_catalog.js` (Cwd: `frontend/`)
- **Exit Code:** `0`
- **Result:** Successfully inspected all columns of `product_variant`, `product`, `customer`, `corporate_gifting_batch`, `corporate_gifting_recipient`, `corporate_employee`, `delivery`, `corporate_delivery_assignment`, `corporate_assignment_event`, and `invoice` constraints. Extracted effective prices for 10 active variants (e.g., Butter Croissant ₹149, Danish Pastry ₹399, Classic Chocolate Truffle Cake ₹433) with zero schema errors.

### 4.2 C7.13 Dedicated Campaign Routing Suite
- **Command:** `node scratch/test_phase_c7_13_campaign_routing.js` (Cwd: `frontend/`)
- **Exit Code:** `0`
- **Result:** **103 PASSED | 0 FAILED** (Duration: ~10 seconds)
  - Preflight Master Accounting & Master-Data Baseline Verification: 9 assertions passed
  - TEST 1: Dry-Run Batch Validation (Zero Writes): 14 assertions passed (spreadsheet validated, routing preview generated, 0 DB rows written)
  - TEST 2: Campaign Confirmation & Automated Routing Execution: 20 assertions passed (batch, order, invoice, voucher created; delivery partner assigned with `pickup_claimed`; unassigned item remains `pending`)
  - TEST 3: Batch Routing Overview & PII Protection: 9 assertions passed (metrics summary, recipient list, phone masked for limited staff `98******01`)
  - TEST 4: Batch Re-Evaluation Idempotency: 4 assertions passed (re-eval matches 200 OK, zero duplicate audit events emitted)
  - TEST 5: Manual Reassignment & Override Preservation: 11 assertions passed (manual override set to `MANUAL_OVERRIDE`, audit event appended, delivery status updated, preserved under re-eval)
  - TEST 6: Forced Reassignment Re-Evaluation (`forceReassign: true`): 4 assertions passed (re-evaluates all recipients, unassigned reverts to `UNASSIGNED`)
  - TEST 7: Delivery Lifecycle State Machine Enforcement: 11 assertions passed (direct jumps rejected with 422, valid transitions pass, terminal state protected, repeat returns idempotent)
  - TEST 8: Partner Authorization Scoping: 2 assertions passed (cross-partner rejected with 403, customer rejected with 403)
  - TEST 9: Accounting Invariants Verification: 2 assertions passed (exactly 1 master invoice, exactly 2 child deliveries)
  - Postflight Master Invariant Verification: 10 assertions passed (clean teardown, 0 residual assignments or events, trigger strictly enabled 'O')

### 4.3 TypeScript Static Typecheck
- **Command:** `npx tsc --noEmit` (Cwd: `frontend/`)
- **Exit Code:** `0`
- **Result:** Clean (zero compilation errors)

### 4.4 C7.12 Review Queue Regression Suite
- **Command:** `node scratch/test_phase_c7_12_review_queue.js` (Cwd: `frontend/`)
- **Exit Code:** `0`
- **Result:** **66 PASSED | 0 FAILED** (zero regressions across review queue, candidate evaluation, manual actions, and immutability)

### 4.5 Step 11C Routing API & Controller Regression Suite
- **Command:** `node scratch/test_phase_c7_11_step11c_api.js` (Cwd: `frontend/`)
- **Exit Code:** `0`
- **Result:** **59 PASSED | 0 FAILED** (zero regressions across routing endpoints, RBAC, tenant isolation, and batch bounds)

### 4.6 Independent Forensic Read-Only Database Audit
- **Command:** `node scratch/independent_c7_12_forensic_audit.js` (Cwd: `frontend/`)
- **Exit Code:** `0`
- **Result:** **ALL INVARIANTS PASS (ZERO LEAKS / ZERO IMBALANCE)**
  - CoA Accounts: 100 (Expected: 100) -> PASS
  - Vouchers: 6 (Expected: 6) -> PASS
  - Journal Entries: 4 (Expected: 4) -> PASS
  - Journal Lines: 10 (Expected: 10) -> PASS
  - Trial Balance: Dr ₹3,380.00 / Cr ₹3,380.00 (Expected: 3,380.00 / 3,380.00) -> PASS
  - Active Delivery Partners: 30 (Expected: 30) -> PASS
  - Active Branches: 48 (Expected: 48) -> PASS
  - Active Customers: 56 (Expected: 56) -> PASS
  - Corporate Delivery Assignments: 0 (Expected: 0) -> PASS
  - Corporate Assignment Events: 0 (Expected: 0) -> PASS
  - Assignment Event Trigger: `trg_corporate_assignment_event_immutability` (`tgenabled = O`) -> PASS
  - Coverage Event Trigger: `trg_delivery_coverage_event_immutability` (`tgenabled = O`) -> PASS
  - Active Advisory Locks: 0 (Expected: 0) -> PASS

---

## 5. Milestone & Next Phase Authorization Gate

Phase C7.13 is **100% COMPLETE & VERIFIED**.

```
[Phase C7.8: Forensic Discovery] ✅ COMPLETE & VERIFIED
[Phase C7.9: Corporate Account Master & Roster] ✅ COMPLETE & VERIFIED
[Phase C7.10: Store & Partner Coverage Configuration] ✅ COMPLETE & VERIFIED
[Phase C7.11: Geographic Matching & Routing Rules] ✅ COMPLETE & VERIFIED
[Phase C7.12: Super Admin Unresolved Review Queue] ✅ COMPLETE & VERIFIED
[Phase C7.13: Corporate Campaign Integration] ✅ 100% COMPLETE & VERIFIED  <--- CURRENT BOUNDARY
══════════════════════════════════════════════════════════════════════════
[Phase C7.14: Unified Browser E2E, Permission & Concurrency Audits] ⏸️ UNAUTHORIZED / STOP APPLIED
[Partner Marketplace Workstream] ⏸️ UNAUTHORIZED
```

**STOP APPLIED AT PHASE C7.13 BOUNDARY.**  
Awaiting explicit user authorization before commencing Phase C7.14.
