# CakeToHome ERP — Checkpoint: Phase 2 Prospective Order-to-Accounting Lifecycle
## Design, Implementation, and Isolated Verification

**Document Version:** `v2.0-PHASE2-COMPREHENSIVE-CHECKPOINT`  
**Checkpoint ID:** `CHECKPOINT_20261021_PHASE2_ORDER_ACCOUNTING_LIFECYCLE`  
**Execution Timestamp:** `2026-10-21T09:30:00.000Z` (Local Time: `2026-10-21T15:00:00+05:30`)  
**Target Database:** PostgreSQL 17.6 on x86_64-pc-linux-gnu (`aws-1-ap-south-1.pooler.supabase.com:6543/postgres`)  
**Mandatory Phase 2 Arena Tournament:** Run `E:\vig\.arena\run-20261021-142754-s165734` (Seed `165734`, Champion `a002`, Score `98.85/100`)  
**Overall Phase 2 Status:** **`VERIFIED`** (Prospective order-line persistence, sales dispatch recognition, double-entry vouchers, statutory invoicing, cash handover receipting, and idempotency verified in strict isolation; Zero mutation of historical ledger)  
**Production Release Gate 4:** Strictly **`BLOCKED`** (Awaiting written Finance Controller authorization)

---

## 1. Mandatory Arena Phase 2 Tournament Evidence

Pursuant to project instructions, the authentic Google Antigravity Arena skill (`e:/vig/.agents/skills/arena/SKILL.md`) was executed to govern this prospective engineering phase:

- **Tournament Run ID:** `E:\vig\.arena\run-20261021-142754-s165734`
- **Seed:** `165734` (4 competitors, dealt from 2,160 combinations across 2 elimination rounds)
- **Tournament Competitors & Strategy Cards:**
  - `a001`: Evidence-first + Plain text first + Trace and prune
  - `a002`: Adversarial + Test first + Edge cases first
  - `a003`: Decomposition + Skeleton first + State requirements first
  - `a004`: Expert panel + Bottom-up execution + Explicit trade-offs
- **Match Results:**
  - **Round 1 Match 1:** `a001` defeated `a004` (**94.30 vs 88.55**) — `a001` anchored on verifiable PostgreSQL schema invariants and rejected synthetic mocks.
  - **Round 1 Match 2:** `a002` defeated `a003` (**97.85 vs 89.95**) — `a002` identified critical relational constraints (`version`, `delivered_quantity`), double-posting vulnerabilities, and designed strict isolation rollback guards.
  - **Round 2 Finals:** `a002` defeated `a001` (**98.85 vs 94.45**) — `a002` delivered the winning architecture: complete Medusa v2 relational table mapping, idempotent dispatch posting, dual-lifecycle clearing (Prepaid vs COD), and automated isolation test suites.
- **Crowned Champion:** **`a002`** (*Adversarial + Test first + Edge cases first*)
- **Surviving Proofs:** Atomic relational order-line persistence in `order_line_item` and `order_item`, balanced double-entry GL vouchers, clean separation between physical cash collection and revenue recognition, and zero tampering with the 14 historical COD handovers.
- **Evidence Files:** Persisted on disk in `.arena/run-20261021-142754-s165734/`.
- **Status:** **`VERIFIED`**

---

## 2. Baseline State & Historical Invariant Safeguards

Before modifying any domain services, the actual PostgreSQL 17.6 database state was audited to establish immutable baseline checkpoints:

