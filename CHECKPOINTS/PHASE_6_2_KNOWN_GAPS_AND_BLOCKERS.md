# CAKETOHOME — PHASE 6.2 KNOWN GAPS & BLOCKERS
**Phase:** 6.2 — Workstream K  
**Author:** Release Assurance Engineer  
**Status:** ZERO CRITICAL BLOCKERS  

---

### 1. Current Status
- **Critical Blockers:** 0
- **High Severity Defects:** 0
- **Regression Bugs:** 0

### 2. Operational Notes
- **Database Encoding Note:** PostgreSQL server on Windows uses `WIN1252`. Seeding scripts normalize unicode characters and currency symbols to clean ASCII equivalents to avoid encoding exceptions.
- **Route Whitelist:** Core checkout and operational routes are explicitly protected.
