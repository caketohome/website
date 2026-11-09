# Phase C7.6 Step 2 Checkpoint: Accounting Repository Cost-Centre Propagation

## 1. Overview & Objective
In Phase C7.6 Step 2, the repository-layer omission discovered during the initial forensic analysis has been fixed.
The database schema (`public.accounting_voucher.cost_centre_id` and `public.accounting_journal_line.cost_centre_id`) and domain types already supported `cost_centre_id`, but the data access repositories were discarding this dimension during INSERT statements.

Step 2 successfully implemented and verified end-to-end dimension propagation:
- **Upstream Service / Input** → **`AccountingVoucherRepository`** → `public.accounting_voucher.cost_centre_id`
- **Posting Service / Workflow** → **`AccountingJournalRepository`** → `public.accounting_journal_line.cost_centre_id`
- **Retrieval & Enrichment** → `findLinesByEntryId`, `findDetail`, `findManualJournalDetail` enrich lines with `cost_centre_code` and `cost_centre_name` via `LEFT JOIN public.cost_centre cc ON cc.id = jl.cost_centre_id`.
- **Backward Compatibility**: `NULL` remains 100% supported and non-mandatory.
- **Accounting Invariance**: Debit/credit amounts, trial balance, and Chart of Accounts remain completely unchanged.

---

## 2. Exact Files Modified

