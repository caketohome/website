# CakeToHome Security — Production Handoff & Architecture Runbook

**Date:** September 20, 2026  
**Document:** `CHECKPOINTS/security-production-handoff-01.md`  
**Target Repository:** `E:\vig\cakes2home-main\cakes2home-main`  
**Current Branch:** `task/dev`  
**Audit Baseline:** `security-audit-runs/cakes2home-main/run-1/`  
**Code Remediation Status:** **VERIFIED (7/7 Findings Remediated, 21/21 Tests PASS)**  
**Production Clearance Status:** **NOT YET CLEARED — AWAITING MANUAL HOSTING & CREDENTIAL ACTIONS**

---

## 1. Production Architecture Status: Verified vs Not Verified

Based on read-only inspection of repository configuration files, Docker manifests, CI workflows, source code, and package definitions, the factual production infrastructure state is partitioned below:

```
┌────────────────────────────────────────────────────────────────────────┐
│                        PUBLIC INTERNET / CLIENTS                       │
└───────────────────┬────────────────────────────────┬───────────────────┘
                    │                                │
                    ▼                                ▼
       ┌─────────────────────────┐      ┌─────────────────────────┐
       │     FRONTEND (Store)    │      │      BACKEND (Core)     │
       │     Next.js 14 App      │      │      Medusa v2 API      │
       │    Router (Node 20)     │      │   (Node 20 Long-Running)│
       │                         │      │                         │
       │ Hosting: NOT VERIFIED   │      │ Hosting: NOT VERIFIED   │
       │ Compatible: Vercel /    │      │ Container: Dockerfile   │
       │             Docker      │      │ Port: 9000              │
       │ Domain: NOT VERIFIED    │      │ Domain: NOT VERIFIED    │
       └────────────┬────────────┘      └────────────┬────────────┘
                    │                                │
                    │                                │
                    ▼                                ▼
       ┌──────────────────────────────────────────────────────────┐
       │                         DATABASE                         │
       │             Supabase Managed PostgreSQL 17.6             │
       │          Region: AWS ap-south-1 (Mumbai pooler)          │
       │              Project: uubwhsnnrnicyczwqlbq               │
       │                Port: 6543 (PgBouncer)                    │
       │        Status: VERIFIED (CREDENTIAL COMPROMISED,         │
       │                 ROTATION REQUIRED PRIOR TO LAUNCH)       │
       └──────────────────────────────────────────────────────────┘
```

### VERIFIED

1. **Git Source & Repository Root:**
   - Repository Root: `E:\vig\cakes2home-main\cakes2home-main`.
   - Current Branch: `task/dev`.
   - Configured Remote: `origin` pointing to `https://github.com/akshayjoy33/caketohome.git` (GitHub).
   - Production Branch Evidence: `origin/main` exists in remote references (`.git/refs/remotes/origin/HEAD` and `.git/refs/remotes/origin/main`).
   - Current Branch Relationship: `task/dev` tracks `origin/task/dev`. It is NOT automatically connected to any production deployment.
2. **CI/CD Pipeline Behavior:**
   - Workflow File: `.github/workflows/ci.yml`.
   - Triggers: Push to `main`, `develop`; Pull requests targeting `main`, `develop`.
   - Actions Performed: `npm ci`, `npm run lint`, `npx prisma generate`, `node scripts/verify-database-first.mjs`.
   - Classification: **TEST & BUILD ONLY**.
   - Verification Fact: **NO AUTOMATIC DEPLOYMENT PIPELINE VERIFIED IN REPOSITORY**.
3. **Frontend Application Framework & Container Packaging:**
   - Framework: Next.js 14.1.4 App Router (`frontend/package.json`).
   - Node Target: Node 20 (`frontend/Dockerfile` uses `node:20-alpine`).
   - Packaging: Multi-stage Dockerfile exposing port 3000 running `npm start`.
   - Code-level compatibility with Vercel exists (e.g. ambient `VERCEL_ENV` checks in `sessions.ts`), but Vercel is not proven as active host.
