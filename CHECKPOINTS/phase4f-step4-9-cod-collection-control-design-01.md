# Phase 4F Step 4.9: Cash on Delivery (COD) Collection Control & Delivery Rider Remittance
## Account 1122 Subledger, Rider Custody Tracking & GL Reconciliation
### Final Custody & Settlement Data-Model Verification — Implementation Not Authorized

- **Checkpoint Identifier**: `CHECKPOINTS/phase4f-step4-9-cod-collection-control-design-01.md`
- **Classification**: **FINAL DATA-MODEL & ARCHITECTURE VERIFICATION — AWAITING PARTIAL-SETTLEMENT POLICY & IMPLEMENTATION DIRECTIVE**
- **Preceding Milestone**: `CHECKPOINTS/phase4f-step4-8-ar-statement-aging-reconciliation-implementation-01.md` (Complete & Frozen ✅)
- **Status**: 📋 **DATA MODEL & INTEGRATION VERIFIED — ZERO IMPLEMENTATION MUTATIONS**
- **Date**: 2026-09-27
- **Branch**: `task/dev`
- **Git Commit**: `f7d9a47` (0 commits, 0 pushes, working tree unmodified)

---

## 1. Executive Summary & Verification Scope

Following stakeholder directives, this document establishes the **Final Custody / Settlement Data-Model Verification** for **Phase 4F Step 4.9: Cash on Delivery (COD) Collection Control & Delivery Rider Remittance**.

### Locked Core Policies:
1. **COD Cash Collection Policy**: **MODEL B — Separate Authoritative Cash Collection Event** (Delivery $\ne$ Cash Collection $\ne$ Branch Remittance).
2. **Rider Remittance Policy**: **OPTION C — Batch / Shift-Level Rider Settlement** (Consolidated counter settlement with teller).
3. **Settlement Allocation Rule**: **Exact Source-Linked Allocation** (No arbitrary or silent FIFO allocation; fail-closed on unmatched cash).
4. **Over-Remittance Defense**: Strictly fails closed ($\text{Settlement} > \text{Outstanding Custody}$ forbidden).
5. **Strict Account Separation**: Account 1121 (Trade AR) and Account 1122 (Undeposited COD) remain 100% isolated. AR aging remains strictly feature-blocked.
6. **Historical Quarantine**: 173 historical orders and 53 transactions remain quarantined under `LEGACY_PROTOTYPE_DATA`.
7. **Canonical Step 4.5 Posting Engine**: Preserved as the sole double-entry clearing engine (`Dr 1111 / Cr 1122`).

### Key Data-Model Clarifications Resolved in this Document:
- **Authoritative Custody-Event Persistence**: How the individual custody event is persisted between doorstep cash collection and later shift settlement without requiring DDL.
- **Settlement Line Persistence**: How batch shift settlements preserve order-level auditability in the General Ledger.
- **Step 4.5 Service Boundary**: Forensic analysis of `CustomerReceiptService.postCodCashRemittance` and the canonical batch extension design.
- **Explicit 1122 States**: Inclusion of `DELIVERED_PENDING_COLLECTION` as an explicit first-class reconciliation state in the mathematical control equation.
- **Partial Shift Settlement Policy**: Classification of full vs. partial shift settlement as an explicit business decision.

---

## Section A: Account 1121 vs Account 1122 Strict Separation

A cardinal invariant of the CakeToHome double-entry ledger is the absolute separation between Trade Accounts Receivable and COD Collection Control:

1. **Account 1121 ("Accounts Receivable")**:
   - Represents commercial Trade AR from registered customer credit accounts and institutional balances.
   - Cleared exclusively via customer payment transactions (online payment gateways, bank transfers, credit notes, refunds).
   - Governed by debtor ledgers, customer statements, and credit terms.
   - Audited, verified, and frozen in Step 4.8.
2. **Account 1122 ("Undeposited COD")**:
   - Represents **COD Collection Control**.
   - It is an **ASSET** clearing control account. Before delivery, it represents an uncleared COD control balance created by the sales invoicing flow; after collection, it represents physical cash/control in operational custody until branch counter remittance.
   - It is **NOT** Trade AR, NOT customer credit, NOT revenue, NOT rider expense, and NOT rider payable.
   - It is cleared **EXCLUSIVELY** when physical cash is remitted to the branch cash register (`Dr 1111 Cash in Hand / Cr 1122 Undeposited COD`).
   - Accounts 1121 and 1122 are **NEVER** merged, combined, or offset against each other.
