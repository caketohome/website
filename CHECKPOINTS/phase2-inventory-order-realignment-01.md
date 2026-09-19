# CakeToHome — Phase 2: Inventory & Order Lifecycle Realignment Checkpoint
**Checkpoint Reference:** `CHECKPOINTS/phase2-inventory-order-realignment-01.md`  
**Timestamp:** 2026-09-18 16:32:00 IST  
**Status:** **PHASE 2 COMPLETE (100% SUCCESS)**  
**Commit Baseline:** `308162125fd72ef30c31176ac3312b9e15ff55a2` (Branch: `task/dev`)  
**Database Authority:** PostgreSQL 17.6 on Supabase Pooler  

---

## 1. Summary of Changes in Phase 2

1. **Deterministic Inventory Cleanup with Full Reversible Backup**:
   - Executed [`scratch/clean_synthetic_cake_inventory.js`](file:///E:/vig/cakes2home-main/cakes2home-main/scratch/clean_synthetic_cake_inventory.js) in dry-run mode first.
   - Saved 100% full raw backup to [`scratch/backup_branch_inventory_before_cleanup.json`](file:///E:/vig/cakes2home-main/cakes2home-main/scratch/backup_branch_inventory_before_cleanup.json) (1,536,853 bytes).
   - Confirmed 758 rows across 15 cake products and 54 branches with 0 ambiguous rows.
   - Executed cleanup: removed all 758 synthetic 50-unit cake rows from `branch_inventory`. Remaining rows: 0.
2. **Eliminated Auto-Provisioning in `InventoryService`**:
   - In [`frontend/src/lib/services/inventory.service.ts`](file:///E:/vig/cakes2home-main/cakes2home-main/frontend/src/lib/services/inventory.service.ts):
     - Removed lines auto-provisioning 50 units for cakes in `branch_inventory`.
     - When no physical stock row exists, strictly throws `INSUFFICIENT_STOCK`.
3. **Decoupled Order Creation Validation in `OrderService`**:
   - In [`frontend/src/lib/services/order.service.ts`](file:///E:/vig/cakes2home-main/cakes2home-main/frontend/src/lib/services/order.service.ts):
     - Replaced unconditional `InventoryService.deductStockAtomic` call in `createOrder` dbTransaction with data-driven branching:
       - **Made-To-Order Products (Cakes/Pastries)**: Validates branch kitchen fulfillment state (`branch.product_availability` !== `unavailable`/`out_of_stock`/`temporarily_hidden`, and `branch.cake_fulfilment.can_fulfil !== false`). Rejects order immediately if branch is paused or out of stock, with exact kitchen reason. Zero synthetic stock deduction!
       - **Stock-Controlled Products (Accessories)**: Atomically deducts physical inventory using `InventoryService.deductStockAtomic`.
       - **Unknown / Unverified Products**: Fails safely (`throw new Error(...)`) rather than mutating inventory.
4. **Verification**:
   - Re-executed Live End-to-End Customer Order Lifecycle Test ([`scratch/test_live_e2e_customer_order_lifecycle.js`](file:///E:/vig/cakes2home-main/cakes2home-main/scratch/test_live_e2e_customer_order_lifecycle.js)): **7/7 PASSED (100% SUCCESS)**.
   - Confirmed `branch_inventory` remains at 0 synthetic rows after live cake order placement.
   - Full TypeScript check: `tsc --project frontend/tsconfig.json --noEmit` passed with 0 errors.

---

## 2. Next Safe Step
- Proceed to **Phase 3: Storefront PDP & Cart Availability Enforcement**:
  - Remove fake `15 available` fallback in `product-detail-client.tsx` and `pdp-purchase-actions.tsx`.
  - Fix `branches.ts` (`retrieveBranchInventory`) to return physical stock only for accessories.
  - Enforce branch availability in `addToCart` and cart drawer.
