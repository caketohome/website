# Phase 4F Step 3D.7-B Design Lock — AP Subledger, Aging & Report Reconciliation

**Document Version**: 1.0.0  
**Status**: DESIGN LOCK — FROZEN SPECIFICATION BEFORE IMPLEMENTATION  
**Date**: 2026-09-25  
**Author**: Antigravity  
**Authoritative Recovery Point**: `CHECKPOINTS/phase4f-step3d7a-payment-reversal-01.md`  
**Git Working Tree**: Clean, 0 staged files, 0 commits, 0 pushes  

---

## 1. Executive Summary & Purpose

Following the verified gate freeze of **Phase 4F Step 3D.7-A (Supplier Payment Reversal / Void & Check Bounce Workflow)**, the transactional financial lifecycle of purchase requisitions, posting, payments, returns, and reversals is completely closed:

```
[ POSTED Purchase Invoice (3D.4) ]  ──► Cr 2111 AP
          │
          ├── [ Physical Purchase Return / Debit Note (3D.6-A) ] ──► Dr 2111 AP
          ├── [ Full Invoice Reversal / Void (3D.6-B) ]          ──► Dr 2111 AP
          ├── [ Supplier Payment Disbursement (3D.5) ]          ──► Dr 2111 AP
          └── [ Supplier Payment Reversal / Void (3D.7-A) ]      ──► Cr 2111 AP
```

However, as identified in the forensic gate audit:
1. **Reporting Gap**: The operational bill-wise and supplier-wise summaries in `purchase.repository.ts` calculate balances as `total - sum(purchase_payment.amount)`. They ignore **Supplier Debit Notes** (Step 3D.6-A) and **Voided Invoices** (Step 3D.6-B).
2. **Subledger Gap**: CakeToHome lacks an authoritative **Supplier Statement of Account** (chronological running-balance subledger for GL Control Account 2111).
3. **Aging Gap**: CakeToHome lacks an **AP Aging Schedule** (Current, 1–30, 31–60, 61–90, 90+ days overdue) reconciling operational payables against GL Account 2111.
4. **Reconciliation Gap**: Finance lacks an automated check proving that operational accounts payable across all suppliers equals the General Ledger balance of Control Account 2111.

**Purpose of Step 3D.7-B**:  
Close the Accounts Payable reporting and subledger cycle by delivering:
- An authoritative **2111 AP Subledger / Supplier Statement of Account** with exact chronological running balances.
- An **AP Aging Schedule** allocating outstanding payables into standard aging brackets.
- Reconciliation and alignment of existing operational purchase reports (`getBillWiseSummary`, `getSupplierWiseSummary`).
- An authoritative **AP ↔ GL Reconciliation Engine** establishing mathematical identity between operational payables and General Ledger Account 2111.

---

## 2. Core Accounting Principles & Formulae

### 2.1. Account 2111 (Accounts Payable Control Account)
- **Account Code**: `2111`
- **Classification**: Current Liability (`LIABILITY`)
- **Normal Balance**: **Credit** (positive balance indicates CakeToHome owes the supplier).
- **Subledger Dimensionality**: Every journal line targeting Account 2111 carries `supplier_id` and `branch_id`.

### 2.2. Transactional Net Effect on AP Balance
| Transaction Type | Voucher Type | Reference Event | GL Impact on 2111 | Effect on AP Balance |
| :--- | :--- | :--- | :---: | :---: |
| **Purchase Invoice Posting (3D.4)** | `PURCHASE` | `INVOICE_POSTED` | **Credit** | **+ Increases Liability** |
| **Supplier Payment Disbursement (3D.5)** | `PAYMENT` | `SUPPLIER_DISBURSEMENT` | **Debit** | **- Decreases Liability** |
| **Physical Purchase Return (3D.6-A)** | `DEBIT_NOTE` | `PURCHASE_RETURN` | **Debit** | **- Decreases Liability** |
| **Full Purchase Invoice Reversal (3D.6-B)** | `JOURNAL` | `INVOICE_REVERSAL` | **Debit** | **- Unwinds Liability (to 0)** |
| **Supplier Payment Reversal (3D.7-A)** | `JOURNAL` | `PAYMENT_REVERSAL` | **Credit** | **+ Restores Liability** |

