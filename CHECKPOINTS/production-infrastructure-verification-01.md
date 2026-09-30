# CakeToHome — Read-Only Production Infrastructure Verification Report

**Date & Time:** September 20, 2026, 12:30:00 IST  
**Document:** `CHECKPOINTS/production-infrastructure-verification-01.md`  
**Repository Path:** `E:\vig\cakes2home-main\cakes2home-main`  
**Current Branch:** `task/dev`  
**Head Commit:** `308162125fd72ef30c31176ac3312b9e15ff55a2` (with clean security-hardened working tree)  
**Verification Scope:** Read-Only Factual Infrastructure Audit (Zero Deployments, Zero Pushes, Zero Secret Rotations)  

---

## 1. Safety & Execution Attestation

In accordance with strict operational rules, the following assertions are confirmed factually:
- **NO DEPLOYMENT WAS PERFORMED**: Neither Vercel, Docker host, nor cloud provider was deployed or touched.
- **NO SECRET WAS ROTATED**: The Supabase database password, JWT secrets, and payment credentials were not modified or rotated in the live environment.
- **NO GIT PUSH WAS PERFORMED**: No commits or branches were pushed to `origin` or any remote repository.
- **READ-ONLY INSPECTION ONLY**: Verification was conducted strictly via repository configuration analysis, code tracing, and local git metadata inspection.

---

## 2. Git Remote & Source Evidence (Phase 1)

- **Repository Root:** `E:\vig\cakes2home-main\cakes2home-main`
- **Current Branch:** `task/dev` (tracking `origin/task/dev`)
- **Configured Remotes:**
  ```text
  origin  https://github.com/akshayjoy33/caketohome.git (fetch)
  origin  https://github.com/akshayjoy33/caketohome.git (push)
  ```
- **Remote Host:** GitHub (`github.com/akshayjoy33/caketohome.git`).
- **Production Branch Evidence:**
  - `origin/main` exists in remote references (`.git/refs/remotes/origin/HEAD` points to `origin/main`).
  - `refs/remotes/origin/main` exists in `.git/packed-refs`.
- **Current Branch Relationship to Production:**
  - The local branch `task/dev` is **NOT** connected to any automated production deployment.
  - Merging into `main` or deploying from a designated release branch requires manual PR review and approval.

---

## 3. Frontend Hosting Evidence (Phase 2)

- **Application Framework:** Next.js 14.1.4 App Router (`frontend/package.json`).
- **Runtime Target:** Node.js 20.
- **Vercel Manifest Inspection:**
  - `vercel.json` exists in repo: **NO** (`False`).
  - `.vercel` directory exists in repo: **NO** (`False`).
  - Vercel Project ID / Org ID configured in repo: **NO**.
  - Package scripts: Only standard `next dev`, `next build`, `next start`, `next lint`. Zero Vercel CLI deploy scripts.
- **Vercel Mentions in Code:**
  - `frontend/next.config.mjs` line 41: `caketohome.vercel.app` is listed in `images.remotePatterns` as an allowed hostname for remote image loading.
  - `frontend/src/lib/security/sessions.ts`: Checks `process.env.VERCEL_ENV === "production"` to set secure cookie flags if deployed on Vercel.
- **Container Packaging:**
  - `frontend/Dockerfile` exists: Multi-stage Alpine container (`node:20-alpine`, `EXPOSE 3000`, `CMD ["npm", "start"]`).
- **Confirmed Domains:**
  - `caketohome.com`: NOT VERIFIED FROM AVAILABLE EVIDENCE.
  - `caketohome.vercel.app`: NOT VERIFIED FROM AVAILABLE EVIDENCE.
- **Finding:** **Frontend hosting is NOT VERIFIED FROM AVAILABLE EVIDENCE (UNKNOWN)**. The application codebase is architecturally compatible with both Vercel and standalone Docker/Node containers, but the active production host cannot be proven from repository files alone.

---

## 4. Backend Hosting Evidence (Phase 3)

