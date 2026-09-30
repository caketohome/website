# Phase 5A.1 — GL Account-Wise Ledger & Trial Balance
## Implementation Complete — FROZEN 🔒

> **Completed**: 2026-09-30  
> **Predecessor**: ERP Gap Audit (2026-09-29), Phase 4F (FROZEN)  
> **Design Gate**: `CHECKPOINTS/phase5a-step1-gl-ledger-trial-balance-design-01.md`

---

## 1. Files Created

| File | Purpose |
|------|---------|
| `src/lib/services/general-ledger.service.ts` | GL service layer: RBAC, branch isolation, opening/running/closing balance, period totals |
| `src/components/dashboard/admin/general-ledger-panel.tsx` | UI panel: Account Ledger + Trial Balance sub-views with filters, pagination, print |
| `frontend/scratch/test_phase5a1_gl_ledger.js` | 71-assertion verification suite |

## 2. Files Modified

| File | Edit | Scope |
|------|------|-------|
| `src/lib/types/accounting.types.ts` | Added `NormalBalance`, `getNormalBalance()`, `AccountLedgerParams`, `AccountLedgerLine`, `AccountLedgerResult`, `TrialBalanceParams`, `TrialBalanceResult` | +89 lines after existing `TrialBalanceRow` |
| `src/app/api/v1/[...path]/route.ts` | Added `GeneralLedgerService` import + 3 GET route handlers (`admin/accounting/ledger`, `admin/accounting/trial-balance`, `admin/accounting/accounts`) | +105 lines, 1 import |
| `src/lib/staff-access-control.ts` | Added `general_ledger: { module: "ACCOUNTING", action: "VIEW" }` to `TAB_PERMISSION_MAP` | +1 line |
| `src/components/dashboard/admin/admin-tabs.tsx` | Added `BookOpen` import + `general_ledger` tab entry after `bank_reconciliation` | +2 lines |
| `src/app/dashboard/page.tsx` | Added `GeneralLedgerPanel` lazy import + `AdminTabId` union entry + `PANEL_MAP` entry | +5 lines |
| `src/lib/repositories/accounting-journal.repository.ts` | **Defect fix**: `getTrialBalance()` SQL had `je.entry_date` in the `jl` LEFT JOIN ON clause before `je` was joined. Fixed with subquery aggregation when filters are present. | SQL restructure |

## 3. APIs Added

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/api/v1/admin/accounting/ledger` | ACCOUNTING.VIEW | Per-account chronological register with opening/running/closing balance |
| GET | `/api/v1/admin/accounting/trial-balance` | ACCOUNTING.VIEW | Period trial balance with debit/credit totals and balance check |
| GET | `/api/v1/admin/accounting/accounts` | ACCOUNTING.VIEW | Chart of Accounts list (non-group, active) for UI dropdown |

## 4. Verification Results

### A. Static
- **TypeScript**: 0 errors (`npx tsc --noEmit` exit code 0)
- **Build**: Clean

### B. Security (9/9)
| # | Assertion | Result |
|---|-----------|--------|
| 1 | Unauthenticated ledger → 401 | ✅ |
| 2 | Unauthenticated trial-balance → 401 | ✅ |
| 3 | Unauthenticated accounts → 401 | ✅ |
| 4 | Customer role → 403 | ✅ |
| 5 | Staff without ACCOUNTING.VIEW → 403 | ✅ |
| 6 | Staff WITH ACCOUNTING.VIEW → 200 | ✅ |
| 7 | SUPER_ADMIN → 200 | ✅ |
| 8 | Spoofed headers (no JWT) → 401 | ✅ |
| 9 | Unknown endpoint → 404 | ✅ |

### C. Functional (42/42)
- Trial balance: response structure, summary, date range, invalid date validation
- Account ledger: missing account_id (400), non-existent account (404), valid account (200)
- Ledger structure: account metadata, opening/closing balance, total debit/credit, lines, pagination
- Normal balance convention: ASSET→DEBIT verified
- Closing balance identity: `closing = opening + net` verified (diff=0.0000)
- Date range filtering, pagination (limit=5 respected), invalid date (400)
- Accounts list: structure, search, include_groups

### D. Accounting Integrity (3/3)
- Independent DB query: `SUM(debit) === SUM(credit)` ✅
- API TB debit matches DB debit ✅
- API TB credit matches DB credit ✅

### E. PostgreSQL Independent Verification (9/9)
| Check | Pre-test | Post-test | Mutated? |
|-------|----------|-----------|----------|
| CoA accounts | 99 | 99 | ❌ |
| Vouchers | 0 | 0 | ❌ |
| Journal entries | 0 | 0 | ❌ |
| Journal lines | 0 | 0 | ❌ |
| Orders | 173 | 173 | ❌ |
| Payment transactions | 53 | 53 | ❌ |
| Fiscal periods | 0 | 0 | ❌ |
| Lingering locks | — | 0 | ❌ |
| New GL/TB tables | — | 0 | ❌ |

### F. TAB_PERMISSION_MAP (3/3)
- Staff with ACCOUNTING.VIEW → permitted ✅
- Staff without ACCOUNTING.VIEW → denied ✅
- SUPER_ADMIN → permitted ✅

### G. Component Verification (1/1)
- `general-ledger-panel.tsx` exists ✅

---

## 5. Summary

| Metric | Value |
|--------|-------|
| Total assertions | 71 |
| Passed | 71 |
| Failed | 0 |
| Pass rate | 100% |
| New API endpoints | 3 (GET-only) |
| New DB tables | 0 |
| New migrations | 0 |
| Financial mutations | 0 |
| Frozen phase regressions | 0 |

## 6. Deviations from Design Gate

| # | Deviation | Justification |
|---|-----------|---------------|
| 1 | Fixed `getTrialBalance()` SQL in `accounting-journal.repository.ts` | Pre-existing defect: `je.entry_date` referenced in `jl` JOIN ON before `je` was joined. Date-filtered TB was broken. Fixed with subquery aggregation pattern. |
| 2 | Added `GET /admin/accounting/accounts` endpoint | Not explicitly in the 2-endpoint design, but required by the UI panel's account selector dropdown. Read-only, uses existing `listAccounts()`. |

## 7. Confirmation

- ✅ No financial data was mutated
- ✅ Frozen Phase 4F behavior remains unchanged
- ✅ No new database tables, migrations, or fiscal period configurations
- ✅ No accounting-start-date configuration
- ✅ No fabricated opening balances
- ✅ Cake availability system untouched
- ✅ All existing orders, payments, vouchers, journals unchanged
- ✅ CakeToHome remains INR-only (no multi-currency)

---

> **STOP**: Phase 5A.1 is complete. Do not proceed to P&L, Balance Sheet, opening balances, period close, or GST without a separate forensic/design gate.
