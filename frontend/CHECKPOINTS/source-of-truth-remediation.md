# CHECKPOINT — PostgreSQL Source-of-Truth Remediation

**Branch**: `checkpoint/c-phases-baseline`  
**Current HEAD**: `d231cee` (`feat(delivery): wire platform delivery bridges, customer receipts, and gateway settlements for Phase 5C`)  
**Date**: 2026-10-14  
**Status**: 100% COMPLETE & VERIFIED  
**Governing Directive**: PostgreSQL is the single source of truth for all business data, CMS content, operational workflows, and reports. Competing authoritative in-memory stores and fabricated fallback values (especially dummy GSTIN `29AAAAA0000A1Z5`) have been completely remediated.

---

## 1. Executive Summary

This remediation establishes PostgreSQL as the undisputed, authoritative single source of truth across all core domains of CakeToHome ERP, systematically retiring in-memory stores (`memoryStore`), JSON mock fallbacks, and fabricated identifier fallbacks.

All changes were executed with strict preservation of the working tree (zero resets, stashes, cleans, commits, pushes, or branch switches). The accounting ledger baseline (Trial Balance Dr ₹3,380.00 = Cr ₹3,380.00 across 100 Chart of Accounts entries) has been maintained with zero imbalance or leakage.

---

## 2. Remediated Modules

### Module 1: CMS / Page Builder Subsystem
- **Repository Implementation**: Extended `CmsRepository` (`frontend/src/lib/repositories/cms.repository.ts`) with durable PostgreSQL methods:
  - `duplicatePage`: Deep clone of pages and layout configurations into PostgreSQL.
  - `rollbackPage`: Point-in-time restoration from relational revision snapshots.
  - `reorderSections`: Atomic section sequence updates in `public.cms_homepage_section`.
  - `savePageBuilderLayout`: Draft configuration persistence in PostgreSQL JSONB.
  - `publishPage`: Transactional snapshot creation in `public.cms_revision` and publication flag update.
  - `findAllBlocks`, `findNavigation`, `findRedirect`: Direct SQL lookups.
- **Client & Route Wiring**:
  - `frontend/src/lib/data/cms.ts`: Retired `getServerApiEngine()` and `memoryStore` fallbacks; routes direct queries to `CmsRepository`.
  - `frontend/src/app/api/v1/[...path]/route.ts`: Wired all CMS routes (`cms/pages`, `cms/sections`, `cms/blocks`, `cms/navigation`, `cms/redirects`, `cms/pages/:id/publish`, `cms/pages/:id/rollback`, `cms/pages/:id/duplicate`) directly to `CmsRepository`.
- **Verification**: `scratch/test_cms_source_of_truth.js` passed **22/22 tests**.

### Module 2: GST Registration Lookup & Removal of Fabricated GSTINs
- **Fabricated GSTIN Removal**: The dummy value `"29AAAAA0000A1Z5"` was completely excised across all services, repositories, print modals, report engines, and API endpoints. When unconfigured, queries legitimately return `null` instead of masking missing configuration with fictitious data.
  - `frontend/src/lib/services/delivery-invoicing.service.ts`: Dynamically resolves seller GSTIN from branch metadata or `ReportRepository.getSellerGstInfo()`; returns `null` if unconfigured.
  - `frontend/src/lib/services/corporate-gifting.service.ts`: Dynamically resolves seller GSTIN from database company/GST master.
  - `frontend/src/lib/services/bills-receivable.service.ts`: Removed hardcoded dummy GSTIN fallback.
  - `frontend/src/lib/repositories/report.repository.ts`: Added `getSellerGstInfo()` executing SQL join on `public.gst_registration` and `public.company`.
  - `frontend/src/lib/services/report.service.ts`: Added async `resolveSellerGstInfo()` calling `ReportRepository.getSellerGstInfo()`.
  - `frontend/src/lib/excel-export-service.ts`: Dynamically resolves `sellerGstin`; eliminated row fallback string.
  - `frontend/src/app/api/v1/[...path]/route.ts`: Invoiced orders dynamically resolve branch metadata and company master. Added compliance endpoints:
    - `GET admin/compliance/gst-registrations`: Calls `GstRegistrationRepository.listAll()`.
    - `POST admin/compliance/gst-registrations`: Calls `GstRegistrationService.createRegistration`.
    - `POST admin/compliance/gst-registrations/:id/verify`: Calls `GstRegistrationRepository.update`.
    - `PUT admin/compliance/gst-registrations/:id`: Calls `GstRegistrationService.updateRegistration`.
  - `frontend/src/components/dashboard/admin/order-invoice-print-modal.tsx`: Removed fallback dummy GSTIN.
  - `frontend/src/components/dashboard/admin/enterprise-reports-engine.tsx`: Dynamically binds GSTIN badge.
  - `frontend/src/lib/api-engine.ts`: Replaced hardcoded fallback dummy GSTINs with `null`.
- **Verification**: `scratch/test_gst_source_of_truth.js` passed **11/11 tests**.

### Module 3: Legacy Report & Dashboard Routes
- **Repository Implementation**: Added `getLegacyDashboardMetrics` and `getLegacySalesMetrics` to `ReportRepository` (`frontend/src/lib/repositories/report.repository.ts`), performing parameterized SQL aggregations on `public."order"`:
  - `gross_revenue`, `today_revenue`, `total_orders`, `net_sales`, `gross_profit`, `net_profit`, `aov`, `delivered_orders`, `pending_orders`, `status_distribution`, `top_branches`.
