# Phase 4F Step 4.7: Full Sales Invoice Reversal & Void Service — Forensic & Architecture Design Gate

- **Milestone Code**: `PHASE-4F-STEP-4.7-SALES-INVOICE-REVERSAL-VOID-DESIGN-01`
- **Scope**: Read-only forensic investigation, voucher lifecycle analysis (Pre-Posting Void vs. Posted Compensating Reversal), GL journal inversion, multi-line GST reversal, AR credit adjustment, interaction with customer receipts (Step 4.5) and credit notes (Step 4.6), perishable food safety & accessory FIFO restocking rules, Segregation of Duties (SoD), BOLA defense, concurrency lock order, and state matrix.
- **Status**: 📋 **FORENSIC & ARCHITECTURE DESIGN GATE ACCEPTED & FROZEN (READ-ONLY)**
- **Date**: 2026-09-26
- **Branch**: `task/dev`
- **Git Commit**: `f7d9a47` (Working tree clean, 0 commits, 0 pushes)

---

## 1. Executive Summary & Authorization Boundary

Phase 4F Step 4.7 establishes the architectural contract for:
1. **Pre-Posting Voucher Voiding / Cancellation**: Cancelling `DRAFT`, `SUBMITTED`, or `APPROVED` sales vouchers prior to general ledger posting.
2. **Posted Sales Invoice Reversal**: Creating an immutable compensating reversal voucher (`voucher_type = 'JOURNAL'`, `reference_type = 'SALES_REVERSAL'`, `reference_event = 'INVOICE_REVERSAL'`) that:
   - Inverts the exact commercial debits and credits of the original posted sales journal entry.
   - Adjusts Accounts Receivable (`1121`) or Undeposited COD (`1122`).
   - Restores durable, re-salable accessories to physical inventory (`branch_inventory`) and re-instates their consumed cost lots (`inventory_cost_lot`) with an `INVOICE_REVERSAL` movement.
   - Strictly enforces business food-safety policy: Perishable cakes and consumable packaging are **NEVER restocked to physical inventory** and their COGS is not reversed to asset inventory.
   - Establishes bidirectional reversal audit linkage via `PostingService.linkReversal` (`original.reversed_by_voucher_id` and `reversal.reversal_of_voucher_id`).
   - Flags the original journal entry as `is_reversed = true`.

**CRITICAL BOUNDARY ENFORCEMENT**:
- **Zero implementation has occurred**.
- **No `SalesInvoiceReversalService` has been created**.
- **Zero database DDL migrations added**.
- **Zero rows mutated in live PostgreSQL**.
- **Accounting start date remains unconfigured; production posting remains hard-blocked**.

---

## 2. Mandatory Skills & Capabilities Audit

| Skill / Capability | Availability Status | Usage in Step 4.7 Forensic Gate |
| :--- | :---: | :--- |
| `smart-coder` | ✅ Installed | Architecture-aware analysis of existing `PostingService`, `PurchaseReversalService`, and `SalesPostingService`. |
| `lazy-coder` | ✅ Installed | Reusing canonical `linkReversal` and journal structures; zero parallel accounting engines. |
| `postgresql-and-supabase` | ✅ Installed | Direct inspection of `pg_constraint`, partial unique indexes, foreign keys, and system catalogs. |
| `security-audit` | ✅ Installed | Audit of BOLA, IDOR, Segregation of Duties, and permission models. |
| `security-auditing-and-owasp` | ✅ Installed | Verification of actor authorization, session isolation, and input sanitization. |
| `clean-architecture` | ✅ Installed | Strict boundary separation: Repository -> Service -> API; database as sole source of truth. |
| *Dedicated Accounting/ERP skill* | ⚠️ Not installed as standalone directory | Mitigated: Existing CoA (98 accounts), `PostingService`, and frozen design checkpoints serve as authoritative context. |
| *Dedicated Tax/GST skill* | ⚠️ Not installed as standalone directory | Mitigated: `SalesTaxEngine` and posted journal entry lines serve as deterministic tax source of truth. |

---

## 3. Recovery Status & Repository Safety Audit

