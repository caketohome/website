# Phase Database Data Reconciliation Report

**Repository:** CakeToHome Platform  
**Target Database:** PostgreSQL 15 (Supabase Pooler: `aws-1-ap-south-1.pooler.supabase.com:6543/postgres`)  
**Audit Date:** September 7–8, 2026  
**Auditor:** Antigravity Lead Production Systems Engineer  
**Document Code:** `CTH-RECON-DB-SOT-01`  
**Classification:** PRE-CUTOVER DATA RECONCILIATION GATE  

---

## 1. Executive Summary & Verification Methodology

Before cutting over runtime operations to PostgreSQL as the single authoritative source of truth, an exhaustive empirical reconciliation between the process-local in-memory store (`(globalThis).__CTH_MEMORY_STORE__` / `ApiEngine.memoryStore`) and the PostgreSQL database was performed via `frontend/scripts/data-reconciliation-inspect.ts` and `frontend/scripts/re-audit-catalog.ts`.

### Reconciliation Summary Matrix

| Domain | Memory Count | DB Total Count | DB Active Count | Memory-Only Records | DB-Only Records | Conflicting Records | Reconciliation Action |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **Products** | 14 | 53 | 14 | 0 | 0 active (39 soft-deleted) | 0 | Canonical DB matches Memory; soft-deleted records preserved in DB |
| **Branches** | 54 | 54 | 54 | 0 | 0 | 0 | Canonical DB is 100% synchronized with Memory |
| **Customers** | 57 | 57 | 57 | 0 (all 57 match by `id`) | 0 | 0 | Canonical DB is 100% synchronized; 34 had `meta.customer_uid` aliased |
| **Orders** | 125 | 125 | 125 | 0 | 0 | 0 | Canonical DB is 100% synchronized with Memory |
| **Order Items**| Embedded (125) | 0 in `order_item` | 125 in `order.metadata->'items'` | 0 | 0 | 0 | Preserve in `order.metadata->'items'` jsonb per Medusa schema |
| **Inventory** | 14 (RAM stock) | 0 in `branch_inventory` | 0 | 14 active products | 0 | 14 products unseeded in `branch_inventory` | **Seed `branch_inventory` from catalog stock before cutover** |
| **CMS Pages** | 19 | 19 | 19 | 0 | 0 | 0 | Canonical DB is 100% synchronized with Memory |
| **Offers** | 24 | 24 | 24 | 0 | 0 | 0 | Canonical DB is 100% synchronized with Memory |

---

## 2. Deep-Dive Domain Reconciliation

### 2.1 Products & Variants
- **Memory Count:** 14 products
- **PostgreSQL Count:** 53 products total:
  - 14 active (`deleted_at IS NULL`)
  - 39 soft-deleted (`deleted_at IS NOT NULL`)
- **Key Inspection:**
  - Every active product in PostgreSQL has a 1-to-1 match with the in-memory catalog (e.g. `prod_01KXYMAJKNXGS5WT4R0QNQGV5F`, `prod_01KXYMAJKNXGS5WT4R0QNQGV5G`, etc.).
  - Pricing, weights, titles, and HSN codes (`19059090`) are identical between PostgreSQL `metadata` and in-memory attributes.
- **Conflict Analysis:** Zero conflicts. Memory-only IDs: `[]`. DB-only active IDs: `[]`.
- **Resolution:** PostgreSQL `product` table is canonical. Soft-deleted records are appropriately filtered via `WHERE deleted_at IS NULL`.

### 2.2 Branches & Delivery Zones
- **Memory Count:** 54 branches, 43 delivery zones
- **PostgreSQL Count:** 54 branches (`deleted_at IS NULL`), 43 delivery zones (`deleted_at IS NULL`)
- **Key Inspection:**
  - Branch IDs match 100% (e.g. `br_indiranagar`, `br_koramangala`, `br_whitefield`, `br_jayanagar`, etc.).
  - Delivery zones match 100% with polygon coordinates, base fees, and radius.
- **Conflict Analysis:** Zero conflicts. Memory-only IDs: `[]`. DB-only active IDs: `[]`.
- **Resolution:** PostgreSQL `branch` and `delivery_zone` tables are canonical.

### 2.3 Customers & Addresses
- **Memory Count:** 57 customers, 34 addresses
- **PostgreSQL Count:** 57 customers (`deleted_at IS NULL`), 34 addresses (`deleted_at IS NULL`)
- **ID Aliasing Observation:**
  - Initial naive comparison by `customer_uid` reported 34 mismatched records because 34 customers have an operational `meta.customer_uid` (e.g., `cust_9876543210` or phone number) distinct from their Medusa primary key `cus_...`.
  - When reconciled by canonical primary key `customer.id`, **all 57 records match identically**.