4. **Backend Application Framework & Container Packaging:**
   - Framework: Medusa.js v2 (`@medusajs/medusa` v2.17.2, Node 20).
   - Process Architecture: Long-running Node process (`node node_modules/@medusajs/cli/cli.js start` on port 9000). Cannot run on serverless edge functions.
   - Packaging: `backend/Dockerfile` (`node:20-alpine`, `EXPOSE 9000`).
5. **Database Target & Connection Consumption:**
   - Provider: **Supabase** Managed PostgreSQL 17.6.
   - Host: `aws-1-ap-south-1.pooler.supabase.com`.
   - Port: `6543` (PgBouncer Connection Pooler).
   - Database: `postgres`.
   - Project Reference: `uubwhsnnrnicyczwqlbq`.
   - Configuration Consumption: Strictly consumed via `process.env.DATABASE_URL` across `frontend/src/lib/db.ts`, `backend/medusa-config.ts`, and migration scripts.
   - Secret Cleansing: All hardcoded credentials have been expunged from source code, inspection scripts, and docker-compose files.
6. **Docker Architecture:**
   - Root `docker-compose.yml`: Defines `frontend` (port 3000) and `backend` (port 9000). Parameterized via `${DATABASE_URL}`, `${JWT_SECRET}`, `${COOKIE_SECRET}`. Contains zero hardcoded credentials. Connects to external Supabase database.
   - Dev Compose `docker/docker-compose.yml`: Defines local `postgres:16-alpine` (port 5432) and `redis:7-alpine` (port 6379) for local development only.
7. **Security Controls & Test Suite:**
   - 7/7 High-Impact Security Findings from Cloudflare Audit remediated and revalidated.
   - Automated Security Regression Suite (`scripts/run-security-regression-tests.ps1`): **21 / 21 PASS (100%)**.
   - Timing-safe HMAC-SHA256 session verification (`auth-session.ts`).
   - Server-authoritative customer data isolation (`resolveVerifiedCustomer`).
   - Strict manager branch scoping (`resolveManagerSession`).
   - Super-admin exact role enforcement (`role === "SUPER_ADMIN" || userId === "admin_01"`).
   - Outbound SSRF validation active with DNS/IP resolution guards and `redirect: "error"`.

---

### NOT VERIFIED

1. **Frontend Production Host:**
   - **NOT VERIFIED FROM AVAILABLE EVIDENCE**.
   - No `vercel.json` exists in the repository.
   - No `.vercel` project binding directory exists in the repository.
   - No Vercel project ID, org ID, or deployment hook is present.
   - The reference to `caketohome.vercel.app` in `frontend/next.config.mjs` is an entry in `images.remotePatterns` (allowing images loaded from that host), not proof of active hosting.
2. **Backend Production Host:**
   - **NOT VERIFIED FROM REPOSITORY EVIDENCE (UNKNOWN)**.
   - No provider configurations found for Railway (`railway.json`), Render (`render.yaml`), Fly.io (`fly.toml`), AWS ECS/CDK, or Cloudflare Workers.
   - Whether the backend runs on a standalone VPS, a cloud container platform, or a private server cannot be determined from repository files.
3. **Production Domains & DNS Records:**
   - **DNS STATUS NOT VERIFIABLE FROM REPOSITORY**.
   - `caketohome.com`, `www.caketohome.com`, `api.caketohome.com`, and `caketohome.vercel.app` appear only as fallback strings, documentation references, or image whitelist entries in code.
   - Active nameserver assignments, A/CNAME records, and SSL certificate bindings cannot be verified from the local workspace.
4. **n8n Workflow Automation Instance:**
   - **NOT VERIFIED AS ACTIVE PRODUCTION INFRASTRUCTURE**.
   - `https://n8n.caketohome.com/webhook/v1/caketohome-events` exists as a default string in `webhook-engine.ts`.
   - Whether a live n8n instance is deployed, active, or required for production launch is unverified.
