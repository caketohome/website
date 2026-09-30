# Phase 4F Step 4.5: Customer Receipts & AR Settlement Completion Checkpoint

- **Milestone Code**: `PHASE-4F-STEP-4.5-CUSTOMER-RECEIPTS-AR-01`
- **Scope**: Customer Receipts, Accounts Receivable Clearing, Cash on Delivery (COD) Branch Remittance, Payment Gateway Bank Settlement & MDR Fees, Authoritative AR Ledger Inquiries, and Concurrency Defense.
- **Status**: ✅ **VERIFIED & FROZEN**
- **Date**: 2026-09-26
- **Branch**: `task/dev`
- **Git Commit**: `f7d9a47` (Working tree clean, 0 commits, 0 pushes)

---

## 1. Executive Summary

Phase 4F Step 4.5 is **complete, rigorously verified, and frozen**.

In accordance with architectural authorization and strict domain invariants:
1. **Prepaid Customer Receipt Lifecycle (Dr 1113 / Cr 1121)**:
   - Debit: `1113 Gateway Clearing` (₹ Amount Received)
   - Credit: `1121 Accounts Receivable` (₹ Amount Settled)
   - Mutates `payment_transaction.status` to `'captured'`, `settlement_status` to `'unsettled'`.
   - Enriches `order.metadata` with `payment_status = 'captured'`, `receipt_voucher_id`, `receipt_journal_entry_id`, and `receipt_amount`.
2. **COD Cash Remittance Lifecycle (Dr 1111 / Cr 1122)**:
   - Debit: `1111 Cash in Hand` (Cash drawer receipt at branch register)
   - Credit: `1122 Undeposited COD` (Clears rider collection balance)
   - Enforces 3-way Segregation of Duties: Cashier accepting cash $\neq$ Supervisor verifying cash drawer $\neq$ GL Accountant posting to ledger.
   - Mutates `payment_transaction.status` to `'captured'`, `settlement_status` to `'settled'`.
3. **Payment Gateway Bank Settlement & MDR Fees (Dr 1112 + Dr 5290 / Cr 1113)**:
   - Debit: `1112 Bank Operating A/c` (Net bank deposit)
   - Debit: `5290 Payment Gateway MDR Fees` (Gateway commission / expense)
   - Credit: `1113 Gateway Clearing` (Gross captured funds cleared)
   - Exact mathematical identity enforced: $\text{netBankAmount} + \text{mdrFeeAmount} \equiv \text{grossAmount}$.
   - Clears gateway clearing balances and transitions linked payment transactions to `settlement_status = 'settled'`.
4. **Authoritative AR Computation**:
   - `CustomerReceiptService.getOrderOutstandingAr` computes outstanding AR directly from the General Ledger by querying the commercial AR debit lines (`1121` or `1122`) linked to the posted sales voucher minus all posted receipt vouchers.
   - Never conflates commercial invoice total with inventory COGS compound figures.
5. **Overpayment & Zero Payment Prevention**:
   - Receipts exceeding current outstanding AR balance fail closed with `OVERPAYMENT_NOT_PERMITTED`.
   - Non-positive amounts ($\le 0$) fail closed with `INVALID_AMOUNT`.
6. **Sequential Partial Receipts**:
   - Deterministically supports partial receipts against orders with positive remaining balances.
   - Distinguishes sequential receipts via `ORDER_RECEIPT`, `ORDER_RECEIPT_PARTIAL_2`, etc., cleanly conforming to the partial unique index `idx_accounting_voucher_source_idempotency` on `(reference_type, reference_id, reference_event)`.
7. **Strict Idempotency**:
   - Re-attempting a receipt on an already receipted payment transaction fails closed with `DUPLICATE_SOURCE_EVENT`.
   - Re-attempting gateway settlement with an already processed `payoutRef` fails closed with `DUPLICATE_SOURCE_EVENT`.
8. **Guest Customer FK Hygiene**:
   - Guest orders (`customer_id = 'guest'`) record `customer_id = null` on journal lines to satisfy foreign key constraint `accounting_journal_line_customer_id_fkey` to `public.customer`, preserving customer and order identity in narration and metadata.
9. **Concurrency & Deadlock Defense**:
   - Strict ascending lock acquisition: `order` (row lock) $\rightarrow$ `payment_transaction` (row lock) $\rightarrow$ `accounting_voucher` (row lock).
   - Re-verifies outstanding AR balance under row locks immediately before journal entry creation.

---

## 2. Invariants & Guard Rail Verification

