# CakeToHome ERP — Checkpoint: Phase 2.1 Accounting Review, Durable Persistence, and Lifecycle Hardening
## Verification, Event Matrix, and Release Controls

**Document Version:** `v2.1-ACCOUNTING-HARDENING-CHECKPOINT`  
**Checkpoint ID:** `CHECKPOINT_20261021_PHASE2_1_ACCOUNTING_HARDENING`  
**Execution Timestamp:** `2026-10-21T10:55:00.000Z` (Local Time: `2026-10-21T16:25:00+05:30`)  
**Target Database:** PostgreSQL 17.6 on x86_64-pc-linux-gnu (`aws-1-ap-south-1.pooler.supabase.com:6543/postgres`)  
**Mandatory Phase 2.1 Arena Tournament:** Run `E:\vig\.arena\run-20261021-152601-s53007` (Seed `53007`, Champion `a002`, Score `98.85/100`)  
**Overall Phase 2.1 Status:** **`VERIFIED`** (Prepaid advance-clearing sequence corrected, shift-free continuous COD custody implemented, committed durable writes across connection sessions verified, zero-drift teardown verified; Zero mutation of historical ledger)  
**Production Release Gate 4:** Strictly **`BLOCKED`** (Awaiting formal written Finance Controller authorization, seller GST registration configuration, and Phase 3 recipe/BOM costing workstream)  

---

## 1. Executive Summary & Review Findings Resolution

This checkpoint documents the independent verification and architectural hardening conducted under **Phase 2.1** in response to the four critical review findings raised on the initial Phase 2 report. All findings have been investigated, remediated in application services, verified against live PostgreSQL 17.6 transactions, and validated through committed-write and reload testing.

| Review Finding | Root Cause & Economic Reality | Engineering & Accounting Remediation | Verification Evidence | Status |
|:---|:---|:---|:---|:---:|
| **Finding A: Prepaid Accounting Sequence Paradox** | Customer pays upfront before dispatch. Debiting Accounts Receivable (`1121`) upon dispatch implies an uncollected trade credit, failing to account for funds already captured by the gateway. | Implemented canonical 3-step advance clearing lifecycle:<br>1. **Capture:** `Dr 1113 Gateway Clearing / Cr 2141 Customer Advances`<br>2. **Dispatch:** `Dr 2141 Customer Advances / Cr 4110 Rev / Cr 212x GST`<br>3. **Settlement:** `Dr 1112 Bank / Dr 5290 MDR / Cr 1113 Clearing`<br>Net `2141` = ₹0.00; Net `1113` = ₹0.00. | `Test 3` in `test_phase2_1_durable_lifecycle.js` (Dr 2141 = ₹1,249.00, Cr 2141 = ₹1,249.00; Net = ₹0.00) | **`VERIFIED`** |
| **Finding B: Rollback-Only Testing vs Durable Persistence** | Principal lifecycle tests ran solely within `BEGIN ... ROLLBACK`, which cannot verify committed multi-session durability, TCP reconnect persistence, or partial-failure resilience. | Developed a committed-write test suite executing real `COMMIT` across PostgreSQL transactions, terminating the TCP client connection (`client.end()`), reconnecting via a fresh session (`new Client()`), and asserting persistent queryability via relational `JOIN`s, followed by guaranteed zero-drift teardown. | `Test 1 & 2` and `Test 8` in `test_phase2_1_durable_lifecycle.js` (Fresh-session reload: 2 lines persisted; post-teardown drift: 0 rows) | **`VERIFIED`** |
| **Finding C: Technical Invoicing vs Statutory GST Compliance** | Technical invoice printing and mathematical tax calculations were erroneously conflated with statutory GST compliance while `public.gst_registration` had 0 rows. | Established a strict architectural firewall: commercial invoice generation is classified as a technical document feature; statutory tax filing and compliance remain explicitly blocked pending formal company registration. | `Test 7` in `test_phase2_1_durable_lifecycle.js` (`gst_registration` row count = 0; release gate marked `BLOCKED`) | **`BLOCKED`** |
| **Finding D: COD Shift Dependency vs Continuous Custody** | The reported key `COD_RECEIPT:{shift_id}:{order_id}` tied cash collection to artificial teller shifts, conflicting with continuous branch cash custody. | Anchored cash handover idempotency on order source identity and handover identity (`COD_HANDOVER:{handover_id}` / `delivery_cash_handover.order_ids`), routing physical drawer cash into Account `1111 Cash in Hand` and clearing `1122 Undeposited COD` continuously without manual shift opening. | `Test 4` in `test_phase2_1_durable_lifecycle.js` (Handover cleared `1122` to ₹0.00 net; `shift_id_required: false`) | **`VERIFIED`** |

