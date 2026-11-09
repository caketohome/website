# CakeToHome ERP — Phase C7.9 Step 9B Domain Services & Repositories Checkpoint
## Corporate Account Master, Employee Roster Lifecycle & Audit Trail Services

> **Document Status**: 🔒 **STEP C7.9b DOMAIN SERVICES COMPLETE & AUDITED**  
> **Preservation Baseline**: Group 7 commit `d231cee7e55f716526e62f5799cc7377c555fed3` on `checkpoint/c-phases-baseline`  
> **Date**: 2026-10-12  
> **Execution Mode**: STRICTLY BOUNDED REPOSITORIES & DOMAIN SERVICES — ZERO SCHEMA MUTATION, ZERO BILLING, ZERO COA MUTATION  

---

### 1. Executive Summary

In accordance with explicit authorization, **Phase C7.9 Step 9B** has been executed, tested, and independently verified against live PostgreSQL.

The domain layer and data access repositories implement:
- **Corporate Account Repository & Service**:
  - Full 1:1 customer linkage invariant strictly enforced in application layer and backed by database unique constraint.
  - Active GSTIN uniqueness enforcement with partial index backstop.
  - Indian tax validation: Strict GSTIN regex, PAN regex, and cross-match verification (chars 3–12 of GSTIN matching PAN).
  - Super Admin-only customer linkage modification rule, strictly audited with `CUSTOMER_LINKED` events.
  - Account update with normalized legal name search keys (`legal_name_key`).
- **Four-Eyes Corporate Account Approval**:
  - Approver must not be the creator (`created_by !== actor.userId`).
  - Gated strictly to Super Admin.
  - Status transition from `PENDING` to `APPROVED`.
  - **Credit Isolation Invariant**: Account approval does **not** grant or activate credit. `customer.is_corporate` and `customer.credit_enabled` remain strictly unmutated.
- **Corporate Account Lifecycle Transitions**:
  - `PENDING -> APPROVED -> SUSPENDED -> APPROVED -> CLOSED`.
  - Closed accounts cannot be mutated, nor can new employees be added to closed accounts.
- **Credit Request Metadata**:
  - Allows requesting credit limit and payment terms days for approved accounts.
  - Stores request parameters on `corporate_account` and emits `CREDIT_REQUESTED` audit event without mutating `public.customer`.
- **Corporate Account Contacts**:
  - Support for `PRIMARY`, `SECONDARY`, `ACCOUNTS_PAYABLE`, and `BILLING` contacts.
  - Enforces exactly one active `PRIMARY` contact per account.
- **Scoped Membership Delegation**:
  - Support for `ROSTER_MANAGER` and `ROSTER_VIEWER` roles.
  - Gated strictly to Super Admin for granting and revoking.
  - Active unique membership per user per account.
- **Employee Roster Lifecycle**:
  - Employee creation, update, deactivation, and explicit rehire/reactivation.
  - Employee code normalization (trimmed, uppercase, single spaces) with global uniqueness per account across ALL statuses.
  - Deactivated employees cannot be duplicated; rehire requires explicit reactivation restoring the original record ID and history.
  - Database trigger `trg_ce_prevent_delete` strictly blocks hard DELETE.
  - Phone reuse generates actionable audit warnings without rejecting employee creation.
  - Coordinates validation enforcing India bounding box (lat 6.0–38.0, lng 68.0–98.0) and both-or-neither rule; default status is unverified.
- **Append-Only Immutability**:
  - `corporate_account_event` and `corporate_employee_event` are append-only.
  - Security triggers `trg_cax_append_only` and `trg_cee_append_only` strictly block UPDATE and DELETE.
- **Import Batch Replay Protection**:
  - Batch audit tracking with file hash replay protection (`idx_cei_account_file_hash_committed`).
- **Atomic Transactions**:
  - All domain mutations and their associated audit events execute within atomic transactions.
  - Concurrency control via transaction-level advisory locks `pg_advisory_xact_lock(hashtext('corp_acct_' || accountId))`.

---

### 2. Verified Implementation Files

