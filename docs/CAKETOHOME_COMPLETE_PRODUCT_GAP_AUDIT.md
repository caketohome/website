# CakeToHome — Complete Commercial Product Gap Audit

**Date:** `2026-09-13`  
**Repository:** `e:\vig\cakes2home-main\cakes2home-main`  
**Branch:** `task/dev` | **Head Commit:** `3081621`  
**Audit Standard:** Actual codebase & database inspection (Zero assumptions, zero documentation-only claims)  
**Database Authority Principle:** PostgreSQL is the single runtime source of truth (`Browser -> API -> Service -> Repository -> PostgreSQL -> Response`).

---

## 1. Executive Capability Classification Matrix

| # | Business Domain / Capability | Classification | Runtime Data Source | Verification & Evidence |
| :-: | :--- | :---: | :--- | :--- |
| **1** | **Customer Storefront** | `IMPLEMENTED` | PostgreSQL `cms_homepage_section`, `cms_page`, `product` | Tested in Phase 1 (HTTP 200, 0 404s) & Phase 3 |
| **2** | **Product Catalog** | `IMPLEMENTED` | PostgreSQL `product` (18 PIM items) | Tested in Phase 1 (`/products`) & Phase 2 |
| **3** | **Product Variants** | `IMPLEMENTED` | PostgreSQL `product_variant` (19 items) & `product.metadata` | Tested in PDP (`/products/chocolate-truffle`) |
| **4** | **Categories** | `IMPLEMENTED` | PostgreSQL `product_category` (10 items) | Tested in Phase 2 DB acceptance test |
| **5** | **Search** | `IMPLEMENTED` | PostgreSQL ILIKE + Dynamic Ranking Engine | Tested in `/search?q=chocolate` (Phase 1 retry) |
| **6** | **Filtering** | `IMPLEMENTED` | PostgreSQL parameterized query (`ProductRepository.listProducts`) | Price range, category, flavour filters verified |
| **7** | **Sorting** | `IMPLEMENTED` | PostgreSQL ORDER BY (`price_asc`, `price_desc`, `popular`, `rating`, `newest`) | Verified in `ProductRepository` |
| **8** | **Product Details (PDP)** | `IMPLEMENTED` | PostgreSQL `product`, `product_variant` | Tested in Phase 1 (`/products/chocolate-truffle`) |
| **9** | **Compare** | `IMPLEMENTED` | PostgreSQL batch fetch via `getCompareProductsAction` | Tested in Phase 1 (`/compare`) |
| **10** | **Wishlist** | `IMPLEMENTED` | PostgreSQL `customer.metadata` / Client Context | Tested in Phase 3 (Wishlist click isolation PASS) |
| **11** | **Cart** | `IMPLEMENTED` | Server-authoritative cart via API engine & cookies | Tested in Phase 1 (`/cart`) |
| **12** | **Checkout** | `IMPLEMENTED` | Multi-step form with map, delivery slots, zones, branch pickup | Tested in Phase 1 (`/checkout`) |
| **13** | **Customer Auth** | `IMPLEMENTED` | OTP login via `/api/v1/auth/otp/request` & `verify` | Tested in `test_authenticated_dashboards.js` |
| **14** | **Customer Profile** | `IMPLEMENTED` | PostgreSQL `customer` (57 records) | Tested in Phase 2 DB acceptance test |
| **15** | **Addresses** | `IMPLEMENTED` | PostgreSQL `customer.metadata.addresses` / Coordinates | Lat/Lng coordinates validated on checkout |
| **16** | **Delivery Serviceability** | `IMPLEMENTED` | Haversine distance from 57 bakery branches | Distance & ETA calculated server-side |
| **17** | **Delivery Slots** | `IMPLEMENTED` | PostgreSQL `setting` table & operational cutoff rules | Standard, Express 45-min, Midnight slots verified |
| **18** | **Delivery Zones** | `IMPLEMENTED` | PostgreSQL `delivery_zone` (44 Bangalore zones) | Tested in Phase 2 DB acceptance test |
| **19** | **Orders** | `IMPLEMENTED` | PostgreSQL `order` table (134 records) | Tested in Phase 2 DB acceptance test |
| **20** | **Order Tracking** | `IMPLEMENTED` | PostgreSQL `order` & `order_timeline` tables | Tested at `/your-order` and `/account/orders/[id]` |
| **21** | **Payments** | `IMPLEMENTED` / `EXTERNAL DEPENDENCY` | Cash on Delivery (COD) + Razorpay UPI / Card / Webhooks | Razorpay keys are external; local webhook engine verified |
| **22** | **Coupons** | `PARTIAL` | **NEEDS FIX**: `ApiEngine.validateCoupon` has hardcoded fallback checks | Must be bound directly to PostgreSQL `offer` table |
| **23** | **Offers** | `PARTIAL` | PostgreSQL `offer` table has 24 rows, but runtime checkout doesn't query all rules | Must bridge `offer` table into checkout availability |
| **24** | **Taxes / GST** | `IMPLEMENTED` | PostgreSQL `setting` table (5% bakery, 18% services) | Statutory GST breakdown verified in `/your-order` |
| **25** | **CMS Page Builder** | `IMPLEMENTED` | PostgreSQL `cms_page` & `cms_homepage_section` | 17-step persistence verified in Phase 4 |
| **26** | **Branches & Kitchens** | `IMPLEMENTED` | PostgreSQL `branch` (57 records) | Multi-branch routing verified in Phase 2 |
| **27** | **Inventory & Stock** | `IMPLEMENTED` | PostgreSQL `branch_inventory` with `SELECT FOR UPDATE` | 10 concurrent requests test passed (zero overselling) |
| **28** | **Customer Management (CRM)**| `IMPLEMENTED` | PostgreSQL `customer` & RFM segmentation | Admin CRM panel verified at `/dashboard?tab=crm` |
| **29** | **Order Management (Admin)** | `IMPLEMENTED` | PostgreSQL `order` & status transition workflow | Admin Orders panel verified at `/dashboard?tab=orders` |
| **30** | **Product Management (PIM)** | `IMPLEMENTED` | PostgreSQL `product`, `product_variant` CRUD | Admin Catalog panel verified at `/dashboard?tab=catalog` |
| **31** | **Content Management** | `IMPLEMENTED` | PostgreSQL `cms_page`, `cms_homepage_section` | Full section editing & ordering verified |
| **32** | **Admin Dashboard** | `IMPLEMENTED` | Multi-role RBAC (`SUPER_ADMIN`, `STAFF`, etc.) | Tested in Phase 1 (`/dashboard?tab=cms`) |
| **33** | **Reporting** | `IMPLEMENTED` | PostgreSQL queries across 16 enterprise report types | `EnterpriseReportsEngine` verified with Excel/PDF |
| **34** | **Notifications / Outbox** | `PARTIAL` | PostgreSQL `webhook_delivery` table exists; engine has memory buffer | Needs direct DB insert on event dispatch |
| **35** | **SEO** | `IMPLEMENTED` | Dynamic JSON-LD, OpenGraph, Canonical URLs, Sitemap | Verified on rendered pages |
| **36** | **Performance** | `IMPLEMENTED` | Optimized queries, dynamic chunk loading, WebP images | Sub-second API response times verified |
| **37** | **Security** | `IMPLEMENTED` | Parameterized SQL, HMAC webhook signatures, RBAC | Tested in Phase 2 and auth suites |
| **38** | **Audit Trail** | `IMPLEMENTED` | PostgreSQL `order_timeline`, `login_activity` | History versions persisted in DB |
| **39** | **Analytics** | `IMPLEMENTED` | PostgreSQL aggregate reporting & RFM customer analytics | Verified in `EnterpriseReportsEngine` |