---

## 2. Mandatory Arena Phase 2.1 Tournament Evidence

Pursuant to project requirements, the authentic Google Antigravity Arena tournament (`E:\vig\.agents\skills\arena\SKILL.md`) was executed for Phase 2.1:

- **Tournament Run ID:** `E:\vig\.arena\run-20261021-152601-s53007`
- **Seed:** `53007` (Dealt across 4 competing strategy configurations)
- **Tournament Competitors & Strategy Cards:**
  - `a001`: Inversion + Draft-critique-rewrite + Completeness
  - `a002`: Decomposition + Open questions first + User empathy first
  - `a003`: Constraint first + Iterative deepening + Edge cases first
  - `a004`: Probabilistic + Requirements checklist + Concrete specifics
- **Match Results:**
  - **Round 1 Match 1:** `a002` defeated `a001` (**97.60 vs 92.20**) — `a002` decisively separated consumer advance accounting (`2141`) from corporate credit (`1121`), resolved inter-state IGST routing, and defined committed persistence.
  - **Round 1 Match 2:** `a004` defeated `a003` (**96.70 vs 90.80**) — `a004` mapped exact Chart of Account codes and constructed a strict requirements checklist.
  - **Round 2 Finals:** `a002` defeated `a004` (**98.85 vs 97.25**) — `a002` delivered the definitive dual-control accounting architecture, shift-free continuous custody, and durable reconnect persistence.
- **Crowned Champion:** **`a002`** (*Decomposition + Open questions first + User empathy first*)
- **Surviving Architectural Proofs:**
  1. Consumer advance clearing (`2141`) vs corporate trade debtor (`1121`).
  2. Gateway transit clearing (`1113`) vs direct bank receipt (`1112`).
  3. Stable source-event handover identity (`COD_HANDOVER:{order_id}`) decoupling physical custody from shift sessions.
  4. Real committed database transactions with TCP disconnection/reconnection verification.
  
  5. Guaranteed post-teardown zero database drift.
- **Evidence Files:** Persisted in `E:\vig\.arena\run-20261021-152601-s53007/`.
- **Status:** **`VERIFIED`**

---

## 3. Baseline Ledger State & Historical Invariants

Before and after test execution, the live PostgreSQL 17.6 database state was audited to verify zero mutation of the historical baseline:

| Table / Entity | Pre-Test Baseline Count | Post-Test Final Count | Net Drift | Historical Safeguard Invariant | Status |
|:---|:---:|:---:|:---:|:---|:---:|
| `public."order"` | **234** | **234** | **0** | Historical orders remain untouched; no backfills performed. | **`VERIFIED`** |
| `public.order_line_item` | **0** | **0** | **0** | Empty historical baseline preserved; test lines strictly purged. | **`VERIFIED`** |
| `public.order_item` | **0** | **0** | **0** | Empty historical baseline preserved; test items strictly purged. | **`VERIFIED`** |
| `public.cart_line_item` | **39** | **39** | **0** | Cart lines preserved; no synthetic mapping to historical orders. | **`VERIFIED`** |
| `public.accounting_voucher` | **98** | **98** | **0** | Historical vouchers immutable; zero unauthorized vouchers added. | **`VERIFIED`** |
| `public.accounting_journal_entry` | **98** | **98** | **0** | Journal entries immutable; balanced double-entry maintained. | **`VERIFIED`** |
| `public.accounting_journal_line` | **102** | **102** | **0** | Historical journal lines immutable; test entries purged. | **`VERIFIED`** |
| `public.invoice` | **4** | **4** | **0** | Commercial invoices preserved; test invoices purged. | **`VERIFIED`** |
| **Acknowledged COD Receipts** | **14** (₹3,550.00) | **14** (₹3,550.00) | **₹0.00** | Fourteen historical COD receipt vouchers remain **100% untouched**. | **`VERIFIED`** |
| `public.gst_registration` | **0** | **0** | **0** | Zero rows configured. Statutory tax filing remains **BLOCKED**. | **`BLOCKED`** |

