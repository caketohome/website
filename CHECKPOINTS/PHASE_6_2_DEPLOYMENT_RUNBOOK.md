# CAKETOHOME — PHASE 6.2 DEPLOYMENT & OPERATION RUNBOOK
**Phase:** 6.2 — Workstream K  
**Author:** DevOps & Release Assurance Engineer  
**Status:** READY FOR STAGING / PRODUCTION  

---

### 1. Migration Steps
1. Execute additive migration SQL:
   ```bash
   psql -h <host> -U <user> -d <dbname> -f migration/20261110_phase6_2_cms_architecture.sql
   ```
2. Verify row counts in `cms_page` and `cms_revision`.
3. Verify Next.js dev or build:
   ```bash
   npm run build
   ```

### 2. Cron Configuration for Scheduled Publishing
Configure recurring HTTP POST trigger every 5 minutes:
```bash
curl -X POST https://cakes2home.com/api/v1/cms/jobs/publish-scheduled   -H "Authorization: Bearer <CRON_SECRET>"
```
