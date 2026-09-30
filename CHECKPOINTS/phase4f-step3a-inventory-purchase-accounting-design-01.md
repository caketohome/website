# CAKETOHOME ERP — PHASE 4F STEP 3A: INVENTORY COSTING & PURCHASE ACCOUNTING DESIGN SPECIFICATION

- **Document Version**: 1.0.0
- **Status**: DESIGN ONLY — NO CODE MUTATION — NO REAL TRANSACTIONS
- **Date**: 2026-09-24
- **Project**: CakeToHome ERP (`E:\vig\cakes2home-main\cakes2home-main`)
- **Authoritative Source of Truth**: Live PostgreSQL Database
- **Scope**: Item-wise Purchase Accounting, Inventory Costing Architecture, CoA Alignment, and Valuation Model

---

## 1. Executive Summary & Context

CakeToHome is a **trading and resale enterprise** (pure buy-and-sell retail and e-commerce model). Both cakes and accessories are purchased as finished merchandise from commercial bakery vendors and novelty suppliers, then distributed across 57 retail hubs and dark kitchens to fulfill customer orders.

### Core Business Invariants
1. **Trading Model**: No manufacturing, work-in-progress (WIP), bill-of-materials (BOM), recipe yield, or ingredient conversion accounting exists. Cakes and accessories are merchandise inventory.
2. **Physically Stocked Cakes are Merchandise**: The obsolete assumption that "cakes never enter inventory" is formally retired. Physically held cakes at branches are tracked merchandise assets with actual purchase costs.
3. **No Fabricated COGS**: If actual purchase cost is unavailable, COGS cannot be synthesized, estimated via selling price, or assumed via arbitrary margin percentages (e.g. 35%). COGS remains pending/unposted until authoritative acquisition cost is established.
4. **Physical Table Lacks Cost**: Live PostgreSQL table `public.branch_inventory` contains physical quantities (`quantity`, `reserved`) but **zero cost columns**. A dedicated inventory costing architecture must precede operational purchase posting.
5. **Hard Safety Barriers Intact**: `setting.accounting_start_date` remains UNCONFIGURED. `accounting_fiscal_period` remains at 0 rows. Real operational posting remains hard-blocked.

---

## 2. Live Database Forensic Inspection Findings

An exhaustive forensic audit of the live database was executed on 2026-09-24:

### A. Authoritative Row Counts
| Table | Live Count | Invariant Status |
|---|:---:|---|
| `public.accounting_account` | **98** | Master Chart of Accounts (24 groups, 74 leaves) |
| `public.accounting_voucher` | **0** | Clean — zero unverified postings |
| `public.accounting_journal_entry` | **0** | Clean — zero unverified postings |
| `public.accounting_journal_line` | **0** | Clean — zero unverified postings |
| `public.accounting_fiscal_period` | **0** | Clean — zero synthetic periods |
| `public.purchase` | **0** | Clean — zero legacy purchases |
| `public.purchase_item` | **0** | Clean — zero legacy purchase items |
| `public.purchase_payment` | **0** | Clean — zero legacy purchase payments |
| `public.supplier` | **0** | Clean — zero legacy suppliers |
| `public.branch_inventory` | **424** | Real physical stock rows (accessories) |
| `public.product` | **65** | Catalog products |
| `public.product_variant` | **27** | Product variants |
| `public.branch` | **57** | Active hub/kitchen branches |
| `public.order` | **173** | Historical orders (100% untouched) |
| `public.payment_transaction` | **53** | Historical payment transactions (100% untouched) |
| `public.setting` (`accounting_start_date`) | **0** | UNCONFIGURED |

### B. Live Schema Details & Constraints