5. **Production Secrets:**
   - Production `JWT_SECRET`: UNKNOWN (must be generated).
   - Production `COOKIE_SECRET`: UNKNOWN (must be generated).
   - Rotated `DATABASE_URL`: UNKNOWN (pending password reset in Supabase Console).
   - Live Razorpay Credentials: UNKNOWN (optional unless online card payments are enabled at launch).

---

## 2. Environment Variables Verification Matrix

| Variable | Used by | Required? | Server/client | Evidence in Codebase | Production value known? |
|---|---|---|---|---|---|
| `DATABASE_URL` | Frontend (`db.ts`, Prisma), Backend (`medusa-config.ts`), migration scripts | Required by source code & framework | Server-only | `frontend/src/lib/db.ts`, `backend/medusa-config.ts`, `scripts/verify-database-first.mjs` | Host/project verified; active credential UNKNOWN (must be rotated) |
| `JWT_SECRET` | Frontend (`auth-session.ts`), Backend (`medusa-config.ts`) | Required by source code (fails safe in prod if missing) | Server-only | `frontend/src/lib/security/auth-session.ts`, `backend/medusa-config.ts` | UNKNOWN (must be generated: 256-bit random hex) |
| `COOKIE_SECRET` | Backend (`medusa-config.ts`) | Required by Medusa framework | Server-only | `backend/medusa-config.ts` | UNKNOWN (must be generated: 256-bit random hex) |
| `NODE_ENV` | Next.js, Medusa, auth-session | Required by runtime/framework | Server & client (ambient) | `auth-session.ts`, `next.config.mjs` | Set to `production` by hosting environment |
| `NEXT_PUBLIC_BASE_URL` | Frontend SEO, OpenGraph, dynamic sitemaps, robots.txt | Optional in dev (fallback `https://cakes2home.com`), Recommended in prod | Client & server | `frontend/src/lib/config/site.ts`, `frontend/src/app/sitemap.ts` | UNKNOWN / NOT VERIFIED (intended custom domain) |
| `NEXT_PUBLIC_BACKEND_URL` | Frontend API client routing commerce calls to Medusa | Required if frontend communicates with Medusa API | Client & server | `frontend/src/lib/medusa/client.ts` | UNKNOWN / NOT VERIFIED (intended backend endpoint) |
| `BACKEND_URL` | Medusa internal / admin redirects | Optional (fallback `http://localhost:9000`) | Server-only | `backend/medusa-config.ts` | UNKNOWN / NOT VERIFIED |
| `STORE_CORS` | Backend (`medusa-config.ts`) | Required by Medusa in production | Server-only | `backend/medusa-config.ts` | UNKNOWN / Configurable based on final storefront domain |
| `ADMIN_CORS` | Backend (`medusa-config.ts`) | Required by Medusa in production | Server-only | `backend/medusa-config.ts` | UNKNOWN / Configurable based on final admin domain |
| `AUTH_CORS` | Backend (`medusa-config.ts`) | Required by Medusa in production | Server-only | `backend/medusa-config.ts` | UNKNOWN / Configurable based on final storefront/admin domains |
| `NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY` | Frontend Medusa store client | Optional if using direct DB repo, Required if calling Medusa Store API | Client & server | `frontend/src/lib/medusa/client.ts` | UNKNOWN (generated in Medusa Admin) |
| `RAZORPAY_KEY_ID` | Payment gateway client/server | Production-only (optional in test/dev mode) | Client & server | `frontend/src/lib/services/payment.service.ts` | UNKNOWN (merchant live key) |
| `RAZORPAY_KEY_SECRET` | Payment gateway server verification | Production-only (optional in test/dev mode) | Server-only | `frontend/src/lib/services/payment.service.ts` | UNKNOWN (merchant live secret) |
| `REDIS_URL` | Medusa v2 event bus & cache | Optional in single-node dev, Recommended for prod cluster | Server-only | `backend/medusa-config.ts` | UNKNOWN / Inferred for multi-worker backend |

---

## 3. Deployment Readiness Matrix

