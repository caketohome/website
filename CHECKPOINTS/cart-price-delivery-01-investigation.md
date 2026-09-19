# Checkpoint: Cart, Price & Delivery — Investigation & Diagnostics

**Date:** 2026-09-17 21:40:00 IST  
**Git Branch:** `task/dev`  
**Latest Commit:** `3081621`  
**Authoritative Database:** PostgreSQL 17.6 on Supabase Pooler (`aws-1-ap-south-1.pooler.supabase.com:6543`)  
**Dev Server:** Next.js 14.1.4 on `http://localhost:3000` (Online & Healthy)  
**Status:** **PHASE 1 COMPLETE — DEEP ROOT CAUSE DIAGNOSIS FINISHED**

---

## 1. Files Inspected During Investigation

1. `frontend/src/lib/util/weight-matrix.ts` (Found default base price fallback `649` in `createDefaultWeightMatrix`).
2. `frontend/src/lib/api-engine.ts` (Found multiple `649` fallbacks and cart line item price resolution logic).
3. `frontend/src/lib/data/catalog.ts` (Storefront catalog hydration; `DEFAULT_CATALOG_PRODUCTS` base prices).
4. `frontend/src/lib/repositories/product.repository.ts` (PostgreSQL product mapping: `selling_price ?? price ?? firstWeightPrice`).
5. `frontend/src/lib/repositories/cart.repository.ts` (PostgreSQL `cart` and `cart_line_item` persistence).
6. `frontend/src/components/store/shop/product-detail-client.tsx` (PDP client state; price calculation & weight option mapping).
7. `frontend/src/components/store/cart/cart-modal.tsx` (Cart drawer; discovered hardcoded `freeDeliveryThreshold = 599` and unconditional "FREE" delivery claims).
8. `frontend/src/components/store/pdp/pdp-delivery-checker.tsx` (Found hardcoded "Same-Day Available" and "Free cold-chain box").
9. `frontend/src/components/store/shop/product-fulfillment-badge.tsx` (Real-time dynamic fulfillment check via `/api/v1/fulfillment/check`).
10. `frontend/src/components/store/location/delivery-location-header.tsx` (Header location & delivery badge logic).

---

## 2. Empirical Findings & Diagnostic Evidence

### A. Butter Croissant ₹149 vs ₹649 Root Cause
- **Database Inspection (`scratch/inspect_croissant_and_price_flows.js`)**:
  - `product` table has:
    - ID: `prod_01KXYMAJKNS8AGWCN5S1WEGKSD`
    - Title: `Butter Croissant`
    - Metadata: `{"mrp": 199, "price": 149, "selling_price": 149, "weight": "1 pc", "weight_prices": [{"id": "wp_croissant_1", "weight_name": "1 pc", "selling_price": 149}]}`
- **Why did a cart item have ₹649?**:
  - Inspection of `cart_line_item` record `item_1789658705920_8gy9` in database revealed `unit_price: 649` and `thumbnail: /images/strawberry-cake.jpg`.
  - In `frontend/src/lib/util/weight-matrix.ts`:
    `export function createDefaultWeightMatrix(productId: string, basePrice: number = 649)`
    `const price = Math.max(100, Number(basePrice) || 649);`
  - In `api-engine.ts` line 7938:
    `const defaultMatrix = createDefaultWeightMatrix(productId, prod.price || 649);`
  - When Butter Croissant was previously missing `metadata.price` in starter seed data, `prod.price` was `null`, so it fell back to `649` (the price of Belgian Chocolate Truffle Cake).
  - When added directly via `POST /api/v1/cart/items` with `{ productId, weight: "1 pc" }`, it now correctly returns `unit_price: 149, total_price: 149, subtotal: 149`.
  - However, in `product-detail-client.tsx`, `weightsList` maps:
    `price: Number(wp.selling_price) || product.price + (Number(wp.price_modifier) || 0)`
    If `product.price` is not cleanly resolved or defaults to 599/649 on client fallback, it can corrupt the submitted price.

