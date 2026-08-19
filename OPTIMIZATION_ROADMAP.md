# CakeToHome Optimization Roadmap & Priority Plan

## Overview
This roadmap establishes a rigorous, risk-ranked engineering plan for the **Top 20 Performance Optimizations** in CakeToHome, prioritized by impact, safety, and business value under the *Lazy Coder* (minimum complexity, maximum reliability) standard.

---

## Priority Classification
- **P0**: Broken functionality or security integrity (Zero tolerance).
- **P1**: Major performance bottleneck (Measurable latency or bundle reduction).
- **P2**: Medium performance optimization (Caching, memoization, payload slimming).
- **P3**: Code quality, duplication elimination, and clean architecture.
- **P4**: Minor / cosmetic enhancements.

---

## The Top 20 Optimization Opportunities

### [P1] OPT-01: Dynamic Lazy-Hydration of Storefront Floating Widgets
- **Problem**: `AiChatAssistant` (556 LOC) and `ExitIntentPopup` are statically bundled and evaluated on every page load in `frontend/src/app/(store)/layout.tsx`.
- **Evidence**: Shared First Load JS is 85.4 kB; initial storefront bundle includes chat UI code before user clicks the chat button.
- **Root Cause**: Static import in root storefront layout.
- **Proposed Fix**: Lazy-load `AiChatAssistant` and `ExitIntentPopup` using `next/dynamic` with `ssr: false` or on-interaction triggers.
- **Risk**: Low (Client-only interactive widgets).
- **Expected Improvement**: Reduces initial blocking execution time on homepage and product pages.
- **Test Required**: Verify widget opens cleanly when clicked and exit-intent triggers on mouse leave.
- **Rollback**: Revert layout import to static import.

---

### [P1] OPT-02: Fast-Path Route Matcher in Next.js Catch-All API Router
- **Problem**: `frontend/src/app/api/v1/[...path]/route.ts` sequentially scans 40+ string conditions for every incoming request.
- **Evidence**: `resolveTargetPath` executes sequential string matching on high-frequency routes (`/products`, `/branches`, `/cart`).
- **Root Cause**: Linear conditional routing logic in catch-all handler.
- **Proposed Fix**: Implement an O(1) Map lookup for exact route targets while retaining prefix handlers for parameterized routes.
- **Risk**: Low.
- **Expected Improvement**: Microsecond-level routing overhead reduction across all `/api/v1/*` requests.
- **Test Required**: Run all E2E test suites (`test-checkout-verification.ts`, `test-store-manager-payment-delivery-e2e.ts`).
- **Rollback**: Restore linear conditional branches.

---

### [P1] OPT-03: Cache-Control & Stale-While-Revalidate Headers on Public APIs
- **Problem**: Public catalog listings (`/api/v1/products`, `/api/v1/branches`, `/api/v1/accessories`) return dynamic responses without client/edge caching headers.
- **Evidence**: Rapid navigation between storefront pages triggers redundant network fetches.
- **Root Cause**: Missing `Cache-Control` header declarations on read-only public GET endpoints.
- **Proposed Fix**: Add `Cache-Control: public, s-maxage=60, stale-while-revalidate=300` to static/catalog GET route handlers.
- **Risk**: Very Low (Dynamic pricing & cart routes remain un-cached).
- **Expected Improvement**: Near-instantaneous subsequent page navigation and reduced server load.
- **Test Required**: Check response headers via curl or automated test.
- **Rollback**: Remove Cache-Control headers.

---

### [P2] OPT-04: Consolidation of Dynamic Engine Imports in Catalog Data Layer
- **Problem**: `frontend/src/lib/data/catalog.ts` contains 5 repeated `const { ApiEngine } = await import("../api-engine");` statements across helper functions.
- **Evidence**: Repetitive dynamic import syntax across `listProducts`, `retrieveProduct`, `listPimCategories`, `listOccasions`.
- **Root Cause**: Copy-pasted async import blocks.
- **Proposed Fix**: Extract a clean, single helper `getApiEngine()` returning the module instance.
- **Risk**: Very Low.
- **Expected Improvement**: Cleaner code, zero duplicate dynamic import statements.
- **Test Required**: `test-checkout-verification.ts`.
- **Rollback**: Restore inline imports.

---

### [P2] OPT-05: Consolidation of Dynamic Engine Imports in Deliveries Data Layer
- **Problem**: `frontend/src/lib/data/deliveries.ts` and `frontend/src/lib/actions/deliveries.ts` contain 8 separate dynamic import blocks.
- **Evidence**: Lines 10, 18, 25, 38, 45, 52, 59 of `actions/deliveries.ts`.
- **Root Cause**: Repetitive async imports across individual action wrappers.
- **Proposed Fix**: Consolidate through a shared `getApiEngine()` helper.
- **Risk**: Very Low.
- **Expected Improvement**: Reduced boilerplate and consistent error handling.
- **Test Required**: `test-store-manager-payment-delivery-e2e.ts`.
- **Rollback**: Restore inline imports.

