# CAKETOHOME RUNTIME DATABASE-FIRST ARCHITECTURAL CONTRACT

**Contract Version**: 1.0.0-PROD  
**Authoritative Storage**: PostgreSQL Database (Supabase Pooler / MikroORM)  
**Effective Date**: 2026-09-02  
**Platform**: CakeToHome Bakery Commerce & Operations OS  

---

## 1. Core Architectural Mandate

CakeToHome operates under a strict **Database-First (DB-First)** runtime contract. Under this contract:
1. **PostgreSQL is the single source of truth** for all business data: products, variants, pricing, branches, delivery fences, operating rules, cutoff times, slots, customers, addresses, orders, delivery partners, reviews, favorites, and CMS content.
2. **Zero Shadow Persistence**: In-memory stores (`memoryStore`, `globalThis.__store`) and disk files (`db-store.json`) act solely as short-lived, transparent read-caches that MUST be eagerly hydrated from and invalidated by PostgreSQL.
3. **No Unauthenticated Proxy Cascades**: Client requests must NEVER be proxied to backend services that reject them with 401s only to silently fall back to stale in-memory mock data.
4. **Deterministic Failures**: Unauthorized or invalid requests MUST return explicit HTTP 401/403/400 errors without falling through to shadow fallback stores.

---

## 2. Entity Authority & Data Ingress/Egress Contract

| Entity / Domain | Authoritative DB Table | Repositories / Services | Primary API Endpoints | Lifecycle Operations |
| :--- | :--- | :--- | :--- | :--- |
| **PIM Products** | `public.product` | `ProductRepository` | `GET /api/v1/products`, `GET /api/v1/admin/products` | Direct PostgreSQL queries filtering `deleted_at IS NULL AND status = 'published'`. Active count: 14. |
| **Variants & Weights**| `public.variant_option` | `ProductRepository` | `GET /api/v1/variants/options`, `GET /api/v1/admin/weights` | Direct DB queries from `variant_option`. |
| **Weight Pricing** | `public.product.metadata` | `ProductRepository` | `GET /api/v1/products/:id/weight-prices` | JSONB metadata stored in PostgreSQL `product.metadata.weight_prices`. |
| **Branches & Hubs** | `public.branch` | `BranchRepository` | `GET /api/v1/branches`, `GET /api/v1/admin/branches` | 54 active physical branches in DB with coordinates, schedules, and delivery radiuses. |
| **Delivery Zones** | `public.delivery_zone` | `BranchRepository` | `GET /api/v1/admin/delivery/zones` | Polygon and radial geofences tied to `branch_id`. |
| **Fulfillment & Cutoffs**| `public.branch.metadata` | `FulfillmentEngine`, `DeliverySlotGenerator` | `GET /api/v1/delivery/slots` | Corporate cutoff (18:00 IST) + Midnight cutoff (20:00 IST) enforced in `Asia/Kolkata`. |
| **Store Pickup** | `public.setting` | `SettingRepository`, `FulfillmentEngine` | `POST /api/v1/checkout/validate` | Enforces 6-digit collection OTP on order packing. |
| **Customer Accounts**| `public.customer` | `CustomerRepository`, `ApiEngine` | `GET /api/v1/customer/me`, `POST /api/v1/auth/verify-otp` | Phone-verified OTP auth with customer UID isolation. |
| **Customer Addresses**| `public.customer_address` | `CustomerRepository` | `GET/POST /api/v1/customers/addresses` | GPS-derived latitude and longitude decoupled from human address text. |
| **Orders & State** | `public.order` | `OrderRepository` | `GET/POST /api/v1/orders`, `GET /api/customer/orders` | Idempotent state transitions (`pending` → `confirmed` → `preparing` → `ready` → `out_for_delivery` → `delivered`). |
| **Delivery Partners**| `public.delivery_partner` | `ApiEngine` | `GET/PUT /api/v1/admin/delivery/partners` | Real-time presence tracking (`ONLINE`/`OFFLINE`) and vehicle assignments. |
| **Customer Favorites**| `public.customer_favorite` | `FavoriteRepository` | `GET/POST/DELETE /api/v1/customer/favorites` | Unique constraint on `(customer_uid, product_id)`. |
| **Product Reviews** | `public.product_review` | `ReviewRepository` | `GET/POST/PUT/DELETE /api/v1/customer/reviews` | Verified-purchaser review moderation and submission. |
| **CMS & Page Sections**| `public.cms_page`, `cms_homepage_section` | `CmsRepository` | `GET /api/v1/cms/pages`, `GET /api/v1/cms/homepage` | Dynamic visual blocks, hero banners, and SEO metadata. |
| **Platform Settings**| `public.setting` | `SettingRepository` | `GET/PUT /api/v1/admin/settings` | Key-value application configuration store in PostgreSQL. |

---

## 3. Product Catalog & Soft-Delete Contract (37 vs 14)

1. **Table Count**: The `public.product` table contains 38 total rows.
2. **Soft-Deleted Rows (24)**: Automated testing suites create temporary E2E products (`prod_01KYX...`, `audit_prod_...`) and soft-delete them upon teardown by setting `deleted_at = NOW()`.
3. **Active Catalog Rows (14)**: Exactly 14 catalog products have `deleted_at IS NULL` and `status = 'published'`.
4. **Hydration Rule**: Storefront catalog APIs and `db-persistence.ts` MUST strictly query `SELECT * FROM "product" WHERE deleted_at IS NULL ORDER BY created_at ASC`.
5. **Admin Visibility**: Admin catalogs query with optional `include_archived=true` to review soft-deleted or draft products without polluting customer-facing storefronts.

---

## 4. Authentication & Stream Locking Contract

1. **Proxy Isolation**: `MEDUSA_PROXY_ALLOWLIST` is strictly restricted to unauthenticated core utility paths (`health`, `admin/health`, `store/regions`, `regions`).
2. **Direct Repository Handling**: All admin product, order, branch, and customer endpoints are serviced directly by Next.js route handlers querying PostgreSQL repositories (`ProductRepository`, `OrderRepository`, `BranchRepository`) with server-side RBAC verification via `StaffAccessControl`.
3. **Stream Draining**: Any proxy response that returns an error status (401, 403, 500) MUST consume its body via `await res.text().catch(() => {})` before returning, preventing undici stream locks and "Response body object should not be disturbed or locked" errors.
4. **Cookie Invalidation**: Auth logout routes (`/api/auth/logout`) drain the request body stream and set explicit zero-max-age cookie headers directly on `NextResponse` across canonical paths (`/`, `/dashboard`, `/account`), without conflicting synchronous deletions on `cookies()`.

---

## 5. Map-First Geofenced Delivery Contract

1. **Coordinate Authority**: Serviceability is determined strictly by customer latitude and longitude calculated against branch geofences and maximum delivery radiuses.
2. **No Pincode-Only Delivery**: Postal pincodes serve purely as address metadata and cannot override coordinate geofencing.
3. **Distance Pricing Brackets**:
   - 0 to 3 km: ₹39 standard delivery
   - 3 to 5 km: ₹49 standard delivery
   - 5 to 10 km: ₹69 standard delivery
   - \> 10 km: Unserviceable (unless branch metadata explicitly extends radius)
4. **Rider Directions**: Delivery navigation URLs generated for delivery partners MUST use `https://www.google.com/maps/dir/?api=1&origin={storeLat},{storeLng}&destination={destLat},{destLng}` with numeric GPS coordinates, never imprecise address strings.
