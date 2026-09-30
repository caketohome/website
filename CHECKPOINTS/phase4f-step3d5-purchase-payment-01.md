# Phase 4F Step 3D.5 Checkpoint — Purchase Payments & AP Settlement

**Status**: PASS / VERIFIED / CHECKPOINTED  
**Date**: 2026-09-25  
**Author**: Antigravity  
**Commit/Push**: NONE (Zero git mutations)

---

## 1. Executive Summary

Phase 4F Step 3D.5 establishes and verifies the canonical, atomic payment disbursement and Accounts Payable (AP) settlement workflow for CakeToHome ERP:

```
[ POSTED Purchase Invoice ] (Status === 'POSTED')
             │
             ├── SELECT purchase ... FOR UPDATE (Row-level lock)
             ├── Branch Isolation / BOLA check
             ├── Status Guard (DRAFT, SUBMITTED, APPROVED, CANCELLED rejected)
             ├── Fail-closed configuration check (accounting_start_date, fiscal_period)
             ├── SELECT purchase_payment ... FOR UPDATE (Lock existing payments)
             ├── Compute alreadyPaid and outstandingBalance
             ├── Amount validation (amount > 0, amount <= outstandingBalance)
             ├── Segregation of Duties (paidBy !== created_by, paidBy !== approved_by)
             │     └── SUPER_ADMIN cannot bypass SoD
             ├── Canonical permission check: hasEffectivePermission(actorContext, "ACCOUNTING.POST")
             ├── Account resolution (CASH -> 1111, BANK/UPI/CHEQUE/CARD -> 1112, OTHER -> leaf check)
             ├── INSERT purchase_payment record
             ├── Canonical PostingService primitives:
             │     ├── createVoucherDraft (Type: PAYMENT, Ref: PURCHASE_PAYMENT, Event: SUPPLIER_DISBURSEMENT)
             │     │     ├── Dr 2111 Accounts Payable (Carrying supplier_id dimension)
             │     │     └── Cr 1111/1112 Cash / Bank Account
             │     ├── submitVoucher (Transition to SUBMITTED)
             │     ├── approveVoucher (Transition to APPROVED)
             │     └── postVoucher (Inserts journal_entry & journal_lines, transitions to POSTED)
             └── COMMIT (or ROLLBACK EVERYTHING on any error; zero partial state)
```

In accordance with strict gate boundaries:
- **Only POSTED Purchases Eligible**:
  - Rejects payments against `DRAFT`, `SUBMITTED`, `APPROVED`, or `CANCELLED` purchases with `INVALID_PURCHASE_STATUS`.
  - AP liability (2111) is only recognized upon purchase invoice posting; paying an unposted purchase requisition is strictly prohibited.
- **Full Atomicity Proven**:
  - `purchase_payment` record + `PAYMENT` voucher + `accounting_journal_entry` + `accounting_journal_line` records either all commit together or all roll back together (zero partial state).
- **AP Settlement is the Exclusive Accounting Effect**:
  - **Debit**: 2111 (Accounts Payable control account, carrying `supplier_id` subledger dimension).
  - **Credit**: 1111 (Cash in Hand) or 1112 (Bank Operating A/c).
  - **ZERO inventory movements, ZERO cost-lot mutations, ZERO COGS, ZERO GST, and ZERO purchase re-posting**.
- **Payment Method Account Resolution**:
  - Must resolve to a verified active leaf account in the General Ledger:
    - `CASH` $\longrightarrow$ Verified Account 1111 (Cash in Hand).
    - `BANK_TRANSFER`, `UPI`, `CHEQUE`, `CARD` $\longrightarrow$ Verified Account 1112 (Bank Operating A/c).
    - `OTHER` $\longrightarrow$ Requires explicit verified active leaf cash/bank asset account; unresolved mapping fails closed (`PAYMENT_ACCOUNT_UNRESOLVED`). No silent defaulting to 1112.
- **Outstanding Balance & Overpayment Defense**:
  - Purchase row locked `FOR UPDATE` prior to computing `alreadyPaid` and `outstandingBalance`.
  - Partial payments allowed.
  - Multi-installment exact settlement allowed.
  - Overpayment rejected with `PAYMENT_EXCEEDS_OUTSTANDING_BALANCE`.
  - Zero / negative amounts rejected with `INVALID_PAYMENT_AMOUNT`.
  - Payment on fully settled purchase rejected with `PURCHASE_ALREADY_SETTLED`.
