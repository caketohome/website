# CakeToHome ERP — Phase C4.1 Test Failure Investigation & Resolution Report

**Date:** 2026-10-04  
**Module:** Cash Custody & Shift Management (Phase C4.1)  
**Status:** ALL ISSUES RESOLVED — PHASE C4.1 VERIFICATION READY  
**Git Safety:** No commits or pushes performed.  

---

## 1. Executive Summary

During the initial run of the Phase C4.1 automated test suite (`scratch/test_phase_c4_1_api_settlement.js`), the suite executed 89 assertions across 8 testing sections:
- **Passed:** 86
- **Failed:** 3
- **Teardown Error:** Foreign key dependency violation on `teller_session_settlement_voucher_id_fkey`.

All core financial accounting capabilities performed with 100% precision:
- **Shortage Settlement:** Correctly posted balanced GL journal entries (Dr 5296 Cash Over/Short / Cr 1111 Cash in Hand) with branch dimensional anchoring.
- **Excess Settlement:** Correctly posted balanced GL journal entries (Dr 1111 Cash in Hand / Cr 5296 Cash Over/Short).
- **Zero Variance:** Correctly settled session with `NULL` settlement voucher and zero GL side-effects.
- **Idempotency:** Repeated settlement attempts returned `wasAlreadySettled: true` without duplicate vouchers or GL lines.
- **Failure Injection & Atomicity:** Transaction rollback prevented partial vouchers during simulated crashes; clean retries succeeded in perfect lockstep (`POSTED` & `SETTLED`).

The three failures were isolated test-contract and fixture teardown defects.

---

## 2. Forensic Inspection of Initial Database State

Before any data deletion or cleanup was performed, an independent read-only inspection of PostgreSQL was executed:

| Table | Count | Pre-C4.1 Baseline | Delta / Status |
| :--- | :--- | :--- | :--- |
| `accounting_account` | 100 | 100 | Pristine |
| `accounting_voucher` | 6 | 3 | +3 test settlement vouchers |
| `accounting_journal_entry` | 2 | 2 | Pristine |
| `accounting_journal_line` | 4 | 4 | Pristine |
| `bank_account` | 0 | 0 | Pristine |
| `teller` | 6 | 0 | +6 test tellers |
| `teller_session` | 7 | 0 | +7 test sessions (3 SETTLED, 4 OPEN) |
| `teller_movement` | 0 | 0 | 0 (movement test failed) |
| `user` (test prefix `usr_test_c41_%`) | 12 | 0 | +12 test users |

### Referenced Vouchers Identified:
1. `sess_1791127058885_bwxv79j` (Shortage -20.00) -> `vch_00MUTYT0S1MFYRRE` (`status: POSTED`, `reference_type: TELLER_SESSION`)
2. `sess_1791127061353_0hg9x27` (Excess +50.00) -> `vch_00MUTYT29QERF1XS` (`status: POSTED`, `reference_type: TELLER_SESSION`)
3. `sess_1791127065021_hz6ow3z` (Retry after Crash) -> `vch_00MUTYT6B5V985WR` (`status: POSTED`, `reference_type: TELLER_SESSION`)
4. `sess_1791127063200_tz4ld7u` (Zero Variance) -> `settlement_voucher_id: NULL`

---

## 3. Analysis & Root Cause of the 3 Failures

### Failure A: Segregation of Duties (SoD) Error Code Mismatch
- **Symptom:** Opener and Verifier self-settlement returned HTTP 403, but with error code `"FORBIDDEN"` rather than `"SOD_VIOLATION"`.
- **Root Cause:** 
  The API route handler executes a dual-layer defense:
  1. Layer 1 (RBAC Permission Gate): `verifyApiPermission(req, "TELLER", "SETTLE")` verifies the actor has authority to settle. If lacking, it returns `HTTP 403` with `error: "FORBIDDEN"`.
  2. Layer 2 (Domain SoD Gate): `TellerSessionService.settleSession` validates `actor.userId !== session.opened_by` and `actor.userId !== session.verified_by`. If violated, it throws `new TellerDomainError("SOD_VIOLATION", ...)` which maps to `HTTP 403` with `error: "SOD_VIOLATION"`.
  The test tokens for `openerToken` and `verifierToken` lacked the `"TELLER.SETTLE"` permission. Therefore, the requests were rejected at the generic RBAC layer (Layer 1) before reaching the domain SoD validation (Layer 2).
- **CakeToHome Canonical Convention:** 
  In Phase C (`teller.types.ts`, `teller-session.service.ts`, `teller-session.repository.ts`, `test_phase_c3_domain_services.js`), the established domain error code is `SOD_VIOLATION`.
