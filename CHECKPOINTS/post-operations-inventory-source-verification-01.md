# CHECKPOINT: Post-Operations Physical Accessory Inventory Architecture Verification

**Timestamp:** 2026-09-18 19:40:00 IST  
**Environment:** Next.js 14, PostgreSQL 17.6 (Supabase Pooler), Node.js  
**Branch:** `task/dev`  
**Execution Mode:** **READ-ONLY INVESTIGATION (NO APPLICATION CODE OR DATABASE SCHEMA MODIFIED)**  
**Status:** Architecture Investigation Complete & Documented.

---

## 1. Investigation Objective

Perform a strict, read-only architectural verification into how physical accessory inventory (toppers, candles, greeting cards, poppers) is currently modeled, stored, resolved, deducted, and reported across PostgreSQL, API endpoints, the storefront PDP/cart, and operational reports.

Specifically investigate why PostgreSQL table `branch_inventory` currently contains `0` remaining rows while tests and reports surface real accessory stock (such as 45 units for "Gold Acrylic Happy Birthday Topper").

---

## 2. PostgreSQL Direct Database Inspection Findings

Direct read-only inspection against PostgreSQL 17.6 revealed:

1. **`branch_inventory` Table**:
   - Total rows: **`0`**.
   - Schema: `(id, branch_id, product_id, variant_id, quantity, reserved, created_at, updated_at, deleted_at)`.
   - Historical context: Prior to Phase 2 cleanup, `branch_inventory` held 758 rows with `quantity = 50`. **All 758 rows were for made-to-order cakes/cupcakes** (`prod_01KXY...`). There were **never any accessory rows** in this table.

2. **`setting` Table**:
   - Total rows: `16` (general configs like `store_name`, `support_phone`, `currency`, `tax_rate_percent`, `fulfillment_config`, `occasions`).
   - Query for `group = 'catalog'` or `key ILIKE '%accessor%'`: **`0 rows found`**.
   - `set_catalog_accessories` has not been persisted to database.

3. **`product` Table**:
   - Total rows: `54` (all cakes, cupcakes, pastries, croissants, brownies).
   - Query for `id LIKE 'acc_%'` or `metadata->>'category_slug' LIKE '%acc%'`: **`0 rows found`**.
   - Accessories are not cataloged as entities in the PostgreSQL `product` table.

4. **`product_variant` Table**:
   - Query for `sku ILIKE '%acc%'` or `title ILIKE '%topper%'` / `candle`: **`0 rows found`**.

5. **`branch` Table Metadata**:
   - Query for `metadata->'accessory_inventory'`: **`0 branches have this metadata`**.

---

## 3. Architecture Findings & Lifecycle Trace

