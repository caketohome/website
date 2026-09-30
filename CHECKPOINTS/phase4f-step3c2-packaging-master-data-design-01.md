# Phase 4F Step 3C.2 — Packaging Master-Data & Quantity-Controlled Inventory Design

**Checkpoint Identifier**: `CHECKPOINTS/phase4f-step3c2-packaging-master-data-design-01.md`
**Execution Timestamp**: 2026-09-24 16:35:00 IST
**Git Branch**: `task/dev`
**Head Commit**: `f7d9a47` (no new commits)
**Status**: **PASS — MINIMUM MASTER-DATA EXTENSION REQUIRED + BUSINESS MASTER DATA NOT YET CONFIGURED**

---

## 1. Executive Summary

Comprehensive forensic inspection of the PostgreSQL schema confirms that the **technical model is ready** to support packaging as quantity-controlled inventory. The `product` table already includes `merchandise_type` with `'PACKAGING'` in its CHECK constraint. All downstream tables (`branch_inventory`, `inventory_cost_lot`, `inventory_movement`, `inventory_cost_consumption`, `purchase_item`) are architecturally compatible with PACKAGING items — no new inventory tables are required.

However, **zero packaging products exist** in the database. All required business master data — packaging product identities, SKUs, UQC, HSN codes, tax classifications, and variant specifications — must be configured by the business before packaging can enter the unified inventory path.

One **minimum schema extension is required**: `branch_inventory` currently lacks a foreign key from `product_id` to `product`, and its unique index is `(branch_id, variant_id)` — packaging will need a `product_id` reference to be properly joined. This is **not a blocker** for the design; it is a migration item.

---

## 2. Live Database Forensic Findings

### A. `public.product` — Catalog Master

| Attribute | Value |
|---|---|
| Total products | 65 |
| Active (non-deleted) | 20 |
| Soft-deleted | 45 |
| CAKE | 57 |
| ACCESSORY | 8 |
| **PACKAGING** | **0** |
| SKU column | **Does not exist** on product (SKU is in `metadata.sku` or `product_variant.sku`) |
| `hs_code` column | Exists (all NULL for existing products) |
| `merchandise_type` CHECK | `('CAKE', 'ACCESSORY', 'PACKAGING')` ✅ |
| `status` CHECK | `('draft', 'proposed', 'published', 'rejected')` |
| Soft-delete | `deleted_at` NULLABLE timestamp |

**Critical metadata keys found in `product.metadata`:**
- `sku`, `uqc`, `hsn_code`, `gst_rate`, `tax_class`, `taxability`, `cost_price`, `selling_price`, `mrp`
- `pim_config.inventory_mode` (e.g. `"STOCK_CONTROLLED"`)
- `low_stock_threshold`

> [!IMPORTANT]
> HSN, UQC, GST rate, and tax class are currently stored **only in `product.metadata` JSON**, not in structured columns. For Cakes: `hsn_code = "19059090"`, `uqc = "NOS"`, `gst_rate = 5`. For Accessories: `hsn_code = "95059000"`, `uqc = "NOS"`, `gst_rate = 18`.

### B. `public.product_variant`

| Attribute | Value |
|---|---|
| Total variants | 27 |
| Soft-deleted | 0 |
| Active products with variants | 16 |
| Active products WITHOUT variants | 4 |
| `product_id` | NULLABLE (FK to product, CASCADE DELETE) |
| `sku` column | Exists, NULLABLE, UNIQUE WHERE deleted_at IS NULL |
| `manage_inventory` | boolean NOT NULL DEFAULT true |
| `weight` column | real NULLABLE |
| `weight_unit` column | **Does not exist** |

**Variant distribution by merchandise_type:**
- ACCESSORY: 2 products → 2 variants (1:1)
- CAKE: 14 products → 14 variants (1:1)

> [!NOTE]
> 4 active products have no active variants. All current products use a 1:1 product→variant model (one "Default" variant per product).

### C. `public.product_category` + Junction

| Attribute | Value |
|---|---|
| Total categories | 11 |
| Junction table | `product_category_product` exists |
| Category on product | No `category_id` column on `product` — relationship is junction-based |
| Categories are descriptive | No category enforces merchandise_type |

