# CakeToHome — Branch Manager Operational Authority & Cross-Profile Synchronization Audit
**Document ID**: `BRANCH_MANAGER_OPERATIONAL_AUDIT.md`  
**Phase**: Phase 1 — Comprehensive Operational & Architectural Audit  
**Status**: `AUDIT COMPLETE (Zero Source Modifications During Audit)`  
**Timestamp**: 2026-08-22

---

## 1. Current Branch Manager Role & RBAC Architecture

### 1.1 Role Definitions
- **Canonical Role Key**: `BRANCH_MANAGER` (aliases: `SHOP_MANAGER`, `SHPMGR`, `SHOP`, `MGR`).
- **Target Role Interface**: `ShopManagerDTO` / `StaffUserRecord` in `frontend/src/lib/types.ts` and `frontend/src/lib/staff-access-control.ts`.
- **Assigned Identity Path**:
  ```
  staff_user (e.g. shpmgr_indiranagar, shpmgr_whitefield, shpmgr_01)
     ↓
  staff_role ("BRANCH_MANAGER")
     ↓
  manager_profile (name, phone, permissions)
     ↓
  branch_id (e.g. br_indiranagar, br_whitefield, br_koramangala, br_hsr)
     ↓
  fulfillment_hub / store record
  ```
- **Permission Matrix**:
  - `orders:view`: Can view eligible orders assigned strictly to the manager's branch.
  - `orders:accept`: Can accept confirmed kitchen orders.
  - `orders:prepare`: Can trigger preparation / baking.
  - `orders:pack_ready`: Can mark order packed and ready for pickup (generates/reveals single-use Pickup OTP).
  - `orders:delay`: Can log delay notes and broadcast updated ETA.
  - `orders:hold`: Can put orders on operational hold with documented reason.
  - `orders:reject`: Can reject/decline order with structured reason (cancels and triggers refund workflow).
  - `orders:assign_rider`: Can manually assign or reassign branch-authorized delivery partners.
  - `kot:print`: Can generate and reprint Kitchen Order Tickets (KOT).
  - `invoice:print`: Can generate GST-compliant customer invoices.
  - `inventory:update`: Can toggle stock and product availability for branch.
  - `branch:pause`: Can pause branch online intake (15m, 30m, 60m, custom).

---

## 2. Current Branch Mapping Architecture

### 2.1 Canonical Branch Master
Stored disk-backed in `frontend/data/db-store.json` (`branches` table) and resolved via `ApiEngine.resolveBranchRecord(branchId)`:
1. **Indiranagar Flagship**:
   - `id`: `br_indiranagar` (canonical), legacy alias: `res_01KXYMAHGFPRY1G9TZKEVGAGAT`.
   - `code`: `HUB-BLR-01`
   - `manager_id`: `shpmgr_indiranagar` / `shpmgr_01`
   - `manager_name`: `Rajesh Kumar`
2. **Whitefield Tech Hub**:
   - `id`: `br_whitefield`
   - `code`: `HUB-BLR-02`
   - `manager_id`: `shpmgr_whitefield`
   - `manager_name`: `Suresh Nair`
3. **Koramangala Gourmet Kitchen**:
   - `id`: `br_koramangala` (canonical), legacy alias: `res_02KXYMAHGFPRY1G9TZKEVGAGAT`.
   - `code`: `HUB-BLR-03`
   - `manager_id`: `shpmgr_koramangala`
   - `manager_name`: `Anil Verma`
4. **HSR Layout Express**:
   - `id`: `br_hsr`
   - `code`: `HUB-BLR-04`
   - `manager_id`: `shpmgr_hsr`
   - `manager_name`: `Kavitha Menon`

### 2.2 Server-Side Resolution Flaw Identified
- In `frontend/src/app/api/v1/[...path]/route.ts` (`resolveManagerSession`):
  Line 132 fell back to `sessionUserId?.startsWith("shpmgr_") ? "res_01KXYMAHGFPRY1G9TZKEVGAGAT" : "res_01KXYMAHGFPRY1G9TZKEVGAGAT"`.
  This meant any manager without an explicit cookie was mapped to Indiranagar, breaking strict multi-branch isolation for Whitefield, Koramangala, and HSR.

---

