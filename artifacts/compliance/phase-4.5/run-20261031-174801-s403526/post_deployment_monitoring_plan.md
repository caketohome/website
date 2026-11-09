# Post-Deployment Monitoring Plan
**Observability Domain:** Database Locks, Sequence Gaps, API Spikes  

---

## 1. Operational Telemetry & Alert Thresholds

| Signal / Metric | Probe Mechanism | Alert Threshold | Escalation Action |
| :--- | :--- | :--- | :--- |
| **Invoice Sequence Gaps** | Query `invoice_allocation_log` | Gap > 0 | Page On-Call Architect & Auditor |
| **Allocation Lock Contention** | `pg_stat_activity` wait_event | Wait > 2,000ms | Inspect database connection pool |
| **API 403 Forbidden Rate** | Next.js API metrics | > 5 requests / min | Investigate credential tampering |
| **Trigger Violations** | PostgreSQL error logs | Exception count > 0 | Immediate security review |