Categories include: Accessories, Chocolate Cakes, Black Forest, Butterscotch, etc. No "Packaging" category exists.

### D. `public.branch_inventory`

| Attribute | Value |
|---|---|
| Total rows | **424** |
| NULL product_id rows | **0** |
| NULL variant_id rows | **0** |
| `product_id` | NOT NULL |
| `variant_id` | NOT NULL |
| `quantity` | integer NOT NULL DEFAULT 0 |
| `reserved` | integer NOT NULL DEFAULT 0 |
| Negative quantity rows | **0** |
| Unique index | `(branch_id, variant_id) WHERE deleted_at IS NULL` |

**All 424 rows are ACCESSORY stock** (8 accessories × 53 branches). Zero cake rows exist in branch_inventory.

**Foreign keys:**
- `branch_id → branch(id)` CASCADE DELETE
- **No FK from `product_id` to `product`**
- **No FK from `variant_id` to `product_variant`**

> [!WARNING]
> `branch_inventory.product_id` and `variant_id` are NOT NULL but have **no foreign key constraints**. The unique index ensures `(branch_id, variant_id)` uniqueness but does not validate referential integrity at the database level.

### E. `public.inventory_movement`

| Attribute | Value |
|---|---|
| Total rows | 0 |
| `product_id` | **NULLABLE** |
| `variant_id` | **NULLABLE** |
| Movement types | `PURCHASE_RECEIPT`, `SALES_FULFILLMENT`, `PURCHASE_RETURN`, `SALES_RETURN`, `STOCK_ADJUSTMENT_UP`, `STOCK_ADJUSTMENT_DOWN`, `TRANSFER_IN`, `TRANSFER_OUT`, `DAMAGE_WRITEOFF`, `INVOICE_REVERSAL` |

### F. `public.inventory_cost_lot`

| Attribute | Value |
|---|---|
| Total rows | 0 |
| `product_id` | **NULLABLE** |
| `variant_id` | **NULLABLE** |
| `item_type` CHECK | `('CAKE', 'ACCESSORY', 'PACKAGING')` ✅ |
| FIFO index | `(branch_id, product_id, variant_id, received_at, created_at)` WHERE ACTIVE & remaining > 0 |
| Cost consistency | `ABS(total_cost - ROUND(received_quantity * unit_cost, 2)) <= 0.05` |

### G. `public.inventory_cost_consumption`

| Attribute | Value |
|---|---|
| Total rows | 0 |
| FK to movement | `movement_id → inventory_movement(id)` |
| FK to lot | `lot_id → inventory_cost_lot(id)` |
| Math check | `ABS(total_cost - ROUND(quantity * unit_cost, 2)) <= 0.05` |

### H. `public.purchase_item`

| Attribute | Value |
|---|---|
| Total rows | 0 |
| `product_id` | NULLABLE |
| `variant_id` | NULLABLE |
| `item_type` CHECK | `('CAKE', 'ACCESSORY', 'PACKAGING')` ✅ |
| Tax columns | `hsn_code`, `cgst_rate`, `sgst_rate`, `igst_rate`, `cgst`, `sgst`, `igst` |

### I. Accounting Accounts

| Code | Name | Type/Subtype |
|---|---|---|
| 1130 | Inventories | ASSET/CURRENT_ASSET (group) |
| 1131 | Merchandise Inventory - Accessories | ASSET/INVENTORY |
| 1132 | Merchandise Inventory - Cakes | ASSET/INVENTORY |
| **1133** | **Packaging Supplies Stock** | **ASSET/INVENTORY** ✅ |
| 1141-1144 | Input CGST/SGST 2.5%/9.0% | ASSET/INPUT_TAX |
| 2111 | Accounts Payable | LIABILITY/PAYABLE |
| 5110 | COGS - Cakes | EXPENSE/COGS |
| 5120 | Accessory Merchandise Sold | EXPENSE/COGS |
| **5130** | **Packaging Materials Consumed** | **EXPENSE/COGS** ✅ |

Total accounts: **98**. Packaging has both inventory (1133) and COGS (5130) accounts ready.

### J. Branches

Total: **57 branches** (including test/e2e branches)

