# CakeToHome Complete Test File Inventory

## Executive Overview
This document provides an exhaustive, granular inventory of every test file, test suite, verification script, and benchmark runner across the CakeToHome repository.

---

## 1. Test Architecture & Runner Summary

```
Total Test & Verification Files: 195+
├── Frontend E2E / Integration Scripts: 102 (frontend/scripts/)
├── Root Integration & Diagnostic Scripts: 45 (scripts/)
├── Backend Medusa Module Unit / Spec Tests: 34 (backend/src/modules/**/__tests__/)
├── Apps/API Architecture & Domain Specs: 9 (apps/api/src/**/__tests__/)
└── Frontend Playwright Browser Specs: 5 (frontend/e2e/)
```

---

## 2. Granular Test File Inventory

### A. Frontend Primary E2E & Verification Suites (`frontend/scripts/`)

| # | File Path | Framework / Runner | Category | Purpose & Key Assertions | DB / API / Browser | Trusted Status |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| 1 | `scripts/test-store-manager-payment-delivery-e2e.ts` | `tsx` / Node.js | E2E / State Machine / RBAC | 20-phase test: Store manager provisioning, payment confirmation gate, pickup OTP, driver store isolation, idempotent claim, delivery OTP. | Real API Engine & Data Store | **TRUSTED** |
| 2 | `scripts/test-master-identity-chain-e2e.ts` | `tsx` / Node.js | E2E / Auth / CRM | 24-assertion test: Phone normalization, `cth_cus_*` generation, guest cart merge, order history, CRM 360 link. | Real API Engine & In-Memory Store | **TRUSTED** |
| 3 | `scripts/test-checkout-verification.ts` | `tsx` / Node.js | E2E / Checkout / GST | 28-phase verification: Customization payload, price tampering prevention, GST 18%, slot gate, payment initiation. | Real API Engine & Data Store | **TRUSTED** |
| 4 | `scripts/test-unified-staff-roles-e2e.ts` | `tsx` / Node.js | Integration / RBAC | Validates canonical staff identity across Admin, Store Manager, Kitchen, DLP, and Telecaller. | Real Staff Access Control | **TRUSTED** |
| 5 | `scripts/test-crm-complete-engine-e2e.ts` | `tsx` / Node.js | E2E / CRM | Tests RFM lifecycle stage, tier derivation, duplicate detection, merge safety, CSV export. | Real CRM Engine | **TRUSTED** |
| 6 | `scripts/test-telemarketing-reorder-engine-e2e.ts` | `tsx` / Node.js | E2E / Telemarketing | Reorder scoring algorithm, agent assignment, call logging, outreach-to-order attribution. | Real Telemarketing Engine | **TRUSTED** |
| 7 | `scripts/test-n8n-outbox-complete-e2e.ts` | `tsx` / Node.js | E2E / Webhooks / n8n | HMAC SHA-256 signing, replay protection, exponential backoff, DLQ, lifecycle callbacks. | Real Webhook Engine | **TRUSTED** |
| 8 | `scripts/test-smart-login-cart-recovery-e2e.ts` | `tsx` / Node.js | E2E / Recovery | Abandoned cart detection, single-use token generation, cart restoration, stock revalidation. | Real Recovery Engine | **TRUSTED** |
| 9 | `scripts/test-scroll-frame-hero-22-e2e.ts` | Playwright / Chromium | Browser / Visual QA | Verifies 1 canvas instance, frames 1–22 only, 0 duplicate requests, 7 viewports (Desktop to Mobile). | Real Browser (Playwright) | **TRUSTED** |
| 10 | `scripts/test-performance-matrix.ts` | `tsx` / Node.js | Performance / Benchmark | Measures latencies across 8 critical subsystems (API, Auth, State Machine, Checkout, E2E). | Real Runtime Execution | **TRUSTED** |
| 11 | `scripts/test-all-11-gst-reports-browser.ts` | Playwright / Chromium | Browser / Finance | Verifies all 11 GST reports render and download valid Excel sheets with HSN 19059090 tax data. | Real Browser & ExcelJS | **TRUSTED** |
| 12 | `scripts/test-all-16-reports-browser-download.ts` | Playwright / Chromium | Browser / Analytics | Tests end-to-end report generation and browser file download for 16 operational dashboards. | Real Browser & ExcelJS | **TRUSTED** |
| 13 | `scripts/test-popup-complete-engine-e2e.ts` | Playwright / Chromium | Browser / Marketing | Tests exit-intent, time-on-page, scroll depth, and coupon copy interactions. | Real Browser (Playwright) | **TRUSTED** |
| 14 | `scripts/test-cms-page-builder-e2e.ts` | `tsx` / Node.js | Integration / CMS | Tests dynamic section rendering, banner carousels, and grid layouts from JSON config. | Real CMS Engine | **TRUSTED** |
| 15 | `scripts/test-ai-concierge-e2e.ts` | `tsx` / Node.js | Integration / AI | Tests cake sommelier intent parser, recommendation ranking, and inline cart actions. | Real AI Engine | **TRUSTED** |
| 16 | `scripts/test-staff-profiles-permissions-e2e.ts` | `tsx` / Node.js | Integration / RBAC | Tests fine-grained access profile assignment and permission check matrices. | Real Access Control | **TRUSTED** |
| 17 | `scripts/test-multicity-e2e.ts` | `tsx` / Node.js | Integration / Logistics | Tests multi-city branch resolution and pincode serviceability rules. | Real Geo / Branch Store | **TRUSTED** |
| 18 | `scripts/test-delivery-partner-browser.ts` | Playwright / Chromium | Browser / Delivery | Tests driver dashboard, available job view, claim button, and OTP input drawers. | Real Browser (Playwright) | **TRUSTED** |
| 19 | `scripts/test-production-hardening-matrix.ts` | `tsx` / Node.js | Regression Matrix | 40KB comprehensive regression matrix covering all core platform systems. | Real Core Engine | **TRUSTED** |
| 20 | `scripts/test-product-delivery-restrictions.ts` | `tsx` / Node.js | Integration / Catalog | Tests midnight delivery, same-day cutoff, and cake preparation lead time rules. | Real Catalog Engine | **TRUSTED** |

