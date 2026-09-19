# CakeToHome — Business & Operations Audit
**Inventory + Branch Availability + Sales Reporting**
**Checkpoint Reference:** `CHECKPOINTS/business-operations-audit-01.md`  
**Timestamp:** 2026-09-18 16:15:00 IST  
**Environment:** Next.js 14, PostgreSQL 17.6 (Supabase Pooler), Node.js  
**Commit Baseline:** `308162125fd72ef30c31176ac3312b9e15ff55a2` (Branch: `task/dev`)

---

## 1. Executive Summary & Recovery Baseline

### 1.1 Recovery & Baseline Integrity
- **Non-Destructive Guarantee**: Verified that no resets or destructive Git operations (`git reset --hard`, `git restore .`, `git checkout -- .`, `git clean -fd`) were performed. All previous verified milestones (Catalog-PIM-DB-API-Cart integrity and Orders API Convergence & Lifecycle Persistence) are 100% intact.
- **Database Authority**: PostgreSQL 17.6 (Supabase Pooler) is verified as the single source of truth across all 275 public tables.

### 1.2 ERP Scope Removal Confirmation (Strict Compliance)
Per explicit instructions, generic ERP and heavy accounting modules **do not belong** in the CakeToHome business scope:
- **Zero GRN / GNR**: No Goods Received Notes tables, endpoints, or workflows exist or will be created.
- **Zero Parties / Party Ledgers**: No supplier/customer party debit/credit ledger systems exist or will be created.
- **Zero Credit / Debit Accounts**: No general ledger, chart of accounts, or balance sheet modules exist or will be created.
- **Zero B2B / BTB Billing**: No B2B wholesale portals or custom credit terms. In the existing repository, the term "B2B" only exists as a GST statutory invoice flag (`customerGstin !== "URP" ? "B2B" : "B2C"`) for tax reporting (`EXISTING LEGACY / EXISTING FEATURE`).
- **Zero Teller Settlement**: No POS cashier drawer reconciliation or teller cash-up exists or will be created.

---

## 2. Actual CakeToHome Inventory & Availability Architecture

