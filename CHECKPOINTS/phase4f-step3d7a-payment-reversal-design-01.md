# Phase 4F Step 3D.7-A Design Lock — Supplier Payment Reversal / Void & Check Bounce Workflow

**Document Version**: 1.0.0  
**Status**: DESIGN LOCK — FROZEN SPECIFICATION BEFORE IMPLEMENTATION  
**Date**: 2026-09-25  
**Author**: Antigravity  
**Authoritative Recovery Point**: `CHECKPOINTS/phase4f-step3d6b-purchase-reversal-01.md`  
**Git Working Tree**: Clean, 0 staged files, 0 commits, 0 pushes  

---

## 1. Executive Summary & Purpose

Phase 4F Step 3D.7-A specifies the design and implementation for the canonical **Supplier Payment Reversal / Void & Check Bounce Workflow** in CakeToHome ERP.

### Context & Problem Statement
- In **Step 3D.5**, the supplier payment workflow was implemented: records a `public.purchase_payment` row and posts a `PAYMENT` voucher (Dr 2111 AP / Cr 1111 Cash or 1112 Bank).
- In **Step 3D.6-B**, invoice reversal was implemented with a mandatory guard: `CANNOT_REVERSE_PURCHASE_WITH_PAYMENTS` (*"Supplier payments must be reversed independently before voiding an invoice"*).
- Currently, no service method exists to reverse a supplier payment disbursement.
- If a cheque bounces, an ACH/wire transfer is rejected by the bank, a payment is entered twice, or an incorrect disbursement account was selected, the purchase invoice becomes permanently deadlocked: the invoice cannot have its payable balance restored, nor can it ever be voided under Step 3D.6-B.

### Purpose of Step 3D.7-A
Step 3D.7-A establishes the authoritative, auditable, and idempotent reversal pipeline for posted supplier payments, safely unwinding the disbursement in the General Ledger, restoring the Accounts Payable liability on the purchase invoice, establishing bidirectional voucher linkage, and enforcing strict Segregation of Duties (SoD).

---

## 2. Business Cases Supported

1. **Bounced Cheque / Returned Instrument**: Physical cheque disbursed to a bakery/supplier returned unpaid due to clearing issues.
2. **Failed Bank Wire / NEFT / RTGS / UPI**: Electronic transfer failed or rejected at the destination clearing bank.
3. **Duplicate Payment Entry**: Operator entered two payments against the same invoice in error.
4. **Incorrect Payment Source**: Payment posted against Account 1111 (Cash) when it was paid from Account 1112 (Bank), or vice versa.
5. **Pre-requisite for Purchase Invoice Void**: In accordance with Step 3D.6-B, all payments against an erroneous invoice must be reversed before the invoice itself can be voided.

---

## 3. Strict Architectural Invariants

### 3.1. Zero Inventory or Cost-Lot Mutations
A supplier payment is purely a financial settlement between Cash/Bank and Accounts Payable:
$$\text{Inventory Cost Lots} = 0 \text{ mutations}$$
$$\text{Branch Inventory Physical Stock} = 0 \text{ mutations}$$
$$\text{Inventory Movements} = 0 \text{ logged}$$
$$\text{Cost of Goods Sold (COGS)} = 0 \text{ mutations}$$

### 3.2. Compensating Double-Entry Inversion
Posted payment vouchers are immutable (`chk_voucher_posted_immutable`). Corrections use a compensating reversal entry:
- **Original Payment Voucher (Step 3D.5)**:
  - **Debit**: `2111` (Accounts Payable control account, carrying `supplier_id` & `branch_id`)
  - **Credit**: `1111` (Cash in Hand) or `1112` (Bank Operating A/c)
- **Compensating Reversal Voucher (Step 3D.7-A)**:
  - **Debit**: `1111` (Cash in Hand) or `1112` (Bank Operating A/c) [Disbursed Funds Restored]
  - **Credit**: `2111` (Accounts Payable control account) [AP Liability to Supplier Restored]
  - Preserves `supplier_id` and `branch_id` dimensions.
  - Sourced directly from the original payment journal lines — never guessed or defaulted.

### 3.3. Bidirectional Reversal Linkage & Voucher State
- **Original Voucher**:
  - Remains `status = 'POSTED'` (immutable per database check constraint `chk_voucher_status`).
  - Sets `reversed_by_voucher_id = reversal_voucher.id`.
- **Reversal Voucher**:
  - Created as `voucher_type = 'JOURNAL'`, `reference_type = 'PURCHASE_PAYMENT_REVERSAL'`, `reference_event = 'PAYMENT_REVERSAL'`.
  - Sets `reversal_of_voucher_id = original_voucher.id`.
  - Forward-only lifecycle: `DRAFT` $\rightarrow$ `SUBMITTED` $\rightarrow$ `APPROVED` $\rightarrow$ `POSTED`.
