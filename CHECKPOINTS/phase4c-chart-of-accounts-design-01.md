# CAKETOHOME ERP — PHASE 4C: CHART OF ACCOUNTS DESIGN & PURCHASE ACCOUNTING SPECIFICATION
## (FORENSIC INSPECTION & ARCHITECTURAL DESIGN ONLY — ZERO SEEDING / NO CODE EXECUTION)

- **Date**: 2026-09-23 21:15:00 IST
- **Project**: CakeToHome ERP (`E:\vig\cakes2home-main\cakes2home-main`)
- **Git Branch**: `task/dev`
- **Git HEAD**: `f7d9a47`
- **Status**: PHASE 4C DESIGN COMPLETE — NO ACCOUNTS SEEDED — ZERO POSTING MUTATIONS
- **Next Step**: Awaiting explicit User Instruction before Account Seeding

---

## 1. Executive Summary & Mandatory Stop Contract

This document constitutes the authoritative architectural design for **Phase 4C: Chart of Accounts Design + Purchase Accounting Mapping**.

In strict compliance with the Phase 4C authorization rules:
1. **ZERO ACCOUNTS SEEDED**: `public.accounting_account` contains exactly **0 rows**.
2. **ZERO VOUCHERS CREATED**: `public.accounting_voucher` contains exactly **0 rows**.
3. **ZERO JOURNAL ENTRIES CREATED**: `public.accounting_journal_entry` contains exactly **0 rows**.
4. **ZERO JOURNAL LINES CREATED**: `public.accounting_journal_line` contains exactly **0 rows**.
5. **HISTORICAL TRANSACTIONS 100% UNTOUCHED**: All 173 orders and 53 payment transactions remain completely unaltered.
6. **ACCOUNTING START DATE UNCONFIGURED**: `public.setting` has 0 rows for `accounting_start_date`.
7. **POSTING ENGINE NOT IMPLEMENTED**: General ledger posting logic is designed as a future contract, not executed.
8. **ITEM-WISE PURCHASE ENTRY DESIGNED**: Comprehensive multi-line purchase architecture designed, preserving line-level product, quantity, rate, discount, GST, and HSN traceability.
9. **PURCHASE RETURNS DESIGNED**: Documented as future debit note reversal architecture without creating any records.

### Mandatory Workflow Status:
$$\text{FORENSIC INSPECTION} \longrightarrow \text{DESIGN} \longrightarrow \text{INDEPENDENT VERIFICATION} \longrightarrow \text{CHECKPOINT} \longrightarrow \mathbf{STOP}$$

---

## 2. Forensic Inspection: Live Accounting Schema

The five core accounting tables migrated in Phase 4B were forensically re-inspected on the live PostgreSQL 17.6 database:

### 2.1. Live Table: `public.accounting_account`
- **Primary Key**: `id TEXT PRIMARY KEY DEFAULT (gen_random_uuid())::text`
- **Columns Audited**:
  - `id`: `text` (NOT NULL)
  - `code`: `character varying(20)` (NOT NULL, UNIQUE via `uq_accounting_account_code`)
  - `name`: `character varying(100)` (NOT NULL)
  - `type`: `character varying(20)` (NOT NULL, checked by `chk_account_type`)
  - `subtype`: `character varying(30)` (NOT NULL, checked by `chk_account_subtype`)
  - `parent_id`: `text` (NULLABLE, FK $\rightarrow$ `accounting_account(id)` ON DELETE RESTRICT)
  - `level`: `integer` (NOT NULL, DEFAULT 1, checked by `chk_account_level`)
  - `is_group`: `boolean` (NOT NULL, DEFAULT false)
  - `is_system`: `boolean` (NOT NULL, DEFAULT false)
  - `is_active`: `boolean` (NOT NULL, DEFAULT true)
  - `tax_rate`: `numeric` (NULLABLE)
  - `tax_class`: `character varying(30)` (NULLABLE)
  - `description`: `text` (NULLABLE)
  - `metadata`: `jsonb` (NULLABLE)
  - `created_by`: `text` (NOT NULL)
  - `created_at`: `timestamptz` (NOT NULL, DEFAULT now())
  - `updated_at`: `timestamptz` (NOT NULL, DEFAULT now())
  - `deleted_at`: `timestamptz` (NULLABLE)
- **Active Table Constraints**:
  - `accounting_account_parent_id_fkey`: `FOREIGN KEY (parent_id) REFERENCES accounting_account(id) ON DELETE RESTRICT`
  - `uq_accounting_account_code`: `UNIQUE (code)`
  - `chk_account_level`: `CHECK (level >= 1 AND level <= 5)`
  - `chk_account_type`: `CHECK (type IN ('ASSET', 'LIABILITY', 'EQUITY', 'REVENUE', 'EXPENSE'))`
  - `chk_account_subtype`:
    ```sql
    CHECK (subtype IN (
      'CURRENT_ASSET', 'CASH', 'BANK', 'GATEWAY_CLEARING', 'RECEIVABLE', 'INVENTORY', 'INPUT_TAX', 'FIXED_ASSET',
      'CURRENT_LIABILITY', 'PAYABLE', 'OUTPUT_TAX', 'STAFF_PAYABLE', 'CUSTOMER_ADVANCE', 'LONG_TERM_LIABILITY',
      'CAPITAL', 'RETAINED_EARNINGS', 'OPENING_OFFSET',
      'DIRECT_REVENUE', 'INDIRECT_REVENUE', 'DELIVERY_REVENUE',
      'COGS', 'OPERATING_EXPENSE', 'FINANCIAL_EXPENSE'
    ))
    ```
- **Active Indexes**:
  - `accounting_account_pkey` (btree on `id`)
  - `uq_accounting_account_code` (btree on `code`)
  - `idx_accounting_account_code` (btree on `code` WHERE `deleted_at IS NULL`)
  - `idx_accounting_account_type` (btree on `type, subtype`)
  - `idx_accounting_account_parent` (btree on `parent_id`)
  - `idx_accounting_account_active` (btree on `is_active` WHERE `deleted_at IS NULL`)

### 2.2. Hierarchy & Posting Restrictions
1. **Hierarchy Levels**: Exactly 1 to 5. Root categories are Level 1 (`1000 Assets`, `2000 Liabilities`, `3000 Equity`, `4000 Revenue`, `5000 Expenses`). Level $N$ accounts must have a parent at Level $N-1$.
2. **Group Accounts (`is_group = true`)**:
   - Act purely as summarization nodes and categories.
   - **MUST NEVER be referenced in `accounting_journal_line`**. Any journal line attempting to post to an account with `is_group = true` will be rejected by the validation service.
3. **Posting Accounts (`is_group = false`)**:
   - Leaf accounts in the tree.
   - Eligible to receive direct debit and credit amounts in `accounting_journal_line`.
4. **Soft Deletion & Inactive Accounts**:
   - Accounts with `is_active = false` or `deleted_at IS NOT NULL` are locked against new journal lines. Historical postings remain intact with referential integrity (`ON DELETE RESTRICT`).

