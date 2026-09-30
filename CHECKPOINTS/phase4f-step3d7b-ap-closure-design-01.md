# Phase 4F Step 3D.7-B Forensic & Design Gate — AP Subledger, AP Aging & Report Reconciliation

**Document Version**: 1.0.0  
**Status**: DESIGN GATE & FORENSIC AUDIT — FROZEN BEFORE IMPLEMENTATION  
**Date**: 2026-09-26  
**Author**: Antigravity  
**Authoritative Recovery Point**: `CHECKPOINTS/phase4f-step3d7a-payment-reversal-01.md`  
**Git Working Tree**: Clean, 0 staged files, 0 commits, 0 pushes  

---

## 1. Executive Summary

Phase 4F Step 3D.7-B represents the final milestone of the Accounts Payable (AP) lifecycle within Phase 4F. Following the complete verification and freezing of **Phase 4F Step 3D.7-A (Supplier Payment Reversal / Void & Check Bounce Workflow)**, the transactional foundation of supplier operations is fully established:

```
[ POSTED Purchase Invoice (3D.4) ] ──────────► Cr 2111 AP (Increases AP Liability)
          │
          ├── [ Supplier Payment Disbursement (3D.5) ] ──► Dr 2111 AP (Decreases AP Liability)
          ├── [ Physical Purchase Return (3D.6-A) ]   ──► Dr 2111 AP (Decreases AP Liability)
          ├── [ Full Invoice Reversal / Void (3D.6-B) ] ─► Dr 2111 AP (Unwinds AP Liability to 0)
          └── [ Supplier Payment Reversal (3D.7-A) ]   ──► Cr 2111 AP (Restores AP Liability)
```

However, transactional capability alone does not satisfy ERP auditability. Financial management requires an authoritative reporting and reconciliation layer:
1. **AP Subledger (Supplier Statement of Account)**: An authoritative, chronological statement derived directly from General Ledger Control Account 2111, calculating exact opening balances, debit/credit entries with source document linkages, and running balances.
2. **AP Aging Schedule**: Allocation of outstanding supplier liabilities into standard aging buckets (`CURRENT`, `DAYS_1_30`, `DAYS_31_60`, `DAYS_61_90`, `DAYS_90_PLUS`), accounting for partial payments, debit notes, voided invoices, and payment reversals.
3. **Operational Report Alignment**: Alignment of operational purchase summaries (`getBillWiseSummary`, `getSupplierWiseSummary`) with debit note deductions and void status.
4. **AP ↔ GL Reconciliation**: Mathematical verification that the sum of all operational bill balances equals the net credit balance of General Ledger Control Account 2111, with explicit discrepancy detection ($\text{variance} \equiv 0.00$).

This document constitutes the formal forensic and architectural design gate for Step 3D.7-B. It establishes live database evidence, maps authoritative data sources, details date and aging semantics, proves branch isolation and RBAC compliance, and sets the bounded implementation boundaries prior to execution.

---

## 2. Current Recovery Point

The verified restart point for CakeToHome ERP is:

- **Authoritative Checkpoint**: `CHECKPOINTS/phase4f-step3d7a-payment-reversal-01.md`
- **Latest Checkpoint Indexes**:
  - `CHECKPOINTS/LATEST_CHECKPOINT.md`
  - `frontend/LATEST_CHECKPOINT.md`
- **Frozen Predecessors (Immutable — Zero Modifications)**:
  - **3D.4**: Atomic Purchase Financial & Inventory Posting (`CHECKPOINTS/phase4f-step3d4-atomic-posting-01.md`)
  - **3D.5**: Purchase Payments & AP Settlement (`CHECKPOINTS/phase4f-step3d5-purchase-payment-01.md`)
  - **3D.6-A**: Purchase Return & Supplier Debit Note (`CHECKPOINTS/phase4f-step3d6a-purchase-return-01.md`)
  - **3D.6-B**: Full Posted Purchase Invoice Reversal (`CHECKPOINTS/phase4f-step3d6b-purchase-reversal-01.md`)
  - **3D.7-A**: Supplier Payment Reversal / Void (`CHECKPOINTS/phase4f-step3d7a-payment-reversal-01.md`)
- **Git Context**:
  - Branch: `task/dev`
  - HEAD: `f7d9a47073d64b0da305cc537a6eccb45938fd1b`
  - Staged changes: 0 files
  - Commits made during this gate: 0

---

## 3. Live PostgreSQL Baseline

An independent, read-only inspection was executed directly against the live PostgreSQL database (`scratch/forensic_baseline_3d7b.js`) to establish the baseline:

