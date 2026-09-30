# Phase 4F Step 3D.6-A Checkpoint — Purchase Return & Supplier Debit Note

**Status**: PASS / VERIFIED / CHECKPOINTED  
**Date**: 2026-09-25  
**Author**: Antigravity  
**Commit/Push**: NONE (Zero git mutations)

---

## 1. Executive Summary

Phase 4F Step 3D.6-A establishes and verifies the canonical, atomic physical purchase return and supplier debit note workflow for CakeToHome ERP:

```
[ POSTED Purchase Invoice ] (Status === 'POSTED')
             │
             ├── SELECT purchase ... FOR UPDATE (Row-level lock)
             ├── Branch Isolation / BOLA check
             ├── Status Guard (DRAFT, SUBMITTED, APPROVED rejected with INVALID_PURCHASE_STATUS)
             ├── Fail-closed configuration check (accounting_start_date, fiscal_period)
             ├── Segregation of Duties (returnedBy !== created_by, returnedBy !== approved_by)
             │     └── SUPER_ADMIN cannot bypass SoD
             ├── Canonical permission check: hasEffectivePermission(actorContext, "ACCOUNTING.POST")
             ├── Validate return items and quantities (return_qty > 0)
             ├── SELECT inventory_cost_lot ... FOR UPDATE (Row-level lock per item)
             ├── Validate return_qty <= lot.remaining_quantity
             ├── Pro-rata tax & cost calculation (Rule 42 ITC reversal)
             ├── Decrement lot.remaining_quantity (transitions to 'DEPLETED' if remaining === 0)
             ├── Decrement physical branch_inventory.quantity for catalog items
             ├── INSERT inventory_movement (movement_type = 'PURCHASE_RETURN', direction = 'OUT')
             ├── Construct balanced double-entry DEBIT_NOTE journal lines:
             │     ├── Dr 2111 Accounts Payable (Carrying supplier_id & branch_id dimensions)
             │     ├── Cr 1131 / 1132 / 1133 Merchandise Inventory (Returned cost basis)
             │     └── Cr 1141–1149 Input GST Accounts (Reversal of Input Tax Credit)
             ├── Canonical PostingService primitives:
             │     ├── createVoucherDraft (Type: DEBIT_NOTE, Ref: PURCHASE_RETURN, Event: SUPPLIER_DEBIT_NOTE)
             │     ├── submitVoucher (Transition to SUBMITTED)
             │     ├── approveVoucher (Transition to APPROVED)
             │     └── postVoucher (Inserts journal_entry & journal_lines, transitions to POSTED)
             ├── Link voucher_id to inventory_movements
             └── COMMIT (or ROLLBACK EVERYTHING via savepoint on any error; zero partial state)
```

In accordance with strict gate boundaries:
- **Only POSTED Purchases Eligible**:
  - Rejects returns against `DRAFT`, `SUBMITTED`, or `APPROVED` purchases with `INVALID_PURCHASE_STATUS`.
  - Accounts Payable liability and inventory cost lots are only recognized upon invoice posting; physical returns on unposted requisitions are strictly prohibited.
- **Item & Cost-Lot Based Quantity Bounds**:
  - Every returned item is linked directly to its source `inventory_cost_lot`.
  - Return quantity must be $> 0$ and $\le \text{lot.remaining\_quantity}$.
  - Over-returns are strictly rejected with `RETURN_EXCEEDS_AVAILABLE_QUANTITY`.
  - When $\text{remaining\_quantity} = 0$, lot transitions to `status = 'DEPLETED'`.
  - `received_quantity`, `total_cost`, and `unit_cost` are preserved as immutable historical facts.
- **Physical Branch Stock Integration**:
  - Physical stock in `branch_inventory.quantity` is decremented for catalog items.
  - Rejects return if physical stock is insufficient.
  - Inserts authoritative `inventory_movement` records (`movement_type = 'PURCHASE_RETURN'`, `direction = 'OUT'`), linked to the debit note `voucher_id`.
- **Double-Entry General Ledger Effect**:
  - **Debit**: 2111 (Accounts Payable control account, carrying `supplier_id` and `branch_id`).
  - **Credit**: 1131 / 1132 / 1133 (Merchandise Inventory - Accessories, Cakes, Packaging) for returned cost basis.
  - **Credit**: 1141–1149 (Input CGST/SGST/IGST Accounts) for reversal of Input Tax Credit under GST Rule 42.
  - Strictly balanced: Total Debit == Total Credit.
- **AP Settlement Integration**:
  - Posted `DEBIT_NOTE` vouchers are automatically detected by `PurchasePaymentService.getPurchasePayments` and `PurchasePaymentService.recordPayment`.
  - Outstanding balance is reduced by the debit note total.
  - Overpayment defense prevents paying more than the adjusted net balance.
- **Segregation of Duties (SoD)**:
  - `returnedBy !== purchase.created_by` (requisition creator cannot authorize return/debit note).
  - `returnedBy !== purchase.approved_by` (commercial approver cannot authorize return/debit note).
  - `SUPER_ADMIN` cannot bypass SoD restriction.
  - Caller must possess canonical permission: `hasEffectivePermission(actorContext, "ACCOUNTING.POST")`.
- **Fail-Closed Configuration Guards**:
  - Unconfigured `accounting_start_date` $\longrightarrow$ return rejected (`ACCOUNTING_START_DATE_NOT_CONFIGURED`).
  - Zero configured fiscal periods $\longrightarrow$ return rejected (`FISCAL_PERIOD_NOT_CONFIGURED`).
