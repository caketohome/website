# PHASE C7.6 STEP 3 — CHART OF ACCOUNTS GOVERNANCE
## IMPLEMENTATION & VERIFICATION CHECKPOINT

- **Date / Time**: 2026-10-09T07:02:00+05:30
- **Status**: 🔒 **PHASE C7.6 STEP 3 COMPLETE & FROZEN — ZERO GIT COMMITS / PUSHES (STRICT STOP PROTOCOL ENFORCED)**
- **System**: CakeToHome ERP
- **Phase**: C7.6 — Cost Centre Accounting
- **Step**: Step 3 — Chart of Accounts Governance Implementation & Validation

---

### 1. Architectural Summary & Scope of Implementation

Phase C7.6 Step 3 implements deterministic, type-safe Chart of Accounts (CoA) dimensional governance over cost-centre usage across all 100 system accounts without altering the frozen Chart of Accounts or introducing schema migrations, policy database tables, or account-management UI.

#### Core Additions:
1. **Type-Safe Domain Policy (`src/lib/types/accounting.types.ts`)**:
   - `CostCentrePolicy = "REQUIRED" | "OPTIONAL" | "PROHIBITED"`
   - `AccountGovernanceErrorCode`: Includes `"COST_CENTRE_PROHIBITED"`, `"COST_CENTRE_REQUIRED"`, `"COST_CENTRE_INVALID"`, `"ACCOUNT_GROUP_NON_POSTABLE"`, `"ACCOUNT_NOT_FOUND"`, `"ACCOUNT_INACTIVE"`.
   - `AccountGovernanceError`: Dedicated domain error class with code and account metadata.

2. **Deterministic Account Governance Service (`src/lib/services/account-governance.service.ts`)**:
   - `getCostCentrePolicy(account)`: Pure, deterministic mapping:
     - **`PROHIBITED`**:
       - `1xxx` Assets (`CURRENT_ASSET`, `CASH`, `BANK`, `GATEWAY_CLEARING`, `RECEIVABLE`, `INVENTORY`, `INPUT_TAX`, `FIXED_ASSET`).
       - `2xxx` Liabilities (`CURRENT_LIABILITY`, `PAYABLE`, `OUTPUT_TAX`, `STAFF_PAYABLE`, `CUSTOMER_ADVANCE`, `LONG_TERM_LIABILITY`).
       - `3xxx` Equity (`CAPITAL`, `RETAINED_EARNINGS`, `OPENING_OFFSET`).
       - All 24 Summary Group accounts (`is_group = true`).
     - **`OPTIONAL`**:
       - `4xxx` Revenue (`DIRECT_REVENUE`, `DELIVERY_REVENUE`, `INDIRECT_REVENUE`).
       - `5xxx` Expenses (`COGS`, `OPERATING_EXPENSE`, `FINANCIAL_EXPENSE`).
   - `validateLineCostCentre(account, costCentreId)`: Validates individual line policy compliance.
   - `validateJournalLines(lines, client)`: Atomic pre-posting validator that ensures all accounts exist, are active, are non-group, comply with cost-centre dimensional policy, and that any referenced cost centres exist and are active in `public.cost_centre`.

3. **Authoritative Repository Enforcement (`src/lib/repositories/accounting-journal.repository.ts`)**:
   - `createJournalEntry`: Directly calls `AccountGovernanceService.validateJournalLines(lines, client)` inside caller's transaction prior to inserting journal lines.
   - Guarantees bypass immunity: No path can create journal entries without satisfying CoA dimensional governance.

4. **Workflow Service Alignment (`src/lib/services/manual-journal.service.ts`)**:
   - `createDraft` / `updateDraft`: Early validation of line-level cost centres via `validateAccountsAndParties`.
   - `postToGL`: Non-prohibited inheritance: Voucher-level `cost_centre_id` is only inherited by operational lines (Revenue, Expense) and is never assigned to balance sheet accounts (Cash, Bank, AP, AR), keeping balance sheet accounts pristine (`null`).
   - Added `COST_CENTRE_PROHIBITED`, `COST_CENTRE_REQUIRED`, `COST_CENTRE_INVALID` to `ManualJournalErrorCode`.

---

### 2. Preserved Invariants & Explicit Exclusions
- ✅ **100 Accounts Frozen**: Chart of Accounts remains strictly locked at exactly 100 accounts (0 accounts created, modified, recoded, or deleted).
- ✅ **Zero Schema Migrations**: Zero database migrations, zero policy database tables added.
- ✅ **Zero Changes to Operational Posting Services**: `ExpensePostingService`, `PurchasePostingService`, `SalesPostingService`, and `PettyCashService` remain completely untouched.
- ✅ **Zero Account-Management UI/API**: No CRUD routes or management screens created.
- ✅ **Zero Cost Allocation Engine**: No percentage allocation, allocation rules, or allocation journals.
- ✅ **Zero Historical Backfill**: 100% of historical journal lines (10 lines) and vouchers (6 vouchers) have `cost_centre_id IS NULL`.
- ✅ **Zero Git Commits / Pushes**: Working tree preserved under strict stop protocol.

---

### 3. Verification & Regression Results

