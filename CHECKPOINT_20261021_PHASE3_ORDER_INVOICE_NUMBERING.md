# CHECKPOINT: Unique Order Numbers & Financial-Year Invoice Sequencing

**Date:** 2026-10-21T20:14:00+05:30  
**Phase:** 3 of 4 Complete (Schema + Functions + Application Code)  
**Status:** Awaiting TypeScript build verification and migration execution

---

## What Was Done

### Phase 1 + 2: Database Schema & Atomic Functions (Migration File)

**File:** [`Migration_Unique_Order_Invoice_Numbering.sql`](file:///e:/vig/cakes2home-main/cakes2home-main/migration/Migration_Unique_Order_Invoice_Numbering.sql)

| Object | Type | Purpose |
|---|---|---|
| `order.order_number` column | ALTER TABLE | First-class indexed column for order numbers |
| `idx_order_order_number_unique` | UNIQUE INDEX | Prevents duplicate order numbers |
| `idx_invoice_invoice_number_unique` | UNIQUE INDEX | Prevents duplicate invoice numbers |
| `order_sequence` table | CREATE TABLE | Atomic monotonic counter for order numbers |
| `invoice_sequence` table | CREATE TABLE | FY-aware counter table for invoice numbers |
| `invoice_allocation_log` table | CREATE TABLE | GST gap tracking audit log |
| `allocate_order_number()` | PL/pgSQL FUNCTION | Atomic order number allocation with advisory lock |
| `allocate_invoice_number()` | PL/pgSQL FUNCTION | Atomic FY-aware invoice allocation with advisory lock + audit log |

### Phase 3: Application Code Changes

| File | Change | Lines |
|---|---|---|
| [`order.service.ts`](file:///e:/vig/cakes2home-main/cakes2home-main/frontend/src/lib/services/order.service.ts) | Order number via `allocate_order_number()` inside transaction; idempotency check moved inside txn; INSERT includes `order_number` column | 74-84, 335-337, 417-496 |
| [`delivery-invoicing.service.ts`](file:///e:/vig/cakes2home-main/cakes2home-main/frontend/src/lib/services/delivery-invoicing.service.ts) | Removed in-memory fallback; `allocateInvoiceNumber()` now calls `allocate_invoice_number()` PostgreSQL function | 16-56, 172 |
| [`bills-receivable.service.ts`](file:///e:/vig/cakes2home-main/cakes2home-main/frontend/src/lib/services/bills-receivable.service.ts) | Replaced raw `nextval('statutory_invoice_seq')` with `allocate_invoice_number()` function | 1045-1050 |
| [`order.repository.ts`](file:///e:/vig/cakes2home-main/cakes2home-main/frontend/src/lib/repositories/order.repository.ts) | `mapRowToDomain` reads `o.order_number` first; `findById` includes `order_number` in lookup; `save()` persists `order_number` column | 163-164, 437, 493-535 |

### What Was NOT Changed (by design)

- ❌ **Zero mutations to historical data values** — existing order numbers and invoice numbers are preserved
- ❌ **No changes to order lifecycle state machine** — transition logic untouched
- ❌ **No changes to frontend UI components** — they consume order_number from domain objects as before
- ❌ **No changes to webhook/event payloads** — they already reference `order.order_number`

## Vulnerabilities Resolved

| ID | Vulnerability | Resolution |
|---|---|---|
| **O-1** | Non-unique order numbers (`Date.now().slice(-6)`) | ✅ Atomic `allocate_order_number()` with advisory lock |
| **O-2** | No `order_number` DB column | ✅ First-class column with UNIQUE index |
| **O-3** | No UNIQUE constraint on `display_id` | ✅ UNIQUE index on `order_number` column |
| **I-1** | No UNIQUE constraint on `invoice_number` | ✅ UNIQUE index on `invoice_number` |
| **I-2** | In-memory fallback resets to 100 | ✅ Fallback removed entirely |
| **I-3** | Single sequence, no FY reset | ✅ `invoice_sequence` table with `(fiscal_year, prefix)` key |
| **I-5** | No gap tracking | ✅ `invoice_allocation_log` table |

## Design Decisions Made

| Decision | Choice | Rationale |
|---|---|---|
| **D-1** Order number format | `CTH-YYYYMMDD-NNNNNN` | Date-sortable, IST-aware, human-readable |
| **D-2** Invoice sequence strategy | Counter table + advisory lock | FY-aware reset, atomic, gap-tracked |
| **D-3** Multi-GSTIN | Single `CTH/` prefix (extensible via prefix param) | Current entity structure is single GSTIN |
| **D-4** In-memory fallback | Removed — DB-or-fail | Invoice failure queued for retry, doesn't block delivery |
| **D-5** Historical migration | Backfill from metadata JSONB | Zero-mutation, derive-only |

## Phase 4: Remaining Release Gates

| Gate | Criteria | Status |
|---|---|---|
| **G-1** | TypeScript build passes | 🔄 In progress |
| **G-2** | Migration executes cleanly on Supabase | 🔲 Pending |
| **G-3** | All 234 orders have unique `order_number` after backfill | 🔲 Pending migration |
| **G-4** | All 5 invoices have unique `invoice_number` | 🔲 Pending migration |
| **G-5** | `invoice_sequence` seeded correctly | 🔲 Pending migration |
| **G-6** | New order creation produces unique order numbers | 🔲 Pending integration test |
| **G-7** | New delivery produces unique invoice numbers | 🔲 Pending integration test |
| **G-8** | FY boundary test (March 31 → April 1) | 🔲 Pending integration test |
| **G-9** | Historical data 100% preserved | 🔲 Pending migration verification |
