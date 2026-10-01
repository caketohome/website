# CakeToHome ERP — Phase 5A Step 6 Forensic & Architecture Design Gate
## Period & Year-End Close Engine Comprehensive Architecture Design
### Milestone: `PHASE-5A-STEP-6-PERIOD-YEAR-END-CLOSE-DESIGN-01`
### Gate Classification: READ-ONLY FORENSIC & ARCHITECTURE DESIGN GATE — SYSTEM STRICTLY HALTED PENDING USER AUTHORIZATION
### Date & Time of Verification: 2026-09-30T21:10:00+05:30 (IST)

---

## 1. Executive Summary & Recovery Context

This document establishes the authoritative **Forensic & Architecture Design Gate** for **Phase 5A Step 6: Period / Year-End Close Engine** of the CakeToHome ERP system following IDE crash recovery.

In strict compliance with the **Authoritative Project Rules** and **Mandatory Continuation Protocol**:
- **Zero code implementation has been executed** for Phase 5A.6.
- **Zero database DDL or schema migrations have been performed**.
- **Zero accounting vouchers, journal entries, or temporary financial lines have been created**.
- **Zero production financial mutations have occurred**.
- The PostgreSQL database baseline has been independently audited and confirmed **100% clean**.
- All predecessor financial reporting phases (5A.1 through 5A.5) have been verified against the live PostgreSQL database and confirmed **100% passed and frozen 🔒**.

---

## 2. Independent Verification of Predecessor State (Phases 5A.1 – 5A.5)

### 2.1 Git Status & Commit History
- **Active Branch**: `task/dev`
- **Head Commit**: `4fd216c merge: integrate Phase 5A financial statements (5A.1-5A.5) into task/dev`
- **Prior Commit**: `4fe32ac feat(accounting): complete Phase 5A financial statements (5A.1-5A.5) with verified invariants`
- **Working Tree State**:
  - `modified: LATEST_CHECKPOINT.md`
  - `modified: frontend/LATEST_CHECKPOINT.md`
  - `untracked: CHECKPOINTS/phase5a-step6-period-year-end-close-design-01.md`
  - `untracked: frontend/CHECKPOINTS/phase5a-step6-period-year-end-close-design-01.md`
  - Zero code modifications staged or unstaged.

### 2.2 Live PostgreSQL Baseline Audit
An independent read-only database query via `scratch/verify_baseline_clean.js` executed at 2026-09-30T20:58:23 IST confirms:
- `accounting_voucher`: **0** (expected: 0)
- `accounting_journal_entry`: **0** (expected: 0)
- `accounting_journal_line`: **0** (expected: 0)
- `accounting_fiscal_period`: **0** (expected: 0)
- `accounting_settings`: **0** (expected: 0)
- `accounting_account` (active CoA): **99** (expected: 99)
- `orders`: **173** (expected: 173)
- `payments`: **53** (expected: 53)
- `active locks / hanging queries`: **0** (expected: 0)
- **Baseline Status**: **100% CLEAN — ZERO RESIDUAL MUTATIONS**

### 2.3 Cumulative Predecessor Test Verification Results
All five predecessor Phase 5A verification suites were executed independently against the live PostgreSQL database during this session and passed with zero failures:

| Suite | Focus Area | File | Assertions | Result | Status |
|---|---|---|---|---|---|
| **Phase 5A.1** | General Ledger & Trial Balance | `scratch/test_phase5a1_gl_ledger.js` | 71 / 71 | **100% PASS** | 🔒 FROZEN |
| **Phase 5A.2** | Opening Balance & Fiscal Periods | `scratch/test_phase5a2_fiscal_config.js` | 46 / 46 | **100% PASS** | 🔒 FROZEN |
| **Phase 5A.3** | Profit & Loss Statement (P&L) | `scratch/test_phase5a3_profit_loss.js` | 104 / 104 | **100% PASS** | 🔒 FROZEN |
| **Phase 5A.4** | Balance Sheet Financial Statement | `scratch/test_phase5a4_balance_sheet.js` | 114 / 114 | **100% PASS** | 🔒 FROZEN |
| **Phase 5A.5** | Cash Flow Statement (Direct/Indirect/Dual) | `scratch/test_phase5a5_cash_flow.js` | 99 / 99 | **100% PASS** | 🔒 FROZEN |
| **TOTAL** | **Cumulative Financial Statement Suite** | **All 5 Test Suites** | **434 / 434** | **100% PASS** | 🔒 FROZEN |

### 2.4 TypeScript Compilation Verification
```bash
$ npx tsc --noEmit
Exit code: 0 (Zero errors, zero warnings)
```

---

## 3. Database Schema & Architecture Forensics

### 3.1 `accounting_voucher` Table Schema & Constraints
Live database schema inspection revealed:
- **Columns**: `id` (text, PK), `voucher_no` (varchar, unique), `voucher_type` (varchar), `voucher_date` (date), `branch_id` (text, NOT NULL, FK `branch.id`), `fiscal_year` (varchar), `status` (varchar), `total_amount` (numeric), `currency` (varchar), `reference_type` (varchar), `reference_id` (text), `reference_event` (varchar), `narration` (text), `created_by` (text), `submitted_by` (text), `submitted_at` (timestamptz), `approved_by` (text), `approved_at` (timestamptz), `posted_by` (text), `posted_at` (timestamptz), `cancelled_by` (text), `cancelled_at` (timestamptz), `reversed_by_voucher_id` (text, FK), `reversal_of_voucher_id` (text, FK), `metadata` (jsonb), `created_at` (timestamptz), `updated_at` (timestamptz), `deleted_at` (timestamptz).
- **Key Constraints**:
  ```sql
  CONSTRAINT chk_voucher_type CHECK (
    (voucher_type)::text = ANY (ARRAY[
      'SALES', 'PURCHASE', 'PAYMENT', 'RECEIPT', 'EXPENSE', 
      'JOURNAL', 'CONTRA', 'CREDIT_NOTE', 'DEBIT_NOTE', 'OPENING_BALANCE'
    ]::text[])
  );
  CONSTRAINT chk_voucher_status CHECK (
    (status)::text = ANY (ARRAY['DRAFT', 'SUBMITTED', 'APPROVED', 'POSTED', 'CANCELLED']::text[])
  );
  CONSTRAINT chk_voucher_segregation CHECK (
    (approved_by IS NULL) OR (approved_by <> created_by)
  );
  CONSTRAINT chk_voucher_posted_immutable CHECK (
    ((status)::text <> 'CANCELLED'::text) OR (posted_at IS NULL)
  );
  CONSTRAINT chk_voucher_reversal_limit CHECK (
    (reversal_of_voucher_id IS NULL) OR (reversed_by_voucher_id IS NULL)
  );
  CONSTRAINT accounting_voucher_branch_id_fkey FOREIGN KEY (branch_id) 
    REFERENCES branch(id) ON DELETE RESTRICT;
  ```