## 3. Current Order API Endpoints & Routes

| Surface | Endpoint | Method | Handler | Purpose |
| :--- | :--- | :--- | :--- | :--- |
| **Branch Manager** | `/api/v1/manager/dashboard` | `GET` | `ApiEngine.getBranchManagerDashboard` | Summary KPIs, branch status, recent orders |
| **Branch Manager** | `/api/v1/manager/orders` | `GET` | `ApiEngine.getBranchOrders` | Filtered orders list for authenticated branch |
| **Branch Manager** | `/api/v1/manager/orders/:id` | `GET` | `ApiEngine.getBranchOrderDetails` | Full order detail, customization, items, OTP |
| **Branch Manager** | `/api/v1/manager/orders/:id/accept` | `POST` | `ApiEngine.acceptBranchOrder` | Accept confirmed order for baking |
| **Branch Manager** | `/api/v1/manager/orders/:id/ready` | `POST` | `ApiEngine.markBranchOrderReady` | Mark order packed & ready for pickup |
| **Branch Manager** | `/api/v1/manager/orders/:id/delay` | `POST` | `ApiEngine.delayBranchOrder` | Delay order with reason & updated ETA |
| **Branch Manager** | `/api/v1/manager/orders/:id/hold` | `POST` | `ApiEngine.holdBranchOrder` | Put order on operational hold |
| **Branch Manager** | `/api/v1/manager/orders/:id/reject` | `POST` | `ApiEngine.rejectBranchOrder` | Reject/decline order |
| **Branch Manager** | `/api/v1/manager/orders/:id/assign-rider` | `POST` | `ApiEngine.assignBranchOrderRider` | Assign branch-scoped rider |
| **Branch Manager** | `/api/v1/manager/orders/:id/kot` | `GET` | `ApiEngine.getBranchOrderKot` | Generate KOT data |
| **Branch Manager** | `/api/v1/manager/orders/:id/invoice` | `GET` | `ApiEngine.getBranchOrderInvoice` | Generate GST invoice |
| **Admin** | `/api/v1/admin/orders` | `GET` | `ApiEngine.getAdminOrders` | Enterprise Order Command Center query engine |
| **Admin** | `/api/v1/admin/orders/:id` | `GET` | `ApiEngine.getOrderDetails` | Authoritative admin order view |
| **Delivery Partner**| `/api/v1/delivery-partner/jobs` | `GET` | `ApiEngine.getDeliveryPartnerJobsBackend` | Rider active/available jobs |
| **Delivery Partner**| `/api/v1/delivery-partner/jobs/:id/pickup-otp/verify` | `POST` | `OrderLifecycleService.verifyPickupAndStartDelivery` | Rider pickup verification |
| **Delivery Partner**| `/api/v1/delivery-partner/jobs/:id/delivery-otp/verify` | `POST` | `OrderLifecycleService.verifyDeliveryAndCompleteOrder` | Rider customer delivery verification |
| **Customer** | `/api/v1/customer/orders` | `GET` | `ApiEngine.getCustomerOrders` | Customer account order history |
| **Customer** | `/api/v1/orders/:id` | `GET` | `ApiEngine.getOrderDetails` | Real-time live tracking view |

---

## 4. Current OTP Architecture & Audit

### 4.1 Concept Distinction
1. **Pickup OTP (Kitchen $\rightarrow$ Rider Handover)**:
   - **Secret Holder**: Branch Manager / Kitchen Dispatch Staff.
   - **Verifier**: Delivery Partner (enters code into mobile portal upon physical handover).
   - **Verification Service**: `OrderLifecycleService.verifyPickupAndStartDelivery` / `POST /api/v1/delivery-partner/jobs/:id/pickup-otp/verify`.
   - **State Transition**: `READY_FOR_PICKUP` $\rightarrow$ `OUT_FOR_DELIVERY` (Order), `ready_for_pickup` $\rightarrow$ `in_transit` (Rider).
   - **Lifecycle Fields**: `order.pickup_otp`, `order.pickup_otp_generated_at`, `order.pickup_otp_expires_at`, `order.pickup_verified_at`, `order.pickup_verified_by`.
