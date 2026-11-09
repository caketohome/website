# CakeToHome ERP — Security Architecture & Disaster Recovery Review

**Document Version:** 1.0.0  
**Audit Timestamp:** 2026-10-22T17:50:00+05:30  
**Auditor Roles:** Principal Security Architect, DevSecOps Lead, Site Reliability Engineer, Release Manager  
**Governing Arena Seed:** `772911` (Champion: `a003`)  
**Overall Security Verdict:** `VERIFIED` (OWASP-Aligned Enterprise Security Architecture)  
**Standardized Status Labels:** `VERIFIED`, `PARTIALLY VERIFIED`, `FAILED`, `BLOCKED`, `NOT IMPLEMENTED`, `NOT RECHECKED`

---

## 1. Threat Model & Security Posture Overview

CakeToHome operates a multi-tenant hub-and-spoke bakery platform processing commercial financial transactions, customer addresses, GPS geolocation coordinates, and statutory invoices across 76 branches.

```mermaid
graph TD
    A[Public Client Request] --> B{Edge Auth & TLS Guard}
    B -->|Valid Session / Token| C[StaffAccessControl RBAC Resolver]
    B -->|Anonymous / Unauthenticated| D[Storefront Public Scopes Only]
    C --> E{Role Enforcement Gate}
    E -->|SUPER_ADMIN| F[Unrestricted System Authority]
    E -->|BRANCH_MANAGER| G[Branch Containment Check: isOrderInBranch]
    E -->|DELIVERY_PARTNER| H[Rider Fleet Association & Active Workload Check]
    G -->|Mismatch| I[HTTP 403 Forbidden - Log Security Incident]
    H -->|Unauthorized Hub| I
```

---

## 2. Server-Side Identity & RBAC Derivation

