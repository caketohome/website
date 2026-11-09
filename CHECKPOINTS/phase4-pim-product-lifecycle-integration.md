# Checkpoint: CakeToHome ERP — Phase 4: PIM Product Lifecycle Integration Report

**Project:** CakeToHome ERP  
**Workstream:** Workstream E — PIM Product Lifecycle Integration  
**Date:** 2026-10-17  
**Status:** 🔒 **VERIFIED AND SECURED (12/12 AUTOMATED TESTS PASSED)**  
**Authoritative Source of Truth:** Live PostgreSQL (`aws-1-ap-south-1.pooler.supabase.com:6543/postgres`)  
**TypeScript Status:** `npx tsc --noEmit` exited with code 0 (zero errors)  
**Test Suites:**
- `scratch/test_phase4_pim_lifecycle.js`: 12/12 PASSED (100%)
- `scratch/test_comprehensive_tax_integration.js`: 12/12 PASSED (100%)

---

## 1. Executive Summary

Phase 4 audited and repaired the canonical product lifecycle across PIM, product variants, store catalog, shopping cart, checkout, order snapshotting, statutory invoices, and multi-branch inventory. 

All modifications strictly preserve existing Phase 3 Tax Master integration (fail-closed, 5 statutory rates, single source of truth in `TaxResolverService`). No duplicate product systems or Tax Masters were created, and historical order and accounting ledger records remain untouched and immutable.

---

## 2. Root Cause Analysis & Core Structural Repairs

### A. Canonical Product & Variant Domain Model
- **Files Modified:** `frontend/src/lib/types/domain.ts`, `frontend/src/lib/repositories/product.repository.ts`, `frontend/src/lib/db-persistence.ts`
- **Root Cause:** 
  1. `ProductDomain` lacked a typed `variants` collection, leading to dropped variant details when passing between repositories and services.
  2. `OrderItemDomain` lacked snapshot fields (`variant_id`, `merchandise_type`, `sku`, `barcode`, `hsn_code`, `tax_rate_id`, `tax_code`), causing downstream services (tax posting, inventory restoration) to lose variant context.
  3. `ProductRepository.mapRowToDomain` did not read `merchandise_type` from `product.merchandise_type`, falling back to inference.
  4. `ProductRepository.save` and `db-persistence.ts:persistProductToDb` omitted `merchandise_type` on `INSERT` and `ON CONFLICT DO UPDATE`.
  5. `ProductRepository.upsertVariant` did not persist `barcode`, `weight`, or variant price into `metadata`.
- **Fix:**
  - Extended `ProductDomain` with `variants?: any[]` and `OrderItemDomain` with snapshot attributes.
  - Updated SQL queries in `ProductRepository` and `db-persistence.ts` to persist and load `merchandise_type`, variant prices, weights, and barcodes.
  - Repaired `findById` to query and return `product_variant` rows with variant-specific prices from `metadata.selling_price ?? metadata.price`.

### B. Bakery (`CAKE`) vs Physical (`ACCESSORY`) Inventory Distinction
- **Files Modified:** `frontend/src/lib/services/order.service.ts`, `frontend/src/lib/repositories/product.repository.ts`, `frontend/src/lib/repositories/order.repository.ts`
- **Root Cause:**
  1. Generic inventory checks previously queried `branch_inventory` for all items, treating made-to-order cakes as physical stock and causing cakes to show out-of-stock when fabricated stock was 0.
  2. Order cancellation previously restored all items to inventory, creating fabricated physical cake stock in `branch_inventory`.
- **Fix:**
  - In `ProductRepository.listProducts` and `findById`: guarded shared inventory stock check so `merchandise_type === 'CAKE'` is never marked out-of-stock from inventory count rows.
  - In `OrderService.createOrder`:
    - Made-to-order cakes (`merchandise_type === 'CAKE'`): governed strictly by branch kitchen capacity/readiness and operational cutoff; zero fabricated physical inventory decremented.
    - Physical accessories (`merchandise_type === 'ACCESSORY'` / `'PACKAGING'`): queries real physical stock in `branch_inventory` and atomically decrements via `InventoryService.deductStockAtomic`, preventing overselling.
  - In `OrderRepository.cancelOrder`: stock restoration to `branch_inventory` is strictly filtered to `ACCESSORY` and `PACKAGING` (plus attached addons); made-to-order cakes never generate physical inventory restoration movements.

### C. Paise Rounding Alignment
- **Files Modified:** `frontend/src/lib/services/order.service.ts`
- **Root Cause:** Line taxes were previously rounded to nearest whole rupee (`Math.round((lineTotal * lineTaxRate) / 100)`), causing an unbalance with `SalesTaxEngine` which calculates to exact paise.
- **Fix:** Aligned line-tax calculation to exact paise: `Math.round(((lineTotal * lineTaxRate) / 100) * 100) / 100`, ensuring debits exactly equal credits ($Dr === Cr$) on sales vouchers.

### D. Variant Integrity & Tampering Guard
- **Files Modified:** `frontend/src/lib/services/order.service.ts`
- **Root Cause:** `OrderService.createOrder` accepted arbitrary `variant_id` without verifying that the variant actually belongs to the specified product.
- **Fix:** Added validation asserting `vRow.product_id === product.id`. Mismatched variants, deleted products, or inactive products strictly throw fail-closed errors.

