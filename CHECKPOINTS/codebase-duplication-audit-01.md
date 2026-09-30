# CODEBASE DUPLICATION AUDIT REPORT (CHECKPOINT 01)

**Repository:** `E:\vig\cakes2home-main\cakes2home-main`  
**Date:** 2026-09-21  
**Author:** Antigravity AI Engineering Suite  
**Scope:** Complete Codebase (Frontend, Backend, Repositories, Services, Data Layers, Server Actions, Hooks, Components)  
**Status:** AUDIT COMPLETE — AWAITING USER APPROVAL PRIOR TO SAFE REFACTORING

---

## EXECUTIVE SUMMARY

A systematic, full-codebase scan across 1,103 files in `frontend/src`, `backend/src`, and `scripts` was conducted to identify duplicate functions, classes, utilities, repeated math/algorithms, legacy mock files, and parallel feature implementations.

**Key Findings:**
1. **Total Duplicate Groups Discovered:** 9 Confirmed Groups.
2. **True Duplicates Identified for Safe Consolidation:** 9 Groups.
3. **Obsolete / Legacy Source Files to Remove:** 6 files (`customer-client.ts`, `customer-server.ts`, `actions/customer.ts`, `categories.ts`, `marketing-client.ts`, `orders-client.ts`).
4. **Root Cause of Legacy ID `res_01KXYMAHGFPRY1G9TZKEVGAGAT`:** Pinpointed to `frontend/src/lib/data/shops.ts` (lines 14 & 51) which hardcoded this fallback ID into `retrieveShop()`, leaking into `dashboard/shop/page.tsx`. Consolidating this to `BranchRepository` will permanently eliminate this defect.
5. **Dummy Order Fallback Defect:** Discovered in `orders-client.ts` and `orders.ts` (returning a mock order `total: 599`, `CTH-...-101` on API failure). Consolidating callers and removing this dummy fallback restores database authority.
6. **Intentionally Separate Domains Identified:** 5 Distinct Architecture Boundaries verified and preserved (Server vs Client Catalog, Server Actions vs Read Data, Manager vs Admin Reports, Physical Stock vs Made-to-Order Cake Readiness, CRM Reorder Outreach vs Storefront Popups).

---

## DETAILED DUPLICATE GROUPS

---

### DUPLICATE GROUP #1

**Category:** Exact / Mathematical Formula Duplication  
**Task:** Calculates great-circle distance between two GPS coordinates in kilometers using the Haversine formula.

#### IMPLEMENTATION A
- **File:** `frontend/src/lib/services/delivery.service.ts`
- **Function/class:** `DeliveryService.calculateDistance(lat1, lon1, lat2, lon2)`
- **Lines:** 44–53
- **Purpose:** Standardized utility for computing km distance between customer location and bakery branch.
- **Callers:** `OrderService.createOrder` (`frontend/src/lib/services/order.service.ts`), `checkoutAvailability` API routes.

#### IMPLEMENTATION B
- **File:** `frontend/src/lib/api-engine.ts`
- **Function/class:** `ApiEngine.calculateHaversineDistance(lat1, lon1, lat2, lon2)`
- **Lines:** 6642–6651
- **Purpose:** Method for great-circle distance calculation within ApiEngine.
- **Callers:** `reverseGeocode` (`frontend/src/lib/api-engine.ts:6678`).

#### OTHER IMPLEMENTATIONS:
- **File:** `frontend/src/lib/api-engine.ts`
- **Lines:** 6405–6412
- **Purpose:** Inlined math calculation inside delivery zone boundary evaluation loop instead of calling the class method.

#### BEHAVIOR COMPARISON:
- **Inputs:** `(lat1: number, lon1: number, lat2: number, lon2: number)`
- **Outputs:** Number (distance in kilometers).
- **Database behavior:** None (pure computation).
- **Side effects:** None.
- **Authorization:** Public / Unrestricted math function.
- **Branch scope:** None.
- **Customer scope:** None.
- **Errors:** None.
- **Transactions:** None.
- **Caching:** None.
- **Timing:** None.
- **Differences:** `DeliveryService.calculateDistance` rounds result with `Number((R * c).toFixed(2))`. `ApiEngine.calculateHaversineDistance` returns unrounded `R * c`. Inlined calculation at line 6405 duplicates the math variables `dLat`, `dLng`, `a`, `c`.

**TRUE DUPLICATE:** YES

**CANONICAL VERSION:** `DeliveryService.calculateDistance` in `frontend/src/lib/services/delivery.service.ts`