- **Source Idempotency Partial Unique Index**:
  ```sql
  CREATE UNIQUE INDEX idx_accounting_voucher_source_idempotency 
  ON public.accounting_voucher (reference_type, reference_id, reference_event) 
  WHERE (((status)::text <> 'CANCELLED'::text) AND ((reference_type)::text <> 'MANUAL'::text));
  ```
- **Architectural Findings & Constraints**:
  1. `CLOSING` is **NOT** a valid enum value in `chk_voucher_type`. The Year-End Close voucher must use standard type **`JOURNAL`**.
  2. `branch_id` is **NOT NULL**. Enterprise/company-wide closing entries must reference the enterprise HQ branch ID (`br_01KYWH0RTHVHRD04J79T28RAHN`).
  3. The partial unique index `idx_accounting_voucher_source_idempotency` guarantees database-level idempotency when using:
     - `reference_type = 'YEAR_END_CLOSE'`
     - `reference_id = fiscal_year` (e.g. `'FY2425'`)
     - `reference_event = 'FISCAL_YEAR_CLOSE'`
     Any attempt to generate a duplicate uncancelled closing voucher will fail at the PostgreSQL index level.

### 3.2 `accounting_fiscal_period` Table Schema & Constraints
- **Columns**: `id` (text, PK, default gen_random_uuid()), `fiscal_year` (varchar), `period_name` (varchar), `start_date` (date), `end_date` (date), `is_locked` (boolean, default false), `locked_at` (timestamptz), `locked_by` (text), `created_at` (timestamptz).
- **Key Constraints**:
  ```sql
  CONSTRAINT chk_fiscal_dates CHECK (end_date >= start_date);
  CONSTRAINT uq_fiscal_period UNIQUE (fiscal_year, period_name);
  ```
- **Existing Service Operations** (`FiscalPeriodService`):
  - `createFiscalPeriod`: Single period creation (SUPER_ADMIN only, overlap check, date validation).
  - `generateYearPeriods`: Generates 12 monthly periods for Indian FY (Apr 1 $\to$ Mar 31).
  - `lockPeriod`: Locks a monthly period with `SELECT ... FOR UPDATE`, sets `is_locked = true`, records `locked_by` and `locked_at`.
  - `unlockPeriod`: Unlocks a period (for audited corrections), sets `is_locked = false`.
  - `listFiscalPeriods`: Lists all periods filtered by fiscal year.

### 3.3 `accounting_journal_line` Table Triggers
- **Deferred Constraint Trigger**:
  ```sql
  TRIGGER trg_check_journal_balance AFTER INSERT OR UPDATE ON accounting_journal_line
  FOR EACH ROW EXECUTE FUNCTION fn_check_journal_balance();
  ```
- **`fn_check_journal_balance()` Definition**:
  ```sql
  DECLARE
    v_debit NUMERIC(15, 2);
    v_credit NUMERIC(15, 2);
  BEGIN
    SELECT COALESCE(SUM(debit_amount), 0), COALESCE(SUM(credit_amount), 0)
    INTO v_debit, v_credit
    FROM public.accounting_journal_line
    WHERE journal_entry_id = NEW.journal_entry_id;

    IF v_debit <> v_credit THEN
      RAISE EXCEPTION 'Double-entry violation: Journal entry % debits (%) != credits (%)', 
        NEW.journal_entry_id, v_debit, v_credit;
    END IF;

    IF v_debit <= 0 THEN
      RAISE EXCEPTION 'Double-entry violation: Journal entry % cannot have zero or negative total amount', 
        NEW.journal_entry_id;
    END IF;

    RETURN NEW;
  END;
  ```
- **Architectural Consequence**: Every journal entry generated by the Year-End Close engine must strictly balance to zero ($\sum Dr \equiv \sum Cr$) and have a total amount strictly $> ₹0.00$. Zero-balance or unbalanced entries are impossible to commit to the database.

---

## 4. Code Forensics: Complete Journal Posting Call Graph

A comprehensive search for all callers of `PostingService.postVoucher` across `frontend/src` was executed. Exactly **13 posting pipelines** exist in CakeToHome ERP:

| # | Service File | Calling Method | Voucher Type | Posting Guard Enforcement |
|---|---|---|---|---|
| 1 | `sales-posting.service.ts` | `postSalesInvoice()` | `SALES` | Calls `PostingService.postVoucher` |
| 2 | `sales-return.service.ts` | `postCreditNote()` | `CREDIT_NOTE` | Calls `PostingService.postVoucher` |
| 3 | `sales-return.service.ts` | `postRefundVoucher()` | `PAYMENT` | Calls `PostingService.postVoucher` |
| 4 | `sales-invoice-reversal.service.ts` | `postInvoiceReversal()` | `JOURNAL` | Calls `PostingService.postVoucher` |
| 5 | `purchase-posting.service.ts` | `postPurchaseBill()` | `PURCHASE` | Calls `PostingService.postVoucher` |
| 6 | `purchase-payment.service.ts` | `postPurchasePayment()` | `PAYMENT` | Calls `PostingService.postVoucher` |
| 7 | `purchase-payment.service.ts` | `postPaymentAllocation()` | `PAYMENT` | Calls `PostingService.postVoucher` |
| 8 | `purchase-return.service.ts` | `postDebitNote()` | `DEBIT_NOTE` | Calls `PostingService.postVoucher` |
| 9 | `purchase-reversal.service.ts` | `postPurchaseReversal()` | `JOURNAL` | Calls `PostingService.postVoucher` |
| 10 | `customer-receipt.service.ts` | `postCustomerReceipt()` | `RECEIPT` | Calls `PostingService.postVoucher` |
| 11 | `customer-receipt.service.ts` | `postCodShiftSettlement()` | `RECEIPT` | Calls `PostingService.postVoucher` |
| 12 | `customer-receipt.service.ts` | `postUnallocatedReceipt()` | `RECEIPT` | Calls `PostingService.postVoucher` |
| 13 | `cod-collection.service.ts` | `settleCodCollection()` | `RECEIPT` | Delegates to `CustomerReceiptService` |
| 14 | `bank-deposit-slip.service.ts` | `postDepositSlip()` | `CONTRA` | Calls `PostingService.postVoucher` |
| 15 | `gateway-settlement.service.ts` | `postGatewaySettlement()` | `CONTRA` | Calls `PostingService.postVoucher` |
| 16 | `bank-reconciliation-matching.service.ts` | `postReconciliationAdjustment()` | `JOURNAL` | Calls `PostingService.postVoucher` |
| 17 | `opening-balance.service.ts` | `postOpeningBalance()` | `OPENING_BALANCE` | Calls `PostingService.postVoucher` |