### 2.3. Mathematical Invariants
1. **Running Balance on Supplier Statement**:
   $$\text{Opening Balance} = \sum_{\text{entry\_date} < \text{start\_date}}(\text{Credits on 2111}) - \sum_{\text{entry\_date} < \text{start\_date}}(\text{Debits on 2111})$$
   $$\text{Running Balance}_i = \text{Running Balance}_{i-1} + \text{Credit}_i - \text{Debit}_i$$
   $$\text{Closing Balance} = \text{Opening Balance} + \sum_{\text{period}}\text{Credit} - \sum_{\text{period}}\text{Debit}$$

2. **Bill-Wise Balance Due**:
   For any purchase invoice $P$:
   $$\text{Paid}(P) = \sum_{\substack{\text{purchase\_payment} \\ \text{deleted\_at IS NULL}}}(\text{amount})$$
   $$\text{DebitNotes}(P) = \sum_{\substack{\text{accounting\_voucher.reference\_type = 'PURCHASE\_RETURN'} \\ \text{status = 'POSTED', deleted\_at IS NULL}}}(\text{total\_amount})$$
   $$\text{Balance Due}(P) = \begin{cases} 0.00 & \text{if } P.\text{status} = \text{'CANCELLED'} \\ \max(0, P.\text{total} - \text{Paid}(P) - \text{DebitNotes}(P)) & \text{otherwise} \end{cases}$$

3. **AP ↔ GL Identity**:
   For any supplier $S$ and globally across all suppliers:
   $$\sum_{P \in \text{Bills}(S)} \text{Balance Due}(P) \equiv \sum_{L \in \text{Lines}(2111, S)} (\text{Credit}(L) - \text{Debit}(L))$$
   $$\text{Discrepancy} = \text{Operational Total AP} - \text{GL 2111 Closing Balance} \equiv 0.00$$

---

## 3. Detailed Component Architecture

### 3.1. DTO Definitions (`frontend/src/lib/types/accounts-payable.types.ts`)
1. **`SupplierStatementFilters`**:
   - `supplier_id: string` (required)
   - `branch_id?: string` (optional branch scope)
   - `startDate?: string` (YYYY-MM-DD)
   - `endDate?: string` (YYYY-MM-DD)
2. **`SupplierStatementLine`**:
   - `line_id: string`, `entry_date: string`, `entry_no: string`
   - `voucher_id: string`, `voucher_no: string`, `voucher_type: string`
   - `reference_type: string`, `reference_id: string | null`
   - `narration: string`
   - `debit_amount: number`, `credit_amount: number`, `running_balance: number`
3. **`SupplierStatementResult`**:
   - `supplier: { id: string, name: string, gstin: string | null, state: string | null }`
   - `branch_id?: string`, `startDate?: string`, `endDate?: string`
   - `opening_balance: number`, `total_debit: number`, `total_credit: number`, `closing_balance: number`
   - `transactions: SupplierStatementLine[]`
4. **`ApAgingFilters`**:
   - `as_of_date?: string` (defaults to current date)
   - `branch_id?: string`
   - `supplier_id?: string`
5. **`SupplierApAgingRow`**:
   - `supplier_id: string`, `supplier_name: string`
   - `current_amount: number` ($\le 0$ days past due / not yet due)
   - `days_1_30: number` (1 to 30 days overdue)
   - `days_31_60: number` (31 to 60 days overdue)
   - `days_61_90: number` (61 to 90 days overdue)
   - `days_90_plus: number` ($> 90$ days overdue)
   - `total_outstanding: number`
   - `bill_count: number`
6. **`ApAgingScheduleResult`**:
   - `as_of_date: string`, `branch_id?: string`
   - `summary: { total_current: number, total_1_30: number, total_31_60: number, total_61_90: number, total_90_plus: number, grand_total: number }`
   - `suppliers: SupplierApAgingRow[]`
7. **`ApGlReconciliationResult`**:
   - `as_of_date: string`
   - `operational_ap_total: number`
   - `gl_2111_balance: number`
   - `discrepancy: number`
   - `is_reconciled: boolean` (discrepancy === 0)
   - `supplier_variances: Array<{ supplier_id: string, supplier_name: string, operational_balance: number, gl_balance: number, variance: number }>`

### 3.2. Service Architecture (`frontend/src/lib/services/accounts-payable.service.ts`)
- `AccountsPayableService.getSupplierStatement(filters, client?)`:
  - Fetches supplier master details.
  - Queries opening balance on Account 2111 before `startDate`.
  - Queries all journal lines on Account 2111 for `supplier_id` in date range.
  - Computes exact running balance.
- `AccountsPayableService.getApAgingSchedule(filters, client?)`:
  - Queries active purchases with lateral subqueries for active payments and debit notes.
  - Excludes `CANCELLED` purchases.
  - Computes age based on `as_of_date - due_date` (or `invoice_date`).
  - Distributes outstanding amounts into standard aging buckets.