- **Branch**: `task/dev`
- **HEAD Commit**: `f7d9a47073d64b0da305cc537a6eccb45938fd1b`
- **Git Actions**: Zero commits, zero pushes, zero checkouts, zero resets.
- **Working Tree**: Clean with respect to Step 4.7. Only tracked modifications from previous milestones and uncommitted checkpoint/scratch files exist.
- **All previous milestone checkpoints verified and intact**:
  - `CHECKPOINTS/phase4f-step4-6-sales-returns-credit-notes-refunds-01.md` (Step 4.6 Complete & Frozen ✅)
  - `CHECKPOINTS/phase4f-step4-5-customer-receipts-ar-01.md` (Step 4.5 Complete & Frozen ✅)
  - `CHECKPOINTS/phase4f-step4-4-sales-posting-cogs-01.md` (Step 4.4 Complete & Frozen ✅)
  - `CHECKPOINTS/phase4f-step3d6b-purchase-reversal-01.md` (Purchase Reversal Reference Implementation ✅)

---

## 4. Live PostgreSQL Schema Forensics

A direct, read-only inspection of the live PostgreSQL database was performed on 2026-09-26:

### A. `public.accounting_voucher`
- **Columns**: `id`, `voucher_no`, `voucher_type`, `voucher_date`, `branch_id`, `fiscal_year`, `status`, `total_amount`, `currency`, `reference_type`, `reference_id`, `reference_event`, `narration`, `created_by`, `submitted_by`, `submitted_at`, `approved_by`, `approved_at`, `posted_by`, `posted_at`, `cancelled_by`, `cancelled_at`, `reversed_by_voucher_id`, `reversal_of_voucher_id`, `metadata`, `created_at`, `updated_at`, `deleted_at`.
- **Key Constraints**:
  - `chk_voucher_type`: Supports `SALES`, `PURCHASE`, `PAYMENT`, `RECEIPT`, `EXPENSE`, `JOURNAL`, `CONTRA`, `CREDIT_NOTE`, `DEBIT_NOTE`, `OPENING_BALANCE`.
  - `chk_voucher_status`: Supports `DRAFT`, `SUBMITTED`, `APPROVED`, `POSTED`, `CANCELLED`.
  - `chk_voucher_posted_immutable`: `(status <> 'CANCELLED') OR (posted_at IS NULL)` (Enforces that a posted voucher can NEVER be transitioned to CANCELLED).
  - `chk_voucher_reversal_limit`: `(reversal_of_voucher_id IS NULL) OR (reversed_by_voucher_id IS NULL)` (A voucher cannot be both a reversal of another voucher and itself reversed by a third voucher, preventing unbounded reversal loops).
  - `chk_voucher_segregation`: `(approved_by IS NULL) OR (approved_by <> created_by)`.
  - `idx_accounting_voucher_source_idempotency`: Partial unique index on `(reference_type, reference_id, reference_event) WHERE status <> 'CANCELLED' AND reference_type <> 'MANUAL'`.

### B. `public.accounting_journal_entry` & `public.accounting_journal_line`
- `accounting_journal_entry`:
  - `chk_journal_balanced`: `total_debit = total_credit`.
  - `chk_journal_positive`: `total_debit > 0.00`.
  - Audit fields: `is_reversed` (boolean, default false), `reversed_at` (timestamptz).
- `accounting_journal_line`:
  - `chk_jline_single_sided`: Strict single-sided debit or credit (`(debit > 0 AND credit = 0) OR (credit > 0 AND debit = 0)`).
  - `chk_jline_credit_nonneg`, `chk_jline_debit_nonneg`.
  - Links: `account_id`, `branch_id`, `customer_id`, `supplier_id`.

### C. `public.inventory_movement`
- **Movement Types (`inventory_movement_movement_type_check`)**:
  `'PURCHASE_RECEIPT', 'SALES_FULFILLMENT', 'PURCHASE_RETURN', 'SALES_RETURN', 'STOCK_ADJUSTMENT_UP', 'STOCK_ADJUSTMENT_DOWN', 'TRANSFER_IN', 'TRANSFER_OUT', 'DAMAGE_WRITEOFF', 'INVOICE_REVERSAL'`.
  - **FINDING**: `'INVOICE_REVERSAL'` is **already natively defined and valid** in the PostgreSQL check constraint!
- `direction`: `'IN'` or `'OUT'`.
- Links: `branch_id`, `product_id`, `variant_id`, `order_id`, `voucher_id`, `quantity`.

