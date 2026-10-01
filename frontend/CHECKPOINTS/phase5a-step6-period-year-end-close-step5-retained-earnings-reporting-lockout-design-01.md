# Phase 5A.6 Step 5 — Multi-Year Retained Earnings Reporting & Historical Lockout
## Comprehensive Forensic & Architectural Design Gate

> **Status**: 📋 **FORENSIC & DESIGN GATE COMPLETE — IMPLEMENTATION NOT STARTED**  
> **Date**: 2026-10-01  
> **Database State**: 100% PRISTINE (0 vouchers, 0 journals, 0 periods, 0 settings, 99 accounts, 0 residual locks)  
> **Execution Boundary**: Forensic analysis and architecture only. Zero production code, zero schema changes, zero migrations executed.

---

## 1. Executive Overview & Skills Inventory

### 1.1 Objective
Phase 5A.6 Step 5 establishes the authoritative **Multi-Year Retained Earnings Reporting** and **Historical Lockout Protection** layer for CakeToHome ERP.
With Step 1 (Diagnostics), Step 2 (Monthly Period Lock), Step 3 (Year-End Close Engine), and Step 4 (Year-End Reopen/Reversal Engine) frozen with 622/622 passing assertions, Step 5 formalizes:
1. Mathematical continuity and multi-year roll-forward of Account 3210 (Retained Earnings) across successive fiscal years.
2. Complete historical reporting across multi-year boundaries without pollution from closing or reversal journals.
3. Fail-closed historical lockout preventing unauthorized period unlocking or postings in closed historical years.
4. Comparative financial reporting (multi-year P&L, multi-year Balance Sheet, and Retained Earnings statement of change).

### 1.2 Skills Inventory Report
Per requirements, the available specialized skills were surveyed:
- Available: `smart-coder`, `lazy-coder`, `postgresql-and-supabase`, `api-design-and-security`, `security-auditing-and-owasp`, `clean-architecture`, `technical-documentation`, `git-workflow-and-releases`.
- Explicitly Unavailable: Dedicated ERP/accounting, financial-accounting, fiscal-period/year-end-close, and financial-reporting skills are not present in the environment.
- Strategy: Utilizing CakeToHome's verified double-entry core, GAAP accounting invariants, and PostgreSQL relational authority established in Steps 1–4.

---

## 2. Phase A — Forensic Repository Findings