**WHY:** `DeliveryService` is the centralized domain service for all logistics calculations, already utilized by authoritative order checkout and Postgres queries.

**RISK:** LOW

**REFACTOR PLAN:**
1. Delegate `ApiEngine.calculateHaversineDistance` directly to `DeliveryService.calculateDistance`.
2. Replace inline duplicate math in `ApiEngine` line 6405 with call to canonical `DeliveryService.calculateDistance`.

---

### DUPLICATE GROUP #2

**Category:** Exact / File-Level Semantic Duplication  
**Task:** Retrieve order details by order ID from API and map to `OrderDetail` view model.

#### IMPLEMENTATION A
- **File:** `frontend/src/lib/data/orders.ts`
- **Function/class:** `getOrder(orderId: string): Promise<{ order: OrderDetail }>`
- **Lines:** 82–133
- **Purpose:** Storefront orders data layer fetching from `/orders`.
- **Callers:** Re-exported by `@frontend/lib/data`.

#### IMPLEMENTATION B
- **File:** `frontend/src/lib/data/orders-client.ts`
- **Function/class:** `clientGetOrder(orderId: string): Promise<{ order: OrderDetail }>`
- **Lines:** 8–59
- **Purpose:** Client-safe orders data layer.
- **Callers:**
  - `frontend/src/components/store/account/order-detail-client.tsx` (line 7)
  - `frontend/src/components/store/account/order-tracking-client.tsx` (line 7)

#### OTHER IMPLEMENTATIONS:
- `clientCancelOrder`, `clientRequestReschedule`, `clientAddOrderNote`, `clientDownloadInvoice` in `orders-client.ts` are exact mirrors of `cancelOrder`, `requestReschedule`, `addOrderNote`, `downloadInvoice` in `orders.ts`.
- Both implementations contain an identical anti-pattern: falling back to a hardcoded dummy order (`total_amount: 599`, `display_number: CTH-...-101`) when an API error occurs.

#### BEHAVIOR COMPARISON:
- **Inputs:** `(orderId: string)`
- **Outputs:** `{ order: OrderDetail }`
- **Database behavior:** Fetches from backend orders endpoint (`/api/v1/orders/[id]`).
- **Side effects:** None.
- **Authorization:** Customer session token.
- **Branch scope:** None.
- **Customer scope:** Authenticated customer.
- **Errors:** Handled via catch block, falling back to dummy order.
- **Transactions:** None (read-only).
- **Caching:** Default fetch behavior.
- **Timing:** None.
- **Differences:** Function names prefixed with `client*` in `orders-client.ts`. Function body is 100% identical character-for-character.

**TRUE DUPLICATE:** YES

**CANONICAL VERSION:** `frontend/src/lib/data/orders.ts` (with dummy fallback removed to maintain database authority)

**WHY:** `orders.ts` is the standard data layer file. Both `order-detail-client.tsx` and `order-tracking-client.tsx` ALREADY import types (`OrderDetail`, `TimelineEntry`) from `orders.ts`. Having a separate `orders-client.ts` with identical logic creates confusion and code drift.

**RISK:** LOW

**REFACTOR PLAN:**
1. Update `order-detail-client.tsx` and `order-tracking-client.tsx` to import `getOrder`, `cancelOrder`, `requestReschedule`, `addOrderNote`, and `downloadInvoice` directly from `@frontend/lib/data/orders`.
2. Remove dummy order fallback in `orders.ts` (throw error or return null on failure so UI displays actual error state rather than fake data).
3. Delete `frontend/src/lib/data/orders-client.ts`.

---

### DUPLICATE GROUP #3

**Category:** Semantic / Mock vs Authoritative Database Duplication  
**Task:** Customer address management (listing, creating, updating, deleting).

#### IMPLEMENTATION A
- **File:** `frontend/src/lib/data/customer-server.ts`
- **Function/class:** `listAddresses()`, `createAddress()`, `updateAddress()`, `deleteAddress()`
- **Lines:** 9–46
- **Purpose:** Legacy mock server data layer returning hardcoded address `addr_01` and customer `cus_9876543210`.
- **Callers:** `frontend/src/lib/actions/customer.ts` (only caller).

#### IMPLEMENTATION B
- **File:** `frontend/src/lib/actions/customer.ts`
- **Function/class:** `createAddressAction()`, `deleteAddressAction()`
- **Lines:** 6–12
- **Purpose:** Server action wrappers around `customer-server.ts`.
- **Callers:** None (0 callers across entire codebase).

