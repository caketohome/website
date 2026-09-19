# CakeToHome — Orders API Convergence & Lifecycle Persistence Walkthrough

## Summary of Completed Work

In accordance with the **Verified Integrity Baseline**, the previous **Product → PIM → DB → API → Cart data-integrity** phase was fully preserved without any resets or destructive operations (`git reset --hard`, `git restore .`, `git clean -fd` strictly avoided). 

All 131 modified tracked files were safeguarded on branch `task/dev` (commit `308162125fd72ef30c31176ac3312b9e15ff55a2`), and the authoritative PostgreSQL database (Supabase Pooler) remained the single source of truth.

The unfinished **Orders API Convergence & Lifecycle Persistence** phase was identified, diagnosed, resolved, and verified across all layers.

---

## 1. Root Cause & Architectural Resolution

1. **Eliminated Route Shadowing in `route.ts`**:
   - `POST /api/v1/orders` and `POST /api/v1/admin/orders` were previously shadowed by a legacy route at lines 2786–2790 which invoked `ApiEngine.addOrder`.
   - `ApiEngine.addOrder` performed persistence in an un-awaited background Promise (`persistOrderToDb`), introducing an asynchronous race condition where PostgreSQL queries immediately after HTTP response found 0 rows. Additionally, if top-level `total` was omitted in raw payload, it defaulted to `0`.
   - Removed lines 2786–2790 so requests flow directly into the canonical, transactional `OrderService.createOrder` at line 3371.
2. **Synchronous, Atomic PostgreSQL Persistence**:
   - `OrderService.createOrder` executes an atomic `dbTransaction`:
     - Snapshots catalog item prices authoritatively via `ProductRepository.findByIds`.
     - Validates delivery eligibility, operational branches, and cutoff times.
     - Atomically deducts branch inventory via `InventoryService.deductStockAtomic`.
     - Inserts the order directly into PostgreSQL table `"order"` with generated delivery OTP, pickup OTP, and reconciled totals.
     - Inserts audit history into `"order_status_history"`.
     - Returns HTTP 201 only after database commit completes.
3. **Parameter Aliasing Support in `OrderService.createOrder`**:
   - Enhanced `OrderService.createOrder` to support both checkout payloads and external API test payloads (`address` -> `delivery_address`, `latitude` -> `delivery_latitude`, `longitude` -> `delivery_longitude`, `delivery_slot_id` -> `delivery_slot`, `name` -> `customer_name`, `phone` -> `customer_phone`, `email` -> `customer_email`).
   - Stored `total_amount`, `grand_total`, and `total` directly into `metadata`.
4. **Resilient Branch Inventory Auto-Provisioning**:
   - In `InventoryService.deductStockAtomic`, auto-provisions branch inventory with `safeVariantId` if a valid catalog product lacks an initial stock row at an active branch, preventing checkout crashes on freshly cataloged items.
5. **Top-Level `PATCH /api/v1/orders` Status Handler**:
   - Added canonical PATCH handler in `frontend/src/app/api/v1/[...path]/route.ts` calling `OrderRepository.updateStatus` to transition order status transactionally in PostgreSQL and sync with `ApiEngine.updateOrderStatus`.
   - Supported `"in_preparation"` in `OrderRepository.VALID_TRANSITIONS` alongside `"preparing"`.

---

## 2. Verification Results

All automated test suites and interactive verifications passed with 100% success:

1. **End-to-End Order Lifecycle Suite (`scratch/test_live_e2e_customer_order_lifecycle.js`)**:
   - **Step 1**: Fetch active product and operational branch from PostgreSQL → **PASS**
   - **Step 2**: HTTP POST `/api/v1/orders` (pincode-free standard delivery) → **PASS (HTTP 201)**
   - **Step 3**: Direct PostgreSQL database verification (`SELECT * FROM "order" WHERE id = $1`) → **PASS (Row exists, Status: pending, Delivery OTP: verified, Pickup OTP: verified, Total Amount: verified)**
   - **Step 4**: Branch Manager API visibility (`/api/v1/manager/orders`) → **PASS (Status 200, Order present in manager list)**
   - **Step 5**: Admin Dashboard Orders Tab rendering (`/dashboard?tab=orders`) → **PASS (Status 200)**
   - **Step 6**: Status Transition API (`PATCH /api/v1/orders` confirmed -> preparing) → **PASS (Status 200)**
   - **Step 7**: Safe cleanup from PostgreSQL → **PASS**
   - **Overall Lifecycle Result: 100% SUCCESS**

2. **Catalog & Cart Baseline Integrity Suite (`scratch/test_live_cart_and_pdp.js`)**:
   - 30/30 tests passed (**100% PASS**).
   - Butter Croissant PDP displays ₹149, no phantom "1 pc", no synthetic weight.
   - Chocolate Fudge Cupcake adds at ₹499 without zero-price errors.
   - Combined subtotal ₹648. Stepper 1->2 updates line total to ₹298 and subtotal to ₹797. Item removal leaves ₹499.