### B. Free Delivery Hardcoding in Cart Drawer
- In `frontend/src/components/store/cart/cart-modal.tsx`:
  - Line 146: `const freeDeliveryThreshold = 599;` (Hardcoded!)
  - Line 240: Unconditionally shows `You unlocked FREE Delivery!` when `subtotal >= 599`.
  - Line 343: Displays `Standard Delivery: FREE` when `subtotal >= 599` without checking if the customer has selected a location or if the branch's actual delivery rules allow free delivery.
  - In reality, backend branch rules (`api-engine.ts` line 22799) define:
    `const freeDeliveryThreshold = branch?.fulfillment_rules?.free_delivery_threshold ?? 999;`
  - Therefore, claiming free delivery at ₹599 in the drawer is completely fabricated and misleads the customer.

### C. PDP Static Delivery Claims
- In `frontend/src/components/store/pdp/pdp-delivery-checker.tsx`:
  - Statically renders `Same-Day Available` even when the underlying `ProductFulfillmentBadge` might report `SAME_DAY_CUTOFF_PASSED`, `PRODUCT_REQUIRES_PREORDER`, or `OUT_OF_STOCK`.
  - Statically renders `Free cold-chain box`.

---

## 3. What Was Fixed in Prior Turns
1. Implemented transactional PostgreSQL cart persistence via `CartRepository`.
2. Replaced `actions/carts.ts` HTTP loopback with direct in-process server execution, dropping add-to-cart latency from 3s to <100ms.
3. Eliminated destructive `router.refresh()` in PDP and cart drawer, preventing cart count wipes and product detail state resets.
4. Added state overwrite guards in `CartButton` and `CartModal`.
5. Removed hardcoded `"40 min"`, `"₹49"`, `"Deliver to Kollam"` from `delivery-location-header.tsx`.

---

## 4. What Remains to Be Fixed
1. **Authoritative Price Contract**:
   - Ensure all components strictly distinguish `unitPrice`, `quantity`, `lineSubtotal`, `deliveryFee`, `grandTotal`.
   - Purge all hardcoded `649` fallbacks from `weight-matrix.ts` and `api-engine.ts` to prevent pastries/cupcakes from ever inheriting cake base prices.
2. **Truthful Delivery Representation**:
   - In `cart-modal.tsx`: Remove hardcoded `freeDeliveryThreshold = 599`, fake progress bar, and premature "FREE" labels.
   - Only show delivery fee when calculated from confirmed backend delivery data (or show honest "Delivery fee will be calculated at checkout").
   - In `pdp-delivery-checker.tsx`: Tie "Same-Day Available" strictly to the real-time fulfillment check.
3. **Price Mismatch Guard**:
   - Enforce server-side price validation in `actions/carts.ts` and `ApiEngine.addToCart` so that the line item price always matches the database product price for the selected variant/weight, ignoring any arbitrary client price overrides.

---

## 5. Diagnostic Tests Run & Results

1. `scratch/inspect_croissant_and_price_flows.js`: Passed. Database product records for Butter Croissant confirmed at ₹149.
2. `scratch/check_variant_options.js`: Passed. 33 active variant options inspected.
3. `scratch/test_fetch_croissant_api.js`: Passed. `GET /api/v1/products/butter-croissant` returned `price: 149`, `weight_prices: [{ weight_name: "1 pc", selling_price: 149 }]`.
4. `scratch/test_add_croissant_to_cart.js`: Passed. Direct `POST /api/v1/cart/items` creates cart with `unit_price: 149, total_price: 149`.

---

## 6. Known Warnings & Non-Destructive Status
- Dev server is running on `localhost:3000`.
- Working tree contains 110 tracked modified files from project development; all preserved.
- No uncommitted or destructive git actions taken.

---

## 7. Exact Next Steps (Phase 2 & Phase 3)
1. Proceed to Phase 2: Create authoritative price contract and eliminate hardcoded 649 fallbacks (`CHECKPOINTS/cart-price-delivery-02-price-contract.md`).
2. Proceed to Phase 4: Replace delivery hardcoding with truthful state handling (`CHECKPOINTS/cart-price-delivery-04-delivery-rules.md`).
3. Proceed to Phase 5: Refine Cart Drawer UI & verification (`CHECKPOINTS/cart-price-delivery-05-cart-ui.md`).
