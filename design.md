# 🎂 CakeToHome Platform Architecture & Design Specification (design.md)

This document describes the **system architecture, design patterns, module definitions, and data-flow specifications** for the CakeToHome gourmet artisanal bakery commerce and operations platform.

---

## 🏛️ 1. High-Level System Architecture

CakeToHome is engineered as a decoupled, multi-sided commerce platform containing two main applications: a high-performance customer-facing **Next.js 14 Storefront & BFF**, and a headless **Medusa v2 Core Commerce Engine** backed by PostgreSQL and Redis.

```mermaid
graph TD
    %% Frontend Subsystem
    subgraph Frontend [Next.js 14 Storefront / BFF]
        SF[Storefront UI Pages / App Router]
        Dash[Multi-Role Control Dashboards]
        Client[API Client abstraction]
        BFF[BFF Proxy Router: api/v1/[...path]/route.ts]
        Engine[ApiEngine: Local JSON Fallback DB]
    end

    %% Backend Subsystem
    subgraph Backend [Medusa v2 Backend Engine]
        API[API Endpoints: /api/v1/*]
        WF[Medusa Workflows: Orchestrated Actions]
        Modules[22 Custom Medusa Modules]
        Core[Medusa Core Services]
    end

    %% Database & Queue
    subgraph Storage [Infrastructure Layer]
        DB[(PostgreSQL Database)]
        Cache[(Redis Cache & Event Bus)]
    end

    %% Flow lines
    SF --> Client
    Dash --> Client
    Client --> BFF
    
    %% Dual-routing in BFF Proxy
    BFF -- "Online: Proxy Requests" --> API
    BFF -- "Offline: Fallback Mock" --> Engine
    
    API --> WF
    API --> Modules
    Core --> Modules
    Modules --> DB
    WF --> Cache
```

### Key Architectural Concepts
1. **Frontend-Backend Decoupling**: The Next.js storefront handles rendering, page-speed optimizations, dynamic search routing, SEO meta tagging, and conversion rate optimizations (CRO). It acts independently from the underlying commerce server.
2. **Backend for Frontend (BFF) Proxy & Resilient Fallback**: 
   - Requests made by the frontend are routed to the Next.js BFF (`/api/v1/[...path]/route.ts`).
   - If the Medusa v2 backend is online and reachable, the BFF proxies all requests directly to the backend (`http://localhost:9000`).
   - If the backend is down or undergoing maintenance, the BFF intercepts the requests and routes them to a local JSON-based mock database engine (**`ApiEngine`**). This design guarantees storefront functionality and UI preview capabilities even with zero backend setup.
3. **Medusa v2 Custom Module System**: The backend uses Medusa 2.0 framework modular extension pattern. Core services (like cart, promotions, fulfillment) are coupled with 22 custom business-logic modules mapping to specific DB tables managed via Mikro-ORM.

---

## 🗂️ 2. Project Directory Organization

The codebase is organized as a monorepo containing distinct directories for frontend UI logic and backend server logic:

```
cakes2home/
├── backend/                              # Medusa v2 REST API Engine
│   ├── medusa-config.ts                  # Medusa plugin & module configuration
│   ├── src/
│   │   ├── admin/                        # Admin panel customization UI extensions
│   │   ├── api/                          # HTTP controllers and endpoints
│   │   │   ├── admin/                    # Admin-only restricted API endpoints (28 groups)
│   │   │   └── store/                    # Storefront API endpoints (24 groups)
│   │   ├── jobs/                         # Scheduled cron events & queues
│   │   ├── links/                        # Medusa module-to-module soft links
│   │   ├── modules/                      # 22 Custom Business Modules
│   │   │   ├── shop/                     # Branch, capacity, and city models
│   │   │   ├── delivery/                 # Fleet registers, geo-zones, and drivers
│   │   │   ├── catalog/                  # Cake customizers, dietary flags, reviews
│   │   │   ├── rewards/                  # Customer wallets, referrals, loyalty ledger
│   │   │   └── order-lifecycle/          # Order progression tracker & live statuses
│   │   └── workflows/                    # Multi-step transactional workflows
└── frontend/                             # Next.js 14 App Router Storefront
    ├── src/
    │   ├── app/                          # Page routing files
    │   │   ├── (store)/                  # Customer storefront layouts & pages
    │   │   ├── dashboard/                # Dashboards hub (Admin, Shop, Delivery Partner)
    │   │   ├── account/                  # Customer profiles & wallet ledgers
    │   │   └── api/                      # Next.js BFF endpoints (v1 proxy)
    │   ├── components/                   # Shared React UI widgets
    │   │   ├── dashboard/                # Super Admin 15-tab panels & widgets
    │   │   └── store/                    # PDP customizers, cart drawers, AI assistant
    │   └── lib/
    │       ├── api-client.ts             # Clean SDK client for making REST calls
    │       └── api-engine.ts             # Local JSON engine fallback definitions
```