3. **AR Aging Blocker**:
   - Step 4.9 does NOT touch Account 1121, does NOT activate AR Aging, and does NOT infer due dates. AR Aging remains strictly feature-blocked (`FEATURE_BLOCKED: AR AGING: NOT AVAILABLE — DUE-DATE POLICY NOT APPROVED`).

---

## Section B: Redefined COD Control State Machine (With Explicit State A.1)

Account 1122 tracks COD funds across five mutually exclusive operational states, cleanly separating delivery from collection and branch remittance:

```
                      ┌────────────────────────────────────────┐
                      │          COD INVOICE POSTED            │
                      │  Dr 1122 Undeposited COD (Gross Total) │
                      │  Cr 4110 / 4120 Sales Revenue          │
                      │  Cr 2121..2129 Output GST              │
                      └───────────────────┬────────────────────┘
                                          │
                                          ▼
                      ┌────────────────────────────────────────┐
                      │   STATE A: PRE-DELIVERY /              │
                      │   UNCOLLECTED COD                      │
                      │   (Invoiced; in kitchen/transit;       │
                      │    customer delivery not completed;    │
                      │    cash not yet received)              │
                      └───────────────────┬────────────────────┘
                                          │
                            Doorstep Delivery Completed
                             (Customer OTP Verification)
                                          │
                                          ▼
                      ┌────────────────────────────────────────┐
                      │   STATE A.1: DELIVERED /               │
                      │   PENDING COLLECTION                   │
                      │   (Goods handed over at doorstep;      │
                      │    cash collection confirmation        │
                      │    pending from rider)                 │
                      └───────────────────┬────────────────────┘
                                          │
                         Explicit Cash Collection Confirmation
                               (Model B Locked Event)
                                          │
                         ┌────────────────┴────────────────┐
                         ▼                                 ▼
          ┌─────────────────────────────┐   ┌─────────────────────────────┐
          │  STATE B: IDENTIFIED RIDER  │   │  STATE C: UNASSIGNED        │
          │  CUSTODY                    │   │  DELIVERED COD              │
          │  (Cash collection confirmed │   │  (Cash collection confirmed │
          │   by assigned rider;        │   │   without assigned rider;   │
          │   snapshot frozen)          │   │   unassigned transit pool)  │
          └──────────────┬──────────────┘   └──────────────┬──────────────┘
                         │                                 │
                         └────────────────┬────────────────┘
                                          │
                             Rider Shift Counter Handover
                              (Teller Cash Verification)
                                          │
                                          ▼
                      ┌────────────────────────────────────────┐
                      │     BRANCH TELLER CASH REMITTANCE      │
                      │  Dr 1111 Cash in Hand (Branch Drawer)  │
                      │  Cr 1122 Undeposited COD (Total Shift) │
                      │  (Voucher: RECEIPT; Step 4.5 Engine)   │
                      └───────────────────┬────────────────────┘
                                          │
                                          ▼
                      ┌────────────────────────────────────────┐
                      │      STATE E: REMITTED / CLEARED       │
                      │  (Order 1122 Net Balance = 0.00;       │
                      │   Funds secured in Branch Register)    │
                      └────────────────────────────────────────┘
```

### Mutually Exclusive State Predicates:
1. **`PRE_DELIVERY_UNCOLLECTED` (State A)**:
   - Order invoiced as COD (`Dr 1122` posted).
   - `delivered_at` IS NULL; delivery OTP not verified.
   - Cash collection not confirmed (`metadata->'cod_custody_event'` IS NULL).
2. **`DELIVERED_PENDING_COLLECTION` (State A.1)**:
   - Delivery OTP verified (`delivered_at` IS NOT NULL; order status = `'delivered'`).
   - Cash collection not confirmed (`metadata->'cod_custody_event'` IS NULL).
   - Goods handed over; rider confirmation of cash receipt pending.
3. **`IDENTIFIED_RIDER_CUSTODY` (State B)**:
   - Cash collection confirmed (`metadata->'cod_custody_event'` IS NOT NULL).
   - `delivery_partner_id` IS NOT NULL.
   - Shift settlement voucher not posted (`metadata->'cod_custody_event'->>'settlement_voucher_id'` IS NULL).
   - Physical cash is in the verified custody of the assigned delivery partner.