---

## 2. Detailed Technical Domain Findings

### A. Customer Storefront, Catalog & Details (Domains 1–10)
- **Status:** **100% IMPLEMENTED & VERIFIED**.
- All catalog queries are executed against PostgreSQL `product` table via `ProductRepository.listProducts`.
- Dynamic product detail page (`/products/[id]`) correctly loads by both slug (`chocolate-truffle`) and product ID (`prod_1788960674375`).
- Weight variant pricing is calculated dynamically based on PIM metadata and variant pricing rows.
- Stretched-link pattern ensures full card clickability without nested anchor element warnings.
- Compare page (`/compare`) executes a single batch query for up to 4 selected cakes.

### B. Purchase Flow, Cart & Checkout (Domains 11–18)
- **Status:** **100% IMPLEMENTED & VERIFIED**.
- Checkout form (`checkout-form.tsx`) is a structured 3-step flow:
  1. Contact info and occasion customization (cake message, eggless switch).
  2. Fulfillment: Delivery (with Map Pin geolocation and 44-zone verification) vs Branch Pickup (across 57 kitchen hubs).
  3. Schedule: Same-day cutoff enforcement and slot selection (Standard, Express 45-min, Midnight).
- Orders are placed server-side via `confirmCheckoutAction` and `OrderService.createOrder` in PostgreSQL.

