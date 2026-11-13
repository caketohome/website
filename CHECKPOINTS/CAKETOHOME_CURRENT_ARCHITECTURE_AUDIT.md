# CAKETOHOME — CURRENT ARCHITECTURE AUDIT & GATE 0 BASELINE REPORT
## Comprehensive Repository Inspection, Subsystem Mapping, Dependency Analysis, Risk Register & Ordered Execution Plan

- **Platform:** CakeToHome E-Commerce Platform (`https://cakestohome.com/`)
- **Master Roadmap Authority:** `docs/20-roadmap.md`
- **Audit Gate:** Gate 0 — Repository Baseline & Architecture Audit
- **Authoritative Date:** 2026-11-10
- **Auditor Roles:** Principal Software Architect, Full-Stack Engineer, Database Architect, Security Engineer, DevOps Engineer, QA Automation Engineer
- **Operating Standards:** Zero vibe coding, zero mock production shortcuts, PostgreSQL as sole source of truth, inspect before changing anything

---

## 1. Repository Structure & Git Verification

### 1.1 Git Commit Hierarchy & Working Tree State
- **Current Branch:** `main`
- **HEAD Commit:** `433182f` (`fix(phase-9): finalize forensic audit, enforce savepoint transaction isolation, deterministic webhook deduplication, gates a-i evaluation & roadmap synchronization`)
- **Commit History Chain Verified:**
  ```
  433182f (HEAD -> main) fix(phase-9): finalize forensic audit, enforce savepoint transaction isolation...
  ed545f3 fix(phase-9): resolve order_not_found, enforce gate e live blocker, sanitize marketing claims...
  fc9c98d feat(phase-9): complete platform integration, cms, 12 legal policies, razorpay-only checkout...
  c624037 feat(cms): complete Phase 6.2 database-backed CMS, visual page builder & storefront sync
  cebb4d6 fix(storefront): restore approved blue visual identity and coordinated deep-blue footer
  1d48235 fix(storefront): restore missing product catalog, eliminate default.tsx routing conflict...
  ```
- **Working Tree:** Clean (zero uncommitted code modifications; untracked logs and scratch testing tools isolated in `scratch/`).

### 1.2 Technology Stack & Subsystems
- **Frontend Runtime:** Next.js 14.1.4 App Router (`frontend/`), React 18, TypeScript 5, Tailwind CSS with approved brand palette (`#2563EB`, `#1E3A8A`, `#DBEAFE`, `#0F172A`, `#F8FAFC`).
- **Backend / API Engine:** Next.js App Router edge and route handlers (`frontend/src/app/api/`), Medusa.js v2 commerce core (`backend/`), unified domain services (`frontend/src/lib/services/`).
- **Database Engine:** PostgreSQL 16.14 Daemon running on `127.0.0.1:5433` (Data directory: `cakes2home-main/cakes2home-main/.isolated-pg-data`).
  - Active Operational Target: `cth_rehearsal_phase5`
  - Protected Read-Only Historical Baseline: `cth_test`
- **Active Payment Gateway:** Razorpay Standard Web Checkout (`checkout.js`), AES-256-GCM envelope encryption at rest, HMAC-SHA256 constant-time verification.
- **Decommissioned Payment Gateway:** Cashfree (Permanently decommissioned on active routes returning HTTP 410 `CASHFREE_DECOMMISSIONED`; 35 historical rows preserved immutable).

---

## 2. Database Schema & Migration Inventory

An exhaustive schema audit of `cth_rehearsal_phase5` cataloged exactly **82 public tables**:

### 2.1 Core Relational Domains
1. **Catalog & Merchandising:**
   - `public.product` (26 canonical products: cakes, pastries, cupcakes, fresh flowers, and accessories).
   - `public.product_variant` (26 variants mapped 1:1 with base products).
   - `public.variant_option` (Weight, flavor, and size options).
   - `public.product_review` (Customer reviews and ratings).
2. **Multi-Store & Branch Operations:**
   - `public.branch` (6 operational kitchen and partner hubs: `br_indiranagar_01`, `br_mumbai_03`, `br_partner_04`, `br_unverified_02`, `br_no_seller_05`, `br_whitefield_06`).
   - `public.branch_inventory` (156 inventory rows: exactly 26 items per branch with separate `quantity` and `reserved` counts).
   - `public.city` & `public.delivery_zone` (Geographic coverage and delivery boundaries).
