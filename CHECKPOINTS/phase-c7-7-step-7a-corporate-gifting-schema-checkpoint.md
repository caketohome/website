# Phase C7.7 Step 7A Checkpoint — Corporate Gifting Database Foundations & Schema Migration

**Status**: ✅ COMPLETE & INDEPENDENTLY AUDITED (STOP APPLIED)  
**Date**: 2026-10-09  
**Milestone**: Phase C7.7 Step 7A — Corporate Gifting Database Foundations  
**Prior Milestone**: Phase C7.6 Complete & Frozen ([`phase-c7-6-step-4e-cost-allocation-ui-checkpoint.md`](file:///E:/vig/cakes2home-main/cakes2home-main/CHECKPOINTS/phase-c7-6-step-4e-cost-allocation-ui-checkpoint.md))  
**Next Milestone**: Phase C7.7 Step 7B — Corporate Gifting Domain Engine & Ingestion (Awaiting User Authorization — NOT STARTED)

---

## 1. Executive Summary

Phase C7.7 Step 7A establishes the relational database foundations for Corporate Gifting campaigns, batch tracking, recipient delivery scheduling, single master corporate invoicing, and cost-centre attribution.

All schema elements were applied via a non-destructive, idempotent migration transaction, verified against PostgreSQL catalog metadata, tested across 56 schema assertions, and audited with zero mutations to the Chart of Accounts (locked at 100 canonical accounts) or the balanced Trial Balance (Dr ₹3,380.00 = Cr ₹3,380.00).

---

## 2. Migration Execution

- **Migration Scripts**:
  - [`frontend/migrate_phase_c7_7_step7a_corporate_gifting_schema.js`](file:///E:/vig/cakes2home-main/cakes2home-main/frontend/migrate_phase_c7_7_step7a_corporate_gifting_schema.js) (Applied via transaction runner)
  - [`backend/src/migrations/20261009_phase_c7_7_corporate_gifting_schema.sql`](file:///E:/vig/cakes2home-main/cakes2home-main/backend/src/migrations/20261009_phase_c7_7_corporate_gifting_schema.sql) (Archived standard SQL)
- **Execution Mode**: Atomic single transaction (`BEGIN ... COMMIT` with `ROLLBACK` on any error).
- **Idempotency**: Re-execution tested with exit code 0 and identical schema state.
- **Row Counts**: Both new tables contain **strictly 0 rows** (zero synthetic or unapproved data).

---

## 3. Schema Architecture & Invariants

### 3.1 `public.corporate_gifting_batch` (25 Columns)
Master entity tracking corporate gifting upload batches, credit exposure, processing lifecycle, master commercial billing, and audit logs.

| Column | Data Type | Nullable | Constraints & Foreign Keys | Description |
|---|---|:---:|---|---|
| `id` | `TEXT` | NO | `PRIMARY KEY DEFAULT ('cgb_' \|\| gen_random_uuid()::text)` | Unique batch identifier |
| `customer_id` | `TEXT` | NO | `REFERENCES public.customer(id) ON DELETE RESTRICT` | Corporate customer |
| `company_id` | `TEXT` | YES | `REFERENCES public.company(id) ON DELETE RESTRICT` | Multi-tenant company entity |
| `batch_name` | `VARCHAR(255)` | NO | None | Campaign / upload name |
| `source_filename`| `VARCHAR(255)` | NO | None | Original `.xlsx` filename |
| `file_hash` | `VARCHAR(64)` | NO | Part of unique index | SHA-256 file checksum |
| `file_size_bytes`| `BIGINT` | YES | None | File size in bytes |
| `status` | `VARCHAR(50)` | NO | `DEFAULT 'DRAFT' CHECK (status IN ('DRAFT', 'VALIDATED', 'SCHEDULED', 'PROCESSING', 'COMPLETED', 'CANCELLED', 'FAILED'))` | Explicit lifecycle status |
| `total_recipients`| `INTEGER` | NO | `DEFAULT 0 CHECK (total_recipients >= 0)` | Total recipient roster count |
| `total_amount` | `NUMERIC(15, 2)`| NO | `DEFAULT 0.00 CHECK (total_amount >= 0.00)` | Total batch estimated value |
| `validated_recipients`| `INTEGER`| NO | `DEFAULT 0 CHECK (validated_recipients >= 0)` | Passed validation count |
| `invalid_recipients`| `INTEGER`| NO | `DEFAULT 0 CHECK (invalid_recipients >= 0)` | Failed validation count |
| `processed_recipients`| `INTEGER`| NO | `DEFAULT 0 CHECK (processed_recipients >= 0)` | Dispatched order count |
| `scheduled_delivery_date`| `DATE` | YES | None | Target delivery window/date |
| `invoice_id` | `TEXT` | YES | `REFERENCES public.invoice(id) ON DELETE SET NULL` | Master corporate tax invoice |
| `order_id` | `TEXT` | YES | `REFERENCES public."order"(id) ON DELETE SET NULL` | Master commercial order umbrella |
| `cost_centre_id`| `TEXT` | YES | `REFERENCES public.cost_centre(id) ON DELETE RESTRICT` | C7.6 management cost centre |
| `metadata` | `JSONB` | NO | `DEFAULT '{}'::jsonb` | Extensible audit attributes |
| `created_by` | `TEXT` | YES | `REFERENCES public."user"(id) ON DELETE SET NULL` | Audit creator user |
| `created_at` | `TIMESTAMPTZ` | NO | `DEFAULT NOW()` | Record creation timestamp |
| `updated_at` | `TIMESTAMPTZ` | NO | `DEFAULT NOW()` | Last update timestamp |
| `cancelled_by` | `TEXT` | YES | `REFERENCES public."user"(id) ON DELETE SET NULL` | User who cancelled batch |
| `cancelled_at` | `TIMESTAMPTZ` | YES | None | Cancellation timestamp |
| `cancellation_reason`| `TEXT` | YES | None | Cancellation audit explanation |
| `deleted_at` | `TIMESTAMPTZ` | YES | None | Soft deletion timestamp |

### 3.2 `public.corporate_gifting_recipient` (28 Columns)
Child entity representing individual gift deliveries to employees/recipients.

| Column | Data Type | Nullable | Constraints & Foreign Keys | Description |
|---|---|:---:|---|---|
| `id` | `TEXT` | NO | `PRIMARY KEY DEFAULT ('cgr_' \|\| gen_random_uuid()::text)` | Unique recipient identifier |
| `batch_id` | `TEXT` | NO | `REFERENCES public.corporate_gifting_batch(id) ON DELETE RESTRICT` | Parent batch reference |
| `row_number` | `INTEGER` | NO | `CHECK (row_number >= 1)` | Deterministic Excel row index |
| `employee_id` | `VARCHAR(100)`| YES | None | Client internal employee ID |
| `recipient_name`| `VARCHAR(255)`| NO | None | Recipient full name |
| `recipient_phone`| `VARCHAR(50)` | NO | None | 10-digit mobile number |
| `delivery_address`| `TEXT` | NO | None | Street delivery address |
| `delivery_pincode`| `VARCHAR(20)` | NO | None | 6-digit postal PIN code |
| `delivery_city`| `VARCHAR(100)`| YES | None | City name |
| `delivery_state`| `VARCHAR(100)`| YES | None | State name |
| `delivery_date`| `DATE` | NO | None | Scheduled delivery date |
| `delivery_slot`| `VARCHAR(50)` | YES | None | Time window (MORNING/AFTERNOON/EVENING)|
| `product_id` | `TEXT` | YES | `REFERENCES public.product(id) ON DELETE RESTRICT` | Catalog product |
| `variant_id` | `TEXT` | YES | `REFERENCES public.product_variant(id) ON DELETE RESTRICT` | Catalog product variant |
| `sku` | `VARCHAR(100)`| NO | None | Catalog SKU code |
| `quantity` | `INTEGER` | NO | `DEFAULT 1 CHECK (quantity > 0)` | Quantity of items |
| `unit_price` | `NUMERIC(15, 2)`| NO | `DEFAULT 0.00 CHECK (unit_price >= 0.00)` | Unit selling price |
| `line_total` | `NUMERIC(15, 2)`| NO | `DEFAULT 0.00 CHECK (line_total >= 0.00)` | Quantity * Unit Price |
| `gift_message` | `TEXT` | YES | None | Greeting card text |
| `validation_status`| `VARCHAR(50)`| NO | `DEFAULT 'PENDING' CHECK (validation_status IN ('PENDING', 'VALID', 'INVALID'))` | Pre-import validation flag |
| `validation_errors`| `JSONB` | YES | None | Row-level validation errors array |
| `order_id` | `TEXT` | YES | `REFERENCES public."order"(id) ON DELETE SET NULL` | Dispatched child order |
| `delivery_id` | `TEXT` | YES | `REFERENCES public.delivery(id) ON DELETE SET NULL` | Dispatched child delivery |
| `status` | `VARCHAR(50)` | NO | `DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'ORDER_CREATED', 'DISPATCHED', 'DELIVERED', 'FAILED', 'CANCELLED'))` | Fulfillment lifecycle |
| `metadata` | `JSONB` | NO | `DEFAULT '{}'::jsonb` | Extensible metadata |
| `created_at` | `TIMESTAMPTZ` | NO | `DEFAULT NOW()` | Record creation timestamp |
| `updated_at` | `TIMESTAMPTZ` | NO | `DEFAULT NOW()` | Record update timestamp |
| `deleted_at` | `TIMESTAMPTZ` | YES | None | Soft delete timestamp |

### 3.3 Relational & Referential Indexes
- `idx_cgb_customer_file_hash_active`: `UNIQUE (customer_id, file_hash) WHERE status != 'FAILED' AND deleted_at IS NULL` (Replay protection).
- `uq_cgr_batch_row`: `UNIQUE (batch_id, row_number)` (Row identity & deduplication).
- `idx_cgb_customer_id`, `idx_cgb_status`, `idx_cgb_created_at`, `idx_cgb_invoice_id`, `idx_cgb_order_id`, `idx_cgb_cost_centre_id`.
- `idx_cgr_batch_id`, `idx_cgr_validation_status`, `idx_cgr_status`, `idx_cgr_delivery_date`, `idx_cgr_order_id`, `idx_cgr_delivery_id`, `idx_cgr_variant_id`, `idx_cgr_phone`.

---

## 4. Invariants Verification Evidence

### 4.1 Schema Verification Suite (`test_phase_c7_7_step7a_schema.js`)
```
=============================================================================
CakeToHome ERP — Phase C7.7 Step 7A Schema Verification Suite
=============================================================================

[Test Suite 1: Table & Column Structural Existence]
  ✓ PASS: public.corporate_gifting_batch exists in database
  ✓ PASS: public.corporate_gifting_recipient exists in database
  ✓ PASS: corporate_gifting_batch has 25 columns (expected >= 25)
  ✓ PASS: corporate_gifting_recipient has 28 columns (expected >= 28)
  ✓ PASS: corporate_gifting_batch includes column [id]
  ✓ PASS: corporate_gifting_batch includes column [customer_id]
  ✓ PASS: corporate_gifting_batch includes column [file_hash]
  ✓ PASS: corporate_gifting_batch includes column [status]
  ✓ PASS: corporate_gifting_batch includes column [total_recipients]
  ✓ PASS: corporate_gifting_batch includes column [total_amount]
  ✓ PASS: corporate_gifting_batch includes column [invoice_id]
  ✓ PASS: corporate_gifting_batch includes column [order_id]
  ✓ PASS: corporate_gifting_batch includes column [cost_centre_id]
  ✓ PASS: corporate_gifting_batch includes column [metadata]
  ✓ PASS: corporate_gifting_recipient includes column [id]
  ✓ PASS: corporate_gifting_recipient includes column [batch_id]
  ✓ PASS: corporate_gifting_recipient includes column [row_number]
  ✓ PASS: corporate_gifting_recipient includes column [recipient_name]
  ✓ PASS: corporate_gifting_recipient includes column [recipient_phone]
  ✓ PASS: corporate_gifting_recipient includes column [delivery_address]
  ✓ PASS: corporate_gifting_recipient includes column [delivery_pincode]
  ✓ PASS: corporate_gifting_recipient includes column [delivery_date]
  ✓ PASS: corporate_gifting_recipient includes column [sku]
  ✓ PASS: corporate_gifting_recipient includes column [quantity]
  ✓ PASS: corporate_gifting_recipient includes column [unit_price]
  ✓ PASS: corporate_gifting_recipient includes column [line_total]
  ✓ PASS: corporate_gifting_recipient includes column [validation_status]
  ✓ PASS: corporate_gifting_recipient includes column [status]

[Test Suite 2: Index Verification]
  ✓ PASS: Unique index idx_cgb_customer_file_hash_active exists
  ✓ PASS: Index idx_cgb_customer_id exists
  ✓ PASS: Index idx_cgb_status exists
  ✓ PASS: Index idx_cgb_invoice_id exists
  ✓ PASS: Index idx_cgb_cost_centre_id exists
  ✓ PASS: Index idx_cgr_batch_id exists
  ✓ PASS: Index idx_cgr_validation_status exists
  ✓ PASS: Index idx_cgr_status exists
  ✓ PASS: Index idx_cgr_delivery_date exists
  ✓ PASS: Unique constraint uq_cgr_batch_row exists

[Test Suite 3: Foreign Key Constraints]
  ✓ PASS: FK: corporate_gifting_batch.customer_id -> customer(id) RESTRICT
  ✓ PASS: FK: corporate_gifting_batch.cost_centre_id -> cost_centre(id) RESTRICT
  ✓ PASS: FK: corporate_gifting_batch.invoice_id -> invoice(id) SET NULL
  ✓ PASS: FK: corporate_gifting_batch.order_id -> order(id) SET NULL
  ✓ PASS: FK: corporate_gifting_recipient.batch_id -> corporate_gifting_batch(id) RESTRICT
  ✓ PASS: FK: corporate_gifting_recipient.product_id -> product(id) RESTRICT
  ✓ PASS: FK: corporate_gifting_recipient.variant_id -> product_variant(id) RESTRICT

[Test Suite 4: CHECK Constraints & Status Rejection]
  ✓ PASS: PostgreSQL rejected invalid batch status (CHECK constraint enforced)
  ✓ PASS: PostgreSQL rejected negative total_recipients (CHECK constraint enforced)
  ✓ PASS: PostgreSQL rejected row_number < 1 (CHECK constraint enforced)

[Test Suite 5: Duplicate File Hash Upload Rejection]
  ✓ PASS: Duplicate active file hash rejected for same customer by unique index

[Test Suite 6: Source Row Number Uniqueness in Batch]
  ✓ PASS: Duplicate row_number in same batch rejected by unique constraint uq_cgr_batch_row

[Test Suite 7: Referential Integrity Deletion Protection]
  ✓ PASS: Deleting batch with active recipients is RESTRICTed by foreign key

[Test Suite 8: Fixture Cleanup & Zero Row Baseline]
  ✓ PASS: corporate_gifting_batch row count = 0 (expected 0)
  ✓ PASS: corporate_gifting_recipient row count = 0 (expected 0)

[Test Suite 9: Accounting Invariants]
  ✓ PASS: CoA count strictly preserved at 100 (expected 100)
  ✓ PASS: Trial Balance balanced: Dr ₹3380.00 === Cr ₹3380.00
  ✓ PASS: Active ungranted locks = 0 (expected 0)

=============================================================================
Verification Complete: 56 PASSED, 0 FAILED
=============================================================================
```

### 4.2 Independent PostgreSQL Audit (`audit_c7_7_step7a_independent.js`)
```
==================================================================
  INDEPENDENT POSTGRESQL AUDIT — PHASE C7.7 STEP 7A FINAL
==================================================================

  ✓ PASS: public.corporate_gifting_batch exists with strictly 0 rows (actual: 0)
  ✓ PASS: public.corporate_gifting_recipient exists with strictly 0 rows (actual: 0)
  ✓ PASS: corporate_gifting_batch column count === 25 (actual: 25)
  ✓ PASS: corporate_gifting_recipient column count === 28 (actual: 28)
  ✓ PASS: Foreign key count >= 10 (actual: 12)
  ✓ PASS: Unique index idx_cgb_customer_file_hash_active exists and is active
  ✓ PASS: Unique constraint uq_cgr_batch_row exists
  ✓ PASS: Chart of Accounts count === 100 canonical accounts (actual: 100)
  ✓ PASS: Authoritative Trial Balance: Dr ₹3380.00 === Cr ₹3380.00
  ✓ PASS: Trial balance difference is strictly ₹0.0000
  ✓ PASS: Total vouchers === 6 baseline vouchers (actual: 6)
  ✓ PASS: Total journal entries === 4 baseline entries (actual: 4)
  ✓ PASS: Total journal lines === 10 baseline lines (actual: 10)
  ✓ PASS: Ungranted database locks === 0 (actual: 0)

==================================================================
  AUDIT SUMMARY: 14 PASSED, 0 FAILED
==================================================================
```

### 4.3 TypeScript Verification
- `npx tsc --noEmit` exited with **code 0 (zero errors)**.
- Domain types added to [`frontend/src/lib/types/accounting.types.ts`](file:///E:/vig/cakes2home-main/cakes2home-main/frontend/src/lib/types/accounting.types.ts).

---

## 5. Files Changed & Git State

### Files Created
- `backend/src/migrations/20261009_phase_c7_7_corporate_gifting_schema.sql`
- `frontend/migrate_phase_c7_7_step7a_corporate_gifting_schema.js`
- `frontend/scratch/test_phase_c7_7_step7a_schema.js`
- `frontend/scratch/audit_c7_7_step7a_independent.js`
- `CHECKPOINTS/phase-c7-7-step-7a-corporate-gifting-schema-checkpoint.md`
- `frontend/CHECKPOINTS/phase-c7-7-step-7a-corporate-gifting-schema-checkpoint.md`

### Files Modified
- `frontend/src/lib/types/accounting.types.ts` (added TypeScript types for C7.7)
- `CHECKPOINTS/LATEST_CHECKPOINT.md` (updated active phase and step)
- `frontend/CHECKPOINTS/LATEST_CHECKPOINT.md` (updated active phase and step)

### Git Status
- `git status -uno` confirms zero uncommitted changes outside of authorized files.
- **Zero git commits or pushes were made.**

---

## 6. Stop Gate & Scope Enforced

- **Step 7A is COMPLETE and FROZEN.**
- **No Excel ingestion service, order creation, invoice posting, API controllers, or UI panels have been implemented.**
- Awaiting user review and authorization before proceeding to **Step 7B (Corporate Gifting Domain Engine & Ingestion Service)**.
