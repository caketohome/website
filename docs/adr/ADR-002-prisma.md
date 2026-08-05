# ADR-002: Adoption of Prisma ORM & PostgreSQL Relational Database

## Status
Accepted

## Context
Medusa used MikroORM / TypeORM internally, which suffered from complex migration tracking and multi-entity mapping overhead.

## Problem
CakeToHome requires a strongly-typed ORM with automatic TypeScript type generation, reliable migration workflows, declarative schema management, and atomic transaction support (`SELECT FOR UPDATE`) for double-booking prevention.

## Decision
Adopt **Prisma ORM** with **PostgreSQL 16**. All database models are defined declaratively in `prisma/schema.prisma`.

## Alternatives Considered
1. **Drizzle ORM**: Lightweight and SQL-like, but Prisma provides superior CLI tooling, schema readability, and widespread ecosystem support.
2. **Raw SQL / Knex**: Maximum control, but lacks compile-time safety and requires extensive manual mapping.

## Consequences
* **Positive**: 100% end-to-end type safety from DB to API controllers. Easy migration generation (`prisma migrate`).
* **Negative**: Requires careful handling of complex raw queries (e.g. spatial distance calculations) via `prisma.$queryRaw`.