- **Route Wiring** in `frontend/src/app/api/v1/[...path]/route.ts`:
  - `admin/reports/dashboard` -> `ReportRepository.getLegacyDashboardMetrics`
  - `admin/reports/sales` -> `ReportRepository.getLegacySalesMetrics`
  - `admin/reports/orders` -> `OrderRepository.listOrders`
  - `admin/reports/products` -> `ReportService.getProductPerformance`
  - `admin/reports/delivery` -> `ReportService.getDeliveryPerformance`
  - `admin/reports/branches` -> `ReportService.getBranchPerformance`
  - `admin/reports/finance` -> `ReportService.getTransactionalMetrics` & `getPaymentBreakdown`
  - `admin/reports/executive-summary` -> `ReportService.getTransactionalMetrics` + `getProductPerformance` + `getDeliveryPerformance`
  - `admin/reports/exceptions` -> `ReportService.getExceptionAudit`

### Module 4: Delivery-Partner Job Listings
- In `frontend/src/lib/data/deliveries.ts`: Server-side `listDeliveries` queries `OrderRepository.listOrders({ limit: 100 })` directly from PostgreSQL `public."order"`.

### Module 5: Product & Catalog Reads/Writes
- In `frontend/src/lib/data/catalog.ts`: Rewrote `listProductReviews`, `submitReview`, `listWishlist`, `addToWishlist`, and `removeFromWishlist` to query `ReviewRepository` (`public.product_review`) and `FavoriteRepository` (`public.customer_favorite`).

### Modules 6 & 7: Order Lifecycle & Cart Persistence
- In `frontend/src/app/api/v1/[...path]/route.ts`:
  - `GET cart`: Prioritized `CartRepository.findCartById(cartId)` from PostgreSQL `public.cart` and `public.line_item`, returning `null` when a cart is not found instead of generating fabricated mock items.

### Module 8: SEO, CRM, Reminders & Configuration
- In `frontend/src/lib/repositories/customer.repository.ts`:
  - Added `listReminders` and `saveReminder` reading and persisting directly to `customer.metadata->'reminders'` via PostgreSQL `jsonb_set`.
- In `frontend/src/app/api/v1/[...path]/route.ts`:
  - `admin/crm/reminders` (GET): Calls `CustomerRepository.listReminders()`.
  - `admin/crm/customers/:id/reminders` (GET/POST): Calls `CustomerRepository.listReminders(id)` and `saveReminder(id, body)`.

---

## 3. Verification Evidence

### 1. Static Type Safety
- **Command**: `npx tsc --noEmit`
- **Result**: `0 errors` (Process exited with code 0).

### 2. CMS & Page Builder PostgreSQL Source-of-Truth Suite
- **Command**: `node scratch/test_cms_source_of_truth.js`
- **Result**: **22 PASSED | 0 FAILED**
  - Page creation in PostgreSQL
  - Publication & relational revision snapshot creation in `public.cms_revision`
  - Atomic section reordering
  - Page duplication with clean teardown
  - Revision rollback
  - Block lookups from PostgreSQL

### 3. GST Registration & Fake Identifier Elimination Suite
- **Command**: `node scratch/test_gst_source_of_truth.js`
- **Result**: **11 PASSED | 0 FAILED**
  - `ReportRepository.getSellerGstInfo()` resolves `null` when unconfigured (no fallback dummy string)
  - `ReportService.getTransactionalMetrics()` metadata returns real DB seller GSTIN
  - `ReportService.getGstHsnSummary()` returns real DB seller GSTIN
  - `GstRegistrationRepository.listAll()` queries PostgreSQL
  - `DeliveryInvoicingService` does not fabricate GSTIN
  - Static AST audit: Zero active services or repositories inject `"29AAAAA0000A1Z5"`

### 4. Reports, Catalog, Deliveries, Cart & CRM Suite
- **Command**: `node scratch/test_reports_and_catalog_truth.js`
- **Result**: **19 PASSED | 0 FAILED**
  - Legacy dashboard metrics from PostgreSQL
  - Legacy sales metrics from PostgreSQL
  - Delivery partner order pipeline queries PostgreSQL
  - Product reviews persisted and queried via `ReviewRepository`
  - Customer favorites persisted and queried via `FavoriteRepository`
  - Nonexistent cart queries return `null` without mock generation
  - CRM reminders persisted and queried via `CustomerRepository` JSONB metadata

### 5. Independent Financial & Invariant Forensic Audit
- **Command**: `node scratch/independent_c7_12_forensic_audit.js`
- **Result**: **ALL INVARIANTS PASS**
  - **Chart of Accounts**: 100 accounts (Expected: 100) — PASS
  - **Vouchers**: 6 vouchers (Expected: 6) — PASS
  - **Journal Entries**: 4 entries (Expected: 4) — PASS
  - **Journal Lines**: 10 lines (Expected: 10) — PASS
  - **Trial Balance**: Dr ₹3,380.00 = Cr ₹3,380.00 (Zero Imbalance) — PASS
  - **Active Delivery Partners**: 30 (Expected: 30) — PASS
  - **Active Branches**: 48 (Expected: 48) — PASS
  - **Active Customers**: 56 (Expected: 56) — PASS
  - **Corporate Delivery Assignments**: 0 (Expected: 0) — PASS
  - **Corporate Assignment Events**: 0 (Expected: 0) — PASS
  - **Immutability Triggers**: `trg_corporate_assignment_event_immutability` & `trg_delivery_coverage_event_immutability` ENABLED (`tgenabled = O`) — PASS
  - **Active Advisory Locks**: 0 (Expected: 0) — PASS

---

## 4. Next Phase Authorization Gate

- **Phase C7.14 Status**: 100% COMPLETE & VERIFIED.
- **Source-of-Truth Status**: 100% COMPLETE & VERIFIED.
- **Phase C7.15+ (Third-Party-Owned Branches & Partner Marketplace)**: UNAUTHORIZED / NOT STARTED. Execution is paused awaiting explicit user authorization.
