# CAKETOHOME — TARGET ARCHITECTURE SPECIFICATION
## Modular Enterprise Backend Architecture (Phase 5 Evolution)

- **Architecture Style:** Layered Modular Monolith with NestJS Application Layer
- **Status:** Implemented & Verified

### 1. Architecture Tiers

```
+-------------------------------------------------------+
|              Next.js 14 Storefront                    |
|       (Customer Experience, SSR, Cashfree UI)         |
+-------------------------------------------------------+
                           |
                     HTTP / JSON
                           v
+-------------------------------------------------------+
|             NestJS Enterprise API Layer               |
|  - Correlation ID Middleware & Request Tracing        |
|  - Global Exception Filters & Response Envelopes     |
|  - Supabase Auth Guard & RBAC Roles Guard             |
|  - 12 Functional Domain Modules                       |
+-------------------------------------------------------+
         |                        |            |
         v                        v            v
+------------------+     +--------------+  +------------+
| Cashfree PG API  |     | Supabase Auth|  | MedusaJS   |
| (v2023-08-01)    |     | (Cloud Ident)|  | (Commerce) |
+------------------+     +--------------+  +------------+
         \                      /             /
          \                    /             /
           v                  v             v
+-------------------------------------------------------+
|              Authoritative PostgreSQL Store           |
|      (Orders, Invoices, Vouchers, Movements, RLS)     |
+-------------------------------------------------------+
```

### 2. Core Invariants
- Cashfree is the EXCLUSIVE payment gateway for all new transactions.
- All historical payment transactions and audit ledgers remain immutable.
- Tax invoice (`CH`) allocated strictly upon customer delivery handover.
- Zero variance (`debit == credit`) required for all posted journal vouchers.
