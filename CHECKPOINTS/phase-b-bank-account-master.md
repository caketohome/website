# CakeToHome ERP — Phase B Checkpoint: Company Bank Account Master & Double-Entry GL Integration

**Date**: 2026-10-04  
**Status**: ✅ COMPLETE & FULLY VERIFIED (100% Passing Tests, 0 Mutations Persisted)  
**Authoritative Scope**: Phase B: Company Bank Account Master  
**Previous Checkpoint**: [`phase-a-checkpoint.md`](file:///e:/vig/cakes2home-main/cakes2home-main/CHECKPOINTS/phase-a-checkpoint.md)  
**Test Suite Results**: 68 / 68 Assertions PASS (100%)  
**PostgreSQL Direct Verification**: 30 / 30 Assertions PASS (100%)  
**TypeScript Typecheck**: 0 Errors (`npx tsc --noEmit`)  

---

## 1. Executive Summary & Locked Business Invariants

Phase B establishes an enterprise-grade **Company Bank Account Master** in CakeToHome ERP, correcting fundamental relational and accounting flaws identified during the forensic audit.

### Locked Invariants Enforced:
1. **Strict Company Ownership (No Branch Ownership)**:
   - Bank accounts belong strictly to the **COMPANY** (`public.company`), NOT individual branches.
   - The legacy `branch_id` column and foreign key constraint were completely excised from `public.bank_account`.
   - Multi-branch operations disburse and deposit funds through company-owned bank accounts.
2. **1:1 Double-Entry GL Account Mapping**:
   - Every company bank account links directly to a unique, postable leaf account in `public.accounting_account` (`type='ASSET'`, `subtype='BANK'`).
   - A unique constraint (`uq_bank_account_gl_account_id`) guarantees that no two bank accounts share the same GL ledger.
   - The system automatically provisions child GL accounts under parent `1110`/`1112` (e.g., `1112-01`, `1112-02`) or allows mapping to an existing inactive/unlinked bank GL account.
3. **Duplicate Account Prevention & Format Integrity**:
   - Unique constraint `uq_bank_account_ifsc_acc_no` prevents duplicate accounts with identical `(ifsc_code, account_number)`.
   - Check constraint `chk_bank_account_ifsc` enforces uppercase Indian IFSC format (`^[A-Z]{4}0[A-Z0-9]{6}$`).
   - Supported account types: `CURRENT`, `SAVINGS`, `OVERDRAFT`, `ESCROW`, `NODAL`.
4. **Lifecycle & Status Transition Machine**:
   - Supported lifecycle states: `ACTIVE`, `INACTIVE`, `FROZEN`.
   - Status changes are protected by RBAC permissions (`BANK.MANAGE` or `ACCOUNTING.POST`).
   - Inactive and Frozen bank accounts fail-closed on disbursement attempts (`BANK_ACCOUNT_INACTIVE`, `BANK_ACCOUNT_FROZEN`).
5. **Security & Data Masking**:
   - Full account numbers are validated and stored securely, while read APIs return masked strings (`•••• •••• •••• 5678`) by default.
   - Full audit trail (`created_by`, `updated_by`, `created_at`, `updated_at`).
6. **Downstream Posting Resolution**:
   - All financial modules (Supplier Payments, Cash Deposit Clearances, Gateway Payouts, Customer Refunds, and Bank Reconciliation) resolve the exact bank-specific child GL ledger, completely eliminating hardcoded fallback accounts.

---

## 2. Schema Architecture & Database Migration (B2)

- **Migration File**: [`backend/src/migrations/20261004_phase_b_bank_account_master.sql`](file:///e:/vig/cakes2home-main/cakes2home-main/backend/src/migrations/20261004_phase_b_bank_account_master.sql)
- **Table Affected**: `public.bank_account`

### Schema Evolution:
| Column Name | Type | Nullable | Constraints & Description |
|:---|:---|:---|:---|
| `id` | VARCHAR(120) | NO | Primary Key |
| `company_id` | VARCHAR(120) | NO | FK to `public.company(id)` (ON DELETE RESTRICT) |
| `account_name` | VARCHAR(150) | NO | Display name (e.g., "HDFC Main Operating A/c") |
| `account_number` | VARCHAR(50) | NO | Full account number (minimum 8 characters) |
| `account_type` | VARCHAR(30) | NO | Check constraint: `CURRENT`, `SAVINGS`, `OVERDRAFT`, `ESCROW`, `NODAL` |
| `bank_name` | VARCHAR(100) | NO | Bank name (e.g., "HDFC Bank") |
| `branch_name` | VARCHAR(150) | YES | Bank branch name / location |
| `ifsc_code` | VARCHAR(20) | NO | Check constraint `chk_bank_account_ifsc` |
| `gl_account_id` | TEXT | NO | FK to `public.accounting_account(id)`, UNIQUE constraint `uq_bank_account_gl_account_id` |
| `status` | VARCHAR(20) | NO | Default `'ACTIVE'`, check constraint: `ACTIVE`, `INACTIVE`, `FROZEN` |
| `metadata` | JSONB | NO | Default `'{}'::jsonb` |
| `created_by` | TEXT | NO | Default `'system'` |
| `updated_by` | TEXT | NO | Default `'system'` |
| `created_at` | TIMESTAMPTZ | NO | Default `NOW()` |
| `updated_at` | TIMESTAMPTZ | NO | Default `NOW()` |

### Removed Relational Elements:
- Removed column `branch_id`.
- Removed foreign key `bank_account_branch_id_fkey`.
- Removed index `idx_bank_account_branch_id`.

---

## 3. Application Layers Implemented

### 3.1 Domain Types & Error Codes (B3)
- File: [`frontend/src/lib/types/accounting.types.ts`](file:///e:/vig/cakes2home-main/cakes2home-main/frontend/src/lib/types/accounting.types.ts)
- Interfaces: `BankAccountRow`, `BankAccountType`, `BankAccountStatus`, `CreateBankAccountParams`, `UpdateBankAccountParams`, `ListBankAccountsFilter`.
- Error Codes: `BANK_ACCOUNT_NOT_FOUND`, `DUPLICATE_BANK_ACCOUNT`, `INVALID_IFSC_CODE`, `INVALID_ACCOUNT_TYPE`, `GL_ACCOUNT_NOT_FOUND`, `INVALID_GL_ACCOUNT_TYPE`, `GL_ACCOUNT_ALREADY_MAPPED`, `BRANCH_OWNERSHIP_FORBIDDEN`, `PERMISSION_DENIED`, `BANK_ACCOUNT_INACTIVE`, `BANK_ACCOUNT_FROZEN`.

### 3.2 Repository Layer (B3)
- File: [`frontend/src/lib/repositories/bank-account.repository.ts`](file:///e:/vig/cakes2home-main/cakes2home-main/frontend/src/lib/repositories/bank-account.repository.ts)
- Direct parameterized SQL operations:
  - `create(params, client)`
  - `findById(id, client, forUpdate)`
  - `findByCompanyId(companyId, client)`
  - `findByGlAccountId(glAccountId, client)`
  - `findByIfscAndAccountNumber(ifsc, accNo, client)`
  - `list(filter, client)`: Left joins `accounting_account` to retrieve `gl_account_code`, `gl_account_name`, `gl_account_type`, `gl_account_subtype`.
  - `update(id, params, client)`
  - `updateStatus(id, status, updatedBy, client)`

### 3.3 Service Layer & Auto-GL Provisioning (B3)
- File: [`frontend/src/lib/services/bank-account.service.ts`](file:///e:/vig/cakes2home-main/cakes2home-main/frontend/src/lib/services/bank-account.service.ts)
- Features:
  - Account Number Masking: Exposes `•••• •••• •••• 1234` by default; unmasking requires explicit permission.
  - Automatic Child GL Provisioning: When `gl_account_id` is omitted, auto-creates child GL account under `1110`/`1112` (e.g. `1112-01`, `1112-02`) with `type='ASSET'`, `subtype='BANK'`, `is_group=false`.
  - Custom GL Validation: If `gl_account_id` is specified, validates existence, verifies `type='ASSET'` and `subtype='BANK'`, verifies `is_group=false`, and checks for existing bindings.
  - Strict Branch Rejection: Throws `BRANCH_OWNERSHIP_FORBIDDEN` if any caller attempts to supply `branch_id`.

### 3.4 REST API & RBAC (B4)
- File: [`frontend/src/app/api/v1/[...path]/route.ts`](file:///e:/vig/cakes2home-main/cakes2home-main/frontend/src/app/api/v1/%5B...path%5D/route.ts)
- Endpoints:
  - `GET /api/v1/accounting/bank-accounts`: List bank accounts for active company.
  - `GET /api/v1/accounting/bank-accounts/:id`: Get bank account detail with linked GL account info.
  - `POST /api/v1/accounting/bank-accounts`: Create bank account with auto-provisioning or custom GL.
  - `PUT /api/v1/accounting/bank-accounts/:id`: Update bank account details.
  - `POST /api/v1/accounting/bank-accounts/:id/status`: Transition lifecycle status (`ACTIVE`, `INACTIVE`, `FROZEN`).

### 3.5 Admin Dashboard UI Panel (B5)
- File: [`frontend/src/components/dashboard/admin/bank-accounts-panel.tsx`](file:///e:/vig/cakes2home-main/cakes2home-main/frontend/src/components/dashboard/admin/bank-accounts-panel.tsx)
- Navigation: Registered in [`admin-tabs.tsx`](file:///e:/vig/cakes2home-main/cakes2home-main/frontend/src/components/dashboard/admin/admin-tabs.tsx) and [`page.tsx`](file:///e:/vig/cakes2home-main/cakes2home-main/frontend/src/app/dashboard/page.tsx).
- Features:
  - Metrics Cards: Total Bank Accounts, Active Accounts, Frozen Accounts, Total Linked GLs.
  - Search & Status Filter: Instant client-side filtering.
  - Table Display: Bank name, masked account number, copyable IFSC tag, linked GL code & name badge, status badge.
  - Create & Edit Dialog: Form validation, IFSC format validation, toggle between auto-provisioning GL and selecting existing bank GL.
  - Status Toggle Actions: Quick actions to Activate, Deactivate, or Freeze accounts.

---

## 4. Downstream Posting Integration Verification (B6)

| Flow # | Business Event | Source Module | Debited Account | Credited Account | Verification Result |
|:---|:---|:---|:---|:---|:---|
| **Flow 1** | Supplier Payment | `PurchasePaymentService` | `2111` (Accounts Payable) | **Bank's Dedicated Child GL** (e.g. `1112-01`) | **VERIFIED** — Credits specific child GL, NOT generic 1112 |
| **Flow 2** | Cash Deposit Clearance | `BankReconciliationMatchingEngine` | **Bank's Dedicated Child GL** (e.g. `1112-01`) | `1118` (Deposit in Transit) | **VERIFIED** — Debits specific child GL, credits 1118 |
| **Flow 3** | Gateway Payout Settlement | `GatewaySettlementService` | **Bank's Dedicated Child GL** (e.g. `1112-02`) + `5290` (MDR Fees) | `1113` (Gateway Clearing) | **VERIFIED** — Net payout debits specific child GL |
| **Flow 4** | Customer Refund | `SalesReturnService` | `2121` (Customer Advance) | **Bank's Dedicated Child GL** | **VERIFIED** — Credits resolved bank GL |
| **Flow 5** | Bank Reconciliation Isolation | `BankReconciliationRepository` | Isolated per `bank_account_id` | Isolated per `bank_account_id` | **VERIFIED** — Cross-bank clearances rejected with `BANK_ACCOUNT_MISMATCH` |

---

## 5. Test Suite Execution & Evidence (B7)

- **Test Runner**: [`frontend/scratch/test_phase_b_bank_master.js`](file:///e:/vig/cakes2home-main/cakes2home-main/frontend/scratch/test_phase_b_bank_master.js)
- **Execution Mode**: 100% Isolated Database Transaction (`BEGIN ... ROLLBACK`). Zero test data persisted.

### Test Results Breakdown:
- **[REQ-01] Bank Account Creation & Auto-Provisioning**:
  - Bank account created with company ID linkage.
  - Account number masked as `•••• •••• •••• 5678`.
  - Uppercase IFSC normalization (`HDFC0001234`).
  - Child GL account auto-provisioned (`1112-01`), postable leaf (`is_group=false`), `type='ASSET'`, `subtype='BANK'`.
  - Confirmed `branch_id` is completely absent from `bank_account`.
- **[REQ-02] Duplicate Account Prevention**:
  - Attempting to insert identical `(ifsc_code, account_number)` rejected with `DUPLICATE_BANK_ACCOUNT`.
- **[REQ-03] Invalid IFSC Rejection**:
  - Rejected with `INVALID_IFSC_CODE`.
- **[REQ-04] Invalid Account Type Rejection**:
  - Rejected with `INVALID_ACCOUNT_TYPE`.
- **[REQ-05] Non-Existent GL Account Rejection**:
  - Rejected with `GL_ACCOUNT_NOT_FOUND`.
- **[REQ-06] Non-Bank GL Mapping Rejection**:
  - Mapping to Cash GL `1111` (`subtype='CASH'`) rejected with `INVALID_GL_ACCOUNT_TYPE`.
- **[REQ-07] Branch Ownership Rejection**:
  - Supplying `branch_id` rejected with `BRANCH_OWNERSHIP_FORBIDDEN`.
- **[REQ-08 - REQ-10] Unauthorized Operations Rejection**:
  - Staff create, edit, and deactivate attempts rejected with `PERMISSION_DENIED`.
- **[REQ-11] Status Lifecycle Transitions**:
  - Clean transitions: `ACTIVE` -> `INACTIVE` -> `FROZEN` -> `ACTIVE`.
- **[REQ-12] Update Bank Details**:
  - Verified updates to `account_name`, `branch_name`, and `metadata`.
- **[REQ-13] Distinct Bank GL Resolution**:
  - Bank A (`1112-01`) and Bank B (`1112-02`) mapped to strictly distinct child GL ledgers.
- **[REQ-14] Supplier Payment Integration**:
  - Disbursed funds credit Bank A child GL (`1112-01`) for exact payment amount.
  - Disbursed funds through Bank B credit Bank B child GL (`1112-02`).
  - Disbursement through `INACTIVE` bank account blocked.
  - Disbursement through `FROZEN` bank account blocked.
- **[REQ-15] Cash Deposit Clearance Integration**:
  - Clearance debits Bank A child GL (`1112-01`), credits `1118` Deposit in Transit.
- **[REQ-16] Gateway Payout Settlement Integration**:
  - Batch payout debits Bank B child GL (`1112-02`) for net settlement amount.
- **[REQ-17] Bank Reconciliation Isolation**:
  - Cross-bank statement clearing rejected with `BANK_ACCOUNT_MISMATCH`.
- **[REQ-18] Double-Entry Math Invariant Check & Zero Suspense**:
  - All posted journals verified: `SUM(debit_amount) === SUM(credit_amount)` with zero variance.
  - Suspense account `1119` hit count: 0 (never touched).

### Teardown Baseline Verification:
- Pre-test baseline: `bank_account: 0`, `accounting_account: 99`, `accounting_voucher: 3`, `accounting_journal_entry: 2`, `accounting_journal_line: 4`.
- Post-test baseline: `bank_account: 0`, `accounting_account: 99`, `accounting_voucher: 3`, `accounting_journal_entry: 2`, `accounting_journal_line: 4`.
- **Total Test Result**: **68 PASSED, 0 FAILED**.

---

## 6. Independent PostgreSQL Direct Verification (B8)

- **Verification Script**: [`frontend/scratch/b8_postgres_verification.js`](file:///e:/vig/cakes2home-main/cakes2home-main/frontend/scratch/b8_postgres_verification.js)
- **Results**: **30 PASSED, 0 FAILED**.
  - Confirmed column schema on `public.bank_account` (13 columns, `branch_id` absent, `company_id` NOT NULL, `gl_account_id` NOT NULL).
  - Confirmed foreign keys (`fk_bank_account_company -> company(id)`, `fk_bank_account_gl_account -> accounting_account(id)`).
  - Confirmed unique constraints (`uq_bank_account_gl_account_id`, `uq_bank_account_ifsc_acc_no`).
  - Confirmed check constraints (`chk_bank_account_ifsc`, `chk_bank_account_type`, `chk_bank_account_status`).
  - Confirmed parent account structure: `1110` (Cash & Cash Equivalents, `is_group=true`), `1112` (Bank Operating A/c, `subtype='BANK'`).
  - Confirmed downstream clearing tables intact: `gateway_settlement_order`, `gateway_payout_batch`, `bank_deposit_slip`.

---

## 7. Phase Completion Status & Next Steps

Phase B is **100% COMPLETE AND LOCKED**.

### Boundary Guarantees Respected:
- **Phase C (Teller, Teller settlement, cash custody)**: Untouched.
- **Phase D (Expense posting)**: Untouched.
- **Phase H (Test data cleanup)**: Untouched.
- **Git Commit/Push**: No commits or pushes made.

Ready to proceed to **Phase C (Teller, Teller Settlement & Cash Custody Master)** upon user instruction.
