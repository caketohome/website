# CakeToHome ERP — Phase C7.9 Step 9B & 9C Domain Services & Import Checkpoint
## Corporate Account Master, Employee Roster Lifecycle & Bulk Import Engine

> **Document Status**: 🔒 **STEP C7.9b & C7.9c VERIFIED & AUDITED**  
> **Preservation Baseline**: Group 7 commit `d231cee7e55f716526e62f5799cc7377c555fed3` on `checkpoint/c-phases-baseline`  
> **Date**: 2026-10-12  
> **Execution Mode**: STRICTLY BOUNDED DOMAIN REPOSITORIES & SERVICES — NO UNAPPROVED GL POSTING, NO BILLING MUTATIONS  

---

### 1. Executive Summary

Following recovery of repository state, **Phase C7.9 Step 9B (Domain Repositories & Services)** and **Step 9C (Bulk Employee Roster Import Engine)** have been audited, repaired, executed, and independently verified against the live PostgreSQL development database.

The implementation strictly satisfies all locked business rules and architectural invariants:
- **1:1 Corporate Account ↔ Customer Linkage**: Enforced at schema level and in service logic, with audited Super Admin-only customer linkage.
- **Roster Delegation & Scoped Membership**: Implemented `corporate_account_member` with `ROSTER_MANAGER` and `ROSTER_VIEWER` roles, account-scoped authorization, and fail-closed cross-tenant guards.
- **Employee Lifecycle & Duplicate Prevention**: Strict normalization of `employee_code_key` across all rows (including inactive); re-joining employees must be explicitly reactivated using the existing ID; hard DELETE blocked by `trg_ce_prevent_delete`.
- **Phone Reuse Policy**: Reusing phone numbers across distinct employee codes within an account emits an actionable audit warning without rejecting the employee record.
- **Geographic Coordinates Plausibility**: Validates coordinates within India bounding box (Lat 6°–38°N, Lng 68°–98°E), requires both-or-neither, and defaults `coordinate_verified` to `false` until verified by an authorized admin.
- **Immutable Audit Events**: Lifecycle events logged atomically into `corporate_account_event` and `corporate_employee_event`, with DB triggers `trg_cax_append_only` and `trg_cee_append_only` preventing UPDATE and DELETE.
- **Bulk Roster Import Engine**: Excel workbook generation, dry-run validation with row-level error reporting, replay protection on committed SHA-256 file hashes, and atomic all-or-nothing commits.
- **Credit Isolation**: Step 9b/9c contains zero credit activation or GL posting mutations.

---

### 2. Verification Evidence & Test Execution Results

| Test Suite | Command | Assertions Passed | Exit Code | Status |
|---|---|---|---|---|
| **Step 9B Domain & Repository Suite** | `node frontend/scratch/test_phase_c7_9_step9b_domain.js` | **18 / 18** | `0` | ✅ PASSED |
| **Step 9C Bulk Roster Import Suite** | `node frontend/scratch/test_phase_c7_9_step9c_import.js` | **9 / 9** | `0` | ✅ PASSED |
| **TypeScript Static Compilation** | `npx tsc --noEmit` (in `frontend`) | **0 Errors** | `0` | ✅ CLEAN |
| **Immutability Triggers Regression** | `node frontend/scratch/test_immutability_triggers.js` | **8 / 8** | `0` | ✅ PASSED |
| **Independent PostgreSQL Audit** | `node scratch/independent_postgresql_c7_9a_audit.js` | **All 7 Tables Audited** | `0` | ✅ VERIFIED |

---

### 3. Step 9B Test Scenarios (18/18 Passed)

