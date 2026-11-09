# Phase B — B1 Forensic Inspection Report: Bank Account Master

> **Phase**: Phase B (Bank Account Master) — Step B1 (Forensic Inspection)  
> **Status**: ✅ FORENSIC INSPECTION COMPLETE — STOPPED FOR USER REVIEW BEFORE B2  
> **Inspection Timestamp**: 2026-10-04  
> **Database Verified**: PostgreSQL (Local Dev DB) — Direct parameterized SQL inspection  
> **Repository Verified**: `e:/vig/cakes2home-main/cakes2home-main`  

---

## 1. Current `bank_account` Schema in PostgreSQL

Direct inspection of `public.bank_account` in the live development database reveals:

| Column Name | Data Type | Nullable | Default | Constraints / Foreign Keys |
|:---|:---|:---:|:---|:---|
| `id` | `text` | NO | None | Primary Key (`bank_account_pkey`) |
| `company_id` | `text` | NO | `'company_default'::text` | ⚠️ No FK to `public.company`, uses legacy default |
| `branch_id` | `text` | YES | None | ⚠️ FK `bank_account_branch_id_fkey` to `branch(id)` |
| `bank_name` | `text` | NO | None | `chk_bank_account_name`: `length(TRIM(bank_name)) > 0` |
| `account_number_masked`| `text` | NO | None | `chk_bank_account_masked`: `length(TRIM(account_number_masked)) >= 4` |
| `ifsc_code` | `text` | NO | None | `chk_bank_account_ifsc`: `~ '^[A-Z]{4}0[A-Z0-9]{6}$'` |
| `status` | `text` | NO | `'ACTIVE'::text` | `chk_bank_account_status`: `IN ('ACTIVE', 'INACTIVE', 'FROZEN')` |
| `metadata` | `jsonb` | YES | `'{}'::jsonb` | None |
| `created_at` | `timestamptz` | NO | `now()` | None |
| `updated_at` | `timestamptz` | NO | `now()` | None |

### Existing Indexes:
1. `bank_account_pkey`: `CREATE UNIQUE INDEX bank_account_pkey ON public.bank_account USING btree (id)`
2. `idx_bank_account_branch_id`: `CREATE INDEX idx_bank_account_branch_id ON public.bank_account USING btree (branch_id)`
3. `idx_bank_account_status`: `CREATE INDEX idx_bank_account_status ON public.bank_account USING btree (status)`

### Current Table Data:
- **Row count: 0** (Completely empty table in DEV DB).

### Critical Deficiencies Identified:
1. **Missing `account_name`**: No human-readable name (e.g. "HDFC Corporate Current A/c").
2. **Missing `account_number`**: Stores only masked account number; cannot generate official payment orders or verify full identity.
3. **Missing `account_type`**: No designation for `CURRENT`, `SAVINGS`, `OVERDRAFT`, or `VIRTUAL`.
4. **Missing `gl_account_id`**: No relationship or foreign key to `public.accounting_account` (Bank-specific GL mapping does not exist!).
5. **Missing `company_id` Foreign Key**: Does not reference `public.company(id)`, retains legacy `'company_default'` default.
6. **Violates Branch Isolation**: Contains `branch_id` with FK to `branch(id)`. Branches cannot own bank accounts according to the locked business rules.
7. **Missing Audit Trail**: Lacks `created_by` and `updated_by`.
8. **Missing Identity Uniqueness**: No unique constraint preventing duplicate account numbers under the same IFSC.

---

## 2. Current Bank-Account Service & Repository

### Repository (`frontend/src/lib/repositories/bank-account.repository.ts`):
- Class: `BankAccountRepository`
- Methods: `create()`, `findById()`, `list()`, `update()`, `setStatus()`.
- Supports pessimistic locking via `findById(id, client, true)` (`FOR UPDATE`).
- Current SQL queries in `create()` and `list()` explicitly reference `branch_id` and allow branch filtering (`filter.includeEnterprise`, `branch_id IS NULL`, `branch_id = $1`).

### Service (`frontend/src/lib/services/bank-account.service.ts`):
- Class: `BankAccountService`
- Hardcoded Invariant Violation:
  - Header line 9: *"All operational bank accounts resolve strictly to GL 1112 Bank Operating A/c."*
  - Line 98: Throws `ARBITRARY_GL_ACCOUNT_FORBIDDEN` if client passes an accounting account.
  - Line 161: Hardcodes `metadata: { operational_gl_account: "1112" }`.