- **Original Journal Entry**:
  - Marked `is_reversed = true`, `reversed_at = NOW()`.

### 3.4. Soft-Deletion & Outstanding Balance Restoration
- The `public.purchase_payment` row is updated with `deleted_at = NOW()`.
- The calculation of outstanding balance on the purchase:
  $$\text{outstanding\_balance} = \text{purchase.total} - \sum_{\text{deleted\_at IS NULL}}(\text{amount}) - \sum(\text{debit\_notes})$$
- Because `deleted_at IS NOT NULL`, the reversed payment is automatically excluded.
- The invoice balance due is mathematically restored, allowing subsequent payment or invoice voiding.

### 3.5. Segregation of Duties (SoD) & RBAC
- **Payer Conflict**: Staff who created the payment (`payment.created_by`) CANNOT reverse it.
- **Purchase Creator Conflict**: Staff who created the purchase requisition (`purchase.created_by`) CANNOT reverse payments.
- **Purchase Approver Conflict**: Staff who commercially approved the purchase (`purchase.approved_by`) CANNOT reverse payments.
- **Super Admin Guard**: `SUPER_ADMIN` cannot bypass SoD if they were the payer or purchase creator.
- **Permission**: Reversing staff must possess canonical `ACCOUNTING.POST` permission (resolved via `hasEffectivePermission`).
- **Branch Isolation (BOLA)**: Caller branch context must match `purchase.branch_id`.

### 3.6. Concurrency & Idempotency
- Uses `SELECT ... FOR UPDATE` row-level locks on `purchase_payment`, `purchase`, and `accounting_voucher`.
- Attempting to reverse an already reversed payment fails closed with `PAYMENT_ALREADY_REVERSED`.
- Fail-closed accounting guards: Unconfigured start date or locked/unconfigured fiscal periods immediately abort the transaction.

---

## 4. End-to-End Execution Sequence

```
[ POSTED Supplier Payment to be Reversed ]
             │
             ├── 1. Validate Input (paymentId, purchaseId, branchId, reason, reversalDate, reversedBy)
             ├── 2. SELECT purchase_payment ... FOR UPDATE (Lock payment row)
             │     └── Reject if deleted_at IS NOT NULL (PAYMENT_ALREADY_REVERSED)
             ├── 3. SELECT purchase ... FOR UPDATE (Lock purchase row)
             │     ├── Verify purchase exists and branch matches (BRANCH_ACCESS_DENIED)
             │     └── Verify purchase status === 'POSTED' (INVALID_PURCHASE_STATUS)
             ├── 4. Fail-Closed Configuration Guards:
             │     ├── PostingService.validateAccountingStartDate(reversalDate)
             │     └── PostingService.validateFiscalPeriod(reversalDate)
             ├── 5. Segregation of Duties & RBAC:
             │     ├── Verify reversedBy !== payment.created_by (SEGREGATION_OF_DUTIES_VIOLATION)
             │     ├── Verify reversedBy !== purchase.created_by (SEGREGATION_OF_DUTIES_VIOLATION)
             │     ├── Verify reversedBy !== purchase.approved_by (SEGREGATION_OF_DUTIES_VIOLATION)
             │     ├── SUPER_ADMIN cannot bypass SoD
             │     └── hasEffectivePermission(actorContext, "ACCOUNTING.POST") (PERMISSION_DENIED)
             ├── 6. SELECT accounting_voucher ... FOR UPDATE (Lock original PAYMENT voucher)
             │     ├── Verify status === 'POSTED' (INVALID_VOUCHER_STATE)
             │     └── Verify reversed_by_voucher_id IS NULL (PAYMENT_ALREADY_REVERSED)
             ├── 7. SELECT accounting_journal_entry & accounting_journal_line:
             │     └── Verify is_reversed === false (PAYMENT_ALREADY_REVERSED)
             ├── 8. Construct Compensating Reversal Lines:
             │     ├── Exact inversion of original journal lines:
             │     │     Dr [Cash/Bank Account from original Cr line]
             │     │     Cr 2111 (Accounts Payable) [original Dr line]
             │     ├── Preserve supplier_id and branch_id dimensions
             │     └── PostingService.validateJournalLines(lines)
             ├── 9. Canonical PostingService Primitives:
             │     ├── createVoucherDraft (Type: JOURNAL, Ref: PURCHASE_PAYMENT_REVERSAL, Event: PAYMENT_REVERSAL)
             │     │     └── reversal_of_voucher_id = originalVoucher.id
             │     ├── submitVoucher (Transition to SUBMITTED)
             │     ├── approveVoucher (Transition to APPROVED; SoD enforced between preparer & approver)
             │     └── postVoucher (Inserts journal_entry & journal_lines, transitions to POSTED)
             ├── 10. Establish Bidirectional Reversal Linkage via PostingService.linkReversal:
             │     ├── originalVoucher.reversed_by_voucher_id = reversalVoucher.id
             │     ├── reversalVoucher.reversal_of_voucher_id = originalVoucher.id
             │     └── originalJournal.is_reversed = true, reversed_at = NOW()
             ├── 11. Soft-Delete Payment Record:
             │     └── UPDATE purchase_payment SET deleted_at = NOW(), reference = ...
             ├── 12. Recompute & Verify Restored Purchase Outstanding Balance
             └── 13. COMMIT (or ROLLBACK to savepoint on any error; zero partial state)
```

