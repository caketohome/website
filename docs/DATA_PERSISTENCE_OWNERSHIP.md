# CakeToHome Data Persistence Ownership Map

This document establishes the authoritative source of truth for every domain entity in CakeToHome, eliminating file/JSON storage (`db-store.json`) from the runtime request path and migrating all persistent state to PostgreSQL.

---

## 1. Entity Ownership & Persistence Registry

| Entity | Current Source | Target Source (PostgreSQL) | Canonical Read Path | Canonical Write Path | Migration Method | Status |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **Branch / Store** | `frontend/data/db-store.json` (`branches`) | `public.branch`, `public.shop` | Next.js API / Medusa `GET /admin/branches` | Medusa `POST/PUT /admin/branches` & `public.branch` SQL | `migrate-db-store-to-database.ts` (Upsert with JSONB metadata) | PENDING |
| **Delivery Zones & Geofences** | `frontend/data/db-store.json` (`branches[].delivery_zones`) | `public.delivery_zone`, `public.geo_zone` | Next.js API `GET /api/v1/delivery/zones` & Medusa | Medusa `POST/PUT /admin/delivery/zones` & `public.delivery_zone` SQL | `migrate-db-store-to-database.ts` (Normalize polygons & radius) | PENDING |
| **Cities & Areas** | `frontend/data/db-store.json` (`cities`, `city_areas`) | `public.city` | Next.js API `GET /api/v1/cities` & Medusa | Medusa `POST/PUT /admin/cities` & `public.city` SQL | `migrate-db-store-to-database.ts` (Upsert active cities) | PENDING |
| **States & Regions** | `frontend/data/db-store.json` (`states`, `regions`) | `public.region`, `public.branch_region` | Next.js API `GET /api/v1/regions` & Medusa | Medusa `POST/PUT /admin/regions` | `migrate-db-store-to-database.ts` (Upsert regions) | PENDING |
| **Products & Flavours** | `frontend/data/db-store.json` (`products`) | `public.product`, `public.product_variant` | Next.js API `GET /api/v1/products` & Medusa | Medusa `POST/PUT /admin/products` & `public.product` SQL | `migrate-db-store-to-database.ts` (Upsert canonical products) | PENDING |
| **Product Categories** | `frontend/data/db-store.json` (`pim_categories`) | `public.product_category`, `public.product_category_product` | Next.js API `GET /api/v1/categories` & Medusa | Medusa `POST/PUT /admin/product-categories` | `migrate-db-store-to-database.ts` (Relational category mapping) | PENDING |
| **Product Options & Weights** | `frontend/data/db-store.json` (`variant_options`, `product_weight_prices`) | `public.product_option`, `public.product_option_value`, `public.price_set` | Next.js API `GET /api/v1/products/:id/options` | Medusa `POST/PUT /admin/products/:id/options` | `migrate-db-store-to-database.ts` (Upsert option values) | PENDING |
| **Customers & Profiles** | `frontend/data/db-store.json` (`customers`) | `public.customer`, `public.customer_phone` | Next.js API `GET /api/v1/customers/me` & Medusa | Medusa `POST/PUT /admin/crm/customers` & `public.customer` SQL | `migrate-db-store-to-database.ts` (Upsert customer records) | PENDING |
| **Customer Addresses** | `frontend/data/db-store.json` (`customers[].addresses`) | `public.customer_address`, `public.cust_address` | Next.js API `GET /api/customer/address` & Medusa | Next.js API `POST /api/customer/address` $\rightarrow$ DB | `migrate-db-store-to-database.ts` (Relational address mapping) | PENDING |
| **Customer Favorites / Wishlist** | `frontend/data/db-store.json` (`customer_favorites`) | `public.wishlist_item` | Next.js API `GET /api/v1/customer/favorites` | Next.js API `POST/DELETE /api/v1/customer/favorites` $\rightarrow$ DB | `migrate-db-store-to-database.ts` (Upsert wishlist rows) | PENDING |
| **Orders & Snapshots** | `frontend/data/db-store.json` (`orders`) | `public.order`, `public.order_line_item`, `public.order_address`, `public.order_event` | Next.js API `GET /api/v1/admin/orders` & Medusa | Next.js API `POST /api/v1/store/orders` $\rightarrow$ Medusa/DB | `migrate-db-store-to-database.ts` (Upsert orders with JSONB snapshots) | PENDING |
| **Delivery Partners / Fleet** | `frontend/data/db-store.json` (`delivery_partners`) | `public.delivery_partner`, `public.driver_profile` | Next.js API `GET /api/v1/admin/delivery/partners` | Medusa `POST/PUT /admin/delivery/partners` & `public.delivery_partner` SQL | `migrate-db-store-to-database.ts` (Upsert fleet partners) | PENDING |
| **CMS Pages & Content** | `frontend/data/db-store.json` (`cms_pages`) | `public.cms_page` | Next.js API `GET /api/v1/cms/pages` & Medusa | Next.js API `PUT /api/v1/admin/cms/pages/:id` $\rightarrow$ DB | `migrate-db-store-to-database.ts` (Upsert CMS pages & blocks) | PENDING |
| **CMS Sections & Hero Frames** | `frontend/data/db-store.json` (`cms_pages[].sections`) | `public.cms_homepage_section` | Next.js API `GET /api/v1/cms/pages/home` & Medusa | Next.js API `PUT /api/v1/admin/cms/sections/:id` $\rightarrow$ DB | `migrate-db-store-to-database.ts` (Preserve frame arrays in `config`) | PENDING |
| **Promotions & Offers** | `frontend/data/db-store.json` (`offers`) | `public.offer`, `public.promotion` | Next.js API `GET /api/v1/offers` & Medusa | Medusa `POST/PUT /admin/offers` & `public.offer` SQL | `migrate-db-store-to-database.ts` (Upsert discount rules) | PENDING |
| **Popup Campaigns & Triggers** | `frontend/data/db-store.json` (`popup_campaigns`) | `public.popup_campaigns`, `public.popup_versions` | Next.js API `GET /api/v1/popups` & Medusa | Next.js API `POST/PUT /api/v1/admin/popups` $\rightarrow$ DB | `migrate-db-store-to-database.ts` (Upsert campaigns & versions) | PENDING |
| **Media Assets Catalog** | `frontend/data/db-store.json` (`media`) | `public.media` | Next.js API `GET /api/v1/admin/media` & Medusa | Next.js API `POST /api/v1/admin/media/upload` $\rightarrow$ DB | `migrate-db-store-to-database.ts` (Upsert media metadata) | PENDING |
| **Global Settings & Operations** | `frontend/data/db-store.json` (`settings`, `fulfillment_config`) | `public.setting` | Next.js API `GET /api/v1/settings` & Medusa | Next.js API `PUT /api/v1/admin/settings/:key` $\rightarrow$ DB | `migrate-db-store-to-database.ts` (Key-value JSONB settings) | PENDING |
| **Product Reviews** | `frontend/data/db-store.json` (`product_reviews`) | `public.product_reviews` | Next.js API `GET /api/v1/products/:id/reviews` | Next.js API `POST /api/v1/products/:id/reviews` $\rightarrow$ DB | `migrate-db-store-to-database.ts` (Upsert verified reviews) | PENDING |
| **Audit Logs & Security Events** | `frontend/data/db-store.json` (`audit_logs`, `login_events`) | `public.audit_log`, `public.security_event`, `public.payment_audit_trail` | Next.js API `GET /api/v1/admin/audit-logs` | Next.js API mutation event logging $\rightarrow$ DB | `migrate-db-store-to-database.ts` (Batch insert security logs) | PENDING |

---

## 2. Invariant Rules for Production Persistence

1. **No Runtime JSON Writes**: `fs.writeFile`, `fs.writeFileSync`, or JSON disk streaming for mutation requests is strictly prohibited in runtime paths.
2. **Authoritative PostgreSQL Persistence**: Every mutation (create, edit, update, delete, publish, assign) must complete a PostgreSQL transaction commit before returning HTTP 200/201.
3. **Visible Failure Semantics**: If the database is unreachable or a transaction aborts, the API must return a structured error (HTTP 500/503) and the UI must display: *"Save failed. Your changes were not persisted."* Silent disk/JSON fallbacks are eliminated.
4. **Cache Separation**: In-memory single-flight and metadata caches serve only as short-lived read accelerators with immediate invalidation on write; they never act as persistence boundaries.