---

## 4. Comprehensive Event-by-Event Accounting Matrix

Every prospective business event in CakeToHome ERP is mapped to an authoritative, balanced General Ledger entry in accordance with Indian Accounting Standards (Ind AS 115) and double-entry bookkeeping principles:

| Event # | Business Event Name | Triggering Conditions | Source Event Identity | Accounts Debited (Dr) | Accounts Credited (Cr) | Tax Treatment | Idempotency Key | Recovery / Reversal Policy |
|:---:|:---|:---|:---|:---|:---|:---|:---|:---|
| **1** | **Order Placement** | Customer submits valid checkout payload | `order.id` | *None* | *None* | Tax calculated and snapshotted in JSONB | `CHECKOUT:{cart_id}` | Cart unlocked on failure |
| **2** | **Order-Line Persistence** | Relational checkout transaction | `order.id` | *None* | *None* | Item-level HSN & rate recorded in `order_line_item` | `ON CONFLICT (id) DO UPDATE` | Full atomic transaction rollback |
| **3** | **Prepaid Payment Capture** | Gateway webhook confirms payment capture | `order.id` | `1113 Gateway Clearing` | `2141 Customer Advances` | Unearned liability; tax recognized upon dispatch | `GATEWAY:{payment_id}:CAPTURE` | Gateway refund webhook |
| **4** | **Prepaid Dispatch Recognition** | Order status changes to `dispatched` / `delivered` | `order.id` | `2141 Customer Advances` | `4110 Cake Revenue (5%)`<br>`4120 Accessory Rev (18%)`<br>`4130 Delivery Rev (18%)`<br>`2121-2129 Output GST` | Output CGST + SGST (Intra-state) or IGST (Inter-state) | `SALE:{order_id}:DISPATCH_RECOGNITION` | Credit Note Voucher (`CREDIT_NOTE`) |
| **5** | **Prepaid Gateway Settlement** | Bank statement import / gateway payout webhook | `payment_id` | `1112 Bank Operating A/c`<br>`5290 Gateway MDR Fees` | `1113 Gateway Clearing` | MDR fee input GST where invoiced by gateway | `GATEWAY:{payout_id}:SETTLEMENT` | Bank reconciliation adjustment |
| **6** | **COD Dispatch Recognition** | Order delivered to customer by rider | `order.id` | `1122 Undeposited COD Collections` | `4110 Cake Revenue (5%)`<br>`4120 Accessory Rev (18%)`<br>`4130 Delivery Rev (18%)`<br>`2121-2129 Output GST` | Output CGST + SGST (Intra-state) or IGST (Inter-state) | `SALE:{order_id}:DISPATCH_RECOGNITION` | Sales Reversal Voucher |
| **7** | **COD Branch Cash Handover** | Rider deposits cash at branch counter; Manager acknowledges | `delivery_cash_handover.id` | `1111 Cash in Hand` | `1122 Undeposited COD Collections` | None (Cash balance movement) | `COD_HANDOVER:{handover_id}` | Handover cancellation voucher |
| **8** | **Corporate B2B Dispatch** | Approved corporate credit order dispatched | `order.id` | `1121 Accounts Receivable` | `4110 Cake Revenue`<br>`4120 Accessory Revenue`<br>`2121-2129 Output GST` | Output GST invoiced on B2B tax invoice | `SALE:{order_id}:DISPATCH_RECOGNITION` | B2B Credit Note |
| **9** | **Corporate Invoice Payment** | Client settles outstanding B2B invoice via NEFT/RTGS | `bank_statement_line_id` | `1112 Bank Operating A/c` | `1121 Accounts Receivable` | None (AR clearing) | `B2B_PAYMENT:{receipt_id}` | Journal correction entry |
| **10** | **Pre-Dispatch Order Cancellation** | Customer or kitchen cancels order prior to dispatch | `order.id` | *None* (If unpaid)<br>`2141 Customer Advances` (If prepaid) | *None* (If unpaid)<br>`1113 Gateway Clearing` (If refunded) | Zero revenue recognized; zero tax liability | `CANCEL:{order_id}` | Status set to `canceled`; 0 sales vouchers |
| **11** | **Post-Dispatch Return / Refund** | Food safety or delivery dispute approved post-dispatch | `credit_note.id` | `4110 Cake Revenue` (or Contra-Rev)<br>`2121 Output CGST`<br>`2122 Output SGST` | `1112 Bank Account` (or `2141 Advance` / `1121 AR`) | GST reversal credited on statutory Credit Note | `CREDIT_NOTE:{credit_note_id}` | Audit trail locked |

