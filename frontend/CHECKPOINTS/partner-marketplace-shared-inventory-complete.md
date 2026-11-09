# Checkpoint: Partner Marketplace, Shared Cake & Bouquet Inventory, Feature Toggles, and Holiday Scheduling

**Project:** CakeToHome ERP  
**Date:** 2026-10-14  
**Status:** ✅ **100% COMPLETE & VERIFIED**  
**Database Invariants:** CoA strictly 100 canonical accounts, Trial Balance: Dr ₹3,380.00 = Cr ₹3,380.00 (Zero Imbalance), Active Delivery Partners: 30, Active Branches: 48, Active Customers: 56, 0 residual routing assignments, 0 locks.

---

## 1. Executive Summary

In accordance with strict ERP source-of-truth standards, all five requested capabilities have been implemented and verified against live PostgreSQL (`aws-1-ap-south-1.pooler.supabase.com:6543/postgres`). Frontend state, in-memory mocks, and static arrays were completely bypassed in favor of authoritative database persistence, atomic concurrency locks (`SELECT ... FOR UPDATE`), server-side RBAC, and full audit logging.

```
UI (Admin Panels & Storefront) → API Monolith (/api/v1/...) → Domain Services → Repositories → Live PostgreSQL
```

---

## 2. Implemented Capabilities

### A. Shared Cake & Bouquet Central Inventory Pool
- **Architecture**: Authoritative single source of truth for all fresh cakes and flower bouquets in PostgreSQL (`shared_inventory`). Branches and marketplace partners share this pool without duplicate, conflicting balances.
- **Atomic Concurrency**: High-concurrency reservations locked using row-level `SELECT ... FOR UPDATE`.
- **Zero Overselling**: Verified by concurrency stress test: 10 parallel reservation attempts against 3 available units produced exactly 3 successes and 7 rejections.
- **Auditable Lifecycle**: Tracks `RESERVED` → `CONFIRMED` → `FULFILLED` → `RELEASED`. Idempotent cancellation and release verified (no duplicate stock adjustments).
- **Audit Movement Ledger**: Real-time entries logged in `inventory_movement` with actor role, direction, quantities, and audit narration.

### B. Dynamic Feature Flags & Governance
- **Architecture**: Persisted in `feature_flag` table with hierarchical resolution: `GLOBAL` → `BRANCH` → `PARTNER`.
- **System Mandatory Lockout**: Core safety flags (`SHARED_INVENTORY_POOL`, `OPERATIONAL_CLOSURE_ENFORCEMENT`) enforce server-side lockouts against deactivation.
- **Audit History**: Every toggle writes immutable audit history to `feature_flag_audit` recording actor ID, role, previous value, new value, reason, and timestamp.

### C. Branch & Partner Holiday / Closure Scheduling
- **Architecture**: Operating closures recorded in `operational_closure` using Asia/Kolkata (IST) calendar dates (`YYYY-MM-DD`).
- **Storefront Fulfillment Gating**: Automatically invalidates fulfillment paths during active closures on checkout and PDP routes (`/api/v1/checkout/validate-availability`).
- **Impacted Order Protection**: Existing confirmed orders overlapping a newly scheduled closure are **never silently cancelled or refunded**. They are recorded in `operational_closure_impact` in status `PENDING_REVIEW` for operational reassignment.

### D. Partner Marketplace Integration
- **Commercial Partner Master**: Distinct from delivery fleet/riders (`marketplace_partner`). Stores legal name, trade name, GSTIN, PAN, bank details, and tenant boundary.
- **Tenant Isolation**: Multi-tenant isolation enforced at the service and repository layers. Partner A cannot query or mutate Partner B's stores, orders, or agreements.
- **Commercial Agreements**: Configurable agreements (`marketplace_agreement`) supporting `COMMISSION_PERCENTAGE`, `FIXED_PER_ORDER`, `WHOLESALE_TRANSFER`, and `HYBRID`.
- **Order Snapshots**: Immutable snapshot captured at order placement (`marketplace_order_snapshot`) freezing commercial terms to prevent retroactive calculation shifts.

### E. Partner Invoice Receipt & Reconciliation
- **Reconciliation Statement Engine**: Calculates order-level reconciliation covering gross product sales, GST, discounts, and retained marketplace commission.
- **Excel Export**: Multi-sheet formatted Excel workbook export (`.xlsx`) via `/api/v1/admin/marketplace/reconciliation/export` using `ExcelExportService`.
- **Invoice Receipt**: Records partner's already-issued tax invoice (`marketplace_partner_invoice`) with duplicate invoice number guard.
- **Discrepancy Detection**: Automated comparison of partner claimed invoice amount vs PostgreSQL calculated entitlement, flagging `DISCREPANCY_DETECTED`.
- **Bills Payable Linkage**: Administrative 1-click approval links the verified invoice to Bills Payable (`accounting_voucher_id`) without auto-posting or premature cash outflow.

---

## 3. Database Migrations & Schemas Applied

