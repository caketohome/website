# Production Deployment Runbook
**Procedure Title:** CakeToHome Statutory Invoicing Deployment  
**Standard Execution Time:** 15 minutes  

---

## 1. Phase 1: Pre-Deployment Operations
1. Announce maintenance window to operations and warehouse managers.
2. Capture pre-deployment cryptographic snapshot of production database.
3. Validate environment variables: `DATABASE_URL`, `JWT_SECRET`, `NODE_ENV=production`.

## 2. Phase 2: Sequential Migration Execution
Execute migrations in strict forward-only sequence:
```bash
psql "$DATABASE_URL" -f frontend/src/lib/migrations/c7_12_database_driven_gst_and_invoice_series.sql
psql "$DATABASE_URL" -f frontend/src/lib/migrations/c7_13_statutory_approval_integrity_and_governance.sql
psql "$DATABASE_URL" -f frontend/src/lib/migrations/c7_14_database_trigger_and_truncate_governance.sql
```

## 3. Phase 3: Post-Deployment Smoke Verification
1. Verify triggers in `pg_trigger` have `tgenabled = 'A'`.
2. Confirm zero series have `approval_status = 'APPROVED'`.
3. Verify test probe to `/api/v1/health` returns HTTP 200.

## 4. Stop Conditions & Immediate Abort Criteria
- Any failure in migration script execution.
- Any trigger failing to register with `tgenabled = 'A'`.
- Any historical invoice data checksum mismatch.
