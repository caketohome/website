# ADR-001: Adoption of Node.js & Express.js Enterprise Runtime

## Status
Accepted

## Context
The existing Medusa.js framework backend provides built-in e-commerce abstractions but introduces tight coupling, framework-specific data layers, and constraints when scaling custom bakery operational workflows (e.g. multi-branch KDS, pincode delivery slot capacities, and dynamic cake customizers).

## Problem
We need an enterprise backend runtime that provides high throughput, full architectural freedom, lightweight deployment footprints, and zero vendor/framework lock-in.

## Decision
Adopt **Node.js (v20+ LTS)** with **Express.js (v4/v5)** as the core API HTTP engine structured as a layered Modular Monolith (`Route` → `Validator` → `Controller` → `Service` → `Repository`).

## Alternatives Considered
1. **NestJS**: Powerful typescript framework, but higher boilerplate overhead for simple routes and opinionated DI container complexity.
2. **Fastify**: Extremely high speed, but Express has broader ecosystem compatibility, middleware ubiquity, and simplicity for team onboarding.
3. **Retaining Medusa framework**: Rejected due to abstraction opacity and difficulty customizing non-standard operational modules.

## Consequences
* **Positive**: Complete control over DB transactions, routing, middleware, logging, and security. Zero framework lock-in.
* **Negative**: Requires manual setup of initial boilerplate (routing, error handlers, OpenAPI specs), which is solved by establishing our standard 8-component module pattern.
