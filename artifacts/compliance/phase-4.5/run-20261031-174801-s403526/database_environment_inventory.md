# Database Environment Inventory
**PostgreSQL Version:** PostgreSQL 16.14, compiled by Visual C++ build 1944, 64-bit  
**Host/Port:** 127.0.0.1:5433  
**Active User Role:** `cth_test_user` (Superuser)  

---

## 1. Database Roles & Target Partitions

| Database Name | Classification | Access Mode | Current Status | Purpose |
| :--- | :--- | :--- | :--- | :--- |
| **cth_test** | Protected Baseline | **READ-ONLY** | Pristine (0 writes) | Production-like historical audit baseline |
| **cth_rehearsal_phase4_5** | Ephemeral Disposable | READ/WRITE | Active Rehearsal | Full deployment & testing sandbox |
| **cth_disposable_phase4_4** | Historical Disposable | INACTIVE | Preserved | Phase 4.4 test execution archive |

## 2. Protected Database Cryptographic Baselines
- **Orders Table (127 rows):** SHA-256 = `34d74cd009c307ac9bc502b3710d24bd6bd912faf703e307a2e265f5644d7835`
- **Invoices Table (71 rows):** SHA-256 = `eb27d8ec0e827278708f0146c82706c5f2fea42656887b8a8a33b2671daf2d39`
- **Vouchers Table (4 rows):** SHA-256 = `3922e568c3c68213cd45d4fbb0925caad407b2c87d9195df5c8e795dfadc51ea`
- **Order Display Sequence:** `last_value: 98587`, `is_called: true`