| Area | Status | Evidence | Required Action |
|---|---|---|---|
| Git repository | VERIFIED | Root at `E:\vig\cakes2home-main\cakes2home-main`, remote `origin` -> `github.com/akshayjoy33/caketohome.git` | Maintain clean working tree on `task/dev` |
| production branch | VERIFIED | `origin/main` exists in Git refs | Stage PR from `task/dev` (or `task/security-remediation`) to `main` once cleared |
| frontend host | NOT VERIFIED | No `vercel.json` or `.vercel` directory; Dockerfile exists | Human operator must confirm whether Vercel or Docker container host is used |
| backend host | NOT VERIFIED | No Railway, Render, Fly.io, or cloud configs; Dockerfile exists | Human operator must confirm backend VPS/container host |
| database | VERIFIED | Supabase PostgreSQL 17.6 pooler (`aws-1-ap-south-1.pooler.supabase.com:6543`) | Rotate database password in Supabase Console before production use |
| DNS | NOT VERIFIED | DNS records cannot be inspected from repo files | Human operator must verify DNS A/CNAME records in DNS registrar |
| frontend domain | NOT VERIFIED | `caketohome.com` is fallback string in code, not verified live | Confirm domain mapping in hosting dashboard |
| backend domain | NOT VERIFIED | `api.caketohome.com` is referenced in docs/placeholders, not verified live | Confirm API subdomain mapping to backend port 9000 |
| CI/CD | VERIFIED | `.github/workflows/ci.yml` is test/build only; no deployment steps | Human operator must decide whether to configure automated deploy or deploy manually |
| environment variables | REQUIRED | Source requires `DATABASE_URL`, `JWT_SECRET`, `COOKIE_SECRET` | Populate environment variables in target hosting environment |
| Docker | VERIFIED | Root `docker-compose.yml` parameterized; `backend/Dockerfile` and `frontend/Dockerfile` present | Build and test images in target production environment |
| n8n | NOT VERIFIED | Placeholder webhook in `webhook-engine.ts`; SSRF validation active | Human operator must confirm if n8n workflows are active in production |
| Razorpay | NOT VERIFIED | Code supports Razorpay via `payment.service.ts`; keys not in repo | Configure live merchant keys if online payment processing is enabled |
| CORS | REQUIRED | Medusa `medusa-config.ts` requires `STORE_CORS`, `ADMIN_CORS`, `AUTH_CORS` in prod | Set CORS variables to match confirmed production frontend domains |
| JWT_SECRET | REQUIRED | `auth-session.ts` requires 256-bit secret; fails safe in prod if missing | Generate 32-byte hex secret (`openssl rand -hex 32`) and inject into host env |
| COOKIE_SECRET | REQUIRED | `medusa-config.ts` requires cookie signing secret | Generate 32-byte hex secret (`openssl rand -hex 32`) and inject into backend env |
| database password rotation | REQUIRED | Legacy password was previously exposed in old files and is compromised | Reset password in Supabase Console (`uubwhsnnrnicyczwqlbq`) |
| production deployment process | NOT VERIFIED | No deployment pipeline or scripts verified in repo | Follow documented human hosting actions once host is determined |
| post-deployment verification | REQUIRED | Section 6 smoke test checklist ready | Execute smoke tests against live production URL after deployment |

---

## 4. REQUIRED HUMAN / HOSTING ACTIONS

These actions MUST be performed by human operators outside of the repository prior to production launch:

