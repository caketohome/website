# CAKETOHOME — ROLLBACK & RECOVERY RUNBOOK
## Incident Response, Rollback Triggers & Disaster Recovery

### 1. Rollback Triggers
- Signature verification failure rate > 1%.
- Webhook duplicate deduplication failures.
- Database deadlock or unhandled exception spike.

### 2. Recovery Procedures
- Stop NestJS application process.
- Revert application container to previous release tag.
- If database rollback required, restore from pre-migration snapshot `cth_rehearsal_phase4`.
- Note: Historical Razorpay tables are read-only and never modified during rollback.
