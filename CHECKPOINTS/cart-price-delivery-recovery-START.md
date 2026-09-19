# Checkpoint: Cart, Price, & Delivery Recovery — START

**Date:** 2026-09-17 21:30:00 IST  
**Git Branch:** `task/dev`  
**Latest Commit:** `3081621`  
**Authoritative Database:** PostgreSQL 17.6 on Supabase Pooler (`aws-1-ap-south-1.pooler.supabase.com:6543`)  
**Dev Server:** Next.js 14.1.4 on `http://localhost:3000` (Online & Serving)  
**Status:** **RECOVERY STARTED — BASELINE INSPECTED, ZERO DESTRUCTIVE ACTIONS**

---

## 1. Current Git Status & Branch

- **Operating Branch:** `task/dev`
- **Head Commit:** `308162125fd72ef30c31176ac3312b9e15ff55a2`
- **Tracked Changes:** 110 modified files in `frontend/` preserved safely with zero deletions.
- **Untracked Additions:** Diagnostic scratch scripts in `scratch/`, test outputs, and prior checkpoint logs.
- **Safety Guarantee:** No git reset, checkout, clean, or restore commands executed. All previous work remains intact.

---

## 2. Currently Modified Files Review

Key files modified in recent phases:
1. `frontend/src/lib/repositories/cart.repository.ts`: Direct PostgreSQL transactional repository for `cart` and `cart_line_item`.
2. `frontend/src/lib/actions/carts.ts`: Server Actions executing directly in-process via `ApiEngine` and `CartRepository`.
3. `frontend/src/components/store/shop/product-detail-client.tsx`: PDP client state; `router.refresh()` removed.
4. `frontend/src/components/store/cart/cart-button.tsx`: Header cart badge and drawer toggle; state overwrite guards added.
5. `frontend/src/components/store/cart/cart-modal.tsx`: Luxury artisan slide-over drawer; optimistic updates.
6. `frontend/src/components/store/location/delivery-location-header.tsx`: Location resolver with dynamic query.
7. `frontend/src/components/store/pdp/pdp-purchase-actions.tsx`: Add to Bag CTA and delivery promises.
8. `frontend/src/lib/api-engine.ts`: Authoritative in-memory state hydrated from PostgreSQL.
9. `frontend/src/lib/data/catalog.ts`: Storefront catalog data access layer.
10. `frontend/src/lib/db-persistence.ts`: PostgreSQL store hydration and sync service.

---

## 3. Existing Flows Analysis

### A. Existing Cart Flow
1. **User Action:** Customer clicks "Add to Bag" on PDP (`product-detail-client.tsx` / `pdp-purchase-actions.tsx`).
2. **Client Dispatch:** Calls `addToCart(variantId, shopId, metadata)` server action in `actions/carts.ts`.
3. **Server Execution:**
   - Obtains active cart ID from cookies (`_cth_cart_id` / `_medusa_cart_id`).
   - Invokes `ApiEngine.addToCart(cartId, itemPayload)`.
   - Persists to PostgreSQL via `CartRepository.saveCart` and `CartRepository.upsertLineItem`.
   - Sets cookies with 30-day max-age and `path: "/"`.
4. **State Broadcast:** Client triggers `cartBus.emitCartUpdated(res.cart)` and opens drawer via `cartBus.emitOpenCart()`.
5. **Drawer Sync:** `CartModal` and `CartButton` receive updated cart object via `cartBus` and render items.

### B. Existing Product-Price Flow
1. **Server Rendering (PDP):** `ProductDetailPage` loads product via `getProductById` / `getProductBySlug` using `ProductRepository`.
2. **Price Resolution:** `selling_price ?? price ?? firstWeightPrice` resolves base price from PostgreSQL `product.metadata`.
3. **Client Weight/Addon Modifiers:**
   - `weightsList` maps available weight tiers from `product.weight_prices`.
   - `calculatedPrice` computes `(base + shapeMod + flavourMod + dietaryMod + addons) * quantity`.
4. **Discrepancy Trigger (Butter Croissant ₹149 vs ₹649):**
   - Historical seed data had missing `metadata.selling_price` on pastries, defaulting to `createDefaultWeightMatrix(id, 649)` or fallback cake base price of ₹649.
   - In `cart_line_item`, `compare_at_unit_price` or `unit_price` previously recorded ₹649 if fallback values were submitted.