CakeToHome operates on **two fundamentally distinct product models**. Mixing these models was the root architectural flaw identified in the previous code.

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    CAKETOHOME PRODUCT ARCHITECTURE                          │
├──────────────────────────────────────┬──────────────────────────────────────┤
│  MODEL A: STOCK-CONTROLLED PRODUCTS  │    MODEL B: CAKES & MADE-TO-ORDER    │
├──────────────────────────────────────┼──────────────────────────────────────┤
│ Examples:                            │ Examples:                            │
│ - Birthday Toppers (Gold Acrylic)    │ - Truffle Cakes, Red Velvet, Cheese- │
│ - Relighting Magic Candles           │   cakes, Custom Designer Cakes       │
│ - Greeting Cards, Confetti Poppers   │ - Fresh Pastries, Brownies, Cupcakes │
│ - Gift Packaging, Balloons           │                                      │
├──────────────────────────────────────┼──────────────────────────────────────┤
│ Availability Logic:                  │ Availability Logic:                  │
│   Physical Count tracking            │   Branch Capability (Kitchen State)  │
│   Quantity-based (Current Stock)     │   State: AVAILABLE vs UNAVAILABLE    │
│   Reserved Stock (Active Orders)     │   Kitchen Can Fulfil: YES vs NO      │
│   Net Available = (Qty - Reserved)   │   Express Available vs Scheduled     │
├──────────────────────────────────────┼──────────────────────────────────────┤
│ Order Interaction:                   │ Order Interaction:                   │
│   Atomic inventory deduction         │   Validate branch fulfillment state  │
│   Prevents overselling when stock=0  │   NO arbitrary stock deduction!      │
│   Triggers reorder/low stock alerts  │   Prevents order if branch paused    │
└──────────────────────────────────────┴──────────────────────────────────────┘
```

---

## 3. Deep Architectural Audit by Layer

### 3.1 Database Audit (PostgreSQL 17.6)
1. **Existing Tables**:
   - `branch`: Stores physical hubs. Metadata contains `product_availability`, `capacity_settings`, `deliverable_areas`, `fulfillment_rules`.
   - `branch_inventory`: Exists with 758 rows. Schema: `(id, branch_id, product_id, variant_id, quantity, reserved, created_at, updated_at, deleted_at)`.
   - `product` & `product_variant`: Stores 54 products and variants. Metadata holds `category`, `category_slug`, `pim_config`, `weight_prices`.
   - `order`: Stores 140+ orders. Metadata holds `items`, `branch_id`, `total_amount`, `subtotal`, `delivery`.
2. **Current Defect / Contamination**:
   - Every branch currently has 14 rows in `branch_inventory` with `quantity = 50` for *cakes* (e.g., `prod_01KXYMAJKNH99E1TMWYGQGT61D`, `prod_1`, `prod_2`), totaling 700 synthetic stock units per branch.
   - This was caused by an auto-provisioning fallback in `InventoryService.deductStockAtomic` which treated all ordered items as physical stock.
3. **Database Capability**:
   - The database schema **already supports both models without structural migration**:
     - Model A (Stock-controlled accessories) uses `branch_inventory` (`quantity`, `reserved`, `branch_id`).
     - Model B (Cakes) uses `branch.metadata->'product_availability'` (states: `available`, `unavailable`, `express_available`, `temporarily_hidden`) and `branch.metadata->'cake_fulfilment'` (`can_fulfil: boolean, reason: string`).

### 3.2 PIM Audit & Product Classification
1. **PIM Configuration**:
   - Inspecting `frontend/src/components/dashboard/admin/pim-editor-modal.tsx`:
     - PIM Tab 7 ("Logistics & Preparation") configures `minPrepHours`, `dailyCapacity`, and reusable delivery profiles (`prof_regular`, `prof_designer`, `prof_wedding`).
     - PIM Tab 9 ("PIM Config") configures display flags: `show_weight`, `required_weight`, `show_flavour`, `show_shape`, etc.
     - PIM does **NOT** expose physical stock quantity inputs for cakes, confirming the domain model treats cakes as made-to-order.
2. **Authoritative Classification**:
   - A product is classified as **`STOCK_CONTROLLED`** if:
     - Its category or slug is `accessories`, `cake-accessories`, `greeting-cards`, or
     - It exists in `DEFAULT_ACCESSORIES` / accessory master catalog, or
     - Its `pim_config.inventory_mode === "STOCK_CONTROLLED"`.
   - A product is classified as **`MADE_TO_ORDER_AVAILABILITY`** if:
     - Its category is `cakes`, `pastries`, `cupcakes`, `specialty-cakes`, or
     - `pim_config.inventory_mode === "MADE_TO_ORDER_AVAILABILITY"`, or
     - It has weight/variant options or preparation logistics profiles.
   - **Crucial Rule**: Classification is derived strictly from DB/PIM metadata — never from frontend UI string matching (`name.includes("cake")` is forbidden).

### 3.3 Product Detail Page (PDP) Audit
1. **Defect Identified**:
   - In `frontend/src/components/store/shop/product-detail-client.tsx`:
     - Line 380: `const stockData = await retrieveBranchInventory(branchId, variantId); setBranchStock(stockData.available ?? 15);`
     - Line 729: passes `branchStock` into `PdpPurchaseActions`.
   - In `frontend/src/components/store/pdp/pdp-purchase-actions.tsx`:
     - Lines 80–86: renders `{branchStock > 0 ? \`● In Stock (${branchStock} available)\` : "● Out of Stock"}`.
   - For a gourmet cake, the customer sees **"● In Stock (15 available)"**! This violates CakeToHome's freshly baked made-to-order model.
2. **Correct Behavior**:
   - For cakes: Display branch availability status (e.g., `● Freshly Baked on Order • Available for Delivery` or `● Currently Unavailable at this Kitchen`).
   - For accessories: Display physical quantity stock (`● In Stock (12 units available)` or `● Low Stock: 3 left` or `● Out of Stock`).

### 3.4 Cart & Add-to-Cart Validation Audit
1. **Defect Identified**:
   - In `frontend/src/lib/api-engine.ts` (`addToCart`):
     - Checks `branch.product_availability?.[targetProdId]` for negative statuses (`OUT_OF_STOCK`, `UNAVAILABLE`), but:
     - Does not enforce `requested_quantity <= available_stock` for stock-controlled items.
     - Does not check `branch.cake_fulfilment?.[targetProdId]?.can_fulfil === false` for cakes.
2. **Correct Behavior**:
   - Model A (Stock): Validate `requested_quantity <= available_stock`. Block add-to-cart if stock is insufficient.
   - Model B (Cake): Validate `branch.product_availability` !== `unavailable` / `temporarily_hidden` AND `branch.cake_fulfilment.can_fulfil !== false`.

### 3.5 Order Lifecycle & Inventory Interaction Audit
1. **Defect Identified**:
   - In `frontend/src/lib/services/order.service.ts` (`createOrder`):
     - Lines 276–284: Loops through `snapshottedItems` and calls `InventoryService.deductStockAtomic` **unconditionally for every item**.
     - For cakes, this decrements artificial quantities in `branch_inventory`! If no row exists, it auto-provisions 50 units and decrements to 49.
2. **Correct Behavior**:
   - In `OrderService.createOrder`:
     - For `STOCK_CONTROLLED` items: Execute `InventoryService.deductStockAtomic(client, branch.id, item.product_id, item.quantity)`.
     - For `MADE_TO_ORDER_AVAILABILITY` items: Validate that the product is available at the branch (`branch.product_availability` and `cake_fulfilment`), with **zero synthetic stock deduction**.

### 3.6 Branch Operations Management Audit
1. **Admin / Branch UI**:
   - Inspecting `frontend/src/components/dashboard/admin/branch-product-availability-modal.tsx`:
     - Correctly manages `product_availability` (states: `available`, `express_available`, `scheduled_only`, `temporarily_hidden`, `unavailable`) and `cake_fulfilment` (`can_fulfil: true/false`).
     - Contains explicit developer comment: *"CakeToHome does not track flour/sugar quantities. We manage Can Fulfil (YES/NO) flags and branch availability states"*.
   - Inspecting `frontend/src/components/dashboard/admin/branch-accessory-inventory-modal.tsx`:
     - Correctly manages physical accessory stock (`current_stock`, `reserved_stock`, `available_stock`, `low_stock_threshold`, stock transfers).
2. **Finding**:
   - The Admin Modals already maintain the conceptual distinction! The defect was that the backend services (`OrderService`, `InventoryService`, PDP) were mixing them up.

### 3.7 Sales & Operational Reporting Audit
1. **Sales Report (`/admin/reports/sales`)**:
   - Aggregates from orders: gross sales, discounts, net sales, category split.
   - Defect in `ApiEngine.getReportsSales`: currently reads from `memoryStore.orders` rather than querying PostgreSQL directly when PostgreSQL is active.
2. **Item-Wise Sales Report**:
   - `ReportsEngineData.getProductPerformance` parses order items to determine:
     - Which products sold, quantity sold, gross sales, discounts, net sales, tax collected.
   - Needs to be backed by direct PostgreSQL aggregation so all orders created via `OrderService` reflect in real-time.
3. **Branch-Wise Sales Report**:
   - `ReportsEngineData.getBranchPerformance` groups orders by `order.metadata->>'branch_id'`.
   - In PostgreSQL, 140+ orders are already linked to real branches (`br_indiranagar`, `br_kochi_ernakulam`, `br_kollam_central`, etc.).
4. **Inventory Report (`/admin/reports/inventory`)**:
   - **Severe Defect in `ApiEngine.getReportsInventory`** (lines 20876–20894):
     ```ts
     for (const p of products) {
       const price = Number((p as any).price) || 599;
       const stock = Number((p as any).stock) || 50;
       totalVal += price * stock;
     }
     ```
     It assumes every cake has 50 units in stock and generates an artificial valuation (`price * 50`)!
   - **Correction**:
     - **Stock Inventory Report**: Must strictly report on stock-controlled physical items (accessories, toppers, candles) from `branch_inventory` (opening stock, received, sold, adjusted, current stock, low stock alert).
     - **Cake Availability Matrix Report**: Must report on branch fulfillment readiness (which cakes are active, express ready, or paused per branch).

---

## 4. Hardcoded Business Data Audit (Exact Locations)

| Location | Hardcoded Value / Anti-Pattern | Required Fix |
| :--- | :--- | :--- |
| `frontend/src/components/store/shop/product-detail-client.tsx:381` | `stockData.available ?? 15` | Remove fake fallback. Use authoritative inventory mode; do not fetch stock for cakes. |
| `frontend/src/components/store/pdp/pdp-purchase-actions.tsx:85` | `In Stock (${branchStock} available)` | Display branch availability message for cakes; display integer quantity only for accessories. |
| `frontend/src/lib/data/branches.ts:30` | `availableStock: branch?.simultaneous_cakes_capacity ?? 0` | Stop returning simultaneous kitchen capacity as product stock. |
| `frontend/src/lib/services/inventory.service.ts:148` | `VALUES ($1, $2, $3, $4, 50, 0, NOW(), NOW())` | Stop auto-provisioning 50 units of stock for cakes. Only stock-controlled items should have stock records. |
| `frontend/src/lib/services/order.service.ts:278` | `InventoryService.deductStockAtomic` called for all items | Only call for `STOCK_CONTROLLED` items. For cakes, validate branch fulfillment state. |
| `frontend/src/lib/api-engine.ts:20882` | `totalVal += price * 50` | Eliminate fake cake stock valuation. Recompute strictly for stock-controlled items. |
| `frontend/src/lib/reports-engine-data.ts:240-365` | `DEFAULT_SEED_ORDERS`, `DEFAULT_SEED_BRANCHES` | Hydrate directly from PostgreSQL `OrderRepository.findAll` / `listOrders`. |

---

## 5. Existing vs Missing Matrix

| Domain Area | Existing Architecture | Status | Gaps / Required Fixes |
| :--- | :--- | :--- | :--- |
| **Product Classification** | Categories in DB; `pim_config` in `product.metadata` | **PARTIAL** | Add explicit `inventory_mode: "STOCK_CONTROLLED" \| "MADE_TO_ORDER_AVAILABILITY"` helper. |
| **Model A: Stock Inventory** | `branch_inventory` table in PostgreSQL; `BranchAccessoryInventoryModal` | **EXISTING** | Isolate physical inventory operations to stock-controlled items only. |
| **Model B: Cake Availability** | `branch.metadata.product_availability`, `cake_fulfilment` | **EXISTING** | Connect storefront PDP, cart, and checkout to branch availability state. |
| **PDP Display** | `PdpPurchaseActions` | **DEFECTIVE** | Shows fake `15 available` for cakes. Must show kitchen availability status. |
| **Add to Cart Validation** | `ApiEngine.addToCart` | **PARTIAL** | Enforce stock count for accessories; enforce branch availability for cakes. |
| **Order Creation Interaction** | `OrderService.createOrder` | **DEFECTIVE** | Unconditionally decrements stock for cakes. Must branch based on `inventory_mode`. |
| **Sales Reporting** | `ReportsEngineData.getWeeklySalesReport` | **PARTIAL** | Connect canonical API directly to PostgreSQL orders. |
| **Item-Wise Sales** | `ReportsEngineData.getProductPerformance` | **PARTIAL** | Aggregate item sales by product, branch, and date range from PostgreSQL orders. |
| **Branch-Wise Sales** | `ReportsEngineData.getBranchPerformance` | **PARTIAL** | Verified order counts by branch exist; expose clean API endpoint. |
| **Inventory Valuation** | `ApiEngine.getReportsInventory` | **DEFECTIVE** | Multiplies cake price by 50. Must report stock-controlled accessory inventory only. |
| **Availability Report** | UI modal exists | **PARTIAL** | Expose Branch Availability Matrix Report for kitchen operations. |
| **Generic ERP (GRN/Party)** | None | **EXCLUDED** | Confirmed 100% excluded. Zero tables or endpoints created. |

---

## 6. Phased Implementation Plan

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                       PHASED IMPLEMENTATION ROADMAP                         │
├─────────────────────────────────────────────────────────────────────────────┤
│  PHASE 1: Product Classification & Inventory Mode Authority                 │
│  - Define `inventory_mode` in domain model & ProductRepository              │
│  - Authoritative data-driven classification (Accessories vs Cakes)          │
├─────────────────────────────────────────────────────────────────────────────┤
│  PHASE 2: Service & Order Lifecycle Realignment                             │
│  - Branch `OrderService.createOrder`: deduct stock for accessories only     │
│  - Validate branch availability (`product_availability`, `cake_fulfilment`) │
│  - Clean up synthetic 50-unit cake rows from `branch_inventory`             │
├─────────────────────────────────────────────────────────────────────────────┤
│  PHASE 3: Storefront PDP & Cart Availability Enforcement                    │
│  - Fix `product-detail-client.tsx` & `pdp-purchase-actions.tsx`             │
│  - Display availability status for cakes; quantity stock for accessories    │
│  - Enforce branch availability in `addToCart` & cart drawer                 │
├─────────────────────────────────────────────────────────────────────────────┤
│  PHASE 4: Operational Reporting Realignment (Sales, Items, Inventory)       │
│  - Real PostgreSQL Sales Report (Date range, Branch, Category, Net sales)   │
│  - Item-Wise Sales Report (Product, SKU, Qty sold, Revenue per branch)      │
│  - Branch-Wise Sales Report (Orders, Items, Revenue per hub)                │
│  - Stock-Controlled Inventory Report (Opening, Sold, Current, Low stock)    │
│  - Cake Availability Matrix Report (Hub x Product Fulfillment Status)      │
├─────────────────────────────────────────────────────────────────────────────┤
│  PHASE 5: Comprehensive Verification & Checkpoint                           │
│  - Test Model A: Accessory stock deduction, low stock alert, cart cap       │
│  - Test Model B: Cake branch toggle (Available -> Unavailable), no stock dec │
│  - Verify 0 regressions on Cart baseline and PostgreSQL order persistence   │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 7. Database, API, and UI Impact Summary

### Database Impact
- **No breaking migrations required**: Reuses existing `branch_inventory` for Model A and `branch.metadata` for Model B.
- **Data Cleanup**: Purge synthetic 50-unit cake rows from `branch_inventory` to prevent misleading inventory counts.

### API Impact
- `POST /api/v1/orders`: Validates branch availability for cakes; deducts stock only for stock-controlled items.
- `POST /api/v1/cart/items`: Validates stock count for accessories; branch availability status for cakes.
- `GET /api/v1/admin/reports/inventory`: Returns physical stock levels for accessories only.
- `GET /api/v1/admin/reports/availability`: Returns kitchen fulfillment readiness matrix for cakes.
- `GET /api/v1/admin/reports/sales` & `products`: Powered directly by PostgreSQL `OrderRepository`.

### UI Impact
- **PDP**: Eliminates `● In Stock (15 available)` on cakes. Displays `● Available for Delivery` or `● Unavailable at this Kitchen`. Shows quantity only for accessories.
- **Admin Reports**: Displays accurate item-wise sales and branch-wise sales without synthetic valuations.