| Invariant / Guard | Requirement | Verified Mechanism | Status |
| :--- | :--- | :--- | :---: |
| **Prepaid AR Clearing** | Dr 1113 / Cr 1121 | Verified 1:1 balance, clears customer open balance into clearing | ✅ PASS |
| **COD Remittance** | Dr 1111 / Cr 1122 | Verified 1:1 balance, records physical cash in drawer, clears undeposited COD | ✅ PASS |
| **Gateway Settlement** | Dr 1112 + Dr 5290 / Cr 1113 | Verified 3-line compound entry; net + fee === gross; clears 1113 to zero | ✅ PASS |
| **Settlement Math Guard** | Net + Fee === Gross | Fails closed with `INVALID_SETTLEMENT_MATH` if net + mdr $\neq$ gross | ✅ PASS |
| **MDR Fee Guard** | Valid positive fee | Fails closed with `MISSING_MDR_FEE` if mdr fee is negative | ✅ PASS |
| **Overpayment Guard** | Zero excess receipt | Rejects receipt amount > outstanding AR with `OVERPAYMENT_NOT_PERMITTED` | ✅ PASS |
| **Partial Receipts** | Incremental clearing | Multiple receipts decrement AR incrementally until ₹0.00 | ✅ PASS |
| **Source Idempotency** | Prevent duplicate capture | Re-executing transaction receipt rejects with `DUPLICATE_SOURCE_EVENT` | ✅ PASS |
| **Payout Idempotency** | Prevent duplicate payout | Re-executing gateway payout rejects with `DUPLICATE_SOURCE_EVENT` | ✅ PASS |
| **Guest FK Hygiene** | Valid FK on journal line | Guest orders record `customer_id = null` on journal line, preventing FK error | ✅ PASS |
| **Registered Customer FK**| Registered customer FK preserved | Registered customer receipts record real customer ID on journal line | ✅ PASS |
| **3-Way COD SoD** | Cashier $\neq$ Supervisor $\neq$ Accountant | Remitter, approver, and poster must be distinct staff identities | ✅ PASS |
| **Receipt SoD** | Creator/Submitter/Customer $\neq$ Poster | Preparer, submitter, and customer blocked from posting receipt | ✅ PASS |
| **Permission Guard** | `ACCOUNTING.APPROVE` & `POST` | Verified via canonical `hasEffectivePermission` resolver | ✅ PASS |
| **Branch Isolation (BOLA)**| Single-branch scope | Cross-branch receipt drafting or posting rejects with `BRANCH_ACCESS_DENIED` | ✅ PASS |
| **Pessimistic Concurrency**| Zero double consumption | Parallel requests for remaining balance fail closed after first capture | ✅ PASS |
| **Failure Atomicity** | Zero partial writes | Sub-transaction savepoints roll back cleanly on failure | ✅ PASS |
| **Pristine Database** | Zero live data mutation | 18/18 independent checks pass; baseline remains completely unpolluted | ✅ PASS |

---

## 3. Test & Verification Evidence

### 3.1 Step 4.5 Dedicated Test Suite (`test_step4_5_customer_receipts.js`)
- **Total Assertions**: **105 / 105 PASSED (100% Pass, 0 Failed)**.
- **Coverage**:
  - `[0/17]` Pre-test database baseline audit (11 baseline checks)
  - `[1/17]` Rollback transaction setup & catalog resolution
  - `[2/17]` Fail closed on unconfigured `accounting_start_date`
  - `[3/17]` Unposted sales order & historical prototype quarantine
  - `[4/17]` Authoritative outstanding AR & overpayment rejection
  - `[5/17]` Full prepaid customer receipt lifecycle (Dr 1113 / Cr 1121)
  - `[6/17]` Partial receipts & incremental AR reduction
  - `[7/17]` COD cash remittance workflow (Dr 1111 / Cr 1122)
  - `[8/17]` Guest customer foreign key hygiene
  - `[9/17]` Registered customer linkage
  - `[10/17]` Gateway settlement (Dr 1112 + Dr 5290 / Cr 1113)
  - `[11/17]` Settlement math mismatch & missing MDR guards
  - `[12/17]` Idempotency & duplicate event prevention
  - `[13/17]` Segregation of Duties (SoD) enforcement
  - `[14/17]` Permission resolution guards
  - `[15/17]` Branch isolation (BOLA defense)
  - `[16/17]` Concurrency defense (Zero double consumption)
  - `[17/17]` Failure injection & atomic rollback verification
  - `[Teardown]` Independent post-test PostgreSQL baseline verification (18 checks)

