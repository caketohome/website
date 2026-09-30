# CAKETOHOME ERP — PHASE 4F STEP 3B: FINAL COST-LOT FORENSIC GATE REPORT

- **Document Version**: 2.0.0
- **Status**: 
  - **Step 3B Foundation Migration**: PASS ✅
  - **Step 3B Final Forensic Architecture Gate**: **BLOCKED** 🛑
- **Date**: 2026-09-24
- **Project**: CakeToHome ERP (`E:\vig\cakes2home-main\cakes2home-main`)
- **Authoritative Source of Truth**: Live PostgreSQL Database
- **Scope**: Targeted Forensic Review of `public.inventory_cost_lot`, Formal Resolution of Schema/Architecture Contradictions, and Blocking Prerequisite Definitions Before Step 3C

---

## 1. Executive Summary & Gate Status

While the initial Step 3B schema migration successfully created `public.inventory_cost_lot` (empty, 20 columns, 0 rows) and aligned the Chart of Accounts (Accounts 1132 and 5110 renamed), the final forensic architecture review identified **5 critical architectural blockers** that must be resolved in a dedicated migration/specification step before `PurchasePostingService` (Step 3C) can be safely authorized.

```
┌────────────────────────────────────────────────────────────────────────┐
│ GATE STATUS SUMMARY                                                    │
├────────────────────────────────────────────────────────────────────────┤
│ Step 3B Initial DB Migration:                PASS ✅                    │
│ 21/21 Security Tests & TypeScript Build:     PASS ✅                    │
│ Live Database Counts & Physical Stock:       PASS ✅                    │
│ Step 3B Final Forensic Architecture Gate:    BLOCKED 🛑                 │
│ Action Authorized:                           STOP — DO NOT PROCEED     │
└────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Five Critical Architecture Blockers Documented

### BLOCKER 1: FIFO Index Product Isolation Risk
- **Current Live Index in PostgreSQL**:
  ```sql
  CREATE INDEX idx_inventory_cost_lot_fifo 
  ON public.inventory_cost_lot USING btree (branch_id, variant_id, received_at, created_at) 
  WHERE ((status = 'ACTIVE'::text) AND (remaining_quantity > (0)::numeric));
  ```
- **Exact Correctness Risk**:
  `product_id` is missing from the index. When `variant_id IS NULL` (common for non-variant products and packaging items), all such distinct products at the branch share the identical `(branch_id, NULL)` btree path. An application query searching for open lots with `variant_id IS NULL` risks index-scan ambiguity and heap filtering across unrelated products, creating an active correctness hazard for FIFO cost consumption.
- **Required Correction**:
  ```sql
  DROP INDEX IF EXISTS public.idx_inventory_cost_lot_fifo;
  CREATE INDEX idx_inventory_cost_lot_fifo 
  ON public.inventory_cost_lot USING btree (branch_id, product_id, variant_id, received_at ASC, created_at ASC) 
  WHERE (status = 'ACTIVE' AND remaining_quantity > 0);
  ```
- **Assignment**: Dedicated Step 3B.1 transactional schema migration prior to Step 3C.

---

### BLOCKER 2: Missing Inventory Movement / Consumption Ledger
- **Identified Flaw**:
  The Step 3B migration created only `public.inventory_cost_lot`. There is **no database table** to record inventory movements or consumptions:
  - Sale order FIFO consumptions
  - Purchase returns to suppliers
  - Spoilage / damage write-offs
  - Stock count adjustments
  - Inter-branch transfers
- **Exact Auditability Hazard**:
  If `remaining_quantity` on `inventory_cost_lot` is simply updated in-place (e.g. from 100 to 70), there is **zero immutable database record** indicating when 30 units left, who authorized it, under what order or debit note, at what unit cost, or linked to which accounting voucher.
- **Required Architecture Structure**:
  A dedicated ledger table `public.inventory_cost_consumption` (or `public.inventory_movement`) must precede any consumption logic:
  ```sql
  CREATE TABLE public.inventory_cost_consumption (
    id                TEXT            PRIMARY KEY DEFAULT gen_random_uuid()::text,
    lot_id            TEXT            NOT NULL REFERENCES public.inventory_cost_lot(id) ON DELETE RESTRICT,
    branch_id         TEXT            NOT NULL REFERENCES public.branch(id) ON DELETE RESTRICT,
    product_id        TEXT            NULL REFERENCES public.product(id) ON DELETE RESTRICT,
    variant_id        TEXT            NULL REFERENCES public.product_variant(id) ON DELETE RESTRICT,
    movement_type     TEXT            NOT NULL CHECK (movement_type IN (
                                        'SALES_FULFILLMENT', 'PURCHASE_RETURN', 
                                        'STOCK_ADJUSTMENT', 'TRANSFER_OUT', 
                                        'TRANSFER_IN', 'DAMAGE_WRITEOFF', 'INVOICE_REVERSAL'
                                      )),
    quantity          NUMERIC(12, 3)  NOT NULL CHECK (quantity > 0),
    unit_cost         NUMERIC(14, 4)  NOT NULL CHECK (unit_cost >= 0),
    total_cost        NUMERIC(14, 2)  NOT NULL CHECK (total_cost >= 0),
    order_id          TEXT            NULL REFERENCES public."order"(id) ON DELETE RESTRICT,
    purchase_id       TEXT            NULL REFERENCES public.purchase(id) ON DELETE RESTRICT,
    voucher_id        TEXT            NULL REFERENCES public.accounting_voucher(id) ON DELETE RESTRICT,
    reference_no      TEXT            NULL,
    narration         TEXT            NULL,
    created_by        TEXT            NOT NULL,
    created_at        TIMESTAMPTZ     NOT NULL DEFAULT NOW()
  );
  ```
- **Assignment**: Must be defined and migrated before operational consumption or returns are implemented.

---

### BLOCKER 3: Reversal Model Structural Contradiction
- **Identified Contradiction**:
  The report simultaneously claimed:
  1. "Purchase returns do not create new lots."
  2. "Whole-lot reversal sets `reversed_by_lot_id`."
  3. "`reversed_by_lot_id` references `inventory_cost_lot(id)`."
  4. "Reversal cardinality is 1:1."
  If purchase returns/reversals do not create new lots, `reversed_by_lot_id` has **no row to reference**. Furthermore, `received_quantity` has a `CHECK (received_quantity > 0)` constraint, preventing compensating negative lots from existing.
- **Architectural Resolution**:
  - Lots represent physical acquisition layers, NOT accounting vouchers.
  - A purchase invoice cancellation/void simply transitions the original lot: `status = 'REVERSED'` and `remaining_quantity = 0`.
  - The audit linkage of the reversal is maintained at the **Accounting Voucher layer** (`accounting_voucher.reversed_by_voucher_id`) and in the **Movement Ledger** (`movement_type = 'INVOICE_REVERSAL'`).
  - Columns `reversal_of_lot_id` and `reversed_by_lot_id` on `inventory_cost_lot` are redundant foreign keys that must either be repurposed strictly for splitting lots or deprecated in favor of voucher-level audit links.

---

### BLOCKER 4: Product Classification Authority Master-Data Gap
- **Identified Flaw**:
  The report suggested deriving `item_type` (`CAKE`, `ACCESSORY`, `PACKAGING`) from heuristics such as `product.id LIKE 'acc_%'`.
  An ID naming convention is fragile and NOT an authoritative master-data architecture.
- **Live Forensic Schema Findings**:
  A live inspection of PostgreSQL revealed:
  - `public.product_category` has 11 categories, but `public.product_category_product` contains only **6 rows** across 65 products.
  - `public.product.metadata->>'category'` is a free-form unstructured text field; 12 products have `NULL`.
  - `public.product.type_id` is `NULL` across all 65 products.
  - Packaging items do NOT exist in `public.product`.
- **Master-Data Gap**:
  The current database schema lacks an authoritative, structured column defining the accounting merchandise class (`merchandise_type`).
- **Required Resolution**:
  Add an authoritative column `merchandise_type` or require explicit `item_type` on `purchase_item` validated against verified statutory HSN codes (HSN 1905 for Cakes, HSN 9505/3406 for Accessories, HSN 4819 for Packaging).

---

### BLOCKER 5: Cost Consistency Invariant Assignment & Enforcement
- **Identified Gap**:
  PostgreSQL currently permits impossible combinations such as `received_quantity = 10, unit_cost = 100, total_cost = 500`.
  The proposed tolerance formula was only documented, not enforced at any layer.
- **Authoritative Accounting Semantics (Ind AS 2 / AS 2)**:
  1. **`total_cost` is AUTHORITATIVE**: It represents the exact capitalized balance sheet asset debit (`purchase_item.taxable_value` + freight - trade discounts).
  2. **`unit_cost` is DERIVED**: `unit_cost = ROUND(total_cost / received_quantity, 4)`.
  3. **Tolerance Constraint**: Because fractional divisions (e.g. ₹100 / 3) leave 1-paise rounding discrepancies, strict integer equality cannot be used.
- **Layer Assignment**:
  - **Service Layer (`PurchasePostingService`)**: Computes `total_cost` from verified line debits and derives `unit_cost`.
  - **Database Layer (`CHECK constraint`)**: Must enforce consistency to prevent corrupted data:
    ```sql
    CONSTRAINT chk_cost_lot_cost_consistency CHECK (
      ABS(total_cost - ROUND(received_quantity * unit_cost, 2)) <= 0.05
    )
    ```

---

## 3. What is Formally Verified & Intact (Step 3B Migration PASS)

The foundational database migration executed in Step 3B remains 100% verified and intact:

| Entity | Live Count / State | Status |
|---|:---:|:---:|
| `public.inventory_cost_lot` | **0 rows** (20 columns, 8 FKs, 8 CHECKs) | ✅ PASS |
| `public.accounting_account` | **98 rows** (1132: 'Merchandise Inventory - Cakes', 5110: 'COGS - Cakes') | ✅ PASS |
| `public.branch_inventory` | **424 rows** (purely original accessories `acc_01`–`acc_08`, 0 synthetic cake rows) | ✅ PASS |
| `public.accounting_voucher` | **0 rows** (0 unverified vouchers) | ✅ PASS |
| `public.accounting_journal_entry` | **0 rows** (0 unverified entries) | ✅ PASS |
| `public.accounting_journal_line` | **0 rows** (0 unverified lines) | ✅ PASS |
| `public.accounting_fiscal_period` | **0 rows** (0 synthetic periods) | ✅ PASS |
| `setting.accounting_start_date` | **0 rows** (UNCONFIGURED) | ✅ PASS |
| `public.purchase` | **0 rows** (0 unverified purchases) | ✅ PASS |
| `public.purchase_item` | **0 rows** (0 unverified items) | ✅ PASS |
| `public.purchase_payment` | **0 rows** (0 unverified payments) | ✅ PASS |
| `public.order` | **173 rows** (100% untouched historical data) | ✅ PASS |
| `public.payment_transaction` | **53 rows** (100% untouched historical data) | ✅ PASS |
| TypeScript Strict Check (`tsc --noEmit`) | **0 errors, 0 diagnostics** | ✅ PASS |
| Security Regression Suite | **21/21 PASS** (7 findings verified remediated) | ✅ PASS |
| Git State | **0 commits, 0 pushes, 0 staged files** | ✅ PASS |

---

## 4. Next Sequence Plan Prior to Step 3C

Before `PurchasePostingService` (Step 3C) can be authorized, the following intermediate prerequisite step must be executed:

- **Phase 4F Step 3B.1 (Architecture & Schema Hardening)**:
  1. Correct the FIFO partial index to include `product_id`.
  2. Add the unique partial index `(purchase_item_id) WHERE (reversal_of_lot_id IS NULL)` for lot-level idempotency.
  3. Migrate the inventory consumption ledger (`public.inventory_cost_consumption`).
  4. Clarify reversal columns on `inventory_cost_lot`.
  5. Add database check constraint `chk_cost_lot_cost_consistency`.
  6. Formalize product merchandise class master data.

---

# FINAL GATE DECISION

**BLOCKED 🛑**

*(Execution STOPPED. No purchase transactions posted. No PurchasePostingService created. Awaiting user review of the five architecture blockers and authorization for Step 3B.1).*