#### 1. `public.purchase`
- **Columns**: `id` (text, PK), `supplier_id` (text, FK `supplier.id`), `branch_id` (text, FK `branch.id`), `invoice_no` (text), `invoice_date` (date), `subtotal` (numeric, default 0), `discount` (numeric, default 0), `taxable_value` (numeric, default 0), `cgst` (numeric, default 0), `sgst` (numeric, default 0), `igst` (numeric, default 0), `total` (numeric, default 0), `payment_method` (text), `credit_terms_days` (integer), `due_date` (date), `status` (text, default 'DRAFT'), `created_by` (text), `approved_by` (text), `posted_at` (timestamptz), `metadata` (jsonb), `created_at` (timestamptz), `updated_at` (timestamptz), `deleted_at` (timestamptz).
- **Constraints**:
  - `purchase_status_check`: `CHECK (status IN ('DRAFT', 'SUBMITTED', 'APPROVED', 'POSTED'))`
  - `uq_purchase_invoice_supplier_branch`: `UNIQUE NULLS NOT DISTINCT (branch_id, supplier_id, invoice_no)`
  - Foreign keys on `branch_id` (`ON DELETE RESTRICT`) and `supplier_id` (`ON DELETE RESTRICT`).

#### 2. `public.purchase_item`
- **Columns**: `id` (text, PK), `purchase_id` (text, FK `purchase.id`), `product_id` (text), `variant_id` (text), `description` (text NOT NULL), `quantity` (numeric NOT NULL), `rate` (numeric NOT NULL), `discount` (numeric NOT NULL default 0), `taxable_value` (numeric NOT NULL default 0), `cgst_rate` (numeric), `sgst_rate` (numeric), `igst_rate` (numeric), `cgst` (numeric default 0), `sgst` (numeric default 0), `igst` (numeric default 0), `total` (numeric NOT NULL default 0), `hsn_code` (text), `created_at` (timestamptz), `updated_at` (timestamptz), `deleted_at` (timestamptz).
- **Constraints**:
  - `purchase_item_quantity_check`: `CHECK (quantity > 0)`
  - `purchase_item_rate_check`: `CHECK (rate >= 0)`
  - `purchase_item_discount_check`: `CHECK (discount >= 0)`
  - `purchase_item_purchase_id_fkey`: Foreign key to `purchase(id)` with `ON DELETE CASCADE`.

#### 3. `public.purchase_payment`
- **Columns**: `id` (text, PK), `purchase_id` (text, FK `purchase.id`), `amount` (numeric NOT NULL), `method` (text NOT NULL), `payment_date` (date NOT NULL), `reference` (text), `created_by` (text), `created_at` (timestamptz), `updated_at` (timestamptz), `deleted_at` (timestamptz).
- **Constraints**:
  - `purchase_payment_amount_check`: `CHECK (amount > 0)`
  - `purchase_payment_method_check`: `CHECK (method IN ('CASH', 'UPI', 'BANK_TRANSFER', 'CHEQUE', 'CARD', 'OTHER'))`
  - `purchase_payment_purchase_id_fkey`: Foreign key to `purchase(id)` with `ON DELETE CASCADE`.

#### 4. `public.supplier`
- **Columns**: `id` (text, PK), `name` (text NOT NULL), `gstin` (text), `phone` (text), `email` (text), `address` (text), `city` (text), `state` (text), `branch_id` (text, FK `branch.id`), `is_active` (boolean NOT NULL), `created_by` (text), `metadata` (jsonb), `created_at` (timestamptz), `updated_at` (timestamptz), `deleted_at` (timestamptz).
- **Indexes**: `idx_supplier_branch_id`, `idx_supplier_gstin`, `idx_supplier_is_active`.

#### 5. `public.branch_inventory`
- **Columns**: `id` (text, PK), `product_id` (text NOT NULL), `variant_id` (text NOT NULL), `quantity` (integer NOT NULL default 0), `reserved` (integer NOT NULL default 0), `branch_id` (text NOT NULL, FK `branch.id`), `created_at` (timestamptz), `updated_at` (timestamptz), `deleted_at` (timestamptz).
- **Cost columns absent**: Confirmed `unit_cost`, `avg_cost`, `mwa_cost`, `valuation` do not exist.
- **Constraints**: `IDX_branch_inventory_branch_variant` (`UNIQUE (branch_id, variant_id)`).

---

## 3. Chart of Accounts Semantic Mismatch & Correction Plan

### A. Forensic Inspection of Current Master CoA
The live database inspection revealed the following account definitions:

| Code | Current Live Name | Level | Type | Subtype | Is Group | Status |
|---|---|:---:|---|---|:---:|:---:|
| `1131` | `Merchandise Inventory - Accessories` | 4 | `ASSET` | `INVENTORY` | `false` | **Correct** |
| `1132` | `Bakery Raw Materials & Ingredients` | 4 | `ASSET` | `INVENTORY` | `false` | **MISMATCH** |
| `1133` | `Packaging Supplies Stock` | 4 | `ASSET` | `INVENTORY` | `false` | **Correct** |
| `5110` | `Raw Material Consumption / Bakery Ingredients` | 3 | `EXPENSE` | `COGS` | `false` | **MISMATCH** |
| `5120` | `Accessory Merchandise Sold (Cost of Accessories)` | 3 | `EXPENSE` | `COGS` | `false` | **Correct** |
| `5130` | `Packaging Materials Consumed` | 3 | `EXPENSE` | `COGS` | `false` | **Correct** |

### B. Root Cause Analysis
During Phase 4D master data seeding, accounts `1132` and `5110` were seeded with legacy bakery production labels (`Bakery Raw Materials & Ingredients` and `Raw Material Consumption`). However, CakeToHome is strictly a commercial reseller of cakes, not a flour-and-sugar manufacturing facility. 

Retaining "raw materials" terminology causes severe accounting corruption:
- Encourages incorrect BOM/recipe costing assumptions.
- Confuses asset auditing for physically held purchased cakes.
- Prevents clear reporting of Cake Merchandise Cost vs Accessory Merchandise Cost.

### C. Controlled Correction Plan (To be executed upon explicit authorization)
In accordance with the no-silent-mutation rule, the database was NOT altered during Step 3A. The authorized correction script to be executed in a dedicated migration/seed step is:

```sql
-- Controlled Semantic Correction for CakeToHome Resale Business Model
UPDATE public.accounting_account
SET name = 'Merchandise Inventory - Cakes',
    description = 'Authoritative balance sheet asset account for physically held cake merchandise purchased from commercial bakeries for resale.',
    updated_at = NOW()
WHERE code = '1132' AND is_group = false;

UPDATE public.accounting_account
SET name = 'COGS - Cakes',
    description = 'Cost of Goods Sold recognized upon fulfillment of purchased cake merchandise to customers.',
    updated_at = NOW()
WHERE code = '5110' AND is_group = false;
```

---

## 4. Item Classification & Catalog Resolution

When a purchase invoice is entered, each line in `public.purchase_item` must reliably resolve to its inventory asset account:
- `1131` (Merchandise Inventory - Accessories)
- `1132` (Merchandise Inventory - Cakes)
- `1133` (Packaging Supplies Stock)

### A. Resolution Hierarchy
```
purchase_item line
  │
  ├── 1. Has variant_id / product_id?
  │       ├── Look up public.product (category_slug, metadata->>'category')
  │       ├── If category relates to cakes (e.g. 'black-forest-cakes', 'chocolate-cakes')
  │       │     └── TARGET: 1132 (Merchandise Inventory - Cakes)
  │       ├── If category relates to accessories ('accessories', 'candles', 'balloons')
  │       │     └── TARGET: 1131 (Merchandise Inventory - Accessories)
  │       └── If category relates to packaging ('packaging', 'boxes', 'bags')
  │             └── TARGET: 1133 (Packaging Supplies Stock)
  │
  └── 2. Non-catalog / Bulk Purchase (product_id IS NULL)?
          ├── Inspect hsn_code:
          │     ├── HSN 1905 / 190590 (Cakes/Pastries/Bakery) ──> TARGET: 1132
          │     ├── HSN 9505 / 3406 (Novelties/Candles/Props) ──> TARGET: 1131
          │     └── HSN 4819 (Boxes/Cartons/Paper Packing)   ──> TARGET: 1133
          └── Fallback: Explicit purchase_item metadata / item_category field.
```

### B. Identified Master-Data Gap & Requirement
In the current catalog, products lack a structured `merchandise_type` column (they rely on `metadata->>'category'`). Furthermore, supplier invoices for consumables (cake boxes, ribbon rolls, thermal bags) often do not have a corresponding storefront `product` row.

**Requirement for Step 3B**:
`purchase_item` should accept an explicit `item_type` or allow the authenticated procurement manager to verify the target inventory account (`1131`, `1132`, or `1133`) during invoice creation, backed by HSN validation.

