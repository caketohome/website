# Phase 4F Step 4.6: Sales Returns, Credit Notes & Customer Refunds — Forensic & Architecture Design Gate

- **Milestone Code**: `PHASE-4F-STEP-4.6-SALES-RETURNS-CREDIT-NOTES-REFUNDS-DESIGN-01`
- **Scope**: Forensic Investigation, Domain Accounting Rules, Return Policies, Inventory Lot Traceability, AR vs. Refund Settlement Matrix, Concurrency Defense, Segregation of Duties, and Step 4.6 Architecture Specification.
- **Status**: 🛡️ **FORENSIC & DESIGN GATE ONLY (ZERO IMPLEMENTATION)**
- **Date**: 2026-09-26
- **Branch**: `task/dev`
- **Git Commit**: `f7d9a47` (Clean worktree, 0 commits, 0 pushes)

---

## 1. Crash / Repository Recovery Status

- **Repository Integrity Audit**:
  - `git status`: Zero tracked modifications (`git status --short` shows 0 modified tracked files).
  - Current branch: `task/dev`.
  - HEAD commit: `f7d9a47073d64b0da305cc537a6eccb45938fd1b`.
  - Destructive Git commands (`git reset`, `git clean`, `git checkout -- .`): **STRICTLY NOT USED**.
  - Git commits / pushes: **ZERO COMMITS, ZERO PUSHES**.
- **Relevant Skills Inspection**:
  - `smart-coder`: Active & loaded.
  - `lazy-coder`: Active & loaded.
  - `postgresql-and-supabase`: Active & loaded.
  - `security-audit`: Active & loaded.
  - `security-auditing-and-owasp`: Active & loaded.
  - `clean-architecture`: Active & loaded.
  - **Skill Availability Report**: Dedicated standalone skills named `accounting/ERP`, `financial controls`, `inventory/accounting integration`, `GST/tax/accounting`, and `repository/service architecture` are **not installed** in the system configuration. Their domain principles and invariants are strictly upheld through `smart-coder`, `clean-architecture`, `postgresql-and-supabase`, and the established ERP codebase standards.

---

## 2. Step 4.5 Regression Results

The entire regression battery was independently executed and verified **100% green**:

| Suite | File | Assertions | Result |
| :--- | :--- | :---: | :---: |
| **Step 4.5 Customer Receipts & AR** | `frontend/scratch/test_step4_5_customer_receipts.js` | 105 / 105 | **100% PASS** |
| **Step 4.4 Sales Posting & COGS** | `frontend/scratch/test_step4_4_sales_posting.js` | 111 / 111 | **100% PASS** |
| **Step 4.3 Sales Voucher Approval** | `frontend/scratch/test_step4_3_sales_approval.js` | 69 / 69 | **100% PASS** |
| **Step 4.2 Sales Voucher Construction** | `frontend/scratch/test_step4_2_sales_voucher.js` | 72 / 72 | **100% PASS** |
| **Step 4.1 Sales Tax Engine** | `frontend/scratch/test_sales_tax_engine.js` | 121 / 121 | **100% PASS** |
| **Step 3D.4 Purchase Atomic Posting** | `frontend/scratch/test_step3d4_atomic_posting.js` | 136 / 136 | **100% PASS** |
| **Security Regression (7 Findings)** | `scratch/run_security_regression.js` | 21 / 21 | **100% PASS** |
| **TypeScript Compilation** | `frontend/` (`npx tsc --noEmit`) | 0 diagnostics | **100% PASS** |
| **Total Automated Regression Tests** | — | **635 / 635** | **100% PASS** |

---

## 3. Database Baseline Verification

Independent audit via `frontend/scratch/forensic_baseline_step4_5.js` verified 18/18 live PostgreSQL baseline points:

