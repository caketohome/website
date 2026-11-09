# Phase C6.2 Checkpoint — ManualJournalService Domain Logic & Workflow Engine

**Status**: 🔒 COMPLETE & FROZEN  
**Date**: 2026-10-05  
**Bounded Step**: C6.2 — `ManualJournalService` Domain Logic & Workflow Engine  
**Prior Step**: C6.1 — Manual Journal Schema & Domain Persistence Layer (🔒 Accepted & Frozen)  
**Next Step**: C6.3 — Manual Journal API Routes & RBAC/SoD (Awaiting User Authorization)

---

## 1. Executive Summary

Phase C6.2 implements the domain service `ManualJournalService` that orchestrates the pre-built C6.1 persistence layer through the locked Manual Journal lifecycle. The implementation strictly adheres to the bounded objective without touching API routes or frontend UI.

All domain rules, Segregation of Duties (SoD), double-entry invariants, party dimensions, INR-only enforcement, accounting start date, fiscal period checks, and compensating reversal orchestration are validated with 100% pass across domain tests and all regression suites.

---

## 2. Implemented Architecture & Domain Methods

### Source File: `src/lib/services/manual-journal.service.ts`

| Method | Lifecycle State | Key Domain Invariants Enforced |
|---|---|---|
| `createDraft` | `-> DRAFT` | Authoritative leaf-account validation (`is_group = false`), AR party dimension (`customer_id` on 1121/1122), AP party dimension (`supplier_id` on 2111), party dimension clearance on unrelated accounts, INR-only base currency, accounting start date guard, open fiscal period guard, double-entry balance validation, and idempotency guard (`DUPLICATE_SOURCE_EVENT`). |
| `updateDraft` | `DRAFT -> DRAFT` | Mutation guard: strictly blocked once voucher leaves `DRAFT` status (`INVALID_VOUCHER_STATE`). Revalidates all changed lines and recalculates `total_amount`. |
| `submitDraft` | `DRAFT -> SUBMITTED` | Preserves maker identity (`created_by`), sets `submitted_by` and audit timestamp `submitted_at`. |
| `approveDraft` | `SUBMITTED -> APPROVED` | Strict Segregation of Duties: checker must differ from creator (`maker !== checker`). No Super Admin bypass. Preserves proposed lines exactly. |
| `postToGL` | `APPROVED -> POSTED` | Poster SoD check (`maker !== poster`). Invokes canonical `PostingService.postVoucher` inside atomic PostgreSQL transaction with row-level locking. Revalidates open fiscal period and accounting start date. Atomically converts `metadata.lines` into authoritative `accounting_journal_line` records. Preserves deferred balance trigger. Idempotent (`VOUCHER_ALREADY_POSTED`). |
| `cancel` | `DRAFT / SUBMITTED / APPROVED -> CANCELLED` | Only pre-posted vouchers may be cancelled. Strictly prohibits cancelling `POSTED` vouchers (`INVALID_VOUCHER_STATE`). Preserves audit trail (`cancelled_by`, `cancelled_at`). |
| `reverse` | `POSTED -> REVERSED` | Compensating reversal engine: checks SoD (`reverser !== creator`), validates open fiscal period, inverts Dr/Cr lines, sets `reference_type = 'MANUAL_REVERSAL'`, establishes bidirectional links (`reversal_of_voucher_id` and `reversed_by_voucher_id`), marks original entry `is_reversed = true`. Strictly blocks double reversal and reversal-of-reversal (`REVERSAL_VIOLATION`). |
| `getDetail` | Read-only | Returns enriched proposed lines with Chart of Accounts metadata, loads authoritative `accounting_journal_line` rows when POSTED, and resolves linked reversal voucher. |
| `list` | Read-only | Server-paginated query supporting branch, status, search, and date filters with line counts. |

---

## 3. Strict Domain Error Contracts (`ManualJournalDomainError`)

