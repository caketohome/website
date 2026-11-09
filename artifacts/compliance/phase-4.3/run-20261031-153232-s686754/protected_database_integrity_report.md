# CakeToHome Phase 4.3 — Protected Database Integrity Report

## 1. Operating Principle
The protected database `cth_test` on `127.0.0.1:5433` represents historical production baseline state. All Phase 4.3 migration tests, failure injections, API requests, and browser interactions were strictly isolated to disposable databases (`cth_disposable_phase4_3` and `cth_test_clean_p43`).

## 2. Before vs After Cryptographic Snapshot Comparison

| Metric / Table | Baseline (Before Phase 4.3) | Final Audit (After Phase 4.3) | Match Status | Cryptographic Hash (SHA-256) |
|---|---|---|---|---|
| `public.order` | 127 | 127 | **100% IDENTICAL** | `34d74cd009c307ac9bc502b3710d24bd6bd912faf703e307a2e265f5644d7835` |
| `public.invoice` | 71 | 71 | **100% IDENTICAL** | `eb27d8ec0e827278708f0146c82706c5f2fea42656887b8a8a33b2671daf2d39` |
| `public.accounting_voucher` | 4 | 4 | **100% IDENTICAL** | `3922e568c3c68213cd45d4fbb0925caad407b2c87d9195df5c8e795dfadc51ea` |
| `public.branch_inventory` | 156 | 156 | **100% IDENTICAL** | N/A (Row count identical) |
| `public.company` | 1 | 1 | **100% IDENTICAL** | N/A (Row count identical) |
| `public.gst_registration` | 1 | 1 | **100% IDENTICAL** | N/A (Row count identical) |
| `public.branch` | 6 | 6 | **100% IDENTICAL** | N/A (Row count identical) |
| `public.invoice_sequence` | 7 | 7 | **100% IDENTICAL** | N/A (Row count identical, columns unmodified) |
| `public.invoice_allocation_log` | 221 | 221 | **100% IDENTICAL** | N/A (Row count identical) |
| `order_display_id_seq` | 98587 | 98587 | **100% IDENTICAL** | `last_value = 98587, is_called = true` |

## 3. Schema Immutability Proof
A query against `information_schema.columns` confirmed that `cth_test` has:
- 0 governance columns (`is_active`, `approval_status`, `authorized_by`, `authorized_at`) on `public.invoice_sequence`.
- 0 references to `public.invoice_series_approval_audit`.
- 0 changes to sequence counters or primary keys.

**Conclusion**: The protected database `cth_test` suffered zero modifications, zero write executions, and zero schema drift throughout Phase 4.3.

