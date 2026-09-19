# Checkpoint: Cart Failure Resolution & Luxury Cart Drawer Redesign

**Date:** 2026-09-17 19:45:00 IST  
**Git Branch:** `task/dev`  
**Latest Commit:** `3081621`  
**Authoritative Database:** PostgreSQL 17.6 on Supabase Pooler  
**Dev Server:** Next.js 14.1.4 on `http://localhost:3000` (HTTP 200 OK)  
**Status:** **CRITICAL CART FAILURE RESOLVED & LUXURY REDESIGN COMPLETED**

---

## 1. Executive Summary & Root Cause Analysis

### A. Zero-Price Cart Failure
* **Symptom:** Adding products like *Chocolate Fudge Cupcake* (`prod_01KXYMAJKNDZ4T2YVA7K144XP5`) failed with backend error:
  ```text
  Unable to add item to cart: Price for "Chocolate Fudge Cupcake" must be greater than zero.
  ```
* **Root Cause:** Medusa starter seed data in PostgreSQL lacked `price` and `selling_price` fields in `product.metadata` (only storing USD amounts in the legacy `price` table). `product.repository.ts` and `db-persistence.ts` defaulted missing values to `0`.
* **Resolution:**
  1. Executed database migration (`scratch/seed_fix_zero_price_products.js`) setting INR selling prices in `product.metadata` (`Chocolate Fudge Cupcake`: ₹499, `Vanilla Bean Cupcake`: ₹449, `Butter Croissant`: ₹149, `Danish Pastry Assortment`: ₹399).
  2. Enhanced pricing resolvers across `frontend/src/lib/repositories/product.repository.ts`, `frontend/src/lib/db-persistence.ts`, and `frontend/src/lib/api-engine.ts` (`addToCart`) with multi-tier price discovery:
     `meta.selling_price ?? meta.price ?? meta.weight_prices?.[0]?.selling_price ?? clientPrice`.

### B. False-Success & Masked Errors
* **Symptom:** PDP displayed "Successfully added to your bag!" while the cart drawer remained empty (`Your Bag 0`).
* **Root Cause:** `frontend/src/lib/actions/carts.ts` caught API client exceptions and returned a synthetic fallback object `{ id: cartId, variantId, quantity: 1 }` with `success: true`. The PDP received `res.success === true` and showed a green success toast despite the backend rejecting the item.
* **Resolution:** Removed synthetic fake cart returns. True backend validation errors are now thrown and surfaced immediately to the user with retry capabilities.

### C. Cart Session & Cookie Corruption
* **Symptom:** Adding items created corrupted cookies `_cth_cart_id=items`.
* **Root Cause:** In `frontend/src/app/api/v1/[...path]/route.ts`, route matching for `cart/items` extracted `urlCartId = "items"`. Subsequent cart retrieval requests attempted to find cart `"items"` which failed.
* **Resolution:** Replaced loose regex with exact path guards across GET, POST, PUT, and DELETE handlers, ensuring `"items"` is never treated as a valid cart ID.

### D. Duplicate Modals & Event Synchronization
* **Symptom:** Multiple header components mounted `<CartModal />`, causing strict-mode selector conflicts in Playwright and duplicate portal nodes.
* **Root Cause:** Both desktop (`>= 768px`) and mobile (`< 768px`) headers mounted `<NavCart />` which each rendered `<CartModal />`.
* **Resolution:**
  1. Implemented singleton modal pattern in `frontend/src/components/store/cart/cart-button.tsx`: only the primary desktop component mounts `<CartModal />`, which portals globally into `document.body`.
  2. Created `frontend/src/lib/cart/cart-event-bus.ts` (`cartBus`) bound to `window.__CTH_CART_EVENT_BUS__`.
  3. Mobile header cart button and PDP "Add to Bag" buttons invoke `cartBus.emitOpenCart()`, opening the unified drawer seamlessly on all screen sizes.

---

## 2. Luxury Cart Drawer Redesign