- **Backend Framework:** Medusa.js v2 (`@medusajs/medusa` v2.17.2, Node.js 20).
- **Process Architecture:** Long-running CLI server process (`node node_modules/@medusajs/cli/cli.js start` on port 9000). Handles MikroORM database connections, asynchronous event bus, and scheduled jobs. Cannot run on serverless edge functions.
- **Container Packaging:**
  - `backend/Dockerfile` exists: `node:20-alpine`, `EXPOSE 9000`.
  - Root `docker-compose.yml` defines the `backend` service exposing port 9000.
- **Cloud Provider Manifest Inspection:**
  - Railway (`railway.json`): Does NOT exist.
  - Render (`render.yaml`): Does NOT exist.
  - Fly.io (`fly.toml`): Does NOT exist.
  - AWS ECS / CDK / Terraform / Kubernetes: Does NOT exist in repo.
- **Backend Endpoint:**
  - `api.caketohome.com` appears as an intended URL in documentation and SSRF validator allowed lists, but is **NOT VERIFIED FROM REPOSITORY EVIDENCE (UNKNOWN)**.
- **Finding:** **Backend hosting is NOT VERIFIED FROM REPOSITORY EVIDENCE (UNKNOWN)**. The repository proves Docker container readiness, but provides no evidence of the live hosting provider.

---

## 5. Database Target Evidence (Phase 4)

- **Database Provider:** **Supabase** Managed PostgreSQL 17.6.
- **Host:** `aws-1-ap-south-1.pooler.supabase.com`.
- **Port:** `6543` (PgBouncer Connection Pooler).
- **Database Name:** `postgres`.
- **Project Reference:** `uubwhsnnrnicyczwqlbq`.
- **Region:** AWS `ap-south-1` (Mumbai, India).
- **Environment Variable Consumption:**
  - `frontend/src/lib/db.ts` (Prisma client instance).
  - `backend/medusa-config.ts` (`projectConfig.databaseUrl: process.env.DATABASE_URL`).
  - Seeding and verification scripts (`verify-database-first.mjs`, `verify-restart-persistence.mjs`, `verify-services-and-repositories.mjs`, `backend/create_tables.js`).
- **Credential Security Status:**
  - All plaintext connection strings have been eradicated from source files, scripts, and docker manifests.
  - The legacy database password was previously committed in historical files and is **COMPROMISED**.
  - **MANDATORY REQUIREMENT:** The database password must be rotated in the Supabase Console before production release.

---

## 6. Domain & DNS Evidence (Phase 8)

- **Inspected Domains in Code:**
  - `caketohome.com` / `cakes2home.com`: Fallback string in `frontend/src/lib/config/site.ts` (`process.env.NEXT_PUBLIC_BASE_URL || "https://cakes2home.com"`).
  - `api.caketohome.com`: Sample endpoint and allowed hostname in SSRF validator.
  - `caketohome.vercel.app`: Image whitelist pattern in `next.config.mjs`.
- **Finding:** **DNS STATUS NOT VERIFIABLE FROM REPOSITORY**. Live DNS records (A, CNAME, ALIAS), registrar routing, and active CDN bindings cannot be inspected from workspace files.

---

## 7. CI/CD Evidence (Phase 7)

- **Inspected Workflow:** `.github/workflows/ci.yml`.
- **Trigger Triggers:**
  - `push` to branches `[ main, develop ]`.
  - `pull_request` to branches `[ main, develop ]`.
- **Workflow Jobs & Steps:**
  - OS: `ubuntu-latest`.
  - Steps: `actions/checkout@v4`, `actions/setup-node@v4` (node 20), dependency caching, `npm ci`, `npm run lint`, `npx prisma generate`, `node scripts/verify-database-first.mjs`.
- **Classification:** **TEST ONLY & BUILD ONLY**.
- **Deployment Steps:** Zero deployment commands (no Vercel deploy, no Docker push, no SSH/rsync, no AWS/cloud action).
- **Finding:** **NO AUTOMATIC DEPLOYMENT PIPELINE VERIFIED IN REPOSITORY**.

---

## 8. Docker Architecture Evidence (Phase 6)