- `AccountsPayableService.getApGlReconciliation(filters, client?)`:
  - Computes operational balance per supplier.
  - Computes GL 2111 balance per supplier.
  - Asserts variance $\equiv 0.00$ for all suppliers.

### 3.3. Operational Report Reconciliation (`frontend/src/lib/repositories/purchase.repository.ts`)
- Update `getBillWiseSummary`:
  - Add lateral join for debit notes:
    ```sql
    LEFT JOIN LATERAL (
      SELECT COALESCE(SUM(total_amount), 0) AS total_returns
      FROM public.accounting_voucher
      WHERE reference_type = 'PURCHASE_RETURN'
        AND metadata->>'purchase_id' = p.id
        AND status = 'POSTED'
        AND deleted_at IS NULL
    ) dn ON TRUE
    ```
  - Recompute `balance_due`:
    ```sql
    CASE
      WHEN p.status = 'CANCELLED' THEN 0.00
      ELSE GREATEST(0, p.total - COALESCE(pp.total_paid, 0) - COALESCE(dn.total_returns, 0))
    END AS balance_due
    ```
- Update `getSupplierWiseSummary`:
  - Deduct debit notes and exclude cancelled purchases from pending amounts.

---

## 4. Test Suite Specification (`scratch/test_step3d7b_ap_subledger.js`)

The test suite will contain 9 exhaustive sections executed inside an isolated ROLLBACK transaction:
1. **[0/9] Pre-test PostgreSQL Baseline Verification**: All tables verified at clean baseline.
2. **[1/9] Test Harness Setup**: Two suppliers, branch, accessories, staff roles with permissions inside rollback transaction.
3. **[2/9] Transactional Scenario Execution Across All AP Lifecycles**:
   - Bill 1 (₹6,000): Partial payment ₹2,500 (balance ₹3,500).
   - Bill 2 (₹4,000): Physical return / debit note of ₹1,000 (balance ₹3,000).
   - Bill 3 (₹2,000): Paid in full ₹2,000, then payment reversed via 3D.7-A (balance restored to ₹2,000).
   - Bill 4 (₹3,000): Full invoice reversal / void via 3D.6-B (balance becomes ₹0.00).
   - Supplier 2 Bill 1 (₹5,000): Distinct supplier isolation.
4. **[3/9] Supplier Statement of Account & 2111 Running Balance**:
   - Chronological sequencing of all 5 transaction types.
   - Exact running balance verification line-by-line.
   - Date range filtering and opening balance computation.
5. **[4/9] AP Aging Schedule Verification**:
   - Invoices aging into distinct buckets (Current, 1–30, 31–60, 61–90, 90+ days).
   - Verification that debit notes reduce aging balance.
   - Verification that payment reversal restores aging balance.
   - Verification that voided invoices are excluded from aging.
6. **[5/9] Operational Report Reconciliation**:
   - `getBillWiseSummary` reflects debit notes and zero for voided invoices.
   - `getSupplierWiseSummary` matches operational balances.
7. **[6/9] AP ↔ GL Mathematical Identity & Zero Variance**:
   - `AccountsPayableService.getApGlReconciliation` returns `is_reconciled === true`.
   - `discrepancy === 0.00`.
   - Every individual supplier variance === 0.00.
8. **[7/9] Multi-Branch Isolation & Edge Cases**:
   - Branch filter isolates subledger and aging to specific branch.
   - Empty supplier returns zero balances without errors.
9. **[8/9] Full Rollback Audit**:
   - Post-test database returned to pristine baseline (0 vouchers, 0 journals, 424 inventory, 173 orders, 53 payments).

---

## 5. Mandatory Verification & Freeze Protocol

Implementation will strictly follow:
1. Create `accounts-payable.types.ts`.
2. Update `purchase.types.ts` with enriched fields.
3. Update `purchase.repository.ts` with debit note lateral join and status logic.
4. Create `accounts-payable.service.ts`.
5. Export from `services/index.ts`.
6. Run `tsc --noEmit` (0 errors).
7. Execute `test_step3d7b_ap_subledger.js`.
8. Execute entire regression suite (3D.7-A, 3D.6-B, 3D.6-A, 3D.5, 3D.4, 3D.3, 3D.2, 3D.1, Security, DB baseline).
9. Create `CHECKPOINTS/phase4f-step3d7b-ap-subledger-01.md`.
10. Update `LATEST_CHECKPOINT.md` and STOP.