3. **Customers & Accounts:**
   - `public.customer` (Customer account identity, email, phone, metadata).
   - `public.customer_address` (Saved customer delivery addresses with ownership references).
   - `public.customer_favorite` (Saved wishlist items).
   - `public.customer_notification_queue` (Queued notifications).
   - `public.profiles` (Authentication profiles and credentials).
4. **Orders & Deliveries:**
   - `public.order` (204 orders; tracks `status`, `payment_status`, `payment_method`, `delivery_status`, `metadata`).
   - `public.order_item` & `public.order_line_item` (Snapshot line items with pricing, HSN, and GST rates).
   - `public.order_status_history` (Audit log of state transitions).
   - `public.delivery` & `public.delivery_partner` (Driver assignments and status).
   - `public.kot_tickets` (Kitchen Order Tickets for made-to-order bakery items).
5. **Payments & Cashfree Preservation:**
   - `public.payment_gateway_config` (Active gateway configuration; Razorpay in TEST mode).
   - `public.payment_transaction` (125 transactions total; exactly 35 immutable Cashfree transactions preserved; 44 Razorpay transactions).
   - `public.payment_refund` (5 logged refunds).
   - `public.payment_webhook_log` & `public.payment_webhook_event` (Idempotent webhook ledger).
   - `public.cashfree_settlement_batch`, `public.gateway_payout_batch`, `public.gateway_settlement_order` (Historical settlement logs).
6. **Double-Entry General Ledger:**
   - `public.accounting_account` (109 statutory chart of accounts).
   - `public.accounting_voucher` (56 accounting vouchers).
   - `public.accounting_journal_entry` (49 journal entries).
   - `public.accounting_journal_line` (107 journal lines; strictly balanced: $\sum \text{Dr} = ₹1,356,673.40 \equiv \sum \text{Cr} = ₹1,356,673.40$, Net Difference = $₹0.00$, Suspense Account `1119` = $₹0.00$).
7. **Content Management System (CMS):**
   - `public.cms_page` (27 published pages, including all 12 statutory legal policy pages).
   - `public.cms_revision` (13 immutable layout snapshots).
   - `public.cms_block`, `public.cms_homepage_section`, `public.cms_navigation`, `public.cms_theme_setting`, `public.cms_redirect`.

---

## 3. Subsystem Dependency & Root-Cause Mapping

### 3.1 Workstream M3 — Cross-Store / Franchise Product-Sharing Panel
- **Current Discovery:**
  - `SharedInventoryService` (`frontend/src/lib/services/shared-inventory.service.ts`) and `SharedInventoryRepository` (`frontend/src/lib/repositories/shared-inventory.repository.ts`).
  - Active UI references:
    - Tab `shared_inventory` in `frontend/src/components/dashboard/admin/admin-tabs.tsx`.
    - Sidebar link in `frontend/src/components/admin/AdminSidebar.tsx` ("🎂 Shared Inventory").
    - Dynamic panel loader `SharedInventoryPanel` in `frontend/src/app/dashboard/page.tsx`.
    - Component `frontend/src/components/dashboard/admin/shared-inventory-panel.tsx`.
  - Active API endpoints in `frontend/src/app/api/v1/[...path]/route.ts`:
    - `GET inventory/shared`
    - `POST inventory/shared/reserve`
    - `POST inventory/shared/release`
    - `POST inventory/shared/adjust`
    - Order confirmation hook calling `SharedInventoryService.confirmOrderReservation(ord.id)`.
- **Root Cause & Scope of Removal:**
  - The shared inventory panel was an unapproved, parallel inventory prototype that assumed a single shared central pool rather than independent store inventories.
  - In PostgreSQL, the table `shared_inventory` does not even exist in `cth_rehearsal_phase5` (all real inventory operations use `public.branch_inventory`).
  - **Required Action:** Safely remove the UI tab, sidebar item, dynamic loader, panel component, and `/inventory/shared/*` API routes, and disconnect the order confirmation hook. Preserve all historical sales and inventory audit records. Explicitly exclude IBTO, cross-store movements, and franchise royalty engines.