| Database Entity / Table | Expected Baseline | Actual Live Count | Status |
| :--- | :---: | :---: | :---: |
| `public.accounting_account` | 98 | 98 | ✅ PASS |
| `public.accounting_voucher` | 0 | 0 | ✅ PASS |
| `public.accounting_journal_entry` | 0 | 0 | ✅ PASS |
| `public.accounting_journal_line` | 0 | 0 | ✅ PASS |
| `public.accounting_fiscal_period` | 0 | 0 | ✅ PASS |
| `public.purchase` | 0 | 0 | ✅ PASS |
| `public.purchase_item` | 0 | 0 | ✅ PASS |
| `public.purchase_payment` | 0 | 0 | ✅ PASS |
| `public.supplier` | 0 | 0 | ✅ PASS |
| `public.branch` | 57 | 57 | ✅ PASS |
| `public.branch_inventory` | 424 | 424 | ✅ PASS |
| `public.inventory_cost_lot` | 0 | 0 | ✅ PASS |
| `public.inventory_movement` | 0 | 0 | ✅ PASS |
| `public.inventory_cost_consumption` | 0 | 0 | ✅ PASS |
| `public."order"` | 173 | 173 | ✅ PASS |
| `public.payment_transaction` | 53 | 53 | ✅ PASS |
| `public.setting` (`accounting_start_date`) | UNCONFIGURED (0 rows) | 0 rows | ✅ PASS |
| Synthetic non-acc rows in `branch_inventory` | 0 | 0 | ✅ PASS |

**Primacy of Live State**: Zero financial rows, zero persistent cost lots, zero test mutations leaked to production.

---

## 4. Actual Order & Fulfillment Findings

Forensic inspection of `public."order"` and `sales-posting.service.ts` revealed:
1. **Order Entity**:
   - `order` table has columns: `id`, `region_id`, `display_id`, `customer_id`, `version`, `status` (`pending` across all 173 rows), `currency_code`, `metadata` (JSONB), `created_at`, etc.
2. **Line Items Storage**:
   - Line items are stored in `order.metadata->'items'` as a JSONB array: `[{ product_id, variant_id, quantity, unit_price, discount, gst_rate }]`.
   - `public.order_item` exists in PostgreSQL schema but has **0 rows** in the live database.
3. **Fulfillment Tracking**:
   - Step 4.4 updates `order.metadata` with `inventory_fulfillment_posted_at`, `cogs_total`, `sales_voucher_id`, `sales_journal_entry_id`.
   - Authoritative fulfillment quantity and physical dispatch are logged in `public.inventory_movement` (`movement_type = 'SALES_FULFILLMENT'`, `direction = 'OUT'`) and `public.inventory_cost_consumption`.
4. **Merchandise Classification**:
   - Resolved strictly from `public.product.merchandise_type`: `'CAKE'` or `'ACCESSORY'`.
5. **Branch Attribution**:
   - Every sales voucher, inventory movement, cost lot, and branch inventory row carries `branch_id`.

---

## 5. Return Data Model Findings

PostgreSQL schema inspection regarding returns and refunds:
1. **Existing Tables in Database**:
   - `public.return`: 0 rows. Columns: `id, order_id, claim_id, exchange_id, status, refund_amount, metadata, created_at, ...`
   - `public.return_item`: 0 rows. Columns: `id, return_id, item_id, quantity, received_quantity, damaged_quantity, ...`
   - `public.refund`: 0 rows. Columns: `id, amount, payment_id, created_at, created_by, ...`
   - `public.order_lifecycle_refund`: 0 rows. Columns: `id, order_id, amount, refund_channel, reason_code, reason, actor_type, actor_id, provider_refund_id, status, metadata, ...`
2. **Accounting Voucher Capabilities**:
   - Constraint `chk_voucher_type` in `public.accounting_voucher` already explicitly supports:
     `'CREDIT_NOTE'` and `'PAYMENT'`.
   - Self-referential reversal foreign keys exist: `reversal_of_voucher_id` and `reversed_by_voucher_id`.
   - Partial unique index `idx_accounting_voucher_source_idempotency` on `(reference_type, reference_id, reference_event)` enforces deterministic deduplication.
3. **Inventory Movement Capabilities**:
   - Constraint `inventory_movement_movement_type_check` in `public.inventory_movement` already explicitly supports:
     `'SALES_RETURN'` and `'DAMAGE_WRITEOFF'`.

---

## 6. Cost-Lot Traceability Findings

