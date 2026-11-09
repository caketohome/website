# CakeToHome — PRG-01 Step 1: Production Infrastructure & Environment Forensic Checkpoint

**Date:** 2026-10-02  
**Gate:** PRG-01 Step 1 — Production Infrastructure & Environment Forensic Gate  
**Mode:** READ-ONLY / NON-MUTATING / INSPECTION & READINESS PLANNING  
**Status:** **INSPECTION COMPLETE — READY FOR PRG-02 INFRASTRUCTURE PROVISIONING**  

---

## 1. Executive Summary

This forensic gate performed an exhaustive, non-mutating inspection of CakeToHome's runtime requirements, infrastructure dependencies, secret hygiene, database security, and deployment readiness to prepare the system for production.

### Core Declarations
1. **ERP Engineering & Dashboard UI Remain FROZEN**:
   - Zero application code, accounting rules, order lifecycles, or UI layouts were altered.
   - Cumulative assertions remain verified at **1,242 / 1,242 PASS (100%)**.
   - TypeScript compilation remains clean with **0 errors**.
2. **Zero Production Mutation**:
   - No production resources were provisioned, no DNS was altered, no database migrations were applied to production, and no live payment or WhatsApp messages were triggered.
   - Development PostgreSQL remains 100% pristine (173 active orders, 0 vouchers, 0 journal entries, 0 invoices).
3. **Primary Production Separation Finding**:
   - The current development Supabase instance (`uubwhsnnrnicyczwqlbq`) **MUST NOT** be used for production. A completely new, isolated production database project with fresh credentials and clean schemas must be provisioned.
   - Legacy scripts containing hardcoded dev passwords were identified in git history; all production credentials must be freshly generated and strictly injected via runtime environment variables.

---

## 2. Deployment Architecture Summary

CakeToHome operates as a decoupled dual-service architecture:
1. **Frontend / Operational Engine (Next.js 14+ App Router)**:
   - Exposes customer storefront, `/dashboard/shop` (Branch Operations), and `/dashboard` (Central Accounting & Super Admin).
   - Manages direct PostgreSQL queries via connection pool (`src/lib/db.ts`), server-side JWT authentication, and internal REST API routes under `/api/v1/`.
2. **Backend Commerce Service (Medusa.js 2.x on Node 20)**:
   - Manages core product catalog, fulfillment workflows, and Medusa framework modules.
   - Configured headless (`admin: { disable: true }`) with custom CORS and independent database pooling.
3. **Database Layer (PostgreSQL 17.6 on Supabase / Linux x86_64)**:
   - 309 total public tables (275 core tables with RLS enabled; 34 custom ERP tables managed via application service authorization).
4. **Integration Gateways**:
   - Event Outbox dispatches HMAC-signed webhooks to n8n for WhatsApp / Meta messaging.
   - Payment settlement engine is provider-neutral, with storefront adapters for Razorpay and COD.

---

## 3. Environment Separation & Secret Hygiene Audit

| Category | Finding | Classification | Required Action |
| :--- | :--- | :--- | :--- |
| **`.env` files** | `.env` files in root, `frontend/`, and `backend/` are correctly excluded from git via `.gitignore`. | **SAFE** | Provide separate `.env.production` files during host provisioning. |
| **Runtime Secret Loading** | Runtime code in `src/lib/db.ts` and `medusa-config.ts` strictly requires `DATABASE_URL` and `JWT_SECRET` with zero hardcoded fallback in production. | **SAFE** | Enforce strong random secrets in production. |
| **Legacy Dev Password in Scripts** | Tracked legacy scripts (e.g. `backend/probe_live_db.js`, `frontend/scripts/test-order-financial-pipeline.ts`) contain fallback references to the dev Supabase instance password. | **EXPOSED (Dev Only)** | **Mandatory:** Provision brand-new production database project. Never reuse the dev password or project. |
| **Public vs Server Scoping** | Only public variables (`NEXT_PUBLIC_BASE_URL`, `NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY`, `NEXT_PUBLIC_RAZORPAY_KEY_ID`) are exposed to browser bundles. | **SAFE** | Audit client bundles during production build. |

---

## 4. Key Blockers & Prerequisites Before Production Deployment

The following items must be provided or resolved before production deployment:

1. **Production Infrastructure (P0)**:
   - Provision independent Production Supabase / PostgreSQL 17 project.
   - Select production hosting platform (Container VPS / AWS / Render / Vercel+Docker).
   - Configure transaction connection pooler (port 6543) with SSL verification enabled.
2. **DNS & Domain Authority (P0)**:
   - Client decision on canonical primary domain: `caketohome.com` vs `cakes2home.com`.
   - Configure DNS records (A/CNAME), SSL certificates, and 301 canonical redirect.
3. **Statutory & Master Data (P0)**:
   - Company legal entity profile: Legal Name, Registered Office, PAN, GSTIN, FSSAI.
   - Authoritative Branch network master data: physical kitchen addresses, GSTIN per state, manager contacts.
   - Certified Opening Balance Sheet and approved Accounting Start Date (zero historical balance fabrication).
4. **Production Credentials (P0)**:
   - Production Razorpay Key ID & Key Secret (or alternative payment provider).
   - Production n8n instance URL & HMAC Webhook Signing Secrets.
   - Production Meta WhatsApp Business API account connection.

---

## 5. Next Recommended PRG Step

**PRG-01 Step 2: Production Provisioning & Configuration Runbook**
- Generate production-ready `.env.production` templates.
- Define exact migration execution order for the clean production database.
- Draft master data onboarding schemas for legal entity, branches, and staff accounts.
- Establish the operational opening balance validation gate.