4. **`UNASSIGNED_DELIVERED_COD` (State C)**:
   - Cash collection confirmed (`metadata->'cod_custody_event'` IS NOT NULL).
   - `delivery_partner_id` IS NULL.
   - Shift settlement voucher not posted.
   - Physical cash received but unassigned to any delivery partner.
5. **`OTHER_VALID_UNCLEARED_STATES` (State D)**:
   - Delivery exceptions, rejected deliveries, or customer payment disputes awaiting credit note or invoice reversal (`status = 'delivery_exception'` or `status = 'returned'`).
6. **`REMITTED_CLEARED` (State E)**:
   - Shift settlement voucher posted (`settlement_voucher_id` IS NOT NULL) with matching `Cr 1122`.
   - Order net 1122 balance $\equiv 0.00$.

---

## Section C: Authoritative Custody-Event Persistence Analysis

### C.1 The Problem Statement
Under Model B and Option C:
- Delivery and cash collection occur in the field (e.g. 7:00 PM, 7:30 PM).
- Shift settlement occurs later at the branch counter (e.g. 10:00 PM).
- Therefore, the custody event occurs **BEFORE** the settlement voucher exists.
- Where does the immutable custody snapshot live between cash collection and shift settlement?

### C.2 Forensic Schema Evaluation
We forensically inspected the existing PostgreSQL schema:
1. **`public.delivery`**: Columns (`id, transaction_id, delivery_partner_id, delivery_status, delivered_at, delivery_otp`).
   - *Finding*: Has no collection amount column, no collection timestamp, and no JSONB metadata column. Modifying it would require DDL.
2. **`public.payment_transaction`**: Columns (`id, company_id, branch_id, order_id, amount, status, settlement_status, provider, provider_ref`).
   - *Finding*: Has no `delivery_partner_id` column, no collection timestamp, and no JSONB metadata column. Modifying it would require DDL.
3. **`public.order`**: Columns (`id, display_id, customer_id, status, metadata (jsonb), created_at, updated_at`).
   - *Finding*: `metadata` is a native `jsonb` column. It is already the authoritative JSONB store for order attributes in CakeToHome.
4. **`public.order_status_history`**: Columns (`id, order_id, to_status, from_status, actor_type, actor_id, reason, metadata (text), created_at`).
   - *Finding*: Native append-only audit trail table. Every status transition appends an immutable row that is never altered.

### C.3 Authoritative Dual-Persistence Architecture (Zero DDL)
To achieve 100% immutability, auditability, and immediate availability without requiring any schema migrations, the cash-collection event is persisted across two existing structures simultaneously:

1. **Operational Custody State on `public.order.metadata->'cod_custody_event'`**:
   Written atomically under `SELECT ... FOR UPDATE`:
   ```json
   {
     "custody_id": "cust_ord_1001_1727420400000",
     "order_id": "ord_1001",
     "order_display_id": 1001,
     "delivery_partner_id": "dlp_101",
     "partner_name": "Ramesh Kumar",
     "branch_id": "br_indiranagar",
     "collected_amount": 1000.00,
     "custody_status": "IDENTIFIED_RIDER_CUSTODY",
     "collected_at": "2026-09-27T10:30:00.000Z",
     "source_event_id": "del_ord_1001",
     "settlement_voucher_id": null,
     "settled_at": null
   }
   ```
2. **Append-Only Immutable Audit Record in `public.order_status_history`**:
   An immutable row is inserted:
   - `order_id`: `"ord_1001"`
   - `from_status`: `"DELIVERED"`
   - `to_status`: `"COD_CASH_COLLECTED"`
   - `actor_type`: `"DELIVERY_PARTNER"`
   - `actor_id`: `"dlp_101"`
   - `reason`: `"Authoritative doorstep cash collection confirmed"`
   - `metadata`: Serialized JSON snapshot of the custody event.

### C.4 Immutability Guarantee Against Delivery Reassignment
- **The Defense**: The subledger, settlement engine, and GL reconciliation query `order.metadata->'cod_custody_event'->>'delivery_partner_id'`, **NEVER** the mutable `delivery.delivery_partner_id`.
- Even if a dispatcher subsequently reassigns the order in `public.delivery` to Rider B, the financial custody record remains permanently locked to Rider A.
- When the settlement voucher is posted, this frozen snapshot is duplicated into `accounting_voucher.metadata` and `accounting_journal_line.metadata`, establishing three-layer permanent immutability.