### K. UQC/UOM

- **No dedicated UQC/UOM master table exists**
- UQC is stored only in `product.metadata.uqc` (all existing = `"NOS"`)
- `product_variant.weight_unit` column does **not exist**
- `product_variant.weight` exists (real, nullable) — 8 variants have weight set

### L. HSN/Tax

- **No dedicated HSN master table exists**
- HSN is stored in `product.metadata.hsn_code` and `purchase_item.hsn_code`
- GST rate is in `product.metadata.gst_rate`
- Tax class is in `product.metadata.tax_class`
- Purchase-item-level tax: `cgst_rate`, `sgst_rate`, `igst_rate`, `cgst`, `sgst`, `igst`

---

## 3. Packaging Business-Master Gap Analysis

### Required for packaging to enter quantity-controlled inventory:

| Requirement | Current State | Status |
|---|---|---|
| Product identity (product row) | 0 PACKAGING products exist | ❌ UNCONFIGURED |
| Product title | N/A | ❌ UNCONFIGURED |
| merchandise_type = PACKAGING | CHECK constraint supports it | ✅ READY |
| SKU/code | Would go in `product_variant.sku` | ✅ STRUCTURE READY |
| UQC | In `metadata.uqc` only — no structured column | ⚠️ METADATA-ONLY |
| HSN | In `metadata.hsn_code` only — no structured column | ⚠️ METADATA-ONLY |
| Tax classification | In `metadata.gst_rate` + `metadata.tax_class` | ⚠️ METADATA-ONLY |
| Product variant | Required (branch_inventory needs variant_id) | ❌ UNCONFIGURED |
| Purchase UOM | No UOM column on purchase_item; `quantity` is untyped numeric | ⚠️ IMPLICIT NOS |
| Inventory UOM | No UOM column on branch_inventory; `quantity` is untyped integer | ⚠️ IMPLICIT NOS |
| Conversion factor | Not supported | ❌ NOT SUPPORTED |
| Branch ownership | Via `branch_inventory.branch_id` | ✅ READY |
| Active/inactive status | `product.status` ('draft'/'published') | ✅ READY |
| Soft deletion | `product.deleted_at` | ✅ READY |
| Supplier compatibility | `purchase_item.product_id` FK to product | ✅ READY |
| Cost-layer compatibility | `inventory_cost_lot.item_type` includes PACKAGING | ✅ READY |
| Stock movement compatibility | `inventory_movement` movement_type=PURCHASE_RECEIPT | ✅ READY |
| Reporting compatibility | Joins via product_id/variant_id | ✅ READY |

---

## 4. UOM / Quantity Model

### Current state:
- **No UOM column exists** on `product`, `product_variant`, `purchase_item`, `branch_inventory`, `inventory_movement`, or `inventory_cost_lot`
- All quantities are implicitly **NOS** (numbers/pieces)
- `product.metadata.uqc` = `"NOS"` for all existing products
- `product_variant.weight` is available but represents physical weight, not purchase/stock UOM
- **No conversion factor** between purchase quantity and stock quantity is supported

### Design decision:
- Packaging items like "1kg Cake Box" or "500g Cake Box" are discrete units — purchased in NOS and stocked in NOS
- Items like "Ribbon (per meter)" or "Frosting (per kg)" would require UOM conversion — **this is NOT supported today**
- For Phase 4F, packaging should use NOS as both purchase and inventory UOM
- UOM conversion (e.g., BOX → NOS) is a **future requirement** and should not be fabricated now

> [!IMPORTANT]
> If packaging is ever purchased in BOX (e.g., "1 BOX = 100 NOS"), the system currently has no way to perform this conversion. A future `purchase_uom`, `stock_uom`, and `conversion_factor` model would be required. **Do not implement this now.**

---

## 5. Branch Inventory Model

### How stock is identified:
- Primary key: `id` (text)
- Unique constraint: `(branch_id, variant_id) WHERE deleted_at IS NULL`
- `product_id`: NOT NULL (no FK to product)
- `variant_id`: NOT NULL (no FK to product_variant)

