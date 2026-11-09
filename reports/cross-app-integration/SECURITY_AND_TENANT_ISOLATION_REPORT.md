# CAKETOHOME — SECURITY, RBAC & TENANT ISOLATION REPORT
**Project:** CakeToHome Unified Business Platform  
**Generated At:** 2026-11-06T00:25:16.162Z  

---

## 1. ACCESS CONTROL ENFORCEMENT
1. **Bank Account Number Masking:** Full 12-18 digit account numbers are encrypted/stored authoritatively in PostgreSQL; API list endpoints return exclusively masked numbers (`•••• 3344`), preventing credential exposure.
2. **Customer Tenant Isolation:** Customer sessions are strictly isolated. Subscribing to `/api/subscribe` streams only events matching their own `customer_id`. Internal banking, ledger, reconciliation, and staff notifications are completely blocked.
3. **Branch Tenant Isolation:** Branch managers are scoped to their assigned branch. A manager for `br_koramangala` cannot access order, inventory, or KOT data for `br_indiranagar`.
4. **Super Admin Authorization:** Financial mutations (bank creation, fund transfers, period close, manual journals) require explicit `SUPER_ADMIN` role or granular `BANK.MANAGE` / `ACCOUNTING.POST` permissions.