---

### B. Frontend Playwright E2E Specs (`frontend/e2e/`)

| # | File Path | Framework | Category | Scope | Trusted Status |
| :--- | :--- | :--- | :--- | :--- | :--- |
| 1 | `frontend/e2e/order-flow.spec.ts` | `@playwright/test` | Browser E2E | Homepage load, catalog eggless filter, pincode check, admin login, coupon stacking. | **TRUSTED** |
| 2 | `frontend/e2e/admin-crud-postgres.spec.ts` | `@playwright/test` | Browser E2E | Super Admin dashboard CRUD, catalog updates, branch management. | **TRUSTED** |
| 3 | `frontend/e2e/pim-product-crud.spec.ts` | `@playwright/test` | Browser E2E | PIM product creation, variant weight/pricing updates. | **TRUSTED** |
| 4 | `frontend/e2e/pim-categories.spec.ts` | `@playwright/test` | Browser E2E | Category creation, slug generation, hierarchy management. | **TRUSTED** |
| 5 | `frontend/e2e/product-card-navigation.spec.ts` | `@playwright/test` | Browser E2E | Storefront product card click $\rightarrow$ detail page navigation. | **TRUSTED** |

---

### C. Backend Medusa Module Unit & Integration Specs (`backend/src/modules/**/__tests__/`)