### How stock is created/incremented:
- `INSERT ... ON CONFLICT (branch_id, variant_id) WHERE deleted_at IS NULL DO UPDATE SET quantity = branch_inventory.quantity + EXCLUDED.quantity`
- This is the canonical UPSERT pattern in both `InventoryService.seedBranchInventory` and `PurchasePostingService.postPurchase`

### How stock is decremented:
- Direct UPDATE `SET quantity = quantity - $3` in `InventoryService.deductStock`
- Negative stock check is enforced **in application code**, not via DB CHECK constraint

### Can packaging enter this path?
**YES** — if a packaging product with a valid `product_id` and `variant_id` exists:
1. `PurchasePostingService` already checks: if `catalogItem.productId !== null` → UPSERT into `branch_inventory`
2. The unique index `(branch_id, variant_id)` will work for packaging variants
3. No special inventory code is needed

### Missing FK enforcement:
- `branch_inventory.product_id` has **no FK** to `product`
- `branch_inventory.variant_id` has **no FK** to `product_variant`
- This is a **referential integrity gap** — any text value could theoretically be inserted

---

## 6. Cost-Lot Compatibility

PACKAGING items can participate in the **exact same cost-layer architecture** as CAKE and ACCESSORY:

- `inventory_cost_lot.item_type` CHECK includes `'PACKAGING'`
- `product_id` and `variant_id` are NULLABLE — packaging with catalog IDs will use them; without IDs, they remain NULL (already demonstrated in Step 3C.1 simulation)
- FIFO index includes `(branch_id, product_id, variant_id, received_at, created_at)` — works for packaging
- Cost consistency check applies equally
- `UNIQUE(purchase_item_id)` prevents duplicate lots

**No new cost table needed. No modifications needed.**

---

## 7. Inventory Movement Compatibility

PACKAGING can use the existing `PURCHASE_RECEIPT` movement type without modification:

| Movement Type | Applicable to Packaging? |
|---|---|
| `PURCHASE_RECEIPT` | ✅ Primary inbound |
| `SALES_FULFILLMENT` | ✅ When packaging is consumed per order |
| `PURCHASE_RETURN` | ✅ Return damaged packaging to supplier |
| `STOCK_ADJUSTMENT_UP` | ✅ Physical count correction |
| `STOCK_ADJUSTMENT_DOWN` | ✅ Damage/wastage |
| `DAMAGE_WRITEOFF` | ✅ Write off unusable packaging |
| `TRANSFER_IN` / `TRANSFER_OUT` | ✅ Inter-branch transfer |
| `INVOICE_REVERSAL` | ✅ Reverse posted purchase |

**No new movement types needed.**

---

## 8. Accounting Alignment

The posting architecture already distinguishes merchandise types:

| merchandise_type | Inventory Asset Account | COGS Account |
|---|---|---|
| CAKE | 1132 | 5110 |
| ACCESSORY | 1131 | 5120 |
| **PACKAGING** | **1133** | **5130** |

`PurchasePostingService` dynamically resolves the GL account by `item_type`:
- `item_type === 'PACKAGING'` → DR 1133 (Packaging Supplies Stock)

**No CoA changes needed. No new accounting mapping needed.**

---

## 9. Proposed Target Architecture

```
PACKAGING PRODUCT (public.product, merchandise_type = 'PACKAGING')
    │
    ├── public.product_variant (SKU, weight, manage_inventory = true)
    │
    ├── public.branch_inventory (branch_id + variant_id = physical qty)
    │
    ├── public.inventory_cost_lot (purchase cost layer, item_type = 'PACKAGING')
    │
    ├── public.inventory_movement (PURCHASE_RECEIPT, direction = 'IN')
    │
    └── public.inventory_cost_consumption (FIFO allocation on outbound)
```

**No second packaging inventory table.**
**No fake product IDs.**
**No NULL product/variant in branch_inventory.**

---

## 10. Schema Migration Required?

### Minimum required migration (DO NOT EXECUTE NOW):

1. **Add FK `branch_inventory.variant_id → product_variant(id)`** — currently missing referential integrity
2. **Add FK `branch_inventory.product_id → product(id)`** — currently missing referential integrity
3. **(Optional but recommended)** Add CHECK constraint on `branch_inventory.quantity >= 0` to prevent negative stock at DB level

