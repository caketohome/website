# 01 — Architecture

## Target Technology Stack

| Component | Framework / Library | Role |
| :--- | :--- | :--- |
| **Runtime** | Node.js (v20+) | Execution environment |
| **Web Server Framework** | Express.js (v4/v5) | HTTP REST API request handling & routing |
| **Database & ORM** | PostgreSQL 16 + Prisma ORM | Relational database persistence with strictly-typed schema |
| **In-Memory Cache & Lock** | Redis 7 (ioredis) | Session store, rate limiting, and row-level distributed locks |
| **Async Message Queue** | BullMQ | Reliable job queues for SMS, WhatsApp, Email, and background processing |
| **API Documentation** | Swagger / OpenAPI 3.0 | Interactive API documentation hosted at `/api/docs` |
| **Authentication** | JWT (jsonwebtoken) + Argon2/HMAC | Stateless customer OTP & role-based staff authorization |
| **Validation** | Zod | Strictly-typed request payload validation |

---

## Modular Monolith Architecture

The application is organized into self-contained domain modules under `src/modules/[module_name]`. Cross-module dependencies are explicitly managed via public interfaces and event queues to ensure high cohesion and loose coupling.

```
                                +-----------------------+
                                |  Client (HTTP / JSON) |
                                +-----------------------+
                                            |
                                            v
                                +-----------------------+
                                |  Express App Router   |
                                +-----------------------+
                                            |
                                            v
+---------------------------------------------------------------------------------------+
| MODULE (e.g., customers)                                                              |
|                                                                                       |
|  +------------------+     +--------------------+     +-----------------------------+  |
|  |     Route        | --> |     Validator      | --> |         Controller          |  |
|  | (HTTP Binding)   |     |   (Zod Validation) |     |  (Request/Response Mapping) |  |
|  +------------------+     +--------------------+     +-----------------------------+  |
|                                                                     |                 |
|                                                                     v                 |
|                                                      +-----------------------------+  |
|                                                      |           Service           |  |
|                                                      |     (Business Logic)        |  |
|                                                      +-----------------------------+  |
|                                                                     |                 |
|                                                                     v                 |
|                                                      +-----------------------------+  |
|                                                      |         Repository          |  |
|                                                      |     (Prisma Data Access)    |  |
|                                                      +-----------------------------+  |
+---------------------------------------------------------------------------------------+
                                            |
                                            v
                                +-----------------------+
                                |  PostgreSQL Database  |
                                +-----------------------+
```

---

## Strict Architectural Layering Rules

1. **Routes (`*.route.ts`)**:
   * Responsible ONLY for mapping HTTP path/verb to controller methods and binding middleware.
   * NO business logic or SQL queries permitted.

2. **Validators (`*.validator.ts`)**:
   * Uses Zod schemas to validate `req.body`, `req.query`, and `req.params`.
   * Rejects malformed requests with `400 Bad Request` envelopes.

3. **Controllers (`*.controller.ts`)**:
   * Handles HTTP input extraction (`req`), calls appropriate Service methods, and returns structured JSON envelopes.
   * NO business logic or direct database queries permitted.

4. **Services (`*.service.ts`)**:
   * Contains pure business domain logic, validation rules, state transitions, and transaction management.
   * Interacts with Repositories for data operations and Event Queues for async actions.

5. **Repositories (`*.repository.ts`)**:
   * Encapsulates all Prisma ORM queries.
   * Provides clean data access methods (`findById`, `create`, `update`, `delete`).

---

## Concurrency & Reliability Rules
* **Inventory Locks**: Use `SELECT FOR UPDATE` or Prisma `$transaction` row locks for branch stock allocation.
* **Idempotent Payments**: Enforce idempotency keys on payment webhooks to prevent duplicate charges.
* **Async Offloading**: Offload SMS/WhatsApp/Email notifications to BullMQ background workers.