1. `TEST [1] PASS`: Tax validation enforces GSTIN/PAN regex and cross-character consistency (PAN embedded in GSTIN).
2. `TEST [2] PASS`: Corporate account created with `PENDING` status, primary contact, synced customer, and `CREATED` event.
3. `TEST [3] PASS`: 1:1 customer linkage and active GSTIN uniqueness strictly enforced.
4. `TEST [4] PASS`: Customer linkage restricted strictly to Super Admin with immutable `CUSTOMER_LINKED` audit event.
5. `TEST [5] PASS`: Four-Eyes approval enforced (`creator !== approver`); credit activation strictly isolated.
6. `TEST [6] PASS`: Credit request records metadata and audit event without mutating customer credit limits.
7. `TEST [7] PASS`: Account status lifecycle (`SUSPEND -> REACTIVATE`) enforced with transition rules and events.
8. `TEST [8] PASS`: Contact management enforces exactly one active `PRIMARY` contact per account.
9. `TEST [9] PASS`: Scoped account membership granted by Super Admin with role segregation and duplicate checks.
10. `TEST [10] PASS`: Employee creation normalizes code, validates India bbox coordinates, and defaults to unverified.
11. `TEST [11] PASS`: Phone reuse emits actionable audit warning without rejecting employee record.
12. `TEST [12] PASS`: Active employee code duplicate rejected across case variants.
13. `TEST [13] PASS`: Deactivation preserves history, DB trigger blocks DELETE, and rehire explicitly reactivates same ID.
14. `TEST [14] PASS`: Coordinates verification records verified flag, verifier, and audit event.
15. `TEST [15] PASS`: Security triggers `trg_cax_append_only` and `trg_cee_append_only` strictly block UPDATE and DELETE on audit logs.
16. `TEST [16] PASS`: Import batch replay protection blocks duplicate committed SHA-256 file hashes.
17. `TEST [17] PASS`: Cross-account isolation strictly denies unauthorized cross-tenant queries and mutations.
18. `TEST [18] PASS`: Transaction rollback guarantees zero partial state mutations on validation failure.

---

### 4. Step 9C Test Scenarios (9/9 Passed)

1. `TEST [1] PASS`: Template buffer generated with standard columns, styles, and instructions sheet.
2. `TEST [2] PASS`: Dry-run validation accepts clean workbook, creates `DRY_RUN_OK` batch, with ZERO employee mutations.
3. `TEST [3] PASS`: Row-level diagnostics catch missing fields, invalid types, coordinate errors, and file duplicates.
4. `TEST [4] PASS`: Database duplicate detection rejects active codes and enforces explicit rehire for deactivated codes.
5. `TEST [5] PASS`: Phone reuse emits actionable row warnings without rejecting batch validity.
6. `TEST [6] PASS`: Atomic commit inserts all valid employees, logs `CREATED` and `IMPORTED` events, and marks batch `COMMITTED`.
7. `TEST [7] PASS`: Committed SHA-256 file hash protects account against duplicate batch replay.
8. `TEST [8] PASS`: Commit of invalid batch fails closed with zero employee mutations.
9. `TEST [9] PASS`: Cross-account roster import authorization strictly fails closed.

---

### 5. Independent PostgreSQL Invariant Audit

The live PostgreSQL development database was audited independently following all test executions:

```
┌───────────────────────────────────────┬───────────────────┬────────────────────┬───────────┐
│ Metric / Entity                       │ Locked Baseline   │ Observed Live DB   │ Status    │
├───────────────────────────────────────┼───────────────────┼────────────────────┼───────────┤
│ Chart of Accounts Account Count       │ 100 accounts      │ 100 accounts       │ ✅ LOCKED │
│ Candidate Codes (1118B, 2118, 2119, …)│ 0 present         │ 0 present          │ ✅ ZERO   │
│ Accounting Vouchers (public.voucher)  │ 6 rows            │ 6 rows             │ ✅ INTACT │
│ Journal Entries (public.entry)        │ 4 rows            │ 4 rows             │ ✅ INTACT │
│ Journal Lines (public.line)           │ 10 rows           │ 10 rows            │ ✅ INTACT │
│ Trial Balance Debit                   │ ₹3,380.00         │ ₹3,380.00          │ ✅ BALANCED│
│ Trial Balance Credit                  │ ₹3,380.00         │ ₹3,380.00          │ ✅ BALANCED│
│ Corporate Account Rows                │ 0 rows            │ 0 rows             │ ✅ CLEAN  │
│ Corporate Employee Rows               │ 0 rows            │ 0 rows             │ ✅ CLEAN  │
│ Leaked Advisory Locks                 │ 0 locks           │ 0 locks            │ ✅ CLEAN  │
└───────────────────────────────────────┴───────────────────┴────────────────────┴───────────┘
```

---

### 6. Architectural Boundary Compliance

- **Zero Accounting Drift**: Zero ledger vouchers, journal entries, or candidate accounts touched or created.
- **Zero Third-Party/Owned Branch Billing Scope**: No branch billing, franchise rate cards, or inter-branch settlements.
- **Zero Production Deployment, Push, or Destructive Git Operations**: All actions confined strictly to development database and local workspace.
