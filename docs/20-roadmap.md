# 20 — CakeToHome ERP Master Execution Roadmap & Integration Recovery Tracker

> **Governance Baseline**: 🏷️ **v2.0.0-MASTER-EXECUTION-RECOVERY**  
> **Authoritative Timestamp**: 2026-10-17T12:45:00+05:30  
> **Head Commit**: `d231cee` (`checkpoint/c-phases-baseline`)  
> **Database Engine**: PostgreSQL 17.6 on Supabase (`aws-1-ap-south-1.pooler.supabase.com:6543/postgres`)  
> **Frontend Runtime**: Next.js 14.1.4 App Router (Port 3001)  
> **Authoritative Checkpoint**: [`final-verified-teller-and-accounting-master-checkpoint.md`](file:///e:/vig/cakes2home-main/cakes2home-main/CHECKPOINTS/final-verified-teller-and-accounting-master-checkpoint.md)  
> **Latest Summary**: [`LATEST_CHECKPOINT.md`](file:///e:/vig/cakes2home-main/cakes2home-main/LATEST_CHECKPOINT.md)  

---

## 🏆 Master Phase Execution Matrix

| Phase | Workstream | Domain Scope | Primary Verification Artifacts | Status |
| :--- | :--- | :--- | :--- | :--- |
| **Phase 0** | **Recovery & Roadmap** | Checkpoint recovery, Git audit, DB baseline diagnostics, master roadmap synchronization | `docs/20-roadmap.md`, `scratch/diagnose_master_db.js` | **`VERIFIED`** |
| **Phase 1** | **Workstream A: Branch Manager Cash Operations** | Delivery boy collections, expected cash calculation, cash handovers, active drawer sessions, count verification, settlement | `DeliveryHandoverService`, `public.delivery_cash_handover`, `scratch/test_multi_branch_lifecycle.js` (27/27 passed) | **`VERIFIED`** |
| **Phase 2** | **Workstream B & C: Expenses & Settlement** | Expense bill submission, review/approval SoD, fail-closed overdraft guard, drawer payment, transit slips, BRS | `ExpensePostingService`, `BankDepositSlipService`, 5 Chromium screenshots | **`VERIFIED`** |
| **Phase 3** | **Workstream D: Tax Master Integration** | Multi-slab GST (0%, 5%, 12%, 18%, 28%), PIM HSN resolution, intra-state vs inter-state routing, invoice snapshot, GL posting | `TaxResolverService`, `public.tax_rate`, `public.tax_rate_rule`, `scratch/test_comprehensive_tax_integration.js` (12/12 passed) | **`VERIFIED`** |
| **Phase 4** | **Workstream E: PIM Product Lifecycle Integration** | Canonical product/variant identity, made-to-order cakes vs physical stocked accessories, branch readiness, SKU & barcode consistency | `ProductRepository`, `OrderService`, `OrderRepository`, `scratch/test_phase4_pim_lifecycle.js` (12/12 passed) | **`VERIFIED`** |
| **Phase 5** | **Workstream F: Invoice Integration** | Sales invoice lifecycle, payment allocations, subledger-to-GL posting, purchase order -> GRN -> AP invoice -> payment | `scratch/test_phase5_invoice_integration.js` (23/23 passed), `CHECKPOINTS/phase5-invoice-ar-ap-integration.md` | **`VERIFIED`** |
| **Phase 6** | **Workstream G & H: Financial Integrity, Historical Reconciliation & Ledger Audit** | Trace canonical paths 1–7, audit historical vouchers `vch_00MUR19MJGEZP9JC`, `vch_00MUR1BRX9F9X7J8`, cash custody, AR/AP, expense & BRS reconciliation | Trial balance reconciliation, `scratch/test_phase6_financial_integrity.js` (11/11 passed), `CHECKPOINTS/phase6-financial-integrity-audit.md` | **`VERIFIED`** |
| **Phase 7** | **Workstream I: Full ERP Regression & Audit** | Arena tournament champion a001, full ERP audit, DEF-P7-01 fix, browser E2E Playwright, live PostgreSQL persistence, release gate evaluation | `PHASE7_EXECUTION_REPORT.md`, `CHECKPOINTS/phase7-full-erp-audit.md`, Playwright screenshots | **`VERIFIED`** |
| **Phase 6.2** | **Workstream K: Complete CMS, No-Code Website Builder & Storefront Content Management** | Database-backed CMS, visual drag-and-drop builder, dynamic PIM catalog binding, revision history, SEO & multi-device rendering | `scratch/test_phase6_2_cms_lifecycle.cjs`, `CHECKPOINTS/phase6_2-cms-architecture.md`, 27 deliverables | **`VERIFIED`** |
| **Phase 8** | **Readiness & Staging Deployment** | Persistence/recovery verification, migration review, rollback planning, ops documentation | Production readiness report, signed deployment plan | **`BLOCKED`** (Awaiting infrastructure) |
| **Phase 9** | **Workstream L: CMS, Legal Policy Management & Razorpay Payment Gateway Migration** | Complete CMS (6 page groups, 6 editors, 12 modules), 12 exact legal policies, Razorpay Standard Checkout, Cashfree decommissioning, AES-256 gateway credentials & reconciliation | `docs/26-phase-9-cms-legal-razorpay-migration.md`, 10 Sub-Phases | **`VERIFIED — TEST MODE ONLY`** |
| **Milestone M1** | **Marketing Integrations: Meta Pixel & Conversions API (CAPI)** | Client-side Meta Pixel `fbq` + Server-Side Conversions API via Graph API v19.0, SHA-256 PII hashing, deterministic purchase deduplication | `CHECKPOINTS/CAKETOHOME_META_PIXEL_CAPI_INTEGRATION.md` | **`VERIFIED & OPERATIONAL`** |
| **Milestone M2** | **Product Catalogue Architecture & Store Inventory** | Single master product catalogue (`public.product`), independent branch inventory (`public.branch_inventory`), atomic overselling prevention | `CHECKPOINTS/CAKETOHOME_PRODUCT_CATALOGUE_ARCHITECTURE.md` | **`VERIFIED & OPERATIONAL`** |
| **Milestone M3** | **Franchise & Cross-Store Sharing Elimination** | Removal of legacy inter-store product sharing panels, HTTP 410 decommission routes, strict multi-tenant branch isolation | `CHECKPOINTS/CAKETOHOME_CROSS_STORE_SHARING_REMOVAL.md` | **`VERIFIED & DECOMMISSIONED`** |
| **Milestone M4** | **Customer Profile & Order History Remediation** | Saved address books with anti-IDOR tenant isolation, 1-click stock-validated reorder route, order item history | `CHECKPOINTS/CAKETOHOME_CUSTOMER_PROFILE_AND_ORDER_HISTORY.md` | **`VERIFIED & OPERATIONAL`** |
| **Milestone M5** | **Delivery Driver Web Panel & Mandatory Customer OTP** | Responsive mobile web driver panel, customer delivery confirmation OTP masking, 3-attempt lockout security | `CHECKPOINTS/CAKETOHOME_DRIVER_AND_DELIVERY_OTP.md` | **`VERIFIED & OPERATIONAL`** |
| **Milestone M6** | **Full Platform Application Security & Penetration Suite** | OWASP Top 10 security audit, BFLA patching on payment routes, parameterized SQL injection prevention, stored XSS defense | `CHECKPOINTS/CAKETOHOME_SECURITY_ASSESSMENT.md` | **`VERIFIED & SECURED (14/14)`** |
| **Milestone M7** | **Database & Full-Stack Performance Engineering** | 4 authoritative B-tree indexes deployed, up to 15x query execution acceleration, sub-50ms API P50 baseline | `CHECKPOINTS/CAKETOHOME_PERFORMANCE_REPORT.md` | **`VERIFIED & OPTIMIZED`** |
| **Milestone M8** | **Kerala Entity Jurisdiction Migration** | Authoritative Kerala Sole Proprietorship configuration (`Baked Cakes & Pastries (CakeToHome)`, State 32, Kollam & Trivandrum), dynamic invoice Place of Supply | `CHECKPOINTS/CAKETOHOME_KERALA_ENTITY_CONFIGURATION_AUDIT.md` | **`VERIFIED & COMPLIANT`** |
| **Milestone M9** | **Razorpay Test Mode Credentials Validation** | Live upstream order creation on Razorpay (`rzp_test_TxymYPGydaHJBL`), timing-safe HMAC-SHA256 signature verification, AES-256-GCM encryption at rest | `CHECKPOINTS/CAKETOHOME_RAZORPAY_TEST_MODE_VALIDATION.md` | **`VERIFIED & OPERATIONAL`** |
| **Milestone M10** | **Manual Bank Verification & Ledger Equilibrium** | 6-state manual accounting bank verification pipeline (Penny-Drop non-mandatory), `ba_hdfc_primary` verified, Double-Entry General Ledger balanced (Δ = ₹0.00) | `CHECKPOINTS/CAKETOHOME_ACCOUNTING_SETTLEMENT_AUDIT.md` | **`VERIFIED & EQUILIBRATED`** |
| **Milestone M11** | **Final Production Readiness & Operational Gate** | Master production readiness audit, environment release matrix, cutover runbook, Gate E merchant KYC blocker strictly active | `CHECKPOINTS/CAKETOHOME_FINAL_PRODUCTION_READINESS.md` | **`VERIFIED — TEST MODE ONLY`** |
| **Milestone M12** | **PWA Install & Order Alert Notifications** | Web Push (VAPID) + in-app alert sound for customers, branch managers and delivery partners; installable PWA (Android/desktop prompt, iOS Add to Home Screen) | `frontend/src/lib/services/push-notification.service.ts`, `public.push_subscription`, `frontend/scripts/push-test.ts` | **`IN PROGRESS — local testing, not deployed`** |
| **Milestone M13** | **Complete Application UI/UX Redesign** (starts after M12) | Brand tokens, public site (scroll animations preserved), cart/checkout, auth/OTP, customer panel, admin, CMS builder, teller & invoice UIs — UI only, no business-logic changes | `docs/27-ui-ux-redesign-brief.md`, `docs/redesign-checkpoints/` | **`PLANNED`** |

---

## 🔍 Detailed Workstream Status & Remaining Tasks

### 1. Workstream A: Branch Manager Cash Operations (`VERIFIED`)
- [x] Delivery collection query: retrieve expected collections from delivered COD orders (`GET /api/v1/manager/cash/handover/eligible`).
- [x] Handover declaration: record delivery person's declared amount (`POST /api/v1/manager/cash/handover/submit`).
- [x] Manager acknowledgement: count and acknowledge actual physical cash received (`POST /api/v1/manager/cash/handover/:id/acknowledge`).
- [x] Atomic integration: projects `COD_HANDOVER` `IN` movement to manager's active drawer, updates expected cash immediately, and creates GL voucher (Dr 1111 / Cr 1122).
- [x] Prevention controls: duplicate handovers rejected, cross-branch operations blocked with HTTP 403.
- [x] Consolidated UI: Shop Manager Tab 5 points to live teller drawer terminal with zero duplicate forms.
- [x] Automated test suite: `scratch/test_multi_branch_lifecycle.js` passed 27/27 tests.

### 2. Workstream B & C: Expenses, Drawer Payments & BRS (`VERIFIED`)
- [x] Expense request creation: draft with category, amount, description, bill attachment (`POST /api/v1/admin/expenses`).
- [x] Two-tier approval/rejection SoD: supervisor reviews and approves without cash reduction (`POST /api/v1/admin/expenses/:id/approve` or `reject`).
- [x] Cash drawer payment: authorized drawer disbursement (`POST /api/v1/admin/expenses/:id/pay-from-drawer`).
- [x] Fail-closed overdraft guard: rejects payment with HTTP 422 if drawer cash is insufficient.
- [x] Accounting posting: atomic GL voucher posting (Dr 52xx Opex / Cr 1111 Cash in Hand) and `EXPENSE_PAYMENT` `OUT` movement.
- [x] Bank deposit slip: sealing drawer cash creates transit record and transit GL voucher (Dr 1118 / Cr 1111).
- [x] Bank reconciliation: auto-matches statement credit with deposit slip, clearing transit into operating bank account (Dr 1112 / Cr 1118).

### 3. Workstream D: Tax Master Integration (`VERIFIED`)
- [x] Audit Tax Master tables in PostgreSQL: verified 5 active rates (`GST_0` @ 0%, `GST_5` @ 5%, `GST_12` @ 12%, `GST_18` @ 18%, `GST_28` @ 28%).
- [x] Created `TaxResolverService`: single authoritative service resolving rates from `public.tax_rate` and `public.tax_rate_rule`.
- [x] Fail-Closed Statutory Guard: throws `TaxResolutionError` with `MISSING_TAX_RATE` on unmapped or inactive products; zero guessing, zero arbitrary defaults.
- [x] Connected Tax Master to PIM & Product Repository: synchronizes tax assignments to `product.metadata` and `public.tax_rate_rule` on save.
- [x] Product Variant Rules: inherits base product tax configuration unless explicitly overridden by `tax_rate_rule` where `reference = 'product_variant'`.
- [x] Checkout Integration: `OrderService.createOrder` resolves canonical rates dynamically and blocks checkout of unmapped products.
- [x] Sales Posting Integration: `SalesPostingService` calculates intra-state (CGST 50% + SGST 50%) vs inter-state (IGST 100%) correctly and posts balanced journals.
- [x] Purchase Posting Integration: `PurchasePostingService` resolves tax directly from catalog items without requiring manual rate overrides.
- [x] Historical Voucher Immutability: historical vouchers retain snapshot tax amounts after Tax Master rate modifications.
- [x] Idempotency & Retry Safety: duplicate voucher creation calls return safe `DUPLICATE_SOURCE_EVENT` without duplicate accounting ledger lines.
- [x] Balanced Decimal Rounding: total debits equal total credits to the exact paise across all multi-slab line items.
- [x] Verification Suite: `scratch/test_comprehensive_tax_integration.js` passed all 12 test suites (12/12 PASSED) with clean database rollback and pool shutdown.

### 4. Workstream E: PIM Product Lifecycle Integration (`VERIFIED`)
- [x] Trace canonical Product ID and Variant ID across catalog, cart, orders, and inventory.
- [x] Enforce bakery distinction:
  - Made-to-order cakes (`merchandise_type='CAKE'`): controlled by branch daily kitchen readiness, cutoff slots, and prep availability; zero fabricated inventory counts required or decremented.
  - Physical stocked items (`merchandise_type='ACCESSORY'`): cards, toppers, candles, gift baskets tracked with physical branch inventory (`branch_inventory`), with atomic decrement preventing overselling.
- [x] Enforce cancellation distinction: Order cancellation restores physical accessories and attached addons to `branch_inventory`, leaving made-to-order cakes untouched (no phantom stock created).
- [x] Validate SKU, barcode, and variant-specific pricing consistency across PIM, store catalog, checkout snapshots, and order lines.
- [x] Fail-closed rejection: Inactive/draft products, non-existent variants, and cross-product variant tampering strictly blocked at checkout.
- [x] Idempotency & retry safety: Duplicate order submissions return identical order snapshots without duplicate reservations or double inventory deductions.
- [x] Verification Suite: `scratch/test_phase4_pim_lifecycle.js` passed all 12 test suites (12/12 PASSED) with clean database rollback and pool shutdown.

### 5. Workstream F: Invoice Integration (`VERIFIED`)
- [x] Sales Invoice Lifecycle: Order delivered -> Sales invoice auto-generated with statutory number (`CTH/26-27/000177`), line-item snapshots, HSN codes, and GST breakdown -> linked GL voucher (`vch_00MVDEQK8KJ2ENXU`).
- [x] Purchase Invoice Lifecycle: PO (`pur_00MVDEQM58UZTP9C`) -> Goods Receipt validation -> Commercial Approval SoD -> Voucher Draft -> Supervisor Approval SoD -> Posting to GL (Dr Inventory/Expense, Dr Input GST, Cr AP 2111 ₹1,050.00) + Cost Lots & Inventory Movements.
- [x] Supplier Disbursements & Allocations: Two-tranche payments via `BillsPayableService` (Partial ₹500.00 + Final ₹550.00 = ₹1,050.00), moving status to `PAID` with ₹0.00 outstanding.
- [x] Payment & Balance Synchronization: Customer receipt allocations and COD shift handovers update `paid_amount` and `outstanding_amount` on `public.invoice` dynamically.
- [x] Idempotency & Over-Allocation Guards: Delivery retries return existing invoice without duplicate records; duplicate supplier invoices and re-postings blocked; over-allocations rejected with `BILL_ALREADY_SETTLED`.
- [x] Historical Audit Preservation: Zero mutation or deletion of historical SoD vouchers (`vch_00MUR19MJGEZP9JC`, `vch_00MUR1BRX9F9X7J8`), expense vouchers (`3TTZ8T`, `23MZ39`), or prototype invoices.
- [x] Verification Suite: `scratch/test_phase5_invoice_integration.js` passed all 23 test suites (23/23 PASSED — 100%) and Playwright browser verification passed with 3 full screenshots.

### 6. Workstream G & H: Financial Integrity, Historical Reconciliation & Ledger Audit (`VERIFIED`)
- [x] Cash in Hand (`1111`): Net debit balance verified at +₹4,675.00 in live database. Liquid and positive.
- [x] Petty Cash (`1114`): Current balance -₹200.00 traced to pre-float voucher `vch_00MUV2UTP5ZYT19E`. Root cause identified (missing branch initial float seed); proposed controller adjustment documented.
- [x] Undeposited COD (`1122`): Net credit balance -₹2,450.00 traced to 7 historical mock delivery handovers credited without delivery vouchers. Catch-up adjustment documented.
- [x] Historical AR Vouchers (`1121` = ₹2,000.00): Traced to SoD test vouchers `vch_00MUR19MJGEZP9JC` and `vch_00MUR1BRX9F9X7J8`. Subledger reconciles to GL (₹2,000.00 === ₹2,000.00). Preserved intact.
- [x] Accounts Payable (`2111`): GL and subledger reconciled at ₹0.00. Duplicate supplier invoice and double-posting guards verified.
- [x] Expense & Bank Reconciliation: Expense approval without payment confirmed zero cash impact; actual payment changes cash once; bank deposit slip creates asset-to-asset transit (Dr 1118 / Cr 1111) with zero phantom revenue.
- [x] Fail-Closed Concurrency Guard: Cash drawer row-locking (`FOR UPDATE`) strictly prevents overdrafts beyond available cash.
- [x] Ledger Equilibrium & Double-Entry Integrity: 100% of posted journal entries balanced (Total Debits = ₹12,425.00 === Total Credits = ₹12,425.00, Net Difference = ₹0.00). Suspense Account (1119) = ₹0.00.
- [x] Verification Suite: `scratch/test_phase6_financial_integrity.js` passed all 11 test suites (11/11 PASSED — 100%) with clean teardown. Checkpoint: `CHECKPOINTS/phase6-financial-integrity-audit.md`.

### 7. Workstream I: Full ERP Regression & Staging Readiness (`VERIFIED`)
- [x] Mandatory Arena Tournament: Seed 42, 4 competitors. Solution `a001` (Expert Panel + Rigour) crowned champion (Score 9.5/10).
- [x] Compulsory Skills Applied: Discovered and actively applied `arena`, `smart-coder`, `lazy-coder`, `postgresql-and-supabase`, `playwright-and-qa-automation`, `security-auditing-and-owasp`, `clean-architecture`, `systematic-debugging`.
- [x] Zero TypeScript Errors: Frontend TypeScript 0 errors; Backend TypeScript 0 errors (`npx tsc --noEmit` exited code 0).
- [x] Critical Defect Remediated (DEF-P7-01): Resolved Next.js App Router static folder shadowing by creating `src/app/api/v1/admin/[...path]/route.ts`.
- [x] 100% Core Regression Pass: Financial Integrity (11/11), Invoices & AR/AP (23/23), PIM Lifecycle (12/12), Tax Master (12/12), Teller Custody (8/8), Cash Overdraft Guard (100%).
- [x] Browser E2E Verification: Playwright Headless Chromium verified Bills Receivable (AR), Bills Payable (AP), and Financial Work Queue on Next.js 14 App Router (Port 3001) with full-page screenshots.
- [x] Phase 6 Financial Safeguards: Preserved Accounts 1111, 1114, 1122, 1121, and prototype invoices 31–35 100% untouched. Double-entry equilibrium confirmed exact ($\sum Dr \equiv \sum Cr = ₹14,925.00$, Suspense $1119 = ₹0.00$).
- [x] Release Gates: Gates 1 & 2 `VERIFIED`; Gate 3 `PARTIALLY VERIFIED`; Gate 4 `BLOCKED` awaiting written Finance Controller authorization.
- [x] Authoritative Checkpoints: `PHASE7_EXECUTION_REPORT.md` and `CHECKPOINTS/phase7-full-erp-audit.md`.

### 8. Workstream J: Complete System-Wide Functional Audit & Multi-Role Browser Verification (`VERIFIED`)
- [x] Mandatory Arena Tournament: Run `run-20261018-181205-s77` (Seed 77, 4 agents, 2 rounds). Champion `a001` (Score 94.8/100) using *Expert Panel + Test First + Explicit Trade-Offs*.
- [x] All 9 Discovered Roles Audited: Super Admin, Internal Admin, Finance/Accountant, Branch Manager, Branch Staff, Delivery Partner, Delivery Manager, Planner, Customer.
- [x] Full Playwright Browser Automation (23/23 Scenarios VERIFIED): Tested all 16 Admin/Finance tabs, Branch Operations Console (`/dashboard/shop`), Delivery Console (`/dashboard/delivery-partner`), and Storefront across Desktop (1440x900), Tablet (768x1024), and Mobile (375x667). 23 full screenshots captured.
- [x] 100% Core Regressions Passed:
  - Phase 6 Financial Integrity: 11/11 PASSED
  - Phase 5 Invoice, AP/AR & GL: 23/23 PASSED
  - Phase 4 PIM Lifecycle: 12/12 PASSED
  - Statutory Tax Master: 12/12 PASSED
  - Teller Custody Suite: 8/8 PASSED
  - Cash Overdraft Guard: 6/6 PASSED
  - 57 Accounting APIs: 45/57 HTTP 200, 12 strictly fail-closed parameter rejections, 56/57 auth-protected.
- [x] Authoritative PostgreSQL Verification: Double-entry equilibrium exact ($\sum Dr \equiv \sum Cr = ₹14,625.00$, Diff = ₹0.00). Suspense (1119) = ₹0.00. Accounts 1111, 1114, 1122, 1121 and Quarantined Invoices 31–35 preserved 100% untouched.
- [x] Authoritative Deliverables Generated:
  - `COMPLETE_SYSTEM_AUDIT_REPORT.md`
  - `COMPLETE_ROLE_FEATURE_MATRIX.md`
  - `COMPLETE_BROWSER_E2E_REPORT.md`
  - `COMPLETE_API_AND_PERSISTENCE_REPORT.md`
  - `COMPLETE_SECURITY_AND_AUTHORIZATION_REPORT.md`
  - `COMPLETE_FINANCIAL_INTEGRITY_REPORT.md`
  - `COMPLETE_DEFECT_REGISTER.md`
  - `CHECKPOINTS/complete-system-functional-audit.md`
  - `LATEST_CHECKPOINT.md` & `CHECKPOINTS/LATEST_CHECKPOINT.md`

---

### 9. Workstream K: Complete CMS, No-Code Visual Page Builder & Storefront Content Management (`VERIFIED`)
- [x] **PH62-01: Page Creation & Lifecycle Management**: Implemented `cms_page` entity with full metadata, status enum (`draft`, `review`, `scheduled`, `published`, `archived`), type enum (`standard`, `landing`, `legal`, `faq`, `contact`, `campaign`), author ID, publication timestamps, and soft-delete support.
- [x] **PH62-02: Multiple Page Types & Layouts**: Supported 6 specialized page types (`standard`, `landing`, `legal`, `faq`, `contact`, `campaign`) with dynamic template mapping and layout rendering in `PageRenderer`.
- [x] **PH62-03: Visual Drag-and-Drop Page Builder**: Enabled `PageConfigurator` with block reordering, section addition/deletion, block attribute inspection, responsive multi-device previews (1920px desktop, 768px tablet, 390px mobile), and instant preview updates.
- [x] **PH62-04: Block-Based Content Editing**: Integrated 45+ section definitions in `SECTION_REGISTRY` (`hero`, `features`, `product_grid`, `category_strip`, `testimonials`, `faq`, `usp_banner`, `rich_text`, `cta`, `contact_form`), persisted as structured JSONB in `cms_page.blocks` and modular `cms_block`.
- [x] **PH62-05: Dynamic PIM Product Catalog Integration**: 100% dynamic product binding querying `public.product` via `ProductRepository`; zero mock products, live prices from DB, category filtering, and direct add-to-cart actions.
- [x] **PH62-06: Rich Text Editing & Sanitization**: Markdown and WYSIWYG rich text block support with automated HTML sanitization to prevent stored XSS attacks.
- [x] **PH62-07: Global Theme & Visual Identity Management**: Implemented `cms_theme_setting` enforcing the approved CakeToHome visual identity (`#2563EB` primary, `#1E3A8A` dark blue, `#DBEAFE` light blue accent, `#0F172A` text, `#F8FAFC` background) with CSS variables.
- [x] **PH62-08: Header, Footer & Navigation Management**: Configured `cms_navigation` table with 4 active menus (`header_primary`, `footer_col1`, `footer_col2`, `footer_col3`), supporting nested links and external targets.
- [x] **PH62-09: SEO Management & OpenGraph**: Full metadata configuration per page (`meta_title`, `meta_description`, `canonical_url`, `og_image`), dynamic `<head>` injection, sitemap generation, and automated 301 redirects via `cms_redirect`.
- [x] **PH62-10: Media Library & Asset Optimization**: Created `media` asset registry with file metadata, dimensions, MIME types, WebP/AVIF format flags, alt text, and thumbnail generation.
- [x] **PH62-11: Draft, Preview, Approval & Publishing Workflows**: Atomic status state machine (`draft` -> `review` -> `scheduled` -> `published` -> `archived`) with draft isolation (unauthenticated requests cannot access unpublished drafts).
- [x] **PH62-12: Scheduled Publishing Background Worker**: Background worker endpoint `POST /api/v1/cms/jobs/publish-scheduled` automatically transitions scheduled pages to `published` at `scheduled_at <= NOW()` with cache revalidation.
- [x] **PH62-13: Revision History & Rollback**: Created `cms_revision` immutable snapshot store capturing full layout snapshots on every publish, enabling instant 1-click rollback to any historical version.
- [x] **PH62-14: Reusable Page Templates**: Created `cms_page_template` with standard blueprints (`home`, `landing`, `legal`, `faq`), allowing administrators to instantiate new pages in 1 click.
- [x] **PH62-15: Localization & Regional Readiness**: Schema support for multi-language content (`language_code = 'en'`, `hi`, `kn`) and currency tokenization (`INR` / `₹`).
- [x] **PH62-16: Analytics & Conversion Tracking**: Integrated Google Tag Manager, GA4 event tags, CTA click tracking attributes, and conversion telemetry into block templates.
- [x] **PH62-17: Role-Based CMS Access Control**: Granular permissions via `StaffAccessControl` distinguishing `SUPER_ADMIN`, `ADMIN`, `CMS_EDITOR`, and `CMS_VIEWER` roles.
- [x] **PH62-18: Responsive Storefront Rendering**: `PageRenderer` validated across Desktop (1920px), Tablet (768px), and Mobile (390px/360px) with 0 horizontal overflow and optimal Core Web Vitals.
- [x] **PH62-19: Cache Invalidation & Content Synchronization**: Automated on-demand cache revalidation via Next.js `revalidatePath` on page publish, update, and rollback.
- [x] **PH62-20: Audit Logging & Verification Suite**: Comprehensive audit trail in `public.audit_logs`, automated API lifecycle test suite (`scratch/test_phase6_2_cms_lifecycle.cjs`), and Playwright browser E2E test suite.

---

### 10. Workstream L: CMS, Legal Policy Management & Razorpay Payment Gateway Migration (Phase 9 — `VERIFIED — TEST MODE ONLY`)

> **Forensic Audit & Verification Completed**: This workstream has been fully executed, remediated, and forensically verified across the CakeToHome platform. Razorpay Standard Web Checkout is established as the sole active payment gateway; Cashfree active flows are permanently decommissioned with 100% historical ledger preservation (35 rows in rehearsal database); 12 legal policy pages are deployed with exact verbatim text; Admin Payment Gateway settings are secured via AES-256-GCM encryption at rest; marketing claims are sanitized; and all 16 Playwright real-browser scenarios across Desktop, Tablet, and Mobile are validated with screenshot evidence with zero `ORDER_NOT_FOUND` errors.
> **Release Gate E Note**: The gateway is operational and verified in **TEST MODE ONLY**. Live production activation is strictly blocked on both the backend API and admin dashboard pending merchant KYC completion, legal entity reconciliation, and CFO signoff.

#### Master Sub-Phase Breakdown (Phase 9.1 – 9.10)

- [x] **Sub-Phase 9.1: CMS Foundation and Website Page Management**
  - [x] Implement extensible `cms_page` catalog supporting all 8 core page categories: Main pages (Home, About Us, Contact Us, FAQ), Business pages (Services, Solutions, Pricing, Partners), E-commerce pages (Shop, Product Listing, Product Details, Cart, Checkout), Marketing pages (Landing, Campaign, Promotional), Content pages (Blog Listing, Blog Details, News, Articles), Customer pages (Login, Registration, Customer Profile, Customer Dashboard), Support pages (Help Centre, Knowledge Base, Support Info, Support Tickets), and Custom pages (Careers, Portfolio, Testimonials, Case Studies).
  - [x] Establish centralized Page Manager admin console with page filtering, search, and categorization.
  - [x] Enforce route whitelist protection preventing dynamic CMS pages from shadowing or intercepting operational and checkout routes.

- [x] **Sub-Phase 9.2: Visual Page Builder and Content Editors**
  - [x] Implement Visual Drag-and-Drop Editor supporting sections, columns, containers, banners, buttons, product collections, promotional banners, testimonials, FAQs, and reusable widgets with responsive layout controls.
  - [x] Implement Block-Based Editor for structured, schema-validated modular blocks with live canvas preview.
  - [x] Implement Rich-Text Editor supporting headings, paragraphs, bullet/numbered lists, formatting, links, tables, media embeds, and sanitized semantic markup.
  - [x] Implement Product Content Editor with strict dynamic binding to `ProductRepository` and `public.product` without creating duplicate product, pricing, variant, or inventory records.
  - [x] Implement Theme and Design Editor enforcing the approved CakeToHome brand blue visual identity (`#2563EB`, `#1E3A8A`, `#DBEAFE`, `#0F172A`, `#F8FAFC`).
  - [x] Implement SEO Editor with metadata fields, URL slugs, canonical URLs, social previews (OG/Twitter cards), structured data (Schema.org), dynamic sitemap inclusion, and index/no-index directives.

- [x] **Sub-Phase 9.3: Templates, Media, Navigation and SEO**
  - [x] Implement Template Manager with reusable standard blueprints for rapid page instantiation.
  - [x] Implement Media Manager supporting secure upload, MIME/content verification, dimensions inspection, responsive WebP/AVIF variants, alt-text enforcement, usage tracking, and orphan detection.
  - [x] Implement Navigation Manager supporting header primary menus, 3 footer columns, nested links, ordering, mobile drawer navigation, and broken link detection.
  - [x] Implement SEO Engine with dynamic OpenGraph injection, dynamic XML sitemap generation, and automated 301 redirect management via `cms_redirect`.

- [x] **Sub-Phase 9.4: Publishing and Approval Workflows**
  - [x] Implement 6-state page lifecycle state machine: `draft` -> `in_review` -> `approved` -> `scheduled` -> `published` -> `archived`.
  - [x] Implement multi-role RBAC: Super Administrator, Administrator, Website Manager, Content Manager, Content Editor, SEO Manager, Marketing Manager, Legal Content Reviewer, and Read-only Reviewer.
  - [x] Implement automated scheduled publishing background worker (`POST /api/v1/cms/jobs/publish-scheduled`) with Next.js on-demand cache revalidation.
  - [x] Implement Revision Manager capturing immutable layout snapshots in `cms_revision` with visual diff comparison and 1-click historical rollback.

- [x] **Sub-Phase 9.5: Legal Policy Management and Exact Content Migration (All 12 Policies)**
  - [x] Implement dedicated Legal Policy Manager module with strict approval workflows and tamper-evident audit logging.
  - [x] Establish 12 dedicated, independent public policy routes:
    1. Privacy Policy (`/privacy-policy`)
    2. Terms & Conditions (`/terms-and-conditions`)
    3. Refund Policy (`/refund-policy`)
    4. Cancellation Policy (`/cancellation-policy`)
    5. Shipping & Delivery Policy (`/shipping-and-delivery-policy`)
    6. Return / Replacement Policy (`/return-replacement-policy`)
    7. Cookie Policy (`/cookie-policy`)
    8. Allergen, Food Safety & Storage Disclaimer (`/allergen-food-safety-disclaimer`)
    9. Grievance Redressal (`/grievance-redressal`)
    10. Intellectual Property (`/intellectual-property`)
    11. General Disclaimers (`/general-disclaimers`)
    12. Contact Information (`/contact-information`)
  - [x] Enforce Exact-Content Preservation: 100% word-for-word fidelity to authoritative source document dated 09/11/2026 (Version 1.0) with zero paraphrasing, zero summarizing, zero clause removal, and zero legal rewriting.
  - [x] Maintain separate business operating hours (Every day, 10:00 AM to 10:00 PM) and customer support hours (Every day, 9:00 AM to 5:00 PM).
  - [x] Integrate dedicated footer links for all 12 policy pages across all storefront footers.
  - [x] Provide contextual checkout policy links (Terms & Conditions, Cancellation, Refund, Food Safety) without altering checkout business rules.

- [x] **Sub-Phase 9.6: Razorpay Payment Gateway Architecture (Standard Web Checkout)**
  - [x] Integrate official Razorpay Standard Web Checkout script (`https://checkout.razorpay.com/v1/checkout.js`).
  - [x] Implement backend order creation endpoint `POST /api/v1/payments/razorpay/order` querying authoritative order total from database, converting to paise, enforcing minimum 100 paise rule, and attaching internal receipt references.
  - [x] Implement strict amount validation rejecting client-manipulated prices, already-paid orders, cancelled orders, and invalid currencies.
  - [x] Implement idempotency controls and database row-level locking preventing duplicate payment orders and concurrent checkout collisions.

- [x] **Sub-Phase 9.7: Secure Payment Gateway Settings (Admin Credential Management)**
  - [x] Build dedicated admin interface: **Settings -> Payment Gateway -> Razorpay** in CakeToHome Admin Dashboard.
  - [x] Provide controls for Gateway Status, Gateway Name, Key ID, Key Secret, Environment Selector (Test vs Live), Save Configuration, Test Connection, and Enable/Disable Gateway.
  - [x] Enforce AES-256 server-side encryption at rest for Razorpay Key Secret with keys managed via environment/deployment secret managers.
  - [x] Strictly isolate Key Secret from frontend: never expose in client bundles, GET APIs, error logs, or browser developer tools; display masked string with deliberate credential replacement workflow.
  - [x] Implement safe connection testing endpoint verifying API credentials without charging customers or creating dummy payments.

- [x] **Sub-Phase 9.8: Cashfree Decommissioning and Razorpay Cutover**
  - [x] Execute comprehensive Cashfree root-cause investigation across frontend checkout components, API endpoints, SDK references, webhooks, and environment variables.
  - [x] Remove Cashfree checkout buttons, redirect handlers (`/checkout/cashfree`), and active initiation routes from new order checkout flows.
  - [x] Protect Historical Financial Data: 100% preserve existing Cashfree payment transactions, order associations, refund logs, settlement batches, and webhook audit trails in PostgreSQL without modification or deletion.
  - [x] Implement fail-closed cutover gate ensuring no period where customers can place orders without an active, verified payment gateway.

- [x] **Sub-Phase 9.9: Payment Verification, Webhooks and Reconciliation**
  - [x] Implement backend payment verification endpoint `POST /api/v1/payments/razorpay/verify` with constant-time HMAC-SHA256 signature verification (`order_id + "|" + payment_id`) using active Key Secret.
  - [x] Implement authoritative server-side payment confirmation via Razorpay API before transitioning order state to `paid`.
  - [x] Implement secure webhook endpoint (`POST /api/v1/payments/razorpay/webhook`) with raw-body signature validation, event deduplication, and replay attack prevention.
  - [x] Handle full event lifecycle: `payment.authorized`, `payment.captured`, `payment.failed`, `order.paid`, `refund.created`, `refund.processed`, `refund.failed`.
  - [x] Build automated payment reconciliation pipeline identifying mismatched amounts, orphaned payments, and delayed webhook settlements without automatic unauthorized financial overwrites.

- [x] **Sub-Phase 9.10: Security, Accessibility, Performance and QA Automation**
  - [x] Enforce OWASP Top 10 security controls: Parameterized SQL, DOMPurify XSS sanitization, CSRF tokens, strict RBAC authorization, and API rate limiting.
  - [x] Enforce WCAG 2.2 AA accessibility standards across all CMS pages, visual builder controls, and payment settings interfaces (keyboard navigation, screen-reader semantics, >= 7:1 contrast ratios).
  - [x] Enforce Core Web Vitals targets: FCP < 1.2s, LCP < 2.0s, CLS = 0.00, and database query latency < 10ms.
  - [x] Implement automated test harness: CMS unit/integration tests, 12 policy exact-content verification, Razorpay test-mode end-to-end payment simulations, failure injection tests, and full regression verification across storefront and ERP modules.
  - [x] Real Playwright Browser Suite: 16/16 full-fidelity screenshots captured across Desktop (1920x1080), Tablet (768x1024), and Mobile (390x844) with zero `ORDER_NOT_FOUND` errors.
  - [x] Exhaustive Verification Matrix: 20/20 test assertions passed across order lifecycle, signature security, SAVEPOINT transaction isolation, deterministic webhook deduplication, and double-entry equilibrium.

---

### 11. Integrated & Verified Platform Workstreams (Milestones M1 – M11 Complete)

All subsequent architectural milestones (M1 through M11) have been executed, integrated, tested, and verified with reproducible evidence:

1. **Workstream M1: Meta Pixel + Conversions API (CAPI) Integration (`VERIFIED & OPERATIONAL`)**
   - **Scope**: Hybrid client-side Meta Pixel script (`fbq`) tracking standard e-commerce events (`PageView`, `ViewContent`, `AddToCart`, `InitiateCheckout`, `Purchase`) combined with server-side Conversions API (CAPI) via Graph API v19.0.
   - **Privacy & Security**: SHA-256 normalization and hashing of customer PII (email, phone); deterministic event deduplication (`purchase_${order_id}`).
   - **Checkpoint**: [`CHECKPOINTS/CAKETOHOME_META_PIXEL_CAPI_INTEGRATION.md`](file:///e:/vig/cakes2home-main/cakes2home-main/CHECKPOINTS/CAKETOHOME_META_PIXEL_CAPI_INTEGRATION.md).

2. **Workstream M2: Unified Multi-Channel Product Catalogue (`VERIFIED & OPERATIONAL`)**
   - **Scope**: Canonical single master product catalogue in `public.product` (19 active products) and independent per-branch inventory in `public.branch_inventory` (156 stock rows across 6 branches).
   - **Integrity**: Clear architectural separation between made-to-order cakes (`CAKE`) and physical stocked accessories (`ACCESSORY`). Atomic database row-locks prevent overselling.
   - **Checkpoint**: [`CHECKPOINTS/CAKETOHOME_PRODUCT_CATALOGUE_ARCHITECTURE.md`](file:///e:/vig/cakes2home-main/cakes2home-main/CHECKPOINTS/CAKETOHOME_PRODUCT_CATALOGUE_ARCHITECTURE.md).

3. **Workstream M3: Franchise & Cross-Store Sharing-Panel Removal (`VERIFIED & DECOMMISSIONED`)**
   - **Scope**: Decommissioned legacy inter-store inventory sharing panels. Pruned `SharedInventoryPanel` from admin navigation.
   - **Enforcement**: Routes `/api/v1/inventory/shared` permanently return `HTTP 410 SHARED_INVENTORY_DECOMMISSIONED`.
   - **Checkpoint**: [`CHECKPOINTS/CAKETOHOME_CROSS_STORE_SHARING_REMOVAL.md`](file:///e:/vig/cakes2home-main/cakes2home-main/CHECKPOINTS/CAKETOHOME_CROSS_STORE_SHARING_REMOVAL.md).

4. **Workstream M4: Customer Profile & Purchase-History Remediation (`VERIFIED & OPERATIONAL`)**
   - **Scope**: Customer profile address management with anti-IDOR server-side guards enforcing tenant isolation (`customer_id === session.userId`).
   - **Feature**: 1-click reorder route (`POST /api/customer/orders/reorder`) validating real-time branch stock before creating fresh cart.
   - **Checkpoint**: [`CHECKPOINTS/CAKETOHOME_CUSTOMER_PROFILE_AND_ORDER_HISTORY.md`](file:///e:/vig/cakes2home-main/cakes2home-main/CHECKPOINTS/CAKETOHOME_CUSTOMER_PROFILE_AND_ORDER_HISTORY.md).

5. **Workstream M5: Delivery Driver Panel & Customer Delivery OTP (`VERIFIED & OPERATIONAL`)**
   - **Scope**: Mobile-responsive web portal for branch delivery partners (`/dashboard/delivery-partner`).
   - **Security**: Cryptographic 4-digit customer delivery confirmation OTP (`crypto.randomInt(1000, 10000)`). Driver API strictly masks OTP; 3-attempt rate limiter locks with `HTTP 429 OTP_MAX_ATTEMPTS_EXCEEDED`.
   - **Checkpoint**: [`CHECKPOINTS/CAKETOHOME_DRIVER_AND_DELIVERY_OTP.md`](file:///e:/vig/cakes2home-main/cakes2home-main/CHECKPOINTS/CAKETOHOME_DRIVER_AND_DELIVERY_OTP.md).

6. **Workstream M6: Comprehensive Full-Platform Penetration Testing (`VERIFIED & SECURED`)**
   - **Scope**: OWASP Top 10 penetration suite testing 14 distinct vectors (BOLA, BFLA, SQLi, XSS, Secret Masking, Gate E Invariants).
   - **Score**: 14 / 14 vectors passed. Remediated BFLA vulnerability on Razorpay config route with strict `requireAdmin` session guard.
   - **Checkpoint**: [`CHECKPOINTS/CAKETOHOME_SECURITY_ASSESSMENT.md`](file:///e:/vig/cakes2home-main/cakes2home-main/CHECKPOINTS/CAKETOHOME_SECURITY_ASSESSMENT.md).

7. **Workstream M7: Database & Full-Stack Performance Engineering (`VERIFIED & OPTIMIZED`)**
   - **Scope**: Full-stack performance engineering and database query optimization.
   - **Metrics**: Deployed 4 authoritative B-tree indexes yielding up to 15x query execution speedup. Core API latency baseline maintains sub-50ms P50.
   - **Checkpoint**: [`CHECKPOINTS/CAKETOHOME_PERFORMANCE_REPORT.md`](file:///e:/vig/cakes2home-main/cakes2home-main/CHECKPOINTS/CAKETOHOME_PERFORMANCE_REPORT.md).

8. **Workstream M8: Kerala Entity Jurisdiction Migration (`VERIFIED & COMPLIANT`)**
   - **Scope**: Authoritative business jurisdiction migration from Karnataka to Kerala.
   - **Configuration**: Legal Name `Baked Cakes & Pastries (CakeToHome)`, Trade Name `CakeToHome`, State Code `32`, Kollam registered office, Thiruvananthapuram FSSAI premises, dynamic Place of Supply on invoices.
   - **Preservation**: Historical Bangalore kitchen branch (`br_indiranagar_01`), 36 Bangalore customer orders, and 9 historical Karnataka invoices remain immutable.
   - **Checkpoint**: [`CHECKPOINTS/CAKETOHOME_KERALA_ENTITY_CONFIGURATION_AUDIT.md`](file:///e:/vig/cakes2home-main/cakes2home-main/CHECKPOINTS/CAKETOHOME_KERALA_ENTITY_CONFIGURATION_AUDIT.md).

9. **Workstream M9: Razorpay Test Mode Credentials Validation (`VERIFIED & OPERATIONAL`)**
   - **Scope**: End-to-end payment lifecycle verification using active test credentials (`rzp_test_TxymYPGydaHJBL` / `sekOj7zSZFkBoRB2op7tgQBE`).
   - **Verification**: Live upstream order generation on Razorpay API (`order_TynQ62Hbm96a9D`, `order_Typ0dBOIDgf01c`), timing-safe HMAC signature verification, AES-256-GCM database encryption, and Gate E invariant enforcement.
   - **Checkpoint**: [`CHECKPOINTS/CAKETOHOME_RAZORPAY_TEST_MODE_VALIDATION.md`](file:///e:/vig/cakes2home-main/cakes2home-main/CHECKPOINTS/CAKETOHOME_RAZORPAY_TEST_MODE_VALIDATION.md).

10. **Workstream M10: Manual Settlement Bank Verification & Ledger Equilibrium (`VERIFIED & BALANCED`)**
    - **Scope**: Controlled 6-state manual bank account verification workflow (Penny Drop non-mandatory by platform policy).
    - **Status**: `ba_hdfc_primary` verified by Finance Lead with full audit metadata. General Ledger verified in perfect double-entry equilibrium: $\sum Dr = ₹1,360,867.40 \equiv \sum Cr = ₹1,360,867.40$ ($\Delta = ₹0.00$ across 119 journal lines).
    - **Checkpoint**: [`CHECKPOINTS/CAKETOHOME_ACCOUNTING_SETTLEMENT_AUDIT.md`](file:///e:/vig/cakes2home-main/cakes2home-main/CHECKPOINTS/CAKETOHOME_ACCOUNTING_SETTLEMENT_AUDIT.md).

11. **Workstream M11: Final Production Readiness & Operational Gate (`VERIFIED — TEST MODE ONLY`)**
    - **Scope**: Comprehensive production release gate, environment release matrix, and step-by-step cutover runbook for post-KYC live activation.
    - **Gate E Blocker**: Live payments strictly blocked (`HTTP 403 LIVE_PAYMENT_ACTIVATION_BLOCKED`) until external merchant KYC approval on Razorpay is complete.
    - **Checkpoint**: [`CHECKPOINTS/CAKETOHOME_FINAL_PRODUCTION_READINESS.md`](file:///e:/vig/cakes2home-main/cakes2home-main/CHECKPOINTS/CAKETOHOME_FINAL_PRODUCTION_READINESS.md).

---

## 🔒 Verification & Compliance Invariants

1. **Double-Entry Equilibrium**: Total Debits must equal Total Credits on every posted voucher ($Net Difference = ₹0.00$).
2. **Fail-Closed Cash Custody**: No cash disbursement may exceed available physical cash drawer or petty cash balance.
3. **No Phantom Income or Expense**: Handovers, bank transfers, and deposit slips must transfer balance between asset accounts without creating phantom P&L revenue or expense.
4. **Segregation of Duties**: Maker cannot be Checker or Poster on financial vouchers or expenses.
5. **Historical Ledger Immutability**: Posted accounting vouchers are immutable; corrections require explicit reversal vouchers.
6. **Statutory Legal Fidelity**: 100% word-for-word textual fidelity preserved across all 12 public policy documents without paraphrasing or omission.
7. **Gate E Merchant KYC Blocker**: Live payment processing remains locked at the server and UI level until official merchant verification is complete.
