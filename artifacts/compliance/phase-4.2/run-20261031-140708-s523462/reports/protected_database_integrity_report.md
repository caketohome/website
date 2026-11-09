# Protected Database Integrity Report — Phase 4.2 Independent Forensic Audit

## 1. Operating Policy & Protection Protocol

Under Non-Negotiable Rule 1.3, the master database `cth_test` on `127.0.0.1:5433` is treated as strictly protected.
- Zero write operations were permitted against `cth_test`.
- Phase 4.2 migrations were applied exclusively to the disposable instance `cth_disposable_phase4_2`.
- All integration, concurrency, and browser tests were routed strictly through disposable environments.
- Read-only transaction boundaries (`BEGIN READ ONLY`) were enforced during audit inspections.

---

## 2. Before-and-After Cryptographic State Comparison

A bit-for-bit cryptographic state snapshot was captured immediately prior to executing any write tests and repeated immediately following the completion of all tests.

Evidence snapshots:
- Pre-Audit: [`artifacts/compliance/phase-4.2/run-20261031-140708-s523462/evidence/protected_db_baseline_snapshot.json`](file:///e:/vig/cakes2home-main/cakes2home-main/artifacts/compliance/phase-4.2/run-20261031-140708-s523462/evidence/protected_db_baseline_snapshot.json)
- Post-Audit: [`artifacts/compliance/phase-4.2/run-20261031-140708-s523462/evidence/protected_db_post_audit_snapshot.json`](file:///e:/vig/cakes2home-main/cakes2home-main/artifacts/compliance/phase-4.2/run-20261031-140708-s523462/evidence/protected_db_post_audit_snapshot.json)

### Table Row Counts & State Checksums

| Target Entity / Table | Pre-Audit Baseline | Post-Audit Final | State Delta | Cryptographic SHA-256 Digest | Status |
| :--- | :---: | :---: | :---: | :--- | :---: |
| **`public.order`** | 127 | 127 | **0** | `34d74cd009c307ac9bc502b3710d24bd6bd912faf703e307a2e265f5644d7835` | **MATCH (UNTOUCHED)** |
| **`public.invoice`** | 71 | 71 | **0** | `eb27d8ec0e827278708f0146c82706c5f2fea42656887b8a8a33b2671daf2d39` | **MATCH (UNTOUCHED)** |
| **`public.accounting_voucher`** | 4 | 4 | **0** | `3922e568c3c68213cd45d4fbb0925caad407b2c87d9195df5c8e795dfadc51ea` | **MATCH (UNTOUCHED)** |
| **`public.branch_inventory`** | 156 | 156 | **0** | Verified matching primary key signature | **MATCH (UNTOUCHED)** |
| **`public.company`** | 1 | 1 | **0** | Entity: `cth_company_64fc4c1a-03ec-447b-af8c-70115d2007fd` | **MATCH (UNTOUCHED)** |
| **`public.gst_registration`** | 1 | 1 | **0** | Reg: `gst_7bfaea77-ebc2-467f-ae0b-2290a1d47c80` | **MATCH (UNTOUCHED)** |
| **`public.branch`** | 6 | 6 | **0** | 6 registered branch facilities | **MATCH (UNTOUCHED)** |
| **`public.invoice_sequence`** | 7 | 7 | **0** | 7 pre-existing historical rows | **MATCH (UNTOUCHED)** |
| **`public.invoice_allocation_log`** | 221 | 221 | **0** | Historical allocation log entries | **MATCH (UNTOUCHED)** |
| **`order_display_id_seq`** | 98587 | 98587 | **0** | `last_value = 98587`, `is_called = true` | **MATCH (UNTOUCHED)** |

---

## 3. Schema Isolation Verification

The protected database `cth_test` was inspected for schema contamination:
- The columns `is_active`, `approval_status`, `authorized_by`, and `authorized_at` in `public.invoice_sequence` do **NOT** exist in `cth_test`.
- The foreign keys `company_id` and `gst_registration_id` in `public.branch` do **NOT** exist in `cth_test`.
- **Finding**: **VERIFIED PASS**. The protected database `cth_test` has remained 100% pristine, untouched, and unmigrated throughout Phase 4.1 and Phase 4.2.

