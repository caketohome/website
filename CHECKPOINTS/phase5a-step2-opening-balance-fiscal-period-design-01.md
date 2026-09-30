# Phase 5A.2 — Opening Balance & Fiscal Period Configuration
## FORENSIC & DESIGN GATE

> **Date**: 2026-09-30
> **Predecessor**: Phase 5A.1 — GL Account-Wise Ledger & Trial Balance (FROZEN 🔒)
> **Type**: AUDIT/DESIGN ONLY — NO IMPLEMENTATION AUTHORIZED

---

## 1. FORENSIC EVIDENCE

### 1.1 Database State (Live PostgreSQL)

| Table / Setting | Current State | Evidence |
|----------------|---------------|----------|
| `public.setting` WHERE key = 'accounting_start_date' | **NOT CONFIGURED** (0 rows) | No accounting-related settings exist in `public.setting` at all |
| `public.accounting_fiscal_period` | **0 rows** | Table exists with correct schema but has never been seeded |
| `public.accounting_voucher` | **0 rows** | No vouchers of any type (including OPENING_BALANCE) |
| `public.accounting_journal_entry` | **0 rows** | No journal entries |
| `public.accounting_journal_line` | **0 rows** | No journal lines |

### 1.2 Chart of Accounts Distribution (99 accounts, all active)

| Type | Total | Groups | Leaf (postable) |
|------|-------|--------|-----------------|
| ASSET | 34 | 7 | 27 |
| LIABILITY | 24 | 7 | 17 |
| EQUITY | 8 | 3 | 5 |
| REVENUE | 10 | 3 | 7 |
| EXPENSE | 23 | 4 | 19 |

### 1.3 Existing Infrastructure (Already Built & Frozen)

| Component | Location | Status |
|-----------|----------|--------|
| `AccountingFiscalPeriodRepository` | `repositories/accounting-fiscal-period.repository.ts` | ✅ Complete (read-only: `getPeriodStatusForDate`, `requireOpenPeriod`, `getById`, `listPeriods`, `findOverlappingPeriod`, `getAccountingStartDateConfig`) |
| `FiscalPeriodStatus` discriminated union | Same file | ✅ PERIOD_OPEN / PERIOD_LOCKED / PERIOD_NOT_CONFIGURED |
| `AccountingStartDateConfig` type | Same file | ✅ `{ configured: true, startDate }` / `{ configured: false }` |
| `PostingService.validateAccountingStartDate()` | `services/posting.service.ts` L147–165 | ✅ Hard-blocks when unconfigured |
| `PostingService.validateFiscalPeriod()` | `services/posting.service.ts` | ✅ Hard-blocks on PERIOD_NOT_CONFIGURED and PERIOD_LOCKED |
| `OPENING_BALANCE` in VoucherType | `types/accounting.types.ts` L64 | ✅ Already in the type union |
| `AccountingFiscalPeriodRow` | `types/accounting.types.ts` L195–205 | ✅ id, fiscal_year, period_name, start_date, end_date, is_locked, locked_at, locked_by, created_at |
| `accounting_fiscal_period` table schema | PostgreSQL | ✅ 9 columns, UUID PK, date range, lock flag |

### 1.4 Current Blocking Conditions

Every posting service in the system (sales, purchase, payment, bank deposit, gateway settlement, bank reconciliation matching) currently calls:

1. `PostingService.validateAccountingStartDate(date, client)` → **HARD BLOCK** (returns `ACCOUNTING_START_DATE_NOT_CONFIGURED` because `public.setting` has 0 matching rows)
2. `PostingService.validateFiscalPeriod(date, client)` → **HARD BLOCK** (returns `FISCAL_PERIOD_NOT_CONFIGURED` because `accounting_fiscal_period` has 0 rows)

**Result**: The system is deliberately fail-closed. Zero real GL postings can occur until both conditions are resolved.

### 1.5 What Does NOT Exist Yet