---

## 3. Forensic Inspection: Existing CakeToHome Business Model

| Entity / Area | Live Database Finding | Key Columns & Characteristics |
|---|---|---|
| **Products** (`public.product`) | 65 rows | `id`, `title`, `handle`, `status`, `metadata`. Contains cakes and accessories. |
| **Product Variants** (`public.product_variant`) | 54 rows | `id`, `product_id`, `title`, `sku`, `manage_inventory`. |
| **Product Categories** (`public.product_category`) | 12 rows | Bakery categories (`cat_signature_cakes`, `cat_cupcakes`) and Non-bakery (`cat_accessories`). |
| **Tax Classifications** | Two primary classes | Bakery / Food: **5% GST** (`txcfg_food_5`). Accessories / Novelties: **18% GST** (`txcfg_standard_18`). Plush toys: **12% GST** (`txcfg_toys_12`). |
| **HSN Codes** | 2 primary codes verified | Bakery: `19059090` (Cakes, pastries, baked goods). Accessories: `95059000` (Festive items, candles, cake toppers). Packaging: `48191000` (Cartons/boxes). |
| **Purchases** (`public.purchase`) | 0 rows | `id`, `supplier_id`, `branch_id`, `invoice_no`, `invoice_date`, `subtotal`, `discount`, `taxable_value`, `cgst`, `sgst`, `igst`, `total`, `payment_method`, `credit_terms_days`, `due_date`, `status`, `posted_at`. |
| **Purchase Items** (`public.purchase_item`) | 0 rows | `id`, `purchase_id`, `product_id`, `variant_id`, `description`, `quantity`, `rate`, `discount`, `taxable_value`, `cgst_rate`, `sgst_rate`, `igst_rate`, `cgst`, `sgst`, `igst`, `total`, `hsn_code`. |
| **Purchase Payments** (`public.purchase_payment`) | 0 rows | `id`, `purchase_id`, `amount`, `method`, `payment_date`, `reference`, `created_by`. |
| **Suppliers** (`public.supplier`) | 0 rows | `id`, `name`, `gstin`, `phone`, `email`, `address`, `city`, `state`, `branch_id`, `is_active`, `metadata`. |
| **Branches** (`public.branch`) | 53 operational branches | `id`, `name`, `code`, `city`, `state`, `address`, `pincode`, `is_active`. Multi-city network (Kolkata, Delhi, Bangalore, Mumbai, etc.). |
| **Branch Inventory** (`public.branch_inventory`) | 424 rows | `product_id` (strictly `acc_01` to `acc_08`), `variant_id`, `quantity`, `reserved`, `branch_id`. Physical accessories only. |
| **Expenses** (`public.expense`) | 0 rows | `id`, `branch_id`, `category_id`, `amount`, `tax_amount`, `cgst`, `sgst`, `igst`, `vendor_name`, `payment_method`, `status`. |
| **Fleet Fuel** (`public.fleet_fuel`) | 0 rows | `id`, `vehicle_id`, `driver_id`, `expense_id`, `liters`, `cost_per_liter`, `total_cost`. |
| **Payment Transactions** (`public.payment_transaction`) | 53 rows (untouched) | `id`, `order_id`, `amount`, `currency`, `provider`, `status`, `settlement_status`. |

---

## 4. Critical Requirement: Item-Wise Product Purchase Entry Design

The CakeToHome ERP requires full support for **Item-Wise Product Purchase Entry**, where a single purchase bill from a vendor contains multiple distinct products, raw materials, or accessories.

### 4.1. Conceptual Document Structure
```
Purchase Bill Header
  ├── Supplier: "Dawn Foods India Pvt Ltd" (GSTIN: 27AABCD1234F1Z5, State: Maharashtra)
  ├── Receiving Branch: "Salt Lake Central Kitchen" (State: West Bengal)
  ├── Bill Number: "DF-INV-2026-891"
  ├── Bill Date: "2026-10-05"
  ├── Credit Terms: 30 Days (Due Date: 2026-11-04)
  │
  ├── Line 1: Belgian Dark Chocolate Couverture 54% (Raw Material / Bakery Ingredient)
  │     ├── Product: prod_choc_54 / HSN: 18062000
  │     ├── Quantity: 50.00 | Unit: KGS | Rate: ₹650.00
  │     ├── Discount: ₹0.00 | Taxable Value: ₹32,500.00
  │     ├── GST Rate: 5.0% (Inter-state: IGST 5.0%)
  │     └── Tax: IGST ₹1,625.00 | Line Total: ₹34,125.00
  │
  ├── Line 2: Metallic Birthday Candle Sets (Quantity-Controlled Merchandise Accessory)
  │     ├── Product: acc_02 / HSN: 95059000
  │     ├── Quantity: 200.00 | Unit: PACK | Rate: ₹45.00
  │     ├── Discount: ₹500.00 | Taxable Value: ₹8,500.00
  │     ├── GST Rate: 18.0% (Inter-state: IGST 18.0%)
  │     └── Tax: IGST ₹1,530.00 | Line Total: ₹10,030.00
  │
  ├── Line 3: Heavy Duty Corrugated Cake Boxes 1kg (Packaging Material)
  │     ├── Product: NULL / HSN: 48191000
  │     ├── Quantity: 500.00 | Unit: NOS | Rate: ₹22.00
  │     ├── Discount: ₹0.00 | Taxable Value: ₹11,000.00
  │     ├── GST Rate: 18.0% (Inter-state: IGST 18.0%)
  │     └── Tax: IGST ₹1,980.00 | Line Total: ₹12,980.00
  │
  ├── Freight Inward / Shipping Charge: ₹1,500.00 (Taxable: ₹1,500.00, IGST 18%: ₹270.00, Total: ₹1,770.00)
  ├── Rounding Difference: -₹0.00
  └── Purchase Total: ₹58,905.00
```

### 4.2. Twenty Core Operational & Accounting Answers

1. **How a purchase item identifies the product**:
   - Via `purchase_item.product_id` (TEXT, foreign key to `public.product.id`).
   - If purchasing a specific variant (e.g. 500g pack vs 1kg pack), `purchase_item.variant_id` links to `public.product_variant.id`.
   - For non-catalog purchases (e.g. bulk raw flour, dairy milk, packaging boxes, cleaning materials), `product_id` is `NULL` and `purchase_item.description` provides the full item specification.
2. **How quantity is stored**:
   - `purchase_item.quantity` is stored as `NUMERIC(12, 2)` (strictly `> 0.00`). Allows fractional quantities (e.g. 12.50 kg of cocoa butter).
3. **How unit of measure (UOM) is stored**:
   - Captured in `product.metadata->'uqc'` (e.g. `KGS`, `NOS`, `BOX`, `LTR`, `PAC`) or on ad-hoc lines via `purchase_item.metadata->'uom'`.
4. **How purchase rate is stored**:
   - `purchase_item.rate` stored as `NUMERIC(15, 2)` (strictly `>= 0.00`). Represents the unit rate in INR per UOM before trade discount and tax.
