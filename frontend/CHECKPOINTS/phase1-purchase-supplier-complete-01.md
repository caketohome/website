# Phase 1 Complete: Supplier + Purchase Module

**Date**: 2026-09-23  
**Status**: ✅ COMPLETE — TypeScript 0 errors, Build exit 0  
**Branch scope**: Server-enforced only — never from client input

---

## What Was Built

### Database (Live — Additive Only)

| Table | Columns | Indexes | Notes |
|-------|---------|---------|-------|
| `supplier` | 15 | 3 | FK → branch(id) ON DELETE SET NULL |
| `purchase` | 24 | 5 | FK → supplier, branch NOT NULL; status CHECK; UNIQUE (branch_id, supplier_id, invoice_no) |
| `purchase_item` | 17 | 3 | FK → purchase CASCADE; quantity > 0 CHECK |
| `purchase_payment` | 10 | 2 | FK → purchase CASCADE; amount > 0 CHECK |

**No destructive migrations. No DROP. No RENAME. All additive.**

### ID Convention

| Entity | Prefix | Example |
|--------|--------|---------|
| Supplier | `sup_` | `sup_LKJZ8FQR3A` |
| Purchase | `pur_` | `pur_LKJZ8FQR3A` |
| Purchase Item | `puri_` | `puri_LKJZ8FQR` |
| Purchase Payment | `purp_` | `purp_LKJZ8FQR` |

### Files Created

**Types**
- `src/lib/types/purchase.types.ts` — all DTOs, status enum, report row types

**Repositories** (SQL only, no business logic)
- `src/lib/repositories/supplier.repository.ts` — CRUD, soft-delete with active-purchase guard
- `src/lib/repositories/purchase.repository.ts` — atomic create/update, lifecycle transitions, 5 report queries

**Services** (business logic, no SQL)
- `src/lib/services/supplier.service.ts` — GSTIN regex validation (format: `29ABCDE1234F1Z5`)
- `src/lib/services/purchase.service.ts` — total validation, item validation, branch enforcement, self-approval guard

**API Routes** (all in `/api/v1/[...path]/route.ts`)

| Method | Path | Permission |
|--------|------|------------|
| GET | `admin/suppliers` | PURCHASE.VIEW |
| GET | `admin/suppliers/:id` | PURCHASE.VIEW |
| POST | `admin/suppliers` | PURCHASE.CREATE |
| PUT | `admin/suppliers/:id` | PURCHASE.EDIT |
| DELETE | `admin/suppliers/:id` | PURCHASE.DELETE |
| GET | `admin/purchases` | PURCHASE.VIEW |
| GET | `admin/purchases/:id` | PURCHASE.VIEW |
| GET | `admin/purchases/report/register` | PURCHASE.VIEW |
| GET | `admin/purchases/report/supplier-wise` | PURCHASE.VIEW |
| GET | `admin/purchases/report/item-wise` | PURCHASE.VIEW |
| GET | `admin/purchases/report/bill-wise` | PURCHASE.VIEW |
| GET | `admin/purchases/report/gst-hsn` | PURCHASE.VIEW |
| POST | `admin/purchases` | PURCHASE.CREATE |
| POST | `admin/purchases/:id/payments` | PURCHASE.EDIT |
| POST | `admin/purchases/:id/status` | PURCHASE.EDIT |
| PUT | `admin/purchases/:id` | PURCHASE.EDIT |
| DELETE | `admin/purchases/:id` | PURCHASE.DELETE |

**UI**
- `src/components/dashboard/admin/supplier-panel.tsx` — list, create/edit modal, deactivate, search
- `src/components/dashboard/admin/purchase-panel.tsx` — list with status filter, create with line items + live tax computation, detail view, approval workflow

**Dashboard Pages**
- `src/app/dashboard/shop/suppliers/page.tsx`
- `src/app/dashboard/shop/purchases/page.tsx`
- Dashboard `admin-tabs.tsx` — Suppliers + Purchases tabs added
- Dashboard `page.tsx` — both panels wired into PANEL_MAP

---

## Architecture Decisions

### Branch Scope
- Branch managers: `branchId` always from `resolveUserContext(req).branchId` — cannot be overridden
- Super Admin: may specify `branch_id` in query/body for cross-branch operations
- Branch ID is NEVER accepted from `x-user-role`, `x-user-id`, cookies, or hidden fields

### Status Lifecycle
```
DRAFT → SUBMITTED → APPROVED → POSTED
             ↑          |
             └── (DRAFT) ← can be returned to draft from SUBMITTED
```
- Only SUPER_ADMIN can APPROVE or POST
- POSTED is terminal — no further edits
- Self-approval not explicitly guarded at DB level, enforced in `PurchaseService.transitionStatus`

### Inventory Boundary
- Cakes: **NOT** quantity-controlled. Purchase items support freetext `description` with optional `product_id`
- Physical accessories: `quantity` (NUMERIC 14,4), `rate`, full GST tax breakdown

### Financial Integrity
- All monetary columns: `NUMERIC(14,2)` — no floating point
- Server validates: `taxable_value + cgst + sgst + igst ≈ total` (±₹0.50 tolerance)
- No fabricated values anywhere — empty data returns empty arrays

### GST
- GSTIN validated client-side (regex) AND server-side in `SupplierService`
- Purchase GST/HSN report aggregates from actual `purchase_item` rows only
- `branch_gstin` for invoice printing comes from existing Admin Panel setting (not duplicated)

---

## Report Endpoints Delivered

| Report | Endpoint | Dimensions |
|--------|----------|------------|
| Purchase Register | `report/register` | branch, supplier, date range, status |
| Supplier-wise Summary | `report/supplier-wise` | branch, date range |
| Item-wise Summary | `report/item-wise` | branch, date range |
| Bill-wise View | `report/bill-wise` | branch, supplier, date range |
| GST/HSN Summary | `report/gst-hsn` | branch, date range |

---

## Verification

| Check | Result |
|-------|--------|
| `npx tsc --noEmit` | ✅ Exit 0 |
| `npm run build` | ✅ Exit 0 |
| DB migration committed | ✅ 4 tables, 17 indexes |
| Destructive DB operations | ✅ None |
| Fabricated values | ✅ None |
| Pincode used anywhere | ✅ No |
| Client branch_id trusted | ✅ No — session only |

---

## Deferred (Not Phase 1 Scope)

- Purchase Excel export — Phase 1 reports are JSON API only
- Accounting posting (`posted_at` field reserved for Phase 7/8)
- Supplier statement / aging report — Phase 2+
- Purchase Order (PO) vs Purchase Bill distinction — Phase 2+
- GST return filing integration — Phase 5+