---

## 🛡️ 3. Core Database Models & Modules

Medusa v2 modules run on **Mikro-ORM** mapping directly to **PostgreSQL**. Below are the primary modules and their schema structures:

### 3.1 `shopModuleService` (Branches & Capacities)
Manages physical bakery storefronts, operating zones, and production limits.
*   **`Branch`**: CUID-based primary key, branch name, address, geo-coordinates (`lat`, `lng`), contact info, FSSAI registration details, and operational status (`is_open`).
*   **`BranchSettings`**: Delivery radius, working hours, maximum orders limit, and minimum order values.
*   **`BranchCapacity`**: Defines hourly order slots and limit values to prevent kitchen overload.
*   **`SlotReservation`**: Locks slot capacities temporarily during the customer checkout sequence.
*   **`BranchInventory`**: Maps physical product stock count specifically per branch.

### 3.2 `deliveryModuleService` (Fleet & Zones)
Manages delivery partner profiles, geographical zones, and dispatch logistics.
*   **`DeliveryZone`**: Serviceable regions containing a list of target pincodes, base delivery fees, and minimum cart amounts for free shipping.
*   **`DeliveryPartner`**: Registered driver profiles, license verification statuses, vehicle class, active shift status, and current GPS coordinates.
*   **`DeliveryJob`**: Connects a Medusa order to a delivery partner with tracking states (`PENDING`, `CLAIMED`, `PICKED_UP`, `DELIVERED`), delivery SLA times, and commission details.
*   **`DriverWallet` / `DriverTransaction`**: Ledgers tracking driver earnings, payout releases, and customer tips.

### 3.3 `catalogModuleService` (Gourmet Cake Extensions)
Extends the standard Medusa core product entity with rich metadata required for cake commerce.
*   **`ProductMeta`**: Attaches custom attributes to the core `product_id` such as dietary flags (`eggless`, `sugar_free`, `gluten_free`, `vegan`), allergens checklist, FSSAI display license, shelf life, and custom options config.
*   **`ProductReview`**: Custom ratings and product review moderation statuses (`pending`, `approved`, `rejected`), along with owner response tracking.
*   **`PimCategory`**: Custom hierarchy category records containing SEO descriptions, branch availability arrays, and media assets.

### 3.4 `rewardsModuleService` (Wallets, Referrals, & Loyalty)
Drives conversion and retention through automated financial incentives.
*   **`Wallet` / `WalletTransaction`**: Customer virtual account ledger for credits (refunds, marketing cashbacks) and debits (purchases).
*   **`LoyaltyLedger`**: Tracks points accrual and redemption events based on configurable loyalty rules.
*   **`GiftCard`**: Code validations, purchase limits, and active balance ledger.
*   **`Referral`**: Relates referrers and referees, tracking qualifying orders and rewards triggers.

### 3.5 `orderLifecycleModuleService` (Workflows & Pipelines)
Manages the long-running multi-state kitchen and fleet coordination process.
*   **State Machine Transitions**:
    ```text
    PLACED ──► ACCEPTED (Shop) ──► PREPARING ──► READY FOR DISPATCH ──► CLAIMED (Driver) ──► EN ROUTE ──► DELIVERED
    ```
*   **`OrderLifecycleEvent`**: Captures timestamp audits for each state transition, reporting real-time SLAs and delay metrics to the admin panel.

---

## ⚡ 4. Frontend Design System & UI Architecture