#### OTHER IMPLEMENTATIONS:
- **Authoritative Canonical Implementation:** `CustomerRepository` (`frontend/src/lib/repositories/customer.repository.ts`) with real PostgreSQL queries to `customer_addresses` table, and `useAddresses` hook (`frontend/src/hooks/use-addresses.ts`) used by `frontend/src/components/store/account/address-manager.tsx`.

#### BEHAVIOR COMPARISON:
- **Inputs:** `AddressInput`
- **Outputs:** `CustomerAddress`
- **Database behavior:** Implementation A/B: None (returns hardcoded mock data). Canonical: PostgreSQL `customer_addresses` table.
- **Side effects:** None in mock.
- **Authorization:** Implementation A/B: None. Canonical: Customer session token.
- **Differences:** Implementation A & B are completely dead legacy mock files that bypassed PostgreSQL.

**TRUE DUPLICATE:** YES

**CANONICAL VERSION:** `CustomerRepository` (`frontend/src/lib/repositories/customer.repository.ts`) & `/api/customer/address`

**WHY:** The real customer address system is backed by PostgreSQL and managed by `useAddresses` and `CustomerRepository`. `customer-server.ts` and `actions/customer.ts` are dead mock leftovers.

**RISK:** LOW

**REFACTOR PLAN:**
1. Remove `export * from "./customer";` from `frontend/src/lib/actions/index.ts`.
2. Delete `frontend/src/lib/data/customer-server.ts`.
3. Delete `frontend/src/lib/actions/customer.ts`.

---

### DUPLICATE GROUP #4

**Category:** Semantic Duplication / Incomplete Legacy Subset  
**Task:** Customer OTP request and verification.

#### IMPLEMENTATION A
- **File:** `frontend/src/lib/data/customer-client.ts`
- **Function/class:** `requestOtp(phone)`, `verifyOtp(phone, otp)`
- **Lines:** 27–57
- **Purpose:** Client-safe customer OTP data layer.
- **Callers:** None (0 callers across entire codebase).

#### IMPLEMENTATION B
- **File:** `frontend/src/lib/data/customer.ts`
- **Function/class:** `requestOtp(phone)`, `verifyOtp(phone, otp, extra)`
- **Lines:** 104–171
- **Purpose:** Storefront customer data layer with role detection, timeout guards, and server-authoritative token validation.
- **Callers:**
  - `frontend/src/components/store/auth/otp-login-form.tsx`
  - `frontend/src/components/store/engagement/storefront-popup-modal.tsx`
  - Re-exported by `@frontend/lib/data`.

#### BEHAVIOR COMPARISON:
- **Inputs:** `(phone: string, otp: string)`
- **Outputs:** `OtpVerifyResponse`
- **Database behavior:** Calls backend `/api/v1/auth/otp/verify`.
- **Differences:** `customer-client.ts` is an older, incomplete subset of `customer.ts`. It lacks timeout protection (`Promise.race`), does not resolve `customer_uid`, does not handle staff/driver roles, and hardcodes `cus_9876543210` on error.

**TRUE DUPLICATE:** YES

**CANONICAL VERSION:** `frontend/src/lib/data/customer.ts`

**WHY:** `customer.ts` is the active, production-hardened implementation with 100% test coverage and active callers in the storefront.

**RISK:** LOW

**REFACTOR PLAN:**
1. Delete `frontend/src/lib/data/customer-client.ts`.

---

### DUPLICATE GROUP #5

**Category:** Semantic / Architecture Duplication & Defect Root Cause  
**Task:** Branch retrieval and shop data mapping.

#### IMPLEMENTATION A
- **File:** `frontend/src/lib/data/shops.ts`
- **Function/class:** `retrieveShop(shopId)`, `listShops()`, `retrieveShopByHandle(handle)`
- **Lines:** 8–52
- **Purpose:** Storefront shops data layer.
- **Callers:**
  - `frontend/src/app/dashboard/shop/page.tsx` (line 16)
  - `frontend/src/app/dashboard/shop/menu/page.tsx` (line 18)
  - Re-exported by `@frontend/lib/data`.

#### IMPLEMENTATION B
- **File:** `frontend/src/lib/repositories/branch.repository.ts` & `frontend/src/lib/data/branches.ts`
- **Function/class:** `BranchRepository.findById(branchId)`, `BranchRepository.findActive()`, `listBranches()`
- **Lines:** `branch.repository.ts:65–110`, `branches.ts:7–14`
- **Purpose:** Authoritative PostgreSQL branch queries mapping to `BranchDomain`.
- **Callers:** All core storefront, API routes, and manager dashboards.

