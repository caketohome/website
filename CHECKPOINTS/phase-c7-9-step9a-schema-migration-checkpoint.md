# CakeToHome ERP — Phase C7.9 Step 9A Schema Migration Checkpoint
## Additive Corporate Account Master & Employee Roster Schema Foundation

> **Document Status**: 🔒 **STEP C7.9a MIGRATION COMPLETE & AUDITED**  
> **Preservation Baseline**: Group 7 commit `d231cee7e55f716526e62f5799cc7377c555fed3` on `checkpoint/c-phases-baseline`  
> **Date**: 2026-10-12  
> **Execution Mode**: STRICTLY BOUNDED MIGRATION — NO C7.9b LOGIC, NO BILLING, NO COA MUTATION  

---

### 1. Executive Summary

In accordance with explicit authorization, **Phase C7.9 Step 9A** has been executed and independently verified.

The migration is **strictly additive**:
- Created the **seven approved corporate domain tables** and their associated foreign keys, unique constraints, check constraints, indexes, and database security triggers.
- Enforced a strict **1:1 relationship** between `corporate_account` and `public.customer(id)`.
- Enforced strict **employee code uniqueness** over all statuses and a database trigger preventing hard deletion of employee records (`trg_ce_prevent_delete`).
- Enforced **immutable append-only audit event semantics** via database triggers on `corporate_employee_event` and `corporate_account_event`.
- Enforced authorized corporate membership scoping via `corporate_account_member`.
- Preserved the authoritative **100-account Chart of Accounts** baseline with **zero mutation**, **zero drift**, and **zero candidate codes**.
- Left all existing business tables (`customer`, `company`, `invoice`, `order`, `branch`, `delivery`) and accounting ledgers completely untouched.

---

### 2. Verified 7 Additive Tables & Schemas

| # | Table Name | PK Prefix | Columns | Rows | Purpose & Key Database Constraints |
|---|---|---|---|---|---|
| 1 | `public.corporate_account` | `ca_` | 28 | 0 | Corporate master record. `customer_id TEXT NOT NULL UNIQUE REFERENCES customer(id) RESTRICT`. Regex checks on PAN and GSTIN with cross-match check (`chk_ca_pan_gstin_match`). Partial unique index on active GSTIN (`idx_ca_gstin_active`). Credit requested fields only (no credit limit/terms authority columns). |
| 2 | `public.corporate_account_contact` | `cac_` | 12 | 0 | Account contacts. `account_id REFERENCES corporate_account(id) RESTRICT`. Partial unique index ensuring exactly one active `PRIMARY` contact per account (`idx_cac_one_active_primary`). |
| 3 | `public.corporate_account_member` | `cam_` | 12 | 0 | Authorized client staff. `account_id` and `user_id REFERENCES "user"(id) RESTRICT`. Role check (`ROSTER_MANAGER`, `ROSTER_VIEWER`). Partial unique index on active membership (`idx_cam_account_user_active`). |
| 4 | `public.corporate_employee` | `ce_` | 30 | 0 | Employee roster master. `account_id REFERENCES corporate_account(id) RESTRICT`. Global uniqueness on `(account_id, employee_code_key)`. India bounding box coordinates check (`chk_ce_coords_india_bbox`). Trigger `trg_ce_prevent_delete` strictly blocks hard DELETE. |
| 5 | `public.corporate_employee_event` | `cee_` | 10 | 0 | Append-only employee audit trail. `employee_id` and `account_id` FKs. Trigger `trg_cee_append_only` blocks UPDATE and DELETE. |
| 6 | `public.corporate_account_event` | `cax_` | 9 | 0 | Append-only account lifecycle audit trail. `account_id` FK. Trigger `trg_cax_append_only` blocks UPDATE and DELETE. |
| 7 | `public.corporate_employee_import_batch` | `cei_` | 15 | 0 | CSV roster upload batch tracking. `account_id` FK. Partial unique index on committed file hash per account (`idx_cei_account_file_hash_committed`). |

---

### 3. Accounting Baseline & Financial Invariant Audit

The live PostgreSQL database was audited independently before and after migration. The accounting ledger and Chart of Accounts are completely unmutated:

```
┌───────────────────────────────────────┬───────────────────┬────────────────────┬───────────┐
│ Metric / Entity                       │ Pre-Migration     │ Post-Migration     │ Status    │
├───────────────────────────────────────┼───────────────────┼────────────────────┼───────────┤
│ Chart of Accounts Account Count       │ 100 accounts      │ 100 accounts       │ ✅ LOCKED │
│ Candidate Codes (1118B, 2118, 2119, …)│ 0 present         │ 0 present          │ ✅ ZERO   │
│ Accounting Vouchers (public.voucher)  │ 6 rows            │ 6 rows             │ ✅ INTACT │
│ Journal Entries (public.entry)        │ 4 rows            │ 4 rows             │ ✅ INTACT │
│ Journal Lines (public.line)           │ 10 rows           │ 10 rows            │ ✅ INTACT │
│ Trial Balance Debit                   │ ₹3,380.00         │ ₹3,380.00          │ ✅ BALANCED│
│ Trial Balance Credit                  │ ₹3,380.00         │ ₹3,380.00          │ ✅ BALANCED│
└───────────────────────────────────────┴───────────────────┴────────────────────┴───────────┘
```

