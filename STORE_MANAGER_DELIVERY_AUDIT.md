# CAKETOHOME — STORE MANAGER, PAYMENT GATE, KITCHEN PICKUP OTP & DELIVERY PARTNER WORKFLOW AUDIT

**Date**: 2026-08-19  
**Branch**: `feature/unify-store-manager-payment-pickup-delivery-flow`  
**Status**: `PHASE 0 AUDIT COMPLETE`

---

## 1. System Inventory & Component Trace

### A. Store / Hub Creation & Management
- **Frontend Component**: [`frontend/src/components/dashboard/admin/branches-panel.tsx`](file:///e:/vig/cakes2home-main/cakes2home-main/frontend/src/components/dashboard/admin/branches-panel.tsx)
- **Backend API Routes**:
  - `POST /api/v1/admin/branches`
  - `PUT /api/v1/admin/branches/[id]`
- **Engine Logic**: `ApiEngine.saveBranch(data)` in [`frontend/src/lib/api-engine.ts`](file:///e:/vig/cakes2home-main/cakes2home-main/frontend/src/lib/api-engine.ts#L10735)
- **Current Issue Identified**: `saveBranch` saves `manager_name` and `manager_account` as fields on the branch object, but does NOT create or link a canonical staff profile in `StaffAccessControl` / `memoryStore.staff_users`. Consequently, the manager does not appear in Admin Staff, has no assigned access profile (`prof_branch_ops`), and lacks canonical login resolution.

---

### B. Staff Identity & Branch Manager Role Architecture
- **Unified Staff System**: [`frontend/src/lib/staff-access-control.ts`](file:///e:/vig/cakes2home-main/cakes2home-main/frontend/src/lib/staff-access-control.ts)
- **Data Model**:
  ```
  USER IDENTITY (Phone/Email)
       ↓
  STAFF PROFILE (id: staff_xxx, role: "BRANCH_MANAGER")
       ↓
  ACCESS PROFILES (e.g., ["prof_branch_ops"])
       ↓
  BRANCH/STORE ASSIGNMENT (branch_id: "res_01KXYMAHGFPRY1G9TZKEVGAGAT")
  ```
- **Current Issue Identified**: Branch creation and staff profile creation operate as disconnected silos. Creating a store does not atomically provision or attach a staff profile.

---

### C. Order Creation & Payment Confirmation Gate
- **Order Placement**: `ApiEngine.confirmCheckout()` in [`frontend/src/lib/api-engine.ts`](file:///e:/vig/cakes2home-main/cakes2home-main/frontend/src/lib/api-engine.ts#L16565)
- **Payment Methods**:
  - Cash on Delivery (`cod`) -> `payment_status: "pending"` (or confirmed for COD fulfillment)
  - Razorpay (`razorpay`) -> `payment_status: "captured"` upon signature verification
- **Current Issue Identified**:
  - `ApiEngine.getBranchOrders` and `ApiEngine.getBranchManagerDashboard` filter orders only by `branch_id`, without enforcing the payment confirmation gate. Unpaid or payment-failed online orders were visible in the shop manager's active order queue and KPI counters.

---

### D. Kitchen Pickup OTP vs Customer Delivery OTP Lifecycle
- **Two Distinct OTP Systems**:
  1. **Kitchen Pickup OTP (`order.pickup_otp`)**:
     - 4-digit code generated server-side during order placement.
     - Must be accessible to Branch Manager when order is `READY_FOR_PICKUP`.
     - Required by Delivery Partner at store dispatch before leaving for delivery.
  2. **Customer Delivery OTP (`order.delivery_otp`)**:
     - 4-digit code generated server-side.
     - Shared only with customer.
     - Required by Delivery Partner at final doorstep handoff to transition from `in_transit` to `delivered`.
- **Current Issues Identified**:
  - Shop Manager UI ([`order-details-drawer.tsx`](file:///e:/vig/cakes2home-main/cakes2home-main/frontend/src/components/dashboard/shop/order-details-drawer.tsx)) does not display the Kitchen Pickup OTP to the manager when the cake is ready for pickup.
  - Delivery button UI surfaces raw browser `alert()` popups upon state transition exceptions instead of graceful inline UI messages.

---

### E. Delivery Partner Store Isolation & State Machine
- **Driver Jobs API**: `GET /api/v1/delivery-partner/jobs` in [`frontend/src/app/api/v1/[...path]/route.ts`](file:///e:/vig/cakes2home-main/cakes2home-main/frontend/src/app/api/v1/[...path]/route.ts#L701)
- **Engine Logic**: `ApiEngine.getDeliveryPartnerJobsBackend(partnerId)` and `ApiEngine.claimDeliveryJob()` in [`frontend/src/lib/api-engine.ts`](file:///e:/vig/cakes2home-main/cakes2home-main/frontend/src/lib/api-engine.ts#L6050)
- **State Machine Flow**:
  ```
  SHOP_ACCEPTED (Available to assigned fleet)
       ↓
  PICKUP_CLAIMED (Claimed by Driver)
       ↓
  READY_FOR_PICKUP (Kitchen finished bake & staging)
       ↓ [Verify Kitchen Pickup OTP]
  IN_TRANSIT / OUT_FOR_DELIVERY
       ↓ [Verify Customer Delivery OTP]
  DELIVERED
  ```
- **Current Issues Identified**:
  - If a driver clicks "Claim" twice on a job they already claimed, `validateDeliveryStateTransition` throws `"Illegal delivery state transition: Cannot change status from pickup_claimed directly to pickup_claimed"`.
  - The claim operation must be **idempotent**: returning a clean 200 OK with `already_claimed: true` and current state.

---

## 2. Table & Store Relationships Map

| Entity | Primary Identifier | Scope / Isolation Key | State Field |
| :--- | :--- | :--- | :--- |
| **Branch / Store** | `id`, `code` | Global / Region | `is_open`, `operational_status`, `is_paused` |
| **Staff Member** | `id` (`staff_xxx`), `user_id` | `branch_id` | `status` (`ACTIVE`/`SUSPENDED`) |
| **Delivery Partner** | `id` (`dlp_xxx`), `partner_number` | `primary_branch_id`, `associated_branches` | `availability_status` (`ONLINE`/`OFFLINE`) |
| **Order** | `id` (`ord_xxx`), `order_number` | `branch_id` | `status`, `delivery_status`, `payment_status` |
| **Kitchen Pickup OTP** | `order.pickup_otp` | `order.branch_id` | `order.pickup_verified_at` |
| **Customer Delivery OTP**| `order.delivery_otp` | `order.customer_uid` | `order.delivery_otp_verified_at` |

---

## 3. Required Action Items Summary

1. **Transactional Store & Manager Creation**:
   - Update `ApiEngine.saveBranch` to resolve or create a canonical staff record with `role: "BRANCH_MANAGER"`, `profile_ids: ["prof_branch_ops"]`, and explicit branch assignment.
   - Reject conflicting roles (e.g. attempting to assign an active DELIVERY_PARTNER or CUSTOMER without transition).
2. **Server-Side Payment Gate**:
   - Filter `getBranchOrders` and `getBranchManagerDashboard` KPIs to only include `PAYMENT_CONFIRMED` orders (or valid COD orders).
3. **Manager Panel Pickup OTP Display**:
   - Expose `pickup_otp` in `getBranchOrders` and `OrderDetailsDrawer` when status is `ready_for_pickup` or `shop_preparing`.
4. **Idempotent Claim & Safe State Machine**:
   - Support repeat claim by same rider idempotently.
   - Eliminate all raw `alert()` popups in delivery and shop manager UIs.
5. **Strict Delivery Partner Branch Isolation**:
   - Enforce server-side branch scope for all job queries and claim actions.
