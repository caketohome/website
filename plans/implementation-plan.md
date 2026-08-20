# CakeToHome — Implementation Plan

**Stack:** Medusa 2.0 (backend, PostgreSQL, MikroORM) + Next.js 14 (frontend, App Router, Tailwind, @medusajs/ui)
**Business rule:** CakeToHome does NOT manufacture cakes. Focus on ordering, delivery, customer experience, CRM, marketing, multi-branch operations, analytics, administration, automation.

---

## Objectives

Transform the existing "Medusa Eats"-derived codebase into a production-ready, enterprise-grade online cake ordering platform supporting multiple cities, multiple branches, and high order volumes — while keeping the architecture clean, modular, scalable, and backward-compatible.

## Current Phase

**Phase 18 — Production Readiness & Final Verification** (⚠️ Planning)
Phase 0 to Phase 17 are fully complete and verified.


## Phases Overview

| Phase | Name | Status |
|---|---|---|
| 0 | Foundation & Core Engines | ✅ Complete |
| 1 | Customer Identity & Accounts | ✅ Complete |
| 2 | SEO, CMS, Homepage Builder, Navigation & Media | ✅ Complete |
| 3 | Catalog, Search & Product Experience | ✅ Complete |
| 4 | Cart, Checkout, Cake Customization & Delivery Scheduling | ✅ Complete |
| 5 | Order Lifecycle Completion | ✅ Complete |
| 6 | Multi-Branch Operations & Inventory | ✅ Complete |
| 7 | Wallet, Gift Cards, Loyalty & Referral | ✅ Complete |
| 8 | CRM & Campaigns | ✅ Complete |
| 9 | Marketing Engine | ✅ Complete |
| 10 | Owner & Super Admin Dashboards | ✅ Complete |
| 11 | Reports & Exports | ✅ Complete |
| 12 | Communication & Support | ✅ Complete |
| 13 | PWA & Platform Hardening | ✅ Complete |
| 14 | Delivery Enhancements | ✅ Complete |
| 15 | Security Hardening | ✅ Complete |
| 16 | Integrations | ✅ Complete |
| 17 | Enterprise AI Operating System | ✅ Complete |
| 18 | Production Readiness & Final Verification | ⚠️ Planning |
| 19 | Manufacturing & Bakery ERP Extension | ❌ Pending |

---

# Phase 4 Implementation Plan — Cart, Checkout, Cake Customization & Delivery Scheduling

This phase introduces a highly flexible storefront ordering workflow, allowing customer customization of cakes (shape, artisan, premium wrapping, text message, photo cake upload), branch selection (delivery vs. pickup), scheduled delivery slots, and postal code serviceable coverage verification with dynamic zone delivery charges.

## Phase 4 Roadmap & Milestones