| Table | Live Count | Baseline Invariant | Verification Status |
| :--- | :---: | :---: | :---: |
| `public.accounting_account` | **98** | 24 Groups, 74 Leaves (CoA Master Data) | ✅ VERIFIED |
| `public.accounting_voucher` | **0** | Clean baseline post-rollback | ✅ VERIFIED |
| `public.accounting_journal_entry` | **0** | Clean baseline post-rollback | ✅ VERIFIED |
| `public.accounting_journal_line` | **0** | Clean baseline post-rollback | ✅ VERIFIED |
| `public.accounting_fiscal_period` | **0** | Clean baseline (posting fails closed) | ✅ VERIFIED |
| `public.purchase` | **0** | Clean baseline post-rollback | ✅ VERIFIED |
| `public.purchase_item` | **0** | Clean baseline post-rollback | ✅ VERIFIED |
| `public.purchase_payment` | **0** | Clean baseline post-rollback | ✅ VERIFIED |
| `public.supplier` | **0** | Clean baseline post-rollback | ✅ VERIFIED |
| `public.branch` | **57** | Production Hubs & Stores | ✅ PRESERVED |
| `public.branch_inventory` | **424** | Physical accessory inventory rows | ✅ PRESERVED |
| `public.inventory_cost_lot` | **0** | Clean baseline post-rollback | ✅ VERIFIED |
| `public.inventory_movement` | **0** | Clean baseline post-rollback | ✅ VERIFIED |
| `public.inventory_cost_consumption` | **0** | Clean baseline post-rollback | ✅ VERIFIED |
| `public.order` | **173** | Historical customer orders | ✅ 100% UNTOUCHED |
| `public.payment_transaction` | **53** | Historical customer payments | ✅ 100% UNTOUCHED |
| `public.setting` (`accounting_start_date`) | **0 rows** | UNCONFIGURED (posting fails closed) | ✅ FAIL-CLOSED |

### Key Control Account Verification
Control Account 2111 was independently verified in `public.accounting_account`:
- **ID**: `22feb699-d65a-486a-bee0-3b060d7c0c46`
- **Code**: `2111`
- **Name**: `Accounts Payable`
- **Type**: `LIABILITY`
- **Normal Balance**: **Credit**
- **Is Group**: `false` (Leaf Posting Account)
- **Parent ID**: `7500ac22-cb02-48cc-889b-2aafab7eedb8` (Current Liabilities group)

---

## 4. Existing AP Transaction Architecture

The transactional AP workflows built in Steps 3D.4 through 3D.7-A establish the following rules:

1. **Step 3D.4 — Purchase Invoice Posting**:
   - `purchase.status` transitions from `APPROVED` to `POSTED`.
   - Accounting voucher created (`voucher_type = 'PURCHASE'`, `reference_type = 'PURCHASE'`, `reference_event = 'INVOICE_POSTED'`).
   - Journal lines:
     - Dr 1131 / 1132 / 1133 (Merchandise Inventory - Accessories, Cakes, Packaging)
     - Dr 1141–1149 (Input GST Accounts - CGST, SGST, IGST)
     - Dr 5240 (Freight & Cartage Inward, if applicable)
     - **Cr 2111 (Accounts Payable Control Account)** carrying `supplier_id` and `branch_id`.
   - Inventory: 1:1 `inventory_cost_lot` created with `remaining_quantity = received_quantity`; physical stock incremented in `branch_inventory.quantity`; `inventory_movement` recorded.

2. **Step 3D.5 — Supplier Payment Disbursement**:
   - Authorized disbursement against a `POSTED` purchase invoice.
   - Row-locking via `SELECT ... FOR UPDATE` on `purchase` and `purchase_payment`.
   - Inserts `purchase_payment` record.
   - Accounting voucher created (`voucher_type = 'PAYMENT'`, `reference_type = 'PURCHASE_PAYMENT'`, `reference_event = 'SUPPLIER_DISBURSEMENT'`).
   - Journal lines:
     - **Dr 2111 (Accounts Payable)** carrying `supplier_id` and `branch_id`.
     - Cr 1111 (Cash in Hand) or 1112 (Bank Operating A/c).
   - Zero inventory or cost-lot mutations.

3. **Step 3D.6-A — Purchase Return & Supplier Debit Note**:
   - Physical return of goods against a `POSTED` purchase invoice.
   - Decrements `inventory_cost_lot.remaining_quantity` and `branch_inventory.quantity`.
   - Inserts `inventory_movement` (`movement_type = 'PURCHASE_RETURN'`, `direction = 'OUT'`).
   - Accounting voucher created (`voucher_type = 'DEBIT_NOTE'`, `reference_type = 'PURCHASE_RETURN'`, `reference_event = 'SUPPLIER_DEBIT_NOTE'`, `metadata->>'purchase_id' = purchase.id`).
   - Journal lines:
     - **Dr 2111 (Accounts Payable)** carrying `supplier_id` and `branch_id`.
     - Cr 1131 / 1132 / 1133 (Merchandise Inventory).
     - Cr 1141–1149 (Input GST Reversal).