---

## Section D: Settlement Line Persistence & Exact Source Linkage

### D.1 The Traceability Requirement
Option C executes a consolidated batch shift settlement:
- Rider A settles ₹4,050 across 4 orders (Order 101: ₹1,000, Order 102: ₹750, Order 103: ₹1,500, Order 104: ₹800).
- The financial voucher is: `Dr 1111 Cash in Hand ₹4,050 / Cr 1122 Undeposited COD ₹4,050`.
- The system must preserve exact order-level source linkage to prove which specific collections were cleared.

### D.2 Compound Balanced Journal Entry Structure
To prevent order-level fragmentation in the branch cash drawer while guaranteeing 1:1 order clearance in the General Ledger, the batch settlement posts a **single compound journal entry**:

1. **Debit Side (Single Cash Drawer Entry)**:
   - **Account 1111 ("Cash in Hand — Indiranagar / Branch Register")**: Debit ₹4,050.00.
   - Narration: `COD shift settlement received from Rider Ramesh Kumar (dlp_101) — Shift shift_20260927_eve`.
   - Represents the physical cash envelope verified and counted by the branch teller.
2. **Credit Side (1:1 Order Clearance Lines)**:
   - **Line 1**: Account 1122 | Credit ₹1,000.00 | Metadata: `{"order_id": "ord_101", "delivery_partner_id": "dlp_101"}`
   - **Line 2**: Account 1122 | Credit ₹750.00 | Metadata: `{"order_id": "ord_102", "delivery_partner_id": "dlp_101"}`
   - **Line 3**: Account 1122 | Credit ₹1,500.00 | Metadata: `{"order_id": "ord_103", "delivery_partner_id": "dlp_101"}`
   - **Line 4**: Account 1122 | Credit ₹800.00 | Metadata: `{"order_id": "ord_104", "delivery_partner_id": "dlp_101"}`
3. **Double-Entry Balance**:
   $$\text{Total Debits} = ₹4,050.00 \equiv \text{Total Credits} = (₹1,000 + ₹750 + ₹1,500 + ₹800) = ₹4,050.00$$

### D.3 Persistence of Settlement Lines
The settlement breakdown is persisted in two authoritative locations:
1. **`accounting_voucher.metadata.settlement_lines`**:
   ```json
   {
     "shift_id": "shift_20260927_eve_dlp101",
     "delivery_partner_id": "dlp_101",
     "partner_name": "Ramesh Kumar",
     "settlement_type": "SHIFT_BATCH_SETTLEMENT",
     "settlement_lines": [
       { "order_id": "ord_101", "settled_amount": 1000.00 },
       { "order_id": "ord_102", "settled_amount": 750.00 },
       { "order_id": "ord_103", "settled_amount": 1500.00 },
       { "order_id": "ord_104", "settled_amount": 800.00 }
     ],
     "total_settlement": 4050.00
   }
   ```
2. **`accounting_journal_line.metadata`**: Each 1122 credit line stores its specific `order_id` and `delivery_partner_id`.
3. **Order State Update**: Each settled order has `metadata->'cod_custody_event'->>'settlement_voucher_id'` stamped with the posted voucher ID.

- **Anti-Arbitrary Allocation Invariant**:
  - The settlement lines must match the authoritative custody records exactly.
  - If $\sum \text{Settlement Lines} \ne \text{Total Remitted Amount}$, the transaction **FAILS CLOSED** (`SETTLEMENT_ALLOCATION_MISMATCH`). Silent FIFO and arbitrary spreading are strictly prohibited.

---

## Section E: Step 4.5 Integration & Service Boundary Extension

### E.1 Forensic Findings on Existing Implementation
We inspected `CustomerReceiptService.postCodCashRemittance` in `frontend/src/lib/services/customer-receipt.service.ts`:
- **Current Signature**: Takes a single `orderId: string` and single `amount: number`.
- **Current Behavior**: Creates a voucher with `reference_type = 'ORDER'`, `reference_id = params.orderId`, and creates a 2-line journal entry (1 debit to 1111, 1 credit to 1122).
- **Finding**: The existing method was designed in Step 4.5 for **single-order remittances**. It cannot natively process a batch shift settlement referencing multiple orders without losing order-level GL traceability.

