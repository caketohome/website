# CakeToHome — External Production Host & Live Domain Audit

**Date & Time:** September 20, 2026, 13:05:00 IST  
**Document:** `CHECKPOINTS/external-production-host-identification-01.md`  
**Repository Path:** `E:\vig\cakes2home-main\cakes2home-main`  
**Current Branch:** `task/dev`  
**Audit Scope:** Read-Only External DNS, HTTP Probing, CLI Availability, and Live Infrastructure Verification  

---

## 1. Safety & Execution Attestation

- **NO DEPLOYMENT WAS PERFORMED.**
- **NO `git push` OR BRANCH MERGES OCCURRED.**
- **NO DNS RECORDS WERE ALTERED.**
- **NO SECRETS WERE ROTATED OR MODIFIED.**
- **NO PRODUCTION HOST OR SERVICE WAS TOUCHED.**
- **ZERO SENSITIVE CREDENTIALS WERE EXPOSED.**

---

## 2. CLI Tooling & Provider Account Accessibility

A read-only search for cloud and hosting CLI binaries on the system yielded:

| Tool | Purpose | Found? | Status |
|---|---|---|---|
| `gh` | GitHub CLI | **NOT FOUND** | GITHUB EXTERNAL METADATA NOT ACCESSIBLE |
| `vercel` | Vercel Deployment CLI | **NOT FOUND** | VERCEL ACCOUNT NOT ACCESSIBLE |
| `railway` | Railway Cloud CLI | **NOT FOUND** | NOT ACCESSIBLE |
| `flyctl` / `fly` | Fly.io Cloud CLI | **NOT FOUND** | NOT ACCESSIBLE |
| `aws` | Amazon Web Services CLI | **NOT FOUND** | NOT ACCESSIBLE |
| `doctl` | DigitalOcean CLI | **NOT FOUND** | NOT ACCESSIBLE |
| `az` | Microsoft Azure CLI | **NOT FOUND** | NOT ACCESSIBLE |
| `gcloud` | Google Cloud CLI | **NOT FOUND** | NOT ACCESSIBLE |

---

## 3. Live DNS & HTTP Probing Evidence

Read-only DNS resolution (`Resolve-DnsName`) and HTTP endpoint inspection (`Invoke-WebRequest`) were conducted against all known candidate domains:

### A. Domain `caketohome.com` (Target Domain with 't')
- **DNS Resolution:** YES.
  - Record: Type `A` $\rightarrow$ `198.54.117.242`.
- **Hosting Provider Signature:** **Namecheap Web Hosting / Domain Parking** (`Server: namecheap-web`).
- **HTTP Status:** `HTTP 200 OK` (Namecheap parking response).
- **HTTPS Status:** Connection timeout / No SSL certificate configured.
- **Finding:** Domain is registered at Namecheap and points to default Namecheap parking servers. It is **NOT** serving the CakeToHome application.

### B. Domain `www.caketohome.com`
- **DNS Resolution:** YES.
  - Record: Type `A` $\rightarrow$ `198.54.117.242` (Namecheap parking).
- **Finding:** Identical to apex domain; parked at Namecheap.

### C. Subdomain `api.caketohome.com`
- **DNS Resolution:** YES.
  - Record: Type `A` $\rightarrow$ `198.54.117.242` (Namecheap parking).
- **HTTP Status:** `HTTP 200 OK` (Namecheap parking page).
- **Health Endpoint (`https://api.caketohome.com/health`):** Connection timeout.
- **Finding:** The API subdomain has not been routed to any backend server; it is parked at Namecheap. **NO Medusa backend is deployed here.**

### D. Subdomain `caketohome.vercel.app` (Vercel Candidate)
- **DNS Resolution:** YES.
  - Record: Type `A` $\rightarrow$ `216.198.79.3`, `64.29.17.3` (Vercel Anycast IP pool).
  - NS: `ns1.vercel-dns-3.com`, `ns2.vercel-dns-3.com`.
- **HTTP/HTTPS Status:** **HTTP 404 Not Found** (Vercel default error for non-existent or deleted project).
- **Finding:** No active deployment exists on `caketohome.vercel.app`.

### E. Domain `cakes2home.com` (Alternative Spelling with 's' from `site.ts`)
- **DNS Resolution:** YES.
  - Record: Type `A` $\rightarrow$ `93.127.173.164`, `88.222.243.251`.
  - Record: Type `CNAME` for `www` $\rightarrow$ `www.cakes2home.com.cdn.hstgr.net`.
