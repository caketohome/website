# Checkpoint: Cart Persistence & State Synchronization Hardened

**Date:** 2026-09-17 22:00:00 IST  
**Git Branch:** `task/dev`  
**Latest Commit:** `3081621`  
**Authoritative Database:** PostgreSQL 17.6 on Supabase Pooler (`aws-1-ap-south-1.pooler.supabase.com:6543`)  
**Dev Server:** Next.js 14.1.4 on `http://localhost:3000` (Online & Healthy)  
**Status:** **PHASE 3 COMPLETE — CART PERSISTENCE & SYNCHRONIZATION HARDENED**

---

## 1. Single Source of Truth & Architecture

The application uses an authoritative **Hybrid PostgreSQL + In-Memory Engine** model:
1. **Cart Identity:** Managed via long-lived (30-day), path-scoped (`path: "/"`) HTTP cookies:
   - `_cth_cart_id`: Primary CakeToHome session cart ID.
   - `_medusa_cart_id`: Legacy compatibility cookie.
2. **Database Persistence:**
   - Handled transactionally in `frontend/src/lib/repositories/cart.repository.ts`.
   - Table `cart`: Stores `id`, `currency_code`, `customer_id`, `sales_channel_id`, `metadata`.
   - Table `cart_line_item`: Stores `id`, `cart_id`, `title`, `thumbnail`, `quantity`, `variant_id`, `product_id`, `unit_price`, `raw_unit_price` (JSONB `{ value: String(price), precision: 20 }`), `compare_at_unit_price`, `metadata`.
3. **In-Process Server Actions:**
   - In `frontend/src/lib/actions/carts.ts`, all operations (`createCart`, `addToCart`, `updateCartItemQuantity`, `removeItemFromCart`, `clearCartAction`) run in-process directly against `ApiEngine` and `CartRepository`.
   - Zero HTTP loopback network latency (<100ms response time).
4. **Failure Propagation:**
   - Fake fallback objects (`return fallback result`) completely eliminated.
   - Errors throw cleanly to client callers (`throw new Error(...)`), keeping UI in error state without false positive toasts.

---

## 2. State Synchronization Across Components

1. **Destructive Refresh Elimination:**
   - `router.refresh()` removed from PDP and Cart Drawer actions. Client states (selected weight, shape, custom message inscription) are 100% preserved.
2. **Header Cart Badge:**
   - Listens to `cartBus.onCartUpdated(...)` and recalculates count from `cart.items.reduce((sum, i) => sum + i.quantity, 0)`.
   - Overwrite guards prevent empty server props from clearing populated local badge counts.
3. **Cart Drawer:**
   - Opens only after server action returns `{ success: true, cart }`.
   - Renders line items with optimistic updates during stepper operations, reverting gracefully if server mutation fails.

---

## 3. Automated Validation Results
- Integration Suite (`scratch/test_comprehensive_cart_suite.js`): 9/9 PASSED.
- Direct PostgreSQL Query (`scratch/test_server_action_and_pg_persistence.js`): Confirmed active rows in `cart` and `cart_line_item`.

---

## 4. Exact Next Steps (Phase 4 & Phase 5)
- Proceed to Phase 4: Delivery Rules Truth & Hardcoding Removal (`CHECKPOINTS/cart-price-delivery-04-delivery-rules.md`).
- Proceed to Phase 5: Cart UI Redesign & Delivery Banner Integration (`CHECKPOINTS/cart-price-delivery-05-cart-ui.md`).
- Update `CHECKPOINTS/LATEST_CHECKPOINT.md` and `CHECKPOINTS/recovery-log.md`.