### 2.1 Accounting Services & Repositories Audit
| Component | Existing Responsibility | Step 5 Role / Interaction |
|-----------|-------------------------|---------------------------|
| [`balance-sheet.service.ts`](file:///e:/vig/cakes2home-main/cakes2home-main/frontend/src/lib/services/balance-sheet.service.ts) | Computes point-in-time Balance Sheet from GL with comparative date support (`compare_date`). Account 3210 presents prior retained earnings; Account 3220 dynamically computes unclosed P&L. | Reused for point-in-time multi-year comparative balance sheets. |
| [`profit-loss.service.ts`](file:///e:/vig/cakes2home-main/cakes2home-main/frontend/src/lib/services/profit-loss.service.ts) | Computes operating P&L for a date range with `exclude_closing_vouchers: true`. Filters nominal leaf accounts (4100-5300). | Baseline for comparative multi-year P&L reporting. |
| [`general-ledger.service.ts`](file:///e:/vig/cakes2home-main/cakes2home-main/frontend/src/lib/services/general-ledger.service.ts) | Per-account chronological transaction register with running balance and opening balance. | Reused for historical audit trails on Account 3210 and nominal accounts. |
| [`period-close.service.ts`](file:///e:/vig/cakes2home-main/cakes2home-main/frontend/src/lib/services/period-close.service.ts) | Implements diagnostics, close, reopen, and `getFiscalYearCloseHistory`. Tracks closing cycles (`FISCAL_YEAR_CLOSE`, `FISCAL_YEAR_CLOSE_CYCLE_2`). | Extends with multi-year retained earnings roll-forward and historical year register. |
| [`fiscal-period.service.ts`](file:///e:/vig/cakes2home-main/cakes2home-main/frontend/src/lib/services/fiscal-period.service.ts) | Manages monthly periods: create, lock, unlock. Enforces $\ge 20$-char unlock reason. | **Identified Gap**: `unlockPeriod` currently unlocks periods without verifying if the parent fiscal year is closed. |
| [`posting.service.ts`](file:///e:/vig/cakes2home-main/cakes2home-main/frontend/src/lib/services/posting.service.ts) | Validates fiscal period on voucher date. Rejects locked periods (`FISCAL_PERIOD_LOCKED`) or unconfigured dates (`FISCAL_PERIOD_NOT_CONFIGURED`). | Core gatekeeper enforcing historical lockout. |
| [`accounting-journal.repository.ts`](file:///e:/vig/cakes2home-main/cakes2home-main/frontend/src/lib/repositories/accounting-journal.repository.ts) | Aggregates Trial Balance with `excludeClosingVouchers` support for both `YEAR_END_CLOSE` and `YEAR_END_REOPEN`. | Source-of-truth GL aggregator for all multi-year reports. |

---

## 3. Phase B — Independent PostgreSQL Schema Forensics

Direct SQL inspection of live PostgreSQL system catalogs revealed:

1. **`accounting_account`**:
   - `code` (unique), `type` (CHECK: ASSET, LIABILITY, EQUITY, REVENUE, EXPENSE), `subtype`, `parent_id`, `is_group`, `level`, `is_active`.
   - Normal balance convention derived from account type.
2. **`accounting_voucher`**:
   - `reference_type` (`YEAR_END_CLOSE`, `YEAR_END_REOPEN`, `OPENING_BALANCE`, `SALES`, `PURCHASE`, etc.).
   - `reference_id` (fiscal year string, e.g. `'FY2425'`).
   - `reference_event` (cycle marker, e.g. `'FISCAL_YEAR_CLOSE'`, `'FISCAL_YEAR_CLOSE_CYCLE_2'`).
   - `reversed_by_voucher_id`, `reversal_of_voucher_id` (bidirectional linkage).
   - `chk_voucher_posted_immutable`, `chk_voucher_reversal_limit`, `idx_accounting_voucher_source_idempotency`.
3. **`accounting_journal_entry` & `accounting_journal_line`**:
   - `entry_date` (date), `fiscal_year` (string), `total_debit = total_credit`.
   - `is_reversed` (boolean), `reversed_at` (timestamptz).
   - Single-sided lines with `debit_amount >= 0`, `credit_amount >= 0`.
4. **`accounting_fiscal_period`**:
   - `fiscal_year`, `period_name`, `start_date`, `end_date`, `is_locked`, `locked_at`, `locked_by`.
   - Constraint `uq_fiscal_period` (`fiscal_year`, `period_name`).
5. **No Synthetic Tables or Materialized Views**:
   - Public schema contains zero reporting snapshots, zero materialized views, and zero redundant balance cache tables.
   - **Critical Decision**: Step 5 MUST NOT introduce reporting tables or DDL. All reports derive directly from the immutable double-entry ledger.

---

## 4. Phase C — Chart of Accounts & Accounting Semantics Audit

| Account Code & Name | Type / Subtype | Normal Balance | Treatment in P&L | Treatment in Balance Sheet | Year-End Close Action | Year-End Reopen Action | Carry Forward Across FYs |
|---------------------|----------------|----------------|------------------|----------------------------|-----------------------|------------------------|--------------------------|
| **3210 Retained Earnings (Prior Years)** | EQUITY / `RETAINED_EARNINGS` | CREDIT | Excluded | Equity section (presented as positive credit) | Receives net profit (Cr) or net loss (Dr); receives drawings transfer (Dr) | Exact inverse posted (Dr if profit, Cr if loss) | **Yes** (Cumulative perpetual) |
| **3220 Current Year Net Earnings** | EQUITY / `RETAINED_EARNINGS` | CREDIT | Excluded | Dynamically derived: Posted 3220 + (Revenue - Expense) | Becomes 0 after close (nominal accounts zeroed) | Re-emerges dynamically upon reopen | **No** (Resets to 0 upon close) |
| **3120 Drawings / Distributions** | EQUITY / `CAPITAL` | DEBIT (Contra) | Excluded | Deducted from Partner Capital: $3110 - 3120$ | Zeroed to Retained Earnings only if option enabled | Restored only if originally closed | Carries forward if unclosed |
| **3300 Opening Balance Offset / Capital Reserve** | EQUITY / `OPENING_OFFSET` | CREDIT | Excluded | Equity section (presents raw GL balance) | **Untouched** (Zero lines) | **Untouched** (Zero lines) | **Yes** (Permanent equity) |
| **4100–4200 Revenue Accounts (7 leaf)** | REVENUE / `DIRECT/INDIRECT` | CREDIT | Operating Revenue / Other Income | Zeroed to ₹0.00 after close | Zeroed to ₹0.00 | Restored to pre-close credit balances | **No** (Nominal accounts) |
| **4190 Sales Returns & Allowances** | REVENUE / `DIRECT_REVENUE` | DEBIT (Contra) | Deducted from Gross Revenue | Zeroed to ₹0.00 after close | Zeroed to ₹0.00 | Restored to pre-close debit balance | **No** (Nominal contra) |
| **5100–5300 Expense Accounts (19 leaf)** | EXPENSE / `COGS/OPEX/FIN` | DEBIT | COGS / OPEX / Financial Expenses | Zeroed to ₹0.00 after close | Zeroed to ₹0.00 | Restored to pre-close debit balances | **No** (Nominal accounts) |
| **5190 Purchase Discounts Received** | EXPENSE / `COGS` | CREDIT (Contra)| Deducted from COGS | Zeroed to ₹0.00 after close | Zeroed to ₹0.00 | Restored to pre-close credit balance | **No** (Nominal contra) |
| **1100–1500 Assets & 2100–2500 Liabilities** | ASSET / LIABILITY | DEBIT / CREDIT | Excluded | Balance Sheet Sections I–IV | **Untouched** by year-end close | **Untouched** by year-end close | **Yes** (Real balance sheet accounts) |

---

## 5. Phase D — Multi-Year Accounting Continuity Analysis

### 5.1 Mathematical Continuity Across Fiscal Years
For any fiscal year $N$ transitioning to fiscal year $N+1$:
1. **Closing Retained Earnings of FY $N$**:
   $$\text{Closing RE}_{N} = \text{Opening RE}_{N} + \text{Net Profit/Loss Transfer}_{N} - \text{Drawings Closed}_{N}$$
2. **Opening Retained Earnings of FY $N+1$**:
   $$\text{Opening RE}_{N+1} = \text{Closing RE}_{N}$$
3. **Continuity Verification Invariant**:
   At the start date of FY $N+1$ (`YYYY-04-01`), the General Ledger balance of Account 3210 (derived from `getTrialBalance` as-of date `YYYY-04-01`) is mathematically identical to the cumulative balance of Account 3210 immediately after the close of FY $N$.

### 5.2 Dynamic Current-Year Earnings (3220) Behavior
- **Pre-Close in FY $N$**:
  Account 3210 reflects retained earnings up to FY $N-1$.
  Account 3220 dynamically reflects FY $N$ year-to-date net earnings.
  Balance sheet balances: $\text{Assets} = \text{Liabilities} + (\text{Capital} + 3210 + 3220 + 3300)$.
- **Post-Close in FY $N$**:
  Year-end close transfers FY $N$ net earnings into Account 3210 on the last date of FY $N$ (`YYYY-03-31`).
  Nominal revenue and expense balances for FY $N$ sum to zero.
  Account 3220 dynamic roll-up becomes ₹0.00 for FY $N$.
  Account 3210 absorbs the entire earnings.
- **In FY $N+1$**:
  Account 3210 carries forward the closed balance from FY $N$.
  New operational transactions in FY $N+1$ populate nominal accounts with entry dates in FY $N+1$.
  Account 3220 dynamically computes net profit specifically from the new nominal activity of FY $N+1$.

---

## 6. Phase E — Historical Lockout Gap Analysis

Our forensic inspection identified one critical architectural gap in the existing codebase:

| Component | Current State | Required State | Risk Severity | Safe Architectural Control |
|-----------|---------------|----------------|---------------|---------------------------|
| [`FiscalPeriodService.unlockPeriod`](file:///e:/vig/cakes2home-main/cakes2home-main/frontend/src/lib/services/fiscal-period.service.ts) | Unlocks a monthly period whenever `is_locked === true` and $\ge 20$-char reason is provided. **Does not check if parent fiscal year is closed.** | Must reject unlocking any monthly period whose parent `fiscal_year` has an active `YEAR_END_CLOSE` voucher. | **HIGH**: Operational postings could be admitted into a closed year, corrupting retained earnings. | Add closed-year check in `FiscalPeriodService.unlockPeriod`: query active unreversed close vouchers for `period.fiscal_year`. Throw `CANNOT_UNLOCK_CLOSED_YEAR_PERIOD` (HTTP 409). |
| [`PostingService.validateFiscalPeriod`](file:///e:/vig/cakes2home-main/cakes2home-main/frontend/src/lib/services/posting.service.ts) | Checks `period.is_locked`. If locked, rejects posting with `FISCAL_PERIOD_LOCKED`. | Add defense-in-depth: if period is somehow unlocked in database, verify whether `fiscal_year` is closed. | **MEDIUM**: Defense-in-depth against direct DB edits. | Query fiscal year status. If closed and not `allowLockedForClosing`, throw `FISCAL_YEAR_CLOSED`. |
| **Sales & Purchase Reversals** | Reversal validates period of `reversal_date`. | Ensure historical vouchers in closed years cannot be backdated for reversal into the closed year. | **LOW**: Already protected by `validateFiscalPeriod`. | Maintain existing rule: reversals are dated on current open period or require explicit fiscal year reopen. |

---

## 7. Phase F — Step 5 Reporting Architecture & Requirements

To establish multi-year visibility and audit readiness, Step 5 defines 3 specialized, read-only reporting endpoints:

### 7.1 Report 1: Multi-Year Retained Earnings Roll-Forward
- **Endpoint**: `GET /api/v1/admin/accounting/reports/retained-earnings-rollforward`
- **Query Parameters**:
  - `start_year`: e.g. `'FY2324'`
  - `end_year`: e.g. `'FY2526'`
  - `branch_id`: optional branch filter (server-enforced for non-super-admin)
- **Response Structure**:
  ```typescript
  export interface RetainedEarningsYearRollForward {
    fiscal_year: string;
    start_date: string;
    end_date: string;
    is_closed: boolean;
    active_close_voucher_id: string | null;
    opening_retained_earnings: number;   // Balance in 3210 at start_date
    net_operating_profit: number;        // From nominal accounts (exclude closing)
    transferred_to_retained_earnings: number; // Actual credit to 3210 in close voucher
    drawings_transferred: number;        // Drawings closed to 3210
    reopen_reversals: number;            // Reversals applied if reopened
    closing_retained_earnings: number;   // Balance in 3210 at end_date
    continuity_verified: boolean;        // opening_re(N+1) === closing_re(N)
  }
  ```

### 7.2 Report 2: Fiscal Year Summary & Historical Lockout Register
- **Endpoint**: `GET /api/v1/admin/accounting/reports/fiscal-year-summary`
- **Query Parameters**: none (returns all configured fiscal years)
- **Response Structure**:
  ```typescript
  export interface FiscalYearSummaryItem {
    fiscal_year: string;
    start_date: string;
    end_date: string;
    status: "OPEN" | "CLOSED" | "REOPENED";
    total_periods: number;
    locked_periods: number;
    all_periods_locked: boolean;
    active_closing_voucher: {
      voucher_id: string;
      voucher_no: string;
      close_date: string;
      net_profit: number;
      drawings_transferred: number;
    } | null;
    close_cycle_count: number;
    reopen_cycle_count: number;
    operating_revenue: number;
    operating_expense: number;
    net_profit: number;
    historical_lockout_active: boolean; // True if closed or all periods locked
  }
  ```

### 7.3 Report 3: Comparative Multi-Year Profit & Loss
- **Endpoint**: `GET /api/v1/admin/accounting/reports/comparative-pnl`
- **Query Parameters**:
  - `fiscal_year`: primary fiscal year (e.g. `'FY2425'`)
  - `compare_fiscal_year`: comparison fiscal year (e.g. `'FY2324'`)
  - `branch_id`: optional branch scope
- **Response Structure**:
  Combines two P&L snapshots side-by-side with variance ($₹$ and $\%$) across Operating Revenue, COGS, OPEX, and Net Profit, with `exclude_closing_vouchers: true`.

---

## 8. Phase G — Retained Earnings Mathematical Proof

Let $GL(acc, d)$ be the net balance of account $acc$ from all posted journal lines up to date $d$, where normal CREDIT accounts are expressed as positive values.

1. **Before Close of FY $N$**:
   $$GL(3210, \text{end}_N) = \text{Opening RE}_N$$
   $$P\&L_N = \sum_{r \in \text{Revenue}} (Cr_r - Dr_r) - \sum_{e \in \text{Expense}} (Dr_e - Cr_e)$$
   In Balance Sheet:
   $$\text{Equity} = \text{Capital} - \text{Drawings} + GL(3210) + P\&L_N + GL(3300)$$

2. **Year-End Close of FY $N$**:
   A closing voucher is posted on $\text{end}_N$:
   - For all nominal leaf accounts $i$: Post inverse amount to zero balance.
   - For Account 3210: Credit $P\&L_N$ (or debit if loss).
   - If drawings closed: Credit Account 3120 $\text{Drawings}_N$, Debit Account 3210 $\text{Drawings}_N$.
   Post-close:
   $$GL(3210, \text{end}_N) = \text{Opening RE}_N + P\&L_N - \text{Drawings}_N = \text{Closing RE}_N$$
   $$\forall i \in \text{Nominal}: GL(i, \text{end}_N) = 0$$

3. **Start of FY $N+1$**:
   On $\text{start}_{N+1} = \text{end}_N + 1 \text{ day}$:
   $$GL(3210, \text{start}_{N+1}) = GL(3210, \text{end}_N) = \text{Closing RE}_N$$
   Nominal accounts start at $0.00$.
   $$\therefore \text{Opening RE}_{N+1} \equiv \text{Closing RE}_N \quad \blacksquare$$

---

## 9. Phase H — Historical Immutability & Lockout Architecture

```
                  ┌─────────────────────────────────────┐
                  │    Attempt to Post / Unlock         │
                  └──────────────────┬──────────────────┘
                                     │
                     ┌───────────────┴───────────────┐
                     ▼                               ▼
       Posting Voucher Date              Monthly Unlock Request
                     │                               │
        Check Fiscal Period Guard          Check Closed FY Guard
                     │                               │
     ┌───────────────┴───────────────┐               │
     ▼                               ▼               ▼
Period Not Configured          Period Locked   Is FY Closed with
(Reject: 422)                  (Reject: 422)   Active Closing Voucher?
                                                     │
                                       ┌─────────────┴─────────────┐
                                       ▼                           ▼
                                      YES                          NO
                              Reject Unlock (409)          Allow Unlock (200)
                              "Year is closed. Reopen      (Record Audit Log)
                               fiscal year first."
```

1. **Immutable Historical Accounting**:
   - Zero physical updates or deletions to historical vouchers or journals.
   - Closed fiscal years remain permanently sealed by both `is_locked = true` on all constituent periods and the active unreversed `YEAR_END_CLOSE` voucher.
2. **Controlled Reopen Prerequisite**:
   - To make adjustments to a closed historical year, the user **MUST** execute Phase 5A.6 Step 4 (`PeriodCloseService.reopenYearEndClose`).
   - Only after Step 4 posts the compensating reversal voucher and transitions the fiscal year state to `REOPENED` will `unlockPeriod` allow any monthly period in that year to be unlocked.

---

## 10. Phase I — Security & RBAC Specification

1. **Authentication & Identity**:
   - All endpoints require verified session via `resolveUserContext`.
   - Never trust `x-user-role`, `x-user-id`, or client query branch overrides.
2. **Authorization Matrix**:
   - `ACCOUNTING.VIEW`: Permitted to view Multi-Year Retained Earnings Roll-Forward, Fiscal Year Summary, and Comparative P&L.
   - Non-`SUPER_ADMIN` staff: Strictly scoped to their session branch (BOLA defense).
   - `SUPER_ADMIN`: Authorized for company-wide reporting and period unlocking.
3. **Lockout Authorization Guard**:
   - Even `SUPER_ADMIN` is prohibited from unlocking a monthly period in a closed year without first calling Step 4 Reopen.

---

## 11. Phase J — Proposed 35-Point Test Matrix for Step 5

| Category | Domain | Scenario Covered |
|----------|--------|------------------|
| **Baseline** | 1 | Verify pristine PostgreSQL baseline (0 vouchers, 0 journals, 99 CoA, 0 locks) |
| **Historical Lockout** | 2 | `FiscalPeriodService.unlockPeriod` on closed year without reopen $\rightarrow$ throws `CANNOT_UNLOCK_CLOSED_YEAR_PERIOD` (409) |
| | 3 | `FiscalPeriodService.unlockPeriod` on open year $\rightarrow$ succeeds with $\ge 20$-char reason |
| | 4 | `FiscalPeriodService.unlockPeriod` on reopened year (post-Step 4) $\rightarrow$ succeeds |
| | 5 | Operational voucher posting into locked closed year period $\rightarrow$ throws `FISCAL_PERIOD_LOCKED` (422) |
| | 6 | Operational voucher posting into unconfigured historical date $\rightarrow$ throws `FISCAL_PERIOD_NOT_CONFIGURED` (422) |
| | 7 | Non-SUPER_ADMIN staff attempting unlock $\rightarrow$ throws `UNAUTHORIZED` (403) |
| | 8 | Short unlock reason ($< 20$ chars) $\rightarrow$ throws `UNLOCK_REASON_REQUIRED` (400) |
| **Retained Earnings Continuity** | 9 | Single profitable year (FY2425) close $\rightarrow$ Retained Earnings 3210 reflects exact net profit |
| | 10 | Next fiscal year (FY2526) opening Retained Earnings === FY2425 closing Retained Earnings |
| | 11 | Single loss year (FY2425) close $\rightarrow$ Retained Earnings 3210 reflects exact debit |
| | 12 | Drawings transferred $\rightarrow$ Account 3120 zeroed, Account 3210 reflects Net Profit - Drawings |
| | 13 | Drawings NOT transferred $\rightarrow$ Account 3120 preserved, Account 3210 reflects only Net Profit |
| | 14 | Account 3300 Opening Balance Equity strictly untouched across all multi-year closes |
| | 15 | Multi-year chain (FY2324 closed $\rightarrow$ FY2425 closed $\rightarrow$ FY2526 open) continuity verified |
| | 16 | Dynamic 3220 resets to 0.00 upon close for each historical year |
| | 17 | Dynamic 3220 in open FY2526 reflects only FY2526 operating income |
| **Step 4 Reopen Integration** | 18 | Reopen in multi-year chain restores nominal balances for that year |
| | 19 | Retained Earnings roll-forward report flags reopened year with correct net reversals |
| | 20 | Re-close Cycle 2 updates Retained Earnings roll-forward cleanly |
| **Reporting APIs** | 21 | Retained Earnings Roll-Forward API returns all years with mathematical continuity |
| | 22 | Retained Earnings Roll-Forward API enforces `ACCOUNTING.VIEW` |
| | 23 | Fiscal Year Summary API returns accurate status (`OPEN`, `CLOSED`, `REOPENED`) |
| | 24 | Fiscal Year Summary accurately counts periods and locked status |
| | 25 | Comparative P&L API returns side-by-side columns with variance for two fiscal years |
| | 26 | Comparative P&L correctly excludes closing vouchers (`exclude_closing_vouchers: true`) |
| | 27 | Trial Balance for historical year with `excludeClosingVouchers: true` presents original revenues/expenses |
| | 28 | Trial Balance for historical year with `excludeClosingVouchers: false` presents zeroed nominal accounts |
| | 29 | Balance Sheet as-of end of historical year matches closed Retained Earnings balance |
| **Security & BOLA** | 30 | Branch-scoped staff query receives branch-isolated roll-forward |
| | 31 | Branch mismatch request by non-admin $\rightarrow$ rejected with `FORBIDDEN` |
| | 32 | Unauthenticated request $\rightarrow$ rejected with `UNAUTHORIZED` (401) |
| **Concurrency & Purity** | 33 | Read-only reports cause zero database mutations or locks |
| | 34 | Concurrent roll-forward report requests execute safely without contention |
| | 35 | Post-test PostgreSQL audit confirms 100% clean baseline (0 test artifacts) |

---

## 12. DDL & Schema Decision

- **DDL Required**: **NO**.
- **Schema Changes**: **NONE**.
- **New Tables**: **NONE**.
- **Justification**: The existing PostgreSQL schema (`accounting_account`, `accounting_voucher`, `accounting_journal_entry`, `accounting_journal_line`, `accounting_fiscal_period`, `audit_log`) completely supports multi-year retained earnings reporting, period lockout, and historical reconciliation. No migrations or table creations are permitted.

---

## 13. Phased Implementation Sequence (Upon Future Authorization)

When Step 5 is authorized for implementation, it must proceed in the following bounded sequence:

1. **Substep 5.1 — Historical Lockout Guard in `FiscalPeriodService`**:
   - Update `unlockPeriod` to query active closing vouchers on `period.fiscal_year`.
   - Block unlock if fiscal year is closed without prior Step 4 reopen.
2. **Substep 5.2 — Retained Earnings Roll-Forward Engine in `PeriodCloseService`**:
   - Implement `getRetainedEarningsRollForward`: queries historical years, opening RE, net profit transfer, drawings, and closing RE.
   - Implement `getFiscalYearSummary`: lists all fiscal years, lock status, and financial summaries.
   - Implement `getComparativeProfitLoss`: side-by-side P&L comparison.
3. **Substep 5.3 — REST API Route Wiring in `route.ts`**:
   - Wire GET endpoints under `admin/accounting/reports/...` with RBAC and BOLA enforcement.
4. **Substep 5.4 — Comprehensive Test Suite & Regression Verification**:
   - Build `frontend/scratch/test_phase5a6_step5_retained_earnings_lockout.js` (35 assertions).
   - Execute full regression chain (Steps 1–4, Sales, Purchase, Security, TypeScript).
5. **Substep 5.5 — Final Independent Audit & Checkpoint Freeze**.

---

## 14. Gate Review Sign-Off & Status

- **Forensic & Architectural Gate**: **PASSED & COMPLETE** ✅
- **Production Implementation**: **NOT STARTED** 🛑
- **Database Baseline**: **VERIFIED PRISTINE** ✅
- **Current Position**: Awaiting explicit user authorization before initiating Step 5 implementation.