---

## 5. Objective Evaluation of Inventory Costing Architectures

We evaluate **Approach 1 (Purchase-Lot / Valuation-Layer Ledger)** versus **Approach 2 (Moving Weighted Average Valuation Layer)** across 25 factual dimensions without subjective scores.

| Dimension | Approach 1: Purchase-Lot / Valuation-Layer Ledger | Approach 2: Moving Weighted Average (MWA) |
|---|---|---|
| **1. Purchase-Cost Traceability** | Directly ties every physical unit to a specific supplier invoice and purchase item ID. | Aggregates acquisition costs into a blended unit average; individual unit cost is lost upon blend. |
| **2. Supplier Bill Traceability** | Native: Every open lot references `purchase_id` and `purchase_item_id`. | Indirect: Requires historical journal entry reconstruction to deduce invoice origin. |
| **3. Branch-Level Stock** | Lots partitioned strictly by `branch_id`. Each branch carries its own distinct cost lots. | Valuation record partitioned by `branch_id`. Average cost is distinct per branch. |
| **4. Product/Variant Stock** | Lots maintained at `(branch_id, variant_id)` granularity. | MWA maintained at `(branch_id, variant_id)` granularity. |
| **5. Partial Quantity Sales** | Native: Draws against open lots in FIFO/lot sequence, splitting lots when order quantity < lot quantity. | Native: Deducts `quantity * current_mwa` from inventory value and increments COGS. |
| **6. Cake Physical Stock** | Fully supports perishability/batch-date tracking. Each cake delivery forms a fresh lot. | Blends fresh cake batches with existing older stock value; masks expiration-based cost differences. |
| **7. Accessory Stock** | High volume of uniform items creates many lot records; requires FIFO consumption indexing. | Simple, compact: 1 record per accessory variant per branch regardless of purchase frequency. |
| **8. Purchase Returns** | Native: The exact purchase lot being returned to supplier is reversed at its historical invoice cost. | Complex: Deducting return value at original purchase price distorts remaining MWA if average has shifted. |
| **9. Sales Returns** | Returned merchandise can re-enter original lot or a designated customer-return lot. | Returned quantity re-enters at historical COGS or updates current MWA. |
| **10. Supplier Credit/Debit Notes** | Directly linked to open or partially consumed purchase lots. | Requires adjustment voucher against current valuation pool or price variance account. |
| **11. Damaged / Disposed Stock** | Identifies exact lot cost of damaged unit, writing off precise balance to inventory shrinkage. | Writes off damaged units at current moving average cost. |
| **12. Stock Adjustments** | Adjustments create positive adjustment lots or deduct from oldest active lots. | Adjustments simply modify total quantity and total value at current MWA. |
| **13. Branch Transfers** | Lot is transferred from Branch A to Branch B carrying its exact acquisition cost basis. | Inter-branch MWA transfer blends Branch A's MWA into Branch B's existing MWA. |
| **14. Opening Balances** | Opening stock creates initial verified cost lots at cut-off date. | Opening stock creates initial quantity, valuation, and MWA per variant. |
| **15. Negative Stock Handling** | Strictly prevents fulfillment if 0 open lots exist; prevents negative stock mathematically. | If quantity drops below zero, MWA calculation produces division-by-zero or inverted costs. |
| **16. Historical Auditability** | Complete immutable audit trail of every lot creation, partial consumption, and depletion. | Relies on snapshot reconstruction or periodic reconciliation tables. |
| **17. Month-End Valuation** | Sum of `remaining_quantity * unit_cost` across active lots matches GL Account 1131/1132 to the penny. | `total_quantity * mwa` matches GL Account, but rounding discrepancies can accumulate. |
| **18. COGS Accuracy** | Exact economic cost of goods sold based on actual items shipped. | Approximated economic cost smoothed across multiple procurement cycles. |
| **19. GST Separation** | Input GST is isolated at purchase time; lot carries purely net taxable purchase cost. | Input GST is isolated at purchase time; MWA tracks purely net taxable cost. |
| **20. Multi-Rate Purchases** | Handled natively at purchase item line level; lot cost is net of tax. | Handled natively at purchase item line level; MWA cost is net of tax. |
| **21. Reporting Requirements** | Enables detailed gross margin analysis by supplier, batch, and product. | Enables aggregate gross margin analysis by product and branch. |
| **22. Reconciliation Needs** | Deterministic: `sum(lots.remaining * unit_cost) == accounting_journal GL balance`. | Periodic reconciliation needed to clear penny-rounding variances. |
| **23. Accounting Reversals** | Clean: Reversing a purchase voucher cancels its specific unconsumed lot. | Challenging: Reversing an old purchase requires unwinding multiple moving average updates. |
| **24. Concurrency Safety** | High concurrency: PostgreSQL row-locking on specific open lots (`FOR UPDATE SKIP LOCKED`). | Contention bottleneck: Every purchase and every sale must lock the single MWA row for that variant. |
| **25. Performance at Scale** | Scales well with compound index on `(branch_id, variant_id, status)` where `status = 'ACTIVE'`. | Fixed-size storage (1 row per variant per branch), but higher transaction lock serialization. |

