# Approval Identity and Segregation of Duties (SOD) Verification

## 1. Security Triggers & Rules
- `trg_prevent_self_approval`: Blocks any attempt by the series creator to approve their own series.
- `trg_enforce_invoice_series_governance`: Rejects transitions with synthetic approver IDs (`ca_audit_signed`) or missing authorization.

## 2. Token Secrecy & Immutability
- `information_schema.columns` confirms 0 plaintext token columns in `public`.
- `public.invoice_series_approval_audit` is protected against `UPDATE`, `DELETE`, and `TRUNCATE`.
