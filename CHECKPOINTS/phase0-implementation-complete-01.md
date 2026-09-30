# CHECKPOINT: Phase 0 Completion
**Date**: 2026-09-22
**Status**: COMPLETE ✅
**Next Phase**: Phase 1 — Purchase Register (supplier tables, purchase_invoice, purchase_item)

---

## Phase 0 Changes Executed

### P0-1: `getAreaPincodePerformance` → `getServiceAreaPerformance`
- **report.types.ts**: Replaced `AreaPincodeRow` with `ServiceAreaRow`. New fields: `zoneName`, `zoneId`, `branchId`, `branchName`, `hasPolygon`, `radiusKm`. `AreaPincodeRow` kept as `@deprecated` alias.
- **report.repository.ts**: New method `getServiceAreaPerformance()` — joins `delivery_zone` INNER JOIN `branch` (active branches only, orphaned zones excluded). Groups orders by zone ID, not pincode string.
- **report.service.ts**: Renamed to `getServiceAreaPerformance()`, monthly composite updated.
- **route.ts**: `/admin/reports/service-areas` is now canonical. `/areas` and `/area-pincode` are backward-compatible aliases.
- **enterprise-reports-engine.tsx**: Tab label → "Service Areas". State variable → `serviceAreaPerformance`. API call → `/service-areas`. Table headers updated: Zone Name, Branch, City, Fence Type. AOV shows `—` if null.

### P0-2: Orphaned Zone Exclusion
- The INNER JOIN on `branch.deleted_at IS NULL` plus `branch.id` pattern filters automatically excludes the 7 orphaned zones with `branch_id = 'res_01KXYMAHGFPRY1G9TZKEVGAGAT'`.

### P0-3: Fabricated Value Removal (`reports-engine-data.ts`)
- **COGS**: `getProductCogs()` now returns `number | null`. Removed `price * 0.35` fallback.
- **Packaging cost**: Removed `netSalesExclTax * 0.038`. Returns `null`.
- **Delivery timing**: `prepTimeMins`, `dispatchTimeMins`, `deliveryTimeMins`, `totalCycleTimeMins` now return `null` when not tracked. Removed `|| 25`, `|| 15`, `|| 20` fallbacks.
- Interfaces updated: `ProductPerformanceItem` and `OrderReportItem` — cost/profit/margin/timing fields are now `number | null`.

### P0-4: GSTIN Verification
- `resolveSellerGstInfo()` in `report.service.ts` already calls `ApiEngine.listGstRegistrations()` and rejects placeholder GSTINs (`29AAAAA0000A1Z5`, `00AAAAA0000A0Z0`). **No change needed.**

### P0-5: PERMISSION_CATALOG Extension (`staff-access-control.ts`)
Added 4 new permission groups:
- **PURCHASE**: VIEW, CREATE, EDIT, APPROVE, DELETE, EXPORT
- **EXPENSE**: VIEW, CREATE, EDIT, APPROVE, EXPORT
- **FLEET**: VIEW, MANAGE, EXPORT
- **ACCOUNTING**: VIEW, POST, APPROVE, EXPORT

---

## Architecture Decisions Confirmed
- Pincode is NOT a reporting or service-area dimension. `delivery_zone.name` (or `branch.name || ' Zone'` fallback) is the display label.
- COGS is `null` unless explicitly stored in `product.metadata.cost_price` or `product.metadata.cogs` or `order_item.unit_cost`.
- Test/E2E branches excluded from all operational KPIs via branch ID pattern filters and `OrderClassification`.
- Orphaned `delivery_zone` rows (no active branch) auto-excluded by INNER JOIN.

---

## Files Changed
1. `frontend/src/lib/types/report.types.ts`
2. `frontend/src/lib/repositories/report.repository.ts`
3. `frontend/src/lib/services/report.service.ts`
4. `frontend/src/app/api/v1/[...path]/route.ts`
5. `frontend/src/components/dashboard/admin/enterprise-reports-engine.tsx`
6. `frontend/src/lib/reports-engine-data.ts`
7. `frontend/src/lib/staff-access-control.ts`

---

## Phase 1 Prerequisites (NOT STARTED)
- Schema design for `supplier`, `purchase_invoice`, `purchase_item` tables
- Migration plan (additive only, no destructive changes)
- Manager-creates / Super Admin-approves workflow
- Stock movement trigger: purchase_item → inventory_movement