5. **How discount is stored**:
   - `purchase_item.discount` stored as `NUMERIC(15, 2)` (default `0.00`). Represents item-level trade discount deducted from gross line amount ($Quantity \times Rate$).
6. **How taxable amount is calculated**:
   $$\text{taxable\_value} = (\text{quantity} \times \text{rate}) - \text{discount}$$
   Server validates that $\text{taxable\_value} \ge 0.00$.
7. **How GST rate is determined**:
   - If `product_id` is selected, the system pulls the canonical tax configuration (`gst_rate`: 5%, 12%, or 18%).
   - If non-catalog, the user selects the applicable GST rate bracket (5%, 12%, 18%, or 0%).
   - Stored in `purchase_item.cgst_rate`, `purchase_item.sgst_rate`, and `purchase_item.igst_rate`.
8. **How CGST/SGST/IGST is determined**:
   - Based on GST Place of Supply rules:
     - **Intra-state Purchase** ($\text{Supplier State} = \text{Receiving Branch State}$):
       $$\text{cgst\_rate} = \frac{\text{GST Rate}}{2}, \quad \text{sgst\_rate} = \frac{\text{GST Rate}}{2}, \quad \text{igst\_rate} = 0$$
       $$\text{cgst} = \text{round}\left(\frac{\text{taxable\_value} \times \text{cgst\_rate}}{100}, 2\right), \quad \text{sgst} = \text{round}\left(\frac{\text{taxable\_value} \times \text{sgst\_rate}}{100}, 2\right), \quad \text{igst} = 0$$
     - **Inter-state Purchase** ($\text{Supplier State} \neq \text{Receiving Branch State}$):
       $$\text{cgst\_rate} = 0, \quad \text{sgst\_rate} = 0, \quad \text{igst\_rate} = \text{GST Rate}$$
       $$\text{cgst} = 0, \quad \text{sgst} = 0, \quad \text{igst} = \text{round}\left(\frac{\text{taxable\_value} \times \text{igst\_rate}}{100}, 2\right)$$
9. **How HSN is captured**:
   - Stored in `purchase_item.hsn_code` (`19059090` bakery, `95059000` accessories, `48191000` packaging). Defaults from product catalog or manual input.
10. **How line total is calculated**:
    $$\text{line\_total} = \text{taxable\_value} + \text{cgst} + \text{sgst} + \text{igst}$$
    Stored in `purchase_item.total`.
11. **How purchase-level charges are handled**:
    - Handled as distinct service line items on the purchase document (e.g. "Freight Inward", "Loading Charges", "Transit Insurance") with their respective HSN (e.g. `9965` for goods transport) and GST rate (typically 18% or 5% under RCM).
12. **How freight/other charges are handled**:
    - When billed by the product supplier on the same invoice, debited to `5240 Freight & Cartage Inward`. Under accounting standards (Ind AS 2), landed cost allocation to inventory will occur via periodic standard cost recalculation.
13. **How purchase-level discount is handled if supported**:
    - Overall bill discount is either apportioned pro-rata across item taxable values prior to tax calculation, or credited to `5190 Purchase Discounts Received` upon settlement.
14. **How rounding is handled**:
    - The difference between mathematical sum ($\sum \text{line\_total}$) and the supplier's printed invoice total (within $\pm ₹0.50$) is posted to `5295 Cash Rounding / Variance`.
15. **How the purchase total reconciles to its item lines**:
    - Server-side validation strictly enforces:
      $$\text{purchase.subtotal} \equiv \sum \text{item.quantity} \times \text{item.rate}$$
      $$\text{purchase.discount} \equiv \sum \text{item.discount} + \text{bill\_level\_discount}$$
      $$\text{purchase.taxable\_value} \equiv \sum \text{item.taxable\_value}$$
      $$\text{purchase.cgst} \equiv \sum \text{item.cgst}, \quad \text{purchase.sgst} \equiv \sum \text{item.sgst}, \quad \text{purchase.igst} \equiv \sum \text{item.igst}$$
      $$\text{purchase.total} \equiv \text{purchase.taxable\_value} + \text{cgst} + \text{sgst} + \text{igst} + \text{charges} \pm \text{rounding}$$
16. **How supplier outstanding is derived later**:
    - Derived exclusively from the General Ledger control account `2111 Accounts Payable` filtered by `supplier_id`:
      $$\text{Supplier Outstanding} = \sum \text{Credit Postings (Purchases)} - \sum \text{Debit Postings (Payments + Debit Notes)}$$
17. **How cash/credit purchase is represented**:
    - **Credit Purchase**: `purchase.payment_method` is `NULL` or `'CREDIT'`, `due_date` populated. Full amount credited to `2111 Accounts Payable` with `supplier_id`.
    - **Cash / Immediate Purchase**: `purchase.payment_method` is `'CASH'`, `'BANK_TRANSFER'`, or `'UPI'`. Full amount initially credited to `2111 Accounts Payable`, and simultaneously a payment voucher is generated debiting `2111 Accounts Payable` and crediting `1111 Cash in Hand` or `1112 Bank Operating A/c` (maintains complete supplier ledger audit trail).
18. **How purchase payments are represented**:
    - Recorded in `public.purchase_payment` with `purchase_id`, `amount`, `method`, `payment_date`, `reference`.
    - Generates an accounting voucher of type `PAYMENT`:
      - Dr `2111 Accounts Payable` (carrying `supplier_id` dimension)
      - Cr `1111 Cash in Hand` / `1112 Bank Operating A/c` / `1114 Petty Cash`
19. **How purchase returns will eventually reference original items**:
    - A future `DEBIT_NOTE` voucher will link:
      - `reference_type = 'PURCHASE_RETURN'`, `reference_id = purchase_return.id`.
      - Each return line references `original_purchase_id` and `original_purchase_item_id`.
      - Reverses original purchase accounting (debit `2111 Accounts Payable`, credit input tax `1141-1146`, credit inventory `1131` or raw material expense `5110`).
20. **How physical inventory will eventually be affected**:
    - **Physical Stock Items (Accessories `acc_*`, Packaging boxes)**: Upon `POSTED` status, atomic increment to `branch_inventory.quantity` at the receiving `branch_id`.
    - **Made-to-Order Cakes (`prod_*`)**: **ZERO inventory mutation**. Cakes are never quantity-controlled. Raw ingredients consumed in baking are expensed to `5110 Raw Material Consumption`.

---

## 5. Important Inventory Boundary: Physical Stock vs Made-to-Order

To prevent data corruption and uphold the verified CakeToHome business model established in Phase 0–3, the accounting and inventory modules strictly distinguish three distinct product concepts:

```
┌────────────────────────────────────────────────────────────────────────┐
│                        CAKETOHOME DOMAIN BOUNDARY                       │
├───────────────────────────────────┬────────────────────────────────────┤
│   MODEL A: PHYSICAL INVENTORY     │    MODEL B: MADE-TO-ORDER BAKERY   │
│   (Stock-Controlled Accessories)  │    (On-Demand Prepared Food)       │
├───────────────────────────────────┼────────────────────────────────────┤
│ • Candles, Toppers, Ribbons       │ • Birthday Cakes, Cupcakes         │
│ • Quantity-controlled tracking    │ • Daily Kitchen Availability       │
│ • branch_inventory (quantity,res) │ • branch.metadata->'product_avail' │
│ • Accounting Debit:               │ • Accounting Debit:                │
│   1131 Merchandise Inventory      │   5110 Raw Material Consumption    │
│ • Stock increment on purchase     │ • Zero branch_inventory creation   │
│ • COGS recognized upon sale (5120)│ • Immediate expense upon purchase  │
└───────────────────────────────────┴────────────────────────────────────┘
```

> [!IMPORTANT]
> **Strict Operational Rule**: Under no circumstance will a purchase bill containing a cake create synthetic stock in `public.branch_inventory`. Cakes are perishable, made on-demand, and tracked purely by kitchen availability schedules.

---

## 6. Authoritative CakeToHome Chart of Accounts Hierarchy

The authoritative Chart of Accounts contains **98 accounts** structured across 5 hierarchy levels:
- **Level 1**: Top-level accounting groups (`1000`, `2000`, `3000`, `4000`, `5000`)
- **Level 2**: Major classification groups (`1100`, `1500`, `2100`, `2500`, `3100`, `3200`, `4100`, `4200`, `5100`, `5200`, `5300`)
- **Level 3**: Operational sub-groups and posting accounts
- **Level 4**: Atomic posting accounts and control ledgers

### Complete Account-by-Account Specification Matrix

