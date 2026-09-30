# Phase 4F Step 4.8: AR Statement, Aging & Reconciliation — Forensic Investigation & Architecture Design Gate 📋

**Timestamp:** 2026-09-26 21:15:00 IST  
**Status:** AMENDED FORENSIC & ARCHITECTURE DESIGN GATE COMPLETE (READY FOR IMPLEMENTATION REVIEW) 📋  
**Branch:** `task/dev`  
**HEAD:** `f7d9a47073d64b0da305cc537a6eccb45938fd1b`  
**Execution Boundary:** READ-ONLY Forensic Investigation & Design Analysis Complete; **Step 4.8 Implementation NOT Started (Strict Halt)** 🛑

---

## 1. Executive Summary & Authorization Boundary

This document establishes the authoritative forensic investigation and architectural design contract for **Phase 4F Step 4.8: Accounts Receivable (AR) Statement, Aging & GL Reconciliation**, incorporating all corrective design gate amendments.

In strict compliance with the project authorization boundary:
- **Zero Step 4.8 Implementation Code Has Been Written**: No AR repositories, no statement/aging/reconciliation services, no API endpoints, no UI panels, and no exports have been created.
- **Zero Database Mutations**: The live PostgreSQL database remains 100% pristine. Zero rows inserted, updated, or deleted.
- **Zero Schema Alterations / DDL**: No migrations were introduced, no indexes added, no table definitions changed.
- **Zero Accounting Configuration**: `accounting_start_date` remains strictly unconfigured (`0 rows in public.setting`).
- **Zero Historical Prototype Pollution**: All 173 historical prototype orders and 53 payment transactions remain strictly quarantined.
- **Zero Git Commits / Pushes**: Repository working tree remains clean at `task/dev` HEAD `f7d9a47073d64b0da305cc537a6eccb45938fd1b`.

---

## 2. Mandatory Skill Verification & Availability

| Skill | Status | Application in Step 4.8 Forensic Gate |
|---|---|---|
| `smart-coder` | **AVAILABLE** ✅ | Enforced 5-step engineering lifecycle: Plan $\to$ Inspect $\to$ (Implement halted) $\to$ (Test halted) $\to$ Verify. |
| `lazy-coder` | **AVAILABLE** ✅ | Reused proven architectural patterns from Step 3D.7-B (`AccountsPayableService`), preventing duplicate state machines. |
| `postgresql-and-supabase` | **AVAILABLE** ✅ | Audited PostgreSQL index coverage, schema constraints, foreign key cascades, and RLS policies. |
| `security-audit` | **AVAILABLE** ✅ | Verified read-only execution boundaries, absence of credential leakage, and data isolation. |
| `security-auditing-and-owasp` | **AVAILABLE** ✅ | Audited BOLA / IDOR defense, branch scoping, customer identity isolation, and verified server-side session resolution. |
| `clean-architecture` | **AVAILABLE** ✅ | Designed clean separation: Domain calculation $\to$ Subledger Service $\to$ Repository $\to$ Infrastructure DTO. |
| `accounting/ERP` (dedicated) | **NOT INSTALLED** ⚠️ | Applied established project CoA standards, Indian GST rules, and Step 3D.7-B AP / Steps 4.1–4.7 Sales architecture as primary authority. |
| `reporting/analytics` (dedicated) | **NOT INSTALLED** ⚠️ | Applied existing ERP reporting patterns and keyset pagination standards as primary authority. |

---

## 3. Repository Safety & Pre-Forensic Verification

- **Branch**: `task/dev`
- **HEAD Commit**: `f7d9a47073d64b0da305cc537a6eccb45938fd1b`
- **Working Tree State**: Clean. Zero unexpected tracked modifications.
- **Destructive Operations**: Zero `git reset`, `git clean`, `git checkout`, or `git revert` operations executed.

---

## 4. PostgreSQL Schema & Database Baseline Audit (18/18 Checks)

