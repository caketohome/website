# Phase 4F Step 4.4: Atomic Sales Posting, Inventory Fulfillment & FIFO COGS Completion Checkpoint

- **Milestone Code**: `PHASE-4F-STEP-4.4-SALES-POSTING-COGS-01`
- **Scope**: Atomic General Ledger Posting of Approved Sales Vouchers, Deterministic FIFO Cost-Lot Consumption, Authoritative Inventory Fulfillment Ledgering, Physical Stock Decrement, and Balanced Compound Journal Entry Generation.
- **Status**: ✅ **VERIFIED & FROZEN**
- **Date**: 2026-09-26
- **Branch**: `task/dev`
- **Git Commit**: `f7d9a47` (Working tree clean, 0 commits, 0 pushes)

---

## 1. Executive Summary

Phase 4F Step 4.4 is **complete, rigorously verified, and frozen**.

In accordance with architectural authorization and strict domain invariants:
1. **Single Compound Journal Entry (1:1 with Voucher)**: Because `public.accounting_journal_entry.voucher_id` enforces a strict database `UNIQUE` constraint, Step 4.4 creates exactly ONE atomic compound journal entry per sales voucher, containing both:
   - **Commercial Side**: Dr 1121/1122 Accounts Receivable = Cr 4110/4120/4130 Merchandise Revenue + Cr 2121–2129 Output GST liability accounts (balanced to `invoiceTotal`).
   - **Operational Side**: Dr 5110/5120/5130 Cost of Goods Sold = Cr 1132/1131/1133 Merchandise Inventory accounts (balanced to `totalCogs`).
   - **Double-Entry Balance**: Exact paise-level mathematical identity $\sum \text{Debits} \equiv \text{invoiceTotal} + \text{totalCogs} \equiv \sum \text{Credits}$.
2. **Zero Cost Fabrication Guard**: CakeToHome is a retail trading business. If an order line requires $Q$ units and active cost lots at the branch have $< Q$ remaining units, the system **fails closed** with `INSUFFICIENT_COST_LOT_QUANTITY`. The engine **NEVER** consults `product.cost_price`, product metadata, selling prices, or dummy/average costs.
3. **Physical & Cost Lot Stock Verification**: Both physical `branch_inventory` availability and cost lot availability are verified prior to any state mutation.
4. **Deterministic Concurrency & Deadlock Prevention**: Row locks are acquired deterministically in strict ascending order:
   - Voucher locked `FOR UPDATE`.
   - Order locked `FOR UPDATE`.
   - `branch_inventory` locked `FOR UPDATE` sorted by `variant_id ASC`.
   - `inventory_cost_lot` locked `FOR UPDATE` sorted by `received_at ASC, id ASC`.
5. **Authoritative Ledger Records**:
   - `public.inventory_movement`: Parent record (`movement_type = 'SALES_FULFILLMENT'`, `direction = 'OUT'`).
   - `public.inventory_cost_consumption`: Child records (`chk_cost_consumption_math` verified).
   - `public.branch_inventory`: Physical stock quantity decremented atomically.
