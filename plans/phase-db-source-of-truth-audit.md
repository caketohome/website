# Forensic Database Connectivity & Source-of-Truth Repository Audit

**Repository:** CakeToHome Platform  
**Target Database:** PostgreSQL 15 (Supabase Pooler: `aws-1-ap-south-1.pooler.supabase.com:6543/postgres`)  
**Audit Date:** September 7, 2026  
**Auditor:** Antigravity Lead Production Systems Engineer  
**Document Code:** `CTH-AUDIT-DB-SOT-01`  
**Classification:** CRITICAL SYSTEM REMEDIATION REPORT  

---

## 1. Executive Summary & Root Cause

A forensic audit of the CakeToHome runtime architecture was conducted to establish why PostgreSQL is not functioning as the live single authoritative source of truth.

### Root Cause Analysis
1. **Startup Hydration Singleton (`(globalThis).__CTH_MEMORY_STORE__`):**  
   At process boot, `hydrateStoreFromDatabase()` in `frontend/src/lib/db-persistence.ts` loads snapshots of branches, products, customers, orders, CMS pages, delivery partners, and offers into an in-memory singleton stored in `(globalThis).__CTH_MEMORY_STORE__`.
2. **Runtime Memory Reads:**  
   Primary storefront and admin routes in `frontend/src/app/api/v1/[...path]/route.ts` and `frontend/src/app/api/v1/branches/route.ts` route their requests directly to `ApiEngine` methods (`searchProducts`, `listBranches`, `getCmsPage`, `getAdminOrders`, etc.), which query the in-memory store in RAM rather than executing live SQL against PostgreSQL.
3. **Data Source Masking:**  
   The helper `jsonWithDataSource(payload, "postgres")` systematically attaches `X-Data-Source: postgres` and `storage: "postgres"` to HTTP responses, even when data originated 100% from RAM.
4. **Fire-and-Forget Mutations:**  
   Critical write paths (such as `ApiEngine.createOrder` and `ApiEngine.updateOrderStatus`) mutate `memoryStore` synchronously, respond to the client with HTTP 200/201, and dispatch unawaited background promises (`persistOrderToDb(...).catch(...)`), introducing data loss windows on process crashes and race conditions across multiple server instances.
5. **Inventory Emptiness in Database:**  
   While the PostgreSQL table `branch_inventory` exists with proper indices, it contains 0 rows. All inventory availability and deduction logic currently operates in RAM or on product metadata.

---

## 2. Classification of Memory References

Every significant reference to `memoryStore` / `(globalThis).__CTH_MEMORY_STORE__` across the repository has been audited and classified according to the mandated categories:

- **A. AUTHORITATIVE BUSINESS DATA** (Must be migrated to direct PostgreSQL reads/writes)
- **B. TEMPORARY REQUEST STATE** (Legitimate in-memory, request-scoped)
- **C. DERIVED STATE** (Computed values calculated on the fly from authoritative data)
- **D. CACHE** (Read-through / cache-aside, explicitly invalidated on writes)
- **E. TEST FIXTURE** (Used strictly in automated unit/integration tests)
- **F. CONFIGURATION** (Immutable environment constants, feature flags)
- **G. UNKNOWN** (Investigated and resolved)