---

## 3. Review List: 12 Unmapped Catalog Products

In Phase 3 and Phase 4, the audit established that 10 products have active tax configuration while 12 products remain unmapped.

Per instructions, **rates must NOT be guessed** from titles or HSN codes. All 12 products belong to HSN `19059010` ("Pastries and cakes") and strictly fail closed (`MISSING_TAX_RATE`):

| Product ID | Title | HSN Code | Category | Statutory Action Required |
|---|---|---|---|---|
| `prod_01KXYMAJKNDZ4T2YVA7K144XP5` | Chocolate Fudge Cupcake | 19059010 | Cupcakes | Assign Tax Master classification in PIM |
| `prod_01KXYMAJKNH99E1TMWYGQGT61D` | Danish Pastry Assortment | 19059010 | Pastries | Assign Tax Master classification in PIM |
| `prod_01KXYMAJKNS8AGWCN5S1WEGKSD` | Butter Croissant | 19059010 | Pastries | Assign Tax Master classification in PIM |
| `prod_01KXYMAJKNV48P1B9CM7C022YM` | Vanilla Bean Cupcake | 19059010 | Cupcakes | Assign Tax Master classification in PIM |
| `prod_1` | Belgian Chocolate Truffle Cake | 19059010 | Cakes | Assign Tax Master classification in PIM |
| `prod_2` | Classic Red Velvet Cream Cheese Cake | 19059010 | Cakes | Assign Tax Master classification in PIM |
| `prod_3` | Fresh Alphonso Mango Mousse Cake | 19059010 | Cakes | Assign Tax Master classification in PIM |
| `prod_4` | Black Forest Gateau Special | 19059010 | Cakes | Assign Tax Master classification in PIM |
| `prod_5` | Butterscotch Caramel Crunch Cake | 19059010 | Cakes | Assign Tax Master classification in PIM |
| `prod_dist_pg_persisted_test` | Artisan Dedicated PG Test Cake | 19059010 | Cakes | Assign Tax Master classification in PIM |
| `prod_dist_test_01` | Artisan Delicate Truffle Cake | 19059010 | Cakes | Assign Tax Master classification in PIM |
| `prod_dist_test_02` | Sturdy Dry Fruit Tea Cake | 19059010 | Cakes | Assign Tax Master classification in PIM |

---

## 4. Test Verification Evidence

```
================================================================================
CAKETOHOME ERP — PHASE 4: PIM PRODUCT LIFECYCLE INTEGRATION TEST SUITE
================================================================================

--- TEST 1: PIM Product Creation & Editing ---
  [PASS] Product successfully created, persisted, and updated in PostgreSQL.

--- TEST 2: Variant Creation, Editing & Retrieval ---
  [PASS] Variants created, retrieved, and updated with SKU, barcode, and variant-specific pricing.

--- TEST 3: Canonical Product & Variant IDs Across Catalog & Orders ---
  [PASS] Canonical product & variant IDs, SKU, barcode, and merchandise type correctly snapshotted.

--- TEST 4: Product & Variant Tax Assignment via Tax Master ---
  [PASS] Tax Master correctly resolves base product (GST 5%), variant override (GST 18%), and inheritance.

--- TEST 5: Checkout & Invoice Consistency ---
  [PASS] Order subtotal (₹1410) + tax (₹186.2) === total (₹1596.2). Statutory voucher balanced (Dr ₹1596.2 == Cr ₹1596.2).

--- TEST 6: Made-to-Order Cake Availability & Fulfillment ---
  [PASS] Made-to-order cake fulfilled without physical stock decrement; kitchen unavailability guard rejected order as expected.

--- TEST 7: Accessory Inventory Reservation & Decrement ---
  [PASS] Accessory stock decremented from 33 to 31; overselling blocked with INSUFFICIENT_STOCK.

--- TEST 8: Cancellation, Return & Stock Restoration ---
  [PASS] Order cancellation restored physical accessory stock (+1) and left made-to-order cake stock untouched.

--- TEST 9: Inactive Products & Invalid Variants Rejection ---
  [PASS] Inactive products, non-existent variants, and cross-product variant tampering fail closed.

--- TEST 10: Duplicate Requests & Retry Safety ---
  [PASS] Duplicate request returned identical order with zero duplicate reservations or database rows.

--- TEST 11: Branch Isolation & Security ---
  [PASS] Branch isolation verified: stock movements at branch leave other branches isolated.

--- TEST 12: Independent PostgreSQL Verification & Clean Teardown ---
  [PASS] Overall Trial Balance verified (Net Diff: ₹0.00). All 12 unmapped products confirmed failing closed. Test artifacts cleaned up.

================================================================================
VERIFICATION COMPLETE: 12/12 TESTS PASSED (100%)
================================================================================
```

---

## 5. Next Action

Proceed to **Workstream F: Invoice Integration (Phase 5)**:
- Sales invoice lifecycle: Order delivered -> Sales invoice auto-generated -> GL subledger voucher posted (`Dr 1121 AR` or `1122 Undeposited COD` / `Cr 4110 Revenue` / `Cr 211x GST Payable`).
- Purchase invoice lifecycle: PO -> Goods Receipt (GRN) -> Purchase Invoice -> AP recognition -> Supplier Payment.
- Payment allocation tracking and idempotency.