In Step 4.4, fulfillment creates `inventory_cost_consumption` records linked to `inventory_movement`:
- Query to trace original COGS and cost lots for any fulfilled sales order:
  ```sql
  SELECT 
    icc.id AS consumption_id,
    icc.lot_id,
    icc.quantity AS consumed_quantity,
    icc.unit_cost,
    icc.total_cost,
    icl.product_id,
    icl.variant_id,
    icl.item_type,
    icl.remaining_quantity,
    icl.received_quantity,
    icl.status AS lot_status,
    im.branch_id
  FROM public.inventory_cost_consumption icc
  JOIN public.inventory_movement im ON im.id = icc.movement_id
  JOIN public.inventory_cost_lot icl ON icl.id = icc.lot_id
  WHERE im.order_id = $1 
    AND im.movement_type = 'SALES_FULFILLMENT'
    AND icl.product_id = $2
  ORDER BY icc.created_at DESC, icc.id DESC;
  ```
- **Traceability Guarantee**:
  - The exact purchase cost lot, exact unit cost, and exact consumed quantity are authoritatively recorded.
  - Zero cost fabrication: `product.cost_price` and average cost are **NEVER** used for return valuation.

---

## 7. Cake Return Policy (Perishable Bakery)

- **Physical Restocking**: **STRICTLY PROHIBITED**. Under Indian Food Safety and Standards Authority of India (FSSAI) regulations and bakery hygiene standards, perishable baked goods (cakes, pastries) that have left store custody cannot re-enter salable inventory.
- **Physical Inventory**: `branch_inventory.quantity` is **NEVER** incremented for returned cakes.
- **Cost Lots**: `inventory_cost_lot.remaining_quantity` is **NEVER** incremented.
- **COGS Treatment**:
  - Commercial revenue and output GST are credited/reversed via Credit Note (Dr 4190 Sales Returns / Dr Output GST / Cr 1121 AR).
  - COGS expense (`5110 COGS - Cakes`) is **NOT** reversed to inventory (`1132`), because the inventory was physically consumed/destroyed. Reinstating inventory would manufacture phantom assets on the balance sheet. The cost remains recognized as an incurred operational loss.
  - If returned damaged/spoiled cakes are audited at the branch, a zero-quantity or damage record may be noted in metadata, but inventory asset balance remains zero.

---

## 8. Accessory Return Policy (Non-Perishable Merchandise)

- **Physical Restocking**: **PERMITTED** if and only if returned in unopened, undamaged, re-salable condition (`is_resalable = true`).
- **Physical Inventory**: `branch_inventory.quantity` is incremented by `return_quantity`.
- **Cost Lot Reinstatement**:
  - Traced directly to the original cost lots recorded in `inventory_cost_consumption`.
  - Reinstated in reverse FIFO order (LIFO reversal) up to the exact quantity consumed from each lot.
  - If a lot was `DEPLETED`, its status transitions back to `ACTIVE`.
  - Database constraint `chk_cost_lot_qty_bound` (`remaining_quantity <= received_quantity`) is strictly respected.
- **COGS Reversal Entry**:
  - Debit: `1131 Merchandise Inventory - Accessories` (reinstating asset at exact historical unit cost).
  - Credit: `5120 Accessory Merchandise Sold` (reversing COGS expense).
- **Inventory Movement**:
  - Insert row in `public.inventory_movement`: `movement_type = 'SALES_RETURN'`, `direction = 'IN'`, `order_id`, `voucher_id`.
- **Damaged Accessory Policy**: If returned broken/defective, stock is NOT returned to salable inventory; COGS is not reversed to `1131`.

---

## 9. Packaging Return Policy (Supplies & Boxes)

- Packaging items (cake boxes, ribbons, thermal liners, bags) are single-use sanitary packaging consumables.
- Once dispatched to a customer, packaging cannot be reused or restocked.
- `branch_inventory` and `inventory_cost_lot` for packaging are **NEVER** reinstated upon sales return.
- Packaging expense (`5130 Packaging Materials Consumed`) is never reversed.

---

## 10. Credit Note Accounting Design

Authoritative verification of Chart of Accounts for Step 4.6:

