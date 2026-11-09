# CAKETOHOME — AUTHENTICATION & RBAC TEST REPORT
## Verification of 8 Canonical Roles, 15 Granular Permissions & Guard Enforcement

### 1. 8 Canonical Roles
1. `CUSTOMER`: Consumer storefront purchasing and profile management.
2. `STORE_MANAGER`: Branch-level catalog, pricing, and operating controls.
3. `SUPER_ADMIN`: Full access across all corporate entities and branches.
4. `BRANCH_MANAGER`: Daily bakery hub operations and shift supervision.
5. `CHEF`: Kitchen queue, KOT fulfillment, recipe consumption.
6. `DISPATCHER`: Rider assignment and order handover.
7. `DELIVERY_PARTNER`: In-transit transit, customer OTP handover.
8. `AUDITOR`: Read-only compliance, invoice, and accounting voucher inspection.

### 2. Guard Enforcement Test Results
- `NEST-05`: Missing Authorization header correctly rejected (401 Unauthorized) — **PASS**
- `NEST-06`: Valid authorization attaches user context — **PASS**
- `NEST-07`: Customer attempting Manager endpoint denied (403 Forbidden) — **PASS**
- `NEST-08`: Super Admin bypass across RBAC boundaries permitted — **PASS**
