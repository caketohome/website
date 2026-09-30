# CAKETOHOME ERP — PHASE 4F STEP 1B: REVERSAL LIFECYCLE ALIGNMENT CHECKPOINT

- **Date**: 2026-09-24 09:30:00 IST
- **Project**: CakeToHome ERP (`E:\vig\cakes2home-main\cakes2home-main`)
- **Git Branch**: `task/dev`
- **Git HEAD**: `f7d9a47` (unchanged)
- **Status**: PHASE 4F STEP 1B COMPLETE — REVERSAL LIFECYCLE ALIGNED WITH LIVE DB SCHEMA & PHASE 4A DESIGN

---

## 1. Executive Summary & Objective

In the Phase 4F Step 1 forensic audit, a blocking defect was discovered: `AccountingVoucherRepository.markReversed` attempted to execute `UPDATE public.accounting_voucher SET status = 'REVERSED'`, which violated the live PostgreSQL constraint `chk_voucher_status` (`CHECK (status IN ('DRAFT', 'SUBMITTED', 'APPROVED', 'POSTED', 'CANCELLED'))`).

In Phase 4F Step 1B, the repository and TypeScript type definitions were strictly aligned with the **authoritative live database schema** and the **Phase 4A accounting design specification**:
1. `REVERSED` was removed from `VoucherStatus` and `VALID_VOUCHER_STATUSES`.
2. `ALLOWED_TRANSITIONS` in `accounting-voucher.repository.ts` now defines `POSTED: []` as a terminal status in the forward-only voucher status state machine.
3. Reversal is represented exclusively through Phase 4A audit linkages:
   - Original voucher remains in status `POSTED`, with `reversed_by_voucher_id` referencing the compensating reversal voucher.
   - Reversal voucher reaches status `POSTED`, with `reversal_of_voucher_id` referencing the original voucher.
   - Linked general ledger journal entry is flagged with `is_reversed = true` and `reversed_at = NOW()`.
   - DB constraint `chk_voucher_reversal_limit` (`reversal_of_voucher_id IS NULL OR reversed_by_voucher_id IS NULL`) enforces that a reversal voucher cannot itself be reversed.
4. No database schema modifications were made.
5. No PostingService was implemented. No vouchers or journals were created.

---

## 2. Forensic Confirmation of Live Database Schema

Live PostgreSQL inspection via database catalog queries confirmed:
- `public.accounting_voucher`:
  - `status`: `character varying`, default `'DRAFT'`
  - Constraint `chk_voucher_status`: `CHECK (((status)::text = ANY ((ARRAY['DRAFT'::character varying, 'SUBMITTED'::character varying, 'APPROVED'::character varying, 'POSTED'::character varying, 'CANCELLED'::character varying])::text[])))`
  - Reversal fields: `reversed_by_voucher_id` (TEXT, FK), `reversal_of_voucher_id` (TEXT, FK)
  - Constraint `chk_voucher_reversal_limit`: `CHECK (((reversal_of_voucher_id IS NULL) OR (reversed_by_voucher_id IS NULL)))`
  - Constraint `chk_voucher_posted_immutable`: `CHECK ((((status)::text <> 'CANCELLED'::text) OR (posted_at IS NULL)))`
- `public.accounting_journal_entry`:
  - `is_reversed`: `boolean`, not null, default `false`
  - `reversed_at`: `timestamp with time zone`, nullable
  - `voucher_id`: `text`, not null, unique, FK -> `accounting_voucher(id)`
  - Note: No `reversal_of_entry_id` column exists in `accounting_journal_entry`. The reversal lineage is maintained strictly via the voucher relationship.

---

## 3. Phase 4A Reversal Semantics