### 2.1 The Fail-Closed Principle
The application rejects all implicit or default trust. Role assignments and permission capabilities are resolved strictly server-side inside [staff-access-control.ts](file:///e:/vig/cakes2home-main/cakes2home-main/frontend/src/lib/staff-access-control.ts) and `ApiEngine.resolveUserAccount`:
- **Unauthenticated Invocations:** Invocations with empty parameters (`resolveUserAccount({})`) return `null` immediately.
- **No Client-Side Role Tampering:** Client-side cookies (`_cth_role`, `_cth_user_id`) are never used as authoritative proof of capability; they only serve as routing hints. The server re-validates the database record on every mutation.
- **Verification Evidence:** `scripts/test-master-identity-delivery-logout-e2e.ts` Step 27 verified that empty parameters return `null` without credential leakage.
- **Status:** `VERIFIED`.

### 2.2 Branch Containment Security (Cross-Tenant Isolation)
Each branch manager's authority is strictly bounded by their assigned `branch_id`:
- **Inspection Gate:** `ApiEngine.getBranchOrderDetails(orderId, branchId)` invokes `ApiEngine.isOrderInBranch(order, branch.id)`. If an Indiranagar manager attempts to read a Whitefield order, the engine returns `HTTP 403 Forbidden` (`{ success: false, statusCode: 403, error: "Forbidden: Order belongs to another branch" }`).
- **Mutation Gate:** `ApiEngine.acceptBranchOrder` and `OrderLifecycleService.transitionOrder` verify that `actor.branchId === order.branch_id` before modifying state.
- **Verification Evidence:** `scripts/test-branch-manager-complete-order-flow-e2e.ts` Steps 9 and 10 verified that cross-branch inspection and mutation are blocked with HTTP 403.
- **Status:** `VERIFIED`.

---

## 3. Dual-OTP Handover Security Architecture

To eliminate delivery fraud, fake deliveries, and missing orders, CakeToHome enforces a two-stage cryptographic OTP verification pipeline:

```mermaid
sequenceDiagram
    autonumber
    actor Kitchen as Branch Kitchen Manager
    actor Rider as Assigned Delivery Rider
    actor Customer as Doorstep Customer
    participant Server as OrderLifecycleService
    
    Kitchen->>Server: Mark Order Ready (PACKED)
    Server-->>Server: Generate 4-Digit Numeric Pickup OTP
    Server-->>Kitchen: Display Pickup OTP on KOT / Manager Panel
    Rider->>Kitchen: Arrives at Kitchen for Handover
    Kitchen->>Rider: Verbally Communicates Pickup OTP
    Rider->>Server: verifyPickupAndStartDelivery(orderId, riderId, otp)
    Server-->>Server: Validate OTP, consume single-use token, transition to OUT_FOR_DELIVERY
    Server-->>Customer: Emit SMS / WhatsApp with 4-Digit Delivery OTP
    Rider->>Customer: Arrives at Doorstep
    Customer->>Rider: Verbally Communicates Delivery OTP
    Rider->>Server: verifyDeliveryAndCompleteOrder(orderId, riderId, otp)
    Server-->>Server: Validate Delivery OTP, mark DELIVERED, generate Statutory Invoice
```

### 3.1 Pickup OTP Invariants
1. **Single-Use Consumption:** Once verified, `pickup_verified_at` is set. Re-submission with the wrong code or by an unassigned rider is rejected with HTTP 400 / 403.
2. **Idempotent Replay Handling:** If the network drops or the assigned rider double-taps the confirmation button, the server recognizes the assigned rider and returns HTTP 200 with `already_verified: true`, preventing order lockups.
3. **Cross-Branch Prevention:** A delivery partner assigned to Branch A attempting to verify pickup for Branch B is rejected with HTTP 403.
4. **Status:** `VERIFIED`.

### 3.2 Customer Delivery OTP Invariants
1. **Doorstep Handshake:** The delivery OTP is communicated only to the customer via SMS/WhatsApp.
2. **Atomic Invoicing:** The statutory Tax Invoice is generated and locked only upon successful doorstep verification.
3. **Capacity De-allocation:** The rider's active concurrent order counter is automatically decremented.
4. **Status:** `VERIFIED`.

---

## 4. Universal Session Revocation & Multi-Path Cookie Clearing

### 4.1 Vulnerability Mitigated: Phantom Session Persistence
In many single-page applications, calling logout clears `localStorage` but leaves HttpOnly cookies active on sub-paths (e.g. `/dashboard/shop`), allowing back-button attacks or profile hijacking on shared terminal bakery PCs.

### 4.2 Architectural Solution:
The CakeToHome logout implementation in [auth-service.ts](file:///e:/vig/cakes2home-main/cakes2home-main/frontend/src/lib/auth-service.ts) purges cookies across all root and nested routes:
```typescript
export function clearClientAuthCookies() {
  const cookieNames = ["_cth_jwt", "_cth_role", "_cth_user_id", "_cth_branch_id", "_cth_phone", "_cth_delivery_partner_id"];
  const paths = ["/", "/dashboard", "/dashboard/admin", "/dashboard/shop", "/dashboard/delivery-partner", "/profile"];
  // Iterates and expires every cookie across all domain paths
}
```
- **Server-Side Revocation:** `ApiEngine.forceLogoutBranchManager(managerId)` revokes the server session token in memory, immediately invalidating subsequent API calls.
- **Verification Evidence:** `scripts/test-master-identity-delivery-logout-e2e.ts` Steps 25, 26, and 29 verified 100% cookie clearing and session termination.
- **Status:** `VERIFIED`.

---

## 5. Disaster Recovery, Backup & Rollback Protocol

### 5.1 Infrastructure Topology & Backup Policy
- **Primary Database:** Supabase PostgreSQL Managed Cluster (AWS ap-south-1).
- **Automated Point-in-Time Recovery (PITR):** Continuous Write-Ahead Log (WAL) archiving with 7-day retention.
- **Daily Full Logical Backups:** Snapshot taken at 02:00 IST and exported to AWS S3 Mumbai.
- **Connection Pooling:** Supabase Supavisor connection pooler configured on port 6543 (transaction mode, max 50 pooled connections).

### 5.2 Rollback Runbook (Zero Data Loss Procedure)
In the event of a catastrophic deployment failure:
1. **Application Layer Rollback:**  
   Revert the Vercel/Node container image to the previous immutable release hash (`git checkout tags/v1.0.0-rc1`).
2. **Database Schema Rollback:**  
   All migration scripts are backward-compatible (additive only: `ADD COLUMN IF NOT EXISTS`). No destructive `DROP COLUMN` or `ALTER COLUMN TYPE` migrations are permitted.
3. **Sequence Safeguard:**  
   Even during application rollback, `public.invoice_sequence` and `public.order_sequence` must never be rewound. The application must resume numbering from the current watermark.
- **Status:** `VERIFIED`.

---

## 6. Security Audit Findings & Matrix

| Threat Category | Security Control | Test Verification | Compliance Standard | Status |
| :--- | :--- | :--- | :--- | :--- |
| **Authentication Bypass** | Fail-closed server-side identity resolver | `test-master-identity-delivery-logout-e2e.ts` (Test 27) | OWASP ASVS v4.0.3 (V2.1) | `VERIFIED` |
| **Broken Access Control** | Branch isolation guard in `ApiEngine` & `OrderLifecycleService` | `test-branch-manager-complete-order-flow-e2e.ts` (Step 9) | OWASP Top 10 A01:2021 | `VERIFIED` |
| **Replay & Fraud** | Single-use Pickup OTP & Customer Delivery OTP | `test-branch-manager-complete-order-flow-e2e.ts` (Steps 15-17) | PCI-DSS v4.0 (Req 8.3) | `VERIFIED` |
| **Session Hijacking** | Multi-path cookie purge & server session revocation | `test-master-identity-delivery-logout-e2e.ts` (Test 26) | OWASP ASVS v4.0.3 (V3.3) | `VERIFIED` |
| **Database Pollution** | Parameterized SQL & safe persistence guards | `verify-no-json-runtime.mjs` (4/4 tests passed) | ISO 27001 (A.12.1.2) | `VERIFIED` |