4. **Step 3D.6-B — Full Purchase Invoice Reversal / Void**:
   - Reversal of an erroneous `POSTED` purchase invoice.
   - Enforces Zero Payments Guard (must have 0 active payments) and 100% unconsumed lot check.
   - Sets `purchase.metadata->>'is_reversed' = 'true'`.
   - Marks cost lots as `REVERSED` and decrements `branch_inventory.quantity`.
   - Compensating voucher created (`voucher_type = 'JOURNAL'`, `reference_type = 'PURCHASE_REVERSAL'`, `reference_event = 'INVOICE_REVERSAL'`, `reversal_of_voucher_id = original_voucher.id`).
   - Bidirectional linkage: `original_voucher.reversed_by_voucher_id = reversal_voucher.id`; `original_journal.is_reversed = true`.
   - Journal lines:
     - **Dr 2111 (Accounts Payable)** [Full invoice total, unwinding liability].
     - Cr Inventory, Cr GST, Cr Freight.

5. **Step 3D.7-A — Supplier Payment Reversal / Void**:
   - Voiding of a bounced cheque, failed transfer, or duplicate disbursement.
   - Soft-deletes `purchase_payment` (`deleted_at = NOW()`, `reference` marked with `[REVERSED: ...]`).
   - Compensating reversal voucher created (`voucher_type = 'JOURNAL'`, `reference_type = 'PURCHASE_PAYMENT_REVERSAL'`, `reference_event = 'PAYMENT_REVERSAL'`).
   - Bidirectional linkage on original payment voucher and journal entry.
   - Journal lines:
     - Dr 1111 Cash or 1112 Bank (restores funds).
     - **Cr 2111 (Accounts Payable)** carrying `supplier_id` and `branch_id` (restores AP liability).
   - Restores purchase outstanding balance and resets `is_fully_settled = false`.

---

## 5. Existing AP Report Architecture

### Operational Reports in `purchase.repository.ts`
The operational reporting layer provides 5 query methods:
- `getPurchaseRegister(filters)`: Full list of purchases with tax breakdown.
- `getSupplierWiseSummary(filters)`: Aggregation of bills, taxable value, taxes, paid amounts, returns, and pending values grouped by supplier.
- `getItemWiseSummary(filters)`: Aggregations grouped by item description and HSN code.
- `getBillWiseSummary(filters)`: Per-invoice view showing invoice details, payments, returns, and balance due.
- `getGstHsnSummary(filters)`: Tax breakdowns grouped by HSN code.

### General Ledger Reports in `accounting-journal.repository.ts`
- `getGeneralLedger(filters)`: Paginated list of journal lines supporting filters by `account_id`, `supplier_id`, `branch_id`, `startDate`, and `endDate`.
- **Architectural Characteristic**: Designed for paginated data browsing, not for running balances, opening balances, aging schedules, or cross-subledger reconciliations.

---

## 6. Current Balance Calculation

### Empirical Evidence from `purchase.repository.ts`
Inspection of `getBillWiseSummary` and `getSupplierWiseSummary` reveals how balances are calculated:

1. **In `getBillWiseSummary`**:
   ```sql
   SELECT
     p.id, p.invoice_no, p.invoice_date::TEXT,
     s.name AS supplier_name, b.name AS branch_name,
     p.total, p.status, p.due_date::TEXT,
     COALESCE((p.metadata->>'is_reversed')::boolean, false) AS is_reversed,
     COALESCE(pp.total_paid, 0) AS total_paid,
     COALESCE(dn.total_returns, 0) AS total_returns,
     CASE
       WHEN COALESCE((p.metadata->>'is_reversed')::boolean, false) = true THEN 0.00
       ELSE GREATEST(0, p.total - COALESCE(pp.total_paid, 0) - COALESCE(dn.total_returns, 0))
     END AS balance_due
   FROM public.purchase p
   LEFT JOIN public.supplier s ON s.id = p.supplier_id AND s.deleted_at IS NULL
   LEFT JOIN public.branch   b ON b.id = p.branch_id
   LEFT JOIN LATERAL (
     SELECT COALESCE(SUM(amount), 0) AS total_paid
     FROM public.purchase_payment
     WHERE purchase_id = p.id AND deleted_at IS NULL
   ) pp ON TRUE
   LEFT JOIN LATERAL (
     SELECT COALESCE(SUM(total_amount), 0) AS total_returns
     FROM public.accounting_voucher
     WHERE reference_type = 'PURCHASE_RETURN'
       AND metadata->>'purchase_id' = p.id
       AND status = 'POSTED'
       AND deleted_at IS NULL
   ) dn ON TRUE
   ```

