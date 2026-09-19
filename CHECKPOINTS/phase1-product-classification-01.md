# CakeToHome — Phase 1: Product Classification & Domain Model Authority Checkpoint
**Checkpoint Reference:** `CHECKPOINTS/phase1-product-classification-01.md`  
**Timestamp:** 2026-09-18 16:26:00 IST  
**Status:** **PHASE 1 COMPLETE (100% TYPE INTEGRITY)**  
**Commit Baseline:** `308162125fd72ef30c31176ac3312b9e15ff55a2` (Branch: `task/dev`)  
**Database Authority:** PostgreSQL 17.6 on Supabase Pooler  

---

## 1. Summary of Changes in Phase 1

1. **Deterministic InventoryMode Domain Type**:
   - In [`frontend/src/lib/types/domain.ts`](file:///E:/vig/cakes2home-main/cakes2home-main/frontend/src/lib/types/domain.ts):
     - Added `InventoryMode = "STOCK_CONTROLLED" | "MADE_TO_ORDER_AVAILABILITY" | "UNKNOWN"`.
     - Added `inventory_mode?: InventoryMode` to `ProductDomain`.
     - Exported `resolveProductInventoryMode(product)` with strict precedence:
       1. Explicit PIM authority: `pim_config.inventory_mode` once set takes highest precedence.
       2. Physical accessory signals: category slug `accessories`, `cake-accessories`, `greeting-cards`, or ID starting with `acc_`.
       3. Made-to-order bakery signals: bakery categories (`cakes`, `pastries`, `cupcakes`, `specialty-cakes`, `artisanal-cakes`, etc.) or baking attributes (`prep_time_minutes`, `flavour`, `cake_base`, `filling`, `weight_prices`).
       4. Safe deterministic fallback: returns `"UNKNOWN"` rather than assuming a product is stock-controlled or made-to-order.
2. **Product Repository Integration (Zero DDL)**:
   - In [`frontend/src/lib/repositories/product.repository.ts`](file:///E:/vig/cakes2home-main/cakes2home-main/frontend/src/lib/repositories/product.repository.ts):
     - `mapRowToDomain` maps authoritative `inventory_mode`.
     - `save` persists `inventory_mode` inside `product.metadata.pim_config.inventory_mode` (zero SQL schema migrations).
3. **PIM Admin Management**:
   - In [`frontend/src/components/dashboard/admin/pim-editor-modal.tsx`](file:///E:/vig/cakes2home-main/cakes2home-main/frontend/src/components/dashboard/admin/pim-editor-modal.tsx):
     - Added dedicated "Operational Inventory & Availability Model" card in PIM Config tab.
     - Allows explicit toggling between `MADE_TO_ORDER_AVAILABILITY` and `STOCK_CONTROLLED`.
     - Cleanly persists selection to `pim_config.inventory_mode`.
4. **Code Quality**:
   - `tsc --project frontend/tsconfig.json --noEmit`: **0 errors**.

---

## 2. Next Safe Step
- Proceed to **Phase 2: Service & Order Lifecycle Realignment**:
  - Update `InventoryService.deductStockAtomic` to reject made-to-order products and remove cake auto-provisioning.
  - Update `OrderService.createOrder` to validate branch availability for cakes and deduct stock only for stock-controlled items.
  - Perform dry-run and backup before cleaning synthetic cake rows from `branch_inventory`.