Executed independently outside test transactions via [`frontend/scratch/forensic_baseline_step4_5.js`](file:///e:/vig/cakes2home-main/cakes2home-main/frontend/scratch/forensic_baseline_step4_5.js):

```
CakeToHome ERP — Phase 4F Step 4.5 Independent PostgreSQL Baseline Audit
=============================================================================
[PASS] Table count public."accounting_account": actual=98, expected=98
[PASS] Table count public."accounting_voucher": actual=0, expected=0
[PASS] Table count public."accounting_journal_entry": actual=0, expected=0
[PASS] Table count public."accounting_journal_line": actual=0, expected=0
[PASS] Table count public."accounting_fiscal_period": actual=0, expected=0
[PASS] Table count public."purchase": actual=0, expected=0
[PASS] Table count public."purchase_item": actual=0, expected=0
[PASS] Table count public."purchase_payment": actual=0, expected=0
[PASS] Table count public."supplier": actual=0, expected=0
[PASS] Table count public."branch": actual=57, expected=57
[PASS] Table count public."branch_inventory": actual=424, expected=424
[PASS] Table count public."inventory_cost_lot": actual=0, expected=0
[PASS] Table count public."inventory_movement": actual=0, expected=0
[PASS] Table count public."inventory_cost_consumption": actual=0, expected=0
[PASS] Table count public."order": actual=173, expected=173
[PASS] Table count public."payment_transaction": actual=53, expected=53
[PASS] Setting accounting_start_date configured rows: actual=0, expected=0
[PASS] Synthetic non-acc rows in branch_inventory: actual=0, expected=0
=============================================================================
BASELINE AUDIT SUMMARY: 18 PASSED, 0 FAILED (TOTAL: 18)
=============================================================================
```

---

## 5. Authoritative AR Control Account Model: 1121 vs 1122

Forensic inspection of `public.accounting_account` verified the exact Chart of Accounts structure:

| Code | Name | Type | Subtype | Is Group | Is Active | Normal Balance | Parent ID / Group |
|---|---|---|---|---|---|---|---|
| **1120** | Receivables and Advances | ASSET | CURRENT_ASSET | `true` | `true` | DEBIT | Current Assets |
| **1121** | Accounts Receivable | ASSET | RECEIVABLE | `false` | `true` | **DEBIT** | 1120 Receivables and Advances |
| **1122** | Undeposited COD | ASSET | CURRENT_ASSET | `false` | `true` | **DEBIT** | 1120 Receivables and Advances |
| **1110** | Cash and Cash Equivalents | ASSET | CURRENT_ASSET | `true` | `true` | DEBIT | Current Assets |
| **1111** | Cash in Hand | ASSET | CASH | `false` | `true` | **DEBIT** | 1110 Cash and Cash Equivalents |
| **1112** | Bank Operating A/c | ASSET | BANK | `false` | `true` | **DEBIT** | 1110 Cash and Cash Equivalents |
| **1113** | Gateway Clearing | ASSET | GATEWAY_CLEARING | `false` | `true` | **DEBIT** | 1110 Cash and Cash Equivalents |
| **5290** | Payment Gateway MDR Fees | EXPENSE | OPERATING_EXPENSE | `false` | `true` | **DEBIT** | Operating Expenses |

### Architectural Resolution of Account 1121 vs Account 1122
Inspection of `sales-posting.service.ts` and `customer-receipt.service.ts` resolves how the system classifies commercial obligations:

1. **Account 1121 (Trade Accounts Receivable)**:
   - Sole commercial trade debtor asset account for **Prepaid Orders** (Card, UPI, Netbanking, Wallet).
   - Invoiced upon sale: `Dr 1121 / Cr 4110/4120/4130 + Cr 2121..2129`.
   - Cleared upon payment gateway capture: `Dr 1113 Gateway Clearing / Cr 1121 Accounts Receivable`.
   - Reduced upon sales return: `Dr 4190 / Dr Output GST / Cr 1121`.
   - Increased upon refund: `Dr 1121 / Cr 1113 Gateway Clearing`.
   - Reversal (Step 4.7): `Dr Revenue / Dr Output GST / Cr 1121`.
   - **Exclusive Scope for Trade AR Statement**: Represents customer-facing financial balances and trade credit.

2. **Account 1122 (Undeposited COD Collections)**:
   - In-transit cash collection clearing account for **Cash on Delivery (COD) Orders**.
   - Invoiced upon delivery dispatch: `Dr 1122 / Cr Revenue + Cr Output GST`.
   - Cleared upon physical cash remittance to branch cashier/supervisor: `Dr 1111 Cash in Hand / Cr 1122 Undeposited COD`.
   - Reduced upon COD return before collection: `Dr 4190 / Dr Output GST / Cr 1122`.
   - Cash refund after collection: `Dr 1122 / Cr 1111 Cash in Hand`.
   - Reversal (Step 4.7): `Dr Revenue / Dr Output GST / Cr 1122`.
   - **Architectural Distinction**: Account 1122 represents money in physical custody of delivery personnel (riders) and store cashiers. Mixing 1122 directly into a customer trade statement would show an open receivable against a customer who has already paid cash to the delivery driver.

### Strict Separation of Reporting Concepts
To prevent conflating customer trade debt with delivery cash float:
- **Concept A: Trade AR Statement (Account 1121)**:
  - Solely queries Account `1121`.
  - Reflects customer-level commercial receivables, prepaid receipts, credit notes, refunds, and invoice reversals.
- **Concept B: COD Collection Control (Account 1122)**:
  - Solely queries Account `1122`.
  - Audits delivery rider / branch cashier in-transit cash float from dispatch to physical register deposit.
  - Slices by branch, delivery driver, or fulfillment batch where metadata is available.
  - **NEVER** included in Trade AR aging or customer trade balances.
- **Concept C: Optional Combined Operational View**:
  - A separate operational ledger may provide store managers with an end-to-end view of all customer orders (prepaid + COD).
  - Must be clearly titled and labelled as an **Operational Order Activity Ledger** and **NEVER** represented as the GL Trade AR balance or Trade AR Aging schedule.

---

## 6. Customer Dimension Forensics & Guest Hygiene

### Schema Findings
- `accounting_journal_line.customer_id`: `TEXT NULLABLE`, with foreign key `accounting_journal_line_customer_id_fkey` referencing `public.customer(id)`.
- Index: `idx_accounting_jline_customer` on `(customer_id) WHERE (customer_id IS NOT NULL)`.
- `public.customer`: 57 registered customers. Primary key `id TEXT`. Includes `company_name`, `first_name`, `last_name`, `email`, `phone`, `has_account`, `metadata`, `created_at`, `updated_at`, `deleted_at`.
- `public.order`: 173 orders. 171 orders have `customer_id` populated; 2 orders have `customer_id IS NULL` (pure guest orders).

### Identity & Statement Rules
1. **Authoritative Accounting Identity**:
   - `customer_id` is the **only authoritative dimension** for subledger aggregation. Customer names, phones, and emails are mutable presentation attributes and MUST NOT be used for grouping or balance calculation.
2. **Guest Customer Hygiene (`customer_id IS NULL`)**:
   - For orders placed by guest users (where `customer_id IS NULL` or `customer_id = 'guest'`), all services enforce foreign key hygiene: `journal_line.customer_id = NULL`.
   - A customer statement is an entity subledger report requiring an identifiable customer. An AR statement CANNOT be generated for an unidentified guest.
   - Guest transactions are immediate point-of-sale cash/prepaid events that do not maintain an ongoing balance-forward subledger.
3. **Soft-Deleted Customers (`deleted_at IS NOT NULL`)**:
   - `accounting_journal_line.customer_id` is immutable and persists even if `customer.deleted_at` is set.
   - The statement engine must query historical journal lines regardless of `customer.deleted_at`, displaying the customer with an `[ARCHIVED / INACTIVE]` badge in the header.
4. **Historical Prototype Orders (173 Orders)**:
   - Historical prototype orders have no posted vouchers or journal lines (`accounting_journal_line` = 0 rows).
   - Because AR reports derive strictly from posted journal entries, historical prototype orders are naturally excluded without special query filtering.

---

## 7. Source-of-Truth Transaction Event Mapping & Selective Hybrid Inversion Model

Every commercial AR movement is authoritatively recorded as a General Ledger journal line on Account `1121` or `1122`:

```
┌────────────────────────────┬─────────────────┬───────────────────┬───────────────────────┬────────────┬─────────────┐
│ Business Event             │ Voucher Type    │ Reference Type    │ Reference Event       │ Account    │ GL Direction│
├────────────────────────────┼─────────────────┼───────────────────┼───────────────────────┼────────────┼─────────────┤
│ Sales Invoice (Prepaid)    │ SALES           │ ORDER             │ PRIMARY               │ 1121       │ DEBIT  (+)  │
│ Sales Invoice (COD)        │ SALES           │ ORDER             │ PRIMARY               │ 1122       │ DEBIT  (+)  │
│ Customer Receipt (Prepaid) │ RECEIPT         │ ORDER / PMT_TXN   │ PRIMARY               │ 1121       │ CREDIT (-)  │
│ COD Cash Remittance        │ RECEIPT         │ ORDER / PMT_TXN   │ PRIMARY               │ 1122       │ CREDIT (-)  │
│ Credit Note (Prepaid)      │ CREDIT_NOTE     │ ORDER_RETURN      │ PRIMARY               │ 1121       │ CREDIT (-)  │
│ Credit Note (COD)          │ CREDIT_NOTE     │ ORDER_RETURN      │ PRIMARY               │ 1122       │ CREDIT (-)  │
│ Invoice Reversal (Prepaid) │ JOURNAL         │ SALES_REVERSAL    │ INVOICE_REVERSAL      │ 1121       │ CREDIT (-)  │
│ Invoice Reversal (COD)     │ JOURNAL         │ SALES_REVERSAL    │ INVOICE_REVERSAL      │ 1122       │ CREDIT (-)  │
│ Customer Refund (Prepaid)  │ PAYMENT         │ CUSTOMER_REFUND   │ PRIMARY               │ 1121       │ DEBIT  (+)  │
│ Customer Refund (COD)      │ PAYMENT         │ CUSTOMER_REFUND   │ PRIMARY               │ 1122       │ DEBIT  (+)  │
└────────────────────────────┴─────────────────┴───────────────────┴───────────────────────┴────────────┴─────────────┘
```

### Reference to Step 4.7 Selective Hybrid Inversion Model
As accepted in Step 4.7, an invoice reversal is **NOT** a simple full journal inversion of every line. Instead, it strictly enforces the **Selective Hybrid Inversion Model**:
- **Commercial & Tax Lines**: Inverted directly from the original posted journal (`Dr Revenue / Dr Output GST / Cr AR or COD`).
- **Merchandise-Specific Inventory & COGS Rules**:
  - *Perishable Cakes*: Intentionally NOT restocked; cake COGS is NOT reversed into asset inventory.
  - *Single-Use Packaging*: Intentionally NOT restocked; packaging COGS is NOT reversed into asset inventory.
  - *Durable Accessories*: Stock and COGS are restored using exact `inventory_cost_consumption` traceability.
- **Double-Entry Balance**: The commercial reversal voucher is self-balancing (`Dr 4110/4120/4130 + Dr 2121..2129 = Cr 1121/1122`), ensuring customer AR is accurately credited without contaminating inventory assets.

> **Treasury Non-AR Boundary**:
> Gateway settlement (`Dr 1112 Bank + Dr 5290 MDR / Cr 1113 Gateway Clearing`) touches treasury accounts only. It NEVER touches Account 1121 or 1122, and has **zero impact** on customer AR balances.

---

## 8. AR Mathematical Model

Because Account 1121 and 1122 are ASSET accounts with a **Normal DEBIT Balance**:

### Opening Balance as of Date $D$
$$\text{Opening Balance}(D) = \sum_{t < D} \text{Debit Amount}(t) - \sum_{t < D} \text{Credit Amount}(t)$$

### Chronological Running Balance for Transaction Line $i$
$$\text{Running Balance}_i = \text{Running Balance}_{i-1} + \text{Debit Amount}_i - \text{Credit Amount}_i$$

### Period Closing Balance
$$\text{Closing Balance} = \text{Opening Balance} + \sum_{D_{\text{start}} \le t \le D_{\text{end}}} \text{Debit Amount}(t) - \sum_{D_{\text{start}} \le t \le D_{\text{end}}} \text{Credit Amount}(t)$$

### Sign Interpretation
- **Positive Balance ($> 0$)**: Normal debtor balance. Customer owes money to CakeToHome.
- **Zero Balance ($= 0$)**: Account fully settled.
- **Negative Balance ($< 0$)**: Credit balance (Customer Credit / Overpayment / Unrefunded Credit Note). CakeToHome owes refund or merchandise credit to customer.

---

## 9. Customer Statement Specification & Persisted Ordering

### Authoritative Persisted Ordering (No Fictitious Sequence)
Schema inspection of `public.accounting_voucher`, `public.accounting_journal_entry`, and `public.accounting_journal_line` establishes that **no bare `sequence` integer column exists**.

Deterministic same-day ordering must rely strictly on authoritative, persisted schema columns:
```sql
ORDER BY 
  v.voucher_date ASC,
  je.created_at ASC,
  v.voucher_no ASC,
  jl.line_no ASC,
  jl.id ASC
```
- `v.voucher_date`: Authoritative transaction accounting date.
- `je.created_at`: Physical insertion timestamp ensuring chronological creation sequence.
- `v.voucher_no`: Unique alphanumeric identifier (e.g. `VCH-SALES-FY2026-XXXXXX`) guaranteeing cross-voucher uniqueness.
- `jl.line_no`: Integer sequence of lines within a journal entry (`1, 2, 3...`).
- `jl.id`: UUID tie-breaker guaranteeing total deterministic ordering.

### Proposed Statement DTO & Response Schema
```typescript
export interface CustomerStatementHeader {
  companyName: string;
  branchScope: string; // "ALL_BRANCHES" or specific branch name
  branchId: string | null;
  customer: {
    id: string;
    name: string;
    email: string | null;
    phone: string | null;
    companyName: string | null;
    status: "ACTIVE" | "ARCHIVED";
  };
  controlAccount: {
    id: string;
    code: "1121"; // Trade AR only
    name: string;
  };
  period: {
    startDate: string | null; // ISO YYYY-MM-DD
    endDate: string | null;   // ISO YYYY-MM-DD
  };
  openingBalance: number;
  totalDebits: number;
  totalCredits: number;
  closingBalance: number;
}

export interface CustomerStatementTransactionLine {
  lineId: string;
  voucherDate: string;      // ISO YYYY-MM-DD from accounting_voucher.voucher_date
  createdAt: string;        // ISO timestamp from accounting_journal_entry.created_at
  entryNo: string;          // JE-FY2026-XXXXXX
  voucherId: string;
  voucherNo: string;        // VCH-SALES-FY2026-XXXXXX
  voucherType: string;      // SALES, RECEIPT, CREDIT_NOTE, PAYMENT, JOURNAL
  referenceType: string;    // ORDER, ORDER_RETURN, CUSTOMER_REFUND, SALES_REVERSAL
  referenceId: string | null;
  referenceEvent: string;
  description: string;
  debitAmount: number;
  creditAmount: number;
  runningBalance: number;
  branchId: string;
  branchName: string;
}

export interface CustomerStatementResult {
  header: CustomerStatementHeader;
  transactions: CustomerStatementTransactionLine[];
  reconciliationStatus: "BALANCED" | "VARIANCE_DETECTED";
}
```

---

## 10. AR Aging Design & Due Date Policy Decision

### Due Date Policy: ACCOUNTING/BUSINESS POLICY DECISION REQUIRED
- **Forensic Fact**: Neither `order`, `accounting_voucher`, nor `accounting_journal_line` contains a persisted `due_date` column (`purchase.due_date` exists, but no sales counterpart).
- **Classification**: **ACCOUNTING/BUSINESS POLICY DECISION REQUIRED**.
- **Candidate Policy Rules (Presented for Explicit User/Business Approval)**:
  1. *Candidate Rule 1 (Prepaid Orders)*: $\text{Due Date} = \text{voucher\_date}$ (immediate settlement required upon invoice generation).
  2. *Candidate Rule 2 (COD Orders)*: $\text{Due Date} = \text{COALESCE}(\text{order.metadata}\to\text{'delivery\_date'}, \text{voucher\_date})$ (settlement due upon physical fulfillment/delivery).
- **Explicit Design Gate Decision**: **AR Aging Implementation is BLOCKED until an authoritative due-date policy is approved.** The implementation will NOT silently assume or hardcode either candidate.

### Date Typology (No Date Substitution)
The aging engine strictly distinguishes the following six distinct dates and must never substitute one for another:
1. `voucher_date`: Authoritative financial posting date of the sales invoice.
2. `due_date`: Authoritative date on which payment becomes delinquent (pending policy approval).
3. `delivery_date`: Physical fulfillment date recorded on order metadata.
4. `receipt_date`: Date payment was captured/collected.
5. `credit_note_date`: Date credit memo was approved/issued.
6. `reversal_date`: Date compensating reversal journal was posted.

### Mathematical Aging Framework
Once an authoritative due-date policy is approved, aging will evaluate open balances as of `as_of_date`:
$$\text{Days Past Due} = \text{as\_of\_date} - \text{authoritative\_due\_date}$$

| Bucket Code | Range | Description |
|---|---|---|
| `CURRENT` | $\le 0$ days | Due today or not yet due |
| `DAYS_1_30` | 1–30 days | 1 to 30 days overdue |
| `DAYS_31_60` | 31–60 days | 31 to 60 days overdue |
| `DAYS_61_90` | 61–90 days | 61 to 90 days overdue |
| `DAYS_91_120` | 91–120 days | 91 to 120 days overdue |
| `DAYS_121_PLUS` | $> 120$ days | Severely aged delinquent receivable |
| `CREDIT_BALANCE`| $< 0$ amount | Customer credit / overpayment |

---

## 11. Payment Allocation Model & Order-Specific Traceability

### Current Architecture Dependency
In CakeToHome's current implementation (Steps 4.1–4.7):
- Every `RECEIPT` voucher explicitly references an `order_id` / `sales_voucher_id`.
- Every `CREDIT_NOTE` explicitly references an `order_id` / `sales_voucher_id`.
- Every `CUSTOMER_REFUND` explicitly references an `order_id` / `sales_voucher_id`.
- Every `INVOICE_REVERSAL` explicitly references an `order_id` / `sales_voucher_id`.
- There are **zero floating, unapplied on-account customer advances** or bulk multi-invoice payment receipts.

### Conclusion on `ar_allocation` Table
Because of this 1:1 order-specific relationship, open-item balances per invoice can be derived deterministically via a lateral aggregation query summing transactions grouped by `order_id`:
$$\text{Open Amount}(\text{Invoice}) = \text{Invoice Total} - \sum \text{Receipts} - \sum \text{Credit Notes} - \text{Reversal} + \sum \text{Refunds}$$
**A separate `ar_allocation` table is NOT required for the current architecture.**

### Future Trigger Conditions Requiring `ar_allocation`
A dedicated `ar_allocation` subledger table MUST be introduced if the business subsequently introduces any of the following features:
1. Customer advance deposits not tied to an order at the time of payment.
2. Bulk payments where a single payment covers multiple distinct sales invoices.
3. Unapplied customer receipts held on account.
4. Manual allocation/reallocation of credit notes across multiple invoices.
5. Customer-level floating credit balances applied against future invoices.

---

## 12. General Ledger ↔ AR Subledger Reconciliation Design

Reconciliation verifies that the General Ledger control balance matches the customer subledger, explicitly accounting for legitimate guest/unassigned transactions.

### Authoritative Reconciliation Formula
Because guest orders legitimately have `customer_id = NULL`, the reconciliation formula must include guest/unassigned AR:

$$\text{GL 1121 Balance} = \text{Identified-Customer AR} + \text{Guest/Unassigned AR}$$
$$\text{Difference} = (\text{Identified-Customer AR} + \text{Guest/Unassigned AR}) - \text{GL 1121 Balance}$$

### Reconciliation Output Schema
```typescript
export interface ArGlReconciliationResult {
  asOfDate: string;
  branchScope: string;
  branchId: string | null;
  controlAccount: {
    code: "1121";
    name: "Accounts Receivable";
    glBalance: number;
  };
  subledger: {
    identifiedCustomerTotal: number;
    guestUnassignedTotal: number;
    totalControlAmount: number; // identifiedCustomerTotal + guestUnassignedTotal
    customerCount: number;
  };
  reconciliation: {
    difference: number; // totalControlAmount - glBalance
    status: "RECONCILED" | "VARIANCE_DETECTED";
  };
  exceptions: ReconciliationException[];
}
```

### Precise Classification of Reconciliation Exceptions
The reconciliation engine must NOT classify every `NULL customer_id` as an error. Exceptions are classified as follows:

| Classification | Condition | Description | Treatment |
|---|---|---|---|
| **Legitimate Guest Activity** | `customer_id IS NULL` + `reference_type = 'ORDER'` + order is guest | Immediate point-of-sale guest checkout. | **NOT AN EXCEPTION**. Included in `guestUnassignedTotal`. |
| **Missing Customer Dimension** | `customer_id IS NULL` + transaction requires registered customer (e.g. B2B sale, commercial credit) | Control violation; customer dimension was omitted. | **CONTROL EXCEPTION**. Flagged for manual audit. |
| **Integrity Exception** | `customer_id IS NOT NULL` + customer ID does not exist in `public.customer` | Orphan foreign key reference. | **DATABASE INTEGRITY EXCEPTION**. |
| **Duplicate Source Identity** | Multiple active vouchers referencing identical `reference_id` + `reference_type` unexpectedly | Accidental duplicate posting. | **DUPLICATION EXCEPTION**. |
| **Branch Mismatch** | `journal_line.branch_id` differs from `voucher.branch_id` | Cross-branch data leakage. | **BRANCH INTEGRITY EXCEPTION**. |
| **Unbalanced Journal** | Journal entry where $\sum \text{Debits} \ne \sum \text{Credits}$ | Posting engine failure. | **CRITICAL INTEGRITY EXCEPTION**. |
| **Account Misclassification**| Entry posted to group account `1120` instead of leaf `1121` | CoA posting rule violation. | **POSTING ERROR EXCEPTION**. |

---

## 13. Security & RBAC Scoping Matrix

All security must be enforced server-side. Zero trust in client headers (`x-user-role`, `x-user-id`).

| Principal | Role | Scope | Permissions Required |
|---|---|---|---|
| **Super Admin** | `SUPER_ADMIN` | Enterprise (All Branches) | `ACCOUNTING.VIEW`, `ACCOUNTING.EXPORT` |
| **Finance Manager** | `MANAGER` / `FINANCE` | Enterprise (All Branches) | `ACCOUNTING.VIEW`, `ACCOUNTING.EXPORT` |
| **Branch Manager** | `BRANCH_MANAGER` | Authorized Branch Only (`branch_id = actorBranch`) | `ACCOUNTING.VIEW` |
| **Store Staff** | `STAFF` | Authorized Branch Only | `ACCOUNTING.VIEW` |
| **Customer** | `CUSTOMER` | Own Customer Account Only (`customer_id = session.customer_id`) | Storefront Customer Session |

---

## 14. Comprehensive AR State Matrix (22 States)

```
┌─────────────────────────────────┬───────────┬──────────────┬──────────────┬─────────────┬──────────────┬────────────────────────────────────────────────────────┐
│ State Scenario                  │ Statement │ Opening Bal? │ Closing Bal? │ Aged Open?  │ Reconciles?  │ Source of Truth & Handling                             │
├─────────────────────────────────┼───────────┼──────────────┼──────────────┼─────────────┼──────────────┼────────────────────────────────────────────────────────┤
│ 1. Invoice Unpaid               │ YES (1121)│ If < fromDate│ YES (+Debit) │ YES (Age>0) │ YES (Cust)   │ Posted SALES voucher line                              │
│ 2. Invoice Partially Paid       │ YES (1121)│ If < fromDate│ YES (Net Dr) │ YES (Rem Dr)│ YES (Cust)   │ SALES Dr + RECEIPT Cr                                  │
│ 3. Invoice Fully Paid           │ YES (1121)│ If < fromDate│ ZERO         │ NO (Cleared)│ YES (Cust)   │ SALES Dr + RECEIPT Cr = 0                              │
│ 4. Multiple Partial Receipts    │ YES (1121)│ If < fromDate│ YES (Net)    │ YES (Rem)   │ YES (Cust)   │ Sum of RECEIPT credits                                 │
│ 5. COD Unpaid                   │ NO (1122) │ If < fromDate│ YES (1122)   │ YES (COD)   │ YES (1122)   │ Account 1122 Dr; audited in COD Collection Control     │
│ 6. COD Collected (Remitted)     │ NO (1122) │ If < fromDate│ ZERO (1122)  │ NO (Cleared)│ YES (1122)   │ 1122 Dr + 1122 Cr = 0; cleared to Cash 1111            │
│ 7. Full Credit Note             │ YES (1121)│ If < fromDate│ ZERO         │ NO (Cleared)│ YES (Cust)   │ SALES Dr + CREDIT_NOTE Cr = 0                          │
│ 8. Partial Credit Note          │ YES (1121)│ If < fromDate│ YES (Net Dr) │ YES (Rem Dr)│ YES (Cust)   │ Net open invoice amount                                │
│ 9. Credit Note on Paid Order    │ YES (1121)│ If < fromDate│ NEGATIVE (Cr)│ YES (Credit)│ YES (Cust)   │ Customer Credit balance; eligible for refund           │
│ 10. Invoice Reversal            │ YES (1121)│ If < fromDate│ ZERO         │ NO (Cleared)│ YES (Cust)   │ SALES Dr + REVERSAL Cr = 0 (Selective Hybrid Inversion)│
│ 11. Reversal after Receipt      │ YES (1121)│ If < fromDate│ NEGATIVE (Cr)│ YES (Credit)│ YES (Cust)   │ AR negative; eligible for Step 4.6 customer refund     │
│ 12. Reversal after Credit Note  │ BLOCKED   │ N/A          │ N/A          │ N/A         │ N/A          │ Blocked by Step 4.7 credit note precedence guard       │
│ 13. Customer Refund             │ YES (1121)│ If < fromDate│ RESTORED 0   │ NO (Cleared)│ YES (Cust)   │ PAYMENT voucher Dr (1121) clearing customer credit     │
│ 14. Customer Credit Balance     │ YES (1121)│ If < fromDate│ NEGATIVE (Cr)│ YES (Credit)│ YES (Cust)   │ Closing balance is credit                              │
│ 15. Future-Dated Voucher        │ If in span│ NO (< fromDt)│ If <= toDate │ If <= asOf  │ YES          │ Filtered strictly by voucher_date                      │
│ 16. Cancelled Voucher           │ NO        │ NO           │ NO           │ NO          │ YES (Ignored)│ Zero journal lines created                             │
│ 17. Reversed Voucher (Original) │ YES (1121)│ If < fromDate│ OFFSET BY REV│ NO (Cleared)│ YES (Cust)   │ Both original & reversal appear in audit trail         │
│ 18. Historical Prototype Order  │ NO        │ NO           │ NO           │ NO          │ YES (Zero JL)│ Quarantined; 0 journal lines in accounting tables      │
│ 19. Guest Customer              │ NO (Stmt) │ NO           │ NO           │ NO (Guest)  │ YES (Guest)  │ customer_id IS NULL; reconciled in Guest/Unassigned AR │
│ 20. Cross-Branch Customer       │ Scoped    │ Branch/Ent   │ Branch/Ent   │ Branch/Ent  │ YES          │ Filtered by branch_id; Enterprise combines branches    │
│ 21. Missing Customer Dimension  │ Flagged   │ NO           │ NO           │ Unassigned  │ EXCEPTION    │ Flagged as reconciliation control exception            │
│ 22. GL / Subledger Mismatch     │ Reported  │ Surfaces diff│ Surfaces diff│ Surfaces    │ UNRECONCILED │ Surfaced with difference != 0                          │
└─────────────────────────────────┴───────────┴──────────────┴──────────────┴─────────────┴──────────────┴────────────────────────────────────────────────────────┘
```

---

## 15. Comprehensive Gap Classification

### A. ZERO GAPS (Fully Supported by Current Architecture)
1. **Double-Entry AR Posting**: Steps 4.4, 4.5, 4.6, 4.7 produce balanced, immutable GL journal entries on accounts `1121` and `1122`.
2. **Order-Specific Allocation Trail**: Receipts, credit notes, and reversals reference `order_id` and `sales_voucher_id`, enabling exact open-item calculation without an allocation table.
3. **Guest FK Hygiene**: Guest orders enforce `customer_id = NULL`, preventing foreign key constraint violations.
4. **Historical Prototype Quarantine**: Historical orders (173) have zero posted accounting vouchers and will not pollute AR statements.
5. **Option A Authorization**: Reuses canonical permissions `ACCOUNTING.VIEW` and `ACCOUNTING.EXPORT` without permission catalog changes.

### B. IMPLEMENTATION GAPS (To Be Implemented in Step 4.8 Implementation)
1. **AccountsReceivableService**: Service implementing `getCustomerStatement`, `getArAgingSchedule`, and `getArGlReconciliation`.
2. **Deterministic Statement Query**: Query joining `accounting_journal_line`, `accounting_journal_entry`, and `accounting_voucher` using authoritative persisted ordering.
3. **Open-Item Aggregator**: Lateral query aggregating invoice total, receipts, credit notes, reversals, and refunds per order.
4. **Reconciliation Engine**: Engine comparing GL Account 1121 against Identified Customer Subledger + Guest/Unassigned AR.
5. **Server-Side Keyset Pagination**: Keyset pagination for statement queries to prevent memory bottlenecks.

### C. SCHEMA GAPS (Recommended Future Performance Indexes — Non-Blocking for Implementation)
1. **Index `idx_accounting_jline_account_customer`**:
   `CREATE INDEX idx_accounting_jline_account_customer ON public.accounting_journal_line (account_id, customer_id) WHERE customer_id IS NOT NULL;`

### D. ACCOUNTING / BUSINESS POLICY DECISION REQUIRED (Blocking Aging Implementation)
1. **AR Due Date Policy**: No `due_date` column exists on sales tables. **Aging implementation is blocked until business approves one of the candidate rules:**
   - *Prepaid Candidate*: `due_date = voucher_date`
   - *COD Candidate*: `due_date = delivery/fulfillment date`
2. **1122 Reporting Separation**: Locked. Account 1122 is treated as COD Collection Control and is excluded from Trade AR Statements and Aging.

### E. DATA QUALITY GAPS
- **Zero Gaps**: The database has zero accounting vouchers, zero journal lines, and zero orphan records.

### F. SECURITY / RBAC GAPS
- **Zero Gaps**: Canonical `ACCOUNTING.VIEW` and `ACCOUNTING.EXPORT` already exist in `PERMISSION_CATALOG` and `StaffAccessControl`.

---

## 16. Exact Future Implementation Boundary for Step 4.8

When Step 4.8 implementation is separately authorized:
1. Await confirmation of the **Due Date Policy Decision** before coding aging calculations.
2. Create [`frontend/src/lib/types/accounts-receivable.types.ts`](file:///e:/vig/cakes2home-main/cakes2home-main/frontend/src/lib/types/accounts-receivable.types.ts) with statement, aging, and reconciliation types.
3. Create [`frontend/src/lib/services/accounts-receivable.service.ts`](file:///e:/vig/cakes2home-main/cakes2home-main/frontend/src/lib/services/accounts-receivable.service.ts) implementing:
   - `getCustomerStatement(filters)`
   - `getArAgingSchedule(filters)` (using approved due-date policy)
   - `getArGlReconciliation(filters)` (using corrected identified + guest formula)
4. Create dedicated test suite [`frontend/scratch/test_step4_8_ar_statement_aging_reconciliation.js`](file:///e:/vig/cakes2home-main/cakes2home-main/frontend/scratch/test_step4_8_ar_statement_aging_reconciliation.js) testing all 22 states inside an isolated rollback transaction.
5. Execute full upstream regression battery (Steps 4.1–4.7, Security, and 18-point baseline).
6. Update checkpoints.

---

## 17. Strict Halt Confirmation

- **Step 4.8 Corrective Design-Gate Amendment is COMPLETE.**
- **Step 4.8 DESIGN GATE = READY FOR IMPLEMENTATION REVIEW.**
- **Step 4.8 Implementation has NOT started.**
- **Step 4.9 has NOT started.**
- **Zero DDL migrations added.**
- **Zero Git commits or pushes executed.**
- **Database remains 100% pristine.**