| Code | Account Name | Parent | Lvl | Type | Subtype | Group? | Business Purpose & Dimensions |
|---|---|---|---|---|---|---|---|
| **1000** | Assets | NULL | 1 | ASSET | CURRENT_ASSET | TRUE | Top-level Asset Group |
| **1100** | Current Assets | 1000 | 2 | ASSET | CURRENT_ASSET | TRUE | Current Assets Summary |
| **1110** | Cash and Cash Equivalents | 1100 | 3 | ASSET | CURRENT_ASSET | TRUE | Liquid Funds Group |
| **1111** | Cash in Hand | 1110 | 4 | ASSET | CASH | FALSE | Physical cash drawers at retail branches [Branch Dimension] |
| **1112** | Bank Operating A/c | 1110 | 4 | ASSET | BANK | FALSE | Primary current bank account for settlements & vendor payments |
| **1113** | Gateway Clearing | 1110 | 4 | ASSET | GATEWAY_CLEARING | FALSE | Online payment gateway transit clearing account |
| **1114** | Petty Cash - Branches | 1110 | 4 | ASSET | CASH | FALSE | Branch manager petty cash imprest floats [Branch Dimension] |
| **1119** | Unclassified Suspense | 1110 | 4 | ASSET | CURRENT_ASSET | FALSE | Temporary unallocated receipts awaiting reconciliation |
| **1120** | Receivables and Advances | 1100 | 3 | ASSET | CURRENT_ASSET | TRUE | Debtors and short-term receivables group |
| **1121** | Accounts Receivable | 1120 | 4 | ASSET | RECEIVABLE | FALSE | Trade debtors control ledger [Customer Dimension Required] |
| **1122** | Undeposited COD | 1120 | 4 | ASSET | CURRENT_ASSET | FALSE | Cash collected by delivery fleet pending branch cash-in |
| **1123** | Staff Advances | 1120 | 4 | ASSET | CURRENT_ASSET | FALSE | Short-term salary advances to kitchen/delivery staff |
| **1124** | Security Deposits - Leases | 1120 | 4 | ASSET | CURRENT_ASSET | FALSE | Rental security deposits for cloud kitchens & retail outlets |
| **1130** | Inventories | 1100 | 3 | ASSET | CURRENT_ASSET | TRUE | Stock and physical inventory group |
| **1131** | Merchandise Inventory - Accessories | 1130 | 4 | ASSET | INVENTORY | FALSE | Physical quantity-controlled party accessories (candles, toppers) |
| **1132** | Bakery Raw Materials & Ingredients | 1130 | 4 | ASSET | INVENTORY | FALSE | Periodic balance sheet valuation of bulk chocolate, flour, dairy |
| **1133** | Packaging Supplies Stock | 1130 | 4 | ASSET | INVENTORY | FALSE | Unused cake boxes, ribbons, boards, cutlery bags |
| **1140** | Duties & Taxes - Input Tax Credit | 1100 | 3 | ASSET | CURRENT_ASSET | TRUE | GST Input Tax Credits (ITC) summary group |
| **1141** | Input CGST 2.5% (Food/Bakery) | 1140 | 4 | ASSET | INPUT_TAX | FALSE | Intrastate CGST credit on 5% food/bakery purchases (2.5%) |
| **1142** | Input SGST 2.5% (Food/Bakery) | 1140 | 4 | ASSET | INPUT_TAX | FALSE | Intrastate SGST credit on 5% food/bakery purchases (2.5%) |
| **1143** | Input CGST 9.0% (Accessories/General) | 1140 | 4 | ASSET | INPUT_TAX | FALSE | Intrastate CGST credit on 18% accessories/services (9.0%) |
| **1144** | Input SGST 9.0% (Accessories/General) | 1140 | 4 | ASSET | INPUT_TAX | FALSE | Intrastate SGST credit on 18% accessories/services (9.0%) |
| **1145** | Input IGST 5.0% (Interstate Food) | 1140 | 4 | ASSET | INPUT_TAX | FALSE | Interstate IGST credit on 5% food/bakery purchases (5.0%) |
| **1146** | Input IGST 18.0% (Interstate Accessories) | 1140 | 4 | ASSET | INPUT_TAX | FALSE | Interstate IGST credit on 18% accessories/freight/services (18.0%) |
| **1147** | Input CGST 6.0% (Toys/Novelties) | 1140 | 4 | ASSET | INPUT_TAX | FALSE | Intrastate CGST credit on 12% novelty/toy purchases (6.0%) |
| **1148** | Input SGST 6.0% (Toys/Novelties) | 1140 | 4 | ASSET | INPUT_TAX | FALSE | Intrastate SGST credit on 12% novelty/toy purchases (6.0%) |
| **1149** | Input IGST 12.0% (Interstate Toys) | 1140 | 4 | ASSET | INPUT_TAX | FALSE | Interstate IGST credit on 12% novelty/toy purchases (12.0%) |
| **1500** | Fixed Assets (PP&E) | 1000 | 2 | ASSET | FIXED_ASSET | TRUE | Property, Plant and Equipment summary group |
| **1510** | Bakery & Kitchen Equipment | 1500 | 3 | ASSET | FIXED_ASSET | FALSE | Commercial deck ovens, planetary mixers, blast freezers |
| **1520** | Delivery Vehicles & Fleet | 1500 | 3 | ASSET | FIXED_ASSET | FALSE | Delivery vans and temperature-controlled two-wheelers |
| **1530** | Computers & POS Hardware | 1500 | 3 | ASSET | FIXED_ASSET | FALSE | Thermal bill printers, tablets, kitchen display units |
| **1540** | Furniture & Fixtures | 1500 | 3 | ASSET | FIXED_ASSET | FALSE | Retail display chillers, customer counters, kitchen stainless steel tables |
| **1590** | Accumulated Depreciation | 1500 | 3 | ASSET | FIXED_ASSET | FALSE | Cumulative depreciation contra-asset account |
| **2000** | Liabilities | NULL | 1 | LIABILITY | CURRENT_LIABILITY | TRUE | Top-level Liability Group |
| **2100** | Current Liabilities | 2000 | 2 | LIABILITY | CURRENT_LIABILITY | TRUE | Current Obligations Group |
| **2110** | Trade Payables | 2100 | 3 | LIABILITY | CURRENT_LIABILITY | TRUE | Creditors and trade payables group |
| **2111** | Accounts Payable | 2110 | 4 | LIABILITY | PAYABLE | FALSE | Trade payables control ledger [Supplier Dimension Required] |
| **2120** | Duties & Taxes - Output Tax Liability | 2100 | 3 | LIABILITY | CURRENT_LIABILITY | TRUE | GST Output tax liability summary group |
| **2121** | Output CGST 2.5% (Food/Bakery) | 2120 | 4 | LIABILITY | OUTPUT_TAX | FALSE | Intrastate CGST collected on 5% bakery sales (2.5%) |
| **2122** | Output SGST 2.5% (Food/Bakery) | 2120 | 4 | LIABILITY | OUTPUT_TAX | FALSE | Intrastate SGST collected on 5% bakery sales (2.5%) |
| **2123** | Output CGST 9.0% (Accessories) | 2120 | 4 | LIABILITY | OUTPUT_TAX | FALSE | Intrastate CGST collected on 18% accessory sales (9.0%) |
| **2124** | Output SGST 9.0% (Accessories) | 2120 | 4 | LIABILITY | OUTPUT_TAX | FALSE | Intrastate SGST collected on 18% accessory sales (9.0%) |
| **2125** | Output IGST 5.0% (Interstate Food) | 2120 | 4 | LIABILITY | OUTPUT_TAX | FALSE | Interstate IGST collected on 5% bakery orders (5.0%) |
| **2126** | Output IGST 18.0% (Interstate Accessories) | 2120 | 4 | LIABILITY | OUTPUT_TAX | FALSE | Interstate IGST collected on 18% accessory orders (18.0%) |
| **2127** | Output CGST 6.0% (Toys) | 2120 | 4 | LIABILITY | OUTPUT_TAX | FALSE | Intrastate CGST collected on 12% novelty sales (6.0%) |
| **2128** | Output SGST 6.0% (Toys) | 2120 | 4 | LIABILITY | OUTPUT_TAX | FALSE | Intrastate SGST collected on 12% novelty sales (6.0%) |
| **2129** | Output IGST 12.0% (Interstate Toys) | 2120 | 4 | LIABILITY | OUTPUT_TAX | FALSE | Interstate IGST collected on 12% novelty orders (12.0%) |
| **2130** | TDS Payable | 2100 | 3 | LIABILITY | CURRENT_LIABILITY | FALSE | Tax Deducted at Source payable to government |
| **2140** | Advances & Unearned Revenue | 2100 | 3 | LIABILITY | CURRENT_LIABILITY | TRUE | Customer advance bookings and stored value |
| **2141** | Customer Advances | 2140 | 4 | LIABILITY | CUSTOMER_ADVANCE | FALSE | Prepaid customer cake deposits [Customer Dimension Required] |
| **2142** | Gift Card / Wallet Liabilities | 2140 | 4 | LIABILITY | CURRENT_LIABILITY | FALSE | Store wallet balances and unredeemed gift cards |
| **2150** | Operating Accruals & Staff Payables | 2100 | 3 | LIABILITY | CURRENT_LIABILITY | TRUE | Accrued expenses and payroll obligations |
| **2151** | Salaries & Wages Payable | 2150 | 4 | LIABILITY | STAFF_PAYABLE | FALSE | Monthly unpaid salaries for bakery chefs and riders |
| **2152** | Rent Payable | 2150 | 4 | LIABILITY | CURRENT_LIABILITY | FALSE | Accrued shop and central kitchen lease obligations |
| **2153** | Accrued Operating Expenses | 2150 | 4 | LIABILITY | CURRENT_LIABILITY | FALSE | Accrued power, broadband, water, and vendor dues |
| **2500** | Long-Term Liabilities | 2000 | 2 | LIABILITY | LONG_TERM_LIABILITY | TRUE | Term loans and non-current liabilities group |
| **2510** | Bank Loans & Borrowings | 2500 | 3 | LIABILITY | LONG_TERM_LIABILITY | FALSE | Secured term loans and kitchen equipment financing |
| **3000** | Equity | NULL | 1 | EQUITY | CAPITAL | TRUE | Top-level Equity Group |
| **3100** | Capital & Reserves | 3000 | 2 | EQUITY | CAPITAL | TRUE | Owners equity group |
| **3110** | Partner / Shareholder Capital | 3100 | 3 | EQUITY | CAPITAL | FALSE | Primary invested capital of founders/partners |
| **3120** | Drawings / Distributions | 3100 | 3 | EQUITY | CAPITAL | FALSE | Partner capital withdrawals and dividends |
| **3200** | Retained Earnings Group | 3000 | 2 | EQUITY | RETAINED_EARNINGS | TRUE | Cumulative retained earnings group |
| **3210** | Retained Earnings (Prior Years) | 3200 | 3 | EQUITY | RETAINED_EARNINGS | FALSE | Accumulated profits from prior completed fiscal years |
| **3220** | Current Year Net Earnings | 3200 | 3 | EQUITY | RETAINED_EARNINGS | FALSE | Current fiscal year P&L net income roll-up |
| **3300** | Opening Balance Offset / Capital Reserve | 3000 | 2 | EQUITY | OPENING_OFFSET | FALSE | Balancing equity offset account for official opening cut-off |
| **4000** | Revenue | NULL | 1 | REVENUE | DIRECT_REVENUE | TRUE | Top-level Revenue Group |
| **4100** | Operating Revenue | 4000 | 2 | REVENUE | DIRECT_REVENUE | TRUE | Core business sales group |
| **4110** | Cake & Bakery Sales Revenue (5% GST) | 4100 | 3 | REVENUE | DIRECT_REVENUE | FALSE | Net revenue from fresh cakes, pastries, cupcakes |
| **4120** | Accessory & Merchandise Sales Revenue (18% GST) | 4100 | 3 | REVENUE | DIRECT_REVENUE | FALSE | Net revenue from party candles, toppers, toys |
| **4130** | Delivery & Shipping Charges Collected | 4100 | 3 | REVENUE | DELIVERY_REVENUE | FALSE | Delivery and courier fees billed to customers |
| **4140** | Customization & Midnight Surcharges | 4100 | 3 | REVENUE | DIRECT_REVENUE | FALSE | Midnight delivery slot charges, custom photo-cake fees |
| **4190** | Sales Returns, Refunds & Allowances | 4100 | 3 | REVENUE | DIRECT_REVENUE | FALSE | Contra-revenue account for cancelled/refunded customer orders |
| **4200** | Other / Indirect Income | 4000 | 2 | REVENUE | INDIRECT_REVENUE | TRUE | Non-operating revenue group |
| **4210** | Interest Income | 4200 | 3 | REVENUE | INDIRECT_REVENUE | FALSE | Bank sweep account interest received |
| **4220** | Scrap & By-product Sales | 4200 | 3 | REVENUE | INDIRECT_REVENUE | FALSE | Sale of empty edible oil tins, corrugated scrap, discarded trays |
| **5000** | Expenses | NULL | 1 | EXPENSE | OPERATING_EXPENSE | TRUE | Top-level Expense Group |
| **5100** | Cost of Goods Sold (COGS) | 5000 | 2 | EXPENSE | COGS | TRUE | Direct kitchen production costs group |
| **5110** | Raw Material Consumption / Bakery Ingredients | 5100 | 3 | EXPENSE | COGS | FALSE | Flour, dairy butter, chocolate, fruits, eggs, fondants consumed |
| **5120** | Accessory Merchandise Sold (Cost of Accessories) | 5100 | 3 | EXPENSE | COGS | FALSE | Cost of candles, toppers, and novelties sold to customers |
| **5130** | Packaging Materials Consumed | 5100 | 3 | EXPENSE | COGS | FALSE | Printed cake boxes, cake base boards, ribbons, knives, tissue |
| **5140** | Kitchen Direct Labour / Chef Wages | 5100 | 3 | EXPENSE | COGS | FALSE | Direct compensation for master pastry chefs and kitchen assistants |
| **5190** | Purchase Discounts Received | 5100 | 3 | EXPENSE | COGS | FALSE | Contra-COGS vendor prompt payment/trade discounts |
| **5200** | Operational & Administrative Expenses | 5000 | 2 | EXPENSE | OPERATING_EXPENSE | TRUE | Commercial overheads group |
| **5210** | Store & Kitchen Rent | 5200 | 3 | EXPENSE | OPERATING_EXPENSE | FALSE | Monthly rent for retail shops, central bakery hubs [Branch Dim] |
| **5220** | Electricity, Gas & Utilities | 5200 | 3 | EXPENSE | OPERATING_EXPENSE | FALSE | Commercial three-phase power, commercial LPG cylinders [Branch Dim] |
| **5230** | Vehicle Fuel & Fleet Maintenance | 5200 | 3 | EXPENSE | OPERATING_EXPENSE | FALSE | Delivery vehicle petrol/diesel, engine servicing, tire repairs |
| **5240** | Freight & Cartage Inward | 5200 | 3 | EXPENSE | OPERATING_EXPENSE | FALSE | Freight paid on raw materials, packaging, and store transfers |
| **5250** | Staff Salaries & Store Personnel | 5200 | 3 | EXPENSE | OPERATING_EXPENSE | FALSE | Branch managers, cashiers, customer care staff compensation |
| **5260** | Marketing & Customer Promotion | 5200 | 3 | EXPENSE | OPERATING_EXPENSE | FALSE | Digital advertising (Meta/Google), influencer cake promos |
| **5270** | Repairs & Kitchen Maintenance | 5200 | 3 | EXPENSE | OPERATING_EXPENSE | FALSE | Chiller gas refills, oven element replacements, pest control |
| **5280** | Software, Internet & Tech Infrastructure | 5200 | 3 | EXPENSE | OPERATING_EXPENSE | FALSE | Cloud server hosting, Supabase DB, branch high-speed broadband |
| **5290** | Payment Gateway MDR Fees | 5200 | 3 | EXPENSE | OPERATING_EXPENSE | FALSE | Razorpay / Stripe transaction processing charges (1.8% to 2.0%) |
| **5295** | Cash Rounding / Variance | 5200 | 3 | EXPENSE | OPERATING_EXPENSE | FALSE | Fractional currency rounding differences on sales and purchase bills |
| **5299** | Miscellaneous Operating Expenses | 5200 | 3 | EXPENSE | OPERATING_EXPENSE | FALSE | Sundry cleaning, sanitation, municipal trade license renewals |
| **5300** | Financial & Depreciation Expenses | 5000 | 2 | EXPENSE | FINANCIAL_EXPENSE | TRUE | Financial costs and asset write-downs group |
| **5310** | Bank Charges & Processing Fees | 5300 | 3 | EXPENSE | FINANCIAL_EXPENSE | FALSE | Current account maintenance charges, RTGS/NEFT fees |
| **5320** | Loan Interest Expense | 5300 | 3 | EXPENSE | FINANCIAL_EXPENSE | FALSE | Finance charges on working capital loans |
| **5330** | Depreciation & Amortization | 5300 | 3 | EXPENSE | OPERATING_EXPENSE | FALSE | Periodic depreciation charge on ovens, POS machines, vehicles |