| Component / File Path | Reference | Current Classification | Architectural Remediation Action |
| :--- | :--- | :--- | :--- |
| `frontend/src/lib/api-engine.ts:4863` | `memoryStore.products` | **A. AUTHORITATIVE BUSINESS DATA** | Route to `ProductRepository.listProducts` / `findById` with PostgreSQL parameterized queries. |
| `frontend/src/lib/api-engine.ts:4863` | `memoryStore.branches` | **A. AUTHORITATIVE BUSINESS DATA** | Route to `BranchRepository.findAll` / `findById` querying `branch` table. |
| `frontend/src/lib/api-engine.ts:4863` | `memoryStore.orders` | **A. AUTHORITATIVE BUSINESS DATA** | Route to `OrderRepository.listOrders` / `findById` / `save` transactionally in PostgreSQL. |
| `frontend/src/lib/api-engine.ts:4863` | `memoryStore.customers` | **A. AUTHORITATIVE BUSINESS DATA** | Route to `CustomerRepository.listCustomers` / `findById` querying `customer` + `customer_address`. |
| `frontend/src/lib/api-engine.ts:4863` | `memoryStore.cms_pages` | **A. AUTHORITATIVE BUSINESS DATA** | Route to `CmsRepository.findAllPages` / `findPageBySlug` / `savePage` querying `cms_page`. |
| `frontend/src/lib/api-engine.ts:4863` | `memoryStore.offers` | **A. AUTHORITATIVE BUSINESS DATA** | Route to `OfferRepository.findAll` / `findByCode` querying `offer` table. |
| `frontend/src/lib/api-engine.ts:4863` | `memoryStore.delivery_partners` | **A. AUTHORITATIVE BUSINESS DATA** | Route to `delivery_partner` table in PostgreSQL. |
| `frontend/src/lib/api-engine.ts:4863` | `memoryStore.customer_favorites` | **A. AUTHORITATIVE BUSINESS DATA** | Route to `FavoriteRepository` querying `customer_favorite` table in PostgreSQL. |
| `frontend/src/lib/api-engine.ts:4863` | `memoryStore.product_reviews` | **A. AUTHORITATIVE BUSINESS DATA** | Route to `ReviewRepository` querying `product_review` table in PostgreSQL. |
| `frontend/src/lib/api-engine.ts:22784` | `persistOrderToDb(newOrd).catch(...)` | **A. AUTHORITATIVE BUSINESS DATA** | Eliminate fire-and-forget; await PostgreSQL transaction commit before returning HTTP 201. |
| `frontend/src/lib/api-engine.ts:24384` | `persistOrderToDb(order).catch(...)` | **A. AUTHORITATIVE BUSINESS DATA** | Eliminate fire-and-forget; await status update commit before returning HTTP 200. |
| `frontend/src/lib/fulfillment/api-engine-provider.ts:45` | `memoryStore.otp_records` | **B. TEMPORARY REQUEST STATE** | 5-minute ephemeral delivery OTP verification tokens. Safe in process memory / Redis. |
| `frontend/src/lib/fulfillment/api-engine-provider.ts:72` | `memoryStore.rider_presence` | **B. TEMPORARY REQUEST STATE** | Heartbeat live presence for active couriers. |
| `frontend/src/lib/api-engine.ts:3428` | `memoryStore.cart_sessions` | **B. TEMPORARY REQUEST STATE** | Active browser checkout sessions prior to durable order submission. |
| `frontend/src/lib/api-engine.ts:7321` | `p.branch_status`, `is_out_of_stock_at_branch` | **C. DERIVED STATE** | Computed from `branch_inventory.quantity - branch_inventory.reserved`. |
| `frontend/src/lib/api-engine.ts:14980` | `accessory_inventory` | **A. AUTHORITATIVE BUSINESS DATA** | Persist physical inventory counts to PostgreSQL `branch_inventory`. |
| `frontend/src/lib/api-engine.ts:4877` | `_dbHydrationStatus` / `_hydrationPromise` | **F. CONFIGURATION** | Startup health probe status. |
| `frontend/src/lib/fulfillment/api-engine-provider.ts:47` | `DEFAULT_GLOBAL_FULFILLMENT_CONFIG` | **F. CONFIGURATION** | Hardcoded bakery operational default settings. |
| `frontend/src/lib/api-engine.ts:2354` | `DEFAULT_STATES`, `DEFAULT_REGIONS` | **F. CONFIGURATION** | Static fallback geographical constants. |

---

## 3. Domain Authority Matrix

