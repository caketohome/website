# CakeToHome Data Persistence Rollback Runbook

This document details the contingency and disaster recovery procedures for the database persistence migration.

---

## 1. Archive Location & Offline Snapshot

- **Archive File**: `migration/archive/db-store.json.bak`
- **Integrity**: Exact byte-for-byte replica of `frontend/data/db-store.json` taken immediately prior to migration execution.

---

## 2. Emergency Rollback Procedures

### Scenario A: Re-executing PostgreSQL Migration from Archive
If database tables need to be reseeded from the verified backup:
```bash
cd backend
node migrate-db-store-to-database.js --execute
```

### Scenario B: Restoring Disk Snapshot (Emergency Maintenance Only)
If the live cloud database experiences prolonged downtime during infrastructure maintenance and temporary local inspection is required:
```bash
cp migration/archive/db-store.json.bak frontend/data/db-store.json
```
*Note: Runtime writes to `db-store.json` remain disabled in production.*

---

## 3. Database Health Check Verification

To verify database accessibility and health at any time:
```bash
curl http://localhost:9000/health
```
Expected output:
```json
{
  "status": "healthy",
  "service": "caketohome-backend",
  "database": "connected"
}
```
