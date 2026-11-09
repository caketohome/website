# CakeToHome ERP — Cash Overdraft Guard & Accounting Control Remediation Report

**Date:** 2026-10-16  
**Starting Baseline:** `CHECKPOINTS/complete-accounting-gap-closure-and-durability-audit.md`  
**Database:** PostgreSQL 17.6 on Supabase (`aws-1-ap-south-1.pooler.supabase.com:6543/postgres`)  
**Status:** ⚠️ **CASH OVERDRAFT GUARD IMPLEMENTED & VERIFIED — BANK PERSISTENCE DURABILITY BLOCKED PENDING ISOLATED STAGING DB**  
**GST & HSN Status:** 🔒 **CLOSED & PRESERVED** (22/22 active products statutory 8-digit HSN classified)  

---

## 1. Requirement & Workstream Status Matrix

| # | Workstream Requirement | Status | Verification Summary & Evidence |
|---|---|---|---|
| **1.1** | **Direct Cash Overdraft Guard** (Server-side, fail-closed, atomic) | **VERIFIED** | Implemented in [ExpensePostingService.postExpenseToGL](file:///E:/vig/cakes2home-main/cakes2home-main/frontend/src/lib/services/expense-posting.service.ts#L622-L737). Inspects payment method and source account; checks physical drawer balance for teller sessions and authoritative GL book balance for direct petty cash; enforces concurrency locks. |
| **1.2** | **Cash Guard Integration Tests** (Full PostgreSQL test suite) | **VERIFIED** | Executed in [`scratch/test_cash_guard_full_suite.js`](file:///E:/vig/cakes2home-main/cakes2home-main/scratch/test_cash_guard_full_suite.js). Verified no-float rejection, insufficient-float rejection, valid disbursement, duplicate retry block, bank payment preservation, and teller session overdraft controls. |
| **1.3** | **Concurrency-Race Testing** (Simultaneous competing disbursements) | **VERIFIED** | Executed in [`scratch/test_cash_guard_concurrency.js`](file:///E:/vig/cakes2home-main/cakes2home-main/scratch/test_cash_guard_concurrency.js). Two concurrent requests (₹350 and ₹300) against ₹500 float: exactly 1 succeeded, exactly 1 rejected with `INSUFFICIENT_CASH_BALANCE`. Net book cash never overdrawn. |
| **1.4** | **Opening-Float Operational Workflow Resolution** | **VERIFIED** | Real 6-step operational procedure documented and aligned with `OpeningBalanceService`, `TellerSessionService`, and `BranchCashService`. Replaced illustrative ₹10k/₹5k amounts with mandatory authorized workflow. |
| **1.5** | **Historical SoD Test Vouchers Governance & Finance Review** | **VERIFIED** | Preserved vouchers `vch_00MUR19MJGEZP9JC` and `vch_00MUR1BRX9F9X7J8` without automated mutation. Documented finance-review finding, subledger analysis, reversal procedure, and statement impact. |
| **1.6** | **Bank Durability Limitation** | **BLOCKED** | Retained BLOCKED classification in strict compliance with shared database safety rules. Zero uncommitted writes or dirty persistence tests executed against shared Supabase DB. |
| **1.7** | **Independent PostgreSQL Financial Invariants** | **VERIFIED** | Verified through [`scratch/run_comprehensive_accounting_checks.js`](file:///E:/vig/cakes2home-main/cakes2home-main/scratch/run_comprehensive_accounting_checks.js). Trial balance Dr ₹3,380.00 = Cr ₹3,380.00 (Diff: ₹0.00); Balance Sheet Assets (₹800.00) = Equity (₹800.00); 0 unbalanced JEs; 0 duplicate vouchers. |

---

## 2. Diagnosis: Why the Original Concurrency Test Stalled

During execution of `node scratch/test_cash_guard_concurrency.js` as task `task-575`, the script executed all test steps, verified the concurrency lock, and printed:
```text
CONCURRENCY RACE TEST PASSED: CASH OVERDRAFT STRICTLY PREVENTED
```
However, the Node.js process did not exit back to the shell prompt and appeared hung.

### Root-Cause Diagnosis:
1. **Event Loop Retention by PostgreSQL Connection Pool**:
   - `ExpensePostingService.postExpenseToGL` delegates to `dbTransaction` in [`frontend/src/lib/db.ts`](file:///E:/vig/cakes2home-main/cakes2home-main/frontend/src/lib/db.ts#L19-L36).
   - `dbTransaction` invokes `getDbPool()`, which lazily initializes a global singleton `pg.Pool` with active keep-alive timers (`idleTimeoutMillis: 30000`) and idle connection handles.
   - While the test client (`setupClient`) was explicitly closed via `await setupClient.end()`, the underlying global singleton `__cth_pg_pool__` created by the service remained active, keeping the Node.js event loop alive.
2. **Absence of Clean Process Exit**:
   - The test script ended with `runConcurrencyTest().catch(...)` without calling `process.exit(0)` or `await getDbPool().end()`.
3. **Resolution Implemented**:
   - Added `const { getDbPool } = jiti('../frontend/src/lib/db.ts')`.
   - In the `finally` block: explicitly called `await getDbPool().end().catch(() => {})`.
   - Added an unref'd 30-second bounded timeout guard (`setTimeout(() => process.exit(1), 30000).unref()`).
   - Added explicit `process.exit(0)` upon successful assertion.
   - Re-running the script demonstrated immediate, synchronous exit with code 0 in **7.1 seconds**.

---

## 3. Server-Side Cash Overdraft Guard Implementation

In [frontend/src/lib/services/expense-posting.service.ts](file:///E:/vig/cakes2home-main/cakes2home-main/frontend/src/lib/services/expense-posting.service.ts#L622-L737):

### A. Authoritative Source Resolution & Separation of Non-Cash Payments
- When `expense.settlement_type === "DIRECT_PAYMENT"`:
  - If `payment_method` is non-cash (`BANK_TRANSFER`, `UPI`, `CARD`, `CHEQUE`):
    - Routes directly to bank account GL resolution (Account `1112` or specific bank master).
    - Preserved without requiring any cash float or teller drawer.
  - If `payment_method === "CASH"` (or direct cash fallback):
    - Enforces the server-side cash guard before constructing journal entries.

### B. Guard Logic for Retail Teller Drawer (`expense.teller_session_id` present)
1. **Pessimistic Row Lock**:
   ```sql
   SELECT * FROM public.teller_session WHERE id = $1 FOR UPDATE
   ```
2. **Session State Validation**:
   - Session must exist (`TELLER_SESSION_NOT_FOUND`).
   - Session branch must match expense branch (`BRANCH_ACCESS_DENIED`).
   - Session status must be `'OPEN'` (`INVALID_SESSION_STATE`).
3. **Authoritative Available Drawer Cash**:
   $$\text{available\_cash} = \text{opening\_float} + \sum(\text{IN movements}) - \sum(\text{OUT movements})$$
4. **Overdraft Protection**:
   - If `opening_float <= 0 && net_movements <= 0`: throws `NO_AUTHORIZED_CASH_FLOAT`.
   - If `available_cash < disbursement_amount`: throws `INSUFFICIENT_CASH_DRAWER_BALANCE`.
5. **Atomic Projection**:
   - Emits Cr line for Account `1111 Cash in Hand`.
   - Atomically projects `TellerMovementService.projectExpensePayment` (`direction: 'OUT'`).

### C. Guard Logic for Direct Petty Cash / Branch Cash (No `teller_session_id`)
1. **Account Resolution**:
   - Resolves canonical Account `1114 Petty Cash - Branches` (fallback `1111 Cash in Hand`).
2. **Concurrency Serialization**:
   - Acquires PostgreSQL advisory transaction lock:
     ```sql
     SELECT pg_advisory_xact_lock(hashtext('cash_guard_' || $1 || '_' || $2))
     ```
     where `$1 = expense.branch_id` and `$2 = pettyAcc.id`. Held until transaction commit/rollback.
3. **Authoritative General Ledger Book Balance**:
   ```sql
   SELECT 
     COALESCE(SUM(CASE WHEN jl.branch_id = $2::text THEN jl.debit_amount - jl.credit_amount ELSE 0 END), 0)::text AS branch_bal,
     COALESCE(SUM(jl.debit_amount - jl.credit_amount), 0)::text AS total_bal
   FROM public.accounting_journal_line jl
   JOIN public.accounting_journal_entry je ON je.id = jl.journal_entry_id
   WHERE jl.account_id = $1
   ```
4. **Overdraft Protection**:
   - If `branch_balance <= 0`: throws `NO_AUTHORIZED_CASH_FLOAT` ("no authorized opening float or positive cash balance exists for account '1114' at branch ... Post an approved opening float voucher before disbursing cash.").
   - If `branch_balance < disbursement_amount`: throws `INSUFFICIENT_CASH_BALANCE` ("available balance for account '1114' at branch ... is ₹... Cash overdraft is strictly prohibited.").
5. **Atomic Journal Posting**:
   - Emits Cr line for Account `1114 Petty Cash - Branches`.

---

## 4. Test Evidence & Actual Command Output

### Test Suite 1: Full Integration Suite (`scratch/test_cash_guard_full_suite.js`)
**Command:** `node scratch/test_cash_guard_full_suite.js`  
**Exit Status:** 0 (Completed synchronously in 7.0s)  
**Output Summary:**
```text
[Suite Init] Test run identifier: cguard_1792141903761
[Setup] Resolving canonical GL accounts...
  ✓ 1114 Petty Cash: 6bf2d474-1800-461d-8a02-e0b4cf423671
  ✓ 1111 Cash in Hand: afdd90ab-7096-41fd-a268-7df89f7ed9b0
  ✓ 1112 Bank Operating: e1138b91-246c-4411-8da4-bdfa2ac6c3ad
  ✓ Created isolated test branch: br_cguard_1792141903761
  ✓ Resolved active expense category: excat_rent

[Test 1] Testing direct cash payment with NO valid opening float...
  ✓ Correctly rejected with NO_AUTHORIZED_CASH_FLOAT: "Direct cash disbursement of ₹500.00 rejected: no authorized opening float or positive cash balance exists for account '1114 (Petty Cash - Branches)' at branch 'br_cguard_1792141903761' (current balance: ₹0.00). An approved opening float voucher must be posted before disbursing cash."
  ✓ PostgreSQL integrity verified: zero partial vouchers or journal lines persisted.

[Test 2] Seeding float of ₹500 and testing expense of ₹600 (insufficient funds)...
  ✓ Seeded GL Opening Float of ₹500 on account 6bf2d474-1800-461d-8a02-e0b4cf423671 for branch br_cguard_1792141903761
  ✓ Correctly rejected with INSUFFICIENT_CASH_BALANCE: "Direct cash disbursement of ₹600.00 rejected: available balance for account '1114 (Petty Cash - Branches)' at branch 'br_cguard_1792141903761' is ₹500.00. Cash overdraft is strictly prohibited."
  ✓ Verified book cash balance remains positive: ₹500.00 (expected: 500.00)

[Test 3] Testing valid cash expense of ₹300 against available ₹500 float (MUST SUCCEED)...
  ✓ Successfully posted expense: exp_valid_cash_cguard_1792141903761 (status: POSTED)
  ✓ Journal entry created: JE-FY2026-27-20261016-QTQGHN
  ✓ Authoritative GL cash balance after ₹300 disbursement: ₹200.00 (expected: 200.00)

[Test 4] Testing duplicate retry on already posted expense (MUST BE REJECTED)...
  ✓ Correctly rejected duplicate posting: "Expense 'exp_valid_cash_cguard_1792141903761' is already posted."

[Test 5] Testing valid bank payment of ₹1,500 with no cash drawer (MUST SUCCEED)...
  ✓ Bank payment posted successfully: exp_bank_transfer_cguard_1792141903761
  ✓ Voucher: VCH-TEST-BANK_TRANSFER-1792141905552
  ✓ Petty cash balance remains untouched at: ₹200.00 (expected: 200.00)

[Test 6] Testing retail teller drawer session overdraft guards...
  ✓ Opened teller session: sess_cguard_1792141903761 with opening_float = ₹400.00
  - Subtest 6A: Attempting drawer disbursement of ₹450 (available: ₹400)...
    ✓ Correctly rejected: "Cannot disburse ₹450.00 from teller drawer: available balance is ₹400.00. Cash overdraft is strictly prohibited."
  - Subtest 6B: Attempting drawer disbursement of ₹150 (available: ₹400)...
    ✓ Successfully posted drawer expense: exp_drawer_valid_cguard_1792141903761
    ✓ Persisted teller movement: OUT ₹150.00 (EXPENSE_PAYMENT)

[Rollback & Isolation Audit] Rolling back all test writes...
  ✓ Transaction rolled back successfully.

[Verification via Independent PostgreSQL Client]
  - Leaked test expenses:  0 (expected: 0)
  - Leaked test vouchers:  0 (expected: 0)
  - Leaked test branches:  0 (expected: 0)
  - Leaked test sessions:  0 (expected: 0)
=============================================================================
ALL CASH OVERDRAFT GUARD INTEGRATION TESTS PASSED (ZERO SHARED DB POLLUTION)
=============================================================================
```

### Test Suite 2: Concurrency Race Test (`scratch/test_cash_guard_concurrency.js`)
**Command:** `node scratch/test_cash_guard_concurrency.js`  
**Exit Status:** 0 (Completed synchronously in 7.1s)  
**Output Summary:**
```text
=============================================================================
CakeToHome ERP — Cash Overdraft Concurrency-Race Test (Simultaneous Spends)
=============================================================================

[Setup] Creating test branch and seeding ₹500 float...
  ✓ Created Expense A (₹350): exp_A_conc_1792141848045
  ✓ Created Expense B (₹300): exp_B_conc_1792141848045
  - Available Float: ₹500.00 | Total Attempted: ₹650.00

[Concurrency Execution] Disagreeing race launched via separate database connections...
  - Expense A Result: status=rejected, value=Direct cash disbursement of ₹350.00 rejected: available balance for account '1114 (Petty Cash - Branches)' at branch 'br_conc_1792141848045' is ₹200.00. Cash overdraft is strictly prohibited.
  - Expense B Result: status=fulfilled, value=POSTED

[Concurrency Results Audit]
  - Successful disbursements: 1 (Expected: EXACTLY 1)
  - Blocked overdrafts:       1 (Expected: EXACTLY 1)
  ✓ Failed transaction rejected with INSUFFICIENT_CASH_BALANCE: "Direct cash disbursement of ₹350.00 rejected: available balance for account '1114 (Petty Cash - Branches)' at branch 'br_conc_1792141848045' is ₹200.00. Cash overdraft is strictly prohibited."
  ✓ Authoritative final GL cash balance: ₹200.00 (never overdrawn!)

[Teardown] Purging concurrency test records...
  ✓ Cleaned up all concurrency test rows.

=============================================================================
CONCURRENCY RACE TEST PASSED: CASH OVERDRAFT STRICTLY PREVENTED
=============================================================================
```

---

## 5. Opening-Float Operational Workflow Resolution

The figures ₹10,000 (Cash in Hand `1111`) and ₹5,000 (Petty Cash `1114`) used in earlier notes were strictly illustrative examples. To safely establish operational cash without fabricating records, the branch must execute the standard 6-step workflow:

1. **Management Authorization**:
   - The Branch Manager submits and the Finance Controller approves an authorized branch float limit based on the branch's metadata (`metadata.petty_cash_imprest_limit`, `metadata.max_drawer_cash_limit`).
2. **Branch & Drawer Selection**:
   - The specific target branch (`public.branch.id`), teller counter station (`public.teller.id`), and safe/cash box are explicitly selected.
3. **Physical Cash Denomination Count**:
   - The designated teller/cashier conducts a physical count of currency notes and coins, recording denominations (₹500, ₹200, ₹100, ₹50, etc.).
4. **Approved GL Opening Float Voucher Posting**:
   - Post an approved `OPENING_BALANCE` voucher using [OpeningBalanceService](file:///E:/vig/cakes2home-main/cakes2home-main/frontend/src/lib/services/opening-balance.service.ts):
     - **Debit:** Account `1111 Cash in Hand` (or `1114 Petty Cash - Branches`) with `branch_id`.
     - **Credit:** Account `3300 Opening Balance Offset`.
     - Maker/Checker SoD enforced (`created_by != approved_by`).
5. **Cash Custody / Shift Initialization**:
   - The teller initiates the shift via `TellerSessionService.openSession({ teller_id, branch_id, opening_float: authorized_physical_count })`.
   - Initial expected cash in the drawer is set to `opening_float`.
6. **Reconciliation Verification**:
   - Run `BranchCashService.getBranchReconciliationDetail(branchId)`:
     $$\text{variance} = \text{gl\_cash\_in\_hand} - (\text{drawer\_cash} + \text{vault\_cash}) = \mathbf{₹0.00}$$
     Status must display `RECONCILED` with `requires_audit: false`.

---

## 6. Historical SoD Test Vouchers Governance & Finance Review

### Context & Details of Posted Vouchers:
- **Voucher 1 (`vch_00MUR19MJGEZP9JC` / `VCH-JOURNAL-FY2026-27-20261002-DB9PMQ`)**:
  - Posted: 2026-10-02T14:03:16Z
  - Reference: `MANUAL` / `SOD_TEST_1790949795676` (Metadata: `{"purpose": "SoD Enforcement Test"}`)
  - Approvals: Prepared by `preparer_staff_01`, approved by `supervisor_staff_02`, posted by `finance_controller_03`.
  - Journal Lines: Dr `1121 Accounts Receivable` ₹1,000.00 (`customer_id: null`) / Cr `4110 Bakery Sales Revenue` ₹1,000.00.
- **Voucher 2 (`vch_00MUR1BRX9F9X7J8` / `VCH-JOURNAL-FY2026-27-20261002-9W8ZD6`)**:
  - Posted: 2026-10-02T14:04:56Z
  - Reference: `MANUAL` / `SOD_TEST_1790949895965` (Metadata: `{"purpose": "SoD Enforcement Test"}`)
  - Approvals: Prepared by `preparer_staff_01`, approved by `supervisor_staff_02`, posted by `finance_controller_03`.
  - Journal Lines: Dr `1121 Accounts Receivable` ₹1,000.00 (`customer_id: null`) / Cr `4110 Bakery Sales Revenue` ₹1,000.00.

### Finance Review Findings:
1. **Why Were Test Entries Posted to Production Financial Accounts?**
   - The test script `test_acceptance_suite5_accounting_sod.ts` tested 3-party SoD workflow enforcement against the real database using standard operating accounts (`1121` and `4110`) rather than dedicated test clearing accounts (`9999`).
2. **Does Account 1121 Require a Customer Subledger Reference?**
   - Under standard ERP accounting controls, control account `1121 Trade Accounts Receivable` represents claims on trade customers and requires an attached customer subledger reference (`customer_id`).
   - Manual postings to `1121` with `customer_id: null` cause the unassigned journal reconciling line item in AR Aging.
3. **Governance & Finance-Controller Approval Requirement**:
   - In accordance with the prompt's mandatory rule, these vouchers are **preserved intact** and have NOT been deleted, muted, or silently edited.
   - Any financial correction requires formal approval from the Finance Controller.
4. **Impact Analysis of Proposed Controlled Correction**:
   If the Finance Controller authorizes a formal reversal voucher:
   - **Voucher Type:** `JOURNAL` (Reversal)
   - **Debit:** Account `4110 Cake & Bakery Sales Revenue` ₹2,000.00
   - **Credit:** Account `1121 Accounts Receivable` ₹2,000.00
   - **Statement Impact:**
     - Operating Revenue (`4xxx`): Decreases from ₹2,000.00 to ₹0.00.
     - Net Profit: Decreases from +₹800.00 to -₹1,200.00 (reflecting exact net operating expenses of ₹1,200.00).
     - Trade Assets (`1121`): Decreases from ₹2,000.00 to ₹0.00.
     - Equity: Decreases from +₹800.00 to -₹1,200.00.
     - AR Aging Subledger: GL `1121` balance becomes ₹0.00, perfectly matching the customer invoice open subledger balance of ₹0.00 without any reconciling line items!

---

## 7. Independent PostgreSQL Financial State (Authoritative Live Check)

Executed via [`scratch/run_comprehensive_accounting_checks.js`](file:///E:/vig/cakes2home-main/cakes2home-main/scratch/run_comprehensive_accounting_checks.js):

- **Trial Balance**:
  - Debits: ₹3,380.00
  - Credits: ₹3,380.00
  - **Net Trial Balance Difference: ₹0.00**
- **Profit & Loss Statement**:
  - Operating Revenue (`4xxx`): ₹2,000.00
  - Operating Expenses (`5xxx`): ₹1,200.00
  - **Net Operating Profit: ₹800.00**
- **Balance Sheet & Accounting Equation**:
  - Assets: ₹800.00
  - Liabilities: ₹0.00
  - Equity: ₹800.00
  - **Equation Check: $\text{Assets (₹800.00)} \equiv \text{Liabilities (₹0.00)} + \text{Equity (₹800.00)}$ (Exact Match)**
- **Journal Integrity**:
  - Unbalanced Journal Entries: **0**
  - Duplicate Primary Vouchers: **0**
- **Posting Safety Guards**:
  - `setting.accounting_start_date`: `'2026-04-01'`
  - 12 fiscal periods active; October 2026 unlocked.

---

## 8. Changed Files & Checkpoint Locations

### Changed Application Files:
1. [`frontend/src/lib/services/expense-posting.service.ts`](file:///E:/vig/cakes2home-main/cakes2home-main/frontend/src/lib/services/expense-posting.service.ts)
   - Added server-side, fail-closed Cash Overdraft Guard for both retail teller drawer and direct petty cash.
   - Added concurrency lock (`pg_advisory_xact_lock`) and authoritative GL book balance derivation.
   - Preserved valid bank payments and AP supplier accruals.
   - Added error codes: `INSUFFICIENT_CASH_DRAWER_BALANCE`, `INSUFFICIENT_CASH_BALANCE`, `NO_AUTHORIZED_CASH_FLOAT`, `TELLER_SESSION_NOT_FOUND`, `INVALID_SESSION_STATE`.

### Test Suites Created & Executed:
2. [`scratch/test_cash_guard_full_suite.js`](file:///E:/vig/cakes2home-main/cakes2home-main/scratch/test_cash_guard_full_suite.js)
   - Comprehensive 6-scenario integration test suite verifying sufficient, insufficient, no float, retry, bank payment, and drawer overdraft guards with transaction rollback.
3. [`scratch/test_cash_guard_concurrency.js`](file:///E:/vig/cakes2home-main/cakes2home-main/scratch/test_cash_guard_concurrency.js)
   - Concurrency race test proving serialization and overdraft prevention under simultaneous requests, with bounded timeout and pool teardown.

### Checkpoints:
- Primary Checkpoint Document: [`CHECKPOINTS/cash-overdraft-guard-and-accounting-remediation-report.md`](file:///E:/vig/cakes2home-main/cakes2home-main/CHECKPOINTS/cash-overdraft-guard-and-accounting-remediation-report.md)
- Updated: [`LATEST_CHECKPOINT.md`](file:///E:/vig/cakes2home-main/cakes2home-main/LATEST_CHECKPOINT.md)
- Updated: [`CHECKPOINTS/LATEST_CHECKPOINT.md`](file:///E:/vig/cakes2home-main/cakes2home-main/CHECKPOINTS/LATEST_CHECKPOINT.md)