### 3.2 Workstream M2 — Shared Master Catalogue & Independent Store Inventory
- **Current Discovery:**
  - `public.product` and `public.product_variant` store canonical master definitions (26 items).
  - `public.branch_inventory` stores store-specific quantities (`quantity`, `reserved`) for each `branch_id`.
  - `ProductRepository` queries `public.product` globally, but currently lacks store-level stock filtering and store-specific price overrides.
- **Root Cause & Remediation:**
  - Catalog browsing currently displays global product availability without scoping to the customer's selected/nearest branch.
  - **Required Action:** Ensure canonical master product definitions remain shared, while store stock (`branch_inventory`) and store pricing are isolated per store. Enforce nearest-store eligibility in cart and checkout revalidation, with atomic row-locking to prevent overselling or cross-store stock leakage.

### 3.3 Workstream M4 — Customer Profiles & Purchase History
- **Current Discovery:**
  - Frontend routes exist under `frontend/src/app/account/` (`page.tsx`, `orders/page.tsx`, `orders/[id]/page.tsx`, `addresses/page.tsx`).
  - Backend APIs exist under `frontend/src/app/api/customer/` (`profile/route.ts`, `orders/route.ts`).
  - In `your-order/page.tsx`, fallback strings were used when order data was incomplete.
- **Root Cause & Remediation:**
  - Customer profile and purchase history pages have inconsistent server-side session ownership checks (potential IDOR risk).
  - Address deletion/addition needs strict customer ownership enforcement.
  - Order details page must display real database items, statutory taxes, delivery slot, payment status, and a valid re-order flow that re-validates stock and pricing.

### 3.4 Workstream M5 — Website-Based Delivery Driver Panel & Mandatory OTP
- **Current Discovery:**
  - Existing website driver route: `frontend/src/app/dashboard/delivery-partner/page.tsx`.
  - Driver UI components: `frontend/src/components/dashboard/delivery-partner/`.
  - OTP fields: `pickup_otp` and `delivery_otp` exist in `order.metadata` and `order` table.
  - Verification API: `ApiEngine.verifyCustomerOtpBackend`.
- **Architectural Mandate:**
  - **NO separate mobile app, NO native driver application, NO separate standalone platform.** Drivers log in through the existing website.
  - Delivery OTP must be mandatory, single-use, cryptographically secure (e.g. 4-to-6 digits), rate-limited, and validated strictly on the server.
  - Drivers must NEVER see the customer delivery OTP on the driver panel or in driver APIs. The OTP is delivered strictly to the customer. Delivery completion requires atomic OTP verification and state transition.

### 3.5 Workstream M6 — Full-Platform Security Assessment & Penetration Testing
- **Current Discovery:**
  - OWASP Top 10 defenses partially implemented in Phase 9 (AES-256-GCM envelope encryption for payment keys, parameterized SQL, constant-time HMAC verification).
  - Multi-role authorization boundaries (Super Admin, Admin, Branch Manager, Driver, Customer) need comprehensive IDOR, BOLA, and privilege escalation auditing across all 57+ API routes.
  - Stored secrets and connection strings must be audited and rotated.

### 3.6 Performance Engineering (Gate 7)
- **Current Discovery:**
  - Next.js 14 App Router cold compilation latency on first page load (~60s on cold start) due to large dynamic route bundles.
  - Potential unindexed foreign key lookups in `order_line_item`, `accounting_journal_line`, and `branch_inventory`.
- **Plan:** Measure baselines, identify slow queries via `EXPLAIN ANALYZE`, add targeted PostgreSQL indexes, optimize expensive joins, and benchmark before/after latency.

### 3.7 Workstream M1 — Meta Pixel & Conversions API (CAPI) Integration
- **Current Discovery:**
  - Zero existing Meta Pixel code in `frontend/src/`.
  - Prerequisite: Awaiting user-supplied Meta Pixel ID in IDE environment (`NEXT_PUBLIC_META_PIXEL_ID`).
  - Architecture: Client-side `fbq` script for standard events (`PageView`, `ViewContent`, `AddToCart`, `InitiateCheckout`) + Server-side Conversions API (`Graph API /events`) on verified `paid` orders with consistent `event_id` deduplication. Token strictly kept server-side.

---

## 4. Comprehensive Risk Register

