# CAKETOHOME PLATFORM BASELINE MANIFEST (PHASE 0)
**Generated**: 2026-09-05T20:15:00+05:30  
**Status**: PROJECT FREEZE COMPLETED  
**Git Commit**: `8cb8a73d322e056875dab4b3cc0ee1aa6c47e22a`  
**Git Branch**: `task/dev`

---

## 1. Git State & Clean Working Tree
- **Current Branch**: `task/dev`
- **Current Commit**: `8cb8a73d322e056875dab4b3cc0ee1aa6c47e22a`
- **Commit Message**: `feat(catalog): full storefront product catalog data-source audit, DB authority & CMS occasion upgrade`
- **Working Tree Status**: Clean of tracked modifications.
  - Untracked artifacts: Benchmark and audit helper scripts located in `frontend/scripts/`.

---

## 2. Environment & Toolchain Versions
- **Operating System**: Windows 11 Pro (`Windows_NT 10.0.26200 x64`)
- **CPU**: Intel(R) Core(TM) i5-10500H CPU @ 2.50GHz (6 physical cores / 12 logical processors)
- **RAM**: 7.83 GB Total (Available: ~0.24 GB – 1.4 GB under workload)
- **Node.js**: `v24.12.0`
- **npm**: `11.6.2`
- **Next.js**: `14.1.4`
- **TypeScript**: `5.5.4` (`^5.5.4` in `package.json`)
- **React**: `18.2.0`
- **Package Locks**:
  - Root: `package-lock.json` present (`sizeBytes: 9400`)
  - Frontend: `frontend/package-lock.json` present

---

## 3. Environment Variables (Build & Runtime)
Configured in `frontend/.env`:
- `DATABASE_URL`: `postgresql://postgres.uubwhsnnrnicyczwqlbq:caketohomeqwerty@aws-1-ap-south-1.pooler.supabase.com:6543/postgres`
- `NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY`: `pk_e43cf3cbad60b9429ac28f7e46cd59022feeb003e3b339782cd5529906377bae`
- `NEXT_PUBLIC_BACKEND_URL`: `http://localhost:9000`
- `JWT_SECRET`: `supersecret`

---

## 4. Next.js Configuration (`frontend/next.config.mjs`)
- `typescript.ignoreBuildErrors: true` (Next.js build bypasses tsc during build)
- `eslint.ignoreDuringBuilds: true`
- `transpilePackages: ["@medusajs/ui"]`
- `experimental.workerThreads: false`
- `experimental.cpus: 1` (Single CPU worker serialization currently active)
- `webpack.watchOptions.ignored`: `["**/node_modules/**", "**/.git/**", "**/backend/**"]`
- `images.remotePatterns`:
  - `http://localhost:3000`
  - `https://robohash.org`
  - `https://caketohome.vercel.app`
  - `https://images.unsplash.com`
  - `https://res.cloudinary.com`

---

## 5. TypeScript Configuration (`frontend/tsconfig.json`)
- **Target**: `ES2017`
- **Module / Resolution**: `esnext` / `bundler`
- **Strict Mode**: `true`
- **Lib**: `["dom", "dom.iterable", "esnext"]`
- **Path Aliases**:
  - `@/*`: `./src/*`
  - `@frontend/*`: `./src/*`
  - `@backend/*`: `../backend/src/*`, `../backend/*`
- **Options**: `incremental: true`, `allowImportingTsExtensions: true`, `noEmit: true`

---

## 6. Package & Dependency Ecosystem
- **Root Scripts** (`package.json`):
  - `npm run dev`: Concurrently runs `dev:backend` and `dev:frontend`
  - `npm run build:backend`: `cd backend && npm run build`
  - `npm run build:frontend`: `cd frontend && npm run build`
- **Frontend Core Dependencies** (`frontend/package.json`):
  - Next.js: `14.1.4`
  - React / React-DOM: `^18`
  - UI & Styling: `@medusajs/ui`, `@medusajs/icons`, `tailwindcss`, `tailwind-scrollbar-hide`
  - Graphics & Animation: `@dotlottie/react-player`, `sharp`
  - Geo / Maps: `leaflet`, `react-leaflet`, `@types/leaflet`
  - Database: `pg`, `@types/pg`
  - Security / Auth: `jose`, `eventsource`
  - Data Export: `exceljs`
  - Testing: `@playwright/test` (`^1.62.1`), `playwright` (`^1.61.1`)

---

## 7. Test Suites & Playwright Configuration
- **Playwright Config** (`frontend/playwright.config.ts`):
  - `testDir`: `./e2e`
  - `timeout`: 45,000 ms
  - `workers`: 1
  - `baseURL`: `http://localhost:3000`
  - `channel`: `chrome`
- **Backend Test Scripts** (`backend/package.json`):
  - `test:integration:http`: Jest HTTP integration suite
  - `test:integration:modules`: Jest module integration suite
  - `test:unit`: Jest unit suite

---

## 8. Database Architecture & Persistence Layer
- **Authoritative Persistence**: PostgreSQL 16 (Hosted on Supabase AP-South-1 AWS pooler).
- **Connection Pool** (`frontend/src/lib/db.ts`):
  - Client: `pg.Pool` with connection pooling (`min: 2`, `max: 20`, `idleTimeoutMillis: 30000`)
  - Global Singleton: `globalThis.__cth_pg_pool__`
  - SSL Configuration: `{ rejectUnauthorized: false }` for pooler connection
  - Core Methods: `dbQuery`, `dbTransaction`, `isDatabaseHealthy`, `closeDbPool`