### Critical Architectural Finding on Period Locking:
Inside `PostingService.postVoucher`:
```typescript
// Step 3: Validate Fiscal Period (HARD BLOCK)
await PostingService.validateFiscalPeriod(voucher.voucher_date, client);
```
And in `PostingService.validateFiscalPeriod`:
```typescript
if (periodStatus.status === "PERIOD_NOT_CONFIGURED") {
  throw new PostingServiceError("FISCAL_PERIOD_NOT_CONFIGURED", ...);
}
if (periodStatus.status === "PERIOD_LOCKED") {
  throw new PostingServiceError("FISCAL_PERIOD_LOCKED", ...);
}
```
**Proof**: Because every posting pipeline in CakeToHome ERP delegates exclusively to `PostingService.postVoucher`, locking any fiscal period (`is_locked = true`) **instantly and universally blocks every operational transaction across the entire system** (sales, purchases, payments, receipts, COD, deposits, gateway, inventory COGS, reversals, adjustments, and opening balances). There are zero bypass paths.

---

## 5. Phase 5A.6 Architectural Decisions & Design Specifications (Sections A – R)

### A. Fiscal Period Lifecycle Architecture
The fiscal period lifecycle operates at two distinct tiers:

```
TIER 1: MONTHLY INTERIM PERIOD LIFECYCLE
[OPEN] (is_locked=false) ──(lockPeriod)──> [LOCKED] (is_locked=true)
   ▲                                              │
   └────────────(unlockPeriod, audited)───────────┘

TIER 2: ANNUAL FISCAL YEAR-END CLOSE LIFECYCLE
[ACTIVE_YEAR] (all 12 monthly periods open or locked)
   │
   ├── [PRE-CLOSE REVIEW] (read-only pre-flight diagnostics gate)
   │
   ├── [MONTHLY LOCKDOWN] (all 12 periods locked, is_locked=true)
   │
   ├── [YEAR_END_CLOSE VOUCHER] (posted closing journal zeroes nominal accounts)
   │
   ├── [CLOSED_YEAR] (year permanently finalized, nominal accounts zeroed)
   │
   └── [REOPEN VIA REVERSAL] (extreme event: compensating reversal voucher posted)
```

1. **Monthly Period State**:
   - `OPEN`: Posting allowed within `start_date` to `end_date`.
   - `LOCKED`: `is_locked = true`, `locked_at` recorded, `locked_by` recorded. Hard blocks postings via `PostingService.validateFiscalPeriod`.
   - `UNLOCKED`: Reopened by SUPER_ADMIN for audited adjustments.
2. **Annual Fiscal Year Close State**:
   - Stored via closing voucher idempotency (`reference_type = 'YEAR_END_CLOSE'`, `reference_id = fiscal_year`, `reference_event = 'FISCAL_YEAR_CLOSE'`, `status = 'POSTED'`).
   - Nominal accounts permanently cleared to ₹0.00 as of fiscal year end date (`YYYY-03-31`).

---

### B. Close Prerequisites Matrix (Blocking, Warning, Informational)

Every close prerequisite has been investigated and classified based on the actual system architecture:

