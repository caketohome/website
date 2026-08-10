<h1 align="center">🎂 CakeToHome — Backend</h1>

<h4 align="center">Premium Cake & Bakery Ordering Platform — API & Admin</h4>

<p align="center">
  CakeToHome is a fullstack premium cake and bakery ordering platform built on
  Medusa 2.0 (PostgreSQL, MikroORM) with a Next.js 14 storefront.
</p>

---

## Overview

The CakeToHome backend is powered by Medusa 2.0, extended with custom modules
that power a multi-branch, multi-city cake ordering and delivery platform.

> **Business rule:** CakeToHome does **not** manufacture cakes. The parent
> company supplies cakes; this platform handles ordering, delivery, customer
> experience, CRM, marketing, multi-branch operations, and administration.

## Tech Stack

- **Medusa 2.0** — headless commerce engine
- **PostgreSQL** + **MikroORM** — data layer
- **Next.js 14** — storefront (separate `frontend/` package)
- **TypeScript** — end-to-end type safety

## Custom Modules

| Module | Key | Purpose |
|---|---|---|
| Settings | `settingsModuleService` | Centralized, DB-backed, admin-editable configuration + feature flags |
| Rules | `rulesModuleService` | Unified promotion / offer / coupon / campaign engine |
| Notification | `notificationModuleService` | Provider abstraction (SMS, WhatsApp, Email, Push) |
| Analytics | `analyticsModuleService` | Event ingestion + aggregation |
| Audit | `auditModuleService` | Audit logs across modules |
| Media | `mediaModuleService` | File manager, CDN, WebP + compression |
| Localization | `localizationModuleService` | Languages, currencies, translations |
| Webhook | (registered on demand) | Outbound webhook endpoints |
| Shop | `shopModuleService` | Multi-shop / branch operations |
| Delivery | `deliveryModuleService` | Delivery partner + delivery lifecycle |

## Getting Started

```bash
# 1. Configure environment
cp .env.template .env

# 2. Install dependencies
yarn install

# 3. Build, run migrations, sync links, seed, create admin user
yarn setup-db

# 4. Start the dev server
yarn dev
```

The admin panel is available at `http://localhost:7001` and the API at
`http://localhost:9000`.

## Scripts

| Script | Description |
|---|---|
| `yarn dev` | Start CakeToHome dev server |
| `yarn build` | Build the backend |
| `yarn start` | Start the production server |
| `yarn seed` | Seed sample data |
| `yarn setup-db` | Build + migrate + links + seed + admin user |
| `yarn test:unit` | Run unit tests |
| `yarn test:integration:http` | Run HTTP integration tests |
| `yarn test:integration:modules` | Run module integration tests |

## Architecture

- New domains → custom modules (MikroORM), mirroring `shop` / `delivery`.
- Business logic → CakeToHome workflows, mirroring `workflows/delivery`.
- HTTP → custom API routes under `src/api/store` & `src/api/admin`.
- Admin UI → admin extensions under `src/admin/routes`.
- Configurable features → Settings Module + Feature Flags. Never hardcode.
- All offers/promotions → Rules Engine. Never per-feature discount logic.
- Notifications → Provider Abstraction. Pluggable.
- Backward compatibility: never remove existing routes/models; extend only.

See [`/plans`](../plans) for the full phased implementation plan, progress
summary, and feature audit.