| Component | Path | Description |
|---|---|---|
| **Domain Types** | [`frontend/src/lib/types/corporate-account.types.ts`](file:///e:/vig/cakes2home-main/cakes2home-main/frontend/src/lib/types/corporate-account.types.ts) | Strict TypeScript interfaces for accounts, contacts, members, employees, events, batches, filters, and actor context. |
| **Repositories** | [`frontend/src/lib/repositories/corporate-account.repository.ts`](file:///e:/vig/cakes2home-main/cakes2home-main/frontend/src/lib/repositories/corporate-account.repository.ts) | Transaction-participating repositories with parameterised SQL, advisory locks, and zero DELETE methods on employees/events. |
| **Account Service** | [`frontend/src/lib/services/corporate-account.service.ts`](file:///e:/vig/cakes2home-main/cakes2home-main/frontend/src/lib/services/corporate-account.service.ts) | Domain logic for accounts, contacts, membership, four-eyes approval, tax validation, and audit events. |
| **Employee Service** | [`frontend/src/lib/services/corporate-employee.service.ts`](file:///e:/vig/cakes2home-main/cakes2home-main/frontend/src/lib/services/corporate-employee.service.ts) | Domain logic for roster lifecycle, code normalization, duplicate defense, phone reuse warnings, and batch tracking. |
| **RBAC Catalog** | [`frontend/src/lib/staff-access-control.ts`](file:///e:/vig/cakes2home-main/cakes2home-main/frontend/src/lib/staff-access-control.ts) | Registered 11 `CORPORATE_ACCOUNTS.*` and `CORPORATE_EMPLOYEES.*` permissions. |
| **Type Index** | [`frontend/src/lib/types/index.ts`](file:///e:/vig/cakes2home-main/cakes2home-main/frontend/src/lib/types/index.ts) | Exported corporate account types. |
| **Repo Index** | [`frontend/src/lib/repositories/index.ts`](file:///e:/vig/cakes2home-main/cakes2home-main/frontend/src/lib/repositories/index.ts) | Exported corporate account repositories. |
| **Service Index** | [`frontend/src/lib/services/index.ts`](file:///e:/vig/cakes2home-main/cakes2home-main/frontend/src/lib/services/index.ts) | Exported corporate account domain services. |

---

### 3. Verification Test Evidence

#### Test 1: C7.9b Domain & Repository Comprehensive Test Suite
- **Runner**: [`frontend/scratch/test_phase_c7_9_step9b_domain.js`](file:///e:/vig/cakes2home-main/cakes2home-main/frontend/scratch/test_phase_c7_9_step9b_domain.js)
- **Results**: **18 / 18 tests passed (0 failed)** — **Exit Code 0**
  - ✓ TEST [1] PASS: Tax validation enforces GSTIN/PAN regex and cross-character consistency
  - ✓ TEST [2] PASS: Corporate account created with PENDING status, primary contact, synced customer, and CREATED event
  - ✓ TEST [3] PASS: 1:1 customer linkage and active GSTIN uniqueness strictly enforced
  - ✓ TEST [4] PASS: Customer linkage restricted strictly to Super Admin with immutable CUSTOMER_LINKED audit
  - ✓ TEST [5] PASS: Four-Eyes approval enforced (creator !== approver); credit activation strictly isolated
  - ✓ TEST [6] PASS: Credit request records metadata and audit event without mutating customer credit limits
  - ✓ TEST [7] PASS: Account status lifecycle (SUSPEND -> REACTIVATE) enforced with transition rules and events
  - ✓ TEST [8] PASS: Contact management enforces exactly one active PRIMARY contact per account
  - ✓ TEST [9] PASS: Scoped account membership granted by Super Admin with role segregation and duplicate checks
  - ✓ TEST [10] PASS: Employee creation normalizes code, validates India bbox coordinates, and defaults to unverified
  - ✓ TEST [11] PASS: Phone reuse emits actionable audit warning without rejecting employee record
  - ✓ TEST [12] PASS: Active employee code duplicate rejected across case variants
  - ✓ TEST [13] PASS: Deactivation preserves history, DB trigger blocks DELETE, and rehire explicitly reactivates same ID
  - ✓ TEST [14] PASS: Coordinates verification records verified flag, verifier, and audit event
  - ✓ TEST [15] PASS: Security triggers trg_cax_append_only and trg_cee_append_only strictly block UPDATE and DELETE on audit logs
  - ✓ TEST [16] PASS: Import batch replay protection blocks duplicate committed SHA-256 file hashes
  - ✓ TEST [17] PASS: Cross-account isolation strictly denies unauthorized cross-tenant queries and mutations
  - ✓ TEST [18] PASS: Transaction rollback guarantees zero partial state mutations on validation failure

#### Test 2: C7.9a Schema Verification Suite Regression
- **Runner**: [`frontend/scratch/test_phase_c7_9_step9a_schema.js`](file:///e:/vig/cakes2home-main/cakes2home-main/frontend/scratch/test_phase_c7_9_step9a_schema.js)
- **Result**: **37 / 37 passed (0 failed)** — **Exit Code 0**

#### Test 3: Existing Immutability Triggers Regression Suite
- **Runner**: [`frontend/scratch/test_immutability_triggers.js`](file:///e:/vig/cakes2home-main/cakes2home-main/frontend/scratch/test_immutability_triggers.js)
- **Result**: **8 / 8 passed (0 failed)** — **Exit Code 0**

#### Test 4: TypeScript Static Compilation
- **Command**: `npx tsc --noEmit`
- **Result**: **Exit Code 0 (Zero errors)**

---

### 4. Independent Financial Invariants Audit

Live PostgreSQL state audited before and after C7.9b execution:

```
┌───────────────────────────────────────┬───────────────────┬────────────────────┬───────────┐
│ Metric / Entity                       │ Pre-Flight        │ Post-Flight        │ Status    │
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
│ Corporate Event Rows                  │ 0 rows            │ 0 rows             │ ✅ CLEAN  │
└───────────────────────────────────────┴───────────────────┴────────────────────┴───────────┘
```

---

### 5. Architectural Boundaries Preserved

- Zero alteration to existing business tables (`customer`, `company`, `invoice`, `order`, `branch`).
- Zero candidate accounts (`1118B`, `2118`, `2119`, `5114`, `5115`) introduced.
- Zero financial or GL postings created.
- Zero change to `BillsReceivableService.approveCorporateCredit` or legacy credit route.
- Zero uncommitted test records remaining in the database.
- Working-tree preservation strictly maintained.
