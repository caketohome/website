# CakeToHome — Production Host Identification & Environment File Audit

**Date & Time:** September 20, 2026, 12:55:00 IST  
**Document:** `CHECKPOINTS/production-host-identification-01.md`  
**Repository Path:** `E:\vig\cakes2home-main\cakes2home-main`  
**Current Branch:** `task/dev`  
**Audit Scope:** Read-Only Environment File Inspection & Production Host Determination  

---

## 1. Safety & Execution Attestation

- **NO SECRET VALUES WERE PRINTED OR COMMITTED.**
- **NO ENVIRONMENT FILES WERE MODIFIED.**
- **NO DEPLOYMENT WAS PERFORMED.**
- **NO GIT PUSH WAS EXECUTED.**
- **NO PRODUCTION INFRASTRUCTURE WAS CHANGED.**
- **NO DATABASE PASSWORDS WERE ROTATED.**

---

## 2. ENVIRONMENT FILE AUDIT & LOCAL CONFIGURATION

Comprehensive read-only inspection of all environment files in the repository:

### A. File Inventory & Classification

| File Path | Status | Size | Classification | Evidence & Details |
|---|---|---|---|---|
| `.env` (root) | Exists | 0 bytes | **EMPTY / INACTIVE** | 0 lines, no variables configured |
| `backend/.env` | Exists | 464 bytes | **LOCAL DEVELOPMENT** | All CORS/URLs point to `localhost`; `JWT_SECRET` & `COOKIE_SECRET` are trivial placeholders (`supersecret`); `DATABASE_URL` points to Supabase pooler |
| `backend/.env.template` | Exists | 585 bytes | **DEV TEMPLATE (TRACKED)** | Safe documentation template; placeholders only (`CHANGE_ME...`, `localhost:5432`) |
| `frontend/.env` | Exists | 296 bytes | **LOCAL DEVELOPMENT** | `NEXT_PUBLIC_BACKEND_URL=http://localhost:9000`; `JWT_SECRET=supersecret`; `DATABASE_URL` points to Supabase pooler |
| `frontend/.env.template` | Exists | 296 bytes | **DEV TEMPLATE (TRACKED)** | Safe documentation template; placeholders only (`your_medusa_publishable_key`, `CHANGE_ME...`) |
| `frontend/.env.local` | **Does NOT Exist** | 0 bytes | **NOT PRESENT** | Verified non-existent via filesystem search |

---

### B. Important Variables Matrix (Local Environment Files)

| Variable | Present in Files | Environment Indication | Sensitive? | Purpose / Used by |
|---|---|---|---|---|
| `DATABASE_URL` | `backend/.env`, `frontend/.env` | Remote Supabase Pooler (`aws-1-ap-south-1.pooler.supabase.com:6543`) | **YES** (Redacted: `postgresql://[REDACTED_CREDENTIAL]@aws-1-ap-south-1.pooler.supabase.com:6543/postgres`) | Medusa backend & Prisma frontend database queries |
| `DATABASE_TYPE` | `backend/.env` | `postgres` | No | Medusa v2 DB provider selection |
| `FRONTEND_URL` | `backend/.env` | `http://localhost:3000` (Localhost) | No | Medusa CORS & email link generation |
| `NEXT_PUBLIC_BACKEND_URL` | `frontend/.env` | `http://localhost:9000` (Localhost) | No | Frontend API client requests to Medusa |
| `NEXT_PUBLIC_BASE_URL` | `frontend/.env` | `http://localhost:3000` (Localhost) | No | Dynamic sitemaps, canonical tags, OpenGraph URLs |
| `JWT_SECRET` | `backend/.env`, `frontend/.env` | `supersecret` (Trivial local dev placeholder) | **YES** | HMAC-SHA256 session token signing/verification |
| `COOKIE_SECRET` | `backend/.env` | `supersecret` (Trivial local dev placeholder) | **YES** | Medusa admin session cookie signing |
| `STORE_CORS` | `backend/.env` | `http://localhost:3000,http://localhost:7001,http://localhost:9000` (Localhost) | No | Allowed origins for storefront API access |
| `ADMIN_CORS` | `backend/.env` | `http://localhost:7001,http://localhost:9000,http://localhost:3000` (Localhost) | No | Allowed origins for admin API access |
| `AUTH_CORS` | `backend/.env` | `http://localhost:3000,http://localhost:7001,http://localhost:9000` (Localhost) | No | Allowed origins for auth API access |
| `DISABLE_MEDUSA_ADMIN`| `backend/.env` | `true` | No | Disables default Medusa Admin dashboard |
| `NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY` | `frontend/.env` | Standard publishable token (`pk_...`) | No (Public by design) | Frontend storefront API scope channel |