| Code | Account Name | Type / Subtype | Leaf Status | System | Normal Balance | Role in Credit Note |
| :---: | :--- | :--- | :---: | :---: | :---: | :--- |
| **`4190`** | **Sales Returns, Refunds & Allowances** | `REVENUE` / `DIRECT_REVENUE` | **Leaf** (`is_group=false`) | **`true`** | **Debit** (Contra-Rev) | **Debited** for returned product taxable base |
| **`4130`** | Delivery Charges Collected | `REVENUE` / `DELIVERY_REVENUE` | Leaf | `true` | Credit | Debited only if delivery charge is refunded |
| **`2121`** | Output CGST 2.5% (Food/Bakery) | `LIABILITY` / `OUTPUT_TAX` | Leaf | `true` | Credit | **Debited** to reverse intra-state CGST (Cakes) |
| **`2122`** | Output SGST 2.5% (Food/Bakery) | `LIABILITY` / `OUTPUT_TAX` | Leaf | `true` | Credit | **Debited** to reverse intra-state SGST (Cakes) |
| **`2123`** | Output CGST 9.0% (Accessories) | `LIABILITY` / `OUTPUT_TAX` | Leaf | `true` | Credit | **Debited** to reverse intra-state CGST (Acc) |
| **`2124`** | Output SGST 9.0% (Accessories) | `LIABILITY` / `OUTPUT_TAX` | Leaf | `true` | Credit | **Debited** to reverse intra-state SGST (Acc) |
| **`2125`** | Output IGST 5.0% (Interstate Food) | `LIABILITY` / `OUTPUT_TAX` | Leaf | `true` | Credit | **Debited** to reverse interstate IGST (Cakes) |
| **`2126`** | Output IGST 18.0% (Interstate Acc) | `LIABILITY` / `OUTPUT_TAX` | Leaf | `true` | Credit | **Debited** to reverse interstate IGST (Acc) |
| **`1121`** | Accounts Receivable | `ASSET` / `RECEIVABLE` | Leaf | `true` | Debit | **Credited** to reduce customer open balance |
| **`1122`** | Undeposited COD | `ASSET` / `CURRENT_ASSET` | Leaf | `true` | Debit | **Credited** to reduce undeposited COD balance |
| **`1131`** | Merchandise Inventory - Accessories | `ASSET` / `INVENTORY` | Leaf | `true` | Debit | **Debited** upon resalable accessory return |
| **`5120`** | Accessory Merchandise Sold | `EXPENSE` / `COGS` | Leaf | `true` | Debit | **Credited** to reverse accessory COGS |

### Exact Double-Entry Structure (Credit Note Voucher):
```
[Commercial & Tax Reversal]
Debit  4190 Sales Returns, Refunds & Allowances     ₹ Taxable Base of Returned Items
Debit  2121/2123/2125/2126 Output GST Accounts      ₹ Exact Calculated Output Tax
Credit 1121 (or 1122) Accounts Receivable           ₹ Total Credit Note Amount (Gross)

[Inventory & COGS Reversal - Re-salable Accessories ONLY]
Debit  1131 Merchandise Inventory - Accessories    ₹ Restored Historical Lot Cost
Credit 5120 Accessory Merchandise Sold             ₹ Restored Historical Lot Cost
```
Invariant: $\sum \text{Debits} \equiv \sum \text{Credits}$ across both financial pairs.

---

## 11. GST / Tax Reversal Design

1. **Item-Level Reversal**:
   - Reverses GST line-by-line based on the effective taxable value of returned items.
   - Effective taxable value includes the exact proportional header discount allocated during Step 4.2 sales posting.
2. **Jurisdiction Preservation**:
   - Intra-state orders reverse to CGST + SGST (50/50 split).
   - Interstate orders reverse to IGST (100%).
   - Exact accounts (`2121` vs `2125`, `2123` vs `2126`) match the original sales voucher lines.
3. **Delivery Fee Tax**:
   - If delivery fee is credited (full cancellation prior to dispatch), delivery GST is reversed; otherwise, delivery fee is retained and not reversed.
4. **Rounding & Paise Integrity**:
   - Rounding to nearest paise with integer constraint: $\text{CGST} + \text{SGST} \equiv \text{Total Intra Tax}$.
5. **Fail-Closed Rule**:
   - If original sales voucher journal lines or tax engine metadata cannot be resolved, the return fails closed with `TAX_REVERSAL_DATA_UNAVAILABLE`.

---

## 12. Accounts Receivable (AR) Treatment

Authoritative ledger equation governing customer open debt:
$$\text{Net Invoiced} = \sum \text{Posted Sales Vouchers} - \sum \text{Posted Credit Notes}$$
$$\text{Net Collected} = \sum \text{Posted Receipts} - \sum \text{Posted Customer Refunds}$$
$$\text{Current Open AR Balance} = \text{Net Invoiced} - \text{Net Collected}$$

