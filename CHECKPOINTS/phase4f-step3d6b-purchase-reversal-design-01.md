# Phase 4F Step 3D.6-B Design Lock — Full Posted Purchase Invoice Reversal / Void

**Status**: DESIGN LOCKED  
**Date**: 2026-09-25  
**Author**: Antigravity  
**Target Module**: Phase 4F Step 3D.6-B (Full Posted Purchase Invoice Reversal)

---

## 1. Domain Differentiation: Purchase Return vs Invoice Reversal

| Dimension | Step 3D.6-A: Purchase Return / Debit Note | Step 3D.6-B: Purchase Invoice Reversal / Void |
| :--- | :--- | :--- |
| **Operational Reality** | Physical return of damaged/rejected goods to supplier after delivery acceptance. | Commercial/accounting correction of an invoice entered in error (e.g., duplicate, wrong supplier, incorrect branch). |
| **Scope** | Item/quantity based (partial or full). | Entire invoice must be voided in full. |
| **Prerequisites** | Lot must have remaining quantity >= return quantity. | Lot must have **never been touched** (100% unconsumed: `remaining_quantity === received_quantity`, 0 returns, 0 consumptions). |
| **Payment Status** | Can be executed with or without existing payments; reduces outstanding balance. | **STRICTLY BLOCKED** if any supplier payment has been recorded (`purchase_payment` count === 0). |
| **Voucher Type** | `DEBIT_NOTE` | `JOURNAL` (Compensating reversal voucher) |
| **Linkage** | Source event reference to debit note ID. | Bidirectional voucher linkage (`reversed_by_voucher_id` / `reversal_of_voucher_id`). |
| **Original Voucher** | Unchanged, remains active POSTED voucher. | Marked reversed via `reversed_by_voucher_id` (status remains POSTED per `chk_voucher_status`). |
| **Original Journal** | Unchanged, represents actual purchase event. | Marked `is_reversed = true, reversed_at = NOW()`. |
| **Cost Lot Status** | Remains `ACTIVE` (or `DEPLETED` if remaining reaches 0). | Transitions to `REVERSED`; `remaining_quantity = 0`. |
| **Inventory Movement** | `PURCHASE_RETURN` (`direction = 'OUT'`). | `INVOICE_REVERSAL` (`direction = 'OUT'`). |

---

## 2. Invariants & Pre-Condition Validation Pipeline

Before any state change occurs, `PurchaseReversalService.reversePurchase` enforces the following guards in a single atomic transaction:

1. **Purchase Existence & Status**:
   - `SELECT * FROM purchase WHERE id = $1 FOR UPDATE`
   - Must exist, `deleted_at IS NULL`.
   - `status === 'POSTED'` (`INVALID_PURCHASE_STATUS` if DRAFT, SUBMITTED, APPROVED).
2. **Branch Isolation (BOLA Defense)**:
   - `purchase.branch_id === branchId` (`BRANCH_ACCESS_DENIED`).
3. **No Prior Reversal (Idempotency)**:
   - Original voucher must not have `reversed_by_voucher_id IS NOT NULL` (`PURCHASE_ALREADY_REVERSED`).
4. **Zero Supplier Payments Guard**:
   - `SELECT COUNT(*) FROM purchase_payment WHERE purchase_id = $1 AND deleted_at IS NULL`
   - If count > 0 $\longrightarrow$ hard reject with `CANNOT_REVERSE_PURCHASE_WITH_PAYMENTS`.
   - Payments must be settled or reversed independently before an invoice can be voided.
5. **Zero Inventory Consumption Guard**:
   - Query all `inventory_cost_lot` for the purchase.
   - For every lot:
     - `lot.remaining_quantity === lot.received_quantity`
     - `lot.status === 'ACTIVE'`
     - Query `inventory_cost_consumption` for each lot: count must be 0.
     - If any lot quantity has been consumed, partially returned, or depleted $\longrightarrow$ hard reject with `CANNOT_REVERSE_CONSUMED_LOTS`.
6. **Physical Stock Availability**:
   - For catalog items with variants: `branch_inventory.quantity >= lot.received_quantity`.
   - If physical stock is insufficient $\longrightarrow$ hard reject with `INSUFFICIENT_STOCK_FOR_REVERSAL`.