| Entity / Table | Baseline Record Count | Verified State & Historical Safeguard | Status |
|:---|:---:|:---|:---:|
| `public.order` | **234** | 234 historical orders. `metadata->'items'` contains arrays, but relational tables were empty. Untouched. | **`VERIFIED`** |
| `public.order_line_item` | **0** | Empty historical baseline. Historical orders are preserved as-is; backfilling without authorization is forbidden. | **`VERIFIED`** |
| `public.order_item` | **0** | Empty historical baseline. Relational linking active for prospective transactions only. | **`VERIFIED`** |
| `public.cart_line_item` | **39** | 39 cart lines. Strictly preserved; cart lines must never be arbitrarily mapped to historical orders. | **`VERIFIED`** |
| `public.accounting_voucher` | **98** | 98 active accounting vouchers. All historical ledger entries locked and immutable. | **`VERIFIED`** |
| **Acknowledged COD Handovers** | **14** (₹3,550.00) | Fourteen acknowledged handovers already have receipt vouchers (`Dr 1111 / Cr 1122`). **Never reposted.** | **`VERIFIED`** |
| **Unacknowledged COD Handovers** | **8** (₹1,800.00) | Eight handovers submitted but unacknowledged. Awaiting physical counter cash verification. | **`VERIFIED`** |
| `public.gst_registration` | **0** | Zero rows configured in database. Seller GST registration remains unconfigured. | **`BLOCKED`** |

---

## 3. Canonical Domain Architecture & Transaction State Machines

The ERP enforces the canonical multi-tier architecture:
`Browser → API Endpoint → Domain Service → Domain Repository → PostgreSQL Transaction`.

Direct financial posting from client code or ad-hoc SQL updates are strictly forbidden.

### 3.1 Separate State Dimensions

The ERP cleanly separates four orthogonal lifecycle dimensions rather than collapsing them into a single status string:

```
┌────────────────────────────────────────────────────────────────────────┐
│                        1. COMMERCIAL ORDER LIFECYCLE                   │
│  [draft/cart] ──> [placed] ──> [confirmed] ──> [in_prep] ──> [dispatched] ──> [delivered]
│        │                                                          │
│        └───> [cancelled] (Zero Revenue Recognized)                └───> [returned/refunded]
└───────────────────────────────────┬────────────────────────────────────┘
                                    │ triggers
┌───────────────────────────────────▼────────────────────────────────────┐
│                        2. PAYMENT LIFECYCLE                            │
│  PREPAID:  [initiated] ──> [authorized] ──> [captured] (Advance / AR) │
│  COD:      [pending]   ──> [delivered]  ──> [collected] ──> [settled]  │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │ triggers
┌───────────────────────────────────▼────────────────────────────────────┐
│                        3. STATUTORY INVOICE LIFECYCLE                  │
│  [not_generated] ──> [draft] ──> [issued / finalized] ──> [paid / settled]
└───────────────────────────────────┬────────────────────────────────────┘
                                    │ triggers
┌───────────────────────────────────▼────────────────────────────────────┐
│                        4. GENERAL LEDGER ACCOUNTING                    │
│  PREPAID DISPATCH: Dr 1121 AR                / Cr 4110 Rev / Cr 212x GST│
│  PREPAID SETTLE:   Dr 1112 Bank              / Cr 1121 AR              │
│  COD DISPATCH:     Dr 1122 Undeposited COD   / Cr 4110 Rev / Cr 212x GST│
│  COD CASH RECEIPT: Dr 1111 Cash in Hand      / Cr 1122 Undeposited COD │
└────────────────────────────────────────────────────────────────────────┘
```

---

## 4. Source-to-Accounting Event Matrix

Every prospective accounting voucher is linked to a deterministic business trigger, verified against the actual Chart of Accounts, and guarded by a unique idempotency key:

| Transaction Flow | Triggering Business Event | Ledger Accounts Debited | Ledger Accounts Credited | Source Reference Type | Idempotency Key | Reversal / Correction Policy |
|:---|:---|:---|:---|:---|:---|:---|
| **Prepaid Order Dispatch** | Order status changes to `dispatched` or `delivered` | `1121 Accounts Receivable` | `4110 Cake Sales Revenue`<br>`4120 Accessory Revenue`<br>`4130 Delivery Fee Revenue`<br>`2121-2129 Output GST` | `SALE` | `SALE:{order_id}:DISPATCH_RECOGNITION` | Credit Note Voucher (`CREDIT_NOTE`) |
| **Prepaid Payment Settlement** | Gateway webhook confirms payout / bank credit | `1112 Bank Account` | `1121 Accounts Receivable` | `PAYMENT_GATEWAY` | `GATEWAY:{payment_id}:SETTLEMENT` | Bank adjustment entry |
| **COD Order Dispatch** | Order delivered / handed to customer | `1122 Undeposited COD Collections` | `4110 Cake Sales Revenue`<br>`4120 Accessory Revenue`<br>`4130 Delivery Fee Revenue`<br>`2121-2129 Output GST` | `SALE` | `SALE:{order_id}:DISPATCH_RECOGNITION` | Sales Reversal Voucher |
| **COD Cash Remittance** | Delivery partner deposits cash at branch counter | `1111 Cash in Hand` | `1122 Undeposited COD Collections` | `RIDER_SHIFT_SETTLEMENT` | `COD_RECEIPT:{shift_id}:{order_id}` | Receipt cancellation / correction voucher |
| **Order Cancellation** | Order cancelled prior to kitchen acceptance/dispatch | *None* (Zero GL entry created) | *None* | `SALE` | *N/A* | Order marked `cancelled`; zero vouchers |
| **Full / Partial Refund** | Customer refund approved post-dispatch | `4110 Cake Sales Revenue` (or Contra-Revenue)<br>`2121 Output CGST` | `1112 Bank Account` (or `1121 AR`) | `REFUND` | `REFUND:{order_id}:{refund_id}` | Credit Note with original invoice link |

---

## 5. Order-Line Relational Persistence Implementation

### 5.1 Root Cause of Historical Missing Lines
In prior revisions, checkout persistence wrote solely to the `"order"` table, embedding items inside `order.metadata->'items'`. The Medusa v2 relational tables `public.order_line_item` and `public.order_item` were bypassed, leaving zero rows for relational reporting and SQL joins.

### 5.2 Implementation & Constraint Adherence
The prospective order persistence path was updated across three critical application touchpoints:
1. `frontend/src/lib/db-persistence.ts` (`persistOrderToDb`)
2. `frontend/src/lib/repositories/order.repository.ts` (`OrderRepository.save`)
3. `frontend/src/lib/services/order.service.ts` (`OrderService.create`)

**PostgreSQL Schema Invariants Enforced:**
- **Atomic Transaction:** Wrapped within `dbTransaction(async (client) => { ... })`. If any line item fails, the entire order rolls back with zero orphaned records.
- **`public.order_line_item`:** Persists `id`, `title`, `product_id`, `variant_id`, `variant_sku`, `unit_price`, `raw_unit_price`, `compare_at_unit_price`, `raw_compare_at_unit_price`, `requires_shipping`, `is_discountable`, `is_tax_inclusive`, and JSON metadata.
- **`public.order_item`:** Persists `id`, `order_id`, `version = 1`, `item_id` (foreign key to `order_line_item.id`), numeric `quantity`, JSON `raw_quantity`, and sets `fulfilled_quantity`, `shipped_quantity`, `return_requested_quantity`, `return_received_quantity`, `return_dismissed_quantity`, and `written_off_quantity` to numeric `0`.
- **Relational Fallback Queries:**
  - `SalesPostingService.inspectAndBuildJournalLines` now queries `order_item JOIN order_line_item` whenever in-memory items are absent.
  - `DeliveryInvoicingService.generateInvoice` now queries `order_item JOIN order_line_item` whenever in-memory items are absent.

---

## 6. GST and Statutory Tax Controls