#### OTHER IMPLEMENTATIONS & DEFECT ROOT CAUSE:
- In `frontend/src/lib/data/shops.ts` line 14 & line 51:
  `id: branch?.id || shopId || "res_01KXYMAHGFPRY1G9TZKEVGAGAT"`
  `return retrieveShop(found?.id || "res_01KXYMAHGFPRY1G9TZKEVGAGAT");`
  This is the EXACT source of the hardcoded legacy branch ID `"res_01KXYMAHGFPRY1G9TZKEVGAGAT"`.
- In `frontend/src/app/dashboard/shop/page.tsx`:
  - Line 11 used unsafe substring matching: `!user.id?.includes("shpmgr_") && !user.id?.includes("admin_") && !user.id?.includes("mgr_")`.
  - Line 15 passed the hardcoded fallback `"res_01KXY..."` to `retrieveShop(shopId)`.
  - Line 20 passed `initialShop={shop}` to `BranchOperationsManager`, which completely ignores `initialShop` and loads its own live data via `fetchBranchDashboard()`.

#### BEHAVIOR COMPARISON:
- **Inputs:** `(shopId: string)`
- **Outputs:** `ShopDTO` vs `BranchDomain`
- **Database behavior:** Implementation A calls `ApiEngine.resolveBranchRecord` and creates dummy product/variant DTOs. Implementation B queries PostgreSQL database directly.
- **Differences:** Implementation A introduces synthetic DTOs and hardcoded fallback IDs.

**TRUE DUPLICATE:** YES

**CANONICAL VERSION:** `BranchRepository` (`frontend/src/lib/repositories/branch.repository.ts`) / `frontend/src/lib/data/branches.ts`

**WHY:** PostgreSQL database is authoritative for all branches. `shops.ts` was an obsolete Medusa Eats leftover that injected artificial branch IDs.

**RISK:** MEDIUM (High impact on fixing the legacy branch ID defect).

**REFACTOR PLAN:**
1. In `frontend/src/app/dashboard/shop/page.tsx`:
   - Enforce canonical role verification: `if (!user || (user.role !== "BRANCH_MANAGER" && user.role !== "SUPER_ADMIN")) redirect("/login");`.
   - Remove redundant `retrieveShop` call.
   - Render `<BranchOperationsManager />` cleanly.
2. In `frontend/src/app/dashboard/shop/menu/page.tsx`:
   - Replace `retrieveShop(shopId)` with `BranchRepository.findById(shopId)`.
3. Remove `export * from "./shops";` from `frontend/src/lib/data/index.ts`.
4. Delete `frontend/src/lib/data/shops.ts`.

---

### DUPLICATE GROUP #6

**Category:** Mock vs Real PostgreSQL Duplication  
**Task:** List product categories.

#### IMPLEMENTATION A
- **File:** `frontend/src/lib/data/categories.ts`
- **Function/class:** `listCategories()`
- **Lines:** 7–13
- **Purpose:** Hardcoded mock category list (Chocolate Cakes, Gourmet Cheesecakes, Photo Cakes).
- **Callers:** `frontend/src/app/dashboard/shop/menu/page.tsx` (line 19).

#### IMPLEMENTATION B
- **File:** `frontend/src/lib/api-engine.ts` & `frontend/src/lib/repositories/product.repository.ts`
- **Function/class:** `ApiEngine.getCategories()`, `ProductRepository.findAllCategories()`
- **Lines:** `api-engine.ts:6064`, `product.repository.ts:712–745`
- **Purpose:** Authoritative category listing from database/catalog.
- **Callers:** `sitemap.ts`, Storefront Catalog, Search.

#### BEHAVIOR COMPARISON:
- **Inputs:** None.
- **Outputs:** Array of categories.
- **Database behavior:** Implementation A returns 3 hardcoded static objects. Implementation B queries the real product categories.
- **Differences:** Implementation A is completely static mock data.

**TRUE DUPLICATE:** YES

**CANONICAL VERSION:** `ApiEngine.getCategories()` / `ProductRepository.findAllCategories()`

**WHY:** The application has real product categories in PostgreSQL. Hardcoded categories in `categories.ts` cause inconsistencies in the shop menu manager.

**RISK:** LOW

