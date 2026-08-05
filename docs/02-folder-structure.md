# 02 — Folder Structure

## Workspace Directory Layout

```
cakes2home/
├── apps/
│   └── api/                    # Consolidated Enterprise Node.js Express API Engine
│       ├── prisma/             # Prisma ORM schema & database migrations
│       │   ├── schema.prisma   # Unified PostgreSQL schema
│       │   └── migrations/     # Executable SQL migrations
│       ├── src/
│       │   ├── config/         # Environment variables & service initializers (Redis, Prisma, Swagger)
│       │   ├── core/           # Shared utilities (logger, error handler, base repository)
│       │   ├── middlewares/    # Global Express middlewares (auth, rate-limiter, error handling)
│       │   ├── modules/        # Domain-driven modular monolith services
│       │   │   ├── auth/
│       │   │   ├── customers/
│       │   │   ├── settings/
│       │   │   ├── catalog/
│       │   │   ├── branches/
│       │   │   ├── delivery/
│       │   │   ├── cart/
│       │   │   ├── orders/
│       │   │   ├── rewards/
│       │   │   ├── crm/
│       │   │   ├── cms/
│       │   │   ├── notifications/
│       │   │   └── security/
│       │   ├── queues/         # BullMQ queue definitions & workers
│       │   ├── app.ts          # Express application initialization & middleware setup
│       │   └── server.ts       # HTTP server bootstrapper
│       ├── package.json
│       └── tsconfig.json
├── backend/                    # Legacy Medusa backend (Deprecated as modules migrate)
├── frontend/                   # Next.js 14 Storefront & Dashboard
├── docs/                       # Single Source of Truth Documentation System
└── plans/                      # Release audit & progress summary logs
```

---

## Required Module Structure

Every module inside `apps/api/src/modules/[module_name]` MUST adhere to the following 8-file convention:

```
src/modules/customers/
├── customer.controller.ts     # HTTP Controllers (Request/Response mapping)
├── customer.service.ts        # Business Domain Service
├── customer.repository.ts     # Prisma ORM Data Access Repository
├── customer.route.ts          # Express Route Definitions
├── customer.validator.ts      # Zod Payload Schemas
├── customer.middleware.ts     # Module Auth / Guard Middlewares (if needed)
├── customer.types.ts          # Module DTOs & Interfaces
└── customer.constants.ts      # Enums & Module Error Codes
```

---

## File Naming Conventions
1. **Modules**: Use plural lower-case names (`customers`, `branches`, `orders`, `products`).
2. **Files**: Singular domain name + layer descriptor:
   * Controller: `customer.controller.ts`
   * Service: `customer.service.ts`
   * Repository: `customer.repository.ts`
   * Route: `customer.route.ts`
   * Validator: `customer.validator.ts`
   * Types: `customer.types.ts`
   * Constants: `customer.constants.ts`
3. **Classes**: UpperCamelCase matching layer (`CustomerController`, `CustomerService`, `CustomerRepository`).