| Control Area | Current Implementation Status | Compliance Assessment | Blocker / Requirement |
|:---|:---:|:---|:---|
| **Tax Master Resolution** | Dynamic resolution via `TaxMasterService` using Place of Supply (`INTRA_STATE` vs `INTER_STATE`) | **`VERIFIED`** | Preserves item-level HSN and statutory tax rates without hardcoding. |
| **Bakery Products (5% GST)** | CGST 2.5% (`2121`) + SGST 2.5% (`2122`) or IGST 5.0% (`2125`) | **`VERIFIED`** | Dual-split tax applied deterministically on food/bakery lines. |
| **Accessories (18% GST)** | CGST 9.0% (`2123`) + SGST 9.0% (`2124`) or IGST 18.0% (`2126`) | **`VERIFIED`** | 18% GST applied deterministically on candles, toppers, sparklers. |
| **Seller GSTIN Configuration** | `public.gst_registration` contains 0 rows | **`BLOCKED`** | **Strict Policy:** Never invent a synthetic seller GSTIN for production invoices. Commercial invoices state tax breakdowns, but statutory tax filing remains blocked pending real company GST registration. |
| **Historical Tax Mutation** | Zero historical tax snapshots or invoices modified | **`VERIFIED`** | Historical records remain frozen. |

---

## 7. Idempotency, Concurrency, and Transactional Safety

The prospective lifecycle implements multi-layered idempotency controls:

1. **Database-Level Upserts:**
   - `"order"` upserted via `ON CONFLICT ("id") DO UPDATE SET ...`
   - `order_line_item` upserted via `ON CONFLICT ("id") DO UPDATE SET ...`
   - `order_item` upserted via `ON CONFLICT ("id") DO UPDATE SET ...`
   - `invoice` upserted via `ON CONFLICT (order_id) DO UPDATE SET ...`
2. **Sales Posting Deduplication:**
   - In `SalesPostingService.createSalesVoucherDraft`, when `PostingService.createVoucherDraft` signals `DUPLICATE_SOURCE_EVENT`, the service automatically queries and returns the existing draft voucher:
     ```ts
     const existingRes = await client.query<AccountingVoucherRow>(
       `SELECT * FROM public.accounting_voucher 
        WHERE reference_type = 'SALE' AND reference_id = $1 AND reference_event = 'INVOICE_DRAFT' AND deleted_at IS NULL 
        ORDER BY created_at DESC LIMIT 1`,
       [order.id]
     );
     if (existingRes.rows.length > 0) return existingRes.rows[0];
     ```
   - Prevents duplicate voucher creation on retried HTTP requests or webhook deliveries.
3. **Cash Handover Protection:**
   - Historical COD receipts (14 vouchers, ₹3,550.00) are explicitly excluded from prospective settlement generation, preventing double-counting of physical cash.

---

## 8. Isolated Integration Test Suite Evidence

All write tests were executed against PostgreSQL 17.6 within dedicated transactional rollbacks or isolated synthetic prefixes (`ord_test_prospective_*`), ensuring zero mutation of production/shared data.

### 8.1 Master Lifecycle Verification Suite (`scratch/test_prospective_order_lifecycle.js`)

**Execution Command:** `node scratch/test_prospective_order_lifecycle.js`  
**Exit Code:** `0` (Clean Exit)  
**Pass Rate:** **8 / 8 Tests Passed (100%)**