### D. `public.inventory_cost_lot` & `public.inventory_cost_consumption`
- `inventory_cost_lot`:
  - `status`: `'ACTIVE'`, `'DEPLETED'`, `'REVERSED'`.
  - `chk_cost_lot_qty_bound`: `remaining_quantity <= received_quantity`.
  - `chk_cost_lot_cost_consistency`: `abs(total_cost - round(received_quantity * unit_cost, 2)) <= 0.05`.
  - `item_type`: `'CAKE'`, `'ACCESSORY'`, `'PACKAGING'`.
- `inventory_cost_consumption`:
  - Records exact lot consumption: `movement_id`, `lot_id`, `quantity`, `unit_cost`, `total_cost`.
  - `chk_cost_consumption_math`: `abs(total_cost - round(quantity * unit_cost, 2)) <= 0.05`.

---

## 5. Live Independent Baseline Verification

Baseline counts recorded on 2026-09-26 18:57 IST:

```
[PASS] Table count public."accounting_account": actual=98, expected=98
[PASS] Table count public."accounting_voucher": actual=0, expected=0
[PASS] Table count public."accounting_journal_entry": actual=0, expected=0
[PASS] Table count public."accounting_journal_line": actual=0, expected=0
[PASS] Table count public."accounting_fiscal_period": actual=0, expected=0
[PASS] Table count public."purchase": actual=0, expected=0
[PASS] Table count public."purchase_item": actual=0, expected=0
[PASS] Table count public."purchase_payment": actual=0, expected=0
[PASS] Table count public."supplier": actual=0, expected=0
[PASS] Table count public."branch": actual=57, expected=57
[PASS] Table count public."branch_inventory": actual=424, expected=424
[PASS] Table count public."inventory_cost_lot": actual=0, expected=0
[PASS] Table count public."inventory_movement": actual=0, expected=0
[PASS] Table count public."inventory_cost_consumption": actual=0, expected=0
[PASS] Table count public."order": actual=173, expected=173
[PASS] Table count public."payment_transaction": actual=53, expected=53
[PASS] Setting accounting_start_date configured rows: actual=0, expected=0
```

The baseline matches the established Step 4.6 baseline to 100% precision. Zero persistent test artifacts or financial rows exist.

---

## 6. Pre-Posting Void vs. Posted Invoice Reversal

The ERP recognizes two fundamentally distinct cancellation lifecycles:

### A. Pre-Posting Void / Cancellation (Pre-GL Impact)
- **Applicable States**: `DRAFT`, `SUBMITTED`, `APPROVED`.
- **Financial Ledger State**: No general ledger journal entries exist (`accounting_journal_entry` rows = 0).
- **Inventory Ledger State**: No physical stock was decremented, and no cost lots were consumed (`inventory_cost_consumption` rows = 0, `inventory_movement` rows = 0).
- **Mechanism**: Calls `PostingService.cancelVoucher`:
  - Transitions `status` from `DRAFT`/`SUBMITTED`/`APPROVED` $\rightarrow$ `CANCELLED`.
  - Sets `cancelled_by = sessionUserId`, `cancelled_at = NOW()`.
  - `chk_voucher_posted_immutable` permits cancellation because `posted_at IS NULL`.
  - Unlinks the voucher from `order.metadata`.
  - Preserves immutable voucher record for audit trail.

### B. Posted Invoice Reversal (Post-GL Impact)
- **Applicable State**: `POSTED` only.
- **Financial Ledger State**: A compound journal entry is active in the General Ledger.
- **Inventory Ledger State**: Cost lots were consumed, physical inventory was decremented, and inventory movements were recorded.
- **Mechanism**:
  - The original voucher remains permanently `POSTED` (database constraint `chk_voucher_posted_immutable` strictly forbids setting a posted voucher to `CANCELLED`).
  - Creates a new compensating reversal voucher (`voucher_type = 'JOURNAL'`, `reference_type = 'SALES_REVERSAL'`, `reference_id = order.id`, `reference_event = 'INVOICE_REVERSAL'`).
  - Creates a balanced compensating journal entry that inverts the original commercial debits and credits.
  - Updates original voucher: `reversed_by_voucher_id = reversal_voucher.id`.
  - Updates reversal voucher: `reversal_of_voucher_id = original_voucher.id`.
  - Updates original journal entry: `is_reversed = true`, `reversed_at = NOW()`.

---