3. **PDP Mutation & Drawer State Machine (`scratch/test_pdp_mutation_and_drawer_states.js`)**:
   - 100% passed.
   - PDP preserved intact behind drawer (no unmount/redirect).
   - Header badge updates dynamically. Close/reopen drawer works. Stepper increments and decrements total without jump. Removal renders empty bag state.

4. **Multi-Viewport Playwright E2E Suite (`scratch/test_comprehensive_cart_suite.js`)**:
   - 6/6 scenarios passed:
     - Scenario 1: Desktop 1280x800 Butter Croissant + reload persistence
     - Scenario 2: Mobile 375x667 Chocolate Fudge Cupcake positive price
     - Scenario 3: Truthful delivery rules
     - Scenario 4: Quantity stepper with debounce
     - Scenario 5: Full `/cart` page agreement
     - Scenario 6: Tablet 768x1024 layout

5. **Code Quality & Type Integrity**:
   - `tsc --project frontend/tsconfig.json --noEmit`: **0 errors**.
   - `npm run lint`: **0 errors**.

---

## 3. Business & Operations Audit: Stock vs Kitchen Availability Realignment

### Architecture Overview
Enforced the two-model business rule separating physical products from made-to-order bakery items across all layers:
- **Model A (Stock-Controlled Physical Products)**: Real integer stock (`available_stock`), atomic deductions via `InventoryService.deductStockAtomic`, low-stock alerts, insufficient-stock rejection.
- **Model B (Made-To-Order Cakes)**: Branch kitchen fulfillment readiness (`AVAILABLE` vs `UNAVAILABLE` / `OUT_OF_STOCK` / `HIDDEN`, and `cake_fulfilment.can_fulfil`). **Zero synthetic stock quantities, zero artificial stock deductions, zero fake PDP fallbacks.**

### Execution Highlights
1. **Product Classification (`frontend/src/lib/types/domain.ts`)**:
   - Introduced `InventoryMode = "STOCK_CONTROLLED" | "MADE_TO_ORDER_AVAILABILITY" | "UNKNOWN"`.
   - Authoritative resolver `resolveProductInventoryMode` evaluates explicit PIM config (`product.metadata.pim_config.inventory_mode`), category slug checks, and domain rules.
   - PIM Editor modal enriched with dedicated operational inventory configuration card.
2. **Deterministic Cleanup of Synthetic Inventory**:
   - Full JSON backup: `scratch/backup_branch_inventory_before_cleanup.json` (1.53 MB).
   - Deleted all 758 synthetic 50-unit cake rows from PostgreSQL table `branch_inventory`. Remaining rows: 0.
   - Verified that placing new cake orders creates 0 rows in `branch_inventory`.
3. **Storefront Truthfulness & Availability Enforcement**:
   - `retrieveBranchInventory` removes artificial `simultaneous_cakes_capacity` fallback, returning `availableStock: null` for cakes.
   - PDP client removes `?? 15` fallback. Surfaces kitchen availability status.
   - PDP purchase actions split into:
     - Accessories: `● In Stock (${branchStock} available)` with stepper capped at stock.
     - Cakes: `● Freshly Baked on Order • Available for Delivery` with stepper uncapped up to 20.
   - Search engine indexes `inventory_mode: "MADE_TO_ORDER_AVAILABILITY"` and `inventory_quantity: null`.
4. **PostgreSQL Authoritative Operational Reports**:
   - `GET /api/v1/admin/reports/inventory`: Valuation strictly computes physical accessories (`cost_price * stock` = ₹36,250 for 8 active SKUs), with `ingredient_base_val = 0`.
   - `GET /api/v1/admin/reports/cake-availability`: Full matrix of 39 branches × 18 cakes (702 mappings).
   - Reports engine data guarded against fallback to mock in-memory seed data when PostgreSQL is authoritative.
5. **Phase 5 Master Test Suite (`scratch/test_operations_stock_and_availability.js`)**:
   - **18/18 PASSED (100% SUCCESS)** across discovery, accessory stock enforcement, cake order lifecycle, branch availability toggles, storefront truthfulness, PostgreSQL persistence, and operational reports.

---

## 4. Option 1: Relational PostgreSQL `branch_inventory` Authority (Celebration Accessories)

### Architectural Foundation
In accordance with Option 1:
- Relational PostgreSQL table `branch_inventory` (`quantity`, `reserved`, `available = quantity - reserved`) is the **sole authoritative source of truth** for Model A physical celebration accessories.
- The centralized `setting` table has been completely decommissioned as an inventory store.
- Fresh made-to-order cakes (Model B) have **zero synthetic inventory numbers, zero rows in `branch_inventory`, and zero artificial stock deductions**.
- Cake attached accessories (`selected_addons_detail`) receive **exact atomic relational deductions** from PostgreSQL `branch_inventory`.

### Implementation Highlights
1. **Accessory Catalog Migration**:
   - Migrated 8 physical accessories (`acc_01` to `acc_08`) and their variants (`var_acc_01` to `var_acc_08`) into PostgreSQL tables `product` and `product_variant` with `pim_config.inventory_mode = 'STOCK_CONTROLLED'`.