- **Domain Repositories** (`frontend/src/lib/repositories/`):
  1. `product.repository.ts`: Full SQL queries on `products`, `variants`, `categories`, `occasions`.
  2. `order.repository.ts`: SQL queries on `orders`, `order_items`, `order_status_history`.
  3. `customer.repository.ts`: SQL queries on `customers`, `addresses`.
  4. `branch.repository.ts`: SQL queries on `branches`, delivery polygons, serviceability radiuses.
  5. `cms.repository.ts`: SQL queries on `cms_sections`, page blocks.
  6. `offer.repository.ts`: SQL queries on discounts and promotions.
  7. `review.repository.ts`: SQL queries on customer reviews.
  8. `setting.repository.ts`: SQL queries on platform configurations.
  9. `favorite.repository.ts`: SQL queries on wishlist items.

---

## 9. Deployment & Orchestration Configuration
- **Docker Compose** (`docker-compose.yml`):
  - `backend`: Dockerfile from `./backend`, exposing port `9000`.
  - `frontend`: Dockerfile from `./frontend`, exposing port `3000`, depends on `backend`.
  - `DATABASE_URL` passed directly to containers.

---

## 10. Middleware & Security Enforcement
- **File**: `frontend/src/middleware.ts`
- **Protected Paths**: `/dashboard/:path*`, `/account/:path*`
- **Token Verification**: Inspects `_cth_jwt` and `_medusa_jwt` cookies.
- **RBAC Enforcement**:
  - `ADMIN` / `SUPER_ADMIN` / `STAFF`: Permitted in `/dashboard`
  - `DELIVERY_PARTNER` / `DLP`: Routed to `/dashboard/delivery-partner`
  - `BRANCH_MANAGER` / `SHOP_MANAGER`: Routed to `/dashboard/shop`
  - Unauthenticated users redirected to `/login`.

---

## 11. Major Route Structure & Page Breakdown
- **Total App Files Scanned**: 62
- **Page Routes (`page.tsx`)**: 34
- **API Route Handlers (`route.ts`)**: 17
- **Layouts (`layout.tsx`)**: 7
- **Sitemaps & Robots**: 2
- **Storefront**:
  - Home: `/`
  - Catalog: `/products`
  - PDP: `/products/[id]`
  - Taxonomy: `/category/[slug]`, `/occasions/[slug]`, `/city/[slug]`
  - Search & Discovery: `/search`, `/compare`
  - Commerce: `/cart`, `/checkout`, `/your-order`, `/track`
- **Account**:
  - `/account`, `/account/orders`, `/account/addresses`, `/account/wallet`, `/account/wishlist`, `/account/subscriptions`
- **Admin / Operational Dashboards**:
  - `/dashboard`: Platform administration
  - `/dashboard/shop`: PIM (Product Information Management) & store operations
  - `/dashboard/shop/menu`: Menu & variant editor
  - `/dashboard/delivery-partner`: Delivery fleet management
- **API Handlers**:
  - Auth: `/api/auth/session`, `/api/auth/me`, `/api/auth/logout`
  - Customer: `/api/customer/me`, `/api/customer/profile`, `/api/customer/orders`, `/api/customer/address`
  - Catalog / Public: `/api/v1/products`, `/api/v1/branches`, `/api/v1/accessories`, `/api/v1/[...path]`
  - AI & Admin: `/api/v1/ai/chat`, `/api/v1/ai/context`, `/api/v1/admin/branches`, `/api/v1/admin/ai/*`

---

## 12. Component & Architecture Boundaries
- **Total TS/TSX files in `src/`**: 365
- **Files declaring `"use client"`**: 171 (46.8% of codebase)
- **Routes with `force-dynamic`**: 43
- **Routes with `revalidate` (ISR)**: 7
- **Routes with `generateStaticParams`**: 0

---

## 13. Caching & Redis Integration Status
- **Next.js Webpack Cache**: `.next/cache` populated.
- **Next.js ISR**: Configured on 7 routes (`revalidate: 3600`).
- **Redis Usage**:
  - Architectural contracts define Redis 7 for distributed locks (`redlock`), session caches, and BullMQ event pub/sub.
  - Currently runs in standalone single-instance mode during development (`REDIS_URL` optional).
  - PostgreSQL row-level locking (`SELECT FOR UPDATE`) serves as authoritative synchronization.

---

## 14. Measured Performance Baseline (Pre-Optimization)
- **TypeScript Check (`npx tsc --noEmit`)**: **42.75s** (42,753 ms)
- **Cold Production Build**: **219.52s** (3m 39.5s)
- **Warm Production Build #1**: **119.22s** (1m 59.2s)
- **Warm Production Build #2**: **453.57s** (7m 33.6s)
- **Initial Dev Server Startup**: **7.14s** (7,135 ms)
- **Initial Root Route (`/`) Compilation**: **104.31s** (104,313 ms) [6,314 modules]
- **Catalog Route (`/products`) Compilation**: **11.19s** (11,193 ms)
- **PDP Route (`/products/[id]`) Compilation**: **6.86s** (6,857 ms)
- **Checkout Route (`/checkout`) Compilation**: **6.48s** (6,480 ms)
- **API Route (`/api/v1/products`) Compilation**: **19.09s** (19,085 ms)
- **Peak Compilation RSS**: **1.85 GB – 2.4 GB**
- **Peak Node Heap**: **1.4 GB – 1.9 GB**
- **Largest Client Chunk**: `6edf0643.*.js` (**913.1 KB** uncompressed)
- **Second Largest Client Chunk**: `7186.*.js` (**661.6 KB** uncompressed)

---

## 15. Freeze Sign-Off
Baseline snapshot captured. Functional code remains unchanged. Baseline manifest active.