## 7. Compensating Journal Design & Exact Account Inversion

### 7.1 Authoritative Source: Original Journal Lines
To guarantee 100% mathematical fidelity to the penny and prevent discrepancies due to master data changes (tax rate adjustments, price updates, discount proration rules), **the reversal journal NEVER recalculates from master data**. 

Instead, it reads the original posted journal entry directly:

$$\forall \text{ line } \in \text{OriginalCommercialLines}:$$
$$\text{Reversal Debit} = \text{Original Credit}$$
$$\text{Reversal Credit} = \text{Original Debit}$$

### 7.2 Commercial Account Inversion
For a standard sales invoice:

| Line Description | Original Posted Entry | Reversal Compensating Entry |
| :--- | :---: | :---: |
| Accounts Receivable (`1121`) / Undeposited COD (`1122`) | **Debit** $T$ | **Credit** $T$ |
| Cake Sales Revenue (`4110`) | **Credit** $R_{\text{cake}}$ | **Debit** $R_{\text{cake}}$ |
| Accessory Sales Revenue (`4120`) | **Credit** $R_{\text{acc}}$ | **Debit** $R_{\text{acc}}$ |
| Delivery Charges Revenue (`4130`) | **Credit** $R_{\text{del}}$ | **Debit** $R_{\text{del}}$ |
| Output GST (`2121`–`2129`) (CGST/SGST/IGST) | **Credit** $G$ | **Debit** $G$ |

$$\sum \text{Reversal Debits} = R_{\text{cake}} + R_{\text{acc}} + R_{\text{del}} + G = T = \sum \text{Reversal Credits}$$
Strict double-entry balance is mathematically guaranteed.

---

## 8. Critical Interaction with Step 4.5 Receipts & AR

An essential architectural invariant of CakeToHome ERP is:

$$\text{INVOICE REVERSAL} \neq \text{CUSTOMER REFUND}$$

- **Invoice Reversal**: Adjusts the commercial and tax obligation between customer and bakery.
- **Customer Refund**: Disburses physical cash or electronic money back to the customer.

### State Combinations & Behaviors:

1. **Posted Sale, Unpaid (`Receipts = 0`)**:
   - Original AR: Dr `1121` for 1,000. Net AR = +1,000.
   - Reversal: Cr `1121` for 1,000. Net AR = 0.
   - Result: Completely clean AR settlement. Zero refund required.

2. **Posted Sale, Fully Paid (`Receipts = 1,000`)**:
   - Original AR: Dr `1121` for 1,000. Receipt: Cr `1121` for 1,000. Net AR = 0.
   - Reversal: Cr `1121` for 1,000.
   - Post-reversal AR: **-1,000 (Credit Balance)**.
   - The bakery now owes the customer 1,000.
   - Authoritative AR formula from Step 4.5/4.6:
     $$\text{netInvoiced} = \max(0, \text{sales} - \text{credit\_notes} - \text{reversals}) = 0$$
     $$\text{netPaid} = \max(0, \text{receipts} - \text{refunds}) = 1,000$$
     $$\text{maxRefundable} = \max(0, \text{netPaid} - \text{netInvoiced}) = 1,000$$
   - The customer is now eligible for a 1,000 refund via the canonical Step 4.6 `SalesReturnService.postCustomerRefund` workflow.
   - **Receipt vouchers are NOT deleted or reversed** — they accurately record that funds entered the bakery's gateway/bank. Money is returned via a separate `PAYMENT` voucher (Dr `1121` / Cr `1113 Gateway Clearing` or `1111 Cash`).

3. **Posted Sale, Partially Paid (`Receipts = 400`, `Invoiced = 1,000`)**:
   - Original AR: +1,000 Dr. Receipts: -400 Cr. Net AR = +600 Dr.
   - Reversal: Cr `1121` for 1,000.
   - Post-reversal AR: -400 (Credit Balance).
   - $\text{maxRefundable} = 400$. Customer is eligible for a 400 refund via Step 4.6.

4. **Posted Sale, COD Remitted to Branch Cashier (`Dr 1111 / Cr 1122`)**:
   - Reversal: Cr `1122 Undeposited COD`.
   - Post-reversal balance on `1122` becomes a credit balance.
   - Cash refund is disbursed via Step 4.6: Dr `1122 Undeposited COD` / Cr `1111 Cash in Hand`.

---