- **Segregation of Duties (SoD)**:
  - `paidBy !== purchase.created_by` (requisition creator cannot disburse supplier payment).
  - `paidBy !== purchase.approved_by` (commercial approver cannot disburse supplier payment).
  - `SUPER_ADMIN` cannot bypass this restriction.
  - Disburser must possess canonical permission: `hasEffectivePermission(actorContext, "ACCOUNTING.POST")`.
- **Fail-Closed Configuration Guards**:
  - Unconfigured `accounting_start_date` $\longrightarrow$ payment rejected (`ACCOUNTING_START_DATE_NOT_CONFIGURED`).
  - Zero configured fiscal periods $\longrightarrow$ payment rejected (`FISCAL_PERIOD_NOT_CONFIGURED`).
- **Canonical Primitive Reuse**:
  - Directly reuses `PostingService` primitives (`validateAccountingStartDate`, `validateFiscalPeriod`, `createVoucherDraft`, `submitVoucher`, `approveVoucher`, `postVoucher`).
  - No duplicated accounting posting engine created.
- **Authoritative Accounting Event**:
  - Explicit idempotency: `reference_type = 'PURCHASE_PAYMENT'`, `reference_id = purchase_payment.id`, `reference_event = 'SUPPLIER_DISBURSEMENT'`.
- **Zero Historical Mutation**:
  - The 173 historical orders and 53 payment transactions remain strictly untouched.
- **Rollback-Guarded Verification**:
  - All test suites execute inside isolated database rollback transactions. Post-test live database state matches baseline exactly.
- **Zero Git Mutations**:
  - Zero commits, zero pushes.

---

## 2. Technical Implementation Architecture

### 2.1 Service Layer: `PurchasePaymentService`
Located at `frontend/src/lib/services/purchase-payment.service.ts`:

1. **`resolvePaymentAccount(method, explicitAccountId, client)`**:
   - Queries `accounting_account` to verify account existence, `is_active === true`, and `is_group === false`.
   - Handles `CASH` (1111), `BANK_TRANSFER`/`UPI`/`CHEQUE`/`CARD` (1112), and `OTHER` (leaf validation).
   - Rejects unmapped or group accounts with `PAYMENT_ACCOUNT_UNRESOLVED`.
2. **`recordPayment(params)`**:
   - Acquires `FOR UPDATE` lock on `purchase`.
   - Validates branch access (`BRANCH_ACCESS_DENIED`).
   - Asserts `purchase.status === 'POSTED'` (`INVALID_PURCHASE_STATUS`).
   - Validates accounting configuration (`validateAccountingStartDate`, `validateFiscalPeriod`).
   - Acquires `FOR UPDATE` lock on existing `purchase_payment` rows.
   - Computes `alreadyPaid` and `outstandingBalance`.
   - Enforces `amount > 0` and `amount <= outstandingBalance`.
   - Enforces SoD: `paidBy !== purchase.created_by` and `paidBy !== purchase.approved_by` (no `SUPER_ADMIN` bypass).
   - Checks canonical permission: `hasEffectivePermission(actorContext, "ACCOUNTING.POST")`.
   - Inserts `purchase_payment` record with generated ID `purp_...`.
   - Constructs double-entry journal lines:
     - Dr 2111 Accounts Payable (carrying `supplier_id` and `branch_id`).
     - Cr 1111/1112 Cash/Bank Account (carrying `branch_id`).
   - Chains canonical `PostingService` workflow:
     - `createVoucherDraft` (Type: `PAYMENT`, Ref: `PURCHASE_PAYMENT`, ID: `payment.id`, Event: `SUPPLIER_DISBURSEMENT`).
     - `submitVoucher` (with distinct preparer identity).
     - `approveVoucher` (by `paidBy`).
     - `postVoucher` (creates journal entry and journal lines, marks voucher `POSTED`).
   - Wraps caller transactions with `SAVEPOINT sp_purchase_payment` to guarantee rollback on any failure without dirtying caller state.
3. **`getPurchasePayments(purchaseId, client)`**:
   - Retrieves all active payments for a purchase.
   - Computes authoritative totals: `total_paid`, `balance_due`, `is_fully_settled`.