---

## 7. Purchase Item $\longrightarrow$ Accounting Mapping Matrix

When an approved purchase bill reaches `POSTED` status in the future posting engine, each line item maps systematically to the General Ledger based on its item classification:

```
Purchase Item Line
        │
        ├── Product Classification
        │         │
        │         ├── Physical Accessory (acc_*) ───► Dr 1131 Merchandise Inventory - Accessories
        │         ├── Bakery Ingredients (Raw)  ───► Dr 5110 Raw Material Consumption / Bakery Ingredients
        │         ├── Packaging Supplies        ───► Dr 5130 Packaging Materials Consumed
        │         ├── Equipment / Asset         ───► Dr 1510/1530 Fixed Assets
        │         └── Freight / Transport       ───► Dr 5240 Freight & Cartage Inward
        │
        ├── GST Tax Component
        │         │
        │         ├── Intra-state 5% (Food)     ───► Dr 1141 Input CGST 2.5% + Dr 1142 Input SGST 2.5%
        │         ├── Intra-state 18% (Acc/Svc) ───► Dr 1143 Input CGST 9.0% + Dr 1144 Input SGST 9.0%
        │         ├── Intra-state 12% (Toys)    ───► Dr 1147 Input CGST 6.0% + Dr 1148 Input SGST 6.0%
        │         ├── Inter-state 5% (Food)     ───► Dr 1145 Input IGST 5.0%
        │         ├── Inter-state 18% (Acc/Svc) ───► Dr 1146 Input IGST 18.0%
        │         └── Inter-state 12% (Toys)    ───► Dr 1149 Input IGST 12.0%
        │
        └── Balancing Credit
                  │
                  ├── Credit Purchase           ───► Cr 2111 Accounts Payable (supplier_id dimension)
                  ├── Cash Purchase             ───► Cr 1111 Cash in Hand (branch_id dimension)
                  └── Bank / UPI Purchase       ───► Cr 1112 Bank Operating A/c
```

