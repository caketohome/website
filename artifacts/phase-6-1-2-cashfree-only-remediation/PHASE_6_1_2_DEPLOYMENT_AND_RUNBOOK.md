# CAKETOHOME — PHASE 6.1.2 DEPLOYMENT & RUNBOOK
## PRODUCTION CUTOVER PROCEDURE, ENVIRONMENT CONFIGURATION & EMERGENCY OPERATIONS

**Company:** CakeToHome India Private Limited  
**Deployment Target:** Staging & Production Clusters

---

### 1. ENVIRONMENT CONFIGURATION CHECKLIST

Ensure the following environment variables are configured in production:
```env
# Cashfree Production Credentials
CASHFREE_APP_ID="CF_PROD_APP_ID_..."
CASHFREE_SECRET_KEY="CF_PROD_SECRET_KEY_..."
CASHFREE_ENVIRONMENT="PRODUCTION"
CASHFREE_API_VERSION="2023-08-01"

# Database Configuration
DATABASE_URL="postgresql://user:pass@production-db:5432/caketohome"
DATABASE_SSL="true"

# Decommission Verification
RAZORPAY_ACTIVE="false"
```

### 2. ZERO-DOWNTIME CUTOVER RUNBOOK

1. **Step 1:** Verify database migrations applied to target database.
2. **Step 2:** Deploy NestJS backend containers with Cashfree PaymentsModule active.
3. **Step 3:** Deploy Next.js frontend containers with `/checkout/cashfree` and Web SDK v3.
4. **Step 4:** Execute smoke test using `test_cashfree_lifecycle.cjs` to confirm HTTP 410 on legacy routes.
5. **Step 5:** Monitor outbox events and error logs.
