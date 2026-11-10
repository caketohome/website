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

## 🔒 Verification & Compliance Invariants

1. **Double-Entry Equilibrium**: Total Debits must equal Total Credits on every posted voucher ($Net Difference = ₹0.00$).
2. **Fail-Closed Cash Custody**: No cash disbursement may exceed available physical cash drawer or petty cash balance.
3. **No Phantom Income or Expense**: Handovers, bank transfers, and deposit slips must transfer balance between asset accounts without creating phantom P&L revenue or expense.
4. **Segregation of Duties**: Maker cannot be Checker or Poster on financial vouchers or expenses.
5. **Historical Ledger Immutability**: Posted accounting vouchers are immutable; corrections require explicit reversal vouchers.