### Detailed Operational Item Mappings:

| Item Classification | Live Example SKUs | Debit Account (Inventory / Expense) | GST Input Account (Intrastate) | GST Input Account (Interstate) | Credit Account (Payable / Payment) | Sub-ledger Dimension |
|---|---|---|---|---|---|---|
| **Stock Accessories** | `acc_01` (Gold candles), `acc_02` (Toppers) | `1131 Merchandise Inventory` | `1143 Input CGST 9%` + `1144 Input SGST 9%` | `1146 Input IGST 18%` | `2111 Accounts Payable` | `supplier_id` (on 2111), `branch_id` |
| **Bakery Ingredients** | Flour, Butter, Dark Truffle, Fondants | `5110 Raw Material Consumption` | `1141 Input CGST 2.5%` + `1142 Input SGST 2.5%` | `1145 Input IGST 5%` | `2111 Accounts Payable` | `supplier_id` (on 2111), `branch_id` |
| **Packaging Material** | Corrugated cake boxes, Cake boards | `5130 Packaging Materials Consumed` | `1143 Input CGST 9%` + `1144 Input SGST 9%` | `1146 Input IGST 18%` | `2111 Accounts Payable` | `supplier_id` (on 2111), `branch_id` |
| **Novelty Plush Toys** | Birthday teddy bears, plush toys | `1131 Merchandise Inventory` | `1147 Input CGST 6%` + `1148 Input SGST 6%` | `1149 Input IGST 12%` | `2111 Accounts Payable` | `supplier_id` (on 2111), `branch_id` |
| **Kitchen Equipment** | Planetary mixers, Blenders, Oven racks | `1510 Bakery & Kitchen Equipment` | `1143 Input CGST 9%` + `1144 Input SGST 9%` | `1146 Input IGST 18%` | `2111 Accounts Payable` | `supplier_id` (on 2111), `branch_id` |
| **Freight Inward** | Vendor freight charges on ingredients | `5240 Freight & Cartage Inward` | `1143 Input CGST 9%` + `1144 Input SGST 9%` | `1146 Input IGST 18%` | `2111 Accounts Payable` | `supplier_id` (on 2111), `branch_id` |
| **Invoice Rounding** | Paise rounding fraction on supplier bill | `5295 Cash Rounding / Variance` | None (0.00) | None (0.00) | `2111 Accounts Payable` | `supplier_id` (on 2111), `branch_id` |

---

## 8. Purchase Document vs Accounting Voucher

To ensure clean architecture and audit traceability, the system maintains a strict separation between operational purchase documents and financial vouchers:

```
OPERATIONAL LAYER: purchase & purchase_item
  ├── Preserves commercial details: SKU, vendor part number, physical quantity, unit rate
  ├── Preserves individual line discounts, GST percentages, HSN codes
  ├── Tracks receiving branch warehouse, verification notes, delivery challan numbers
  └── Retains immutable source document id: pur_... and line ids: puri_...
           │
           │ (Voucher Generation on Approval: status = 'POSTED')
           ▼
FINANCIAL LAYER: accounting_voucher & accounting_journal_entry
  ├── Summarizes accounting impact into balanced debits and credits
  ├── Aggregates line debits by account code (e.g. all 18% supplies roll into 1131/5130)
  ├── Aggregates tax debits by tax code (e.g. Input CGST 9% and Input SGST 9%)
  ├── Maintains single creditor credit line in 2111 Accounts Payable carrying supplier_id
  ├── Enforces reference_type = 'PURCHASE', reference_id = purchase.id, reference_event = 'PRIMARY'
  └── Every journal line retains reference metadata linking back to specific purchase_item.id rows
```

This guarantees that:
1. Operational purchase registers can be audited line-by-line against physical vendor bills.
2. The General Ledger remains clean, condensed, and balanced without bloating journal lines with redundant non-financial metadata.
3. Every accounting line can be drilled down to its exact operational source item in one click.

---

## 9. Purchase Return & Debit Note Architecture (Future Design)

When physical accessories or bulk ingredients are rejected, damaged, or returned to a supplier, the transaction will be processed via a **Purchase Return / Debit Note**:

### 9.1. Operational Workflow
1. User creates a `Purchase Return` document referencing the original `purchase.id`.
2. User selects specific `purchase_item.id` lines and specifies the `returned_quantity` and `reason` (e.g. damaged, expired, wrong SKU).
3. The return rate defaults to the original purchase rate from `purchase_item.rate`.
4. The system calculates the return taxable value and corresponding GST reversal based on original tax rates.

### 9.2. Accounting Treatment (Debit Note Voucher)
Upon approval of the purchase return:
1. A voucher of type `DEBIT_NOTE` is created:
   - `reference_type = 'PURCHASE_RETURN'`, `reference_id = purchase_return.id`, `reference_event = 'PRIMARY'`.
2. Journal lines:
   - **Debit**: `2111 Accounts Payable` (carrying `supplier_id` dimension) $\longrightarrow$ reduces outstanding liability to the vendor.
   - **Credit**: Original Asset / Expense Account:
     - If physical accessory (`acc_*`): Credit `1131 Merchandise Inventory - Accessories`.
     - If raw material: Credit `5110 Raw Material Consumption / Bakery Ingredients`.
     - If packaging: Credit `5130 Packaging Materials Consumed`.
   - **Credit**: Input Tax Credit Reversal:
     - Credit `1141-1149 Input GST` (reverses the input tax originally claimed, as mandated by Section 34 of the CGST Act).
3. Physical Inventory:
   - For stock-controlled items (`acc_*`), atomically deducts `returned_quantity` from `public.branch_inventory` at the corresponding branch.

---

## 10. Multi-Branch Dimension & Enterprise Consolidation

### 10.1. Enterprise Chart of Accounts (Single Source of Truth)
- CakeToHome uses a **unified, enterprise-wide Chart of Accounts**. Account codes (`1111`, `2111`, `4110`, `5110`) are identical across all 53 branches.
- Individual branches **do NOT create separate duplicate accounts** (e.g. no `1111-KOL`, `1111-DEL`).

### 10.2. Multi-Branch Isolation & Consolidation
- Every voucher header (`accounting_voucher.branch_id`), journal entry (`accounting_journal_entry.branch_id`), and journal line (`accounting_journal_line.branch_id`) carries the foreign key to `public.branch.id`.
- **Branch Manager Isolation**:
  - Staff and branch managers can only query vouchers, ledgers, and trial balances filtered by their assigned `branch_id`.
  - Cash in Hand (`1111`) filtered by `branch_id` represents the exact physical cash drawer of that branch.
- **Enterprise Consolidation (Super Admin)**:
  - Super Admin and finance controllers query without branch filters to generate consolidated enterprise Balance Sheets, consolidated P&L statements, and state-wise GST returns.

