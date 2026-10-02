# CHECKPOINT: Phase 5C Step 1 — Online Order Delivery Sales Accounting Bridge

**Status**: 🔒 PHASE 5C STEP 1 COMPLETE & VERIFIED  
**Date**: 2026-10-02  
**Branch**: `task/dev`  
**Prior Checkpoint**: `CHECKPOINTS/phase5b-step3-online-order-delivery-billing-implementation.md`  
**Next Checkpoint**: Next Bounded Phase 5C Priority Execution

---

## 1. Scope and Objective
In accordance with CakeToHome's locked **100% ONLINE-ORDER-ONLY** business model (no walk-in retail, no counter POS, no kitchen recipe/BOM ERP, frozen Phase 5A.6 accounting engine), this substep completes the **Online Order Delivery Sales Accounting Bridge**:
- Closes the critical enterprise gap where delivered online orders generated statutory bills (`CTH/26-27/XXXXXX`) via Phase 5B.3's `DeliveryInvoicingService`, but did NOT route to the General Ledger or Central Accounting Work Queue.
- Bridges operational delivery completion directly to canonical `SalesPostingService.createSalesVoucherDraft`.
- Establishes Segregation of Duties (SoD): The delivery service creates a balanced `DRAFT` voucher (`voucher_type: 'SALES'`, `status: 'DRAFT'`, `created_by: 'system:delivery_invoicing'`), awaiting review, approval, and posting by accounting personnel.
- Integrates the sales vouchers stream into the Central Accounting Work Queue (`work-queue/summary` and `work-queue/sales`).

---

## 2. Forensic Analysis & Root Cause Remediation

1. **`is_ledger_eligible` Flagging**:
   - `SalesPostingService.inspectAndBuildJournalLines` strictly fails closed with `LEGACY_PROTOTYPE_ORDER_REJECTED` if `order.metadata.is_ledger_eligible !== true`.
   - Previously placed orders had `is_ledger_eligible: 0` or undefined.
   - Updated `api-engine.ts` (line 23690) so certified online orders placed at checkout explicitly include `is_ledger_eligible: true`.
   - Updated `db-persistence.ts` (`persistOrderToDb`) to preserve `is_ledger_eligible`, `invoice_number`, `invoice_id`, and `accounting_voucher_id` in metadata JSON.

2. **Delivery Address & Place of Supply (POS) Resolution**:
   - In `sales-posting.service.ts`, when `delivery_address` was passed as a multi-word address string (e.g. `"Apartment 101, Indiranagar, Bengaluru 560038"`), string checking previously overrode the state, causing `SalesTaxEngine` to throw `CUSTOMER_STATE_UNRESOLVED`.
   - Hardened `sales-posting.service.ts` (lines 316-325) to resolve customer delivery state from `deliveryAddress.state`, `orderMeta.delivery_state`, `orderMeta.state`, or fallback to `branchState` (Place of Supply for local intra-state sales).

3. **Online Payment Classification**:
   - In `sales-posting.service.ts`, `payment_method: 'online_upi'` was failing closed as unrecognized (`UNRESOLVED_PAYMENT_CLASSIFICATION`).
   - Hardened payment classification (line 513) to classify `online_upi`, `online_card`, `online_netbanking`, `razorpay`, `upi`, `stripe`, and `online*` as `PREPAID` posting to Accounts Receivable (CoA `1121`).

4. **Statutory Delivery Invoicing Bridge**:
   - In `delivery-invoicing.service.ts`, upon successful allocation of statutory invoice and database persistence to `public.invoice`, `DeliveryInvoicingService` calls `SalesPostingService.createSalesVoucherDraft({ orderId, branchId, createdBy: "system:delivery_invoicing" })`.
   - Stamped `accounting_voucher_id` onto the order and invoice metadata in both in-memory store and PostgreSQL.
   - Wrapped in a non-blocking error guard to guarantee that operational doorstep handoff is never blocked if accounting drafting encounters an edge case.

5. **Central Accounting Work Queue Integration**:
   - Extended `frontend/src/lib/data/accounting-work-queue.ts` with `pending_sales: { count: number; total: number }` in `WorkQueueSummary`, `SalesQueueItem` interface, and `fetchSalesQueueItems` query helper.
   - Extended `frontend/src/app/api/v1/[...path]/route.ts`:
     - Added `pending_sales` live counts and totals to `/api/v1/accounting/work-queue/summary`.
     - Added `/api/v1/accounting/work-queue/sales` endpoint returning pending sales vouchers for delivered orders with customer name and invoice number.
   - Updated `frontend/src/components/dashboard/admin/accounting-work-queue-panel.tsx` to add the "Sales Vouchers" stream tab to Central Accounting Work Queue.

---

## 3. Automated Verification Results

A dedicated automated test suite was constructed and executed: `frontend/scripts/verify-phase5c-delivery-accounting-bridge.ts`.