- **Conflict Analysis:** Zero conflicts. Addresses match 1-to-1 by `customer_id`.
- **Resolution:** PostgreSQL `customer` and `customer_address` tables are canonical. Both `id` and `metadata->>'customer_uid'` will be supported for query resolution.

### 2.4 Orders & Order Items
- **Memory Count:** 125 orders
- **PostgreSQL Count:** 125 orders (`deleted_at IS NULL`)
- **Order Items Architecture:**
  - Table `order_item` has 0 rows in PostgreSQL.
  - The application architecture stores order line items as an immutable JSON array in `order.metadata->'items'`.
  - All 125 orders in PostgreSQL contain their historical snapshotted line items in `metadata->'items'`.
- **Conflict Analysis:** Zero conflicts. Memory-only IDs: `0`. DB-only active IDs: `0`.
- **Resolution:** PostgreSQL `order` table is canonical. Line items remain safely housed within `metadata->'items'` without schema disruption.

### 2.5 Inventory (`branch_inventory`) — CRITICAL ACTION REQUIRED
- **Memory State:** Stock is represented either as a product attribute (`stock: 45`, `low_stock_threshold: 5`) or within branch availability objects.
- **PostgreSQL State:** Table `branch_inventory` exists with proper primary key (`id`) and unique constraint `(branch_id, variant_id)`, but has **0 rows**.
- **Risk Assessment:**
  - High risk if cut over without initial seed. If checkout switches to query `branch_inventory` while table is empty, all checkout requests would immediately fail with `INSUFFICIENT_STOCK`.
- **Reconciliation & Backfill Action:**
  - Before switching checkout to `branch_inventory`, an idempotent migration/seed script must populate `branch_inventory` for all 14 active products across active branches.
  - Initial quantity per product/branch: Default 50 units (matching `daily_capacity: 50`), reserved: 0.

### 2.6 CMS Pages & Homepage Sections
- **Memory Count:** 19 CMS pages, 32 homepage sections
- **PostgreSQL Count:** 19 CMS pages, 32 homepage sections
- **Key Inspection:**
  - `cmspg_home`, `cmspg_about`, `cmspg_contact`, and all policy pages exist in both.
  - Draft and published block configurations are persisted in `cms_page.blocks`.
- **Conflict Analysis:** Zero conflicts. Memory-only IDs: `[]`. DB-only active IDs: `[]`.
- **Resolution:** PostgreSQL `cms_page` and `cms_homepage_section` are canonical.

### 2.7 Offers & Marketing
- **Memory Count:** 24 offers
- **PostgreSQL Count:** 24 offers (`deleted_at IS NULL`)
- **Column Structure:**
  - Columns: `id, name, code, type, status, priority, starts_at, ends_at, usage_limit, per_customer_limit, is_stackable, description, conditions, rewards, metadata, total_redemptions`.
- **Conflict Analysis:** Zero conflicts. Memory-only codes: `[]`. DB-only codes: `[]`.
- **Resolution:** PostgreSQL `offer` table is canonical.

---

## 3. Discrepancy & Conflict Action Plan

| Conflict / Discrepancy | Memory Value | DB Value | Canonical Recommendation | Reason & Safety Justification | Requires Manual Approval? |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Empty `branch_inventory` Table** | Embedded `stock: 45..120` | 0 rows in table | **Populate `branch_inventory` via idempotent backfill** | Eliminates in-memory inventory without breaking checkout. Seeded with 50 units per active SKU/branch. | No (Standard operational initial state) |
| **Customer ID Aliasing (`cus_...` vs `cust_...`)** | `c.customer_uid` preferred | `c.id` is PK | **Support both `c.id` and `metadata->>'customer_uid'` in `CustomerRepository`** | Preserves backward compatibility for both auth sessions and database foreign keys. | No (Additive compatibility) |
| **Order Items Relational Table vs JSONB** | In-memory item array | `metadata->'items'` jsonb array | **Preserve `metadata->'items'`** | Fits current Medusa PostgreSQL architecture; zero risk of data loss. | No (Preserves existing data model) |

---

## 4. Cutover Preconditions Checklist

- [x] All 8 core domains inspected and counts reconciled.
- [x] Zero conflicting business records detected between memory and database.
- [x] Schema columns verified against `information_schema.columns`.
- [ ] Seed `branch_inventory` with initial stock before Phase A1 checkout cutover.
- [ ] Ensure all writes await PostgreSQL transactions before returning HTTP 200/201.
- [ ] Remove in-memory fallback in `OrderRepository.listOrders`.
