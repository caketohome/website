# CakeToHome ERP — Phase 5A Step 6: Step 4 Forensic & Architecture Design Gate
## Fiscal Year-End Reopen / Reversal Architecture Design
### Milestone: `PHASE-5A-STEP-6-PERIOD-YEAR-END-CLOSE-STEP-4-REOPEN-DESIGN-01`
### Gate Classification: READ-ONLY FORENSIC & ARCHITECTURE DESIGN GATE — STRICT HALT PENDING AUTHORIZATION
### Date & Time: 2026-10-01T10:45:00+05:30 (IST)

---

## 1. Executive Summary

This document establishes the authoritative **Forensic & Architecture Design Gate** for **Phase 5A.6 Step 4: Year-End Reopen / Reversal** in CakeToHome ERP.

### Mandatory Compliance Assertions:
1. **Zero Implementation Executed**: Step 4 has **NOT** been implemented. No service methods, API routes, or UI components were created.
2. **Zero Database Mutations**: No production financial transactions, vouchers, journals, lines, settings, or fiscal periods have been created, modified, or deleted.
3. **Zero Schema Migrations / DDL**: The forensic audit proved that the existing PostgreSQL schema completely and natively supports compensating year-end reversals, bidirectional linking, and subsequent re-closes without any DDL modifications.
4. **Independent Baseline Verified**: Live PostgreSQL audit confirmed an immaculate baseline: **0 vouchers, 0 journals, 0 lines, 0 fiscal periods, 0 settings, 99 CoA accounts, 173 orders, 53 payments, 424 branch inventory rows, 0 competing locks**.
5. **Predecessors Verified**: Phase 5A.6 Step 1 (Diagnostics, 75/75), Step 2 (Monthly Lock/Unlock, 84/84), and Step 3 (Year-End Close Engine, 85/85) are all fully verified (cumulative 244/244 pass, TypeScript 0 errors).

---

## 2. Skills Assessment & Inspection Report

Per Section 2 of the project mandate, available skills were inspected:
- **Available & Applied Skills**:
  - `smart-coder`: Architecture-first inspection, root-cause analysis, and business invariant preservation.
  - `lazy-coder`: Minimum complexity, anti-duplication, maximum reuse of existing `PostingService.linkReversal` and `AccountingVoucherRepository`.
  - `postgresql-and-supabase`: Schema constraints, row locking, advisory locks, partial unique indexes, deferred triggers.
  - `api-design-and-security`: RESTful contract design, BOLA/IDOR protection, server-side session authentication.
  - `security-auditing-and-owasp`: 2-person Segregation of Duties (SoD), non-bypassable role checks, audit trail logging.
  - `clean-architecture`: Repository-service-controller layer boundaries and single-responsibility services.
  - `technical-documentation`: High-signal architectural specifications and evidence-based reports.
  - `systematic-debugging`: Multi-scenario verification matrix and regression isolation.
  - `git-workflow-and-releases`: Non-destructive git safety.
- **Unavailable Skills Reported**:
  - `accounting/ERP skill` (Not present; applied domain double-entry accounting principles and codebase conventions).
  - `financial accounting / double-entry accounting skill` (Not present; applied domain double-entry principles).
  - `fiscal-period / year-end-close accounting skill` (Not present; applied domain principles).
  - `report/financial-statement skill` (Not present; applied domain principles).
  - No custom ERP skills were invented.

---

## 3. Current Implementation Findings & Code Forensics

### 3.1 Fiscal Period Implementation (`fiscal-period.service.ts`)
- Monthly periods are managed with explicit statuses: `is_locked = false` (OPEN) and `is_locked = true` (LOCKED).
- Locking/unlocking enforces `SELECT ... FOR UPDATE` row-locking, `SUPER_ADMIN` authorization, and writes to `public.audit_log`.
- Unlocking an individual monthly period requires a mandatory >= 20 character reason.
- Period uniqueness is constrained by `uq_fiscal_period UNIQUE (fiscal_year, period_name)`.

### 3.2 Year-End Close Implementation (`period-close.service.ts`)
- Step 3 implemented `executeYearEndClose` within an atomic transaction protected by a PostgreSQL advisory lock:
  `SELECT pg_advisory_xact_lock(hashtext('year_end_close_' || $1))`.