### E.2 The Smallest Canonical Service Extension
To preserve all Step 4.5 invariants while supporting Option C batch settlements without creating a competing posting engine:
1. **Preserve Single-Order Method**: `CustomerReceiptService.postCodCashRemittance` remains untouched for backward compatibility and single-order operational flows.
2. **Add Canonical Batch Settlement Method**:
   Extend `CustomerReceiptService` with:
   ```ts
   export interface PostCodShiftSettlementParams {
     shiftId: string;
     deliveryPartnerId: string;
     branchId: string;
     settlementLines: Array<{ orderId: string; amount: number }>;
     totalCashReceived: number;
     remittedByStaffId: string; // Cashier / Teller
     approvedBySupervisorId: string; // Cash Drawer Supervisor
     postedByGlAccountantId: string; // GL Accountant
     voucherDate?: string;
     notes?: string;
     supervisorActorContext?: ActorContext;
     accountantActorContext?: ActorContext;
     client?: PoolClient;
   }
   ```
3. **Posting Engine Reuse**:
   - Reuses canonical `PostingService.postVoucherAtomic`.
   - Enforces the established 3-tier SoD matrix (Cashier $\ne$ Supervisor $\ne$ GL Accountant).
   - Validates branch access and permissions (`ACCOUNTING.POST`).
   - Produces the compound balanced journal entry described in Section D.2.
   - Zero duplication of posting rules; clean architectural extension within the established service boundary.

---

## Section F: Partial Shift Settlement Policy — Business Decision Required

Stakeholder directive requires an explicit business decision on whether a rider is permitted to settle a partial amount of their total shift custody:

| Candidate Policy | Policy Definition | Accounting Effect | Audit & Operational Profile |
| :--- | :--- | :--- | :--- |
| **Option A (Partial Shift Settlement Permitted)** | Rider may remit an amount less than total accumulated custody (e.g. ₹8,000 against ₹10,000 custody). | A `RECEIPT` voucher for ₹8,000 is posted. The settled orders are cleared; unsettled orders (₹2,000) remain in `IDENTIFIED_RIDER_CUSTODY`. | • Flexible for riders with cash shortages or operational delays.<br>• Unsettled balance carries over to next shift.<br>• Requires cashier/supervisor to select exactly which orders are being settled.<br>• Risk of unresolved rider cash float. |
| **Option B (Full Shift Settlement Required)** | Rider must remit 100% of accumulated custody for all completed shift deliveries. | Settlement is all-or-nothing. Submitting less than total outstanding custody **FAILS CLOSED** (`PARTIAL_SHIFT_SETTLEMENT_FORBIDDEN`). | • Strict operational control (zero overnight carryover).<br>• If a cash shortage occurs, an official shortage/adjustment voucher must be created first before the rider can settle.<br>• If one order is disputed, entire shift settlement is delayed until resolved. |

*Status: **BUSINESS DECISION REQUIRED — Awaiting user authorization. Neither option is selected automatically.***

---

## Section G: Corrected 1122 ↔ GL Mathematical Reconciliation Model

### G.1 The Complete Control Identity
With `DELIVERED_PENDING_COLLECTION` explicitly modeled, the General Ledger Account 1122 balance must equal the sum of ALL five operational control states at any point in time $t$:

$$\text{GL 1122 Balance}(t) \equiv \sum_{\text{all posted 1122 lines} \le t} (\text{Debit} - \text{Credit})$$

$$\text{Operational Uncleared COD Control}(t) = \text{State A} + \text{State A.1} + \text{State B} + \text{State C} + \text{State D}$$

Where:
- $\text{State A} = \text{Pre-Delivery Uncollected}$
- $\text{State A.1} = \text{Delivered Pending Collection}$
- $\text{State B} = \text{Identified Rider Custody}$
- $\text{State C} = \text{Unassigned Delivered COD}$
- $\text{State D} = \text{Other Valid Uncleared States}$

$$\text{Mathematical Control Invariant}: \quad \text{GL 1122 Balance}(t) - \text{Operational Uncleared COD Control}(t) \equiv 0.00$$

### G.2 Five Canonical Control Questions Answered
1. **How much COD is invoiced but not yet delivered?**
   $$\sum \text{Net 1122 for orders where } \text{State} = \text{PRE\_DELIVERY\_UNCOLLECTED}$$
