# Phase 4F Step 3D.4 Checkpoint — Atomic Purchase Financial & Inventory Posting

**Status**: PASS / VERIFIED / CHECKPOINTED  
**Date**: 2026-09-25  
**Author**: Antigravity  
**Commit/Push**: NONE (Zero git mutations)

---

## 1. Executive Summary

Phase 4F Step 3D.4 establishes and verifies the final, atomic posting transition from an `APPROVED` purchase voucher to full financial and physical recognition:

```
APPROVED voucher
      │
      ├── lock purchase (FOR UPDATE)
      ├── lock voucher (FOR UPDATE)
      ├── validate fiscal period (fail-closed if 0 configured)
      ├── validate accounting start date (fail-closed if unconfigured)
      ├── validate source / idempotency
      ├── validate journal balance (total_debit === total_credit)
      ├── create journal entry (POSTED)
      ├── create journal lines (Dr 1131/1132/1133/5240/114x, Cr 2111)
      ├── create inventory cost lots (1:1 with items, frozen Step 3D.1 calculated cost)
      ├── create inventory movements (PURCHASE_RECEIPT, direction IN)
      ├── update branch_inventory (catalog items only, non-negative quantity)
      ├── mark voucher POSTED (posted_by, posted_at, total_amount)
      ├── mark purchase POSTED (posted_at)
      └── COMMIT (or ROLLBACK EVERYTHING on any error; zero partial state)
```

In accordance with strict gate boundaries:
- **Full Atomicity Proven**: Zero partial state. If any validation, calculation, account resolution, or database constraint fails, all database changes are immediately rolled back.
- **Fail-Closed Configuration Guards**:
  - `accounting_start_date` unconfigured $\longrightarrow$ posting blocked (`ACCOUNTING_START_DATE_NOT_CONFIGURED`).
  - Zero configured fiscal periods $\longrightarrow$ posting blocked (`FISCAL_PERIOD_NOT_CONFIGURED`).
- **Segregation of Duties (SoD) on Posting**:
  - The GL poster (`postedBy`) cannot be the voucher creator (`voucher.created_by`), voucher submitter (`voucher.submitted_by`), purchase creator (`purchase.created_by`), or purchase approver (`purchase.approved_by`).
  - Even a `SUPER_ADMIN` cannot bypass this SoD rule.
- **Permission Resolver Enforced**:
  - Caller must possess `ACCOUNTING.POST` via canonical `hasEffectivePermission(actorContext, "ACCOUNTING.POST")`.
- **Accurate Financial & Inventory Allocation**:
  - **Inventory Cost Lots**: Cost lot `total_cost` and `unit_cost` are derived strictly from the frozen Step 3D.1 calculated cost (not master `cost_price`).
  - **Capitalized vs Operating Freight**: Capitalized freight (`INVENTORY_CAPITALIZED`) enters the inventory lot cost and debits inventory (1131/1132/1133); operating freight (`OPERATING_EXPENSE`) debits Freight Inward Expense (5240) and is excluded from lot cost.
  - **GST Recoverability**: Input GST debits the appropriate input tax asset accounts (1141-1146) and is strictly excluded from inventory cost.
  - **Accounts Payable (AP)**: Credit to 2111 equals the invoice payable amount exactly.
  - **Physical Stock**: `branch_inventory` quantity is updated for valid catalog items; uncataloged non-merchandise lines do not touch `branch_inventory`.
- **Zero Payment Settlement**:
  - `purchase_payment` remains 0; cash/bank accounts are completely untouched.
- **Zero Historical Mutation**:
  - The 173 historical orders and 53 payment transactions remain strictly untouched.
- **Rollback-Guarded Verification**:
  - All test suites execute inside isolated database rollback transactions. Post-test live database state matches baseline exactly.
- **Zero Git Mutations**:
  - Zero commits, zero pushes.

---

## 2. Technical Implementation Architecture

### 2.1 Service Layer: `PurchasePostingService.postPurchase`
Located at `frontend/src/lib/services/purchase-posting.service.ts`:

1. **Transactional Row Locking**:
   - `SELECT ... FROM purchase WHERE id = $1 FOR UPDATE`
   - `SELECT ... FROM purchase_item WHERE purchase_id = $1 FOR UPDATE`
   - `SELECT ... FROM accounting_voucher WHERE id = $1 FOR UPDATE`
   Prevents concurrent race conditions and double-posting.
