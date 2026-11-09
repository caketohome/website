# Protected Database Integrity Report
**Database:** `cth_test` on `127.0.0.1:5433`  
**Superuser Role:** `cth_test_user`  

---

## 1. Pre- and Post-Audit Cryptographic Checksums

| Table / Object | Record Count | Pre-Audit SHA-256 Digest | Post-Audit SHA-256 Digest | Integrity Status |
| :--- | :---: | :--- | :--- | :---: |
| `public.order` | 127 | `34d74cd009c307ac9bc502b3710d24bd6bd912faf703e307a2e265f5644d7835` | `34d74cd009c307ac9bc502b3710d24bd6bd912faf703e307a2e265f5644d7835` | **100% MATCH** |
| `public.invoice` | 71 | `eb27d8ec0e827278708f0146c82706c5f2fea42656887b8a8a33b2671daf2d39` | `eb27d8ec0e827278708f0146c82706c5f2fea42656887b8a8a33b2671daf2d39` | **100% MATCH** |
| `public.accounting_voucher` | 4 | `3922e568c3c68213cd45d4fbb0925caad407b2c87d9195df5c8e795dfadc51ea` | `3922e568c3c68213cd45d4fbb0925caad407b2c87d9195df5c8e795dfadc51ea` | **100% MATCH** |
| `order_display_id_seq` | 98587 | `last_value: 98587` | `last_value: 98587` | **100% MATCH** |
