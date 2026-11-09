# Checkpoint: CakeToHome ERP — Production Secrets & Deployment Configuration Audit

**Project:** CakeToHome ERP  
**Date:** 2026-10-15  
**Starting Checkpoint:** `CHECKPOINTS/product-master-hsn-classification-remediation.md`  
**Status:** ✅ **AUDIT COMPLETE — ZERO-MUTATION INSPECTION COMPLETED**  
**Authoritative Source of Truth:** Live PostgreSQL (`aws-1-ap-south-1.pooler.supabase.com:6543/postgres`)  
**GST & HSN Workstreams Status:** 🔒 **CLOSED & PRESERVED** (22/22 active products classified, 0 unclassified items)  
**Credential Exposure Policy:** Strict Redaction & Masking (Zero Plaintext Secrets Exposed)

---

## 1. Audit Scope & Invariants Preserved

1. **GST and HSN Workstreams**: Kept strictly closed. No database rates or product classifications were modified.
2. **Tax Treatment Questions**: Both flower bouquet rates (5% vs 0% exemption) and cake supply classification (goods vs restaurant service) remain documented for accountant confirmation and untouched in code.
3. **Database Invariants**: CoA = 100 canonical accounts, Trial Balance = Dr ₹3,380.00 = Cr ₹3,380.00 (Zero Imbalance), Active Products = 22, Classified = 22, Missing = 0, Active Fleet = 30, Active Branches = 48, Active Customers = 56, Advisory Locks = 0.
4. **Zero-Mutation Enforcement**: Zero live deployments, zero production mutations, and zero credential exposure.

---

## 2. Findings Summary

### A. Secret Handling & Client-Bundle Protection
- `NEXT_PUBLIC_*` variables are strictly limited to public endpoints (`BASE_URL`, `BACKEND_URL`, `SITE_URL`) and public client keys (`MEDUSA_PUBLISHABLE_KEY`, `RAZORPAY_KEY_ID`, `GA_ID`).
- No server secrets (`DATABASE_URL`, `JWT_SECRET`, `COOKIE_SECRET`, `RAZORPAY_KEY_SECRET`, `WEBHOOK_SIGNING_SECRET`) are imported or leaked into client bundles.
- Root and subfolder `.gitignore` files strictly ignore `.env` and `.env.*`.
- Templates (`.env.production.example`) are sanitized and document all required production variables.

### B. Docker Manifests & Container Architecture
- **Frontend Dockerfile**: Multi-stage build on `node:20-alpine`. Identifies optimization opportunities: non-root `nextjs` user, `output: "standalone"` in `next.config.mjs`, and adding a `HEALTHCHECK`.
- **Backend Dockerfile**: Critical build blocker identified: line 16 copies `/app/medusa-config.js`, which does not exist in the source tree (the source is `medusa-config.ts`).
- **docker-compose.yml**: Multi-container compose properly links frontend and backend via environment variables.

### C. Database Connectivity & Pooler Performance
- Verified live connectivity to PostgreSQL 17.6 on Supabase Supavisor transaction pooler (port 6543).
- Active connections: 13, max connections: 60.
- Pool size recommendation: Calibrate frontend pool (`max: 10`) and backend pool (`max: 10`) to prevent pooler slot saturation.
- Transaction isolation verified: explicit ACID transactions operate cleanly over port 6543.

### D. Backup & Point-In-Time-Recovery (PITR) Readiness
- Database engine flags verified: `wal_level = logical` and `archive_mode = on`.
- Supabase snapshot backups are automated daily. Continuous WAL archiving / PITR requires verification on the Supabase production dashboard.
- Target RPO $\le 5\text{ minutes}$ (with PITR), RTO $\le 30\text{ minutes}$.

### E. Deployment Blockers Matrix
1. **Backend Dockerfile Config Fix**: Fix `medusa-config.js` copy instruction in `backend/Dockerfile`.
2. **Durable Cloud Object Storage**: Replace ephemeral local `/public/uploads` with S3 / Cloudflare R2 / Supabase Storage adapter.
3. **Next.js Image Whitelist**: Add cloud storage domains to `next.config.mjs` `images.remotePatterns`.
4. **Production Secrets Provisioning**: Inject production variables into hosting provider (Render/VPS).
5. **CORS Whitelisting**: Configure `STORE_CORS`, `ADMIN_CORS`, and `AUTH_CORS` for production domain.

---

## 3. Next Recommended Workstream

Proceed to **Durable Cloud Object Storage Integration** (AWS S3 / Cloudflare R2 / Supabase Storage adapter) to eliminate the ephemeral media data loss blocker.