1. `shared_inventory`: Central stock pool (`id`, `product_id`, `variant_id`, `merchandise_type`, `title`, `quantity`, `reserved`, `safety_threshold`).
2. `inventory_allocation`: Quota allocations per branch/partner.
3. `inventory_reservation`: Order reservations (`id`, `shared_inventory_id`, `order_id`, `entity_type`, `entity_id`, `quantity`, `status`, `expires_at`).
4. `inventory_movement`: Safely extended with `shared_inventory_id`, `partner_id`, `actor_role`, `previous_quantity`, `new_quantity`, `previous_reserved`, `new_reserved`.
5. `feature_flag`: Hierarchical feature toggles (`id`, `key`, `name`, `scope`, `entity_id`, `is_enabled`, `is_system_mandatory`).
6. `feature_flag_audit`: Immutable toggle audit ledger.
7. `operational_closure`: Branch & partner operating schedules (`id`, `entity_type`, `entity_id`, `start_date`, `end_date`, `is_full_day`, `status`).
8. `operational_closure_impact`: Overlapping orders impact queue (`id`, `closure_id`, `order_id`, `order_delivery_date`, `impact_status`).
9. `marketplace_partner`: Commercial vendors master table.
10. `marketplace_store`: Partner storefront locations and coordinates.
11. `marketplace_agreement`: Commercial contract rules and commission rates.
12. `marketplace_order_snapshot`: Frozen order-time agreement snapshots.
13. `marketplace_partner_invoice`: Partner invoice receipt, calculated reconciliation, and AP linkage.
14. `marketplace_complaint`: Partner-scoped customer complaint tracking.

---

## 4. UI & Admin Dashboard Integration

Created 4 rich, responsive, dark-mode compatible admin panels connected directly to live PostgreSQL:
- [marketplace-panel.tsx](file:///E:/vig/cakes2home-main/cakes2home-main/frontend/src/components/dashboard/admin/marketplace-panel.tsx): Commercial partner directory, onboarding wizard, statement calculation, Excel export, invoice receipt, discrepancy review, and Bills Payable approval.
- [shared-inventory-panel.tsx](file:///E:/vig/cakes2home-main/cakes2home-main/frontend/src/components/dashboard/admin/shared-inventory-panel.tsx): Central stock pool monitor, category filter (cakes vs bouquets), ATP calculations, safety threshold indicators, and authoritative stock adjustment modal with audit trail.
- [feature-flags-panel.tsx](file:///E:/vig/cakes2home-main/cakes2home-main/frontend/src/components/dashboard/admin/feature-flags-panel.tsx): Dynamic toggle switches, scope inheritance indicators, mandatory flag protection, and live audit history.
- [operational-closures-panel.tsx](file:///E:/vig/cakes2home-main/cakes2home-main/frontend/src/components/dashboard/admin/operational-closures-panel.tsx): Holiday scheduling modal (single day or date range), calendar overview, closure cancellation, and impacted orders queue monitor.
- Integrated into [AdminSidebar.tsx](file:///E:/vig/cakes2home-main/cakes2home-main/frontend/src/components/admin/AdminSidebar.tsx), [admin-tabs.tsx](file:///E:/vig/cakes2home-main/cakes2home-main/frontend/src/components/dashboard/admin/admin-tabs.tsx), and [dashboard/page.tsx](file:///E:/vig/cakes2home-main/cakes2home-main/frontend/src/app/dashboard/page.tsx).

---

## 5. Verification Test Evidence (Live PostgreSQL)

| Verification Suite | Test Script | Results | Status |
|---|---|---|---|
| **TypeScript Compilation** | `npx tsc --noEmit` | **0 errors (Exit Code 0)** | ✅ PASS |
| **Shared Inventory & Concurrency** | [test_shared_inventory_and_concurrency.js](file:///E:/vig/cakes2home-main/cakes2home-main/frontend/scratch/test_shared_inventory_and_concurrency.js) | 10 concurrent requests → **3 reserved, 7 oversell prevented**, lifecycle confirmed & fulfilled, idempotent release verified, movements logged | ✅ PASS |
| **Feature Flags & Hierarchy** | [test_feature_flags_and_hierarchy.js](file:///E:/vig/cakes2home-main/cakes2home-main/frontend/scratch/test_feature_flags_and_hierarchy.js) | Global inheritance verified, branch override isolated without pollution, mandatory flag lockout enforced, audit log confirmed | ✅ PASS |
| **Operational Closures & Impact** | [test_operational_closures_and_impact.js](file:///E:/vig/cakes2home-main/cakes2home-main/frontend/scratch/test_operational_closures_and_impact.js) | Storefront availability gated, outside date permitted, impacted order registered in `PENDING_REVIEW` without cancellation, cancellation restored availability | ✅ PASS |
| **Marketplace & Reconciliation** | [test_marketplace_and_reconciliation.js](file:///E:/vig/cakes2home-main/cakes2home-main/frontend/scratch/test_marketplace_and_reconciliation.js) | Partner onboarding, tenant store isolation, 15% agreement snapshot, order-level statement calculated, discrepancy detected, duplicate invoice rejected, Bills Payable linked | ✅ PASS |
| **Forensic Financial Invariants** | [independent_c7_12_forensic_audit.js](file:///E:/vig/cakes2home-main/cakes2home-main/frontend/scratch/independent_c7_12_forensic_audit.js) | **CoA = 100, Trial Balance: Dr ₹3,380.00 = Cr ₹3,380.00**, 6 vouchers, 4 journal entries, 10 journal lines, 30 delivery partners, 48 branches, 56 customers, 0 locks | ✅ PASS |

---

## 6. Git & Baseline Governance

- `git status` confirms zero resets, stashes, clean operations, commits, or branch switches.
- Previous baseline C7.8–C7.14 completely preserved and verified intact.