### NOT required:
- No new tables
- No new columns on product/product_variant
- No new movement types
- No CoA changes
- No changes to `merchandise_type` constraint (PACKAGING already included)

---

## 11. Packaging Master Data Creation Workflow Design

When a legitimate packaging product is created, the workflow should cover:

| Step | Requirement | Notes |
|---|---|---|
| 1 | Authorized actor | SUPER_ADMIN or user with future `CATALOG.CREATE` permission |
| 2 | `product.title` | e.g. "1 Kg Cake Box" — **business must provide** |
| 3 | `product.handle` | Auto-generated from title |
| 4 | `product.merchandise_type` | `'PACKAGING'` |
| 5 | `product.status` | `'draft'` → `'published'` |
| 6 | `product.metadata.sku` | e.g. "PKG-BOX-1KG" — **business must provide** |
| 7 | `product.metadata.uqc` | e.g. "NOS" — **business must provide** |
| 8 | `product.metadata.hsn_code` | e.g. "48191000" — **business must provide** |
| 9 | `product.metadata.gst_rate` | e.g. 18 — **business must provide** |
| 10 | `product.metadata.tax_class` | e.g. "GST_STANDARD_18" — **business must provide** |
| 11 | `product_variant.id` | System-generated |
| 12 | `product_variant.title` | "Default" or spec (e.g. "1 Kg") |
| 13 | `product_variant.sku` | e.g. "PKG-BOX-1KG" (unique) |
| 14 | `product_variant.manage_inventory` | `true` |
| 15 | Branch availability | Seed `branch_inventory` rows for target branches |
| 16 | Supplier compatibility | Link via `purchase_item.product_id` |
| 17 | Audit trail | `product.created_at`, `created_by` (currently no `created_by` on product) |

> [!CAUTION]
> `product` table has **no `created_by` column**. Audit trail for product creation would rely on application-level logging or a future migration to add `created_by`.

---

## 12. Security / Authorization

### Current permission structure:

| Permission | Module | Exists? |
|---|---|---|
| `INVENTORY.VIEW` | INVENTORY | ✅ |
| `INVENTORY.EDIT` | INVENTORY | ✅ |
| `PURCHASE.VIEW` | PURCHASE | ✅ |
| `PURCHASE.CREATE` | PURCHASE | ✅ |
| `PURCHASE.EDIT` | PURCHASE | ✅ |
| `PURCHASE.APPROVE` | PURCHASE | ✅ |
| `PURCHASE.DELETE` | PURCHASE | ✅ |
| `PURCHASE.EXPORT` | PURCHASE | ✅ |
| `CATALOG.CREATE` | — | ❌ DOES NOT EXIST |
| `CATALOG.EDIT` | — | ❌ DOES NOT EXIST |
| `MASTER_DATA.MANAGE` | — | ❌ DOES NOT EXIST |

> [!WARNING]
> No permission currently controls **product master data creation or editing**. The `createProduct` server action in `shops.ts` has no RBAC guard. This is a **future requirement** — do not add permissions in this step.

---

## 13. Reporting Impact

When packaging products exist, they should appear in:

| Report | Expected Behavior |
|---|---|
| Stock Ledger | Packaging items listed with branch-level quantities |
| Stock Movement | All PURCHASE_RECEIPT/SALES_FULFILLMENT/ADJUSTMENT entries |
| Branch Stock | Packaging variants alongside accessories and cakes |
| Purchase Register | Purchase items with `item_type = 'PACKAGING'` |
| Item-wise Purchase | Grouped by packaging product/variant |
| Supplier-wise Purchase | Packaging purchases attributed to supplier |
| Inventory Valuation | Sum of `inventory_cost_lot.remaining_quantity * unit_cost` where item_type = 'PACKAGING' |
| Low Stock | `branch_inventory.quantity < metadata.low_stock_threshold` |
| Negative Stock | `branch_inventory.quantity < 0` (should never occur) |
| COGS/Consumption | DR 5130 (Packaging Materials Consumed) on fulfillment |

**No new reports needed. Existing report queries should naturally include PACKAGING** via standard `product`/`product_variant` joins.

---

