# Rollback and Forward Recovery Runbook
**Policy:** Forward-Only Recovery & Transactional Aborts  

---

## 1. Recovery Principles
- **No Destructive Rollback:** Under statutory tax regulations, invoice sequence numbers and approval audit logs cannot be rolled back or deleted.
- **Transactional Atomicity:** If a migration script encounters an error, the enclosing database transaction is aborted, leaving the schema unchanged.
- **Forward-Only Remediation:** If an operational defect is discovered post-deployment, remediate via a new migration script (`c7_15_...`) or administrative revocation.
