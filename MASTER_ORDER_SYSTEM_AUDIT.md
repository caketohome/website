# CakeToHome Master Order System, Identity, Auth, Branch Manager, Delivery Partner & OTP System Audit

## Phase 0: Freeze & Baseline State Record

- **Timestamp**: 2026-08-21T13:56:00+05:30
- **Branch**: `feature/fix-branch-creation-404`
- **Active Phase**: Phase 9 — Comprehensive Codebase & Database Architecture Hardening, Cleanup, Security & Production Polish
- **Recent Git Log (Top 10)**:
  - `1a40ea2` fix(deliveries): ensure dynamic ApiEngine import for client bundle compatibility
  - `a282544` fix(delivery): repair kitchen pickup OTP to out for delivery workflow with idempotent verification and state machine hardening
  - `62d5279` chore(cleanup): finalize comprehensive repository-wide purge across tests, docs, and backend models
  - `17db42c` feat(customer-platform): complete production cleanup, global eggless purge, auth state fix, and profile management rebuild
  - `95a0324` feat(auth): rebuild luxury customer login experience, 6-digit OTP boxes, and responsive 55/45 layout
  - `c5c5e8d` fix(branches): resolve fulfillment hub creation contract, routing, and manager synchronization
  - `874ad74` feat(webhooks): rebuild n8n webhook admin into enterprise single event gateway architecture
  - `cb3a8c8` fix(crm): use toLocaleString for timestamps with time formatting options in customer profile drawer
  - `c922aa3` fix(store): encapsulate floating dynamic widgets in client component to resolve RSC clientModules error
  - `120aa26` fix(frontend): resolve RSC dynamic export manifests, eliminate duplicate favicon route conflict, and clean dev runtime

---

## 1. Current Architecture Overview

CakeToHome operates a Next.js App Router full-stack architecture with:
1. **Frontend App Router**:
   - Customer Storefront & Account (`/`, `/account`, `/account/orders`, `/checkout`, `/login`)
   - Super Admin Command Center (`/dashboard`, `/dashboard/admin/*`)
   - Branch Manager (Shop/Kitchen) Operations Portal (`/dashboard/shop`, `/dashboard/shop/orders`, `/dashboard/shop/menu`)
   - Delivery Partner Portal (`/dashboard/delivery-partner`)
2. **Backend Services & Persistence**:
   - `ApiEngine` (`frontend/src/lib/api-engine.ts`): Primary authoritative disk-backed data engine with JSON persistence in `frontend/data/db-store.json`.
   - `WebhookEngine` (`frontend/src/lib/webhook-engine.ts`): Transactional Outbox with HMAC-SHA256 signature signing and event dispatch to n8n.
   - `StaffAccessControl` (`frontend/src/lib/staff-access-control.ts`): RBAC engine for Staff, Roles, and Access Profiles.
   - Medusa / NestJS core integration layer for backward-compatible proxying when services are active.

---

## 2. Order State Machine: Current vs Canonical

### Current Divergent State Machine
Multiple representations exist across layers:
- `db-store.json` orders: `status` values include `'confirmed'`, `'delivered'`, `'out_for_delivery'`, `'preparing'`, `'DELIVERED'`, `'CONFIRMED'`, `'packed'`, `'cancelled'`, `'payment_pending'`.
- `db-store.json` delivery statuses: `'shop_accepted'`, `'delivered'`, `'preparing'`, `'in_transit'`, `'pickup_claimed'`, `undefined`, `'ready_for_pickup'`, `'cancelled'`, `'pending'`.
- Status mutations occur in fragmented methods:
  - `ApiEngine.updateOrderStatus` (bypasses delivery state)
  - `ApiEngine.acceptBranchOrder`
  - `ApiEngine.rejectBranchOrder`
  - `ApiEngine.markBranchOrderReady`
  - `ApiEngine.claimDeliveryJob`
  - `ApiEngine.verifyPickupOtpBackend`
  - `ApiEngine.verifyCustomerOtpBackend`
  - `apiClient.updateOrderStatus` / `apiClient.updateAdminDeliveryStatus`

### The Canonical Order Lifecycle
```
[CREATED]
    ↓ (Payment confirmation gate)
[PAYMENT_CONFIRMED / CONFIRMED]
    ↓ (Branch Kitchen accepts)
[KITCHEN_ACCEPTED]
    ↓ (Baking / prep begins)
[PREPARING]
    ↓ (Baking done, cake boxed & tagged with Pickup OTP)
[READY_FOR_PICKUP / PACKED]
    ↓ (Delivery partner enters verified Pickup OTP)
[PICKUP_CONFIRMED → OUT_FOR_DELIVERY / IN_TRANSIT]
    ↓ (Delivery partner enters verified Customer Delivery OTP at doorstep)
[DELIVERED]
```
Terminal exception paths: `CANCELLED`, `REFUNDED`, `FAILED`.

---

## 3. Authentication & Session Architecture

- **Auth Tokens & Cookies**: `_cth_jwt`, `_cth_role`, `_cth_user_id`, `_cth_customer_uid`, `_cth_phone`, `_cth_branch_id`, `_cth_partner_id`.
- **Identity Resolution (`/api/auth/me` & `ApiEngine.resolveUserAccount`)**:
  - `SUPER_ADMIN`: Canonical identity `admin_01`, permissions `["ALL"]`.
  - `BRANCH_MANAGER`: Canonical identity mapped to store branch `manager_user_id` / `manager_account` and `branch_id`.
  - `DELIVERY_PARTNER`: Canonical identity linked to `delivery_partners` collection with `partner_number`, `primary_branch_id`, and `associated_branches`.
  - `CUSTOMER`: Canonical identity linked to `customers` collection with `customer_uid` (e.g. `cth_cus_9876543210`).

