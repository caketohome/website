# CAKETOHOME CHECKPOINT — PHASE 0 BASELINE INSPECTION

**Timestamp:** 2026-09-13 19:35:00 UTC+05:30  
**Repository Path:** `E:\vig\cakes2home-main\cakes2home-main`  
**Git Branch:** `task/dev`  
**Git Head Commit:** `3081621 merge: integrate task/devNew (new luxury storefront UI) into task/dev`  
**Status:** **SAFE TO CONTINUE**  

---

## 1. REPOSITORY & RUNTIME BASELINE AUDIT

### 1.1 Git Status
- **Branch:** `task/dev` (tracked, clean commit base `3081621`)
- **Working Tree:** Contains approved, uncommitted storefront brand color migration files (~57 components updated from rose/pink to `#1D2F5D` navy and `#D4AF37` gold) and previous phase UI/CMS persistent repairs.
- **Untracked Evidence & Checkpoint Artifacts:** Preserved intact in root and `scratch/` directory. Zero files deleted.
- **Safety Checks:** Zero git resets, zero git clean commands executed.

### 1.2 Active Runtime Processes
- **Frontend Server (Next.js 14.1.4 App Router):**
  - Ports: `http://localhost:3001` (active browser primary) & `http://localhost:3000` (active secondary)
  - HTTP Status: `200 OK` verified on both ports.
- **Backend Server (Medusa 2 / Express):**
  - Port: `http://localhost:9000`
  - Health Endpoint: `http://localhost:9000/health` returns `HTTP 200 OK` (`{"status":"ok"}`).
- **Compilation Health:**
  - Frontend TypeScript Check (`node backend/node_modules/typescript/bin/tsc --project frontend/tsconfig.json --noEmit`): **0 errors (Exit code 0)**.
  - Backend TypeScript Check (`node backend/node_modules/typescript/bin/tsc --project backend/tsconfig.json --noEmit`): **0 errors (Exit code 0)**.

### 1.3 PostgreSQL Database Authority
- **Database Engine:** PostgreSQL 17.6 (AWS ap-south-1 Supabase Pooler over TLS)
- **Host:** `aws-1-ap-south-1.pooler.supabase.com:6543/postgres`
- **Ping / Latency:** ~346ms
- **Authoritative Database Counts (Read-Only Verified):**
  - `cms_page`: 21 records
  - `cms_homepage_section`: 32 records
  - `product`: 57 records
  - `product_category`: 10 records
  - `media`: 142 records
  - `branch`: 57 records
  - `customer`: 57 records
  - `order`: 134 records
- **Legacy & Safety Constraints:**
  - 3 Legacy eggless records intact and untouched:
    - `prod_01KYZ4XG8Y5N8KJC6NV54TJTGR` (`aswani chocolate `)
    - `prod_01KYZ54K5XD0JP6HJR7R111K5B` (`aswani chocolate 1`)
    - `prod_01KYZ5VK205SFXPVX3MYZTQGHB` (`aswani chocolate 3222`)
  - Zero `memoryStore` usage.
  - Zero `globalThis.__CTH_MEMORY_STORE__` usage.
  - Zero `db-store.json` usage.
  - Zero destructive database operations (DROP, TRUNCATE, DELETE).

---

## 2. APPLICATION ARCHITECTURE AUDIT

- **Next.js Structure:** Next.js 14.1.4 with App Router under `frontend/src/app`.
  - Storefront routes: `(store)/page.tsx` (Homepage), `(store)/products/` (Catalog & PDP), `(store)/compare/`, `(store)/cart/`, `(store)/checkout/`, `(store)/city/[slug]/`, `(store)/occasions/[slug]/`.
  - Admin dashboard: `dashboard/page.tsx`, `dashboard/layout.tsx` with modular tab panels for CMS, CRM, Orders, Catalog, Marketing, Occasions.
- **Data Flow Architecture:** Strict `Browser -> API -> Service -> Repository -> PostgreSQL`.
  - Repositories: `frontend/src/lib/repositories/` (`cms.repository.ts`, `product.repository.ts`, `order.repository.ts`).
  - Database persistence layer: `frontend/src/lib/db-persistence.ts`.
- **CMS / Page Builder:**
  - Admin Editor: `frontend/src/components/dashboard/admin/page-configurator.tsx`.
  - Storefront Renderer: `frontend/src/components/store/cms/page-renderer.tsx`.
  - Section schemas: `frontend/src/lib/cms/section-schema.ts` and `section-registry.ts`.
- **Brand & Styling System:**
  - Global CSS: `frontend/src/app/globals.css`.
  - Tailwind Config: `frontend/tailwind.config.ts`.
  - Palette: Deep Luxury Navy (`#1D2F5D`), Warm Honey Gold (`#D4AF37`), Japandi Warm Background (`#FDFBF7`), Dark Surface (`#07090E`).
  - Typography: `Playfair Display` for serif headings, `Inter` for sans UI/body text.
  - Scroll Animation: `frontend/src/components/store/animation/scroll-frame-hero.tsx` (22 frames preserved in order, mobile fallback intact).

---

## 3. CHECKPOINT CHAIN & PREVIOUS EVIDENCE

- `CHECKPOINT_20260913_170600_AFTER_FRONTEND_REPAIR.md`
- `VERIFICATION_REPORT_20260913_173400_AFTER_FRONTEND_REPAIR.md` (All 7 real browser routes passed, 16 PostgreSQL domains verified, 10 responsive viewports passed, 17-step CMS persistence passed).
- `CHECKPOINT_20260913_133000_PHASE4_CMS_PERSISTENCE_PASSED.md`

---

## 4. NEXT PHASE SCOPE & OBJECTIVE

- **Upcoming Phase:** **PHASE 1 — FRONTEND RUNTIME REPAIR AND STABILITY & PHASE 2 — STOREFRONT ROUTE VERIFICATION** per CakeToHome Master Repair Plan.
- **Intended Scope:**
  1. Verify browser network requests and console across all active storefront routes (`/`, `/products`, PDP, `/compare`, `/cart`, `/checkout`, `/login`, `/account`, `/dashboard`).
  2. Confirm 0 asset 404s (CSS, JS, fonts, images).
  3. Confirm 0 uncaught runtime exceptions and 0 hydration errors.
  4. Verify the newly completed brand color migration (Navy/Gold palette) renders cleanly without any rogue pink/rose in the live browser.
