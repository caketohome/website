# CakeToHome — Final Checkpoint: Option 1 Relational Accessory Inventory Authority

**Timestamp:** 2026-09-18 21:30:00 UTC+05:30  
**Environment:** Next.js 14.1.4 (Port 3000), Supabase PostgreSQL 17.6 Pooler  
**Git Branch:** `task/dev`, commit `308162125fd72ef30c31176ac3312b9e15ff55a2`  
**Status:** **100% COMPLETE & VERIFIED (19/19 Assertions Passed)**

---

## 1. Architectural Summary

In accordance with the business decision:
- **Option 1 (Relational PostgreSQL `branch_inventory`)** is the sole authoritative source of truth for physical accessories (Model A).
- The centralized `setting` table has been completely decommissioned as an inventory authority.
- Fresh made-to-order cakes (Model B) have **zero synthetic inventory numbers and zero physical stock deductions**.
- Cake attached accessories (`selected_addons_detail`) receive **exact atomic conditional deductions** from PostgreSQL `branch_inventory`.

---

## 2. Inventory Models & Authority

### Model A: Physical Stock-Controlled Accessories
- **Products Migrated:** 8 SKUs (`acc_01` through `acc_08`) migrated into PostgreSQL `product` and `product_variant` with `pim_config.inventory_mode = 'STOCK_CONTROLLED'`.
- **Relational Seeding:** 424 rows in `branch_inventory` (53 operational branches × 8 SKUs).
- **Composite Key:** Conforming to schema constraint `IDX_branch_inventory_branch_variant`.
- **Atomic Operations:** Conditional SQL UPDATE `WHERE branch_id = $1 AND ... AND (quantity - reserved) >= $3` inside `InventoryService.deductStockAtomic`.
- **Zero Overselling:** Any order or checkout requesting stock greater than available is rejected immediately without partial writes.
- **Concurrency Protection:** Concurrent orders for the last stock unit result in exactly 1 success and 1 rollback with `INSUFFICIENT_STOCK`.

### Model B: Made-to-Order Cakes & Pastries
- **Inventory Mode:** `MADE_TO_ORDER_AVAILABILITY`.
- **Zero Synthetic Inventory:** Verified that `branch_inventory` contains zero rows for cakes.
- **Readiness Verification:** Verified strictly against live branch kitchen fulfillment status (`product_availability` and `cake_fulfilment.can_fulfil`).
- **Fulfillment Deductions:** Zero stock deductions for cakes during checkout.

### Combo Interactions: Cake + Attached Physical Addon
- Cake item receives **zero** inventory deduction.
- Attached physical addon (`selected_addons_detail`) receives **exact atomic relational deduction** from `branch_inventory`.

---

## 3. Verification Evidence

### Automated Verification Script: `scratch/test_relational_accessory_inventory.js`
- **Total Assertions:** 19/19 PASSED (100%)
- **Results:**
  - ✅ [PASS 1] Discovered real physical accessory: Gold Acrylic Happy Birthday Topper (`acc_01`)
  - ✅ [PASS 2] Discovered 2 operational branches: Postgres Pipeline Branch 1785516451109 & 1785516479519
  - ✅ [PASS 3] Discovered real made-to-order cake: Chocolate Fudge Cupcake (`prod_01KXYMAJKNDZ4T2YVA7K144XP5`)
  - ✅ [PASS 4] PostgreSQL `branch_inventory` for Branch A has quantity 45
  - ✅ [PASS 5] PostgreSQL `branch_inventory` for Branch B has quantity 0
  - ✅ [PASS 6] API reflects Branch A stock = 45 (got 45)
  - ✅ [PASS 7] API reflects Branch B stock = 0 (got 0)
  - ✅ [PASS 8] Branch isolation confirmed: Branch A (45) != Branch B (0)
  - ✅ [PASS 9] Add accessory to cart for Branch A succeeds
  - ✅ [PASS 10] Add accessory to cart for Branch B rejected due to 0 stock
  - ✅ [PASS 11] Order placed successfully with Cake + attached Topper
  - ✅ [PASS 12] Cake has NO physical stock record or synthetic deduction in `branch_inventory`
  - ✅ [PASS 13] Topper stock in PostgreSQL accurately deducted from 45 to 44 (got 44)
  - ✅ [PASS 14] Oversell order rejected (`INSUFFICIENT_STOCK: Only 44 units available at branch ... (requested 100)`)
  - ✅ [PASS 15] PostgreSQL stock unchanged at 44 after rejected oversell
  - ✅ [PASS 16] Concurrency test: Exactly 1 order succeeded and 1 failed (Success: 1, Failed: 1)
  - ✅ [PASS 17] Stock reached exactly 0 without overselling or negative quantity
  - ✅ [PASS 18] Inventory report returned 200
  - ✅ [PASS 19] Inventory report reflects PostgreSQL stock 0 for tested accessory