---

## 4. Staff, Branch & Delivery Partner Architecture

- **Branch Hubs**: Store records containing `id`, `code`, `name`, `address`, `manager_name`, `phone`, `email`, `manager_user_id`, `manager_account`.
- **Branch Manager Isolation**:
  - Manager endpoints under `/api/v1/manager/*` validate session role and branch ID.
  - Fail-Closed: Cross-branch order queries and mutations are rejected with HTTP 403 Forbidden.
- **Delivery Partner Fleet Isolation**:
  - Delivery partner records maintain `primary_branch_id` and `associated_branches`.
  - Delivery jobs queue checks `ApiEngine.canPartnerAccessOrder` (Order branch MUST belong to partner's authorized branch list).
  - Fail-Closed: Cross-branch claims or OTP verifications return HTTP 403 Forbidden.

---

## 5. OTP Architecture: Pickup OTP vs Delivery OTP

1. **Kitchen Pickup OTP (Handover from Branch Kitchen to Rider)**:
   - Generated when order is marked `PACKED` / `READY_FOR_PICKUP` (4-digit numeric string).
   - Stored in `order.pickup_otp` and `order.delivery.pickup_otp`.
   - Visible to Super Admin and Branch Manager.
   - Entered by Delivery Partner upon physical cake pickup.
   - Verification atomically transitions order to `OUT_FOR_DELIVERY` and delivery job to `IN_TRANSIT`.
   - Single-use: Consumed upon verification (`order.pickup_verified_at`).
   - Idempotent: Subsequent verification by the assigned driver returns HTTP 200 OK cleanly without mutating states or emitting duplicate outbox events.
2. **Customer Delivery OTP (Handover from Rider to Customer at Doorstep)**:
   - Generated upon order placement / dispatch (4-digit numeric string).
   - Stored in `order.delivery_otp` and `order.delivery.delivery_otp`.
   - Visible to Customer and Super Admin (and Branch Manager where necessary for support).
   - Entered by Delivery Partner upon doorstep handover.
   - Verification atomically transitions order to `DELIVERED` and rider job to `COMPLETED`.
   - De-allocates rider concurrent capacity (`partner.current_active_orders = Math.max(0, active - 1)`).

---

## 6. Event & Outbox Architecture

- All state transitions emit canonical domain events to `WebhookEngine`:
  - `order.created`
  - `order.paid`
  - `order.confirmed`
  - `order.kitchen_accepted`
  - `order.preparing`
  - `order.ready_for_pickup`
  - `order.claimed`
  - `order.picked_up` / `delivery.pickup_confirmed`
  - `delivery.out_for_delivery`
  - `order.delivered`
  - `order.cancelled`
- Each event is recorded in the transactional outbox (`WebhookEngine.getOutbox()`) with HMAC-SHA256 signature, sanitizing sensitive credentials (excluding raw OTPs from external telemetry where appropriate).

---

## 7. Logout & Cache Revocation Architecture

- **Unified Logout Mechanism (`authLogout`)**:
  1. Local React state reset (`setCurrentUser(null)` in `AuthProvider`).
  2. Multi-path cookie expiration across `/`, `/dashboard`, `/account`, `/dashboard/shop`, `/dashboard/delivery-partner`, `/dashboard/admin`, `/admin`, `/branch-manager`, `/delivery-partner`.
  3. Client storage clear (`localStorage.clear()`, `sessionStorage.clear()`).
  4. Server-side session revocation (`POST /api/auth/logout`).
  5. Multi-tab broadcast via `BroadcastChannel("cth_auth_channel")` and `localStorage.setItem("cth_auth_logout_event", ...)`.
  6. Global fetch 401 interceptor auto-purging client credentials upon unauthorized responses.
  7. Strict role-based redirect to dedicated portal login (`/dashboard/admin/login`, `/dashboard/shop/login`, `/dashboard/delivery-partner/login`, `/login`).

---

## 8. Known Issues & Audit Findings

1. **Test 17 Outbox Event Assertion**:
   - In `scripts/test-master-identity-delivery-logout-e2e.ts`, `WebhookEngine.getOutbox()` or `WebhookEngine.getEvents()` needs explicit synchronization when `ApiEngine.fireWebhookEvent` dispatches events, ensuring every transition records an outbox entry.
2. **Order State Normalization**:
   - Legacy records in `frontend/data/db-store.json` have inconsistent casing (`DELIVERED` vs `delivered`, `CONFIRMED` vs `confirmed`).
   - Need one authoritative enum/mapping so that queries and comparisons are case-insensitive and canonical.
3. **Consolidated `OrderLifecycleService`**:
   - Provide a formal, dedicated `OrderLifecycleService` module (or clean interface in `ApiEngine`) exposing `canTransition`, `transition`, `assertTransitionAllowed`, `getCurrentState`, `recordTransition`, and `emitOrderEvent`.
4. **Master Order Lifecycle E2E Suite (`scripts/test-master-order-lifecycle-e2e.ts`)**:
   - Comprehensive test suite to be created covering the entire 38-phase test matrix with 100% pass rate.
