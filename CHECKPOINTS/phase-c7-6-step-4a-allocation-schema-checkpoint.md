# PHASE C7.6 STEP 4A — COST ALLOCATION SCHEMA FOUNDATION
## IMPLEMENTATION & INDEPENDENT VERIFICATION CHECKPOINT

- **Date / Time**: 2026-10-09T07:43:00+05:30
- **Status**: 🔒 **PHASE C7.6 STEP 4A COMPLETE & VERIFIED — ZERO GIT COMMITS / PUSHES (STRICT STOP PROTOCOL ENFORCED)**
- **System**: CakeToHome ERP
- **Phase**: C7.6 — Cost Centre Accounting
- **Step**: Step 4A — Cost Allocation Engine & Rules: Normalized Table Foundation

---

### 1. Executive Summary & Locked Architectural Decisions
In accordance with the approved forensic design, Phase C7.6 Step 4A establishes the additive, normalized database foundation for the cost allocation subsystem:
1. **Allocation Basis Locked**: Fixed percentages (`FIXED_PERCENTAGE`) is locked as the initial supported calculation method. Dynamic revenue-based (`REVENUE_RATIO`) and equal-split (`EQUAL_SPLIT`) methods are established in the schema enum but remain inactive until separately authorized.
2. **Accounting Treatment Locked**: Direct cost offset (credit source cost centre and debit destination cost centres using the same eligible operational expense account), strictly preserving the 100-account Chart of Accounts without introducing new GL accounts.
3. **Approval Controls Locked**: Segregation of Duties (SoD) enforced in schema with distinct `executed_by` and `approved_by` fields. Reversals are compensating only via cross-linked `reversal_voucher_id` and `reversed_by` fields; historical records are strictly immutable.
4. **Attribution Safeguard**: Allocations strictly apply to shared indirect expenses governed by an active rule and verified source balance. Direct branch-specific expenses remain attributed directly to operating branches.

---

### 2. Normalized Tables Created (`public`)

#### Table 1: `public.cost_allocation_rule`
- **Columns (16)**: `id` (PK), `rule_code` (VARCHAR(50), UNIQUE), `name`, `description`, `rule_type` (VARCHAR(30)), `source_cost_centre_id` (FK `cost_centre`), `source_account_id` (FK `accounting_account`), `version` (INT, def 1), `is_active` (BOOL, def true), `effective_from` (DATE), `effective_to` (DATE), `metadata` (JSONB), `created_by` (FK `user`), `created_at`, `updated_at`, `deleted_at`.
- **Check Constraint**: `chk_cost_allocation_rule_type` (`rule_type IN ('FIXED_PERCENTAGE', 'REVENUE_RATIO', 'EQUAL_SPLIT')`).
- **Indexes**: `idx_cost_allocation_rule_code`, `idx_cost_allocation_rule_source_cc`, `idx_cost_allocation_rule_source_acct`, `idx_cost_allocation_rule_active`.

#### Table 2: `public.cost_allocation_rule_target`
- **Columns (8)**: `id` (PK), `rule_id` (FK `cost_allocation_rule` ON DELETE CASCADE), `target_cost_centre_id` (FK `cost_centre`), `target_account_id` (FK `accounting_account`, nullable), `percentage` (NUMERIC(7,4)), `sort_order` (INT), `created_at`, `updated_at`.
- **Check Constraint**: `chk_target_percentage` (`percentage > 0 AND percentage <= 100`).
- **Unique Constraint**: `uq_rule_target_cc` on `(rule_id, target_cost_centre_id)`.
- **Indexes**: `idx_rule_target_rule_id`, `idx_rule_target_cc_id`, `idx_rule_target_acct_id`.

#### Table 3: `public.cost_allocation_run`
- **Columns (25)**: `id` (PK), `run_number` (VARCHAR(50), UNIQUE), `rule_id` (FK `cost_allocation_rule`), `rule_version` (INT), `fiscal_year` (VARCHAR(20)), `period_name` (VARCHAR(50)), `allocation_date` (DATE), `source_cost_centre_id` (FK `cost_centre`), `source_account_id` (FK `accounting_account`), `total_source_amount` (NUMERIC(15,2)), `total_allocated_amount` (NUMERIC(15,2)), `rounding_difference` (NUMERIC(15,2), def 0.00), `status` (VARCHAR(30)), `accounting_voucher_id` (FK `accounting_voucher`), `reversal_voucher_id` (FK `accounting_voucher`), `rule_snapshot` (JSONB), `narration` (TEXT), `metadata` (JSONB), `executed_by` (FK `user`), `executed_at`, `approved_by` (FK `user`), `approved_at`, `reversed_by` (FK `user`), `reversed_at`, `reversal_reason` (TEXT).
- **Check Constraint**: `chk_cost_allocation_run_status` (`status IN ('PREVIEW', 'DRAFT', 'SUBMITTED', 'POSTED', 'REVERSED')`).
- **Indexes**: `idx_cost_allocation_run_rule_id`, `idx_cost_allocation_run_period`, `idx_cost_allocation_run_voucher`, `idx_cost_allocation_run_status`.