## 9. Critical Interaction with Step 4.6 Credit Notes & Partial Returns

### Mathematical Double-Reversal Prevention:

If an order has already undergone a partial sales return with a posted credit note (Step 4.6):
- A credit note has already debited `4190 Sales Returns & Allowances` and credited `1121 AR`.
- If a full sales invoice reversal were also permitted on the same order, the original sales invoice would be reversed in full.
- The customer's account would receive a double credit: once via the credit note, and once via the full reversal.
- Total reduction would exceed the original invoice total!

### Hard Boundary Invariant:
$$\text{Full Sales Invoice Reversal is permitted ONLY if } \text{totalCreditNotes} === 0.$$
- If any partial credit note exists on the order, full invoice reversal is **STRICTLY BLOCKED** with `CANNOT_REVERSE_ORDER_WITH_CREDIT_NOTES`.
- Any subsequent returns on an order that already has credit notes must be processed via the Step 4.6 partial credit note workflow (returning the remaining unreturned items), preserving single-path accounting.

---

## 10. Inventory & COGS Reversal Forensics

### 10.1 Perishable Cakes Business Policy
- **Food Hygiene Standard**: Baked perishable goods that have left bakery custody are **never restocked to physical inventory**.
- **Physical Stock**: `branch_inventory.quantity` is **NOT** incremented.
- **Cost Lots**: `inventory_cost_lot` is **NOT** re-instated.
- **COGS Treatment**: The cake raw materials cost was physically expended during baking. Therefore, COGS cannot be credited back to asset inventory (`1132 Merchandise Inventory - Cakes`), because doing so would fabricate non-existent physical asset value on the balance sheet.
- **Invariant**: Attempting to restock cakes or credit cake inventory on sales reversal fails closed with `PERISHABLE_CAKE_RESTOCK_PROHIBITED`.

### 10.2 Consumable Packaging Policy
- Single-use cake boxes, ribbons, and bags cannot be restocked once dispatched.
- Fails closed with `PACKAGING_RESTOCK_PROHIBITED`. Zero physical movement.

### 10.3 Durable Accessories Restoration
- For accessories (`merchandise_type = 'ACCESSORY'`), 100% exact traceability exists via `public.inventory_cost_consumption` linked to the original voucher's `SALES_FULFILLMENT` movement.
- On reversal:
  1. Identifies the exact `inventory_cost_lot` records consumed for the original sales voucher.
  2. Increments `inventory_cost_lot.remaining_quantity` by the consumed quantity, transitioning status from `DEPLETED` back to `ACTIVE`.
  3. Increments physical stock in `branch_inventory.quantity`.
  4. Records compensating `inventory_movement`:
     - `movement_type = 'INVOICE_REVERSAL'`
     - `direction = 'IN'`
     - `voucher_id = reversal_voucher.id`
     - `order_id = order.id`
  5. Inverts the COGS entry:
     - **Debit**: `1131 Merchandise Inventory - Accessories` (Restores asset value)
     - **Credit**: `5120 Accessory Merchandise Sold / COGS` (Reverses expense)

---

## 11. Immutability, Reversal Linkage & Idempotency

### 11.1 Immutability of Posted Records
- Original voucher remains in `POSTED` status.
- No `UPDATE` or `DELETE` on posted journal lines.
- Database trigger/check constraint `chk_voucher_posted_immutable` enforces this at the engine level.

### 11.2 Authoritative Bidirectional Linkage
Uses canonical `PostingService.linkReversal`:
1. `accounting_voucher.reversed_by_voucher_id = reversal_voucher.id` (set on original voucher).
2. `accounting_voucher.reversal_of_voucher_id = original_voucher.id` (set on reversal voucher).
3. `accounting_journal_entry.is_reversed = true`, `reversed_at = NOW()` (set on original journal).
4. `order.metadata.reversal_voucher_id = reversal_voucher.id`, `order.metadata.is_reversed = true`.

### 11.3 Idempotency & Replay Defense
- Source idempotency: `reference_type = 'SALES_REVERSAL'`, `reference_id = order.id`, `reference_event = 'INVOICE_REVERSAL'`.
- Enforced by PostgreSQL partial unique index `idx_accounting_voucher_source_idempotency`.
- Replay attempts detect existing reversal and return the existing voucher with `wasDuplicate = true`.

---