2. **Delivery OTP (Rider $\rightarrow$ Customer Handover)**:
   - **Secret Holder**: Customer (sent via SMS / WhatsApp / visible in customer tracking UI).
   - **Verifier**: Delivery Partner (enters code upon doorstep handover).
   - **Verification Service**: `OrderLifecycleService.verifyDeliveryAndCompleteOrder` / `POST /api/v1/delivery-partner/jobs/:id/delivery-otp/verify`.
   - **State Transition**: `OUT_FOR_DELIVERY` $\rightarrow$ `DELIVERED` (Order), `in_transit` $\rightarrow$ `delivered` (Rider).
   - **Lifecycle Fields**: `order.delivery_otp`, `order.delivery_otp_generated_at`, `order.delivery_otp_expires_at`, `order.delivery_verified_at`.

### 4.2 Flaws Identified in Current OTP Code
1. **Static Mock Fallbacks in Manager APIs**:
   - In `ApiEngine.getBranchOrders` and `ApiEngine.getBranchOrderDetails`:
     `pickup_otp: o.pickup_otp || o.delivery?.pickup_otp || "1294"`
     `delivery_otp: o.delivery_otp || "4819"`
   - If `o.pickup_otp` was undefined before preparation, the API returned hardcoded mock `"1294"`.
2. **Delivery OTP Leakage to Branch Manager**:
   - `delivery_otp` was exposed in `getBranchOrderDetails` and `recent_orders` even though the manager should only see the **Pickup OTP** and the **Delivery Verification Status** (Active/Pending/Verified).

---

## 5. Current Order State Machine Analysis

### 5.1 Authoritative Engine: `OrderLifecycleService`
Defined in `frontend/src/lib/order-lifecycle-service.ts`:
```
PAYMENT_CONFIRMED (or CONFIRMED)
  ↓
KITCHEN_ACCEPTED
  ↓
PREPARING
  ↓
READY_FOR_PICKUP (Generates single-use 4-digit pickup_otp)
  ↓ (Rider enters pickup_otp via atomic verification transaction)
OUT_FOR_DELIVERY (Rider status: in_transit)
  ↓ (Rider enters customer delivery_otp)
DELIVERED (Rider status: completed)
```

### 5.2 State Machine Bypass Flaws Identified
- `ApiEngine.acceptBranchOrder`, `ApiEngine.markBranchOrderReady`, `ApiEngine.rejectBranchOrder`, `ApiEngine.holdBranchOrder`, and `ApiEngine.delayBranchOrder` directly mutated `order.status = ...` without delegating to `OrderLifecycleService.transitionOrder`!
- Direct mutation skipped:
  1. Actor role validation & branch check.
  2. Transactional outbox event creation (`order.kitchen_accepted`, `order.ready_for_pickup`).
  3. Structured timeline synchronization.

---

## 6. Financial & Order Data Inconsistency Audit

### 6.1 The Discrepancy Found in Testing
- **Reported Bug**: Item Subtotal shows ₹899, CGST ₹17.48, SGST ₹17.48, but Total shows ₹599.
### 6.2 Root Cause Analysis
1. In `frontend/src/lib/api-engine.ts` (`getBranchOrderDetails`):
   ```ts
   const items = (order.items && order.items.length > 0) ? order.items : [
     {
       id: "item_1",
       title: "Signature Dutch Chocolate Truffle Cake",
       unit_price: 699,
       tax_amount: 34.95,
       total: 699,
     }
   ];
   ```
2. In `pricing` object construction:
   ```ts
   pricing: {
     subtotal: order.subtotal || order.total || 699,
     tax_total: order.tax_total || 34.95,
     cgst: Number(((order.tax_total || 34.95) / 2).toFixed(2)),
     sgst: Number(((order.tax_total || 34.95) / 2).toFixed(2)),
     delivery_fee: order.delivery_fee || 0,
     discount_total: order.discount_total || 0,
     total: order.total || 733.95,
   }
   ```
3. In `frontend/src/components/dashboard/shop/order-details-drawer.tsx`:
   - Line 212: Item row rendered `₹{item.total || item.unit_price || 599}`.
   - Line 223: Subtotal rendered `₹{order.pricing?.subtotal || order.total || 599}`.
   - Line 227: CGST rendered `₹{order.pricing?.cgst || "14.95"}`.
   - Line 235: Total rendered `₹{order.total || 599}`.