- Validates 6 pre-close gates: configured periods, all 12 monthly periods locked, 0 unposted vouchers, 0 suspense (1119), 0 transit (1118), balanced Trial Balance.
- Zeroes 26 nominal leaf accounts (7 Revenue, 19 Expense) against Account 3210 (Retained Earnings).
- Optionally transfers Account 3120 (Partner Drawings) to 3210.
- Preserves Account 3300 (Opening Balance Offset) untouched.
- Auto-provisions the next fiscal year periods if absent.
- Creates an immutable voucher with `voucher_type = 'JOURNAL'`, `reference_type = 'YEAR_END_CLOSE'`, `reference_id = fiscal_year`, `reference_event = 'FISCAL_YEAR_CLOSE'`, and `status = 'POSTED'`.

### 3.3 Posting Engine & Guards (`posting.service.ts`)
- All operational postings call `PostingService.postVoucher`.
- `PostingService.validateFiscalPeriod` hard-blocks operational postings if `period.is_locked = true`.
- Noticeably, `PostingService.postVoucher` line 381 already contains:
  ```typescript
  const isClosingVoucher =
    voucher.reference_type === "YEAR_END_CLOSE" ||
    voucher.reference_type === "YEAR_END_REOPEN";
  await PostingService.validateFiscalPeriod(voucher.voucher_date, client, isClosingVoucher);
  ```
  The posting engine already recognizes `YEAR_END_REOPEN` vouchers as closing-class vouchers permitted to target closed/locked periods.
- `PostingService.linkReversal` provides the canonical primitive to link compensating vouchers:
  - Updates original voucher: `reversed_by_voucher_id = reversalVoucherId`.
  - Sets compensating voucher: `reversal_of_voucher_id = originalVoucherId`.
  - Sets original journal entry: `is_reversed = true, reversed_at = NOW()`.

### 3.4 Voucher Repository & Schema Constraints (`accounting_voucher`)
- `chk_voucher_status`: Only `'DRAFT', 'SUBMITTED', 'APPROVED', 'POSTED', 'CANCELLED'`.
- `chk_voucher_posted_immutable`: `((status)::text <> 'CANCELLED'::text) OR (posted_at IS NULL)` — **A posted voucher can NEVER be cancelled or deleted.**
- `chk_voucher_segregation`: `approved_by IS NULL OR approved_by <> created_by` — **Two-person rule is a hard database constraint.**
- `chk_voucher_reversal_limit`: `(reversal_of_voucher_id IS NULL) OR (reversed_by_voucher_id IS NULL)` — **A reversal voucher cannot itself be reversed via `reversed_by_voucher_id`.**
- `idx_accounting_voucher_source_idempotency`:
  `UNIQUE (reference_type, reference_id, reference_event) WHERE status <> 'CANCELLED' AND reference_type <> 'MANUAL'`.

---

## 4. Business Semantics of "Year-End Reopen" in CakeToHome