---

## 6. Recommended Costing Architecture & Rationale

### Recommendation
Implement **Approach 1: Purchase-Lot / Valuation-Layer Ledger (`inventory_cost_lot`)** as the authoritative costing foundation for CakeToHome.

### Why this satisfies CakeToHome's operational requirements:
1. **Cake Perishability & Commercial Resale**: Cakes are purchased fresh daily or semi-daily. A lot ledger naturally accommodates batch receipt dates, shelf life, and exact purchase invoice reconciliation. Blending cake costs via MWA masks batch degradation and distorts short-lifecycle profitability.
2. **Deterministic Reversals & Returns**: When a purchase invoice is returned or cancelled, the lot ledger allows exact, deterministic reversal without corrupting other purchases.
3. **Audit Proof for Accounting**: Every rupee in GL Accounts `1131`, `1132`, and `1133` can be tied directly to a specific open lot and supplier invoice number, satisfying statutory forensic audit requirements.
4. **Row-Level Concurrency**: Fulfillments lock individual lots rather than serializing on a single branch-variant average cost row, eliminating transactional lock contention.

---

## 7. Proposed Data Structures (Design Only — Not Implemented)

### Table 1: `public.inventory_cost_lot`
```sql
CREATE TABLE public.inventory_cost_lot (
    id TEXT PRIMARY KEY,
    branch_id TEXT NOT NULL REFERENCES public.branch(id) ON DELETE RESTRICT,
    product_id TEXT REFERENCES public.product(id) ON DELETE RESTRICT,
    variant_id TEXT REFERENCES public.product_variant(id) ON DELETE RESTRICT,
    item_type TEXT NOT NULL CHECK (item_type IN ('CAKE', 'ACCESSORY', 'PACKAGING')),
    purchase_id TEXT NOT NULL REFERENCES public.purchase(id) ON DELETE RESTRICT,
    purchase_item_id TEXT NOT NULL REFERENCES public.purchase_item(id) ON DELETE RESTRICT,
    supplier_id TEXT NOT NULL REFERENCES public.supplier(id) ON DELETE RESTRICT,
    initial_quantity NUMERIC(12, 3) NOT NULL CHECK (initial_quantity > 0),
    remaining_quantity NUMERIC(12, 3) NOT NULL CHECK (remaining_quantity >= 0),
    unit_cost NUMERIC(14, 4) NOT NULL CHECK (unit_cost >= 0),
    total_cost NUMERIC(14, 2) NOT NULL CHECK (total_cost >= 0),
    currency TEXT NOT NULL DEFAULT 'INR',
    received_at DATE NOT NULL,
    status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'DEPLETED', 'REVERSED')),
    reversed_by_lot_id TEXT,
    reversal_of_lot_id TEXT,
    created_by TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Partial index for fast FIFO lot resolution
CREATE INDEX idx_inventory_cost_lot_fifo 
ON public.inventory_cost_lot (branch_id, variant_id, received_at ASC, created_at ASC)
WHERE (status = 'ACTIVE' AND remaining_quantity > 0);

-- Source purchase traceability index
CREATE INDEX idx_inventory_cost_lot_purchase_item
ON public.inventory_cost_lot (purchase_item_id);
```

