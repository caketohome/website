# Phase C6.3 Checkpoint — Manual Journal API Routes, RBAC, Branch Scoping & SoD Security

**Status**: 🔒 COMPLETE & FROZEN  
**Date**: 2026-10-05  
**Bounded Step**: C6.3 — Manual Journal API Routes, RBAC, Branch Isolation & Segregation of Duties  
**Prior Step**: C6.2 — ManualJournalService Domain Logic & Workflow Engine (🔒 Accepted & Frozen)  
**Next Step**: C6.4 — Manual Journal Management Workspace & Workflow UI (Awaiting User Authorization)

---

## 1. Executive Summary

Phase C6.3 exposed the complete Manual Journal workflow through the unified Next.js API router (`/api/v1/admin/accounting/journals/*`), backed by enterprise-grade authorization controls:
- **Authentication Guard**: JWT session validation rejecting missing or forged tokens with `401 UNAUTHORIZED`.
- **RBAC Permissions**: Granular permission checks (`ACCOUNTING.JOURNAL.VIEW`, `CREATE`, `APPROVE`, `POST`, `CANCEL`, `REVERSE`) returning deterministic `403 FORBIDDEN`.
- **Branch Isolation**: User branch scoping enforced on both mutations and queries, rejecting cross-branch access with `403 BRANCH_ACCESS_DENIED`.
- **Actor Identity Protection**: Server-authoritative resolution from JWT sessions; all client-supplied identity fields (`created_by`, `approved_by`, `posted_by`, `cancelled_by`, `reversed_by`) in request bodies are ignored.
- **Segregation of Duties (SoD)**: Maker cannot self-approve (`409 SEGREGATION_OF_DUTIES_VIOLATION`), maker cannot self-post, creator cannot reverse. Super Admin privileges cannot bypass four-eyes SoD.
- **Compensating Reversal Engine**: Automatic generation of balanced reversing entries with bidirectional voucher linking and audit trail preservation.

The test-runner assertion defect at line 465 was thoroughly investigated, classified, and resolved without altering canonical domain or API contracts. All 11 test suites and 4 prior regressions passed with 100% success. The PostgreSQL database was independently audited and verified pristine.

---

## 2. Line 465 Investigation & Resolution

### Symptom
During test execution of `POST /api/v1/admin/accounting/journals/:id/post`, the test runner crashed at:
```
TypeError: Cannot read properties of undefined (reading 'length')
at test_c6_3_api.js:465:27
```

### Root Cause Analysis (Classification: Category A — Test-Runner Assertion Defect)
- **API Response Contract**: Conforming strictly to `PostManualJournalResult`:
  ```typescript
  export interface PostManualJournalResult {
    voucher: AccountingVoucherRow;
    journal_entry: AccountingJournalEntryRow & {
      lines: AccountingJournalLineRow[];
    };
  }
  ```
  The endpoint returns `{ success: true, data: { voucher, journal_entry } }`, where GL lines reside inside `data.journal_entry.lines`.
- **Test Assertion Flaw**: The test at line 465 improperly asserted `postData.lines.length === 2` instead of `postData.journal_entry.lines.length === 2` (confusing it with `ManualJournalDetailResult` where lines appear as top-level `posted_lines`).
- **Defect Resolution**: Corrected the test assertion in `test_c6_3_api.js`:
  ```javascript
  // Line 465 before:
  assert(postData.lines.length === 2, "2 authoritative journal lines created");

  // Line 465 after:
  assert(postData.journal_entry.lines.length === 2, "2 authoritative journal lines created");
  ```
  The production API implementation and domain service were confirmed to be 100% architecturally compliant and remained completely untouched.

---

## 3. Comprehensive C6.3 Test Verification Results

Suite: `scratch/test_c6_3_api.js`  
Result: **111 Passed, 0 Failed (100%)**

| Test Section | Validated Behaviors | Result |
|---|---|:---:|
| **1. Authentication** | Missing Authorization header → `401`; forged/tampered JWT → `401`. | ✅ PASS |
| **2. Permissions & RBAC** | Unprivileged requests to `/journals`, `/draft`, `/approve`, `/post`, `/cancel`, `/reverse` rejected with `403 FORBIDDEN`. | ✅ PASS |
| **3. Branch Isolation** | Cross-branch draft creation, view, and update rejected with `403 BRANCH_ACCESS_DENIED`. | ✅ PASS |
| **4. Actor Identity Spoofing** | Client body attempting to forge `created_by` ignored; server-extracted JWT identity strictly enforced. | ✅ PASS |
| **5. Draft / Update / List / Detail** | `POST /draft` creates valid draft (201); `PUT /:id` updates narration/amounts (200); `GET /journals` lists with pagination and filters; `GET /:id` returns enriched detail with proposed lines. | ✅ PASS |
| **6. Invalid State & Account Guards** | Non-existent voucher → `404 VOUCHER_NOT_FOUND`; unbalanced lines → `400 JOURNAL_UNBALANCED`; group accounts → `400 GROUP_ACCOUNT_NOT_POSTABLE`; approving draft directly → `409 INVALID_VOUCHER_STATE`. | ✅ PASS |
| **7. Submission & Immutability** | `POST /submit` transitions to `SUBMITTED`; submitted voucher rejects further mutation (`409 INVALID_VOUCHER_STATE`). | ✅ PASS |
| **8. Segregation of Duties (SoD)** | Maker self-approval rejected (`409 SEGREGATION_OF_DUTIES_VIOLATION`); Super Admin self-approval strictly rejected; independent checker succeeds (`APPROVED`); maker self-post rejected. | ✅ PASS |
| **9. Posting to General Ledger** | Independent poster posts voucher (200); status `POSTED`; authoritative `accounting_journal_line` records created with exact Dr/Cr balance; proposed lines remain audit snapshot; duplicate posting blocked (`409 VOUCHER_ALREADY_POSTED`). | ✅ PASS |
| **10. Cancellation Lifecycle** | Draft/Submitted vouchers can be cancelled (`CANCELLED`); cancelling `POSTED` voucher strictly rejected (`409 INVALID_VOUCHER_STATE`); client spoofed `cancelled_by` ignored. | ✅ PASS |
| **11. Reversal Orchestration** | Reversal without reason rejected (`400 VALIDATION_FAILED`); creator self-reversal rejected (`409`); independent controller succeeds (200); compensating voucher created with Dr/Cr inverted; original entry marked `is_reversed = true`; double reversal rejected (`409 REVERSAL_VIOLATION`); reversal-of-reversal rejected (`409`). | ✅ PASS |