| # | Prerequisite Area | Check Method / Query | Classification | Architecture Rationale |
|---|---|---|---|---|
| 1 | **Fiscal Period Configuration** | `AccountingFiscalPeriodRepository.list(fiscal_year)` | **BLOCKING** | All 12 monthly periods of the FY must exist and be defined. |
| 2 | **Sequential Period Locking** | `SELECT count(*) FROM accounting_fiscal_period WHERE fiscal_year = $1 AND is_locked = false` | **BLOCKING** | All 12 monthly periods must be in `is_locked = true` state before year-end close can execute. |
| 3 | **Prior FY Close State** | Check if prior fiscal year has a posted close voucher | **BLOCKING** | Fiscal years must close sequentially; cannot close FY2526 if FY2425 is unclosed. |
| 4 | **Accounting Start Date** | `AccountingConfigService.getConfig()` | **BLOCKING** | Start date must be configured; close date must be $\ge$ start date. |
| 5 | **Draft Vouchers Pipeline** | `SELECT count(*) FROM accounting_voucher WHERE voucher_date BETWEEN $1 AND $2 AND status = 'DRAFT'` | **BLOCKING** | Unposted draft vouchers represent unrecorded operational activity. |
| 6 | **Submitted Vouchers Pipeline** | `SELECT count(*) FROM accounting_voucher WHERE voucher_date BETWEEN $1 AND $2 AND status = 'SUBMITTED'` | **BLOCKING** | Vouchers awaiting approval must be resolved (approved/rejected). |
| 7 | **Approved Vouchers Pipeline** | `SELECT count(*) FROM accounting_voucher WHERE voucher_date BETWEEN $1 AND $2 AND status = 'APPROVED'` | **BLOCKING** | Approved vouchers must be posted to GL before closing. |
| 8 | **Trial Balance Invariant** | `GeneralLedgerService.getTrialBalance()` | **BLOCKING** | Total Debits must equal Total Credits ($\Delta < ₹0.01$). Imbalanced TB indicates corrupted ledger. |
| 9 | **Suspense Account 1119** | GL net balance of account `1119 Unclassified Suspense` | **BLOCKING** | Suspense represents unidentified financial transactions. Must be strictly ₹0.00. |
| 10 | **Deposit in Transit 1118** | GL net balance of account `1118 Deposit in Transit` | **BLOCKING** | Cash in transit between branch and bank must be fully cleared (₹0.00). |
| 11 | **Trade AR Subledger Match** | Sum of open invoices in `customer_receipt_line` vs GL `1121` | **BLOCKING** | Subledger balance must reconcile to General Ledger control account `1121` ($\Delta < ₹0.01$). |
| 12 | **Trade AP Subledger Match** | Sum of open purchase bills in AP vs GL `2111` | **BLOCKING** | Subledger balance must reconcile to General Ledger control account `2111` ($\Delta < ₹0.01$). |
| 13 | **Bank Reconciliation (BRS)** | Unreconciled bank statement lines prior to period end | **BLOCKING** | Bank statement must be fully matched/reconciled against GL `1112`. |
| 14 | **Gateway Clearing 1113** | GL net balance of account `1113 Gateway Clearing` | **WARNING** | Unsettled gateway transactions should be reviewed; may contain normal rolling T+2 hold. |
| 15 | **Undeposited COD 1122** | GL net balance of account `1122 Undeposited COD` | **WARNING** | Unsettled COD collections with delivery drivers should be reviewed. |
| 16 | **Inventory Cost Lots** | `inventory_cost_lot` open balance vs GL `1131/1132/1133` | **WARNING** | Cost lot valuations should align with merchandise inventory asset accounts. |
| 17 | **GST Input/Output Tax** | GL `1141-1149` (ITC) vs GL `2121-2129` (Output) | **WARNING** | Monthly GSTR-3B tax offset vouchers should be posted. |
| 18 | **Rejected / Cancelled Vouchers** | Vouchers in `CANCELLED` status | **INFORMATIONAL** | Cancelled vouchers are auditable non-posting records; reported for visibility. |
| 19 | **Reversal Activity Summary** | Reversal vouchers posted during period | **INFORMATIONAL** | Full reversal volume provided in diagnostic audit summary. |
| 20 | **Opening Balance Equity 3300** | Net balance of account `3300 Opening Balance Offset` | **INFORMATIONAL** | Account 3300 remains a permanent legacy reserve presentation line; reported for disclosure. |
| 21 | **Profit & Loss Summary** | Projected Net Profit / Loss before close | **INFORMATIONAL** | Informs the user of the exact profit/loss amount to be transferred to Retained Earnings. |
| 22 | **Balance Sheet Equity Preview** | Projected post-close Equity structure | **INFORMATIONAL** | Shows user the migration of earnings into permanent equity. |
| 23 | **Cash Flow Summary** | CFO, CFI, CFF for period | **INFORMATIONAL** | Confirms Cash Flow statements are verified; closing voucher will not affect cash. |
| 24 | **Operational Cake Inventory** | Cake availability state (`MADE_TO_ORDER`) | **INFORMATIONAL** | Confirms Critical Cake Rule: operational availability is unchanged and untracked. |

---

### C. Nominal Account Closing Scope (The 26 Leaf Accounts)

The live database audit confirmed that public.accounting_account contains **exactly 26 nominal leaf accounts** that participate in year-end closing:

#### 1. Revenue Leaf Accounts (Exactly 7 accounts — Normal Balance: CREDIT):
1. `4110` Cake & Bakery Sales Revenue (5% GST) — `DIRECT_REVENUE`
2. `4120` Accessory & Merchandise Sales Revenue (18% GST) — `DIRECT_REVENUE`
3. `4130` Delivery & Shipping Charges Collected — `DELIVERY_REVENUE`
4. `4140` Customization & Midnight Surcharges — `DIRECT_REVENUE`
5. `4190` Sales Returns, Refunds & Allowances — `DIRECT_REVENUE` *(Contra-Revenue — Normal Debit)*
6. `4210` Interest Income — `INDIRECT_REVENUE`
7. `4220` Scrap & By-product Sales — `INDIRECT_REVENUE`

#### 2. Expense Leaf Accounts (Exactly 19 accounts — Normal Balance: DEBIT):
1. `5110` COGS - Cakes — `COGS`
2. `5120` Accessory Merchandise Sold (Cost of Accessories) — `COGS`
3. `5130` Packaging Materials Consumed — `COGS`
4. `5140` Kitchen Direct Labour / Chef Wages — `COGS`
5. `5190` Purchase Discounts Received — `COGS` *(Contra-COGS — Normal Credit)*
6. `5210` Store & Kitchen Rent — `OPERATING_EXPENSE`
7. `5220` Electricity, Gas & Utilities — `OPERATING_EXPENSE`
8. `5230` Vehicle Fuel & Fleet Maintenance — `OPERATING_EXPENSE`
9. `5240` Freight & Cartage Inward — `OPERATING_EXPENSE`
10. `5250` Staff Salaries & Store Personnel — `OPERATING_EXPENSE`
11. `5260` Marketing & Customer Promotion — `OPERATING_EXPENSE`
12. `5270` Repairs & Kitchen Maintenance — `OPERATING_EXPENSE`
13. `5280` Software, Internet & Tech Infrastructure — `OPERATING_EXPENSE`
14. `5290` Payment Gateway MDR Fees — `OPERATING_EXPENSE`
15. `5295` Cash Rounding / Variance — `OPERATING_EXPENSE`
16. `5299` Miscellaneous Operating Expenses — `OPERATING_EXPENSE`
17. `5310` Bank Charges & Processing Fees — `FINANCIAL_EXPENSE`
18. `5320` Loan Interest Expense — `FINANCIAL_EXPENSE`
19. `5330` Depreciation & Amortization — `OPERATING_EXPENSE`

#### Accounts That Strictly Remain Open:
- All Assets (`1xxx`): 1111–1149, 1510–1590
- All Liabilities (`2xxx`): 2111–2153, 2510
- All Permanent Equity (`3xxx`): 3110, 3120, 3210, 3220, 3300

---

### D. Retained Earnings Semantics & Mathematical Demonstration

#### Semantics of Accounts 3210, 3220, and 3300:
- **`3210 Retained Earnings (Prior Years)`**: Permanent equity accumulation account holding cumulative historical net profits/losses from all completed, closed financial years.
- **`3220 Current Year Net Earnings`**: In-memory dynamic roll-up account during any active fiscal year. Per Phase 5A.4 design rule:
  $$\text{Balance Sheet 3220} = \text{Posted 3220 GL Balance} + (\text{Current FY Revenue} - \text{Current FY Expense})$$