---

### C. Git Tracking Status

- `git ls-files` check confirms:
  - `.env` $\rightarrow$ **UNTRACKED / IGNORED**
  - `backend/.env` $\rightarrow$ **UNTRACKED / IGNORED**
  - `frontend/.env` $\rightarrow$ **UNTRACKED / IGNORED**
  - `frontend/.env.local` $\rightarrow$ **DOES NOT EXIST**
  - `backend/.env.template` $\rightarrow$ **TRACKED** (Safe template)
  - `frontend/.env.template` $\rightarrow$ **TRACKED** (Safe template)

---

### D. `.gitignore` Policy Audit

- The root `.gitignore` file enforces comprehensive rules:
  ```gitignore
  # Environment files (secrets must not be committed)
  .env
  .env.*
  !.env.template
  !.env.example
  backend/.env
  backend/.env.*
  !backend/.env.template
  !backend/.env.example
  frontend/.env
  frontend/.env.*
  !frontend/.env.template
  !frontend/.env.example
  ```
- **Finding:** The repository has an active, safe `.gitignore` policy. Real `.env` files are ignored while templates are permitted.

---

### E. Git History Audit

- `git log --all --full-history` queries confirmed:
  - `.env` was **NEVER** committed to Git history.
  - `backend/.env` was **NEVER** committed to Git history.
  - `frontend/.env` was **NEVER** committed to Git history.
  - `frontend/.env.local` was **NEVER** committed to Git history.
  - Only template files (`backend/.env.template`, `frontend/.env.template`), TypeScript definitions (`frontend/next-env.d.ts`), and documentation (`docs/12-environment.md`) exist in Git history.

---

### F. Database Credential Exposure & Safety

- Both `backend/.env` and `frontend/.env` contain the identical connection pooler URI:
  ```
  postgresql://postgres.uubwhsnnrnicyczwqlbq:[REDACTED]@aws-1-ap-south-1.pooler.supabase.com:6543/postgres
  ```
- The database password contained in these local development files matches the legacy password previously flagged in historical non-env audit files.
- **Operational Directive:** Because the active production host is not yet established, **DO NOT rotate the Supabase database password yet**. Rotating it now would break any active production application that currently relies on the shared Supabase database before we know where its production environment configuration lives.

---

## 3. DOES LOCAL ENV REVEAL THE PRODUCTION HOST?

- **NO.**
- The local environment files contain **zero references** to production domains (`caketohome.com`, `api.caketohome.com`), cloud hosting providers (Vercel, Railway, Render, Fly.io, AWS), or server IPs.
- Every endpoint configuration (`FRONTEND_URL`, `NEXT_PUBLIC_BACKEND_URL`, `NEXT_PUBLIC_BASE_URL`, `STORE_CORS`, `ADMIN_CORS`, `AUTH_CORS`) points strictly to `localhost:3000`, `localhost:7001`, or `localhost:9000`.
- The only non-localhost endpoint is the Supabase database pooler host (`aws-1-ap-south-1.pooler.supabase.com:6543`).

---

## 4. Unresolved Items & Next Actions

1. **Production Host Remains UNKNOWN:**
   - Frontend host is not revealed by local env files (requires external human confirmation or authenticated provider CLI/DNS check).
   - Backend host is not revealed by local env files (requires external human confirmation or authenticated provider CLI/DNS check).
2. **Next Safe Operational Step:**
   - Perform external read-only checks (DNS record inspection or querying project owners/cloud accounts) to identify the live hosting environment.
   - Once the production platform is confirmed, inject the new production secrets and schedule the database credential rotation.