The slide-over cart drawer was completely overhauled from a dark `#0D152B` layout to CakeToHome's signature luxury artisan aesthetic:
* **Palette:** Warm cream background (`#FAF8F5`), deep navy headings and primary actions (`#1D2F5D`), champagne gold accents (`#D4AF37`), subtle borders (`slate-200/80`).
* **Free Delivery Progress Bar:** Dynamic threshold indicator ("Add ₹X more for FREE Delivery") with gold-to-amber progress fill and animated milestone celebrations.
* **Cart Line Items:**
  * High-resolution cake thumbnail with loading state.
  * Product title, weight chip (e.g. `1 kg`), flavour chip, shape chip.
  * Message inscription quote preview (e.g. `"Happy Birthday Aswin!"`).
  * Custom photo cake and addons tags.
  * Responsive quantity stepper (+ / -) with instant optimistic UI updates.
  * Individual item removal button with confirmation.
* **Sticky Checkout Footer:**
  * Item subtotal and dynamic standard delivery fee indicator.
  * Bold serif "Total Payable" display.
  * Full-width "Proceed to Checkout →" CTA button.
  * "View Full Bag & Customizations" fallback navigation.
* **Empty State:** Luxury empty bag icon, artisan typography, and "Explore Gourmet Cakes →" action leading back to catalog.

---

## 3. Modified Files

| File | Changes Made |
| :--- | :--- |
| `frontend/src/lib/repositories/product.repository.ts` | Multi-tier price resolution from product metadata |
| `frontend/src/lib/db-persistence.ts` | Fallback price resolution in memory/Postgres store hydration |
| `frontend/src/lib/api-engine.ts` | Canonical price resolution in `addToCart`, line item subtotal updates in `updateCartItem` |
| `frontend/src/app/api/v1/[...path]/route.ts` | Fixed `urlCartId` corruption in GET/POST/PUT/DELETE, added path-based lineItemId support |
| `frontend/src/lib/actions/carts.ts` | Removed fake fallback cart, re-throw real backend errors, export `removeItemFromCart` & `updateCartItemQuantity` |
| `frontend/src/lib/cart/cart-event-bus.ts` | Universal event bus for cart updates, drawer opening, and error propagation |
| `frontend/src/components/store/cart/cart-button.tsx` | Subscribed to `cartBus`, singleton `CartModal` mount, synchronized badge counter |
| `frontend/src/components/store/cart/cart-counter.tsx` | Real-time badge counter updating on cart state changes |
| `frontend/src/components/store/cart/cart-modal.tsx` | Complete redesign with artisan palette, free shipping bar, optimistic quantity updates, and accessibility |
| `frontend/src/components/store/cart/nav-cart.tsx` | Supports `device="desktop"` and `device="mobile"` |
| `frontend/src/app/(store)/layout.tsx` | Clean separation between desktop and mobile navigation bars |
| `frontend/src/components/store/pdp/pdp-purchase-actions.tsx` | Dispatches `cartBus.emitCartUpdated` and `cartBus.emitOpenCart` on successful add |
| `frontend/src/components/store/shop/product-detail-client.tsx` | Integrated with `cartBus` and PDP purchase actions |

---

## 4. Verification Evidence

1. **API Integration Test Suite (`scratch/test_comprehensive_cart_suite.js`)**:
   * All 9 scenarios passed 100%:
     - Scenario 1: Initial cart session created (`cart_guest_...`).
     - Scenario 2: Add zero-priced product (now ₹499) -> Success.
     - Scenario 3: Add duplicate product -> Quantity increments to 2, subtotal ₹998.
     - Scenario 4: Update quantity via `PUT /cart/items` -> Qty 3, subtotal ₹1,497.
     - Scenario 5: Add distinct product (Vanilla Bean Cupcake ₹449) -> 2 line items, subtotal ₹1,946.
     - Scenario 6: Session persistence verification via `GET /cart` -> Exact state matches.
     - Scenario 7: True error validation: Synthetic zero-price request rejected with HTTP 400.
     - Scenario 8: Delete line item via `DELETE /cart/items` -> Remaining item preserved.
     - Scenario 9: Clear cart via `DELETE /cart` -> Emptied cleanly.

2. **Browser Verification Suite (`scratch/verify_cart_flow_playwright.js`)**:
   * Desktop viewport (1280x800): Add to bag, modal confirmation, drawer slide-in, price display, stepper (+), drawer close, header badge sync (2 items), and header button re-open.
   * Mobile viewport (375x812): Mobile cart trigger, drawer full-width slide-in, checkout CTA accessibility.
   * Tablet viewport (768x1024): Tablet header cart trigger and drawer rendering.
