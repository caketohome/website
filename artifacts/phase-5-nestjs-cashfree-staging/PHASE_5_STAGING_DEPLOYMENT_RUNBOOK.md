# CAKETOHOME — STAGING DEPLOYMENT RUNBOOK
## Step-by-Step Staging Launch & Smoke Testing Guide

### 1. Deployment Steps
1. Verify PostgreSQL database service is healthy on port 5433 (or cloud staging host).
2. Export staging environment variables (`CASHFREE_ENV=SANDBOX`, `DATABASE_URL`, `JWT_SECRET`).
3. Build and launch NestJS API Engine:
   ```bash
   npm run build:api
   npm run start:api
   ```
4. Verify health endpoint: `GET http://localhost:9000/api/v1/health`.
5. Launch Next.js storefront: `npm run start:frontend`.
6. Run staging automated smoke suite: `node scripts/test_phase5_e2e_workflow.cjs`.