---

## 5. Test Suite Plan (`scratch/test_step3d7a_payment_reversal.js`)

The test suite will contain 11 comprehensive sections executed inside an isolated rollback transaction:

1. **[0/11] Pre-test PostgreSQL Baseline Verification**: All tables verified at clean baseline.
2. **[1/11] Test Harness Setup**: Branch, catalog item, test supplier, staff roles inside rollback transaction.
3. **[2/11] Payment & Purchase Status Guards**:
   - Reversal against non-existent payment (`PAYMENT_NOT_FOUND`).
   - Reversal against payment belonging to another purchase (`PAYMENT_NOT_FOUND`).
   - Reversal against non-POSTED purchase (`INVALID_PURCHASE_STATUS`).
4. **[3/11] Fail-Closed Configuration Guards**:
   - Reversal blocked when accounting start date is unconfigured (`ACCOUNTING_START_DATE_NOT_CONFIGURED`).
   - Reversal blocked when zero fiscal periods configured (`FISCAL_PERIOD_NOT_CONFIGURED`).
5. **[4/11] Segregation of Duties & RBAC**:
   - Reversal blocked when `reversedBy === payment.created_by` (`SEGREGATION_OF_DUTIES_VIOLATION`).
   - Reversal blocked when `reversedBy === purchase.created_by` (`SEGREGATION_OF_DUTIES_VIOLATION`).
   - Reversal blocked when `reversedBy === purchase.approved_by` (`SEGREGATION_OF_DUTIES_VIOLATION`).
   - Super Admin creator/payer cannot bypass SoD.
   - Staff lacking `ACCOUNTING.POST` rejected (`PERMISSION_DENIED`).
   - Cross-branch reversal blocked (`BRANCH_ACCESS_DENIED`).
6. **[5/11] Full Clean Payment Reversal Execution**:
   - Record clean partial payment of ₹2,500.
   - Execute reversal with valid supervisor.
   - Verify compensating reversal voucher (Type: `JOURNAL`, Status: `POSTED`, Ref: `PURCHASE_PAYMENT_REVERSAL`).
   - Verify double-entry GL lines: Dr Bank (1112) ₹2,500 / Cr AP (2111) ₹2,500.
   - Verify dimensions (`supplier_id`, `branch_id`).
   - Verify bidirectional linkage: `original.reversed_by_voucher_id` and `reversal.reversal_of_voucher_id`.
   - Verify original voucher remains immutable with status `POSTED`.
   - Verify original journal marked `is_reversed = true`, `reversed_at = NOW()`.
   - Verify `purchase_payment.deleted_at` is set.
   - Verify zero cost lots, zero movements, zero branch inventory mutations.
7. **[6/11] Outstanding Balance Restoration**:
   - Verify purchase outstanding balance restored from ₹3,500 back to ₹6,000.
   - Verify purchase `is_fully_settled` transitions back to `false`.
8. **[7/11] Reversal Idempotency**:
   - Re-reversing the same payment rejected with `PAYMENT_ALREADY_REVERSED`.
9. **[8/11] Downstream Invoice Void Unblocking (Integration with Step 3D.6-B)**:
   - Record exact payment settling an invoice (blocking 3D.6-B invoice void).
   - Reverse the payment using 3D.7-A.
   - Execute 3D.6-B invoice void — verify it now succeeds cleanly because zero active payments remain!
10. **[9/11] Concurrency & Savepoint Failure Injection**:
    - Pass invalid reversal date (prior to start date) — verify complete savepoint rollback.
    - Zero vouchers, zero journal entries, payment remains active.
11. **[10/11] Post-Rollback Baseline Audit**: All tables verified back to pristine state.