### A. Authoritative Inventory Source
- **Actual Runtime Source**: In-memory JavaScript array `DEFAULT_ACCESSORIES` in [`frontend/src/lib/api-engine.ts`](file:///e:/vig/cakes2home-main/cakes2home-main/frontend/src/lib/api-engine.ts) (lines 2401–2522) and `(globalThis).__CTH_MEMORY_STORE__.accessories`.
- **Database Persistence Intent**: [`frontend/src/lib/db-persistence.ts`](file:///e:/vig/cakes2home-main/cakes2home-main/frontend/src/lib/db-persistence.ts) (lines 620–631) has hydration code designed to hydrate `memoryStore.accessories` from PostgreSQL table `setting` (`group = 'catalog'`, `key = 'accessories'`). Because this database row has never been written, the system unconditionally falls back to `DEFAULT_ACCESSORIES`.

### B. Accessory Inventory Data Flow
1. **PIM / Catalog Definition**:
   - Accessories (`acc_01` to `acc_08`) are defined in `DEFAULT_ACCESSORIES` with static stock (e.g. `acc_01.stock = 45`).
   - Admin UI (`Admin / Catalog / Accessories`) reads and updates `memoryStore.accessories`. Mutations call `persistSettingToDb("catalog", "accessories", ...)` which targets table `setting`.
2. **Storefront PDP Presentation**:
   - PDP fetches addons via `GET /api/v1/accessories?productId=...` (served by `ApiEngine.listAccessories()`).
   - Addons are rendered as customization checkboxes (toppers, candles, greeting cards) inside [`pdp-customization-form.tsx`](file:///e:/vig/cakes2home-main/cakes2home-main/frontend/src/components/store/pdp/pdp-customization-form.tsx).
3. **Add to Cart**:
   - When a customer selects an addon and clicks "Add to Bag", [`product-detail-client.tsx`](file:///e:/vig/cakes2home-main/cakes2home-main/frontend/src/components/store/shop/product-detail-client.tsx) (lines 510–528) places the addon titles into the **cake line item's metadata** (`metadata.selected_addons = ["Gold Acrylic Happy Birthday Topper"]`) and rolls the addon price into the cake unit price.
   - The accessory is **not** added as an independent line item.
   - If an API client calls `POST /api/v1/cart/items` directly with `product_id: 'acc_01'`, `ApiEngine.addToCart()` checks `branch.accessory_inventory?.[acc_id] ?? 50`. Since branches lack this metadata, it falls back to hardcoded `50`.
4. **Order Checkout & Deduction**:
   - The customer checks out via `POST /api/v1/orders`.
   - In [`OrderService.createOrder()`](file:///e:/vig/cakes2home-main/cakes2home-main/frontend/src/lib/services/order.service.ts), the line item is the cake (`MADE_TO_ORDER_AVAILABILITY`).
   - The cake is checked against branch kitchen readiness and bypasses `deductStockAtomic`.
   - **Zero stock is deducted for the accessory addons.**
   - If an order is submitted with an accessory as a primary line item (`product_id: 'acc_01'`), `OrderService.createOrder` queries PostgreSQL `product` table via `ProductRepository.findByIds(['acc_01'])`. Because `acc_01` does not exist in `product`, the order is rejected with `Product acc_01 not found in catalog.`

### C. Branch Isolation
- **Status: NOT genuinely supported.**
- Accessories do not have branch-isolated records in PostgreSQL.
- `GET /api/v1/accessories` has no branch filter and serves the identical global in-memory catalog across all 39 branches.
- Branch A and Branch B both expose the identical stock quantity (e.g. 45 for Gold Topper).

### D. Reservation / Concurrency
- **Status: Unprotected for storefront addons.**
- Because accessory addons are bundled inside cake metadata without stock decrements, multiple customers can purchase the same accessory indefinitely without atomic database guards.
- Standalone deductions in `InventoryService.deductStockAtomic` target PostgreSQL table `branch_inventory`, but that table currently contains 0 rows.

### E. Report Consistency
- `GET /api/v1/admin/reports/inventory` calls `ApiEngine.getReportsInventory()`.
- It iterates over `ApiEngine.listAccessories()`, computing `cost_price * stock` on the 8 in-memory items:
  `42*45 + 18*80 + 25*120 + 120*30 + 35*150 + 90*60 + 40*85 + 300*40 = ₹36,250`.
- The report reflects the in-memory array `DEFAULT_ACCESSORIES`, **not** PostgreSQL table `branch_inventory`.

### F. Hardcoded Data Audit
The following hardcoded stock defaults exist in application code:
1. `frontend/src/lib/api-engine.ts` lines 2401–2522: `DEFAULT_ACCESSORIES` array with static stock values `[45, 80, 120, 30, 150, 60, 85, 40]`.
2. `frontend/src/lib/api-engine.ts` line 14939: `stock: Number(data.stock) ?? 50` in `createAccessory`.
3. `frontend/src/lib/api-engine.ts` line 17623: `defaultStock = 20` in `getBranchAccessoryStock`.
4. `frontend/src/lib/api-engine.ts` line 18468: `accStock = ... ?? 50` in `addToCart`.
5. `frontend/src/lib/api-engine.ts` line 22045: `current_stock: 50` in `updateBranchInventoryStock`.
6. `frontend/src/lib/data/branches.ts` line 36: `stock = ... ?? 25` in `retrieveBranchInventory`.

---

## 4. Concrete Identified Risks

1. **Orphaned Database Table (`branch_inventory`) vs In-Memory Catalog**:
   - `InventoryService` and `branch_inventory` form a complete, atomic stock management system with conditional updates (`UPDATE branch_inventory SET quantity = quantity - $1 WHERE (quantity - reserved) >= $1`).
   - However, no physical accessories have ever been seeded into `branch_inventory` or `product`.
2. **Missing `setting` Row for Catalog Accessories**:
   - `db-persistence.ts` expects `setting` (`group='catalog', key='accessories'`), but the table has no such row, making the application reliant on the compiled-in `DEFAULT_ACCESSORIES` array.
3. **No Stock Decrement on Storefront Addon Checkout**:
   - Addons attached to cakes (`metadata.selected_addons`) are never reconciled against inventory during order creation.
4. **Lack of Branch-Level Isolation**:
   - If Branch A runs out of Birthday Toppers, Branch A continues to accept topper addons because stock is not tracked per branch.

---

## 5. Architectural Recommendation

**DO NOT AUTOMATICALLY MODIFY CODE OR SCHEMA YET.**

To align the physical accessory inventory architecture with PostgreSQL without breaking existing functionality:
1. **Option 1 (Centralized Setting Authority - Simplest)**:
   - Seed the 8 accessories into PostgreSQL `setting` (`id: 'set_catalog_accessories', group: 'catalog', key: 'accessories'`) so that PostgreSQL is the true source of truth instead of `DEFAULT_ACCESSORIES`.
   - Update `OrderService.createOrder` to parse `item.customization.selected_addons` and decrement stock in `setting` / `memoryStore`.
   - *Limitation*: Does not provide true per-branch stock isolation.
2. **Option 2 (Relational `branch_inventory` Authority - Enterprise Model)**:
   - Catalog the 8 physical accessories as `product` rows (`metadata.category_slug = 'accessories'`, `inventory_mode = 'STOCK_CONTROLLED'`).
   - Seed initial physical inventory rows in `branch_inventory` for each operational branch (`branch_id`, `product_id`, `quantity`, `reserved: 0`).
   - Update `OrderService.createOrder` to split addons into distinct order item lines or invoke `InventoryService.deductStockAtomic` for each addon SKU.
   - Update `getReportsInventory` to query `SELECT SUM(quantity * cost) FROM branch_inventory`.
   - *Advantage*: Full branch isolation, atomic database-level concurrency protection, zero hardcoded numbers.

---

## 6. Verification Status

- **Files modified during this verification:** `0` (Zero application code modified).
- **Database tables modified during this verification:** `0` (Zero database records modified).
- **Transient scratch scripts used:** `scratch/inspect_setting_schema.js`, `scratch/read_only_inventory_inspection.js`, `scratch/deep_acc_search.js`.