| Component | Required For Phase 5A.2 |
|-----------|------------------------|
| Service to **create** fiscal periods | Yes — no `createFiscalPeriod` method exists anywhere |
| Service to **set** the accounting_start_date | Yes — only a reader exists (`getAccountingStartDateConfig`) |
| Service to post OPENING_BALANCE vouchers | Yes — PostingService supports the type but no orchestrator |
| API endpoints for fiscal period CRUD | Yes — no admin/accounting/fiscal-period endpoints |
| API endpoint to set accounting_start_date | Yes — no admin/accounting/settings endpoint |
| UI for fiscal period management | Yes — no panel |
| UI for opening balance entry | Yes — no panel |
| Service to **lock/unlock** a fiscal period | Partial — `is_locked` column exists, no service method |

---

## 2. DESIGN SPECIFICATION

### 2.1 Scope

Phase 5A.2 covers three tightly coupled deliverables that must be resolved together because the posting engine requires all three before any GL activity can begin:

1. **Accounting Start Date Configuration** — Set the `accounting_start_date` in `public.setting`
2. **Fiscal Period Management** — CRUD for fiscal periods (create, list, lock, unlock)
3. **Opening Balance Posting** — Post OPENING_BALANCE vouchers for each account as of the accounting start date

### 2.2 Execution Sequence

```
A. Accounting Start Date Service + API
   ↓ (start date must exist before periods can be validated)
B. Fiscal Period Service + API
   ↓ (at least one OPEN period must exist before posting)
C. Opening Balance Posting Service + API
   ↓ (uses PostingService foundation with OPENING_BALANCE type)
D. Fiscal Period & Opening Balance UI Panel
   ↓
E. Verification Suite
```

### 2.3 Component A: Accounting Start Date

#### Service: `AccountingConfigService`

```typescript
class AccountingConfigService {
  // Read: already exists in AccountingFiscalPeriodRepository.getAccountingStartDateConfig()
  
  // Write: NEW
  static async setAccountingStartDate(
    startDate: string,    // YYYY-MM-DD
    actorId: string,      // authenticated user
    actorRole: string     // must be SUPER_ADMIN
  ): Promise<void>
  // Constraints:
  // - Only SUPER_ADMIN can set/change this
  // - Once journals exist, the start date cannot be changed (lock-after-first-posting)
  // - Validates YYYY-MM-DD format
  // - Writes to public.setting: key='accounting_start_date', value=startDate
}
```

#### API

| Method | Endpoint | Auth | Body |
|--------|----------|------|------|
| GET | `/api/v1/admin/accounting/config` | ACCOUNTING.VIEW | — |
| PUT | `/api/v1/admin/accounting/config/start-date` | SUPER_ADMIN only | `{ startDate: "YYYY-MM-DD" }` |

#### Constraints

- `accounting_start_date` must be a valid date (not in the future)
- If any `accounting_journal_entry` rows exist, the start date becomes immutable
- Cannot be set to a date after any existing fiscal period start_date
- India-standard fiscal year typically starts April 1, but the system must not hardcode this

### 2.4 Component B: Fiscal Period Management

#### Service: `FiscalPeriodService`

```typescript
class FiscalPeriodService {
  // CREATE
  static async createFiscalPeriod(params: {
    fiscal_year: string;     // e.g. "2024-2025"
    period_name: string;     // e.g. "April 2024"
    start_date: string;      // YYYY-MM-DD
    end_date: string;        // YYYY-MM-DD
  }, actorId: string): Promise<AccountingFiscalPeriodRow>
  // Constraints:
  // - accounting_start_date MUST be configured first
  // - start_date >= accounting_start_date
  // - start_date < end_date
  // - No overlap with existing periods (uses findOverlappingPeriod)
  // - Only SUPER_ADMIN can create periods
  
  // LIST (already partially exists via repository)
  static async listFiscalPeriods(filters: {
    fiscal_year?: string;
  }): Promise<AccountingFiscalPeriodRow[]>
  
  // LOCK
  static async lockPeriod(
    periodId: string, actorId: string
  ): Promise<AccountingFiscalPeriodRow>
  // Constraints:
  // - Period must exist and not already be locked
  // - Only SUPER_ADMIN can lock
  
  // UNLOCK (for correction only — audit-logged)
  static async unlockPeriod(
    periodId: string, actorId: string
  ): Promise<AccountingFiscalPeriodRow>
  // Constraints:
  // - Period must exist and be locked
  // - Only SUPER_ADMIN can unlock
  // - Subsequent periods must not have postings that depend on this
  
  // AUTO-GENERATE: Create 12 monthly periods for a fiscal year
  static async generateYearPeriods(
    fiscal_year: string,       // e.g. "2024-2025"
    yearStartDate: string,     // e.g. "2024-04-01"
    actorId: string
  ): Promise<AccountingFiscalPeriodRow[]>
}
```

