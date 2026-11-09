# Database Schema and Migration Audit — Phase 4.2 Independent Forensic Audit

## 1. Migration Overview: `c7_12_database_driven_gst_and_invoice_series.sql`

Authoritative migration file: [`frontend/src/lib/migrations/c7_12_database_driven_gst_and_invoice_series.sql`](file:///e:/vig/cakes2home-main/cakes2home-main/frontend/src/lib/migrations/c7_12_database_driven_gst_and_invoice_series.sql)

### 1.1 Structural Schema Modifications
The migration introduces database-level relational governance to eliminate application-level assumptions:
1. **`public.branch` Alterations**:
   - `ADD COLUMN IF NOT EXISTS company_id uuid REFERENCES public.company(id) ON DELETE RESTRICT;`
   - `ADD COLUMN IF NOT EXISTS gst_registration_id uuid REFERENCES public.gst_registration(id) ON DELETE RESTRICT;`
   - Backfills active branches (`br_indiranagar_01`, `br_whitefield_06`) with active corporate entity IDs.
2. **`public.invoice_sequence` Alterations**:
   - `ADD COLUMN IF NOT EXISTS document_type text DEFAULT 'TAX_INVOICE' NOT NULL;`
   - `ADD COLUMN IF NOT EXISTS is_active boolean DEFAULT false NOT NULL;`
   - `ADD COLUMN IF NOT EXISTS approval_status text DEFAULT 'PROPOSED' NOT NULL;`
   - `ADD COLUMN IF NOT EXISTS authorized_by text;`
   - `ADD COLUMN IF NOT EXISTS authorized_at timestamp with time zone;`
3. **Stored Procedure Re-definition (`public.allocate_invoice_number`)**:
   - Drops legacy function signature with default prefix `'CTH'`.
   - Adds mandatory prefix and 15-character GSTIN format checks.
   - Enforces transaction-level concurrency locking via `pg_advisory_xact_lock`.
   - Implements strict fail-closed checks for cross-entity prefix conflicts and unauthorized/inactive series.
   - Qualifies all column references to prevent ambiguous column reference collisions with PL/pgSQL output parameters.

---

## 2. Approval-Provenance Audit (Forensic Answers to Section 6.2)

| Forensic Question | Authoritative Answer & Evidence | Risk Assessment |
| :--- | :--- | :---: |
| **1. Are `SAFE-TEST`, `CONC`, etc. inserted or approved by the migration?** | Existing rows in `invoice_sequence` are unconditionally updated to `approval_status = 'APPROVED', is_active = true, authorized_by = 'ca_audit_signed'` by lines 39–44 of `c7_12`. | HIGH |
| **2. Are these records restricted to disposable databases?** | **NO.** The SQL script contains no runtime guard checking `current_database()` or environment type. | CRITICAL |
| **3. Can the migration run against staging or production?** | **YES.** If executed against a staging or production PostgreSQL instance, it would promote test prefixes to approved status. | CRITICAL |
| **4. Can `ca_audit_signed` be written without authenticated approval?** | **YES.** The migration executes as a raw SQL script without cryptographic verification, user session, or digital signature. | HIGH |
| **5. Can an existing record be silently promoted to approved status?** | **YES.** Any row matching `prefix IN ('SAFE-TEST', 'CONC', 'FYBND', 'LKTEST')` is promoted without human intervention. | HIGH |
| **6. Can test data enter production through seed scripts or migration reuse?** | **YES.** If `c7_12` is included in a blanket production deployment without modifying lines 39–51, test series would become valid in production. | CRITICAL |
| **7. Does the application treat a string in `authorized_by` as sufficient evidence?** | The database procedure checks `approval_status = 'APPROVED' AND is_active = true`. The string `authorized_by` is plain text audit metadata. | MEDIUM |
| **8. Can a series be approved without an authenticated user, permission check, and audit event?** | In the SQL migration: **YES**. In the application API (`POST admin/compliance/invoice-series/approve`): **NO** (enforces Super Admin/Finance Controller role). | HIGH |

> [!IMPORTANT]
> **Statutory Policy Requirement**:
> Migration `c7_12_database_driven_gst_and_invoice_series.sql` must NOT be executed against production in its current form with lines 39–51 enabled. For staging and production environments, statutory series approvals must be granted exclusively via authenticated Finance Controller sign-off in the Admin Compliance UI or a dedicated, signed production migration containing the formal CA-designated series.

---

## 3. Forward-Only Migration Safety and Idempotency Verification

The migration was independently tested for idempotency on `cth_disposable_phase4_2`:
- **Statement Re-run Safety**:
  - `ADD COLUMN IF NOT EXISTS`: Safe for repeated executions.
  - `DROP FUNCTION IF EXISTS public.allocate_invoice_number(...)`: Safe for repeated executions.
  - Foreign key additions are guarded by column existence checks.
- **Rollback / Forward Strategy**:
  - In accordance with the repository's forward-only migration policy, no migrations are rolled back destructively.
  - Schema alterations are strictly additive (non-breaking forward compatibility).

