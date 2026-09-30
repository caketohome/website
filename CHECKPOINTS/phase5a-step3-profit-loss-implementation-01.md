# Phase 5A.3 — Profit & Loss Statement — Implementation Checkpoint

## Status: 🔒 FROZEN

**Date**: 2026-09-30
**Predecessor**: Phase 5A.2 — Opening Balance & Fiscal Period (FROZEN 🔒)

---

## Implementation Summary

Phase 5A.3 delivers a read-only Profit & Loss statement derived entirely from the authoritative General Ledger, with no new database tables, no mutations, and no modifications to frozen 5A.1/5A.2 code.

### Files Created
| File | Purpose |
|------|---------|
| `src/lib/services/profit-loss.service.ts` | P&L service — reuses `getTrialBalance()` repo, classifies by parent_id hierarchy |
| `src/components/dashboard/admin/profit-loss-panel.tsx` | Dedicated P&L UI panel with date picker, 5-section report, comparative period, TB reconciliation |
| `scratch/test_phase5a3_profit_loss.js` | 104-assertion verification suite |

### Files Modified
| File | Change |
|------|--------|
| `src/app/api/v1/[...path]/route.ts` | Added `ProfitLossService` import + `GET admin/accounting/profit-loss` endpoint |
| `src/components/dashboard/admin/admin-tabs.tsx` | Added `profit_loss` tab with TrendingUp icon |
| `src/app/dashboard/page.tsx` | Added ProfitLossPanel lazy import, `AdminTabId` union entry, `PANEL_MAP` entry |
| `src/lib/staff-access-control.ts` | Added `profit_loss: { module: "ACCOUNTING", action: "VIEW" }` to TAB_PERMISSION_MAP |

### Files NOT Modified (Frozen)
| File | Phase |
|------|-------|
| `src/lib/services/general-ledger.service.ts` | 5A.1 🔒 |
| `src/lib/repositories/accounting-journal.repository.ts` | 5A.1 🔒 |
| `src/lib/types/accounting.types.ts` | 5A.1 🔒 |
| `src/components/dashboard/admin/general-ledger-panel.tsx` | 5A.1 🔒 |
| `src/lib/services/accounting-config.service.ts` | 5A.2 🔒 |
| `src/lib/services/fiscal-period.service.ts` | 5A.2 🔒 |
| `src/lib/services/opening-balance.service.ts` | 5A.2 🔒 |
| `src/components/dashboard/admin/accounting-setup-panel.tsx` | 5A.2 🔒 |

---

## Architecture

```
PostgreSQL (accounting_journal_line + accounting_account)
    ↓
AccountingJournalRepository.getTrialBalance()  [REUSED — no changes]
    ↓
ProfitLossService.getProfitLoss()  [NEW — read-only]
  → Filters to type ∈ {REVENUE, EXPENSE}
  → Classifies by parent_id hierarchy (NOT subtype alone)
  → Sign-corrects amounts
  → Builds 5-section structured response
  → Computes reconciliation against TB
    ↓
GET /api/v1/admin/accounting/profit-loss  [NEW]
  → ACCOUNTING.VIEW permission check
  → Branch isolation (BOLA)
  → Date range validation (both required)
    ↓
ProfitLossPanel  [NEW — separate from GeneralLedgerPanel]
  → Date picker + Generate button
  → Optional comparative period (dual API calls)
  → 5-section P&L table with formatted amounts
  → TB reconciliation indicator
```

## Design Decisions Implemented

| Decision | Implementation |
|----------|---------------|
| Account classification | `parent_id` hierarchy → parent group code (4100/4200/5100/5200/5300) |
| 5330 Depreciation | Classified under Financial (parent 5300), NOT Operating |
| Revenue sign | `net_balance = debit − credit`. Negate for display. |
| Expense sign | `net_balance = debit − credit`. Use as-is. |
| 4190 Sales Returns | Contra-revenue deduction from Gross Revenue |
| 5190 Purchase Discounts | Contra-expense deduction from COGS |
| GST | Excluded (balance sheet items) |
| Comparatives | Dual API calls — simple, consistent |
| Separate P&L tab | Own panel, not overloading GeneralLedgerPanel |
| Reconciliation | TB-derived profit vs P&L net profit, with variance |