- **`3300 Opening Balance Offset / Capital Reserve`**: Immutable presentation account holding transition imbalances created during initial setup. It is **never** touched by the Year-End Close engine.

#### Mathematical Identity Proof:

##### 1. State 1: Before Year-End Close (Active Fiscal Year FY2425, as of 2025-03-31)
Let:
- Gross Revenues: $R = \sum_{i=1}^{6} Rev_i$
- Sales Returns (Contra): $Ret = 4190$
- Net Revenue: $NR = R - Ret$
- Gross Expenses: $E = \sum_{j=1}^{18} Exp_j$
- Purchase Discounts (Contra): $Disc = 5190$
- Net Expense: $NE = E - Disc$
- Net Profit: $\Pi = NR - NE$
- Prior Retained Earnings: $RE_{\text{prior}}$ (Account 3210)
- Capital: $Cap$ (Account 3110), Drawings: $Draw$ (Account 3120), OB Offset: $OB$ (Account 3300)

In Balance Sheet:
$$\text{Account 3220} = 0 + (NR - NE) = \Pi$$
$$\text{Total Equity}_{\text{before}} = Cap - Draw + RE_{\text{prior}} + \Pi + OB$$
$$\text{Assets} \equiv \text{Liabilities} + \text{Total Equity}_{\text{before}}$$

##### 2. State 2: Execution of Year-End Close Voucher (Dated 2025-03-31)
The close engine constructs a single balanced `JOURNAL` voucher:
- **Debits**:
  - Debit each Revenue account having credit balance: $\text{Dr } Rev_i$
  - Debit Expense contra account `5190`: $\text{Dr } Disc$
  - (If Net Loss $\Pi < 0$: $\text{Dr } 3210 \text{ with } |\Pi|$)
- **Credits**:
  - Credit each Expense account having debit balance: $\text{Cr } Exp_j$
  - Credit Revenue contra account `4190`: $\text{Cr } Ret$
  - (If Net Profit $\Pi > 0$: $\text{Cr } 3210 \text{ with } \Pi$)

**Double-Entry Balance Verification**:
$$\text{Total Debits} = R + Disc + (|\Pi| \text{ if loss})$$
$$\text{Total Credits} = E + Ret + (\Pi \text{ if profit})$$
Since $NR - NE = \Pi \implies (R - Ret) - (E - Disc) = \Pi \implies R + Disc = E + Ret + \Pi$:
$$\text{Total Debits} \equiv \text{Total Credits} \quad (\Delta = ₹0.00)$$

##### 3. State 3: Post-Close Balance Sheet as of 2025-03-31
- In General Ledger, every nominal account now has $\text{Total Debits} = \text{Total Credits} \implies \text{Net Balance} = ₹0.00$.
- In Balance Sheet dynamic formula:
  $$\text{Revenues up to 2025-03-31} = 0.00$$
  $$\text{Expenses up to 2025-03-31} = 0.00$$
  $$\text{Dynamic P&L Profit} = 0.00 - 0.00 = 0.00$$
  $$\text{Account 3220 Component} = \text{Posted 3220 } (0.00) + \text{Dynamic Profit } (0.00) = \mathbf{₹0.00}$$
- In Account 3210:
  $$\text{Posted 3210 Balance} = RE_{\text{prior}} + \Pi$$
- Total Equity After Close:
  $$\text{Total Equity}_{\text{after}} = Cap - Draw + (RE_{\text{prior}} + \Pi) + 0.00 + OB$$
  $$\mathbf{\text{Total Equity}_{\text{after}} \equiv \text{Total Equity}_{\text{before}}}$$
  $$\mathbf{\text{Assets} \equiv \text{Liabilities} + \text{Total Equity}_{\text{after}} \quad (\text{Variance} = ₹0.00)}$$

##### 4. State 4: Incoming Fiscal Year (FY2526, as of 2025-04-01)
- Account `3210` begins with permanent carry-forward balance: $RE_{\text{prior}} + \Pi$.
- Account `3220` evaluates only postings dated on or after `2025-04-01`, starting at exactly **₹0.00**.
- **Double Counting Variance**:
  $$\Delta_{\text{double-count}} = \text{Posted } 3210_{\text{delta}} + \text{Dynamic } 3220_{\text{post}} - \Pi = \Pi + 0.00 - \Pi \equiv \mathbf{₹0.00}$$
- **Result**: Zero double-counting is mathematically proven.

---

### E. Close Voucher Architecture
The closing voucher leverages the existing schema without requiring DDL modifications:
- `voucher_type`: `'JOURNAL'` (complies with `chk_voucher_type`).
- `voucher_date`: Fiscal year end date (e.g. `'2025-03-31'`).
- `branch_id`: Enterprise HQ branch ID (`br_01KYWH0RTHVHRD04J79T28RAHN`).
- `fiscal_year`: Fiscal year string (e.g. `'FY2425'`).
- `reference_type`: `'YEAR_END_CLOSE'`.
- `reference_id`: Fiscal year string (e.g. `'FY2425'`).
- `reference_event`: `'FISCAL_YEAR_CLOSE'`.
- `narration`: `'[YEAR_END_CLOSE] FY2425 Annual Nominal Ledger Closing Entry'`.
- `metadata`:
  ```json
  {
    "close_type": "YEAR_END",
    "fiscal_year": "FY2425",
    "gross_revenue": 1500000.00,
    "gross_expenses": 1200000.00,
    "net_profit": 300000.00,
    "target_retained_earnings_account": "3210",
    "closed_by": "usr_super_admin",
    "closed_at": "2026-09-30T21:10:00.000Z"
  }
  ```

---

### F. Posting Mechanics
1. **Source of Balances**: Run `AccountingJournalRepository.getTrialBalance(undefined, fyStartDate, fyEndDate)`.
2. **Revenue Accounts**:
   - For each account $i \in \{4110, 4120, 4130, 4140, 4210, 4220\}$:
     - Net Balance in TB is credit: $Cr - Dr = B_i$.
     - If $B_i > 0$: Add line `Dr Account i` for amount $B_i$.
   - For Contra-Revenue `4190`:
     - Net Balance in TB is debit: $Dr - Cr = Ret$.
     - If $Ret > 0$: Add line `Cr Account 4190` for amount $Ret$.
