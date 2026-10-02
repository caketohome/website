# CHECKPOINT: Phase 5C Step 2 — Cash-on-Delivery (COD) Doorstep Collection & Rider Shift Remittance

**Status**: 🔒 PHASE 5C STEP 2 COMPLETE & VERIFIED  
**Date**: 2026-10-02  
**Branch**: `task/dev`  
**Prior Checkpoint**: `CHECKPOINTS/phase5c-step1-online-order-delivery-accounting-bridge.md`  
**Next Checkpoint**: Next Bounded Phase 5C Priority Execution  

---

## 1. Scope and Objective
In strict accordance with CakeToHome's locked **100% ONLINE-ORDER-ONLY** business model (no walk-in retail, no counter POS, no kitchen recipe/BOM ERP, frozen Phase 5A.6 accounting engine), this substep completes the **Doorstep Cash-on-Delivery (COD) Collection & Delivery Partner Shift Remittance Architecture**:
- Closes the critical operational gap where online orders placed via Cash on Delivery (`payment_method: 'cod'`) were invoiced on doorstep delivery, but cash custody was not confirmed, rider outstanding cash balances were untracked, and cash remittance at the branch failed to post to the General Ledger.
- Connects operational doorstep delivery confirmation directly to `CodCollectionRepository.recordDoorstepCashCollection`.
- Records atomic cash custody event in `order.metadata.cod_custody_event` (`IDENTIFIED_RIDER_CUSTODY`) and appends immutable audit event `COD_CASH_COLLECTED` to `public.order_status_history`.
- Enforces statutory separation of cash custody in the General Ledger:
  - Delivery Sales Voucher Debits **CoA 1122 (Undeposited COD Collections)** instead of Trade Receivables.
  - End-of-Shift Cash Remittance Posts **RECEIPT Voucher (CoA 1111 Cash in Hand / Till Dr, CoA 1122 Undeposited COD Collections Cr)**.
- Implements 3-tier Segregation of Duties (SoD) for shift batch settlements (Remitter / Supervisor Approver / GL Posting Accountant).

---

## 2. Forensic Analysis & Root Cause Remediation

1. **Doorstep Delivery Cash Custody Confirmation**:
   - In `frontend/src/lib/services/delivery-invoicing.service.ts`, when an online order with `payment_method === 'cod'` is delivered with OTP, `DeliveryInvoicingService` now automatically records the cash collection handover to the assigned rider via `CodCollectionRepository.recordDoorstepCashCollection`.
   - Populates `order.metadata.cod_custody_event` with `custody_status: 'IDENTIFIED_RIDER_CUSTODY'`, `collected_amount: invoice.grand_total`, and `delivery_partner_id`.
   - Records an immutable append-only record in `public.order_status_history` (`to_status: 'COD_CASH_COLLECTED'`).
   - Updates `public.order` in PostgreSQL with `status: 'completed'` and `delivery_status: 'delivered'`.

2. **Branch State Resolution Hardening**:
   - In `frontend/src/lib/services/sales-posting.service.ts`, resolved branch state fallback so that branches without explicit `metadata.state` resolve their Indian state from address keywords (e.g. Bengaluru/Karnataka) rather than raw street address strings, ensuring `SalesTaxEngine` accurately determines Place of Supply.

3. **Collection Timestamp Range Bug in Custody Query**:
   - In `frontend/src/lib/repositories/cod-collection.repository.ts` (lines 142-143), the query used strict inequality on date boundaries (`> dateFrom` and `< dateTo`) which accidentally excluded deliveries collected during the query date itself.
   - Fixed to use inclusive date boundaries (`>= dateFrom` and `<= dateTo`).

4. **Branch Delivery Partner Directory API**:
   - In `frontend/src/app/api/v1/[...path]/route.ts`, implemented `GET /api/v1/branch/riders` to provide active delivery partners and their outstanding custody balances to branch managers.

5. **Shift Batch Remittance to General Ledger**:
   - Verified that `CodCollectionService.postRiderShiftSettlement` validates 3-tier SoD and posts a balanced `RECEIPT` voucher:
     - **Debit CoA 1111** (Branch Cash in Hand / Till)
     - **Credit CoA 1122** (Undeposited COD Collections)
   - Stamps `settlement_voucher_id` onto each settled order and clears rider outstanding custody balance.

---

## 3. Automated Verification Results

Two comprehensive automated test suites were executed against live PostgreSQL:

### Suite 1: Delivery Sales Accounting Bridge (`verify-phase5c-delivery-accounting-bridge.ts`)
```
═══════════════════════════════════════════════════════════════
📊 PHASE 5C TEST RESULTS: 40/40 assertions passed (100%)
═══════════════════════════════════════════════════════════════
```

### Suite 2: COD Collection & Rider Shift Remittance (`verify-phase5c-step2-cod-remittance.ts`)
```
═══════════════════════════════════════════════════════════════
📊 PHASE 5C STEP 2 TEST RESULTS: 44/44 assertions passed (100%)
═══════════════════════════════════════════════════════════════
```

### Combined Assertion Score: 84 / 84 Passed (100%)

---

## 4. Database Teardown & Immutability Audit
Both test suites rigorously audited database row counts before execution and after teardown:
- `public.order`: Baseline 173 rows -> Final 173 rows (0 residual mutation)
- `public.invoice`: Baseline 0 rows -> Final 0 rows (0 residual mutation)
- `public.accounting_voucher`: Baseline 0 rows -> Final 0 rows (0 residual mutation)
- `public.accounting_journal_entry`: Baseline 0 rows -> Final 0 rows (0 residual mutation)
- `public.accounting_fiscal_period`: Baseline 0 rows -> Final 0 rows (0 residual mutation)

`npx tsc --noEmit` exited cleanly with code 0 (0 compilation/type errors).