### 2.2 Integration Points
- **`PurchaseService.addPayment`** (`frontend/src/lib/services/purchase.service.ts`):
  Delegates directly to `PurchasePaymentService.recordPayment`.
- **API Route Handler** (`frontend/src/app/api/v1/[...path]/route.ts`):
  `POST /api/v1/admin/purchases/:id/payments` invokes `PurchasePaymentService.recordPayment` with verified session credentials and role context.

---

## 3. Verification & Test Evidence

### 3.1 Step 3D.5 Test Suite (`scratch/test_step3d5_purchase_payment.js`)
- **99/99 PASS (100%)**
  - Section 0: Pre-test baseline audit (9/9 PASS)
  - Section 1: Test harness setup in isolated rollback transaction (5/5 PASS)
  - Section 2: Purchase status guards (DRAFT, SUBMITTED, APPROVED, CANCELLED rejected) (8/8 PASS)
  - Section 3: Fail-closed configuration guards (start date & fiscal period) (7/7 PASS)
  - Section 4: Segregation of Duties (SoD) & RBAC on supplier disbursement (8/8 PASS)
  - Section 5: Payment amount validation & overpayment defense (6/6 PASS)
  - Section 6: Payment method account resolution & fail-closed defense (8/8 PASS)
  - Section 7: Atomic partial payment & multi-installment settlement (24/24 PASS)
  - Section 8: Concurrency & idempotency defenses (2/2 PASS)
  - Section 9: Atomicity with failure injection & rollback verification (4/4 PASS)
  - Section 10: Post-rollback pristine PostgreSQL baseline audit (18/18 PASS)

### 3.2 Regression Suites
- **Step 3D.4 Atomic Purchase Financial & Inventory Posting**: **136/136 PASS**
- **Step 3D.3 Voucher Accounting Approval & SoD**: **82/82 PASS**
- **Step 3D.2 Purchase Accounting Voucher Construction**: **67/67 PASS**
- **Step 3D.1 Purchase Tax Engine**: **58/58 PASS**
- **Independent PostgreSQL Baseline Check (`scratch/verify_phase4f_step3c22_independent.js`)**: **20/20 PASS**
- **Security Regression Suite (`scripts/run-security-regression-tests.ps1`)**: **21/21 PASS**
- **TypeScript Static Verification (`npx tsc --project tsconfig.json --noEmit`)**: **0 Diagnostics / 0 Errors**

---

## 4. Live PostgreSQL State Verification

| Entity / Invariant | Expected Baseline | Live State Post-Rollback | Verification Result |
| :--- | :--- | :--- | :--- |
| `accounting_account` | 98 | 98 | PASS |
| `accounting_voucher` | 0 | 0 | PASS |
| `accounting_journal_entry` | 0 | 0 | PASS |
| `accounting_journal_line` | 0 | 0 | PASS |
| `accounting_fiscal_period` | 0 | 0 | PASS |
| `purchase` | 0 | 0 | PASS |
| `purchase_item` | 0 | 0 | PASS |
| `purchase_payment` | 0 | 0 | PASS |
| `branch_inventory` | 424 | 424 | PASS |
| `inventory_cost_lot` | 0 | 0 | PASS |
| `inventory_movement` | 0 | 0 | PASS |
| `inventory_cost_consumption` | 0 | 0 | PASS |
| `packaging products` | 0 | 0 | PASS |
| `order` | 173 | 173 | PASS |
| `payment_transaction` | 53 | 53 | PASS |
| `accounting_start_date` | UNCONFIGURED | UNCONFIGURED | PASS |
| `git commits / pushes` | 0 | 0 | PASS |

---

## 5. Gate Boundary & Next Steps

The boundary has been strictly maintained:
- Step 3D.5 (Purchase Payments & AP Settlement) is **100% IMPLEMENTED, VERIFIED, AND FROZEN**.
- AP settlement is the exclusive financial effect (Dr 2111, Cr 1111/1112).
- Zero inventory movement, cost-lot creation, COGS, GST, or purchase re-posting occurred.
- Zero production financial posting while start date / fiscal period remain unconfigured.
- Execution halts at the verification gate. Do NOT begin Step 3D.6 or any subsequent accounting module.