- Posting a Credit Note **always credits AR** (`1121` or `1122`).
- If an order is unpaid: The credit note reduces open customer debt.
- If an order is partially paid: The credit note absorbs the unpaid AR balance first; any surplus creates a refundable credit balance.
- If an order is fully paid: The credit note creates a credit balance on AR, which authoritatively authorizes a Customer Refund.

---

## 13. Prepaid Refund Design (Online / Gateway / Card / UPI)

When a customer return is approved for a prepaid order:
1. **Precondition**: A Credit Note voucher must be **POSTED** to the General Ledger first.
2. **Refund Authorization**:
   - Maximum refundable amount is calculated from the ledger: $\max(0, \text{Net Collected} - \text{Net Invoiced})$.
3. **Disbursement Voucher** (`voucher_type = 'PAYMENT'`):
   ```
   Debit  1121 Accounts Receivable     ₹ Refund Amount (Clearing credit balance to zero)
   Credit 1113 Gateway Clearing        ₹ Refund Amount (Deducted from payment processor)
   ```
4. **Payment Transaction Lifecycle**:
   - If full refund: `payment_transaction.status` transitions from `'captured'` to `'refunded'`.
   - If partial refund: `payment_transaction.status` transitions from `'captured'` to `'partially_refunded'`.
   - Order metadata records: `refund_voucher_id`, `refunded_amount`, `refund_status`.

---

## 14. Cash on Delivery (COD) Refund Design

1. **Scenario A: Return at Doorstep (Prior to Cash Collection)**:
   - Rider did not collect cash.
   - Credit Note credits `1122 Undeposited COD` (clearing rider open collection responsibility).
   - **Zero Cash Refund**: Customer paid nothing; cash drawer is untouched.
2. **Scenario B: Post-Delivery Return (After Cash Remittance Posted)**:
   - Cash was already collected and deposited at branch register (Step 4.5 Dr 1111 / Cr 1122).
   - Credit Note credits `1121 Accounts Receivable` (or `1122`).
   - Customer visits branch or requests cash refund:
     ```
     Debit  1121 Accounts Receivable    ₹ Refund Amount
     Credit 1111 Cash in Hand           ₹ Refund Amount (Paid from branch cash register)
     ```
   - Requires physical cash drawer verification by Branch Supervisor.

---

## 15. Payment Gateway Refund Integration (MDR & Reversals)

- When a gateway refund is executed via Razorpay / Stripe / Cashfree:
  - Gateway debits merchant clearing balance (`1113 Gateway Clearing`).
  - Note on MDR fees: Payment gateways in India (RBI rules) typically **do not refund MDR fees** on customer refunds. The MDR fee previously expensed to `5290` remains an operating cost of CakeToHome.
  - Journal entry reflects gross refund cleared: Dr 1121 / Cr 1113.
  - Gateway payout settlement (`postGatewaySettlement`) reconciliation maintains zero-leak clearing: gross debits $\equiv$ gross credits.

---

## 16. Partial Return & Refund Rules Matrix

| Scenario | Invoiced | Paid | Return Items | Credit Note | Ledger Effect on AR | Eligible Refund | Refund Journal Entry | Post-Refund AR |
| :--- | :---: | :---: | :---: | :---: | :--- | :---: | :--- | :---: |
| **1. Unpaid Full Return** | ₹1,000 | ₹0 | 100% | ₹1,000 | Cr 1121 ₹1,000 (AR ₹1,000 $\rightarrow$ ₹0) | **₹0.00** | None | ₹0.00 |
| **2. Unpaid Partial Return** | ₹1,000 | ₹0 | Acc ₹300 | ₹300 | Cr 1121 ₹300 (AR ₹1,000 $\rightarrow$ ₹700) | **₹0.00** | None | ₹700.00 |
| **3. Prepaid Full Return** | ₹1,000 | ₹1,000 | 100% | ₹1,000 | Cr 1121 ₹1,000 (AR ₹0 $\rightarrow$ -₹1,000) | **₹1,000.00** | Dr 1121 ₹1,000 / Cr 1113 ₹1,000 | ₹0.00 |
| **4. Prepaid Partial Return** | ₹1,000 | ₹1,000 | Acc ₹300 | ₹300 | Cr 1121 ₹300 (AR ₹0 $\rightarrow$ -₹300) | **₹300.00** | Dr 1121 ₹300 / Cr 1113 ₹300 | ₹0.00 |
| **5. Partial Pay, Minor Return** | ₹1,000 | ₹400 | Acc ₹300 | ₹300 | Cr 1121 ₹300 (AR ₹600 $\rightarrow$ ₹300) | **₹0.00** (Owes ₹300) | None | ₹300.00 |
| **6. Partial Pay, Major Return** | ₹1,000 | ₹400 | Cake ₹700 | ₹700 | Cr 1121 ₹700 (AR ₹600 $\rightarrow$ -₹100) | **₹100.00** | Dr 1121 ₹100 / Cr 1113 ₹100 | ₹0.00 |
| **7. Multi Partial Returns** | ₹1,000 | ₹1,000 | Return 1: ₹300<br>Return 2: ₹400 | ₹300<br>₹400 | Seq 1: Cr ₹300 (Ref ₹300)<br>Seq 2: Cr ₹400 (Ref ₹400) | **₹300.00**<br>**₹400.00** | Dr 1121 ₹300 / Cr 1113 ₹300<br>Dr 1121 ₹400 / Cr 1113 ₹400 | ₹0.00 |