2. **How much COD is delivered but pending cash collection confirmation?**
   $$\sum \text{Net 1122 for orders where } \text{State} = \text{DELIVERED\_PENDING\_COLLECTION}$$
3. **How much COD is collected and in identified rider custody?**
   $$\sum \text{Net 1122 for orders where } \text{State} = \text{IDENTIFIED\_RIDER\_CUSTODY}$$
4. **How much COD is collected without an authoritative rider assignment?**
   $$\sum \text{Net 1122 for orders where } \text{State} = \text{UNASSIGNED\_DELIVERED\_COD}$$
5. **How much has been remitted to branch cash registers?**
   $$\sum \text{Posted Credits to Account 1122 (Dr 1111 / Cr 1122)}$$

---

## Section H: Historical Prototype Data Quarantine

- **Quarantine Scope**: All 173 historical orders and 53 payment transactions in `public.order` and `public.payment_transaction` remain strictly quarantined under `LEGACY_PROTOTYPE_DATA`.
- **Zero Inference Rule**:
  - The system will NOT infer rider custody, cash collection, remittance, or settlement from historical orders.
  - Step 4.9 queries strictly isolate posted accounting journals created post-`accounting_start_date` (`0` rows currently configured).
  - Historical orders are never treated as uncleared COD or unremitted rider balances.

---

## Section I: Security, RBAC & Multi-Tenant Branch Isolation

- **Permission Matrix**:
  - `ACCOUNTING.VIEW`: Required to view COD registers, rider settlement summaries, and 1122 ↔ GL reconciliation reports.
  - `ACCOUNTING.POST`: Required to execute COD shift settlements (`Dr 1111 / Cr 1122`).
- **Server-Side Branch Isolation**:
  - Branch Managers and store cashiers are strictly scoped to orders, riders, and cash registers matching their authenticated `branch_id`.
  - Company-wide controllers with corporate scope may view cross-branch consolidation.
  - Null branch context is rejected from enterprise access, preventing cross-tenant leakage.

---

## Section J: Database Safety & Baseline Evidence

Prior to submitting this amended Design Gate, the independent baseline verification was executed:
- **Verification Script**: `node scratch/forensic_baseline_step4_5.js`
- **Result**: **18 / 18 PASSED (100% Pristine)**
  1. `accounting_account`: 98
  2. `accounting_voucher`: 0
  3. `accounting_journal_entry`: 0
  4. `accounting_journal_line`: 0
  5. `accounting_fiscal_period`: 0
  6. `purchase`: 0
  7. `purchase_item`: 0
  8. `purchase_payment`: 0
  9. `supplier`: 0
  10. `branch`: 57
  11. `branch_inventory`: 424
  12. `inventory_cost_lot`: 0
  13. `inventory_movement`: 0
  14. `inventory_cost_consumption`: 0
  15. `order`: 173 (quarantined historical data preserved)
  16. `payment_transaction`: 53 (quarantined historical data preserved)
  17. `accounting_start_date`: 0 configured rows
  18. `synthetic accounting rows`: 0
- **TypeScript Compilation**: `npx tsc --noEmit` exited with 0 errors.
- **Git State**: Working tree clean, zero commits, zero pushes.

---

## Section K: Final Boundaries & Status Block

```
STEP 4.9 = FINAL IMPLEMENTATION-READY DESIGN
IMPLEMENTATION = NOT AUTHORIZED
CASH COLLECTION = MODEL B LOCKED
REMITTANCE = OPTION C LOCKED
SETTLEMENT ALLOCATION = EXACT SOURCE-LINKED (LOCKED)
1122 STATES = EXPLICIT AND MUTUALLY EXCLUSIVE (LOCKED)
CUSTODY SNAPSHOT = PERSISTENCE LOCATION VERIFIED (ORDER METADATA + STATUS HISTORY)
SETTLEMENT ALLOCATION STORAGE = VERIFIED (COMPOUND JOURNAL + VOUCHER METADATA)
STEP 4.5 INTEGRATION = VERIFIED (CANONICAL POSTING ENGINE EXTENSION)
PARTIAL SHIFT SETTLEMENT POLICY = BUSINESS DECISION REQUIRED (OPTION A VS B)
STEP 4.10 = NOT STARTED
```

**System halted. Awaiting final user business decision on Partial Shift Settlement Policy (Option A vs Option B) before implementation authorization.**
