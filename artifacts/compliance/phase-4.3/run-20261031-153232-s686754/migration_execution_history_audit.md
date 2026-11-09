# CakeToHome Phase 4.3 — Migration Execution History Audit

## 1. Environment Migration Status Matrix

| Environment | Database Target | Migration `c7_10` | Migration `c7_11` | Migration `c7_12` | Migration `c7_13` | Current Invoice Sequence Columns |
|---|---|---|---|---|---|---|
| Protected Baseline | `cth_test` (5433) | Applied | Applied | **NOT APPLIED** | **NOT APPLIED** | 8 baseline columns (id, entity_id, gstin, fiscal_year, prefix, last_seq, created_at, updated_at) |
| Phase 4.1 Disposable | `cth_disposable_phase4_1` | Applied | Applied | Applied | Not Applied | 13 columns (has synthetic APPROVED rows) |
| Phase 4.2 Disposable | `cth_disposable_phase4_2` | Applied | Applied | Applied | Not Applied | 13 columns (has synthetic APPROVED rows) |
| Phase 4.3 Disposable | `cth_disposable_phase4_3` | Applied | Applied | Applied | **Applied** | 13 columns (0 synthetic APPROVED rows; all neutralized to REVOKED_SYNTHETIC) |
| Clean Verification DB | `cth_test_clean_p43` | Applied | Applied | Applied | **Applied** | 13 columns (0 default approved rows; 100% fail-closed) |
| Staging / Production | Remote AWS/Supabase | Protected | Protected | **Unverified / Blocked** | **Pending Gate** | Invoicing fails closed |

## 2. Evidence of Non-Application to `cth_test`
Direct query execution against `cth_test` proved:
1. `information_schema.columns` for `public.invoice_sequence` has only 8 columns.
2. The columns `approval_status`, `is_active`, `authorized_by`, `authorized_at`, and `document_type` do NOT exist in `cth_test`.
3. The table `public.invoice_series_approval_audit` does NOT exist in `cth_test`.
4. Therefore, `cth_test` was never exposed to the synthetic DML of `c7_12`.

## 3. Migration Immutability & Ledger Policy
Because `c7_12` was checked into Git and applied across earlier disposable test runs, rewriting `c7_12` in place would violate migration immutability. CakeToHome's architectural standard requires **forward-only schema migrations**. Migration `c7_13` acts as the authoritative corrective layer.