Deterministic error codes mapped for clean API/RBAC consumption in Phase C6.3:
- `GROUP_ACCOUNT_NOT_POSTABLE`: Group accounts cannot be directly posted.
- `POSTING_ACCOUNT_INVALID`: Account not found or inactive in Chart of Accounts.
- `PARTY_DIMENSION_INVALID`: Invalid or mismatched party dimension (e.g. supplier on AR, customer on AP, non-existent entity).
- `POSTING_BEFORE_ACCOUNTING_START_DATE`: Voucher date precedes system accounting start date.
- `FISCAL_PERIOD_NOT_CONFIGURED` / `FISCAL_PERIOD_LOCKED`: Voucher date in unconfigured or locked fiscal period.
- `JOURNAL_UNBALANCED`: Total debits != total credits, or single-sided line violation.
- `DUPLICATE_SOURCE_EVENT`: Idempotency key already assigned to an active journal voucher.
- `INVALID_VOUCHER_STATE`: Illegal lifecycle transition (e.g. editing non-draft, cancelling posted voucher).
- `SEGREGATION_OF_DUTIES_VIOLATION`: Maker attempted self-approval, self-posting, or self-reversal.
- `VOUCHER_ALREADY_POSTED`: Double-posting attempt blocked.
- `REVERSAL_VIOLATION`: Attempting to reverse an unposted voucher, double-reversing, or reversing a reversal voucher.
- `VOUCHER_NOT_FOUND`: Voucher ID not found in database.

---

## 4. Verification Evidence & Quality Gate

### 1. C6.2 Domain Test Suite (`scratch/test_c6_2_domain_service.js`)
- **Result**: **88 Passed, 0 Failed (100%)**
- Verifications covered:
  1. Draft creation orchestration (JOURNAL, DRAFT, INR, total_amount, created_by).
  2. Group account rejection (`GROUP_ACCOUNT_NOT_POSTABLE`).
  3. Non-existent account rejection (`POSTING_ACCOUNT_INVALID`).
  4. AR party dimension validation (`customer_id` on 1121/1122, bad customer rejected, supplier on AR rejected).
  5. AP party dimension validation (`supplier_id` on 2111, customer on AP rejected).
  6. Party dimension clearance on unrelated accounts (cleared on 5110/1111 per Rule 5).
  7. Accounting start date guard (`POSTING_BEFORE_ACCOUNTING_START_DATE`).
  8. Open fiscal period guard (`FISCAL_PERIOD_NOT_CONFIGURED`).
  9. Double-entry balance validation (`JOURNAL_UNBALANCED`).
  10. Idempotency guard (`DUPLICATE_SOURCE_EVENT`).
  11. Draft update in DRAFT status (narration, amount, lines updated).
  12. Submit draft (`DRAFT` -> `SUBMITTED`, audit timestamps).
  13. Mutation guard (editing SUBMITTED voucher strictly rejected).
  14. Approve & Segregation of Duties (`maker !== checker`, no bypass).
  15. Post to General Ledger (`maker !== poster`, `PostingService.postVoucher`, authoritative lines created in `accounting_journal_line`, exact ₹800 Dr/Cr balance).
  16. Duplicate posting protection (`VOUCHER_ALREADY_POSTED`).
  17. Cancellation lifecycle (`DRAFT -> CANCELLED`, cancelling POSTED voucher rejected).
  18. Reversal orchestration (compensating voucher POSTED, inverted Dr/Cr, bidirectional linkage, `is_reversed = true`, creator cannot reverse).
  19. Double reversal protection & reversal-of-reversal prevention (`REVERSAL_VIOLATION`).
  20. Detail & list retrieval (enriched lines, line counts, search/filter).

### 2. Full Regression Suites
- **C6.1 Persistence Regression** (`scratch/test_c6_1_persistence.js`): **51/51 PASSED (100%)**
- **C5 Expense Accounting Regression** (`scratch/test_c5_expense_accounting.js`): **40/40 PASSED (100%)**
- **C4.1 Settlement Regression** (`scratch/test_phase_c4_1_api_settlement.js`): **99/99 PASSED (100%)**

### 3. TypeScript Type-Check
- **Command**: `node ./node_modules/typescript/bin/tsc --noEmit`
- **Output**: **0 errors across the entire codebase**

### 4. Independent PostgreSQL Database Safety Audit
- **Active CoA Accounts**: **100** (clean baseline maintained)
- **Orphan Journal Lines**: **0**
- **Orphan Journal Entries**: **0**
- **Lingering C6 Test Vouchers**: **0**
- **Lingering C6 Test Suppliers**: **0**
- **Trial Balance Zero-Sum Integrity**: **Total Debits ₹3,380.00 === Total Credits ₹3,380.00 (Imbalance ₹0.0000)**
- **Active DB Locks**: **0**

### 5. Dev Server Health
- **URL**: `http://127.0.0.1:3000`
- **Status**: **HTTP 200 OK**

---

## 5. Scope & Boundary Adherence

- Strictly zero modifications to API routes or frontend UI.
- Base currency strictly `INR` (no foreign currency, no FX tables).
- Strongly typed party dimensions only (`customer_id` for AR, `supplier_id` for AP).
- Zero Git commits or pushes.
- Implementation STOP applied at C6.2. Ready for C6.3 authorization.