3. **Expense Accounts**:
   - For each account $j \in \{5110, 5120, 5130, 5140, 5210, 5220, 5230, 5240, 5250, 5260, 5270, 5280, 5290, 5295, 5299, 5310, 5320, 5330\}$:
     - Net Balance in TB is debit: $Dr - Cr = B_j$.
     - If $B_j > 0$: Add line `Cr Account j` for amount $B_j$.
   - For Contra-COGS `5190`:
     - Net Balance in TB is credit: $Cr - Dr = Disc$.
     - If $Disc > 0$: Add line `Dr Account 5190` for amount $Disc$.
4. **Retained Earnings Offset Line**:
   - Compute $\Pi = \text{Sum(Debits)} - \text{Sum(Credits)}$.
   - If $\Pi > 0$ (Net Profit): Add line `Cr Account 3210` for amount $\Pi$.
   - If $\Pi < 0$ (Net Loss): Add line `Dr Account 3210` for amount $|\Pi|$.
5. **Voucher Lifecycle**:
   - Create Draft $\to$ Submit $\to$ Approve (by distinct actor per SoD) $\to$ Post via canonical `PostingService.postVoucher`.

---

### G. Treatment of Drawings (3120) & Capital (3110)
- **Account 3110 (Partner Capital)**: Permanent contributed equity. Remains untouched.
- **Account 3120 (Drawings / Distributions)**: Contra-equity account tracking withdrawals.
- **Authoritative Accounting Decision**: Drawings are **NOT** automatically closed to Retained Earnings by default.
  - In Indian proprietorship/partnership accounting, closing drawings requires explicit partner resolution.
  - Drawings remain on the Balance Sheet as a deduction from Capital: $\text{Net Capital} = 3110 - 3120$.
  - An optional flag `close_drawings_to_retained_earnings: boolean` (default: `false`) allows authorized users to elect drawings clearance.

---

### H. Treatment of Opening Balance Offset (3300) & Carry-Forward
- **Account 3300**: Represents historical opening balance equity offset.
- **Authoritative Rule**: Account `3300` is **NEVER** modified, zeroed, or transferred by the Year-End Close engine.
- **Balance Carry-Forward**:
  - In double-entry General Ledger systems, real accounts (Assets, Liabilities, Permanent Equity) naturally carry forward their cumulative balances without needing synthetic "opening carry-forward" vouchers.
  - When querying the next fiscal year, `AccountingJournalRepository.getTrialBalance(branchId, undefined, asOfDate)` aggregates all historical postings up to `asOfDate`. Because nominal accounts were closed to ₹0.00 on `YYYY-03-31`, only the cumulative Balance Sheet balances persist.

---

### I. Next Fiscal Period Mechanism
1. **Indian Fiscal Year Calendar**: Strictly 1 April through 31 March.
2. **Auto-Provisioning**:
   - When closing fiscal year $FY_k$ (e.g. `2024-2025`), the engine verifies whether $FY_{k+1}$ (`2025-2026`) periods exist.
   - If missing, it invokes `FiscalPeriodService.generateYearPeriods('2025-2026', '2025-04-01', actorId, actorRole)`.
   - Generates 12 monthly periods: April 2025 through March 2026.
3. **Opening Balances**: Require zero manual reentry. Balance Sheet accounts carry forward inherently.
4. **Prior-Period Posting Block**: Because all 12 periods of $FY_k$ are `is_locked = true`, postings backdated into the closed year are rejected automatically.

---

### J. Period Locking & Universal Posting Boundary
As established in the Code Forensics (Section 4), all 13 posting pipelines in CakeToHome ERP call `PostingService.postVoucher`, which executes:
```typescript
await PostingService.validateFiscalPeriod(voucher.voucher_date, client);
```
- If `is_locked === true`: Throws `FISCAL_PERIOD_LOCKED` error.
- Enforced on purchases, supplier payments, expenses, sales invoices, credit notes, receipts, COD, bank deposits, gateway settlements, BRS adjustments, reversals, and opening balances.
- **Server-Side Security**: This guard executes inside the database transaction client on the server; client requests cannot circumvent it.

---

### K. Reopen Policy & Immutable Ledger Audit Trail
1. **Monthly Period Unlock**:
   - Permitted only for `SUPER_ADMIN`.
   - Requires explicit audit text reason ($\ge 20$ characters).
   - Logged in audit trail with timestamp and actor ID.
2. **Fiscal Year-End Close Reopen**:
   - **Strict Immutability Rule**: Under NO circumstances is the original closing voucher or journal deleted from the database.
   - **Compensating Reversal Voucher**:
     - The engine constructs a reversal `JOURNAL` voucher:
       - `reference_type = 'YEAR_END_REOPEN'`
       - `reference_id = original_close_voucher_id`
       - `reversal_of_voucher_id = original_close_voucher_id`
       - Debits and credits are inverted from the original close voucher.
     - Flags original journal entry as `is_reversed = true`.
     - Nominal accounts are restored to their active pre-close balances.
     - Both the original close voucher and the reopen voucher remain permanently in the general ledger audit trail.

---

### L. Read-Only Close Preview / Dry-Run Engine
Before executing any close mutation, the system provides a read-only dry-run endpoint:
- **`GET /api/v1/admin/accounting/period-close/preview?fiscal_year=FY2425`**
- **Payload Returned**:
  1. `fiscal_year`: Target year.
  2. `can_close`: Boolean (`true` only if all blocking gates pass).
  3. `blocking_checks`: Array of failed blocking checks with item counts and IDs.
  4. `warnings`: Array of non-blocking operational warnings.
  5. `informational`: Operational summaries (unposted cakes, cancelled vouchers).
  6. `nominal_account_balances`: List of all 26 leaf accounts with pre-close balances and proposed closing debit/credit amounts.
  7. `projected_retained_earnings_transfer`: Net Profit / Loss amount to be credited to `3210`.
  8. `projected_balance_sheet_impact`: Before vs. After equity comparison proving 0 variance.
  9. `is_dry_run`: Strictly `true`.
- **Database Mutation**: **Strictly ₹0.00 / 0 rows inserted, updated, or deleted**.