| Risk ID | Severity | Category | Risk Description | Owner / Action Required | Mitigation / Enforcement |
| :---: | :---: | :---: | :--- | :--- | :--- |
| **RSK-01** | **HIGH** | Security / Credential | Plaintext PostgreSQL connection string was cited in previous handover text. | Security Engineer: Rotate password immediately in Gate 1. | Rotate `cth_test_user` password in PostgreSQL; update `.env.local` without committing; verify old password fails. |
| **RSK-02** | **CRITICAL** | Statutory / Compliance | Discrepancy between Kerala Proprietorship (State 32) and Karnataka Private Limited (State 29) unresolved. | Corporate Management: Complete business KYC. | **Enforce Release Gate E**: Keep server guard HTTP 403 `LIVE_PAYMENT_ACTIVATION_BLOCKED` and UI toggle locked. |
| **RSK-03** | **HIGH** | Concurrency / Integrity | Concurrent checkout orders could oversell limited physical accessory stock in `branch_inventory`. | Database Architect: Row-level locking. | Use `SELECT ... FOR UPDATE` on `branch_inventory` during reservation and checkout. |
| **RSK-04** | **HIGH** | Security / Authorization | Potential IDOR vulnerability in customer order details and address endpoints if ownership is unvalidated. | Full-Stack Engineer: Ownership validation. | Enforce `WHERE customer_id = $session.user_id` on all customer profile, address, and order queries. |
| **RSK-05** | **MEDIUM** | Security / Fraud | Driver delivery OTP could be brute-forced or replayed if rate limits and single-use guards are weak. | Security Engineer: Rate-limiting & state machine. | Enforce maximum 3 failed attempts, 15-minute expiry, and atomic single-use status transition. |
| **RSK-06** | **MEDIUM** | Marketing / Integrity | Firing Meta `Purchase` events on unverified or failed checkouts would skew ad campaign optimization. | Analytics Engineer: Server-side event gate. | Emit `Purchase` strictly after HMAC verification and database order confirmation. |

---

## 5. Ordered Implementation Plan (Gates 0 Through 9)

```
[Gate 0: Architecture Baseline & Audit] ✅ COMPLETED
       │
       ▼
[Gate 1: Phase 9 Close-Out & Credential Rotation]
  - Rotate database password; verify old fails, new succeeds
  - Verify Razorpay Test Mode transactions & HMAC verification
  - Verify Cashfree decommissioned (HTTP 410, 35 rows intact)
  - Verify Gate E Live Blocker remains enforced
       │
       ▼
[Gate 2: M3 Cross-Store Functionality Removal]
  - Remove SharedInventoryPanel UI, AdminSidebar tab, and /inventory/shared/* APIs
  - Disconnect order confirmation shared-inventory hook
  - Zero destructive DB drops; historical sales & inventory preserved
       │
       ▼
[Gate 3: M2 Master Catalogue & Independent Store Inventory]
  - Shared master product catalogue (public.product)
  - Store-isolated inventory & pricing (public.branch_inventory)
  - Nearest eligible store resolution & concurrency row-locking
       │
       ▼
[Gate 4: M4 Customer Experience Remediation]
  - Customer identity & strict session ownership (anti-IDOR)
  - Address book management & purchase history from real DB
  - Order details timeline, invoice access & safe reorder flow
       │
       ▼
[Gate 5: M5 Website Delivery Driver Panel & OTP]
  - Driver login via existing website (NO separate app/PWA)
  - Driver assigned order list; customer delivery OTP hidden from driver
  - Mandatory, single-use, rate-limited customer OTP verification
       │
       ▼
[Gate 6: M6 Full-Platform Security Assessment]
  - OWASP Top 10 & API Top 10 penetration testing
  - BOLA/IDOR, XSS, CSRF, SQLi, privilege escalation auditing
  - Remediation & re-testing of confirmed findings
       │
       ▼
[Gate 7: Performance Engineering]
  - Baseline latency measurement across storefront, checkout, and DB
  - Targeted PostgreSQL indexes & query plan optimization
  - Before/after metrics documentation
       │
       ▼
[Gate 8: M1 Meta Pixel & Conversions API Integration]
  - Client-side Pixel + Server-side CAPI with event deduplication
  - Real database purchase data; tokens isolated server-side
  - Await user-supplied Pixel ID in IDE configuration
       │
       ▼
[Gate 9: Final Integrated Release Assessment]
  - Full cross-platform regression testing
  - Final Release Readiness Report with explicit Live Payment lock
```

**Gate 0 is hereby officially certified, approved, and locked. Implementation begins with Gate 1.**