- **Root `docker-compose.yml`:**
  - Services: `backend` (port 9000) and `frontend` (port 3000).
  - Both frontend and backend are included.
  - Database: Connects externally to `${DATABASE_URL}` (Supabase pooler). PostgreSQL is NOT containerized in this file.
  - Credentials: Zero hardcoded credentials. All secrets are cleanly interpolated via `${DATABASE_URL}`, `${JWT_SECRET}`, `${COOKIE_SECRET}`.
  - Deployment Role: Suitable for running on a single Linux VPS host with a production `.env` file, but not proven as the active production system.
- **Development Compose `docker/docker-compose.yml`:**
  - Services: `postgres:16-alpine` (port 5432) and `redis:7-alpine` (port 6379).
  - Role: Strictly for offline/local development and testing.

---

## 9. Environment Variables Verification Matrix (Phase 5)

| Variable | Used by | Required? | Server/client | Evidence in Codebase | Production value known? |
|---|---|---|---|---|---|
| `DATABASE_URL` | Frontend (`db.ts`, Prisma), Backend (`medusa-config.ts`), scripts | Required by source code & framework | Server-only | `frontend/src/lib/db.ts`, `backend/medusa-config.ts` | Host/project verified; active password UNKNOWN (must be rotated) |
| `JWT_SECRET` | Frontend (`auth-session.ts`), Backend (`medusa-config.ts`) | Required by source code (fails safe in prod if missing) | Server-only | `frontend/src/lib/security/auth-session.ts:25`, `backend/medusa-config.ts:16` | UNKNOWN (must be generated: 256-bit random hex) |
| `COOKIE_SECRET` | Backend (`medusa-config.ts`) | Required by Medusa framework | Server-only | `backend/medusa-config.ts:15` | UNKNOWN (must be generated: 256-bit random hex) |
| `NODE_ENV` | Next.js, Medusa, auth-session | Required by runtime/framework | Server & client (ambient) | `auth-session.ts:26`, `next.config.mjs` | Standard (`production`) |
| `NEXT_PUBLIC_BASE_URL` | Frontend SEO, OpenGraph, sitemaps, robots.txt | Optional in dev (fallback `https://cakes2home.com`), Recommended in prod | Client & server | `frontend/src/lib/config/site.ts`, `frontend/src/app/sitemap.ts` | UNKNOWN / NOT VERIFIED (intended custom domain) |
| `NEXT_PUBLIC_BACKEND_URL` | Frontend API client routing commerce calls to Medusa | Required if frontend communicates with Medusa API | Client & server | `frontend/src/lib/medusa/client.ts` | UNKNOWN / NOT VERIFIED (intended backend endpoint) |
| `BACKEND_URL` | Medusa internal / admin redirects | Optional (fallback `http://localhost:9000`) | Server-only | `backend/medusa-config.ts` | UNKNOWN / NOT VERIFIED |
| `STORE_CORS` | Backend (`medusa-config.ts`) | Required by Medusa in production | Server-only | `backend/medusa-config.ts:7` | UNKNOWN / Configurable based on final storefront domain |
| `ADMIN_CORS` | Backend (`medusa-config.ts`) | Required by Medusa in production | Server-only | `backend/medusa-config.ts:8` | UNKNOWN / Configurable based on final admin domain |
| `AUTH_CORS` | Backend (`medusa-config.ts`) | Required by Medusa in production | Server-only | `backend/medusa-config.ts:9` | UNKNOWN / Configurable based on final storefront/admin domains |
| `NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY` | Frontend Medusa store client | Optional if using direct DB repo, Required if calling Medusa Store API | Client & server | `frontend/src/lib/medusa/client.ts:8` | UNKNOWN (generated in Medusa Admin) |
| `RAZORPAY_KEY_ID` | Payment gateway client/server | Production-only (optional in test/dev mode) | Client & server | `frontend/src/lib/services/payment.service.ts` | UNKNOWN (merchant live key) |
| `RAZORPAY_KEY_SECRET` | Payment gateway server verification | Production-only (optional in test/dev mode) | Server-only | `frontend/src/lib/services/payment.service.ts` | UNKNOWN (merchant live secret) |
| `REDIS_URL` | Medusa v2 event bus & cache | Optional in single-node dev, Recommended for prod cluster | Server-only | `backend/medusa-config.ts:17` | UNKNOWN / Inferred for multi-worker backend |