## 12. Segregation of Duties (SoD) & Permission Controls

### 12.1 Locked Authorization & Permissions Model (Option A)
The lead architect and system controls mandate **Option A** for Step 4.7 authorization:
- **No Schema / Catalogue Alteration**: `ACCOUNTING.REVERSE` is **NOT** introduced in Step 4.7; zero migrations or permission catalog alterations are permitted.
- **Canonical Permission Reuse**:
  - Reversal initiator must possess `ACCOUNTING.POST`.
  - Reversal approver must possess `ACCOUNTING.APPROVE`.
  - Reversal poster must possess `ACCOUNTING.POST`.
- **Dedicated Reversal SoD Matrix**: Reversal is a materially distinct operation from normal posting. The service enforces an explicit, strict reversal-specific SoD matrix:
  1. `reversal_initiator !== original_sales_voucher.created_by` (Voucher creator cannot reverse their own invoice).
  2. `reversal_initiator !== original_sales_voucher.approved_by` (Voucher approver cannot initiate reversal).
  3. `reversal_submitter !== reversal_approver` (Reversal submitter cannot approve).
  4. `reversal_approver !== reversal_initiator` (Reversal initiator cannot approve).
  5. `reversal_poster !== reversal_initiator` (Reversal initiator cannot post).
  6. `reversal_poster !== reversal_approver` (Reversal approver cannot post).
  7. `reversal_poster !== original_sales_voucher.created_by` (Original creator cannot post reversal).
  8. `reversal_poster !== original_sales_voucher.approved_by` (Original approver cannot post reversal).
  9. `reversal_poster !== original_sales_voucher.posted_by` (Original poster cannot post reversal).
  10. `reversal_poster !== order.metadata.created_by` (Commercial order creator cannot post reversal).
  11. `reversal_poster !== order.customer_id` (Customer identity cannot post reversal).
  12. `SUPER_ADMIN` enterprise role does **NOT** bypass any of these restrictions.

---

## 13. Concurrency, Lock Ordering & Atomic Rollback

### 13.1 Strict Ascending Lock Hierarchy
To prevent deadlocks against concurrent receipts (Step 4.5) or returns (Step 4.6), transactions must acquire row locks in strict ascending order:
1. `SELECT ... FROM public."order" WHERE id = $1 FOR UPDATE`
2. `SELECT ... FROM public.accounting_voucher WHERE id = $1 FOR UPDATE` (Original Voucher)
3. `SELECT ... FROM public.accounting_journal_entry WHERE voucher_id = $1 FOR UPDATE` (Original Journal)
4. `SELECT ... FROM public.branch_inventory WHERE branch_id = $1 AND variant_id = ANY($2) ORDER BY variant_id ASC FOR UPDATE`
5. `SELECT ... FROM public.inventory_cost_lot WHERE id = ANY($1) ORDER BY received_at ASC, id ASC FOR UPDATE`

### 13.2 Atomic Rollback
All operations execute inside a single PostgreSQL `dbTransaction`. If any validation fails (SoD violation, fiscal period lock, stock inconsistency), the transaction rolls back cleanly with zero partial writes.

---

## 14. Comprehensive Business State Matrix

| Invoice State | Customer Receipts | Credit Notes | Reversal Action | Resulting Vouchers | Inventory Impact | AR / Cash Impact |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: |
| `DRAFT` | None | None | **Void Pre-Posting** | Voucher marked `CANCELLED` | Zero inventory movement | Zero GL impact |
| `SUBMITTED` | None | None | **Void Pre-Posting** | Voucher marked `CANCELLED` | Zero inventory movement | Zero GL impact |
| `APPROVED` | None | None | **Void Pre-Posting** | Voucher marked `CANCELLED` | Zero inventory movement | Zero GL impact |
| `POSTED` Unpaid | None | None | **Compensating Reversal** | `JOURNAL` compensating voucher posted | Accessory stock restored; Cake zero restock | Cr AR clears Dr AR; Net AR = 0 |
| `POSTED` Partially Paid | Partial | None | **Compensating Reversal** | `JOURNAL` compensating voucher posted | Accessory stock restored; Cake zero restock | Cr AR creates credit balance; maxRefundable = netPaid |
| `POSTED` Fully Paid | Full | None | **Compensating Reversal** | `JOURNAL` compensating voucher posted | Accessory stock restored; Cake zero restock | Cr AR creates credit balance; maxRefundable = 100% |
| `POSTED` with Credit Notes | Any | Partial or Full | **BLOCKED** (`CANNOT_REVERSE_ORDER_WITH_CREDIT_NOTES`) | None | None | None (Must use Step 4.6 partial returns) |
| `POSTED` Already Reversed | Any | Any | **BLOCKED** (`ORDER_ALREADY_REVERSED`) | None | None | None (Double reversal prevented) |
| Any | Any | Any | Cross-branch attempt | **BLOCKED** (`BRANCH_ACCESS_DENIED`) | None | None |
| Any | Any | Any | Unconfigured start date | **BLOCKED** (`ACCOUNTING_START_DATE_NOT_CONFIGURED`) | None | None |