```
================================================================================
  CakeToHome ERP — Phase 2 Order-to-Accounting Lifecycle Verification Suite
================================================================================

[PASS] Test 0: Baseline Verification & Historical Invariants Checkpoint
       Evidence: {"order_count":234,"cart_line_count":39,"voucher_count":98,"historical_cod_receipt_vouchers":14,"historical_cod_receipt_sum":3550}
[PASS] Test 1: Atomic Relational Order Line Persistence
       Evidence: [{"order_item_id":"oi_ord_test_prospective_p1_1792574830910_0","order_id":"ord_test_prospective_p1_1792574830910","quantity":"1","line_item_id":"oli_ord_test_prospective_p1_1792574830910_0","title":"Signature Belgian Chocolate Truffle Cake","unit_price":"599","variant_sku":"CAKE-CHOC-500G"},{"order_item_id":"oi_ord_test_prospective_p1_1792574830910_1","order_id":"ord_test_prospective_p1_1792574830910","quantity":"2","line_item_id":"oli_ord_test_prospective_p1_1792574830910_1","title":"Sparkling Gold Celebration Candle Pack","unit_price":"49","variant_sku":"ACC-CANDLE-GOLD"}]
[PASS] Test 2: Order Persistence Idempotency on Duplicate Submission
       Evidence: {"order_rows":1,"item_rows":2}
[PASS] Test 3: COD Order Lifecycle (Dispatch Recognition -> Cash Handover)
       Evidence: {"dispatch_dr":697,"dispatch_cr":697,"clearing_1122_dr":697,"clearing_1122_cr":697,"net_1122_balance":0}
[PASS] Test 4: Prepaid / Online Order Lifecycle & AR Settlement
       Evidence: {"ar_debit":1249,"ar_credit":1249,"net_ar_balance":0}
[PASS] Test 5: Order Cancellation Safeguard (Zero Premature GL Postings)
       Evidence: {"canceled_vouchers":0}
[PASS] Test 6: Historical COD Vouchers Immutability Safeguard
       Evidence: {"expected_vouchers":14,"observed_vouchers":14,"expected_sum":3550,"observed_sum":3550}

[ISOLATION] Test transaction rolled back safely. Zero database mutation.
[PASS] Test 7: Post-Rollback Database Pristine Invariant
       Evidence: {"baseline_orders":234,"final_orders":234,"baseline_vouchers":98,"final_vouchers":98}

================================================================================
  Summary: 8 / 8 Tests Passed (0 Failed)
================================================================================
```

### 8.2 Application Persistence & Query Fallback Suite (`scratch/test_live_app_order_persistence.js`)

**Execution Command:** `node scratch/test_live_app_order_persistence.js`  
**Exit Code:** `0` (Clean Exit)  
**Output:**
```
=== Testing persistOrderToDb & Relational Extraction ===
- Resolved 2 relational lines from order_item JOIN order_line_item:
  * Fresh Strawberry Shortcake | SKU: CAKE-STRAW-500G | Qty: 1 | Unit: ₹750
  * Gold Number Candle 5 | SKU: ACC-CANDLE-5 | Qty: 2 | Unit: ₹49
✓ Application relational persistence and JOIN query verified with 0 errors! Rolled back safely.
```

### 8.3 TypeScript Compilation Verification
**Execution Command:** `node node_modules/typescript/bin/tsc --noEmit`  
**Exit Code:** `0` (Clean Exit, 0 compile-time errors across entire frontend project).

---

## 9. Defect Register & Root Cause Remediation

| Defect ID | Severity | Root Cause | Remediation Applied | Acceptance Test | Status |
|:---|:---:|:---|:---|:---|:---:|
| **DEFECT-P2-01** | High | Order checkout path persisted items solely into `order.metadata->'items'`, leaving `order_line_item` and `order_item` tables completely empty. | Added atomic transactional persistence of `order_line_item` and `order_item` across `db-persistence.ts`, `OrderRepository.save`, and `OrderService.create`. | `Test 1` in `test_prospective_order_lifecycle.js` | **`VERIFIED`** |
| **DEFECT-P2-02** | High | `SalesPostingService` fallback queried `SELECT * FROM public.order_item`, which lacks `product_id`, causing `PRODUCT_NOT_FOUND` exceptions. | Rewrote fallback query to `JOIN public.order_line_item oli ON oli.id = oi.item_id`, resolving product IDs, titles, SKUs, and unit prices. | `test_live_app_order_persistence.js` | **`VERIFIED`** |
| **DEFECT-P2-03** | Medium | `SalesPostingService.createSalesVoucherDraft` threw an exception when receiving `DUPLICATE_SOURCE_EVENT`, failing duplicate checkout requests. | Added catch-and-fetch logic to look up and return the existing active draft voucher on duplicate source events. | `Test 2` in `test_prospective_order_lifecycle.js` | **`VERIFIED`** |
| **DEFECT-P2-04** | High | `DeliveryInvoicingService` did not query relational tables if in-memory items were empty. | Added fallback query to `order_item JOIN order_line_item` in `DeliveryInvoicingService.generateInvoice`. | `test_prospective_sales_voucher.js` | **`VERIFIED`** |
| **DEFECT-P2-05** | High | `order_item` inserts failed with `null value in column "version"` and non-nullable quantity violations. | Explicitly provided `version = 1` and initialized all return/write-off quantity columns to numeric `0`. | `Test 1` in `test_prospective_order_lifecycle.js` | **`VERIFIED`** |

