# Phase 5A.1 — GL Account-Wise Ledger & Trial Balance
## Forensic Design Gate

> **Classification**: Design Gate — Authorization Required Before Implementation  
> **Prerequisite**: ERP Gap Audit COMPLETE (2026-09-29)  
> **Phase**: 5A (GL Foundation & Financial Statements)  
> **Step**: 5A.1 (first of 7 in Phase 5A)

---

## 1. Forensic Discovery — Existing Infrastructure

### Critical Finding: Repository Layer Already Exists

The forensic audit reveals that `AccountingJournalRepository` **already contains production-grade implementations** for both GL ledger queries and trial balance computation:

| Component | Status | Location |
|-----------|--------|----------|
| `getGeneralLedger()` | ✅ EXISTS | [`accounting-journal.repository.ts` L239–L327](file:///e:/vig/cakes2home-main/cakes2home-main/frontend/src/lib/repositories/accounting-journal.repository.ts#L239-L327) |
| `getTrialBalance()` | ✅ EXISTS | [`accounting-journal.repository.ts` L347–L396](file:///e:/vig/cakes2home-main/cakes2home-main/frontend/src/lib/repositories/accounting-journal.repository.ts#L347-L396) |
| `GeneralLedgerFilters` | ✅ EXISTS | [`accounting.types.ts` L316–L327](file:///e:/vig/cakes2home-main/cakes2home-main/frontend/src/lib/types/accounting.types.ts#L316-L327) |
| `GeneralLedgerRow` | ✅ EXISTS | [`accounting.types.ts` L329–L345](file:///e:/vig/cakes2home-main/cakes2home-main/frontend/src/lib/types/accounting.types.ts#L329-L345) |
| `GeneralLedgerResult` | ✅ EXISTS | [`accounting.types.ts` L347–L355](file:///e:/vig/cakes2home-main/cakes2home-main/frontend/src/lib/types/accounting.types.ts#L347-L355) |
| `TrialBalanceRow` | ✅ EXISTS | [`accounting.types.ts` L357–L368](file:///e:/vig/cakes2home-main/cakes2home-main/frontend/src/lib/types/accounting.types.ts#L357-L368) |
| `AccountingAccountRepository.listAccounts()` | ✅ EXISTS | [`accounting-account.repository.ts` L62–L101](file:///e:/vig/cakes2home-main/cakes2home-main/frontend/src/lib/repositories/accounting-account.repository.ts#L62-L101) |
| `AccountingAccountRepository.findById()` | ✅ EXISTS | [`accounting-account.repository.ts` L26–L39](file:///e:/vig/cakes2home-main/cakes2home-main/frontend/src/lib/repositories/accounting-account.repository.ts#L26-L39) |

### What Does NOT Exist

| Missing Layer | Evidence |
|---------------|----------|
| **Service layer** for GL ledger / trial balance | No `general-ledger.service.ts` — zero grep results for `getGeneralLedger` outside the repository |
| **API route** for GL ledger | Zero API routes matching `accounting/ledger` or `accounting/trial` |
| **API route** for trial balance | Same — zero routes |
| **UI panel** for GL ledger | No `general-ledger-panel.tsx` or similar component |
| **Opening balance computation** for account ledger | `GeneralLedgerResult.opening_balance` is defined but never populated (the repository method returns `lines` only) |

### Existing Index Coverage (No DDL Required)

The repository header documents (L231–L232):
- `idx_accounting_jline_account_branch` — covers account_id + branch_id filters
- `idx_accounting_jline_branch` — covers branch-only scoping
- `idx_accounting_journal_branch_date` — covers branch + date range queries

---

## 2. Bounded Scope

### IN SCOPE (5A.1)

1. **GL Service Layer** (`general-ledger.service.ts`):
   - `getAccountLedger()` — per-account transaction register with opening balance, running balance, and closing balance
   - `getTrialBalance()` — period trial balance with debit/credit totals and balance check
   - `listChartOfAccounts()` — account picker data for the UI
   - RBAC enforcement via `hasEffectivePermission(actorContext, "ACCOUNTING.VIEW")`
   - Branch isolation for non-super-admin users
   - Server-side pagination (reuses existing repository pagination)

2. **REST API Endpoints** (2 new routes wired through the existing `[...path]/route.ts` catch-all):
   - `GET /api/v1/admin/accounting/ledger?account_id=...&startDate=...&endDate=...&branch_id=...&page=...&limit=...`
   - `GET /api/v1/admin/accounting/trial-balance?startDate=...&endDate=...&branch_id=...`

3. **UI Panel** (`general-ledger-panel.tsx`):
   - Account selector (dropdown populated from Chart of Accounts)
   - Date range picker (period filter)
   - Account ledger view: chronological transaction register with running balance
   - Trial balance view: all accounts with debit/credit/net columns and totals row
   - Tab toggle between "Account Ledger" and "Trial Balance" views
   - Print support
   - Pagination for ledger view

4. **Dashboard Wiring**:
   - TAB_PERMISSION_MAP: `general_ledger` → `ACCOUNTING.VIEW`
   - Admin sidebar: link under Finance group
   - Dashboard page.tsx: lazy-loaded panel registration

### OUT OF SCOPE (Deferred to Later 5A Steps)

| Item | Deferred To |
|------|-------------|
| Profit & Loss statement | 5A.5 |
| Balance Sheet | 5A.6 |
| Expense GL posting | 5A.2 |
| Opening balance workflow | 5A.3 |
| Period-end close | 5A.7 |
| Cash flow statement | 5B or later |
| Any database migrations | NOT IN 5A.1 |
| Any accounting mutations | NOT IN 5A.1 |
| Any new DB tables | NOT IN 5A.1 |

---

## 3. Technical Specification

### 3.1 Service Layer: `GeneralLedgerService`

```
File: src/lib/services/general-ledger.service.ts

class GeneralLedgerService {

  // ── ACCOUNT LEDGER ──────────────────────────────────────────────
  // Returns per-account chronological transaction register
  // with opening balance, running balance per line, closing balance.
  //
  // Opening Balance = SUM(debit) - SUM(credit) for all posted journal lines
  //   on this account BEFORE startDate (or all-time if no startDate).
  // Running Balance = opening + cumulative (debit - credit) through each line.
  // Closing Balance = opening + SUM(debit) - SUM(credit) for period.
  //
  // For CREDIT-normal accounts (LIABILITY, REVENUE, EQUITY):
  //   balance = SUM(credit) - SUM(debit)  (sign is inverted for display)
  //
  // RBAC: Requires ACCOUNTING.VIEW
  // Branch: Non-super-admin locked to their branch
  static async getAccountLedger(params: AccountLedgerParams): Promise<AccountLedgerResult>

  // ── TRIAL BALANCE ───────────────────────────────────────────────
  // Delegates to existing AccountingJournalRepository.getTrialBalance()
  // Adds: RBAC validation, branch enforcement, totals row computation
  //
  // Mathematical invariant: total_debit === total_credit (or flags imbalance)
  //
  // RBAC: Requires ACCOUNTING.VIEW
  static async getTrialBalance(params: TrialBalanceParams): Promise<TrialBalanceResult>

  // ── CHART OF ACCOUNTS ───────────────────────────────────────────
  // For the account selector dropdown in the UI
  // Delegates to existing AccountingAccountRepository.listAccounts()
  // Returns non-group, active accounts only by default
  static async listAccounts(params: AccountListParams): Promise<AccountListResult>
}
```

### 3.2 New Types Required

```typescript
// Added to accounting.types.ts (extends existing types)

interface AccountLedgerParams {
  account_id: string;        // REQUIRED — which account's ledger
  branch_id?: string;        // From session for non-super-admin
  startDate?: string;        // Period start (YYYY-MM-DD)
  endDate?: string;          // Period end (YYYY-MM-DD)
  page?: number;             // Pagination (default 1)
  limit?: number;            // Rows per page (default 50, max 500)
  actorContext?: any;        // RBAC context from session
}

interface AccountLedgerLine {
  line_id: string;
  entry_date: string;
  entry_no: string;
  voucher_id: string;
  voucher_no: string;
  voucher_type: VoucherType;
  narration: string | null;
  debit_amount: number;
  credit_amount: number;
  running_balance: number;   // Computed server-side
  branch_id: string;
  customer_id: string | null;
  supplier_id: string | null;
}

interface AccountLedgerResult {
  account: {
    id: string;
    code: string;
    name: string;
    type: AccountType;
    subtype: AccountSubtype;
    normal_balance: 'DEBIT' | 'CREDIT';
  };
  opening_balance: number;
  closing_balance: number;
  total_debit: number;
  total_credit: number;
  lines: AccountLedgerLine[];
  total: number;             // Total matching lines (for pagination)
  page: number;
  limit: number;
  totalPages: number;
}

interface TrialBalanceParams {
  branch_id?: string;
  startDate?: string;
  endDate?: string;
  actorContext?: any;
}

interface TrialBalanceResult {
  rows: TrialBalanceRow[];   // Reuses existing TrialBalanceRow
  summary: {
    total_debit: number;
    total_credit: number;
    is_balanced: boolean;    // total_debit === total_credit
    imbalance: number;       // |total_debit - total_credit|
  };
  filters: {
    branch_id: string | null;
    startDate: string | null;
    endDate: string | null;
  };
}
```

### 3.3 Account Normal Balance Logic

| Account Type | Normal Balance | Balance Calculation |
|-------------|----------------|---------------------|
| ASSET | DEBIT | SUM(debit) − SUM(credit) |
| EXPENSE | DEBIT | SUM(debit) − SUM(credit) |
| LIABILITY | CREDIT | SUM(credit) − SUM(debit) |
| REVENUE | CREDIT | SUM(credit) − SUM(debit) |
| EQUITY | CREDIT | SUM(credit) − SUM(debit) |

The running balance in the account ledger respects normal balance conventions. A positive balance means the account has its expected normal balance direction; negative means contra.

### 3.4 Opening Balance Computation

The opening balance for an account ledger is computed as a **separate SQL query**:

```sql
-- Opening balance = all posted activity BEFORE the startDate
SELECT
  COALESCE(SUM(jl.debit_amount), 0) AS total_debit,
  COALESCE(SUM(jl.credit_amount), 0) AS total_credit
FROM public.accounting_journal_line jl
JOIN public.accounting_journal_entry je ON je.id = jl.journal_entry_id
WHERE jl.account_id = $1
  AND je.entry_date < $2    -- strictly before period start
  AND jl.branch_id = $3     -- branch scope (if applicable)
```

Opening balance = `total_debit - total_credit` for DEBIT-normal accounts, inverted for CREDIT-normal.

### 3.5 API Route Design

Both endpoints are added to the existing `[...path]/route.ts` catch-all handler, following the established pattern (e.g., BRS endpoints pattern from Steps 4.10.5-D-B).

**Endpoint 1**: `GET /api/v1/admin/accounting/ledger`

| Param | Type | Required | Notes |
|-------|------|----------|-------|
| account_id | string | YES | CoA account ID |
| startDate | YYYY-MM-DD | NO | Period start |
| endDate | YYYY-MM-DD | NO | Period end |
| branch_id | string | NO | Overridden by session for non-super-admin |
| page | number | NO | Default 1 |
| limit | number | NO | Default 50, max 500 |

**Endpoint 2**: `GET /api/v1/admin/accounting/trial-balance`

| Param | Type | Required | Notes |
|-------|------|----------|-------|
| startDate | YYYY-MM-DD | NO | Period start |
| endDate | YYYY-MM-DD | NO | Period end |
| branch_id | string | NO | Overridden by session for non-super-admin |

### 3.6 UI Panel Design

**Component**: `GeneralLedgerPanel` (lazy-loaded)

Two sub-views toggled by internal tabs:

**View A — Account Ledger**:
- Account selector dropdown (searchable, populated from CoA)
- Date range picker
- Table: Date | Voucher No | Type | Narration | Debit | Credit | Running Balance
- Opening balance row at top
- Closing balance row at bottom
- Server-side pagination
- Print button

**View B — Trial Balance**:
- Date range picker (same as above)
- Table: Account Code | Account Name | Type | Debit Balance | Credit Balance
- Group accounts displayed as section headers (indented hierarchy)
- Totals row: must show `Total Debits === Total Credits`
- Balance check indicator (✅ Balanced / ⚠️ Imbalanced)
- Print button

---

## 4. Invariants & Security

1. **READ-ONLY**: This step creates zero mutations, zero vouchers, zero journal entries.
2. **RBAC**: `ACCOUNTING.VIEW` permission required. Enforced in the service layer via `hasEffectivePermission`.
3. **Branch isolation**: Non-super-admin users see only their branch's journal lines. Super admin can select any branch or view enterprise-wide.
4. **No fabricated data**: Empty DB returns empty arrays. No synthetic or placeholder data.
5. **Pagination**: Server-side, max 500 rows. Never loads full ledger into memory.
6. **Existing index usage**: Leverages `idx_accounting_jline_account_branch`, `idx_accounting_jline_branch`, `idx_accounting_journal_branch_date`.

---

## 5. Files to Create

| File | Purpose |
|------|---------|
| `src/lib/services/general-ledger.service.ts` | Service layer with RBAC, opening balance, running balance |
| `src/components/dashboard/admin/general-ledger-panel.tsx` | UI panel with account ledger + trial balance views |

## 6. Files to Modify (Bounded Edits)

| File | Edit |
|------|------|
| `src/lib/types/accounting.types.ts` | Add `AccountLedgerParams`, `AccountLedgerLine`, `AccountLedgerResult`, `TrialBalanceParams`, `TrialBalanceResult` |
| `src/app/api/v1/[...path]/route.ts` | Add 2 GET route handlers (accounting/ledger, accounting/trial-balance) |
| `src/lib/staff-access-control.ts` | Add `general_ledger` to `TAB_PERMISSION_MAP` → `ACCOUNTING.VIEW` |
| `src/components/dashboard/admin/admin-tabs.tsx` | Register `general_ledger` tab |
| `src/components/admin/AdminSidebar.tsx` | Add GL link under Finance group |
| `src/app/dashboard/page.tsx` | Register `GeneralLedgerPanel` in lazy-loaded panel map |

## 7. Files NOT Modified

- Zero repository changes (existing `getGeneralLedger` and `getTrialBalance` are sufficient)
- Zero DB schema changes
- Zero migration files
- Zero changes to any existing posting/accounting service
- Zero changes to any frozen step (4.10.5-A through 4.10.5-E)

---

## 8. Verification Plan

| # | Assertion | Method |
|---|-----------|--------|
| 1 | GET /admin/accounting/ledger returns 401 without auth | curl |
| 2 | GET /admin/accounting/ledger returns 403 without ACCOUNTING.VIEW | curl with non-privileged token |
| 3 | GET /admin/accounting/ledger?account_id=X returns paginated lines | curl with valid auth |
| 4 | Opening balance computation is correct (pre-period sum) | Manual verification against DB |
| 5 | Running balance increments correctly per line | Arithmetic check on response |
| 6 | Closing balance = opening + period debit - period credit | Math identity |
| 7 | GET /admin/accounting/trial-balance returns all active accounts | curl |
| 8 | Trial balance total_debit === total_credit (balanced) | Math identity |
| 9 | Branch-manager user sees only their branch | BOLA test |
| 10 | Super-admin sees enterprise-wide data | Auth test |
| 11 | Empty DB returns empty arrays, not errors | Edge case |
| 12 | Pagination works (page, limit, totalPages) | Pagination test |
| 13 | TAB_PERMISSION_MAP gates the panel | UI access test |
| 14 | Zero mutations to accounting tables | Post-test DB audit |
| 15 | TypeScript compilation: 0 errors | `npx tsc --noEmit` |

---

## 9. Dependency Analysis

| Dependency | Status |
|------------|--------|
| `accounting_journal_entry` table | ✅ EXISTS (Phase 4A schema) |
| `accounting_journal_line` table | ✅ EXISTS (Phase 4A schema) |
| `accounting_account` table | ✅ EXISTS (Phase 4A schema, seeded Phase 4D) |
| `AccountingJournalRepository.getGeneralLedger()` | ✅ EXISTS |
| `AccountingJournalRepository.getTrialBalance()` | ✅ EXISTS |
| `AccountingAccountRepository.listAccounts()` | ✅ EXISTS |
| `hasEffectivePermission()` | ✅ EXISTS |
| `ACCOUNTING.VIEW` permission | ✅ EXISTS |
| `TAB_PERMISSION_MAP` pattern | ✅ EXISTS (established in BRS Step 4.10.5-E) |

All dependencies are satisfied. No prerequisite implementation needed.

---

> **Authorization Required**: This design gate must be approved before implementation begins.
> Implementation will follow the same design → authorization → implementation → verification → freeze cycle.