### Table 2: `public.inventory_cost_consumption`
Tracks every deduction from a lot (sales fulfillment, purchase return, damage write-off):
```sql
CREATE TABLE public.inventory_cost_consumption (
    id TEXT PRIMARY KEY,
    lot_id TEXT NOT NULL REFERENCES public.inventory_cost_lot(id) ON DELETE RESTRICT,
    order_id TEXT REFERENCES public."order"(id) ON DELETE RESTRICT,
    purchase_id TEXT REFERENCES public.purchase(id) ON DELETE RESTRICT,
    consumed_quantity NUMERIC(12, 3) NOT NULL CHECK (consumed_quantity > 0),
    unit_cost NUMERIC(14, 4) NOT NULL CHECK (unit_cost >= 0),
    total_cogs NUMERIC(14, 2) NOT NULL CHECK (total_cogs >= 0),
    event_type TEXT NOT NULL CHECK (event_type IN ('ORDER_FULFILLMENT', 'PURCHASE_RETURN', 'DAMAGE_WRITEOFF', 'TRANSFER_OUT')),
    voucher_id TEXT REFERENCES public.accounting_voucher(id),
    created_by TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

---

## 8. Authoritative Cost Basis Formula

In accordance with Ind AS 2 / AS 2 (Valuation of Inventories):

$$\text{Unit Inventory Cost} = \frac{\text{Net Taxable Value} + \text{Direct Inbound Freight} + \text{Direct Inbound Handling} - \text{Attributable Trade Discounts}}{\text{Quantity Received}}$$

### Rules & Exclusions:
1. **Recoverable Taxes Excluded**: CGST, SGST, and IGST are **strictly excluded** from inventory cost whenever CakeToHome is eligible to claim Input Tax Credit (ITC). They are debited to Asset accounts `1141`–`1149`.
2. **Blocked / Non-recoverable Taxes**: If a purchase is ineligible for ITC under Section 17(5) of the CGST Act, the tax is capitalized into `unit_cost`.
3. **Cash / Early Settlement Discounts**: Cash discounts are financing income (Account `5190` / Discount Received) and do NOT reduce inventory unit cost.
4. **Storage & Holding Costs**: Storage rent, cold-storage power, and dark-kitchen handling costs are period operating expenses (Accounts `5210`, `5220`), NEVER capitalized into inventory unit cost.

---

## 9. Purchase Accounting Double-Entry Matrix

When an approved supplier purchase invoice is posted:

### A. General Ledger Entry
$$\begin{aligned}
\text{Dr} & \quad \text{1131 / 1132 / 1133 (Merchandise Inventory / Packaging)} && [\text{Total Taxable Value}] \\
\text{Dr} & \quad \text{1141 / 1142 / 1143 / 1144 / 1145 / 1146 (Input GST - ITC)} && [\text{Total Eligible GST}] \\
\text{Cr} & \quad \text{2111 (Accounts Payable)} && [\text{Grand Total Invoice Amount}]
\end{aligned}$$

### B. Mathematical Reconciliations Required Before Posting
Every purchase invoice must pass these strict equality checks:
1. $\sum \text{purchase\_item.taxable\_value} = \text{purchase.taxable\_value}$
2. $\sum \text{purchase\_item.cgst} = \text{purchase.cgst}$
3. $\sum \text{purchase\_item.sgst} = \text{purchase.sgst}$
4. $\sum \text{purchase\_item.igst} = \text{purchase.igst}$
5. $\text{taxable\_value} + \text{cgst} + \text{sgst} + \text{igst} = \text{purchase.total}$
6. Total Journal Debit $=$ Total Journal Credit $=$ $\text{purchase.total}$

---

## 10. GST Multi-Rate & Inter-State Mapping

The system supports item-level statutory GST rates dynamically:

| HSN / Goods Category | Intra-State (Supplier State == Branch State) | Inter-State (Supplier State != Branch State) |
|---|---|---|
| **Cakes / Fresh Bakery** (HSN 1905) — 5% | Dr `1141` (CGST 2.5%) + Dr `1142` (SGST 2.5%) | Dr `1145` (IGST 5.0%) |
| **Novelties / Toys** (HSN 9505) — 12% | Dr `1147` (CGST 6.0%) + Dr `1148` (SGST 6.0%) | Dr `1149` (IGST 12.0%) |
| **General Accessories / Candles** (HSN 3406) — 18% | Dr `1143` (CGST 9.0%) + Dr `1144` (SGST 9.0%) | Dr `1146` (IGST 18.0%) |
| **Corrugated Boxes / Packaging** (HSN 4819) — 18% | Dr `1143` (CGST 9.0%) + Dr `1144` (SGST 9.0%) | Dr `1146` (IGST 18.0%) |

*Note: In accordance with Indian GST law, Intra-state transactions divide equally into CGST (50%) and SGST (50%). Interstate transactions are 100% IGST.*

---

## 11. Purchase Payments & AP Settlement Model

Purchase invoice posting and supplier payment are **strictly decoupled**:
1. **Invoice Posting (Step 3)**: Creates liability on Trade Payables:
   $$\text{Dr Inventory, Dr GST, Cr Accounts Payable (2111)}$$
2. **Subsequent Payment Voucher (Step 4 / Payments)**:
   $$\text{Dr Accounts Payable (2111)} \quad [\text{Paid Amount}]$$
   $$\text{Cr Bank Operating A/c (1112) / Cash in Hand (1111)} \quad [\text{Paid Amount}]$$
3. **Cash Purchases**: Even if a purchase is settled in cash immediately, the audit standard requires a two-step transaction:
   - Invoice: Dr Inventory/GST, Cr AP.
   - Payment: Dr AP, Cr Cash/Bank.
   - This ensures complete, unbroken supplier ledger history and TDS compliance.

---

## 12. Purchase Returns & Debit Notes Design

When purchased merchandise is rejected or returned to a supplier:
1. **Lot Ledger Action**: Decrement `remaining_quantity` on the exact source `inventory_cost_lot`. If lot is fully returned, mark `status = 'DEPLETED'`.
2. **Physical Inventory Action**: Decrement `branch_inventory.quantity` atomically.
3. **Accounting Voucher (Debit Note)**:
   $$\begin{aligned}
   \text{Dr} & \quad \text{2111 (Accounts Payable)} && [\text{Total Return Value}] \\
   \text{Cr} & \quad \text{1131 / 1132 / 1133 (Merchandise Inventory)} && [\text{Cost of Goods Returned}] \\
   \text{Cr} & \quad \text{1141–1149 (Input GST Reversal)} && [\text{ITC Reversal under GST Rule 42}]
   \end{aligned}$$
4. Reversal linkages reference original purchase voucher ID.

---

## 13. Negative Stock Policy

### Rule: Strict Prohibition of Negative Physical and Cost Inventory
1. **Physical Inventory**: An order fulfillment cannot proceed if `branch_inventory.quantity < order_item.quantity`.
2. **Cost Valuation**: A COGS entry cannot be posted if `sum(active_lots.remaining_quantity) < order_item.quantity`.
3. **No Phantom Costing**: If physical stock was received at a kitchen before the supplier invoice was entered into the ERP, fulfillment cannot guess or synthesize a unit cost. A dedicated **Goods Received Not Invoiced (GRNI)** suspense workflow or verified opening balance is required.

---

## 14. Branch Transfers Design

When stock moves between branches (e.g. Central Warehouse $\rightarrow$ Branch Hub):
1. **No Purchase / Sale**: A branch transfer is NOT a purchase or revenue transaction.
2. **Physical Movement**:
   - Source Branch `quantity -= X`.
   - Destination Branch `quantity += X`.
3. **Cost Basis Preservation**:
   - The cost lot is transferred from Source Branch to Destination Branch carrying its exact original `unit_cost`.
   - Source lot is marked depleted (`consumed_quantity = X`), and a new transfer-in lot is created at Destination Branch with identical unit cost.
4. **General Ledger Entry**:
   - Within the same legal entity, no GST or revenue is recognized (unless crossing state boundaries requiring GST e-Way bills, which utilizes Branch Clearing Account `1119`).

---

## 15. Opening Balances & Cut-off Protocol

At the official accounting cut-off start date:
1. A physical stock count is audited at every branch.
2. Each verified SKU/variant receives an **Opening Stock Lot** in `inventory_cost_lot` with verified acquisition cost.
3. A formal Opening Journal Voucher is posted:
   $$\text{Dr 1131 (Accessories Inventory)}, \quad \text{Dr 1132 (Cakes Inventory)}$$
   $$\text{Cr 3999 (Opening Balance Equity / Retained Earnings)}$$
4. Historical orders (173) and payments (53) are NOT used to infer opening balances.

---

## 16. Segregation of Duties & Idempotency

### A. Segregation of Duties (SoD)
- `purchase.created_by != purchase.approved_by` is enforced server-side.
- The staff member who posts the voucher (`posted_by`) must hold authorized financial approval roles.
- Client-supplied staff IDs, branch IDs, and role names are completely ignored; derived strictly from the authenticated server session.

### B. Idempotency Key
- `reference_type = 'PURCHASE'`
- `reference_id = purchase.id`
- `reference_event = 'INVOICE_POSTED'`
- Conforms to the partial unique index `idx_voucher_source_event` on `public.accounting_voucher` (`WHERE status <> 'CANCELLED' AND reference_type <> 'MANUAL'`). A purchase invoice cannot be posted twice under any circumstance.

---

## 17. Atomic Posting Transaction Boundary (Step 3B Blueprint)

When `PurchasePostingService.postPurchaseInvoice` is implemented in Step 3B, it will execute within a single atomic PostgreSQL transaction client:

```
BEGIN TRANSACTION
  1. Lock purchase row: SELECT * FROM purchase WHERE id = $1 FOR UPDATE
  2. Verify purchase status === 'APPROVED' (reject DRAFT, SUBMITTED, POSTED)
  3. Validate branch scope (BOLA defense)
  4. Validate accounting start date (hard block if unconfigured)
  5. Validate fiscal period (hard block if 0 rows or locked)
  6. Reconcile purchase line math (subtotal, taxable_value, cgst, sgst, igst, total)
  7. Resolve target accounts (1131, 1132, 1133, 1141-1149, 2111) via CoA repository
  8. Lock branch_inventory rows for all purchase items: SELECT ... FOR UPDATE
  9. Increment branch_inventory.quantity for each variant
 10. Generate inventory_cost_lot records for each purchase item
 11. Create draft voucher -> approve voucher (SoD) -> post voucher via PostingService
 12. Update purchase: status = 'POSTED', posted_at = NOW()