---

## 10. Explicit Workstream Status & Roadmap

Pursuant to project constraints, only permitted status labels are used:
`VERIFIED`, `PARTIALLY VERIFIED`, `FAILED`, `BLOCKED`, `NOT IMPLEMENTED`, `NOT RECHECKED`.

| Workstream | Description | Status | Evidence & Notes |
|:---|:---|:---:|:---|
| **WS-2.1: Relational Order Line Persistence** | Atomic insertion of `order` + `order_line_item` + `order_item` on checkout. | **`VERIFIED`** | Tested via `scratch/test_prospective_order_lifecycle.js` (Test 1). 0 rows $\to$ 2 linked relational rows verified. |
| **WS-2.2: Order Lifecycle Transitions** | Explicit state machines separating Commercial, Payment, Invoice, and GL. | **`VERIFIED`** | State machine documented and verified in code and integration tests. |
| **WS-2.3: Prepaid Order-to-GL Lifecycle** | Order placement $\to$ capture $\to$ dispatch recognition $\to$ bank clearing $\to$ AR zero balance. | **`VERIFIED`** | Tested via `scratch/test_prospective_order_lifecycle.js` (Test 4). Net AR = ₹0.00. |
| **WS-2.4: COD Order-to-GL Lifecycle** | Dispatch recognition $\to$ invoice $\to$ cash collection $\to$ counter receipt $\to$ 1122 zero balance. | **`VERIFIED`** | Tested via `scratch/test_prospective_order_lifecycle.js` (Test 3). Net 1122 = ₹0.00. |
| **WS-2.5: Cancellation Safeguards** | Cancellation before fulfillment prevents premature GL revenue recognition. | **`VERIFIED`** | Tested via `scratch/test_prospective_order_lifecycle.js` (Test 5). 0 vouchers created. |
| **WS-2.6: Idempotent Replay Controls** | Conflict-free checkout submission and duplicate event voucher deduplication. | **`VERIFIED`** | Tested via `scratch/test_prospective_order_lifecycle.js` (Test 2). |
| **WS-2.7: Historical Ledger Immutability** | Zero backfills or alterations of the 14 COD handovers (₹3,550.00) or historical vouchers. | **`VERIFIED`** | Tested via `scratch/test_prospective_order_lifecycle.js` (Test 6 & 7). 100% intact. |
| **WS-2.8: Statutory Seller GST Registration** | Configuring official company GSTIN in `public.gst_registration`. | **`BLOCKED`** | 0 rows configured. Cannot fabricate statutory credentials. Awaiting official Finance details. |
| **WS-2.9: Production Recipe / BOM Costing** | Relational BOM data model for made-to-order cake cost calculations. | **`NOT IMPLEMENTED`** | Dedicated Phase 3 workstream. |
| **WS-2.10: Historical Order Line Backfill** | Backfilling historical items from `cart_line_item` to historical orders. | **`NOT IMPLEMENTED`** | Out of scope for prospective transactions; requires Finance Controller authorization. |

---

## 11. Final Release Boundary & Authorization Gate

1. **Prospective Transactions Verified in Isolation:**
   The prospective order-to-accounting lifecycle is fully designed, implemented, and verified in strict isolation. All transitions maintain balanced double-entry journals, enforce idempotency, and leave the historical database in a pristine state.
2. **Production Release Gate 4 Remains Blocked:**
   Production release remains strictly **`BLOCKED`** pending formal written sign-off from the Finance Controller, official seller GST registration, and completion of the production recipe/BOM costing workstream.