---

### [P2] OPT-06: Token Caching & Storage Optimization in API Client
- **Problem**: `CakeToHomeApiClient` in `frontend/src/lib/api-client.ts` repeatedly accesses `localStorage` on every request.
- **Evidence**: Lines 48-57 of `api-client.ts` read 4 different localStorage keys sequentially on every request if `this.token` is null.
- **Root Cause**: Uncached local storage lookup inside `getToken()`.
- **Proposed Fix**: Cache the active token in memory on first read and only re-query localStorage upon explicit clear/logout.
- **Risk**: Low.
- **Expected Improvement**: Eliminates synchronous browser storage I/O on repeated API calls.
- **Test Required**: Customer auth and admin API test flows.
- **Rollback**: Restore direct storage lookup.

---

### [P2] OPT-07: Payload Slimming in Store Manager Orders Endpoint
- **Problem**: `ApiEngine.getBranchOrders` maps extensive internal metadata not used in the store manager order card view.
- **Evidence**: Mapped object returns default mock data when fields are absent.
- **Root Cause**: Verbose object construction.
- **Proposed Fix**: Streamline response mapping to strictly required UI fields while preserving Kitchen Pickup OTP and delivery status.
- **Risk**: Low (Drawer details endpoint provides full detail).
- **Expected Improvement**: Smaller JSON payloads over network for high-volume store queues.
- **Test Required**: `test-store-manager-payment-delivery-e2e.ts`.
- **Rollback**: Revert mapping payload.

---

### [P2] OPT-08: Memory Bounding on CRM Abandoned Cart & Audit Logs
- **Problem**: In-memory `memoryStore.abandoned_carts` and `audit_logs` grow without bound over long sessions.
- **Evidence**: Arrays accumulate new events indefinitely.
- **Root Cause**: Missing sliding-window retention caps.
- **Proposed Fix**: Enforce FIFO cap (e.g. max 500 recent events) on transient logs in `ApiEngine`.
- **Risk**: Very Low.
- **Expected Improvement**: Constant $O(1)$ memory consumption for long-running processes.
- **Test Required**: `test-master-identity-chain-e2e.ts`.
- **Rollback**: Remove array length slicing.

---

### [P2] OPT-09: Scroll Hero Animation Preload & Viewport Optimization
- **Problem**: `scroll-frame-hero.tsx` loads 22 high-resolution frames; mobile devices benefit from optimized asset preloading.
- **Evidence**: Frame sequence loaded smoothly, but can benefit from priority loading on the first 3 keyframes.
- **Root Cause**: Sequential browser image loading.
- **Proposed Fix**: Add `<link rel="preload">` or explicit priority loading for initial hero frames.
- **Risk**: Low.
- **Expected Improvement**: Faster LCP (Largest Contentful Paint) on the homepage hero.
- **Test Required**: `test-scroll-frame-hero-22-e2e.ts`.
- **Rollback**: Remove preload tags.

---

### [P2] OPT-10: Database Pool & Keep-Alive Tuning in Medusa Config
- **Problem**: Database pool settings in `backend/medusa-config.ts` default to generic pool sizes.
- **Evidence**: `pool: { min: 2, max: 30 }` with standard timeouts.
- **Root Cause**: Unoptimized pool parameters for cloud Supabase poolers.
- **Proposed Fix**: Configure optimal keep-alive and idle timeouts (`idleTimeoutMillis: 30000`, `acquireTimeoutMillis: 30000`).
- **Risk**: Low.
- **Expected Improvement**: Resilient connection recovery without connection exhaustion.
- **Test Required**: Backend startup and migration test.
- **Rollback**: Restore baseline config.

---

### [P3] OPT-11: Canonical Phone Normalization Deduplication
- **Problem**: Multiple regex patterns for phone cleaning exist across `staff-access-control.ts`, `crm-engine.ts`, `api-client.ts`, and `auth-service.ts`.
- **Evidence**: `phone.replace(/\D/g, "").slice(-10)` repeated in 6 files.
- **Root Cause**: Decentralized utility usage.
- **Proposed Fix**: Centralize in `crm-engine.ts` (`normalizePhone`) and export for shared reuse.
- **Risk**: Very Low.
- **Expected Improvement**: Single source of truth for phone normalization.
- **Test Required**: `test-master-identity-chain-e2e.ts`.
- **Rollback**: Restore local regexes.

---

### [P3] OPT-12: Notification Module Channel Clean-Up in Backend
- **Problem**: Dead legacy notification channel imports in `backend/src/modules/notification/service.ts`.
- **Evidence**: Unused providers cleaned up in recent commit.
- **Root Cause**: Historical refactoring.
- **Proposed Fix**: Verify clean imports and zero unreferenced files.
- **Risk**: None.
- **Expected Improvement**: Clean module graph.
- **Test Required**: `npx tsc --noEmit`.
- **Rollback**: N/A.