---

## 17. Idempotency Design

1. **Credit Note Idempotency Key**:
   - `reference_type`: `'ORDER_RETURN'`
   - `reference_id`: `return_id` (or `order_id` for single returns)
   - `reference_event`: `'CREDIT_NOTE'` for full return; `'CREDIT_NOTE_PARTIAL_' + returnSequence` for partial returns.
   - Enforced by partial unique index `idx_accounting_voucher_source_idempotency` on `(reference_type, reference_id, reference_event)`.
2. **Customer Refund Idempotency Key**:
   - `reference_type`: `'CUSTOMER_REFUND'`
   - `reference_id`: `refund_id` (or `provider_refund_id`)
   - `reference_event`: `'REFUND_DISBURSEMENT'`
3. **Re-attempt Behavior**:
   - Fails closed immediately with `DUPLICATE_SOURCE_EVENT`.

---

## 18. Concurrency & Deterministic Locking Order

To prevent deadlocks and race conditions between concurrent returns, receipts, and inventory updates:

```
Step 1: SELECT * FROM public."order" WHERE id = $1 FOR UPDATE;
Step 2: SELECT * FROM public.payment_transaction WHERE order_id = $1 ORDER BY id ASC FOR UPDATE;
Step 3: SELECT * FROM public.accounting_voucher WHERE (reference_id = $1 OR metadata->>'order_id' = $1) ORDER BY id ASC FOR UPDATE;
Step 4: SELECT * FROM public.branch_inventory WHERE branch_id = $1 AND variant_id = ANY($2) ORDER BY variant_id ASC FOR UPDATE;
Step 5: SELECT * FROM public.inventory_cost_lot WHERE id = ANY($3) ORDER BY id ASC FOR UPDATE;
```
- Row-level lock acquisition is strictly ascending by table and primary key.
- Recalculates `getOrderOutstandingAr` and remaining returnable quantities **inside the transaction under row locks** before creating or posting any voucher.

---

## 19. Segregation of Duties (SoD) & Security

1. **Role & Permission Matrix**:
   - `createSalesReturnDraft`: Requires `SALES.CREATE` or `SUPPORT.AGENT`.
   - `approveCreditNote`: Requires `ACCOUNTING.APPROVE` (Branch Supervisor / Accounting Lead).
   - `postCreditNote`: Requires `ACCOUNTING.POST` (GL Accountant).
   - `postCustomerRefund`: Requires `ACCOUNTING.POST` (Disbursement Accountant).
2. **SoD Restrictions**:
   - Return preparer $\neq$ Approver $\neq$ Poster $\neq$ Customer.
   - Order creator $\neq$ Credit note poster.
   - **Super Admin Bypass**: Strictly rejected with `SEGREGATION_OF_DUTIES_VIOLATION`.
3. **Branch Scoping (BOLA Defense)**:
   - Validates that caller's authorized branch matches `order.branch_id`. Cross-branch mutations fail closed with `BRANCH_ACCESS_DENIED`.

---

## 20. Exact Files Likely to Change in Implementation

1. **New Services**:
   - `frontend/src/lib/services/sales-return.service.ts`: Implements `SalesReturnService` (draft, submit, approve, post credit notes, restore accessory cost lots, execute customer refunds).
