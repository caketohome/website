# Forensic Database Source-of-Truth Remediation: Crash Recovery Record

**Project:** CakeToHome / Cake2Home Platform  
**Target Environment:** PostgreSQL 15 / 17 (Supabase Pooler: `aws-1-ap-south-1.pooler.supabase.com:6543/postgres`)  
**Recovery Timestamp:** September 8, 2026  
**Document Code:** `CTH-REC-DB-SOT-01`  
**Classification:** CRITICAL DISASTER RECOVERY & RESUMPTION NOTE  

---

## 1. Crash Discovery & Git Status

The IDE crashed during execution of **Step 4** ("Propose/implement minimal fixes to make PostgreSQL authoritative") of the Database Source-of-Truth remediation plan.

### Git Branch & Status Summary
- **Current Branch:** `task/dev` (up to date with `origin/task/dev`)
- **Total Tracked Changes:** 69 files modified (+2187 insertions, -685 deletions across working tree).
- **Safety Directive Enforced:**
  - Zero git resets (`git reset --hard` NOT performed)
  - Zero discards (`git checkout .`, `git restore .` NOT performed)
  - Zero branch switching
  - Zero untracked deletions
  - Existing optimizations from Phases 8.1, 8.2, 8.3, 8.4, and 8.5 preserved 100%.

### Changed Files Breakdown (Pre-existing vs DB Remediation)
1. **Pre-Existing Optimizations (Phases 8.1 – 8.5):**
   - Backend APIs (`backend/src/api/admin/...`, `backend/src/api/store/...`)
   - Backend Modules (`backend/src/modules/catalog/service.ts`, `backend/src/modules/delivery/service.ts`, `backend/src/modules/order-lifecycle/service.ts`, `backend/src/modules/settings/service.ts`)
   - Frontend components & code-splitting (`frontend/src/components/...`, `frontend/src/app/(store)/...`, `next.config.mjs`)
2. **Active Database Source-of-Truth Remediation (Current Phase):**
   - `frontend/src/lib/services/inventory.service.ts` (created: PostgreSQL atomic deduction via conditional update)
   - `frontend/src/lib/services/order.service.ts` (modified: transactional order persistence + inventory deduction + order_status_history)
   - `frontend/src/lib/repositories/order.repository.ts` (modified: `listOrders`, `findById`, `save`, `updateStatus` with `order_status_history`)
   - `frontend/src/lib/repositories/product.repository.ts` (modified: `listProducts`, `findById`, `findByIds`, `findAll` mapped from DB)
   - `frontend/src/lib/repositories/customer.repository.ts` (modified: `listCustomers`, `findById`, batched address queries)
   - `frontend/src/lib/repositories/branch.repository.ts` (modified: multi-row zone insert, DB reads)
   - `frontend/src/lib/repositories/favorite.repository.ts` (modified: DB queries)
   - `frontend/src/lib/repositories/review.repository.ts` (modified: DB queries)
   - `frontend/src/lib/api-engine.ts` (modified: `recordCreatedOrder`, CMS version pruning, order mapping)
   - `frontend/src/lib/db-persistence.ts` (modified: batch zone persistence)
   - `frontend/src/app/api/v1/[...path]/route.ts` (modified: cutover for order creation, status update, CMS update, favorites, reviews)

### Untracked Files Discovered
- `plans/database-source-of-truth-audit-report.md` (Forensic DB connectivity & SOT audit report)
- `plans/phase-db-source-of-truth-audit.md` (Domain classification & risk matrix)
- `plans/phase-db-data-reconciliation-report.md` (Memory vs PostgreSQL data reconciliation)
- `frontend/scripts/seed-branch-inventory.ts` (Inventory seeding script)
- `frontend/scripts/test-inventory-concurrency.ts` (Hard gate: 10 concurrent requests for stock 1)
- `frontend/scripts/test-order-idempotency.ts` (Hard gate: Idempotency-Key replay protection)
- `frontend/scripts/test-command-center-consistency.ts` (Hard gate: Order Command Center list/detail DB sync)
- `frontend/scripts/test-cms-persistence-db.ts` (CMS PostgreSQL persistence verification)
- `frontend/scripts/data-reconciliation-inspect.ts` (Data inspection utility)
- `frontend/scripts/forensic-db-source-of-truth-audit.ts` (DB audit utility)

---

## 2. Completed Work Discovered