### Visual Branding Assets
*   **Color Palette**: Modern dark mode tailored with luxury bakery branding.
    *   *Primary*: Gold Amber (`#f59e0b` / `amber-500`) representing warm bakery accents.
    *   *Secondary*: Emerald Green (`#10b981` / `emerald-500`) for success alerts and open statuses.
    *   *Base Background*: Charcoal Slate (`#0f172a` / `slate-900`) for a premium, sleek night-mode UI.
*   **Component Base**: `@medusajs/ui` presets configured alongside tailwind styles to guarantee consistent inputs, modals, select boxes, and banners.
*   **A/B Split Testing & Personalization**: Integrated widgets capable of rendering different banner variations, adjusting price thresholds, and logging views to determine winner options automatically.

### Admin Dashboards Hub (`/dashboard`)
The administrative panel uses a unified role-switching gateway with **15 interactive tabs** for Super Administrators:
1.  **Overview**: System operations telemetry (DB status, cache hits, endpoint response delays).
2.  **AI Command Center**: Core hub for automated copy generation, campaign drafting, and demand forecasting.
3.  **Orders**: Central queue tracking customer orders and routing.
4.  **Catalog**: Master list containing product details, dietary indicators, and options.
5.  **Branches**: Directory listing bakery locations and settings.
6.  **Delivery**: Map visualizations and driver lists.
7.  **Customers**: CRM listings.
8.  **Marketing**: Promotions and offer configurations.
9.  **SEO & Digital**: Live Google search preview cards and tracking pixel codes (GA4, Facebook Pixel).
10. **A/B Testing**: Configures split tests and details statistical models.
11. **Messaging & Auto**: Triggers automated templates (WhatsApp Cloud API, Email, Web Push).
12. **Rewards**: Wallets, referral metrics, and loyalty settings.
13. **Content**: CMS blocks and visual page builders.
14. **Analytics**: Revenue dashboards.
15. **Settings**: Admin users, roles, and security details.

---

## 🔄 5. Key Business & Integration Workflows

### 5.1 The Checkout & Preparation Pipeline
1.  **Pincode & Zone Validation**: The storefront checks `deliveryModuleService` to determine whether the customer's pincode lies in an active `DeliveryZone` and maps it to a serving `Branch`.
2.  **Product Customization**: The customer selects cake weight (kg), eggless toggle, custom banner text, and books a specific `DeliverySlot`.
3.  **Idempotent Payment**: Cart submits checkout forms with an `Idempotency-Key` to verify transaction processing (via Razorpay or cash) without double charging.
4.  **Kitchen Dispatch**: The branch kitchen receives a notification. Once accepted, preparation moves to `PREPARING`.
5.  **Driver Matching**: The system triggers driver dispatch. When a delivery partner claims the route via the driver app dashboard, the state transitions to `CLAIMED` and eventually `EN ROUTE`.

### 5.2 Transactional Outbox Event Pattern
To prevent distributed transaction failures, all key backend occurrences (e.g. `OrderCreated`, `InventoryReserved`) follow the **Outbox Pattern**:
1.  The event payload is written directly to the `OutboxEvent` table *inside* the active SQL transaction.
2.  An asynchronous publisher processes the record and sends it to the Redis Event Bus (BullMQ).
3.  Subscribers listen to the event and execute side-effects (e.g. messaging, analytics logs) without delaying the HTTP thread.

---

## 🔒 6. Security, Compliance, & Performance

*   **Stateless Authentication**: High-security session tracking using HttpOnly, SameSite=Strict cookies containing signed JWTs using the `jose` library. Support for instant OTP login verification.
*   **Role-Based Access Control (RBAC)**: Secure route middleware protecting endpoints based on distinct user roles: `Customer`, `Shop Manager`, `Delivery Partner`, and `Super Admin`.
*   **Database Versioning & Pessimistic Locks**: Inventory levels utilize version tokens (`@version` column) for optimistic concurrency safety during simultaneous checkout surges, preventing negative stock limits.
*   **API Performance Caching**: Short TTL (3s) read-only caching mechanisms on heavy store routes (`store/products`) to prevent server overload under viral load conditions.
