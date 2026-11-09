# Test Invoice Provenance and Environment Classification
**Database Target:** `cth_test` (port 5433)  

---

## 1. Complete Invoice Classification (71 Total Invoices)

| Classification | Count | Prefix | Order ID Pattern | Provenance & Origin |
| :--- | :---: | :--- | :--- | :--- |
| **Legitimate Customer Invoices** | 58 | `CTH` | `order_1793...` | Real customer transactions generated during lifecycle audits |
| **Historical Concurrency Test Invoices** | 13 | `CONC`, `SAFE-TEST`, `PRT-8899` | `test_conc_*`, `test_order_safeguard_*` | Automated concurrency race tests executed in Phases 3.3-3.7 |
| **TOTAL** | **71** | — | — | **100% Accounted For** |

## 2. Non-Destructive Preservation Policy
In compliance with Safety Rule 3.2, these 13 historical test invoices are **preserved without deletion** to protect database integrity and audit reproducibility. Their associated sequence series have been neutralized (`REVOKED_SYNTHETIC`).