COMMIT TRANSACTION
-- On ANY error: ROLLBACK EVERYTHING. Zero partial records.
```

---

## 18. Prerequisites Before Step 3B Implementation

Before implementing `PurchasePostingService` (Step 3B), the following prerequisites must be formally satisfied:
1. **CoA Semantic Correction**: Authorize and execute the SQL update renaming `1132` to `Merchandise Inventory - Cakes` and `5110` to `COGS - Cakes`.
2. **Inventory Cost Lot Table Migration**: Authorize migration creating `public.inventory_cost_lot` and `public.inventory_cost_consumption`.
3. **Catalog Item Type Resolution**: Standardize the rule mapping purchase items to target asset accounts (`1131` vs `1132` vs `1133`).

---

## 19. Final Gate Checklist

- [x] Live PostgreSQL schema inspected and documented.
- [x] Live row counts verified unchanged (98 accounts, 0 vouchers, 0 journals, 0 fiscal periods, 424 inventory, 173 orders).
- [x] Trading / buy-and-sell business model strictly honored (no manufacturing, no raw materials, no recipe costing).
- [x] Cakes and accessories modeled strictly as merchandise inventory.
- [x] CoA semantic mismatch (1132 and 5110) identified and controlled fix proposed without unauthorized mutation.
- [x] Approach 1 (Purchase Lots) vs Approach 2 (MWA) objectively compared across 25 factual dimensions.
- [x] Authoritative cost basis formula defined in compliance with accounting standards (GST excluded from cost).
- [x] Purchase payments decoupled from purchase invoice posting.
- [x] Negative stock prohibited.
- [x] Idempotency key defined matching existing database partial unique index.
- [x] Atomic posting transaction boundaries defined with row-level locks and full rollback.
- [x] Zero code implementation, zero DB mutations, zero git commits.
