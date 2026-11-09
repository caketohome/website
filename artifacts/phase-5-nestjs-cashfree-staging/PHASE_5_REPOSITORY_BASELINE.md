# CAKETOHOME — PHASE 5 REPOSITORY BASELINE
## Monorepo State, Package Inventory & Architectural Coexistence

- **Repository Root:** `E:/vig`
- **Application Directory:** `cakes2home-main/cakes2home-main`
- **Base Commit:** `d231cee7e55f716526e62f5799cc7377c555fed3` (`checkpoint/c-phases-baseline`)
- **Inspection Date:** 2026-11-04T11:02:39.399Z

### 1. Monorepo Structure

```
cakes2home-main/cakes2home-main/
├── apps/
│   └── api/                  # NestJS 10+ Enterprise API Engine (@api/v1/*)
│       ├── src/
│       │   ├── nestjs/       # Modular NestJS Root, Guards, Interceptors, Modules
│       │   ├── modules/      # Domain Feature Repositories & Business Logic
│       │   ├── core/         # Structured Logger, Outbox Publisher, Gateway Middleware
│       │   └── main.ts       # Unified Bootstrap (NestJS Standalone / Express Gateway)
│       └── tsconfig.json     # Experimental Decorators & CommonJS Output
├── frontend/                 # Next.js 14.1.4 App Router Storefront
│   ├── src/
│   │   ├── app/              # Routes, Pages, Server Components, API Handlers
│   │   │   └── api/v1/payments/cashfree/webhook/route.ts  # Authoritative CF Webhook
│   │   │   └── api/v1/payments/webhook/route.ts           # Decommissioned Razorpay (410)
│   │   ├── components/       # Storefront UI, Checkout Form (Cashfree Selected)
│   │   └── lib/services/     # CashfreePaymentService (v2023-08-01 API)
├── backend/                  # MedusaJS 2.17.2 Commerce Framework
│   ├── src/                  # Workflows, Loaders, MikroORM Entities
│   └── medusa-config.ts      # Multi-tenant Config, Redis, PostgreSQL Store
└── scripts/                  # Automated Test & Rehearsal Suites
```

### 2. Package Additions in Phase 5

| Package | Version | Scope | Purpose |
|---|---|---|---|
| `@nestjs/core` | ^10.4.0 | Enterprise API | Core dependency injection container and application lifecycle |
| `@nestjs/common` | ^10.4.0 | Enterprise API | Decorators, HTTP abstractions, lifecycle hooks, logger |
| `@nestjs/platform-express` | ^10.4.0 | Enterprise API | Express adapter for ultra-high throughput HTTP server |
| `reflect-metadata` | ^0.2.0 | Runtime | Decorator metadata reflection for TypeScript annotations |
| `rxjs` | ^7.8.0 | Core Runtime | Observable stream processing for interceptors and filters |
| `class-validator` | ^0.14.1 | API Validation | DTO schema validation and payload sanitization |
| `class-transformer` | ^0.5.1 | API Validation | Plain JSON to typed class instance transformation |
