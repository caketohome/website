# CakeToHome ERP — Phase C3 Checkpoint: Teller & Session Domain Services + Repositories

**Date**: 2026-10-04  
**Status**: ✅ COMPLETE & FULLY VERIFIED (100% Passing Tests, Zero Data Leakage)  
**Authoritative Scope**: Phase C3: Teller & Session Domain Services + Repositories  
**Preceding Checkpoints**:
- Phase B Checkpoint: [`phase-b-bank-account-master.md`](file:///e:/vig/cakes2home-main/cakes2home-main/CHECKPOINTS/phase-b-bank-account-master.md)
- Phase C2 Checkpoint: [`phase-c2-schema-definition.md`](file:///e:/vig/cakes2home-main/cakes2home-main/CHECKPOINTS/phase-c2-schema-definition.md)  
**Source Code Implemented**:
- [`frontend/src/lib/types/teller.types.ts`](file:///e:/vig/cakes2home-main/cakes2home-main/frontend/src/lib/types/teller.types.ts)
- [`frontend/src/lib/types/accounting.types.ts`](file:///e:/vig/cakes2home-main/cakes2home-main/frontend/src/lib/types/accounting.types.ts) (Re-exports)
- [`frontend/src/lib/repositories/teller.repository.ts`](file:///e:/vig/cakes2home-main/cakes2home-main/frontend/src/lib/repositories/teller.repository.ts)
- [`frontend/src/lib/repositories/teller-session.repository.ts`](file:///e:/vig/cakes2home-main/cakes2home-main/frontend/src/lib/repositories/teller-session.repository.ts)
- [`frontend/src/lib/repositories/teller-movement.repository.ts`](file:///e:/vig/cakes2home-main/cakes2home-main/frontend/src/lib/repositories/teller-movement.repository.ts)
- [`frontend/src/lib/repositories/index.ts`](file:///e:/vig/cakes2home-main/cakes2home-main/frontend/src/lib/repositories/index.ts)
- [`frontend/src/lib/services/teller.service.ts`](file:///e:/vig/cakes2home-main/cakes2home-main/frontend/src/lib/services/teller.service.ts)
- [`frontend/src/lib/services/teller-session.service.ts`](file:///e:/vig/cakes2home-main/cakes2home-main/frontend/src/lib/services/teller-session.service.ts)
- [`frontend/src/lib/services/teller-movement.service.ts`](file:///e:/vig/cakes2home-main/cakes2home-main/frontend/src/lib/services/teller-movement.service.ts)
- [`frontend/src/lib/services/index.ts`](file:///e:/vig/cakes2home-main/cakes2home-main/frontend/src/lib/services/index.ts)  
**Test Suite**: [`frontend/scratch/test_phase_c3_domain_services.js`](file:///e:/vig/cakes2home-main/cakes2home-main/frontend/scratch/test_phase_c3_domain_services.js) (43/43 PASS across 7 Test Sections)  
**Baseline Verification**: [`frontend/scratch/verify_c2_baseline.js`](file:///e:/vig/cakes2home-main/cakes2home-main/frontend/scratch/verify_c2_baseline.js) (Clean baseline confirmed)  
**TypeScript Typecheck**: 0 Errors (`npx tsc --noEmit` exited code 0)  

---

## 1. Executive Summary

Phase C3 implements the complete domain and repository layers for retail cash counter management, teller shift lifecycle, cash custody tracking, and shift settlement boundaries in CakeToHome ERP. 

All operations execute strictly against the locked Phase C2 schema and enforce the financial invariants, multi-tenant branch constraints, segregation of duties (SoD), and ledger immutability established in Phases B and C2.

### Strict Scope Compliance:
1. **Domain Layer Only**: Implemented repositories and services exclusively. No public API routes, Next.js page routes, or UI components were created.
2. **Settlement Accounting Isolation**: Settlement accounting is maintained strictly at an orchestration preflight boundary (`prepareSettlement()`). Ordinary cash movements do not post to the general ledger, and no journal lines are posted to account `5296` during shift operations.
3. **Pristine Ledger Guarantee**: Verification executed in an isolated PostgreSQL transaction that was rolled back cleanly. Zero test rows were persisted to the database.

---

## 2. Architecture & Domain Responsibilities

```
                                  ┌────────────────────────┐
                                  │   Actor / Auth Context │
                                  └───────────┬────────────┘
                                              │
                     ┌────────────────────────┼────────────────────────┐
                     ▼                        ▼                        ▼
           ┌──────────────────┐     ┌──────────────────┐     ┌──────────────────┐
           │  TellerService   │     │TellerSessionSvc  │     │TellerMovementSvc │
           └─────────┬────────┘     └─────────┬────────┘     └─────────┬────────┘
                     │                        │                        │
                     ▼                        ▼                        ▼
           ┌──────────────────┐     ┌──────────────────┐     ┌──────────────────┐
           │ TellerRepository │     │TellerSessionRepo │     │TellerMovementRepo│
           └─────────┬────────┘     └─────────┬────────┘     └─────────┬────────┘
                     │                        │                        │
                     └────────────────────────┼────────────────────────┘
                                              │
                                              ▼
                                 ┌────────────────────────┐
                                 │ PostgreSQL C2 Schema   │
                                 │ - teller               │
                                 │ - teller_session       │
                                 │ - teller_movement      │
                                 │ - accounting_account   │
                                 └────────────────────────┘
```

### 2.1 Component Overview

| Component | File Path | Core Responsibilities |
|---|---|---|
| **`TellerRepository`** | [`teller.repository.ts`](file:///e:/vig/cakes2home-main/cakes2home-main/frontend/src/lib/repositories/teller.repository.ts) | Row-level data access for `public.teller`, supports `FOR UPDATE` pessimistic locking, branch scoping, active user uniqueness queries. |
| **`TellerSessionRepository`** | [`teller-session.repository.ts`](file:///e:/vig/cakes2home-main/cakes2home-main/frontend/src/lib/repositories/teller-session.repository.ts) | State-aware queries for `public.teller_session`, supports `FOR UPDATE` locking, active session detection per teller, closing/verification/cancellation mutations. |
| **`TellerMovementRepository`** | [`teller-movement.repository.ts`](file:///e:/vig/cakes2home-main/cakes2home-main/frontend/src/lib/repositories/teller-movement.repository.ts) | Append-only ledger access for `public.teller_movement`, aggregate queries for `IN`/`OUT` custody sums, source lookup for idempotency. |
| **`TellerService`** | [`teller.service.ts`](file:///e:/vig/cakes2home-main/cakes2home-main/frontend/src/lib/services/teller.service.ts) | Manages counter creation, activation, deactivation, and assignment. Enforces company-wide active user uniqueness and branch code scoping. |
| **`TellerSessionService`** | [`teller-session.service.ts`](file:///e:/vig/cakes2home-main/cakes2home-main/frontend/src/lib/services/teller-session.service.ts) | Orchestrates the shift lifecycle (`OPEN -> CLOSING -> PENDING_VERIFICATION -> SETTLED`), enforces 3-tier SoD, computes expected cash from the movement ledger, and prepares settlement vouchers. |
| **`TellerMovementService`** | [`teller-movement.service.ts`](file:///e:/vig/cakes2home-main/cakes2home-main/frontend/src/lib/services/teller-movement.service.ts) | Records physical cash movements. Provides source-idempotent projections for operational events (`CASH_SALE`, `COD_HANDOVER`, `CUSTOMER_REFUND`, `BANK_DEPOSIT`, `EXPENSE_PAYMENT`) and controlled manual adjustments. |

---

## 3. Session Lifecycle & State Machine

```
  ┌──────────────┐
  │    (None)    │
  └──────┬───────┘
         │ openSession() [Opener: Staff with TELLER.SESSION_OPEN]
         ▼
  ┌──────────────┐
  │     OPEN     │◄─── Cash Movements / Projections / Adjustments
  └──────┬───────┘
         │ closeSession() [Opener or Supervisor with TELLER.SESSION_CLOSE]
         ▼
  ┌──────────────┐
  │   CLOSING    │  (Physical cash counted, variance computed)
  └──────┬───────┘
         │ verifySession() [Supervisor: verified_by != opened_by]
         ▼
  ┌──────────────────────┐
  │ PENDING_VERIFICATION │
  └──────┬───────────────┘
         │ prepareSettlement() [Accountant: settled_by != opened_by & != verified_by]
         ▼
  ┌──────────────┐
  │   SETTLED    │  (Immutable in PostgreSQL; voucher generated if variance != 0)
  └──────────────┘
```

### State Transition Invariants:
1. **`OPEN -> CLOSING`**:
   - Only permitted if session status is currently `OPEN`.
   - Requires cash count input.
   - Calculates `expected_cash` dynamically from `opening_float + SUM(IN) - SUM(OUT)`.
   - Stores `variance = closing_count - expected_cash`.
2. **`CLOSING -> PENDING_VERIFICATION`**:
   - Only permitted if session status is currently `CLOSING`.
   - Enforces **Segregation of Duties**: `verified_by !== opened_by`. Session opener cannot verify their own cash count.
3. **`PENDING_VERIFICATION -> SETTLED`**:
   - Only permitted if session status is currently `PENDING_VERIFICATION`.
   - Enforces **Three-Tier Segregation of Duties**: `settled_by !== opened_by` AND `settled_by !== verified_by`.
   - If `variance == 0.00`: Settlement voucher is NOT generated (`settlement_voucher_id = NULL`).
   - If `variance != 0.00`: Settlement voucher preflight generates balanced double-entry lines (`5296 Dr / 1111 Cr` for shortage, `1111 Dr / 5296 Cr` for excess).
4. **Immutability Post-Close / Settle**:
   - Once a session is `SETTLED` or `CANCELLED`, PostgreSQL database triggers permanently prevent any further movement insertion or session attribute modifications.

---

## 4. Custody Ledger & Expected Cash Calculation

The teller drawer balance is **never** derived from mutable sales records. It is computed deterministically from the immutable `public.teller_movement` custody ledger:

$$\text{Expected Cash} = \text{Opening Float} + \sum \text{IN Movements} - \sum \text{OUT Movements}$$

### Movement Ledger Types:
| Movement Type | Direction | Triggering Source | Financial GL Impact (Separate Layer) |
|---|---|---|---|
| `OPENING_FLOAT` | `IN` | Session Open | Cash transferred to drawer float |
| `CASH_SALE` | `IN` | Retail POS Order Completion | Cash collected from customer |
| `COD_HANDOVER` | `IN` | Rider COD Remittance | Driver shift settlement handover |
| `CUSTOMER_REFUND` | `OUT` | Store Cash Refund | Cash returned to customer |
| `EXPENSE_PAYMENT` | `OUT` | Verified Petty Cash Expense | Branch operational cash outflow |
| `BANK_DEPOSIT` | `OUT` | Bank Deposit Slip Dispatch | Cash in transit to company bank |
| `ADJUSTMENT` | `IN` / `OUT` | Controlled Manual Correction | Manager cash drawer adjustment |

### Projection Idempotency:
Every system-derived movement enforces partial unique indexing on `(source_type, source_id)`. `TellerMovementService.projectSystemMovement` performs a preflight check on `findBySource(sourceType, sourceId)`. If an entry already exists, it returns `{ movement: existing, wasDuplicate: true }` without duplicating rows or throwing unhandled errors.

---

## 5. Settlement Preparation Boundary (`prepareSettlement`)

In accordance with strict ERP separation of concerns, the settlement accounting posting engine is decoupled from ordinary teller shift operations:

```typescript
// Shortage Example (Variance: -20.00)
{
  sessionId: "...",
  status: "PENDING_VERIFICATION",
  expectedCash: 1950.00,
  closingCount: 1930.00,
  variance: -20.00,
  voucherRequired: true,
  journalEntries: [
    {
      accountCode: "5296", // Cash Over / Short (Operating Expense)
      debit: 20.00,
      credit: 0.00,
      description: "Cash shortage on teller session settlement ..."
    },
    {
      accountCode: "1111", // Cash in Hand (Asset)
      debit: 0.00,
      credit: 20.00,
      description: "Cash shortage reduction to physical drawer ..."
    }
  ]
}

// Zero-Variance Example (Variance: 0.00)
{
  sessionId: "...",
  status: "PENDING_VERIFICATION",
  expectedCash: 1500.00,
  closingCount: 1500.00,
  variance: 0.00,
  voucherRequired: false,
  journalEntries: []
}
```

---

## 6. Verification & Test Evidence

### 6.1 Test Suite Results
Executed via [`frontend/scratch/test_phase_c3_domain_services.js`](file:///e:/vig/cakes2home-main/cakes2home-main/frontend/scratch/test_phase_c3_domain_services.js):

```
─── PART 1: TELLER DOMAIN SERVICE TESTS ───
✅ [PASS] Test 1: Create active teller station
✅ [PASS] Test 2: Duplicate active teller assignment for user rejected (TELLER_DUPLICATE_ACTIVE_USER)
✅ [PASS] Test 3: Historical inactive teller assignment allowed for user
✅ [PASS] Test 4: Cross-branch active assignment rejected company-wide
✅ [PASS] Test 5: Inactive teller cannot open session (TELLER_INACTIVE)

─── PART 2: TELLER SESSION LIFECYCLE & EXPECTED CASH ───
✅ [PASS] Test 6: Open session succeeds with OPEN status
✅ [PASS] Test 7: Second open session on same teller rejected (ACTIVE_SESSION_EXISTS)
✅ [PASS] Test 8: Opening float persists with exact numeric value (1500.00)
✅ [PASS] Test 9: Expected cash initially equals opening float (1500.00)
✅ [PASS] Test 9b: calculateExpectedCash returns 1500.00 before movements

─── PART 3: CASH CUSTODY MOVEMENTS & SYSTEM PROJECTIONS ───
✅ [PASS] Test 16: Cash sale projection recorded (IN / CASH_SALE / 450.00)
✅ [PASS] Test 17: COD handover projection recorded (IN / COD_HANDOVER / 800.00)
✅ [PASS] Test 18: Customer refund projection recorded (OUT / CUSTOMER_REFUND / 150.00)
✅ [PASS] Test 19: Bank deposit dispatch projection recorded (OUT / BANK_DEPOSIT / 600.00)
✅ [PASS] Test 20: Expense payment projection recorded (OUT / EXPENSE_PAYMENT / 75.00)
✅ [PASS] Test 21: Controlled manual adjustment recorded (IN / ADJUSTMENT / 25.00)
✅ [PASS] Test 22: Duplicate source projection returns existing movement with wasDuplicate: true
✅ [PASS] Test 10a: Expected cash calculated correctly from movement ledger (1950.00)

─── PART 4: SESSION CLOSE, VERIFY & SETTLEMENT PREPARATION ───
✅ [PASS] Test 10: Close transitions session to CLOSING
✅ [PASS] Test 10b: Closed session stores expected_cash = 1950.00
✅ [PASS] Test 10c: Closed session stores closing_count = 1930.00
✅ [PASS] Test 11: Variance calculated correctly (-20.00)
✅ [PASS] Test 12: Double close rejected (CONCURRENT_STATE_TRANSITION)
✅ [PASS] Test 13: Self-verification by session opener rejected (SOD_VIOLATION)
✅ [PASS] Test 14: Verification transitions to PENDING_VERIFICATION
✅ [PASS] Test 14b: Verified by supervisor recorded
✅ [PASS] Test 35a: Settlement prep recognizes voucher_required: true for variance -20.00
✅ [PASS] Test 35b: Shortage maps Debit to 5296 (Cash Over / Short)
✅ [PASS] Test 35c: Shortage maps Credit to 1111 (Cash in Hand)
✅ [PASS] Test 35d: Shortage entry amount is 20.00
✅ [PASS] Test 29a: Settlement by opener rejected (SOD_VIOLATION)
✅ [PASS] Test 29b: Settlement by count verifier rejected (SOD_VIOLATION)

─── PART 5: IMMUTABILITY & NEGATIVE BOUNDARY TESTS ───
✅ [PASS] Test 36: Zero-variance settlement prep has voucher_required: false and no GL entry
✅ [PASS] Test 23: Cash movement after settlement rejected (SESSION_ALREADY_SETTLED)
✅ [PASS] Test 24: Cash movement after cancellation rejected (INVALID_SESSION_STATE)

─── PART 6: SECURITY & AUTHORIZATION TESTS ───
✅ [PASS] Test 25: Foreign branch access rejected (UNAUTHORIZED_BRANCH)
✅ [PASS] Test 26: Operation without TELLER.MANAGE rejected (PERMISSION_DENIED)
✅ [PASS] Test 27: Forged teller identity rejected (PERMISSION_DENIED)

─── PART 7: ACCOUNTING INTEGRITY & ZERO GL DUPLICATION ───
✅ [PASS] Test 30: Zero accounting vouchers created by teller projections (3 === 3)
✅ [PASS] Test 31: Existing COD voucher count unchanged
✅ [PASS] Test 32: Existing refund voucher behavior unchanged
✅ [PASS] Test 33: Existing deposit voucher behavior unchanged
✅ [PASS] Test 34: Zero journal lines posted to 5296 during ordinary movement creation

==================================================
Total Assertions Passed: 43
Total Assertions Failed: 0
==================================================
```

### 6.2 Baseline Data Integrity
Verified via [`frontend/scratch/verify_c2_baseline.js`](file:///e:/vig/cakes2home-main/cakes2home-main/frontend/scratch/verify_c2_baseline.js):
- `accounting_account`: 100 (exactly 99 baseline + 1 new 5296)
- `accounting_voucher`: 3 (unchanged)
- `accounting_journal_entry`: 2 (unchanged)
- `accounting_journal_line`: 4 (unchanged)
- `bank_account`: 0 (unchanged)
- `teller`: 0 (pristine, 0 test rows persisted)
- `teller_session`: 0 (pristine, 0 test rows persisted)
- `teller_movement`: 0 (pristine, 0 test rows persisted)

### 6.3 Static Typecheck
- Command: `npx tsc --noEmit`
- Result: **0 Errors** (exit code 0).

---

## 7. Next Step: Phase C4 Gate

Phase C3 is **100% COMPLETE AND AUTHORIZED TO ADVANCE**.

The next bounded phase is **Phase C4: Teller API Routes, Settlement Posting Orchestration & UI Workspaces**.
- Bounded scope for C4:
  1. Internal/admin API route endpoints for teller counters, sessions, movements, and settlements.
  2. Transactional settlement posting engine consuming `prepareSettlement()` to create real accounting vouchers when variance is non-zero.
  3. Teller POS / Cash drawer operator interface.
  4. Supervisor verification and manager settlement UI.
- **MANDATORY STOP CONDITION**:
  No API routes, UI components, or settlement posting engines have been implemented in Phase C3. All changes are contained within the domain layer and repositories.
