# Checkpoint: Cart Recovery Investigation & Root Cause Identification

**Date:** 2026-09-17 20:15:00 IST  
**Git Branch:** `task/dev`  
**Latest Commit:** `3081621`  
**Authoritative Database:** PostgreSQL 17.6 on Supabase Pooler (`aws-1-ap-south-1.pooler.supabase.com:6543`)  
**Dev Server:** Next.js 14.1.4 on `http://localhost:3000` (task-1191 running)  
**Status:** **INVESTIGATION COMPLETED — ROOT CAUSES CONFIRMED**

---

## 1. Worktree & Repository Status
- **Current Branch:** `task/dev`
- **Working Tree:** Dirty (active working state with pre-existing uncommitted fixes in repositories and frontend; no changes will be discarded or reset).
- **Database Connection:** Authoritative Supabase PostgreSQL 17.6 Pooler verified with 15 carts and 13 line items in historical tables.

---

## 2. Existing Cart-Related Files
1. `frontend/src/lib/actions/carts.ts` (Next.js Server Actions for cart operations)
2. `frontend/src/lib/api-client.ts` (Frontend & server REST client abstraction)
3. `frontend/src/lib/api-engine.ts` (Core server-side state engine & calculation layer)
4. `frontend/src/lib/db.ts` (PostgreSQL connection pool & transactions)
5. `frontend/src/app/api/v1/[...path]/route.ts` (API route handler for `/api/v1/cart`, `/api/v1/cart/items`)
6. `frontend/src/components/store/cart/cart-button.tsx` (Header cart button, badge, & modal controller)
7. `frontend/src/components/store/cart/cart-counter.tsx` (Header cart badge indicator)
8. `frontend/src/components/store/cart/cart-modal.tsx` (Luxury slide-over cart drawer)
9. `frontend/src/components/store/cart/nav-cart.tsx` (Server component wrapper for header cart button)
10. `frontend/src/components/store/pdp/pdp-purchase-actions.tsx` (PDP quantity, price, Add to Bag, and toast)
11. `frontend/src/components/store/shop/product-detail-client.tsx` (PDP client state manager)
12. `frontend/src/components/store/location/delivery-location-header.tsx` (Delivery location, ETA, & fee display)

---

## 3. Current Known Symptoms & Terminal Evidence
1. **Header Cart Badge shows `0` & Drawer shows Empty State**:
   - Despite displaying "Successfully added to your bag!", opening "Your Bag" shows 0 items.
2. **Add-to-Cart State Resets / Disappears**:
   - After clicking "Add to Bag", the product options flash or reset and the UI feels unstable.
3. **Add to Cart Button is Slow**:
   - Noticeable 2–5 second lag before responding to user interaction.
4. **Hardcoded Delivery Messaging**:
   - Displays "Deliver to Kollam ⚡ 20 min • FREE" even without live API location/serviceability confirmation.
5. **Terminal Historical Error**:
   ```text
   [frontend] Failed to add item via API client, returning fallback result:
   Unable to add item to cart: Price for "Chocolate Fudge Cupcake" must be greater than zero.
   ```

---

## 4. Confirmed Root Causes

### A. State Overwrite via `router.refresh()` in Next.js Server Components
- In `frontend/src/components/store/shop/product-detail-client.tsx` line 492:
  `executeAddToCart` called `router.refresh()`.
- In Next.js App Router, `router.refresh()` re-evaluates all Server Components for the current route and its layouts in the background, re-executing heavy database queries in `ProductDetailPage` and `NavCart`.
- When `NavCart` re-rendered before the browser sent the updated cart cookie or while the server session was resolving, `NavCart` passed an empty cart `{ id: "", items: [] }` to `CartButton`.
- In `frontend/src/components/store/cart/cart-button.tsx` line 20:
  ```tsx
  useEffect(() => {
    if (cart) {
      setLocalCart(cart);
    }
  }, [cart]);
  ```
  `CartButton` received the server's empty cart and **immediately overwrote the active cart in state**, resetting the badge count to `0` and emptying the drawer!
- Simultaneously, the RSC re-render of `ProductDetailPage` caused client components to re-render, creating the "disappearing/resetting" glitch.

### B. Slow Button Response & Network Loopback Failure
- `frontend/src/lib/actions/carts.ts` is a Server Action (`"use server"`).
- Instead of accessing the server-side engine directly, `actions/carts.ts` called `apiClient.addToCart(...)`.
- In `frontend/src/lib/api-client.ts`, server-side calls hardcoded:
  `primaryUrl = typeof window !== "undefined" ? ... : 'http://localhost:3000/api/v1...'`.
- This created an unnecessary HTTP network loopback to `localhost:3000`.
- When accessed via LAN IP (`192.168.1.4:3001`) or non-3000 port, this loopback fails or hangs for 15-30 seconds, causing extreme sluggishness.

### C. Missing PostgreSQL Cart Persistence
- `ApiEngine.addToCart` previously only updated `memoryStore.carts` in-memory.
- It did not commit to PostgreSQL `cart` and `cart_line_item` tables.
- A true production e-commerce platform requires database persistence with transactional guarantees.

### D. Hardcoded Delivery Claims
- In `frontend/src/components/store/location/delivery-location-header.tsx`:
  - Lines 208 & 214 hardcoded `"40 min"` and `"₹49"` when selecting a city without pincode.
  - Line 246 rendered `⚡ {eta} • {fee}` directly from unverified cookies or initial fallbacks.
  - Default text was falling back to `"Kollam"` or `"Deliver to Kollam"` instead of a neutral prompt like `"Select delivery location"`.
- In `frontend/src/components/store/pdp/pdp-purchase-actions.tsx`:
  - Line 164 had static `⚡ Instant confirmation & tracking`.

---

## 5. Next Safe Action Plan
1. **Phase 3 & 4 (Backend & Cart Persistence)**:
   - Create authoritative PostgreSQL persistence in `frontend/src/lib/repositories/cart.repository.ts` storing to `cart` and `cart_line_item` with `dbQuery` / `dbTransaction`.
   - Update `actions/carts.ts` to directly invoke the server-side data layer (`ApiEngine` and PostgreSQL) when running on server, eliminating HTTP loopbacks.
   - Support dynamic host resolution in `api-client.ts` when running in browser or SSR.
2. **Phase 5 & 7 (Frontend State Synchronization & Performance)**:
   - Eliminate destructive `router.refresh()` calls after cart mutations in `product-detail-client.tsx` and `cart-modal.tsx`.
   - Prevent `CartButton` from overwriting a valid populated `localCart` with an empty or undefined server prop.
   - Synchronize canonical cart directly through `cartBus.emitCartUpdated(res.cart)` and cookie synchronization.
3. **Phase 6 (Hardcoded Delivery Removal)**:
   - Remove hardcoded `"40 min"`, `"₹49"`, `"20 min"`, `"FREE"`, and `"Kollam"` fallbacks.
   - Enforce strictly neutral states (`"Select delivery location"`, `"Check delivery availability"`) unless verified data from `apiClient.resolveDeliveryContext` / `/api/v1/delivery/resolve` returns `serviceable: true`.
4. **Phase 8 & 9 (Cart Drawer & Tests)**:
   - Verify loading, empty, and populated cart drawer states.
   - Execute full automated Playwright and integration suites.

---

## 6. How to Resume After Crash
- Re-read this checkpoint: `CHECKPOINTS/CHECKPOINT_20260917_201500_INVESTIGATION_AND_ROOT_CAUSE.md`.
- Next step to execute: Phase 3 & 4 (Create `cart.repository.ts` and update `actions/carts.ts` for direct server-side persistence).