| Domain | Current Read Source | Current Write Source | PostgreSQL Table | Target Source | Concurrency / Data Risk |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Products** | `memoryStore.products` | `ApiEngine` | `product`, `product_variant` | `ProductRepository` | Medium (stale pricing, out of stock visibility) |
| **Product Variants** | `memoryStore.variant_options` | `ApiEngine` | `variant_option` | PostgreSQL Direct | Low (catalog option management) |
| **Inventory** | `memoryStore` / None (0 rows) | Memory mutation | `branch_inventory` | Atomic DB UPDATE / `SELECT FOR UPDATE` | **CRITICAL SEV-1** (Overselling, race conditions) |
| **Branches** | `memoryStore.branches` | `persistBranchToDb` | `branch`, `delivery_zone` | `BranchRepository` | High (store closures ignored, route leakage) |
| **Customers** | `memoryStore.customers` | `ApiEngine` | `customer`, `customer_address` | `CustomerRepository` | High (customer address updates lost) |
| **Orders (List)** | Hybrid / fallback `memoryStore` | `persistOrderToDb` (async) | `order` | `OrderRepository.listOrders` | **CRITICAL SEV-1** (List/detail discrepancy) |
| **Orders (Detail)** | `OrderRepository.findById` (DB) | `persistOrderToDb` (async) | `order` | `OrderRepository.findById` | High (async write lag before visibility) |
| **Order Status** | `memoryStore.orders` | `persistOrderToDb` (async) | `order`, `order_status_history` | Transactional DB Update | **CRITICAL SEV-1** (Lost status transitions) |
| **Payments** | Medusa / Razorpay / Memory | Memory + Webhook | `payment`, `order_transaction` | PostgreSQL Awaited | High (payment captured but order lost) |
| **Deliveries** | `memoryStore.delivery_partners` | Memory | `delivery_partner`, `delivery_slot` | PostgreSQL Direct | High (driver assignment mismatch) |
| **Delivery Zones** | `memoryStore.delivery_zones` | `persistBranchToDb` | `delivery_zone` | `BranchRepository.findAll` | High (serviceability errors) |
| **Reviews** | `memoryStore.product_reviews` | Memory | `product_review` | `ReviewRepository` | Medium (lost customer reviews) |
| **Favorites** | `memoryStore.customer_favorites`| Memory | `customer_favorite` | `FavoriteRepository` | Medium (lost customer favorites) |
| **Offers / Coupons**| `memoryStore.offers` | `ApiEngine` | `offer`, `offer_redemption` | `OfferRepository` | High (coupon redemption budget overflow) |
| **CMS Pages** | `memoryStore.cms_pages` | `persistCmsPageToDb` (DB) | `cms_page` | `CmsRepository` | High (DB changes invisible until restart) |
| **Homepage Sections**| `memoryStore.homepage_sections`| `persistCmsPageToDb` | `cms_homepage_section` | PostgreSQL Direct | High (layout divergence) |
| **Settings** | `memoryStore.settings` | `persistSettingToDb` | `setting` | `SettingRepository` | Medium (store configuration drift) |
| **Reports / Admin** | `ApiEngine` RAM aggregates | Memory | Aggregate SQL (`COUNT`, `SUM`) | PostgreSQL SQL Aggregations | Medium (inaccurate financial metrics) |

---

## 4. Key Architectural Flaws Identified

### Flaw 1: The Order Fallback Split in Command Center
In `frontend/src/app/api/v1/[...path]/route.ts`:
```typescript
const paginatedResult = await OrderRepository.listOrders({ ... });
if (paginatedResult && paginatedResult.items.length > 0) {
  return jsonWithDataSource({ orders: paginatedResult.items, ... }, "postgres");
}
return jsonWithDataSource(ApiEngine.getAdminOrders(qParams), "postgres");
```
When `listOrders` returns 0 items for any filter or empty page, the API immediately falls back to `ApiEngine.getAdminOrders()`. Meanwhile, `GET /api/v1/admin/orders/[id]` queries `OrderRepository.findById(id)`. This creates a split-brain architecture where list and detail views see different states.

### Flaw 2: Fire-and-Forget Persistence on Order Creation
In `ApiEngine.createOrder`:
```typescript
memoryStore.orders.unshift(newOrd);
saveStore(memoryStore);
persistOrderToDb(newOrd).catch((err) => {
  console.error("[ApiEngine] Failed to persist new order to PostgreSQL:", err);
});
```
The client receives HTTP 201 as soon as `memoryStore` is modified. If PostgreSQL is undergoing a temporary failover or the connection times out, the user receives an order confirmation, but the database never records the order.

### Flaw 3: In-Memory Inventory with Empty Database Table
`public.branch_inventory` exists in PostgreSQL with full index coverage (`IDX_branch_inventory_branch_variant`), but contains 0 rows. Inventory checks operate against `memoryStore.products[].stock` or `branch_availability` in memory. Concurrent requests can oversell products without row locking.

---

## 5. Audit Sign-Off
All 18 domains have been audited. No references remain classified as `UNKNOWN`.
Data reconciliation and phased remediation plans follow in `plans/phase-db-data-reconciliation-report.md`.