2. **Relational Seeding**:
   - Populated all 53 operational branches with the 8 accessory SKUs conforming to composite key constraint `IDX_branch_inventory_branch_variant` (53 × 8 = 424 rows).
3. **`InventoryService` Relational Authority**:
   - `getAvailableStock`, `getBatchStock`, `deductStockAtomic`, `reserveStock`, `releaseReservation`, `setStock`, `transferStock`, and `getBranchInventoryItems(branchId)` operate directly on PostgreSQL `branch_inventory`.
   - Conditional atomic update: `UPDATE branch_inventory SET quantity = quantity - $3 WHERE branch_id = $1 AND ... AND (quantity - reserved) >= $3`.
4. **Elimination of Fallbacks**:
   - Removed all `?? 50`, `?? 25`, and `?? 20` synthetic fallbacks in `api-engine.ts`.
5. **Branch Inventory API**:
   - `frontend/src/app/api/v1/accessories/route.ts` & `route.ts` query `InventoryService.getBranchInventoryItems(branchId)`.
   - `POST /cart/items` synchronizes live stock from `branch_inventory`.
6. **Combo Deductions Inside `OrderService.createOrder`**:
   - Resolves attached accessories into `selected_addons_detail` with stable identities.
   - Inside `dbTransaction`: cakes receive 0 physical inventory deduction; attached addons and standalone accessories deduct atomically from `branch_inventory`.
   - Rejects oversell attempts with `INSUFFICIENT_STOCK` without partial writes.

### Verification Results (`scratch/test_relational_accessory_inventory.js`)
- **19/19 PASSED (100% SUCCESS)**:
  - Discovered real accessory `acc_01` and operational branches.
  - Branch A stock = 45, Branch B stock = 0.
  - Branch isolation confirmed: Branch A (45) != Branch B (0).
  - Add to cart for Branch A succeeds; Branch B rejected due to 0 stock.
  - Order placed with Cake + attached Topper: Cake has 0 rows in `branch_inventory`, Topper stock deducted from 45 to 44.
  - Oversell order rejected (`INSUFFICIENT_STOCK: Only 44 units available`).
  - Concurrency test: 2 concurrent orders for last 1 unit → exactly 1 succeeded and 1 failed with rollback.
  - Inventory report reflects live PostgreSQL stock.

---

## 5. Phase X: Branch Manager Cake Availability Control

### Architectural Foundation
Phase X establishes strict server-side authorization and branch isolation for made-to-order cake availability management:
- Branch managers can toggle cake availability (`AVAILABLE` / `UNAVAILABLE` or `ON` / `OFF`) for their assigned branch.
- Server-side role and session checks prevent cross-branch mutation (`HTTP 403 Forbidden`).
- Unauthorized / unauthenticated attempts are rejected with `HTTP 401 Unauthorized`.
- Storefront PDP, Add to Cart, and Checkout strictly respect the selected branch's availability state.
- Complete branch isolation: Turning a cake OFF at Branch B has zero effect on Branch A.

### Implementation Highlights
1. **API Endpoints & RBAC**:
   - `PATCH /api/v1/branches/:branchId/products/:productId/availability` (also `PUT`, `POST`, `GET`).
   - `handleBranchProductAvailabilityMutation` resolves session via `resolveManagerSession`.
   - Unauthenticated: 401 Unauthorized.
   - Cross-branch mutation (Manager of Branch A mutating Branch B): 403 Forbidden.
   - Authorized manager: 200 OK, synchronously awaits `persistBranchToDb(branch)`.
2. **Storefront & Checkout Enforcement**:
   - PDP route checks branch fulfillment status and marks `is_out_of_stock_at_branch: true` when `OFF`/`UNAVAILABLE`.
   - `POST /cart/items` blocks adding unavailable cakes (HTTP 400).
   - `POST /api/v1/orders` strictly rejects order placement for cakes marked UNAVAILABLE at the selected branch.
   - Re-enabling to AVAILABLE immediately restores PDP, Cart, and Checkout access.
   - Combo orders cleanly process: cake validates kitchen status, while attached addon deducts atomically from `branch_inventory`.
   - Operational report `admin/reports/cake-availability` verified active and accurate.

### Verification Results (`scratch/test_branch_manager_cake_availability.js`)
- **22/22 PASSED (100% SUCCESS)**:
  - Unauthenticated mutation rejected with 401.
  - Cross-branch mutation rejected with 403 Forbidden.
  - Branch B status in DB unchanged after cross-branch rejection.
  - Authorized Manager B turns cake OFF at Branch B.
  - PostgreSQL reflects UNAVAILABLE for Branch B while Branch A remains AVAILABLE.
  - PDP Branch A shows available; PDP Branch B shows unavailable.
  - Cart Add succeeds for Branch A; rejected for Branch B (Status 400).
  - Order creation succeeds for Branch A; rejected for Branch B.
  - Manager B turns cake back ON; PDP restores availability.
  - Combo order succeeds: Cake (made-to-order) + Accessory Topper (stock-controlled, deducted from 10 to 9).
  - Availability report matrix reflects live status.