2. **How each AP event behaves in the calculation**:
   - **Active Payments**: Subtracted via `COALESCE(pp.total_paid, 0)`.
   - **Payment Reversals**: Because Step 3D.7-A soft-deletes reversed payments (`deleted_at = NOW()`), the `pp` lateral join (`deleted_at IS NULL`) automatically excludes them, which correctly restores `balance_due`.
   - **Debit Notes / Purchase Returns**: The lateral join `dn` aggregates `total_amount` from `accounting_voucher` where `reference_type = 'PURCHASE_RETURN'` and `status = 'POSTED'`, subtracting returns from `balance_due`.
   - **Voided Purchase Invoices**: Checked via `COALESCE((p.metadata->>'is_reversed')::boolean, false) = true`, returning `0.00`.
   - **Under-Zero Protection**: Guarded by `GREATEST(0, ...)`.

3. **Remaining Gap**:
   In `purchase.repository.ts`, the lateral joins `pp` and `dn` do not apply date bounds (`payment_date <= filters.endDate` or `voucher_date <= filters.endDate`). While suitable for current balances, an historical point-in-time calculation requires `as_of_date` filtering. This is handled in `AccountsPayableService`.

---

## 7. Current Supplier Statement Capability

### Gap in Existing Repositories
The existing `AccountingJournalRepository.getGeneralLedger` does not produce a Supplier Statement:
- It returns paginated lines without computing the **Opening Balance** before `startDate`.
- It does not calculate the **Running Balance** line by line.
- It does not summarize `total_debit`, `total_credit`, and `closing_balance`.

### Canonical Design for Supplier Statement
The Statement of Account must be derived directly from the General Ledger lines for Account 2111:

1. **Opening Balance Formula**:
   $$\text{Opening Balance} = \sum_{\substack{\text{je.entry\_date} < \text{startDate} \\ \text{jl.account\_id} = 2111 \\ \text{jl.supplier\_id} = S}} (\text{jl.credit\_amount} - \text{jl.debit\_amount})$$
   (Positive balance represents AP liability owed to supplier).

2. **Chronological Transaction Ordering**:
   Query all lines in the date range ordered by `entry_date ASC, created_at ASC, line_no ASC`.

3. **Running Balance Recurrence**:
   $$\text{Running Balance}_0 = \text{Opening Balance}$$
   $$\text{Running Balance}_i = \text{Running Balance}_{i-1} + \text{Credit}_i - \text{Debit}_i$$

4. **Closing Balance**:
   $$\text{Closing Balance} = \text{Opening Balance} + \sum_{\text{period}} \text{Credit} - \sum_{\text{period}} \text{Debit}$$

5. **Traceability**:
   Every statement row provides:
   - `entry_date`, `entry_no`
   - `voucher_id`, `voucher_no`, `voucher_type`
   - `reference_type`, `reference_id`, `reference_event`
   - `narration`
   - `debit_amount`, `credit_amount`, `running_balance`

---

## 8. Current Aging Capability

### Lack of Existing Aging Engine
CakeToHome previously had no aging schedule engine.

### Canonical Design for AP Aging Schedule
Aging must evaluate all active purchase obligations as of a specific date (`as_of_date`, defaulting to `CURRENT_DATE`):

1. **Eligibility Criteria**:
   - `p.deleted_at IS NULL`
   - `p.status = 'POSTED'`
   - `p.invoice_date <= as_of_date`
   - `COALESCE((p.metadata->>'is_reversed')::boolean, false) = false`

2. **Point-in-Time Balance Calculation**:
   $$\text{Paid}(P, \text{as\_of}) = \sum_{\substack{\text{payment\_date} \le \text{as\_of} \\ \text{deleted\_at IS NULL}}} \text{amount}$$
   $$\text{Returns}(P, \text{as\_of}) = \sum_{\substack{\text{voucher\_date} \le \text{as\_of} \\ \text{status = 'POSTED'} \\ \text{deleted\_at IS NULL}}} \text{total\_amount}$$
   $$\text{Balance Due}(P, \text{as\_of}) = \max(0, P.\text{total} - \text{Paid} - \text{Returns})$$
   If $\text{Balance Due} \le 0$, the bill is fully settled as of that date and excluded.

