# Phase 4F Step 3D.6-B Checkpoint — Full Posted Purchase Invoice Reversal / Void

**Status**: PASS / VERIFIED / CHECKPOINTED  
**Date**: 2026-09-25  
**Author**: Antigravity  
**Commit/Push**: NONE (Zero git mutations)

---

## 1. Executive Summary

Phase 4F Step 3D.6-B establishes and verifies the canonical, atomic purchase invoice reversal / void workflow for CakeToHome ERP:

```
[ POSTED Purchase Invoice Entered In Error ]
             │
             ├── SELECT purchase ... FOR UPDATE (Row-level lock)
             ├── Branch Isolation / BOLA check
             ├── Status Guard (DRAFT, SUBMITTED, APPROVED rejected with INVALID_PURCHASE_STATUS)
             ├── Fail-closed configuration check (accounting_start_date, fiscal_period)
             ├── Segregation of Duties (reversedBy !== created_by, reversedBy !== approved_by)
             │     └── SUPER_ADMIN cannot bypass SoD
             ├── Canonical permission check: hasEffectivePermission(actorContext, "ACCOUNTING.POST")
             ├── Zero Payments Guard: purchase_payment count === 0
             │     └── Rejects with CANNOT_REVERSE_PURCHASE_WITH_PAYMENTS if payments exist
             ├── Zero Prior Returns Guard: no DEBIT_NOTE vouchers against this purchase
             │     └── Rejects with CANNOT_REVERSE_CONSUMED_LOTS if physical returns exist
             ├── Zero Inventory Consumption Guard:
             │     ├── SELECT inventory_cost_lot ... FOR UPDATE
             │     ├── Validate lot.status === 'ACTIVE'
             │     ├── Validate lot.remaining_quantity === lot.received_quantity
             │     └── Check child consumption rows: inventory_cost_consumption count === 0
             ├── Physical Stock Availability Check:
             │     └── branch_inventory.quantity >= received_quantity for all catalog items
             ├── Locate Original Authoritative Voucher & Journal Entry:
             │     ├── original_voucher.status === 'POSTED'
             │     ├── original_voucher.reversed_by_voucher_id IS NULL
             │     └── original_journal.is_reversed === false
             ├── Construct Compensating Reversal Journal Lines (Exact Double-Entry Inversion):
             │     ├── Dr 2111 Accounts Payable [Full Invoice Total]
             │     ├── Cr 1131 / 1132 / 1133 Merchandise Inventory [Original Lot Cost Debits]
             │     ├── Cr 1141–1149 Input GST Accounts [Original ITC Debits]
             │     └── Cr 5240 Freight & Cartage Inward [Original OPEX Freight Debits, if applicable]
             ├── Canonical PostingService Primitives:
             │     ├── createVoucherDraft (Type: JOURNAL, Ref: PURCHASE_REVERSAL, Event: INVOICE_REVERSAL)
             │     │     └── reversal_of_voucher_id = original_voucher.id
             │     ├── submitVoucher (Transition to SUBMITTED)
             │     ├── approveVoucher (Transition to APPROVED)
             │     └── postVoucher (Inserts journal_entry & journal_lines, transitions to POSTED)
             ├── Establish Bidirectional Authoritative Linkage:
             │     ├── original_voucher.reversed_by_voucher_id = reversal_voucher.id (status remains POSTED)
             │     ├── reversal_voucher.reversal_of_voucher_id = original_voucher.id
             │     └── original_journal_entry.is_reversed = true, reversed_at = NOW()
             ├── Update Inventory Cost Lots:
             │     └── status = 'REVERSED', remaining_quantity = 0 (received_quantity preserved)
             ├── Decrement Physical Stock in branch_inventory.quantity for catalog items
             ├── Log Authoritative Inventory Movement:
             │     └── movement_type = 'INVOICE_REVERSAL', direction = 'OUT', linked to reversal_voucher.id
             ├── Update Purchase Metadata:
             │     └── is_reversed = true, reversal = { reversed_at, reversed_by, reversal_voucher_id, reason }
             └── COMMIT (or ROLLBACK EVERYTHING via savepoint on any error; zero partial state)
```

In accordance with strict gate boundaries:
- **Only POSTED Purchases Eligible**: Rejects reversal against unposted purchases (`DRAFT`, `SUBMITTED`, `APPROVED`) or non-existent purchases.
- **Zero Payments Required**: If any supplier payments exist on the invoice, reversal is blocked with `CANNOT_REVERSE_PURCHASE_WITH_PAYMENTS`. The payment disbursement lifecycle must be handled independently.
- **100% Unconsumed Stock Required**: If any portion of a cost lot has been consumed by sales fulfillment or returned via debit note, invoice voiding is blocked with `CANNOT_REVERSE_CONSUMED_LOTS`.
- **Physical Branch Stock Restitution**: Decrements physical stock in `branch_inventory` back to its pre-purchase level.
- **Canonical Double-Entry Compensating Entry**:
  - Inverts all original journal lines: Dr 2111 (AP) / Cr 1131-1133 (Inventory) / Cr 1141-1149 (Input GST).
  - Preserves dimensional attribution (`supplier_id`, `branch_id`, `tax_rate`, `tax_class`).
- **Bidirectional Ledger Integrity & Immutability**:
  - Original voucher remains immutable with status `POSTED`.
  - Reversal voucher created via standard lifecycle with status `POSTED`.
  - Linked via `reversed_by_voucher_id` and `reversal_of_voucher_id`.
  - Original journal entry flagged `is_reversed = true` with timestamp.
