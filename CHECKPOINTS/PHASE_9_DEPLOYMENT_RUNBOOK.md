# CAKETOHOME — PHASE 9 DEPLOYMENT RUNBOOK
**Platform:** CakeToHome (https://cakestohome.com/)  
**Release Phase:** Phase 9 — Razorpay Standard Checkout & Legal Policy Management  
**Release Classification:** **`VERIFIED — TEST MODE ONLY`**  
**DevOps Engineer:** Lead DevOps & Site Reliability Engineer  
**Date:** 2026-11-10  

---

## 1. Prerequisites & Environment Configuration

### Required Environment Variables
```env
# Database Connection (Port 5432 in production, Port 5433 in local rehearsal)
DATABASE_URL="postgresql://cth_user:password@localhost:5432/cth_production"

# Application Encryption Key (Must be 32 bytes hex or 64 char string)
PAYMENT_ENCRYPTION_KEY="<production_32_byte_secret>"

# Razorpay Test Gateway Keys (Active)
RAZORPAY_KEY_ID="rzp_test_saved_key_12345"
RAZORPAY_KEY_SECRET="saved_key_secret_secure_999"
RAZORPAY_WEBHOOK_SECRET="saved_webhook_secret_secure_888"

# Release Gate E Blocker (Must remain false until CFO KYC approval)
MERCHANT_KYC_APPROVED="false"
```

---

## 2. Deployment Procedure

1. **Step 1: Database Migration Execution**
   ```bash
   psql -d cth_production -f migration/20261110_phase9_razorpay_gateway_and_refunds.sql
   ```
2. **Step 2: Seed Legal Policies & CMS Pages**
   ```bash
   node scratch/seed_12_policies_clean.cjs
   ```
3. **Step 3: Build Next.js Application**
   ```bash
   cd frontend
   npm run build
   ```
4. **Step 4: Health Check & Smoke Verification**
   - Probe `GET /api/v1/payments/razorpay/config` -> 200 OK (Secrets masked).
   - Probe `POST /api/v1/payments/cashfree/order` -> 410 Gone (`CASHFREE_DECOMMISSIONED`).
   - Probe `GET /privacy-policy` -> 200 OK.

---

## 3. Rollback Procedure
If unexpected errors occur:
1. Revert application container to parent image tag (`c624037`).
2. Do not rollback database tables (`payment_gateway_config` and `payment_transaction` are non-destructive and backward compatible).