3. **Aging Interval Assignment**:
   $$\text{effective\_due\_date} = \text{COALESCE}(P.\text{due\_date}, P.\text{invoice\_date})$$
   $$\text{days\_overdue} = \lfloor(\text{as\_of\_date} - \text{effective\_due\_date}) / 86400000\rfloor$$

   | Bucket Key | Condition | Description |
   | :--- | :--- | :--- |
   | `CURRENT` | $\text{days\_overdue} \le 0$ | Not yet overdue / due in future |
   | `DAYS_1_30` | $1 \le \text{days\_overdue} \le 30$ | 1 to 30 days past due |
   | `DAYS_31_60` | $31 \le \text{days\_overdue} \le 60$ | 31 to 60 days past due |
   | `DAYS_61_90` | $61 \le \text{days\_overdue} \le 90$ | 61 to 90 days past due |
   | `DAYS_90_PLUS` | $\text{days\_overdue} > 90$ | Severely delinquent ($>90$ days) |

4. **Supplier & Grand Totals**:
   Aggregate overdue balances per supplier and across all suppliers into bucket totals: `total_current`, `total_1_30`, `total_31_60`, `total_61_90`, `total_90_plus`, and `grand_total`.

---

## 9. Current Reconciliation Capability

### Zero Existing Automated Reconciliation
There was previously no routine proving that operational payables match the General Ledger.

### Canonical Design for AP ↔ GL Reconciliation
Reconciliation establishes mathematical identity across all suppliers:

1. **Operational AP Side**:
   Query all active purchases as of `as_of_date`, computing the sum of net balances per supplier:
   $$\text{Operational Balance}(S) = \sum_{P \in \text{Bills}(S)} \max(0, P.\text{total} - \text{Paid}(P) - \text{Returns}(P))$$

2. **General Ledger Side**:
   Query all journal lines posted to Account 2111 as of `as_of_date` grouped by `supplier_id`:
   $$\text{GL 2111 Balance}(S) = \sum_{\substack{L \in \text{Lines}(2111, S) \\ \text{entry\_date} \le \text{as\_of}}} (\text{Credit}(L) - \text{Debit}(L))$$

3. **Variance & Discrepancy Evaluation**:
   $$\text{Variance}(S) = \text{Operational Balance}(S) - \text{GL 2111 Balance}(S)$$
   $$\text{Total Discrepancy} = \sum \text{Operational Balance} - \sum \text{GL 2111 Balance}$$
   $$\text{is\_reconciled} \equiv (\text{Total Discrepancy} == 0.00) \land (\forall S: \text{Variance}(S) == 0.00)$$

4. **Strict Discrepancy Disclosure**:
   Discrepancies must never be hidden or forced to zero by arbitrary rounding. Any discrepancy indicates an unposted document, a missing subledger dimension, or an unauthorized manual entry.

---

## 10. Authoritative Source Mapping

Mapping of all 20 required dimensions:

| # | Dimension | Authoritative Table | Authoritative Field | Responsible Repository / Service | Status |
| :---: | :--- | :--- | :--- | :--- | :---: |
| 1 | Purchase invoice amount | `public.purchase` | `total` (NUMERIC) | `PurchaseRepository` | Reliable |
| 2 | Supplier | `public.purchase` / `public.accounting_journal_line` | `supplier_id` (TEXT FK) | `PurchaseRepository` / `AccountingJournalRepository` | Reliable |
| 3 | Supplier GSTIN | `public.supplier` | `gstin` (TEXT) | `SupplierRepository` | Reliable |
| 4 | Purchase date | `public.purchase` | `invoice_date` (DATE) | `PurchaseRepository` | Reliable |
| 5 | Due date | `public.purchase` | `due_date` (DATE, nullable) | `PurchaseRepository` | Fallback to `invoice_date` if null |
| 6 | Branch | `public.purchase` / `accounting_journal_line` | `branch_id` (TEXT FK) | `PurchaseRepository` / `AccountingJournalRepository` | Reliable |
| 7 | Purchase payment | `public.purchase_payment` | Row identity | `PurchasePaymentService` | Reliable |
| 8 | Payment date | `public.purchase_payment` | `payment_date` (DATE) | `PurchasePaymentService` | Reliable |
| 9 | Payment amount | `public.purchase_payment` | `amount` (NUMERIC) | `PurchasePaymentService` | Reliable |
| 10 | Payment reversal | `public.purchase_payment` / `accounting_voucher` | `deleted_at`, `reversed_by_voucher_id` | `PurchasePaymentService` (3D.7-A) | Reliable |
| 11 | Purchase return | `public.inventory_movement` / `cost_lot` | `remaining_quantity`, movements | `PurchaseReturnService` (3D.6-A) | Reliable |
| 12 | Debit note | `public.accounting_voucher` | `DEBIT_NOTE`, `PURCHASE_RETURN` | `PurchaseReturnService` (3D.6-A) | Reliable |
| 13 | Purchase invoice reversal | `public.purchase` / `accounting_voucher` | `metadata->>'is_reversed'`, `JOURNAL` | `PurchaseReversalService` (3D.6-B) | Reliable |
| 14 | Accounting voucher | `public.accounting_voucher` | Complete row record | `AccountingVoucherRepository` | Reliable |
| 15 | Journal entry | `public.accounting_journal_entry` | Complete row record | `AccountingJournalRepository` | Reliable |
| 16 | Journal lines | `public.accounting_journal_line` | Complete row records | `AccountingJournalRepository` | Reliable |
| 17 | AP account 2111 | `public.accounting_account` | `code = '2111'`, `type = 'LIABILITY'` | `AccountingAccountRepository` | Reliable |
| 18 | Supplier dimension | `public.accounting_journal_line` | `supplier_id` (TEXT FK) | `PostingService` / `AccountsPayableService` | Reliable |
| 19 | Branch dimension | `public.accounting_journal_line` | `branch_id` (TEXT FK) | `PostingService` / `AccountsPayableService` | Reliable |
| 20 | Outstanding amount | Operational bills vs GL 2111 lines | Calculated balance identity | `AccountsPayableService` | Reconciled in 3D.7-B |