- **Hosting Provider Signature:** **Hostinger Horizons CDN** (`Server: hcdn`, `X-Powered-By: Hostinger Horizons`).
- **HTTPS Status:** `HTTP 200 OK`.
- **Page Title:** `<title>Hostinger Horizons</title>`.
- **Page Content:** Default starter Vite template (`<meta name="generator" content="Hostinger Horizons" />`).
- **Finding:** `cakes2home.com` is hosted on Hostinger serving an untouched AI website builder placeholder page. It is **NOT** the Next.js/Medusa application from this repository.

### F. Subdomain `api.cakes2home.com`
- **DNS Resolution:** **FAILED / NXDOMAIN** (DNS name does not exist).
- **Finding:** No API subdomain exists under `cakes2home.com`.

---

## 4. Factual Hosting Architecture Map

| Component | Actual Evidence | Factual Status |
|---|---|---|
| **GitHub Repository** | `https://github.com/akshayjoy33/caketohome.git`, branch `task/dev`, remote `origin/main` | **VERIFIED** |
| **CI/CD Pipeline** | `.github/workflows/ci.yml` (Lint, Prisma, verify script only) | **VERIFIED (TEST/BUILD ONLY)** |
| **Frontend Production Host** | `caketohome.com` is parked on Namecheap; `caketohome.vercel.app` is 404; `cakes2home.com` is Hostinger Horizons starter | **NOT DEPLOYED (NO LIVE HOST)** |
| **Backend Production Host** | `api.caketohome.com` points to Namecheap parking; `api.cakes2home.com` is NXDOMAIN | **NOT DEPLOYED (NO LIVE HOST)** |
| **Database Target** | Supabase Managed PostgreSQL 17.6 pooler (`aws-1-ap-south-1.pooler.supabase.com:6543`, project `uubwhsnnrnicyczwqlbq`) | **VERIFIED (ACTIVE SUPABASE INSTANCE)** |
| **DNS Management** | `caketohome.com` @ Namecheap nameservers; `cakes2home.com` @ Hostinger CDN nameservers | **VERIFIED (PARKED / UNCONFIGURED)** |
| **n8n Automation** | `https://n8n.caketohome.com` does not exist in active DNS | **NOT DEPLOYED** |
| **Payment Provider** | Razorpay integration code present in repo; no live keys configured | **CODE READY / UNCONFIGURED** |

---

## 5. Location of Production Database Configuration

- **CRITICAL FACTUAL DISCOVERY:**
  Because neither the frontend nor the backend is currently deployed to any live cloud provider, **THERE IS CURRENTLY NO LIVE PRODUCTION ENVIRONMENT WHERE `DATABASE_URL` IS CONFIGURED.**
- The only configured instances of `DATABASE_URL` in existence are the local development environment files on this developer machine (`backend/.env` and `frontend/.env`), plus past inspection scripts.
- **IMPLICATION FOR DATABASE PASSWORD ROTATION:**
  - There is **no live production application that will be broken** if the database password is reset, because no production application is running.
  - However, resetting the password will immediately affect local development and testing until the local `.env` files are updated with the new password.

---

## 6. Unresolved Items & Operational Decisions

1. **Intended Domain Decision:**
   - Which domain is the true production domain: `caketohome.com` (currently at Namecheap) or `cakes2home.com` (currently at Hostinger)?
2. **Hosting Provider Selection:**
   - Where should the frontend be hosted? (e.g. Vercel team account or Docker VPS container).
   - Where should the backend be hosted? (e.g. Docker VPS, Railway, Render, or AWS ECS running `backend/Dockerfile` on port 9000).
3. **DNS Cutover:**
   - Once hosting platforms are provisioned, DNS records at Namecheap / Hostinger must be pointed away from parking servers to the live hosting provider.

---

## 7. Exact Next Actions

1. **Step 1:** The product owner must decide on the production domain and target hosting platforms (e.g. Vercel for frontend + VPS/Docker for backend).
2. **Step 2:** Human administrator logs into the Supabase Console (`uubwhsnnrnicyczwqlbq`) and resets the database password.
3. **Step 3:** Update the local `.env` files with the new database password.
4. **Step 4:** Provision the production hosting services, input the new `DATABASE_URL`, newly generated `JWT_SECRET`, and `COOKIE_SECRET`.
5. **Step 5:** Point DNS records to the newly provisioned hosts.
6. **Step 6:** Deploy the hardened codebase from `task/dev` (via release PR to `main`) and execute the post-deployment smoke test suite.