- **Resolution:** 
  Expanded the test coverage into three explicit assertions:
  1. `16a`: Settlement attempted without `TELLER.SETTLE` permission is rejected with `HTTP 403` and `error: "FORBIDDEN"`.
  2. `16b`: Opener possessing `TELLER.SETTLE` attempting self-settlement is rejected with `HTTP 403` and `error: "SOD_VIOLATION"`.
  3. `16c`: Verifier possessing `TELLER.SETTLE` attempting self-settlement is rejected with `HTTP 403` and `error: "SOD_VIOLATION"`.

### Failure B: Manual Movement Type Mismatch
- **Symptom:** Test assertion expected `movement.movement_type === "MANUAL_ADJUSTMENT"`.
- **Root Cause:** 
  The Phase C2 PostgreSQL schema strictly locks `movement_type` to 6 valid values:
  `CASH_SALE`, `COD_HANDOVER`, `CUSTOMER_REFUND`, `EXPENSE_PAYMENT`, `BANK_DEPOSIT`, `ADJUSTMENT`.
  There is no `MANUAL_ADJUSTMENT` movement type in the database or domain model.
  Manual cash adjustments are represented by `movement_type = "ADJUSTMENT"` and `source_type = "MANUAL"`.
  The production service `TellerMovementService.recordManualAdjustment` correctly sets:
  ```typescript
  movement_type: "ADJUSTMENT",
  source_type: "MANUAL"
  ```
  The test assertion had a naming discrepancy, expecting `MANUAL_ADJUSTMENT`.
- **Resolution:**
  Aligned the test assertion with the locked C2 schema:
  - `movement_type === "ADJUSTMENT"`
  - `source_type === "MANUAL"`
  Retained the regression test proving clients cannot forge system source types like `ORDER`.

### Failure C: Teardown Foreign Key Dependency Order
- **Symptom:** Teardown failed with `violates foreign key constraint "teller_session_settlement_voucher_id_fkey" on table "teller_session"`.
- **Root Cause:**
  The test suite teardown executed:
  1. `DELETE FROM accounting_voucher WHERE id = ANY($1);`
  2. `DELETE FROM teller_session;`
  `teller_session` maintains a foreign key `settlement_voucher_id REFERENCES accounting_voucher(id) ON DELETE RESTRICT`. Attempting to delete `accounting_voucher` while `teller_session` still pointed to it was rejected by PostgreSQL.
  Additionally, the production immutability trigger `public.fn_teller_session_immutability()` blocks `DELETE` operations on `SETTLED` sessions during standard user sessions.
- **Resolution:**
  - Foreign key `teller_session_settlement_voucher_id_fkey` remains **100% PRESERVED** (no CASCADE, no weakening).
  - Teardown order was restructured strictly along the topological dependency graph:
    1. `SET session_replication_role = 'replica';` (allows test fixture teardown to safely remove transient settled sessions without altering production trigger definitions)
    2. `DELETE FROM teller_movement;` (dependent on `teller_session`)
    3. `DELETE FROM teller_session;` (clears references to `teller` and `accounting_voucher` BEFORE vouchers are deleted)
    4. `DELETE FROM teller;` (dependent on `user`)
    5. `DELETE FROM accounting_journal_line WHERE journal_entry_id IN (SELECT id FROM accounting_journal_entry WHERE voucher_id = ANY($1));`
    6. `DELETE FROM accounting_journal_entry WHERE voucher_id = ANY($1);`
    7. `DELETE FROM accounting_voucher WHERE id = ANY($1);` (now safe because dependent `teller_session` rows were deleted in step 3)
    8. `DELETE FROM "user" WHERE id = ANY($1);`
    9. `SET session_replication_role = 'origin';`

---

## 4. Re-Execution & Verification Evidence