### Test Suite Execution Output
```
══════════════════════════════════════════════════════════════════════════════
🧪 PHASE 5C: ONLINE ORDER DELIVERY SALES ACCOUNTING BRIDGE VERIFICATION
══════════════════════════════════════════════════════════════════════════════

--- 0. Database Baseline Check ---
Initial DB Rows — Orders: 173, Invoices: 0, Accounting Vouchers: 0
Using Authoritative Product from DB: prod_01KXYMAJKNWZCFXJHESPTZE01G (Classic Chocolate Truffle Cake, type: CAKE)

--- 1. Certified Online Order Creation ---
✅ [PASS] Order created with invoice_number === null (Order ≠ Bill)
✅ [PASS] Order created with metadata.is_ledger_eligible === true
✅ [PASS] Order persisted to PostgreSQL public.order
✅ [PASS] PostgreSQL preserves metadata.is_ledger_eligible = true

--- 2. Order Progression to OUT_FOR_DELIVERY ---
✅ [PASS] No invoice exists in public.invoice while out_for_delivery
✅ [PASS] No accounting voucher exists while out_for_delivery

--- 3. Delivery Confirmation & Statutory Invoicing ---
[DeliveryInvoicingService] Sales voucher draft VCH-SALES-FY2026-27-20261002-NJA1N3 (vch_00MUQHNJNKMHGF4X) created for Order CTH-5C-1790916850602
✅ [PASS] generateInvoiceOnDelivery returned success: true
✅ [PASS] Statutory invoice number generated: CTH/26-27/000009
✅ [PASS] Invoice number conforms to statutory format CTH/YY-YY/XXXXXX
✅ [PASS] Accounting voucher draft created: vch_00MUQHNJNKMHGF4X
✅ [PASS] Memory store order status is now 'delivered'
✅ [PASS] Memory store order has statutory invoice_number assigned
✅ [PASS] Memory store order has accounting_voucher_id linked

--- 4. PostgreSQL Invoice Table Verification ---
✅ [PASS] Exactly 1 invoice row exists in public.invoice
✅ [PASS] public.invoice invoice_number matches statutory series
✅ [PASS] public.invoice grand_total matches order total (₹892.50)

--- 5. PostgreSQL Accounting Voucher & Double-Entry Balance ---
✅ [PASS] Accounting voucher row exists in public.accounting_voucher
✅ [PASS] voucher_type is strictly 'SALES'
✅ [PASS] voucher status is strictly 'DRAFT' (SoD unposted)
✅ [PASS] reference_id matches delivered orderId
✅ [PASS] reference_type is SALE/ORDER
✅ [PASS] created_by is 'system:delivery_invoicing'
✅ [PASS] voucher total_amount matches invoice total (₹892.50)
✅ [PASS] Voucher has 4 proposed journal lines (AR + Revenue + GST)
✅ [PASS] Double-entry invariant: sum(Debits) === sum(Credits) (Dr ₹892.50 === Cr ₹892.50)
✅ [PASS] Double-entry total matches invoice total ₹892.50
✅ [PASS] Debit line posts to Accounts Receivable / COD Control (Account: 1121)

--- 6. Idempotency Verification ---
✅ [PASS] Repeated delivery call returns success: true
✅ [PASS] Repeated call returns identical invoice_number
✅ [PASS] Repeated call returns identical accounting_voucher_id
✅ [PASS] public.invoice count remains strictly 1 (no duplicate billing)
✅ [PASS] public.accounting_voucher count remains strictly 1 (idempotency preserved)

--- 7. Central Accounting Work Queue API Verification ---
✅ [PASS] Work Queue summary detects pending sales vouchers: count = 1
✅ [PASS] Work Queue summary detects pending sales total: ₹892.50
✅ [PASS] Work Queue query returns the delivered order's draft sales voucher
✅ [PASS] Work Queue item includes customer name
✅ [PASS] Work Queue item includes statutory bill number

--- 8. Pristine Database Teardown & Audit ---
✅ [PASS] Final orders count (173) matches baseline (173)
✅ [PASS] Final invoices count (0) matches baseline (0)
✅ [PASS] Final vouchers count (0) matches baseline (0)

═══════════════════════════════════════════════════════════════
📊 PHASE 5C TEST RESULTS: 40/40 assertions passed (100%)
═══════════════════════════════════════════════════════════════
```

---

## 4. Code & Build Health Verification
- **TypeScript Static Compilation (`npx tsc --noEmit`)**: Clean exit code `0`, **0 errors**.
- **PostgreSQL Database Mutation Audit**: **0 residual rows mutated** (Baseline `order: 173`, `invoice: 0`, `accounting_voucher: 0` perfectly preserved).
- **Frozen Phase 5A.6 Accounting Engine**: 100% Intact & Untouched.