---

## 10. n8n / Webhook Architecture Evidence (Phase 9)

- **Webhook URL in Code:** `https://n8n.caketohome.com/webhook/v1/caketohome-events` in `frontend/src/lib/webhooks/webhook-engine.ts`.
- **Configurability:** Configurable via environment variable or database settings.
- **SSRF Defenses:** Validated against `validateWebhookUrl` (`ssrf-validator.ts`), which blocks private subnets (`10.0.0.0/8`, `172.16.0.0/12`, `192.168.0.0/16`), loopback (`127.0.0.0/8`, `::1`), link-local (`169.254.0.0/16`), and enforces `redirect: "error"`.
- **Production Status:** **NOT VERIFIED AS ACTIVE PRODUCTION INFRASTRUCTURE**. The repository does not prove that an n8n container or service is currently live or receiving traffic.

---

## 11. Security Status (Phase 10)

- **Audit Remediation Baseline:** 7/7 high-impact findings from Cloudflare audit remediated and verified.
- **Critical Findings:** 2/2 Remediated & Validated (Auth bypass in `verifyApiPermission`, role spoofing via headers).
- **High Findings:** 5/5 Remediated & Validated (Super-admin substring check, Customer Orders BOLA, Customer Profile BOLA, DB credentials expunged, Webhook SSRF).
- **Automated Regression Suite:** **21 / 21 PASS (100%)** (`scripts/run-security-regression-tests.ps1`).
- **Static Analysis:** TypeScript (`tsc --noEmit`) = 0 errors; ESLint = 0 errors; Next.js build = PASS.
- **Secret Hygiene:** All hardcoded credentials have been expunged from the codebase.
- **Compromised Secret:** The previously exposed Supabase database password remains compromised until rotated in the Supabase console.

---

## 12. Unresolved Infrastructure Questions

1. **Frontend Hosting Platform:** Is the frontend deployed to Vercel (under which team/account), a containerized Linux VPS, or another cloud provider?
2. **Backend Hosting Platform:** Where is the long-running Medusa v2 Node process hosted (Docker VPS, Railway, Render, AWS ECS, or Fly.io)?
3. **DNS & SSL Management:** Where are DNS records for `caketohome.com` and `api.caketohome.com` hosted (Cloudflare, AWS Route53, Namecheap, GoDaddy), and are they configured?
4. **n8n Instance:** Is the n8n webhook workflow active in production, or was it set up as a prototype integration?
5. **Production Credentials:** What are the designated production values for `JWT_SECRET`, `COOKIE_SECRET`, and the rotated `DATABASE_URL`?

---

## 13. Deployment Readiness Matrix

| Area | Status | Evidence | Required Action |
|---|---|---|---|
| Git repository | VERIFIED | Root at `E:\vig\cakes2home-main\cakes2home-main`, remote `origin` -> `github.com/akshayjoy33/caketohome.git` | Maintain clean working tree on `task/dev` |
| production branch | VERIFIED | `origin/main` exists in Git refs | Stage PR from `task/dev` to `main` once cleared |
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
| post-deployment verification | REQUIRED | Post-deployment smoke test checklist ready | Execute smoke tests against live production URL after deployment |

---

## 14. Exact Next Actions

1. **Supabase Database Password Rotation:** Human administrator must log into the Supabase Console (`uubwhsnnrnicyczwqlbq`) and reset the database password.
2. **Hosting Identification:** Human administrator must identify the live hosting platform for frontend and backend.
3. **Environment Injection:** Inject the rotated `DATABASE_URL`, newly generated `JWT_SECRET` (256-bit hex), and `COOKIE_SECRET` (256-bit hex) into the production environment.
4. **DNS & CORS Alignment:** Ensure `NEXT_PUBLIC_BACKEND_URL`, `STORE_CORS`, `ADMIN_CORS`, and `AUTH_CORS` match verified production domains.
5. **Staged Release:** Create a Pull Request from `task/dev` to `main`, review, merge, and initiate deployment.
6. **Live Post-Deployment Verification:** Run the smoke test suite detailed in `CHECKPOINTS/security-production-handoff-01.md`.