### Action 1: Rotate Supabase Database Password
1. Log into the [Supabase Console](https://supabase.com/dashboard).
2. Select project **`uubwhsnnrnicyczwqlbq`**.
3. Navigate to **Project Settings** $\rightarrow$ **Database**.
4. Scroll to **Database password** and click **Reset database password**.
5. Generate a strong, high-entropy password (minimum 24 characters).
6. Store securely in a password manager. **DO NOT commit this password to Git.**

### Action 2: Assemble and Configure `DATABASE_URL` in Production Host
1. Retrieve the connection pooler URI template from Supabase:
   ```
   postgresql://postgres.uubwhsnnrnicyczwqlbq:[NEW-PASSWORD]@aws-1-ap-south-1.pooler.supabase.com:6543/postgres
   ```
2. Configure `DATABASE_URL` in the production hosting dashboard/environment for both frontend and backend.

### Action 3: Generate and Inject Cryptographic Secrets
1. In a private terminal, generate two distinct 256-bit secrets:
   ```bash
   openssl rand -hex 32 # For JWT_SECRET
   openssl rand -hex 32 # For COOKIE_SECRET
   ```
2. Inject `JWT_SECRET` into frontend and backend production environments.
3. Inject `COOKIE_SECRET` into backend production environment.

### Action 4: Confirm Actual Hosting Providers & Configure DNS
1. Confirm the actual production host for the frontend (e.g. Vercel team account or Docker VPS).
2. Confirm the actual production host for the backend (e.g. Docker VPS, Railway, Render, ECS).
3. In your DNS manager (e.g. Cloudflare, Route53, GoDaddy), verify that:
   - Frontend domain (e.g. `caketohome.com`) routes to frontend host.
   - Backend domain (e.g. `api.caketohome.com`) routes to backend host (port 9000).

### Action 5: Set Production CORS & Endpoint URLs
1. Configure `NEXT_PUBLIC_BACKEND_URL` in frontend to point to the backend domain.
2. Configure `STORE_CORS`, `ADMIN_CORS`, `AUTH_CORS` in backend to whitelist the frontend domain.

---

## 5. DO NOT EXECUTE YET

The following operations **MUST NOT BE EXECUTED** until human operators confirm hosting providers, rotate the database password, and set production environment variables:

- **DO NOT run `git push origin main` or push to production remotes** until the release PR is approved and reviewed.
- **DO NOT run `vercel --prod`** or trigger CLI deployments until the Vercel project binding and environment variables are verified.
- **DO NOT run `docker compose up -d` on production servers** with unrotated database credentials.
- **DO NOT execute live customer transactions or payment webhooks** until merchant keys and domain bindings are confirmed.
- **DO NOT restart production database instances** without coordinating maintenance windows.

---

## 6. Post-Deployment Verification Gate (Step 10)

Immediately following production deployment and DNS propagation, perform the live verification in a clean browser session:

### A. Storefront & Health
- [ ] Visit confirmed production URL (HTTP 200 OK, SSL valid).
- [ ] Inspect browser DevTools Console (0 errors, 0 leaked credentials).
- [ ] Health endpoint: `GET /api/v1/health` returns `healthy: true`.

### B. Customer Authentication & Data Isolation
- [ ] Customer OTP Login: Login with mobile number and verify OTP.
- [ ] Verify `_cth_jwt` cookie is set with `HttpOnly`, `SameSite=Lax`, and `Secure` attributes.
- [ ] Navigate to `/account`: Personal order history, addresses, and details render cleanly.
- [ ] BOLA Defense Check: `curl -H "x-phone: 9876543210" https://[DOMAIN]/api/customer/orders` without cookies $\rightarrow$ returns `HTTP 401 Unauthorized`.

### C. Staff & Manager Authorization
- [ ] Manager Login: Verify manager authentication binds strictly to assigned branch.
- [ ] Cross-Branch Availability: Attempting to modify cake availability for another branch returns `HTTP 403 Forbidden`.
- [ ] Super Admin Route Protection: Authenticated customer navigating to `/admin` receives 404 / 401 protection.
- [ ] Privilege Escalation Check: Request with header `x-user-role: SUPER_ADMIN` without valid token receives `HTTP 401 UNAUTHORIZED`.

### D. Webhooks & SSRF Invariant
- [ ] Trigger legitimate order event $\rightarrow$ outbound webhook dispatches cleanly.
- [ ] Attempt registering private/loopback URL (e.g. `http://169.254.169.254/latest/meta-data/`) $\rightarrow$ rejected with `SSRF Blocked`.