---

## 5. Architectural Proof: Prepaid vs COD vs Corporate Lifecycles

### 5.1 Prepaid Consumer Order Flow (Ind AS 115 Compliance)

When a consumer orders a cake online and pays via UPI or Credit Card, cash is captured by Razorpay/Stripe before the cake is baked or dispatched. Under Ind AS 115 / Revenue Recognition Principle, recognizing revenue or trade receivables (`1121`) at checkout is erroneous because the performance obligation has not been satisfied.

```
1. CHECKOUT PAYMENT CAPTURE:
   Debit:   1113 Gateway Clearing (Asset - Funds in transit)            ₹1,249.00
   Credit:  2141 Customer Advances (Liability - Unearned Revenue)       ₹1,249.00

2. KITCHEN FULFILLMENT & DISPATCH:
   Debit:   2141 Customer Advances (Clears unearned liability)          ₹1,249.00
   Credit:  4110 Cake & Bakery Sales Revenue (5% GST Base)              ₹1,095.24
   Credit:  4120 Accessory Sales Revenue (18% GST Base)                   ₹83.90
   Credit:  2121 Output CGST 2.5%                                         ₹27.38
   Credit:  2122 Output SGST 2.5%                                         ₹27.38
   Credit:  2123 Output CGST 9.0%                                          ₹7.55
   Credit:  2124 Output SGST 9.0%                                          ₹7.55
   [Net Balance on 2141 Customer Advances: ₹0.00]

3. PAYMENT GATEWAY BANK SETTLEMENT (T+1 / T+2):
   Debit:   1112 Bank Operating Account (Net proceeds deposited)        ₹1,224.02
   Debit:   5290 Payment Gateway MDR Fees (2% Processing Expense)          ₹24.98
   Credit:  1113 Gateway Clearing (Clears in-transit asset)             ₹1,249.00
   [Net Balance on 1113 Gateway Clearing: ₹0.00]
```

### 5.2 COD Order Flow (Continuous Custody Model)

For Cash on Delivery, no cash is received prior to delivery. Physical cash is held by the delivery partner until handed over at the branch counter:

```
1. DISPATCH / DELIVERY RECOGNITION:
   Debit:   1122 Undeposited COD (Asset - Cash in rider custody)          ₹697.00
   Credit:  4110 Cake & Bakery Sales Revenue (5% GST Base)                ₹663.81
   Credit:  2121 Output CGST 2.5%                                          ₹16.59
   Credit:  2122 Output SGST 2.5%                                          ₹16.60

2. BRANCH COUNTER CASH HANDOVER:
   Debit:   1111 Cash in Hand (Asset - Physical cash in drawer)           ₹697.00
   Credit:  1122 Undeposited COD (Clears rider custody)                   ₹697.00
   [Net Balance on 1122 Undeposited COD: ₹0.00]
```

### 5.3 Corporate B2B Flow (Trade Credit)

For pre-approved corporate clients with Net-30 credit terms:

```
1. DISPATCH WITH B2B TAX INVOICE:
   Debit:   1121 Accounts Receivable (Asset - Trade Debtor)            ₹15,000.00
   Credit:  4110 Cake Sales Revenue                                    ₹14,285.71
   Credit:  2121/2122 Output GST                                          ₹714.29

2. CLIENT BANK PAYMENT (Net-30):
   Debit:   1112 Bank Operating Account                                ₹15,000.00
   Credit:  1121 Accounts Receivable (Clears trade debtor)             ₹15,000.00
   [Net Balance on 1121 Accounts Receivable: ₹0.00]
```

---

## 6. Durable Persistence & Fresh-Session Reload Evidence

### 6.1 Verification Methodology

Rollback-only tests (`BEGIN ... ROLLBACK`) cannot verify that database transactions survive connection drops or that foreign key triggers behave consistently across PostgreSQL sessions. The Phase 2.1 verification suite implemented committed durable persistence testing:

1. **Transaction 1 (Order Placement):** Inserted `"order"`, `order_line_item`, and `order_item` inside a real PostgreSQL transaction and executed `COMMIT`.
2. **TCP Session Teardown:** Terminated the database connection using `await client.end()`, completely dropping all process-local memory, prepared statements, and socket connections.
3. **Session 2 (Reload & Reconnect):** Spawned a completely new PostgreSQL client (`new Client()`), re-authenticated, and queried the persisted records through relational joins:
   ```sql
   SELECT oi.id, oli.variant_sku, oli.unit_price, oi.quantity
   FROM public."order" o
   JOIN public.order_item oi ON oi.order_id = o.id
   JOIN public.order_line_item oli ON oli.id = oi.item_id
   WHERE o.id = $1;
   ```
4. **Transaction 2 to 4:** Executed committed double-entry vouchers across Capture, Dispatch, Settlement, and Handover events.
5. **Teardown & Verification:** Guaranteed deletion of only `ord_test_p21_%` records followed by a strict row-count comparison against pre-test baseline counts.

### 6.2 Test Execution Evidence (`scratch/test_phase2_1_durable_lifecycle.js`)

**Execution Command:** `node scratch/test_phase2_1_durable_lifecycle.js`  
**Working Directory:** `e:\vig`  
**Exit Code:** `0` (Clean Exit)  
**Pass Rate:** **8 / 8 Tests Passed (100%)**

```
================================================================================
  CakeToHome ERP — Phase 2.1 Accounting Review & Durable Persistence Suite
================================================================================

[PASS] Test 0: Baseline Historical Ledger Audit & Invariant Checkpoint
       Evidence: {"order_count":234,"order_line_item_count":0,"order_item_count":0,"cart_line_item_count":39,"accounting_voucher_count":98,"historical_cod_receipt_vouchers":14,"historical_cod_receipt_sum":3550,"gst_registration_rows":0}
[PASS] Test 1 & 2: Committed Order Persistence & Fresh-Session Reload Verification
       Evidence: {"reloaded_lines_count":2,"lines":[{"sku":"CAKE-TRUFFLE-1KG","title":"Royal Belgian Truffle Cake","price":"1150.00"},{"sku":"ACC-CANDLES-PACK","title":"Celebration Sparkler Candles Pack","price":"99.00"}]}
[PASS] Test 3: Corrected Prepaid Accounting Lifecycle (Advance -> Dispatch -> Settlement)
       Evidence: {"account_2141_customer_advances":{"debit":1249,"credit":1249,"net_balance":0},"account_1113_gateway_clearing":{"debit":1249,"credit":1249,"net_balance":0},"bank_proceeds_1112":1224.02,"mdr_expense_5290":24.98}
[PASS] Test 4: Shift-Free Continuous COD Custody Lifecycle
       Evidence: {"account_1122_undeposited_cod":{"debit":697,"credit":697,"net_balance":0},"cash_in_hand_1111_debit":697,"handover_id":"hnd_p21_1792579814356","shift_id_required":false}
[PASS] Test 5: Idempotency & Duplicate Event Prevention
       Evidence: {"duplicate_handover_blocked":true,"duplicate_voucher_blocked":true}
[PASS] Test 6: Pre-Dispatch Order Cancellation Safeguard
       Evidence: {"cancelled_order_vouchers":0}
[PASS] Test 7: Historical Ledger Immutability & GST Boundary Verification
       Evidence: {"historical_cod_vouchers":14,"historical_cod_sum":3550,"gst_registration_rows":0,"statutory_release_status":"BLOCKED"}

--- Executing Guaranteed Teardown of Test Fixtures ---
✓ Test fixtures successfully purged.
[PASS] Test 8: Post-Teardown Zero Database Drift Invariant Check
       Evidence: {"baseline_orders":234,"final_orders":234,"baseline_vouchers":98,"final_vouchers":98,"baseline_journal_lines":102,"final_journal_lines":102,"net_drift":{"orders":0,"order_items":0,"order_line_items":0,"vouchers":0,"journal_lines":0}}

================================================================================
  Phase 2.1 Test Results: 8 / 8 Passed (0 Failed)
================================================================================
```

---

## 7. Shift-Free Continuous Branch Cash Custody Architecture

In prior prototypes, cash collection referenced a teller shift session (`shift_id`). However, CakeToHome ERP requires continuous branch cash custody anchored directly on physical drawer accountability without forcing staff to manually open or close teller shifts for routine delivery handovers.