---

## 15. Gap Classification Report

### A. Zero Gaps (Natively Supported)
- `accounting_voucher` columns: `reversed_by_voucher_id`, `reversal_of_voucher_id`.
- `accounting_voucher` constraints: `chk_voucher_reversal_limit`, `chk_voucher_posted_immutable`.
- `accounting_journal_entry` columns: `is_reversed`, `reversed_at`.
- `inventory_movement.movement_type`: `'INVOICE_REVERSAL'` natively supported.
- `inventory_cost_lot.status`: `'REVERSED'` natively supported.
- `PostingService.linkReversal`: Foundation primitive ready.

### B. Implementation Gaps (To be built in Step 4.7 implementation)
- `SalesInvoiceReversalService` in `frontend/src/lib/services/sales-invoice-reversal.service.ts`:
  - `voidPrePostingSalesVoucher`: Cancels `DRAFT`/`SUBMITTED`/`APPROVED` vouchers.
  - `reversePostedSalesInvoice`: Full compensating reversal with accessory restoration, cake non-restocking, SoD, and `linkReversal`.

### C. Schema Gaps
- **Zero Schema Gaps**: No DDL migrations or schema alterations required.

### D. Business Policy Gaps (Resolved in Design)
- **Cake / Packaging Restocking Policy**: Frozen. Cakes and packaging are non-restockable food items; their physical stock is not incremented and their COGS is not reversed into inventory assets.
- **Credit Note Precedence**: Frozen. If credit notes exist, full invoice reversal is strictly blocked to prevent double reversal. Remaining adjustments must use Step 4.6 credit notes.

### E. Security / Authorization Gaps (Resolved via Option A)
- **Option A Locked**: `ACCOUNTING.REVERSE` is **NOT** introduced in Step 4.7; zero migrations or permission catalog alterations are permitted.
- Canonical permissions are reused: `ACCOUNTING.POST` for reversal initiation & posting, and `ACCOUNTING.APPROVE` for reversal approval.
- Enforces the dedicated 12-rule reversal SoD matrix, preventing any unapproved or conflicted invoice reversals.

---

## 16. Proposed Implementation Boundary

When authorized, Phase 4F Step 4.7 implementation will cover:
1. Canonical `SalesInvoiceReversalService` (`frontend/src/lib/services/sales-invoice-reversal.service.ts`).
2. Pre-posting voiding (`voidPrePostingSalesVoucher`).
3. Posted invoice reversal (`reversePostedSalesInvoice`).
4. Accessory reverse-FIFO restoration & movement recording (`INVOICE_REVERSAL`).
5. Perishable cake and packaging non-restocking guard (`PERISHABLE_CAKE_RESTOCK_PROHIBITED`).
6. Credit note presence guard (`CANNOT_REVERSE_ORDER_WITH_CREDIT_NOTES`).
7. Customer refund eligibility derivation via Step 4.5/4.6 formulas.
8. Dedicated automated test suite in `frontend/scratch/test_step4_7_sales_reversal.js`.
9. Zero DDL, zero historical data modification, zero commits/pushes.

---

## 17. Milestone Status Confirmation

- **Phase 4F Step 4.7 Forensic & Architecture Design Gate**: **COMPLETE & FROZEN 📋**
- **Implementation Status**: **NOT STARTED 🛑**
- **Live Database State**: Pristine (0 vouchers, 0 journals, 0 cost lots, 0 movements, accounting start date unconfigured).
- **Git State**: Clean working tree, 0 commits, 0 pushes.
- **Execution strictly halted. Awaiting user review.**
