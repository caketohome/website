# CakeToHome — PRG-01 Production Connection Verification Report
## AWS S3 · Production Supabase · Render

**Document Version:** 1.0.0  
**Gate:** PRG-01 Production Connection Verification Gate  
**Execution Mode:** READ-ONLY / AUDIT & FORENSIC INSPECTION / ZERO-MUTATION  
**Date:** 2026-10-03  
**Target Repository:** `E:\vig\cakes2home-main\cakes2home-main`  
**Git Branch:** `task/dev`  
**Preceding Checkpoints:**
- [LATEST_CHECKPOINT.md](file:///e:/vig/cakes2home-main/cakes2home-main/CHECKPOINTS/LATEST_CHECKPOINT.md)
- [prg01-step1-production-infrastructure-forensic.md](file:///e:/vig/cakes2home-main/cakes2home-main/CHECKPOINTS/prg01-step1-production-infrastructure-forensic.md)
- [prg01-step2-production-architecture-and-provisioning-runbook.md](file:///e:/vig/cakes2home-main/cakes2home-main/CHECKPOINTS/prg01-step2-production-architecture-and-provisioning-runbook.md)
- [PRG01_ACCEPTANCE_TEST_REPORT.md](file:///e:/vig/cakes2home-main/cakes2home-main/CHECKPOINTS/acceptance-test-evidence/PRG01_ACCEPTANCE_TEST_REPORT.md)

---

## 1. Executive Summary

This forensic verification evaluates whether the current CakeToHome repository is properly wired and connected to the newly provisioned external production infrastructure:
1. **AWS S3**
2. **Production Supabase**
3. **Render**

### Primary Distinction: Account Existence vs. Codebase Connection
While AWS S3, a production Supabase project, and Render have been provisioned by the user, **the CakeToHome codebase is currently NOT yet connected to or configured for the live production instances**. Specifically:

- **Local Environment Target**: The repository's local environment files (`.env`, `frontend/.env`, `backend/.env`) remain anchored to the **development Supabase instance** (`uubwhsnnrnicyczwqlbq`). Production connection credentials have not been injected into repository files (which conforms to strict secret hygiene).
- **Actual Media Pipeline**: The application's active media upload pipeline in Next.js (`MediaProcessor`) writes directly to the **local filesystem** (`public/uploads`), not AWS S3 and not Supabase Storage. While Medusa backend has a conditional `@medusajs/file-s3` plugin defined, the operational storefront and admin UI do not use it.
- **Render Configuration**: No `render.yaml` blueprint exists in the repository, and the root `package.json` contains no standard `"start"` script for single-root PaaS execution. Deployed services must be configured as decoupled web services with subfolder roots (`frontend` and `backend`).
- **Zero Mutation Preserved**: 0 production database queries, 0 schema alterations, 0 infrastructure mutations, and 0 application modifications were made during this audit.

---

## 2. AWS S3 Readiness & Forensic Inspection

| Inspection Criterion | Finding | Forensic Detail |
| :--- | :--- | :--- |
| **A. Application Support** | **PARTIAL** | Backend Medusa conditionally supports S3 via `@medusajs/file-s3`. Frontend Next.js has **ZERO** AWS S3 integration. |
| **B. SDK / Service Wiring** | **NOT WIRED (Frontend) / WIRED (Backend)** | Frontend has no `@aws-sdk/client-s3`. Backend `medusa-config.ts` (lines 137–156) conditionally registers `@medusajs/file-s3` when `AWS_S3_BUCKET_NAME` is set. |
| **C. Expected Variables** | `AWS_S3_BUCKET_NAME`, `AWS_REGION`, `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY` | `backend/medusa-config.ts` explicitly expects `AWS_S3_BUCKET_NAME` (not `AWS_S3_BUCKET` or `S3_BUCKET`). No `S3_ENDPOINT` variable is supported in code. |
| **D. Variable Scoping** | **SERVER-ONLY** | All AWS variables are strictly server-side in Node.js; none are prefixed with `NEXT_PUBLIC_`. |
| **E. Bucket Configurable?** | **YES** | Configured via `process.env.AWS_S3_BUCKET_NAME`. |
| **F. Region Configurable?** | **YES** | Configured via `process.env.AWS_REGION`. |
| **G. Public/Private Access** | **PUBLIC READ EXPECTED** | Backend constructs `https://${AWS_S3_BUCKET_NAME}.s3.${AWS_REGION}.amazonaws.com/...`. The bucket must allow public read for media objects. |
| **H. Upload Authentication** | **DEFECT IDENTIFIED** | Frontend route `/api/v1/admin/media/upload` (line 7056 of `route.ts`) **lacks session/auth checks**; any caller can post base64 images to local disk. |
| **I. File MIME & Size Checks** | **ENFORCED** | Enforces max 10MB; restricts to `image/jpeg`, `image/png`, `image/webp`, `image/avif`; blocks SVG, HTML, XML, scripts. |
| **J. Credentials in Source** | **ABSENT** | Zero AWS keys (`AKIA...`) exist in repository source code. |
| **K. Hardcoded Buckets** | **NONE** | No bucket names hardcoded in source. |
| **L. AWS S3 vs Supabase Storage**| **NEITHER IN FRONTEND** | Frontend uses local disk (`public/uploads`). Backend supports AWS S3 only. Neither uses Supabase Storage. |

### Critical Architectural Finding on AWS S3 & Next.js:
1. **Next.js Image Optimization Block**: In [`frontend/next.config.mjs`](file:///e:/vig/cakes2home-main/cakes2home-main/frontend/next.config.mjs#L29-L52), `images.remotePatterns` only allows `localhost`, `robohash.org`, `caketohome.vercel.app`, `images.unsplash.com`, and `res.cloudinary.com`. **AWS S3 domains (`*.s3.*.amazonaws.com`) are NOT configured.** If S3 URLs are fed to `<Image />`, Next.js will crash with a runtime image error.
2. **Ephemeral Disk Loss on Render**: Because `MediaProcessor` writes to `/app/public/uploads`, deploying Next.js to Render as a standard container will result in uploaded product and compliance images being permanently lost whenever the container restarts or redeploys, unless an S3 upload adapter is implemented or a Render Persistent Disk is attached.

---

## 3. Supabase Production Connection Inspection

| Parameter | Status | Forensic Value / Observation |
| :--- | :--- | :--- |
| **DATABASE_URL Presence** | **PRESENT** | Found in root `.env`, `frontend/.env`, and `backend/.env`. |
| **DATABASE TARGET** | **DEV** | Points to dev project identifier `uubwhsnnrnicyczwqlbq` on host `aws-1-ap-south-1.pooler.supabase.com:6543`. |
| **Production Target Presence**| **MISSING IN REPO** | The newly provisioned production Supabase credentials are not yet present in repository configuration files. |
| **SUPABASE_URL Variable** | **MISCONFIGURED / MISMATCHED** | `.env` has `SUPABASE_URL=https://xfvgumatwucammmbwdwv.supabase.co` while `DATABASE_URL` targets `uubwhsnnrnicyczwqlbq`. |
| **PostgreSQL Connection Type**| **DIRECT POOLER (TLS)** | Configured via `pg.Pool` in `frontend/src/lib/db.ts` with `ssl: { rejectUnauthorized: false }`. |
| **Hardcoded Project Refs** | **LEGACY DEV ONLY** | Project ref `uubwhsnnrnicyczwqlbq` is found in legacy scratch scripts (`scratch/`) and dev documentation, but zero production refs are hardcoded. |

---

## 4. Database Safety & Invariant Verification

- **Production Database Writes**: **0** (No production connection attempted).
- **Production Infrastructure Mutations**: **0** (No cloud resources modified).
- **DNS / Domain Mutations**: **0** (Zero DNS records touched).
- **Application Logic Changes**: **0** (Frozen ERP and UI codebase untouched).
- **Development Database State**: **100% UNCHANGED & PRISTINE** (190 orders, 99 accounts, 5 invoices, 3 vouchers, 2 balanced journal entries).

---

## 5. Supabase Schema Readiness & Migration Audit

### A. Authoritative 99-Account Chart of Accounts Verification
- **Audit Result**: **FULLY REPRODUCIBLE (99 ACCOUNTS)**.
- **Topological Sequence**:
  1. [`frontend/seed_phase4d_chart_of_accounts.js`](file:///e:/vig/cakes2home-main/cakes2home-main/frontend/seed_phase4d_chart_of_accounts.js) seeds **98 accounts** across Level 1 $\rightarrow$ Level 4.
  2. [`frontend/migrate_phase4f_step4_10_schema.js`](file:///e:/vig/cakes2home-main/cakes2home-main/frontend/migrate_phase4f_step4_10_schema.js#L106-L130) adds account **`1118 Deposit in Transit`** linked to parent `1110`.
  3. Total verified account count in database: **`SELECT count(*) FROM accounting_account` = 99**.
- **Superseded Code Warning**: The obsolete 35-account seed reference from early Phase 4A has been completely superseded. The production database must only receive the 99-account seed.

### B. Ordered Migration Sequence for Clean Production Database
Because migrations are maintained as standalone Node.js migration scripts rather than managed by an ORM migration tool, they must be executed against the clean production database in this strict sequential order:

```
Step 1: Medusa Base Migrations
        medusa db:migrate (Creates core commerce tables: products, variants, carts, orders)

Step 2: Custom ERP Schema Migrations
        1. node frontend/migrate_phase2_expense.js (Expense categories & entries)
        2. node frontend/migrate_phase3_fleet.js (Vehicles, drivers, trips, fuel)
        3. node frontend/migrate_phase4_accounting.js (CoA table, vouchers, journal entries, periods)
        4. node frontend/migrate_phase4f_step3b_cost_ledger.js (Cost lots, inventory movements)
        5. node frontend/migrate_phase4f_step3b1_hardening.js (Inventory constraints & immutability)
        6. node frontend/migrate_phase4f_step3c21_hardening.js (Branch inventory integrity)

Step 3: Chart of Accounts Seeding (98 Accounts)
        node frontend/seed_phase4d_chart_of_accounts.js

Step 4: Treasury, Bank Accounts & Account 1118 (Reaches 99 Accounts)
        node frontend/migrate_phase4f_step4_10_schema.js (Adds bank_account, deposit slips, account 1118)

Step 5: Bank Reconciliation Statement (BRS) Engine Schema
        node frontend/migrate_phase4f_step4_10_5A_bank_reconciliation_schema.js

Step 6: Constraints & Invariant Triggers Verification
        - trg_check_journal_balance (enforces sum(debits) == sum(credits))
        - Segregation of Duties checks (approved_by != created_by)
        - Posted voucher immutability rules

Step 7: Row Level Security Hardening
        node scripts/enable-rls.js (Protects all 309 tables with default-deny policies)
```

> [!WARNING]
> **Migration Hazard Detected**: `migrate_phase4f_step4_10_schema.js` queries parent account `1110` before inserting account `1118`. If this script is run before `seed_phase4d_chart_of_accounts.js`, it will abort with an error. The sequence above prevents this dependency failure.

---

## 6. Row Level Security (RLS) Status (34 Custom ERP Tables)

| Classification | Current Status | Description |
| :--- | :--- | :--- |
| **RLS Status** | **PLANNED** | A dynamic script [`scripts/enable-rls.js`](file:///e:/vig/cakes2home-main/cakes2home-main/scripts/enable-rls.js) exists to enable RLS across all tables in PostgreSQL. However, the static migration file [`migration/Migration_Enable_RLS_Public_Tables.sql`](file:///e:/vig/cakes2home-main/cakes2home-main/migration/Migration_Enable_RLS_Public_Tables.sql) dates from 2026-09-20 and only covers the older 275 tables. |
| **34 Custom Tables** | **RLS DISABLED IN DEV** | All 34 custom tables currently have RLS disabled in PostgreSQL. Authorization is enforced strictly at the Next.js API layer. |
| **Production Requirement** | **MANDATORY DEFAULT-DENY** | In production, `ALTER TABLE ... ENABLE ROW LEVEL SECURITY` must be applied to all 34 custom tables with zero public access policies, blocking unauthorized PostgREST REST endpoints while allowing server-side `pg.Pool` access. |
| **Step 3 Action** | **EXECUTE HARDENING** | Execute `scripts/enable-rls.js` against the clean production database immediately following schema migration and CoA seeding. |

### 34 Custom ERP Tables Requiring RLS Hardening:
1. `accounting_account`
2. `accounting_fiscal_period`
3. `accounting_journal_entry`
4. `accounting_journal_line`
5. `accounting_voucher`
6. `bank_account`
7. `bank_deposit_slip`
8. `bank_reconciliation_match`
9. `bank_reconciliation_session`
10. `bank_statement_import`
11. `bank_statement_line`
12. `expense`
13. `expense_category`
14. `flavor_master`
15. `fleet_fuel`
16. `gateway_payout_batch`
17. `gateway_settlement_order`
18. `inventory_cost_consumption`
19. `inventory_cost_lot`
20. `inventory_movement`
21. `invoice`
22. `offer_audit_log`
23. `offer_daily_metric`
24. `pim_category`
25. `product_flavor_mapping`
26. `product_shape_mapping`
27. `product_weight_price`
28. `purchase`
29. `purchase_item`
30. `purchase_payment`
31. `shape_master`
32. `supplier`
33. `vehicle`
34. `vehicle_trip`

---

## 7. Render Deployment Readiness

| Area | Status | Forensic Finding & Technical Impact |
| :--- | :--- | :--- |
| **`render.yaml` Blueprint** | **MISSING** | No Infrastructure-as-Code configuration exists for Render. Services must be created manually or via a new `render.yaml`. |
| **Root `package.json`** | **REQUIRES CONFIG** | Root has `"build:frontend"` and `"build:backend"`, but no root `"start"` command. On Render, services must set **Root Directory** to `frontend` and `backend` respectively. |
| **Node Version** | **COMPATIBLE** | Repository requires `node >= 20.0.0` (compatible with Render Node 20 runtime). |
| **Frontend Health Check** | **READY** | `GET /api/v1/health` responds with HTTP 200 `{ status: "operational" }`. |
| **Backend Health Check** | **READY** | `GET /health` is Medusa's native health check returning HTTP 200. |
| **Port Configuration** | **COMPATIBLE** | Frontend defaults to 3000, backend to 9000. Next.js natively binds to `$PORT` provided by Render. |
| **Dockerfiles** | **ATTENTION REQUIRED** | `backend/Dockerfile` line 16 copies `medusa-config.js` from builder; Medusa v2 builds to `.medusa/server/`. Native Node web services on Render are recommended over Docker containers to prevent image copy errors. |
| **`docker-compose.yml`** | **MISCONFIGURED** | Line 22 lacks `DATABASE_URL` for frontend service. If tested via Docker Compose, frontend database queries fail. |

---

## 8. Render ↔ Supabase Environment Variable Matrix

| Variable Name | Required? | Scoping | Present in Repo? | Configured Where for Render? |
| :--- | :--- | :--- | :--- | :--- |
| `DATABASE_URL` | **REQUIRED** | Server-Only | Yes (Dev only) | Render Dashboard $\rightarrow$ Environment (Frontend & Backend) |
| `JWT_SECRET` | **REQUIRED** | Server-Only | Yes (Dev only) | Render Dashboard $\rightarrow$ Environment (Frontend & Backend) |
| `COOKIE_SECRET` | **REQUIRED** | Server-Only | Yes (Dev only) | Render Dashboard $\rightarrow$ Environment (Backend) |
| `NEXT_PUBLIC_BASE_URL` | **REQUIRED** | Public | Missing in dev | Render Dashboard $\rightarrow$ Environment (Frontend: e.g. `https://caketohome.com`) |
| `NEXT_PUBLIC_BACKEND_URL` | **REQUIRED** | Public | Yes (Localhost) | Render Dashboard $\rightarrow$ Environment (Frontend: e.g. `https://api.caketohome.com`) |
| `BACKEND_URL` | **REQUIRED** | Server-Only | Missing in dev | Render Dashboard $\rightarrow$ Environment (Backend: e.g. `https://api.caketohome.com`) |
| `STORE_CORS` | **REQUIRED** | Server-Only | Yes (Localhost) | Render Dashboard $\rightarrow$ Environment (Backend: e.g. `https://caketohome.com`) |
| `ADMIN_CORS` | **REQUIRED** | Server-Only | Yes (Localhost) | Render Dashboard $\rightarrow$ Environment (Backend: e.g. `https://caketohome.com`) |
| `AUTH_CORS` | **REQUIRED** | Server-Only | Yes (Localhost) | Render Dashboard $\rightarrow$ Environment (Backend: e.g. `https://caketohome.com`) |
| `AWS_S3_BUCKET_NAME` | **OPTIONAL** | Server-Only | Yes in root/backend | Render Dashboard $\rightarrow$ Environment (Backend) |
| `AWS_REGION` | **OPTIONAL** | Server-Only | Yes in root/backend | Render Dashboard $\rightarrow$ Environment (Backend) |
| `AWS_ACCESS_KEY_ID` | **OPTIONAL** | Server-Only | Yes in root/backend | Render Dashboard $\rightarrow$ Environment (Backend) |
| `AWS_SECRET_ACCESS_KEY` | **OPTIONAL** | Server-Only | Yes in root/backend | Render Dashboard $\rightarrow$ Environment (Backend) |
| `RAZORPAY_KEY_ID` | **REQUIRED** | Public & Server| Missing in dev | Render Dashboard $\rightarrow$ Environment (Frontend) |
| `RAZORPAY_KEY_SECRET` | **REQUIRED** | Server-Only | Missing in dev | Render Dashboard $\rightarrow$ Environment (Frontend) |
| `WEBHOOK_SIGNING_SECRET` | **REQUIRED** | Server-Only | Missing in dev | Render Dashboard $\rightarrow$ Environment (Frontend) |

---

## 9. S3 ↔ Application Media Path Forensic Analysis

```
Current Active Production Code Path:

[ Browser Client ]
        │ HTTP POST /api/v1/admin/media/upload (Base64 payload)
        ▼
[ Next.js API Route (route.ts line 7056) ]
        │ Security & format validation (10MB limit, mime restriction)
        ▼
[ MediaProcessor (media-processor.ts line 35) ]
        │ Sharp image transcoding (WebP, AVIF, Thumbnail, Medium)
        ▼
[ Host Filesystem Disk: /app/public/uploads/* ] ◄── (EPHEMERAL ON RENDER)
        │
        ▼
[ PostgreSQL Table: public.media ] ◄── (Saves local relative URL: /uploads/...)
```

### Key Forensic Distinctions:
1. **The application does NOT upload to AWS S3**: The active Next.js media service operates entirely on local disk. An AWS bucket existence has zero effect on image persistence until frontend code is updated or a persistent volume is used.
2. **The application does NOT upload to Supabase Storage**: There is no `@supabase/supabase-js` or Supabase storage bucket integration in the codebase.
3. **Backend S3 Module Disconnected from Frontend**: While Medusa has `@medusajs/file-s3` declared in `medusa-config.ts`, the frontend media dashboard does not invoke Medusa's file API; it calls its own Next.js handler directly.

---

## 10. Connection Matrix

| Component | Exists | App Wired | Credentials Present | Verified | Status | Action Required |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **AWS S3** | YES (Created) | NO (Frontend) / CONDITIONAL (Backend) | PRESENT (Root/Backend) / MISSING (Frontend) | UNVERIFIED | **YELLOW** | Add frontend S3 adapter; whitelist S3 in `next.config.mjs` `images.remotePatterns`. |
| **Supabase PROD** | YES (Created) | YES (Architecture) | MISSING IN REPO (Points to Dev) | UNVERIFIED | **YELLOW** | Inject prod pooler `DATABASE_URL` (Port 6543); run ordered schema bootstrap. |
| **Render** | YES (Created) | NOT WIRED (No blueprint) | N/A (PaaS Managed) | UNVERIFIED | **YELLOW** | Configure Web Services with subfolder roots (`frontend` / `backend`); inject env vars. |
| **Frontend** | YES (Complete) | YES (Direct PG Pool) | DEV CREDENTIALS ONLY | PASS (Dev) | **GREEN** | Build & run on Render with prod environment variables. |
| **Backend** | YES (Complete) | YES (Medusa 2.x) | DEV CREDENTIALS ONLY | PASS (Dev) | **GREEN** | Build & run on Render with prod environment variables. |
| **Database Schema**| YES (Prepared) | YES (SQL Scripts) | N/A | READY FOR STEP 3 | **YELLOW** | Execute ordered migration sequence & 99-account CoA seed. |
| **Storage Subsystem**| YES (Bucket exists)| NO (Local Disk in Code)| DEV KEYS PRESENT | UNVERIFIED | **RED** | Attach Render Persistent Disk OR implement S3 client in `MediaProcessor`. |
| **DNS / Domain** | YES (Registered) | NOT CONFIGURED | N/A | PENDING HOST URL | **YELLOW** | Confirm canonical domain (`caketohome.com`); create CNAME to Render. |

---

## 11. Final Classification

- 🟩 **GREEN (Configured and Repository-Compatible)**:
  - **Next.js Frontend Service**: Application code is 100% frozen, all 42 acceptance areas certified, fully ready to build and run once production environment variables are provided.
  - **Medusa Backend Service**: Medusa 2.x engine is configured headless, dependencies locked, ready to build and run on Node 20.
  - **Server-Side PostgreSQL Architecture**: Direct connection pooling via `pg.Pool` supports Supavisor transaction pooler on port 6543 with TLS enabled.

- 🟨 **YELLOW (Exists but Requires Configuration / Migration / Verification)**:
  - **Supabase Production Project**: Provisioned by user, but clean schemas have not yet been migrated, the authoritative 99-account CoA is unseeded, and RLS is not yet applied.
  - **Render Service Deployment**: Account and services created, but missing `render.yaml` blueprint, requires setting explicit Root Directories (`frontend`, `backend`), and production environment variables must be input in Render Dashboard.
  - **AWS S3 Configuration**: Bucket exists and keys are present in `.env`, but Next.js `next.config.mjs` lacks S3 domain permission, and frontend upload service has no S3 upload adapter.
  - **DNS / Domain**: Domains exist, but DNS cutover is blocked until Render web service hostnames are assigned.

- 🟥 **RED (Missing or Incorrectly Wired)**:
  - **Frontend Media Storage Subsystem**: The active upload handler saves files strictly to local `/public/uploads`. On Render containers with ephemeral storage, uploads will disappear across redeploys/restarts unless a Render Persistent Disk is attached to `/app/public/uploads` or the code is enhanced with an S3 upload adapter.
  - **Local `.env` Database Target**: Local configuration files still point to the legacy DEV database (`uubwhsnnrnicyczwqlbq`). Production database URL is missing from local files.

---

## 12. Security Audit & Secret Hygiene

| File / Location | Secret Type | Finding | Required Action |
| :--- | :--- | :--- | :--- |
| `scratch/*.js` (Multiple files) | Dev DB Password | Legacy dev database connection strings contain plaintext dev credentials for `uubwhsnnrnicyczwqlbq`. | **MANDATORY**: Ensure production database password is brand-new and never matches dev. Quarantine or archive `scratch/`. |
| `.env`, `frontend/.env`, `backend/.env` | Dev Secrets | Contains dev `DATABASE_URL`, dev `JWT_SECRET`, dev keys. Excluded by `.gitignore`. | Keep excluded from git. Never copy dev secrets into production Render dashboard. |
| `frontend/src/app/api/v1/[...path]/route.ts` line 7056 | Unauthenticated Upload | `/api/v1/admin/media/upload` does not require user authentication. | Add session verification guard (`resolveUserContext` / `requireAdmin`). |
| Production Cloud Credentials | AWS & Supabase | User has provisioned external accounts. Zero production credentials have been leaked or printed in this audit. | Inject production credentials directly into Render Environment Settings via web UI. |

---

## 13. Exact Next Actions (PRG-01 Step 3 Runbook)

To advance from **Procurement** to **Verified Connection & Migration**, execute the following steps in sequence:

1. **Obtain Production Supabase Pooler URL**:
   - In Supabase Dashboard $\rightarrow$ Project Settings $\rightarrow$ Database $\rightarrow$ Connection Pooling.
   - Mode: **Transaction**, Port: **6543**.
   - Copy connection string (format: `postgresql://postgres.[PROD_REF]:[PASSWORD]@aws-0-[REGION].pooler.supabase.com:6543/postgres`).

2. **Execute Ordered Database Bootstrap against Production**:
   - Step A: Run Medusa base migrations (`npx medusa db:migrate`).
   - Step B: Run custom ERP schema migrations (`migrate_phase2_expense.js` through `migrate_phase4f_step3c21_hardening.js`).
   - Step C: Seed authoritative 98 accounts (`seed_phase4d_chart_of_accounts.js`).
   - Step D: Seed account 1118 & bank tables (`migrate_phase4f_step4_10_schema.js`).
   - Step E: Run BRS engine schema (`migrate_phase4f_step4_10_5A_bank_reconciliation_schema.js`).
   - Step F: Verify account count equals exactly 99 (`SELECT count(*) FROM accounting_account` === 99).
   - Step G: Apply RLS default-deny hardening (`node scripts/enable-rls.js`).

3. **Configure Render Web Services**:
   - **Frontend Web Service**:
     - Root Directory: `frontend`
     - Build Command: `npm install && npm run build`
     - Start Command: `npm run start`
     - Environment Variables: `DATABASE_URL` (Prod Pooler), `JWT_SECRET` (New 64-char), `NEXT_PUBLIC_BASE_URL`, `NEXT_PUBLIC_BACKEND_URL`, `NODE_ENV=production`.
     - *Storage Recommendation*: Attach Render Persistent Disk mounted at `/app/public/uploads` (or implement S3 adapter).
   - **Backend Web Service**:
     - Root Directory: `backend`
     - Build Command: `npm install && npm run build`
     - Start Command: `npm run start`
     - Environment Variables: `DATABASE_URL` (Prod Pooler), `JWT_SECRET`, `COOKIE_SECRET`, `STORE_CORS`, `ADMIN_CORS`, `AUTH_CORS`, `AWS_S3_BUCKET_NAME`, `AWS_REGION`, `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`.

4. **Whitelist AWS S3 in Next.js Image Config**:
   - Add `{ protocol: "https", hostname: "*.s3.*.amazonaws.com" }` to `images.remotePatterns` in [`frontend/next.config.mjs`](file:///e:/vig/cakes2home-main/cakes2home-main/frontend/next.config.mjs) if images are to be served from S3.

5. **Execute Read-Only Verification Smoke Suite**:
   - Perform read-only API and health checks against the live Render URLs once deployed.
