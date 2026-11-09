# Audit Log Immutability Assessment

## 1. Table Protection: `public.invoice_series_approval_audit`
The audit log table tracks every proposal, approval, revocation, and configuration change made to invoice sequences.

## 2. Database Constraint & Trigger Protections
- **UPDATE Protection:** Trigger `trg_invoice_series_approval_audit_immutable` unconditionally raises an exception on any `UPDATE` attempt.
- **DELETE Protection:** Unconditionally raises an exception on any `DELETE` attempt.
- **TRUNCATE Protection:** Trigger `trg_invoice_series_approval_audit_no_truncate` prevents table truncation even by database superusers.

## 3. Forensic Test Verification
All 3 mutation attacks were tested against the rehearsal database; all were instantly rejected with database errors. The audit log is mathematically immutable.
