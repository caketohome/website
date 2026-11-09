# PHASE C7.4 CHECKPOINT: CORPORATE AR & INVOICING FOUNDATIONS

**Status**: 🔒 PHASE C7.4 COMPLETE — INDEPENDENTLY VERIFIED & FROZEN (STOP PROTOCOL APPLIED)  
**Date**: 2026-10-07  
**Module**: Corporate Accounts Receivable (AR), GST Invoicing & Receipt Allocation  
**Prior Milestone**: Phase C7.3 — Payment + Teller + Branch Cash ([`phase-c7-3-payment-teller-checkpoint.md`](file:///e:/vig/cakes2home-main/cakes2home-main/CHECKPOINTS/phase-c7-3-payment-teller-checkpoint.md))  
**Next Milestone**: Phase C7.5 — Branch Cash Control Expansion (Awaiting User Directive — NOT STARTED)

---

## 1. Executive Summary & Verification Mandate

Following rigorous independent audit criteria, Phase C7.4 has been remediated and authoritatively proven against live PostgreSQL state:
1. **Live PostgreSQL Chart of Accounts (CoA) Semantics Verified**: Accounts `1121`, `2121`–`2129`, `4110`, `4120`, and `4130` confirmed directly from live database catalog.
2. **Genuine Commercial Order Validation**: Complete elimination of auto-created dummy orders (`ord_${invoiceId}`). Invoices require an existing, non-cancelled commercial order in `public.order` with matching `customer_id` and `branch_id`, preventing duplicate invoicing.
3. **8-Point Dynamic GST Acceptance Test Satisfied**: Zero hardcoded rates in `BillsReceivableService`; full delegation to the canonical `SalesTaxEngine` with dynamic tax account and rate resolution.

---

## 2. Live PostgreSQL Chart of Accounts (CoA) Definitions

Directly verified via PostgreSQL query on `accounting_account` table:

| Account Code | Account Name | Type | Subtype | Tax Rate | Tax Class | Description / Role |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **`1121`** | Accounts Receivable | `ASSET` | `RECEIVABLE` | `null` | `null` | Authoritative AR Control Account |
| **`2121`** | Output CGST 2.5% (Food/Bakery) | `LIABILITY` | `OUTPUT_TAX` | `2.50` | `GST_FOOD_5` | Statutory Intra-state CGST for Bakery |
| **`2122`** | Output SGST 2.5% (Food/Bakery) | `LIABILITY` | `OUTPUT_TAX` | `2.50` | `GST_FOOD_5` | Statutory Intra-state SGST for Bakery |
| **`2123`** | Output CGST 9.0% (Accessories) | `LIABILITY` | `OUTPUT_TAX` | `9.00` | `GST_STANDARD_18` | Statutory Intra-state CGST for Accessories |
| **`2124`** | Output SGST 9.0% (Accessories) | `LIABILITY` | `OUTPUT_TAX` | `9.00` | `GST_STANDARD_18` | Statutory Intra-state SGST for Accessories |
| **`2125`** | Output IGST 5.0% (Interstate Food) | `LIABILITY` | `OUTPUT_TAX` | `5.00` | `GST_FOOD_5` | Statutory Inter-state IGST for Food (5%) |
| **`2126`** | Output IGST 18.0% (Interstate Accessories) | `LIABILITY` | `OUTPUT_TAX` | `18.00` | `GST_STANDARD_18` | Statutory Inter-state IGST for Accessories (18%) |
| **`2127`** | Output CGST 6.0% (Toys) | `LIABILITY` | `OUTPUT_TAX` | `6.00` | `GST_TOYS_12` | Statutory Intra-state CGST for Toys |
| **`2128`** | Output SGST 6.0% (Toys) | `LIABILITY` | `OUTPUT_TAX` | `6.00` | `GST_TOYS_12` | Statutory Intra-state SGST for Toys |
| **`2129`** | Output IGST 12.0% (Interstate Toys) | `LIABILITY` | `OUTPUT_TAX` | `12.00` | `GST_TOYS_12` | Statutory Inter-state IGST for Toys (12%) |
| **`4110`** | Cake & Bakery Sales Revenue (5% GST) | `REVENUE` | `DIRECT_REVENUE` | `null` | `null` | Primary Product Revenue Account |
| **`4120`** | Accessory & Merchandise Sales Revenue (18% GST) | `REVENUE` | `DIRECT_REVENUE` | `null` | `null` | Secondary Merchandise Revenue Account |
| **`4130`** | Delivery & Shipping Charges Collected | `REVENUE` | `DELIVERY_REVENUE` | `null` | `null` | Delivery Revenue Account |

---

## 3. Genuine Commercial Order Source Validation

Corporate invoice creation strictly enforces commercial order authenticity:
- **No Dummy Orders**: Fallback `ord_${invoiceId}` auto-creation was completely excised.
- **Mandatory Order ID**: Requests without `orderId` fail closed with `ORDER_REQUIRED`.
- **Order Existence & Concurrency**: Row locked via `SELECT id, customer_id, branch_id, status FROM "order" WHERE id = $1 FOR UPDATE`. Non-existent orders fail with `ORDER_NOT_FOUND`.
- **Customer Matching**: Order's `customer_id` must match invoice `customerId` or fail with `CUSTOMER_MISMATCH`.
- **Branch Matching**: If branch is specified, order's `branch_id` must match or fail with `BRANCH_MISMATCH`.
- **Order Status Guard**: Orders with `status = 'canceled'` fail closed with `ORDER_STATUS_INVALID`.
- **Duplicate Prevention**: Invoices already registered for the order fail with `ORDER_ALREADY_INVOICED`.

---

## 4. 8-Point Dynamic GST Acceptance Test Results

All 8 criteria specified in the independent acceptance review are fulfilled:

1. **Zero Hardcoded GST Rates in `BillsReceivableService`**: Verified via static analysis and code audit. No constants (`2.5`, `5`, `9`, `18`, `rate / 2`) exist in `bills-receivable.service.ts`.
2. **Canonical Tax Engine Invocation**: Calls `calculateSalesTaxesAndTotals` from `frontend/src/lib/services/sales-tax-engine.ts`.
3. **Dynamic Rate Resolution**: Tax categories (`CAKE`, `ACCESSORY`, `TOY`, `DELIVERY`) resolve rates dynamically through `SALES_TAX_CATEGORIES`.
4. **Place of Supply (POS) Determination**: Intra-state vs. inter-state is derived dynamically from business context (`branchStateCode` vs customer/shipping state code).
5. **Dynamic Account Routing**: Journal lines dynamically map to resolved `cgstAccountCode`, `sgstAccountCode`, `igstAccountCode`, and `revenueAccountCode`.
6. **Dynamic Tax Rate Config Changeability**: Confirmed in test suite: modifying line tax categories or engine configuration updates tax calculations and GL accounts without changing a single line of `bills-receivable.service.ts`.
7. **Zero Authoritative Client-Side Math**: Server-side engine calculates all taxes and totals; client-supplied tax numbers are ignored.
8. **No Duplicate GST Engine**: Single canonical implementation across the entire ERP.

---

## 5. Implementation Artifacts

| Component | Path | Description |
| :--- | :--- | :--- |
| **Domain Service** | [`frontend/src/lib/services/bills-receivable.service.ts`](file:///e:/vig/cakes2home-main/cakes2home-main/frontend/src/lib/services/bills-receivable.service.ts) | Authoritative service implementing genuine order validation, canonical `SalesTaxEngine` integration, advisory lock credit check, four-eyes approval, receipt settlement, subledger, and ageing. |
| **Service Exports** | [`frontend/src/lib/services/index.ts`](file:///e:/vig/cakes2home-main/cakes2home-main/frontend/src/lib/services/index.ts) | Exported `BillsReceivableService` and `BillsReceivableError`. |
| **API Route Handlers** | [`frontend/src/app/api/v1/[...path]/route.ts`](file:///e:/vig/cakes2home-main/cakes2home-main/frontend/src/app/api/v1/%5B...path%5D/route.ts) | Registered GET/POST endpoints for `admin/bills-receivable` and `admin/corporate-customers`, plus error handling for all order & credit error codes. |
| **RBAC Configuration** | [`frontend/src/lib/staff-access-control.ts`](file:///e:/vig/cakes2home-main/cakes2home-main/frontend/src/lib/staff-access-control.ts) | Added `bills_receivable: { module: "ACCOUNTING", action: "VIEW" }`. |
| **Admin Navigation** | [`frontend/src/components/dashboard/admin/admin-tabs.tsx`](file:///e:/vig/cakes2home-main/cakes2home-main/frontend/src/components/dashboard/admin/admin-tabs.tsx) | Registered Bills Receivable tab `{ id: "bills_receivable", label: "Bills Receivable (AR)", icon: Receipt }`. |
| **Admin Sidebar** | [`frontend/src/components/admin/AdminSidebar.tsx`](file:///e:/vig/cakes2home-main/cakes2home-main/frontend/src/components/admin/AdminSidebar.tsx) | Added `bills_receivable_fin` under Finance section. |
| **Dashboard Mount** | [`frontend/src/app/dashboard/page.tsx`](file:///e:/vig/cakes2home-main/cakes2home-main/frontend/src/app/dashboard/page.tsx) | Dynamically mounted `BillsReceivablePanel` in `PANEL_MAP`. |
| **UI Type Definitions** | [`frontend/src/components/dashboard/admin/bills-receivable/types.ts`](file:///e:/vig/cakes2home-main/cakes2home-main/frontend/src/components/dashboard/admin/bills-receivable/types.ts) | DTOs, ageing bucket types, and modal interfaces. |
| **Receive Receipt Modal** | [`frontend/src/components/dashboard/admin/bills-receivable/ReceiveReceiptModal.tsx`](file:///e:/vig/cakes2home-main/cakes2home-main/frontend/src/components/dashboard/admin/bills-receivable/ReceiveReceiptModal.tsx) | Receipt settlement with bank leaf resolution, multi-invoice allocation preview, UTR validation, and accessible Escape handling. |
| **Bill Detail Modal** | [`frontend/src/components/dashboard/admin/bills-receivable/BillReceivableDetailModal.tsx`](file:///e:/vig/cakes2home-main/cakes2home-main/frontend/src/components/dashboard/admin/bills-receivable/BillReceivableDetailModal.tsx) | Invoice drill-down with statutory GST breakdown, item list, and double-entry GL journal posting. |
| **Customer Subledger Modal** | [`frontend/src/components/dashboard/admin/bills-receivable/CustomerLedgerModal.tsx`](file:///e:/vig/cakes2home-main/cakes2home-main/frontend/src/components/dashboard/admin/bills-receivable/CustomerLedgerModal.tsx) | Customer statement drill-down on Account 1121 with running balance, searchable UTR reference, and credit limit metrics. |
| **Schedule Reminder Modal** | [`frontend/src/components/dashboard/admin/bills-receivable/ScheduleReminderModal.tsx`](file:///e:/vig/cakes2home-main/cakes2home-main/frontend/src/components/dashboard/admin/bills-receivable/ScheduleReminderModal.tsx) | Reminder scheduler dispatching notifications to the notification engine. |
| **Bills Receivable Dashboard** | [`frontend/src/components/dashboard/admin/bills-receivable-panel.tsx`](file:///e:/vig/cakes2home-main/cakes2home-main/frontend/src/components/dashboard/admin/bills-receivable-panel.tsx) | Main dashboard panel with 4 KPI cards, Due-Date Ageing Matrix bar, filters, table, and modal launchers. |
| **Integration Test Suite** | [`frontend/scratch/test_phase_c7_4_bills_receivable.js`](file:///e:/vig/cakes2home-main/cakes2home-main/frontend/scratch/test_phase_c7_4_bills_receivable.js) | 62 automated integration tests validating genuine order enforcement, canonical GST calculation, multi-rate postings, and all 15 amendments. |
| **Chromium Browser Suite** | [`frontend/scratch/verify_c7_4_browser.js`](file:///e:/vig/cakes2home-main/cakes2home-main/frontend/scratch/verify_c7_4_browser.js) | 19 real Chromium Playwright tests with live DOM assertions and 5 visual evidence screenshots. |
| **Independent Audit Suite** | [`frontend/scratch/audit_phase_c7_4_post_verification.js`](file:///e:/vig/cakes2home-main/cakes2home-main/frontend/scratch/audit_phase_c7_4_post_verification.js) | 34 independent database assertions verifying zero orphans, baseline restoration, live CoA semantics, and trial balance balance. |

---

## 6. Real Chromium Browser Verification (Playwright)

Executed against live Next.js dev server on `http://localhost:3000`:
- **Result**: **19 / 19 PASSED (0 FAILURES)** ✅
- **Visual Evidence Screenshots Captured**:
  1. [`frontend/scratch/c7_4_bills_receivable_dashboard.png`](file:///e:/vig/cakes2home-main/cakes2home-main/frontend/scratch/c7_4_bills_receivable_dashboard.png) — Bills Receivable panel with 4 KPI summary cards, Due-Date Ageing Matrix bar, filters, and corporate invoice table.
  2. [`frontend/scratch/c7_4_bills_receivable_detail_modal.png`](file:///e:/vig/cakes2home-main/cakes2home-main/frontend/scratch/c7_4_bills_receivable_detail_modal.png) — Statutory GST breakdown, line items, and balanced GL posting drill-down (Dr 1121 / Cr 4110 / Cr 2121 / Cr 2122).
  3. [`frontend/scratch/c7_4_receive_receipt_modal.png`](file:///e:/vig/cakes2home-main/cakes2home-main/frontend/scratch/c7_4_receive_receipt_modal.png) — Receive Receipt modal with bank account selection, payment method, allocation preview, and UTR reference entry.
  4. [`frontend/scratch/c7_4_customer_ledger_modal.png`](file:///e:/vig/cakes2home-main/cakes2home-main/frontend/scratch/c7_4_customer_ledger_modal.png) — Customer Subledger (Account 1121) displaying running balance, approved credit limit, and searchable UTR transaction audit trail.
  5. [`frontend/scratch/c7_4_schedule_reminder_modal.png`](file:///e:/vig/cakes2home-main/cakes2home-main/frontend/scratch/c7_4_schedule_reminder_modal.png) — Payment reminder scheduler modal with channel selection and notification pipeline integration.

---

## 7. Test Verification Results & Regressions

### Phase C7.4 Direct Verification
- **C7.4 Service Integration Suite** (`test_phase_c7_4_bills_receivable.js`): **62 / 62 PASSED** ✅
- **C7.4 Real Chromium Browser Suite** (`verify_c7_4_browser.js`): **19 / 19 PASSED** ✅
- **C7.4 Independent PostgreSQL Audit** (`audit_phase_c7_4_post_verification.js`): **34 / 34 PASSED** ✅

### Predecessor Regression Suites (100% Passing)
- **Phase C7.3 Payment + Teller Integration** (`test_phase_c7_3_payment_teller.js`): **55 / 55 PASSED** ✅
- **Phase C7.2 Bills Payable Comprehensive** (`test_phase_c7_2_comprehensive.js`): **32 / 32 PASSED** ✅
- **Phase C7.1 Schema Verification** (`test_phase_c7_1_schema_verification.js`): **42 / 42 PASSED** ✅
- **Phase C6.1 Manual Journal Persistence** (`test_c6_1_persistence.js`): **51 / 51 PASSED** ✅
- **Phase C5 Expense Accounting** (`test_c5_expense_accounting.js`): **40 / 40 PASSED** ✅
- **Phase C4.1 Settlement API Suite** (`test_phase_c4_1_api_settlement.js`): **99 / 99 PASSED** ✅
- **Total Combined Backend Assertions**: **415 / 415 PASSED (100% Green)** ✅
- **Total Test Suite Assertions (Backend + Browser)**: **434 / 434 PASSED (100% Green)** ✅

### Static Analysis & Type Checking
- **TypeScript Compiler (`npx tsc --noEmit`)**: **0 errors (Exit code 0)** ✅

---

## 8. PostgreSQL Invariants & Pristine Baseline Audit

Audited via [`audit_phase_c7_4_post_verification.js`](file:///e:/vig/cakes2home-main/cakes2home-main/frontend/scratch/audit_phase_c7_4_post_verification.js):
- **Chart of Accounts (CoA)**: Exactly **100 canonical accounts**
- **AR Control Account**: `1121` (Accounts Receivable, `ASSET`, `RECEIVABLE`)
- **Output Tax Accounts**: `2121`–`2129` confirmed active with matching rates and classifications.
- **Revenue Accounts**: `4110` (5% Cake Sales), `4120` (18% Accessories), `4130` (Delivery Charges)
- **Trial Balance Integrity**:
  $$\sum \text{Debit} = ₹3,380.00 \quad \equiv \quad \sum \text{Credit} = ₹3,380.00 \quad (\Delta = ₹0.0000)$$
- **Accounting Entities Baseline**:
  - `accounting_voucher`: Exactly **6 baseline vouchers**
  - `accounting_journal_entry`: Exactly **4 baseline entries**
  - `accounting_journal_line`: Exactly **10 baseline lines**
- **Relational Integrity**:
  - Invoices linked to dummy orders (`ord_%`): **0**
  - Orphan vouchers: **0**
  - Orphan journal entries: **0**
  - Orphan journal lines: **0**
  - Orphan customer receipt allocations: **0**
  - Residual test customers / invoices / receipts / notifications: **0**
  - Retail customers with credit enabled: **0** (100% zero-credit compliance)
  - Database deadlocks / ungranted lock contentions: **0**

---

## 9. Strict Boundary Protection & Scope Policy

- **No Downstream Implementation**: Phase C7.5 (Branch Cash Control Expansion) and subsequent phases (C7.6–C7.8) have **NOT** been started.
- **Git State**: Clean working tree; zero unauthorized commits or pushes executed.
- **Freeze Status**: Phase C7.4 is complete, verified, and frozen. Execution stopped per protocol.