#### API

| Method | Endpoint | Auth | Body |
|--------|----------|------|------|
| GET | `/api/v1/admin/accounting/fiscal-periods` | ACCOUNTING.VIEW | — |
| POST | `/api/v1/admin/accounting/fiscal-periods` | SUPER_ADMIN | `{ fiscal_year, period_name, start_date, end_date }` |
| POST | `/api/v1/admin/accounting/fiscal-periods/generate-year` | SUPER_ADMIN | `{ fiscal_year, year_start_date }` |
| PUT | `/api/v1/admin/accounting/fiscal-periods/:id/lock` | SUPER_ADMIN | — |
| PUT | `/api/v1/admin/accounting/fiscal-periods/:id/unlock` | SUPER_ADMIN | — |

### 2.5 Component C: Opening Balance Posting

#### Service: `OpeningBalanceService`

```typescript
class OpeningBalanceService {
  // Post opening balance for a single account
  static async postOpeningBalance(params: {
    account_id: string;
    amount: number;         // positive value
    side: "DEBIT" | "CREDIT";   // which side to post
    as_of_date: string;     // must equal accounting_start_date
    narration?: string;
  }, actorId: string): Promise<PostingResult>
  // Constraints:
  // - accounting_start_date MUST be configured
  // - A fiscal period MUST be OPEN for the as_of_date
  // - Account must exist, be active, non-group
  // - Counterparty is the Opening Balance Equity account (standard CoA practice)
  // - Uses PostingService.postVoucher() with voucher_type = OPENING_BALANCE
  // - Only one opening balance voucher per account per fiscal year
  
  // Bulk post opening balances
  static async postBulkOpeningBalances(params: {
    balances: Array<{
      account_id: string;
      amount: number;
      side: "DEBIT" | "CREDIT";
    }>;
    as_of_date: string;
    narration?: string;
  }, actorId: string): Promise<{ posted: number; errors: string[] }>
  
  // List accounts with their opening balance status
  static async getOpeningBalanceStatus(): Promise<Array<{
    account_id: string;
    code: string;
    name: string;
    type: string;
    has_opening_balance: boolean;
    opening_balance_amount: number;
    opening_balance_side: "DEBIT" | "CREDIT" | null;
  }>>
}
```

#### API

| Method | Endpoint | Auth | Body |
|--------|----------|------|------|
| POST | `/api/v1/admin/accounting/opening-balances` | SUPER_ADMIN | `{ account_id, amount, side, as_of_date }` |
| POST | `/api/v1/admin/accounting/opening-balances/bulk` | SUPER_ADMIN | `{ balances: [...], as_of_date }` |
| GET | `/api/v1/admin/accounting/opening-balances/status` | ACCOUNTING.VIEW | — |

### 2.6 Component D: UI Panel

#### `AccountingSetupPanel`

Two-section layout:

**Section 1: Accounting Configuration**
- Display current `accounting_start_date` (or "Not configured" with warning)
- Set/update accounting start date (SUPER_ADMIN only, locked after first posting)
- Display fiscal period list with status badges (OPEN/LOCKED)
- Create new fiscal period or auto-generate year
- Lock/unlock periods (SUPER_ADMIN only)

**Section 2: Opening Balances**
- Table of all leaf accounts with:
  - Code, Name, Type, Normal Balance
  - Opening Balance amount (editable if no OPENING_BALANCE voucher posted)
  - Status badge (Configured / Not Configured)
- Bulk entry form
- Post button (creates OPENING_BALANCE vouchers through PostingService)
- Balance check: Total Debit Opening Balances == Total Credit Opening Balances

