# CakeToHome Phase 3.0 — Database Forensic Audit, Product Data Recovery, Schema Cleanup & Full Application Restoration

## 1. Objective
Forensically investigate what database objects, test records, category mappings, and image assignments changed when invoicing and accounting development began. Reconcile the product catalog to authoritative sources, remove ONLY proven redundant/unreferenced database tables after verified backup, restore product imagery and category relationships, reconcile admin analytics and GSTIN identity, and verify end-to-end functionality via Playwright.

## 2. Hard Constraints & Safety Gates
1. **Database Safety & Backup**:
   - Isolated PostgreSQL 16 on `127.0.0.1:5433/cth_test`. Verified timestamped backups must exist before any mutating operations.
   - Zero loss of business data: all 123 orders, 70 order line items, 58 order items, 36 payment transactions, 71 invoices, 7 invoice sequences, 2 vouchers, and 98 accounting accounts must be preserved.
2. **Catalog Integrity & Provenance**:
   - Reconcile genuine catalog products against `scratch/product_master_dump.json` and authoritative records.
   - Decontaminate synthetic audit test products (e.g. `audit_prod_*`, `DB PERSISTENCE TEST *`, `Sanity Test Cake *`, `Test Cake`) by checking foreign keys first. If unreferenced, remove or soft-delete so they do not contaminate public storefront listings, search, or category counts.
3. **Table Cleanup Register**:
   - Classify all 40 tables in `public` schema.
   - Inspect the 20 empty tables for foreign key constraints, views, triggers, and codebase references.
   - Drop ONLY proven redundant, non-authoritative, unreferenced test tables using `RESTRICT` inside controlled transactions. Never use `CASCADE`.
   - Never drop core business, customer, order, payment, invoice, accounting, or company tables.
4. **Product Imagery & Merchandising**:
   - Ensure every product has accurate, non-misleading imagery. No chocolate cake images for gold acrylic toppers, no pizza/beverage photos in cake categories.
   - Reconcile category counts (e.g. Artisanal Cakes count must not be inflated by accessories or test products).
5. **Admin Analytics & GSTIN**:
   - Trace origin of `29AAAAA0000A1Z5` placeholder. Reconcile admin dashboard with registered seller GSTIN and actual order/invoice metrics.
6. **Statutory Invoice Safeguard**:
   - Maintain fail-closed statutory invoice safeguard pending legal authorization.
7. **Verification**:
   - Real PostgreSQL queries, API inspections, and Playwright browser tests against `http://localhost:3000`.