| # | Module | Spec File Path | Category | Scope & Assertions |
| :--- | :--- | :--- | :--- | :--- |
| 1 | `payment` | `payment.unit.spec.ts` | Unit | Payment transaction lifecycle, COD vs Online, audit trail creation. |
| 2 | `payment` | `payment-acceptance.integration.spec.ts` | Integration | End-to-end payment acceptance, signature validation, order link. |
| 3 | `shop` | `branch.unit.spec.ts` | Unit | Branch CRUD, operating hours, delivery radius, kitchen manager. |
| 4 | `shop` | `branch-verification.integration.spec.ts` | Integration | Multi-hub isolation, manager assignment, store operational status. |
| 5 | `delivery` | `delivery-slot.unit.spec.ts` | Unit | Slot capacity, midnight delivery gates, cutoff time validation. |
| 6 | `delivery` | `delivery-zone.unit.spec.ts` | Unit | Pincode polygon mapping, delivery fee tier calculation. |
| 7 | `delivery` | `phase14.unit.spec.ts` | Unit | Driver fleet status, active capacity limits, job allocation. |
| 8 | `order-lifecycle`| `order-lifecycle.unit.spec.ts` | Unit | Order state transitions (pending $\rightarrow$ confirmed $\rightarrow$ preparing $\rightarrow$ delivered). |
| 9 | `order-lifecycle`| `stage4_automation.unit.spec.ts` | Unit | Automated kitchen routing, KOT generation, status webhooks. |
| 10 | `crm` | `rfm.unit.spec.ts` | Unit | RFM score calculation, recency/frequency/monetary weighting. |
| 11 | `crm` | `segment.unit.spec.ts` | Unit | Dynamic segment rules, VIP vs At-Risk evaluation. |
| 12 | `crm` | `templates.unit.spec.ts` | Unit | WhatsApp & SMS notification template interpolation. |
| 13 | `crm` | `notes-360.unit.spec.ts` | Unit | Customer 360 note creation, staff attribution, timeline. |
| 14 | `crm` | `blacklist.unit.spec.ts` | Unit | Telemarketing opt-out and DND list management. |
| 15 | `customer` | `customer.unit.spec.ts` | Unit | Customer profile CRUD, phone uniqueness, address management. |
| 16 | `rules` | `rules.unit.spec.ts` | Unit | Promotion rule engine, min order value, category exclusions. |
| 17 | `rules` | `enterprise-coupon.unit.spec.ts` | Unit | Coupon stacking restrictions, single-use per customer enforcement. |
| 18 | `marketing` | `campaign.unit.spec.ts` | Unit | Marketing campaign scheduling, audience filtering, click tracking. |
| 19 | `marketing` | `coupon_stacking.unit.spec.ts`| Unit | Coupon exclusivity rules and conflict resolution. |
| 20 | `analytics` | `dashboard-analytics.unit.spec.ts` | Unit | Sales KPI aggregation, average order value, daily revenue. |
| 21 | `analytics` | `expense-franchise.unit.spec.ts` | Unit | Branch revenue share, franchise fee calculation. |
| 22 | `analytics` | `phase10.unit.spec.ts` | Unit | Hourly order volume distribution, peak kitchen demand. |
| 23 | `analytics` | `phase11.unit.spec.ts` | Unit | Delivery rider performance, on-time delivery percentages. |
| 24 | `catalog` | `catalog.unit.spec.ts` | Unit | Product catalog hierarchy, variants, dietary tags (eggless). |
| 25 | `cms` | `cms.unit.spec.ts` | Unit | CMS page sections, banner configuration, announcement bar. |
| 26 | `seo` | `seo.unit.spec.ts` | Unit | Meta title/description generation, OpenGraph tags, sitemap. |
| 27 | `security` | `phase15.unit.spec.ts` | Unit | RBAC permission evaluation, IP whitelisting, audit logging. |
| 28 | `localization`| `phase13.unit.spec.ts` | Unit | Multi-language translation strings, currency formatting. |
| 29 | `support` | `support.unit.spec.ts` | Unit | Customer support ticket creation, priority escalation. |
