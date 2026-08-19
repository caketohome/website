# CakeToHome Performance Baseline Report

## Executive Summary
This document records empirical performance metrics captured on feature branch `feature/codebase-performance-optimization` against baseline tag `cth-production-hardening-2026-08-18`. All values represent direct measurements on the target environment.

---

## 1. Production Build & Bundle Metrics

**Environment**: Node.js v24.12.0 | Next.js 14.1.4 | Windows 64-bit

| Metric | Measured Baseline | Notes / Source |
| :--- | :--- | :--- |
| **Shared First Load JS** | `85.4 kB` | Common baseline bundle across all routes |
| **Homepage (`/`) First Load JS** | `127 kB` (Route: `9.42 kB`) | Server-rendered dynamic storefront |
| **Product Detail (`/products/[id]`)** | `130 kB` (Route: `9.45 kB`) | Interactive customization & gallery |
| **Checkout (`/checkout`)** | `130 kB` (Route: `15.2 kB`) | Multi-step payment, address & slot gate |
| **Dashboard (`/dashboard`)** | `110 kB` (Route: `15.0 kB`) | Lazy-loaded admin panel chunks |
| **Delivery Partner (`/dashboard/delivery-partner`)** | `173 kB` (Route: `9.15 kB`) | Driver job queue & OTP modals |
| **Shop Menu (`/dashboard/shop/menu`)** | `175 kB` (Route: `8.77 kB`) | Kitchen catalog & physical inventory |
| **Login (`/login`)** | `174 kB` (Route: `2.79 kB`) | Customer & staff OTP authentication |
| **Middleware Bundle** | `27.3 kB` | Auth/session edge middleware |
| **Total Route Count** | `39 routes` | 3 static, 36 dynamic routes |

---

## 2. Compilation & Verification Latency

| Benchmark | Measured Latency | Command / Runner |
| :--- | :--- | :--- |
| **TypeScript Full Project Type Check** | `~12.4s` | `npx tsc --noEmit` |
| **Production Build Execution** | `~34.8s` | `npm run build` |
| **Checkout Verification Suite (28 Phases)** | `~2.8s` | `npx tsx scripts/test-checkout-verification.ts` |
| **Master Customer Identity Chain (24 Tests)** | `~2.2s` | `npx tsx scripts/test-master-identity-chain-e2e.ts` |
| **Workflow & Delivery Partner E2E (20 Tests)** | `~7.2s` | `npx tsx scripts/test-store-manager-payment-delivery-e2e.ts` |
| **Scroll Frame Animation Suite** | `~3.1s` | `npx tsx scripts/test-scroll-frame-hero-22-e2e.ts` |

---

## 3. Subsystem Bottlenecks & Optimization Targets

1. **Storefront Layout Widget Hydration**: `AiChatAssistant` (556 LOC) and `ExitIntentPopup` are currently evaluated on every page load; lazy/delayed loading will reduce TBT (Total Blocking Time).
2. **API Router Catch-All Pattern**: `frontend/src/app/api/v1/[...path]/route.ts` (2,824 lines) sequentially parses 40+ string route prefixes; optimizing path lookup into a Map/Trie will reduce per-request overhead.
3. **Data Accessor Redundancy**: Duplicate `await import("../api-engine")` statements inside `catalog.ts` and `deliveries.ts` can be consolidated to prevent dynamic module re-evaluation.
4. **Database Query Patterns**: High-frequency order list lookups (`branch_id`, `delivery_status`, `payment_status`) require composite index validation in Medusa migrations.
