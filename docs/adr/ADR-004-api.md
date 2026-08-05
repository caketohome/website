# ADR-004: Strict RESTful Resource Naming (Zero Verbs in Paths)

## Status
Accepted

## Context
Inconsistent API naming across legacy routes made SDK integration confusing and violated standard HTTP practices.

## Decision
Enforce strict RESTful URL naming across all `/api/v1/*` endpoints:
* Use HTTP methods (`GET`, `POST`, `PATCH`, `DELETE`, `PUT`) to express actions.
* Use plural resource nouns in URL paths (`/products`, `/orders`, `/addresses`).
* **STRICT PROHIBITION**: Zero verbs allowed in path strings (no `/getProducts`, `/createOrder`, `/searchCake`).

## Consequences
* **Positive**: Predictable, clean, standardized OpenAPI specification.
* **Negative**: Requires legacy API Gateway mapping during storefront migration transition.