2. **Type Additions**:
   - `frontend/src/lib/types/accounting.types.ts`: Return item inputs, credit note params, refund params, and result DTOs.
3. **Service Re-exports**:
   - `frontend/src/lib/services/index.ts`: Export `SalesReturnService`.
4. **AR Inquiry Updates**:
   - `frontend/src/lib/services/customer-receipt.service.ts`: Update `getOrderOutstandingAr` to factor in posted credit notes and posted refunds.
5. **Test Harness**:
   - `frontend/scratch/test_step4_6_sales_returns.js`: Comprehensive regression suite.

---

## 21. Exact Tables Likely to Change During Operation

| Table | Operation | Nature of Mutation |
| :--- | :---: | :--- |
| `public.accounting_voucher` | `INSERT` | New vouchers with `voucher_type = 'CREDIT_NOTE'` and `'PAYMENT'` |
| `public.accounting_journal_entry` | `INSERT` | GL header for credit notes and refunds |
| `public.accounting_journal_line` | `INSERT` | Debit 4190, Debit GST, Credit 1121 / Debit 1121, Credit 1113 |
| `public.inventory_movement` | `INSERT` | Restorable accessories: `movement_type = 'SALES_RETURN'`, `direction = 'IN'` |
| `public.inventory_cost_lot` | `UPDATE` | Restorable accessories: increment `remaining_quantity`, transition `status` to `ACTIVE` |
| `public.branch_inventory` | `UPDATE` | Restorable accessories: increment `quantity` |
| `public.payment_transaction` | `UPDATE` | Mutate `status` to `'partially_refunded'` or `'refunded'` |
| `public."order"` | `UPDATE` | Enrich `metadata` with return IDs, credit note IDs, and refund status |

---

## 22. Exact Proposed Journal Structures

### A. Full Return of Intra-State Cake Sale (Cake ₹1,000 + 5% GST ₹50 = ₹1,050)
```
[Credit Note Voucher - POSTED]
Dr 4190  Sales Returns, Refunds & Allowances        ₹1,000.00
Dr 2121  Output CGST 2.5% (Food/Bakery)                ₹25.00
Dr 2122  Output SGST 2.5% (Food/Bakery)                ₹25.00
Cr 1121  Accounts Receivable                         ₹1,050.00
(Total Debit: ₹1,050.00 | Total Credit: ₹1,050.00)
* Note: COGS 5110 and Inventory 1132 remain untouched (cake destroyed, not restorable).
```

### B. Full Return of Intra-State Accessory Sale (Acc ₹500 + 18% GST ₹90 = ₹590; Cost ₹250)
```
[Credit Note Voucher - POSTED]
Dr 4190  Sales Returns, Refunds & Allowances          ₹500.00
Dr 2123  Output CGST 9.0% (Accessories)                ₹45.00
Dr 2124  Output SGST 9.0% (Accessories)                ₹45.00
Cr 1121  Accounts Receivable                           ₹590.00

Dr 1131  Merchandise Inventory - Accessories           ₹250.00
Cr 5120  Accessory Merchandise Sold (COGS Reversal)    ₹250.00
(Total Debit: ₹840.00 | Total Credit: ₹840.00)
```

### C. Customer Refund Disbursement Voucher (Prepaid ₹1,050 via Gateway)
```
[Payment Voucher - POSTED]
Dr 1121  Accounts Receivable                         ₹1,050.00
Cr 1113  Gateway Clearing                            ₹1,050.00
(Total Debit: ₹1,050.00 | Total Credit: ₹1,050.00)
```

---

## 23. Failure Cases & Fail-Closed Guard Rails