**Independent Audit SQL:**
```sql
SELECT 
  (SELECT count(*)::int FROM public.accounting_account) as coa_account_count,
  (SELECT count(*)::int FROM public.accounting_voucher) as voucher_count,
  (SELECT count(*)::int FROM public.accounting_journal_entry) as journal_entry_count,
  (SELECT count(*)::int FROM public.accounting_journal_line) as journal_line_count,
  (SELECT COALESCE(SUM(debit_amount), 0)::numeric(15,2) FROM public.accounting_journal_line) as trial_balance_debit,
  (SELECT COALESCE(SUM(credit_amount), 0)::numeric(15,2) FROM public.accounting_journal_line) as trial_balance_credit;
```
**Result:**
```json
{
  "coa_account_count": 100,
  "voucher_count": 6,
  "journal_entry_count": 4,
  "journal_line_count": 10,
  "trial_balance_debit": "3380.00",
  "trial_balance_credit": "3380.00"
}
```

---

### 4. Verification Evidence & Test Execution

Four independent levels of automated testing were executed with 100% pass rates:

#### Test 1: Isolated Rollback Safety & Constraint Test
- **File**: [`scratch/test_c7_9a_migration_safety.js`](file:///e:/vig/cakes2home-main/cakes2home-main/scratch/test_c7_9a_migration_safety.js)
- **Scope**: Executed inside an isolated `BEGIN ... ROLLBACK` transaction.
- **Results**: **23 / 23 assertions passed (0 failed)**.
  - Verified initial DDL execution and idempotency.
  - Verified 1:1 customer constraint rejection on duplicate insert.
  - Verified PAN-GSTIN mismatch constraint rejection.
  - Verified employee code uniqueness and coordinate India bounding box rejection.
  - Verified `trg_ce_prevent_delete` blocked employee hard delete.
  - Verified `trg_cax_append_only` and `trg_cee_append_only` blocked UPDATE and DELETE on audit events.
  - Verified `idx_cam_account_user_active` rejected duplicate active membership.

#### Test 2: Live Migration Execution & Idempotency
- **Runner**: [`frontend/migrate_phase_c7_9_corporate_account_roster_schema.js`](file:///e:/vig/cakes2home-main/cakes2home-main/frontend/migrate_phase_c7_9_corporate_account_roster_schema.js)
- **SQL Source**: [`backend/src/migrations/20261012_phase_c7_9_corporate_account_roster_schema.sql`](file:///e:/vig/cakes2home-main/cakes2home-main/backend/src/migrations/20261012_phase_c7_9_corporate_account_roster_schema.sql)
- **Rollback Script**: [`frontend/rollback_phase_c7_9_corporate_account_roster_schema.js`](file:///e:/vig/cakes2home-main/cakes2home-main/frontend/rollback_phase_c7_9_corporate_account_roster_schema.js)
- **Results**:
  - Run 1 (Application): **Exit code 0** (committed).
  - Run 2 (Idempotency Re-run): **Exit code 0** (safe re-execution, no-op).

#### Test 3: Comprehensive Post-Flight Verification Suite
- **File**: [`frontend/scratch/test_phase_c7_9_step9a_schema.js`](file:///e:/vig/cakes2home-main/cakes2home-main/frontend/scratch/test_phase_c7_9_step9a_schema.js)
- **Scope**: Validated 7 tables, column definitions, 7 unique constraints/indexes, 5 check constraints, 3 triggers, and all foreign keys.
- **Results**: **37 / 37 assertions passed (0 failed)**.

#### Test 4: Independent PostgreSQL Audit Dump
- **File**: [`scratch/independent_postgresql_c7_9a_audit.js`](file:///e:/vig/cakes2home-main/cakes2home-main/scratch/independent_postgresql_c7_9a_audit.js)
- **JSON Evidence**: [`scratch/independent_postgresql_c7_9a_audit.json`](file:///e:/vig/cakes2home-main/cakes2home-main/scratch/independent_postgresql_c7_9a_audit.json)
- **Results**: Verified all 7 tables exist with 0 rows, all FKs `ON DELETE RESTRICT`, zero non-corporate table alterations.

#### Test 5: TypeScript Compilation Check
- **Command**: `npx tsc --noEmit` in `frontend`
- **Result**: **Exit code 0 (Zero errors)**.

---

### 5. Architectural Boundaries Preserved

- **Zero Alteration to Existing Tables**: No modifications were made to `public.customer`, `public.company`, `public.invoice`, `public.order`, `public.branch`, or any other existing table.
- **Zero Accounting / GL Postings**: No financial posting logic, accounting voucher creation, or journal entry routines were added.
- **Zero Candidate Accounts**: Proposed accounts `1118B`, `2118`, `2119`, `5114`, and `5115` were **not added** and remain strictly unapproved proposals for statutory review.
- **Zero Branch / Franchise Billing**: No supplier billing, franchise rate cards, or delivery routing engines were implemented.
- **Working Tree Preservation**: Unrelated modified files (`scratch/test-profile-interaction.ts`, checkpoints) were strictly preserved without reset, stash, clean, or commit.

---

### 6. Stop Condition & Next Step Gate

In accordance with mandatory stop condition instructions:
- **STEP C7.9a IS COMPLETE AND FROZEN**.
- **EXECUTION IS HALTED**. Zero service, API, repository, or UI implementation has been started.
- Awaiting explicit authorization for **Step C7.9b (Corporate Account & Employee Roster Repositories & Domain Services)**.