- Branch Scoping:
  - Enforces that non-super-admins can only create and manage bank accounts where `branch_id === actorBranch`.
  - Must be overhauled: bank accounts are enterprise/company-wide master records. Non-super-admins (e.g., branch staff) must not create or own company bank accounts.

---

## 3. All Bank-Related API Routes

Inspected in [`frontend/src/app/api/v1/[...path]/route.ts`](file:///e:/vig/cakes2home-main/cakes2home-main/frontend/src/app/api/v1/%5B...path%5D/route.ts):

| Route | Method | Line | Implemented? | Notes |
|:---|:---:|:---:|:---:|:---|
| `admin/bank-accounts` | `GET` | 1700 | ✅ Yes | Requires `BANK.VIEW` or `GATEWAY.VIEW`. Filters by `branch_id`. |
| `admin/bank-accounts` | `POST` | — | ❌ **MISSING** | No route exists to create a bank account via API. |
| `admin/bank-accounts/:id` | `GET` | — | ❌ **MISSING** | No detail endpoint. |
| `admin/bank-accounts/:id` | `PUT` | — | ❌ **MISSING** | No update endpoint. |
| `admin/bank-accounts/:id/status` | `POST` / `PUT` | — | ❌ **MISSING** | No activation/deactivation endpoint. |
| `admin/bank-deposit-slips` | `GET` | 1744 | ✅ Yes | Cash deposit slip list. |
| `admin/bank-deposit-slips` | `POST` | 4820 | ✅ Yes | Cash deposit slip dispatch. |
| `admin/bank-reconciliation/statements/calculate` | `GET` | 2038 | ✅ Yes | BRS summary calculation. |
| `admin/bank-reconciliation/sessions` | `GET` / `POST` | 2166 | ✅ Yes | BRS sessions. |

---

## 4. All `bank_account_id` Usages in the Codebase

### Database Foreign Key Constraints:
- `bank_deposit_slip.bank_account_id` → `bank_account.id`
- `gateway_payout_batch.bank_account_id` → `bank_account.id`
- `bank_statement_import.bank_account_id` → `bank_account.id`
- `bank_statement_line.bank_account_id` → `bank_account.id`
- `bank_reconciliation_session.bank_account_id` → `bank_account.id`

### Core Service Consumers:
1. `GatewaySettlementService`: Verifies `bank_account_id` exists, is active, not frozen; links payout batch to `bank_account_id`.
2. `BankDepositSlipService`: Verifies `bank_account_id` exists, is active; links deposit slip to `bank_account_id`.
3. `BankStatementImportService`: Associates imported statement files and statement lines with `bank_account_id`.
4. `BankReconciliationStatementService`: Reconciles bank statements against GL for a specific `bank_account_id`.
5. `BankReconciliationMatchingService`: Matches cleared deposits and payouts for a specific `bank_account_id`.

### Critical Posting Gap:
- `PurchasePaymentService` (supplier payments) and `SalesReturnService` (customer refunds) do **NOT** take or record `bank_account_id`. They hardcode GL `1112` directly.

---

## 5. All `branch_id` Usages on Bank Accounts

### Database:
- Column `bank_account.branch_id` exists with FK `bank_account_branch_id_fkey` to `branch(id)`.
- Index `idx_bank_account_branch_id` exists.
- Row count in DB is 0; no existing data is linked to branches.

### Code Locations Requiring Removal / Decoupling:
1. `BankAccountRepository`: Remove `branch_id` from `create`, `list`, and `update`.
2. `BankAccountService`: Remove branch scoping, branch assignment, and cross-branch permission checks. Bank accounts are company-owned.
3. `BankDepositSlipService`: Line 242 currently checks `if (bankAccount.branch_id && bankAccount.branch_id !== targetBranchId)`. Must be updated: since company bank accounts are shared across branches for deposit, branches deposit into the company bank account!
4. `BankReconciliationStatementService`: Line 137 checks `if (account.branch_id === null) ... if (actorScope.actorBranch !== account.branch_id)`. Must be updated: reconciliation is enterprise/accounting level.
5. `route.ts`: Line 1728 filters `filter.branchId = userCtx.branchId`. Must be updated to return company bank accounts.

---

## 6. Current `1112` Usage in the Codebase

Account `1112` is titled **"Bank Operating A/c"** in the Chart of Accounts (`public.accounting_account`).

### Hardcoded Usages in Services:
1. `purchase-payment.service.ts` (Lines 197, 468, 617): Resolves `BANK_TRANSFER`, `UPI`, `CHEQUE`, and `CARD` payments to account code `1112`.
2. `sales-return.service.ts` (Line 1478): Sets `disbursementAccountCode = "1112"` for bank disbursements.
3. `gateway-settlement.service.ts` (Lines 689, 697, 775): Queries `WHERE code IN ('1112', '5290', '1113', '5295')` and posts `Dr 1112` for net payout share.
4. `customer-receipt.service.ts` (Lines 1805, 1816, 1831): Posts `Dr 1112` for customer receipt settlement.
5. `bank-reconciliation-matching.service.ts` (Lines 687, 695, 719): Queries `WHERE code IN ('1112', '1118')` and posts `Dr 1112 / Cr 1118` for deposit in transit clearance.
6. `bank-reconciliation-statement.service.ts` (Lines 237–243, 296–297): Calculates `gl1112BookBalance` by directly querying account `1112`.
7. `cash-flow.service.ts` (Line 66): Hardcodes `1112` in cash equivalent list.

### Why This Fails Double-Entry Accounting:
All bank transactions collapse into a single monolithic GL account `1112`. If the business opens Account A (HDFC) and Account B (ICICI), neither trial balance nor bank reconciliation can segregate cash between the two institutions.

---

## 7. Current Bank-Related Journal Posting Paths

| Operation | Debit Leg | Credit Leg | Voucher Type | Current Code Status |
|:---|:---|:---|:---|:---|
| **Supplier Payment** | `2111 Accounts Payable` | Hardcoded `1112` (Bank) / `1111` (Cash) | `PURCHASE_PAYMENT` | Ignores `bank_account_id` |
| **Customer Refund** | `1121 Accounts Receivable` | Hardcoded `1112` (Bank) | `CUSTOMER_REFUND` | Ignores `bank_account_id` |
| **Deposit Dispatch (Stage 1)** | `1118 Deposit in Transit` | `1111 Cash in Hand` | `CASH_DEPOSIT_TRANSIT` | References `bank_account_id` |
| **Deposit Clearance (Stage 2)** | Hardcoded `1112` | `1118 Deposit in Transit` | `CASH_DEPOSIT_CREDIT` | Hardcodes `1112` despite knowing slip `bank_account_id` |
| **Gateway Settlement Payout** | Hardcoded `1112` (Net) + `5290` (MDR) | `1113 Gateway Clearing` | `GATEWAY_SETTLEMENT` | Hardcodes `1112` despite knowing batch `bank_account_id` |

---

## 8. Current Chart of Accounts Bank Structure

Live query on `public.accounting_account`:
```
code=1100 name="Current Assets"              type=ASSET subtype=CURRENT_ASSET  level=2 is_group=true
  code=1110 name="Cash and Cash Equivalents" type=ASSET subtype=CURRENT_ASSET  level=3 is_group=true
    code=1111 name="Cash in Hand"            type=ASSET subtype=CASH           level=4 is_group=false
    code=1112 name="Bank Operating A/c"      type=ASSET subtype=BANK           level=4 is_group=false
    code=1113 name="Gateway Clearing"        type=ASSET subtype=GATEWAY_CLEARING level=4 is_group=false
    code=1114 name="Petty Cash - Branches"   type=ASSET subtype=CASH           level=4 is_group=false
    code=1118 name="Deposit in Transit"      type=ASSET subtype=CURRENT_ASSET  level=4 is_group=false
    code=1119 name="Unclassified Suspense"   type=ASSET subtype=CURRENT_ASSET  level=4 is_group=false
```

### Constraints on `accounting_account`:
- `chk_account_level`: `level >= 1 AND level <= 5`
- `chk_account_type`: `type IN ('ASSET', 'LIABILITY', 'EQUITY', 'REVENUE', 'EXPENSE')`
- `chk_account_subtype`: includes `'BANK'`
- `uq_accounting_account_code`: `UNIQUE (code)`

### Recommended GL Architecture:
- `1112` serves as the Bank Control / Operating Group (or parent).
- When a Bank Account is created, it is mapped to a dedicated leaf GL account (`type: 'ASSET'`, `subtype: 'BANK'`, `level: 4` or `5`, `is_group: false`).
- Example:
  - `1112-01` (or `111201`): `HDFC Bank - Current A/c - 1234`
  - `1112-02` (or `111202`): `ICICI Bank - Current A/c - 5678`
- Existing account `1112` remains active to prevent breaking legacy assertions, or acts as the default parent.

---

## 9. Existing Admin UI Patterns

- Panels located in [`frontend/src/components/dashboard/admin/`](file:///e:/vig/cakes2home-main/cakes2home-main/frontend/src/components/dashboard/admin/).
- Architectural Pattern:
  - React client component with Tailwind CSS.
  - Header with icon, title, description, and "Add New" primary CTA.
  - Search / status filter toolbar.
  - Data table with status badges (`ACTIVE` green, `INACTIVE` amber, `FROZEN` blue).
  - Masked account display (`•••• •••• •••• 1234`).
  - Action buttons: Edit, Toggle Status.
  - Slide-over drawer or modal dialog for Create/Edit forms with client-side validation.
  - Clean error banners and feedback toasts.
  - Navigation tab in `admin-tabs.tsx`, rendered conditionally via `StaffAccessControl.isTabPermitted()`.

---

## 10. Exact B2 Migration Specification

The proposed migration file `backend/src/migrations/20261004_phase_b_bank_account_master.sql` will perform:

```sql
-- 1. Drop branch dependency from bank_account (Branches DO NOT own bank accounts)
ALTER TABLE public.bank_account
  DROP CONSTRAINT IF EXISTS bank_account_branch_id_fkey;

DROP INDEX IF EXISTS public.idx_bank_account_branch_id;

ALTER TABLE public.bank_account
  DROP COLUMN IF EXISTS branch_id;

-- 2. Clean company_id default and establish FK to public.company
ALTER TABLE public.bank_account
  ALTER COLUMN company_id DROP DEFAULT;

ALTER TABLE public.bank_account
  ADD CONSTRAINT fk_bank_account_company
  FOREIGN KEY (company_id) REFERENCES public.company(id)
  ON DELETE RESTRICT;

-- 3. Add essential master fields
ALTER TABLE public.bank_account
  ADD COLUMN IF NOT EXISTS account_name VARCHAR(150),
  ADD COLUMN IF NOT EXISTS account_number VARCHAR(50),
  ADD COLUMN IF NOT EXISTS account_type VARCHAR(30) NOT NULL DEFAULT 'CURRENT',
  ADD COLUMN IF NOT EXISTS branch_name VARCHAR(150),
  ADD COLUMN IF NOT EXISTS gl_account_id TEXT,
  ADD COLUMN IF NOT EXISTS created_by TEXT NOT NULL DEFAULT 'system',
  ADD COLUMN IF NOT EXISTS updated_by TEXT NOT NULL DEFAULT 'system';

-- 4. Apply NOT NULL constraints to account_name, account_number, gl_account_id
-- (Safe since row count is 0)
ALTER TABLE public.bank_account
  ALTER COLUMN account_name SET NOT NULL,
  ALTER COLUMN account_number SET NOT NULL,
  ALTER COLUMN gl_account_id SET NOT NULL;

-- 5. Foreign Key to accounting_account
ALTER TABLE public.bank_account
  ADD CONSTRAINT fk_bank_account_gl_account
  FOREIGN KEY (gl_account_id) REFERENCES public.accounting_account(id)
  ON DELETE RESTRICT;

-- 6. Integrity and validation constraints
ALTER TABLE public.bank_account
  ADD CONSTRAINT chk_bank_account_name_len
    CHECK (length(trim(account_name)) >= 2),
  ADD CONSTRAINT chk_bank_account_num_len
    CHECK (length(trim(account_number)) >= 4),
  ADD CONSTRAINT chk_bank_account_type
    CHECK (account_type IN ('CURRENT', 'SAVINGS', 'OVERDRAFT', 'VIRTUAL')),
  ADD CONSTRAINT uq_bank_account_gl_account
    UNIQUE (gl_account_id),
  ADD CONSTRAINT uq_bank_account_number_ifsc
    UNIQUE (ifsc_code, account_number);

-- 7. Performance Indexes
CREATE INDEX IF NOT EXISTS idx_bank_account_company_id
  ON public.bank_account (company_id);

CREATE INDEX IF NOT EXISTS idx_bank_account_gl_account_id
  ON public.bank_account (gl_account_id);
```

---

## Conclusion & Stop Condition

Forensic inspection B1 is complete. All 10 required items have been verified against active code and live PostgreSQL data. No application code has been modified yet.

**Awaiting user review and authorization before executing B2 (Migration & Schema).**