- **Zero Historical Mutation**:
  - Historical 173 orders and 53 payment transactions remain 100% untouched.
- **Rollback-Guarded Verification**:
  - All test suites execute inside isolated database rollback transactions. Post-test live database state matches baseline exactly.
- **Zero Git Mutations**:
  - Zero commits, zero pushes.

---

## 2. Technical Implementation Architecture

### 2.1 Service Layer: `PurchaseReturnService`
Located at `frontend/src/lib/services/purchase-return.service.ts`:

1. **`processReturn(params)`**:
   - Acquires `FOR UPDATE` lock on `purchase`.
   - Validates branch access (`BRANCH_ACCESS_DENIED`).
   - Asserts `purchase.status === 'POSTED'` (`INVALID_PURCHASE_STATUS`).
   - Validates accounting configuration (`validateAccountingStartDate`, `validateFiscalPeriod`).
   - Validates SoD (`returnedBy !== purchase.created_by` and `returnedBy !== purchase.approved_by`).
   - Resolves effective permissions (`ACCOUNTING.POST`).
   - Validates non-empty item array and non-zero positive quantities.
   - For each item:
     - Locks source `inventory_cost_lot`.
     - Validates `returnQty <= lot.remaining_quantity`.
     - Computes pro-rata inventory cost basis and reversed GST components (CGST, SGST, IGST).
     - Updates `inventory_cost_lot` remaining quantity and sets status to `DEPLETED` if exhausted.
     - Decrements `branch_inventory.quantity` for catalog items.
     - Inserts `inventory_movement` record.
   - Constructs balanced journal lines (`Dr 2111`, `Cr Inventory`, `Cr Input Tax`).
   - Executes draft $\rightarrow$ submit $\rightarrow$ approve $\rightarrow$ post voucher lifecycle via `PostingService`.
   - Links generated `voucher_id` to `inventory_movement` rows.
   - Entire workflow is isolated via PostgreSQL savepoint (`SAVEPOINT sp_purchase_return`), guaranteeing zero partial persistence upon any error.

### 2.2 Payment Service Integration: `PurchasePaymentService`
Located at `frontend/src/lib/services/purchase-payment.service.ts`:
- Updated `recordPayment` and `getPurchasePayments` to query and deduct posted `DEBIT_NOTE` vouchers from `outstandingBalance` / `balance_due`:
  ```sql
  SELECT COALESCE(SUM(total_amount), 0) AS total_returns
  FROM public.accounting_voucher
  WHERE reference_type = 'PURCHASE_RETURN'
    AND metadata->>'purchase_id' = $1
    AND status = 'POSTED'
    AND deleted_at IS NULL;
  ```

---

## 3. Independent Verification Results

### 3.1 Step 3D.6-A Dedicated Test Suite (`scratch/test_step3d6a_purchase_return.js`)
**Result: 121 PASSED, 0 FAILED (100% PASS RATE)**

- **Section 0**: Pre-test baseline audit (10/10 PASS)
- **Section 1**: Isolated rollback transaction harness setup (5/5 PASS)
- **Section 2**: Purchase status guards (DRAFT, SUBMITTED, APPROVED, non-existent rejected) (8/8 PASS)
- **Section 3**: Fail-closed configuration guards (start date & fiscal period) (5/5 PASS)
- **Section 4**: Segregation of Duties (SoD) & RBAC on purchase returns (10/10 PASS)
- **Section 5**: Return quantity and item validation guards (10/10 PASS)
- **Section 6**: Atomic partial purchase return & supplier debit note (25/25 PASS)
- **Section 7**: Full exhaustion return & transition to DEPLETED (8/8 PASS)
- **Section 8**: Multi-item return across merchandise classifications (Cakes + Packaging) (8/8 PASS)
- **Section 9**: AP settlement & outstanding balance reduction after debit notes (11/11 PASS)
- **Section 10**: Atomicity, savepoint rollback & failure injection (4/4 PASS)
- **Section 11**: Post-rollback pristine baseline audit (17/17 PASS)

### 3.2 Full Regression Suite
- **Step 3D.5 Purchase Payment & AP Settlement**: **99/99 PASS**
- **Step 3D.4 Atomic Purchase Financial & Inventory Posting**: **136/136 PASS**
- **Step 3D.3 Voucher Accounting Approval & SoD**: **82/82 PASS**
- **Step 3D.2 Purchase Accounting Voucher Construction**: **67/67 PASS**
- **Step 3D.1 Purchase Tax Engine**: **58/58 PASS**
- **Independent PostgreSQL Baseline Check (`scratch/verify_phase4f_step3c22_independent.js`)**: **20/20 PASS**
- **Security Regression Suite (`scripts/run-security-regression-tests.ps1`)**: **21/21 PASS**
- **TypeScript Static Verification (`npx tsc --noEmit`)**: **0 Diagnostics / 0 Errors**

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
- **Phase 4F Step 3D.6-A (Purchase Return & Supplier Debit Note)** is **100% IMPLEMENTED, VERIFIED, AND FROZEN**.
- **Phase 4F Step 3D.6-B (Full Posted Purchase Invoice Reversal)** has **NOT BEEN TOUCHED OR IMPLEMENTED**.
- In accordance with instructions:
  > *"No Step 3D.6-B implementation until 3D.6-A passes its independent verification gate."*
- Execution halts at this verification gate. Do NOT begin Step 3D.6-B until explicitly authorized.