#### Phase C7.6 Step 3 Dedicated Test Suite (`scratch/test_phase_c7_6_step3_coa_governance.js`): **16 / 16 PASSED** ✅
- **Test 1**: `AccountGovernanceService.getCostCentrePolicy` resolves 5 account classes & groups.
- **Test 2**: Exhaustive audit: exactly 73 accounts `PROHIBITED` (24 groups + 49 BS leaves) and 27 `OPTIONAL` (27 P&L leaves).
- **Test 3**: `AccountingJournalRepository` strictly rejects cost centre on ASSET line (`1111` Cash) with `COST_CENTRE_PROHIBITED`.
- **Test 4**: `AccountingJournalRepository` strictly rejects cost centre on LIABILITY line (`2111` AP) with `COST_CENTRE_PROHIBITED`.
- **Test 5**: `AccountingJournalRepository` strictly rejects cost centre on EQUITY line (`3300` Offset) with `COST_CENTRE_PROHIBITED`.
- **Test 6**: `AccountingJournalRepository` strictly blocks direct posting to summary group account (`5000` Expenses) with `ACCOUNT_GROUP_NON_POSTABLE`.
- **Test 7**: `AccountingJournalRepository` strictly rejects non-existent cost centre with `COST_CENTRE_INVALID`.
- **Test 8**: `AccountingJournalRepository` strictly rejects inactive cost centre with `COST_CENTRE_INVALID`.
- **Test 9**: `AccountingJournalRepository` accepts valid cost centre on Expense (`OPTIONAL`) and `NULL` on Cash (`PROHIBITED`).
- **Test 10**: `AccountingJournalRepository` accepts valid cost centre on Revenue (`OPTIONAL`) and `NULL` on Cash (`PROHIBITED`).
- **Test 11**: `AccountingJournalRepository` permits unallocated (`NULL`) cost centres on operational lines without restriction.
- **Test 12**: `ManualJournalService.createDraft` strictly rejects cost centre on Cash line with `COST_CENTRE_PROHIBITED`.
- **Test 13**: `ManualJournalService.createDraft` strictly rejects non-existent cost centre with `COST_CENTRE_INVALID`.
- **Test 14**: `ManualJournalService` full lifecycle (create -> submit -> approve -> post) succeeds with governed lines.
- **Test 15**: Voucher header cost centre inherits strictly onto non-prohibited lines, protecting balance-sheet accounts.
- **Test 16**: Bypass immunity verified: direct `AccountingJournalRepository` calls enforce governance validation.

#### Phase C7.6 Step 3 Independent PostgreSQL Audit (`scratch/audit_c7_6_step3_post_db.js`): **14 / 14 PASSED** ✅
- **1**: Chart of Accounts count is exactly 100.
- **2**: All 100 accounts are active, system-owned, non-deleted master accounts.
- **3**: Hierarchy intact: exactly 24 group headers and 76 leaf posting accounts.
- **4**: Trial Balance strictly balanced: Dr ₹3,380.00 = Cr ₹3,380.00 (diff: ₹0.00).
- **5**: Accounting voucher count unchanged (6).
- **6**: Accounting journal entry count unchanged (4).
- **7**: Accounting journal line count unchanged (10).
- **8**: Historical journal lines with `cost_centre_id IS NOT NULL` = 0.
- **9**: Historical vouchers with `cost_centre_id IS NOT NULL` = 0.
- **10**: Cost centre table has 0 residual test rows.
- **11**: Zero orphan journal lines without valid journal entries.
- **12**: Zero orphan journal entries without valid accounting vouchers.
- **13**: Foreign keys `accounting_voucher_cost_centre_id_fkey` and `accounting_journal_line_cost_centre_id_fkey` intact.
- **14**: Accounting tables have zero pending or ungranted database locks.

#### Predecessor Milestone Regression Suites: **100% GREEN** ✅
- **Phase C7.6 Step 2 (Accounting Propagation)**: **17 / 17 PASSED** ✅
- **Phase C7.6 Step 1 (Cost Centre Master)**: **24 / 24 PASSED** ✅
- **Phase C7.5 (Branch Cash Control & Vault)**: **60 / 60 PASSED** ✅
- **Phase C7.4 (Bills Receivable)**: **62 / 62 PASSED** ✅
- **Phase C7.3 (Payment & Teller)**: **55 / 55 PASSED** ✅
- **Phase C7.2 (Bills Payable)**: **32 / 32 PASSED** ✅
- **Phase C6.1 (Manual Journal Persistence)**: **51 / 51 PASSED** ✅
- **Phase C5 (Expense Accounting)**: **40 / 40 PASSED** ✅
- **Phase C4.1 (API Settlement — Frozen Suite)**: **99 / 99 PASSED** ✅
- **TypeScript Compiler (`tsc --noEmit`)**: **0 errors, 0 warnings** (Exit code 0).

---

### 4. Database Baseline Snapshot
- **Chart of Accounts**: 100 accounts (24 groups, 76 leaves, all `is_system = true`, all `is_active = true`).
- **Trial Balance**: Total Dr ₹3,380.00 = Total Cr ₹3,380.00 (Difference: ₹0.0000).
- **Vouchers**: 6 total, 0 with cost centre.
- **Journal Entries**: 4 total.
- **Journal Lines**: 10 total, 0 with cost centre.
- **Cost Centres**: 0 rows in `public.cost_centre`.
- **Database Locks**: 0 pending locks.
- **Git Working Tree**: Clean of commits/pushes.