We explicitly distinguish six distinct accounting and operational concepts:

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│ 1. REOPEN FISCAL YEAR                                                          │
│    Governance state change allowing audited adjustments to a closed fiscal year. │
├─────────────────────────────────────────────────────────────────────────────────┤
│ 2. REVERSE YEAR-END CLOSING JOURNAL                                            │
│    The double-entry accounting operation: posting a compensating reversal       │
│    journal entry that inverts nominal account zeroing and Retained Earnings.   │
├─────────────────────────────────────────────────────────────────────────────────┤
│ 3. CANCEL / VOID CLOSING VOUCHER (PROHIBITED)                                  │
│    Impossible in PostgreSQL due to chk_voucher_posted_immutable. Historical     │
│    closing voucher remains POSTED forever and is linked via reversed_by_id.     │
├─────────────────────────────────────────────────────────────────────────────────┤
│ 4. REOPEN MONTHLY PERIODS (SELECTIVE & AUDITED)                                │
│    Reversing the close does NOT unlock all 12 monthly periods at once. Specific │
│    periods requiring correction must be unlocked individually with audit reason.│
├─────────────────────────────────────────────────────────────────────────────────┤
│ 5. REPOST CORRECTED TRANSACTIONS                                                │
│    Operational/adjusting vouchers posted to the unlocked month via standard GL.│
├─────────────────────────────────────────────────────────────────────────────────┤
│ 6. RE-CLOSE FISCAL YEAR                                                         │
│    Re-locking monthly periods, running diagnostics, and posting a NEW closing   │
│    journal entry for the updated final balances (Cycle N+1).                    │
└─────────────────────────────────────────────────────────────────────────────────┘
```

**Authoritative Semantic Rule**:
"Reopening a fiscal year" in CakeToHome ERP is strictly executed by **posting a compensating reversal voucher** that inverts the original closing journal lines, linking the vouchers bidirectionally via `PostingService.linkReversal`, and marking the original journal entry as `is_reversed = true`. The original close remains an indelible part of audit history.

---

## 5. Year-End Close Reversal Accounting Treatment

The compensating reversal voucher inverts the exact debits and credits of the original closing journal:

### 5.1 Net Profit Year ($\Pi > 0$):
- **Revenue Accounts** (normally credit): Original close debited revenue; Reversal **CREDITS** revenue accounts with their original closed balances.
- **Contra-Revenue Accounts** (4190 Sales Returns, normally debit): Original close credited 4190; Reversal **DEBITS** 4190.
- **Expense Accounts** (normally debit): Original close credited expense; Reversal **DEBITS** expense accounts with their original closed balances.
- **Contra-Expense Accounts** (5190 Purchase Discounts, normally credit): Original close debited 5190; Reversal **CREDITS** 5190.
- **Account 3210 Retained Earnings**: Original close credited 3210 with Net Profit $\Pi$; Reversal **DEBITS** 3210 with $\Pi$.
- **Double-Entry Balance**:
  $$\sum \text{Debits} \equiv \sum \text{Credits} = \text{Total Journal Amount} > ₹0.00$$

### 5.2 Net Loss Year ($\Pi < 0$, Loss $L = -\Pi$):
- **Revenue Accounts**: Reversal **CREDITS** revenue accounts.
- **Expense Accounts**: Reversal **DEBITS** expense accounts.
- **Account 3210 Retained Earnings**: Original close debited 3210 with Loss $L$; Reversal **CREDITS** 3210 with $L$.

### 5.3 Drawings Handling:
- If original close had `closeDrawingsToRetainedEarnings = true`:
  - Original close: Dr 3210 $D_{draw}$ / Cr 3120 $D_{draw}$.
  - Reversal: **Dr 3120 $D_{draw}$** (restores drawings balance) / **Cr 3210 $D_{draw}$** (restores retained earnings).
- If original close had `closeDrawingsToRetainedEarnings = false`:
  - Zero drawings lines in original close $\implies$ zero drawings lines in reversal.

### 5.4 Permanent Equity & Account 3300:
- Account 3300 (Opening Balance Offset) and Account 3110 (Partner Capital) are **never touched** by closing or reversal entries.

---

## 6. Subsequent-Year Safety Rules (Mandatory Forensic Gate)

The forensic inspection evaluated what happens if Year $N$ is reopened after Year $N+1$ has already received transactions:

### The Risk of Corrupting Downstream Financials:
In CakeToHome's continuous ledger architecture:
1. `BalanceSheetService` dynamically calculates Account 3220 (Current Year Net Earnings) as:
   $$\text{Dynamic 3220} = \text{Posted 3220 GL Balance} + (\text{Unclosed Revenue} - \text{Unclosed Expense})$$
2. If Year $N$ is reopened, its nominal accounts are no longer zeroed.
3. Therefore, if a Balance Sheet is generated for Year $N+1$, dynamic 3220 would **double-count Year $N$'s profit on top of Year $N+1$'s profit**, corrupting the Balance Sheet and Trial Balance!
4. Furthermore, if Year $N+1$ has already been closed, opening Year $N$ breaks the chronological chain of retained earnings.

### Authoritative Fail-Closed Safety Rules:
- **RULE 1 (DOWNSTREAM ACTIVITY HARD BLOCK)**:
  Reopening Year $N$ is **strictly prohibited** if Year $N+1$ contains ANY active posted vouchers:
  ```sql
  SELECT count(*) FROM public.accounting_voucher 
  WHERE fiscal_year = $nextFiscalYear 
    AND status = 'POSTED' 
    AND deleted_at IS NULL
  ```
  If `count > 0`, the reopen request is rejected with error:
  `SUBSEQUENT_YEAR_HAS_POSTED_ACTIVITY`:
  `"Cannot reopen fiscal year 'FY2425': subsequent fiscal year 'FY2526' already contains posted transactions. Reopening is blocked to prevent financial statement corruption."`
- **RULE 2 (DOWNSTREAM CLOSE HARD BLOCK)**:
  If Year $N+1$ has a posted closing voucher, Year $N$ cannot be reopened. Fiscal years must be reversed in strict reverse chronological order ($N+1$ must be reopened before $N$).
- **RULE 3 (PRIOR PERIOD ADJUSTMENTS IN N+1)**:
  Under Indian AS 8 / GAAP, once operational transactions are posted in Year $N+1$, prior-year audit corrections are recorded as **Prior Period Items** posted in Year $N+1$ directly to Retained Earnings (3210), rather than reopening Year $N$.

---

## 7. Control Model: Security, RBAC & Segregation of Duties (SoD)

### 7.1 Role Authorization
- Restricted strictly to **`SUPER_ADMIN`**.
- Branch staff, branch managers, delivery partners, and non-super-admin finance users are rejected with **HTTP 403 Forbidden**.
- Enterprise-wide scope only: the voucher branch is locked server-side to the Enterprise HQ branch (`br_01KYWH0RTHVHRD04J79T28RAHN`).

### 7.2 Two-Person Segregation of Duties (SoD)
- The compensating reversal voucher must be prepared and approved by two distinct individuals:
  $$\text{reopen\_preparer\_id} \neq \text{reopen\_approver\_id}$$
- Enforced at both:
  1. Service layer: `PeriodCloseService.reopenYearEndClose` throws `SEGREGATION_OF_DUTIES_VIOLATION`.
  2. Database layer: PostgreSQL constraint `chk_voucher_segregation` (`approved_by <> created_by`).
- `SUPER_ADMIN` **cannot self-approve** or self-post a year-end reopen. Two separate staff identities are strictly required.

### 7.3 Canonical Permissions
- Preparer requires `ACCOUNTING.POST` (or SUPER_ADMIN).
- Approver requires `ACCOUNTING.APPROVE` (or SUPER_ADMIN).
- Viewer/Preview requires `ACCOUNTING.VIEW`.
- Zero new permission strings or DDL needed.

---

## 8. Reopen Reason & Comprehensive Audit Model

### 8.1 Mandatory Reason Validation
- Reopening a finalized fiscal year is an extraordinary governance event.
- A mandatory audit reason of **at least 30 characters** is enforced:
  If `!reason || reason.trim().length < 30`, throw `REOPEN_REASON_TOO_SHORT`.
- Must detail the statutory audit findings, unrecorded year-end adjustments, or regulatory rationale.

### 8.2 Audit Log Specification
Step 4 records a structured event in `public.audit_log`:
- `id`: `aud_<hex>`
- `actor_id`: `reopen_approver_id`
- `actor_type`: `'staff'`
- `action`: `'accounting.fiscal_year_reopened'`
- `entity`: `'fiscal_year'`
- `entity_id`: `params.fiscal_year`
- `metadata`:
  ```json
  {
    "fiscal_year": "FY2425",
    "original_closing_voucher_id": "vch_01...",
    "original_closing_voucher_no": "VCH-JOURNAL-FY2425-...",
    "original_journal_entry_id": "jent_01...",
    "reversal_voucher_id": "vch_02...",
    "reversal_voucher_no": "VCH-JOURNAL-FY2425-...",
    "reversal_journal_entry_id": "jent_02...",
    "preparer_id": "usr_preparer_01",
    "approver_id": "usr_approver_02",
    "reason": "Statutory audit adjustment for FY2425...",
    "net_profit_reversed": 38000,
    "accounts_restored_count": 8,
    "drawings_reversed": 0,
    "action": "YEAR_END_REOPEN_POST",
    "timestamp": "2026-10-01T..."
  }
  ```

---

## 9. Idempotency, Concurrency & Locking Architecture

### 9.1 PostgreSQL Advisory Lock
```sql
SELECT pg_advisory_xact_lock(hashtext('year_end_close_' || $1));
```
- Reuses the exact same advisory key as `executeYearEndClose`.
- Guarantees that a close and a reopen for the same fiscal year **cannot run concurrently**.
- Serializes simultaneous reopen attempts: the first succeeds; the second sees `reversed_by_voucher_id IS NOT NULL` and fails closed with `YEAR_ALREADY_REOPENED`.

### 9.2 Row-Level Locking (`FOR UPDATE`)
- Locks all 12 fiscal periods of the year:
  ```sql
  SELECT * FROM public.accounting_fiscal_period WHERE fiscal_year = $1 FOR UPDATE
  ```
- Locks the original closing voucher:
  ```sql
  SELECT * FROM public.accounting_voucher WHERE id = $closingVoucherId FOR UPDATE
  ```

### 9.3 Source Event Idempotency & Database Partial Unique Index
- Compensating reversal voucher uses:
  - `voucher_type`: `'JOURNAL'`
  - `reference_type`: `'YEAR_END_REOPEN'`
  - `reference_id`: `original_closing_voucher.id` (unique voucher ID)
  - `reference_event`: `'YEAR_END_CLOSE_REVERSAL'`
- Because `reference_id` is the unique closing voucher ID, `idx_accounting_voucher_source_idempotency` guarantees at the database level that a closing voucher cannot be reversed more than once!

---

## 10. Historical Immutability & Re-Close Lifecycle

### 10.1 Preservation of History
- The original closing voucher $V_1$ is **never deleted or cancelled**.
- $V_1$ remains in status `'POSTED'`.
- $V_1$ receives `reversed_by_voucher_id = V_2.id`.
- Journal entry $J_1$ receives `is_reversed = true, reversed_at = NOW()`.
- Reversal voucher $V_2$ receives `reversal_of_voucher_id = V_1.id`.

### 10.2 Re-Close Cycle Architecture
When adjustments are complete and the year is closed again:
1. The new closing voucher $V_3$ is created.
2. How to avoid unique index collision with $V_1$?
   - $V_1$ had `reference_type = 'YEAR_END_CLOSE'`, `reference_id = 'FY2425'`, `reference_event = 'FISCAL_YEAR_CLOSE'`.
   - The query detecting prior closes checks:
     `WHERE reference_type = 'YEAR_END_CLOSE' AND reference_id = $1 AND reversed_by_voucher_id IS NULL`.
   - To support re-closing without index collision on `idx_accounting_voucher_source_idempotency`:
     The re-closing voucher uses a cycle-indexed event:
     - Close Cycle 1: `reference_event = 'FISCAL_YEAR_CLOSE'`
     - Close Cycle 2: `reference_event = 'FISCAL_YEAR_CLOSE_CYCLE_2'`
     - Close Cycle $k$: `reference_event = 'FISCAL_YEAR_CLOSE_CYCLE_' || k`
3. This completely eliminates index collision while maintaining 100% database idempotency for each cycle.

---

## 11. Financial Reporting Impact

| Financial Report | State: Before Reopen (Closed) | State: After Reopen (Reversed) | State: After Re-Close |
|---|---|---|---|
| **Trial Balance** (include closing) | Nominals = ₹0.00; 3210 has $\Pi$ | Nominals restored to pre-close balances; 3210 debited | Nominals zeroed again; 3210 has updated profit |
| **Trial Balance** (exclude closing) | Nominals show operating totals; 3210 prior balance | Nominals show operating totals; 3210 prior balance | Nominals show operating totals; 3210 prior balance |
| **Profit & Loss** (P&L) | Displays operating revenue, expense, and net profit $\Pi$ | Displays operating revenue, expense, and net profit $\Pi$ | Displays updated operating revenue, expense, and updated profit |
| **Balance Sheet** | 3210 has $\Pi$; dynamic 3220 = ₹0.00; Assets = Liab + Equity | 3210 prior balance; dynamic 3220 = $\Pi$; Assets = Liab + Equity | 3210 has updated profit; dynamic 3220 = ₹0.00; Assets = Liab + Equity |
| **Cash Flow Statement** | Unaffected (touches 0 cash accounts) | Unaffected (touches 0 cash accounts) | Unaffected (touches 0 cash accounts) |
| **General Ledger** | Closing journal zeroing balances visible | Original close (marked reversed) + Reversal journal visible | Full audit trail of all 3 vouchers visible |

---

## 12. Proposed API Contracts (Design Only — Not Implemented)

### 12.1 Preview Year-End Reopen
- **Method**: `GET`
- **Path**: `/api/v1/admin/accounting/period-close/reopen/preview`
- **Query**: `?fiscal_year=FY2425`
- **Authorization**: `SUPER_ADMIN` with `ACCOUNTING.VIEW`
- **Response**:
  ```json
  {
    "fiscal_year": "FY2425",
    "can_reopen": true,
    "closing_voucher": {
      "id": "vch_01...",
      "voucher_no": "VCH-JOURNAL-FY2425-...",
      "voucher_date": "2025-03-31",
      "total_amount": 106000.00,
      "net_profit": 38000.00
    },
    "blocking_checks": [],
    "warnings": [],
    "projected_reversal_lines_count": 8,
    "projected_retained_earnings_impact": -38000.00
  }
  ```

### 12.2 Execute Year-End Reopen
- **Method**: `POST`
- **Path**: `/api/v1/admin/accounting/period-close/reopen`
- **Body**:
  ```json
  {
    "fiscal_year": "FY2425",
    "reason": "Statutory audit adjustment: accrual corrections and depreciation recalculation required for FY2425.",
    "preparer_id": "usr_preparer_01",
    "approver_id": "usr_approver_02"
  }
  ```
- **Authorization**: `SUPER_ADMIN` only; SoD enforced (`preparer_id !== approver_id`).
- **Response**:
  ```json
  {
    "success": true,
    "fiscal_year": "FY2425",
    "original_voucher_id": "vch_01...",
    "reversal_voucher_id": "vch_02...",
    "reversal_voucher_no": "VCH-JOURNAL-FY2425-...",
    "reversal_journal_entry_id": "jent_02...",
    "net_profit_reversed": 38000.00,
    "accounts_restored_count": 8,
    "message": "Fiscal year 'FY2425' reopened successfully via compensating reversal voucher. Retained earnings adjusted by ₹-38,000.00."
  }
  ```

---

## 13. Proposed Error Codes

| Error Code | HTTP Status | Trigger Condition |
|---|---|---|
| `UNAUTHORIZED` | 403 | Non-SUPER_ADMIN caller attempts reopen |
| `INVALID_FISCAL_YEAR` | 400 | Malformed fiscal year format |
| `FISCAL_PERIOD_NOT_CONFIGURED` | 400 | Fiscal year has no configured periods |
| `FISCAL_YEAR_NOT_CLOSED` | 400 | Fiscal year does not have an active closing voucher |
| `YEAR_ALREADY_REOPENED` | 409 | Closing voucher was already reversed |
| `REOPEN_REASON_TOO_SHORT` | 400 | Audit reason is missing or < 30 characters |
| `INVALID_ACTORS` | 400 | Missing `preparer_id` or `approver_id` |
| `SEGREGATION_OF_DUTIES_VIOLATION` | 400 | `preparer_id === approver_id` |
| `SUBSEQUENT_YEAR_HAS_POSTED_ACTIVITY` | 409 | Year $N+1$ contains active posted vouchers |
| `SUBSEQUENT_YEAR_ALREADY_CLOSED` | 409 | Year $N+1$ is closed and must be reversed first |
| `UNPOSTED_VOUCHERS_EXIST` | 409 | Pending unposted vouchers block transition |
| `DUPLICATE_SOURCE_EVENT` | 409 | DB unique index collision on duplicate reversal |

---

## 14. 27-Scenario Verification Test Plan (For Future Execution)

When implementation is authorized, Step 4 will be validated against this comprehensive 27-test suite:

1. **Pre-Test PostgreSQL Baseline Audit**: Zero vouchers, journals, lines, settings, pristine CoA.
2. **Export & Signature Sanity**: Verify `reopenYearEndClose` and `previewYearEndReopen` exist.
3. **Unauthenticated Rejection**: 401 on unauthenticated call.
4. **RBAC Guard**: 403 on non-SUPER_ADMIN staff.
5. **SoD Guard**: Reject when `preparer_id === approver_id`.
6. **Missing Actors Guard**: Reject when actor IDs are empty.
7. **Reason Validation Guard**: Reject reason < 30 characters.
8. **Unconfigured Fiscal Year Guard**: Reject unconfigured FY.
9. **Unclosed Year Guard**: Reject reopen if FY was never closed.
10. **Duplicate Reopen Guard**: Reject repeated reopen on already reversed close.
11. **Subsequent Year Posted Activity Guard**: Reject reopen when Year N+1 has posted vouchers.
12. **Subsequent Year Closed Guard**: Reject reopen when Year N+1 is closed.
13. **Preview Year-End Reopen**: Read-only dry run returns accurate metrics, 0 DB mutations.
14. **End-to-End Reversal (Net Profit Case)**: Inverts ₹38,000 profit, restores 8 nominal accounts, debits 3210.
15. **End-to-End Reversal (Net Loss Case)**: Inverts ₹-40,000 loss, credits 3210 with ₹40,000.
16. **Drawings Case A (Disabled)**: Drawings account 3120 untouched.
17. **Drawings Case B (Enabled)**: Drawings transfer inverted (Dr 3120 / Cr 3210).
18. **Account 3300 Invariant**: Opening balance equity untouched throughout.
19. **Bidirectional Linkage**: Original voucher has `reversed_by_id`; reversal has `reversal_of_id`.
20. **Journal Entry Invariant**: Original journal marked `is_reversed = true, reversed_at = NOW()`.
21. **Double-Reversal Limit**: DB constraint `chk_voucher_reversal_limit` blocks reversing the reversal.
22. **Trial Balance Invariant Post-Reversal**: Total Debits === Total Credits.
23. **Balance Sheet Math Post-Reversal**: Assets === Liabilities + Equity ($variance < 0.01$).
24. **Concurrency & Advisory Lock**: Simultaneous reopens serialize; duplicate fails.
25. **Atomic Rollback on Simulated Failure**: 0 orphan vouchers on failure.
26. **Audit Trail Verification**: Exactly 1 `accounting.fiscal_year_reopened` event with full metadata.
27. **Full Re-Close Lifecycle**: Closed $\to$ Reopened $\to$ Adjustments $\to$ Re-closed (Cycle 2) with distinct source event.

---

## 15. Independent Database Baseline Derivation

Executed against live Supabase PostgreSQL at 2026-10-01T10:44:06 IST:
- `accounting_voucher`: **0**
- `accounting_journal_entry`: **0**
- `accounting_journal_line`: **0**
- `accounting_fiscal_period`: **0**
- `setting` (accounting): **0** (`accounting_start_date` UNCONFIGURED)
- `accounting_account` (Active CoA): **99**
- `order`: **173**
- `payment_transaction`: **53**
- `branch_inventory`: **424**
- `idle transactions`: **0**
- `ungranted locks`: **0**
- `residual YEAR_END_CLOSE vouchers`: **0**
- `accounting audit logs`: **0 (NONE)**

---

## 16. Unresolved Questions & Risks

1. **Trial Balance Exclude Closing Filter**:
   `AccountingJournalRepository.getTrialBalance` currently filters `v.reference_type != 'YEAR_END_CLOSE'`.
   When implementing Step 4, this should be updated to `v.reference_type NOT IN ('YEAR_END_CLOSE', 'YEAR_END_REOPEN')` so that P&L reports in unclosed mode exclude both close and reopen vouchers.
2. **Cycle Event Indexing**:
   Re-closing after a reopen must increment the cycle index (e.g. `FISCAL_YEAR_CLOSE_CYCLE_2`) to prevent index collision on `idx_accounting_voucher_source_idempotency`.

---

## 17. Final Hard Stop Assertion

- **Phase 5A.6 Step 4 Status**: **FORENSIC & DESIGN GATE COMPLETE — AWAITING IMPLEMENTATION AUTHORIZATION**
- **Implementation Status**: **STRICTLY NOT IMPLEMENTED**.
- **System State**: **HALTED**.