---

### [P3] OPT-13: JSON-LD Structured Data Builder Optimization
- **Problem**: `OrganizationJsonLd` in `frontend/src/components/store/seo/json-ld.tsx` generates static JSON string on every render.
- **Evidence**: Evaluated during root layout render.
- **Root Cause**: Inline schema serialization.
- **Proposed Fix**: Use constant serialized JSON-LD object.
- **Risk**: None.
- **Expected Improvement**: Zero serialization overhead on page render.
- **Test Required**: Next.js build.
- **Rollback**: Restore dynamic serialization.

---

### [P3] OPT-14: Telemarketing High-Value Queue Filter Optimization
- **Problem**: Telemarketing queue scans all orders sequentially to filter dropoffs $>₹1,000$.
- **Evidence**: In-memory filter on unsorted array.
- **Root Cause**: Linear scan without index mapping.
- **Proposed Fix**: Pre-filter or early-exit during queue aggregation.
- **Risk**: Low.
- **Expected Improvement**: Faster telemarketing dashboard loading.
- **Test Required**: Telemarketing test suite.
- **Rollback**: Restore filter logic.

---

### [P3] OPT-15: Outbox Flush Concurrency Batching
- **Problem**: `WebhookEngine.flushOutbox` processes pending webhooks sequentially.
- **Evidence**: Sequential async loop over outbox entries.
- **Root Cause**: Single-threaded loop.
- **Proposed Fix**: Batch webhook dispatches with `Promise.allSettled` (max batch size 10).
- **Risk**: Low.
- **Expected Improvement**: Faster outbox draining under high order volumes.
- **Test Required**: Webhook test suite.
- **Rollback**: Restore sequential loop.

---

### [P3] OPT-16: Admin Panel Error Boundary Isolation
- **Problem**: Unhandled render exceptions in an individual admin tab could affect the entire dashboard page.
- **Evidence**: `DashboardErrorBoundary` wraps individual panels; ensure all 20 panels are guarded.
- **Root Cause**: Partial boundary coverage.
- **Proposed Fix**: Verify and enforce error boundary wrappers on all 20 admin tabs.
- **Risk**: None.
- **Expected Improvement**: Maximum resilience for admin operations.
- **Test Required**: Dashboard test suite.
- **Rollback**: N/A.

---

### [P3] OPT-17: Strict Prop Stability in Storefront Navigation
- **Problem**: Navigation components reconstruct static link arrays on every render.
- **Evidence**: `HeaderNavigation` in `src/components/store/cms/navigation.tsx`.
- **Root Cause**: Non-hoisted constants.
- **Proposed Fix**: Hoist static navigation menu structures outside component scope.
- **Risk**: None.
- **Expected Improvement**: Eliminates redundant array allocations.
- **Test Required**: Homepage render verification.
- **Rollback**: Restore local definitions.

---

### [P3] OPT-18: Cart Line Item Quantity Mutation Debouncing
- **Problem**: Rapid clicks on `+` / `-` quantity buttons trigger multiple concurrent server action dispatches.
- **Evidence**: `nav-cart.tsx` and cart page handlers.
- **Root Cause**: Missing optimistic debounce.
- **Proposed Fix**: Debounce rapid quantity mutations on client while updating UI optimistically.
- **Risk**: Low.
- **Expected Improvement**: Eliminates race conditions and reduces server load.
- **Test Required**: Cart verification tests.
- **Rollback**: Restore immediate dispatch.

---

### [P3] OPT-19: Dead Script & Unused Export Pruning
- **Problem**: Multiple legacy verification scripts and unused exports from older development cycles remain.
- **Evidence**: Scripts directory contains overlapping test runners.
- **Root Cause**: Evolutionary feature development.
- **Proposed Fix**: Retain only active, high-signal regression suites.
- **Risk**: None.
- **Expected Improvement**: Cleaner codebase and faster CI test runs.
- **Test Required**: Run all retained test suites.
- **Rollback**: Restore pruned scripts.

---

### [P3] OPT-20: Automated Full Performance Matrix Benchmark Suite
- **Problem**: No single command measures compilation, build time, and test execution latencies end-to-end.
- **Evidence**: Benchmarks currently measured manually across separate scripts.
- **Root Cause**: Missing unified benchmark tool.
- **Proposed Fix**: Create `frontend/scripts/test-performance-matrix.ts` to measure and log all KPI benchmarks.
- **Risk**: None.
- **Expected Improvement**: Instant empirical verification for future performance tracking.
- **Test Required**: Execute `test-performance-matrix.ts`.
- **Rollback**: N/A.