In accordance with Phase 4A Accounting Schema Design ([`CHECKPOINTS/phase4a-accounting-schema-design-01.md`](file:///e:/vig/cakes2home-main/cakes2home-main/frontend/CHECKPOINTS/phase4a-accounting-schema-design-01.md#L420-L427)):
- A posted voucher is an immutable accounting document. Its status remains `'POSTED'` perpetually.
- Correcting an erroneous or returned transaction is accomplished by posting a distinct, compensating `REVERSAL` voucher with equal opposing debit and credit lines.
- The original voucher records `reversed_by_voucher_id = <reversal_voucher_id>`.
- The compensating voucher records `reversal_of_voucher_id = <original_voucher_id>`.
- The original journal entry is updated to `is_reversed = true` and `reversed_at = NOW()`.
- Both the original voucher and the compensating voucher maintain full auditability in the General Ledger.

---

## 4. Exact Code Changes

### File 1: `frontend/src/lib/types/accounting.types.ts`
- **Line 66–73**: Removed `"REVERSED"` from `VoucherStatus` union:
  ```typescript
  export type VoucherStatus =
    | "DRAFT"
    | "SUBMITTED"
    | "APPROVED"
    | "POSTED"
    | "CANCELLED";
  ```
- **Line 312–319**: Removed `"REVERSED"` from `VALID_VOUCHER_STATUSES` constant array.

### File 2: `frontend/src/lib/repositories/accounting-voucher.repository.ts`
- **Lines 8–11**: Updated architecture documentation to reflect that `POSTED` is terminal and reversals are modeled via linkage.
- **Lines 58–64**: Removed `"REVERSED"` from `ALLOWED_TRANSITIONS`, setting `POSTED: []` and `CANCELLED: []`.
- **Lines 455–535**: Replaced `markReversed` with `recordReversalLinkage` (and backward-compatible wrapper `markReversed`):
  - Requires caller-owned `PoolClient`.
  - Verifies original voucher exists and is `deleted_at IS NULL`.
  - Enforces `current.status === 'POSTED'` (rejects non-posted vouchers).
  - Enforces `!current.reversed_by_voucher_id` (rejects already-reversed vouchers).
  - Enforces `!current.reversal_of_voucher_id` (enforces `chk_voucher_reversal_limit` — a reversal voucher cannot be reversed).
  - Enforces branch scoping when `branchId` is supplied.
  - Updates only `reversed_by_voucher_id = $1` and `updated_at = NOW()`.
  - **Does NOT execute `SET status = 'REVERSED'`**.

---

## 5. Live Database Safety & Unchanged Counts

Executed independent verification against live PostgreSQL database:

| Table | Expected Count | Live Count | Invariant Status |
| :--- | :--- | :--- | :--- |
| `public.accounting_account` | 98 | **98** (24 groups, 74 posting) | PASS |
| `public.accounting_voucher` | 0 | **0** | PASS |
| `public.accounting_journal_entry` | 0 | **0** | PASS |
| `public.accounting_journal_line` | 0 | **0** | PASS |
| `public.accounting_fiscal_period` | 0 | **0** | PASS |
| `public."order"` | 173 | **173** | PASS |
| `public.payment_transaction` | 53 | **53** | PASS |
| `public.branch_inventory` | 424 | **424** | PASS |

- `accounting_start_date`: **UNCONFIGURED** (`0` rows in `public.setting`).
- `branch_inventory`: Confirmed **NO cost columns** (`unit_cost`, `avg_cost`, `mwa_cost` absent).
- Historical operational tables (`order`, `payment_transaction`, `branch_inventory`): **Zero mutations**.

---

## 6. Security Regression & TypeScript Results

1. **Security Regression Suite (`scripts/run-security-regression-tests.ps1`)**:
   - Total Tests: 21
   - Passed: 21
   - Failed: 0
   - Result: **100% PASS** (Fail-closed API guards, timing-safe JWT, RBAC boundaries, customer IDOR defense, secret safety, SSRF validation).
2. **PostgreSQL Health & Safety Check (`scripts/verify-postgres-safety.js`)**:
   - Connection Latency: 327ms, Ping: 47ms
   - Health check: **ALL CHECKS PASSED**.
3. **TypeScript Compilation (`tsc --noEmit`)**:
   - Result: Exit code `0`. Zero diagnostics, zero errors, zero warnings.

---

## 7. Git Forensics

- **Commit Status**: Zero new commits. HEAD remains `f7d9a47`.
- **Push Status**: Zero pushes.
- **Staging Status**: Zero files staged for commit.
- **Modified Tracked Files**:
  - `frontend/src/lib/repositories/index.ts` (uncommitted export additions from Step 1)
- **Untracked Accounting Files**:
  - `frontend/src/lib/types/accounting.types.ts`
  - `frontend/src/lib/repositories/accounting-account.repository.ts`
  - `frontend/src/lib/repositories/accounting-voucher.repository.ts`
  - `frontend/src/lib/repositories/accounting-journal.repository.ts`
  - `frontend/src/lib/repositories/accounting-fiscal-period.repository.ts`

---

## 8. Mandatory Boundary Declarations

- **Phase 4F Step 2 PostingService has NOT been implemented.**
- **Posting has NOT occurred.**
- **Historical transactions remain untouched.**
- **Accounting start date remains unconfigured.**
- **Fiscal periods remain unconfigured.**
