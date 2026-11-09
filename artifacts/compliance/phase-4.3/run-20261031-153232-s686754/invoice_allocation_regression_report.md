# CakeToHome Phase 4.3 — Invoice Allocation Regression Report

## 1. Executive Summary
Regression verification was conducted to ensure that the statutory governance hardening introduced in Phase 4.3 did not break or regress any existing invoicing, order delivery, corporate billing, or accounting workflows.

## 2. Regression Suites Executed

| Suite | Component | Scope | Result | Key Verification |
|---|---|---|---|---|
| Delivery Invoicing | `DeliveryInvoicingService` | Order delivery invoice generation | **100% PASS (5/5)** | Correctly rejects conflicting and unapproved prefixes; allocates authorized `SEC-TEST` series; preserves idempotent replay on duplicate delivery events. |
| Statutory Allocation | `allocate_invoice_number` | Stored procedure execution | **100% PASS (8/8)** | Correctly validates GSTIN format, enforces Indian fiscal year boundaries, acquires advisory transaction locks, and checks active approval status. |
| Fiscal Boundary | `fiscal-period.ts` | Indian FY resolution (April-March) | **100% PASS (15/15)** | Rollover at April 1 00:00:00 IST; leap day handling; rejection of null/empty/NaN values without unhandled exceptions. |
| Concurrency & Locks | PostgreSQL 16 advisory locks | Concurrent client contention | **100% PASS** | Serialized allocations produce contiguous, strictly unique invoice serial numbers without collisions. |
| Order Display Sequence | `order_display_id_seq` | Customer order display identifiers | **100% PASS** | Sequence value remains 98587 in baseline; display IDs remain completely decoupled from invoice series. |

## 3. Preserved Business Logic & Invoicing Safety
- No GSTIN fallback has been reintroduced.
- Hardcoded `CTH` default prefix remains strictly eradicated from invoicing data paths.
- Bills receivable service and corporate billing continue to require dynamic DB-approved series.

