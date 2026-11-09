# Approval Audit Table Adversarial Testing Report

## 1. Target Schema
Table `public.invoice_series_approval_audit`:
- `id` (UUID PRIMARY KEY)
- `series_id` (UUID REFERENCES public.invoice_sequence(id) ON DELETE RESTRICT)
- `prefix`, `gstin`, `fiscal_year`
- `previous_status`, `new_status`, `action`
- `performed_by`, `reason`, `created_at`

## 2. Adversarial Mutation Results
- Direct UPDATE attempt: **BLOCKED** (`TEST-P44-DB-10`, exception 23514)
- Direct DELETE attempt: **BLOCKED** (`TEST-P44-DB-11`, exception 23514)
- Direct TRUNCATE attempt: **BLOCKED** (`TEST-P44-DB-12`, exception 23514)
- Replica suppression attempt: **BLOCKED** (`TEST-P44-DB-14`, exception 23514)
- Parent sequence deletion: **BLOCKED** (`TEST-P44-DB-19`, ON DELETE RESTRICT)