**REFACTOR PLAN:**
1. Update `frontend/src/app/dashboard/shop/menu/page.tsx` to load categories via `ApiEngine.getCategories()`.
2. Remove `export * from "./categories";` from `frontend/src/lib/data/index.ts`.
3. Delete `frontend/src/lib/data/categories.ts`.

---

### DUPLICATE GROUP #7

**Category:** Mock vs Real Duplication  
**Task:** List and retrieve marketing campaigns.

#### IMPLEMENTATION A
- **File:** `frontend/src/lib/data/marketing-client.ts`
- **Function/class:** `clientListPublicCampaigns()`, `clientGetPublicCampaign(id)`
- **Lines:** 7–13
- **Purpose:** Stub client-safe data layer returning empty campaigns.
- **Callers:** None (0 callers across entire codebase).

#### IMPLEMENTATION B
- **File:** `frontend/src/lib/data/marketing.ts`
- **Function/class:** `listPublicCampaigns()`, `getPublicCampaign(id)`
- **Lines:** 23–51
- **Purpose:** Real storefront marketing campaigns data layer.
- **Callers:**
  - `frontend/src/app/(store)/campaigns/page.tsx`
  - `frontend/src/app/(store)/campaigns/[id]/page.tsx`

#### BEHAVIOR COMPARISON:
- **Inputs:** `(opts?: { featured?: boolean; limit?: number })`
- **Outputs:** `{ campaigns: PublicCampaign[]; count: number }`
- **Differences:** `marketing-client.ts` has dummy stub functions with no logic and 0 callers.

**TRUE DUPLICATE:** YES

**CANONICAL VERSION:** `frontend/src/lib/data/marketing.ts`

**WHY:** `marketing.ts` is the active data layer used by the campaign storefront pages.

**RISK:** LOW

**REFACTOR PLAN:**
1. Remove `export * from "./marketing-client";` from `frontend/src/lib/data/index.ts`.
2. Delete `frontend/src/lib/data/marketing-client.ts`.

---

### DUPLICATE GROUP #8

**Category:** Wrapper / Passthrough Duplication  
**Task:** Retrieve branch delivery slots for a given date.

#### IMPLEMENTATION A
- **File:** `frontend/src/lib/actions/deliveries.ts`
- **Function/class:** `getDeliverySlotsAction(branchId, date)`
- **Lines:** 115–117
- **Purpose:** Server Action wrapper calling `getDeliverySlots`.
- **Callers:** None (0 callers across entire codebase).

#### IMPLEMENTATION B
- **File:** `frontend/src/lib/data/deliveries.ts`
- **Function/class:** `getDeliverySlots(branchId, date, mode)`
- **Lines:** 361–378
- **Purpose:** Fetches delivery slots from `/api/v1/branches?type=slots`.
- **Callers:** Storefront coverage map, checkout components.

#### IMPLEMENTATION C (Authoritative Engine):
- **File:** `frontend/src/lib/api-engine.ts`
- **Function/class:** `ApiEngine.getDeliverySlots(branchId, date, mode, options)`
- **Lines:** 22974+
- **Purpose:** Authoritative slot calculation based on branch operating hours, cutoff times, paused states, and capacities.
- **Callers:** All API slot endpoints.

#### BEHAVIOR COMPARISON:
- **Differences:** `getDeliverySlotsAction` in `actions/deliveries.ts` is an unused 2-line wrapper.

**TRUE DUPLICATE:** YES

**CANONICAL VERSION:** `ApiEngine.getDeliverySlots` (Backend engine) & `getDeliverySlots` in `frontend/src/lib/data/deliveries.ts` (Client fetcher)

**WHY:** Direct data fetcher is used across the frontend. The wrapper in server actions is uncalled dead code.

**RISK:** LOW

**REFACTOR PLAN:**
1. Remove `getDeliverySlotsAction` from `frontend/src/lib/actions/deliveries.ts`.

---

### DUPLICATE GROUP #9

**Category:** Obsolete Utility Duplication  
**Task:** Decrypting / verifying JWT session token.

#### IMPLEMENTATION A
- **File:** `frontend/src/lib/data/sessions.ts`
- **Function/class:** `decrypt(session)`
- **Lines:** 58–68
- **Purpose:** Decrypt session using `jose.jwtVerify`.
- **Callers:** None (0 callers across entire codebase).

