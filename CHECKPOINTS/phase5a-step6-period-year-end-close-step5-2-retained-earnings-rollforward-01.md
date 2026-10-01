# Phase 5A.6 — Substep 5.2: Retained Earnings Roll-Forward Engine

## Implementation Checkpoint — 2026-10-01

### Status: ✅ COMPLETE — 97/97 tests pass, all regressions green, PostgreSQL pristine

---

## Scope Delivered

Three read-only reporting engines added to `PeriodCloseService` in
[period-close.service.ts](file:///e:/vig/cakes2home-main/cakes2home-main/frontend/src/lib/services/period-close.service.ts):

### 1. Retained Earnings Roll-Forward (`getRetainedEarningsRollForward`, L2258)
- Computes multi-year retained earnings continuity chain
- For each fiscal year: opening RE, net operating profit, transferred to RE, drawings transferred, reopen reversals, closing RE
- **Critical invariant enforced:** `closing_re(FY N) === opening_re(FY N+1)`
- Derives all data from the authoritative PostgreSQL double-entry journal — no snapshot tables
- Handles closed years (with actual transfer lines) and open years (with computed unclosed P&L)

### 2. Fiscal Year Summary (`getFiscalYearSummary`, L2507)
- Returns all configured fiscal years with: status (OPEN/CLOSED), period count, locked period count, `all_periods_locked`, net operating profit, close/reopen cycle counts, active closing voucher info, and `historical_lockout` status
- Enables the future 5.3 API to surface a dashboard of all fiscal years

### 3. Comparative P&L (`getComparativeProfitLoss`, L2663)
- Side-by-side comparison of two fiscal years with: amount, variance, variance_percent per account
- Sections: `operating_revenue`, `cost_of_goods_sold`, `operating_expenses`, `other_income`, `financial_expenses`
- Summary: current and compare totals for gross revenue, COGS, operating expenses, net profit, with absolute and percentage variance

---

## Design-Gate Compliance

| Constraint | Status |
|---|---|
| Derived from authoritative double-entry journal | ✅ All queries hit `accounting_journal_line` / `accounting_journal_entry` / `accounting_voucher` |
| No reporting snapshot tables | ✅ Zero new tables or migrations |
| No materialized views | ✅ Zero materialized views |
| Zero mutations (read-only) | ✅ Verified by test Section 13 (zero new vouchers/entries after report calls) |
| RBAC enforced (ACCOUNTING.VIEW) | ✅ PERMISSION_DENIED for unauthorized, BRANCH_ACCESS_DENIED for BOLA |
| No API route wiring (that's 5.3) | ✅ Zero route.ts changes for 5.2 methods |
| No UI (that's 5.4/5.5) | ✅ Zero component changes |

---

## Files Modified

| File | Change |
|---|---|
| `frontend/src/lib/services/period-close.service.ts` | Added `getRetainedEarningsRollForward`, `getFiscalYearSummary`, `getComparativeProfitLoss` + supporting types |

---

## Verification Matrix

### Substep 5.2 Test Suite (97/97)
| Section | Tests | Description |
|---|---|---|
| 1. Pre-Test Baseline | 6 | PostgreSQL pristine verification |
| 2. Setup | 5 | FY2324 environment with operational vouchers |
| 3. Pre-Close RE & FY Summary | 16 | Roll-forward before close, FY summary state, comparative P&L baseline |
| 4. Year-End Close | 3 | Execute FY2324 close |
| 5. Post-Close Roll-Forward | 12 | Verify FY2324→FY2425 continuity chain |
| 6. Post-Close FY Summary | 9 | CLOSED status, cycle counts, lockout flag |
| 7. FY2425 Activity & Comparative P&L | 9 | Cross-year P&L comparison with variance |
| 8. RBAC Enforcement | 5 | PERMISSION_DENIED, BRANCH_ACCESS_DENIED, ACCOUNTING.VIEW |
| 9. Multi-Year Range & Edge Cases | 5 | 3-year range parsing, single year |
| 10. Zero-Activity Year | 3 | FY2526 zero profit, carried opening RE |
| 11. Account 3300 Permanence | 1 | Opening Balance Equity untouched |
| 12. P&L Section Classification | 5 | Account→section mapping verification |
| 13. Read-Only Purity | 2 | Zero mutations from report calls |
| 14. Multi-Year Continuity Chain | 6 | 3-year FY2324→FY2425→FY2526 chain |
| 15. Rollback & Baseline | 6 | PostgreSQL pristine post-test |

### Full Regression Suite

| Suite | Result |
|---|---|
| Substep 5.2 — RE Roll-Forward | **97/97** ✅ |
| Substep 5.1 — Lockout Guard | **36/36** ✅ |
| Step 1 — Pre-Close Diagnostics | **75/75** ✅ |
| Step 2 — Period Lock/Unlock | **84/84** ✅ |
| Step 3 — Year-End Close | **85/85** ✅ |
| Step 4 — Year-End Reopen | **100/100** ✅ |
| Sales Invoice Reversal | **156/156** ✅ |
| Purchase Reversal | **101/101** ✅ |
| Security Regression | **21/21** ✅ |
| TypeScript (`tsc --noEmit`) | **0 errors** ✅ |
| **Cumulative** | **755/755** ✅ |

### Independent PostgreSQL Pristine Audit (18/18)

| Table | Expected | Actual |
|---|---|---|
| accounting_voucher | 0 | 0 ✅ |
| accounting_journal_entry | 0 | 0 ✅ |
| accounting_journal_line | 0 | 0 ✅ |
| accounting_fiscal_period | 0 | 0 ✅ |
| accounting_account | 99 | 99 ✅ |
| order | 173 | 173 ✅ |
| payment_transaction | 53 | 53 ✅ |
| branch | 57 | 57 ✅ |
| branch_inventory | 424 | 424 ✅ |
| inventory_cost_lot | 0 | 0 ✅ |
| inventory_movement | 0 | 0 ✅ |
| inventory_cost_consumption | 0 | 0 ✅ |
| purchase | 0 | 0 ✅ |
| purchase_item | 0 | 0 ✅ |
| purchase_payment | 0 | 0 ✅ |
| supplier | 0 | 0 ✅ |
| accounting_start_date | unconfigured | unconfigured ✅ |
| accounting audit_log (period/year actions) | 0 | 0 ✅ |

---

## Remaining Substeps (Not Started)

- **5.3** — API Route Wiring for reporting endpoints
- **5.4** — UI: Period/Year-End Close Management Dashboard
- **5.5** — UI: Financial Reports (RE Roll-Forward, Comparative P&L)