---

## 11. Customer & Supplier Dimensions (Sub-Ledger Integrity)

The live schema provides optional dimensional columns on `public.accounting_journal_line`:
- `customer_id TEXT NULL REFERENCES public.customer(id) ON DELETE RESTRICT`
- `supplier_id TEXT NULL REFERENCES public.supplier(id) ON DELETE RESTRICT`

### Mandatory Sub-Ledger Posting Rules:
1. **Accounts Receivable (`1121`)**:
   - Every debit line (order billing) and credit line (customer payment collection) **MUST have a valid `customer_id`**.
   - Anonymous walk-in POS sales will use the default retail customer record (`cus_walkin_retail`).
2. **Accounts Payable (`2111`)**:
   - Every credit line (purchase invoice) and debit line (supplier payment / debit note) **MUST have a valid `supplier_id`**.
   - Zero unassigned trade payables are permitted.
3. **Customer Advances (`2141`)**:
   - Every advance receipt must carry `customer_id`.
4. **Other Accounts**:
   - General expenses, inventory, cash, and tax lines leave `customer_id` and `supplier_id` as `NULL`.

---

## 12. Future Posting Engine Requirements (Architectural Contract)

The future posting engine (to be implemented in a subsequent phase upon explicit authorization) must satisfy these non-negotiable requirements:
1. **Atomic Posting**:
   - Creating `accounting_journal_entry` and all child `accounting_journal_line` records must execute inside a single atomic database transaction.
2. **Pre-Commit Double-Entry Invariant**:
   - Total debits must equal total credits before issuing SQL `COMMIT`.
3. **Deferred Balance Trigger Compliance**:
   - Relies on the verified deferred trigger `trg_check_journal_balance` on `accounting_journal_line`.
4. **Source Idempotency**:
   - Uses `idx_accounting_voucher_source_idempotency` (`reference_type, reference_id, reference_event`) to guarantee no purchase, order, or expense can be posted twice.
5. **Period Lock Enforcement**:
   - Postings with `voucher_date` inside a period marked `is_locked = true` in `public.accounting_fiscal_period` must be rejected.
6. **Segregation of Duties**:
   - `accounting_voucher.approved_by` cannot equal `accounting_voucher.created_by`.

---

## 13. Unresolved Business Decisions for Management Review

The following items are documented for business confirmation prior to live posting:
1. **Cash Purchase Workflow Preference**:
   - Does management prefer spot cash purchases to route through Accounts Payable (`2111`) to preserve vendor volume reporting, or post directly from Cash in Hand (`1111`)?
   - *Architecture Recommendation*: Route through AP so supplier spend registers reflect 100% of vendor transactions regardless of payment mode.
2. **Packaging Inventory Policy**:
   - Should cake boxes and packaging be expensed immediately on purchase (`5130 Packaging Materials Consumed`), or tracked as periodic inventory (`1133 Packaging Supplies Stock`)?
   - *Architecture Recommendation*: Expense directly upon purchase for retail branches; track as inventory at central production hubs.
3. **Official Cut-Off Date**:
   - Finance management must specify the exact `accounting_start_date` (e.g. `2026-10-01 00:00:00 IST`) when historical orders lock and opening balances take effect.

---

## 14. Independent Design Verification Results

All 98 accounts and their architectural rules were tested against live PostgreSQL constraints using an offline design validation suite (`frontend/scratch/verify_coa_design.js`):
- **DDL Constraint Compliance**: 100% PASS
  - `chk_account_type`: Validated across all 98 accounts.
  - `chk_account_subtype`: Validated across all 98 accounts.
  - `chk_account_level`: Validated across all 98 accounts (Levels 1 to 4).
  - `uq_accounting_account_code`: Zero duplicate codes.
- **Hierarchy Integrity**: 100% PASS
  - Every child account has a valid parent.
  - Parent level is strictly `child.level - 1`.
  - All parents are group accounts (`is_group = true`).
  - No cross-type parenting (Assets under Assets, Liabilities under Liabilities).
- **Control & Clearing Accounts**: 100% PASS
  - `1111` Cash in Hand (`CASH`)
  - `1112` Bank Operating A/c (`BANK`)
  - `1113` Gateway Clearing (`GATEWAY_CLEARING`)
  - `1119` Unclassified Suspense (`CURRENT_ASSET`)
  - `1121` Accounts Receivable (`RECEIVABLE`)
  - `1122` Undeposited COD (`CURRENT_ASSET`)
  - `1131` Merchandise Inventory (`INVENTORY`)
  - `1141-1149` Input Tax Credits (`INPUT_TAX`)
  - `2111` Accounts Payable (`PAYABLE`)
  - `2121-2129` Output Tax Liabilities (`OUTPUT_TAX`)
  - `2141` Customer Advances (`CUSTOMER_ADVANCE`)
  - `3300` Opening Balance Offset (`OPENING_OFFSET`)

---

## 15. Zero-Data & Regression Verification

### 15.1. Database Zero-Mutation Verification
A verification script (`frontend/scratch/verify_phase4c_baseline.js`) executed against the live database confirms:

```json
{
  "accounting_account": 0,
  "accounting_voucher": 0,
  "accounting_journal_entry": 0,
  "accounting_journal_line": 0,
  "accounting_fiscal_period": 0,
  "order": 173,
  "payment_transaction": 53,
  "accounting_start_date_configured": 0
}
```

### 15.2. Application & Security Regression
1. **TypeScript Compilation**:
   - `npx tsc --noEmit` $\longrightarrow$ **0 errors (100% Clean)**
2. **Security Regression Suite**:
   - `node scratch/run_security_regression.js` $\longrightarrow$ **21/21 Tests Passed (100% Pass)**
3. **Application Source Code**:
   - No application source code was modified during this phase.

### 15.3. Git Status Check
- **Branch**: `task/dev`
- **Head**: `f7d9a47`
- **Commits**: 0 made
- **Pushes**: 0 made

---

## 16. Final State Declaration & Mandatory Gate Hold

> [!IMPORTANT]
> **PHASE 4C DESIGN: COMPLETE**
> - **CHART OF ACCOUNTS SEED**: NOT PERFORMED (0 rows in `public.accounting_account`)
> - **VOUCHERS**: 0 NEW (0 rows in `public.accounting_voucher`)
> - **JOURNAL ENTRIES**: 0 NEW (0 rows in `public.accounting_journal_entry`)
> - **HISTORICAL TRANSACTIONS**: UNTOUCHED (173 orders, 53 payment transactions unaltered)
> - **ACCOUNTING START DATE**: UNCONFIGURED
> - **POSTING ENGINE**: NOT IMPLEMENTED
> - **ITEM-WISE PURCHASE ACCOUNTING**: DESIGNED, NOT IMPLEMENTED
> - **PURCHASE RETURN ACCOUNTING**: DESIGNED, NOT IMPLEMENTED
>
> **EXECUTION STOPPED**. Awaiting explicit user authorization before proceeding to Chart of Accounts seeding.