7. **Segregation of Duties (SoD)**:
   - `reversedBy !== purchase.created_by` (`SEGREGATION_OF_DUTIES_VIOLATION`).
   - `reversedBy !== purchase.approved_by` (`SEGREGATION_OF_DUTIES_VIOLATION`).
   - `SUPER_ADMIN` cannot bypass this rule.
8. **Permission Authorization**:
   - `hasEffectivePermission(actorContext, "ACCOUNTING.POST")` must be true (`PERMISSION_DENIED`).
9. **Fail-Closed Accounting Configuration**:
   - `PostingService.validateAccountingStartDate(reversalDate, client)`
   - `PostingService.validateFiscalPeriod(reversalDate, client)`

---

## 3. Financial & Physical Execution Pipeline

Once validated:

1. **Original Voucher & Journal Lookup**:
   - Find original `PURCHASE` voucher posted for this purchase (`reference_type = 'PURCHASE'`, `reference_id = purchase.id`).
   - Fetch original journal entry and lines.
2. **Inverted Compensating Journal Lines**:
   - Invert debits and credits from the original entry:
     - Debit 2111 (Accounts Payable) for the total invoice amount.
     - Credit 1131/1132/1133 (Merchandise Inventory) for original inventory debits.
     - Credit 1141–1149 (Input GST) for original tax debits.
     - Credit 5240 (Freight) for original operating expense debits (if any).
   - Strictly balanced: Total Debit == Total Credit.
3. **Voucher Lifecycle via PostingService**:
   - Create draft reversal voucher:
     - `voucher_type: 'JOURNAL'`
     - `reversal_of_voucher_id: originalVoucher.id`
     - `reference_type: 'PURCHASE_REVERSAL'`
     - `reference_id: purchase.id`
     - `reference_event: 'INVOICE_REVERSAL'`
   - Submit $\rightarrow$ Approve $\rightarrow$ Post.
4. **Authoritative Reversal Linkage**:
   - Call `PostingService.linkReversal`:
     - Updates `originalVoucher.reversed_by_voucher_id = reversalVoucher.id`.
     - Updates `originalJournal.is_reversed = true, reversed_at = NOW()`.
     - Updates `reversalVoucher.reversal_of_voucher_id = originalVoucher.id`.
5. **Cost Lot Transition**:
   - For all cost lots of this purchase:
     - `status = 'REVERSED'`
     - `remaining_quantity = 0`
     - `updated_at = NOW()`
6. **Physical Branch Inventory Update**:
   - For all catalog items:
     - `branch_inventory.quantity = quantity - lot.received_quantity`.
7. **Authoritative Movement Ledger**:
   - Insert `inventory_movement`:
     - `movement_type = 'INVOICE_REVERSAL'`
     - `direction = 'OUT'`
     - `quantity = lot.received_quantity`
     - `voucher_id = reversalVoucher.id`
     - `purchase_id = purchase.id`
8. **Purchase Record Annotation**:
   - Update `purchase.metadata`: record reversal audit (`reversed_at`, `reversed_by`, `reversal_voucher_id`, `reason`).
   - `purchase.status` remains `POSTED` (conforming to `purchase_status_check` constraint).

---

## 4. Verification Plan

1. **Pre-test baseline audit**: All accounting & movement tables = 0.
2. **Purchase status guards**: DRAFT, SUBMITTED, APPROVED rejected.
3. **Fail-closed configuration guards**: Unconfigured date & period rejected.
4. **SoD enforcement**: Creator, approver, and Super Admin creator rejected.
5. **Payment blocking guard**: Purchase with recorded payment rejected with `CANNOT_REVERSE_PURCHASE_WITH_PAYMENTS`.
6. **Consumed lot blocking guard**: Purchase with partially returned or consumed lot rejected with `CANNOT_REVERSE_CONSUMED_LOTS`.
7. **Full clean reversal**:
   - Reversal voucher created in POSTED status.
   - Original voucher has `reversed_by_voucher_id`.
   - Reversal voucher has `reversal_of_voucher_id`.
   - Original journal marked `is_reversed = true`.
   - Cost lots marked `REVERSED` with `remaining_quantity = 0`.
   - Branch inventory decremented.
   - Movement logged as `INVOICE_REVERSAL` / `OUT`.
   - Inverted GL entry debits 2111 and credits Inventory & Tax.
8. **Idempotency guard**: Second reversal attempt on same purchase rejected with `PURCHASE_ALREADY_REVERSED`.
9. **Failure injection**: Atomicity rollback verification.
10. **Full rollback**: Clean PostgreSQL baseline audit.
