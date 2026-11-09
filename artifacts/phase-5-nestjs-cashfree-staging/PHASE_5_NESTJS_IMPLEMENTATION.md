# CAKETOHOME — NESTJS IMPLEMENTATION SPECIFICATION
## Core Bootstrap, Application Modules & Dependency Injection

- **Module Root:** `apps/api/src/nestjs/app.module.ts`
- **Bootstrap:** `apps/api/src/nestjs/bootstrap.ts`
- **Status:** Fully Implemented & Tested (25/25 Assertions Passed)

### 1. Module Composition

1. `HealthModule`: Provides `/health` and `/api/v1/health` system diagnostics.
2. `AuthModule`: Manages mobile OTP generation and Supabase session verification.
3. `UsersModule`: Customer profile retrieval and management.
4. `RolesModule`: 8 canonical roles and 15 granular permissions registry.
5. `OrdersModule`: Atomic order creation maintaining Order ≠ Bill invariant.
6. `PaymentsModule`: Cashfree session creation, status queries, refunds, Razorpay rejection.
7. `WebhooksModule`: Cashfree HMAC-SHA256 Base64 webhook verification with replay protection.
8. `InventoryModule`: Real-time stock queries and `direction = 'OUT'` sales movements.
9. `KitchenModule`: Idempotent KOT generation and reprint tracking.
10. `NotificationsModule`: Outbox pattern queueing and background dispatch.
11. `DeliveryModule`: Rider dispatch, customer delivery OTP verification, handover completion.
12. `AccountingModule`: Statutory invoice reconciliation and zero-variance voucher posting.
