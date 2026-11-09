# PostgreSQL Trigger and Function Security Audit

## 1. Trigger Catalog Inspection (pg_trigger)
- `trg_invoice_sequence_governance`: Attached to `public.invoice_sequence` as `BEFORE INSERT OR UPDATE FOR EACH ROW`. Marked `ENABLE ALWAYS`.
- `trg_invoice_series_audit_immutable`: Attached to `public.invoice_series_approval_audit` as `BEFORE UPDATE OR DELETE FOR EACH ROW`. Marked `ENABLE ALWAYS`.
- `trg_invoice_series_audit_truncate`: Attached to `public.invoice_series_approval_audit` as `BEFORE TRUNCATE FOR EACH STATEMENT`. Marked `ENABLE ALWAYS`.

## 2. Execution Security
All trigger functions are compiled with `LANGUAGE plpgsql` and run in the caller's context, raising error `23514` with distinct descriptive error messages.