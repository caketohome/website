# Phase 4F Step 3C — Purchase Posting Service Controlled Implementation Checkpoint

**Checkpoint Identifier**: `CHECKPOINTS/phase4f-step3c-purchase-posting-service-01.md`  
**Execution Timestamp**: 2026-09-24 15:00:00 IST  
**Git Branch**: `task/dev`  
**Head Commit**: `f7d9a47 fix(checkout): resolve react child object render error...`  
**Status**: **PASS ✅**

---

## 1. Executive Summary

Phase 4F Step 3C establishes the production-grade, transaction-atomic **`PurchasePostingService`** ([purchase-posting.service.ts](file:///e:/vig/cakes2home-main/cakes2home-main/frontend/src/lib/services/purchase-posting.service.ts)) for CakeToHome ERP.

The service executes the authoritative transition:
$$\text{APPROVED PURCHASE} \longrightarrow \text{Accounting Voucher} \longrightarrow \text{Balanced Journal} \longrightarrow \text{Cost Lots} \longrightarrow \text{Inventory Movement} \longrightarrow \text{Physical Stock Update} \longrightarrow \text{POSTED PURCHASE}$$

All 25 operational, financial, cryptographic, and architectural constraints are strictly enforced:
- **Segregation of Duties (SoD)**: Enforced without "SYSTEM", "ADMIN", or fake identities.
- **Fail-Closed Configuration Gates**: Live posting is strictly blocked because `accounting_start_date` is unconfigured and 0 fiscal periods exist.
- **Transactional Atomicity**: Single PostgreSQL transaction with pessimistic row-locking (`SELECT FOR UPDATE`).
- **Cost Formula & Consistency**: Net inventory value excludes recoverable GST. Cost consistency constraint (`chk_cost_lot_cost_consistency`) strictly verified.
- **Audit & Idempotency**: 1:1 original lot constraint and duplicate voucher source-event prevention.
- **Historical Invariants**: Zero live database mutations occurred; all tests executed with complete rollback safety.

---

## 2. Segregation of Duties (SoD) Architecture Decision

### The Challenge
The core accounting engine requires that for any posted transaction:
$$\text{approved\_by} \neq \text{created\_by}$$
In automated or integrated ERP workflows, a common anti-pattern is introducing a synthetic `"SYSTEM"` user to auto-approve accounting vouchers generated from upstream purchase approvals. This would undermine audit integrity and violate accounting standards.

### The Resolution
In `PurchasePostingService`:
1. **Purchase Level**:
   - `purchase.approved_by` must be **non-null**.
   - `purchase.approved_by !== purchase.created_by` is strictly enforced. Self-approved purchases fail with `SEGREGATION_OF_DUTIES_VIOLATION`.
2. **Posting Actor Level**:
   - The authenticated staff member invoking `postPurchase({ postedBy, ... })` must **NOT** be the creator of the purchase (`postedBy !== purchase.created_by`). If the purchase creator attempts to post, the service aborts with `SEGREGATION_OF_DUTIES_VIOLATION`.
3. **Voucher Level**:
   - The accounting voucher inherits `created_by = purchase.created_by` (the operational requester/buyer).
   - The accounting voucher inherits `approved_by = purchase.approved_by` (the operational supervisor who authorized the expenditure).
   - The accounting voucher sets `posted_by = postedBy` (the finance/accounting officer executing the financial ledger post).
4. **No Bypass**:
   - No `"SYSTEM"` user string is accepted or generated.
   - No `"ADMIN"` role substring bypass is permitted.
   - If `approved_by` is missing or equal to `created_by`, or if `postedBy` equals `created_by`, posting is completely blocked.

---

## 3. Purchase Eligibility & Hard Validation Rules

Before entering the accounting or inventory pipeline, the service locks and verifies:
1. **Entity Existence**: Purchase, Branch, and Supplier must exist in PostgreSQL and be active.
2. **State Machine**: `purchase.status` must equal `'APPROVED'`. `DRAFT`, `SUBMITTED`, or `POSTED` statuses are rejected.
3. **Branch Scope (BOLA Defense)**: If caller passes `branchId`, it must match `purchase.branch_id` exactly.
4. **Items Non-Empty**: Purchase must contain at least 1 `purchase_item`.
5. **Catalog & Classification Integrity**:
   - For catalog items (`product_id IS NOT NULL`):
     - Product must exist and not be soft-deleted (`deleted_at IS NULL`).
     - `purchase_item.item_type` must strictly match `product.merchandise_type` (`CAKE` or `ACCESSORY`).
     - Classification mismatch throws `INVALID_MERCHANDISE_CLASSIFICATION`.
   - For packaging items:
     - `purchase_item.item_type` must be `'PACKAGING'`.
     - `product_id` may be `NULL`.
6. **Total & Tax Reconciliation**:
   - Header `taxable_value` must equal $\sum \text{item taxable\_value}$.
   - Header `cgst` must equal $\sum \text{item cgst}$.
   - Header `sgst` must equal $\sum \text{item sgst}$.
   - Header `igst` must equal $\sum \text{item igst}$.
   - Calculated total ($\sum \text{item total}$) must equal `purchase.total` within $\pm 0.05$ rounding tolerance.
7. **Idempotency Check**:
   - `purchase.status` must not be `'POSTED'`.
   - No existing voucher with `reference_type = 'PURCHASE'` and `reference_id = purchase.id`.
   - No existing cost lot for any `purchase_item.id`.

---

## 4. Accounting Voucher & Journal Construction

### Chart of Accounts Resolution (Dynamic DB Repository)
Hardcoded account IDs are prohibited. The service queries canonical active leaf accounts from `accounting_account`:
- **1131**: `Merchandise Inventory - Accessories`
- **1132**: `Merchandise Inventory - Cakes`
- **1133**: `Packaging Supplies Stock`
- **114x**: Input GST Accounts (resolved dynamically by `tax_rate` and component `CGST`, `SGST`, `IGST` from accounts with `subtype = 'INPUT_TAX'`)
- **2111**: `Accounts Payable (Creditors)`

### Financial Valuation & Double-Entry Balancing
1. **Debits**:
   - Net Inventory Asset Debits: Taxable value attributable to items is debited to 1131, 1132, or 1133 based on item type.
   - Recoverable GST Debits: Recoverable CGST, SGST, and IGST are debited to their respective input tax accounts (1141–1149).
2. **Credits**:
   - Accounts Payable Credit: Credited to 2111 for the full invoice payable amount (`purchase.total`).
3. **Double-Entry Equality**:
   $$\sum \text{Debits} = \sum \text{Credits} = \text{purchase.total}$$
   The journal line construction guarantees exact mathematical equality.

---

## 5. Inventory Cost Lots & Physical Movement

### Inventory Cost Lot Generation
For every item received, an original cost lot is created in `public.inventory_cost_lot`:
- `received_quantity = item.quantity`
- `remaining_quantity = item.quantity`
- `total_cost = item.taxable_value` (authoritative inventory asset debit; excludes recoverable GST)
- `unit_cost = ROUND(total_cost / received_quantity, 4)`
- Cost Consistency Check: Verified that $|(\text{received\_quantity} \times \text{unit\_cost}) - \text{total\_cost}| \le 0.05$, honoring `chk_cost_lot_cost_consistency`.
- Status: `'ACTIVE'`

### Physical Stock Update
- Updates `public.branch_inventory` atomically using `INSERT ... ON CONFLICT (branch_id, product_id, COALESCE(variant_id, '')) DO UPDATE SET quantity = quantity + EXCLUDED.quantity`.
- Only quantity-controlled items with `product_id` update physical stock. Packaging without a product catalog ID does not alter product inventory.

### Movement Ledger Traceability
- Creates an entry in `public.inventory_movement` for each receipt item:
  - `movement_type = 'PURCHASE_RECEIPT'`
  - `direction = 'IN'`
  - Full audit dimensions: `branch_id`, `product_id`, `variant_id`, `quantity`, `unit_cost`, `total_cost`, `purchase_id`, `voucher_id`, `created_by`.
- **Zero Cost Consumption**: A purchase receipt introduces cost layers; it does **not** consume them. Verified that 0 rows are inserted into `public.inventory_cost_consumption`.

---

## 6. Verification & Test Evidence

The comprehensive test suite (`frontend/scratch/test_purchase_posting_service.js`) was executed against the database, covering 52 discrete assertions across 7 test groups:

```text
=============================================================================
CakeToHome ERP — Phase 4F Step 3C PurchasePostingService Test Suite
=============================================================================

[1/7] Testing Live Accounting Configuration Guards...
  ✓ PASS: Live posting is refused under unconfigured accounting configuration
  ✓ PASS: Failure code is POSTING_GUARD_FAILED
  ✓ PASS: Refusal reason explicitly states configuration guard: "Accounting start date is unconfigured. Operational postings are locked until an official cut-off start date is established."

[2/7] Testing Segregation of Duties (SoD) Invariants...
  ✓ PASS: Self-approval (approved_by == created_by) is blocked with SEGREGATION_OF_DUTIES_VIOLATION
  ✓ PASS: Creator attempting to post voucher (postedBy == created_by) is blocked with SEGREGATION_OF_DUTIES_VIOLATION
  ✓ PASS: Unapproved purchase (approved_by is null) is blocked with SEGREGATION_OF_DUTIES_VIOLATION

[3/7] Testing Purchase Lifecycle & BOLA Isolation...
  ✓ PASS: DRAFT purchase is rejected with INVALID_PURCHASE_STATUS
  ✓ PASS: Mismatched branch scope is rejected with BRANCH_ACCESS_DENIED

[4/7] Testing Item Classification & Total Reconciliation...
  ✓ PASS: Classification mismatch (acc_01 labeled as CAKE) rejected with INVALID_MERCHANDISE_CLASSIFICATION
  ✓ PASS: Total mismatch (items sum 1180 != header total 1500) rejected with PURCHASE_TOTAL_MISMATCH

[5/7] Testing Full End-to-End Posting Simulation (Accessories, Cakes, Packaging)...
  ✓ PASS: Purchase successfully posted by PurchasePostingService
  ✓ PASS: Purchase status updated to POSTED
  ✓ PASS: Purchase posted_at timestamp is set
  ✓ PASS: Accounting voucher status is POSTED
  ✓ PASS: Voucher reference_type is PURCHASE
  ✓ PASS: Voucher reference_id links to purchase
  ✓ PASS: Voucher created_by inherited from purchase creator
  ✓ PASS: Voucher approved_by inherited from purchase approver
  ✓ PASS: Voucher posted_by set to posting actor
  ✓ PASS: Voucher total_amount matches purchase total (5310)
  ✓ PASS: Journal entry has exactly 6 lines (3 inventory debits, 2 GST debits, 1 AP credit)
  ✓ PASS: 1131 (Accessories) debited 1000
  ✓ PASS: 1132 (Cakes) debited 2500
  ✓ PASS: 1133 (Packaging) debited 1000
  ✓ PASS: 1143 (Input CGST) debited 405
  ✓ PASS: 1144 (Input SGST) debited 405
  ✓ PASS: 2111 (AP) credited 5310
  ✓ PASS: Double-entry journal strictly balances: 5310 == 5310
  ✓ PASS: Exactly 3 inventory cost lots created (1:1 with purchase items)
  ✓ PASS: Accessory lot: qty=10, rate=100, total=1000, status=ACTIVE
  ✓ PASS: Cake lot: qty=5, rate=500, total=2500, status=ACTIVE
  ✓ PASS: Packaging lot: qty=100, rate=10, total=1000, status=ACTIVE, product_id=NULL
  ✓ PASS: Physical branch_inventory for acc_01 incremented from 0 to 10
  ✓ PASS: Exactly 3 inventory movement records created (1:1 with purchase items)
  ✓ PASS: All movement records have movement_type = PURCHASE_RECEIPT and direction = IN
  ✓ PASS: Zero inventory_cost_consumption rows created during receipt

[6/7] Testing Idempotency on Second Attempt...
  ✓ PASS: Second posting attempt is rejected with PURCHASE_ALREADY_POSTED (No duplicate vouchers or lots)
  ✓ Simulation transaction successfully rolled back.

[7/7] Verifying Live Database Baseline Invariants...
  ✓ PASS: Table "accounting_account": count is 98 (expected: 98)
  ✓ PASS: Table "accounting_voucher": count is 0 (expected: 0)
  ✓ PASS: Table "accounting_journal_entry": count is 0 (expected: 0)
  ✓ PASS: Table "accounting_journal_line": count is 0 (expected: 0)
  ✓ PASS: Table "accounting_fiscal_period": count is 0 (expected: 0)
  ✓ PASS: Table "purchase": count is 0 (expected: 0)
  ✓ PASS: Table "purchase_item": count is 0 (expected: 0)
  ✓ PASS: Table "purchase_payment": count is 0 (expected: 0)
  ✓ PASS: Table "branch_inventory": count is 424 (expected: 424)
  ✓ PASS: Table "order": count is 173 (expected: 173)
  ✓ PASS: Table "payment_transaction": count is 53 (expected: 53)
  ✓ PASS: Table "inventory_cost_lot": count is 0 (expected: 0)
  ✓ PASS: Table "inventory_movement": count is 0 (expected: 0)
  ✓ PASS: Table "inventory_cost_consumption": count is 0 (expected: 0)
  ✓ PASS: Setting "accounting_start_date" remains UNCONFIGURED

=============================================================================
TOTAL CHECKS: 52 | PASSED: 52 | FAILED: 0
=============================================================================
PURCHASE POSTING SERVICE PASSED ALL SPECIFICATIONS! ✅
```

---

## 7. Security & Static Analysis

1. **Security Regression Suite (`scripts/run-security-regression-tests.ps1`)**:
   - `CRIT-01-A` to `HIGH-07-D`: **21 / 21 PASS**
   - Server session derivation verified.
   - BOLA / branch isolation enforced.
   - Client identity spoofing prevented.
2. **TypeScript Compilation (`tsc --project tsconfig.json --noEmit`)**:
   - Exited with **0 errors**.
3. **Live Database Counts**:
   - Confirmed 100% untouched:
     - `accounting_account = 98`
     - `accounting_voucher = 0`
     - `accounting_journal_entry = 0`
     - `accounting_journal_line = 0`
     - `accounting_fiscal_period = 0`
     - `purchase = 0`
     - `purchase_item = 0`
     - `purchase_payment = 0`
     - `inventory_cost_lot = 0`
     - `inventory_movement = 0`
     - `inventory_cost_consumption = 0`
     - `branch_inventory = 424`
     - `order = 173`
     - `payment_transaction = 53`
     - `accounting_start_date = UNCONFIGURED`
4. **Git Hygiene**:
   - No commits made.
   - No push executed.
   - No staging performed.

---

## 8. Final Gate Result

**PHASE 4F STEP 3C: PASS ✅**