1. [`src/lib/types/accounting.types.ts`](file:///e:/vig/cakes2home-main/cakes2home-main/frontend/src/lib/types/accounting.types.ts):
   - `ManualJournalLineItem`: Added optional `cost_centre_id?: string | null;`, `cost_centre_code?: string;`, `cost_centre_name?: string;`.
   - `ManualJournalDraftInput`: Added optional `cost_centre_id?: string | null;`.
   - `ManualJournalUpdateDraftInput`: Added optional `cost_centre_id?: string | null;`.
2. [`src/lib/repositories/accounting-voucher.repository.ts`](file:///e:/vig/cakes2home-main/cakes2home-main/frontend/src/lib/repositories/accounting-voucher.repository.ts):
   - `createDraft`: Included `cost_centre_id` in `INSERT INTO public.accounting_voucher` column and parameter list.
   - `createManualJournalDraft`: Included `cost_centre_id` in column and parameter list.
   - `validateManualJournalLines`: Retained `cost_centre_id: l.cost_centre_id?.trim() || null`.
   - `findDetail`: Enriched `linesSql` with `cc.code AS cost_centre_code, cc.name AS cost_centre_name` via `LEFT JOIN public.cost_centre cc ON cc.id = jl.cost_centre_id`.
   - `findManualJournalDetail`: Enriched posted `linesSql` with `cc.code AS cost_centre_code, cc.name AS cost_centre_name` via `LEFT JOIN public.cost_centre cc ON cc.id = jl.cost_centre_id`.
3. [`src/lib/repositories/accounting-journal.repository.ts`](file:///e:/vig/cakes2home-main/cakes2home-main/frontend/src/lib/repositories/accounting-journal.repository.ts):
   - `createJournalEntry`: Included `cost_centre_id` in `INSERT INTO public.accounting_journal_line` column list (`$10`) and parameter list (`line.cost_centre_id ?? null`).
   - `findLinesByEntryId`: Enriched query with `cc.code AS cost_centre_code, cc.name AS cost_centre_name` via `LEFT JOIN public.cost_centre cc ON cc.id = jl.cost_centre_id`.
4. [`src/lib/services/manual-journal.service.ts`](file:///e:/vig/cakes2home-main/cakes2home-main/frontend/src/lib/services/manual-journal.service.ts):
   - `CreateManualJournalDraftServiceParams`: Added optional `cost_centre_id?: string | null;`.
   - `createDraft`: Passed `cost_centre_id` to `createManualJournalDraft`.
   - `postToGL`: Mapped `cost_centre_id: l.cost_centre_id || voucher.cost_centre_id || null` into canonical `JournalLineInput`.

---

## 3. Verification & Empirical Test Results

### A. Phase C7.6 Step 2 Propagation Test Suite (`scratch/test_phase_c7_6_step2_propagation.js`)
**Result: 17 / 17 PASSED (100% Green)**
- Test 1: Voucher with NULL `cost_centre_id` persists cleanly (`cost_centre_id === null`).
- Test 2: Voucher with valid `cost_centre_id` persists cleanly to `accounting_voucher.cost_centre_id`.
- Test 3: Journal line with NULL `cost_centre_id` persists to `accounting_journal_line`.
- Test 4: Journal line with valid `cost_centre_id` persists to `accounting_journal_line`.
- Test 5: Retrieved journal line returns correct `cost_centre_id`.
- Test 6: Retrieved journal line returns correct `cost_centre_code` via LEFT JOIN.
- Test 7: Retrieved journal line returns correct `cost_centre_name` via LEFT JOIN.
- Test 8: LEFT JOIN strictly preserves lines with NULL `cost_centre_id` without data loss or dropping.
- Test 9: Multiple lines with different cost centres in the same entry remain distinct.
- Test 10: Existing journal amounts remain unchanged by cost-centre dimension.
- Test 11: Existing voucher totals remain unchanged by cost-centre dimension.
- Test 12: Trial balance remains perfectly balanced (`total_dr === total_cr`).
- Test 13: Invalid cost-centre references are strictly rejected by PostgreSQL foreign key constraint (`23503`).
- Test 14: No cross-branch authorization regression: BOLA branch isolation preserved.
- Test 15: Manual journal flow persists cost centres through workflow and enriches details.
- Test 16: CRITICAL INTEGRATION: Upstream cost centre propagates to voucher, journal line, and `findDetail` enrichment.
- Test 17: Database baseline perfectly restored: CoA = 100, TB = ₹3,380.00 Dr / Cr, zero residual test records.

### B. Independent PostgreSQL Audit (`scratch/audit_c7_6_step2_post_db.js`)
**Result: 12 / 12 AUDIT CHECKS PASSED (100% Green)**
- Check 1: Chart of Accounts count is exactly 100 (actual: 100).
- Check 2: Trial Balance strictly balanced: Dr ₹3,380.00 = Cr ₹3,380.00 (diff: ₹0.00).
- Check 3: Accounting voucher count unchanged (actual: 6).
- Check 4: Accounting journal entry count unchanged (actual: 4).
- Check 5: Accounting journal line count unchanged (actual: 10).
- Check 6: Zero vouchers have `cost_centre_id` (actual: 0).
- Check 7: Zero journal lines have `cost_centre_id` (actual: 0).
- Check 8: Cost centre test data fully cleaned (actual: 0 rows in `public.cost_centre`).
- Check 9: Zero orphan journal lines (actual: 0).
- Check 10: Zero orphan journal entries (actual: 0).
- Check 11: Both cost_centre foreign keys remain valid and active (`accounting_journal_line_cost_centre_id_fkey`, `accounting_voucher_cost_centre_id_fkey`).
- Check 12: Zero blocked database locks (actual: 0).

### C. TypeScript Typecheck (`npx tsc --noEmit`)
- **Exit Code:** `0`
- **Diagnostics:** `0 errors, 0 warnings`
- **Strict Compliance:** Zero `any`, `@ts-ignore`, `@ts-expect-error`, or unsafe type assertions introduced.

---

## 4. Frozen Predecessor Regression Matrix

All frozen predecessor suites executed sequentially against active PostgreSQL with zero test modifications:

| Suite | File | Assertions | Result |
|---|---|---|---|
| **C4.1** | `scratch/test_phase_c4_1_api_settlement.js` | 99 / 99 | **PASSED** |
| **C5** | `scratch/test_c5_expense_accounting.js` | 40 / 40 | **PASSED** |
| **C6.1** | `scratch/test_c6_1_persistence.js` | 51 / 51 | **PASSED** |
| **C7.2** | `scratch/test_phase_c7_2_comprehensive.js` | 32 / 32 | **PASSED** |
| **C7.3** | `scratch/test_phase_c7_3_payment_teller.js` | 55 / 55 | **PASSED** |
| **C7.4** | `scratch/test_phase_c7_4_bills_receivable.js` | 62 / 62 | **PASSED** |
| **C7.5** | `scratch/test_phase_c7_5_branch_cash.js` | 60 / 60 | **PASSED** |
| **C7.6 Step 1** | `scratch/test_phase_c7_6_step1_cost_centre.js` | 24 / 24 | **PASSED** |
| **C7.6 Step 2** | `scratch/test_phase_c7_6_step2_propagation.js` | 17 / 17 | **PASSED** |

---

## 5. Scope Invariants & Strict Stop Protocol
- **Strictly Completed:** Step 2 accounting repository propagation and retrieval enrichment.
- **Strictly Excluded / Not Implemented:**
  - ❌ Cost allocation engine
  - ❌ Allocation rules / percentage allocation / equal split
  - ❌ Chart of Accounts changes or new GL accounts
  - ❌ Reporting endpoints or cost centre P&L reports
  - ❌ Dashboard UI workspace
  - ❌ Phase C7.7
- **Git Hygiene:** Zero git commits, zero git pushes.
- **Status:** **PHASE C7.6 STEP 2 IS COMPLETE, AUDITED, AND FROZEN.**
