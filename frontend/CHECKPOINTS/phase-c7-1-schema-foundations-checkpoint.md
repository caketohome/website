# Phase C7.1 Checkpoint — Schema Foundations for Party Accounting, Bill Settlement & Cost Centres

**Status**: ✅ PHASE C7.1 COMPLETE — SCHEMA FOUNDATIONS VERIFIED & FROZEN (STOP APPLIED)  
**Date**: 2026-10-06  
**Milestone**: Phase C7.1 — Schema Foundations & Relational Links  
**Prior Milestone**: Phase C7 Forensic Inspection & Architecture Lock ([`phase-c7-party-accounting-bills-cash-cost-centre-forensic.md`](file:///e:/vig/cakes2home-main/cakes2home-main/frontend/CHECKPOINTS/phase-c7-party-accounting-bills-cash-cost-centre-forensic.md))  
**Next Milestone**: Phase C7.2 — Bills Payable Lifecycle & Approval (Awaiting User Authorization)

---

## 1. Exact Migration Name
- **Migration Script**: [`migrate_phase_c7_1_schema_foundations.js`](file:///e:/vig/cakes2home-main/cakes2home-main/frontend/migrate_phase_c7_1_schema_foundations.js)
- **Execution Mode**: Single bounded transaction (`BEGIN` / `COMMIT`), fully non-destructive, fully idempotent upon re-application.

---

## 2. Exact Schema Changes Overview
The migration expanded the relational foundation of CakeToHome ERP from 314 to 317 public base tables by introducing 3 foundational tables and linking the existing operational purchasing, customer invoicing, and double-entry accounting structures without mutating any historical GL accounting records.

1. **Purchasing & AP Voucher Integration**:
   - Linked `purchase` to `accounting_voucher` via nullable `voucher_id`.
   - Linked `purchase_payment` to `accounting_voucher`, `bank_account`, `teller_session`, and `branch`.
2. **Multi-Bill Payment Allocation**:
   - Created `purchase_payment_allocation` table enabling bill-wise many-to-many supplier payment settlements.
3. **Multi-Invoice Receipt Allocation**:
   - Created `customer_receipt_allocation` table enabling future corporate AR many-to-many invoice collections.
4. **Cost Centre Hierarchy & Multidimensional Accounting**:
   - Created `cost_centre` table with self-referencing tree hierarchy and branch linkage.
   - Added nullable `cost_centre_id` dimension to `accounting_voucher` and `accounting_journal_line`.
5. **Corporate Credit & AR Foundations**:
   - Added corporate credit configuration fields to `customer` with conservative non-corporate defaults (`is_corporate = false`, `credit_enabled = false`, `credit_limit = 0.00`).
   - Added accounting linkage and balance tracking fields to `invoice` (`voucher_id`, `due_date`, `paid_amount`, `outstanding_amount`, `is_corporate`).

---

## 3. Exact Existing Structures Reused
- **Chart of Accounts**: Preserved canonical 100 accounts in [`accounting_account`](file:///e:/vig/cakes2home-main/cakes2home-main/frontend/src/lib/types/accounting.types.ts). No redundant accounts created; cost centre is an orthogonal attribute dimension.
- **Double-Entry Journal & Ledger**: Reused `accounting_voucher`, `accounting_journal_entry`, and `accounting_journal_line` with active double-entry balance trigger `trg_check_journal_balance` unmodified.
- **Party Master Tables**: Reused `customer`, `supplier`, `branch`, `bank_account`, `teller_session`, and `order`.
- **Primary Key Conventions**: Reused existing text/varchar UUID key formats (`gen_random_uuid()::text`) across all newly introduced tables.

---

## 4. Exact New Tables (3 Tables)
### A. `public.cost_centre`
Cost centre organizational hierarchy supporting Head Office, Marketing, HR, Kitchen Operations, Retail Branches, and Administration.
- `id` (VARCHAR(64) PRIMARY KEY, DEFAULT `gen_random_uuid()::text`)
- `company_id` (VARCHAR(64) NOT NULL DEFAULT 'cth_company_default')
- `parent_id` (VARCHAR(64) NULL REFERENCES `cost_centre(id)` ON DELETE RESTRICT)
- `code` (VARCHAR(32) NOT NULL UNIQUE)
- `name` (VARCHAR(128) NOT NULL)
- `description` (TEXT NULL)
- `branch_id` (VARCHAR(64) NULL REFERENCES `branch(id)` ON DELETE SET NULL)
- `is_active` (BOOLEAN NOT NULL DEFAULT true)
- `created_at` (TIMESTAMPTZ NOT NULL DEFAULT now())
- `updated_at` (TIMESTAMPTZ NOT NULL DEFAULT now())

### B. `public.purchase_payment_allocation`
Bill-wise settlement allocation linking purchase payments to individual purchase bills.
- `id` (VARCHAR(64) PRIMARY KEY, DEFAULT `gen_random_uuid()::text`)
- `payment_id` (VARCHAR(64) NOT NULL REFERENCES `purchase_payment(id)` ON DELETE CASCADE)
- `purchase_id` (VARCHAR(64) NOT NULL REFERENCES `purchase(id)` ON DELETE RESTRICT)
- `allocated_amount` (NUMERIC(14,2) NOT NULL CHECK (`allocated_amount > 0`))
- `allocation_date` (DATE NOT NULL DEFAULT CURRENT_DATE)
- `created_at` (TIMESTAMPTZ NOT NULL DEFAULT now())
- `created_by` (TEXT NOT NULL DEFAULT 'system')

### C. `public.customer_receipt_allocation`
Invoice-wise collection allocation linking customer receipts to sales invoices for B2B corporate credit.
- `id` (VARCHAR(64) PRIMARY KEY, DEFAULT `gen_random_uuid()::text`)
- `receipt_voucher_id` (VARCHAR(64) NULL REFERENCES `accounting_voucher(id)` ON DELETE RESTRICT)
- `invoice_id` (VARCHAR(64) NOT NULL REFERENCES `invoice(id)` ON DELETE RESTRICT)
- `allocated_amount` (NUMERIC(14,2) NOT NULL CHECK (`allocated_amount > 0`))
- `allocation_date` (DATE NOT NULL DEFAULT CURRENT_DATE)
- `created_at` (TIMESTAMPTZ NOT NULL DEFAULT now())
- `created_by` (TEXT NOT NULL DEFAULT 'system')

---

## 5. Exact New Columns Added to Existing Tables
1. **`public.purchase`**:
   - `voucher_id` (VARCHAR(64) NULL REFERENCES `accounting_voucher(id)` ON DELETE SET NULL)
2. **`public.purchase_payment`**:
   - `voucher_id` (VARCHAR(64) NULL REFERENCES `accounting_voucher(id)` ON DELETE SET NULL)
   - `bank_account_id` (VARCHAR(64) NULL REFERENCES `bank_account(id)` ON DELETE RESTRICT)
   - `teller_session_id` (VARCHAR(64) NULL REFERENCES `teller_session(id)` ON DELETE RESTRICT)
   - `branch_id` (VARCHAR(64) NULL REFERENCES `branch(id)` ON DELETE RESTRICT)
3. **`public.accounting_voucher`**:
   - `cost_centre_id` (VARCHAR(64) NULL REFERENCES `cost_centre(id)` ON DELETE SET NULL)
4. **`public.accounting_journal_line`**:
   - `cost_centre_id` (VARCHAR(64) NULL REFERENCES `cost_centre(id)` ON DELETE SET NULL)
5. **`public.customer`**:
   - `is_corporate` (BOOLEAN NOT NULL DEFAULT false)
   - `credit_enabled` (BOOLEAN NOT NULL DEFAULT false)
   - `credit_limit` (NUMERIC(14,2) NOT NULL DEFAULT 0.00 CHECK (`credit_limit >= 0`))
   - `payment_terms_days` (INTEGER NOT NULL DEFAULT 0 CHECK (`payment_terms_days >= 0`))
   - `gstin` (VARCHAR(20) NULL)
   - `credit_balance` (NUMERIC(14,2) NOT NULL DEFAULT 0.00 CHECK (`credit_balance >= 0`))
   - `credit_status` (VARCHAR(20) NOT NULL DEFAULT 'INACTIVE')
   - `credit_approved_by` (TEXT NULL REFERENCES `user(id)` ON DELETE RESTRICT)
   - `credit_approved_at` (TIMESTAMPTZ NULL)
6. **`public.invoice`**:
   - `voucher_id` (VARCHAR(64) NULL REFERENCES `accounting_voucher(id)` ON DELETE SET NULL)
   - `due_date` (DATE NULL)
   - `paid_amount` (NUMERIC(14,2) NOT NULL DEFAULT 0.00 CHECK (`paid_amount >= 0`))
   - `outstanding_amount` (NUMERIC(14,2) NOT NULL DEFAULT 0.00 CHECK (`outstanding_amount >= 0`))
   - `is_corporate` (BOOLEAN NOT NULL DEFAULT false)

---

## 6. Exact Constraints Defined
- `chk_ppa_allocated_amount_positive`: `allocated_amount > 0` on `purchase_payment_allocation`.
- `chk_cra_allocated_amount_positive`: `allocated_amount > 0` on `customer_receipt_allocation`.
- `uq_purchase_payment_allocation`: UNIQUE (`payment_id`, `purchase_id`) preventing double-allocation of same payment to same bill.
- `uq_cost_centre_code`: UNIQUE (`code`) on `cost_centre`.
- `chk_customer_credit_limit_non_negative`: `credit_limit >= 0` on `customer`.
- `chk_customer_payment_terms_non_negative`: `payment_terms_days >= 0` on `customer`.
- `chk_customer_credit_balance_non_negative`: `credit_balance >= 0` on `customer`.
- `chk_invoice_paid_amount_non_negative`: `paid_amount >= 0` on `invoice`.
- `chk_invoice_outstanding_amount_non_negative`: `outstanding_amount >= 0` on `invoice`.

---

## 7. Exact Indexes Created
- `idx_purchase_voucher_id` on `purchase(voucher_id)` WHERE `voucher_id IS NOT NULL`
- `idx_purchase_payment_voucher_id` on `purchase_payment(voucher_id)` WHERE `voucher_id IS NOT NULL`
- `idx_purchase_payment_bank_account_id` on `purchase_payment(bank_account_id)` WHERE `bank_account_id IS NOT NULL`
- `idx_purchase_payment_teller_session_id` on `purchase_payment(teller_session_id)` WHERE `teller_session_id IS NOT NULL`
- `idx_ppa_payment_id` on `purchase_payment_allocation(payment_id)`
- `idx_ppa_purchase_id` on `purchase_payment_allocation(purchase_id)`
- `idx_cra_receipt_voucher_id` on `customer_receipt_allocation(receipt_voucher_id)` WHERE `receipt_voucher_id IS NOT NULL`
- `idx_cra_invoice_id` on `customer_receipt_allocation(invoice_id)`
- `idx_cost_centre_parent_id` on `cost_centre(parent_id)` WHERE `parent_id IS NOT NULL`
- `idx_cost_centre_branch_id` on `cost_centre(branch_id)` WHERE `branch_id IS NOT NULL`
- `idx_accounting_voucher_cost_centre_id` on `accounting_voucher(cost_centre_id)` WHERE `cost_centre_id IS NOT NULL`
- `idx_accounting_journal_line_cost_centre_id` on `accounting_journal_line(cost_centre_id)` WHERE `cost_centre_id IS NOT NULL`
- `idx_customer_is_corporate` on `customer(is_corporate)` WHERE `is_corporate = true`
- `idx_customer_credit_enabled` on `customer(credit_enabled)` WHERE `credit_enabled = true`
- `idx_invoice_voucher_id` on `invoice(voucher_id)` WHERE `voucher_id IS NOT NULL`
- `idx_invoice_is_corporate` on `invoice(is_corporate)` WHERE `is_corporate = true`

---

## 8. Exact Foreign Key Relationships Established
- `purchase(voucher_id)` → `accounting_voucher(id)` [ON DELETE SET NULL]
- `purchase_payment(voucher_id)` → `accounting_voucher(id)` [ON DELETE SET NULL]
- `purchase_payment(bank_account_id)` → `bank_account(id)` [ON DELETE RESTRICT]
- `purchase_payment(teller_session_id)` → `teller_session(id)` [ON DELETE RESTRICT]
- `purchase_payment(branch_id)` → `branch(id)` [ON DELETE RESTRICT]
- `purchase_payment_allocation(payment_id)` → `purchase_payment(id)` [ON DELETE CASCADE]
- `purchase_payment_allocation(purchase_id)` → `purchase(id)` [ON DELETE RESTRICT]
- `customer_receipt_allocation(receipt_voucher_id)` → `accounting_voucher(id)` [ON DELETE RESTRICT]
- `customer_receipt_allocation(invoice_id)` → `invoice(id)` [ON DELETE RESTRICT]
- `cost_centre(parent_id)` → `cost_centre(id)` [ON DELETE RESTRICT]
- `cost_centre(branch_id)` → `branch(id)` [ON DELETE SET NULL]
- `accounting_voucher(cost_centre_id)` → `cost_centre(id)` [ON DELETE SET NULL]
- `accounting_journal_line(cost_centre_id)` → `cost_centre(id)` [ON DELETE SET NULL]
- `customer(credit_approved_by)` → `user(id)` [ON DELETE RESTRICT]
- `invoice(voucher_id)` → `accounting_voucher(id)` [ON DELETE SET NULL]

---

## 9. RLS & Security Status
- All access to financial, purchasing, and billing tables is strictly mediated through server-side authenticated sessions (`StaffAccessControl`, `resolveServerSession`, and `toAuthenticatedActor`).
- Client-supplied identity headers, company IDs, branch IDs, and user IDs are unconditionally discarded.
- No public PostgREST endpoints are exposed.
- Baseline RLS status across public schema remained intact with 0 weakening of security policies.

---

## 10. Backfill Performed
- **Customer Corporate Defaults**: All 57 existing customer rows were initialized with `is_corporate = false`, `credit_enabled = false`, `credit_limit = 0.00`, `payment_terms_days = 0`, `credit_balance = 0.00`, and `credit_status = 'INACTIVE'`.
- **Invoice Balance Fields**: All 5 existing invoice rows were initialized with `paid_amount = 0.00`, `outstanding_amount = 0.00`, `is_corporate = false`, and `voucher_id = NULL`.

---

## 11. Backfill Deliberately NOT Performed
- **Purchase Vouchers**: Historical `purchase` and `purchase_payment` records were left with `voucher_id = NULL`. No retrospective inferential GL posting was performed.
- **Payment Allocations**: Zero speculative payment allocations were generated.
- **Cost Centres**: No arbitrary operational cost centres were seeded.
- **Customer Credit Approvals**: No retail customer was granted corporate credit.

---

## 12. Test Results — Dedicated C7.1 Schema Verification Suite
- **Test File**: [`scratch/test_phase_c7_1_schema_verification.js`](file:///e:/vig/cakes2home-main/cakes2home-main/frontend/scratch/test_phase_c7_1_schema_verification.js)
- **Result**: **42 PASSED, 0 FAILED** ✅
- **Tested Areas**:
  1. Base public table count verified at 317.
  2. Canonical CoA count verified at 100.
  3. Cost centre creation, hierarchy parent linking, branch association, and duplicate code rejection.
  4. Nullable cost centre assignment on manual journal vouchers and journal lines.
  5. Foreign key rejection of invalid cost centres.
  6. Purchase and purchase payment voucher linkage.
  7. Purchase payment bank account and teller session linkage.
  8. Purchase payment multi-bill allocation with partial amounts.
  9. Duplicate allocation rejection and non-positive amount constraint enforcement.
  10. Customer receipt allocation to sales invoices.
  11. Existing customer corporate defaults (57/57 non-corporate, 0 with credit).
  12. Customer credit limit check constraints (`credit_limit >= 0`).
  13. Invoice corporate fields and voucher links.
  14. Clean topological fixture teardown without orphan residues.
  15. Trial Balance balance invariant maintained throughout tests.

---

## 13. Independent PostgreSQL Verification
- **Audit File**: [`scratch/audit_c7_1_independent_post_verification.js`](file:///e:/vig/cakes2home-main/cakes2home-main/frontend/scratch/audit_c7_1_independent_post_verification.js)
- **Result**: **31 PASSED, 0 FAILED** ✅
- **Audit Findings**:
  - Total Public Base Tables: **317** (verified exactly)
  - Canonical Chart of Accounts: **100** (verified exactly)
  - Orphan Vouchers: **0**
  - Orphan Journal Entries: **0**
  - Orphan Journal Lines: **0**
  - Orphan Purchase Voucher Links: **0**
  - Orphan Payment Voucher Links: **0**
  - Orphan Payment Bank Account Links: **0**
  - Orphan Payment Allocations: **0**
  - Orphan Receipt Allocations: **0**
  - Orphan Cost Centre References: **0**
  - Existing Customer Credit Audit: Total = 57, Corporate = 0, Credit Enabled = 0, Limit > 0 = 0, NULLs = 0
  - Blocked Database Locks: **0**
  - Baseline Entities: Vouchers = 6, Entries = 4, Lines = 10, Tellers = 0, Sessions = 0, Purchases = 0, Payments = 0
  - Trial Balance: Total Dr = ₹3,380.00, Total Cr = ₹3,380.00 (Zero-sum balanced!)

---

## 14. Predecessor Regression Results (100% Passing Baseline)
| Suite | Description | Scope | Result |
| :--- | :--- | :--- | :---: |
| **C6.4 Browser** | Real Chromium Manual Journal Playwright Suite | UI + Full E2E | **44 / 44 PASSED** ✅ |
| **C6.4 UI API** | Manual Journal Dashboard UI Integration Suite | Next.js API | **58 / 58 PASSED** ✅ |
| **C6.3 API** | Manual Journal API + RBAC / Four-Eyes SoD Suite | Next.js API | **111 / 111 PASSED** ✅ |
| **C6.2 Domain** | ManualJournalService Pure Domain Logic Suite | Domain Services | **88 / 88 PASSED** ✅ |
| **C6.1 Storage** | ManualJournalRepository PostgreSQL Persistence Suite | Persistence | **51 / 51 PASSED** ✅ |
| **C5 GL** | General Ledger Expense & Accounts Suite | GL Engine | **40 / 40 PASSED** ✅ |
| **C4.1 Cash** | Teller Settlement & Cash Over/Short Posting Suite | Cash / Teller | **99 / 99 PASSED** ✅ |
| **GRAND TOTAL** | **Combined Predecessor Regression Assertions** | **Full System** | **491 / 491 PASSED** ✅ |

---

## 15. TypeScript Compilation Result
- **Command**: `npx tsc --noEmit`
- **Output**: Clean exit code 0 (**0 errors**)
- **Updated Types**:
  - [`src/lib/types/accounting.types.ts`](file:///e:/vig/cakes2home-main/cakes2home-main/frontend/src/lib/types/accounting.types.ts): Added `CostCentreRow`, `CostCentreInput`, `CustomerReceiptAllocationRow`, `InvoiceRow`; updated `AccountingVoucherRow`, `AccountingJournalLineRow`, `JournalLineInput`, `VoucherCreateInput`.
  - [`src/lib/types/purchase.types.ts`](file:///e:/vig/cakes2home-main/cakes2home-main/frontend/src/lib/types/purchase.types.ts): Added `PurchasePaymentAllocationRow`; updated `PurchaseRow`, `PurchasePaymentRow`, `PurchasePaymentInput`.
  - [`src/lib/types/domain.ts`](file:///e:/vig/cakes2home-main/cakes2home-main/frontend/src/lib/types/domain.ts): Added corporate credit fields to `CustomerDomain`.

---

## 16. Trial Balance Verification
- **Authoritative SQL Query**:
  ```sql
  SELECT 
    COALESCE(SUM(debit_amount), 0)::numeric(12,2) as total_debit,
    COALESCE(SUM(credit_amount), 0)::numeric(12,2) as total_credit
  FROM public.accounting_journal_line;
  ```
- **Total Debit**: **₹3,380.00**
- **Total Credit**: **₹3,380.00**
- **Net Imbalance**: **₹0.0000** (Zero-sum balanced)

---

## 17. Known Limitations
- C7.1 delivers the relational schema foundations, constraints, and TypeScript contracts only.
- Operational services for auto-generating purchase vouchers or processing payment allocations do not yet exist; they are scheduled for Phase C7.2 and C7.3.
- Corporate AR due-date policies and receipt allocation workflows do not yet exist; they are scheduled for Phase C7.4.
- Cost centre master management UI/APIs do not yet exist; they are scheduled for Phase C7.6.

---

## 18. Prerequisites for Phase C7.2 (Bills Payable)
1. Phase C7.1 schema foundations are completely frozen.
2. `purchase.voucher_id` is established and indexed.
3. Inventory and AP control accounts are confirmed:
   - AP Control Account = `2111` (Accounts Payable - Trade Suppliers)
   - Inventory Asset Accounts = `1131` (Raw Materials), `1132` (Packaging), `1133` (Finished Goods)
4. Purchase status transitions and voucher posting rules must enforce Maker/Checker/Poster SoD consistent with Phase C6.

---

## 19. Explicit Confirmation of Strict Scope Boundaries
- ❌ **Bills Payable UI**: NOT implemented.
- ❌ **Bills Receivable UI**: NOT implemented.
- ❌ **Payment Allocation UI**: NOT implemented.
- ❌ **Pay Bill Workflow**: NOT implemented.
- ❌ **Receive Payment Workflow**: NOT implemented.
- ❌ **Teller Redesign**: NOT implemented.
- ❌ **Branch Cash Control UI**: NOT implemented.
- ❌ **Cost Centre UI**: NOT implemented.
- ❌ **CoA Governance UI**: NOT implemented.
- ❌ **Corporate Credit Workflow**: NOT implemented.
- ❌ **Corporate Gifting Import**: NOT implemented.
- ❌ **Reminders & Alerts**: NOT implemented.
- ❌ **Git Commit / Push**: Strictly zero git commits or pushes performed.
- 🛑 **STOP CONDITION OBSERVED**: Awaiting user authorization for Phase C7.2.