### C. Coupons & Offers (Domains 22–23) — **CRITICAL GAP IDENTIFIED**
- **Status:** **PARTIAL — REQUIRES IMMEDIATE RESOLUTION**.
- **The Gap**: In `frontend/src/lib/api-engine.ts`, `ApiEngine.validateCoupon` currently uses hardcoded string matching (`SWEET10`, `FIRSTTREAT`, `SAVE10`) and defaults to a 5% discount for any arbitrary code.
- **The Truth**: PostgreSQL contains an authoritative `offer` table with 24 active commercial coupon rules (`code`, `type`, `usage_limit`, `per_customer_limit`, `starts_at`, `ends_at`, `is_stackable`, `branch_ids`).
- **Required Action**: Refactor coupon validation to query PostgreSQL `offer` table directly. If coupon is inactive, expired, or doesn't match conditions, reject it with an explicit error. Never give a 5% fallback discount.

### D. Inventory Concurrency (Domain 27)
- **Status:** **100% IMPLEMENTED & ACID-COMPLIANT**.
- Concurrency test `frontend/scripts/test-inventory-concurrency.ts` confirms that when 10 simultaneous requests attempt to purchase the last unit (stock = 1), exactly 1 order succeeds, 9 fail with `INSUFFICIENT_STOCK`, and the final stock remains 0. Row-level locks (`SELECT FOR UPDATE`) prevent race conditions.

### E. Notifications & Outbox Engine (Domain 34) — **ENHANCEMENT IDENTIFIED**
- **Status:** **PARTIAL — DURABILITY HARDENING**.
- **The Gap**: `WebhookEngine` in `frontend/src/lib/webhook-engine.ts` stores pending outbox items in a memory buffer (`this.outbox: WebhookOutboxItem[] = []`).
- **The Truth**: PostgreSQL contains a `webhook_delivery` table designed for transactional outbox persistence.
- **Required Action**: Ensure every event emitted by the order lifecycle service is written synchronously to PostgreSQL `webhook_delivery` within the order transaction.

### F. Payment Architecture (Domain 21)
- **Status:** **IMPLEMENTED / EXTERNAL DEPENDENCY**.
- COD is fully functional end-to-end.
- Razorpay order creation, signature verification, and webhook handling are implemented with idempotency checks against `payment_transaction` in PostgreSQL.
- Production payment credentials (`RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`) are external environment variables.

---

## 3. Prioritized Action Roadmap

Based on the actual codebase audit, the exact roadmap for full commercial completion is:

1. **[PRIORITY 1 - IMMEDIATE] Bind Coupon & Offer Engine to PostgreSQL `offer` Table**:
   - Create `OfferRepository` to query PostgreSQL `offer` table directly.
   - Refactor `ApiEngine.validateCoupon` and `ApiEngine.applyPromoCode` to eliminate hardcoded coupon strings and eliminate the 5% fallback.
   - Verify all 24 database offers are validated according to type (`flat`, `percentage`), minimum cart amount, expiry date, and usage limits.
   - Add automated test suite for database-backed coupon validation.

2. **[PRIORITY 2] Persist Transactional Webhook Outbox to PostgreSQL `webhook_delivery`**:
   - Update `WebhookEngine` to insert every order/payment event directly into PostgreSQL `webhook_delivery`.
   - Ensure event outbox survives Node.js server restarts.

3. **[PRIORITY 3] Authoritative End-to-End Customer Purchase Journey Test**:
   - Author and run an end-to-end Playwright test covering:
     Browse -> PDP -> Select 1kg Weight -> Add to Cart -> Apply PostgreSQL Coupon -> Enter Map Pin Address -> Select Delivery Slot -> Place Order -> Verify in PostgreSQL -> Open `/your-order` -> Verify Order Status in Admin Orders Panel.

4. **[PRIORITY 4] Update Durable Checkpoint & Final Certification**:
   - Document execution evidence for each micro-task in `docs/ANTIGRAVITY_EXECUTION_CHECKPOINT.md`.