### 3.2 Upstream Regression Battery
| Regression Suite | Assertions | Result | Notes |
| :--- | :---: | :---: | :--- |
| **Step 4.5 Customer Receipts Suite** | 105 / 105 | **100% PASS** | `scratch/test_step4_5_customer_receipts.js` |
| **Step 4.4 Sales Posting & COGS Suite** | 111 / 111 | **100% PASS** | `scratch/test_step4_4_sales_posting.js` |
| **Step 4.3 Sales Voucher Approval Suite** | 69 / 69 | **100% PASS** | `scratch/test_step4_3_sales_approval.js` |
| **Step 4.2 Sales Voucher Construction Suite** | 72 / 72 | **100% PASS** | `scratch/test_step4_2_sales_voucher.js` |
| **Step 4.1 Sales Tax Engine Suite** | 121 / 121 | **100% PASS** | `scratch/test_sales_tax_engine.js` |
| **Step 3D.4 Purchase Atomic Posting Suite** | 136 / 136 | **100% PASS** | `scratch/test_step3d4_atomic_posting.js` |
| **Security Regression Suite (7 Findings)** | 21 / 21 | **100% PASS** | `scripts/run-security-regression-tests.ps1` |
| **TypeScript Compilation** | 0 diagnostics | **100% PASS** | `npx tsc --noEmit` |
| **Independent PostgreSQL Baseline Audit** | 18 / 18 | **100% PASS** | `scratch/forensic_baseline_step4_5.js` |

---

## 4. Exact File Modifications

### 4.1 Created Files
- [`frontend/src/lib/services/customer-receipt.service.ts`](file:///e:/vig/cakes2home-main/cakes2home-main/frontend/src/lib/services/customer-receipt.service.ts): Complete implementation of `CustomerReceiptService` with methods: `getOrderOutstandingAr`, `createCustomerReceiptDraft`, `submitCustomerReceipt`, `approveCustomerReceipt`, `postCustomerReceipt`, `postCodCashRemittance`, `postGatewaySettlement`.
- [`frontend/scratch/test_step4_5_customer_receipts.js`](file:///e:/vig/cakes2home-main/cakes2home-main/frontend/scratch/test_step4_5_customer_receipts.js): Comprehensive 17-group test suite verifying all receipt, remittance, payout, and concurrency flows.
- [`frontend/scratch/forensic_baseline_step4_5.js`](file:///e:/vig/cakes2home-main/cakes2home-main/frontend/scratch/forensic_baseline_step4_5.js): Standalone 18-point PostgreSQL baseline audit script.
- [`CHECKPOINTS/phase4f-step4-5-customer-receipts-ar-01.md`](file:///e:/vig/cakes2home-main/cakes2home-main/CHECKPOINTS/phase4f-step4-5-customer-receipts-ar-01.md): This checkpoint.

### 4.2 Modified Files
- [`frontend/src/lib/types/accounting.types.ts`](file:///e:/vig/cakes2home-main/cakes2home-main/frontend/src/lib/types/accounting.types.ts): Added receipt, settlement, and AR result types (`CustomerReceiptDraftParams`, `SubmitCustomerReceiptParams`, `ApproveCustomerReceiptParams`, `PostCustomerReceiptParams`, `PostCodCashRemittanceParams`, `PostGatewaySettlementParams`, `CustomerReceiptResult`, `GatewaySettlementResult`, `OrderOutstandingArResult`).
- [`frontend/src/lib/services/sales-posting.service.ts`](file:///e:/vig/cakes2home-main/cakes2home-main/frontend/src/lib/services/sales-posting.service.ts): Added read-only helper `getOrderOutstandingBalance` delegating to `CustomerReceiptService.getOrderOutstandingAr`; ensured guest orders set `customer_id = null` on journal lines to satisfy foreign key constraints.
- [`frontend/src/lib/services/index.ts`](file:///e:/vig/cakes2home-main/cakes2home-main/frontend/src/lib/services/index.ts): Exported `customer-receipt.service.ts`, `sales-posting.service.ts`, and `sales-tax-engine.ts`.
- [`frontend/scratch/test_step4_2_sales_voucher.js`](file:///e:/vig/cakes2home-main/cakes2home-main/frontend/scratch/test_step4_2_sales_voucher.js): Hardened fixture query to filter `id NOT LIKE 'ord_test_%'` to isolate live orders from test-created rows.

---

## 5. Frozen State & Next Step

- **Current State**: Phase 4F Step 4.5 is **FROZEN**.
- **Live Database Status**: 100% pristine. Zero fiscal periods created, `accounting_start_date` remains unconfigured, zero persistent financial rows.
- **Next Authorized Milestone**: **Phase 4F Step 4.6 — Credit Notes, Sales Returns & Customer Refunds**.
- **Boundary Warning**: Implementation of Step 4.6 must NOT begin until explicitly authorized by the user.