## P&L Report Structure

```
I. OPERATING REVENUE
   4110, 4120, 4130, 4140
   Gross Revenue
   Less: 4190 Sales Returns
   → NET OPERATING REVENUE

II. COST OF GOODS SOLD
   5110, 5120, 5130, 5140
   Less: 5190 Purchase Discounts
   → TOTAL COGS

   ═══ GROSS PROFIT = Net Revenue − COGS ═══

III. OPERATING EXPENSES
   5210–5299 (12 leaf accounts)
   → TOTAL OPEX

   ═══ OPERATING PROFIT (EBIT) = Gross Profit − OpEx ═══

IV. OTHER INCOME
   4210, 4220
   → TOTAL OTHER INCOME

V. FINANCIAL & DEPRECIATION EXPENSES
   5310, 5320, 5330
   → TOTAL FINANCIAL

   ═══ NET PROFIT BEFORE TAX = EBIT + Other Income − Financial ═══
```

---

## Verification Results

### Phase 5A.3 Verification Suite: 104/104 ✅
| Section | Tests | Result |
|---------|-------|--------|
| PostgreSQL baseline | 4 | ✅ |
| Service & route mounting | 5 | ✅ |
| Authentication & RBAC | 3 | ✅ |
| Date validation | 3 | ✅ |
| P&L structure (5 sections) | 14 | ✅ |
| 5330 hierarchy classification | 4 | ✅ |
| Contra-account treatment | 14 | ✅ |
| GST & BS exclusion | 5 | ✅ |
| Zero-transaction state | 12 | ✅ |
| TB reconciliation identity | 8 | ✅ |
| Branch isolation / BOLA | 7 | ✅ |
| TAB_PERMISSION_MAP & UI wiring | 6 | ✅ |
| PostgreSQL post-test (zero mutations) | 9 | ✅ |
| Frozen code integrity (5A.1/5A.2) | 6 | ✅ |
| **TOTAL** | **104** | **0 failures** |

### TypeScript: 0 errors ✅

### Phase 5A.1 Regression: 71/71 ✅
### Phase 5A.2 Regression: 46/46 ✅

### Combined: 221/221 assertions, 0 failures

---

## Database State (Post-Implementation)

| Table | Count | Change |
|-------|-------|--------|
| `accounting_account` | 99 | Unchanged |
| `accounting_voucher` | 0 | Unchanged |
| `accounting_journal_entry` | 0 | Unchanged |
| `accounting_journal_line` | 0 | Unchanged |
| `accounting_fiscal_period` | 0 | Unchanged |
| `order` | 173 | Unchanged |
| `payment_transaction` | 53 | Unchanged |

**Zero mutations performed. P&L is read-only.**

---

## What This Phase Does NOT Do

- ❌ No new database tables or schema changes
- ❌ No new repository methods
- ❌ No mutations of any kind
- ❌ No modification to frozen Phase 5A.1 or 5A.2 code
- ❌ No income tax computation
- ❌ No Balance Sheet (Phase 5A.4)
- ❌ No Cash Flow Statement (Phase 5A.5)
- ❌ No Period-End Close (Phase 5A.6)

---

## Next Phases (NOT started)

| Phase | Status |
|-------|--------|
| 5A.1 — GL Ledger & Trial Balance | 🔒 Frozen |
| 5A.2 — Opening Balance & Fiscal Period | 🔒 Frozen |
| 5A.3 — Profit & Loss | 🔒 Frozen |
| 5A.4 — Balance Sheet | ⏳ Design gate required |
| 5A.5 — Cash Flow Statement | ⏳ Design gate required |
| 5A.6 — Period/Year-End Close | ⏳ Design gate required |
