# Invoice-Series Configuration Readiness Document
**Database Table:** `public.invoice_sequence`  
**Active Series Count:** 0 (Fail-Closed Verified)  

---

## 1. Neutralized Historical Series Inventory

| Series ID | Prefix | GSTIN | FY | Status | Authorized By | Reversal / Safeguard |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `14c9e1e4-...` | `CTH` | `29AAACC1234F1Z5` | 2026 | `DEPRECATED_HISTORICAL` | `system_audit` | Neutralized in c7_12 |
| `b668b26d-...` | `FYBND` | `29AABCC1234F1Z5` | 2025 | `REVOKED_SYNTHETIC` | `ca_audit_signed` | Revoked in c7_13 |
| `c416ccfc-...` | `CONC` | `29AABCC1234F1Z5` | 2026 | `REVOKED_SYNTHETIC` | `ca_audit_signed` | Revoked in c7_13 |
| `d25bb22c-...` | `SAFE-TEST`| `29AABCC1234F1Z5` | 2026 | `REVOKED_SYNTHETIC` | `ca_audit_signed` | Revoked in c7_13 |
| `d36954a8-...` | `FYBND` | `29AABCC1234F1Z5` | 2026 | `REVOKED_SYNTHETIC` | `ca_audit_signed` | Revoked in c7_13 |
| `dccdd92d-...` | `PRT-8899`| `27AABCP1234K1Z2` | 2026 | `REVOKED_SYNTHETIC` | `partner_audit_signed` | Revoked in c7_13 |
| `fbf5c330-...` | `LKTEST` | `29AABCC1234F1Z5` | 2026 | `REVOKED_SYNTHETIC` | `ca_audit_signed` | Revoked in c7_13 |

## 2. Configuration Readiness Checklist
- **Prefix Format Constraint:** Enforces `^[A-Z0-9-]{1,6}$` (checked by DB constraint).
- **Approval State Machine:** Transitions strictly through `PROPOSED -> APPROVED / REJECTED -> REVOKED / DEPRECATED`.
- **Fail-Closed Guarantee:** Zero active series approved. `allocate_invoice_number` throws `NO_APPROVED_SERIES`.
