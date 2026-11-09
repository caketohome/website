# Database Schema and Migration Report
**Database Target:** Embedded PostgreSQL 16.14  
**Rehearsal Database:** `cth_rehearsal_phase4_7`  

## Migration Audit
- Forward-only migrations `c7_10` through `c7_14` verified intact.
- Migration linter (`lint_migrations.cjs --remediated-baseline`) passed with 0 fatal errors.
- Neutralized historical defects in `c7_12` via `c7_13` governance triggers.
- Statement-level TRUNCATE and mutation protection verified on `invoice_series_approval_audit`.