---

## 4. Full Regression Suite Results

All predecessor modules were re-executed against the active PostgreSQL database:

| Suite | Description | File | Result |
|---|---|---|:---:|
| **C6.2** | ManualJournalService Domain & Workflow Engine | `scratch/test_c6_2_domain_service.js` | **88 Passed, 0 Failed** ✅ |
| **C6.1** | Manual Journal Schema & Domain Persistence Layer | `scratch/test_c6_1_persistence.js` | **51 Passed, 0 Failed** ✅ |
| **C5** | Expense Accounting & GL Integration Engine | `scratch/test_c5_expense_accounting.js` | **40 Passed, 0 Failed** ✅ |
| **C4.1** | Teller Settlement, Shortage/Excess & Cash Drawers | `scratch/test_phase_c4_1_api_settlement.js` | **99 Passed, 0 Failed** ✅ |

**Total Regression Tests Passed**: **278 assertions across 4 modules (100% success rate)**.

---

## 5. TypeScript Compiler Verification

Command:
```bash
npx tsc --noEmit
```
- **Exit Code**: `0`
- **Errors**: `0`
- **Diagnostics**: Clean compilation across all routes, services, schemas, and types.

---

## 6. Independent PostgreSQL Audit Evidence

Audit Script: `scratch/audit_post_c6_3.js`  
Execution: Independent connection pool query following full test teardowns.

```
==================================================
  INDEPENDENT POSTGRESQL DATABASE AUDIT
==================================================
1. Chart of Accounts count: 100 ✅ (Target: 100)
2. Orphan journal entries: 0 ✅ (Target: 0)
3. Orphan journal lines: 0 ✅ (Target: 0)
4. Lingering C6 test vouchers: 0 ✅ (Target: 0)
5. Lingering C6 test entities:
   - Users: 0 ✅
   - Suppliers: 0 ✅
   - Customers: 0 ✅
6. Accounting vouchers by status:
   - POSTED: 5
   - SUBMITTED: 1
7. Total journal entries: 4
   Total journal lines: 10
8. Active blocked DB locks: 0 ✅ (Target: 0)
9. Trial Balance zero-sum check:
   Total Debits:  ₹3380.00
   Total Credits: ₹3380.00
   Difference:    ₹0.0000 ✅ (Balanced)
==================================================
AUDIT RESULT: ALL POSTGRESQL INVARIANTS SATISFIED ✅
==================================================
```

### Audit Verification Highlights:
1. **Chart of Accounts Baseline**: Exactly 100 accounts preserved. Zero group accounts posted to.
2. **Referential Integrity**: Zero orphan journal entries or lines.
3. **Pristine State Recovery**: All transient C6 test fixtures purged. Zero lingering test vouchers or entities.
4. **Trial Balance Invariant**: Zero-sum double-entry balance preserved at ₹3,380.00 Dr = ₹3,380.00 Cr (difference = ₹0.0000).
5. **No Blocked Locks**: Zero ungranted database locks.

---

## 7. Operational & Security Matrix

| Action | Allowed Roles | SoD Restrictions | Branch Scoping | Identity Source |
|---|---|---|---|---|
| `GET /journals` | `ACCOUNTING.JOURNAL.VIEW` | None | Scoped to user's assigned branch | JWT Session |
| `GET /journals/:id` | `ACCOUNTING.JOURNAL.VIEW` | None | Scoped to voucher's branch | JWT Session |
| `POST /draft` | `ACCOUNTING.JOURNAL.CREATE` | None | Assigned branch | JWT Session (`created_by`) |
| `PUT /:id` | `ACCOUNTING.JOURNAL.CREATE` | Voucher must be in `DRAFT` | Assigned branch | JWT Session |
| `POST /:id/submit` | `ACCOUNTING.JOURNAL.CREATE` | Voucher must be in `DRAFT` | Assigned branch | JWT Session (`submitted_by`) |
| `POST /:id/approve` | `ACCOUNTING.JOURNAL.APPROVE` | **Checker != Maker** (Strict SoD) | Assigned branch | JWT Session (`approved_by`) |
| `POST /:id/post` | `ACCOUNTING.JOURNAL.POST` | **Poster != Maker** (Strict SoD) | Assigned branch | JWT Session (`posted_by`) |
| `POST /:id/cancel` | `ACCOUNTING.JOURNAL.CANCEL` | Only pre-posted vouchers | Assigned branch | JWT Session (`cancelled_by`) |
| `POST /:id/reverse` | `ACCOUNTING.JOURNAL.REVERSE` | **Reverser != Maker** (Strict SoD) | Assigned branch | JWT Session (`reversed_by`) |

---

## 8. Gate Clearance & Next Phase

- **Current Status**: Phase C6.3 is completely verified, hardened, audited, and **FROZEN**.
- **Boundaries Preserved**: No Git commit, no Git push performed.
- **Ready for Next Phase**: C6.4 (Manual Journal Management Workspace & Workflow UI) upon explicit user authorization.
