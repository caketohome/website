# CakeToHome — Gate 2 (M3) Cross-Store & Franchise Sharing Decommissioning Report

**Project:** CakeToHome — https://cakestohome.com/  
**Milestone:** M3 — Audit & Decommission Cross-Store / Franchise Product-Sharing Panel  
**Execution Date:** 2026-11-11  
**Architect & Lead Auditor:** Principal Software Architect, Senior Full-Stack Engineer, Database Architect  
**Status:** **FULLY DECOMMISSIONED & VERIFIED**

---

## 1. Executive Summary

In accordance with CakeToHome architectural governance and operational rules:
1. **Unapproved Architecture:** The cross-store / franchise shared inventory panel was an unapproved prototype feature that attempted to introduce cross-store stock pooling and sharing across physical branches.
2. **Physical Reality & ERP Truth:** In the physical bakery operation and PostgreSQL production schema (`cth_rehearsal_phase5`), each bakery branch operates as an independent inventory unit (`public.branch_inventory`, 156 rows across 6 stores). There is no central warehouse that physical stores pull stock from dynamically during customer checkout.
3. **No Unapproved IBTO/Franchise Accounting:** In strict compliance with instructions, no replacement inter-branch transfer order (IBTO) workflow, inter-branch stock movement engine, or franchise royalty settlement mechanism was built.
4. **Decommissioning Action:** The frontend navigation, admin tab, dynamic component loader, order reservation hooks, and API endpoints for shared inventory have been permanently decommissioned. All decommissioned API endpoints now respond with **HTTP 410 Gone (`SHARED_INVENTORY_DECOMMISSIONED`)**.

---

## 2. Forensic Investigation & Codebase Modifications

### 2.1 API Route Decommissioning (`frontend/src/app/api/v1/[...path]/route.ts`)
- **GET `inventory/shared` & `inventory/shared/*`:**
  - Replaced prototype stock pooling queries with an explicit HTTP 410 response:
    ```json
    {
      "error": "SHARED_INVENTORY_DECOMMISSIONED",
      "message": "Cross-store shared inventory has been decommissioned in favor of independent store inventory.",
      "success": false
    }
    ```
- **POST `inventory/shared/reserve`, `release`, `adjust`:**
  - Replaced prototype reservation and adjustment endpoints with the same HTTP 410 Gone response.
- **Order Placement Hook:**
  - Removed `SharedInventoryService.confirmOrderReservation(ord.id)` from the order placement lifecycle, ensuring orders do not attempt to reserve or lock non-existent shared inventory.

### 2.2 Dashboard Admin Interface (`frontend/src/app/dashboard/page.tsx`)
- Removed dynamic import `createDynamicPanel(() => import("@frontend/components/dashboard/admin/shared-inventory-panel").then(m => m.SharedInventoryPanel))`.
- Removed `shared_inventory` from the dashboard tab switch and type union `AdminTab`.

### 2.3 Navigation & Admin Tabs
- **`frontend/src/components/dashboard/admin/admin-tabs.tsx`:** Removed the `🎂 Shared Inventory` tab item.
- **`frontend/src/components/admin/AdminSidebar.tsx`:** Removed the `🎂 Shared Inventory` navigation link.

### 2.4 Service Hardening (`frontend/src/lib/services/shared-inventory.service.ts`)
- Replaced database queries with safe no-op stubs returning clear error codes (`SHARED_INVENTORY_DECOMMISSIONED`) or empty collections, ensuring zero runtime crashes in any dependent legacy callers.

---

## 3. Independent Verification & Test Evidence

### 3.1 Automated HTTP Verification (`scratch/verify_m3_decommission.cjs`)
Direct network probe against the live Next.js App Router server (`http://localhost:3000`):

| Endpoint | Method | Expected Status | Actual Status | Response Payload |
| :--- | :--- | :--- | :--- | :--- |
| `/api/v1/inventory/shared` | GET | 410 Gone | **HTTP 410** | `{"error":"SHARED_INVENTORY_DECOMMISSIONED", ...}` |
| `/api/v1/inventory/shared/cake_123` | GET | 410 Gone | **HTTP 410** | `{"error":"SHARED_INVENTORY_DECOMMISSIONED", ...}` |
| `/api/v1/inventory/shared/reserve` | POST | 410 Gone | **HTTP 410** | `{"error":"SHARED_INVENTORY_DECOMMISSIONED", ...}` |
| `/api/v1/inventory/shared/adjust` | POST | 410 Gone | **HTTP 410** | `{"error":"SHARED_INVENTORY_DECOMMISSIONED", ...}` |

### 3.2 UI Route Compilation & Health Verification
- **Storefront Home (`/`):** HTTP 200 (218,146 bytes) — Passed.
- **Admin Dashboard (`/dashboard`):** HTTP 307 (Auth redirect to login) — Passed.
- **Shopping Cart (`/cart`):** HTTP 200 (58,500 bytes) — Passed.
- **Checkout (`/checkout`):** HTTP 200 (42,472 bytes) — Passed.

---

## 4. Architectural Sign-Off

The decommissioning of cross-store and franchise inventory sharing is complete. The system now strictly relies upon:
1. **Master Product Catalogue (`public.product`):** Shared catalogue defining items, variants, base pricing, and descriptions.
2. **Independent Branch Inventory (`public.branch_inventory`):** Branch-specific stock quantities, safety thresholds, and reservations isolated to individual physical fulfillment stores.