1. **Unposted Order Return**: Returning an unposted sales order rejects with `ORDER_NOT_POSTED`.
2. **Historical Prototype Quarantine**: Quarantined orders reject with `LEGACY_PROTOTYPE_ORDER_REJECTED`.
3. **Quantity Exceeded**: Returning more than fulfilled quantity rejects with `RETURN_EXCEEDS_FULFILLED_QUANTITY`.
4. **Already Returned**: Re-attempting return on depleted line item rejects with `ITEM_ALREADY_RETURNED`.
5. **Cake Restocking Attempt**: Re-stocking perishable cakes rejects with `PERISHABLE_CAKE_RESTOCK_PROHIBITED`.
6. **Excess Refund**: Refunding more than collected cash/gateway balance rejects with `REFUND_EXCEEDS_NET_PAID`.
7. **Negative or Zero Amount**: Non-positive returns reject with `INVALID_AMOUNT`.
8. **Tax Data Missing**: Missing original tax proportion rejects with `TAX_REVERSAL_DATA_UNAVAILABLE`.
9. **Unconfigured Accounting Start Date**: Rejects with `ACCOUNTING_START_DATE_NOT_CONFIGURED`.
10. **Unconfigured Fiscal Period**: Rejects with `FISCAL_PERIOD_NOT_CONFIGURED`.
11. **Cross-Branch Attempt**: Rejects with `BRANCH_ACCESS_DENIED`.
12. **SoD Violation**: Rejects with `SEGREGATION_OF_DUTIES_VIOLATION`.

---

## 24. Test Strategy

1. **Pre-Test Baseline Audit**: 18/18 checks must verify pristine state.
2. **Transaction Isolation**: Entire test battery executes within an isolated `dbTransaction` with mandatory `ROLLBACK`.
3. **Dedicated Test Groups**:
   - Group 0: Fail-closed configuration guards (`accounting_start_date`, fiscal periods).
   - Group 1: Source order integrity & historical quarantine guards.
   - Group 2: Full cake return (Dr 4190 / Dr GST / Cr 1121; zero inventory reinstatement).
   - Group 3: Full accessory return with restorable inventory & FIFO cost lot reinstatement.
   - Group 4: Mixed merchandise return (Cake + Accessory).
   - Group 5: Partial returns & sequential idempotency (`CREDIT_NOTE_1`, `CREDIT_NOTE_2`).
   - Group 6: Over-return guard (attempting return > fulfilled quantity).
   - Group 7: Unpaid order return (AR reduced, zero refund).
   - Group 8: Prepaid order return & gateway refund lifecycle.
   - Group 9: Partial payment & partial return AR reconciliation.
   - Group 10: COD order return & cash drawer refund.
   - Group 11: SoD enforcement (preparer $\neq$ approver $\neq$ poster).
   - Group 12: Permission resolution guards (`ACCOUNTING.APPROVE`, `ACCOUNTING.POST`).
   - Group 13: BOLA cross-branch isolation.
   - Group 14: Pessimistic concurrency & double-refund prevention.
   - Group 15: Failure injection & atomic rollback verification.
4. **Post-Test Baseline Verification**: 18/18 checks run outside the transaction.

---

## 25. Explicit Out-of-Scope Items

1. **Automated Gateway Webhook Handling**: External live webhooks from Razorpay/Stripe are mock-tested in sandbox; live network calls are out-of-scope.
2. **Customer Wallet / Store Credit Engine**: Step 4.6 focuses on direct AR reduction and cash/gateway refunds; store credit balances/loyalty points are a separate module.
3. **Vendor Chargebacks & Dispute Arbitration**: Dispute workflows with card networks are out-of-scope.
4. **Historical Prototype Migration**: 173 historical orders remain quarantined.

---

## 26. Unresolved Schema & Business Gaps

1. **No Schema Alterations Needed**:
   - `accounting_voucher` already supports `'CREDIT_NOTE'` and `'PAYMENT'` voucher types.
   - `inventory_movement` already supports `'SALES_RETURN'` and `'DAMAGE_WRITEOFF'`.
   - `accounting_account` already includes leaf account `4190` (Sales Returns, Refunds & Allowances).
   - `payment_transaction.status` natively supports `'partially_refunded'` and `'refunded'`.
   - **Conclusion**: Step 4.6 requires **ZERO** database DDL migrations. It can be implemented cleanly with existing schema tables and constraints.
2. **Business Policy Confirmation**:
   - Cake policy: Verified (perishable, no restock, COGS not reversed to inventory).
   - Accessory policy: Verified (re-salable items restore cost lot via FIFO trace; damaged items written off).
   - Delivery fee policy: Non-refundable post-dispatch.

---

## 27. Stop & Next Boundary

- **Gate Status**: Forensic inspection and architecture design gate is **COMPLETE**.
- **Implementation Status**: **NOT STARTED**. Zero implementation files written. Zero database mutations committed.
- **Next Authorized Boundary**: User authorization to implement Phase 4F Step 4.6 (Sales Returns, Credit Notes & Customer Refunds).