4. **Architectural Fix Required**:
   Establish a strict **Single Source of Financial Truth**:
   - `subtotal = items.reduce((sum, item) => sum + (item.quantity * item.unit_price), 0)`
   - `tax_total = roundTo2(subtotal * 0.05)` (or explicit tax breakdown)
   - `cgst = roundTo2(tax_total / 2)`
   - `sgst = roundTo2(tax_total / 2)`
   - `delivery_fee = order.delivery_fee || 0`
   - `discount_total = order.discount_total || 0`
   - `grand_total = subtotal + tax_total + delivery_fee - discount_total` (or canonical `order.total`)
   - All surfaces (Admin, Branch Manager, Delivery Partner, Customer, Invoice, KOT) MUST consume the exact same structured pricing fields.

---

## 7. Data Sources Comparison Across All 4 Profiles

| Aspect | Admin Order Command Center | Branch Manager Kitchen Hub | Delivery Partner Mobile Portal | Customer Order Tracking |
| :--- | :--- | :--- | :--- | :--- |
| **Data Layer** | `ApiEngine.getAdminOrders` / `getOrderDetails` | `ApiEngine.getBranchOrders` / `getBranchOrderDetails` | `ApiEngine.getDeliveryPartnerJobsBackend` | `ApiEngine.getCustomerOrders` / `getOrderDetails` |
| **Scope Filter** | All branches (with branch filter dropdown) | Strictly scoped to authenticated `branch_id` | Strictly scoped to assigned `partner_id` & authorized hubs | Strictly scoped to authenticated `customer_uid` / phone |
| **Payment Gate** | Displays all payment statuses with filter | Only `PAYMENT_CONFIRMED` / `captured` / COD | Only `PAYMENT_CONFIRMED` / operational jobs | Only customer's own orders |
| **Order Status** | Full canonical status (`CONFIRMED`, `PREPARING`, `READY_FOR_PICKUP`, `OUT_FOR_DELIVERY`, `DELIVERED`) | Same canonical status (`CONFIRMED`, `PREPARING`, `READY_FOR_PICKUP`, `OUT_FOR_DELIVERY`, `DELIVERED`) | Normalized rider job status (`ready_for_pickup`, `in_transit`, `delivered`) | Normalized customer status (`Confirmed`, `Preparing`, `Ready`, `Out for Delivery`, `Delivered`) |
| **OTP Visibility** | View-only audit log | Operational **Pickup OTP** only | OTP Entry inputs for Pickup & Delivery verification | Customer **Delivery OTP** only |
| **Customization & Message** | Full view | Full operational view (message, flavor, weight, instructions, photo) | Delivery address, customer phone, slot | Full customer confirmation |

---

## 8. Real-Time & Event Synchronization Mechanism

### 8.1 Active Mechanisms in Repo
1. **Transactional Outbox Event Dispatcher**:
   - Stored in `memoryStore.outbox` via `OrderLifecycleService` and `WebhookEngine`.
   - Events dispatched: `order.confirmed`, `order.kitchen_accepted`, `order.preparing`, `order.ready_for_pickup`, `order.out_for_delivery`, `order.delivered`, `order.delayed`.
2. **Client-Side Polling / Revalidation**:
   - Next.js React query / `loadDashboardData` polling (10s intervals or event triggers).
   - Real-time refresh triggers on modal actions (`onRefresh()`).
   - Cross-tab synchronization via `BroadcastChannel("cth_auth_channel")` and `window.localStorage` storage events.

---

## 9. Conclusion of Initial Audit

The audit confirms:
1. The repository already has the correct **canonical domain engine** (`OrderLifecycleService`, `ApiEngine`, `db-store.json`).
2. The core issues stem from:
   - Branch Manager API methods bypassing `OrderLifecycleService`.
   - Static mock OTP fallbacks (`"1294"`, `"4819"`) masking live OTP generation.
   - Financial pricing defaults detached from authoritative order line items.
   - Server-side manager session resolution defaulting to Indiranagar without staff record lookup.
3. Consolidating all Branch Manager mutations through `OrderLifecycleService` and eliminating mock fallbacks will immediately unify all four profiles (Admin, Branch Manager, Delivery Partner, Customer).