### C. Existing Delivery-Price Flow
1. **Header Display:** `delivery-location-header.tsx` queries `/api/v1/delivery/resolve?city=...`.
2. **Cart Drawer:**
   - Currently contains a hardcoded `const freeDeliveryThreshold = 599;`.
   - Shows "You unlocked FREE Delivery!" when `subtotal >= 599`.
   - Shows "Standard Delivery FREE" or "Calculated at checkout".
3. **Violation:** Product page displayed static `20 min • FREE` regardless of real branch serviceability or cutoff times.

---

## 4. Known Terminal Errors & Symptoms

1. `Failed to add item via API client, returning fallback result: Unable to add item to cart: Price for "Chocolate Fudge Cupcake" must be greater than zero.`
2. Product price / cart price mismatch: Product page displays ₹149, cart drawer displays ₹649.
3. Hardcoded delivery messaging: "You unlocked FREE Delivery!", "Standard Delivery FREE", and "20 min • FREE" displayed without backend API verification.
4. Sluggish Add to Cart button and product options disappearance.
5. Header cart badge and cart drawer temporarily displaying 0 or empty state after adding.

---

## 5. Current Confirmed & Suspected Root Causes

1. **Cart Empty State / Badge 0**: Destructive `router.refresh()` was resetting client states and triggering Server Component re-renders with stale or unhydrated cart cookies.
2. **Butter Croissant ₹649 Mismatch**:
   - In `frontend/src/lib/util/weight-matrix.ts`, the default fallback base price is hardcoded as `649` (`createDefaultWeightMatrix(productId, basePrice = 649)`).
   - In `frontend/src/lib/search/search-engine.ts` and `api-engine.ts`, multiple fallbacks use `649`.
   - When a pastry has no weight option or default cake matrix is applied, it erroneously inherits the ₹649 cake price instead of its own ₹149 unit price.
3. **Hardcoded Free Delivery**:
   - `cart-modal.tsx` hardcoded `freeDeliveryThreshold = 599` and unconditionally rendered progress bars and "FREE" labels without checking backend delivery rules or location eligibility.
   - `pdp-purchase-actions.tsx` had static delivery claims.
4. **Zero-Price Rejection & Fallback Masking**:
   - Products lacking explicit price fields in PostgreSQL metadata were resolving to 0 and triggering validation errors.
   - `actions/carts.ts` caught errors and returned fake fallback cart objects, tricking the UI into displaying success.

---

## 6. Exact Next Steps

1. **Phase 1 (Investigation & Diagnostics)**: Run isolated diagnostic script testing Butter Croissant, Cupcake, and zero-price validation; generate `CHECKPOINTS/cart-price-delivery-01-investigation.md`.
2. **Phase 2 (Authoritative Price Contract)**: Audit and standardize price fields (`unitPrice`, `quantity`, `lineSubtotal`, `deliveryFee`, `grandTotal`) across PDP, API, Cart Drawer, and Checkout; generate `CHECKPOINTS/cart-price-delivery-02-price-contract.md`.
3. **Phase 3 (Cart Persistence Hardening)**: Ensure PostgreSQL `cart` and `cart_line_item` remain the single source of truth without memory-only divergence; generate `CHECKPOINTS/cart-price-delivery-03-cart-persistence.md`.
4. **Phase 4 (Truthful Delivery Rules)**: Replace all hardcoded "FREE", "20 min", and delivery claims with honest states derived from backend APIs; generate `CHECKPOINTS/cart-price-delivery-04-delivery-rules.md`.
5. **Phase 5 (Cart UI & Drawer Refinement)**: Update `cart-modal.tsx` so line item prices, subtotals, delivery fees, and grand totals are clearly separated with zero hardcoded placeholders; generate `CHECKPOINTS/cart-price-delivery-05-cart-ui.md`.
6. **Phase 6 (Comprehensive Multi-Viewport Testing)**: Execute full automated Playwright test suite and unit tests; generate `CHECKPOINTS/cart-price-delivery-06-testing.md`.
7. **Documentation**: Maintain `CHECKPOINTS/LATEST_CHECKPOINT.md` and `CHECKPOINTS/recovery-log.md` continuously.