---

## 11. Required Report Calculations

### Mathematical Specifications

1. **Subledger Running Balance**:
   $$\text{Bal}_0 = \sum_{t < \text{start}} (\text{Cr}_t - \text{Dr}_t)$$
   $$\text{Bal}_i = \text{Bal}_{i-1} + \text{Cr}_i - \text{Dr}_i$$
   $$\text{Closing} = \text{Bal}_N$$

2. **Bill-Wise Balance Due**:
   $$\text{BalDue}(P) = \begin{cases} 0.00 & \text{if } P.\text{is\_reversed} = \text{true} \\ \max(0, P.\text{total} - \sum \text{Paid} - \sum \text{Returns}) & \text{otherwise} \end{cases}$$

3. **AP Aging Schedule**:
   $$\Delta_{\text{days}} = \text{as\_of\_date} - \text{COALESCE}(P.\text{due\_date}, P.\text{invoice\_date})$$
   $$\text{Bucket} = \begin{cases} \text{CURRENT} & \text{if } \Delta \le 0 \\ \text{DAYS\_1\_30} & \text{if } 1 \le \Delta \le 30 \\ \text{DAYS\_31\_60} & \text{if } 31 \le \Delta \le 60 \\ \text{DAYS\_61\_90} & \text{if } 61 \le \Delta \le 90 \\ \text{DAYS\_90\_PLUS} & \text{if } \Delta > 90 \end{cases}$$

4. **Reconciliation Invariant**:
   $$\sum_{S} \text{Operational AP}(S) - \sum_{S} \text{GL 2111 Balance}(S) \equiv 0.00$$

---

## 12. Due-Date / Date Semantics

### Investigation Findings
- `purchase.invoice_date` is mandatory for financial posting.
- `purchase.due_date` is nullable in the database schema.
- `purchase.credit_terms_days` is an optional integer indicating agreed supplier credit terms.

### Authoritative Date Semantics
1. **If `due_date` is populated**: It is the authoritative date driving the aging schedule.
2. **If `due_date` is null**: The system falls back to `invoice_date` (representing 0 credit terms / immediate payment expected).
3. **Date Format**: Standardized ISO-8601 strings formatted as `YYYY-MM-DD`.
4. **Timezone Evaluation**: Pure calendar dates (`DATE` type in PostgreSQL) are evaluated with UTC boundaries without timezone skew.

---

## 13. Branch / RBAC Model

### Access Levels & Policies
- **`SUPER_ADMIN`**: Enterprise-wide visibility across all branches; ability to query across all branches or filter by specific branch.
- **`BRANCH_MANAGER`**: Strictly isolated to their assigned `branch_id`. Any query attempting to access another branch's transactions is rejected.
- **Multi-Branch Supplier Support**: A supplier may do business with multiple branches. When filtered by branch, the subledger and aging schedule only present transactions created within that branch scope. When evaluated enterprise-wide by `SUPER_ADMIN`, all branches are combined into a consolidated supplier statement.