#### Table 4: `public.cost_allocation_run_line`
- **Columns (9)**: `id` (PK), `run_id` (FK `cost_allocation_run` ON DELETE CASCADE), `source_journal_line_id` (FK `accounting_journal_line`), `target_cost_centre_id` (FK `cost_centre`), `target_account_id` (FK `accounting_account`), `target_percentage` (NUMERIC(7,4)), `allocated_amount` (NUMERIC(15,2)), `sort_order` (INT), `created_at`.
- **Indexes**: `idx_cost_allocation_run_line_run_id`, `idx_cost_allocation_run_line_target_cc`, `idx_cost_allocation_run_line_target_acct`, `idx_cost_allocation_run_line_source_jl`.

---

### 3. Migration & Verification Artifacts

1. **Migration Script**: [`migrate_phase_c7_6_step4a_cost_allocation_schema.js`](file:///e:/vig/cakes2home-main/cakes2home-main/frontend/migrate_phase_c7_6_step4a_cost_allocation_schema.js)
   - Atomic transaction (`BEGIN ... COMMIT` with `ROLLBACK` on error).
   - Pre-migration baseline check (CoA = 100, TB balanced).
   - Additive DDL with `IF NOT EXISTS`.
   - Post-migration confirmation.
   - Idempotency verified: re-running produces zero errors and zero duplicate objects.

2. **Independent PostgreSQL Audit**: [`scratch/audit_c7_6_step4a_schema_db.js`](file:///e:/vig/cakes2home-main/cakes2home-main/frontend/scratch/audit_c7_6_step4a_schema_db.js)
   - **Result**: **18 / 18 AUDIT CHECKS PASSED (100% Green)**
     - Checks 1–4: All 4 tables exist in `information_schema`.
     - Checks 5–8: Exact column counts and types confirmed across all 4 tables.
     - Check 9: All 18 foreign key constraints verified and active.
     - Check 10: Check constraints verified (`chk_cost_allocation_rule_type`, `chk_target_percentage`, `chk_cost_allocation_run_status`).
     - Check 11: Unique constraints verified (`rule_code`, `uq_rule_target_cc`, `run_number`).
     - Check 12: Chart of Accounts count strictly preserved at exactly 100 accounts.
     - Check 13: Trial Balance strictly balanced at Dr ₹3,380.00 === Cr ₹3,380.00 (diff: ₹0.00).
     - Check 14: Accounting voucher count unchanged (6).
     - Check 15: Accounting journal entry count unchanged (4).
     - Check 16: Accounting journal line count unchanged (10).
     - Check 17: Historical vouchers and lines have 0 cost-centre references (zero backfill).
     - Check 18: Accounting tables have zero pending or ungranted database locks.

---

### 4. Regression & Compiler Verification

- **TypeScript Typecheck (`npx tsc --noEmit`)**: **0 errors, 0 warnings** (Exit code 0).
- **Phase C7.6 Step 3 Regression Suite (`scratch/test_phase_c7_6_step3_coa_governance.js`)**: **16 / 16 PASSED** ✅
- **Phase C7.6 Step 2 Propagation Suite (`scratch/test_phase_c7_6_step2_propagation.js`)**: **17 / 17 PASSED** ✅
- **Phase C7.6 Step 1 Cost Centre Master Suite (`scratch/test_phase_c7_6_step1_cost_centre.js`)**: **24 / 24 PASSED** ✅
- **Chart of Accounts Invariant**: Exactly 100 accounts (0 accounts created, modified, or deleted).
- **Trial Balance Invariant**: Dr ₹3,380.00 = Cr ₹3,380.00 (Difference: ₹0.0000).
- **Database Residual Data**: 0 residual rows in `public.cost_centre` or allocation tables.
- **Git Working Tree**: Clean of commits/pushes (Strict stop protocol observed).

---

### 5. Next Bounded Step: C7.6 Step 4B
With Step 4A schema verified and frozen, the next bounded step is:
- **Phase C7.6 Step 4B**: Domain Types & Data Access Repository Layer (`src/lib/types/accounting.types.ts` & `src/lib/repositories/cost-allocation.repository.ts`), followed by dedicated repository tests and independent audit.
