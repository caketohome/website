# CHECKPOINT: Physical Accessory Inventory Authority (Option 1) & Branch Cake Availability Baseline

**Checkpoint Reference:** `CHECKPOINTS/accessory-inventory-relational-01.md`  
**Timestamp:** 2026-09-18 19:50:00 IST  
**Environment:** Next.js 14, PostgreSQL 17.6 (Supabase Pooler), Node.js  
**Branch:** `task/dev`  
**Head Commit:** `308162125fd72ef30c31176ac3312b9e15ff55a2`  
**Dev Server:** Healthy on Port 3000 (Storage: `postgres`, Fallback: `DISABLED`)  
**Phase:** Phase 0 (Safety & Baseline Verification) — COMPLETE  

---

## 1. Safety & Non-Destructive Integrity Confirmation

1. **Git Working Tree**:
   - Verified active branch: `task/dev`.
   - Verified commit: `308162125fd72ef30c31176ac3312b9e15ff55a2`.
   - Strictly preserved all existing changes across tracked files.
   - Strictly avoided all destructive git operations (`git reset --hard`, `git restore .`, `git checkout -- .`, `git clean -fd`).
   - Prior backup `scratch/backup_branch_inventory_before_cleanup.json` (1.53 MB) preserved intact and untouched.

2. **Database & Schema Guardrails**:
   - Authoritative database: PostgreSQL 17.6 on Supabase Pooler.
   - Zero schema DDL: Using existing `product`, `product_variant`, and `branch_inventory` tables.
   - Zero scope creep: No GRN/GNR, Parties/Ledgers, Accounts, B2B billing portals, or Teller Settlement.

---

## 2. Baseline Architecture State

1. **Physical Accessories**:
   - `product` table: 54 products (all cakes, pastries, brownies, etc.). Zero rows for physical accessories (`acc_%`).
   - `branch_inventory` table: 0 rows (all 758 synthetic cake rows were cleanly deleted in Phase 2).
   - In-memory runtime: Accessories currently resolve to `DEFAULT_ACCESSORIES` array in `frontend/src/lib/api-engine.ts` with 8 static items (`acc_01` through `acc_08`).
   - Addon metadata: On PDP, selected accessories are saved as plain text titles in cake line items (`metadata.selected_addons = ["Gold Acrylic Happy Birthday Topper"]`), resulting in zero physical inventory deduction on order creation.

2. **Branch Manager Cake Availability (Phase X Requirement)**:
   - Cakes are `MADE_TO_ORDER_AVAILABILITY`. They do not have physical SKU stock quantities.
   - Branch kitchen fulfillment readiness is modeled via `branch.metadata.product_availability` and `branch.metadata.cake_fulfilment`.
   - Need strict server-side authorization: Manager of Branch A can only change Branch A's cake availability; Branch B remains isolated.
   - Storefront PDP, Cart, and final Checkout order creation must enforce the branch's authoritative cake availability.

---

## 3. Plan of Execution

- **Phase 1**: Inspect PostgreSQL `product` and `product.repository.ts`. Formulate safe dry-run mapping of 8 physical accessories to `product` records (`pim_config.inventory_mode = "STOCK_CONTROLLED"`). Save audit JSON and insert safely without DDL.
- **Phase 2**: Inspect `branch_inventory` schema and operational branches. Create branch-isolated inventory rows. Identify authoritative initial stock or document migration source.
- **Phase 3**: Remove static inventory authority (`DEFAULT_ACCESSORIES` and hardcoded fallbacks `?? 50`, `?? 25`, etc.) in production paths.
- **Phase 4**: Update `GET /api/v1/accessories` to support branch context (`?branchId=...`) returning real `branch_inventory` stock.
- **Phase 5**: Wire `InventoryService` as authoritative physical stock service with branch-isolated atomic deductions and low-stock evaluation.
- **Phases 6–8**: Cake Addon Inventory & Identity: Map selected addons to stable accessory product/variant IDs in `metadata.selected_addons_detail`, and atomically deduct physical stock during order creation transaction while keeping cakes non-inventory. Roll back on any failure.
- **Phases 9–15**: Cart validation, PDP data-driven display, admin inventory management, reporting, PIM & search indexing, removal of obsolete fallbacks.
- **Phase X**: Branch Manager Cake Availability Control: Server-side authorization, branch isolation, PDP/Cart/Checkout enforcement, manager UI integration.
- **Phases 16–18**: Comprehensive automated test suites (`scratch/test_relational_accessory_inventory.js` and `scratch/test_branch_manager_cake_availability.js`), regression suites, and documentation.