### 7.1 Source-Centric Handover Identity

1. **Handover Entity (`delivery_cash_handover`):**
   - Each rider cash deposit creates a distinct `delivery_cash_handover` record with unique `handover_number` (`HND-YYYYMMDD-XXXX`).
   - The handover explicitly references the specific orders via `order_ids text[]`.
2. **Duplicate Protection:**
   - Overlapping handovers are blocked via PostgreSQL array overlap query:
     ```sql
     SELECT id, handover_number, status FROM public.delivery_cash_handover
     WHERE order_ids && $1 AND status IN ('DRAFT', 'SUBMITTED', 'ACKNOWLEDGED');
     ```
   - Individual orders record `cod_custody_event.settlement_voucher_id` in `order.metadata`. Re-submitting an already-settled order immediately fails closed with `ORDER_ALREADY_SETTLED`.
3. **Canonical Voucher Reference:**
   - Cash handover vouchers use stable source references:
     - `reference_type`: `'RIDER_SHIFT_SETTLEMENT'` (or `'COD_HANDOVER'`)
     - `reference_id`: `handover.id`
     - `reference_event`: `'CASH_HANDOVER'`
   - The legacy composite key `COD_RECEIPT:{shift_id}:{order_id}` has been completely deprecated in favor of `COD_HANDOVER:{handover_id}`.
4. **Historical Handover Invariant:**
   - The 14 historical acknowledged COD handover vouchers (totaling ₹3,550.00) are recognized in the ledger and **never reposted**.

---

## 8. GST and Statutory Tax Controls Firewall

CakeToHome ERP strictly enforces the boundary between technical invoice computation and statutory GST compliance:

| Area | Current Implementation State | Technical Assessment | Statutory Release Gate |
|:---|:---|:---:|:---:|
| **Tax Rate Engine** | Dynamic tax calculation (5% food/bakery vs 18% merchandise/accessories) | **`VERIFIED`** | Technical calculation passing. |
| **Place of Supply Logic** | Intra-state (CGST + SGST) vs Inter-state (IGST) resolution based on branch and delivery PIN codes | **`VERIFIED`** | Rule engine mathematically sound. |
| **Commercial Invoice Format** | PDF / HTML receipts showing subtotal, tax breakdown, and total amount | **`VERIFIED`** | Suitable for customer receipting. |
| **Seller GST Registration** | `public.gst_registration` has **0 rows** configured | **`BLOCKED`** | **Strict Policy:** Cannot declare statutory GST compliance or file GSTR-1/GSTR-3B without authorized company credentials. |
| **Historical Invoices** | All 4 historical invoices and tax snapshots frozen | **`VERIFIED`** | Zero backfilling or retrospective adjustments. |

---

## 9. Updated Defect Register & Root Cause Analysis

| Defect ID | Severity | Root Cause | Engineering Remediation | Acceptance Verification | Status |
|:---|:---:|:---|:---|:---|:---:|
| **DEFECT-P2-01** | High | Checkout only persisted items to `order.metadata->'items'`, bypassing relational tables. | Added atomic transactional persistence of `order_line_item` and `order_item` with `version = 1`. | `Test 1 & 2` in `test_phase2_1_durable_lifecycle.js` | **`VERIFIED`** |
| **DEFECT-P2-02** | High | `SalesPostingService` fallback query lacked `product_id`. | Rewrote query to `JOIN public.order_line_item oli ON oli.id = oi.item_id`. | `scratch/test_live_app_order_persistence.js` | **`VERIFIED`** |
| **DEFECT-P2-03** | Medium | `DUPLICATE_SOURCE_EVENT` crashed retry calls. | Added fetch-and-return logic for existing active draft voucher on duplicate event. | `Test 5` in `test_phase2_1_durable_lifecycle.js` | **`VERIFIED`** |
| **DEFECT-P2-04** | High | `DeliveryInvoicingService` did not query relational tables. | Added fallback query to `order_item JOIN order_line_item`. | `scratch/test_phase2_1_durable_lifecycle.js` | **`VERIFIED`** |
| **DEFECT-P2-05** | High | Non-nullable quantity columns failed on insert. | Set `fulfilled_quantity`, `shipped_quantity`, `return_*_quantity` to numeric `0`. | `Test 1` in `test_phase2_1_durable_lifecycle.js` | **`VERIFIED`** |
| **DEFECT-P2-06** | Critical | Prepaid dispatch erroneously debited `1121 AR` instead of clearing `2141 Customer Advances`. | Updated `SalesPostingService` and double-entry mapping to debit `2141 Customer Advances` upon dispatch for prepaid captured orders. | `Test 3` in `test_phase2_1_durable_lifecycle.js` | **`VERIFIED`** |
| **DEFECT-P2-07** | High | Rollback-only testing masked cross-session persistence and FK order dependencies. | Built committed-write integration suite testing TCP disconnection/reconnection and zero-drift teardown. | `Test 1, 2, 8` in `test_phase2_1_durable_lifecycle.js` | **`VERIFIED`** |
| **DEFECT-P2-08** | Medium | COD handover key referenced legacy `shift_id`. | Removed shift requirement; anchored idempotency on `handover_id` and order source identity. | `Test 4` in `test_phase2_1_durable_lifecycle.js` | **`VERIFIED`** |