The following tasks from the previous session were successfully completed and verified:
1. **STEP 1 — ApiEngine MemoryStore Call Sites Audited**:
   - Every reference to `memoryStore` and `(globalThis).__CTH_MEMORY_STORE__` classified into Authoritative, Temporary, Derived, Cache, Fixture, Configuration.
2. **STEP 2 — End-to-End Tracing & Forensic Acid Tests**:
   - Traced catalog, branch, order, customer, CMS, and inventory endpoints from HTTP request to memory vs PostgreSQL.
3. **STEP 3 — Critical Domains Authority Matrix**:
   - Established matrix across 18 domains in `plans/phase-db-source-of-truth-audit.md`.
4. **Data Reconciliation Matrix**:
   - Documented in `plans/phase-db-data-reconciliation-report.md`.
   - Reconciled counts: 14 active products, 54 branches, 57 customers, 125 orders, 19 CMS pages, 24 offers.
   - Identified empty `branch_inventory` in PostgreSQL requiring seed before checkout cutover.
5. **Inventory Service Architecture (`InventoryService`)**:
   - `deductStockAtomic()` implemented using conditional PostgreSQL `UPDATE` with `RETURNING ...`, preventing race conditions.
6. **Order Service Transactional Hardening (`OrderService`)**:
   - `createOrder()` now executes inside `dbTransaction`, atomically deducting stock, inserting order, and logging `order_status_history`.
   - `idempotency_key` check querying PostgreSQL `metadata->>'idempotency_key'` prevents duplicate charges and double deductions.
7. **Order Status Transactional Hardening (`OrderRepository.updateStatus`)**:
   - Implemented within `dbTransaction`, atomically updating order and inserting `order_status_history`.

---

## 3. Incomplete Work Discovered & Suspicious Partial Edits

1. **`branch_inventory` Seeding**:
   - `frontend/scripts/seed-branch-inventory.ts` exists but needs to be executed against PostgreSQL to ensure the 14 active products across 54 branches have stock in `branch_inventory`.
2. **Read Path Cutover in `frontend/src/app/api/v1/[...path]/route.ts`**:
   - Order creation (`POST /orders`) and order status update (`PUT /admin/orders/[id]/status`) were switched to `OrderService` / `OrderRepository`.
   - BUT storefront product search (`GET /products`), branches (`GET /branches`), and public CMS reads still have remaining calls to `ApiEngine` or need verification to ensure PostgreSQL is strictly authoritative with NO silent fallback to `memoryStore`.
   - Specifically, in `GET admin/orders`:
     ```typescript
     const paginatedResult = await OrderRepository.listOrders({ ... });
     if (paginatedResult && paginatedResult.items.length > 0) { ... }
     return jsonWithDataSource(ApiEngine.getAdminOrders(qParams), "postgres");
     ```
     This fallback to `ApiEngine.getAdminOrders()` when `paginatedResult` has 0 items must be eliminated! If the database returns 0 items for a page/filter, the API should return 0 items from postgres, NOT fallback to RAM.
3. **Tripwire & Verification Tests Execution**:
   - The test scripts (`test-inventory-concurrency.ts`, `test-order-idempotency.ts`, `test-command-center-consistency.ts`) have not yet been executed in this session to verify PostgreSQL live performance and concurrency.

---

## 4. Execution Resumption Plan

- **Phase 4**: Run `frontend/scripts/seed-branch-inventory.ts` to ensure PostgreSQL `branch_inventory` is populated with initial capacity.
- **Phase 5 & 22**: Run `frontend/scripts/test-inventory-concurrency.ts` to verify the inventory concurrency gate (10 concurrent requests for 1 stock -> 1 success, 9 insufficient stock, final stock 0).
- **Phase 5 & 14**: Run `frontend/scripts/test-order-idempotency.ts` to verify PostgreSQL-backed idempotency.
- **Phase 6 & 7**: Eliminate memory fallback in `admin/orders` route and run `frontend/scripts/test-command-center-consistency.ts`.
- **Phase 8**: Verify CMS PostgreSQL persistence with `frontend/scripts/test-cms-persistence-db.ts`.
- **Phase 9–14**: Verify Products, Branches, Customers, Deliveries, Reviews, Favorites DB-authoritative reads and writes.
- **Phase 17**: Ensure NO silent fallback to `memoryStore` on DB error across all endpoints.
- **Phase 35**: Run backend and frontend typecheck and build.
- **Phase 38**: Produce final evidence-based completion report.