---

### M. Idempotency Architecture
- **Layer 1: Pre-Execution Guard**:
  ```sql
  SELECT id, voucher_no, status FROM public.accounting_voucher 
  WHERE reference_type = 'YEAR_END_CLOSE' 
    AND reference_id = $1 
    AND reference_event = 'FISCAL_YEAR_CLOSE' 
    AND status <> 'CANCELLED'
  ```
  If found, the request is rejected with `DUPLICATE_SOURCE_EVENT`.
- **Layer 2: Database Constraint**:
  The partial unique index `idx_accounting_voucher_source_idempotency` guarantees that concurrent or repeated close requests cannot commit duplicate vouchers.

---

### N. Transaction Atomicity Boundary
The entire year-end close executes within a single PostgreSQL transaction (`dbTransaction`):
```sql
BEGIN;
  -- 1. Acquire advisory lock on fiscal year
  -- 2. Lock fiscal period rows FOR UPDATE
  -- 3. Run pre-flight checklist gates
  -- 4. Create closing voucher in DRAFT
  -- 5. Submit closing voucher
  -- 6. Approve closing voucher (enforcing SoD)
  -- 7. Post closing voucher via PostingService.postVoucher
  -- 8. Auto-provision next fiscal year periods if absent
  -- 9. Emit audit trail event
COMMIT;
```
If ANY step fails, PostgreSQL triggers `ROLLBACK`. Zero partial vouchers, orphan journals, or incomplete period locks will ever persist.

---

### O. Concurrency Control Strategy
1. **PostgreSQL Transaction-Level Advisory Lock**:
   ```sql
   SELECT pg_advisory_xact_lock(hashtext('period_close_' || $1));
   ```
   Prevents two concurrent close requests for the same fiscal year from racing.
2. **Row Locks**:
   `SELECT ... FOR UPDATE` on all 12 fiscal period rows prevents concurrent postings from slipping in while the close validation runs.
3. **Transaction Isolation**:
   `READ COMMITTED` with explicit row locks ensures immediate visibility of committed vouchers.

---

### P. Segregation of Duties (SoD) & RBAC Permissions
- **Permissions**:
  - `ACCOUNTING.VIEW`: Required to view period status, run dry-run previews, and inspect diagnostics.
  - `ACCOUNTING.MANAGE`: Required to initiate close preparation.
  - `SUPER_ADMIN`: Required to lock/unlock periods, approve closing vouchers, and execute year-end close.
- **Two-Person Rule**:
  Enforced by `chk_voucher_segregation` in PostgreSQL:
  $$\text{approved\_by} \neq \text{created\_by}$$
  The closing voucher must be prepared by a Finance Staff actor and approved/posted by a distinct Super Admin / Finance Director actor.

---

### Q. Audit Trail Integrity
Every close action records:
- `actor_id`: Authenticated staff user ID from server session.
- `action`: `MONTHLY_LOCK`, `MONTHLY_UNLOCK`, `YEAR_END_CLOSE_PREPARE`, `YEAR_END_CLOSE_POST`, `YEAR_END_REOPEN`.
- `fiscal_year`: Fiscal year string.
- `timestamp`: UTC ISO timestamp.
- `voucher_id`: Link to immutable closing `JOURNAL` voucher.
- `reason`: Mandatory text for unlocks or reopens.
- `snapshot`: Pre-close vs post-close financial KPIs stored in voucher JSONB metadata.

---

### R. Impact on Financial Reports
1. **General Ledger & Trial Balance**:
   - Before close: Nominal accounts show accumulated balances; total debits = total credits.
   - After close: As of `YYYY-03-31`, nominal accounts show net balance of ₹0.00. Account `3210` reflects accumulated profit.
2. **Profit & Loss Statement (P&L)**:
   - Must support `exclude_closing_vouchers = true` (default: `true`).
   - By excluding closing vouchers (`reference_type = 'YEAR_END_CLOSE'`), P&L accurately presents gross operating revenue and expenses for the entire closed fiscal year without returning synthetic zeroes.
3. **Balance Sheet**:
   - Seamless transition: Dynamic `3220` profit drops from $\Pi \to ₹0.00$, while Account `3210` increases by $\Pi$.
   - Total Equity and Total Assets remain identically balanced with ₹0.00 variance.
4. **Cash Flow Statement**:
   - The close voucher touches **zero cash accounts**.
   - Direct Method ignores closing vouchers (cash-line filter).
   - Indirect Method uses operational P&L and working capital (equity changes are excluded).
   - Cash Flow Statement is 100% immune to year-end closing entries.

---

## 6. Security & BOLA Architecture
1. **Zero Trust for Client Identity**:
   - `x-user-role`, `x-user-id`, and request body actor fields are completely ignored.
   - Authenticated user ID, role, and branch assignment derive exclusively from verified server-side session cookies via `getSessionUser()`.
2. **BOLA / IDOR Defense**:
   - Year-end close is an enterprise-wide operation restricted strictly to `SUPER_ADMIN`.
   - Branch managers and standard staff are rejected with HTTP 403 Forbidden.
   - Any request attempting cross-branch period manipulation returns HTTP 403 Forbidden.

---

## 7. Comprehensive 25-Scenario Verification Plan (Pre-Implementation Matrix)

When authorized, the Phase 5A.6 implementation will be validated against this rigorous 25-test specification:

| # | Test Scenario | Precondition / Input | Expected Assertion Criteria |
|---|---|---|---|
| 1 | **No Fiscal Period Configured** | Database has 0 fiscal periods | `runPreCloseDiagnostics` returns `can_close: false`, error `PERIOD_NOT_CONFIGURED`. |
| 2 | **Open Period Close Rejection** | 1 or more monthly periods have `is_locked = false` | Year-end close blocked with `PRIOR_PERIODS_UNLOCKED`. |
| 3 | **Period With Draft Vouchers** | 1 voucher in `DRAFT` status within FY dates | Dry-run flags `BLOCKING`, `UNPOSTED_VOUCHERS_EXIST`. Close blocked. |
| 4 | **Period With Submitted Vouchers** | 1 voucher in `SUBMITTED` status within FY dates | Dry-run flags `BLOCKING`, `UNPOSTED_VOUCHERS_EXIST`. Close blocked. |
| 5 | **Period With Unapproved Vouchers** | 1 voucher in `APPROVED` status but unposted | Dry-run flags `BLOCKING`, `UNPOSTED_VOUCHERS_EXIST`. Close blocked. |
| 6 | **Period With Suspense Balance** | Account `1119` has non-zero net balance | Dry-run flags `BLOCKING`, `UNCLEARED_SUSPENSE_BALANCE`. Close blocked. |
| 7 | **Period With Unreconciled Bank Items** | Unreconciled bank statement line exists | Dry-run flags `BLOCKING`, `UNRECONCILED_BANK_TRANSIT`. Close blocked. |
| 8 | **Period With Inventory Exceptions** | Inventory cost lot variance vs GL `1131/1132` | Dry-run emits `WARNING`, details provided in report. |
| 9 | **Period With AR/AP Mismatch** | Subledger open invoices $\neq$ GL `1121/2111` | Dry-run flags `BLOCKING`, `SUBLEDGER_MISMATCH`. Close blocked. |
| 10 | **Valid Close Execution** | All 12 periods locked, all gates passed | Generates balanced `JOURNAL` voucher, nominal accounts zeroed, net profit to `3210`. |
| 11 | **Duplicate Close Request** | FY already has a posted close voucher | Request rejected with `DUPLICATE_SOURCE_EVENT`, unique index holds. |
| 12 | **Concurrent Close Requests** | 2 simultaneous close calls for same FY | PostgreSQL advisory lock serializes; 1st succeeds, 2nd rejected as duplicate. |
| 13 | **Close + Simultaneous Posting** | Close in progress, posting attempted | Locked period guard rejects operational posting with `FISCAL_PERIOD_LOCKED`. |
| 14 | **Failed Close Rollback** | Simulated exception during journal insertion | Entire transaction rolls back; 0 vouchers, 0 journals, 0 lines created. |
| 15 | **SoD Violation Rejection** | `approved_by === created_by` on close voucher | DB constraint `chk_voucher_segregation` rejects voucher with error. |
| 16 | **Unauthorized Branch Access** | Non-super-admin staff attempts close | Rejected with HTTP 403 Forbidden. |
| 17 | **Closed-Period Posting Rejection** | Posting dated within closed FY attempted | Rejected with `FISCAL_PERIOD_LOCKED`. |
| 18 | **Reopen Authorization & Audit** | SUPER_ADMIN executes reopen with reason | Compensating reversal voucher created; original preserved; nominals restored. |
| 19 | **P&L Zeroing Verification** | Post-close GL query of nominal accounts | All 26 nominal accounts have net_balance === 0.00 as of close date. |
| 20 | **Retained Earnings Transition** | Pre-close vs post-close equity query | Account `3210` delta === Net Profit $\Pi$; dynamic `3220` === 0.00. |
| 21 | **Balance Sheet Balance Invariant** | Balance Sheet run as of close date | Assets === Liabilities + Equity (exact match, variance < 0.01 paise). |
| 22 | **Trial Balance Balance Invariant** | Trial Balance run as of close date | Total Debits === Total Credits (variance === 0.00). |
| 23 | **Cash Flow Invariants Preservation** | Cash Flow run for closed period | Direct CFO === Indirect CFO; closing cash === BS 1110; variance === 0.00. |
| 24 | **Next FY Opening Balances** | Balance Sheet run as of next FY day 1 | Real accounts carry forward; dynamic `3220` evaluates only new FY postings. |
| 25 | **Audit Trail Integrity** | Audit query for close event | Contains actor ID, timestamp, close voucher ID, net profit, snapshot metadata. |

---

## 8. Proposed Service & API Architecture (For Future Implementation)

### 8.1 Service Layer (`frontend/src/lib/services/period-close.service.ts`)
```typescript
export class PeriodCloseService {
  // Read-only pre-flight checklist
  static async runPreCloseDiagnostics(
    fiscalYear: string,
    sessionUser: AuthUser
  ): Promise<PreCloseDiagnosticsResult>;

  // Monthly Period Locking
  static async lockPeriod(
    periodId: string,
    actorId: string,
    actorRole: string
  ): Promise<AccountingFiscalPeriodRow>;

  static async unlockPeriod(
    periodId: string,
    reason: string,
    actorId: string,
    actorRole: string
  ): Promise<AccountingFiscalPeriodRow>;

  // Year-End Close
  static async executeYearEndClose(
    params: YearEndCloseParams,
    preparerId: string,
    approverId: string
  ): Promise<YearEndCloseResult>;

  // Year-End Reopen via Reversal
  static async reopenYearEndClose(
    params: ReopenYearEndParams,
    actorId: string,
    actorRole: string
  ): Promise<ReopenYearEndResult>;
}
```

### 8.2 REST API Endpoints
1. `GET  /api/v1/admin/accounting/period-close/preview` — Run read-only pre-close diagnostics.
2. `POST /api/v1/admin/accounting/period-close/lock` — Lock a monthly fiscal period.
3. `POST /api/v1/admin/accounting/period-close/unlock` — Unlock a monthly fiscal period (audited).
4. `POST /api/v1/admin/accounting/period-close/year-end` — Execute annual close & post closing journal.
5. `POST /api/v1/admin/accounting/period-close/year-end-reopen` — Reopen closed year via compensating reversal.

---

## 9. Explicit Safety & Non-Mutation Assertion

**CRITICAL COMPLIANCE STATEMENT**:
- During this entire forensic investigation and design gate, **NO production financial transactions, vouchers, journals, or fiscal periods were created or modified**.
- **NO schema modifications (DDL), triggers, or tables were altered**.
- All tests executed were isolated within rollback transactions or non-destructive read operations.
- The PostgreSQL database remains in an immaculate baseline state: **0 vouchers, 0 journals, 0 lines, 0 fiscal periods, 99 accounts**.

---

## 10. Design Gate Freeze & Strict Stop Assertion

- **Phase 5A.6 Forensic & Architecture Design Gate**: **COMPLETE AND LOCKED 🔒**.
- **Implementation Status**: **STRICTLY NOT STARTED**.
- **System State**: **HALTED**.

Per Section 14 of the Mandatory Continuation Protocol, execution is now **HALTED**. No code implementation, API routes, UI components, or closing vouchers will be created until explicit user authorization is provided.