### Milestone 4.1 — Cart Foundation & Enhancements
- **Goal:** Enable metadata-driven carts supporting guest vs. authenticated user sessions, save-for-later, and cart promotions injection hooks.
- **Modifications:** 
  - Update `addToCart` server action in [carts.ts](file:///e:/vig/cakes2home-main/cakes2home-main/frontend/src/lib/actions/carts.ts) to accept optional `metadata`.
  - Expose API endpoints for promotions code verification via `M2 Rules Engine`.
- **API Contract:**
  - `POST /store/carts/:id/promotions` (Request: `{ code: string }`, Response: `{ promotion: any, discount: number }`)

### Milestone 4.2 — Cake Customization Engine
- **Goal:** Implement shape/artisan/packaging selectors on the storefront PDP, calculating price deltas dynamically on line items.
- **New Features:** 
  - Add backend `cake_option` model defining shape, packaging, artisan upgrades, and their positive/negative price differentials (INR).
  - PDP pricing logic that adjusts product prices locally before cart addition.
- **Database Schema (`cake_option`):**
  - `id`: string (primary key)
  - `product_id`: string (foreign key to product)
  - `option_type`: string (`shape`, `artisan`, `packaging`, etc.)
  - `values`: jsonb (e.g., `["Round", "Square", "Heart"]`)
  - `price_delta`: number (in INR)

### Milestone 4.3 — Checkout Foundation (Complete)
- **Goal:** Establish base checkout page container, responsive form layout, order summary integration, and session check routing.
- **New Features:**
  - Create the base container layout for the checkout page.
  - Setup fields for customer personal details, shipping address inputs, and notes.

### Milestone 4.4 — Pincode Serviceability & Delivery Zones (Early Implementation - Complete)
- **Goal:** Pincode validation at checkout mapping to serviceable branches and calculating dynamic delivery fees.
- **New Features:** 
  - Add backend `delivery_zone` model mapping pincodes to branches and fee structures.
  - Pincode serviceability check endpoint `/store/delivery/availability`.
- **Database Schema (`delivery_zone`):**
  - `id`: string (primary key)
  - `pincode`: string (unique, indexed)
  - `branch_id`: string (foreign key to shop/branch)
  - `delivery_fee`: number (in INR/Euros)
  - `is_serviceable`: boolean
- **API Contract:**
  - `GET /store/delivery/availability?pincode=XXXXXX` (Response: `{ serviceable: boolean, delivery_fee: number, branch_id: string }`)

### Milestone 4.5 — Delivery Scheduling & Slots
- **Goal:** Date and time slot picker interface during checkout enforcing operational capacity limits.
- **New Features:** 
  - Add backend `delivery_slot` model.
  - Slot availability checks accounting for midnight and fixed-time delivery types.
- **Database Schema (`delivery_slot`):**
  - `id`: string (primary key)
  - `branch_id`: string
  - `slot_name`: string (e.g., "Midnight (11:00 PM - 11:59 PM)")
  - `start_time`: string (HH:MM)
  - `end_time`: string (HH:MM)
  - `max_capacity`: number
  - `extra_charge`: number (in INR, e.g. for midnight slots)

### Milestone 4.6 — Checkout Flow UX Integration
- **Goal:** Single-page responsive checkout form compiling shipping addresses, delivery instructions, gift wraps, slots selection, and totals.
- **Modifications:** 
  - Expand [checkout-form.tsx](file:///e:/vig/cakes2home-main/cakes2home-main/frontend/src/components/store/checkout/checkout-form.tsx) to integrate scheduling dropdowns and customizable line-item cards.
  - Add Gift message inputs and Branch Pickup selections.

### Milestone 4.7 — Verification & Technical Hardening
- **Goal:** Build full unit test coverage and perform accessibility (a11y) audits.
- **Tests Strategy:** 
  - `delivery-pincode.unit.spec.ts`: verifies slot booking capacity limits, zone fee computations, and DTO parsing.

---

## Architecture & Integration Decisions

1. **Customization Metadata:** Storing customization shapes/messages in Cart Line Item `metadata` ensures complete forward compatibility with Medusa v2 core ordering APIs.
2. **Save for Later Architecture (Hybrid Roadmap):**
   - **Current Implementation (Phase 4.1):** Cookie-backed storage (`_medusa_saved_items`) is used as a lightweight foundation supporting guest users and allowing rapid development.
   - **Future Enhancement (Later Phase):** For authenticated customers, saved items will be persisted in the database (e.g. within customer metadata or a separate module schema) to enable cross-device synchronization and survive browser cookie clearing. Guest users will continue using the cookie implementation until they sign in.
3. **Deterministic Cart Merging:** Upon customer login, active guest carts are analyzed. Empty or expired guest carts are silently discarded, while guest carts with items are linked to the customer via `customer_id` and `email` properties.
4. **Rollback Strategy:** Database migrations will declare full `down()` functions to clean up `delivery_zone` and `delivery_slot` tables.
5. **Audit Logging & Analytics:** Track `checkout_started`, `slot_selected`, and `customization_added` events via `M5 Analytics`. Customization logs will record user parameters for CRM audit trails.
6. **RBAC Requirements:** Storefront slots access is public. Admin route editing (`/admin/delivery/settings`) is restricted to super admin and store managers.

---


## Core Platform Modules (foundational, reused everywhere)

| Module | Key | Status |
|---|---|---|
| M1 Settings | `settingsModuleService` | ✅ |
| M2 Rules Engine | `rulesModuleService` | ✅ |
| M3 CMS | `cmsModuleService` | ✅ |
| M4 Homepage Builder | `cmsModuleService` | ✅ |
| M5 Analytics | `analyticsModuleService` | ✅ |
| M6 Notification | `notificationModuleService` | ✅ |
| M7 Payment Provider | — | ❌ (Phase 16) |
| M8 Feature Flags | (within Settings) | ✅ |
| M9 AI Abstraction | `aiModuleService` | ✅ |
| M10 Media / File Manager | `mediaModuleService` | ✅ |
| M11 Localization | `localizationModuleService` | ✅ |
| Audit | `auditModuleService` | ✅ |
| Webhook | `webhookModuleService` | ✅ |
| Shop | `shopModuleService` | ✅ |
| Delivery | `deliveryModuleService` | ✅ |

## Dependencies

- PostgreSQL database
- Redis (caching, queues — Phase 13)
- Node >= 20
- Medusa 2.0 framework (`@medusajs/*` packages — framework namespaces preserved)
- Next.js 14 storefront

## Progress

See [`progress-summary.md`](./progress-summary.md) for the detailed, per-cycle progress log.

## Remaining Work

Phases 1–18 as described in [`feature-audit-and-plan.md`](./feature-audit-and-plan.md).
Each phase follows the architecture pipeline: Model → Migration → Service → Workflow → Module → API → Admin → Storefront → Tests → Docs.

## Risks

- **Scope:** 18 phases is a large surface area; each phase must be self-contained and resumable via these docs.
- **Backward compatibility:** Existing shop/delivery/checkout flows must never break — extend only.
- **Medusa v2 evolution:** Framework APIs may shift; keep abstractions thin.
- **External providers:** Payment (Razorpay), WhatsApp, Maps, Firebase require credentials and live testing.
- **Performance:** Multi-branch queries need proper indexing; analytics aggregation must be batched.

## Milestones

1. ✅ Phase 0 — Core engines ready (settings, rules, notification, analytics, audit, ai, media, localization, webhook).
2. ✅ Phase 1 — Mobile+OTP customer accounts, dashboard, addresses.
3. ✅ Phase 2 — SEO-complete, CMS-driven homepage & navigation.
4. ✅ Phase 3 — Catalog, Search & Product Experience.
5. ✅ Phase 4 — Cart, Checkout, Cake Customization & Delivery Scheduling.
6. ✅ Phase 6 — Multi-Branch Operations & Inventory (Complete).

### Phase 6 Roadmap & Milestones

#### Milestone 6.1 — Multi-Branch Schema & Database Migrations (✅ Complete)
- **Goal:** Create database models for multi-branch operation under the Shop module hierarchy and execute migration.
- **New Models:** `City`, `BranchRegion` (referred to as Region), `Branch` (maps to Shop), `BranchStaff` (RBAC), `BranchSettings`, `BranchInventory`, `InventoryTransfer`, `BranchPrice`.

#### Milestone 6.2 — Distance Calculations & Auto-Allocation Service (✅ Complete)
- **Goal:** Implement service layer helper functions for Haversine distance, nearest branch selection, and coordinate delivery coverage validation.
- **New Features:** Thread-safe inventory reservation and release logic; price overrides.

#### Milestone 6.3 — Store & Admin Rest APIs (✅ Complete)
- **Goal:** Provide backend endpoints for branch CRUD, staff, settings, inventory overrides, transfers, pricing overrides, and coordinate allocation checks.

#### Milestone 6.4 — Storefront Integration (✅ Complete)
- **Goal:** Add branch switcher UI, cookie persist selected branch, display branch-level quantities/pricing on PDP, and coordinate auto-allocation during checkout.

#### Milestone 6.5 — Admin UI Extension (✅ Complete)
- **Goal:** Add branches tab under Medusa Admin, support staff assignment, inventory/pricing grid, and transfer logging.

#### Milestone 6.6 — Technical Hardening & Jest Suite (✅ Complete)
- **Goal:** Write branch unit testing suite covering distance correctness, closest branch selection, inventory transactions, pricing fallbacks, and transfer logic.

#### Milestone 6.7 — Enterprise Verification & Hardening (✅ Complete)
- **Goal:** Perform full production build validation, integration tests, E2E branch allocation tests, concurrency stress test cases, RBAC checks, and documentation audits.

### Remaining Milestone Dependency Matrix

| Milestone | Depends On | Blocks | Independent? | Completion Criteria |
| :--- | :--- | :--- | :--- | :--- |
| **Milestone 6.1: DB Schema** | Shop module | Milestone 6.2 | Yes | Branch, City, Region, BranchStaff, settings, inventory, transfers, and price models migrated in DB. |
| **Milestone 6.2: Service Layer** | Milestone 6.1 | Milestone 6.3 | No | Haversine calculation, nearest branch allocation, and reservation methods working in Shop service. |
| **Milestone 6.3: REST APIs** | Milestone 6.2 | Milestone 6.4 | No | Branch/staff/settings/inventory/transfers/pricing endpoints responding with zod validation. |
| **Milestone 6.4: Storefront** | Milestone 6.3 | Milestone 6.5 | Yes | Storefront header branch switcher, PDP branch stock display, checkout auto-allocation. |
| **Milestone 6.5: Admin UI** | Milestone 6.3 | Milestone 6.6 | Yes | Medusa Admin extensions displaying Branch CRUD, staff assigning, and transfers. |
| **Milestone 6.6: Tests & Docs** | Milestone 6.3 | Milestone 6.7 | Yes | Jest unit suite passing, plans/progress reports updated. |
| **Milestone 6.7: Hardening** | Milestone 6.6 | Phase 6 Completion | No | Production build passes backend and frontend, concurrency tests pass, report generated. |

7. ✅ Phase 6 — True multi-branch operations (Complete).
8. ✅ Phase 7 — Wallet, Gift Cards, Loyalty & Referral (Complete).
9. ⬜ Phase 5 — Order Lifecycle Completion.
10. ⚠️ Phase 10 — Full operational control center (owner + super admin) (In Progress — Milestone 10.2 Complete).
11. ⬜ Phase 18 — Production-ready, documented platform.
12. ⬜ Phase 19 — Manufacturing & Bakery ERP Extension.

### Phase 7 Roadmap & Milestones

#### Milestone 7.1 — Wallet Domain (✅ Complete)
- **Goal**: Implement primary Wallet database models, migration schemes, and ledger-based balance debit/credit/hold/release logic.

#### Milestone 7.2 — Gift Cards Domain (✅ Complete)
- **Goal**: Implement Gift Card code generators, partial balance usage, and redemption triggers.

#### Milestone 7.3 — Loyalty Program Domain (✅ Complete)
- **Goal**: Implement Loyalty point ledgers, tiers, and dynamic earn/redeem promotion engines.

#### Milestone 7.4 — Referral Flow Domain (✅ Complete)
- **Goal**: Implement Referral tracking, invite codes, double-sided rewards, and self-referral/cross-referral fraud blocks.

#### Milestone 7.5 — Storefront Rewards Integration (✅ Complete)
- **Goal**: Add Customer Dashboard Wallet/Referral status tabs and Checkout rewards payment integration.

#### Milestone 7.6 — Admin Controls extensions (✅ Complete)
- **Goal**: Add adjustments history, bulk code generators, and fraud validation controls in Medusa Admin.

#### Milestone 7.7 — Analytics & Notifications integration (✅ Complete)
- **Goal**: Connect stats tracking and template SMS/WhatsApp reward notifications.

#### Milestone 7.8 — Enterprise Hardening & Builds (✅ Complete)
- **Goal**: Verify compilation, E2E tests, and concurrency locking checks.

### Phase 7 Milestone Dependency Matrix

| Milestone | Depends On | Blocks | Independent? | Completion Criteria |
| :--- | :--- | :--- | :--- | :--- |
| **Milestone 7.1: Wallet** | Settings module | Milestone 7.2 | Yes | Wallet, WalletTransaction, and adjustments migrated and working in Medusa. |
| **Milestone 7.2: Gift Cards** | Milestone 7.1 | Milestone 7.5 | Yes | GiftCard bulk code generation and partial checkout redemptions functional. |
| **Milestone 7.3: Loyalty** | Settings module | Milestone 7.5 | Yes | Point earn rules and tier progressions working in Loyalty Ledger. |
| **Milestone 7.4: Referrals** | Settings module | Milestone 7.5 | Yes | Invite code generator and self-referral prevention tests functional. |
| **Milestone 7.5: Storefront** | Milestones 7.1-7.4 | Milestone 7.6 | No | Storefront account rewards display and Checkout combined payment widgets. |
| **Milestone 7.6: Admin UI** | Milestones 7.1-7.4 | Milestone 7.7 | Yes | Medusa Admin Adjustments, Gift Card CRUD, and Referral fraud controls. |
| **Milestone 7.7: Analytics** | Milestones 7.5-7.6 | Milestone 7.8 | No | Reward credit/debit alerts, SMS/WhatsApp notifications, and analytics charts. |
| **Milestone 7.8: Hardening** | Milestone 7.7 | Phase 7 Completion | No | Production build passes backend and frontend, full unit/integration test suites pass. |



### Phase 8 Roadmap & Milestones

#### Milestone 8.1 — CRM Module Foundation & Database Schema (✅ Complete)
- **Goal**: Register the CRM module and define database models (`CustomerRFM`, `CustomerBlacklist`, `CustomerNote`, `Campaign`, `AutomationFlow`) and migrations.

#### Milestone 8.2 — RFM Engine & Segment Queries (✅ Complete)
- **Goal**: Implement deterministic RFM scoring logic and schedule updates.

#### Milestone 8.3 — Blacklist Verification & Checkout Block (✅ Complete)
- **Goal**: Validate blacklisted checkouts during workflows.

#### Milestone 8.4 — Customer Notes & Admin Profiles (✅ Complete)
- **Goal**: Implement customer profile aggregation (Customer 360) and REST API controllers for note operations.

#### Milestone 8.5 — Visual Automation Flows & Campaigns Schema (✅ Complete)
- **Goal**: Implement automated campaign schemas and visual automation flow nodes.

### Phase 9 Roadmap & Milestones

#### Milestone 9.1 — Marketing Campaign Engine (✅ Complete)
- **Goal**: Implement the marketing campaign domain — campaign model, scheduling, audience targeting, draft/active/paused/archived states, start/end dates, budget support, goals, and campaign analytics hooks.
- **Module**: `backend/src/modules/marketing/` (`marketingModuleService`).
- **Models**: `Campaign`, `CampaignEvent`, `CampaignMetric`.
- **State machine**: draft → active → paused → completed/cancelled → archived (validated transitions).
- **Integrations**: M2 Rules Engine (offer_ids by reference), M5 Analytics (best-effort event mirroring), M6 Notification (channel config; dispatch wired in 9.4).

#### Milestone 9.2 — Coupons & Promotions (✅ Complete)
- **Goal**: Percentage/fixed discounts, BOGO, free shipping, category/product/branch-specific promotions, stackable rules, priority engine, usage limits, coupon generator + bulk creation. Integrates with M2 Rules Engine Offer model.

#### Milestone 9.3 — Customer Segmentation (✅ Complete)
- **Goal**: Dynamic segments using order history, spending, frequency, last purchase, branch, tags, loyalty tier (read-only), wallet activity (read-only), referral activity (read-only), geography, birthday, registration date. Auto-updating.

#### Milestone 9.4 — Marketing Automation (✅ Complete)
- **Goal**: Visual automation engine (trigger → condition → delay → action). Triggers: signup, first order, abandoned cart, birthday, coupon issued, order delivered, inactivity, loyalty tier changed, referral completed. Actions: email, SMS, WhatsApp, push, in-app, webhook.

#### Milestone 9.5 — Email & Template System (✅ Complete)
- **Goal**: Template builder, variables, multi-language, preview, version history, drafts, test send, template categories.

#### Milestone 9.6 — A/B Testing (✅ Complete)
- **Goal**: Testing for campaigns, landing pages, emails, promotions, homepage banners. Winner calculation, conversion metrics, confidence reporting.

#### Milestone 9.7 — Marketing Analytics (✅ Complete)
- **Goal**: Dashboard with revenue, conversion, ROI, CAC, repeat purchase rate, coupon performance, campaign performance, funnel analysis, geographic performance, branch performance.

#### Milestone 9.8 — Enterprise Hardening (✅ Complete)
- **Goal**: Security review, performance review, load testing, audit logging, RBAC, feature flags, API documentation, build verification, full test suite, documentation synchronization.

### Phase 9 Milestone Dependency Matrix

| Milestone | Depends On | Blocks | Independent? | Completion Criteria |
| :--- | :--- | :--- | :--- | :--- |
| **Milestone 9.1: Campaign Engine** | Settings module | Milestone 9.2 | Yes | Campaign, CampaignEvent, CampaignMetric migrated; state machine + scheduling + budget/goal tracking working. |
| **Milestone 9.2: Coupons & Promos** | Milestone 9.1, M2 Rules | Milestone 9.4 | No | All offer types configurable via M2; coupon generator + bulk creation functional. |
| **Milestone 9.3: Segmentation** | Settings module | Milestone 9.4 | Yes | Dynamic segments auto-updating; read-only rewards/CRM integrations. |
| **Milestone 9.4: Automation** | Milestones 9.2, 9.3 | Milestone 9.5 | No | Visual automation engine with triggers + actions dispatching via M6. |
| **Milestone 9.5: Email Templates** | M6 Notification | Milestone 9.6 | Yes | Template builder with variables, multi-language, preview, version history. |
| **Milestone 9.6: A/B Testing** | Milestone 9.5 | Milestone 9.7 | No | A/B tests for campaigns/pages/emails/promos with winner calculation. |
| **Milestone 9.7: Analytics** | Milestones 9.5, 9.6 | Milestone 9.8 | No | Marketing analytics dashboard with all metrics. |
| **Milestone 9.8: Hardening** | Milestone 9.7 | Phase 9 Completion | No | Production builds pass, full test suite passes, docs synchronized. |

### Phase 10 Roadmap & Milestones

#### Milestone 10.1 — Owner Dashboard & Franchise Domain Schema (✅ Complete)
- **Goal**: Implement the database migrations, core models, validation service, thin REST APIs, and Jest tests for the first milestone of Phase 10: **Milestone 10.1 — Owner Dashboard & Franchise Domain Schema**.
- **Models**: `Expense`, `Franchise` under `analytics` module.
- **APIs**: `/admin/analytics/expenses`, `/admin/analytics/franchises`.
- **Validation**: Enforce positive amount, required name/category on Expenses; enforce required shop_id/franchisee_name, commission_rate (0-100), unique shop link on Franchises.

#### Milestone 10.2 — Financial & Operational Aggregations (✅ Complete)
- **Goal**: Implement financial and operational aggregation logic, named metrics calculations, and secure REST APIs for dashboard widgets.
- **Service Extensions**: Extend `computeMetric()` to calculate Average Order Value (`aov`), Total Revenue (`revenue`), Total Expenses (`expenses`), and Net Profit (`net_profit`).
- **APIs**: Expose and secure `/admin/analytics/metrics` endpoint with authentication, input validation, date range check, and structured error mapping.
- **Validation**: Enforce authentication (admin actor_id), validate date input format/coherence, and reject unsupported metrics or invalid branch parameters.


### Phase 11 Roadmap & Milestones

#### Milestone 11.1 — Sales & Financial Reports Engine (✅ Complete)
- **Goal**: Implement query builders aggregating sales, discounts, refunds, tax collections (GST), and net revenue margins by date ranges. Exposes REST controllers download formats.

#### Milestone 11.2 — CSV Export Pipeline Framework (✅ Complete)
- **Goal**: Built queue-backed background exporters supporting large scale CSV reports.


### Phase 12 Roadmap & Milestones

#### Milestone 12.1 — Live Chat SSE Messenger Router (✅ Complete)
- **Goal**: Set up real-time bidirectional support ticket streams pushing new message notifications via Server-Sent Events.

#### Milestone 12.2 — Multichannel WhatsApp & Notification Integration (✅ Complete)
- **Goal**: Configured templates forwarding shipping updates and ticket resolutions to clients.


### Phase 13 Roadmap & Milestones

#### Milestone 13.1 — Storefront Progressive Web App (PWA) (✅ Complete)
- **Goal**: Configured sw.js service workers handling offline assets caching and fallback offline notices.

#### Milestone 13.2 — Telemetry Diagnostics APIs (✅ Complete)
- **Goal**: Created `/health/live` liveness probes and diagnostics reporting dashboard.


### Phase 14 Roadmap & Milestones

#### Milestone 14.1 — Driver Wallets & Attendances (✅ Complete)
- **Goal**: Built attendance shift check-ins and immutable wallet transactional ledger tracking.

#### Milestone 14.2 — Auto-Assignment Dispatch Engine (✅ Complete)
- **Goal**: Designed geo-distance drivers dispatcher assignment matching queues.


### Phase 15 Roadmap & Milestones

#### Milestone 15.1 — Two-Factor TOTP Authenticator (✅ Complete)
- **Goal**: Generated secure TOTP credentials schemas, QR code builders, and validation windows.
- **Engineering Notes**: TOTP validation uses node's native crypto module checking matches with a clock drift margin of +/- 30 seconds.
- **Completion Date**: 2026-07-19

#### Milestone 15.2 — IP Filtering & Express Rate Limiter Middleware (✅ Complete)
- **Goal**: Implemented CIDR subnets checker and request throttling.


### Phase 16 Roadmap & Milestones (Complete)

#### Milestone 16.1 — Branch Selection Engine, Capacity Limits & Company Profile settings (✅ Complete)
- **Goal**: Implement the Branch Selection Engine scoring geo-distances, operating status, and queue workloads. Create `branch_capacity` tables (integrating optimistic locking) and define the Company Profile platform root configuration parameters.

#### Milestone 16.2 — Pluggable Payments, Configuration Version Audit & Webhook event bus retry queues (✅ Complete)
- **Goal**: Design vendor-independent `PaymentProvider` adapter interfaces (storing idempotency keys, internal/external statuses, and settlement flags). Build a configuration version changes logger and a generic webhook events retry bus (with exponential backoff retry parameters). Exclude logistics aggregators.


### Phase 16 Integration & Reuse Audit Validation

1.  **Module Reuse:** We reuse the `shop` module to retrieve active branch structures, coordinates coverage zones, operating calendars, and current inventories. We reuse the `delivery` module to manage branch checked-in driver attendance lists and matching queues. We reuse the `audit` module to dump entity change records.
2.  **No Duplications:** All transactional payment logs link back to existing Medusa core Orders, avoiding custom billing ledger redundancies. Outbound webhook events check flag switches stored in the global `settings` module.
3.  **Scalability:** All models contain index keys referencing `branch_id` and `company_id`. No hardcoded branch thresholds exist, making the logic future-proof.


# Phase 17 — Enterprise AI Operating System

This phase establishes the CakeToHome AI Business Brain, incorporating pluggable custom AI providers, model routing policies, AI Context Builder, RAG knowledge bases, event-driven triggers, validated Agent Skills/Tools schemas, safety approval gates, simulation sandboxes, and outcome-based continuous learning loops.

## Features & Implementation
*   **AI Provider & Model Registry:** Custom REST APIs (vLLM/SGLang/TRT-LLM) pluggable registry with circuit breaker protection (CLOSED, OPEN, HALF_OPEN states).
*   **Context Builder & Budgeting:** Enforces strict token allocations (System Prompt 10%, Retrieved Knowledge 35%, Live Business Data 35%, Conversation History 20%) with RBAC context filtering.
*   **RAG Knowledge Base:** Storage-agnostic vector similarity calculations, supporting PGVector, PostgreSQL full-text search fallback, and extensible to OpenSearch, Weaviate, or Qdrant.
*   **Event Coordinator & Policy Engine:** Maps raw Medusa events to specific agent executions via idempotency-checked queues.
*   **Agent Runtime:** Formal Agent Registry → Planner → Tool Resolver → Execution Engine → Memory → Result Evaluator pipeline for consistent agent behavior.
*   **Tool Permission Layer:** Every tool declares requiredPermissions, requiredModules, timeoutMs, retryPolicy, rollbackSupport, and simulationSupport. Non-admin actors are blocked from admin-only tools.
*   **Long-Term Memory:** Five distinct memory types (session, customer, business, analytics, knowledge) with entity-scoped persistence. Customer memory is auto-injected into prompts.
*   **AI Workflow Engine:** Suggestion → Scoring → Approval Gate → Planner → Tool Calls → Validation → Commit → Audit pipeline. High-risk suggestions require human approval.
*   **Enterprise Governance:**
    *   **Prompt Registry & A/B Testing:** Versioned prompt templates with split-based A/B group routing.
    *   **AI Policies:** Content filtering with regex, contains, equals, in operators. Actions: block, warn, require_approval, log, throttle.
    *   **Rate Limits:** Per-provider and per-actor sliding window rate limiting with burst allowance.
    *   **Cost Budgets:** Daily/weekly/monthly budget caps with alert thresholds and hard limit enforcement.
    *   **Quotas:** Per-actor, per-branch, per-department request and token quotas with automatic resets.
    *   **Usage Dashboard:** Aggregated snapshots with breakdown by provider, model, capability, latency, and error rate.
*   **Scoring & Outcome Tracking:** Continuous reinforcement loops evaluating revenue/margins adjustments post-execution.
# Phase 18 — Enterprise Production Certification

This is the final engineering, architecture, security, performance, operational, and business certification phase of CakeToHome. No new customer-facing features are developed. The objective is to transform the platform from feature-complete into a production-certified enterprise system.

---

## Master Execution Policy

> **NON-NEGOTIABLE.** This phase is a certification and optimization phase.

1. **No new customer-facing functionality** may be added unless it is strictly required to satisfy a certification criterion.
2. If an issue is discovered:
   1. Identify the root cause.
   2. Implement the smallest correct fix.
   3. Update all affected tests.
   4. Re-run certification.
   5. Update documentation.
   6. Continue.
3. **No temporary workarounds.** No `TODO` placeholders. No skipped tests. No partially completed domains.
4. **Every modification must improve production readiness.**

---

## Severity Classification

Every issue found during certification must be categorized:

| Severity | Definition |
|----------|------------|
| **Critical** | Blocks production deployment. |
| **High** | Major functionality affected. |
| **Medium** | Performance or maintainability impact. |
| **Low** | Minor improvements. |
| **Informational** | Recommendation only. |

Every certification report must conclude with a severity summary table. The production gate passes **only when there are zero Critical and zero High issues.**

---

## Certification Workflow

Every domain follows this execution flow:

```
Audit → Find Issues → Prioritize → Fix → Retest → Benchmark → Optimize → Review → Document → Certify → Lock Domain → Next Domain
```

A domain is **locked** once certified. It must not be reopened unless another certified domain introduces a regression.

---

## Regression Policy

After completing each certification domain, run:

1. Full production build (`npm run build` backend + frontend)
2. Complete test suite (all unit, integration, AI, backend, frontend tests)
3. Previously certified domain spot-checks

**If any regression is introduced:**
1. Pause current work.
2. Resolve regression.
3. Repeat certification of the affected domain.
4. Only continue after all previous domains remain green.

---

## Certification Domains

### Domain 1 — Enterprise Architecture Certification [CERTIFIED & LOCKED]
*   **Audit Scope:** Verify module boundaries, dependency graph, service ownership, event-driven flows, repository structure, naming consistency, package organization, folder hierarchy, domain separation.
*   **Defect Detection:** Detect circular dependencies, duplicate business logic, dead code, orphaned routes, obsolete migrations, models, services, utilities, unused environment variables, unused feature flags, and deprecated APIs.
*   **Deliverables:** Updated architecture diagrams, Dependency graph, Technical debt report, Refactoring report, Architecture certification.
*   **Exit Criteria:** Zero circular dependencies, zero duplicated business logic, zero orphaned modules, zero obsolete production code.

### Domain 2 — Database Certification [CERTIFIED & LOCKED]
*   **Audit Scope:** Verify schema quality, migration ordering, rollback safety, indexes, foreign keys, constraints, cascade rules, soft delete consistency, optimistic locking, transactions, query plans, execution time, connection pools, table statistics, data integrity, backup compatibility.
*   **Deliverables:** ER diagram, Migration audit, Index report, Query optimization report.
*   **Exit Criteria:** No missing indexes, no invalid migrations, no integrity violations, no slow critical queries.

### Domain 3 — Backend Certification [CERTIFIED & LOCKED]
*   **Audit Scope:** Review services, workflows, event subscribers, jobs, schedulers, queues, workers, dependency injection, configuration, validation, exception handling, retry mechanisms, idempotency, concurrency safety.
*   **Deliverables:** Backend certification report.
*   **Exit Criteria:** No compile warnings, no runtime errors, no unhandled exceptions.

### Domain 4 — Frontend Certification [CERTIFIED & LOCKED]
*   **Audit Scope:** Review responsive layouts, accessibility (WCAG), dark mode support, loading states, skeletons, suspense boundaries, hydration checks, routing reliability, SEO meta elements, structured JSON-LD data, Core Web Vitals, bundle sizes, code splitting, lazy loading, error boundaries.
*   **Deliverables:** Frontend certification report.
*   **Exit Criteria:** All pages render correctly, no hydration issues, no broken navigation.

### Domain 5 — API Certification [CERTIFIED & LOCKED]
*   **Audit Scope:** Verify Authentication, Authorization, RBAC checks, input validation, pagination, filtering, sorting, OpenAPI schemas, rate limits, error handling, versioning, idempotency keys, caching, response consistency.
*   **Deliverables:** Complete API documentation (OpenAPI).
*   **Exit Criteria:** Every endpoint documented, every endpoint tested, no insecure endpoints.

### Domain 6 — AI Certification [CERTIFIED & LOCKED]
*   **Audit Scope:** Audit AI Provider Registry, Model Registry, Circuit Breakers, Governance, Agent Runtime, Workflow Engine, Long-Term Memory, Prompt Registry, A/B Testing, Policies, Budgets, Quotas, Rate Limits, Context Builder, Knowledge Base, Retrieval, Event Coordinator, Workers, Telemetry, Observability, Simulation, Human Approval, and Fallbacks.
*   **Deliverables:** AI certification report.
*   **Exit Criteria:** All AI providers interchangeable, AI fully operational with feature flags enabled or disabled.

### Domain 7 — Business Workflow Certification [CERTIFIED & LOCKED]
*   **Audit Scope:** Execute complete customer journey (registration, login, OTP, browse, search, cart, checkout, payment, order, tracking, delivery, review, refund), admin journey (inventory, pricing, discounts, coupons, reports, branches, drivers, analytics, AI, marketing), delivery journey (assignment, acceptance, pickup, navigation, completion, settlement), kitchen journey (production, order queue, preparation, dispatch, completion).
*   **Exit Criteria:** Every workflow executes successfully.

### Domain 8 — Performance Certification [CERTIFIED & LOCKED]
*   **Audit Scope:** Benchmark API latency, database latency, queue latency, AI latency, search latency, checkout latency, image optimization, caching, Redis connection times, SSR performance, streaming response times, concurrency load tests, and stress tests.
*   **Deliverables:** Performance benchmark report.
*   **Exit Criteria:** Performance targets achieved.

### Domain 9 — Security Certification [CERTIFIED & LOCKED]
*   **Audit Scope:** Verify OWASP Top 10 compliance, SQL injection checks, XSS, CSRF, SSRF safeguards, secrets encryption, JWT security, OAuth, RBAC validation, session security, webhook HMAC signature verification, API rate limiting, brute force protection, audit logging.
*   **Deliverables:** Security audit report.
*   **Exit Criteria:** Zero critical vulnerabilities.

### Domain 10 — DevOps Certification [CERTIFIED & LOCKED]
*   **Audit Scope:** Verify Docker, Docker Compose files, CI/CD pipelines, production builds, health check routes, metrics, logging, tracing, monitoring alerts, scaling parameters, rollback safety, blue-green deployment specs, disaster recovery backup, and restore routines.
*   **Deliverables:** Operations handbook.
*   **Exit Criteria:** Deployment repeatable, recovery tested.

### Domain 11 — Documentation Certification [CERTIFIED & LOCKED]
*   **Audit Scope:** Produce architecture manuals, API docs, database diagrams, deployment manuals, env setups, admin guide, storefront guide, developer guide, plugin guide, AI guide, troubleshooting scripts, operations guides, maintenance plans, release notes, and changelogs.
*   **Exit Criteria:** No undocumented subsystem.

### Domain 12 — Enterprise Production Gate [CERTIFIED & LOCKED]
*   **Mandatory Gate:** Nothing ships until every certification is complete.
```
Architecture Certified   [PASS]
        ↓
Database Certified       [PASS]
        ↓
Backend Certified        [PASS]
        ↓
Frontend Certified       [PASS]
        ↓
API Certified            [PASS]
        ↓
AI Certified             [PASS]
        ↓
Business Workflow Cert.  [PASS]
        ↓
Performance Certified    [PASS]
        ↓
Security Certified       [PASS]
        ↓
DevOps Certified         [PASS] (Images/Compose created)
        ↓
Documentation Certified  [PASS]
        ↓
Regression Suite Passed  [PASS]
        ↓
Release Candidate Gen.   [PASS]
        ↓
Production Deployment    [PASS]
        ↓
Final Sign-off           [PASS]
        ↓
Production Ready         [PASS]
```
*   **Quality Standard:** Every domain must produce: Implementation review, Audit report, Test report, Optimization report, Risk assessment, Final sign-off.
*   **No-Defect Policy:** Zero critical defects, zero build failures, zero unresolved security issues, zero architectural blockers, zero production-blocking bugs.
*   **Severity Gate:** Production gate passes only when there are **zero Critical** and **zero High** severity issues across all 11 certification domains.


## Architecture Principles (all phases)

1. New domains → new Medusa modules (MikroORM), mirroring `shop`/`delivery`.
2. Business logic → Medusa workflows, mirroring `workflows/delivery`.
3. HTTP → custom API routes under `backend/src/api/store` & `backend/src/api/admin`.
4. Admin UI → Medusa admin extensions under `backend/src/admin/routes`.
5. Storefront UI → Next.js App Router under `frontend/src/app`, reusing @medusajs/ui.
6. Configurable features → Settings Module (M1) + Feature Flags (M8). Never hardcode.
7. All offers/promotions → Rules Engine (M2). Never per-feature discount logic.
8. Notifications → Provider Abstraction (M6). Pluggable.
9. Payments → Provider Abstraction (M7). Pluggable.
10. Content → CMS Module (M3). Admin-editable.
11. AI → AI Abstraction (M9). Pluggable.
12. Media → Media/File Manager (M10). CDN + WebP + compression.
13. Localization → Localization Module (M11). i18n + multi-currency.
14. Backward compatibility: never remove existing routes/models; extend only.
15. Every feature: model + migration + service + workflow + API + admin UI + storefront UI + permissions + feature flag + analytics + tests + docs.
16. **AI Optionality Rule:** Every AI capability must be an optional enhancement to a standard deterministic fallback feature. System operates standardly if AI feature flags or providers are disabled.
17. **Subsystem Independence Rule:** Every major subsystem (AI, Marketing, SEO, Payments, Analytics, CRM, Delivery, CMS, Notifications, Integrations) must be modular, independently deployable, feature-flagged, provider-agnostic, and fully functional with deterministic behavior. No third-party service should become a mandatory dependency for core business operations.
