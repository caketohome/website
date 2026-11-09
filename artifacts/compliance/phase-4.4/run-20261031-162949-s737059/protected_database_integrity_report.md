# Protected Baseline Database Integrity Report (cth_test)

## 1. Cryptographic Before-and-After Hashes
The protected database `cth_test` on `127.0.0.1:5433` was audited in strictly read-only mode:
- `public.order` (127 rows): `34d74cd009c307ac9bc502b3710d24bd6bd912faf703e307a2e265f5644d7835` (**MATCH 100%**)
- `public.invoice` (71 rows): `eb27d8ec0e827278708f0146c82706c5f2fea42656887b8a8a33b2671daf2d39` (**MATCH 100%**)
- `public.accounting_voucher` (4 rows): `3922e568c3c68213cd45d4fbb0925caad407b2c87d9195df5c8e795dfadc51ea` (**MATCH 100%**)
- `order_display_id_seq`: `98587` (**UNTOUCHED**)
- `public.invoice_sequence`: 7 rows, 8 columns (pre-migration schema) (**UNTOUCHED**)

Zero drift occurred.