# NEXT PHASE START — ORDERS API CONVERGENCE & LIFECYCLE PERSISTENCE

**Date/Time**: 2026-09-18T14:48:00+05:30  
**Phase**: Orders API Convergence, Unified Authoritative Persistence & Lifecycle Verification  
**Operating Branch**: `task/dev` (Head commit `308162125fd72ef30c31176ac3312b9e15ff55a2`)  
**Operating Directory**: `E:\vig\cakes2home-main\cakes2home-main`  
**Database**: Authoritative PostgreSQL 17.6 on Supabase Pooler (`aws-1-ap-south-1.pooler.supabase.com:6543`)  

---

## 1. Verified Baseline
- **Catalog & Cart Integrity**: 100% Verified.
- **Previous Checkpoint**: [`CHECKPOINTS/catalog-cart-integrity-07-testing.md`](file:///E:/vig/cakes2home-main/cakes2home-main/CHECKPOINTS/catalog-cart-integrity-07-testing.md)
- **Git Status**: 131 tracked modified files safely preserved. 0 deletions.
- **Smoke Tests Executed**:
  1. `scratch/test_live_cart_and_pdp.js`: **30/30 PASSED** (Butter Croissant PDP ₹149, no phantom "1 pc", no synthetic weight, Cupcake ₹499 positive price, cart subtotal ₹648, stepper 1->2 ₹298, delete line item).
  2. `scratch/test_pdp_mutation_and_drawer_states.js`: **100% PASSED** (PDP preserved behind drawer, header badge sync, reopen, (+) & (-) stepper, item removal).
  3. Live Dev Server: Health endpoint returns HTTP 200 `backend_health: PASS`, `fallback: DISABLED`, `storage: postgres`.

---

## 2. Unfinished Task Identified & Diagnosed
- **Task**: Orders API Convergence & Authoritative Database Persistence
- **Root Cause Analysis**:
  1. In `frontend/src/app/api/v1/[...path]/route.ts`, lines 2786–2790:
     ```ts
     // ── Orders Mutations (POST) ──
     if (path === "admin/orders" || path === "orders") {
       const order = ApiEngine.addOrder(body);
       return jsonWithDataSource({ order, success: true }, "postgres", 201);
     }
     ```
     This legacy block shadowed the canonical `OrderService.createOrder` at line 3371.
  2. `ApiEngine.addOrder` performed persistence via an un-awaited background Promise (`persistOrderToDb`), introducing an asynchronous race condition where direct database queries immediately following HTTP 201 returned 0 rows. In addition, when raw payloads omitted top-level `total`, `ApiEngine.addOrder` defaulted to `total: 0`.
  3. `OrderService.createOrder` at line 3371 is the canonical transactional order engine:
     - Fetches authoritative prices from catalog database rows (`ProductRepository.findByIds`).
     - Computes line items, taxes, and delivery fees.
     - Atomically deducts branch inventory inside a PostgreSQL transaction (`dbTransaction`).
     - Inserts directly into `"order"` and `"order_status_history"`.
     - Generates authentic delivery & pickup OTPs.
  4. `OrderService.createOrder` parameter aliases: Needs fallback support for `address` -> `delivery_address`, `latitude` -> `delivery_latitude`, `longitude` -> `delivery_longitude`, `delivery_slot_id` -> `delivery_slot`, `phone` -> `customer_phone`, `name` -> `customer_name`.
  5. `PATCH /api/v1/orders`: Currently returns 404 because status updates are routed under `admin/orders/[id]/status` rather than supporting top-level `orders`.

---

## 3. Scope of Changes
- **Files Expected to Change**:
  1. `frontend/src/app/api/v1/[...path]/route.ts`:
     - Remove duplicate shadowing at lines 2786–2790 so `POST /api/v1/orders` and `POST /api/v1/admin/orders` reach `OrderService.createOrder`.
     - Add `PATCH` handler for `path === "orders" || path === "admin/orders" || path.startsWith("orders/")` utilizing `OrderRepository.updateStatus`.
  2. `frontend/src/lib/services/order.service.ts`:
     - Add alias mappings for parameters (`address`, `latitude`, `longitude`, `delivery_slot_id`, `name`, `phone`, `email`).
     - Ensure fallback for items with provided `unit_price` when catalog product price requires fallback.
     - Ensure `metadata` contains `total_amount`, `grand_total`, `total`, `delivery_otp`, and `pickup_otp`.
  3. `frontend/src/lib/services/inventory.service.ts`:
     - Auto-provision branch inventory on-the-fly if a valid catalog product is ordered at a branch without an initial inventory record.
  4. `frontend/src/lib/repositories/order.repository.ts`:
     - Include `"in_preparation"` in `VALID_TRANSITIONS` alongside `"preparing"`.

- **Potential Database Changes**: None (schema is already authoritative and verified).
- **Potential API Changes**: `POST /api/v1/orders` returns synchronous, transactional, database-verified `order` object. `PATCH /api/v1/orders` supports order status updates.

---

## 4. Verification Plan
1. `scratch/test_live_e2e_customer_order_lifecycle.js`:
   - Step 1: Fetch active product and operational branch.
   - Step 2: Submit order via HTTP POST `/api/v1/orders`.
   - Step 3: Verify order exists in PostgreSQL database with correct metadata, OTPs, and total amount.
   - Step 4: Verify order visibility in Branch Manager API `/api/v1/manager/orders`.
   - Step 5: Verify Admin Dashboard Orders Tab `/dashboard?tab=orders`.
   - Step 6: Test Order Status Transition via `PATCH /api/v1/orders`.
   - Step 7: Clean up test order safely from PostgreSQL.
2. Existing integrity suites re-run:
   - `scratch/test_live_cart_and_pdp.js`: 30/30 must pass.
   - `scratch/test_pdp_mutation_and_drawer_states.js`: 100% must pass.
3. TypeScript compilation:
   - `tsc --project frontend/tsconfig.json --noEmit`: 0 errors.
