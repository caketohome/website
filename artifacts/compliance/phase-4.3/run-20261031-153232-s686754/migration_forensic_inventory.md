# CakeToHome Phase 4.3 — Migration Forensic Inventory

## 1. Executive Summary
This document provides a forensic line-by-line inspection of migration `c7_12_database_driven_gst_and_invoice_series.sql` and the forward-only corrective migration `c7_13_statutory_approval_integrity_and_governance.sql`.

## 2. Forensic Inspection of `c7_12_database_driven_gst_and_invoice_series.sql`

| Line Range | Operation | Target Table / Object | Classification | Forensic Finding |
|---|---|---|---|---|
| Lines 6-11 | `ALTER TABLE ... ADD COLUMN IF NOT EXISTS`, `CREATE INDEX` | `public.branch` | DDL / Structural | Added `company_id` and `gst_registration_id` foreign keys with indexes. Structurally sound. |
| Lines 13-22 | `ALTER TABLE ... ADD COLUMN IF NOT EXISTS`, `CREATE INDEX` | `public.invoice_sequence` | DDL / Governance Schema | Added `document_type`, `is_active`, `approval_status`, `authorized_by`, `authorized_at`. Structurally required for CGST Rule 46 compliance. |
| Lines 24-28 | `UPDATE public.branch` | `public.branch` | DML / Backfill | Backfilled `company_id` and `gst_registration_id` for Indiranagar and Whitefield branches. Environment-safe. |
| Lines 30-36 | `UPDATE public.invoice_sequence` | `public.invoice_sequence` | DML / Historical Governance | Deprecated legacy `CTH` sequence bound to historical GSTIN `29AAACC1234F1Z5`. Sets `approval_status = 'DEPRECATED_HISTORICAL'`, `is_active = false`. Correct. |
| **Lines 38-44** | `UPDATE public.invoice_sequence` | `public.invoice_sequence` | **DML / CRITICAL DEFECT** | **CTH-P42-003**: Unconditionally sets `approval_status = 'APPROVED'`, `is_active = true`, `authorized_by = 'ca_audit_signed'` for prefixes `SAFE-TEST`, `CONC`, `FYBND`, `LKTEST`. Fabricates statutory CA signature without genuine human audit. |
| **Lines 46-51** | `UPDATE public.invoice_sequence` | `public.invoice_sequence` | **DML / CRITICAL DEFECT** | Sets `approval_status = 'APPROVED'`, `is_active = true`, `authorized_by = 'partner_audit_signed'` for `PRT-8899`. Synthetic partner signature. |
| Lines 53-180 | `CREATE OR REPLACE FUNCTION` | `public.allocate_invoice_number` | DDL / Stored Procedure | Implements fail-closed atomic invoice number allocation with advisory lock, idempotency checks, and CGST Rule 46 validation. Sound procedural logic. |

## 3. Forward-Only Corrective Migration `c7_13` Inventory

| Step | Statement | Purpose | Security Guarantee |
|---|---|---|---|
| 1 | `CREATE TABLE public.invoice_series_approval_audit` | Immutable audit log table | Captures every series state change with primary key, timestamps, user identity, and statutory reason. |
| 2 | `CREATE TRIGGER trg_invoice_series_audit_immutable` | Append-only enforcement | Blocks `UPDATE` and `DELETE` on the audit log table, raising `STATUTORY_SECURITY_VIOLATION`. |
| 3 | `ALTER TABLE public.invoice_sequence ADD CONSTRAINT ...` | DDL Constraints | Enforces regex `^[A-Za-z0-9\-_]{1,16}$` on prefix and strict enum validation on `approval_status`. |
| 4 | `UPDATE public.invoice_sequence SET approval_status = 'REVOKED_SYNTHETIC' ...` | Neutralization of synthetic approvals | Reclassifies `SAFE-TEST`, `CONC`, `FYBND`, `LKTEST`, and `PRT-8899` to `REVOKED_SYNTHETIC` and `is_active = false`. |
| 5 | `INSERT INTO public.invoice_series_approval_audit ...` | Audit Trail Backfill | Formally records the revocation event in the immutable audit log table. |
| 6 | `CREATE TRIGGER trg_invoice_sequence_governance` | State Machine Enforcement | Blocks synthetic approver strings from ever granting `APPROVED` status, locks `DEPRECATED_HISTORICAL` and `REVOKED_SYNTHETIC` terminal states, and auto-logs future transitions. |

## 4. Blast Radius Assessment
- In `cth_test`: Migration `c7_12` was never applied. 0 rows affected. Baseline remains pristine.
- In disposable environments: `c7_13` neutralized all 6 synthetic rows. Remaining synthetic `APPROVED` rows: exactly 0.