### A. Test Suite Results (`scratch/test_phase_c4_1_api_settlement.js`)
```
=============================================================================
CakeToHome ERP — Phase C4.1 Teller API + Settlement Posting Test Suite
=============================================================================

[0/8] Auditing pre-test PostgreSQL baseline...
  ✓ PASS: Baseline account_count === 100 (actual: 100)
  ✓ PASS: Baseline voucher_count === 3 (actual: 3)
  ✓ PASS: Baseline entry_count === 2 (actual: 2)
  ✓ PASS: Baseline line_count === 4 (actual: 4)
  ✓ PASS: Baseline teller_count === 0 (actual: 0)
  ✓ PASS: Baseline session_count === 0 (actual: 0)
  ✓ PASS: Baseline movement_count === 0 (actual: 0)
Using Test Branches: Branch A = br_01KYWH05FY08YH6XJKATV0NXDR, Branch B = br_01KYWH0RTHVHRD04J79T28RAHN

[1/8] Testing Teller Master API (Requirements 1-4)...
  ✓ PASS: 1. GET /api/v1/admin/tellers returns 200
  ✓ PASS: 1. Response contains tellers array
  ✓ PASS: 2. POST /api/v1/admin/tellers creates teller (201)
  ✓ PASS: 2. Created teller has correct code
  ✓ PASS: 2. Created teller assigned to opener user
  ✓ PASS: 3. Duplicate active teller for same user rejected with 409
  ✓ PASS: 3. Error code is TELLER_DUPLICATE_ACTIVE_USER
  ✓ PASS: 4. Foreign branch mutation rejected with 403
  ✓ PASS: 4. Error indicates branch scoping failure

[2/8] Testing Session Lifecycle API (Requirements 5-9)...
  ✓ PASS: 5. POST /api/v1/admin/teller/sessions/open opens session (201)
  ✓ PASS: 5. Session status is OPEN
  ✓ PASS: 5. Opening float recorded on session row = 500.00
  ✓ PASS: 5. Authoritative opened_by resolved from JWT identity
  ✓ PASS: 5. Zero movements created for opening float (C2/C3 invariant)
  ✓ PASS: 5. Zero accounting vouchers created for opening float
  ✓ PASS: 6. Duplicate session open on same active teller rejected with 409
  ✓ PASS: 6. Error code is ACTIVE_SESSION_EXISTS
  ✓ PASS: 7. POST /api/v1/admin/teller/sessions/:id/close succeeds (200)
  ✓ PASS: 7. Session status is CLOSING
  ✓ PASS: 7. Authoritative closing_count recorded
  ✓ PASS: 7. Authoritative expected_cash computed = 500.00
  ✓ PASS: 7. Authoritative variance computed = -20.00 (closing_count - expected)
  ✓ PASS: 8. POST /api/v1/admin/teller/sessions/:id/verify succeeds (200)
  ✓ PASS: 8. Session status is PENDING_VERIFICATION
  ✓ PASS: 8. verified_by resolved authoritatively from supervisor identity
  ✓ PASS: 8. No accounting voucher created at verification stage (C3 invariant)
  ✓ PASS: 9. Closing an already verified session rejected with 409

[3/8] Testing Settlement Accounting & Shortage (Requirements 10-11, 16-19)...
  ✓ PASS: 16a. Settlement without TELLER.SETTLE rejected with 403
  ✓ PASS: 16a. RBAC error is FORBIDDEN
  ✓ PASS: 16b. Opener self-settlement rejected with 403
  ✓ PASS: 16b. Domain SoD error is SOD_VIOLATION
  ✓ PASS: 16c. Verifier self-settlement rejected with 403
  ✓ PASS: 16c. Domain SoD error is SOD_VIOLATION
  ✓ PASS: 18a. GET prepare-settlement preview returns 200
  ✓ PASS: 18a. Preview identifies voucher_required = true for non-zero variance
  ✓ PASS: 18a. Preview proposes Dr 5296 for shortage
  ✓ PASS: 18a. Preview proposes Cr 1111 for shortage
  ✓ PASS: 10. POST settle session with shortage succeeds (200)
  ✓ PASS: 10. Session status transitioned to SETTLED
  ✓ PASS: 10. wasAlreadySettled === false
  ✓ PASS: 10. settlement_voucher_id is populated
  ✓ PASS: 10. Settlement voucher reached POSTED state in GL
  ✓ PASS: 10. Voucher reference_type === TELLER_SESSION
  ✓ PASS: 10. Voucher reference_id matches session ID
  ✓ PASS: 11. Shortage created exactly 2 balanced journal lines
  ✓ PASS: 11. Shortage Dr 5296 Cash Over/Short = 20.00
  ✓ PASS: 11. Shortage Cr 1111 Cash in Hand = 20.00
  ✓ PASS: 11. Journal lines retain branch dimension

[4/8] Testing Settlement Accounting & Excess (Requirements 12-13)...
  ✓ PASS: 12. POST settle session with excess succeeds (200)
  ✓ PASS: 12. Excess generated settlement_voucher_id
  ✓ PASS: 13. Excess created exactly 2 balanced journal lines
  ✓ PASS: 13. Excess Dr 1111 Cash in Hand = 50.00
  ✓ PASS: 13. Excess Cr 5296 Cash Over/Short = 50.00

[5/8] Testing Zero Variance Settlement (Requirements 14-15)...
  ✓ PASS: 15. Zero variance settles successfully (200)
  ✓ PASS: 15. Zero variance status transitioned to SETTLED
  ✓ PASS: 14. Zero variance settlement_voucher_id IS NULL
  ✓ PASS: 14. Zero variance created NO accounting voucher

[6/8] Testing Idempotency & Unverified Rejection (Requirements 17, 20-23)...
  ✓ PASS: 20. Repeated settlement returns 200 with controlled result
  ✓ PASS: 20. wasAlreadySettled === true
  ✓ PASS: 20. Returns existing settlement_voucher_id
  ✓ PASS: 21-23. Repeated settlement created NO duplicate voucher/journal
  ✓ PASS: 17. Unverified session settlement rejected (409/422)

[7/8] Testing Atomicity & Failure Injection (Requirements 24-27, Section 25)...
  ✓ PASS: 24. Injected failure thrown as expected
  ✓ PASS: 24. Failure injection executed and caught
  ✓ PASS: 24. Session remains PENDING_VERIFICATION after posting crash
  ✓ PASS: 24. settlement_voucher_id remains NULL after posting crash
  ✓ PASS: 24. Zero partial vouchers persisted during crash (atomicity rollback verified)
  ✓ PASS: 25. Injected session update failure thrown
  ✓ PASS: 25. Session finalization failure executed and caught
  ✓ PASS: 25. Draft voucher rolled back when session finalization failed
  ✓ PASS: 26. Clean retry after rollback succeeds (200)
  ✓ PASS: 26. Retry session reaches SETTLED
  ✓ PASS: 26. Retry generates valid settlement voucher
  ✓ PASS: 27. Voucher and session state are in perfect lockstep (POSTED & SETTLED)

[8/8] Testing Security & Movements (Requirements 28-34)...
  ✓ PASS: 28. Unauthenticated request rejected with 401
  ✓ PASS: 29. Cross-branch session access rejected with 403
  ✓ PASS: 30. Missing TELLER.VIEW rejected with 403
  ✓ PASS: 31. Bound session opened
  ✓ PASS: 31. Client-supplied opened_by was completely ignored; server identity enforced
  ✓ PASS: 32. Manual movement recorded (201)
  ✓ PASS: 32. Movement amount = 25.00
  ✓ PASS: 32. Movement type is ADJUSTMENT (canonical C2/C3 schema)
  ✓ PASS: 32. Movement source_type is MANUAL
  ✓ PASS: 33. Movement on SETTLED session rejected with 409
  ✓ PASS: 34. Client attempt to forge source_type=ORDER rejected with 403

[Teardown] Performing topological teardown of test fixtures...
✓ Teardown complete. Auditing restored PostgreSQL baseline...
  ✓ PASS: Restored account_count === 100 (actual: 100)
  ✓ PASS: Restored voucher_count === 3 (actual: 3)
  ✓ PASS: Restored entry_count === 2 (actual: 2)
  ✓ PASS: Restored line_count === 4 (actual: 4)
  ✓ PASS: Restored teller_count === 0 (actual: 0)
  ✓ PASS: Restored session_count === 0 (actual: 0)
  ✓ PASS: Restored movement_count === 0 (actual: 0)

=============================================================================
Phase C4.1 Test Summary: 99 Passed, 0 Failed
=============================================================================
```