## 14. Independent Verification — Baseline Counts

| Table | Count | Expected |
|---|---|---|
| product (total) | 65 | ✅ |
| product (CAKE) | 57 | ✅ |
| product (ACCESSORY) | 8 | ✅ |
| product (PACKAGING) | **0** | ✅ |
| product_variant | 27 | ✅ |
| branch_inventory | 424 | ✅ |
| branch_inventory (NULL product) | 0 | ✅ |
| inventory_cost_lot | 0 | ✅ |
| inventory_movement | 0 | ✅ |
| inventory_cost_consumption | 0 | ✅ |
| accounting_account | 98 | ✅ |
| accounting_voucher | 0 | ✅ |
| accounting_journal_entry | 0 | ✅ |
| accounting_fiscal_period | 0 | ✅ |
| purchase | 0 | ✅ |
| purchase_item | 0 | ✅ |
| order | 173 | ✅ |
| payment_transaction | 53 | ✅ |
| accounting_start_date | UNCONFIGURED (0 rows) | ✅ |

**All baseline counts match Step 3C.1 frozen state. No mutations occurred.**

---

## 15. Design Decision

### **PASS — MINIMUM MASTER-DATA EXTENSION REQUIRED**

The technical model distinguishes two clearly separable layers:

**Layer 1: TECHNICAL MODEL — READY ✅**
- `product.merchandise_type` CHECK already includes `'PACKAGING'`
- `inventory_cost_lot.item_type` CHECK already includes `'PACKAGING'`
- `purchase_item.item_type` CHECK already includes `'PACKAGING'`
- `inventory_movement` movement types are compatible
- `branch_inventory` can accept packaging product/variant rows
- Accounting accounts 1133 (asset) and 5130 (COGS) are configured
- `PurchasePostingService` already handles PACKAGING in its posting logic
- No new tables, no new movement types, no new accounting accounts needed

**Layer 2: BUSINESS MASTER DATA — NOT YET CONFIGURED ❌**
- 0 packaging products exist
- Packaging product titles: **UNCONFIGURED**
- Packaging SKUs: **UNCONFIGURED**
- Packaging UQC: **UNCONFIGURED** (expected NOS)
- Packaging HSN codes: **UNCONFIGURED** (expected 48191000 for carton boxes, varies by item)
- Packaging GST rates: **UNCONFIGURED** (expected 12% or 18% depending on item)
- Packaging variant specifications: **UNCONFIGURED**
- No `CATALOG.CREATE` permission exists

**Layer 3: MINIMUM SCHEMA HARDENING — RECOMMENDED ⚠️**
- Add FK `branch_inventory.product_id → product(id)`
- Add FK `branch_inventory.variant_id → product_variant(id)`
- Add CHECK `branch_inventory.quantity >= 0`
- Add `product.created_by` for audit trail (optional)

---

## 16. What Should NOT Be Done

- ❌ Do not fabricate packaging product IDs
- ❌ Do not invent packaging SKUs, HSN codes, or UQC values
- ❌ Do not create packaging rows in `branch_inventory` without a real catalog product
- ❌ Do not create a second physical inventory table for packaging
- ❌ Do not modify existing CAKE/ACCESSORY products
- ❌ Do not silently convert existing products to PACKAGING
- ❌ Do not implement UOM conversion
- ❌ Do not change the CoA
- ❌ Do not create accounting vouchers/journals/fiscal periods

---

## 17. Git, TypeScript, and Security State

| Check | Result |
|---|---|
| Git commits | 0 new commits |
| Git pushes | 0 |
| Live DB mutations | 0 |
| TypeScript | 0 errors (PASS) |
| Security suite | 21/21 tests PASS |

---

## 18. Final Gate Result

**PHASE 4F STEP 3C.2: PASS ✅**

**Decision: PASS — MINIMUM MASTER-DATA EXTENSION REQUIRED + BUSINESS MASTER DATA NOT YET CONFIGURED**

- Technical infrastructure is ready
- Zero schema changes were made in this step
- Zero data mutations occurred
- Business must provide packaging item definitions before implementation can proceed
- Minimum FK hardening on `branch_inventory` is recommended before first packaging product creation