### Canonical Permissions
Evaluated via `hasEffectivePermission(actorContext, permissionKey)`:
- `ACCOUNTING.VIEW`: Required to view the Supplier Statement, AP Subledger, and AP Aging Schedule.
- `ACCOUNTING.EXPORT`: Required to export AP subledgers and aging schedules to Excel/CSV.
- `ACCOUNTING.POST`: Required for transactional modifications (disbursements, returns, reversals); not required for read-only reporting.

---

## 14. Security Implications

1. **Authorization**: All report endpoints enforce server-side session resolution. Client-supplied role headers or user IDs are rejected.
2. **BOLA / IDOR Prevention**: Branch managers cannot inspect supplier balances belonging to other branches.
3. **SQL Injection Defense**: 100% parameterized SQL queries via `$N` placeholders. No string concatenation for queries.
4. **Soft-Deletion Enforcement**: All queries enforce `deleted_at IS NULL` on `supplier`, `purchase`, `purchase_payment`, and `accounting_voucher`.
5. **No Data Tampering**: Reporting methods are strictly read-only and execute without database mutations.

---

## 15. Database Impact

- **Schema Changes**: **ZERO**. The existing PostgreSQL tables (`accounting_journal_line`, `accounting_journal_entry`, `accounting_voucher`, `purchase`, `purchase_payment`, `supplier`) contain all necessary columns, constraints, and relationships.
- **Migrations**: **ZERO**. No DDL migrations required.
- **Write Operations**: **ZERO**. All 3D.7-B services and queries are strictly read-only.
- **Fail-Closed Posting Protection**: The baseline remains unconfigured (`accounting_start_date` unconfigured, 0 fiscal periods), ensuring that any accidental transaction posting fails closed.

---

## 16. Performance & Index Considerations

Existing indexes fully cover all AP subledger and aging queries:

| Index Name | Table | Indexed Columns / Predicate | Target Query |
| :--- | :--- | :--- | :--- |
| `idx_accounting_jline_supplier` | `accounting_journal_line` | `(supplier_id) WHERE supplier_id IS NOT NULL` | Subledger supplier lookup |
| `idx_accounting_jline_account_branch` | `accounting_journal_line` | `(account_id, branch_id)` | Account 2111 branch filtering |
| `idx_accounting_journal_branch_date` | `accounting_journal_entry` | `(branch_id, entry_date DESC)` | Subledger date range & ordering |
| `idx_purchase_supplier_id` | `purchase` | `(supplier_id) WHERE deleted_at IS NULL` | Aging supplier grouping |
| `idx_purchase_invoice_date` | `purchase` | `(invoice_date) WHERE deleted_at IS NULL` | Aging invoice date filtering |
| `idx_purchase_payment_purchase_id` | `purchase_payment` | `(purchase_id) WHERE deleted_at IS NULL` | Bill payment lateral join |
| `idx_accounting_voucher_ref` | `accounting_voucher` | `(reference_type, reference_id)` | Debit note lateral join |

All lateral queries execute in logarithmic time via existing B-Tree index scans.

---

## 17. Test Plan

The verification suite for Step 3D.7-B (`frontend/scratch/test_step3d7b_ap_subledger.js`) is structured into 9 isolated test sections executed inside a single `BEGIN ... ROLLBACK` transaction:

1. **[0/9] Pre-Test Baseline Verification**:
   - Asserts all 16 key tables are at the clean baseline before test start.
2. **[1/9] Test Harness Setup**:
   - Creates 2 test suppliers, 1 branch, 1 catalog accessory, and resolves GL accounts inside the transaction.
3. **[2/9] AP Transactional Lifecycle Execution**:
   - Bill 1 (₹6,000): Partial payment ₹2,500 $\rightarrow$ balance ₹3,500.
   - Bill 2 (₹4,000): Physical return / debit note of ₹1,000 $\rightarrow$ balance ₹3,000.
   - Bill 3 (₹2,000): Paid in full ₹2,000, then payment reversed via 3D.7-A $\rightarrow$ balance restored to ₹2,000.
   - Bill 4 (₹3,000): Full invoice reversal / void via 3D.6-B $\rightarrow$ balance ₹0.00.
   - Supplier B Bill 1 (₹5,000): Independent supplier isolation.
4. **[3/9] Supplier Statement of Account & 2111 Running Balance**:
   - Validates chronological sequencing across all 5 transaction types.
   - Verifies exact line-by-line running balance math.
   - Tests date-range filtering and opening balance derivation.