### B. Independent PostgreSQL Baseline Verification
PostgreSQL was queried completely independently using `scratch/inspect_c41_state.js`:
```json
{
  "account_count": "100",
  "voucher_count": "3",
  "entry_count": "2",
  "line_count": "4",
  "bank_count": "0",
  "teller_count": "0",
  "session_count": "0",
  "movement_count": "0",
  "c41_user_count": "0"
}
```
All auxiliary tables verified:
- `bank_account`: 0
- `company`: 0
- `gst_registration`: 0
- Active vouchers: Exactly the 3 pre-C4.1 baseline vouchers (`vch_00MUR0XE3ZO3XU1M`, `vch_00MUR19MJGEZP9JC`, `vch_00MUR1BRX9F9X7J8`).

### C. TypeScript Compiler Check
```powershell
npx tsc --noEmit
```
**Exit Code:** 0 (0 errors, 0 warnings).

---

## 5. Architectural Integrity Invariants Preserved
1. **Foreign Key Integrity:** `teller_session_settlement_voucher_id_fkey` remains unchanged, protected, and fully enforced.
2. **PostgreSQL Schema Stability:** No `CASCADE`, no schema alterations, no fake movement types (`MANUAL_ADJUSTMENT` was not added).
3. **Core Accounting Invariants:** Balanced GL entries for shortage (Dr 5296 / Cr 1111) and excess (Dr 1111 / Cr 5296), zero variance with NULL voucher, start-date/period guards, and row-level concurrency locking are verified and intact.
4. **Zero Test Data Leakage:** Database restored to exact pre-C4.1 state.
