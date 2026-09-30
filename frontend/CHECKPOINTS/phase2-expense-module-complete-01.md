# CakeToHome ERP — Phase 2: Expense Module Complete

**Date**: 2026-09-23T11:47:00+05:30  
**Branch**: task/dev  
**HEAD**: f7d9a47 (no new commits — changes are uncommitted as per project rules)

---

## Summary

Phase 1 verification and Phase 2 Expense Module are both complete.

---

## Part A — Phase 1 Final Verification

### A2 Security Defects Found and Fixed

Two branch isolation defects were discovered during independent Phase 1 verification:

| Defect | Route | Problem | Fix |
|--------|-------|---------|-----|
| V2-A | `PUT admin/suppliers/:id` | No branch scope — manager could edit any supplier | Check supplier.branch_id vs session branchId before edit |
| V2-B | `DELETE admin/suppliers/:id` | No branch scope — manager could deactivate any supplier | Check supplier.branch_id vs session branchId before delete |

All other checks: PASS. Full report in `CHECKPOINTS/phase1-final-verification-02.md`.

---

## Part B — Phase 2: Expense Module

### B1 analytics_expense Decision

`analytics_expense` is a dormant table with:
- `amount INTEGER` (not NUMERIC — can't store decimal paise)
- `category TEXT` (free-text — no master table)
- No status lifecycle, no approval fields, no GST columns
- 0 rows, 0 code consumers

**Decision**: Do NOT evolve `analytics_expense`. Create canonical `expense` + `expense_category` tables.

`analytics_expense` is left untouched.

### Database Changes (Additive Only)

```sql
-- New Tables
CREATE TABLE public.expense_category (...)   -- 11 seeded defaults
CREATE TABLE public.expense (...)             -- 0 rows

-- New Indexes: 8 total
idx_expense_branch_id, idx_expense_date, idx_expense_category_id,
idx_expense_status, idx_expense_supplier_id, idx_expense_category_active,
expense_pkey, expense_category_pkey

-- No tables dropped
-- No columns dropped
-- No existing data modified
```

### Seeded Expense Categories

Rent, Electricity, Internet & Phone, Salaries & Wages, Marketing, Packaging, Maintenance, Office Supplies, Fuel & Transport, Cleaning, Other

### Files Created

| File | Purpose |
|------|---------|
| `src/lib/types/expense.types.ts` | All DTOs, status lifecycle, report row types |
| `src/lib/repositories/expense-category.repository.ts` | Category CRUD with soft-delete and active-expense guard |
| `src/lib/repositories/expense.repository.ts` | Expense CRUD, lifecycle, soft-delete, 7 report queries |
| `src/lib/services/expense.service.ts` | Business logic, total validation, lifecycle, category management |
| `src/components/dashboard/admin/expense-panel.tsx` | Admin UI: list, create, detail, lifecycle actions, categories |
| `src/app/dashboard/shop/expenses/page.tsx` | Standalone route at /dashboard/shop/expenses |
| `migrate_phase2_expense.js` | One-time migration script (already executed) |
| `CHECKPOINTS/phase1-final-verification-02.md` | Full Phase 1 audit report |

### Files Modified

| File | Change |
|------|--------|
| `route.ts` | Added ExpenseService import; GET/POST/PUT/DELETE for admin/expenses and admin/expense-categories; supplier PUT/DELETE branch scope fixes |
| `repositories/index.ts` | Added expense repo exports |
| `services/index.ts` | Added expense service export |
| `admin-tabs.tsx` | Added Expenses tab (Receipt icon, after Purchases) |
| `dashboard/page.tsx` | Added ExpensePanel dynamic import, AdminTabId union, PANEL_MAP entry |

### API Endpoints

| Method | Path | Permission | Notes |
|--------|------|------------|-------|
| GET | admin/expense-categories | EXPENSE.VIEW | List categories |
| POST | admin/expense-categories | EXPENSE.CREATE | Create category |
| PUT | admin/expense-categories/:id | EXPENSE.EDIT | Update category |
| DELETE | admin/expense-categories/:id | EXPENSE.EDIT | Soft-delete category |
| GET | admin/expenses | EXPENSE.VIEW | List with filters + pagination |
| GET | admin/expenses/:id | EXPENSE.VIEW | Get by ID (branch-scoped) |
| POST | admin/expenses | EXPENSE.CREATE | Create expense (branchId from session) |
| PUT | admin/expenses/:id | EXPENSE.EDIT | Update DRAFT expense only |
| DELETE | admin/expenses/:id | EXPENSE.DELETE | Soft-delete DRAFT/SUBMITTED only |
| POST | admin/expenses/:id/status | EXPENSE.EDIT | Status transition |
| GET | admin/expenses/report/register | EXPENSE.VIEW | Full register |
| GET | admin/expenses/report/category-wise | EXPENSE.VIEW | By category |
| GET | admin/expenses/report/branch-wise | EXPENSE.VIEW | By branch (SUPER_ADMIN only) |
| GET | admin/expenses/report/date-wise | EXPENSE.VIEW | By date |
| GET | admin/expenses/report/payment-method | EXPENSE.VIEW | By payment method |
| GET | admin/expenses/report/supplier-wise | EXPENSE.VIEW | By supplier |
| GET | admin/expenses/report/gst-summary | EXPENSE.VIEW | GST/tax summary |

### Design Invariants Maintained

- **No accounting journal entries** — posting is module-state only
- **No cake inventory changes** — expense module has no product/stock coupling
- **branchId always from session** — never from client body
- **Server-side total validation** — taxable_value + taxes ≈ total (±₹0.50)
- **Non-super-admin cannot APPROVE/POST** — enforced in `ExpenseService.transitionStatus`
- **Soft-delete only** — APPROVED/POSTED expenses cannot be deleted
- **analytics_expense untouched** — backward compatible

### Verification

| Check | Result |
|-------|--------|
| DB migration | ✅ EXIT 0 — 2 tables, 11 categories, 8 indexes |
| TSC (`--noEmit`) | ✅ EXIT 0 (confirmed: implementation run + reconciliation run) |
| `npm run build` | ✅ EXIT 0 (confirmed: implementation run + reconciliation run — 33 pages) |

---

## Next: Phase 3 (Fleet/Delivery Cost) — PENDING
## Next: Phase 4 (Accounting Foundations) — PENDING