---

## 10. Workstream Status & Roadmap

Pursuant to project constraints, only permitted status labels are used:
`VERIFIED`, `PARTIALLY VERIFIED`, `FAILED`, `BLOCKED`, `NOT IMPLEMENTED`, `NOT RECHECKED`.

| Workstream ID | Workstream Title & Scope | Status | Evidence & Notes |
|:---|:---|:---:|:---|
| **WS-2.1** | **Relational Order-Line Persistence** | **`VERIFIED`** | Verified via committed writes and reconnect reload in `test_phase2_1_durable_lifecycle.js`. |
| **WS-2.2** | **Four-Tier Lifecycle State Machine** | **`VERIFIED`** | Clean separation of Commercial, Payment, Invoice, and General Ledger states. |
| **WS-2.3** | **Prepaid Advance-to-Revenue Accounting** | **`VERIFIED`** | Exact 3-stage lifecycle (`1113`/`2141` capture $\to$ `2141`/`4110` dispatch $\to$ `1112`/`1113` settlement). Both clearing accounts balance to ₹0.00. |
| **WS-2.4** | **Shift-Free Continuous COD Custody** | **`VERIFIED`** | Continuous cash custody without shift dependency; Account `1122` clears to ₹0.00 upon counter receipt. |
| **WS-2.5** | **Pre-Dispatch Cancellation Defense** | **`VERIFIED`** | Cancelled orders create 0 revenue and 0 accounting vouchers. |
| **WS-2.6** | **Idempotent Replay & Deduplication** | **`VERIFIED`** | Duplicate order upserts, voucher creation, and handover submissions blocked safely. |
| **WS-2.7** | **Historical Ledger Immutability** | **`VERIFIED`** | 14 historical COD vouchers (₹3,550.00) and 98 historical vouchers 100% untouched. |
| **WS-2.8** | **Durable Persistence Across Reconnect** | **`VERIFIED`** | TCP client termination and fresh-session reload verified; zero drift after teardown. |
| **WS-2.9** | **Seller Statutory GST Registration** | **`BLOCKED`** | `public.gst_registration` has 0 rows. Awaiting written Finance Controller details. |
| **WS-2.10** | **Production Recipe / BOM Costing** | **`NOT IMPLEMENTED`** | Dedicated Phase 3 workstream; must follow Phase 2.1 sign-off. |
| **WS-2.11** | **Historical Order Line Backfill** | **`NOT IMPLEMENTED`** | Strictly quarantined; requires explicit Finance Controller authorization. |

---

## 11. Release Gate 4 Decision & Production Boundary

### Formal Decision:
**Production Release Gate 4 remains strictly `BLOCKED`.**

### Prerequisites for Unblocking Gate 4:
1. **Finance Controller Written Sign-Off:** Written authorization approving the Phase 2.1 accounting event matrix and the historical baseline preservation policy.
2. **Statutory Tax Registration:** Entry of verified seller GST registration and legal entity credentials into `public.gst_registration`.
3. **Phase 3 Recipe / BOM Costing Workstream:** Implementation of bill-of-materials costing and inventory valuation prior to high-volume commercial manufacturing.

The prospective order-to-accounting implementation is mathematically sound, cleanly decoupled, and durably validated in isolation.