2. **State Validation**:
   - Requires `purchase.status === 'APPROVED'`. If `purchase.status === 'POSTED'`, rejects with `PURCHASE_ALREADY_POSTED`.
   - Requires `voucher.status === 'APPROVED'`. Rejects invalid states with `INVALID_VOUCHER_STATE`.
3. **Segregation of Duties (SoD)**:
   - Evaluates:
     - `postedBy !== voucher.created_by`
     - `postedBy !== voucher.submitted_by`
     - `postedBy !== purchase.created_by`
     - `postedBy !== purchase.approved_by`
   - Fails closed with `SEGREGATION_OF_DUTIES_VIOLATION`. No `SUPER_ADMIN` bypass permitted.
4. **Permission Resolution**:
   - Evaluates `hasEffectivePermission(actorContext, "ACCOUNTING.POST")`. Fails closed with `PERMISSION_DENIED`.
5. **Tax & Inventory Cost Revalidation**:
   - Re-evaluates purchase line items using the frozen Step 3D.1 calculation engine (`calculatePurchaseTaxesAndTotals`).
   - Asserts calculated invoice total matches `purchase.total_amount` exactly.
6. **Delegated GL Posting (`PostingService.postVoucher`)**:
   - Revalidates `accounting_start_date` and active `accounting_fiscal_period`.
   - Validates double-entry debit-credit equality (`total_debit === total_credit`).
   - Inserts `accounting_journal_entry` and `accounting_journal_line` records.
   - Transitions voucher status to `POSTED` with `posted_by`, `posted_at`, and audit metadata.
7. **Inventory Cost Lot Creation (`inventory_cost_lot`)**:
   - Creates 1:1 cost lots for all merchandise lines using Step 3D.1 frozen calculated cost:
     - `unit_cost = line.inventoryLotUnitCost`
     - `total_cost = line.inventoryLotTotalCost`
     - `received_quantity = line.quantity`
     - `remaining_quantity = line.quantity`
     - `status = 'ACTIVE'`
   - Asserts mathematical consistency constraint: `ABS(total_cost - received_quantity * unit_cost) <= 0.05`.
8. **Physical Inventory Ledger & Stock Movement**:
   - Inserts parent `inventory_movement` records:
     - `movement_type = 'PURCHASE_RECEIPT'`
     - `direction = 'IN'`
     - `quantity = line.quantity`
     - `voucher_id = voucher.id`
   - For merchandise with catalog `variant_id`:
     - Locks `branch_inventory` row `FOR UPDATE` and safely increments `quantity`.
     - If row does not yet exist, creates row with `quantity = line.quantity, reserved = 0`.
9. **Purchase Completion**:
   - Updates `purchase.status = 'POSTED'` with `posted_at = NOW()`.
   - Returns full `PurchasePostingResult` containing IDs and metadata for audit trails.

---

## 3. Verification & Test Evidence

### 3.1 Step 3D.4 Test Suite (`scratch/test_step3d4_atomic_posting.js`)
- **136/136 PASS (100%)**
  - Section 0: Pre-test baseline audit (15/15 PASS)
  - Section 1: Test harness setup in rollback transaction (4/4 PASS)
  - Section 2: Fail-closed behavior (start date & fiscal period guards) (8/8 PASS)
  - Section 3: Segregation of Duties (SoD) on GL posting (10/10 PASS)
  - Section 4: Permission resolution (`ACCOUNTING.POST`) (2/2 PASS)
  - Section 5: Full atomic posting (GL journal, AP credit, cost lots, movements, stock) (44/44 PASS)
  - Section 6: Operating expense freight accounting (Account 5240) (8/8 PASS)
  - Section 7: Inter-state purchase (Input IGST debit) (7/7 PASS)
  - Section 8: Concurrency, idempotency & failure injection / rollback (10/10 PASS)
  - Section 9: Post-rollback pristine state audit (14/14 PASS)

### 3.2 Regression Suites
- **Step 3D.3 Voucher Accounting Approval & SoD**: **82/82 PASS**
- **Step 3D.2 Purchase Voucher Construction**: **67/67 PASS**
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

## 5. Next Step Boundary: Step 3D.5 Purchase Payments & AP Settlement

The boundary has been strictly maintained: posting creates Accounts Payable (2111) and inventory lots/movements. **Zero payment settlement was performed.**

Step 3D.5 (deferred to subsequent gate approval) will design and implement the payment workflow:
- Linking bank/cash disbursements to posted vouchers/AP liabilities.
- Authorizing and posting supplier disbursements (`purchase_payment` records, Dr 2111 Accounts Payable, Cr 1111/1112 Bank/Cash).
- Idempotency and reconciliation of settlement events.
