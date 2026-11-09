# CakeToHome Phase 4.3 — Database Constraints and Privileges Audit

## 1. Table Schema Constraints on `public.invoice_sequence`

1. **Prefix Format Check Constraint (`chk_invoice_sequence_prefix_format`)**:
   ```sql
   CHECK (prefix ~ '^[A-Za-z0-9\-_]{1,16}$')
   ```
   Enforces CGST Rule 46 length limit (max 16 characters) and alphanumeric + hyphen/underscore characters. Direct SQL inserts with special characters or invalid lengths are rejected at the storage engine layer.

2. **Approval Status Enum Check Constraint (`chk_invoice_sequence_approval_status`)**:
   ```sql
   CHECK (approval_status IN ('PROPOSED', 'APPROVED', 'SUSPENDED', 'REVOKED', 'DEPRECATED_HISTORICAL', 'REVOKED_SYNTHETIC'))
   ```
   Prevents insertion of arbitrary status strings.

3. **Unique Multi-Column Constraint (`uq_invoice_sequence_entity_gstin_fy_prefix`)**:
   Guarantees that a prefix within an Indian financial year belongs strictly to one legal entity and GSTIN.

## 2. Trigger Enforcements
1. **`trg_invoice_sequence_governance` on `public.invoice_sequence`**:
   - Fires `BEFORE UPDATE`.
   - Rejects `authorized_by` matching `'ca_audit_signed'`, `'partner_audit_signed'`, `'system_audit'`, `'system'`, `'admin'`, or regex `'^(ca_audit|partner_audit|test_|synthetic)'` when status is `APPROVED`.
   - Blocks any modification when `OLD.approval_status` is `DEPRECATED_HISTORICAL` or `REVOKED_SYNTHETIC`.
   - Records all status transitions into `public.invoice_series_approval_audit`.

2. **`trg_invoice_series_audit_immutable` on `public.invoice_series_approval_audit`**:
   - Fires `BEFORE UPDATE OR DELETE`.
   - Raises `STATUTORY_SECURITY_VIOLATION`. Guarantees append-only persistence.

## 3. Privilege Isolation
- Ordinary application connections cannot truncate or bypass the audit log table.
- Direct database updates attempting synthetic approval raise unhandled database exceptions that force an atomic transaction rollback.