#### IMPLEMENTATION B (Security Remediation Canonical):
- **File:** `frontend/src/lib/security/auth-session.ts`
- **Function/class:** `verifySessionToken(token)`
- **Lines:** 133–180
- **Purpose:** Server-side HMAC-SHA256 signature verification, timing-safe equality, expiration validation, and session registry fallback.
- **Callers:** All API routes, middleware, and authentication guards.

#### BEHAVIOR COMPARISON:
- **Differences:** Implementation A is an incomplete, uncalled helper. Implementation B is the production-hardened, fail-closed security engine.

**TRUE DUPLICATE:** YES

**CANONICAL VERSION:** `frontend/src/lib/security/auth-session.ts:verifySessionToken`

**WHY:** Preservation of security remediation. All token verification must follow the fail-closed canonical implementation.

**RISK:** LOW (Security improvement).

**REFACTOR PLAN:**
1. Remove dead `decrypt` function from `frontend/src/lib/data/sessions.ts`.

---

## 5 ARCHITECTURAL DOMAINS INTENTIONALLY KEPT SEPARATE

The following implementations were audited and verified as **INTENTIONALLY SEPARATE** due to distinct architectural boundaries:

1. **Catalog Server Data vs Client Comparison:**
   - Files: `frontend/src/lib/data/catalog.ts` vs `frontend/src/lib/data/catalog-client.ts`
   - Purpose: `catalog.ts` handles server-authoritative database queries with cookies and headers. `catalog-client.ts` handles pure client-side browser `localStorage` comparison (`cth_compare`).
   - Rationale: Must remain separate to avoid pulling Node.js/Next.js server dependencies into client-rendered UI components.

2. **Cart Mutations (Server Actions) vs Cart Fetching (Data Layer):**
   - Files: `frontend/src/lib/actions/carts.ts` vs `frontend/src/lib/data/carts.ts`
   - Purpose: `actions/carts.ts` contains Next.js Server Actions that mutate HTTP cookies and revalidate Next.js cache tags (`revalidateTag("carts")`). `data/carts.ts` contains idempotent read-only cart retrieval (`retrieveCart`).
   - Rationale: Separation of read vs write lifecycles and cache revalidation semantics.

3. **Branch Manager Reports vs Super Admin Enterprise Reports:**
   - Files: `fetchBranchReports` in `lib/data/manager.ts` vs `EnterpriseReportsEngine` in `enterprise-reports-engine.tsx`
   - Purpose: Manager reports are strictly scoped to the authenticated manager's own branch (`manager branch isolation`). Admin enterprise reports aggregate metrics across all branches.
   - Rationale: Preserves strict RBAC and multi-tenant security boundaries.

4. **Physical Accessory Stock (Model A) vs Cake Kitchen Readiness (Model B):**
   - Files: `InventoryService.getAvailableStock` vs `branch.metadata.product_availability`
   - Purpose: Physical candles and toppers maintain exact integer stock quantities in `branch_inventory`. Artisanal made-to-order cakes maintain kitchen operational status (AVAILABLE / UNAVAILABLE / OFF).
   - Rationale: Fundamental business rule differentiation between physical goods and made-to-order perishable bakery items.

5. **Telemarketing Reorder Intelligence vs Storefront Marketing Popups:**
   - Files: `frontend/src/lib/telemarketing-engine.ts` vs `frontend/src/lib/data/marketing.ts`
   - Purpose: `telemarketing-engine.ts` runs deterministic 5-signal customer scoring (0–100) on completed order history for internal staff phone/WhatsApp re-engagement. `marketing.ts` serves storefront visitor promotional discount banners.
   - Rationale: Completely separate user roles, operational workflows, and security contexts.

---

## SUMMARY OF FILES TO BE REMOVED (POST-APPROVAL)

Only obsolete, dead, or fully consolidated duplicate source files will be deleted:
1. `frontend/src/lib/data/customer-client.ts` (Dead duplicate of `customer.ts`)
2. `frontend/src/lib/data/customer-server.ts` (Dead mock duplicate of `CustomerRepository`)
3. `frontend/src/lib/actions/customer.ts` (Dead wrapper around `customer-server.ts`)
4. `frontend/src/lib/data/categories.ts` (Dead mock duplicate of `ApiEngine.getCategories`)
5. `frontend/src/lib/data/marketing-client.ts` (Dead stub duplicate of `marketing.ts`)
6. `frontend/src/lib/data/orders-client.ts` (Exact duplicate of `orders.ts`)
7. `frontend/src/lib/data/shops.ts` (Obsolete legacy file and root cause of fallback `res_01KXY...`)
