# Deployment Preflight Checklist
**Target Release:** CakeToHome Invoicing Release Candidate 1  

---

## 1. 20-Point Preflight Verification

| Item # | Check Item | Verification Tool / Command | Result |
| :---: | :--- | :--- | :---: |
| 1 | Baseline Git Commit Verified | `git log -1` matches `d231cee7e55f...` | PASS |
| 2 | Working Tree Clean | `git status --short` contains 0 tracked diffs | PASS |
| 3 | PostgreSQL Port 5433 Active | TCP probe to 127.0.0.1:5433 | PASS |
| 4 | Database Superuser Access | `cth_test_user` connects cleanly | PASS |
| 5 | Protected DB Untouched | Checksums of `cth_test` verified | PASS |
| 6 | Migration Checksums Intact | 5 migrations match SHA-256 manifest | PASS |
| 7 | Migration Linter Clean | `lint_migrations.cjs` reports 0 errors | PASS |
| 8 | Trigger `trg_invoice_sequence_governance` | Present and marked `ENABLE ALWAYS` | PASS |
| 9 | Trigger `trg_invoice_series_audit_immutable` | Present and marked `ENABLE ALWAYS` | PASS |
| 10 | Trigger `trg_invoice_series_audit_truncate` | Present and marked `ENABLE ALWAYS` | PASS |
| 11 | API Route Rejects Anonymous | Returns HTTP 403 Forbidden | PASS |
| 12 | API Route Rejects Non-Admin Roles | Returns HTTP 403 Forbidden | PASS |
| 13 | Idempotent API Approval | Returns HTTP 200 on re-approval | PASS |
| 14 | Fail-Closed Invoicing Enforced | Rejects allocation when 0 series approved | PASS |
| 15 | Sequence Gapless Allocation | Tested with concurrent workers | PASS |
| 16 | 16-Character Invoice Limit | Format strictly adheres to `[PFX]/YY-YY/[SEQ]` | PASS |
| 17 | Fiscal Boundary IST Rollover | Midnight March 31 / April 1 rollover verified | PASS |
| 18 | Order-to-Invoice Reconciliation | 127 orders and 71 invoices reconciled | PASS |
| 19 | Voucher Reconciliation | 4 vouchers verified (1 cancelled, 3 draft) | PASS |
| 20 | Forward Recovery Runbook Ready | Documented and validated in rehearsal | PASS |
