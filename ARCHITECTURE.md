# 📜 CakeToHome Platform Constitution (ARCHITECTURE.md)

This document is the **mandatory architectural contract** for all engineers and AI coding agents contributing to the CakeToHome Commerce Platform. Every pull request and code modification MUST strictly adhere to these rules without exception.

---

## 🏛️ Core Architectural Principles

1. **Clean Framework-Independent Architecture**:
   - **API Controllers** → **Application Services (CQRS)** → **Domain Services** → **Repositories** → **Prisma / PostgreSQL**.
   - Domain services and business logic MUST remain pure TypeScript and NEVER import `@nestjs/*` or HTTP framework decorators.

2. **Strict Layer Boundaries & Ownership Rules**:
   - **Controllers**: Handle HTTP routing, input DTO validation, and RFC 7807 error formatting. Controllers contain ZERO business logic.
   - **Application Services**: Orchestrate application use cases via CQRS Command & Query handlers.
   - **Domain Services**: Pure business rules (pricing calculations, stock deduction logic, discount rules).
   - **Repositories**: Data access encapsulation using Prisma Client. Controllers NEVER query Prisma directly.

3. **Decoupled Module Communication**:
   - Modules MUST NOT make direct imports or synchronous cross-module calls to private internal services.
   - Cross-module interaction happens exclusively via **Application Services** or asynchronous **Domain Events** (Outbox Pattern).

4. **Transactional Outbox Pattern**:
   - All domain events (`OrderCreated`, `PaymentCaptured`, `InventoryReserved`, `DriverAssigned`) MUST be written to the `OutboxEvent` table inside the active database transaction before BullMQ/Redis publishing.

5. **Financial Integrity**:
   - Monetary amounts (prices, wallet balances, fees, earnings, totals) MUST use **`Decimal(12,2)`**. `Float` or `Number` types for currency are STRICTLY FORBIDDEN.

6. **Dedicated BFF (Backend for Frontend)**:
   - Next.js Web App accesses the Core API via the Next.js BFF (`apps/frontend/src/app/api/*`).
   - BFF manages HttpOnly session cookies (`_caketohome_jwt`), SSR payload aggregation, and UI DTO shaping.
   - Core API (`apps/api/src/modules/*`) remains client-agnostic (`/api/v1/*`).

---

## ⛔ Enforceable Architectural Rules

| Rule ID | Architectural Rule | Enforcement Mechanism |
| :--- | :--- | :--- |
| **AR-01** | Domain services MUST NOT import NestJS or web frameworks. | ESLint Rule / Code Review |
| **AR-02** | Controllers MUST NOT query Prisma or database models directly. | Mandatory Repository Pattern |
| **AR-03** | All database writes MUST go through CQRS Command Handlers. | CQRS Architecture Guard |
| **AR-04** | All database reads MUST go through CQRS Query Handlers. | CQRS Architecture Guard |
| **AR-05** | No synchronous cross-module state mutation. Use Event Bus. | Outbox Event Publisher |
| **AR-06** | Every monetary schema column MUST use `@db.Decimal(12,2)`. | Prisma Schema Audit |
| **AR-07** | Every database migration MUST be reversible (`down` migration). | Migration Verification Script |
| **AR-08** | All list endpoints MUST implement cursor-based pagination. | API Contract Validator |
| **AR-09** | Payment & Order creation MUST require `Idempotency-Key` header. | Middleware Interceptor |
| **AR-10** | Error responses MUST conform to **RFC 7807 Problem Details**. | Global Exception Filter |

---

## 🗄️ Database & Schema Standards

1. **Identifiers**: Every table MUST use CUID primary keys (`@id @default(cuid())`).
2. **Audit Timestamps**: Every model MUST include:
   - `createdAt DateTime @default(now())`
   - `updatedAt DateTime @updatedAt`
   - `deletedAt DateTime?` (Soft delete column)
3. **Optimistic Locking**: Inventory models MUST include a `@version Int @default(1)` column for concurrent stock deduction safety.
4. **N+1 Query Policy**: All database queries MUST fetch related entities via explicit `include` or batch `findMany` queries. Zero N+1 loop queries allowed.

---

## 🔒 Security & Performance Standards

1. **Password Hashing**: Argon2id (`argon2`) algorithm.
2. **Token Security**: Short-lived JWT access tokens + rotating refresh tokens in HttpOnly, SameSite=Strict cookies.
3. **Secrets Management**: Zero hardcoded secrets. All secrets loaded from environment or Secret Manager.
4. **Rate Limiting**: Tiered Redis rate-limiting on all public endpoints.
5. **Observability**: Health endpoints (`/api/v1/health`, `/ready`, `/live`), Pino structured JSON logger with `x-request-id` correlation IDs.

---

## ✅ Definition of Done (DoD) Checklist

Before any pull request or task is marked complete:
- [ ] Code passes TypeScript strict compilation (`tsc --noEmit`).
- [ ] ESLint & Prettier checks pass with zero errors.
- [ ] Unit & Integration test coverage target **≥80%** reached.
- [ ] OpenAPI documentation generated for all new endpoints.
- [ ] Soft deletes & audit timestamps verified on new Prisma models.
- [ ] RFC 7807 error handling verified for all failure paths.
- [ ] E2E Playwright test executed and verified in browser.