- **Idempotency**: Second reversal attempt fails closed with `PURCHASE_ALREADY_REVERSED`.
- **Downstream Protection**: Payment and return attempts against a reversed purchase fail closed.
- **Segregation of Duties (SoD)**: Purchase creator and approver cannot reverse; SUPER_ADMIN cannot bypass SoD; caller must possess `ACCOUNTING.POST`.
- **Transactional Rollback**: Zero persistence on failure; post-test PostgreSQL database returned to pristine baseline.

---

## 2. Evidence Verification Summary

### A. Test Execution Evidence

| Suite / Step | Tests Run | Result | Evidence File |
| :--- | :---: | :---: | :--- |
| **Phase 4F Step 3D.6-B (Purchase Reversal Suite)** | **101** | **PASS (101/101)** | `scratch/test_step3d6b_purchase_reversal.js` |
| **Phase 4F Step 3D.6-A (Purchase Return & Debit Note)** | **121** | **PASS (121/121)** | `scratch/test_step3d6a_purchase_return.js` |
| **Phase 4F Step 3D.5 (Purchase Payment & AP Settlement)** | **99** | **PASS (99/99)** | `scratch/test_step3d5_purchase_payment.js` |
| **Phase 4F Step 3D.4 (Atomic GL & Inventory Posting)** | **136** | **PASS (136/136)** | `scratch/test_step3d4_atomic_posting.js` |
| **Phase 4F Step 3D.3 (Voucher Approval & SoD)** | **82** | **PASS (82/82)** | `scratch/test_step3d3_voucher_approval.js` |
| **Phase 4F Step 3D.2 (Voucher Construction)** | **67** | **PASS (67/67)** | `scratch/test_step3d2_voucher_construction.js` |
| **Phase 4F Step 3D.1 (Purchase Tax Engine)** | **58** | **PASS (58/58)** | `scratch/test_purchase_tax_engine.js` |
| **Step 3C.2.2 Independent DB Verification** | **20** | **PASS (20/20)** | `scratch/verify_phase4f_step3c22_independent.js` |
| **Security Regression Suite** | **21** | **PASS (21/21)** | `scripts/run-security-regression-tests.ps1` |
| **TypeScript Compilation (`tsc --noEmit`)** | **Whole Project** | **0 Errors** | `frontend/tsconfig.json` |

### B. Independent PostgreSQL Database Baseline

Direct SQL audit after full test execution verifies that all temporary test artifacts rolled back cleanly:

```sql
SELECT count(*) FROM public.accounting_account;         -- 98
SELECT count(*) FROM public.accounting_voucher;         -- 0
SELECT count(*) FROM public.accounting_journal_entry;   -- 0
SELECT count(*) FROM public.accounting_journal_line;    -- 0
SELECT count(*) FROM public.accounting_fiscal_period;   -- 0
SELECT count(*) FROM public.purchase;                   -- 0
SELECT count(*) FROM public.purchase_item;              -- 0
SELECT count(*) FROM public.purchase_payment;           -- 0
SELECT count(*) FROM public.inventory_cost_lot;         -- 0
SELECT count(*) FROM public.inventory_movement;         -- 0
SELECT count(*) FROM public.inventory_cost_consumption; -- 0
SELECT count(*) FROM public.branch_inventory;           -- 424 (Pristine catalog count)
SELECT count(*) FROM public.order;                      -- 173 (Pristine historical count)
SELECT count(*) FROM public.payment_transaction;        -- 53  (Pristine historical count)
```

No historical data was touched, modified, or deleted.

---

## 3. Architecture & Code Changes

1. **`frontend/src/lib/types/accounting.types.ts`**:
   - Added `reversal_of_voucher_id?: string | null;` to `VoucherCreateInput`.
   - Added `INVOICE_REVERSAL` to `InventoryMovementType`.
2. **`frontend/src/lib/repositories/accounting-voucher.repository.ts`**:
   - Added `reversal_of_voucher_id` to `createDraft` SQL query and parameters.
3. **`frontend/src/lib/services/posting.service.ts`**:
   - Enhanced `linkReversal` to ensure bidirectional linkage: updates `reversal_of_voucher_id` on the compensating voucher if not already set, sets `reversed_by_voucher_id` on the original voucher, and marks the original journal entry as reversed (`is_reversed = true`, `reversed_at = NOW()`).
4. **`frontend/src/lib/services/purchase-reversal.service.ts`**:
   - Created `PurchaseReversalService.reversePurchase` implementing the complete 14-step reversal pipeline.
   - Enforces SoD, RBAC, branch isolation, zero payments, zero prior returns, zero cost consumption, stock availability, canonical voucher lifecycle, compensating GL inversion, lot status transition (`REVERSED`), inventory movement logging (`INVOICE_REVERSAL`), and purchase metadata updates.
5. **`frontend/src/lib/services/purchase-payment.service.ts`**:
   - Added check to reject payments against reversed purchases.
6. **`frontend/src/lib/services/purchase-return.service.ts`**:
   - Added check to reject physical returns against reversed purchases.
7. **`frontend/src/lib/services/index.ts`**:
   - Exported `PurchaseReversalService` and associated error classes/types.

---

## 4. Git Invariant Verification

- Git status: `no changes added to commit`
- Commits executed: **0**
- Pushes executed: **0**

---

## 5. Frozen State & Recovery Point

This checkpoint completes and freezes **Phase 4F Step 3D.6-B**.
Both sub-steps of Option C (Purchase Return & Void Suite) are now completely implemented and independently verified:
- **3D.6-A**: Physical Purchase Return & Supplier Debit Note (FROZEN)
- **3D.6-B**: Full Posted Purchase Invoice Reversal / Void (FROZEN)

**Recovery Point**: `CHECKPOINTS/phase4f-step3d6b-purchase-reversal-01.md`