6. **Canonical Delegation**: Reuses canonical [`PostingService.postVoucher`](file:///e:/vig/cakes2home-main/cakes2home-main/frontend/src/lib/services/posting.service.ts), [`AccountingJournalRepository.createJournalEntry`](file:///e:/vig/cakes2home-main/cakes2home-main/frontend/src/lib/repositories/accounting-journal.repository.ts), and [`StaffAccessControl`](file:///e:/vig/cakes2home-main/cakes2home-main/frontend/src/lib/staff-access-control.ts).
7. **Transactional Atomicity & Zero Leakage**: All operations occur within a single PostgreSQL transaction. When executed with a caller-owned client, an internal `SAVEPOINT sp_sales_posting` guarantees zero partial mutations leak on failure.

---

## 2. Invariants & Guard Rail Verification

| Invariant / Guard | Requirement | Verified Mechanism | Status |
| :--- | :--- | :--- | :---: |
| **Compound Journal 1:1** | Preserve `accounting_journal_entry.voucher_id` UNIQUE constraint | Merges commercial lines and COGS lines into single compound journal entry | ✅ PASS |
| **Double-Entry Balance** | Exact paise balance | $\sum \text{Dr} \equiv \text{invoiceTotal} + \text{totalCogs} \equiv \sum \text{Cr}$ checked via `PostingService.validateJournalLines` | ✅ PASS |
| **Zero Cost Fabrication** | No synthetic or dummy costs | Throws `INSUFFICIENT_COST_LOT_QUANTITY` if available lots < required qty; ignores `product.cost_price` | ✅ PASS |
| **Physical Stock Guard** | Branch inventory checked | Throws `INSUFFICIENT_PHYSICAL_INVENTORY` if `branch_inventory.quantity` < required qty | ✅ PASS |
| **FIFO Determinism** | Oldest lot consumed first | `ORDER BY received_at ASC, id ASC FOR UPDATE`; updates lot `remaining_quantity` & status (`DEPLETED` when 0) | ✅ PASS |
| **Deadlock Prevention** | Consistent lock acquisition | Ordered locking by `variant_id ASC` and `received_at ASC, id ASC` | ✅ PASS |
| **Voucher State Machine** | Only `APPROVED` vouchers postable | Rejects `DRAFT`, `SUBMITTED`, `CANCELLED`, or already `POSTED` vouchers | ✅ PASS |
| **Segregation of Duties** | 4-way separation | Preparer, submitter, commercial order creator, and customer blocked from posting; requires `ACCOUNTING.POST` | ✅ PASS |
| **Historical Data Quarantine** | 173 prototype orders quarantined | Fails closed on missing `is_ledger_eligible` or `legacy_prototype = true` | ✅ PASS |
| **Accounting Cut-off Guard** | Fail closed on unconfigured dates | Blocks posting when `accounting_start_date` or fiscal periods are unconfigured | ✅ PASS |
| **Zero Leakage / Atomicity** | Atomic rollback | Uses `SAVEPOINT sp_sales_posting` on caller client; verified 0 partial movements, 0 consumptions, 0 journal entries on failure | ✅ PASS |
| **Live Database Baseline** | Zero persistent mutations | 18/18 independent database checks pass; `setting` start date remains 0 rows | ✅ PASS |

---

## 3. Test & Verification Evidence

### 3.1 Step 4.4 Dedicated Test Suite (`test_step4_4_sales_posting.js`)
- **Total Assertions**: 111 / 111 PASSED (0 FAILED).
- **Test Groups**:
  - `[0/15] Pre-test Database Baseline Audit`: 10/10 checks passed.
  - `[1/15] Rollback Transaction Setup`: Branch A, Cake product, Accessory product resolved.
  - `[2/15] Test Group 1: Fail Closed on Unconfigured Accounting Start Date`: Passed.
  - `[3/15] Test Group 2: Fail Closed on Unconfigured Fiscal Period`: Passed.
  - `[4/15] Test Group 3: Strict Zero Cost Fabrication Guard (Zero cost lots in DB)`: Passed.
  - `[5/15] Test Group 4: Fail Closed on Partial Cost Lots (7 available vs 10 required)`: Passed.
  - `[6/15] Test Group 5: Fail Closed on Insufficient Physical Branch Inventory`: Passed.
  - `[7/15] Test Group 6: Voucher State Machine Guards (DRAFT, SUBMITTED, CANCELLED)`: Passed.
  - `[8/15] Test Group 7: Permission & Authorization Guards (ACCOUNTING.POST)`: Passed.
  - `[9/15] Test Group 8: Segregation of Duties (SoD) Guards (Preparer, submitter, commercial creator, customer)`: Passed.
  - `[10/15] Test Group 9: Source Order Integrity & Quarantine Guards (Canceled order, legacy prototype)`: Passed.
  - `[11/15] Test Group 10: Happy Path Full Atomic Posting (Single Lot Cake)`: Passed.
    - Voucher transitioned to `POSTED`.
    - Invoice Total: ₹1,050.00; Total COGS: ₹700.00; Compound Journal: ₹1,750.00.
    - Debit 1121 AR ₹1,050.00 = Credit 4110 Cake Rev ₹1,000.00 + Credit 2121 CGST ₹25.00 + Credit 2122 SGST ₹25.00.
    - Debit 5110 Cake COGS ₹700.00 = Credit 1132 Cake Inventory ₹700.00.
    - Cost lot remaining quantity decremented from 10 to 8; physical branch inventory decremented from 10 to 8.
    - Inventory movement `SALES_FULFILLMENT` (OUT) recorded.
    - Cost consumption record created (2 units @ ₹350.00).
    - Source order audit trail updated (`financial_voucher_id`, `journal_entry_id`, `cogs_total`).
  - `[12/15] Test Group 11: Multi-Lot FIFO Consumption (Oldest lot depletion & partial second lot)`: Passed.
    - Lot 1 (received 2026-08-15) depleted to 0 and transitioned to `DEPLETED`.
    - Lot 2 (received 2026-09-01) partially consumed from 10 to 7 remaining (`ACTIVE`).
    - Total COGS: ₹2,160.00 (4 * 300 + 3 * 320).
  - `[13/15] Test Group 12: Mixed Merchandise Posting (Cake + Accessory + Delivery Fee)`: Passed.
    - Invoice Total: ₹820.00; Total COGS: ₹380.00; Compound Journal: ₹1,200.00.
    - Dr 5110 Cake COGS ₹300.00 / Cr 1132 Inventory ₹300.00.
    - Dr 5120 Accessory COGS ₹80.00 / Cr 1131 Inventory ₹80.00.
  - `[14/15] Test Group 13: Idempotency Guards`: Passed (re-posting `POSTED` voucher rejected with `VOUCHER_ALREADY_POSTED`).
  - `[15/15] Test Group 14: Failure Injection & Atomic Rollback Verification`: Passed.
    - Inactive GL account triggered failure inside posting engine.
    - Zero partial movements, zero partial consumptions, zero partial journal entries created; voucher status remained `APPROVED`.
  - `Post-Rollback Database Verification`: 11/11 baseline checks passed.

### 3.2 Upstream Accounting Regressions
1. **Step 4.3 Sales Voucher Approval & SoD (`test_step4_3_sales_approval.js`)**: 69 / 69 PASSED (0 FAILED).
2. **Step 4.2 Sales Voucher Construction (`test_step4_2_sales_voucher.js`)**: 72 / 72 PASSED (0 FAILED).
3. **Step 4.1 Sales Tax & Calculation Engine (`test_sales_tax_engine.js`)**: 121 / 121 PASSED (0 FAILED).
4. **Step 3D.7-B Accounts Payable Subledger (`test_step3d7b_ap_subledger.js`)**: 142 / 142 PASSED (0 FAILED).
5. **Step 3D.4 Atomic Purchase Posting (`test_step3d4_atomic_posting.js`)**: 136 / 136 PASSED (0 FAILED).

### 3.3 Security & TypeScript Diagnostics
- **Security Regression Suite (`scripts/run-security-regression-tests.ps1`)**: 21 / 21 PASSED (0 FAILED).
- **TypeScript Static Verification (`npx tsc --noEmit`)**: **0 errors, 0 diagnostics**.

### 3.4 Independent PostgreSQL Baseline Audit (`forensic_baseline_step4_4.js`)
Independent queries against live database outside transactions:
- `public.accounting_account`: 98
- `public.accounting_voucher`: 0
- `public.accounting_journal_entry`: 0
- `public.accounting_journal_line`: 0
- `public.accounting_fiscal_period`: 0
- `public.purchase`: 0, `public.purchase_item`: 0, `public.purchase_payment`: 0, `public.supplier`: 0
- `public.branch`: 57
- `public.branch_inventory`: 424 (pristine)
- `public.inventory_cost_lot`: 0
- `public.inventory_movement`: 0
- `public.inventory_cost_consumption`: 0
- `public.order`: 173 (historical prototype quarantined)
- `public.payment_transaction`: 53 (historical prototype quarantined)
- `public.setting` (`accounting_start_date`): **0 rows (UNCONFIGURED)**
- Synthetic non-acc rows in `branch_inventory`: 0
- **Baseline Audit Summary**: 18 / 18 PASSED (0 FAILED).

---

## 4. Next Milestone Boundary

**CRITICAL ARCHITECTURAL BOUNDARY: STOP HERE.**

- **Current Milestone**: Phase 4F Step 4.4 — **COMPLETE & FROZEN**.
- **Next Milestone**: **Phase 4F Step 4.5 — Customer Receipts & Accounts Receivable Settlement**.
- **Rule**: Do NOT implement Customer Receipts, Bank Reconciliation, AR Settlement, or Credit Notes during this task. Await explicit user authorization.