5. **[4/9] AP Aging Schedule**:
   - Validates aging bucket placement (`CURRENT`, `DAYS_1_30`, `DAYS_31_60`, `DAYS_61_90`, `DAYS_90_PLUS`).
   - Verifies that debit notes reduce aging balance.
   - Verifies that payment reversals restore aging balance.
   - Verifies that voided invoices are excluded.
6. **[5/9] Operational Report Reconciliation**:
   - Verifies `PurchaseRepository.getBillWiseSummary` includes debit notes and excludes voided bills.
   - Verifies `PurchaseRepository.getSupplierWiseSummary` matches operational totals.
7. **[6/9] AP ↔ GL Mathematical Identity & Zero Variance**:
   - Asserts `is_reconciled === true`.
   - Asserts global `discrepancy === 0.00`.
   - Asserts per-supplier `variance === 0.00` for all suppliers.
8. **[7/9] Edge Cases & Error Handling**:
   - Non-existent supplier error handling.
   - Inactive supplier with 0 transactions returns empty statement with zero balance.
   - Aging schedule with past `as_of_date`.
9. **[8/9] Full Rollback Audit**:
   - Executes `ROLLBACK`.
   - Audits all 16 tables to prove zero data was persisted.

---

## 18. Known Gaps

1. **Point-in-Time Filters on `purchase.repository.ts`**:
   The existing `getBillWiseSummary` query does not filter payments or debit notes by date. While suitable for live operational viewing, point-in-time historical reporting is handled in `AccountsPayableService`.
2. **Dashboard UI Integration**:
   The admin web interface currently contains purchase register views, but dedicated UI panels for "Supplier Statement" and "AP Aging Schedule" will be wired in frontend reporting milestones.

---

## 19. Explicit Blockers

- **NONE**.
- All prerequisite schemas, Chart of Accounts definitions, upstream posting services (3D.4), payment services (3D.5), return services (3D.6-A), invoice reversal services (3D.6-B), and payment reversal services (3D.7-A) are in place, tested, and frozen.

---

## 20. Exact Bounded Implementation Proposal for 3D.7-B

The scope of Step 3D.7-B implementation is strictly bounded to the following code files:

1. **`frontend/src/lib/types/accounts-payable.types.ts`**:
   Canonical TypeScript interfaces for `SupplierStatementFilters`, `SupplierStatementLine`, `SupplierStatementResult`, `ApAgingFilters`, `ApAgingBillItem`, `SupplierApAgingRow`, `ApAgingScheduleResult`, `SupplierApGlVariance`, and `ApGlReconciliationResult`.
2. **`frontend/src/lib/types/purchase.types.ts`**:
   Enrichment of `BillWisePurchaseRow` and `SupplierPurchaseSummaryRow` with `total_returns` and `is_reversed` properties.
3. **`frontend/src/lib/repositories/purchase.repository.ts`**:
   Incorporation of the lateral join for debit notes (`dn`) and void status check in `getBillWiseSummary` and `getSupplierWiseSummary`.
4. **`frontend/src/lib/services/accounts-payable.service.ts`**:
   Canonical service exposing `getSupplierStatement`, `getApAgingSchedule`, and `getApGlReconciliation`.
5. **`frontend/src/lib/services/index.ts`**:
   Export of `AccountsPayableService`.
6. **`frontend/scratch/test_step3d7b_ap_subledger.js`**:
   Execution of the comprehensive test harness.

---

## 21. Items Explicitly Out of Scope

The following items are strictly OUT OF SCOPE for Step 3D.7-B:
- **Phase 4F Step 4**: Customer sales orders, revenue recognition, output GST (CGST/SGST/IGST), customer accounts receivable (AR), customer payments, sales returns, and sales reversals.
- **Cost of Goods Sold (COGS)**: Inventory consumption and COGS accounting.
- **Fiscal Period & Accounting Start Date Configuration**: The database configuration remains unconfigured so all transactions fail closed.
- **Production Postings**: Zero production vouchers or journals will be committed.

---

## 22. Required Authorization Before Implementation

> [!IMPORTANT]
> **GATE STOP DECLARATION**:
> The forensic inspection and design gate for **Phase 4F Step 3D.7-B** is COMPLETE.
> - **Predecessor Milestones**: 3D.4, 3D.5, 3D.6-A, 3D.6-B, 3D.7-A remain 100% frozen and intact.
> - **Database Baseline**: Clean and verified; zero operational vouchers, journals, or lots persisted.
> - **TypeScript Compilation**: 0 errors across the codebase.
> - **Sales / COGS**: Strictly deferred to Phase 4F Step 4.
>
> In accordance with safety instructions, **implementation will NOT proceed automatically**.
> Antigravity is stopped at this gate awaiting explicit user authorization to proceed with 3D.7-B implementation.