#### Tab Registration
- Tab ID: `accounting_setup`
- Permission: `ACCOUNTING.MANAGE` (new permission — separate from VIEW for write operations)
- Admin tab icon: `Settings2` from lucide-react
- Position: After `general_ledger` in admin tabs

---

## 3. CONSTRAINTS

### 3.1 Hard Rules

| # | Constraint |
|---|-----------|
| 1 | **No database migrations** — All tables already exist |
| 2 | **No new tables** — Use existing `accounting_fiscal_period`, `accounting_voucher`, `accounting_journal_entry`, `accounting_journal_line`, `setting` |
| 3 | **No hardcoded fiscal year** — Must not assume April-March or January-December |
| 4 | **No auto-creation of periods** — Periods must be explicitly created by SUPER_ADMIN |
| 5 | **No fabricated opening balances** — Only posted through PostingService with full double-entry |
| 6 | **No backdated posting** — Opening balances must use `as_of_date == accounting_start_date` |
| 7 | **Opening Balance Equity account required** — Must be an existing Equity account in the CoA (e.g., "Retained Earnings / Opening Balance Equity") |
| 8 | **Lock-after-first-posting** — `accounting_start_date` becomes immutable once any journal entry exists |
| 9 | **Cake availability untouched** — Completely separate from accounting configuration |
| 10 | **All PostingService guards preserved** — `validateAccountingStartDate` + `validateFiscalPeriod` + balanced journal + account validation |
| 11 | **SUPER_ADMIN only for all write operations** — Create periods, set start date, post opening balances |
| 12 | **No unrelated refactoring** |

### 3.2 Dependencies

| This Phase Requires | Status |
|--------------------|--------|
| CoA with 75 leaf accounts | ✅ Available |
| `PostingService.postVoucher()` | ✅ Frozen |
| `AccountingFiscalPeriodRepository` (read methods) | ✅ Frozen |
| `OPENING_BALANCE` in VoucherType | ✅ In type union |
| `public.setting` table | ✅ Exists with key/value columns |
| `public.accounting_fiscal_period` table | ✅ Exists with correct schema, 0 rows |

### 3.3 What This Phase Unlocks

Once `accounting_start_date` is configured + fiscal periods exist + opening balances are posted:

- `PostingService.validateAccountingStartDate()` will return `{ configured: true }`
- `PostingService.validateFiscalPeriod()` will return `PERIOD_OPEN`
- The Trial Balance (Phase 5A.1) will show real balances
- The Account Ledger (Phase 5A.1) will show OPENING_BALANCE entries
- All downstream posting services (sales, purchases, payments, etc.) will be unblocked

---

## 4. RISK ASSESSMENT

| Risk | Mitigation |
|------|-----------|
| Opening balance entry creates journal lines → TB must remain balanced | PostingService enforces double-entry: every OB debit to Asset/Expense has a credit to Opening Balance Equity, and vice versa |
| Admin sets wrong start date → all future postings blocked | Lock-after-first-posting prevents changes; UI shows clear warning before setting |
| Fiscal periods overlap → double-counting | `findOverlappingPeriod()` already exists and will reject overlaps |
| Bulk OB import unbalanced | Server-side validation: sum(debit OBs) must equal sum(credit OBs) before commit |

---

## 5. ESTIMATED SIZE

| Component | Files | Lines (est.) |
|-----------|-------|-------------|
| AccountingConfigService | 1 new service | ~100 |
| FiscalPeriodService | 1 new service | ~250 |
| OpeningBalanceService | 1 new service | ~300 |
| API route additions | 1 file modified | ~200 |
| UI Panel | 1 new component | ~600 |
| Tab wiring | 3 files modified | ~10 |
| Verification suite | 1 new test | ~350 |
| **Total** | ~6 files | ~1,810 |

---

## 6. AUTHORIZATION REQUEST

> **This is a DESIGN GATE ONLY.**
> Implementation requires explicit authorization.
> The design gate must be reviewed and approved before any code is written.

---

> **STOP**: Do not implement Phase 5A.2 without explicit authorization.
